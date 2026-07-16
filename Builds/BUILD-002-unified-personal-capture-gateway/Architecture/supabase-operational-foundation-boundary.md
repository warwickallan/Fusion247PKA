---
build: BUILD-002
component: Capture & Conversation Gateway
wp: WP0
artifact: supabase-operational-foundation-boundary
status: draft-for-wp0
author: mack
created: 2026-07-16
---

# Supabase Operational Foundation — Boundary & WP0 Baseline

Parent build: [[BUILD-002-unified-personal-capture-gateway]]

This artifact draws the operational-platform boundary for the shared Fusion247 Supabase foundation, of which BUILD-002 is the **first adopter**. It is a design/spec only — no project is provisioned, no code is written, and no real secrets are handled here. Supabase is **settled** (Warwick's decision); this document does not re-open it, does not compare it to a local queue, and defines only the smallest reusable baseline needed now.

## 0. Source-of-truth boundary (fixed, non-negotiable)

Supabase is **operational infrastructure only**. It carries captures *in flight* — never the canonical record of durable knowledge.

| Layer | Authority | Holds |
|---|---|---|
| Markdown / myPKA / Obsidian | Canonical durable **general knowledge** | The Brain — final, human-readable notes |
| Git | Code / commits / CI / shipped artefacts | The gateway + worker code, this spec |
| ClickUp | Delivery / governance | Tasks, build control, editorial mirror |
| **Supabase** | **Operational infrastructure** | Intake envelopes, queue, processing state, idempotency keys, evidence pointers, private raw objects |

**Guardrail:** Supabase must never silently become a competing canonical Brain. Its records are transient operational state; once the local worker performs the governed Markdown write and records an evidence pointer, Markdown is authoritative. Supabase rows may be retained for audit/idempotency but are never *read back as knowledge*. Any future read path that treats a Supabase row as durable knowledge is a boundary violation and requires a separate authority decision.

> Fusion Health is **not** in scope and is not coupled here. Any health-data consumer requires a separate health-data authority / privacy / security decision before it touches this foundation.

## 1. Project / environment boundary (what WP0 establishes)

WP0 establishes **one** Supabase project representing the shared Fusion247 operational foundation, with a **single environment** stood up first (`dev`/`staging`-grade — non-production, synthetic data only until the Vex security gate passes). A production environment is a later, gated promotion — not part of WP0.

- One project = the shared platform. BUILD-002 is its first schema tenant, not its owner. Schema is namespaced so later consumers attach without forking the project.
- Channel-neutral from row one: nothing in the schema names "Telegram". Telegram is one `channel` value among future many.
- Access is least-privilege and role-separated (see §2): the intake API, the local worker, and any admin migration each get distinct credentials.

### 1.1 Minimal logical schema areas

Described as an **operational data model**, not knowledge. Names are indicative; final DDL is a delegated Silas/Larry step (Mack does not run migrations solo — critical rule #7).

1. **Intake envelope records** — one row per accepted capture. Channel-neutral fields: `envelope_id`, `channel` (e.g. `telegram`), `channel_ref` (opaque per-channel handle, e.g. chat/message id), `submitted_by` (authorised user id), `received_at`, `payload_kind` (`text` now; `image`/`audio` reserved, not built), `payload_text`, `raw_object_ref` (nullable pointer into storage, §1.1.6), `client_dedup_key`, `status_fk`.
2. **Processing-state / queue** — the work list the local worker pulls from. `envelope_id`, `state` (`accepted` → `queued` → `claimed` → `writing` → `completed` | `failed` | `dead_letter`), `claimed_by`, `claimed_at`, `lease_expires_at` (lease so a crashed worker's claim auto-releases), `attempt_count`, `next_attempt_at`, `last_error`. State transitions are append-safe and monotonic where possible; "completed" is only ever set *after* the Markdown write + evidence pointer both exist.
3. **Idempotency keys** — `dedup_key` (unique constraint) derived from `channel` + `channel_ref` (+ content hash). Guarantees a re-fired webhook or a re-sent client message maps to the *same* envelope, never a duplicate. The write side is also idempotent (§3).
4. **Operational relationships** — thin foreign keys tying envelope → processing-state → evidence, plus `channel_identity` (which authorised principal on which channel). This is operational graph only; it is **not** the PKM relational model and must not mirror entity notes.
5. **Evidence pointers** — `envelope_id`, `evidence_kind` (`markdown_write`, `git_commit`, `card_update`), `target_ref` (path/commit-sha/message-id — a *pointer*, not the content), `created_at`. Proves the capture reached its governed destination without copying the knowledge into Supabase.
6. **Raw-object storage bucket** — a **private** Supabase Storage bucket for raw source bytes that don't belong inline (future images/audio; oversized text). WP0 keeps text inline and provisions the bucket private-by-default with no public URLs; access only via short-lived signed URLs minted server-side. `raw_object_ref` in the envelope points at the object key.

All areas are channel-neutral, reusable, and deliberately minimal. No speculative tables (no email tables, no multimodal-extraction tables, no per-bot facade tables) are created now.

## 2. Secret-handling approach

**Principle:** secrets live in a secret manager / environment injection layer — **never** committed to Git, never in Markdown, never in ClickUp, never in a session-log. This mirrors Mack critical rules #1 and #6.

| Secret | Consumer | Scope / least-privilege |
|---|---|---|
| Supabase `service_role` key | Local worker + intake API server side only | Full DB/storage; **never** ships to any client. Server-injected env only. |
| Supabase `anon`/publishable key | Client edge (intake API front) | Constrained by Row-Level Security; cannot bypass RLS. |
| Telegram bot token | Intake/webhook edge | Only the channel adapter needs it. Masked in every echo. |
| Worker auth credential | Local Larry-worker → platform | Dedicated principal, least-privilege: read queue, claim, transition state, write evidence, read raw objects. No admin/migration rights. |

- **Storage location (recommended):** OS keychain / a secret manager for local dev; environment injection (`.env` outside any tracked path, chmod 600; or a managed secret store) for the worker and API. A committed `.env.example` carries **key names only**, never values.
- **Rotation & least-privilege:** every secret is rotatable without code change (read from env at startup, fail-fast if missing — critical rule #5). Distinct credentials per role so one leak does not compromise all. Rotation procedure is documented, keys are short-lived where the platform supports it (signed URLs, worker leases).
- **Gate:** **real secrets are introduced only AFTER the Vex security gate passes.** Until then, all wiring uses synthetic / non-sensitive fixtures (fake tokens, a throwaway synthetic project or local Supabase, dummy user id). This spec assumes fixtures throughout.

## 3. Local Larry-worker seam (worker communication pattern)

A **local** Larry-worker is the only component that performs the governed Markdown write. The seam is designed so captures stay safe while that worker is offline and Telegram always shows the true state.

**Pull model (recommended for WP0):** the worker *pulls* from the queue rather than receiving a push. A local worker behind no public ingress cannot reliably receive webhooks; pulling keeps the worker firewall-friendly and lets it resume cleanly after any outage.

Cycle:
1. **Claim** — worker atomically claims the oldest `queued` envelope: transition `queued → claimed`, set `claimed_by`, `lease_expires_at`. Atomic claim (single-row conditional update / `for update skip locked`-style) prevents double processing.
2. **Write** — transition `claimed → writing`; perform the governed Markdown write into the canonical destination (the real write is Silas/PKM territory and follows PKM governance — the worker executes the governed write, it does not invent structure).
3. **Evidence** — record the evidence pointer(s) (markdown path, git commit sha, card id).
4. **Complete** — transition `writing → completed` **only after** steps 2 and 3 both succeed. Then the channel card is edited to "Completed".
5. **Fail/retry** — on error, transition to `failed` with `attempt_count++`, `next_attempt_at` = exponential backoff (critical rule #4); after N attempts → `dead_letter` for human review. Never a silent drop.

**Offline behaviour (the safety contract):**
- A capture accepted into Supabase is **durable** the instant intake returns success — independent of worker liveness.
- While the worker is down, the envelope simply sits `queued`; the Telegram card shows **"safe and waiting"**, never "Completed". No false completion is ever possible because `completed` is gated on the write+evidence existing.
- On restart the worker resumes idempotently: claims expire via `lease_expires_at` so a crash mid-`claimed` auto-releases the row; the idempotency key + evidence-pointer check means a half-done item is not re-written twice (the write step checks for an existing evidence pointer / target before writing).
- Resume is **idempotent end-to-end**: re-processing an envelope that already has a `markdown_write` evidence pointer is a no-op that advances state to `completed`.

## 4. Client / API interaction (channel-neutral intake)

All clients attach to **one neutral intake contract**. Telegram gets **no special path** in the backend.

- **Intake API** accepts a channel-neutral envelope: `{ channel, channel_ref, submitted_by, payload_kind, payload_text | raw_object_ref, client_dedup_key }`. It authenticates the caller, enforces the single-authorised-user rule (WP0), writes the intake envelope + queue row under an idempotency key, and returns "accepted" (the durable-safe signal the card renders as "safe and waiting").
- **Telegram (now)** is a **thin channel adapter**: it receives the Telegram update, verifies it, maps it onto the neutral envelope, and calls the same intake API. All Telegram-specific knowledge (bot token, chat ids, card-edit calls) lives in the adapter, never in the backend/schema.
- **Future clients (Control Hub, Wrist Capture, specialist bot facades)** attach by writing their own thin adapter that produces the same neutral envelope. The backend, queue, idempotency, worker, and evidence model are unchanged. Adding a channel = adding an adapter + a new `channel` value, not a schema change.
- Card-state rendering (safe-and-waiting → completed) is derived from the platform's processing-state, so every channel that can display state shows the *same* truth.

## 5. Repository / module placement (recommendation)

Application code (gateway API, Telegram adapter, local worker) **must not live inside `PKM/`** — `PKM/` is canonical knowledge, and this myPKA folder is markdown-only by contract (Mack critical rules #2 and #8).

**Recommendation:** place the gateway + worker as a **neutral, non-PKM module** — either:
- (a) a `services/` (or `platform/`) module in this repo, clearly outside `PKM/` and `Team*/`, with its own build/deps isolated from the markdown Brain; or
- (b) a **separate repository** (e.g. `fusion247-capture-platform`), which better matches the "shared Fusion247 infra reused across many builds" reality and keeps the operational platform's CI/deps fully decoupled from the Brain.

Mack's lean: **(b) a separate repo** for the shared platform, given the cross-build reuse in §6 — it is the cleaner long-term home for infra many builds depend on. But the **final placement is a delegated Larry WP0 decision**; this artifact only records the recommendation and its rationale. Either way, secrets follow §2 (never committed) and the markdown Brain gains no build step.

## 6. Cross-build reuse obligations

This Supabase foundation is **shared Fusion247 infrastructure**, built once here and reused — not re-created per build.

Likely consumers:
- IDEA-007 (ObsidiWikAi)
- IDEA-008 (Control Hub)
- IDEA-009 (Wrist Capture)
- BUILD-003 (identifier / write-contract alignment)
- VlogOps
- future specialist bot facades

**Rule:** future builds **reuse this platform** — the same intake contract, queue, idempotency model, identity/auth roles, raw-object store, and evidence model. They do **not** stand up competing queues, competing identity/auth, competing raw stores, or divergent capture contracts. Extensions go *into* this foundation (new `channel` values, new adapters, additive schema areas via governed migration), preserving channel-neutrality. Fusion Health is only a *possible* later consumer and is explicitly **not** coupled now (see §0).

## 7. WP0 scope — established now vs. deferred

**Established now (WP0):**
- One Supabase project, one non-production environment (synthetic data only pre-Vex).
- Minimal channel-neutral schema areas: intake envelopes, processing-state/queue, idempotency keys, operational relationships, evidence pointers, one private raw-object bucket (provisioned, text-inline for now).
- Role-separated least-privilege credential model + secret-handling approach (fixtures until Vex passes).
- Neutral intake API contract + Telegram thin adapter.
- Local Larry-worker pull/claim/write/evidence/complete cycle with offline-safe, idempotent, no-false-completion guarantees.
- Repo/module placement recommendation (final choice = delegated Larry WP0 decision).

**Deferred — NOT authorised now (links/dependencies preserved only, nothing pre-built):**
- Email intake channel.
- Multimodal extraction (image/audio → structured content). Bucket + `payload_kind` reserved, not implemented.
- Specialist bot facades.
- Control Hub (IDEA-008) and Wrist Capture (IDEA-009) clients — will attach later via the neutral contract.
- Production environment promotion.
- Health data / Fusion Health — requires a separate authority / privacy / security decision; **no coupling implied**.

## 8. Hand-off notes

- **Vex** owns the security gate: no real secrets, no production data, and no real Telegram/Supabase keys enter until Vex passes. Review targets: RLS on the intake path, private-bucket + signed-URL posture, worker least-privilege, secret-injection (no committed secrets), replay/idempotency on the webhook adapter.
- **Silas** owns the actual schema DDL / migrations and the governed Markdown write shape — Mack does not run migrations or design the PKM write solo (critical rule #7). The operational data model above is the input; Silas ratifies and implements the schema.
- **Larry** owns the delegated WP0 decisions flagged here: final repo/module placement (§5) and DDL sign-off scheduling.
