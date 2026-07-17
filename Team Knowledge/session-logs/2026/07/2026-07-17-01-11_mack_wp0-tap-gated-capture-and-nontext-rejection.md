---
agent_id: mack
session_id: build-002-wp0-live-integration-tap-gate
timestamp: 2026-07-17T01:11:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# WP0: tap-gated capture + non-text rejection + receipt formatting (working tree only, NOT committed)

Branch `build-002/wp0-live-integration`, service `services/fusion-capture-gateway`. Implemented the two outcomes of the 2026-07-16 live phone test. All changes left uncommitted for Larry's review, per instruction.

## 1. Tap-gated capture (Warwick decision — "Go option B", verbatim requirement: card → HE taps "Save to Brain" → only then the write)

- `intake.accept()` no longer enqueues. Durable commit point unchanged (envelope + idempotency + processing_state row at `recordIntake`; offset advance unchanged). The capture now **holds at `accepted`** — a legal, safe-and-waiting state that is deliberately NOT in `CLAIMABLE_STATES`, so the worker cannot touch it. **Zero store/migration/state-machine changes needed** — that's why I chose the hold-at-`accepted` option over `needs_clarification` (which would have required a claim/release round-trip to reach legally).
- New `intake.confirmSave(captureId)` = the tap path: `accepted → queued` (or `offline_queued` via the confirm-time online check), then the existing saga runs unchanged. Idempotent by state inspection: double-tap → `no_op`, tap after completion → `already_completed`. Unknown id → honest `{ok:false}`.
- `liveRunner.handleCallback` now routes: SaveToBrain → confirmSave + toast; KeepRaw/AskLarry → "Not available in WP0" toast, capture stays pending; unknown callback_data → inert ack.
- Restart-safety proven in tests: pending row + durable `card_ref` (migration 0005, untouched) survive a restart; a post-restart tap resolves via the card_ref reverse lookup and the Completed edit re-targets the ORIGINAL card through a fresh adapter's fallback path.

## 2. Non-text rejection (confirmed live defect: photo → empty capture `50341255-…` falsely completed)

- Seam: `mapTelegramUpdate` (shared by mock + live adapters — one fix, no drift). After the allowlist check, a message with no usable text (photo/voice/document/sticker, or empty/whitespace-only text) returns `unsupported_content_type`. **No envelope, no queue row, no card, no markdown, no completed — ever.** Unauthorised media stays a plain `unauthorised_sender` (no content-type oracle for strangers).
- `liveRunner.handleMessage` answers the authorised sender with a plain `sendMessage` ("Text only in WP0 — photos/voice arrive in a later work package."), no buttons. Offset still advances; a crash between notice and offset-persist can at worst repeat the notice.

## 3. Completed-receipt formatting (Telegram auto-linked the bare `.md` path as a Moldovan URL)

- `statusLineFor(COMPLETED)` wraps the destination path in backticks (inner backticks stripped defensively); `projectCard` sets `parse_mode: 'Markdown'` **only** on the completed card; the live adapter passes `parse_mode` through on send/edit only when the projection set it. Failed/pending cards stay parse-mode-free on purpose — their text can embed arbitrary error strings that must never hit Telegram's Markdown parser.

## Evidence

- Tests: baseline 159 (145 pass / 14 DB-gated skips) → now **173 (159 pass / 14 skips / 0 fail)**. New file `test/tap-gated-capture.test.js` (6 tests) + reworked liveRunner suite incl. the explicit **restart-between-card-and-tap** proof; mapping + live-adapter tests extended.
- `bash scripts/secret-scan.sh` → clean (338 files, 0 secrets).
- No changes to: migrations, credential model, transport, destination resolution, allowlist, masking, stores, worker, states.

## For the next agent

- Worker start command unchanged: `npm run live:proof` from `services/fusion-capture-gateway` (env must carry the required NAMES; refuses fixtures mode).
- WP0-deliberate gaps: KeepRaw/AskLarry are toast-only stubs; untapped cards stay pending forever (no timeout); the non-text notice is best-effort (duplicate possible on crash, benign).
- The DB-gated integration file was updated for the new flow but not executed here (no local Postgres up) — first CI/DB run should watch `liveEndToEnd.integration.test.js`, especially the new offset expectation (9, two updates) in the runner test.
