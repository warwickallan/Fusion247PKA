// BUILD-014 PR-3a — constraint-invariant proofs for 005_notification_outbox.sql
//
// DB-GATED but NOT silently self-skipping (mirrors WP-A/D0):
//   - DATABASE_URL UNSET  -> the suite skips with a LOUD message pointing at the runner
//     (test/run-outbox-tests.mjs), which provisions a throwaway Postgres cluster,
//     applies 001+002+005, and runs this file. A skip is NEVER a pass.
//   - DATABASE_URL SET but `pg` missing -> the suite FAILS (throws), so a mis-provisioned
//     CI job is loud, not green-by-omission.
// Point DATABASE_URL at an ISOLATED throwaway dev Postgres ONLY: this DROPs and rebuilds
// the `ops` schema on every test.
//
//   node services/control-plane/db/test/run-outbox-tests.mjs        # provisions + runs
//
// What it proves (the PR-3a notification-outbox invariants, as SQL failures/successes):
//   1. classification: merge -> MILESTONE; warwick-needed -> ACTION_NEEDED; merge-live-gate
//      -> ACTION_NEEDED (warwick precedence); routine/unknown -> SILENT.
//   2. projection yields <=1 outbox row per (source_event, destination, class); a SILENT
//      event is born terminal 'suppressed' (queued=send-ready otherwise).
//   3. idempotent re-projection: projecting the SAME event twice inserts NOTHING new and
//      returns the SAME row (the restart / no-dup-spam guarantee).
//   4. at-most-once is STRUCTURAL: a duplicate (source_event, destination, class) direct
//      insert is a 23505; a different destination is a distinct row.
//   5. SILENT is UNSENDABLE: a queued SILENT row cannot be REPRESENTED (biconditional
//      CHECK); claim never returns a suppressed row; suppressed->sending is rejected.
//   6. bounded retry -> dead_letter at the budget; a due/backoff gate on next_attempt_at.
//   7. delivery-state guard: non-delivery columns are frozen (23001); DELETE + TRUNCATE
//      rejected; attempts is monotonic; illegal state transitions rejected.
//   8. least-privilege NOTIFIER (SET ROLE): SELECT + delivery-column UPDATE succeed; a
//      non-delivery-column UPDATE, an INSERT, and an UPDATE of ops.verdict are all denied
//      (42501) — the notifier cannot alter contracts/findings/verdicts/gates.
//   9. mark_notification_sent/failed transactional helpers drive the state machine.
//  10. double-apply idempotent: re-running 001+002+005 is a no-op; search_path is pinned
//      on every new ops function (regression fence).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '001_control_plane_min_schema.sql',
  '002_current_head_authority.sql',
  '005_notification_outbox.sql',
].map((f) => path.join(MIGRATIONS_DIR, f));
const M005 = path.join(MIGRATIONS_DIR, '005_notification_outbox.sql');
const DB = process.env.DATABASE_URL;

let Pool = null;
let pgLoadError = null;
try { ({ Pool } = (await import('pg')).default ?? (await import('pg'))); }
catch (e) { pgLoadError = e; }

if (DB && !Pool) {
  throw new Error(
    `DATABASE_URL is set but the 'pg' driver failed to load — cannot run the PR-3a ` +
    `outbox proofs. Install pg or use run-outbox-tests.mjs. Underlying error: ${pgLoadError?.message}`);
}
const skipReason = !DB
  ? 'SKIPPED (no DATABASE_URL). Run: node services/control-plane/db/test/run-outbox-tests.mjs — it provisions a throwaway Postgres and executes these proofs. A skip is NOT a pass.'
  : false;
const gated = (name, fn) => test(name, { skip: skipReason }, fn);

async function applyMigrations(pool) {
  for (const m of MIGRATIONS) {
    await pool.query(fs.readFileSync(m, 'utf8'));
  }
}

async function freshPool() {
  const pool = new Pool({ connectionString: DB });
  await pool.query('drop schema if exists ops cascade');
  await applyMigrations(pool);
  return pool;
}

/** Assert a query rejects (throws). Returns the error for optional code checks. */
async function rejects(pool, sql, params) {
  let err = null;
  try { await pool.query(sql, params); } catch (e) { err = e; }
  assert.ok(err, `expected rejection for: ${sql}`);
  return err;
}

async function seedBuild(pool) {
  const { rows } = await pool.query(
    `insert into ops.build (build_ref, repo) values ($1, $2) returning id`,
    [`BUILD-014-${Math.random().toString(36).slice(2)}`, 'warwickallan/Fusion247PKA']);
  return rows[0].id;
}

/** Seed an immutable agent_event to project from. */
async function seedEvent(pool, buildId, eventKind, payload = {}) {
  const { rows } = await pool.query(
    `insert into ops.agent_event (build_id, delivery_key, event_kind, actor, payload_hash, payload)
     values ($1,$2,$3,'tower',$4,$5::jsonb) returning id`,
    [buildId, `dk-${Math.random().toString(36).slice(2)}`, eventKind,
     'sha256:0000000000000000000000000000000000000000000000000000000000000000',
     JSON.stringify(payload)]);
  return rows[0].id;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
gated('1. classification: merge/warwick/routine map to the right class', async () => {
  const pool = await freshPool();
  try {
    const cls = async (kind, payload = {}) => {
      const { rows } = await pool.query(
        `select ops.classify_notification_class($1,$2::jsonb) as c`, [kind, JSON.stringify(payload)]);
      return rows[0].c;
    };
    // merge -> MILESTONE
    assert.equal(await cls('merge.landed'), 'MILESTONE');
    assert.equal(await cls('merge.completed'), 'MILESTONE');            // any merge.* landing
    assert.equal(await cls('anything', { merge_landed: 'true' }), 'MILESTONE');
    // warwick-needed -> ACTION_NEEDED (and precedence over merge)
    assert.equal(await cls('warwick.decision_needed'), 'ACTION_NEEDED');
    assert.equal(await cls('merge.live_gate'), 'ACTION_NEEDED');        // a merge-live GATE needs Warwick
    assert.equal(await cls('autonomy.stopped'), 'ACTION_NEEDED');
    assert.equal(await cls('anything', { warwick_needed: 'true' }), 'ACTION_NEEDED');
    // other milestones
    assert.equal(await cls('wp.built'), 'MILESTONE');
    assert.equal(await cls('finding.high_crit'), 'MILESTONE');
    // routine + unknown -> SILENT (safe default)
    assert.equal(await cls('commit.pushed'), 'SILENT');
    assert.equal(await cls('ci.progress'), 'SILENT');
    assert.equal(await cls('review.intermediate'), 'SILENT');
    assert.equal(await cls('totally.unknown.kind'), 'SILENT');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('2 & 3. projection: <=1 row per dest/class, SILENT born suppressed, re-projection idempotent', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);

    // ACTION_NEEDED event -> queued, send-ready.
    const evA = await seedEvent(pool, buildId, 'warwick.decision_needed',
      { headline: 'Decide: merge-live?', message: 'Warwick call needed', cockpit_url: 'https://cockpit/x', github_url: 'https://gh/pr/1' });
    const p1 = await pool.query(`select * from ops.project_event_to_outbox($1)`, [evA]);
    const r1 = p1.rows[0];
    assert.equal(r1.notification_class, 'ACTION_NEEDED');
    assert.equal(r1.state, 'queued');
    assert.ok(r1.next_attempt_at, 'queued row is send-ready (next_attempt_at set)');
    assert.equal(r1.headline, 'Decide: merge-live?');
    assert.equal(r1.cockpit_url, 'https://cockpit/x');
    assert.equal(r1.destination, 'warwick_primary');

    // Idempotent re-projection: SAME event -> SAME row, nothing new.
    const p2 = await pool.query(`select * from ops.project_event_to_outbox($1)`, [evA]);
    assert.equal(p2.rows[0].id, r1.id, 're-projection returns the SAME row');
    const c1 = await pool.query(`select count(*)::int c from ops.notification_outbox where source_event_id=$1`, [evA]);
    assert.equal(c1.rows[0].c, 1, 'still exactly one row after re-projection');

    // A different destination is a DISTINCT row (per destination/class).
    await pool.query(`select ops.project_event_to_outbox($1,$2)`, [evA, 'ops_channel']);
    const c2 = await pool.query(`select count(*)::int c from ops.notification_outbox where source_event_id=$1`, [evA]);
    assert.equal(c2.rows[0].c, 2, 'a distinct destination yields a distinct row');

    // SILENT event -> born terminal 'suppressed', no next_attempt_at.
    const evS = await seedEvent(pool, buildId, 'commit.pushed');
    const ps = await pool.query(`select * from ops.project_event_to_outbox($1)`, [evS]);
    assert.equal(ps.rows[0].notification_class, 'SILENT');
    assert.equal(ps.rows[0].state, 'suppressed');
    assert.equal(ps.rows[0].next_attempt_at, null);

    // Projecting a non-existent event fails closed.
    const err = await rejects(pool, `select ops.project_event_to_outbox($1)`, ['00000000-0000-0000-0000-000000000000']);
    assert.equal(err.code, '23503', 'projecting a non-existent event is a foreign_key_violation');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('4. at-most-once is STRUCTURAL: duplicate (event,dest,class) insert is 23505', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const ev = await seedEvent(pool, buildId, 'wp.built');
    await pool.query(`select ops.project_event_to_outbox($1)`, [ev]);
    // A hand-rolled duplicate for the same (event, destination, class) collides.
    const err = await rejects(pool,
      `insert into ops.notification_outbox (source_event_id, notification_class, destination, headline, message)
       values ($1,'MILESTONE','warwick_primary','h','m')`, [ev]);
    assert.equal(err.code, '23505', 'duplicate (event,dest,class) must be a unique_violation');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('5. SILENT is UNSENDABLE: queued-SILENT is unrepresentable; claim skips; suppressed->sending rejected', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const evS = await seedEvent(pool, buildId, 'ci.progress');
    const { rows } = await pool.query(`select * from ops.project_event_to_outbox($1)`, [evS]);
    const sup = rows[0];
    assert.equal(sup.state, 'suppressed');

    // (a) A SILENT row that is queued cannot be REPRESENTED (biconditional CHECK).
    const cErr = await rejects(pool,
      `insert into ops.notification_outbox (source_event_id, notification_class, destination, headline, message, state)
       values ($1,'SILENT','other','h','m','queued')`, [evS]);
    assert.equal(cErr.code, '23514', 'a queued SILENT row violates the biconditional CHECK');

    // (b) claim never returns a suppressed row (there is nothing sendable for this dest).
    const claim = await pool.query(`select ops.claim_notification($1) as n`, [sup.destination]);
    assert.equal(claim.rows[0].n, null, 'claim returns NULL — a suppressed SILENT row is not claimable');

    // (c) a direct suppressed->sending transition is rejected by the guard.
    const gErr = await rejects(pool, `update ops.notification_outbox set state='sending' where id=$1`, [sup.id]);
    assert.ok(['23001', '23514'].includes(gErr.code), `suppressed->sending must be rejected (got ${gErr.code})`);
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('6. bounded retry increments to dead_letter at the budget; backoff gates claim', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const ev = await seedEvent(pool, buildId, 'merge.landed');
    // Insert directly with a small budget (max_attempts is frozen after write, so set it up front).
    const ins = await pool.query(
      `insert into ops.notification_outbox
         (source_event_id, notification_class, destination, headline, message, state, max_attempts, next_attempt_at)
       values ($1,'MILESTONE','warwick_primary','Merge landed','BUILD-014 merged','queued',2,now())
       returning id`, [ev]);
    const id = ins.rows[0].id;
    const dest = 'warwick_primary';

    // attempt 1: claim -> sending (attempts=1); fail with backoff 0 -> queued (retryable).
    let c = await pool.query(`select ops.claim_notification($1) as n`, [dest]);
    assert.ok(c.rows[0].n, 'first claim succeeds');
    let r = await pool.query(`select * from ops.mark_notification_failed($1,'HTTP_500',0)`, [id]);
    assert.equal(r.rows[0].state, 'queued', 'below budget -> retryable (queued)');
    assert.equal(r.rows[0].attempts, 1);

    // attempt 2 (the budget): claim -> sending (attempts=2); fail -> dead_letter.
    c = await pool.query(`select ops.claim_notification($1) as n`, [dest]);
    assert.ok(c.rows[0].n, 'second claim succeeds');
    r = await pool.query(`select * from ops.mark_notification_failed($1,'HTTP_500',0)`, [id]);
    assert.equal(r.rows[0].state, 'dead_letter', 'at budget -> dead_letter');
    assert.equal(r.rows[0].attempts, 2);

    // an exhausted/dead_letter row is not claimable.
    c = await pool.query(`select ops.claim_notification($1) as n`, [dest]);
    assert.equal(c.rows[0].n, null, 'dead_letter row is not re-claimable');

    // backoff gate: a fresh queued row with a FUTURE next_attempt_at is not yet due.
    const ev2 = await seedEvent(pool, buildId, 'qa.final_clean');
    await pool.query(
      `insert into ops.notification_outbox (source_event_id, notification_class, destination, headline, message, next_attempt_at)
       values ($1,'MILESTONE','future_dest','h','m', now() + interval '1 hour')`, [ev2]);
    const cf = await pool.query(`select ops.claim_notification($1) as n`, ['future_dest']);
    assert.equal(cf.rows[0].n, null, 'a not-yet-due (future next_attempt_at) row is not claimed');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('7. delivery-state guard: non-delivery columns frozen; DELETE/TRUNCATE rejected; attempts monotonic; illegal transitions rejected', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const ev = await seedEvent(pool, buildId, 'wp.built');
    const { rows } = await pool.query(`select * from ops.project_event_to_outbox($1)`, [ev]);
    const id = rows[0].id;

    // frozen non-delivery columns -> 23001
    for (const [col, val] of [
      ['headline', `'rewritten'`],
      ['message', `'rewritten'`],
      ['destination', `'elsewhere'`],
      ['notification_class', `'SILENT'`],
      ['cockpit_url', `'https://evil'`],
      ['max_attempts', `99`],
    ]) {
      const e = await rejects(pool, `update ops.notification_outbox set ${col}=${val} where id=$1`, [id]);
      assert.equal(e.code, '23001', `${col} must be frozen (default-deny)`);
    }
    // frozen source binding
    const eSrc = await rejects(pool, `update ops.notification_outbox set source_event_id=gen_random_uuid() where id=$1`, [id]);
    assert.equal(eSrc.code, '23001', 'source_event_id is frozen');

    // delivery columns ARE mutable (queued->sending allowed).
    await pool.query(`update ops.notification_outbox set state='sending', attempts=attempts+1 where id=$1`, [id]);

    // attempts monotonic: lowering it is rejected.
    const eMono = await rejects(pool, `update ops.notification_outbox set attempts=0 where id=$1`, [id]);
    assert.equal(eMono.code, '23001', 'attempts cannot be lowered (monotonic)');

    // illegal transition: sending->queued is not in the graph.
    const eTrans = await rejects(pool, `update ops.notification_outbox set state='queued' where id=$1`, [id]);
    assert.equal(eTrans.code, '23001', 'sending->queued is an illegal transition');

    // sent is terminal: sent->anything rejected.
    await pool.query(`update ops.notification_outbox set state='sent', sent_at=now() where id=$1`, [id]);
    const eTerm = await rejects(pool, `update ops.notification_outbox set state='failed' where id=$1`, [id]);
    assert.equal(eTerm.code, '23001', 'sent is terminal');

    // DELETE rejected; TRUNCATE rejected.
    const eDel = await rejects(pool, `delete from ops.notification_outbox where id=$1`, [id]);
    assert.equal(eDel.code, '23001', 'DELETE is rejected');
    const eTrunc = await rejects(pool, `truncate ops.notification_outbox`);
    assert.equal(eTrunc.code, '23001', 'TRUNCATE is rejected by the guard');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('8. least-privilege NOTIFIER (SET ROLE): delivery UPDATE ok; non-delivery/insert/other-table denied (42501)', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const ev = await seedEvent(pool, buildId, 'merge.landed');
    const { rows } = await pool.query(`select * from ops.project_event_to_outbox($1)`, [ev]);
    const id = rows[0].id;

    const client = await pool.connect();
    try {
      await client.query('set role notifier');

      // SELECT works (notifier has select grant + policy).
      const sel = await client.query(`select count(*)::int c from ops.notification_outbox`);
      assert.ok(sel.rows[0].c >= 1, 'notifier can SELECT the outbox');

      // delivery-column UPDATE works (queued->sending).
      await client.query(`update ops.notification_outbox set state='sending' where id=$1`, [id]);

      // non-delivery-column UPDATE denied at the GRANT layer (42501).
      let e1 = null;
      try { await client.query(`update ops.notification_outbox set headline='x' where id=$1`, [id]); } catch (e) { e1 = e; }
      assert.ok(e1 && e1.code === '42501', `notifier cannot UPDATE a non-delivery column (got ${e1 && e1.code})`);

      // INSERT denied (no insert grant / no insert policy).
      let e2 = null;
      try {
        await client.query(
          `insert into ops.notification_outbox (source_event_id, notification_class, destination, headline, message)
           values ($1,'MILESTONE','x','h','m')`, [ev]);
      } catch (e) { e2 = e; }
      assert.ok(e2 && e2.code === '42501', `notifier cannot INSERT (got ${e2 && e2.code})`);

      // Cannot touch verdicts/gates/contracts — no grant on ops.verdict.
      let e3 = null;
      try { await client.query(`update ops.verdict set state='superseded' where id = gen_random_uuid()`); } catch (e) { e3 = e; }
      assert.ok(e3 && e3.code === '42501', `notifier cannot UPDATE ops.verdict (got ${e3 && e3.code})`);

      let e4 = null;
      try { await client.query(`update ops.merge_gate set fusion_policy_decision='approved' where id = gen_random_uuid()`); } catch (e) { e4 = e; }
      assert.ok(e4 && e4.code === '42501', `notifier cannot UPDATE ops.merge_gate (got ${e4 && e4.code})`);
    } finally {
      await client.query('reset role');
      client.release();
    }
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('9. helpers drive the state machine: claim -> mark_sent (terminal, sent_at set)', async () => {
  const pool = await freshPool();
  try {
    const buildId = await seedBuild(pool);
    const ev = await seedEvent(pool, buildId, 'finding.high_crit',
      { headline: 'HIGH: secret in log', message: 'Finding needs eyes' });
    const { rows } = await pool.query(`select * from ops.project_event_to_outbox($1)`, [ev]);
    assert.equal(rows[0].notification_class, 'MILESTONE');
    const dest = rows[0].destination;

    const c = await pool.query(`select * from ops.claim_notification($1)`, [dest]);
    assert.equal(c.rows[0].state, 'sending');
    assert.equal(c.rows[0].attempts, 1);

    const s = await pool.query(`select * from ops.mark_notification_sent($1)`, [rows[0].id]);
    assert.equal(s.rows[0].state, 'sent');
    assert.ok(s.rows[0].sent_at, 'sent_at is set on send');

    // a duplicate mark_sent on an already-sent row is rejected (not still-sending).
    const e = await rejects(pool, `select ops.mark_notification_sent($1)`, [rows[0].id]);
    assert.equal(e.code, '23001', 'a stale/duplicate mark_sent is rejected');
  } finally { await pool.end(); }
});

// ---------------------------------------------------------------------------
gated('10. double-apply idempotent; every new ops function pins search_path', async () => {
  const pool = await freshPool();
  try {
    // Re-apply 005 (and prove the whole stack re-applies) — no error.
    await pool.query(fs.readFileSync(M005, 'utf8'));
    await applyMigrations(pool);

    // Regression fence: every plpgsql/sql function in ops pins search_path (mirrors WP-A test 19).
    const { rows } = await pool.query(`
      select p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        join pg_language l on l.oid = p.prolang
       where n.nspname = 'ops'
         and l.lanname in ('plpgsql','sql')
         and not exists (
           select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
            where cfg like 'search_path=%')`);
    assert.equal(rows.length, 0,
      `every ops plpgsql/sql function must pin search_path; unpinned: ${rows.map((r) => r.proname).join(', ')}`);
  } finally { await pool.end(); }
});
