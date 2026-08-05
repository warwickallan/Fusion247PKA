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
  const ev = await gatherGitEvidence({ cwd, repo, baseSha, headSha, prNumber });
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
  const packet = {
    checkpoint_id: `pr${prNumber}-${String(headSha).slice(0, 10)}`, build_id: classified.build_ref,
    repo: ev.repo ?? repo, branch: null,
    head_sha: ev.head_sha, base_sha: ev.base_sha, diff_range: ev.diff_range,
    changed_files: ev.changed_files, diff_text: ev.diff_text, diff_truncated: ev.diff_truncated,
    summary: larryClaim, brief_ref: `PR#${prNumber}`,
    brief_excerpt: 'Acceptance: explicit repo/PR/head enforced; durable hold never claimed/reclaimed; classifier explicit>env>leading-tag>UNCLASSIFIED (never BUILD-014); DEV-only.',
  };
  const mr = await runMergeReview({ qaSkillText, packet, cwd });
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
