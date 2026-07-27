// Transfer-Intelligence T1 runner (IDEA-016). One human-triggered "Mine for ideas":
//   assemble fresh A+B+C brief (hashed) → read the WHOLE cleaned source → ONE Sonnet claude -p call
//   → parse candidates (provenance triple + provisional NVFI + traps) → store durably + log the token
//   breakdown SEPARATED into faculty-payload vs Claude-Code-wrapper (Path-A acceptance requirement).
// Brain candidates land needing Larry reconciliation; Cash candidates go straight to Warwick.
// Preserves the graph-wide suggestions.mjs as a separate capability — this does not touch it.
//   node --env-file=C:/.fusion247/fusion-capture-gateway.env services/control-plane/cockpit/mine-ideas.mjs <video_id>
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { upsertAtom, verifyEvidence } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/atom-register.mjs';

const REPO = 'C:/Fusion247PKA';
const COCKPIT = process.env.COCKPIT_URL || 'http://127.0.0.1:8090';

// ---- A+B+C brief assembly (fresh per mine, hashed) ----
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

export function assembleBrief() {
  let now = '';
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO }).toString().trim();
    const log = execSync('git log --oneline -5', { cwd: REPO }).toString().trim();
    now = `branch ${branch}\n${log}`;
  } catch { now = '(git unavailable)'; }
  let problems = '';
  try { problems = fs.readFileSync(`${REPO}/Deliverables/BACKLOG.md`, 'utf8').split(/\r?\n/).filter((l) => /^- \*\*\[/.test(l)).slice(0, 8).join('\n'); } catch { /* */ }
  let bSeed = '(no curated_seed found)';
  try { bSeed = fs.readFileSync(`${REPO}/Team Knowledge/fusion-brief/warwick-context.curated_seed.md`, 'utf8').replace(/^---[\s\S]*?---\n/, '').trim(); } catch { /* */ }
  const text = `# FUSION BRIEF (A live · B curated_seed · C files)\n\n## A - SELF-MODEL\n### Roster (seed)\n${ROSTER_SEED}\n### Happening now (git-live)\n${now}\n### Current problems (backlog)\n${problems}\n\n## B - WARWICK CONTEXT (provenance: curated_seed, NOT Honcho)\n${bSeed}\n\n## C - GOVERNANCE\n${C_SLICE}\n`;
  const hash = crypto.createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);
  return { text, hash };
}

async function getSource(video) {
  const r = await fetch(`${COCKPIT}/api/transcript?video=${encodeURIComponent(video)}`);
  const j = await r.json();
  if (!j.ok) throw new Error('no transcript: ' + j.error);
  return j.text;
}

// TRANSFER DOMAINS — Arc's legitimate search space (Warwick's canonical correction 2026-07-27). Arc is NOT limited to
// mechanism→component mappings; strategic / career / commercial / reputation implications are IN scope, not
// Source-Intelligence-only territory. These domains may overlap.
export const TRANSFER_DOMAINS = `TRANSFER DOMAINS Arc must scan for (they overlap — a transfer may hit several):
- Fusion/system improvements (a component works better)
- architecture / technical patterns (how to build it)
- operational / process patterns (how work gets done)
- Warwick workflow / attention (his scarcest resource; kills a manual step, catches a blind spot)
- career implications for Warwick (skills, positioning, CareerAIr)
- commercial / money opportunities (Fusion earns its keep; reduce Bellrock dependence)
- product / service possibilities (something buildable for others)
- public reputation / distribution (building-in-public, audience, authority, proof-of-work)
- strategic warnings (dependency/lock-in risk, a bet that ages badly, a threat to act on)
- cross-domain / weird-but-defensible transfers (the leap no obvious lens would make)`;

export function buildPrompt(brief, source, mineId) {
  return `You are Arc, the Transfer Specialist of Fusion / myPKA. Transfer intelligence, NOT idea generation. Your job:
spot worthwhile transfers and implications from ONE source that Warwick might NOT independently notice — across ALL the
transfer domains below, NOT only neat mechanism→component mappings. A strategic warning, a career/reputation implication
or a commercial seed is as legitimate a transfer as a technical one.
Verbs: RECOGNISE->ANALOGISE->TRANSFER->PROPOSE. You do NOT research/verify. NVFI scores PROVISIONAL. You MAY say "this might be mad, but…"; NO separate critic — your own kill-pass is the quality gate. Mason (downstream) controls Warwick's attention, so FAVOUR RECALL — the register stores everything; a real transfer you drop is lost forever, a marginal one you keep costs almost nothing.
MUST HOLD: (1) WHOLE-SOURCE — consider the ENTIRE source; NEVER pre-filter for relevance; the best transfers often live in the part that does NOT obviously match Fusion. (2) NEVER MANUFACTURE — a forced analogy is worse than none; but do NOT confuse "obvious" with "low value" (see admission rule). (3) SOURCE-GROUNDED — every candidate cites a verbatim quote + its timestamp from the source below.

${TRANSFER_DOMAINS}

FUSION BRIEF (brief_hash ${assembleBrief.__hash || ''}):
${brief}

MINE_ID: ${mineId}

THE FACTUAL SOURCE-CORE (claims · mechanisms · examples · people/tools · evidence/timestamps · caveats · source-derived themes — consider it entirely):
${source}

ADMISSION RULE (replaces "discard the obvious"): judge each transfer on TWO axes — is it OBVIOUS, and what is its INCREMENTAL VALUE?
- OBVIOUS + LOW incremental value → discard (into discarded_obvious).
- OBVIOUS + HIGH material value → KEEP. An externally-derived VALIDATION or IMPLEMENTATION-SHARPENING of a direction Fusion is already pursuing is valuable EVIDENCE even when the broad idea already exists — do NOT kill it as "already said" or "already doing it"; keep it and mark admission.kind = validation|sharpening.
- NON-OBVIOUS → keep if defensible.
Set each candidate's "admission": {"obvious":true|false, "value":"low|medium|high", "kind":"new|validation|sharpening"}.

METHOD (one pass): RECOGNISE mechanisms/claims/examples/themes (verbatim quote+timestamp) · ANALOGISE across the transfer domains (push past the obvious mapping to the ones only this source reveals) · TRANSFER ("SOURCE says X (quote); the transferable invariant is Y; for Warwick/Fusion this means W" — name the exact target where there is one, else the domain) · SELF-CRITIQUE (forced/surface analogy? -> kill or caveat; genuine but obvious+high-value? -> KEEP per admission rule; risks->traps) · EMIT every survivor (no fixed cap; favour recall).
Each candidate leads with plain-English SPIN (an average-intellect person must get why it matters in SECONDS - no jargon), machine detail underneath:
{"spin":{"situation":"what's happening today / what makes this relevant","problem":"what's wrong, missing, inefficient or exposed","implication":"why Warwick should care - cost/risk/block if we do nothing","need_payoff":"what concretely gets better if we act"},
 "source_evidence":{"quote","timestamp","named_mechanism"},"transfer_reasoning":"the leap","fusion_target":"exact target or domain","category":"brain"|"cash","lens","domain":"one transfer domain","admission":{"obvious":false,"value":"medium","kind":"new"},"nvfi":{"novelty":1-5,"viability":1-5,"fit":1-5,"impact":1-5},"traps":[{"type","note"}]}
(NVFI = how the machine ranks it - Novelty=non-obvious? Viability=doable? Fit=aligns with Fusion/Warwick? Impact=if true, how much would it MATERIALLY matter? - a validation/sharpening can be low-novelty but high-impact.) Write SPIN in second person to Warwick, no jargon.
ZERO RULE: on a genuinely thin/irrelevant source, nothing survives ⇒ candidates:[] + one-line zero_reason. Never pad a thin source - but a rich, relevant source should yield MANY transfers.
OUTPUT — return ONLY this JSON, no preamble, no markdown fences:
{"mine_id":"${mineId}","brief_hash":"${assembleBrief.__hash || ''}","discarded_obvious":[],"candidates":[],"zero_reason":null}`;
}

function callClaude(prompt) {
  const t0 = Date.now();
  const raw = execSync('claude -p --output-format json --model sonnet', { input: prompt, maxBuffer: 32 * 1024 * 1024, timeout: 300000 }).toString();
  const j = JSON.parse(raw);
  const u = j.usage || {};
  return {
    resultText: j.result || '',
    duration_ms: Date.now() - t0,
    cost_usd: j.total_cost_usd ?? null,
    payload_input: u.input_tokens ?? null,
    output: u.output_tokens ?? null,
    cache_creation: u.cache_creation_input_tokens ?? null,
    cache_read: u.cache_read_input_tokens ?? null,
  };
}

function parseCandidates(text) {
  let s = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

async function main() {
  const video = process.argv[2];
  if (video === '--brief') { const b = assembleBrief(); console.log('brief_hash', b.hash, '·', b.text.length, 'chars\n'); console.log(b.text); return; }
  if (!video) throw new Error('usage: mine-ideas.mjs <video_id>');
  const { text: brief, hash } = assembleBrief();
  assembleBrief.__hash = hash;
  const source = await getSource(video);
  const mineId = crypto.randomUUID();
  const prompt = buildPrompt(brief, source, mineId);
  console.error(`[mine] ${video} · brief_hash ${hash} · source ${source.length} chars · calling Sonnet…`);
  const call = callClaude(prompt);
  const out = parseCandidates(call.resultText);
  const cands = out.candidates || [];

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // claude -p CACHES the whole prompt, so API input_tokens reads ~0 — estimate the faculty INPUT from
  // the prompt size instead (~4 chars/token). faculty = payload_in_est + output; wrapper = everything else.
  const payloadInEst = Math.ceil(prompt.length / 4);
  call.payload_input = payloadInEst;
  const total = (call.output || 0) + (call.cache_creation || 0) + (call.cache_read || 0) + 4;
  // Transactional (Fable F8): the mine row, its 'mined' event, the candidates, AND the register atoms all commit
  // together or roll back — no partial mine with a lying count, no half-populated register.
  await c.query('begin');
  try {
    const mine = (await c.query(
      `insert into cockpit.idea_mine (mine_id, source_ref, brief_hash, brief_snapshot, discarded_obvious, zero_reason,
          payload_input_tokens, output_tokens, wrapper_cache_creation_tokens, wrapper_cache_read_tokens, total_reported_tokens, cost_usd, duration_ms)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning mine_id`,
      [mineId, video, hash, brief, JSON.stringify(out.discarded_obvious || []), out.zero_reason || null,
        call.payload_input, call.output, call.cache_creation, call.cache_read, total, call.cost_usd, call.duration_ms],
    )).rows[0].mine_id;
    void mine;
    await c.query(`insert into cockpit.idea_event (mine_id, actor, event, note) values ($1,'specialist','mined',$2)`,
      [mineId, `${cands.length} candidates`]);
    for (const k of cands) {
      const cat = (k.category === 'cash') ? 'cash' : 'brain';
      const ev = verifyEvidence(k.source_evidence, source); // Fable F5: flag hallucinated/empty quotes, never silently trust
      const cid = (await c.query(
        `insert into cockpit.idea_candidate (mine_id, brief_hash, source_evidence, transfer_reasoning, fusion_target, spin, category, lens, nvfi, traps, lifecycle_state)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed') returning candidate_id`,
        [mineId, hash, JSON.stringify(ev), k.transfer_reasoning || '', k.fusion_target || '', JSON.stringify(k.spin || {}),
          cat, k.lens || '', JSON.stringify(k.nvfi || {}), JSON.stringify(k.traps || [])],
      )).rows[0].candidate_id;
      await c.query(`insert into cockpit.idea_event (candidate_id, mine_id, actor, event, note) values ($1,$2,'specialist','emitted',$3)`,
        [cid, mineId, cat]);
      // Fable B1: production candidates ALSO land in the durable atom register, so Mason actually sees them.
      await upsertAtom(c, {
        source_ref: video, engine: 'T1', frames: [], convergence: 'single', category: cat,
        fusion_target: k.fusion_target || '', spin: k.spin || {}, transfer_reasoning: k.transfer_reasoning || '',
        source_evidence: ev, nvfi: k.nvfi || {}, meta: { traps: k.traps || [], forced_analogy: false }, origin: 'production',
      });
    }
    await c.query('commit');
  } catch (e) { try { await c.query('rollback'); } catch { /* */ } await c.end(); throw e; }
  await c.end();

  console.log(JSON.stringify({
    ok: true, mine_id: mineId, brief_hash: hash, candidates: cands.length,
    brain: cands.filter((k) => k.category !== 'cash').length, cash: cands.filter((k) => k.category === 'cash').length,
    zero_reason: out.zero_reason || null,
    tokens: { FACULTY_payload_input: call.payload_input, FACULTY_output: call.output,
      WRAPPER_cache_creation: call.cache_creation, WRAPPER_cache_read: call.cache_read, total_reported: total },
    cost_usd: call.cost_usd, duration_ms: call.duration_ms,
  }, null, 2));
}
// Only auto-run as a CLI; stay importable (the T1-vs-T2 experiment reuses buildPrompt/assembleBrief).
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('mine-ideas.mjs')) {
  main().catch((e) => { console.error('[mine] FAILED:', e.message); process.exit(1); });
}
