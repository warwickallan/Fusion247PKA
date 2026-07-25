import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createBrainMcpServer } from './brain-mcp.mjs';

async function connected(access) {
  const server = createBrainMcpServer({ access });
  const client = new Client({ name: 'brain-mcp-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

test('MCP exposes exactly the two bounded read-only Brain tools', async (t) => {
  const { server, client } = await connected({
    async search(query, { topK }) { return { status: 'grounded', query, topK }; },
    async ask(query, { topK }) { return { status: 'grounded', answer: query, topK }; },
  });
  t.after(async () => { await client.close(); await server.close(); });

  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), ['brain_ask', 'brain_search']);
  for (const tool of listed.tools) {
    assert.deepEqual(Object.keys(tool.inputSchema.properties).sort(), ['query', 'top_k']);
    assert.match(tool.description, /Read-only/);
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  }

  const result = await client.callTool({ name: 'brain_search', arguments: { query: 'local AI', top_k: 4 } });
  assert.equal(result.isError, undefined);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    status: 'grounded',
    query: 'local AI',
    topK: 4,
  });
});

test('MCP schema blocks out-of-range retrieval depth before handler execution', async (t) => {
  let calls = 0;
  const { server, client } = await connected({
    async search() { calls += 1; return {}; },
    async ask() { calls += 1; return {}; },
  });
  t.after(async () => { await client.close(); await server.close(); });

  const result = await client.callTool({ name: 'brain_ask', arguments: { query: 'question', top_k: 100 } });
  assert.equal(result.isError, true);
  assert.equal(calls, 0);
});
