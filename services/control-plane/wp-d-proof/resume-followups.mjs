// BUILD-002 WP4 — the bounded resumption consumer.
//   node wp-d-proof/resume-followups.mjs            (list open follow-on work for Larry)
//   node wp-d-proof/resume-followups.mjs --json
//
// A matched A/B/C answer (or an accepted learning candidate) creates a governed follow_on_task. This is
// how Larry (or a named specialist) ACTUALLY SEES AND CONTINUES that work when awake: it lists open
// tasks with their full provenance/correlation (which card, which candidate, which source), so the
// in-session Larry model (no paid autonomous runtime) has a concrete, durable work queue to resume from.
// Continuing a task = the command route's close_follow_on (or a status update) — a receipted action.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

export async function listOpenFollowOns(db) {
  return (await db.query(`
    select f.id, f.origin, f.status, f.title, f.detail, f.correlation_id, f.source_candidate_id, f.source_video_id, f.created_at,
           dc.subject         as card_subject,
           lc.recommendation  as candidate_recommendation
      from cockpit.follow_on_task f
      left join cockpit.decision_card dc on dc.id::text = f.correlation_id and f.origin = 'decision_response'
      left join cockpit.learning_candidate lc on lc.id = f.source_candidate_id
     where f.status = 'open'
     order by f.created_at`)).rows;
}

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  const caFile = (env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_SSL_CA_FILE=')) || '').split('=')[1]?.trim();
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: caFile ? { ca: fs.readFileSync(caFile), rejectUnauthorized: true } : { rejectUnauthorized: false } };
}

// CLI (only when run directly)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, '/').replace(/^([a-z]):/i, (m, d) => d.toUpperCase() + ':')) {
  const db = new pg.Client(gatewayDsn());
  await db.connect();
  const open = await listOpenFollowOns(db);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(open, null, 2)); }
  else {
    console.log(`\n${open.length} open follow-on task(s) awaiting Larry:\n`);
    for (const t of open) {
      const src = t.origin === 'decision_response' ? `decision "${t.card_subject ?? t.correlation_id}"` : `learning candidate "${t.candidate_recommendation ?? t.source_candidate_id}"`;
      console.log(`  • [${t.origin}] ${t.title}\n      from ${src}\n      task ${t.id}  (close via command_request close_follow_on)`);
    }
    console.log('');
  }
  await db.end();
}
