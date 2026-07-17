// Fusion Tower — the autonomous governance LOOP DRIVER (BUILD-010 WP1 CAPSTONE).
//
// This is the orchestration that ties every built component together and drives ONE
// governance run through its FULL lifecycle, with every unit of state durable in the
// `ftw` control plane (restart-safe) and every gate honoured. It reuses — never
// rebuilds — the dispatcher (run/turn state machine + guardrails + human gate),
// the codex/larry adapters, the durable Telegram notification outbox, the durable
// external-write (ClickUp) outbox, and the decision gate.
//
// THE LIFECYCLE (Operating Instructions §2–§5, §4a normative):
//
//   1. run-start        — startGovernanceRun(): durable governance_run (active,
//                         scope-lock, round budget) + a [TOWER] "run created" notice.
//   2. evidence stage   — assembleRunPacket(): bounded POINTERS (repo/branch/exact
//                         head SHA, control task ref, latest checkpoint ref, staged
//                         CI evidence ref) bound to the EXACT head SHA. A new head
//                         SHA invalidates a prior review.
//   3. Codex review     — dispatch a Codex review turn → signed verdict. Tower posts
//                         the detailed review to ClickUp via the DURABLE external-write
//                         outbox, then calls dispatcher.reviewGate() → posts the [CODEX]
//                         card, opens the decision gate, and HALTS. No Larry dispatch.
//   4. HUMAN GATE       — the loop STOPS until a `command:decision` event records a
//                         Proceed (Hold→pause, Stop→stop). assertLarryDispatchAllowed
//                         (inside dispatchNextTurn) structurally blocks step 5 until a
//                         durable Proceed is recorded.
//   5. Larry correction — ONLY after Proceed: dispatch Larry with the reviewed head +
//                         the named corrections → signed bounded result → new head SHA.
//   6. re-review        — Tower detects the new head, invalidates the prior review,
//                         loops back to step 3 — bounded by maxRounds (default 2).
//   7. terminal         — resolve to READY_TO_MERGE | BLOCKED | DECISION_REQUIRED |
//                         TIMED_OUT | STOPPED | FAILED and emit ONE terminal [TOWER]
//                         notice. READY_TO_MERGE NEVER merges — merge stays Warwick-only.
//
// HARD BOUNDARIES (restated + enforced by the components this driver composes):
//   · NO AUTONOMOUS MERGE — no code path here proposes a merge; the guardrails reject
//     one if it ever appeared, and READY_TO_MERGE only SURFACES the run for Warwick.
//   · HUMAN GATE HONOURED — Larry is never dispatched before a durable Proceed
//     (structurally enforced by assertLarryDispatchAllowed inside dispatchNextTurn).
//   · OUTBOUND-ONLY / DURABLE — every notification is an outbox ENQUEUE (deduped);
//     the drainer sends. Every external write is a durable, idempotent outbox claim.
//   · RESTART-SAFE — all state lives in the store; a fresh driver over the same store
//     resumes a run from its durable rows.

import { RUN_STATUS, RUN_OUTCOME } from './core/states.js';
import { DEFAULT_MAX_REVIEW_ROUNDS } from './core/guardrails.js';
import { TOWER_SELF_MARKER } from './adapters/eventIntake.js';
import { ALLOWED_CLICKUP_TASK_ID } from './adapters/clickupPoster.js';

// The driver's terminal resolution vocabulary (a superset of the run's DB
// terminal_outcome enum — some resolutions map onto the same durable status but carry
// a distinct driver-level meaning, e.g. STOPPED is a cancelled run from a human Stop).
export const LOOP_OUTCOME = Object.freeze({
  READY_TO_MERGE: 'READY_TO_MERGE', // green review; awaiting Warwick's merge (NEVER auto)
  BLOCKED: 'BLOCKED',               // rounds/budget exhausted, or a fail-closed turn
  DECISION_REQUIRED: 'DECISION_REQUIRED', // halted at the human gate (resting, not final)
  TIMED_OUT: 'TIMED_OUT',           // watchdog / budget
  STOPPED: 'STOPPED',               // human Stop decision (safe halt)
  FAILED: 'FAILED',                 // unexpected error
});

// The bounded set of governance actions the ClickUp scope-lock allows. Merge is
// deliberately absent (guardrails.FORBIDDEN_ACTIONS is the hard backstop).
const DEFAULT_ALLOWED_ACTIONS = Object.freeze([
  'post_review', 'post_comment', 'set_task_status', 'request_review', 'notify', 'noop',
]);

function clockOf(now) {
  return typeof now === 'function' ? now : () => Date.now();
}

function shortSha(sha) {
  return sha ? String(sha).slice(0, 8) : '—';
}

// ── run-start ────────────────────────────────────────────────────────────────

/**
 * Create a durable governance_run, move it to `active`, and emit the [TOWER] "run
 * created" notification. This is what a `/gov start …` command or a Telegram run-start
 * maps to. All state is durable in `ftw.governance_run`; a restart resumes from it.
 *
 * @param {object} store  memoryStore | postgresStore
 * @param {object} spec
 * @param {string} spec.title
 * @param {string} [spec.scope]
 * @param {string} spec.repo            'owner/repo' the run governs (read scope)
 * @param {string} [spec.branch]        the branch under review
 * @param {string} [spec.headSha]       the EXACT head SHA the run starts from (evidence)
 * @param {string} [spec.controlTaskRef] the ClickUp control task ref (claims to verify)
 * @param {string} [spec.prRef]         the open PR ref, when present
 * @param {number} [spec.maxRounds=2]   bounded review-round budget (default 2)
 * @param {object} [spec.budget]        { tokens, deadlineAt, timeSeconds } — null = unbounded
 * @param {object} [deps]
 * @param {function} [deps.now]         injectable clock () => epoch ms
 * @param {object}   [deps.outbox]      durable Telegram notifier ({ enqueue })
 * @returns {Promise<object>} the active governance_run row
 */
export async function startGovernanceRun(store, spec = {}, deps = {}) {
  const now = clockOf(deps.now);
  const maxRounds = Number.isFinite(spec.maxRounds) ? spec.maxRounds : DEFAULT_MAX_REVIEW_ROUNDS;
  if (!spec.repo) throw new Error('startGovernanceRun: spec.repo is required (scope-lock needs a repo)');

  // Scope-lock: repo (+ branch pointer) + the bounded governance action set. Merge is
  // never in-scope (the guardrails reject it regardless).
  const scopeLock = {
    repos: [spec.repo],
    branch: spec.branch ?? null,
    allowed_actions: [...DEFAULT_ALLOWED_ACTIONS],
    ...(spec.controlTaskRef ? { task_ids: [spec.controlTaskRef] } : {}),
  };

  const budget = spec.budget ?? {};
  const run = await store.createRun({
    title: spec.title ?? 'governance run',
    scope: spec.scope ?? spec.title ?? null,
    scopeLock,
    maxRounds,
    tokenBudget: budget.tokens ?? null,
    timeBudgetSeconds: budget.timeSeconds ?? null,
    deadlineAt: budget.deadlineAt ?? null,
    evidencePrRef: spec.prRef ?? null,
    evidenceCommitSha: spec.headSha ?? null,
    evidenceTaskRef: spec.controlTaskRef ?? null,
  }, { now: now() });

  // created -> active (the run is live the moment it is started).
  const active = await store.setRunStatus(run.run_id, RUN_STATUS.ACTIVE, { now: now() });

  // [TOWER] "run created" — durable, deduped. Never throws out of run-start.
  await enqueueTower(deps.outbox, store,
    `run_created:${run.run_id}`,
    run.run_id,
    `run ${shortSha(run.run_id)}: created — ${active.title} (repo ${spec.repo}${spec.branch ? `@${spec.branch}` : ''}, head ${shortSha(spec.headSha)}, maxRounds ${maxRounds})`,
    now());

  return active;
}

// Enqueue a durable [TOWER] notification; swallow any enqueue hiccup (a notify failure
// must never break orchestration). Returns the enqueue result or null.
async function enqueueTower(outbox, store, purpose, runId, body, now) {
  if (!outbox || typeof outbox.enqueue !== 'function') return null;
  try {
    return await outbox.enqueue(store, { runId, logicalSource: 'TOWER', purpose, body }, { now });
  } catch {
    return null;
  }
}

// ── evidence collectors (injectable, least-privilege reads) ───────────────────

/**
 * The minimal evidence-collector interface the loop depends on. Real implementations
 * are least-privilege GitHub + ClickUp READ clients; here they are trivially stubbable.
 * The loop only needs the POINTERS bound to the EXACT head SHA — it never needs the
 * corpus. A stub simply echoes the head SHA it was seeded with.
 *
 *   github.headSha({ repo, branch })      => Promise<string>   (current head of branch)
 *   github.checkEvidenceRef({ repo, headSha }) => Promise<string|null>  (staged CI ref)
 *   clickup.controlTask({ taskRef })      => Promise<{ id, ref, url }>  (claims pointer)
 */
export function createStubCollectors({ headSha = null, controlTaskRef = null } = {}) {
  return {
    github: {
      async headSha() { return headSha; },
      async checkEvidenceRef({ headSha: h } = {}) { return h ? `ci-evidence:${shortSha(h)}` : null; },
    },
    clickup: {
      async controlTask({ taskRef } = {}) {
        const ref = taskRef ?? controlTaskRef;
        return ref ? { id: ref, ref, url: `https://app.clickup.com/t/${String(ref).replace(/^CU-/i, '')}` } : null;
      },
    },
  };
}

/**
 * Assemble the bounded run packet POINTERS bound to the EXACT head SHA. This is the
 * evidence-pointer doctrine in one object: repo/branch/head SHA, the control task ref,
 * the latest checkpoint ref, and the staged CI evidence ref — NEVER the corpus.
 *
 * @param {object} args
 * @param {object} args.run          the governance_run row
 * @param {object} args.collectors   { github, clickup } (createStubCollectors shape)
 * @param {string} [args.checkpointRef]  the latest Larry checkpoint pointer
 * @param {object} [deps]  { now }
 * @returns {Promise<object>} the bounded packet (all pointers)
 */
export async function assembleRunPacket({ run, collectors, checkpointRef = null } = {}, deps = {}) {
  const now = clockOf(deps.now);
  const repo = run.scope_lock?.repos?.[0] ?? null;
  const branch = run.scope_lock?.branch ?? null;
  // The head SHA the review is bound to: the run's current evidence commit SHA. If a
  // collector can read the live branch head, prefer that (it detects a new head).
  let headSha = run.evidence_commit_sha ?? null;
  if (collectors?.github?.headSha) {
    const live = await collectors.github.headSha({ repo, branch });
    if (live) headSha = live;
  }
  const ciEvidenceRef = collectors?.github?.checkEvidenceRef
    ? await collectors.github.checkEvidenceRef({ repo, headSha })
    : null;
  const controlTask = collectors?.clickup?.controlTask
    ? await collectors.clickup.controlTask({ taskRef: run.evidence_task_ref })
    : (run.evidence_task_ref ? { id: run.evidence_task_ref, ref: run.evidence_task_ref } : null);

  return {
    run_id: run.run_id,
    repo,
    branch,
    head_sha: headSha,
    pr_ref: run.evidence_pr_ref ?? null,
    control_task_ref: controlTask?.ref ?? run.evidence_task_ref ?? null,
    control_task_url: controlTask?.url ?? null,
    checkpoint_ref: checkpointRef,
    ci_evidence_ref: ciEvidenceRef,
    bound_at: now(),
  };
}

// ── the loop driver ───────────────────────────────────────────────────────────

/**
 * Create the loop driver over a durable store + a wired dispatcher.
 *
 * @param {object} args
 * @param {object} args.store         durable store (memoryStore | postgresStore)
 * @param {object} args.dispatcher    createDispatcher() result (state machine + gate)
 * @param {object} [args.config]      loadConfig() result (allowlist)
 * @param {object} [args.outbox]      durable Telegram notifier ({ enqueue })
 * @param {object} [args.collectors]  { github, clickup } evidence collectors
 * @param {object} [args.clickupPoster]  createClickupReviewPoster() result (durable
 *                                       external-write outbox). Null → skip the ClickUp
 *                                       post (the [CODEX] card gate still fires).
 * @param {string} [args.controlTaskId]  authorised ClickUp control task id
 * @param {function} [args.now]       injectable clock () => epoch ms
 */
export function createLoopDriver({
  store, dispatcher, config, outbox, collectors,
  clickupPoster = null, controlTaskId = ALLOWED_CLICKUP_TASK_ID, now,
} = {}) {
  if (!store) throw new Error('createLoopDriver: store required');
  if (!dispatcher) throw new Error('createLoopDriver: dispatcher required');
  const clock = clockOf(now);
  const cols = collectors ?? createStubCollectors();
  const allowlist = config?.authorisedTelegramUserId ? [String(config.authorisedTelegramUserId)] : [];

  // Build the bounded review body posted to the ClickUp control thread. Carries the
  // Tower self-marker (self-loop prevention) and POINTERS only — never a secret.
  function composeReviewBody({ run, packet, verdict, summary, findings }) {
    const sevLines = (Array.isArray(findings) ? findings : []).map(
      (f) => `- [${f.severity}] ${f.id}: ${String(f.required_correction ?? f.rationale ?? '').slice(0, 200)}`,
    );
    return [
      TOWER_SELF_MARKER,
      `Fusion Tower — independent Codex review (run ${shortSha(run.run_id)})`,
      `verdict: ${verdict} · head: ${shortSha(packet.head_sha)}`,
      `summary: ${String(summary ?? '').slice(0, 400)}`,
      sevLines.length ? `findings:\n${sevLines.join('\n')}` : 'findings: none',
    ].join('\n');
  }

  const driver = {
    LOOP_OUTCOME,

    /** Step 1 — run-start. */
    async startRun(spec) {
      return startGovernanceRun(store, spec, { now: clock, outbox });
    },

    /**
     * Step 2 — evidence stage. Assemble the bounded packet POINTERS bound to the exact
     * head SHA, persist the head/PR/task evidence durably, and enqueue a [TOWER]
     * evidence-staged milestone. A new head SHA (detected by the collector) is written
     * through, invalidating any prior review implicitly.
     */
    async stageEvidence(runId, { checkpointRef = null } = {}) {
      const run = await store.getRun(runId);
      if (!run) throw new Error(`stageEvidence: unknown run ${runId}`);
      const packet = await assembleRunPacket({ run, collectors: cols, checkpointRef }, { now: clock });
      await store.setEvidence(runId, {
        prRef: packet.pr_ref,
        commitSha: packet.head_sha,
        taskRef: packet.control_task_ref,
        // evidence_refs is an ARRAY of labelled pointer strings (never the corpus) —
        // the shape both stores clone/serialise identically.
        refs: [
          packet.checkpoint_ref ? `checkpoint:${packet.checkpoint_ref}` : null,
          packet.ci_evidence_ref ? `ci:${packet.ci_evidence_ref}` : null,
          packet.control_task_url ? `clickup:${packet.control_task_url}` : null,
        ].filter(Boolean),
      }, { now: clock() });
      await enqueueTower(outbox, store, `evidence_staged:${shortSha(packet.head_sha)}`, runId,
        `run ${shortSha(runId)}: evidence staged — head ${shortSha(packet.head_sha)}, task ${packet.control_task_ref ?? '—'}`,
        clock());
      return packet;
    },

    /**
     * Step 3 — Codex review turn. Dispatch a bounded Codex review for the exact head,
     * post the detailed review to ClickUp via the durable external-write outbox, then:
     *   · verdict `approve`          → resolve READY_TO_MERGE (no correction needed;
     *                                  merge stays Warwick-only — surfaced, never done).
     *   · verdict request_changes/comment → dispatcher.reviewGate() posts the [CODEX]
     *                                  card, opens the decision gate, and HALTS.
     *   · a fail-closed blocked turn → resolve BLOCKED deterministically.
     *
     * Returns { stage:'review', verdict, review, gate, halted, terminal, reviewTurnId,
     *           posted }.
     */
    async runCodexReview(runId, packet) {
      const d = await dispatcher.dispatchNextTurn(runId, {
        expectedResponder: 'gpt_codex',
        boundedContext: {
          task: `Independently review the change on head ${shortSha(packet.head_sha)} against the control-task claims; return a structured verdict.`,
          pointers: {
            repo: packet.repo, branch: packet.branch, head_sha: packet.head_sha,
            pr_ref: packet.pr_ref, control_task: packet.control_task_ref,
            checkpoint: packet.checkpoint_ref, ci_evidence: packet.ci_evidence_ref,
          },
          evidence_path: packet.control_task_url ?? null,
          source_event_id: `codex-review:${packet.head_sha}`,
        },
      });
      // Round/budget gate tripped at dispatch → the dispatcher already terminalised.
      if (d.terminated) {
        return { stage: 'review', terminal: this._noticeToOutcome(d.terminated), halted: false, notice: d.terminated };
      }

      const r = await dispatcher.runTurn(d.turn.turn_id);
      if (r.blocked) {
        const terminal = await this.resolveTerminal(runId, LOOP_OUTCOME.BLOCKED,
          `Codex review blocked: ${r.blocker ?? 'fail-closed'}`);
        return { stage: 'review', verdict: null, blocked: true, terminal: LOOP_OUTCOME.BLOCKED, notice: terminal, reviewTurnId: d.turn.turn_id };
      }

      const review = r.result?.structuredResult ?? {};
      const verdict = review.verdict ?? 'comment';
      const findings = Array.isArray(review.findings) ? review.findings : [];
      const summary = review.summary ?? null;

      // Post the DETAILED review to the ClickUp control thread via the durable
      // external-write outbox (idempotent, restart-safe). Never a merge.
      let posted = null;
      if (clickupPoster && typeof clickupPoster.postReview === 'function') {
        try {
          posted = await clickupPoster.postReview({
            taskId: controlTaskId,
            body: composeReviewBody({ run: await store.getRun(runId), packet, verdict, summary, findings }),
            runId,
            turnId: d.turn.turn_id,
          });
        } catch (err) {
          posted = { posted: false, error: String(err?.message ?? err) };
        }
      }
      const fullReviewRef = posted?.commentId
        ? `${packet.control_task_url ?? 'clickup'}#comment-${posted.commentId}`
        : (packet.control_task_url ?? null);

      // verdict `approve` → the run is READY for Warwick's merge. No Larry correction,
      // no Proceed/Hold/Stop card (there is nothing to proceed TO). READY_TO_MERGE
      // never merges — it only surfaces.
      if (verdict === 'approve') {
        const terminal = await this.resolveTerminal(runId, LOOP_OUTCOME.READY_TO_MERGE,
          `Codex approved head ${shortSha(packet.head_sha)}; ready for your review/merge (never auto-merged)`);
        return { stage: 'review', verdict, review, findings, posted, fullReviewRef, halted: false, terminal: LOOP_OUTCOME.READY_TO_MERGE, notice: terminal, reviewTurnId: d.turn.turn_id };
      }

      // request_changes / comment → open the HUMAN GATE and HALT (OI §4a).
      const gate = await dispatcher.reviewGate(runId, {
        verdict, headSha: packet.head_sha, findings, summary, fullReviewRef,
      });
      return {
        stage: 'review', verdict, review, findings, posted, fullReviewRef,
        halted: true, terminal: LOOP_OUTCOME.DECISION_REQUIRED,
        gate: gate.gate, gateToken: gate.gate?.gate_token ?? null, reviewTurnId: d.turn.turn_id,
      };
    },

    /**
     * Step 4 — process ONE `command:decision` event (Warwick's tap). Ingests the event
     * durably (so the seam is exercised end-to-end), routes it through the dispatcher's
     * command drain → the decision handler validates + records the decision on its gate
     * exactly once, applies the single effect, and enqueues the [TOWER] confirm. Returns
     * the decision result (dispatchLarry:true on a recorded Proceed).
     */
    async applyDecisionEvent(eventArgs) {
      // Ingest the durable decision run_event (idempotent on source+source_event_id).
      await store.ingestEvent({
        source: eventArgs.source ?? 'telegram',
        sourceEventId: eventArgs.sourceEventId,
        kind: 'command:decision',
        runId: eventArgs.runId ?? null,
        payload: eventArgs.payload ?? {},
      }, { now: clock() });
      const drain = await dispatcher.drainCommandEvents({ allowlist });
      const decision = drain.results.find((res) => res.kind === 'decision') ?? drain.results[0] ?? null;
      return { drain, decision };
    },

    /**
     * Step 5 — Larry correction turn. ONLY reachable after a durable Proceed: the
     * dispatcher's assertLarryDispatchAllowed (inside dispatchNextTurn) THROWS if the
     * latest gate is not Proceed-decided, so this is structurally gated. Dispatch Larry
     * with the reviewed head + the named corrections, record the signed result, detect
     * the new head SHA (a checkpoint push), persist it, and increment the round budget.
     *
     * Returns { stage:'correction', newHead, priorHead, larryTurnId, progressed } or a
     * terminal on a blocked turn / no-progress.
     */
    async runLarryCorrection(runId, review, packet) {
      const findings = Array.isArray(review?.findings) ? review.findings : [];
      const corrections = findings.map((f) => `${f.id}: ${f.required_correction ?? f.rationale ?? ''}`);
      let d;
      try {
        d = await dispatcher.dispatchNextTurn(runId, {
          expectedResponder: 'larry',
          boundedContext: {
            task: `Apply the named corrections from the Codex review on head ${shortSha(packet.head_sha)}. Corrections: ${corrections.join(' | ') || '(address the review)'}.`,
            pointers: { repo: packet.repo, branch: packet.branch, reviewed_head: packet.head_sha },
            corrections,
            source_event_id: `larry-correction:${packet.head_sha}`,
          },
        });
      } catch (err) {
        // The human gate blocked the dispatch (no Proceed) — this is the STRUCTURAL
        // guarantee firing. Surface it; do NOT force past it.
        return { stage: 'correction', blocked: true, gateBlocked: true, error: String(err?.message ?? err) };
      }
      if (d.terminated) {
        return { stage: 'correction', terminal: this._noticeToOutcome(d.terminated), notice: d.terminated };
      }

      const r = await dispatcher.runTurn(d.turn.turn_id);
      if (r.blocked) {
        const terminal = await this.resolveTerminal(runId, LOOP_OUTCOME.BLOCKED,
          `Larry correction blocked: ${r.blocker ?? 'fail-closed'}`);
        return { stage: 'correction', blocked: true, terminal: LOOP_OUTCOME.BLOCKED, notice: terminal, larryTurnId: d.turn.turn_id };
      }

      // Detect the NEW head SHA (Larry pushed a checkpoint). The loop re-reads the
      // branch head from the collector — it never trusts a self-reported SHA.
      const priorHead = packet.head_sha;
      const newHead = cols?.github?.headSha
        ? await cols.github.headSha({ repo: packet.repo, branch: packet.branch })
        : priorHead;
      const progressed = Boolean(newHead) && newHead !== priorHead;
      if (!progressed) {
        // No new head after a correction → no progress. Escalate rather than doom-loop.
        const terminal = await this.resolveTerminal(runId, LOOP_OUTCOME.BLOCKED,
          `correction produced no new head (still ${shortSha(priorHead)}) — escalating rather than looping`);
        return { stage: 'correction', progressed: false, terminal: LOOP_OUTCOME.BLOCKED, notice: terminal, larryTurnId: d.turn.turn_id };
      }

      await store.setEvidence(runId, { commitSha: newHead }, { now: clock() });
      await store.incrementRound(runId, { now: clock() });
      await enqueueTower(outbox, store, `checkpoint:${shortSha(newHead)}`, runId,
        `run ${shortSha(runId)}: Larry checkpoint — new head ${shortSha(newHead)} (was ${shortSha(priorHead)})`,
        clock());
      return { stage: 'correction', progressed: true, priorHead, newHead, larryTurnId: d.turn.turn_id };
    },

    /**
     * Step 7 — resolve the run to a terminal outcome and emit the single terminal
     * [TOWER] notice. READY_TO_MERGE surfaces the run (awaiting_decision) — it NEVER
     * merges. BLOCKED/TIMED_OUT terminate the run. STOPPED cancels it. FAILED blocks it.
     * Idempotent-ish: a run already terminal is not re-terminated.
     */
    async resolveTerminal(runId, outcome, text = '') {
      switch (outcome) {
        case LOOP_OUTCOME.READY_TO_MERGE:
          return dispatcher.surfaceReady(runId, text || 'ready for your review/merge (never auto-merged)');
        case LOOP_OUTCOME.BLOCKED:
          return dispatcher.terminate(runId, RUN_STATUS.BLOCKED, RUN_OUTCOME.BLOCKED, text);
        case LOOP_OUTCOME.TIMED_OUT:
          return dispatcher.terminate(runId, RUN_STATUS.TIMED_OUT, RUN_OUTCOME.TIMED_OUT, text);
        case LOOP_OUTCOME.STOPPED:
          // A human Stop → cancel the run (safe halt). No merge, ever.
          return dispatcher.terminate(runId, RUN_STATUS.CANCELLED, null, text || 'stopped by Warwick');
        case LOOP_OUTCOME.FAILED:
          return dispatcher.terminate(runId, RUN_STATUS.BLOCKED, RUN_OUTCOME.BLOCKED, `FAILED — ${text}`);
        default:
          throw new Error(`resolveTerminal: unknown outcome ${outcome}`);
      }
    },

    /**
     * Convenience: drive the AUTONOMOUS half of one round — stage evidence, run the
     * Codex review, and (for a change-requesting verdict) HALT at the human gate. This
     * is everything the Tower may do without a human tap. Returns the review result.
     */
    async driveToGate(runId, { checkpointRef = null } = {}) {
      const packet = await this.stageEvidence(runId, { checkpointRef });
      const review = await this.runCodexReview(runId, packet);
      return { packet, review };
    },

    /**
     * Convenience: after a durable Proceed, run the Larry correction and re-review the
     * new head (round N+1). Returns the correction result + the next review (which is
     * itself either a new gate halt, or a terminal). Bounded by maxRounds via the
     * dispatcher's round gate.
     */
    async resumeAfterProceed(runId, review, packet, { checkpointRef = null } = {}) {
      const correction = await this.runLarryCorrection(runId, review, packet);
      if (correction.terminal || correction.blocked) return { correction, nextReview: null };
      // The gate was decided Proceed for the PRIOR head; the new head opens a fresh
      // cycle. Re-stage evidence (new head) and re-review.
      const nextPacket = await this.stageEvidence(runId, { checkpointRef });
      const nextReview = await this.runCodexReview(runId, nextPacket);
      return { correction, nextPacket, nextReview };
    },

    /** Read the run's latest decision gate (durable) — restart-safe recovery helper. */
    async latestGate(runId) {
      if (typeof store.getLatestDecisionGate !== 'function') return null;
      return store.getLatestDecisionGate(runId);
    },

    // Map a dispatcher terminal notice back to a driver LOOP_OUTCOME.
    _noticeToOutcome(notice) {
      switch (notice?.kind) {
        case 'READY': return LOOP_OUTCOME.READY_TO_MERGE;
        case 'BLOCKED': return LOOP_OUTCOME.BLOCKED;
        case 'TIMED_OUT': return LOOP_OUTCOME.TIMED_OUT;
        case 'DECISION_REQUIRED': return LOOP_OUTCOME.DECISION_REQUIRED;
        default: return LOOP_OUTCOME.BLOCKED;
      }
    },
  };

  return driver;
}
