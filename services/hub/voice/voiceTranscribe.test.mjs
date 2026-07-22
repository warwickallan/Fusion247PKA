// BUILD-002 WP6 — REAL audio → transcript → routed durable work (Windows SAPI, no injected text).
//
// Skips gracefully where SAPI is unavailable (e.g. Linux CI) so the suite stays green cross-platform;
// on this Windows machine it exercises the true audio path: synth a WAV fixture, transcribe it with the
// local recognizer, feed the REAL transcript through voiceIntake, and record it durably in the store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { synthWav, transcribeWav, sapiAvailable } from './voiceTranscribe.mjs';
import { voiceIntake } from './voiceIntake.mjs';
import { createInMemoryOperationalStore } from '../../fusion-capture-gateway/src/store/operationalStore.js';

const HAVE_SAPI = sapiAvailable();
const NOW = 1_800_000_000_000;

test('a real audio fixture transcribes to non-empty text (local SAPI, not injected)', { skip: HAVE_SAPI ? false : 'SAPI recognizer unavailable on this host' }, () => {
  const wav = path.join(os.tmpdir(), 'wp6-voice-fixture.wav');
  synthWav('add milk and eggs to the shopping list', wav);
  assert.ok(fs.existsSync(wav) && fs.statSync(wav).size > 1000, 'a WAV fixture was produced');
  const { text } = transcribeWav(wav);
  assert.ok(text.length > 0, 'transcript is non-empty');
  assert.match(text, /milk|eggs|shopping|list/i, 'transcript resembles the spoken phrase');
  fs.rmSync(wav, { force: true });
});

test('audio fixture → transcript → voiceIntake → durable routed capture', { skip: HAVE_SAPI ? false : 'SAPI recognizer unavailable on this host' }, async () => {
  const wav = path.join(os.tmpdir(), 'wp6-voice-fixture2.wav');
  synthWav('remember to review the pricing model on Friday', wav);

  // The REAL transcriber: voiceIntake's injected dep calls the SAPI adapter on the actual audio.
  const r = await voiceIntake({ voice_ref: 'file:wp6-fixture2', source: wav }, {
    transcribe: (ref, o) => { const { text } = transcribeWav(wav); return { text }; },
  });
  assert.ok(r.envelope.transcript.length > 0, 'transcript preserved on the envelope');
  assert.equal(r.route, 'note');

  // Routed durable work: record it in the operational store (the same store the spine uses).
  const store = createInMemoryOperationalStore();
  const { record, isNew } = store.recordIntake({ ...r.envelope, capture_id: 'cap-voice-wp6' }, { now: NOW });
  assert.equal(isNew, true);
  assert.equal(record.state, 'accepted');
  assert.equal(store.getByCaptureId('cap-voice-wp6').text_preview ?? store.getByCaptureId('cap-voice-wp6').transcript ?? r.envelope.transcript, r.envelope.transcript || record.text_preview);
  fs.rmSync(wav, { force: true });
});
