---
agent_id: mack
session_id: build-002-wp0-live-integration-nat-resilience
timestamp: 2026-07-17T00:28:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-002 WP0 — NAT kill-window resilience + card-send recovery + pop-up callback answers

I hardened the live Telegram runner against a real environmental failure Larry's monitoring caught on Warwick's home network, and fixed a live UX defect. Branch `build-002/wp0-live-integration`, service `services/fusion-capture-gateway`, working tree only — **nothing committed** per brief.

## The live finding (durable knowledge — this WILL recur on consumer networks)

Warwick's consumer router/NAT silently kills any TCP connection held open ≥~45s. Consequences observed live:

1. Every empty `getUpdates` long-poll died at ~45s with `fetch failed` — metronomic, 6+ observed.
2. The poisoned undici keep-alive socket then failed the NEXT Bot API call too (`handle_update_failed`, update 9724165): the message "Test new" was durably captured (`accepted`, capture `85c16de0-ea63-5ae5-b429-27504b63ea0c`) but the card send died — `card_ref` null, no card to tap, no recovery path for a failed INITIAL card send.
3. Fresh short-lived node processes succeeded 5/5 — fresh sockets, so DNS/TLS/443 were never the problem.

## What I changed (no new deps, no migrations)

- `src/live/liveRunner.js` — named `POLL_WAIT_SECONDS = 25` constant (safely under the ~45s kill window) with the live finding recorded; added a bounded per-cycle **card-send recovery sweep** (`accepted` + no `card_ref`, 3 most-recent per cycle, `card_ref` persisted on success, worst case one duplicate card if the original response was lost — commented); KeepRaw/AskLarry callback answers now pass `showAlert: true`.
- `src/adapters/telegramLiveAdapter.js` — `callApi` retries **once** (~250ms, injectable) on transient network rejections only (`fetch failed`/ECONNRESET/socket errors via the undici `cause` chain; never on parsed HTTP-level errors) — the retry draws a fresh socket because undici discards the dead one; `getUpdates` default wait is now the named 25s constant; `answerCallbackQuery` gained the `showAlert` option (`show_alert: true` = dismissable pop-up; plain toasts are invisible in practice on the phone — second live finding).
- `src/adapters/telegramAdapter.js` (mock) — `answerCallbackQuery` records `showAlert` for parity.
- `test/network-resilience.test.js` (new, 9 tests) + extensions to `test/telegramLiveAdapter.test.js` and `test/liveRunner.test.js`.

Suite: 183 tests, 169 pass, 14 skipped (env-gated live integration), 0 fail. Secret scan clean (tracked); untracked test files pattern-scanned clean manually.

## Addendum (same session, ~01:50): the "tap-gate bypass" was a timestamp illusion — gate now store-enforced anyway

Larry reported capture 85c16de0 auto-claimed "2ms after start, before its recovery card", hypothesising a legacy startup-recovery rule that re-queues `accepted` rows. **Verified: no such rule exists** — not in the working tree, not in HEAD (the pre-tap auto-enqueue lived inside `intake.accept()` and was removed with the tap-gate change), not in migrations, not in either store's claim. Only ONE worker process exists (PID 23844, started 01:26:31). The real cause: `pollOnce` computed a single `now` at cycle start and stamped it into EVERY store write of the cycle — so a capture whose recovered card went out at +0.6s and was tapped seconds later still carried `claimed_at ≈ start+2ms` in the DB, reading as "completed before the card existed". The recovery sweep runs BEFORE any drain in the cycle, and the only resolver to that capture is its NEW card's message_id — so in real time the card was sent, tappable, and (evidently) tapped. No breach; the row/file stay as-is per Larry.

Hardening shipped regardless:

- `src/store/operationalStore.js` + `src/store/postgresOperationalStore.js` — `enqueue()` is now fail-closed without an explicit `confirmedByTap: true` acknowledgement; `src/intake.js` `confirmSave()` is the sole caller that passes it. Any future "unstick accepted rows" helper throws instead of bypassing the gate.
- `src/live/liveRunner.js` — per-step `stepNow()` timestamps (deterministic under injected now/fixed clocks) so durable timestamps tell the true order; this forensic illusion cannot recur.
- `test/tap-gate-invariant.test.js` (new, 2 tests) — restart + 6 idle cycles + lease-scale time jumps: accepted rows with AND without card_ref stay `accepted`, cardless one gets its recovered card, zero markdown; plus the enqueue fail-closed unit. 24 direct `enqueue` fixture call sites updated to carry the acknowledgement.

Suite after addendum: 185 tests, 171 pass, 14 env-gated skips, 0 fail. Scan clean. **The running worker (PID 23844) predates the gate/timestamp fixes — Warwick should restart it (same command) when convenient.**

## What the next agent should know

- Worker start command unchanged: `node --env-file=C:\.fusion247\fusion-capture-gateway.env src\live\liveRunner.js`. On restart, the recovery sweep runs at the TOP of the first poll cycle, so Warwick's waiting "Test new" capture gets its card immediately.
- The secret scanner only reads **tracked** files — untracked new test files must be scanned manually (or after `git add`) before relying on "scan clean".
- Rule of thumb graduated from this: on consumer networks, keep any held-open connection under ~40s and always pair pooled keep-alive HTTP with a one-shot transient retry.
