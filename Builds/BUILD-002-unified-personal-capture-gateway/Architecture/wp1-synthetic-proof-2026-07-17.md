---
build: BUILD-002
wp: WP1
artifact: wp1-synthetic-proof
status: PASSED — all 6 scenarios + full suite green (no-DB and with-DB)
author: mack
created: 2026-07-17
branch: build-002/wp1-cloud-intake-foundation
---

# WP1 Synthetic End-to-End Proof — 2026-07-17 (overnight build)

The working-software proof for the Always-On Cloud Intake Foundation, run per
[[wp1-test-plan]] §3 with **no live bot, no live project, no real secrets**:
synthetic signed webhook POSTs → the REAL pure edge handler
(`supabase/functions/fcg-webhook-intake/handler.js`) → the REAL SECURITY
DEFINER RPCs from migration 0006 (invoked `SET ROLE service_role`, the exact
principal PostgREST uses) → a REAL throwaway Postgres 17.4 (scoop cluster,
`127.0.0.1:55433`, migrations **0001→0006** applied from empty) → the REAL,
UNCHANGED WP0 worker + markdownWriter → markdown on disk + evidence-gated
`completed` + the completion projected onto the ORIGINAL mock-Telegram card
via the durable `card_ref`.

Everything below is reproducible with:

```sh
cd services/fusion-capture-gateway
DATABASE_URL=postgres://postgres@127.0.0.1:55433/postgres node --test
```

## Suite totals (final run, this branch)

| Run | tests | pass | fail | skipped |
|---|---|---|---|---|
| `node --test` (no DB — hermetic unit suite) | 255 | 223 | 0 | 32 (DB-gated) |
| `node --test` with `DATABASE_URL` (throwaway PG 17.4) | 255 | **255** | **0** | 0 |

WP1 additions inside those totals: 49 unit tests (13 handler cases U1–U11+U13
+ wording-SSOT parity + tap-projection-swallow; 20 golden-vector parity
assertions over 9 pinned vectors × both implementations + a 64-item parity
corpus; 9 new 0006 static migration guards; 5 pgSslConfig tests; 4 grep-gate
guards), 12 RPC integration tests (P1–P12), 6 end-to-end scenarios.

## §2 RPC integration (P1–P12) — transcript

```text
✔ P1: migrations 0001→0006 apply cleanly from empty, twice (role DO-blocks are re-run-safe)
✔ P2 (I9): anon/authenticated cannot EXECUTE any fcg_webhook_* RPC; service_role can; PUBLIC holds no EXECUTE acl
✔ P3: all three RPCs are SECURITY DEFINER, pin search_path, and are owned by fcg_rpc_owner (Vex gate)
✔ P4: fcg_rpc_owner cannot DELETE anywhere and cannot SELECT raw_object/evidence_pointer/channel_poll_offset
✔ P5 (I10): unauthorised sender leaves ZERO rows; is_authorised=false still refuses; the seeded row admits
✔ P6 (I3/I4): the same (channel, update_id) ×5 → outcomes new + duplicate×4, ONE envelope, ONE ledger row; has_card_ref reflects reconciliation need
✔ P7: a poll-path capture (store.recordIntake) then the SAME message via webhook (new update_id) → existing, no second envelope, ledger linked
✔ P8: 21st accepted capture in the 60s window → rate_limited with no row; window advance readmits
✔ P9 (I2): confirm_tap transitions ONLY accepted→offline_queued; every other state is an honest no-op; ledger dedups the callback itself
✔ P10: fcg_webhook_card_ref persists the 0005 JSONB shape, overwrites idempotently, and reports not_found honestly
✔ P11: erasing a webhook capture nulls the ledger link; the freed idempotency key admits a NEW capture under a NEW update_id; the OLD update_id stays consumed
✔ P12: anon/authenticated are denied on channel_update_dedup; service_role passes (deny-by-default stands)
ℹ tests 12 / pass 12 / fail 0
```

## §3 End-to-end scenarios — transcript + what each proved

```text
✔ E2E-1 happy path: signed POST → accepted(webhook) + card → tap → offline_queued + waiting copy → worker drain → markdown + evidence → completed on the ORIGINAL card (2228ms)
✔ E2E-2 duplicate redelivery while the worker sleeps: POST ×3 → 1 envelope, 1 card, 1 ledger row; tap + redelivered tap → one queued, one dedup; drain → ONE markdown file (155ms)
{"service":"fusion-capture-gateway","component":"worker","event":"governed_write_failed","worker_id":"wp1-e2e-worker","capture_id":"f3ca2752-0a4a-5aab-99ba-e3cf50956cb9","attempt_count":1,"error":"markdownWriter.write: simulated governed write failure for f3ca2752-0a4a-5aab-99ba-e3cf50956cb9","at_ms":1752710001000}
✔ E2E-3 restart + duplicate safety: write fails once → failed+due-retry → a FRESH worker instance completes from durable state → ONE file; late redeliveries are inert (286ms)
✔ E2E-4 card-send failure honesty: send fails → 500 → redelivery reconciles the card → tap → drain → completed; the wording sequence never claims completion early (254ms)
✔ E2E-5 worker waking mid-redelivery: a duplicate burst races the drain → 1 envelope, 1 file, completed; no illegal transition escapes (261ms)
✔ E2E-6 auth negatives: wrong secret → 401 with ZERO DB writes; valid secret + stranger sender → 200 unauthorised with ZERO rows and no card (13ms)
ℹ tests 6 / pass 6 / fail 0
```

(The one JSON line inside the transcript is the worker's own honest
`governed_write_failed` structured log from E2E-3's injected crash — secret-free,
exactly the WP0 failure path doing its job.)

Per-scenario outcomes:

| Scenario | Verdict | Key assertions that held |
|---|---|---|
| E2E-1 happy path | PASS | envelope at `accepted` with `intake_transport='webhook'`; edge card carries the verbatim tap-gate copy; card_ref 0005-shaped; tap → `offline_queued` + waiting copy on the ORIGINAL card; unchanged worker drains to markdown-on-disk + `markdown_write` evidence + `completed`; final edit re-targets the ORIGINAL `message_id` with the backticked destination path |
| E2E-2 duplicate redelivery | PASS | 3 deliveries → outcomes `new, duplicate, duplicate`; 1 envelope, 1 ledger row, 1 card (`has_card_ref` short-circuit); redelivered tap → `duplicate_update`; ONE markdown file |
| E2E-3 restart + duplicates | PASS | injected write crash → honest `failed` + autonomous `next_attempt_at`; a brand-new worker instance (fresh store connection, no in-memory maps) completes on due-retry; card re-targeted purely from durable `card_ref`; post-completion replays: message → `duplicate` (0 new cards), same-tap → `duplicate_update`, fresh-tap → `already_completed`; exactly ONE file |
| E2E-4 card-send failure | PASS | send fails → 500 with the capture already durable (`accepted`, no card_ref); same-update redelivery → reconciliation sends the card; full visible wording sequence is exactly pending → waiting → Completed, length 3, no completion claim before evidence |
| E2E-5 wake-vs-redelivery race | PASS | drain ran concurrently with a 6-POST duplicate burst: every redelivery 200/`duplicate`, drain processed exactly 1, one envelope, one file, `completed`, no illegal-transition throw |
| E2E-6 auth negatives | PASS | wrong secret → 401 and row-count fingerprint unchanged, zero Telegram calls; valid secret + stranger → 200 `unauthorised`, ZERO rows (I10 — not even a ledger entry), no card |

## Parity proof (the cross-transport dedup guarantee)

`test/idempotencyParity.test.js`: 9 golden vectors (pinned 2026-07-17 from the
WP0 Node implementation) asserted byte-identical against BOTH
`core/idempotency.js`+`deriveCaptureId` (Node) and the WebCrypto port
`supabase/functions/fcg-webhook-intake/derive.js` (Deno-portable) — covering
NFC/NFD twins (decomposed input pins the SAME key), whitespace/CRLF collapse,
emoji + skin-tone modifiers, Cyrillic/CJK, the 4096-char Telegram bound, and
sender-scoping — plus a 64-item deterministic corpus asserting live agreement
between the two implementations. P7 then proved the same key dedups a poll
capture against a webhook redelivery in the real database.

## FU-1 closure evidence (live TLS, this machine, 2026-07-17)

Extraction (`scripts/tls-extract-ca.mjs`, `--env-file`, masked output; NO
worker touched, NO env file read by a human/agent):

- Presented chain from `aws-0-eu-west-1.pooler.supabase.com:5432`:
  leaf `*.pooler.supabase.com` (valid to 2030-03-11) ← `Supabase Intermediate
  2021 CA` (sha256 `303b0a59…ef0a55ea`, valid to 2033-10-21) ← self-signed
  `Supabase Root 2021 CA` (sha256 `807025ad…72e6cafa`, valid to 2031-04-26).
- Pinned (intermediate + root) at
  `services/fusion-capture-gateway/certs/supabase-pooler-ca.pem` — public
  certificates, provenance header inside. **TOFU caveat:** the chain was
  observed from the live connection; the dashboard cross-check is a named
  morning action ([[wp1-safe-cutover]] §7.1).

Verification (`scripts/tls-verify-probe.mjs`, same masked pattern, pointed at
the pinned CA over the CURRENT live env DSN — whose legacy
`uselibpqcompat`/require-mode params the loader stripped):

```json
{
  "mode": "explicit-pinned-ca",
  "stripped_dsn_ssl_params": ["sslmode", "uselibpqcompat"],
  "client_socket_encrypted": true,
  "tls_protocol": "TLSv1.3",
  "cipher": "TLS_AES_256_GCM_SHA384",
  "cert_verified_by_client": true,
  "authorization_error": null,
  "peer_cert": { "subject_cn": "*.pooler.supabase.com", "issuer_cn": "Supabase Intermediate 2021 CA", "valid_to": "Mar 11 15:56:33 2030 GMT" },
  "query_ok": true,
  "ok": true
}
```

The RUNNING worker and its env file were not touched — the live switch
(`DATABASE_SSL_CA_FILE` + restart) is Larry's, per [[wp1-safe-cutover]] §7.2.

## What was deliberately NOT done (hard WP1 boundaries, all held)

- No `setWebhook`/`deleteWebhook` against ANY real bot token.
- Migration 0006 NOT applied to the live Supabase project (Vex gates it).
- The edge function NOT deployed to the live project.
- The running worker and `C:\.fusion247` values untouched (probes used
  `--env-file` with masked output only).
- No new npm dependencies (pg remains the sole runtime dep; the edge modules
  use WebCrypto/stdlib only).
- Secret scan: clean.
