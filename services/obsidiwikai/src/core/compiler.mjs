// The Knowledge Compiler orchestrator. Consumes a source's extracted knowledge from LightRAG,
// scores it through the Warwick lens, canonicalises it into the Neo4j encyclopedia with provenance,
// and renders a Directus knowledge card. Source-keyed + idempotent per run.
import { q } from '../clients/db.mjs';
import { lightrag } from '../clients/lightrag.mjs';
import { ensureSource, encyclopediaStats, relate } from './encyclopedia.mjs';
import { buildLens } from './lens.mjs';
import { scoreRelevanceBatched } from './relevance.mjs';
import { resolveAndApply } from './canonicaliser.mjs';
import { buildCard } from './directusCard.mjs';
import { thresholds } from '../config.mjs';
import { conceptId } from './util.mjs';

export async function compileSource({ sourceId, title, url }) {
  await ensureSource({ sourceId, title, url });
  const runIns = await q(
    `insert into obsidiwikai.processing_run(source_id,state,idempotency_key,attempt)
     values($1,'received',$2,(select coalesce(max(attempt),0)+1 from obsidiwikai.processing_run where source_id=$1))
     returning run_id`,
    [sourceId, sourceId + ':' + Date.now()]
  );
  const runId = runIns.rows[0].run_id;
  const log = (...a) => console.log(`[run ${runId.slice(0, 8)}]`, ...a);

  try {
    // 1. lens
    const lens = await buildLens();
    await q(`update obsidiwikai.processing_run set lens_id=$1, state='lens_built' where run_id=$2`, [lens.lensId, runId]);
    log('lens built —', lens.active.length, 'active interests');

    // 2. broad pass — pull this source's extracted knowledge from LightRAG
    const graph = await lightrag.graphs({ label: '*', maxDepth: 3, maxNodes: 2000 });
    const all = graph.nodes || [];
    const matchSrc = all.filter((n) => (n.properties?.file_path || '') === sourceId || (n.properties?.source_id || '').includes(sourceId));
    const useNodes = matchSrc.length ? matchSrc : all; // single-source pilot store → take all
    let candidates = useNodes.map((n) => ({
      raw_name: n.properties?.entity_id || n.id,
      entity_type: n.properties?.entity_type || null,
      description: n.properties?.description || '',
      lightrag_ref: n.properties?.source_id || null,
      evidence: { source_id: n.properties?.source_id, file_path: n.properties?.file_path },
    }));
    for (const c of candidates) {
      const r = await q(
        `insert into obsidiwikai.candidate_concept(run_id,source_id,raw_name,entity_type,description,pass,lightrag_ref,evidence)
         values($1,$2,$3,$4,$5,'broad',$6,$7) returning candidate_id`,
        [runId, sourceId, c.raw_name, c.entity_type, c.description, c.lightrag_ref, JSON.stringify(c.evidence)]
      );
      c.candidate_id = r.rows[0].candidate_id;
    }
    await q(`update obsidiwikai.processing_run set state='extracting' where run_id=$1`, [runId]);
    log('broad pass —', candidates.length, 'candidate concepts');

    // 3. interest pass — relevance scoring through the lens
    candidates = await scoreRelevanceBatched(candidates, lens);
    let deferred = 0;
    for (const c of candidates) {
      await q(`update obsidiwikai.candidate_concept set relevance=$2 where candidate_id=$1`, [c.candidate_id, c.relevance]);
      if (c.relevance < thresholds.deferBelowRelevance) {
        deferred++;
        await q(
          `insert into obsidiwikai.deferred_candidate(source_id,candidate_id,raw_name,reason,lens_version,confidence)
           values($1,$2,$3,'below_relevance',$4,$5)`,
          [sourceId, c.candidate_id, c.raw_name, String(lens.version), c.relevance]
        );
      }
    }
    log('interest pass — scored;', deferred, 'to deferred reservoir');

    // 4. canonicalise + project
    await q(`update obsidiwikai.processing_run set state='canonicalising' where run_id=$1`, [runId]);
    const actions = [];
    for (const c of candidates) actions.push(await resolveAndApply(c, { runId, sourceId }));
    log('canonicalised —', summary(actions));

    // 5. relationships from LightRAG edges (best-effort, between concepts we projected)
    const relCount = await projectEdges(graph, runId, sourceId, actions);
    await q(`update obsidiwikai.processing_run set state='projected' where run_id=$1`, [runId]);
    log('projected', relCount, 'source relationships');

    // 6. card
    const stats = await encyclopediaStats();
    const card = await buildCard({ runId, sourceId, source: { title, url }, candidates, actions, stats });
    await q(`update obsidiwikai.processing_run set state='carded' where run_id=$1`, [runId]);

    // 7. complete
    const statsObj = { candidates: candidates.length, deferred, ...summaryObj(actions), encyclopedia: stats };
    await q(`update obsidiwikai.processing_run set state='completed', finished_at=now(), stats=$2 where run_id=$1`, [runId, JSON.stringify(statsObj)]);
    log('COMPLETED —', JSON.stringify(statsObj));
    return { runId, cardId: card.cardId, stats: statsObj, card };
  } catch (e) {
    await q(`update obsidiwikai.processing_run set state='failed', error=$2, finished_at=now() where run_id=$1`, [runId, String(e.message).slice(0, 500)]);
    throw e;
  }
}

async function projectEdges(graph, runId, sourceId, actions) {
  const known = new Set(actions.filter((a) => a.canonical_id).map((a) => a.name));
  const edges = graph.edges || graph.relationships || [];
  let n = 0;
  for (const e of edges) {
    const src = e.source ?? e.from ?? e.start ?? e.properties?.source;
    const tgt = e.target ?? e.to ?? e.end ?? e.properties?.target;
    if (!src || !tgt || !known.has(src) || !known.has(tgt)) continue;
    try {
      await relate(conceptId(src), conceptId(tgt), 'RELATED_TO', {
        sourceId, runId, confidence: 0.6, description: e.properties?.description || e.label || '',
      });
      n++;
    } catch { /* endpoint may be held/aliased — skip */ }
  }
  return n;
}

function summaryObj(actions) {
  const o = { created: 0, aliased: 0, held: 0, related: 0 };
  for (const a of actions) {
    if (a.action === 'created') o.created++;
    else if (a.action === 'created+related') { o.created++; o.related++; }
    else if (a.action === 'aliased') o.aliased++;
    else if (a.action === 'held_for_review') o.held++;
  }
  return o;
}
function summary(actions) {
  const o = summaryObj(actions);
  return `created ${o.created}, aliased ${o.aliased}, held ${o.held}, related ${o.related}`;
}
