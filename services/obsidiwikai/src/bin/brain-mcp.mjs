#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { assertRetrievalConfig } from '../config.mjs';
import {
  BRAIN_ACCESS_LIMITS,
  createBrainAccess,
  serialiseBrainResult,
} from '../core/brainAccess.mjs';

function toolResult(value) {
  return { content: [{ type: 'text', text: serialiseBrainResult(value) }] };
}

function toolFailure() {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: serialiseBrainResult({
        status: 'error',
        error: 'Brain retrieval failed safely. No upstream payload was returned.',
      }),
    }],
  };
}

export function createBrainMcpServer({ access = createBrainAccess() } = {}) {
  const server = new McpServer({
    name: 'fusion247-obsidiwikai-brain',
    version: '0.1.0',
  });
  const inputSchema = {
    query: z.string().trim().min(1).max(BRAIN_ACCESS_LIMITS.queryChars)
      .describe('Natural-language question for the read-only Brain'),
    top_k: z.number().int().min(1).max(BRAIN_ACCESS_LIMITS.topKMax).optional()
      .describe('Bounded retrieval depth; defaults to 6 and cannot exceed 12'),
  };

  server.registerTool('brain_search', {
    title: 'Search the Brain',
    description: 'Read-only fixed mix-mode retrieval from the one LightRAG/Neo4j Brain. Returns bounded concepts, relationships, source identities, exact chunks and native references. It cannot access paths, execute Cypher, call arbitrary routes, or write.',
    inputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ query, top_k: topK }) => {
    try {
      return toolResult(await access.search(query, { topK }));
    } catch (error) {
      return toolFailure(error);
    }
  });

  server.registerTool('brain_ask', {
    title: 'Ask the Brain',
    description: 'Read-only grounded Q&A over the one Brain using fixed mix-mode retrieval. Returns a plain-English answer with source/chunk evidence, relationships, uncertainty, native references and a MyPKA decision disclaimer. It cannot mutate any system.',
    inputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ query, top_k: topK }) => {
    try {
      return toolResult(await access.ask(query, { topK }));
    } catch (error) {
      return toolFailure(error);
    }
  });

  return server;
}

export async function main() {
  assertRetrievalConfig();
  // Live LightRAG retrieval is ~10s cold; give each call generous headroom so the MCP tool
  // doesn't return insufficient_evidence merely because a real query was slow.
  const access = createBrainAccess({ timeoutMs: Number(process.env.BRAIN_TIMEOUT_MS) || 45_000 });
  const server = createBrainMcpServer({ access });
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`brain-mcp: ${error.message}`);
    process.exitCode = 1;
  });
}
