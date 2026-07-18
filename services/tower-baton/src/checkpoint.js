// Tower baton — the baton FORMATS: Larry's checkpoint and Tower's reply, plus the
// parsers/correlators that make the ClickUp thread the source of truth.
//
// Two blocks travel through one ClickUp comment thread:
//
//   [LARRY -> TOWER]  — Larry hands off a checkpoint for review (concise, factual).
//   [TOWER -> LARRY]  — Tower returns a compact QA verdict (tight, not an essay).
//
// Both are plain `key: value` blocks with a few `- ` list fields, so they are
// human-readable in ClickUp AND machine-parseable for correlation. No secret ever
// appears in either block.

export const CHECKPOINT_MARKER = '[LARRY → TOWER]';
export const RESPONSE_MARKER = '[TOWER → LARRY]';

// ASCII fallbacks tolerated on parse (some clients mangle the arrow glyph).
const CHECKPOINT_MARKER_RE = /\[LARRY\s*(?:→|->|=>)\s*TOWER\]/i;
const RESPONSE_MARKER_RE = /\[TOWER\s*(?:→|->|=>)\s*LARRY\]/i;

export const CHECKPOINT_STATE = 'READY_FOR_TOWER_REVIEW';
export const VERDICTS = Object.freeze(['APPROVE', 'CORRECTIONS_REQUIRED', 'DECISION_REQUIRED', 'BLOCKED']);

const CHECKPOINT_SCALARS = ['state', 'checkpoint_id', 'build_id', 'wp_id', 'brief_ref', 'branch', 'head_sha', 'base_sha', 'summary', 'tests'];
const CHECKPOINT_LISTS = ['evidence_refs', 'questions_or_blockers'];

const RESPONSE_SCALARS = ['checkpoint_id', 'reviewed_head', 'prompt_fingerprint', 'verdict', 'summary', 'next_action'];
const RESPONSE_LISTS = ['material_findings'];

// ── a tiny block parser (key: value, plus `- ` lists under a `key:` header) ──────

function parseBlock(text, scalarKeys, listKeys) {
  const lines = String(text ?? '').split(/\r?\n/);
  const out = {};
  const scalars = new Set(scalarKeys);
  const lists = new Set(listKeys);
  let currentList = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const listItem = line.match(/^\s*[-*]\s+(.*)$/);
    if (listItem && currentList) {
      const v = listItem[1].trim();
      if (v) out[currentList].push(v);
      continue;
    }
    const kv = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) { currentList = null; continue; }
    const key = kv[1].toLowerCase();
    const val = kv[2].trim();
    if (lists.has(key)) {
      out[key] = out[key] ?? [];
      currentList = key;
      // Support inline comma lists on the same line too: `evidence_refs: a, b`.
      if (val) for (const part of val.split(',')) { const p = part.trim(); if (p) out[key].push(p); }
      continue;
    }
    if (scalars.has(key)) {
      out[key] = val;
      currentList = null;
    } else {
      currentList = null;
    }
  }
  return out;
}

// ── Larry's checkpoint ───────────────────────────────────────────────────────

/**
 * Parse a `[LARRY -> TOWER]` checkpoint block out of a comment body. Returns
 * { ok, checkpoint, errors[] }. Fail-closed: a missing marker, a missing
 * checkpoint_id, a wrong state, or an absent head_sha is an error — the watcher
 * must never review an underspecified checkpoint.
 */
export function parseCheckpoint(body) {
  const text = String(body ?? '');
  const errors = [];
  if (!CHECKPOINT_MARKER_RE.test(text)) {
    return { ok: false, checkpoint: null, errors: ['no [LARRY → TOWER] marker'] };
  }
  const after = text.slice(text.search(CHECKPOINT_MARKER_RE) + text.match(CHECKPOINT_MARKER_RE)[0].length);
  const fields = parseBlock(after, CHECKPOINT_SCALARS, CHECKPOINT_LISTS);
  for (const k of CHECKPOINT_LISTS) fields[k] = fields[k] ?? [];

  if (!fields.checkpoint_id) errors.push('missing checkpoint_id');
  if (fields.state !== CHECKPOINT_STATE) errors.push(`state must be ${CHECKPOINT_STATE} (got "${fields.state ?? ''}")`);
  if (!fields.head_sha || !/^[0-9a-f]{7,40}$/i.test(fields.head_sha)) errors.push('missing/invalid head_sha (7-40 hex)');
  if (!fields.brief_ref) errors.push('missing brief_ref');
  if (!fields.branch) errors.push('missing branch');
  // build_id / wp_id anchor the cross-build round chain; wp_id may be blank for a
  // single-WP build but build_id + brief_ref must pin the chain.
  if (!fields.build_id) errors.push('missing build_id');

  return { ok: errors.length === 0, checkpoint: fields, errors };
}

/** The stable per-chain key (rounds are counted per build/wp/brief chain). */
export function chainKey(checkpoint) {
  return `${checkpoint?.build_id ?? ''}|${checkpoint?.wp_id ?? ''}|${checkpoint?.brief_ref ?? ''}`;
}

/** Render a `[LARRY -> TOWER]` checkpoint block (used by the handoff command). */
export function formatCheckpoint(cp = {}) {
  const lines = [CHECKPOINT_MARKER];
  lines.push(`state: ${cp.state ?? CHECKPOINT_STATE}`);
  for (const k of ['checkpoint_id', 'build_id', 'wp_id', 'brief_ref', 'branch', 'head_sha', 'base_sha', 'summary', 'tests']) {
    if (cp[k] !== undefined && cp[k] !== null && cp[k] !== '') lines.push(`${k}: ${cp[k]}`);
  }
  for (const k of CHECKPOINT_LISTS) {
    const arr = Array.isArray(cp[k]) ? cp[k] : [];
    if (arr.length) { lines.push(`${k}:`); for (const item of arr) lines.push(`  - ${item}`); }
  }
  return lines.join('\n');
}

// ── Tower's reply ────────────────────────────────────────────────────────────

/**
 * Render a `[TOWER -> LARRY]` reply. Kept tight: verdict + summary + <=3 material
 * findings (safety may exceed) + ONE bounded next_action. Not an 8000-word essay.
 */
export function formatResponse(r = {}) {
  const lines = [RESPONSE_MARKER];
  lines.push(`checkpoint_id: ${r.checkpoint_id ?? ''}`);
  lines.push(`reviewed_head: ${r.reviewed_head ?? ''}`);
  lines.push(`prompt_fingerprint: ${r.prompt_fingerprint ?? ''}`);
  lines.push(`verdict: ${r.verdict ?? ''}`);
  if (r.summary) lines.push(`summary: ${String(r.summary).slice(0, 600)}`);
  const findings = Array.isArray(r.material_findings) ? r.material_findings : [];
  if (findings.length) {
    lines.push('material_findings:');
    for (const f of findings) lines.push(`  - ${String(f).slice(0, 240)}`);
  }
  if (r.next_action) lines.push(`next_action: ${String(r.next_action).slice(0, 400)}`);
  return lines.join('\n');
}

/**
 * Parse a `[TOWER -> LARRY]` reply out of a comment body. Returns
 * { ok, response, errors[] }.
 */
export function parseResponse(body) {
  const text = String(body ?? '');
  if (!RESPONSE_MARKER_RE.test(text)) return { ok: false, response: null, errors: ['no [TOWER → LARRY] marker'] };
  const after = text.slice(text.search(RESPONSE_MARKER_RE) + text.match(RESPONSE_MARKER_RE)[0].length);
  const fields = parseBlock(after, RESPONSE_SCALARS, RESPONSE_LISTS);
  fields.material_findings = fields.material_findings ?? [];
  const errors = [];
  if (!fields.checkpoint_id) errors.push('missing checkpoint_id');
  if (!VERDICTS.includes(fields.verdict)) errors.push(`verdict must be one of ${VERDICTS.join('|')}`);
  return { ok: errors.length === 0, response: fields, errors };
}

/**
 * Correlate a candidate Tower reply against the checkpoint a caller is waiting on.
 * A reply matches ONLY when checkpoint_id matches AND — when an expected head is
 * supplied — reviewed_head matches. A reply for the RIGHT checkpoint but a STALE
 * head (Larry pushed a new head after handoff) is REJECTED as stale.
 */
export function correlateResponse(response, { checkpointId, expectedHead = null } = {}) {
  if (!response || response.checkpoint_id !== checkpointId) return { match: false, stale: false };
  if (expectedHead && response.reviewed_head && response.reviewed_head !== expectedHead) {
    return { match: false, stale: true };
  }
  return { match: true, stale: false };
}

/** Scan a whole ClickUp comment thread for the checkpoint_ids Tower has ALREADY answered. */
export function answeredCheckpointIds(comments) {
  const ids = new Set();
  for (const c of comments ?? []) {
    const parsed = parseResponse(c?.comment_text ?? c?.text ?? c?.body ?? '');
    if (parsed.ok && parsed.response.checkpoint_id) ids.add(parsed.response.checkpoint_id);
  }
  return ids;
}
