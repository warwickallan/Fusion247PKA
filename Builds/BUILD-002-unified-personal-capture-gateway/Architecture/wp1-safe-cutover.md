---
build: BUILD-002
wp: WP1
artifact: wp1-safe-cutover
status: procedure-of-record — NO step here has been executed against the live bot
author: mack
created: 2026-07-17
sources:
  - "[[wp1-architecture-decision]] (§5, §6)"
  - Pax WP1 research brief Q1/Q2/Q4 (Telegram webhook + coexistence semantics, retrieved 2026-07-17)
  - "[[wp1-drain-contract]]"
---

# WP1 Safe Cutover — Webhook Intake Without Ever Endangering the Live Bot

The WP1 build proved the cloud intake **synthetically** (real handler → real
RPCs → real worker → markdown; [[wp1-synthetic-proof-2026-07-17]]). This
document is the ONLY sanctioned path from that proof to live traffic. The live
production bot **stays on long polling until Warwick explicitly orders the
cutover**; everything before §6 uses a throwaway **bot B** or no bot at all.

## 1. The binding facts (verified, Pax Q1/Q2)

- `setWebhook` and `getUpdates` are **mutually exclusive per bot token**. The
  moment a webhook is set, the polling worker starts eating HTTP 409
  ("can't use getUpdates while webhook is active") and live messages route to
  the webhook. There is no partial mode.
- A second bot is **fully independent** — webhook state, update queue,
  `getWebhookInfo` are all token-scoped. Bot B on webhook cannot affect the
  live bot's polling in any way.
- Delivery is **at-least-once**; Telegram queues undelivered updates per bot
  (`pending_update_count`) and redelivers on non-2xx. Exact retry timing is
  officially unpublished — design for redelivery, ack sub-second.
- `drop_pending_updates=true` **discards queued updates irreversibly**. It is
  never passed on any production-adjacent call.

## 2. THE DO-NOT LIST (while the live bot is polling)

- **DO NOT** call `setWebhook` with the LIVE bot token. Not "for a minute",
  not to "just check the URL". The synthetic suite + bot B cover every test
  need.
- **DO NOT** call `deleteWebhook` with the live token either — it is a no-op
  when no webhook is set, but its presence in a script normalises touching the
  live token. The live token appears in exactly one place: the running
  worker's env.
- **DO NOT** pass `drop_pending_updates=true` to any call on any bot you are
  not about to throw away.
- **DO NOT** apply migration 0006 to the LIVE Supabase project without the Vex
  delta review (Larry gates this).
- **DO NOT** deploy `fcg-webhook-intake` to the live project before 0006 is
  applied there and the function secrets are set — a deployed function with
  missing secrets fails closed (401 for everyone) but is still noise.
- **DO NOT** put the live bot token into `supabase secrets` while the live bot
  polls. The edge function's `TELEGRAM_BOT_TOKEN` is bot B's until §6.
- **DO NOT** restart or reconfigure the RUNNING worker as part of any webhook
  experiment. Worker changes (FU-1 env switch) are Larry's, separately.

## 3. Prerequisites on the live project (gated, in order)

1. **Vex delta review of migration 0006** (RLS/tap-gate/EXECUTE surface).
2. **Apply 0006** via the Supabase MCP (`apply_migration`) or SQL editor as
   the project's `postgres` role. Non-superuser apply notes (already handled
   inside the migration): role creation is race-guarded; ownership transfer
   self-grants membership and uses a transient, self-revoked CREATE on
   `public`. Verify after apply:
   - `select proname, prosecdef, proconfig from pg_proc where proname like 'fcg_webhook_%';`
     → 3 rows, `prosecdef=t`, `search_path=` pinned;
   - owner = `fcg_rpc_owner`; anon/authenticated EXECUTE denied
     (`has_function_privilege`);
   - `fcg` is still NOT in the exposed schemas list (Settings → API).
3. **Allowlist seed (deploy-time, service_role — personal data never enters a
   migration).** CRITICAL SHAPE (build finding): the WP0 live DB already has an
   identity row for the authorised sender whose `channel_principal_ref` is the
   PREFIXED form (`telegram:user:<id>`), created by the poll path's stopgap
   self-registration. The RPC allowlist matches the BARE NUMERIC, so the seed
   MUST be an upsert that overwrites the principal ref — `DO NOTHING` would
   leave the webhook path refusing Warwick:

   ```sql
   insert into fcg.channel_identity
     (identity_ref, channel, channel_principal_ref, is_authorised)
   values ('telegram:user:<NUMERIC_ID>', 'telegram', '<NUMERIC_ID>', true)
   on conflict (identity_ref) do update
     set channel_principal_ref = excluded.channel_principal_ref,
         is_authorised = true;
   ```

4. **Function secrets** (CLI or dashboard — Pax found no MCP secrets tool;
   CLI is the path of record):

   ```sh
   supabase secrets set TELEGRAM_WEBHOOK_SECRET=<fresh 64+ char A-Za-z0-9_- value>
   supabase secrets set TELEGRAM_BOT_TOKEN=<BOT B token — never the live bot's>
   supabase secrets list   # names only — verify presence, never echo values
   ```

   Generate the webhook secret fresh (e.g. `openssl rand -base64 48 | tr '+/' '-_'`),
   store it ONLY in the secret manager. Telegram constrains it to
   `A-Za-z0-9_-`, 1–256 chars.

5. **Deploy the function** from the repo root (config.toml already carries the
   per-function `verify_jwt = false`; the flag is belt-and-braces):

   ```sh
   supabase functions deploy fcg-webhook-intake --no-verify-jwt --project-ref <ref>
   ```

   Build-time verify: `SUPABASE_SECRET_KEYS` parsing in `index.ts` was written
   defensively against an under-documented shape (Pax Q4 flag) — after the
   first deploy, confirm the function boots and the rpc auth works by watching
   the function logs during §4 step 3 (a synthetic POST with the correct
   secret). If the service-credential resolution fails it throws loudly on the
   first request; fix = adjust `serviceCredential()` to the observed shape.

## 4. Bot-B testing path (proves the LIVE deployment, zero live-bot risk)

1. Create a throwaway bot with @BotFather → **bot B** token → into
   `supabase secrets` (§3.4). Message bot B once from the authorised account
   so a private chat exists.
2. Set the webhook — bot B ONLY, with the secret token and a narrow
   allowed_updates list:

   ```
   POST https://api.telegram.org/bot<BOT_B_TOKEN>/setWebhook
     url=https://<project-ref>.supabase.co/functions/v1/fcg-webhook-intake
     secret_token=<TELEGRAM_WEBHOOK_SECRET value>
     allowed_updates=["message","callback_query"]
   ```

   (`drop_pending_updates` omitted — default false, harmless on a fresh bot.)
3. Verify: `getWebhookInfo` on BOT B shows the url, `pending_update_count: 0`,
   no `last_error_message`. **Also verify the live bot is untouched:**
   `getWebhookInfo` on the LIVE token must show `url: ""` — record this check
   before AND after the bot-B session.
4. Live proof sequence (mirrors [[wp1-test-plan]] §5): send one text message
   from the authorised account → pending card arrives (edge-sent) → tap
   "Save to Brain" → "Saving to your Brain…" + waiting copy → start the Yoga
   worker pointed at a SANDBOX `CAPTURE_BRAIN_DIR` (NOT the governed Team
   Inbox until Vex signs the WP1 delta) → capture completes → the ORIGINAL
   card edits to "Completed". Negative checks: a second account's message gets
   silence + zero rows; a curl without the secret header gets 401.
5. Teardown: `deleteWebhook` on bot B (`drop_pending_updates=false`), revoke
   bot B via BotFather, `supabase secrets set TELEGRAM_BOT_TOKEN=` (or rotate
   to the live token only at §6). Re-verify live-bot `getWebhookInfo` still
   shows no url.

## 5. Rollback (from any point)

`deleteWebhook(drop_pending_updates=false)` on whichever bot is on the webhook
→ its queued updates remain → the polling worker (restarted if it was stopped)
resumes from the same per-bot queue via `getUpdates`. Idempotency layers
(ledger + idempotency_key + poll-offset monotonic guard) make replay across the
boundary safe in both directions — proven by P6/P7/E2E-2/E2E-5.

## 6. The eventual REAL cutover (separate, Warwick-ordered, not WP1)

Forward: stop the polling worker FIRST (avoids the 409-race window) →
`setWebhook` on the live token (url + secret_token + allowed_updates,
`drop_pending_updates` ABSENT) → watch `getWebhookInfo` (`pending_update_count`
draining, no `last_error_message`) → the worker keeps running for
claim/drain/write only (its poll loop simply receives nothing — or run it in a
future drain-only mode). Rollback: §5. Monitoring: `getWebhookInfo.
last_error_message` + `pending_update_count` are the health signals (Pax Q6).

## 7. FU-1 morning actions (from the overnight build)

1. **Cross-check the TOFU pin**: download the CA from Dashboard → Database →
   Settings → SSL Configuration (`prod-ca-2021.crt`) and compare against
   `services/fusion-capture-gateway/certs/supabase-pooler-ca.pem`
   (sha256 fingerprints are in the PEM header; extraction observed
   subject CNs "Supabase Intermediate 2021 CA" + "Supabase Root 2021 CA").
   The chain came from the live handshake — dashboard agreement upgrades it
   from trust-on-first-use to verified.
2. **Live worker switch (Larry, not overnight):** add
   `DATABASE_SSL_CA_FILE=C:\Fusion247PKA\services\fusion-capture-gateway\certs\supabase-pooler-ca.pem`
   to `C:\.fusion247\fusion-capture-gateway.env` (the DSN's old
   `uselibpqcompat`/`sslmode` params may stay — the loader strips them — but
   removing them is cleaner), restart the worker, and re-run
   `node --env-file=C:\.fusion247\fusion-capture-gateway.env services/fusion-capture-gateway/scripts/tls-verify-probe.mjs`
   expecting `cert_verified_by_client: true` (already observed true on
   2026-07-17 from this machine — see [[wp1-synthetic-proof-2026-07-17]] §FU-1).

## 8. Private-direct-chat boundary (bot config + CODE enforcement)

This BUILD is authorised for Warwick's **PRIVATE DIRECT** bot conversation
only — never groups, supergroups, or channels (GPT-BUILD-002-WP1-REVIEW-0001,
correction 3).

1. **BotFather hardening (both the live bot AND bot B):** in @BotFather →
   `/setjoingroups` → **Disable** — so Telegram itself refuses to add the bot to
   groups where it allows this. Also confirm `/setprivacy` is **Enabled** (group
   privacy on) as defence-in-depth. Do this for bot B before the §4 test and for
   the live bot before the §6 cutover.
2. **CODE enforcement is mandatory regardless of the bot setting.** The
   `/setjoingroups` toggle is a convenience, not a guarantee (a pre-existing
   group membership, a channel post, or a Telegram edge case can still deliver a
   non-private update). Enforcement therefore lives in CODE, in BOTH transports,
   through ONE shared predicate so they cannot drift:
   `supabase/functions/fcg-webhook-intake/chatBoundary.js` (`isPrivateDirectChat`),
   imported by the webhook handler (`handler.js`) and the poll mapping
   (`src/adapters/telegramMapping.js`). It requires `chat.type === 'private'` and
   `chat.id === the message sender's id`; any group / supergroup / channel /
   missing / malformed chat context creates ZERO envelope/queue/ledger/card/
   Markdown rows and returns a quiet default-deny (no reply). The sender
   allowlist (is this the authorised user?) remains a separate authority — the
   DB allowlist inside the `fcg_webhook_*` RPCs for the webhook, and the inline
   `authorisedUserId` check for the poll path — so a stranger in their own
   private chat is still refused by the allowlist, not silently by the chat gate.
3. **Card-ref safety under the constraint.** With private + `chat.id === sender`
   enforced, there is a single chat per authorised user, so the
   `chat:<sender>:msg:<message_id>` native id and the `card_ref` reverse lookup
   cannot collide across chats. No path keys a card_ref on `message_id` without
   the enforced single-chat scope.
4. **Note (poll path):** the code gate takes effect on the NEXT restart of the
   running worker (PID-managed by Larry) — this WP1 change does not touch the
   live worker in place.
