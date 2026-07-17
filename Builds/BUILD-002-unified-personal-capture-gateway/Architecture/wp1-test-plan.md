---
build: BUILD-002
wp: WP1
artifact: wp1-test-plan
status: executed 2026-07-17 — all sections green (see wp1-synthetic-proof-2026-07-17)
author: silas
implemented_by: mack
created: 2026-07-17
execution_map:
  - "§1 U1–U11, U13: services/fusion-capture-gateway/test/webhookHandler.test.js (13 cases + wording-SSOT parity + tap-projection-swallow)"
  - "§1 U12: test/idempotencyParity.test.js + test/fixtures/idempotency-golden-vectors.json (9 pinned vectors ×2 impls + 64-item corpus)"
  - "§2 P1–P12: test/webhookRpc.integration.test.js (isolated DB <db>_wp1)"
  - "§3 E2E-1…E2E-6: test/webhookE2E.integration.test.js (isolated DB <db>_wp1e2e)"
  - "§4 matrix: test/tap-gate-invariant.test.js (store/local paths) + P5/P9 (RPC paths) + 0006 static guards in test/migrations.test.js"
  - "§5 manual bot-B proof: NOT run (optional/gated) — procedure lives in wp1-safe-cutover.md"
  - "§6 CI: existing workflow runs everything (unit no-env + DATABASE_URL job); MIGRATIONS lists extended to 0006; grep-gates in test/tlsTransportGuards.test.js; workflow paths now include supabase/**"
---

# WP1 Test Plan — Cloud Intake Foundation

House rules carried forward from WP0: injected `now` everywhere (no wall-clock
in assertions), no secrets in fixtures, unit suite runs with zero network/DB,
integration suite keys off `DATABASE_URL` (throwaway localhost Postgres, apply
0001→0006 in order), CI enforces the migration static checks. The live bot is
NEVER touched; live proof uses bot B only, and is optional/manual.

## 1. Unit — edge handler + parity (no network, no DB)

Factor the edge function as a pure handler
`handleTelegramWebhook({ method, headers, bodyText }, { rpc, telegram, secret, log })`
so the same code runs under Deno (deployed) and under `node --test` (unit).

| # | Test | Asserts |
|---|---|---|
| U1 | Non-POST | 405; `rpc` never called |
| U2 | Missing/wrong `X-Telegram-Bot-Api-Secret-Token` | 401; constant-time compare used (`timingSafeEqual`-equivalent); `rpc` never called; log line is secret-free |
| U3 | Correct token, malformed JSON body | 200 `{ignored:true}` — never a retry loop on garbage; no rpc call |
| U4 | Unknown update kind (no message/callback_query) | 200 ignored; ledger untouched (no rpc call for 'other' in WP1 — decision: don't ledger noise) |
| U5 | Text message → rpc `fcg_webhook_intake` called once with exact args (channel, update_id, bare-numeric principal, key, capture_id, transport fields) | arg snapshot |
| U6 | rpc outcome `new` → telegram.sendMessage (pending-card copy + keyboard) then rpc `fcg_webhook_card_ref` with the returned message coordinates → 200 | call order |
| U7 | rpc outcome `duplicate`/`existing` with `has_card_ref:false` → card re-sent + card_ref persisted (reconciliation); with `has_card_ref:true` → no send → 200 | both branches |
| U8 | rpc outcome `unauthorised` / `rate_limited` → 200, no card, secret-free log | fail-closed + no retry-spam |
| U9 | rpc throws / DB down → 500 (so Telegram redelivers); nothing else attempted | at-least-once lever |
| U10 | callback_query → rpc `fcg_webhook_confirm_tap`; outcome `queued` → answerCallbackQuery("Saving…") + editMessageText to the honest waiting copy; `already_completed` → "Already saved to your Brain."; `no_op` → "Already in progress…"; `unavailable_action` → show_alert pop-up | wording matches receiptProjection lines verbatim |
| U11 | Card send fails after `new` → handler returns 500 (redelivery-driven card retry) | matches architecture §2 |
| U12 | **Golden-vector parity**: shared fixture file of (text, sender, message_id) → expected `idempotency_key` + `capture_id`, asserted identical by (a) the existing Node `core/idempotency.js` + `deriveCaptureId` and (b) the edge port. Vectors include NFC cases, whitespace runs, emoji, 4096-char text | byte-identical keys — the cross-transport dedup guarantee |
| U13 | Secret-safe logging sweep: run every handler path with a canary secret token/bot token; assert no log line contains either | secret hygiene |

## 2. Integration — real Postgres, migrations 0001→0006 applied

Extends `postgresStore.integration.test.js` harness. All via SET ROLE where
role posture is under test.

| # | Test | Asserts |
|---|---|---|
| P1 | Migration order 0001→0006 applies cleanly twice-guarded objects don't error on re-run of the DO blocks; static migration parser extended: 0006 declares every constraint name it creates | CI-enforceable determinism |
| P2 | EXECUTE matrix: `SET ROLE anon` / `authenticated` → calling each `fcg_webhook_*` raises permission denied; `service_role` succeeds; `has_function_privilege` checked for PUBLIC = false | grant surface |
| P3 | Definer hardening: pg_proc shows `prosecdef=true` and `proconfig` contains `search_path=` for all three; owner = `fcg_rpc_owner` | Vex gate |
| P4 | `fcg_rpc_owner` cannot DELETE from any fcg table, cannot SELECT raw_object/evidence_pointer/channel_poll_offset | least privilege |
| P5 | Allowlist: no identity row → intake returns `unauthorised` AND row counts across envelope/state/idempotency/ledger are unchanged (I10); seeded `is_authorised=false` row → still unauthorised; seeded true row → `new` | cloud-side default-deny |
| P6 | Idempotency under duplicate replays: same (channel, update_id) POST-equivalent RPC call ×5 → 1 envelope, 1 ledger row, outcomes `new,duplicate×4` (I3, I4) | transport dedup |
| P7 | Cross-transport dedup: insert via store.recordIntake (poll path), then RPC with same idempotency_key but new update_id → outcome `existing`, no second envelope, ledger row linked to the existing capture | layer-2 dedup |
| P8 | Rate guard: 20 accepted in 60 s window → 21st returns `rate_limited`, no row; row 22 accepted after window advance (injected timestamps via captured_at + a test clock table? — use direct received_at manipulation with service_role) | durable backpressure |
| P9 | confirm_tap state matrix (I2): accepted→`queued`+state offline_queued; completed→`already_completed`; each of queued/offline_queued/claimed/writing/failed→`no_op` with state untouched; unknown card coords→`not_found`; KeepRaw→`unavailable_action` with state untouched; redelivered same callback update_id→`duplicate_update` | tap-gate cloud twin |
| P10 | card_ref RPC: persists 0005-shaped JSONB; idempotent overwrite; unknown capture → `not_found` | re-target seam |
| P11 | Erasure interplay: delete a webhook-origin capture_envelope → ledger row survives with capture_id NULL; re-sending the same message afterwards creates a genuinely NEW capture (idempotency key freed, but ledger PK still blocks the OLD update_id — assert a NEW update_id flows) | GDPR + redelivery honesty |
| P12 | RLS posture regression: anon/authenticated denied on channel_update_dedup (as on all fcg tables) | deny-by-default stands |

## 3. Synthetic end-to-end proof (no live bot, automated)

Harness: real Postgres (0001→0006), the REAL edge handler run in-process
(Node), a mock Telegram API (records sendMessage/editMessageText/
answerCallbackQuery; returns synthetic message_ids), the REAL worker +
markdownWriter against a sandbox dir, injected clock.

**E2E-1 happy path:** signed synthetic webhook POST (captured real update JSON
shape) → 200 → envelope at `accepted`, `intake_transport='webhook'`, card sent
with pending copy, card_ref persisted → synthetic callback POST (SaveToBrain
tap) → 200, state `offline_queued`, card edited to waiting copy → start worker
→ `drain` → markdown file exists in sandbox with the payload → evidence +
destination recorded → state `completed` → mock Telegram shows the ORIGINAL
card (same message_id) edited to "Completed — saved to your Brain (`…md`)".

**E2E-2 duplicate redelivery, worker asleep:** replay the SAME message POST ×3
before any worker starts → exactly 1 envelope, 1 card (has_card_ref short-
circuits), 3 ledger… 1 ledger row. Then tap ×2 → one `queued`, one dedup/no_op.
Worker drains → exactly ONE markdown file.

**E2E-3 restart + duplicate safety:** accept + tap → worker `processOne` up to
`writing` then kill (throw injected in writer once) → state `failed` with
next_attempt_at → new worker instance (fresh adapter, empty in-memory maps) →
due-retry claim → completes → card re-targeted from durable card_ref → ONE
file. Then redeliver the original message POST → `duplicate`, has_card_ref
true, zero side effects; redeliver the tap → `already_completed` (via a fresh
update_id: `no_op`? — assert per P9 semantics: state completed → confirm
returns `already_completed`).

**E2E-4 card-send failure honesty:** make mock sendMessage fail on first
attempt → handler returns 500 → simulate Telegram redelivery (same update_id)
→ reconciliation sends the card → tap → drain → completed. At no point does
any card/receipt claim completion before evidence exists (assert the full
edit history wording sequence).

**E2E-5 worker waking mid-redelivery:** start the worker drain concurrently
with a burst of duplicate POSTs of an already-tapped capture → final state:
1 envelope, 1 file, 1 completed; no illegal-transition throw escapes (RPC
touches only accepted-state rows; claim uses SKIP LOCKED).

**E2E-6 unauthorised + secret-auth negative:** POST with wrong secret → 401,
DB row counts unchanged; POST with valid secret but stranger sender id → 200,
`unauthorised`, zero rows (I10), no card.

## 4. Tap-gate invariant matrix (extends tap-gate-invariant.test.js)

Assert I1 exhaustively: enumerate every mutation entry point — store.enqueue
without confirmedByTap (throws), worker drain over an `accepted` row (never
claims), recoverMissingCards (re-sends card, never enqueues),
fcg_webhook_confirm_tap with non-callback/unknown action (refuses), direct
`fcg_webhook_intake` (only ever lands `accepted`). The ONLY two green paths
out of `accepted`: local confirmSave, cloud confirm_tap on SaveToBrain.

## 5. Manual live proof (optional, gated, bot B only)

1. Create throwaway bot B; `supabase secrets set` its token + a fresh webhook
   secret; deploy `telegram-intake` with `verify_jwt=false`.
2. `setWebhook(url, secret_token=…)` on bot B ONLY. Verify `getWebhookInfo`.
3. Send one real text message from the authorised account → card → tap →
   waiting copy → start Yoga worker → Completed on the original card;
   markdown lands in the sandbox (NOT the governed Brain until Vex signs the
   WP1 delta).
4. `deleteWebhook` on bot B; retire the bot. The live bot's webhook state is
   asserted UNTOUCHED before and after (`getWebhookInfo` on the live token
   shows no url) — this assertion is part of the manual checklist.

## 6. CI wiring

- Unit + parity vectors: default `npm test` (no env).
- Integration + E2E: `DATABASE_URL`-gated job against throwaway Postgres,
  applying 0001→0006; the existing migrations static-parser test extended to
  0006 (declared constraint names, no `drop` of undeclared names, presence of
  the DO-NOT-WEAKEN block, `search_path=''` on every SECURITY DEFINER).
- Grep-gate (cheap, fast): fail CI if `rejectUnauthorized: false`, a bare
  `sslmode=require` DSN, or an `intake_transport` read inside `src/worker.js`/
  `src/store/*` claim paths ever appears (I8 + Pax Q5 traps).
