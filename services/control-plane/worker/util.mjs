// BUILD-014 WP-B — small runtime utilities (structured logging + sleep).
//
// Mack discipline: logs are structured (JSON lines) and NEVER carry raw payloads or
// secrets — only pointers/metadata (jobId, queue, workerId, event kind, attempt, a
// payload_hash). A payload may contain governed content; we log its fingerprint, not
// its bytes. Set LOG_LEVEL=silent (or pass { level: 'silent' }) in tests.

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

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
