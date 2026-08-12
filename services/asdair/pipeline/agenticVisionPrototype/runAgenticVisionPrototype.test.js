// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/runAgenticVisionPrototype.test.js
//
// WO-2026-08-12-B15-VISION-PROTOTYPE-01 v2, AC5/AC6: proves the NON-NETWORK
// parts of the runnable script - image-prep reuse, catalogue loading, and
// report formatting. `runAgainstPhoto()`'s own call to the real gateway is
// DELIBERATELY NOT executed here (see the module's own "BUILT, CALLABLE, NOT
// EXECUTED BY KEEL" header) - `network: none` in this Work Order's authority
// block, and critical rule 3 (never touch a live service).
//
// This module itself (loadCatalogue, printReport) has NO static dependency on
// sharp - only prepareForAgenticLoop() does, via a LAZY import (see the
// module's own header). So the module import always succeeds; only the
// sharp-DEPENDENT tests below are individually gated, mirroring
// pipeline/imageRender.test.js's own established convention (a clean skip
// when sharp is not installed, never a false failure) at the TEST level
// rather than the whole-file level, since here only some tests need it.
//
// Runs under: node --test (no DB, no model, no network).
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as mod from './runAgenticVisionPrototype.js';

let sharpAvailable = true;
let sharpImportError = null;
try {
  await import('sharp');
} catch (e) {
  sharpAvailable = false;
  sharpImportError = e;
}

const sharpGate = sharpAvailable
  ? { skip: false }
  : { skip: `sharp is not installed in this environment - prepareForAgenticLoop tests skipped, not failed: ${sharpImportError && sharpImportError.message}` };

/** A REAL, fully decodable JPEG rendered by sharp itself - matches imageRender.test.js's own fixture convention. */
async function realJpeg({ width, height, r = 200, g = 50, b = 50 }) {
  const sharp = (await import('sharp')).default;
  return sharp({ create: { width, height, channels: 3, background: { r, g, b } } }).jpeg().toBuffer();
}

test('module load: loadCatalogue/printReport are importable regardless of sharp availability (lazy image-render import)', () => {
  assert.equal(typeof mod.loadCatalogue, 'function');
  assert.equal(typeof mod.printReport, 'function');
  assert.equal(typeof mod.prepareForAgenticLoop, 'function');
  assert.equal(typeof mod.runAgainstPhoto, 'function');
});

test('prepareForAgenticLoop: returns a fullPageImageUrl plus one entry per strip, keyed by region_no, none of them region_no 1', sharpGate, async () => {
  const buf = await realJpeg({ width: 1200, height: 3000 }); // tall enough for more than one strip
  const { fullPageImageUrl, regionImageUrls, regionNos } = await mod.prepareForAgenticLoop(buf);
  assert.match(fullPageImageUrl, /^data:image\/jpeg;base64,/);
  assert.ok(Object.keys(regionImageUrls).length > 0, 'a tall page must plan at least one strip');
  assert.ok(!('1' in regionImageUrls), 'region_no 1 (full_page) must never ALSO appear in regionImageUrls - it is fullPageImageUrl');
  for (const url of Object.values(regionImageUrls)) {
    assert.match(url, /^data:image\/jpeg;base64,/);
  }
  assert.deepEqual(regionNos[0], 1, 'regionNos always starts with 1 (full_page)');
  assert.equal(regionNos.length, Object.keys(regionImageUrls).length + 1);
});

test('prepareForAgenticLoop: a short page (one strip only) still returns a usable region map', sharpGate, async () => {
  const buf = await realJpeg({ width: 800, height: 600 });
  const { regionImageUrls, regionNos } = await mod.prepareForAgenticLoop(buf);
  assert.ok(Object.keys(regionImageUrls).length >= 1);
  assert.ok(regionNos.length >= 2, 'at least full_page plus one strip');
});

test('loadCatalogue: no path given returns an empty catalogue', () => {
  assert.deepEqual(mod.loadCatalogue(undefined), []);
});

test('loadCatalogue: reads and parses a real JSON file from disk', () => {
  const tmpFile = path.join(os.tmpdir(), `agentic-catalogue-test-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify([{ name: 'Weetabix', aliases: ['wheat biscuits'] }]));
  try {
    const items = mod.loadCatalogue(tmpFile);
    assert.deepEqual(items, [{ name: 'Weetabix', aliases: ['wheat biscuits'] }]);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('loadCatalogue: refuses a JSON file that is not an array', () => {
  const tmpFile = path.join(os.tmpdir(), `agentic-catalogue-bad-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({ not: 'an array' }));
  try {
    assert.throws(() => mod.loadCatalogue(tmpFile), /must be a JSON array/);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('printReport: writes tool-call rounds, per-turn cost and every final line to stdout, without throwing', () => {
  const chunks = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => { chunks.push(chunk); return true; };
  try {
    mod.printReport({
      turns: [
        {
          turnNo: 1, responseId: 'r1', requestedRegion: 3, costUsd: 0.0123,
        },
        {
          turnNo: 2, responseId: 'r2', requestedRegion: null, costUsd: null,
        },
      ],
      toolCallRounds: 1,
      hitIterationCap: false,
      lines: [{
        line_no: 1, raw_reading: 'Weetabix', quantity: 2, source_region: 3,
      }],
      elapsedMs: 500,
      totalCostUsd: 0.0123,
    });
  } finally {
    process.stdout.write = original;
  }
  const out = chunks.join('');
  assert.match(out, /tool-call rounds: 1/);
  assert.match(out, /\$0\.0123/);
  assert.match(out, /Weetabix/);
  assert.match(out, /source_region=3/);
});

test('printReport: an unparseable final answer is reported honestly, never fabricated as an empty result', () => {
  const chunks = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => { chunks.push(chunk); return true; };
  try {
    mod.printReport({
      turns: [], toolCallRounds: 0, hitIterationCap: false, lines: null, elapsedMs: 10, totalCostUsd: null,
    });
  } finally {
    process.stdout.write = original;
  }
  assert.match(chunks.join(''), /could not be parsed/);
});
