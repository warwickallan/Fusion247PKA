// Fusion Tower — dispatcher / control loop.
//
// Drives a governance_run through bounded turns:
//   created -> active -> awaiting_responder -> (returned) -> next round or terminal
// It is Windows-owned (not Claude-session-owned), restart-safe (all state in the
// store; a tick resumes from durable rows), and enforces EVERY guardrail centrally
// via core/guardrails.js. Short-poll `tick()` is the reliable WP0 path; an
// event-driven nudge can call the same tick.
//
// Terminal outcomes surface to Warwick ONLY: READY / BLOCKED / TIMED_OUT /
// DECISION_REQUIRED / CLOSED. Everything else stays inside the loop.
//
// The dispatcher never performs a forbidden action. assertNoAutonomousMerge gates
// every external action an adapter proposes, and no adapter is given a merge tool.

import {
  RUN_STATUS,
  RUN_OUTCOME,
  TURN_STATE,
  WATCHDOG_LEASE_MS,
} from './core/states.js';
import {
  assertNoAutonomousMerge,
  assertWithinScope,
  assertSignerMatchesResponder,
  roundBudgetOk,
  budgetOk,
} from './core/guardrails.js';
import { verifyEnvelope } from './core/envelope.js';

// Map a terminal run status/outcome to the single Warwick-facing notification.
const OUTCOME_NOTICE = Object.freeze({
  ready: 'READY',
  completed: 'READY',
  blocked: 'BLOCKED',
  timed_out: 'TIMED_OUT',
  decision_required: 'DECISION_REQUIRED',
});

// Map a terminal/decision notice KIND -> the durable outbox milestone purpose. Used
// to enqueue the durable, deduped Telegram notification alongside the in-memory
// terminal notice. Distinct purposes => distinct dedup keys => each fires once.
const TERMINAL_PURPOSE = Object.freeze({
  READY: 'terminal_ready',
  BLOCKED: 'terminal_blocked',
  TIMED_OUT: 'terminal_timed_out',
  DECISION_REQUIRED: 'decision_required',
  STOPPED: 'terminal_stopped',
  CLOSED: 'terminal_stopped',
  FAILED: 'terminal_failed',
});

/**
 * @param {object} deps
 * @param {object} deps.store        memoryStore or postgresStore
 * @param {object} deps.config       loadConfig() result (for signing-secret verify)
 * @param {object} deps.adapters     { larry, gpt_codex } — each: runTurn(ctx) => result
 * @param {object} [deps.notifier]   { notify(kind, {run, text}) } terminal-only (in-memory)
 * @param {object} [deps.outbox]     durable Telegram notifier: enqueue(store, {runId,
 *                                   logicalSource, purpose, body}, {now}). Milestone
 *                                   events are ENQUEUED here (durable + deduped); the
 *                                   actual send is the drainer, so a Telegram outage
 *                                   never blocks orchestration and never loses a milestone.
 * @param {function} [deps.now]      () => epoch ms (injectable clock)
 * @param {number} [deps.leaseMs]    dead-man lease window (default 5 min)
 */
export function createDispatcher({ store, config, adapters, notifier, outbox, now, leaseMs } = {}) {
  if (!store) throw new Error('createDispatcher: store required');
  const clock = typeof now === 'function' ? now : () => Date.now();
  const lease = Number.isFinite(leaseMs) ? leaseMs : WATCHDOG_LEASE_MS;
  const notices = [];
  // Late-bindable so a control surface built AFTER the dispatcher (it needs the
  // dispatcher) can still supply the terminal-only notifier.
  let boundNotifier = notifier ?? null;
  // The durable milestone outbox (late-bindable too).
  let boundOutbox = outbox ?? null;

  // Durable milestone ENQUEUE — reserve a deduped notification. NEVER sends here and
  // NEVER throws out of orchestration: a durable enqueue failure (or a swallowed
  // secret-scan refusal on a Tower-composed body) must not break the control loop.
  // The drainer performs the actual send.
  async function enqueueMilestone(purpose, run, body, logicalSource = 'TOWER') {
    if (!boundOutbox || typeof boundOutbox.enqueue !== 'function') return null;
    try {
      return await boundOutbox.enqueue(store, {
        runId: run?.run_id ?? run?.runId ?? null,
        logicalSource,
        purpose,
        body,
      }, { now: clock() });
    } catch {
      return null; // enqueue must never break the loop
    }
  }

  async function emitTerminal(kind, run, text) {
    const notice = { kind, run_id: run?.run_id ?? null, outcome: run?.terminal_outcome ?? null, text, at: clock() };
    notices.push(notice);
    // Durable, deduped milestone for the terminal/decision surface (fires once per
    // run+purpose). This is the enqueue; the drainer sends.
    const purpose = TERMINAL_PURPOSE[kind] ?? 'terminal_closed';
    await enqueueMilestone(
      purpose, run,
      `run ${run?.run_id ?? '?'}: ${kind}${text ? ` — ${text}` : ''}`,
      'TOWER',
    );
    if (boundNotifier && typeof boundNotifier.notify === 'function') {
      try { await boundNotifier.notify(kind, { run, text }); } catch { /* notifier failures never break the loop */ }
    }
    return notice;
  }

  // Verify a signed result envelope against the honest per-principal secret.
  //
  // Identity honesty (signer must match the dispatched responder) is asserted
  // UNCONDITIONALLY, in every mode. The HMAC integrity check is mode-aware:
  //
  //   LIVE (config.isRuntimeReady()): FAIL-CLOSED (F-MED-01). A signing principal
  //     MUST have its per-principal secret provisioned AND return a signed,
  //     verifiable envelope. A missing secret, a missing envelope/signature, or a
  //     bad signature is REFUSED — the turn result is rejected, never recorded.
  //     The integrity control must not silently degrade on misconfiguration.
  //
  //   FIXTURES (non-runtime-ready): lenient — verify only when a secret AND a
  //     signature are present; an honest unsigned envelope is accepted (this is
  //     the synthetic-substrate WP0 path).
  function verifySignedResult(expectedResponder, result) {
    assertSignerMatchesResponder(expectedResponder, result.signerPrincipal);
    const principal = result.signerPrincipal;
    const secret = config?.signingSecret ? config.signingSecret(principal) : null;
    const isSigningPrincipal = Boolean(config?.signingSecretEnvName?.(principal));
    const live = typeof config?.isRuntimeReady === 'function' && config.isRuntimeReady();

    if (live && isSigningPrincipal) {
      if (!secret) {
        const envName = config.signingSecretEnvName(principal);
        throw new Error(
          `dispatcher: refusing unsigned turn result for "${principal}" — live mode requires `
          + `${envName} to be provisioned (fail-closed, F-MED-01)`,
        );
      }
      if (!result.envelope || !result.signature) {
        throw new Error(
          `dispatcher: refusing unsigned turn result for "${principal}" — live mode requires a `
          + 'signed envelope + signature (fail-closed, F-MED-01)',
        );
      }
      if (!verifyEnvelope(result.envelope, result.signature, secret)) {
        throw new Error(`dispatcher: signature verification failed for ${principal}`);
      }
      return true;
    }

    if (secret && result.envelope && result.signature) {
      const ok = verifyEnvelope(result.envelope, result.signature, secret);
      if (!ok) throw new Error(`dispatcher: signature verification failed for ${principal}`);
    }
    return true;
  }

  const dispatcher = {
    store,
    get notices() { return [...notices]; },

    /** Thin passthrough so control surfaces can resolve target runs. */
    async listRuns() { return store.listRuns(); },

    /** Late-bind the terminal-only notifier (control surface needs the dispatcher). */
    setNotifier(n) { boundNotifier = n; },

    /** Late-bind the durable milestone outbox (Telegram notifier). */
    setOutbox(o) { boundOutbox = o; },

    /**
     * Create a governance run (typically from a Telegram /start) and move it to
     * active. Returns the run row.
     */
    async createRun(spec = {}) {
      const opts = { now: clock() };
      const run = await store.createRun(spec, opts);
      // Milestone: run created.
      await enqueueMilestone('run_created', run, `run ${run.run_id}: created — ${run.title ?? 'untitled'}`, 'TOWER');
      return run;
    },

    /**
     * Prepare + dispatch the next turn for a run to `expectedResponder`. Enforces
     * round + budget guardrails BEFORE dispatch; on breach terminates the run.
     * Returns { turn } or { terminated: <notice> }.
     */
    async dispatchNextTurn(runId, { expectedResponder, boundedContext } = {}) {
      const nowMs = clock();
      let run = await store.getRun(runId);
      if (!run) throw new Error(`dispatchNextTurn: unknown run ${runId}`);

      // Budget gate (time/token) — enforced in the loop.
      const budget = budgetOk(run, nowMs);
      if (!budget.allowed) {
        return { terminated: await this.terminate(runId, RUN_STATUS.TIMED_OUT, RUN_OUTCOME.TIMED_OUT, budget.reason) };
      }
      // Round gate.
      const rounds = roundBudgetOk(run);
      if (!rounds.allowed) {
        return { terminated: await this.terminate(runId, RUN_STATUS.BLOCKED, RUN_OUTCOME.BLOCKED, rounds.reason) };
      }

      // Normalise to `active` before preparing a turn. Legal from created,
      // awaiting_responder (prior turn resolved/timed out), or awaiting_decision
      // (a decision reopened the loop). If already active, leave it.
      if (run.status !== RUN_STATUS.ACTIVE) {
        run = await store.setRunStatus(runId, RUN_STATUS.ACTIVE, { now: nowMs });
      }
      // NB: the store persists the bounded context under `boundedContextRef`; map it
      // here so the pointer context actually reaches the responder's turn (both stores
      // read boundedContextRef). Without this the adapter would fall back to a default
      // task and no pointers would ever reach the reviewer.
      const turn = await store.appendTurn(runId, { expectedResponder, boundedContextRef: boundedContext }, { now: nowMs });
      const dispatched = await store.dispatchTurn(turn.turn_id, { now: nowMs, leaseMs: lease });
      await store.setCurrentTurn(runId, turn.turn_id, { now: nowMs });
      await store.setRunStatus(runId, RUN_STATUS.AWAITING_RESPONDER, { now: nowMs });
      // Milestone: expected-responder change (a turn dispatched to a responder).
      await enqueueMilestone(
        `turn_dispatched_${dispatched.ordinal}`, run,
        `run ${runId}: turn ${dispatched.ordinal} dispatched to ${expectedResponder}`,
        'TOWER',
      );
      return { turn: dispatched };
    },

    /**
     * Invoke the responder's adapter for a dispatched turn, verify + record the
     * signed result, and advance the run. This is where the adapter's proposed
     * external action is guardrail-checked (scope + no-autonomous-merge) BEFORE
     * anything is surfaced. Returns the recorded turn plus the proposed action.
     */
    async runTurn(turnId) {
      const nowMs = clock();
      const turn = await store.getTurn(turnId);
      if (!turn) throw new Error(`runTurn: unknown turn ${turnId}`);
      const run = await store.getRun(turn.run_id);
      const adapter = adapters?.[turn.expected_responder];
      if (!adapter || typeof adapter.runTurn !== 'function') {
        // No adapter for this responder (e.g. warwick/human) — record a blocker.
        await store.recordTurnFailure(turnId, { error: `no adapter for responder ${turn.expected_responder}` }, { now: nowMs });
        return { turn: await store.getTurn(turnId), blocked: true };
      }

      // Milestone: turn START (Codex review start / Larry turn start).
      const responder = turn.expected_responder;
      if (responder === 'gpt_codex') {
        await enqueueMilestone('codex_review_start', run, `run ${turn.run_id}: Codex review started (turn ${turn.ordinal})`, 'CODEX');
      } else if (responder === 'larry') {
        await enqueueMilestone('larry_turn_start', run, `run ${turn.run_id}: Larry turn started (turn ${turn.ordinal})`, 'LARRY');
      }

      let result;
      try {
        result = await adapter.runTurn({ run, turn, boundedContext: turn.bounded_context_ref });
      } catch (err) {
        await store.recordTurnFailure(turnId, { error: String(err?.message ?? err) }, { now: nowMs });
        return { turn: await store.getTurn(turnId), blocked: true, error: String(err?.message ?? err) };
      }

      // A fail-closed adapter (missing credential/binary) returns blocked:true with
      // a signed "blocked" structured result. Record it as a signed return so the
      // run advances deterministically to a blocked terminal — not a hang.
      if (result?.blocked) {
        await this.recordResult(turnId, result, { now: nowMs });
        return { turn: await store.getTurn(turnId), blocked: true, blocker: result.structuredResult?.blocker ?? result.error ?? 'blocked' };
      }

      // Guardrail-check any proposed external action BEFORE recording/surfacing.
      const action = result?.structuredResult?.proposed_action;
      if (action) {
        assertNoAutonomousMerge(action);
        assertWithinScope(run.scope_lock, action);
      }
      await this.recordResult(turnId, result, { now: nowMs });
      // Milestone: turn COMPLETE (Codex review complete / Larry turn complete).
      if (responder === 'gpt_codex') {
        await enqueueMilestone('codex_review_complete', run, `run ${turn.run_id}: Codex review complete (turn ${turn.ordinal})`, 'CODEX');
      } else if (responder === 'larry') {
        await enqueueMilestone('larry_turn_complete', run, `run ${turn.run_id}: Larry turn complete (turn ${turn.ordinal})`, 'LARRY');
      }
      return { turn: await store.getTurn(turnId), action: action ?? null, result };
    },

    /** Verify + record a signed turn result and roll up token spend. */
    async recordResult(turnId, result, opts = {}) {
      const turn = await store.getTurn(turnId);
      verifySignedResult(turn.expected_responder, result);
      await store.recordTurnResult(turnId, {
        structuredResult: result.envelope ?? result.structuredResult ?? null,
        resultSignature: result.signature ?? null,
        signerPrincipal: result.signerPrincipal,
      }, opts);
      if (Number.isFinite(result.tokensUsed) && result.tokensUsed > 0) {
        await store.addTokens(turn.run_id, result.tokensUsed, opts);
      }
      return store.getTurn(turnId);
    },

    /**
     * Ingest an external/synthetic event with dedup, then advance the bound run
     * at most once. Self-generated / tower events are recorded but never advance.
     * Returns { event, isNew, advanced }.
     */
    async ingestAndBind(eventArgs, { runId, boundResponder } = {}) {
      const nowMs = clock();
      const { event, isNew } = await store.ingestEvent(eventArgs, { now: nowMs });
      if (event && (runId || boundResponder)) {
        await store.bindEvent(event.event_id, runId ?? event.run_id, boundResponder, { now: nowMs });
      }
      const bound = await store.getEvent(event.event_id);
      // Milestone: CI pending/green/red — enqueue once per NEW github check event.
      if (isNew) await this._maybeEnqueueCi(bound);
      return { event: bound, isNew };
    },

    // Map a github check event -> a CI milestone (ci_green/ci_red/ci_pending) and
    // enqueue it durably+deduped, tagged with the CI message-identity. Non-CI or
    // self/tower events are ignored.
    async _maybeEnqueueCi(event) {
      if (!event || event.source !== 'github') return;
      const kind = String(event.kind ?? '');
      if (!kind.startsWith('check_suite') && !kind.startsWith('check_run') && !kind.startsWith('status')) return;
      const conclusion = String(event.payload?.conclusion ?? event.payload?.state ?? 'unknown').toLowerCase();
      let purpose;
      let label;
      if (conclusion === 'success') { purpose = 'ci_green'; label = 'GREEN'; }
      else if (['failure', 'timed_out', 'cancelled', 'action_required', 'error'].includes(conclusion)) { purpose = 'ci_red'; label = 'RED'; }
      else { purpose = 'ci_pending'; label = 'PENDING'; }
      const runRef = event.run_id ? { run_id: event.run_id } : null;
      const sha = event.head_sha ? ` @ ${String(event.head_sha).slice(0, 8)}` : '';
      await enqueueMilestone(purpose, runRef, `run ${event.run_id ?? '(unbound)'}: CI ${label}${sha}`, 'CI');
    },

    /**
     * Advance-once: claim the oldest unprocessed non-self event for a run and mark
     * it processed transactionally. Returns the claimed event or null. The caller
     * decides the resulting turn; this method only guarantees exactly-once consume.
     */
    async consumeNextEvent(runId) {
      const nowMs = clock();
      const event = await store.claimNextEvent({ runId });
      if (!event) return null;
      await store.markEventProcessed(event.event_id, { now: nowMs });
      return event;
    },

    /**
     * Watchdog: reap silent dispatched turns, then decide retry-within-budget vs
     * terminal timed_out for each reaped turn's run. Returns { reaped, decisions }.
     */
    async watchdog() {
      const nowMs = clock();
      const sweep = await store.watchdogSweep({ now: nowMs });
      const decisions = [];
      for (const turnId of sweep.turnIds) {
        const turn = await store.getTurn(turnId);
        const run = await store.getRun(turn.run_id);
        const rounds = roundBudgetOk(run);
        const budget = budgetOk(run, nowMs);
        if (rounds.allowed && budget.allowed) {
          // Retry within budget: new ordinal (append-only), same responder.
          await store.incrementRound(run.run_id, { now: nowMs });
          const retry = await this.dispatchNextTurn(run.run_id, {
            expectedResponder: turn.expected_responder,
            boundedContext: turn.bounded_context_ref,
          });
          decisions.push({ turnId, decision: 'retry', retryTurnId: retry.turn?.turn_id ?? null });
        } else {
          // Milestone: a retry is MATERIALLY BLOCKED (rounds/budget exhausted) — the
          // distinct "cannot retry" moment, separate from the terminal outcome below.
          await enqueueMilestone(
            `retry_blocked_${turn.ordinal}`, run,
            `run ${run.run_id}: retry blocked — ${rounds.allowed ? budget.reason : rounds.reason}`,
            'TOWER',
          );
          const notice = await this.terminate(run.run_id, RUN_STATUS.TIMED_OUT, RUN_OUTCOME.TIMED_OUT,
            `watchdog reaped turn ${turn.ordinal}; ${rounds.allowed ? budget.reason : rounds.reason}`);
          decisions.push({ turnId, decision: 'terminal', notice });
        }
      }
      return { reaped: sweep.reaped, decisions };
    },

    /**
     * Open a human decision gate: park the run in awaiting_decision with
     * decision_required = true (does NOT auto-resolve). Terminal-visible.
     */
    async openDecisionGate(runId, text = 'human decision required') {
      const nowMs = clock();
      const run = await store.getRun(runId);
      if (run.status !== RUN_STATUS.AWAITING_DECISION) {
        await store.setRunStatus(runId, RUN_STATUS.AWAITING_DECISION, { now: nowMs, decisionRequired: true });
      }
      const updated = await store.getRun(runId);
      return this.emitDecisionNotice(updated, text);
    },

    async emitDecisionNotice(run, text) {
      return emitTerminal('DECISION_REQUIRED', { ...run, terminal_outcome: RUN_OUTCOME.DECISION_REQUIRED }, text);
    },

    /**
     * Mark a run READY (green PR, awaiting the human's merge — NEVER auto-merged).
     * READY is surfaced from a live-but-parked state via awaiting_decision, since
     * the merge itself is a human decision (no_autonomous_merge).
     */
    async surfaceReady(runId, text = 'work is ready for your review/merge') {
      const nowMs = clock();
      const run = await store.getRun(runId);
      if (run.status !== RUN_STATUS.AWAITING_DECISION) {
        await store.setRunStatus(runId, RUN_STATUS.AWAITING_DECISION, { now: nowMs, decisionRequired: true });
      }
      const updated = await store.getRun(runId);
      return emitTerminal('READY', { ...updated, terminal_outcome: RUN_OUTCOME.READY }, text);
    },

    /**
     * Terminate a run to a terminal status + outcome and emit the single Warwick
     * notification. Idempotent-ish: a run already terminal is not re-terminated.
     */
    async terminate(runId, status, outcome, text = '') {
      const nowMs = clock();
      const run = await store.getRun(runId);
      if (['blocked', 'timed_out', 'completed', 'cancelled'].includes(run.status)) {
        // Already terminal — surface the existing outcome once more is harmless.
        return emitTerminal(OUTCOME_NOTICE[run.terminal_outcome] ?? 'CLOSED', run, text);
      }
      const updated = await store.setRunStatus(runId, status, { now: nowMs, terminalOutcome: outcome });
      const kind = OUTCOME_NOTICE[outcome] ?? 'CLOSED';
      return emitTerminal(kind, updated, text);
    },

    /** Complete a run successfully (terminal completed → READY notice). */
    async complete(runId, text = 'run completed') {
      return this.terminate(runId, RUN_STATUS.COMPLETED, RUN_OUTCOME.COMPLETED, text);
    },

    /** Emit a CLOSED notice (used after a terminal outcome is acknowledged). */
    async close(runId, text = 'run closed') {
      const run = await store.getRun(runId);
      return emitTerminal('CLOSED', run, text);
    },
  };

  return dispatcher;
}
