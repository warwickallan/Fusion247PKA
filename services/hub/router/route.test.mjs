// BUILD-002 WP2 — spine-integrated YouTube route: fixtures proof.
//
// Proves the YouTube route runs THROUGH the durable gateway spine (not a side poller): a YouTube
// capture flows claim → writing → written → evidenced → completed via the routing writer, with
// evidence-gated completion, cross-capture duplicate protection, honest failure (no false completion),
// a failed Telegram projection that cannot reverse completed durable work, and a truthful result card.
// Fully synthetic — injected extract/preserveRaw/upsert, no network, no TubeAIR, no live DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createInMemoryOperationalStore } from '../../fusion-capture-gateway/src/store/operationalStore.js';
import { createSandboxMarkdownWriter } from '../../fusion-capture-gateway/src/markdownWriter.js';
import { createWorker } from '../../fusion-capture-gateway/src/worker.js';
import { projectCard } from '../../fusion-capture-gateway/src/receiptProjection.js';
import { createRoutingWriter } from './routingWriter.mjs';
import { createYoutubeProcessor } from './youtubeProcessor.mjs';
import { classifyYouTube } from '../youtube/youtubeClassify.mjs';

const NOW = 1_800_000_000_000;
const YT_URL = 'https://youtu.be/pcR30j-sKxU';

function fakeAdapter() {
  const edits = [];
  let failNext = 0;
  return {
    async editCard(captureId, model) {
      if (failNext > 0) { failNext -= 1; throw new Error('simulated Telegram projection failure'); }
      edits.push({ captureId, model });
      return { captureId, model };
    },
    failNextEdit(n) { failNext = n; },
    edits,
  };
}

// Fake youtube processor deps with call counters + a source registry (idempotency).
function fakeYtDeps({ extractOk = true } = {}) {
  const sources = new Set();
  const calls = { extract: 0, preserveRaw: 0, upsert: 0 };
  return {
    deps: {
      classify: classifyYouTube,
      async sourceExists(videoId) { return sources.has(videoId); },
      async extract() {
        calls.extract += 1;
        if (!extractOk) return { ok: false, error: 'no transcript available' };
        return { ok: true, manifest: { title: 'Fake', channel: 'Chan', source_url: YT_URL, segment_count: 3, transcript_source: 'auto' }, packetFiles: [{ name: 'tubeair-report.md', content: '# fake' }] };
      },
      async preserveRaw({ videoId }) { calls.preserveRaw += 1; return { dir: `Sources/_raw/${videoId}`, files: [{ sha256: 'deadbeef'.repeat(8) }], created: true }; },
      async upsertSource(row) { calls.upsert += 1; sources.add(row.video_id); },
    },
    calls, sources,
  };
}

function buildRig({ extractOk = true } = {}) {
  const store = createInMemoryOperationalStore();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wp2route-'));
  const markdownWriter = createSandboxMarkdownWriter({ baseDir: tmp, subdir: 'inbox' });
  const yt = fakeYtDeps({ extractOk });
  const youtubeProcessor = createYoutubeProcessor(yt.deps);
  const routingWriter = createRoutingWriter({ markdownWriter, youtubeProcessor });
  const adapter = fakeAdapter();
  const worker = createWorker({ store, markdownWriter: routingWriter, adapter, workerId: 'w1', leaseMs: 30_000 });
  return { store, worker, adapter, yt, tmp };
}

function seedCapture(store, { key, captureId, text }) {
  store.recordIntake({ idempotency_key: key, capture_id: captureId, source_channel: 'telegram', text_preview: text }, { now: NOW });
  store.enqueue(captureId, { now: NOW, confirmedByTap: true });
}

test('A — a YouTube capture completes THROUGH the spine (evidence-gated), routed to youtube_source', async () => {
  const { store, worker, yt } = buildRig();
  seedCapture(store, { key: 'k-a', captureId: 'cap-a', text: `Check this out ${YT_URL}` });
  const final = await worker.processOne({ now: NOW });
  assert.equal(final.state, 'completed');
  assert.equal(final.destination_ref.kind, 'youtube_source');
  assert.equal(final.destination_ref.video_id, 'pcR30j-sKxU');
  assert.equal(final.evidence_pointers[0].evidence_kind, 'raw_transcript');
  assert.equal(yt.calls.extract, 1);
  assert.equal(yt.calls.upsert, 1);
});

test('B — cross-capture duplicate protection: same video, new capture, no re-extraction', async () => {
  const { store, worker, yt } = buildRig();
  seedCapture(store, { key: 'k-b1', captureId: 'cap-b1', text: YT_URL });
  await worker.processOne({ now: NOW });
  // A second, DIFFERENT capture carrying the SAME video id.
  seedCapture(store, { key: 'k-b2', captureId: 'cap-b2', text: `dupe ${YT_URL}` });
  const second = await worker.processOne({ now: NOW + 1 });
  assert.equal(second.state, 'completed');
  assert.equal(second.destination_ref.kind, 'youtube_source');
  assert.equal(yt.calls.extract, 1, 'extraction ran once across both captures (idempotent on video id)');
  assert.equal(yt.calls.preserveRaw, 1, 'RAW preserved once');
});

test('C — a non-YouTube capture still routes to the governed markdown writer', async () => {
  const { store, worker, yt } = buildRig();
  seedCapture(store, { key: 'k-c', captureId: 'cap-c', text: 'just an ordinary thought to keep' });
  const final = await worker.processOne({ now: NOW });
  assert.equal(final.state, 'completed');
  assert.equal(final.destination_ref.kind, 'markdown');
  assert.equal(yt.calls.extract, 0, 'no extraction for a plain note');
});

test('D — a failed Telegram projection cannot reverse completed durable work', async () => {
  const { store, worker, adapter } = buildRig();
  seedCapture(store, { key: 'k-d', captureId: 'cap-d', text: YT_URL });
  adapter.failNextEdit(1); // the post-complete card edit throws
  const final = await worker.processOne({ now: NOW });
  assert.equal(final.state, 'completed', 'record is durably completed despite the projection throwing');
  assert.equal(store.getByCaptureId('cap-d').state, 'completed', 'store still shows completed — not reversed');
  assert.equal(adapter.edits.length, 0, 'the card edit did fail (was not recorded)');
});

test('E — an extraction failure yields an honest failure, never a false completion', async () => {
  const { store, worker, yt } = buildRig({ extractOk: false });
  seedCapture(store, { key: 'k-e', captureId: 'cap-e', text: YT_URL });
  const final = await worker.processOne({ now: NOW });
  assert.equal(final.state, 'failed', 'extraction failure -> failed, not completed');
  assert.notEqual(final.state, 'completed');
  assert.equal(yt.calls.upsert, 0, 'no youtube_source row written on extraction failure');
});

test('F — the completed YouTube card is truthful (extracted + note pending, NOT "saved to your Brain")', async () => {
  const { store, worker } = buildRig();
  seedCapture(store, { key: 'k-f', captureId: 'cap-f', text: YT_URL });
  const final = await worker.processOne({ now: NOW });
  const card = projectCard(final);
  assert.match(card.status_line, /transcript extracted/i);
  assert.match(card.status_line, /review/i);
  assert.doesNotMatch(card.status_line, /saved to your Brain/i);
});
