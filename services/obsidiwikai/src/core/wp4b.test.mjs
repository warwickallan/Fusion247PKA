import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTRACTION_PROFILE_VERSION,
  buildCanonicalPlan,
  idempotencyKey,
  joinRefs,
  lensFingerprint,
  realDelta,
  selectExactCandidates,
  stableJson,
  validateBundleIdentity,
  verifyPlan,
} from './wp4b.mjs';

const evidence = (chunkId = 'chunk-new') => [{
  chunk_id: chunkId,
  start_char: 10,
  end_char: 30,
  content: 'source-grounded words',
  file_path: 'source-a',
}];

function beforeState() {
  const existing = {
    name: 'Air-Gapped Local Deployment',
    description: 'Local disconnected deployment',
    entity_type: 'Concept',
    source_ids: ['chunk-other'],
    file_paths: ['source-other'],
    reverse_chunks: ['chunk-other'],
    vector: { source_id: 'chunk-other' },
    properties: {
      description: 'Local disconnected deployment',
      entity_type: 'Concept',
      source_id: 'chunk-other',
      file_path: 'source-other',
    },
  };
  return {
    source_id: 'source-a',
    file_path: 'source-a',
    faithful_clean_sha256: 'clean-hash',
    document: { id: 'doc-a' },
    entities: [],
    relationships: [],
    counts: { chunks: 1, entities: 0, relationships: 0 },
    catalog: { entities: [existing], relationships: [] },
  };
}

function candidateBundle() {
  return {
    kind: 'wp4b_candidate_bundle',
    source_id: 'source-a',
    file_path: 'source-a',
    document_id: 'doc-a',
    faithful_clean_sha256: 'clean-hash',
    lens_fingerprint: 'lens-hash',
    extraction_profile_version: EXTRACTION_PROFILE_VERSION,
    chunks: evidence(),
    entities: [
      {
        name: 'AI Data Sovereignty',
        description: 'Control of sensitive client documents',
        entity_type: 'Concept',
        source_ids: ['chunk-new'],
        file_paths: ['source-a'],
        evidence: evidence(),
      },
      {
        name: 'Air-Gapped Local Deployment',
        description: 'Local disconnected deployment',
        entity_type: 'Concept',
        source_ids: ['chunk-new'],
        file_paths: ['source-a'],
        evidence: evidence(),
      },
    ],
    relationships: [{
      source: 'AI Data Sovereignty',
      target: 'Air-Gapped Local Deployment',
      description: 'Air-gapping provides sovereign control',
      source_ids: ['chunk-new'],
      file_paths: ['source-a'],
      evidence: evidence(),
    }],
  };
}

test('stable idempotency depends on source, clean hash, lens and extraction profile', () => {
  assert.equal(stableJson({ b: 2, a: 1 }), stableJson({ a: 1, b: 2 }));
  const first = lensFingerprint({ interests: ['privacy'] }, ['data sovereignty']);
  const second = lensFingerprint({ interests: ['privacy'] }, ['data sovereignty']);
  assert.equal(first, second);
  assert.equal(
    idempotencyKey({
      sourceId: 'source-a',
      faithfulCleanSha256: 'clean',
      lensFingerprint: first,
    }),
    `wp4b:source-a:clean:${first}:${EXTRACTION_PROFILE_VERSION}`,
  );
  assert.equal(joinRefs('a<SEP>b', ['b', 'c']), 'a<SEP>b<SEP>c');
});

test('candidate identity requires the retained source, stable document and exact frozen evidence', () => {
  assert.doesNotThrow(() => validateBundleIdentity(beforeState(), candidateBundle(), {
    sourceId: 'source-a',
    faithfulCleanSha256: 'clean-hash',
    lensFingerprint: 'lens-hash',
    extractionProfileVersion: EXTRACTION_PROFILE_VERSION,
  }));
  const bad = candidateBundle();
  bad.entities[0].evidence = [];
  assert.throws(() => validateBundleIdentity(beforeState(), bad, {
    sourceId: 'source-a',
    faithfulCleanSha256: 'clean-hash',
    lensFingerprint: 'lens-hash',
    extractionProfileVersion: EXTRACTION_PROFILE_VERSION,
  }), /exact frozen evidence/);
});

test('selection accepts exact frozen names and pairs only', () => {
  assert.deepEqual(selectExactCandidates({
    entities: ['AI Data Sovereignty', 'Invented'],
    relationships: [
      { source: 'Air-Gapped Local Deployment', target: 'AI Data Sovereignty' },
      { source: 'Invented', target: 'AI Data Sovereignty' },
    ],
  }, candidateBundle()), {
    entityNames: ['AI Data Sovereignty'],
    relationshipPairs: ['ai data sovereignty::air-gapped local deployment'],
  });
});

test('canonical plan is additive and creates a novel entity plus a relationship to existing knowledge', async () => {
  const before = beforeState();
  const candidate = candidateBundle();
  const plan = await buildCanonicalPlan(before, candidate, {
    entityNames: ['AI Data Sovereignty', 'Air-Gapped Local Deployment'],
    relationshipPairs: ['ai data sovereignty::air-gapped local deployment'],
  }, {
    client: { async queryData() { return { entities: [] }; } },
    generate: async () => ({
      classification: 'NEW_CONCEPT',
      matched_name: null,
      confidence: 0.95,
      rationale: 'distinct control concept',
    }),
  });

  assert.deepEqual(plan.operations.map((item) => item.kind), [
    'entity_evidence',
    'entity_create',
    'relation_create',
  ]);
  assert.equal(plan.operations[0].target.entity, 'Air-Gapped Local Deployment');
  assert.equal(plan.operations[1].target.entity, 'AI Data Sovereignty');
  assert.deepEqual(plan.operations[2].target, {
    source: 'AI Data Sovereignty',
    target: 'Air-Gapped Local Deployment',
  });
  assert.equal(plan.held.length, 0);
});

test('verification requires graph, reverse and vector provenance for every exact evidence chunk', async () => {
  const before = beforeState();
  const candidate = candidateBundle();
  const plan = await buildCanonicalPlan(before, candidate, {
    entityNames: ['AI Data Sovereignty', 'Air-Gapped Local Deployment'],
    relationshipPairs: ['ai data sovereignty::air-gapped local deployment'],
  }, {
    client: { async queryData() { return { entities: [] }; } },
    generate: async () => ({ classification: 'NEW_CONCEPT', confidence: 0.95 }),
  });
  const after = {
    ...before,
    counts: { chunks: 1, entities: 2, relationships: 1 },
    catalog: {
      entities: [
        {
          ...before.catalog.entities[0],
          source_ids: ['chunk-other', 'chunk-new'],
          file_paths: ['source-other', 'source-a'],
          reverse_chunks: ['chunk-other', 'chunk-new'],
          vector: { source_id: 'chunk-other<SEP>chunk-new' },
        },
        {
          name: 'AI Data Sovereignty',
          source_ids: ['chunk-new'],
          file_paths: ['source-a'],
          reverse_chunks: ['chunk-new'],
          vector: { source_id: 'chunk-new' },
        },
      ],
      relationships: [{
        source: 'AI Data Sovereignty',
        target: 'Air-Gapped Local Deployment',
        source_ids: ['chunk-new'],
        file_paths: ['source-a'],
        reverse_chunks: ['chunk-new'],
        vector: { source_id: 'chunk-new' },
      }],
    },
  };
  const verification = verifyPlan(plan, after);
  assert.equal(verification.passed, true);
  const delta = realDelta(before, after, plan, verification);
  assert.deepEqual(delta.new_entities, ['AI Data Sovereignty']);
  assert.equal(delta.new_relationships.length, 1);
  assert.equal(delta.new_cross_source_connections.length, 1);

  after.catalog.relationships[0].reverse_chunks = [];
  assert.equal(verifyPlan(plan, after).passed, false);
});
