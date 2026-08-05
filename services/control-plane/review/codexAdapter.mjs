// ===========================================================================
// PORTED for BUILD-014 WP-C (Tower-on-baton). Faithfully carried from
//   Fusion247PKA-towerfix/services/tower-baton/src/codexAdapter.js (transport-agnostic).
// Only relative import extensions (.js -> .mjs) changed; the FAIL-CLOSED model-
// attestation, honest-provider labelling, tool-lessness and secret-denylist are
// preserved VERBATIM. The retired ClickUp wire (watcher/clickupClient/handoff) was
// deliberately NOT ported. Consumed by review/reviewHandler.mjs as a WP-B job.
// ===========================================================================
// Tower baton — read-only Codex QA adapter (OpenAI Codex CLI `codex exec`).
//
// Copied self-contained from the frozen fusion-tower codexAdapter.js (no import
// from the reactor tree). This is THE QA ENGINE: one bounded, read-only Codex turn
// that inspects the actual implementation on disk and returns a strict, signed,
// HONESTLY-LABELLED structured verdict (signer = gpt_codex, provider = openai-codex,
// NEVER xAI/Grok).
//
// Discovery (unchanged from the proven WP0 spike):
//   · BINARY lives in a VERSION-HASHED dir %LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\
//     codex.exe — we discover the newest, never hard-code the hash.
//   · AUTH is ChatGPT-OAuth via %USERPROFILE%\.codex\auth.json (or CODEX_API_KEY).
//   · We ALWAYS override with --ignore-user-config --sandbox read-only so the host
//     config.toml cannot loosen the sandbox, and the reviewer never adopts a repo
//     "You are Larry" persona.
// FAIL-CLOSED: no binary / no credential / timeout / non-zero exit / malformed
// output each produce a distinct signed `blocked` verdict — never a hang, never spend.

import { spawn as nodeSpawn } from 'node:child_process';
import fsDefault from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeSignedVerdict } from './envelope.mjs';

export const CODEX_EXEC_FLAGS = Object.freeze([
  'exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ignore-user-config', '--json',
]);

// ═══════════════════════════════════════════════════════════════════════════════════════
// CODEX'S PERMANENT OPERATING CONTRACT — the ONE loader-and-validator the LIVE route uses.
//
// WP-2G. Before this existed, the four live loaders (tower-loop/reviewDiff.mjs, mergeCheck.mjs,
// watcher.mjs, demo-merge-review.mjs) each held their own `path.join(... 'Builds',
// 'BUILD-010-fusion-tower', ...)` expression and did a BARE readFileSync with ZERO frontmatter
// validation. Two consequences, both real:
//   · six independent path expressions to keep in step by hand — and one of them going stale is
//     silent, because a review still runs, just under different bytes; and
//   · UNRATIFIED content could run as law, which is the actual degradation risk. The ratification
//     check existed only in RETIRED (tower-baton/src/qaSkill.js) and TEST-ONLY
//     (review/productQaPrompt.mjs) code — i.e. nowhere that runs.
//
// This is deliberately NOT a new module, a registry, a precedence engine or a loader framework.
// It is one exported function in the module every live route already imports (each of them
// reaches this file through tower-loop/supervisorCodex.mjs), so the law arrives on the route
// that is already live rather than a new route being built to reach the law.
//
// THE SENTINEL, not a hash literal. A pinned hash makes every wording edit a two-file edit, which
// is exactly how pins go stale — review/test/tower-runtime.test.js carried a `tower-qa-skill@1`
// pin against a shipped `version: 2` for weeks. The sentinel survives wording refinement while
// still proving identity, and it is held HERE, outside the file it checks.
// ═══════════════════════════════════════════════════════════════════════════════════════

const __adapterDir = path.dirname(fileURLToPath(import.meta.url));

/** The durable home of Codex's operating law. Every live loader resolves it from HERE. */
export const CODEX_CONTRACT_PATH = path.resolve(__adapterDir, 'prompts', 'tower-qa-skill.md');

/**
 * The APPROVED + `governs_live` reviewer-classification amendment. It is delivered WITH the
 * contract on every live turn rather than copied into it: the amendment is Warwick-ratified and
 * stays the single source of its own clauses. Until WP-2G it reached Codex only through
 * productQaPrompt.mjs, which has no production caller.
 */
export const CODEX_CLASSIFICATION_PATH = path.resolve(__adapterDir, 'prompts', 'reviewer-classification-amendment.md');

/** Held here, OUTSIDE the file it verifies. Its absence from the delivered bytes is fail-closed. */
export const CODEX_CONTRACT_SENTINEL = 'F247-CODEX-CONTRACT-SENTINEL-1';

const sha256 = (text) => createHash('sha256').update(String(text), 'utf8').digest('hex');

/** Minimal leading-YAML frontmatter parse (key: value). Same shape as the two sibling loaders. */
export function parseContractFrontmatter(text) {
  const m = String(text ?? '').match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { ok: false, fields: {} };
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (kv) fields[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { ok: true, fields };
}

const isTrue = (v) => /^true$/i.test(String(v ?? '').trim());

/**
 * Is this governing text ratified? The rule is deliberately IDENTICAL to the two loaders that
 * already existed (tower-baton/src/qaSkill.js and review/productQaPrompt.mjs) rather than a new,
 * stricter one — one semantics for "ratified" across the estate, and the flip Warwick makes is
 * the same flip everywhere.
 */
export function isContractRatified(fields = {}) {
  return isTrue(fields.governs_live) || isTrue(fields.standing_use_ratified) || fields.status === 'approved';
}

/**
 * Load + validate + fingerprint the governing text(s) the external reviewer will receive.
 *
 * Returns `{ ok, error, text, fingerprint, version, status, ratified, contractPath,
 *            classificationVersion, classificationFingerprint }`.
 *
 * FAIL-CLOSED on every one of: absent file · unreadable · empty · no frontmatter block ·
 * MISSING SENTINEL · NOT RATIFIED. `requireRatified` exists only so a test can exercise the
 * unratified branch explicitly; the live callers never pass it.
 *
 * `text` is the composed delivery: the contract, then the ratified classification amendment.
 * `fingerprint` is the sha256 of THAT composed string — i.e. of the bytes a caller is about to
 * hand to the reviewer, not of some file it read earlier and might no longer be sending.
 */
export function loadCodexContract({
  contractPath = CODEX_CONTRACT_PATH,
  classificationPath = CODEX_CLASSIFICATION_PATH,
  fs = fsDefault,
  requireRatified = true,
  requireClassification = true,
} = {}) {
  const fail = (error) => ({ ok: false, error, text: null, fingerprint: null, contractPath });

  let raw;
  try {
    if (!fs.existsSync(contractPath)) return fail(`fail-closed: Codex operating contract not found at ${contractPath}`);
    raw = fs.readFileSync(contractPath, 'utf8');
  } catch (e) {
    return fail(`fail-closed: Codex operating contract unreadable (${String(e?.message ?? e)})`);
  }
  if (!raw || !raw.trim()) return fail(`fail-closed: Codex operating contract is empty at ${contractPath}`);

  const fm = parseContractFrontmatter(raw);
  if (!fm.ok) return fail(`fail-closed: Codex operating contract has no frontmatter block at ${contractPath}`);
  if (!raw.includes(CODEX_CONTRACT_SENTINEL)) {
    return fail(`fail-closed: Codex operating contract at ${contractPath} does not carry the delivery sentinel `
      + `"${CODEX_CONTRACT_SENTINEL}" — the loaded file is not this contract`);
  }
  const version = fm.fields.version ?? null;
  const status = fm.fields.status ?? null;
  const ratified = isContractRatified(fm.fields);
  if (requireRatified && !ratified) {
    return {
      ...fail(`fail-closed: Codex operating contract is NOT RATIFIED (status="${status ?? '(none)'}", `
        + `governs_live=${isTrue(fm.fields.governs_live)}, standing_use_ratified=${isTrue(fm.fields.standing_use_ratified)}) `
        + '— an unauthorised governing prompt must never drive a review. Warwick ratifies it; nothing else does.'),
      version, status, ratified: false,
    };
  }

  // The APPROVED classification amendment travels with the contract. It carries the three-judgement
  // classifier, the merge rule, R1, R2 and round economy — Warwick-approved, governs_live, and until
  // now delivered only by a route with no production caller.
  let classificationText = '';
  let classificationVersion = null;
  let classificationFingerprint = null;
  if (requireClassification) {
    let cRaw;
    try {
      if (!fs.existsSync(classificationPath)) return fail(`fail-closed: reviewer-classification-amendment not found at ${classificationPath}`);
      cRaw = fs.readFileSync(classificationPath, 'utf8');
    } catch (e) {
      return fail(`fail-closed: reviewer-classification-amendment unreadable (${String(e?.message ?? e)})`);
    }
    if (!cRaw || !cRaw.trim()) return fail('fail-closed: reviewer-classification-amendment is empty');
    const cfm = parseContractFrontmatter(cRaw);
    if (!cfm.ok) return fail('fail-closed: reviewer-classification-amendment has no frontmatter block');
    if (!isContractRatified(cfm.fields)) {
      return fail(`fail-closed: reviewer-classification-amendment is NOT RATIFIED (status="${cfm.fields.status ?? '(none)'}", `
        + `governs_live=${isTrue(cfm.fields.governs_live)}) — it is LIVE governance and must be ratified to drive a review`);
    }
    classificationText = cRaw;
    classificationVersion = cfm.fields.version ?? null;
    classificationFingerprint = sha256(cRaw);
  }

  const text = classificationText ? `${raw}\n\n${classificationText}` : raw;
  return {
    ok: true,
    error: null,
    text,
    fingerprint: sha256(text),
    contractFingerprint: sha256(raw),
    version,
    status,
    ratified,
    contractPath,
    classificationPath: requireClassification ? classificationPath : null,
    classificationVersion,
    classificationFingerprint,
    provenance: `tower-qa-skill@${version ?? '?'}(${status ?? '?'};ratified=${ratified})`
      + (requireClassification ? `+classification-amendment@${classificationVersion ?? '?'}(APPROVED_LIVE)` : ''),
  };
}

/**
 * O-7's runtime half. Recompute the fingerprint over the bytes ABOUT TO BE DELIVERED and require
 * them to be the bytes that were loaded and validated. This is what turns the fingerprint from
 * decoration into a control: a hash compared against something.
 *
 * Returns null when they agree; a blocker string when they do not.
 */
export function assertDeliveredContract(deliveredText, contract) {
  if (!contract?.ok) return `contract did not load: ${contract?.error ?? 'unknown'}`;
  const delivered = sha256(deliveredText);
  if (delivered !== contract.fingerprint) {
    return `delivered contract bytes do not match the loaded+validated contract `
      + `(delivered sha256=${delivered.slice(0, 12)}…, loaded sha256=${String(contract.fingerprint).slice(0, 12)}…)`;
  }
  if (!String(deliveredText ?? '').includes(CODEX_CONTRACT_SENTINEL)) {
    return `delivered contract bytes do not carry the sentinel "${CODEX_CONTRACT_SENTINEL}"`;
  }
  return null;
}

// The SHARED reviewer result schema handed to `codex --output-schema` (STRICT mode: every object
// closed, every property required) AND embedded in the Fable prompt in-band. PR-2b completion extends
// it to match the fail-closed prompt: EXPLICIT machine-readable answers — per-acceptance results,
// per-prior-finding dispositions, and three-axis-CLASSIFIED findings (technical impact / reachability /
// required disposition + a stated baseline, per the APPROVED reviewer-classification amendment) — so
// the answers live in typed arrays, never buried in `summary`. The runtime (review/reviewClassification
// .mjs::validateReviewerResult) validates these FAIL-CLOSED and persists them to the append-only records.
export const CODEX_RESULT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'summary', 'claims_verified', 'acceptance_results', 'prior_finding_results', 'findings', 'proposed_action'],
  properties: {
    verdict: { type: 'string', enum: ['approve', 'request_changes', 'comment'] },
    summary: { type: 'string' },
    claims_verified: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim', 'status', 'evidence'],
        properties: {
          claim: { type: 'string' },
          status: { type: 'string', enum: ['confirmed', 'refuted', 'partial', 'unverifiable'] },
          evidence: { type: 'string' },
        },
      },
    },
    // One result per acceptance criterion (acceptance-FIRST). acceptance_row_id = the criterion's ref
    // (e.g. AC-01) or its row id, as staged in the packet.
    acceptance_results: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['acceptance_row_id', 'result', 'rationale', 'evidence'],
        properties: {
          acceptance_row_id: { type: 'string' },
          result: { type: 'string', enum: ['pass', 'fail', 'partial', 'blocked', 'not_applicable'] },
          rationale: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
    // One disposition per PRIOR OPEN finding staged in the packet (no silent carry-over).
    prior_finding_results: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['finding_id', 'status', 'rationale'],
        properties: {
          finding_id: { type: 'string' },
          status: { type: 'string', enum: ['addressed', 'remains_open', 'unrelated'] },
          rationale: { type: 'string' },
        },
      },
    },
    // NEW findings, each carrying the three-axis classification + a stated deployment baseline (R2).
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'technical_impact', 'reachability', 'required_disposition', 'assumed_deployment_baseline', 'evidence', 'required_correction'],
        properties: {
          id: { type: 'string' },
          technical_impact: { type: 'string', enum: ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'NOTE'] },
          reachability: { type: 'string', enum: ['ACTIVE', 'LATENT', 'HYPOTHETICAL'] },
          required_disposition: {
            type: 'string',
            enum: ['BLOCKS_CURRENT_MERGE', 'REQUIRED_BEFORE_LIVE', 'REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS', 'TRACKED_FOLLOWUP', 'NOTE_ONLY'],
          },
          assumed_deployment_baseline: { type: 'string' },
          evidence: { type: 'string' },
          required_correction: { type: 'string' },
        },
      },
    },
    proposed_action: {
      type: 'object', additionalProperties: false,
      required: ['type', 'target'],
      properties: {
        type: { type: 'string', enum: ['post_review', 'post_comment', 'noop'] },
        target: { type: 'string' },
      },
    },
  },
});

/** Resolve the codex binary WITHOUT hard-coding the version hash. */
export function resolveCodexBin({ env = process.env, fs = fsDefault, localAppData = process.env.LOCALAPPDATA, binName = process.platform === 'win32' ? 'codex.exe' : 'codex' } = {}) {
  const override = env?.CODEX_BIN;
  if (override) {
    try {
      if (fs.existsSync(override) && fs.statSync(override).isFile()) return { path: override, source: 'env:CODEX_BIN', error: null };
      return { path: null, source: 'env:CODEX_BIN', error: `CODEX_BIN set but not a file: ${override}` };
    } catch (e) { return { path: null, source: 'env:CODEX_BIN', error: String(e?.message ?? e) }; }
  }
  if (!localAppData) return { path: null, source: 'discovery', error: 'LOCALAPPDATA unset — cannot discover codex binary' };
  const binDir = path.join(localAppData, 'OpenAI', 'Codex', 'bin');
  let entries;
  try { entries = fs.readdirSync(binDir); } catch (e) { return { path: null, source: 'discovery', error: `codex bin dir not found (${binDir}): ${String(e?.message ?? e)}` }; }
  let best = null;
  for (const name of entries) {
    const candidate = path.join(binDir, name, binName);
    try {
      const st = fs.statSync(candidate);
      if (st.isFile()) { const mtime = st.mtimeMs ?? 0; if (!best || mtime > best.mtime) best = { path: candidate, mtime }; }
    } catch { /* helper-only dir — skip */ }
  }
  if (best) return { path: best.path, source: 'discovery', error: null };
  return { path: null, source: 'discovery', error: `no codex binary under ${binDir}` };
}

/** Detect Codex auth WITHOUT reading any secret value (existence + key NAMES only). */
export function detectCodexAuth({ config, homeDir = os.homedir(), fs = fsDefault } = {}) {
  if (config?.codexApiKey) return { authenticated: true, method: 'api-key', authPath: null, keyNames: null };
  const authPath = path.join(homeDir, '.codex', 'auth.json');
  try {
    if (!fs.existsSync(authPath)) return { authenticated: false, method: 'none', authPath: null, keyNames: null };
    let keyNames = null;
    try { const parsed = JSON.parse(fs.readFileSync(authPath, 'utf8')); if (parsed && typeof parsed === 'object') keyNames = Object.keys(parsed); } catch { /* existence is enough */ }
    return { authenticated: true, method: 'chatgpt-oauth', authPath, keyNames };
  } catch { return { authenticated: false, method: 'none', authPath: null, keyNames: null }; }
}

export function buildCodexArgv({ schemaFile, workdir }) {
  return [...CODEX_EXEC_FLAGS, '--output-schema', schemaFile, '-C', workdir, '-'];
}

// SEPARATION OF RESPONSIBILITY: Codex receives ONLY the QA task + evidence pointers.
// It must NEVER see the Telegram or ClickUp credentials — those belong to the Tower's
// own notifier / ClickUp poster, not the reviewer. This denylist is stripped from the
// child env before the reviewer process is spawned (a leaked TELEGRAM_BOT_TOKEN in the
// reviewer's env is a hard finding). CODEX_API_KEY/OPENAI_API_KEY are re-added ONLY on
// the api-key auth route (never on the OAuth route).
export const CODEX_ENV_DENYLIST = Object.freeze([
  'TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID', 'TELEGRAM_WEBHOOK_SECRET',
  'CLICKUP_TOKEN', 'DATABASE_URL', 'SUPABASE_SECRET_KEY',
  'TOWER_HMAC_SECRET_LARRY', 'TOWER_HMAC_SECRET_GPT_CODEX', 'TOWER_HMAC_SECRET_TOWER',
  'TOWER_HMAC_SECRET_CLAUDE_FABLE',
]);

// CROSS-REVIEWER credential strip (WP1 LOW I): the codex child must never carry the
// OTHER reviewer's credentials. Codex authenticates via ChatGPT-OAuth / CODEX_API_KEY,
// so Anthropic/Claude creds have no business in its env -- strip them (a leaked
// ANTHROPIC_API_KEY in the codex child would let a prompt-injected codex reach Claude).
export const CODEX_CROSS_REVIEWER_KEYS = Object.freeze(['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']);

/** Build the Codex child env: parent env MINUS the denylist + the other reviewer's creds, plus an optional api key. */
export function sanitizeCodexEnv(parentEnv = process.env, apiKey = null) {
  const env = { ...parentEnv };
  for (const name of CODEX_ENV_DENYLIST) delete env[name];
  for (const name of CODEX_CROSS_REVIEWER_KEYS) delete env[name]; // never carry Fable's Anthropic creds
  if (apiKey) { env.CODEX_API_KEY = apiKey; env.OPENAI_API_KEY = apiKey; }
  return env;
}

/**
 * Compose the QA prompt: the FINGERPRINTED QA skill (operating instructions) verbatim,
 * then the bounded packet POINTERS for THIS checkpoint (exact repo/branch/head, diff
 * range, changed files, evidence pointers). Pointer-shaped — never pastes the corpus.
 */
export function buildCodexPrompt({ skillText, packet = {} }) {
  const p = packet;
  const pointerLines = [
    `checkpoint_id: ${p.checkpoint_id ?? '(none)'}`,
    `build_id: ${p.build_id ?? '(none)'}`,
    `wp_id: ${p.wp_id ?? '(none)'}`,
    `repo: ${p.repo ?? '(local working tree)'}`,
    `branch: ${p.branch ?? '(unknown)'}`,
    `head_sha (EXACT — review is bound to this): ${p.head_sha ?? '(unknown)'}`,
    `base_sha: ${p.base_sha ?? '(unknown)'}`,
    `diff_range: ${p.diff_range ?? '(unknown)'}`,
    p.changed_files?.length ? `changed_files: ${p.changed_files.slice(0, 60).join(', ')}` : 'changed_files: (none reported)',
    `brief_ref (the approved brief — the CLAIMS/acceptance to verify): ${p.brief_ref ?? '(none)'}`,
    p.brief_excerpt ? `brief_excerpt:\n${String(p.brief_excerpt).slice(0, 4000)}` : null,
    `checkpoint summary (Larry's claim): ${p.summary ?? '(none)'}`,
    p.tests ? `tests claimed: ${p.tests}` : null,
    p.evidence_refs?.length ? `evidence_refs: ${p.evidence_refs.join(', ')}` : null,
    p.ci_checks ? `ci_checks: ${p.ci_checks}` : null,
  ].filter(Boolean);

  // STAGED EVIDENCE: on Windows a read-only sandbox blocks Codex's own shell/file reads
  // (git, pwsh Get-Content → "rejected: blocked by policy"), so Tower stages the ACTUAL
  // unified diff here — collected read-only via Tower's allowlisted git. Codex reviews the
  // REAL changes from this payload; it does NOT depend on self-navigating the disk. If the
  // sandbox DOES permit reads, Codex may additionally inspect the tree — but the staged
  // diff is authoritative for what changed at this exact head.
  const diffBlock = p.diff_text
    ? ['', `── STAGED DIFF (${p.diff_range ?? 'head'}${p.diff_truncated ? ', TRUNCATED' : ''}) — the actual changes, read-only from Tower's git ──`, p.diff_text]
    : ['', '── STAGED DIFF: (none captured — if you cannot read the disk, say so honestly and return verdict "comment" with an "unverifiable" claim; do not fabricate) ──'];

  return [
    String(skillText ?? '').trim(),
    '',
    '── THIS REVIEW TURN — bounded packet (pointers + staged diff, not the whole corpus) ──',
    ...pointerLines,
    ...diffBlock,
    '',
    'Review the STAGED DIFF above (the real changes at the exact head) against the approved',
    'brief/acceptance. Your read-only sandbox may block shell/file access — that is expected;',
    'the staged diff is your primary evidence, so do NOT report "blocked" merely because you',
    'could not run git/pwsh yourself. Only return a blocked/"unverifiable" outcome if the diff',
    'itself is absent or insufficient to judge the claim. Compare Larry\'s claims against the',
    'staged changes. Return ONLY JSON conforming to the provided output schema. Keep it compact.',
    'FAIL-CLOSED OUTPUT CONTRACT (answers in typed arrays, NEVER buried in summary):',
    '  · acceptance_results[]: one {acceptance_row_id, result, rationale, evidence} for EVERY staged',
    '    acceptance criterion — a missing one BLOCKS the review.',
    '  · prior_finding_results[]: one {finding_id, status, rationale} for EVERY staged prior open',
    '    finding — an omitted disposition BLOCKS the review (no silent carry-over).',
    '  · findings[]: each carries technical_impact + reachability + required_disposition +',
    '    assumed_deployment_baseline (the three-judgement classifier). The DISPOSITION, not the',
    '    severity, decides the merge: only a BLOCKS_CURRENT_MERGE finding (or a failed acceptance)',
    '    blocks; an improvement (NOTE_ONLY / TRACKED_FOLLOWUP) never blocks.',
  ].join('\n');
}

export async function verifyCodexInvocable({ codexBin, spawn = nodeSpawn, timeoutMs = 15000, resolve = resolveCodexBin } = {}) {
  const binPath = codexBin ?? resolve().path;
  if (!binPath) return { invocable: false, version: null, error: 'codex binary not resolvable', binPath: null };
  return new Promise((resolveP) => {
    let out = ''; let err = ''; let done = false;
    const finish = (r) => { if (!done) { done = true; resolveP({ ...r, binPath }); } };
    let child;
    try { child = spawn(binPath, ['--version'], { shell: false }); } catch (e) { return finish({ invocable: false, version: null, error: String(e?.message ?? e) }); }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ invocable: false, version: null, error: 'version probe timed out' }); }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ invocable: false, version: null, error: String(e?.message ?? e) }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ invocable: code === 0, version: (out.trim() || err.trim()) || null, error: code === 0 ? null : `exit ${code}: ${err.trim()}` }); });
  });
}

/**
 * Create the Codex QA adapter. `runTurn({ checkpoint, packet, skillText,
 * promptFingerprint })` runs ONE read-only turn and returns a signed verdict.
 */
// Default codex turn timeout. Tightened from 10min -> 8min (WP1) so the turn's OWN
// tree-kill fires WELL INSIDE the watcher's per-cycle watchdog (default 12min): the
// codex timeout reaps the process tree first; the watchdog is the outer safety net.
export const DEFAULT_CODEX_TIMEOUT_MS = 8 * 60 * 1000;

export function createCodexAdapter({ config, cwd = process.cwd(), mode = 'auto', spawn = nodeSpawn, resolveBin, authProbe, fs = fsDefault, timeoutMs = DEFAULT_CODEX_TIMEOUT_MS, platform = process.platform, log } = {}) {
  const PRINCIPAL = 'gpt_codex';
  const secret = config?.signingSecret ? config.signingSecret(PRINCIPAL) : null;
  const doResolveBin = typeof resolveBin === 'function' ? resolveBin : () => resolveCodexBin({});
  const doAuthProbe = typeof authProbe === 'function' ? authProbe : () => detectCodexAuth({ config, fs });

  function sign(payload, { checkpoint, packet, promptFingerprint }) {
    const args = {
      principal: PRINCIPAL, provider: 'openai-codex', modelId: 'openai-codex-exec',
      checkpointId: checkpoint?.checkpoint_id ?? null,
      reviewedHead: packet?.head_sha ?? checkpoint?.head_sha ?? null,
      promptFingerprint: promptFingerprint ?? null,
      payload,
    };
    return makeSignedVerdict(args, secret);
  }

  function blockerResult(ctx, blocker, kind = 'blocked') {
    const payload = { status: 'blocked', kind, blocker, proposed_action: { type: 'noop', target: '' } };
    const { envelope, signature } = sign(payload, ctx);
    return { ok: false, blocked: true, kind, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, error: blocker };
  }

  return {
    principal: PRINCIPAL,
    execFlags: [...CODEX_EXEC_FLAGS],

    diagnostics() {
      const bin = doResolveBin(); const auth = doAuthProbe();
      return { principal: PRINCIPAL, provider: 'openai-codex', bin_path: bin.path ?? '(unresolved)', bin_source: bin.source, bin_error: bin.error, auth_method: auth.method, authenticated: auth.authenticated, auth_key_names: auth.keyNames ?? null };
    },

    async verifyInvocable() {
      const bin = doResolveBin();
      const probe = await verifyCodexInvocable({ codexBin: bin.path, spawn });
      const auth = doAuthProbe();
      return { ...probe, binSource: bin.source, authenticated: auth.authenticated, authMethod: auth.method };
    },

    async runTurn({ checkpoint, packet, skillText, promptFingerprint }) {
      const ctx = { checkpoint, packet, promptFingerprint };
      if (mode === 'record-blocker') return blockerResult(ctx, 'codex adapter forced to record-blocker mode', 'record_blocker');
      const auth = doAuthProbe();
      if (!auth.authenticated) return blockerResult(ctx, 'blocked: no codex credential — neither CODEX_API_KEY/OPENAI_API_KEY nor ChatGPT-OAuth auth.json present (do NOT auto-provision)', 'no_credential');
      const bin = doResolveBin();
      if (!bin.path) return blockerResult(ctx, `blocked: no codex binary — ${bin.error ?? 'not resolvable'} (do NOT auto-install)`, 'no_binary');

      const schemaFile = path.join(os.tmpdir(), `baton-codex-schema-${randomUUID()}.json`);
      try { fs.writeFileSync(schemaFile, JSON.stringify(CODEX_RESULT_SCHEMA), 'utf8'); }
      catch (e) { return blockerResult(ctx, `blocked: could not stage output schema — ${String(e?.message ?? e)}`, 'schema_write_failed'); }

      try {
        const prompt = buildCodexPrompt({ skillText, packet });
        const argv = buildCodexArgv({ schemaFile, workdir: cwd });
        const spawned = await runCodex({ codexBin: bin.path, argv, cwd, spawn, timeoutMs, apiKey: auth.method === 'api-key' ? config.codexApiKey : null, prompt, platform, log });
        if (spawned.code === -2) return blockerResult(ctx, spawned.stderr || `codex turn timed out after ${timeoutMs}ms`, 'timed_out');
        if (!spawned.ok) return blockerResult(ctx, `codex exec failed (exit ${spawned.code}): ${String(spawned.stderr ?? '').slice(0, 300)}`.trim(), 'exec_failed');

        const parsed = parseCodexJsonl(spawned.stdout);
        const validation = validateCodexResult(parsed.result);
        if (!validation.ok) return blockerResult(ctx, `codex returned malformed/non-conforming output: ${validation.errors.join('; ')}`, 'malformed_output');

        const r = parsed.result;
        const payload = {
          status: 'ok', verdict: r.verdict, summary: r.summary,
          claims_verified: Array.isArray(r.claims_verified) ? r.claims_verified : [],
          findings: Array.isArray(r.findings) ? r.findings : [],
          proposed_action: r.proposed_action ?? { type: 'noop', target: '' },
        };
        const { envelope, signature } = sign(payload, ctx);
        return { ok: true, blocked: false, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, tokensUsed: parsed.tokensUsed ?? 0, rawStdout: spawned.stdout };
      } finally {
        try { fs.unlinkSync(schemaFile); } catch { /* best-effort */ }
      }
    },
  };
}

// Bound on the taskkill reap itself so the kill path can never hang the poll loop.
export const DEFAULT_TASKKILL_TIMEOUT_MS = 5000;

/**
 * Reap the ENTIRE process tree of a spawned codex child, and CONFIRM the reap before
 * resolving. This is the WP1 defect fix (CRITICAL): on Windows `child.kill()` signals
 * ONLY the direct child handle -- codex.exe's own subprocesses survive as ORPHANS and
 * wedge the watcher's poll loop (silent HALT).
 *
 * The earlier fix still had a Windows race: it spawned `taskkill /T /F` detached+unref'd
 * and then IMMEDIATELY did `child.kill('SIGKILL')`. If the leader died before taskkill
 * enumerated its descendants, taskkill failed and the orphans survived -- unconfirmed.
 *
 * Corrected reap:
 *   - win32:  run `taskkill /PID <leader> /T /F` and AWAIT its exit. taskkill kills the
 *             WHOLE tree INCLUDING the leader, so we do NOT pre-kill the leader first. On
 *             a taskkill fail/error/timeout we RETRY the tree-kill ONCE (a transient race),
 *             then fall back to a leader-only child.kill(). The taskkill call is bounded
 *             (DEFAULT_TASKKILL_TIMEOUT_MS) so the kill path cannot hang.
 *   - posix:  the child leads its own process group (spawned `detached`), so a single
 *             process.kill(-pid, 'SIGKILL') reaps the whole group INCLUDING the leader.
 *
 * HONEST REAP STATUS (WP1 CRITICAL B): the earlier code logged a CONFIRMED reap even when
 * it fell back to a leader-only kill -- so surviving descendants were reported dead. This
 * now returns AND logs `{ tree_reaped }`: true ONLY when the whole tree was confirmed
 * reaped (taskkill success, or a posix group kill); FALSE (unconfirmed) after a leader-only
 * fallback, so the truth -- that descendants MAY survive -- is visible up the stack.
 *
 * Async: the caller AWAITs this so an abandoned codex tree is confirmed dead before the
 * turn resolves. Every step is guarded so this can never throw. Returns a Promise.
 */
function spawnTaskkill(pid, { spawn, taskkillTimeoutMs }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    let killer;
    try { killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { shell: false, stdio: 'ignore' }); }
    catch { return done(false); }
    const timer = setTimeout(() => { try { killer?.kill?.(); } catch { /* ignore */ } done(false); }, taskkillTimeoutMs);
    try { timer.unref?.(); } catch { /* ignore */ }
    try { killer?.on?.('error', () => { clearTimeout(timer); done(false); }); } catch { clearTimeout(timer); return done(false); }
    try { killer?.on?.('close', (code) => { clearTimeout(timer); done(code === 0); }); } catch { clearTimeout(timer); return done(false); }
  });
}

export async function killProcessTree({ child, spawn = nodeSpawn, platform = process.platform, log, taskkillTimeoutMs = DEFAULT_TASKKILL_TIMEOUT_MS } = {}) {
  const pid = child?.pid;
  let treeReaped = false;
  if (platform === 'win32') {
    if (pid != null) {
      // AWAIT taskkill: it reaps the whole tree (leader included). We must NOT pre-kill
      // the leader, or taskkill can fail to enumerate the now-dead leader's descendants.
      let reaped = await spawnTaskkill(pid, { spawn, taskkillTimeoutMs });
      // RETRY the tree-kill ONCE on failure -- a first taskkill can lose a transient race
      // with the just-spawned tree; a second attempt usually enumerates it cleanly.
      if (!reaped) reaped = await spawnTaskkill(pid, { spawn, taskkillTimeoutMs });
      if (reaped) {
        treeReaped = true;
      } else {
        // Leader-only fallback: descendants MAY survive. Do NOT claim a confirmed reap.
        try { child?.kill?.('SIGKILL'); } catch { try { child?.kill?.(); } catch { /* ignore */ } }
        treeReaped = false;
      }
    } else {
      // No pid to target the tree -- best-effort direct handle kill; unconfirmed.
      try { child?.kill?.('SIGKILL'); } catch { try { child?.kill?.(); } catch { /* ignore */ } }
      treeReaped = false;
    }
  } else if (pid != null) {
    // The child leads its own process group (spawned detached); negative pid = group.
    // This reaps the whole group INCLUDING the leader in one call. HONEST STATUS (posix
    // parity with win32, finding #3): a CONFIRMED reap only when the group kill did not
    // throw, OR it threw ESRCH (the group is already gone == already reaped). EPERM/any
    // other error means the descendants MAY survive -- report tree_reaped:false, never a
    // false-confirmed reap (the old code set true unconditionally, even on EPERM).
    try { process.kill(-pid, 'SIGKILL'); treeReaped = true; }
    catch (e) { treeReaped = e?.code === 'ESRCH'; } // ESRCH = group already gone (reaped); EPERM/other = unconfirmed
  } else {
    try { child?.kill?.('SIGKILL'); } catch { /* ignore */ }
    treeReaped = false;
  }
  if (typeof log === 'function') {
    try { log(`killProcessTree: pid ${pid ?? '(unknown)'} (${platform}) tree_reaped:${treeReaped}${treeReaped ? '' : ' (unconfirmed -- descendants may survive after leader-only fallback)'}`); } catch { /* ignore */ }
  }
  return { tree_reaped: treeReaped };
}

function runCodex({ codexBin, argv, cwd, spawn, timeoutMs, apiKey, prompt, platform = process.platform, log }) {
  return new Promise((resolve) => {
    let stdout = ''; let stderr = ''; let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    // SANITISED child env — Telegram/ClickUp/DB secrets are stripped so the reviewer
    // process can never read them. The api key (if any) rides via env, never argv.
    const env = sanitizeCodexEnv(process.env, apiKey);
    const spawnOpts = { cwd, shell: false, env };
    // POSIX: give codex its OWN process group so a timeout can reap the WHOLE tree via
    // process.kill(-pid). On win32 the tree is reaped by pid via `taskkill /T` instead,
    // so no detach is needed (and detaching would change console-handle behaviour).
    if (platform !== 'win32') spawnOpts.detached = true;
    try { child = spawn(codexBin, argv, spawnOpts); }
    catch (e) { return finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout: '' }); }
    const timer = setTimeout(() => {
      // TREE-kill, not child.kill(): a bare child.kill() leaves codex.exe's children
      // as orphans on Windows, and an orphaned codex WEDGES the poll loop. AWAIT the tree
      // reap (taskkill confirms the whole tree is dead) BEFORE resolving, so an abandoned
      // codex process can never survive past the turn; killProcessTree is itself bounded
      // so this can never hang. ALWAYS resolve (timed_out) once the reap settles.
      Promise.resolve(killProcessTree({ child, spawn, platform, log }))
        .then((reap) => finish({ ok: false, code: -2, stderr: `turn timed out after ${timeoutMs}ms`, stdout, timed_out: true, tree_reaped: reap?.tree_reaped !== false }))
        .catch(() => finish({ ok: false, code: -2, stderr: `turn timed out after ${timeoutMs}ms`, stdout, timed_out: true, tree_reaped: false }));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, stdout, stderr }); });
    try { child.stdin?.write(prompt); child.stdin?.end(); } catch { /* ignore */ }
  });
}

/** Parse codex `--json` JSONL: pull the final agent message JSON object. */
export function parseCodexJsonl(text) {
  const lines = String(text ?? '').split(/\r?\n/).filter(Boolean);
  let final = null; let tokensUsed = 0;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.type === 'item.completed' || obj?.type === 'turn.completed' || obj?.item?.text || obj?.text) final = obj.item?.text ?? obj.text ?? final;
      const outTok = obj?.usage?.output_tokens ?? obj?.item?.usage?.output_tokens;
      if (outTok) tokensUsed += Number(outTok) || 0;
    } catch { /* skip non-JSON progress lines */ }
  }
  if (final && typeof final === 'string') {
    const start = final.indexOf('{'); const end = final.lastIndexOf('}');
    if (start >= 0 && end > start) { try { return { result: JSON.parse(final.slice(start, end + 1)), tokensUsed }; } catch { /* fall */ } }
    return { result: { summary: final.slice(0, 400) }, tokensUsed, malformed: true };
  }
  return { result: null, tokensUsed, malformed: true };
}

/** Lightweight structural validation against CODEX_RESULT_SCHEMA. Fail-closed. */
export function validateCodexResult(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['result is not an object'] };
  const verdicts = ['approve', 'request_changes', 'comment'];
  if (!verdicts.includes(obj.verdict)) errors.push(`verdict must be one of ${verdicts.join('|')}`);
  if (typeof obj.summary !== 'string' || obj.summary.length === 0) errors.push('summary must be a non-empty string');
  const action = obj.proposed_action;
  const actionTypes = ['post_review', 'post_comment', 'noop'];
  if (!action || !actionTypes.includes(action.type)) errors.push(`proposed_action.type must be one of ${actionTypes.join('|')}`);
  if (obj.findings !== undefined && !Array.isArray(obj.findings)) errors.push('findings must be an array when present');
  return { ok: errors.length === 0, errors };
}
