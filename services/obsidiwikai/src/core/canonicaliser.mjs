// The canonicaliser — the invented gem. For each candidate concept it searches the existing
// encyclopedia, classifies the relationship (same/alias/broader/narrower/related/…), and either
// applies it automatically (confident) or raises a one-tap Directus review (uncertain).
import { searchConcepts, createConcept, addAlias, addEvidence, relate, linkSource } from './encyclopedia.mjs';
import { generateJSON } from './llm.mjs';
import { lightrag } from '../clients/lightrag.mjs';
import { q } from '../clients/db.mjs';
import { thresholds } from '../config.mjs';

// Find match candidates for a concept: lexical (Neo4j name/alias) first, then SEMANTIC
// (LightRAG retrieval surfaces related concepts under different wording, e.g. "LLM" -> "GPT"),
// mapped back to our encyclopedia. Excludes the concept's own exact node so we link islands
// rather than self-match. Semantic lookup is gated on relevance to bound cost.
export async function findMatches(cand) {
  const self = String(cand.raw_name).toLowerCase();
  const lex = (await searchConcepts(cand.raw_name, thresholds.matchCandidates)).filter((m) => m.canonical_name.toLowerCase() !== self);
  const pool = [...lex];
  const wantSemantic = (cand.relevance == null || cand.relevance >= 0.5) && lex.length < 3;
  if (wantSemantic) {
    try {
      const qd = await lightrag.queryData(`${cand.raw_name}. ${(cand.description || '').slice(0, 160)}`, { mode: 'mix', topK: 6, onlyContext: true });
      const names = [...new Set((qd?.data?.entities || []).map((e) => e.entity_name).filter(Boolean))];
      for (const nm of names) {
        if (nm.toLowerCase() === self) continue;
        const hits = await searchConcepts(nm, 1);
        for (const h of hits) if (h.canonical_name.toLowerCase() !== self) pool.push(h);
      }
    } catch { /* semantic assist is best-effort */ }
  }
  const seen = new Set();
  const out = [];
  for (const m of pool) { if (!seen.has(m.canonical_id)) { seen.add(m.canonical_id); out.push(m); } }
  return out.slice(0, thresholds.matchCandidates);
}

export async function resolveAndApply(cand, { runId, sourceId, model = 'gpt-5-mini' }) {
  const matches = await findMatches(cand);

  // Cold-start / no candidates → new concept (no LLM call needed).
  let decision;
  if (matches.length === 0) {
    decision = { classification: 'NEW_CONCEPT', matched_canonical_id: null, confidence: 0.9, rationale: 'no existing match' };
  } else {
    decision = await classifyLLM(cand, matches);
  }

  await q(
    `insert into obsidiwikai.resolution(run_id,candidate_id,candidate_name,matched_canonical_id,classification,confidence,decided_by,rationale)
     values($1,$2,$3,$4,$5,$6,$7,$8)`,
    [runId, cand.candidate_id || null, cand.raw_name, decision.matched_canonical_id,
     decision.classification, decision.confidence, matches.length === 0 ? 'auto' : 'model', decision.rationale || null]
  );

  const conf = decision.confidence ?? 0.5;
  const ambiguous = decision.classification === 'UNCERTAIN'
    || (matches.length > 0 && conf < thresholds.autoApplyConfidence && conf >= thresholds.reviewFloor);
  if (ambiguous) return holdForReview(cand, matches, decision, { runId, sourceId });
  return applyDecision(cand, decision, { runId, sourceId, model });
}

async function classifyLLM(cand, matches) {
  const opts = matches
    .map((m, i) => `${i}. ${m.canonical_name}: ${(m.description || '').slice(0, 160)} (aliases: ${(m.aliases || []).join(', ') || 'none'})`)
    .join('\n');
  const prompt = `Classify how a NEW candidate concept relates to the CLOSEST existing concepts in a personal knowledge encyclopedia. Be conservative: do NOT merge merely-related-but-distinct concepts (over-merging corrupts the graph).

CANDIDATE: "${cand.raw_name}"${cand.entity_type ? ` [${cand.entity_type}]` : ''}
Description: ${cand.description || '(none)'}

EXISTING CONCEPTS:
${opts}

Return ONLY JSON: {"classification":"SAME_CONCEPT|ALIAS_OF|BROADER_THAN|NARROWER_THAN|RELATED_TO|SUPPORTS|CONTRADICTS|SUPERSEDES|NEW_CONCEPT|UNCERTAIN","matched_index":<index or null>,"confidence":<0..1>,"rationale":"<=15 words"}
SAME_CONCEPT/ALIAS_OF only if truly the same idea in different words. NEW_CONCEPT if none match. UNCERTAIN if you genuinely cannot tell.`;
  const j = await generateJSON(prompt);
  const idx = j.matched_index == null ? null : Number(j.matched_index);
  const matched = idx != null && matches[idx] ? matches[idx].canonical_id : null;
  return {
    classification: String(j.classification || 'UNCERTAIN').toUpperCase(),
    matched_canonical_id: matched,
    confidence: Number(j.confidence) || 0.5,
    rationale: j.rationale || '',
  };
}

async function applyDecision(cand, decision, { runId, sourceId, model }) {
  const cls = decision.classification;
  const matched = decision.matched_canonical_id;

  if ((cls === 'SAME_CONCEPT' || cls === 'ALIAS_OF') && matched) {
    await addAlias(matched, cand.raw_name);
    await addEvidence(matched, { sourceId, runId, wording: cand.raw_name, claim: cand.description, model, confidence: decision.confidence });
    await linkSource(matched, sourceId);
    return { action: 'aliased', canonical_id: matched, name: cand.raw_name };
  }

  const cid = await createConcept({
    name: cand.raw_name, description: cand.description, type: cand.entity_type || 'Concept',
    status: 'accepted', confidence: decision.confidence,
  });
  await addEvidence(cid, { sourceId, runId, wording: cand.raw_name, claim: cand.description, model, confidence: decision.confidence });
  await linkSource(cid, sourceId);

  if (matched && cls !== 'NEW_CONCEPT') {
    if (cls === 'BROADER_THAN') await relate(matched, cid, 'IS_A', { sourceId, runId, confidence: decision.confidence });
    else if (cls === 'NARROWER_THAN') await relate(cid, matched, 'IS_A', { sourceId, runId, confidence: decision.confidence });
    else {
      const rel = ({ RELATED_TO: 'RELATED_TO', SUPPORTS: 'SUPPORTS', CONTRADICTS: 'CONTRADICTS', SUPERSEDES: 'SUPERSEDES' })[cls] || 'RELATED_TO';
      await relate(cid, matched, rel, { sourceId, runId, confidence: decision.confidence, description: decision.rationale });
    }
    return { action: 'created+related', canonical_id: cid, name: cand.raw_name };
  }
  return { action: 'created', canonical_id: cid, name: cand.raw_name };
}

async function holdForReview(cand, matches, decision, { runId, sourceId }) {
  const top = matches[0];
  const options = [
    { key: 'same', label: `Same as "${top.canonical_name}"` },
    { key: 'alias', label: `Alias of "${top.canonical_name}"` },
    { key: 'broader', label: 'Broader concept' },
    { key: 'narrower', label: 'Narrower concept' },
    { key: 'related', label: 'Related but distinct' },
    { key: 'separate', label: 'Separate new concept' },
  ];
  await q(
    `insert into obsidiwikai.review_item(run_id,candidate_id,question,options,status) values($1,$2,$3,$4,'open')`,
    [runId, cand.candidate_id || null, `Is "${cand.raw_name}" the same as "${top.canonical_name}"?`, JSON.stringify(options)]
  );
  const cid = await createConcept({
    name: cand.raw_name, description: cand.description, type: cand.entity_type || 'Concept',
    status: 'held', confidence: decision.confidence,
  });
  await linkSource(cid, sourceId);
  return { action: 'held_for_review', canonical_id: cid, name: cand.raw_name };
}
