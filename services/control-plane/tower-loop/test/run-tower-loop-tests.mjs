// BUILD-014 Tower supervisor loop — CI ACCEPTANCE with DETERMINISTIC test doubles (FIX 3+4).
//
// Executes the REAL loop + watcher (spawned as child processes) against an ISOLATED SQLite store,
// with a fake reviewer (canned verdicts, no Codex) and a fake Telegram transport (no network),
// injected via env. It proves — on the exact PR head, no external services, NO DATABASE SERVER —
// that:
//
//   T1  ingest → claim → process → verdict → notify           (the core auto-supervision path)
//   T2  notification dedup                                     (no duplicate Telegram per turn/reason)
//   T3  restart recovery                                       (a relaunched watcher resumes)
//   T4  crash reclaim                                          (an expired-lease 'claimed' turn is reclaimed)
//   T5  merge-class routing — APPROVE                          (Tower QA skill ran on Git evidence)
//   T6  merge-class routing — fail-closed BLOCK                (unresolvable evidence → blocked)
//   T7  exactly-once during a long run + concurrent watcher    (FIX 4: one review, one notification)
//
// FAIL-ON-0-SUBTESTS: if zero subtests execute (e.g. the store was never reached) the runner
// exits 1 — an all-skipped run can NOT go green. Real Codex / Telegram acceptance is separate
// (accept.mjs, run by Warwick). Nothing here fakes a real-Codex claim.
//
// WO-TW-01 — THE STORE IS SQLite AND THE SUITE PROVISIONS ITS OWN. A fresh temp file per run IS
// the clean slate, so the old `drop schema if exists tower cascade` has no counterpart and needs
// none. There is no server to start, no connection string to supply and nothing to set up:
//
//   node test/run-tower-loop-tests.mjs
//
// The spawned watcher children are pointed at the SAME temp file via TOWER_SQLITE_PATH, which is
// what makes T3/T4/T7 real cross-PROCESS proofs rather than in-process theatre.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
// WO-2026-08-03-02 — the REAL supervisor invocation (the doubles below deliberately never
// reach child_process, so they cannot evidence how the child is launched).
import { runMergeReview as realRunMergeReview } from '../supervisorCodex.mjs';
import { gatherGitEvidence } from '../gitEvidence.mjs';
import { openDb } from '../db.mjs';
import { applySchema, applyWatcherSchema, applyCommentSchema, applyPostSchema } from '../apply.mjs';
import { seedPrompt } from '../seed.mjs';
import { ingestTurn } from '../loop.mjs';
import { detectMergeClass } from '../mergeClass.mjs';
// WO-OR-22 — the PR-comment ⇄ Tower seam.
import { ingestPrComment, parseCommentBody } from '../ingestComment.mjs';
// WO-OR-24 — the GitHub → Tower first hop, driven through an injected `gh` seam (no network).
import { pollPrComments, assertReadOnlyArgs, ensureCheckpointTurn, checkpointTurnKey, fetchOpenPrs } from '../pollPrComments.mjs';
import { makeFakeGh, ghComment } from './doubles/fakeGh.mjs';
// WO-TW-02 — the automatic trigger's own seams, and the verdict write-back.
// WO-2026-08-03-05 — open-PR discovery and the repository sources it draws on.
import { pollTargets, detectCheckoutRepo, seedRepos } from '../watcher.mjs';
import {
  assertCommentPostArgs, verdictPostKey, verdictMarker, composeVerdictComment,
  queueVerdictForTurn, postPendingVerdicts,
} from '../postVerdict.mjs';
import { ghCliWriter as fakeGhWriter } from './doubles/fakeGhModule.mjs';
import { checkFindingDispositions } from '../findings.mjs';
import { openFinding, processTurn } from '../watcher.mjs';
import { runSupervisor as fakeRunSupervisor, runMergeReview as fakeRunMergeReview } from './doubles/fakeReviewer.mjs';
import { notify } from '../notify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOP_DIR = path.resolve(__dirname, '..');

// One throwaway store per run, in the OS temp dir — never the repo, never ~/.mypka/tower (which is
// where the REAL watcher's durable state lives and must not be trampled by a test).
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tower-loop-ci-'));
const DB_PATH = path.join(TMP_DIR, 'tower.db');

const DOUBLES_ENV = {
  TOWER_REVIEWER_MODULE: path.join(__dirname, 'doubles', 'fakeReviewer.mjs'),
  TOWER_GIT_EVIDENCE_MODULE: path.join(__dirname, 'doubles', 'fakeGitEvidence.mjs'),
  TOWER_NOTIFY_TRANSPORT: 'none',
  // Deterministic: merge-class is declared EXPLICITLY (kind='merge_review') in T5/T6; the
  // content heuristic is unit-tested separately (T0) and kept OFF here so the delivery cases
  // (T1/T3/T4/T7) stay pure delivery reviews regardless of their wording.
  TOWER_MERGE_CLASS_HEURISTIC: 'off',
  // WO-TW-02 — the PR-comment poll is OFF for the pre-existing T*/W*/P* cases. T5/T6 seed turns
  // carrying repo + pr_number, so a watcher with the poll enabled would derive them as targets
  // and reach for the REAL `gh` — a network call inside a suite whose whole premise is that it
  // makes none. The A* cases below turn it on explicitly and inject the gh double with it.
  TOWER_PR_POLL: 'off',
  // AND THE WRITE-BACK, for a sharper version of the same reason. Turning off only the poll is
  // NOT enough: T5/T6 seed turns carrying repo + pr_number 999, the verdict sweep is global by
  // design (it has to be, or a failed post would never be retried), so those watchers reached the
  // REAL `gh` and attempted a real POST. It 404'd on a PR that does not exist and created
  // nothing — but it was a real outward call from a suite that claims to make none, and "it
  // happened to fail" is not a control.
  TOWER_PR_WRITEBACK: 'off',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = new Set(['reviewed', 'acted', 'blocked', 'awaiting_warwick', 'complete']);

function spawnWatcher(watcherId, extraEnv = {}) {
  const child = spawn(process.execPath, ['watcher.mjs'], {
    cwd: LOOP_DIR,
    // watcher.mjs opens TOWER_SQLITE_PATH (falling back to ~/.mypka/tower/tower.db). Point the
    // child at THIS run's throwaway store explicitly — otherwise a spawned watcher would happily
    // and silently operate on the real durable one.
    env: { ...process.env, ...DOUBLES_ENV, TOWER_SQLITE_PATH: DB_PATH, WATCHER_ID: watcherId, WATCHER_POLL_MS: '400', WATCHER_LEASE_SECONDS: '20', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
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
         from tower.turn t where t.id = ?`, [turnId]);
    if (rows.length && TERMINAL.has(rows[0].state) && Number(rows[0].reviews) >= 1) return rows[0].state;
    await sleep(300);
  }
  throw new Error(`timed out waiting for turn ${turnId} to be processed`);
}
// `, rowid asc` throughout: the SQLite store keeps ISO-8601 timestamps to MILLISECOND resolution,
// so rows written back-to-back can share a created_at where microsecond Postgres ones could not.
// rowid is insertion order, so this preserves the ordering these assertions always relied on
// rather than leaving it to an unstable sort.
async function reviewsFor(pool, turnId) {
  return (await pool.query(`select id, verdict, prompts_applied, merge_review, model_id from tower.supervisor_review where turn_id = ? order by created_at asc, rowid asc`, [turnId])).rows;
}
async function notesFor(pool, turnId) {
  return (await pool.query(`select reason, state from tower.notification where turn_id = ? order by created_at asc, rowid asc`, [turnId])).rows;
}

// ── WO-2026-08-03-02 — child_process launch-site scanner (test-only) ──────────
//
// Ships nothing: it runs only in this suite, adds no dependency and touches no runtime path.
// It exists because "I fixed the ones I found" has no completion condition — the bare-spawn
// list this Work Order arrived with was itself wrong, in both directions. Enumeration is what
// closes a class.
//
// `exec` is matched only as a BARE identifier: `RegExp#exec` and `db.raw.exec` are property
// calls, and the lookbehind drops them. A `(` must follow the name IMMEDIATELY, which is what
// keeps JSDoc prose ("injectable spawn (tests)") out of the count.
const CP_FNS = ['spawnSync', 'spawn', 'execFileSync', 'execFile', 'execSync', 'exec', 'fork'];
const CP_CALL_RE = new RegExp(`(?<![\\w$.])(${CP_FNS.join('|')})\\(`, 'g');

// Pinned literal, held HERE rather than derived from the sources it checks — 17 launch sites
// under tower-loop as of the #92/#93 reconciliation merge (15 from WO-2026-08-03-02, plus 2
// legitimate additions from PR #93's fetchOpenPrs/detectCheckoutRepo work — both already
// windowsHide:true — reviewed and acknowledged here per this test's own design). A count that
// recomputed itself would agree with anything and prove nothing.
const TOWER_LOOP_CP_SITES = 17;

function jsFilesUnder(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') jsFilesUnder(p, out); }
    else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
  }
  return out.sort();
}

/** Source text between a call's `(` and its matching `)`, or null if it cannot be read.
 *  Strings AND comments are skipped: an apostrophe inside a comment ("the launcher's own")
 *  otherwise reads as a string opener and swallows the rest of the file. That bug was real —
 *  it hid a genuine site behind a silent "unparsed" on the first run of this scanner. */
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

function scanChildProcessSites(files) {
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
        file, rel: path.relative(LOOP_DIR, file).replace(/\\/g, '/'), line: lineOf(m.index), fn: m[1],
        parsed: args != null,
        hidden: args != null && /windowsHide:\s*true/.test(args),
      });
    }
  }
  return sites;
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
  // Clean, isolated slate: a brand-new store file. Nothing to drop, because nothing pre-exists.
  const pool = openDb(DB_PATH);
  console.log(`[tower-loop-tests] throwaway SQLite store: ${pool.path}`);
  await applySchema(pool);
  await applyWatcherSchema(pool);
  await applyCommentSchema(pool);   // WO-OR-22 comment seam
  await applyPostSchema(pool);      // WO-TW-02 verdict write-back
  await seedPrompt(pool);

  // Assert the truthful approval label came through (FIX 1a).
  await test('FIX1a — active prompt approved_by is truthful (not warwick)', async () => {
    const { rows } = await pool.query(`select approved_by from tower.supervisor_prompt where active = 1 limit 1`);
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
       values (?,?,?,'claimed','wo22-inproc', now_plus_seconds(86400),'ordinary',?,?,?)
       returning id, seq`,
      [buildRef, instruction, larryResponse, REPO, PR, headSha]);
    return rows[0];
  }
  const stagedInputFor = async (turnId) => (await pool.query(
    `select staged_input, reviewer, verdict, summary from tower.supervisor_review where turn_id=?`, [turnId])).rows[0];

  await test('W1 — tower.git_sha DOMAIN refuses a non-canonical head (DB constraint, not a runtime if)', async () => {
    const bad = ['abc1234', 'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678', `${HEAD_A}0`, ''];
    for (const b of bad) {
      await assert.rejects(
        () => pool.query(
          `insert into tower.pr_comment (repo, pr_number, head_sha, comment_id, author, body, received_at, applied)
           values (?,?,?,?,'x','y', now(), 1)`, [REPO, PR, b, Math.floor(Math.random() * 1e12)]),
        /git_sha_canonical_chk|invalid input value/i,
        `non-canonical head "${b}" must be refused by the database`);
    }
    // …and the canonical one is accepted.
    const ok = await pool.query(
      `insert into tower.pr_comment (repo, pr_number, head_sha, comment_id, author, body, received_at, applied)
       values (?,?,?,?,'x','y', now(), 1) returning id`, [REPO, PR, HEAD_A, 999000001]);
    assert.equal(ok.rowCount, 1, 'a canonical 40-hex head is accepted');
  });

  await test('W8 — provenance CHECK: a pr_comment disposition with no comment row is refused by the DB', async () => {
    const f = await openFinding(pool, { buildRef: 'BUILD-WO22-CHK', description: 'provenance probe' });
    await assert.rejects(
      () => pool.query(
        `update tower.finding set disposition='addressed', disposition_rationale='r',
            disposition_source='pr_comment', disposition_head_sha=?, disposition_at=now()
          where id=?`, [HEAD_A, f.id]),
      /finding_disposition_provenance_chk/,
      'a pr_comment-sourced disposition MUST name the comment it came from');
    // A disposition with no head binding is refused too (completeness CHECK).
    await assert.rejects(
      () => pool.query(
        `update tower.finding set disposition='addressed', disposition_source='manual', disposition_at=now() where id=?`, [f.id]),
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
    const { rows } = await pool.query(`select count(*) c from tower.pr_comment where comment_id = 2200000003`);
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
    const f = await pool.query(`select disposition from tower.finding where id in (?,?)`, [fA.id, fB.id]);
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
         from tower.finding where id in (?,?) order by created_at, rowid`, [fA.id, fB.id])).rows;
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
    assert.equal((await pool.query(`select count(*) c from tower.pr_comment where comment_id=2200000001`)).rows[0].c, 1);
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
    assert.equal((await pool.query(`select state from tower.turn where id=?`, [g2.id])).rows[0].state, 'blocked');
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

  // ══════════════════════════════════════════════════════════════════════════════
  // WO-OR-24 — THE FIRST HOP. A real GitHub comment reaching the ingest path above.
  //
  // Driven through an INJECTED `gh` seam so the suite needs no network and no gh binary. The
  // LIVE journey is proved separately, against the real API, and is not simulated here — these
  // subtests prove the SEAM's behaviour, which is the part that must hold on every run.
  // ══════════════════════════════════════════════════════════════════════════════
  const ghComments = (subs) => fixture('gh-pr-comments.json', subs).comments;

  await test('P1 — the head SHA comes from the GitHub API, and a body directive that disagrees is REFUSED before ingest', async () => {
    // The comment is honest about a head; the API says the PR is at a DIFFERENT head. Under the
    // accepted design the body directive is what a comment is BOUND to — so if nothing validated
    // it, a typed SHA would be the only authority. This is that validation.
    const fresh = await openFinding(pool, { buildRef: 'BUILD-WO24', description: 'p1 probe' });
    const gh = makeFakeGh({
      headSha: HEAD_B,                                     // what GitHub really says
      comments: ghComments({ __HEAD_SHA__: HEAD_A, __FINDING_A__: fresh.id, __FINDING_B__: fresh.id }),
    });
    const res = await pollPrComments(pool, { repo: REPO, prNumber: PR, gh });

    assert.equal(res.apiHeadSha, HEAD_B, 'the poller reports the API head, not the body head');
    // The head was ASKED FOR, over the wire — not derived from the comment. Observable, not asserted.
    assert.ok(gh.calls.some((c) => c === `repos/${REPO}/pulls/${PR} --jq .head.sha`),
      `the PR head was fetched from the API (calls: ${JSON.stringify(gh.calls)})`);

    const r = res.results.find((x) => x.commentId === 5159709639);
    assert.equal(r.outcome, 'refused_head_mismatch', 'a body head that disagrees with the API head is refused');
    assert.equal(r.bodyHeadSha, HEAD_A); assert.equal(r.apiHeadSha, HEAD_B);
    assert.equal((await pool.query(
      `select count(*) c from tower.pr_comment where comment_id = 5159709639`)).rows[0].c, 0,
      'NOTHING is persisted for a comment the API contradicts — it never reaches ingest');
    assert.equal((await pool.query(
      `select disposition from tower.finding where id = ?`, [fresh.id])).rows[0].disposition, null,
      'and no finding was touched');
  });

  // Shared by P2 and P3: P3 must re-poll the SAME comment carrying the SAME finding ids, because
  // that is what "the poller re-sees it on the next run" actually means.
  const pollTurn = await inertTurn({ buildRef: 'BUILD-WO24', headSha: HEAD_A,
    instruction: 'Warwick: WO-OR-24 round.', larryResponse: 'Larry: poller wired.' });
  const pA = await openFinding(pool, { buildRef: 'BUILD-WO24', openedTurnId: pollTurn.id, description: 'head is trusted from the body' });
  const pB = await openFinding(pool, { buildRef: 'BUILD-WO24', openedTurnId: pollTurn.id, description: 'poller is not a webhook' });

  await test('P2 — a real-shaped comment list reaches the EXISTING ingest path with no hand-built payload, and non-@tower chatter is ignored', async () => {
    const gh = makeFakeGh({
      headSha: HEAD_A,                                     // API and body agree
      comments: ghComments({ __HEAD_SHA__: HEAD_A, __FINDING_A__: pA.id, __FINDING_B__: pB.id }),
    });
    const res = await pollPrComments(pool, { repo: REPO, prNumber: PR, gh });

    assert.equal(res.scanned, 2, 'both comments on the PR were read');
    assert.equal(res.candidates, 1, 'ordinary chatter carrying no @tower directive is ignored');
    const r = res.results[0];
    assert.equal(r.outcome, 'applied');
    assert.equal(r.headSha, HEAD_A, 'bound to the head the API confirmed');
    assert.equal(r.turnId, pollTurn.id);
    assert.equal(r.applied_count, 2, 'both dispositions written by the EXISTING ingest path');

    const c = (await pool.query(`select * from tower.pr_comment where comment_id = 5159709639`)).rows[0];
    assert.equal(c.source, 'github_pr_comment');
    assert.equal(c.author, 'warwickallan');
    assert.equal(c.head_sha, HEAD_A);
    assert.ok(c.body.includes('WOOR24-LIVE-F924F3'), 'the uniquely identifiable body is persisted verbatim');
    const rows = (await pool.query(
      `select disposition, disposition_source, disposition_comment_id, disposition_head_sha
         from tower.finding where id in (?,?) order by created_at, rowid`, [pA.id, pB.id])).rows;
    assert.deepEqual(rows.map((x) => x.disposition), ['addressed', 'remains_open']);
    for (const x of rows) {
      assert.equal(x.disposition_source, 'pr_comment');
      assert.equal(x.disposition_comment_id, c.id);
      assert.equal(x.disposition_head_sha, HEAD_A);
    }
  });

  await test('P3 — polling TWICE is a no-op: re-seeing the same comment neither duplicates nor errors', async () => {
    // A poller re-sees every comment on every run. This is the property that makes that safe, and
    // it is WO-OR-22's (source, comment_id) constraint doing the work — not poller-side memory.
    const before = (await pool.query(`select count(*) c from tower.pr_comment where comment_id = 5159709639`)).rows[0].c;
    assert.equal(before, 1, 'precondition: P2 ingested it exactly once');
    const disposedBefore = (await pool.query(
      `select count(*) c from tower.finding where disposition_comment_id =
         (select id from tower.pr_comment where comment_id = 5159709639)`)).rows[0].c;

    const gh = makeFakeGh({ headSha: HEAD_A, comments: ghComments({ __HEAD_SHA__: HEAD_A, __FINDING_A__: pA.id, __FINDING_B__: pB.id }) });
    const res = await pollPrComments(pool, { repo: REPO, prNumber: PR, gh });

    assert.equal(res.results[0].outcome, 'deduped', 'the second poll is an idempotent no-op, not an error');
    assert.equal((await pool.query(
      `select count(*) c from tower.pr_comment where comment_id = 5159709639`)).rows[0].c, 1,
      'still exactly ONE row for the provider comment');
    assert.equal((await pool.query(
      `select count(*) c from tower.finding where disposition_comment_id =
         (select id from tower.pr_comment where comment_id = 5159709639)`)).rows[0].c, disposedBefore,
      'and no disposition was rewritten');
  });

  await test('P4 — a STALE comment is rejected: the turn has moved on, nothing is applied, the rejection is persisted', async () => {
    // Real-world staleness: the comment is truthful about the PR head (layer 1 passes), but the
    // turn it lands against is at a different head. Layer 2 — the ACCEPTED stale check — fires.
    const staleTurn = await inertTurn({ buildRef: 'BUILD-WO24-STALE', headSha: HEAD_B,
      instruction: 'Warwick: the work moved on.', larryResponse: 'Larry: new head pushed.' });
    const sA = await openFinding(pool, { buildRef: 'BUILD-WO24-STALE', openedTurnId: staleTurn.id, description: 'must not be disposed by a stale comment' });
    // A DIFFERENT provider comment id: the unique constraint means one comment cannot demonstrate
    // both branches in one database. The live proof uses the SAME real comment in a separate DB.
    const comments = ghComments({ __HEAD_SHA__: HEAD_A, __FINDING_A__: sA.id, __FINDING_B__: sA.id })
      .map((c) => (c.id === 5159709639 ? { ...c, id: 5159709777 } : c));
    const gh = makeFakeGh({ headSha: HEAD_A, comments });   // API agrees with the body: layer 1 passes
    const res = await pollPrComments(pool, { repo: REPO, prNumber: PR, gh });

    const r = res.results.find((x) => x.commentId === 5159709777);
    assert.equal(r.outcome, 'rejected_stale', 'the ingest stale check rejected it');
    assert.match(r.reason, /stale comment: written against head/, 'the reason names the mismatch');
    const row = (await pool.query(`select applied, rejected_reason from tower.pr_comment where comment_id = 5159709777`)).rows[0];
    assert.equal(row.applied, false, 'persisted as NOT applied — a dropped comment must not look like one that never arrived');
    assert.ok(row.rejected_reason, 'rejection reason recorded');
    assert.equal((await pool.query(`select disposition from tower.finding where id = ?`, [sA.id])).rows[0].disposition, null,
      'the finding was NOT disposed by a stale comment');
  });

  await test('P5 — the gh seam is READ-ONLY: a mutating invocation is refused, and the poller never builds one', async () => {
    for (const bad of [['repos/x/y/issues/1/comments', '-X', 'POST'], ['repos/x/y/issues/1/comments', '--method', 'POST'],
      ['repos/x/y/issues/1/comments', '-f', 'body=hi'], ['repos/x/y/issues/1/comments', '--raw-field', 'body=hi']]) {
      assert.throws(() => assertReadOnlyArgs(bad), /non-read-only gh invocation/,
        `a write-shaped argv must be refused: ${bad.join(' ')}`);
    }
    assert.deepEqual(assertReadOnlyArgs(['repos/x/y/pulls/1', '--jq', '.head.sha']),
      ['repos/x/y/pulls/1', '--jq', '.head.sha'], 'a read argv passes through unchanged');
    // And every argv the poller actually produced during P1–P4 was a read.
    const gh = makeFakeGh({ headSha: HEAD_A, comments: [] });
    await pollPrComments(pool, { repo: REPO, prNumber: PR, gh });
    for (const c of gh.calls) assert.doesNotThrow(() => assertReadOnlyArgs(c.split(' ')), `poller argv must be read-only: ${c}`);
  });

  await test('P6 — a malformed API head is REFUSED outright: the poller never falls back to the body', async () => {
    // The failure that would quietly undo P1: if the API call fails or returns junk, the tempting
    // repair is "use the body head instead". That must be impossible, not merely discouraged.
    const badHead = makeFakeGh({ headSha: 'not-a-sha', comments: ghComments({ __HEAD_SHA__: HEAD_A, __FINDING_A__: 'x', __FINDING_B__: 'y' }) });
    await assert.rejects(() => pollPrComments(pool, { repo: REPO, prNumber: PR, gh: badHead }),
      /not a canonical 40-hex/, 'a non-canonical API head aborts the whole poll');
    const failing = makeFakeGh({ headSha: HEAD_A, failHead: 'gh api rate limit exceeded', comments: [] });
    await assert.rejects(() => pollPrComments(pool, { repo: REPO, prNumber: PR, gh: failing }),
      /rate limit exceeded/, 'an API failure aborts rather than degrading to the body head');
    assert.equal(failing.calls.filter((c) => c.includes('/issues/')).length, 0,
      'comments are not even fetched when the head could not be established');
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
       values ('BUILD-014', ?, ?, 'claimed', 'dead-watcher', now_plus_seconds(-3600)) returning id`,
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

  // ══════════════════════════════════════════════════════════════════════════
  // WO-TW-02 — THE PERSISTENT AUTOMATIC TRIGGER (A1–A9)
  //
  // The gap these close is the one the README stated in its own words: "Something must still
  // invoke the poller." A1–A4 prove the checkpoint hop in process; A5–A6 prove it through a
  // SPAWNED watcher with no command run against it; A7–A8 prove the failure alarm in both
  // directions; A9 proves the ClickUp claim by instrument rather than by grep.
  // ══════════════════════════════════════════════════════════════════════════

  const CP_REPO = 'warwickallan/Fusion247PKA';
  const HEAD_CP = 'c'.repeat(39) + '1';
  const HEAD_CP2 = 'd'.repeat(39) + '2';
  // The claim line is deliberate, not filler: the deterministic fake reviewer maps
  // "shipped. all good" to verdict='correct', which is a NOTIFYING verdict. An aligned
  // 'continue' is SILENT by design (fireTriggers), so a checkpoint with no claim would have
  // proven the turn was reviewed while proving nothing about the notification path.
  const checkpointBody = (head, buildRef = 'BUILD-019', extra = '') =>
    `Shipped. All good — checkpoint for review.\n\n@tower checkpoint: ${buildRef}\n@tower head: ${head}\n${extra}`;

  await test('A1 — an explicit `@tower checkpoint:` comment OPENS its own turn; an ordinary comment still cannot', async () => {
    const pr = 9001;
    // Precondition, asserted rather than assumed: NOTHING exists for this PR.
    assert.equal((await pool.query(`select count(*) n from tower.turn where repo = ? and pr_number = ?`, [CP_REPO, pr])).rows[0].n, 0);

    // An ordinary @tower comment on a PR Tower has never seen: the pre-existing refusal stands.
    const ghPlain = makeFakeGh({ headSha: HEAD_CP, comments: [ghComment({ id: 71001, body: `Just a note.\n@tower head: ${HEAD_CP}` })] });
    const plain = await pollPrComments(pool, { repo: CP_REPO, prNumber: pr, gh: ghPlain });
    assert.equal(plain.results[0].outcome, 'refused_ingest', 'no marker ⇒ no turn ⇒ the old refusal');
    assert.match(plain.results[0].reason, /no tower\.turn found/);
    assert.equal(plain.checkpointsCreated, 0);
    assert.equal((await pool.query(`select count(*) n from tower.turn where repo = ? and pr_number = ?`, [CP_REPO, pr])).rows[0].n, 0,
      'a comment WITHOUT the marker must never conjure a review round');

    // Same PR, same head — but now an explicit checkpoint.
    const ghCp = makeFakeGh({ headSha: HEAD_CP, comments: [ghComment({ id: 71002, body: checkpointBody(HEAD_CP) })] });
    const cp = await pollPrComments(pool, { repo: CP_REPO, prNumber: pr, gh: ghCp });
    assert.equal(cp.checkpointsCreated, 1);
    assert.equal(cp.results[0].outcome, 'applied');
    assert.equal(cp.results[0].checkpoint.created, true);
    const turns = (await pool.query(`select id, state from tower.turn where repo = ? and pr_number = ?`, [CP_REPO, pr])).rows;
    assert.equal(turns.length, 1, 'exactly one turn opened');
    assert.equal(turns[0].state, 'pending', 'and it is claimable by the watcher');
  });

  await test('A2 — the checkpoint turn is bound to all six: repo, PR, API head, build ref, comment id, idempotency key', async () => {
    const pr = 9002; const commentId = 72001;
    const gh = makeFakeGh({ headSha: HEAD_CP, comments: [ghComment({ id: commentId, body: checkpointBody(HEAD_CP, 'BUILD-019') })] });
    const res = await pollPrComments(pool, { repo: CP_REPO, prNumber: pr, gh });
    const turnId = res.results[0].checkpoint.turnId;

    const t = (await pool.query(
      `select repo, pr_number, head_sha, build_ref, session_turn_key, larry_response from tower.turn where id = ?`, [turnId])).rows[0];
    assert.equal(t.repo, CP_REPO);
    assert.equal(Number(t.pr_number), pr);
    assert.equal(t.head_sha, HEAD_CP, 'the head is the API head');
    assert.equal(t.head_sha, res.apiHeadSha);
    assert.equal(t.build_ref, 'BUILD-019', 'build ref comes from the marker, never a guess');
    assert.equal(t.session_turn_key, checkpointTurnKey({ repo: CP_REPO, prNumber: pr, commentId }),
      'the durable key encodes the checkpoint comment id');
    assert.match(t.larry_response, /@tower checkpoint: BUILD-019/, 'the comment body is carried VERBATIM');

    // The sixth binding is also recorded relationally: the same comment's pr_comment row → turn.
    const c = (await pool.query(`select comment_id, turn_id, applied from tower.pr_comment where comment_id = ?`, [commentId])).rows[0];
    assert.equal(c.turn_id, turnId);
    assert.equal(c.applied, true);
  });

  await test('A3 — RE-POLLING the same checkpoint does not duplicate — with a CONTROL that proves the test can see a duplicate', async () => {
    const pr = 9003; const commentId = 73001;
    const gh = makeFakeGh({ headSha: HEAD_CP, comments: [ghComment({ id: commentId, body: checkpointBody(HEAD_CP) })] });

    const first = await pollPrComments(pool, { repo: CP_REPO, prNumber: pr, gh });
    const second = await pollPrComments(pool, { repo: CP_REPO, prNumber: pr, gh });
    const third = await pollPrComments(pool, { repo: CP_REPO, prNumber: pr, gh });
    assert.equal(first.results[0].checkpoint.created, true);
    assert.equal(second.results[0].checkpoint.created, false, 're-poll re-finds, never re-creates');
    assert.equal(third.results[0].checkpoint.created, false);
    assert.equal(first.results[0].checkpoint.turnId, second.results[0].checkpoint.turnId);

    const n = Number((await pool.query(`select count(*) n from tower.turn where repo = ? and pr_number = ?`, [CP_REPO, pr])).rows[0].n);
    assert.equal(n, 1, `three polls, one turn (got ${n})`);

    // ── THE CONTROL. Without it, "n === 1" could be true because the assertion is blind.
    // Disable the guard the way it would actually break — a turn created with NO durable
    // idempotency key — and the very same counting assertion must now SEE the duplicate.
    const args = {
      instruction: 'control duplicate probe', larryResponse: 'x', buildRef: 'BUILD-019',
      repo: CP_REPO, prNumber: pr, headSha: HEAD_CP, sessionTurnKey: null,
    };
    await ingestTurn(pool, args);
    await ingestTurn(pool, args);
    const nAfter = Number((await pool.query(`select count(*) n from tower.turn where repo = ? and pr_number = ?`, [CP_REPO, pr])).rows[0].n);
    assert.equal(nAfter, 3, `CONTROL: with the key removed the duplicate IS detected (expected 3, got ${nAfter})`);
  });

  await test('A4 — a checkpoint whose body head disagrees with the API head creates NOTHING (the head is still the API\'s)', async () => {
    const pr = 9004;
    const gh = makeFakeGh({ headSha: HEAD_CP, comments: [ghComment({ id: 74001, body: checkpointBody(HEAD_CP2) })] });
    const res = await pollPrComments(pool, { repo: CP_REPO, prNumber: pr, gh });
    assert.equal(res.results[0].outcome, 'refused_head_mismatch');
    assert.equal(res.checkpointsCreated, 0);
    assert.equal(Number((await pool.query(`select count(*) n from tower.turn where repo = ? and pr_number = ?`, [CP_REPO, pr])).rows[0].n), 0,
      'a checkpoint marker cannot bypass layer 1 — a typed SHA is never authority');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // WO-2026-08-03-05 — THE WATCHER POLLS EVERY OPEN PR (D1–D9)
  //
  // The defect these close, stated exactly, because the previous framing was wrong and cost a
  // round: nothing was hardcoded to a PR. `pollTargets` selected PRs from `tower.turn`
  // `where state <> 'complete'`, so A ROUND THAT FINISHED REMOVED ITS OWN PR FROM THE POLL LIST.
  // Success and blindness were the same event. The only thing that ever added a PR back was a
  // human supplying `TOWER_PR_SEED` at launch — a value living solely in `process.env`, refreshed
  // by nothing, lost the moment the process was replaced.
  //
  // AND THE REASON FIVE ROUNDS OF VALIDATION MISSED IT: every acceptance test supplied, at test
  // time, the exact binding production supplies once at launch and then never refreshes. The suite
  // proved the seed was OBEYED. It could not prove the seed was still CORRECT, because the suite
  // was what supplied it. The tested surface and the failing surface were disjoint.
  //
  // SO THE RULE FOR EVERYTHING BELOW: **a test must not supply the binding it is testing.** Where
  // the claim is discovery, `TOWER_PR_SEED` is UNSET and no turn is prepared, and the watcher has
  // to find the PR with nothing having told it to.
  // ══════════════════════════════════════════════════════════════════════════

  await test('D1 — TARGETS ARE OPEN PRs, NOT WORK STATE: a completed round no longer hides its own still-open PR, and PRs with no turn at all are polled', async () => {
    // THIS ASSERTION IS THE INVERSE OF THE ONE IT REPLACES, and deliberately so. The old A-unit
    // asserted "a completed PR stops being polled" — which was the DEFECT stated as a
    // requirement. Openness now governs: a completed turn is not a reason to stop watching a pull
    // request that is still open, because a new checkpoint can appear on it at any moment.
    await pool.query(`update tower.turn set state = 'complete' where pr_number = 9001`);
    const completeCount = Number((await pool.query(
      `select count(*) n from tower.turn where pr_number = 9001 and state <> 'complete'`)).rows[0].n);
    assert.equal(completeCount, 0, 'precondition: PR 9001 has NO non-complete turn — the old rule yielded nothing here');

    // GitHub says three PRs are open. 9001 has only completed turns; 9002 has a live one; 9999 has
    // never been seen by Tower at all.
    const gh = makeFakeGh({ headSha: HEAD_CP, comments: [], openPrs: { [CP_REPO]: [9001, 9002, 9999] } });
    const targets = await pollTargets(pool, { gh, detectRepo: async () => CP_REPO });
    const keys = targets.map((t) => `${t.repo}#${t.prNumber}`);

    assert.ok(keys.includes(`${CP_REPO}#9001`), 'a still-open PR whose round COMPLETED is still polled');
    assert.ok(keys.includes(`${CP_REPO}#9002`), 'a PR with a live round is polled');
    assert.ok(keys.includes(`${CP_REPO}#9999`), 'a PR with NO turn in the store at all is polled — nothing had to tell us about it');
  });

  await test('D2 — A MERGED PR DROPS OUT even though its turn is live AND it is explicitly seeded (the live defect, both halves)', async () => {
    // Measured live on 2026-08-03: watcher PID 9616 healthy, heartbeat advancing, polling PR #90 —
    // merged at 2026-08-02T23:30:33Z — while PR #91 sat open and unpolled. Both possible bindings
    // for #90 are reproduced here at once, and NEITHER may survive GitHub saying "closed".
    const pr = 9021;
    await inertTurn({ buildRef: 'BUILD-D02', headSha: HEAD_A, instruction: 'live round', larryResponse: 'x' });
    await pool.query(`update tower.turn set pr_number = ? where instruction = 'live round'`, [pr]);
    assert.ok(Number((await pool.query(
      `select count(*) n from tower.turn where pr_number = ? and state <> 'complete'`, [pr])).rows[0].n) > 0,
    'precondition: the merged PR still has a NON-complete turn — the old rule would poll it forever');

    process.env.TOWER_PR_SEED = `${CP_REPO}#${pr}`;   // and a stale launch-time seed names it too
    try {
      const gh = makeFakeGh({ headSha: HEAD_CP, comments: [], openPrs: { [CP_REPO]: [9022] } });
      const targets = await pollTargets(pool, { gh, detectRepo: async () => CP_REPO });
      const keys = targets.map((t) => `${t.repo}#${t.prNumber}`);
      assert.ok(!keys.includes(`${CP_REPO}#${pr}`),
        `a merged PR must not be polled, whatever the store or the seed says (got ${JSON.stringify(keys)})`);
      assert.ok(keys.includes(`${CP_REPO}#9022`), 'and the PR that IS open is polled instead');

      // THE SEED HAS NO POWER OF ITS OWN ANY MORE — only its repository survives.
      assert.deepEqual(seedRepos({ TOWER_PR_SEED: `${CP_REPO}#${pr}` }), [CP_REPO],
        'a seed entry contributes its REPOSITORY and nothing else');
    } finally { delete process.env.TOWER_PR_SEED; }
  });

  await test('D3 — a NEWLY OPENED PR is picked up mid-run with no restart, no seed and no store row', async () => {
    const gh1 = makeFakeGh({ headSha: HEAD_CP, comments: [], openPrs: { [CP_REPO]: [9031] } });
    const before = (await pollTargets(pool, { gh: gh1, detectRepo: async () => CP_REPO })).map((t) => t.prNumber);
    assert.ok(!before.includes(9032), 'precondition: 9032 is not open yet and is not a target');

    // GitHub state changes. Nothing else does — no restart, no configuration, no insert.
    const gh2 = makeFakeGh({ headSha: HEAD_CP, comments: [], openPrs: { [CP_REPO]: [9031, 9032] } });
    const after = (await pollTargets(pool, { gh: gh2, detectRepo: async () => CP_REPO })).map((t) => t.prNumber);
    assert.ok(after.includes(9032), 'the newly opened PR became a target on the very next round');
    assert.ok(after.includes(9031), 'and the existing one did not fall out');
  });

  await test('D4 — the REPOSITORY comes from durable sources, NOT from a launch-time env binding', async () => {
    // The durability half. `detectCheckoutRepo` reads the checkout's own origin remote — on disk,
    // re-read every round, unaffected by process replacement. The store is the second durable
    // source. TOWER_PR_SEED is neither required nor sufficient.
    delete process.env.TOWER_PR_SEED;

    // 1. A FRESH store — nothing Tower has ever seen — with NO seed. If the repo were only
    //    discoverable from the store or the environment, this yields nothing.
    const freshPath = path.join(TMP_DIR, 'fresh-discovery.db');
    const fresh = openDb(freshPath);
    try {
      await applySchema(fresh); await applyWatcherSchema(fresh); await applyCommentSchema(fresh); await applyPostSchema(fresh);
      assert.equal(Number((await fresh.query(`select count(*) n from tower.turn`)).rows[0].n), 0, 'precondition: empty store');

      const asked = [];
      const gh = makeFakeGh({ headSha: HEAD_CP, comments: [], openPrs: { [CP_REPO]: [4242] } });
      const spy = { async api(args) { asked.push(args[0]); return gh.api(args); } };
      const targets = await pollTargets(fresh, { gh: spy, detectRepo: async () => CP_REPO });
      assert.deepEqual(targets, [{ repo: CP_REPO, prNumber: 4242 }],
        'with an empty store and NO seed, the checkout itself is enough to find an open PR');
      assert.ok(asked.some((e) => e.startsWith(`repos/${CP_REPO}/pulls?state=open`)), 'GitHub was asked which PRs are open');

      // 2. NO repository from ANY source ⇒ empty, and that state is DISTINCT in the log from
      //    "nothing is open". It must never look like a healthy idle round.
      const none = await pollTargets(fresh, { gh: spy, detectRepo: async () => null });
      assert.deepEqual(none, [], 'no repository anywhere ⇒ no targets');
    } finally { await fresh.end(); }

    // 3. And the real derivation is not a stub: run it against THIS checkout and compare with a
    //    SECOND, independent instrument (git invoked directly by the test).
    const detected = await detectCheckoutRepo({ cwd: LOOP_DIR });
    const viaGit = await new Promise((resolve) => {
      execFile('git', ['remote', 'get-url', 'origin'], { cwd: LOOP_DIR, windowsHide: true }, (err, out) => {
        if (err) return resolve(null);
        const m = /[/:]([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+?)(?:\.git)?$/.exec(String(out).trim());
        resolve(m ? m[1] : null);
      });
    });
    assert.equal(detected, viaGit, 'the product derives the same repository a plain git call does');
    assert.ok(detected && /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(detected), `and it is a real owner/name (got ${detected})`);

    // 4. A checkout with no usable remote yields null rather than throwing or guessing.
    assert.equal(await detectCheckoutRepo({ exec: (_c, _a, _o, cb) => cb(new Error('not a git repository')) }), null);
    assert.equal(await detectCheckoutRepo({ exec: (_c, _a, _o, cb) => cb(null, 'not-a-url\n') }), null);
  });

  await test('D5 — DISCOVERY FAILURE IS LOUD: it throws rather than returning an empty set that looks like a healthy idle watcher', async () => {
    const failing = { async api() { throw new Error('gh api rate limit exceeded'); } };
    await assert.rejects(() => pollTargets(pool, { gh: failing, detectRepo: async () => CP_REPO }),
      /rate limit exceeded/, 'a discovery failure must propagate — silence is the defect');

    // TWO-SIDED. A genuinely empty repository returns [] WITHOUT throwing, so the assertion above
    // is not simply "pollTargets always throws".
    const empty = makeFakeGh({ headSha: HEAD_CP, comments: [], openPrs: { [CP_REPO]: [] } });
    assert.deepEqual(await pollTargets(pool, { gh: empty, detectRepo: async () => CP_REPO }), [],
      'no open PRs is a legitimate, non-throwing, empty result');

    // And the throw reaches the alarm path: runWatcher converts it into a FAILED round, which is
    // what feeds the 3-strike tower_failure. A7 exercises that end to end with a failing fixture.
  });

  await test('D6 — the discovery call is READ-ONLY and asks for exactly the open PRs', async () => {
    const gh = makeFakeGh({ headSha: HEAD_CP, comments: [], openPrs: { [CP_REPO]: [9061] } });
    await pollTargets(pool, { gh, detectRepo: async () => CP_REPO });
    const call = gh.calls.find((c) => c.includes('pulls?state=open'));
    assert.ok(call, `discovery was actually invoked (calls: ${JSON.stringify(gh.calls)})`);
    assert.doesNotThrow(() => assertReadOnlyArgs(call.split(' ')), `discovery argv must be read-only: ${call}`);
    assert.match(call, /--paginate/, 'paginated, so a repo with many open PRs is not silently truncated by GitHub');

    // The parser refuses junk rather than degrading to an empty list.
    await assert.rejects(() => fetchOpenPrs({ async api() { return 'nine\n'; } }, { repo: CP_REPO }), /non-numeric/);
    await assert.rejects(() => fetchOpenPrs({ async api() { return '0\n'; } }, { repo: CP_REPO }), /non-positive/);
    assert.deepEqual(await fetchOpenPrs({ async api() { return '7\n8\n'; } }, { repo: CP_REPO }), [7, 8]);
    assert.deepEqual(await fetchOpenPrs({ async api() { return ''; } }, { repo: CP_REPO }), [], 'an empty page is an empty list, not an error');
  });

  await test('D7 — the cap bounds a round, prefers PRs with live rounds, and says so rather than dropping silently', async () => {
    const many = Array.from({ length: 12 }, (_, i) => 9500 + i);
    const gh = makeFakeGh({ headSha: HEAD_CP, comments: [], openPrs: { [CP_REPO]: [...many, 9002] } });
    const targets = await pollTargets(pool, { gh, limit: 5, detectRepo: async () => CP_REPO });
    assert.equal(targets.length, 5, 'the round is bounded — a repo full of open PRs is not a rate-limit incident');
    assert.equal(targets[0].prNumber, 9002, 'a PR with a LIVE round is ranked first and is never the one dropped');
    // The remainder is newest-first, which is deterministic rather than incidental.
    assert.deepEqual(targets.slice(1).map((t) => t.prNumber), [9511, 9510, 9509, 9508]);
  });

  // ── A5/A6: the SPAWNED watcher. No poller, no CLI, no insert — a comment appears, and that
  // is the only thing that happens externally.
  const GH_FIXTURE = path.join(TMP_DIR, 'gh-fixture.json');
  // WO-2026-08-03-05 — every spawned-watcher fixture must now state WHICH PRs GitHub considers
  // open, because that is what the watcher discovers. `openPrs` defaults to nothing (the double
  // refuses an unmodelled endpoint), so a fixture that forgets it fails loudly instead of
  // silently polling whatever the old work-state rule happened to yield.
  const writeFixture = (o) => fs.writeFileSync(GH_FIXTURE, JSON.stringify(o), 'utf8');
  /** Fixture helper: one PR, open, with its comments. */
  const openFixture = (pr, o) => writeFixture({ openPrs: { [CP_REPO]: [pr] }, ...o });
  const POLL_ENV = {
    TOWER_PR_POLL: 'on',
    TOWER_PR_POLL_MS: '400',
    TOWER_GH_MODULE: path.join(__dirname, 'doubles', 'fakeGhModule.mjs'),
    TOWER_FAKE_GH_FIXTURE: GH_FIXTURE,
    // The heuristic would route a "checkpoint" turn to the merge-class path and its git evidence;
    // T5/T6 already cover that routing. Kept off so A5/A6 measure the TRIGGER, not the router.
    TOWER_MERGE_CLASS_HEURISTIC: 'off',
  };
  const turnForPr = async (pr) => (await pool.query(
    `select id, state, head_sha, build_ref from tower.turn where repo = ? and pr_number = ? order by seq desc`, [CP_REPO, pr])).rows;

  await test('A5 — END TO END: no turn is prepared, NOTHING NAMES THE PR, and the RUNNING watcher discovers it, opens the turn, reviews it and notifies', async () => {
    const pr = 9005;
    openFixture(pr, { headSha: HEAD_CP, comments: [ghComment({ id: 75001, body: checkpointBody(HEAD_CP) })] });
    assert.equal((await turnForPr(pr)).length, 0, 'acceptance step 1: nothing prepared by hand');

    // WO-2026-08-03-05 — NO TOWER_PR_SEED. This test used to hand the watcher the exact PR number
    // it was then asked to prove it polled, which proved only that the seed was obeyed. The number
    // is now GitHub's to tell it.
    const w = spawnWatcher('ci-trigger-a5', POLL_ENV);
    try {
      // Nothing is run against the watcher from here on. It has to find this itself.
      const deadline = Date.now() + 40000;
      let turn = null;
      while (Date.now() < deadline) {
        const rows = await turnForPr(pr);
        if (rows.length) { turn = rows[0]; break; }
        await sleep(250);
      }
      assert.ok(turn, 'the running watcher created the turn with no command run against it');
      assert.equal(turn.head_sha, HEAD_CP);
      assert.equal(turn.build_ref, 'BUILD-019');

      await waitForProcessed(pool, turn.id, 40000);
      const reviews = await reviewsFor(pool, turn.id);
      assert.equal(reviews.length, 1, 'the reviewer ran exactly once on the auto-created turn');
      const notes = await notesFor(pool, turn.id);
      assert.equal(notes.filter((n) => n.reason === 'codex_block_or_redirect').length, 1,
        'and exactly one notification went out through the existing path');
    } finally { await killWatcher(w); }
  });

  await test('A6 — RESTART causes no duplicate, and a SECOND checkpoint posted later is detected by the restarted watcher', async () => {
    const pr = 9005;
    const beforeRestart = await turnForPr(pr);
    assert.equal(beforeRestart.length, 1, 'precondition: exactly one turn from A5');

    // Acceptance step 7 — restart, same fixture, same comment still on the PR.
    const w2 = spawnWatcher('ci-trigger-a6', POLL_ENV);
    try {
      await sleep(2500); // several poll rounds at 400ms — it re-sees the checkpoint every time
      const afterRestart = await turnForPr(pr);
      assert.equal(afterRestart.length, 1, `restart must not duplicate the turn (got ${afterRestart.length})`);
      assert.equal((await reviewsFor(pool, beforeRestart[0].id)).length, 1, 'nor re-review it');

      // Acceptance step 8 — a SECOND checkpoint appears while the watcher is already running.
      writeFixture({
        openPrs: { [CP_REPO]: [pr] },
        headSha: HEAD_CP2,
        comments: [
          ghComment({ id: 75001, body: checkpointBody(HEAD_CP) }),      // the old one, now stale
          ghComment({ id: 75002, body: checkpointBody(HEAD_CP2) }),     // the new checkpoint
        ],
      });
      const deadline = Date.now() + 40000;
      let second = null;
      while (Date.now() < deadline) {
        const rows = await turnForPr(pr);
        const cand = rows.find((r) => r.head_sha === HEAD_CP2);
        if (cand) { second = cand; break; }
        await sleep(250);
      }
      assert.ok(second, 'a LATER checkpoint is detected by the already-running watcher');
      assert.notEqual(second.id, beforeRestart[0].id, 'and it is a NEW round, not the old one reopened');
      await waitForProcessed(pool, second.id, 40000);
      assert.equal((await reviewsFor(pool, second.id)).length, 1, 'the whole journey repeats');
      assert.equal((await turnForPr(pr)).length, 2, 'exactly two rounds for two checkpoints');
    } finally { await killWatcher(w2); }
  });

  await test('A7 — a PERSISTENTLY failing poll fires a LOUD tower_failure alarm (now covering DISCOVERY failure, which is the first call to break)', async () => {
    writeFixture({ openPrs: { [CP_REPO]: [9007] }, headSha: HEAD_CP, comments: [], fail: 'simulated GitHub outage' });
    const before = Number((await pool.query(`select count(*) n from tower.notification where reason = 'tower_failure' and turn_id is null`)).rows[0].n);
    const w = spawnWatcher('ci-trigger-a7', POLL_ENV);
    try {
      const deadline = Date.now() + 30000;
      let row = null;
      while (Date.now() < deadline) {
        const { rows } = await pool.query(
          `select message, state from tower.notification where reason = 'tower_failure' and turn_id is null order by rowid desc limit 1`);
        if (rows.length && /poll rounds FAILED/.test(String(rows[0].message))) { row = rows[0]; break; }
        await sleep(250);
      }
      assert.ok(row, 'the alarm fired');
      assert.equal(row.state, 'poll_failing');
      assert.match(String(row.message), /simulated GitHub outage/, 'and it names the actual cause');
      const after = Number((await pool.query(`select count(*) n from tower.notification where reason = 'tower_failure' and turn_id is null`)).rows[0].n);
      assert.equal(after, before + 1, 'exactly ONE alarm per failure streak — loud, not spam');
    } finally { await killWatcher(w); }
  });

  await test('A8 — CONTROL: a HEALTHY poll fires no alarm (the A7 assertion is two-sided, not always-true)', async () => {
    openFixture(9008, { headSha: HEAD_CP, comments: [ghComment({ id: 78001, body: checkpointBody(HEAD_CP) })] });
    const before = Number((await pool.query(`select count(*) n from tower.notification where reason = 'tower_failure' and turn_id is null`)).rows[0].n);
    const w = spawnWatcher('ci-trigger-a8', POLL_ENV);
    try {
      await sleep(4000); // ≥ 3 × PR_POLL_FAIL_ESCALATE_AFTER poll intervals — long enough to alarm if it were going to
      const after = Number((await pool.query(`select count(*) n from tower.notification where reason = 'tower_failure' and turn_id is null`)).rows[0].n);
      assert.equal(after, before, 'no alarm on a healthy poll');
    } finally { await killWatcher(w); }
  });

  await test('A9 — ZERO CLICKUP, instrumented: the trigger path\'s module graph is enumerated and a ClickUp trap is proven to bite', async () => {
    const graphOut = path.join(TMP_DIR, 'module-graph.txt');
    fs.writeFileSync(graphOut, '', 'utf8');
    openFixture(9009, { headSha: HEAD_CP, comments: [ghComment({ id: 79001, body: checkpointBody(HEAD_CP) })] });

    const probe = path.join(__dirname, 'doubles', 'graph-probe.mjs');
    const run = (mode) => new Promise((res) => {
      const c = spawn(process.execPath, [probe, mode], {
        cwd: LOOP_DIR,
        env: { ...process.env, GRAPH_OUT: graphOut, TOWER_FAKE_GH_FIXTURE: GH_FIXTURE, TOWER_PR_SEED: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let out = ''; let err = '';
      c.stdout.on('data', (d) => { out += d; });
      c.stderr.on('data', (d) => { err += d; });
      c.on('exit', (code) => res({ code, out, err }));
    });

    const trigger = await run('trigger');
    assert.equal(trigger.code, 0, `trigger probe failed: ${trigger.err.slice(0, 400)}`);

    const urls = fs.readFileSync(graphOut, 'utf8').split('\n').filter(Boolean);
    // THE RECORDER'S OWN CONTROL. An empty or broken recording must never read as "clean".
    assert.ok(urls.length > 10, `the recorder captured a real graph (got ${urls.length} entries)`);
    for (const must of ['watcher.mjs', 'pollPrComments.mjs', 'ingestComment.mjs', 'loop.mjs', 'db.mjs', 'notify.mjs']) {
      assert.ok(urls.some((u) => u.endsWith(must)), `the recording contains ${must} — proving the instrument is live`);
    }
    // THE CLAIM ITSELF.
    const clickup = urls.filter((u) => /clickup/i.test(u));
    assert.deepEqual(clickup, [], `the trigger path loaded ClickUp modules: ${clickup.join(', ')}`);

    // THE TRAP'S OWN CONTROL: import the estate's REAL ClickUp client under the same hooks.
    const control = await run('control-trap');
    assert.equal(control.code, 0, `the ClickUp trap did NOT fire (${control.out.trim()}) — a zero from a trap that cannot fire is a false green`);
    assert.match(control.out, /TRAP_FIRED: ZERO-CLICKUP TRAP/);
  });

  // ── A11–A14: the verdict goes back ONTO the PR (Warwick's step 5, second half) ────────────
  const POSTS_FILE = path.join(TMP_DIR, 'gh-posts.jsonl');
  const readPosts = () => (fs.existsSync(POSTS_FILE)
    ? fs.readFileSync(POSTS_FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : []);
  const WRITEBACK_ENV = { ...POLL_ENV, TOWER_PR_WRITEBACK: 'on', TOWER_FAKE_GH_POSTS: POSTS_FILE };
  // AND IN THIS PROCESS TOO. The fake writer reads both of these from the environment, so without
  // them an IN-PROCESS postPendingVerdicts() throws inside the double, the error is swallowed into
  // `errors`, nothing is written to POSTS_FILE — and "no new post appeared" then passes the
  // no-duplicate assertion for entirely the wrong reason. That false green existed in this file
  // until A13's control caught it, which is precisely what the control is for.
  process.env.TOWER_FAKE_GH_FIXTURE = GH_FIXTURE;
  process.env.TOWER_FAKE_GH_POSTS = POSTS_FILE;

  await test('A11 — the WRITE seam is an ALLOWLIST: it accepts exactly a comment POST and refuses everything else', async () => {
    // The mirror of P5. The poller refuses anything MUTATING; the writer refuses anything that is
    // not exactly this one call. Both guards exist because the argv is built internally, which is
    // precisely when a guard stops being exercised and starts being forgotten.
    assertCommentPostArgs(['--method', 'POST', 'repos/o/n/issues/7/comments', '-f', 'body=hello']);

    const refusals = [
      [['--method', 'GET', 'repos/o/n/issues/7/comments', '-f', 'body=x'], /not an explicit POST/],
      [['--method', 'POST', 'repos/o/n/pulls/7/merge', '-f', 'body=x'], /anything but a PR comments endpoint/],
      [['--method', 'POST', 'repos/o/n/issues/7/comments', '-f', 'state=closed'], /only field is not the comment body/],
      [['--method', 'POST', 'repos/o/n/issues/7/comments', '-f', 'body=x', '-f', 'labels=bug'], /unexpected extra arguments/],
      [['repos/o/n/issues/7/comments'], /not an explicit POST/],
    ];
    for (const [args, re] of refusals) {
      assert.throws(() => assertCommentPostArgs(args), re, `should refuse: ${args.join(' ')}`);
    }

    // And the READ guard is untouched — a mutating argv is still refused over there.
    assert.throws(() => assertReadOnlyArgs(['repos/o/n/issues/7/comments', '--method', 'POST']), /refusing a non-read-only/);
  });

  await test('A12 — after an auto-created round completes, the verdict is POSTED to the PR carrying verdict, head and the checkpoint it answers', async () => {
    const pr = 9012;
    openFixture(pr, { headSha: HEAD_CP, comments: [ghComment({ id: 91201, body: checkpointBody(HEAD_CP) })] });
    assert.equal((await turnForPr(pr)).length, 0);
    const postsBefore = readPosts().length;

    const w = spawnWatcher('ci-writeback-a12', WRITEBACK_ENV);
    try {
      const deadline = Date.now() + 40000;
      let posted = null;
      while (Date.now() < deadline) {
        const p = readPosts().slice(postsBefore).filter((x) => x.prNumber === pr);
        if (p.length) { posted = p[0]; break; }
        await sleep(250);
      }
      assert.ok(posted, 'the verdict reached the PR with no command run against the watcher');
      assert.equal(posted.repo, CP_REPO);
      assert.match(posted.body, /\*\*Tower review — CORRECT\*\*/, 'the verdict is stated');
      assert.ok(posted.body.includes(HEAD_CP), 'the head reviewed is stated — a verdict with no head is unfalsifiable');
      assert.match(posted.body, /Answers checkpoint:.*91201/, 'and which checkpoint it answers');

      // Durably recorded, and recorded as POSTED — not merely attempted.
      const turn = (await turnForPr(pr))[0];
      const rec = (await pool.query(
        `select posted, comment_id, attempts, last_error, post_key from tower.pr_verdict_post where turn_id = ?`, [turn.id])).rows;
      assert.equal(rec.length, 1);
      assert.equal(rec[0].posted, true);
      assert.equal(Number(rec[0].comment_id), posted.id);
      assert.equal(rec[0].last_error, null);
    } finally { await killWatcher(w); }
  });

  await test('A13 — re-sweeping and RESTARTING never double-post — with a CONTROL that proves the test can see a duplicate', async () => {
    const pr = 9012;
    const turn = (await turnForPr(pr))[0];
    const before = readPosts().filter((x) => x.prNumber === pr).length;
    assert.equal(before, 1, 'precondition: exactly one post from A12');

    // Sweep repeatedly in-process, and re-queue as a restarted watcher would.
    for (let i = 0; i < 3; i += 1) {
      await queueVerdictForTurn(pool, turn.id);
      await postPendingVerdicts(pool, { writer: fakeGhWriter, reader: null });
    }
    // And a real restart, which re-queues on boot the same way.
    const w = spawnWatcher('ci-writeback-a13', WRITEBACK_ENV);
    try { await sleep(2500); } finally { await killWatcher(w); }

    const after = readPosts().filter((x) => x.prNumber === pr).length;
    assert.equal(after, 1, `three sweeps and a restart, still one comment on the PR (got ${after})`);
    assert.equal(Number((await pool.query(
      `select count(*) n from tower.pr_verdict_post where turn_id = ?`, [turn.id])).rows[0].n), 1,
    'and exactly one durable claim row');

    // ── THE CONTROL. Remove the guard the way it would actually break — a claim row inserted
    // with a NON-deterministic key — and the very same counting assertion must SEE the duplicate.
    const rec = (await pool.query(`select review_id, repo, pr_number, head_sha, body from tower.pr_verdict_post where turn_id = ?`, [turn.id])).rows[0];
    await pool.query(
      `insert into tower.pr_verdict_post (post_key, review_id, turn_id, repo, pr_number, head_sha, body)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [`control-non-deterministic-${Date.now()}`, rec.review_id, turn.id, rec.repo, rec.pr_number, rec.head_sha, rec.body]);
    await postPendingVerdicts(pool, { writer: fakeGhWriter, reader: null });
    const ctrl = readPosts().filter((x) => x.prNumber === pr).length;
    assert.equal(ctrl, 2, `CONTROL: with the deterministic key gone the duplicate IS detected (expected 2, got ${ctrl})`);
  });

  await test('A14 — a FAILING post is fail-closed and LOUD: nothing claims the round was answered, and the alarm fires', async () => {
    const pr = 9014;
    openFixture(pr, {
      headSha: HEAD_CP, comments: [ghComment({ id: 91401, body: checkpointBody(HEAD_CP) })],
      postFail: 'simulated GitHub write outage',
    });
    const before = Number((await pool.query(
      `select count(*) n from tower.notification where reason = 'tower_failure' and turn_id is null and state = 'post_failing'`)).rows[0].n);
    assert.equal(before, 0, 'precondition: no write-back alarm has fired yet');

    const w = spawnWatcher('ci-writeback-a14', WRITEBACK_ENV);
    try {
      const deadline = Date.now() + 40000;
      let alarm = null;
      while (Date.now() < deadline) {
        const { rows } = await pool.query(
          `select message, state from tower.notification
            where reason = 'tower_failure' and turn_id is null and state = 'post_failing'
            order by rowid desc limit 1`);
        if (rows.length) { alarm = rows[0]; break; }
        await sleep(250);
      }
      assert.ok(alarm, 'the write-back alarm fired');
      assert.match(String(alarm.message), /reviews are NOT reaching the pull request/);
      assert.match(String(alarm.message), /simulated GitHub write outage/, 'and it names the actual cause');

      // FAIL-CLOSED: the round is NOT recorded as answered on the PR.
      const turn = (await turnForPr(pr))[0];
      const rec = (await pool.query(
        `select posted, attempts, last_error from tower.pr_verdict_post where turn_id = ?`, [turn.id])).rows[0];
      assert.ok(rec, 'the claim row exists — the verdict is retryable, not lost');
      assert.equal(rec.posted, false, 'and it is NOT marked posted');
      assert.ok(Number(rec.attempts) >= 1);
      assert.match(String(rec.last_error), /simulated GitHub write outage/);

      const after = Number((await pool.query(
        `select count(*) n from tower.notification where reason = 'tower_failure' and turn_id is null and state = 'post_failing'`)).rows[0].n);
      assert.equal(after, before + 1, 'exactly ONE alarm per failure streak — loud, not one per round');
    } finally { await killWatcher(w); }
  });

  await test('A15 — CHAINED, END TO END: a disposition comment against an AUTO-CREATED round is consumed by a SUBSEQUENT auto-created round', async () => {
    // W4 proved consumption. A5/A6 proved auto-creation. Neither proved the JOURNEY, and the
    // difference between "both halves work" and "the journey works" is exactly the difference
    // this estate keeps paying for. Nothing below is run by hand except writing PR comments.
    const pr = 9015;
    // A VALID ref, and the validity matters: classifyBuildRef enforces /^BUILD-\d{3}$/ and falls
    // back to UNCLASSIFIED for anything else. An earlier draft of this test used 'BUILD-A15',
    // the round landed as UNCLASSIFIED, and the finding — opened against 'BUILD-A15' — was never
    // carried forward, so the gate did not fire. That is correct never-guess behaviour in the
    // product and a defect in the test; see A16, which now pins it.
    const BUILD = 'BUILD-915';
    const cp = (head, id) => ghComment({ id, body: `Shipped. All good — checkpoint for review.\n\n@tower checkpoint: ${BUILD}\n@tower head: ${head}` });

    // ROUND 1 — a checkpoint appears; the running watcher opens and reviews it.
    openFixture(pr, { headSha: HEAD_CP, comments: [cp(HEAD_CP, 91501)] });
    const w = spawnWatcher('ci-chain-a15', WRITEBACK_ENV);
    try {
      const waitForTurnAt = async (head, timeoutMs = 40000) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const rows = (await pool.query(
            `select id, state, head_sha from tower.turn where repo = ? and pr_number = ? and head_sha = ? order by seq desc`,
            [CP_REPO, pr, head])).rows;
          if (rows.length) return rows;
          await sleep(250);
        }
        throw new Error(`timed out waiting for an auto-created turn at head ${head}`);
      };

      const t1 = (await waitForTurnAt(HEAD_CP))[0];
      await waitForProcessed(pool, t1.id, 40000);

      // A finding is opened against round 1 — the thing that must not silently ride forward.
      const finding = await openFinding(pool, {
        buildRef: BUILD, openedTurnId: t1.id,
        description: 'pool.end() is not in a finally block — connection leak on throw',
      });

      // ROUND 2 — a NEW checkpoint at a NEW head. The finding is prior and UNDISPOSED, so the
      // gate must reject this round before any reviewer is invoked.
      openFixture(pr, { headSha: HEAD_CP2, comments: [cp(HEAD_CP, 91501), cp(HEAD_CP2, 91502)] });
      const t2 = (await waitForTurnAt(HEAD_CP2))[0];
      await waitForProcessed(pool, t2.id, 40000);
      const r2 = await reviewsFor(pool, t2.id);
      assert.equal(r2.length, 1);
      const r2row = (await pool.query(`select reviewer from tower.supervisor_review where turn_id = ?`, [t2.id])).rows[0];
      assert.equal(r2row.reviewer, 'tower_findings_gate',
        'an undisposed prior finding REJECTS the auto-created round — fail-closed, no reviewer invoked');

      // LARRY ANSWERS ON THE PR. A disposition comment at the CURRENT head. No command is run.
      const disposition = ghComment({
        id: 91503,
        body: `Fixed that.\n\n@tower head: ${HEAD_CP2}\n@tower finding ${finding.id}: addressed — pool.end() is now in a finally block.`,
      });
      // ROUND 3 — a further checkpoint at the SAME head, so the disposition is not stale for it.
      openFixture(pr, { headSha: HEAD_CP2, comments: [cp(HEAD_CP, 91501), cp(HEAD_CP2, 91502), disposition, cp(HEAD_CP2, 91504)] });

      const deadline = Date.now() + 40000;
      let t3 = null;
      while (Date.now() < deadline) {
        const rows = await waitForTurnAt(HEAD_CP2).catch(() => []);
        const cand = rows.find((r) => r.id !== t2.id);
        if (cand) { t3 = cand; break; }
        await sleep(250);
      }
      assert.ok(t3, 'the third checkpoint opened its own round automatically');
      await waitForProcessed(pool, t3.id, 40000);

      // THE POINT OF THE WHOLE CHAIN: round 3 was NOT rejected, and the disposition Larry wrote
      // on the PR reached the reviewer straight out of the database.
      const r3 = (await pool.query(
        `select reviewer, staged_input from tower.supervisor_review where turn_id = ?`, [t3.id])).rows[0];
      assert.notEqual(r3.reviewer, 'tower_findings_gate', 'the gate passed — the finding was answered');
      assert.match(String(r3.staged_input), new RegExp(`finding ${finding.id}`),
        'the finding is staged to the reviewer');
      assert.match(String(r3.staged_input), /disposition: addressed \(source=pr_comment:/,
        'carrying the disposition AND its provenance — ingested from the PR, not hand-carried');
      assert.match(String(r3.staged_input), /pool\.end\(\) is now in a finally block/);
      assert.match(String(r3.staged_input), new RegExp(`head=${HEAD_CP2.slice(0, 12)}`),
        'and the head the disposition was judged at');

      // EXACT provenance, at row level. `disposition_comment_id` is the tower.pr_comment ROW id
      // (a uuid), not GitHub's numeric comment id — so this pins the chain all the way back to
      // the specific PR comment Larry wrote, which the staged text alone cannot.
      const prRow = (await pool.query(
        `select id from tower.pr_comment where comment_id = ?`, [91503])).rows[0];
      assert.ok(prRow, 'the disposition comment was ingested from the PR');
      const fRow = (await pool.query(
        `select disposition_comment_id from tower.finding where id = ?`, [finding.id])).rows[0];
      assert.equal(fRow.disposition_comment_id, prRow.id,
        'the finding points at the exact PR comment that disposed it');

      // And the disposition is bound to the head it was judged at.
      const f = (await pool.query(
        `select disposition, disposition_source, disposition_head_sha from tower.finding where id = ?`, [finding.id])).rows[0];
      assert.equal(f.disposition, 'addressed');
      assert.equal(f.disposition_source, 'pr_comment');
      assert.equal(f.disposition_head_sha, HEAD_CP2);
    } finally { await killWatcher(w); }
  });

  await test('A16 — a checkpoint marker whose build ref is not BUILD-NNN falls back to UNCLASSIFIED and SAYS SO', async () => {
    // Found the hard way while writing A15. classifyBuildRef never guesses, which is right — but
    // the silent fallback means a typo'd marker opens a round on the wrong build, and that round's
    // findings then carry forward against a build nobody is looking at. The behaviour is pinned
    // here rather than left as folklore, and ensureCheckpointTurn now reports the mismatch.
    const pr = 9016;
    const gh = makeFakeGh({ headSha: HEAD_CP, comments: [ghComment({ id: 91601, body: checkpointBody(HEAD_CP, 'BUILD-TYPO') })] });
    const res = await pollPrComments(pool, { repo: CP_REPO, prNumber: pr, gh });
    const cpRes = res.results[0].checkpoint;
    assert.equal(cpRes.buildRef, 'UNCLASSIFIED', 'an invalid ref never becomes the build ref');
    assert.equal(cpRes.buildRefRequested, 'BUILD-TYPO', 'and what was ASKED for is reported back');
    assert.equal(cpRes.buildRefHonoured, false, 'flagged, so this is visible rather than silent');

    const t = (await pool.query(`select build_ref from tower.turn where id = ?`, [cpRes.turnId])).rows[0];
    assert.equal(t.build_ref, 'UNCLASSIFIED');

    // A VALID ref is honoured and reported as such — the two-sided half of the assertion.
    const gh2 = makeFakeGh({ headSha: HEAD_CP, comments: [ghComment({ id: 91602, body: checkpointBody(HEAD_CP, 'BUILD-019') })] });
    const ok = (await pollPrComments(pool, { repo: CP_REPO, prNumber: 9017, gh: gh2 })).results[0].checkpoint;
    assert.equal(ok.buildRef, 'BUILD-019');
    assert.equal(ok.buildRefHonoured, true);
  });

  // ── D8/D9: the claim Warwick actually cares about, through a SPAWNED watcher, with the suite
  // supplying nothing but the state of "GitHub". No seed, no prepared turn, no restart.
  const HEAD_D1 = 'e'.repeat(39) + '1';
  const HEAD_D2 = 'e'.repeat(39) + '2';
  const HEAD_D3 = 'e'.repeat(39) + '3';
  const cpBody = (head, id) => ghComment({ id, body: `Shipped. All good — checkpoint for review.\n\n@tower checkpoint: BUILD-908\n@tower head: ${head}` });

  await test('D8 — TWO open PRs are BOTH polled by one running watcher, each opening its own round, with nothing naming either of them', async () => {
    const prA = 9081; const prB = 9082;
    writeFixture({
      openPrs: { [CP_REPO]: [prA, prB] },
      byPr: {
        [prA]: { headSha: HEAD_D1, comments: [cpBody(HEAD_D1, 90810)] },
        [prB]: { headSha: HEAD_D2, comments: [cpBody(HEAD_D2, 90820)] },
      },
    });
    assert.equal((await turnForPr(prA)).length + (await turnForPr(prB)).length, 0, 'precondition: neither PR has a turn');

    const w = spawnWatcher('ci-discovery-d8', POLL_ENV);   // NO TOWER_PR_SEED
    try {
      const deadline = Date.now() + 40000;
      let a = null; let b = null;
      while (Date.now() < deadline && !(a && b)) {
        a = a ?? (await turnForPr(prA))[0] ?? null;
        b = b ?? (await turnForPr(prB))[0] ?? null;
        if (!(a && b)) await sleep(250);
      }
      assert.ok(a, 'PR A opened a round');
      assert.ok(b, `PR B opened a round TOO — merging or reviewing one PR must not leave the other unwatched (A=${!!a})`);
      assert.equal(a.head_sha, HEAD_D1, 'each round is bound to its OWN PR head');
      assert.equal(b.head_sha, HEAD_D2, 'and not to the other PR\'s');
      assert.notEqual(a.id, b.id, 'two distinct rounds');
      await waitForProcessed(pool, a.id, 40000);
      await waitForProcessed(pool, b.id, 40000);
      assert.equal((await reviewsFor(pool, a.id)).length, 1);
      assert.equal((await reviewsFor(pool, b.id)).length, 1);
    } finally { await killWatcher(w); }
  });

  await test('D9 — LIVE TRANSITION: one PR merges and a new one opens while the watcher runs — it stops polling the corpse and starts polling the newcomer, with no restart', async () => {
    // This is the exact event that has broken this loop five times: a merge. The watcher is
    // already running and is never told anything; only GitHub's answer changes.
    const merged = 9081; const stillOpen = 9082; const newcomer = 9083;
    writeFixture({
      openPrs: { [CP_REPO]: [stillOpen, newcomer] },        // 9081 has MERGED
      byPr: {
        // A brand-new checkpoint appears on the merged PR. It must NOT open a round.
        [merged]: { headSha: HEAD_D1, comments: [cpBody(HEAD_D1, 90810), cpBody(HEAD_D1, 90811)] },
        [stillOpen]: { headSha: HEAD_D2, comments: [cpBody(HEAD_D2, 90820)] },
        [newcomer]: { headSha: HEAD_D3, comments: [cpBody(HEAD_D3, 90830)] },
      },
    });
    const mergedTurnsBefore = (await turnForPr(merged)).length;
    assert.equal(mergedTurnsBefore, 1, 'precondition: the merged PR has exactly the one round D8 opened');

    const w = spawnWatcher('ci-discovery-d9', POLL_ENV);   // NO TOWER_PR_SEED
    try {
      const deadline = Date.now() + 40000;
      let fresh = null;
      while (Date.now() < deadline && !fresh) {
        fresh = (await turnForPr(newcomer))[0] ?? null;
        if (!fresh) await sleep(250);
      }
      assert.ok(fresh, 'the PR opened AFTER the watcher started is discovered and polled');
      assert.equal(fresh.head_sha, HEAD_D3);
      await waitForProcessed(pool, fresh.id, 40000);

      // Several more poll rounds, so "it just had not got there yet" is not an explanation.
      await sleep(2000);
      assert.equal((await turnForPr(merged)).length, mergedTurnsBefore,
        'the MERGED PR opened no further round despite a new checkpoint comment sitting on it');
    } finally { await killWatcher(w); }
  });

  await test('A10 — run-watcher.mjs is INERT on import: no directory created, no process stopped, nothing spawned', async () => {
    // The old launcher did all three at module scope, so merely importing it would mkdir into the
    // secrets-store tree, read two credential files and Stop-Process -Force every matching node
    // process. The main guard is the fix; this is the proof that the guard holds.
    //
    // HOME/USERPROFILE are redirected to a throwaway dir, so if module scope DID create the log
    // directory it would appear there — visibly, and without touching the real one.
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tower-inert-home-'));
    const url = pathToFileURL(path.join(LOOP_DIR, 'run-watcher.mjs')).href;
    const res = await new Promise((resolve) => {
      const c = spawn(process.execPath, ['--input-type=module', '-e',
        `const m = await import(${JSON.stringify(url)}); console.log('IMPORTED ' + typeof m.validateEnv + ' ' + typeof m.main);`], {
        cwd: LOOP_DIR,
        // A bare environment on purpose: the launcher's own validation would REFUSE to start here,
        // so if anything ran at import we would see its refusal or its side effects.
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: fakeHome, USERPROFILE: fakeHome },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let out = ''; let err = '';
      c.stdout.on('data', (d) => { out += d; });
      c.stderr.on('data', (d) => { err += d; });
      c.on('exit', (code) => resolve({ code, out, err }));
    });

    assert.equal(res.code, 0, `importing the launcher must not exit non-zero (stderr: ${res.err.slice(0, 300)})`);
    assert.match(res.out, /IMPORTED function function/, 'its exports are importable');
    assert.ok(!/\[tower-cp\]/.test(res.out + res.err), `main() must not have run on import — saw: ${(res.out + res.err).slice(0, 300)}`);
    assert.ok(!/REFUSING TO START/.test(res.err), 'nor its startup validation');
    assert.ok(!fs.existsSync(path.join(fakeHome, '.mypka')),
      'and no log directory was created — the import had no filesystem side effect');
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  // ── WO-2026-08-03-02 — no child process may pop a console window on Windows ──
  //
  // `child_process` defaults `windowsHide` to FALSE, so every bare launch flashes a console
  // window. The watcher polls on a 1.5s turn loop and a 60s PR poll, launching git/gh/codex
  // each time — which made Warwick's laptop unusable. These subtests prove the option is
  // actually there, and W3/W4 close the CLASS rather than the instances: inspection has no
  // completion condition, and this defect survived precisely because "the ones I found" was
  // never the same set as "the ones there are".

  await test('WH1 — gitEvidence launches EVERY git/gh child with windowsHide:true (injected spawn)', async () => {
    const calls = [];
    const fakeSpawn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      const c = new EventEmitter();
      c.stdout = new EventEmitter();
      c.stderr = new EventEmitter();
      c.kill = () => {};
      // rev-parse/merge-base must look like real SHAs or the gatherer fails closed early and
      // the later call sites are never reached — a green over ground never walked.
      const out = args.includes('rev-parse') ? `${'a'.repeat(40)}\n` : 'diff --git a/x b/x\n';
      setImmediate(() => { c.stdout.emit('data', Buffer.from(out)); c.emit('close', 0); });
      return c;
    };
    const ev = await gatherGitEvidence({ cwd: LOOP_DIR, repo: 'o/r', prNumber: 1, spawn: fakeSpawn });
    assert.equal(ev.resolved, true, 'the gatherer must have walked its whole path, not bailed early');
    assert.ok(calls.length >= 5, `expected every stage to launch a child, got ${calls.length}`);
    assert.ok(calls.some((c) => c.cmd === 'git'), 'the git seam was exercised');
    assert.ok(calls.some((c) => c.cmd === 'gh'), 'the gh seam was exercised');
    const bare = calls.filter((c) => c.opts?.windowsHide !== true);
    assert.equal(bare.length, 0, `these launches would pop a console window: ${bare.map((c) => c.cmd).join(', ')}`);
  });

  await test('WH2 — the Codex child (and its win32 taskkill reap) are launched windowsHide:true (injected spawn)', async () => {
    // Reaching the spawn needs auth+binary to resolve. Both are pointed at THROWAWAY artefacts:
    // an empty {} in a temp HOME and `node` itself as the "binary". No real credential is read —
    // a test whose pass depended on ~/.codex/auth.json would be both machine-dependent and a
    // credential dependency this role may not take.
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tower-codexspawn-'));
    fs.mkdirSync(path.join(fakeHome, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(fakeHome, '.codex', 'auth.json'), '{}', 'utf8');
    const saved = { UP: process.env.USERPROFILE, HOME: process.env.HOME, BIN: process.env.CODEX_BIN };
    try {
      process.env.USERPROFILE = fakeHome; process.env.HOME = fakeHome;
      process.env.CODEX_BIN = process.execPath;

      const mkChild = (settle) => {
        const c = new EventEmitter();
        c.stdout = new EventEmitter();
        c.stderr = new EventEmitter();
        c.stdin = { write() {}, end() {} };
        c.pid = 424242;
        c.kill = () => {};
        if (settle) setImmediate(() => { c.stdout.emit('data', Buffer.from('{"ok":1}\n')); c.emit('close', 0); });
        return c;
      };

      const calls = [];
      await realRunMergeReview({
        qaSkillText: 'skill', packet: {}, cwd: LOOP_DIR, timeoutMs: 5000,
        spawn: (cmd, args, opts) => { calls.push({ cmd, opts }); return mkChild(true); },
      });
      assert.equal(calls.length, 1, `expected exactly one codex launch, got ${calls.length}`);
      assert.equal(calls[0].opts?.windowsHide, true, 'the codex child would pop a console window');

      // The taskkill reap only exists on the win32 timeout path. Drive a child that never
      // closes so the timeout fires for real, rather than asserting the branch from its source.
      const killCalls = [];
      await realRunMergeReview({
        qaSkillText: 'skill', packet: {}, cwd: LOOP_DIR, timeoutMs: 30,
        spawn: (cmd, args, opts) => { killCalls.push({ cmd, opts }); return mkChild(false); },
      });
      if (process.platform === 'win32') {
        const tk = killCalls.filter((c) => c.cmd === 'taskkill');
        assert.equal(tk.length, 1, `the win32 timeout reap must have run, saw ${killCalls.map((c) => c.cmd).join(',')}`);
        assert.equal(tk[0].opts?.windowsHide, true, 'the taskkill reap would pop a console window');
      }
      const bare = killCalls.filter((c) => c.opts?.windowsHide !== true);
      assert.equal(bare.length, 0, `bare launches on the timeout path: ${bare.map((c) => c.cmd).join(', ')}`);
    } finally {
      if (saved.UP === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = saved.UP;
      if (saved.HOME === undefined) delete process.env.HOME; else process.env.HOME = saved.HOME;
      if (saved.BIN === undefined) delete process.env.CODEX_BIN; else process.env.CODEX_BIN = saved.BIN;
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  await test(`WH3 — ENUMERATION: all ${TOWER_LOOP_CP_SITES} child_process call sites under tower-loop carry windowsHide:true`, () => {
    const sites = scanChildProcessSites(jsFilesUnder(LOOP_DIR));
    const unparsed = sites.filter((s) => !s.parsed);
    assert.equal(unparsed.length, 0,
      `the scanner could not read the arguments of: ${unparsed.map((s) => `${s.rel}:${s.line}`).join(', ')} — an unread site is NOT a covered site`);
    const bare = sites.filter((s) => !s.hidden);
    assert.equal(bare.length, 0, `bare child_process launches: ${bare.map((s) => `${s.rel}:${s.line} ${s.fn}`).join(', ')}`);
    // Pinned to a literal held HERE, not derived from the sources it checks: a new launch site
    // — even a correct one — must be a deliberate decision, not a silent addition.
    assert.equal(sites.length, TOWER_LOOP_CP_SITES,
      `child_process call-site count moved (found ${sites.length}, pinned ${TOWER_LOOP_CP_SITES}). Review the new/removed site, then update the literal:\n${sites.map((s) => `  ${s.rel}:${s.line} ${s.fn}`).join('\n')}`);
  });

  await test('WH4 — CONTROL: the enumeration scanner can actually SEE a bare site (it is not always-green)', () => {
    const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'tower-scanprobe-'));
    try {
      // Three shapes at once: a bare launch, a covered launch, and the two things that have
      // already fooled a grep here — a JSDoc mention, and `.exec(` on a RegExp.
      const f = path.join(probe, 'probe.mjs');
      // The call text is ASSEMBLED so this file never contains a literal `<fn>(` adjacency —
      // otherwise W3, which scans this very directory, would count these fixtures as real
      // launch sites and the pinned total would be a fiction.
      const call = (fn, rest) => `const x${fn} = ${fn}${'('}${rest}`;
      fs.writeFileSync(f, [
        '/** @param {Function} [args.spawn]  injectable spawn (tests). */',
        call('spawn', "'git', ['x'], { cwd, shell: false });"),
        call('spawnSync', "'gh', ['y'], { cwd, windowsHide: true });"),
        'const m = SOME_RE.exec(text);',
        "// the launcher's own apostrophe, which once broke argument reading",
        call('execFile', "'gh', ['z'], { maxBuffer: 1 }, (e) => {});"),
      ].join('\n'), 'utf8');
      const sites = scanChildProcessSites([f]);
      assert.equal(sites.length, 3, `expected exactly 3 real call sites, got ${sites.map((s) => `${s.line}:${s.fn}`).join(',')}`);
      assert.ok(sites.every((s) => s.parsed), 'every site must be readable, apostrophe-in-comment included');
      assert.deepEqual(sites.map((s) => s.hidden), [false, true, false],
        'the scanner must call the bare ones bare and the covered one covered');
    } finally {
      fs.rmSync(probe, { recursive: true, force: true });
    }
  });

  await pool.end();
  // The throwaway store has served its purpose; leave nothing behind.
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch { /* best effort */ }

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
