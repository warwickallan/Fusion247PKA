// WP4B — additive historical semantic re-mining.
// Retained faithful-clean source -> isolated extraction -> frozen candidate bundle ->
// canonicalise/diff -> verified additive LightRAG writes -> grounded real delta.
import { createHash } from 'node:crypto';
import { q, tx } from '../clients/db.mjs';
import { lightrag } from '../clients/lightrag.mjs';
import { generateJSON } from './llm.mjs';
import { compareLensDelta } from './lensDelta.mjs';

export const EXTRACTION_PROFILE_VERSION = 'wp4b-additive-v1';
export const SEP = '<SEP>';

const norm = (value) => String(value || '').trim().toLowerCase();
const pairKey = (a, b) => [norm(a), norm(b)].sort().join('::');
const json = (value) => JSON.stringify(value);
const uniq = (values) => [...new Set(values.filter(Boolean))];
const GENERIC_QUALIFIERS = new Set([
  'approach', 'architecture', 'concept', 'deployment', 'environment',
  'framework', 'implementation', 'local', 'method', 'model', 'process',
  'service', 'solution', 'system', 'technology',
]);

export function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function lensFingerprint(lens, approvedAdditions) {
  return sha256(stableJson({ lens, approved_additions: approvedAdditions }));
}

export function idempotencyKey({ sourceId, faithfulCleanSha256, lensFingerprint: fingerprint, extractionProfileVersion = EXTRACTION_PROFILE_VERSION }) {
  return ['wp4b', sourceId, faithfulCleanSha256, fingerprint, extractionProfileVersion].join(':');
}

export function splitRefs(value) {
  return uniq(String(value || '').split(SEP).map((item) => item.trim()).filter(Boolean));
}

export function joinRefs(...groups) {
  return uniq(groups.flatMap((group) => Array.isArray(group) ? group : splitRefs(group))).join(SEP);
}

export function evidenceFor(item) {
  return Array.isArray(item?.evidence) ? item.evidence.filter((entry) => entry?.chunk_id && Number.isInteger(entry?.start_char) && Number.isInteger(entry?.end_char)) : [];
}

export function validateCandidateBundle(bundle) {
  if (bundle?.kind !== 'wp4b_candidate_bundle') throw new Error('WP4B candidate bundle kind invalid');
  const chunkIds = new Set((bundle.chunks || []).map((chunk) => chunk.chunk_id));
  const bad = [];
  for (const item of [...(bundle.entities || []), ...(bundle.relationships || [])]) {
    const evidence = evidenceFor(item);
    if (!evidence.length || evidence.some((entry) => !chunkIds.has(entry.chunk_id))) bad.push(item.name || `${item.source}::${item.target}`);
  }
  if (bad.length) throw new Error(`WP4B candidates lack exact frozen evidence: ${bad.slice(0, 8).join(', ')}`);
  return bundle;
}

export function validateBundleIdentity(before, candidate, expected) {
  validateCandidateBundle(candidate);
  const fields = [
    ['source_id', expected.sourceId],
    ['file_path', before.file_path],
    ['document_id', before.document.id],
    ['faithful_clean_sha256', expected.faithfulCleanSha256],
    ['lens_fingerprint', expected.lensFingerprint],
    ['extraction_profile_version', expected.extractionProfileVersion],
  ];
  for (const [field, value] of fields) {
    if (candidate[field] !== value) throw new Error(`WP4B bundle identity mismatch ${field}: ${candidate[field]} != ${value}`);
  }
  if (before.faithful_clean_sha256 !== expected.faithfulCleanSha256) {
    throw new Error('WP4B retained source hash does not match authoritative full-document hash');
  }
}

function byEntityName(items) {
  return new Map(items.map((item) => [norm(item.name), item]));
}

function byRelationship(items) {
  return new Map(items.map((item) => [pairKey(item.source, item.target), item]));
}

function sourceEvidenceNew(candidate, existing) {
  const prior = new Set(existing?.source_ids || []);
  return (candidate.source_ids || []).filter((ref) => !prior.has(ref));
}

function sourcePathsNew(candidate, existing) {
  const prior = new Set(existing?.file_paths || []);
  return (candidate.file_paths || []).filter((ref) => !prior.has(ref));
}

export function selectExactCandidates(raw, candidateBundle) {
  const entities = byEntityName(candidateBundle.entities || []);
  const relationships = byRelationship(candidateBundle.relationships || []);
  return {
    entityNames: uniq((raw?.entities || []).map((name) => entities.get(norm(name))?.name).filter(Boolean)),
    relationshipPairs: uniq((raw?.relationships || []).map((item) => {
      const relation = relationships.get(pairKey(item?.source, item?.target));
      return relation ? pairKey(relation.source, relation.target) : null;
    }).filter(Boolean)),
  };
}

function lexicalTokens(value) {
  return norm(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2).map((word) => {
    if (/([a-z])\1ed$/.test(word)) return word.replace(/([a-z])\1ed$/, '$1');
    if (word.endsWith('ed') && word.length > 5) return word.slice(0, -2);
    if (word.endsWith('ing') && word.length > 6) return word.slice(0, -3);
    if (word.endsWith('s') && word.length > 4) return word.slice(0, -1);
    return word;
  });
}

function aliasKey(value) {
  return lexicalTokens(value).join(' ');
}

function exactCatalogMatch(name, catalog) {
  const key = aliasKey(name);
  return catalog.find((item) => aliasKey(item.name) === key);
}

function aliasShapedMatch(name, catalog) {
  const candidateTokens = new Set(lexicalTokens(name));
  if (!candidateTokens.size) return null;
  return catalog.find((item) => {
    const existingTokens = new Set(lexicalTokens(item.name));
    if (!existingTokens.size || aliasKey(item.name) === aliasKey(name)) return false;
    const smaller = candidateTokens.size <= existingTokens.size ? candidateTokens : existingTokens;
    const larger = candidateTokens.size <= existingTokens.size ? existingTokens : candidateTokens;
    if (![...smaller].every((token) => larger.has(token))) return false;
    const extras = [...larger].filter((token) => !smaller.has(token));
    return extras.length > 0 && extras.every((token) => GENERIC_QUALIFIERS.has(token));
  }) || null;
}

function candidateRanking(before, candidateBundle, approvedAdditions, advisory) {
  const sourcePrior = new Set((before.entities || []).map((item) => aliasKey(item.name)));
  const catalog = before.catalog?.entities || before.entities || [];
  const candidates = (candidateBundle.entities || [])
    .filter((item) => !sourcePrior.has(aliasKey(item.name)) && evidenceFor(item).length);
  const documents = candidates.map((item) => new Set(lexicalTokens(`${item.name} ${item.description || ''}`)));
  const frequencies = new Map();
  for (const tokens of documents) {
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }
  const lensTokens = new Set(lexicalTokens((approvedAdditions || []).join(' ')));
  const advisoryEntities = new Set((advisory.entityNames || []).map(norm));
  const advisoryRelationships = new Set(advisory.relationshipPairs || []);
  const relationships = (candidateBundle.relationships || []).filter((item) => evidenceFor(item).length);
  const ranked = candidates.map((item) => {
    const nameTokens = new Set(lexicalTokens(item.name));
    const descriptionTokens = new Set(lexicalTokens(item.description || ''));
    const evidenceTokens = new Set(lexicalTokens(evidenceFor(item).map((entry) => entry.content || '').join(' ')));
    const direct = [...nameTokens].filter((token) => lensTokens.has(token)).length;
    const contextual = [...descriptionTokens].filter((token) => lensTokens.has(token)).length;
    const grounded = [...nameTokens].filter((token) => evidenceTokens.has(token)).length;
    const groundedLens = [...lensTokens].filter((token) => evidenceTokens.has(token)).length;
    const rarity = [...nameTokens].reduce((sum, token) => sum + Math.log((candidates.length + 1) / ((frequencies.get(token) || 0) + 1)), 0);
    const exact = exactCatalogMatch(item.name, catalog);
    const aliasShaped = aliasShapedMatch(item.name, catalog);
    const safeRelationships = relationships.filter((relation) => {
      const other = norm(relation.source) === norm(item.name) ? relation.target
        : norm(relation.target) === norm(item.name) ? relation.source : null;
      return other && exactCatalogMatch(other, catalog);
    });
    const advisoryRelation = safeRelationships.some((relation) => advisoryRelationships.has(pairKey(relation.source, relation.target)));
    const broad = nameTokens.size <= 2 && rarity < 1.25 && direct < 2;
    const score = (direct * 12) + (contextual * 3) + (grounded * 2)
      + Math.min(groundedLens, 4) + (rarity * 2) + (safeRelationships.length ? 10 : 0)
      + (advisoryEntities.has(norm(item.name)) ? 2 : 0) + (advisoryRelation ? 1 : 0)
      - (exact ? 5 : 0) - (broad ? 10 : 0);
    return { item, score, direct, grounded, aliasShaped, safeRelationships };
  }).filter((entry) => !entry.aliasShaped && entry.direct > 0 && entry.grounded > 0)
    .sort((a, b) => b.score - a.score || String(a.item.name).localeCompare(String(b.item.name)));
  const winner = ranked[0];
  if (!winner || winner.score < 12) return { entityNames: [], relationshipPairs: [] };
  const safeRelationship = winner.safeRelationships
    .map((item) => ({ item, advisory: advisoryRelationships.has(pairKey(item.source, item.target)) }))
    .sort((a, b) => Number(b.advisory) - Number(a.advisory)
      || String(pairKey(a.item.source, a.item.target)).localeCompare(pairKey(b.item.source, b.item.target)))[0]?.item;
  return {
    entityNames: [winner.item.name],
    relationshipPairs: safeRelationship ? [pairKey(safeRelationship.source, safeRelationship.target)] : [],
  };
}

export async function selectLensExpansionCandidates(before, candidateBundle, approvedAdditions, { generate = generateJSON } = {}) {
  const priorEntities = new Set((before.entities || []).map((item) => norm(item.name)));
  const priorRelationships = new Set((before.relationships || []).map((item) => pairKey(item.source, item.target)));
  const newEntities = (candidateBundle.entities || [])
    .filter((item) => !priorEntities.has(norm(item.name)))
    .map((item) => ({
      name: item.name,
      description: String(item.description || '').slice(0, 300),
      evidence: evidenceFor(item).slice(0, 2).map((entry) => entry.content.slice(0, 500)),
    }));
  const newRelationships = (candidateBundle.relationships || [])
    .filter((item) => !priorRelationships.has(pairKey(item.source, item.target)))
    .map((item) => ({
      source: item.source,
      target: item.target,
      description: String(item.description || '').slice(0, 300),
      evidence: evidenceFor(item).slice(0, 2).map((entry) => entry.content.slice(0, 500)),
    }));
  const prompt = `Select only genuinely source-grounded semantic expansion caused by Warwick's APPROVED new interests.
This is a conservative gate before authoritative graph mutation. Exact names/pairs only. Broad re-extraction may vary;
do not select an item merely because wording changed. Select at most 12 entities and 12 relationships.

APPROVED INTEREST ADDITIONS: ${JSON.stringify(approvedAdditions)}
ENTITIES ABSENT FROM THIS SOURCE'S PRIOR CONTRIBUTION: ${JSON.stringify(newEntities)}
RELATIONSHIPS ABSENT FROM THIS SOURCE'S PRIOR CONTRIBUTION: ${JSON.stringify(newRelationships)}

An item qualifies only when its quoted source passage materially supports it and the approved addition explains why it
was newly noticed. Empty arrays are correct. Return ONLY JSON:
{"entities":["exact entity name"],"relationships":[{"source":"exact endpoint","target":"exact endpoint"}]}`;
  const advisory = selectExactCandidates(await generate(prompt), candidateBundle);
  return candidateRanking(before, candidateBundle, approvedAdditions, advisory);
}

function lexicalMatches(candidate, catalog, limit = 12) {
  const words = new Set(lexicalTokens(candidate.name));
  return catalog.map((item) => {
    const hay = new Set(lexicalTokens(`${item.name} ${item.description}`));
    const overlap = [...words].filter((word) => hay.has(word)).length;
    return { item, overlap };
  }).filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || String(a.item.name).localeCompare(String(b.item.name)))
    .slice(0, limit).map((entry) => entry.item);
}

export async function canonicaliseEntity(candidate, catalogEntities, {
  client = lightrag,
  generate = generateJSON,
} = {}) {
  const exact = catalogEntities.find((item) => norm(item.name) === norm(candidate.name));
  if (exact) return { classification: 'SAME_CONCEPT', canonical_name: exact.name, confidence: 1, rationale: 'exact canonical name' };
  const normalizedAlias = exactCatalogMatch(candidate.name, catalogEntities);
  if (normalizedAlias) {
    return { classification: 'ALIAS_OF', canonical_name: normalizedAlias.name, confidence: 1, rationale: 'exact normalized alias' };
  }
  const aliasShaped = aliasShapedMatch(candidate.name, catalogEntities);
  if (aliasShaped) {
    return { classification: 'UNCERTAIN', canonical_name: null, confidence: 0, rationale: `alias-shaped duplicate of ${aliasShaped.name}` };
  }
  let retrieved = [];
  try {
    const data = await client.queryData(`${candidate.name}. ${String(candidate.description || '').slice(0, 240)}`, { mode: 'mix', topK: 8 });
    const rows = data?.data?.entities || data?.entities || [];
    const names = new Set(rows.map((row) => norm(row.entity_name)).filter(Boolean));
    retrieved = catalogEntities.filter((item) => names.has(norm(item.name))).slice(0, 6);
  } catch { /* lexical fallback below */ }
  const matches = uniq([...retrieved, ...lexicalMatches(candidate, catalogEntities)].map((item) => item.name))
    .map((name) => catalogEntities.find((item) => item.name === name)).filter(Boolean).slice(0, 6);
  if (!matches.length) return { classification: 'NEW_CONCEPT', canonical_name: candidate.name, confidence: 0.9, rationale: 'no authoritative semantic candidate' };
  const prompt = `Conservatively canonicalise one source-grounded concept against an existing knowledge graph.
Do not merge related-but-distinct concepts.

CANDIDATE: ${JSON.stringify({ name: candidate.name, description: candidate.description })}
EXISTING: ${JSON.stringify(matches.map((item) => ({ name: item.name, description: item.description, type: item.entity_type })))}

Return ONLY JSON:
{"classification":"SAME_CONCEPT|ALIAS_OF|RELATED_TO|NEW_CONCEPT|UNCERTAIN","matched_name":"exact existing name or null","confidence":0.0,"rationale":"short"}`;
  const raw = await generate(prompt);
  const matched = matches.find((item) => norm(item.name) === norm(raw?.matched_name));
  const classification = String(raw?.classification || 'UNCERTAIN').toUpperCase();
  const confidence = Number(raw?.confidence) || 0;
  if (['SAME_CONCEPT', 'ALIAS_OF'].includes(classification) && matched && confidence >= 0.85) {
    return { classification, canonical_name: matched.name, confidence, rationale: raw.rationale || '' };
  }
  if (classification === 'NEW_CONCEPT' && confidence >= 0.85) {
    return { classification, canonical_name: candidate.name, confidence, rationale: raw.rationale || '' };
  }
  if (classification === 'RELATED_TO' && matched && confidence >= 0.85) {
    return { classification, canonical_name: candidate.name, related_to: matched.name, confidence, rationale: raw.rationale || '' };
  }
  return { classification: 'UNCERTAIN', canonical_name: null, confidence, rationale: raw?.rationale || 'below auto-apply threshold' };
}

export async function buildCanonicalPlan(before, candidateBundle, selection, options = {}) {
  const catalog = before.catalog || { entities: before.entities || [], relationships: before.relationships || [] };
  const catalogEntities = catalog.entities || [];
  const catalogEntityMap = byEntityName(catalogEntities);
  const catalogRelationships = catalog.relationships || [];
  const catalogRelationshipMap = byRelationship(catalogRelationships);
  const candidateEntityMap = byEntityName(candidateBundle.entities || []);
  const candidateRelationshipMap = byRelationship(candidateBundle.relationships || []);
  const decisions = new Map();
  const held = [];
  const noops = [];
  const operations = [];

  for (const name of selection.entityNames || []) {
    const candidate = candidateEntityMap.get(norm(name));
    if (!candidate || !evidenceFor(candidate).length) continue;
    const decision = await canonicaliseEntity(candidate, catalogEntities, options);
    decisions.set(norm(candidate.name), decision);
    if (decision.classification === 'UNCERTAIN') {
      held.push({ kind: 'entity', candidate: candidate.name, ...decision });
      continue;
    }
    const existing = catalogEntityMap.get(norm(decision.canonical_name));
    const refs = sourceEvidenceNew(candidate, existing);
    const paths = sourcePathsNew(candidate, existing);
    if (existing && !refs.length) {
      noops.push({ kind: 'entity', candidate: candidate.name, canonical_name: existing.name, reason: 'same evidence already represented' });
      continue;
    }
    if (existing) {
      operations.push({
        kind: 'entity_evidence',
        target: { entity: existing.name, candidate: candidate.name },
        preImage: existing.properties,
        evidence: evidenceFor(candidate).filter((entry) => refs.includes(entry.chunk_id)),
        request: {
          entityName: existing.name,
          updatedData: {
            source_id: joinRefs(existing.source_ids, refs),
            file_path: joinRefs(existing.file_paths, paths),
          },
        },
        canonicalisation: decision,
      });
    } else {
      operations.push({
        kind: 'entity_create',
        target: { entity: candidate.name },
        preImage: null,
        evidence: evidenceFor(candidate),
        request: {
          entityName: candidate.name,
          entityData: {
            description: candidate.description,
            entity_type: candidate.entity_type || 'Concept',
            source_id: joinRefs(candidate.source_ids),
            file_path: joinRefs(candidate.file_paths),
          },
        },
        canonicalisation: decision,
      });
    }
  }

  const resolveEndpoint = (name) => {
    const decision = decisions.get(norm(name));
    if (decision?.canonical_name) return decision.canonical_name;
    return catalogEntityMap.get(norm(name))?.name || exactCatalogMatch(name, catalogEntities)?.name || null;
  };

  for (const relationPair of selection.relationshipPairs || []) {
    const candidate = candidateRelationshipMap.get(relationPair);
    if (!candidate || !evidenceFor(candidate).length) continue;
    const source = resolveEndpoint(candidate.source);
    const target = resolveEndpoint(candidate.target);
    if (!source || !target || norm(source) === norm(target)) {
      held.push({ kind: 'relationship', candidate: `${candidate.source}::${candidate.target}`, reason: 'endpoint not confidently canonicalised' });
      continue;
    }
    const existing = catalogRelationshipMap.get(pairKey(source, target));
    const writeSource = existing?.source || source;
    const writeTarget = existing?.target || target;
    const refs = sourceEvidenceNew(candidate, existing);
    const paths = sourcePathsNew(candidate, existing);
    if (existing && !refs.length) {
      noops.push({ kind: 'relationship', source, target, reason: 'same evidence already represented' });
      continue;
    }
    if (existing) {
      operations.push({
        kind: 'relation_evidence',
        target: { source: writeSource, target: writeTarget },
        preImage: existing.properties,
        evidence: evidenceFor(candidate).filter((entry) => refs.includes(entry.chunk_id)),
        request: {
          sourceEntity: writeSource,
          targetEntity: writeTarget,
          updatedData: {
            source_id: joinRefs(existing.source_ids, refs),
            file_path: joinRefs(existing.file_paths, paths),
          },
        },
      });
    } else {
      operations.push({
        kind: 'relation_create',
        target: { source, target },
        preImage: null,
        evidence: evidenceFor(candidate),
        request: {
          sourceEntity: source,
          targetEntity: target,
          relationData: {
            description: candidate.description,
            keywords: candidate.keywords || 'source-grounded,wp4b',
            weight: Number(candidate.weight) || 1,
            source_id: joinRefs(candidate.source_ids),
            file_path: joinRefs(candidate.file_paths),
          },
        },
      });
    }
  }

  const ordered = [
    ...operations.filter((op) => op.kind === 'entity_evidence'),
    ...operations.filter((op) => op.kind === 'entity_create'),
    ...operations.filter((op) => op.kind === 'relation_evidence'),
    ...operations.filter((op) => op.kind === 'relation_create'),
  ].map((operation, index) => ({
    ...operation,
    sequence: index + 1,
    operationKey: sha256(stableJson({ kind: operation.kind, target: operation.target, request: operation.request })),
  }));
  return { operations: ordered, held, noops, selection };
}

export function verifyPlan(plan, after) {
  const entities = byEntityName(after.catalog?.entities || after.entities || []);
  const relationships = byRelationship(after.catalog?.relationships || after.relationships || []);
  const results = [];
  for (const operation of plan.operations || []) {
    const required = uniq(operation.evidence.map((entry) => entry.chunk_id));
    let record;
    if (operation.kind.startsWith('entity_')) record = entities.get(norm(operation.target.entity));
    else record = relationships.get(pairKey(operation.target.source, operation.target.target));
    const graphRefs = new Set(record?.source_ids || []);
    const reverseRefs = new Set(record?.reverse_chunks || []);
    const vectorRefs = new Set(splitRefs(record?.vector?.source_id));
    const verification = {
      exists: Boolean(record),
      graph_provenance: required.every((ref) => graphRefs.has(ref)),
      reverse_provenance: required.every((ref) => reverseRefs.has(ref)),
      vector_provenance: required.every((ref) => vectorRefs.has(ref)),
      exact_spans: operation.evidence.every((entry) => Number.isInteger(entry.start_char) && entry.end_char > entry.start_char),
    };
    results.push({ operationKey: operation.operationKey, target: operation.target, passed: Object.values(verification).every(Boolean), verification });
  }
  return { passed: results.every((item) => item.passed), operations: results };
}

export function realDelta(before, after, plan, verification) {
  const newEntities = (plan.operations || []).filter((op) => op.kind === 'entity_create').map((op) => op.target.entity);
  const newEvidence = (plan.operations || []).filter((op) => op.kind.endsWith('_evidence')).map((op) => ({
    kind: op.kind,
    target: op.target,
    chunk_ids: uniq(op.evidence.map((entry) => entry.chunk_id)),
  }));
  const newRelationships = (plan.operations || []).filter((op) => op.kind === 'relation_create').map((op) => ({
    source: op.target.source,
    target: op.target.target,
    description: op.request.relationData.description,
  }));
  const beforeSourceEntities = new Set((before.entities || []).map((item) => norm(item.name)));
  const newCrossSourceConnections = newRelationships.filter((relation) => {
    const other = (after.catalog?.entities || []).filter((item) => [norm(relation.source), norm(relation.target)].includes(norm(item.name)));
    return other.some((item) => item.file_paths.some((path) => path !== after.file_path) || beforeSourceEntities.has(norm(item.name)));
  });
  return {
    verified: verification.passed,
    new_entities: newEntities,
    new_relationships: newRelationships,
    new_evidence: newEvidence,
    new_cross_source_connections: newCrossSourceConnections,
    unchanged_entities: (before.entities || []).length,
    before_counts: before.counts,
    after_counts: after.counts,
  };
}

async function recordReceipt(runId, operation, query = q) {
  await query(
    `insert into obsidiwikai.wp4b_operation_receipt
       (run_id,sequence,operation_key,operation_kind,target,pre_image,request)
     values($1,$2,$3,$4,$5,$6,$7)
     on conflict (run_id,operation_key) do nothing`,
    [runId, operation.sequence, operation.operationKey, operation.kind, json(operation.target),
     operation.preImage ? json(operation.preImage) : null, json(operation.request)]
  );
}

async function receiptState(runId, operationKey, query = q) {
  return (await query(
    `select * from obsidiwikai.wp4b_operation_receipt where run_id=$1 and operation_key=$2`,
    [runId, operationKey]
  )).rows[0];
}

async function markApplied(runId, operation, response, query = q) {
  await query(
    `update obsidiwikai.wp4b_operation_receipt
     set state='applied',response=$3,applied_at=coalesce(applied_at,now()),error=null
     where run_id=$1 and operation_key=$2`,
    [runId, operation.operationKey, json(response)]
  );
}

export async function applyPlan(runId, plan, { client = lightrag, query = q } = {}) {
  await query(`update obsidiwikai.wp4b_bundle set status='applying',updated_at=now() where run_id=$1`, [runId]);
  for (const operation of plan.operations || []) await recordReceipt(runId, operation, query);
  for (const operation of plan.operations || []) {
    const prior = await receiptState(runId, operation.operationKey, query);
    if (prior?.state === 'verified') continue;
    try {
      if (operation.kind === 'entity_evidence') {
        if (prior?.state !== 'applied') {
          const response = await client.editEntity(operation.request.entityName, operation.request.updatedData);
          await markApplied(runId, operation, response, query);
        }
      } else if (operation.kind === 'entity_create') {
        const priorResponse = prior?.state === 'rolled_back' ? null : prior?.response;
        let created = priorResponse?.created;
        let backfilled = priorResponse?.backfilled;
        if (!created) {
          created = await client.createEntity(operation.request.entityName, operation.request.entityData);
          await markApplied(runId, operation, { created }, query);
        }
        if (!backfilled) {
          backfilled = await client.editEntity(operation.request.entityName, {
            source_id: operation.request.entityData.source_id,
            file_path: operation.request.entityData.file_path,
          });
          await markApplied(runId, operation, { created, backfilled }, query);
        }
      } else if (operation.kind === 'relation_evidence') {
        if (prior?.state !== 'applied') {
          const response = await client.editRelation(operation.request.sourceEntity, operation.request.targetEntity, operation.request.updatedData);
          await markApplied(runId, operation, response, query);
        }
      } else if (operation.kind === 'relation_create') {
        const priorResponse = prior?.state === 'rolled_back' ? null : prior?.response;
        let created = priorResponse?.created;
        let backfilled = priorResponse?.backfilled;
        if (!created) {
          created = await client.createRelation(operation.request.sourceEntity, operation.request.targetEntity, operation.request.relationData);
          await markApplied(runId, operation, { created }, query);
        }
        if (!backfilled) {
          backfilled = await client.editRelation(operation.request.sourceEntity, operation.request.targetEntity, {
            source_id: operation.request.relationData.source_id,
            file_path: operation.request.relationData.file_path,
          });
          await markApplied(runId, operation, { created, backfilled }, query);
        }
      }
    } catch (error) {
      await query(
        `update obsidiwikai.wp4b_operation_receipt set state='failed',error=$3 where run_id=$1 and operation_key=$2`,
        [runId, operation.operationKey, String(error.message).slice(0, 1200)]
      );
      throw error;
    }
  }
  await query(`update obsidiwikai.wp4b_bundle set status='applied',updated_at=now() where run_id=$1`, [runId]);
}

export async function storeVerification(runId, verification) {
  for (const item of verification.operations) {
    await q(
      `update obsidiwikai.wp4b_operation_receipt
       set state=case when $3 then 'verified' else 'failed' end,verification=$4,verified_at=case when $3 then now() else verified_at end
       where run_id=$1 and operation_key=$2`,
      [runId, item.operationKey, item.passed, json(item.verification)]
    );
  }
}

export async function rollbackPlan(runId, plan, { client = lightrag } = {}) {
  const receipts = (await q(
    `select * from obsidiwikai.wp4b_operation_receipt where run_id=$1 and state in ('applied','verified','failed') order by sequence desc`,
    [runId]
  )).rows;
  const byKey = new Map(receipts.map((row) => [row.operation_key, row]));
  const results = [];
  for (const operation of [...(plan.operations || [])].reverse()) {
    const receipt = byKey.get(operation.operationKey);
    if (!receipt || (!receipt.response && receipt.state === 'failed')) continue;
    try {
      let response;
      if (operation.kind === 'relation_create') {
        response = await client.deleteRelation(operation.target.source, operation.target.target);
      } else if (operation.kind === 'entity_create') {
        response = await client.deleteEntity(operation.target.entity);
      } else if (operation.kind === 'relation_evidence') {
        response = await client.editRelation(operation.target.source, operation.target.target, operation.preImage);
      } else if (operation.kind === 'entity_evidence') {
        response = await client.editEntity(operation.target.entity, operation.preImage);
      }
      await q(
        `update obsidiwikai.wp4b_operation_receipt set state='rolled_back',rollback=$3 where run_id=$1 and operation_key=$2`,
        [runId, operation.operationKey, json(response)]
      );
      results.push({ operationKey: operation.operationKey, rolledBack: true });
    } catch (error) {
      await q(
        `update obsidiwikai.wp4b_operation_receipt set error=coalesce(error,'')||$3 where run_id=$1 and operation_key=$2`,
        [runId, operation.operationKey, ` | rollback failed: ${String(error.message).slice(0, 500)}`]
      );
      results.push({ operationKey: operation.operationKey, rolledBack: false, error: error.message });
    }
  }
  await q(`update obsidiwikai.wp4b_bundle set status='rolled_back',updated_at=now() where run_id=$1`, [runId]);
  return results;
}

export async function beginRun({
  sourceId,
  title,
  rawRef,
  faithfulCleanSha256,
  lens,
  approvedAdditions,
  before,
  extractionProfileVersion = EXTRACTION_PROFILE_VERSION,
}) {
  const fingerprint = lensFingerprint(lens, approvedAdditions);
  const key = idempotencyKey({
    sourceId, faithfulCleanSha256, lensFingerprint: fingerprint, extractionProfileVersion,
  });
  return tx(async (client) => {
    await client.query(
      `insert into obsidiwikai.source(source_id,title,raw_ref,last_seen)
       values($1,$2,$3,now())
       on conflict (source_id) do update set
         title=coalesce(excluded.title,obsidiwikai.source.title),
         raw_ref=coalesce(excluded.raw_ref,obsidiwikai.source.raw_ref),last_seen=now()`,
      [sourceId, title || null, rawRef || null]
    );
    const existing = (await client.query(
      `select * from obsidiwikai.processing_run where idempotency_key=$1`,
      [key]
    )).rows[0];
    if (existing) {
      const bundle = (await client.query(`select * from obsidiwikai.wp4b_bundle where run_id=$1`, [existing.run_id])).rows[0];
      return { runId: existing.run_id, idempotencyKey: key, lensFingerprint: fingerprint, existing: true, state: existing.state, bundle };
    }
    const run = (await client.query(
      `insert into obsidiwikai.processing_run(source_id,lens_id,state,idempotency_key,stats)
       values($1,$2,'extracting',$3,$4) returning run_id`,
      [sourceId, lens.lensId || null, key, json({ kind: 'wp4b', extraction_profile_version: extractionProfileVersion })]
    )).rows[0];
    await client.query(
      `insert into obsidiwikai.wp4b_bundle
       (run_id,source_id,faithful_clean_sha256,lens_fingerprint,extraction_profile_version,approved_additions,before_state)
       values($1,$2,$3,$4,$5,$6,$7)`,
      [run.run_id, sourceId, faithfulCleanSha256, fingerprint, extractionProfileVersion, json(approvedAdditions), json(before)]
    );
    return { runId: run.run_id, idempotencyKey: key, lensFingerprint: fingerprint, existing: false };
  });
}

export async function storeCandidateAndPlan(runId, candidateBundle, plan) {
  await q(
    `update obsidiwikai.wp4b_bundle set candidate_bundle=$2,canonical_plan=$3,status='canonicalised',
       temp_workspace_retired_at=now(),updated_at=now() where run_id=$1`,
    [runId, json(candidateBundle), json(plan)]
  );
  await q(`update obsidiwikai.processing_run set state='canonicalising' where run_id=$1`, [runId]);
}

export async function finishRun({
  runId,
  sourceId,
  before,
  after,
  plan,
  lens,
  approvedAdditions,
  previousInterpretation,
}) {
  const verification = verifyPlan(plan, after);
  await storeVerification(runId, verification);
  const delta = realDelta(before, after, plan, verification);
  if (!verification.passed) throw new Error('WP4B authoritative provenance verification failed');
  const connected = uniq(delta.new_cross_source_connections.flatMap((item) => [item.source, item.target]));
  const validatorData = {
    title: before.document?.file_path || sourceId,
    new: delta.new_entities,
    connected,
  };
  const validator = await compareLensDelta(
    validatorData,
    previousInterpretation?.lens_snapshot || {},
    lens,
    approvedAdditions,
  );
  const validated = validator.newly_visible.length > 0
    && (validator.relationships.length > 0 || validator.newly_visible_cross_source.length > 0);
  const beforeMeaning = previousInterpretation?.why_matters || 'its previously extracted knowledge';
  const noticed = validator.newly_visible.join(', ');
  const linked = validator.relationships.map((item) => `${item.from} → ${item.to}`).join(', ')
    || validator.newly_visible_cross_source.join(', ');
  const deltaText = `Before, the Brain understood ${beforeMeaning}. After Warwick's lens changed, it additionally noticed ${noticed || 'no consistently validated new concept'} and connected it to ${linked || 'no consistently validated cross-source relationship'}.`;
  await tx(async (client) => {
    await client.query(
      `update obsidiwikai.wp4b_bundle set after_state=$2,real_delta=$3,validator_result=$4,
         status=$5,updated_at=now() where run_id=$1`,
      [runId, json(after), json(delta), json(validator), validated ? 'validated' : 'held']
    );
    await client.query(
      `update obsidiwikai.processing_run set state=$2,stats=stats||$3::jsonb,finished_at=now()
       where run_id=$1`,
      [runId, validated ? 'completed' : 'held', json({ wp4b_verified: true, wp4b_validated: validated, delta })]
    );
    if (validated) {
      await client.query(
        `update obsidiwikai.source_interpretation set is_current=false where source_id=$1 and is_current=true`,
        [sourceId]
      );
      await client.query(
        `insert into obsidiwikai.source_interpretation
         (source_id,lens_version,why_matters,top_concepts,cross_source,concept_count,lens_snapshot,delta,delta_facets,is_current)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
        [sourceId, lens.version, deltaText, json(validator.newly_visible), json(connected),
         after.counts?.entities || null, json(lens), deltaText,
         json({ mode: 'WP4B', real_delta: delta, validator, plan_summary: {
           operations: plan.operations.length, held: plan.held.length, noops: plan.noops.length,
         } })]
      );
    }
  });
  return { validated, verification, delta, validator, deltaText };
}
