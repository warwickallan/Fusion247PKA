---
name: Foundation and live text proof
build: BUILD-002
wp_number: WP0
status: in-progress
substatus: foundation designed; live phone-visible proof pending
authorised_by: Warwick
authorised_date: 2026-07-16
owner: larry
blocking_dependencies:
  - WP0 security gate (Vex) must pass before real secrets / live proof
  - Supabase project provisioning + Telegram bot token (real secrets)
tags:
  - build-002
  - wp-0
---

# WP0 — Foundation and live text proof

> Parent build: [[BUILD-002-unified-personal-capture-gateway]]. Only this work package is authorised. Later packages are separately gated.

## Outcome

A real Telegram text capture travels through the complete system and returns a useful, evidenced result to the same Telegram conversation.

## What WP0 establishes

- authority and source-of-truth matrix — [[source-of-truth-and-authority-matrix]] ✅ drafted;
- Supabase project/environment boundary + secret-handling approach — [[supabase-operational-foundation-boundary]] ✅ drafted;
- identity and single-user access control — [[wp0-security-gate]] ✅ defined;
- Capture Envelope v1, Capture Action v1, Capture Receipt v1, processing states, idempotency/retry — [[capture-contract-pack-v1]] ✅ drafted;
- privacy and retention classes — [[source-of-truth-and-authority-matrix]] ✅ drafted;
- honest worker-offline behaviour + local Larry-worker seam — [[supabase-operational-foundation-boundary]] ✅ specified;
- raw text preservation, one Telegram action card, one governed permanent **Markdown** write, evidence returned to the original card — ✅ implemented in the **fixtures baseline** (`services/fusion-capture-gateway/`, sandboxed); live wiring pending.

## Acceptance gate (cannot close on diagrams, mocks or synthetic tests alone)

```text
Telegram text
→ immediate actionable card
→ Warwick chooses Save to Brain
→ source safely accepted
→ Larry processes it without manual relay through GPT
→ governed Markdown destination updated
→ evidence created
→ original Telegram card updated to Completed
```

When the local worker is unavailable, the card must state the item is **safe and waiting** and must never report false completion.

## Status

- **Foundation design: complete.** Contract pack, authority matrix, Supabase boundary, and security gate drafted (see artifacts above).
- **Fixtures-only baseline: implemented** at `services/fusion-capture-gateway/` — plain JS (ESM, Node 22), **zero runtime deps**, **84 tests passing** (`node --test`), secret-scan CI green. Capabilities: channel-neutral Envelope/Action/Receipt v1; 14-state durable saga incl. **dead-letter / retry-exhaustion**; durable intake commit point + idempotent dedup; leased worker with expired-lease reclaim; idempotent sandboxed governed Markdown write; evidence-gated completion; retryable card projection (+ card-retry entrypoint); offline safe-and-waiting; single-user default-deny; GDPR erasure path; traversal-proof write. **No secrets, no network, no real Supabase/Telegram, no personal data.** Implementation PR: **#28** (open).
- **Security gate: executed by Vex** — round 1 FAIL → remediated → **round 2 PASS-WITH-CONDITIONS** (0 CRITICAL, 0 open HIGH) against the then-65-test baseline; see [[wp0-security-gate-execution-2026-07-16]]. The dead-letter + regression additions post-date that run and warrant a light Vex re-touch. Remaining conditions are pre-live-wiring hardening (`SECURITY.md §7`).
- **Sonnet review/fix pass: pending** (next). **Real Supabase/Telegram integration: not provisioned. Live phone-visible proof: pending.**
- **Known limitation (for review/WP1):** the state machine has no `failed → queued` edge, so a `failed` (reclaimable) item needs an external retry-scheduler (`requeueForRetry` in tests) to re-enter — dead-lettering at the cap works; automatic reclaim of a transient `failed` is a WP1 decision.
- All work uses **synthetic/non-sensitive fixtures** until the gate re-touch passes and real secrets are provisioned.

## Load-bearing invariant

The offline-safe "no false completion" guarantee is delivered by a **durable state machine / saga with idempotent steps and retryable projections** — not one atomic transaction across Supabase, Markdown/Git and Telegram. Supabase acceptance is the durable commit point; worker claims use leases and recover after expiry; the Markdown write is idempotent; evidence pointers prove canonical-write success; `completed` is set only after evidence exists; Telegram cards are retryable projections and a failed card edit never reverses or duplicates a successful write; recovery resumes from the last evidenced state. See the full invariant in [[BUILD-002-unified-personal-capture-gateway]].

## Next executable action

A fresh **Sonnet 5** review-and-fix pass over the fixtures baseline in PR #28 (correctness, contracts, the `failed → queued` reclaim decision, and any defects). Then: light Vex re-touch over the dead-letter/regression additions; complete the `SECURITY.md §7` pre-live-wiring hardening (rate-limit, access logging, restrictive RLS policies, retention enforcement); stand up the isolated dev environment with managed dev secrets; then the real phone-visible acceptance proof. **WP0 is not complete** until that live proof passes.
