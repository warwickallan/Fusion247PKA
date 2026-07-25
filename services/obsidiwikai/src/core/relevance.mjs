// Interest-conditioned pass — score each candidate's relevance to Warwick via the lens.
// This is what makes the extraction personalised rather than a neutral transcript dump.
import { generateJSON } from './llm.mjs';
import { lensSummary } from './lens.mjs';

export function clamp01(x) { x = Number(x); return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.3; }

export async function scoreRelevance(candidates, lens) {
  const list = candidates
    .map((c, i) => `${i}. ${c.raw_name}${c.entity_type ? ` (${c.entity_type})` : ''}: ${(c.description || '').slice(0, 200)}`)
    .join('\n');
  const prompt = `You rate how relevant each knowledge concept is to a specific person, Warwick, using his interest lens. Judge relevance to HIM, not general importance.

WARWICK'S INTEREST LENS:
${lensSummary(lens)}

CONCEPTS (from one source):
${list}

For EACH concept output {"i":<index>,"relevance":<0..1>,"why":"<=12 words on why it matters to Warwick (or why not)","emerging":<true if valuable but outside his stated interests>}.
Guide: 0.8-1 directly hits an interest/goal; 0.5-0.8 adjacent/useful; 0.2-0.5 tangential; <0.2 low value.
Return ONLY a JSON array, one object per concept.`;
  const arr = await generateJSON(prompt);
  const byIndex = new Map((Array.isArray(arr) ? arr : []).map((o) => [Number(o.i), o]));
  return candidates.map((c, i) => {
    const s = byIndex.get(i) || {};
    return { ...c, relevance: clamp01(s.relevance), why: (s.why || '').slice(0, 160), emerging: !!s.emerging };
  });
}

export async function scoreRelevanceBatched(candidates, lens, size = 25) {
  const out = [];
  for (let i = 0; i < candidates.length; i += size) {
    const batch = candidates.slice(i, i + size);
    try {
      out.push(...(await scoreRelevance(batch, lens)));
    } catch (e) {
      out.push(...batch.map((c) => ({ ...c, relevance: 0.4, why: '(scoring unavailable)', emerging: false })));
    }
  }
  return out;
}
