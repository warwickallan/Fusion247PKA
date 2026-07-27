// Mason v1 — backfill the durable atom register (cockpit.idea_atom) from the frozen-experiment raws.
// Idempotent + provenance-safe: UPSERTS on the stable natural key (origin, source_ref, n) so atom_ids never
// change across re-seeds — opportunity_atom provenance and the disposition-carry chain survive. (Do NOT reintroduce
// a delete: it would cascade away provenance.) Production Mines write atoms here too — the register is not a one-off.
//   node --env-file=<db.env> services/control-plane/cockpit/mason-backfill.mjs
import fs from 'node:fs';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const OUT = 'C:/Fusion247PKA/Deliverables';
const F = [['m6IXL_YGqBQ', '1 ADHD/agent-skill'], ['MO3vBmrYyHI', '2 Business-4-tasks'], ['eW_vxrjvERk', '3 ContextGraphs'],
  ['n5G26mmJ7I0', '4 Audi(poor-fit)'], ['Vr6FKXu8nq4', '5 AirFryer-26s'], ['tebWhVlxSmQ', '6 AirFryer-7s']];
const URL = process.env.DATABASE_URL || process.env.CONTROL_PLANE_DEV_DATABASE_URL;

function loadAtoms() {
  const atoms = []; let n = 0;
  for (const [id, label] of F) {
    const p = `${OUT}/idea-engine-exp-raw-${id}.json`;
    if (!fs.existsSync(p)) continue;
    const r = JSON.parse(fs.readFileSync(p, 'utf8'));
    const t1 = (r.t1?.candidates || []).map((c) => ({ ...c, _e: 'T1' }));
    const t2 = (r.t2?.conv?.kept || []).map((c) => ({ ...c, _e: 'T2' }));
    for (const c of [...t1, ...t2]) {
      n++;
      atoms.push({
        n, source_ref: label, engine: c._e, frames: c.contributing_frames || [],
        convergence: c.convergence_type || 'single', category: c.category || 'brain',
        fusion_target: c.fusion_target || '', spin: c.spin || {}, transfer_reasoning: c.transfer_reasoning || '',
        source_evidence: c.source_evidence || {}, nvfi: c.nvfi || {},
      });
    }
  }
  return atoms;
}

async function main() {
  if (!URL) throw new Error('no DATABASE_URL / CONTROL_PLANE_DEV_DATABASE_URL');
  const atoms = loadAtoms();
  const c = new pg.Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // UPSERT by the stable natural key (origin, source_ref, n) so re-seeding keeps each atom_id STABLE — a
  // delete+reinsert would cascade away opportunity_atom provenance and break the disposition-carry chain.
  for (const a of atoms) {
    await c.query(
      `insert into cockpit.idea_atom (n, source_ref, engine, frames, convergence, category, fusion_target,
         spin, transfer_reasoning, source_evidence, nvfi, origin)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'experiment')
       on conflict (origin, source_ref, n) do update set
         engine=excluded.engine, frames=excluded.frames, convergence=excluded.convergence, category=excluded.category,
         fusion_target=excluded.fusion_target, spin=excluded.spin, transfer_reasoning=excluded.transfer_reasoning,
         source_evidence=excluded.source_evidence, nvfi=excluded.nvfi`,
      [a.n, a.source_ref, a.engine, a.frames, a.convergence, a.category, a.fusion_target,
        JSON.stringify(a.spin), a.transfer_reasoning, JSON.stringify(a.source_evidence), JSON.stringify(a.nvfi)],
    );
  }
  const tot = (await c.query('select count(*)::int n from cockpit.idea_atom')).rows[0].n;
  await c.end();
  console.log(JSON.stringify({ ok: true, backfilled: atoms.length, register_total: tot }, null, 2));
}
main().catch((e) => { console.error('[backfill] FAILED:', e.message); process.exit(1); });
