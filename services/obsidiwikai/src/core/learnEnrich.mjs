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
import { canonicaliseEntity } from './wp4b.mjs';

export const ENRICH_LIMITS = {
  relevanceFloor: 0.35,   // below this (and not emerging) → deferred reservoir, not canonicalised
  mergeConfidence: 0.85,  // conservative auto-apply threshold (matches WP4B)
  maxCanonicalise: 60,    // bound LLM cost per source
};

// The conservative decision rule, pure + testable. Only high-confidence SAME/ALIAS auto-merge (and
// never an entity onto itself); only high-confidence RELATED links; genuine ambiguity is HELD; all
// else (NEW / below threshold) is KEPT untouched — LightRAG already holds it. This is the single
// point where "auto-change the authoritative graph vs leave it for a human" is decided.
export function planAction(decision, entityName, limits = ENRICH_LIMITS) {
  const conf = decision?.confidence ?? 0;
  const cls = decision?.classification;
  if ((cls === 'SAME_CONCEPT' || cls === 'ALIAS_OF')
    && decision.canonical_name && decision.canonical_name !== entityName && conf >= limits.mergeConfidence) return 'merge';
  if (cls === 'RELATED_TO' && decision.related_to && conf >= limits.mergeConfidence) return 'relate';
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
  const inSource = (e) => e.file_path === sourceId
    || String(e.file_path).includes(sourceId) || String(e.source_id).includes(sourceId);
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
        decision = await canonicaliseEntity({ name: s.raw_name, description: s.description || '' }, catalog, { client });
      } catch {
        decision = { classification: 'UNCERTAIN', confidence: 0, rationale: 'canonicalise error' };
      }
      const plan = planAction(decision, s.raw_name, limits);
      let action = 'kept';
      try {
        if (plan === 'merge') {
          // MERGE the near-duplicate into the canonical entity — on the ONE graph, native API.
          if (apply) await client.mergeEntities([s.raw_name], decision.canonical_name);
          action = 'merged'; merged++;
        } else if (plan === 'relate') {
          if (apply) await client.createRelation(s.raw_name, decision.related_to, {
            description: decision.rationale || 'related (WP1.5 lens canonicalisation)', weight: decision.confidence ?? 0,
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
          decision.canonical_name || decision.related_to || null, action, decision.confidence ?? null, decision.rationale || null],
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
