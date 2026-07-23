import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePacket, effectiveSensitivity } from './contextOutbox.mjs';

test('validatePacket accepts a good preference packet', () => {
  const r = validatePacket({ type: 'preference', summary: 'Warwick prefers visual routing maps.' });
  assert.equal(r.ok, true);
});

test('validatePacket rejects missing type + short summary', () => {
  assert.equal(validatePacket({ summary: 'x' }).ok, false);
  assert.equal(validatePacket({ type: 'nonsense', summary: 'a real summary here' }).ok, false);
});

test('privacy guard escalates health/employer content to restricted', () => {
  assert.equal(effectiveSensitivity({ type: 'decision', summary: 'blood pressure medical review' }), 'restricted');
  assert.equal(effectiveSensitivity({ type: 'decision', summary: 'Bellrock client delivery note' }), 'restricted');
  assert.equal(effectiveSensitivity({ type: 'preference', summary: 'prefers dark mode dashboards' }), 'ordinary');
});

test('prohibited stays prohibited', () => {
  assert.equal(effectiveSensitivity({ type: 'preference', summary: 'x y z', sensitivity: 'prohibited' }), 'prohibited');
});
