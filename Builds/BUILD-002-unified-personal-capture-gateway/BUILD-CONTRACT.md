---
build_id: BUILD-002
title: Unified Fusion Hub — Build Contract / PRD
contract_version: v1.1-draft
pack_version: v1.1-draft
doc_role: contract
approval_pack:
  - BUILD-BRIEF.md
  - BUILD-CONTRACT.md (this file)
  - IMPLEMENTATION-PLAN.md
lifecycle_state: draft_pending_warwick_approval
owner_and_final_approver: Warwick
implementation_owner: Larry
qa: Codex merge QA (independent), with specialist review where risk requires
canonical_readable_record: GitHub Markdown (this file)
operational_version_and_approval_record: Supabase (cockpit.build_contract + cockpit.build_contract_doc)
human_review_and_command_surface: Directus / Vue cockpit
provenance:
  source_instruction: Warwick remote-control order (BUILD-002 Unified Hub resumption), 2026-07-22
  primary_source: "Warwick-supplied ClickUp DRAFT/SOURCE page 06 — WP2 Build Contract / PRD (preserved in full in §1–§20 below; NOT yet Warwick-approved)"
  clickup_doc: 2kxuxw3a-852
  clickup_page_06_build_contract_prd: https://app.clickup.com/90121891946/docs/2kxuxw3a-852/2kxuxw3a-6012
  clickup_page_05_build_brief: https://app.clickup.com/90121891946/docs/2kxuxw3a-852/2kxuxw3a-5992
  foundry_idea_002: https://app.clickup.com/90121891946/docs/2kxuxw3a-732/2kxuxw3a-1132
  retrieval_date: 2026-07-22
tags:
  - build-002
  - unified-fusion-hub
  - build-contract
---

> **Three-document approval pack (v1.1-draft).** This contract is one of three co-approved documents:
> [[BUILD-BRIEF]] (the Warwick-supplied human-readable narrative, executive summary first), this
> **BUILD-CONTRACT** (the full PRD below + Larry's integrated additions), and [[IMPLEMENTATION-PLAN]]
> (Larry's concrete technical delivery approach + workflow + Cairn/LLM execution bridge).
> **Warwick's approval binds the exact pack** — all three committed member hashes + the pack hash.
> A material change to any member creates a new pack version requiring reapproval.
>
> **§1–§20 preserve the Warwick-supplied ClickUp DRAFT/SOURCE page 06 (PRD) in full** (not yet
> Warwick-approved). **Larry's additions** (D1–D6, authority/data boundaries, the WP0–WP7 vertical
> sequence) are in §L1–§L4 and are *appended*, never replacing Warwick's PRD detail. Where Larry has
> corrected a specific requirement (AC1, to name the three pack members and the binding), it is
> flagged inline.

# BUILD-002 — Unified Fusion Hub

## Build Contract / Product Requirements Document

**Status:** Draft for Larry review — not approved and does not authorise implementation
**Owner and final approver:** Warwick
**Implementation owner:** Larry
**QA:** Codex merge QA, with specialist review where risk requires it
**Canonical readable record:** GitHub Markdown
**Operational version and approval record:** Supabase
**Human review and command surface:** Directus / Vue cockpit

## Executive Summary

BUILD-002 will provide one durable Fusion hub connecting multiple input channels, specialist workers, decisions, commands and contextual outputs. DevBot, ShopperBot, forwarded email, voice notes and Directus are distinct front doors with clear intent, but they share one backend contract for provenance, correlation, routing, retries, decisions, evidence and receipts.

The first end-to-end proof is a real YouTube knowledge-ingress journey. Warwick pastes a YouTube URL into Telegram. Fusion preserves the source, routes it through TubeAIR, extracts and stores the full available transcript, creates the existing Karpathy packet, applies the canonical YouTube knowledge-note template, categorises the output through Cairn, adds the governed Markdown note and justified backlinks to the Brain/Obsidian vault, shows a standalone human-readable brief in Directus, and presents suggested learnings with Accept and Decline controls.

The Build must also establish a lightweight acceptance-contract mechanism. This PRD, the Human-Readable Build Brief and Larry's Implementation Plan are versioned in GitHub, projected into Supabase with exact hashes and approval state, and shown in Directus for Warwick's approval. Codex QA uses the approved contract, required tests and exact PR head when assessing merge readiness.

* * *

## 1. Original Outcome

Warwick can send information or instructions through Telegram, email, voice or Directus, and the central Fusion hub safely preserves, routes, processes and returns the result without Warwick manually relaying work between systems.

## 2. Problem

Fusion247 already has working components, including Telegram capture through DevBot, ShopperBot, TubeAIR, AsdAIr, Tower/Codex QA, Supabase/Postgres operational state, Directus/Vue views and governed Markdown/GitHub evidence.

These components are not yet experienced as one product. Warwick still has to remember which interface to use, where a result landed, whether a decision reached Larry, and which system reflects the current state.

BUILD-002 removes that relay burden by introducing one shared event, decision and command spine.

## 3. Product Principles

1. **One hub, several purposeful front doors.** Different bots and interfaces may have different default intent, but they do not become separate backends.
2. **Preserve first, classify second.** Raw input and provenance are durable before semantic processing.
3. **Use context before AI guessing.** Bot identity, explicit commands and deterministic recognition precede bounded classification.
4. **Ask when ambiguity is cheap to resolve.** A/B/C cards are preferred to unsafe guesses.
5. **Cards and dashboards are projections.** Telegram and Directus display durable state; they do not become the state.
6. **Specialists remain specialist.** Reuse TubeAIR, AsdAIr, Cairn, Larry and Tower rather than rebuilding them inside the gateway.
7. **Human approval for durable learning.** Source-derived notes may be generated automatically, but material changes to standing knowledge, skills, rules or instructions require review.
8. **Minimum viable reliability.** No lost inputs, duplicate effects, secret exposure, uncontrolled writes or unprovable completion.

## 4. Build Artefacts and Approval

The Build has three approval artefacts:

1. `BUILD-BRIEF.md`
2. `BUILD-CONTRACT.md`
3. `IMPLEMENTATION-PLAN.md`

GitHub is the canonical readable versioned record.

Supabase records:

*   Build ID;
*   document type and version;
*   GitHub path;
*   Git commit SHA;
*   content hash;
*   approval status;
*   approved by and approved at;
*   superseded version;
*   current WP;
*   structured acceptance criteria and required evidence.

Directus must show the documents in a readable Build page and provide controlled approval or request-changes actions.

Larry reviews the first two artefacts and writes the third. Warwick approves all three before substantial implementation.

## 5. Unified Hub Scope

The central hub must support:

*   authenticated source and actor;
*   stable event and correlation IDs;
*   raw payload and provenance;
*   intentional channel/bot context;
*   route assignment;
*   durable work state;
*   idempotency and duplicate protection;
*   retries, leases and terminal failure state;
*   decision requests and responses;
*   command requests and receipts;
*   artefact/evidence references;
*   contextual outbound projections.

### DevBot

DevBot is the deliberate Brain-facing route. Its default behaviour is to preserve the source, create a watched-inbox item, prepare for Cairn categorisation and produce an honest Telegram receipt.

### ShopperBot

ShopperBot is the shopping-specific facade. It may accept typed lists, list photographs, voice shopping items, corrections and product decisions. Weekly list/item data belongs in AsdAIr/Postgres and must not be copied into the general Brain.

### Watched Inbox and Cairn

The Gateway handles technical/source typing and provenance. Cairn handles semantic categorisation, knowledge destination, related-note discovery, justified backlinks, create-versus-update decisions, clarification requests and routing to actions/questions/specialists.

Cairn consumes one hub queue or view rather than independently polling each channel.

### Directus

Directus is the human review and command surface. It displays durable hub state and writes validated decisions or command requests. It is not the runtime authority or a direct unaudited route into Larry.

## 6. First Walking Skeleton — YouTube Knowledge Ingress

Required route:

```text
Telegram YouTube URL
→ durable inbound event
→ deterministic YouTube classification
→ TubeAIR specialist job
→ immutable RAW transcript
→ Karpathy packet
→ canonical YouTube knowledge template
→ Cairn categorisation
→ governed Markdown/Obsidian note
→ suggested learnings
→ Directus and Telegram projections
```

The phrase previously spoken as "Kaspersky template" is interpreted as the existing TubeAIR Karpathy-format packet plus `F247.template.youtube-transcript-knowledge-note`. No competing template should be invented.

The worker must handle malformed URLs, unavailable captions, private/deleted videos, transient failures, duplicate submission, partial extraction, Obsidian unavailability and corrupt local state honestly.

## 7. Obsidian on the Yoga

Install the current official Windows release of Obsidian on the Yoga.

Requirements:

*   open the governed canonical Markdown vault;
*   do not create a second Brain copy;
*   preserve Git-compatible paths and wikilinks;
*   install only the minimum approved local API capability;
*   bind the API to localhost;
*   require authentication;
*   keep secrets outside Git, ClickUp, Supabase documents and logs;
*   support read, search, write, metadata inspection and open-note operations;
*   queue work honestly if Obsidian or the API is unavailable;
*   prove agreed restart/startup behaviour.

## 8. Knowledge Output

The processed note must:

*   preserve the complete available RAW transcript separately;
*   not be a transcript dump;
*   not be a thin summary;
*   preserve substantive knowledge;
*   remove filler and repetition;
*   include metadata and provenance;
*   stand alone without the video;
*   capture mechanisms, workflows, tools, people and examples;
*   separate claims from verified facts;
*   record uncertainty and source gaps;
*   separate source content from Fusion247 interpretation;
*   include justified backlinks;
*   avoid empty low-value stubs;
*   include proposed actions, questions and learnings;
*   carry an honest review state.

## 9. Suggested Learnings

Learning candidates may propose:

*   updating an existing note;
*   creating a concept/entity note;
*   creating or revising a skill;
*   altering an agent instruction;
*   adding a standing rule;
*   creating a Foundry Idea;
*   adding an action or open question;
*   verifying a claim;
*   deferring or rejecting a suggestion.

Each candidate must contain a concise recommendation, rationale, evidence/source, proposed target, expected effect, confidence, risk/reversibility, status and correlation ID.

Directus provides Accept and Decline controls. Acceptance creates governed work; it does not silently rewrite protected material.

## 10. Directus Human-Readable Page

Each processed YouTube source must have a stable Directus page showing:

*   title and source metadata;
*   processing and review state;
*   executive orientation;
*   structured knowledge brief;
*   key concepts and takeaways;
*   claims requiring verification;
*   Fusion247 relevance;
*   related notes and backlinks;
*   proposed learnings;
*   source gaps;
*   RAW transcript link;
*   Obsidian/canonical Markdown link;
*   Git evidence where relevant.

It must be readable on desktop and the S21.

## 11. Telegram Decisions and Receipts

Telegram cards must reflect durable state and may show safely received, queued, processing, review ready, completed or failed with an honest reason.

A/B/C answers must be durably correlated to the original work item, visible to Larry/the specialist and capable of waking or continuing the correct process.

## 12. Directus Commands to Larry

Required route:

```text
Directus/Vue action
→ validated command_request
→ central queue
→ Larry or named worker
→ execution/result event
→ receipt in Directus and/or Telegram
```

Prove at least one safe command, such as retrying a failed YouTube job or applying an accepted learning candidate.

## 13. Email and Voice Boundaries

After the YouTube walking skeleton works, prove bounded adapter routes:

*   one forwarded email or safe fixture path entering the same hub with source metadata preserved;
*   one voice note preserved, transcribed and routed or clarified through A/B/C.

These are adapter proofs, not full email or voice platforms.

## 14. Objectives

1. Establish one coherent Fusion input/decision/command hub.
2. Remove Warwick's manual relay between channels and workers.
3. Deliver a complete YouTube-to-Brain vertical slice.
4. Make source-derived knowledge readable in Obsidian and Directus.
5. Make learning proposals reviewable rather than silently applied.
6. Give Larry durable Telegram and Directus decisions/commands.
7. Establish the lightweight Build-contract and approval mechanism.
8. Give Codex QA a bounded approved contract at merge time.

## 15. Explicit Non-Goals

This Build does not include autonomous merge, Asda checkout/payment, automatic substitutions, automatic permanent learning without approval, a full email client, a native Fusion app, full Health/CareerAIr integration, a second Brain, public Obsidian API exposure, paid Obsidian Sync/Publish, uncontrolled plugin installation, generic multi-user platform design, rebuilding TubeAIR/AsdAIr/Tower/Directus, backlink spam, empty stubs or ClickUp retirement.

## 16. Acceptance Criteria

### AC1 — Approved Build Pack *(corrected by Larry per Warwick+GPT review, 2026-07-22)*

*   The three approval documents exist in GitHub as versioned Markdown: **`BUILD-BRIEF.md`**, **`BUILD-CONTRACT.md`** and **`IMPLEMENTATION-PLAN.md`**.
*   Supabase records, for **each** of the three members, the exact GitHub path, Git commit SHA, Git blob SHA and content sha256, plus the **pack content hash** binding all three.
*   Directus displays **each** document as readable Markdown (body, not merely path/hash), showing each member's path, commit, blob and sha256, and the pack identity/hash.
*   Warwick can Approve or Request-changes; the control binds **all three exact members, their Git identities and the pack hash**.
*   A material change to **any** member creates a new pack version requiring reapproval; approval to one version never carries to another.

### AC2 — Obsidian Operational

*   Obsidian is installed on the Yoga.
*   The governed canonical vault opens.
*   Existing Markdown/backlinks remain intact.
*   The local API is authenticated and localhost-only.
*   A worker can read, search, write and open a test note.
*   An outage queues work and does not lose the input.

### AC3 — YouTube End-to-End

Using a real suitable YouTube URL:

*   Telegram creates one durable event.
*   The URL is classified and routed automatically.
*   The full available transcript is extracted with timestamps where available.
*   RAW transcript and provenance are preserved immutably.
*   The Karpathy packet is produced.
*   The canonical YouTube knowledge template is applied.
*   A standalone knowledge note is created.
*   Cairn categorises and routes it.
*   The note is added to the governed Brain/Obsidian vault.
*   Justified backlinks are present.
*   Claims and uncertainty remain honest.
*   The originating Telegram card ends with truthful status and links.

### AC4 — Directus Review Experience

*   The processed source has its own readable Directus page.
*   The page works on desktop and S21.
*   Suggested learnings are readable with evidence.
*   Warwick can Accept or Decline each suggestion.
*   Decisions are durable and correlated.

### AC5 — Bidirectional Control

*   One Telegram A/B/C answer becomes a durable decision.
*   Larry or the specialist receives it without manual relay.
*   One safe Directus command reaches the hub and returns a receipt.

### AC6 — Reliability

*   Duplicate URL delivery creates no duplicate notes, transcripts or effects.
*   Restart during processing reconstructs and completes safely.
*   Exhausted failures do not repeatedly hammer YouTube.
*   A failed card update does not reverse completed durable work.
*   No false completion is shown.

### AC7 — Regression

*   Existing DevBot Save-to-Brain flow remains working.
*   TubeAIR tests remain green.
*   AsdAIr tests remain green.
*   Tower/Directus controls remain safe.
*   No private data or secrets enter the public repository.
*   Existing canonical notes are not silently overwritten.

### AC8 — Bounded Email and Voice Proofs

*   One email/fixture enters the hub with source metadata preserved and is routed correctly.
*   One voice input is preserved and transcribed.
*   Ambiguous voice intent can be resolved by A/B/C and routed correctly.

### AC9 — Codex Merge QA

Codex receives the BUILD ID, approved contract version/hash, exact PR head SHA, scope/non-goals, acceptance criteria, required tests/evidence, actual CI/evidence, Larry's completion claim and declared exceptions.

Missing approval, hash mismatch, moved head or missing mandatory evidence fails closed.

## 17. Required Evidence

At completion, the PR must provide approved document versions/hashes, exact branch/PR/head, Directus desktop/S21 proof, Telegram card references, RAW transcript and processed-note paths, Obsidian API proof, duplicate/restart proof, CI results, a safe Directus command receipt, A/B/C decision evidence, known limitations and deferred work.

## 18. Implementation Sequence Constraint

Larry writes the detailed implementation plan, but the delivery must remain vertical:

1. Build pack storage and Directus approval.
2. Obsidian and local API proof.
3. YouTube URL to complete knowledge note.
4. Suggested-learning review loop.
5. Telegram decisions and safe Directus command.
6. Shopper integration.
7. Bounded email and voice routes.
8. Restart, duplicate and merge-QA proof.

Do not spend the opening phase building a complete generic platform before the YouTube walking skeleton is visible.

## 19. Parking Point

Stop when the three Build artefacts are approved and version-bound, Obsidian/API work, the YouTube journey passes, learnings can be accepted/declined, Larry receives durable decisions/commands, bounded Shopper/email/voice routes pass, restart/duplicate tests pass and Codex returns `READY_TO_MERGE` at the exact PR head.

Later Health, CareerAIr, browser-shopping and native-app work require separate authorised slices.

## 20. Approval Sequence

1. Warwick reviews and approves `BUILD-BRIEF.md`.
2. Warwick reviews and approves `BUILD-CONTRACT.md`.
3. Larry reviews both and writes `IMPLEMENTATION-PLAN.md`.
4. Warwick reviews and approves Larry's plan.
5. GitHub and Supabase record exact approved versions and hashes.
6. Larry begins substantial implementation.
7. Codex QA checks the final PR against the approved contract and exact head.
8. Warwick makes the merge decision.

---

# Larry's additions (integrated — appended, not replacing the PRD above)

## §L1 — Material decisions & constraints

- **D1 — One BUILD, several front doors.** BUILD-002 is the umbrella; no competing gateway/Brain/store/control-plane is created. Reuse the merged gateway (`services/fusion-capture-gateway`, `fcg.*`), TubeAIR, AsdAIr, Tower and Directus components.
- **D2 — WP0 contract record lives in the live `cockpit` schema, not the DEV-only `ops` model.** The rich `ops.*` contract-acceptance model (control-plane migrations 001–006) is explicitly DEV-schema-only and encodes *reviewer* verification (which structurally forbids Warwick from writing). Warwick's *contract sign-off* is a different concern, so WP0 uses `cockpit.build_contract` (+ `cockpit.build_contract_doc` for readable bodies) + a decision/command approval path reusing the live write-back seam. (Larry's delegated schema decision.)
- **D3 — "Kaspersky template" interpreted** as: existing TubeAIR Karpathy packet + canonical `F247.template.youtube-transcript-knowledge-note` + current immutable-source/classification/backlink rules. No new template invented.
- **D4 — RAW ≠ processed note.** RAW is the complete, timestamped, immutable evidence; the processed note is a standalone knowledge reconstruction, never a transcript copy or thin summary.
- **D5 — Threat bar.** First-party, non-adversarial personal hub: built for correctness, accidental-leak safety, availability, and audit-integrity — not adversarial hardening.
- **D6 — Three-document approval pack (Warwick, 2026-07-22).** Brief + Contract + Plan are co-approved; approval binds the exact pack (all three member Git identities + the pack hash); a member change is a new pack version. Supersedes the interim single-document contract.

## §L2 — Authority & data boundaries

- **Source-of-truth boundary (fixed):** Git/Markdown/Obsidian = canonical durable knowledge; Supabase = operational infrastructure + approved-version/QA record (never the only copy of the contract, never a competing Brain); approved domain stores (`asdair`, etc.) = governed structured records; Directus/Telegram = projections of durable hub state, never authoritative.
- **Approval semantics:** Warwick is the sole contract approver. Directus **inserts a decision/command request**; it does not directly rewrite approval history or runtime truth — a worker/Larry applies the approval bound to the exact pack version + member Git identities + pack hash.
- **Learning governance:** source-derived notes may be created automatically with an honest review state (`ai_created` / `pending_warwick_review`); material changes to canonical notes, standing rules, skills, agent instructions or policy become reviewable learning candidates, never silent edits.
- **Secrets:** Obsidian API key and any credentials live in the Yoga secret store only — never in Git, logs, ClickUp, PR text, Supabase, or Markdown.
- **Personal data:** the Fusion247PKA repo is PUBLIC; personal/entrusted data (e.g. AsdAIr household) stays in the private domain store + gitignored-local, never in Git.
- **Live actions:** building code and opening one integration PR is authorised; **merge to main and any live-sensitive/irreversible/credential/paid action return to Warwick.**

## §L3 — WP0–WP7 vertical sequence (Larry's delivery structure for §18)

| WP | Slice | Gate |
| --- | --- | --- |
| WP0 | Contract pack → Supabase draft → Directus approval + operational apply-worker | Warwick approval before substantial implementation |
| WP1 | Obsidian install + secure localhost API + `VaultWriter` | Secret-safe; outage-queues; reboot recovery (AC2) |
| WP2 | YouTube URL → RAW → knowledge note → Directus → Telegram | Walking-skeleton journey + duplicate + restart (AC3, AC6) |
| WP3 | Suggested-learning Accept/Decline loop | Durable governed decision events (AC4) |
| WP4 | Directus → Larry safe command + Telegram A/B/C | Audited command spine (AC5) |
| WP5 | Shopper route (AsdAIr) | No auto-substitute / no checkout (AC7-adjacent) |
| WP6 | Bounded email (fixture-first) + voice adapters | Metadata-preserving adapter proofs (AC8) |
| WP7 | Restart / duplicate / exact-head Codex merge QA | `READY_TO_MERGE` at exact head (AC6, AC9) |

## §L4 — Contract version

**v1.1-draft** (pack member) — the full Warwick-supplied ClickUp draft/source PRD (page 06) restored in §1–§20, with Larry's additions integrated in §L1–§L4 and AC1 corrected to name the three pack members and the binding. Supersedes v1.0-draft (and the interim single-document v0.1-draft). Not approved; does not authorise substantial implementation. Warwick's approval via Directus binds the **exact three-document pack** (BUILD-BRIEF + BUILD-CONTRACT + IMPLEMENTATION-PLAN, each by committed Git SHA + blob + content sha256, plus the pack hash) before substantial build begins.
