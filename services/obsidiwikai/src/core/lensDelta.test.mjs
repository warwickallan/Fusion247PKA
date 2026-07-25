import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLensDelta } from './lensDelta.mjs';

test('paired lens delta rejects invented evidence and non-cross-source relationships', () => {
  const data = {
    new: ['20 Questions', 'Support Thread'],
    connected: ['RAG', 'AI Agents'],
  };
  const got = validateLensDelta({
    newly_visible: ['20 Questions', 'made up'],
    newly_visible_cross_source: ['rag', 'Support Thread'],
    relationships: [
      { from: 'Support Thread', to: 'RAG', relationship: 'tests support retrieval' },
      { from: '20 Questions', to: 'Support Thread', relationship: 'no shared endpoint' },
      { from: 'made up', to: 'AI Agents', relationship: 'invented endpoint' },
    ],
  }, data);
  assert.deepEqual(got.newly_visible, ['20 Questions']);
  assert.deepEqual(got.newly_visible_cross_source, ['RAG']);
  assert.deepEqual(got.relationships, [{
    from: 'Support Thread',
    to: 'RAG',
    relationship: 'tests support retrieval',
  }]);
});
