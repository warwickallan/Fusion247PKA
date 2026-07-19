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

// SQLSTATE shape: exactly 5 chars of [0-9A-Z] (e.g. '23001', '40P01'). NOTE the shape ALONE is
// NOT sufficient to accept a code — a 5-char uppercase SECRET has the identical shape — so a
// SQLSTATE is surfaced ONLY when the error is a genuine pg error (see looksLikePgError).
const SQLSTATE = /^[0-9A-Z]{5}$/;

// KNOWN Node errno string constants — a FIXED allow-list (WP-B final fix 2). A string err.code /
// err.errno is surfaced ONLY when it is EXACTLY one of these. An invented `Exxx`-shaped token a
// handler smuggles (e.g. 'EABC123SECRET') is NOT in this set, so it is DROPPED — the shape-based
// /^E[A-Z0-9]+$/ test used previously let such a token through almost verbatim. The code field is
// a controlled enumeration, never a passthrough for caller bytes.
const NODE_ERRNO_ALLOWLIST = new Set([
  'E2BIG', 'EACCES', 'EADDRINUSE', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EAGAIN', 'EAI_AGAIN',
  'EALREADY', 'EBADF', 'EBADMSG', 'EBUSY', 'ECANCELED', 'ECHILD', 'ECONNABORTED', 'ECONNREFUSED',
  'ECONNRESET', 'EDEADLK', 'EDESTADDRREQ', 'EDOM', 'EDQUOT', 'EEXIST', 'EFAULT', 'EFBIG',
  'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EISDIR',
  'ELOOP', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'EMULTIHOP', 'ENAMETOOLONG', 'ENETDOWN', 'ENETRESET',
  'ENETUNREACH', 'ENFILE', 'ENOBUFS', 'ENODATA', 'ENODEV', 'ENOENT', 'ENOEXEC', 'ENOLCK',
  'ENOLINK', 'ENOMEM', 'ENOMSG', 'ENOPROTOOPT', 'ENOSPC', 'ENOSR', 'ENOSTR', 'ENOSYS', 'ENOTCONN',
  'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'ENOTSUP', 'ENOTTY', 'ENXIO', 'EOPNOTSUPP', 'EOVERFLOW',
  'EPERM', 'EPIPE', 'EPROTO', 'EPROTONOSUPPORT', 'EPROTOTYPE', 'ERANGE', 'EROFS', 'ESPIPE',
  'ESRCH', 'ESTALE', 'ETIME', 'ETIMEDOUT', 'ETXTBSY', 'EWOULDBLOCK', 'EXDEV',
]);

/**
 * Read a property WITHOUT ever invoking an accessor or coercing a hostile value (WP-B final fix 1).
 *
 * - An OWN property is read from its descriptor's `.value` — an own ACCESSOR (getter) is skipped
 *   entirely (returns undefined), never invoked, so `{ get message(){throw} }` cannot raise here.
 * - A non-own key falls back to a GUARDED direct read (to reach inherited DATA properties like
 *   `constructor`); a throwing inherited accessor or a hostile Proxy trap is swallowed by the catch.
 * - Primitives (Symbol, bigint, number, string) and null-prototype objects are all safe: the
 *   descriptor lookup coerces to a wrapper and simply finds nothing.
 * NEVER throws for ANY input.
 */
function safeRead(obj, key) {
  if (obj == null) return undefined;
  try {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc) return 'value' in desc ? desc.value : undefined; // own accessor -> skip, never invoke
    return obj[key]; // inherited data property; guarded by the catch
  } catch {
    return undefined;
  }
}

/**
 * A genuine pg error is recognised by its class name AND pg's own marker data-fields (severity /
 * routine), which a handler returning a bare `{ code:'ABCDE' }` (class 'Error', no markers) does
 * not carry. This is what lets a real SQLSTATE classify while a same-shaped secret on a plain
 * Error is dropped. Marker reads go through safeRead so a hostile object can never raise.
 */
function looksLikePgError(err) {
  const ctor = safeRead(err, 'constructor');
  const cname = ctor && safeRead(ctor, 'name');
  if (cname !== 'DatabaseError') return false;
  return typeof safeRead(err, 'severity') === 'string' || typeof safeRead(err, 'routine') === 'string';
}

// A machine error-code is surfaced ONLY when it is PROVABLY system-origin (WP-B final fix 2):
//   - a string exactly matching a KNOWN Node errno constant (NODE_ERRNO_ALLOWLIST); OR
//   - a 5-char SQLSTATE carried by a GENUINE pg error (looksLikePgError).
// Everything else — an invented `Exxx` token, a 5-char uppercase secret on a plain Error, ANY
// numeric code/errno (a huge integer must never persist verbatim) — collapses to null.
function classifyErrorCode(err) {
  const code = safeRead(err, 'code');
  const errno = safeRead(err, 'errno');
  for (const raw of [code, errno]) {
    if (typeof raw === 'string' && NODE_ERRNO_ALLOWLIST.has(raw)) return raw;
  }
  if (typeof code === 'string' && SQLSTATE.test(code) && looksLikePgError(err)) return code;
  return null;
}

// Static, content-free fallback the whole-body catch returns if sanitisation ever degrades.
const SANITIZE_FALLBACK = () => ({ errorClass: 'Error', errorCode: null, correlationId: 'corr-' + randomUUID(), messageLength: -1 });

/**
 * Sanitise a thrown error for the ledger + logs — TOTAL and NON-THROWING (WP-B final fix 1 & 2).
 *
 * Handler errors previously flowed raw (and, earlier, as a message-DERIVED `summary`) into
 * structured logs AND ops.agent_event payloads, so a message built from payload/secret bytes could
 * leak into the append-only, git-provenanced ledger. This reduces an error to a fixed,
 * NON-MESSAGE-DERIVED shape:
 *   - errorClass    a classification from KNOWN_ERROR_CLASSES (unknown -> generic 'Error')
 *   - errorCode     a code proven system-origin (allow-listed errno / genuine pg SQLSTATE) or null
 *   - correlationId a fresh id to cross-reference an out-of-band diagnostic, if any
 *   - messageLength the raw message length only (a signal without the bytes), or -1 if unknowable
 *
 * ROBUSTNESS: sanitizeError must NEVER throw for ANY input — a hostile error object, a throwing
 * getter/Proxy, a cycle, a null-prototype object, an oversized/nested value, a Symbol, a bigint, a
 * primitive. Every property is read via the non-throwing safeRead (own data-descriptor only, never
 * an accessor; the raw value is NEVER String()-coerced, which a null-proto or throwing
 * toString/valueOf would raise on). The whole body is wrapped so that if any internal step still
 * fails, a STATIC fallback shape is returned instead of propagating — a poison job then fails
 * closed to reclaim/retry/dead_letter and can never crash-loop the poll loop.
 */
export function sanitizeError(err) {
  try {
    const msgVal = safeRead(err, 'message');
    const messageLength = typeof msgVal === 'string' ? msgVal.length : -1;
    const ctor = safeRead(err, 'constructor');
    const rawClass = (ctor && safeRead(ctor, 'name')) || 'Error';
    const errorClass = (typeof rawClass === 'string' && KNOWN_ERROR_CLASSES.has(rawClass)) ? rawClass : 'Error';
    return {
      errorClass,
      errorCode: classifyErrorCode(err),
      correlationId: 'corr-' + randomUUID(),
      messageLength,
    };
  } catch {
    return SANITIZE_FALLBACK();
  }
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
