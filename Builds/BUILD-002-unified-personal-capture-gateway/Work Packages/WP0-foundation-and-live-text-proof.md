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
- raw text preservation, one Telegram action card, one governed permanent **Markdown** write, evidence returned to the original card — pending live implementation.

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
- **Live implementation + phone-visible proof: pending.** Requires: (1) Vex security gate executed GREEN against the built baseline; (2) real Supabase project + Telegram bot token provisioned as managed secrets (never committed); (3) gateway + local worker implemented; (4) the real phone-visible acceptance run.
- Until the security gate passes, all work uses **synthetic/non-sensitive fixtures** — no real bot token, no production keys, no real personal data.

## Load-bearing invariant

The offline-safe "no false completion" guarantee is delivered by a **durable state machine / saga with idempotent steps and retryable projections** — not one atomic transaction across Supabase, Markdown/Git and Telegram. Supabase acceptance is the durable commit point; worker claims use leases and recover after expiry; the Markdown write is idempotent; evidence pointers prove canonical-write success; `completed` is set only after evidence exists; Telegram cards are retryable projections and a failed card edit never reverses or duplicates a successful write; recovery resumes from the last evidenced state. See the full invariant in [[BUILD-002-unified-personal-capture-gateway]].

## Next executable action

Execute the WP0 security gate ([[wp0-security-gate]]) against the first implemented baseline (fixtures only), then provision real secrets and implement the Telegram text round-trip to the point of the phone-visible proof.
