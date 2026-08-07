// Fusion247 Cockpit — bounded DB access. The standalone Warwick-facing app NEVER holds the service
// role. It reads + inserts governed intents as cp_directus (SELECT + insert-intent-only) and applies
// its OWN surface lifecycle (attention_item.status) as cp_worker (the execute role). Module data
// (obsidiwikai.*, asdair.*) is only ever touched through the existing governed intent → worker path.
// Creds live in the gitignored live-runtime file; never in git.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// `pg` AND the credentials default are resolved RELATIVE TO THIS MODULE, never against a named
// checkout. Both were once absolute paths into one clone. That bound the Cockpit to that clone —
// and, the part that actually bit, it let a Cockpit started from ANY OTHER checkout silently borrow
// that clone's dependency tree and its LIVE CREDENTIALS. A checkout without them now fails loudly at
// import instead, which is the behaviour "survives worktree delete/recreate" was always claiming.
// (Veritas Defect 6, unparked by Warwick 2026-08-07.)
//
// `createRequire`, deliberately, NOT a relative `import`: provenance.mjs derives the cockpit source
// closure from RELATIVE IMPORT SPECIFIERS, so a relative `import` here would pull node_modules into
// that closure, break the declared SOURCE_MODULES list and turn provenance-check.mjs red. Established
// by executing relativeImports() on both forms, not by reasoning about it. Keep this form.
// services/cockpit/clone-portability-check.mjs is the gate that holds both properties.
const require = createRequire(import.meta.url);
const pg = require('../control-plane/node_modules/pg/lib/index.js');

const CREDS = process.env.COCKPIT_CREDS
  || fileURLToPath(new URL('../control-plane/wp-d-proof/.runtime-live/directus-live.env.json', import.meta.url));
const C = JSON.parse(fs.readFileSync(CREDS, 'utf8'));
const ca = fs.readFileSync(C.ssl_ca_file);
const base = { host: C.host, port: C.port, database: C.database, ssl: { ca, rejectUnauthorized: true } };

// cp_directus — reads + inserts governed intents. Cannot mutate module data.
const readPool = new pg.Pool({ ...base, user: C.pooler_user, password: C.password, max: 4 });
// cp_worker — applies the cockpit's own surface lifecycle (status transitions) + intent execution.
const workPool = new pg.Pool({ ...base, user: C.worker_pooler_user, password: C.worker_password, max: 3 });

export const q = (text, params) => readPool.query(text, params);
export const w = (text, params) => workPool.query(text, params);
export async function close() { await Promise.allSettled([readPool.end(), workPool.end()]); }
