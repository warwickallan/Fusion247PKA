// Hook activation — the committed half of hook delivery (BUILD-018 T-11, X-2)
//
// X-2: `.claude/settings.local.json` is GLOBALLY GITIGNORED. A ticket that
// "adds a hook" by editing that file in a worktree ships literally nothing — the
// change cannot travel by git and dies with the worktree. So the deliverable is
// this installer: committed, idempotent, reviewable, and re-runnable on any
// machine to reproduce the wiring.
//
// Q-5: `.claude/settings.local.json` already invokes a SessionStart hook at
// `services/control-plane/tower-loop/ensure-watcher.mjs`, and that file exists
// NOWHERE — not in any worktree, not in any branch's history. It was never
// committed, so there is nothing to "repair"; it is a dangling reference, and
// repair would belong to Tower, which is PARKED. Warwick's ruling (2026-07-31)
// was to RECONCILE it rather than leave it, because a failing sibling hook next
// to the Governor's own hook is exactly the debugging trap 02-MAP.md §12 warns
// about: a fresh Larry asking "why didn't reorientation work" would find two
// hooks, one already broken.
//
// The reconciliation rule is deliberately GENERIC and SELF-LIMITING rather than
// a one-off deletion of a named file: prune SessionStart command hooks whose
// target script does not exist on disk. That rule cannot over-reach (a hook
// whose script exists is never touched), it fixes the class rather than the
// instance, and if Tower ever does ship ensure-watcher.mjs the hook would simply
// stop being prunable. Everything pruned is reported and written to a backup, so
// nothing is silently destroyed.
//
// INV-7 — recommend, do not act: `--check` is read-only and is the default posture
// for inspection. Writing requires an explicit run without `--check`.

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const HOOK_EVENT = 'SessionStart';
export const GUARD_EVENT = 'PreToolUse';
export const STOP_EVENT = 'Stop';
export const GOVERNOR_MARKER = 'tools/governor/reorient.mjs';
export const GUARD_MARKER = 'tools/governor/worktree-guard.mjs';
// RETIRED 2026-08-01 by Warwick's cut-and-close ruling on the accepted Larry/Pax
// diagnosis. These controls regulated Larry's own judgement rather than protecting
// an artefact, and Pax measured the result: ~1,440 lines of gate code for near-zero
// live enforcement, while the delegation gate additionally blocked read-only
// commands in normal use.
//
// This is a RETIREMENT list, not merely an absence from `managed[]`. Dropping a spec
// only stops the installer ADDING a hook — it leaves every already-installed copy
// running on Warwick's machine forever. Anything whose command matches one of these
// markers is actively REMOVED from a governor-managed event on every install, and
// that removal does not depend on the script being missing from disk: a control is
// retired when the installer takes it out, not when its file happens to be absent.
export const RETIRED_MARKERS = Object.freeze([
  'tools/governor/delegation-gate.mjs',
  'tools/governor/model-gate.mjs',
  'tools/governor/escalation-gate.mjs',
]);

export function isRetiredHook(hook) {
  if (!hook || typeof hook.command !== 'string') return false;
  const c = hook.command.replace(/\\/g, '/');
  return RETIRED_MARKERS.some((m) => c.includes(m));
}
export const STATUSLINE_MARKER = 'tools/governor/statusline-live.mjs';
export const STOP_MARKER = 'tools/governor/stop-controller.mjs';

// AC3 — hooks are SNAPSHOTTED at Claude Code process launch. Nolan established
// this by observation: a hook deleted from settings at 17:05:08Z was still
// firing at 21:39Z, and one `claude.exe` started before an install has served
// every session since. So a hook change written by this installer is INERT
// until Claude Code is fully restarted, and nothing used to say so — which made
// a successful install indistinguishable from a no-op to the person running it.
// `statusLine` is read live and is exempt; that asymmetry is stated, not hidden.
export const RESTART_NOTICE = [
  '  ⚠️  RESTART REQUIRED — THIS CHANGE IS NOT LIVE YET.',
  '',
  '      Claude Code reads `hooks` ONCE, at process launch, and holds that',
  '      snapshot for the life of the process. Every session served by an',
  '      already-running Claude Code will keep using the OLD hooks, however',
  '      many times you re-run this installer.',
  '',
  '      Quit Claude Code COMPLETELY (not just this session) and start it',
  '      again. Until you do, treat the hook changes above as not applied.',
  '',
  '      (`statusLine` is exempt — it is read live and takes effect at once.)',
].join('\n');

// The tools the PreToolUse guard adjudicates. Read-only tools are deliberately
// absent: a misplaced session must still be able to diagnose itself, and a guard
// that blocks Read would make its own deny message unactionable.
export const GUARD_MATCHER = 'Write|Edit|MultiEdit|NotebookEdit|Bash';

export function settingsPath(checkout) {
  return join(checkout, '.claude', 'settings.local.json');
}

// ---------------------------------------------------------------------------
// The hook commands
// ---------------------------------------------------------------------------
// Absolute path, forward slashes: the hook runs with the session's cwd, which is
// not necessarily the checkout the script lives in.

export function governorHookCommand(scriptPath) {
  return `node ${String(scriptPath).replace(/\\/g, '/')}`;
}

// The guard is given the estate root explicitly. It must be able to find the
// active programme even when the session is in a repository that knows nothing
// about the build — which is precisely the case the guard exists for.
export function guardHookCommand(scriptPath, estate) {
  const base = `node ${String(scriptPath).replace(/\\/g, '/')}`;
  return estate ? `${base} --estate ${String(estate).replace(/\\/g, '/')}` : base;
}

// WP-5 / D-C C-6 — the execution controller (D-A), wired as a `Stop` hook.
//
// The `--estate` argument is emitted VERBATIM from D-C C-6's composed table,
// which is the binding decision. State plainly what it does today, because an
// inert flag that LOOKS meaningful is its own defect: `stop-controller.mjs`
// parses NO argv at all — it has no argument parser, and `process.argv` is
// touched there only by its entrypoint guard. It resolves the active programme
// from the Stop payload's own `cwd`, because A-7 forbids any `git` invocation on
// the Stop path and the payload carries no branch. So this flag is currently
// IGNORED by the script it is passed to, and is emitted for fidelity to the
// governing decision and for forward compatibility, not because it is read.
export function stopHookCommand(scriptPath, estate) {
  const base = `node ${String(scriptPath).replace(/\\/g, '/')}`;
  return estate ? `${base} --estate ${String(estate).replace(/\\/g, '/')}` : base;
}

export function isGovernorHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(GOVERNOR_MARKER);
}

export function isStopControllerHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(STOP_MARKER);
}

export function isGuardHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(GUARD_MARKER);
}

// Derive the sibling scripts from the reorientation script: all are siblings by
// construction, so a caller that names one has named all of them. This keeps every
// existing single-script call site working while shipping more hooks from the one
// script argument.
export function guardScriptFor(scriptPath) {
  const p = String(scriptPath).replace(/\\/g, '/');
  return p.endsWith('reorient.mjs') ? p.replace(/reorient\.mjs$/, 'worktree-guard.mjs') : null;
}

export function stopControllerScriptFor(scriptPath) {
  const p = String(scriptPath).replace(/\\/g, '/');
  return p.endsWith('reorient.mjs') ? p.replace(/reorient\.mjs$/, 'stop-controller.mjs') : null;
}

// AC4 — `statusLine` is the ONE governor surface that currently works, and it
// was reproducible from nothing but Warwick's untracked machine config: this
// installer contained zero occurrences of `statusLine`, so a merge or a second
// machine would have silently lost it. It is derived from the same sibling rule
// as the guard and the stop controller, so a caller that names one names all.
//
// Note it is NOT a hook. `statusLine` is read LIVE by Claude Code, whereas hooks
// are snapshotted at process launch — which is exactly why installing it takes
// effect immediately while installing a hook does not (see RESTART_NOTICE).
export function statuslineScriptFor(scriptPath) {
  const p = String(scriptPath).replace(/\\/g, '/');
  return p.endsWith('reorient.mjs') ? p.replace(/reorient\.mjs$/, 'statusline-live.mjs') : null;
}

export function statusLineCommand(scriptPath) {
  return `node ${String(scriptPath).replace(/\\/g, '/')}`;
}

export function isGovernorStatusLine(statusLine) {
  return typeof statusLine?.command === 'string' && statusLine.command.includes(STATUSLINE_MARKER);
}

// ---------------------------------------------------------------------------
// Q-5 — dangling-target detection
// ---------------------------------------------------------------------------
// Extracts filesystem paths a `node ...` hook command would execute and reports
// which do not exist. Only `.mjs`/`.js`/`.cjs` arguments are considered targets;
// `--env-file=` arguments are NOT treated as targets (a missing env file is a
// different defect and not this ticket's business to judge).

export function hookTargets(command) {
  if (typeof command !== 'string') return [];
  return command
    .split(/\s+/)
    .filter((tok) => /\.(mjs|cjs|js)$/i.test(tok) && !tok.startsWith('--'))
    .map((tok) => tok.replace(/^["']|["']$/g, ''));
}

export function danglingTargets(command, { exists = existsSync, cwd } = {}) {
  return hookTargets(command).filter((t) => {
    const p = isAbsolute(t) || /^[A-Za-z]:[\\/]/.test(t) ? t : resolve(cwd || '.', t);
    return !exists(p);
  });
}

// ---------------------------------------------------------------------------
// The pure transform — settings in, settings out, plus a report
// ---------------------------------------------------------------------------

export function planSettings(
  settings,
  {
    scriptPath,
    guardPath,
    statuslinePath,
    stopPath,
    estate,
    exists = existsSync,
    cwd,
    prune = true,
  } = {}
) {
  const next = JSON.parse(JSON.stringify(settings ?? {}));
  const report = {
    installed: false,
    replaced: false,
    pruned: [],
    // Hooks removed because their control was RETIRED (see RETIRED_MARKERS). Kept
    // separate from `pruned` on purpose: pruning removes a hook whose target went
    // missing (an accident to be tidied), retirement removes one deliberately
    // withdrawn. Collapsing them would hide a policy decision inside housekeeping.
    retired: [],
    kept: 0,
    examined: 0,
    events: {},
    // AC5 — `pruned: []` alone cannot distinguish "examined every target and
    // found none missing" from "never looked". `pruneChecked` records which of
    // those actually happened, so the report can never claim ground it did not
    // examine. See renderReport.
    pruneChecked: prune,
    // WP-5 — `pruneChecked` is now necessary but no longer SUFFICIENT, because
    // pruning is scoped per-event (see `prunable` below). These two count the
    // hooks whose targets were ACTUALLY tested and those examined on an exempt
    // event and therefore never tested, so the report can still state the exact
    // ground it covered rather than borrowing `examined` as a proxy for it.
    pruneTested: 0,
    pruneSkipped: 0,
    pruneExemptEvents: [],
    // WP-6 — a pre-existing governor hook can differ from its managed spec on
    // more than its command, and only the command was ever compared. The MATCHER
    // is the other axis, and nothing looked at it: a stale `matcher: "clear"`
    // survived every successful install while the report said "already present,
    // unchanged". This records that the matcher WAS compared, so the report can
    // never again be silent about a difference it never examined.
    matcherNormalised: false,
    statusLine: null,
  };

  if (!next.hooks || typeof next.hooks !== 'object') next.hooks = {};

  const command = governorHookCommand(scriptPath);
  const resolvedGuard = guardPath ?? guardScriptFor(scriptPath);
  const guardCommand = resolvedGuard ? guardHookCommand(resolvedGuard, estate) : null;
  // The delegation observer/gate commands used to be built here. Retired 2026-08-01 —
  // see RETIRED_MARKERS. The `delegationPath` parameter and the `--delegation` CLI flag
  // went with them: an accepted-and-ignored parameter is an invitation to a caller that
  // would then be silently doing nothing, and no caller in this repository passed one.
  const resolvedStop = stopPath ?? stopControllerScriptFor(scriptPath);
  const stopCommand = resolvedStop ? stopHookCommand(resolvedStop, estate) : null;

  // Requirement 9 — both halves of the durable behaviour are installed together.
  // Shipping the brief without the gate would leave a session that is TOLD it is
  // misplaced and still perfectly able to write anyway.
  // SPEC AMENDMENT (WO-2026-08-01-01 AC2, Silas D-B §B-1): the SessionStart
  // entry carries NO matcher key at all — not `''`, not `'*'`. A matcher-less
  // entry is proven to fire on `startup`, whereas any matcher that ENUMERATES
  // sources means an unknown FUTURE source silently matches nothing, which is
  // the same class of defect as the one being repaired. `matcher: 'clear'` here
  // previously made reorientation unreachable on `startup` and `resume`.
  // Filtering now lives in reorient.mjs's SOURCE_POLICY, where an unrecognised
  // source falls through to a defined default instead of to silence.
  // `prunable` scopes the Q-5 dangling-target rule to the events it was actually
  // justified for. It defaults to TRUE and is set FALSE only where adding a spec
  // would otherwise drag a brand-new event into the pruner's reach. See the
  // `Stop` spec below for the case that forced it.
  const managed = [
    { event: HOOK_EVENT, matcher: undefined, command, is: isGovernorHook, key: 'governor', prunable: true },
  ];
  if (guardCommand) {
    managed.push({
      event: GUARD_EVENT,
      matcher: GUARD_MATCHER,
      command: guardCommand,
      is: isGuardHook,
      key: 'guard',
      prunable: true,
    });
  }
  // The delegation observer and gate specs used to sit here, both on GUARD_EVENT.
  // Retired 2026-08-01 — see RETIRED_MARKERS, which also REMOVES any copy already
  // installed on this machine rather than merely declining to add a new one.
  //
  // WP-5 / D-C C-6 — the execution controller. ADDITIVE, and `prunable: false`.
  //
  // WHY IT IS EXEMPT FROM PRUNING, because this is the whole point and a later
  // reader will otherwise "simplify" it away:
  //
  // The Q-5 prune rule was justified for exactly one thing — a dangling
  // `ensure-watcher.mjs` SessionStart hook (see this file's header). It is
  // applied per-event, over the events the Governor manages. Before this spec
  // existed the Governor managed no `Stop` hook, so `Stop` was never in the
  // pruner's reach — two tests assert precisely that, one of them using a fixture
  // whose `Stop` command is a Tower-shaped `bridge-ingest.mjs` at a path that
  // does not exist.
  //
  // Adding this spec without the exemption would therefore have made the
  // installer DELETE a dangling Tower `Stop` hook the first time it ran — the one
  // hook D-C C-6 says in terms "must not be moved, must not be reordered, and
  // must not be removed", and which AC1 requires to survive untouched. The
  // installer would have destroyed the thing it was being changed to sit beside.
  //
  // Today Tower's target exists, so nothing changes; the exemption removes a
  // FUTURE silent deletion, which is exactly when nobody would be watching.
  // Pruning stays available on the events Q-5 argued for, and gains no new
  // destructive edge that no decision asked for.
  if (stopCommand) {
    managed.push({
      event: STOP_EVENT,
      matcher: undefined,
      command: stopCommand,
      is: isStopControllerHook,
      key: 'stopController',
      prunable: false,
    });
  }

  // Group specs by event and scan each event's PRE-EXISTING groups exactly
  // ONCE, checking every hook against every spec for that event in the same
  // pass. It was written when three specs shared `PreToolUse` (guard plus the two
  // delegation specs retired 2026-08-01), because scanning per-spec instead — the
  // way this loop worked when there was only ever one spec per event — would have
  // each LATER spec re-examine the group an EARLIER spec just pushed this run,
  // inflating `examined`/`kept` for hooks already accounted for. Today every event
  // hosts exactly one spec again and the single pass is provably equivalent to the
  // old behaviour; it is KEPT rather than unwound because the inflation bug returns
  // the moment a second spec is added to any event, and the suite still pins the
  // examined-exactly-once property.
  const specsByEvent = new Map();
  for (const spec of managed) {
    if (!Array.isArray(next.hooks[spec.event])) next.hooks[spec.event] = [];
    if (!specsByEvent.has(spec.event)) specsByEvent.set(spec.event, []);
    specsByEvent.get(spec.event).push(spec);
  }

  for (const [event, specs] of specsByEvent) {
    const states = new Map(
      specs.map((spec) => [
        spec,
        { installed: false, replaced: false, added: false, matcherNormalised: false, matcherExtracted: false },
      ])
    );
    const originalGroups = next.hooks[event].slice();
    // An event is prunable only if EVERY spec on it says so. Unanimity rather
    // than majority: one spec asserting "do not delete other people's hooks on
    // this event" must not be outvoted into deleting them.
    const eventPrunable = prune && specs.every((spec) => spec.prunable !== false);
    if (prune && !eventPrunable) report.pruneExemptEvents.push(event);

    for (const group of originalGroups) {
      if (!Array.isArray(group?.hooks)) continue;
      const surviving = [];
      for (const hook of group.hooks) {
        report.examined += 1;

        // Retirement is tested FIRST, before the managed and prune paths. A retired
        // control must not be rescued by the "governor-managed hooks are never
        // pruned" exemption below, and must not need a missing target to be removed.
        if (isRetiredHook(hook)) {
          report.retired.push({ event, command: hook.command });
          continue; // dropped
        }

        const matchedSpec = specs.find((spec) => spec.is(hook));
        if (matchedSpec) {
          // Idempotent: exactly one of each, always re-pointed at the current script.
          const state = states.get(matchedSpec);
          if (hook.command !== matchedSpec.command) {
            state.replaced = true;
            report.replaced = true;
            hook.command = matchedSpec.command;
          }
          state.installed = true;
          surviving.push(hook);
          continue;
        }

        // A governor-managed hook (for THIS event or any other) is never
        // pruned by the sibling rule, even when its script is not yet on
        // disk (fresh clone, install-before-build).
        if (managed.some((m) => m.is(hook))) {
          report.kept += 1;
          surviving.push(hook);
          continue;
        }

        if (!eventPrunable) {
          // Examined (it was compared against every spec above) but its target
          // was never tested. Counted separately so the report cannot later
          // claim to have checked ground it deliberately left alone.
          report.pruneSkipped += 1;
          report.kept += 1;
          surviving.push(hook);
          continue;
        }

        report.pruneTested += 1;
        const dangling = danglingTargets(hook?.command, { exists, cwd });
        if (dangling.length) {
          report.pruned.push({ event, command: hook.command, missing: dangling });
          continue; // dropped
        }

        report.kept += 1;
        surviving.push(hook);
      }
      group.hooks = surviving;
    }

    // -----------------------------------------------------------------------
    // WP-6 — MATCHER reconciliation
    // -----------------------------------------------------------------------
    // The scan above reconciles a pre-existing governor hook on ONE axis: its
    // command. Nothing compared the matcher, so an entry written under an older
    // spec kept that spec's matcher forever while the report printed "already
    // present, unchanged". That is exactly how a live `matcher: "clear"` survived
    // WP-1: reorientation stayed unreachable on `startup` and `resume` even after
    // a restart, and a successful install said nothing about it. A control
    // reporting success over ground it never examined.
    //
    // The matcher belongs to the enclosing GROUP, never to the hook, so this
    // cannot be done hook-by-hook — writing `matcher` onto a hook object would
    // put a key where Claude Code never reads it and report a normalisation that
    // changed nothing, which is this defect re-created by its own repair. Two
    // cases, and the split IS the safety argument:
    //
    //   EXCLUSIVE — every surviving hook in the group is ours AND they all match
    //     the SAME single spec. No other hook depends on this group's matcher, so
    //     it is normalised IN PLACE, preserving the group's position and order.
    //     This is the live case: the real SessionStart group holds the
    //     reorientation hook alone.
    //
    //   SHARED — anything else. Rewriting the matcher here would rewrite it for a
    //     sibling that never asked for it, including a foreign one; the suite
    //     already asserts of Tower's `Stop` group "nor have its own matcher
    //     rewritten". So the governor hook is EXTRACTED and re-added below in its
    //     own correctly-matched group, and the group it shared is left exactly as
    //     found. This is also what makes three specs with three different matchers
    //     on one `PreToolUse` event representable at all.
    //
    // Nothing here deletes a group. A group emptied by extraction is left behind
    // exactly as the pruner already leaves one: adding a group-deletion edge is a
    // destructive behaviour no decision asked for, which is the mistake WP-5's
    // `Stop` exemption exists to prevent.
    const hasMatcherKey = (g) => Object.prototype.hasOwnProperty.call(g, 'matcher');
    // Exact comparison: key-absent, `''` and `'*'` are three DIFFERENT states and
    // none of them equals "no matcher". A spec carrying no matcher is satisfied
    // only by the key being absent.
    const matcherAgrees = (g, spec) =>
      spec.matcher === undefined ? !hasMatcherKey(g) : hasMatcherKey(g) && g.matcher === spec.matcher;
    const noteNormalised = (spec, group, extracted) => {
      const state = states.get(spec);
      state.matcherNormalised = true;
      if (extracted) state.matcherExtracted = true;
      state.matcherWasPresent = hasMatcherKey(group);
      state.matcherWas = hasMatcherKey(group) ? group.matcher : undefined;
      state.matcherNow = spec.matcher;
      report.matcherNormalised = true;
    };

    const correctlyHosted = new Set();
    for (const group of next.hooks[event]) {
      if (!Array.isArray(group?.hooks)) continue;
      const ours = group.hooks.map((hook) => specs.find((spec) => spec.is(hook)));
      if (!ours.some(Boolean)) continue;

      const distinct = [...new Set(ours.filter(Boolean))];
      if (distinct.length === 1 && ours.every(Boolean)) {
        const spec = distinct[0];
        if (!matcherAgrees(group, spec)) {
          noteNormalised(spec, group, false); // reads the OLD matcher — call before mutating
          if (spec.matcher === undefined) delete group.matcher;
          else group.matcher = spec.matcher;
        }
        correctlyHosted.add(spec);
        continue;
      }

      const keep = [];
      group.hooks.forEach((hook, i) => {
        const spec = ours[i];
        if (!spec || matcherAgrees(group, spec)) {
          if (spec) correctlyHosted.add(spec);
          keep.push(hook);
          return;
        }
        noteNormalised(spec, group, true); // dropped here; re-added correctly matched below
      });
      group.hooks = keep;
    }

    for (const spec of specs) {
      const state = states.get(spec);
      // Extracted from every group that held it, so it is no longer installed
      // anywhere and the re-add path below must put it back.
      if (state.installed && state.matcherExtracted && !correctlyHosted.has(spec)) state.installed = false;
    }

    for (const spec of specs) {
      const state = states.get(spec);
      if (!state.installed) {
        // Own group. PreToolUse specs carry a matcher naming the tools they
        // govern; the SessionStart spec deliberately carries NONE, so the key is
        // OMITTED rather than written as undefined/'' — `JSON.stringify` would
        // drop an undefined value anyway, but an explicit omission is what a
        // reviewer reading the settings file needs to see. The in-script guards
        // are the testable ones; a matcher only keeps a hook off things it must
        // never see.
        next.hooks[event].push({
          ...(spec.matcher === undefined ? {} : { matcher: spec.matcher }),
          hooks: [{ type: 'command', command: spec.command }],
        });
        state.installed = true;
        state.added = true;
        report.added = true;
      }
      report.events[spec.key] = { ...state, event: spec.event, command: spec.command };
      report.installed = true;
    }
  }

  // AC4 — statusLine, managed idempotently alongside the hooks. It lives at the
  // TOP LEVEL of settings, not under `hooks`, so it cannot go through the loop
  // above. Absent script → nothing is written and the report says so; this
  // installer never invents a command it could not derive.
  const resolvedStatusline = statuslinePath ?? statuslineScriptFor(scriptPath);
  const statusLineCmd = resolvedStatusline ? statusLineCommand(resolvedStatusline) : null;
  if (!statusLineCmd) {
    report.statusLine = { state: 'not-installed', command: null };
  } else {
    const current = next.statusLine;
    if (!current || typeof current !== 'object') {
      next.statusLine = { type: 'command', command: statusLineCmd };
      report.statusLine = { state: 'added', command: statusLineCmd };
      report.added = true;
    } else if (current.command !== statusLineCmd) {
      // Re-point ONLY a governor status line. A third-party statusLine is
      // somebody else's configuration and is left exactly as found — reported,
      // never overwritten.
      if (isGovernorStatusLine(current)) {
        next.statusLine = { ...current, type: current.type ?? 'command', command: statusLineCmd };
        report.statusLine = { state: 're-pointed', command: statusLineCmd, was: current.command };
        report.replaced = true;
      } else {
        report.statusLine = { state: 'foreign-left-alone', command: statusLineCmd, was: current.command };
      }
    } else {
      report.statusLine = { state: 'unchanged', command: statusLineCmd };
    }
  }

  return {
    settings: next,
    report,
    command,
    guardCommand,
    stopCommand,
    statusLineCommand: statusLineCmd,
  };
}

// ---------------------------------------------------------------------------
// The impure step
// ---------------------------------------------------------------------------

export function installHooks({
  checkout,
  scriptPath,
  guardPath,
  statuslinePath,
  stopPath,
  estate,
  check = false,
  prune = true,
  read = readFileSync,
  write = writeFileSync,
  exists = existsSync,
  copy = copyFileSync,
} = {}) {
  const path = settingsPath(checkout);

  if (!exists(path)) {
    return { ok: false, reason: 'missing-settings', path, detail: `${path} does not exist.` };
  }

  let raw;
  let settings;
  try {
    raw = read(path, 'utf8');
    settings = JSON.parse(raw);
  } catch (err) {
    // Fails CLOSED: never overwrite a settings file we could not parse. The
    // file is Warwick's live machine configuration and is not in git — a bad
    // write here is unrecoverable.
    return { ok: false, reason: 'unparseable-settings', path, detail: err.message };
  }

  const {
    settings: next,
    report,
    command,
    guardCommand,
    stopCommand,
    statusLineCommand: statusLineCmd,
  } = planSettings(settings, {
    scriptPath,
    guardPath,
    statuslinePath,
    stopPath,
    estate: estate ?? checkout,
    exists,
    cwd: checkout,
    prune,
  });

  const serialised = JSON.stringify(next, null, 2) + '\n';
  const changed = serialised !== raw;

  const base = {
    path,
    report,
    command,
    guardCommand,
    stopCommand,
    statusLineCommand: statusLineCmd,
  };

  if (check) {
    return { ok: true, checked: true, changed, ...base };
  }

  if (!changed) {
    return { ok: true, changed: false, ...base, backup: null };
  }

  const backup = `${path}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  copy(path, backup);
  write(path, serialised);

  return { ok: true, changed: true, ...base, backup };
}

export function renderReport(result) {
  if (!result.ok) {
    return `\nHOOK INSTALL FAILED (${result.reason})\n  ${result.detail}\n  ${result.path}\n`;
  }
  const lines = [
    '',
    '='.repeat(72),
    result.checked ? 'GOVERNOR HOOKS — CHECK (nothing was written)' : 'GOVERNOR HOOKS — INSTALL',
    '='.repeat(72),
    '',
    `  settings : ${result.path}`,
    `  examined : ${result.report.examined} existing hook(s) in governor-managed events`,
    `  kept     : ${result.report.kept}`,
  ];

  // AC5 — in CHECK mode a bare "ADDED" reads as "your settings are behind, sync
  // them", when what it actually means is "re-running would ACTIVATE something
  // that is deliberately not live". Nolan hit exactly that: `--check` reported
  // two delegation hooks as ADDED, and re-running would have silently switched
  // on a gate that was built but intentionally never wired. The check-mode
  // wording therefore describes a PROPOSAL, never a deficit.
  const checking = !!result.checked;
  const describe = (e) => {
    if (!e) return 'NOT INSTALLED';
    // WP-6 — a matcher normalisation is neither an ADD nor a RE-POINT and must
    // never be reported as either. It is checked FIRST because an EXTRACTED hook
    // travels through the add path (it is re-added in a correctly-matched group),
    // and describing a move as "newly activated" would be a fresh instance of the
    // exact defect this criterion exists to end.
    if (e.matcherNormalised) {
      const moved = e.matcherExtracted ? ' (moved to its own group)' : '';
      const also = e.replaced ? ', and RE-POINTED' : '';
      return checking
        ? `LIVE but differs from the managed spec — its MATCHER would be NORMALISED${moved}${also}`
        : `MATCHER NORMALISED${moved}${also}`;
    }
    if (e.added) return checking ? 'NOT LIVE — would be ADDED (newly activated)' : 'ADDED';
    if (e.replaced) return checking ? 'LIVE but points elsewhere — would be RE-POINTED' : 'RE-POINTED';
    return 'already present, unchanged';
  };
  const ev = result.report.events || {};
  // AC2 — a normalisation gets its own visible line naming the OLD and the NEW
  // value. "Something changed" without saying WHAT changed is how the previous
  // report managed to be technically true and practically useless.
  const matcherText = (present, value) => (present ? JSON.stringify(value) : 'no matcher (key absent)');
  const row = (label, e, cmd, fallback) => {
    const out = [`  ${label}: ${describe(e)}`, `    ${cmd || fallback}`];
    if (e && e.matcherNormalised) {
      out.push(
        `      matcher: ${matcherText(e.matcherWasPresent, e.matcherWas)} → ` +
          matcherText(e.matcherNow !== undefined, e.matcherNow) +
          (e.matcherExtracted ? ' — extracted into its own group; the group it shared was left untouched' : '')
      );
    }
    return out;
  };
  lines.push(
    '',
    ...row(`${HOOK_EVENT} (reorientation, every source — no matcher)`, ev.governor, result.command, ''),
    ...row(
      `${GUARD_EVENT} (wrong-worktree deny gate)`,
      ev.guard,
      result.guardCommand,
      '(no guard script could be derived — NOT installed)'
    ),
    ...row(
      `${STOP_EVENT} (execution controller)`,
      ev.stopController,
      result.stopCommand,
      '(no stop-controller script could be derived — NOT installed)'
    )
  );
  // AC4 — say what happened to statusLine. It is the surface Warwick can
  // actually see, so "nothing was said about it" is indistinguishable from
  // "it is not managed", which is the state this criterion exists to end.
  const sl = result.report.statusLine;
  const slText = !sl
    ? 'not evaluated'
    : sl.state === 'added'
      ? checking ? 'NOT LIVE — would be ADDED' : 'ADDED'
      : sl.state === 're-pointed'
        ? checking ? `LIVE but points elsewhere — would be RE-POINTED (was: ${sl.was})` : `RE-POINTED (was: ${sl.was})`
        : sl.state === 'foreign-left-alone'
          ? `LEFT ALONE — a non-governor statusLine is already configured (${sl.was}). Not overwritten.`
          : sl.state === 'not-installed'
            ? 'NOT INSTALLED — no statusline script could be derived from the script path'
            : 'already present, unchanged';
  lines.push('', `  statusLine (live governor line): ${slText}`, `    ${result.statusLineCommand || '(none)'}`);

  // AC5 — the pruner's report must describe the ground it ACTUALLY examined.
  // The previous wording printed "none (every existing hook target exists)"
  // whenever the pruned list was empty — including under `--no-prune`, where
  // `danglingTargets` is short-circuited and NO target is ever checked. That is
  // a control reporting on ground it never looked at, which is worse than no
  // control: an absent check invites caution, a lying one invites confidence.
  // Retirement is DESTRUCTIVE and must never be silent. The pruner already has this
  // property ("the report names what was pruned, so nothing disappears silently");
  // retirement removes hooks the pruner would specifically REFUSE to touch — their
  // targets may exist, and they were governor-managed — so without this block a run
  // could delete two live hooks from Warwick's settings and report only "examined: 2,
  // kept: 0". It gets its OWN block rather than joining `pruned`, for the same reason
  // the report fields are separate: pruning tidies an accident, retirement withdraws a
  // control, and a policy decision must not hide inside housekeeping.
  const retired = result.report.retired || [];
  if (retired.length) {
    lines.push(
      '',
      `  RETIRED ${retired.length} hook(s) — these controls were WITHDRAWN, and any already-installed`,
      '  copy is removed on every install (it would otherwise keep running forever):'
    );
    for (const r of retired) lines.push(`    - [${r.event}] ${r.command}`);
    lines.push(
      '',
      checking
        ? '  Nothing was written. Re-running WITHOUT --check would REMOVE the hook(s) above.'
        : '  These are recoverable from the backup below.'
    );
  }

  if (result.report.pruned.length) {
    lines.push('', `  PRUNED ${result.report.pruned.length} hook(s) whose target script does not exist (Q-5):`);
    for (const p of result.report.pruned) {
      lines.push(`    - ${p.command}`);
      lines.push(`      missing: ${p.missing.join(', ')}`);
    }
    lines.push('', '  These are recoverable from the backup below and from this ticket\'s evidence file.');
  } else if (result.report.pruneChecked) {
    // WP-5 — `examined` and "target-checked" are no longer the same set, because
    // pruning is now scoped per-event. Saying "all N examined" when N includes
    // hooks on an EXEMPT event would be the same class of lie the --no-prune
    // branch below exists to prevent: a control describing ground it left alone.
    const skipped = result.report.pruneSkipped || 0;
    const tested = result.report.pruneTested || 0;
    if (skipped === 0) {
      lines.push(
        '',
        `  pruned   : none — CHECKED the target of all ${result.report.examined} examined hook(s); every one exists.`
      );
    } else {
      lines.push(
        '',
        // "every one exists" is only sayable about targets actually tested. With
        // `tested === 0` it is a VACUOUS truth, and a vacuous truth in a coverage
        // report reads exactly like a real assurance — the defect this whole
        // branch exists to avoid. So the clause is omitted there.
        `  pruned   : none — CHECKED the target of ${tested} of ${result.report.examined} examined hook(s)` +
          (tested > 0 ? '; every one exists.' : ' — i.e. NONE of them.'),
        `             ${skipped} hook(s) on ${(result.report.pruneExemptEvents || []).join(', ')} were NOT target-tested:`,
        '             the governor adds to those events but never deletes from them,',
        '             so a dangling hook there would not have been detected by this run.'
      );
    }
  } else {
    lines.push(
      '',
      '  pruned   : NOT CHECKED — --no-prune was given, so no hook target was tested.',
      '             This is NOT a statement that every target exists.',
      '             A dangling hook would not have been detected by this run.'
    );
  }

  lines.push('');
  if (result.checked) {
    lines.push(
      result.changed
        ? '  RESULT: this installer\'s managed set DIFFERS from the live settings (see each line above).\n' +
          '          Nothing was written. Re-running WITHOUT --check would apply every difference\n' +
          '          shown — including newly ACTIVATING anything marked "would be ADDED", which is\n' +
          '          a change to what runs, not a catch-up to a state you already had.'
        : '  RESULT: already correct — the live settings match this installer\'s managed set. Nothing to do.'
    );
  } else {
    lines.push(
      result.changed ? `  RESULT: written. Backup: ${result.backup}` : '  RESULT: already correct. Nothing written.'
    );
    // AC3 — fires on a run that CHANGED something, and only then.
    if (result.changed) lines.push('', RESTART_NOTICE);
  }
  lines.push('='.repeat(72), '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { check: false, prune: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') args.check = true;
    else if (argv[i] === '--no-prune') args.prune = false;
    else if (argv[i] === '--checkout') args.checkout = argv[++i];
    else if (argv[i] === '--script') args.script = argv[++i];
    else if (argv[i] === '--guard') args.guard = argv[++i];
    else if (argv[i] === '--statusline') args.statusline = argv[++i];
    else if (argv[i] === '--stop') args.stop = argv[++i];
    else if (argv[i] === '--estate') args.estate = argv[++i];
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..', '..');

  // Default checkout is the PRIMARY checkout, not this worktree: hooks live in
  // the session's settings file, and sessions start in the primary checkout.
  const checkout = args.checkout || 'C:/Fusion247PKA';
  const scriptPath = args.script || join(repoRoot, 'tools', 'governor', 'reorient.mjs');

  const result = installHooks({
    checkout,
    scriptPath: String(scriptPath).replace(/\\/g, '/'),
    guardPath: args.guard ? String(args.guard).replace(/\\/g, '/') : undefined,
    statuslinePath: args.statusline ? String(args.statusline).replace(/\\/g, '/') : undefined,
    stopPath: args.stop ? String(args.stop).replace(/\\/g, '/') : undefined,
    // The guard is pointed at the primary checkout so it can find the build from a
    // session that started anywhere — it needs the estate enumeration to resolve the
    // active programme, and the session's own cwd is not reliably inside the estate.
    estate: args.estate || checkout,
    check: args.check,
    prune: args.prune,
  });

  process.stdout.write(renderReport(result));
  process.exitCode = result.ok ? 0 : 1;
}
