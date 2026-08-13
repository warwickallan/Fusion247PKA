// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/quantityDerivation.test.js
//
// WO-2026-08-13-10 (WP-B15-40), AC2. THE TEST THAT ASSERTS THE SUM, so that a
// person never has to.
//
// The 39 lines sum to 53 items. If that ever stops being true, this file fails
// AND NAMES THE LINE THAT MOVED - which is the difference between a number that
// is defended and a number that was once checked.
//
// It also pins Warwick's ruled conventions to worked examples from the real
// page, because a convention with no executable example drifts.
//
// Runs under: node --test. No DB, no model, no network.
// =====================================================================

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveQuantityRows, summariseQuantities, renderQuantityDerivationMarkdown } from './quantityDerivation.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const LIST = join(OUT, 'final-shopping-list.json');

/** The established truth of the frozen reading. Held as LITERALS, on purpose. */
const EXPECTED_LINES = 39;
const EXPECTED_ITEMS = 53;

function loadList(t) {
  if (!existsSync(LIST)) {
    t.skip('final-shopping-list.json not built - run `node finalise/produceFinalList.mjs` first');
    return null;
  }
  return JSON.parse(readFileSync(LIST, 'utf8'));
}

test('AC2: the derivation reproduces the declared item count, and names any line that moved', (t) => {
  const list = loadList(t);
  if (!list) return;

  const s = summariseQuantities(list);

  assert.equal(s.line_count, EXPECTED_LINES,
    `the frozen reading is ${EXPECTED_LINES} lines; got ${s.line_count}`);

  // The sum, asserted - and when it fails, it says WHICH lines carry what.
  if (s.derived_item_count !== EXPECTED_ITEMS) {
    const breakdown = s.rows
      .map((r) => `  line ${r.line_no}: qty=${r.purchase_quantity} basis=${r.quantity_basis} "${r.source_line}"`)
      .join('\n');
    assert.fail(
      `quantity derivation no longer sums to ${EXPECTED_ITEMS}. Derived ${s.derived_item_count} `
      + `(${s.derived_line_items} from lines + ${s.derived_addition_items} from additions).\n${breakdown}`,
    );
  }

  assert.equal(s.declared_item_count, EXPECTED_ITEMS,
    'the final list declares a different item count from the established truth');
  assert.equal(s.reconciles, true,
    `the derivation (${s.derived_item_count}) and the shop (${s.declared_item_count}) disagree about how `
    + 'many items are being bought - one of them is lying to Warwick');
});

test('AC2: every line has a complete chain - source line, identity decision, and a quantity basis', (t) => {
  const list = loadList(t);
  if (!list) return;

  const rows = deriveQuantityRows(list);
  const defects = [];

  for (const r of rows) {
    if (!r.source_line) defects.push(`line ${r.line_no}: no source line`);
    if (!r.identity_basis) defects.push(`line ${r.line_no}: no identity basis`);
    // A quantity may legitimately be absent, but only where the line is NOT
    // being shopped - an unquantified line in the basket is a real defect.
    if (r.purchase_quantity === null && r.shoppable) {
      defects.push(`line ${r.line_no}: shoppable with NO purchase quantity - "${r.source_line}"`);
    }
    if (r.purchase_quantity !== null && !r.quantity_basis) {
      defects.push(`line ${r.line_no}: quantity ${r.purchase_quantity} with no recorded basis`);
    }
  }

  assert.deepEqual(defects, [], `incomplete derivation chains:\n${defects.join('\n')}`);
});

test('AC2: PACK SIZE IS IDENTITY - a pack line buys ONE pack, never its pack size', (t) => {
  const list = loadList(t);
  if (!list) return;

  const rows = deriveQuantityRows(list);
  const packLines = rows.filter((r) => r.pack_identity_applied);

  assert.ok(packLines.length > 0,
    'the pack-identity rule fired on no line at all - either the page changed or the rule stopped running');

  for (const r of packLines) {
    assert.equal(r.purchase_quantity, 1,
      `line ${r.line_no} applied the pack-identity rule but is buying ${r.purchase_quantity}. `
      + `Richmond 16 is ONE pack of 16, not sixteen packs. Source: "${r.source_line}"`);
  }

  // No line may buy a pack-shaped quantity by accident.
  for (const r of rows) {
    assert.ok(r.purchase_quantity === null || r.purchase_quantity <= 12,
      `line ${r.line_no} buys ${r.purchase_quantity} units - that is pack-size-shaped and almost `
      + `certainly an identity number leaking into a purchase quantity. Source: "${r.source_line}"`);
  }
});

test('AC2: a line whose quantity was REFUSED is never silently shopped', (t) => {
  const list = loadList(t);
  if (!list) return;

  const rows = deriveQuantityRows(list);
  for (const r of rows.filter((x) => !x.quantity_settled)) {
    assert.equal(r.shoppable, false,
      `line ${r.line_no} has an unsettled quantity but is shoppable. Warwick's rule is explicit: `
      + `"explicit conflicting observations -> Cockpit uncertainty, NEVER a guessed quantity". `
      + `Source: "${r.source_line}"`);
  }
});

test('AC2: the rendered artefact states the arithmetic it claims to reconcile', (t) => {
  const list = loadList(t);
  if (!list) return;

  const md = renderQuantityDerivationMarkdown(list);
  const s = summariseQuantities(list);

  assert.match(md, /SOURCE LINE -> PRODUCT IDENTITY -> PURCHASE QUANTITY/);
  assert.match(md, new RegExp(`FINAL ITEM COUNT: ${s.derived_item_count}`));
  assert.match(md, /pack size is IDENTITY, never purchase quantity/);
  assert.match(md, /HUMAN decides/);

  // One table row per line, so nothing is summarised away.
  const rowCount = md.split(/\r?\n/).filter((l) => /^\| \d+ \| `/.test(l)).length;
  assert.equal(rowCount, s.line_count,
    'the rendered table must carry every line, not a selection');
});

test('AC2: the committed derivation artefact is in step with the committed list', (t) => {
  const path = join(OUT, 'quantity-derivation.md');
  const list = loadList(t);
  if (!list) return;
  if (!existsSync(path)) {
    t.skip('quantity-derivation.md not built - run `node finalise/produceFinalList.mjs` first');
    return;
  }
  assert.equal(readFileSync(path, 'utf8'), renderQuantityDerivationMarkdown(list),
    'the committed derivation is stale: regenerate it with `node finalise/produceFinalList.mjs`');
});
