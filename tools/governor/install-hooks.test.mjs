import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  delegationObserverHookCommand,
  delegationGateHookCommand,
  delegationScriptFor,
  isGovernorHook,
  isGuardHook,
  isDelegationObserverHook,
  isDelegationGateHook,
  hookTargets,
  danglingTargets,
  planSettings,
  installHooks,
  renderReport,
  HOOK_EVENT,
  GUARD_EVENT,
  GUARD_MATCHER,
  DELEGATION_OBSERVER_MATCHER,
  DELEGATION_GATE_MATCHER,
  GOVERNOR_MARKER,
  GUARD_MARKER,
  DELEGATION_MARKER,
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
// Delegation ledger + substantial-work threshold gate — wired in as a
// third/composed entry on the SAME PreToolUse pattern worktree-guard's own
// gate already uses, without touching worktree-guard.mjs itself.
// ---------------------------------------------------------------------------

test('delegationScriptFor derives the sibling, and refuses to guess from an unrelated path', () => {
  assert.equal(delegationScriptFor('C:/x/tools/governor/reorient.mjs'), 'C:/x/tools/governor/delegation-gate.mjs');
  assert.equal(delegationScriptFor('C:\\x\\tools\\governor\\reorient.mjs'), 'C:/x/tools/governor/delegation-gate.mjs');
  assert.equal(delegationScriptFor('C:/x/something-else.mjs'), null, 'no guess, no delegation gate');
  assert.equal(delegationObserverHookCommand('C:/d.mjs', 'C:/estate'), 'node C:/d.mjs observe --estate C:/estate');
  assert.equal(delegationObserverHookCommand('C:/d.mjs', null), 'node C:/d.mjs observe');
  assert.equal(delegationGateHookCommand('C:/d.mjs', 'C:/estate'), 'node C:/d.mjs check --estate C:/estate');
  assert.equal(delegationGateHookCommand('C:/d.mjs', null), 'node C:/d.mjs check');
});

test('isDelegationObserverHook and isDelegationGateHook tell the two subcommands of the SAME script apart', () => {
  const observer = { command: 'node C:/x/tools/governor/delegation-gate.mjs observe --estate C:/estate' };
  const gate = { command: 'node C:/x/tools/governor/delegation-gate.mjs check --estate C:/estate' };
  assert.equal(isDelegationObserverHook(observer), true);
  assert.equal(isDelegationObserverHook(gate), false);
  assert.equal(isDelegationGateHook(gate), true);
  assert.equal(isDelegationGateHook(observer), false);
  assert.ok(observer.command.includes(DELEGATION_MARKER) && gate.command.includes(DELEGATION_MARKER));
});

test('one install ships ALL FOUR governor hooks: SessionStart brief, wrong-worktree gate, delegation observer, delegation threshold gate', () => {
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));

    const observerHooks = hooksFor(doc, GUARD_EVENT).filter(isDelegationObserverHook);
    assert.equal(observerHooks.length, 1, 'exactly one delegation observer hook');
    assert.ok(observerHooks[0].command.includes('observe'));
    assert.ok(observerHooks[0].command.includes('--estate'));

    const gateHooks = hooksFor(doc, GUARD_EVENT).filter(isDelegationGateHook);
    assert.equal(gateHooks.length, 1, 'exactly one delegation threshold gate hook');
    assert.ok(gateHooks[0].command.includes('check'));
    assert.ok(gateHooks[0].command.includes('--estate'));

    const observerGroup = doc.hooks[GUARD_EVENT].find((g) => (g.hooks || []).some(isDelegationObserverHook));
    assert.equal(observerGroup.matcher, DELEGATION_OBSERVER_MATCHER);

    const gateGroup = doc.hooks[GUARD_EVENT].find((g) => (g.hooks || []).some(isDelegationGateHook));
    assert.equal(gateGroup.matcher, DELEGATION_GATE_MATCHER);
    assert.ok(!DELEGATION_GATE_MATCHER.split('|').includes('NotebookEdit'), 'the threshold gate must NOT govern NotebookEdit');
    for (const tool of ['Write', 'Edit', 'MultiEdit', 'Bash']) {
      assert.ok(DELEGATION_GATE_MATCHER.split('|').includes(tool));
    }

    // worktree-guard's own gate is still installed too — this is additive, not a replacement.
    assert.equal(hooksFor(doc, GUARD_EVENT).filter(isGuardHook).length, 1);
    assert.equal(hooksFor(doc, HOOK_EVENT).filter(isGovernorHook).length, 1);

    assert.equal(r.report.events.delegationObserver.added, true);
    assert.equal(r.report.events.delegationGate.added, true);
  } finally {
    c.cleanup();
  }
});

test('X-2: installing all four hooks is idempotent — the second and third runs write nothing', () => {
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

test('MUTATION: the delegation observer and gate hooks are never pruned by the Q-5 rule, even before delegation-gate.mjs exists on disk', () => {
  const c = makeCheckout();
  try {
    const nowhere = 'C:/definitely/not/here/tools/governor/reorient.mjs';
    const r = installHooks({ checkout: c.root, scriptPath: nowhere });
    const doc = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(hooksFor(doc, GUARD_EVENT).filter(isDelegationObserverHook).length, 1);
    assert.equal(hooksFor(doc, GUARD_EVENT).filter(isDelegationGateHook).length, 1);
    assert.ok(
      !r.report.pruned.some((p) => p.command.includes(DELEGATION_MARKER)),
      'the delegation hooks must never prune themselves — a fresh clone installs before it builds'
    );

    installHooks({ checkout: c.root, scriptPath: nowhere });
    const again = JSON.parse(readFileSync(settingsPath(c.root), 'utf8'));
    assert.equal(hooksFor(again, GUARD_EVENT).filter(isDelegationObserverHook).length, 1);
    assert.equal(hooksFor(again, GUARD_EVENT).filter(isDelegationGateHook).length, 1);
  } finally {
    c.cleanup();
  }
});

test('REPORT INTEGRITY: a single unrelated PreToolUse hook is examined exactly ONCE, even though three specs (guard, delegation observer, delegation gate) share that event', () => {
  // This pins the fix that made multiple specs safely share one event: before
  // it, each spec re-scanned every group already pushed by an earlier spec
  // THIS run, inflating `examined`/`kept` for hooks that were already
  // accounted for. Proven here with a genuinely pre-existing, unrelated
  // PreToolUse hook that has nothing to do with any governor spec.
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

test('the report names the delegation hooks in renderReport output', () => {
  const c = makeCheckout();
  try {
    const r = installHooks({ checkout: c.root, scriptPath: SCRIPT });
    const text = renderReport(r);
    assert.match(text, /delegation-dispatch observer/);
    assert.match(text, /substantial-work threshold gate/);
    assert.match(text, /delegation-gate\.mjs observe/);
    assert.match(text, /delegation-gate\.mjs check/);
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
