// BUILD-014 Tower — the committed MERGE-CHECK entrypoint (merge_check_run flow).
//
// This is the ACTUAL runtime execution path for a bounded, exact-head merge-check against a PR.
// FIX F1: it ENFORCES classifyMergeRun as its FIRST gate — a merge-check cannot run unless the
// caller supplies an explicit, valid build_ref AND repo AND PR number AND full head SHA. The
// validator is no longer an unused helper: a missing/malformed target fails CLOSED here (the run
// is recorded 'blocked', no Codex is spent, TowerBot is told) before any review begins.
//
// It then: creates a durable tower.merge_check_run at the exact head, records ordered Larry then
// gpt_codex messages, gathers REAL git evidence over base..head, runs the REAL Codex merge review
// under the APPROVED Tower QA skill, stores the final verdict AT THE EXACT HEAD, and delivers the
// result via TowerBot. Bounded by maxRounds (default/most-3). No commits are made here.
//
//   node mergeCheck.mjs --pr 58 --repo warwickallan/Fusion247PKA \
//     --head <sha> --base <sha> --build BUILD-014 --wp tower-recovery
//
// WP-2F — THE STORE IS THE ONE CANONICAL SQLite FILE, not Postgres. `pool` is still the name of
// the handle parameter and still takes `await pool.query(sql, params) -> { rows, rowCount }`, but
// it is now db.mjs's façade over ~/.mypka/tower/tower.db (TOWER_SQLITE_PATH). Every SQL literal
// below was rewritten by hand from `$N` to `?`, which is a POSITIONAL change, not a textual one:
// `$1` may legally appear after `$2` and did (the two `update ... where id=$1` statements), so
// the params array had to be reordered to match. A blind `$N`→`?` replace would have silently
// written the round number into the id column.
import fs from 'node:fs';
import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyMergeRun } from './classifyBuild.mjs';
import { gatherGitEvidence } from './gitEvidence.mjs';
import { runMergeReview } from './supervisorCodex.mjs';
import { openDb } from './db.mjs';
import { applyMergeCheckSchema } from './apply.mjs';
import { CODEX_CONTRACT_PATH, loadCodexContract, assertDeliveredContract } from '../review/codexAdapter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = process.env.TOWER_EVIDENCE_REPO_DIR || path.resolve(__dirname, '../../..');
// WP-2G — resolved from codexAdapter.mjs's single exported constant, never re-derived. The old
// default pointed into `Builds/BUILD-010-fusion-tower/**`, which also meant the runtime default
// named a build: later builds inherited a BUILD-010 path for their reviewer's law.
export const DEFAULT_QA_SKILL = process.env.TOWER_QA_SKILL_PATH || CODEX_CONTRACT_PATH;

// ══════════════════════════════════════════════════════════════════════════════
// WO-2026-08-07-4C-03 — THE ESTATE-CONVERGENCE INVENTORY (reviewer contract §3b, responsibility B)
//
// WHY THIS EXISTS. §3b obliges a merge-class reviewer to establish nine convergence properties,
// and says in the same breath that it reviews in a read-only sandbox and "cannot enumerate the
// estate" itself — it must judge on the STAGED evidence, and "where that evidence is absent or
// insufficient, that is a finding or a `blocked` result — never an assumption that convergence
// happened." The packet staged repo/branch/head/base/diff_range/changed_files/diff_text and
// nothing else. So the obligation was live and the evidence for it was not: the only defensible
// §3b answer available to Codex was "insufficient evidence", on every merge-class review.
//
// FIVE PROPERTIES, in the order they matter:
//
//  1. FAIL SAFE AND VISIBLE. Every probe is independently reported. A probe that could not run
//     renders `PROBE FAILED: <command> — <reason>` and is counted in a summary line at the TOP of
//     the block. It NEVER renders as an empty section, a zero count, or silence — a failed
//     enumeration that reads as "no branches" would let a non-converged estate look converged,
//     which is the precise failure §3b exists to catch. Proven by forcing probes to fail.
//  2. IT IS EVIDENCE, NEVER A VERDICT. Nothing here computes convergence, and no boolean, score or
//     pass/fail is emitted. Codex judges; this function supplies facts.
//  3. CLASSIFIED BY CONTENT, NOT BY NAME. §3b: "Accounted for means classified by CONTENT, not by
//     name." Strandedness is measured as the count of file paths present on a ref's tree and
//     absent from `main`'s — `git ls-tree -r --name-only <tip>` minus the same for `main`. A branch
//     name is never a classifier, and a reader is told the method so the number can be reproduced.
//  4. BOUNDED. The block is capped at `maxBytes` and the number of distinct tips probed for
//     strandedness at `maxRefsProbed`. Both caps announce themselves LOUDLY when they bite, for
//     the same reason as (1): a silently shortened inventory is an instrument that lies in the
//     safe direction.
//  5. IT TOLERATES A MOVING ESTATE. Convergence is executed by Larry in this same repository while
//     a review is being prepared, so branches and worktrees genuinely disappear mid-enumeration.
//     Every tip is probed BY SHA captured at enumeration time, and a tip that has gone is recorded
//     as "disappeared during enumeration" — never as an error, and never as clean.
//
// NO SECRETS. Every value is repository metadata: ref names, object ids, paths, counts. Nothing
// reads a file's contents, an env var, or a credential.
// ══════════════════════════════════════════════════════════════════════════════

/** Byte cap for the whole staged block. Chosen against measurement, not taste: this estate stood
 *  at ~68 local + ~69 remote refs and ~18 worktrees while this was written, which renders to
 *  roughly 12–16 KB. 24 KB leaves real headroom for growth while staying far below the 60 KB the
 *  diff itself may occupy (MAX_DIFF_BYTES) — the two together must not crowd the child's stdin. */
export const MAX_CONVERGENCE_BYTES = 24_000;
/** Distinct commit tips probed for stranded files. Local and remote refs overwhelmingly share
 *  tips, so deduplicating by object id collapses ~66 non-contained refs to far fewer probes. */
export const MAX_REFS_PROBED = 80;
const CONVERGENCE_PROBE_TIMEOUT_MS = 20_000;

/**
 * Run one read-only probe. Never throws and never rejects: a failure is DATA, because the whole
 * point of this module is that a probe which could not run must appear in the packet rather than
 * vanish from it.
 */
function runProbe(cmd, args, { cwd, spawn = nodeSpawn, timeoutMs = CONVERGENCE_PROBE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const outChunks = []; const errChunks = [];
    let done = false;
    const settle = (r) => { if (!done) { done = true; resolve({ ...r, cmd: `${cmd} ${args.join(' ')}` }); } };
    const text = (chunks) => Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(String(c), 'utf8')))).toString('utf8');
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: false, windowsHide: true });
    } catch (e) {
      return settle({ ok: false, stdout: '', stderr: String(e?.message ?? e) });
    }
    const timer = setTimeout(() => {
      try { child.kill?.('SIGKILL'); } catch { /* ignore */ }
      settle({ ok: false, stdout: '', stderr: `timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout?.on('data', (d) => outChunks.push(d));
    child.stderr?.on('data', (d) => errChunks.push(d));
    child.on('error', (e) => { clearTimeout(timer); settle({ ok: false, stdout: '', stderr: String(e?.message ?? e) }); });
    child.on('close', (code) => { clearTimeout(timer); settle({ ok: code === 0, stdout: text(outChunks), stderr: text(errChunks) }); });
  });
}

const lines = (s) => String(s ?? '').split(/\r?\n/).filter((l) => l.trim() !== '');
const failLine = (r) => `PROBE FAILED: ${r.cmd} — ${String(r.stderr || 'no stderr; non-zero exit').trim().slice(0, 300)}`;

/**
 * Gather the read-only estate-convergence inventory and render it as the plain text staged into
 * `packet.convergence`.
 *
 * Returns `{ text, probes_run, probes_failed, truncated }`. It resolves even when every single
 * probe fails — in that case `text` says so in full, which is the behaviour that matters most.
 *
 * @param {string}   [args.cwd]           repository to enumerate (the local checkout Tower runs in)
 * @param {Function} [args.spawn]         injectable spawn — the one seam, shared with gitEvidence
 * @param {string}   [args.mainRef]       the canonical ref convergence is measured against
 * @param {number}   [args.maxBytes]      hard cap on the rendered block
 * @param {number}   [args.maxRefsProbed] hard cap on distinct tips probed for stranded files
 */
export async function gatherConvergenceEvidence({
  cwd = DEFAULT_REPO_ROOT,
  spawn = nodeSpawn,
  mainRef = 'main',
  maxBytes = MAX_CONVERGENCE_BYTES,
  maxRefsProbed = MAX_REFS_PROBED,
  timeoutMs = CONVERGENCE_PROBE_TIMEOUT_MS,
} = {}) {
  const opts = { cwd, spawn, timeoutMs };
  const git = (...args) => runProbe('git', args, opts);
  const failures = [];
  let probesRun = 0;
  const record = (r) => { probesRun += 1; if (!r.ok) failures.push(r); return r; };

  const REF_FMT = '%(refname:short)%09%(objectname)';
  const [mainRes, localRes, remoteRes, localMergedRes, remoteMergedRes,
    worktreeRes, stashRes, statusRes, prRes, mainTreeRes] = await Promise.all([
    git('rev-parse', '--verify', `${mainRef}^{commit}`),
    git('for-each-ref', `--format=${REF_FMT}`, 'refs/heads'),
    git('for-each-ref', `--format=${REF_FMT}`, 'refs/remotes'),
    git('branch', '--merged', mainRef, '--format=%(refname:short)'),
    git('branch', '-r', '--merged', mainRef, '--format=%(refname:short)'),
    git('worktree', 'list', '--porcelain'),
    git('stash', 'list', '--format=%gd %H %gs'),
    git('status', '--porcelain=v1', '--untracked-files=all'),
    runProbe('gh', ['pr', 'list', '--state', 'open', '--json', 'number,headRefName,headRefOid,title', '--limit', '100'], opts),
    git('ls-tree', '-r', '--name-only', mainRef),
  ].map((p) => p.then(record)));

  // ── ref inventory ──────────────────────────────────────────────────────────
  const parseRefs = (res) => lines(res.stdout).map((l) => {
    const [name, sha] = l.split('\t');
    return { name: (name ?? '').trim(), sha: (sha ?? '').trim() };
  }).filter((r) => r.name);
  const localRefs = localRes.ok ? parseRefs(localRes) : null;
  const remoteRefs = remoteRes.ok ? parseRefs(remoteRes).filter((r) => !/\/HEAD$/.test(r.name)) : null;
  const mergedLocal = localMergedRes.ok ? new Set(lines(localMergedRes.stdout).map((l) => l.replace(/^\*?\s*/, '').trim())) : null;
  const mergedRemote = remoteMergedRes.ok ? new Set(lines(remoteMergedRes.stdout).map((l) => l.trim())) : null;

  // ── stranded-file measure, by CONTENT (§3b) ────────────────────────────────
  // main's own path set, once. If it could not be read there is no baseline to subtract from, and
  // that is stated rather than silently producing a count of "every file on the ref".
  const mainPaths = mainTreeRes.ok ? new Set(lines(mainTreeRes.stdout)) : null;
  const notContained = [];
  if (localRefs && mergedLocal) for (const r of localRefs) if (!mergedLocal.has(r.name)) notContained.push({ ...r, scope: 'local' });
  if (remoteRefs && mergedRemote) for (const r of remoteRefs) if (!mergedRemote.has(r.name)) notContained.push({ ...r, scope: 'remote' });

  const uniqueTips = [...new Set(notContained.map((r) => r.sha).filter(Boolean))];
  const probedTips = uniqueTips.slice(0, maxRefsProbed);
  const unprobedTips = uniqueTips.length - probedTips.length;
  /** sha → { files_absent_from_main } | { error } | { gone: true } */
  const strandedBySha = new Map();
  if (mainPaths) {
    // Deliberately NOT run through `record()`. These probes are classified individually below —
    // a vanished ref is a fact about a moving estate rather than a probe failure — and an earlier
    // draft that recorded them and then popped the failure back off was a real race: under
    // `Promise.all` the completions interleave, so the pop could remove a DIFFERENT probe's
    // failure and silently erase a genuine one from the report.
    const results = await Promise.all(probedTips.map(async (sha) => {
      probesRun += 1;
      return [sha, await git('ls-tree', '-r', '--name-only', sha)];
    }));
    for (const [sha, r] of results) {
      if (r.ok) {
        let absent = 0;
        for (const f of lines(r.stdout)) if (!mainPaths.has(f)) absent += 1;
        strandedBySha.set(sha, { count: absent });
      } else if (/not a (?:tree|valid) object|unknown revision|bad object|does not exist/i.test(r.stderr)) {
        // Property 5: Larry is converging concurrently. A tip that has gone is not an error and is
        // certainly not "clean" — it is a fact about a moving estate, recorded as one.
        strandedBySha.set(sha, { gone: true });
      } else {
        strandedBySha.set(sha, { error: String(r.stderr || 'unknown').trim().slice(0, 160) });
        failures.push(r);
      }
    }
  }
  const strandedNote = (sha) => {
    if (!mainPaths) return 'files_absent_from_main=UNMEASURED (main tree unreadable)';
    const s = strandedBySha.get(sha);
    if (!s) return 'files_absent_from_main=NOT PROBED (tip cap reached)';
    if (s.gone) return 'files_absent_from_main=UNMEASURABLE — ref disappeared during enumeration';
    if (s.error) return `files_absent_from_main=UNMEASURED — ${s.error}`;
    return `files_absent_from_main=${s.count}`;
  };

  // ── render ─────────────────────────────────────────────────────────────────
  const out = [];
  /** Render one numbered section. When its own enumeration probe failed, the section renders the
   *  failure and NOTHING ELSE — never an empty list, never a zero count. */
  const section = (title, res, body) => {
    out.push('', title);
    if (res && !res.ok) { out.push(`  ${failLine(res)}`); return; }
    for (const l of body()) out.push(`  ${l}`);
  };
  /** The two branch sections are identical in shape; only the scope differs. */
  const branchSection = (n, label, listRes, refs, mergedSet, mergedRes) => {
    const head = refs
      ? `[${n}] ${label} (${refs.length} total${mergedSet ? `, ${refs.filter((r) => !mergedSet.has(r.name)).length} NOT contained in ${mainRef}` : ''})`
      : `[${n}] ${label}`;
    section(head, listRes, () => {
      const body = [];
      if (!mergedSet) {
        body.push(failLine(mergedRes));
        body.push(`CONTAINMENT UNKNOWN for all ${refs.length} ${label.toLowerCase()} — they are NOT thereby accounted for. Every one below is listed as unassessed.`);
      } else {
        const contained = refs.filter((r) => mergedSet.has(r.name));
        body.push(`contained in ${mainRef} (${contained.length}): ${contained.map((r) => r.name).join(', ') || '(none)'}`);
      }
      body.push(mergedSet ? `NOT contained in ${mainRef}:` : `UNASSESSED (containment probe failed):`);
      const rest = mergedSet ? refs.filter((r) => !mergedSet.has(r.name)) : refs;
      if (!rest.length) body.push('  (none)');
      for (const r of rest) body.push(`  ${r.name}  ${r.sha.slice(0, 12)}  ${strandedNote(r.sha)}`);
      return body;
    });
  };

  out.push('ESTATE CONVERGENCE INVENTORY — gathered by execution at packet-build time.');
  out.push(`collected_at: ${new Date().toISOString()}`);
  out.push(`enumerated_from: ${cwd}`);
  out.push(`canonical_ref: ${mainRef}${mainRes.ok ? ` @ ${mainRes.stdout.trim()}` : ' (UNRESOLVED — see below)'}`);
  // The summary sits at the TOP so that if the byte cap ever bites, the reader still learns that
  // probes failed. A truncation that removes the failure report would be the worst possible cut.
  out.push(`probes: ${probesRun} run, ${failures.length} FAILED${failures.length ? ' — sections below name each one' : ''}`);
  out.push('method: containment via `git branch --merged`; stranded files via `git ls-tree -r --name-only <tip>` minus the same for the canonical ref. Ref NAMES are never used to classify.');
  out.push('This block states facts only. It contains no convergence verdict, score or boolean.');

  if (!mainRes.ok) out.push('', `[0] CANONICAL REF`, `  ${failLine(mainRes)}`);

  branchSection(1, 'LOCAL BRANCHES', localRes, localRefs, mergedLocal, localMergedRes);
  branchSection(2, 'REMOTE BRANCHES', remoteRes, remoteRefs, mergedRemote, remoteMergedRes);

  section('[3] REGISTERED WORKTREES', worktreeRes, () => {
    const trees = [];
    let cur = null;
    for (const l of lines(worktreeRes.stdout)) {
      if (l.startsWith('worktree ')) { cur = { path: l.slice(9) }; trees.push(cur); }
      else if (!cur) continue;
      else if (l.startsWith('HEAD ')) cur.head = l.slice(5);
      else if (l.startsWith('branch ')) cur.branch = l.slice(7);
      else if (l === 'detached') cur.branch = '(detached)';
    }
    return [`count: ${trees.length}`,
      ...trees.map((w) => `${w.path}  branch=${w.branch ?? '(unknown)'}  head=${String(w.head ?? '').slice(0, 12)}`)];
  });

  section('[4] STASHES', stashRes, () => {
    const l = lines(stashRes.stdout);
    return [`count: ${l.length}`, ...l];
  });

  section('[5] DIRTY AND UNTRACKED PATHS IN THIS CHECKOUT', statusRes, () => {
    const l = lines(statusRes.stdout);
    return [`count: ${l.length}`, ...l];
  });

  section('[6] OPEN PULL REQUESTS', prRes, () => {
    let parsed;
    try { parsed = JSON.parse(prRes.stdout || '[]'); } catch (e) { return [`PROBE FAILED: ${prRes.cmd} — non-JSON response: ${String(e?.message ?? e).slice(0, 160)}`]; }
    if (!Array.isArray(parsed)) return [`PROBE FAILED: ${prRes.cmd} — response was not an array`];
    return [`count: ${parsed.length}`, ...parsed.map((pr) => `#${pr.number}  ${pr.headRefName}  ${String(pr.headRefOid ?? '').slice(0, 12)}  ${String(pr.title ?? '').slice(0, 100)}`)];
  });

  out.push('', '[7] STRANDED-STATE MEASUREMENT COVERAGE');
  if (!mainPaths) {
    out.push(`  ${failLine(mainTreeRes)}`);
    out.push(`  NO stranded-file counts could be computed — there is no baseline to subtract from. The absence of counts above is a GAP IN THE EVIDENCE, not an absence of stranded work.`);
  } else {
    out.push(`  canonical ref path count: ${mainPaths.size}`);
    out.push(`  distinct non-contained tips: ${uniqueTips.length}; probed: ${probedTips.length} (cap ${maxRefsProbed})`);
    if (unprobedTips > 0) out.push(`  ${unprobedTips} tip(s) were NOT probed because the cap was reached — those refs carry NO stranded-file count and are UNASSESSED, not clean.`);
    const gone = [...strandedBySha.values()].filter((s) => s.gone).length;
    const errored = [...strandedBySha.values()].filter((s) => s.error).length;
    if (gone) out.push(`  ${gone} tip(s) disappeared during enumeration (concurrent convergence) — recorded as unmeasurable, not as zero.`);
    if (errored) out.push(`  ${errored} tip(s) could not be read — see the UNMEASURED notes above.`);
  }

  if (failures.length) {
    out.push('', '[8] FAILED PROBES — CONSOLIDATED');
    out.push(`  ${failures.length} probe(s) did not run to completion. Every fact they would have established is MISSING from this inventory.`);
    for (const f of failures) out.push(`  ${failLine(f)}`);
  }

  let text = out.join('\n');
  let truncated = false;
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    truncated = true;
    const buf = Buffer.from(text, 'utf8');
    let cut = maxBytes;
    while (cut > 0 && (buf[cut] & 0xC0) === 0x80) cut -= 1;   // never split a UTF-8 sequence
    text = `${buf.subarray(0, cut).toString('utf8')}\n`
      + `… [ESTATE CONVERGENCE INVENTORY TRUNCATED at ${cut} bytes of ${buf.length} (cap ${maxBytes}). `
      + `The remainder was NOT delivered — everything past this point is UNSEEN EVIDENCE, not an empty estate.] …`;
  }
  return { text, probes_run: probesRun, probes_failed: failures.length, truncated };
}

/**
 * Never let inventory-gathering take a review down, and never let it go quiet either. A thrown
 * error here becomes a staged block that says so — the packet must always carry either the
 * evidence or the explicit reason it is missing.
 */
export async function safeGatherConvergenceEvidence(args = {}) {
  try {
    return await gatherConvergenceEvidence(args);
  } catch (e) {
    return {
      text: 'ESTATE CONVERGENCE INVENTORY — NOT GATHERED.\n'
        + `PROBE FAILED: gatherConvergenceEvidence — ${String(e?.stack ?? e?.message ?? e).slice(0, 400)}\n`
        + 'No convergence fact was established. Treat every §3b property as unevidenced.',
      probes_run: 0, probes_failed: 1, truncated: false,
    };
  }
}

/** Send one TowerBot (Telegram) message. Never throws; never echoes the token. */
async function sendTowerBot(token, chat, text) {
  if (!token || !chat) return { ok: false, id: null, detail: 'missing TowerBot token/chat' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
    const b = await r.json();
    return { ok: r.ok && b.ok, id: b.result?.message_id ?? null, detail: b.description ?? '' };
  } catch (e) { return { ok: false, id: null, detail: String(e?.message ?? e) }; }
}

/**
 * Run ONE bounded merge-check. Returns { runId, status, verdict, rounds, blocked }.
 * classifyMergeRun is enforced first (fail-closed) — this is FIX F1's wiring point.
 */
export async function runMergeCheck({
  pool, repo, prNumber, headSha, baseSha = null, buildRef, wpRef = null,
  larryClaim, cwd = DEFAULT_REPO_ROOT, qaSkillPath = DEFAULT_QA_SKILL,
  telegramToken = process.env.TELEGRAM_BOT_TOKEN, telegramChat = process.env.AUTHORISED_TELEGRAM_USER_ID,
  maxRounds = 3,
  // WO-2026-08-05-TW3 — the SAME injectable `spawn` gatherGitEvidence itself already accepts,
  // passed straight through. Narrow, symmetric plumbing: once Gap 2 made gatherGitEvidence
  // prefer `gh` whenever `prNumber`+`repo` are given (which every real call here supplies), a
  // test exercising the fail-closed evidence-unresolved branch needs a way to make that gh call
  // fail deterministically, with no network, rather than reaching the real `gh` binary. Defaults
  // to the real spawn exactly as before — production behaviour is unchanged.
  spawn = undefined,
  // WO-2026-08-07-4C-03 — the same narrow, symmetric test seam as `spawn` directly above, for the
  // same reason. The convergence inventory's acceptance property is that it REACHES the reviewer,
  // and the only statement of this function that carries it is the packet handed to
  // `runMergeReview`. Reaching that line requires resolved Git evidence, which the injected
  // `spawn` can supply — but the review call itself would then resolve the real Codex binary and
  // credential, so the packet could never be observed without spending a live review. Defaults to
  // the real import: production behaviour is unchanged.
  runMergeReview: doMergeReview = runMergeReview,
  gatherConvergence = safeGatherConvergenceEvidence,
} = {}) {
  // ── FIX F1 — ENFORCE explicit merge-run metadata at runtime (fail CLOSED). ──
  // classifyMergeRun throws unless build_ref + repo + PR + full head SHA are all present & valid.
  let classified;
  try {
    classified = classifyMergeRun({ buildRef, repo, prNumber, headSha });
  } catch (e) {
    // Record the rejection durably so the fail-closed decision is auditable; spend no Codex.
    const run = (await pool.query(
      `insert into tower.merge_check_run (pr_number, build_ref, wp_ref, head_sha, status, rounds)
       values (?,?,?,?,'blocked',0) returning id`,
      [prNumber ?? null, (buildRef ?? 'UNCLASSIFIED'), wpRef, (headSha ?? null)])).rows[0];
    await pool.query(
      `insert into tower.merge_check_message (run_id, seq, sender, round, status, text, head_sha)
       values (?,1,'gpt_codex',0,'blocked',?,?)`,
      [run.id, `merge-check REJECTED (fail-closed) — ${e.message}`, headSha ?? null]);
    const s = await sendTowerBot(telegramToken, telegramChat,
      `🗼 Merge-check REJECTED (fail-closed): ${e.message}`);
    return { runId: run.id, status: 'blocked', verdict: 'blocked', rounds: 0, blocked: true, reason: e.message, telegram: s };
  }

  // ── durable run at the exact head (RESUME an open run for this exact (pr, head), else create). ──
  const existing = (await pool.query(
    `select id from tower.merge_check_run where pr_number=? and head_sha=? and status='open' order by created_at limit 1`,
    [prNumber, headSha])).rows[0];
  let runId;
  if (existing) runId = existing.id;
  else runId = (await pool.query(
    `insert into tower.merge_check_run (pr_number, build_ref, wp_ref, head_sha, status, rounds)
     values (?,?,?,?,'open',0) returning id`,
    [prNumber, classified.build_ref, wpRef, headSha])).rows[0].id;

  const prior = (await pool.query(`select seq, sender from tower.merge_check_message where run_id=? order by seq`, [runId])).rows;
  let seq = prior.length ? Math.max(...prior.map((m) => m.seq)) : 0;
  const haveLarry = prior.some((m) => m.sender === 'larry');
  const addMsg = (sender, round, status, text) => pool.query(
    `insert into tower.merge_check_message (run_id, seq, sender, round, status, text, head_sha) values (?,?,?,?,?,?,?)`,
    [runId, ++seq, sender, round, status, text, headSha]);

  const round = 1; // bounded; a single genuine Larry→Codex exchange (<= maxRounds).
  if (round > maxRounds) throw new Error(`round ${round} exceeds maxRounds ${maxRounds}`);
  if (!haveLarry) await addMsg('larry', round, 'proposed', larryClaim);

  // ── REAL git evidence over base..head. ──
  // `spawn: undefined` here falls through to gatherGitEvidence's own default (the real
  // nodeSpawn) — passing it through unconditionally rather than only-when-set keeps this call
  // symmetric with every other gatherGitEvidence call site in this estate.
  const ev = await gatherGitEvidence({ cwd, repo, baseSha, headSha, prNumber, spawn });
  if (!ev.resolved) {
    await addMsg('gpt_codex', round, 'blocked', `git evidence unresolved — ${ev.blocker}`);
    // `?` is POSITIONAL — the Postgres original wrote `rounds=$2 ... where id=$1`, i.e. the
    // params were NOT in placeholder order. Both the SQL and the array are reordered together.
    await pool.query(`update tower.merge_check_run set status='blocked', rounds=?, updated_at=now() where id=?`, [round, runId]);
    const s = await sendTowerBot(telegramToken, telegramChat, `🗼 Merge-check PR #${prNumber} @ ${String(headSha).slice(0, 10)} — BLOCKED (evidence: ${ev.blocker})`);
    return { runId, status: 'blocked', verdict: 'blocked', rounds: round, blocked: true, telegram: s };
  }

  // ── REAL Codex merge review under the APPROVED Tower QA skill over the staged diff. ──
  // WP-2G: LOADED AND VALIDATED, not bare-read. Absent / empty / no frontmatter / missing sentinel
  // / NOT RATIFIED each fail closed HERE, before any Codex spend, and the rejection is recorded
  // durably for the same reason the evidence branch above records its own — a review that did not
  // happen must not look like one that never arrived.
  const contract = loadCodexContract({ contractPath: qaSkillPath });
  if (!contract.ok) {
    await addMsg('gpt_codex', round, 'blocked', `codex operating contract refused — ${contract.error}`);
    await pool.query(`update tower.merge_check_run set status='blocked', rounds=?, updated_at=now() where id=?`, [round, runId]);
    const s = await sendTowerBot(telegramToken, telegramChat, `🗼 Merge-check PR #${prNumber} @ ${String(headSha).slice(0, 10)} — BLOCKED (contract: ${contract.error})`);
    return { runId, status: 'blocked', verdict: 'blocked', rounds: round, blocked: true, telegram: s };
  }
  // O-7's runtime half — the fingerprint is computed over the bytes about to be delivered and
  // compared against the loaded+validated bytes. Mismatch is fail-closed, not a warning.
  const provenanceError = assertDeliveredContract(contract.text, contract);
  if (provenanceError) {
    await addMsg('gpt_codex', round, 'blocked', `codex operating contract provenance failed — ${provenanceError}`);
    await pool.query(`update tower.merge_check_run set status='blocked', rounds=?, updated_at=now() where id=?`, [round, runId]);
    const s = await sendTowerBot(telegramToken, telegramChat, `🗼 Merge-check PR #${prNumber} @ ${String(headSha).slice(0, 10)} — BLOCKED (contract provenance)`);
    return { runId, status: 'blocked', verdict: 'blocked', rounds: round, blocked: true, telegram: s };
  }
  const qaSkillText = contract.text;
  console.error(`[mergeCheck] contract: ${contract.provenance} sha256=${contract.fingerprint}`);
  // WO-2026-08-07-4C-03 — §3b responsibility B's evidence. Gathered here, at packet-build time,
  // against the checkout Tower is running in, so the inventory describes the estate as it is at
  // the moment of review rather than whenever someone last wrote a note about it. `spawn` is the
  // same seam gatherGitEvidence took above.
  const convergence = await gatherConvergence({ cwd, spawn });
  console.error(`[mergeCheck] convergence inventory: ${Buffer.byteLength(convergence.text, 'utf8')} bytes, `
    + `${convergence.probes_run} probes, ${convergence.probes_failed} failed, truncated=${convergence.truncated}`);
  const packet = {
    checkpoint_id: `pr${prNumber}-${String(headSha).slice(0, 10)}`, build_id: classified.build_ref,
    repo: ev.repo ?? repo, branch: null,
    head_sha: ev.head_sha, base_sha: ev.base_sha, diff_range: ev.diff_range,
    changed_files: ev.changed_files, diff_text: ev.diff_text, diff_truncated: ev.diff_truncated,
    // gatherGitEvidence has always collected the PR's CI conclusions and this packet has always
    // dropped them, while watcher.mjs's sibling packet staged them — so the same review carried
    // CI evidence on one route and not the other. buildCodexPrompt already renders the field.
    ci_checks: ev.ci_checks,
    summary: larryClaim, brief_ref: `PR#${prNumber}`,
    brief_excerpt: 'Acceptance: explicit repo/PR/head enforced; durable hold never claimed/reclaimed; classifier explicit>env>leading-tag>UNCLASSIFIED (never BUILD-014); DEV-only.',
    convergence: convergence.text,
  };
  const mr = await doMergeReview({ qaSkillText, packet, cwd });
  const r = mr.result || {};
  const verdict = r.verdict || (mr.blocked ? 'blocked' : 'unknown');
  const findings = Array.isArray(r.findings) ? r.findings : [];
  const codexText = `Codex verdict: ${verdict}. ${r.summary || r.blocker || ''}`.trim()
    + (findings.length ? `\nFindings (${findings.length}): ` + findings.map((f, i) => `(${i + 1}) [${f.technical_impact || f.severity || '?'}] ${f.id || f.title || f.summary || ''}`).join(' | ') : '\nFindings: none');
  await addMsg('gpt_codex', round, verdict, codexText);

  const status = mr.blocked ? 'blocked'
    : verdict === 'approve' ? 'ready'
    : verdict === 'request_changes' ? 'changes_requested'
    : verdict === 'comment' ? 'commented' : verdict;
  // Same positional reordering as the blocked branch above: `$1` was LAST in the SQL and FIRST
  // in the array.
  await pool.query(`update tower.merge_check_run set status=?, rounds=?, head_sha=?, updated_at=now() where id=?`, [status, round, headSha, runId]);

  // ── REAL TowerBot delivery (Larry's side, then Codex's verdict — ordered). ──
  const s1 = await sendTowerBot(telegramToken, telegramChat, `🗼 Merge-check PR #${prNumber} @ ${String(headSha).slice(0, 10)} (round ${round}/${maxRounds})\nLARRY: ${String(larryClaim).slice(0, 600)}`);
  const s2 = await sendTowerBot(telegramToken, telegramChat, `🗼 PR #${prNumber} @ ${String(headSha).slice(0, 10)} — CODEX ${String(verdict).toUpperCase()} (status=${status})\n${codexText.slice(0, 900)}`);
  return { runId, status, verdict, rounds: round, blocked: mr.blocked === true, model_id: mr.modelId ?? null, findings: findings.length, telegram: { larry: s1, codex: s2 } };
}

// ── CLI ──
function arg(name, def = undefined) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : def; }
function getEnvVal(file, key) { try { const l = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((x) => x.startsWith(key + '=')); return l ? l.slice(key.length + 1).trim() : null; } catch { return null; } }

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    // WP-2F — the store is the one canonical SQLite file. There is no connection string to
    // supply and no CONTROL_PLANE_DEV_DATABASE_URL to read: the Supabase `tower` schema is
    // read-only history from here on. The TowerBot credentials are still read at CLI runtime
    // (they are Telegram config, not a store), unchanged.
    const token = process.env.TELEGRAM_BOT_TOKEN || getEnvVal('C:/.fusion247/tower-baton.env', 'TELEGRAM_BOT_TOKEN');
    const chat = process.env.AUTHORISED_TELEGRAM_USER_ID || getEnvVal('C:/.fusion247/tower-baton.env', 'AUTHORISED_TELEGRAM_USER_ID');
    const pool = openDb();
    await applyMergeCheckSchema(pool);
    console.error(`[mergeCheck] store: ${pool.path}`);
    try {
      const out = await runMergeCheck({
        pool,
        repo: arg('repo'), prNumber: Number(arg('pr')), headSha: arg('head'), baseSha: arg('base', null),
        buildRef: arg('build'), wpRef: arg('wp', null),
        larryClaim: arg('claim', `PR #${arg('pr')} (${arg('wp', 'change')}) — merge-check requested against exact head ${arg('head')}. Review the real base..head diff for correctness and fitness-for-purpose.`),
        telegramToken: token, telegramChat: chat,
        maxRounds: Number(arg('max', 3)),
      });
      console.log(JSON.stringify(out, null, 1));
    } finally { await pool.end(); }
  })().then(() => process.exit(0)).catch((e) => { console.error(`[mergeCheck] FAILED: ${e.stack ?? e.message}`); process.exit(1); });
}
