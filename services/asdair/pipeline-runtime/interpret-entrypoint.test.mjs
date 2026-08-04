// =====================================================================
// BUILD-015 AsdAIr Stage 1 - interpret-entrypoint.test.mjs
//
// WO-ZA item 4: services/asdair/interpret/interpret-list.js must be structurally
// incapable of being mistaken for proof that the grounded model path works.
//
// THE DEFECT (D-2026-08-03-04): `--dry-run` loaded the catalogue, printed the
// prompt, SKIPPED THE MODEL CALL, and exited 0 with a success-shaped body. That
// clean exit was read as evidence the model path worked. It was broken - the
// gateway served no usable vision alias - and a broken interpretation reached a
// live household shop. The old output DID say "no model call was made"; a label
// inside a success-shaped body behind exit 0 was not enough, which is why the
// SHAPE and the EXIT CODE are what changed.
//
// ── WHY THIS SUITE LIVES IN pipeline-runtime/ AND NOT IN interpret/ ─────────
// WO-ZA's file surface is `pipeline-runtime/**` plus the single file
// `interpret/interpret-list.js`. The rest of `interpret/` - including its test
// directory - belongs to another agent working in parallel, so a test file
// could not be written there. The subject is in this Work Order's surface; only
// its neighbours are not. Reported in the handback rather than worked around
// silently.
//
// Nothing here connects to a database, a gateway or a live runtime. The pure
// guards are exercised directly; the CLI is exercised only on the paths that
// refuse BEFORE any connection is opened.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(HERE, '..', 'interpret', 'interpret-list.js');
const SRC = fs.readFileSync(ENTRY, 'utf8');

// CJS module, required from an ESM test - the same boundary the pipeline crosses.
const { checkGrounding, unknownIdClaims, resolve } = createRequire(import.meta.url)(ENTRY);

const CATALOGUE = {
  household_id: 1,
  candidates: [
    { id: 14, name: 'Batchelors Super Noodles' },
    { id: 22, name: 'Arla Skimmed Milk 4pt' },
  ],
  rules: [],
  last_order: null,
  regularsById: new Map([[14, { id: 14, name: 'Batchelors Super Noodles', asda_product_id: 'A1' }],
    [22, { id: 22, name: 'Arla Skimmed Milk 4pt', asda_product_id: 'A2' }]]),
};
const GOOD_PROMPT = 'CANDIDATES\n  14: Batchelors Super Noodles\n  22: Arla Skimmed Milk 4pt\n';

// =====================================================================
// 1. THE RETIRED FLAG - proven by running it, not by reading it
// =====================================================================

test('THE DEFECT: --dry-run no longer exits 0 with a success body - it refuses, loudly, non-zero', () => {
  const r = spawnSync(process.execPath, [ENTRY, '--dry-run', '--image', 'x.png'], { encoding: 'utf8', windowsHide: true });
  assert.notEqual(r.status, 0, 'a clean exit here is the exact defect: it was read as proof the model path worked');
  assert.equal(r.status, 4, 'exit 4 is the reserved "this evidences nothing" code');
  assert.equal(r.stdout.trim(), '', 'nothing may reach stdout - a caller piping stdout to a parser must get no result document');
  assert.match(r.stderr, /REFUSED/, 'the refusal must be loud');
  assert.match(r.stderr, /D-2026-08-03-04/, 'it must name the defect it exists to prevent');
});

test('no code path prints a success document without a model call', () => {
  // Every stdout write in the file must be the one guarded success document.
  const stdoutWrites = SRC.split('\n').filter((l) => l.includes('console.log('));
  assert.equal(stdoutWrites.length, 1, `expected exactly one stdout writer; found ${stdoutWrites.length}`);
  const successAt = SRC.indexOf('console.log(JSON.stringify({');
  assert.ok(successAt > 0, 'the success document must exist');
  const body = SRC.slice(successAt, successAt + 400);
  assert.ok(body.includes('model_call_made: true'), 'the success document must assert the call was made');

  // ...and the flag it asserts is only ever set after vision() has returned.
  const visionAt = SRC.indexOf('await vision(');
  const flagAt = SRC.indexOf('modelCallMade = true');
  assert.ok(visionAt > 0 && flagAt > visionAt,
    'modelCallMade must be set AFTER the awaited call returns, so a throw leaves it false');
});

test('the word dry-run survives ONLY as a refusal, never as a behaviour', () => {
  const refusalAt = SRC.indexOf("arg('dry-run')");
  assert.ok(refusalAt > 0, 'the retired flag must still be recognised so an old script is stopped, not silently changed');
  assert.ok(!/if\s*\(\s*dryRun\s*\)/.test(SRC), 'no dryRun branch may remain');
  assert.ok(!SRC.includes("note: 'no model call was made'"), 'the old success-shaped body must be gone');
});

// =====================================================================
// 2. FAIL CLOSED ON EVERY PRECONDITION - each proven to REFUSE
// =====================================================================

test('a good catalogue that really reached the prompt is accepted (the detector discriminates)', () => {
  const g = checkGrounding(CATALOGUE, GOOD_PROMPT);
  assert.equal(g.ok, true);
  assert.equal(g.candidates, 2);
});

test('REFUSES: no catalogue at all', () => {
  assert.equal(checkGrounding(null, GOOD_PROMPT).ok, false);
  assert.equal(checkGrounding(undefined, GOOD_PROMPT).ok, false);
  assert.equal(checkGrounding({}, GOOD_PROMPT).ok, false);
});

test('REFUSES: an EMPTY catalogue - grounding on nothing is open-ended OCR in a costume', () => {
  const g = checkGrounding({ ...CATALOGUE, candidates: [] }, 'CANDIDATES\n');
  assert.equal(g.ok, false);
  assert.match(g.reason, /EMPTY/);
});

test('REFUSES: the catalogue was loaded but never actually supplied to the model', () => {
  // The failure that "assert loadCatalogue() was called" cannot see: it WAS
  // called, and the result still never reached the prompt.
  const g = checkGrounding(CATALOGUE, 'CANDIDATES\n  (none)\n');
  assert.equal(g.ok, false);
  assert.match(g.reason, /NOT supplied to the model/);
  assert.match(g.reason, /2 of 2/, 'it must say how much of the catalogue is missing');
});

test('REFUSES: a partially rendered catalogue is still a refusal, not a warning', () => {
  const partial = 'CANDIDATES\n  14: Batchelors Super Noodles\n';
  const g = checkGrounding(CATALOGUE, partial);
  assert.equal(g.ok, false, 'one of two candidates reaching the model is not grounded');
  assert.match(g.reason, /1 of 2/);
});

test('REFUSES: no prompt', () => {
  assert.equal(checkGrounding(CATALOGUE, '').ok, false);
  assert.equal(checkGrounding(CATALOGUE, null).ok, false);
});

// =====================================================================
// 3. AN INVENTED PRODUCT ID FAILS THE RUN
// =====================================================================

test('a model claiming an id this household does not have is caught', () => {
  const claims = unknownIdClaims([
    { line_no: 1, matched_regular_id: 14 },
    { line_no: 2, matched_regular_id: 999 },
    { line_no: 3, matched_regular_id: '888: Invented Thing' },
  ], CATALOGUE);
  assert.deepEqual(claims.map((c) => c.claimed_id).sort((a, b) => a - b), [888, 999]);
});

test('a genuinely new item (null id) is NOT an invented id - the guard discriminates', () => {
  const claims = unknownIdClaims([
    { line_no: 1, matched_regular_id: null },
    { line_no: 2, matched_regular_id: undefined },
    { line_no: 3, matched_regular_id: '' },
    { line_no: 4, matched_regular_id: 22 },
  ], CATALOGUE);
  assert.equal(claims.length, 0, 'an unmatched new item is a normal outcome, not a fabrication');
});

test('the refusal is wired: an invented id aborts before any result is printed', () => {
  const guardAt = SRC.indexOf('unknownIdClaims(parsed.lines');
  const printAt = SRC.indexOf('console.log(JSON.stringify({');
  assert.ok(guardAt > 0 && guardAt < printAt, 'the invented-id guard must run before the success document');
});

// =====================================================================
// 4. THE INVARIANTS interpret/'s OWN SUITE PINS - mirrored, because that suite
//    is another agent's surface and this change must not break it blind.
// =====================================================================

test('the catalogue is still loaded BEFORE the model is asked anything', () => {
  const loadAt = SRC.indexOf('loadCatalogue(client');
  const visionAt = SRC.indexOf('await vision(');
  assert.ok(loadAt > 0 && visionAt > 0 && loadAt < visionAt);
});

test('the grounded prompt is still what is sent, and open-ended transcription is still not a fallback', () => {
  assert.ok(SRC.includes('buildGroundedPrompt'));
  assert.ok(!/transcribeList/.test(SRC));
});

test("this file still require()s pg, which the launcher's PG_CONSUMERS probe depends on", () => {
  assert.ok(SRC.includes("require('pg')"), 'PG_CONSUMERS names this file as a pg caller');
});

test('resolve() is still exported and still refuses to name a product from an unknown id', () => {
  const out = resolve([{ line_no: 1, matched_regular_id: 999, status: 'matched', raw_reading: 'mystery' }], CATALOGUE);
  assert.equal(out[0].matched_product_name, null);
  assert.equal(out[0].status, 'needs_confirmation', 'a claimed match to an id we do not hold is not a match');
});
