// BUILD-002 WP2 — ingest pipeline reliability tests (node --test). AC6: idempotent, no double-write.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ingestYouTube } from './ingest.mjs';

function tmpVault() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-')); }
const META = { videoId: 'pcR30j-sKxU', title: 'AI memory just got solved', sourceUrl: 'https://youtu.be/pcR30j-sKxU',
  channel: 'Igor Kudryk', published: '2026-03-21', transcriptSource: 'auto_captions', capturedAt: '2026-07-22T01:57:32Z', captureId: 'cap-1' };
const PACKET = [{ name: 'tubeair-report.md', content: '# Report\n\n[00:00] transcript evidence…\n' }, { name: 'manifest.json', content: '{"video_id":"pcR30j-sKxU"}' }];
const BODY = '## Executive orientation\n\nHoncho is an agentic-memory system.\n';

test('ingest writes the note + preserves RAW with sha256 evidence', async () => {
  const root = tmpVault();
  const r = await ingestYouTube({ vaultRoot: root, meta: META, packetFiles: PACKET, authoredBody: BODY });
  assert.equal(r.note.created, true);
  assert.match(r.note.path, /^Sources\/pcr30j-skxu-/);
  assert.equal(r.raw.created, true);
  assert.equal(r.raw.files.length, 2);
  assert.match(r.raw.files[0].sha256, /^[0-9a-f]{64}$/);
  const note = fs.readFileSync(path.join(root, r.note.path), 'utf8');
  assert.match(note, /review_state: ai_created/);
  assert.match(note, /source_id: pcR30j-sKxU/);
  assert.match(note, /RAW transcript — immutable source evidence/);
  assert.ok(fs.existsSync(path.join(root, 'Sources/_raw/pcR30j-sKxU/tubeair-report.md')), 'RAW preserved');
});

test('AC6 — duplicate delivery / resumed worker makes NO second note or RAW copy', async () => {
  const root = tmpVault();
  await ingestYouTube({ vaultRoot: root, meta: META, packetFiles: PACKET, authoredBody: BODY });
  const again = await ingestYouTube({ vaultRoot: root, meta: META, packetFiles: PACKET, authoredBody: 'DIFFERENT retry body' });
  assert.equal(again.note.created, false, 'second ingest is a no-op');
  assert.equal(again.raw.created, false, 'RAW not re-written');
  const notes = fs.readdirSync(path.join(root, 'Sources')).filter((f) => f.endsWith('.md'));
  assert.equal(notes.length, 1, 'exactly one note');
  const rawFiles = fs.readdirSync(path.join(root, 'Sources/_raw/pcR30j-sKxU'));
  assert.equal(rawFiles.length, 2, 'exactly the two RAW files');
});

test('ingest refuses without a video id (idempotency needs it)', async () => {
  await assert.rejects(() => ingestYouTube({ vaultRoot: tmpVault(), meta: { title: 'x' }, packetFiles: PACKET, authoredBody: BODY }), /requires meta.videoId/);
});
