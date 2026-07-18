import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGithubEvidence, assertReadOnlyCommand } from '../src/githubEvidence.js';

const HEAD = '1390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900';
const BASE = '0000000aaaabbbbccccddddeeeeffff1111222233';

// A fake runCmd that answers git/gh from a scripted table.
function fakeRunner(table) {
  const calls = [];
  return {
    calls,
    runCmd(bin, args) {
      calls.push({ bin, args });
      const key = `${bin} ${args.join(' ')}`;
      for (const [re, out] of table) if (re.test(key)) return Promise.resolve(out);
      return Promise.resolve({ code: 0, stdout: '', stderr: '' });
    },
  };
}

test('collect — verifies head, diff range, changed files, CI', async () => {
  const r = fakeRunner([
    [/rev-parse --verify --quiet .*\^\{commit\}/, { code: 0, stdout: HEAD, stderr: '' }],
    [/rev-parse --verify --quiet build-/, { code: 0, stdout: HEAD, stderr: '' }],
    [/diff --name-only/, { code: 0, stdout: 'a.js\nb.js', stderr: '' }],
    [/gh api .*check-runs/, { code: 0, stdout: JSON.stringify({ check_runs: [{ name: 'ci', status: 'completed', conclusion: 'success' }] }), stderr: '' }],
  ]);
  const gh = createGithubEvidence({ repoDir: '/repo', repo: 'o/r', runCmd: r.runCmd });
  const ev = await gh.collect({ branch: 'build-010/wp1', headSha: HEAD, baseSha: BASE });
  assert.equal(ev.ok, true, ev.error ?? '');
  assert.deepEqual(ev.changedFiles, ['a.js', 'b.js']);
  assert.equal(ev.checks[0].conclusion, 'success');
  assert.equal(ev.diffRange, `${BASE}..${HEAD}`);
});

test('collect — fail-closed when head_sha does not resolve', async () => {
  const r = fakeRunner([[/rev-parse --verify --quiet .*\^\{commit\}/, { code: 1, stdout: '', stderr: 'bad object' }]]);
  const gh = createGithubEvidence({ repoDir: '/repo', runCmd: r.runCmd });
  const ev = await gh.collect({ branch: 'b', headSha: HEAD });
  assert.equal(ev.ok, false);
  assert.match(ev.error, /does not resolve/);
});

test('collect — fail-closed on missing/invalid head_sha', async () => {
  const gh = createGithubEvidence({ repoDir: '/repo', runCmd: () => Promise.resolve({ code: 0, stdout: '' }) });
  const ev = await gh.collect({ branch: 'b', headSha: 'not-a-sha!!' });
  assert.equal(ev.ok, false);
  assert.match(ev.error, /missing\/invalid head_sha/);
});

test('read-only allowlist — mutating git verbs are REFUSED (no autonomous merge)', () => {
  assert.throws(() => assertReadOnlyCommand('git', ['merge', 'main']), /REFUSED mutating git verb "merge"/);
  assert.throws(() => assertReadOnlyCommand('git', ['push', 'origin']), /REFUSED mutating git verb "push"/);
  assert.throws(() => assertReadOnlyCommand('gh', ['pr', 'merge', '42']), /only "gh api" is permitted/);
  assert.throws(() => assertReadOnlyCommand('gh', ['api', '-X', 'POST', 'x']), /write method/);
  assert.throws(() => assertReadOnlyCommand('rm', ['-rf', '/']), /not permitted/);
  // read commands pass
  assert.equal(assertReadOnlyCommand('git', ['diff', '--name-only']), true);
  assert.equal(assertReadOnlyCommand('gh', ['api', 'repos/o/r/commits/x/check-runs']), true);
});
