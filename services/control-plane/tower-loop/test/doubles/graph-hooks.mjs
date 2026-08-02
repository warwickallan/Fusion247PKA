// WO-TW-02 — ZERO-CLICKUP INSTRUMENTATION: Node module-customisation hooks.
//
// The Work Order's bar, and it is the right one: "I didn't call it" is not evidence, and a zero
// from a counter nobody wired is a false green. So this file does two things that CAN fail:
//
//   1. RECORDS every module URL the runtime actually resolves, appended to GRAPH_OUT. That makes
//      the module graph an observable artefact rather than a claim about it — and it means the
//      recorder itself is falsifiable: a test can assert the recording contains modules it KNOWS
//      were loaded, so an empty file can never be mistaken for a clean one.
//
//   2. TRAPS anything ClickUp-shaped at LOAD time. If any module whose URL matches /clickup/i is
//      ever loaded on this path, it is replaced with a module that throws. The trap fires whether
//      the import is static, dynamic, direct or transitive, and it is proven to bite by a control
//      that deliberately imports the real ClickUp client and asserts the throw.
//
// Why both: a grep answers "is the string in the file"; enumeration answers "what did the process
// actually load"; the trap answers "and what happens if that ever changes". Only the last two
// survive somebody adding an import next month.

import fs from 'node:fs';

const CLICKUP_RE = /clickup/i;
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
  if (CLICKUP_RE.test(url)) {
    const msg = `ZERO-CLICKUP TRAP: this path loaded a ClickUp module: ${url}`;
    return { format: 'module', shortCircuit: true, source: `throw new Error(${JSON.stringify(msg)});` };
  }
  return nextLoad(url, context);
}
