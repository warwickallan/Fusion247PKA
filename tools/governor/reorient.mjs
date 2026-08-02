#!/usr/bin/env node
// SESSION-START REORIENTATION (BUILD-018 T-11, NARROWED by WO-OR-05 2026-08-02).
//
// ---------------------------------------------------------------------------
// WHAT THIS MODULE IS NOW, AND WHAT IT STOPPED BEING
// ---------------------------------------------------------------------------
// It used to be a BUILD-* programme recovery engine: it walked every worktree in the
// estate looking for `Deliverables/*/programme-state.json`, collapsed multiple checkouts
// of one programme, adjudicated disagreeing copies, assessed banked-head freshness
// against the banking commit, and rendered a resumption ticket. All of that is deleted.
// Programme state no longer exists in this estate, so on every real session that machinery
// had exactly one output — "NO BANKED PROGRAMME STATE FOUND" — which is a lot of code to
// print one sentence nobody can act on.
//
// THREE BEHAVIOURS SURVIVE, and they are the reason the module survives at all:
//
//   1. THE LOOSE-`Deliverables/` SWEEP. Recent top-level `Deliverables/*.md` that no
//      programme file describes, with the ones that appear to be waiting on Warwick
//      flagged. This is the behaviour that caught the VlogOps plan a fresh session had
//      no other way of seeing, and it has no replacement anywhere in the estate.
//   2. THE HONCHO CONTINUITY BRIEF. `continuity.mjs` owns the single read path; this
//      module calls it and passes the result through. It is the AUTHORITATIVE source of
//      current focus — the sweep is a fallback and must never be mistaken for it.
//   3. REPOSITORY / WORKTREE / BRANCH VERIFICATION. Where this session actually is, read
//      by EXECUTING git rather than by believing anything.
//
// ---------------------------------------------------------------------------
// ONE HONEST CHANGE IN KIND TO (3), STATED RATHER THAN SMUGGLED
// ---------------------------------------------------------------------------
// Verification used to be a COMPARISON: live location versus the canonical location
// recorded in banked programme state, producing ALIGNED or a WRONG WORKTREE alarm. With
// no banked state there is no canonical location to compare against, so what survives is
// the REPORT — cwd, repository root, branch, HEAD, working-tree cleanliness, unpushed
// count and upstream — with no verdict attached. Every fact below is still executed and
// still true; there is simply nothing left to be right or wrong relative to. Anyone
// reading this brief expecting an alignment verdict should know it is gone rather than
// assume a silent ALIGNED.
//
// INV-2 THROUGHOUT: this is a SessionStart hook. It always exits 0, it never blocks a
// session, and every section fails open independently — a section that cannot be produced
// is reported as such and the others still render.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { readContinuityBrief } from './continuity.mjs';

// INLINED from the deleted `rotate-session.mjs` (WO-OR-05). Four lines, one caller, and
// keeping a module alive to export them would have been the tail wagging the dog.
//
// Its sibling `isBankingCommit` was NOT inlined: its only consumer here was the
// banked-freshness assessment, which went with the programme state. Inlining a helper
// whose sole consumer has been deleted would re-grow the corpse this Work Order removed.
export function normaliseSeparators(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/').replace(/\/+$/, '') : p;
}

// ---------------------------------------------------------------------------
// SessionStart source policy — Silas's decision D-B §B-2 (2026-08-01)
// ---------------------------------------------------------------------------
// An UNRECOGNISED source falls through to the MOST informative brief, never to
// silence: an over-informative brief wastes a few hundred characters, an absent
// one loses the session. Unknown is never absent (INV-1).
export const BRIEF_MODE = { FULL: 'full', DELTA: 'delta' };

export const SOURCE_POLICY = {
  clear: {
    mode: BRIEF_MODE.FULL,
    headline: 'This context was CLEARED. Nothing of the previous session survives in context.',
  },
  startup: {
    mode: BRIEF_MODE.FULL,
    headline: 'This is a FRESH session. Nothing has been established in this context yet.',
  },
  compact: {
    mode: BRIEF_MODE.FULL,
    headline:
      'RECOVERY — this context was COMPACTED. Treat in-context memory as a lossy summary, ' +
      'not as evidence; re-read from disk before acting on anything you think you remember.',
  },
  resume: {
    mode: BRIEF_MODE.DELTA,
    headline:
      'This session was RESUMED, so your restored transcript already carries the history. ' +
      'Only the delta is below. Your restored history may PREDATE durable state on disk — ' +
      'durable state on disk wins over anything in the transcript.',
  },
};

// Returns the rendering policy for a SessionStart source. Never returns null:
// an unrecognised or absent source is reported as such and still gets a brief.
export function briefModeFor(source) {
  const known = Object.prototype.hasOwnProperty.call(SOURCE_POLICY, source)
    ? SOURCE_POLICY[source]
    : null;
  if (known) return { ...known, source, recognised: true };
  const shown = source === undefined || source === null ? '(absent)' : JSON.stringify(source);
  return {
    mode: BRIEF_MODE.FULL,
    recognised: false,
    source,
    headline:
      `UNRECOGNISED SessionStart source ${shown} — this governor does not know this entry ` +
      'path, so it is giving you the FULL brief rather than guessing. Report the value above.',
  };
}

// ---------------------------------------------------------------------------
// Hook input — pure, never throws
// ---------------------------------------------------------------------------

export function parseHookInput(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, reason: 'empty stdin', payload: {} };
  }
  try {
    const payload = JSON.parse(raw);
    // `typeof [] === 'object'`, so an array would slip through a naive check and
    // then read `source`/`cwd` as undefined — a malformed payload silently
    // becoming a skip. Only a plain object is a hook payload.
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, reason: 'stdin was not a JSON object', payload: {} };
    }
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: `stdin was not valid JSON: ${err.message}`, payload: {} };
  }
}

// ---------------------------------------------------------------------------
// PRESERVED BEHAVIOUR 3 — repository / worktree / branch verification
// ---------------------------------------------------------------------------
// Injectable and fails soft, field by field. Every field is INDEPENDENTLY nullable
// because a partial answer must never read as a whole one: `unpushed: null` means "there
// is no upstream, or git would not say", and it is a different claim from `unpushed: 0`.

export function gitFacts(worktreePath, execFile = execFileSync) {
  const run = (args) =>
    execFile('git', ['-C', worktreePath, ...args], { encoding: 'utf8' }).toString().trim();
  const soft = (fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  return {
    worktreePath: normaliseSeparators(worktreePath),
    repoRoot: soft(() => normaliseSeparators(run(['rev-parse', '--show-toplevel']))),
    headSha: soft(() => run(['rev-parse', 'HEAD'])),
    branch: soft(() => run(['rev-parse', '--abbrev-ref', 'HEAD'])),
    dirty: soft(() => run(['status', '--porcelain']).length > 0),
    unpushed: soft(() => {
      const parsed = parseInt(run(['rev-list', '--count', '@{u}..HEAD']), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }),
    // The CURRENT pushed head, read live from the remote-tracking ref — not whatever was
    // pushed at some point in the past. A resuming session needs to know what is actually
    // durable on the remote right now.
    upstreamRef: soft(() => run(['rev-parse', '--abbrev-ref', '@{u}'])),
    upstreamSha: soft(() => run(['rev-parse', '@{u}'])),
  };
}

function show(v) {
  if (v === null || v === undefined) return '(unknown)';
  return String(v);
}

export function renderLocationSection(facts) {
  if (!facts) return null;
  const lines = [
    '⟦GOV⟧ WHERE THIS SESSION IS (executed, not assumed):',
    `  cwd          : ${show(facts.worktreePath)}`,
    `  repo root    : ${show(facts.repoRoot)}`,
    `  branch       : ${show(facts.branch)}`,
    `  HEAD         : ${show(facts.headSha)}`,
    `  working tree : ${facts.dirty === null ? '(unknown)' : facts.dirty ? 'DIRTY — uncommitted changes present' : 'clean'}`,
  ];
  if (facts.upstreamRef) {
    lines.push(`  upstream     : ${facts.upstreamRef} @ ${show(facts.upstreamSha)}`);
    lines.push(
      `  unpushed     : ${facts.unpushed === null ? '(unknown)' : `${facts.unpushed} commit(s) ahead of upstream`}`
    );
  } else {
    lines.push('  upstream     : (none tracked — nothing here is pushed)');
  }
  // Stated because its ABSENCE is a change a reader could otherwise mistake for a pass.
  lines.push(
    '  No alignment verdict is offered: with no banked programme state there is no canonical'
  );
  lines.push('  location to compare against. These are facts, not an approval to implement.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PRESERVED BEHAVIOUR 1 — the loose-`Deliverables/` sweep
// ---------------------------------------------------------------------------
// Carried through this narrowing UNCHANGED in behaviour. It surfaces recent top-level
// `Deliverables/*.md` that the deleted programme recovery could never see — the failure
// that let a fresh session miss the VlogOps plan entirely — and flags the ones whose text
// reads as waiting on Warwick.
//
// It is a FALLBACK and never the source of truth for current focus (Warwick's ruling);
// Honcho holds the explicit focus. The rendering says so on its own line, because a
// reader who takes this list as the focus will work on the wrong thing.

const ESTATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DELIVERABLE_WINDOW_DAYS = 21;
const DECISION_MARKER =
  /nothing (will|would) be built|awaiting (your|a) |until you accept|your call|needs? (a )?(decision|your )|accept (this|a) plan|what i need:|waiting on you|before any building/i;

export function sweepOpenDeliverables(root = ESTATE_ROOT, now = Date.now()) {
  const dir = join(root, 'Deliverables');
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return null; // no Deliverables folder — nothing to sweep, never an error
  }
  const cutoff = now - DELIVERABLE_WINDOW_DAYS * 86400_000;
  const rows = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.md')) continue; // top-level *.md only
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile() || st.mtimeMs < cutoff) continue;
    let head = '';
    try {
      head = readFileSync(full, 'utf8').slice(0, 6000);
    } catch {
      continue;
    }
    const h1 = (head.match(/^#\s+(.+)$/m) || [])[1]?.trim() || name.replace(/\.md$/, '');
    const awaits = DECISION_MARKER.test(head);
    rows.push({ name, title: h1, mtimeMs: st.mtimeMs, awaits });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const top = rows.slice(0, 8);
  const lines = ['⟦GOV⟧ OPEN DELIVERABLES (loose, not BUILD-* — nothing else surfaces these):'];
  for (const r of top) {
    const flag = r.awaits ? '  ⟵ AWAITS YOUR DECISION' : '';
    lines.push(`  • ${r.title} — Deliverables/${r.name}${flag}`);
  }
  const pending = top.filter((r) => r.awaits).length;
  if (pending) lines.push(`  ${pending} deliverable(s) appear to be waiting on Warwick — treat as a pending product-decision handback.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export function toHookOutput(additionalContext) {
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: additionalContext || '',
    },
  };
}

/**
 * buildBrief(raw, deps) -> string
 *
 * The three surviving sections, each guarded independently so one failure cannot
 * suppress the others. Synchronous half only — the Honcho brief is async and is appended
 * by `main()`, which keeps this function testable with no network and no clock.
 */
export function buildBrief(raw, {
  cwd = process.cwd(),
  facts = null,
  factsFn = gitFacts,
  sweepFn = sweepOpenDeliverables,
} = {}) {
  const parsed = parseHookInput(raw);
  const policy = briefModeFor(parsed.payload?.source);
  const where = normaliseSeparators(parsed.payload?.cwd) || normaliseSeparators(cwd);

  const sections = [`⟦GOV⟧ SESSION START — ${policy.headline}`];

  try {
    const f = facts ?? factsFn(where);
    const rendered = renderLocationSection(f);
    if (rendered) sections.push(rendered);
  } catch (err) {
    sections.push(`⟦GOV⟧ WHERE THIS SESSION IS: could not be established (${err.message}).`);
  }

  try {
    const sweep = sweepFn();
    if (sweep) sections.push('(fallback, not the source of truth for focus)\n' + sweep);
  } catch (err) {
    sections.push(`⟦GOV⟧ OPEN DELIVERABLES: sweep failed (${err.message}).`);
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// CLI — installed as a SessionStart hook. ALWAYS exits 0 (INV-2).
// ---------------------------------------------------------------------------

async function main() {
  let raw = '';
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  } catch {
    raw = '';
  }

  let body;
  try {
    body = buildBrief(raw);
  } catch (err) {
    body = `⟦GOV⟧ SESSION START: reorientation failed hard (${err.message}). Orient by hand.`;
  }

  // PRESERVED BEHAVIOUR 2 — the Honcho continuity brief, read EVERY session start.
  // `continuity.mjs` owns the single read path; this is a passthrough and adds no
  // interpretation. It is read LAST in code and placed FIRST in nothing: it is the
  // authoritative focus, so it is appended where a reader will reach it after knowing
  // where they are. It fails open — a slow or unreachable Honcho never blocks a session.
  let continuity;
  try {
    continuity = await readContinuityBrief();
  } catch (err) {
    continuity = `⟦GOV⟧ HONCHO CONTINUITY: brief failed hard (${err.message}).`;
  }

  process.stdout.write(JSON.stringify(toHookOutput(`${body}\n\n${continuity}`)));
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
