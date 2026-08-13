// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/singleReadingGuard.test.js
//
// WO-2026-08-13-15 (WP-B15-47), AC7. THE SINGLE-READING GUARD, AND THE
// SOURCE MUTATION THAT MAKES IT BITE.
//
// ── THE DEFECT, FOUND AT READ-BACK RATHER THAN AFTER THE RUN ─────────────
// `corroborate()` classified an observation UNANIMOUS whenever
// `support === runCount`. With ONE reading that is trivially true of EVERY
// observation, and `finalList.js` carries `support_class` straight through
// onto every delivered line. So a single-reading run would have shipped the
// STRONGEST agreement label in the vocabulary off a reading nothing had
// corroborated - louder than "corroborated", not weaker, and directly against
// Warwick's ruling that a line is CORROBORATED, never VERIFIED.
//
// Authorised as a product decision by Larry, AMENDMENT 1 (A4).
//
// ── WHY A SOURCE MUTATION AND NOT ONLY A BEHAVIOURAL ONE ────────────────
// A guard that cannot be seen to fail is decorative. The behavioural tests
// below pin what the guard DOES; the mutation below removes the guard from a
// COPY of the real source, asserts the copy genuinely differs from the
// original, and shows the mutant reverting to `unanimous` on one reading.
// Without the "the source actually changed" assertion a mutation proof can
// pass while mutating nothing, which is the failure mode it exists to catch.
//
// ⛔ THE REAL FILE IS NEVER MUTATED. The mutant is written to a temp copy and
// imported from there, so an interrupted run cannot leave `corroborate.js`
// modified on disk. There is no restore step to forget.
//
// FULLY OFFLINE. No database, no network, no model, no credentials file.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { corroborate, SUPPORT } from './corroborate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, 'corroborate.js');

const obs = (over = {}) => ({
  line_no: 1,
  as_written: 'x',
  product_id: null,
  identified: false,
  quantity: 1,
  quantity_basis: 'explicit-on-page',
  confidence: 0.9,
  source_region: 2,
  ...over,
});

const RICHMOND = obs({ line_no: 1, as_written: '1 RICHMOND SAUSAGES 16', product_id: '3', identified: true });
const ARIEL = obs({ line_no: 2, as_written: 'ARIEL PODS 33', product_id: '4', identified: true });

// =====================================================================
// WHAT THE GUARD DOES
// =====================================================================

test('AC7: ONE reading classifies EVERY observation single-reading - never unanimous', () => {
  const r = corroborate([{ label: 'live-1', observations: [RICHMOND, ARIEL] }]);

  assert.equal(r.runCount, 1);
  assert.equal(r.singleReading, true, 'the result must announce that corroboration was unavailable');
  assert.equal(r.observations.length, 2);

  for (const o of r.observations) {
    assert.equal(
      o.support_class, SUPPORT.SINGLE_READING,
      'one reading cannot corroborate itself, and must never carry an agreement class',
    );
    assert.notEqual(o.support_class, SUPPORT.UNANIMOUS);
    assert.notEqual(o.support_class, SUPPORT.CORROBORATED);
    // The raw arithmetic stays honest and visible underneath the class.
    assert.equal(o.support, 1);
    assert.equal(o.support_of, 1);
  }
});

test('AC7: the single-reading class is NOT a corroboration-implying word', () => {
  // AC5's standing bar, applied to the member this Work Order added.
  assert.doesNotMatch(SUPPORT.SINGLE_READING, /corrobor|unanim|verif|proven|certain/i);
});

test('AC7: counts are complete and never NaN when the fourth class is in play', () => {
  const r = corroborate([{ label: 'live-1', observations: [RICHMOND, ARIEL] }]);

  // Derived from the vocabulary, so a new member can never silently produce
  // `undefined + 1`. This is the regression the hand-listed literal caused.
  for (const v of Object.values(SUPPORT)) {
    assert.equal(typeof r.counts[v], 'number', `counts.${v} must exist`);
    assert.ok(Number.isFinite(r.counts[v]), `counts.${v} must not be NaN`);
  }
  assert.equal(r.counts[SUPPORT.SINGLE_READING], 2);
  assert.equal(r.counts[SUPPORT.UNANIMOUS], 0);

  const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
  assert.equal(total, r.observations.length, 'every observation must be counted exactly once');
});

// =====================================================================
// WHAT THE GUARD MUST NOT BREAK - the multi-run vocabulary is untouched
// =====================================================================

test('AC7: TWO runs that agree still classify unanimous - the guard is scoped to runCount < 2', () => {
  const r = corroborate([
    { label: 'r1', observations: [RICHMOND] },
    { label: 'r2', observations: [RICHMOND] },
  ]);
  assert.equal(r.singleReading, false);
  assert.equal(r.observations[0].support_class, SUPPORT.UNANIMOUS);
});

test('AC7: a line seen by ONE of THREE runs is still uncorroborated, not single-reading', () => {
  // The distinction the fourth class exists to preserve: "one run out of
  // several disagreed" is evidence; "there was only ever one run" is not.
  const r = corroborate([
    { label: 'r1', observations: [RICHMOND, ARIEL] },
    { label: 'r2', observations: [RICHMOND] },
    { label: 'r3', observations: [RICHMOND] },
  ]);
  assert.equal(r.singleReading, false);
  const byKey = new Map(r.observations.map((o) => [o.identity_key, o]));
  assert.equal(byKey.get('id:3').support_class, SUPPORT.UNANIMOUS);
  assert.equal(byKey.get('id:4').support_class, SUPPORT.UNCORROBORATED,
    'seen by one run OUT OF THREE is a real disagreement and keeps its own class');
});

// =====================================================================
// THE MUTATION - the guard removed from a COPY of the real source
// =====================================================================

test('AC7 MUTATION: with the runCount<2 guard removed, ONE reading reverts to UNANIMOUS', async () => {
  const original = readFileSync(SOURCE, 'utf8');

  // Split on /\r?\n/ discipline is not needed here - this is a targeted string
  // replacement, not a line scan - but the needle is pinned to the exact
  // committed text so a silent refactor breaks this test loudly rather than
  // mutating nothing and passing.
  const NEEDLE = 'const singleReading = runCount < 2;';
  assert.ok(
    original.includes(NEEDLE),
    'the guard has moved or been reworded - this mutation proof is pinned to its exact text and must be re-pinned deliberately',
  );

  const mutated = original.replace(NEEDLE, 'const singleReading = false;');
  assert.notEqual(
    mutated, original,
    'THE SOURCE DID NOT CHANGE - a mutation proof that mutates nothing proves nothing',
  );

  const dir = mkdtempSync(join(tmpdir(), 'keel-corroborate-mutant-'));
  try {
    const mutantPath = join(dir, 'corroborate.mutant.mjs');
    writeFileSync(mutantPath, mutated, 'utf8');
    const mutant = await import(pathToFileURL(mutantPath).href);

    const r = mutant.corroborate([{ label: 'live-1', observations: [RICHMOND, ARIEL] }]);

    for (const o of r.observations) {
      assert.equal(
        o.support_class, 'unanimous',
        'WITHOUT the guard a single reading is labelled unanimous - which is exactly the defect, '
        + 'and its reappearance here is what proves the guard in the real file is load-bearing',
      );
    }
    assert.equal(r.counts.unanimous, 2);
    assert.equal(r.counts['single-reading'], 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // The real file is untouched: the mutant only ever existed in a temp copy.
  assert.equal(readFileSync(SOURCE, 'utf8'), original, 'corroborate.js must be byte-identical after the mutation run');
});
