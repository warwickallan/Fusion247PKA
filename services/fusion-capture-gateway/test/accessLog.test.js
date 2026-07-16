// F-05 structured access logging — secret-free records + worker wiring.
// Hermetic: injected sink, injected `now`, no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { createAccessLogger, redact } from '../src/security/accessLog.js';
import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createSandboxMarkdownWriter } from '../src/markdownWriter.js';
import { createIntake } from '../src/intake.js';
import { createWorker } from '../src/worker.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = 424242;
// A token-SHAPED throwaway built at runtime (NEVER a committed literal, so the
// secret-scanner has nothing to flag). Used ONLY to prove redaction masks it.
const FAKE_TELEGRAM_SHAPED = ['123456789', 'AA' + 'z'.repeat(36)].join(':');

function tmpDir(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `fcg-accesslog-${tag}-`));
}

test('redact() masks secret-shaped values and drops sensitive-named keys', () => {
  const out = redact({
    principal: 'worker-1',
    capture_id: 'cap_abc',
    token: FAKE_TELEGRAM_SHAPED, // sensitive key → dropped
    note: FAKE_TELEGRAM_SHAPED, // benign key, secret VALUE → masked
    payload: 'the private message body',
    nested: { authorization: 'Bearer xyz', ok: 'fine' },
  });
  assert.equal(out.principal, 'worker-1');
  assert.equal(out.capture_id, 'cap_abc');
  assert.equal(out.token, '[REDACTED]');
  assert.equal(out.note, '[REDACTED]');
  assert.equal(out.payload, '[REDACTED]');
  assert.equal(out.nested.authorization, '[REDACTED]');
  assert.equal(out.nested.ok, 'fine');
});

test('capture_write record carries who/what/when; never payload or a secret', () => {
  const records = [];
  const log = createAccessLogger({ sink: (r) => records.push(r) });
  log.captureWrite({
    principal: 'worker-1',
    captureId: 'cap_xyz',
    when: 1_700_000_000_000,
    outcome: 'completed',
    destinationRef: { kind: 'markdown', path: '/inbox/cap_xyz.md' },
  });
  assert.equal(records.length, 1);
  const rec = records[0];
  assert.equal(rec.event, 'capture_write');
  assert.equal(rec.principal, 'worker-1');
  assert.equal(rec.capture_id, 'cap_xyz');
  assert.equal(rec.outcome, 'completed');
  assert.equal(typeof rec.at_ms, 'number');

  const serialised = JSON.stringify(rec);
  assert.ok(!/payload|text|body/.test(Object.keys(rec).join(',')), 'no content-bearing keys');
  assert.ok(!/[0-9]{6,}:AA[A-Za-z0-9_-]{30,}/.test(serialised), 'no telegram-token-shaped value');
});

test('auth_rejection record logs who/when/reason — never content', () => {
  const records = [];
  const log = createAccessLogger({ sink: (r) => records.push(r) });
  log.authRejection({ principal: '999', channel: 'telegram', when: 42, reason: 'unauthorised_sender' });
  assert.deepEqual(
    { ...records[0], service: undefined },
    { service: undefined, event: 'auth_rejection', principal: '999', channel: 'telegram', outcome: 'denied', reason: 'unauthorised_sender', at_ms: 42 },
  );
});

test('wired into the worker: a governed capture_write is logged on completion', async () => {
  const store = createInMemoryOperationalStore();
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  const writer = createSandboxMarkdownWriter({ baseDir: tmpDir('worker') });
  const records = [];
  const accessLog = createAccessLogger({ sink: (r) => records.push(r) });
  let t = 3_000_000;
  const clock = { now: () => t };

  const intake = createIntake({ store, adapter, clock });
  const worker = createWorker({ store, markdownWriter: writer, adapter, clock, workerId: 'worker-A', leaseMs: 1000, accessLog });

  const accepted = await intake.accept({ message: { message_id: 1, from: { id: AUTH_ID }, text: 'super secret diary line' } });
  assert.equal(accepted.ok, true);
  const final = await worker.processOne({ now: t });
  assert.equal(final.state, STATES.COMPLETED);

  const writes = records.filter((r) => r.event === 'capture_write');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].principal, 'worker-A');
  assert.equal(writes[0].capture_id, accepted.captureId);
  assert.equal(typeof writes[0].at_ms, 'number');
  // Crucial: the private payload text is NOWHERE in the log record.
  assert.ok(!JSON.stringify(writes[0]).includes('super secret diary line'), 'payload text never logged');
});
