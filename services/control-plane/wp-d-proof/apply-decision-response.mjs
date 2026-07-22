// BUILD-002 WP4 — inbound decision-response apply worker (cp_worker).
//   node wp-d-proof/apply-decision-response.mjs --drain [--key-prefix=<pfx>]
// Claims a cockpit.decision_response intent, parses the raw reply against ITS card's options (never
// guesses), records the durable correlated decision, and on a match creates governed follow-on work.
// A no-match completes done+matched=false (the human re-answers); only an unknown card fails. Claim
// commits separately from apply so a poison intent is marked failed, not left requested.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { parseChoice } from '../../hub/decision/parseChoice.mjs';
import { claimById, claimableWhere } from './claimIntent.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const args = process.argv.slice(2);
const KEYPFX = (args.find((a) => a.startsWith('--key-prefix=')) || '').split('=')[1] || null;
const worker = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database,
  user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true } });

async function processOne(resp) {
  const cx = worker;
  const claimed = await claimById(cx, 'cockpit.decision_response', resp.id);
  if (claimed.rowCount === 0) return null;
  await cx.query('begin');
  try {
    const card = (await cx.query(`select id, subject, options, related_ref, requested_by from cockpit.decision_card where id=$1`, [resp.card_id])).rows[0];
    if (!card) throw new Error('decision_card not found for response');
    const choice = parseChoice(resp.raw_text, card.options);

    if (!choice.ok) {
      const receipt = { ok: true, matched: false, reason: choice.reason, card_id: card.id };
      await cx.query(`update cockpit.decision_response set status='done', completed_at=now(), receipt=$2::jsonb where id=$1`, [resp.id, JSON.stringify(receipt)]);
      await cx.query('commit');
      console.log(`[resp] ${resp.id} no-match (${choice.reason}) -> done (re-answerable)`);
      return { id: resp.id, ok: true, matched: false };
    }

    // A decision_card is DECIDED ONCE. CONCURRENCY-SAFE (QA2 finding A): the partial unique index on
    // (correlation_id, origin) for decision_response tasks means the INSERT is the ONE authoritative
    // create — two response intents for the same card on two connections can never both insert. The
    // connection that wins the insert records applied:true; any other (concurrent OR a later re-answer)
    // gets DO NOTHING and records applied:false + already_decided honestly, so the durable task and every
    // receipt always agree (no A-vs-B disagreement, no duplicate task).
    const title = `Decision: ${String(card.subject).slice(0, 90)} → ${choice.key} (${choice.label})`;
    const detail = `Warwick chose ${choice.key} — ${choice.label} for "${card.subject}".${card.related_ref ? `\n\nref: ${card.related_ref}` : ''}`;
    const ins = await cx.query(
      `insert into cockpit.follow_on_task (origin, correlation_id, title, detail, created_by)
       values ('decision_response',$1,$2,$3,$4)
       on conflict (correlation_id, origin) where origin = 'decision_response' and correlation_id is not null do nothing
       returning id`,
      [card.id, title, detail, resp.responder]);
    let receipt;
    if (ins.rows[0]) {
      receipt = { ok: true, matched: true, applied: true, chosen_key: choice.key, chosen_label: choice.label, card_id: card.id, follow_on_task_id: ins.rows[0].id };
    } else {
      const prior = (await cx.query(`select id, title from cockpit.follow_on_task where correlation_id=$1 and origin='decision_response'`, [card.id])).rows[0];
      const originalKey = (/→ ([A-Za-z0-9]+) \(/.exec(prior?.title || '') || [])[1] ?? null;
      receipt = { ok: true, matched: true, applied: false, already_decided: true, same_choice: choice.key === originalKey, chosen_key: choice.key, chosen_label: choice.label, original_choice: originalKey, card_id: card.id, follow_on_task_id: prior?.id ?? null };
    }
    await cx.query(`update cockpit.decision_response set chosen_key=$2, chosen_label=$3, status='done', completed_at=now(), receipt=$4::jsonb where id=$1`,
      [resp.id, choice.key, choice.label, JSON.stringify(receipt)]);
    await cx.query('commit');
    console.log(`[resp] ${resp.id} matched ${choice.key} (${choice.label}) -> done + follow_on ${receipt.follow_on_task_id}${receipt.applied === false ? ' (already decided; not re-applied)' : ''}`);
    return { id: resp.id, ok: true, matched: true };
  } catch (e) {
    await cx.query('rollback');
    await cx.query(`update cockpit.decision_response set status='failed', completed_at=now(), receipt=$2::jsonb where id=$1 and status='claimed'`,
      [resp.id, JSON.stringify({ ok: false, error: String(e.message) })]);
    console.log(`[resp] ${resp.id} -> FAILED: ${e.message}`);
    return { id: resp.id, ok: false };
  }
}

async function main() {
  await worker.connect();
  const where = KEYPFX ? `${claimableWhere()} and idempotency_key like $1` : claimableWhere();
  const params = KEYPFX ? [`${KEYPFX}%`] : [];
  const pending = (await worker.query(`select id, card_id, responder, raw_text from cockpit.decision_response where ${where} order by requested_at asc`, params)).rows;
  if (pending.length) console.log(`[resp] ${pending.length} pending decision_response(s)`);
  for (const r of pending) await processOne(r);
}
main().catch((e) => { console.error('[resp] error', e.message); process.exitCode = 1; }).finally(async () => { await worker.end().catch(() => {}); });
