// BUILD-002 WP4 — safe Directus command-route worker (cp_worker).
//   node wp-d-proof/apply-command-request.mjs --drain [--key-prefix=<pfx>]
// Claims a cockpit.command_request intent, VALIDATES it against a fixed allowlist, executes ONLY
// allowlisted commands, and records a result_event + receipt. Anything unknown or malformed fails
// closed — never executed. Claim commits separately from apply so a poison intent is marked failed.
//
// Allowlist (safe by construction):
//   ping {}                      -> zero side effect; emits { pong:true } (proves the queue+receipt path)
//   close_follow_on { task_id }  -> marks a cockpit.follow_on_task done (our own governance table only)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const args = process.argv.slice(2);
const KEYPFX = (args.find((a) => a.startsWith('--key-prefix=')) || '').split('=')[1] || null;
const worker = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database,
  user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: { ca: fs.readFileSync(cfg.ssl_ca_file), rejectUnauthorized: true } });

// Allowlisted command handlers. Each validates its own args and returns a result_event object.
const HANDLERS = {
  async ping() {
    return { event: 'pong', at: 'worker' };
  },
  async close_follow_on(cx, a) {
    const id = a && a.task_id;
    if (typeof id !== 'string' || id.length === 0) throw new Error('close_follow_on requires args.task_id');
    const r = await cx.query(`update cockpit.follow_on_task set status='done', updated_at=now() where id=$1 and status <> 'done' returning id`, [id]);
    const existed = (await cx.query(`select 1 from cockpit.follow_on_task where id=$1`, [id])).rowCount > 0;
    if (!existed) throw new Error(`follow_on_task ${id} not found`);
    return { event: 'follow_on_closed', task_id: id, changed: r.rowCount > 0 };
  },
};

async function processOne(cmd) {
  const cx = worker;
  const claimed = await cx.query(`update cockpit.command_request set status='claimed', claimed_at=now() where id=$1 and status='requested' returning id`, [cmd.id]);
  if (claimed.rowCount === 0) return null;
  await cx.query('begin');
  try {
    const handler = HANDLERS[cmd.command];
    if (!handler) throw new Error(`command not in allowlist: ${cmd.command}`);
    const resultEvent = await handler(cx, cmd.args || {});
    const receipt = { ok: true, command: cmd.command, by: cmd.requested_by };
    await cx.query(`update cockpit.command_request set status='done', completed_at=now(), receipt=$2::jsonb, result_event=$3::jsonb where id=$1`,
      [cmd.id, JSON.stringify(receipt), JSON.stringify(resultEvent)]);
    await cx.query('commit');
    console.log(`[cmd] ${cmd.command} ${cmd.id} -> done`);
    return { id: cmd.id, ok: true };
  } catch (e) {
    await cx.query('rollback');
    await cx.query(`update cockpit.command_request set status='failed', completed_at=now(), receipt=$2::jsonb where id=$1 and status='claimed'`,
      [cmd.id, JSON.stringify({ ok: false, error: String(e.message), command: cmd.command })]);
    console.log(`[cmd] ${cmd.command} ${cmd.id} -> FAILED: ${e.message}`);
    return { id: cmd.id, ok: false };
  }
}

async function main() {
  await worker.connect();
  const where = KEYPFX ? `status='requested' and idempotency_key like $1` : `status='requested'`;
  const params = KEYPFX ? [`${KEYPFX}%`] : [];
  const pending = (await worker.query(`select id, requested_by, command, args from cockpit.command_request where ${where} order by requested_at asc`, params)).rows;
  if (pending.length) console.log(`[cmd] ${pending.length} pending command_request(s)`);
  for (const c of pending) await processOne(c);
}
main().catch((e) => { console.error('[cmd] error', e.message); process.exitCode = 1; }).finally(async () => { await worker.end().catch(() => {}); });
