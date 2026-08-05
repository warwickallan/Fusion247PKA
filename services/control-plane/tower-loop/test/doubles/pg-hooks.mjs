// WP-2F — ZERO-POSTGRES INSTRUMENTATION for the merge-check path: Node module-customisation hooks.
//
// Direct sibling of graph-hooks.mjs (WO-TW-02) and deliberately the same shape, because the bar
// is the same one: "I removed the import" is not evidence, and a source grep answers only "is the
// string in this file" — it says nothing about what the process actually loaded, and nothing at
// all about a transitive import three modules down.
//
// Two things that CAN fail:
//
//   1. RECORDS every module URL the runtime actually resolves, appended to PG_OUT. That makes the
//      module graph an observable artefact. It also makes the recorder falsifiable: the suite
//      asserts the recording contains modules it KNOWS were loaded, so an EMPTY recording can
//      never be mistaken for a clean one.
//
//   2. TRAPS the `pg` driver at LOAD time. Any module resolving into node_modules/pg/ is replaced
//      with one that throws — static, dynamic, direct or transitive alike. A control mode
//      deliberately imports the real driver and asserts the throw, so a green from the real run
//      is a green from an instrument proven to bite.
//
// SCOPE, stated because a negative claim is only as wide as the ground it examined: this covers
// the two merge-check entrypoints. It says nothing about tower-loop/accept.mjs, which is
// Postgres-only, has zero code callers, and is deliberately left untouched by WP-2F.

import fs from 'node:fs';

// Precise: the `pg` package directory, not `pg-format`, `pg-pool` or `pg-types` — matching those
// would make the trap fire on things that are not the driver and turn a real control into noise.
const PG_RE = /[/\\]node_modules[/\\]pg[/\\]/;

let outPath = null;

export async function initialize(data) {
  outPath = data?.outPath ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  const r = await nextResolve(specifier, context);
  if (outPath) {
    try { fs.appendFileSync(outPath, `${r.url}\n`); } catch { /* recording must never break the run */ }
  }
  return r;
}

export async function load(url, context, nextLoad) {
  if (PG_RE.test(url)) {
    const msg = `ZERO-POSTGRES TRAP: the merge-check path loaded the pg driver: ${url}`;
    return { format: 'module', shortCircuit: true, source: `throw new Error(${JSON.stringify(msg)});` };
  }
  return nextLoad(url, context);
}
