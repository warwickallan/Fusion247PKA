// WP5 — grounded "so what" suggestions (FR-025/026/027). Reads the ONE live knowledge graph
// (LightRAG/Neo4j) + Warwick's interest lens, and proposes self-improve / Fusion247 / content /
// monetise ideas. Every suggestion MUST cite the concepts it stands on, state confidence + what
// would invalidate it, and is a PROPOSAL only (human-gated; no autonomous action, FR-027).
// Output lands in the Directus-visible cockpit.learning_candidate collection — the report view.
import { q } from '../clients/db.mjs';
import { lightrag } from '../clients/lightrag.mjs';
import { buildLens, lensSummary } from './lens.mjs';
import { generateJSON } from './llm.mjs';
import { enqueuePacket, deliverPacket } from './contextOutbox.mjs';

const TARGET = { self_improve: 'self_improve', fusion247: 'fusion247', content: 'content', monetise: 'monetise' };

// Exact (case-insensitive) concept match — a cite only counts as grounding if it IS one of the
// concepts we actually showed the model (mirrors the FR-029 systemImprovements exactConcept gate).
function exactConcept(value, concepts) {
  const wanted = String(value || '').trim().toLowerCase();
  if (!wanted) return null;
  return concepts.find((c) => String(c).toLowerCase() === wanted) || null;
}

// Top concepts from the live graph, ranked by connectedness (the densest, most-connected ideas).
async function topConcepts(n = 40) {
  const g = await lightrag.graphs({ label: '*', maxNodes: 1400 });
  const nodes = g.nodes || [];
  const edges = g.edges || g.relationships || [];
  const deg = {};
  for (const e of edges) {
    const a = e.source ?? e.from ?? e.start ?? e.properties?.source;
    const b = e.target ?? e.to ?? e.end ?? e.properties?.target;
    if (a) deg[a] = (deg[a] || 0) + 1;
    if (b) deg[b] = (deg[b] || 0) + 1;
  }
  return nodes
    .map((x) => ({ name: x.properties?.entity_id || x.id, type: x.properties?.entity_type || 'concept', description: x.properties?.description || '', deg: deg[x.id] || 0 }))
    .filter((c) => c.name)
    .sort((a, b) => b.deg - a.deg)
    .slice(0, n);
}

export async function generateSuggestions({ limit = 6 } = {}) {
  const lens = await buildLens();
  const concepts = await topConcepts(40);
  const conceptList = concepts.map((c) => `- ${c.name} [${c.type}]: ${(c.description || '').slice(0, 120)}`).join('\n');

  const prompt = `You are Larry advising Warwick. Using ONLY the knowledge below (do NOT invent facts), propose ${limit} GROUNDED, practical suggestions spread across these kinds: self_improve (a skill/learning), fusion247 (a product/system/service improvement), content (something worth making), monetise (a concrete way to earn from this).

WARWICK'S LENS (what he cares about):
${lensSummary(lens)}

KNOWLEDGE IN HIS BRAIN (the most-connected concepts):
${conceptList}

Rules: each suggestion MUST cite the specific concept names it is based on; give confidence 0..1; a concrete next step; and what would invalidate it. No hype, nothing ungrounded, no autonomous actions — proposals only. Prefer suggestions that combine concepts from DIFFERENT sources.
Return ONLY a JSON array of {"kind":"self_improve|fusion247|content|monetise","summary":"the recommendation","cites":["concept name",...],"confidence":0..1,"benefit":"why it matters to Warwick","next_step":"concrete first step","what_invalidates":"..."}`;

  const arr = await generateJSON(prompt);
  const list = Array.isArray(arr) ? arr : [];
  // GROUNDING GATE (GPT-003): a suggestion is only "grounded" if it cites REAL concepts from the graph
  // slice we handed the model. Validate cites by exact match and require a valid kind + confidence —
  // otherwise a model could fabricate citations and we would store them as evidence for a false
  // "grounded" claim. Ungrounded/malformed proposals are rejected, not stored.
  const conceptNames = concepts.map((c) => c.name).filter(Boolean);
  const ts = Date.now().toString(36);
  const stored = [];
  let i = 0;
  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    const kind = TARGET[s.kind];
    const confidence = Number(s.confidence);
    const cites = [...new Set((Array.isArray(s.cites) ? s.cites : [])
      .map((c) => exactConcept(c, conceptNames)).filter(Boolean))];
    if (!kind || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || cites.length === 0) continue;
    i++;
    const r = await q(
      `insert into cockpit.learning_candidate
         (build_id, source_video_id, candidate_ref, recommendation, why, evidence, proposed_target, expected_effect, confidence, risk, status, sort)
       values('IDEA-007', null, $1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
       returning id`,
      [`WP5-${ts}-${i}`, s.summary || '', s.benefit || '', cites.join(', '),
       kind, s.next_step || '', confidence,
       s.what_invalidates || '', i]
    );
    stored.push({ id: r.rows[0].id, kind, summary: s.summary, confidence, cites, next_step: s.next_step, what_invalidates: s.what_invalidates });
  }
  return stored;
}

// HUMAN-GATE LOOP — Warwick's Accept/Decline on the Directus report teaches Honcho, so the next
// suggestions + lens shift. Accepted → he wants it (preference); declined → not interested (correction).
// Idempotent: each candidate is fed once (marked via correlation_id).
export async function feedDecisions() {
  const rows = (await q(
    `select id, status, recommendation, proposed_target from cockpit.learning_candidate
     where status in ('accepted','declined') and correlation_id is null order by updated_at limit 30`
  )).rows;
  const out = [];
  for (const c of rows) {
    const accepted = c.status === 'accepted';
    const summary = `Warwick ${accepted ? 'ACCEPTED (wants to pursue)' : 'DECLINED (not interested in)'} the ${c.proposed_target} suggestion: ${c.recommendation}`.slice(0, 500);
    try {
      const id = await enqueuePacket({ type: accepted ? 'preference' : 'correction', summary, source_pointer: 'wp5-learning-candidate', idempotency_key: 'lc:' + c.id });
      if (id) { const row = (await q('select * from obsidiwikai.context_packet where packet_id=$1', [id])).rows[0]; await deliverPacket(row).catch(() => {}); }
      await q(`update cockpit.learning_candidate set correlation_id='honcho-fed', updated_at=now() where id=$1`, [c.id]);
      out.push({ id: c.id, status: c.status, fed: true });
    } catch (e) { out.push({ id: c.id, error: e.message }); }
  }
  return out;
}
