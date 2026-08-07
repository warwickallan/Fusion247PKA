// MULTIMODAL INTAKE — END-TO-END on synthetic fixtures (DEV proof).
//
// Drives the WHOLE gateway increment with NO network, NO real bot, NO real
// model, NO real data:
//   fake photo update -> intake accepts (raw_object image) -> tap -> worker runs
//     the INJECTED transcriber (fixture OCR text) -> normaliseRawList -> structured
//     list -> governed captures write -> completed.
//   fake voice update -> intake accepts (raw_object voice) -> tap -> worker runs
//     the INJECTED transcriber (fixture STT text) -> captures write -> completed.
//
// Asserts: intake NO LONGER rejects photo/voice; raw_object populated with the
// correct technical_source_type; the injected transcriber was CALLED; the
// normaliser output is correct; a governed capture note is written to disk.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createSandboxMarkdownWriter } from '../src/markdownWriter.js';
import { createIntake } from '../src/intake.js';
import { createWorker } from '../src/worker.js';
import { createTranscriptionStage } from '../src/transcription/transcriptionStage.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = 424242;
const T0 = 1_752_700_000_000;

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, advance: (d) => { t += d; } };
}

// Injected transcriber: a FAKE (like the Tower review adapters). Returns fixture
// OCR text for images and fixture STT text for voice, keyed by modality. Records
// each call so the test can assert it fired.
function fakeTranscriber() {
  const calls = [];
  const fn = (rawObject) => {
    calls.push(rawObject);
    if (rawObject.technical_source_type === 'image') {
      return { text: 'Milk x2\n- eggs (organic)\n3 apples\nbread', confidence: 0.93 };
    }
    return { text: 'pick up the parcel from the depot on friday', confidence: 0.77 };
  };
  fn.calls = calls;
  return fn;
}

function harness(baseDir) {
  const store = createInMemoryOperationalStore();
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID, acceptMultimodal: true });
  const markdownWriter = createSandboxMarkdownWriter({ baseDir, subdir: 'captures' });
  const clock = fixedClock(T0);
  const transcriber = fakeTranscriber();
  const transcriptionStage = createTranscriptionStage({ transcriber });
  const intake = createIntake({ store, adapter, clock });
  const worker = createWorker({
    store, markdownWriter, adapter, clock, workerId: 'worker-mm', leaseMs: 30_000, transcriptionStage,
  });
  return { store, adapter, markdownWriter, clock, transcriber, intake, worker };
}

function photoUpdate(messageId) {
  return {
    message: {
      message_id: messageId,
      from: { id: AUTH_ID },
      chat: { id: AUTH_ID, type: 'private' },
      photo: [
        { file_id: 'AgAC-s', file_unique_id: 'uniqA', width: 90, height: 90, file_size: 1000 },
        { file_id: 'AgAC-l', file_unique_id: 'uniqA', width: 800, height: 600, file_size: 80000 },
      ],
      caption: 'weekly shop',
    },
  };
}

function voiceUpdate(messageId) {
  return {
    message: {
      message_id: messageId,
      from: { id: AUTH_ID },
      chat: { id: AUTH_ID, type: 'private' },
      voice: { file_id: 'AwAC-v', file_unique_id: 'uniqV', duration: 5, mime_type: 'audio/ogg', file_size: 4321 },
    },
  };
}

test('E2E PHOTO: intake accepts -> raw_object(image) -> injected OCR -> normaliseRawList -> structured list -> captures write -> completed', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-mm-photo-'));
  try {
    const { store, transcriber, intake, worker } = harness(baseDir);

    // 1. Intake NO LONGER rejects a photo.
    const accepted = await intake.accept(photoUpdate(100));
    assert.equal(accepted.ok, true, 'photo accepted (no unsupported_content_type)');
    const captureId = accepted.captureId;

    // 2. raw_object populated with the correct technical_source_type (durable).
    const stored = store.getByCaptureId(captureId);
    assert.equal(stored.technical_source_type, 'image');
    assert.equal(stored.raw_payload_ref.object_key, 'telegram:image:uniqA');
    assert.equal(stored.state, STATES.ACCEPTED, 'holds pending until the tap');

    // 3. Tap -> enqueue -> worker runs the saga (transcription + write).
    const tapped = await intake.confirmSave(captureId);
    assert.equal(tapped.outcome, 'queued');
    const final = await worker.processOne();

    // 4. Injected transcriber was CALLED with the image raw_object.
    assert.equal(transcriber.calls.length, 1);
    assert.equal(transcriber.calls[0].technical_source_type, 'image');

    // 5. Saga completed via the governed captures write seam (D2).
    assert.equal(final.state, STATES.COMPLETED);
    assert.equal(final.destination_ref.kind, 'markdown');
    assert.ok(fs.existsSync(final.destination_ref.path), 'governed capture note written');

    // 6. Normaliser output correct + the note carries the structured list.
    const note = fs.readFileSync(final.destination_ref.path, 'utf8');
    assert.match(note, /technical_source_type: image/);
    assert.match(note, /## Transcription/);
    assert.match(note, /2 x milk/);
    assert.match(note, /1 x eggs \(organic\)/);
    assert.match(note, /3 x apples/);
    assert.match(note, /1 x bread/);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('E2E VOICE: intake accepts -> raw_object(voice) -> injected STT -> captures write -> completed', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-mm-voice-'));
  try {
    const { store, transcriber, intake, worker } = harness(baseDir);

    const accepted = await intake.accept(voiceUpdate(200));
    assert.equal(accepted.ok, true, 'voice accepted (no unsupported_content_type)');
    const captureId = accepted.captureId;

    const stored = store.getByCaptureId(captureId);
    assert.equal(stored.technical_source_type, 'voice');
    assert.equal(stored.raw_payload_ref.object_key, 'telegram:voice:uniqV');

    await intake.confirmSave(captureId);
    const final = await worker.processOne();

    assert.equal(transcriber.calls.length, 1);
    assert.equal(transcriber.calls[0].technical_source_type, 'voice');

    assert.equal(final.state, STATES.COMPLETED);
    const note = fs.readFileSync(final.destination_ref.path, 'utf8');
    assert.match(note, /technical_source_type: voice/);
    assert.match(note, /pick up the parcel from the depot on friday/);
    // Voice is NOT normalised into a list.
    assert.doesNotMatch(note, /### Structured items/);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('E2E dedup: a re-delivered identical photo resolves to the SAME capture (isNew false)', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-mm-dedup-'));
  try {
    const { intake } = harness(baseDir);
    const a = await intake.accept(photoUpdate(300));
    const b = await intake.accept(photoUpdate(300));
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(a.captureId, b.captureId);
    assert.equal(a.isNew, true);
    assert.equal(b.isNew, false, 're-sent identical photo dedups to one capture');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('a text capture is UNAFFECTED by the transcription stage (no transcriber call, plain note)', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-mm-text-'));
  try {
    const { transcriber, intake, worker } = harness(baseDir);
    const accepted = await intake.accept({
      message: { message_id: 400, from: { id: AUTH_ID }, chat: { id: AUTH_ID, type: 'private' }, text: 'a plain text capture' },
    });
    assert.equal(accepted.ok, true);
    await intake.confirmSave(accepted.captureId);
    const final = await worker.processOne();
    assert.equal(final.state, STATES.COMPLETED);
    assert.equal(transcriber.calls.length, 0, 'text never enters the transcription stage');
    const note = fs.readFileSync(final.destination_ref.path, 'utf8');
    assert.doesNotMatch(note, /## Transcription/);
    assert.match(note, /a plain text capture/);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
