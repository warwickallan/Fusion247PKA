#!/usr/bin/env node
// Tower baton — the watcher runner. Session-independent: it loads secrets through
// the single runtimeConfig module (C:\.fusion247), never off the terminal session.
//
// Startup sequence:
//   1. load + validate runtime config (fail-closed, masked). Missing CLICKUP_TOKEN →
//      a CLEAR "CLICKUP_TOKEN missing" blocker + a Telegram blocker (if Telegram is
//      configured) + a clean exit(1) — NEVER a crash/stack trace.
//   2. acquire the single-watcher lock — a second instance is REFUSED (exit 3).
//   3. open durable state; choose the online vs recovered startup ding.
//   4. wire ClickUp + GitHub evidence + Codex + the milestone notifier.
//   5. emit the startup milestone VIA TOWER'S OWN NOTIFIER (real event):
//        fresh      → "[TOWER] ClickUp baton watcher online"
//        recovered  → "[TOWER] Watcher recovered and resumed from durable checkpoint state"
//   6. poll on an interval; each cycle runs the baton end to end. No autonomous merge.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { loadRuntimeConfig, REQUIRED_FOR_WATCHER } from '../src/runtimeConfig.js';
import { SECRET_HOME } from '../src/config.js';
import { createClickupClient } from '../src/clickupClient.js';
import { createGithubEvidence } from '../src/githubEvidence.js';
import { createCodexAdapter } from '../src/codexAdapter.js';
import { createFableAdapter, wireFable } from '../src/fableAdapter.js';
import { createMilestoneNotifier, createTelegramClient } from '../src/telegramNotifier.js';
import { openState, acquireLock, DEFAULT_LOCK_STALE_MS } from '../src/state.js';
import { createWatcher } from '../src/watcher.js';
import { loadQaSkill, assertStandingStartupAllowed } from '../src/qaSkill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SERVICE_DIR, '..', '..');
const DEFAULT_QA_SKILL = path.join(REPO_ROOT, 'Builds', 'BUILD-010-fusion-tower', 'baton-mvp', 'tower-qa-skill.md');
const LOG_DIR = path.join(SECRET_HOME, 'logs', 'tower-baton');
const LOG_MAX_BYTES = 2 * 1024 * 1024; // 2 MB, then rotate to .1

// ── bounded rotating logger (OUTSIDE the repo, masked by the caller) ────────────
function makeLogger(redact) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* best-effort */ }
  const logPath = path.join(LOG_DIR, 'tower-baton.log');
  return (msg) => {
    const line = `${new Date().toISOString()} ${redact ? redact(String(msg)) : String(msg)}\n`;
    try {
      try { const st = fs.statSync(logPath); if (st.size > LOG_MAX_BYTES) fs.renameSync(logPath, `${logPath}.1`); } catch { /* first write */ }
      fs.appendFileSync(logPath, line);
    } catch { /* logging must never crash the watcher */ }
    process.stdout.write(line);
  };
}

async function main() {
  // 1. config — fail-closed, masked.
  const loaded = loadRuntimeConfig({ required: REQUIRED_FOR_WATCHER });
  const config = loaded.config ?? { redact: (s) => String(s), telegramReady: false, clickupReady: false, describe: () => ({}) };
  const log = makeLogger(config.redact);

  if (!loaded.ok) {
    log(`[TOWER] startup fail-closed: ${loaded.error}`);
    // Best-effort Telegram blocker (if Telegram itself is configured).
    if (config.telegramReady) {
      try {
        const notifier = createMilestoneNotifier({ config, state: openStateSafe() });
        await notifier.notifyMilestone({ purpose: loaded.missing?.includes('CLICKUP_TOKEN') ? 'clickup_token_missing' : 'blocked', body: `Tower watcher cannot start: ${loaded.error}`, checkpointId: 'startup' });
      } catch { /* blocker send is best-effort */ }
    }
    process.exit(1);
  }

  // 1b. STANDING-STARTUP GATE — the standing daemon MUST refuse to come online unless the
  // QA governing prompt is ratified for standing use. A bounded proof run (TOWER_PROOF_RUN=1)
  // may start on proof_run_authorised. Checked BEFORE the lock/notifier so an unratified
  // governing prompt can never bring the watcher online. Fail-closed → clean exit(1).
  const qaSkillPath = process.env.TOWER_QA_SKILL_PATH || DEFAULT_QA_SKILL;
  const proofMode = process.env.TOWER_PROOF_RUN === '1';
  const gate = assertStandingStartupAllowed(loadQaSkill({ path: qaSkillPath }), { proofMode });
  if (!gate.ok) {
    log(`[TOWER] startup fail-closed: ${config.redact(gate.reason)}`);
    process.exit(1);
  }
  log(`[TOWER] standing-startup gate: ${proofMode ? 'bounded-proof' : 'standing'} mode — ${config.redact(gate.reason)}`);

  // 2. single-watcher lock.
  const lock = acquireLock({});
  if (!lock.acquired) { log(`[TOWER] not starting — ${lock.reason}`); process.exit(3); }
  if (lock.reclaimedStale) log(`[TOWER] ${lock.reason}`);

  // 2b. LOCK HEARTBEAT — a healthy watcher refreshes heartbeat_at forever, so it stays the
  // live owner regardless of how old acquired_at gets (this is what keeps a long-running
  // watcher from having its LIVE lock reclaimed by a second start). Interval well under the
  // stale window so a missed tick or two never trips the threshold.
  const heartbeatMs = Math.min(DEFAULT_LOCK_STALE_MS / 2, 60_000);
  const heartbeatTimer = setInterval(() => {
    try {
      if (!lock.heartbeat({ log })) log('[TOWER] lock heartbeat lost — another watcher may have reclaimed the lock');
    } catch (e) { log(`[TOWER] lock heartbeat error (continuing): ${config.redact(e?.message ?? String(e))}`); }
  }, heartbeatMs);
  heartbeatTimer.unref?.(); // the poll interval keeps the process alive; the heartbeat must not on its own

  const shutdown = () => {
    try { clearInterval(heartbeatTimer); } catch { /* ignore */ }
    try { lock.release(); } catch { /* ignore */ } // releases ONLY our own (nonce-owned) lock
  };
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
  process.on('exit', shutdown);

  // 3. durable state.
  const state = openState({});
  const recovered = state.existedAtOpen;

  // 4. wiring.
  const taskId = process.env.TOWER_CLICKUP_TASK_ID;
  if (!taskId) { log('[TOWER] fail-closed: TOWER_CLICKUP_TASK_ID is not set (which ClickUp control task to watch)'); shutdown(); process.exit(1); }
  const repoDir = process.env.TOWER_REPO_DIR || REPO_ROOT;
  // qaSkillPath was resolved + gated at the standing-startup gate above (step 1b).
  const pollMs = Number(process.env.TOWER_POLL_MS) > 0 ? Number(process.env.TOWER_POLL_MS) : 30_000;

  const clickup = createClickupClient({ config });
  const github = createGithubEvidence({ repoDir, repo: config.githubRepo });
  // NOTE: the Codex adapter is constructed WITHOUT any Telegram/ClickUp secret; its
  // child env is additionally sanitised (sanitizeCodexEnv) at spawn time.
  // WP1 reliability knobs (bounded, coordinated): the codex turn timeout must sit INSIDE
  // the per-cycle watchdog so codex reaps its OWN process tree first; the watchdog is the
  // outer safety net that guarantees the poll loop can never wedge silently.
  const codexTimeoutMs = Number(process.env.TOWER_CODEX_TIMEOUT_MS) > 0 ? Number(process.env.TOWER_CODEX_TIMEOUT_MS) : undefined;
  const cycleWatchdogMs = Number(process.env.TOWER_CYCLE_WATCHDOG_MS) > 0 ? Number(process.env.TOWER_CYCLE_WATCHDOG_MS) : undefined;
  const codex = createCodexAdapter({ config, cwd: repoDir, log, ...(codexTimeoutMs ? { timeoutMs: codexTimeoutMs } : {}) });
  // The SECOND, independent reviewer: Fable cold-final (claude-fable-5, headless). It is
  // OPTIONAL (MAJOR E): wire it ONLY when TOWER_FABLE_ENABLED=1 AND it is fully provisioned
  // (binary + auth). Otherwise pass NO fable adapter -> the byte-identical CODEX-ONLY path
  // (an install without Fable must NOT turn every codex APPROVE into a Fable-BLOCKED flow).
  // Enabled-but-unprovisioned fails LOUD at startup, never silently BLOCKs every checkpoint.
  const fableTimeoutMs = Number(process.env.TOWER_FABLE_TIMEOUT_MS) > 0 ? Number(process.env.TOWER_FABLE_TIMEOUT_MS) : undefined;
  const fableWiring = await wireFable({
    enabled: process.env.TOWER_FABLE_ENABLED === '1',
    buildAdapter: () => createFableAdapter({ config, log, ...(fableTimeoutMs ? { timeoutMs: fableTimeoutMs } : {}) }),
  });
  if (fableWiring.fatal) {
    log(`[TOWER] startup fail-closed: ${config.redact(fableWiring.reason)}`);
    shutdown(); process.exit(1);
  }
  const fable = fableWiring.fable; // null on the codex-only path
  log(`[TOWER] Fable cold-final reviewer: ${fable ? 'ENABLED + provisioned' : 'DISABLED (codex-only path)'} -- ${config.redact(fableWiring.reason)}`);
  const notifier = createMilestoneNotifier({ config, state });

  const watcher = createWatcher({ config, clickup, github, codex, fable, notifier, state, taskId, qaSkillPath, repoRoot: repoDir, fs, log, ...(cycleWatchdogMs ? { cycleWatchdogMs } : {}) });

  // 5. startup ding — via TOWER'S OWN NOTIFIER (real event).
  await notifier.notifyMilestone({
    purpose: recovered ? 'watcher_recovered' : 'watcher_online',
    body: recovered ? 'Watcher recovered and resumed from durable checkpoint state' : 'ClickUp baton watcher online',
    checkpointId: 'startup', extra: String(Date.now()), // startup dings are event-unique
  });
  log(`[TOWER] ${recovered ? 'recovered and resumed' : 'online'} — watching task ${taskId}, poll ${pollMs}ms, repo ${repoDir}`);
  log(`[TOWER] config: ${JSON.stringify(config.describe())}`);

  // 6. poll loop.
  const tick = async () => {
    try {
      const r = await watcher.pollOnce();
      if (r.processed.length) log(`[TOWER] cycle processed ${r.processed.length}: ${r.processed.map((p) => `${p.checkpointId}→${p.verdict}`).join(', ')}`);
    } catch (err) {
      log(`[TOWER] cycle error (continuing): ${config.redact(err?.message ?? String(err))}`);
    }
  };
  await tick();
  // The poll interval MUST keep the process alive — this is a standing daemon watcher
  // (scheduled-task / launcher). Do NOT unref: unref'ing let `node bin/tower-watch.js`
  // exit after the first tick, which broke session-independent standalone running.
  setInterval(tick, pollMs);
}

function openStateSafe() { try { return openState({}); } catch { return { isNotified: () => false, recordNotified: () => {} }; } }

main().catch((e) => { process.stderr.write(`[TOWER] fatal: ${String(e?.message ?? e)}\n`); process.exit(1); });
