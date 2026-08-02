#!/usr/bin/env node
// LIVE status-line entrypoint (BUILD-018 salvage pass, 2026-08-01).
//
// This is the WIRING that was missing. Every component it uses already existed
// and was tested; none of them were connected to anything Warwick could see.
// This file is the smallest end-to-end path from the real statusLine payload to
// one visible line:
//
//   stdin (statusLine JSON)
//     -> sampler.parseStdinPayload / sampleFromStdin   (T-03, writes the health sample)
//     -> evaluator.evaluate(signals)                    (T-04, verdict)
//     -> one compact line on stdout                     (T-05's renderer shape)
//
// ---------------------------------------------------------------------------
// ITS PRIMARY JOB CHANGED (WO-OR-05, 2026-08-02) — READ THIS BEFORE DELETING IT
// ---------------------------------------------------------------------------
// This module was on the teardown's bin list and was moved back to KEEP mid-order. The
// argument for binning it was sound about its OUTPUT and wrong about its INPUT: a
// terminal status line is invisible to Warwick, who works on claude.ai web and Android,
// so as a RENDERER it reaches nobody.
//
// But the statusLine stdin payload is the only place the runtime states
// `context_window.context_window_size` — the DENOMINATOR. The transcript-derived Stop
// path (see sampler.mjs) reaches every client and carries the numerator only. Delete this
// file and the percentage becomes permanently unrenderable, leaving the repaired footer
// stuck at a bare token count forever.
//
// So: this is now THE DENOMINATOR OBSERVER first and a renderer second. `sampleFromStdin`
// below is a live, load-bearing path, not legacy. The sample it writes already records
// `model.id` beside `context_window_size`, which is exactly what
// `sampler.resolveWindowTokens` needs to refuse a cross-model denominator — no change was
// required here to make that rule checkable.
//
// It answers:
//   1. current context usage / health
//   2. KEEP GOING or CLEAR NOW
// It no longer answers "recommended next model": that came from banked programme state,
// which WO-OR-05 deleted. `next:` is now supplied by whoever knows the next action, and a
// status line does not, so this surface always renders `UNSET`.
//
// CONTRACT: never throw, always exit 0, always print exactly one line. A
// statusLine command that crashes or exits non-zero breaks the UI that invokes
// it, so every failure path here degrades to a printable line instead.
//
// ---------------------------------------------------------------------------
// WP-5 — THIS FILE NO LONGER OWNS THE GRAMMAR (D-D, AC3)
// ---------------------------------------------------------------------------
// It used to compose the `⟦GOV⟧` line itself: its own state/advice mapping, its
// own model lookup, its own separators. `footer.mjs` now owns that end to end —
// one renderer, one parser, one vocabulary — because a footer produced by one
// actor and parsed by another is only a contract if both go through the same
// code. Two hand-written copies are a convention, and conventions drift. So:
//
//   stdin (statusLine JSON)
//     -> sampler.extractHealthSample   shape the payload as a health sample
//     -> footer.deriveFooterFields     the degradation ladder (BLIND is never GREEN)
//     -> footer.renderFooter           the byte grammar
//
// `computeFooterLine` is deliberately NOT used: it re-resolves the sample from
// the health store on disk, and on this path the fresher payload is already in
// hand. Reading back what we just wrote would give one fact two sources.
//
// `next:` is ALWAYS emitted. The grammar expresses absence as the VALUE `UNSET`, never as
// a missing segment, so a parser never has to guess which field it is looking at.

import { parseStdinPayload, sampleFromStdin, extractHealthSample } from './sampler.mjs';
import {
  deriveFooterFields,
  renderFooter,
  adviceFor,
  CONTROL_CONTINUE,
  NEXT_UNSET,
} from './footer.mjs';
import { STATE } from './evaluator.mjs';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// `locationFrom` was DELETED here by WO-OR-05. It existed solely to hand a
// (worktree path, branch) pair to `footer.nextModelFor`, which matched that pair against
// banked programme state to pick a model. Both the predicate and the programme state are
// gone, so the accessor had no consumer left — and dead code invites a caller.
//
// The location facts it read are NOT lost: `sampler.extractHealthSample` still records
// `worktree.{name,path,branch}` and `workspace.git_worktree` into the sample it writes.

/**
 * lineFor(raw, opts) -> string
 *
 * The whole status line as one function: bytes in, one grammatical footer out.
 * Never throws — every internal failure degrades to a BLIND/UNSET line, because
 * an absent governor is indistinguishable from a healthy one.
 */
export function lineFor(raw, { now = Date.now(), sampledAt = new Date().toISOString() } = {}) {
  const payload = parseStdinPayload(raw) || {};

  // ALWAYS UNSET on this surface, and that is a statement rather than a degradation. A
  // model recommendation is a claim about the NEXT ACTION, and a status line has no
  // knowledge of one. The constitution's rule — render a model only when grounded in a
  // real, current next action — is satisfied here by rendering nothing.
  const next = NEXT_UNSET;

  // Reuse the sampler's extraction rather than re-reading the payload by hand:
  // it is already the module that decides how a statusLine payload maps onto a
  // health sample, and a second mapping here could disagree with the one written
  // to disk by main() a few lines below.
  let sample = { ok: false, approximate: false };
  try {
    const data = extractHealthSample(payload, { sampledAt });
    if (data) sample = { ok: true, data, approximate: false };
  } catch {
    // Leave it unreadable; the ladder turns that into an honest BLIND.
  }

  const { fields } = deriveFooterFields({
    sample,
    knownSessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
    now,
    next,
    // A status line is not an assistant message and carries no handback
    // decision, so the control token is always CONTINUE. Nothing has parsed a
    // control token off this surface since the Stop-path controller was deleted
    // by WO-OR-05; it is emitted because the grammar requires all five fields.
    control: CONTROL_CONTINUE,
  });

  return renderFooter(fields);
}

function main() {
  const raw = readStdin();

  // Write the health sample as a side effect (T-03's job). Never fatal.
  try {
    sampleFromStdin(raw, { sampledAt: new Date().toISOString() });
  } catch { /* the sample is a bonus, not a precondition for the line */ }

  return lineFor(raw);
}

// Run ONLY when executed directly. Without this guard the module printed a line
// and called `process.exit(0)` at IMPORT time, which made it impossible to test
// — importing it from a test killed the test runner. Every other module in
// tools/governor/ already uses this exact entrypoint guard; this one is now
// consistent with them, and the CLI behaviour when actually invoked is
// unchanged (one line on stdout, always exit 0).
// AC5 — the three-layer never-throw ladder. A statusLine command that crashes or
// exits non-zero breaks the UI that invokes it, so there is no input for which
// this prints nothing or exits non-zero.
//
// The old last-resort line was HAND-COMPOSED and was not even grammatical — four
// fields plus a parenthetical error message, which `parseFooter` rejects. A
// hand-composed footer is a defect by CLAUDE.md § "Governor advice", so layer 2
// now goes through the same strict renderer as every other path.
//
// LAST_RESORT_LINE is the one remaining literal, for the case where the renderer
// ITSELF is broken and layer 2 cannot run. It is pinned by a test asserting it is
// byte-identical to what `renderFooter` produces for those exact fields — a
// literal held outside the code it checks, so the copy cannot silently drift.
//
// UPDATED 2026-08-02 (Warwick's ruling: BLIND must not pair with graded advice). Both
// fallbacks below said `KEEP GOING?`, which is the retired value — so the two paths that
// fire when everything else has already failed would have emitted precisely the pairing
// the ruling forbids, at the moment it is least likely to be noticed and most likely to
// mislead. A defect class survives its own fix by hiding in the branch nobody reaches.
export const LAST_RESORT_LINE = '⟦GOV⟧ ctx -- · BLIND · NO ADVICE · next: UNSET · CONTINUE';

export function safeLine(raw, opts) {
  try {
    return lineFor(raw, opts);
  } catch {
    try {
      return renderFooter({
        percent: null,
        approximate: false,
        state: STATE.BLIND,
        // DERIVED, not hand-picked. This branch is unreachable from outside the module
        // (`lineFor` degrades rather than throwing), so no test can force it — and a
        // literal that nothing can execute is exactly where a stale value survives a
        // vocabulary change. Reading the shared mapping means this line cannot disagree
        // with the ladder about what BLIND advises, whatever that answer becomes next.
        advice: adviceFor(STATE.BLIND),
        next: NEXT_UNSET,
        control: CONTROL_CONTINUE,
      });
    } catch {
      return LAST_RESORT_LINE;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let line;
  try {
    line = main();
  } catch {
    line = safeLine('');
  }
  process.stdout.write(`${line}\n`);
  process.exit(0);
}
