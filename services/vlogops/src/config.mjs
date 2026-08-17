// BUILD-006 Phase 1 — configuration, validated once and loudly.
//
// The failure this shape exists to prevent is a service that starts with a silently wrong
// environment and fails later, somewhere else, in a way that reads as a different bug. So
// every problem is accumulated and reported TOGETHER: one error naming every missing or
// malformed variable, not the first one encountered.
//
// NO VALUE IS EVER READ FROM A FILE INSIDE THIS REPOSITORY, and nothing here opens
// anything in the machine's secrets store. Real values reach the process as environment
// variables — `node --env-file=<path outside this repo>` is the estate convention, and the
// placement of that file belongs to whoever operates the service, never to this code.
// `.env.example` in this directory documents variable NAMES and nothing else.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The service's own directory — `services/vlogops`. */
export const SERVICE_ROOT = path.dirname(__dirname);

// Non-negotiables. These are module constants rather than environment variables because
// nothing operational should be able to widen them: a bundle budget that an env var can
// raise is not a budget, and "smallest sufficient" would stop meaning anything.
export const BUNDLE_MAX_ARTEFACTS = 12;
export const BUNDLE_MAX_BYTES = 2 * 1024 * 1024;
export const SNAPSHOT_MAX_INLINE_BYTES = 1 * 1024 * 1024;

/** The identity algorithm label written into every seed row. Bump it if the manifest shape changes. */
export const MANIFEST_ALGO = 'sha256-canonical-json-v1';

/** The Route 1 selection rule label written into every manifest. Bump it if the rule changes. */
export const SELECTION_RULE_VERSION = 'records-smallest-sufficient-v1';

function requireDsn(env, name, errors) {
  const raw = env[name];
  if (!raw || raw.trim() === '') {
    errors.push(`${name} is required (a Postgres connection string) and is unset or empty`);
    return null;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    errors.push(`${name} is not a valid URL`);
    return null;
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    errors.push(`${name} must be a postgres:// or postgresql:// URL (got ${parsed.protocol}//…)`);
    return null;
  }
  return raw;
}

function optionalDirectory(env, name, fallback, errors) {
  const raw = env[name];
  const resolved = raw && raw.trim() !== '' ? path.resolve(raw) : fallback;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    errors.push(`${name} must be an existing directory (resolved to ${resolved})`);
    return resolved;
  }
  return resolved;
}

/**
 * Validate the environment and return the config, or throw ONE aggregated error naming
 * every problem found. Never returns a partially-valid config.
 */
export function loadConfig(env = process.env) {
  const errors = [];

  // The ONLY database variable. There is deliberately no second DSN, no read-only
  // companion and no fallback: a service with two ways to reach its store has two ways
  // to reach the wrong one.
  const databaseUrl = requireDsn(env, 'VLOGOPS_DB_URL', errors);

  // Route 1 reads existing records out of the working tree. This is a path, not a secret,
  // and it defaults to the repository this service lives in.
  const repoRoot = optionalDirectory(
    env,
    'VLOGOPS_REPO_ROOT',
    path.dirname(path.dirname(SERVICE_ROOT)),
    errors,
  );

  if (errors.length > 0) {
    const err = new Error(`vlogops: invalid configuration\n  - ${errors.join('\n  - ')}`);
    err.code = 'EVLOGOPSCONFIG';
    err.problems = errors;
    throw err;
  }

  return {
    databaseUrl,
    repoRoot,
    serviceRoot: SERVICE_ROOT,
    migrationsDir: path.join(SERVICE_ROOT, 'db'),
    bundleMaxArtefacts: BUNDLE_MAX_ARTEFACTS,
    bundleMaxBytes: BUNDLE_MAX_BYTES,
    snapshotMaxInlineBytes: SNAPSHOT_MAX_INLINE_BYTES,
  };
}
