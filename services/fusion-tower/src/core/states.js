// Fusion Tower — run & turn state machines (mirrors migration 0001 enums exactly).
//
// The DB enums are the source of truth (services/fusion-tower/migrations/0001).
// This module re-expresses them as frozen constants plus the LEGAL transition
// tables the dispatcher enforces, so an illegal transition is caught in code
// before it ever reaches SQL — the fcg states.js house style.

export const RUN_STATUS = Object.freeze({
  CREATED: 'created',
  ACTIVE: 'active',
  AWAITING_RESPONDER: 'awaiting_responder',
  AWAITING_DECISION: 'awaiting_decision',
  BLOCKED: 'blocked',
  TIMED_OUT: 'timed_out',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

// Terminal statuses — the only ones allowed to carry a terminal_outcome (matches
// governance_run_terminal_outcome_chk).
export const TERMINAL_RUN_STATUSES = Object.freeze([
  RUN_STATUS.BLOCKED,
  RUN_STATUS.TIMED_OUT,
  RUN_STATUS.COMPLETED,
  RUN_STATUS.CANCELLED,
]);

export const RUN_OUTCOME = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
  TIMED_OUT: 'timed_out',
  DECISION_REQUIRED: 'decision_required',
  COMPLETED: 'completed',
});

export const TURN_STATE = Object.freeze({
  PENDING: 'pending',
  DISPATCHED: 'dispatched',
  IN_PROGRESS: 'in_progress',
  RETURNED: 'returned',
  FAILED: 'failed',
  TIMED_OUT: 'timed_out',
});

export const PRINCIPAL = Object.freeze({
  LARRY: 'larry',
  GPT_CODEX: 'gpt_codex',
  WARWICK: 'warwick',
  TOWER: 'tower',
});

// tower orchestrates turns but never TAKES one (run_turn_expected_responder_not_tower_chk).
export const RESPONDER_PRINCIPALS = Object.freeze([
  PRINCIPAL.LARRY,
  PRINCIPAL.GPT_CODEX,
  PRINCIPAL.WARWICK,
]);

export const EVENT_SOURCE = Object.freeze({
  TELEGRAM: 'telegram',
  GITHUB: 'github',
  CLICKUP: 'clickup',
  TOWER: 'tower',
});

// Legal run-status transitions (control-plane-schema.md §3). Terminal states have
// no outgoing edges.
const RUN_TRANSITIONS = Object.freeze({
  // A run can be terminated (stopped/blocked/timed-out/cancelled) before it ever
  // dispatches its first turn — e.g. a budget breach or a /stop right after /start.
  [RUN_STATUS.CREATED]: [
    RUN_STATUS.ACTIVE,
    RUN_STATUS.BLOCKED,
    RUN_STATUS.TIMED_OUT,
    RUN_STATUS.CANCELLED,
  ],
  [RUN_STATUS.ACTIVE]: [
    RUN_STATUS.AWAITING_RESPONDER,
    RUN_STATUS.AWAITING_DECISION,
    RUN_STATUS.COMPLETED,
    RUN_STATUS.BLOCKED,
    RUN_STATUS.TIMED_OUT,
    RUN_STATUS.CANCELLED,
  ],
  [RUN_STATUS.AWAITING_RESPONDER]: [
    RUN_STATUS.ACTIVE,
    RUN_STATUS.AWAITING_DECISION,
    RUN_STATUS.BLOCKED,
    RUN_STATUS.TIMED_OUT,
    RUN_STATUS.CANCELLED,
  ],
  [RUN_STATUS.AWAITING_DECISION]: [
    RUN_STATUS.ACTIVE,
    RUN_STATUS.COMPLETED,
    RUN_STATUS.BLOCKED,
    RUN_STATUS.CANCELLED,
  ],
  [RUN_STATUS.BLOCKED]: [],
  [RUN_STATUS.TIMED_OUT]: [],
  [RUN_STATUS.COMPLETED]: [],
  [RUN_STATUS.CANCELLED]: [],
});

// Legal turn-state transitions (control-plane-schema.md §4).
const TURN_TRANSITIONS = Object.freeze({
  [TURN_STATE.PENDING]: [TURN_STATE.DISPATCHED],
  [TURN_STATE.DISPATCHED]: [
    TURN_STATE.IN_PROGRESS,
    TURN_STATE.RETURNED,
    TURN_STATE.FAILED,
    TURN_STATE.TIMED_OUT,
  ],
  [TURN_STATE.IN_PROGRESS]: [
    TURN_STATE.RETURNED,
    TURN_STATE.FAILED,
    TURN_STATE.TIMED_OUT,
  ],
  [TURN_STATE.RETURNED]: [],
  [TURN_STATE.FAILED]: [],
  [TURN_STATE.TIMED_OUT]: [],
});

export function isTerminalRunStatus(status) {
  return TERMINAL_RUN_STATUSES.includes(status);
}

export function canTransitionRun(from, to) {
  return (RUN_TRANSITIONS[from] ?? []).includes(to);
}

export function assertRunTransition(from, to) {
  if (!canTransitionRun(from, to)) {
    throw new Error(`illegal run transition: ${from} -> ${to}`);
  }
}

export function canTransitionTurn(from, to) {
  return (TURN_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTurnTransition(from, to) {
  if (!canTransitionTurn(from, to)) {
    throw new Error(`illegal turn transition: ${from} -> ${to}`);
  }
}

// The default 5-minute dead-man lease window (dedup-and-timeout-contract.md §3).
export const WATCHDOG_LEASE_MS = 5 * 60 * 1000;
