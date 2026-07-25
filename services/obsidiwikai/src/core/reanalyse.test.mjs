import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterpretation } from './reanalyse.mjs';

const data = {
  why: 'Earlier source meaning',
  new: ['Support Ticket', '20 Questions', 'Evaluation Artifact'],
  connected: ['RAG', 'AI Agents', 'Knowledge Base'],
};

test('interpretation retains only exact live-graph concepts', () => {
  const got = validateInterpretation({
    summary: 'Grounded summary',
    noticed_concepts: ['Support Ticket', 'invented concept', 'rag'],
    cross_source_concepts: ['AI Agents', 'not shared'],
    relationships: [
      { from: 'Support Ticket', to: 'Knowledge Base', relationship: 'tests retrieval against prior resolutions' },
      { from: 'Support Ticket', to: '20 Questions', relationship: 'no shared endpoint' },
      { from: 'invented concept', to: 'RAG', relationship: 'invalid endpoint' },
    ],
  }, data);

  assert.deepEqual(got.noticed_concepts, ['Support Ticket', 'RAG']);
  assert.deepEqual(got.cross_source_concepts, ['AI Agents']);
  assert.deepEqual(got.relationships, [{
    from: 'Support Ticket',
    to: 'Knowledge Base',
    relationship: 'tests retrieval against prior resolutions',
  }]);
});

test('interpretation de-duplicates relationship endpoint pairs', () => {
  const got = validateInterpretation({
    relationships: [
      { from: 'RAG', to: '20 Questions', relationship: 'first' },
      { from: '20 Questions', to: 'RAG', relationship: 'same pair reversed' },
    ],
  }, data);
  assert.equal(got.relationships.length, 1);
});
