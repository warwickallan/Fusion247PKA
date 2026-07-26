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

function assembleBrief() {
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

function buildPrompt(brief, source, mineId) {
  return `You are the Transfer Specialist of Fusion / myPKA. Transfer intelligence, NOT idea generation. Find where a mechanism, principle, surprising observation, failure-mode or causal claim from ONE source could GENUINELY improve a specific Fusion component — including non-obvious, cross-domain transfer.
Verbs: RECOGNISE->ANALOGISE->TRANSFER->PROPOSE. You do NOT research/verify. NVFI scores PROVISIONAL. You MAY say "this might be mad, but…"; NO separate critic — your own kill-pass (E) is the quality gate.
MUST HOLD: (1) WHOLE-SOURCE — consider the ENTIRE source; NEVER pre-filter for relevance; the best transfers usually live in the part that does NOT obviously match Fusion. (2) NEVER MANUFACTURE — a forced analogy is worse than none; ZERO is a correct, valued answer.

FUSION BRIEF (brief_hash ${assembleBrief.__hash || ''}):
${brief}

MINE_ID: ${mineId}

THE WHOLE CLEANED SOURCE (consider it entirely):
${source}

METHOD (one pass): A RECOGNISE (mechanisms w/ verbatim quote+timestamp) · B FIRST-THREE-DISCARD (bin the 3 most obvious mappings into discarded_obvious) · C ANALOGISE via lenses [mechanism,constraint,failure_mode,incentive,structure,inversion,scale,feedback] (push past obvious) · D TRANSFER ("SOURCE has X(quote); invariant Y; at COMPONENT Z it does W"; name the EXACT Fusion component; use B priorities + C governance for PROVISIONAL Fit+Impact; flag any C breach) · E SELF-CRITIQUE/KILL (real structural match or surface? already doing it? cost? needs evidence? drop superficial; risks->traps) · F EMIT 3-7 only if they survive E, else fewer/zero.
Each candidate MUST lead with plain-English SPIN (the human-facing layer — an average-intellect person must get why it matters in SECONDS, NO architecture shorthand), with the machine detail preserved underneath:
{"spin":{"situation":"plain-English: what's happening today / what context makes this relevant","problem":"what is wrong, missing, inefficient or exposed","implication":"why Warwick should care — what this costs, blocks, risks or prevents if we do nothing","need_payoff":"what concretely gets better if we act"},
 "source_evidence":{"quote","timestamp","named_mechanism"},"transfer_reasoning":"the analogical leap","fusion_target":"the EXACT Fusion component","category":"brain"|"cash","lens","nvfi":{"novelty":1-5,"viability":1-5,"fit":1-5,"impact":1-5},"traps":[{"type","note"}]}
(SPIN = why it matters to a human; NVFI = how the machine ranks it — Novelty=non-obvious? Viability=realistically doable? Fit=aligns with Fusion/Warwick? Impact=if it worked, how much would it MATERIALLY matter?). Write SPIN in second person to Warwick, no jargon.
ZERO RULE: nothing survives ⇒ candidates:[] + one-line zero_reason. Never pad.
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
  const mine = (await c.query(
    `insert into cockpit.idea_mine (mine_id, source_ref, brief_hash, brief_snapshot, discarded_obvious, zero_reason,
        payload_input_tokens, output_tokens, wrapper_cache_creation_tokens, wrapper_cache_read_tokens, total_reported_tokens, cost_usd, duration_ms)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning mine_id`,
    [mineId, video, hash, brief, JSON.stringify(out.discarded_obvious || []), out.zero_reason || null,
      call.payload_input, call.output, call.cache_creation, call.cache_read, total, call.cost_usd, call.duration_ms],
  )).rows[0].mine_id;
  await c.query(`insert into cockpit.idea_event (mine_id, actor, event, note) values ($1,'specialist','mined',$2)`,
    [mineId, `${cands.length} candidates`]);
  for (const k of cands) {
    const cat = (k.category === 'cash') ? 'cash' : 'brain';
    const cid = (await c.query(
      `insert into cockpit.idea_candidate (mine_id, brief_hash, source_evidence, transfer_reasoning, fusion_target, spin, category, lens, nvfi, traps, lifecycle_state)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed') returning candidate_id`,
      [mineId, hash, JSON.stringify(k.source_evidence || {}), k.transfer_reasoning || '', k.fusion_target || '', JSON.stringify(k.spin || {}),
        cat, k.lens || '', JSON.stringify(k.nvfi || {}), JSON.stringify(k.traps || [])],
    )).rows[0].candidate_id;
    await c.query(`insert into cockpit.idea_event (candidate_id, mine_id, actor, event, note) values ($1,$2,'specialist','emitted',$3)`,
      [cid, mineId, cat]);
  }
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
main().catch((e) => { console.error('[mine] FAILED:', e.message); process.exit(1); });
