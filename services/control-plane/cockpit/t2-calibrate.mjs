// T2 CALIBRATION runner (IDEA-016) — ONE authorised Audi calibration, not the full six-fixture experiment.
// Pipeline (Warwick-agreed T2 + 4 corrections 2026-07-26):
//   5 ISOLATED Transfer-Specialist branches (blind to each other; each = whole source + shared A/C + frame B-slice
//   + frame objective + independent self-kill)  →  NON-MODEL Neo4j enrichment (AFTER emit, BEFORE convergence;
//   informs both directions, NEVER gates, NEVER deletes)  →  ONE convergence/lead pass (dedup / preserve conflicts /
//   classify NOVEL-INDEPENDENT vs CONTEXT-INDUCED convergence / cross-branch kill L2 / reason over graph evidence /
//   re-score NVFI / SPIN-first) — the lead pass may NOT invent transfers absent from branch outputs.
// Sonnet throughout. No Fable. No Opus (unless an execution blocker forces it). Measures the REAL path per branch,
// per convergence, and whole-T2 (actual reported vs faculty-estimate vs wrapper/cache overhead + wall-clock).
// Emits 3 artefacts: A blind candidate set (Warwick scores), B technical/cost report, C HELD origin/frame/T1 key.
//   node --env-file=C:/.fusion247/neo4j.env services/control-plane/cockpit/t2-calibrate.mjs [video_id]
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { rows } from 'file:///C:/Fusion247PKA/services/obsidiwikai/src/clients/neo4j.mjs';

const REPO = 'C:/Fusion247PKA';
const COCKPIT = process.env.COCKPIT_URL || 'http://127.0.0.1:8090';
const OUT = `${REPO}/Deliverables`;
const VIDEO = process.argv[2] || 'n5G26mmJ7I0'; // Audi frozen fixture (#4, adversarial poor-fit)

// ---------- shared A (self-model) + C (governance) — IDENTICAL across all branches (the contamination vector we test) ----------
const ROSTER_SEED = `FUSION MODULE/AGENT ROSTER (seed)
- Brain: ONE governed knowledge graph LightRAG->Neo4j (the compiler), fed by ingested sources.
- Outputs Layer: proactive "you nearly missed this" surfacing (north-star consumer).
- Cockpit: Warwick's phone-first control/output surface (Ideas Brain/Cash, Keep/Decline/Later).
- Gateway: unified capture->categorise->route. TubeAIR: YouTube link->cleaned transcript (no LLM).
- AsdAIr: private household shopping (personal-data lane, parked). Tower: build review/merge-check (parked).
- Agents: Larry(orchestrate) Cairn(intake) Pax(verify) Penn(journal) Mack(automation) Silas(schema)
  Nolan(hire) Warden(delivery) Vera/Vex(QA/sec) + this Transfer-Intelligence specialist. Fable=adversarial critic, explicit-auth only.
- Infra: fusion247-core (Hetzner/Coolify: Redis/Directus/Neo4j/LightRAG/Honcho-pilot). Ideation runs on Warwick's Anthropic sub (Sonnet).
- Money/F247: the business the Brain serves (Cash targets).`;

const C_SLICE = `GOVERNANCE (deterministic):
- Privacy: Fusion247PKA repo is PUBLIC; personal/household data never in git (private store only).
- Fable: confirm-first HARDLOCK — never without Warwick's explicit per-use yes.
- Boundaries: Foundry=idea, MyPKA=build, GitHub=code; production/live-apply is gated.
- Delivery: build to the goal; independent review before merge; human gate on consequential actions;
  hobby-brain threat bar = correctness/leak/availability/audit, NOT adversarial hardening.
- Authority: Warwick holds merge/Fable/live-apply; Larry orchestrates + commits on judgement otherwise.`;

// Targets FOREGROUNDED in the shared brief — the convergence pass uses this to classify convergence type.
export const FOREGROUNDED = ['Brain', 'Outputs Layer', 'Cockpit', 'Gateway', 'TubeAIR', 'AsdAIr', 'Tower',
  'CareerAIr', 'Scout', 'Cash', 'Fable', 'Honcho', 'knowledge graph', 'Transfer'];

export async function getSource(video, cockpit = COCKPIT) {
  const r = await fetch(`${cockpit}/api/transcript?video=${encodeURIComponent(video)}`);
  const j = await r.json();
  if (!j.ok) throw new Error('no transcript: ' + (j.error || 'unknown'));
  return j.text;
}

function gitNow() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO }).toString().trim();
    const log = execSync('git log --oneline -5', { cwd: REPO }).toString().trim();
    return `branch ${branch}\n${log}`;
  } catch { return '(git unavailable)'; }
}
function backlog() {
  try {
    return fs.readFileSync(`${REPO}/Deliverables/BACKLOG.md`, 'utf8').split(/\r?\n/)
      .filter((l) => /^- \*\*\[/.test(l)).slice(0, 8).join('\n');
  } catch { return '(no backlog)'; }
}
const A_SLICE = `## A — SELF-MODEL (shared, identical across branches)
### Roster (seed)
${ROSTER_SEED}
### Happening now (git-live)
${gitNow()}
### Current problems (backlog)
${backlog()}`;

// ---------- the 5 isolated frames — each a DIFFERENT objective function + a frame-tailored B-slice ----------
// B is tailored per frame precisely to REDUCE the shared-context contamination that A+C impose.
export const FRAMES = [
  {
    id: 'F1-mechanism', name: 'Mechanism / structural transfer',
    b: `## B — frame lens: STRUCTURAL FIDELITY. Full roster is in play; foreground the Brain graph, Outputs Layer,
Cockpit, Gateway system-design. Warwick builds TO THE GOAL, future-proof/scalable, clean role-separation.`,
    objective: `Find the highest-FIDELITY structural transfers: a mechanism/principle/architecture in the source whose
INVARIANT maps precisely onto the structure or system-design of a specific Fusion component. Optimise structural
fidelity; a tight correspondence beats a clever-sounding loose one.`,
    kill: `KILL anything metaphorical or loosely-analogous — that is another lens's job, not yours. Prefer 1 tight
structural transfer over 3 loose ones. If the correspondence is decorative, KILL it.`,
  },
  {
    id: 'F2-inversion', name: 'Inversion / failure-mode',
    b: `## B — frame lens: NEGATION. Foreground Fusion's CURRENT PROBLEMS (backlog above) and REJECTED PATTERNS:
static mega-prompts going stale · building verify/governance machinery before the thing works · manufacturing ideas
to hit a quota · merging without independent review. Governance risks (privacy leak, availability, audit).`,
    objective: `Derive transfers by NEGATION. Where the source shows something FAILING, breaking, exploited, or resting
on a hidden assumption, ask: "what in Fusion breaks the SAME way, or rests on the SAME assumption?" Mine failure-modes
and inverted assumptions the positive-match frames structurally cannot reach.`,
    kill: `KILL anything that is just a restated positive feature idea. This frame keeps ONLY genuine failure-mode /
inverted-assumption transfers. If it isn't about something breaking, it isn't yours.`,
  },
  {
    id: 'F3-operational', name: 'Operational leverage / Warwick reality',
    b: `## B — frame lens: WARWICK'S LIVED REALITY. Impact = kills a manual step he still does · catches a blind spot ·
changes what he'd do next week. He's one person, phone-first, attention is the scarcest resource; human-in-the-loop
while proving, automate once trusted. Right-now: land this idea engine; north star = proactive OUTPUTS not curation.`,
    objective: `Index on Warwick's live toil and next-actions. Find transfers that KILL a manual step, catch a blind
spot, or change what he would actually DO. Un-clever but high-Impact is EXACTLY the target here.`,
    kill: `KILL anything that would not change what Warwick actually does next week. Cleverness without operational
leverage = KILL. "Nice to have" = KILL.`,
  },
  {
    id: 'F4-commercial', name: 'Commercial / cash opportunity',
    b: `## B — frame lens: EXTERNAL VALUE. Make Fusion earn its keep; eventually not need Bellrock (Warwick's employer).
Cash surfaces route DIRECT to Warwick. Later consumers: CareerAIr, an outbound Scout. The Brain serves the F247 business.`,
    objective: `Mine EXTERNAL value: how could a mechanism/principle in the source help Fusion make money, solve OTHER
people's problems, or reduce dependence on Bellrock? This is a different objective from the internal frames — route
survivors to Warwick as category "cash".`,
    kill: `KILL anything with no plausible external buyer/beneficiary or revenue/independence path. Internal-only
improvements are NOT yours — hand those to the internal frames by dropping them here.`,
  },
  {
    id: 'F5-crossdomain', name: 'Cross-domain / weird-but-defensible',
    b: `## B — frame lens: (deliberately minimal — relevance cues are starved on purpose). Fusion = a governed personal
"second brain" that ingests sources and should proactively surface what Warwick nearly missed. That is all you get.`,
    objective: `Mine the high-NOVELTY long tail: the transfer none of the other frames would spot. Optimise DISTANCE
under a defensibility floor (the inverse of the structural frame). Try for at least one genuinely SURPRISING but still
structurally-defensible transfer.`,
    kill: `HARSHEST self-kill. A forced analogy is worse than none. If you cannot defend the structural basis in ONE
sentence a skeptic would accept, KILL it. On this adversarial poor-fit source, ZERO is a perfectly good answer — do
NOT manufacture to look clever.`,
  },
];

// ---------- branch prompt (isolated) ----------
export function branchPrompt(frame, source) {
  return `You are the Transfer Specialist of Fusion / myPKA, running as ONE isolated reasoning frame. Transfer
intelligence, NOT idea generation. RECOGNISE->ANALOGISE->TRANSFER->PROPOSE. You do NOT research/verify; NVFI is
PROVISIONAL. You MAY say "this might be mad, but…". Your OWN self-kill pass is the quality gate — there is no separate
critic. You are BLIND to every other frame; do not speculate about them.

FRAME: ${frame.name}
FRAME OBJECTIVE: ${frame.objective}
FRAME SELF-KILL CALIBRATION: ${frame.kill}

MUST HOLD: (1) WHOLE-SOURCE — consider the ENTIRE source; NEVER pre-filter for relevance; the best transfers usually
live in the part that does NOT obviously match Fusion. (2) NEVER MANUFACTURE — a forced analogy is worse than none;
ZERO is a correct, valued answer. (3) Stay in your frame's lane — emit only what THIS frame's objective targets.

${A_SLICE}

${frame.b}

## C — GOVERNANCE
${C_SLICE}

THE WHOLE CLEANED SOURCE (consider it entirely):
${source}

METHOD (one pass): RECOGNISE mechanisms (verbatim quote+timestamp) · discard the most obvious mappings ·
ANALOGISE through THIS frame's objective · TRANSFER ("SOURCE has X (quote); invariant Y; at COMPONENT Z it does W" —
name the EXACT Fusion component) · SELF-KILL per this frame's calibration (structural match or surface? already doing
it? cost? needs evidence?) · EMIT only survivors (0-6). Each candidate leads with plain-English SPIN (an
average-intellect person must get why it matters in SECONDS — no architecture shorthand), machine detail underneath.
OUTPUT — return ONLY this JSON, no preamble, no markdown fences:
{"frame":"${frame.id}","discarded_obvious":[],"candidates":[
  {"spin":{"situation":"","problem":"","implication":"","need_payoff":""},
   "source_evidence":{"quote":"","timestamp":"","named_mechanism":""},
   "transfer_reasoning":"","fusion_target":"","category":"brain|cash","lens":"",
   "nvfi":{"novelty":1,"viability":1,"fit":1,"impact":1},"traps":[{"type":"","note":""}]}
],"zero_reason":null}`;
}

// ---------- Sonnet call via claude -p ----------
// Robust against large prompts + concurrency: the prompt goes via a TEMP FILE redirected to stdin (no pipe
// backpressure/truncation), the call retries on empty/garbled output, and callers cap concurrency (see mapPool).
function oneCall(prompt, label) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tmp = path.join(os.tmpdir(), `t2call-${crypto.randomBytes(7).toString('hex')}.txt`);
    try { fs.writeFileSync(tmp, prompt); } catch (e) { resolve({ label, ok: false, error: `tmp-write: ${e.message}`, duration_ms: 0 }); return; }
    const cmd = `claude -p --output-format json --model sonnet < "${tmp.replace(/\\/g, '/')}"`;
    const ch = spawn(cmd, { shell: true });
    let out = ''; let err = '';
    const killer = setTimeout(() => { try { ch.kill('SIGKILL'); } catch { /* */ } }, 300000);
    ch.stdout.on('data', (d) => { out += d; });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('error', (e) => { err += ` spawn:${e.message}`; });
    ch.on('close', () => {
      clearTimeout(killer);
      try { fs.unlinkSync(tmp); } catch { /* */ }
      const duration_ms = Date.now() - t0;
      try {
        const j = JSON.parse(out);
        const u = j.usage || {};
        resolve({
          label, ok: true, resultText: j.result || '', duration_ms,
          cost_usd: j.total_cost_usd ?? null,
          payload_input_est: Math.ceil(prompt.length / 4), // claude -p caches the prompt → API input≈0; estimate faculty input
          output: u.output_tokens ?? 0,
          cache_creation: u.cache_creation_input_tokens ?? 0,
          cache_read: u.cache_read_input_tokens ?? 0,
        });
      } catch (e) {
        resolve({ label, ok: false, error: `${e.message} | ${(err || '(empty)').trim()}`.slice(0, 600), duration_ms, raw: out.slice(0, 400) });
      }
    });
  });
}
export async function callClaude(prompt, label) {
  let last;
  for (let a = 1; a <= 3; a++) {
    const r = await oneCall(prompt, label);
    if (r.ok) { if (a > 1) r.retries = a - 1; return r; }
    last = r;
    await new Promise((res) => setTimeout(res, 2000 * a));
  }
  return { ...last, retries: 2 };
}
// bounded-concurrency map (keeps a few claude -p calls in flight without a thundering herd)
export async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx], idx); }
  }));
  return results;
}
export function parseJSON(text) {
  let s = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}
export function reportedTotal(c) { return (c.output || 0) + (c.cache_creation || 0) + (c.cache_read || 0); }

// ---------- NON-MODEL Neo4j enrichment (AFTER emit, BEFORE convergence) — annotates, NEVER gates/deletes ----------
function terms(s) { return String(s || '').split(/[^A-Za-z0-9]+/).filter((w) => w.length > 3).slice(0, 4); }
export async function enrich(cand) {
  const mech = cand.source_evidence?.named_mechanism || cand.lens || '';
  const target = cand.fusion_target || '';
  const ann = { fired: [], not_wired_today: [] };
  // 1. novelty_to_graph — is this mechanism already in the Brain? (entity_id contains match)
  try {
    const hits = [];
    for (const t of terms(mech)) {
      const r = await rows(
        'MATCH (n) WHERE n.entity_id IS NOT NULL AND toLower(n.entity_id) CONTAINS toLower($t) '
        + 'RETURN n.entity_id AS id, n.entity_type AS type, COUNT{ (n)--() } AS deg ORDER BY deg DESC LIMIT 3', { t });
      hits.push(...r);
    }
    const uniq = [...new Map(hits.map((h) => [h.id, h])).values()].slice(0, 5);
    ann.novelty_to_graph = { status: uniq.length ? 'known_or_partial' : 'novel_to_graph', nearest: uniq.map((h) => h.id) };
    ann.fired.push('novelty_to_graph');
    // 2. established_hub — informational only (degree is anti-signal; never a ranking key)
    const hub = uniq.find((h) => h.deg >= 15);
    if (hub) { ann.established_hub = { entity: hub.id, degree: hub.deg, note: 'informational only — NOT a ranking key' }; ann.fired.push('established_hub'); }
  } catch (e) { ann.novelty_to_graph = { status: 'unavailable', error: e.message.slice(0, 120) }; }
  // 3. related_prior_decision — the graph carries a Decision node family (real signal today)
  try {
    const dhits = [];
    for (const t of [...terms(mech), ...terms(target)]) {
      const r = await rows('MATCH (d:Decision) WHERE toLower(coalesce(d.name,"")) CONTAINS toLower($t) RETURN d.name AS name LIMIT 2', { t });
      dhits.push(...r.map((x) => x.name));
    }
    if (dhits.length) { ann.related_prior_decision = [...new Set(dhits)].slice(0, 3); ann.fired.push('related_prior_decision'); }
  } catch { /* */ }
  // 4. related_active_problem — deterministic string match of target/mechanism against the live backlog
  const bl = backlog().toLowerCase();
  const hitP = [...terms(target), ...terms(mech)].filter((t) => bl.includes(t.toLowerCase()));
  if (hitP.length) { ann.related_active_problem = [...new Set(hitP)]; ann.fired.push('related_active_problem'); }
  // Honestly record what the corpus cannot support today (audit: corpus=5, no join keys)
  ann.not_wired_today = ['prior_rejection/duplication (needs idea_candidate history join)',
    'recurrence footprint (corpus too thin — ~5 docs)', 'recency/trajectory (single ingest window)'];
  return ann;
}

// ---------- convergence / lead pass (one Sonnet call) ----------
export function convergencePrompt(enriched) {
  return `You are Larry's convergence/lead pass for the Transfer-Intelligence engine. Five ISOLATED specialist frames
each ran a full transfer pass on the SAME source, blind to each other. Below are all their surviving candidates, each
tagged with its originating frame, its provisional NVFI, and NON-MODEL graph/history enrichment gathered AFTER emit.

HARD GUARDRAIL: you may NOT invent any transfer not present in the branch outputs. You cluster / dedup / classify /
flag / re-score / present ONLY. Inventing a new transfer re-introduces the sameness collapse and is a failure.

DO THIS:
1. SEMANTIC DEDUP by (fusion_target + underlying invariant), not string. Keep the best representative; MERGE
   provenance — record EVERY contributing frame.
2. PRESERVE CONFLICTS — same target, opposite recommendation ⇒ emit BOTH as a flagged conflict pair; never average.
3. CLASSIFY CONVERGENCE for any cluster reached by >=2 DISTINCT frames via DIFFERENT mechanisms:
   - "novel_independent" — the target was NOT foregrounded in the shared brief ⇒ strong novelty + convergence evidence.
   - "context_induced" — the target WAS already prominent in the shared brief ⇒ still strong Fit/Impact/priority
     evidence, but NOT strong novelty. DO NOT discard this as "prompt echo" — preserve and describe it honestly.
   - "single_frame" — only one frame found it.
   FOREGROUNDED targets (for the A-vs-B test): ${FOREGROUNDED.join(', ')}.
4. CROSS-BRANCH KILL (L2): apply each frame's own trap-reasoning to the OTHER frames' candidates. If a candidate is a
   forced/surface analogy under adversarial cross-examination, set forced_analogy=true and move it to "killed" with a
   reason (do NOT silently drop — killed items stay auditable).
5. REASON OVER GRAPH EVIDENCE (it may raise relevance, lower provisional priority, flag a prior decision, flag a
   related active problem, or strengthen novelty). Graph evidence NEVER removes a candidate — it annotates. Reflect it
   in nvfi + a one-line graph_note per candidate.
6. RE-SCORE NVFI at cluster level (do NOT average): novelty may DROP for context_induced; viability/impact CONFIDENCE
   may RISE on novel_independent convergence. Keep each branch's original scores in provenance.
7. Lead every kept candidate with plain-English SPIN (why it matters to a human in seconds); machine detail underneath.
8. ENGINE-NEUTRAL PROSE (critical): spin AND transfer_reasoning must describe the IDEA ONLY — source evidence →
   invariant → Fusion target. Do NOT mention frames, lenses, "convergence", "different angles", or that multiple
   passes agreed. That provenance lives ONLY in contributing_frames / convergence_type. The prose must read identically
   whether one frame or three produced it (these candidates are blind-scored against a single-pass engine).

INPUT (branch candidates + enrichment):
${JSON.stringify(enriched, null, 1)}

OUTPUT — return ONLY this JSON, no preamble, no fences:
{"kept":[
  {"spin":{"situation":"","problem":"","implication":"","need_payoff":""},
   "source_evidence":{"quote":"","timestamp":"","named_mechanism":""},
   "transfer_reasoning":"","fusion_target":"","category":"brain|cash","lens":"",
   "nvfi":{"novelty":1,"viability":1,"fit":1,"impact":1},
   "contributing_frames":[],"convergence_type":"single_frame|context_induced|novel_independent",
   "graph_note":"","conflict_with":null,"forced_analogy":false,"traps":[{"type":"","note":""}]}
],
 "killed":[{"fusion_target":"","frames":[],"reason":"","forced_analogy":true}],
 "conflicts":[{"target":"","a":"","b":""}],
 "convergence_summary":""}`;
}

// ---------- reusable T2 pipeline (branches → non-model enrichment → convergence) ----------
export async function runT2Pipeline(video, source, log = () => {}) {
  const bStart = Date.now();
  const branchCalls = await mapPool(FRAMES, 2, (f) => callClaude(branchPrompt(f, source), f.id));
  const branchWallMs = Date.now() - bStart;
  const branchOutputs = [];
  for (const c of branchCalls) {
    if (!c.ok) { log(`branch ${c.label} FAILED: ${c.error}`); branchOutputs.push({ frame: c.label, candidates: [], _failed: c.error }); continue; }
    let parsed; try { parsed = parseJSON(c.resultText); } catch (e) { parsed = { frame: c.label, candidates: [], zero_reason: `parse-error: ${e.message}` }; }
    (parsed.candidates || []).forEach((k) => { k._frame = c.label; });
    branchOutputs.push({ frame: c.label, ...parsed });
    log(`branch ${c.label}: ${(parsed.candidates || []).length} cand · ${reportedTotal(c).toLocaleString()} tok · ${(c.duration_ms / 1000).toFixed(1)}s`);
  }
  const flat = branchOutputs.flatMap((b) => (b.candidates || []).map((k) => ({ ...k, frame: b.frame })));
  log(`${flat.length} candidate(s) pre-convergence · enriching (non-model Neo4j)…`);
  const enriched = [];
  for (const k of flat) { const g = await enrich(k); enriched.push({ ...k, _graph: g }); }
  log('convergence pass (Sonnet)…');
  const convCall = await callClaude(convergencePrompt(enriched), 'convergence');
  let conv = { kept: [], killed: [], conflicts: [], convergence_summary: '' };
  if (convCall.ok) { try { conv = parseJSON(convCall.resultText); } catch (e) { log(`convergence parse-error: ${e.message}`); } }
  else log(`convergence FAILED: ${convCall.error}`);
  return { video, branchCalls, branchOutputs, enriched, convCall, conv, branchWallMs };
}

// ---------- artefact writers ----------
export function stars(n) { const v = Math.max(0, Math.min(5, Number(n) || 0)); return '★'.repeat(v) + '☆'.repeat(5 - v); }
function nv(x) { return x?.nvfi || {}; }
// Blind integrity: scrub frame/convergence/origin provenance from the copy Warwick scores (it lives in the KEY).
export function blindSanitize(t) {
  if (!t) return t;
  let s = String(t)
    .replace(/\bF[1-5]\b/g, 'the analysis')
    .replace(/\b(two|three|four|five|multiple|several|both|2|3|4)\s+(distinct\s+|independent\s+)*(frames?|mechanisms?|lenses?)\s+(converge\w*|agree\w*|land\w*|reach\w*|found?|identif\w*)[^.;]*/gi, 'the same target is reached')
    .replace(/\b(distinct|independent|different|separate)\s+frames?\b/gi, 'angles')
    .replace(/\bfrom (two|three|different|several|multiple)( different)? angles?\b/gi, '')
    .replace(/\bconverge(s|d|nce)?\b/gi, 'applies')
    .replace(/\bTogether:\s*/g, '')
    .replace(/\b[0-9a-f]{7,40}\b/g, '(a recent commit)')
    .replace(/[—-]?\s*see convergence_summary/gi, '')
    .replace(/thematic-sibling:[^;]*;?/gi, '')
    .replace(/overlap-with-sibling:[^;]*;?/gi, '')
    .replace(/\bconvergence_summary\b/gi, 'the analysis')
    .replace(/\bframes?\b/gi, 'lenses');
  return s.replace(/\s{2,}/g, ' ').replace(/\s+;/g, ';').trim();
}
// Drop traps that are pure frame/convergence provenance rather than a real risk to the idea.
export function blindTraps(traps) {
  return (traps || []).filter((t) => !/sibling|convergence|\bframe/i.test(`${t.type} ${t.note}`));
}

function writeBlind(kept, meta) {
  // de-correlate order from frame; strip ALL frame/convergence/origin labels
  const ordered = [...kept].sort((a, b) => (a.fusion_target || '').localeCompare(b.fusion_target || '')
    || (a.spin?.situation || '').localeCompare(b.spin?.situation || ''));
  let md = `# Idea-engine — Audi calibration · BLIND candidate set (for scoring)

> **Blind copy.** No frame, no origin, no T1/T2 label. Score each candidate on four axes, then we lift the veil.
> Source: one frozen fixture. Some candidates may be weak or wrong — that is expected on a deliberately poor-fit source;
> a low score is a valid, useful signal.

**Per candidate, please mark:**
- **DEFENSIBLE?** yes / no  — is the structural transfer sound, not a forced analogy?
- **VALUE?** low / medium / high  — if it were true and built, how much would it matter?
- **TIMING?** now / later / no  — act now, park for later, or drop?
- **SURPRISED ME?** yes / no  — did it spot something you (or Larry) would not have?

_A high-value "later" is still a win. The prize is a defensible, high-value, surprising idea._

---
`;
  ordered.forEach((k, i) => {
    const id = `C${i + 1}`;
    const s = k.spin || {};
    md += `\n## ${id}\n**${blindSanitize(s.situation) || '(no situation)'}**\n\n`;
    md += `- **Problem:** ${blindSanitize(s.problem) || '—'}\n- **Implication:** ${blindSanitize(s.implication) || '—'}\n- **Need-payoff:** ${blindSanitize(s.need_payoff) || '—'}\n\n`;
    md += `<details><summary>Details (evidence · reasoning · scores)</summary>\n\n`;
    md += `- **Suggested target:** ${blindSanitize(k.fusion_target) || '—'}\n`;
    md += `- **Transfer reasoning:** ${blindSanitize(k.transfer_reasoning) || '—'}\n`;
    const ev = k.source_evidence || {};
    md += `- **Source evidence:** ${ev.quote ? `"${ev.quote}"` : '—'} ${ev.timestamp || ''} ${ev.named_mechanism ? `(${ev.named_mechanism})` : ''}\n`;
    md += `- **Provisional scores:** Novelty ${stars(nv(k).novelty)} · Viability ${stars(nv(k).viability)} · Fit ${stars(nv(k).fit)} · Impact ${stars(nv(k).impact)}\n`;
    const bt = blindTraps(k.traps);
    if (bt.length) md += `- **Traps/risks:** ${bt.map((t) => blindSanitize(`${t.type}: ${t.note}`)).join('; ')}\n`;
    md += `\n**Your scoring — ${id}:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______\n\n</details>\n`;
  });
  md += `\n---\n_${ordered.length} candidates · generated ${meta.stamp} · calibration id ${meta.runId}_\n`;
  fs.writeFileSync(`${OUT}/idea-engine-T2-calibration-BLIND.md`, md);
  return ordered.map((k, i) => ({ blind_id: `C${i + 1}`, target: k.fusion_target, k }));
}

function writeCost(branches, conv, kept, killed, meta, enriched) {
  const bTot = branches.reduce((a, c) => a + reportedTotal(c), 0);
  const bFac = branches.reduce((a, c) => a + (c.payload_input_est || 0) + (c.output || 0), 0);
  const bWrap = branches.reduce((a, c) => a + (c.cache_creation || 0) + (c.cache_read || 0), 0);
  const bCost = branches.reduce((a, c) => a + (c.cost_usd || 0), 0);
  const cTot = reportedTotal(conv); const cFac = (conv.payload_input_est || 0) + (conv.output || 0);
  const cWrap = (conv.cache_creation || 0) + (conv.cache_read || 0);
  const whole = bTot + cTot; const wholeFac = bFac + cFac; const wholeWrap = bWrap + cWrap;
  const wholeCost = bCost + (conv.cost_usd || 0);
  const branchWall = Math.max(...branches.map((b) => b.duration_ms || 0));
  const wall = branchWall + (conv.duration_ms || 0);
  const row = (c) => `| ${c.label} | ${c.payload_input_est ?? '—'} | ${c.output ?? '—'} | ${c.cache_creation ?? '—'} | ${c.cache_read ?? '—'} | **${reportedTotal(c)}** | ${c.cost_usd != null ? `$${c.cost_usd.toFixed(4)}` : '—'} | ${((c.duration_ms || 0) / 1000).toFixed(1)}s |`;
  const convA = kept.filter((k) => k.convergence_type === 'novel_independent');
  const convB = kept.filter((k) => k.convergence_type === 'context_induced');
  const forcedSurv = kept.filter((k) => k.forced_analogy);
  const annFired = [...new Set(enriched.flatMap((e) => e._graph?.fired || []))];
  let md = `# Idea-engine — Audi calibration · TECHNICAL / COST report

**Calibration id:** ${meta.runId} · **source:** ${VIDEO} ("How Audi Cheated in 1988") · **frozen fixture #4** (adversarial poor-fit) · **${meta.stamp}**
**Path:** 5 isolated Sonnet branches (parallel) → non-model Neo4j enrichment → 1 Sonnet convergence pass. No Fable, no Opus.

## Real measured usage (per \`claude -p\` call)
| call | faculty payload-in (est) | model output | cache creation | cache read | **TOTAL reported** | cost | wall |
|---|---|---|---|---|---|---|---|
${branches.map(row).join('\n')}
${row(conv)}

> **payload-in is ESTIMATED** (\`prompt.length/4\`): \`claude -p\` caches the whole prompt so the API reports input≈0.
> **TOTAL reported = output + cache_creation + cache_read** — the real Claude-Code usage, wrapper/cache included.

## Whole-T2 (this calibration)
| metric | value |
|---|---|
| **Actual reported total** | **${whole.toLocaleString()} tokens** |
| — faculty/payload estimate (transfer reasoning) | ${wholeFac.toLocaleString()} tokens |
| — wrapper/cache overhead (cache creation+read) | ${wholeWrap.toLocaleString()} tokens |
| Reported \`total_cost_usd\` (Max-sub, indicative) | $${wholeCost.toFixed(4)} |
| Wall-clock (5 branches parallel ${(branchWall / 1000).toFixed(1)}s + convergence ${((conv.duration_ms || 0) / 1000).toFixed(1)}s) | **${(wall / 1000).toFixed(1)}s** |

**Apples-to-apples vs T1 (the correction):** a production T1 Mine reported **~144k total** through \`claude -p\`
(wrapper-dominated), NOT the ~50k/75k faculty figures. This T2 calibration's **actual reported total is ${whole.toLocaleString()}**,
i.e. **~${(whole / 144000).toFixed(1)}× a real T1 Mine** — measured, not asserted. Faculty reasoning is only ${wholeFac.toLocaleString()}
of that; the rest is the same wrapper/cache overhead T1 carries, ×${branches.length + 1} calls.

## Candidate flow
| stage | count |
|---|---|
| emitted by branches (pre-convergence) | ${meta.preCount} |
| after dedup / cross-branch kill | ${kept.length} |
| killed at L2 (cross-branch) | ${killed.length} |
| conflicts preserved | ${meta.conflicts} |
| forced-analogy survivors (flagged, not killed) | ${forcedSurv.length} |

## Convergence findings
- **Novel-independent convergence:** ${convA.length}${convA.length ? ` — ${convA.map((k) => k.fusion_target).join(', ')}` : ' (none)'}
- **Context-induced convergence:** ${convB.length}${convB.length ? ` — ${convB.map((k) => k.fusion_target).join(', ')}` : ' (none)'}
- **Killed at L2:** ${killed.length ? killed.map((k) => `${k.fusion_target} (${k.reason})`).join('; ') : '(none)'}

## Graph annotations ACTUALLY available today
- **Fired this run:** ${annFired.length ? annFired.join(', ') : '(none fired — expected on a poor-fit source)'}
- **Not wired today (honest):** prior_rejection/duplication (needs idea_candidate history join) · recurrence footprint (corpus ≈5 docs) · recency/trajectory (single ingest window).
- Enrichment ran AFTER branches emitted, BEFORE convergence. It NEVER gated generation and NEVER deleted a candidate.

## Per-branch health
${branches.map((b) => `- **${b.label}** — ${b.ok ? 'ok' : `FAILED: ${b.error}`}`).join('\n')}
`;
  fs.writeFileSync(`${OUT}/idea-engine-T2-calibration-COST.md`, md);
  return { whole, wholeFac, wholeWrap, wholeCost, wall, convA: convA.length, convB: convB.length };
}

function writeKey(blindMap, kept, killed, branchOutputs, meta) {
  let md = `# Idea-engine — Audi calibration · HELD KEY (do NOT open until Warwick has scored the blind set)

**Calibration id:** ${meta.runId} · ${meta.stamp}. This is the origin/frame/convergence key for the blind candidates,
plus the T1 comparison. Held per Warwick's instruction: reveal only after the blind scoring is in.

## Blind-id → frame attribution & convergence
| blind id | target | contributing frames | convergence | forced-analogy | graph note |
|---|---|---|---|---|---|
`;
  blindMap.forEach((m) => {
    const k = m.k;
    md += `| ${m.blind_id} | ${k.fusion_target || '—'} | ${(k.contributing_frames || []).join(', ') || '—'} | ${k.convergence_type || '—'} | ${k.forced_analogy ? 'YES' : 'no'} | ${(k.graph_note || '—').slice(0, 80)} |\n`;
  });
  md += `\n## Killed at L2 (cross-branch kill — auditable, not silently dropped)\n`;
  md += killed.length ? killed.map((k) => `- **${k.fusion_target}** (frames: ${(k.frames || []).join(', ')}) — ${k.reason}`).join('\n') : '_(none)_';
  md += `\n\n## T1 comparison (baseline = frozen-fixture EXPERIMENT Audi run, origin='experiment')\n`;
  md += `The Audi fixture (#4) was expected to yield **zero/few** despite intellectual richness — the Fit critic must earn
its keep. In the frozen 6-fixture experiment, the blind T1/Sonnet Audi pass produced a small set of heavily-caveated
cross-domain transfers (imported to \`cockpit.idea_candidate\`, origin='experiment'). A clean same-runner T1-vs-T2
head-to-head on Audi would need one production T1 Mine (~144k) — deliberately NOT run in this calibration (cost
discipline; Warwick authorised ONE T2 run). Recommend deferring the T1-vs-T2 quality verdict to the full six-fixture
experiment, as Warwick specified.\n`;
  md += `\n## Raw branch outputs (provenance)\n`;
  branchOutputs.forEach((b) => {
    md += `\n### ${b.frame} — ${(b.candidates || []).length} candidate(s)${b.zero_reason ? ` · zero_reason: ${b.zero_reason}` : ''}\n`;
    (b.candidates || []).forEach((c) => { md += `- ${c.fusion_target}: ${c.spin?.situation || c.transfer_reasoning || ''}\n`; });
  });
  fs.writeFileSync(`${OUT}/idea-engine-T2-calibration-KEY.md`, md);
}

function emitArtefacts(runId, branchCalls, branchOutputs, enriched, convCall, conv) {
  const flatCount = branchOutputs.flatMap((b) => b.candidates || []).length;
  const kept = conv.kept || []; const killed = conv.killed || [];
  const meta = { runId, stamp: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', preCount: flatCount, conflicts: (conv.conflicts || []).length };
  const blindMap = writeBlind(kept, meta);
  const totals = writeCost(branchCalls, convCall, kept, killed, meta, enriched);
  writeKey(blindMap, kept, killed, branchOutputs, meta);
  return { kept, killed, flatCount, totals, conv };
}

// ---------- main ----------
async function main() {
  // --regen <rawfile>: rebuild the 3 artefacts from a prior raw dump (no Sonnet calls) — e.g. after a formatting fix.
  if (process.argv[2] === '--regen') {
    const raw = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    const r = emitArtefacts(raw.runId, raw.branchCalls, raw.branchOutputs, raw.enriched, raw.convCall, raw.conv);
    console.log(JSON.stringify({ ok: true, regen: raw.runId, kept: r.kept.length, reported_total: r.totals.whole }, null, 2));
    return;
  }
  const runId = crypto.randomUUID().slice(0, 8);
  const stampFile = `${OUT}/idea-engine-T2-calibration-raw-${runId}.json`;
  const source = await getSource(VIDEO);
  console.error(`[t2] runId ${runId} · source ${VIDEO} ${source.length} chars · launching ${FRAMES.length} isolated branches (Sonnet, parallel)…`);

  const { branchCalls, branchOutputs, enriched, convCall, conv } = await runT2Pipeline(VIDEO, source, (m) => console.error(`[t2] ${m}`));

  // artefacts (persist raw FIRST so a formatting regen is always possible without re-running Sonnet)
  fs.writeFileSync(stampFile, JSON.stringify({ runId, video: VIDEO, branchCalls, branchOutputs, enriched, convCall, conv }, null, 1));
  const { totals } = emitArtefacts(runId, branchCalls, branchOutputs, enriched, convCall, conv);
  const kept = conv.kept || []; const killed = conv.killed || [];
  const flat = enriched;

  console.log(JSON.stringify({
    ok: true, runId, source: VIDEO,
    branches: branchCalls.map((c) => ({ frame: c.label, ok: c.ok, candidates: branchOutputs.find((b) => b.frame === c.label)?.candidates?.length ?? 0, reported: reportedTotal(c), s: +(c.duration_ms / 1000).toFixed(1) })),
    pre_convergence: flat.length, kept: kept.length, killed: killed.length,
    convergence: { novel_independent: totals.convA, context_induced: totals.convB, summary: conv.convergence_summary },
    whole_t2: { reported_total: totals.whole, faculty_est: totals.wholeFac, wrapper_overhead: totals.wholeWrap, cost_usd: +totals.wholeCost.toFixed(4), wall_s: +(totals.wall / 1000).toFixed(1), x_vs_t1: +(totals.whole / 144000).toFixed(2) },
    artefacts: ['idea-engine-T2-calibration-BLIND.md', 'idea-engine-T2-calibration-COST.md', 'idea-engine-T2-calibration-KEY.md', stampFile.split('/').pop()],
  }, null, 2));
}
// Only auto-run as a CLI; stay importable as a library (the experiment orchestrator reuses the pipeline).
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('t2-calibrate.mjs')) {
  main().catch((e) => { console.error('[t2] FAILED:', e.stack || e.message); process.exit(1); });
}
