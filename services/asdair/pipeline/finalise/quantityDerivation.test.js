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

// ---------------------------------------------------------------------
// WO-2026-08-13-13 (WP-B15-46) AC5 - THE STALENESS GUARD, MADE PORTABLE.
//
// Veritas measured this file failing 1078/1 on a PRISTINE WINDOWS CHECKOUT of
// a commit whose suite is 1079/0 in the authoring worktree. The cause is not
// the artefact and not the renderer: this repository is configured
// `core.autocrlf=true` and carries no `.gitattributes`, so `git checkout`
// rewrites the committed `.md` to CRLF on the way to disk. The generator emits
// LF, so a BYTE-EXACT compare is really asserting "this file was written by the
// generator and never re-checked-out" - a property of one worktree, not of the
// commit.
//
// So the comparison normalises line endings on BOTH sides. It compares CONTENT,
// which is what "in step with the committed list" ever meant; the byte width of
// a newline was never part of the claim.
//
// ⚠️ NORMALISING MUST NOT TURN THE GUARD OFF. A guard that stops guarding is
// worse than the flake it replaced, so the staleness detection is proven by
// being MADE TO FAIL in the test immediately below, rather than asserted here.
// Fixing `.gitattributes` instead was considered and rejected: it would repair
// the checkout on machines that have it and leave the test just as fragile
// everywhere else. This fix travels with the assertion.
// ---------------------------------------------------------------------

/** Content-equality for text artefacts: CRLF/CR and LF are the same newline. */
function normaliseNewlines(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

test('AC2: the committed derivation artefact is in step with the committed list', (t) => {
  const path = join(OUT, 'quantity-derivation.md');
  const list = loadList(t);
  if (!list) return;
  if (!existsSync(path)) {
    t.skip('quantity-derivation.md not built - run `node finalise/produceFinalList.mjs` first');
    return;
  }
  const rendered = renderQuantityDerivationMarkdown(list);

  // NOT A VACUOUS COMPARE. Two empty strings are equal, and an empty render
  // would make this test pass while proving nothing at all.
  assert.ok(rendered.length > 0, 'the renderer produced nothing to compare against');
  assert.match(rendered, /SOURCE LINE -> PRODUCT IDENTITY -> PURCHASE QUANTITY/);

  assert.equal(normaliseNewlines(readFileSync(path, 'utf8')), normaliseNewlines(rendered),
    'the committed derivation is stale: regenerate it with `node finalise/produceFinalList.mjs`');
});

test('AC5: newline normalisation does NOT stop the staleness guard from firing', (t) => {
  const list = loadList(t);
  if (!list) return;
  const rendered = renderQuantityDerivationMarkdown(list);

  // 1. A CRLF copy of the CURRENT artefact must still be accepted. This is the
  //    exact fresh-Windows-checkout condition that produced Veritas's 1078/1.
  const asCheckedOutOnWindows = rendered.replace(/\n/g, '\r\n');
  assert.notEqual(asCheckedOutOnWindows, rendered,
    'the CRLF fixture is identical to the LF render, so this test would prove nothing');
  assert.equal(normaliseNewlines(asCheckedOutOnWindows), normaliseNewlines(rendered),
    'a CRLF checkout of the CURRENT artefact must compare equal - that is the whole point of AC5');

  // 2. A GENUINELY STALE artefact must still be REFUSED, in either line ending.
  //    Staleness is a real number moving, so the mutant moves one.
  const stale = rendered.replace(/FINAL ITEM COUNT: (\d+)/, (m, n) => `FINAL ITEM COUNT: ${Number(n) + 1}`);
  assert.notEqual(stale, rendered, 'the staleness mutant did not change the rendered artefact');
  assert.notEqual(normaliseNewlines(stale), normaliseNewlines(rendered),
    'a stale derivation must NOT compare equal after normalisation - the guard would be dead');
  assert.notEqual(normaliseNewlines(stale.replace(/\n/g, '\r\n')), normaliseNewlines(rendered),
    'a stale derivation must NOT compare equal even when checked out with CRLF');
});
