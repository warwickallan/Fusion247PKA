// packetFrom contracts — "Honch that" is a VERBATIM exchange (no summarising/truncation);
// ordinary context updates stay compact. Idempotency is keyed on message identity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packetFrom } from './router.mjs';
import { INTENT } from './contracts.mjs';

test('REMEMBER ("Honch that") preserves the full exchange verbatim — no truncation', () => {
  const body = 'Q (Warwick): ' + 'x'.repeat(2000) + '\nA (assistant): ' + 'y'.repeat(2000);
  const p = packetFrom(
    { capture_id: 'e1', source_type: 'email', source_id: '<msg-1@fusion>', subject: 'Honch that', text: body },
    { intent: INTENT.REMEMBER }
  );
  assert.equal(p.verbatim, true);
  assert.equal(p.evidence, body);              // whole body, verbatim
  assert.ok(p.evidence.length > 4000);         // NOT capped at 4000
  assert.ok(p.summary.length <= 200);          // marker-only subject dropped; header is body-derived
  assert.notEqual(p.summary, 'Honch that');    // the instruction is never the remembered content
  assert.equal(p.idempotency_key, 'honcho:<msg-1@fusion>'); // keyed on identity, not a summary fragment
});

test('two different Honcho exchanges get distinct idempotency keys', () => {
  const a = packetFrom({ capture_id: 'a', source_id: '<a@x>', text: 'one' }, { intent: INTENT.REMEMBER });
  const b = packetFrom({ capture_id: 'b', source_id: '<b@x>', text: 'two' }, { intent: INTENT.REMEMBER });
  assert.notEqual(a.idempotency_key, b.idempotency_key);
});

test('ordinary (non-REMEMBER) context packet stays compact', () => {
  const p = packetFrom({ capture_id: 'e2', text: 'a'.repeat(5000) }, { intent: 'keep' });
  assert.ok(p.summary.length <= 600);
  assert.equal(p.verbatim, undefined);
});
