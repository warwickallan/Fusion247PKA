---
agent_id: mack
session_id: build-010-wp1-command-router
timestamp: 2026-07-17T18:45:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-010 WP1 — Tower-side governance command handlers

Worktree `C:\Fusion247PKA-b010wp1` only, branch `build-010/wp1-reliable-autonomous-governance-loop` (from HEAD 854963a). Did NOT touch other worktrees. Did NOT push.

## What I built
- `services/fusion-tower/src/core/commandRouter.js` — pure, non-throwing router. `handleCommandEvent(store, notifier, event, { now, allowlist })` parses the `command:*` run_event, re-authenticates `sender_id` against the allowlist (defence-in-depth; unauthorised = silent default-deny, zero reply, zero mutation, audited via the durable run_event), resolves the ACTIVE run (explicit id in args, else most-recent non-terminal), executes, and replies by ENQUEUEING a durable `[TOWER]` outbox notification. Reply purpose embeds `source_event_id` so distinct commands reply distinctly while a redelivered update collides on the dedup key (enqueue-once). Exports: `handleCommandEvent`, `parseCommandEvent`, `isAuthorisedSender`, `resolveActiveRun`, `formatStatus`, `formatTrace`, `GOVERNANCE_COMMANDS`.
- Dispatcher wiring: `dispatcher.drainCommandEvents({ allowlist, limit })` claims unprocessed non-self `command:*` events, routes each to the router (using the bound outbox as reply notifier), then `markEventProcessed` (advance-once, handle-then-mark = at-least-once + idempotent). Separate from the normal advance path — a command never advances a turn loop and a turn event never reaches the router. Wired into `tower.js` tick as step 2b (before the outbox drain, so a reply enqueued this tick goes out this tick). Non-throwing.

## Seven command behaviours
- `/status` → `getRunStatus` → full contract shape (run id · build/WP · state · expected responder · round/max · branch+head SHA · last event · current/next action · outstanding gate · GitHub+ClickUp links · last notification state).
- `/trace` → `recentRunEvents(id,10)` → compact newest-first `ts · actor · kind` lines + ClickUp detail link (never a giant dump).
- `/watch on|milestones|off` → maps to `all|milestones|terminal` via `setRunWatchLevel`; bogus arg = usage, no mutation.
- `/pause` → `setRunPaused(true)`; `/resume` → `setRunPaused(false)`.
- `/stop` → `requestRunStop` → "halt safely at the next atomic boundary".
- `/approve` → ONLY resolves a run in `awaiting_decision` + `decision_required`; advances the gate (`awaiting_decision → active`, `decision_required=false`) via `setRunStatus`. NEVER a merge — no merge/push/external-write path exists in the module. Nothing pending → "nothing pending; no merge performed".
- unknown/malformed → brief help reply.

## Verification (real counts)
- No-DB `node --test`: 261 tests, 216 pass, 45 skipped (DB-gated + 1 live-Telegram), 0 fail.
- Real-Postgres (throwaway scoop cluster, port 54341, socket dir `C:/pgs54341/sock`, `--test-concurrency=1`, chain 0001→0005): full suite 261 tests, 260 pass, 1 skipped (live-Telegram send), 0 fail. Command-router integration file alone: 9/9 pass. Cluster torn down after.
- Secret scan: clean — 413 tracked files, 0 secrets.

## Hard-boundary proofs
- Outbound-only: replies are outbox ENQUEUEs; nothing sent inline; no getUpdates/poll added.
- No autonomous merge: `/approve` only flips the decision gate; integration IPG-6 asserts `ftw.external_write` count = 0 after approve; unit test asserts `result.merge===false` and `merge`/`merge_pr` ∈ FORBIDDEN_ACTIONS.
- Auth reject: unauthorised sender → zero reply row, zero mutation, `audited=true`.
- Idempotency: redelivered update → one mutation-effect + one reply row (dedup at intake + reply dedup key).

## Next
Commits on the WP1 branch (not pushed). WP2 (BUILD-002) writes the `command:*` events; this router consumes them. A run-start command handler is still owned by the loop's run-start path, not this router.
