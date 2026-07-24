// WP4 — the compounding loop. A source's interpretation under the lens at time A is stored; when
// Warwick's lens/knowledge changes, we RE-ANALYSE the retained faithful-clean source and surface the
// DELTA ("since you first learned this…") rather than re-summarise. Previous interpretation + lens
// are preserved (never silently replaced). The reliable per-source graph read comes from the report
// server's /api/source endpoint (box-side Neo4j); the lens + delta reasoning are here.
import { q } from '../clients/db.mjs';
import { buildLens } from './lens.mjs';
import { generateJSON } from './llm.mjs';
import { compareLensDelta } from './lensDelta.mjs';

const REPORT = process.env.REPORT_URL || 'http://100.101.240.85:8701';

async function sourceData(sourceId) {
  const r = await fetch(`${REPORT}/api/source/${encodeURIComponent(sourceId)}`);
  if (!r.ok) throw new Error('report /api/source -> ' + r.status);
  return r.json(); // { title, total, new:[], connected:[], why }
}
const lensObj = (l) => ({
  enduring: l.enduring || [],
  active: l.active || [],
  emerging: l.emerging || [],
  goals: l.goals || [],
  projects: l.current_projects || [],
  questions: l.open_questions || [],
  negative: l.negative_signals || [],
});
const flat = (o) => [
  ...(o.enduring || []), ...(o.active || []), ...(o.emerging || []),
  ...(o.goals || []), ...(o.projects || []), ...(o.questions || []),
];
const key = (value) => String(value || '').trim().toLowerCase();

function exactList(values, allowed, limit) {
  const byKey = new Map(allowed.map((value) => [key(value), value]));
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => byKey.get(key(value)))
    .filter(Boolean))].slice(0, limit);
}

function relationshipKey(value) {
  return [key(value?.from), key(value?.to)].sort().join('::');
}

// The model may rank and explain, but it cannot invent evidence: every noticed concept and
// relationship endpoint must be an exact concept returned by the live source graph.
export function validateInterpretation(raw, data) {
  const sourceOnly = data.new || [];
  const connected = data.connected || [];
  const all = [...new Set([...sourceOnly, ...connected])];
  const noticed = exactList(raw?.noticed_concepts, all, 18);
  const crossSource = exactList(raw?.cross_source_concepts, connected, 12);
  const allowed = new Map(all.map((value) => [key(value), value]));
  const connectedKeys = new Set(connected.map(key));
  const seenRelationships = new Set();
  const relationships = [];
  for (const item of Array.isArray(raw?.relationships) ? raw.relationships : []) {
    const from = allowed.get(key(item?.from));
    const to = allowed.get(key(item?.to));
    const relation = String(item?.relationship || '').trim().slice(0, 180);
    if (!from || !to || from === to || !relation) continue;
    if (!connectedKeys.has(key(from)) && !connectedKeys.has(key(to))) continue;
    const pair = relationshipKey({ from, to });
    if (seenRelationships.has(pair)) continue;
    seenRelationships.add(pair);
    relationships.push({ from, to, relationship: relation });
    if (relationships.length === 8) break;
  }
  return {
    summary: String(raw?.summary || data.why || '').trim().slice(0, 900),
    noticed_concepts: noticed,
    cross_source_concepts: crossSource,
    relationships,
  };
}

async function interpretSource(data, lens) {
  const currentLens = lensObj(lens);
  const prompt = `Interpret this retained source through Warwick's CURRENT interest lens. This is evidence selection, not creative writing.

SOURCE: ${data.title}
EXISTING SOURCE DESCRIPTION: ${(data.why || '(none)').slice(0, 700)}
CURRENT LENS: ${JSON.stringify(currentLens)}
CONCEPTS UNIQUE TO THIS SOURCE: ${JSON.stringify(data.new || [])}
CONCEPTS ALREADY SHARED WITH OTHER SOURCES: ${JSON.stringify(data.connected || [])}

Choose only concepts that materially matter under the current lens. A concept is newly visible only if its EXACT string appears in one of the two supplied concept lists. Relationships must connect two supplied concepts, and at least one endpoint must come from the shared-with-other-sources list. Do not claim the graph changed; explain what this lens makes worth noticing.

Return ONLY JSON:
{"summary":"2-3 plain-English sentences about what this source means through the current lens","noticed_concepts":["up to 18 exact concept strings"],"cross_source_concepts":["up to 12 exact strings from shared concepts"],"relationships":[{"from":"exact concept","to":"exact concept","relationship":"short lens-grounded relationship"}]}`;
  return validateInterpretation(await generateJSON(prompt), data);
}

// Store the current interpretation (baseline when delta=null, else a re-analysis). Prior → not-current.
export async function snapshot(sourceId, { delta = null, deltaFacets = null, data = null, lens = null, interpretation = null } = {}) {
  data ||= await sourceData(sourceId);
  lens ||= await buildLens();
  interpretation ||= await interpretSource(data, lens);
  const facets = {
    ...(deltaFacets || {}),
    interpretation,
    metrics: {
      noticed_concepts: interpretation.noticed_concepts.length,
      cross_source_concepts: interpretation.cross_source_concepts.length,
      relationships: interpretation.relationships.length,
      ...(deltaFacets?.metrics || {}),
    },
  };
  await q(`update obsidiwikai.source_interpretation set is_current=false where source_id=$1 and is_current=true`, [sourceId]);
  const r = await q(
    `insert into obsidiwikai.source_interpretation
       (source_id,lens_version,why_matters,top_concepts,cross_source,concept_count,lens_snapshot,delta,delta_facets,is_current)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,true) returning interp_id`,
    [sourceId, lens.version, interpretation.summary || data.why || '', JSON.stringify(interpretation.noticed_concepts),
     JSON.stringify(data.connected || []), data.total, JSON.stringify(lensObj(lens)),
     delta, JSON.stringify(facets)]
  );
  return {
    interpId: r.rows[0].interp_id,
    baseline: !delta,
    concepts: data.total,
    connected: (data.connected || []).length,
    interpretation,
  };
}

// Re-analyse a source under the CURRENT lens; compute + store the DELTA vs its stored interpretation.
export async function reanalyse(sourceId, { lens: providedLens = null, baselineInterpId = null, approvedAdditions: providedApprovedAdditions = null } = {}) {
  const previousSql = baselineInterpId
    ? `select * from obsidiwikai.source_interpretation where source_id=$1 and interp_id=$2 limit 1`
    : `select * from obsidiwikai.source_interpretation where source_id=$1 and is_current=true order by created_at desc limit 1`;
  const prev = (await q(previousSql, baselineInterpId ? [sourceId, baselineInterpId] : [sourceId])).rows[0];
  if (!prev && baselineInterpId) throw new Error(`baseline interpretation ${baselineInterpId} not found for ${sourceId}`);
  if (!prev) return { ...(await snapshot(sourceId)), note: 'no prior interpretation — stored baseline' };

  const data = await sourceData(sourceId);
  const lens = providedLens || await buildLens();
  const interpretation = await interpretSource(data, lens);
  const nowFlat = flat(lensObj(lens));
  const oldFlat = flat(prev.lens_snapshot || {});
  const newInterests = nowFlat.filter((x) => !oldFlat.includes(x));
  const droppedInterests = oldFlat.filter((x) => !nowFlat.includes(x));
  const newConnections = (data.connected || []).filter((c) => !(prev.cross_source || []).includes(c));
  const oldInterpretation = prev.delta_facets?.interpretation || {
    summary: prev.why_matters || '',
    noticed_concepts: prev.top_concepts || [],
    cross_source_concepts: [],
    relationships: [],
  };
  const approvedAdditions = providedApprovedAdditions || newInterests;
  const paired = approvedAdditions.length > 0
    ? await compareLensDelta(data, prev.lens_snapshot || {}, lensObj(lens), approvedAdditions)
    : { newly_visible: [], newly_visible_cross_source: [], relationships: [], runs: 0, run_counts: [] };
  const newlyVisible = paired.newly_visible;
  const newlyVisibleCrossSource = paired.newly_visible_cross_source;
  const newlyVisibleRelationships = paired.relationships;

  // grounded suggestions that cite this source's concepts
  const conceptSet = new Set([...(data.new || []), ...(data.connected || [])].map((s) => String(s).toLowerCase()));
  const sugs = (await q(`select proposed_target, recommendation, evidence from cockpit.learning_candidate where status in ('pending','accepted') order by created_at desc limit 30`)).rows;
  const relSugs = sugs.filter((s) => (s.evidence || '').toLowerCase().split(',').some((e) => conceptSet.has(e.trim()))).slice(0, 4);

  const grew = data.total - (prev.concept_count || 0);
  const lensExpansion = approvedAdditions.length > 0
    && (newlyVisible.length > 0 || newlyVisibleCrossSource.length > 0 || newlyVisibleRelationships.length > 0);
  const material = lensExpansion || newConnections.length > 0 || grew > 5;
  if (!material) {
    await snapshot(sourceId, {
      data,
      lens,
      interpretation,
      deltaFacets: {
        previous_interpretation_summary: oldInterpretation.summary || prev.why_matters || '',
        new_interests: newInterests,
    approved_interest_changes: approvedAdditions,
        approved_interest_changes: approvedAdditions,
        dropped_interests: droppedInterests,
        newly_visible_concepts: newlyVisible,
        newly_visible_cross_source_concepts: newlyVisibleCrossSource,
        newly_visible_relationships: newlyVisibleRelationships,
        paired_comparison: paired,
        lens_expansion: false,
      },
    });
    return { material: false, lensExpansion: false, note: 'no grounded lens expansion since last interpretation' };
  }

  const prompt = `You are Larry advising Warwick. He first learned the source "${data.title}" earlier. Since then his interests and knowledge graph have changed. Write a SHORT plain-English note (2-4 sentences) telling him what is DIFFERENT NOW — why this OLD source is newly relevant / newly connected / newly useful. Use phrasings like "Since you first learned this…", "This has become newly relevant because…", "Your brain now connects this to…". Ground it ONLY in the changes below; no hype.

WHY IT MATTERED THEN: ${(prev.why_matters || '(n/a)').slice(0, 400)}
WHY IT MATTERS NOW: ${(interpretation.summary || '(n/a)').slice(0, 500)}
INTERESTS NEW/STRENGTHENED SINCE: ${newInterests.join(', ') || '(none)'}
INTERESTS DROPPED SINCE: ${droppedInterests.join(', ') || '(none)'}
NEWLY VISIBLE EXACT SOURCE CONCEPTS: ${newlyVisible.join(', ') || '(none)'}
NEWLY VISIBLE KNOWN CROSS-SOURCE CONCEPTS: ${newlyVisibleCrossSource.join(', ') || '(none)'}
NEWLY VISIBLE LENS-DRIVEN RELATIONSHIPS: ${newlyVisibleRelationships.map((r) => `${r.from} → ${r.to}: ${r.relationship}`).join(' | ') || '(none)'}
NEW GRAPH CONNECTIONS SINCE THE PRIOR SNAPSHOT: ${newConnections.slice(0, 12).join(', ') || '(none)'}
NEW GROUNDED SUGGESTIONS in this source's area: ${relSugs.map((s) => s.recommendation).join(' | ') || '(none)'}

The note must use this shape: "Before, the Brain understood X. After Warwick's lens changed, it additionally noticed Y and connected it to Z." Do not imply the graph itself changed unless NEW GRAPH CONNECTIONS is non-empty.

Return ONLY JSON: {"delta":"the plain-English before/after note"}`;

  const j = (await generateJSON(prompt)) || {};
  const deltaText = (j.delta || `Before, the Brain understood ${oldInterpretation.summary || prev.why_matters || 'the source in its earlier context'}. After Warwick's lens changed, it additionally noticed ${newlyVisible.slice(0, 3).join(', ') || 'no additional grounded concepts'} and connected it to ${newlyVisibleRelationships.slice(0, 2).map((r) => `${r.from} → ${r.to}`).join(', ') || newlyVisibleCrossSource.slice(0, 3).join(', ') || 'no additional grounded relationship'}.`).slice(0, 900);
  const facets = {
    previous_interpretation_summary: oldInterpretation.summary || prev.why_matters || '',
    newly_relevant: newlyVisible,
    new_interests: newInterests,
    approved_interest_changes: approvedAdditions,
    dropped_interests: droppedInterests,
    newly_visible_concepts: newlyVisible,
    newly_visible_cross_source_concepts: newlyVisibleCrossSource,
    newly_visible_relationships: newlyVisibleRelationships,
    new_graph_connections: newConnections.slice(0, 12),
    new_suggestions: relSugs.map((s) => s.recommendation),
    paired_comparison: paired,
    lens_expansion: lensExpansion,
    metrics: {
      before_noticed_concepts: (oldInterpretation.noticed_concepts || []).length,
      after_noticed_concepts: interpretation.noticed_concepts.length,
      newly_visible_concepts: newlyVisible.length,
      before_cross_source_concepts: (oldInterpretation.cross_source_concepts || []).length,
      after_cross_source_concepts: interpretation.cross_source_concepts.length,
      newly_visible_cross_source_concepts: newlyVisibleCrossSource.length,
      before_relationships: (oldInterpretation.relationships || []).length,
      after_relationships: interpretation.relationships.length,
      newly_visible_relationships: newlyVisibleRelationships.length,
      comparison_runs: paired.runs,
      comparison_run_counts: paired.run_counts,
    },
  };
  await snapshot(sourceId, { delta: deltaText, deltaFacets: facets, data, lens, interpretation });
  return {
    material: true,
    lensExpansion,
    delta: deltaText,
    newInterests,
    newlyVisible,
    newlyVisibleCrossSource,
    newlyVisibleRelationships,
    newConnections: newConnections.length,
    newSuggestions: relSugs.length,
  };
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
