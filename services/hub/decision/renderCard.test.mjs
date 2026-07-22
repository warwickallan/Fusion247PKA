// BUILD-002 WP4 — renderCard unit tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCard } from './renderCard.mjs';

test('renders subject, body, and all option keys', () => {
  const out = renderCard({
    subject: 'Accept learning candidate LC-1?',
    body_markdown: 'Package a Fusion247 AI Assessment productized service.',
    options: [{ key: 'A', label: 'Accept' }, { key: 'B', label: 'Decline' }, { key: 'C', label: 'Defer' }],
    related_ref: 'learning_candidate:abc',
  });
  assert.match(out, /Decision needed/);
  assert.match(out, /Accept learning candidate LC-1\?/);
  assert.match(out, /Fusion247 AI Assessment/);
  assert.match(out, /\*A\* — Accept/);
  assert.match(out, /\*B\* — Decline/);
  assert.match(out, /\*C\* — Defer/);
  assert.match(out, /ref: learning_candidate:abc/);
});

test('works with a single option and no body/ref', () => {
  const out = renderCard({ subject: 'Proceed?', options: [{ key: 'A', label: 'Go' }] });
  assert.match(out, /Proceed\?/);
  assert.match(out, /\*A\* — Go/);
  assert.doesNotMatch(out, /ref:/);
});

test('rejects missing subject / empty options / duplicate keys / option missing label', () => {
  assert.throws(() => renderCard({ options: [{ key: 'A', label: 'x' }] }), /subject/);
  assert.throws(() => renderCard({ subject: 's', options: [] }), /option/);
  assert.throws(() => renderCard({ subject: 's', options: [{ key: 'A', label: 'x' }, { key: 'A', label: 'y' }] }), /unique/);
  assert.throws(() => renderCard({ subject: 's', options: [{ key: 'A' }] }), /label/);
});

test('never leaks a token-like secret it was not given (pure of inputs only)', () => {
  const out = renderCard({ subject: 's', options: [{ key: 'A', label: 'go' }] });
  assert.doesNotMatch(out, /bot[0-9]{6,}:/i); // no telegram bot-token shape
});
