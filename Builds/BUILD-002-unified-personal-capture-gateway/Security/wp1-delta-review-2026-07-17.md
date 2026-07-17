---
build: BUILD-002
wp: WP1
artifact: wp1-delta-security-review
author: vex
status: signed-off-green-with-conditions
created: 2026-07-17
reviewed_branch: build-002/wp1-cloud-intake-foundation
reviewed_range: 10881c5..9c69cfb
delta_base: 9d59d7c (merged main, WP0 GREEN-WITH-CONDITIONS baseline)
---

# WP1 Delta Security Review (2026-07-17)

Delta review of the six WP1 commits (`10881c5..9c69cfb`, 35 files, +4640/-56)
against the WP0 baseline signed off in [[wp0-live-signoff-2026-07-17]].
Method: [[SOP-004-vex-security-audit]] -- line-by-line audit of every privileged
path (all three SECURITY DEFINER RPCs), live re-execution of controls, and my
own probes. Nothing on this branch has touched the live project; this review
gates the four live actions listed at the bottom.

**Review method: re-execution, not trust.** Every load-bearing claim below is
backed by something I ran in this session: the full test suite (no-DB mode),
`scripts/secret-scan.sh`, the FU-1 TLS probe against the real pooler (masked),
a canary-secret probe of the FU-4 redaction path, an `icacls` read of the env
file (names/ACLs only), and repo-wide greps. No secret value was read, echoed,
or logged at any point.

---

## VERDICT: GREEN-WITH-CONDITIONS

Zero CRITICAL, zero HIGH, zero MEDIUM. The WP1 attack surface is built the way
the WP0 gate demands: default-deny at every layer, fail-closed on every error
path, the tap-gate preserved by construction, and the controls are enforced by
CI (9 new static migration guards + the TLS grep-gates + the canary log sweep),
not by convention. The conditions are sequencing/verification steps inside the
approved actions, not blockers.

**Severity counts: CRITICAL 0 -- HIGH 0 -- MEDIUM 0 -- LOW 3 -- INFO 5.**

**All four gated actions are approved (YES x4)** -- each with its named
condition, below.

---

## 1. Migration 0006 -- the SECURITY DEFINER surface (audited line by line)

**Hardening verified in the file and by tests:**

- All three RPCs (`fcg_webhook_intake`, `fcg_webhook_confirm_tap`,
  `fcg_webhook_card_ref`): `security definer` + `set search_path = ''` + fully
  schema-qualified references throughout. No dynamic SQL in any function body
  (the only `execute format` in the file is the role self-grant, `%I`-quoted,
  value from `current_user` -- not caller-controlled).
- EXECUTE revoked from `PUBLIC, anon, authenticated` and granted to
  `service_role` only, on all three signatures (0006 s8). Enforced statically
  (migrations.test.js 0006 guards) and live (P2: `permission denied` as
  anon/authenticated, no PUBLIC ACL entry, `has_function_privilege` false).
- **Allowlist is default-deny and write-free for strangers:** in both intake
  and confirm_tap the `fcg.channel_identity` check (`is_authorised` required)
  runs BEFORE any write. An unauthorised sender leaves ZERO rows -- not even a
  dedup-ledger row -- so no stranger PII is retained and no oracle exists
  (P5 + E2E-6 assert row-count fingerprints across every table).
- **Tap-gate survives by construction:** the ONLY `set state =` assignment in
  the entire migration is `accepted -> offline_queued` inside
  `fcg_webhook_confirm_tap`, gated on a ledgered real `callback_query`, action
  `SaveToBrain`, an explicit `v_state = 'accepted'` check, and `FOR UPDATE`
  row locking against a concurrently waking worker. Intake inserts at
  `accepted` only; `card_ref` never touches state. The static guard pins all
  of this (any drift fails CI before any DB sees it).
- **No DELETE anywhere for `fcg_rpc_owner`;** no access to `raw_object`,
  `evidence_pointer`, `channel_poll_offset` (grant matrix + per-verb RLS
  policies + P4 live rejection proof). `service_role` DELETE on the new ledger
  table matches the 0003 posture (erasure/pruning) -- correct.
- **RLS nowhere weakened:** new table has RLS enabled with role-scoped
  policies only; existing tables gain per-operation `fcg_rpc_owner` policies
  (additive); no policy or grant names anon/authenticated/PUBLIC (static guard
  + P2). Deny-by-default stands at both the grant gate and the policy gate.
- **Erasure interplay is GDPR-clean:** `channel_update_dedup.capture_id` is
  `ON DELETE SET NULL`; post-erasure residue is (channel, update_id,
  update_kind, received_at) -- transport metadata, no content, no identity;
  documented as prunable. The handler honours erased captures explicitly
  (`duplicate_of_erased_capture`: no reconciliation resurrects anything).

**Adjudication of the two flagged constructs (Mack's build deviations):**

1. **Transient CREATE-on-public (0006 s8): ACCEPTED.** Required for a
   non-superuser `ALTER FUNCTION ... OWNER` on Supabase; granted and revoked
   within the same migration; the grantee is NOLOGIN so the window is not
   independently reachable; absence of standing CREATE is asserted both
   statically (migrations.test.js) and live (P3 `has_schema_privilege` false).
2. **Applier self-grant into `fcg_rpc_owner` (0006 s4): ACCEPTED.** Privilege
   flows applier<-role only: the applier (Supabase `postgres`) gains the
   definer role's narrow privileges, which it already exceeds -- no
   escalation in either direction. The membership persisting after apply is
   harmless and needed for future ownership maintenance. The
   `when others then null` swallow is acceptable because the subsequent
   `ALTER ... OWNER` fails loudly if the grant did not take -- fail-closed.

## 2. Edge function fcg-webhook-intake

- **Secret-token comparison is genuinely constant-time:** both values are
  SHA-256 hashed first, then XOR-folded over the fixed 32-byte digests -- cost
  independent of content and length, no early return, no length oracle
  (`timingSafeEqualStrings`, handler.js). Missing/empty CONFIGURED secret
  fails closed: 401 for everyone, never an open door (U2 asserts this).
- **verify_jwt=false is properly compensated:** committed per-function in
  `supabase/config.toml` + `--no-verify-jwt` belt-and-braces, with the
  secret-token gate before any parse/DB touch and the RPC layer independently
  service_role-only -- a bypassed edge still cannot write for a stranger
  (defense in depth, proven at the RPC layer by P5/E2E-6).
- **No secret can reach a log:** the handler never sees the bot token; the
  Deno shell masks it in every Telegram error and every log line; `maskErr`
  strips the webhook secret from any rpc/telegram error text. U13 sweeps
  every handler path with canary secrets -- including an rpc error message
  that deliberately CONTAINS them -- and asserts absence in logs and bodies.
- **Malformed input:** non-POST -> 405; bad JSON/unknown kinds -> 200 ignored
  (no retry-spam, no ledgered noise); RPC/DB failure -> 500 so Telegram's
  at-least-once queue is the retry loop; card-send failure after a durable
  new intake -> 500 without a consumed success (redelivery reconciles).
- **SUPABASE_SECRET_KEYS parsing** is defensive and fails closed (throw ->
  500) if no credential resolves; see I-1 for the deploy-time check.
- **Nothing in committed code can perform setWebhook/deleteWebhook:**
  the Telegram client exposes exactly `sendMessage`, `editMessageText`,
  `answerCallbackQuery`; repo-wide grep finds `setWebhook` only in a comment.
  The cutover doc DO-NOT list keeps the live token untouchable.

## 3. FU closures (WP0 sign-off conditions)

| FU | Status | Evidence (this session) |
|---|---|---|
| **FU-1** verify-full + pinned CA | **Closed dev-side; TOFU cross-check outstanding (L-1)** | I ran `scripts/tls-verify-probe.mjs` myself against the live pooler: `mode: explicit-pinned-ca`, `stripped_dsn_ssl_params: [sslmode, uselibpqcompat]`, TLSv1.3, **`cert_verified_by_client: true`**, `authorization_error: null`, hostname-verified leaf `*.pooler.supabase.com`, `query_ok: true`. `pgSslConfig.js` correctly strips every ssl-ish DSN param (the node-postgres replacement trap) and refuses mixed forms on non-URL DSNs. PEM header carries honest TOFU provenance + sha256 fingerprints + the dashboard cross-check requirement. `.gitignore` un-ignores exactly this one public cert; the guard test hard-fails if a PRIVATE KEY block ever appears in it. |
| **FU-2** doc drift | **Closed** | SECURITY.md s2/rotation runbook, README, `.env.example`, config.js comments all prescribe pooler + verify-full/pinned-CA; the rotation runbook now regenerates the strong DSN and re-runs the probe. Repo-wide grep: no live doc recommends `sslmode=require` (remaining hits are historical narrative, trap-explaining comments, and inert test fixtures -- all outside the CI grep-gate runtime scope, correctly). |
| **FU-3** env-file ACL | **Closed (verified live, machine-side -- not this branch)** | `icacls` on the env file now shows only `BUILTIN\Administrators`, `NT AUTHORITY\SYSTEM`, owner -- the inherited `Users:(RX)` / `Authenticated Users:(M)` entries from V-02 are gone. |
| **FU-4** fatal-path redaction | **Closed (probed); no regression test (L-2)** | One implementation (`config.buildSecretRedactor`) now serves both `safeErr` and the entrypoint fatal catch. My canary probe: password-component, whole-DSN, and bot-token inputs all render `***redacted***`; a live fatal run (canary DSN, refused connection) emitted the structured fatal line with no leak. |
| **FU-5** security contact | **Correctly held open** | SECURITY.md now says explicitly: OPEN ITEM, decision belongs to Warwick, interim = report privately to Warwick only. Honest, not silently defaulted. |

## 4. Tests as controls

- Suite run this session (no-DB): **255 tests, 223 pass, 0 fail, 32 DB-gated
  skips.** `bash scripts/secret-scan.sh`: **clean -- 358 tracked files, 0
  secret values.**
- The 9 new 0006 static guards are real controls: RLS-everywhere, strictly
  additive, no anon/authenticated/PUBLIC grants or policies, definer
  hardening + EXECUTE surface, no-DELETE/no-raw_object for the definer role,
  transient-CREATE revoked, the tap-gate state-literal pin, 0001-0005
  non-interference, and the DO-NOT-WEAKEN marker itself.
- Auth-negatives prove zero-row fingerprints at both layers: wrong secret ->
  401 + zero writes (edge layer); valid secret + stranger -> `unauthorised` +
  zero rows + no card (RPC layer; E2E-6, P5, and the stranger-tap ledger
  check).
- Golden-vector parity (fixtures pin NFC/NFD, whitespace, emoji, CJK,
  4096-char bound) asserts the Node and Deno-port derivations byte-identical
  -- the cross-transport dedup guarantee is CI-enforced, plus 64 randomized
  agreement cases.
- TLS grep-gates: `rejectUnauthorized:false` banned from all runtime source
  (single named exception: the TOFU extraction script, with documented
  rationale -- sound); `sslmode=require` banned from runtime source +
  `.env.example`; claim path stays `intake_transport`-blind (I8).

---

## Findings

| ID | Severity | Where | Finding | Fix / follow-up |
|----|----------|-------|---------|-----------------|
| L-1 | LOW | `certs/supabase-pooler-ca.pem` | The pin is TOFU -- extracted from a live handshake, not yet cross-checked against the dashboard CA download. Residual risk (hostile CA seeded by a persistent on-path MITM) is small: the WP0 sign-off session independently observed the same Supabase CA chain on a separate connection, and the pin is a strict improvement over the current unverified posture either way. Honestly documented in the PEM header + cutover s7.1. | Complete the dashboard cross-check (`prod-ca-2021.crt` vs the recorded sha256 fingerprints) as the named morning action. Match -> FU-1 fully closed. Mismatch -> STOP, treat as an incident, do not cut over. |
| L-2 | LOW | `src/config.js` / `test/` | `buildSecretRedactor` and the fatal-path wiring have no automated regression test -- the FU-4 control is verified by my probes but unprotected against future drift (grep confirms zero test references). | Add a unit test: canary config -> redactor strips whole-DSN, password component, bot token; plus a wiring assertion on the entrypoint catch. Next test-writing pass; not blocking. |
| L-3 | LOW | `supabase/functions/fcg-webhook-intake/index.ts` | The shell reads the full request body (`await req.text()`) before the handler auth gate -- an unauthenticated POST can make the function buffer an arbitrary body (bounded only by platform limits). Cost/DoS exposure is marginal on the Supabase runtime. | Hardening: check the secret header presence before consuming the body, or cap accepted body size. Fold into the next edge iteration. |
| I-1 | INFO | `index.ts` `serviceCredential()` | The defensive `SUPABASE_SECRET_KEYS` parse returns the first plausible string -- on an unexpected dict shape it could select a non-secret key. Downstream is fail-closed (EXECUTE denied -> 500 -> Telegram retries), availability-only. | Deploy-time verification already named in cutover s3.5 (watch first authorized POST in function logs). |
| I-2 | INFO | 0006 `fcg_webhook_card_ref` | No allowlist/state check inside the RPC -- any service_role caller can overwrite any capture card_ref. Acceptable strictly inside the EXECUTE-service_role-only boundary (a service_role compromise is total anyway). | Do not widen EXECUTE, ever (already pinned by guards + comments). |
| I-3 | INFO | 0006 dedup ledger | Post-erasure residue = (channel, update_id, kind, received_at): non-personal transport metadata of a single-user bot. Prunable, retention documented. | None; prune per the documented horizon if desired. |
| I-4 | INFO | 0006 confirm_tap ordering | A callback that resolves `not_found`/`unavailable_action` still consumes its (channel, update_id) ledger slot. Fail-closed (nothing enqueues without a successful tap); recovery is a fresh tap = new update_id. Same family as the documented rate-guard-vs-duplicate corner, backstopped by the wake-time card sweep. | Accepted as designed. |
| I-5 | INFO | 0006 s4 self-grant | The applier membership in `fcg_rpc_owner` persists after apply. No privilege flows to the definer role; needed for future ALTERs. | Accepted (adjudication s1 above). |

**Positive findings:** the WP1 identity-shape fix (`channel_principal_ref` =
bare numeric) keeps the poll path `ON CONFLICT DO NOTHING` upsert unable to
flip or overwrite the seed row; the cutover doc seed upsert shape is correct
and keeps personal data out of migrations; FU-3 closed and verified; the
DO-NOT list makes the live bot token structurally untouchable during WP1.

---

## Gated actions -- explicit calls

| # | Action | Call | Condition |
|---|--------|------|-----------|
| a | Apply migration 0006 to the live DB | **YES** | Apply as project `postgres` per cutover s3.2; run the post-apply verification queries (3 rows `prosecdef=t`, pinned `search_path`, owner `fcg_rpc_owner`, anon/authenticated `has_function_privilege=false`, `fcg` NOT in exposed schemas) and record the output; seed the allowlist with the s3.3 upsert shape exactly. |
| b | Deploy `fcg-webhook-intake` to the live project | **YES** | Only AFTER (a); secrets first per s3.4 (fresh 64+ char webhook secret, bot B token -- never the live bot token); deploy with `--no-verify-jwt`; then live-verify: curl without the secret header -> 401, and watch the function logs on the first authorized POST for the `serviceCredential` shape (I-1). |
| c | Open the WP1 PR | **YES** | None. Suite green, secret-scan clean, guards enforced in CI. |
| d | Restart the live worker on this branch with `DATABASE_SSL_CA_FILE` set (FU-1 switch) | **YES -- approved from my side** | This is a strict security improvement over the current unverified posture; do not wait for L-1 to restart. L-1 (dashboard cross-check) must still complete to declare FU-1 fully closed -- and a mismatch there is a stop-everything incident. After restart, re-run the probe and record `cert_verified_by_client: true`. |

Carried unchanged from WP0: F-08 (retention-class enforcement when raw objects
first flow), V-05 (RLS-bypass posture re-audit before any multi-user or
direct-client path), FU-5 (Warwick security-contact decision).

*No implementation code, tests, or migrations were modified by this review.
Probes were masked and read-only; the canary fatal-path run used synthetic
values only and touched no real credential. No secret value was read or
emitted.*

## Links

- [[wp0-live-signoff-2026-07-17]] -- the baseline whose conditions this delta closes.
- [[wp0-security-gate]] -- gate definition.
- [[wp1-safe-cutover]] -- the only sanctioned path to live traffic (s3 order is normative).
- [[wp1-synthetic-proof-2026-07-17]] -- the synthetic E2E evidence this review cross-checked.
