---
agent_id: mack
session_id: build-010-wp1-telegram-notifier-drainer
timestamp: 2026-07-17T16:30:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-010 WP1 — durable OUTBOUND Telegram notifier + drainer

Worktree `C:\Fusion247PKA-b010wp1`, branch `build-010/wp1-reliable-autonomous-governance-loop`
(HEAD was `bfa8e75`). Wired the durable notifier on top of Silas's notification outbox
(migration `0004_wp1_notification_outbox.sql` + the `enqueueNotification` / `markNotificationSent`
/ `markNotificationFailed` / `markNotificationSuperseded` / `claimPendingNotifications` /
`getNotification` store methods). Not pushed — Larry pushes.

## What I built

- `src/adapters/telegramNotifier.js` — durable, retry-safe OUTBOUND notifier.
  - `enqueue(store, {runId, logicalSource, purpose, body})` — app-side secret-scan
    (reuses `scanForSecrets` from `clickupPoster.js`) → `dedupKey = sha256(runId|purpose|recipient|logicalSource)`
    → `enqueueNotification`. NO send. Refuses a token-shaped body before enqueue (belt;
    the DB `notification_outbox_body_no_token_chk` is the suspenders).
  - `notify(store, spec, {now})` — enqueue + optimistic immediate `drainOnce` (an outage
    never blocks or loses).
  - `drainOnce(store, telegramClient, {limit})` — `claimPendingNotifications` → wire text
    `[<logical_source>] <body>` → `sendMessage`; success → `markNotificationSent(dedupKey, message_id)`;
    transient failure → LEAVE the row `pending` (the schema's retriable queue — only `pending`
    is claimed) so a later drain re-sends; bounded give-up → `markNotificationFailed` after
    `maxAttempts` (poison guard). Never throws out of the loop. Returns `{sent, failed, retriable}`.
  - `createTelegramClient({config})` — OUTBOUND `sendMessage` ONLY. Reads `TELEGRAM_BOT_TOKEN` +
    `AUTHORISED_TELEGRAM_USER_ID` by env NAME. Token travels ONLY in the request URL, is
    NEVER logged, and every error path is `scrubToken`'d.

- Dispatcher wiring (`src/dispatcher.js`) — a non-throwing `enqueueMilestone(...)` fires a
  durable, deduped enqueue at each state transition: `run_created`; `turn_dispatched_<n>`
  (expected-responder change); `codex_review_start/complete` (CODEX); `larry_turn_start/complete`
  (LARRY); `ci_green/ci_red/ci_pending` (CI, from github check events in `ingestAndBind`);
  `retry_blocked_<n>` (watchdog, rounds/budget exhausted); `decision_required`; and the
  terminal `terminal_ready/blocked/timed_out/stopped/failed` (in `emitTerminal`). Enqueue is
  the ONLY dispatcher-side action; the drainer sends, so a Telegram outage never blocks the loop.

- `src/tower.js` — constructs `createTelegramNotifier`, passes it to the dispatcher, and drains
  it inside the EXISTING `tick()` (gated on `outbox.ready`). No new loop/process started.

## Reliability posture (the important bit)

The schema's `pending` is the retriable queue; `failed` is a terminal give-up. A transient send
failure must therefore leave the row `pending` (re-claimable) to be no-loss — that is what the
retry-safe test proves. `markNotificationFailed` is used only for the bounded poison-pill give-up.
This is the one place the WP1 brief's phrasing ("markNotificationFailed on transient failure,
stays claimable") had to be read against the store Silas shipped, where `failed` is excluded from
`claimPendingNotifications`. I favoured the migration's own stated fix ("a transient failure stays
retriable") and the test contract.

## Verification (real counts)

- No-DB `node --test`: 211 tests, **179 pass, 32 skip (gated pg + LIVE), 0 fail**.
- Real Postgres (throwaway scoop cluster, port **54339**, `--test-concurrency=1`, chain
  0001→0004): migrations + integration = **64 pass, 0 fail**; FULL suite with DB =
  **210 pass, 1 skip (LIVE gated), 0 fail**. Cluster torn down after.
- Secret scan (`scripts/secret-scan.sh`): **clean, 0 hits** across 411 tracked files (fake
  token shapes in the test are assembled at runtime so no source line matches the scanner).

## Guarantees confirmed

- OUTBOUND ONLY — the only Telegram endpoint is `sendMessage`; `getUpdates` appears only in
  "do NOT" comments. No second inbound poller (would 409 with BUILD-002's capture worker).
- No token in any log, error, body, or `last_error`; token only in the request URL, always scrubbed.
- No webhook/BotFather change; no live Supabase apply; no polling loop/long-running process started.

## For the next agent

The LIVE test (`test/telegramNotifier.test.js`, `LIVE (gated)`) sends ONE real message and asserts
`ok + message_id` — it skips unless `TELEGRAM_BOT_TOKEN` + `AUTHORISED_TELEGRAM_USER_ID` are set,
so CI stays portable. To smoke-test live delivery, export both and run that file.
