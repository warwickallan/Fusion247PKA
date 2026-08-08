// Executes the CAPAE mapping and the active-brief selection against fixtures. No server, no
// database, no network — `capae.mjs` takes an injected `query`, so the whole contract is reachable
// from here. Same construction as `rotation-report-check.mjs`.
//
// EVERY ASSERTION BELOW WAS MADE TO FAIL BEFORE IT WAS KEPT. A check that cannot fail is not a
// check, and this estate has paid for that lesson more than once.

import assert from 'node:assert/strict';
import { capaeResponse, activeBrief, effectivenessLine, mapFamily, num, capaeOverview, familiesByUrgency } from './capae.mjs';

let asserts = 0;
const ok = (fn, msg) => { fn(); asserts++; void msg; };

// ---- fixtures ---------------------------------------------------------------------------------
const FAMILY_ROWS = [
  { id: 'f1', slug: 'pilot-fam', title: 'Pilot family', cause_class: 'existing control not invoked',
    finding: 'F', latest_correction: 'C', root_cause: 'R', rca_status: 'ESTABLISHED', rca_confidence: 'high',
    cause_detection_escape: { cause: 'c', detection: 'd', escape: 'e' },
    preventive_action: 'P', required_larry_behaviour: 'B', state: 'MONITORING',
    exposures_clean: 0, exposures_required: 5, unmeasurable: false, occurrences: 2,
    first_seen_at: '2026-08-06T00:00:00Z', last_occurrence_at: '2026-08-07T00:00:00Z',
    evidence_refs: ['a'], is_pilot: true },
  { id: 'f2', slug: 'proven-fam', title: 'Proven family', cause_class: null,
    finding: null, latest_correction: null, root_cause: null, rca_status: 'UNESTABLISHED', rca_confidence: null,
    cause_detection_escape: {}, preventive_action: null, required_larry_behaviour: null,
    state: 'EFFECTIVE', exposures_clean: 5, exposures_required: 5, unmeasurable: false, occurrences: 3,
    first_seen_at: '2026-08-01T00:00:00Z', last_occurrence_at: '2026-08-02T00:00:00Z',
    evidence_refs: [], is_pilot: false },
  { id: 'f3', slug: 'rare-fam', title: 'Rare family', cause_class: 'judgement',
    finding: null, latest_correction: null, root_cause: 'r', rca_status: 'ESTABLISHED', rca_confidence: 'high',
    cause_detection_escape: {}, preventive_action: null, required_larry_behaviour: 'never',
    state: 'UNMEASURABLE', exposures_clean: 0, exposures_required: null, unmeasurable: true, occurrences: 2,
    first_seen_at: '2026-08-08T00:00:00Z', last_occurrence_at: '2026-08-08T00:00:00Z',
    evidence_refs: [], is_pilot: false },
  { id: 'f4', slug: 'doubt-fam', title: 'Doubted family', cause_class: 'rule not invoked',
    finding: null, latest_correction: null, root_cause: 'r', rca_status: 'ESTABLISHED', rca_confidence: 'high',
    cause_detection_escape: {}, preventive_action: 'p', required_larry_behaviour: 'do',
    state: 'CHALLENGED', exposures_clean: 0, exposures_required: 5, unmeasurable: false, occurrences: 5,
    first_seen_at: '2026-08-05T00:00:00Z', last_occurrence_at: '2026-08-08T00:00:00Z',
    evidence_refs: [], is_pilot: false },
];
const OCC_ROWS = [
  { family_id: 'f1', occurred_at: '2026-08-07T00:00:00Z', disposition: 'CLEAN-EXPOSURE', summary: 's',
    evidence_ref: 'e', session_date: '2026-08-07', deliverable_path: 'Deliverables/x.md', branch: 'main', closing_head: 'abc' },
  { family_id: 'f1', occurred_at: '2026-08-06T00:00:00Z', disposition: 'NEW', summary: 's2',
    evidence_ref: null, session_date: null, deliverable_path: null, branch: null, closing_head: null },
];

const query = async (sql) => (String(sql).includes('capae_occurrence') ? { rows: OCC_ROWS } : { rows: FAMILY_ROWS });

// ---- the contract -----------------------------------------------------------------------------
const res = await capaeResponse(query);
ok(() => assert.equal(res.ok, true), 'reads');
ok(() => assert.equal(res.families.length, 4), 'all families mapped');

const byslug = Object.fromEntries(res.families.map((f) => [f.slug, f]));

// ABSENT IS NEVER ZERO. `exposures_required` null must survive as null, not become 0 — a family with
// no target is not a family that needs zero exposures.
ok(() => assert.equal(byslug['rare-fam'].exposures_required, null), 'null target stays null');
ok(() => assert.equal(num(undefined), null), 'num keeps absence');

// UNESTABLISHED is a first-class answer and must survive the mapping intact.
ok(() => assert.equal(byslug['proven-fam'].rca_status, 'UNESTABLISHED'), 'unestablished RCA survives');
ok(() => assert.equal(byslug['proven-fam'].root_cause, null), 'no root cause is null, not ""');

// History groups to the right family and never leaks across.
ok(() => assert.equal(byslug['pilot-fam'].history.length, 2), 'occurrences grouped');
ok(() => assert.equal(byslug['doubt-fam'].history.length, 0), 'a family with none gets [], not null');
// An occurrence outside a recorded rotation renders absent, never zero or a fake date.
ok(() => assert.equal(byslug['pilot-fam'].history[1].session_date, null), 'unlinked occurrence has no session');

// ---- effectiveness must never overstate --------------------------------------------------------
ok(() => assert.match(effectivenessLine(FAMILY_ROWS[0]), /NOT YET MEASURED/), '0 clean is not progress');
ok(() => assert.doesNotMatch(effectivenessLine(FAMILY_ROWS[0]), /PROVEN/), 'monitoring is never proven');
ok(() => assert.match(effectivenessLine(FAMILY_ROWS[2]), /UNMEASURABLE/), 'rare family says so');
ok(() => assert.doesNotMatch(effectivenessLine(FAMILY_ROWS[2]), /0\/|\d\/\d/), 'no fraction on an unmeasurable family');
ok(() => assert.match(effectivenessLine(FAMILY_ROWS[1]), /PROVEN/), 'effective family reports proven');
ok(() => assert.match(effectivenessLine(FAMILY_ROWS[3]), /CHALLENGED/), 'challenged says so');

// ---- the active brief: what Larry is handed -----------------------------------------------------
const active = activeBrief(res.families);
const slugs = active.map((a) => a.slug);
// AN EFFECTIVE FAMILY LEAVES LARRY'S ATTENTION. This is the brief's "the list should naturally
// rotate" property, and it is the one most likely to be quietly lost in a refactor.
ok(() => assert.ok(!slugs.includes('proven-fam')), 'EFFECTIVE leaves the active brief');
// AN UNMEASURABLE FAMILY IS NOT NOISE AT CONTINUE — Larry can do nothing with a counter that cannot move.
ok(() => assert.ok(!slugs.includes('rare-fam')), 'UNMEASURABLE is excluded');
ok(() => assert.equal(slugs[0], 'pilot-fam'), 'the pilot is pinned first');
ok(() => assert.ok(slugs.includes('doubt-fam')), 'a challenged family stays active');
ok(() => assert.ok(active.length <= 5), 'the brief is bounded');
// TINY. The whole point is that this costs Larry hundreds of tokens, not thousands.
ok(() => assert.ok(JSON.stringify(active).length < 2000), 'the active brief stays small');

// NO ACTIONABLE STATE MEANS NO NOISE — mechanically true, not aspirational.
ok(() => assert.deepEqual(activeBrief(res.families.filter((f) => f.state === 'EFFECTIVE')), []), 'all-effective yields an empty brief');

// ---- failure is a sentence, never a DSN --------------------------------------------------------
const boom = async () => { const e = new Error('connect ECONNREFUSED 10.0.0.1:5432 user=cp_directus'); e.code = '28P01'; throw e; };
const failed = await capaeResponse(boom);
ok(() => assert.equal(failed.ok, false), 'a failed read reports ok:false');
ok(() => assert.match(failed.error, /rejected the cockpit credentials/), 'sentence from SQLSTATE');
ok(() => assert.doesNotMatch(failed.error, /5432|ECONNREFUSED|cp_directus/), 'never leaks the DSN, host or role');

// mapFamily must not invent a state
ok(() => assert.equal(mapFamily({ slug: 's', title: 't' }).state, 'MONITORING'), 'default state is the unproven one');
ok(() => assert.equal(mapFamily({ slug: 's', title: 't' }).rca_status, 'UNESTABLISHED'), 'default RCA is the honest one');


// ── capaeOverview / familiesByUrgency — THE DERIVATION BEHIND BOTH ATTENTION SIGNALS ─────────────
//
// ⚠️ THESE WERE ASSERTED BY NOTHING. Veritas proved it at 83bcdec by replacing
//     const needsAttention = ineffective.length > 0 || reopened.length > 0;
// with `= true` and running SIX gates — every one exited 0. `render-vm-check` covers both branches
// of the Home card, but it STUBS `capOverview` as a fixture, so it proves the template GIVEN an
// answer and never the answer itself. Home's one signal and System's leading alert both read this
// function; nothing anywhere read it back.
const FAM = (over = {}) => ({
  slug: 'f', title: 'F', state: 'MONITORING', occurrences: 0, is_pilot: false,
  unmeasurable: false, exposures_clean: 0, exposures_required: 5, history: [], ...over,
});

// The exact mutation Veritas used. `needsAttention = true` must now fail HERE.
ok(() => assert.equal(capaeOverview([FAM()]).needsAttention, false),
  'MUTATION GUARD: a lone MONITORING family does NOT need attention');
ok(() => assert.equal(capaeOverview([]).needsAttention, false),
  'MUTATION GUARD: an empty record does NOT need attention');
ok(() => assert.equal(capaeOverview([FAM({ state: 'EFFECTIVE' }), FAM({ slug: 'g', state: 'UNMEASURABLE' })]).needsAttention, false),
  'MUTATION GUARD: proven and unmeasurable families do NOT need attention');

// ...and the positive half, so the guard cannot be satisfied by always returning false.
ok(() => assert.equal(capaeOverview([FAM({ state: 'CHALLENGED' })]).needsAttention, true),
  'a CHALLENGED family - a prevention that HAD been proven and failed since - needs attention');
ok(() => assert.equal(capaeOverview([FAM({ state: 'INEFFECTIVE' })]).needsAttention, true),
  'an INEFFECTIVE family needs attention');

ok(() => assert.deepEqual(capaeOverview([FAM({ state: 'CHALLENGED' }), FAM({ slug: 'g' })]).counts,
  { MONITORING: 1, CHALLENGED: 1, EFFECTIVE: 0, INEFFECTIVE: 0, UNMEASURABLE: 0 }),
  'counts carry all five states, present even at zero');

ok(() => assert.equal(capaeOverview([FAM({ state: 'CHALLENGED', title: 'Reopened one' })]).reopened[0].title, 'Reopened one'),
  'CHALLENGED is what reopened means, and it names the family');

ok(() => assert.equal(capaeOverview([FAM({ is_pilot: true, required_larry_behaviour: 'Do the thing.' })]).pilot.nextQualifiedExposure, 'Do the thing.'),
  'the pilot next qualified exposure is the record own words, not a paraphrase');

ok(() => assert.equal(capaeOverview([FAM()]).pilot, null), 'no pilot flagged means no pilot claimed');

// latestRecurrence must pick the most recent FAILURE, never a clean or a no-op.
ok(() => assert.equal(capaeOverview([FAM({ history: [
  { disposition: 'RECURRENCE', occurred_at: '2026-01-01T00:00:00Z', summary: 'older' },
  { disposition: 'CLEAN-EXPOSURE', occurred_at: '2026-02-01T00:00:00Z', summary: 'clean' },
  { disposition: 'NONE-THIS-SESSION', occurred_at: '2026-03-01T00:00:00Z', summary: 'none' },
] })]).latest.summary, 'older'),
  'the latest RECURRENCE is a failure - a later clean or no-op must not displace it');

ok(() => assert.equal(capaeOverview([FAM()]).latest, null), 'a family with no failures reports no latest recurrence');

// Ordering drives which family Home names as the most important.
ok(() => assert.deepEqual(
  familiesByUrgency([FAM({ slug: 'mon' }), FAM({ slug: 'eff', state: 'EFFECTIVE' }), FAM({ slug: 'inef', state: 'INEFFECTIVE' }), FAM({ slug: 'chal', state: 'CHALLENGED' })]).map((f) => f.slug),
  ['inef', 'chal', 'mon', 'eff']),
  'worst first: INEFFECTIVE, CHALLENGED, MONITORING, then EFFECTIVE last');

ok(() => assert.equal(familiesByUrgency([FAM({ slug: 'a' }), FAM({ slug: 'p', is_pilot: true })])[0].slug, 'p'),
  'the pilot lifts within its band');

console.log(`CAPAE-CHECK PASS — ${asserts} assertions executed, 0 failed.`);
