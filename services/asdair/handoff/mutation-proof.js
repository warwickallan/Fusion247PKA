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

const { buildHandoff } = require('./buildHandoff');
const { openHandoff, claimHandoff, reportProgress, DEFAULT_LEASE_MS } = require('./claim');
const { makeFakeStore } = require('./test/fakeRequestStore');
const { basePacket } = require('./test/fixtures');

const SHOP = 42;

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

module.exports = { runMutations, MUTATIONS, secondWriterClaimed, staleWriterWrote, secondLiveRowAppeared };
