// =====================================================================
// BUILD-015 AsdAIr - handoff/readReconciled.dbtest.js
//
// WO-2026-08-13-12 (WP-B15-44). THE PROOFS THAT NEED A REAL DATABASE.
//
// readReconciled.test.js proves the logic against an injected query. It cannot
// prove any of the following, and saying otherwise would be the exact defect
// this module's own README already records against the claim lifecycle
// ("the SQL is not proven"):
//
//   - that the SELECTs are valid against the post-020 schema at all;
//   - that the grants the runtime role actually holds are sufficient;
//   - that shop_line_provenance really is append-only where it matters;
//   - AC6: that a claim SURVIVES THE DEATH OF THE PROCESS HOLDING IT.
//
// TARGET. Throwaway Postgres only, from ASDAIR_WRITE_DB_URL, refused by
// assertSafeDbTarget before a connection is opened. This file writes rows; it
// never DROPs a schema and never DELETEs, because the role it runs as holds no
// DELETE on any asdair table - which is production-faithful and is why fixtures
// here are ADDITIVE and uniquely keyed per run.
//
// NOT DESTRUCTIVE, so it needs no destructive opt-in: every run inserts its own
// shop under its own shop_ref and touches nobody else's rows.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { buildHandoffFromDb, readReconciledShop, toPacket, ReconciliationError } = require('./readReconciled');
const { openHandoff, peekHandoff, claimHandoff } = require('./claim');

// =====================================================================
// WHY THIS CHECK IS LOCAL AND NOT THE SHARED ONE - recorded, not hidden.
//
// services/asdair/skill/test/dbSafeTarget.js is the estate's helper and would
// have been the right thing to import. It cannot be used from here: it requires
// `pg-connection-string`, which Node resolves upward from ITS own directory
// (skill/test -> skill -> asdair -> services -> repo), and no node_modules
// exists on any of those paths in this worktree. The require throws and the
// helper reports "not a parseable connection string" for a perfectly good URL -
// a control failing CLOSED, which is correct behaviour but leaves it unusable.
//
// Making it work would mean installing a dependency into services/asdair/, which
// is outside this Work Order's file surface. So the check is reimplemented here,
// deliberately, with the same refusals. This duplication is REPORTED in the
// return rather than left for someone to discover.
// =====================================================================
function assertDisposableTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    throw new Error('REFUSING to run: ASDAIR_WRITE_DB_URL is not a parseable URL.');
  }
  if (parsed.searchParams.has('host') || parsed.searchParams.has('port')) {
    throw new Error('REFUSING to run: a host/port query parameter can redirect pg away from the URL host. Ambiguous target.');
  }
  const host = parsed.hostname.toLowerCase();
  const db = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (host.includes('supabase') || host.includes('pooler')) {
    throw new Error(`REFUSING to run: host "${host}" looks like live Supabase or a pooler. These proofs run on throwaway Postgres only.`);
  }
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host)) {
    throw new Error(`REFUSING to run: host "${host}" is not loopback. These proofs write rows and run on a disposable local cluster only.`);
  }
  if (!db.includes('test')) {
    throw new Error(`REFUSING to run: database "${db}" is not named as a test database. Refusing to write rows into it.`);
  }
  return true;
}

const DB_URL = process.env.ASDAIR_WRITE_DB_URL;
const gate = DB_URL
  ? { skip: false }
  : { skip: 'ASDAIR_WRITE_DB_URL not set -- real-Postgres handoff proofs skipped (no-op)' };

const HOUSEHOLD_ID = 1;
const REG_RICHMOND = 3;
const REG_ARIEL = 4;
const REG_LENOR = 5;

/** A shop_ref unique to this run. SHOP-YYYY-MM-DD-M<n> is the schema's own shape. */
function uniqueShopRef() {
  return `SHOP-2026-08-13-M${Date.now() % 100000000}`;
}

async function connect() {
  assertDisposableTarget(DB_URL);
  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  return { client, query: (text, params) => client.query(text, params) };
}

/**
 * Build one shop with its lines and provenance. ADDITIVE: nothing is deleted,
 * nothing else's rows are touched.
 */
async function seedShop(query, { status = 'NEEDS_DECISION', humanState = null, lines }) {
  const shopRef = uniqueShopRef();

  // human_state IS WRITTEN EXPLICITLY, and that is a fact about the schema
  // rather than a convenience here. Migration 020 adds the column with a
  // DEFAULT and BACKFILLS it once; it installs NO trigger, so nothing keeps
  // human_state tracking status afterwards. Whoever writes one writes both.
  // (Established by execution: 0 triggers in 020, and a shop inserted with
  // status READY_TO_SHOP came back human_state ASDAIR_WORKING.)
  const shop = (await query(
    `insert into asdair.shop (household_id, shop_ref, source_kind, status, human_state)
     values ($1, $2, 'text', $3, $4) returning id, shop_ref, status, human_state`,
    [HOUSEHOLD_ID, shopRef, status, humanState || (status === 'READY_TO_SHOP' ? 'READY_FOR_WARWICK' : 'ASDAIR_WORKING')],
  )).rows[0];

  for (const l of lines) {
    await query(
      `insert into asdair.shop_line (shop_id, line_no, raw_reading, quantity, matched_regular_id, status, match_basis)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [shop.id, l.line_no, l.raw_reading, l.quantity, l.matched_regular_id, l.status, l.match_basis || 'aka'],
    );
    if (l.provenance !== false) {
      // The provenance KIND is chosen by what the row can honestly support, not
      // by preference: check constraint shop_line_provenance_regulars_has_product
      // requires a matched regular for REGULARS, and a line with no match has
      // none. WARWICK carries raw_text instead. Picking REGULARS regardless
      // would be inventing a match that does not exist.
      const kind = l.matched_regular_id != null ? 'REGULARS' : 'WARWICK';
      await query(
        `insert into asdair.shop_line_provenance (shop_id, line_no, provenance, matched_regular_id, quantity, raw_text, interpreted_at)
         values ($1, $2, $3, $4, $5, $6, now())`,
        [shop.id, l.line_no, kind, l.matched_regular_id, l.quantity, l.matched_regular_id != null ? null : l.raw_reading],
      );
    }
  }
  return shop;
}

const RICHMOND_AND_ARIEL = [
  { line_no: 1, raw_reading: 'richmond sausages', quantity: 1, matched_regular_id: REG_RICHMOND, status: 'matched' },
  { line_no: 2, raw_reading: 'ariel pods', quantity: 1, matched_regular_id: REG_ARIEL, status: 'matched' },
];

// =====================================================================
// AC1 - THE RECONCILED TRUTH, READ FROM THE POST-020 SCHEMA
// =====================================================================

test('AC1 (db): the handoff is built from asdair.shop / shop_line / shop_line_provenance', gate, async () => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, { status: 'READY_TO_SHOP', lines: RICHMOND_AND_ARIEL });
    const res = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });

    assert.equal(res.handoff.lines.length, 2);
    assert.equal(res.shop.status, 'READY_TO_SHOP');
    assert.equal(res.shop.human_state, 'READY_FOR_WARWICK',
      'migration 020 maps status onto human_state; the reader carries the mapped value it did not gate on');

    res.handoff.lines.forEach((l) => {
      assert.ok(Array.isArray(l.provenance) && l.provenance.length === 1, `line ${l.seq} must carry its 020 provenance`);
      assert.equal(l.provenance[0].provenance, 'REGULARS');
    });
  } finally { await client.end(); }
});

test('AC1 (db): a superseded provenance row is NOT read as current truth', gate, async () => {
  const { client, query } = await connect();
  try {
    // Seeded with NO provenance, because this test writes both rows itself.
    const shop = await seedShop(query, {
      status: 'READY_TO_SHOP',
      lines: RICHMOND_AND_ARIEL.map((l) => ({ ...l, provenance: false })),
    });

    // A CORRECTION IS AN INSERT, NEVER AN UPDATE - and this role could not
    // update it even if the design allowed one: it holds INSERT+SELECT on
    // shop_line_provenance and nothing else. So the newer row is written first
    // and the superseded row is written pointing AT it. That ordering is not a
    // trick to dodge the grant; it is what an append-only ledger looks like
    // from the inside.
    const newer = (await query(
      `insert into asdair.shop_line_provenance (shop_id, line_no, provenance, matched_regular_id, quantity, raw_text, interpreted_at)
       values ($1, 1, 'WARWICK', $2, 1, 'corrected by Warwick', now()) returning id`,
      [shop.id, REG_RICHMOND],
    )).rows[0];
    await query(
      `insert into asdair.shop_line_provenance (shop_id, line_no, provenance, matched_regular_id, quantity, superseded_by_id, interpreted_at)
       values ($1, 1, 'REGULARS', $2, 1, $3, now())`,
      [shop.id, REG_RICHMOND, newer.id],
    );
    await query(
      `insert into asdair.shop_line_provenance (shop_id, line_no, provenance, matched_regular_id, quantity, interpreted_at)
       values ($1, 2, 'REGULARS', $2, 1, now())`,
      [shop.id, REG_ARIEL],
    );

    // The role CANNOT rewrite history, and that is asserted rather than assumed.
    await assert.rejects(
      () => query(`update asdair.shop_line_provenance set quantity = 99 where shop_id = $1`, [shop.id]),
      /permission denied/i,
      'an append-only ledger this role can UPDATE is not append-only',
    );

    const { provenanceByLineNo } = await readReconciledShop(query, { shopRef: shop.shop_ref });
    const surviving = provenanceByLineNo.get(1);
    assert.equal(surviving.length, 1, 'only the surviving row is current truth');
    assert.equal(surviving[0].provenance, 'WARWICK',
      'the correction wins; reading the superseded row would resurrect an overturned decision');
  } finally { await client.end(); }
});

test('AC1 (db): shop_line_provenance is APPEND-ONLY to this role - the immutability is real, not simulated', gate, async () => {
  const { client, query } = await connect();
  try {
    const priv = (await query(
      `select privilege_type from information_schema.table_privileges
        where grantee = current_user and table_schema = 'asdair' and table_name = 'shop_line_provenance'`,
    )).rows.map((r) => r.privilege_type).sort();
    assert.ok(priv.includes('INSERT') && priv.includes('SELECT'), `expected INSERT+SELECT, got ${priv.join(',')}`);
    assert.equal(priv.includes('DELETE'), false, 'a provenance ledger this role can DELETE is not a ledger');
  } finally { await client.end(); }
});

// =====================================================================
// AC2 - THE EMISSION GATE, AGAINST REAL STATE
// =====================================================================

test('AC2 (db): a shop that is not READY_TO_SHOP emits nothing, and the same shop emits once it is', gate, async () => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, { status: 'NEEDS_DECISION', lines: RICHMOND_AND_ARIEL });

    await assert.rejects(
      () => buildHandoffFromDb(query, { shopRef: shop.shop_ref }),
      (e) => e instanceof ReconciliationError && e.code === 'SHOP_NOT_READY_TO_SHOP',
      'a held shop must produce no payload at all',
    );

    // The SAME shop, transitioned. Nothing else changes.
    // ONLY status is moved. human_state is left deliberately stale, because 020
    // installs no trigger and the gate must not depend on anyone remembering to
    // update the display column.
    await query(`update asdair.shop set status = 'READY_TO_SHOP' where id = $1`, [shop.id]);
    const res = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });
    assert.equal(res.handoff.lines.length, 2, 'and the same shop emits the moment the hold is genuinely gone');
    assert.equal(res.shop.human_state, 'ASDAIR_WORKING',
      'proof that nothing syncs the two columns: status opened the gate while human_state still says ASDAIR_WORKING');
  } finally { await client.end(); }
});

test('AC2 (db): human_state alone does NOT open the gate', gate, async () => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, { status: 'NEEDS_DECISION', lines: RICHMOND_AND_ARIEL });
    await query(`update asdair.shop set human_state = 'READY_FOR_WARWICK' where id = $1`, [shop.id]);
    await assert.rejects(
      () => buildHandoffFromDb(query, { shopRef: shop.shop_ref }),
      (e) => e.code === 'SHOP_NOT_READY_TO_SHOP',
      'the display state must never be able to open a gate the machine state has closed',
    );
  } finally { await client.end(); }
});

// =====================================================================
// AC3 / AC4 - SORT, IDENTITY AND THE NUMBER THAT REACHES THE TROLLEY
// =====================================================================

test('AC4 (db): Richmond 16 and Ariel 33 are ONE PACK EACH, from the real catalogue rows', gate, async () => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, { status: 'READY_TO_SHOP', lines: RICHMOND_AND_ARIEL });
    const res = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });

    const richmond = res.handoff.lines.find((l) => l.canonical_product_name.startsWith('Richmond'));
    const ariel = res.handoff.lines.find((l) => l.canonical_product_name.startsWith('Ariel'));

    assert.equal(richmond.pack_identity.pack_size, 16);
    assert.equal(richmond.required_quantity, 1, 'sixteen packs of sausages is the failure named in the Work Order');
    assert.equal(ariel.pack_identity.pack_size, 33);
    assert.equal(ariel.required_quantity, 1, 'thirty-three packs of pods is the same failure wearing a different label');

    assert.equal(res.handoff.expected.total_units, 2, 'two units in the trolley, NOT 49');
  } finally { await client.end(); }
});

test('AC3 (db): lines come out brand A-Z, and buildHandoff independently verifies it', gate, async () => {
  const { client, query } = await connect();
  try {
    // Seeded deliberately OUT of order: Richmond (line 1) before Ariel (line 2).
    const shop = await seedShop(query, {
      status: 'READY_TO_SHOP',
      lines: [
        { line_no: 1, raw_reading: 'richmond sausages', quantity: 1, matched_regular_id: REG_RICHMOND, status: 'matched' },
        { line_no: 2, raw_reading: 'ariel pods', quantity: 1, matched_regular_id: REG_ARIEL, status: 'matched' },
        { line_no: 3, raw_reading: 'lenor outdoor', quantity: 2, matched_regular_id: REG_LENOR, status: 'matched' },
      ],
    });
    const res = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });
    assert.deepEqual(res.handoff.lines.map((l) => l.brand), ['Ariel', 'Lenor', 'Richmond']);
    assert.equal(res.handoff.sort_contract_verified, true);
    assert.deepEqual(res.handoff.lines.map((l) => l.seq), [1, 2, 3], 'seq is renumbered to the SHOPPING order, not the list order');
  } finally { await client.end(); }
});

// =====================================================================
// AC5 - NOTHING VANISHES
// =====================================================================

test('AC5 (db): a held line is NAMED, never dropped, and the arithmetic balances', gate, async () => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, {
      status: 'READY_TO_SHOP',
      lines: [
        { line_no: 1, raw_reading: 'richmond sausages', quantity: 1, matched_regular_id: REG_RICHMOND, status: 'matched' },
        { line_no: 2, raw_reading: 'somthing smudged', quantity: null, matched_regular_id: null, status: 'unreadable' },
        { line_no: 3, raw_reading: 'ariel pods', quantity: 1, matched_regular_id: REG_ARIEL, status: 'needs_confirmation' },
      ],
    });
    const res = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });

    assert.equal(res.handoff.lines.length, 1);
    assert.equal(res.exclusions.length, 2);
    assert.equal(res.handoff.lines.length + res.exclusions.length, 3, 'counts in equal counts out');

    const smudged = res.exclusions.find((h) => h.shop_line_no === 2);
    assert.equal(smudged.original_list_line, 'somthing smudged', 'the original wording survives so Warwick can see what was dropped');
    assert.ok(smudged.reason.length > 0);
  } finally { await client.end(); }
});

test('AC5 (db): a shoppable line with no provenance row is refused, not shopped', gate, async () => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, {
      status: 'READY_TO_SHOP',
      lines: [{ line_no: 1, raw_reading: 'richmond sausages', quantity: 1, matched_regular_id: REG_RICHMOND, status: 'matched', provenance: false }],
    });
    await assert.rejects(
      () => buildHandoffFromDb(query, { shopRef: shop.shop_ref }),
      (e) => e.code === 'LINE_WITHOUT_PROVENANCE',
    );
  } finally { await client.end(); }
});

// =====================================================================
// AC6 - DURABLE ACROSS PROCESS DEATH.
//
// Two real OS processes. One claims and is SIGKILLed mid-flight. The other
// picks the work up. Inspection is not proof here: persistence is a claim about
// the future and only kill-and-revive tests it.
// =====================================================================

function runWorker(shopId, writerId, leaseMs, hold) {
  const args = [path.join(__dirname, 'test', 'claimWorker.js'), String(shopId), writerId, String(leaseMs)];
  if (hold) args.push('--hold');
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ASDAIR_WRITE_DB_URL: DB_URL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { err += d.toString(); });
  return {
    child,
    firstLine: () => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`worker ${writerId} printed nothing in 20s. stderr: ${err}`)), 20000);
      const check = setInterval(() => {
        if (out.includes('\n')) { clearInterval(check); clearTimeout(timer); resolve(JSON.parse(out.split('\n')[0])); }
        if (child.exitCode !== null && !out.includes('\n')) {
          clearInterval(check); clearTimeout(timer);
          reject(new Error(`worker ${writerId} exited ${child.exitCode} with no output. stderr: ${err}`));
        }
      }, 50);
    }),
  };
}

test('AC6 (db): a SIGKILLed writer loses the lease, and the revived writer RESUMES without double-shopping', gate, async (t) => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, { status: 'READY_TO_SHOP', lines: RICHMOND_AND_ARIEL });
    const { handoff } = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });
    await openHandoff(query, { shopId: shop.id, handoff, openedBy: 'dbtest' });

    // ---- process A claims, records position, and is then killed outright ----
    const LEASE_MS = 2000;
    const a = runWorker(shop.id, 'writer-A', LEASE_MS, true);
    const claimedA = await a.firstLine();
    assert.equal(claimedA.claimed, true, 'process A must win the claim');
    assert.deepEqual(claimedA.progress.lines_done, [1], 'A durably recorded that line 1 is done');

    a.child.kill('SIGKILL');
    await new Promise((resolve) => a.child.on('exit', resolve));
    assert.notEqual(a.child.exitCode, 0, 'A must have died, not exited cleanly - a graceful exit is not the failure being tested');

    // The position survived the death of the process that wrote it.
    const afterDeath = await peekHandoff(query, { requestId: claimedA.requestId });
    assert.deepEqual(afterDeath.progress.lines_done, [1], 'the work already done must survive the crash');
    assert.ok(['queued', 'claimed', 'running'].includes(afterDeath.status),
      `the request must still be LIVE after its writer died, got ${afterDeath.status}`);

    // ---- while A's lease is still live, nobody else may take the trolley ----
    const tooEarly = await claimHandoff(query, { shopId: shop.id, writerId: 'writer-B', leaseMs: LEASE_MS });
    assert.equal(tooEarly, null, 'a live lease is a live lease even when its owner is already dead - no double-shopping window');

    // ---- once the lease expires on the DATABASE clock, B resumes ----
    await new Promise((r) => setTimeout(r, LEASE_MS + 750));
    const b = runWorker(shop.id, 'writer-B', LEASE_MS, false);
    const claimedB = await b.firstLine();
    await new Promise((resolve) => b.child.on('exit', resolve));

    assert.equal(claimedB.claimed, true, 'B must be able to pick the work up after the lease expires');
    assert.equal(claimedB.requestId, claimedA.requestId,
      'B RESUMED the same request - a second request would be a second trolley');
    assert.deepEqual(claimedB.progress.lines_done, [1],
      'B inherited the position rather than starting again: line 1 is not shopped twice');

    // ---- and there is still exactly ONE live request for this shop ----
    const live = await query(
      `select count(*)::int as n from asdair.browser_build_request
        where shop_id = $1 and status not in ('complete','failed','cancelled')`,
      [shop.id],
    );
    assert.equal(live.rows[0].n, 1, 'bbr_one_live_per_shop held across a crash and a takeover');
  } finally { await client.end(); }
});

test('AC6 (db): openHandoff is idempotent - a repeated handoff RESUMES rather than queueing a second', gate, async () => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, { status: 'READY_TO_SHOP', lines: RICHMOND_AND_ARIEL });
    const { handoff } = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });

    const first = await openHandoff(query, { shopId: shop.id, handoff, openedBy: 'dbtest' });
    const second = await openHandoff(query, { shopId: shop.id, handoff, openedBy: 'dbtest' });

    assert.equal(first.created, true);
    assert.equal(second.created, false, 'the second open must not create a second request');
    assert.equal(second.request.id, first.request.id);

    const live = await query(
      `select count(*)::int as n from asdair.browser_build_request
        where shop_id = $1 and status not in ('complete','failed','cancelled')`,
      [shop.id],
    );
    assert.equal(live.rows[0].n, 1);
  } finally { await client.end(); }
});

// =====================================================================
// The determinism the whole artefact rests on, proven against real rows.
// =====================================================================

test('(db): the same reconciled rows produce a byte-identical artefact', gate, async () => {
  const { client, query } = await connect();
  try {
    const shop = await seedShop(query, { status: 'READY_TO_SHOP', lines: RICHMOND_AND_ARIEL });
    const a = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });
    const b = await buildHandoffFromDb(query, { shopRef: shop.shop_ref });
    assert.equal(JSON.stringify(a.handoff), JSON.stringify(b.handoff),
      'idempotence is what makes a repeated handoff safe; a clock or a random id here would break it');
    assert.equal(a.handoff.packet_fingerprint, b.handoff.packet_fingerprint);
  } finally { await client.end(); }
});
