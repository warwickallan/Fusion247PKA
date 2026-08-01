import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  settingsPath,
  statuslineScriptFor,
  statusLineCommand,
  isGovernorStatusLine,
  RESTART_NOTICE,
  STATUSLINE_MARKER,
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
  stopControllerScriptFor,
  stopHookCommand,
  isStopControllerHook,
  HOOK_EVENT,
  GUARD_EVENT,
  STOP_EVENT,
  STOP_MARKER,
  GUARD_MATCHER,
  GOVERNOR_MARKER,
  GUARD_MARKER,
  RETIRED_MARKERS,
  isRetiredHook,
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

// SPEC AMENDMENT (WO-2026-08-01-01 AC2, Silas D-B §B-1, authorised by Larry
// 2026-08-01). This previously asserted `matcher === 'clear'` with the message
// "must only fire on /clear" — which WAS the defect: it made reorientation
// unreachable on `startup` and `resume`. The requirement changed; this is not a
// test edited to fit the code.
test('X-2/AC2: installing into a settings file with no hooks at all creates the structure', () => {
  const { settings: next, report } = planSettings({}, { scriptPath: SCRIPT, cwd: '/tmp' });
  assert.equal(report.added, true);
  assert.equal(next.hooks[HOOK_EVENT].length, 1);
  assert.equal(next.hooks[HOOK_EVENT][0].hooks[0].command, governorHookCommand(SCRIPT));
});

test('AC2: the SessionStart entry carries NO matcher key at all — not "", not "*"', () => {
  const { settings: next } = planSettings({}, { scriptPath: SCRIPT, cwd: '/tmp' });
  const group = next.hooks[HOOK_EVENT][0];
  // The KEY must be ABSENT, not merely falsy: any matcher that enumerates
  // sources means an unknown future source silently matches nothing, which is
  // the defect class being repaired. Checked on the SERIALISED form too,
  // because that is what Claude Code actually reads.
  assert.ok(
    !Object.prototype.hasOwnProperty.call(group, 'matcher'),
    'the SessionStart group must not carry a matcher key'
  );
  const onDisk = JSON.parse(JSON.stringify(next));
  assert.ok(
    !Object.prototype.hasOwnProperty.call(onDisk.hooks[HOOK_EVENT][0], 'matcher'),
    'and it must still be absent once serialised to settings.local.json'
  );
  assert.notEqual(group.matcher, 'clear', 'the old clear-only matcher must be gone');
  assert.notEqual(group.matcher, '*');
  assert.notEqual(group.matcher, '');
});

test('AC2 MUTATION: the old clear-only shape is detectable by the AC2 predicate', () => {
  // Proves the AC2 assertion can actually fail: construct the OLD shape by hand
  // and show it trips the exact predicate AC2 relies on.
  const old = { matcher: 'clear', hooks: [{ type: 'command', command: governorHookCommand(SCRIPT) }] };
  assert.ok(
    Object.prototype.hasOwnProperty.call(old, 'matcher'),
    'the old shape HAS a matcher key — which is what AC2 now forbids'
  );
  const { settings: next } = planSettings({}, { scriptPath: SCRIPT, cwd: '/tmp' });
  assert.notDeepEqual(next.hooks[HOOK_EVENT][0], old, 'the installed shape must not be the old shape');
});

test('AC2: PreToolUse specs KEEP their matchers — the change is scoped to SessionStart', () => {
  const { settings: next } = planSettings({}, { scriptPath: SCRIPT, cwd: '/tmp' });
  const groups = (next.hooks[GUARD_EVENT] || []).filter((g) => Object.prototype.hasOwnProperty.call(g, 'matcher'));
  assert.ok(groups.length > 0, 'the PreToolUse specs must still be installed with matchers');
  for (const g of groups) {
    assert.ok(
      typeof g.matcher === 'string' && g.matcher.length > 0,
      'a PreToolUse hook must stay scoped to the tools it governs'
    );
  }
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

// ---------------------------------------------------------------------------
// RETIREMENT — the delegation observer, the delegation threshold gate, the model
// gate and the escalation gate were cut on 2026-08-01 (Warwick's cut-and-close
// ruling on the accepted Larry/Pax diagnosis).
// ---------------------------------------------------------------------------
// The tests that exercised those modules went with them. What is proven HERE is
// the property that replaced them, and it is the one that actually matters on
// Warwick's machine: dropping a spec from `managed[]` only stops the installer
// ADDING a hook — an already-installed copy would otherwise keep running forever,
// pointed at a script that no longer exists. So retirement must be an ACTIVE
// removal, and it must not depend on the target being missing from disk.
// ---------------------------------------------------------------------------

// A settings document carrying BOTH already-installed delegation-gate variants
// (`observe` and `check`) on PreToolUse, exactly as `install-hooks.mjs` used to
// write them, beside an unrelated third-party hook that must survive untouched.
function settingsWithInstalledDelegationHooks(root) {
  const fwd = root.replace(/\\/g, '/');
  return {
    hooks: {
      [GUARD_EVENT]: [
        {
          matcher: 'Task',
          hooks: [
            { type: 'command', command: `node ${fwd}/tools/governor/delegation-gate.mjs observe --estate ${fwd}` },
          ],
        },
        {
          matcher: 'Write|Edit|MultiEdit|Bash',
          hooks: [
            { type: 'command', command: `node ${fwd}/tools/governor/delegation-gate.mjs check --estate ${fwd}` },
            { type: 'command', command: `node ${fwd}/services/real-hook.mjs` },
          ],
        },
      ],
    },
  };
}

test('RETIRED_MARKERS names exactly the cut controls, and isRetiredHook matches on the SCRIPT, not on a subcommand', () => {
  assert.deepEqual([...RETIRED_MARKERS].sort(), [
    'tools/governor/delegation-gate.mjs',
    'tools/governor/escalation-gate.mjs',
    'tools/governor/model-gate.mjs',
  ]);
  assert.ok(Object.isFrozen(RETIRED_MARKERS), 'the retirement list must not be mutable at runtime');

  // BOTH subcommands of the one script are retired — matching on the script path
  // is what makes that true without enumerating every argv shape it ever had.
  assert.equal(isRetiredHook({ command: 'node C:/x/tools/governor/delegation-gate.mjs observe --estate C:/e' }), true);
  assert.equal(isRetiredHook({ command: 'node C:/x/tools/governor/delegation-gate.mjs check --estate C:/e' }), true);
  // Backslashes are normalised: a settings file written on Windows must not escape.
  assert.equal(isRetiredHook({ command: 'node C:\\x\\tools\\governor\\model-gate.mjs' }), true);
  assert.equal(isRetiredHook({ command: 'node C:/x/tools/governor/escalation-gate.mjs' }), true);

  // And it must not over-reach onto anything retained, or onto malformed input.
  assert.equal(isRetiredHook({ command: 'node C:/x/tools/governor/worktree-guard.mjs' }), false);
  assert.equal(isRetiredHook({ command: 'node C:/x/tools/governor/reorient.mjs' }), false);
  assert.equal(isRetiredHook({ command: 'node C:/x/tools/governor/stop-controller.mjs' }), false);
  assert.equal(isRetiredHook(null), false);
  assert.equal(isRetiredHook({}), false);
  assert.equal(isRetiredHook({ command: 42 }), false);
});

test('MADE TO FAIL: an ALREADY-INSTALLED delegation-gate hook (both observe and check) is REMOVED and recorded in report.retired', () => {
  const c = makeCheckout({ settings: { hooks: {} } });
  try {
    writeFileSync(settingsPath(c.root), JSON.stringify(settingsWithInstalledDelegationHooks(c.root), null, 2) + '\n');

    // BEFORE — establish the ground rather than assuming it. Both variants really
    // are installed; a test that never saw them present proves nothing about their
    // removal.
    const before = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const beforeHooks = hooksFor(before, GUARD_EVENT);
    const beforeRetired = beforeHooks.filter(isRetiredHook);
    assert.equal(beforeRetired.length, 2, 'precondition: TWO retired hooks are installed');
    assert.equal(beforeRetired.filter((h) => h.command.includes(' observe ')).length, 1);
    assert.equal(beforeRetired.filter((h) => h.command.includes(' check ')).length, 1);

    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });

    // AFTER — both are gone from the settings actually written to disk.
    const after = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const afterHooks = hooksFor(after, GUARD_EVENT);
    assert.equal(afterHooks.filter(isRetiredHook).length, 0, 'no retired hook may survive an install');
    assert.ok(
      !JSON.stringify(after).includes('delegation-gate.mjs'),
      'and no trace of the retired script may remain anywhere in the document'
    );

    // The removal is REPORTED, not silent, and is kept out of `pruned` — pruning
    // tidies an accident, retirement withdraws a control, and collapsing the two
    // would hide a policy decision inside housekeeping.
    assert.equal(r.report.retired.length, 2, 'both retired hooks must be recorded');
    for (const entry of r.report.retired) {
      assert.equal(entry.event, GUARD_EVENT);
      assert.ok(entry.command.includes('delegation-gate.mjs'));
    }
    assert.ok(
      !r.report.pruned.some((p) => p.command.includes('delegation-gate.mjs')),
      'a retired hook is retired, never reported as pruned'
    );

    // Non-destructive to everything else: the unrelated third-party hook and both
    // retained governor hooks are present.
    assert.ok(
      afterHooks.some((h) => h.command.includes('real-hook.mjs')),
      'an unrelated hook sharing the group must survive retirement'
    );
    assert.equal(hooksFor(after, GUARD_EVENT).filter(isGuardHook).length, 1);
    assert.equal(hooksFor(after, HOOK_EVENT).filter(isGovernorHook).length, 1);
  } finally {
    c.cleanup();
  }
});

test('retirement does NOT depend on the retired script being missing from disk', () => {
  // The whole point: a control is retired when the installer takes it out, not
  // when its file happens to be absent. `exists: () => true` makes every target
  // present, which disarms the Q-5 pruner completely — so anything removed here
  // was removed by the retirement rule and by nothing else.
  const c = makeCheckout({ settings: { hooks: {} } });
  try {
    writeFileSync(settingsPath(c.root), JSON.stringify(settingsWithInstalledDelegationHooks(c.root), null, 2) + '\n');
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT, exists: () => true });
    assert.deepEqual(r.report.pruned, [], 'precondition: the pruner must find nothing to do');
    assert.equal(r.report.retired.length, 2, 'and retirement must still have removed both');
    const after = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(hooksFor(after, GUARD_EVENT).filter(isRetiredHook).length, 0);
  } finally {
    c.cleanup();
  }
});

test('retirement is idempotent and settles: a second install finds nothing left to retire and writes nothing', () => {
  const c = makeCheckout({ settings: { hooks: {} } });
  try {
    writeFileSync(settingsPath(c.root), JSON.stringify(settingsWithInstalledDelegationHooks(c.root), null, 2) + '\n');
    assert.equal(installHooks({ checkout: c.root, scriptPath: SCRIPT }).report.retired.length, 2);
    const settled = readFileSync(settingsPath(c.root), 'utf8');

    const second = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.deepEqual(second.report.retired, [], 'nothing left to retire');
    assert.equal(second.changed, false);
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), settled, 'byte-identical');
  } finally {
    c.cleanup();
  }
});

test('a RETIREMENT is never silent — renderReport names every hook it removed, in both modes', () => {
  // Found by running the CLI end-to-end against a settings file that already had
  // both delegation hooks installed: two live hooks were deleted and the report
  // said only "examined: 2, kept: 0". The pruner has had a "nothing disappears
  // silently" guarantee since Q-5; retirement removes hooks the pruner would
  // specifically REFUSE to touch, so it needs its own.
  const c = makeCheckout({ settings: { hooks: {} } });
  try {
    writeFileSync(settingsPath(c.root), JSON.stringify(settingsWithInstalledDelegationHooks(c.root), null, 2) + '\n');

    // --check FIRST, so nothing is written and the proposal wording is under test.
    const proposal = renderReport(installHooks({ checkout: c.root, scriptPath: SCRIPT, check: true }));
    assert.match(proposal, /RETIRED 2 hook\(s\)/, 'a check must disclose what a real run would remove');
    assert.match(proposal, /would REMOVE the hook\(s\) above/);
    assert.match(proposal, /delegation-gate\.mjs observe/, 'and name them exactly, not by count alone');
    assert.match(proposal, /delegation-gate\.mjs check/);

    const applied = renderReport(installHooks({ checkout: c.root, scriptPath: SCRIPT }));
    assert.match(applied, /RETIRED 2 hook\(s\)/);
    assert.match(applied, /WITHDRAWN/);
    assert.match(applied, /delegation-gate\.mjs observe/);
    assert.match(applied, /delegation-gate\.mjs check/);
    assert.match(applied, /recoverable from the backup/, 'a destructive step must say how to undo it');

    // A retired hook must not be laundered through the pruner's own block.
    assert.doesNotMatch(applied, /PRUNED \d+ hook\(s\)/);
  } finally {
    c.cleanup();
  }
});

test('MUTATION (retirement must not over-reach): with no retired hook present, report.retired is empty and nothing is removed', () => {
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.deepEqual(r.report.retired, [], 'a rule that retires a retained hook is over-reaching');
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(hooksFor(doc, HOOK_EVENT).filter(isGovernorHook).length, 1);
    assert.equal(hooksFor(doc, GUARD_EVENT).filter(isGuardHook).length, 1);
    assert.equal(hooksFor(doc, STOP_EVENT).filter(isStopControllerHook).length, 1);
  } finally {
    c.cleanup();
  }
});

test('the RETAINED managed set is exactly three hooks: SessionStart brief, wrong-worktree gate, Stop execution controller', () => {
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));

    assert.equal(hooksFor(doc, HOOK_EVENT).filter(isGovernorHook).length, 1);
    assert.equal(hooksFor(doc, GUARD_EVENT).filter(isGuardHook).length, 1);
    assert.equal(hooksFor(doc, STOP_EVENT).filter(isStopControllerHook).length, 1);

    const guardGroup = doc.hooks[GUARD_EVENT].find((g) => (g.hooks || []).some(isGuardHook));
    assert.equal(guardGroup.matcher, GUARD_MATCHER);

    // The managed set has exactly these three keys — a fourth appearing without a
    // decision behind it is the drift this assertion exists to catch.
    assert.deepEqual(Object.keys(r.report.events).sort(), ['governor', 'guard', 'stopController']);
    assert.equal(r.report.events.governor.added, true);
    assert.equal(r.report.events.guard.added, true);
    assert.equal(r.report.events.stopController.added, true);
  } finally {
    c.cleanup();
  }
});

test('X-2: installing the retained hooks is idempotent — the second and third runs write nothing', () => {
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

test('MUTATION: a SECOND install over a nowhere-script path is still stable — the retained hooks never prune themselves', () => {
  // The delegation half of this proof retired with its module; the retained half
  // is the one that mattered, and it is asserted directly here rather than left
  // resting on the sibling test above. A fresh clone installs BEFORE it builds, so
  // every managed script is legitimately absent on the first run.
  const c = makeCheckout();
  try {
    const nowhere = 'C:/definitely/not/here/tools/governor/reorient.mjs';
    const r = installHooks({ checkout: c.root, scriptPath: nowhere });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(hooksFor(doc, HOOK_EVENT).filter(isGovernorHook).length, 1);
    assert.equal(hooksFor(doc, GUARD_EVENT).filter(isGuardHook).length, 1);
    assert.equal(hooksFor(doc, STOP_EVENT).filter(isStopControllerHook).length, 1);
    assert.ok(
      !r.report.pruned.some(
        (p) =>
          p.command.includes(GOVERNOR_MARKER) || p.command.includes(GUARD_MARKER) || p.command.includes(STOP_MARKER)
      ),
      'the governor must never prune itself — a fresh clone installs before it builds'
    );

    installHooks({ checkout: c.root, scriptPath: nowhere });
    const again = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(hooksFor(again, HOOK_EVENT).filter(isGovernorHook).length, 1);
    assert.equal(hooksFor(again, GUARD_EVENT).filter(isGuardHook).length, 1);
    assert.equal(hooksFor(again, STOP_EVENT).filter(isStopControllerHook).length, 1);
  } finally {
    c.cleanup();
  }
});

test('REPORT INTEGRITY: a single unrelated PreToolUse hook is examined exactly ONCE, never once per spec sharing that event', () => {
  // This pins the fix that made multiple specs safely share one event: before
  // it, each spec re-scanned every group already pushed by an earlier spec
  // THIS run, inflating `examined`/`kept` for hooks that were already
  // accounted for. It was written when three specs shared PreToolUse; two of
  // them retired on 2026-08-01, so the property is no longer under load TODAY —
  // and it is kept precisely because the inflation returns the moment a second
  // spec is added back to any event. Proven with a genuinely pre-existing,
  // unrelated PreToolUse hook that has nothing to do with any governor spec.
  const c = makeCheckout({
    settings: {
      hooks: {
        [GUARD_EVENT]: [{ hooks: [{ type: 'command', command: 'node REPLACE_ME/services/real-hook.mjs' }] }],
      },
    },
  });
  try {
    const raw = readFileSync(settingsPath(c.root), 'utf8').replace(/REPLACE_ME/g, c.root.replace(/\\/g, '/'));
    writeFileSync(settingsPath(c.root), raw);

    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(
      r.report.examined,
      1,
      'the one pre-existing PreToolUse hook must be counted exactly once, not once per spec sharing the event'
    );
    assert.equal(r.report.kept, 1);
    assert.deepEqual(r.report.pruned, []);

    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.ok(
      hooksFor(doc, GUARD_EVENT).some((h) => h.command.includes('real-hook.mjs')),
      'the unrelated existing hook must still survive, exactly once'
    );
  } finally {
    c.cleanup();
  }
});

test('renderReport names every RETAINED hook and no retired one', () => {
  // The positive half is the original assertion, re-aimed at the retained set: a
  // managed hook the report never mentions is a control nobody can see. The
  // negative half is the new one, and it is the load-bearing one — a report row
  // for a hook the installer no longer writes would tell Warwick a retired gate
  // is live, which is worse than saying nothing.
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const text = renderReport(r);
    assert.match(text, /reorientation, every source/);
    assert.match(text, /wrong-worktree deny gate/);
    assert.match(text, /execution controller/);
    assert.match(text, /reorient\.mjs/);
    assert.match(text, /worktree-guard\.mjs/);
    assert.match(text, /stop-controller\.mjs/);

    assert.doesNotMatch(text, /delegation/i, 'a retired control must not appear in the installer report');
    assert.doesNotMatch(text, /substantial-work threshold gate/);
    for (const marker of RETIRED_MARKERS) {
      assert.ok(!text.includes(marker), `retired ${marker} must not be named as if it were installed`);
    }
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// AC3 — the restart notice: a hook change is INERT until Claude Code restarts
// ---------------------------------------------------------------------------
// Nolan established by observation that hooks are snapshotted at process launch
// (a hook deleted at 17:05:08Z still fired at 21:39Z). So an install that says
// "written" and nothing else is indistinguishable, to the person running it,
// from an install that took effect. Both directions are tested.

test('AC3: a run that CHANGED something emits the restart notice, unmissably', () => {
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(r.changed, true, 'precondition: this run must actually change something');
    const text = renderReport(r);
    assert.match(text, /RESTART REQUIRED/, 'a changing run must say the change is not live yet');
    assert.match(text, /NOT LIVE YET/);
    assert.match(text, /Quit Claude Code COMPLETELY/, 'and say exactly what to do about it');
    assert.ok(text.includes(RESTART_NOTICE), 'the full notice must be present, not a fragment');
  } finally {
    c.cleanup();
  }
});

test('AC3: a run that changed NOTHING must not emit the restart notice', () => {
  const c = makeCheckout();
  try {
    installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const second = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(second.changed, false, 'precondition: the second run must be a no-op');
    const text = renderReport(second);
    assert.doesNotMatch(text, /RESTART REQUIRED/, 'a no-op must not cry wolf about restarting');
    assert.ok(!text.includes(RESTART_NOTICE));
    assert.match(text, /Nothing written/);
  } finally {
    c.cleanup();
  }
});

test('AC3 MUTATION: the notice test can fail — changed and unchanged runs differ', () => {
  const c = makeCheckout();
  try {
    const changed = renderReport(installHooks({ checkout: c.root, scriptPath: SCRIPT }));
    const unchanged = renderReport(installHooks({ checkout: c.root, scriptPath: SCRIPT }));
    assert.ok(changed.includes('RESTART REQUIRED'));
    assert.ok(!unchanged.includes('RESTART REQUIRED'));
    assert.notEqual(changed, unchanged, 'the two directions must be distinguishable');
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// AC4 — statusLine is part of the managed set
// ---------------------------------------------------------------------------
// Before this, install-hooks.mjs contained ZERO occurrences of `statusLine`, so
// the one governor surface that actually works existed only in Warwick's
// untracked machine config and would not survive a merge or another machine.

test('AC4: statusLine is derived from the same sibling rule as the other scripts', () => {
  assert.equal(statuslineScriptFor(SCRIPT), 'C:/Fusion247PKA-governor/tools/governor/statusline-live.mjs');
  // A path that is not the reorientation script derives nothing — this
  // installer never invents a command it could not derive.
  assert.equal(statuslineScriptFor('C:/x/tools/governor/evaluator.mjs'), null);
  assert.match(statusLineCommand(statuslineScriptFor(SCRIPT)), /^node /);
  assert.ok(statusLineCommand(statuslineScriptFor(SCRIPT)).includes(STATUSLINE_MARKER));
});

test('AC4: a FRESH install reproduces statusLine from nothing', () => {
  const { settings: next, report } = planSettings({}, { scriptPath: SCRIPT, cwd: '/tmp' });
  assert.equal(report.statusLine.state, 'added');
  assert.equal(next.statusLine.type, 'command');
  assert.ok(isGovernorStatusLine(next.statusLine), 'the installed statusLine must be the governor one');
  assert.ok(
    next.statusLine.command.includes(STATUSLINE_MARKER),
    'and must point at statusline-live.mjs, not at some other script'
  );
});

test('AC4: statusLine installation is IDEMPOTENT', () => {
  const c = makeCheckout();
  try {
    const first = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(first.report.statusLine.state, 'added');
    const after = readFileSync(settingsPath(c.root), 'utf8');
    const second = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(second.report.statusLine.state, 'unchanged');
    assert.equal(second.changed, false);
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), after, 'byte-identical on re-run');
  } finally {
    c.cleanup();
  }
});

test('AC4: a governor statusLine pointing at the wrong worktree is RE-POINTED', () => {
  const stale = { type: 'command', command: 'node C:/Some-Old-Worktree/tools/governor/statusline-live.mjs' };
  const { settings: next, report } = planSettings({ statusLine: stale }, { scriptPath: SCRIPT, cwd: '/tmp' });
  assert.equal(report.statusLine.state, 're-pointed');
  assert.equal(report.statusLine.was, stale.command);
  assert.ok(next.statusLine.command.includes('Fusion247PKA-governor'));
});

test('AC4: a THIRD-PARTY statusLine is reported and left exactly as found', () => {
  const foreign = { type: 'command', command: 'node C:/somebody-elses/prompt.mjs' };
  const { settings: next, report } = planSettings({ statusLine: foreign }, { scriptPath: SCRIPT, cwd: '/tmp' });
  assert.equal(report.statusLine.state, 'foreign-left-alone');
  assert.deepEqual(next.statusLine, foreign, 'somebody elses configuration is never overwritten');
});

test('AC4: renderReport says what happened to statusLine', () => {
  const c = makeCheckout();
  try {
    const text = renderReport(installHooks({ checkout: c.root, scriptPath: SCRIPT }));
    assert.match(text, /statusLine \(live governor line\)/);
    assert.match(text, /statusline-live\.mjs/);
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// AC5 — the report may never describe ground it did not examine
// ---------------------------------------------------------------------------

test('AC5: with a dangling hook present, the report never says "pruned: none"', () => {
  // The literal AC5 case. NOTE: this passes against the pre-existing pruner
  // too — it is a REGRESSION test, not the repair. The repair is the
  // --no-prune case below, which is where the report was actually lying.
  const c = makeCheckout(); // makeCheckout seeds a hook whose target is missing
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.ok(r.report.pruned.length > 0, 'precondition: the fixture must contain a prunable hook');
    const text = renderReport(r);
    assert.match(text, /PRUNED 1 hook\(s\)/);
    assert.doesNotMatch(text, /pruned {3}: none/, 'must not claim none while one was pruned');
    assert.match(text, /missing-hook\.mjs/, 'and must name the dangling target');
  } finally {
    c.cleanup();
  }
});

test('AC5 REPAIR: --no-prune must NOT claim "every existing hook target exists"', () => {
  // THE defect. planSettings short-circuits danglingTargets when prune=false,
  // so `pruned` is empty for a reason that has nothing to do with the targets
  // being present — yet the report used to print
  // "pruned : none (every existing hook target exists)" regardless. That is a
  // control reporting on ground it never examined, which is worse than no
  // control: an absent check invites caution, a lying one invites confidence.
  const c = makeCheckout(); // contains a hook whose target does NOT exist
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT, prune: false });
    assert.equal(r.report.pruned.length, 0, 'precondition: --no-prune prunes nothing');
    assert.equal(r.report.pruneChecked, false, 'and records that it never checked');
    const text = renderReport(r);
    assert.match(text, /NOT CHECKED/, 'the report must say the question was never asked');
    assert.doesNotMatch(
      text,
      /every existing hook target exists/,
      'it must NEVER assert that every target exists when it never looked'
    );
    assert.match(text, /would not have been detected/, 'and must say what the run cannot tell you');
  } finally {
    c.cleanup();
  }
});

test('AC5 MUTATION: the checked and unchecked reports are genuinely different', () => {
  // Makes the control above fail-able: if the two paths ever render the same
  // text again, the distinction this criterion exists to enforce is gone.
  const a = makeCheckout();
  const b = makeCheckout();
  try {
    const checked = renderReport(installHooks({ checkout: a.root, scriptPath: SCRIPT, prune: true }));
    const unchecked = renderReport(installHooks({ checkout: b.root, scriptPath: SCRIPT, prune: false }));
    assert.ok(unchecked.includes('NOT CHECKED'));
    assert.ok(!checked.includes('NOT CHECKED'));
    assert.notEqual(checked, unchecked);
  } finally {
    a.cleanup();
    b.cleanup();
  }
});

test('AC5: a clean surface says what it CHECKED, not merely that nothing was found', () => {
  const c = makeCheckout({
    settings: {
      hooks: {
        [HOOK_EVENT]: [{ hooks: [{ type: 'command', command: 'node C:/definitely/real.mjs' }] }],
      },
    },
  });
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT, exists: () => true });
    assert.equal(r.report.pruned.length, 0);
    assert.equal(r.report.pruneChecked, true);
    const text = renderReport(r);
    assert.match(
      text,
      /CHECKED the target of all \d+ examined hook\(s\)/,
      'a clean result must state the ground it covered, not just its outcome'
    );
  } finally {
    c.cleanup();
  }
});

test('AC5: --check describes a PROPOSAL, never a deficit in the live settings', () => {
  // Nolan's finding: --check reported two delegation hooks as "ADDED" beside
  // "settings are OUT OF DATE", which reads as "you are behind, sync up" when
  // it actually means "re-running would newly ACTIVATE a gate that was
  // deliberately never wired".
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT, check: true });
    assert.equal(r.checked, true);
    assert.equal(r.changed, true, 'precondition: the check must find differences');
    const text = renderReport(r);
    assert.match(text, /would be ADDED \(newly activated\)/, 'must frame an addition as an activation');
    assert.doesNotMatch(text, /OUT OF DATE/, 'must not imply the live settings are merely behind');
    assert.match(text, /a change to what runs, not a catch-up/);
    assert.match(text, /Nothing was written/);
  } finally {
    c.cleanup();
  }
});

test('AC5: --check never writes, whatever it reports', () => {
  const c = makeCheckout();
  try {
    const before = readFileSync(settingsPath(c.root), 'utf8');
    installHooks({ checkout: c.root, scriptPath: SCRIPT, check: true });
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), before, '--check is read-only (INV-7)');
  } finally {
    c.cleanup();
  }
});

// ===========================================================================
// WP-5 / AC1 — the execution controller joins the managed set, ADDITIVELY
// ===========================================================================
// D-C C-6's composed table. The Stop entry is ADDED beside the two pre-existing
// non-Governor entries; U2 proved multiple Stop matcher groups all fire and that
// a sibling's stray stdout does not suppress another hook's decision, so nothing
// needs moving, reordering or removing.

// The real shape of Warwick's machine, reduced to what this criterion is about:
// Tower's `Stop` hook and the capture-gateway `SessionStart` hook, both
// non-Governor, both of which must come through untouched.
function makeRealShapedCheckout({ towerTargetExists = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'governor-hooks-real-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  mkdirSync(join(root, 'services'), { recursive: true });
  const fwd = root.replace(/\\/g, '/');
  writeFileSync(join(root, 'services', 'ensure-capture-gateway.mjs'), '// exists\n');
  const towerTarget = towerTargetExists
    ? `${fwd}/services/bridge-ingest.mjs`
    : `${fwd}/services/GONE/bridge-ingest.mjs`;
  if (towerTargetExists) writeFileSync(join(root, 'services', 'bridge-ingest.mjs'), '// exists\n');

  const towerCommand = `node --env-file=C:/.fusion247/control-plane-dev.env ${towerTarget}`;
  const gatewayCommand = `node ${fwd}/services/ensure-capture-gateway.mjs`;

  writeFileSync(
    settingsPath(root),
    JSON.stringify(
      {
        permissions: { allow: ['Bash(git status)'] },
        hooks: {
          [STOP_EVENT]: [{ matcher: '', hooks: [{ type: 'command', command: towerCommand }] }],
          [HOOK_EVENT]: [{ hooks: [{ type: 'command', command: gatewayCommand }] }],
        },
      },
      null,
      2
    ) + '\n'
  );
  return { root, towerCommand, gatewayCommand, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const stopCommandsOf = (doc) => (doc.hooks?.[STOP_EVENT] ?? []).flatMap((g) => g.hooks.map((h) => h.command));

test('AC1: the sibling rule derives the stop-controller from the reorientation script', () => {
  assert.equal(stopControllerScriptFor(SCRIPT), 'C:/Fusion247PKA-governor/tools/governor/stop-controller.mjs');
  assert.equal(stopControllerScriptFor('C:/x/something-else.mjs'), null, 'and never invents one');
});

test("AC1: the Stop command is D-C C-6's, verbatim, including --estate", () => {
  const script = 'C:/gov/tools/governor/stop-controller.mjs';
  const cmd = stopHookCommand(script, 'C:/Estate');
  assert.equal(cmd, `node ${script} --estate C:/Estate`);
  assert.equal(stopHookCommand(script), `node ${script}`);
  assert.ok(isStopControllerHook({ command: cmd }));
  assert.ok(!isStopControllerHook({ command: 'node C:/gov/reorient.mjs' }), 'and never matches a sibling');
  assert.ok(cmd.includes(STOP_MARKER));
});

test('AC1: the Stop entry is INSTALLED, with no matcher key at all', () => {
  const c = makeRealShapedCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const governorGroup = doc.hooks[STOP_EVENT].find((g) => g.hooks.some((h) => isStopControllerHook(h)));
    assert.ok(governorGroup, 'the execution controller must be present on Stop');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(governorGroup, 'matcher'),
      'the key is OMITTED, not written as "" or "*" — a matcher-less entry is what fires on every stop'
    );
    assert.equal(r.report.events.stopController.added, true);
  } finally {
    c.cleanup();
  }
});

test('AC1: the pre-existing Tower Stop hook and capture-gateway SessionStart hook survive UNTOUCHED', () => {
  const c = makeRealShapedCheckout();
  try {
    installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));

    const stops = stopCommandsOf(doc);
    assert.ok(stops.includes(c.towerCommand), 'Tower\'s hook must survive byte-identically');
    assert.equal(doc.hooks[STOP_EVENT][0].hooks[0].command, c.towerCommand, 'and must not be REORDERED');
    assert.equal(doc.hooks[STOP_EVENT][0].matcher, '', 'nor have its own matcher rewritten');
    assert.ok(stops.some((cmd) => cmd.includes(STOP_MARKER)), 'the governor sits beside it, not instead of it');

    const sessions = hooksFor(doc, HOOK_EVENT).map((h) => h.command);
    assert.ok(sessions.includes(c.gatewayCommand), 'the capture-gateway hook must survive too');
  } finally {
    c.cleanup();
  }
});

test('AC1: a DANGLING Tower-shaped Stop hook is NOT pruned — the governor adds to Stop, never deletes from it', () => {
  // THE case this exemption exists for. D-C C-6: the Tower hook "must not be
  // moved, must not be reordered, and must not be removed". Before WP-5 the
  // governor managed no Stop hook, so the Q-5 prune rule never reached that
  // event; adding the controller without the exemption would have made the
  // installer DELETE the very hook it was being changed to sit beside.
  const c = makeRealShapedCheckout({ towerTargetExists: false });
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.ok(stopCommandsOf(doc).includes(c.towerCommand), 'a dangling Tower hook must STILL survive');
    assert.equal(
      r.report.pruned.filter((p) => p.event === STOP_EVENT).length,
      0,
      'nothing may ever be pruned from Stop'
    );
    assert.ok(r.report.pruneSkipped > 0, 'and the report must record that it was examined but not target-tested');
    assert.ok(r.report.pruneExemptEvents.includes(STOP_EVENT));
  } finally {
    c.cleanup();
  }
});

test('AC1 REPORT INTEGRITY: with an exempt event present, the report never claims to have checked ALL examined hooks', () => {
  // The AC5 principle applied to the new exemption: a control that reports on
  // ground it did not examine is worse than no control.
  const c = makeRealShapedCheckout({ towerTargetExists: false });
  try {
    const text = renderReport(installHooks({ checkout: c.root, scriptPath: SCRIPT }));
    assert.doesNotMatch(text, /CHECKED the target of all/, 'it did NOT check all of them');
    assert.match(text, /CHECKED the target of \d+ of \d+ examined hook\(s\)/);
    assert.match(text, /NOT target-tested/);
    assert.match(text, /never deletes from them/);
    // And it must never assert "every one exists" on the strength of a check
    // that examined nothing — a vacuous truth reads as a real assurance.
    if (/CHECKED the target of 0 of/.test(text)) {
      assert.doesNotMatch(text, /every one exists/, 'zero checked cannot support "every one exists"');
      assert.match(text, /i\.e\. NONE of them/);
    }
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// AC6 MUTATION for AC1 — the exemption is made to FAIL
// ---------------------------------------------------------------------------
// INV-5: a control is not evidence until it has been made to fail. The test above
// would pass just as happily if the exemption did nothing and the hook survived
// for some unrelated reason. This flips `prunable` to true in a copy of the
// module and proves the SAME fixture then loses Tower's hook.

test('AC6 MUTATION (AC1): flip the Stop spec to prunable and the dangling Tower hook IS deleted', async () => {
  const src = readFileSync(INSTALL_SRC, 'utf8').replace(/\r\n/g, '\n');
  const from = "      key: 'stopController',\n      prunable: false,";
  assert.ok(src.includes(from), 'mutation precondition failed — the Stop spec no longer reads as expected');
  const mutantPath = join(__dirname, `.mutant-install-hooks-${process.pid}.mjs`);
  writeFileSync(mutantPath, src.replace(from, "      key: 'stopController',\n      prunable: true,"));

  const c = makeRealShapedCheckout({ towerTargetExists: false });
  try {
    const mutant = await import(pathToFileURL(mutantPath).href);
    const r = mutant.installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));

    assert.ok(
      !stopCommandsOf(doc).includes(c.towerCommand),
      'MUTANT: without the exemption the Tower hook must be destroyed — if it survives here, ' +
        'the exemption is not what is protecting it and the control above proves nothing'
    );
    assert.equal(r.report.pruned.filter((p) => p.event === STOP_EVENT).length, 1);
  } finally {
    rmSync(mutantPath, { force: true });
    c.cleanup();
  }
});

// ===========================================================================
// WP-5 / AC2 — idempotence, and re-pointing rather than duplicating
// ===========================================================================

test('AC2: a second run is BYTE-IDENTICAL and reports no change', () => {
  const c = makeRealShapedCheckout();
  try {
    const first = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(first.changed, true, 'precondition: the first run must install something');
    const settled = readFileSync(settingsPath(c.root), 'utf8');

    const second = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(second.changed, false, 'a second run must be a no-op');
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), settled, 'and byte-identical');
    assert.equal(second.report.events.stopController.added, false, 'not re-added');
    assert.equal(second.report.events.stopController.replaced, false, 'and not re-pointed');
  } finally {
    c.cleanup();
  }
});

test('AC2: a STALE Stop entry is RE-POINTED, never duplicated', () => {
  const c = makeRealShapedCheckout();
  try {
    // Seed a governor Stop hook pointing at an old checkout, exactly what a
    // merge or a moved worktree produces.
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    doc.hooks[STOP_EVENT].push({
      hooks: [{ type: 'command', command: 'node C:/OLD-CHECKOUT/tools/governor/stop-controller.mjs --estate C:/OLD' }],
    });
    writeFileSync(settingsPath(c.root), JSON.stringify(doc, null, 2) + '\n');

    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const after = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const governorStops = stopCommandsOf(after).filter((cmd) => cmd.includes(STOP_MARKER));

    assert.equal(governorStops.length, 1, 'exactly ONE governor Stop hook — never a duplicate');
    assert.ok(!governorStops[0].includes('OLD-CHECKOUT'), 'and it points at the current script');
    assert.equal(governorStops[0], r.stopCommand);
    assert.equal(r.report.events.stopController.replaced, true, 're-pointed, not added');
    assert.ok(stopCommandsOf(after).includes(c.towerCommand), 'while Tower is still untouched');

    // ...and re-pointing is itself idempotent.
    const settled = readFileSync(settingsPath(c.root), 'utf8');
    installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), settled);
  } finally {
    c.cleanup();
  }
});

test('AC2: a fresh install onto an EMPTY settings file works and stays idempotent', () => {
  // "A fixture with an existing (possibly {}) settings file is the correct shape
  // for a fresh install" — the installer refuses to create the file itself.
  const root = mkdtempSync(join(tmpdir(), 'governor-hooks-fresh-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(settingsPath(root), '{}\n');
  try {
    const first = installHooks({ checkout: root, scriptPath: SCRIPT });
    assert.equal(first.ok, true);
    const doc = JSON.parse(readFileSync(settingsPath(root), 'utf8'));
    assert.ok(stopCommandsOf(doc).some((cmd) => cmd.includes(STOP_MARKER)));

    const settled = readFileSync(settingsPath(root), 'utf8');
    const second = installHooks({ checkout: root, scriptPath: SCRIPT });
    assert.equal(second.changed, false);
    assert.equal(readFileSync(settingsPath(root), 'utf8'), settled);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC1: the report names the Stop entry, so an install cannot be silent about it', () => {
  const c = makeRealShapedCheckout();
  try {
    const text = renderReport(installHooks({ checkout: c.root, scriptPath: SCRIPT }));
    assert.match(text, /Stop \(execution controller\)/);
    assert.match(text, /stop-controller\.mjs/);
  } finally {
    c.cleanup();
  }
});

// ===========================================================================
// WP-6 — the MATCHER is reconciled, not merely the command
// ===========================================================================
// THE DEFECT, and why it matters more than its size: WP-1 made the SessionStart
// spec matcher-less, and its tests proved that a FRESH install writes no matcher.
// Nothing tested the PRE-EXISTING-ENTRY path. So on every machine that already
// had a governor hook — including the one Warwick actually runs — the stale
// `matcher: "clear"` survived a successful install, reorientation stayed
// unreachable on `startup` and `resume`, and the installer printed
// "already present, unchanged" over it. 754 tests were green while it was true.
// It was found only by running the installer for real.
//
// The matcher lives on the enclosing GROUP, never on the hook, which is why
// every test below asserts on group shape rather than on hook shape.

const SS = HOOK_EVENT;

// The live defect, byte-for-byte: a governor SessionStart entry carrying the old
// `clear` matcher, with the CORRECT command (so the command axis is already
// reconciled and cannot be what fixes it).
function makeStaleMatcherCheckout() {
  const root = mkdtempSync(join(tmpdir(), 'governor-hooks-stale-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(
    settingsPath(root),
    JSON.stringify(
      { hooks: { [SS]: [{ matcher: 'clear', hooks: [{ type: 'command', command: governorHookCommand(SCRIPT) }] }] } },
      null,
      2
    ) + '\n'
  );
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const ssGroupWithGovernor = (doc) => (doc.hooks?.[SS] || []).find((g) => (g.hooks || []).some(isGovernorHook));

test('WP-6 AC1: the LIVE defect — a stale `clear` matcher on an existing governor hook is REMOVED', () => {
  const c = makeStaleMatcherCheckout();
  try {
    const before = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(before.hooks[SS][0].matcher, 'clear', 'precondition: the fixture must carry the stale matcher');
    assert.equal(
      before.hooks[SS][0].hooks[0].command,
      governorHookCommand(SCRIPT),
      'precondition: the COMMAND is already correct, so only the matcher can be at fault'
    );

    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const after = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const group = ssGroupWithGovernor(after);

    assert.ok(group, 'the reorientation hook must still be installed');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(group, 'matcher'),
      'the stale matcher KEY must be gone, not merely set to something else'
    );
    assert.equal(r.report.events.governor.matcherNormalised, true, 'and the report must record that it changed');
    assert.equal(r.report.events.governor.matcherWas, 'clear');
    assert.equal(r.report.events.governor.matcherNow, undefined);
    assert.equal(r.report.matcherNormalised, true);
    assert.equal(r.report.events.governor.added, false, 'it was neither newly added...');
    assert.equal(r.report.events.governor.replaced, false, '...nor re-pointed — the command never moved');
  } finally {
    c.cleanup();
  }
});

test('WP-6 AC2: the report tells the truth — never "already present, unchanged" over a normalisation', () => {
  const c = makeStaleMatcherCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const text = renderReport(r);
    const line = text.split('\n').find((l) => l.includes(`${SS} (reorientation`));

    assert.doesNotMatch(line, /already present, unchanged/, 'the exact lie this criterion exists to end');
    assert.match(line, /MATCHER NORMALISED/);
    // AC2 — its own visible line, naming BOTH values. "Something changed" without
    // saying what changed is how the old report was true and useless at once.
    assert.match(text, /matcher: "clear" → no matcher \(key absent\)/);
  } finally {
    c.cleanup();
  }
});

test('WP-6 AC2: a genuinely identical hook STILL reports "already present, unchanged"', () => {
  // The other half of AC2. A report that shouted about every run would be just as
  // useless as one that stayed silent, and would train the reader to ignore it.
  const c = makeStaleMatcherCheckout();
  try {
    installHooks({ checkout: c.root, scriptPath: SCRIPT }); // settles everything
    const second = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const line = renderReport(second)
      .split('\n')
      .find((l) => l.includes(`${SS} (reorientation`));

    assert.match(line, /already present, unchanged/);
    assert.equal(second.report.matcherNormalised, false);
    assert.doesNotMatch(renderReport(second), /matcher: .* → /, 'and no old→new line when nothing moved');
  } finally {
    c.cleanup();
  }
});

test('WP-6 AC4: normalising once then re-running is BYTE-IDENTICAL and reports changed:false', () => {
  const c = makeStaleMatcherCheckout();
  try {
    const first = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(first.changed, true, 'precondition: the first run must actually normalise something');
    const settled = readFileSync(settingsPath(c.root), 'utf8');

    const second = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    assert.equal(second.changed, false, 'a normalisation must not re-fire forever');
    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), settled, 'and the file must be byte-identical');
    assert.equal(second.report.events.governor.matcherNormalised, false);
  } finally {
    c.cleanup();
  }
});

test('WP-6 AC1 INVERSE: a spec that HAS a matcher normalises a live entry that differs', () => {
  // The mirror case. The SessionStart spec removes a key; a PreToolUse spec must
  // equally be able to CORRECT one, or the reconciliation is only half a rule.
  const guard = guardHookCommand(guardScriptFor(SCRIPT), 'C:/Estate');
  const settings = { hooks: { [GUARD_EVENT]: [{ matcher: 'Bash', hooks: [{ type: 'command', command: guard }] }] } };
  const { settings: next, report } = planSettings(settings, { scriptPath: SCRIPT, estate: 'C:/Estate', cwd: '/tmp' });

  const group = next.hooks[GUARD_EVENT].find((g) => (g.hooks || []).some(isGuardHook));
  assert.equal(group.matcher, GUARD_MATCHER, 'the narrow live matcher must be widened to the managed spec');
  assert.equal(report.events.guard.matcherNormalised, true);
  assert.equal(report.events.guard.matcherWas, 'Bash');
  assert.equal(report.events.guard.matcherNow, GUARD_MATCHER);
  assert.equal(report.events.guard.added, false, 'normalised in place, not re-added as a duplicate');
  assert.equal(
    next.hooks[GUARD_EVENT].filter((g) => (g.hooks || []).some(isGuardHook)).length,
    1,
    'and exactly one guard group survives'
  );
});

test('WP-6 AC1 INVERSE: a spec that has a matcher SETS one that is missing entirely', () => {
  const guard = guardHookCommand(guardScriptFor(SCRIPT), 'C:/Estate');
  const settings = { hooks: { [GUARD_EVENT]: [{ hooks: [{ type: 'command', command: guard }] }] } };
  const { settings: next, report } = planSettings(settings, { scriptPath: SCRIPT, estate: 'C:/Estate', cwd: '/tmp' });

  const group = next.hooks[GUARD_EVENT].find((g) => (g.hooks || []).some(isGuardHook));
  assert.equal(group.matcher, GUARD_MATCHER, 'an absent matcher on a spec that needs one is itself a difference');
  assert.equal(report.events.guard.matcherNormalised, true);
  assert.equal(report.events.guard.matcherWasPresent, false);
});

test('WP-6 AC1: comparison is EXACT — "" and "*" are not "no matcher" and are both removed', () => {
  // WP-1's spec comment says the entry carries no matcher key "not '', not '*'".
  // A comparison that treated either as equivalent to absent would leave the live
  // file in a shape the spec explicitly forbids while reporting success.
  for (const stale of ['', '*']) {
    const settings = {
      hooks: { [SS]: [{ matcher: stale, hooks: [{ type: 'command', command: governorHookCommand(SCRIPT) }] }] },
    };
    const { settings: next, report } = planSettings(settings, { scriptPath: SCRIPT, cwd: '/tmp' });
    const group = ssGroupWithGovernor(next);
    assert.ok(
      !Object.prototype.hasOwnProperty.call(group, 'matcher'),
      `a matcher of ${JSON.stringify(stale)} must be removed, not accepted as equivalent to absent`
    );
    assert.equal(report.events.governor.matcherNormalised, true);
    assert.equal(report.events.governor.matcherWas, stale);
  }
});

// ---------------------------------------------------------------------------
// WP-6 AC3 — still additive, still non-destructive
// ---------------------------------------------------------------------------

test('WP-6 AC3: a SHARED group is never matcher-rewritten — the governor hook is EXTRACTED instead', () => {
  // The reason the rule is per-group-with-an-ownership-test rather than a blanket
  // in-place mutation. Rewriting this group's matcher would silently re-scope a
  // foreign hook that never asked for it.
  const foreign = 'node C:/somebody-elses/keeper.mjs';
  const settings = {
    hooks: {
      [SS]: [
        {
          matcher: 'clear',
          hooks: [
            { type: 'command', command: governorHookCommand(SCRIPT) },
            { type: 'command', command: foreign },
          ],
        },
      ],
    },
  };
  // `exists: () => true` keeps the pruner out of it: this test is about the
  // matcher rule, and a foreign hook deleted for a dangling target would prove
  // nothing about it.
  const { settings: next, report } = planSettings(settings, { scriptPath: SCRIPT, cwd: '/tmp', exists: () => true });

  const shared = next.hooks[SS][0];
  assert.equal(shared.matcher, 'clear', "the foreign hook's group keeps its own matcher, untouched");
  assert.deepEqual(
    shared.hooks.map((h) => h.command),
    [foreign],
    'the foreign hook survives exactly as found'
  );

  const governorGroup = next.hooks[SS].find((g) => (g.hooks || []).some(isGovernorHook));
  assert.notEqual(governorGroup, shared, 'the governor hook moved OUT of the shared group');
  assert.ok(
    !Object.prototype.hasOwnProperty.call(governorGroup, 'matcher'),
    'and into a group carrying the managed spec — here, no matcher at all'
  );
  assert.equal(report.events.governor.matcherNormalised, true);
  assert.equal(report.events.governor.matcherExtracted, true);
});

test('WP-6 AC2: an EXTRACTION is reported as a move, never as a new activation', () => {
  // An extracted hook travels through the add path, so without care the report
  // would call a move "ADDED (newly activated)" — a fresh instance of exactly the
  // defect this WP exists to end, in a new place.
  const c = makeCheckout(); // seeds services/real-hook.mjs, whose target EXISTS
  try {
    const foreign = `node ${c.root.replace(/\\/g, '/')}/services/real-hook.mjs`;
    writeFileSync(
      settingsPath(c.root),
      JSON.stringify(
        {
          hooks: {
            [SS]: [
              {
                matcher: 'clear',
                hooks: [
                  { type: 'command', command: governorHookCommand(SCRIPT) },
                  { type: 'command', command: foreign },
                ],
              },
            ],
          },
        },
        null,
        2
      ) + '\n'
    );

    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const text = renderReport(r);
    const line = text.split('\n').find((l) => l.includes(`${SS} (reorientation`));

    assert.match(line, /MATCHER NORMALISED \(moved to its own group\)/);
    assert.doesNotMatch(line, /newly activated/, 'a move is not an activation');
    assert.doesNotMatch(line, /already present, unchanged/);
    assert.match(text, /extracted into its own group; the group it shared was left untouched/);

    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(doc.hooks[SS][0].matcher, 'clear', "the foreign group's matcher is still its own");
    assert.deepEqual(doc.hooks[SS][0].hooks.map((h) => h.command), [foreign]);
    assert.equal(
      (doc.hooks[SS] || []).filter((g) => (g.hooks || []).some(isGovernorHook)).length,
      1,
      'exactly ONE governor SessionStart group — an extraction must never duplicate'
    );
  } finally {
    c.cleanup();
  }
});

test('WP-6 AC3: non-governor hooks and the Stop exemption are untouched by matcher reconciliation', () => {
  // The two things WP-5 fought for, re-asserted against THIS change: Tower's Stop
  // hook (matcher "", dangling target) and the capture-gateway SessionStart hook.
  const c = makeRealShapedCheckout({ towerTargetExists: false });
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));

    assert.equal(doc.hooks[STOP_EVENT][0].matcher, '', "Tower's own matcher must NOT be rewritten");
    assert.equal(doc.hooks[STOP_EVENT][0].hooks[0].command, c.towerCommand, 'nor its command, nor its position');
    assert.ok(stopCommandsOf(doc).includes(c.towerCommand), 'and a DANGLING Tower hook still survives');
    assert.equal(r.report.pruned.filter((p) => p.event === STOP_EVENT).length, 0, 'nothing pruned from Stop');
    assert.ok(hooksFor(doc, HOOK_EVENT).some((h) => h.command === c.gatewayCommand), 'the gateway hook survives');

    const gatewayGroup = (doc.hooks[HOOK_EVENT] || []).find((g) =>
      (g.hooks || []).some((h) => h.command === c.gatewayCommand)
    );
    assert.ok(
      !Object.prototype.hasOwnProperty.call(gatewayGroup, 'matcher'),
      "a foreign group's matcher state is left exactly as found"
    );
  } finally {
    c.cleanup();
  }
});

test('WP-6 AC3: normalisation never deletes a group, even one it empties', () => {
  // A4, held deliberately. Introducing group deletion would add a destructive
  // edge no decision asked for — the precise mistake WP-5's Stop exemption exists
  // to prevent. An emptied group is left behind, exactly as the pruner leaves one.
  const settings = {
    hooks: { [SS]: [{ matcher: 'clear', hooks: [{ type: 'command', command: governorHookCommand(SCRIPT) }] }] },
  };
  const { settings: next } = planSettings(settings, { scriptPath: SCRIPT, cwd: '/tmp' });
  assert.equal(next.hooks[SS].length, 1, 'the exclusive case normalises IN PLACE — no group is added or removed');
});

test('WP-6: --check reports a matcher normalisation as a PROPOSAL and writes nothing', () => {
  const c = makeStaleMatcherCheckout();
  try {
    const before = readFileSync(settingsPath(c.root), 'utf8');
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT, check: true });
    const text = renderReport(r);

    assert.equal(readFileSync(settingsPath(c.root), 'utf8'), before, '--check is read-only (INV-7)');
    assert.match(text, /its MATCHER would be NORMALISED/);
    assert.doesNotMatch(text, /already present, unchanged.*\n.*reorient/, 'and never calls the difference no difference');
  } finally {
    c.cleanup();
  }
});

// ---------------------------------------------------------------------------
// WP-6 AC5 — THE MUTATION. INV-5: a control is not evidence until made to fail.
// ---------------------------------------------------------------------------
// This is the criterion that matters. The defect existed precisely because
// nothing exercised the pre-existing-entry path, so a test that passes for some
// unrelated reason would leave the estate exactly where it started. This disables
// the matcher COMPARISON in a copy of the module and proves the same fixture then
// keeps its stale `clear` matcher and reports "already present, unchanged".

test('WP-6 AC5 MUTATION: disable the matcher comparison and the stale `clear` matcher SURVIVES', async () => {
  const src = readFileSync(INSTALL_SRC, 'utf8').replace(/\r\n/g, '\n');
  const from =
    '      spec.matcher === undefined ? !hasMatcherKey(g) : hasMatcherKey(g) && g.matcher === spec.matcher;';
  assert.ok(src.includes(from), 'mutation precondition failed — the matcher comparison no longer reads as expected');
  const mutantPath = join(__dirname, `.mutant-wp6-install-hooks-${process.pid}.mjs`);
  writeFileSync(mutantPath, src.replace(from, '      true; // MUTANT: matcher comparison disabled'));

  const c = makeStaleMatcherCheckout();
  try {
    const mutant = await import(pathToFileURL(mutantPath).href);
    const r = mutant.installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    const group = (doc.hooks[SS] || []).find((g) => (g.hooks || []).some((h) => h.command.includes(GOVERNOR_MARKER)));

    assert.equal(
      group.matcher,
      'clear',
      'MUTANT: without the comparison the stale matcher must survive — if it is normalised here, ' +
        'the comparison is not what is fixing it and the tests above prove nothing'
    );
    assert.equal(r.report.matcherNormalised, false, 'MUTANT: and the installer must not claim it normalised anything');
    assert.match(
      mutant.renderReport(r).split('\n').find((l) => l.includes(`${SS} (reorientation`)),
      /already present, unchanged/,
      'MUTANT: reproducing the exact false report this WP was raised to end'
    );
  } finally {
    rmSync(mutantPath, { force: true });
    c.cleanup();
  }
});
