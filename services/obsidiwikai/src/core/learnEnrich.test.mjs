import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAction, readAuthoritativeGraph, ENRICH_LIMITS } from './learnEnrich.mjs';

// The conservative decision rule — the single "auto-change the graph vs leave for a human" gate.
test('planAction: deterministic alias → merge (no model confidence needed)', () => {
  assert.equal(planAction({ classification: 'ALIAS_OF', matched_name: 'Agents', confidence: 1, deterministic: true }, 'AI Agent'), 'merge');
  assert.equal(planAction({ classification: 'SAME_CONCEPT', matched_name: 'n8n', confidence: 1, deterministic: true }, 'N8N'), 'merge');
});

test('planAction: model-assisted identity auto-merges ONLY at >=0.98', () => {
  assert.equal(planAction({ classification: 'SAME_CONCEPT', matched_name: 'n8n', confidence: 0.99 }, 'N8N variant'), 'merge');
  assert.equal(planAction({ classification: 'ALIAS_OF', matched_name: 'Large Language Model', confidence: 0.98 }, 'LLM'), 'merge');
});

test('planAction: the 0.85–0.979 identity band is HELD, never welded (Warwick policy)', () => {
  assert.equal(planAction({ classification: 'ALIAS_OF', matched_name: 'Vectors', confidence: 0.97 }, 'Embeddings'), 'hold');
  assert.equal(planAction({ classification: 'SAME_CONCEPT', matched_name: 'Document Hierarchy', confidence: 0.90 }, 'Hierarchical Index'), 'hold');
});

test('planAction: never merges an entity onto ITSELF', () => {
  assert.equal(planAction({ classification: 'SAME_CONCEPT', matched_name: 'Neo4j', confidence: 1, deterministic: true }, 'Neo4j'), 'keep');
});

test('planAction: very low identity confidence is kept, not even held', () => {
  assert.equal(planAction({ classification: 'SAME_CONCEPT', matched_name: 'X', confidence: 0.5 }, 'Y'), 'keep');
});

test('planAction: FR-010 connected-but-distinct → typed relationship, NOT a merge', () => {
  assert.equal(planAction({ classification: 'BROADER_THAN', matched_name: 'Retrieval', confidence: 0.9 }, 'Agentic Retrieval'), 'relate');
  assert.equal(planAction({ classification: 'NARROWER_THAN', matched_name: 'AI', confidence: 0.88 }, 'AI Agents'), 'relate');
  assert.equal(planAction({ classification: 'RELATED_TO', matched_name: 'LightRAG', confidence: 0.9 }, 'Neo4j'), 'relate');
  assert.equal(planAction({ classification: 'SUPERSEDES', matched_name: 'NetworkX', confidence: 0.9 }, 'Neo4JStorage'), 'relate');
});

test('planAction: relationship below relateConfidence is kept, not forced', () => {
  assert.equal(planAction({ classification: 'RELATED_TO', matched_name: 'LightRAG', confidence: 0.7 }, 'Neo4j'), 'keep');
});

test('planAction: genuine ambiguity is HELD; NEW + zero-signal are kept untouched', () => {
  assert.equal(planAction({ classification: 'UNCERTAIN', matched_name: 'Vector Store', confidence: 0.5 }, 'Vector DB'), 'hold');
  assert.equal(planAction({ classification: 'NEW_CONCEPT', matched_name: null, confidence: 0.9 }, 'Honcho'), 'keep');
  assert.equal(planAction({ classification: 'UNCERTAIN', confidence: 0 }, 'x'), 'keep');
});

test('planAction respects an injected tighter mergeConfidence', () => {
  const strict = { ...ENRICH_LIMITS, mergeConfidence: 1.0 };
  assert.equal(planAction({ classification: 'SAME_CONCEPT', matched_name: 'Neo4j', confidence: 0.99 }, 'Neo4J db', strict), 'hold');
});

// readAuthoritativeGraph: correctly splits a source's own entities from the rest of the graph.
test('readAuthoritativeGraph splits source entities from the wider catalog', async () => {
  const fakeClient = {
    async graphs() {
      return {
        nodes: [
          { id: 'a', properties: { entity_id: 'Cypher Query', entity_type: 'concept', description: 'q lang', file_path: 'VID123' } },
          { id: 'b', properties: { entity_id: 'Prepared Statement', entity_type: 'concept', description: 'db', file_path: 'OTHER' } },
          { id: 'c', properties: { entity_id: 'Neo4j', entity_type: 'tool', description: 'graph db', file_path: 'OTHER<SEP>VID123' } },
          { id: 'd', properties: {} }, // no name → filtered out
        ],
      };
    },
  };
  const { entities, sourceEntities } = await readAuthoritativeGraph('VID123', { client: fakeClient });
  assert.equal(entities.length, 3); // the nameless node is dropped
  const names = sourceEntities.map((e) => e.name).sort();
  assert.deepEqual(names, ['Cypher Query', 'Neo4j']); // both carry VID123 as a <SEP> token (Neo4j is shared)
  assert.ok(!sourceEntities.some((e) => e.name === 'Prepared Statement'));
});
