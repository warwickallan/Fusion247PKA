// BUILD-014 WP-B — small runtime utilities (structured logging + sleep).
//
// Mack discipline: logs are structured (JSON lines) and NEVER carry raw payloads or
// secrets — only pointers/metadata (jobId, queue, workerId, event kind, attempt, a
// payload_hash). A payload may contain governed content; we log its fingerprint, not
// its bytes. Set LOG_LEVEL=silent (or pass { level: 'silent' }) in tests.

import { randomUUID } from 'node:crypto';

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

// CONTROLLED CLASSIFICATION SET (round-3 fix 2). The ledger/log error shape must NEVER be
// derived from arbitrary message content — the old allow-list `summary` could pass an
// alphanumeric secret (e.g. 'ABC123SECRET') through almost verbatim. Instead we carry ONLY
// a fixed classification drawn from a KNOWN set, a machine error-code validated to a KNOWN
// shape, a correlationId, and the raw message LENGTH (a signal without the bytes).
//
// errorClass is mapped through this allow-list of built-in / recognised error constructors.
// Anything else — including a maliciously-named custom error subclass — collapses to the
// generic 'Error', so the class name can never smuggle message/secret bytes either.
const KNOWN_ERROR_CLASSES = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
  'EvalError', 'URIError', 'AggregateError', 'AssertionError',
  'DatabaseError',   // pg
  'SystemError',     // node
]);

// A machine error-code is surfaced ONLY when it matches a recognised code SHAPE:
//   - Postgres SQLSTATE: exactly 5 chars of [0-9A-Z]  (e.g. '23001', '40P01')
//   - Node errno string: /^E[A-Z0-9]{1,30}$/           (e.g. 'ECONNREFUSED', 'ENOENT')
//   - Node numeric errno: a plain integer
// Any other value on err.code / err.errno (an arbitrary/secret-shaped string a handler set)
// is DROPPED to null — the code field is a controlled set, not a passthrough for bytes.
const SQLSTATE = /^[0-9A-Z]{5}$/;
const NODE_ERRNO = /^E[A-Z0-9]{1,30}$/;

function classifyErrorCode(err) {
  if (err == null) return null;
  const raw = err.code ?? err.errno;
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && (SQLSTATE.test(raw) || NODE_ERRNO.test(raw))) return raw;
  return null;
}

/**
 * Sanitise a thrown error for the ledger + logs (round-3 fix 2 — both reviewers).
 *
 * Handler errors previously flowed raw (and, after round-2, as a message-DERIVED `summary`)
 * into structured logs AND ops.agent_event payloads, so a message built from payload/secret
 * bytes could leak into the append-only, potentially git-provenanced ledger. This reduces an
 * error to a fixed, NON-MESSAGE-DERIVED shape:
 *   - errorClass    a classification from KNOWN_ERROR_CLASSES (unknown -> generic 'Error')
 *   - errorCode     a machine code validated to a KNOWN shape (SQLSTATE / Node errno) or null
 *   - correlationId a fresh id to cross-reference an out-of-band diagnostic, if any
 *   - messageLength the raw length only (a signal without the bytes)
 * There is deliberately NO message-derived string field. The handler contract (README) states
 * handlers MUST NOT rely on full error text being persisted; put any diagnostic detail in
 * explicit, classification-tagged event fields.
 */
export function sanitizeError(err) {
  const rawMsg = err == null ? '' : String(err.message ?? err);
  const rawClass = (err && err.constructor && err.constructor.name) || 'Error';
  const errorClass = KNOWN_ERROR_CLASSES.has(rawClass) ? rawClass : 'Error';
  return {
    errorClass,
    errorCode: classifyErrorCode(err),
    correlationId: 'corr-' + randomUUID(),
    messageLength: rawMsg.length,
  };
}

/** A tiny leveled JSON-line logger. Never pass a raw payload here. */
export function createLogger(opts = {}) {
  const levelName = opts.level ?? process.env.LOG_LEVEL ?? 'info';
  const threshold = LEVELS[levelName] ?? LEVELS.info;
  const base = { service: 'control-plane-worker', ...(opts.base ?? {}) };
  const emit = (level, msg, fields) => {
    if ((LEVELS[level] ?? 99) > threshold) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...base, ...(fields ?? {}) });
    if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
  };
  return {
    error: (msg, fields) => emit('error', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    debug: (msg, fields) => emit('debug', msg, fields),
    child: (extra) => createLogger({ ...opts, base: { ...base, ...extra } }),
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll `fn` (a boolean/Promise<boolean>) until it is truthy or `timeoutMs` elapses. */
export async function waitFor(fn, { timeoutMs = 5000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() > deadline) return false;
    await sleep(intervalMs);
  }
}
