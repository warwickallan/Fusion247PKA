// BUILD-002 WP4 — renderCard unit tests (plain-text renderer + option validation).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCard, validateDecisionOptions } from './renderCard.mjs';

test('renders subject, body, and all option keys (plain text)', () => {
  const out = renderCard({
    subject: 'Accept learning candidate LC-1?',
    body_markdown: 'Package a Fusion247 AI Assessment productized service.',
    options: [{ key: 'A', label: 'Accept' }, { key: 'B', label: 'Decline' }, { key: 'C', label: 'Defer' }],
    related_ref: 'learning_candidate:abc',
  });
  assert.match(out, /Decision needed/);
  assert.match(out, /Accept learning candidate LC-1\?/);
  assert.match(out, /Fusion247 AI Assessment/);
  assert.match(out, /A — Accept/);
  assert.match(out, /B — Decline/);
  assert.match(out, /C — Defer/);
  assert.match(out, /ref: learning_candidate:abc/);
});

test('works with a single option and no body/ref', () => {
  const out = renderCard({ subject: 'Proceed?', options: [{ key: 'A', label: 'Go' }] });
  assert.match(out, /Proceed\?/);
  assert.match(out, /A — Go/);
  assert.doesNotMatch(out, /ref:/);
});

test('QA2-C: punctuation-heavy subject/body/label/ref render safely (no Markdown to break)', () => {
  // Every field is full of Markdown-special characters — plain text means none of them break anything.
  const nasty = '_under_ *star* [bracket] (paren) `tick` > # + - = | { } . !';
  const out = renderCard({
    subject: nasty,
    body_markdown: `body ${nasty}`,
    options: [{ key: 'A', label: `accept ${nasty}` }, { key: 'B', label: 'decline' }],
    related_ref: `note:${nasty}`,
  });
  // The literal characters survive verbatim (no escaping artifacts, no thrown error).
  assert.ok(out.includes(nasty), 'subject preserved literally');
  assert.ok(out.includes(`A — accept ${nasty}`), 'label preserved literally');
  assert.ok(out.includes(`ref: note:${nasty}`), 'ref preserved literally');
});

test('QA2-D: option keys are structurally constrained; bad shapes fail closed', () => {
  assert.throws(() => renderCard({ subject: 's', options: [{ key: '(', label: 'x' }] }), /must match/);
  assert.throws(() => renderCard({ subject: 's', options: [{ key: 'AAAA', label: 'x' }] }), /must match/); // too long
  assert.throws(() => renderCard({ subject: 's', options: [{ key: 'A B', label: 'x' }] }), /must match/); // space
  assert.throws(() => validateDecisionOptions([{ key: 'A', label: '  ' }]), /non-empty label/);
  assert.throws(() => validateDecisionOptions([{ key: 'A', label: 'x' }, { key: 'A', label: 'y' }]), /not unique/);
  assert.throws(() => validateDecisionOptions([]), /at least one option/);
  assert.equal(validateDecisionOptions([{ key: 'A', label: 'ok' }, { key: 'B2', label: 'ok' }]), true);
});

test('rejects missing subject / empty options', () => {
  assert.throws(() => renderCard({ options: [{ key: 'A', label: 'x' }] }), /subject/);
  assert.throws(() => renderCard({ subject: 's', options: [] }), /at least one option/);
});
