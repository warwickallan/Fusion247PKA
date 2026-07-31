import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  settingsPath,
  governorHookCommand,
  guardHookCommand,
  guardScriptFor,
  isGovernorHook,
  isGuardHook,
  hookTargets,
  danglingTargets,
  planSettings,
  installHooks,
  renderReport,
  HOOK_EVENT,
  GUARD_EVENT,
  GUARD_MATCHER,
  GOVERNOR_MARKER,
  GUARD_MARKER,
} from './install-hooks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTALL_SRC = join(__dirname, 'install-hooks.mjs');

// A scratch checkout with a settings file shaped like the real one (Q-5's exact
// shape: a dangling ensure-watcher hook beside a working capture-gateway hook).
function makeCheckout({ settings } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'governor-hooks-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  mkdirSync(join(root, 'services'), { recursive: true });
  writeFileSync(join(root, 'services', 'real-hook.mjs'), '// exists\n');
  const doc = settings ?? {
    permissions: { allow: ['Bash(git status)'] },
    hooks: {
      [HOOK_EVENT]: [
        {
          hooks: [
            { type: 'command', command: `node ${root.replace(/\\/g, '/')}/services/missing-hook.mjs` },
            { type: 'command', command: `node ${root.replace(/\\/g, '/')}/services/real-hook.mjs` },
          ],
        },
      ],
    },
  };
  writeFileSync(settingsPath(root), JSON.stringify(doc, null, 2) + '\n');
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const SCRIPT = 'C:/Fusion247PKA-governor/tools/governor/reorient.mjs';

// ---------------------------------------------------------------------------
// Target extraction — the Q-5 rule's foundation
// ---------------------------------------------------------------------------

test('hookTargets: extracts script arguments and ignores --env-file flags', () => {
  const cmd = 'node --env-file=C:/.fusion247/a.env --env-file=C:/b.env C:/x/watcher.mjs';
  assert.deepEqual(hookTargets(cmd), ['C:/x/watcher.mjs']);
});

test('hookTargets: never throws on a non-string command', () => {
  assert.deepEqual(hookTargets(undefined), []);
  assert.deepEqual(hookTargets(null), []);
  assert.deepEqual(hookTargets(42), []);
});

test('danglingTargets: reports only targets that genuinely do not exist', () => {
  const c = makeCheckout();
  try {
    const real = `node ${c.root.replace(/\\/g, '/')}/services/real-hook.mjs`;
    const missing = `node ${c.root.replace(/\\/g, '/')}/services/missing-hook.mjs`;
    assert.deepEqual(danglingTargets(real), []);
    assert.equal(danglingTargets(missing).length, 1);
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Q-5 — reconciliation, and its limits
// ---------------------------------------------------------------------------

test('Q-5: a hook whose target script does not exist is PRUNED and reported', () => {
  const c = makeCheckout();
  try {
    const settings = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const { settings: next, report } = planSettings(settings, { scriptPath: SCRIPT, cwd: c.root });

    assert.equal(report.pruned.length, 1, 'exactly the dangling hook must be pruned');
    assert.match(report.pruned[0].command, /missing-hook\.mjs/);
    assert.equal(report.kept, 1, 'the working sibling must be kept');

    const commands = next.hooks[HOOK_EVENT].flatMap((g) => g.hooks.map((h) => h.command));
    assert.ok(!commands.some((cmd) => cmd.includes('missing-hook.mjs')));
    assert.ok(commands.some((cmd) => cmd.includes('real-hook.mjs')));
  } finally {
    c.cleanup();
  }
});

test('MUTATION (Q-5 must not over-reach): when EVERY target exists, nothing is pruned', () => {
  const c = makeCheckout();
  try {
    // Make the previously-missing target exist.
    writeFileSync(join(c.root, 'services', 'missing-hook.mjs'), '// now exists\n');
    const settings = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const { report } = planSettings(settings, { scriptPath: SCRIPT, cwd: c.root });
    assert.deepEqual(report.pruned, [], 'a rule that prunes an existing target is over-reaching');
    assert.equal(report.kept, 2);
  } finally {
    c.cleanup();
  }
});

test('--no-prune leaves dangling hooks alone (the rule is opt-outable, not hidden)', () => {
  const c = makeCheckout();
  try {
    const settings = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const { report } = planSettings(settings, { scriptPath: SCRIPT, cwd: c.root, prune: false });
    assert.deepEqual(report.pruned, []);
    assert.equal(report.kept, 2);
  } finally {
    c.cleanup();
  }
});

test('the governor hook itself is never pruned, even before its script exists on disk', () => {
  const settings = {
    hooks: {
      [HOOK_EVENT]: [{ hooks: [{ type: 'command', command: `node /nowhere/${GOVERNOR_MARKER}` }] }],
    },
  };
  const { report, settings: next } = planSettings(settings, { scriptPath: SCRIPT, cwd: '/tmp' });
  assert.deepEqual(report.pruned, []);
  assert.equal(report.replaced, true, 'it is re-pointed to the current script instead');
  assert.equal(next.hooks[HOOK_EVENT][0].hooks[0].command, governorHookCommand(SCRIPT));
});

// ---------------------------------------------------------------------------
// X-2 — idempotent activation
// ---------------------------------------------------------------------------

test('X-2: installing into a settings file with no hooks at all creates the structure', () => {
  const { settings: next, report } = planSettings({}, { scriptPath: SCRIPT, cwd: '/tmp' });
  assert.equal(report.added, true);
  assert.equal(next.hooks[HOOK_EVENT].length, 1);
  assert.equal(next.hooks[HOOK_EVENT][0].matcher, 'clear', 'must only fire on /clear');
  assert.equal(next.hooks[HOOK_EVENT][0].hooks[0].command, governorHookCommand(SCRIPT));
});

test('X-2: install is IDEMPOTENT — the second run writes nothing', () => {
  const c = makeCheckout();
  try {
    const first = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(first.changed, true);
    assert.ok(first.backup, 'a changing run must leave a backup');

    const after = readFileSync(settingsPath(c.root), 'utf8');
    const second = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(second.changed, false, 're-running must be a no-op');
    assert.equal(second.backup, null, 'a no-op must not create a backup');
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), after, 'the file must be byte-identical');

    const third = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(third.changed, false);
  } finally {
    c.cleanup();
  }
});

test('re-pointing to a new script path is a change, and still leaves exactly one governor hook', () => {
  const c = makeCheckout();
  try {
    installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const moved = installHooks({ checkout: c.root, scriptPath: 'C:/Fusion247PKA/tools/governor/reorient.mjs' });
    assert.equal(moved.changed, true);

    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const governor = doc.hooks[HOOK_EVENT].flatMap((g) => g.hooks).filter(isGovernorHook);
    assert.equal(governor.length, 1, 'never duplicate the governor hook');
    assert.match(governor[0].command, /C:\/Fusion247PKA\/tools\/governor\/reorient\.mjs/);
  } finally {
    c.cleanup();
  }
});

test('unrelated settings keys survive the install untouched', () => {
  const c = makeCheckout();
  try {
    installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.deepEqual(doc.permissions, { allow: ['Bash(git status)'] });
  } finally {
    c.cleanup();
  }
});

test('other hook events are not disturbed', () => {
  const c = makeCheckout({
    settings: {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'node /nowhere/gone.mjs' }] }],
        [HOOK_EVENT]: [],
      },
    },
  });
  try {
    installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(doc.hooks.Stop[0].hooks.length, 1, 'the prune rule is SessionStart-only');
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Fail closed — this file is Warwick's live machine config and is not in git
// ---------------------------------------------------------------------------

test('MUTATION: an UNPARSEABLE settings file is never overwritten', () => {
  const c = makeCheckout();
  try {
    writeFileSync(settingsPath(c.root), '{ broken json');
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'unparseable-settings');
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), '{ broken json', 'the file must be untouched');
    assert.match(renderReport(r), /HOOK INSTALL FAILED/);
  } finally {
    c.cleanup();
  }
});

test('MUTATION: a missing settings file is reported, not created', () => {
  const c = makeCheckout();
  try {
    rmSync(settingsPath(c.root));
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing-settings');
  } finally {
    c.cleanup();
  }
});

test('MUTATION: --check writes NOTHING, even when the settings are out of date (INV-7)', () => {
  const c = makeCheckout();
  try {
    const before = readFileSync(settingsPath(c.root), 'utf8');
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT, check: true });
    assert.equal(r.ok, true);
    assert.equal(r.checked, true);
    assert.equal(r.changed, true, 'it must still REPORT that a change is needed');
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), before, '--check must not write');
    assert.equal(readdirSync(join(c.root, '.claude')).length, 1, '--check must not create a backup either');
    assert.match(renderReport(r), /nothing was written/i);
  } finally {
    c.cleanup();
  }
});

test('the report names what was pruned, so nothing disappears silently', () => {
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const text = renderReport(r);
    assert.match(text, /PRUNED 1 hook/);
    assert.match(text, /missing-hook\.mjs/);
    assert.match(text, /recoverable from the backup/);
    assert.ok(r.report.examined > 0, 'must assert a non-zero count of hooks actually examined (INV-5)');
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// The real CLI
// ---------------------------------------------------------------------------

test('REAL PROCESS: --check against a scratch checkout exits 0 and writes nothing', () => {
  const c = makeCheckout();
  try {
    const before = readFileSync(settingsPath(c.root), 'utf8');
    const out = execFileSync('node', [INSTALL_SRC, '--check', '--checkout', c.root, '--script', SCRIPT], {
      encoding: 'utf8',
    });
    assert.match(out, /CHECK \(nothing was written\)/);
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), before);
  } finally {
    c.cleanup();
  }
});

test('REAL PROCESS: install then --check reports "already correct"', () => {
  const c = makeCheckout();
  try {
    execFileSync('node', [INSTALL_SRC, '--checkout', c.root, '--script', SCRIPT], { encoding: 'utf8' });
    const out = execFileSync('node', [INSTALL_SRC, '--check', '--checkout', c.root, '--script', SCRIPT], {
      encoding: 'utf8',
    });
    assert.match(out, /already correct/);
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Requirement 9 — BOTH halves ship, and both ship from git
// ---------------------------------------------------------------------------
// The brief tells a misplaced session it is misplaced; the gate is what stops it
// writing anyway. Installing one without the other would leave the louder half
// of the control with nothing behind it.

function hooksFor(doc, event) {
  return (doc.hooks?.[event] || []).flatMap((g) => g.hooks || []);
}

test('REQUIREMENT 9: one install ships BOTH the SessionStart brief and the PreToolUse gate', () => {
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));

    const session = hooksFor(doc, HOOK_EVENT).filter(isGovernorHook);
    assert.equal(session.length, 1, 'exactly one reorientation hook');
    assert.match(session[0].command, new RegExp(GOVERNOR_MARKER.replace(/\//g, '\\/')));

    const guard = hooksFor(doc, GUARD_EVENT).filter(isGuardHook);
    assert.equal(guard.length, 1, 'exactly one guard hook');
    assert.ok(guard[0].command.includes(GUARD_MARKER), 'the guard must point at the committed script');
    assert.ok(guard[0].command.includes('--estate'), 'the guard needs the estate root to work from anywhere');

    const guardGroup = doc.hooks[GUARD_EVENT].find((g) => (g.hooks || []).some(isGuardHook));
    assert.equal(guardGroup.matcher, GUARD_MATCHER);
    for (const tool of ['Write', 'Edit', 'MultiEdit', 'Bash']) {
      assert.ok(GUARD_MATCHER.split('|').includes(tool), `${tool} must be matched by the gate`);
    }
    assert.equal(r.report.events.guard.added, true);
    assert.equal(r.report.events.governor.added, true);
  } finally {
    c.cleanup();
  }
});

test('guardScriptFor derives the sibling, and refuses to guess from an unrelated path', () => {
  assert.equal(guardScriptFor('C:/x/tools/governor/reorient.mjs'), 'C:/x/tools/governor/worktree-guard.mjs');
  assert.equal(guardScriptFor('C:\\x\\tools\\governor\\reorient.mjs'), 'C:/x/tools/governor/worktree-guard.mjs');
  assert.equal(guardScriptFor('C:/x/something-else.mjs'), null, 'no guess, no guard');
  assert.equal(guardHookCommand('C:/g.mjs', 'C:/estate'), 'node C:/g.mjs --estate C:/estate');
  assert.equal(guardHookCommand('C:/g.mjs', null), 'node C:/g.mjs');
});

test('X-2: installing BOTH hooks is idempotent — the second and third runs write nothing', () => {
  const c = makeCheckout();
  try {
    assert.equal(installHooks({ checkout: c.root, scriptPath: SCRIPT }).changed, true);
    const after = readFileSync(settingsPath(c.root), 'utf8');
    assert.equal(installHooks({ checkout: c.root, scriptPath: SCRIPT }).changed, false);
    assert.equal(installHooks({ checkout: c.root, scriptPath: SCRIPT }).changed, false);
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), after, 'byte-identical');
  } finally {
    c.cleanup();
  }
});

test('MUTATION: the GUARD hook is never pruned by the Q-5 rule, even before its script exists', () => {
  const c = makeCheckout();
  try {
    // Point the install at a script path that does not exist on disk at all.
    const nowhere = 'C:/definitely/not/here/tools/governor/reorient.mjs';
    const r = installHooks({ checkout: c.root, scriptPath: nowhere });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(hooksFor(doc, GUARD_EVENT).filter(isGuardHook).length, 1);
    assert.equal(hooksFor(doc, HOOK_EVENT).filter(isGovernorHook).length, 1);
    assert.ok(
      !r.report.pruned.some((p) => p.command.includes(GOVERNOR_MARKER) || p.command.includes(GUARD_MARKER)),
      'the governor must never prune itself — a fresh clone installs before it builds'
    );

    // And re-running must not duplicate them.
    installHooks({ checkout: c.root, scriptPath: nowhere });
    const again = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(hooksFor(again, GUARD_EVENT).filter(isGuardHook).length, 1);
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Requirement 8 — the ensure-watcher reconciliation, on the REAL shape
// ---------------------------------------------------------------------------

test('REQUIREMENT 8: the real settings shape reconciles — dangling ensure-watcher pruned, live sibling kept, and it is IDEMPOTENT', () => {
  // This is the actual shape of Warwick's machine (Q-5): a SessionStart hook
  // pointing at services/control-plane/tower-loop/ensure-watcher.mjs, which was
  // never committed and exists in no branch, sitting beside a capture-gateway
  // hook that genuinely exists.
  const c = makeCheckout({
    settings: {
      permissions: { allow: ['Bash(git status)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'node C:/real/bridge-ingest.mjs' }] }],
        [HOOK_EVENT]: [
          {
            hooks: [
              {
                type: 'command',
                command:
                  'node --env-file=C:/.fusion247/control-plane-dev.env --env-file=C:/.fusion247/tower-baton.env C:/GONE/ensure-watcher.mjs',
              },
              { type: 'command', command: 'node REPLACE_ME/services/real-hook.mjs' },
            ],
          },
        ],
      },
    },
  });
  try {
    // Point the surviving hook at a file that really exists in the scratch checkout.
    const raw = readFileSync(settingsPath(c.root), 'utf8').replace(
      /REPLACE_ME/g,
      c.root.replace(/\\/g, '/')
    );
    writeFileSync(settingsPath(c.root), raw);

    const first = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(first.changed, true);
    assert.equal(first.report.pruned.length, 1, 'exactly the dangling watcher');
    assert.match(first.report.pruned[0].command, /ensure-watcher\.mjs/);
    assert.equal(first.report.pruned[0].event, HOOK_EVENT);
    assert.ok(first.backup, 'nothing is destroyed without a backup');

    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const session = hooksFor(doc, HOOK_EVENT).map((h) => h.command);
    assert.ok(!session.some((cmd) => cmd.includes('ensure-watcher')), 'the dangling hook is gone');
    assert.ok(session.some((cmd) => cmd.includes('real-hook.mjs')), 'the working sibling survives');
    assert.ok(session.some((cmd) => cmd.includes(GOVERNOR_MARKER)), 'the governor is now beside it');
    assert.equal(
      doc.hooks.Stop[0].hooks.length,
      1,
      'events the governor does not manage are never touched, dangling or not'
    );

    // Idempotent: reconciling an already-reconciled file changes nothing.
    const settled = readFileSync(settingsPath(c.root), 'utf8');
    const second = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(second.changed, false, 'a second reconciliation must be a no-op');
    assert.deepEqual(second.report.pruned, [], 'nothing left to prune');
    assert.equal(second.backup, null);
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), settled, 'byte-identical');
  } finally {
    c.cleanup();
  }
});
