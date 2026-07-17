// F-HIGH-01 — Larry adapter command-injection controls (BUILD-010 WP0 remediation).
//
// Proves the two properties Vex required to close the finding:
//   1. the Larry spawn uses shell:false (Node never hands a command line to
//      cmd.exe, so shell metacharacters can never break out), AND
//   2. the (untrusted-influenced) prompt is delivered on STDIN, never as an argv
//      element — so a malicious boundedContext.task value stays an inert prompt
//      token and no second command is ever constructed.
//
// Uses a recording fake spawn that captures the EXACT bin/argv/options/stdin of
// every invocation. No real process is launched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { createLarryAdapter } from '../src/adapters/larryAdapter.js';

// Records every spawn: { bin, argv, options, stdin }. `plan(argv)` returns the
// scripted { stdout, stderr, code }.
function recordingSpawn(records, plan) {
  return function spawn(bin, argv, options) {
    const rec = { bin, argv, options, stdin: '' };
    records.push(rec);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: (d) => { rec.stdin += d.toString(); }, end: () => {} };
    child.kill = () => {};
    let outcome;
    try { outcome = plan(argv, bin); }
    catch (e) { setImmediate(() => child.emit('error', e)); return child; }
    setImmediate(() => {
      if (outcome.stdout) child.stdout.emit('data', Buffer.from(outcome.stdout));
      if (outcome.stderr) child.stderr.emit('data', Buffer.from(outcome.stderr));
      child.emit('close', outcome.code ?? 0);
    });
    return child;
  };
}

const RUN = { run_id: 'r1', scope: 'docs typo', evidence_commit_sha: 'abc123' };
const TURN = { ordinal: 1, bounded_context_ref: { task: 'review the doc' } };
const OKJSON = JSON.stringify({ result: '{"summary":"ok","proposed_action":{"type":"noop"},"confidence":0.5}', usage: { output_tokens: 1 } });

function planClaude(argv) {
  if (argv.includes('--version')) return { stdout: '2.1.0 (Claude Code)', code: 0 };
  return { stdout: OKJSON, code: 0 };
}

test('F-HIGH-01: every larry spawn uses shell:false and the prompt rides on STDIN (never argv)', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: 'y'.repeat(40) });
  const records = [];
  const spawn = recordingSpawn(records, planClaude);
  const adapter = createLarryAdapter({ config, spawn });

  await adapter.runTurn({ run: RUN, turn: TURN, boundedContext: { task: 'review the doc' } });

  // No spawn anywhere uses a shell.
  for (const r of records) {
    assert.equal(r.options?.shell, false, `spawn of "${r.bin}" ${JSON.stringify(r.argv)} MUST be shell:false`);
  }

  // The `-p` run (not the --version probe) delivers the prompt on stdin.
  const runRec = records.find((r) => r.argv.includes('-p'));
  assert.ok(runRec, 'the -p headless run spawned');
  assert.ok(runRec.stdin.includes('review the doc'), 'prompt (task) delivered on STDIN');
  assert.ok(/You are Larry/.test(runRec.stdin), 'the full bounded prompt is on STDIN');
  for (const a of runRec.argv) {
    assert.ok(!/review the doc/.test(a), `prompt text must NOT appear on argv element "${a}"`);
  }
  // argv is the fixed, trusted flag set — no prompt argument present.
  assert.deepEqual(runRec.argv, [
    '-p', '--output-format', 'json', '--permission-mode', 'plan',
    '--allowedTools', 'Read,Grep,Glob,Edit,Write,Bash(git diff:*),Bash(git log:*),Bash(git status:*)',
  ]);
});

test('F-HIGH-01: injection payload in boundedContext.task stays an inert STDIN token — no breakout, no second command, no pwned.txt', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_LARRY: 'y'.repeat(40) });
  const records = [];
  const spawn = recordingSpawn(records, planClaude);
  const adapter = createLarryAdapter({ config, spawn });

  const PAYLOAD = 'x & echo INJECTED > pwned.txt';
  const pwned = path.join(process.cwd(), 'pwned.txt');
  const existedBefore = fs.existsSync(pwned);

  await adapter.runTurn({ run: RUN, turn: TURN, boundedContext: { task: PAYLOAD } });

  const runRec = records.find((r) => r.argv.includes('-p'));
  assert.ok(runRec, 'the -p headless run spawned');

  // The payload appears ONLY inside the stdin prompt body — as inert prompt text.
  assert.ok(runRec.stdin.includes(PAYLOAD), 'payload carried verbatim as an inert STDIN prompt token');
  // It never reaches argv, so cmd.exe never parses `& echo ... > pwned.txt`.
  for (const a of runRec.argv) {
    assert.ok(!a.includes('echo INJECTED'), `payload must not reach argv element "${a}"`);
    assert.ok(!a.includes('pwned'), `payload must not reach argv element "${a}"`);
    assert.ok(!a.includes('&'), `no shell metacharacter on argv element "${a}"`);
  }
  // shell:false means Node never builds a cmd.exe command line at all.
  assert.equal(runRec.options?.shell, false, 'shell:false — cmd.exe never parses the payload');

  // Exactly ONE run command was constructed (the --version probe + one -p run).
  const runCommands = records.filter((r) => !r.argv.includes('--version'));
  assert.equal(runCommands.length, 1, 'exactly one run command constructed — no injected second command');

  // The breakout, had it worked, would have created pwned.txt. It must not exist.
  assert.equal(fs.existsSync(pwned), existedBefore, 'no pwned.txt created by a breakout');
});
