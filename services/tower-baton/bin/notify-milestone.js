#!/usr/bin/env node
// Tower baton — the SANCTIONED ad-hoc milestone entrypoint (WO-OR-19).
//
// This is an ENTRYPOINT, not a pipeline. It sends ONE milestone through the
// EXISTING loader + notifier (`src/runtimeConfig.js` + `src/telegramNotifier.js`)
// and adds no queue, no store, no retry, no scheduler and no abstraction layer.
// `src/**` is untouched by design: everything below is argument handling, a closed
// vocabulary check, and an honest exit code.
//
// NO POSTGRES, NO CLICKUP. It loads only the two names the notifier needs, so it
// runs with the watcher stopped and the control-plane database absent.
//
// MILESTONES, NOT A CONSOLE — and this entrypoint is deliberately NARROWER than the
// library. `telegramNotifier.MILESTONES` is the closed machine vocabulary (7 names);
// a HUMAN may emit only the four EVENT milestones below. The three watcher-lifecycle
// names (watcher_online / watcher_recovered / clickup_token_missing) are states the
// watcher observes about itself — a human able to hand-fake them is how a monitoring
// channel starts lying. The two rejections are reported as DIFFERENT facts: "not a
// milestone at all" and "a milestone, but not available to this entrypoint".
//
// FAIL LOUDLY. `notifyMilestone` NEVER THROWS: a dropped message comes back as
// `{ sent:false, skipped:'not-a-milestone' }` and a naive caller would exit 0 on it.
// That is the exact silent failure this entrypoint exists to prevent, so EVERY
// outcome other than `sent === true` exits NON-ZERO and prints its reason to stderr.
// stdout carries the success JSON and nothing else — there is no output on any
// failure path that a human could read as success.
//
// NO DEDUP STATE. `openState()` defaults to writing C:\.fusion247\tower-baton-state.json,
// which is inside the secrets store (GL-012), and it would put ad-hoc sends into the
// WATCHER's dedup namespace — where an ad-hoc `escalation` could silently suppress a
// real one. So no state is passed: dedup is off here and RE-RUNNING RESENDS.
//
// SECRET DISCIPLINE. No credential is read, printed, logged or accepted in argv. The
// loader resolves its own secrets by NAME and masks them; the notifier scrubs the bot
// token from every error path. Nothing on stdout or stderr carries a value.
//
// THE ⟦GOV⟧ FOOTER IS BOUND TO THE EVENT, NOT TO ANYONE'S MEMORY (WO-OR-25). Root
// CLAUDE.md makes the footer EVENT-DRIVEN: it appears when Warwick has something to act
// on, and NEVER as a per-reply staple. Through the whole Phase 7 closeout it was never
// emitted, including when a `merge-decision` handback was owed — the renderer existed,
// was tested and green, and the trigger lived in an agent's attention, where silence
// reads exactly like nothing to say. So this entrypoint appends it MECHANICALLY:
//   * HANDBACK-CLASS (escalation, blocked) -> footer appended. Warwick must act.
//   * ROUTINE (review_posted, tower_unavailable) -> nothing appended. A footer on a
//     message that requires nothing of him manufactures the exact interruption it exists
//     to prevent, which is the staple CLAUDE.md forbids.
// The line is RENDERED BY tools/governor/footer.mjs and never hand-composed here: the
// byte grammar lives in that module, a hand-built line is a defect by definition, and a
// footer one field short parses as "no footer" — indistinguishable from a healthy reply.
//
// AND IT CAN NEVER COST A SEND. Every footer failure degrades to "no footer, message
// still sent, exit 0". A governor line is not worth a lost handback. Two outcomes are
// deliberately DIFFERENT and must not be collapsed into one:
//   * telemetry missing/unreadable -> `computeFooterLine` renders a valid BLIND line and
//     the footer IS appended. BLIND is a correct outcome, not a failure; suppressing it
//     would make the governor quietest exactly when it stopped measuring, and would take
//     the one piece of advice CLAUDE.md never withholds — rotate — with it.
//   * the footer path THROWS -> no footer, message sent anyway.
//
// USAGE ERRORS STAY LOUD. An unrecognised `--handback` code, or one supplied alongside a
// routine purpose, is exit 2 with nothing loaded and nothing sent — never a quiet
// fallback to CONTINUE. A mistyped code silently rendering the wrong control token is the
// silent-discard family this entrypoint already refuses everywhere else.
//
// NO SESSION ID EXISTS IN A CLI PROCESS, and no flag invents one. The sample therefore
// resolves by `resolveHealthSample` rule 2 — the newest sample under the cwd-derived
// project key, `approximate: true`, which is the `~` in `ctx ~NN%`. Run from a worktree
// with no samples under its key, the line is honestly `ctx --` · BLIND.
//
// Usage:
//   node bin/notify-milestone.js --purpose escalation --body "..." [--source LARRY] [--checkpoint-id <id>] [--handback <code>]

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRuntimeConfig } from '../src/runtimeConfig.js';
import { createMilestoneNotifier, MILESTONES, LOGICAL_SOURCES } from '../src/telegramNotifier.js';
import { computeFooterLine, handback, isHandbackCode, HANDBACK_CODES } from '../../../tools/governor/footer.mjs';

// The subset of the closed milestone vocabulary a HUMAN may emit from this entrypoint.
// A strict subset of MILESTONES — never a superset, and never a new name.
export const CLI_PURPOSES = Object.freeze([
  'review_posted',      // a verdict was posted and someone must look at it
  'escalation',         // DECISION_REQUIRED / a handback is owed
  'blocked',            // fail-closed / a blocker Warwick must clear
  'tower_unavailable',  // the route stopped — QA-dependent work must HALT
]);

// Machine-only lifecycle milestones: real MILESTONES, refused to a human caller.
export const MACHINE_ONLY_PURPOSES = Object.freeze(MILESTONES.filter((p) => !CLI_PURPOSES.includes(p)));

// WHICH MILESTONES MEAN "WARWICK MUST ACT" — the whole footer decision, as data.
// A strict subset of CLI_PURPOSES; everything else here is ROUTINE and gets no footer.
export const HANDBACK_PURPOSES = Object.freeze(['escalation', 'blocked']);
export const ROUTINE_PURPOSES = Object.freeze(CLI_PURPOSES.filter((p) => !HANDBACK_PURPOSES.includes(p)));

// Deliberately NOT REQUIRED_FOR_WATCHER: this entrypoint needs no ClickUp credential.
export const REQUIRED_FOR_NOTIFY = Object.freeze(['TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID']);

export const DEFAULT_SOURCE = 'TOWER';

export const USAGE = [
  'usage: node bin/notify-milestone.js --purpose <name> --body "<text>" [--source <name>] [--checkpoint-id <id>] [--handback <code>]',
  `  --purpose        REQUIRED, no default. One of: ${CLI_PURPOSES.join(', ')}`,
  `  --body           REQUIRED. The message text. Not read from stdin or from a file.`,
  `  --source         optional, default ${DEFAULT_SOURCE}. One of: ${LOGICAL_SOURCES.join(', ')}`,
  '  --checkpoint-id  optional. Correlation id only; this entrypoint keeps no dedup state.',
  `  --handback       optional, ${HANDBACK_PURPOSES.join('/')} only. The ⟦GOV⟧ control code: ${HANDBACK_CODES.join(', ')}.`,
  '                   Absent leaves footer.mjs its own default control token; it is never guessed here.',
].join('\n');

function argValue(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  return typeof v === 'string' ? v : null;
}

/**
 * Parse + validate argv. Returns { error } or { purpose, body, source, checkpointId }.
 * Every rejection here is a USAGE error (exit 2) and happens before any secret is loaded.
 */
export function parseArgs(argv = []) {
  const purpose = argValue(argv, '--purpose');
  const body = argValue(argv, '--body');
  const source = argValue(argv, '--source') ?? DEFAULT_SOURCE;
  const checkpointId = argValue(argv, '--checkpoint-id') ?? '';
  const handbackCode = argValue(argv, '--handback');

  if (!purpose) {
    return { error: `--purpose is required and has NO default. Available to this entrypoint: ${CLI_PURPOSES.join(', ')}` };
  }
  if (!MILESTONES.includes(purpose)) {
    return { error: `not a milestone: "${purpose}" is not in the Tower milestone vocabulary. This channel is MILESTONES, NOT A CONSOLE — routine progress is not sendable. Available to this entrypoint: ${CLI_PURPOSES.join(', ')}` };
  }
  if (!CLI_PURPOSES.includes(purpose)) {
    return { error: `not available to this entrypoint: "${purpose}" is a machine-emitted watcher lifecycle milestone (${MACHINE_ONLY_PURPOSES.join(', ')}) and may not be sent by hand. Available to this entrypoint: ${CLI_PURPOSES.join(', ')}` };
  }
  if (typeof body !== 'string' || body.trim() === '') {
    return { error: '--body is required and must not be empty or whitespace. It is not read from stdin or from a file.' };
  }
  if (!LOGICAL_SOURCES.includes(source)) {
    return { error: `--source "${source}" is not a logical source. One of: ${LOGICAL_SOURCES.join(', ')}` };
  }
  // `HANDBACK_CODES` is a FROZEN literal in footer.mjs mirroring the constitution's seven
  // legitimate interruptions. Membership-checked, never coerced: an unrecognised code is a
  // usage error here, not a footer that quietly renders CONTINUE.
  if (handbackCode !== null) {
    if (!isHandbackCode(handbackCode)) {
      return { error: `--handback "${handbackCode}" is not a handback code. One of: ${HANDBACK_CODES.join(', ')}` };
    }
    if (!HANDBACK_PURPOSES.includes(purpose)) {
      return { error: `--handback is only meaningful on a handback-class purpose (${HANDBACK_PURPOSES.join(', ')}). "${purpose}" is ROUTINE and its message carries no footer, so the code would be silently discarded.` };
    }
  }
  return { purpose, body, source, checkpointId, handbackCode };
}

/**
 * The whole footer decision, in one place: WHICH milestones get a footer, and what a
 * footer failure costs (nothing). Pure apart from the injected renderer.
 *
 * Returns the body to send — unchanged for a routine purpose, or `body` + blank line +
 * the rendered line for a handback-class one. The footer is LAST because
 * `extractFooterLine` reads the final line of a message and nothing else.
 */
export function bodyWithFooter({ purpose, body, handbackCode = null, footerImpl = computeFooterLine } = {}) {
  if (!HANDBACK_PURPOSES.includes(purpose)) return body;
  try {
    // `handback()` throws on an unrecognised code — unreachable from the CLI (parseArgs
    // rejected it already) and deliberately still inside the try, because a caller using
    // this function directly must lose the footer, never the message.
    const control = handbackCode ? handback(handbackCode) : undefined;
    const line = footerImpl(control === undefined ? {} : { control });
    if (typeof line !== 'string' || line.trim() === '') return body;
    return `${body}\n\n${line}`;
  } catch {
    // A footer is never worth a lost handback. No stderr noise either: this path is not a
    // send failure, and this command's stderr means NOT SENT.
    return body;
  }
}

/**
 * Run one ad-hoc milestone send. Returns the PROCESS EXIT CODE — it never exits itself,
 * so it is drivable from a test without a child process.
 *
 *   0 — sent (and only then). The success JSON goes to stdout.
 *   2 — usage/validation error. Nothing was loaded and nothing was sent.
 *   1 — anything else: config fail-closed, notifier not ready, dropped, deduped, or a
 *       failed send. Reason on stderr, NOTHING on stdout.
 *
 * @param {object} args
 * @param {string[]} args.argv            process.argv.slice(2)
 * @param {object} [args.env]             process env (passed through to the loader)
 * @param {object} args.stdout            a writable with .write() (process.stdout)
 * @param {object} args.stderr            a writable with .write() (process.stderr)
 * @param {function} [args.loadConfigImpl] injectable loader (tests pass a fake)
 * @param {function} [args.notifierFactory] injectable notifier factory (tests pass a fake)
 * @param {function} [args.footerImpl]     injectable ⟦GOV⟧ renderer (tests pass the real
 *                                         one with a pinned store, or a throwing seam)
 */
export async function runNotify({
  argv = [],
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  loadConfigImpl = loadRuntimeConfig,
  notifierFactory = createMilestoneNotifier,
  footerImpl = computeFooterLine,
} = {}) {
  const out = (s) => { stdout.write(`${s}\n`); };
  const err = (s) => { stderr.write(`${s}\n`); };

  const parsed = parseArgs(argv);
  if (parsed.error) {
    err(`notify-milestone: NOT SENT — ${parsed.error}`);
    err(USAGE);
    return 2;
  }

  // Names only. No value is read here, and none can be supplied on the command line.
  const loaded = loadConfigImpl({ required: [...REQUIRED_FOR_NOTIFY], env });
  if (!loaded?.ok) {
    err(`notify-milestone: NOT SENT — ${loaded?.error ?? 'config fail-closed (no reason given)'}`);
    return 1;
  }

  // No `state`: see the header. Dedup is off here on purpose.
  const notifier = notifierFactory({ config: loaded.config });
  const result = await notifier.notifyMilestone({
    purpose: parsed.purpose,
    logicalSource: parsed.source,
    // The event binding. Handback-class -> the rendered ⟦GOV⟧ line rides along; routine ->
    // untouched. It cannot throw and it cannot stop the send.
    body: bodyWithFooter({ purpose: parsed.purpose, body: parsed.body, handbackCode: parsed.handbackCode, footerImpl }),
    checkpointId: parsed.checkpointId,
  });

  if (result?.sent === true) {
    out(JSON.stringify({ sent: true, messageId: result.messageId ?? null, purpose: parsed.purpose, source: parsed.source }));
    return 0;
  }

  // Every remaining shape is a FAILURE, however quiet the notifier was about it.
  let why;
  if (result?.error) why = `the send failed: ${result.error}`;
  else if (result?.deduped) why = 'the notifier suppressed it as a duplicate (deduped)';
  else if (result?.skipped) why = `the notifier dropped it: ${result.skipped}`;
  else why = 'the notifier returned no result';
  err(`notify-milestone: NOT SENT — ${why}`);
  return 1;
}

const isMain = (() => {
  try { return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (isMain) {
  runNotify({ argv: process.argv.slice(2) })
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`notify-milestone: NOT SENT — fatal: ${String(e?.message ?? e)}\n`);
      process.exit(1);
    });
}
