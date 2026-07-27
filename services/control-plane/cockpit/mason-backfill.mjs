// Mason v1 — backfill the durable atom register (cockpit.idea_atom) from the frozen-experiment raws.
// Idempotent + provenance-safe: UPSERTS on the stable natural key (origin, source_ref, n) so atom_ids never
// change across re-seeds — opportunity_atom provenance and the disposition-carry chain survive. (Do NOT reintroduce
// a delete: it would cascade away provenance.) Production Mines write atoms here too — the register is not a one-off.
//   node --env-file=<db.env> services/control-plane/cockpit/mason-backfill.mjs
import fs from 'node:fs';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { upsertAtom, atomKey } from 'file:///C:/Fusion247PKA/services/control-plane/cockpit/atom-register.mjs';

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
        meta: { traps: c.traps || [], forced_analogy: c.forced_analogy || false, graph_note: c.graph_note || null },
        origin: 'experiment',
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
  // Rekey any pre-existing rows to the CANONICAL JS content key (idempotent) — repairs SQL/JS key drift and
  // pre-rekey NULLs so the upsert below matches instead of inserting duplicates. atom_id is preserved (provenance-safe).
  const existing = (await c.query('select atom_id, origin, source_ref, fusion_target, transfer_reasoning from cockpit.idea_atom')).rows;
  for (const e of existing) {
    const k = atomKey(e);
    try { await c.query('update cockpit.idea_atom set atom_key=$2 where atom_id=$1 and atom_key is distinct from $2', [e.atom_id, k]); }
    catch (err) { /* content-duplicate collision — leave the existing key; dedup of identical atoms is Mason's concern */ }
  }
  // UPSERT via the shared content-hash writer — keeps atom_id STABLE across re-seeds without a positional key.
  for (const a of atoms) await upsertAtom(c, a);
  const tot = (await c.query('select count(*)::int n from cockpit.idea_atom')).rows[0].n;
  await c.end();
  console.log(JSON.stringify({ ok: true, backfilled: atoms.length, register_total: tot }, null, 2));
}
main().catch((e) => { console.error('[backfill] FAILED:', e.message); process.exit(1); });
