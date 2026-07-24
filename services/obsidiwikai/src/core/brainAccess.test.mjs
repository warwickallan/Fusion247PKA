import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAIN_ACCESS_LIMITS,
  createBrainAccess,
  evidenceFromQueryData,
  normaliseQuestion,
} from './brainAccess.mjs';

test('brain search is fixed to bounded mix-mode retrieval and keeps graph/evidence trace', async () => {
  const calls = [];
  const access = createBrainAccess({
    timeoutMs: 4321,
    client: {
      async queryData(query, options) {
        calls.push({ query, options });
        return {
          data: {
            entities: [{ entity_name: 'Sensitive Documents', description: 'Client material', source_id: 'chunk-a' }],
            relationships: [{ source: 'Sensitive Documents', target: 'Local AI', description: 'can remain local', source_id: 'chunk-a' }],
            chunks: [{ id: 'chunk-a', file_source: 'bankdPmQnHU', content: 'Sensitive documents can stay behind the air gap.' }],
            references: [{ reference_id: '1', file_source: 'bankdPmQnHU' }],
          },
        };
      },
    },
  });

  const result = await access.search('  Why local AI?  ', { topK: 99, mode: 'naive' });
  assert.deepEqual(calls, [{
    query: 'Why local AI?',
    options: {
      mode: 'mix',
      topK: BRAIN_ACCESS_LIMITS.topKMax,
      onlyContext: true,
      timeoutMs: 4321,
    },
  }]);
  assert.equal(result.status, 'grounded');
  assert.equal(result.evidence.chunks[0].chunk_id, 'chunk-a');
  assert.equal(result.evidence.chunks[0].source_identity, 'bankdPmQnHU');
  assert.equal(result.evidence.relationships[0].to, 'Local AI');
  assert.deepEqual(result.evidence.references[0], { reference_id: '1', file_source: 'bankdPmQnHU' });
});

test('brain ask refuses synthesis when no exact evidence was retrieved', async () => {
  let answerCalls = 0;
  const access = createBrainAccess({
    client: {
      async queryData() {
        return {
          data: {
            entities: [{ name: 'Only a node' }],
            references: [{ reference_id: 'reference-without-a-passage' }],
          },
        };
      },
      async queryResult() { answerCalls += 1; return { response: 'unsupported' }; },
    },
  });
  const result = await access.ask('What is supported?');
  assert.equal(result.status, 'insufficient_evidence');
  assert.deepEqual(result.evidence.references, [{ reference_id: 'reference-without-a-passage' }]);
  assert.match(result.answer, /Insufficient evidence/);
  assert.equal(answerCalls, 0);
  assert.match(result.advisory, /do not authorise or apply changes to MyPKA/);
});

test('brain ask returns bounded answer and preserves answer-native references', async () => {
  const access = createBrainAccess({
    client: {
      async queryData() {
        return { data: { chunks: [{ id: 'c1', source_id: 'source-1', content: 'Grounded passage' }] } };
      },
      async queryResult(query, options) {
        assert.equal(options.mode, 'mix');
        return { response: 'Grounded answer', references: [{ reference_id: 'c1', source: 'source-1' }] };
      },
    },
  });
  const result = await access.ask('Tell me the grounded answer');
  assert.equal(result.status, 'grounded');
  assert.equal(result.answer, 'Grounded answer');
  assert.deepEqual(result.answer_references, [{ reference_id: 'c1', source: 'source-1' }]);
});

test('query and evidence bounds reject blank/oversized input and truncate passages', () => {
  assert.throws(() => normaliseQuestion('  '), /non-empty/);
  assert.throws(() => normaliseQuestion('x'.repeat(BRAIN_ACCESS_LIMITS.queryChars + 1)), /exceeds/);
  const evidence = evidenceFromQueryData({
    chunks: [{ id: 'c', content: 'x'.repeat(BRAIN_ACCESS_LIMITS.passageChars + 100) }],
  });
  assert.ok(evidence.chunks[0].passage.length <= BRAIN_ACCESS_LIMITS.passageChars);
});
