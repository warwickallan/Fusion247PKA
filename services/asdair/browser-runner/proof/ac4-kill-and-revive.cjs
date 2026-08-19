#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr WO-2026-08-19-01 AC4 - KILL IT AND PROVE THE REVIVAL.
//
//   node proof/ac4-kill-and-revive.cjs            the proof
//   node proof/ac4-kill-and-revive.cjs --mutate   the mutation arm
//
// -- WHAT THIS IS FOR --------------------------------------------------------
// Warwick: "A test that starts a thing and observes it running proves nothing."
// So nothing here observes. A real OS process claims a real lease on a real
// PostgreSQL row, is SIGKILLed with no chance to clean up, and a second real
// process has to pick the work up from durable state alone.
//
// -- WHY A REAL CLUSTER, AND WHAT IT BUYS OVER THE EXISTING SUITE ------------
// wake.test.cjs already proves the RESUMPTION LOGIC against test/fakePg.cjs.
// fakePg pattern-matches SQL strings; it cannot tell you the lease SQL is
// valid. And this SQL is where the risk actually lives:
//
//   * the expiry clock is the DATABASE clock, never a runner's - the lease is
//     built by jsonb_build_object(... to_jsonb(now() + make_interval(...)))
//   * the claim is a single atomic UPDATE ... WHERE id = (SELECT ... FOR UPDATE
//     SKIP LOCKED LIMIT 1)
//   * fencing is a jsonb path comparison, progress->'_lease'->>'runner_id'
//   * the backoff window is a (progress->>'_retry_after')::timestamptz cast
//
// None of that is exercised by a string matcher. Here it runs against real
// PostgreSQL 17.4.
//
// -- THE LIMIT, STATED RATHER THAN IMPLIED -----------------------------------
// The cluster carries the COMMITTED schema for the tables this exercises
// (browser_build_request and its neighbours, from migrations 001 and 004-010).
// The estate as a whole is NOT rebuildable from git: applying 001..021 aborts
// at 012 with `relation "asdair.command_request" does not exist`. Only the
// GRANT migrations fail, and grants are not what lease and transaction
// mechanics need - which is why this proof is still worth having, and why it
// must not be read as evidence that the estate rebuilds.
//
// This is a THROWAWAY LOCAL CLUSTER. Nothing here touches the household
// database, opens a credentials file, or reaches the network. The harness is
// given a DSN for a disposable target and has no fallback if it is absent.
//
// -- CONFIGURATION, WITH NO DEFAULTS -----------------------------------------
// AC4_DSN        connection string for the throwaway cluster   (required)
// AC4_NODE_PATH  where to resolve the `pg` driver from         (required)
//
// A missing value is NOT RUN, loudly, with exit 2. It is never a pass. `pg` is
// a declared dependency of this package that is not installed in every
// checkout, and a proof that silently skips is worse than no proof.
// =====================================================================
'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const CHILD = path.join(__dirname, 'ac4-child.cjs');
const MUTATE = process.argv.includes('--mutate');

const DSN = process.env.AC4_DSN || null;
const NODE_PATH = process.env.AC4_NODE_PATH || null;

const LEASE_MS = 3000;
const results = [];
let failures = 0;

function heading(n, title) {
  console.log(`\n${'='.repeat(72)}\nPROOF ${n} - ${title}\n${'='.repeat(72)}`);
}
function check(name, ok, evidence) {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}`);
  if (evidence !== undefined) {
    console.log(`         ${typeof evidence === 'string' ? evidence : JSON.stringify(evidence)}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Spawn a child, collecting its output. Returns a handle the parent can kill. */
function spawnChild(args) {
  const child = spawn(process.execPath, [CHILD, '--dsn', DSN, ...args], {
    env: { ...process.env, NODE_PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const out = [];
  child.stdout.on('data', (d) => out.push(String(d)));
  child.stderr.on('data', (d) => out.push(String(d)));
  const done = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal, text: out.join('') }));
  });
  return { child, done, text: () => out.join('') };
}

async function main() {
  if (!DSN || !NODE_PATH) {
    console.log('NOT RUN - AC4_DSN and AC4_NODE_PATH are both required and carry no defaults.');
    console.log('          This is NOT a pass. Raise a throwaway cluster and set them.');
    process.exit(2);
  }

  let Client;
  try { ({ Client } = require(path.join(NODE_PATH, 'pg'))); } catch (e) {
    console.log(`NOT RUN - cannot resolve the pg driver from AC4_NODE_PATH: ${e.message}`);
    process.exit(2);
  }

  const db = new Client({ connectionString: DSN });
  await db.connect();
  const row = async (id) => (await db.query(
    'select id, status, claimed_by, progress from asdair.browser_build_request where id = $1', [id],
  )).rows[0];

  // ── FIXTURE ──────────────────────────────────────────────────────────────
  await db.query('delete from asdair.browser_build_request');
  await db.query('delete from asdair.shop_event');
  await db.query('delete from asdair.shop');
  // A REAL household row, because asdair.shop carries a real foreign key to it.
  // fakePg has no foreign keys, so this constraint - like the NOT NULL and the
  // CHECK above it - is one only a real cluster can enforce. Both were found by
  // running this, not by reading the schema.
  await db.query(
    `insert into asdair.households (id, name) values (1, 'AC4 scratch household')
       on conflict (id) do nothing`,
  );
  const shop = (await db.query(
    `insert into asdair.shop (shop_ref, household_id, status, source_kind)
     values ('SHOP-AC4-2026-08-19', 1, 'WAITING_FOR_BROWSER', 'text') returning id`,
  )).rows[0];
  const req = (await db.query(
    `insert into asdair.browser_build_request (shop_id, status, requested_at)
     values ($1, 'queued', now()) returning id`, [shop.id],
  )).rows[0];
  console.log(`fixture: shop ${shop.id}, browser_build_request ${req.id}, lease ${LEASE_MS}ms`
    + `${MUTATE ? '   *** MUTATION ARM: the first process persists NOTHING ***' : ''}`);

  // ── PROOF 1 ──────────────────────────────────────────────────────────────
  heading(1, 'a real process claims the lease and writes DURABLE progress');
  const a = spawnChild([
    '--request-id', String(req.id), '--runner-id', 'runner-A',
    '--lease-ms', String(LEASE_MS), '--steps', '40', '--step-ms', '250',
    ...(MUTATE ? ['--no-progress'] : []),
  ]);

  // Wait for real ROWS to appear, not for a log line.
  //
  // The cap is deliberately well inside LEASE_MS. An earlier version waited up
  // to 10s, which is longer than the 3s lease - so in the mutation arm (where
  // the steps never arrive) the wait itself outlived the lease, and PROOF 3
  // then failed because the lease had legitimately expired rather than because
  // of the mutation. Two of the three mutation failures were timing artefacts
  // dressed as signals. The cap keeps PROOF 3 inside the lease window in BOTH
  // arms, so the mutation fails at exactly one place: resumption.
  const WAIT_CAP = Math.floor((LEASE_MS * 0.6) / 250);
  let seen = 0;
  for (let i = 0; i < WAIT_CAP && seen < 3; i += 1) {
    await sleep(250);
    const r = await row(req.id);
    seen = (r && r.progress && r.progress.executor && r.progress.executor.completed_steps || []).length;
  }
  const mid = await row(req.id);
  check('the request is claimed and running in the database',
    mid.status === 'running' && mid.claimed_by === 'runner-A',
    `status=${mid.status} claimed_by=${mid.claimed_by}`);
  check('at least 3 steps are DURABLE in the row before the kill', seen >= 3,
    `${seen} completed step(s) persisted`
    + (MUTATE ? '  <- expected 0 in the mutation arm' : ''));
  check('the lease expiry was written by the DATABASE clock',
    !!(mid.progress && mid.progress._lease && mid.progress._lease.expires_at),
    mid.progress && mid.progress._lease ? mid.progress._lease.expires_at : 'no _lease');

  // ── PROOF 2 ──────────────────────────────────────────────────────────────
  heading(2, 'SIGKILL - no cleanup, no finally, no graceful shutdown');
  a.child.kill('SIGKILL');
  const aExit = await a.done;
  check('the first process was really killed, not asked to stop',
    aExit.signal === 'SIGKILL' || aExit.code === null || aExit.code === 137,
    `signal=${aExit.signal} code=${aExit.code}`);
  const afterKill = await row(req.id);
  const durable = (afterKill.progress && afterKill.progress.executor
    && afterKill.progress.executor.completed_steps || []).length;
  check('the work it had completed SURVIVED the kill', durable === seen && (MUTATE || durable >= 3),
    `${durable} step(s) still in the row after SIGKILL`);
  check('the row still shows the dead runner holding it - a corpse, not a clean slate',
    afterKill.claimed_by === 'runner-A' && afterKill.status === 'running',
    `status=${afterKill.status} claimed_by=${afterKill.claimed_by}`);

  // ── PROOF 3 ──────────────────────────────────────────────────────────────
  heading(3, 'the lease is NOT stolen while it is still live');
  const early = spawnChild([
    '--request-id', String(req.id), '--runner-id', 'runner-B',
    '--lease-ms', String(LEASE_MS), '--steps', '1', '--step-ms', '10',
  ]);
  const earlyExit = await early.done;
  check('a second runner is REFUSED while the dead runner\'s lease is unexpired',
    earlyExit.code === 3,
    `exit=${earlyExit.code} :: ${earlyExit.text.trim().split('\n').pop()}`);

  // ── PROOF 4 ──────────────────────────────────────────────────────────────
  heading(4, 'after expiry a NEW process resumes from durable state, with no human');
  await sleep(LEASE_MS + 500);
  const b = spawnChild([
    '--request-id', String(req.id), '--runner-id', 'runner-B',
    '--lease-ms', String(LEASE_MS), '--steps', String(Math.max(seen + 3, 6)), '--step-ms', '80',
  ]);
  const bExit = await b.done;
  const resumeLine = (bExit.text.match(/CHILD-CLAIMED .*resume_from=(\d+)/) || [])[1];
  check('the expired lease was claimable by a different runner', bExit.code === 0,
    `exit=${bExit.code} :: ${bExit.text.trim().split('\n')[0]}`);
  check('it RESUMED rather than restarting from zero', Number(resumeLine) === seen && seen > 0,
    `resume_from=${resumeLine}, expected ${seen}`
    + (MUTATE ? '  <- the mutation arm must fail HERE' : ''));

  const end = await row(req.id);
  const finalSteps = (end.progress && end.progress.executor
    && end.progress.executor.completed_steps || []).length;
  check('the second runner now owns the lease', end.claimed_by === 'runner-B',
    `claimed_by=${end.claimed_by}`);
  check('total completed work only ever grew - nothing was redone or lost',
    finalSteps > durable, `${durable} before -> ${finalSteps} after`);

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  await db.end();
  console.log(`\n${'='.repeat(72)}`);
  console.log(`${results.length - failures}/${results.length} checks passed`);
  if (MUTATE) {
    console.log('MUTATION ARM: failures above are the REQUIRED result. A green mutation');
    console.log('arm would mean the proof does not measure resumption at all.');
    process.exit(failures > 0 ? 0 : 1);
  }
  console.log(failures === 0 ? 'AC4 PROVED' : `AC4 FAILED - ${failures} check(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
