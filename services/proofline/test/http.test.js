// The HTTP contract (map §5.5), idempotency (T-1), the approval gate (T-5, G-6)
// and the background-processing claim (G-3, as restated by C-4).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { sha256Utf8 } from '../src/canonical.mjs';
import {
  mkTempDir, rmTempDir, journalPathIn, startApp, httpJson, httpRaw, waitFor, readJournal, countRecords, sleep,
} from './helpers/harness.mjs';

let dir;
let ctx;

before(async () => {
  dir = mkTempDir('proofline-http');
  ctx = await startApp({ dataDir: dir });
});

after(async () => {
  if (ctx) await ctx.app.close();
  rmTempDir(dir);
});

const u = (p) => `${ctx.url}${p}`;

test('GET / serves the UI shell from the allowlist', async () => {
  const res = await fetch(u('/'));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const body = await res.text();
  assert.match(body, /<title>Proofline<\/title>/);
  assert.match(body, /id="submit-form"/);
});

test('static serving is an ALLOWLIST — no path is joined to user input', async () => {
  for (const p of ['/app.js', '/styles.css', '/index.html']) {
    assert.equal((await fetch(u(p))).status, 200, p);
  }
  for (const p of ['/../package.json', '/..%2fpackage.json', '/src/store.mjs', '/.data/journal.jsonl', '/nope.js']) {
    const res = await fetch(u(p));
    assert.equal(res.status, 404, `${p} must not be served`);
  }
});

test('GET /api/health reports the epoch, uptime and per-state counts', async () => {
  const { status, json } = await httpJson(u('/api/health'));
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.epoch, ctx.store.epoch);
  assert.equal(typeof json.uptimeMs, 'number');
  assert.deepEqual(Object.keys(json.counts).sort(), ['approved', 'awaiting_approval', 'failed', 'processing', 'queued', 'rejected', 'total']);
});

test('G-3 (client half) — the submit response is queued/result:null, and the journal orders created before started', async () => {
  const key = 'g3-background';
  const { status, json } = await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'background please' } });

  // What the CLIENT can honestly observe: the response describes a job that
  // has not been processed. `attempts: 0` means no lease had been taken when
  // this response body was built.
  assert.equal(status, 201);
  assert.equal(json.job.state, 'queued');
  assert.equal(json.job.result, null);
  assert.equal(json.job.resultSha256, null);
  assert.equal(json.job.attempts, 0);
  assert.equal(json.job.startedAt, null);

  // What the client CANNOT observe, and this test deliberately does not claim:
  // that no `job.started` exists on disk by the time it reads the file. C-4
  // measured a ~2.5 ms processing window, so by the time the HTTP round trip
  // has returned to the parent the worker has usually finished. Asserting
  // otherwise here would only pass by inserting an artificial delay — which is
  // exactly the fabrication C-4 forbade. The ORDERING claim is proven from
  // inside the process instead, in ordering.test.js.

  await waitFor(async () => (await httpJson(u(`/api/jobs/${key}`))).json.job.state === 'awaiting_approval', {
    what: 'the background worker to finish',
  });

  const after = readJournal(dir);
  const createdAt = after.findIndex((r) => r.t === 'job.created' && r.key === key);
  const startedAt = after.findIndex((r) => r.t === 'job.started' && r.key === key);
  assert.ok(createdAt >= 0, 'job.created is on disk');
  assert.ok(startedAt > createdAt, 'job.created precedes job.started in the durable record');
  assert.equal(countRecords(after, 'job.started', key), 1, 'leased exactly once');
});

test('G-5 — the detail endpoint exposes the durable state timeline read back from the journal', async () => {
  const key = 'g5-timeline';
  await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'timeline' } });
  await waitFor(async () => (await httpJson(u(`/api/jobs/${key}`))).json.job.state === 'awaiting_approval', { what: 'completion' });

  const { json } = await httpJson(u(`/api/jobs/${key}`));
  const kinds = json.job.timeline.map((e) => e.t);
  assert.deepEqual(kinds, ['job.created', 'job.started', 'job.completed']);
  for (const entry of json.job.timeline) assert.equal(typeof entry.at, 'string');

  // The timeline is a reading of the journal, not a story told over it.
  const fromDisk = readJournal(dir).filter((r) => r.key === key).map((r) => r.t);
  assert.deepEqual(kinds, fromDisk);
});

test('T-1 — the same key twice creates ONE job, returns 200 duplicate:true, and writes exactly one job.created', async () => {
  const key = 't1-idempotent';
  const text = 'submitted once';

  const first = await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text } });
  assert.equal(first.status, 201);

  const second = await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text } });
  assert.equal(second.status, 200);
  assert.equal(second.json.duplicate, true);
  assert.equal(second.json.textMatches, true);
  assert.equal(second.json.job.key, key);

  const third = await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text } });
  assert.equal(third.status, 200);

  // Counted in the journal BYTES, not in an in-memory view of them.
  const raw = fs.readFileSync(journalPathIn(dir), 'utf8');
  const occurrences = raw.split('\n').filter((line) => {
    if (line === '') return false;
    const rec = JSON.parse(line);
    return rec.t === 'job.created' && rec.key === key;
  }).length;
  assert.equal(occurrences, 1, 'exactly one job.created for this key exists on disk');

  const list = await httpJson(u('/api/jobs'));
  assert.equal(list.json.jobs.filter((j) => j.key === key).length, 1);
});

test('T-1 (F-9) — a repeat key with DIFFERENT text keeps the original and says textMatches:false', async () => {
  const key = 't1-textmatches';
  await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'original' } });

  const res = await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'REPLACEMENT' } });
  assert.equal(res.status, 200);
  assert.equal(res.json.duplicate, true);
  assert.equal(res.json.textMatches, false, 'the caller is told its text was not stored — silent loss is the surface F-9 names');
  assert.equal(res.json.job.text, 'original');
  assert.equal(res.json.job.textSha256, sha256Utf8('original'));
});

test('the list endpoint is a summary and never carries the text', async () => {
  const { json } = await httpJson(u('/api/jobs'));
  assert.ok(json.jobs.length > 0);
  for (const summary of json.jobs) {
    assert.equal('text' in summary, false);
    assert.deepEqual(
      Object.keys(summary).sort(),
      ['attempts', 'completedAt', 'decidedAt', 'key', 'resultSha256', 'startedAt', 'state', 'submittedAt', 'textLength', 'textSha256'],
    );
  }
});

test('the detail endpoint carries the text back (F-4)', async () => {
  const key = 'f4-text';
  const text = 'line one\r\nline two\n\nline four';
  await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text } });
  const { json } = await httpJson(u(`/api/jobs/${key}`));
  assert.equal(json.job.text, text, 'byte-for-byte, including the CR');
  assert.equal(json.job.textSha256, sha256Utf8(text));
});

test('an unknown key is 404 on detail, approve and reject', async () => {
  assert.equal((await httpJson(u('/api/jobs/nope'))).status, 404);
  assert.equal((await httpJson(u('/api/jobs/nope/approve'), { method: 'POST', body: {} })).status, 404);
  assert.equal((await httpJson(u('/api/jobs/nope/reject'), { method: 'POST', body: {} })).status, 404);
});

test('invalid keys are 400 and are never used to build a path (map §5.7)', async () => {
  const bad = ['', 'has space', 'has/slash', 'has\\backslash', 'a'.repeat(129), 'emoji😀'];
  for (const key of bad) {
    const { status, json } = await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'x' } });
    assert.equal(status, 400, `key ${JSON.stringify(key)}`);
    assert.match(json.error, /invalid key/);
  }
  // The charset deliberately admits `.`, `..` and `:` — legal keys, and they
  // are safe precisely because no key ever becomes a filename.
  for (const key of ['..', '.', 'a:b', 'a.b-c_d']) {
    const { status } = await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'x' } });
    assert.equal(status, 201, `key ${JSON.stringify(key)} is legal`);
  }
  assert.equal(fs.readdirSync(dir).sort().join(','), 'journal.jsonl', 'no key created a file');
});

test('a non-string text is 400', async () => {
  for (const text of [42, null, undefined, {}, ['a']]) {
    const { status } = await httpJson(u('/api/jobs'), { method: 'POST', body: { key: 'badtext', text } });
    assert.equal(status, 400, `text ${JSON.stringify(text)}`);
  }
});

test('empty text is legal and produces a real result', async () => {
  const key = 'empty-text';
  const res = await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: '' } });
  assert.equal(res.status, 201);
  await waitFor(async () => (await httpJson(u(`/api/jobs/${key}`))).json.job.state === 'awaiting_approval', { what: 'completion' });
  const { json } = await httpJson(u(`/api/jobs/${key}`));
  assert.equal(json.job.result.words, 0);
  assert.equal(json.job.result.avgWordLengthMilli, 0);
  assert.notEqual(json.job.resultSha256, null);
});

test('§5.5 — TWO distinct limits with distinct messages: text > 1 MiB and body > 2 MiB', async () => {
  // Text over 1 MiB, inside a body under 2 MiB.
  const bigText = 'a'.repeat(1048577);
  const textRes = await httpJson(u('/api/jobs'), { method: 'POST', body: { key: 'toobig', text: bigText } });
  assert.equal(textRes.status, 413);
  assert.match(textRes.json.error, /text too large/);

  // A 1 MiB text is ACCEPTED — the v1 self-contradiction was that JSON
  // escaping pushed a legal text over a shared 1 MiB body limit.
  const exact = 'a'.repeat(1048576);
  const okRes = await httpJson(u('/api/jobs'), { method: 'POST', body: { key: 'exactly-1mib', text: exact } });
  assert.equal(okRes.status, 201, 'a text at exactly the limit is accepted');

  // Body over 2 MiB, counted as bytes arrive.
  const hugeBody = `{"key":"hugebody","text":"${'b'.repeat(2097200)}"}`;
  const bodyRes = await httpRaw(u('/api/jobs'), hugeBody);
  assert.equal(bodyRes.status, 413);
  assert.match(bodyRes.json.error, /request body too large/);
});

test('a malformed JSON body is 400, not a crash', async () => {
  const res = await httpRaw(u('/api/jobs'), '{not json');
  assert.equal(res.status, 400);
  assert.match(res.json.error, /not valid JSON/);
});

test('T-5 / G-6 — approving a QUEUED job is 409 and leaves the job unchanged', async () => {
  const paused = mkTempDir('proofline-paused');
  const p = await startApp({ dataDir: paused });
  try {
    // Stop the worker so the job is genuinely, deterministically `queued` —
    // no sleep, no race.
    p.worker.stop();

    const key = 't5-queued';
    const created = await httpJson(`${p.url}/api/jobs`, { method: 'POST', body: { key, text: 'never processed' } });
    assert.equal(created.status, 201);
    assert.equal(created.json.job.state, 'queued');

    const approve = await httpJson(`${p.url}/api/jobs/${key}/approve`, { method: 'POST', body: {} });
    assert.equal(approve.status, 409);
    assert.match(approve.json.detail, /state is queued/);

    const reject = await httpJson(`${p.url}/api/jobs/${key}/reject`, { method: 'POST', body: {} });
    assert.equal(reject.status, 409);

    const after = await httpJson(`${p.url}/api/jobs/${key}`);
    assert.equal(after.json.job.state, 'queued');
    assert.equal(after.json.job.decision, null);
    assert.equal(after.json.job.decidedAt, null);
    assert.equal(countRecords(readJournal(paused), 'job.decided', key), 0, 'no decision record was written');
  } finally {
    await p.app.close();
    rmTempDir(paused);
  }
});

test('G-6 — awaiting_approval NEVER self-advances', async () => {
  const key = 'g6-holds';
  await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'hold here' } });
  await waitFor(async () => (await httpJson(u(`/api/jobs/${key}`))).json.job.state === 'awaiting_approval', { what: 'completion' });

  // The worker scan interval here is 100 ms, so this is ~15 scans.
  await sleep(1500);

  const { json } = await httpJson(u(`/api/jobs/${key}`));
  assert.equal(json.job.state, 'awaiting_approval');
  assert.equal(json.job.decision, null);
  assert.equal(countRecords(readJournal(dir), 'job.started', key), 1, 'it was not silently reprocessed either');
});

test('approve and reject are recorded, and a second decision on a decided job is 409', async () => {
  const key = 'decide-once';
  await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'decide me' } });
  await waitFor(async () => (await httpJson(u(`/api/jobs/${key}`))).json.job.state === 'awaiting_approval', { what: 'completion' });

  const ok = await httpJson(u(`/api/jobs/${key}/approve`), { method: 'POST', body: { note: 'yes please' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.job.state, 'approved');
  assert.equal(ok.json.job.decision, 'approved');
  assert.equal(ok.json.job.note, 'yes please');
  assert.equal(typeof ok.json.job.decidedAt, 'string');

  const again = await httpJson(u(`/api/jobs/${key}/approve`), { method: 'POST', body: {} });
  assert.equal(again.status, 409);
  const flip = await httpJson(u(`/api/jobs/${key}/reject`), { method: 'POST', body: {} });
  assert.equal(flip.status, 409);

  assert.equal(countRecords(readJournal(dir), 'job.decided', key), 1);
});

test('rejection is recorded the same way', async () => {
  const key = 'reject-me';
  await httpJson(u('/api/jobs'), { method: 'POST', body: { key, text: 'no thanks' } });
  await waitFor(async () => (await httpJson(u(`/api/jobs/${key}`))).json.job.state === 'awaiting_approval', { what: 'completion' });
  const res = await httpJson(u(`/api/jobs/${key}/reject`), { method: 'POST', body: { note: 'not this one' } });
  assert.equal(res.status, 200);
  assert.equal(res.json.job.state, 'rejected');
  assert.equal(res.json.job.note, 'not this one');
});

test('an unknown method or route is refused rather than guessed at', async () => {
  assert.equal((await fetch(u('/api/jobs'), { method: 'DELETE' })).status, 405);
  assert.equal((await fetch(u('/api/nope'))).status, 404);
  assert.equal((await fetch(u('/api/nope'), { method: 'POST' })).status, 404);
});
