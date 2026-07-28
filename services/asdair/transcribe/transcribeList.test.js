// =====================================================================
// BUILD-015 AsdAIr Stage 1 - transcribe/transcribeList.test.js
//
// FULLY OFFLINE. Every model call goes to an injected fake; no network,
// no database, no credential file is ever read.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

import normaliserModule from '../skill/listNormaliser.js';
import {
  transcribeList,
  validateImageRef,
  buildTranscript,
  normaliseLine,
  coerceQty,
  certainLinesText,
  generateVisionJSON,
  redactSecrets,
  isPlausibleTranscript,
  MAX_IMAGE_BYTES,
} from './transcribeList.js';

const { normaliseRawList } = normaliserModule;

// ---------------------------------------------------------------------
// Offline harness: a fake image on disk and a fake model.
// ---------------------------------------------------------------------
const FAKE_IMAGE = 'C:/fake/list.jpg';

function fakeStat(size = 1024) {
  return () => ({ isFile: () => true, size });
}
function fakeRead() {
  return () => Buffer.from([0x89, 0x50, 0x4e, 0x47]);
}

// Returns a vision fake plus the log of what it was asked.
function fakeVision(responses, provenance = { provider: 'fake-provider', model: 'fake.vision' }) {
  const calls = [];
  const queue = Array.isArray(responses) ? responses.slice() : [responses];
  const fn = async (prompt, imageUrl) => {
    calls.push({ prompt, imageUrl });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return { text: next, provenance };
  };
  fn.calls = calls;
  return fn;
}

function run(responses, opts = {}) {
  const vf = opts.visionFn || fakeVision(responses);
  return transcribeList(FAKE_IMAGE, {
    visionFn: vf,
    statImpl: fakeStat(opts.size),
    readImpl: fakeRead(),
    ...opts.extra,
  }).then((t) => ({ transcript: t, visionFn: vf }));
}

const CLEAN_RESPONSE = JSON.stringify({
  raw_transcript: '2 milk\nbread\nyazoo strawberry 4',
  lines: [
    { raw: '2 milk', item_name: 'milk', requested_qty: 2, uncertain: false, uncertainty_reason: null },
    { raw: 'bread', item_name: 'bread', requested_qty: null, uncertain: false, uncertainty_reason: null },
    { raw: 'yazoo strawberry 4', item_name: 'yazoo strawberry', requested_qty: 4, uncertain: false, uncertainty_reason: null },
  ],
});

// ---------------------------------------------------------------------
// 1. Clean transcription
// ---------------------------------------------------------------------
test('clean list transcribes to structured lines with no review needed', async () => {
  const { transcript, visionFn } = await run(CLEAN_RESPONSE);

  assert.equal(visionFn.calls.length, 1, 'one shot: exactly one model call');
  assert.equal(transcript.needs_review, false);
  assert.equal(transcript.lines.length, 3);
  assert.deepEqual(transcript.lines[0], {
    raw: '2 milk', item_name: 'milk', requested_qty: 2, uncertain: false, uncertainty_reason: null,
  });
  // A line with no quantity written is NOT uncertain - the normaliser defaults it.
  assert.deepEqual(transcript.lines[1], {
    raw: 'bread', item_name: 'bread', requested_qty: null, uncertain: false, uncertainty_reason: null,
  });
  assert.equal(transcript.raw_transcript, '2 milk\nbread\nyazoo strawberry 4');
});

test('the image is sent as a data URL, once, with the transcription prompt', async () => {
  const { visionFn } = await run(CLEAN_RESPONSE);
  assert.match(visionFn.calls[0].imageUrl, /^data:image\/jpeg;base64,/);
  assert.match(visionFn.calls[0].prompt, /NEVER guess a quantity/);
});

// ---------------------------------------------------------------------
// 2. The central rule: an unreadable quantity is never a fact
// ---------------------------------------------------------------------
test('unreadable quantity becomes null + uncertain and forces needs_review', async () => {
  const { transcript } = await run(JSON.stringify({
    raw_transcript: 'milk ?\nbread',
    lines: [
      { raw: 'milk ?', item_name: 'milk', requested_qty: null, uncertain: true, uncertainty_reason: 'digit smudged, could be 2 or 3' },
      { raw: 'bread', item_name: 'bread', requested_qty: 1, uncertain: false, uncertainty_reason: null },
    ],
  }));

  assert.equal(transcript.needs_review, true);
  assert.equal(transcript.lines[0].requested_qty, null);
  assert.equal(transcript.lines[0].uncertain, true);
  assert.equal(transcript.lines[0].uncertainty_reason, 'digit smudged, could be 2 or 3');
  assert.equal(transcript.lines[1].uncertain, false);
});

test('a model that flags uncertain but still asserts a quantity has it discarded', async () => {
  const { transcript } = await run(JSON.stringify({
    lines: [{ raw: 'milk 2?', item_name: 'milk', requested_qty: 2, uncertain: true, uncertainty_reason: 'unsure' }],
  }));
  assert.equal(transcript.lines[0].requested_qty, null, 'an uncertain quantity is never kept as a fact');
  assert.equal(transcript.needs_review, true);
});

test('a model that flags uncertain without a reason still gets one', async () => {
  const { transcript } = await run(JSON.stringify({
    lines: [{ raw: 'milk', item_name: 'milk', requested_qty: null, uncertain: true }],
  }));
  assert.equal(transcript.lines[0].uncertainty_reason, 'model flagged this line as uncertain');
});

test('coerceQty refuses every non-fact quantity form', () => {
  assert.deepEqual(coerceQty(3), { qty: 3, reason: null });
  assert.deepEqual(coerceQty('3'), { qty: 3, reason: null });
  assert.equal(coerceQty(null).qty, null);
  assert.equal(coerceQty(null).reason, null, 'absent is not uncertain, just absent');
  for (const bad of ['two', '?', '1.5', 1.5, 0, -2, 1e21, true, {}, '2 or 3']) {
    const r = coerceQty(bad);
    assert.equal(r.qty, null, 'refuses ' + JSON.stringify(bad));
    assert.ok(r.reason && r.reason.length > 0, 'gives a reason for ' + JSON.stringify(bad));
  }
});

test('a garbled quantity the model did NOT flag is still caught and surfaced', async () => {
  const { transcript } = await run(JSON.stringify({
    lines: [{ raw: 'milk 2 or 3', item_name: 'milk', requested_qty: '2 or 3', uncertain: false, uncertainty_reason: null }],
  }));
  assert.equal(transcript.lines[0].requested_qty, null);
  assert.equal(transcript.lines[0].uncertain, true);
  assert.match(transcript.lines[0].uncertainty_reason, /unreadable quantity/);
  assert.equal(transcript.needs_review, true);
});

test('a line with no item text is surfaced, never dropped', async () => {
  const { transcript } = await run(JSON.stringify({
    lines: [
      { raw: '???', item_name: '', requested_qty: null, uncertain: false, uncertainty_reason: null },
      { raw: 'bread', item_name: 'bread', requested_qty: null, uncertain: false, uncertainty_reason: null },
    ],
  }));
  assert.equal(transcript.lines.length, 2, 'nothing is dropped');
  assert.equal(transcript.lines[0].uncertain, true);
  assert.match(transcript.lines[0].uncertainty_reason, /no item text/);
});

// ---------------------------------------------------------------------
// 3. Malformed model JSON -> retry path, not a crash
// ---------------------------------------------------------------------
test('malformed JSON on the first attempt is retried, not crashed on', async () => {
  const vf = fakeVision(['Sure! here is your list: {oops not json', CLEAN_RESPONSE]);
  const { transcript, visionFn } = await run(null, { visionFn: vf });
  assert.equal(visionFn.calls.length, 2, 'retried once');
  assert.match(visionFn.calls[1].prompt, /Return ONLY valid JSON/, 'the retry tightens the instruction');
  assert.equal(transcript.lines.length, 3);
});

test('fenced JSON is recovered by the shared extractJson parser', async () => {
  const { transcript, visionFn } = await run('```json\n' + CLEAN_RESPONSE + '\n```');
  assert.equal(visionFn.calls.length, 1, 'no retry needed - fences are stripped');
  assert.equal(transcript.lines.length, 3);
});

test('structurally wrong JSON (no lines array) is retried like a parse failure', async () => {
  const vf = fakeVision(['{"items":["milk"]}', CLEAN_RESPONSE]);
  const { transcript, visionFn } = await run(null, { visionFn: vf });
  assert.equal(visionFn.calls.length, 2);
  assert.equal(transcript.lines.length, 3);
  assert.equal(isPlausibleTranscript({ items: [] }), false);
  assert.equal(isPlausibleTranscript({ lines: [] }), true);
});

test('exhausted retries throw a clear error rather than inventing a list', async () => {
  const vf = fakeVision(['not json at all']);
  await assert.rejects(
    () => run(null, { visionFn: vf }),
    /did not return a usable transcript after 3 attempts/
  );
  assert.equal(vf.calls.length, 3, 'default retries = 2, so 3 attempts');
});

// ---------------------------------------------------------------------
// 4. Provenance
// ---------------------------------------------------------------------
test('provenance records the provider and model that produced the transcript', async () => {
  const { transcript } = await run(CLEAN_RESPONSE);
  assert.deepEqual(transcript.provenance, { provider: 'fake-provider', model: 'fake.vision' });
});

test('missing provenance is recorded as unknown, never fabricated', () => {
  const t = buildTranscript({ lines: [] }, null);
  assert.deepEqual(t.provenance, { provider: 'unknown', model: 'unknown' });
});

// ---------------------------------------------------------------------
// 5. Credentials never appear in the output or in logs
// ---------------------------------------------------------------------
test('no credential value can reach the transcript or the logs', async () => {
  const SENTINELS = [
    'sk-SENTINELCREDVALUE0123456789',
    'SENTINELGATEWAYPASSWORD',
    'SENTINELLIGHTRAGKEY',
  ];
  const saved = {
    FUSION_GATEWAY_KEY: process.env.FUSION_GATEWAY_KEY,
    FUSION_GATEWAY_URL: process.env.FUSION_GATEWAY_URL,
    LIGHTRAG_API_KEY: process.env.LIGHTRAG_API_KEY,
    ASDAIR_DB_URL: process.env.ASDAIR_DB_URL,
  };
  process.env.FUSION_GATEWAY_KEY = SENTINELS[0];
  process.env.FUSION_GATEWAY_URL = 'http://user:' + SENTINELS[1] + '@127.0.0.1:1/v1';
  process.env.LIGHTRAG_API_KEY = SENTINELS[2];
  process.env.ASDAIR_DB_URL = 'postgres://ro:' + SENTINELS[1] + '@127.0.0.1:1/asdair';

  const logs = [];
  const realLog = console.log;
  const realErr = console.error;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  try {
    const { transcript } = await run(CLEAN_RESPONSE);
    const serialised = JSON.stringify(transcript);
    for (const s of SENTINELS) {
      assert.ok(!serialised.includes(s), 'transcript leaks ' + s);
      assert.ok(!logs.join('\n').includes(s), 'logs leak ' + s);
    }
    // and the transcript carries no env-shaped material at all
    assert.ok(!/Bearer|sk-|:\/\/[^"]*:[^"]*@/.test(serialised));
  } finally {
    console.log = realLog;
    console.error = realErr;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('redactSecrets scrubs credential shapes echoed back from upstream', () => {
  assert.equal(redactSecrets('failed: Authorization: Bearer sk-abc123def456'), 'failed: Authorization: [REDACTED]');
  assert.equal(redactSecrets('key sk-abc123def456xyz here'), 'key [REDACTED] here');
  assert.equal(redactSecrets('postgres://ro:hunter2pass@host/db'), 'postgres://[REDACTED]@host/db');
  assert.equal(redactSecrets('{"api_key": "abcd1234"}'), '{"[REDACTED]}');
  assert.equal(redactSecrets('nothing secret here'), 'nothing secret here');
});

test('an upstream error body containing a credential is redacted before it surfaces', async () => {
  const leaky = async () => { throw new Error('fusion-gateway vision -> 401: {"sent":"Bearer sk-LEAKEDKEY123456"}'); };
  await assert.rejects(
    () => transcribeList(FAKE_IMAGE, { visionFn: leaky, statImpl: fakeStat(), readImpl: fakeRead() }),
    (err) => {
      // The throw propagates; the CLI redacts on the way out. Prove the redactor handles it.
      assert.ok(!redactSecrets(err.message).includes('sk-LEAKEDKEY123456'));
      return true;
    }
  );
});

// ---------------------------------------------------------------------
// 6. Input validation (what --dry-run checks)
// ---------------------------------------------------------------------
test('validateImageRef refuses bad input without touching the model', () => {
  assert.throws(() => validateImageRef(''), /--image <path> is required/);
  assert.throws(() => validateImageRef('list.txt', { statImpl: fakeStat() }), /unsupported image type/);
  assert.throws(() => validateImageRef('list.jpg', { statImpl: () => { throw new Error('ENOENT'); } }), /image not found/);
  assert.throws(() => validateImageRef('list.jpg', { statImpl: () => ({ isFile: () => true, size: 0 }) }), /image is empty/);
  assert.throws(
    () => validateImageRef('list.jpg', { statImpl: () => ({ isFile: () => true, size: MAX_IMAGE_BYTES + 1 }) }),
    /over the .* byte limit/
  );
  const ok = validateImageRef('list.PNG', { statImpl: fakeStat(10) });
  assert.equal(ok.mime, 'image/png');
  assert.equal(ok.bytes, 10);
});

// ---------------------------------------------------------------------
// 7. The handoff: the deterministic normaliser consumes this unmodified
// ---------------------------------------------------------------------
test('certain lines feed listNormaliser.js unmodified', async () => {
  const { transcript } = await run(CLEAN_RESPONSE);

  // THE PROOF - one line, no adaptation, the normaliser as it already ships:
  const normalised = normaliseRawList(certainLinesText(transcript));

  assert.deepEqual(normalised.items, [
    { item_name: 'milk', requested_qty: 2, note: '' },
    { item_name: 'bread', requested_qty: 1, note: '' },
    { item_name: 'yazoo strawberry', requested_qty: 4, note: '' },
  ]);
  assert.deepEqual(normalised.needs_review, []);
});

test('uncertain lines are held back from the normaliser for the human loop', async () => {
  const { transcript } = await run(JSON.stringify({
    lines: [
      { raw: 'milk ?', item_name: 'milk', requested_qty: null, uncertain: true, uncertainty_reason: 'digit smudged' },
      { raw: 'bread', item_name: 'bread', requested_qty: null, uncertain: false, uncertainty_reason: null },
    ],
  }));
  assert.equal(certainLinesText(transcript), 'bread');
  const normalised = normaliseRawList(certainLinesText(transcript));
  assert.deepEqual(normalised.items, [{ item_name: 'bread', requested_qty: 1, note: '' }]);
  // the smudged line is not silently defaulted to qty 1 anywhere
  assert.equal(transcript.needs_review, true);
});

test('the raw transcript alone also parses, for audit', async () => {
  const { transcript } = await run(CLEAN_RESPONSE);
  const audit = normaliseRawList(transcript.raw_transcript);
  assert.equal(audit.items.length, 3);
});

// ---------------------------------------------------------------------
// 8. Unit-level guards
// ---------------------------------------------------------------------
test('normaliseLine tolerates junk without throwing', () => {
  for (const junk of [null, undefined, 42, 'nope', {}, []]) {
    const l = normaliseLine(junk);
    assert.equal(l.requested_qty, null);
    assert.equal(l.uncertain, true);
    assert.ok(l.uncertainty_reason);
  }
});

test('generateVisionJSON accepts a bare string response and reports no provenance', async () => {
  const { parsed, provenance } = await generateVisionJSON(async () => CLEAN_RESPONSE, 'p', 'data:image/png;base64,AA');
  assert.equal(parsed.lines.length, 3);
  assert.equal(provenance, null);
});
