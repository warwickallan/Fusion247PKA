// SMALLEST PROOF (IDEA-016) — atoms → opportunities in ONE corpus-level synthesis pass.
// Plays the BRAINS synthesis role (one-shot, manual): reads all durable idea atoms from the frozen experiment raws,
// runs ONE Sonnet claude -p call that applies the coherence gate (build-thesis, NOT semantic cluster), surfaces a
// SMALL set of opportunities (not a backlog), classifies STRATEGIC vs SELF-IMPROVEMENT, and REJECTS false clusters.
// No register, no graph, no cockpit, no autonomous loop — the smallest test that the synthesis faculty is real.
//   node services/control-plane/cockpit/synthesize-opportunities.mjs
import fs from 'node:fs';
import { callClaude, parseJSON } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/t2-calibrate.mjs';

const OUT = 'C:/Fusion247PKA/Deliverables';
const F = [['m6IXL_YGqBQ', '1 ADHD/agent-skill'], ['MO3vBmrYyHI', '2 Business-4-tasks'], ['eW_vxrjvERk', '3 ContextGraphs'],
  ['n5G26mmJ7I0', '4 Audi(poor-fit)'], ['Vr6FKXu8nq4', '5 AirFryer-26s'], ['tebWhVlxSmQ', '6 AirFryer-7s']];
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

function loadAtoms() {
  const atoms = []; let gid = 0;
  for (const [id, label] of F) {
    const p = `${OUT}/idea-engine-exp-raw-${id}.json`;
    if (!fs.existsSync(p)) continue;
    const r = JSON.parse(fs.readFileSync(p, 'utf8'));
    const t1 = (r.t1?.candidates || []).map((c) => ({ ...c, _e: 'T1' }));
    const t2 = (r.t2?.conv?.kept || []).map((c) => ({ ...c, _e: 'T2' }));
    for (const c of [...t1, ...t2]) {
      gid++;
      atoms.push({
        id: gid, source: label, engine: c._e,
        frames: (c.contributing_frames || []).join('+') || (c._e === 'T2' ? '?' : '—'),
        convergence: c.convergence_type || 'single', category: c.category || 'brain', nvfi: c.nvfi || {},
        target: clip(c.fusion_target, 160), situation: clip(c.spin?.situation, 220), reasoning: clip(c.transfer_reasoning, 340),
      });
    }
  }
  return atoms;
}

function prompt(atoms) {
  return `You are BRAINS — Fusion / myPKA's Improvement & Product-Manager synthesiser. You are NOT a fact-researcher
(that is Pax), NOT a technical/data architect (that is Silas), NOT an implementer, and you do NOT approve your own
recommendations. Your job: read ${atoms.length} atomic idea candidates (with provenance) and synthesise the SMALL set
of coherent OPPORTUNITIES / BUILD THESES worth Warwick's scarce attention — then get out of the way.

CRITICAL — a coherent BUILD THESIS, not a SEMANTIC CLUSTER. An opportunity qualifies ONLY if it passes all four:
 (1) COHERENT OUTCOME — there is ONE describable thing you could build such that building it satisfies/subsumes most
     member atoms (not "they mention the same noun");
 (2) NON-REDUNDANT FACETS — atoms add different evidence/angles, not restatements;
 (3) INDEPENDENT SUPPORT — >=2 independent SOURCES or >=2 independent reasoning FRAMES reach it;
 (4) LIVE ANCHOR — it attaches to a real Fusion problem/build/decision.
EDGE COUNT / shared-vocabulary IS NOT EVIDENCE. Seven weak ideas that share a word are still seven weak ideas.
You MUST reject tempting SEMANTIC clusters (e.g. "these all mention the graph/Neo4j" — they build different things)
and VOLUME traps. NOTE: this corpus was mined under a git-live brief that told the engine "you are mid-experiment on
the idea-engine's own T1-vs-T2 tiering", so it is OVER-WEIGHTED toward the idea-engine improving itself — treat that
apparent mass skeptically; do not surface "improve the idea-engine" as a top opportunity on volume alone.

DO NOT create a backlog. Surface only the few (aim 3-5) that genuinely deserve Warwick's attention now. Everything
else is either an EMERGING opportunity (coherent but below the surface bar) or a STANDALONE atom that stays in the
register. Classify every surfaced/emerging opportunity as one of:
 - "strategic" — something genuinely new or consequential Warwick may want to explore;
 - "self_improvement" — an improvement to Fusion itself (should increasingly be handled autonomously, not become a Warwick project).
End each opportunity with actions (Keep watching / Explain / Research with Pax / Make build brief / Later / Decline) —
you propose; you never authorise a build.

THE ATOMS (id · [source|engine|frames|convergence|category|NVFI] · target · situation · reasoning):
${atoms.map((a) => `#${a.id} [${a.source}|${a.engine}|${a.frames}|${a.convergence}|${a.category}|N${a.nvfi.novelty || '?'}V${a.nvfi.viability || '?'}F${a.nvfi.fit || '?'}I${a.nvfi.impact || '?'}]
  TARGET: ${a.target}
  SITUATION: ${a.situation}
  REASONING: ${a.reasoning}`).join('\n')}

OUTPUT — return ONLY this JSON, no preamble, no fences:
{"surfaced":[
  {"headline":"","type":"strategic|self_improvement",
   "spin":{"situation":"","problem":"","implication":"","need_payoff":""},
   "why_now":"","roi":{"value_type":"time|quality|reliability|capability|money|cognitive_load","band":"low|med|high","note":""},
   "evidence":{"member_atoms":[0],"independent_sources":0,"frames":0,"live_anchors":[""],"convergence_note":""},
   "what_wed_build":"","coherence_note":"","actions":[""]}
],
 "emerging":[{"headline":"","type":"","member_atoms":[0],"why_not_surfaced_yet":""}],
 "rejected_clusters":[{"label":"","member_atoms":[0],"why_rejected":"semantic|volume|incoherent — explain"}],
 "standalone_atoms":[0],
 "notes":""}`;
}

async function main() {
  const atoms = loadAtoms();
  console.error(`[brains] loaded ${atoms.length} atoms · one Sonnet synthesis pass…`);
  const call = await callClaude(prompt(atoms), 'brains-synthesis');
  if (!call.ok) { console.error('[brains] FAILED:', call.error); process.exit(1); }
  let out;
  try { out = parseJSON(call.resultText); } catch (e) { console.error('[brains] parse-error:', e.message); fs.writeFileSync(`${OUT}/_synthesis-raw.txt`, call.resultText); process.exit(1); }

  // human-readable proof artefact
  const st = (o) => `★ ${o.headline}  \n**[${o.type}]** · ROI ${o.roi?.band}/${o.roi?.value_type} · atoms ${(o.evidence?.member_atoms || []).length} · ${o.evidence?.independent_sources} sources · ${o.evidence?.frames} frames\n\n`
    + `- **Situation:** ${o.spin?.situation}\n- **Problem:** ${o.spin?.problem}\n- **Implication:** ${o.spin?.implication}\n- **Need-payoff:** ${o.spin?.need_payoff}\n`
    + `- **Why now:** ${o.why_now}\n- **ROI:** ${o.roi?.note}\n- **Evidence:** ${o.evidence?.convergence_note} · live anchors: ${(o.evidence?.live_anchors || []).join('; ')}\n`
    + `- **What we'd build:** ${o.what_wed_build}\n- **Coherence:** ${o.coherence_note}\n- **Member atoms:** ${(o.evidence?.member_atoms || []).join(', ')}\n- **Actions:** ${(o.actions || []).join(' · ')}\n`;
  let md = `# Smallest proof — atoms → opportunities (Brains synthesis, one pass)

**${atoms.length} atoms · one Sonnet call · ${call.output} output tok · ${(call.duration_ms / 1000).toFixed(1)}s · £0 marginal (Max).**
No register, no graph, no cockpit — just the synthesis faculty tested on the real corpus.

## SURFACED opportunities (${(out.surfaced || []).length}) — the few worth Warwick's scarce attention
${(out.surfaced || []).map(st).join('\n---\n\n')}

## EMERGING (${(out.emerging || []).length}) — coherent but below the surface bar
${(out.emerging || []).map((e) => `- **${e.headline}** [${e.type}] — atoms ${(e.member_atoms || []).join(', ')} — _${e.why_not_surfaced_yet}_`).join('\n') || '_none_'}

## REJECTED clusters (${(out.rejected_clusters || []).length}) — the discriminator earning its keep
${(out.rejected_clusters || []).map((r) => `- **${r.label}** (atoms ${(r.member_atoms || []).join(', ')}) — ${r.why_rejected}`).join('\n') || '_none_'}

## STANDALONE atoms (stay in the register)
${(out.standalone_atoms || []).join(', ') || '_none_'}

## Notes
${out.notes || ''}
`;
  fs.writeFileSync(`${OUT}/idea-engine-synthesis-PROOF.md`, md);
  fs.writeFileSync(`${OUT}/_synthesis-proof-raw.json`, JSON.stringify({ call: { output: call.output, ms: call.duration_ms, cost: call.cost_usd }, out }, null, 1));
  console.log(JSON.stringify({
    ok: true, atoms: atoms.length,
    surfaced: (out.surfaced || []).map((o) => ({ h: o.headline, type: o.type, roi: o.roi?.band, atoms: (o.evidence?.member_atoms || []).length, sources: o.evidence?.independent_sources })),
    emerging: (out.emerging || []).length, rejected: (out.rejected_clusters || []).map((r) => r.label), standalone: (out.standalone_atoms || []).length,
    tok_out: call.output, s: +(call.duration_ms / 1000).toFixed(1),
  }, null, 2));
}
main().catch((e) => { console.error('[brains] FAILED:', e.stack || e.message); process.exit(1); });
