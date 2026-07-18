#!/usr/bin/env node
// Tower baton — Larry's handoff command. Posts Larry's checkpoint to the ClickUp
// control task, polls the SAME thread for the matching [TOWER → LARRY] reply, and
// prints it as structured JSON for Larry's session. Loads secrets via the single
// runtimeConfig module (session-independent). Re-entrant; honest timeout → HALT.
//
// Usage:
//   node bin/handoff-to-tower.js --task <clickupTaskId> --checkpoint <path-to-json>
// The checkpoint JSON carries the [LARRY → TOWER] fields (checkpoint_id, build_id,
// wp_id, brief_ref, branch, head_sha, base_sha, summary, tests, evidence_refs[],
// questions_or_blockers[]). No secret is ever read from argv.

import fs from 'node:fs';

import { loadRuntimeConfig, REQUIRED_FOR_WATCHER } from '../src/runtimeConfig.js';
import { createClickupClient } from '../src/clickupClient.js';
import { createMilestoneNotifier } from '../src/telegramNotifier.js';
import { openState } from '../src/state.js';
import { runHandoff } from '../src/handoff.js';

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }

async function main() {
  const taskId = arg('--task') || process.env.TOWER_CLICKUP_TASK_ID;
  const cpPath = arg('--checkpoint');
  if (!taskId) { console.error('handoff: --task <clickupTaskId> (or TOWER_CLICKUP_TASK_ID) is required'); process.exit(2); }
  if (!cpPath || !fs.existsSync(cpPath)) { console.error('handoff: --checkpoint <path-to-json> is required and must exist'); process.exit(2); }

  const checkpoint = JSON.parse(fs.readFileSync(cpPath, 'utf8'));
  if (!checkpoint.checkpoint_id || !checkpoint.head_sha) { console.error('handoff: checkpoint JSON must include checkpoint_id + head_sha'); process.exit(2); }

  const loaded = loadRuntimeConfig({ required: ['CLICKUP_TOKEN'] }); // Telegram optional for a handoff
  if (!loaded.ok) { console.error(`handoff: ${loaded.error}`); process.exit(1); }
  const config = loaded.config;

  const clickup = createClickupClient({ config });
  const notifier = createMilestoneNotifier({ config, state: openState({}) });
  const timeoutMs = Number(process.env.TOWER_HANDOFF_TIMEOUT_MS) > 0 ? Number(process.env.TOWER_HANDOFF_TIMEOUT_MS) : 15 * 60 * 1000;
  const pollMs = Number(process.env.TOWER_HANDOFF_POLL_MS) > 0 ? Number(process.env.TOWER_HANDOFF_POLL_MS) : 15_000;

  const result = await runHandoff({ clickup, notifier, taskId, checkpoint, timeoutMs, pollMs });

  // Structured output for Larry's session (no secret). HALT is explicit.
  console.log(JSON.stringify({ status: result.status, halt: Boolean(result.halt), reason: result.reason, response: result.response ?? null, commentId: result.commentId ?? null }, null, 2));
  process.exit(result.halt ? 4 : 0); // exit 4 = HALT (Larry stops QA-dependent work)
}

main().catch((e) => { console.error(`handoff: fatal: ${String(e?.message ?? e)}`); process.exit(1); });
