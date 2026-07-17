---
build: BUILD-002
wp: WP1
artifact: wp1-architecture-decision
status: design-of-record — implemented (branch build-002/wp1-cloud-intake-foundation)
author: silas
implemented_by: mack
created: 2026-07-17
implemented: 2026-07-17
inputs:
  - Pax WP1 research brief (retrieved 2026-07-17)
  - services/fusion-capture-gateway/migrations/0001-0005 (merged WP0 main)
  - Builds/BUILD-002-.../Contracts/capture-contract-pack-v1.md
  - Builds/BUILD-002-.../Architecture/supabase-operational-foundation-boundary.md
implementation:
  - services/fusion-capture-gateway/migrations/0006_wp1_cloud_intake_rpcs.sql
  - supabase/functions/fcg-webhook-intake/ (index.ts shell + handler.js/derive.js pure modules)
  - supabase/config.toml (verify_jwt = false)
---

# WP1 Architecture Decision — Always-On Cloud Intake Foundation

## 0. Decision summary

Adopt Pax's recommended shape unmodified at the transport layer, and make the
**database the sole authority for every trust decision**:

```
Telegram (bot B / synthetic replays only; live bot STAYS on long polling)
   │  POST update JSON + X-Telegram-Bot-Api-Secret-Token
   ▼
Supabase Edge Function `telegram-intake`  (verify_jwt = false)
   │  1. reject non-POST (405)
   │  2. constant-time secret-token compare (timingSafeEqual) → 401, no DB touch
   │  3. parse update; malformed/unknown kind → 200 {ignored} (never retry-spam)
   │  4. ONE RPC call per update (service_role credential, supabase.rpc())
   ▼
SECURITY DEFINER RPCs in `public` (search_path='', EXECUTE = service_role only)
   │  fcg_webhook_intake   — dedup + allowlist + envelope insert at `accepted`
   │  fcg_webhook_confirm_tap — tap callback → accepted → offline_queued
   │  fcg_webhook_card_ref — persist the card target after the edge sends the card
   ▼
fcg.* rows (schema stays NON-exposed; RLS deny-by-default unchanged)
   │
   ├─► Edge function sends/edits the Telegram card (see §2) — honest
   │   tap-gate / queued-offline wording; card_ref persisted via RPC
   ▼
Local Yoga worker on wake — EXISTING claim loop, zero claim-loop changes
   (offline_queued is already claimable) → governed Markdown write →
   evidence → completed → card edited to "Completed" from durable card_ref
```

Three dedup layers, each already partially in place, now explicit:

| Layer | Key | Where | Catches |
|---|---|---|---|
| Transport | `(channel, update_id)` — new `fcg.channel_update_dedup` ledger | RPC, first statement | Telegram at-least-once webhook redelivery (incl. callback taps) |
| Capture | `idempotency_key` (unchanged WP0 construction) | `fcg.idempotency_key` PK | Same logical message via ANY transport (poll ↔ webhook crossover) |
| Write | evidence-pointer / destination check | worker + store | Re-processing an already-written capture |

## 1. Why one RPC per update (not raw SQL from Deno)

Per Pax Q3(c): the edge environment holds **no Postgres password** — only the
auto-injected service credential. `fcg` never enters the exposed-schemas list.
The entire cloud attack surface is three named, typed, audited functions whose
EXECUTE is revoked from PUBLIC/anon/authenticated. Crucially, the **numeric
allowlist is enforced INSIDE the RPC against `fcg.channel_identity`** — so even
a caller who somehow obtains service-level RPC access cannot insert a capture
for an unauthorised sender. Default-deny holds cloud-side even if edge auth is
bypassed. The edge function's env-level allowlist check (optional) is defence
in depth only, never the authority.

## 2. Card projection from the cloud (who sends the card, and how re-targeting survives)

**The edge function sends the card.** The Yoga may be asleep; silence is
forbidden. Sequence for a new text message:

1. `fcg_webhook_intake` returns `{outcome:'new', capture_id}` — the capture is
   durably committed at `accepted` (tap-gate hold, exactly like local intake).
2. Edge calls Telegram `sendMessage` with the WP0 pending-card copy —
   *"Received — safe and saved. Tap "Save to Brain" to write it to your Brain."*
   — and the same inline keyboard (SaveToBrain / KeepRaw / AskLarry).
3. Edge calls `fcg_webhook_card_ref(capture_id, chat_id, message_id)` →
   persists `processing_state.card_ref` (same JSONB shape WP0 migration 0005
   established). **This is how the waking worker re-targets:** the worker's
   completion projection already reads `card_ref` from durable state
   (worker.js `cardModelFor`) — no worker change needed.
4. Edge returns 200.

**If the card send (step 2) or card_ref persist (step 3) fails:** the edge
returns **500 without a ledger-consumed success**, so Telegram redelivers the
same `update_id`. On redelivery `fcg_webhook_intake` hits the ledger conflict
and returns `{outcome:'duplicate', capture_id, has_card_ref:false}` — the edge
then **reconciles**: re-sends the card and persists card_ref. Telegram's own
retry queue is thus the card-delivery retry loop. Corner case (send succeeded
but the HTTP response to us was lost): one extra card may appear; the orphan
card has no card_ref so a tap on it answers "No capture found" — the same
SAFE-IF-DUPLICATE trade WP0's `recoverMissingCards` already accepted. The
worker-side `recoverMissingCards` sweep remains the wake-time backstop for any
capture that is `accepted` with `card_ref` null.

**Tap callback (both modes — binding constraint):**
- *Webhook mode (bot B / synthetic):* the `callback_query` update arrives at
  the edge. Edge calls `fcg_webhook_confirm_tap`. On `outcome:'queued'` the
  edge (a) answers the callback ("Saving to your Brain…"), (b) edits the card
  to the honest waiting copy — *"Saved and safe — waiting to be written to
  your Brain."* (the existing `statusLineFor` queued/offline wording; never a
  completion claim). The capture lands in **`offline_queued`** — the cloud
  cannot verify Yoga liveness, so it always uses the offline-honest state;
  `offline_queued` is already claimable, so a live worker picks it up within
  one poll cycle anyway.
- *Poll mode (live bot, unchanged):* the callback arrives via `getUpdates` and
  the existing `liveRunner.handleCallback → intake.confirmSave` path runs.
  Nothing in WP1 modifies this path.

**Tap-gate invariant preserved:** WP0's fail-closed `confirmedByTap` token
remains the only local-code path from `accepted` to a queue state.
`fcg_webhook_confirm_tap` is its cloud twin and is equally fail-closed: it
transitions ONLY when (a) the caller is service_role, (b) the sender passes
the in-DB allowlist, (c) the update is a genuine `callback_query` recorded in
the dedup ledger, (d) `p_action = 'SaveToBrain'`, and (e) the capture is in
`accepted`. No sweep, drain, or recovery path may call it. The test plan
asserts the full "no other path enqueues" matrix (wp1-test-plan.md §4).

## 3. Intake RPC semantics (normative for Mack)

`fcg_webhook_intake`, in order, single transaction:

1. **Allowlist (before ANY write):** sender's numeric principal must match an
   `fcg.channel_identity` row with `channel='telegram' AND is_authorised`.
   Unauthorised → `{outcome:'unauthorised'}`, **zero rows written — not even a
   ledger row** (no stranger PII retained; edge returns 200 so Telegram does
   not retry-spam; edge logs a secret-free counter only).
2. **Backpressure guard (F-04 cloud twin):** ≤ 20 accepted captures per sender
   per rolling 60 s (count on `capture_envelope`); excess →
   `{outcome:'rate_limited'}`, no envelope, 200 at the edge (durable,
   isolate-safe — no in-memory token bucket to lose).
3. **Transport dedup:** `INSERT INTO fcg.channel_update_dedup ... ON CONFLICT
   DO NOTHING`; conflict → `{outcome:'duplicate', capture_id, has_card_ref}`.
4. **Capture dedup (cross-transport):** existing `idempotency_key` → link the
   ledger row to that capture, return `{outcome:'existing', capture_id,
   has_card_ref}` (edge reconciles card if missing).
5. **New capture:** insert `capture_envelope` (with `intake_transport =
   'webhook'`) + `processing_state` at `accepted` + `idempotency_key` + stamp
   ledger `capture_id`. Return `{outcome:'new', capture_id}`.

The edge computes `idempotency_key` and `capture_id` with **byte-identical
ports** of `core/idempotency.js` (NFC + whitespace-collapse + sha256) and
`telegramMapping.deriveCaptureId` (v5-style UUID). Golden-vector parity tests
are mandatory (wp1-test-plan.md §1) — this is what makes poll↔webhook
crossover dedup real, not aspirational.

## 4. Failure matrix — what actually happens, what the user sees

| Failure | Mechanics | What Warwick sees (honest) |
|---|---|---|
| **Edge function down / Supabase outage** | Telegram gets non-2xx/timeouts, holds the update in its per-bot queue (`pending_update_count`) and retries — at-least-once. Exact retry schedule is officially unpublished (Pax Q1 flag); design assumes only at-least-once. | Nothing, until the edge returns — then the card arrives late. Never a false receipt; worst case is delayed silence during the outage window. Monitor `getWebhookInfo.last_error_message`. |
| **DB down at intake** | RPC call fails → edge returns 500 → no ledger row, no envelope → Telegram redelivers later. | Same as above: no card until the DB is back, then the flow completes normally. No lost capture (it lives in Telegram's queue), no false "saved". |
| **Duplicate `update_id` redelivery** | Ledger conflict → `duplicate` outcome → edge reconciles (re-sends card only if `card_ref` is null) → 200. | Nothing, or (lost-response corner case) one extra card whose tap answers "No capture found". Never a duplicate envelope, never a duplicate Markdown note. |
| **Same message via poll AND webhook** (rollback-window crossover) | Different `update_id` streams but identical `idempotency_key` → layer-2 dedup returns the existing capture; poll path's `isNew=false` sends no second card. | One card, one capture, one note. |
| **Tap callback for a capture the Yoga already completed** | `fcg_webhook_confirm_tap` state-inspects → `already_completed` → no transition. | Callback answer: "Already saved to your Brain." Card keeps its Completed text. |
| **Double-tap / tap redelivery** | First tap: `accepted → offline_queued`. Second: state is no longer `accepted` → `no_op` (ledger also dedups the redelivered callback update). | One "Saving…" answer; subsequent taps get "Already in progress — nothing to do." One write, ever. |
| **Worker waking mid-redelivery** | Worker claims via `FOR UPDATE SKIP LOCKED`; the RPC touches only `accepted`-state rows and the ledger — disjoint from claimed rows. Cross-layer worst case is a concurrent duplicate intake attempt, which loses at the idempotency PK. | Normal completion. Card goes straight from "waiting" to "Completed". |
| **Worker crash mid-claim** | Unchanged WP0: lease expiry auto-releases; idempotent write + evidence check prevents a double note. | A delay, then "Completed". |
| **Edge card-send fails after durable intake** | 500 → Telegram redelivers → reconcile path re-sends. Backstop: worker-wake `recoverMissingCards`. | Card arrives on the next Telegram retry (seconds-to-minutes), or at latest on Yoga wake. Capture was durable the whole time. |
| **Retry exhaustion at the worker** | Unchanged WP0: `failed` → bounded retries → `dead_letter` at `MAX_DELIVERY_ATTEMPTS`. | Honest failed-card wording ("safe and will be retried"), then parked for operator attention. Never silent, never falsely complete. |

## 5. What explicitly does NOT change in WP1

- The live production bot stays on long polling; `setWebhook` is never called
  on it. Proof = synthetic signed replays + throwaway bot B (Pax Q2).
- The worker claim loop, state machine, retry policy, lease semantics,
  markdown writer, evidence gating, erasure path: untouched.
- `channel_poll_offset`: untouched (webhook mode doesn't use it; the monotonic
  guard + idempotency layers make a later rollback-to-polling safe).
- RLS posture: `fcg` non-exposed, deny-by-default, anon/authenticated get
  nothing anywhere. Migration 0006 only ADDS narrower principals (see draft).
- Supabase Queues / pg_cron: rejected at this scale (Pax Q6) — Telegram's
  retry queue + the intake table ARE the buffer.

## 6. Deployment notes (for Mack, non-schema)

- `verify_jwt = false` for `telegram-intake` in `config.toml`; compensating
  auth = constant-time `X-Telegram-Bot-Api-Secret-Token` check (Pax Q1.6).
- Secrets via `supabase secrets set`: `TELEGRAM_WEBHOOK_SECRET`,
  `TELEGRAM_BOT_TOKEN` (bot B's token, NOT the live bot's). Service credential
  comes from the auto-injected env (parse `SUPABASE_SECRET_KEYS` or legacy
  `SUPABASE_SERVICE_ROLE_KEY`). Config names already reserved in
  `src/config.js` — no new names needed on the worker side.
- Allowlist seed (deploy-time, service_role, NEVER in a migration — the
  numeric id is personal data): one row
  `{identity_ref:'telegram:user:<id>', channel:'telegram',
  channel_principal_ref:'<numeric id>', is_authorised:true}`.
  Using `identity_ref = 'telegram:user:<id>'` makes the poll path's existing
  `ON CONFLICT (identity_ref) DO NOTHING` upsert a no-op against the seed.
  **Anomaly flagged:** `postgresOperationalStore.recordIntake` currently falls
  back to `channel_principal_ref = sender_identity_ref`
  (`'telegram:user:<id>'`, not the bare numeric). The RPC allowlist matches on
  the bare numeric `channel_principal_ref`; the seed satisfies it. Mack should
  pass the bare numeric as `channel_principal_ref` from the poll path too when
  convenient — cosmetic consistency, not a WP1 blocker.
- Never `drop_pending_updates=true` on any production-adjacent bot; bot B
  teardown = `deleteWebhook` then discard the bot.

## 7. Build addendum (Mack, 2026-07-17) — deviations from this design as drafted

Implementation proved the design sound end-to-end (synthetic proof:
[[wp1-synthetic-proof-2026-07-17]]). Deviations, each deliberate and tested:

1. **Function slug.** Deployed as `fcg-webhook-intake` (Warwick's WP1 build
   order names the path `supabase/functions/fcg-webhook-intake/`), not the
   `telegram-intake` placeholder used in §0/§6 above. `supabase/config.toml`
   carries `[functions.fcg-webhook-intake] verify_jwt = false`.
2. **0006 hardening for real-world apply** (additive only, posture unchanged):
   the `fcg_rpc_owner` CREATE ROLE DO-block carries the same cluster-wide
   race guards 0003 needed (parallel CI appliers); a guarded self-grant +
   transient (immediately revoked) `CREATE ON SCHEMA public` make the
   `ALTER FUNCTION ... OWNER TO fcg_rpc_owner` statements succeed for a
   NON-superuser applier (Supabase's `postgres`). No standing privilege
   survives — asserted by static + integration tests (P3).
3. **Duplicate-of-erased-capture.** A redelivered `update_id` whose ledger row
   has `capture_id = NULL` (erasure ran between deliveries) gets 200 with NO
   card — the edge honours erasure instead of resurrecting a card for a
   capture that no longer exists. (P11 + handler unit U7c.)
4. **Tap-path projection failures do NOT 500.** §2's 500-on-failure lever is
   implemented exactly as designed for the MESSAGE path (card send after
   `new`/reconciliation). On the CALLBACK path, once `fcg_webhook_confirm_tap`
   commits, the ledger slot for that callback update is consumed — a 500 would
   make Telegram redeliver a tap that can only ever answer `duplicate_update`
   (it retries nothing). answerCallbackQuery/editMessageText failures there are
   therefore swallowed-with-log, worker-completion-edit being the durable card
   reconciler — the same "cards are retryable projections" rule worker.js
   already applies.
5. **card_ref coordinate type.** The RPC persists `{chat_id, message_id}` as
   TEXT values (as drafted). All consumers (0005 reverse lookup, worker
   completion edit) compare/pass them as text; the Bot API accepts both forms.
6. **§6 anomaly closed.** `telegramMapping.mapTelegramUpdate` now emits the
   bare-numeric `channel_principal_ref`, so the poll path's identity upsert
   matches the deploy-time seed shape. NOTE for the live seed: the WP0 live DB
   already carries an identity row whose `channel_principal_ref` is the
   PREFIXED form — the deploy-time seed must be an `ON CONFLICT (identity_ref)
   DO UPDATE` upsert (not DO NOTHING) or the webhook allowlist would refuse
   the authorised sender. Spelled out in [[wp1-safe-cutover]].
7. **Non-text updates on the webhook path** are acknowledged 200 + ignored
   with NO outbound "text only" notice: pre-RPC the sender is unverified, and
   messaging unverified senders is an existence oracle. The poll path still
   answers the notice when the Yoga is awake. No envelope/ledger rows either
   way (U4).
