// WP1.5 — Learn-path lens-conditioning + semantic canonicalisation on the ONE authoritative
// LightRAG→Neo4j graph. Runs at the learn completion seam (a source LightRAG has just extracted),
// so Warwick's FRESH Honcho lens genuinely shapes what the Brain keeps + how it stays coherent —
// with NO second graph. It reuses the proven WP4B conservative canonicaliser (canonicaliseEntity)
// and the interest-lens relevance scorer; it only ever writes via LightRAG's native graph APIs
// (mergeEntities / createRelation). Conservative by construction:
//   - low-relevance entities are DEFERRED to a reservoir ledger (a pointer) — never deleted;
//   - genuine ambiguity is HELD for human review — never auto-merged;
//   - provenance stays on LightRAG's own nodes (source_id / file_path), which merges preserve.
import { q } from '../clients/db.mjs';
import { lightrag } from '../clients/lightrag.mjs';
import { buildLens } from './lens.mjs';
import { scoreRelevanceBatched } from './relevance.mjs';
import { generateJSON } from './llm.mjs';

export const ENRICH_LIMITS = {
  relevanceFloor: 0.35,    // below this (and not emerging) → deferred reservoir, not canonicalised
  mergeConfidence: 0.98,   // model-assisted IDENTITY auto-merge floor. Warwick policy: only deterministic
                           // aliases + genuinely corroborated ≥0.98 auto-merge; 0.85–0.979 is HELD.
  relateConfidence: 0.85,  // typed relationships are additive + reversible → a lower bar than a merge
  holdFloor: 0.85,         // similar-but-uncertain identity in [holdFloor, mergeConfidence) → held for review
  maxCanonicalise: 60,     // bound LLM cost per source
};

// FR-010 full outcome set → how each maps to a durable edge on the ONE graph. Identity outcomes
// (SAME/ALIAS) are handled as merges; the rest become TYPED relationships (never a merge).
const REL_TYPE = {
  BROADER_THAN: 'IS_A',    // candidate IS_A matched (matched is the broader concept)
  NARROWER_THAN: 'IS_A',   // reversed in apply: matched IS_A candidate
  RELATED_TO: 'RELATED_TO',
  SUPPORTS: 'SUPPORTS',
  CONTRADICTS: 'CONTRADICTS',
  SUPERSEDES: 'SUPERSEDES',
};

const norm = (s) => String(s || '').trim().toLowerCase();
const canonKey = (s) => norm(s).replace(/[^a-z0-9]+/g, '').replace(/s$/, ''); // strip punct + trailing plural

// A DETERMINISTIC alias — same name, or same after stripping punctuation/plurals. No model judgement,
// so it is always safe to auto-merge (this is the only non-≥0.98 auto-merge Warwick allows).
function deterministicMatch(name, catalog) {
  const key = norm(name);
  const exact = catalog.find((e) => norm(e.name) === key);
  if (exact) return { entity: exact, kind: 'SAME_CONCEPT' };
  const ck = canonKey(name);
  const alias = catalog.find((e) => canonKey(e.name) === ck && norm(e.name) !== key);
  if (alias) return { entity: alias, kind: 'ALIAS_OF' };
  return null;
}

// Match a candidate against the authoritative-graph catalog: lexical containment first, then a bounded
// LightRAG semantic lookup mapped back onto the catalog (surfaces same idea under different wording).
async function findMatches(candidate, catalog, client) {
  const self = norm(candidate.name);
  const pool = new Map();
  for (const e of catalog) {
    const n = norm(e.name);
    if (n !== self && (n.includes(self) || self.includes(n)) && Math.min(n.length, self.length) >= 4) pool.set(n, e);
  }
  if (pool.size < 4) {
    try {
      const data = await client.queryData(`${candidate.name}. ${String(candidate.description || '').slice(0, 200)}`,
        { mode: 'mix', topK: 8, onlyContext: true });
      const names = new Set((data?.data?.entities || data?.entities || []).map((r) => norm(r.entity_name)).filter(Boolean));
      for (const e of catalog) { const n = norm(e.name); if (n !== self && names.has(n) && !pool.has(n)) pool.set(n, e); }
    } catch { /* semantic assist is best-effort */ }
  }
  return [...pool.values()].slice(0, 6);
}

// WP1.5 one-graph canonicaliser — FULL FR-010 outcome set, against the authoritative LightRAG graph.
// Conservative by prompt: prefer a relationship over a merge when the concepts are merely connected.
export async function classifyOneGraph(candidate, catalog, { client = lightrag, generate = generateJSON } = {}) {
  const det = deterministicMatch(candidate.name, catalog);
  if (det) return { classification: det.kind, matched_name: det.entity.name, confidence: 1, deterministic: true, rationale: 'deterministic alias' };
  const matches = await findMatches(candidate, catalog, client);
  if (!matches.length) return { classification: 'NEW_CONCEPT', matched_name: null, confidence: 0.9, deterministic: false, rationale: 'no existing match' };
  const opts = matches.map((m, i) => `${i}. ${m.name}: ${(m.description || '').slice(0, 140)}`).join('\n');
  const prompt = `Classify how a NEW candidate concept relates to the CLOSEST existing concepts in a personal knowledge graph. Be conservative: do NOT merge merely-related-but-distinct concepts — over-merging corrupts the graph. PREFER a relationship (BROADER/NARROWER/RELATED) over a merge whenever the concepts are connected but not identical.

CANDIDATE: "${candidate.name}"${candidate.entity_type ? ` [${candidate.entity_type}]` : ''}
Description: ${candidate.description || '(none)'}

EXISTING CONCEPTS:
${opts}

Return ONLY JSON: {"classification":"SAME_CONCEPT|ALIAS_OF|BROADER_THAN|NARROWER_THAN|RELATED_TO|SUPPORTS|CONTRADICTS|SUPERSEDES|NEW_CONCEPT|UNCERTAIN","matched_index":<index or null>,"confidence":<0..1>,"rationale":"<=15 words"}
SAME_CONCEPT/ALIAS_OF ONLY if truly the same idea in different words. UNCERTAIN if you genuinely cannot tell.`;
  const j = await generate(prompt);
  const idx = j?.matched_index == null ? null : Number(j.matched_index);
  const matched = idx != null && matches[idx] ? matches[idx].name : null;
  return {
    classification: String(j?.classification || 'UNCERTAIN').toUpperCase(),
    matched_name: matched,
    confidence: Number(j?.confidence) || 0,
    deterministic: false,
    rationale: j?.rationale || '',
  };
}

// The conservative decision rule, pure + testable — the single point where "auto-change the graph vs
// leave it for a human" is decided. Identity: deterministic OR ≥0.98 → merge; 0.85–0.979 → HELD.
// Connected-but-distinct (FR-010): a typed relationship (additive/reversible) at ≥relateConfidence.
// Everything else (NEW / low signal) is KEPT untouched — LightRAG already holds it.
export function planAction(decision, entityName, limits = ENRICH_LIMITS) {
  const conf = decision?.confidence ?? 0;
  const cls = decision?.classification;
  if ((cls === 'SAME_CONCEPT' || cls === 'ALIAS_OF') && decision.matched_name && decision.matched_name !== entityName) {
    if (decision.deterministic || conf >= limits.mergeConfidence) return 'merge';
    if (conf >= limits.holdFloor) return 'hold';   // similar identity, not corroborated → review, never weld
    return 'keep';
  }
  if (REL_TYPE[cls] && decision.matched_name && conf >= limits.relateConfidence) return 'relate';
  if (cls === 'UNCERTAIN' && conf > 0) return 'hold';
  return 'keep';
}

// Read the authoritative graph once: full entity catalog + this source's just-extracted entities.
export async function readAuthoritativeGraph(sourceId, { maxNodes = 4000, client = lightrag } = {}) {
  const g = await client.graphs({ label: '*', maxDepth: 2, maxNodes });
  const nodes = g.nodes || [];
  const entities = nodes.map((n) => ({
    // Require a real entity name (entity_id) — never fall back to LightRAG's internal node id, which
    // is not a canonicalisable name. Malformed/nameless nodes are dropped by the .filter below.
    name: n.properties?.entity_id || '',
    entity_type: n.properties?.entity_type || 'concept',
    description: n.properties?.description || '',
    source_id: n.properties?.source_id || '',
    file_path: n.properties?.file_path || '',
  })).filter((e) => e.name);
  // LightRAG attributes a node to sources via a <SEP>-joined list of the file_source values used at
  // ingest (the permanent path ingests with the source slug as file_source, so a new source's slug is
  // exactly one token). A node can belong to several sources; membership = the slug is one of the tokens.
  const inSource = (e) => String(e.file_path || '').split('<SEP>').map((t) => t.trim()).includes(sourceId);
  return { entities, sourceEntities: entities.filter(inSource) };
}

// apply=false → OBSERVE mode: record exactly what the pass WOULD do (relevance + canonicalisation
// decisions/actions) without mutating the authoritative graph. Used to prove new logic is sane on a
// real source before any live merge/relate.
export async function enrichSource(sourceId, { lens = null, client = lightrag, limits = ENRICH_LIMITS, apply = true } = {}) {
  const runId = (await q(
    `insert into obsidiwikai.wp15_enrich_run(source_id,state) values($1,'enriching') returning run_id`,
    [sourceId],
  )).rows[0].run_id;
  try {
    lens ||= await buildLens();
    const lensVersion = lens.version ?? lens.lensId ?? null;
    const { entities, sourceEntities } = await readAuthoritativeGraph(sourceId, { client });
    if (!sourceEntities.length) {
      const stats = { note: 'no source entities matched in graph', graph_entities: entities.length };
      await q(`update obsidiwikai.wp15_enrich_run set state='completed', stats=$2, finished_at=now() where run_id=$1`,
        [runId, JSON.stringify(stats)]);
      return { runId, sourceId, sourceEntities: 0, deferred: 0, merged: 0, related: 0, held: 0, kept: 0, ...stats };
    }

    // 1) LENS-CONDITIONING — score each just-extracted entity's relevance to Warwick, THROUGH the lens.
    const scored = await scoreRelevanceBatched(
      sourceEntities.map((e) => ({ raw_name: e.name, entity_type: e.entity_type, description: e.description })),
      lens,
    );
    let deferred = 0;
    for (const s of scored) {
      const isDeferred = s.relevance < limits.relevanceFloor && !s.emerging;
      if (isDeferred) deferred++;
      await q(
        `insert into obsidiwikai.wp15_entity_relevance(run_id,source_id,entity_name,entity_type,relevance,why,emerging,deferred,lens_version)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [runId, sourceId, s.raw_name, s.entity_type || null, s.relevance, s.why || null, !!s.emerging, isDeferred, lensVersion],
      );
    }

    // 2) CANONICALISATION — for the RELEVANT entities only (the lens decides where we spend semantic
    // judgement), conservatively resolve against the authoritative graph. Catalog excludes this
    // source's own entities so we link islands rather than self-match.
    const own = new Set(sourceEntities.map((e) => e.name));
    const catalog = entities.filter((e) => !own.has(e.name));
    const relevant = scored
      .filter((s) => s.relevance >= limits.relevanceFloor || s.emerging)
      .slice(0, limits.maxCanonicalise);
    let merged = 0, related = 0, held = 0, kept = 0;
    for (const s of relevant) {
      let decision;
      try {
        decision = await classifyOneGraph({ name: s.raw_name, description: s.description || '' }, catalog, { client });
      } catch {
        decision = { classification: 'UNCERTAIN', matched_name: null, confidence: 0, rationale: 'canonicalise error' };
      }
      const plan = planAction(decision, s.raw_name, limits);
      let action = 'kept';
      try {
        if (plan === 'merge') {
          // MERGE the near-duplicate into the canonical entity — on the ONE graph, native API.
          if (apply) await client.mergeEntities([s.raw_name], decision.matched_name);
          action = 'merged'; merged++;
        } else if (plan === 'relate') {
          // FR-010: a TYPED relationship, NOT a merge. NARROWER reverses direction (matched IS_A candidate).
          const relType = REL_TYPE[decision.classification] || 'RELATED_TO';
          const [src, tgt] = decision.classification === 'NARROWER_THAN'
            ? [decision.matched_name, s.raw_name] : [s.raw_name, decision.matched_name];
          if (apply) await client.createRelation(src, tgt, {
            description: decision.rationale || `${relType} (WP1.5 lens canonicalisation)`, keywords: relType, weight: decision.confidence ?? 0,
          });
          action = 'related'; related++;
        } else if (plan === 'hold') {
          action = 'held'; held++;   // genuine ambiguity — leave BOTH entities, record for human review
        } else {
          action = 'kept'; kept++;   // NEW_CONCEPT / below threshold — LightRAG already has it, leave as-is
        }
      } catch {
        action = 'held'; held++;     // an apply failure is held, never a partial/blind graph change
      }
      await q(
        `insert into obsidiwikai.wp15_canonicalisation(run_id,source_id,entity_name,classification,matched_name,action,confidence,rationale)
         values($1,$2,$3,$4,$5,$6,$7,$8)`,
        [runId, sourceId, s.raw_name, decision.classification || 'UNCERTAIN',
          decision.matched_name || null, action, decision.confidence ?? null, decision.rationale || null],
      );
    }

    const stats = { applied: apply, source_entities: sourceEntities.length, scored: scored.length, deferred, canonicalised: relevant.length, merged, related, held, kept };
    await q(`update obsidiwikai.wp15_enrich_run set state='completed', lens_version=$2, stats=$3, finished_at=now() where run_id=$1`,
      [runId, lensVersion, JSON.stringify(stats)]);
    return { runId, sourceId, ...stats };
  } catch (e) {
    await q(`update obsidiwikai.wp15_enrich_run set state='failed', error=$2, finished_at=now() where run_id=$1`,
      [runId, String(e.message).slice(0, 500)]);
    throw e;
  }
}
