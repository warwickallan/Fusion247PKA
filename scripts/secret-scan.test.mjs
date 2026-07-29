// Proofs for scripts/secret-scan.sh — and specifically for the NEGATIVE property
// that surface mode exists to guarantee:
//
//     A PASS IS IMPOSSIBLE FOR GROUND THE SCANNER DID NOT READ.
//
// A control whose failure mode is "false green" is not proven by showing it
// green. Most of the assertions below are therefore refusals: unscannable
// target, empty target, symlinked ground, malformed invocation. The two positive
// cases prove it genuinely catches a planted secret on a surface that is NOT a
// git repository at all — the case default mode cannot cover.
//
// .mjs, not .js: scripts/ has no package.json, so the extension is what makes
// this ESM. Zero dependencies, node:test only, matching the house runner shape.
//
// NOTE ON FIXTURES: every secret-shaped probe is assembled at RUNTIME from
// fragments, so THIS SOURCE FILE contains no substring matching any scanner
// pattern. Otherwise the repo-wide default-mode scan would flag this very file
// once it is tracked — the same discipline used in
// services/tower-baton/test/secret-scan.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const SCRIPT = posix(path.join(HERE, 'secret-scan.sh'));

/** bash/find/grep receive forward-slash paths; MSYS handles `C:/...` natively. */
function posix(p) {
  return p.replace(/\\/g, '/');
}

function bashAvailable() {
  return !spawnSync('bash', ['--version'], { encoding: 'utf8' }).error;
}

/** Run the scanner. Returns { status, stdout, stderr, out } (out = both streams). */
function scan(args, opts = {}) {
  const r = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', ...opts });
  assert.equal(r.error, undefined, `spawn failed: ${r.error}`);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: `${r.stdout}${r.stderr}` };
}

const TEMP_DIRS = [];

/** A fresh scratch directory in the OS temp area — deliberately NOT a git repo. */
function newSurface() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-proof-'));
  TEMP_DIRS.push(d);
  return d;
}

/**
 * A throwaway git repository in the OS temp area, for exercising DEFAULT mode.
 * `git add` alone is enough — the scanner reads the index via `git ls-files`, so
 * nothing is ever committed and no git identity is required.
 */
function newRepo() {
  const d = newSurface();
  const r = spawnSync('git', ['init', '-q', d], { encoding: 'utf8' });
  assert.equal(r.status, 0, `git init failed: ${r.stdout}${r.stderr}`);
  return d;
}

function gitAddAll(dir) {
  const r = spawnSync('git', ['-C', dir, 'add', '-A'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `git add failed: ${r.stdout}${r.stderr}`);
}

/**
 * FAULT INJECTION. Returns a PATH prefix containing a `grep` that exits 2 (the
 * "I could not read that" status) for the scanner's SCAN invocations, delegating
 * everything else to the real grep.
 *
 * A scan invocation is identified by `-E` together with `-l` or `-n`: default
 * mode's `-I -n -H -E`, surface pass 1's `-a -l -E` (which files match anything)
 * and surface pass 2's `-a -n -E` (which lines, for class attribution). Keying
 * on `-n` alone is NOT enough — surface mode answers "could I read all of this?"
 * in pass 1, which carries `-l` and no `-n`, so a `-n`-only shim would leave a
 * clean surface passing and prove nothing.
 *
 * This exists because no OS-level trick reliably makes a file unreadable on
 * every platform this runs on (Windows ignores `chmod 000` for the owner). The
 * grep-error branch is the single most dangerous one in the script — it is
 * exactly where the old `|| true` turned an unreadable file into a pass — so it
 * is proven directly rather than left to the environment's goodwill.
 */
function grepFaultPath() {
  const dir = newSurface();
  const which = spawnSync('bash', ['-c', 'command -v grep'], { encoding: 'utf8' });
  assert.equal(which.status, 0, 'could not locate the real grep');
  const realGrep = which.stdout.trim();
  const shim = path.join(dir, 'grep');
  fs.writeFileSync(shim,
    '#!/usr/bin/env bash\n' +
    'has_E=0; has_ln=0\n' +
    'for a in "$@"; do\n' +
    '  case "$a" in\n' +
    '    -*E*) has_E=1 ;;\n' +
    '  esac\n' +
    '  case "$a" in\n' +
    '    -l|-n|-a) has_ln=1 ;;\n' +
    '  esac\n' +
    'done\n' +
    'if [ "$has_E" = 1 ] && [ "$has_ln" = 1 ]; then\n' +
    '  echo "grep: simulated read failure" >&2; exit 2\n' +
    'fi\n' +
    `exec "${realGrep}" "$@"\n`);
  fs.chmodSync(shim, 0o755);
  return { PATH: `${dir}${path.delimiter}${process.env.PATH}` };
}

function write(dir, name, contents) {
  const p = path.join(dir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contents);
  return p;
}

// --- runtime-assembled secret SHAPES (no literal lives in this source) -------
const probe = {
  // <6+ digits>:AA<30+ base64ish>
  telegram: () => `${'1234567'}:${'A'}${'A'}${'B'.repeat(32)}`,
  // AKIA + 16 uppercase alnum
  aws: () => `${'AKI'}${'A'}${'B'.repeat(16)}`,
  // -----BEGIN <...> PRIVATE KEY-----
  pem: () => `${'-'.repeat(5)}BEGIN RSA PRIVATE KEY${'-'.repeat(5)}`,
};

process.on('exit', () => {
  for (const d of TEMP_DIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

// =============================================================================
// PRECONDITION — without this, every "non-repo surface" claim below is void.
// =============================================================================

test('the fixture surface is genuinely outside any git repository', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0,
    `fixtures must sit outside any repo, but git resolved one at ${dir}: ${r.stdout}`);
});

// =============================================================================
// REFUSALS — the property under test. Each of these must be exit 2, NOT 0.
// =============================================================================

test('refuses a target that does not exist, instead of passing', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const missing = posix(path.join(newSurface(), 'no-such-directory'));
  const r = scan(['--surface', missing]);
  assert.equal(r.status, 2, `must be NOT SCANNED (2), got ${r.status}: ${r.out}`);
  assert.match(r.out, /NOT SCANNED/);
  assert.match(r.out, /does not exist/);
});

test('refuses --surface with no path at all', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const r = scan(['--surface']);
  assert.equal(r.status, 2, `must be NOT SCANNED (2), got ${r.status}: ${r.out}`);
  assert.match(r.out, /NOT SCANNED/);
});

test('refuses a bare path — it never silently reinterprets a malformed invocation', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  write(dir, 'a.txt', 'ordinary words\n');
  const r = scan([posix(dir)]);
  assert.equal(r.status, 2, `bare path must be refused, got ${r.status}: ${r.out}`);
  assert.match(r.out, /NOT SCANNED/);
  assert.doesNotMatch(r.out, /SCANNED \d+ file/, 'must not report having scanned anything');
});

test('refuses an empty directory rather than calling nothing clean', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 2, `empty surface must be NOT SCANNED (2), got ${r.status}: ${r.out}`);
  assert.match(r.out, /no regular files/);
});

test('refuses a directory whose only content is unreachable through a symlink', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  const real = newSurface();
  write(real, 'hidden.txt', 'ordinary words\n');
  try {
    fs.symlinkSync(real, path.join(dir, 'link'), 'junction');
  } catch (e) {
    t.skip(`this platform refused to create a symlink (${e.code}); branch not exercised here`);
    return;
  }
  write(dir, 'visible.txt', 'ordinary words\n');
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 2, `symlinked ground must be NOT SCANNED (2), got ${r.status}: ${r.out}`);
  assert.match(r.out, /not regular files/);
});

test('refuses when part of the surface cannot be read', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  write(dir, 'ok.txt', 'ordinary words\n');
  const locked = write(dir, 'locked.txt', 'ordinary words\n');
  try {
    fs.chmodSync(locked, 0o000);
    fs.readFileSync(locked); // if this succeeds, the OS ignored the mode
    t.skip('this platform does not enforce chmod 000 for the owner; branch not exercised here');
    return;
  } catch (e) {
    if (e.code !== 'EACCES' && e.code !== 'EPERM') {
      t.skip(`could not make a file unreadable here (${e.code}); branch not exercised`);
      return;
    }
  }
  const r = scan(['--surface', posix(dir)]);
  fs.chmodSync(locked, 0o644);
  assert.equal(r.status, 2, `unreadable file must be NOT SCANNED (2), got ${r.status}: ${r.out}`);
  assert.match(r.out, /NOT SCANNED/);
});

// =============================================================================
// DETECTION on a surface default mode cannot reach
// =============================================================================

test('catches a planted synthetic secret on a NON-REPO surface', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  write(dir, 'clean.txt', 'nothing interesting in this file at all\n');
  write(dir, path.join('nested', 'config.js'), `const t = "${probe.telegram()}";\n`);
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 1, `planted secret must FAIL (1), got ${r.status}: ${r.out}`);
  assert.match(r.out, /FOUND/);
  assert.match(r.out, /config\.js/, 'the hit must name the offending file');
});

test('catches a planted secret in a .md on a surface (default mode excludes .md)', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  write(dir, 'notes.md', `pasted here by accident: ${probe.aws()}\n`);
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 1, `secret in .md must FAIL (1), got ${r.status}: ${r.out}`);
  assert.match(r.out, /notes\.md/);
});

test('catches a planted secret inside a file containing NUL bytes', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  const blob = Buffer.concat([
    Buffer.from([0x00, 0x01, 0x00]),
    Buffer.from(probe.pem(), 'utf8'),
    Buffer.from([0x00, 0x02]),
  ]);
  write(dir, 'blob.bin', blob);
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 1, `secret in a binary-ish file must FAIL (1), got ${r.status}: ${r.out}`);
  assert.match(r.out, /blob\.bin/);
});

// =============================================================================
// THE PASS — and the guarantee that it cannot be confused with a refusal
// =============================================================================

test('passes a clean non-repo surface and states the file count it read', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  write(dir, 'a.txt', 'ordinary words\n');
  write(dir, path.join('sub', 'b.txt'), 'more ordinary words\n');
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 0, `clean surface must pass (0), got ${r.status}: ${r.out}`);
  assert.match(r.stdout, /SCANNED 2 file\(s\)/, 'the pass must state how much ground it read');
  assert.match(r.stdout, /surface = /, 'the pass must name the ground it read');
});

test('scanned-and-clean, found, and not-scanned are three distinct exit codes', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }

  const cleanDir = newSurface();
  write(cleanDir, 'a.txt', 'ordinary words\n');

  const dirtyDir = newSurface();
  write(dirtyDir, 'a.txt', `x = "${probe.telegram()}"\n`);

  const clean = scan(['--surface', posix(cleanDir)]).status;
  const found = scan(['--surface', posix(dirtyDir)]).status;
  const notScanned = scan(['--surface', posix(path.join(newSurface(), 'absent'))]).status;

  assert.deepEqual([clean, found, notScanned], [0, 1, 2]);
  assert.equal(new Set([clean, found, notScanned]).size, 3,
    'a pass must never share an exit code with a refusal');
});

// =============================================================================
// REGRESSION — the existing repo-wide control must be untouched
// =============================================================================

test('default mode (zero args, from the repo) still scans tracked files and passes', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const r = scan([], { cwd: REPO_ROOT });
  assert.equal(r.status, 0, `repo-wide scan must still pass: ${r.out}`);
  assert.match(r.stdout, /clean — scanned \d+ tracked file\(s\), 0 secret value\(s\) found\./);
  const count = Number(/scanned (\d+) tracked file/.exec(r.stdout)[1]);
  assert.ok(count > 100, `expected the whole repo to be scanned, got ${count} file(s)`);
});

test('default mode does not return a pass when run outside any git repository', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  const r = scan([], { cwd: dir });
  assert.notEqual(r.status, 0,
    `outside a repo the scanner must not report success: ${r.out}`);
});

// =============================================================================
// CONTENT-CLASS DETECTION over a declared private surface (GL-012 §5a).
//
// For "connection strings containing credentials", "credential stores and
// exported sessions" and bearer tokens appearing as values, this scanner is not
// defence-in-depth — it is the ONLY mechanical control. So each class is proven
// to fire on a planted synthetic fixture, and the mutation suite proves the
// proofs go red when detection is removed.
//
// Every probe is assembled at RUNTIME from fragments. Nothing in this source
// matches any scanner pattern.
// =============================================================================

const A = (n) => 'A'.repeat(n);

const CONTENT_CASES = [
  ['connection-string-with-credentials', 'a.py',    () => `DSN = "postgres://svc:${'Xq7vRt2LmNp9'}@db.internal:5432/app"\n`],
  ['jdbc-password',                      'b.java',  () => `u = "jdbc:postgresql://h/db?user=u&password=${'Zk91mQr7'}"\n`],
  ['aws-credentials-file-entry',         'c.ini',   () => `[default]\naws_secret_access_key = ${A(40)}\n`],
  ['credential-store-json-value',        'd.json',  () => `{"tokens":{"access_token":"${'ya29.a0AfB_bZxQ12mNpQ7rS'}"}}\n`],
  ['netrc-credentials',                  'e.conf',  () => `machine api.example.com login bob password ${'s3cretpw'}\n`],
  ['htpasswd-hash',                      'f.conf',  () => `user:${'$'}apr1${'$'}abcdefgh${'$'}${A(22)}\n`],
  ['session-cookie-value',               'g.log',   () => `Set-Cookie: session_token=${A(30)}; Path=/\n`],
  ['bearer-token-value',                 'h.txt',   () => `Authorization: ${'Bear' + 'er'} ${A(30)}\n`],
  ['basic-auth-header-value',            'i.txt',   () => `Authorization: ${'Bas' + 'ic'} ${A(22)}\n`],
  ['openai-style-key',                   'j.rb',    () => `k = "${'sk'}-${A(30)}"\n`],
  ['github-token',                       'k.go',    () => `k = "${'ghp'}_${A(36)}"\n`],
  ['slack-token',                        'l.cs',    () => `k = "${'xox'}b-${A(30)}"\n`],
  ['google-api-key',                     'm.php',   () => `k = "${'AIz'}a${A(35)}"\n`],
  ['npm-token',                          'n.sh',    () => `k = "${'npm'}_${A(36)}"\n`],
  ['gitlab-token',                       'o.rs',    () => `k = "${'glp'}at-${A(30)}"\n`],
  ['sendgrid-key',                       'p.ts',    () => `k = "${'SG'}.${A(22)}.${A(43)}"\n`],
  ['stripe-key-body',                    'q.c',     () => `k = "${'pk'}_${A(30)}"\n`],
  ['telegram-token-bare',                'r.txt',   () => `k = "${'12345678'}:${A(30)}"\n`],
  ['pem-private-key-block',              's.pem',   () => `${'-'.repeat(5)}BEGIN RSA PRIVATE KEY${'-'.repeat(5)}\n`],
];

for (const [className, file, make] of CONTENT_CASES) {
  test(`surface mode detects content class: ${className}`, (t) => {
    if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
    const dir = newSurface();
    write(dir, file, make());
    const r = scan(['--surface', posix(dir)]);
    assert.equal(r.status, 1, `${className} must be FOUND (1), got ${r.status}: ${r.out}`);
    assert.match(r.stdout, new RegExp(`matched class: ${className}\\b`),
      `hit must be attributed to ${className}: ${r.stdout}`);
    assert.doesNotMatch(r.stdout, /unattributed-match/,
      'grep and the class table must agree on what matched');
  });
}

test('surface mode NEVER prints the matched value — only path, line and class', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  // A value unlike anything else in the output, so its absence is meaningful.
  const secret = `Zq${A(28)}Wx`;
  write(dir, 'creds.py', `DSN = "postgres://svc:${secret}@db.internal:5432/app"\n`);
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 1, r.out);
  assert.ok(!r.out.includes(secret),
    'the matched secret value must NOT appear anywhere in stdout or stderr — this output is pasted into handback messages (GL-012 §6)');
  assert.match(r.stdout, /\[REDACTED\] matched class: connection-string-with-credentials/);
  assert.match(r.stdout, /creds\.py:1/, 'the path and line must still be actionable');
});

test('default mode does NOT apply the content classes', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  // Measured: the content classes hit 12 legitimate committed test fixtures in
  // this repo. In default mode they would turn CI red on day one, and a control
  // that red-lights the repo on day one gets switched off.
  const repo = newRepo();
  write(repo, 'fixture.test.js', `const dsn = "postgres://svc:${'Xq7vRt2LmNp9'}@h:5432/db";\n`);
  gitAddAll(repo);
  const r = scan([], { cwd: repo });
  assert.equal(r.status, 0, `default mode must stay clean on a content-class shape: ${r.out}`);
  assert.match(r.stdout, /clean — scanned 1 tracked file\(s\)/);
});

// =============================================================================
// CREDENTIAL-SHAPED FILENAMES — refused UNREAD (GL-012 §3)
// =============================================================================

const DENIED_NAMES = ['.env', 'prod.env', 'shopper.env.txt', 'env.txt', 'id_rsa', '.pgpass', 'bundle.p12', '.npmrc'];
for (const name of DENIED_NAMES) {
  test(`surface mode refuses credential-shaped filename: ${name}`, (t) => {
    if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
    const dir = newSurface();
    write(dir, name, 'PLAINTEXT_MARKER=1\n');
    const r = scan(['--surface', posix(dir)]);
    assert.equal(r.status, 1, `${name} must be refused (1), got ${r.status}: ${r.out}`);
    assert.match(r.stdout, /REFUSED UNREAD/);
  });
}

const ALLOWED_NAMES = ['environment.txt', 'env.js', '.env.example', 'config.env.js'];
for (const name of ALLOWED_NAMES) {
  test(`surface mode does NOT refuse ordinary filename: ${name}`, (t) => {
    if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
    const dir = newSurface();
    write(dir, name, 'const ordinary = 1;\n');
    const r = scan(['--surface', posix(dir)]);
    assert.equal(r.status, 0, `${name} must scan clean (0), got ${r.status}: ${r.out}`);
    assert.doesNotMatch(r.stdout, /REFUSED UNREAD/);
  });
}

test('an env file is refused by its NAME even with a .txt extension, inside a ".env" directory', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  // The concrete case GL-012 surfaced: a .txt file that is functionally an env
  // file, sitting in a directory whose name begins ".env". Nolan could not write
  // a pure filename pattern for it without a judgement clause; these two rules
  // (directory component, and an "env" dot-segment regardless of extension)
  // catch it mechanically, which is what lets the clause go.
  const dir = newSurface();
  write(dir, path.join('.env keys', 'shopper.env.txt'), 'PLAINTEXT_MARKER=1\n');
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 1, `must be refused: ${r.out}`);
  assert.match(r.stdout, /REFUSED UNREAD/);
  assert.match(r.stdout, /begins with '\.env'/);
});

test('a filename-refused file is never OPENED — its contents cannot reach the output', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  const marker = `MARKER${A(24)}ZZ`;
  write(dir, '.env', `API_THING=${marker}\n`);
  const r = scan(['--surface', posix(dir)]);
  assert.equal(r.status, 1, r.out);
  assert.ok(!r.out.includes(marker),
    'a file refused by name must never be read, so nothing inside it can appear in the output');
  assert.match(r.stdout, /refused by name \(never opened\)/);
});

test('.env.example is exempt from refusal but its CONTENTS are still scanned', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  // Larry's recorded narrowing of GL-012 §2, 2026-07-29. The exemption is safe
  // only because the content scan still applies — this proves that half.
  const namesOnly = newSurface();
  write(namesOnly, '.env.example', 'SOME_TOKEN=\nANOTHER_NAME=\n');
  const clean = scan(['--surface', posix(namesOnly)]);
  assert.equal(clean.status, 0, `a keys-only template must pass: ${clean.out}`);

  const withValue = newSurface();
  write(withValue, '.env.example', `DSN=postgres://svc:${'Xq7vRt2LmNp9'}@h:5432/db\n`);
  const dirty = scan(['--surface', posix(withValue)]);
  assert.equal(dirty.status, 1,
    `a real value pasted into a template must still be caught: ${dirty.out}`);
  assert.match(dirty.stdout, /matched class: connection-string-with-credentials/);
});

test('a .pem holding no private key passes; a .pem holding one is caught', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  // GL-012 §2 forbids "certificates containing a private key" — a CONTENT
  // condition. This repo tracks a public CA certificate; a filename rule on
  // .pem would refuse a file that carries no secret at all.
  const pub = newSurface();
  write(pub, 'ca.pem', `${'-'.repeat(5)}BEGIN CERTIFICATE${'-'.repeat(5)}\nMIIBpublicbytes\n`);
  assert.equal(scan(['--surface', posix(pub)]).status, 0, 'a public certificate must not be refused');

  const priv = newSurface();
  write(priv, 'key.pem', `${'-'.repeat(5)}BEGIN RSA PRIVATE KEY${'-'.repeat(5)}\n`);
  const r = scan(['--surface', posix(priv)]);
  assert.equal(r.status, 1, 'a private key must be caught by content');
  assert.match(r.stdout, /matched class: pem-private-key-block/);
});

// =============================================================================
// THE CONTROL'S ACCOUNT OF ITS OWN COVERAGE
// =============================================================================

test('every surface run states what it looked for AND what it does not detect', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  write(dir, 'a.txt', 'ordinary words\n');
  const clean = scan(['--surface', posix(dir)]);
  assert.equal(clean.status, 0, clean.out);
  assert.match(clean.stdout, /CHECKED \d+ detection class\(es\)/);
  assert.match(clean.stdout, /connection-string-with-credentials/);
  assert.match(clean.stdout, /NOT DETECTED BY THIS CONTROL/);
  assert.match(clean.stdout, /NO recognisable shape/);
  assert.match(clean.stdout, /SPLIT or ASSEMBLED at runtime/);

  // The account must travel with a FAILING run too, not only a green one.
  const dirty = newSurface();
  write(dirty, 'x.py', `DSN = "postgres://svc:${'Xq7vRt2LmNp9'}@h:5432/db"\n`);
  const bad = scan(['--surface', posix(dirty)]);
  assert.equal(bad.status, 1, bad.out);
  assert.match(bad.stdout, /NOT DETECTED BY THIS CONTROL/);
});

// =============================================================================
// DEFAULT MODE — the same "no pass for unscanned ground" rule, applied to the
// invocation everyone actually runs (Larry's ruling, 2026-07-29).
// =============================================================================

test('default mode refuses a repository with no tracked files instead of calling it clean', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const repo = newRepo();
  const r = scan([], { cwd: repo });
  assert.equal(r.status, 2, `empty repo must be NOT SCANNED (2), got ${r.status}: ${r.out}`);
  assert.match(r.out, /NOT SCANNED/);
  assert.match(r.out, /no tracked files/);
  assert.doesNotMatch(r.out, /clean/, 'nothing scanned must never be described as clean');
});

test('default mode refuses a repository whose every tracked file is excluded', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const repo = newRepo();
  write(repo, 'README.md', 'documentation only, no code\n');
  write(repo, '.env.example', 'SOME_NAME=\n');
  gitAddAll(repo);
  const r = scan([], { cwd: repo });
  assert.equal(r.status, 2, `all-excluded repo must be NOT SCANNED (2), got ${r.status}: ${r.out}`);
  assert.match(r.out, /were excluded or absent from disk/);
});

test('default mode refuses when grep cannot read the tracked files', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const repo = newRepo();
  write(repo, 'a.js', 'const a = 1;\n');
  gitAddAll(repo);

  const sane = scan([], { cwd: repo });
  assert.equal(sane.status, 0, `control case must pass first: ${sane.out}`);

  const r = scan([], { cwd: repo, env: { ...process.env, ...grepFaultPath() } });
  assert.equal(r.status, 2,
    `an unreadable file set must be NOT SCANNED (2), not clean (0). Got ${r.status}: ${r.out}`);
  assert.match(r.out, /coverage is unknown/);
  assert.doesNotMatch(r.stdout, /clean —/);
});

test('surface mode refuses when grep cannot read the surface', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const dir = newSurface();
  write(dir, 'a.txt', 'ordinary words\n');

  const sane = scan(['--surface', posix(dir)]);
  assert.equal(sane.status, 0, `control case must pass first: ${sane.out}`);

  const r = scan(['--surface', posix(dir)], { env: { ...process.env, ...grepFaultPath() } });
  assert.equal(r.status, 2,
    `an unreadable surface must be NOT SCANNED (2), not clean (0). Got ${r.status}: ${r.out}`);
  assert.match(r.out, /coverage is unknown/);
  assert.doesNotMatch(r.stdout, /SCANNED \d+ file/);
});

test('default mode still passes, and still FINDS, on repos it can actually read', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }

  const cleanRepo = newRepo();
  write(cleanRepo, 'a.js', 'const a = 1;\n');
  gitAddAll(cleanRepo);
  const clean = scan([], { cwd: cleanRepo });
  assert.equal(clean.status, 0, `clean repo must pass: ${clean.out}`);
  assert.match(clean.stdout, /clean — scanned 1 tracked file\(s\), 0 secret value\(s\) found\./);

  const dirtyRepo = newRepo();
  write(dirtyRepo, 'a.js', `const a = "${probe.telegram()}";\n`);
  gitAddAll(dirtyRepo);
  const dirty = scan([], { cwd: dirtyRepo });
  assert.equal(dirty.status, 1, `planted secret must fail: ${dirty.out}`);
  assert.match(dirty.stdout, /FOUND 1 hit\(s\) across 1 scanned file\(s\)/);
});

test('--help documents the modes and exits 0 without scanning anything', (t) => {
  if (!bashAvailable()) { t.skip('bash unavailable on this runner'); return; }
  const r = scan(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--surface/);
  assert.match(r.stdout, /NOT SCANNED/);
  assert.doesNotMatch(r.stdout, /SCANNED \d+ file/);
});
