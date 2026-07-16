---
name: Foundation and live text proof
build: BUILD-002
wp_number: WP0
status: in-progress
substatus: fixtures baseline merged to main; live phone-visible proof pending
authorised_by: Warwick
authorised_date: 2026-07-16
owner: larry
blocking_dependencies:
  - SECURITY.md §7 pre-live-wiring hardening (rate-limit, access logging, restrictive RLS policies, retention enforcement)
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
- **Fixtures-only baseline: implemented, independently reviewed, security-cleared, and MERGED to `main`.** `services/fusion-capture-gateway/` — plain JS (ESM, Node 22), **zero runtime deps**, **101 tests passing** (`node --test`, verified directly on `main` post-merge), **enforced in CI** (`.github/workflows/fusion-capture-gateway-tests.yml`). Capabilities: channel-neutral Envelope/Action/Receipt v1; 14-state durable saga incl. **autonomous bounded retry with deterministic backoff, then dead-letter**; durable intake commit point + idempotent dedup; leased worker with expired-lease reclaim; idempotent sandboxed governed Markdown write; evidence-gated completion; retryable card projection; offline safe-and-waiting; single-user default-deny; GDPR erasure path (robust to a tampered/foreign pointer — the row still erases); traversal-proof write (incl. encoded/platform variants). **No secrets, no network, no real Supabase/Telegram, no personal data.**
- **Merged via PR #28** — merge SHA `087a43813d31062aba63cd5e1e0ec0d42fdfc227`, on `main`.
- **Sonnet 5 independent review-and-fix pass: complete** (2026-07-16). Did not trust the prior checkpoint; established gaps directly from code and tests. Fixed: (1) **the retry mechanism was previously only a test-only helper with no equivalent runtime path** — now `store.claim()` autonomously reclaims a due `failed`/`partial` item via a real deterministic-backoff seam (`src/core/retryPolicy.js`), never before due, never past the attempt cap; (2) migration FK constraint-name fragility — `0001` now explicitly declares the names `0002` manipulates, statically verified; (3) an erasure robustness gap found during review — a tampered/foreign `destination_ref` previously made `erase()` throw and skip deleting the PII-carrying operational row; now caught, logged, and the row still erases. Test suite grew 84→101.
- **Independent review (GrokQA):** PASS WITH CORRECTIONS, no BLOCKER/HIGH findings.
- **Security gate: executed by Vex, twice.** Round 1 FAIL → remediated → round 2 PASS-WITH-CONDITIONS (65-test baseline). Then a **targeted delta review** against every file changed since (21 files: retry mechanism, migration fix, erasure fix, CI) — **PASS, SECURITY DELTA GREEN** (0 CRITICAL/HIGH/MEDIUM/LOW; 5 INFO-only, forward-looking Postgres-indexing notes + positive fix confirmations). No regression in any previously-GREEN control. See [[wp0-security-gate-execution-2026-07-16]] (round 1/2 history) and [[wp0-security-gate-delta-2026-07-16]] (delta review).
- **Merge decision: made by Warwick, explicit instruction ("Proceed with merge"), 2026-07-16**, after the full review chain (Sonnet fix → GrokQA independent review → Vex security delta GREEN) cleared the fixtures-merge bar.
- **Real Supabase/Telegram integration: not provisioned. Live phone-visible proof: pending.**
- All future work toward the live proof uses **synthetic/non-sensitive fixtures** until the `SECURITY.md §7` pre-live-wiring hardening passes and real secrets are provisioned.

## Load-bearing invariant

The offline-safe "no false completion" guarantee is delivered by a **durable state machine / saga with idempotent steps and retryable projections** — not one atomic transaction across Supabase, Markdown/Git and Telegram. Supabase acceptance is the durable commit point; worker claims use leases and recover after expiry; the Markdown write is idempotent; evidence pointers prove canonical-write success; `completed` is set only after evidence exists; Telegram cards are retryable projections and a failed card edit never reverses or duplicates a successful write; recovery resumes from the last evidenced state. See the full invariant in [[BUILD-002-unified-personal-capture-gateway]].

## Next executable action

Complete the `SECURITY.md §7` pre-live-wiring hardening (F-04 rate-limit, F-05 access logging, F-07 restrictive RLS policies, F-08 retention enforcement); stand up the isolated dev environment with managed dev secrets (throwaway dev Telegram bot, dev Supabase project, authorised test identity); Vex re-signs; then the real phone-visible acceptance proof. **WP0 is not complete** until that live proof passes — merging the fixtures baseline is not the acceptance gate.
