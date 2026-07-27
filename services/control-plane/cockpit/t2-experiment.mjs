// T1-vs-T2 FROZEN EXPERIMENT orchestrator (IDEA-016) — the go/no-go run Warwick authorised.
// For each of the 6 frozen fixtures: run the PRODUCTION T1 baseline (one Sonnet call, mine-ideas contract) AND the
// T2 pipeline (5 isolated branches → non-model Neo4j enrichment → convergence). Merge each fixture's T1+T2 candidates
// de-labelled + provenance-scrubbed for BLIND scoring (DEFENSIBLE/VALUE/TIMING/SURPRISED). Hold the origin/frame KEY.
// Audi (fixture #4) T2 is REUSED from the calibration raw dump — not re-spent. Per-fixture raw persisted as we go.
// Sonnet throughout. No Fable. No Opus.
//   node --env-file=C:/.fusion247/neo4j.env services/control-plane/cockpit/t2-experiment.mjs [csv-video-ids]
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  runT2Pipeline, callClaude, parseJSON, reportedTotal, getSource, blindSanitize, blindTraps, stars,
} from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/t2-calibrate.mjs';
import { assembleBrief, buildPrompt } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/mine-ideas.mjs';

const OUT = 'C:/Fusion247PKA/Deliverables';

// All six run T1 + T2 FRESH in one session under ONE frozen brief state, so every fixture is on identical footing.
// (The earlier Audi calibration is NOT reused — its brief's git-live "happening now" slice was a different HEAD, a
// methodological difference; on Max the marginal cash of rerunning is £0, so protocol-identity wins.)
const FIXTURES = [
  { n: 1, id: 'm6IXL_YGqBQ', label: 'AI-agent skill (ADHD)', cls: 'rich, same-domain positive' },
  { n: 2, id: 'MO3vBmrYyHI', label: 'Running a business — 4 tasks', cls: 'rich, non-AI, transferable' },
  { n: 3, id: 'eW_vxrjvERk', label: 'Context Graphs (Neo4j)', cls: 'rich, high-relevance positive' },
  { n: 4, id: 'n5G26mmJ7I0', label: 'How Audi Cheated in 1988', cls: 'rich, adversarial POOR-FIT' },
  { n: 5, id: 'Vr6FKXu8nq4', label: 'Clean an Air Fryer (26s)', cls: 'thin / negative' },
  { n: 6, id: 'tebWhVlxSmQ', label: 'Clean an Air Fryer (7s)', cls: 'thin / negative' },
];

// ---------- T1 baseline (one Sonnet call, faithful to the production runner's contract) ----------
async function runT1(video, source, log) {
  const { text: brief, hash } = assembleBrief();
  assembleBrief.__hash = hash;
  const mineId = crypto.randomUUID();
  const call = await callClaude(buildPrompt(brief, source, mineId), 'T1');
  let out = { candidates: [], zero_reason: null };
  let failed = false; // Fable F4: a T1 call/parse FAILURE must not read as a genuine zero downstream
  if (call.ok) { try { out = parseJSON(call.resultText); } catch (e) { out.zero_reason = `parse-error: ${e.message}`; failed = true; } }
  else { failed = true; out.zero_reason = `T1 call FAILED: ${call.error}`; log(`T1 FAILED: ${call.error}`); }
  log(`T1: ${failed ? 'FAILED' : (out.candidates || []).length + ' candidate(s)'} · ${reportedTotal(call).toLocaleString()} tok · ${(call.duration_ms / 1000).toFixed(1)}s`);
  return { call, candidates: out.candidates || [], zero_reason: out.zero_reason, failed };
}

// ---------- shared blind card renderer (identical for T1 and T2 candidates — nothing reveals origin) ----------
function nv(k) { return k?.nvfi || {}; }
function card(id, k) {
  const s = k.spin || {}; const ev = k.source_evidence || {};
  let md = `\n#### ${id}\n**${blindSanitize(s.situation) || '(no situation)'}**\n\n`;
  md += `- **Problem:** ${blindSanitize(s.problem) || '—'}\n- **Implication:** ${blindSanitize(s.implication) || '—'}\n- **Need-payoff:** ${blindSanitize(s.need_payoff) || '—'}\n\n`;
  md += `<details><summary>Details (evidence · reasoning · scores)</summary>\n\n`;
  md += `- **Suggested target:** ${blindSanitize(k.fusion_target) || '—'}\n`;
  md += `- **Transfer reasoning:** ${blindSanitize(k.transfer_reasoning) || '—'}\n`;
  md += `- **Source evidence:** ${ev.quote ? `"${ev.quote}"` : '—'} ${ev.timestamp || ''} ${ev.named_mechanism ? `(${ev.named_mechanism})` : ''}\n`;
  md += `- **Provisional scores:** Novelty ${stars(nv(k).novelty)} · Viability ${stars(nv(k).viability)} · Fit ${stars(nv(k).fit)} · Impact ${stars(nv(k).impact)}\n`;
  const bt = blindTraps(k.traps);
  if (bt.length) md += `- **Traps/risks:** ${bt.map((t) => blindSanitize(`${t.type}: ${t.note}`)).join('; ')}\n`;
  md += `\n**Your scoring — ${id}:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______\n\n</details>\n`;
  return md;
}
// deterministic within-fixture shuffle so T1/T2 don't cluster (no Math.random → regen-stable)
function shuffleKey(k) { return crypto.createHash('sha256').update(`${k.fusion_target || ''}|${k.spin?.situation || ''}`).digest('hex'); }

function writeArtefacts(results, runId) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  let blind = `# Idea-engine — FROZEN T1-vs-T2 experiment · BLIND candidate set (for scoring)

> **Blind copy.** Within each source, candidates from BOTH engines are merged, shuffled, de-labelled and
> provenance-scrubbed — you cannot tell which engine produced which, by design. Score each on four axes; the origin
> key is held until your scores are in. Thin/poor-fit sources are expected to yield little — a low score is useful signal.

**Per candidate:** DEFENSIBLE? y/n · VALUE? low/med/high · TIMING? now/later/no · SURPRISED-ME? y/n
_A high-value "later" is still a win. The prize is a defensible, high-value, surprising idea one engine found and the other missed._

---
`;
  let key = `# Idea-engine — FROZEN T1-vs-T2 experiment · HELD KEY (open only after Warwick has scored)

**Run ${runId} · ${stamp}.** Origin (T1/T2), T2 frame attribution + convergence, per-fixture counts. Held per protocol.
`;
  let globalId = 0; const keyRows = [];
  for (const r of results) {
    const t1 = r.t1.candidates.map((k) => ({ ...k, _origin: 'T1' }));
    const t2 = (r.t2?.conv?.kept || []).map((k) => ({ ...k, _origin: 'T2' }));
    const merged = [...t1, ...t2].sort((a, b) => shuffleKey(a).localeCompare(shuffleKey(b)));
    blind += `\n## Source ${r.fixture.n} — ${r.fixture.label}  \n_${r.fixture.cls}_\n`;
    if (!merged.length) { blind += `\n_Both engines emitted zero here — nothing to score (expected for this source class)._\n`; }
    merged.forEach((k) => {
      globalId += 1; const id = `E${globalId}`;
      blind += card(id, k);
      keyRows.push({ id, fixture: `${r.fixture.n} ${r.fixture.label}`, origin: k._origin,
        target: (k.fusion_target || '—').slice(0, 70),
        frames: (k.contributing_frames || []).join(', ') || '—',
        conv: k.convergence_type || '—', forced: k.forced_analogy ? 'YES' : '' });
    });
  }
  blind += `\n---\n_run ${runId} · ${stamp}_\n`;

  key += `\n## Origin key (blind id → engine)\n| id | source | engine | target | T2 frames | convergence | forced |\n|---|---|---|---|---|---|---|\n`;
  keyRows.forEach((x) => { key += `| ${x.id} | ${x.fixture} | **${x.origin}** | ${x.target} | ${x.frames} | ${x.conv} | ${x.forced} |\n`; });
  key += `\n## Per-fixture counts\n| source | class | T1 candidates | T2 candidates | T2 novel-independent | T2 context-induced | T2 L2-killed |\n|---|---|---|---|---|---|---|\n`;
  for (const r of results) {
    const kept = r.t2?.conv?.kept || [];
    key += `| ${r.fixture.n} ${r.fixture.label} | ${r.fixture.cls} | ${r.t1.candidates.length} | ${kept.length} | ${kept.filter((k) => k.convergence_type === 'novel_independent').length} | ${kept.filter((k) => k.convergence_type === 'context_induced').length} | ${(r.t2?.conv?.killed || []).length} |\n`;
  }
  key += `\n> **T2-exclusive** = a scored T2 candidate with no semantic twin in the same source's T1 set. Compute AFTER scoring; that is the go/no-go headline (defensible + high-value + surprising, that T1 missed).\n`;

  // cost report — FOUR distinct measures; the $ figure is PAYG-equivalent telemetry, NOT Warwick's spend.
  const faculty = (c) => (c.payload_input_est || 0) + (c.output || 0);
  let cost = `# Idea-engine — FROZEN T1-vs-T2 experiment · COST / TECHNICAL report

**Run ${runId} · ${stamp}.** Sonnet throughout · no Fable · no Opus · all six fixtures run T1+T2 FRESH under one frozen brief.

> **Read the money correctly.** This runs on Claude **Max 20×** via \`claude -p\`, not the pay-as-you-go API. Four
> different things, kept separate:
> 1. **Reported Claude-Code token traffic** — the big numbers below (output + cache creation + cache read). Engineering evidence.
> 2. **Actual faculty/model work** — the reasoning tokens (payload-in est + output), a fraction of (1).
> 3. **Max-plan quota impact** — small; Warwick's usage UI showed ≈2% weekly (all models) after a full day's work.
> 4. **Actual marginal cash spend** — **£0**, unless something leaves the subscription path (no API key, no OpenAI/LiteLLM).
>
> The "$ (PAYG-equiv)" column is what this WOULD cost on the metered API — telemetry only, not a bill.

| source | class | T1 reported | T2 reported | T2/T1× | T1 faculty | T2 faculty | T1 cand | T2 cand |
|---|---|---|---|---|---|---|---|---|
`;
  let gT1t = 0; let gT2t = 0; let gT1c = 0; let gT2c = 0; let gWall = 0; let gT1f = 0; let gT2f = 0;
  for (const r of results) {
    const t1t = reportedTotal(r.t1.call); const t1c = r.t1.call.cost_usd || 0; const t1f = faculty(r.t1.call);
    const t2calls = [...(r.t2?.branchCalls || []), r.t2?.convCall].filter(Boolean);
    const t2t = t2calls.reduce((a, c) => a + reportedTotal(c), 0);
    const t2c = t2calls.reduce((a, c) => a + (c.cost_usd || 0), 0);
    const t2f = t2calls.reduce((a, c) => a + faculty(c), 0);
    gT1t += t1t; gT2t += t2t; gT1c += t1c; gT2c += t2c; gT1f += t1f; gT2f += t2f;
    const t2wall = r.t2 ? ((r.t2.branchWallMs || Math.max(...(r.t2.branchCalls || [{ duration_ms: 0 }]).map((b) => b.duration_ms || 0))) + (r.t2.convCall?.duration_ms || 0)) : 0;
    gWall += (r.t1.call.duration_ms || 0) + t2wall;
    cost += `| ${r.fixture.n} ${r.fixture.label} | ${r.fixture.cls} | ${t1t.toLocaleString()} | ${t2t.toLocaleString()} | ${t1t ? (t2t / t1t).toFixed(1) : '—'} | ${t1f.toLocaleString()} | ${t2f.toLocaleString()} | ${r.t1.candidates.length} | ${(r.t2?.conv?.kept || []).length} |\n`;
  }
  cost += `\n**Grand totals**
- (1) Reported CC traffic: T1 ${gT1t.toLocaleString()} · T2 ${gT2t.toLocaleString()} · **combined ${(gT1t + gT2t).toLocaleString()} tok**
- (2) Faculty/model work: T1 ${gT1f.toLocaleString()} · T2 ${gT2f.toLocaleString()} · combined ${(gT1f + gT2f).toLocaleString()} tok (the actual reasoning; the rest is wrapper/cache)
- (3) Max quota impact: small (single-digit % of weekly, per Warwick's usage UI)
- (4) Marginal cash: **£0** (fully inside the Max 20× subscription)
- PAYG-equivalent telemetry (NOT a bill): ~$${(gT1c + gT2c).toFixed(2)} · summed wall ~${(gWall / 60000).toFixed(1)} min
\n**T2 vs T1 (measured):** across ${results.length} fixtures, **T2 ≈ ${gT1t ? (gT2t / gT1t).toFixed(1) : '—'}× T1** in reported traffic but only **≈${gT1f ? (gT2f / gT1f).toFixed(1) : '—'}× in faculty work** — the multiplier is wrapper/cache over 6 calls, not 6× the thinking.\n`;

  fs.writeFileSync(`${OUT}/idea-engine-T1vsT2-experiment-BLIND.md`, blind);
  fs.writeFileSync(`${OUT}/idea-engine-T1vsT2-experiment-KEY.md`, key);
  fs.writeFileSync(`${OUT}/idea-engine-T1vsT2-experiment-COST.md`, cost);
  return { gT1t, gT2t, gT1c, gT2c };
}

// assemble the master BLIND/KEY/COST from whatever per-fixture raws exist on disk (accumulates across per-fixture runs)
function buildMasterFromDisk(runId) {
  const results = [];
  for (const f of FIXTURES) {
    const p = `${OUT}/idea-engine-exp-raw-${f.id}.json`;
    if (fs.existsSync(p)) results.push(JSON.parse(fs.readFileSync(p, 'utf8')));
    else console.error(`[master] no raw yet for fixture ${f.n} ${f.id}`);
  }
  const totals = writeArtefacts(results, runId);
  return { results, totals };
}

async function main() {
  const runId = crypto.randomUUID().slice(0, 8);
  if (process.argv[2] === '--build-master') {
    const { results } = buildMasterFromDisk(runId);
    console.log(JSON.stringify({ ok: true, master: true, fixtures: results.map((r) => ({ n: r.fixture.n, t1: r.t1.candidates.length, t2: (r.t2?.conv?.kept || []).length })) }, null, 2));
    return;
  }
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const fixtures = only ? FIXTURES.filter((f) => only.has(f.id)) : FIXTURES;
  for (const fixture of fixtures) {
    const log = (m) => console.error(`[exp ${fixture.n}/${fixture.id}] ${m}`);
    const rawPath = `${OUT}/idea-engine-exp-raw-${fixture.id}.json`;
    let source;
    try { source = await getSource(fixture.id); } catch (e) { log(`source FAILED: ${e.message}`); continue; }
    log(`source ${source.length} chars · T1 baseline + T2 pipeline…`);
    const t1 = await runT1(fixture.id, source, log);
    const t2 = await runT2Pipeline(fixture.id, source, (m) => log(m));
    const r = { fixture, t1, t2 };
    fs.writeFileSync(rawPath, JSON.stringify(r, null, 1));
    log(`done · T1 ${t1.candidates.length} · T2 ${(t2.conv?.kept || []).length} · raw persisted`);
  }
  // rebuild the master artefacts from ALL per-fixture raws on disk (so per-fixture runs accumulate)
  const { results, totals } = buildMasterFromDisk(runId);
  console.log(JSON.stringify({
    ok: true, runId, ran: fixtures.map((f) => f.id), have_raws: results.map((r) => r.fixture.n),
    fixtures: results.map((r) => ({ n: r.fixture.n, id: r.fixture.id, t1: r.t1.candidates.length, t2: (r.t2?.conv?.kept || []).length })),
    grand: { t1_tok: totals.gT1t, t2_tok: totals.gT2t, combined_tok: totals.gT1t + totals.gT2t, cost_usd: +(totals.gT1c + totals.gT2c).toFixed(2) },
    artefacts: ['idea-engine-T1vsT2-experiment-BLIND.md', 'idea-engine-T1vsT2-experiment-KEY.md', 'idea-engine-T1vsT2-experiment-COST.md'],
  }, null, 2));
}
main().catch((e) => { console.error('[exp] FAILED:', e.stack || e.message); process.exit(1); });
