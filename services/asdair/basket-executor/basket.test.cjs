// =====================================================================
// WO-2026-08-17-B15-BASKET - executable proofs for the basket executor.
//
// These are BUILDER proofs, not independent review. They exercise the three
// properties that decide whether this executor is safe to point at a real
// trolley:
//
//   1. The plan never issues a command outside the browser-runner allowlist,
//      and it ALWAYS sets quantity - including at qty 1 (SOP-021 fact 10).
//   2. The judgement layer cannot resolve a line to a reference the live search
//      did not return, however the model answers.
//   3. Reconciliation compares against what was READ BACK, so a line the run
//      believed it added but which is absent from the trolley is a discrepancy
//      rather than a success.
//
// No network, no gateway, no browser, no database.
// =====================================================================
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildPlan, searchTerms, sanitiseTerm, packBranchAllowed, planSummary } = require('./plan.cjs');
const { judgeLine, parseReply } = require('./judge.cjs');
const { resolveConfig, chromeArgs, ensureChrome, LauncherConfigError } = require('./launcher.cjs');
const { reconcile, writeHarvest } = require('./reconcile.cjs');
const { normaliseTerm } = require('../browser-runner/commands.cjs');

const MANIFEST = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'Deliverables', '2026-08-17-asdair-frozen-manifest-SHOP-2026-08-19.json'),
  'utf8',
));

// ---------------------------------------------------------------------
// the plan
// ---------------------------------------------------------------------

test('the frozen manifest is 37 lines, 21 with a stored id and 16 needing search', () => {
  const s = planSummary(MANIFEST);
  assert.strictEqual(s.line_count, 37);
  assert.strictEqual(s.with_stored_id, 21);
  assert.strictEqual(s.needing_search, 16);
});

test('every planned command is on the browser-runner allowlist', () => {
  const { COMMANDS } = require('../browser-runner/commands.cjs');
  const plan = buildPlan(MANIFEST);
  assert.ok(plan.length > 0, 'the plan must not be empty');
  for (const step of plan) {
    assert.ok(Object.prototype.hasOwnProperty.call(COMMANDS, step.command), `${step.command} is not allowlisted`);
  }
});

test('a malformed manifest is refused rather than half-planned', () => {
  assert.throws(() => buildPlan(null), /no lines/);
  assert.throws(() => buildPlan({}), /no lines/);
  // Two lines numbered the same would collide on step_id, and a colliding
  // idempotency key is how a resumed run silently skips a real product.
  assert.throws(
    () => buildPlan({ lines: [
      { n: 1, qty: 1, product: 'Milk', asda_product_id: '489747' },
      { n: 1, qty: 1, product: 'Bread', asda_product_id: '166556' },
    ] }),
    /duplicate step_id/,
  );
});

test('EVERY line gets a set_quantity step, including quantity 1 - SOP-021 fact 10', () => {
  const plan = buildPlan(MANIFEST);
  const qtyLines = new Set(plan.filter((s) => s.command === 'set_quantity').map((s) => s.line));
  const qtyOneLines = MANIFEST.lines.filter((l) => l.qty === 1).map((l) => l.n);
  assert.ok(qtyOneLines.length > 0, 'the manifest must contain qty-1 lines for this proof to mean anything');
  for (const n of qtyOneLines) {
    assert.ok(qtyLines.has(n), `line ${n} has qty 1 and no set_quantity step - a saved quantity would silently win`);
  }
});

test('a line with a stored id adds by reference; a line without one searches', () => {
  const plan = buildPlan(MANIFEST);
  const byLine = (n) => plan.filter((s) => s.line === n).map((s) => s.command);
  assert.deepStrictEqual(byLine(1), ['add_known_product', 'set_quantity'], 'line 1 has id 489747');
  assert.deepStrictEqual(byLine(4), ['search', 'set_quantity'], 'line 4 has no stored id');
});

test('step ids are unique and idempotency-key safe', () => {
  const plan = buildPlan(MANIFEST);
  const ids = plan.map((s) => s.step_id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate step_id');
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_.:-]{1,64}$/);
});

// ---------------------------------------------------------------------
// search terms
// ---------------------------------------------------------------------

test('search terms are sanitised so a comma-bearing product is still findable', () => {
  const line20 = MANIFEST.lines.find((l) => l.n === 20);
  assert.match(line20.product, /,/, 'line 20 must contain a comma for this proof to bite');
  assert.throws(() => normaliseTerm(line20.product), /unsafe search term/);
  const terms = searchTerms(line20.product);
  assert.ok(terms.length > 0, 'a comma-bearing product produced no usable search term');
  for (const t of terms) assert.doesNotThrow(() => normaliseTerm(t));
});

test('every manifest line without an id yields at least one legal search term', () => {
  const needing = MANIFEST.lines.filter((l) => l.asda_product_id == null);
  for (const l of needing) {
    const terms = searchTerms(l.product);
    assert.ok(terms.length > 0, `line ${l.n} (${l.product}) produced no search term`);
    for (const t of terms) assert.doesNotThrow(() => normaliseTerm(t), `line ${l.n} term "${t}" is unsafe`);
  }
});

test('sanitiseTerm never emits a character normaliseTerm would refuse', () => {
  const nasty = 'Gourmet "Mon Petit" Intense Cod, Sardine, Salmon 6x50g (multi/pack) #1';
  const s = sanitiseTerm(nasty);
  assert.doesNotThrow(() => normaliseTerm(s));
});

test('the multipack branch is read from the note, never from a line number', () => {
  assert.strictEqual(packBranchAllowed(MANIFEST.lines.find((l) => l.n === 16)), true);
  assert.strictEqual(packBranchAllowed(MANIFEST.lines.find((l) => l.n === 1)), false);
});

// ---------------------------------------------------------------------
// the judgement layer - the invention guard
// ---------------------------------------------------------------------

const LINE = { line: 9, product: 'Lucozade Sport Drink Raspberry 4 x 500ml', qty: 1, note: null };
const CANDS = [
  { product_ref: '111', name: 'Lucozade Sport Raspberry 4x500ml' },
  { product_ref: '222', name: 'Lucozade Sport Orange 4x500ml' },
];

test('a model answer naming a reference the live search did NOT return is treated as ambiguous', async () => {
  const r = await judgeLine(LINE, CANDS, { answerFn: async () => '{"product_ref":"999999","why":"looks right"}' });
  assert.strictEqual(r.resolved, false);
  assert.strictEqual(r.reason, 'answer-not-in-candidates');
});

test('a model that abstains does not resolve the line', async () => {
  const r = await judgeLine(LINE, CANDS, { answerFn: async () => '{"ambiguous":true,"why":"two plausible sizes"}' });
  assert.strictEqual(r.resolved, false);
  assert.strictEqual(r.reason, 'model-abstained');
});

test('an unparsable model reply does not resolve the line', async () => {
  const r = await judgeLine(LINE, CANDS, { answerFn: async () => 'I think the raspberry one, probably.' });
  assert.strictEqual(r.resolved, false);
  assert.strictEqual(r.reason, 'unparsable-answer');
});

test('a gateway failure does not resolve the line', async () => {
  const r = await judgeLine(LINE, CANDS, { answerFn: async () => { throw new Error('gateway 500'); } });
  assert.strictEqual(r.resolved, false);
  assert.strictEqual(r.reason, 'gateway-failed');
});

test('zero candidates never reaches the model at all', async () => {
  let called = 0;
  const r = await judgeLine(LINE, [], { answerFn: async () => { called += 1; return '{"product_ref":"111"}'; } });
  assert.strictEqual(r.resolved, false);
  assert.strictEqual(r.reason, 'no-search-results');
  assert.strictEqual(called, 0, 'the model must not be asked to choose from nothing');
});

test('a valid pick from the candidate set resolves to exactly that reference', async () => {
  const r = await judgeLine(LINE, CANDS, { answerFn: async () => '```json\n{"product_ref":"111","why":"raspberry, 4x500ml"}\n```' });
  assert.strictEqual(r.resolved, true);
  assert.strictEqual(r.product_ref, '111');
  assert.strictEqual(r.name, 'Lucozade Sport Raspberry 4x500ml');
});

test('parseReply tolerates fences and prose around the JSON', () => {
  assert.deepStrictEqual(parseReply('here you go: {"a":1} hope that helps'), { a: 1 });
  assert.strictEqual(parseReply('no json here'), null);
  assert.strictEqual(parseReply(''), null);
});

// ---------------------------------------------------------------------
// the launcher
// ---------------------------------------------------------------------

test('launcher configuration fails fast when a required value is absent', () => {
  assert.throws(() => resolveConfig({}, {}), LauncherConfigError);
  assert.throws(() => resolveConfig({ chromePath: 'c.exe' }, {}), /profileDir/);
  assert.throws(() => resolveConfig({ chromePath: 'c.exe', profileDir: 'p' }, {}), /port/);
  assert.throws(() => resolveConfig({ chromePath: 'c.exe', profileDir: 'p', port: 'abc' }, {}), /not a valid TCP port/);
});

test('the launcher carries NO default chrome path or profile directory', () => {
  const src = fs.readFileSync(path.join(__dirname, 'launcher.cjs'), 'utf8')
    .split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/chrome\.exe/i.test(src), 'a chrome executable path is baked into launcher.cjs');
  assert.ok(!/fusion247/i.test(src), 'a profile path is baked into launcher.cjs');
});

test('the spawned argv opens a debuggable, visible Chrome on the configured profile', () => {
  const args = chromeArgs(resolveConfig({ chromePath: 'c.exe', profileDir: 'P', port: 9222 }, {}));
  assert.ok(args.includes('--remote-debugging-port=9222'));
  assert.ok(args.includes('--user-data-dir=P'));
  assert.ok(!args.some((a) => /headless/i.test(a)), 'the shop must never run headless');
});

test('a live endpoint is REUSED and nothing is spawned', async () => {
  let spawned = 0;
  const res = await ensureChrome(
    { chromePath: 'c.exe', profileDir: 'P', port: 9222 },
    {
      fetchImpl: async () => ({ ok: true, json: async () => ({ Browser: 'Chrome/151' }) }),
      spawnImpl: () => { spawned += 1; return { pid: 1, unref() {} }; },
    },
  );
  assert.strictEqual(res.reused, true);
  assert.strictEqual(spawned, 0, 'a second Chrome was spawned against a live endpoint');
});

// ---------------------------------------------------------------------
// the entrypoint - callable by a future trigger without a rewrite
// ---------------------------------------------------------------------

test('the shopping loop sits behind an options-shaped entrypoint, not behind argv', () => {
  const mod = require('./run-basket.cjs');
  assert.strictEqual(typeof mod.runBasket, 'function', 'runBasket must be the entrypoint an event caller uses');
  assert.strictEqual(typeof mod.main, 'function', 'main stays as the shell adapter');

  // main is a THIN adapter over runBasket. If the shopping logic ever moves back
  // inside main, a ShopperBot or Cockpit trigger has to synthesise a command
  // line - which is the rebuild this constraint exists to prevent.
  const src = fs.readFileSync(path.join(__dirname, 'run-basket.cjs'), 'utf8');
  const mainBody = src.slice(src.indexOf('async function main(argv)'));
  const firstLines = mainBody.split(/\r?\n/).slice(0, 2).join('\n');
  assert.match(firstLines, /runBasket\(parseArgs\(argv\)\)/, 'main must delegate straight to runBasket');
});

test('runBasket needs no argv and no shell to be invoked', () => {
  const { runBasket } = require('./run-basket.cjs');
  // Zero required positional arguments: a trigger supplies an options object.
  assert.strictEqual(runBasket.length, 0, 'runBasket must be callable with an options object alone');
});

// ---------------------------------------------------------------------
// reconciliation
// ---------------------------------------------------------------------

test('a line the run believed it added, but absent from the trolley read-back, is a DISCREPANCY', () => {
  const manifest = { lines: [{ n: 1, qty: 2, product: 'Milk', asda_product_id: '489747' }] };
  const outcomes = [{ line: 1, product: 'Milk', qty: 2, status: 'added', product_ref: '489747', qty_actual: 2 }];
  const { rows } = reconcile({ manifest, outcomes, basket: { products: [] } });
  assert.strictEqual(rows[0].in_trolley, false);
  assert.match(rows[0].discrepancy, /NOT found in the trolley read-back/);
});

test('a line present in the trolley at the right quantity carries no discrepancy', () => {
  const manifest = { lines: [{ n: 1, qty: 2, product: 'Milk', asda_product_id: '489747' }] };
  const outcomes = [{ line: 1, product: 'Milk', qty: 2, status: 'added', product_ref: '489747', qty_actual: 2 }];
  const { rows } = reconcile({ manifest, outcomes, basket: { products: [{ product_id: '489747', name: 'Milk' }] } });
  assert.strictEqual(rows[0].in_trolley, true);
  assert.strictEqual(rows[0].discrepancy, null);
});

test('the trolley read-back is matched on EITHER product_ref or product_id', () => {
  // browser.cjs emits product_ref; readTrolley.cjs emits product_id. Reading only
  // one reported every correctly-added line as missing - caught on the first live
  // run, and pinned here so neither snapshot shape can silently stop matching.
  const manifest = { lines: [{ n: 1, qty: 3, product: 'Milk', asda_product_id: '489747' }] };
  const outcomes = [{ line: 1, product: 'Milk', qty: 3, status: 'added', product_ref: '489747', qty_actual: 3 }];
  for (const key of ['product_ref', 'product_id']) {
    const { rows } = reconcile({ manifest, outcomes, basket: { products: [{ [key]: '489747', name: 'Milk' }] } });
    assert.strictEqual(rows[0].in_trolley, true, `a trolley snapshot keyed on ${key} was not matched`);
    assert.strictEqual(rows[0].discrepancy, null);
  }
});

test('a product in the trolley that no manifest line accounts for is reported', () => {
  const manifest = { lines: [{ n: 1, qty: 1, product: 'Milk', asda_product_id: '1' }] };
  const outcomes = [{ line: 1, product: 'Milk', qty: 1, status: 'added', product_ref: '1', qty_actual: 1 }];
  const { unexpected } = reconcile({ manifest, outcomes, basket: { products: [{ product_id: '1', name: 'Milk' }, { product_id: '77', name: 'Something Else' }] } });
  assert.deepStrictEqual(unexpected, [{ product_ref: '77', name: 'Something Else' }]);
});

test('the harvest file is an operations file for a human, and names the enrichment it cannot do', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asdair-harvest-'));
  const file = path.join(dir, 'h.json');
  const payload = writeHarvest(file, {
    manifest: { shop_ref: 'SHOP-X', household_id: 1 },
    harvest: [{ line: 4, manifest_product: 'TGI Fridays BBQ Pulled Pork 400g', asda_product_id: '123456', name_on_site: 'TGI Fridays BBQ Pulled Pork 400g', qty: 2, search_term: 'TGI Fridays BBQ Pulled Pork 400g' }],
  });
  assert.strictEqual(payload.operations.length, 1);
  assert.strictEqual(payload.operations[0].op, 'upsertRegular');
  assert.strictEqual(payload.operations[0].regular.asda_product_id, '123456');
  assert.strictEqual(payload.enrichment_needed.length, 1);
  assert.match(payload.NOT_APPLIED_BY_THE_EXECUTOR, /no live-data write/);
  assert.ok(fs.existsSync(file));
  fs.rmSync(dir, { recursive: true, force: true });
});
