import test from 'node:test';
import assert from 'node:assert/strict';
import { createLightRagClient } from './lightrag.mjs';

function recordingClient() {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({
      url,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    });
    return {
      ok: true,
      async json() { return { ok: true }; },
    };
  };
  return {
    calls,
    client: createLightRagClient({
      base: 'https://lightrag.test',
      apiKey: 'test-key',
      fetchImpl,
    }),
  };
}

test('pinned 0313 entity and relation mutations use the live REST shapes', async () => {
  const { calls, client } = recordingClient();
  await client.createEntity('New Concept', { description: 'grounded' });
  await client.editEntity('New Concept', { source_id: 'chunk-1' });
  await client.createRelation('New Concept', 'Existing Concept', { description: 'connects' });
  await client.editRelation('New Concept', 'Existing Concept', { source_id: 'chunk-1' });
  await client.deleteRelation('New Concept', 'Existing Concept');
  await client.deleteEntity('New Concept');

  assert.deepEqual(calls.map(({ url, method, body }) => ({
    path: new URL(url).pathname,
    method,
    body,
  })), [
    {
      path: '/graph/entity/create',
      method: 'POST',
      body: { entity_name: 'New Concept', entity_data: { description: 'grounded' } },
    },
    {
      path: '/graph/entity/edit',
      method: 'POST',
      body: {
        entity_name: 'New Concept',
        updated_data: { source_id: 'chunk-1' },
        allow_rename: false,
        allow_merge: false,
      },
    },
    {
      path: '/graph/relation/create',
      method: 'POST',
      body: {
        source_entity: 'New Concept',
        target_entity: 'Existing Concept',
        relation_data: { description: 'connects' },
      },
    },
    {
      path: '/graph/relation/edit',
      method: 'POST',
      body: {
        source_id: 'New Concept',
        target_id: 'Existing Concept',
        updated_data: { source_id: 'chunk-1' },
      },
    },
    {
      path: '/graph/relation/delete',
      method: 'DELETE',
      body: { source_entity: 'New Concept', target_entity: 'Existing Concept' },
    },
    {
      path: '/graph/entity/delete',
      method: 'DELETE',
      body: { entity_name: 'New Concept' },
    },
  ]);
});

test('entity merge uses the exact pinned 0313 payload', async () => {
  const { calls, client } = recordingClient();
  await client.mergeEntities(['Alias A', 'Alias B'], 'Canonical');
  assert.deepEqual(calls[0].body, {
    entities_to_change: ['Alias A', 'Alias B'],
    entity_to_change_into: 'Canonical',
  });
});

test('queryResult preserves native answer references and applies a request timeout', async () => {
  const calls = [];
  const native = { response: 'grounded', references: [{ reference_id: 'chunk-1' }] };
  const client = createLightRagClient({
    base: 'https://lightrag.test',
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, async json() { return native; } };
    },
  });
  const got = await client.queryResult('question', { mode: 'mix', topK: 5, timeoutMs: 1000 });
  assert.equal(got, native);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    query: 'question', mode: 'mix', top_k: 5, only_need_context: false,
  });
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});
