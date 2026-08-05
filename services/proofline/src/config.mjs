// Proofline — configuration schema and validation-at-startup.
//
// Keel owns the schema and the fail-fast; the operator owns the values. There
// are no credentials here and there never will be — Proofline has no external
// dependency to authenticate to.
//
// D-8: the bind host is `127.0.0.1` and is NOT configurable. Never the default
// all-interfaces bind, and no environment variable may widen it.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVICE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Loopback only. Deliberately a constant, not an option. */
export const HOST = '127.0.0.1';
export const DEFAULT_PORT = 7317;
export const DEFAULT_SCAN_INTERVAL_MS = 1000;

/** Map §5.5 — two distinct limits, with distinct messages. */
export const TEXT_LIMIT_BYTES = 1048576; // 1 MiB of text
export const BODY_LIMIT_BYTES = 2097152; // 2 MiB of request body

function intFromEnv(env, name, fallback, min, max, errors) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) {
    errors.push(`${name} must be a non-negative integer (got ${JSON.stringify(raw)})`);
    return fallback;
  }
  const n = Number(raw);
  if (n < min || n > max) {
    errors.push(`${name} must be between ${min} and ${max} (got ${n})`);
    return fallback;
  }
  return n;
}

/**
 * Validate the environment and return the config. Throws LOUDLY on the first
 * malformed value rather than starting with a silently wrong one.
 */
export function loadConfig(env = process.env) {
  const errors = [];

  // 0 is legal and means "let the OS choose an ephemeral port" — the test
  // harness relies on it so parallel runs cannot collide on 7317.
  const port = intFromEnv(env, 'PROOFLINE_PORT', DEFAULT_PORT, 0, 65535, errors);
  const scanIntervalMs = intFromEnv(env, 'PROOFLINE_SCAN_INTERVAL_MS', DEFAULT_SCAN_INTERVAL_MS, 10, 3600000, errors);

  const dataDir = env.PROOFLINE_DATA_DIR ? path.resolve(env.PROOFLINE_DATA_DIR) : path.join(SERVICE_ROOT, '.data');

  if (errors.length > 0) {
    const err = new Error(`proofline: invalid configuration\n  - ${errors.join('\n  - ')}`);
    err.code = 'EPROOFLINECONFIG';
    throw err;
  }

  return {
    host: HOST,
    port,
    dataDir,
    journalPath: path.join(dataDir, 'journal.jsonl'),
    publicDir: path.join(SERVICE_ROOT, 'public'),
    scanIntervalMs,
    textLimitBytes: TEXT_LIMIT_BYTES,
    bodyLimitBytes: BODY_LIMIT_BYTES,
  };
}
