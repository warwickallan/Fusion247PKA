import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActionPhrase, resolveActionCandidate } from './candidate-resolver.mjs';

test('parses the human fallback phrase', () => {
  assert.deepEqual(parseActionPhrase('Action A from the Cerebras report'), { action: 'A', sourceHint: 'Cerebras' });
  assert.deepEqual(parseActionPhrase('action b from Graph Agents'), { action: 'B', sourceHint: 'Graph Agents' });
  assert.equal(parseActionPhrase('do the first one'), null);
});

test('resolver returns exactly one durable candidate and fails closed on ambiguity', async () => {
  const db = { query: async (_sql, params) => ({ rows: params[1] === 'Cerebras' ? [{ id: 'c1' }] : [] }) };
  assert.equal((await resolveActionCandidate(db, 'Action A from the Cerebras report')).id, 'c1');
  await assert.rejects(() => resolveActionCandidate(db, 'Action A from unknown report'), /resolved to 0 rows/);
});
