import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAction, readAuthoritativeGraph, extractLensDirected, relationEndpoints, deterministicMatch, classifyOneGraph, ENRICH_LIMITS } from './learnEnrich.mjs';

// Safety-gate hardening from the seam QA (Fable).
test('deterministicMatch: entity-type mismatch blocks a plural weld (Windows[tool] vs Window[concept])', () => {
  assert.equal(deterministicMatch({ name: 'Windows', entity_type: 'tool' }, [{ name: 'Window', entity_type: 'concept' }]), null);
  assert.equal(deterministicMatch({ name: 'Agents', entity_type: 'concept' }, [{ name: 'Agent', entity_type: 'concept' }])?.kind, 'ALIAS_OF');
});

test('classifyOneGraph: percent-scale confidence fails SAFE to 0 → no accidental merge', async () => {
  const fakeClient = { async queryData() { return { data: { entities: [] } }; } };
  const fakeGen = async () => ({ classification: 'SAME_CONCEPT', matched_index: 0, confidence: 90 }); // drift: 90 not 0.90
  const catalog = [{ name: 'Retrieval Augmented Generation', description: 'x' }];
  const d = await classifyOneGraph({ name: 'Retrieval Augmented Gen', description: 'y' }, catalog, { client: fakeClient, generate: fakeGen });
  assert.equal(d.confidence, 0);
  assert.equal(planAction(d, 'Retrieval Augmented Gen'), 'keep'); // must NOT merge on malformed confidence
});

test('extractLensDirected: rejects candidates whose evidence is not a verbatim source span', async () => {
  const src = 'The retrieval pipeline uses vector embeddings and a knowledge graph for grounded answers. '.repeat(4);
  const fakeGen = async () => [
    { name: 'Vector Embeddings', evidence: 'vector embeddings and a knowledge graph', description: 'real' },
    { name: 'Hallucinated', evidence: 'a phrase that never appears in the source text', description: 'fake' },
    { name: 'No Evidence', description: 'missing evidence' },
  ];
  const out = await extractLensDirected(src, FAKE_LENS, { generate: fakeGen, limit: 5, maxWindows: 1 });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Vector Embeddings');
  assert.ok(out[0].evidence.includes('vector embeddings'));
});

// Deterministic alias matching — the ONLY sub-0.98 auto-merge, so it must be tight.
test('deterministicMatch: plural/punctuation aliases match on LONGER words', () => {
  assert.equal(deterministicMatch('Agents', [{ name: 'Agent' }])?.kind, 'ALIAS_OF');
  assert.equal(deterministicMatch('n8n', [{ name: 'N8N' }])?.kind, 'SAME_CONCEPT'); // case-only = same
  assert.equal(deterministicMatch('Knowledge-Graph', [{ name: 'Knowledge Graph' }])?.kind, 'ALIAS_OF'); // punctuation-normalised alias
});
test('deterministicMatch: short acronyms are NOT plural-collided (no CSS↔CS false weld)', () => {
  assert.equal(deterministicMatch('CSS', [{ name: 'CS' }]), null);
  assert.equal(deterministicMatch('APIs', [{ name: 'AP' }]), null); // "APIs"→"api" ≠ "ap"
});
test('deterministicMatch: no match → null (falls through to the model classifier)', () => {
  assert.equal(deterministicMatch('Neo4j', [{ name: 'LightRAG' }, { name: 'Honcho' }]), null);
});

// IS_A / typed-edge direction — narrower→broader. Regression guard for the direction bug the seam QA caught.
test('relationEndpoints: BROADER_THAN points matched→candidate (narrower IS_A broader)', () => {
  // "N8N BROADER_THAN N8N Workflow": N8N is broader → N8N Workflow IS_A N8N
  assert.deepEqual(relationEndpoints('BROADER_THAN', 'N8N', 'N8N Workflow'), ['N8N Workflow', 'N8N']);
});
test('relationEndpoints: NARROWER_THAN points candidate→matched (narrower IS_A broader)', () => {
  // "AI Agent NARROWER_THAN Agents": AI Agent is narrower → AI Agent IS_A Agents
  assert.deepEqual(relationEndpoints('NARROWER_THAN', 'AI Agent', 'Agents'), ['AI Agent', 'Agents']);
});
test('relationEndpoints: RELATED/SUPPORTS read candidate→matched', () => {
  assert.deepEqual(relationEndpoints('RELATED_TO', 'LightRAG', 'RAG Pipeline'), ['LightRAG', 'RAG Pipeline']);
  assert.deepEqual(relationEndpoints('SUPPORTS', 'A', 'B'), ['A', 'B']);
});

const FAKE_LENS = { enduring: [], active: ['knowledge graphs'], emerging: [], goals: [], negative_signals: [] };

// Lens-directed extraction (FR-006): shape/trim/bound candidates, skip trivially-short text, no invention.
test('extractLensDirected skips tiny text and shapes/bounds candidates (with evidence)', async () => {
  assert.deepEqual(await extractLensDirected('too short', FAKE_LENS), []);
  const src = 'Agentic Retrieval and Honcho power the system together. '.repeat(20);
  const fakeGen = async () => [
    { name: '  Agentic Retrieval  ', entity_type: 'method', description: 'x'.repeat(400), why: 'core', evidence: 'Agentic Retrieval and Honcho' },
    { description: 'no name — dropped' },
    { name: 'Honcho', evidence: 'Honcho power the system' },
  ];
  const out = await extractLensDirected(src, FAKE_LENS, { generate: fakeGen, limit: 5, maxWindows: 1 });
  assert.equal(out.length, 2);            // the nameless candidate is dropped
  assert.equal(out[0].name, 'Agentic Retrieval'); // trimmed
  assert.ok(out[0].description.length <= 300);     // bounded
  assert.equal(out[1].entity_type, 'concept');     // default type
});

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
