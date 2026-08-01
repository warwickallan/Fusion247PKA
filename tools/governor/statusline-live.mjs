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
// It answers the three things the build was commissioned to show:
//   1. current context usage / health
//   2. KEEP GOING or CLEAR NOW
//   3. recommended next model
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
//     -> footer.deriveFooterFields     the D-3 degradation ladder (BLIND is never GREEN)
//     -> footer.nextModelFor           the D-4 UNSET predicate
//     -> footer.renderFooter           the D-2 byte grammar
//
// `computeFooterLine` is deliberately NOT used: it re-resolves the sample from
// the health store on disk, and on this path the fresher payload is already in
// hand. Reading back what we just wrote would give one fact two sources.
//
// TWO BEHAVIOUR CHANGES A REVIEWER SHOULD EXPECT TO SEE, both required:
//
//  1. `next:` is ALWAYS emitted. D-2 expresses absence as the VALUE `UNSET`,
//     never as a missing segment, so a parser never has to guess which field it
//     is looking at. The old code dropped the segment entirely.
//  2. The model is resolved by `nextModelFor`, whose rule is far stricter than
//     the interim `programme.status === "active"` this file used to apply. It
//     matches the live (worktree, branch) against `resumption`, then requires
//     `next_action_kind === "action"`, a grammar-representable model, a
//     `for_ticket` matching `resumption.ticket`, a `computed_at_head` matching
//     `banked.head_sha`, and an unresolved ticket. A banked literal failing any
//     of those renders UNSET — which is the POINT of D-4. A stale recommendation
//     presented as live advice is the defect; UNSET is the correct output, not a
//     degraded one.
//
// The superseded `recommendedModel()` is DELETED rather than left unused: two
// rival selection rules on one surface is the SSOT defect, and dead code invites
// a caller.

import { parseStdinPayload, sampleFromStdin, extractHealthSample } from './sampler.mjs';
import {
  deriveFooterFields,
  nextModelFor,
  renderFooter,
  CONTROL_CONTINUE,
  NEXT_UNSET,
  ADVICE,
} from './footer.mjs';
import { STATE } from './evaluator.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// AC4 — THE PAYLOAD FIELDS THAT ACTUALLY EXIST.
//
// This replaces `payload?.cwd || payload?.workspace?.current_dir`, which was not
// merely inelegant: BOTH of those fields are ABSENT from the real statusLine
// payload, verified against a live sample. `workspace` IS present, but carries
// only `git_worktree` — a bare directory NAME, not a path. So the old lookup
// always evaluated to undefined and silently fell back to `process.cwd()`, the
// directory this PROCESS happens to run in, which is not necessarily the
// session's worktree. It answered a question nobody asked, confidently.
//
// The real payload carries `worktree.path` and `worktree.branch` — exactly the
// (path, branch) pair `nextModelFor`'s U-a needs, and with no git call.
export function locationFrom(payload) {
  const path = payload?.worktree?.path;
  const branch = payload?.worktree?.branch;
  return {
    worktreePath: typeof path === 'string' && path.length ? path : null,
    worktreeBranch: typeof branch === 'string' && branch.length ? branch : null,
  };
}

/**
 * lineFor(raw, opts) -> string
 *
 * The whole status line as one function: bytes in, one grammatical footer out.
 * Never throws — every internal failure degrades to a BLIND/UNSET line, because
 * an absent governor is indistinguishable from a healthy one.
 */
export function lineFor(raw, { now = Date.now(), sampledAt = new Date().toISOString() } = {}) {
  const payload = parseStdinPayload(raw) || {};
  const { worktreePath, worktreeBranch } = locationFrom(payload);

  // D-4. An unknown location cannot ground a recommendation, so it is UNSET —
  // never a fallback to whatever directory this process was launched in.
  let next = NEXT_UNSET;
  try {
    next = nextModelFor({
      worktreePath,
      worktreeBranch,
      deliverablesDir: worktreePath ? join(worktreePath, 'Deliverables') : null,
    }).next;
  } catch {
    next = NEXT_UNSET;
  }

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
    // decision, so the control token is always CONTINUE. Inert here by
    // construction: stop-controller.mjs parses `last_assistant_message` only and
    // never reads this surface.
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
export const LAST_RESORT_LINE = '⟦GOV⟧ ctx -- · BLIND · KEEP GOING? · next: UNSET · CONTINUE';

export function safeLine(raw, opts) {
  try {
    return lineFor(raw, opts);
  } catch {
    try {
      return renderFooter({
        percent: null,
        approximate: false,
        state: STATE.BLIND,
        advice: ADVICE.UNSURE,
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
