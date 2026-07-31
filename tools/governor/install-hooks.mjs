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
export const GOVERNOR_MARKER = 'tools/governor/reorient.mjs';
export const GUARD_MARKER = 'tools/governor/worktree-guard.mjs';
export const DELEGATION_MARKER = 'tools/governor/delegation-gate.mjs';

// The tools the PreToolUse guard adjudicates. Read-only tools are deliberately
// absent: a misplaced session must still be able to diagnose itself, and a guard
// that blocks Read would make its own deny message unactionable.
export const GUARD_MATCHER = 'Write|Edit|MultiEdit|NotebookEdit|Bash';

// The Task-dispatch observer matches only subagent dispatch (mechanism 1 of the
// delegation gate). The substantial-work threshold gate (mechanism 2) is
// deliberately narrower than GUARD_MATCHER above — it does not govern
// NotebookEdit — so it gets its own matcher rather than reusing GUARD_MATCHER.
export const DELEGATION_OBSERVER_MATCHER = 'Task';
export const DELEGATION_GATE_MATCHER = 'Write|Edit|MultiEdit|Bash';

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

// The delegation observer and gate need the estate root for the exact same
// reason the worktree guard does: they must be able to resolve the active
// programme (and, for the gate, the current ticket) from a session that may
// have started in a checkout that knows nothing about the build.
export function delegationObserverHookCommand(scriptPath, estate) {
  const base = `node ${String(scriptPath).replace(/\\/g, '/')} observe`;
  return estate ? `${base} --estate ${String(estate).replace(/\\/g, '/')}` : base;
}

export function delegationGateHookCommand(scriptPath, estate) {
  const base = `node ${String(scriptPath).replace(/\\/g, '/')} check`;
  return estate ? `${base} --estate ${String(estate).replace(/\\/g, '/')}` : base;
}

export function isGovernorHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(GOVERNOR_MARKER);
}

export function isGuardHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(GUARD_MARKER);
}

// The observer (`... delegation-gate.mjs observe ...`) and the gate
// (`... delegation-gate.mjs check ...`) point at the SAME script with
// different subcommands, so DELEGATION_MARKER alone cannot tell them apart —
// each predicate also requires its own subcommand token.
export function isDelegationObserverHook(hook) {
  return (
    typeof hook?.command === 'string' &&
    hook.command.includes(DELEGATION_MARKER) &&
    /\bobserve\b/.test(hook.command)
  );
}

export function isDelegationGateHook(hook) {
  return (
    typeof hook?.command === 'string' &&
    hook.command.includes(DELEGATION_MARKER) &&
    /\bcheck\b/.test(hook.command)
  );
}

// Derive the guard/delegation scripts from the reorientation script: all are
// siblings by construction, so a caller that names one has named all of them.
// This keeps every existing single-script call site working while shipping
// more hooks from the one script argument.
export function guardScriptFor(scriptPath) {
  const p = String(scriptPath).replace(/\\/g, '/');
  return p.endsWith('reorient.mjs') ? p.replace(/reorient\.mjs$/, 'worktree-guard.mjs') : null;
}

export function delegationScriptFor(scriptPath) {
  const p = String(scriptPath).replace(/\\/g, '/');
  return p.endsWith('reorient.mjs') ? p.replace(/reorient\.mjs$/, 'delegation-gate.mjs') : null;
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
  { scriptPath, guardPath, delegationPath, estate, exists = existsSync, cwd, prune = true } = {}
) {
  const next = JSON.parse(JSON.stringify(settings ?? {}));
  const report = { installed: false, replaced: false, pruned: [], kept: 0, examined: 0, events: {} };

  if (!next.hooks || typeof next.hooks !== 'object') next.hooks = {};

  const command = governorHookCommand(scriptPath);
  const resolvedGuard = guardPath ?? guardScriptFor(scriptPath);
  const guardCommand = resolvedGuard ? guardHookCommand(resolvedGuard, estate) : null;
  const resolvedDelegation = delegationPath ?? delegationScriptFor(scriptPath);
  const delegationObserveCommand = resolvedDelegation
    ? delegationObserverHookCommand(resolvedDelegation, estate)
    : null;
  const delegationCheckCommand = resolvedDelegation
    ? delegationGateHookCommand(resolvedDelegation, estate)
    : null;

  // Requirement 9 — both halves of the durable behaviour are installed together.
  // Shipping the brief without the gate would leave a session that is TOLD it is
  // misplaced and still perfectly able to write anyway. The delegation observer
  // and gate ship the same way: additive, and together — recording dispatches
  // with nothing to reset them against would be inert, and gating direct calls
  // with no way to observe a dispatch would make every ticket un-clearable.
  const managed = [
    { event: HOOK_EVENT, matcher: 'clear', command, is: isGovernorHook, key: 'governor' },
  ];
  if (guardCommand) {
    managed.push({
      event: GUARD_EVENT,
      matcher: GUARD_MATCHER,
      command: guardCommand,
      is: isGuardHook,
      key: 'guard',
    });
  }
  if (delegationObserveCommand) {
    managed.push({
      event: GUARD_EVENT,
      matcher: DELEGATION_OBSERVER_MATCHER,
      command: delegationObserveCommand,
      is: isDelegationObserverHook,
      key: 'delegationObserver',
    });
  }
  if (delegationCheckCommand) {
    managed.push({
      event: GUARD_EVENT,
      matcher: DELEGATION_GATE_MATCHER,
      command: delegationCheckCommand,
      is: isDelegationGateHook,
      key: 'delegationGate',
    });
  }

  // Group specs by event and scan each event's PRE-EXISTING groups exactly
  // ONCE, checking every hook against every spec for that event in the same
  // pass. This matters now that more than one spec can share an event (guard,
  // delegationObserver and delegationGate all sit on PreToolUse): scanning
  // per-spec instead — the way this loop worked when there was only ever one
  // spec per event — would have each LATER spec re-examine the group an
  // EARLIER spec just pushed this run, inflating `examined`/`kept` for hooks
  // already accounted for. A single pass over a snapshot taken before any
  // spec's own hook is added avoids that inflation entirely, and is provably
  // equivalent to the old behaviour when an event has exactly one spec.
  const specsByEvent = new Map();
  for (const spec of managed) {
    if (!Array.isArray(next.hooks[spec.event])) next.hooks[spec.event] = [];
    if (!specsByEvent.has(spec.event)) specsByEvent.set(spec.event, []);
    specsByEvent.get(spec.event).push(spec);
  }

  for (const [event, specs] of specsByEvent) {
    const states = new Map(specs.map((spec) => [spec, { installed: false, replaced: false, added: false }]));
    const originalGroups = next.hooks[event].slice();

    for (const group of originalGroups) {
      if (!Array.isArray(group?.hooks)) continue;
      const surviving = [];
      for (const hook of group.hooks) {
        report.examined += 1;

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

        const dangling = prune ? danglingTargets(hook?.command, { exists, cwd }) : [];
        if (dangling.length) {
          report.pruned.push({ event, command: hook.command, missing: dangling });
          continue; // dropped
        }

        report.kept += 1;
        surviving.push(hook);
      }
      group.hooks = surviving;
    }

    for (const spec of specs) {
      const state = states.get(spec);
      if (!state.installed) {
        // Own group, with a matcher: SessionStart fires only on /clear, PreToolUse
        // only on the tools each spec governs. The in-script guards are the
        // testable ones; the matchers keep the hooks off everything unrelated.
        next.hooks[event].push({
          matcher: spec.matcher,
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

  return { settings: next, report, command, guardCommand, delegationObserveCommand, delegationCheckCommand };
}

// ---------------------------------------------------------------------------
// The impure step
// ---------------------------------------------------------------------------

export function installHooks({
  checkout,
  scriptPath,
  guardPath,
  delegationPath,
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
    delegationObserveCommand,
    delegationCheckCommand,
  } = planSettings(settings, {
    scriptPath,
    guardPath,
    delegationPath,
    estate: estate ?? checkout,
    exists,
    cwd: checkout,
    prune,
  });

  const serialised = JSON.stringify(next, null, 2) + '\n';
  const changed = serialised !== raw;

  const base = { path, report, command, guardCommand, delegationObserveCommand, delegationCheckCommand };

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

  const describe = (e) =>
    !e ? 'NOT INSTALLED' : e.added ? 'ADDED' : e.replaced ? 'RE-POINTED' : 'already present, unchanged';
  const ev = result.report.events || {};
  lines.push(
    '',
    `  ${HOOK_EVENT} (reorientation on /clear): ${describe(ev.governor)}`,
    `    ${result.command}`,
    `  ${GUARD_EVENT} (wrong-worktree deny gate): ${describe(ev.guard)}`,
    `    ${result.guardCommand || '(no guard script could be derived — NOT installed)'}`,
    `  ${GUARD_EVENT} (delegation-dispatch observer): ${describe(ev.delegationObserver)}`,
    `    ${result.delegationObserveCommand || '(no delegation script could be derived — NOT installed)'}`,
    `  ${GUARD_EVENT} (substantial-work threshold gate): ${describe(ev.delegationGate)}`,
    `    ${result.delegationCheckCommand || '(no delegation script could be derived — NOT installed)'}`
  );
  if (result.report.pruned.length) {
    lines.push('', `  PRUNED ${result.report.pruned.length} hook(s) whose target script does not exist (Q-5):`);
    for (const p of result.report.pruned) {
      lines.push(`    - ${p.command}`);
      lines.push(`      missing: ${p.missing.join(', ')}`);
    }
    lines.push('', '  These are recoverable from the backup below and from this ticket\'s evidence file.');
  } else {
    lines.push('  pruned   : none (every existing hook target exists)');
  }
  lines.push('');
  lines.push(result.checked
    ? (result.changed ? '  RESULT: settings are OUT OF DATE — re-run without --check to apply.' : '  RESULT: settings are already correct. Nothing to do.')
    : (result.changed ? `  RESULT: written. Backup: ${result.backup}` : '  RESULT: already correct. Nothing written.'));
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
    else if (argv[i] === '--delegation') args.delegation = argv[++i];
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
    delegationPath: args.delegation ? String(args.delegation).replace(/\\/g, '/') : undefined,
    // The guard (and the delegation observer/gate, which need the same estate
    // enumeration to resolve the active programme) is pointed at the primary
    // checkout so it can find the build from a session that started anywhere.
    estate: args.estate || checkout,
    check: args.check,
    prune: args.prune,
  });

  process.stdout.write(renderReport(result));
  process.exitCode = result.ok ? 0 : 1;
}
