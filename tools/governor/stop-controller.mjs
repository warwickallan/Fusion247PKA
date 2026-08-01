#!/usr/bin/env node
// The execution controller (BUILD-018 WP-3, D-A) — decides whether a turn may end.
//
// Wired as a `Stop` hook. Blocking output is exactly `{"decision":"block","reason":"…"}`
// on stdout with exit 0; allowing is empty stdout with exit 0 (Larry's F2, proven on
// this host). This module is NOT wired to anything by this Work Order — Larry owns the
// installer change.
//
// ---------------------------------------------------------------------------
// THE ASYMMETRY THAT DECIDES EVERY DESIGN CHOICE BELOW
// ---------------------------------------------------------------------------
// Missing a handback costs Warwick a nudge. Refusing to let go costs him his session,
// on a machine he is not sitting at. So this module is a narrow ALLOWLIST — every one
// of B1..B6 must hold to block, and literally everything else allows — and its
// anti-loop property is STRUCTURAL rather than counted: `stop_hook_active` is the
// host's own re-entrancy flag, set true on every stop after a block and never reset
// within a continued turn, so at most ONE block can occur per user turn. The maximum
// harm from any bug in this file is one extra assistant turn. That guarantee does not
// depend on a counter that could be corrupted, unwritable or stale, and it deletes an
// entire durable store along with it.
//
// INV-2 outranks everything here: every failure path allows. Unparseable stdin, missing
// or wrong-typed payload keys, missing programme state, invalid programme state, more
// than one active programme, an unreadable transcript, an unwritable audit path, any
// thrown exception, the internal budget being exceeded — all of them exit 0 with empty
// stdout and let the stop through.
//
// ---------------------------------------------------------------------------
// ORDER OF EVALUATION — normative, and where it departs from A-1's prose
// ---------------------------------------------------------------------------
// Silas's implementation constraint 5 gives the normative order:
//
//   kill switch -> env -> stop_hook_active -> session-disable -> transcript
//                -> permission_mode -> programme state -> footer
//
// A-1's prose says `stop_hook_active` is evaluated "FIRST, before any file is opened",
// which cannot be literally true at the same time as A-5's kill switch being "checked
// before anything else" — the kill switch is a file test. Raised at read-back and ruled
// by Larry: constraint 5's order wins, because it is the explicitly normative statement
// and because kill-switch-first is strictly MORE permissive, which is the safe side of
// INV-2. Under a governor whose worst failure is trapping Warwick, ties go to permissive.
//
// A-1's guarantee survives intact anyway, because what A-M1 actually asserts is that no
// PROGRAMME-STATE file is opened when `stop_hook_active` is true — and it is not: the
// programme state sits three rungs further down and is never reached.
//
// ---------------------------------------------------------------------------
// NO GIT, EVER, ON THIS PATH (A-7)
// ---------------------------------------------------------------------------
// A stop must be cheap. Nothing here shells out; `git worktree list` in particular is
// not affordable on every stop. One consequence worth stating: the Stop payload carries
// `cwd` but no branch, so the active programme is matched on worktree path alone. The
// footer's own predicate (D-4/U-a) additionally matches on branch because the statusLine
// payload carries `worktree.branch`; the Stop payload does not, and obtaining it would
// require exactly the git call A-7 forbids.

import { existsSync, openSync, closeSync, fstatSync, readSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import { atomicWriteFileSync } from './atomic-write.mjs';
import { projectKeyFor } from './health-store.mjs';
import { readProgrammeState } from './programme-state.mjs';
import { samePath } from './worktree-guard.mjs';
import { parseFooterFromMessage, HANDBACK_CODES } from './footer.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Route 1 of A-5, and the one that matters: the only escape reachable from claude.ai
// web and Android, which is where Warwick actually is. Its literal text appears inside
// EVERY block reason, for AD-21's reason — at the moment the escape is needed, nobody is
// reading the documentation; the refusal is the only thing on screen.
export const GOVERNOR_OFF_TOKEN = 'GOVERNOR OFF';
export const ESCAPE_LINE = `To stop the governor for this session, reply with: ${GOVERNOR_OFF_TOKEN}`;

// Case-insensitive, word-boundary. `\s+` rather than a literal space so a token split
// across a soft wrap still matches — more forgiving, and every extra match is an extra
// ALLOW, which is the direction INV-2 wants a mistake to fall in.
export const GOVERNOR_OFF_RE = /\bGOVERNOR\s+OFF\b/i;

export const TRANSCRIPT_TAIL_BYTES = 64 * 1024;
export const TRANSCRIPT_BUDGET_MS = 250;
export const CONTROLLER_BUDGET_MS = 3000;

export const ALLOWED_PERMISSION_MODES = Object.freeze(['default', 'acceptEdits', 'bypassPermissions']);

export const ENV_STOP_OFF = 'MYPKA_GOVERNOR_STOP';

// Every outcome is named. A controller that can only say "allowed" cannot be made to
// fail convincingly, and INV-5 says a control is not evidence until it has been made to
// fail on the specific ground it claims to cover.
export const OUTCOME = Object.freeze({
  ALLOW_KILL_SWITCH: 'allow:kill-switch',
  ALLOW_ENV: 'allow:env',
  ALLOW_STOP_HOOK_ACTIVE: 'allow:stop-hook-active',
  ALLOW_SESSION_DISABLED: 'allow:session-disabled',
  ALLOW_TRANSCRIPT_OFF: 'allow:transcript-governor-off',
  ALLOW_PERMISSION_MODE: 'allow:permission-mode',
  ALLOW_NO_PROGRAMME: 'allow:no-active-programme',
  ALLOW_BUDGET: 'allow:budget-exceeded',
  ALLOW_NO_FOOTER: 'allow:no-footer',
  ALLOW_HANDBACK: 'allow:declared-handback',
  BLOCK: 'block',
});

// ---------------------------------------------------------------------------
// Machine-local stores — every one behind an env seam
// ---------------------------------------------------------------------------
// `MYPKA_GOVERNOR_DISABLE_DIR` redirects BOTH disable artefacts (the `DISABLE` kill
// switch and the per-session markers under `disabled/`), because a test that redirects
// one and not the other is a test that writes into Warwick's real `~/.mypka`. That is a
// hard boundary on this Work Order, not a preference. Same convention as
// `MYPKA_GOVERNOR_HEALTH_DIR`. (This also named `MYPKA_GOVERNOR_DELEGATION_DIR` until
// 2026-08-01, when the delegation gate that owned it was retired.)

export function governorDisableRoot({
  homeDir = os.homedir(),
  envOverride = process.env.MYPKA_GOVERNOR_DISABLE_DIR,
} = {}) {
  if (envOverride) return envOverride;
  return join(homeDir, '.mypka', 'governor');
}

export function killSwitchPath(opts = {}) {
  return join(governorDisableRoot(opts), 'DISABLE');
}

export function sessionDisablePath(sessionId, opts = {}) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new TypeError('sessionId must be a non-empty string');
  }
  return join(governorDisableRoot(opts), 'disabled', sessionId);
}

export function handbackAuditDir({
  cwd,
  homeDir = os.homedir(),
  envOverride = process.env.MYPKA_GOVERNOR_HANDBACK_DIR,
} = {}) {
  if (envOverride) return envOverride;
  return join(homeDir, '.mypka', 'governor', 'handbacks', projectKeyFor(cwd));
}

export function handbackAuditPath(sessionId, opts = {}) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new TypeError('sessionId must be a non-empty string');
  }
  return join(handbackAuditDir(opts), `${sessionId}.jsonl`);
}

// ---------------------------------------------------------------------------
// A-6: the reason whitelist
// ---------------------------------------------------------------------------
// The injected `reason` is fixed strings plus these four validated fields and NOTHING
// else. `resumption.next_action`, `resumption.focus`, `do_not[]`, `blockers[].summary`
// and every other free-text field are FORBIDDEN.
//
// This is not hypothetical hardening. The state banked today opens with
// "SCOPE FROZEN BY WARWICK …: do NOT start T-12…". Interpolating `next_action` would
// therefore inject, into a message whose entire purpose is to make Larry continue, a
// sentence instructing him to stop. A block reason is a FIXED INSTRUCTION TO RESUME that
// points AT the state file. It is never a quotation FROM it.
//
// The mechanism is a whitelist of narrow patterns rather than a denylist of dangerous
// ones: a denylist has to anticipate the payload, and free prose written by a human
// months from now is exactly what cannot be anticipated.

export const REASON_FIELD_PATTERNS = Object.freeze({
  ticket: /^[A-Z]{1,3}-\d{1,4}$/,
  branch: /^[A-Za-z0-9._/-]{1,120}$/,
  programmeId: /^[A-Z]+-\d+$/,
});

function validField(value, pattern) {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

/**
 * buildBlockReason(parts) -> string
 *
 * Every interpolation is validated first and OMITTED when it fails — a rejected field
 * removes its clause rather than degrading the whole reason, so a malformed ticket id
 * can never suppress the escape line.
 */
export function buildBlockReason({
  ticket = null,
  branch = null,
  statePath = null,
  programmeId = null,
  backgroundTaskCount = 0,
} = {}) {
  const safeTicket = validField(ticket, REASON_FIELD_PATTERNS.ticket);
  const safeBranch = validField(branch, REASON_FIELD_PATTERNS.branch);
  const safeProgramme = validField(programmeId, REASON_FIELD_PATTERNS.programmeId);
  // The state file path is whitelisted by EXISTENCE, per A-6's table — the check is
  // "must exist on disk", which is what makes an attacker-controlled string useless
  // here: it has to name a real file to survive.
  const safeStatePath = typeof statePath === 'string' && statePath.length > 0 ? statePath : null;

  const lines = [
    'GOVERNOR: this turn does not look like a legitimate handback point, so it was not allowed to end.',
  ];

  const subject = safeProgramme ? `Programme ${safeProgramme}` : 'The active programme';
  const onTicket = safeTicket ? ` on ticket ${safeTicket}` : '';
  const onBranch = safeBranch ? ` (branch ${safeBranch})` : '';
  lines.push(`${subject} still has an open next action${onTicket}${onBranch}.`);

  if (safeStatePath) {
    lines.push(`Read the banked state at ${safeStatePath} and carry on with the work it names.`);
  } else {
    lines.push('Read the banked programme state for this build and carry on with the work it names.');
  }

  // A-8: `background_tasks` NEVER causes a block and NEVER prevents an allow. Its only
  // use is here, in the reason text of a block already decided by A-2 — so that Larry
  // does not mistake "a worker is still running" for a legitimate handback. Blocking
  // BECAUSE a worker is running was explicitly rejected: a hung worker would block
  // forever.
  if (Number.isInteger(backgroundTaskCount) && backgroundTaskCount > 0) {
    lines.push(
      `${backgroundTaskCount} background task(s) are still running. A running worker is not a handback — ` +
      'keep working or wait for it, but do not stop here.'
    );
  }

  lines.push(
    'If you genuinely need Warwick, end your reply with a footer whose control token is ' +
    `HANDBACK:<code>, using one of: ${HANDBACK_CODES.join(', ')}.`
  );
  lines.push(ESCAPE_LINE);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PURE: the decision
// ---------------------------------------------------------------------------

/**
 * decideStop(payload, facts) -> { block, reason, checks, outcome, handbackCode, ... }
 *
 * Pure in the sense that matters: it performs no I/O and reads no globals. Every fact
 * that requires the world arrives as an injected PROVIDER, and the providers are called
 * lazily in the normative order — which is what makes A-M1 testable by injecting a
 * throwing programme-state reader and asserting it was never called.
 *
 * `checks` counts every condition CONSIDERED on the path taken, so it is non-zero on
 * every return path (A-M12). A decision that reports zero examined conditions is
 * indistinguishable from a decision that never ran.
 */
export function decideStop(payload, facts = {}) {
  const {
    killSwitchActive = () => false,
    envDisabled = () => false,
    sessionDisabled = () => false,
    transcriptSaysOff = () => false,
    resolveProgramme = () => ({ ok: false, reason: 'no-provider' }),
    budgetExceeded = () => false,
  } = facts;

  let checks = 0;
  const allow = (outcome, extra = {}) => ({
    block: false,
    reason: null,
    checks,
    outcome,
    handbackCode: null,
    escapeMarkerNeeded: false,
    ...extra,
  });

  const p = payload && typeof payload === 'object' ? payload : {};

  // --- Rung 1: kill switch (A-5 route 2) ---------------------------------
  checks += 1;
  if (killSwitchActive() === true) return allow(OUTCOME.ALLOW_KILL_SWITCH);

  // --- Rung 2: environment (A-5 route 3) ---------------------------------
  checks += 1;
  if (envDisabled() === true) return allow(OUTCOME.ALLOW_ENV);

  // --- Rung 3: B1, the structural anti-loop ------------------------------
  // STRICT identity against `false`. `true`, absent, null, 0, "false" — anything that is
  // not the boolean false allows immediately. This is the property that caps the blast
  // radius at one extra turn per user turn, so it is deliberately the least clever line
  // in the file.
  checks += 1;
  if (p.stop_hook_active !== false) return allow(OUTCOME.ALLOW_STOP_HOOK_ACTIVE);

  // --- Rung 4: this session was already told to stop governing -----------
  checks += 1;
  if (sessionDisabled() === true) return allow(OUTCOME.ALLOW_SESSION_DISABLED);

  // --- Rung 5: the chat-reachable escape (A-5 route 1) -------------------
  checks += 1;
  if (transcriptSaysOff() === true) {
    return allow(OUTCOME.ALLOW_TRANSCRIPT_OFF, { escapeMarkerNeeded: true });
  }

  // --- Rung 6: B3, permission mode ---------------------------------------
  checks += 1;
  if (!ALLOWED_PERMISSION_MODES.includes(p.permission_mode)) {
    return allow(OUTCOME.ALLOW_PERMISSION_MODE);
  }

  checks += 1;
  if (budgetExceeded() === true) return allow(OUTCOME.ALLOW_BUDGET);

  // --- Rung 7: B4, exactly one active programme with real open work ------
  checks += 1;
  const programme = resolveProgramme();
  if (!programme || programme.ok !== true) return allow(OUTCOME.ALLOW_NO_PROGRAMME);

  // --- Rung 8: B5/B6, the footer -----------------------------------------
  checks += 1;
  const footer = parseFooterFromMessage(p.last_assistant_message);

  // B5's fail-open, and the single most important line in the decision. NO FOOTER AT ALL
  // MEANS ALLOW. Without it: Warwick asks a direct question, Larry answers, the answer
  // carries no footer, the stop is blocked — and Warwick never receives his answer while
  // the governor talks to itself. A reply that CARRIES a footer is by construction a
  // governed, in-build reply; a reply that does not is exactly the class this controller
  // must not touch.
  if (!footer.ok) return allow(OUTCOME.ALLOW_NO_FOOTER);

  checks += 1;
  if (footer.handbackCode) {
    // A-3: a declared handback with a RECOGNISED code always allows, unconditionally.
    // Larry's own judgement is never overridden by this module's vocabulary, because a
    // vocabulary gap must not become a trap.
    return allow(OUTCOME.ALLOW_HANDBACK, { handbackCode: footer.handbackCode });
  }

  // B6: CONTINUE, or a control token that is missing/unrecognised, both fall through to
  // the block. Applying "when Larry forgets, the safe default is continue" only where it
  // is safe — inside a reply that is already governed.
  return {
    block: true,
    reason: buildBlockReason({
      ticket: programme.ticket,
      branch: programme.branch,
      statePath: programme.statePath,
      programmeId: programme.programmeId,
      backgroundTaskCount: Array.isArray(p.background_tasks) ? p.background_tasks.length : 0,
    }),
    checks,
    outcome: OUTCOME.BLOCK,
    handbackCode: null,
    escapeMarkerNeeded: false,
  };
}

// ---------------------------------------------------------------------------
// IMPURE: the providers
// ---------------------------------------------------------------------------

export function isKillSwitchActive(opts = {}) {
  const { existsFn = existsSync } = opts;
  try {
    return existsFn(killSwitchPath(opts));
  } catch {
    return false;
  }
}

export function isEnvDisabled(env = process.env) {
  return String(env?.[ENV_STOP_OFF] ?? '').toLowerCase() === 'off';
}

export function isSessionDisabled(sessionId, opts = {}) {
  const { existsFn = existsSync } = opts;
  try {
    return existsFn(sessionDisablePath(sessionId, opts));
  } catch {
    return false;
  }
}

export function writeSessionDisableMarker(sessionId, opts = {}) {
  try {
    return atomicWriteFileSync(
      sessionDisablePath(sessionId, opts),
      JSON.stringify({ disabled_at: new Date().toISOString(), reason: GOVERNOR_OFF_TOKEN }),
      opts
    );
  } catch {
    // A-7: an unwritable disable path never changes the decision. The stop was already
    // allowed; failing to persist the marker only means the next stop re-scans the
    // transcript and reaches the same answer.
    return null;
  }
}

/**
 * readTranscriptTail(path, opts) -> { text, truncated }
 *
 * At most the last `TRANSCRIPT_TAIL_BYTES`, read by file descriptor at an offset rather
 * than with `readFileSync`. That distinction is the whole reason A-M5's 200 MB case can
 * stay inside the 250 ms budget: reading the file and slicing it would cost the full
 * 200 MB before the slice ever happened.
 *
 * `truncated` says whether the read actually began past the start of the file, and it
 * exists because of a real defect this module shipped with for one iteration: the caller
 * discarded the first line UNCONDITIONALLY as "probably partial". When the transcript is
 * SMALLER than the window nothing was cut, so that first line is a complete record — and
 * dropping it threw away the only user message in a short transcript. A fresh session
 * with a single "GOVERNOR OFF" in it therefore failed to disable the governor, which is
 * the exact escape INV-2 leans on hardest and the exact situation (early in a session,
 * on a phone) where Warwick would reach for it. Caught by this module's own tests. Only
 * drop the first line when there genuinely was a cut.
 */
export function readTranscriptTail(path, opts = {}) {
  const { openFn = openSync, statFn = fstatSync, readFn = readSync, closeFn = closeSync } = opts;
  let fd;
  try {
    fd = openFn(path, 'r');
    const size = statFn(fd).size;
    const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
    if (length <= 0) return { text: '', truncated: false };
    const buf = Buffer.alloc(length);
    readFn(fd, buf, 0, length, Math.max(0, size - length));
    return { text: buf.toString('utf8'), truncated: size > TRANSCRIPT_TAIL_BYTES };
  } catch {
    // Missing file, a directory (EISDIR), a permission error — all allow. A-M5.
    return { text: '', truncated: false };
  } finally {
    if (fd !== undefined) {
      try {
        closeFn(fd);
      } catch { /* nothing useful to do, and never fatal */ }
    }
  }
}

// Extract only text Warwick actually TYPED. A Claude Code transcript records tool
// results as `user` records too, so "the most recent user record" is very often a
// tool_result rather than a human message — taking it literally would make the escape
// unreliable in exactly the sessions that have been doing work.
//
// So: scan every user record in the tail and read only genuine text (a string content,
// or `type: "text"` blocks). `tool_result` blocks are deliberately excluded — a tool
// output containing the token is not Warwick asking for anything.
//
// This is broader than A-5's literal "scans backwards for the most recent user record",
// and the direction is deliberate: every additional match is an additional ALLOW, and
// this is the escape hatch Warwick reaches for when the governor is misbehaving. INV-2
// says availability of his session outranks enforcement.
function userTextFromRecord(record) {
  if (!record || typeof record !== 'object') return '';
  if (record.type !== 'user' && record.role !== 'user' && record.message?.role !== 'user') return '';
  const content = record.message?.content ?? record.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

/**
 * transcriptRequestsGovernorOff(transcriptPath, opts) -> boolean
 *
 * Budgeted at 250 ms. Any error, timeout, missing file or parse failure returns FALSE,
 * which means "no escape found" and lets the rest of the ladder run — every one of those
 * paths eventually allows or blocks on its own merits, and none of them throws.
 */
export function transcriptRequestsGovernorOff(transcriptPath, opts = {}) {
  const { now = Date.now, budgetMs = TRANSCRIPT_BUDGET_MS } = opts;
  const started = now();
  try {
    if (typeof transcriptPath !== 'string' || transcriptPath.length === 0) return false;
    const { text, truncated } = readTranscriptTail(transcriptPath, opts);
    if (!text) return false;

    const lines = text.split('\n');
    // Drop the first line ONLY when the read actually cut it. See readTranscriptTail's
    // note: dropping it unconditionally silently ate the sole user record of a short
    // transcript, disabling Warwick's escape exactly when he was most likely to need it.
    if (truncated) lines.shift();

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (now() - started > budgetMs) return false;
      const raw = lines[i].trim();
      if (!raw) continue;
      let record;
      try {
        record = JSON.parse(raw);
      } catch {
        continue;
      }
      const text = userTextFromRecord(record);
      if (text && GOVERNOR_OFF_RE.test(text)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * resolveActiveProgramme({ cwd, ... }) -> { ok, ticket?, branch?, statePath?, programmeId? }
 *
 * B4: exactly ONE active programme resolves for this session, its
 * `resumption.next_action_kind` is `"action"`, and `resumption.ticket` names a ticket
 * present in `tickets[]` whose state is not `"resolved"`.
 *
 * Every failure — zero matches, several matches, an unreadable file, a file that does
 * not validate, a missing or "hold" next_action_kind, a dangling ticket reference —
 * returns `{ ok: false }`, which allows. Read-only on programme state: this module never
 * writes it and adds no rival write path.
 */
export function resolveActiveProgramme({
  cwd = null,
  deliverablesDir = null,
  readState = readProgrammeState,
  listDir = readdirSync,
  existsFn = existsSync,
} = {}) {
  try {
    if (typeof cwd !== 'string' || cwd.length === 0) return { ok: false, reason: 'no-cwd' };
    const dir = deliverablesDir ?? join(cwd, 'Deliverables');
    if (!existsFn(dir)) return { ok: false, reason: 'no-deliverables' };

    const matches = [];
    for (const entry of listDir(dir)) {
      const name = typeof entry === 'string' ? entry : entry?.name;
      if (typeof name !== 'string') continue;
      const path = join(dir, name, 'programme-state.json');
      if (!existsFn(path)) continue;
      let result;
      try {
        result = readState(path);
      } catch {
        continue;
      }
      if (!result || result.ok !== true || !result.data) continue;
      const resumption = result.data.resumption;
      if (!resumption || typeof resumption !== 'object') continue;
      if (!samePath(resumption.worktree, cwd)) continue;
      matches.push({ path, state: result.data });
    }

    if (matches.length !== 1) {
      return { ok: false, reason: matches.length === 0 ? 'no-match' : 'ambiguous' };
    }

    const { path, state } = matches[0];
    const resumption = state.resumption ?? {};
    if (resumption.next_action_kind !== 'action') return { ok: false, reason: 'next-action-kind' };

    const tickets = Array.isArray(state.tickets) ? state.tickets : [];
    const ticket = tickets.find((t) => t && t.id === resumption.ticket);
    if (!ticket || ticket.state === 'resolved') return { ok: false, reason: 'ticket-not-open' };

    return {
      ok: true,
      ticket: resumption.ticket,
      branch: resumption.branch,
      statePath: path,
      programmeId: state.programme?.id ?? null,
    };
  } catch {
    return { ok: false, reason: 'threw' };
  }
}

/**
 * appendHandbackAudit(record, opts) — A-4's durable, append-only, machine-local audit.
 *
 * Read-modify-write through the ONE shared primitive in `atomic-write.mjs`, with the
 * payload passed as a PRODUCER exactly as `delegation-gate.mjs` does: the content
 * depends on the file at the moment of the attempt, so replaying a pre-backoff snapshot
 * on a retry could discard a record another writer landed in between.
 *
 * Written AFTER the verdict, never before. A failed append never blocks and never
 * changes the decision (A-4).
 */
export function appendHandbackAudit(sessionId, record, opts = {}) {
  try {
    const filePath = handbackAuditPath(sessionId, opts);
    const line = JSON.stringify(record);
    const { readFile = readFileSync, existsFn = existsSync } = opts;
    const producePayload = () => {
      let existing = '';
      if (existsFn(filePath)) {
        try {
          existing = readFile(filePath, 'utf8');
        } catch {
          existing = '';
        }
      }
      return existing.length && !existing.endsWith('\n') ? `${existing}\n${line}\n` : `${existing}${line}\n`;
    };
    return atomicWriteFileSync(filePath, producePayload, opts);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IMPURE: the entrypoint
// ---------------------------------------------------------------------------

export function readStdin(readFile = readFileSync) {
  try {
    return readFile(0, 'utf8');
  } catch {
    return '';
  }
}

export function parsePayload(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * run(raw, opts) -> { stdout, exitCode, decision }
 *
 * The whole controller as one testable function: bytes in, bytes out, no process
 * globals. `main()` is the thin shell that connects it to stdin/stdout.
 */
export function run(raw, opts = {}) {
  const {
    env = process.env,
    now = Date.now,
    deadlineMs = CONTROLLER_BUDGET_MS,
    audit = appendHandbackAudit,
    writeMarker = writeSessionDisableMarker,
    resolveProgrammeFn = resolveActiveProgramme,
    transcriptFn = transcriptRequestsGovernorOff,
    killSwitchFn = isKillSwitchActive,
    sessionDisabledFn = isSessionDisabled,
    ...inject
  } = opts;

  const started = now();
  let decision;
  try {
    const payload = parsePayload(raw);
    // A-M2/A-M3: unparseable or empty stdin allows, with no attempt to guess.
    if (!payload) {
      return { stdout: '', exitCode: 0, decision: { block: false, checks: 1, outcome: OUTCOME.ALLOW_NO_PROGRAMME } };
    }

    const sessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
    const cwd = typeof payload.cwd === 'string' ? payload.cwd : null;

    decision = decideStop(payload, {
      killSwitchActive: () => killSwitchFn(inject),
      envDisabled: () => isEnvDisabled(env),
      sessionDisabled: () => (sessionId ? sessionDisabledFn(sessionId, inject) : false),
      transcriptSaysOff: () => transcriptFn(payload.transcript_path, { now, ...inject }),
      resolveProgramme: () => resolveProgrammeFn({ cwd, ...inject }),
      budgetExceeded: () => now() - started > deadlineMs,
    });

    // Side effects happen AFTER the verdict and can never change it.
    if (decision.escapeMarkerNeeded && sessionId) {
      writeMarker(sessionId, inject);
    }
    if (decision.outcome === OUTCOME.ALLOW_HANDBACK && sessionId) {
      audit(
        sessionId,
        {
          ts: new Date(now()).toISOString(),
          session_id: sessionId,
          code: decision.handbackCode,
          prompt_id: typeof payload.prompt_id === 'string' ? payload.prompt_id : null,
        },
        { cwd, ...inject }
      );
    }
  } catch {
    // A-7's catch-all. Anything thrown anywhere above lets the stop through.
    return { stdout: '', exitCode: 0, decision: { block: false, checks: 1, outcome: OUTCOME.ALLOW_NO_PROGRAMME } };
  }

  if (!decision.block) return { stdout: '', exitCode: 0, decision };
  return {
    stdout: JSON.stringify({ decision: 'block', reason: decision.reason }),
    exitCode: 0,
    decision,
  };
}

export function main(opts = {}) {
  const { readFile = readFileSync, write = (s) => process.stdout.write(s) } = opts;
  let result;
  try {
    result = run(readStdin(readFile), opts);
  } catch {
    result = { stdout: '', exitCode: 0 };
  }
  if (result.stdout) write(result.stdout);
  return result.exitCode;
}

// Only when executed directly, never on import — `pathToFileURL` rather than a
// hand-built `file://` string, matching worktree-guard.mjs and for a Windows-specific
// reason: a drive-letter path hand-concatenated into a URL does not round-trip, so the
// guard would silently never fire and the hook would produce no output at all.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
