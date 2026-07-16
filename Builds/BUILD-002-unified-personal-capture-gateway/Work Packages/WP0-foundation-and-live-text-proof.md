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
- **Fixtures-only baseline: implemented and independently reviewed.** `services/fusion-capture-gateway/` — plain JS (ESM, Node 22), **zero runtime deps**, **101 tests passing** (`node --test`), now **enforced in CI** (`.github/workflows/fusion-capture-gateway-tests.yml`, not local-only evidence). Capabilities: channel-neutral Envelope/Action/Receipt v1; 14-state durable saga incl. **autonomous bounded retry with deterministic backoff, then dead-letter**; durable intake commit point + idempotent dedup; leased worker with expired-lease reclaim; idempotent sandboxed governed Markdown write; evidence-gated completion; retryable card projection; offline safe-and-waiting; single-user default-deny; GDPR erasure path (robust to a tampered/foreign pointer — the row still erases); traversal-proof write (incl. encoded/platform variants). **No secrets, no network, no real Supabase/Telegram, no personal data.** Implementation PR: **#28** (open, unmerged).
- **Sonnet 5 independent review-and-fix pass: complete** (2026-07-16). Did not trust the prior checkpoint; established gaps directly from code and tests. Fixed: (1) **the retry mechanism was previously only a test-only helper with no equivalent runtime path** — now `store.claim()` autonomously reclaims a due `failed`/`partial` item via a real deterministic-backoff seam (`src/core/retryPolicy.js`), never before due, never past the attempt cap; (2) migration FK constraint-name fragility — `0001` now explicitly declares the names `0002` manipulates, statically verified; (3) an erasure robustness gap found during review — a tampered/foreign `destination_ref` previously made `erase()` throw and skip deleting the PII-carrying operational row; now caught, logged, and the row still erases. Test suite grew 84→101. A Vex delta-review brief covering every changed file is prepared (not yet executed by Sonnet).
- **Security gate: executed by Vex** — round 1 FAIL → remediated → **round 2 PASS-WITH-CONDITIONS** (0 CRITICAL, 0 open HIGH) against the then-65-test baseline; see [[wp0-security-gate-execution-2026-07-16]]. The dead-letter, retry-mechanism, migration, erasure, and CI additions all post-date that run — **a Vex delta re-touch is required** before this baseline is fully security-approved at its current head. Remaining conditions are pre-live-wiring hardening (`SECURITY.md §7`).
- **Real Supabase/Telegram integration: not provisioned. Live phone-visible proof: pending.**
- All work uses **synthetic/non-sensitive fixtures** until the Vex delta re-touch passes and real secrets are provisioned.

## Load-bearing invariant

The offline-safe "no false completion" guarantee is delivered by a **durable state machine / saga with idempotent steps and retryable projections** — not one atomic transaction across Supabase, Markdown/Git and Telegram. Supabase acceptance is the durable commit point; worker claims use leases and recover after expiry; the Markdown write is idempotent; evidence pointers prove canonical-write success; `completed` is set only after evidence exists; Telegram cards are retryable projections and a failed card edit never reverses or duplicates a successful write; recovery resumes from the last evidenced state. See the full invariant in [[BUILD-002-unified-personal-capture-gateway]].

## Next executable action

Vex delta re-touch over every file changed since the round-2 gate execution (commit `6503528`) — the retry mechanism, migration determinism fix, erasure robustness fix, and CI enforcement all post-date that run. Then: complete the `SECURITY.md §7` pre-live-wiring hardening (rate-limit, access logging, restrictive RLS policies, retention enforcement); stand up the isolated dev environment with managed dev secrets; then the real phone-visible acceptance proof. **WP0 is not complete** until that live proof passes.
