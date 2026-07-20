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

import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applySchema, applyWatcherSchema } from '../apply.mjs';
import { seedPrompt } from '../seed.mjs';
import { ingestTurn } from '../loop.mjs';
import { detectMergeClass } from '../mergeClass.mjs';

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
    env: { ...process.env, ...DOUBLES_ENV, WATCHER_ID: watcherId, WATCHER_POLL_MS: '400', WATCHER_LEASE_SECONDS: '20', ...extraEnv },
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
