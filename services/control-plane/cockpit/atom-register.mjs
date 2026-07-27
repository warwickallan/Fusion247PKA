// Shared writer for the durable atom register (cockpit.idea_atom). ONE upsert path used by every atom producer
// (mine-ideas T1, mason-backfill experiment seed, and the T2 register step) so the register is fed consistently.
// Key is CONTENT-HASH, not positional — re-seeding/re-running is idempotent and never content-swaps or duplicates
// an atom (Fable B2), and provenance/disposition-carry stay bound to a stable atom_id.
import crypto from 'node:crypto';

// Stable identity of an atom = its origin + source + the transfer it asserts (target + reasoning). Two runs that
// produce the same transfer from the same source collapse to one row; different transfers never collide.
// '|'-delimited so field boundaries are unambiguous (matches the basis documented in 271_mason.sql).
export function atomKey(a) {
  const basis = [a.origin || 'production', a.source_ref || '', a.fusion_target || '', a.transfer_reasoning || ''].join('|');
  return crypto.createHash('sha256').update(basis).digest('hex');
}

// Upsert one atom by its content key. Keeps atom_id stable (provenance-safe); refreshes content + carries meta
// (traps / forced_analogy / graph_note — Fable F6, otherwise dropped at the register boundary).
export async function upsertAtom(c, a) {
  const key = atomKey(a);
  await c.query(
    `insert into cockpit.idea_atom (atom_key, n, source_ref, engine, frames, convergence, category, fusion_target,
        spin, transfer_reasoning, source_evidence, nvfi, meta, origin)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     on conflict (atom_key) do update set
       n=excluded.n, engine=excluded.engine, frames=excluded.frames, convergence=excluded.convergence,
       category=excluded.category, fusion_target=excluded.fusion_target, spin=excluded.spin,
       transfer_reasoning=excluded.transfer_reasoning, source_evidence=excluded.source_evidence,
       nvfi=excluded.nvfi, meta=excluded.meta`,
    [key, a.n ?? null, a.source_ref, a.engine || null, a.frames || [], a.convergence || 'single', a.category || 'brain',
      a.fusion_target || '', JSON.stringify(a.spin || {}), a.transfer_reasoning || '',
      JSON.stringify(a.source_evidence || {}), JSON.stringify(a.nvfi || {}), JSON.stringify(a.meta || {}), a.origin || 'production'],
  );
  return key;
}

// Validate the provenance quote is actually verbatim in the source (Fable F5). Returns a source_evidence object
// stamped with verified:true/false — hallucinated or empty quotes are KEPT but flagged, never silently trusted.
export function verifyEvidence(ev, sourceText) {
  const e = { ...(ev || {}) };
  const q = String(e.quote || '').replace(/\s+/g, ' ').trim();
  const src = String(sourceText || '').replace(/\s+/g, ' ');
  e.verified = !!q && src.includes(q);
  return e;
}
