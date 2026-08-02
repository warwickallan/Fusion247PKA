// BUILD-014 Tower supervisor loop — CI ACCEPTANCE with DETERMINISTIC test doubles (FIX 3+4).
//
// Executes the REAL loop + watcher (spawned as child processes) against an ISOLATED Postgres,
// with a fake reviewer (canned verdicts, no Codex) and a fake Telegram transport (no network),
// injected via env. It proves — on the exact PR head, no external services — that:
//
//   T1  ingest → claim → process → verdict → notify           (the core auto-supervision path)
//   T2  notification dedup                                     (no duplicate Telegram per turn/reason)
//   T3  restart recovery                                       (a relaunched watcher resumes)
//   T4  crash reclaim                                          (an expired-lease 'claimed' turn is reclaimed)
//   T5  merge-class routing — APPROVE                          (Tower QA skill ran on Git evidence)
//   T6  merge-class routing — fail-closed BLOCK                (unresolvable evidence → blocked)
//   T7  exactly-once during a long run + concurrent watcher    (FIX 4: one review, one notification)
//
// FAIL-ON-0-SUBTESTS: if zero subtests execute (e.g. DB never reached) the runner exits 1 —
// an all-skipped run can NOT go green. Real Codex / Telegram / Supabase acceptance is separate
// (accept.mjs, run by Warwick). Nothing here fakes a real-Codex claim.
//
//   CONTROL_PLANE_DEV_DATABASE_URL=postgres://... node test/run-tower-loop-tests.mjs
//   (CI: DATABASE_URL is used if CONTROL_PLANE_DEV_DATABASE_URL is unset.)

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applySchema, applyWatcherSchema, applyCommentSchema } from '../apply.mjs';
import { seedPrompt } from '../seed.mjs';
import { ingestTurn } from '../loop.mjs';
import { detectMergeClass } from '../mergeClass.mjs';
// WO-OR-22 — the PR-comment ⇄ Tower seam.
import { ingestPrComment, parseCommentBody } from '../ingestComment.mjs';
import { checkFindingDispositions } from '../findings.mjs';
import { openFinding, processTurn } from '../watcher.mjs';
import { runSupervisor as fakeRunSupervisor, runMergeReview as fakeRunMergeReview } from './doubles/fakeReviewer.mjs';
import { notify } from '../notify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOP_DIR = path.resolve(__dirname, '..');
const DB_URL = process.env.CONTROL_PLANE_DEV_DATABASE_URL || process.env.DATABASE_URL;

const DOUBLES_ENV = {
  TOWER_REVIEWER_MODULE: path.join(__dirname, 'doubles', 'fakeReviewer.mjs'),
  TOWER_GIT_EVIDENCE_MODULE: path.join(__dirname, 'doubles', 'fakeGitEvidence.mjs'),
  TOWER_NOTIFY_TRANSPORT: 'none',
  // Deterministic: merge-class is declared EXPLICITLY (kind='merge_review') in T5/T6; the
  // content heuristic is unit-tested separately (T0) and kept OFF here so the delivery cases
  // (T1/T3/T4/T7) stay pure delivery reviews regardless of their wording.
  TOWER_MERGE_CLASS_HEURISTIC: 'off',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = new Set(['reviewed', 'acted', 'blocked', 'awaiting_warwick', 'complete']);

function spawnWatcher(watcherId, extraEnv = {}) {
  const child = spawn(process.execPath, ['watcher.mjs'], {
    cwd: LOOP_DIR,
    // watcher.mjs reads ONLY CONTROL_PLANE_DEV_DATABASE_URL; the harness resolves DB_URL from
    // either CONTROL_PLANE_DEV_DATABASE_URL or DATABASE_URL (CI sets the latter), so propagate
    // the resolved value to the child explicitly — otherwise CI-spawned watchers FATAL "unset".
    env: { ...process.env, ...DOUBLES_ENV, CONTROL_PLANE_DEV_DATABASE_URL: DB_URL, WATCHER_ID: watcherId, WATCHER_POLL_MS: '400', WATCHER_LEASE_SECONDS: '20', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tag = `[${watcherId}]`;
  child.stdout.on('data', (d) => process.stdout.write(String(d).split('\n').filter(Boolean).map((l) => `${tag} ${l}\n`).join('')));
  child.stderr.on('data', (d) => process.stderr.write(`${tag} ${d}`));
  return child;
}
function waitExit(child) { return new Promise((res) => { if (child.exitCode !== null) return res(child.exitCode); child.on('exit', (c) => res(c)); }); }
async function killWatcher(child) { if (!child || child.exitCode !== null) return; child.kill(); await waitExit(child); }

async function waitForProcessed(pool, turnId, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { rows } = await pool.query(
      `select t.state, (select count(*) from tower.supervisor_review r where r.turn_id = t.id) reviews
         from tower.turn t where t.id = $1`, [turnId]);
    if (rows.length && TERMINAL.has(rows[0].state) && Number(rows[0].reviews) >= 1) return rows[0].state;
    await sleep(300);
  }
  throw new Error(`timed out waiting for turn ${turnId} to be processed`);
}
async function reviewsFor(pool, turnId) {
  return (await pool.query(`select id, verdict, prompts_applied, merge_review, model_id from tower.supervisor_review where turn_id = $1 order by created_at asc`, [turnId])).rows;
}
async function notesFor(pool, turnId) {
  return (await pool.query(`select reason, state from tower.notification where turn_id = $1 order by created_at asc`, [turnId])).rows;
}

// ── tiny harness (fail-on-0-subtests) ─────────────────────────────────────────
let executed = 0; let failures = 0;
const results = [];
async function test(name, fn) {
  executed += 1;
  try { await fn(); results.push(`  [PASS] ${name}`); }
  catch (e) { failures += 1; results.push(`  [FAIL] ${name} — ${e?.message ?? e}`); }
}

async function main() {
  if (!DB_URL) throw new Error('CONTROL_PLANE_DEV_DATABASE_URL / DATABASE_URL is not set — point at an isolated Postgres.');

  // Clean, isolated slate.
  const admin = new pg.Pool({ connectionString: DB_URL });
  await admin.query('drop schema if exists tower cascade');
  await admin.end();
  await applySchema(DB_URL);
  await applyWatcherSchema(DB_URL);
  await applyCommentSchema(DB_URL);   // WO-OR-22 comment seam
  await seedPrompt(DB_URL);

  const pool = new pg.Pool({ connectionString: DB_URL, max: 6 });

  // Assert the truthful approval label came through (FIX 1a).
  await test('FIX1a — active prompt approved_by is truthful (not warwick)', async () => {
    const { rows } = await pool.query(`select approved_by from tower.supervisor_prompt where active = true limit 1`);
    assert.equal(rows[0].approved_by, 'ai-authored-unapproved');
  });

  // T0 — merge-class detector unit checks (explicit + heuristic + fail-safe).
  await test('T0 — detectMergeClass: explicit, heuristic, and ordinary', async () => {
    assert.equal(detectMergeClass({ kind: 'merge_review', head_sha: 'abc' }).isMergeClass, true, 'explicit is merge-class');
    assert.equal(detectMergeClass({ kind: 'merge_review', head_sha: 'abc' }).source, 'explicit');
    const h = detectMergeClass({ kind: 'ordinary', larry_response: 'Done and merged; ready to ship.' });
    assert.equal(h.isMergeClass, true, 'completion claim is heuristic merge-class');
    assert.equal(h.source, 'heuristic');
    assert.equal(detectMergeClass({ kind: 'ordinary', larry_response: 'Working on the parser now.' }).isMergeClass, false, 'plain progress is ordinary');
    assert.equal(detectMergeClass({ kind: 'ordinary', larry_response: 'Done and merged.' }, { heuristic: false }).isMergeClass, false, 'heuristic off ⇒ ordinary');
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // WO-OR-22 — the PR-comment ⇄ Tower seam (W1–W8).
  //
  // Run IN-PROCESS via processTurn() with the fake reviewer, BEFORE any watcher is spawned,
  // so the round under test is the one this test drives — no polling race. Every turn is
  // inserted state='claimed' with a far-future lease, so a watcher spawned later for T1–T7
  // can neither claim it (claimOne takes 'pending') nor reclaim it (reclaimStale takes an
  // EXPIRED lease). These tests are therefore isolated from the rest of the suite by
  // construction rather than by ordering luck.
  // ══════════════════════════════════════════════════════════════════════════════
  process.env.TOWER_NOTIFY_TRANSPORT = 'none';        // in-process notify: no network
  process.env.TOWER_MERGE_CLASS_HEURISTIC = 'off';    // keep these ordinary delivery rounds

  const HEAD_A = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
  const HEAD_B = 'b2c3d4e5f60718293a4b5c6d7e8f901234567890';
  const REPO = 'warwickallan/Fusion247PKA';
  const PR = 87;
  const FIXTURES = path.join(__dirname, 'fixtures');
  const IN_PROC_DEPS = {
    runSupervisor: fakeRunSupervisor, runMergeReview: fakeRunMergeReview,
    gatherGitEvidence: async () => ({ resolved: false, blocker: 'not used in W-tests' }), notify,
  };

  /** Load a fixture and substitute the runtime-generated ids. */
  function fixture(name, subs = {}) {
    let raw = fs.readFileSync(path.join(FIXTURES, name), 'utf8');
    for (const [k, v] of Object.entries(subs)) raw = raw.split(k).join(v);
    return JSON.parse(raw);
  }
  /** Insert a turn that no watcher can ever pick up (claimed + far-future lease). */
  async function inertTurn({ buildRef, headSha, instruction, larryResponse }) {
    const { rows } = await pool.query(
      `insert into tower.turn (build_ref, instruction, larry_response, state, lease_owner,
                               lease_deadline_at, kind, repo, pr_number, head_sha)
       values ($1,$2,$3,'claimed','wo22-inproc', now() + interval '1 day','ordinary',$4,$5,$6)
       returning id, seq`,
      [buildRef, instruction, larryResponse, REPO, PR, headSha]);
    return rows[0];
  }
  const stagedInputFor = async (turnId) => (await pool.query(
    `select staged_input, reviewer, verdict, summary from tower.supervisor_review where turn_id=$1`, [turnId])).rows[0];

  await test('W1 — tower.git_sha DOMAIN refuses a non-canonical head (DB constraint, not a runtime if)', async () => {
    const bad = ['abc1234', 'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678', `${HEAD_A}0`, ''];
    for (const b of bad) {
      await assert.rejects(
        () => pool.query(
          `insert into tower.pr_comment (repo, pr_number, head_sha, comment_id, author, body, received_at, applied)
           values ($1,$2,$3,$4,'x','y', now(), true)`, [REPO, PR, b, Math.floor(Math.random() * 1e12)]),
        /git_sha_canonical_chk|invalid input value/i,
        `non-canonical head "${b}" must be refused by the database`);
    }
    // …and the canonical one is accepted.
    const ok = await pool.query(
      `insert into tower.pr_comment (repo, pr_number, head_sha, comment_id, author, body, received_at, applied)
       values ($1,$2,$3,$4,'x','y', now(), true) returning id`, [REPO, PR, HEAD_A, 999000001]);
    assert.equal(ok.rowCount, 1, 'a canonical 40-hex head is accepted');
  });

  await test('W8 — provenance CHECK: a pr_comment disposition with no comment row is refused by the DB', async () => {
    const f = await openFinding(pool, { buildRef: 'BUILD-WO22-CHK', description: 'provenance probe' });
    await assert.rejects(
      () => pool.query(
        `update tower.finding set disposition='addressed', disposition_rationale='r',
            disposition_source='pr_comment', disposition_head_sha=$2, disposition_at=now()
          where id=$1`, [f.id, HEAD_A]),
      /finding_disposition_provenance_chk/,
      'a pr_comment-sourced disposition MUST name the comment it came from');
    // A disposition with no head binding is refused too (completeness CHECK).
    await assert.rejects(
      () => pool.query(
        `update tower.finding set disposition='addressed', disposition_source='manual', disposition_at=now() where id=$1`, [f.id]),
      /finding_disposition_complete_chk/,
      'a disposition with no head binding is refused');
  });

  await test('W7 — a comment with no `@tower head:` directive is REFUSED (cannot be bound)', async () => {
    const parsed = parseCommentBody(fixture('pr-comment-no-head.json').comment.body);
    assert.equal(parsed.headSha, null, 'no head directive parsed');
    await assert.rejects(
      () => ingestPrComment(pool, fixture('pr-comment-no-head.json')),
      /carries no `@tower head/,
      'ingest refuses a comment that does not state its head');
    const { rows } = await pool.query(`select count(*)::int c from tower.pr_comment where comment_id = 2200000003`);
    assert.equal(rows[0].c, 0, 'nothing persisted for an unbindable comment');
  });

  // ── the round trip: findings opened → comment ingested → next round carries them ──
  const t1 = await inertTurn({ buildRef: 'BUILD-WO22', headSha: HEAD_A,
    instruction: 'Warwick: review the connection handling.', larryResponse: 'Larry: first pass pushed.' });
  const fA = await openFinding(pool, { buildRef: 'BUILD-WO22', openedTurnId: t1.id, description: 'pool.end() is not in a finally block — connection leak on throw' });
  const fB = await openFinding(pool, { buildRef: 'BUILD-WO22', openedTurnId: t1.id, description: 'retry budget is unbounded' });

  await test('W3 — a STALE comment is REJECTED, applies nothing, and the rejection is persisted', async () => {
    const t = await inertTurn({ buildRef: 'BUILD-WO22', headSha: HEAD_A,
      instruction: 'Warwick: round two.', larryResponse: 'Larry: pushed the fix.' });
    const res = await ingestPrComment(pool, fixture('pr-comment-stale.json', { __FINDING_A__: fA.id, __FINDING_B__: fB.id }));
    assert.equal(res.applied, false, 'stale comment is not applied');
    assert.match(res.reason, /stale comment: written against head ffffffffffff/, 'reason names the mismatch');
    assert.equal(res.applied_count, 0, 'zero dispositions applied');
    const { rows } = await pool.query(`select applied, rejected_reason from tower.pr_comment where comment_id = 2200000002`);
    assert.equal(rows.length, 1, 'the rejected comment IS persisted (a dropped comment must not look like one that never arrived)');
    assert.equal(rows[0].applied, false);
    assert.ok(rows[0].rejected_reason, 'rejection reason recorded');
    const f = await pool.query(`select disposition from tower.finding where id in ($1,$2)`, [fA.id, fB.id]);
    assert.ok(f.rows.every((r) => r.disposition === null), 'findings were NOT touched by the stale comment');
    assert.ok(t.id, 'turn created');
  });

  const reviewTurn = await inertTurn({ buildRef: 'BUILD-WO22', headSha: HEAD_A,
    instruction: 'Warwick: is the connection handling sorted?', larryResponse: 'Larry: leak fixed; retry budget still open.' });

  await test('W2 — ingest binds to the EXACT head, preserves the body, and applies dispositions with distinguishable provenance', async () => {
    const payload = fixture('pr-comment-dispositions.json', { __HEAD_SHA__: HEAD_A, __FINDING_A__: fA.id, __FINDING_B__: fB.id });
    const res = await ingestPrComment(pool, payload);
    assert.equal(res.applied, true, 'fresh comment is applied');
    assert.equal(res.headSha, HEAD_A, 'bound to the exact head');
    assert.equal(res.turnId, reviewTurn.id, 'bound to the latest turn for this PR');
    assert.equal(res.applied_count, 2, 'both dispositions written');

    const c = (await pool.query(`select * from tower.pr_comment where comment_id = 2200000001`)).rows[0];
    assert.equal(c.head_sha, HEAD_A, 'exact 40-char head persisted');
    assert.equal(c.repo, REPO); assert.equal(c.pr_number, PR);
    assert.equal(c.author, 'warwickallan');
    assert.equal(c.source, 'github_pr_comment');
    assert.equal(c.body, payload.comment.body, 'body preserved VERBATIM');

    const rows = (await pool.query(
      `select id, disposition, disposition_source, disposition_comment_id, disposition_head_sha, disposition_rationale
         from tower.finding where id in ($1,$2) order by created_at`, [fA.id, fB.id])).rows;
    assert.equal(rows[0].disposition, 'addressed');
    assert.equal(rows[1].disposition, 'remains_open');
    for (const r of rows) {
      assert.equal(r.disposition_source, 'pr_comment', 'provenance says it came from a PR comment');
      assert.equal(r.disposition_comment_id, c.id, 'and names WHICH comment — distinguishable in the data');
      assert.equal(r.disposition_head_sha, HEAD_A, 'bound to the exact head it was judged at');
      assert.ok(r.disposition_rationale, 'rationale carried');
    }
    // Idempotent redelivery: the same provider comment cannot double-apply.
    const again = await ingestPrComment(pool, payload);
    assert.equal(again.deduped, true, 'redelivered comment is an idempotent no-op');
    assert.equal((await pool.query(`select count(*)::int c from tower.pr_comment where comment_id=2200000001`)).rows[0].c, 1);
  });

  await test('W4 — the NEXT review round receives those dispositions AUTOMATICALLY from the database', async () => {
    const res = await processTurn(pool, reviewTurn.id, IN_PROC_DEPS);
    assert.ok(!res.gateBlocked, `gate passed (got ${JSON.stringify(res.gateErrors ?? null)})`);
    const rev = await stagedInputFor(reviewTurn.id);
    assert.ok(rev.staged_input, 'the staged reviewer input was persisted');
    assert.match(rev.staged_input, /disposition: addressed \(source=pr_comment:/, 'the ADDRESSED disposition reached the packet');
    assert.match(rev.staged_input, /disposition: remains_open \(source=pr_comment:/, 'the REMAINS_OPEN disposition reached the packet');
    assert.match(rev.staged_input, new RegExp(`head=${HEAD_A.slice(0, 12)}`), 'the packet carries the head each disposition was judged at');
    assert.match(rev.staged_input, /retry budget is unbounded/, 'the finding text is still carried forward');
    // Nothing was hand-carried: the packet was built from rows, so the comment id in it is the
    // one the database holds.
    const cid = (await pool.query(`select id from tower.pr_comment where comment_id=2200000001`)).rows[0].id;
    assert.ok(rev.staged_input.includes(cid), 'the packet cites the persisted comment row id');
  });

  await test('W5 — an UNDISPOSED prior finding REJECTS the next review round (fail-closed, no reviewer invoked)', async () => {
    const g1 = await inertTurn({ buildRef: 'BUILD-WO22-GATE', headSha: HEAD_A,
      instruction: 'Warwick: round one.', larryResponse: 'Larry: first pass.' });
    const gf = await openFinding(pool, { buildRef: 'BUILD-WO22-GATE', openedTurnId: g1.id, description: 'unbounded recursion in the parser' });
    const g2 = await inertTurn({ buildRef: 'BUILD-WO22-GATE', headSha: HEAD_A,
      instruction: 'Warwick: round two.', larryResponse: 'Larry: all good now.' });

    let reviewerCalls = 0;
    const spyDeps = { ...IN_PROC_DEPS, runSupervisor: async (...a) => { reviewerCalls += 1; return fakeRunSupervisor(...a); } };
    const res = await processTurn(pool, g2.id, spyDeps);

    assert.equal(res.gateBlocked, true, 'the round was REJECTED');
    assert.equal(reviewerCalls, 0, 'NO reviewer was invoked — the gate runs before any review is spent');
    assert.equal(res.verdict, 'block');
    assert.ok(res.gateErrors.some((e) => e.includes(gf.id) && /no disposition/.test(e)),
      `the error names the offending finding (got: ${JSON.stringify(res.gateErrors)})`);
    assert.ok(res.gateErrors.some((e) => /no silent carry-over/.test(e)), 'mirrors reviewClassification.mjs wording');
    const rev = await stagedInputFor(g2.id);
    assert.equal(rev.reviewer, 'tower_findings_gate', 'the rejection is durably attributed to the gate');
    assert.equal((await pool.query(`select state from tower.turn where id=$1`, [g2.id])).rows[0].state, 'blocked');
  });

  await test('W6 — a disposition recorded at an OLDER head is STALE at a newer head → round REJECTED', async () => {
    // The PR moves on: a new round at HEAD_B, while both dispositions were judged at HEAD_A.
    const t = await inertTurn({ buildRef: 'BUILD-WO22', headSha: HEAD_B,
      instruction: 'Warwick: re-review at the new head.', larryResponse: 'Larry: pushed more commits.' });
    const res = await processTurn(pool, t.id, IN_PROC_DEPS);
    assert.equal(res.gateBlocked, true, 'a disposition from an older head does not carry to a newer one');
    assert.ok(res.gateErrors.some((e) => e.includes(HEAD_A.slice(0, 12)) && e.includes(HEAD_B.slice(0, 12))),
      `the error names both heads (got: ${JSON.stringify(res.gateErrors)})`);
    assert.ok(res.gateErrors.some((e) => /STALE/.test(e)), 'named as stale');
  });

  await test('W-unit — checkFindingDispositions: gate arithmetic, opened-this-turn exemption, head skip', async () => {
    const base = { id: 'F1', description: 'x', state: 'open', opened_turn_id: 'T0' };
    assert.equal(checkFindingDispositions([], { headSha: HEAD_A }).ok, true, 'no findings ⇒ pass (the pre-existing behaviour is preserved)');
    assert.equal(checkFindingDispositions([base], { currentTurnId: 'T0', headSha: HEAD_A }).ok, true, 'a finding opened by THIS turn is exempt');
    const undisposed = checkFindingDispositions([base], { currentTurnId: 'T9', headSha: HEAD_A });
    assert.equal(undisposed.ok, false); assert.equal(undisposed.required, 1); assert.equal(undisposed.disposed, 0);
    const good = { ...base, disposition: 'addressed', disposition_head_sha: HEAD_A };
    assert.equal(checkFindingDispositions([good], { currentTurnId: 'T9', headSha: HEAD_A }).ok, true);
    assert.equal(checkFindingDispositions([good], { currentTurnId: 'T9', headSha: HEAD_B }).ok, false, 'older-head disposition is stale');
    assert.equal(checkFindingDispositions([good], { currentTurnId: 'T9', headSha: null }).ok, true, 'no round head ⇒ head comparison skipped (stated limitation)');
    assert.equal(checkFindingDispositions([{ ...base, disposition: 'bogus', disposition_head_sha: HEAD_A }], { currentTurnId: 'T9', headSha: HEAD_A }).ok, false, 'off-vocabulary disposition refused');
  });

  // ── one long-lived watcher for T1/T2/T5/T6 ──
  let w = spawnWatcher('ci-w1');
  await sleep(1200);

  await test('T1 — ingest→claim→process→verdict→notify (correct verdict fires a notification)', async () => {
    const turn = await ingestTurn(pool, {
      instruction: 'Warwick: is the CSV import done?',
      larryResponse: 'Larry: give me a status update — everything is on track, ready to ship.',
    });
    await waitForProcessed(pool, turn.id);
    const reviews = await reviewsFor(pool, turn.id);
    assert.equal(reviews.length, 1, 'exactly one review');
    assert.equal(reviews[0].model_id, 'fake-reviewer');
    assert.equal(reviews[0].verdict, 'correct');
    const notes = await notesFor(pool, turn.id);
    assert.ok(notes.some((n) => n.reason === 'codex_block_or_redirect'), 'a redirect notification fired');
    const applied = reviews[0].prompts_applied;
    assert.ok(Array.isArray(applied) && applied[0].name === 'delivery_supervisor', 'delivery prompt recorded');
    assert.ok(applied[0].fingerprint, 'delivery prompt fingerprint recorded');
  });

  await test('T2 — notification dedup (no duplicate (turn,reason))', async () => {
    const dup = (await pool.query(
      `select turn_id, reason, count(*) c from tower.notification where turn_id is not null group by turn_id, reason having count(*) > 1`)).rows;
    assert.equal(dup.length, 0, 'no duplicate notifications');
  });

  await test('T5 — merge-class routing APPROVE (Tower QA skill ran on Git evidence)', async () => {
    const turn = await ingestTurn(pool, {
      kind: 'merge_review', headSha: 'aaaa1111bbbb2222', prNumber: 999, repo: 'warwickallan/Fusion247PKA',
      instruction: 'Warwick: review PR #999 and confirm it is ready to merge.',
      larryResponse: 'Larry: PR #999 adds convert.js; tests pass; ready to merge.',
      goalComplete: true,
    });
    await waitForProcessed(pool, turn.id);
    const reviews = await reviewsFor(pool, turn.id);
    assert.equal(reviews.length, 1, 'exactly one review');
    const mr = reviews[0].merge_review;
    assert.ok(mr && mr.isMergeClass === true, 'merge_review persisted');
    assert.equal(mr.blocked, false, 'evidence resolved, not blocked');
    assert.equal(mr.qa.verdict, 'approve', 'fake QA approved the diff');
    assert.ok(mr.evidence.diff_range, 'git evidence diff_range recorded');
    const applied = reviews[0].prompts_applied.map((p) => p.name);
    assert.ok(applied.includes('delivery_supervisor') && applied.includes('tower_qa_skill'), 'both prompts recorded');
    const qaPrompt = reviews[0].prompts_applied.find((p) => p.name === 'tower_qa_skill');
    assert.ok(qaPrompt.fingerprint && qaPrompt.fingerprint.length === 64, 'QA skill sha256 fingerprint recorded');
    // Approved merge-class + goalComplete ⇒ goal_complete ping allowed.
    const notes = await notesFor(pool, turn.id);
    assert.ok(notes.some((n) => n.reason === 'goal_complete'), 'goal_complete fired on approved merge');
  });

  await test('T6 — merge-class fail-closed BLOCK on unresolvable Git evidence', async () => {
    const turn = await ingestTurn(pool, {
      kind: 'merge_review', headSha: 'UNRESOLVABLE',
      instruction: 'Warwick: merge the branch, it is done.',
      larryResponse: 'Larry: done and merged.',
      goalComplete: true,
    });
    await waitForProcessed(pool, turn.id);
    const reviews = await reviewsFor(pool, turn.id);
    const mr = reviews[0].merge_review;
    assert.equal(mr.blocked, true, 'unresolvable evidence blocks the merge review');
    assert.equal(mr.evidence.resolved, false);
    const notes = await notesFor(pool, turn.id);
    assert.ok(notes.some((n) => n.reason === 'tower_failure'), 'tower_failure fired on unresolved evidence');
    assert.ok(!notes.some((n) => n.reason === 'goal_complete'), 'no goal_complete on a blocked merge');
  });

  await killWatcher(w);

  await test('T3 — restart recovery (a relaunched watcher resumes processing)', async () => {
    const w2 = spawnWatcher('ci-w2');
    try {
      await sleep(1000);
      const turn = await ingestTurn(pool, {
        instruction: 'Warwick: build the greeting framework.',
        larryResponse: 'Larry: designing a Greeting Framework with a plugin registry and architecture doc first.',
      });
      await waitForProcessed(pool, turn.id);
      const reviews = await reviewsFor(pool, turn.id);
      assert.equal(reviews.length, 1);
      assert.equal(reviews[0].verdict, 'correct');
    } finally { await killWatcher(w2); }
  });

  await test('T4 — crash reclaim (expired-lease claimed turn is reclaimed + processed)', async () => {
    // Simulate a crashed watcher: a turn stuck in 'claimed' with an already-expired lease.
    const ins = await pool.query(
      `insert into tower.turn (build_ref, instruction, larry_response, state, lease_owner, lease_deadline_at)
       values ('BUILD-014', $1, $2, 'claimed', 'dead-watcher', now() - interval '1 hour') returning id`,
      ['Warwick: status?', 'Larry: everything is on track, status update.']);
    const turnId = ins.rows[0].id;
    const w3 = spawnWatcher('ci-w3');
    try {
      await waitForProcessed(pool, turnId);
      const reviews = await reviewsFor(pool, turnId);
      assert.equal(reviews.length, 1, 'reclaimed and processed exactly once');
    } finally { await killWatcher(w3); }
  });

  await test('T7 — exactly-once during a long run with a concurrent watcher (FIX 4)', async () => {
    // Short lease + a fake reviewer that sleeps beyond the ORIGINAL lease. Two watchers race;
    // the lease renewer keeps the healthy long turn from being reclaimed → exactly one review
    // and exactly one notification.
    const env = { WATCHER_LEASE_SECONDS: '3', WATCHER_POLL_MS: '300', FAKE_REVIEWER_SLEEP_MS: '6000', FAKE_REVIEWER_SLEEP_MARKER: 'SLEEP_LONG' };
    const a = spawnWatcher('ci-long-a', env);
    const b = spawnWatcher('ci-long-b', env);
    try {
      await sleep(1000);
      const turn = await ingestTurn(pool, {
        instruction: 'Warwick: SLEEP_LONG give me a status update on the converter.',
        larryResponse: 'Larry: everything is on track, status update, ready to ship.',
      });
      await waitForProcessed(pool, turn.id, 40000);
      // Allow a beat for any (wrongly) racing second processor to settle.
      await sleep(2000);
      const reviews = await reviewsFor(pool, turn.id);
      assert.equal(reviews.length, 1, `exactly one supervisor_review row (got ${reviews.length})`);
      const notes = await notesFor(pool, turn.id);
      // 'correct' verdict ⇒ exactly one codex_block_or_redirect notification, no duplicates.
      const redirect = notes.filter((n) => n.reason === 'codex_block_or_redirect');
      assert.equal(redirect.length, 1, `exactly one notification (got ${redirect.length})`);
    } finally { await killWatcher(a); await killWatcher(b); }
  });

  await pool.end();

  // ── report ──
  console.log(`\n${'═'.repeat(70)}\nTOWER-LOOP CI DOUBLES SUITE\n${'═'.repeat(70)}`);
  console.log(results.join('\n'));
  console.log(`\nexecuted=${executed} failures=${failures}`);
  if (executed === 0) { console.error('FAIL — 0 subtests executed (all-skipped is never a pass)'); process.exit(1); }
  if (failures > 0) { console.error(`FAIL — ${failures} subtest(s) failed`); process.exit(1); }
  console.log('RESULT: ALL PASS');
  process.exit(0);
}

main().catch((e) => { console.error(`[tower-loop-tests] FAILED: ${e.stack ?? e.message}`); process.exit(1); });
