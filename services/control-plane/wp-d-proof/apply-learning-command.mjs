// BUILD-002 WP3 — learning Accept/Decline apply worker (cp_worker).
//   node wp-d-proof/apply-learning-command.mjs --drain [--key-prefix=<pfx>]
// Claims a cockpit.learning_command intent and applies the decision to learning_candidate.status
// (accept->accepted, decline->declined, defer->deferred) + writes a receipt. Accept records a durable
// decision only; it does not rewrite any governed material. Claim commits separately from apply so a
// poison intent is marked failed, not left requested. Fail-closed on a missing candidate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { claimById, claimableWhere } from './claimIntent.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const args = process.argv.slice(2);
const KEYPFX = (args.find((a) => a.startsWith('--key-prefix=')) || '').split('=')[1] || null;
const worker = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database,
  user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true } });

const NEW_STATUS = { accept: 'accepted', decline: 'declined', defer: 'deferred' };

async function processOne(cmd) {
  const cx = worker;
  const claimed = await claimById(cx, 'cockpit.learning_command', cmd.id);
  if (claimed.rowCount === 0) return null;
  await cx.query('begin');
  try {
    const cand = (await cx.query(`select id, status, source_video_id, correlation_id, recommendation, why, proposed_target from cockpit.learning_candidate where id=$1 for update`, [cmd.candidate_id])).rows[0];
    if (!cand) throw new Error('learning_candidate not found');
    const prevStatus = cand.status;
    const target = NEW_STATUS[cmd.command];
    await cx.query(`update cockpit.learning_candidate set status=$2, updated_at=now() where id=$1`, [cmd.candidate_id, target]);

    // WP3: ACCEPT creates governed FOLLOW-ON WORK, never a silent edit of protected material. A durable,
    // correlated task is recorded (unique per candidate+origin, so a re-applied accept never multiplies
    // it); Larry/Warwick action it deliberately.
    let followOnId = null;
    let droppedTaskId = null;
    if (cmd.command === 'accept') {
      const detail = `${cand.recommendation}${cand.why ? `\n\nWhy: ${cand.why}` : ''}`;
      const fo = await cx.query(
        `insert into cockpit.follow_on_task (origin, source_candidate_id, source_video_id, correlation_id, title, detail, proposed_target, created_by)
         values ('learning_accept',$1,$2,$3,$4,$5,$6,$7)
         on conflict (source_candidate_id, origin) where source_candidate_id is not null do nothing
         returning id`,
        [cand.id, cand.source_video_id, cand.correlation_id, String(cand.recommendation).slice(0, 120), detail, cand.proposed_target, cmd.requested_by]);
      if (fo.rows[0]) { followOnId = fo.rows[0].id; }
      else {
        // A task already exists for this candidate. If a prior decline DROPPED it, a RE-ACCEPT must
        // REOPEN it (QA2 call-A finding: else the candidate is accepted with no open task). A 'done'
        // task (the work was already completed) is left as-is. Return whichever id applies.
        const existing = (await cx.query(`select id, status from cockpit.follow_on_task where source_candidate_id=$1 and origin='learning_accept'`, [cand.id])).rows[0];
        if (existing && existing.status === 'dropped') await cx.query(`update cockpit.follow_on_task set status='open', updated_at=now() where id=$1`, [existing.id]);
        followOnId = existing?.id ?? null;
      }
    } else if (prevStatus === 'accepted') {
      // QA2 finding B — CORRECTION SEMANTICS: moving AWAY from accepted (decline/defer) must not leave a
      // contradictory OPEN acceptance task in Larry's resume queue. Drop it in the SAME transaction and
      // record the previous→new decision in the receipt. Only OPEN tasks are dropped (a completed task stands).
      const dropped = await cx.query(
        `update cockpit.follow_on_task set status='dropped', updated_at=now()
          where source_candidate_id=$1 and origin='learning_accept' and status='open' returning id`, [cand.id]);
      droppedTaskId = dropped.rows[0]?.id ?? null;
    }
    const receipt = { ok: true, action: cmd.command, candidate_id: cmd.candidate_id, prev_status: prevStatus, new_status: target, by: cmd.requested_by, note: cmd.note ?? null, follow_on_task_id: followOnId, dropped_follow_on_task_id: droppedTaskId };
    await cx.query(`update cockpit.learning_command set status='done', completed_at=now(), receipt=$2::jsonb where id=$1`, [cmd.id, JSON.stringify(receipt)]);
    await cx.query('commit');
    console.log(`[learn] ${cmd.command} candidate ${cmd.candidate_id} -> ${target} (done)`);
    return { id: cmd.id, ok: true };
  } catch (e) {
    await cx.query('rollback');
    await cx.query(`update cockpit.learning_command set status='failed', completed_at=now(), receipt=$2::jsonb where id=$1 and status='claimed'`,
      [cmd.id, JSON.stringify({ ok: false, error: String(e.message), candidate_id: cmd.candidate_id })]);
    console.log(`[learn] ${cmd.command} candidate ${cmd.candidate_id} -> FAILED: ${e.message}`);
    return { id: cmd.id, ok: false };
  }
}

async function main() {
  await worker.connect();
  const where = KEYPFX ? `${claimableWhere()} and idempotency_key like $1` : claimableWhere();
  const params = KEYPFX ? [`${KEYPFX}%`] : [];
  const pending = (await worker.query(`select id, requested_by, command, candidate_id, note from cockpit.learning_command where ${where} order by requested_at asc`, params)).rows;
  if (pending.length) console.log(`[learn] ${pending.length} pending learning_command(s)`);
  for (const cmd of pending) await processOne(cmd);
}
main().catch((e) => { console.error('[learn] error', e.message); process.exitCode = 1; }).finally(async () => { await worker.end().catch(() => {}); });
