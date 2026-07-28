// =====================================================================
// BUILD-015 AsdAIr browser runner - THE PROOF HARNESS.
//
// Everything RUNNER-PROOF.md claims was produced with this file, so the proof
// is reproducible rather than anecdotal. It does three jobs and nothing else:
//
//   snapshot   read the live trolley EXACTLY as it stands, before anything
//   seed       create/reset a synthetic browser_build_request to run against
//   show       print the durable row + lease as the database actually holds it
//
// It deliberately has NO restore command that guesses. Restoring the trolley is
// done by running the runner itself with an explicit set_quantity plan back to
// the recorded starting numbers, so the restore uses the same audited path as
// the build and is recorded in the same durable row.
//
//   node --env-file=<env file> proofkit.cjs snapshot
//   node --env-file=<env file> proofkit.cjs seed <shop-ref> <plan.json>
//   node --env-file=<env file> proofkit.cjs show [request-id]
// =====================================================================
'use strict';

const fs = require('node:fs');
const store = require('./store.cjs');
const lease = require('./lease.cjs');
const P = require('./progress.cjs');

async function snapshot() {
  const { Session } = require('./browser.cjs');
  const s = new Session({ log: () => {} });
  await s.open();
  const state = await s.state();
  let basket = null;
  if (!state.reauth_required && !state.rate_limited) basket = await s.read_basket();
  s.close();
  console.log(JSON.stringify({ at: new Date().toISOString(), page: state, basket }, null, 2));
  return 0;
}

/**
 * Create (or reset to queued) one synthetic request carrying `plan`.
 * Synthetic on purpose: no real weekly shop is disturbed by a proof run.
 */
async function seed(shopRef, planPath) {
  if (!shopRef || !planPath) throw new Error('usage: proofkit.cjs seed <shop-ref> <plan.json>');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  require('./commands.cjs').validatePlan(plan);
  const q = store.writeQuery();
  try {
    const shop = (await q(
      `insert into asdair.shop (household_id, shop_ref, status, source_kind, raw_text)
       values (1, $1, 'WAITING_FOR_BROWSER', 'text', 'synthetic proof run - BUILD-015 browser runner')
       on conflict (household_id, shop_ref) do update set status = 'WAITING_FOR_BROWSER', updated_at = now()
       returning id, shop_ref, status`, [shopRef])).rows[0];

    const existing = (await q(`select id from asdair.browser_build_request where shop_id = $1::bigint order by id desc limit 1`, [shop.id])).rows[0];
    let req;
    if (existing) {
      req = (await q(
        `update asdair.browser_build_request
            set status='queued', claimed_by=null, finished_at=null, last_error=null,
                progress = jsonb_build_object('plan', $2::jsonb), requested_at = now()
          where id = $1::bigint returning id, shop_id, status`, [existing.id, JSON.stringify(plan)])).rows[0];
    } else {
      req = (await q(
        `insert into asdair.browser_build_request (shop_id, status, progress)
         values ($1::bigint, 'queued', jsonb_build_object('plan', $2::jsonb))
         returning id, shop_id, status`, [shop.id, JSON.stringify(plan)])).rows[0];
    }
    console.log(JSON.stringify({ shop, request: req, steps: plan.length }, null, 2));
  } finally { await q.end(); }
  return 0;
}

async function show(id) {
  const q = store.readQuery();
  try {
    const rows = await lease.peek(q, { requestId: id || null });
    const list = Array.isArray(rows) ? rows : [rows].filter(Boolean);
    for (const r of list) {
      console.log(JSON.stringify({
        id: r.id, shop_id: r.shop_id, status: r.status, claimed_by: r.claimed_by,
        lease: (r.progress && r.progress._lease) || null,
        lease_expired: r.lease_expired,
        released_reason: r.progress && r.progress._released_reason,
        in_flight: r.progress && r.progress._in_flight,
        completed_step_ids: (P.normalise(r.progress)._completed_steps || []).map((s) => s.step_id),
        summary: P.summary(r.progress),
        last_error: r.last_error,
      }, null, 2));
    }
  } finally { await q.end(); }
  return 0;
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'snapshot') return snapshot();
  if (cmd === 'seed') return seed(process.argv[3], process.argv[4]);
  if (cmd === 'show') return show(process.argv[4] || process.argv[3] || null);
  console.log('usage: proofkit.cjs snapshot | seed <shop-ref> <plan.json> | show [request-id]');
  return 2;
}

module.exports = { snapshot, seed, show };

if (require.main === module) main().then((c) => process.exit(c)).catch((e) => { console.error('FATAL', e.message); process.exit(1); });
