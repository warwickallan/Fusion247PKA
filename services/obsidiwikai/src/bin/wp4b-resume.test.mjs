import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDirectRun,
  reconstructLedgerLens,
  resumeApply,
  resumeFinish,
  resumePlan,
  resumeVerify,
  validateResumeLedger,
} from './wp4b.mjs';
import { idempotencyKey, lensFingerprint } from '../core/wp4b.mjs';

const approved = ['AI data sovereignty for sensitive client documents'];
const profile = 'wp4b-additive-v1';
const lensRow = {
  lens_id: 'lens-1',
  lens_version: '42',
  origin: 'honcho+supabase',
  enduring: ['knowledge systems'],
  active: ['LightRAG'],
  emerging: approved,
  goals: ['useful grounded answers'],
  current_projects: ['ObsidiWikAi'],
  open_questions: [],
  negative_signals: ['ungrounded action'],
  adjacent_topics: [],
};
const legacyLens = {
  lensId: 'lens-1', version: 42, origin: 'honcho+supabase',
  enduring: ['knowledge systems'], active: ['LightRAG'], emerging: approved,
  goals: ['useful grounded answers'], current_projects: ['ObsidiWikAi'],
  open_questions: [], negative_signals: ['ungrounded action'], adjacent_topics: [],
};
const fingerprint = lensFingerprint(legacyLens, approved);
const before = {
  source_id: 'source-1', file_path: 'source-1.txt', faithful_clean_sha256: 'clean-hash',
  document: { id: 'doc-1' }, entities: [], relationships: [],
  catalog: { entities: [], relationships: [] }, counts: { entities: 0, relationships: 0 },
};
const candidate = {
  kind: 'wp4b_candidate_bundle', source_id: 'source-1', file_path: 'source-1.txt',
  document_id: 'doc-1', faithful_clean_sha256: 'clean-hash', lens_fingerprint: fingerprint,
  extraction_profile_version: profile,
  chunks: [{ chunk_id: 'chunk-1' }],
  entities: [{
    name: 'Sensitive Documents', description: 'Private client material', source_ids: ['chunk-1'],
    file_paths: ['source-1.txt'],
    evidence: [{ chunk_id: 'chunk-1', start_char: 0, end_char: 20, content: 'sensitive documents' }],
  }],
  relationships: [],
};
const operation = {
  sequence: 1, operationKey: 'op-1', kind: 'entity_create',
  target: { entity: 'Sensitive Documents' },
  evidence: [{ chunk_id: 'chunk-1', start_char: 0, end_char: 20 }],
  request: { entityName: 'Sensitive Documents', entityData: {} },
};
const plan = { operations: [operation], held: [], noops: [], selection: {} };

function fixture({ state = 'held', status = 'held', canonicalPlan = null, afterState = null, receipts = [] } = {}) {
  const bundle = {
    run_id: 'run-1', source_id: 'source-1', faithful_clean_sha256: 'clean-hash',
    lens_fingerprint: fingerprint, extraction_profile_version: profile,
    approved_additions: approved, before_state: before, candidate_bundle: candidate,
    canonical_plan: canonicalPlan, after_state: afterState, status,
  };
  const run = {
    run_id: 'run-1', source_id: 'source-1', lens_id: 'lens-1', state,
    idempotency_key: idempotencyKey({
      sourceId: 'source-1', faithfulCleanSha256: 'clean-hash',
      lensFingerprint: fingerprint, extractionProfileVersion: profile,
    }),
    stats: { kind: 'wp4b', extraction_profile_version: profile },
  };
  const previousInterpretation = { interp_id: 'before-1', source_id: 'source-1', is_current: true };
  const query = async (sql) => {
    if (sql.includes('from obsidiwikai.processing_run')) return { rows: [run] };
    if (sql.includes('from obsidiwikai.wp4b_bundle')) return { rows: [bundle] };
    if (sql.includes('from obsidiwikai.interest_lens')) return { rows: [lensRow] };
    if (sql.includes('from obsidiwikai.source_interpretation')) return { rows: [previousInterpretation] };
    if (sql.includes('from obsidiwikai.wp4b_operation_receipt')) return { rows: receipts };
    if (sql.startsWith('update obsidiwikai.wp4b_bundle')) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  };
  return { run, bundle, lensRow, previousInterpretation, receipts, query };
}

const after = {
  ...before,
  catalog: {
    entities: [{
      name: 'Sensitive Documents', source_ids: ['chunk-1'], reverse_chunks: ['chunk-1'],
      vector: { source_id: 'chunk-1' }, file_paths: ['source-1.txt'],
    }],
    relationships: [],
  },
  counts: { entities: 1, relationships: 0 },
};

test('importing the CLI is side-effect free and historical lens shape matches its frozen fingerprint', () => {
  assert.equal(isDirectRun(import.meta.url, 'some-other-file.mjs'), false);
  assert.deepEqual(reconstructLedgerLens(lensRow, approved, fingerprint), legacyLens);
});

test('resume ledger rejects a non-held or already-receipted replan', () => {
  assert.throws(
    () => validateResumeLedger(fixture({ state: 'canonicalising' }), { requireHeld: true }),
    /requires held/,
  );
  assert.throws(
    () => validateResumeLedger(fixture({ receipts: [{ operation_key: 'old' }] }), { requireNoReceipts: true }),
    /no operation receipts/,
  );
});

test('resume-plan replans the frozen candidate and stores it under the same run id', async () => {
  const ledger = fixture();
  const stored = [];
  const result = await resumePlan(['run-1'], {
    query: ledger.query,
    selectCandidates: async () => ({ entityNames: ['Sensitive Documents'], relationshipPairs: [] }),
    buildPlan: async () => plan,
    storePlan: async (...args) => stored.push(args),
  });
  assert.equal(result.runId, 'run-1');
  assert.equal(result.operations, 1);
  assert.equal(stored.length, 1);
  assert.equal(stored[0][0], 'run-1');
  assert.equal(stored[0][1], candidate);
});

test('resume apply, verify and finish reuse the ledger run and frozen states', async () => {
  const appliedLedger = fixture({ state: 'canonicalising', status: 'canonicalised', canonicalPlan: plan });
  let applied;
  await resumeApply(['run-1'], {
    query: appliedLedger.query,
    apply: async (...args) => { applied = args; },
  });
  assert.equal(applied[0], 'run-1');
  assert.equal(applied[1], plan);

  const verifyLedger = fixture({ state: 'canonicalising', status: 'applied', canonicalPlan: plan });
  let storedVerification;
  const verified = await resumeVerify(['run-1', 'after.json'], {
    query: verifyLedger.query,
    readJson: () => after,
    storeVerification: async (...args) => { storedVerification = args; },
  });
  assert.equal(verified.passed, true);
  assert.equal(storedVerification[0], 'run-1');

  const finishLedger = fixture({
    state: 'canonicalising', status: 'applied', canonicalPlan: plan, afterState: after,
    receipts: [{ operation_key: 'op-1', state: 'verified' }],
  });
  let finishArgs;
  const finished = await resumeFinish(['run-1'], {
    query: finishLedger.query,
    finish: async (args) => { finishArgs = args; return { validated: true }; },
  });
  assert.deepEqual(finished, { validated: true });
  assert.equal(finishArgs.runId, 'run-1');
  assert.equal(finishArgs.previousInterpretation.interp_id, 'before-1');
  assert.deepEqual(finishArgs.lens, legacyLens);
});
