// Proofs for the REVIEW INSTRUMENT itself — gitEvidence.mjs + reviewDiff.mjs.
//
// These two modules produced every verdict in this review gate, and neither had a test until
// now: gitEvidence.mjs went ungated because it was the thing doing the gating. The question
// behind every case below is the one that matters for measuring equipment:
//
//     CAN THIS TOOL TELL A REVIEWER IT SAW SOMETHING IT DID NOT?
//
// Each hazard case asserts BOTH halves: first that the input genuinely exercises the hazard
// (the CONTROL — the old algorithm, computed inline, visibly failing on this exact input),
// then that the shipped code does not. Without the control a passing test proves only that
// the input was harmless. No test here hopes for a race: chunk boundaries are FORCED through
// an injected spawn, so the split is deterministic on every machine.
//
//   node --test test/reviewTooling.test.mjs
//
// NOT wired into a package.json script or a CI workflow — that needs services/control-plane/
// package.json AND .github/workflows/, both outside this Work Order's file surface. Reported
// as a known limitation, not silently skipped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { gatherGitEvidence, utf8SafeCut, MAX_DIFF_BYTES } from '../gitEvidence.mjs';
import { validateClaim, buildReviewPacket, normalisePaths } from '../reviewDiff.mjs';
import { buildCodexPrompt } from '../../review/codexAdapter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOP_DIR = path.resolve(__dirname, '..');
const REPLACEMENT = '�';
const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);

// ── injected spawn ────────────────────────────────────────────────────────────
// Emits EXACTLY the byte chunks a case specifies, so a boundary mid-character is
// deterministic rather than dependent on how the OS happened to fill the pipe.
function fakeSpawn({ diffChunks = [], names = 'x.mjs\n', failHead = false, failBase = false, failDiff = false, calls = [] } = {}) {
  return (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    const isRevParse = args[0] === 'rev-parse';
    const isNames = args[0] === 'diff' && args.includes('--name-only');
    const isDiff = args[0] === 'diff' && args.includes('--no-color');
    setImmediate(() => {
      if (isRevParse) {
        const wantsBase = String(args[2]).startsWith(BASE);
        if ((wantsBase && failBase) || (!wantsBase && failHead)) {
          child.stderr.emit('data', Buffer.from('unknown revision\n'));
          return child.emit('close', 128);
        }
        child.stdout.emit('data', Buffer.from(`${wantsBase ? BASE : HEAD}\n`));
        return child.emit('close', 0);
      }
      if (isNames) {
        child.stdout.emit('data', Buffer.from(names));
        return child.emit('close', 0);
      }
      if (isDiff) {
        if (failDiff) {
          child.stderr.emit('data', Buffer.from('fatal: bad revision\n'));
          return child.emit('close', 128);
        }
        for (const c of diffChunks) child.stdout.emit('data', c);
        return child.emit('close', 0);
      }
      child.emit('close', 0);
    });
    return child;
  };
}

const gather = (opts, extra = {}) =>
  gatherGitEvidence({ cwd: '/nowhere', baseSha: BASE, headSha: HEAD, spawn: fakeSpawn(opts), ...extra });

const validClaim = (over = {}) => ({
  checkpoint_id: 'ckpt-1', build_id: 'operating-reset-phase-5', brief_ref: 'WO-OR-15',
  summary: 'the claim under test', brief_excerpt: 'AC1 — something checkable', ...over,
});

// ══ 1. CHUNK BOUNDARIES — bytes must survive being delivered in pieces ═══════

test('a multibyte character split across a chunk boundary is NOT corrupted', async () => {
  const full = Buffer.from('diff --git a/x b/x\n+ café — naïve € 日本語\n', 'utf8');
  // Split inside the 3-byte '€'. Deterministic: located by byte index, not by luck.
  const euroAt = full.indexOf(Buffer.from('€', 'utf8'));
  assert.ok(euroAt > 0, 'fixture actually contains the multibyte character');
  const splitAt = euroAt + 1;
  const chunks = [full.subarray(0, splitAt), full.subarray(splitAt)];

  // CONTROL — the old algorithm (`stdout += d.toString()`) on this exact input.
  const naive = chunks.map((c) => c.toString()).join('');
  assert.ok(naive.includes(REPLACEMENT), 'CONTROL: per-chunk decoding really does corrupt this input');
  assert.notEqual(naive, full.toString('utf8'), 'CONTROL: the corrupted text differs from git output');

  const ev = await gather({ diffChunks: chunks });
  assert.equal(ev.resolved, true);
  assert.ok(!ev.diff_text.includes(REPLACEMENT), 'no replacement characters survive into the packet');
  assert.equal(ev.diff_text, full.toString('utf8'), 'the diff is byte-identical to what git produced');
});

test('a character split across THREE chunks (one byte each) is still not corrupted', async () => {
  const full = Buffer.from('+ 日本語\n', 'utf8');
  const jp = full.indexOf(Buffer.from('日', 'utf8'));
  const chunks = [full.subarray(0, jp + 1), full.subarray(jp + 1, jp + 2), full.subarray(jp + 2)];
  const naive = chunks.map((c) => c.toString()).join('');
  assert.ok(naive.includes(REPLACEMENT), 'CONTROL: a 3-way split corrupts under per-chunk decoding');

  const ev = await gather({ diffChunks: chunks });
  assert.equal(ev.diff_text, full.toString('utf8'));
  assert.ok(!ev.diff_text.includes(REPLACEMENT));
});

test('stderr is decoded once too — a split character in a blocker message is not corrupted', async () => {
  const msg = Buffer.from('fatal: pathspec « café » did not match\n', 'utf8');
  const at = msg.indexOf(Buffer.from('«', 'utf8'));
  const spawn = (cmd, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => {
      child.stderr.emit('data', msg.subarray(0, at + 1));
      child.stderr.emit('data', msg.subarray(at + 1));
      child.emit('close', 128);
    });
    return child;
  };
  const ev = await gatherGitEvidence({ cwd: '/nowhere', headSha: HEAD, spawn });
  assert.equal(ev.resolved, false, 'still fail-closed');
  assert.ok(!ev.blocker.includes(REPLACEMENT), 'the blocker text is not corrupted by chunking');
});

// ══ 2. THE CAP — right unit, and a cut that cannot split a character ═════════

test('the cap is enforced in BYTES, not UTF-16 code units — the metric matches the name', async () => {
  // 30,000 × '€' = 30,000 code units but 90,000 BYTES. The old metric measured 30,000,
  // saw it as comfortably under a cap named MAX_DIFF_BYTES, and delivered 90,000 bytes.
  const body = Buffer.from('€'.repeat(30_000), 'utf8');
  assert.equal(body.length, 90_000, 'fixture is 90,000 real bytes');
  assert.equal(body.toString('utf8').length, 30_000, 'CONTROL: the old metric reads this as 30,000');
  assert.ok(30_000 < MAX_DIFF_BYTES, 'CONTROL: the old metric would NOT have truncated this');

  const ev = await gather({ diffChunks: [body] });
  assert.equal(ev.diff_truncated, true, 'the byte metric truncates what the code-unit metric let through');
  assert.equal(ev.diff_total_bytes, 90_000, 'the real size is recorded in bytes');
  assert.ok(ev.diff_bytes <= MAX_DIFF_BYTES, 'delivered payload respects the cap it is named for');
});

test('a truncation cut landing mid-character does not leave a broken sequence', async () => {
  // Place a 3-byte character so that byte[MAX_DIFF_BYTES] is one of its CONTINUATION bytes.
  const head = Buffer.from('x'.repeat(MAX_DIFF_BYTES - 1), 'utf8');
  const euro = Buffer.from('€', 'utf8');
  const body = Buffer.concat([head, euro, Buffer.from('y'.repeat(500), 'utf8')]);
  assert.equal((body[MAX_DIFF_BYTES] & 0xC0), 0x80, 'fixture really does put a continuation byte at the cut');

  // CONTROL — a naive byte cut at the cap.
  const naive = body.subarray(0, MAX_DIFF_BYTES).toString('utf8');
  assert.ok(naive.endsWith(REPLACEMENT), 'CONTROL: cutting at the cap really does break the character');

  const ev = await gather({ diffChunks: [body] });
  assert.equal(ev.diff_truncated, true);
  assert.ok(!ev.diff_text.includes(REPLACEMENT), 'the delivered diff contains no broken sequence');
  assert.equal(ev.diff_bytes, MAX_DIFF_BYTES - 1, 'the cut backed off to the character boundary');
  assert.ok(ev.diff_text.startsWith('x'.repeat(100)), 'content before the cut is intact');
});

test('utf8SafeCut: backs off only as far as needed, and never past a clean boundary', () => {
  const buf = Buffer.from('ab€cd', 'utf8'); // a b E2 82 AC c d
  assert.equal(utf8SafeCut(buf, 2), 2, 'ASCII boundary cuts exactly at max');
  assert.equal(utf8SafeCut(buf, 3), 2, 'inside the sequence: backs off to its start');
  assert.equal(utf8SafeCut(buf, 4), 2, 'deeper inside the sequence: still backs off to its start');
  assert.equal(utf8SafeCut(buf, 5), 5, 'the byte after the sequence is a clean boundary');
  assert.equal(utf8SafeCut(buf, 99), buf.length, 'nothing to cut when under the cap');
  for (let max = 0; max <= buf.length; max += 1) {
    assert.ok(!buf.subarray(0, utf8SafeCut(buf, max)).toString('utf8').includes(REPLACEMENT),
      `cut at max=${max} never produces a replacement character`);
  }
});

test('the truncation notice reports REAL byte counts, not code units', async () => {
  const body = Buffer.from('€'.repeat(30_000), 'utf8'); // 90,000 bytes / 30,000 code units
  const ev = await gather({ diffChunks: [body] });
  assert.match(ev.diff_text, /\[diff truncated at \d+ bytes \(cap 60000\) of 90000 bytes\]/,
    'the notice states the real total (90000), not the code-unit count (30000)');
  assert.ok(!ev.diff_text.includes('of 30000'), 'the understated code-unit figure is gone from the record');
});

test('a diff at or under the cap is delivered whole and byte-identical', async () => {
  const body = Buffer.from(`+ ${'é'.repeat(100)}\n`, 'utf8');
  const ev = await gather({ diffChunks: [body] });
  assert.equal(ev.diff_truncated, false);
  assert.equal(ev.diff_text, body.toString('utf8'));
  assert.equal(ev.diff_bytes, body.length);
  assert.equal(ev.diff_total_bytes, body.length);
  assert.equal(Buffer.byteLength(ev.diff_text, 'utf8'), body.length, 'round-trips to the same byte count');
});

// ══ 3. THE PACKET — it must not describe coverage it did not deliver ════════

test('a scoped packet SAYS it is scoped, in git\'s own syntax, and carries the machine field', () => {
  const evidence = {
    repo: null, branch: 'wo-or-15/review-tool-honesty', head_sha: HEAD, base_sha: BASE,
    diff_range: `${BASE}..${HEAD}`, scoped_to: ['tools/governor/footer.mjs'],
    changed_files: ['tools/governor/footer.mjs'], diff_text: '+x\n', diff_truncated: false,
  };
  const packet = buildReviewPacket({ evidence, claim: validClaim() });
  assert.equal(packet.diff_range, `${BASE}..${HEAD} -- tools/governor/footer.mjs`);
  assert.deepEqual(packet.scoped_to, ['tools/governor/footer.mjs']);
  assert.notEqual(packet.diff_range, evidence.diff_range, 'the packet no longer declares the bare full range');
});

test('an UNSCOPED packet is unchanged — the bare range, and scoped_to null', () => {
  const evidence = {
    repo: null, branch: 'b', head_sha: HEAD, base_sha: BASE, diff_range: `${BASE}..${HEAD}`,
    scoped_to: null, changed_files: ['a.mjs', 'b.mjs'], diff_text: '+x\n', diff_truncated: false,
  };
  const packet = buildReviewPacket({ evidence, claim: validClaim() });
  assert.equal(packet.diff_range, `${BASE}..${HEAD}`, 'no annotation when nothing was excluded');
  assert.equal(packet.scoped_to, null);
});

test('the packet takes its scope from the EVIDENCE, so it cannot claim a scope the diff lacks', () => {
  const evidence = {
    repo: null, branch: 'b', head_sha: HEAD, base_sha: BASE, diff_range: `${BASE}..${HEAD}`,
    scoped_to: null, changed_files: ['a.mjs'], diff_text: '+x\n', diff_truncated: false,
  };
  // Even though a caller may have *intended* a scope, the gatherer applied none.
  const packet = buildReviewPacket({ evidence, claim: validClaim({ scoped_to: ['a.mjs'] }) });
  assert.equal(packet.scoped_to, null, 'the packet reports what was collected, not what was intended');
  assert.equal(packet.diff_range, `${BASE}..${HEAD}`);
});

test('THE SCOPE REACHES THE REVIEWER: buildCodexPrompt renders it in both channels', () => {
  const evidence = {
    repo: null, branch: 'b', head_sha: HEAD, base_sha: BASE, diff_range: `${BASE}..${HEAD}`,
    scoped_to: ['tools/governor/footer.mjs'], changed_files: ['tools/governor/footer.mjs'],
    diff_text: '+x\n', diff_truncated: false,
  };
  const packet = buildReviewPacket({ evidence, claim: validClaim() });
  const prompt = buildCodexPrompt({ skillText: 'SKILL', packet });
  assert.ok(prompt.includes(`diff_range: ${BASE}..${HEAD} -- tools/governor/footer.mjs`), 'pointer line carries the scope');
  assert.ok(prompt.includes(`── STAGED DIFF (${BASE}..${HEAD} -- tools/governor/footer.mjs`), 'the staged-diff header carries it too');

  // CONTROL — why the scope had to be folded into diff_range rather than added as a field.
  // buildCodexPrompt renders a FIXED WHITELIST and silently drops unknown packet keys, so a
  // bare `scoped_to` would satisfy a criterion on its face and reach the reviewer NOT AT ALL.
  const naive = { ...packet, diff_range: evidence.diff_range };
  const naivePrompt = buildCodexPrompt({ skillText: 'SKILL', packet: naive });
  assert.ok(Object.hasOwn(naive, 'scoped_to'), 'CONTROL packet does carry the field');
  assert.ok(!naivePrompt.includes('-- tools/governor/footer.mjs'),
    'CONTROL: a scoped_to FIELD alone is dropped by the whitelist and never reaches the reviewer');
  assert.ok(!naivePrompt.includes('scoped_to'), 'CONTROL: the key name does not appear in the prompt at all');
});

test('the packet never invents identity — every identity field comes from the claim', () => {
  const evidence = {
    repo: null, branch: 'b', head_sha: HEAD, base_sha: BASE, diff_range: `${BASE}..${HEAD}`,
    scoped_to: null, changed_files: ['a.mjs'], diff_text: '+x\n', diff_truncated: false,
  };
  const packet = buildReviewPacket({ evidence, claim: validClaim() });
  assert.equal(packet.checkpoint_id, 'ckpt-1');
  assert.equal(packet.build_id, 'operating-reset-phase-5');
  assert.equal(packet.brief_ref, 'WO-OR-15');
  // CONTROL — the exact values the old `??` defaults would have fabricated.
  assert.notEqual(packet.checkpoint_id, `review-${HEAD.slice(0, 10)}`, 'not the invented checkpoint id');
  assert.notEqual(packet.build_id, 'unscoped', 'not the invented build id');
});

test('wp_id is carried as an EXPLICIT null when absent, and passed through when present', () => {
  const evidence = {
    repo: null, branch: 'b', head_sha: HEAD, base_sha: BASE, diff_range: `${BASE}..${HEAD}`,
    scoped_to: null, changed_files: ['a.mjs'], diff_text: '+x\n', diff_truncated: false,
  };
  const absent = buildReviewPacket({ evidence, claim: validClaim() });
  assert.equal(absent.wp_id, null, 'explicitly null, not undefined and not fabricated');
  assert.ok(Object.hasOwn(absent, 'wp_id'), 'the field is present so the record states it');
  assert.ok(buildCodexPrompt({ skillText: 'S', packet: absent }).includes('wp_id: (none)'),
    'the reviewer is told plainly that there is no wp_id');

  const present = buildReviewPacket({ evidence, claim: validClaim({ wp_id: ' WO-OR-15 ' }) });
  assert.equal(present.wp_id, 'WO-OR-15', 'trimmed and carried');
});

// ══ 4. CLAIM VALIDATION — refuse, do not invent ═════════════════════════════

test('a claim missing an identity field is refused, and the error NAMES the field', () => {
  for (const field of ['checkpoint_id', 'build_id', 'brief_ref']) {
    const claim = validClaim();
    delete claim[field];
    const errors = validateClaim(claim);
    assert.equal(errors.length, 1, `${field}: exactly one error`);
    assert.ok(errors[0].includes(`claim.${field}`), `${field}: the error names the field`);
  }
});

test('a blank or non-string identity field is refused just as an absent one is', () => {
  for (const bad of ['', '   ', null, 42, {}, []]) {
    const errors = validateClaim(validClaim({ build_id: bad }));
    assert.ok(errors.some((e) => e.includes('claim.build_id')), `refused: ${JSON.stringify(bad)}`);
  }
});

test('several missing fields are all reported at once, not one per round trip', () => {
  const errors = validateClaim({ summary: 'x', brief_excerpt: 'y' });
  assert.equal(errors.length, 3);
  for (const f of ['checkpoint_id', 'build_id', 'brief_ref']) {
    assert.ok(errors.some((e) => e.includes(`claim.${f}`)), `${f} named`);
  }
});

test('PRESERVED: reviewing against a missing or empty claim is still refused', () => {
  // The reason this module exists. Its predecessor reviewed real diffs against a hard-coded
  // demo claim and returned confident nonsense.
  for (const field of ['summary', 'brief_excerpt']) {
    for (const bad of [undefined, '', '   ', null]) {
      const claim = validClaim({ [field]: bad });
      if (bad === undefined) delete claim[field];
      const errors = validateClaim(claim);
      assert.ok(errors.some((e) => e.includes(`claim.${field}`)), `${field}=${JSON.stringify(bad)} refused`);
    }
  }
  assert.ok(validateClaim(null).length > 0, 'a null claim is refused');
  assert.ok(validateClaim('a string').length > 0, 'a non-object claim is refused');
  assert.ok(validateClaim([]).length > 0, 'an array claim is refused');
});

test('a fully valid claim produces no errors', () => {
  assert.deepEqual(validateClaim(validClaim()), []);
  assert.deepEqual(validateClaim(validClaim({ wp_id: null })), [], 'an explicit null wp_id is valid');
  assert.deepEqual(validateClaim(validClaim({ wp_id: 'WP-1' })), [], 'a real wp_id is valid');
  assert.ok(validateClaim(validClaim({ wp_id: '  ' })).some((e) => e.includes('wp_id')), 'a blank wp_id is refused');
});

// ══ 5. THE OPTIONAL MACHINE-CHECKED SCOPE DISCLOSURE ═══════════════════════

test('claim.scoped_to absent ⇒ no check at all (every existing claim file still works)', () => {
  assert.deepEqual(validateClaim(validClaim(), { paths: ['a.mjs'] }), [], 'scoped review, no declaration, no error');
  assert.deepEqual(validateClaim(validClaim(), { paths: [] }), [], 'unscoped review, no declaration, no error');
  assert.deepEqual(validateClaim(validClaim({ scoped_to: null }), { paths: ['a.mjs'] }), [], 'explicit null opts out');
});

test('claim.scoped_to matching the pathspec ⇒ valid, regardless of order or duplicates', () => {
  assert.deepEqual(validateClaim(validClaim({ scoped_to: ['a.mjs', 'b.mjs'] }), { paths: ['b.mjs', 'a.mjs'] }), []);
  assert.deepEqual(validateClaim(validClaim({ scoped_to: ['a.mjs', 'a.mjs'] }), { paths: ['a.mjs'] }), []);
  assert.deepEqual(validateClaim(validClaim({ scoped_to: [' a.mjs '] }), { paths: ['a.mjs'] }), [], 'whitespace normalised');
});

test('claim.scoped_to disagreeing with the pathspec ⇒ REFUSED, naming both sides', () => {
  const cases = [
    { scoped_to: ['a.mjs'], paths: ['b.mjs'] },              // wrong file
    { scoped_to: ['a.mjs'], paths: ['a.mjs', 'b.mjs'] },     // claim understates the scope
    { scoped_to: ['a.mjs', 'b.mjs'], paths: ['a.mjs'] },     // claim overstates the scope
    { scoped_to: ['a.mjs'], paths: [] },                     // claims a scope on a whole-range review
  ];
  for (const { scoped_to, paths } of cases) {
    const errors = validateClaim(validClaim({ scoped_to }), { paths });
    assert.equal(errors.length, 1, `${JSON.stringify(scoped_to)} vs ${JSON.stringify(paths)}: refused`);
    assert.ok(errors[0].includes('claim.scoped_to'), 'names the field');
    assert.ok(errors[0].includes(scoped_to[0]), 'quotes what the claim declared');
  }
  assert.ok(validateClaim(validClaim({ scoped_to: ['a.mjs'] }), { paths: [] })[0].includes('unscoped'),
    'says plainly that the review covered the whole range');
});

test('a malformed claim.scoped_to is refused rather than silently ignored', () => {
  for (const bad of ['a.mjs', 42, [''], ['a.mjs', 7], [null]]) {
    const errors = validateClaim(validClaim({ scoped_to: bad }), { paths: ['a.mjs'] });
    assert.ok(errors.some((e) => e.includes('claim.scoped_to')), `refused: ${JSON.stringify(bad)}`);
  }
});

test('normalisePaths: one normalisation feeds BOTH the pathspec and the scope check', () => {
  assert.deepEqual(normalisePaths('a.mjs, b.mjs ,, c.mjs'), ['a.mjs', 'b.mjs', 'c.mjs']);
  assert.deepEqual(normalisePaths(''), []);
  assert.deepEqual(normalisePaths(null), []);
  assert.deepEqual(normalisePaths(undefined), []);
  assert.deepEqual(normalisePaths(['  a.mjs  ', '']), ['a.mjs']);
});

// ══ 6. BEHAVIOUR THAT MUST SURVIVE THIS CHANGE ═════════════════════════════

test('PRESERVED: the pathspec reaches BOTH git calls', async () => {
  const calls = [];
  await gather({ diffChunks: [Buffer.from('+x\n')], names: 'f.mjs\n', calls }, { paths: ['f.mjs', 'g.mjs'] });
  const diffCalls = calls.filter((c) => c.args[0] === 'diff');
  assert.equal(diffCalls.length, 2, 'both the --name-only and the unified-diff call ran');
  for (const c of diffCalls) {
    const sep = c.args.indexOf('--');
    assert.ok(sep > 0, `pathspec separator present in: ${c.args.join(' ')}`);
    assert.deepEqual(c.args.slice(sep + 1), ['f.mjs', 'g.mjs'], 'the same paths reached this call');
  }
});

test('PRESERVED: scoped_to records the pathspec, and is null when unscoped', async () => {
  const scoped = await gather({ diffChunks: [Buffer.from('+x\n')] }, { paths: ['f.mjs'] });
  assert.deepEqual(scoped.scoped_to, ['f.mjs']);
  const unscoped = await gather({ diffChunks: [Buffer.from('+x\n')] });
  assert.equal(unscoped.scoped_to, null);
  assert.equal(unscoped.diff_range, `${BASE}..${HEAD}`, 'the evidence range stays a PURE machine range');
});

test('PRESERVED: fail-closed on unresolved evidence — head, base and diff each block', async () => {
  const head = await gather({ failHead: true });
  assert.equal(head.resolved, false);
  assert.match(head.blocker, /head unresolvable/);

  const base = await gather({ failBase: true });
  assert.equal(base.resolved, false);
  assert.match(base.blocker, /base unresolvable/);

  const diff = await gather({ failDiff: true });
  assert.equal(diff.resolved, false);
  assert.match(diff.blocker, /unable to collect unified diff/);
  assert.equal(diff.diff_text, null, 'no diff text is offered when the diff could not be collected');
});

test('PRESERVED: a spawn that throws is fail-closed, not a silent empty diff', async () => {
  const ev = await gatherGitEvidence({ cwd: '/nowhere', headSha: HEAD, spawn: () => { throw new Error('ENOENT git'); } });
  assert.equal(ev.resolved, false);
  assert.match(ev.blocker, /ENOENT git/);
});

// ══ 7. END TO END — the CLI actually refuses ════════════════════════════════

test('the CLI exits non-zero and names the missing field (no Codex call is reached)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewDiff-proof-'));
  try {
    const claimPath = path.join(dir, 'claim.json');
    const claim = validClaim();
    delete claim.build_id;
    fs.writeFileSync(claimPath, JSON.stringify(claim), 'utf8');

    let status = 0; let stderr = '';
    try {
      execFileSync(process.execPath, ['reviewDiff.mjs', '--repo', LOOP_DIR, '--base', 'HEAD~1', '--head', 'HEAD', '--claim', claimPath],
        { cwd: LOOP_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      status = e.status; stderr = String(e.stderr ?? '');
    }
    assert.equal(status, 2, 'refused with the BLOCKED exit code');
    assert.ok(stderr.includes('claim.build_id'), 'the operator is told which field is missing');
    assert.ok(stderr.startsWith('BLOCKED'), 'refusal is loud');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the CLI refuses a claim/scope disagreement before spending a review', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewDiff-proof-'));
  try {
    const claimPath = path.join(dir, 'claim.json');
    fs.writeFileSync(claimPath, JSON.stringify(validClaim({ scoped_to: ['tools/governor/footer.mjs'] })), 'utf8');

    let status = 0; let stderr = '';
    try {
      execFileSync(process.execPath, ['reviewDiff.mjs', '--repo', LOOP_DIR, '--base', 'HEAD~1', '--head', 'HEAD',
        '--claim', claimPath, '--paths', 'tools/governor/reorient.mjs'],
        { cwd: LOOP_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      status = e.status; stderr = String(e.stderr ?? '');
    }
    assert.equal(status, 2);
    assert.ok(stderr.includes('claim.scoped_to'), 'names the mismatched field');
    assert.ok(stderr.includes('footer.mjs') && stderr.includes('reorient.mjs'), 'shows both sides of the disagreement');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('importing reviewDiff.mjs does NOT run a review (the logic is reachable for testing)', () => {
  // If main() fired on import, this suite could not exist without invoking Codex.
  assert.equal(typeof buildReviewPacket, 'function');
  assert.equal(typeof validateClaim, 'function');
});
