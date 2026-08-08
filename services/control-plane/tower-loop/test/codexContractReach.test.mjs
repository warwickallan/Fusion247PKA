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
  buildCodexPrompt,
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

// A third independent literal, added 2026-08-07 (WO-2026-08-07-4C-01): §3b's merge-class
// estate-convergence responsibility. Same rule as the two above — held HERE, outside the file it
// checks. It exists because 4C's acceptance turns on the LIVE loader consuming the AMENDED bytes,
// and a contract that merely contains new law on disk proves nothing about what reached stdin.
// If §3b is ever reworded, this line is what proves the obligation still arrives.
// MOVED DELIBERATELY TWICE, both on 2026-08-08 — each time because §3b's governing question itself
// changed, which is precisely the event this pin exists to make visible.
//
//   1. `Will this merge actually CONVERGE THE ESTATE?`      (WO-4C-09 replaced it: that sentence WAS
//      the MERGE/CONVERGENCE overload being corrected)
//   2. `TOGETHER WITH THE EVIDENCED RECONCILIATION ACTIONS` (WO-4C-11 replaced it: Question 2 was
//      reframed off a prediction about the post-merge estate and onto the observable present)
//
// The literal now pins the PRESENT-TENSE FRAMING, which is the property that would be silently lost
// if §3b were ever reverted to asking a reviewer to certify a future estate it cannot observe.
// Retaining a superseded literal merely to keep this test green would preserve the defect in the
// delivered law — the pin follows the law, never the other way round.
const CONVERGENCE_LITERAL = 'AS IT EXISTS AT THIS MERGE BOUNDARY';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-contract-reach-'));
const tmpFile = (text, name = `${randomUUID()}.md`) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, text, 'utf8');
  return p;
};

/** A ratified copy of the REAL shipped contract — same bytes, three frontmatter fields FORCED to
 *  ratified values outright, independent of what the shipped file currently ships as (it may
 *  already be ratified, or not — this fixture must be genuinely ratified by construction either
 *  way, never by lucky agreement with the live file's current state).
 *  Warwick's ratification is a human act this test must never simulate on the real file, so the
 *  ratified path is exercised on a fixture and the real file is exercised on the refusal path. */
function ratifiedFixture() {
  const raw = fs.readFileSync(CODEX_CONTRACT_PATH, 'utf8');
  const ratified = raw
    .replace(/^status:.*$/m, 'status: approved')
    .replace(/^governs_live:.*$/m, 'governs_live: true')
    .replace(/^standing_use_ratified:.*$/m, 'standing_use_ratified: true');
  // Positive assertion, not a diff against `raw`: the shipped file may itself already be
  // ratified, in which case `ratified === raw` is the CORRECT outcome, not a defect. What must
  // be proven is that the fixture carries the ratified values, by construction — not that it
  // differs from whatever the shipped file happens to ship today.
  assert.match(ratified, /^status: approved$/m, 'the fixture must declare status: approved');
  assert.match(ratified, /^governs_live: true$/m, 'the fixture must declare governs_live: true');
  assert.match(ratified, /^standing_use_ratified: true$/m,
    'the fixture must declare standing_use_ratified: true');
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
async function assertLawReachesStdin({ contractPath, forceSkillText = null, packet = PACKET }) {
  const spawn = makeCapturingSpawn();
  const contract = loadCodexContract({ contractPath });
  assert.equal(contract.ok, true, `contract must load: ${contract.error ?? ''}`);

  const delivered = forceSkillText === null ? contract.text : forceSkillText;
  const res = await runMergeReview({
    qaSkillText: delivered, packet, cwd: TMP,
    spawn, authProbe: AUTH_OK, resolveBin: BIN_OK, timeoutMs: 10000,
  });

  assert.equal(spawn.captured.length, 1, 'the child was spawned exactly once and stdin was closed');
  const bytes = spawn.captured[0].bytes;
  assert.ok(bytes.length > 0, 'something was actually written to stdin');

  // THE ACCEPTANCE PROPERTY.
  assert.ok(bytes.includes(SENTINEL), `the delivered stdin bytes must carry the contract sentinel "${SENTINEL}"`);
  assert.ok(bytes.includes(O5_LITERAL), 'the delivered stdin bytes must carry the contract\'s operating law (O-5)');
  assert.ok(bytes.includes(CONVERGENCE_LITERAL),
    'the delivered stdin bytes must carry §3b — the merge-class estate-convergence responsibility');
  assert.ok(bytes.includes('three judgements'),
    'the APPROVED classification amendment must be delivered WITH the contract');
  assert.ok(bytes.includes('ONE full merge-class review of the final stable candidate'),
    'the amended merge-class round discipline must be delivered WITH the contract (classification amendment)');

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
  assert.ok(raw.includes(CONVERGENCE_LITERAL), 'the contract carries §3b (merge-class estate convergence) verbatim');
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

  // (a3) THE PRE-AMENDMENT CONTRACT — added 2026-08-07 (WO-2026-08-07-4C-01). The nastiest
  // version of this failure is not an empty or substituted law: it is the REAL, correctly
  // sentinelled, correctly ratified contract at its PREVIOUS wording, still loading and still
  // reviewing — with the merge-class convergence obligation silently absent. That delivers a
  // review that looks entirely healthy and cannot block a merge for stranded work. Strip §3b from
  // an otherwise-genuine copy and the reach assertion must bite; if it does not, the convergence
  // literal above is decoration.
  const preAmendment = fs.readFileSync(ratified, 'utf8').replace(CONVERGENCE_LITERAL, 'Is the diff sound?');
  assert.ok(!preAmendment.includes(CONVERGENCE_LITERAL), 'the pre-amendment fixture genuinely lacks §3b');
  assert.ok(preAmendment.includes(SENTINEL), 'and it is otherwise the real contract — sentinel intact');
  await mustFail('pre-amendment contract (real + ratified, but §3b convergence law absent)',
    () => assertLawReachesStdin({ contractPath: tmpFile(preAmendment, 'pre-amendment-contract.md') }));

  // (b) UNRATIFIED FIXTURE — the degradation risk that is not an absent file. Built the same way
  // as ratifiedFixture(), in reverse: the three frontmatter fields are FORCED to unratified
  // values outright on a copy of the shipped file, independent of what the shipped file
  // currently ships as (it may itself already be ratified — this fixture must be genuinely
  // unratified by construction either way, never by assuming production still ships unratified).
  const unratifiedRaw = fs.readFileSync(CODEX_CONTRACT_PATH, 'utf8')
    .replace(/^status:.*$/m, 'status: draft')
    .replace(/^governs_live:.*$/m, 'governs_live: false')
    .replace(/^standing_use_ratified:.*$/m, 'standing_use_ratified: false');
  assert.match(unratifiedRaw, /^status: draft$/m, 'the fixture must declare status: draft');
  assert.match(unratifiedRaw, /^governs_live: false$/m, 'the fixture must declare governs_live: false');
  assert.match(unratifiedRaw, /^standing_use_ratified: false$/m,
    'the fixture must declare standing_use_ratified: false');
  const unratified = tmpFile(unratifiedRaw, 'unratified-contract.md');
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
// 3b. THE ESTATE-CONVERGENCE INVENTORY REACHES STDIN (WO-2026-08-07-4C-03)
//
// WO-4C-01 proved §3b's LAW reaches the child. That left the obligation live and the evidence for
// it absent — Codex was told to establish nine convergence properties from staged evidence that
// was never staged. These three tests are the other half: the EVIDENCE reaches the same bytes.
//
// They exercise the real `runMergeReview` → `buildCodexPrompt` path with the same injected spawn,
// so what is asserted is the bytes written to the child's stdin, not a property of a packet object
// sitting in memory. A packet field that never renders is exactly the defect reviewDiff.mjs:144
// already documents: buildCodexPrompt "renders a FIXED WHITELIST of packet keys and silently drops
// anything it does not know", so a `convergence` key that looked right would have reached the
// reviewer NOT AT ALL.
// ──────────────────────────────────────────────────────────────────────────────

// A literal held HERE, outside the renderer it checks — same rule as SENTINEL and O5_LITERAL.
const CONVERGENCE_BLOCK_HEADING = '── STAGED ESTATE-CONVERGENCE EVIDENCE (merge-class)';
const INVENTORY_FIXTURE = [
  'ESTATE CONVERGENCE INVENTORY — gathered by execution at packet-build time.',
  '[1] LOCAL BRANCHES (2 total, 1 NOT contained in main)',
  '  build-020/4c-estate-convergence  6ae592cda638  files_absent_from_main=12',
].join('\n');

test('R7 — a staged convergence inventory reaches the exact bytes written to the child\'s stdin', async () => {
  const { bytes } = await assertLawReachesStdin({
    contractPath: ratifiedFixture(),
    packet: { ...PACKET, convergence: INVENTORY_FIXTURE },
  });
  assert.ok(bytes.includes(CONVERGENCE_BLOCK_HEADING),
    'the delivered bytes carry the labelled convergence section header');
  assert.ok(bytes.includes('files_absent_from_main=12'),
    'and the inventory CONTENT itself — the by-content stranded measure — not merely a header');
  // §3b tells the reviewer it must judge on staged evidence. The evidence must therefore arrive
  // AFTER the law that instructs it, exactly as the diff does.
  assert.ok(bytes.indexOf(SENTINEL) < bytes.indexOf(CONVERGENCE_BLOCK_HEADING),
    'the contract precedes the convergence evidence in the delivered bytes');
  // And it is labelled as evidence rather than as a verdict, so a reviewer cannot read a staged
  // fact as a staged conclusion.
  assert.ok(bytes.includes('not a convergence verdict'),
    'the block states plainly that it is evidence, not a verdict');
  console.log(`[reach-4c] convergence block delivered; ${bytes.length} total bytes to stdin`);
});

test('R8 — ABSENT-KEY EQUIVALENCE: a packet without `convergence` renders BYTE-IDENTICALLY to before', () => {
  // The whole justification for putting this in the shared renderer is that every other caller —
  // the delivery-review path, reviewDiff.mjs, fableAdapter.mjs — is untouched. That is asserted
  // here rather than claimed in a comment, because a rendering only BELIEVED to be inert is how an
  // unrelated review turn quietly acquires a new section.
  const skill = '# law\nbody\n';
  const withoutKey = buildCodexPrompt({ skillText: skill, packet: PACKET });
  const withNull = buildCodexPrompt({ skillText: skill, packet: { ...PACKET, convergence: null } });
  const withEmpty = buildCodexPrompt({ skillText: skill, packet: { ...PACKET, convergence: '' } });
  assert.equal(withNull, withoutKey, 'convergence: null renders identically to the key being absent');
  assert.equal(withEmpty, withoutKey, 'convergence: \'\' renders identically too — an empty inventory is never staged as one');
  assert.ok(!withoutKey.includes(CONVERGENCE_BLOCK_HEADING), 'and no convergence section appears at all');

  // THE CONTROL. Byte-equality above proves nothing unless the comparison can also detect a
  // difference — otherwise it would pass over a renderer that ignored the field entirely.
  const withKey = buildCodexPrompt({ skillText: skill, packet: { ...PACKET, convergence: INVENTORY_FIXTURE } });
  assert.notEqual(withKey, withoutKey, 'CONTROL: a populated inventory DOES change the bytes');
  assert.ok(withKey.includes(CONVERGENCE_BLOCK_HEADING) && withKey.includes('files_absent_from_main=12'));
  console.log(`[reach-4c] absent-key equivalence holds; populated block adds ${withKey.length - withoutKey.length} bytes`);
});

test('R9 — a FAILED PROBE is visible in the delivered bytes and never renders as a clean estate', async () => {
  // The property the Work Order calls load-bearing, asserted at the delivery boundary rather than
  // at the gatherer's return value. A probe failure that got lost between the inventory and the
  // child's stdin would leave a reviewer judging a non-converged estate as converged.
  const failedInventory = [
    'ESTATE CONVERGENCE INVENTORY — gathered by execution at packet-build time.',
    'probes: 10 run, 3 FAILED — sections below name each one',
    '[1] LOCAL BRANCHES',
    '  PROBE FAILED: git for-each-ref --format=... refs/heads — fatal: not a git repository',
  ].join('\n');
  const { bytes } = await assertLawReachesStdin({
    contractPath: ratifiedFixture(),
    packet: { ...PACKET, convergence: failedInventory },
  });
  assert.ok(bytes.includes('PROBE FAILED: git for-each-ref'), 'the probe failure itself reaches stdin');
  assert.ok(bytes.includes('3 FAILED'), 'and the top-of-block failure count reaches stdin');
  // The renderer must also TELL the reviewer how to read that line, or a failed probe is just an
  // odd string in a wall of text.
  assert.ok(bytes.includes('"PROBE FAILED:" means that fact could NOT be established'),
    'the delivered bytes instruct the reviewer to treat a failed probe as missing evidence');
  assert.ok(bytes.includes('never as a clean result'),
    'and explicitly forbid reading it as a clean result');
  console.log('[reach-4c] probe failure is visible in the delivered bytes');
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
