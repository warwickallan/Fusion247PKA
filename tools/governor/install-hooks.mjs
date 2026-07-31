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

export function isGovernorHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(GOVERNOR_MARKER);
}

export function isGuardHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes(GUARD_MARKER);
}

// Derive the guard script from the reorientation script: they are siblings by
// construction, so a caller that names one has named both. This keeps every
// existing single-script call site working while shipping two hooks.
export function guardScriptFor(scriptPath) {
  const p = String(scriptPath).replace(/\\/g, '/');
  return p.endsWith('reorient.mjs') ? p.replace(/reorient\.mjs$/, 'worktree-guard.mjs') : null;
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
  { scriptPath, guardPath, estate, exists = existsSync, cwd, prune = true } = {}
) {
  const next = JSON.parse(JSON.stringify(settings ?? {}));
  const report = { installed: false, replaced: false, pruned: [], kept: 0, examined: 0, events: {} };

  if (!next.hooks || typeof next.hooks !== 'object') next.hooks = {};

  const command = governorHookCommand(scriptPath);
  const resolvedGuard = guardPath ?? guardScriptFor(scriptPath);
  const guardCommand = resolvedGuard ? guardHookCommand(resolvedGuard, estate) : null;

  // Requirement 9 — both halves of the durable behaviour are installed together.
  // Shipping the brief without the gate would leave a session that is TOLD it is
  // misplaced and still perfectly able to write anyway.
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

  for (const spec of managed) {
    if (!Array.isArray(next.hooks[spec.event])) next.hooks[spec.event] = [];
    const state = { installed: false, replaced: false, added: false };

    for (const group of next.hooks[spec.event]) {
      if (!Array.isArray(group?.hooks)) continue;
      const surviving = [];
      for (const hook of group.hooks) {
        report.examined += 1;

        if (spec.is(hook)) {
          // Idempotent: exactly one of each, always re-pointed at the current script.
          if (hook.command !== spec.command) {
            state.replaced = true;
            report.replaced = true;
            hook.command = spec.command;
          }
          state.installed = true;
          surviving.push(hook);
          continue;
        }

        // A governor-managed hook is never pruned by the sibling rule, even when
        // its script is not yet on disk (fresh clone, install-before-build).
        if (managed.some((m) => m.is(hook))) {
          report.kept += 1;
          surviving.push(hook);
          continue;
        }

        const dangling = prune ? danglingTargets(hook?.command, { exists, cwd }) : [];
        if (dangling.length) {
          report.pruned.push({ event: spec.event, command: hook.command, missing: dangling });
          continue; // dropped
        }

        report.kept += 1;
        surviving.push(hook);
      }
      group.hooks = surviving;
    }

    if (!state.installed) {
      // Own group, with a matcher: SessionStart fires only on /clear, PreToolUse
      // only on the mutating tools. The in-script guards are the testable ones;
      // the matchers keep the hooks off everything unrelated.
      next.hooks[spec.event].push({
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

  return { settings: next, report, command, guardCommand };
}

// ---------------------------------------------------------------------------
// The impure step
// ---------------------------------------------------------------------------

export function installHooks({
  checkout,
  scriptPath,
  guardPath,
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

  const { settings: next, report, command, guardCommand } = planSettings(settings, {
    scriptPath,
    guardPath,
    estate: estate ?? checkout,
    exists,
    cwd: checkout,
    prune,
  });

  const serialised = JSON.stringify(next, null, 2) + '\n';
  const changed = serialised !== raw;

  if (check) {
    return { ok: true, checked: true, changed, path, report, command, guardCommand };
  }

  if (!changed) {
    return { ok: true, changed: false, path, report, command, guardCommand, backup: null };
  }

  const backup = `${path}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  copy(path, backup);
  write(path, serialised);

  return { ok: true, changed: true, path, report, command, guardCommand, backup };
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
    `    ${result.guardCommand || '(no guard script could be derived — NOT installed)'}`
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
    // The guard is pointed at the primary checkout so it can enumerate every
    // worktree in the estate from a session that started anywhere.
    estate: args.estate || checkout,
    check: args.check,
    prune: args.prune,
  });

  process.stdout.write(renderReport(result));
  process.exitCode = result.ok ? 0 : 1;
}
