// FR-029 / DoD #18 — source-scoped, governed improvements to the Brain itself.
//
// This is intentionally separate from WP5's Warwick-facing opportunity suggestions. It asks:
// "Given what the Brain just learned, and what Fusion247/MyPKA currently does, what concrete
// improvement does this enable or suggest?" The answer is stored in the EXISTING
// cockpit.learning_candidate table. Accept/Dismiss still flows through BUILD-002's
// learning_command -> follow_on_task -> resume/command receipt machinery.
import { q } from '../clients/db.mjs';
import { buildLens, lensSummary } from './lens.mjs';
import { generateJSON } from './llm.mjs';

const REPORT_URL = process.env.FUSION_REPORT_URL || `http://${process.env.FUSION_CORE_TAILNET || '100.101.240.85'}:8701`;

export const SYSTEM_TARGETS = new Set([
  'larry', 'mypka', 'cairn', 'tubeair', 'lightrag', 'neo4j', 'directus', 'fusion247', 'workflow',
]);

export const SYSTEM_KINDS = new Set([
  'architecture', 'agent_instruction', 'cairn_routing', 'source_processing', 'retrieval',
  'knowledge_model', 'cockpit', 'workflow', 'reusable_method', 'experiment', 'foundry_idea',
  'research_question',
]);

const GENERIC = [
  /\buse more ai\b/i,
  /\bimprove automation\b/i,
  /\bconsider agents?\b/i,
  /\bleverage ai\b/i,
  /\benhance efficiency\b/i,
];

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const slug = (value) => clean(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const letter = (index) => String.fromCharCode(65 + index);

export function systemCandidateRef(sourceVideoId, index) {
  const source = clean(sourceVideoId, 160);
  if (!source || index < 0 || index > 25) throw new Error('system candidate ref requires a source id and index 0..25');
  return `OWAI:${source}:${letter(index)}`;
}

function exactConcept(value, concepts) {
  const wanted = clean(value, 240).toLowerCase();
  return concepts.find((c) => c.toLowerCase() === wanted) || null;
}

export function normaliseSystemCandidates(raw, { sourceConcepts = [], limit = 4 } = {}) {
  const rows = Array.isArray(raw) ? raw : [];
  const concepts = [...new Set(sourceConcepts.map((c) => clean(c, 240)).filter(Boolean))];
  const out = [];
  for (const item of rows) {
    if (out.length >= limit || !item || typeof item !== 'object') continue;
    const proposedChange = clean(item.proposed_change || item.recommendation, 1000);
    const why = clean(item.why, 1200);
    const expectedEffect = clean(item.expected_effect, 1000);
    const risk = clean(item.risk || item.what_invalidates, 1000);
    const nextStep = clean(item.next_step, 1000);
    const target = slug(item.target);
    const kind = slug(item.kind);
    const confidence = Number(item.confidence);
    const cites = [...new Set((Array.isArray(item.cites) ? item.cites : [])
      .map((c) => exactConcept(c, concepts)).filter(Boolean))];
    const evidenceReasoning = clean(item.evidence_reasoning, 1200);

    const specific = proposedChange.length >= 28 && !GENERIC.some((p) => p.test(proposedChange));
    if (!specific || why.length < 20 || expectedEffect.length < 12 || risk.length < 8 || nextStep.length < 12) continue;
    if (!SYSTEM_TARGETS.has(target) || !SYSTEM_KINDS.has(kind)) continue;
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) continue;
    if (cites.length === 0 || evidenceReasoning.length < 12) continue;

    out.push({
      proposedChange, why, expectedEffect, risk, nextStep, target, kind, confidence, cites,
      evidenceReasoning,
    });
  }
  return out;
}

export function buildSystemImprovementPrompt({ source, lens, limit = 4 }) {
  const newConcepts = source.new || [];
  const connected = source.connected || [];
  const concepts = [...new Set([...newConcepts, ...connected])];
  return `You are analysing ONE learned source for concrete ways to improve Larry, MyPKA, or Fusion247 itself.

THE QUESTION:
Given what the Brain just learned, and what Fusion247/MyPKA currently does, what concrete improvement does this enable or suggest?

SOURCE (the only source whose evidence may support these candidates):
- id: ${source.source_id}
- title: ${source.title}
- why it matters: ${source.why || 'not separately stated'}
- concepts new in this source: ${newConcepts.join(', ') || 'none'}
- concepts this source connects/reinforces: ${connected.join(', ') || 'none'}
- exact source passage: ${source.evidence?.passage || 'not available; cite graph concepts only'}

CURRENT SYSTEM — treat this as architecture context, NOT source evidence:
- capture -> Cairn KEEP/LEARN -> TubeAIR faithful-clean full-detail source -> LightRAG 1.5.4 -> Neo4JStorage -> one Neo4j graph
- Directus/cockpit is the operational/review state; Honcho is Warwick's evolving lens
- BUILD-002 already governs work as candidate -> Warwick decision -> follow_on_task -> Larry resume consumer -> command result/receipt
- Accept authorises governed investigation/implementation; it never silently mutates canonical MyPKA

WARWICK LENS:
${lensSummary(lens)}

Produce up to ${limit} SPECIFIC candidates. Reject generic ideas such as "use more AI", "improve automation", or "consider agents". Each candidate must be enabled or suggested by this source, must cite one or more concept names EXACTLY from the source lists above, and must say what would invalidate it.

Allowed target values: ${[...SYSTEM_TARGETS].join('|')}
Allowed kind values: ${[...SYSTEM_KINDS].join('|')}

Return ONLY a JSON array of:
{"target":"...","kind":"...","proposed_change":"...","why":"...","cites":["exact concept name"],"evidence_reasoning":"how those cited concepts support the change","expected_effect":"...","confidence":0.0,"risk":"risk or what would invalidate it","next_step":"one concrete governed investigation or implementation step"}`;
}

export async function fetchSourceIntelligence(sourceVideoId) {
  const res = await fetch(`${REPORT_URL.replace(/\/$/, '')}/api/source/${encodeURIComponent(sourceVideoId)}`);
  if (!res.ok) throw new Error(`report source ${sourceVideoId} -> ${res.status}`);
  return res.json();
}

export async function generateSystemImprovements({ sourceVideoId, limit = 4 } = {}) {
  if (!sourceVideoId) throw new Error('generateSystemImprovements requires sourceVideoId');
  const [source, lens] = await Promise.all([fetchSourceIntelligence(sourceVideoId), buildLens()]);
  const prompt = buildSystemImprovementPrompt({ source, lens, limit });
  const raw = await generateJSON(prompt);
  const concepts = [...new Set([...(source.new || []), ...(source.connected || [])])];
  const candidates = normaliseSystemCandidates(raw, { sourceConcepts: concepts, limit });
  if (candidates.length === 0) throw new Error('system improvement pass returned no specific, source-grounded candidates');

  const stored = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const candidateRef = systemCandidateRef(sourceVideoId, i);
    const evidence = [
      `Source: ${source.title} (${source.source_id})`,
      `Graph concepts: ${c.cites.join(', ')}`,
      `Grounding: ${c.evidenceReasoning}`,
      source.evidence?.passage ? `Passage: ${clean(source.evidence.passage, 600)}` : null,
    ].filter(Boolean).join('\n');
    const params = [
      sourceVideoId, candidateRef, c.proposedChange, c.why, evidence, c.target,
      c.expectedEffect, c.confidence.toFixed(2), c.risk, c.kind, c.nextStep, i + 1,
    ];
    const result = await q(
      `insert into cockpit.learning_candidate
         (build_id, source_video_id, candidate_ref, recommendation, why, evidence, proposed_target,
          expected_effect, confidence, risk, status, candidate_scope, candidate_kind, next_step, sort)
       values ('IDEA-007',$1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','system_improvement',$10,$11,$12)
       on conflict (candidate_ref) where candidate_ref is not null and candidate_scope='system_improvement' do update set
         source_video_id=excluded.source_video_id,
         recommendation=excluded.recommendation,
         why=excluded.why,
         evidence=excluded.evidence,
         proposed_target=excluded.proposed_target,
         expected_effect=excluded.expected_effect,
         confidence=excluded.confidence,
         risk=excluded.risk,
         candidate_scope=excluded.candidate_scope,
         candidate_kind=excluded.candidate_kind,
         next_step=excluded.next_step,
         sort=excluded.sort,
         updated_at=now()
       where cockpit.learning_candidate.status in ('pending','deferred')
         and cockpit.learning_candidate.candidate_scope='system_improvement'
       returning id,status`,
      params,
    );
    const row = result.rows[0] || (await q(
      `select id,status from cockpit.learning_candidate where candidate_ref=$1`, [candidateRef],
    )).rows[0];
    stored.push({ id: row.id, status: row.status, candidateRef, ...c });
  }
  return stored;
}
