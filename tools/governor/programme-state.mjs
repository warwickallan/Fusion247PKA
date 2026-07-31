// Durable Programme State (BUILD-018 T-09)
//
// The durable half of AD-2's two-store split. Session health is ephemeral,
// machine-local and dies with the conversation (T-02); THIS is the git-versioned
// record a fresh Larry reads after `/clear`.
//
// WHERE IT LIVES, and why
// -----------------------
// `<programme.home>/programme-state.json` — with the programme, on the programme's
// branch, inside the programme's worktree. Not in a single estate-wide location,
// because a build's durable state and its branch must move together: state banked on
// `build-018/session-governor` describes commits that only exist on that branch, and
// parking it on `main` would make it lie the moment the branch advanced.
//
// The consequence is deliberate and already precedented in this estate: durable state
// on a feature branch is invisible from another checkout, so every pointer carries its
// own retrieval instruction (`how_to_read`) — exactly the `git show <sha>:<path>` form
// 00-ESTATE.md already uses to reach GL-012 section 6a from this worktree.
//
// RELATIONSHIP TO session-handoff.md (AD-12)
// ------------------------------------------
// `Team Knowledge/fusion-brief/session-handoff.md` is NOT a rival source of truth and is
// not replaced. It is RENDERED from this document by `renderSessionHandoff()`, preserving
// its existing frontmatter contract and its five section headings verbatim. The schema
// carries `locked_decisions` and `runtime_pointers` as first-class fields precisely so
// that compatibility is structural — the renderer maps fields to sections — rather than
// asserted in prose and then drifting.
//
// FAIL-CLOSED ON WRITE, and why that does not contradict INV-2
// ------------------------------------------------------------
// `writeProgrammeState` refuses to persist an invalid document. INV-2 ("never trap
// Warwick") governs BLOCKING PATHS in his live session — hooks and preflight, which must
// fail open. Banking a durable artefact is not such a path: a corrupt banked state is
// silently wrong for every future session, which is the failure mode this build exists to
// prevent. Availability of the session is protected by never putting this writer on a
// blocking path, not by letting it write rubbish.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SCHEMA_PATH = join(__dirname, 'programme-state.schema.json');
export const SCHEMA_VERSION = 1;

let cachedSchema = null;
export function loadSchema(path = SCHEMA_PATH) {
  if (path === SCHEMA_PATH && cachedSchema) return cachedSchema;
  const schema = JSON.parse(readFileSync(path, 'utf8'));
  if (path === SCHEMA_PATH) cachedSchema = schema;
  return schema;
}

export function programmeStatePath(programmeHome) {
  if (!programmeHome || typeof programmeHome !== 'string') {
    throw new TypeError('programmeHome must be a non-empty string');
  }
  return join(programmeHome, 'programme-state.json');
}

// ---------------------------------------------------------------------------
// Minimal JSON Schema validator
// ---------------------------------------------------------------------------
// Deliberately interprets the schema FILE rather than restating its rules in code:
// a second hand-written copy of the constraints would be a second source of truth,
// and the two would drift. This covers exactly the draft 2020-12 subset the schema
// uses (type, const, enum, required, properties, additionalProperties, items,
// pattern, minLength) and THROWS on any keyword it does not implement, so a future
// schema edit that reaches for an unsupported keyword fails loudly instead of being
// silently unchecked — an unenforced constraint is the "control that never ran"
// failure this build was commissioned over.

const SUPPORTED_KEYWORDS = new Set([
  '$schema', '$id', 'title', 'description',
  'type', 'const', 'enum', 'required', 'properties', 'additionalProperties',
  'items', 'pattern', 'minLength', 'minItems',
]);

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function typeMatches(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'integer' || actual === 'number';
  if (expected === 'integer') return actual === 'integer';
  return actual === expected;
}

function validateNode(value, schema, path, ctx) {
  ctx.examined += 1;

  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) {
      throw new Error(
        `programme-state schema uses unsupported keyword "${key}" at ${path || '<root>'} — ` +
        `the validator would silently skip it. Implement it in programme-state.mjs before using it.`
      );
    }
  }

  if ('const' in schema && value !== schema.const) {
    ctx.errors.push(`${path || '<root>'}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    return;
  }

  if ('type' in schema) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((t) => typeMatches(value, t))) {
      ctx.errors.push(`${path || '<root>'}: expected type ${expected.join('|')}, got ${typeOf(value)}`);
      return;
    }
  }

  if ('enum' in schema && !schema.enum.includes(value)) {
    ctx.errors.push(`${path || '<root>'}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  }

  if (typeof value === 'string') {
    if ('pattern' in schema && !new RegExp(schema.pattern).test(value)) {
      ctx.errors.push(`${path || '<root>'}: ${JSON.stringify(value)} does not match /${schema.pattern}/`);
    }
    if ('minLength' in schema && value.length < schema.minLength) {
      ctx.errors.push(`${path || '<root>'}: shorter than minLength ${schema.minLength}`);
    }
  }

  if (typeOf(value) === 'array') {
    if ('minItems' in schema && value.length < schema.minItems) {
      ctx.errors.push(`${path || '<root>'}: fewer than minItems ${schema.minItems}`);
    }
    if (schema.items) {
      value.forEach((item, i) => validateNode(item, schema.items, `${path}[${i}]`, ctx));
    }
  }

  if (typeOf(value) === 'object') {
    for (const req of schema.required || []) {
      if (!(req in value)) {
        ctx.errors.push(`${path ? path + '.' : ''}${req}: required field missing`);
      }
    }
    const props = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) {
          ctx.errors.push(`${path ? path + '.' : ''}${key}: unexpected field (additionalProperties is false)`);
        }
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) validateNode(value[key], sub, `${path ? path + '.' : ''}${key}`, ctx);
    }
  }
}

export function validateAgainstSchema(state, schema = loadSchema()) {
  const ctx = { errors: [], examined: 0 };
  validateNode(state, schema, '', ctx);
  return { ok: ctx.errors.length === 0, errors: ctx.errors, examined: ctx.examined };
}

// ---------------------------------------------------------------------------
// Privacy boundary (INV-6, GL-012)
// ---------------------------------------------------------------------------
// This document is git-versioned in a PUBLIC repo. GL-012's boundary is one exact
// `C:\.fusion247\private\<project>\**` subtree — not the root, not siblings, not
// parents — so the state file may NAME that surface in one declared place and must
// never carry its content or incidental paths anywhere else.

const PRIVATE_PATH_RE = /\.fusion247/i;
const PRIVATE_SURFACE_RE = /^[A-Za-z]:[\\/]\.fusion247[\\/]private[\\/][^\\/]+[\\/]\*\*$/;
const PRIVACY_ALLOWED_PATHS = new Set(['privacy.private_surface', 'privacy.private_record']);

function* walkStrings(value, path = '') {
  if (typeof value === 'string') {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walkStrings(value[i], `${path}[${i}]`);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, path ? `${path}.${k}` : k);
  }
}

export function validatePrivacyBoundary(state) {
  const errors = [];
  let examined = 0;

  const privacy = state?.privacy;
  if (!privacy || typeof privacy.private_surface !== 'string') {
    return { ok: false, errors: ['privacy.private_surface: mandatory even when "none" — never inferred'], examined: 1 };
  }

  const surface = privacy.private_surface;
  if (surface !== 'none') {
    examined += 1;
    if (!PRIVATE_SURFACE_RE.test(surface)) {
      errors.push(
        `privacy.private_surface: ${JSON.stringify(surface)} is not one exact private/<project>/** subtree ` +
        `(GL-012 denies the root, siblings and parents)`
      );
    }
    examined += 1;
    if (!privacy.private_record) {
      errors.push('privacy.private_record: required when private_surface is not "none" — the full record lives in the private surface, the public repo gets a marker (INV-6)');
    }
  }

  for (const [path, str] of walkStrings(state)) {
    examined += 1;
    if (PRIVATE_PATH_RE.test(str) && !PRIVACY_ALLOWED_PATHS.has(path)) {
      errors.push(`${path}: contains a .fusion247 path — private-surface content must not enter the public state document (INV-6)`);
    }
  }

  return { ok: errors.length === 0, errors, examined };
}

// ---------------------------------------------------------------------------
// Internal consistency
// ---------------------------------------------------------------------------
// The dependency graph in 02-MAP.md section 7 is maintained by hand today, and the
// frontier is defined there as "computed, not set by hand". These checks make that
// true: a ticket may only claim `frontier` if every dependency is genuinely resolved.

export const COLLECTION_FIELDS = ['tickets', 'blockers', 'workers', 'branches', 'pull_requests', 'worktrees'];

export function validateConsistency(state) {
  const errors = [];
  let examined = 0;

  const tickets = Array.isArray(state?.tickets) ? state.tickets : [];
  const byId = new Map(tickets.map((t) => [t.id, t]));

  for (const t of tickets) {
    examined += 1;
    for (const dep of t.depends_on || []) {
      if (!byId.has(dep)) {
        errors.push(`tickets.${t.id}.depends_on: ${dep} is not a ticket in this document`);
        continue;
      }
      const resolved = byId.get(dep).state === 'resolved';
      if (t.state === 'frontier' && !resolved) {
        errors.push(`tickets.${t.id}: claims frontier but depends on unresolved ${dep} — the frontier is computed, not asserted`);
      }
      if (t.state === 'blocked' && resolved) {
        // not an error on its own; only a problem if EVERY dependency is resolved
      }
    }
    if (t.state === 'blocked' && (t.depends_on || []).length > 0) {
      const allResolved = t.depends_on.every((d) => byId.get(d)?.state === 'resolved');
      if (allResolved) {
        errors.push(`tickets.${t.id}: marked blocked but every dependency is resolved — it belongs on the frontier`);
      }
    }
    if (t.state === 'resolved' && !t.resolved) {
      errors.push(`tickets.${t.id}: state is resolved but no resolved date is recorded`);
    }
  }

  // Every empty collection must be a deliberate assertion of "there are none", or be
  // declared unknown. This is the missing-field rule (map section 4) made enforceable:
  // an empty `workers` array must never quietly mean "we did not check for workers".
  const unknown = new Set((Array.isArray(state?.unknown) ? state.unknown : []).map((u) => u?.path));
  for (const field of COLLECTION_FIELDS) {
    examined += 1;
    const value = state?.[field];
    if (Array.isArray(value) && value.length === 0 && !unknown.has(field)) {
      errors.push(
        `${field}: empty. An empty collection asserts "there are none". If it was not gathered, ` +
        `declare "${field}" in \`unknown\` instead — absent is never zero.`
      );
    }
  }

  // A safe boundary that could not be established must be null, and must say why.
  examined += 1;
  if (state?.safe_boundary?.at_boundary === null && !(state.safe_boundary.reason || '').trim()) {
    errors.push('safe_boundary: at_boundary is null (undetermined) but no reason is given');
  }

  return { ok: errors.length === 0, errors, examined };
}

// ---------------------------------------------------------------------------
// Combined validation
// ---------------------------------------------------------------------------

export function validateProgrammeState(state, schema = loadSchema()) {
  const schemaResult = validateAgainstSchema(state, schema);
  const privacyResult = validatePrivacyBoundary(state);
  const consistencyResult = validateConsistency(state);
  const examined = schemaResult.examined + privacyResult.examined + consistencyResult.examined;
  return {
    ok: schemaResult.ok && privacyResult.ok && consistencyResult.ok,
    errors: [...schemaResult.errors, ...privacyResult.errors, ...consistencyResult.errors],
    examined,
    breakdown: {
      schema: schemaResult.examined,
      privacy: privacyResult.examined,
      consistency: consistencyResult.examined,
    },
  };
}

// ---------------------------------------------------------------------------
// Freshness — is the banked state still true of the repository?
// ---------------------------------------------------------------------------
// AD-2's RECOVERY state fires when "banked state [is] stale vs git HEAD". Never
// reports fresh when it cannot tell: an unknown HEAD is stale, not fresh.

export function evaluateFreshness(state, { headSha, dirty = null, unpushedCount = null } = {}) {
  const reasons = [];
  const banked = state?.banked?.head_sha;

  if (!banked || banked === 'unknown') {
    reasons.push('banked head_sha is unknown — freshness cannot be established');
  } else if (!headSha || headSha === 'unknown') {
    reasons.push('current HEAD could not be read — freshness cannot be established');
  } else if (banked !== headSha) {
    reasons.push(`HEAD moved since banking: banked ${banked.slice(0, 7)}, now ${headSha.slice(0, 7)}`);
  }

  if (dirty === true) reasons.push('working tree is dirty — uncommitted work is not in the banked state');
  if (dirty === null) reasons.push('working-tree cleanliness unknown');
  if (typeof unpushedCount === 'number' && unpushedCount > 0) {
    reasons.push(`${unpushedCount} unpushed commit(s) — banked state is not durable until pushed`);
  }
  if (unpushedCount === null) reasons.push('unpushed-commit count unknown');

  return { stale: reasons.length > 0, reasons, checked: 4 };
}

// ---------------------------------------------------------------------------
// Derived views — frontier and completed work are COMPUTED, never stored twice
// ---------------------------------------------------------------------------

export function completedTickets(state) {
  return (state?.tickets || []).filter((t) => t.state === 'resolved');
}

export function frontierTickets(state) {
  const byId = new Map((state?.tickets || []).map((t) => [t.id, t]));
  return (state?.tickets || []).filter(
    (t) => t.state !== 'resolved' && (t.depends_on || []).every((d) => byId.get(d)?.state === 'resolved')
  );
}

export function frontierForModel(state, model) {
  return frontierTickets(state).filter((t) => t.model === model || t.model === 'any');
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

export function readProgrammeState(filePath) {
  if (!existsSync(filePath)) return { ok: false, reason: 'missing', path: filePath };
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { ok: false, reason: 'unreadable', error: err.message, path: filePath };
  }
  if (data?.schema_version !== SCHEMA_VERSION) {
    return { ok: false, reason: 'schema-version-mismatch', found: data?.schema_version, expected: SCHEMA_VERSION, path: filePath };
  }
  const validation = validateProgrammeState(data);
  if (!validation.ok) {
    return { ok: false, reason: 'invalid', errors: validation.errors, data, path: filePath };
  }
  return { ok: true, data, path: filePath, examined: validation.examined };
}

export function writeProgrammeState(state, filePath) {
  const validation = validateProgrammeState(state);
  if (!validation.ok) {
    const err = new Error(
      `refusing to bank an invalid programme state (${validation.errors.length} error(s)):\n  - ` +
      validation.errors.join('\n  - ')
    );
    err.errors = validation.errors;
    throw err;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n');
  renameSync(tmpPath, filePath);
  return { path: filePath, examined: validation.examined };
}

// ---------------------------------------------------------------------------
// Render: programme state -> Team Knowledge/fusion-brief/session-handoff.md (AD-12)
// ---------------------------------------------------------------------------
// The existing file's contract, preserved exactly: three frontmatter keys
// (`artefact`, `provenance`, `owner_intent`), the H1, and five H2 sections in order.
// `provenance` changes from "curated" to "derived" — that is the whole point of the
// Governor, and the existing file's own frontmatter calls hand-curation a stopgap.

export const HANDOFF_SECTIONS = [
  'Where we are',
  'What the NEXT session is about',
  'Locked decisions (durable — do NOT re-litigate)',
  'Runtime pointers',
  'How to resume',
];

export function sessionHandoffPath(repoRoot) {
  return join(repoRoot, 'Team Knowledge', 'fusion-brief', 'session-handoff.md');
}

function bullet(lines) {
  return lines.length ? lines.map((l) => `- ${l}`).join('\n') : '- _(none recorded)_';
}

export function renderSessionHandoff(state) {
  const validation = validateProgrammeState(state);
  if (!validation.ok) {
    throw new Error(`refusing to render a handoff from invalid programme state: ${validation.errors[0]}`);
  }

  const p = state.programme;
  const done = completedTickets(state);
  const frontier = frontierTickets(state);
  const unknownSet = new Set(state.unknown);

  const unknownNote = state.unknown.length
    ? `\n**Not established at banking — do NOT read these as "none":**\n${state.unknown.map((u) => `- \`${u.path}\` — ${u.why}`).join('\n')}\n`
    : '';

  const privacyNote =
    state.privacy.private_surface === 'none'
      ? ''
      : `\n**Private surface declared.** The full record is not in this repo; read it at the declared private location recorded in \`programme-state.json\` (\`privacy.private_record\`). Public artefacts carry markers only (GL-012, INV-6).\n`;

  return `---
artefact: session-handoff
provenance: derived (${state.banked.at}, BUILD-018 Governor v${SCHEMA_VERSION} — rendered from ${p.home}/programme-state.json, NOT hand-curated)
owner_intent: consumed by the next Larry session. Regenerate on every rotation; do not hand-edit.
---

# Next-session handoff (resume here)

## ${HANDOFF_SECTIONS[0]}

**${p.id} — ${p.title}** (${p.status}). Phase: **${state.phase.current}**.

${state.phase.summary}

Branch \`${state.repository.branch}\` in worktree \`${state.repository.worktree}\`, HEAD \`${state.repository.head_sha}\` (base \`${state.repository.base_sha}\`). Banked by ${state.banked.by_model} at ${state.banked.at}.

**Completed (${done.length}):**
${bullet(done.map((t) => `**${t.id}** — ${t.title} _(resolved ${t.resolved})_`))}

**Frontier — takable now (${frontier.length}):**
${bullet(frontier.map((t) => `**${t.id}** [${t.model}] — ${t.title}`))}

**Blockers (${state.blockers.length}):**
${bullet(state.blockers.map((b) => `**${b.id}** (${b.kind}, owner: ${b.owner}) — ${b.summary}${b.recommendation ? ` _Recommendation: ${b.recommendation}_` : ''}`))}

**Safe boundary:** ${state.safe_boundary.at_boundary === null ? '**UNDETERMINED**' : state.safe_boundary.at_boundary ? 'yes' : '**NO**'} — ${state.safe_boundary.reason}
${state.safe_boundary.obstacles.length ? state.safe_boundary.obstacles.map((o) => `  - obstacle (${o.kind}): ${o.detail}`).join('\n') + '\n' : ''}
**Workers (${state.workers.length}):**
${bullet(state.workers.map((w) => `${w.id} — ${w.kind}, **${w.status}**${w.ticket ? ` (${w.ticket})` : ''}`))}

**Branches:**
${bullet(state.branches.map((b) => `\`${b.name}\` (${b.role})${b.head ? ` @ ${b.head}` : ''}${b.note ? ` — ${b.note}` : ''}`))}

**Pull requests:**
${bullet(state.pull_requests.map((pr) => `${pr.number ? `#${pr.number}` : '(unnumbered)'} ${pr.title || ''} — **${pr.state}**${pr.note ? ` — ${pr.note}` : ''}`))}

**Worktrees (${state.worktrees.length}):** ${state.worktrees.filter((w) => w.disposition.startsWith('unreconciled')).length} unreconciled, ${state.worktrees.filter((w) => w.disposition === 'unknown-unreadable').length} unreadable.
${unknownNote}${privacyNote}
## ${HANDOFF_SECTIONS[1]}

${state.resumption.focus}

**Model recommendation: ${state.model_recommendation.model}**${state.model_recommendation.effort ? ` (effort: ${state.model_recommendation.effort})` : ''} — ${state.model_recommendation.rationale}

## ${HANDOFF_SECTIONS[2]}

${bullet(state.locked_decisions.map((d) => `**${d.id}** — ${d.decision}${d.why ? ` _(${d.why})_` : ''}`))}

## ${HANDOFF_SECTIONS[3]}

${bullet(state.runtime_pointers.map((r) => `**${r.label}** — \`${r.path}\`${r.how_to_read ? ` — ${r.how_to_read}` : ''}`))}

## ${HANDOFF_SECTIONS[4]}

**Work in \`${state.resumption.worktree}\` on branch \`${state.resumption.branch}\`.**

**THE EXACT NEXT ACTION:** ${state.resumption.next_action}${state.resumption.ticket ? ` (ticket ${state.resumption.ticket})` : ''}

**Read first:**
${bullet(state.resumption.read_first)}

**Do NOT:**
${bullet(state.resumption.do_not)}

${unknownSet.size ? `_This handoff is derived. ${unknownSet.size} field(s) were not established at banking — see above._` : '_This handoff is derived from durable state; every collection above was gathered._'}
`;
}
