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
import { createMilestoneNotifier, createTelegramClient } from '../src/telegramNotifier.js';
import { openState, acquireLock } from '../src/state.js';
import { createWatcher } from '../src/watcher.js';

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

  // 2. single-watcher lock.
  const lock = acquireLock({});
  if (!lock.acquired) { log(`[TOWER] not starting — ${lock.reason}`); process.exit(3); }
  const shutdown = () => { try { lock.release(); } catch { /* ignore */ } };
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
  const qaSkillPath = process.env.TOWER_QA_SKILL_PATH || DEFAULT_QA_SKILL;
  const pollMs = Number(process.env.TOWER_POLL_MS) > 0 ? Number(process.env.TOWER_POLL_MS) : 30_000;

  const clickup = createClickupClient({ config });
  const github = createGithubEvidence({ repoDir, repo: config.githubRepo });
  // NOTE: the Codex adapter is constructed WITHOUT any Telegram/ClickUp secret; its
  // child env is additionally sanitised (sanitizeCodexEnv) at spawn time.
  const codex = createCodexAdapter({ config, cwd: repoDir });
  const notifier = createMilestoneNotifier({ config, state });

  const watcher = createWatcher({ config, clickup, github, codex, notifier, state, taskId, qaSkillPath, fs, log });

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
