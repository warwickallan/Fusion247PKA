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
  // Fable C6: derive the self-referential caveat from the actual register, not a hardcoded claim that goes false
  // the moment production atoms arrive. Only warn when the experiment corpus still dominates.
  const expShare = atoms.length ? atoms.filter((a) => a._origin === 'experiment').length / atoms.length : 0;
  const skewNote = expShare > 0.5
    ? `NOTE: ${Math.round(expShare * 100)}% of this register was mined under a git-live experiment brief ("you are mid-experiment on the idea-engine's own T1-vs-T2 tiering"), so it is OVER-WEIGHTED toward the idea-engine improving itself — do not surface that on volume alone.`
    : 'NOTE: judge every cluster on its own evidence; do not surface any topic on volume alone.';
  return `You are BRAINS — Fusion / myPKA's Improvement & Product-Manager synthesiser (the agent is "Mason"). You are
NOT a fact-researcher (Pax), NOT a technical/data architect (Silas), NOT an implementer, and you do NOT approve your
own recommendations. Read ${atoms.length} atomic idea candidates (with provenance) and synthesise the SMALL set of
coherent OPPORTUNITIES / BUILD THESES worth Warwick's scarce attention — then get out of the way.

A coherent BUILD THESIS, not a SEMANTIC CLUSTER — qualifies ONLY if all four hold:
 (1) COHERENT OUTCOME — ONE describable thing you could build that satisfies/subsumes most member atoms;
 (2) NON-REDUNDANT FACETS — atoms add different evidence/angles, not restatements;
 (3) INDEPENDENT SUPPORT — >=2 independent SOURCES or >=2 independent reasoning FRAMES reach it;
 (4) LIVE ANCHOR — attaches to a real Fusion problem/build/decision.
EDGE COUNT / shared vocabulary IS NOT EVIDENCE. You MUST reject tempting SEMANTIC clusters and VOLUME traps.
Atoms flagged ⚠forced or ⚠unverified below are weak evidence — never let them carry an opportunity alone. ${skewNote}

DO NOT create a backlog. Surface only the few (aim 3-5) that deserve Warwick's attention now; everything else is
EMERGING (coherent but below the bar) or STANDALONE (stays in the register). Classify every surfaced/emerging item as
"strategic" or "self_improvement". End each with actions (Keep watching / Explain / Research with Pax / Make build
brief / Later / Decline) — you propose; you never authorise a build.

THE ATOMS (id · [source|engine|frames|convergence|category|NVFI] · flags · target · situation · reasoning):
${atoms.map((a) => {
  const flags = [(a.meta?.forced_analogy ? '⚠forced' : ''), (a.source_evidence?.verified === false ? '⚠unverified' : '')].filter(Boolean).join(' ');
  return `#${a.idx} [${a.source_ref}|${a.engine}|${(a.frames || []).join('+') || '—'}|${a.convergence}|${a.category}|N${a.nvfi?.novelty || '?'}V${a.nvfi?.viability || '?'}F${a.nvfi?.fit || '?'}I${a.nvfi?.impact || '?'}]${flags ? ' ' + flags : ''}
  TARGET: ${clip(a.fusion_target, 160)}
  SITUATION: ${clip(a.spin?.situation, 220)}
  REASONING: ${clip(a.transfer_reasoning, 340)}`;
}).join('\n')}

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
    `select atom_id, n, source_ref, engine, frames, convergence, category, fusion_target, spin, transfer_reasoning,
            nvfi, coalesce(meta,'{}'::jsonb) meta, coalesce(source_evidence,'{}'::jsonb) source_evidence, origin
       from cockpit.idea_atom order by origin, n nulls last, created_at`,
  )).rows;
  if (!atoms.length) { console.error('[mason] register empty — run mason-backfill/mine first'); process.exit(1); }
  // Reference atoms by LOAD-ORDER index (#idx), not the DB `n` (which is display-only + null for production atoms).
  atoms.forEach((a, i) => { a.idx = i + 1; a._origin = a.origin; });
  const byIdx = new Map(atoms.map((a) => [a.idx, a.atom_id]));
  const ids = (ns) => (ns || []).map((n) => byIdx.get(n)).filter(Boolean);

  console.error(`[mason] ${atoms.length} atoms · one Sonnet synthesis pass…`);
  const call = await callClaude(prompt(atoms), 'mason');
  if (!call.ok) { console.error('[mason] call FAILED:', call.error); process.exit(1); }
  const out = parseJSON(call.resultText);

  // Persist this run TRANSACTIONALLY — a mid-run failure must not leave a partial run selected as the
  // cockpit's "latest" (which would hide the last good run). Vars used after the tx are hoisted here.
  let carried = 0; let conflicts = 0; let unplaced = []; let run;
  await c.query('begin');
  try {
  await c.query("update cockpit.idea_atom set atom_state='registered'");
  run = (await c.query(
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
  // Identity across runs = atom-set OVERLAP COEFFICIENT (|A∩B| / min(|A|,|B|)), which is robust to the LLM
  // including slightly different atoms each run (Jaccard punished that and false-flagged the SAME thesis).
  // A clear match carries the disposition; conflict is raised ONLY when rival matches genuinely DISAGREE on
  // disposition — membership drift alone is not a conflict. Never guessed.
  const ov = (a, b) => { const A = new Set(a); const B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (Math.min(A.size, B.size) || 1); };
  const isect = (a, b) => { const B = new Set(b); return a.filter((x) => B.has(x)).length; };
  const priorDecided = (await c.query(
    `select o.opportunity_id id, o.disposition, o.disposition_at, array_agg(oa.atom_id) atoms
       from cockpit.opportunity o join cockpit.opportunity_atom oa on oa.opportunity_id = o.opportunity_id
      where o.disposition is not null and o.run_id <> $1 group by o.opportunity_id, o.disposition, o.disposition_at`, [run])).rows;
  const newOpps = (await c.query(
    `select o.opportunity_id id, array_agg(oa.atom_id) atoms
       from cockpit.opportunity o join cockpit.opportunity_atom oa on oa.opportunity_id = o.opportunity_id
      where o.run_id = $1 and o.state in ('surfaced','emerging') group by o.opportunity_id`, [run])).rows;
  for (const nOpp of newOpps) {
    // matches = prior decided opps whose core atoms are substantially present in this new opp (overlap >= 0.6)
    const matches = priorDecided.map((p) => ({ p, s: ov(nOpp.atoms, p.atoms) })).filter((x) => x.s >= 0.6)
      .sort((a, b) => b.s - a.s || (new Date(b.p.disposition_at) - new Date(a.p.disposition_at)));
    if (!matches.length) continue;                                    // no clear match — genuinely new thesis
    const distinctDisp = new Set(matches.map((m) => m.p.disposition));
    if (distinctDisp.size > 1) {                                      // rival matches DISAGREE → genuinely ambiguous
      const best = matches[0];
      await c.query('update cockpit.opportunity set disposition_conflict=true, matched_from=$2, updated_at=now() where opportunity_id=$1', [nOpp.id, best.p.id]);
      await c.query("insert into cockpit.opportunity_event (opportunity_id, actor, event, note) values ($1,'system','disposition_conflict',$2)", [nOpp.id, `rival prior decisions disagree (${[...distinctDisp].join('/')}) — Warwick to re-confirm`]);
      conflicts++;
    } else {                                                          // single match, or several that AGREE
      const chosen = matches[0];                                      // highest overlap, then most-recent decision
      // Guard the subset-swallow asymmetry: a DECLINE on a small prior fully contained in a much BROADER new thesis
      // scores ov=1.0 but the decline only covers <50% of the new thesis — over-applying it would silently hide a
      // genuinely broader opportunity. Re-confirm instead (fails safe; every other disposition is visible so self-corrects).
      const coverNew = isect(nOpp.atoms, chosen.p.atoms) / (nOpp.atoms.length || 1);
      if (chosen.p.disposition === 'declined' && coverNew < 0.5) {
        await c.query('update cockpit.opportunity set disposition_conflict=true, matched_from=$2, updated_at=now() where opportunity_id=$1', [nOpp.id, chosen.p.id]);
        await c.query("insert into cockpit.opportunity_event (opportunity_id, actor, event, note) values ($1,'system','disposition_conflict',$2)", [nOpp.id, `declined prior covers only ${Math.round(coverNew * 100)}% of a broader new thesis — Warwick to re-confirm`]);
        conflicts++;
      } else {
        await c.query('update cockpit.opportunity set disposition=$2, disposition_at=$4, matched_from=$3, updated_at=now() where opportunity_id=$1', [nOpp.id, chosen.p.disposition, chosen.p.id, chosen.p.disposition_at]);
        await c.query("insert into cockpit.opportunity_event (opportunity_id, actor, event, note) values ($1,'system','disposition_carried',$2)", [nOpp.id, `carried '${chosen.p.disposition}' from ${chosen.p.id} (overlap ${chosen.s.toFixed(2)})`]);
        carried++;
      }
    }
  }

  // accounting: any atom the model didn't place defaults to standalone (register), and is flagged
  unplaced = (await c.query("select n from cockpit.idea_atom where atom_state='registered' order by n")).rows.map((r) => r.n);
  if (unplaced.length) await c.query("update cockpit.idea_atom set atom_state='standalone' where atom_state='registered'");
  await c.query('commit');
  } catch (e) { try { await c.query('rollback'); } catch { /* */ } await c.end(); throw e; }

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
