// Fusion247 Cockpit — bounded DB access. The standalone Warwick-facing app NEVER holds the service
// role. It reads + inserts governed intents as cp_directus (SELECT + insert-intent-only) and applies
// its OWN surface lifecycle (attention_item.status) as cp_worker (the execute role). Module data
// (obsidiwikai.*, asdair.*) is only ever touched through the existing governed intent → worker path.
// Creds live in the gitignored live-runtime file; never in git.
import fs from 'node:fs';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const CREDS = process.env.COCKPIT_CREDS
  || 'C:/Fusion247PKA/services/control-plane/wp-d-proof/.runtime-live/directus-live.env.json';
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
