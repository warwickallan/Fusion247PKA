// T-2 — G-4 in full: the same text gives a byte-identical result digest across
// KEYS, across RESTARTS, and across PROCESSES.
//
// The fourth axis, "across MACHINES", is deliberately NOT claimed here. It is
// structurally engineered for (§5.2 bans localeCompare, toLocaleLowerCase,
// floats, timestamps and UTF-16 length) and every one of those bans is asserted
// in processor.test.js — but only one machine is available, so the property
// itself is unproven. Saying otherwise would be inventing evidence.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

import { analyze } from '../src/processor.mjs';
import { canonicalJson, sha256Hex } from '../src/canonical.mjs';
import {
  mkTempDir, rmTempDir, spawnChild, httpJson, waitFor, killAllChildren, SERVICE_DIR,
} from './helpers/harness.mjs';

after(() => killAllChildren());

const SAMPLE = 'Proofline — deterministic?\r\nSecond line, with "quotes", 42 numbers and é/é.\n\nA final paragraph.';

function localDigest(text) {
  return sha256Hex(canonicalJson(analyze(text)));
}

test('T-2 — the same text under DIFFERENT KEYS yields an identical resultSha256', async () => {
  const dir = mkTempDir('proofline-t2-keys');
  const child = await spawnChild({ dataDir: dir, mode: 'normal' });
  try {
    const keys = ['alpha', 'beta', 'gamma..delta', 'a:b'];
    const digests = [];
    for (const key of keys) {
      const res = await httpJson(`${child.url}/api/jobs`, { method: 'POST', body: { key, text: SAMPLE } });
      assert.equal(res.status, 201);
      const job = await waitFor(
        async () => {
          const { json } = await httpJson(`${child.url}/api/jobs/${key}`);
          return json.job.state === 'awaiting_approval' ? json.job : null;
        },
        { timeoutMs: 8000, what: `${key} to complete` },
      );
      digests.push(job.resultSha256);
    }
    assert.equal(new Set(digests).size, 1, `four keys, four digests: ${JSON.stringify(digests)}`);
    assert.equal(digests[0], localDigest(SAMPLE), 'and it matches an independent local computation');

    // A different text must give a different digest, or the assertion above
    // would be satisfied by a constant.
    const other = await httpJson(`${child.url}/api/jobs`, { method: 'POST', body: { key: 'different', text: `${SAMPLE} ` } });
    assert.equal(other.status, 201);
    const otherJob = await waitFor(
      async () => {
        const { json } = await httpJson(`${child.url}/api/jobs/different`);
        return json.job.state === 'awaiting_approval' ? json.job : null;
      },
      { timeoutMs: 8000, what: 'the differing text to complete' },
    );
    assert.notEqual(otherJob.resultSha256, digests[0]);
  } finally {
    await child.kill();
    rmTempDir(dir);
  }
});

test('T-2 — the digest is unchanged ACROSS A RESTART, and reprocessing after a crash reproduces it', async () => {
  const dir = mkTempDir('proofline-t2-restart');
  const key = 't2-restart';
  try {
    // Process 1: submit and complete.
    const first = await spawnChild({ dataDir: dir, mode: 'normal' });
    await httpJson(`${first.url}/api/jobs`, { method: 'POST', body: { key, text: SAMPLE } });
    const before = await waitFor(
      async () => {
        const { json } = await httpJson(`${first.url}/api/jobs/${key}`);
        return json.job.state === 'awaiting_approval' ? json.job : null;
      },
      { timeoutMs: 8000, what: 'first completion' },
    );
    await first.kill();

    // Process 2: same journal, read the stored result back.
    const second = await spawnChild({ dataDir: dir, mode: 'normal' });
    const { json } = await httpJson(`${second.url}/api/jobs/${key}`);
    assert.equal(json.job.resultSha256, before.resultSha256, 'the stored digest survived the restart');
    await second.kill();

    // Process 3: a job killed MID-FLIGHT is reprocessed from scratch after the
    // restart, and reproduces the same digest byte for byte.
    const dir2 = mkTempDir('proofline-t2-reproc');
    const hung = await spawnChild({ dataDir: dir2, mode: 'hang' });
    await httpJson(`${hung.url}/api/jobs`, { method: 'POST', body: { key, text: SAMPLE } });
    await waitFor(async () => (await httpJson(`${hung.url}/api/jobs/${key}`)).json.job.state === 'processing', {
      timeoutMs: 8000,
      what: 'the lease',
    });
    await hung.kill();

    const recovered = await spawnChild({ dataDir: dir2, mode: 'normal' });
    const after = await waitFor(
      async () => {
        const { json: j } = await httpJson(`${recovered.url}/api/jobs/${key}`);
        return j.job.state === 'awaiting_approval' ? j.job : null;
      },
      { timeoutMs: 8000, what: 'reprocessing after recovery' },
    );
    assert.equal(after.attempts, 2, 'it really was reprocessed, not read from a cache');
    assert.equal(after.resultSha256, before.resultSha256, 'recomputed after a crash — byte-identical');
    await recovered.kill();
    rmTempDir(dir2);
  } finally {
    rmTempDir(dir);
  }
});

test('T-2 — the digest is identical ACROSS PROCESSES computing it independently', () => {
  const processorUrl = pathToFileURL(path.join(SERVICE_DIR, 'src', 'processor.mjs')).href;
  const canonicalUrl = pathToFileURL(path.join(SERVICE_DIR, 'src', 'canonical.mjs')).href;

  const script = `
    const { analyze } = await import(${JSON.stringify(processorUrl)});
    const { canonicalJson, sha256Hex } = await import(${JSON.stringify(canonicalUrl)});
    const text = JSON.parse(process.env.PROOFLINE_SAMPLE);
    process.stdout.write(sha256Hex(canonicalJson(analyze(text))));
  `;

  const digests = new Set();
  for (let i = 0; i < 3; i++) {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, PROOFLINE_SAMPLE: JSON.stringify(SAMPLE) },
      encoding: 'utf8',
    });
    assert.match(out, /^[0-9a-f]{64}$/);
    digests.add(out);
  }

  assert.equal(digests.size, 1, 'three separate Node processes agreed');
  assert.equal([...digests][0], localDigest(SAMPLE), 'and they agree with this process');
});

test('T-2 — canonical JSON key order is what makes the digest stable, not object insertion order', () => {
  const r = analyze(SAMPLE);
  const shuffled = {};
  for (const k of Object.keys(r).sort().reverse()) shuffled[k] = r[k];
  assert.notDeepEqual(Object.keys(r), Object.keys(shuffled), 'insertion order really did change');
  assert.equal(sha256Hex(canonicalJson(shuffled)), sha256Hex(canonicalJson(r)));
  // And plain JSON.stringify would NOT have been stable — which is why
  // canonicalJson exists.
  assert.notEqual(JSON.stringify(shuffled), JSON.stringify(r));
});
