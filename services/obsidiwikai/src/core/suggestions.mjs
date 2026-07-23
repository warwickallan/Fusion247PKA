// WP5 — grounded suggestions (FR-025/026/027). Reads the encyclopedia + lens, proposes
// self-improvement / Fusion247 / content / monetisation ideas. Every suggestion MUST cite the
// concepts it stands on, state confidence + what would invalidate it, and is a PROPOSAL only
// (no autonomous action, FR-027).
import { q } from '../clients/db.mjs';
import { rows as cyrows } from '../clients/neo4j.mjs';
import { buildLens, lensSummary } from './lens.mjs';
import { generateJSON } from './llm.mjs';

export async function generateSuggestions({ limit = 6, runId = null } = {}) {
  const lens = await buildLens();
  const concepts = await cyrows(
    `MATCH (c:OwaiConcept) WHERE c.status='accepted'
     OPTIONAL MATCH (c)-[r]->()
     RETURN c.canonical_id AS id, c.canonical_name AS name, c.type AS type, c.description AS description,
            c.evidence_count AS ev, count(r) AS deg
     ORDER BY deg DESC, ev DESC LIMIT 40`
  );
  const srcs = (await q(`select source_id, title from obsidiwikai.source`)).rows;
  const conceptList = concepts.map((c) => `- ${c.name} [${c.type}]: ${(c.description || '').slice(0, 120)}`).join('\n');

  const prompt = `You are Larry advising Warwick. Using ONLY the knowledge below (do not invent facts), propose ${limit} GROUNDED, practical suggestions spread across these kinds: self_improve (skills/learning), fusion247 (product/system improvements), content (things worth making), monetise (ways to earn from this).

WARWICK'S LENS:
${lensSummary(lens)}

KNOWLEDGE IN HIS ENCYCLOPEDIA (from ${srcs.length} sources):
${conceptList}

Rules: each suggestion MUST cite the specific concept names it is based on; give confidence 0..1; a concrete next step; and what would invalidate it. No hype, nothing ungrounded, no autonomous actions — proposals only.
Return ONLY a JSON array of {"kind":"self_improve|fusion247|content|monetise","summary":"...","cites":["concept name",...],"confidence":0..1,"benefit":"...","next_step":"...","what_invalidates":"..."}`;

  const arr = await generateJSON(prompt);
  const list = Array.isArray(arr) ? arr : [];
  const byName = new Map(concepts.map((c) => [c.name.toLowerCase(), c.id]));
  const stored = [];
  for (const s of list) {
    const ids = (s.cites || []).map((nm) => byName.get(String(nm).toLowerCase())).filter(Boolean);
    const r = await q(
      `insert into obsidiwikai.suggestion(run_id,kind,summary,evidence,confidence,benefit,next_step,what_invalidates,status)
       values($1,$2,$3,$4,$5,$6,$7,$8,'proposed') returning suggestion_id`,
      [runId, s.kind || 'self_improve', s.summary || '', JSON.stringify(ids.length ? ids : (s.cites || [])),
       Number(s.confidence) || null, s.benefit || null, s.next_step || null, s.what_invalidates || null]
    );
    stored.push({ id: r.rows[0].suggestion_id, ...s, cited_ids: ids });
  }
  return stored;
}
