---
agent_id: mack
session_id: build-002-wp1-overnight-2026-07-17
timestamp: 2026-07-17T03:18:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-002 WP1 — Always-On Cloud Intake Foundation: overnight implementation

Branch `build-002/wp1-cloud-intake-foundation`. Silas's design pack implemented
end-to-end; NO live cutover performed (hard constraint held: zero
setWebhook/deleteWebhook calls, 0006 not applied live, edge not deployed live,
running worker + `C:\.fusion247` untouched).

## What I built

- **Migration 0006** (`services/fusion-capture-gateway/migrations/0006_wp1_cloud_intake_rpcs.sql`):
  Silas's draft finalised — transport dedup ledger, `intake_transport` marker,
  three SECURITY DEFINER RPCs (service_role EXECUTE only, owned by
  least-privilege `fcg_rpc_owner`, `search_path=''`). Two additive hardenings:
  0003-style cluster-wide role-race guards, and a non-superuser-apply path for
  the ownership transfer (guarded self-grant + transient CREATE-on-public,
  revoked in-migration — P3 asserts no standing privilege).
- **Edge function** `supabase/functions/fcg-webhook-intake/` — thin Deno
  `index.ts` over a PURE portable `handler.js` + `derive.js` (WebCrypto port of
  the idempotency/capture-id derivation). Unit-tested entirely under Node (no
  Deno runtime on this machine): 13 handler cases + golden-vector byte-parity
  (9 pinned vectors × both impls + 64-item corpus) — the parity IS the
  poll↔webhook dedup guarantee. `supabase/config.toml` carries
  `verify_jwt=false` for the function.
- **Worker/drain: zero changes** — confirmed the drain contract's central
  claim; cloud taps land `offline_queued`, already claimable. I1–I10 all
  test-enforced (mapping recorded in the imported wp1-drain-contract
  frontmatter).
- **Tests**: no-DB suite 255 tests / 223 pass / 32 DB-gated skips / 0 fail;
  with throwaway Postgres 17.4 (scoop cluster, port 55433, migrations
  0001→0006): 255/255. New: webhookHandler (unit), idempotencyParity,
  pgSslConfig, tlsTransportGuards (grep-gates: no rejectUnauthorized:false, no
  bare require-mode DSN, I8 transport-blind claim path), 0006 static guards in
  migrations.test.js (incl. the enqueue-token invariant extended to the RPC
  path: the ONLY state assignment in 0006 is accepted→offline_queued inside
  confirm_tap), webhookRpc P1–P12, webhookE2E E2E-1…6. CI workflow paths now
  include `supabase/**`; the existing DATABASE_URL job exercises 0006 via the
  extended MIGRATIONS lists.
- **FU-1 CLOSED (dev side)**: pinned pooler CA extracted from the live
  handshake (TOFU, documented) → `certs/supabase-pooler-ca.pem` (public certs;
  Supabase Intermediate+Root 2021 CA); `pgSslConfig.js` builds the explicit
  `ssl:{ca, rejectUnauthorized:true}` form and STRIPS ssl DSN params (the
  node-postgres replacement trap); verification probe over the live pooler:
  `cert_verified_by_client: true`, TLSv1.3, query_ok. Live worker env switch
  deliberately left to Larry (wp1-safe-cutover §7.2).
- **FU-2 CLOSED**: SECURITY.md/README/.env.example/config-comments now
  prescribe pooler + verify-full + pinned CA (both forms), never bare
  require-mode; CI grep-gate prevents regression. **FU-4 CLOSED**: fatal-path
  log in liveRunner routes through `buildSecretRedactor` (now the ONE redaction
  impl, also used by per-cycle diagnostics). **FU-5 left open by design** —
  placeholder text now explicitly names it as Warwick's open decision.
- **Docs**: design pack imported to `Builds/.../Architecture/wp1-*.md` with a
  build addendum (7 documented deviations); `wp1-safe-cutover.md` (bot-B path,
  coexistence semantics, DO-NOT list, allowlist-seed upsert shape);
  `wp1-synthetic-proof-2026-07-17.md` (masked transcripts, all 6 scenarios
  PASS).

## What the next agent should know

1. **Allowlist seed gotcha (would have broken the live cutover):** the live DB
   already holds the authorised identity with a PREFIXED
   `channel_principal_ref` (`telegram:user:<id>`) from the WP0 store stopgap;
   the RPC allowlist matches the BARE numeric. The deploy-time seed MUST be
   `ON CONFLICT (identity_ref) DO UPDATE` (not DO NOTHING). Spelled out in
   wp1-safe-cutover §3.3. I also fixed the poll path's mapping to emit the
   bare numeric going forward (Silas's §6 anomaly).
2. **Mock message-id collisions strike again:** the WP1 e2e mock initially
   reused per-instance message-id counters over the shared DB and cross-wired
   tap resolution across scenarios — the exact WP0 root cause. Module-level
   counter fixed it. If you ever build a Telegram mock: message ids are
   chat-scoped monotonic, NEVER per-process-instance.
3. **card_ref coordinates are TEXT on the webhook path** (RPC jsonb). All
   consumers compare via `->>`; the worker passes them through to the Bot API,
   which accepts both. Assert with String() in tests.
4. **Tap-path projection failures must NOT 500**: once confirm_tap commits,
   the callback's ledger slot is consumed; a 500 would redeliver a tap that
   can only answer `duplicate_update`. Message-path card failures DO 500
   (Telegram redelivery = card retry loop). Both are deliberate and tested.
5. `SUPABASE_SECRET_KEYS` parsing in index.ts is defensive against an
   under-documented shape (Pax Q4 flag) — verify at first deploy (cutover doc
   §3.5 says how).

## Morning actions for humans

- Cross-check the TOFU-pinned CA against the dashboard download (cutover §7.1).
- Larry: live worker `DATABASE_SSL_CA_FILE` switch + probe (cutover §7.2).
- Larry→Vex: 0006 delta review before any live apply.
- Warwick: FU-5 security-contact decision (still open, now explicitly marked).
