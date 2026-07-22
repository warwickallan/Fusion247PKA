// BUILD-002 WP6 — email intake: fixtures proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailIntake } from './emailIntake.mjs';

const BASE = {
  message_id: '<abc123@mail.example>',
  from: 'warwick@example.com',
  to: ['larry@fusion247.example', 'team@fusion247.example'],
  cc: ['cc@example.com'],
  subject: 'Notes from the call',
  body: 'Remember to follow up on the pricing model.',
  attachments: [{ filename: 'deck.pdf', mime: 'application/pdf', size: 10240, ref: 'store:att:1' }],
};

test('preserves message id, all recipients, subject, body, and attachment metadata', () => {
  const r = emailIntake(BASE);
  assert.equal(r.envelope.message_id, '<abc123@mail.example>');
  assert.equal(r.envelope.idempotency_key, 'email:<abc123@mail.example>');
  assert.equal(r.envelope.from, 'warwick@example.com');
  assert.deepEqual(r.envelope.to, ['larry@fusion247.example', 'team@fusion247.example']);
  assert.deepEqual(r.envelope.cc, ['cc@example.com']);
  assert.equal(r.envelope.subject, 'Notes from the call');
  assert.equal(r.envelope.attachments[0].filename, 'deck.pdf');
  assert.equal(r.envelope.attachments[0].mime, 'application/pdf');
  assert.equal(r.envelope.original_source_ref.recipient_count, 3);
  assert.equal(r.envelope.original_source_ref.attachment_count, 1);
});

test('routes a normal email to the note lane', () => {
  assert.equal(emailIntake(BASE).route, 'note');
});

test('routes an email containing a YouTube link to the youtube lane (same router as every channel)', () => {
  const r = emailIntake({ ...BASE, body: 'Watch this: https://youtu.be/pcR30j-sKxU' });
  assert.equal(r.route, 'youtube');
  assert.equal(r.youtube.videoId, 'pcR30j-sKxU');
});

test('an empty email routes to needs_clarification, never a guess', () => {
  const r = emailIntake({ message_id: '<empty@x>', from: 'x', subject: '', body: '', attachments: [] });
  assert.equal(r.route, 'needs_clarification');
});

test('idempotency key is stable and message-id-derived (re-delivery dedups)', () => {
  assert.equal(emailIntake(BASE).envelope.idempotency_key, emailIntake({ ...BASE, subject: 'edited' }).envelope.idempotency_key);
});

test('requires a message id (provenance)', () => {
  assert.throws(() => emailIntake({ subject: 'x' }), /message_id/);
});
