// IDEA-007 FR-029 — REAL-SOURCE acceptance proof using the existing BUILD-002 governance machinery.
// Prerequisite: generate source candidates with services/obsidiwikai/src/bin/suggest-system.mjs.
//
// Usage: node wp-d-proof/prove-idea007-system-loop.mjs --source=<video-id>
// This intentionally leaves the real candidate decisions + accepted follow-on durable for Warwick.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { listOpenFollowOns } from './resume-followups.mjs';
import { resolveActionCandidate } from './candidate-resolver.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const sourceId = (process.argv.find((arg) => arg.startsWith('--source=')) || '').split('=')[1];
if (!sourceId) { console.error('usage: --source=<video-id>'); process.exit(2); }
const ssl = { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true };
const runKey = `idea007-fr029-${Date.now()}`;

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const url = new URL(env.split(/\r?\n/).find((line) => line.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  return { host: url.hostname, port: Number(url.port || 5432), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: (url.pathname || '/postgres').slice(1), ssl };
}

const admin = new pg.Client(gatewayDsn());
const cockpit = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database,
  user: cfg.pooler_user, password: cfg.password, ssl });
let passed = 0;
let failed = 0;
const check = (condition, message) => {
  if (condition) { passed++; console.log('  PASS', message); }
  else { failed++; console.log('  FAIL', message); }
};

function runWorker() {
  const result = spawnSync(process.execPath, [path.join(here, 'apply-learning-command.mjs'), '--drain', `--key-prefix=${runKey}`], { encoding: 'utf8' });
  process.stdout.write(result.stdout.split('\n').filter((line) => line.includes('[learn]')).map((line) => `    ${line}`).join('\n') + '\n');
  if (result.status !== 0) throw new Error(`learning worker exited ${result.status}`);
}

async function main() {
  await admin.connect();
  await cockpit.connect();
  const source = (await admin.query(`select title from cockpit.youtube_source where video_id=$1`, [sourceId])).rows[0];
  if (!source) throw new Error(`source ${sourceId} not found`);
  const candidates = (await admin.query(
    `select * from cockpit.learning_candidate where source_video_id=$1 and candidate_scope='system_improvement' order by sort`, [sourceId],
  )).rows;
  if (candidates.length < 2) throw new Error('acceptance proof needs at least two real source-grounded candidates (A accept, B dismiss)');
  const accepted = candidates[0];
  const dismissed = candidates[1];

  console.log(`\n1) REAL learned source -> grounded candidate (${source.title}):`);
  check(accepted.candidate_ref === `OWAI:${sourceId}:A`, 'stable Action A reference is deterministic');
  for (const field of ['recommendation', 'why', 'evidence', 'proposed_target', 'expected_effect', 'confidence', 'risk', 'next_step']) {
    check(String(accepted[field] || '').trim().length > 0, `Action A includes ${field}`);
  }
  check(!/use more ai|improve automation|consider agents/i.test(accepted.recommendation), 'candidate is specific, not generic filler');

  console.log('\n2) Warwick ACCEPT -> existing learning_command -> correlated follow_on_task:');
  await cockpit.query(
    `insert into cockpit.learning_command (requested_by,command,candidate_id,note,idempotency_key)
     values ('acceptance:warwick','accept',$1,'FR-029 real-source acceptance proof',$2)`,
    [accepted.id, `${runKey}-accept`],
  );
  runWorker();
  const command = (await admin.query(`select status,receipt from cockpit.learning_command where idempotency_key=$1`, [`${runKey}-accept`])).rows[0];
  const task = (await admin.query(`select * from cockpit.follow_on_task where source_candidate_id=$1 and origin='learning_accept'`, [accepted.id])).rows[0];
  check(command.status === 'done' && command.receipt?.follow_on_task_id, 'Accept command completed with follow_on_task receipt');
  check(task?.status === 'open' && task.source_video_id === sourceId, 'one open task is correlated to candidate + source');
  for (const phrase of [accepted.candidate_ref, 'Source / graph evidence:', 'Expected effect:', 'Risk / what would invalidate it:', 'Concrete next step:', 'Warwick approval:']) {
    check(task?.detail?.includes(phrase), `Larry handoff includes ${phrase}`);
  }

  console.log('\n3) Existing Larry resume consumer sees the exact governed work:');
  const open = await listOpenFollowOns(admin);
  const resumed = open.find((item) => String(item.id) === String(task.id));
  check(Boolean(resumed), 'resume-followups returns the accepted task');
  check(resumed?.candidate_ref === accepted.candidate_ref && resumed?.candidate_evidence === accepted.evidence,
    'resume payload retains durable ref + exact evidence');
  const phrase = `Action A from ${source.title} report`;
  const resolved = await resolveActionCandidate(admin, phrase);
  check(String(resolved.id) === String(accepted.id), `fallback phrase resolves unambiguously: ${phrase}`);

  console.log('\n4) Warwick DISMISS -> no follow-on work:');
  await cockpit.query(
    `insert into cockpit.learning_command (requested_by,command,candidate_id,note,idempotency_key)
     values ('acceptance:warwick','decline',$1,'FR-029 dismiss proof',$2)`,
    [dismissed.id, `${runKey}-dismiss`],
  );
  runWorker();
  const dismissState = (await admin.query(`select status from cockpit.learning_candidate where id=$1`, [dismissed.id])).rows[0]?.status;
  const dismissTasks = (await admin.query(`select count(*)::int n from cockpit.follow_on_task where source_candidate_id=$1`, [dismissed.id])).rows[0].n;
  check(dismissState === 'declined', 'Action B is durably dismissed');
  check(dismissTasks === 0, 'Dismiss created NO follow_on_task');

  console.log('\n5) No canonical MyPKA mutation:');
  const git = spawnSync('git', ['status', '--porcelain', '--', 'PKM'], { cwd: path.resolve(here, '..', '..', '..'), encoding: 'utf8' });
  check(git.status === 0 && git.stdout.trim() === '', 'PKM/ has no working-tree mutation from Accept/Dismiss');

  console.log(`\nRESULT: ${failed === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${passed} passed, ${failed} failed`);
  console.log(JSON.stringify({ source_id: sourceId, source_title: source.title, accepted_candidate: accepted.candidate_ref,
    accepted_candidate_id: accepted.id, follow_on_task_id: task?.id, dismiss_candidate: dismissed.candidate_ref,
    accept_receipt: command.receipt }, null, 2));
}

main().catch((error) => { console.error('[idea007-proof] error', error.message); failed++; })
  .finally(async () => { await admin.end().catch(() => {}); await cockpit.end().catch(() => {}); process.exit(failed === 0 ? 0 : 1); });
