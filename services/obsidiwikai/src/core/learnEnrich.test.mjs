import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAction, readAuthoritativeGraph, ENRICH_LIMITS } from './learnEnrich.mjs';

// The conservative decision rule — the single "auto-change the graph vs leave for a human" gate.
test('planAction: high-confidence SAME/ALIAS to a DIFFERENT entity → merge', () => {
  assert.equal(planAction({ classification: 'SAME_CONCEPT', canonical_name: 'Neo4j', confidence: 0.92 }, 'Neo4J database'), 'merge');
  assert.equal(planAction({ classification: 'ALIAS_OF', canonical_name: 'Neo4j', confidence: 0.88 }, 'neo4j graph db'), 'merge');
});

test('planAction: never merges an entity onto ITSELF', () => {
  assert.equal(planAction({ classification: 'SAME_CONCEPT', canonical_name: 'Neo4j', confidence: 0.99 }, 'Neo4j'), 'keep');
});

test('planAction: below the confidence floor is conservative → keep, not merge', () => {
  assert.equal(planAction({ classification: 'SAME_CONCEPT', canonical_name: 'Neo4j', confidence: 0.7 }, 'Neo4J database'), 'keep');
  assert.equal(planAction({ classification: 'RELATED_TO', related_to: 'LightRAG', confidence: 0.7 }, 'Neo4j'), 'keep');
});

test('planAction: high-confidence RELATED_TO → relate', () => {
  assert.equal(planAction({ classification: 'RELATED_TO', related_to: 'LightRAG', confidence: 0.9 }, 'Neo4j'), 'relate');
});

test('planAction: genuine ambiguity is HELD, never auto-applied', () => {
  assert.equal(planAction({ classification: 'UNCERTAIN', confidence: 0.5 }, 'Vector Store'), 'hold');
});

test('planAction: NEW_CONCEPT and zero-confidence noise are kept untouched', () => {
  assert.equal(planAction({ classification: 'NEW_CONCEPT', canonical_name: 'Honcho', confidence: 0.9 }, 'Honcho'), 'keep');
  assert.equal(planAction({ classification: 'UNCERTAIN', confidence: 0 }, 'x'), 'keep');
});

test('planAction respects a tighter injected mergeConfidence', () => {
  const strict = { ...ENRICH_LIMITS, mergeConfidence: 0.95 };
  assert.equal(planAction({ classification: 'SAME_CONCEPT', canonical_name: 'Neo4j', confidence: 0.9 }, 'Neo4J db', strict), 'keep');
});

// readAuthoritativeGraph: correctly splits a source's own entities from the rest of the graph.
test('readAuthoritativeGraph splits source entities from the wider catalog', async () => {
  const fakeClient = {
    async graphs() {
      return {
        nodes: [
          { id: 'a', properties: { entity_id: 'Cypher Query', entity_type: 'concept', description: 'q lang', file_path: 'VID123' } },
          { id: 'b', properties: { entity_id: 'Prepared Statement', entity_type: 'concept', description: 'db', file_path: 'OTHER' } },
          { id: 'c', properties: { entity_id: 'Neo4j', entity_type: 'tool', description: 'graph db', source_id: 'chunk-of-VID123' } },
          { id: 'd', properties: {} }, // no name → filtered out
        ],
      };
    },
  };
  const { entities, sourceEntities } = await readAuthoritativeGraph('VID123', { client: fakeClient });
  assert.equal(entities.length, 3); // the nameless node is dropped
  const names = sourceEntities.map((e) => e.name).sort();
  assert.deepEqual(names, ['Cypher Query', 'Neo4j']); // both attributed to VID123 (file_path + source_id)
  assert.ok(!sourceEntities.some((e) => e.name === 'Prepared Statement'));
});
