---
agent_id: mack
session_id: build-010-wp1-governance-loop-driver
timestamp: 2026-07-17T20:15:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-010 WP1 CAPSTONE — the autonomous governance LOOP DRIVER (ties every component together)

Worktree `C:\Fusion247PKA-b010wp1` only, branch `build-010/wp1-reliable-autonomous-governance-loop`
(from HEAD e6685fe). Not pushed. Builds directly on the human-decision-gate work
([[2026-07-17-19-20_mack_build-010-wp1-human-decision-gate]]).

## What I built — the capstone that drives ONE run through its full lifecycle

`services/fusion-tower/src/loopDriver.js` — the orchestration layer. It REUSES (never
rebuilds) the dispatcher, decision gate, codex/larry adapters, the durable Telegram
notification outbox, and the durable ClickUp external-write outbox. Exports:

- `startGovernanceRun(store, spec, {now, outbox})` — run-start: durable `governance_run`
  (created→active, scope-lock from repo/branch, round budget, evidence head SHA) + a
  `[TOWER]` "run created" notification. This is the run-start path a `/gov start …` or a
  Telegram run-start maps to.
- `assembleRunPacket({run, collectors, checkpointRef})` — the bounded evidence POINTERS
  bound to the EXACT head SHA (repo/branch/head, control task ref, checkpoint ref, staged
  CI evidence ref). A new head SHA invalidates a prior review. GitHub + ClickUp read
  collectors are injectable (`createStubCollectors`); real impls are least-privilege reads.
- `createLoopDriver({store, dispatcher, config, outbox, collectors, clickupPoster, …})` —
  the driver with granular stage methods: `startRun`, `stageEvidence`, `runCodexReview`
  (posts the detailed review to ClickUp via the durable outbox, then `dispatcher.reviewGate`
  → `[CODEX]` card + gate opens + HALT; `approve` → READY_TO_MERGE with no gate),
  `applyDecisionEvent` (ingest durable `command:decision` → drain → decision handler),
  `runLarryCorrection` (gated by `assertLarryDispatchAllowed`; re-reads the branch head to
  detect the new SHA; increments the round), `resolveTerminal`, plus convenience wrappers
  `driveToGate` and `resumeAfterProceed`.

Terminal vocabulary `LOOP_OUTCOME`: `READY_TO_MERGE | BLOCKED | DECISION_REQUIRED |
TIMED_OUT | STOPPED | FAILED`. READY_TO_MERGE NEVER merges — it only surfaces the run for
Warwick (merge stays human-only).

## Key design decisions

- **`approve` short-circuits the Proceed/Hold/Stop card.** A first- or re-review `approve`
  has nothing to "proceed to" (no Larry correction), so it resolves READY_TO_MERGE directly
  — itself a human gate (Warwick merges). Only `request_changes`/`comment` open the
  Proceed/Hold/Stop gate and halt. Documented in the driver + transcript.
- **The loop re-reads the branch head from the collector after a Larry correction** rather
  than trusting a self-reported SHA — "Tower detects the new head". No new head after a
  correction ⇒ escalate BLOCKED (no doom-loop).
- **Round accounting:** one correction consumes one round (`incrementRound` after Larry's
  new head). `maxRounds=2` ⇒ up to 2 correction rounds; the (N+1)th review dispatch trips
  `roundBudgetOk` inside `dispatchNextTurn` and terminalises BLOCKED — the escalation path,
  not a doom-loop.
- **`evidence_refs` is an ARRAY of labelled pointer strings** (checkpoint/ci/clickup) —
  the shape both stores clone/serialise identically (the memoryStore clones it via spread).

## Synthetic E2E proof — `scripts/proof-governance-loop.js`

Real PostgresStore (migrations 0001→0006), fakes for Codex/Larry/Telegram/GitHub/ClickUp.
Drives: run-start → evidence → Codex review (request_changes) → `[CODEX]` card + gate +
HALT (asserts NO Larry dispatch while pending) → **MID-RUN RESTART** (close pool, recreate
store/dispatcher/driver, recover run+gate from durable rows) → stale-head tap rejected →
inject Proceed → Larry correction (new head) → Codex re-review (approve) → terminal
READY_TO_MERGE → ONE terminal notification. Verdict `passed: true`; all six invariants
green (no autonomous merge; no live writes; human gate honoured; notifications deduped;
durable after restart; single terminal notice). Masked transcript at
`Builds/BUILD-010-fusion-tower/Architecture/governance-loop-synthetic-proof.md` — no secret
value leaks (masked config snapshot confirms).

## Verification (real counts)

- **No-DB `node --test`:** 300 tests, 247 pass, 53 skipped (DB/live-gated), 0 fail — incl.
  the 12 new `test/loopDriver.test.js` unit tests.
- **Real-PG (throwaway scoop cluster, port 54344, `--test-concurrency=1`, chain 0001→0006):**
  302 tests, 301 pass, 1 skipped (live Telegram send — needs a real bot token), 0 fail. The
  2 new DB-gated E2E tests (`test/loopDriver.integration.test.js`) incl. the mid-run restart
  recovery pass. The proof script `passed: true`.
- **Secret scan:** clean — 425 tracked files, 0 secret values.

## What remains GATED for a LIVE run (next, Warwick-gated)

1. Live `ftw` migration apply (0006 → the same Supabase project, `ftw` schema) — NOT applied
   here (no live Supabase apply this WP).
2. Real Codex/Larry credentials are already proven live (WP0 step 6b / no-relay ack); the
   loop driver just swaps the fakes for the real adapters — no code change, `mode:'auto'`.
3. Running the Tower foreground under Buggly (the authenticated interactive user) so the
   Codex OAuth session + Telegram bot token resolve; then a real `/gov start` drives a live
   round with Warwick tapping the actual `[CODEX]` card.

Next agent: the loop driver is the assembly point — a live run only needs the migration
applied + the real adapters wired into `createTowerRuntime` and the driver invoked from the
tick (currently the tick leaves the concrete advance to higher-level logic; the driver is
that logic).
