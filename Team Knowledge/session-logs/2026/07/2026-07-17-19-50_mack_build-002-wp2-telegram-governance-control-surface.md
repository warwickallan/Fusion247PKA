---
agent_id: mack
session_id: build-002-wp2-telegram-governance-control-surface
timestamp: 2026-07-17T19:50:39Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-002 WP2 — Telegram governance control surface

Worktree `C:\Fusion247PKA-b002wp2`, branch
`build-002/wp2-telegram-governance-control-surface` (based on main `6836aa9`,
which merged the fusion-capture-gateway + fcg schema AND the fusion-tower + ftw
schema). Other worktrees untouched. Not pushed.

## What I built

The EXISTING capture worker (its live long-poll `getUpdates` is the sole Telegram
poller) now recognises governance COMMANDS and Warwick's decision-card TAPS and
routes them to the Fusion Tower as durable `ftw.run_event` rows — WITHOUT a second
poller, webhook, or bot change. Additive pre-check only; normal captures are
unchanged.

Seam sits in `src/live/liveRunner.js` `handleUpdate`: before the existing
message/callback capture handlers, `classifyUpdate` decides
`capture | gov_command | gov_decision | ignore`.

New/changed files (all under `services/fusion-capture-gateway`):

- `src/governance/commandGrammar.js` (new) — pure grammar: `/status /trace
  /watch on|milestones|off /pause /resume /stop /approve`, `/gov`|`/run`
  run-start prefix (recognised, not captured; run-start EXECUTION left to the
  Tower as a no-op TODO), and `dec:<gate_token>:<decision>` callback parse.
- `src/governance/detect.js` (new) — the classifier. REUSES the shared
  `authorisePrivateChatSender` gate (allowlist + `isPrivateDirectChat`), auth
  FIRST so a stranger/group never reaches the command parse → returns `capture`,
  no governance oracle.
- `src/store/ftwCommandIntake.js` (new) — thin least-privilege `ftw.run_event`
  writer. In-memory (fixtures) + Postgres backends, same interface + same
  `(source, source_event_id)` dedup. Command → `kind='command:<name>'`,
  `source_event_id='<update_id>'`; decision → `kind='command:decision'`,
  `source_event_id='cb:<callback_query.id>'`; `self_generated=false`; payload =
  pointers/metadata only. Postgres backend REUSES the operational store's
  service_role pool via the new `store.query` seam — no second connection. No
  `pg` import in the module (query is injected), so the unit suite loads it.
- `src/adapters/telegramMapping.js` (edit) — extracted the two-layer auth into
  `authorisePrivateChatSender` and refactored `mapTelegramUpdate` /
  `mapTelegramCallbackQuery` to call it, so capture-auth and gov-detection share
  ONE gate (no duplication). Reason strings + ordering preserved → existing suite
  stays green.
- `src/store/postgresOperationalStore.js` (edit) — added a scoped `query(text,
  params)` passthrough (the ftw-writer reuse seam).
- `src/live/runtime.js` (edit) — selects the ftw writer (pg when live + store has
  `query`, else in-memory) and exposes it on the runtime.
- `src/live/liveRunner.js` (edit) — `handleGovCommand` / `handleGovDecision`,
  `handleUpdate` pre-check, a `gov` counter in the poll summary. Decision taps are
  answered (`answerCallbackQuery`) OUTBOUND ONLY — no extra poll.
- Tests: `test/governanceControlSurface.test.js` (12 hermetic) +
  `test/ftwCommandIntake.integration.test.js` (5 real-PG, skip-gated).
- README: WP2 section incl. the fail-closed decision.

## Fail-closed decision (documented, per the brief)

If a gov event can't be written (no writer, or ftw schema/connection absent so the
insert throws): log a masked structured error, do NOT capture the command as a
note, do NOT silently swallow. Offset still advances — this is the SOLE poller, so
wedging it on a poison command would also starve real captures. Dropping a gov
command with a loud audit is safe; misfiling a `/stop` as a Brain note is not.

## Verification (real counts)

- No-DB unit (`node --test`): **279 pass, 0 fail, 37 skipped** (5 new WP2 unit
  tests among the 279; the 5 ftw-PG tests are the newly skip-gated ones). Existing
  capture-gateway suite stays green.
- Real-PG ftw-insert (`test/ftwCommandIntake.integration.test.js`, throwaway scoop
  PG 17.4 on **port 54343**, BOTH fcg migrations 0001–0006 AND ftw 0001 applied,
  `--test-concurrency=1`): **5 pass, 0 fail**. Proves the insert, dedup, decision
  shape, and least-privilege (no fcg rows).
- Pre-existing DB integration (postgresStore + webhookRpc) against the same
  cluster: **22 pass, 0 fail** — the `store.query` addition regressed nothing.
- Secret scan (`scripts/secret-scan.sh`): **clean — 407 tracked files, 0 secrets**.
- NO second poller: the sole `getUpdates` is untouched; a test asserts exactly one
  `getUpdates` per cycle across a note+command+decision batch. `answerCallbackQuery`
  is outbound-only.

## Proofs captured

- authorised `/status` → ONE `command:status` event, NOT captured, no card, no note.
- normal note → captured as before, NO gov event.
- `dec:<token>:proceed` → `command:decision` event + `answerCallbackQuery` called,
  NOT captured; gate_token/decision/message_id in payload.
- redelivered command (same update_id in one batch) → ONE event (dedup).
- unauthorised sender / `/status` in a group → neither captured nor gov-routed,
  zero response (no disclosure).

## Handoff

Wire status: **connected (fixtures + real-PG proven), not pushed.** The Tower
(WP1) consumes `ftw.run_event` and owns execution + governance replies — WP2 only
detects + writes. If the ftw schema is ever un-applied in a live env, governance
commands fail closed (masked log, dropped-with-audit) rather than being captured.
Next: a live apply of ftw 0001 is Larry-gated (design-artifact-only today).
