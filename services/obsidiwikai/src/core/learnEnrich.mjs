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
import { buildLens, lensSummary } from './lens.mjs';
import { scoreRelevanceBatched } from './relevance.mjs';
import { generateJSON } from './llm.mjs';
import { faithfulClean } from './learnIngest.mjs';

export const ENRICH_LIMITS = {
  relevanceFloor: 0.35,    // below this (and not emerging) → deferred reservoir, not canonicalised
  mergeConfidence: 0.98,   // model-assisted IDENTITY auto-merge floor. Warwick policy: only deterministic
                           // aliases + genuinely corroborated ≥0.98 auto-merge; 0.85–0.979 is HELD.
  relateConfidence: 0.85,  // typed relationships are additive + reversible → a lower bar than a merge
  holdFloor: 0.85,         // similar-but-uncertain identity in [holdFloor, mergeConfidence) → held for review
  maxCanonicalise: Number(process.env.WP15_MAX_CANONICALISE) || 60, // bound LLM cost per source/pass
};

// FR-010 full outcome set → how each maps to a durable edge on the ONE graph. Identity outcomes
// (SAME/ALIAS) are handled as merges; the rest become TYPED relationships (never a merge).
const REL_TYPE = {
  BROADER_THAN: 'IS_A',    // candidate is BROADER → matched (narrower) IS_A candidate (see relationEndpoints)
  NARROWER_THAN: 'IS_A',   // candidate is NARROWER → candidate IS_A matched
  RELATED_TO: 'RELATED_TO',
  SUPPORTS: 'SUPPORTS',
  CONTRADICTS: 'CONTRADICTS',
  SUPERSEDES: 'SUPERSEDES',
};

// Directed endpoints for a typed relationship. IS_A points narrower→broader. For BROADER_THAN the
// candidate IS the broader concept, so the (narrower) matched entity IS_A the candidate → [matched,
// candidate]. Everything else (NARROWER/RELATED/SUPPORTS/SUPERSEDES/CONTRADICTS) reads candidate→matched.
export function relationEndpoints(classification, candidateName, matchedName) {
  return classification === 'BROADER_THAN' ? [matchedName, candidateName] : [candidateName, matchedName];
}

const norm = (s) => String(s || '').trim().toLowerCase();
// Strip punctuation, and a trailing plural 's' ONLY on longer words — never on short acronyms, so
// 'CSS'→'css' does not collide with 'CS'→'cs' (that would be a false auto-merge with no review).
const canonKey = (s) => {
  const k = norm(s).replace(/[^a-z0-9]+/g, '');
  return k.length > 3 ? k.replace(/s$/, '') : k;
};
// Whitespace-insensitive normalisation for verbatim-evidence verification.
const normWs = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
// A model confidence is trusted only if it is a real [0,1] float. Anything else (missing, NaN, or a
// percent-scale drift like 90) FAILS SAFE to 0 — never let a malformed value clear the ≥0.98 merge gate.
const safeConf = (x) => { const c = Number(x); return Number.isFinite(c) && c >= 0 && c <= 1 ? c : 0; };

// A DETERMINISTIC alias — same name, or same after stripping punctuation/plurals. No model judgement,
// so it is the only non-≥0.98 auto-merge Warwick allows. `candidate` may be a string or {name,entity_type}.
export function deterministicMatch(candidate, catalog) {
  const name = typeof candidate === 'string' ? candidate : candidate?.name;
  const type = typeof candidate === 'string' ? null : candidate?.entity_type;
  const key = norm(name);
  const exact = catalog.find((e) => norm(e.name) === key);
  if (exact) return { entity: exact, kind: 'SAME_CONCEPT' }; // identical name = same concept
  const ck = canonKey(name);
  // A plural/punctuation alias is only DETERMINISTICALLY safe when the entity TYPES agree — otherwise
  // 'Windows' [tool] vs 'Window' [concept] would falsely weld. A type mismatch falls through to the model.
  const alias = catalog.find((e) => canonKey(e.name) === ck && norm(e.name) !== key
    && (!type || !e.entity_type || norm(e.entity_type) === norm(type)));
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
  const det = deterministicMatch(candidate, catalog);
  if (det) return { classification: det.kind, matched_name: det.entity.name, confidence: 1, deterministic: true, rationale: 'deterministic alias' };
  const matches = await findMatches(candidate, catalog, client);
  if (!matches.length) return { classification: 'NEW_CONCEPT', matched_name: null, confidence: 0.9, deterministic: false, rationale: 'no existing match' };
  const opts = matches.map((m, i) => `${i}. ${m.name}: ${(m.description || '').slice(0, 140)}`).join('\n');
  const prompt = `Classify how a NEW candidate concept relates to the CLOSEST existing concepts in a personal knowledge graph. Be conservative: do NOT merge merely-related-but-distinct concepts — over-merging corrupts the graph. PREFER a relationship (BROADER/NARROWER/RELATED) over a merge whenever the concepts are connected but not identical.

CANDIDATE: "${candidate.name}"${candidate.entity_type ? ` [${candidate.entity_type}]` : ''}
Description: ${candidate.description || '(none)'}

EXISTING CONCEPTS:
${opts}

Direction: BROADER_THAN = the CANDIDATE is broader/more general than the existing concept; NARROWER_THAN = the candidate is more specific.
Return ONLY JSON: {"classification":"SAME_CONCEPT|ALIAS_OF|BROADER_THAN|NARROWER_THAN|RELATED_TO|SUPPORTS|CONTRADICTS|SUPERSEDES|NEW_CONCEPT|UNCERTAIN","matched_index":<index or null>,"confidence":<0..1 decimal>,"rationale":"<=15 words"}
SAME_CONCEPT/ALIAS_OF ONLY if truly the same idea in different words. UNCERTAIN if you genuinely cannot tell.`;
  const j = await generate(prompt);
  const idx = j?.matched_index == null ? null : Number(j.matched_index);
  const matched = idx != null && matches[idx] ? matches[idx].name : null;
  return {
    classification: String(j?.classification || 'UNCERTAIN').toUpperCase(),
    matched_name: matched,
    confidence: safeConf(j?.confidence), // out-of-range/percent-scale drift → 0 (fails safe, no merge)
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

// Canonicalise ONE candidate against the authoritative graph + apply per policy, recording the decision.
// `mode` distinguishes the broad pass (candidate already IS a graph entity → NEW means leave it) from
// the lens-directed pass (candidate may be genuinely absent → NEW means ADD it, with provenance). All
// mutations are gated by `apply`. Returns the ledger action taken.
async function canonicaliseCandidate(candidate, { catalog, client, limits, apply, runId, sourceId, pass, mode }) {
  let decision;
  try {
    decision = await classifyOneGraph(candidate, catalog, { client });
  } catch {
    decision = { classification: 'UNCERTAIN', matched_name: null, confidence: 0, rationale: 'canonicalise error' };
  }
  const plan = planAction(decision, candidate.name, limits);
  const ev = candidate.evidence || null;               // verbatim source span — directed pass carries this
  const relType = REL_TYPE[decision.classification] || 'RELATED_TO';
  const nodeDesc = `${(candidate.description || '').slice(0, 400)}${ev ? `\n\n[source evidence] "${ev.slice(0, 300)}"` : ''}`;
  const relDesc = `${decision.rationale || `${relType} (WP1.5)`}${ev ? ` · [evidence] "${ev.slice(0, 200)}"` : ''}`;
  let action = 'kept';
  let applyError = null;
  try {
    if (plan === 'merge') {
      if (mode === 'lens_directed') {
        action = 'kept';   // a directed text-concept duplicating an existing entity is already represented — no node to merge
      } else if (apply) {
        await client.mergeEntities([candidate.name], decision.matched_name);
        action = 'merged';
      } else { action = 'merged'; }
    } else if (plan === 'relate') {
      // FR-010: a TYPED relationship, NOT a merge, with the correct direction (relationEndpoints).
      const [src, tgt] = relationEndpoints(decision.classification, candidate.name, decision.matched_name);
      if (mode === 'lens_directed' && !ev) {
        action = 'held';   // a directed relation with no verifiable evidence → hold, never assert unproven
      } else {
        if (apply) {
          // A directed candidate may not yet be a node — ensure it exists (with provenance) BEFORE
          // relating, so we never create an edge to a phantom endpoint (Fable-5).
          if (mode === 'lens_directed') {
            try { await client.createEntity(candidate.name, { entity_type: candidate.entity_type || 'concept', description: nodeDesc, source_id: sourceId, file_path: sourceId }); } catch { /* already exists → fine */ }
          }
          await client.createRelation(src, tgt, { description: relDesc, keywords: relType, weight: decision.confidence ?? 0 });
        }
        action = 'related';
      }
    } else if (plan === 'hold') {
      action = 'held';   // genuine ambiguity — leave BOTH entities, record for human review
    } else if (mode === 'lens_directed' && decision.classification === 'NEW_CONCEPT') {
      // The lens surfaced a relevant concept the broad pass did NOT extract → ADD it to the one graph
      // WITH verifiable evidence, so the lens genuinely EXPANDS what the Brain notices (FR-006).
      if (!ev) {
        action = 'held';   // never add a model-inferred concept without a verified source span
      } else {
        if (apply) await client.createEntity(candidate.name, {
          entity_type: candidate.entity_type || 'concept', description: nodeDesc, source_id: sourceId, file_path: sourceId,
        });
        action = 'added';
      }
    } else {
      action = 'kept';   // NEW (broad) / below threshold — LightRAG already has it, leave as-is
    }
  } catch (e) {
    // A mutation THREW (e.g. LightRAG unreachable). This is NOT a deliberate 'held' — it is an infra
    // failure; record it as an error so enrichSource fails + retries, never a false 'enriched' (Fable-2).
    action = 'error';
    applyError = String(e.message).slice(0, 200);
  }
  await q(
    `insert into obsidiwikai.wp15_canonicalisation(run_id,source_id,entity_name,classification,matched_name,action,confidence,rationale,pass,evidence)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [runId, sourceId, candidate.name, decision.classification || 'UNCERTAIN',
      decision.matched_name || null, action, decision.confidence ?? null, applyError || decision.rationale || null, pass, ev],
  );
  return action;
}

function lensDirectedPrompt(win, lens, limit) {
  return `You extract concepts from a source that are SPECIFICALLY relevant to a person, Warwick, given his interest lens — especially concepts a generic extraction might under-emphasise. Only concepts GENUINELY present in this text; do not invent.

WARWICK'S LENS:
${lensSummary(lens)}

SOURCE (a window of the faithful-clean source):
${win}

Return ONLY a JSON array of up to ${limit} objects:
{"name":"exact concept name","entity_type":"concept|tool|method|person|org","description":"<=200 chars grounded in the text","why":"<=12 words why it matters to Warwick","evidence":"a short EXACT verbatim quote (5-30 words) copied WORD-FOR-WORD from the SOURCE above supporting this concept"}
The "evidence" MUST be copied verbatim from the source — not paraphrased — or the concept is discarded.`;
}

// LENS-DIRECTED extraction (FR-006) — steer a second pass over the faithful-clean source by the CURRENT
// lens, surfacing concepts genuinely present but under-noticed by the broad extraction. Inspects the
// WHOLE faithful-clean source in overlapping windows — EVERY window, never stopping early because the
// shortlist filled — and REQUIRES each concept to carry an exact verbatim evidence span verified against
// the source (hallucinated concepts discarded). Returns ALL evidence-verified, deduped candidates across
// the whole source; the CALLER reduces to the bounded number it canonicalises (the scan is complete;
// only canonicalisation cost is bounded). `limit` is a per-window extraction hint, not a total cap.
export async function extractLensDirected(text, lens, {
  generate = generateJSON, limit = 15, windowSize = 9000, overlap = 1000, maxWindows = 20,
} = {}) {
  if (!text || text.length < 200) return [];
  const normSrc = normWs(text);
  const step = Math.max(1, windowSize - overlap);
  const windowCount = Math.ceil(Math.max(1, text.length - overlap) / step);
  if (windowCount > maxWindows) {
    // A cost ceiling must FAIL VISIBLY, never silently truncate the source — a silent cap would break the
    // WP1.5 promise to inspect the WHOLE faithful-clean source. Surfaced → the run fails and retries.
    throw new Error(`lens-directed: source needs ${windowCount} windows, over the ${maxWindows} ceiling — raise maxWindows`);
  }
  const byName = new Map();
  for (let i = 0; i < text.length; i += step) {
    // Every window MUST be inspected: do NOT break because the shortlist is full, and do NOT swallow a
    // window failure — it propagates so enrichSource fails and the Learn job stays retriable, never a
    // false 'done' on a partial scan.
    const arr = await generate(lensDirectedPrompt(text.slice(i, i + windowSize), lens, limit));
    for (const c of (Array.isArray(arr) ? arr : [])) {
      if (!c || !c.name || !c.evidence) continue;               // must cite exact evidence
      const key = String(c.name).trim().toLowerCase();
      if (!key || byName.has(key)) continue;
      if (!normSrc.includes(normWs(c.evidence))) continue;       // evidence not a real span → reject (no hallucinated concept)
      byName.set(key, {
        name: String(c.name).trim(),
        entity_type: c.entity_type || 'concept',
        description: String(c.description || '').slice(0, 300),
        why: c.why || '',
        evidence: String(c.evidence).trim().slice(0, 500),
      });
    }
  }
  return [...byName.values()];
}

// Read the authoritative graph once: full entity catalog + this source's just-extracted entities.
export async function readAuthoritativeGraph(sourceId, { maxNodes = 10000, client = lightrag } = {}) {
  const g = await client.graphs({ label: '*', maxDepth: 2, maxNodes });
  const nodes = g.nodes || [];
  if (nodes.length >= maxNodes) {
    // The snapshot hit the cap → the catalog is INCOMPLETE. Enriching on a partial graph risks a false
    // 'no source entities' completion and duplicate adds, so fail loudly (retriable) rather than lie (Fable-6).
    throw new Error(`authoritative-graph snapshot truncated at ${maxNodes} nodes — raise maxNodes before enriching`);
  }
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
// reportId defaults to sourceId (the permanent path uses one id for both the faithful-clean report and
// the graph file_source). It exists only for historical sources whose report key ≠ graph slug.
export async function enrichSource(sourceId, { lens = null, client = lightrag, limits = ENRICH_LIMITS, apply = true, reportId = null } = {}) {
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
      return { runId, sourceId, sourceEntities: 0, deferred: 0, merged: 0, related: 0, held: 0, kept: 0, added: 0, ...stats };
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
        `insert into obsidiwikai.wp15_entity_relevance(run_id,source_id,entity_name,entity_type,relevance,why,emerging,deferred,lens_version,pass)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,'broad')`,
        [runId, sourceId, s.raw_name, s.entity_type || null, s.relevance, s.why || null, !!s.emerging, isDeferred, lensVersion],
      );
    }

    // 2) CANONICALISATION — for the RELEVANT entities only (the lens decides where we spend semantic
    // judgement), conservatively resolve against the authoritative graph. Catalog excludes this
    // source's own entities so we link islands rather than self-match.
    const own = new Set(sourceEntities.map((e) => e.name.toLowerCase()));
    const catalog = entities.filter((e) => !own.has(e.name.toLowerCase()));
    const relevant = scored
      .filter((s) => s.relevance >= limits.relevanceFloor || s.emerging)
      .slice(0, limits.maxCanonicalise);
    const tally = { merged: 0, related: 0, held: 0, kept: 0, added: 0, error: 0 };
    const bump = (a) => { if (tally[a] != null) tally[a] += 1; else tally.kept += 1; };
    for (const s of relevant) {
      const act = await canonicaliseCandidate(
        { name: s.raw_name, entity_type: s.entity_type, description: s.description || '' },
        { catalog, client, limits, apply, runId, sourceId, pass: 'broad', mode: 'broad' },
      );
      bump(act);
    }

    // 3) LENS-DIRECTED PASS (FR-006) — steer a SECOND extraction over the faithful-clean source by the
    // CURRENT lens, surfacing relevant concepts the broad pass under-noticed, then feed them through the
    // SAME one-graph canonicalisation. Genuinely-new relevant concepts are ADDED with provenance, so the
    // lens is DIRECTIVE (it changes what the Brain notices), not merely a post-hoc scorer.
    // This is a REQUIRED part of the WP1.5 promise: its failure is NOT swallowed — it propagates to the
    // outer catch → the enrich run is marked 'failed' → reconcileLearn keeps the Learn job retriable
    // (the raw broad-pass result stays searchable, but the job must NOT claim 'done').
    const text = faithfulClean(reportId || sourceId);
    const candidates = await extractLensDirected(text, lens, { limit: Math.min(15, limits.maxCanonicalise) });
    const fresh = candidates.filter((c) => !own.has(c.name.toLowerCase())).slice(0, limits.maxCanonicalise);
    const lensDirected = fresh.length;
    for (const c of fresh) {
      const act = await canonicaliseCandidate(c, { catalog, client, limits, apply, runId, sourceId, pass: 'lens_directed', mode: 'lens_directed' });
      bump(act);
      own.add(c.name.toLowerCase()); // avoid re-adding within the same run
    }

    const stats = {
      applied: apply, source_entities: sourceEntities.length, scored: scored.length, deferred,
      canonicalised: relevant.length, lens_directed: lensDirected, ...tally,
    };
    // A graph-apply failure is an infra problem, NOT a completed enrichment. Fail the run (retriable)
    // so reconcileLearn keeps the Learn job from claiming 'done' on a half-applied pass (Fable-2). The
    // per-candidate ledger rows above record exactly what did/didn't apply.
    if (tally.error > 0) throw new Error(`${tally.error} graph-apply failure(s) during enrichment — retriable`);
    await q(`update obsidiwikai.wp15_enrich_run set state='completed', lens_version=$2, stats=$3, finished_at=now() where run_id=$1`,
      [runId, lensVersion, JSON.stringify(stats)]);
    return { runId, sourceId, ...stats };
  } catch (e) {
    await q(`update obsidiwikai.wp15_enrich_run set state='failed', error=$2, finished_at=now() where run_id=$1`,
      [runId, String(e.message).slice(0, 500)]);
    throw e;
  }
}
