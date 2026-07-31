// Delegation ledger + substantial-work threshold gate (BUILD-018, delegation-first
// mechanisation ticket)
//
// THE FAILURE THIS EXISTS TO STOP
// --------------------------------
// Larry's standing rule — delegate bounded implementation work to a subagent by
// default, work directly only when the reason is genuinely non-delegable
// (architecture, integration, safety, judgement, git lifecycle) — lived only as
// prose in a markdown file. It got silently ignored during two separate long
// sessions. Prose that depends on a model remembering it, re-reading it, and
// choosing to obey it is not a control; it is a hope. This module makes the rule
// MECHANICAL: a hook that fires on every mutating tool call and does not depend
// on Larry's memory, discipline, or good faith.
//
// TWO MECHANISMS, COMPOSED ADDITIVELY ONTO worktree-guard.mjs
// -------------------------------------------------------------
// worktree-guard.mjs is NOT modified by this module — not one exported function,
// not one line of behaviour. Everything here calls INTO worktree-guard.mjs's
// existing exports (`findCanonical`, `liveLocation`, `compareLocation`,
// `decide`, `classifyBashCommand`) from the outside and is wired in as
// SEPARATE, additional PreToolUse hook registrations (see install-hooks.mjs),
// the same non-invasive composition style already proven in this build by
// model-gate.mjs composing onto reorient.mjs's OUTPUT without touching
// `reorient()` itself.
//
//   1. Task-dispatch observer (`observe`) — PURE OBSERVATION. Matches the Task
//      tool only. NEVER denies. Appends one record per dispatch to an
//      append-only, per-ticket ledger. This is what lets a fresh session
//      (post `/clear`) inherit the delegation count for a ticket it is
//      resuming — the ledger is keyed by TICKET, not session.
//
//   2. Substantial-work threshold gate (`check`) — CAN DENY. Matches Write,
//      Edit, MultiEdit and mutating Bash (NOT NotebookEdit — see the map for
//      why the threshold is scoped narrower than worktree-guard's own
//      GUARDED_TOOLS). Composes on top of worktree-guard's own location
//      decision: if worktree-guard would already deny (wrong worktree), THAT
//      decision is returned unchanged and the ledger is never even opened — a
//      misplaced session's "current ticket" resolution may itself be
//      meaningless, and there is nothing this gate should add to a refusal
//      that already stops the write. Only when worktree-guard has no
//      objection does this gate count direct calls since the last checkpoint
//      (a Task dispatch, or a `justify` record) for the CURRENT ticket
//      (resolved fresh, every call, from banked programme-state.json's
//      `resumption.ticket` — never cached) and deny the 4th and beyond.
//
//   3. `justify` CLI (mechanism 3) — the second way to clear a checkpoint
//      besides dispatching a subagent: Larry asserts, in his own words, which
//      of a closed set of non-delegable reasons applies, and that becomes a
//      checkpoint record too.
//
// FAIL-DIRECTION (INV-2, generalised) — READ THIS BEFORE CHANGING ANYTHING
// --------------------------------------------------------------------------
// This gate governs Larry's OWN direct-work discipline. It is not a
// safety-critical file-protection control. Denial is reserved ONLY for a
// positive, successfully-computed over-threshold reading. Every other outcome
// — the current ticket cannot be resolved, the ledger cannot be read, the
// ledger cannot be written, worktree-guard itself throws — ALLOWS. A gate that
// traps the session over its OWN bug would be removed within a day, exactly
// like worktree-guard's own AD-19, and a removed control protects nothing.
// Proved by explicit mutation test below (search "MUTATION").
//
// WHY A JSONL LEDGER, NOT A SINGLE JSON OBJECT
// -----------------------------------------------
// health-store.mjs's atomic temp-file+rename pattern (reused here verbatim for
// the actual write) is built for a single overwritten value, where "last
// rename wins" is the correct and only sensible semantics. This ledger is
// APPEND-ONLY history — every direct call, every checkpoint, in order — so
// each write is a read-current-content + append-one-line + atomic
// temp-file+rename-over-target. Under concurrent writers this can lose an
// update (two writers both read the same "before" content; whichever renames
// last wins, silently dropping the other's line) — note which DIRECTION each
// kind of loss falls:
//   * A lost `direct-call` record makes the count LOWER than reality, which
//     biases toward ALLOW — the safe direction.
//   * A lost `justify`/`task` checkpoint record is the DANGEROUS direction:
//     the counter fails to reset and can accumulate past where it genuinely
//     should have. This CAN produce a positive, successfully-computed
//     over-threshold reading and therefore a wrongful DENY — the gate's own
//     error-handling fail-open path (ledger read/write THROWS) is a
//     different thing entirely from a SUCCESSFULLY read ledger that is
//     silently missing a checkpoint due to a race; nothing throws in that
//     case, the count is just wrong. (Schema decision D-delegation-ledger-
//     schema.md §2 corrects an earlier, wrong version of this comment that
//     conflated the two.)
//   * This is ACCEPTED as a bounded, residual risk — not mitigated with file
//     locking or a CAS retry loop. Likelihood is low (requires two PreToolUse
//     hook invocations racing on the SAME ticket's ledger within the write
//     window) and impact is bounded and self-correcting: the worst case is
//     ONE avoidable DENY, which is immediately visible (it blocks the very
//     next tool call) and carries its own one-line recovery command printed
//     directly in the denial message (`buildThresholdDenyMessage` — run
//     `justify`). This matches the project's hobby-brain threat bar
//     (correctness/availability, not adversarial hardening); a control nobody
//     can live with gets disabled within a day, and one avoidable DENY with a
//     printed recovery command is a cost worth paying to avoid that.
// The concurrency test below proves "never a torn/partial line", not "never a
// lost update" — torn output is the one failure mode this design cannot
// tolerate in either direction, and it is the one health-store's own
// precedent is built to prevent.

import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { projectKeyFor } from './health-store.mjs';
import {
  findCanonical,
  liveLocation,
  compareLocation,
  decide as wgDecide,
  classifyBashCommand,
  parseHookInput,
  DECISION,
} from './worktree-guard.mjs';

export { DECISION };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REASON_ENUM = Object.freeze([
  'architecture',
  'integration',
  'safety',
  'judgement',
  'git-lifecycle',
  'emergency',
]);

export const DENY_THRESHOLD = 3;

// Deliberately narrower than worktree-guard's GUARDED_TOOLS (which also
// includes NotebookEdit): the brief scopes the threshold gate to
// Write/Edit/MultiEdit/mutating-Bash only.
export const TARGET_TOOLS = Object.freeze(['Write', 'Edit', 'MultiEdit', 'Bash']);

// Schema (D-delegation-ledger-schema.md, Silas, 2026-07-31). Bumped only on a
// breaking change to the per-line record shape; the mirror of
// programme-state.schema.json's `schema_version` const, applied per LINE here
// since JSONL has no single document header to carry it once.
export const SCHEMA_VERSION = 1;

// The closed three-way state for `task` records (decision §4). "no-fit-declared"
// is RESERVED — no code path in this module ever writes it (that requires the
// domain-coverage matching algorithm against Team/agent-index.md's free text,
// which is explicitly out of scope here, decision §0/§4a) — but a
// structurally-valid record carrying it must still be ACCEPTED as valid, so a
// future ticket that does populate it does not silently fail this module's own
// validation the day it lands.
export const SPECIALIST_MATCH_ENUM = Object.freeze(['declared', 'no-fit-declared', 'unchecked']);

// ---------------------------------------------------------------------------
// Record validation — hand-written, mirroring qa-binding.mjs's validateEntry
// style rather than an if/then JSON-Schema composition (decision §4c/§5,
// matching programme-state.schema.json's own no-if/then house style). The
// JSON Schema file (delegation-ledger-record.schema.json) is the documented
// shape; this validator must agree with it exactly and is what actually runs
// on every read AND every write — a record failing here is INVALID (decision
// §6): never trusted as a checkpoint, never counted, never appended.
// ---------------------------------------------------------------------------

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isStringOrNull(v) {
  return v === null || typeof v === 'string';
}

// additionalProperties:false + fully-required (every property in every kind
// of this schema is required — there are no optional properties on any of
// the three shapes) collapse to one check: the record's own key set must be
// EXACTLY the required set for its kind, no more, no fewer.
function hasExactKeys(obj, requiredKeys) {
  const keys = Object.keys(obj);
  if (keys.length !== requiredKeys.length) return false;
  const requiredSet = new Set(requiredKeys);
  return keys.every((k) => requiredSet.has(k));
}

const TASK_REQUIRED = Object.freeze([
  'schema_version', 'ts', 'session_id', 'ticket', 'kind',
  'subagent_type', 'description', 'governing_specialist', 'specialist_match',
]);
const JUSTIFY_REQUIRED = Object.freeze([
  'schema_version', 'ts', 'session_id', 'ticket', 'kind', 'reason', 'note', 'governing_specialist',
]);
const DIRECT_CALL_REQUIRED = Object.freeze([
  'schema_version', 'ts', 'session_id', 'ticket', 'kind', 'tool_name',
]);

function validateTaskRecord(record) {
  if (!hasExactKeys(record, TASK_REQUIRED)) {
    return { ok: false, error: 'task record must have exactly these keys: ' + TASK_REQUIRED.join(', ') };
  }
  if (!isStringOrNull(record.session_id)) return { ok: false, error: 'session_id must be a string or null' };
  if (!isStringOrNull(record.subagent_type)) return { ok: false, error: 'subagent_type must be a string or null' };
  if (!isStringOrNull(record.description)) return { ok: false, error: 'description must be a string or null' };
  if (!isStringOrNull(record.governing_specialist)) {
    return { ok: false, error: 'governing_specialist must be a string or null' };
  }
  if (typeof record.specialist_match !== 'string' || !SPECIALIST_MATCH_ENUM.includes(record.specialist_match)) {
    return { ok: false, error: `specialist_match must be one of ${SPECIALIST_MATCH_ENUM.join(', ')}` };
  }
  // Cross-field rules (decision §4c) — enforced here, not as JSON-Schema if/then.
  if (record.specialist_match === 'unchecked' && record.governing_specialist !== null) {
    return { ok: false, error: 'specialist_match "unchecked" requires governing_specialist to be null' };
  }
  if (record.specialist_match === 'declared') {
    if (!isNonEmptyString(record.governing_specialist) || record.governing_specialist !== record.subagent_type) {
      return {
        ok: false,
        error: 'specialist_match "declared" requires governing_specialist to equal subagent_type exactly',
      };
    }
  }
  if (record.specialist_match === 'no-fit-declared' && !isNonEmptyString(record.governing_specialist)) {
    return { ok: false, error: 'specialist_match "no-fit-declared" requires a non-empty governing_specialist' };
  }
  return { ok: true };
}

function validateJustifyRecord(record) {
  if (!hasExactKeys(record, JUSTIFY_REQUIRED)) {
    return { ok: false, error: 'justify record must have exactly these keys: ' + JUSTIFY_REQUIRED.join(', ') };
  }
  if (!isStringOrNull(record.session_id)) return { ok: false, error: 'session_id must be a string or null' };
  if (typeof record.reason !== 'string' || !REASON_ENUM.includes(record.reason)) {
    return { ok: false, error: `reason must be one of ${REASON_ENUM.join(', ')}` };
  }
  if (!isStringOrNull(record.note)) return { ok: false, error: 'note must be a string or null' };
  if (record.governing_specialist !== 'larry') {
    return { ok: false, error: 'justify records must carry governing_specialist "larry" (decision §4b)' };
  }
  return { ok: true };
}

function validateDirectCallRecord(record) {
  if (!hasExactKeys(record, DIRECT_CALL_REQUIRED)) {
    return { ok: false, error: 'direct-call record must have exactly these keys: ' + DIRECT_CALL_REQUIRED.join(', ') };
  }
  if (!isStringOrNull(record.session_id)) return { ok: false, error: 'session_id must be a string or null' };
  if (typeof record.tool_name !== 'string' || !TARGET_TOOLS.includes(record.tool_name)) {
    return { ok: false, error: `tool_name must be one of ${TARGET_TOOLS.join(', ')}` };
  }
  return { ok: true };
}

// The one entry point: every read line and every write goes through this
// before it is trusted (decision §5/§6). Never call the per-kind validators
// above directly from outside this module.
export function validateLedgerRecord(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, error: 'record is not a JSON object' };
  }
  if (record.schema_version !== SCHEMA_VERSION) {
    return { ok: false, error: `schema_version must be ${SCHEMA_VERSION} (got ${JSON.stringify(record.schema_version)})` };
  }
  if (!isNonEmptyString(record.ts)) {
    return { ok: false, error: 'ts must be a non-empty string' };
  }
  if (!isNonEmptyString(record.ticket)) {
    return { ok: false, error: 'ticket must be a non-empty string' };
  }
  if (record.kind === 'task') return validateTaskRecord(record);
  if (record.kind === 'justify') return validateJustifyRecord(record);
  if (record.kind === 'direct-call') return validateDirectCallRecord(record);
  return { ok: false, error: `kind must be one of task, justify, direct-call (got ${JSON.stringify(record.kind)})` };
}

// ---------------------------------------------------------------------------
// Specialist-match resolution (decision §4a) — mechanical, exact-match only.
// ---------------------------------------------------------------------------
// Two roster artefacts exist and do different jobs (decision §4a):
//   - `.claude/agents/*.md` filename stems ARE the exact dispatchable
//     `subagent_type` slug set — cheap, mechanical, exact string comparison.
//   - `Team/agent-index.md`'s free-text domain descriptions require a
//     judgement call this module never makes (out of scope, decision §0).
// Any failure to read the roster resolves to "unchecked", never "declared" —
// an inability to check must never read as "checked and it matched".

export function resolveSpecialistMatch({ worktree, subagentType, readdir = readdirSync } = {}) {
  const normalized = typeof subagentType === 'string' ? subagentType.trim().toLowerCase() : '';
  if (!normalized) {
    return { governing_specialist: null, specialist_match: 'unchecked' };
  }
  let entries;
  try {
    entries = readdir(join(worktree, '.claude', 'agents'));
  } catch {
    // Roster directory unreadable (fresh clone, wrong worktree, no .claude
    // folder) — never read as "checked and it matched".
    return { governing_specialist: null, specialist_match: 'unchecked' };
  }
  const slugs = new Set(
    entries
      .map((e) => (typeof e === 'string' ? e : e?.name))
      .filter((name) => typeof name === 'string' && name.toLowerCase().endsWith('.md'))
      .map((name) => name.slice(0, -3).toLowerCase())
  );
  if (slugs.has(normalized)) {
    // Dispatching BY NAME to a real specialist is self-evidently checked
    // delegation — governing_specialist is the subagent_type AS DISPATCHED,
    // not the lower-cased/trimmed form used only for the comparison.
    return { governing_specialist: subagentType, specialist_match: 'declared' };
  }
  return { governing_specialist: null, specialist_match: 'unchecked' };
}

// ---------------------------------------------------------------------------
// Ledger location
// ---------------------------------------------------------------------------
// `~/.mypka/governor/delegation/<projectKey>/<ticket>.jsonl`. `projectKeyFor`
// is health-store.mjs's, reused rather than duplicated.
//
// IMPLEMENTATION JUDGEMENT CALL: the `cwd` fed to `projectKeyFor` here is the
// programme's CANONICAL worktree (from `findCanonical`'s `canonical.worktree`),
// never the live session cwd. A session can legitimately start in the wrong
// worktree, get corrected mid-session (EnterWorktree), or simply be resumed
// from a different checkout after `/clear` — and the whole point of keying
// this ledger by TICKET rather than session is that it must resolve to the
// SAME file regardless of which physical checkout the session is sitting in
// at the moment of the call. Keying on live cwd instead would silently fork
// the counter per checkout, defeating the "fresh session inherits the count"
// requirement the moment the session's location changes even slightly.

export function delegationLedgerDir({
  cwd,
  homeDir = os.homedir(),
  envOverride = process.env.MYPKA_GOVERNOR_DELEGATION_DIR,
} = {}) {
  if (envOverride) return envOverride;
  return join(homeDir, '.mypka', 'governor', 'delegation', projectKeyFor(cwd));
}

export function delegationLedgerPath(ticket, opts = {}) {
  if (!ticket || typeof ticket !== 'string') {
    throw new TypeError('ticket must be a non-empty string');
  }
  return join(delegationLedgerDir(opts), `${ticket}.jsonl`);
}

// ---------------------------------------------------------------------------
// Ledger I/O — atomic temp-file+rename (health-store.mjs's pattern, reused),
// with every fs call injectable so the fail-open mutation tests can force a
// throw without needing OS-level permission trickery.
// ---------------------------------------------------------------------------

// Return shape (decision §6): `{ records, skipped, path }`. `records` is
// ordered oldest-first = physical file order = append order (decision §3);
// `skipped` surfaces every line that failed validation (not valid JSON, or
// valid JSON that fails schema/cross-field validation) rather than swallowing
// it silently — the gate's own decision does not need `skipped` (a skip can
// only ever REDUCE the visible record set, which biases the safe/ALLOW
// direction per §2), but a human or a future audit tool asking "why did the
// gate never fire" must be able to tell "genuinely zero direct calls" apart
// from "some direct-call lines were silently dropped as corrupt".
export function readLedger(ticket, opts = {}) {
  const { readFile = readFileSync, existsFn = existsSync } = opts;
  const filePath = delegationLedgerPath(ticket, opts);
  if (!existsFn(filePath)) return { records: [], skipped: [], path: filePath };
  const raw = readFile(filePath, 'utf8');
  const records = [];
  const skipped = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      skipped.push({ line: i + 1, raw: lines[i], error: `not valid JSON: ${err.message}` });
      continue;
    }
    const validation = validateLedgerRecord(parsed);
    if (!validation.ok) {
      skipped.push({ line: i + 1, raw: lines[i], error: validation.error });
      continue;
    }
    records.push(parsed);
  }
  return { records, skipped, path: filePath };
}

function atomicAppendRecord(filePath, record, opts = {}) {
  const {
    readFile = readFileSync,
    writeFile = writeFileSync,
    renameFile = renameSync,
    mkdir = mkdirSync,
    existsFn = existsSync,
  } = opts;
  mkdir(dirname(filePath), { recursive: true });
  let existing = '';
  if (existsFn(filePath)) {
    try {
      existing = readFile(filePath, 'utf8');
    } catch {
      existing = '';
    }
  }
  const line = JSON.stringify(record);
  const next = existing.length && !existing.endsWith('\n') ? `${existing}\n${line}\n` : `${existing}${line}\n`;
  const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  writeFile(tmpPath, next);
  renameFile(tmpPath, filePath);
  return filePath;
}

// Validated BEFORE any I/O (decision §5's "applied both on write... a record
// failing validation must never be appended in the first place"). A caller
// constructing a malformed record is a bug in THIS module, not a runtime
// condition to swallow — it throws, same posture as delegationLedgerPath's
// own TypeError on a missing ticket.
export function appendLedgerRecord(ticket, record, opts = {}) {
  const validation = validateLedgerRecord(record);
  if (!validation.ok) {
    throw new TypeError(`refusing to append an invalid delegation ledger record: ${validation.error}`);
  }
  const filePath = delegationLedgerPath(ticket, opts);
  return atomicAppendRecord(filePath, record, opts);
}

// ---------------------------------------------------------------------------
// Pure: checkpoint semantics
// ---------------------------------------------------------------------------

export function isCheckpointRecord(record) {
  return record?.kind === 'task' || record?.kind === 'justify';
}

// Trusts the ARRAY order it is given — never re-sorts by `ts` (decision §3,
// correcting the earlier draft). Every successful write reads the full
// current content (which already contains everything landed so far) and
// appends its own record as the new last line before renaming the whole file
// back in, so physical line order IS a true causal/happens-before ordering of
// applied writes — it does not depend on trusting any process's system clock
// and cannot produce a same-millisecond tie the way two rapid
// `Date.toISOString()` calls can. `ts` is retained on every record for
// human/audit readability only; it is NEVER consulted here. Callers MUST pass
// `records` in physical file order (readLedger's own contract, decision §6).
export function countDirectCallsSinceCheckpoint(records) {
  let count = 0;
  for (const r of records) {
    if (isCheckpointRecord(r)) {
      count = 0;
      continue;
    }
    if (r?.kind === 'direct-call') count += 1;
  }
  return count;
}

export function buildThresholdDenyMessage({ ticket, count, threshold = DENY_THRESHOLD }) {
  return [
    `🚨 DELEGATION GATE — the BUILD-018 Session Governor blocked this tool call.`,
    '',
    `${count} direct Write/Edit/MultiEdit/mutating-Bash call(s) have happened for ${ticket} since the ` +
      `last checkpoint (threshold ${threshold}).`,
    '',
    "Larry's standing rule is delegation-first: bounded implementation work goes to a subagent by default; " +
      'Larry works directly only when the reason is genuinely non-delegable (architecture, integration, ' +
      'safety, judgement, git lifecycle).',
    '',
    'Clear this by ONE of:',
    '  1. Dispatch a subagent via the Task tool for the remaining work on this ticket — the dispatch itself',
    '     is recorded as a checkpoint and resets this count to zero.',
    '  2. Run this exact command, naming the reason this work is genuinely non-delegable:',
    `     node tools/governor/delegation-gate.mjs justify --reason <architecture|integration|safety|judgement|git-lifecycle|emergency> --ticket ${ticket} --note "<short free text>"`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Mechanism 2 — the substantial-work threshold gate (impure: git + fs)
// ---------------------------------------------------------------------------

export function evaluateDelegationGate({
  toolName,
  toolInput,
  cwd,
  sessionId,
  now = () => new Date().toISOString(),
  execFile,
  readdir,
  read,
  exists,
  estateRoots = [],
  ledgerOpts = {},
  threshold = DENY_THRESHOLD,
} = {}) {
  if (!TARGET_TOOLS.includes(toolName)) {
    return { decision: DECISION.DEFER, reason: `${toolName} is not governed by the delegation threshold gate.` };
  }

  if (toolName === 'Bash') {
    let cls;
    try {
      cls = classifyBashCommand(toolInput?.command);
    } catch (err) {
      // Fail open: an unclassifiable command must not be treated as a reason
      // to deny — see the file-header fail-direction note.
      return { decision: DECISION.DEFER, reason: `Bash classification failed (${err.message}); failing open.` };
    }
    if (cls.kind !== 'mutating') {
      return {
        decision: DECISION.DEFER,
        reason: 'Non-mutating Bash is not governed by the delegation threshold gate.',
        classification: cls.kind,
      };
    }
  }

  let found;
  try {
    found = findCanonical({ cwd, estateRoots, execFile, readdir, read, exists });
  } catch (err) {
    return {
      decision: DECISION.ALLOW,
      reason: `could not resolve the canonical programme (${err.message}); failing open (INV-2, generalised).`,
    };
  }

  const canonical = found?.canonical || null;

  // worktree-guard's OWN decision wins outright, and is checked FIRST, before
  // the ledger is even opened. A session whose location is wrong has a
  // "current ticket" resolution that may itself be meaningless — this gate
  // never suppresses, replaces, or weakens worktree-guard's own denial; it
  // only ever ADDS a second, distinct kind of denial when worktree-guard has
  // no objection of its own.
  let wgResult;
  try {
    const live = liveLocation({ cwd, execFile });
    const comparison = { ...compareLocation(canonical, live), live };
    wgResult = wgDecide({ toolName, toolInput, comparison, canonical });
  } catch (err) {
    wgResult = { decision: DECISION.DEFER, reason: `worktree-guard's decide() threw (${err.message}); failing open.` };
  }
  if (wgResult.decision === DECISION.DENY) {
    return {
      decision: DECISION.DEFER,
      reason:
        'worktree-guard already denies this call on location grounds; the delegation gate does not ' +
        'duplicate, override, or weaken that decision, and never touches the ledger in this case.',
      worktreeGuard: wgResult,
    };
  }

  const ticket = canonical?.ticket || null;
  if (!ticket) {
    return {
      decision: DECISION.ALLOW,
      reason:
        'no current ticket could be resolved from banked programme state; failing open rather than ' +
        "trapping the session over the gate's own bug.",
    };
  }

  const opts = { ...ledgerOpts, cwd: canonical.worktree };
  let records;
  try {
    ({ records } = readLedger(ticket, opts));
  } catch (err) {
    return {
      decision: DECISION.ALLOW,
      reason:
        `the delegation ledger could not be read (${err.message}); failing open — this gate governs ` +
        'discipline, not safety-critical protection (INV-2, generalised).',
      ticket,
    };
  }

  const count = countDirectCallsSinceCheckpoint(records);
  if (count >= threshold) {
    return { decision: DECISION.DENY, reason: buildThresholdDenyMessage({ ticket, count, threshold }), ticket, count };
  }

  // Allowed: record this direct call so the NEXT invocation — a brand new
  // process, since PreToolUse hooks are one-shot CLIs — sees an accurate
  // count. A failed append must never flip an already-decided ALLOW into a
  // DENY: the decision is final the moment it is computed above.
  try {
    appendLedgerRecord(
      ticket,
      {
        schema_version: SCHEMA_VERSION,
        ts: typeof now === 'function' ? now() : now,
        session_id: sessionId || null,
        ticket,
        kind: 'direct-call',
        tool_name: toolName,
      },
      opts
    );
  } catch {
    // Swallowed deliberately — see comment above.
  }

  return { decision: DECISION.ALLOW, ticket, count };
}

// ---------------------------------------------------------------------------
// Mechanism 1 — Task-dispatch observer (impure: git + fs; NEVER denies)
// ---------------------------------------------------------------------------

export function recordTaskDispatch({
  cwd,
  sessionId,
  subagentType,
  description,
  now = () => new Date().toISOString(),
  execFile,
  readdir,
  read,
  exists,
  estateRoots = [],
  ledgerOpts = {},
} = {}) {
  // Pure observation. Every failure path here is swallowed and reported back
  // as `{ recorded: false }` — never thrown, never a hook denial. Mechanism 1
  // has no deny path at all; it exists to make the counter reset possible,
  // not to gate anything itself.
  try {
    const found = findCanonical({ cwd, estateRoots, execFile, readdir, read, exists });
    const ticket = found?.canonical?.ticket || null;
    if (!ticket) return { recorded: false, reason: 'no current ticket could be resolved' };
    const opts = { ...ledgerOpts, cwd: found.canonical.worktree };
    const match = resolveSpecialistMatch({
      worktree: found.canonical.worktree,
      subagentType,
      readdir: readdir || readdirSync,
    });
    appendLedgerRecord(
      ticket,
      {
        schema_version: SCHEMA_VERSION,
        ts: typeof now === 'function' ? now() : now,
        session_id: sessionId || null,
        ticket,
        kind: 'task',
        subagent_type: subagentType || null,
        description: description || null,
        governing_specialist: match.governing_specialist,
        specialist_match: match.specialist_match,
      },
      opts
    );
    return { recorded: true, ticket };
  } catch (err) {
    return { recorded: false, reason: err.message };
  }
}

// ---------------------------------------------------------------------------
// Mechanism 3 — `justify` (pure validation, impure append)
// ---------------------------------------------------------------------------

export function validateJustifyReason(reason) {
  return typeof reason === 'string' && REASON_ENUM.includes(reason);
}

// Validation happens BEFORE any filesystem or git call: an invalid or missing
// `--reason` must leave the ledger completely untouched, not merely unhelpful.
//
// JUDGEMENT CALL: `justify` refuses (does not write) when the active
// programme cannot be resolved from `cwd`/`--estate`, rather than silently
// falling back to a raw-cwd-derived ledger location. `justify`'s whole
// purpose is to reset the counter the threshold gate is reading — if it wrote
// to a DIFFERENT file than the gate reads (because the gate resolves the
// ledger location via the CANONICAL worktree and this command guessed wrong),
// Larry would see a confirmation message and the gate would still deny the
// very next call, which is a much worse failure than a clear CLI error
// up front. Unlike the PreToolUse hooks, `justify` is Larry's own deliberate,
// foreground command — INV-2's fail-open mandate governs BLOCKING hook paths
// in a live session, not a CLI action Larry chooses to run; refusing an
// ambiguous write here is the same fail-closed-on-write posture
// programme-state.mjs's `writeProgrammeState` already takes.
export function justify({
  reason,
  ticket,
  note,
  sessionId,
  cwd,
  estateRoots = [],
  now = () => new Date().toISOString(),
  execFile,
  readdir,
  read,
  exists,
  ledgerOpts = {},
} = {}) {
  if (!validateJustifyReason(reason)) {
    return {
      ok: false,
      error:
        `--reason must be one of: ${REASON_ENUM.join(', ')} ` +
        `(got ${reason === undefined ? '(missing)' : JSON.stringify(reason)})`,
    };
  }
  if (!ticket || typeof ticket !== 'string') {
    return { ok: false, error: '--ticket is required' };
  }

  let found;
  try {
    found = findCanonical({ cwd, estateRoots, execFile, readdir, read, exists });
  } catch (err) {
    return { ok: false, error: `could not resolve the active programme: ${err.message}` };
  }
  if (!found?.canonical) {
    return {
      ok: false,
      error:
        `no active programme could be resolved from ${cwd} (${found?.reason || 'unknown reason'}) — ` +
        'run justify from the canonical worktree, or pass --estate.',
    };
  }

  const record = {
    schema_version: SCHEMA_VERSION,
    ts: typeof now === 'function' ? now() : now,
    session_id: sessionId || null,
    ticket,
    kind: 'justify',
    reason,
    note: note || null,
    governing_specialist: 'larry',
  };
  const opts = { ...ledgerOpts, cwd: found.canonical.worktree };
  appendLedgerRecord(ticket, record, opts);
  return { ok: true, record, canonical: found.canonical };
}

// ---------------------------------------------------------------------------
// Hook plumbing — mirrors worktree-guard.mjs's own runHook/toHookOutput shape
// ---------------------------------------------------------------------------

export function runObserveHook(raw, opts = {}) {
  const parsed = parseHookInput(raw);
  if (!parsed.ok) return { recorded: false, reason: `could not read input (${parsed.reason})` };
  const payload = parsed.payload;
  if (payload.tool_name !== 'Task') {
    return { recorded: false, reason: `${payload.tool_name ?? '(no tool)'} is not a Task dispatch` };
  }
  const input = payload.tool_input || {};
  try {
    return recordTaskDispatch({
      cwd: payload.cwd || opts.cwd,
      sessionId: payload.session_id,
      subagentType: input.subagent_type,
      description: input.description,
      estateRoots: opts.estateRoots,
      execFile: opts.execFile,
      readdir: opts.readdir,
      read: opts.read,
      exists: opts.exists,
      ledgerOpts: opts.ledgerOpts,
    });
  } catch (err) {
    // Pure observation never throws outward.
    return { recorded: false, reason: err.message };
  }
}

export function runCheckHook(raw, opts = {}) {
  const parsed = parseHookInput(raw);
  if (!parsed.ok) {
    return {
      decision: DECISION.DEFER,
      reason: `Delegation gate could not read its input (${parsed.reason}); failing open.`,
    };
  }
  const payload = parsed.payload;
  try {
    return evaluateDelegationGate({
      toolName: payload.tool_name,
      toolInput: payload.tool_input || {},
      cwd: payload.cwd || opts.cwd,
      sessionId: payload.session_id,
      estateRoots: opts.estateRoots,
      execFile: opts.execFile,
      readdir: opts.readdir,
      read: opts.read,
      exists: opts.exists,
      ledgerOpts: opts.ledgerOpts,
      threshold: opts.threshold,
    });
  } catch (err) {
    return {
      decision: DECISION.DEFER,
      reason: `Delegation gate errored (${err.message}); failing open (INV-2, generalised).`,
    };
  }
}

export function toHookOutput(result) {
  if (!result || result.decision !== DECISION.DENY) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: result.reason,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI — `observe` and `check` are PreToolUse hooks and ALWAYS exit 0 (never
// trap the session over their own bug); `justify` is a deliberate foreground
// command and exits non-zero on a rejected input.
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

function estateRootsFromArgv(argv) {
  const estateRoots = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--estate' && argv[i + 1]) estateRoots.push(argv[++i]);
  }
  if (process.env.GOVERNOR_ESTATE_ROOT) estateRoots.push(process.env.GOVERNOR_ESTATE_ROOT);
  return estateRoots;
}

async function readStdin() {
  let raw = '';
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  } catch {
    raw = '';
  }
  return raw;
}

async function mainObserve(argv) {
  const raw = await readStdin();
  try {
    runObserveHook(raw, { estateRoots: estateRootsFromArgv(argv) });
  } catch {
    // Pure observation must never trap the session over its own bug.
  }
  process.exitCode = 0;
}

async function mainCheck(argv) {
  const raw = await readStdin();
  let out = null;
  try {
    out = toHookOutput(runCheckHook(raw, { estateRoots: estateRootsFromArgv(argv) }));
  } catch {
    out = null; // fail open
  }
  if (out) process.stdout.write(JSON.stringify(out));
  process.exitCode = 0;
}

function mainJustify(argv) {
  const flags = parseFlags(argv);
  const result = justify({
    reason: typeof flags.reason === 'string' ? flags.reason : undefined,
    ticket: typeof flags.ticket === 'string' ? flags.ticket : undefined,
    note: typeof flags.note === 'string' ? flags.note : null,
    sessionId: process.env.CLAUDE_SESSION_ID || null,
    cwd: process.cwd(),
    estateRoots: typeof flags.estate === 'string' ? [flags.estate] : [],
  });
  if (!result.ok) {
    process.stderr.write(`justify: ${result.error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Checkpoint recorded — ticket ${result.record.ticket}, reason ${result.record.reason}` +
      `${result.record.note ? `, note ${JSON.stringify(result.record.note)}` : ''}. ` +
      'The delegation threshold gate is clear for this ticket until the next 3 direct calls.\n'
  );
  process.exitCode = 0;
}

function usage() {
  return 'usage: node delegation-gate.mjs <observe|check|justify> [...args]';
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'observe') return mainObserve(rest);
  if (cmd === 'check') return mainCheck(rest);
  if (cmd === 'justify') return mainJustify(rest);
  process.stderr.write(usage() + '\n');
  // Unknown/missing subcommand from a direct invocation is a usage error, not
  // a hook failure (neither `observe` nor `check` reach this branch when
  // installed correctly) — non-zero is appropriate here.
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
