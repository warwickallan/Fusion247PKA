// Reorientation — SessionStart(source="clear") → additionalContext (BUILD-018 T-11)
//
// The half of the rotation loop that gets banked state INTO the fresh session.
// T-10 banks, pushes and renders the handoff; without T-11 a human still has to
// point the fresh Larry at that handoff by hand — which is precisely the
// re-briefing this build exists to remove (goal contract, capability 5).
//
// WHAT THIS EMITS (AD-5)
// ----------------------
// A POINTER BRIEF, not the state. `hookSpecificOutput.additionalContext` is
// capped at 10,000 characters, so a full state dump is impossible by
// construction. The brief carries only what must not be re-derived — programme,
// phase, EXACT next action, ticket, model, worktree, branch, frontier, do-nots —
// plus the paths to read for everything else.
//
// LOUD, NEVER SILENT (INV-1)
// --------------------------
// Missing, stale, corrupt or ambiguous state each produce their OWN brief saying
// so in the first line. A fresh Larry that receives no signal cannot tell "there
// is nothing to resume" from "the governor broke", so this module never returns
// nothing: silence is the one output it is not allowed to have.
//
// NEVER TRAPS (INV-2)
// -------------------
// SessionStart cannot block a prompt, but it can still break a session start by
// throwing. Every path is wrapped; the CLI always exits 0; an internal failure
// becomes a brief that says the governor failed, never an exception.
//
// AD-14 — staleness is isBankingCommit(), never a raw comparison
// --------------------------------------------------------------
// `banked.head_sha` is the head the state DESCRIBES: the parent of the commit
// carrying the state file. A naive `HEAD !== banked.head_sha` reports every
// freshly banked state as stale, so every rotation would open with a false
// RECOVERY warning and Warwick would learn to ignore it.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { readProgrammeState, frontierTickets } from './programme-state.mjs';
import { isBankingCommit, normaliseSeparators } from './rotate-session.mjs';
import {
  canonicalFromState,
  liveLocation,
  compareLocation,
  buildDenyReason,
  LOCATION,
} from './worktree-guard.mjs';
import { applyModelGate } from './model-gate.mjs';

// AD-5. A hard contract from the host, not a preference.
export const CONTEXT_CAP = 10000;

// Distinct outcomes so "found nothing" can never be confused with "did not look"
// (INV-1). The CLI still exits 0 for all of them — this is the brief's verdict,
// not the process's exit code.
export const VERDICT = {
  ORIENTED: 'oriented',
  WRONG_WORKTREE: 'wrong-worktree',
  STALE: 'stale',
  MISSING: 'missing',
  CORRUPT: 'corrupt',
  AMBIGUOUS: 'ambiguous',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

// ---------------------------------------------------------------------------
// SessionStart source policy — Silas's decision D-B §B-2 (2026-08-01)
// ---------------------------------------------------------------------------
// SPEC AMENDMENT (WO-2026-08-01-01, AC1). This REPLACES the former
// `source !== 'clear'` guard, which made reorientation unreachable on `startup`
// and `resume` — two of the three real ways a build is re-entered, and the two
// with the emptiest context. That guard and the installer's `matcher: 'clear'`
// were two independent gates; widening either alone ships nothing, which is why
// install-hooks.mjs drops its SessionStart matcher in the same change.
//
// An UNRECOGNISED source falls through to the MOST informative brief, never to
// silence: an over-informative brief wastes a few hundred characters, an absent
// one loses the build. Unknown is never absent (INV-1).
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
      'Only the delta is below. Your restored history may PREDATE the banked state — ' +
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
// Discovery — find banked programme state ACROSS the estate
// ---------------------------------------------------------------------------
// The fresh session starts in the primary checkout, but a build's state lives
// with the build on the build's branch (AD-14) — i.e. in a different worktree
// entirely. So discovery walks `git worktree list`, which is ground truth, rather
// than trusting any recorded path. A recorded path that disagrees with where the
// file actually is would be exactly the kind of stale pointer this build exists
// to eliminate.

export function listWorktrees(repoPath, execFile = execFileSync) {
  try {
    const out = execFile('git', ['-C', repoPath, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .filter((l) => l.startsWith('worktree '))
      .map((l) => normaliseSeparators(l.slice('worktree '.length).trim()))
      .filter(Boolean);
  } catch {
    return null; // unknown, never an empty list (T-09's D-2 rule)
  }
}

export function discoverStateFiles(worktreePaths, { readdir = readdirSync } = {}) {
  const found = [];
  for (const wt of worktreePaths || []) {
    const deliverables = join(wt, 'Deliverables');
    let entries;
    try {
      entries = readdir(deliverables, { withFileTypes: true });
    } catch {
      continue; // no Deliverables here, or unreadable — not an error, just not a hit
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const candidate = join(deliverables, e.name, 'programme-state.json');
      if (existsSync(candidate)) {
        found.push({ worktree: wt, path: normaliseSeparators(candidate) });
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Git facts for one programme's worktree — injectable, fails soft
// ---------------------------------------------------------------------------

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
    headSha: soft(() => run(['rev-parse', 'HEAD'])),
    headParentSha: soft(() => run(['rev-parse', 'HEAD^'])),
    branch: soft(() => run(['rev-parse', '--abbrev-ref', 'HEAD'])),
    dirty: soft(() => {
      const s = run(['status', '--porcelain']);
      return s.length > 0;
    }),
    unpushed: soft(() => {
      const n = run(['rev-list', '--count', '@{u}..HEAD']);
      const parsed = parseInt(n, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }),
    // The CURRENT pushed head, read live from the remote-tracking ref — not the
    // head that happened to be pushed when the state was banked. A resuming
    // session needs to know what is actually durable on the remote right now.
    upstreamRef: soft(() => run(['rev-parse', '--abbrev-ref', '@{u}'])),
    upstreamSha: soft(() => run(['rev-parse', '@{u}'])),
  };
}

// ---------------------------------------------------------------------------
// Staleness — AD-14. Unknown is stale, never fresh.
// ---------------------------------------------------------------------------

export function assessBankedFreshness(state, facts) {
  const warnings = [];
  let checked = 0;
  const banked = state?.banked?.head_sha;

  checked += 1;
  let stale = false;
  if (!banked || banked === 'unknown') {
    stale = true;
    warnings.push('banked head_sha is unknown — freshness cannot be established, so this state is treated as STALE.');
  } else if (!facts?.headSha) {
    stale = true;
    warnings.push('live git HEAD could not be read — freshness cannot be established, so this state is treated as STALE.');
  } else if (
    !isBankingCommit({
      headSha: facts.headSha,
      bankedHeadSha: banked,
      headParentSha: facts.headParentSha,
    })
  ) {
    stale = true;
    warnings.push(
      `HEAD has moved since banking: banked ${banked.slice(0, 7)}, live HEAD ${facts.headSha.slice(0, 7)}` +
        `${facts.headParentSha ? ` (parent ${facts.headParentSha.slice(0, 7)})` : ''}. ` +
        'Commits exist that the banked state does not describe — re-read the map before trusting the next action.'
    );
  }

  checked += 1;
  if (facts?.dirty === true) {
    warnings.push('The programme worktree is DIRTY — uncommitted work exists that the banked state does not describe.');
  } else if (facts?.dirty === null || facts?.dirty === undefined) {
    warnings.push('Working-tree cleanliness could not be determined — unknown is not clean.');
  }

  checked += 1;
  if (typeof facts?.unpushed === 'number' && facts.unpushed > 0) {
    warnings.push(`${facts.unpushed} unpushed commit(s) in the programme worktree — the banked state is not durable on the remote.`);
  } else if (facts?.unpushed === null || facts?.unpushed === undefined) {
    warnings.push('Unpushed-commit count could not be determined — unknown is never zero.');
  }

  checked += 1;
  const recorded = normaliseSeparators(state?.repository?.worktree);
  const live = normaliseSeparators(facts?.worktreePath);
  if (recorded && live && recorded.toLowerCase() !== live.toLowerCase()) {
    warnings.push(`Recorded worktree (${recorded}) is not where this state was found (${live}) — trust the live path.`);
  }

  return { stale, warnings, checked };
}

// ---------------------------------------------------------------------------
// Safe truncation (the T-11 mutation test)
// ---------------------------------------------------------------------------
// Sections are emitted in priority order. `required: true` sections are NEVER
// dropped; optional sections are dropped from the LOWEST priority upward until
// the brief fits. Every drop is recorded and rendered as a loud notice, so the
// brief can never quietly become smaller than the truth.
//
// If the required core alone still exceeds the cap, the long free-text fields
// inside it are hard-truncated with an explicit marker naming where to read the
// full text. What is never permitted is the brief silently omitting the next
// action — the single field the whole build exists to carry across a rotation.

export function truncateField(text, limit, sourcePath) {
  if (typeof text !== 'string' || text.length <= limit) return { text, truncated: false };
  const marker = `… [TRUNCATED — read the full text in ${sourcePath}]`;
  const keep = Math.max(0, limit - marker.length);
  return { text: text.slice(0, keep) + marker, truncated: true };
}

export function assembleBrief(sections, { cap = CONTEXT_CAP } = {}) {
  const dropped = [];
  let live = sections.slice();

  const render = (list) => list.map((s) => s.body).join('\n\n');

  // Drop optional sections from the end (lowest priority) until it fits.
  while (render(live).length > cap) {
    let idx = -1;
    for (let i = live.length - 1; i >= 0; i--) {
      if (!live[i].required) {
        idx = i;
        break;
      }
    }
    if (idx === -1) break; // only required sections left
    dropped.push(live[idx].name);
    live = live.filter((_, i) => i !== idx);
  }

  let text = render(live);

  if (dropped.length) {
    const notice =
      `\n\n⚠️ BRIEF TRUNCATED to fit the ${cap}-character SessionStart cap. ` +
      `${dropped.length} section(s) omitted: ${dropped.join(', ')}. ` +
      `They were NOT empty — read them in the programme state and map named above.`;
    // The notice itself is required, so make room for it rather than exceeding.
    if ((text + notice).length > cap) {
      text = text.slice(0, Math.max(0, cap - notice.length));
    }
    text += notice;
  }

  return { text, dropped, fits: text.length <= cap, length: text.length };
}

// ---------------------------------------------------------------------------
// The briefs
// ---------------------------------------------------------------------------

function fence(title) {
  return `${'='.repeat(4)} ${title} ${'='.repeat(Math.max(4, 66 - title.length))}`;
}

export function renderProblemBrief(verdict, { detail, candidates = [], cap = CONTEXT_CAP }) {
  const headline = {
    [VERDICT.MISSING]: 'BUILD GOVERNOR: NO BANKED PROGRAMME STATE FOUND',
    [VERDICT.CORRUPT]: 'BUILD GOVERNOR: BANKED PROGRAMME STATE IS UNUSABLE',
    [VERDICT.AMBIGUOUS]: 'BUILD GOVERNOR: MORE THAN ONE ACTIVE PROGRAMME — PICK ONE',
    [VERDICT.FAILED]: 'BUILD GOVERNOR: REORIENTATION FAILED',
  }[verdict] || 'BUILD GOVERNOR: PROBLEM';

  const guidance = {
    [VERDICT.MISSING]:
      'Do NOT assume there is nothing in flight. This says the governor looked and found no valid state — ' +
      'not that no build is running. Before starting anything, check `git worktree list` and read any ' +
      'Deliverables/<BUILD-*>/02-MAP.md you find.',
    [VERDICT.CORRUPT]:
      'The state file exists but does not validate. Treat in-context memory as untrustworthy (RECOVERY): ' +
      'read the map directly, and repair the state with tools/governor/programme-state.mjs before banking again.',
    [VERDICT.AMBIGUOUS]:
      'Several active programmes were found. The governor will not guess which one this session resumes — ' +
      'choose from the list below and read that programme\'s map first.',
    [VERDICT.FAILED]:
      'The governor itself errored. Nothing here is trustworthy — reorient by hand from the programme map. ' +
      'This message exists so the failure is visible rather than looking like a clean session.',
  }[verdict] || '';

  const sections = [
    {
      name: 'headline',
      required: true,
      body: [fence(headline), '', detail || '(no detail recorded)', '', guidance].join('\n'),
    },
  ];

  if (candidates.length) {
    sections.push({
      name: 'candidates',
      required: false,
      body: [
        fence('CANDIDATES'),
        '',
        ...candidates.map(
          (c, i) =>
            `  ${i + 1}. ${c.id || '(unidentified)'} — ${c.title || ''}\n` +
            `     state    : ${c.path}\n` +
            `     worktree : ${c.worktree}\n` +
            (c.next ? `     next     : ${c.next}\n` : '') +
            (c.problem ? `     PROBLEM  : ${c.problem}\n` : '')
        ),
      ].join('\n'),
    });
  }

  return assembleBrief(sections, { cap });
}

// Requirement 5 — a location mismatch is the LOUDEST thing in the brief, sits
// ABOVE the next action, and states plainly that implementation is not permitted.
// A fresh Larry that reads "here is your next ticket" before it reads "you are in
// the wrong repository" will start work; ordering is part of the control.
export function renderLocationSection(canonical, comparison) {
  if (!canonical || !comparison) return null;

  if (comparison.verdict === LOCATION.ALIGNED) {
    return {
      name: 'location',
      required: true,
      body: [
        fence('LOCATION VERIFIED'),
        '',
        `  ✅ cwd, repository root and branch all match the canonical programme location.`,
        `     worktree : ${canonical.worktree}`,
        `     branch   : ${canonical.branch}`,
        `     HEAD     : ${comparison.live?.headSha || '(unknown)'}${
          comparison.headMoved === true ? '  (moved since banking — see STATE HEALTH)' : ''
        }`,
        `  Implementation is permitted. ${comparison.checked} location check(s) ran.`,
      ].join('\n'),
    };
  }

  return {
    name: 'location',
    required: true,
    body: buildDenyReason({ toolName: 'ANY WRITE', comparison, canonical }).replace(
      '🚨 WRONG WORKTREE — the BUILD-018 Session Governor blocked this tool call.',
      [
        '🚨🚨🚨 WRONG WORKTREE — STOP. DO NOT IMPLEMENT ANYTHING. 🚨🚨🚨',
        '',
        'This session is NOT in the canonical worktree/branch for the active build.',
        'A committed PreToolUse guard will refuse Write, Edit, MultiEdit and mutating',
        'Bash until this is corrected, so attempting the work will simply fail.',
      ].join('\n')
    ),
  };
}

export function renderOrientationBrief(
  state,
  {
    statePath,
    worktree,
    freshness,
    canonical,
    location,
    facts,
    cap = CONTEXT_CAP,
    // D-B §B-2: the source decides the HEADLINE and the SECTION SET, nothing
    // else. Defaulting to `clear` keeps every existing caller's behaviour
    // byte-identical, so this parameter adds a mode rather than changing one.
    sourceMode = briefModeFor('clear'),
  }
) {
  const p = state.programme;
  const r = state.resumption;
  const m = state.model_recommendation;
  const frontier = frontierTickets(state);
  const done = (state.tickets || []).filter((t) => t.state === 'resolved');

  // The next action is the one field that must survive at any cost. It gets a
  // generous but bounded allowance; if it exceeds that it is truncated WITH a
  // pointer, never dropped.
  const nextAction = truncateField(r.next_action, 2400, statePath);
  const focus = truncateField(r.focus, 1200, statePath);

  const status = freshness.stale
    ? '⚠️ BANKED STATE IS STALE — treat in-context memory as unreliable (RECOVERY) and re-read the map before acting.'
    : '✅ Banked state is FRESH against live git (AD-14 banking-commit comparison).';

  const locationSection = renderLocationSection(canonical, location);

  // D-B §B-2 — `resume` gets a SHORT DELTA. The restored transcript already
  // carries the history, so a full brief would spend context re-stating what is
  // already in it. Everything a resumed session cannot obtain from its own
  // transcript is here; everything else is a path.
  if (sourceMode.mode === BRIEF_MODE.DELTA) {
    const deltaSections = [];
    if (locationSection) deltaSections.push(locationSection);
    deltaSections.push({
      name: 'delta',
      required: true,
      body: [
        fence(`RESUMED — ${p.id} (delta only)`),
        '',
        sourceMode.headline,
        '',
        status,
        '',
        `  branch   : ${r.branch}`,
        `  banked   : head ${String(state.banked.head_sha).slice(0, 7)} at ${state.banked.at}`,
        `  ticket   : ${r.ticket || '(none named)'}`,
        '',
        '>>> THE EXACT NEXT ACTION <<<',
        nextAction.text,
        '',
        `  durable state : ${statePath}`,
      ].join('\n'),
    });
    const deltaAssembled = assembleBrief(deltaSections, { cap });
    if (nextAction.truncated) deltaAssembled.fieldTruncations = ['resumption.next_action'];
    return deltaAssembled;
  }

  const sections = [];
  if (locationSection) sections.push(locationSection);
  sections.push(
    {
      name: 'core',
      required: true,
      body: [
        fence(`RESUMING ${p.id} — ${p.title}`),
        '',
        sourceMode.headline,
        `The BUILD-018 Session Governor injected this brief automatically; nobody needs to`,
        `re-brief you. It is a POINTER document — the full state is on disk.`,
        '',
        status,
        '',
        `  phase    : ${state.phase.current}`,
        `  worktree : ${worktree}`,
        `  branch   : ${r.branch}`,
        `  ticket   : ${r.ticket || '(none named)'}`,
        `  model    : ${m.model}${m.effort ? ` (effort: ${m.effort})` : ''}`,
        `  banked   : ${state.banked.at} by ${state.banked.by_model}, head ${String(state.banked.head_sha).slice(0, 7)}`,
        `  pushed   : ${
          facts?.upstreamSha
            ? `${facts.upstreamRef || state.repository?.upstream || '(upstream)'} @ ${facts.upstreamSha.slice(0, 7)}${
                typeof facts.unpushed === 'number' && facts.unpushed > 0
                  ? ` — ${facts.unpushed} local commit(s) NOT pushed`
                  : ' — local HEAD is pushed'
              }`
            : `${state.repository?.upstream || '(unknown upstream)'} @ (current pushed head could not be read — do not assume it is pushed)`
        }`,
        `  progress : ${done.length} ticket(s) resolved, ${frontier.length} on the frontier`,
        '',
        '>>> THE EXACT NEXT ACTION <<<',
        nextAction.text,
        '',
        `Where the truth lives (read these, do not re-derive them):`,
        `  durable state : ${statePath}`,
        `  map (SSOT)    : Deliverables/${p.home.split('/').pop()}/02-MAP.md   [live execution SSOT]`,
        `  goal contract : Deliverables/${p.home.split('/').pop()}/01-GOAL-CONTRACT.md   [product SSOT — wins over any ticket]`,
        `  handoff       : Team Knowledge/fusion-brief/session-handoff.md   [generated projection]`,
        `  (all four are on branch ${r.branch}, in ${worktree})`,
        '',
        'ARTEFACT RANK (AD-17): goal contract > map > implementation plan > generated',
        'projections (programme-state.json, session-handoff.md). A projection that',
        'disagrees with its source is a defect in the projection.',
        '',
        'GIT LIFECYCLE IS LARRY\'S (AD-20): Warwick never manages branches, worktrees,',
        'commits, pushes or PR creation. Do not ask him to run git. Do not ask him to',
        'choose the route. Ask him only for decisions that are genuinely his.',
      ].join('\n'),
    }
  );

  if (freshness.warnings.length) {
    sections.push({
      name: 'freshness-warnings',
      required: true,
      body: [fence('STATE HEALTH'), '', ...freshness.warnings.map((w) => `  ! ${w}`)].join('\n'),
    });
  }

  sections.push({
    name: 'frontier',
    required: false,
    body: [
      fence('FRONTIER — takable right now'),
      '',
      ...(frontier.length
        ? frontier.map((t) => `  ${t.id} [${t.model}] — ${t.title}`)
        : ['  (none — every remaining ticket is blocked)']),
    ].join('\n'),
  });

  sections.push({
    name: 'do-not',
    required: false,
    body: [fence('DO NOT'), '', ...(r.do_not || []).map((d) => `  ✗ ${d}`)].join('\n'),
  });

  sections.push({
    name: 'read-first',
    required: false,
    body: [fence('READ FIRST'), '', ...(r.read_first || []).map((d) => `  → ${d}`)].join('\n'),
  });

  sections.push({
    name: 'focus',
    required: false,
    body: [fence('WHERE WE GOT TO'), '', focus.text].join('\n'),
  });

  const openBlockers = (state.blockers || []).filter((b) => (b.blocks || []).length > 0);
  sections.push({
    name: 'blockers',
    required: false,
    body: [
      fence('OPEN BLOCKERS'),
      '',
      ...(openBlockers.length
        ? openBlockers.map((b) => `  ${b.id} (${b.kind}, owner ${b.owner}) blocks ${b.blocks.join(', ')} — ${b.summary}`)
        : ['  (none)']),
    ].join('\n'),
  });

  if ((state.unknown || []).length) {
    sections.push({
      name: 'not-established',
      required: false,
      body: [
        fence('NOT ESTABLISHED AT BANKING — do not read as "none"'),
        '',
        ...state.unknown.map((u) => `  ? ${u.path} — ${u.why}`),
      ].join('\n'),
    });
  }

  const assembled = assembleBrief(sections, { cap });
  if (nextAction.truncated || focus.truncated) {
    assembled.fieldTruncations = [
      ...(nextAction.truncated ? ['resumption.next_action'] : []),
      ...(focus.truncated ? ['resumption.focus'] : []),
    ];
  }
  return assembled;
}

// ---------------------------------------------------------------------------
// The reorientation itself
// ---------------------------------------------------------------------------

export function reorient({
  source,
  cwd,
  execFile = execFileSync,
  readdir = readdirSync,
  cap = CONTEXT_CAP,
  factsFn = gitFacts,
} = {}) {
  // D-B §B-2 — EVERY source reorients. The source selects the brief's shape,
  // it no longer decides whether there is a brief at all. See SOURCE_POLICY.
  const sourceMode = briefModeFor(source);

  const worktrees = listWorktrees(cwd, execFile);
  if (worktrees === null) {
    const b = renderProblemBrief(VERDICT.FAILED, {
      detail: `\`git worktree list\` failed in ${cwd}, so the estate could not be searched for banked state.`,
      cap,
    });
    return { verdict: VERDICT.FAILED, context: b.text, brief: b };
  }

  const files = discoverStateFiles(worktrees, { readdir });
  if (files.length === 0) {
    // NOT CHANGED BY WO-2026-08-01-01, deliberately. Silas's D-B §B-3 re-purposes
    // SKIPPED to this case and would have this return nothing at all — but that
    // is justified there by D-C, "the hook now runs machine-wide", and D-C has
    // NOT landed: this hook is still installed in ONE project scope, so a
    // session that finds no banked state here is a real fault and not the noise
    // B-3 is protecting Warwick from. Silencing it now would also reverse the
    // deliberate control in reorient.test.mjs ("a LOUD missing brief, not
    // silence") with no acceptance criterion asking for it. Land B-3 in the WP
    // that lands D-C, and amend that control in the same change.
    const b = renderProblemBrief(VERDICT.MISSING, {
      detail: `Searched ${worktrees.length} worktree(s) for Deliverables/*/programme-state.json and found none.`,
      cap,
    });
    return { verdict: VERDICT.MISSING, context: b.text, brief: b, searched: worktrees.length };
  }

  // Read and validate every candidate. A file that fails validation is reported,
  // never skipped — a corrupt state that reads as "no programme" is the silent
  // failure mode this build exists to kill.
  const good = [];
  const bad = [];
  for (const f of files) {
    const read = readProgrammeState(f.path);
    if (!read.ok) {
      bad.push({
        path: f.path,
        worktree: f.worktree,
        problem: `${read.reason}${read.errors ? `: ${read.errors.slice(0, 2).join('; ')}` : ''}${read.error ? `: ${read.error}` : ''}`,
      });
    } else {
      good.push({ ...f, state: read.data });
    }
  }

  const active = good.filter((g) => g.state.programme.status === 'active');

  if (active.length === 0) {
    const verdict = bad.length ? VERDICT.CORRUPT : VERDICT.MISSING;
    const b = renderProblemBrief(verdict, {
      detail: bad.length
        ? `${bad.length} programme-state file(s) were found but NONE validated, and no active programme could be read.`
        : `${good.length} programme-state file(s) validated, but none has status "active".`,
      candidates: [
        ...bad.map((x) => ({ path: x.path, worktree: x.worktree, problem: x.problem })),
        ...good.map((g) => ({
          id: g.state.programme.id,
          title: g.state.programme.title,
          path: g.path,
          worktree: g.worktree,
          problem: `status is "${g.state.programme.status}", not "active"`,
        })),
      ],
      cap,
    });
    return { verdict, context: b.text, brief: b, corrupt: bad };
  }

  if (active.length > 1) {
    const b = renderProblemBrief(VERDICT.AMBIGUOUS, {
      detail: `${active.length} programmes report status "active". The governor will not guess which one this session resumes.`,
      candidates: active.map((g) => ({
        id: g.state.programme.id,
        title: g.state.programme.title,
        path: g.path,
        worktree: g.worktree,
        next: g.state.resumption.ticket || g.state.resumption.next_action.slice(0, 120),
      })),
      cap,
    });
    return { verdict: VERDICT.AMBIGUOUS, context: b.text, brief: b, candidates: active };
  }

  const chosen = active[0];
  const facts = { ...factsFn(chosen.worktree, execFile), worktreePath: chosen.worktree };
  const freshness = assessBankedFreshness(chosen.state, facts);

  // Requirement 4 — before ANY implementation, compare this session's actual cwd,
  // repository root, branch and HEAD against the banked programme state. This is
  // the same comparison the PreToolUse guard makes, from the same module, so the
  // brief can never say "aligned" while the gate is denying (or the reverse).
  const canonical = canonicalFromState(chosen.state, chosen.path);
  const live = liveLocation({ cwd, execFile });
  const location = canonical ? { ...compareLocation(canonical, live), live } : null;

  const b = renderOrientationBrief(chosen.state, {
    statePath: chosen.path,
    worktree: chosen.worktree,
    freshness,
    canonical,
    location,
    facts,
    cap,
    sourceMode,
  });

  // Corrupt siblings are surfaced even on the happy path — a state file that
  // cannot be read is a defect somebody must see, not noise to swallow.
  let context = b.text;
  if (bad.length) {
    const note =
      `\n\n⚠️ ${bad.length} other programme-state file(s) failed validation and were ignored: ` +
      bad.map((x) => `${x.path} (${x.problem})`).join('; ');
    if ((context + note).length <= cap) context += note;
  }

  // Precedence: a location mismatch outranks staleness. Stale state means
  // "re-read before trusting"; wrong worktree means "do not implement at all",
  // and the stronger of the two must be what the caller sees.
  const misplaced = location && location.verdict !== LOCATION.ALIGNED;
  const verdict = misplaced
    ? VERDICT.WRONG_WORKTREE
    : freshness.stale
      ? VERDICT.STALE
      : VERDICT.ORIENTED;

  return {
    verdict,
    context,
    brief: b,
    sourceMode,
    state: chosen.state,
    statePath: chosen.path,
    worktree: chosen.worktree,
    freshness,
    canonical,
    location,
    live,
    implementationPermitted: !misplaced,
    corrupt: bad,
  };
}

// ---------------------------------------------------------------------------
// Hook envelope
// ---------------------------------------------------------------------------

export function toHookOutput(result) {
  if (!result || !result.context) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: result.context,
    },
  };
}

export function runHook(raw, opts = {}) {
  const parsed = parseHookInput(raw);
  if (!parsed.ok) {
    // A hook that cannot read its own input must say so, not vanish. But it also
    // must not claim a verdict about state it never looked at.
    const b = renderProblemBrief(VERDICT.FAILED, {
      detail: `The reorientation hook could not read its input (${parsed.reason}). No state was inspected.`,
      cap: opts.cap ?? CONTEXT_CAP,
    });
    return { verdict: VERDICT.FAILED, context: b.text, brief: b };
  }
  const { source, cwd, session_id: sessionId } = parsed.payload;
  const { modelGate: modelGateOpts, ...reorientOpts } = opts;
  try {
    const result = reorient({ source, cwd: cwd || opts.cwd || process.cwd(), ...reorientOpts });
    // T-15 — a bounded, additive layer on top of an otherwise-untouched reorient()
    // result. A no-op unless reorient() already says implementation is permitted; see
    // model-gate.mjs's own header for why this composes here rather than merging in.
    return applyModelGate(result, { sessionId, ...modelGateOpts });
  } catch (err) {
    const b = renderProblemBrief(VERDICT.FAILED, {
      detail: `The reorientation hook threw: ${err.message}`,
      cap: opts.cap ?? CONTEXT_CAP,
    });
    return { verdict: VERDICT.FAILED, context: b.text, brief: b, error: err.message };
  }
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

  let result;
  try {
    result = runHook(raw);
  } catch (err) {
    // Belt and braces: runHook already catches, but a governor that crashes the
    // session start would be a worse defect than one that says nothing useful.
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `BUILD GOVERNOR: reorientation failed hard (${err.message}). Reorient by hand from the programme map.`,
        },
      })
    );
    process.exitCode = 0;
    return;
  }

  const out = toHookOutput(result);
  if (out) process.stdout.write(JSON.stringify(out));
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
