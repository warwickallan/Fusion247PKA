// BUILD-014 WP-B — small runtime utilities (structured logging + sleep).
//
// Mack discipline: logs are structured (JSON lines) and NEVER carry raw payloads or
// secrets — only pointers/metadata (jobId, queue, workerId, event kind, attempt, a
// payload_hash). A payload may contain governed content; we log its fingerprint, not
// its bytes. Set LOG_LEVEL=silent (or pass { level: 'silent' }) in tests.

import { randomUUID } from 'node:crypto';

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

// A conservative allow-list of characters permitted in the length-capped error summary.
// Anything else (quotes, braces, slashes, control chars — the shapes secrets/paths/URLs
// take) is stripped, so a thrown message can't smuggle a payload/secret fragment into the
// ledger or logs.
const SAFE_SUMMARY = /[^A-Za-z0-9 ._-]/g;
const SUMMARY_CAP = 80;

/**
 * Sanitise a thrown error for the ledger + logs (fix 5 — both reviewers).
 *
 * Handler errors previously flowed raw into structured logs AND ops.agent_event payloads,
 * so a message built from payload/secret bytes could leak into the append-only, potentially
 * git-provenanced ledger. This reduces an error to NON-SENSITIVE metadata:
 *   - errorClass    the constructor name (e.g. 'TypeError', 'Error')
 *   - errorCode     a machine code when present (pg SQLSTATE, Node errno) — codes are safe
 *   - correlationId a fresh id to cross-reference an out-of-band diagnostic, if any
 *   - messageLength the raw length only (a signal without the bytes)
 *   - summary       an allow-list-filtered, length-capped slug — never the raw message
 * The handler contract (README) states handlers MUST NOT rely on full error text being
 * persisted; put any diagnostic detail in explicit, classification-tagged event fields.
 */
export function sanitizeError(err) {
  const rawMsg = err == null ? '' : String(err.message ?? err);
  const summary = rawMsg.replace(SAFE_SUMMARY, '').replace(/\s+/g, ' ').trim().slice(0, SUMMARY_CAP);
  return {
    errorClass: (err && err.constructor && err.constructor.name) || 'Error',
    errorCode: (err && (err.code ?? err.errno)) ?? null,
    correlationId: 'corr-' + randomUUID(),
    messageLength: rawMsg.length,
    summary,
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
