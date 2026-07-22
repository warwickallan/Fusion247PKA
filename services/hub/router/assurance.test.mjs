// BUILD-002 WP7 — cross-channel assurance: duplicate-delivery + restart/recovery (no elevation).
//
// Proves the hub-wide reliability invariants end-to-end on the fixtures spine:
//   * duplicate delivery of the SAME item (email / voice / youtube) never produces two durable records
//     or two extractions — idempotency is keyed on the channel's stable id;
//   * a worker that dies mid-flight resumes to a single completion with no duplicate durable work and
//     never a false completion in between.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createInMemoryOperationalStore } from '../../fusion-capture-gateway/src/store/operationalStore.js';
import { createSandboxMarkdownWriter } from '../../fusion-capture-gateway/src/markdownWriter.js';
import { createWorker } from '../../fusion-capture-gateway/src/worker.js';
import { createRoutingWriter } from './routingWriter.mjs';
import { createYoutubeProcessor } from './youtubeProcessor.mjs';
import { classifyYouTube } from '../youtube/youtubeClassify.mjs';
import { emailIntake } from '../email/emailIntake.mjs';
import { voiceIntake } from '../voice/voiceIntake.mjs';

const NOW = 1_800_000_000_000;
const YT = 'https://youtu.be/pcR30j-sKxU';

function ytDeps({ failFirstExtract = false } = {}) {
  const sources = new Set();
  const calls = { extract: 0, upsert: 0 };
  let failed = failFirstExtract;
  return {
    sources, calls,
    deps: {
      classify: classifyYouTube,
      async sourceExists(v) { return sources.has(v); },
      async extract() {
        calls.extract += 1;
        if (failed) { failed = false; return { ok: false, error: 'transient extraction failure' }; }
        return { ok: true, manifest: { title: 'X', channel: 'C', source_url: YT, segment_count: 1, transcript_source: 'auto' }, packetFiles: [{ name: 'r.md', content: '#' }] };
      },
      async preserveRaw({ videoId }) { return { dir: `Sources/_raw/${videoId}`, files: [{ sha256: 'a'.repeat(64) }], created: true }; },
      async upsertSource(row) { calls.upsert += 1; sources.add(row.video_id); },
    },
  };
}

function rig(ytd) {
  const store = createInMemoryOperationalStore();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wp7-'));
  const md = createSandboxMarkdownWriter({ baseDir: tmp, subdir: 'inbox' });
  const writer = createRoutingWriter({ markdownWriter: md, youtubeProcessor: createYoutubeProcessor(ytd.deps) });
  const adapter = { async editCard() {}, };
  const worker = createWorker({ store, markdownWriter: writer, adapter, workerId: 'w', leaseMs: 30_000 });
  return { store, worker };
}

test('duplicate email delivery → one durable record (idempotent on message id)', () => {
  const store = createInMemoryOperationalStore();
  const { envelope } = emailIntake({ message_id: '<dup@x>', from: 'w', to: ['a'], subject: 's', body: 'b' });
  // The intake layer assigns a capture_id; dedup keys on idempotency_key regardless.
  const a = store.recordIntake({ ...envelope, capture_id: 'cap-email-1' }, { now: NOW });
  const b = store.recordIntake({ ...envelope, capture_id: 'cap-email-2' }, { now: NOW + 5 });
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false, 're-delivery dedups');
  assert.equal(store.list().length, 1);
});

test('duplicate voice delivery → one durable record (idempotent on voice ref)', async () => {
  const store = createInMemoryOperationalStore();
  const { envelope } = await voiceIntake({ voice_ref: 'V9' }, { transcribe: async () => ({ text: 'a note' }) });
  store.recordIntake({ ...envelope, capture_id: 'cap-voice-1' }, { now: NOW });
  store.recordIntake({ ...envelope, capture_id: 'cap-voice-2' }, { now: NOW + 5 });
  assert.equal(store.list().length, 1);
});

test('duplicate YouTube capture (two captures, same video) → one extraction, one upsert', async () => {
  const ytd = ytDeps();
  const { store, worker } = rig(ytd);
  for (const [k, id] of [['k1', 'c1'], ['k2', 'c2']]) {
    store.recordIntake({ idempotency_key: k, capture_id: id, text_preview: YT }, { now: NOW });
    store.enqueue(id, { now: NOW, confirmedByTap: true });
  }
  await worker.processOne({ now: NOW });
  await worker.processOne({ now: NOW + 1 });
  assert.equal(ytd.calls.extract, 1);
  assert.equal(ytd.calls.upsert, 1);
});

test('restart/recovery: a mid-flight extraction failure resumes to ONE completion, no double durable work', async () => {
  const ytd = ytDeps({ failFirstExtract: true });
  const { store, worker } = rig(ytd);
  store.recordIntake({ idempotency_key: 'kr', capture_id: 'cr', text_preview: YT }, { now: NOW });
  store.enqueue('cr', { now: NOW, confirmedByTap: true });

  // First attempt fails during extraction → honest failure, NOT completed.
  const first = await worker.processOne({ now: NOW });
  assert.equal(first.state, 'failed');
  assert.notEqual(first.state, 'completed');
  assert.equal(ytd.calls.upsert, 0, 'no durable youtube_source written on the failed attempt');

  // A due retry (clock advanced past the backoff) re-claims and completes exactly once.
  const later = NOW + 60 * 60 * 1000;
  const second = await worker.processOne({ now: later });
  assert.equal(second.state, 'completed');
  assert.equal(ytd.calls.upsert, 1, 'exactly one durable youtube_source after recovery');
  assert.equal(store.list().filter((r) => r.state === 'completed').length, 1);
});
