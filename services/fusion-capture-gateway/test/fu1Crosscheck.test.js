// BUILD-002 FU-1 -- CLI fail-closed guard for scripts/fu1-ca-crosscheck.mjs.
//
// Closes Codex finding TQA-002 [MEDIUM]. The risk: a malformed authoritative
// check -- e.g. `node fu1-ca-crosscheck.mjs --official` with a missing or
// typo'd value, or a stray unknown flag -- could fall through to the
// self-consistency-only path and exit 0, handing back a FALSE "all good" when
// the operator intended the authoritative L-1 root comparison.
//
// The proof this suite carries: EVERY malformed invocation exits NON-ZERO, and
// the only exit-0 paths are (a) a well-formed no-official run that prints
// "L-1 status: OPEN", and (b) a well-formed --official run that returns MATCH.
//
// These tests spawn the REAL node binary against the REAL committed cert and
// assert exit codes. No DB, no network, no env.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'fu1-ca-crosscheck.mjs');
const CA_PATH = path.join(__dirname, '..', 'certs', 'supabase-pooler-ca.pem');

// Run the script under the real node binary and capture the exit code + output.
// spawnSync returns the status without throwing on non-zero, which is exactly
// what we need to assert exit codes.
function run(args) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  return { status: res.status, stdout, stderr, out: stdout + stderr };
}

const certBlocks = (pem) =>
  pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];

let tmpDir;
let rootOnlyPem; // the pinned ROOT alone -- a well-formed authoritative MATCH
let noRootPem; // a valid cert file that does NOT contain the pinned root

before(() => {
  const blocks = certBlocks(fs.readFileSync(CA_PATH, 'utf8'));
  assert.equal(blocks.length, 2, 'fixture assumption: committed bundle has intermediate + root');
  const [intermediate, root] = blocks;

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fu1-crosscheck-'));
  rootOnlyPem = path.join(tmpDir, 'official-with-root.pem');
  noRootPem = path.join(tmpDir, 'official-without-root.pem');

  // MATCH fixture: the authoritative download containing the pinned root.
  fs.writeFileSync(rootOnlyPem, `${root}\n`);
  // MISMATCH fixture: a valid cert (the intermediate) but NOT the pinned root.
  fs.writeFileSync(noRootPem, `${intermediate}\n`);
});

after(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---- Legitimate exit-0 paths --------------------------------------------

test('no args -> exit 0 and reports L-1 status: OPEN', () => {
  const { status, out } = run([]);
  assert.equal(status, 0, 'the self-consistency-only run must exit 0');
  assert.match(out, /L-1 status: OPEN/, 'the only exit-0-without-official path must clearly say OPEN');
});

test('well-formed --official with the pinned root -> exit 0 and VERDICT: MATCH', () => {
  const { status, out } = run(['--official', rootOnlyPem]);
  assert.equal(status, 0, 'a genuine authoritative MATCH is the only --official exit-0 path');
  assert.match(out, /VERDICT: MATCH/, 'a MATCH run must print VERDICT: MATCH');
});

// ---- MISMATCH: well-formed but authoritative comparison fails ------------

test('well-formed --official WITHOUT the pinned root -> exit 2 and VERDICT: MISMATCH', () => {
  const { status, out } = run(['--official', noRootPem]);
  assert.equal(status, 2, 'a real MISMATCH must exit 2');
  assert.match(out, /MISMATCH/, 'a MISMATCH run must say so');
});

// ---- Malformed authoritative-check invocations: NONE may exit 0 ---------
//
// This is the core TQA-002 proof. Each of these once could have degraded to the
// self-consistency-only OPEN path and exited 0. Now every one must fail closed.

const malformed = [
  { name: '--official with NO following value', args: ['--official'] },
  { name: '--official value that looks like a flag', args: ['--official', '--something'] },
  { name: '--official pointing at a non-existent file', args: ['--official', path.join(os.tmpdir(), 'fu1-does-not-exist-xyz.crt')] },
  { name: 'duplicate --official a --official b', args: ['--official', 'a', '--official', 'b'] },
  { name: 'unknown flag --bogus', args: ['--bogus'] },
  { name: 'extra positional arguments', args: ['one', 'two'] },
];

for (const c of malformed) {
  test(`malformed: ${c.name} -> exit NON-ZERO (never 0)`, () => {
    const { status, out } = run(c.args);
    assert.notEqual(status, 0, `malformed invocation exited 0 -- FALSE all-clear: ${c.name}\n${out}`);
    assert.ok(status >= 1, `expected a non-zero exit code, got ${status} for: ${c.name}`);
  });
}

test('INVARIANT: no malformed authoritative-check invocation can exit 0', () => {
  const statuses = malformed.map((c) => ({ name: c.name, status: run(c.args).status }));
  const leaked = statuses.filter((s) => s.status === 0);
  assert.equal(
    leaked.length,
    0,
    `these malformed invocations wrongly exited 0: ${JSON.stringify(leaked)}`,
  );
  // The malformed --official / unknown-flag / extra-positional cases all exit 2
  // (usageFail) or, for the non-existent file, exit 2 (fail-closed IO). None
  // may reach the exit-0 OPEN fall-through.
});
