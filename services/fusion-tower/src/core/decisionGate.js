// Fusion Tower — the HUMAN DECISION GATE (BUILD-010 WP1, OI §4a).
//
// APPROVED CONTRACT: Builds/BUILD-010-fusion-tower/Architecture/
//   fusion-tower-operating-instructions.md §4a (Warwick-approved 2026-07-17).
//
// After a Codex review turn returns, the Tower does NOT act on the review until
// Warwick taps a card on his private Telegram. This module is that gate:
//
//   postCodexReviewGate() — enqueue a concise [CODEX] summary WITH OPTION CARDS
//     (✅ Proceed / ⏸ Hold / 🛑 Stop) + a link to the full review, open a DURABLE
//     pending-decision gate for the CURRENT review head, park the run in
//     awaiting_decision, and HALT. Larry's correction turn is NOT dispatched.
//
//   handleDecisionEvent() — process Warwick's tap (routed in by WP2's single
//     capture-worker poller as a `command:decision` run_event; this module NEVER
//     polls). Authenticate the tapper, validate the decision is currently pending for
//     that gate + matches the review head (reject a stale/duplicate tap idempotently),
//     record it durably, apply exactly one effect (proceed→clear gate, hold→pause,
//     stop→stop-request), and enqueue a [TOWER] confirmation.
//
//   assertLarryDispatchAllowed() — the STRUCTURAL enforcement: a Codex review can
//     NEVER reach a Larry correction turn without a durably-recorded PROCEED decision
//     for the run's latest review gate. The dispatcher calls this before dispatching a
//     Larry turn.
//
// HARD BOUNDARIES (restated + enforced here):
//   · A CARD IS NEVER A MERGE. The decision vocabulary is proceed|hold|stop only
//     (states.js DECISION + the migration 0006 CHECK). There is NO merge/push/
//     external-write path anywhere in this module — merging stays a human action
//     OUTSIDE the Tower. Every result carries `merge:false` as an explicit invariant.
//   · OUTBOUND-ONLY — every message is an outbox ENQUEUE (durable, deduped). No inline
//     send, no getUpdates, no second poller. WP2 owns the sole inbound poll.
//   · DEFENCE-IN-DEPTH AUTH — even though WP2 pre-authenticates, the tapper_id is
//     re-checked against the allowlist here. An unauthorised tap is a SILENT
//     default-deny: zero reply, zero mutation, the run_event row is the audit.
//   · IDEMPOTENT — exactly one decision per gate (a single atomic pending→decided
//     store step). A stale tap (old/superseded head) or a duplicate tap affects
//     nothing and produces no second effect.

import crypto from 'node:crypto';
import { RUN_STATUS, DECISION, GATE_STATUS, GATE_DECISIONS, assertValidDecision } from './states.js';
import { isAuthorisedSender } from './commandRouter.js';

// The callback_data grammar carried by each button: `dec:<gate_token>:<decision>`.
// Telegram limits callback_data to 64 BYTES. Using a short gate_token (not the full
// UUID run id) keeps every card well under budget AND lets a tap map back to THIS
// specific gate (this run + this review head) — so a stale tap on an OLD review head
// resolves to a superseded/decided gate and is rejected.
export const CALLBACK_PREFIX = 'dec';
const CALLBACK_MAX_BYTES = 64;

// Human-facing card labels (the emoji set from OI §4a). NONE is a merge.
export const DECISION_LABELS = Object.freeze({
  [DECISION.PROCEED]: '✅ Proceed',
  [DECISION.HOLD]: '⏸ Hold',
  [DECISION.STOP]: '🛑 Stop',
});

/** A short, non-secret gate token (16 hex chars) for the button callback_data. */
export function generateGateToken() {
  return crypto.randomBytes(8).toString('hex'); // 16 chars — matches the 6..40 CHECK
}

/** Build one button's callback_data and assert it fits Telegram's 64-byte budget. */
export function decisionCallbackData(gateToken, decision) {
  assertValidDecision(decision);
  const data = `${CALLBACK_PREFIX}:${gateToken}:${decision}`;
  if (Buffer.byteLength(data, 'utf8') >= CALLBACK_MAX_BYTES) {
    throw new Error(`decisionCallbackData: callback_data "${data}" exceeds Telegram's 64-byte limit`);
  }
  return data;
}

/** Parse `dec:<gate_token>:<decision>` → { gateToken, decision } or null. */
export function parseDecisionCallback(callbackData) {
  if (typeof callbackData !== 'string') return null;
  const m = callbackData.match(/^dec:([A-Za-z0-9]{6,40}):(proceed|hold|stop)$/);
  if (!m) return null;
  return { gateToken: m[1], decision: m[2] };
}

/**
 * Build the Telegram inline_keyboard (option cards) for a gate. One button per allowed
 * decision, each carrying `dec:<gate_token>:<decision>`. Full-review is a LINK in the
 * message text, not a card (per OI §4a) — never a card unless trivial. NONE is a merge.
 */
export function buildDecisionCards({ gateToken, decisions = GATE_DECISIONS }) {
  if (!gateToken) throw new Error('buildDecisionCards: gateToken required');
  const row = decisions.map((decision) => ({
    text: DECISION_LABELS[decision] ?? decision,
    callback_data: decisionCallbackData(gateToken, decision),
  }));
  return { inline_keyboard: [row] };
}

/** Count findings by severity → a compact `critical:1 high:0 …` string. */
export function summariseFindingsBySeverity(findings = []) {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const counts = Object.fromEntries(order.map((s) => [s, 0]));
  for (const f of Array.isArray(findings) ? findings : []) {
    const sev = String(f?.severity ?? '').toLowerCase();
    if (sev in counts) counts[sev] += 1;
  }
  return { counts, line: order.map((s) => `${s}:${counts[s]}`).join(' ') };
}

// A short, log-safe head handle (never dump a whole review or a full corpus).
function shortSha(sha) {
  return sha ? String(sha).slice(0, 8) : '—';
}

/**
 * Compose the concise [CODEX] gate body: verdict · head SHA · findings-by-severity ·
 * one-line rationale + a link/ref to the full review. NEVER dumps the whole review
 * into Telegram (evidence-pointer doctrine) — the human reads detail via the link.
 */
export function composeGateBody({ runId, verdict, headSha, findings = [], summary = null, fullReviewRef = null }) {
  const sev = summariseFindingsBySeverity(findings);
  const rationale = summary ? String(summary).split('\n')[0].slice(0, 200) : '(no rationale returned)';
  const lines = [
    `Codex review — run ${shortSha(runId)}`,
    `verdict: ${verdict ?? '—'} · head: ${shortSha(headSha)}`,
    `findings: ${sev.line}`,
    `rationale: ${rationale}`,
    `full review: ${fullReviewRef ?? '(staged — see ClickUp control thread)'}`,
    'Decide below — a card is never a merge:',
  ];
  return lines.join('\n');
}

/**
 * THE GATE. After a Codex review turn returns, enqueue the [CODEX] summary + option
 * cards, open a durable pending-decision gate for the CURRENT review head, and park
 * the run in awaiting_decision. HALTS: does NOT dispatch a Larry correction turn.
 *
 * Idempotent: a redelivery for the same (run, head) reuses the existing pending gate
 * (its existing token / existing card) and re-enqueues nothing new (the notification
 * dedup key collides). Never throws out — a gate/enqueue hiccup must not crash the loop.
 *
 * @param {object} store     memoryStore | postgresStore
 * @param {object} notifier  durable outbox notifier — enqueue(store, {runId,logicalSource,purpose,body,replyMarkup},{now})
 * @param {object} args
 * @param {string} args.runId
 * @param {string} args.verdict        approve | request_changes | comment
 * @param {string} args.headSha        the exact head SHA the review was for (REQUIRED — stale-tap guard)
 * @param {Array}  [args.findings]     severity-classified findings (counted, never dumped)
 * @param {string} [args.summary]      the reviewer's one-line rationale
 * @param {string} [args.fullReviewRef] link/ref to the full review (ClickUp/staged)
 * @param {Array}  [args.allowedDecisions] the bounded card set (default proceed/hold/stop)
 * @param {object} [deps]  { now }
 * @returns {Promise<object>} audit-shaped result incl. { halted:true, dispatchedLarry:false, merge:false, gate, notification }
 */
export async function postCodexReviewGate(store, notifier, {
  runId, verdict, headSha, findings = [], summary = null, fullReviewRef = null,
  allowedDecisions = GATE_DECISIONS,
} = {}, { now } = {}) {
  const result = {
    ok: false,
    halted: true,          // INVARIANT: this always halts the loop at the gate.
    dispatchedLarry: false, // INVARIANT: a review NEVER dispatches Larry here.
    merge: false,          // INVARIANT: a card is never a merge — no merge path exists.
    runId: runId ?? null,
    gate: null,
    notification: null,
    reason: null,
  };
  if (!runId) throw new Error('postCodexReviewGate: runId required');
  if (!headSha) throw new Error('postCodexReviewGate: headSha required (stale-tap rejection depends on it)');

  // 1. Open (or reuse) the DURABLE gate for the current review head. The store owns
  //    idempotency + supersession of any prior pending gate on a newer head.
  const gateToken = generateGateToken();
  const opened = await store.openDecisionGate(
    { runId, reviewHeadSha: headSha, allowedDecisions, gateToken },
    { now },
  );
  const gate = opened.gate;
  result.gate = gate;

  // 2. Build the cards from the gate's ACTUAL token (existing token on a re-open).
  const replyMarkup = buildDecisionCards({ gateToken: gate.gate_token, decisions: gate.allowed_decisions });

  // 3. Enqueue the concise [CODEX] gate notification WITH the cards. Purpose embeds the
  //    head so a new review head is a distinct card; a redelivery of the same head
  //    collides on the dedup key and never double-posts.
  const body = composeGateBody({ runId, verdict, headSha, findings, summary, fullReviewRef });
  const purpose = `codex_review_gate:${shortSha(headSha)}`;
  if (notifier && typeof notifier.enqueue === 'function') {
    try {
      result.notification = await notifier.enqueue(
        store,
        { runId, logicalSource: 'CODEX', purpose, body, replyMarkup },
        { now },
      );
    } catch (err) {
      // A secret-scan refusal or outbox hiccup must never crash the loop; record it.
      result.notification = { enqueued: false, dedupKey: null, error: String(err?.message ?? err) };
    }
  } else {
    result.notification = { enqueued: false, dedupKey: null, skipped: 'no-notifier' };
  }

  // 4. HALT: park the run in awaiting_decision (decision_required=true). Legal from
  //    active or awaiting_responder (the state after a returned Codex turn). If the run
  //    is already awaiting_decision (idempotent re-post) leave it — it is already gated.
  const run = await store.getRun(runId);
  if (run && (run.status === RUN_STATUS.ACTIVE || run.status === RUN_STATUS.AWAITING_RESPONDER)) {
    await store.setRunStatus(runId, RUN_STATUS.AWAITING_DECISION, { now, decisionRequired: true });
  }

  result.ok = true;
  return result;
}

// Parse the durable `command:decision` run_event WP2 routes in. Prefer the button
// callback_data (`dec:<gate_token>:<decision>`) as the authoritative source of
// gate_token + decision; fall back to explicit payload fields. tapper_id may arrive as
// `tapper_id` or `sender_id`. head_sha is optional (belt for the stale-tap guard).
export function parseDecisionEvent(event) {
  const payload = event?.payload ?? {};
  const fromCb = parseDecisionCallback(payload.callback_data);
  const gateToken = fromCb?.gateToken ?? payload.gate_token ?? null;
  const decision = fromCb?.decision ?? (payload.decision ? String(payload.decision).toLowerCase() : null);
  return {
    runId: payload.run_id ?? event?.run_id ?? null,
    gateToken,
    decision,
    tapperId: payload.tapper_id ?? payload.sender_id ?? null,
    callbackData: payload.callback_data ?? null,
    messageId: payload.message_id ?? null,
    headSha: payload.head_sha ?? null,
    sourceEventId: event?.source_event_id ?? null,
  };
}

// Enqueue ONE durable [TOWER] confirmation of the recorded decision. Purpose embeds
// the gate token + source_event_id so a redelivered tap collides on the dedup key and
// confirms exactly once. Never throws.
async function enqueueDecisionConfirm(store, notifier, gate, parsed, now) {
  const purpose = `decision_ack:${gate.gate_token}:${parsed.sourceEventId ?? 'na'}`;
  const body = `Decision recorded: ${DECISION_LABELS[gate.decision] ?? gate.decision} `
    + `on run ${shortSha(gate.run_id)} (head ${shortSha(gate.review_head_sha)}). `
    + `${gate.decision === DECISION.PROCEED
      ? 'Larry’s correction turn is cleared to dispatch.'
      : gate.decision === DECISION.HOLD
        ? 'Run paused — /resume to continue.'
        : 'Safe stop requested.'} No merge performed — merging stays your call.`;
  if (!notifier || typeof notifier.enqueue !== 'function') {
    return { purpose, enqueued: false, dedupKey: null, skipped: 'no-notifier' };
  }
  try {
    const enq = await notifier.enqueue(
      store, { runId: gate.run_id, logicalSource: 'TOWER', purpose, body }, { now },
    );
    return { purpose, ...enq };
  } catch (err) {
    return { purpose, enqueued: false, dedupKey: null, error: String(err?.message ?? err) };
  }
}

/**
 * Process Warwick's card tap (a `command:decision` run_event from WP2). Authenticate,
 * validate + record the decision on its gate exactly once (rejecting a stale/duplicate
 * tap idempotently), apply the single effect, and enqueue a [TOWER] confirmation.
 * NEVER merges. NEVER throws out — a bad tap can never crash the loop.
 *
 * @returns {Promise<object>} audit-shaped result. Key fields:
 *   { ok, authorised, recorded, decision, effect, dispatchLarry, merge:false, reason }
 *   dispatchLarry is true ONLY on a recorded PROCEED (the loop then dispatches Larry).
 */
export async function handleDecisionEvent(store, notifier, event, { now, allowlist } = {}) {
  const result = {
    ok: false,
    kind: 'decision',
    runId: null,
    gateToken: null,
    decision: null,
    authorised: false,
    audited: false,
    recorded: false,
    effect: null,
    dispatchLarry: false,
    merge: false, // INVARIANT: this handler has no merge path — always false.
    reply: null,
    reason: null,
  };
  let parsed;
  try {
    parsed = parseDecisionEvent(event);
    result.runId = parsed.runId;
    result.gateToken = parsed.gateToken;
    result.decision = parsed.decision;

    // DEFENCE-IN-DEPTH AUTH — silent default-deny. No reply, no mutation. The durable
    // run_event row IS the audit; we write nothing else.
    if (!isAuthorisedSender(parsed.tapperId, allowlist)) {
      result.reason = 'unauthorised';
      result.audited = true;
      return result;
    }
    result.authorised = true;

    if (!parsed.gateToken || !parsed.decision) {
      result.reason = 'malformed-callback';
      return result;
    }

    // Validate + record atomically. A stale/superseded/already-decided/wrong-head/
    // not-allowed tap returns recorded:false and produces NO effect (one decision per
    // gate). This is the idempotent rejection.
    const rec = await store.recordDecisionGate(
      { gateToken: parsed.gateToken, decision: parsed.decision, decidedBy: parsed.tapperId, reviewHeadSha: parsed.headSha },
      { now },
    );
    if (!rec.recorded) {
      result.reason = rec.reason ?? 'rejected';
      result.gate = rec.gate ?? null;
      return result; // idempotent reject — ONE effect (none), no confirmation spam
    }
    result.recorded = true;
    const gate = rec.gate;
    result.gate = gate;
    result.runId = gate.run_id;

    // Apply EXACTLY ONE effect. The human has decided, so clear awaiting_decision to
    // active + decision_required=false in every case; then layer the outcome.
    const run = await store.getRun(gate.run_id);
    if (run && run.status === RUN_STATUS.AWAITING_DECISION) {
      await store.setRunStatus(gate.run_id, RUN_STATUS.ACTIVE, { now, decisionRequired: false });
    }
    if (parsed.decision === DECISION.PROCEED) {
      // Gate cleared. Signal the loop to dispatch Larry's correction turn — the
      // dispatch itself is the loop's job; here we only clear the gate + record proceed.
      result.effect = 'proceed:gate_cleared';
      result.dispatchLarry = true;
    } else if (parsed.decision === DECISION.HOLD) {
      await store.setRunPaused(gate.run_id, true, { now });
      result.effect = 'hold:setRunPaused(true)';
    } else if (parsed.decision === DECISION.STOP) {
      await store.requestRunStop(gate.run_id, { now });
      result.effect = 'stop:requestRunStop';
    }

    // Enqueue the [TOWER] confirmation (a fresh durable message; the card-edit ack is a
    // best-effort live capability, the durable confirm is the guaranteed record).
    result.reply = await enqueueDecisionConfirm(store, notifier, gate, parsed, now);
    result.ok = true;
    return result;
  } catch (err) {
    result.reason = `error:${String(err?.message ?? err)}`;
    return result;
  }
}

/**
 * STRUCTURAL ENFORCEMENT. Throws if a run's latest decision gate does not permit a
 * Larry correction turn — i.e. a Codex review CANNOT reach Larry without a durably
 * recorded PROCEED for that gate. Called by the dispatcher before a Larry dispatch.
 *
 *   no gate            → allowed (e.g. the first Larry turn, before any review)
 *   latest gate pending → BLOCKED (the loop is halted, awaiting the human tap)
 *   latest gate decided, decision != proceed (hold/stop) → BLOCKED
 *   latest gate decided proceed → allowed
 */
export async function assertLarryDispatchAllowed(store, runId) {
  if (typeof store.getLatestDecisionGate !== 'function') return true; // older store — no gates
  const gate = await store.getLatestDecisionGate(runId);
  if (!gate) return true;
  if (gate.status === GATE_STATUS.PENDING) {
    throw new Error(
      `decision gate OPEN on run ${shortSha(runId)} — awaiting Warwick's card tap; a Larry `
      + 'correction turn CANNOT be dispatched until a Proceed decision is recorded',
    );
  }
  if (gate.status === GATE_STATUS.DECIDED && gate.decision !== DECISION.PROCEED) {
    throw new Error(
      `decision gate on run ${shortSha(runId)} was decided '${gate.decision}' (not proceed) — `
      + 'a Larry correction turn is blocked',
    );
  }
  return true;
}
