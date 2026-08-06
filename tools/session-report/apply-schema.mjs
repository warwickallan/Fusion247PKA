#!/usr/bin/env node
/**
 * Authorised schema-application route for session_report.*
 *
 * Thin wrapper around populate.mjs --apply-schema so the production caller
 * is a named, documented entrypoint (not only an incidental flag).
 *
 * Usage:
 *   node tools/session-report/apply-schema.mjs
 *
 * Credentials: self-loaded from C:/.fusion247/fusion-capture-gateway.env
 * (DATABASE_URL). Same ding pattern as tools/governor/ding.mjs and populate.mjs.
 * No --env-file. No process.env export of secrets.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const populate = join(here, 'populate.mjs');

const r = spawnSync(process.execPath, [populate, '--apply-schema'], {
  encoding: 'utf8',
  stdio: 'inherit',
  windowsHide: true,
});
process.exit(r.status == null ? 1 : r.status);
