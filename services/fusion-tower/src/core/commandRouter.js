// Fusion Tower — governance command router (BUILD-010 WP1).
//
// The Tower-side half of the durable command seam described in
// Builds/CONVERGENCE-fusion-governance-interface.md. The BUILD-002 capture worker
// is the SOLE inbound Telegram poller; when it sees a governance command in the
// authorised private chat it writes ONE durable `ftw.run_event`
//   source='telegram', kind='command:<name>',
//   source_event_id='<telegram_update_id>' (PRIMARY dedup),
//   payload={ command, args, chat_id, sender_id, ts }   (pointers/ids only, NEVER a token)
// The Tower ingests that event (dedup + self-loop filter already enforced), and THIS
// module executes it against durable Tower state and REPLIES by ENQUEUEING a durable
// [TOWER] notification onto the outbox — it NEVER sends inline and NEVER polls.
//
// HARD BOUNDARIES (both restated + enforced here):
//   · OUTBOUND-ONLY — every reply is an outbox ENQUEUE (durable, deduped,
//     retry-safe). No inline send, no getUpdates, no second poller.
//   · DEFENCE-IN-DEPTH AUTH — even though WP2 pre-authenticates the sender, THIS
//     module re-checks sender_id against the allowlist. An unauthorised command is a
//     SILENT default-deny: zero reply, zero mutation. The durable run_event row is
//     the audit; nothing else is written.
//   · NO AUTONOMOUS MERGE — /approve resolves ONLY a specifically-pending bounded
//     decision (a run parked in awaiting_decision with decision_required=true). It
//     advances the gate (awaiting_decision -> active, decision_required=false) and
//     NEVER merges. There is NO merge/push code path in this module; merging stays
//     a human (Warwick) action outside the Tower.
//   · NO SECRET in any reply body (the outbox enqueue secret-scans + a DB CHECK is
//     the backstop). This module composes bodies from POINTERS/metadata only.
//   · IDEMPOTENT — the command event is deduped at intake on (source,
//     source_event_id); ADDITIONALLY every handler's mutation is safe to re-run and
//     every reply is deduped per (run + command + source_event_id + recipient), so a
//     redelivered command acts once and replies once.

import { RUN_STATUS, isTerminalRunStatus, WATCH_LEVEL } from './states.js';

// The seven governance commands this router executes (the run-start command is
// handled by the loop's run-start path, not here — see the convergence contract).
export const GOVERNANCE_COMMANDS = Object.freeze([
  'status', 'trace', 'watch', 'pause', 'resume', 'stop', 'approve',
]);

// Map the Telegram /watch grammar (on|milestones|off) onto the durable watch_level
// enum. `on` = every transition, `off` = terminal-only, `milestones` = the middle.
const WATCH_ARG_TO_LEVEL = Object.freeze({
  on: WATCH_LEVEL.ALL,
  all: WATCH_LEVEL.ALL,
  milestones: WATCH_LEVEL.MILESTONES,
  off: WATCH_LEVEL.TERMINAL,
  terminal: WATCH_LEVEL.TERMINAL,
});

// -------- small pure helpers -------------------------------------------------

// Normalise any timestamp shape (epoch ms number | Date | ISO string) to epoch ms
// so runs/events from either store sort identically.
function toTime(v) {
  if (v == null) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function isoOf(v) {
  if (v == null) return '—';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return new Date(v).toISOString();
  return String(v);
}

// A short, log-safe run handle (never the full id in prose lines that could look
// token-shaped — the full id is shown once on its own line).
function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
}

// Parse the durable command run_event into a normalised intent. Tolerant of the
// kind carrying the name (`command:status`) and/or payload.command carrying `/status`.
export function parseCommandEvent(event) {
  const kind = String(event?.kind ?? '');
  const fromKind = kind.startsWith('command:') ? kind.slice('command:'.length) : null;
  const payload = event?.payload ?? {};
  const rawCmd = payload.command ?? fromKind ?? '';
  const command = String(rawCmd).replace(/^\//, '').replace(/@.*$/, '').trim().toLowerCase();

  // args may arrive as an array (worker split) or a single string.
  let args = [];
  if (Array.isArray(payload.args)) args = payload.args.map((a) => String(a));
  else if (typeof payload.args === 'string' && payload.args.length > 0) args = payload.args.trim().split(/\s+/);

  return {
    command,
    args,
    argline: args.join(' '),
    chatId: payload.chat_id ?? null,
    senderId: payload.sender_id ?? null,
    ts: payload.ts ?? null,
    sourceEventId: event?.source_event_id ?? null,
    eventRunId: event?.run_id ?? null,
    known: GOVERNANCE_COMMANDS.includes(command),
  };
}

// Defence-in-depth allowlist check. Accepts an array | Set | single id. Empty /
// missing allowlist => deny all (fail-closed).
export function isAuthorisedSender(senderId, allowlist) {
  if (senderId === null || senderId === undefined || senderId === '') return false;
  let list;
  if (allowlist instanceof Set) list = [...allowlist];
  else if (Array.isArray(allowlist)) list = allowlist;
  else if (allowlist === null || allowlist === undefined || allowlist === '') list = [];
  else list = [allowlist];
  if (list.length === 0) return false;
  const want = String(senderId);
  return list.some((a) => String(a) === want);
}

// Resolve the ACTIVE run: an explicit run id in the command args wins; otherwise the
// most-recent NON-TERMINAL run. Returns the run row or null.
export async function resolveActiveRun(store, args = []) {
  const explicit = (args ?? []).find((a) => /^[0-9a-f-]{8,}$/i.test(String(a)));
  if (explicit) {
    const run = await store.getRun(explicit);
    return run ?? null;
  }
  const runs = await store.listRuns();
  const live = runs
    .filter((r) => !isTerminalRunStatus(r.status))
    .sort((a, b) => toTime(b.created_at) - toTime(a.created_at));
  return live[0] ?? null;
}

// -------- formatters (POINTERS / metadata only — never a secret) -------------

function githubLink(prRef) {
  if (!prRef) return null;
  const m = String(prRef).match(/^(\S+?\/\S+?)#(\d+)$/);
  if (m) return `https://github.com/${m[1]}/pull/${m[2]}`;
  return null;
}

function clickupLink(taskRef) {
  if (!taskRef) return null;
  const id = String(taskRef).replace(/^CU-/i, '');
  return `https://app.clickup.com/t/${id}`;
}

// current/next action + outstanding gate, derived honestly from durable state.
function deriveAction(status) {
  const run = status.run;
  const responder = status.current_turn?.expected_responder ?? null;
  if (isTerminalRunStatus(run.status)) {
    return {
      current: `terminal:${run.terminal_outcome ?? run.status}`,
      next: 'awaiting Warwick (review / merge / acknowledge)',
      gate: run.terminal_outcome === 'decision_required' ? 'human decision required' : `terminal (${run.status})`,
    };
  }
  if (run.stop_requested) {
    return { current: 'stop requested', next: 'halting safely at the next atomic boundary', gate: 'stop requested' };
  }
  if (run.paused) {
    return { current: 'paused', next: '/resume to continue', gate: 'paused (loop opens no new turn)' };
  }
  if (run.status === RUN_STATUS.AWAITING_DECISION && run.decision_required) {
    return { current: 'awaiting Warwick decision', next: '/approve to advance the gate', gate: 'human decision required' };
  }
  if (run.status === RUN_STATUS.AWAITING_RESPONDER) {
    return { current: `awaiting ${responder ?? 'responder'}`, next: `${responder ?? 'responder'} to return its turn`, gate: 'none' };
  }
  if (run.status === RUN_STATUS.ACTIVE) {
    return { current: 'active', next: 'dispatch the next turn', gate: 'none' };
  }
  if (run.status === RUN_STATUS.CREATED) {
    return { current: 'created', next: 'dispatch the first turn', gate: 'none' };
  }
  return { current: run.status, next: '—', gate: 'none' };
}

// The exact /status shape per the convergence contract §"Command grammar → /status".
export function formatStatus(status) {
  const run = status.run;
  const act = deriveAction(status);
  const gh = githubLink(status.evidence.pr_ref);
  const cu = clickupLink(status.evidence.task_ref);
  const responder = status.current_turn?.expected_responder ?? '—';
  const branch = run.scope_lock?.branch ?? run.scope_lock?.head_branch ?? '—';
  const headSha = status.evidence.commit_sha ? shortId(status.evidence.commit_sha) : '—';
  const lastEvent = status.last_event
    ? `${status.last_event.kind} @ ${isoOf(status.last_event.received_at)}`
    : '—';
  const lastNotif = status.last_notification
    ? `${status.last_notification.state}${status.last_notification.sent_at ? ` @ ${isoOf(status.last_notification.sent_at)}` : ''} (${status.last_notification.purpose})`
    : '—';
  const lines = [
    `run: ${run.run_id}`,
    `build/WP: ${run.title ?? '—'}`,
    `state: ${run.status}`,
    `expected responder: ${responder}`,
    `round: ${status.rounds.round_count}/${status.rounds.max_rounds}`,
    `branch: ${branch} · head: ${headSha}`,
    `last event: ${lastEvent}`,
    `current action: ${act.current}`,
    `next action: ${act.next}`,
    `outstanding: ${act.gate}`,
    `GitHub: ${gh ?? status.evidence.pr_ref ?? '—'}`,
    `ClickUp: ${cu ?? status.evidence.task_ref ?? '—'}`,
    `last notification: ${lastNotif}`,
  ];
  return `Status — run ${shortId(run.run_id)}\n${lines.join('\n')}`;
}

// Actor label for a /trace line — the bound responder if known, else the source.
function actorOf(event) {
  if (event.bound_responder) return event.bound_responder;
  switch (event.source) {
    case 'telegram': return 'warwick';
    case 'github': return 'github';
    case 'clickup': return 'clickup';
    case 'tower': return 'tower';
    default: return event.source ?? 'unknown';
  }
}

// Compact /trace: timestamp + actor + kind, newest first, capped. Detail lives in
// ClickUp — never dump a giant review into Telegram.
export function formatTrace(events, run) {
  const cu = clickupLink(run?.evidence_task_ref);
  if (!events || events.length === 0) {
    return `Trace — run ${shortId(run?.run_id)}\n(no durable events yet)`;
  }
  const lines = events.map((e) => `${isoOf(e.received_at)} · ${actorOf(e)} · ${e.kind}`);
  const footer = cu ? `\ndetail: ${cu}` : '';
  return `Trace — run ${shortId(run?.run_id)} (latest ${events.length})\n${lines.join('\n')}${footer}`;
}

function helpText() {
  return [
    'Fusion Tower — governance commands:',
    '/status — current run snapshot',
    '/trace — latest durable events',
    '/watch on|milestones|off — notification verbosity',
    '/pause — pause new agent turns   /resume — resume',
    '/stop — stop safely at the next atomic boundary',
    '/approve — resolve a pending decision gate (never a merge)',
  ].join('\n');
}

// -------- the reply seam (durable ENQUEUE — never an inline send) -------------

// Enqueue ONE durable [TOWER] reply. Purpose embeds the source_event_id so distinct
// commands produce distinct replies while a REDELIVERED command (same update id)
// collides on the dedup key and enqueues exactly once. Never throws.
async function enqueueReply(store, notifier, parsed, runId, body, now) {
  const purpose = `cmd_reply:${parsed.command || 'unknown'}:${parsed.sourceEventId ?? 'na'}`;
  if (!notifier || typeof notifier.enqueue !== 'function') {
    return { purpose, body, enqueued: false, dedupKey: null, skipped: 'no-notifier' };
  }
  try {
    const enq = await notifier.enqueue(
      store,
      { runId: runId ?? null, logicalSource: 'TOWER', purpose, body },
      { now },
    );
    return {
      purpose,
      body,
      enqueued: enq?.enqueued ?? false,
      dedupKey: enq?.dedupKey ?? null,
      skipped: enq?.skipped ?? null,
    };
  } catch (err) {
    // A secret-scan refusal or an outbox hiccup must never crash the loop; record it.
    return { purpose, body, enqueued: false, dedupKey: null, error: String(err?.message ?? err) };
  }
}

// -------- the entry point ----------------------------------------------------

/**
 * Execute one durable governance command event + enqueue its [TOWER] reply.
 * Pure of transport: it mutates ONLY via the passed store and replies ONLY via the
 * passed notifier's durable enqueue. NEVER throws out (a bad command can never crash
 * the loop). Returns an audit-shaped result object.
 *
 * @param {object} store       memoryStore | postgresStore
 * @param {object} notifier    durable outbox notifier — enqueue(store, {runId,logicalSource,purpose,body}, {now})
 * @param {object} event       the mapped ftw.run_event row (kind='command:<name>')
 * @param {object} deps
 * @param {number} [deps.now]        injectable clock (epoch ms)
 * @param {Array|Set|string} [deps.allowlist]  authorised sender id(s)
 */
export async function handleCommandEvent(store, notifier, event, { now, allowlist } = {}) {
  const result = {
    ok: false,
    command: null,
    runId: null,
    authorised: false,
    audited: false,
    mutation: null,
    merge: false, // INVARIANT: this router has no merge path — always false.
    reply: null,
    reason: null,
  };
  let parsed;
  try {
    parsed = parseCommandEvent(event);
    result.command = parsed.command || null;

    // DEFENCE-IN-DEPTH AUTH — silent default-deny. No reply, no mutation. The durable
    // run_event row IS the audit trail; we write nothing else.
    if (!isAuthorisedSender(parsed.senderId, allowlist)) {
      result.reason = 'unauthorised';
      result.audited = true;
      return result;
    }
    result.authorised = true;

    return await routeCommand(store, notifier, parsed, now, result);
  } catch (err) {
    // Never throw out of the intake loop. No mutation is reported (mutations happen
    // only inside a handler that completed).
    result.reason = `error:${String(err?.message ?? err)}`;
    return result;
  }
}

async function routeCommand(store, notifier, parsed, now, result) {
  switch (parsed.command) {
    case 'status': {
      const run = await resolveActiveRun(store, parsed.args);
      if (!run) {
        result.reply = await enqueueReply(store, notifier, parsed, null,
          'Status — no active run. Nothing in flight (start one with the run-start command).', now);
        result.ok = true;
        return result;
      }
      const status = await store.getRunStatus(run.run_id);
      result.runId = run.run_id;
      result.reply = await enqueueReply(store, notifier, parsed, run.run_id, formatStatus(status), now);
      result.ok = true;
      return result;
    }

    case 'trace': {
      const run = await resolveActiveRun(store, parsed.args);
      if (!run) {
        result.reply = await enqueueReply(store, notifier, parsed, null,
          'Trace — no active run.', now);
        result.ok = true;
        return result;
      }
      const events = await store.recentRunEvents(run.run_id, 10);
      result.runId = run.run_id;
      result.reply = await enqueueReply(store, notifier, parsed, run.run_id, formatTrace(events, run), now);
      result.ok = true;
      return result;
    }

    case 'watch': {
      const run = await resolveActiveRun(store, parsed.args);
      if (!run) {
        result.reply = await enqueueReply(store, notifier, parsed, null, 'Watch — no active run.', now);
        result.ok = true;
        return result;
      }
      const arg = String(parsed.args[0] ?? '').toLowerCase();
      const level = WATCH_ARG_TO_LEVEL[arg];
      if (!level) {
        result.reply = await enqueueReply(store, notifier, parsed, run.run_id,
          'Usage: /watch on|milestones|off  (on=every transition, milestones=default, off=terminal-only).', now);
        result.ok = false;
        result.reason = 'invalid-watch-arg';
        return result;
      }
      await store.setRunWatchLevel(run.run_id, level, { now }); // idempotent
      result.mutation = `setRunWatchLevel(${level})`;
      result.runId = run.run_id;
      result.reply = await enqueueReply(store, notifier, parsed, run.run_id,
        `Watch level set to ${level} (${arg}) for run ${shortId(run.run_id)}.`, now);
      result.ok = true;
      return result;
    }

    case 'pause': {
      const run = await resolveActiveRun(store, parsed.args);
      if (!run) {
        result.reply = await enqueueReply(store, notifier, parsed, null, 'Pause — no active run.', now);
        result.ok = true;
        return result;
      }
      await store.setRunPaused(run.run_id, true, { now }); // idempotent
      result.mutation = 'setRunPaused(true)';
      result.runId = run.run_id;
      result.reply = await enqueueReply(store, notifier, parsed, run.run_id,
        `Paused run ${shortId(run.run_id)}. The loop opens no new agent turn until /resume.`, now);
      result.ok = true;
      return result;
    }

    case 'resume': {
      const run = await resolveActiveRun(store, parsed.args);
      if (!run) {
        result.reply = await enqueueReply(store, notifier, parsed, null, 'Resume — no active run.', now);
        result.ok = true;
        return result;
      }
      await store.setRunPaused(run.run_id, false, { now }); // idempotent
      result.mutation = 'setRunPaused(false)';
      result.runId = run.run_id;
      result.reply = await enqueueReply(store, notifier, parsed, run.run_id,
        `Resumed run ${shortId(run.run_id)}. The loop may open new agent turns.`, now);
      result.ok = true;
      return result;
    }

    case 'stop': {
      const run = await resolveActiveRun(store, parsed.args);
      if (!run) {
        result.reply = await enqueueReply(store, notifier, parsed, null, 'Stop — no active run.', now);
        result.ok = true;
        return result;
      }
      await store.requestRunStop(run.run_id, { now }); // idempotent (timestamp stamped once)
      result.mutation = 'requestRunStop';
      result.runId = run.run_id;
      result.reply = await enqueueReply(store, notifier, parsed, run.run_id,
        `Stop requested for run ${shortId(run.run_id)}; the loop will halt safely at the next atomic boundary (never mid-write).`, now);
      result.ok = true;
      return result;
    }

    case 'approve': {
      const run = await resolveActiveRun(store, parsed.args);
      if (!run) {
        result.reply = await enqueueReply(store, notifier, parsed, null,
          'Approve — nothing pending to approve (no active run). No merge performed.', now);
        result.ok = true;
        return result;
      }
      result.runId = run.run_id;
      // ONLY a specifically-pending bounded decision qualifies.
      const pending = run.status === RUN_STATUS.AWAITING_DECISION && run.decision_required === true;
      if (!pending) {
        result.reply = await enqueueReply(store, notifier, parsed, run.run_id,
          `Nothing pending to approve on run ${shortId(run.run_id)} (state ${run.status}). No merge performed.`, now);
        result.ok = true;
        return result;
      }
      // Advance the gate: awaiting_decision -> active, clear decision_required.
      // This is NOT a merge — no merge/push action is ever emitted here; merging
      // stays a human action outside the Tower. Idempotent: a second /approve finds
      // the run already active (not pending) and replies "nothing pending".
      await store.setRunStatus(run.run_id, RUN_STATUS.ACTIVE, { now, decisionRequired: false });
      result.mutation = 'approve:advance_gate(awaiting_decision->active,decision_required=false)';
      result.reply = await enqueueReply(store, notifier, parsed, run.run_id,
        `Approved. Decision gate cleared on run ${shortId(run.run_id)}; the loop will resume. No merge performed — merging stays your call.`, now);
      result.ok = true;
      return result;
    }

    default: {
      // Unknown / malformed — a brief help reply. No mutation.
      result.reply = await enqueueReply(store, notifier, parsed, null, helpText(), now);
      result.ok = false;
      result.reason = 'unknown-command';
      return result;
    }
  }
}
