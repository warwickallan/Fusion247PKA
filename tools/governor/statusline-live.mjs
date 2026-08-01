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

import { parseStdinPayload, sampleFromStdin } from './sampler.mjs';
import { evaluate, STATE } from './evaluator.mjs';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

// KEEP GOING / CLEAR NOW — the binary Warwick actually asked for. BLIND never
// reads as healthy (AD-3), but it also must not force a rotation on unknown
// telemetry, so it is surfaced as KEEP GOING with the blindness stated.
function advice(state) {
  switch (state) {
    case STATE.RED: return 'CLEAR NOW';
    case STATE.RECOVERY: return 'CLEAR NOW';
    case STATE.AMBER: return 'KEEP GOING';
    case STATE.GREEN: return 'KEEP GOING';
    case STATE.BLIND: return 'KEEP GOING?';
    default: return 'KEEP GOING?';
  }
}

// The recommended next model comes from the banked programme state — the same
// value /rotate-session writes and the reorientation brief reads. Found from the
// session's own cwd so this works in any build's worktree; absent is fine.
function recommendedModel(cwd) {
  try {
    const deliverables = join(cwd || process.cwd(), 'Deliverables');
    if (!existsSync(deliverables)) return null;
    for (const entry of readdirSync(deliverables)) {
      const p = join(deliverables, entry, 'programme-state.json');
      if (!existsSync(p)) continue;
      const doc = JSON.parse(readFileSync(p, 'utf8'));
      const m = doc?.model_recommendation?.model;
      if (typeof m === 'string' && m.length) return m;
    }
  } catch {
    // A missing/rotten/unreadable state file must never break the status line.
  }
  return null;
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const raw = readStdin();

  // Write the health sample as a side effect (T-03's job). Never fatal.
  try {
    sampleFromStdin(raw, { sampledAt: new Date().toISOString() });
  } catch { /* the sample is a bonus, not a precondition for the line */ }

  const payload = parseStdinPayload(raw) || {};
  const ctx = payload.context_window || {};
  const used = num(ctx.used_percentage);

  const verdict = evaluate({
    contextUsedPercentage: used,
    rateLimitFiveHourUsedPercentage: num(payload?.rate_limits?.five_hour?.used_percentage),
    // compactions / bankedStateStale / safeBoundary are genuinely unknown here:
    // no PreCompact counter is wired and a status line must not shell out to git.
    // Absent is `unknown`, never 0 — the evaluator's own missing-field rule.
  });

  const pct = used === undefined ? '--' : `${Math.round(used)}%`;
  const model = recommendedModel(payload?.cwd || payload?.workspace?.current_dir);

  const parts = [`ctx ${pct}`, verdict.state, advice(verdict.state)];
  if (model) parts.push(`next: ${model}`);
  return `⟦GOV⟧ ${parts.join(' · ')}`;
}

let line;
try {
  line = main();
} catch (err) {
  // Absolute last resort: still print, still exit 0.
  line = `⟦GOV⟧ ctx -- · BLIND · KEEP GOING? (governor error: ${err?.message || err})`;
}
process.stdout.write(`${line}\n`);
process.exit(0);
