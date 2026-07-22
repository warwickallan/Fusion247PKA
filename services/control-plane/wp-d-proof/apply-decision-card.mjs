// BUILD-002 WP4 — decision-card apply worker (cp_worker).
//   node wp-d-proof/apply-decision-card.mjs --drain [--key-prefix=<pfx>] [--allow-send]
// Claims a cockpit.decision_card intent, RENDERS the Telegram card, and writes a receipt.
//
// SAFE BY DEFAULT: it renders + receipts the exact card that WOULD be sent, but sends NOTHING unless
// BOTH dry_run=false on the row AND --allow-send is passed on the CLI. Overnight/synthetic runs never
// pass --allow-send, so no phone is ever pinged as a side-effect of processing the queue. Claim commits
// separately from apply so a poison intent is marked failed, not left requested. Fail-closed on a bad card.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { renderCard } from '../../hub/decision/renderCard.mjs';
import { decisionCallbackData } from '../../hub/decision/telegramInbound.mjs';
import { claimById, claimableWhere } from './claimIntent.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const args = process.argv.slice(2);
const KEYPFX = (args.find((a) => a.startsWith('--key-prefix=')) || '').split('=')[1] || null;
const ALLOW_SEND = args.includes('--allow-send');
const worker = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database,
  user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true } });

// Real send via FusionDevBot (only reached when dry_run=false AND --allow-send). Never overnight.
// The inline keyboard (reply_markup) is passed so the sent card has tappable A/B/C buttons; the sender
// records the resulting Telegram message_id where the transport returns it (for typed-reply correlation;
// button taps already self-correlate via callback_data). larry-ding side-channels the markup as JSON.
function sendTelegram(rendered, replyMarkup) {
  const msgFile = path.join(here, `.decision-card-${Date.now()}.txt`);
  fs.writeFileSync(msgFile, rendered);
  const mkFile = path.join(here, `.decision-card-${Date.now()}.markup.json`);
  fs.writeFileSync(mkFile, JSON.stringify(replyMarkup || {}));
  try {
    const r = spawnSync(process.execPath, ['--env-file=C:/.fusion247/fusion-capture-gateway.env', 'C:/.fusion247/larry-ding.mjs', msgFile, '--reply-markup', mkFile], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'ding failed').trim().split('\n').slice(-1)[0]);
    let message_id = null; try { message_id = JSON.parse(r.stdout).message_id ?? null; } catch {}
    return { sent: true, message_id };
  } finally { try { fs.unlinkSync(msgFile); } catch {} try { fs.unlinkSync(mkFile); } catch {} }
}

async function processOne(cmd) {
  const cx = worker;
  const claimed = await claimById(cx, 'cockpit.decision_card', cmd.id);
  if (claimed.rowCount === 0) return null;
  const willSend = ALLOW_SEND && cmd.dry_run === false;

  // SEND-BEFORE-RECEIPT WINDOW (QA2 point 2): a real send is an external side effect. If a prior attempt
  // already stamped send_attempted_at but the row is still 'claimed' (it crashed before the receipt), we
  // MUST NOT re-send — a duplicate card can't be recalled. Fail closed for manual re-projection.
  if (willSend) {
    const prior = (await cx.query(`select send_attempted_at from cockpit.decision_card where id=$1`, [cmd.id])).rows[0];
    if (prior && prior.send_attempted_at) {
      await cx.query(`update cockpit.decision_card set status='failed', completed_at=now(), receipt=$2::jsonb where id=$1 and status='claimed'`,
        [cmd.id, JSON.stringify({ ok: false, error: 'a previous send attempt did not confirm; NOT re-sending to avoid a duplicate card — re-project manually' })]);
      console.log(`[card] ${cmd.id} -> FAILED (send already attempted; not re-sending)`);
      return { id: cmd.id, ok: false };
    }
    // Durable delivery-attempt record BEFORE the external send (committed, status stays 'claimed').
    await cx.query(`update cockpit.decision_card set send_attempted_at=now() where id=$1`, [cmd.id]);
  }

  await cx.query('begin');
  try {
    const rendered = renderCard({ subject: cmd.subject, body_markdown: cmd.body_markdown, options: cmd.options, related_ref: cmd.related_ref });
    // The card carries actual tappable inline buttons. Each button's callback_data self-correlates the
    // reply to THIS card via `decision:<card_id>:<key>` — so a tap needs no separate message-id map;
    // the inbound mapper (telegramInbound.mapInboundDecision) reads the card_id + choice straight back.
    const reply_markup = { inline_keyboard: cmd.options.map((o) => [{ text: `${o.key} — ${o.label}`, callback_data: decisionCallbackData(cmd.id, o.key) }]) };
    let sendResult = { sent: false, dry_run: true };
    if (willSend) sendResult = { ...sendTelegram(rendered, reply_markup), dry_run: false };
    const receipt = { ok: true, channel: cmd.channel, target: cmd.target, dry_run: !willSend,
      would_send_to: `${cmd.channel}:${cmd.target}`, options_count: cmd.options.length, rendered_card: rendered, reply_markup, ...sendResult };
    await cx.query(`update cockpit.decision_card set status='done', completed_at=now(), receipt=$2::jsonb where id=$1`, [cmd.id, JSON.stringify(receipt)]);
    await cx.query('commit');
    console.log(`[card] ${cmd.id} rendered (${cmd.options.length} options) -> ${willSend ? 'SENT' : 'dry-run (no send)'} (done)`);
    return { id: cmd.id, ok: true };
  } catch (e) {
    await cx.query('rollback');
    await cx.query(`update cockpit.decision_card set status='failed', completed_at=now(), receipt=$2::jsonb where id=$1 and status='claimed'`,
      [cmd.id, JSON.stringify({ ok: false, error: String(e.message) })]);
    console.log(`[card] ${cmd.id} -> FAILED: ${e.message}`);
    return { id: cmd.id, ok: false };
  }
}

async function main() {
  await worker.connect();
  const where = KEYPFX ? `${claimableWhere()} and idempotency_key like $1` : claimableWhere();
  const params = KEYPFX ? [`${KEYPFX}%`] : [];
  const pending = (await worker.query(`select id, requested_by, channel, target, subject, body_markdown, options, related_ref, dry_run from cockpit.decision_card where ${where} order by requested_at asc`, params)).rows;
  if (pending.length) console.log(`[card] ${pending.length} pending decision_card(s)${ALLOW_SEND ? ' [--allow-send ON]' : ''}`);
  for (const cmd of pending) await processOne(cmd);
}
main().catch((e) => { console.error('[card] error', e.message); process.exitCode = 1; }).finally(async () => { await worker.end().catch(() => {}); });
