// REAL Postgres integration suite for the operational store.
//
// GATED: every test is `{ skip: !DB }` so the default unit run (node --test with
// NO DATABASE_URL) skips this file cleanly and NEVER loads `pg` or touches a DB.
// `pg` is imported DYNAMICALLY inside helpers, never at module top-level, so even
// the act of importing this file is dependency-free.
//
// RUN:
//   cd services/fusion-capture-gateway
//   DATABASE_URL=postgresql://postgres@127.0.0.1:55432/fcg_dev \
//     node --test test/postgresStore.integration.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createPostgresOperationalStore } from '../src/store/postgresOperationalStore.js';
import { STATES, MAX_DELIVERY_ATTEMPTS } from '../src/core/states.js';

const DB = process.env.DATABASE_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_operational_baseline.sql',
  '0002_wp0_deletion_and_retention.sql',
  '0003_wp0_rls_policies.sql',
  '0004_wp0_retry_retention_indexes.sql',
  '0005_wp0_card_target_and_poll_offset.sql',
];

// Drop the fcg schema and re-apply all migrations from empty. `pg` loaded here,
// dynamically — never at module scope.
async function resetAndMigrate() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({ connectionString: DB });
  try {
    await pool.query('drop schema if exists fcg cascade');
    for (const file of MIGRATIONS) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await pool.query(sql);
    }
  } finally {
    await pool.end();
  }
}

async function freshStore() {
  await resetAndMigrate();
  return createPostgresOperationalStore({ connectionString: DB });
}

function makeEnvelope(overrides = {}) {
  return {
    capture_id: randomUUID(),
    idempotency_key: `test:${randomUUID()}`,
    source_channel: 'telegram',
    sender_identity_ref: 'identity:usr_wp0_primary',
    recorded_intent: 'SaveToBrain',
    technical_source_type: 'text',
    text_preview: 'hello',
    ...overrides,
  };
}

// Drive an item through to `evidenced` with destination + one evidence pointer.
async function driveToEvidenced(store, captureId, now) {
  await store.enqueue(captureId, { confirmedByTap: true, now });
  await store.claim('w', 60_000, { now });
  await store.transition(captureId, STATES.WRITING, { now });
  await store.transition(captureId, STATES.WRITTEN, { now });
  await store.recordDestination(captureId, { kind: 'markdown', path: 'PKM/x.md' }, { now });
  await store.transition(captureId, STATES.EVIDENCED, { now });
  await store.recordEvidence(captureId, { evidence_kind: 'markdown_write', target_ref: 'PKM/x.md' }, { now });
}

test('1. migrations 0001->0004 apply cleanly from an empty schema', { skip: !DB }, async () => {
  await resetAndMigrate();
  // A second application from empty proves determinism / no lingering objects.
  await resetAndMigrate();
});

test('2. recordIntake idempotency — duplicate key => one row, isNew=false on second', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const env = makeEnvelope();
    const first = await store.recordIntake(env, { now: 1000 });
    assert.equal(first.isNew, true);
    assert.equal(first.record.state, STATES.ACCEPTED);

    // Re-delivery: same key, even with a different capture_id, maps to the first.
    const second = await store.recordIntake({ ...env, capture_id: randomUUID() }, { now: 2000 });
    assert.equal(second.isNew, false);
    assert.equal(second.record.capture_id, first.record.capture_id);

    const all = await store.list();
    assert.equal(all.length, 1, 'exactly one envelope for the duplicate key');
  } finally {
    await store.end();
  }
});

test('3. concurrent claim safety — SKIP LOCKED lets exactly one worker win', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    // One item, two simultaneous claims => exactly one non-null.
    const a = makeEnvelope();
    await store.recordIntake(a, { now: 100 });
    await store.enqueue(a.capture_id, { confirmedByTap: true, now: 100 });

    const [r1, r2] = await Promise.all([
      store.claim('worker-1', 60_000, { now: 200 }),
      store.claim('worker-2', 60_000, { now: 200 }),
    ]);
    const winners = [r1, r2].filter((r) => r !== null);
    assert.equal(winners.length, 1, 'exactly one worker claims the single item');
    assert.equal(winners[0].capture_id, a.capture_id);
    assert.equal(winners[0].state, STATES.CLAIMED);

    // Two items, two workers => each gets a distinct one.
    const b = makeEnvelope();
    const c = makeEnvelope();
    await store.recordIntake(b, { now: 300 });
    await store.recordIntake(c, { now: 301 });
    await store.enqueue(b.capture_id, { confirmedByTap: true, now: 300 });
    await store.enqueue(c.capture_id, { confirmedByTap: true, now: 301 });

    const [rb, rc] = await Promise.all([
      store.claim('worker-1', 60_000, { now: 400 }),
      store.claim('worker-2', 60_000, { now: 400 }),
    ]);
    assert.ok(rb && rc, 'both workers claim an item when two are available');
    assert.notEqual(rb.capture_id, rc.capture_id, 'the two claims are distinct items');
  } finally {
    await store.end();
  }
});

test('4. due-retry — future not claimed; past-due & under cap claimed; at/over cap not claimed', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    // Item A: fails with a FUTURE next_attempt_at.
    const a = makeEnvelope();
    await store.recordIntake(a, { now: 100 });
    await store.enqueue(a.capture_id, { confirmedByTap: true, now: 100 });
    await store.claim('w', 60_000, { now: 100 }); // attempt_count -> 1
    await store.recordFailure(a.capture_id, { now: 100, error: 'boom', nextAttemptAtMs: 1000 });

    // Before due: NOT claimable.
    const early = await store.claim('w', 60_000, { now: 500 });
    assert.equal(early, null, 'a failed item is not claimed before next_attempt_at');

    // Past due, under cap: IS claimable.
    const due = await store.claim('w', 60_000, { now: 1000 });
    assert.ok(due, 'a due failed item under the cap is claimed');
    assert.equal(due.capture_id, a.capture_id);

    // Item B: drive attempt_count to the cap, then fail while due => NOT claimable.
    const b = makeEnvelope();
    await store.recordIntake(b, { now: 2000 });
    await store.enqueue(b.capture_id, { confirmedByTap: true, now: 2000 });
    let t = 2000;
    for (let i = 0; i < MAX_DELIVERY_ATTEMPTS; i += 1) {
      const claimed = await store.claim('w', 1, { now: t }); // lease expires immediately
      assert.ok(claimed, `claim cycle ${i + 1} should succeed (attempt ${claimed?.attempt_count})`);
      await store.recordFailure(b.capture_id, { now: t, error: 'again', nextAttemptAtMs: t + 10 });
      t += 100; // advance past due for the next cycle
    }
    const capped = await store.getByCaptureId(b.capture_id);
    assert.equal(capped.attempt_count, MAX_DELIVERY_ATTEMPTS, 'attempt_count reached the cap');
    const overCap = await store.claim('w', 60_000, { now: t + 10_000 });
    assert.equal(overCap, null, 'an at/over-cap failed item is not claimed even when due');
  } finally {
    await store.end();
  }
});

test('5. evidence-gated completion — complete() refuses before evidenced + pointers', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const e = makeEnvelope();
    const now = 100;
    await store.recordIntake(e, { now });
    await store.enqueue(e.capture_id, { confirmedByTap: true, now });
    await store.claim('w', 60_000, { now });
    await store.transition(e.capture_id, STATES.WRITING, { now });
    await store.transition(e.capture_id, STATES.WRITTEN, { now });

    await assert.rejects(
      () => store.complete(e.capture_id, { now }),
      /must be "evidenced"/,
      'complete refuses from written',
    );

    await store.recordDestination(e.capture_id, { kind: 'markdown', path: 'PKM/x.md' }, { now });
    await store.transition(e.capture_id, STATES.EVIDENCED, { now });

    await assert.rejects(
      () => store.complete(e.capture_id, { now }),
      /no evidence pointer/,
      'complete refuses evidenced-without-evidence',
    );

    await store.recordEvidence(e.capture_id, { evidence_kind: 'markdown_write', target_ref: 'PKM/x.md' }, { now });
    const done = await store.complete(e.capture_id, { now });
    assert.equal(done.state, STATES.COMPLETED);
  } finally {
    await store.end();
  }
});

test('6. erasure — deleteCapture removes the row and cascades (no orphans)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const e = makeEnvelope();
    await store.recordIntake(e, { now: 100 });
    await driveToEvidenced(store, e.capture_id, 100);

    const del = await store.deleteCapture(e.capture_id, { now: 200 });
    assert.equal(del.deleted, true);

    // No orphan operational rows remain for the capture.
    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      for (const tbl of ['processing_state', 'evidence_pointer', 'idempotency_key']) {
        const res = await pool.query(`select count(*)::int as n from fcg.${tbl} where capture_id = $1`, [e.capture_id]);
        assert.equal(res.rows[0].n, 0, `no orphan rows in fcg.${tbl}`);
      }
      const env = await pool.query('select count(*)::int as n from fcg.capture_envelope where capture_id = $1', [e.capture_id]);
      assert.equal(env.rows[0].n, 0, 'envelope row erased');
    } finally {
      await pool.end();
    }

    // Idempotent: deleting again is a no-op.
    const again = await store.deleteCapture(e.capture_id, { now: 300 });
    assert.equal(again.deleted, false);
  } finally {
    await store.end();
  }
});

test('7. RLS — anon is denied; service_role works', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const e = makeEnvelope();
    await store.recordIntake(e, { now: 100 }); // owner (postgres) insert, bypasses RLS

    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      const client = await pool.connect();
      try {
        // anon: denied.
        await client.query('set role anon');
        await assert.rejects(
          () => client.query('select count(*) from fcg.capture_envelope'),
          /permission denied/,
          'anon is denied access to fcg.capture_envelope',
        );
        await client.query('reset role');

        // service_role: permitted (grants + permissive policy).
        await client.query('set role service_role');
        const res = await client.query('select count(*)::int as n from fcg.capture_envelope');
        assert.equal(res.rows[0].n, 1, 'service_role sees the row');
        await client.query('reset role');
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  } finally {
    await store.end();
  }
});

test('9. card_ref — recordCardRef persists the durable card target and reverse-lookup finds the capture (§4)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    const e = makeEnvelope();
    await store.recordIntake(e, { now: 100 });
    await store.enqueue(e.capture_id, { confirmedByTap: true, now: 100 });

    // No card target yet.
    let rec = await store.getByCaptureId(e.capture_id);
    assert.equal(rec.card_ref, null, 'card_ref starts null');

    await store.recordCardRef(e.capture_id, { chat_id: '424242', message_id: 1001 }, { now: 200 });
    rec = await store.getByCaptureId(e.capture_id);
    assert.deepEqual(rec.card_ref, { chat_id: '424242', message_id: 1001 }, 'card_ref persisted durably');

    // Reverse lookup resolves the owning capture (drives inbound callback routing).
    const found = await store.findCaptureIdByCard('424242', 1001);
    assert.equal(found, e.capture_id, 'reverse lookup finds the capture by (chat_id, message_id)');
    const miss = await store.findCaptureIdByCard('424242', 999999);
    assert.equal(miss, undefined, 'a card with no capture returns undefined');
  } finally {
    await store.end();
  }
});

test('10. poll offset — durable, defaults to 0, advances, and is monotonic (never rewinds)', { skip: !DB }, async () => {
  const store = await freshStore();
  try {
    assert.equal(await store.getPollOffset('telegram'), 0, 'unset offset defaults to 0');

    const a = await store.setPollOffset('telegram', 10, { now: 100 });
    assert.equal(a.offset_value, 10);
    assert.equal(await store.getPollOffset('telegram'), 10, 'offset persisted durably');

    const b = await store.setPollOffset('telegram', 25, { now: 200 });
    assert.equal(b.offset_value, 25, 'offset advances');

    // Monotonic guard: a stale/duplicate lower advance never rewinds the cursor.
    const c = await store.setPollOffset('telegram', 5, { now: 300 });
    assert.equal(c.offset_value, 25, 'a lower value cannot rewind the acknowledged cursor');
    assert.equal(await store.getPollOffset('telegram'), 25);
  } finally {
    await store.end();
  }
});

test('8. due-retry query is served by the partial index (EXPLAIN references processing_state_due_retry_idx)', { skip: !DB }, async () => {
  // On a tiny table Postgres CORRECTLY prefers a Seq Scan even when the partial
  // index exists — asserting "not Seq Scan" would test the planner's cost model,
  // not the schema. Instead we prove the index is USABLE by the exact due-retry
  // query: with seqscan disabled the planner MUST fall back to the index if (and
  // only if) the query can be served by it. Deterministic at any table size.
  const store = await freshStore();
  try {
    const ids = [];
    let t = 1000;
    for (let i = 0; i < 40; i += 1) {
      const e = makeEnvelope();
      await store.recordIntake(e, { now: t });
      await store.enqueue(e.capture_id, { confirmedByTap: true, now: t }); // 'queued' — NOT in the partial index
      ids.push(e.capture_id);
      t += 1;
    }

    const pgModule = await import('pg');
    const { Pool } = pgModule.default ?? pgModule;
    const pool = new Pool({ connectionString: DB });
    try {
      // A few failed+past-due rows to populate the partial index (no store claims
      // => no reclaim ordering surprises).
      await pool.query(
        "update fcg.processing_state set state = 'failed', attempt_count = 1, "
          + "next_attempt_at = now() - interval '1 hour' where capture_id = any($1::uuid[])",
        [ids.slice(0, 3)],
      );
      await pool.query('analyze fcg.processing_state');

      const client = await pool.connect();
      try {
        await client.query('begin');
        // SET LOCAL so it reverts on commit/rollback; force the planner off the
        // table so the ONLY way to serve the query is via the index.
        await client.query('set local enable_seqscan = off');
        await client.query('set local enable_bitmapscan = off');
        const explain = await client.query(
          `explain select capture_id from fcg.processing_state
             where state in ('failed','partial')
               and next_attempt_at <= now()
               and attempt_count < ${MAX_DELIVERY_ATTEMPTS}
             order by next_attempt_at`,
        );
        const plan = explain.rows.map((r) => r['QUERY PLAN']).join('\n');
        assert.match(plan, /processing_state_due_retry_idx/, `plan should use the partial index by name:\n${plan}`);
        assert.match(plan, /Index/, `plan should be an index scan:\n${plan}`);
        await client.query('rollback');
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  } finally {
    await store.end();
  }
});
