#!/usr/bin/env node
// FusionDevBot send path (BUILD-020 WP-4B, WO-2026-08-06-19).
//
// WHAT THIS IS: the pipe, not the trigger. Hand it one argument — a file holding the
// message text — and it does everything else itself: finds its own Telegram credentials
// on disk at a fixed approved path, POSTs plain text to FusionDevBot, and writes down
// what happened. No `--env-file`, no exported variable, no wrapper, no shell setup.
//
// WHAT THIS IS NOT, and must never become (Warwick, 2026-08-06, map section 17.2):
// deciding WHEN to send stays with Larry and is NOT mechanised. There is no daemon, no
// scheduler, no hook, no event classifier here, and the `Stop`-hook trigger design once
// sketched in section 17.2 is STRUCK and must not be built. A judgement is not a mechanism.
//
// THE LOAD-BEARING HALF IS THE ACCOUNTING, NOT THE SEND. The failure this file exists to
// make impossible is a process that exits 0 having sent nothing. Every invocation ends in
// exactly one durable line on disk and an exit code that tells the truth about it.
//
// NO `getMe`, DELIBERATELY (J2-e). `getMe` proves a bot exists; it proves nothing about
// delivery. Warwick's acceptance is one real message arriving on his phone from the
// INSTALLED path. The safest guarantee `getMe` is never mistaken for acceptance is that
// it does not exist in this file — so do not add a reachability probe here.
//
// PLAIN TEXT, ALWAYS. `parse_mode` is never set. Larry's messages carry underscores and
// brackets that Markdown parsing would mangle or reject outright.
//
// CREDENTIALS: read at runtime from the approved file below. No credential value is ever
// printed, logged or written to the record, and no value is ever placed into process.env.
//
// DIVERGENCE FROM HOUSE PRECEDENT, DELIBERATE — read this before "fixing" it.
// `continuity.mjs` loadHonchoEnv() starts `if (process.env.HONCHO_API_KEY) return true`,
// i.e. an inherited environment variable wins over the file. THIS FILE DOES THE OPPOSITE:
// the credentials file is authoritative and an inherited TELEGRAM_BOT_TOKEN is IGNORED.
// Reason (J2-c, ruled 2026-08-06): honouring an inherited value re-admits the exact shell
// dependence this path exists to remove, and makes the acceptance property — "invoked with
// a message file and NOTHING else" — unfalsifiable, because a stray exported variable in
// one operator's shell would mask a completely unconfigured machine.

import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

// ---- constants -------------------------------------------------------------

// The approved credentials file. This is a PATH LITERAL read by this script at runtime,
// on the operator's behalf. It sits under the secrets store, which is why nothing in this
// repo — and no test in the sibling suite — ever opens it. Writing a path is not access.
export const CREDENTIALS_PATH = 'C:/.fusion247/fusion-capture-gateway.env';

// The two names that must be present in that file. NAMES are safe to log; values never are.
export const CREDENTIAL_NAMES = ['TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID'];

// The durable record. Append-only JSONL in the governor's existing state home — the same
// `~/.mypka/governor` that continuity.mjs already establishes as STORE_DIR.
//
// WHY THIS IS NOT A SECOND OUTBOX (the test that was applied, recorded so it is not
// re-litigated): an outbox holds PENDING work — rows awaiting send, a dedup claim, retry,
// and a writer loop that reads it back to decide what to do next. This holds nothing
// pending, has no claim, no retry, no reader, and no state machine. Nothing ever consults
// it to decide anything. It is a post-hoc attempt log, which is precisely the thing C-9
// records as entirely absent for the governor.
//
// WHY NOT Tower's `tower.notification`: it would need a Postgres connection, a `pg`
// dependency (barred by dependency_policy: no-new-runtime-deps) and credentials this path
// does not have — and it would make a ding to Warwick's phone fail whenever the control
// plane is down, coupling the simplest channel to the most complex system.
//
// KNOWN LIMITATION, reported not engineered around: this file is never rotated or trimmed.
// At a handful of dings a day and ~200 bytes a line it is trivial for years. Building a
// rotator here would be machinery the volume does not justify.
export const LOG_PATH = join(homedir(), '.mypka', 'governor', 'ding-log.jsonl');

export const SEND_TIMEOUT_MS = 10_000;

// A hang is a silent failure, so every outcome below is reachable in bounded time.
//
// Exit codes serve CALLERS THAT BRANCH; diagnosis serves HUMANS and lives in the record's
// `outcome`/`detail`. That is why "credentials file absent" and "a required name missing
// from it" share exit 2 while carrying different `outcome` values: a caller's remedy is
// identical for both (go fix the configuration), a human's is not.
//
// `2` deliberately keeps the legacy meaning of the pre-existing send path, which already
// exits 2 on missing token/chat — widened only to include "the file itself was gone".
export const EXIT = {
  SENT: 0,                  // delivered, and the Telegram message_id is recorded
  TELEGRAM_REJECTED: 1,     // reached Telegram; Telegram refused it
  CREDENTIALS_UNUSABLE: 2,  // file absent, unreadable, or a required name missing
  NETWORK_FAILURE: 3,       // never reached Telegram: transport error or timeout
  USAGE: 4,                 // the caller's mistake: no argument, unreadable or empty message
  SENT_BUT_UNRECORDED: 5,   // it WAS sent, and the record could not be written
  INTERNAL_ERROR: 6,        // a bug in this file — loud, never silent, never 0
};

// Redaction is a NET over free text (a Telegram error description, a transport error
// message), not the primary guarantee. The primary guarantee is that no credential value
// is ever placed into the record or the summary in the first place.
//
// Values shorter than this are not substring-redacted: a short secret would corrupt
// unrelated numbers (a 3-character chat id would rewrite `"message_id":1234`), and the
// false-positive damage outweighs the protection. No real Telegram credential is this
// short — bot tokens run ~45 characters and user ids 9-10 digits.
const MIN_REDACT_LEN = 8;

// ---- 1. the durable record -------------------------------------------------

/** Build a redactor over the given secrets. Longest first, so a token containing a chat
 *  id is masked as one unit rather than being partially rewritten. */
export function makeRedactor(secrets = []) {
  const targets = secrets
    .filter((s) => typeof s === 'string' && s.length >= MIN_REDACT_LEN)
    .sort((a, b) => b.length - a.length);
  if (targets.length === 0) return (text) => text;
  return (text) => {
    let out = String(text);
    for (const t of targets) out = out.split(t).join('***');
    return out;
  };
}

/** Append one JSON line to the record. NEVER throws — a failure to record is itself an
 *  outcome the caller must report, not an exception that unwinds past the reporting.
 *  The redactor runs over the FINAL BYTES, so nothing reaches disk unfiltered. */
export function appendRecord(logPath, entry, redact = (s) => s) {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, redact(JSON.stringify(entry)) + '\n', 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

// ---- 2. the credential self-load -------------------------------------------

/** Minimal KEY=VALUE parser, mirroring continuity.mjs loadHonchoEnv()'s shape.
 *  Deliberately does NOT write into process.env: values stay local to this process's
 *  call stack and are never inherited by anything. Full-line `#` comments are skipped;
 *  a trailing inline comment after an unquoted value is part of the value, same as the
 *  house parser and same as Node's own --env-file. */
export function parseEnvText(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/** Load the two credentials from the approved file. Returns names, never values, on the
 *  failure paths — the legacy path's "(names only)" guarantee, kept. */
export function loadCredentials(envPath = CREDENTIALS_PATH, { readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  let text;
  try {
    text = readFile(envPath);
  } catch (err) {
    const absent = err && (err.code === 'ENOENT' || err.code === 'ENOTDIR');
    return {
      ok: false,
      outcome: absent ? 'credentials-file-absent' : 'credentials-file-unreadable',
      missing: [],
    };
  }
  const vars = parseEnvText(text);
  const missing = CREDENTIAL_NAMES.filter((n) => !vars[n] || !String(vars[n]).trim());
  if (missing.length > 0) return { ok: false, outcome: 'credentials-missing-names', missing };
  return {
    ok: true,
    token: vars.TELEGRAM_BOT_TOKEN,
    chatId: vars.AUTHORISED_TELEGRAM_USER_ID,
    missing: [],
  };
}

// ---- 3. the send -----------------------------------------------------------

function describeTransportError(err, timedOut, timeoutMs) {
  if (timedOut) return `timed out after ${timeoutMs}ms`;
  const code = err && err.cause && err.cause.code;
  const msg = (err && err.message) || String(err);
  return code ? `${msg} (${code})` : msg;
}

/** POST the message. Plain text: `parse_mode` is NEVER set.
 *  The URL embeds the token, so the URL is never returned, logged or printed. */
export async function sendMessage({
  token,
  chatId,
  text,
  fetchImpl = globalThis.fetch,
  timeoutMs = SEND_TIMEOUT_MS,
}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: ctrl.signal,
      });
    } catch (err) {
      return {
        ok: false,
        outcome: 'network-failure',
        detail: describeTransportError(err, ctrl.signal.aborted, timeoutMs),
      };
    }

    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (err) {
      return {
        ok: false,
        outcome: 'network-failure',
        detail: describeTransportError(err, ctrl.signal.aborted, timeoutMs),
      };
    }

    let body = null;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }

    if (!res.ok || !body || body.ok !== true) {
      const description =
        body && typeof body.description === 'string' ? body.description : bodyText.slice(0, 200);
      return {
        ok: false,
        outcome: 'telegram-rejected',
        detail: `http ${res.status}: ${description}`,
      };
    }

    // A message id is the ONLY proof the message actually left. `ok:true` without one is
    // not a success and must never be reported as one.
    const messageId = body.result && body.result.message_id;
    if (typeof messageId !== 'number') {
      return {
        ok: false,
        outcome: 'telegram-rejected',
        detail: `http ${res.status}: ok:true but no message_id in result`,
      };
    }
    return { ok: true, message_id: messageId };
  } finally {
    clearTimeout(timer);
  }
}

// ---- the whole path --------------------------------------------------------

/** Run one invocation. Returns the exit code; never throws.
 *  Every parameter has a production default, and every one is injectable so the sibling
 *  suite can exercise all of this with ZERO network calls and WITHOUT reading the real
 *  credentials file. */
export async function run({
  argv = [],
  envPath = CREDENTIALS_PATH,
  logPath = LOG_PATH,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  timeoutMs = SEND_TIMEOUT_MS,
  stdout = (s) => process.stdout.write(s),
  stderr = (s) => process.stderr.write(s),
  readFile = (p) => readFileSync(p, 'utf8'),
} = {}) {
  // Becomes token-aware the moment credentials are known; until then there is nothing
  // secret in play to mask.
  let redact = (s) => s;

  /** The single exit point. One durable line per invocation, then the summary, then the
   *  code. Nothing returns from `run` except through here.
   *
   *  TOTAL BY CONSTRUCTION: this must never throw. It is the reporter, and a reporter that
   *  can unwind past its own caller turns a loud failure into an unhandled rejection with
   *  nothing written anywhere. Found by the sibling suite, not by inspection. */
  const emit = (exitCode, outcome, extra = {}) => {
    try {
      return emitOrThrow(exitCode, outcome, extra);
    } catch (err) {
      try {
        stderr(`ding: REPORTING FAILED (${outcome}): ${String((err && err.message) || err)}\n`);
      } catch {
        /* there is nothing left to report through */
      }
      // A send that happened but whose record cannot be confirmed is exactly exit 5.
      return exitCode === EXIT.SENT ? EXIT.SENT_BUT_UNRECORDED : exitCode || EXIT.INTERNAL_ERROR;
    }
  };

  const emitOrThrow = (exitCode, outcome, extra = {}) => {
    const entry = { ts: now(), outcome, exit: exitCode, message_id: extra.message_id ?? null };
    // Deliberately NOT recorded: the message text. It may carry anything, and a log is a
    // poor place to find out. Its size is recorded instead.
    if (extra.bytes !== undefined) entry.bytes = extra.bytes;
    if (extra.missing !== undefined && extra.missing.length > 0) entry.missing = extra.missing;
    if (extra.detail !== undefined) entry.detail = extra.detail;

    const rec = appendRecord(logPath, entry, redact);
    const summary = { ok: exitCode === EXIT.SENT, why: outcome, message_id: entry.message_id };

    if (!rec.ok) {
      // The record is the thing that must never be silent, so its own failure is loud.
      stderr(redact(`ding: RECORD WRITE FAILED (${logPath}): ${rec.error}\n`));
      if (exitCode === EXIT.SENT) {
        // Two true things at once. Exit 0 would claim a record that does not exist; exit 2
        // would claim a failure that did not happen. Neither is acceptable.
        const unrecorded = { ok: false, why: 'sent-but-unrecorded', message_id: entry.message_id };
        stdout(redact(JSON.stringify(unrecorded)) + '\n');
        stderr(
          redact(
            `ding: message ${entry.message_id} WAS sent but could not be recorded (exit ${EXIT.SENT_BUT_UNRECORDED})\n`,
          ),
        );
        return EXIT.SENT_BUT_UNRECORDED;
      }
      // On a path that already failed, the exit code is already truthful. Say the record
      // failed too, and keep it.
    }

    stdout(redact(JSON.stringify(summary)) + '\n');
    if (exitCode !== EXIT.SENT) {
      stderr(
        redact(
          `ding: FAILED — ${outcome}${entry.detail ? `: ${entry.detail}` : ''} (exit ${exitCode})\n`,
        ),
      );
    }
    return exitCode;
  };

  try {
    const messageFile = argv[0];
    if (!messageFile) {
      return emit(EXIT.USAGE, 'usage-no-message-file', {
        detail: 'usage: ding.mjs <message-file>',
      });
    }

    let text;
    try {
      text = readFile(messageFile);
    } catch (err) {
      return emit(EXIT.USAGE, 'usage-message-file-unreadable', {
        detail: (err && err.code) || 'read failed',
      });
    }
    if (!text.trim()) {
      return emit(EXIT.USAGE, 'usage-message-empty', {});
    }
    const bytes = Buffer.byteLength(text, 'utf8');

    const creds = loadCredentials(envPath, { readFile });
    if (!creds.ok) {
      return emit(EXIT.CREDENTIALS_UNUSABLE, creds.outcome, {
        missing: creds.missing,
        detail: `looked in ${envPath} (names only)`,
        bytes,
      });
    }
    redact = makeRedactor([creds.token, creds.chatId]);

    const sent = await sendMessage({
      token: creds.token,
      chatId: creds.chatId,
      text,
      fetchImpl,
      timeoutMs,
    });

    if (!sent.ok) {
      const exitCode =
        sent.outcome === 'network-failure' ? EXIT.NETWORK_FAILURE : EXIT.TELEGRAM_REJECTED;
      return emit(exitCode, sent.outcome, { detail: sent.detail, bytes });
    }

    return emit(EXIT.SENT, 'sent', { message_id: sent.message_id, bytes });
  } catch (err) {
    // A bug in this file is still not allowed to be silent.
    return emit(EXIT.INTERNAL_ERROR, 'internal-error', {
      detail: String((err && err.message) || err),
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ argv: process.argv.slice(2) }).then(
    (code) => {
      process.exitCode = code;
    },
    // Last-resort guard. `run` is written not to reject; if it ever does, an unhandled
    // rejection would be the one genuinely silent exit this file exists to prevent.
    (err) => {
      process.stderr.write(`ding: UNCAUGHT — ${String((err && err.stack) || err)}\n`);
      process.exitCode = EXIT.INTERNAL_ERROR;
    },
  );
}
