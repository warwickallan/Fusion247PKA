// Processing state machine (Capture Contract Pack v1 §4, reconciled with the
// Supabase Operational Foundation Boundary §1.1.2 pull/claim/write cycle).
//
// FIXTURES ONLY (WP0): pure logic, no I/O.
//
// The lifecycle merges the two source docs into Larry's decided WP0 set:
//   received → accepted → queued → claimed → writing → written → evidenced → completed
// with the safe-and-waiting side-state `offline_queued`, and the non-happy
// outcomes `partial`, `failed`, `needs_clarification`, `cancelled`.
//
// HARD INVARIANT: `completed` is reachable ONLY via written → evidenced →
// completed. There is no shortcut. Enforced by the transition map + tests.

export const STATES = Object.freeze({
  RECEIVED: 'received',
  ACCEPTED: 'accepted',
  QUEUED: 'queued',
  OFFLINE_QUEUED: 'offline_queued',
  CLAIMED: 'claimed',
  WRITING: 'writing',
  WRITTEN: 'written',
  EVIDENCED: 'evidenced',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
  NEEDS_CLARIFICATION: 'needs_clarification',
  CANCELLED: 'cancelled',
  // Retry-exhaustion sink: a delivery that has burned its bounded attempts and
  // is permanently parked for human/operator attention. Genuinely terminal.
  DEAD_LETTER: 'dead_letter',
});

export const ALL_STATES = Object.freeze(Object.values(STATES));

// Bounded-retry cap. The WORKER (not the store) owns the decision: when a
// failing item's `attempt_count` reaches this cap it is dead-lettered instead
// of re-queued. Exposed here so the worker compares against one shared constant.
export const MAX_DELIVERY_ATTEMPTS = 5;

// Terminal outcomes: no outgoing transition (except that failed/partial are
// "terminal-until-retry" — see below — so they are NOT in this set).
export const TERMINAL_STATES = Object.freeze([
  STATES.COMPLETED,
  STATES.CANCELLED,
  STATES.DEAD_LETTER,
]);

// States where a durable item is accepted but not yet processed. Cards must
// render offline-safe "safe and waiting" copy and never claim completion.
export const SAFE_AND_WAITING_STATES = Object.freeze([
  STATES.ACCEPTED,
  STATES.QUEUED,
  STATES.OFFLINE_QUEUED,
]);

// States from which a worker may pick up (claim) an item.
export const CLAIMABLE_STATES = Object.freeze([
  STATES.QUEUED,
  STATES.OFFLINE_QUEUED,
]);

// Allowed transitions. Key = from-state, value = Set of legal to-states.
// `cancelled` is reachable from any non-terminal state via the Cancel action
// (added below, after the base map, to keep the happy path readable).
const BASE_TRANSITIONS = {
  [STATES.RECEIVED]: [STATES.ACCEPTED, STATES.FAILED],
  [STATES.ACCEPTED]: [STATES.QUEUED, STATES.OFFLINE_QUEUED],
  [STATES.QUEUED]: [STATES.CLAIMED, STATES.OFFLINE_QUEUED],
  // Worker returns / re-queues an offline item.
  [STATES.OFFLINE_QUEUED]: [STATES.QUEUED, STATES.CLAIMED],
  // A claim can be worked, blocked, re-queued (lease expiry), or fail.
  [STATES.CLAIMED]: [
    STATES.WRITING,
    STATES.NEEDS_CLARIFICATION,
    STATES.QUEUED, // lease expiry / voluntary release returns it to the queue
    STATES.PARTIAL,
    STATES.FAILED,
  ],
  [STATES.WRITING]: [STATES.WRITTEN, STATES.PARTIAL, STATES.FAILED],
  // The one gated hop: written may only advance to evidenced (or fall back).
  [STATES.WRITTEN]: [STATES.EVIDENCED, STATES.PARTIAL, STATES.FAILED],
  // completed is reachable ONLY from evidenced.
  [STATES.EVIDENCED]: [STATES.COMPLETED, STATES.PARTIAL, STATES.FAILED],
  // Retry resumes from the last durable state — never from scratch. Once the
  // worker exhausts MAX_DELIVERY_ATTEMPTS the item is dead-lettered instead.
  [STATES.PARTIAL]: [STATES.CLAIMED, STATES.WRITING, STATES.DEAD_LETTER],
  [STATES.FAILED]: [STATES.CLAIMED, STATES.DEAD_LETTER],
  // User answers → back into processing.
  [STATES.NEEDS_CLARIFICATION]: [STATES.CLAIMED, STATES.WRITING],
  // Terminal:
  [STATES.COMPLETED]: [],
  [STATES.CANCELLED]: [],
  [STATES.DEAD_LETTER]: [],
};

// Cancel affordance: any non-terminal state may move to `cancelled`.
export const ALLOWED_TRANSITIONS = Object.freeze(
  Object.fromEntries(
    ALL_STATES.map((from) => {
      const base = BASE_TRANSITIONS[from] ?? [];
      const withCancel = TERMINAL_STATES.includes(from)
        ? base
        : [...base, STATES.CANCELLED];
      return [from, Object.freeze([...new Set(withCancel)])];
    }),
  ),
);

export function isState(state) {
  return typeof state === 'string' && ALL_STATES.includes(state);
}

export function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

export function canTransition(from, to) {
  if (!isState(from) || !isState(to)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Assert a transition is legal. Throws a descriptive Error if not — used by the
 * store where an illegal transition is a programming error, not user input.
 */
export function assertTransition(from, to) {
  if (!isState(from)) throw new Error(`assertTransition: unknown from-state "${from}"`);
  if (!isState(to)) throw new Error(`assertTransition: unknown to-state "${to}"`);
  if (!canTransition(from, to)) {
    throw new Error(`Illegal state transition: ${from} → ${to} (allowed: ${ALLOWED_TRANSITIONS[from].join(', ') || 'none'})`);
  }
  return true;
}
