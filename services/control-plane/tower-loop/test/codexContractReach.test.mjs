// WP-2G — THE REACH PROOF. Does Codex's permanent operating law actually reach the external
// process, or does it only look as though it does?
//
// The question is not rhetorical. Before this test, the `required_disposition` vocabulary that
// made Codex LOOK compliant had three possible sources — the `--output-schema` tmpfile, a
// hardcoded trailer in `codexAdapter.mjs`, and the skill file — and Codex could have produced it
// from the schema alone. The appearance of compliance was never evidence of reach.
//
// WHAT THIS PROVES: the exact bytes written to the Codex child process's `stdin` contain the
// permanent contract. It captures them through an INJECTED `spawn`, so no `codex.exe` is
// resolved, no credential is read, and NO CODEX CALL IS MADE — zero spend, and it runs on a
// machine with no Codex installed at all.
//
// WHAT THIS DOES NOT PROVE, stated so nobody reads it as more: reach up to and including the
// bytes handed to the child process. Only the live UAT proves the external process consumed them.
//
// THREE DESIGN RULES, each closing a way this test could have lied:
//
//  1. THE PATH IS IMPORTED FROM THE LOADER, NEVER RE-DERIVED. A test that computes the contract
//     path itself passes happily over a loader pointing somewhere else — which is the exact
//     failure mode being guarded against, since six loaders each held their own path expression.
//  2. THE SENTINEL IS A LITERAL HELD HERE, never imported from the source it checks. Importing
//     the constant from `codexAdapter.mjs` would make the assertion tautological: the file would
//     be checked against itself.
//  3. THE AUTH AND BINARY PROBES ARE INJECTED. `invokeCodexJson` resolved both from the HOST and
//     returned `blocked` BEFORE any spawn. On CI there is no `~/.codex/auth.json`, so the injected
//     spawn would never have run, nothing would have reached `stdin`, and this test would have
//     passed on a developer machine and failed in CI — or, written loosely, passed BY BLOCKING.
//     A false green inside the test built to kill false greens.
//
// THE MUTATION HALF IS NOT OPTIONAL. A reach assertion that has never been made to fail is not
// evidence. Each mutation below re-runs the SAME assertion under a broken input and requires it to
// throw, printing the failure it caught so the run output carries the negative evidence too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

// RULE 1 — imported, never re-derived.
import {
  CODEX_CONTRACT_PATH,
  CODEX_CLASSIFICATION_PATH,
  loadCodexContract,
  assertDeliveredContract,
  parseContractFrontmatter,
} from '../../review/codexAdapter.mjs';
import { runMergeReview } from '../supervisorCodex.mjs';
import { QA_SKILL as REVIEW_DIFF_QA_SKILL } from '../reviewDiff.mjs';
import { QA_SKILL as DEMO_QA_SKILL } from '../demo-merge-review.mjs';
import { DEFAULT_APPROVED_SKILL_PATH as PRODUCT_QA_SKILL } from '../../review/productQaPrompt.mjs';

// RULE 2 — the sentinel as a LITERAL in this file. If the contract's wording is refined, this
// line is what still proves identity; if this line is changed to match a file that lost the
// sentinel, that is a deliberate act, not a drift.
const SENTINEL = 'F247-CODEX-CONTRACT-SENTINEL-1';

// A phrase from the contract's own body that carries one of the seven required outcomes. It is a
// second, independent literal: the sentinel proves WHICH FILE arrived, this proves the LAW did.
const O5_LITERAL = 'The existence of an upcoming merge must NOT itself force `DECISION_REQUIRED`';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-contract-reach-'));
const tmpFile = (text, name = `${randomUUID()}.md`) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, text, 'utf8');
  return p;
};

/** A ratified copy of the REAL shipped contract — same bytes, three frontmatter fields flipped.
 *  Warwick's ratification is a human act this test must never simulate on the real file, so the
 *  ratified path is exercised on a fixture and the real file is exercised on the refusal path. */
function ratifiedFixture() {
  const raw = fs.readFileSync(CODEX_CONTRACT_PATH, 'utf8');
  const ratified = raw
    .replace(/^status: .*$/m, 'status: approved')
    .replace(/^governs_live: .*$/m, 'governs_live: true')
    .replace(/^standing_use_ratified: .*$/m, 'standing_use_ratified: true');
  assert.notEqual(ratified, raw, 'the fixture must actually differ from the shipped file');
  return tmpFile(ratified, 'ratified-contract.md');
}

/** A fake `codex exec` child. Records every byte written to stdin; spawns nothing. */
function makeCapturingSpawn() {
  const captured = [];
  const spawn = (bin, argv, opts) => {
    const child = new EventEmitter();
    child.pid = 4242;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    let buf = '';
    child.stdin = {
      write(chunk) { buf += String(chunk); },
      end() {
        captured.push({ bin, argv, cwd: opts?.cwd, bytes: buf });
        // A well-formed JSONL result so the caller's happy path completes; the VERDICT is not
        // what is under test here, the delivered bytes are.
        setImmediate(() => {
          child.stdout.emit('data', Buffer.from(`${JSON.stringify({
            type: 'item.completed',
            item: {
              type: 'agent_message',
              text: JSON.stringify({
                status: 'ok', verdict: 'approve', summary: 'fake — no codex was invoked',
                claims_verified: [], acceptance_results: [], prior_finding_results: [], findings: [],
                proposed_action: { type: 'post_review', target: '' },
              }),
            },
          })}\n`));
          child.emit('close', 0);
        });
      },
    };
    return child;
  };
  spawn.captured = captured;
  return spawn;
}

const AUTH_OK = () => ({ authenticated: true, method: 'api-key', authPath: null, keyNames: null });
const BIN_OK = () => ({ path: path.join(TMP, 'fake-codex.exe'), source: 'injected', error: null });

const PACKET = {
  checkpoint_id: 'wp2g-reach', build_id: 'BUILD-020', wp_id: 'WP-2G',
  repo: 'warwickallan/Fusion247PKA', branch: 'build-020/codex-permanent-contract',
  head_sha: 'a'.repeat(40), base_sha: 'b'.repeat(40), diff_range: `${'b'.repeat(40)}..${'a'.repeat(40)}`,
  changed_files: ['services/control-plane/review/prompts/tower-qa-skill.md'],
  diff_text: '+++ staged diff placeholder\n',
  summary: 'reach proof', brief_ref: 'WO-2026-08-05-05', brief_excerpt: 'Acceptance: the law reaches stdin.',
};

/**
 * THE ASSERTION UNDER TEST — one function, used by the positive case AND by every mutation.
 *
 * Load the contract from `contractPath`, drive the REAL `runMergeReview` with an injected spawn,
 * and assert the captured `stdin` bytes carry the law. Reused verbatim by the mutation half so a
 * mutation is proven to break THIS assertion, not a weakened restatement of it.
 */
async function assertLawReachesStdin({ contractPath, forceSkillText = null }) {
  const spawn = makeCapturingSpawn();
  const contract = loadCodexContract({ contractPath });
  assert.equal(contract.ok, true, `contract must load: ${contract.error ?? ''}`);

  const delivered = forceSkillText === null ? contract.text : forceSkillText;
  const res = await runMergeReview({
    qaSkillText: delivered, packet: PACKET, cwd: TMP,
    spawn, authProbe: AUTH_OK, resolveBin: BIN_OK, timeoutMs: 10000,
  });

  assert.equal(spawn.captured.length, 1, 'the child was spawned exactly once and stdin was closed');
  const bytes = spawn.captured[0].bytes;
  assert.ok(bytes.length > 0, 'something was actually written to stdin');

  // THE ACCEPTANCE PROPERTY.
  assert.ok(bytes.includes(SENTINEL), `the delivered stdin bytes must carry the contract sentinel "${SENTINEL}"`);
  assert.ok(bytes.includes(O5_LITERAL), 'the delivered stdin bytes must carry the contract\'s operating law (O-5)');
  assert.ok(bytes.includes('three judgements'),
    'the APPROVED classification amendment must be delivered WITH the contract');

  // Provenance: the bytes delivered are the bytes loaded and validated.
  assert.equal(assertDeliveredContract(delivered, contract), null, 'delivered bytes match the loaded+validated contract');
  assert.equal(res.blocked, false, `the review must not be blocked (${res.result?.blocker ?? ''})`);
  return { bytes, contract, argv: spawn.captured[0].argv };
}

/** Run `fn`, require it to throw, and PRINT what it threw — the negative evidence, in the output. */
async function mustFail(label, fn) {
  let caught = null;
  try { await fn(); } catch (e) { caught = e; }
  assert.ok(caught, `MUTATION DID NOT BITE — "${label}" was expected to fail the reach assertion and did not`);
  console.log(`[mutation] ${label}\n           caught: ${String(caught.message).split('\n')[0]}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. THE CONTRACT ITSELF
// ──────────────────────────────────────────────────────────────────────────────

test('R1 — the contract exists at the loader\'s own exported path, parses, and carries the sentinel', () => {
  assert.ok(fs.existsSync(CODEX_CONTRACT_PATH), `contract must exist at ${CODEX_CONTRACT_PATH}`);
  const raw = fs.readFileSync(CODEX_CONTRACT_PATH, 'utf8');
  const fm = parseContractFrontmatter(raw);
  assert.equal(fm.ok, true, 'the contract has a frontmatter block');
  for (const key of ['artifact', 'version', 'status', 'governs_live', 'owner']) {
    assert.ok(key in fm.fields, `frontmatter carries the sibling key shape: ${key}`);
  }
  assert.ok(raw.includes(SENTINEL), 'the contract carries its delivery sentinel');
  assert.ok(raw.includes(O5_LITERAL), 'the contract carries O-5 verbatim');
  // It lives in the runtime prompts directory beside its two siblings — not under Builds/**.
  assert.equal(path.basename(path.dirname(CODEX_CONTRACT_PATH)), 'prompts');
  assert.ok(!CODEX_CONTRACT_PATH.replace(/\\/g, '/').includes('/Builds/'),
    'the contract is a runtime asset, not a build record');
  assert.ok(fs.existsSync(CODEX_CLASSIFICATION_PATH), 'the APPROVED classification amendment sits beside it');
});

test('R2 — the SHIPPED contract is REFUSED while unratified, and the refusal names why', () => {
  // The gate proven in the direction that matters. Warwick ratifies the wording; nothing else
  // does, and until he has, the live route must not run a review under it.
  const raw = fs.readFileSync(CODEX_CONTRACT_PATH, 'utf8');
  const fm = parseContractFrontmatter(raw);
  const declaredRatified = /^true$/i.test(fm.fields.governs_live ?? '')
    || /^true$/i.test(fm.fields.standing_use_ratified ?? '')
    || fm.fields.status === 'approved';
  const loaded = loadCodexContract({ contractPath: CODEX_CONTRACT_PATH });
  assert.equal(loaded.ok, declaredRatified,
    `the loader's verdict must follow the shipped frontmatter (declared ratified=${declaredRatified})`);
  if (!declaredRatified) {
    assert.match(loaded.error, /NOT RATIFIED/, 'the refusal names ratification, not something vague');
    assert.match(loaded.error, /Warwick ratifies it/, 'and names who ratifies it');
  }
  console.log(`[contract] shipped state: status=${fm.fields.status} governs_live=${fm.fields.governs_live} `
    + `standing_use_ratified=${fm.fields.standing_use_ratified} → loadable=${loaded.ok}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. REACH — the acceptance property
// ──────────────────────────────────────────────────────────────────────────────

test('R3 — a RATIFIED contract reaches the exact bytes written to the Codex child\'s stdin', async () => {
  const { bytes, contract, argv } = await assertLawReachesStdin({ contractPath: ratifiedFixture() });
  // The law is delivered FIRST, ahead of the packet and the staged diff — position matters,
  // because a reviewer reads its instructions before its evidence.
  assert.ok(bytes.indexOf(SENTINEL) < bytes.indexOf('── THIS REVIEW TURN'),
    'the contract precedes the review packet in the delivered bytes');
  assert.equal(contract.fingerprint.length, 64, 'a sha256 was computed over the delivered bytes');
  assert.ok(argv.includes('--sandbox') && argv.includes('read-only'), 'the read-only posture is on the argv');
  assert.ok(argv.includes('--ignore-user-config'), 'the host persona cannot be adopted');
  console.log(`[reach] ${bytes.length} bytes reached stdin; contract sha256=${contract.fingerprint}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. THE MUTATION HALF — without this, none of the above is evidence
// ──────────────────────────────────────────────────────────────────────────────

test('R4 — MUTATION: empty law, an unratified fixture, and a stale loader path each FAIL the reach assertion', async () => {
  const ratified = ratifiedFixture();

  // (a) EMPTY LAW. The historical defect verbatim: "the loop ran an empty/thin skillText".
  await mustFail('skillText: \'\' (empty law delivered)', () => assertLawReachesStdin({ contractPath: ratified, forceSkillText: '' }));

  // (a2) And the subtler version: real-looking law that is not THIS contract.
  await mustFail('substituted law (plausible text, no sentinel)',
    () => assertLawReachesStdin({ contractPath: ratified, forceSkillText: '# Some other reviewer prompt\nBe thorough.\n' }));

  // (b) UNRATIFIED FIXTURE — the degradation risk that is not an absent file.
  const unratified = tmpFile(fs.readFileSync(CODEX_CONTRACT_PATH, 'utf8'), 'unratified-contract.md');
  await mustFail('unratified frontmatter (status: draft, governs_live: false)',
    () => assertLawReachesStdin({ contractPath: unratified }));

  // (c) A LOADER POINTING AT A STALE PATH — the contract's OLD home under the build record.
  // This is the real-world version of the failure: a loader nobody repointed. While the old file
  // still exists it is refused for carrying no sentinel (it is not this contract); once it is
  // deleted it is refused for being absent. Either way the mutation bites, which is the property
  // being proven — a loader pointing elsewhere must never reach a review.
  const staleHome = path.resolve(CODEX_CONTRACT_PATH, '..', '..', '..', '..', '..',
    'Builds', 'BUILD-010-fusion-tower', 'baton-mvp', 'tower-qa-skill.md');
  await mustFail('stale loader path (the old BUILD-010 home)', () => assertLawReachesStdin({ contractPath: staleHome }));
  await mustFail('stale loader path (a path that no longer exists)',
    () => assertLawReachesStdin({ contractPath: path.join(TMP, 'no-such-contract.md') }));

  // (d) A contract with no frontmatter at all.
  await mustFail('no frontmatter block',
    () => assertLawReachesStdin({ contractPath: tmpFile('# not a governing text\nbody only\n', 'no-fm.md') }));

  // (e) The classification amendment gone — it is LIVE governance, so its absence is fail-closed.
  await mustFail('classification amendment missing', () => {
    const c = loadCodexContract({ contractPath: ratified, classificationPath: path.join(TMP, 'nope.md') });
    assert.equal(c.ok, true, `contract must load: ${c.error ?? ''}`);
  });

  // (f) THE CONTROL ON THE CONTROL. The injected auth/bin probes must be what makes the spawn
  // happen — otherwise every assertion above could be passing on a machine that happens to have
  // Codex installed, and failing in CI. Force the auth probe to say "no credential" and the
  // capture must be EMPTY, proving the spawn never ran.
  const spawn = makeCapturingSpawn();
  const contract = loadCodexContract({ contractPath: ratified });
  const res = await runMergeReview({
    qaSkillText: contract.text, packet: PACKET, cwd: TMP, spawn, timeoutMs: 10000,
    authProbe: () => ({ authenticated: false, method: 'none' }), resolveBin: BIN_OK,
  });
  assert.equal(res.blocked, true, 'no credential ⇒ fail-closed block');
  assert.equal(spawn.captured.length, 0,
    'and NOTHING was written to stdin — so a passing reach assertion above genuinely required the spawn');
  console.log('[mutation] auth probe denied → 0 bytes captured (the reach assertion cannot pass by blocking)');
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. NO LOADER POINTS ELSEWHERE
// ──────────────────────────────────────────────────────────────────────────────

test('R5 — every live loader resolves the contract from the ONE exported constant', () => {
  // Imported from each loader's own export (rule 1). `mergeCheck.mjs` and `watcher.mjs` are
  // covered by R6 instead: importing them pulls in the SQLite store driver, and a reach proof
  // must not require a native build to run.
  assert.equal(REVIEW_DIFF_QA_SKILL, CODEX_CONTRACT_PATH, 'reviewDiff.mjs');
  assert.equal(DEMO_QA_SKILL, CODEX_CONTRACT_PATH, 'demo-merge-review.mjs');
  assert.equal(PRODUCT_QA_SKILL, CODEX_CONTRACT_PATH, 'productQaPrompt.mjs (test-only route, kept in step)');
});

test('R6 — no module in the estate holds a private path to the governing contract', () => {
  // STATED PLAINLY: this is a source assertion — a check on the TEXT of files, not on runtime
  // behaviour. It exists because `mergeCheck.mjs` and `watcher.mjs` cannot be imported without the
  // native SQLite driver, and because it catches the NEXT loader too: a seventh reader added later
  // with its own `path.join(...)` is exactly how the six drifted apart in the first place.
  const roots = [
    path.resolve(CODEX_CONTRACT_PATH, '..', '..', '..'),                       // services/control-plane
    path.resolve(CODEX_CONTRACT_PATH, '..', '..', '..', '..', 'tower-baton'),  // services/tower-baton
  ];
  const SELF = path.basename(new URL(import.meta.url).pathname);
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(e.name) && e.name !== SELF) files.push(p);
    }
  };
  for (const r of roots) if (fs.existsSync(r)) walk(r);
  assert.ok(files.length > 20, `the sweep actually read the tree (found ${files.length} modules)`);

  const offenders = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    // Any executable line that both names the old build home AND builds a path to the skill.
    for (const line of src.split(/\r?\n/)) {
      const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '');
      if (!code) continue;
      if (/BUILD-010-fusion-tower/.test(code) && /tower-qa-skill/.test(code)) {
        offenders.push(`${path.relative(roots[0], f)}: ${line.trim().slice(0, 120)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `a module still points at the old BUILD-010 contract home:\n  ${offenders.join('\n  ')}`);

  // …and the two store-bound loaders positively resolve it from the shared constant.
  for (const rel of ['tower-loop/mergeCheck.mjs', 'tower-loop/watcher.mjs']) {
    const src = fs.readFileSync(path.join(roots[0], rel), 'utf8');
    assert.match(src, /CODEX_CONTRACT_PATH/, `${rel} resolves the contract from the shared exported constant`);
    assert.match(src, /loadCodexContract/, `${rel} loads it through the validating loader, not a bare readFileSync`);
  }
});
