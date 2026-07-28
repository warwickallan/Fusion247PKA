// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/commandLedger.test.js
//
// THE SEPARATION OF THE MACHINE LEDGER FROM THE HUMAN'S TO-DO LIST, PROVED
// AGAINST REAL STATE RATHER THAN ASSERTED IN PROSE.
//
// The defect: the pipeline kept its command / resume / outbox bookkeeping in
// `asdair.pending_action`, the table the Cockpit and the Telegram status card
// surface to Warwick as OUTSTANDING ACTIONS. Filtering it in the UI was
// explicitly rejected - that hides the symptom and leaves the confusion in the
// data - so migration 009 gave the two concepts two homes.
//
// What is REAL in here:
//   * pipeline/store.js, commands.js, runPipeline.js, runtime.js   verbatim
//   * migrate-command-ledger.js, the backfill Larry will run       verbatim
//   * services/asdair/shop/shopStore.js                            verbatim
//   * an in-memory pg carrying pipeline_command_idem_uniq (TOTAL), the two
//     migration-009 CHECK constraints, and pending_action_key_uniq (PARTIAL)
//
// NO DATABASE. NO NETWORK. NO CREDENTIALS FILE IS OPENED OR READ.
// Synthetic fixtures; never real household data.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeHarness, makeIntake, textUpdate, HOUSEHOLD_ID } from './test/harness.js';
import * as commands from './commands.js';
import * as store from './store.js';
import { runPipeline } from './runPipeline.js';
import { runOnce } from './runtime.js';
import { COMMANDS } from './commandNames.js';
import {
  LEDGER_KINDS, ledgerFamilyKey, ledgerIdempotencyKey, parseLedgerIdempotencyKey,
} from './keys.js';
import { migrateCommandLedger, classifyLegacyActionType } from './migrate-command-ledger.js';

const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };

async function receive(h, overrides = {}) {
  return commands.receiveList({
    householdId: HOUSEHOLD_ID,
    listDate: '2026-08-03',
    sourceKind: 'text',
    rawText: '3 gourmet cat food\n1 weetabix protein',
    actor: ACTOR,
    telegramChatId: '555',
    telegramMessageId: '900',
    telegramUpdateId: '1',
    ...overrides,
  }, h.deps);
}

const ledger = (h, kind, name) =>
  h.db.pipeline_command.filter((c) => c.kind === kind && c.command === name);

/**
 * Wind the fixture back to THE WORLD AS IT IS ON LIVE TODAY: a shop exists, and
 * the machine ledger does not - every command and card is still a
 * `cmd:`/`msg:` row in asdair.pending_action. That is the state the backfill
 * has to cope with.
 */
function legacyWorld(h) {
  h.db.pending_action.length = 0;
  h.db.pipeline_command.length = 0;
}

/** Every statement the fake client saw that WRITES asdair.pending_action. */
function pendingActionWrites(h) {
  return h.client.log
    .map((e) => e.sql)
    .filter((sql) => /^(INSERT INTO|UPDATE)\s+asdair\.pending_action/i.test(sql));
}

// =====================================================================
// 1. A REPEATED COMMAND IS THE SAME ROW - AND THE UNIQUE INDEX SAYS SO
// =====================================================================

test('a repeated command resolves to the SAME pipeline_command row, and the UNIQUE INDEX is what decides', async () => {
  const h = makeHarness();
  await receive(h);

  const first = await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  const second = await commands.buildShop({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);

  assert.equal(first.recorded.created, true);
  assert.equal(second.recorded.created, false, 'a repeat recorded a second command');
  assert.equal(second.recorded.action_id, first.recorded.action_id,
    'the repeat did not resolve to the SAME row');
  assert.equal(ledger(h, 'command', COMMANDS.BUILD_SHOP).length, 1);

  // THE INDEX, NOT A MOCK. The second attempt really did issue an INSERT
  // carrying the same idempotency_key, and the database refused it - if this
  // code had checked-then-inserted there would be no second INSERT at all.
  const inserts = h.client.log.filter((e) => /^INSERT INTO asdair\.pipeline_command/i.test(e.sql)
    && e.params[2] === COMMANDS.BUILD_SHOP);
  assert.equal(inserts.length, 2, 'the repeat must ATTEMPT the insert and be refused by the index');
  const keys = inserts.map((e) => e.params[4]);
  assert.equal(keys[0], keys[1], 'the two attempts used different keys - the index was never exercised');

  // And the key is exactly what keys.js derives, spelled out here so a silent
  // change of shape is a failing test rather than a surprise on live.
  const family = ledgerFamilyKey({
    kind: LEDGER_KINDS.COMMAND, householdId: HOUSEHOLD_ID, name: COMMANDS.BUILD_SHOP, key: REF,
  });
  assert.equal(keys[0], ledgerIdempotencyKey(family, 0));
  assert.equal(ledger(h, 'command', COMMANDS.BUILD_SHOP)[0].args.ledger_key, family,
    'the row must carry its own family, so the ledger is readable without parsing keys');
  assert.equal(ledger(h, 'command', COMMANDS.BUILD_SHOP)[0].args.ledger_action_key, REF,
    'the row must still carry migration 006\'s action_key - a downstream idempotency key is derived from it');
});

test('a correction still produces the SAME downstream add_list_item idempotency key it always did', async () => {
  // stepApplyCorrections builds `<command key>:correction` for the intent it
  // sends to asdairCommands. That key belongs to a component this work package
  // does not own, so moving the ledger must not have changed its shape.
  const h = makeHarness();
  await receive(h);
  await commands.correctLine({ shopRef: REF, actor: ACTOR, itemName: 'Arla 4pt', requestedQty: 2 }, h.deps);
  const pending = await store.listPendingCommands(h.deps, h.db.shop[0].id);
  const correction = pending.find((c) => c.command === COMMANDS.CORRECT_LINE);
  assert.equal(correction.key, `${REF}:arla 4pt`,
    'the command key changed shape - the downstream intent key would change with it');
});

test('the UNIQUE index really is TOTAL: a hand-written duplicate key is refused even against a DONE row', async () => {
  const h = makeHarness();
  await receive(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  const row = ledger(h, 'command', COMMANDS.BUILD_SHOP)[0];
  await store.resolveCommand(h.deps, row.id, 'done', 'consumed by a test');
  assert.equal(ledger(h, 'command', COMMANDS.BUILD_SHOP)[0].status, 'done');

  // Re-inserting the SAME key writes nothing, because pipeline_command_idem_uniq
  // has no WHERE clause. This is precisely why recordLedgerEntry carries a
  // generation, and it must be true of the harness or the next test proves
  // nothing.
  const before = h.db.pipeline_command.length;
  const res = await h.deps.writeQuery(
    `INSERT INTO asdair.pipeline_command (shop_id, kind, command, args, idempotency_key, status)
     VALUES ($1, $2, $3, $4::jsonb, $5, 'pending')
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [row.shop_id, 'command', COMMANDS.BUILD_SHOP, '{}', row.idempotency_key],
  );
  assert.equal((res.rows || []).length, 0, 'the total unique index did not refuse a finished row\'s key');
  assert.equal(h.db.pipeline_command.length, before);
});

// =====================================================================
// 2. THE CONSUME CONTRACT SURVIVES THE MOVE
// =====================================================================

test('RE-ISSUE: a CONSUME command asked for again AFTER it was consumed is a genuinely new unit of work', async () => {
  // This is the guarantee a naive port would have destroyed. Migration 006's
  // index was unique only WHILE PENDING; migration 009's is total. Without the
  // generation, "Build ASDA basket" after a pause would collide with the
  // finished row and nothing would ever happen.
  const h = makeHarness();
  await receive(h);

  const first = await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  const repeat = await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  assert.equal(repeat.recorded.created, false, 'a repeat WHILE OUTSTANDING must adopt, not stack');

  await store.resolveCommand(h.deps, first.recorded.action_id, 'done', 'consumed by a test');

  const again = await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  assert.equal(again.recorded.created, true,
    'asking again after the command was consumed was swallowed - the CONSUME contract is broken');
  assert.notEqual(again.recorded.action_id, first.recorded.action_id);

  const rows = ledger(h, 'command', COMMANDS.REQUEST_BASKET_BUILD).sort((a, b) => a.id - b.id);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.status), ['done', 'pending']);
  assert.deepEqual(
    rows.map((r) => parseLedgerIdempotencyKey(r.idempotency_key).generation),
    ['0', '1'],
    'the second issue must be a new GENERATION of the same family',
  );
  // Same family, so a future reader can still see they are the same command.
  assert.equal(rows[0].args.ledger_key, rows[1].args.ledger_key);
});

test('RE-ISSUE never hands back a finished row: recordLedgerEntry re-derives when its generation was taken', async () => {
  const h = makeHarness();
  await receive(h);
  const shopId = h.db.shop[0].id;

  // Resolve the generation the caller is ABOUT to compute, between the count and
  // the insert. Without the re-derive loop the caller would adopt a `done` row
  // and the command would be silently lost.
  let armed = true;
  const racing = {
    ...h.deps,
    async readQuery(sql, params) {
      const res = await h.deps.readQuery(sql, params);
      if (armed && /count\(\*\)::int AS n FROM asdair\.pipeline_command/i.test(String(sql))) {
        armed = false;
        const live = h.db.pipeline_command.find((c) => c.status === 'pending' && c.kind === 'command'
          && c.command === COMMANDS.RETRY_STAGE);
        if (live) await store.resolveCommand(h.deps, live.id, 'done', 'consumed by the racing runner');
      }
      return res;
    },
  };

  const first = await commands.retryStage({ shopRef: REF, actor: ACTOR }, h.deps);
  const second = await commands.retryStage({ shopRef: REF, actor: ACTOR }, racing);

  assert.equal(second.recorded.created, true, 'the caller adopted a FINISHED row instead of re-deriving');
  assert.notEqual(second.recorded.action_id, first.recorded.action_id);
  const rows = ledger(h, 'command', COMMANDS.RETRY_STAGE).sort((a, b) => a.id - b.id);
  assert.deepEqual(rows.map((r) => r.status), ['done', 'pending']);
  assert.equal(rows[1].shop_id, shopId);
});

test('a LATCH is still permanent, and everIssued still reads it after the move', async () => {
  const h = makeHarness();
  await receive(h);
  await commands.confirmInterpretation({ shopRef: REF, actor: 'cockpit:warwick' }, h.deps);
  const issued = await store.listIssuedCommandNames(h.deps, h.db.shop[0].id);
  assert.ok(issued.includes(COMMANDS.CONFIRM_INTERPRETATION));
  assert.ok(issued.includes(COMMANDS.RECEIVE_LIST));

  // Still true once the row is settled - which is the whole point of a latch.
  const latch = ledger(h, 'command', COMMANDS.CONFIRM_INTERPRETATION)[0];
  await store.resolveCommand(h.deps, latch.id, 'done', 'settled by a test');
  const after = await store.listIssuedCommandNames(h.deps, h.db.shop[0].id);
  assert.ok(after.includes(COMMANDS.CONFIRM_INTERPRETATION),
    'a consumed latch stopped being "ever issued" - the shop would park forever');
});

test('a resolution is written exactly ONCE - a second attempt is refused, not silently repeated', async () => {
  const h = makeHarness();
  await receive(h);
  await commands.cancelShop({ shopRef: REF, actor: ACTOR }, h.deps);
  const row = ledger(h, 'command', COMMANDS.CANCEL_SHOP)[0];

  await store.resolveCommand(h.deps, row.id, 'done', 'first');
  await assert.rejects(() => store.resolveCommand(h.deps, row.id, 'done', 'second'), /is not live/);
  assert.equal(ledger(h, 'command', COMMANDS.CANCEL_SHOP)[0].result.note, 'first',
    'the record of how a command ended was overwritten');
});

// =====================================================================
// 3. DURABILITY ACROSS A RESTART
// =====================================================================

test('DURABLE: a command and a queued card survive a brand-new process reading the same database', async () => {
  const h = makeHarness();
  await receive(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // interpret
  await runPipeline(HANDLE, h.deps);   // plan -> queues a card

  // A NEW deps object over the SAME durable state - the resumability contract.
  const fresh = makeHarness({ seed: h.db });
  const snapshot = await store.readSnapshot(fresh.deps, HANDLE);
  assert.equal(snapshot.shop.status, h.db.shop[0].status);
  assert.ok((await store.listOutbox(fresh.deps)).length >= 1,
    'a queued card did not survive the restart - Warwick would never be told');
  assert.ok((await store.listIssuedCommandNames(fresh.deps, h.db.shop[0].id)).includes(COMMANDS.BUILD_SHOP));
});

test('DURABLE: an outbox card that fails to send stays queued, and is sent exactly once when it can be', async () => {
  const h = makeHarness();
  await receive(h);
  const shopId = h.db.shop[0].id;
  await store.enqueueMessage(h.deps, {
    householdId: HOUSEHOLD_ID, shopId, kind: 'progress', key: `${REF}:browser.queued`,
    payload: { shopRef: REF, stage: 'browser build requested' },
  });
  // The MILESTONE is the key, not the moment: queueing it again adopts.
  const again = await store.enqueueMessage(h.deps, {
    householdId: HOUSEHOLD_ID, shopId, kind: 'progress', key: `${REF}:browser.queued`,
    payload: { shopRef: REF, stage: 'browser build requested' },
  });
  assert.equal(again.created, false);
  assert.equal(ledger(h, 'outbox', 'progress').length, 1);

  const queued = await store.listOutbox(h.deps, { shopId });
  assert.equal(queued.length, 1);
  assert.equal(queued[0].kind, 'progress');
  assert.equal(queued[0].payload.shopRef, REF);

  await store.resolveCommand(h.deps, queued[0].id, 'done', 'sent');
  assert.equal((await store.listOutbox(h.deps, { shopId })).length, 0);
});

// =====================================================================
// 4. NOTHING THE PIPELINE WRITES REACHES asdair.pending_action
// =====================================================================

test('SEPARATION: a WHOLE lifecycle writes not one row - and issues not one statement - against pending_action', async () => {
  const h = makeHarness();

  // Intake, a tap, interpretation, planning, a question, an answer, a basket
  // request, a confirmation, reconciliation, a failure and its retry: every
  // durable thing the pipeline does for its own bookkeeping.
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([textUpdate({ updateId: 1 })]) });
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });   // interpret
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });   // plan
  await commands.correctLine({ shopRef: REF, actor: ACTOR, itemName: 'Arla 4pt', requestedQty: 2 }, h.deps);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });   // corrections
  await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });
  await commands.cancelShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });   // cancel
  await runOnce(h.deps, { householdId: HOUSEHOLD_ID, intake: makeIntake([]) });   // housekeeping

  assert.ok(h.db.pipeline_command.length >= 5, 'the lifecycle should have produced a real ledger');
  assert.equal(h.db.pending_action.length, 0,
    'the pipeline put its own bookkeeping in the list Warwick is shown as OUTSTANDING ACTIONS');
  assert.deepEqual(pendingActionWrites(h), [],
    'the pipeline issued a WRITE against asdair.pending_action');
});

test('SEPARATION: a shop that FAILS still writes nothing to pending_action', async () => {
  const h = makeHarness({ modelThrows: 'the vision gateway refused the request' });
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'photo',
    rawMediaPath: 'C:/.fusion247/asdair/shopper-media/fake.jpg', needsReview: true,
    actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // RECEIVED  -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);   // the model refuses -> FAILED
  await commands.retryStage({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // resume to TRANSCRIBING
  await runPipeline(HANDLE, h.deps);   // and fail again

  assert.equal(h.db.shop[0].status, 'FAILED');
  assert.ok(ledger(h, 'outbox', 'failure').length >= 1, 'the failure card must still be queued');
  assert.equal(h.db.pending_action.length, 0);
  assert.deepEqual(pendingActionWrites(h), []);
});

test('SEPARATION: a GENUINE human action still lands in pending_action, and is the only thing listed there', async () => {
  const h = makeHarness();
  await receive(h);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);
  await runPipeline(HANDLE, h.deps);

  // "Add Wall's to ASDA Favourites" - a real chore, written by whoever noticed
  // it (the browser runner), through the component that owns the table.
  await h.deps.shopStore.addPendingAction({
    household_id: HOUSEHOLD_ID,
    shop_id: h.db.shop[0].id,
    action_type: 'add_favourite',
    action_key: 'walls-vanilla-2l',
    payload: { product: "Wall's Vanilla 2L", why: 'not in Favourites, so it could not be added from the list' },
  });

  const listed = await store.listHouseholdActions(h.deps, HOUSEHOLD_ID);
  assert.equal(listed.length, 1, 'the human action list must show exactly the one real chore');
  assert.equal(listed[0].action_type, 'add_favourite');
  assert.equal(listed[0].payload.product, "Wall's Vanilla 2L");

  // The machine ledger is busy at the same moment, and none of it is in that list.
  assert.ok(h.db.pipeline_command.length >= 3);
  assert.equal(h.db.pending_action.length, 1);
});

test('SEPARATION: legacy cmd:/msg: rows are STILL filtered out of the human list, for the window before the backfill runs', async () => {
  const h = makeHarness();
  await receive(h);
  for (const actionType of ['cmd:buildShop', 'msg:plan_ready', 'add_favourite']) {
    await h.deps.shopStore.addPendingAction({
      household_id: HOUSEHOLD_ID, shop_id: h.db.shop[0].id,
      action_type: actionType, action_key: REF, payload: {},
    });
  }
  const listed = await store.listHouseholdActions(h.deps, HOUSEHOLD_ID);
  assert.deepEqual(listed.map((r) => r.action_type), ['add_favourite'],
    'a historical plumbing row was shown to Warwick as something he must do');
});

// =====================================================================
// 5. THE BACKFILL
// =====================================================================

/** Seed the legacy world: the ledger rows that exist on live TODAY. */
async function seedLegacy(h, rows) {
  for (const r of rows) {
    await h.deps.shopStore.addPendingAction({
      household_id: HOUSEHOLD_ID,
      shop_id: h.db.shop[0].id,
      action_type: r.action_type,
      action_key: r.action_key,
      payload: r.payload || {},
    });
    if (r.status && r.status !== 'pending') {
      const row = h.db.pending_action[h.db.pending_action.length - 1];
      await h.deps.shopStore.resolvePendingAction(row.id, { status: r.status, note: r.note || null });
    }
  }
}

const migrationDeps = (h) => ({ readQuery: h.deps.readQuery, writeQuery: h.deps.writeQuery });

test('BACKFILL: every legacy cmd:/msg: row is carried over with its status, payload and provenance', async () => {
  const h = makeHarness();
  await receive(h);
  legacyWorld(h);

  await seedLegacy(h, [
    { action_type: 'cmd:buildShop', action_key: REF, payload: { actor: ACTOR }, status: 'done', note: 'consumed by act:interpret' },
    { action_type: 'cmd:requestBasketBuild', action_key: REF, payload: { actor: ACTOR }, status: 'pending' },
    { action_type: 'msg:plan_ready', action_key: `${REF}:plan.ok`, payload: { shopRef: REF }, status: 'pending' },
    { action_type: 'msg:failure', action_key: `${REF}:act:interpret:TRANSCRIBING`, payload: { shopRef: REF }, status: 'abandoned' },
    { action_type: 'add_favourite', action_key: 'walls', payload: { product: "Wall's" }, status: 'pending' },
  ]);

  const report = await migrateCommandLedger(migrationDeps(h), { apply: true });
  assert.equal(report.ok, true, JSON.stringify(report.failed));
  assert.equal(report.scanned, 4, 'the genuine household action must not be scanned');
  assert.equal(report.moved.length, 4);

  // NOTHING IS LOST: every one is in the ledger, with its status and payload.
  const byKey = new Map(h.db.pipeline_command.map((c) => [`${c.kind}:${c.command}`, c]));
  assert.equal(byKey.get('command:buildShop').status, 'done');
  assert.equal(byKey.get('command:requestBasketBuild').status, 'pending');
  assert.equal(byKey.get('outbox:plan_ready').status, 'pending');
  assert.equal(byKey.get('outbox:plan_ready').args.shopRef, REF);
  assert.equal(byKey.get('outbox:failure').status, 'retired', "migration 006's 'abandoned' is 009's 'retired'");
  for (const c of h.db.pipeline_command) {
    assert.ok(c.result.migrated_from_pending_action, 'a carried-over row lost its provenance');
    assert.equal(c.args.household_id, HOUSEHOLD_ID);
    assert.ok(c.args.ledger_key, 'a carried-over row lost its ledger family');
  }

  // NOTHING IS MISREAD: every pending legacy row is retired with a pointer, and
  // the genuine household action is untouched.
  const legacyPending = h.db.pending_action.filter((a) => /^(cmd|msg):/.test(a.action_type) && a.status === 'pending');
  assert.equal(legacyPending.length, 0, 'a legacy plumbing row is still claiming to be an outstanding action');
  const retired = h.db.pending_action.filter((a) => a.action_type === 'cmd:requestBasketBuild')[0];
  assert.equal(retired.status, 'abandoned');
  assert.match(retired.note, /now lives in asdair\.pipeline_command as command:1:requestBasketBuild:SHOP-2026-08-03#/);
  const human = h.db.pending_action.find((a) => a.action_type === 'add_favourite');
  assert.equal(human.status, 'pending', 'the backfill retired a GENUINE household action');

  // And the human list is now exactly the one real chore.
  assert.deepEqual((await store.listHouseholdActions(h.deps, HOUSEHOLD_ID)).map((r) => r.action_type),
    ['add_favourite']);
});

test('BACKFILL: a carried-over PENDING command is adopted by the next tap, not duplicated', async () => {
  // The one thing a careless carry-over would break: a command that was
  // outstanding before the move must still be outstanding after it, and the
  // button that issued it must still be a no-op.
  const h = makeHarness();
  await receive(h);
  legacyWorld(h);
  await seedLegacy(h, [
    { action_type: 'cmd:buildShop', action_key: REF, payload: { actor: ACTOR }, status: 'done' },
    { action_type: 'cmd:requestBasketBuild', action_key: REF, payload: { actor: ACTOR }, status: 'pending' },
  ]);
  await migrateCommandLedger(migrationDeps(h), { apply: true });

  const tap = await commands.requestBasketBuild({ shopRef: REF, actor: ACTOR }, h.deps);
  assert.equal(tap.recorded.created, false, 'the tap stacked a SECOND outstanding basket request');
  assert.equal(tap.duplicate, true);
  assert.equal(ledger(h, 'command', COMMANDS.REQUEST_BASKET_BUILD).length, 1);

  // A command that was already CONSUMED before the move can still be re-issued.
  const rebuild = await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  assert.equal(rebuild.recorded.created, true, 'a spent command could not be issued again after the move');
  assert.equal(ledger(h, 'command', COMMANDS.BUILD_SHOP).length, 2);
});

test('BACKFILL: running it twice changes nothing the second time', async () => {
  const h = makeHarness();
  await receive(h);
  legacyWorld(h);
  await seedLegacy(h, [
    { action_type: 'cmd:buildShop', action_key: REF, payload: {}, status: 'done' },
    { action_type: 'cmd:cancelShop', action_key: REF, payload: {}, status: 'pending' },
    { action_type: 'msg:plan_ready', action_key: `${REF}:plan.ok`, payload: {}, status: 'pending' },
  ]);

  const first = await migrateCommandLedger(migrationDeps(h), { apply: true });
  const after = JSON.stringify({ pc: h.db.pipeline_command, pa: h.db.pending_action });

  const second = await migrateCommandLedger(migrationDeps(h), { apply: true });
  const third = await migrateCommandLedger(migrationDeps(h), { apply: true });

  assert.equal(first.moved.length, 3);
  assert.equal(second.moved.length, 0, 'the second run carried rows over again');
  assert.equal(second.already_migrated.length, 3);
  assert.equal(third.retired.length, 0, 'the third run rewrote history');
  assert.equal(JSON.stringify({ pc: h.db.pipeline_command, pa: h.db.pending_action }), after,
    'a re-run mutated the database');
});

test('BACKFILL: the dry run is the default and writes absolutely nothing', async () => {
  const h = makeHarness();
  await receive(h);
  legacyWorld(h);
  await seedLegacy(h, [
    { action_type: 'cmd:buildShop', action_key: REF, payload: {}, status: 'pending' },
    { action_type: 'msg:plan_ready', action_key: `${REF}:plan.ok`, payload: {}, status: 'pending' },
  ]);
  const before = JSON.stringify({ pc: h.db.pipeline_command, pa: h.db.pending_action });

  const report = await migrateCommandLedger(migrationDeps(h));
  assert.equal(report.applied, false);
  assert.equal(report.scanned, 2);
  assert.equal(report.moved.length, 2);
  assert.ok(report.moved.every((m) => m.planned === true));
  assert.equal(JSON.stringify({ pc: h.db.pipeline_command, pa: h.db.pending_action }), before,
    'the DRY RUN wrote to the database');

  // And the dry run's plan is exactly what the apply then does.
  const planned = report.moved.map((m) => m.idempotency_key);
  await migrateCommandLedger(migrationDeps(h), { apply: true });
  assert.deepEqual(h.db.pipeline_command.map((c) => c.idempotency_key).sort(), planned.sort(),
    'the dry run promised keys the apply did not write');
});

test('BACKFILL: several settled generations of one command come across in historical order', async () => {
  const h = makeHarness();
  await receive(h);
  legacyWorld(h);
  // Migration 006's index was partial, so the same key legitimately appears
  // several times over a shop's life - once per issue-and-consume cycle.
  await seedLegacy(h, [
    { action_type: 'cmd:retryStage', action_key: REF, payload: { attempt: 1 }, status: 'done' },
    { action_type: 'cmd:retryStage', action_key: REF, payload: { attempt: 2 }, status: 'done' },
    { action_type: 'cmd:retryStage', action_key: REF, payload: { attempt: 3 }, status: 'pending' },
  ]);
  const report = await migrateCommandLedger(migrationDeps(h), { apply: true });
  assert.equal(report.ok, true, JSON.stringify(report.failed));

  const rows = ledger(h, 'command', COMMANDS.RETRY_STAGE).sort((a, b) => a.id - b.id);
  assert.equal(rows.length, 3, 'a repeated command lost one of its historical rows');
  assert.deepEqual(rows.map((r) => parseLedgerIdempotencyKey(r.idempotency_key).generation), ['0', '1', '2']);
  assert.deepEqual(rows.map((r) => r.args.attempt), [1, 2, 3]);
  assert.deepEqual(rows.map((r) => r.status), ['done', 'done', 'pending']);

  // The live outstanding one is still the one a tap adopts.
  const tap = await commands.retryStage({ shopRef: REF, actor: ACTOR }, h.deps);
  assert.equal(tap.recorded.created, false);
  assert.equal(tap.recorded.action_id, rows[2].id);
});

test('BACKFILL: it refuses to run at all if migration 009 has not been applied', async () => {
  const h = makeHarness();
  const deps = {
    ...migrationDeps(h),
    async readQuery(sql, params) {
      if (/to_regclass/i.test(String(sql))) return { rows: [{ table_name: null }], rowCount: 1 };
      return h.deps.readQuery(sql, params);
    },
  };
  await assert.rejects(() => migrateCommandLedger(deps, { apply: true }),
    /asdair\.pipeline_command does not exist/);
});

test('BACKFILL: an unmigratable row is REPORTED, never dropped, and never stops the others', async () => {
  const h = makeHarness();
  await receive(h);
  legacyWorld(h);
  await seedLegacy(h, [
    { action_type: 'cmd:buildShop', action_key: REF, payload: {}, status: 'pending' },
    { action_type: 'msg:plan_ready', action_key: `${REF}:plan.ok`, payload: {}, status: 'pending' },
  ]);
  // A key carrying the generation separator cannot be represented unambiguously.
  h.db.pending_action[1].action_key = `${REF}#tampered`;

  const report = await migrateCommandLedger(migrationDeps(h), { apply: true });
  assert.equal(report.ok, false, 'an unmigratable row was reported as a clean run');
  assert.equal(report.failed.length, 1);
  assert.equal(report.failed[0].action_type, 'msg:plan_ready');
  assert.equal(report.moved.length, 1, 'one bad row stopped the good ones');
  // The row it could not move is UNTOUCHED - not retired, not lost.
  assert.equal(h.db.pending_action[1].status, 'pending');
});

test('classifyLegacyActionType recognises the two legacy namespaces and nothing else', () => {
  assert.deepEqual(classifyLegacyActionType('cmd:buildShop'), { kind: 'command', name: 'buildShop' });
  assert.deepEqual(classifyLegacyActionType('msg:plan_ready'), { kind: 'outbox', name: 'plan_ready' });
  assert.equal(classifyLegacyActionType('add_favourite'), null);
  assert.equal(classifyLegacyActionType(null), null);
});

// =====================================================================
// 6. THE KEY BUILDERS THEMSELVES
// =====================================================================

test('a ledger key round-trips, and refuses anything it could not represent unambiguously', () => {
  const family = ledgerFamilyKey({ kind: 'command', householdId: 1, name: 'correctLine', key: 'SHOP-2026-08-03:arla 4pt' });
  assert.equal(family, 'command:1:correctLine:SHOP-2026-08-03:arla 4pt');
  const key = ledgerIdempotencyKey(family, 3);
  assert.deepEqual(parseLedgerIdempotencyKey(key), { family, generation: '3' });

  assert.throws(() => ledgerFamilyKey({ kind: 'command', householdId: 1, name: 'x', key: 'a#b' }), /may not contain/);
  assert.throws(() => ledgerFamilyKey({ kind: 'letter', householdId: 1, name: 'x', key: 'y' }), /ledger kind must be/);
  assert.throws(() => ledgerFamilyKey({ kind: 'command', householdId: '', name: 'x', key: 'y' }), /householdId is required/);
  assert.throws(() => ledgerIdempotencyKey(family, -1), /non-negative integer/);
  assert.throws(() => parseLedgerIdempotencyKey('no-generation-here'), /not a ledger idempotency key/);
});

test('two households issuing the same command for the same ref never share a ledger row', async () => {
  const h = makeHarness({ seed: { households: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] } });
  await receive(h);
  await receive(h, { householdId: 2, telegramChatId: '556', telegramMessageId: '901' });
  assert.equal(h.db.shop.length, 2, 'the fixture must give two households the same shop_ref');

  await commands.buildShop({ shopRef: REF, householdId: 1, actor: ACTOR }, h.deps);
  await commands.buildShop({ shopRef: REF, householdId: 2, actor: ACTOR }, h.deps);
  const rows = ledger(h, 'command', COMMANDS.BUILD_SHOP);
  assert.equal(rows.length, 2, 'one household adopted the other household\'s command');
  assert.notEqual(rows[0].idempotency_key, rows[1].idempotency_key);
});
