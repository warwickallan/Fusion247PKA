// WO-2026-08-05-09 (WP-2E) — TowerBot carries the real Codex/Larry QA exchange.
//
// Proves the four wires against the settled §14.7 design: W1 (openFindingsFromMergeReview),
// W2 (composeVerdictComment lists real ids), W3 (composeFindingsMessage — findings reach
// Telegram with real content), W4 (readDisposedFindings / sendDispositionNotifications — the
// disposition echo renders from the STORE after the write, never from what was claimed).
//
// `node:test` style (matches notify.test.mjs), with its own throwaway SQLite store via
// before()/after() hooks — no spawned watcher process is needed, because every case here drives
// processTurn / pollPrComments / the composers directly, in-process, the same way this suite's
// own W1–W8 section (run-tower-loop-tests.mjs) already does.
//
// Run standalone:  node --test test/qaExchange.test.mjs
// Run as part of the aggregate:  node test/run-tower-loop-tests.mjs (spawns this file and
// asserts its own `# pass`/`# fail` counts — the same idiom already used for WP-2G's
// codexContractReach.test.mjs, so this suite cannot become a green that proves nothing).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDb } from '../db.mjs';
import {
  applySchema, applyWatcherSchema, applyCommentSchema, applyPostSchema, applyMergeCheckSchema,
} from '../apply.mjs';
import { seedPrompt } from '../seed.mjs';
import { ingestTurn } from '../loop.mjs';
// watcher.mjs is DELIBERATELY NOT a static import here. Its exported `QA_SKILL_PATH` is a `const`
// computed ONCE at module-evaluation time from `process.env.TOWER_QA_SKILL_PATH`, so setting that
// env var after a static import would already be too late — the binding would have frozen onto
// the real (unratified) production contract. before() sets the env var, THEN dynamically imports
// watcher.mjs, so its module-load-time read sees the test fixture. See the fixture's own header
// (test/fixtures/qa-exchange-ratified-test-skill.md) for why this override exists at all.
import { composeFindingsMessage, composeDispositionMessage } from '../notify.mjs';
import { composeVerdictComment, queueVerdictForTurn } from '../postVerdict.mjs';
import { ingestPrComment } from '../ingestComment.mjs';
import { pollPrComments } from '../pollPrComments.mjs';
import { makeFakeGh, ghComment } from './doubles/fakeGh.mjs';
import { runMergeReview as fakeRunMergeReview } from './doubles/fakeReviewer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tower-qa-exchange-'));
const DB_PATH = path.join(TMP_DIR, 'tower.db');

const REPO = 'warwickallan/Fusion247PKA';
const PR = 5150;
const HEAD_A = 'e1e2e3e4e5e60718293a4b5c6d7e8f9012345678';
const HEAD_B = 'f1f2f3f4f5f60718293a4b5c6d7e8f9012345670';

let pool;
let processTurn, openFinding, openFindingsFromMergeReview, formatMergeFindingDescription,
  readDisposedFindings, sendDispositionNotifications;

before(async () => {
  // MUST happen before watcher.mjs is ever imported (dynamically, right below) — see the import
  // comment above.
  process.env.TOWER_QA_SKILL_PATH = path.join(__dirname, 'fixtures', 'qa-exchange-ratified-test-skill.md');
  ({
    processTurn, openFinding, openFindingsFromMergeReview, formatMergeFindingDescription,
    readDisposedFindings, sendDispositionNotifications,
  } = await import('../watcher.mjs'));

  pool = openDb(DB_PATH);
  await applySchema(pool);
  await applyWatcherSchema(pool);
  await applyCommentSchema(pool);
  await applyPostSchema(pool);
  await applyMergeCheckSchema(pool);
  await seedPrompt(pool);
  process.env.TOWER_MERGE_CLASS_HEURISTIC = 'off';
});

after(async () => {
  await pool.end();
  delete process.env.TOWER_QA_SKILL_PATH;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// Deterministic Git evidence — resolved, one changed file, mirrors doubles/fakeGitEvidence.mjs.
async function fakeGitEvidence({ repo = null, headSha = null, baseSha = null, prNumber = null } = {}) {
  return {
    resolved: true, blocker: null,
    repo: repo || REPO, branch: 'test-branch',
    base_sha: baseSha || 'cafebabe11112222333344445555666677778888', head_sha: headSha,
    diff_range: `${baseSha}..${headSha}`,
    changed_files: ['services/control-plane/tower-loop/example.mjs'],
    diff_text: 'diff --git a/x b/x\n+line', diff_truncated: false,
    ci_checks: prNumber != null ? 'checks: passing (fake)' : null,
    ci_source: prNumber != null ? 'gh pr checks (fake)' : 'unavailable',
    collected_at: new Date().toISOString(),
  };
}

// An aligned/continue delivery verdict by default — the merge-class QA (fakeRunMergeReview) is
// what actually drives the findings in these tests, via the packet's `summary` marker.
async function fakeRunSupervisor() {
  return {
    ok: true, blocked: false, modelId: 'fake-reviewer',
    result: {
      status: 'ok', aligned: true, over_engineering: false, drifting: false, administering: false,
      warwick_needed: false, verdict: 'continue', next_action: 'ship it', summary: 'aligned',
    },
  };
}

const sentNotes = []; // captured Telegram sends for the in-process notify spy
async function spyNotify(p, args) {
  sentNotes.push(args);
  const parts = (Array.isArray(args.message) ? args.message : [args.message]).filter((m) => typeof m === 'string' && m.trim() !== '');
  const stored = parts.join('\n----\n');
  const claim = await p.query(
    `insert into tower.notification (turn_id, reason, state, message, telegram_ok)
     values (?, ?, ?, ?, 0)
     on conflict (turn_id, reason) do nothing
     returning id`,
    [args.turnId, args.reason, args.state, stored],
  );
  if (claim.rows.length === 0) return { notificationId: null, deduped: true, telegram_ok: false };
  return { notificationId: claim.rows[0].id, deduped: false, telegram_ok: false, detail: 'test spy — not sent' };
}

const DEPS = {
  runSupervisor: fakeRunSupervisor,
  runMergeReview: fakeRunMergeReview,
  gatherGitEvidence: fakeGitEvidence,
  notify: spyNotify,
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── formatMergeFindingDescription (W1, pure) ───────────────────────────────────────────────────

test('formatMergeFindingDescription: embeds Codex\'s short ref with NO new column', () => {
  const d = formatMergeFindingDescription({
    id: 'TQA-001', technical_impact: 'HIGH', reachability: 'ACTIVE',
    required_disposition: 'BLOCKS_CURRENT_MERGE',
    evidence: 'leak on throw', required_correction: 'wrap in finally',
  });
  assert.match(d, /^\[TQA-001\] HIGH\/ACTIVE\/BLOCKS_CURRENT_MERGE/);
  assert.match(d, /leak on throw/);
  assert.match(d, /Required correction: wrap in finally/);
});

// ── openFindingsFromMergeReview (W1) — fail-closed shapes ──────────────────────────────────────

test('openFindingsFromMergeReview: not merge-class -> nothing opened, no error', async () => {
  const res = await openFindingsFromMergeReview(pool, { buildRef: 'BUILD-QAX-A', turnId: 'no-turn', mergeReviewRecord: null });
  assert.deepEqual(res.opened, []);
  assert.equal(res.skipped, 0);
  assert.equal(res.reason, 'not-merge-class');
});

test('openFindingsFromMergeReview: a BLOCKED merge review (evidence unresolved) opens nothing — this is the CORRECT expected shape, not a defect', async () => {
  const blockedRecord = {
    isMergeClass: true, blocked: true,
    evidence: { resolved: false, blocker: 'evidence unresolved' },
    qa: { status: 'blocked', verdict: 'blocked', summary: 'could not verify' },
  };
  const res = await openFindingsFromMergeReview(pool, { buildRef: 'BUILD-QAX-B', turnId: 'no-turn', mergeReviewRecord: blockedRecord });
  assert.deepEqual(res.opened, []);
  assert.equal(res.skipped, 0);
  assert.equal(res.reason, 'blocked-no-findings');
});

test('openFindingsFromMergeReview: FAIL-CLOSED — qa.findings present but NOT an array is reported, never crashes, never guessed', async () => {
  const malformed = { isMergeClass: true, blocked: false, qa: { findings: 'not-an-array' } };
  const res = await openFindingsFromMergeReview(pool, { buildRef: 'BUILD-QAX-C', turnId: 'no-turn', mergeReviewRecord: malformed });
  assert.deepEqual(res.opened, []);
  assert.equal(res.skipped, 0);
  assert.equal(res.reason, 'malformed-array');
});

test('openFindingsFromMergeReview: an individual malformed entry (no usable id) is skipped; the rest still open and become durable', async () => {
  const buildRef = 'BUILD-QAX-D';
  const record = {
    isMergeClass: true, blocked: false,
    qa: {
      findings: [
        { id: 'TQA-010', technical_impact: 'LOW', reachability: 'LATENT', required_disposition: 'NOTE_ONLY', evidence: 'e', required_correction: 'c' },
        { technical_impact: 'HIGH' }, // no `id` — malformed entry
        null,                          // malformed entry
      ],
    },
  };
  const res = await openFindingsFromMergeReview(pool, { buildRef, turnId: null, mergeReviewRecord: record });
  assert.equal(res.opened.length, 1);
  assert.equal(res.opened[0].codexId, 'TQA-010');
  assert.equal(res.skipped, 2);

  const { rows } = await pool.query(`select id, description, state from tower.finding where id = ?`, [res.opened[0].id]);
  assert.equal(rows.length, 1, 'the valid finding IS durable in tower.finding');
  assert.equal(rows[0].state, 'open');
  assert.match(rows[0].description, /^\[TQA-010\]/);
});

// ── W1 END-TO-END + W3 (via processTurn) ───────────────────────────────────────────────────────

test('W1+W3 END-TO-END: a merge-class round with real Codex findings opens durable tower.finding rows AND their real content reaches Telegram — never on replay', async () => {
  // classifyBuildRef requires EXACTLY /^BUILD-\d{3}$/ (classifyBuild.mjs) — a non-conforming
  // explicit buildRef silently reclassifies to 'UNCLASSIFIED' inside ingestTurn, which would make
  // this test's own build_ref filter useless. Use a real 3-digit id throughout this file.
  const buildRef = 'BUILD-901';
  const turn = await ingestTurn(pool, {
    kind: 'merge_review', headSha: HEAD_A, prNumber: PR, repo: REPO, buildRef,
    instruction: 'Warwick: review the QA-exchange wiring.',
    larryResponse: 'Larry: WITH_FINDINGS — pushed the wiring, please check it.',
  });

  const res = await processTurn(pool, turn.id, DEPS);
  assert.equal(res.findingsOpened.length, 2, 'both fake findings opened');
  assert.deepEqual(res.findingsOpened.map((f) => f.codexId).sort(), ['TQA-001', 'TQA-002']);

  const rows = (await pool.query(
    `select id, description, state from tower.finding where build_ref = ? order by created_at, rowid`, [buildRef],
  )).rows;
  assert.equal(rows.length, 2, 'exactly the two NEW findings became durable rows');
  assert.ok(rows.every((r) => r.state === 'open'));
  assert.match(rows[0].description, /^\[TQA-001\] HIGH\/ACTIVE\/BLOCKS_CURRENT_MERGE/);
  assert.match(rows[0].description, /connection leak on throw/);

  // W3 — the finding's REAL content (not a count, not a verdict word) reached a Telegram message.
  const notes = (await pool.query(`select message from tower.notification where turn_id = ?`, [turn.id])).rows;
  assert.ok(notes.length >= 1, 'a notification fired for this round');
  const combined = notes.map((n) => n.message).join('\n----\n');
  assert.match(combined, /TQA-001/, 'Codex\'s own short ref reached Telegram');
  assert.match(combined, /BLOCKS_CURRENT_MERGE/, 'the required_disposition reached Telegram');
  assert.match(combined, /connection leak on throw/, 'the evidence TEXT reached Telegram, not a count');

  // Idempotent replay: re-processing the SAME already-persisted turn must NOT double-open.
  const res2 = await processTurn(pool, turn.id, DEPS);
  assert.equal(res2.reused, true);
  const countAfter = (await pool.query(`select count(*) c from tower.finding where build_ref = ?`, [buildRef])).rows[0].c;
  assert.equal(countAfter, 2, 'replay opened NOTHING new — W1 fires exactly once per round');
});

test('W3 "findings_raised" fallback: an APPROVED merge review that still raises a non-blocking finding is NOT silent', async () => {
  const buildRef = 'BUILD-902';
  const turn = await ingestTurn(pool, {
    kind: 'merge_review', headSha: HEAD_B, prNumber: PR, repo: REPO, buildRef,
    instruction: 'Warwick: approve-with-note case.',
    larryResponse: 'Larry: WITH_FINDINGS_APPROVED — pushed, approved with one note.',
  });
  const res = await processTurn(pool, turn.id, DEPS);
  assert.equal(res.findingsOpened.length, 1);
  assert.equal(res.findingsOpened[0].codexId, 'TQA-003');

  // SCOPED, not relaxed (WO-33): this turn now also receives the `codex_qa_started` card, which fires
  // at the real execution point for every QA origin. The assertion below is about the VERDICT-PHASE
  // cards, and it stays exactly as strong as it was — still `equal(…, 1)`, never `ok(… >= 1)`.
  // Weakening the count to make a suite green is the fabrication mode this estate forbids; excluding
  // the one card that legitimately joined the turn is not.
  const notes = (await pool.query(`select reason, message from tower.notification where turn_id = ? and reason <> 'codex_qa_started'`, [turn.id])).rows;
  assert.equal(notes.length, 1, 'a notification fired even though the round was aligned+approved');
  assert.equal(notes[0].reason, 'findings_raised');
  assert.match(notes[0].message, /TQA-003/);
});

// ── W2 — composeVerdictComment / queueVerdictForTurn ───────────────────────────────────────────

test('composeVerdictComment W2 (pure): lists open findings by id, so the reply instruction is followable', () => {
  const body = composeVerdictComment({
    postKey: 'k', verdict: 'request_changes', summary: 's', nextAction: 'n', headSha: HEAD_A,
    buildRef: 'BUILD-X', turnSeq: 1, turnId: 'T1', reviewer: 'gpt_codex',
    openFindings: [{ id: 'uuid-1', description: '[TQA-001] HIGH/ACTIVE/BLOCKS_CURRENT_MERGE — leak' }],
  });
  assert.match(body, /Open findings to answer/);
  assert.match(body, /`uuid-1`/);
  assert.match(body, /TQA-001/);
});

test('composeVerdictComment W2 (pure): no open findings -> no findings section (pre-existing shape unchanged)', () => {
  const body = composeVerdictComment({ postKey: 'k', verdict: 'approve', summary: 's', headSha: HEAD_A, buildRef: 'B', turnSeq: 1, turnId: 'T1' });
  assert.ok(!body.includes('Open findings to answer'));
});

test('queueVerdictForTurn W2 INTEGRATION: the queued PR comment body lists the build\'s REAL open findings from the store', async () => {
  const buildRef = 'BUILD-903';
  const turn = await ingestTurn(pool, {
    kind: 'merge_review', headSha: HEAD_A, prNumber: PR, repo: REPO, buildRef,
    instruction: 'Warwick: w2 check.', larryResponse: 'Larry: pushed.',
  });
  const f = await openFinding(pool, { buildRef, openedTurnId: turn.id, description: '[TQA-900] LOW/LATENT/NOTE_ONLY — cosmetic' });
  await pool.query(
    `insert into tower.supervisor_review (turn_id, reviewer, verdict, summary, next_action, warwick_needed, raw_output)
     values (?, 'gpt_codex', 'request_changes', 'summary text', 'fix it', 0, '{}')`,
    [turn.id],
  );
  const q = await queueVerdictForTurn(pool, turn.id);
  assert.ok(q.claimed, 'the verdict post was claimed');
  const row = (await pool.query(`select body from tower.pr_verdict_post where id = ?`, [q.id])).rows[0];
  assert.match(row.body, new RegExp(esc(f.id)), 'the real tower.finding UUID appears in the comment');
  assert.match(row.body, /TQA-900/, 'Codex\'s ref appears alongside it');
});

// ── W3 composer (pure) ─────────────────────────────────────────────────────────────────────────

test('composeFindingsMessage (pure): empty/absent findings -> "" so an ordinary round is unchanged', () => {
  assert.equal(composeFindingsMessage({ buildRef: 'B', turnSeq: 1, turnId: 'T', findings: [] }), '');
  assert.equal(composeFindingsMessage({ buildRef: 'B', turnSeq: 1, turnId: 'T' }), '');
});

test('composeFindingsMessage (pure): renders the real finding content, not a count or a verdict word', () => {
  const msg = composeFindingsMessage({
    buildRef: 'BUILD-014', turnSeq: 7, turnId: 'T7',
    findings: [{ id: 'uuid-1', codexId: 'TQA-001', technical_impact: 'HIGH', reachability: 'ACTIVE', required_disposition: 'BLOCKS_CURRENT_MERGE', evidence: 'leak on throw' }],
  });
  assert.match(msg, /TQA-001/);
  assert.match(msg, /HIGH\/ACTIVE\/BLOCKS_CURRENT_MERGE/);
  assert.match(msg, /leak on throw/);
  assert.match(msg, /turn: T7/);
});

// ── W4 — the truncation-cap-vs-rationale proof (required acceptance evidence) ──────────────────

test('composeDispositionMessage: a rationale LONGER than summariseLarry\'s 280-char default survives INTACT', () => {
  const longRationale = 'This finding was addressed by rewriting the connection-lifecycle wrapper so pool.end() '
    + 'always runs inside a finally block, verified by a new mutation test that forces the throw path and '
    + 'asserts the close still happens; the fix lives in watcher.mjs and the proof is in this very test file, '
    + 'run via both node --test directly and the aggregate node test/run-tower-loop-tests.mjs runner.';
  assert.ok(longRationale.length > 280, 'precondition: exceeds summariseLarry\'s default cap');
  const msg = composeDispositionMessage({
    buildRef: 'BUILD-X', turnSeq: 1, turnId: 'T1',
    finding: { id: 'f1', disposition: 'addressed', disposition_rationale: longRationale },
  });
  assert.ok(msg.includes(longRationale), 'the FULL rationale text is present — NOT clipped at 280 chars');
});

test('composeDispositionMessage: only a pathological length beyond the Telegram payload safety backstop is trimmed', () => {
  const huge = 'x'.repeat(4000);
  const msg = composeDispositionMessage({
    buildRef: 'BUILD-X', turnSeq: 1, turnId: 'T1',
    finding: { id: 'f1', disposition: 'addressed', disposition_rationale: huge },
  });
  assert.ok(!msg.includes(huge), 'the pathological 4000-char value IS capped — Telegram payload safety, not summarisation');
  assert.ok(msg.length < huge.length + 200, 'shorter than the raw input, by design');
});

// ── W4 — readDisposedFindings (the read-back-after-write seam) ─────────────────────────────────

test('readDisposedFindings: re-selects tower.finding for exactly the given ids, in the given order', async () => {
  const buildRef = 'BUILD-QAW4-READ';
  const a = await openFinding(pool, { buildRef, description: '[TQA-100] a' });
  const b = await openFinding(pool, { buildRef, description: '[TQA-101] b' });
  await pool.query(`update tower.finding set disposition='addressed', disposition_rationale='r-a', disposition_source='manual', disposition_head_sha=?, disposition_at=now() where id=?`, [HEAD_A, a.id]);
  await pool.query(`update tower.finding set disposition='remains_open', disposition_rationale='r-b', disposition_source='manual', disposition_head_sha=?, disposition_at=now() where id=?`, [HEAD_A, b.id]);

  const rows = await readDisposedFindings(pool, [b.id, a.id]); // deliberately reversed order
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, b.id, 'order matches the CALLER\'s id order, not insertion order');
  assert.equal(rows[1].id, a.id);
  assert.equal(rows[0].disposition_rationale, 'r-b');
  assert.equal(rows[1].disposition_rationale, 'r-a');

  assert.deepEqual(await readDisposedFindings(pool, []), []);
  assert.deepEqual(await readDisposedFindings(pool, ['does-not-exist']), [], 'an unmatched id is dropped, not thrown');
});

// ── W4 — the MUTATION PROOF (required acceptance evidence): read-back-after-write is load-bearing

test('W4 MUTATION PROOF: composeDispositionMessage renders what the STORE holds, never a stale in-memory claim — with a CONTROL that proves the test can see the defect', async () => {
  const buildRef = 'BUILD-904';
  const opened = await openFinding(pool, { buildRef, description: '[TQA-777] mutation-proof finding' });

  // disposition_source='manual' (no disposition_comment_id) here deliberately — this test proves
  // the READ-BACK property in isolation, not the pr_comment provenance chain (that FK is proven
  // separately by the real ingestPrComment path in the W4 FULL POLL PATH test below).
  const claimedRationale = 'Larry claims: fixed by adding the missing await.';
  await pool.query(
    `update tower.finding set disposition='addressed', disposition_rationale=?, disposition_source='manual',
        disposition_head_sha=?, disposition_at=now() where id=?`,
    [claimedRationale, HEAD_A, opened.id],
  );
  // The store's canonical row is subsequently corrected — simulating "what the store now holds
  // differs from what was originally claimed", the exact scenario the read-back-after-write
  // design defends against.
  const storeRationale = 'CORRECTED: the await fix was reverted — remains open pending a real fix.';
  await pool.query(`update tower.finding set disposition_rationale = ? where id = ?`, [storeRationale, opened.id]);

  // THE REAL WIRING — readDisposedFindings re-selects the row AFTER both writes.
  const [finding] = await readDisposedFindings(pool, [opened.id]);
  const realMessage = composeDispositionMessage({ buildRef, turnSeq: 1, turnId: 'T-MUT', finding });
  assert.match(realMessage, new RegExp(esc(storeRationale)), 'the REAL wiring shows the STORE\'s current truth');
  assert.doesNotMatch(realMessage, new RegExp(esc(claimedRationale)), 'the REAL wiring does NOT show the stale claimed value');

  // THE MUTANT — build the message from the ORIGINAL in-memory claim instead of a store re-read.
  // This is exactly the defect the design forbids ("render from the in-memory comment text
  // instead of the store re-read"). Constructed here as a CONTROL, never shipped.
  const mutantFinding = { ...finding, disposition_rationale: claimedRationale };
  const mutantMessage = composeDispositionMessage({ buildRef, turnSeq: 1, turnId: 'T-MUT', finding: mutantFinding });
  assert.match(mutantMessage, new RegExp(esc(claimedRationale)), 'CONTROL: the mutant DOES show the stale claim');
  assert.notEqual(realMessage, mutantMessage, 'CONTROL: real and mutant messages differ — this test can actually see the defect it exists to catch');
});

test('W4 END-TO-END: sendDispositionNotifications renders from a FRESH store read, captured via a notify spy, with turnId=null for dedup safety', async () => {
  const buildRef = 'BUILD-905';
  const turn = await ingestTurn(pool, { buildRef, instruction: 'Warwick: e2e disposition echo.', larryResponse: 'Larry: ok' });
  const f = await openFinding(pool, { buildRef, openedTurnId: turn.id, description: '[TQA-778] e2e finding' });

  // disposition_source='manual' here too — see the mutation-proof test above for why.
  const originalRationale = 'typed in the PR comment';
  await pool.query(
    `update tower.finding set disposition='remains_open', disposition_rationale=?, disposition_source='manual',
        disposition_head_sha=?, disposition_at=now() where id=?`,
    [originalRationale, HEAD_A, f.id],
  );
  const finalRationale = 'STORE TRUTH: still open, blocked on the retry-budget fix';
  await pool.query(`update tower.finding set disposition_rationale = ? where id = ?`, [finalRationale, f.id]);

  const captured = [];
  const spyDeps = { notify: async (p, args) => { captured.push(args); return { deduped: false }; } };
  const sent = await sendDispositionNotifications(pool, spyDeps, { turnId: turn.id, disposedFindingIds: [f.id] });

  assert.equal(sent.length, 1);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].turnId, null, 'W4 uses turnId=null so the dedup index can never collapse two disposition events');
  assert.equal(captured[0].reason, 'finding_disposed');
  assert.match(captured[0].message, new RegExp(esc(finalRationale)), 'the FRESH store value reached the message');
  assert.doesNotMatch(captured[0].message, new RegExp(esc(originalRationale)), 'the stale original claim did NOT reach the message');
});

test('sendDispositionNotifications: an empty id list is a no-op (never throws, never queries)', async () => {
  assert.deepEqual(await sendDispositionNotifications(pool, DEPS, { turnId: 'x', disposedFindingIds: [] }), []);
  assert.deepEqual(await sendDispositionNotifications(pool, DEPS, { turnId: 'x', disposedFindingIds: null }), []);
});

// ── W4 — the full poll -> ingest -> echo path, through pollPrComments + a fake `gh` ─────────────

test('W4 FULL POLL PATH: a disposing PR comment, seen through the poller, echoes EACH disposed finding to Telegram — and a re-poll of the same comment does NOT re-echo', async () => {
  const buildRef = 'BUILD-QAW4-POLL';
  const pr = 5151;
  const turn = await ingestTurn(pool, {
    kind: 'merge_review', headSha: HEAD_A, prNumber: pr, repo: REPO, buildRef,
    instruction: 'Warwick: poll-path round.', larryResponse: 'Larry: pushed the fix.',
  });
  const fA = await openFinding(pool, { buildRef, openedTurnId: turn.id, description: '[TQA-500] a' });
  const fB = await openFinding(pool, { buildRef, openedTurnId: turn.id, description: '[TQA-501] b' });

  const rationaleA = 'A: wrapped pool.end() in a finally block, mutation test added.';
  const rationaleB = 'B: capped the retry budget at 5 attempts, unit test added.';
  const commentBody = [
    `@tower head: ${HEAD_A}`,
    `@tower finding ${fA.id}: addressed — ${rationaleA}`,
    `@tower finding ${fB.id}: addressed — ${rationaleB}`,
  ].join('\n');
  const gh = makeFakeGh({ headSha: HEAD_A, comments: [ghComment({ id: 88001, body: commentBody })] });

  const res = await pollPrComments(pool, { repo: REPO, prNumber: pr, gh });
  assert.equal(res.results[0].outcome, 'applied');
  assert.equal(res.results[0].applied_count, 2);
  assert.deepEqual(res.results[0].disposedFindingIds.sort(), [fA.id, fB.id].sort());

  const captured = [];
  const spyDeps = { gh: gh, notify: async (p, args) => { captured.push(args); return { deduped: false }; } };
  // Drive the SAME echo step pollRound would (pollRound itself needs pollTargets/a seeded turn
  // store lookup this throwaway store does not otherwise need for this proof).
  for (const r of res.results) {
    if (r.outcome === 'applied' && r.disposedFindingIds.length > 0) {
      await sendDispositionNotifications(pool, spyDeps, { turnId: r.turnId, disposedFindingIds: r.disposedFindingIds });
    }
  }
  assert.equal(captured.length, 2, 'EACH disposition is its OWN Telegram message — an ongoing thread, not one digest');
  const bodies = captured.map((c) => c.message);
  assert.ok(bodies.some((m) => m.includes(rationaleA)), 'finding A\'s real rationale reached Telegram');
  assert.ok(bodies.some((m) => m.includes(rationaleB)), 'finding B\'s real rationale reached Telegram');
  assert.ok(captured.every((c) => c.turnId === null && c.reason === 'finding_disposed'));

  // Re-poll the SAME comment: ingestPrComment dedupes it, so outcome is 'deduped' and
  // disposedFindingIds is never populated — nothing would be re-echoed.
  const res2 = await pollPrComments(pool, { repo: REPO, prNumber: pr, gh });
  assert.equal(res2.results[0].outcome, 'deduped');
  assert.equal(res2.results[0].disposedFindingIds, undefined);
});

// ── W1 — the negative test for the process-level fail-closed path (required acceptance evidence)

test('W1 NEGATIVE (process-level): merge_review.qa.findings absent or malformed at the processTurn level never crashes and never silently loses a finding', async () => {
  // Assertions below key on opened_turn_id (exact, format-independent) rather than build_ref —
  // classifyBuildRef requires /^BUILD-\d{3}$/ and these two ids deliberately do not conform, so
  // querying by build_ref would prove nothing (it would filter to a build_ref nothing uses).
  const turnBlocked = await ingestTurn(pool, {
    kind: 'merge_review', headSha: 'UNRESOLVABLE', prNumber: PR, repo: REPO,
    instruction: 'Warwick: unresolvable evidence case.', larryResponse: 'Larry: pushed, done and merged.',
  });
  const blockedDeps = {
    ...DEPS,
    gatherGitEvidence: async () => ({ resolved: false, blocker: 'forced unresolved for this test', changed_files: [] }),
  };
  await assert.doesNotReject(processTurn(pool, turnBlocked.id, blockedDeps), 'a blocked merge review must never crash processTurn');
  const resBlocked = await pool.query(`select count(*) c from tower.finding where opened_turn_id = ?`, [turnBlocked.id]);
  assert.equal(resBlocked.rows[0].c, 0, 'nothing was opened for a blocked review — the correct fail-closed outcome, not a defect');

  const turnOrdinary = await ingestTurn(pool, {
    instruction: 'Warwick: ordinary, non-merge-class turn.', larryResponse: 'Larry: continuing.',
  });
  await assert.doesNotReject(processTurn(pool, turnOrdinary.id, DEPS), 'an ordinary (non-merge-class) turn must never crash the findings wire either');
  const resOrdinary = await pool.query(`select count(*) c from tower.finding where opened_turn_id = ?`, [turnOrdinary.id]);
  assert.equal(resOrdinary.rows[0].c, 0, 'nothing was opened for a non-merge-class turn');
});
