// =====================================================================
// BUILD-015 AsdAIr - handoff/mutation-proof.js
//
// A CONTROL IS NOT EVIDENCE UNTIL IT HAS BEEN MADE TO FAIL.
//
// claim.test.js asserts that a second writer cannot claim a live request and
// that a stale writer cannot keep writing. Those assertions are worth exactly
// nothing until it is shown that they would NOTICE if the guard were removed -
// a test that passes with the guard AND without it is testing nothing, and it
// looks identical to a real one.
//
// So this file breaks each guard on purpose, re-runs the same scenario, and
// requires the outcome to CHANGE. If a mutation does not change the outcome,
// this exits non-zero: that means the corresponding proof is inert.
//
//   1. claimIgnoresLease   - the atomic claim stops checking for a live lease.
//                            EXPECT: a second writer claims a live request.
//   2. noFencing           - progress/heartbeat/complete stop checking
//                            claimed_by and the stored lease holder.
//                            EXPECT: a writer that lost its lease keeps writing.
//   3. noLiveRowConstraint - the partial unique index bbr_one_live_per_shop is
//                            disabled. EXPECT: a repeated handoff opens a
//                            SECOND live request for the same shop.
//
// Run standalone:  node mutation-proof.js
// Run in the suite: mutation.test.js requires runMutations() and asserts on it.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const { buildHandoff } = require('./buildHandoff');
const { openHandoff, claimHandoff, reportProgress, DEFAULT_LEASE_MS } = require('./claim');
const { makeFakeStore } = require('./test/fakeRequestStore');
const { basePacket } = require('./test/fixtures');

const SHOP = 42;

// =====================================================================
// LANE C - SIX MORE GUARDS, AND THE SAME RULE APPLIED TO THEM.
//
// Warwick, 2026-08-09, on the browser operating contract: "No browser execution
// path may be able to bypass that contract simply because an agent did not read
// instructions.js." Six behaviours were named, each of which must make a test
// go RED when it regresses:
//
//   (a) a second product tab is opened
//   (b) Regulars/Favourites is bypassed for an ordinary known regular
//   (c) Brand A-Z ordering is omitted
//   (d) per-item search becomes the default rather than a bounded fallback
//   (e) trolley verification is skipped
//   (f) the BROWSER_METHOD payload is absent from the production execution path
//
// ── HOW THE MUTATION IS APPLIED, AND WHY NOT WITH A SWITCH ──────────────────
// The three original mutations above break a COLLABORATOR (the fake store), so
// a flag was enough. These six break guards that live inside the modules
// themselves, and adding an "ignore this guard" switch to production code would
// mean shipping the bypass in order to prove the bypass is closed.
//
// So the source is mutated instead - genuinely, on the real file's text - and
// compiled IN MEMORY under the real filename, so relative requires still
// resolve and NOTHING is written to disk. There is no temporary copy to be left
// behind by an interrupted run and no window in which the checked-out source is
// the mutated one. The original module is never touched.
// =====================================================================

const HERE = __dirname;

/**
 * Compile mutated source as if it were the file it came from.
 *
 * `filename` is the REAL path, so `require('./instructions')` inside the
 * mutated text resolves exactly as it does in production. The mutant lives only
 * in this process's memory and is never added to the module cache, so the real
 * module every other test uses is unaffected.
 */
function loadMutated(relPath, mutate) {
  const filename = path.join(HERE, relPath);
  const original = fs.readFileSync(filename, 'utf8');
  const mutated = mutate(original);
  if (mutated === original) {
    throw new Error(`mutation-proof: the mutation for ${relPath} changed NOTHING. `
      + 'The source it targets has moved, so the proof below would pass vacuously.');
  }
  const m = new Module(filename, null);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(mutated, filename);
  return m.exports;
}

/** buildHandoff, with the named guards removed from its real source. */
function handoffModule(flags) {
  const f = flags || {};
  if (!f.regularsBypassed && !f.sortContractIgnored && !f.searchByDefault && !f.methodPayloadAbsent) {
    return require('./buildHandoff');
  }
  return loadMutated('buildHandoff.js', (src) => {
    let out = src;
    if (f.regularsBypassed) {
      // The guard that keeps a known item with a usable reference OFF free
      // search - i.e. that keeps it in Regulars/Favourites.
      out = out.replace(
        "if (line.origin === 'known' && line.source_view === 'search' && hasUsableRef(line)) {",
        'if (false) {',
      );
    }
    if (f.sortContractIgnored) {
      // The assertion that the packet is actually in brand A-Z order. Brand A-Z
      // is the MECHANISM that makes one top-to-bottom pass possible; without
      // the check a mis-sorted packet ships looking correct.
      out = out.replace(
        'if (compareLines(packet.lines[i - 1], packet.lines[i]) > 0) {',
        'if (false) {',
      );
    }
    if (f.searchByDefault) {
      // The bounded-search mechanism, in BOTH its halves: retrievalFor(), which
      // attaches the verify-before-add and stop-if-ambiguous duties, and
      // assertSearchIsBounded(), which refuses a search line that lacks them.
      // Remove both and free search is simply the default way to shop.
      out = out.replace('function retrievalFor(line) {', 'function retrievalFor(line) { return null;');
      out = out.replace('assertSearchIsBounded(lines);', ';');
    }
    if (f.methodPayloadAbsent) {
      // The payload going missing (as a broken import would do) AND the
      // producer's refusal to emit an artefact without it.
      out = out.replace('method: BROWSER_METHOD.map(', 'method: [].map(');
      out = out.replace('assertMethodPayload(artefact);', ';');
    }
    return out;
  });
}

/**
 * SCENARIO (b) - an ordinary known regular, with a perfectly good ASDA
 * reference, routed to free search instead of Regulars/Favourites.
 * @returns {boolean} true when that packet produced a handoff anyway (the failure)
 */
async function regularFreeSearched(mutate) {
  const { buildHandoff: build } = handoffModule(mutate);
  const packet = basePacket();
  packet.lines[0].source_view = 'search';        // ref 1000001 is still right there
  try {
    const handoff = build(packet);
    return handoff.lines[0].source_view === 'search';
  } catch (e) {
    if (e.name === 'PacketContractError') return false;
    throw e;
  }
}

/**
 * SCENARIO (c) - a packet whose lines are NOT in brand A-Z order.
 * @returns {boolean} true when the mis-sorted packet produced a handoff (the failure)
 */
async function misSortedPacketAccepted(mutate) {
  const { buildHandoff: build } = handoffModule(mutate);
  const packet = basePacket();
  const [a, b] = [packet.lines[0], packet.lines[1]];
  packet.lines[0] = { ...b, seq: 1 };            // Brava before Acme - Z before A
  packet.lines[1] = { ...a, seq: 2 };
  try {
    build(packet);
    return true;
  } catch (e) {
    if (e.name === 'PacketContractError') return false;
    throw e;
  }
}

/**
 * SCENARIO (d) - a known item with no ASDA reference on file, which must travel
 * as a BOUNDED retrieval and never as an ordinary free search.
 * @returns {boolean} true when it reached the worker unbounded (the failure)
 */
async function searchWentUnbounded(mutate) {
  const { buildHandoff: build } = handoffModule(mutate);
  const packet = basePacket();
  packet.lines[0].asda_product_ref = null;       // the ordinary no-reference case
  packet.lines[0].asda_url = null;
  packet.lines[0].source_view = 'search';
  try {
    const handoff = build(packet);
    return handoff.lines[0].retrieval === null;  // searched, with no duties attached
  } catch (e) {
    if (e.name === 'PacketContractError') return false;
    throw e;
  }
}

/**
 * SCENARIO (f) - the production route opens a durable browser build request.
 * The artefact it carries must hold the operating contract.
 * @returns {boolean} true when a request was opened for a contract-less artefact (the failure)
 */
async function requestOpenedWithoutMethod(mutate) {
  const { buildHandoff: build } = handoffModule(mutate);
  const h = harness({});
  let handoff;
  try {
    handoff = build(basePacket());
  } catch (e) {
    if (e.name === 'PacketContractError') return false;   // refused before anything durable happened
    throw e;
  }
  await openHandoff(h.query, { shopId: SHOP, handoff, now: h.nowMs });
  const opened = liveRows(h).length === 1;
  return opened && (!Array.isArray(handoff.method) || handoff.method.length === 0);
}

/**
 * SCENARIO (e) - a basket that is genuinely WRONG (an expected product is not
 * in it) must never be reported verified.
 * @returns {boolean} true when the wrong basket was reported verified (the failure)
 */
async function wrongBasketReportedVerified(mutate) {
  const f = mutate || {};
  const mod = f.verificationSkipped
    ? loadMutated('../reconcile/verifyBasket.js', (src) => src.replace(
      // The line-derived half of the verdict: without it `verified` stops
      // depending on whether the products are actually in the trolley.
      'if (summary.missing > 0) blocking.push(',
      'if (false) blocking.push(',
    ))
    : require('../reconcile/verifyBasket.js');

  const packet = basePacket();
  const expected = {
    expected_distinct_products: packet.expected_distinct_products,
    expected_total_units: packet.expected_total_units,
    lines: packet.lines,
  };
  // The basket as captured: line 1 never made it in.
  const actual = {
    lines: packet.lines.slice(1).map((l) => ({
      seq: l.seq,
      canonical_product_id: l.canonical_product_id,
      asda_product_ref: l.asda_product_ref,
      product_name: l.canonical_product_name,
      quantity: l.required_quantity,
      status: 'in_basket',
    })),
  };
  const report = mod.verifyBasket({ expected, actual });
  return report.verified === true;
}

/**
 * SCENARIO (a) - the browser arm, asked to open a page per product exactly as
 * `withPage()` used to. Cross-package on purpose: the invariant lives in the
 * arm, and a proof of it that ran anywhere else would be proving something
 * about a copy. Required lazily so the handoff package still loads, and still
 * runs, on a box where the arm is not installed.
 * @returns {boolean} true when more than one page target was created (the failure)
 */
async function secondProductTabOpened(mutate) {
  const f = mutate || {};
  let cdp;
  try {
    cdp = require('../browser-runner/cdp.js');
  } catch {
    throw new Error('mutation-proof: the browser arm could not be loaded, so proof (a) cannot run. '
      + 'It is not silently skipped - an unrunnable proof is reported, never treated as a pass.');
  }

  const pages = [];
  let created = 0;
  cdp._internal.setTransport(async (pathname) => {
    if (pathname === '/json/list') return pages.map((p) => ({ ...p }));
    if (pathname.startsWith('/json/new')) {
      created += 1;
      const page = { id: `M${created}`, type: 'page', url: decodeURIComponent(pathname.slice('/json/new?'.length)) };
      pages.push(page);
      return { ...page };
    }
    throw new Error(`unexpected CDP path ${pathname}`);
  });
  cdp._internal.setOneTabGuard(f.allowSecondTab !== true);
  cdp.releaseSessionTab();

  try {
    for (let i = 0; i < 3; i += 1) {
      try {
        await cdp._internal.createPageTarget(`https://www.asda.com/groceries/product/${489747 + i}`);
      } catch (e) {
        if (e.name === 'OneTabViolationError') break;      // refused, as it must be
        throw e;
      }
    }
    return created > 1;
  } finally {
    cdp._internal.setTransport(null);
    cdp._internal.setOneTabGuard(true);
    cdp.releaseSessionTab();
  }
}

function harness(mutate) {
  let t = Date.UTC(2026, 7, 9, 9, 0, 0);
  const store = makeFakeStore({ mutate, now: () => new Date(t) });
  return { query: store.query, state: store.state, advance: (ms) => { t += ms; }, nowMs: () => t };
}

const liveRows = (h) => h.state.requests.filter((r) => ['queued', 'claimed', 'running'].includes(r.status));

/**
 * SCENARIO 1 - two writers race for one live request.
 * @returns {boolean} true when a SECOND writer got the request (the failure)
 */
async function secondWriterClaimed(mutate) {
  const h = harness(mutate);
  const handoff = buildHandoff(basePacket());
  await openHandoff(h.query, { shopId: SHOP, handoff, now: h.nowMs });
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  if (!a) throw new Error('scenario invalid: the FIRST writer failed to claim');
  const b = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' });
  return b !== null;
}

/**
 * SCENARIO 2 - a writer loses its lease and then tries to write.
 * @returns {boolean} true when the stale writer's write SUCCEEDED (the failure)
 */
async function staleWriterWrote(mutate) {
  const h = harness(mutate);
  const handoff = buildHandoff(basePacket());
  await openHandoff(h.query, { shopId: SHOP, handoff, now: h.nowMs });
  const a = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-A' });
  h.advance(DEFAULT_LEASE_MS + 1000);
  const b = await claimHandoff(h.query, { shopId: SHOP, writerId: 'sonnet-B' });
  if (!b) throw new Error('scenario invalid: the takeover did not happen');
  try {
    await reportProgress(h.query, { requestId: a.id, writerId: 'sonnet-A', progress: { done: [1, 2] } });
    return true;                      // the stale writer is still clicking
  } catch (e) {
    if (e.name === 'LeaseLostError') return false;
    throw e;
  }
}

/**
 * SCENARIO 3 - the same handoff is issued twice.
 * @returns {boolean} true when a SECOND live row appeared (the failure)
 */
async function secondLiveRowAppeared(mutate) {
  const h = harness(mutate);
  const handoff = buildHandoff(basePacket());
  await openHandoff(h.query, { shopId: SHOP, handoff, now: h.nowMs });
  await openHandoff(h.query, { shopId: SHOP, handoff, now: h.nowMs });
  return liveRows(h).length > 1;
}

const MUTATIONS = [
  {
    name: 'claimIgnoresLease',
    guard: 'the atomic claim (a live lease blocks a second claimer)',
    scenario: secondWriterClaimed,
    mutate: { claimIgnoresLease: true },
    failureMeans: 'a second writer claimed a request a live writer already held',
  },
  {
    name: 'noFencing',
    guard: 'the write fence (claimed_by + the stored lease holder)',
    scenario: staleWriterWrote,
    mutate: { noFencing: true },
    failureMeans: 'a writer whose lease was taken over kept writing',
  },
  {
    name: 'noLiveRowConstraint',
    guard: 'the partial unique index bbr_one_live_per_shop',
    scenario: secondLiveRowAppeared,
    mutate: { noLiveRowConstraint: true },
    failureMeans: 'a repeated handoff opened a SECOND live request for the same shop',
  },

  // ── LANE C - the six behaviours Warwick named, in his order ───────────────
  {
    name: 'secondProductTab',
    behaviour: '(a) a second product tab is opened',
    method_step: 'one_session_one_page_context',
    guard: 'cdp.js keeps the tab-creating primitive unexported and refuses a second live page target',
    scenario: secondProductTabOpened,
    mutate: { allowSecondTab: true },
    failureMeans: 'the arm opened a tab per product - the slow, wrong shop Warwick watched',
  },
  {
    name: 'regularsBypassed',
    behaviour: '(b) Regulars/Favourites is bypassed for an ordinary known regular',
    method_step: 'regulars_favourites_first',
    guard: 'buildHandoff refuses a known line that has a usable reference and was sent to search',
    scenario: regularFreeSearched,
    mutate: { regularsBypassed: true },
    failureMeans: 'a known regular with a perfectly good ASDA reference was free-searched instead',
  },
  {
    name: 'sortContractIgnored',
    behaviour: '(c) Brand A-Z ordering is omitted',
    method_step: 'set_brand_az_ordering',
    guard: 'buildHandoff asserts the packet really is in brand A-Z order',
    scenario: misSortedPacketAccepted,
    mutate: { sortContractIgnored: true },
    failureMeans: 'a mis-sorted packet shipped, so the plan order and the ASDA page order no longer agree',
  },
  {
    name: 'searchByDefault',
    behaviour: '(d) per-item search becomes the default rather than a bounded fallback',
    method_step: 'known_item_retrieval',
    guard: 'the bounded-search mechanism: retrievalFor() attaches the duties, assertSearchIsBounded() enforces them',
    scenario: searchWentUnbounded,
    mutate: { searchByDefault: true },
    failureMeans: 'a known item was free-searched with no verify-before-add and no stop-if-ambiguous duty',
  },
  {
    name: 'verificationSkipped',
    behaviour: '(e) trolley verification is skipped',
    method_step: 'verify_each_add_from_trolley',
    guard: 'verifyBasket derives `verified` FROM THE LINES, so a missing product blocks it',
    scenario: wrongBasketReportedVerified,
    mutate: { verificationSkipped: true },
    failureMeans: 'a basket with a product missing from it was reported VERIFIED',
  },
  {
    name: 'methodPayloadAbsent',
    behaviour: '(f) the BROWSER_METHOD payload is absent from the production execution path',
    method_step: 'the whole contract',
    guard: 'buildHandoff refuses an artefact that does not carry the method and the prohibitions',
    scenario: requestOpenedWithoutMethod,
    mutate: { methodPayloadAbsent: true },
    failureMeans: 'a durable browser build request was opened carrying NO operating contract at all',
  },
];

/**
 * Run every mutation. Each result is `caught: true` only when the honest store
 * held AND the mutated store broke - i.e. the guard is load-bearing and the
 * proof would notice its removal.
 */
async function runMutations() {
  const results = [];
  for (const m of MUTATIONS) {
    const honest = await m.scenario({});
    const mutated = await m.scenario(m.mutate);
    results.push({
      name: m.name,
      guard: m.guard,
      failureMeans: m.failureMeans,
      honestFailed: honest,          // must be false: the guard holds
      mutatedFailed: mutated,        // must be true: removing it breaks the property
      caught: honest === false && mutated === true,
    });
  }
  return results;
}

async function main() {
  const results = await runMutations();
  let bad = 0;
  for (const r of results) {
    if (r.caught) {
      console.log(`MUTATION CAUGHT  ${r.name}`);
      console.log(`  guard         : ${r.guard}`);
      console.log(`  with guard    : property HELD`);
      console.log(`  guard removed : ${r.failureMeans}`);
    } else {
      bad += 1;
      console.log(`MUTATION NOT CAUGHT  ${r.name}  <-- THE PROOF IS INERT`);
      console.log(`  guard         : ${r.guard}`);
      console.log(`  with guard    : ${r.honestFailed ? 'property ALREADY BROKEN' : 'property held'}`);
      console.log(`  guard removed : ${r.mutatedFailed ? 'property broken' : 'property STILL held - the test proves nothing'}`);
    }
  }
  console.log(`\n${results.length - bad}/${results.length} guards proven load-bearing.`);
  if (bad > 0) { process.exitCode = 1; return; }
  console.log('Every two-writers guard was removed on purpose and the break was detected.');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exitCode = 1; });

module.exports = {
  runMutations, MUTATIONS,
  secondWriterClaimed, staleWriterWrote, secondLiveRowAppeared,
  secondProductTabOpened, regularFreeSearched, misSortedPacketAccepted,
  searchWentUnbounded, wrongBasketReportedVerified, requestOpenedWithoutMethod,
};
