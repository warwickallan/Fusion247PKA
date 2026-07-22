// BUILD-002 WP4 — build the live decision-inbound filer for the gateway (cp_directus, least-privilege).
//
// Constructs the (update)->Promise filer that liveRunner calls on a `decision:*` button tap, backed by a
// cp_directus connection (INSERT-intent-only) and the authorised Telegram user id (defence-in-depth on
// top of the gateway's toCallback allowlist). Kept out of the gateway's static import graph — main()
// imports it dynamically only when HUB_DECISION_INBOUND=1. Returns { filer, close }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileInboundDecision } from './file-inbound-decision.mjs';

export async function buildDecisionFiler({ authorizedUserId } = {}) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
  const { default: pg } = await import('file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js');
  const client = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database,
    user: cfg.pooler_user, password: cfg.password, ssl: { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true } });
  await client.connect();
  return {
    filer: (update) => fileInboundDecision(client, update, { authorizedUserId }),
    close: () => client.end().catch(() => {}),
  };
}
