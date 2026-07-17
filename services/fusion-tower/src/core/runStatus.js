// Fusion Tower — the composed /status read shape (BUILD-010 WP1).
//
// getRunStatus() on BOTH stores (postgresStore.js + memoryStore.js) returns this
// EXACT shape, so the /status command handler sees one contract regardless of
// backend. It is a pure, read-only projection: given the already-mapped run row,
// its current turn, the latest run_event, and the latest run-scoped
// notification_outbox row, it composes the rich object the convergence contract
// §"Command grammar → /status" describes (Builds/CONVERGENCE-fusion-governance-
// interface.md). Composing it HERE (not inline in each store) is what guarantees
// the two stores can never drift apart.
//
// Every field is a POINTER / metadata — an id, a state label, a timestamp, an
// evidence pointer. NEVER a secret, NEVER governed content.

/**
 * @param {object} args
 * @param {object|undefined} args.run             mapped ftw.governance_run row
 * @param {object|null} [args.currentTurn]        mapped ftw.run_turn row (current)
 * @param {object|null} [args.lastEvent]          mapped ftw.run_event row (latest)
 * @param {object|null} [args.lastNotification]   mapped ftw.notification_outbox row (latest, run-scoped)
 * @returns {object|null}  the composed /status shape, or null when the run is unknown
 */
export function composeRunStatus({
  run,
  currentTurn = null,
  lastEvent = null,
  lastNotification = null,
} = {}) {
  if (!run) return null;
  return {
    // The full run row (status, terminal_outcome, decision_required,
    // no_autonomous_merge, budgets, timestamps, and the WP1 control columns).
    run,

    // Current turn: who is expected to answer and what state that turn is in.
    current_turn: currentTurn
      ? {
        turn_id: currentTurn.turn_id,
        ordinal: currentTurn.ordinal,
        expected_responder: currentTurn.expected_responder,
        state: currentTurn.state,
      }
      : null,

    // Round budget snapshot.
    rounds: {
      round_count: run.round_count,
      max_rounds: run.max_rounds,
    },

    // Evidence pointers (never content).
    evidence: {
      pr_ref: run.evidence_pr_ref ?? null,
      commit_sha: run.evidence_commit_sha ?? null,
      task_ref: run.evidence_task_ref ?? null,
    },

    // WP1 durable control state (the /pause /resume /watch /stop surface).
    control: {
      paused: run.paused,
      paused_at: run.paused_at ?? null,
      watch_level: run.watch_level,
      stop_requested: run.stop_requested,
      stop_requested_at: run.stop_requested_at ?? null,
    },

    // Last meaningful event (kind + when), for /status's "last event" line.
    last_event: lastEvent
      ? {
        event_id: lastEvent.event_id,
        kind: lastEvent.kind,
        source: lastEvent.source,
        received_at: lastEvent.received_at,
      }
      : null,

    // Last outbound notification for this run (delivery state + when sent).
    last_notification: lastNotification
      ? {
        dedup_key: lastNotification.dedup_key,
        purpose: lastNotification.purpose,
        logical_source: lastNotification.logical_source,
        state: lastNotification.state,
        sent_at: lastNotification.sent_at ?? null,
      }
      : null,
  };
}
