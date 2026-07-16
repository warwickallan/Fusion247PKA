---
build: BUILD-002
component: fusion-capture-gateway
artifact: security-policy
author: vex
created: 2026-07-16
---

# Security Policy — Fusion Capture Gateway

Component security policy for `services/fusion-capture-gateway/`, the WP0 unified
personal capture gateway. This document is a required artifact of the
[[wp0-security-gate]] (§7 lists a missing component `SECURITY.md` as a
RED / no-override trigger). It states the threat model, where secrets live and how
they are masked, the rotation runbook, the sender-allowlist policy, the erasure
procedure, and the secret-scanning controls. It also enumerates the hardening that
is **required before real data / live wiring** — deferred by design during the
fixtures phase, mandatory before any real secret or the live phone-visible proof.

**Security contact:** report suspected vulnerabilities privately to
`<SECURITY-CONTACT-PLACEHOLDER — set before live wiring>` (Vex / component owner).
Do not open a public issue for a suspected secret exposure or auth bypass.

---

## 1. Threat model

**Scope.** Single-user personal capture. Exactly one authorised human (Warwick) and
one Larry/Fusion Telegram bot. No multi-user path, no open enrolment in WP0/WP1.

**Components and trust.**
- **Telegram bot (ingress).** Untrusted transport. Every inbound update is hostile
  until the sender allowlist passes. The bot surface never reads a Supabase secret.
- **Supabase operational store (staging).** Operational/staging only — envelope,
  processing state, evidence pointers, and a private raw-object bucket
  (`fcg-raw-private`). Never the canonical knowledge home. RLS is enabled
  deny-by-default on every table (`migrations/0001_wp0_operational_baseline.sql`).
- **Local worker (trusted).** Runs server-side with the `service_role` credential,
  pulls jobs in-process from the store, and performs the one governed Markdown
  write. It is the only component that holds `service_role`.
- **Canonical Markdown (system of record).** The knowledge copy lives in
  Markdown/myPKA, never in Supabase.

**Primary threats and the controls that answer them.**
- *Unauthorised sender injecting captures* → numeric sender allowlist, default-deny,
  fail-closed intake (§4 below, §1 of the gate).
- *Path traversal / arbitrary write from untrusted content* → `safeSegment` charset
  flattening + post-resolve sandbox-containment guard in `markdownWriter.js`
  (proven traversal-proof by probe).
- *Secret leakage into Git / logs* → secrets loaded by name from env only, masked by
  `config.describe()`, plus CI + local secret scanning (§6, §7 below).
- *Double-write / false completion on retry or crash* → stable idempotency key,
  evidence-gated `complete()`, idempotent writer.
- *Undeletable personal data* → the `erase()` path across all three homes (§5).

**Out of scope (hard-excluded).** Fusion Health / health data. No code path ingests,
stores, or types health data without a separate authority/privacy/security decision.

## 2. Secret homes and masking

**Which secrets exist:**
- `TELEGRAM_BOT_TOKEN` — full bot account credential.
- `SUPABASE_SERVICE_ROLE_KEY` — privileged server-side key (worker-only).
- `SUPABASE_ANON`/publishable key — if used, low-privilege, still never committed.

**Where they live (the only acceptable homes):** environment variables injected by a
secret manager, or an OS-keychain-backed `.env` that lives **outside** the repo tree.
They are **never** committed to Git, **never** pasted into a Markdown note, and
**never** written into ClickUp. The repo ships only `.env.example` with key names and
empty values (`.gitignore` ignores `.env` / `.env.*` and un-ignores `.env.example`).

**How they are read and masked.** `src/config.js` reads secrets **by name**
(`CONFIG_KEYS`) and tags them in `SECRET_KEYS`. `config.describe()` emits a log-safe
snapshot where every secret is rendered `***set (masked)***` or `(unset)` via
`maskSecret()` — the raw value is never returned. The Telegram bot surface never reads
a Supabase secret; the `service_role` key is touched only by the worker. Absence of
these secrets is the valid `fixturesMode` state used through WP0.

## 3. Rotation runbook

Rotation requires **no code change** — there are no hardcoded secret values; every
secret is read from the environment by name.

**Telegram bot token.**
1. Revoke/regenerate the token via BotFather (`/revoke` then `/token`).
2. Update `TELEGRAM_BOT_TOKEN` in the secret manager / keychain-backed `.env`.
3. Restart the ingress process so it re-reads env. Expected downtime: seconds.
4. Confirm `config.describe()` shows `TELEGRAM_BOT_TOKEN: ***set (masked)***` and
   that no old token value appears in any log.

**Supabase `service_role` key.**
1. Rotate in the Supabase dashboard (API settings → roll `service_role`).
2. Update `SUPABASE_SERVICE_ROLE_KEY` in the secret store; restart the worker only.
3. `service_role` is **worker-only** and least-privilege by placement — it never
   reaches the bot/ingress surface. Prefer a narrower scoped role wherever the
   operation allows; keep `service_role` off any client surface.

**Supabase anon / publishable key.**
1. Rotate in the dashboard; update the consuming surface's env.
2. RLS remains enabled deny-by-default, so an anon key alone cannot over-read even
   between rotation and restart.

After any rotation, run `scripts/secret-scan.sh` to confirm nothing was pasted into a
tracked file during the change.

## 4. Sender-allowlist policy

- **Single numeric Telegram user id.** Authorisation compares the inbound
  `message.from.id` (a numeric, non-spoofable id) against one configured
  `AUTHORISED_TELEGRAM_USER_ID` — never a username, never a chat title.
- **Default-deny.** Any non-matching sender is silently ignored: no reply, no
  capture, no error that confirms the bot exists. The rejection is **logged**
  (sender id + timestamp + reason) and never actioned.
- **Constructor requires an id.** The adapter throws if no authorised id is
  configured — there is no accidental allow-all.
- **No self-enrolment.** There is no `/start`, invite, or runtime add-user path.
  Adding a user is a config/deploy change, never a chat-driven action.
- **Fail-closed intake.** On any unauthorised or malformed update, intake returns
  `{ok:false}` — no durable row, no card, no reply.

## 5. Deletion / erasure procedure

Right-to-erasure spans **three** homes; a real erasure reaches all of them. The
orchestrator is `src/erasure.js :: erase(captureId, { now })`, built on Silas's
data-layer `operationalStore.deleteCapture(captureId, { now })` and Mack's
`markdownWriter.remove(...)`.

1. **Governed Markdown note** (canonical knowledge copy) — removed via
   `markdownWriter.remove(destination_ref, { now })`, which only ever deletes inside
   the sandbox inbox and refuses any out-of-sandbox / tampered pointer.
2. **Raw storage object** — in fixtures the raw payload is a pointer destroyed with
   the operational row; in a real deployment this step deletes the Supabase Storage
   object keyed by `raw_payload_ref.object_key` **before** the row is dropped.
3. **Operational store rows** — `deleteCapture` removes the envelope; the FK cascades
   in `migrations/0002_wp0_deletion_and_retention.sql` remove the dependent
   `processing_state`, `evidence_pointer`, and `idempotency_key` rows, **freeing the
   idempotency key** so the same key can back a genuinely new capture.

Erasure is **idempotent**: erasing an unknown or already-erased id returns
`{erased:false}` and never throws, so an erasure job is safely re-runnable.

**Backups / shadow copies.** A delete here is a **true erasure**, not a
soft-delete/tombstone. Every shadow copy must be purged within the retention window:
Postgres PITR / logical backups / WAL archives, Supabase Storage object versions and
soft-delete buckets, and any read replica, export, or downstream cache. A backup that
still contains an erased subject after the retention window is a compliance violation.
Retention never overrides erasure.

## 6. Secret scanning (CI + local hook)

- **Enforced control (CI):** `.github/workflows/secret-scan.yml` runs
  `scripts/secret-scan.sh` on every `push` and `pull_request` with least-privilege
  `permissions: contents: read`. This is the enforcement point a contributor cannot
  bypass.
- **Local convenience mirror:** `.githooks/pre-commit` runs the same scanner plus the
  test suite before a commit leaves the machine. Enable with
  `git config core.hooksPath services/fusion-capture-gateway/.githooks`.
- **The scanner** (`scripts/secret-scan.sh`) is zero-dependency (bash + git + grep),
  scans every **tracked** file for secret **value** patterns (Telegram token, JWT,
  Stripe live keys, AWS key id, PEM private-key block, and long quoted secret
  assignments), and exits non-zero on any hit. It excludes `.env.example`, `*.md`, and
  itself to avoid self-match on documented key **names**. `npm run scan` is a shortcut.
- Current tree: **clean** (exit 0).

## 7. Required before real data / live wiring

The following hardening is **deferred by design** during the fixtures phase and is
**mandatory before** any real secret is provisioned or the live phone-visible proof
runs. These are pre-live-wiring conditions carried from the WP0 gate execution report;
none of them block the fixtures baseline from merging.

- **F-04 — Per-sender rate limit / flood control.** Add bounded inbound handling (a
  per-sender token bucket) at the `telegramAdapter` / `intake` seam so a burst — even
  from the authorised user, or spoof attempts before allowlist rejection — cannot
  exhaust the worker or the write path.
- **F-05 — Structured, secret-free access logging.** Log the privileged capture-write
  and raw-object-read operations who/what/when, without ever logging a secret value or
  a full sensitive payload.
- **F-07 — Restrictive RLS policies.** Author the single-authorised-principal policy
  set on top of the existing deny-by-default RLS: `service_role` server-side only, and
  a single authorised principal. Keep deny-by-default until these land.
- **F-08 — Enforce retention-class on raw-object creation.** The `retained` /
  privacy-class tag is schema-present; enforce it in code when the real storage path
  is implemented, so retention is deliberate, not indefinite-by-accident.

**Verify at real wiring (transport authenticity).**
- **F-09 — Worker trust boundary.** The worker pulls in-process today (no open local
  port). Re-audit when a real transport is introduced so the worker accepts jobs only
  from the authenticated gateway path.
- **F-10 — Webhook / poll authenticity.** When Telegram is wired for real, verify the
  secret path token / `X-Telegram-Bot-Api-Secret-Token` (webhooks) or bot-token-only
  delivery (long-polling) so arbitrary callers cannot inject fake updates.

Transport encryption (TLS on all hops) and Supabase at-rest encryption are also
confirmed as part of the real-wiring step.
