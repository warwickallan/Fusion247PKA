// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/producedList.test.js
//
// WO-2026-08-13-04 (WP-B15-37), AC1 + AC3 + AC4 + AC5 + AC6 + AC7 + AC8,
// GRADED ON THE LIST THE PRODUCTION RUN ACTUALLY PRODUCED.
//
// Warwick: "Do not merely unit-test a parser in isolation and call quantity
// done." So this file runs `produce()` - the same function the committed
// artefacts came from - and asserts on ITS OUTPUT, not on a fixture of what the
// output ought to look like.
//
// The 39-line ground-truth fixture IS read here, and only here: it is TEST DATA
// ("no production path may read this file"), and grading is exactly what test
// data is for. Its own recorded limits apply - the source_text column was
// transcribed by a model, so it joins a reading to a page line and is not an
// independent grade of that reading.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { produce, loadFrozenRuns, loadHousehold } from './produceFinalList.mjs';
import { pageLineKey } from './corroborate.js';
import { buildAccounting, assertAccountingCloses } from './accounting.js';
import { PROVENANCE, DISPOSITION } from './finalList.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(
  join(HERE, '..', 'agenticVisionPrototype', 'fixtures', 'photo39.fixture.json'), 'utf8',
));

const norm = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);

/** True when one token list is a whole-token prefix of the other, >= 2 tokens. */
function prefixJoin(a, b) {
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < 2) return false;
  return short.every((t, i) => long[i] === t);
}

let RESULT = null;
async function result() {
  if (RESULT === null) RESULT = await produce();
  return RESULT;
}

// =====================================================================
// AC1 - 39/39 ACCOUNTED FOR, NOTHING SILENTLY DROPPED OR INVENTED
// =====================================================================

test('AC1: the accounting closes - every reconciled observation has exactly one fate', async () => {
  const r = await result();
  assert.equal(assertAccountingCloses(r.accounting), true);
  assert.equal(r.accounting.closes, true);
  assert.equal(r.accounting.missing.length, 0);
  assert.equal(r.accounting.duplicated.length, 0);
  assert.equal(r.accounting.accounted, r.accounting.observed);
});

test('AC1: every fate is one of resolved / skipped / unresolved-routed, and nothing else', async () => {
  const r = await result();
  const allowed = new Set([DISPOSITION.RESOLVED, DISPOSITION.SKIPPED, DISPOSITION.ROUTED]);
  for (const fates of Object.values(r.accounting.byKey)) {
    assert.equal(fates.length, 1, 'an observation landed in two places');
    assert.ok(allowed.has(fates[0].fate), `unknown fate ${fates[0].fate}`);
  }
  assert.equal(
    r.accounting.resolved + r.accounting.skipped + r.accounting.routed,
    r.accounting.observed,
  );
});

test('AC1: the established page lines cover ALL 39 lines of the photograph', async () => {
  const r = await result();
  assert.equal(r.established.length, 39,
    `expected the three readings to agree on 39 page lines, got ${r.established.length}`);

  // Join each ground-truth line to an established observation. Matched by
  // catalogue id where the fixture established one, otherwise by page-line key
  // with a prefix allowance for the two lines a reading truncated.
  const pool = [...r.established];
  const unmatched = [];
  for (const fx of FIXTURE.lines) {
    let hit = -1;
    if (fx.expected_product_id !== null && fx.expected_product_id !== undefined) {
      hit = pool.findIndex((o) => String(o.product_id) === String(fx.expected_product_id)
        || o.identity_candidates.includes(String(fx.expected_product_id)));
    }
    if (hit === -1) {
      const key = pageLineKey(fx.source_text);
      hit = pool.findIndex((o) => pageLineKey(o.as_written) === key);
    }
    if (hit === -1) {
      // A reading the model TRUNCATED is still the same page line - the frozen
      // runs contain "1 BOX..." for "1 BOX ASDA FRUiT LOLLY iCES". Joined on a
      // whole-token prefix of at least two tokens, which is narrow enough that
      // no two of these 39 lines can satisfy it by accident.
      const want = norm(fx.source_text);
      hit = pool.findIndex((o) => prefixJoin(norm(o.as_written), want));
    }
    if (hit === -1) unmatched.push(fx.source_text);
    else pool.splice(hit, 1);
  }
  assert.deepEqual(unmatched, [], 'a real page line was lost by reconciliation');
  assert.equal(pool.length, 0, 'an established observation matches no page line');
});

test('AC1 MUTATION: removing one line makes the accounting assertion FAIL', async () => {
  const r = await result();
  const mutated = buildAccounting({
    reconciled: r.reconciled,
    established: r.established,
    unsupported: r.unsupported,
    finalList: r.finalList,
    // The mutation: one durable interpretation row disappears, which is exactly
    // the "a line simply vanishes" defect AC1 exists to catch.
    shopLines: r.harness.db.shop_line.slice(1),
  });
  assert.equal(mutated.closes, false, 'the accounting check did not notice a missing line - it is not a gate');
  assert.equal(mutated.missing.length, 1);
  assert.throws(() => assertAccountingCloses(mutated), /accounting does not close/);
});

test('AC1 MUTATION: an observation landing in TWO places also fails', async () => {
  const r = await result();
  const doubled = buildAccounting({
    reconciled: r.reconciled,
    established: r.established,
    unsupported: r.unsupported,
    finalList: {
      ...r.finalList,
      // The mutation: a skip that is ALSO a resolved line - double counting.
      skipped: [...r.finalList.skipped, {
        identity_key: r.finalList.lines[0].provenance_detail
          ? r.established[r.finalList.lines[0].provenance_detail.line_no - 1].identity_key
          : 'id:0',
        reason: 'injected duplicate fate',
      }],
    },
    shopLines: r.harness.db.shop_line,
  });
  assert.equal(doubled.closes, false);
  assert.ok(doubled.duplicated.length >= 1);
});

test('AC1: the three MEASURED inventions of the frozen runs are all excluded from the shop', async () => {
  const r = await result();
  // The graded per-line detail of the three frozen runs names them.
  const invented = [];
  for (const run of loadFrozenRuns()) {
    const json = JSON.parse(readFileSync(
      join(HERE, '..', 'agenticVisionPrototype', 'runs', run.file), 'utf8',
    ));
    for (const d of Object.values(json.twoLayerScore.details || {})) {
      if (d.verdict === 'INVENTED') invented.push(d.as_written);
    }
  }
  assert.equal(invented.length, 3, 'the frozen runs are documented as carrying 1 + 0 + 2 inventions');

  const shopped = new Set(r.finalList.lines.map((l) => pageLineKey(l.provenance_detail.raw_reading)));
  const skipped = new Set(r.finalList.skipped.map((s) => pageLineKey(s.as_written)));
  for (const text of invented) {
    const key = pageLineKey(text);
    assert.ok(skipped.has(key), `an INVENTED line reached no skip record: ${text}`);
    assert.ok(!shopped.has(key), `an INVENTED line reached the shopping list: ${text}`);
  }
});

// =====================================================================
// AC3 - PROVENANCE STAYS FOUR-WAY DISTINCT AND THE ARITHMETIC RECONCILES
// =====================================================================

test('AC3: every photo line carries exactly one origin, and it is PHOTO', async () => {
  const r = await result();
  for (const l of r.finalList.lines) {
    assert.equal(l.provenance, PROVENANCE.PHOTO);
    assert.equal(l.provenance_detail.kind, PROVENANCE.PHOTO);
    assert.ok(l.provenance_detail.raw_reading, 'a PHOTO line must carry the reading it came from');
  }
});

test('AC3: a separately justified addition is REGULARS and is never folded into the photo count', async () => {
  const r = await result();
  for (const a of r.finalList.additions) {
    assert.notEqual(a.provenance, PROVENANCE.PHOTO, 'a household addition was labelled PHOTO');
  }
  assert.equal(r.finalList.provenance_counts.PHOTO, r.finalList.lines.length);
  assert.equal(
    r.finalList.provenance_counts.REGULARS
    + r.finalList.provenance_counts.RULE
    + r.finalList.provenance_counts.WARWICK,
    r.finalList.additions.length,
  );
});

test('AC3: the arithmetic reconciles - photo + additions - skips = final plan', async () => {
  const r = await result();
  const a = r.finalList.provenance_arithmetic;
  assert.equal(a.photo, r.finalList.lines.length);
  assert.equal(a.additions, r.finalList.additions.length);
  assert.equal(a.skips, r.finalList.skipped.length);
  assert.equal(a.final_plan, r.finalList.totals.product_count);
  assert.equal(a.photo + a.additions, a.final_plan,
    'the plan must equal the photo lines plus the separately justified additions');
  assert.equal(a.reconciles, true);
});

// =====================================================================
// AC4 - QUANTITY, ON THE REAL PRODUCED LIST
// =====================================================================

test('AC4: Richmond - the produced list asks for ONE PACK, not sixteen sausages', async () => {
  const r = await result();
  const line = r.finalList.lines.find((l) => /Richmond/i.test(String(l.product || '')));
  assert.ok(line, 'the Richmond line is not on the produced list at all');
  assert.equal(line.quantity, 1, `the produced list asks for ${line.quantity} - a pack size became a purchase count`);
  assert.equal(line.pack_identity_applied, true);
  assert.equal(line.pack_identity_refused_evidence, 16);
  assert.match(line.quantity_note, /pack count/);
});

test('AC4: no line on the produced list carries a pack-size-as-quantity failure', async () => {
  const r = await result();
  const offenders = r.finalList.lines.filter((l) => {
    if (!Number.isInteger(l.quantity)) return false;
    if (l.quantity < 10) return false;
    // A count of ten or more survives only with an explicit purchase marker.
    return !/\b(x|pk|pkt|pkts|pack|packs|box|bag|can|tin|pts|pint|pints)\b/i
      .test(String(l.provenance_detail.raw_reading || ''));
  });
  assert.deepEqual(offenders.map((l) => `${l.product}=${l.quantity}`), [],
    'an unmarked double-digit count reached the trolley as a purchase quantity');
});

test('AC4: the explicit multiplier cases survive - "4 x 4pts ARLA" is still four', async () => {
  const r = await result();
  // WO-2026-08-13-10 (WP-B15-40) AC5: this line is now ROUTED TO A HUMAN. All
  // three readings agreed on it, but it carries an unresolved cross-region
  // duplicate, and agreement is not certainty. A routed line has no resolved
  // `product`, so it is matched on its READING - exactly as the held ASDA milk
  // line already is further down this file.
  //
  // THE CLAIM THIS TEST MAKES IS UNCHANGED AND STILL ASSERTED: the explicit
  // multiplier "4 x" must still be read as four. Routing a line for review must
  // never disturb the number the page actually carried.
  const arla = r.finalList.lines.find((l) => /4\s*x\s*4\s*pts?\.?\s*ARLA/i.test(String(l.provenance_detail.raw_reading || '')));
  assert.ok(arla, 'the Arla/Cravendale milk line is missing');
  assert.equal(arla.quantity, 4);
  assert.equal(arla.shoppable, false,
    'and it is now held for a human on its unresolved cross-region duplicate (WP-B15-40 AC5)');
});

test('AC4: a line with no purchase count on the page asks for one', async () => {
  const r = await result();
  const defaults = r.finalList.lines.filter((l) => l.quantity_basis === 'household-default-one');
  assert.ok(defaults.length > 0, 'no line exercised the household default on this list');
  for (const l of defaults) assert.equal(l.quantity, 1);
});

test('AC4 + AC7: the ASDA milk quantity conflict is ROUTED, never guessed', async () => {
  const r = await result();
  const conflicted = r.finalList.lines.filter((l) => l.quantity_basis === 'conflicting-observations');
  assert.ok(conflicted.length > 0, 'the measured 1-vs-7 disagreement on the ASDA milk line disappeared');
  for (const l of conflicted) {
    assert.equal(l.shoppable, false, 'a line the runs disagree about must not be shopped');
    assert.equal(l.disposition, DISPOSITION.ROUTED);
    assert.ok(l.quantity_candidates.length > 1);
  }
});

// =====================================================================
// AC2 ON THE PRODUCED LIST - the three named pairs are still two lines each
// =====================================================================

const PRODUCED_PAIRS = [
  ['Yazoo Strawberry', 'Yazoo Chocolate'],
  ['Twix Chocolate & Caramel Ice Cream', 'Twix Multipack Chocolate Biscuit'],
];

for (const [a, b] of PRODUCED_PAIRS) {
  test(`AC2 on the produced list: "${a}" and "${b}" are two separate purchases`, async () => {
    const r = await result();
    const names = r.finalList.lines.map((l) => String(l.product || ''));
    assert.ok(names.some((n) => n.includes(a)), `${a} is missing from the produced list`);
    assert.ok(names.some((n) => n.includes(b)), `${b} is missing from the produced list`);
    assert.notEqual(
      names.findIndex((n) => n.includes(a)),
      names.findIndex((n) => n.includes(b)),
    );
  });
}

test('AC2 on the produced list: Arla/Cravendale milk and ASDA milk are two separate lines', async () => {
  const r = await result();
  // BOTH milk lines are now matched on their readings rather than on resolved
  // product names: the ASDA 6-pint line is held by its quantity conflict, and
  // (WP-B15-40 AC5) the Arla line is held by its unresolved cross-region
  // duplicate. The claim under test is unaffected - these are two DIFFERENT
  // physical purchases and must never collapse into one, held or not.
  const arla = r.finalList.lines.filter((l) => /4\s*x\s*4\s*pts?\.?\s*ARLA/i.test(String(l.provenance_detail.raw_reading || '')));
  const asda = r.finalList.lines.filter((l) => /6\s*pts?\.?\s*ASDA/i.test(String(l.provenance_detail.raw_reading || '')));
  assert.equal(arla.length, 1);
  assert.equal(asda.length, 1);
  assert.notEqual(arla[0].list_item_name, asda[0].list_item_name);
});

// =====================================================================
// AC5 + AC6 - the durable artefact and the browser-ready handoff
// =====================================================================

test('AC5: the final list is sorted by BRAND, by the PRODUCTION packet contract', async () => {
  const r = await result();
  assert.equal(r.finalList.packet_sort_contract, 'brand_az_then_product_az');
  assert.equal(r.finalList.packet_sort_contract_declared, true);
  assert.equal(r.finalList.packet_sort_contract_verified, true);

  const brands = r.finalList.lines.map((l) => String(l.brand).toLowerCase());
  const sorted = [...brands].sort((x, y) => x.localeCompare(y, 'en'));
  assert.deepEqual(brands, sorted, 'the delivered artefact is not in brand order');
});

test('AC5: every list line carries identity, quantity, provenance and substitute policy', async () => {
  const r = await result();
  for (const l of r.finalList.lines) {
    assert.ok('brand' in l && 'quantity' in l && 'provenance' in l && 'substitutes_allowed' in l);
    assert.ok('disposition' in l);
    if (l.shoppable) {
      assert.ok(l.product, 'a shoppable line must name a real catalogue product');
      assert.equal(typeof l.substitutes_allowed, 'boolean');
      assert.ok(Number.isInteger(l.quantity) && l.quantity > 0);
    }
  }
});

test('AC6: the handoff is the production artefact - method, prohibitions, fingerprint, refs', async () => {
  const r = await result();
  assert.equal(r.handoff.method.length, 18, 'the operating method must travel with the packet');
  assert.equal(r.handoff.prohibited_actions.length, 5);
  assert.match(r.handoff.packet_fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.ok(r.handoff.lines.length > 0);
  for (const line of r.handoff.lines) {
    assert.ok(line.canonical_product_id, 'a shoppable packet line must carry a durable identity');
    assert.ok(Number.isInteger(line.required_quantity) && line.required_quantity > 0);
    assert.equal(typeof line.substitutes_allowed, 'boolean');
  }
});

test('AC6: NO browser build was requested - the shop never reached WAITING_FOR_BROWSER', async () => {
  const r = await result();
  assert.notEqual(r.shop.status, 'WAITING_FOR_BROWSER');
  assert.notEqual(r.shop.status, 'SHOPPING');
  assert.equal((r.harness.db.browser_build_request || []).length, 0,
    'a browser build request was opened - this Work Order forbids any browser action');
  for (const s of r.steps) {
    assert.notEqual(s.step, 'act:queue_browser_build');
    assert.notEqual(s.step, 'act:record_build_started');
  }
});

// =====================================================================
// AC7 - genuine uncertainty is ROUTED, never guessed
// =====================================================================

test('AC7: every non-shoppable line names why, and none of them is a silent guess', async () => {
  const r = await result();
  const held = r.finalList.lines.filter((l) => !l.shoppable);
  assert.ok(held.length > 0, 'this photograph has genuine uncertainty; a zero here would be the guessed zero');
  for (const l of held) {
    assert.ok(l.held_reason, 'a held line must carry the reason it is held');
    assert.equal(l.disposition, DISPOSITION.ROUTED);
  }
  for (const s of r.finalList.skipped) {
    assert.ok(s.reason && s.routed_to, 'a skipped candidate must carry its reason and where it went');
  }
});

// =====================================================================
// THE STANDING PROHIBITIONS
// =====================================================================

test('the run performs NO live database write - the durable store is the offline one', async () => {
  const r = await result();
  // The offline store is a plain in-memory object graph. If a real pg Pool had
  // been opened, this shape would not exist.
  assert.ok(Array.isArray(r.harness.db.shop));
  assert.ok(Array.isArray(r.harness.db.shop_line));
  assert.equal(r.harness.db.shop.length, 1);
  assert.equal(process.env.ASDAIR_DB_WRITE_URL, undefined,
    'no write connection string is present in this process');
});

test('migration 020 is NOT depended upon - no provenance table is read or written', async () => {
  const r = await result();
  assert.equal(r.harness.db.shop_line_provenance, undefined);
  assert.equal(r.harness.db.shop_image_region, undefined);
  // The ledger lives in the artefact instead, in migration 020's own vocabulary.
  for (const l of r.finalList.lines) {
    assert.ok(['PHOTO', 'REGULARS', 'RULE', 'WARWICK'].includes(l.provenance));
  }
});

test('the household truth was read SELECT-only and banked, and the run consumes the bank', async () => {
  const snap = loadHousehold();
  assert.match(snap.access, /SELECT-only/);
  assert.equal(snap.regulars_count, snap.regulars.length);
  assert.ok(snap.regulars_count > 0);
  const text = JSON.stringify(snap);
  assert.ok(!/postgres:\/\//.test(text), 'a connection string reached the banked snapshot');
  assert.ok(!/password/i.test(text), 'a credential-shaped key reached the banked snapshot');
});
