// WO-2026-08-03-02 — no child process may pop a console window on Windows.
//
// `child_process` defaults `windowsHide` to FALSE, so every bare launch flashes a console
// window. This suite proves the option is present at the launches this service makes, and
// then closes the CLASS by enumeration rather than by inspection: "the ones I found" is not
// the same set as "the ones there are", and this defect survived exactly that gap.
//
// SCOPE, STATED PLAINLY: tower-baton is the DORMANT copy. The watcher that was flashing on
// Warwick's screen is services/control-plane/tower-loop, proven in its own suite. Nothing
// here changes what he sees today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

import { defaultRunCmd } from '../src/githubEvidence.js';
import { createCodexAdapter, verifyCodexInvocable } from '../src/codexAdapter.js';
import { fakeFsForSchema, codexJsonl } from '../test-helpers/fakes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(HERE, '..', 'src');
const TEST_DIR = HERE;

// The shared `fakeSpawn` helper captures only the child ENV, so it cannot answer this
// question. A local one captures the whole options object. (test-helpers/ is outside this
// Work Order's file surface, so it is read and reused, never edited.)
function capturingSpawn(calls, { stdout = '', code = 0, settle = true } = {}) {
  return (bin, argv, opts) => {
    calls.push({ bin, argv, opts });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write() {}, end() {} };
    child.kill = () => {};
    if (settle) {
      setImmediate(() => {
        if (stdout) child.stdout.emit('data', Buffer.from(stdout));
        child.emit('close', code);
      });
    }
    return child;
  };
}

// ── behavioural: the option actually reaches child_process ────────────────────

test('githubEvidence launches its git/gh child with windowsHide:true', async () => {
  const calls = [];
  const r = await defaultRunCmd('git', ['rev-parse', 'HEAD'], {
    cwd: process.cwd(), spawn: capturingSpawn(calls, { stdout: 'abc\n', code: 0 }),
  });
  // defaultRunCmd resolves { code, stdout, stderr } — assert it genuinely completed through
  // the fake, so this cannot pass on a launch that never happened.
  assert.equal(r.code, 0, 'the command must have actually run through the fake');
  assert.equal(r.stdout, 'abc\n', 'and its stdout must have been read back');
  assert.equal(calls.length, 1, `expected one launch, got ${calls.length}`);
  assert.equal(calls[0].bin, 'git');
  assert.equal(calls[0].opts?.windowsHide, true, 'this launch would pop a console window');
});

test('the codex version probe launches with windowsHide:true', async () => {
  const calls = [];
  await verifyCodexInvocable({
    codexBin: 'C:/fake/codex.exe', spawn: capturingSpawn(calls, { stdout: 'codex 1.0\n', code: 0 }),
  });
  assert.equal(calls.length, 1, `expected one launch, got ${calls.length}`);
  assert.equal(calls[0].opts?.windowsHide, true, 'the version probe would pop a console window');
});

test('the codex QA turn launches its child with windowsHide:true', async () => {
  const calls = [];
  const result = { verdict: 'approve', summary: 'ok', claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' } };
  const codex = createCodexAdapter({
    config: { signingSecret: () => null },
    spawn: capturingSpawn(calls, { stdout: codexJsonl(result), code: 0 }),
    resolveBin: () => ({ path: 'C:/fake/codex.exe', source: 'test', error: null }),
    authProbe: () => ({ authenticated: true, method: 'chatgpt-oauth' }),
    fs: fakeFsForSchema(),
  });
  const turn = await codex.runTurn({
    checkpoint: { checkpoint_id: 'cp-1', head_sha: 'abc' }, packet: { head_sha: 'abc' },
    skillText: 'skill', promptFingerprint: 'fp',
  });
  assert.equal(turn.ok, true, 'the turn must have reached the child, not fail-closed before it');
  assert.equal(calls.length, 1, `expected one launch, got ${calls.length}`);
  assert.equal(calls[0].opts?.windowsHide, true, 'the codex QA child would pop a console window');
});

// ── enumeration: the class, not the instances ─────────────────────────────────
//
// Test-only. Ships nothing, adds no dependency, touches no runtime path.
// `exec` matches only as a BARE identifier, so `RegExp#exec` and `db.raw.exec` (property
// calls) are dropped by the lookbehind; a `(` must follow the name IMMEDIATELY, which keeps
// JSDoc prose such as "a fake spawn (child_process shape)" out of the count.

const CP_FNS = ['spawnSync', 'spawn', 'execFileSync', 'execFile', 'execSync', 'exec', 'fork'];
const CP_CALL_RE = new RegExp(`(?<![\\w$.])(${CP_FNS.join('|')})\\(`, 'g');

// Pinned literals, held HERE rather than derived from the sources they check — a count that
// recomputed itself would agree with anything. 3 in src/, 8 in test/, as of WO-2026-08-03-02;
// test/ moved to 10 during the #92/#93/#94 reconciliation rebase — retired.test.js (added on the
// #94 branch, predating this convention) had 2 bare spawnSync launches, now windowsHide:true.
const SRC_CP_SITES = 3;
const TEST_CP_SITES = 10;

function jsFilesUnder(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') jsFilesUnder(p, out); }
    else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
  }
  return out.sort();
}

/** Source between a call's `(` and its matching `)`, or null if it cannot be read.
 *  Strings AND comments are skipped — an apostrophe inside a comment otherwise reads as a
 *  string opener and swallows the rest of the file, silently hiding a real launch site. */
function cpArgSource(src, openIdx) {
  let depth = 0, q = null, esc = false, cmt = null;
  for (let i = openIdx; i < src.length; i += 1) {
    const c = src[i];
    if (cmt === 'line') { if (c === '\n') cmt = null; continue; }
    if (cmt === 'block') { if (c === '*' && src[i + 1] === '/') { cmt = null; i += 1; } continue; }
    if (q) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { cmt = 'line'; i += 1; continue; }
    if (c === '/' && src[i + 1] === '*') { cmt = 'block'; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '(') depth += 1;
    else if (c === ')') { depth -= 1; if (depth === 0) return src.slice(openIdx + 1, i); }
  }
  return null;
}

function scanChildProcessSites(files, root) {
  const sites = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const starts = [0];
    for (let i = 0; i < src.length; i += 1) if (src[i] === '\n') starts.push(i + 1);
    const lineOf = (idx) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= idx) lo = m; else hi = m - 1; } return lo + 1; };
    CP_CALL_RE.lastIndex = 0;
    let m;
    while ((m = CP_CALL_RE.exec(src)) !== null) {
      const args = cpArgSource(src, m.index + m[1].length);
      sites.push({
        rel: path.relative(root, file).replace(/\\/g, '/'), line: lineOf(m.index), fn: m[1],
        parsed: args != null,
        hidden: args != null && /windowsHide:\s*true/.test(args),
      });
    }
  }
  return sites;
}

function assertAllHidden(sites, expected, label) {
  const unparsed = sites.filter((s) => !s.parsed);
  assert.equal(unparsed.length, 0,
    `${label}: arguments unreadable at ${unparsed.map((s) => `${s.rel}:${s.line}`).join(', ')} — an unread site is NOT a covered site`);
  const bare = sites.filter((s) => !s.hidden);
  assert.equal(bare.length, 0,
    `${label}: bare child_process launches — ${bare.map((s) => `${s.rel}:${s.line} ${s.fn}`).join(', ')}`);
  assert.equal(sites.length, expected,
    `${label}: call-site count moved (found ${sites.length}, pinned ${expected}). Review the new/removed site, then update the literal:\n${sites.map((s) => `  ${s.rel}:${s.line} ${s.fn}`).join('\n')}`);
}

test(`ENUMERATION: all ${SRC_CP_SITES} child_process call sites under src/ carry windowsHide:true`, () => {
  assertAllHidden(scanChildProcessSites(jsFilesUnder(SRC_DIR), SRC_DIR), SRC_CP_SITES, 'src');
});

test(`ENUMERATION: all ${TEST_CP_SITES} child_process call sites under test/ carry windowsHide:true`, () => {
  assertAllHidden(scanChildProcessSites(jsFilesUnder(TEST_DIR), TEST_DIR), TEST_CP_SITES, 'test');
});

test('CONTROL: the enumeration scanner can actually SEE a bare site (it is not always-green)', () => {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'baton-scanprobe-'));
  try {
    // The call text is ASSEMBLED so this file never contains a literal `<fn>(` adjacency —
    // otherwise the test/ enumeration above would count these fixtures as real launch sites
    // and its pinned total would be a fiction.
    const call = (fn, rest) => `const x${fn} = ${fn}${'('}${rest}`;
    const f = path.join(probe, 'probe.js');
    fs.writeFileSync(f, [
      '/** @param {Function} [args.spawn]  a fake spawn (child_process shape). */',
      call('spawn', "'git', ['x'], { cwd, shell: false });"),
      call('spawnSync', "'gh', ['y'], { cwd, windowsHide: true });"),
      'const m = SOME_RE.exec(text);',
      "// the launcher's own apostrophe, which once broke argument reading",
      call('execFile', "'gh', ['z'], { maxBuffer: 1 }, (e) => {});"),
    ].join('\n'), 'utf8');

    const sites = scanChildProcessSites([f], probe);
    assert.equal(sites.length, 3, `expected exactly 3 real call sites, got ${sites.map((s) => `${s.line}:${s.fn}`).join(',')}`);
    assert.ok(sites.every((s) => s.parsed), 'every site must be readable, apostrophe-in-comment included');
    assert.deepEqual(sites.map((s) => s.hidden), [false, true, false],
      'the scanner must call the bare ones bare and the covered one covered');
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
});
