// BUILD-002 WP4 — the bounded resumption consumer.
//   node wp-d-proof/resume-followups.mjs
//   node wp-d-proof/resume-followups.mjs --json
//   node wp-d-proof/resume-followups.mjs --resolve="Action A from the Cerebras report"
//
// Accepted learning candidates create governed follow_on_task rows. This is the durable,
// queryable queue Larry reads in-session. Completion still uses command_request close_follow_on,
// producing a result event + receipt rather than a direct, unreceipted table write.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { resolveActionCandidate } from './candidate-resolver.mjs';

export async function listOpenFollowOns(db) {
  return (await db.query(`
    select f.id, f.origin, f.status, f.title, f.detail, f.correlation_id, f.source_candidate_id,
           f.source_video_id, f.created_at, dc.subject as card_subject,
           lc.candidate_ref, lc.candidate_scope, lc.candidate_kind,
           lc.recommendation as candidate_recommendation, lc.why as candidate_why,
           lc.evidence as candidate_evidence, lc.expected_effect, lc.confidence,
           lc.risk, lc.next_step, ys.title as source_title
      from cockpit.follow_on_task f
      left join cockpit.decision_card dc on dc.id::text = f.correlation_id and f.origin = 'decision_response'
      left join cockpit.learning_candidate lc on lc.id = f.source_candidate_id
      left join cockpit.youtube_source ys on ys.video_id = f.source_video_id
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

function printCandidate(c) {
  console.log(`\n${c.candidate_ref} — ${c.recommendation}`);
  console.log(`  source: ${c.source_title || c.source_video_id}`);
  console.log(`  target/category: ${c.proposed_target || '—'} / ${c.candidate_kind || '—'}`);
  console.log(`  evidence: ${c.evidence || '—'}`);
  console.log(`  why: ${c.why || '—'}`);
  console.log(`  expected effect: ${c.expected_effect || '—'}`);
  console.log(`  confidence: ${c.confidence || '—'}`);
  console.log(`  risk: ${c.risk || '—'}`);
  console.log(`  next: ${c.next_step || '—'}`);
  console.log(`  status: ${c.status}\n`);
}

// CLI (only when run directly)
if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const db = new pg.Client(gatewayDsn());
  await db.connect();
  const resolveArg = process.argv.find((arg) => arg.startsWith('--resolve='));
  if (resolveArg) {
    const phrase = resolveArg.slice('--resolve='.length).replace(/^['"]|['"]$/g, '');
    const candidate = await resolveActionCandidate(db, phrase);
    if (process.argv.includes('--json')) console.log(JSON.stringify(candidate, null, 2));
    else printCandidate(candidate);
  } else {
    const open = await listOpenFollowOns(db);
    if (process.argv.includes('--json')) { console.log(JSON.stringify(open, null, 2)); }
    else {
      console.log(`\n${open.length} open follow-on task(s) awaiting Larry:\n`);
      for (const t of open) {
        const src = t.origin === 'decision_response'
          ? `decision "${t.card_subject ?? t.correlation_id}"`
          : `learning candidate "${t.candidate_ref ?? t.candidate_recommendation ?? t.source_candidate_id}"`;
        console.log(`  • [${t.origin}] ${t.title}\n      from ${src}\n      task ${t.id}  (close via command_request close_follow_on)`);
        if (t.candidate_scope === 'system_improvement') console.log(`\n${t.detail}\n`);
      }
      console.log('');
    }
  }
  await db.end();
}
