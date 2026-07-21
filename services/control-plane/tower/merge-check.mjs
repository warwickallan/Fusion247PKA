// BUILD-014 — Tower "Codex QA" merge gate (the ONE bounded tool).
//
// Larry runs this when he believes something is ready to merge. It assembles a bounded merge
// packet, has Codex (read-only) review it, records the Larry<->Codex exchange to Supabase in real
// time, mirrors both messages to TowerBot, and RETURNS Codex's natural-language reply as this
// command's stdout — so it lands in Larry's current Claude turn (a pull, not an injection).
//
//   node --env-file=C:/.fusion247/control-plane-dev.env --env-file=C:/.fusion247/tower-baton.env \
//        services/control-plane/tower/merge-check.mjs --pr <N> --claim "<Larry's completion claim>" \
//        [--build BUILD-014] [--wp WP-D] [--acceptance "<criteria or path>"]
//
// Rules: max 3 rounds per PR then escalate (NEEDS_WARWICK); Codex never merges (read-only sandbox);
// a non-READY status means DO NOT MERGE. Each message is its own Supabase row (own seq, shared run).
import { spawn as nodeSpawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { resolveCodexBin, sanitizeCodexEnv } from '../review/codexAdapter.mjs';

const REPO = 'C:/Fusion247PKA';
const MAX_ROUNDS = 3;
const STATUSES = ['READY_TO_MERGE', 'FIX_REQUIRED', 'NEEDS_WARWICK', 'BLOCKED'];

// ---------- args ----------
function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const PR = arg('pr');
const BUILD = arg('build', 'BUILD-014');
const WP = arg('wp', '');
const CLAIM = arg('claim', '');
let ACCEPTANCE = arg('acceptance', '');
if (ACCEPTANCE && fs.existsSync(ACCEPTANCE)) ACCEPTANCE = fs.readFileSync(ACCEPTANCE, 'utf8').slice(0, 6000);
// NB: the `--claim` requirement is enforced inside main() (not at import time) so importing this
// module for its pure exports (e.g. headGuard) is side-effect-free.

const sh = (cmd) => { try { return spawnSync('bash', ['-lc', cmd], { cwd: REPO, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).stdout?.trim() ?? ''; } catch { return ''; } };

// ---------- TowerBot mirror (independent of the watcher's TOWER_NOTIFY_TRANSPORT silence) ----------
async function mirror(sender, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.AUTHORISED_TELEGRAM_USER_ID;
  if (!token || !chat) return;
  const tag = sender === 'larry' ? '🗣 Larry → Codex QA' : '🤖 Codex QA → Larry';
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: `${tag}\n${text}`.slice(0, 3900), disable_web_page_preview: true }),
    });
  } catch { /* visibility only — never block the gate */ }
}

// ---------- Supabase (control-plane DEV) ----------
async function ensureSchema(c) {
  await c.query(`create schema if not exists tower`);
  await c.query(`create table if not exists tower.merge_check_run (
    id uuid primary key default gen_random_uuid(),
    pr_number int, build_ref text, wp_ref text, head_sha text,
    status text not null default 'open',
    rounds int not null default 0,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await c.query(`create table if not exists tower.merge_check_message (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references tower.merge_check_run(id) on delete cascade,
    seq int not null, sender text not null check (sender in ('larry','gpt_codex')),
    round int not null, status text, text text not null, head_sha text,
    created_at timestamptz not null default now(), unique (run_id, seq))`);
}
async function nextSeq(c, runId) {
  const r = await c.query(`select coalesce(max(seq),0)+1 as n from tower.merge_check_message where run_id=$1`, [runId]);
  return r.rows[0].n;
}
async function record(c, runId, sender, round, status, text, head) {
  const seq = await nextSeq(c, runId);
  await c.query(`insert into tower.merge_check_message (run_id, seq, sender, round, status, text, head_sha) values ($1,$2,$3,$4,$5,$6,$7)`,
    [runId, seq, sender, round, status, text, head]);
  return seq;
}

// ---------- Codex QA (read-only) ----------
function runCodex(packet) {
  const bin = resolveCodexBin({}).path;
  if (!bin) return Promise.resolve({ status: 'BLOCKED', message: 'Codex binary not found on this host — cannot run the merge gate (fail-closed).' });
  const prompt = `You are Codex QA — an INDEPENDENT read-only merge-readiness reviewer for a FIRST-PARTY personal hobby-brain (single user: Warwick), NOT a commercial/adversarial product. Judge FITNESS-FOR-PURPOSE and genuine merge-blocking defects (correctness, accidental data loss/leak, availability, missing acceptance evidence). Down-rank hypothetical/adversarial-only crevices.

You are talking directly to Larry (the builder). Reply in natural language addressed to Larry, then give a status.

MERGE PACKET:
build: ${packet.build}   wp: ${packet.wp || '(n/a)'}   pr: ${packet.pr || '(local)'}   head: ${packet.head}
pr_state: ${packet.prState}
ci_checks: ${packet.ci || '(none reported)'}

ACCEPTANCE CRITERIA (what "done" means):
${packet.acceptance || '(none supplied — say so and treat unstated acceptance as a gap unless the diff self-evidently meets a clear goal)'}

LARRY'S COMPLETION CLAIM:
${packet.claim}

RECENT AUDIT CONTEXT (what led here, newest first):
${packet.audit || '(none)'}

── STAGED DIFF (authoritative — the actual change at this head) ──
${packet.diff || '(no diff captured)'}

CLOSURE-EVIDENCE GATE (MANDATORY — a lesson learned 2026-07-21): merge-readiness is NOT code quality alone. Before you may return READY_TO_MERGE you MUST verify the deliverable is visible and mergeable:
  - it is a DEDICATED GitHub PR (pr_state above must be a real PR, NOT "(local branch)");
  - CI/tests results are present AND passing (ci_checks above);
  - required closure records exist (the GitHub PR, and where applicable a ClickUp task + a session record).
If there is NO PR, or CI is absent/failing/pending, or closure evidence is missing, that is NOT ready — return FIX_REQUIRED ("open the PR / get CI green / attach the closure evidence") or NEEDS_WARWICK. Never wave a change through on the strength of the diff alone when its merge-visibility/closure evidence is absent. (GPT had to catch exactly this once; you catch it now.)

EVIDENCE-INTEGRITY / PROVENANCE GATE (MANDATORY — lesson 2026-07-21): scrutinise that the review is bound to the AUTHORITATIVE head and that the code under review does the same. In PR mode the authoritative head is the PR headRefOid (from "gh pr view"), NOT a local "git rev-parse HEAD". Treat as MERGE-BLOCKING: any code path that binds a review/record/verdict to a non-authoritative or mismatchable identifier (e.g. local HEAD instead of the PR head), or that could record a review of one PR against unrelated local/branch state; and any inconsistency where the packet head, diff and CI are not all for the SAME exact head. When you review code that itself collects evidence or writes records, verify it uses the authoritative head and fails closed on a local/PR-head mismatch. If provenance is inconsistent or unverifiable, return BLOCKED. Do not pass admin/provenance soundness on functional behaviour alone. (GPT had to catch a local-vs-PR head-provenance bug once; you catch this class now.)

Decide ONE status:
- READY_TO_MERGE — acceptance met, closure + provenance gates satisfied, no merge-blocking defect.
- FIX_REQUIRED — specific, named things Larry must change before merge.
- NEEDS_WARWICK — a genuine decision/authority call only Warwick can make.
- BLOCKED — cannot assess (missing evidence/diff) or a hard blocker.
Return ONLY compact JSON: {"status":"READY_TO_MERGE|FIX_REQUIRED|NEEDS_WARWICK|BLOCKED","message":"<your natural-language reply to Larry: what you checked, verdict, and exact next steps if any>"}`;

  const argv = ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ignore-user-config', '--json', '-C', REPO, '-'];
  return new Promise((resolve) => {
    let out = ''; let done = false;
    const child = nodeSpawn(bin, argv, { cwd: REPO, shell: false, env: sanitizeCodexEnv(process.env, null) });
    const timer = setTimeout(() => { try { spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']); } catch {}; if (!done) { done = true; resolve({ status: 'BLOCKED', message: 'Codex QA timed out after 8 minutes (fail-closed).' }); } }, 8 * 60 * 1000);
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', () => {
      clearTimeout(timer); if (done) return; done = true;
      let final = null;
      for (const line of out.split(/\r?\n/).filter(Boolean)) { try { const o = JSON.parse(line); final = o.item?.text ?? o.text ?? final; } catch {} }
      if (final) { const s = final.indexOf('{'), e = final.lastIndexOf('}'); if (s >= 0 && e > s) { try { const r = JSON.parse(final.slice(s, e + 1)); if (STATUSES.includes(r.status) && r.message) return resolve(r); } catch {} } }
      resolve({ status: 'BLOCKED', message: 'Codex QA returned no parseable verdict (fail-closed). Raw tail: ' + out.slice(-300) });
    });
    child.stdin.write(prompt); child.stdin.end();
  });
}

// ---------- head-provenance guard (pure + testable) ----------
// In PR mode the AUTHORITATIVE head is the PR's headRefOid (from `gh pr view`), NEVER a local
// `git rev-parse HEAD` — otherwise a review of PR X could be recorded against whatever unrelated
// local branch happens to be checked out. And because Codex inspects the LOCAL repo read-only during
// its run, the local checkout MUST equal the PR head or Codex would review the wrong tree. So: use
// the PR head for the packet/records, and FAIL CLOSED when localHead != prHead (or prHead is missing).
export function headGuard({ pr, localHead, prHead }) {
  if (!pr) return { ok: true, head: localHead };
  if (!prHead) return { ok: false, reason: 'no_pr_head', message: `could not resolve PR #${pr} head via gh pr view (fail-closed)` };
  if (localHead !== prHead) {
    return { ok: false, reason: 'head_mismatch', prHead, localHead,
      message: `local HEAD ${String(localHead).slice(0, 12)} != PR #${pr} head ${String(prHead).slice(0, 12)} — check out the PR head before running the gate (Codex inspects the local repo read-only, so a mismatch would review the wrong tree).` };
  }
  return { ok: true, head: prHead };
}

// ---------- evidence ----------
function collectEvidence() {
  const localHead = sh('git rev-parse HEAD');
  let diff = '', prState = '(local branch)', ci = '', prHead = null;
  if (PR) {
    prHead = (sh(`gh pr view ${PR} --json headRefOid -q .headRefOid 2>/dev/null`) || '').trim() || null;
    diff = sh(`gh pr diff ${PR} 2>/dev/null`);
    prState = sh(`gh pr view ${PR} --json state,title,mergeable,url -q '"\\(.state) | \\(.title) | mergeable=\\(.mergeable) | \\(.url)"' 2>/dev/null`) || '(pr not found)';
    ci = sh(`gh pr checks ${PR} 2>/dev/null | head -20`);
  }
  const guard = headGuard({ pr: PR, localHead, prHead });
  if (!diff && !PR) diff = sh('git diff origin/main...HEAD 2>/dev/null');
  if (diff.length > 60000) diff = diff.slice(0, 60000) + '\n... [diff truncated at 60k]';
  // head is the AUTHORITATIVE PR head in PR mode (guard.head); local head otherwise.
  return { head: guard.head ?? localHead, diff, prState, ci, guard };
}
async function auditContext(c) {
  try {
    const r = await c.query(`select seq, left(instruction,140) instr, left(larry_response,180) resp from tower.turn order by seq desc limit 5`);
    return r.rows.map((x) => `#${x.seq}: ${x.instr} -> ${x.resp}`).join('\n');
  } catch { return ''; }
}

// ---------- main ----------
async function main() {
  if (!CLAIM) { console.error('merge-check: --claim "<your completion claim>" is required'); process.exit(2); }
  const url = process.env.CONTROL_PLANE_DEV_DATABASE_URL;
  if (!url) { console.error('merge-check: CONTROL_PLANE_DEV_DATABASE_URL not set (run with --env-file=control-plane-dev.env)'); process.exit(2); }
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await ensureSchema(c);

  const ev = collectEvidence();
  // FAIL CLOSED on a head-provenance failure — do NOT run Codex or record a review bound to the
  // wrong head. No Codex spend, no misleading audit row; the operator fixes the checkout and re-runs.
  if (!ev.guard.ok) {
    console.error(`\n=== Codex QA — BLOCKED (head provenance) ===\n${ev.guard.message}\n`);
    await c.end();
    process.exit(3);
  }
  const audit = await auditContext(c);

  // Find or open the run using a STABLE key so a corrective commit (new HEAD) stays in the SAME
  // run and the 3-round limit holds (Codex QA round-1 finding): PR mode keys on pr_number; local
  // mode keys on --wp (required), NEVER on head_sha (which changes every fix and would reset rounds).
  let key;
  if (PR) key = { col: 'pr_number', val: Number(PR) };
  else if (WP) key = { col: 'wp_ref', val: WP };
  else { console.error('merge-check: local mode needs a stable --wp (or use --pr) so the round count survives corrective commits'); process.exit(2); }
  let run = (await c.query(`select * from tower.merge_check_run where ${key.col}=$1 and status='open' order by created_at desc limit 1`, [key.val])).rows[0];
  if (!run) run = (await c.query(`insert into tower.merge_check_run (pr_number, build_ref, wp_ref, head_sha, status) values ($1,$2,$3,$4,'open') returning *`, [PR ? Number(PR) : null, BUILD, WP, ev.head])).rows[0];
  const round = run.rounds + 1;

  // round limit -> escalate to Warwick
  if (round > MAX_ROUNDS) {
    const msg = `Round limit reached (${MAX_ROUNDS} rounds) without READY_TO_MERGE. Escalating to Warwick — he decides how to proceed.`;
    await record(c, run.id, 'gpt_codex', round, 'NEEDS_WARWICK', msg, ev.head);
    await c.query(`update tower.merge_check_run set status='needs_warwick', rounds=$2, updated_at=now() where id=$1`, [run.id, round - 1]);
    await mirror('gpt_codex', msg);
    console.log(`\n=== Codex QA — round ${round} — NEEDS_WARWICK ===\n${msg}\n`);
    await c.end(); process.exit(0);
  }

  // 1) record + mirror Larry's submission
  const larryText = `[round ${round}] Ready-to-merge claim for ${BUILD}${WP ? ' ' + WP : ''}${PR ? ' PR #' + PR : ''} @ ${ev.head.slice(0, 12)}:\n${CLAIM}`;
  await record(c, run.id, 'larry', round, null, larryText, ev.head);
  await mirror('larry', larryText);

  // 2) Codex QA reviews
  const verdict = await runCodex({ build: BUILD, wp: WP, pr: PR, head: ev.head, prState: ev.prState, ci: ev.ci, acceptance: ACCEPTANCE, claim: CLAIM, audit, diff: ev.diff });

  // 3) record + mirror Codex's response, update run status
  await record(c, run.id, 'gpt_codex', round, verdict.status, verdict.message, ev.head);
  await mirror('gpt_codex', `[${verdict.status}] ${verdict.message}`);
  const runStatus = verdict.status === 'READY_TO_MERGE' ? 'ready_to_merge'
    : verdict.status === 'FIX_REQUIRED' ? 'open'
    : verdict.status === 'NEEDS_WARWICK' ? 'needs_warwick' : 'blocked';
  await c.query(`update tower.merge_check_run set status=$2, rounds=$3, head_sha=$4, updated_at=now() where id=$1`, [run.id, runStatus, round, ev.head]);
  await c.end();

  // 4) return Codex's reply to Larry as this command's output
  console.log(`\n=== Codex QA — round ${round}/${MAX_ROUNDS} — ${verdict.status} ===\n${verdict.message}\n`);
  if (verdict.status === 'FIX_REQUIRED') console.log(`(Apply the fixes, then re-run tower merge-check to continue. ${MAX_ROUNDS - round} round(s) left.)`);
  if (verdict.status === 'READY_TO_MERGE') console.log('(Codex QA is satisfied. Merge remains Warwick\'s explicit yes.)');
  process.exit(0);
}
// Run only when invoked directly (so tests can import headGuard without executing the tool).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('merge-check error:', e.message); process.exit(1); });
}
