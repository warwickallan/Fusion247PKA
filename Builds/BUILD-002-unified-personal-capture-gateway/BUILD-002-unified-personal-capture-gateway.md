---
name: Unified Personal Capture Gateway
build_id: BUILD-002
promoted_from: IDEA-002
promotion_date: 2026-07-16
authorised_by: Warwick
lifecycle: active
authorised_scope: WP0 only
components:
  - Capture & Conversation Gateway
  - Ingestion & Storage Foundation
operational_foundation: Supabase (shared Fusion247 operational infrastructure)
canonical_store: Markdown / myPKA / Obsidian
owner: larry
tags:
  - build-002
  - capture-gateway
  - fusion247
---

# BUILD-002 — Unified Personal Capture Gateway

> **Production source of truth for this build.** Foundry (IDEA-002) is retained as rationale and provenance only. This record and the ClickUp BUILD delivery surface are canonical for delivery; Git is authoritative for code; Markdown/myPKA remains canonical for durable knowledge. See [[source-of-truth-and-authority-matrix]].

## Executive summary

BUILD-002 gives Warwick the lowest-friction way to capture a thought, source, or instruction from his phone, get an immediate useful response, deliberately decide what becomes durable knowledge, and see honest completion evidence — without later opening a PC and manually relaying work to Larry.

It is **one visible BUILD with two internal components** sharing one versioned contract family and one end-to-end acceptance gate:

1. **Capture & Conversation Gateway** — Telegram-first conversational cockpit. Records Warwick's requested action and performs deterministic *technical* source typing only. It does **not** decide semantic meaning or permanent destination.
2. **Ingestion & Storage Foundation** — accepts, preserves, queues and processes captures on the shared Supabase operational foundation, and hands governed classification/routing to existing specialists (Cairn, Penn, Silas, Larry). **CategorisAIr is not recreated.**

## Confirmed decisions (settled — do not reopen)

- One visible BUILD, two internal components, one shared contract family, one acceptance gate.
- **Telegram** is the first conversational cockpit; the architecture underneath is channel-neutral (not Telegram-specific).
- The gateway records intent (Larry Direct / Save to Brain / Confirmed Action) + technical source typing; semantic classification and permanent routing stay with existing myPKA specialists.
- **Supabase is selected** as the shared Fusion247 **operational** foundation. BUILD-002 is its first adopter and establishes the governed reusable baseline once.
- **Source-of-truth boundary (fixed):** Supabase = operational infrastructure only; Markdown/myPKA/Obsidian = canonical durable general knowledge; approved domain stores = governed structured records; Git = code/history; ClickUp = delivery/governance. **No component may silently become a competing canonical Brain.**
- WP0 and WP1 begin with one authorised user and one Larry/Fusion bot. Specialist bot facades are later, optional, and share this backend.
- Originals are retained throughout the initial build. Captures stay safe while the local worker is offline, and Telegram shows the true state — never false completion.
- External-system changes require explicit confirmation. IDEA-008 Control Hub remains downstream and must consume this gateway, not reimplement it.

## Architecture & contract foundation (WP0 artifacts)

| Artifact | Owner | Purpose |
| --- | --- | --- |
| [[capture-contract-pack-v1]] | Silas | Capture Envelope v1, Capture Action v1, Capture Receipt v1, processing-state machine, idempotency/retry rules |
| [[source-of-truth-and-authority-matrix]] | Silas | Authority matrix, privacy/retention classes, the canonical-vs-operational guardrail |
| [[supabase-operational-foundation-boundary]] | Mack | Supabase project/environment boundary, secret handling, local worker seam, neutral module placement, cross-build reuse |
| [[wp0-security-gate]] | Vex | The security gate that must pass before real secrets and the live phone proof |

## Load-bearing WP0 invariant — durable state machine / saga (recorded — Larry enforces in build)

Silas and Mack independently converged on the single most fragile point. It is **not** one atomic transaction across Supabase, local Markdown/Git and Telegram — those are separate systems that cannot share a transaction. The correct model is a **durable state machine / saga with idempotent steps and retryable projections**:

- **Supabase acceptance is the durable intake commit point** — once accepted, the item is safe.
- **Worker claims use leases** (`claimed_by`, `lease_expires_at`) and **recover after lease expiry** — a dead worker's claim is reclaimable.
- **Canonical Markdown writes are idempotent** — check for an existing target/evidence before writing, so a resumed worker never double-writes.
- **Evidence pointers prove canonical-write success** (markdown path, git commit sha, card id).
- **`completed` is set only after evidence exists.**
- **Telegram cards are retryable projections of current state** — never the source of truth.
- **Failure to edit a Telegram card never reverses or duplicates a successful Markdown write.**
- **Recovery resumes from the last evidenced state.**

User-facing guarantee unchanged: safe-and-waiting while the worker is offline; never false completion. This is a delegated implementation constraint, not a Warwick decision.

## Work packages

| WP | Name | Status |
| --- | --- | --- |
| [[WP0-foundation-and-live-text-proof]] | Foundation and live text proof | **Authorised — foundation designed; live proof pending** |
| WP1 | Telegram cockpit & Larry communication | Planned — separately gated |
| WP2 | Multimodal capture pack | Planned — separately gated |
| WP3 | Specialist bot facades | Planned — separately gated |
| WP4 | Email adapter & operational hardening | Planned — separately gated |

Only **WP0** is authorised. Later packages are preserved as links/dependencies only, not implemented.

## Cross-build reuse

The Supabase operational foundation is shared Fusion247 infrastructure — future builds reuse it rather than create competing queues, identity models, raw stores or capture contracts. Likely consumers/references: IDEA-007 (ObsidiWikAi), IDEA-008 (Control Hub), IDEA-009 (Wrist Capture), BUILD-003 (identifier & write-contract alignment), VlogOps, future specialist bot facades. **Fusion Health** is a possible later consumer only, requiring a separate health-data authority, privacy and security decision — no coupling implied now.

## BUILD-003 dependency

BUILD-003 (issue #17 — entity/write-contract schema) is **not** a promotion blocker. WP0 reconciles only enough identifier and approved-write behaviour to run its permanent-write step, and for the first live proof uses the already-governed **Markdown** destination rather than waiting on every future structured-domain schema decision.

## Links

- **Foundry provenance (IDEA-002):** https://app.clickup.com/90121891946/docs/2kxuxw3a-732/2kxuxw3a-1132
- **Design rationale & cross-build reuse:** https://app.clickup.com/90121891946/docs/2kxuxw3a-732/2kxuxw3a-4132
- **Promotion & handoff record:** https://app.clickup.com/90121891946/docs/2kxuxw3a-732/2kxuxw3a-4192
- **Larry scaffold-fit comment:** https://app.clickup.com/90121891946/docs/2kxuxw3a-732/2kxuxw3a-3932
- **Delivery tracking:** governed per [[SOP-019-fusion-delivery-tracking]] (ClickUp BUILD folder/list/task + GitHub tracking issues).
