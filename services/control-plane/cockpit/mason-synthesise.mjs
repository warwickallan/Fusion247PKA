// Mason v1 — re-runnable Brains synthesis over the durable atom register, PERSISTED.
// Reads atoms from cockpit.idea_atom, runs the proven coherence-gated synthesis pass (one Sonnet call),
// and persists durable Opportunity records with full provenance (opportunity + opportunity_atom + events),
// sets each atom's state (surfaced/emerging/standalone/rejected member), and records rejected clusters so the
// "improve-the-idea-engine" mega-cluster rejection is durable + inspectable. Verifies every atom is accounted for.
//   node --env-file=<db.env> services/control-plane/cockpit/mason-synthesise.mjs
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { callClaude, parseJSON } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/t2-calibrate.mjs';

const URL = process.env.DATABASE_URL || process.env.CONTROL_PLANE_DEV_DATABASE_URL;
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

// The PROVEN synthesis prompt (same faculty validated in idea-engine-synthesis-PROOF.md), fed atoms from the register.
function prompt(atoms) {
  return `You are BRAINS — Fusion / myPKA's Improvement & Product-Manager synthesiser (the agent is "Mason"). You are
NOT a fact-researcher (Pax), NOT a technical/data architect (Silas), NOT an implementer, and you do NOT approve your
own recommendations. Read ${atoms.length} atomic idea candidates (with provenance) and synthesise the SMALL set of
coherent OPPORTUNITIES / BUILD THESES worth Warwick's scarce attention — then get out of the way.

A coherent BUILD THESIS, not a SEMANTIC CLUSTER — qualifies ONLY if all four hold:
 (1) COHERENT OUTCOME — ONE describable thing you could build that satisfies/subsumes most member atoms;
 (2) NON-REDUNDANT FACETS — atoms add different evidence/angles, not restatements;
 (3) INDEPENDENT SUPPORT — >=2 independent SOURCES or >=2 independent reasoning FRAMES reach it;
 (4) LIVE ANCHOR — attaches to a real Fusion problem/build/decision.
EDGE COUNT / shared vocabulary IS NOT EVIDENCE. You MUST reject tempting SEMANTIC clusters and VOLUME traps. NOTE:
this corpus was mined under a git-live brief that told the engine "you are mid-experiment on the idea-engine's own
T1-vs-T2 tiering", so it is OVER-WEIGHTED toward the idea-engine improving itself — do not surface that on volume alone.

DO NOT create a backlog. Surface only the few (aim 3-5) that deserve Warwick's attention now; everything else is
EMERGING (coherent but below the bar) or STANDALONE (stays in the register). Classify every surfaced/emerging item as
"strategic" or "self_improvement". End each with actions (Keep watching / Explain / Research with Pax / Make build
brief / Later / Decline) — you propose; you never authorise a build.

THE ATOMS (id · [source|engine|frames|convergence|category|NVFI] · target · situation · reasoning):
${atoms.map((a) => `#${a.n} [${a.source_ref}|${a.engine}|${(a.frames || []).join('+') || '—'}|${a.convergence}|${a.category}|N${a.nvfi?.novelty || '?'}V${a.nvfi?.viability || '?'}F${a.nvfi?.fit || '?'}I${a.nvfi?.impact || '?'}]
  TARGET: ${clip(a.fusion_target, 160)}
  SITUATION: ${clip(a.spin?.situation, 220)}
  REASONING: ${clip(a.transfer_reasoning, 340)}`).join('\n')}

OUTPUT — return ONLY this JSON, no preamble, no fences (member_atoms are the #N ids above):
{"surfaced":[
  {"headline":"","otype":"strategic|self_improvement",
   "spin":{"situation":"","problem":"","implication":"","need_payoff":""},
   "why_now":"","roi":{"value_type":"time|quality|reliability|capability|money|cognitive_load","band":"low|med|high","note":""},
   "evidence":{"independent_sources":0,"frames":0,"live_anchors":[""],"convergence_note":""},
   "what_wed_build":"","coherence_note":"","member_atoms":[0],"actions":[""]}
],
 "emerging":[{"headline":"","otype":"","member_atoms":[0],"why_not_surfaced_yet":""}],
 "rejected_clusters":[{"label":"","member_atoms":[0],"why_rejected":"semantic|volume|incoherent — explain"}],
 "standalone_atoms":[0]}`;
}

async function main() {
  if (!URL) throw new Error('no DATABASE_URL / CONTROL_PLANE_DEV_DATABASE_URL');
  const c = new pg.Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const atoms = (await c.query(
    'select atom_id, n, source_ref, engine, frames, convergence, category, fusion_target, spin, transfer_reasoning, nvfi from cockpit.idea_atom order by n',
  )).rows;
  if (!atoms.length) { console.error('[mason] register empty — run mason-backfill first'); process.exit(1); }
  const byN = new Map(atoms.map((a) => [a.n, a.atom_id]));
  const ids = (ns) => (ns || []).map((n) => byN.get(n)).filter(Boolean);

  console.error(`[mason] ${atoms.length} atoms · one Sonnet synthesis pass…`);
  const call = await callClaude(prompt(atoms), 'mason');
  if (!call.ok) { console.error('[mason] call FAILED:', call.error); process.exit(1); }
  const out = parseJSON(call.resultText);

  // reset placement from any prior run, then persist this run
  await c.query("update cockpit.idea_atom set atom_state='registered'");
  const run = (await c.query(
    `insert into cockpit.opportunity_run (atom_count, surfaced, emerging, rejected, standalone, duration_ms, output_tokens)
     values ($1,$2,$3,$4,$5,$6,$7) returning run_id`,
    [atoms.length, (out.surfaced || []).length, (out.emerging || []).length, (out.rejected_clusters || []).length, (out.standalone_atoms || []).length, call.duration_ms, call.output],
  )).rows[0].run_id;

  async function persistOpp(o, state, extra = {}) {
    const opp = (await c.query(
      `insert into cockpit.opportunity (run_id, headline, otype, state, spin, why_now, roi, evidence, what_wed_build, coherence_note, rejected_reason)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning opportunity_id`,
      [run, o.headline || '(untitled)', (o.otype === 'strategic' ? 'strategic' : 'self_improvement'), state,
        JSON.stringify(o.spin || {}), o.why_now || null, JSON.stringify(o.roi || {}), JSON.stringify(o.evidence || {}),
        o.what_wed_build || null, o.coherence_note || null, extra.rejected_reason || null],
    )).rows[0].opportunity_id;
    for (const aid of ids(o.member_atoms)) {
      await c.query('insert into cockpit.opportunity_atom (opportunity_id, atom_id) values ($1,$2) on conflict do nothing', [opp, aid]);
    }
    await c.query("insert into cockpit.opportunity_event (opportunity_id, actor, event, note) values ($1,'system','synthesised',$2)", [opp, state]);
    return opp;
  }
  // apply atom_state in precedence order (surfaced wins last)
  for (const o of (out.rejected_clusters || [])) { await persistOpp({ ...o, headline: o.label || o.headline, otype: 'self_improvement' }, 'rejected', { rejected_reason: o.why_rejected }); await c.query("update cockpit.idea_atom set atom_state='rejected_member' where atom_id = any($1)", [ids(o.member_atoms)]); }
  await c.query("update cockpit.idea_atom set atom_state='standalone' where atom_id = any($1)", [ids(out.standalone_atoms)]);
  for (const o of (out.emerging || [])) { await persistOpp(o, 'emerging'); await c.query("update cockpit.idea_atom set atom_state='emerging_member' where atom_id = any($1)", [ids(o.member_atoms)]); }
  for (const o of (out.surfaced || [])) { await persistOpp(o, 'surfaced'); await c.query("update cockpit.idea_atom set atom_state='surfaced_member' where atom_id = any($1)", [ids(o.member_atoms)]); }

  // ---- Carry Warwick's DISPOSITION across runs (durable human authority) ----
  // Match this run's opportunities to prior DECIDED ones by atom-set overlap (Jaccard). A confident, unique match
  // carries the disposition forward; an ambiguous match is flagged as a conflict for Warwick — never guessed.
  const jac = (a, b) => { const A = new Set(a); const B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
  const priorDecided = (await c.query(
    `select o.opportunity_id id, o.disposition, array_agg(oa.atom_id) atoms
       from cockpit.opportunity o join cockpit.opportunity_atom oa on oa.opportunity_id = o.opportunity_id
      where o.disposition is not null and o.run_id <> $1 group by o.opportunity_id, o.disposition`, [run])).rows;
  const newOpps = (await c.query(
    `select o.opportunity_id id, array_agg(oa.atom_id) atoms
       from cockpit.opportunity o join cockpit.opportunity_atom oa on oa.opportunity_id = o.opportunity_id
      where o.run_id = $1 and o.state in ('surfaced','emerging') group by o.opportunity_id`, [run])).rows;
  let carried = 0; let conflicts = 0;
  for (const nOpp of newOpps) {
    const scored = priorDecided.map((p) => ({ p, s: jac(nOpp.atoms, p.atoms) })).filter((x) => x.s >= 0.3).sort((a, b) => b.s - a.s);
    if (!scored.length) continue;
    const best = scored[0];
    const ambiguous = best.s < 0.6 || (scored[1] && scored[1].s >= 0.4);
    if (ambiguous) {
      await c.query('update cockpit.opportunity set disposition_conflict=true, matched_from=$2, updated_at=now() where opportunity_id=$1', [nOpp.id, best.p.id]);
      await c.query("insert into cockpit.opportunity_event (opportunity_id, actor, event, note) values ($1,'system','disposition_conflict',$2)", [nOpp.id, `ambiguous carry (jaccard ${best.s.toFixed(2)}) — Warwick to re-decide`]);
      conflicts++;
    } else {
      await c.query('update cockpit.opportunity set disposition=$2, disposition_at=now(), matched_from=$3, updated_at=now() where opportunity_id=$1', [nOpp.id, best.p.disposition, best.p.id]);
      await c.query("insert into cockpit.opportunity_event (opportunity_id, actor, event, note) values ($1,'system','disposition_carried',$2)", [nOpp.id, `carried '${best.p.disposition}' from ${best.p.id} (jaccard ${best.s.toFixed(2)})`]);
      carried++;
    }
  }

  // accounting: any atom the model didn't place defaults to standalone (register), and is flagged
  const unplaced = (await c.query("select n from cockpit.idea_atom where atom_state='registered' order by n")).rows.map((r) => r.n);
  if (unplaced.length) await c.query("update cockpit.idea_atom set atom_state='standalone' where atom_state='registered'");

  const counts = (await c.query('select atom_state, count(*)::int n from cockpit.idea_atom group by 1 order by 1')).rows;
  const surfaced = (await c.query("select headline, otype from cockpit.opportunity where run_id=$1 and state='surfaced' order by created_at", [run])).rows;
  const rejected = (await c.query("select headline from cockpit.opportunity where run_id=$1 and state='rejected'", [run])).rows;
  await c.end();

  console.log(JSON.stringify({
    ok: true, run_id: run, atoms: atoms.length,
    surfaced: surfaced.map((o) => `[${o.otype}] ${o.headline}`),
    emerging: (out.emerging || []).length,
    rejected_clusters: rejected.map((r) => r.headline),
    atom_accounting: Object.fromEntries(counts.map((r) => [r.atom_state, r.n])),
    unplaced_defaulted_to_standalone: unplaced,
    every_atom_accounted: counts.reduce((a, r) => a + r.n, 0) === atoms.length && !counts.find((r) => r.atom_state === 'registered'),
    disposition_carried: carried, disposition_conflicts: conflicts,
    tok_out: call.output, s: +(call.duration_ms / 1000).toFixed(1),
  }, null, 2));
}
main().catch((e) => { console.error('[mason] FAILED:', e.stack || e.message); process.exit(1); });
