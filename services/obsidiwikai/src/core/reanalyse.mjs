// WP4 — the compounding loop. A source's interpretation under the lens at time A is stored; when
// Warwick's lens/knowledge changes, we RE-ANALYSE the retained faithful-clean source and surface the
// DELTA ("since you first learned this…") rather than re-summarise. Previous interpretation + lens
// are preserved (never silently replaced). The reliable per-source graph read comes from the report
// server's /api/source endpoint (box-side Neo4j); the lens + delta reasoning are here.
import { q } from '../clients/db.mjs';
import { buildLens } from './lens.mjs';
import { generateJSON } from './llm.mjs';

const REPORT = process.env.REPORT_URL || 'http://100.101.240.85:8701';

async function sourceData(sourceId) {
  const r = await fetch(`${REPORT}/api/source/${encodeURIComponent(sourceId)}`);
  if (!r.ok) throw new Error('report /api/source -> ' + r.status);
  return r.json(); // { title, total, new:[], connected:[], why }
}
const lensObj = (l) => ({ active: l.active || [], emerging: l.emerging || [], goals: l.goals || [], negative: l.negative_signals || [] });
const flat = (o) => [...(o.active || []), ...(o.emerging || []), ...(o.goals || [])];

// Store the current interpretation (baseline when delta=null, else a re-analysis). Prior → not-current.
export async function snapshot(sourceId, { delta = null, deltaFacets = null } = {}) {
  const data = await sourceData(sourceId);
  const lens = await buildLens();
  await q(`update obsidiwikai.source_interpretation set is_current=false where source_id=$1 and is_current=true`, [sourceId]);
  const r = await q(
    `insert into obsidiwikai.source_interpretation
       (source_id,lens_version,why_matters,top_concepts,cross_source,concept_count,lens_snapshot,delta,delta_facets,is_current)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,true) returning interp_id`,
    [sourceId, lens.version, data.why || '', JSON.stringify((data.new || []).slice(0, 30)),
     JSON.stringify(data.connected || []), data.total, JSON.stringify(lensObj(lens)),
     delta, deltaFacets ? JSON.stringify(deltaFacets) : null]
  );
  return { interpId: r.rows[0].interp_id, baseline: !delta, concepts: data.total, connected: (data.connected || []).length };
}

// Re-analyse a source under the CURRENT lens; compute + store the DELTA vs its stored interpretation.
export async function reanalyse(sourceId) {
  const prev = (await q(`select * from obsidiwikai.source_interpretation where source_id=$1 and is_current=true order by created_at desc limit 1`, [sourceId])).rows[0];
  if (!prev) return { ...(await snapshot(sourceId)), note: 'no prior interpretation — stored baseline' };

  const data = await sourceData(sourceId);
  const lens = await buildLens();
  const nowFlat = flat(lensObj(lens));
  const oldFlat = flat(prev.lens_snapshot || {});
  const newInterests = nowFlat.filter((x) => !oldFlat.includes(x));
  const droppedInterests = oldFlat.filter((x) => !nowFlat.includes(x));
  const newConnections = (data.connected || []).filter((c) => !(prev.cross_source || []).includes(c));

  // grounded suggestions that cite this source's concepts
  const conceptSet = new Set([...(data.new || []), ...(data.connected || [])].map((s) => String(s).toLowerCase()));
  const sugs = (await q(`select proposed_target, recommendation, evidence from cockpit.learning_candidate where status in ('pending','accepted') order by created_at desc limit 30`)).rows;
  const relSugs = sugs.filter((s) => (s.evidence || '').toLowerCase().split(',').some((e) => conceptSet.has(e.trim()))).slice(0, 4);

  const grew = data.total - (prev.concept_count || 0);
  const material = newInterests.length > 0 || newConnections.length > 0 || relSugs.length > 0 || grew > 5;
  if (!material) { await snapshot(sourceId, {}); return { material: false, note: 'no material change since last interpretation' }; }

  const prompt = `You are Larry advising Warwick. He first learned the source "${data.title}" earlier. Since then his interests and knowledge graph have changed. Write a SHORT plain-English note (2-4 sentences) telling him what is DIFFERENT NOW — why this OLD source is newly relevant / newly connected / newly useful. Use phrasings like "Since you first learned this…", "This has become newly relevant because…", "Your brain now connects this to…". Ground it ONLY in the changes below; no hype.

WHY IT MATTERED THEN: ${(prev.why_matters || '(n/a)').slice(0, 400)}
WHY IT MATTERS NOW: ${(data.why || '(n/a)').slice(0, 400)}
INTERESTS NEW/STRENGTHENED SINCE: ${newInterests.join(', ') || '(none)'}
INTERESTS DROPPED SINCE: ${droppedInterests.join(', ') || '(none)'}
NEW CROSS-SOURCE CONNECTIONS this source now has: ${newConnections.slice(0, 12).join(', ') || '(none)'}
NEW GROUNDED SUGGESTIONS in this source's area: ${relSugs.map((s) => s.recommendation).join(' | ') || '(none)'}

Return ONLY JSON: {"delta":"the plain-english note","newly_relevant":["short phrases"]}`;

  const j = (await generateJSON(prompt)) || {};
  const deltaText = (j.delta || `Since you first learned this, your focus on ${newInterests.slice(0, 2).join(', ') || 'new areas'} and ${newConnections.length} new connection(s) make it newly relevant.`).slice(0, 900);
  const facets = { newly_relevant: j.newly_relevant || newInterests, new_interests: newInterests, dropped_interests: droppedInterests, new_connections: newConnections.slice(0, 12), new_suggestions: relSugs.map((s) => s.recommendation) };
  await snapshot(sourceId, { delta: deltaText, deltaFacets: facets });
  return { material: true, delta: deltaText, newInterests, newConnections: newConnections.length, newSuggestions: relSugs.length };
}

// Simple re-analysis trigger: sources whose stored interpretation predates a material lens change.
export async function detectStale() {
  const lens = await buildLens();
  const nowFlat = flat(lensObj(lens));
  const rows = (await q(`select source_id, lens_snapshot from obsidiwikai.source_interpretation where is_current=true`)).rows;
  return rows.filter((r) => {
    const old = flat(r.lens_snapshot || {});
    return nowFlat.some((x) => !old.includes(x)) || old.some((x) => !nowFlat.includes(x));
  }).map((r) => r.source_id);
}
