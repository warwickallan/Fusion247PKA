// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/invariants.test.js
//
// THE PROMISES THIS PIPELINE MAKES, ASSERTED RATHER THAN DOCUMENTED.
//
// Two kinds of proof live here:
//
//   BEHAVIOURAL - the pipeline is RUN and the ORDER of what it reached for is
//   checked. "The catalogue is loaded before any interpretation" is only worth
//   anything if it is a property of the call sequence, not of a comment.
//
//   STRUCTURAL - the SOURCE of every module in this folder is scanned. A
//   checkout path cannot be "unlikely"; it must be absent, and absence is only
//   provable by looking. Same discipline as
//   services/asdair/bot/noPolling.test.js.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeHarness, makeCatalogue, HOUSEHOLD_ID } from './test/harness.js';
import * as commands from './commands.js';
import { runPipeline } from './runPipeline.js';
import { STEPS } from './stages.js';
import { COMMAND_NAMES } from './commandNames.js';
import { buildLine, LINE_STATUSES, withCanonicalNames, INTERPRETATION_COLUMNS, _internal as lineSql } from './shopLines.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REF = 'SHOP-2026-08-03';
const ACTOR = 'telegram:555';
const HANDLE = { shopRef: REF };

/** Every module in this folder (tests and test support included). */
function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      // Scan OUR source only. Installed dependencies are not this module's
      // capabilities: the `pg` driver legitimately contains the word "password"
      // and connection strings, and walking into node_modules turns these
      // invariants into an assertion about npm rather than about us. Excluded
      // by scope, NOT by relaxing the patterns - the patterns are the point.
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full);
        continue;
      }
      if (/\.(js|mjs)$/.test(entry.name)) out.push(full);
    }
  };
  walk(HERE);
  return out;
}

/** The shipping modules only - not the tests, which legitimately name the
 *  forbidden words in order to assert they are absent. */
function shippingFiles() {
  return sourceFiles().filter((f) => !/\.test\.(js|mjs)$/.test(f) && !/[\\/]test[\\/]/.test(f));
}

const read = (f) => fs.readFileSync(f, 'utf8');

/**
 * Strip comments so a forbidden-capability scan reads CODE, not prose.
 *
 * This matters more than it looks. A file that says "this module never checks
 * out and never sets checked_out" is doing exactly the right thing, and a
 * scanner that trips on the sentence would push every such explanation out of
 * the codebase - the test would be actively making the code worse. So the
 * prohibition is proven against what executes, and the documentation of it is
 * left alone.
 *
 * A small state machine rather than a regex, because '//' inside a string
 * literal (an API base, say) is not a comment and must not eat the rest of the
 * line.
 */
export function stripComments(src) {
  let out = '';
  let i = 0;
  let mode = 'code';
  let quote = '';
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && next === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && next === '*') { mode = 'block'; i += 2; continue; }
      if (c === '\'' || c === '"' || c === '`') { mode = 'string'; quote = c; }
      out += c; i += 1; continue;
    }
    if (mode === 'string') {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === quote) mode = 'code';
      out += c; i += 1; continue;
    }
    if (mode === 'line') {
      if (c === '\n') { mode = 'code'; out += c; }
      i += 1; continue;
    }
    // block
    if (c === '*' && next === '/') { mode = 'code'; i += 2; continue; }
    if (c === '\n') out += c;
    i += 1;
  }
  return out;
}

const readCode = (f) => stripComments(read(f));

// =====================================================================
// THE CATALOGUE INVARIANT
// =====================================================================

test('THE INVARIANT: the catalogue is loaded BEFORE the model is asked to read anything', async () => {
  const h = makeHarness({
    modelLines: [{ line_no: 1, raw_reading: '3 gourmet cat food', quantity: 3 }],
  });
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'photo',
    rawMediaPath: 'C:/fake/list.jpg', actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING
  await runPipeline(HANDLE, h.deps);   // the interpretation

  const order = h.calls.map((c) => c.dep);
  const catalogueAt = order.indexOf('loadCatalogue');
  const promptAt = order.indexOf('buildGroundedPrompt');
  const modelAt = order.indexOf('interpretPhoto');
  const identityAt = order.indexOf('resolveAll');

  assert.notEqual(catalogueAt, -1, 'the catalogue was never loaded at all');
  assert.notEqual(modelAt, -1, 'the model was never called');
  assert.ok(catalogueAt < promptAt, 'the grounded prompt was built before the catalogue was loaded');
  assert.ok(catalogueAt < modelAt, 'THE MODEL WAS ASKED TO READ BEFORE THE CATALOGUE WAS LOADED');
  assert.ok(modelAt < identityAt, 'identity must be resolved from the catalogue AFTER the model has read');

  // And the prompt the model got was built FROM the catalogue - not an empty one.
  const promptCall = h.calls.find((c) => c.dep === 'interpretPhoto');
  assert.equal(promptCall.candidates, 3, 'the model was grounded against an empty catalogue');
  assert.ok(promptCall.promptChars > 200, 'the grounded prompt was suspiciously small');
});

test('THE INVARIANT: the TEXT path also loads the catalogue before it interprets', async () => {
  const h = makeHarness();
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: '3 gourmet cat food', actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
  await runPipeline(HANDLE, h.deps);

  const order = h.calls.map((c) => c.dep);
  assert.ok(order.indexOf('loadCatalogue') !== -1);
  assert.ok(order.indexOf('loadCatalogue') < order.indexOf('shopperRoute'),
    'a typed list was parsed before the catalogue was loaded');
  assert.ok(order.indexOf('shopperRoute') < order.indexOf('resolveAll'),
    'identity must come from the catalogue after the list has been split');
});

test('THE INVARIANT: interpretation REFUSES to run when the catalogue is empty or absent', async () => {
  // Driven down the PHOTO path so "the model was never reached" is a meaningful
  // assertion: an ungrounded read is the measured-wrong method, and it must not
  // even be attempted, let alone paid for.
  for (const bad of [null, makeCatalogue({ regulars: [] })]) {
    const h = makeHarness({ catalogue: bad, modelLines: [{ line_no: 1, raw_reading: 'milk', quantity: 1 }] });
    await commands.receiveList({
      householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'photo',
      rawMediaPath: 'C:/fake/list.jpg', actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
    }, h.deps);
    await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);
    await runPipeline(HANDLE, h.deps);   // -> TRANSCRIBING

    const r = await runPipeline(HANDLE, h.deps);
    assert.equal(r.ok, false, 'an ungrounded interpretation was allowed to proceed');
    assert.match(r.error, /catalogue/i);
    // The model was never reached, and nothing was written.
    assert.equal(h.calls.some((c) => c.dep === 'interpretPhoto'), false,
      'the model was called despite the catalogue being unusable');
    assert.equal(h.db.shopping_list_items.length, 0);
    assert.equal(h.db.shop_line.length, 0);
  }
});

test('THE INVARIANT: the model NEVER names a product - identity comes from our rows by id', async () => {
  // The model returns a reading that resolves to regular 11. Even if it also
  // handed back a product name, nothing downstream reads one: buildGroundedIntents
  // takes `canonical_name`, which withCanonicalNames looked up by id.
  const catalogue = makeCatalogue();
  const stored = [{ matched_regular_id: 11, raw_reading: '3 gormay cat fud', quantity: 3, status: 'matched' }];
  const named = withCanonicalNames(stored, catalogue);
  assert.equal(named[0].canonical_name, 'Gourmet cat food');

  // A model-claimed match to an id we do NOT hold cannot produce a name.
  const bogus = withCanonicalNames([{ matched_regular_id: 9999, raw_reading: 'x', status: 'matched' }], catalogue);
  assert.equal(bogus[0].canonical_name, null,
    'a product that does not exist must not acquire a name');
});

test('THE INVARIANT: a "matched" line with no regulars id is refused before it can be written', () => {
  assert.throws(
    () => buildLine(1, { line_no: 1, raw_reading: 'milk', status: 'matched', matched_regular_id: null }),
    /confident match to no product/,
  );
  // And the whole status vocabulary is pinned to migration 008's CHECK.
  assert.throws(() => buildLine(1, { line_no: 1, raw_reading: 'x', status: 'probably' }), /is not one of/);
  assert.deepEqual([...LINE_STATUSES].sort(),
    ['excluded', 'matched', 'needs_confirmation', 'possible_duplicate', 'unmatched_new_item', 'unreadable']);
});

test('THE INVARIANT: a quantity is never guessed - unknown stays null, out-of-range is refused', () => {
  assert.equal(buildLine(1, { line_no: 1, raw_reading: 'milk', status: 'unreadable', quantity: null }).quantity, null);
  assert.equal(buildLine(1, { line_no: 1, raw_reading: 'milk', status: 'unreadable' }).quantity, null,
    'an absent quantity must stay null - never defaulted to 1');
  for (const bad of [0, -1, 1000, 1.5, 'three']) {
    assert.throws(() => buildLine(1, { line_no: 1, raw_reading: 'milk', status: 'unreadable', quantity: bad }),
      /never guessed|1\.\.999/);
  }
});

test('the interpretation write CANNOT touch a human decision - the allowlist has no path to it', () => {
  for (const forbidden of ['confirmed_by', 'confirmed_at', 'list_item_id', 'corrected']) {
    assert.equal(INTERPRETATION_COLUMNS.includes(forbidden), false,
      `${forbidden} is writable by a re-read - a fresh guess could erase a human decision`);
  }
  // And the upsert guards on it in SQL, not merely in JavaScript.
  assert.match(lineSql.UPSERT_SQL, /WHERE asdair\.shop_line\.confirmed_by IS NULL/);
  assert.match(lineSql.UPSERT_SQL, /ON CONFLICT \(shop_id, line_no\) DO UPDATE/);
});

// =====================================================================
// NO CHECKOUT, NO PAYMENT, NO SLOT, NO SUBSTITUTION
// =====================================================================

test('NOTHING in this pipeline can check out, pay, book a slot or enter a password', () => {
  // Identifiers a real implementation of any of those would have to contain.
  const forbidden = [
    /\bchecked_out\b/i,
    /\bcheckout\s*\(/i,
    /\bplaceOrder\b/i,
    /\bsubmitOrder\b/i,
    /\bbookSlot\b/i,
    /\bbook_slot\b/i,
    /\bdeliverySlot\b/i,
    /\bpayNow\b/i,
    /\btakePayment\b/i,
    /\bcardNumber\b/i,
    /\bcvv\b/i,
    /\bpassword\b/i,
    /\bautoSubstitute\b/i,
    /\bauto_substitute\s*=\s*true/i,
  ];
  for (const file of shippingFiles()) {
    const src = readCode(file);
    for (const re of forbidden) {
      assert.doesNotMatch(src, re, `${path.basename(file)} contains a forbidden capability: ${re}`);
    }
  }
});

test('checked_out is never SET by anything here - the agent produces a checkout-ready basket and stops', () => {
  for (const file of shippingFiles()) {
    // Scanned over code, so the modules may (and do) explain the prohibition in
    // prose without tripping their own guard.
    assert.doesNotMatch(readCode(file), /checked_out/i,
      `${path.basename(file)} names checked_out in executable code`);
  }
  // And the comment stripper genuinely works, or the assertion above is empty.
  assert.equal(stripComments('const a = 1; // checked_out = true\n'), 'const a = 1; \n');
  assert.equal(stripComments('/* checked_out */ const b = 2;'), ' const b = 2;');
  assert.equal(stripComments('const u = "https://api.telegram.org"; // x'), 'const u = "https://api.telegram.org"; ');
  assert.match(stripComments('setCheckedOut(); // safe'), /setCheckedOut/);
});

test('the command vocabulary contains no checkout, payment, slot or substitution command', () => {
  const banned = /checkout|payment|\bpay\b|slot|order(?!Confirmation)|substitut|password/i;
  for (const name of COMMAND_NAMES) {
    assert.doesNotMatch(name, banned, `"${name}" reads like a consequential retail action`);
  }
});

test('the only database command this pipeline can emit is add-to-draft-list', async () => {
  const { ALLOWED_SHOPPER_COMMANDS } = await import('../../hub/shopper/shopperRoute.mjs');
  assert.deepEqual([...ALLOWED_SHOPPER_COMMANDS], ['add_list_item']);

  const h = makeHarness();
  await commands.receiveList({
    householdId: HOUSEHOLD_ID, listDate: '2026-08-03', sourceKind: 'text',
    rawText: '3 gourmet cat food', actor: ACTOR, telegramChatId: '555', telegramMessageId: '900',
  }, h.deps);
  await commands.buildShop({ shopRef: REF, actor: ACTOR }, h.deps);

  // A rogue intent is refused before it can reach a client.
  await assert.rejects(
    () => h.deps.assertAllowedIntents([{ command: 'checkout', args: {} }]),
    /non-allowlisted command/,
  );
  await runPipeline(HANDLE, h.deps);
  const emitted = h.calls.filter((c) => c.dep === 'executeIntents');
  assert.ok(emitted.length > 0);
});

test('nothing here drives a browser - the basket build is a durable REQUEST for a supervised human', () => {
  const browserish = [/puppeteer/i, /playwright/i, /webdriver/i, /chromium/i, /page\.click/i, /new Browser\b/];
  for (const file of shippingFiles()) {
    const src = read(file);
    for (const re of browserish) assert.doesNotMatch(src, re, `${path.basename(file)} reaches for a browser`);
  }
});

test('nothing here polls Telegram - there is exactly one consumer of that stream', () => {
  // Long-polling is DESTRUCTIVE: an offset ACKS every update below it, so a
  // second poller would race services/asdair/intake/ and the loser would
  // silently swallow the week's shopping list. The identifier is spelled
  // nowhere in this folder, which is why this test builds it rather than
  // writing it out.
  const pollMethod = ['get', 'Updates'].join('');
  for (const file of shippingFiles()) {
    const src = read(file);
    assert.ok(!new RegExp(`${pollMethod}\\s*\\(`).test(src) || /runtime\.js|harness\.js/.test(file),
      `${path.basename(file)} calls the Telegram poll method directly`);
    assert.doesNotMatch(src, /setWebhook/i, `${path.basename(file)} sets a webhook`);
  }
  // runtime.js may only WRAP an injected client - it must never construct a
  // poller of its own from a token.
  const runtimeSrc = read(path.join(HERE, 'runtime.js'));
  assert.match(runtimeSrc, /createCapturingTelegram/, 'runtime must wrap the one existing poller, not add another');
});

// =====================================================================
// CREDENTIALS
// =====================================================================

test('no module here opens, reads, parses or prints a credentials file', () => {
  for (const file of shippingFiles()) {
    const src = read(file);
    assert.doesNotMatch(src, /readFileSync\([^)]*\.env/i, `${path.basename(file)} reads an env file`);
    assert.doesNotMatch(src, /dotenv/i, `${path.basename(file)} parses a credentials file`);
    // No literal that looks like a Telegram bot token or a connection string.
    assert.doesNotMatch(src, /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/, `${path.basename(file)} contains a token-shaped literal`);
    assert.doesNotMatch(src, /postgres(ql)?:\/\/[^\s'"]+/i, `${path.basename(file)} contains a connection string`);
  }
});

test('secrets are referenced by NAME only, and never logged', () => {
  const deps = read(path.join(HERE, 'deps.js'));
  for (const name of ['ASDAIR_DB_URL', 'ASDAIR_WRITE_DB_URL', 'SHOPPER_BOT_TOKEN']) {
    assert.match(deps + read(path.join(HERE, 'runtime.js')), new RegExp(name),
      `${name} should be documented by name`);
  }
  // The write URL is never READ here - shopStore and its siblings take it from
  // the environment themselves. Only the pool builder may mention it.
  const reads = deps.match(/process\.env\.ASDAIR_WRITE_DB_URL/g) || [];
  assert.ok(reads.length <= 1, 'the write connection string is read in more than one place');
  for (const file of shippingFiles()) {
    assert.doesNotMatch(read(file), /console\.log\([^)]*(TOKEN|botToken|DB_URL)/i,
      `${path.basename(file)} logs a credential`);
  }
});

// =====================================================================
// WRITE DISCIPLINE
// =====================================================================

test('NEVER DELETES: no module here emits a DELETE, TRUNCATE or DROP', () => {
  for (const file of shippingFiles()) {
    const src = read(file);
    assert.doesNotMatch(src, /\bDELETE\s+FROM\b/i, `${path.basename(file)} deletes`);
    assert.doesNotMatch(src, /\bTRUNCATE\b/i, `${path.basename(file)} truncates`);
    assert.doesNotMatch(src, /\bDROP\s+(TABLE|COLUMN|INDEX)\b/i, `${path.basename(file)} drops`);
  }
});

test('this work package owns ONE folder: it emits SQL for shop_line and pipeline_command, and reads everything else', () => {
  // The only tables this pipeline WRITES directly are the ones that arrived for
  // exactly this stage and have no other owner:
  //   asdair.shop_line         migration 008 - the durable interpretation
  //   asdair.pipeline_command  migration 009 - the machine ledger
  //   asdair.shop_source_image migration 016 - the exact-source image binding
  //                            (WP-B15-1; owned by pipeline/store.js by ruling
  //                            on WO-2026-08-08-B15-01 - the shop-row INSERT
  //                            allowlist is frozen and owned elsewhere, so the
  //                            binding lives in a side table this stage owns)
  //   asdair.shop_decision     migration 017 - the durable CURRENT-SHOP
  //                            decision (WP-B15-2). Same argument as the three
  //                            above, and Silas's schema decision of
  //                            2026-08-09: it arrived for exactly this stage
  //                            and has no other owner. It is deliberately NOT
  //                            columns on shop_question, precisely because
  //                            THAT table is owned elsewhere and asdair_rw
  //                            already holds table-level UPDATE on it.
  // Everything else is written through the component that owns it.
  //
  // ADDING A TABLE HERE IS HOW THIS LIST IS MAINTAINED, NOT HOW IT IS WEAKENED.
  // The assertion is unchanged and every table NOT on this list still fails it;
  // a relaxation would be widening the match or dropping the check.
  const OWNED = [
    'asdair.shop_line', 'asdair.pipeline_command', 'asdair.shop_source_image',
    'asdair.shop_decision',
    // asdair.remembered_choice - Silas's schema decision of 2026-08-09, written by
    // pipeline/rememberedChoice.js. Warwick's rule: "when there is more than one
    // valid choice, remember the choice I made last time." Append-only, and
    // asdair_rw holds SELECT+INSERT with UPDATE/DELETE granted to NOBODY, so a
    // preference cannot be rewritten by any code path that exists or is added
    // later. It arrived for exactly this stage and has no other owner.
    //
    // ADDED BY LARRY, not by the implementing worker: this line sits outside that
    // Work Order's file_surface, and the worker correctly refused BOTH to edit it
    // AND to reshape its own SQL to dodge the regex - either would have made the
    // suite green while hiding a new writer from this very check.
    'asdair.remembered_choice',
    // asdair.shop_image_region, asdair.shop_line_provenance - Silas's schema
    // decision of 2026-08-12 (migration 020, WO-2026-08-11-B15-VISION-01). The
    // application-owned region list and the four-way (PHOTO/REGULARS/RULE/
    // WARWICK) provenance ledger both arrived for exactly this stage and have
    // no other owner - same argument as shop_decision and remembered_choice
    // above. ADDED BY LARRY, same precedent as remembered_choice: the
    // implementing worker (services/asdair/pipeline/shopImageRegions.js,
    // lineProvenance.js) correctly refused to self-edit this list.
    'asdair.shop_image_region', 'asdair.shop_line_provenance',
  ];
  const writers = shippingFiles()
    // The backfill is the ONE deliberate exception - retiring the legacy
    // pending_action rows IS its job, and the test below governs it instead.
    .filter((f) => path.basename(f) !== 'migrate-command-ledger.js')
    .map((f) => ({ f, src: read(f) }))
    .filter(({ src }) => /INSERT INTO|UPDATE asdair\./i.test(src));
  for (const { f, src } of writers) {
    const tables = [...src.matchAll(/(?:INSERT INTO|UPDATE)\s+(asdair\.\w+)/gi)].map((m) => m[1]);
    for (const t of tables) {
      assert.ok(OWNED.includes(t),
        `${path.basename(f)} writes ${t} directly instead of through the component that owns it`);
    }
  }
});

// =====================================================================
// THE SEPARATION OF THE MACHINE LEDGER FROM THE HUMAN'S LIST
//
// asdair.pending_action is what the Cockpit and the Telegram status card show
// Warwick as OUTSTANDING ACTIONS. Since migration 009 the pipeline keeps its
// own bookkeeping in asdair.pipeline_command, and NOTHING it does for itself
// may write to pending_action again.
//
// Filtering it in the UI was explicitly rejected as a fix, so these are the
// proofs that the defect is gone from the DATA rather than hidden in a view.
// The behavioural half lives in commandLedger.test.js; this is the structural
// half, and structural absence is only provable by looking at the source.
// =====================================================================

test('SEPARATION (structural): no shipping module can write asdair.pending_action at all', () => {
  for (const file of shippingFiles()) {
    // The backfill is the ONE deliberate exception; the next test governs
    // exactly what it is allowed to do to that table.
    if (path.basename(file) === 'migrate-command-ledger.js') continue;
    const src = read(file);
    assert.doesNotMatch(src, /INSERT\s+INTO\s+asdair\.pending_action/i,
      `${path.basename(file)} inserts into asdair.pending_action - the household's list is not the pipeline's ledger`);
    assert.doesNotMatch(src, /UPDATE\s+asdair\.pending_action/i,
      `${path.basename(file)} updates asdair.pending_action`);
    // The two shopStore entry points that reach that table are the only other
    // door into it, and no pipeline module may call either.
    assert.doesNotMatch(src, /addPendingAction|resolvePendingAction/,
      `${path.basename(file)} calls shopStore's pending_action writer`);
  }
});

test('SEPARATION (structural): the backfill may only RETIRE legacy rows - it can neither create nor delete one', () => {
  const src = read(path.join(HERE, 'migrate-command-ledger.js'));
  assert.doesNotMatch(src, /INSERT\s+INTO\s+asdair\.pending_action/i,
    'the backfill creates rows in the household action list');
  assert.doesNotMatch(src, /DELETE\s+FROM/i, 'the backfill deletes - the legacy rows are history, not litter');
  const updates = [...src.matchAll(/UPDATE\s+asdair\.pending_action[\s\S]{0,400}?(?=`)/gi)].map((m) => m[0]);
  assert.equal(updates.length, 1, 'the backfill touches asdair.pending_action in more than one statement');
  assert.match(updates[0], /SET status = 'abandoned'/, 'the backfill does something other than retire');
  assert.match(updates[0], /WHERE id = \$2 AND status = 'pending'/,
    'the backfill must only retire rows that are still PENDING, and must be a no-op on a re-run');
  assert.match(updates[0], /note = coalesce\(note \|\| ' \| ', ''\) \|\| \$1/,
    'the backfill must APPEND its pointer, never overwrite the original note');
});

test('SEPARATION (structural): store.js names pending_action in exactly one statement, and it is a SELECT', () => {
  const src = read(path.join(HERE, 'store.js'));
  const statements = [...src.matchAll(/(SELECT|INSERT INTO|UPDATE|DELETE FROM)[\s\S]{0,400}?asdair\.pending_action/gi)]
    .map((m) => m[1].toUpperCase());
  assert.deepEqual(statements, ['SELECT'],
    'store.js must touch asdair.pending_action exactly once, to READ the household\'s genuine actions');
});

test('SEPARATION (structural): there is no way left to spell a pipeline pending_action row', () => {
  // `commandActionType` / `outboxActionType` produced the `cmd:` / `msg:`
  // action_types. They are GONE, not merely unused: a key that cannot be built
  // cannot be written by a future edit that forgets why.
  const keys = read(path.join(HERE, 'keys.js'));
  assert.doesNotMatch(keys, /export function commandActionType/,
    'commandActionType still exists - a pipeline action_type can still be spelled');
  assert.doesNotMatch(keys, /export function outboxActionType/,
    'outboxActionType still exists - a pipeline action_type can still be spelled');
  for (const file of shippingFiles()) {
    assert.doesNotMatch(read(file), /commandActionType|outboxActionType/,
      `${path.basename(file)} still builds a pending_action action_type for pipeline plumbing`);
  }
});

test('the whole stage vocabulary is either an action or an honest wait - nothing else', () => {
  for (const step of Object.values(STEPS)) {
    assert.ok(step.startsWith('act:') || step.startsWith('wait:'),
      `"${step}" is neither an action nor a wait`);
  }
});
