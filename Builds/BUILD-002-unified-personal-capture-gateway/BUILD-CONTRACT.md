---
build_id: BUILD-002
title: Unified Fusion Hub — Build Contract
contract_version: v0.1-draft
lifecycle_state: draft_pending_warwick_approval
owner_and_final_approver: Warwick
implementation_owner: Larry
qa: Codex merge QA (independent), with specialist review where risk requires
canonical_readable_record: GitHub Markdown (this file)
operational_version_and_approval_record: Supabase (cockpit.build_contract)
human_review_and_command_surface: Directus / Vue cockpit
provenance:
  source_instruction: Warwick remote-control order (BUILD-002 Unified Hub resumption), 2026-07-22
  clickup_build_doc: 2kxuxw3a-852
  clickup_page_05_build_brief: https://app.clickup.com/90121891946/docs/2kxuxw3a-852/2kxuxw3a-5992
  clickup_page_06_build_contract_prd: https://app.clickup.com/90121891946/docs/2kxuxw3a-852/2kxuxw3a-6012
  foundry_idea_002: https://app.clickup.com/90121891946/docs/2kxuxw3a-732/2kxuxw3a-1132
  foundry_idea_012_convergence: https://app.clickup.com/90121891946/docs/2kxuxw3a-732/2kxuxw3a-5932
  foundry_idea_013_convergence: https://app.clickup.com/90121891946/docs/2kxuxw3a-732/2kxuxw3a-5952
  retrieval_date: 2026-07-22
content_hash: recorded-at-commit-in-supabase-and-commit-message
tags:
  - build-002
  - unified-fusion-hub
  - build-contract
---

# BUILD-002 — Unified Fusion Hub · Build Contract

> **Canonical readable contract.** GitHub Markdown (this file) is authoritative for the contract text.
> Supabase (`cockpit.build_contract`) is the operational approved-version record and structured QA
> source; Directus renders it and carries Warwick's approval. If Supabase and this file's hash ever
> disagree, this file wins and the mismatch fails closed (see §11). Foundry (IDEA-002/012/013) is
> retained as provenance only.

## One-sentence original outcome

**Warwick can send information or instructions through the most natural front door — Telegram (DevBot / ShopperBot), forwarded email, voice note, or the Directus cockpit — and one central Fusion hub safely preserves the source, routes it to the correct specialist, records decisions and evidence, and returns a truthful contextual result, without Warwick manually relaying work between systems.**

## Executive summary

BUILD-002 turns Fusion247's *already-merged* capabilities — the live Telegram capture gateway (`services/fusion-capture-gateway`), TubeAIR (YouTube transcript core), AsdAIr (shopping core), Tower/Codex QA, Supabase, Directus, and the governed Markdown/Obsidian Brain — into **one coherent operational hub**. Different bots and interfaces are purposeful facades over the same backend, not separate platforms.

The first complete vertical proof is **YouTube knowledge ingress**: Warwick pastes a real YouTube URL into Telegram; the hub records it durably, classifies it, routes it through the existing TubeAIR pipeline, preserves the immutable RAW transcript, produces the Karpathy packet, applies the canonical `F247.template.youtube-transcript-knowledge-note`, categorises it through Cairn into the governed Brain/Obsidian vault with justified backlinks, surfaces proposed learnings and a human-readable brief in Directus with Accept/Decline controls, and returns links + honest status to the originating Telegram card — surviving duplicate delivery and restart.

This contract also establishes a **lightweight, bounded build-acceptance mechanism**: this file is versioned in Git (canonical), projected into Supabase with its exact path, commit SHA, content hash and approval state, and shown in Directus for Warwick's approval. Codex merge QA checks the final PR against the exact approved contract version/hash and PR head.

## Visible proof (definition of done for the walking skeleton)

A real YouTube URL entered via Telegram produces, end to end and idempotently: one durable inbound event → deterministic YouTube classification → TubeAIR extraction → immutable RAW transcript (timestamped, provenance-linked) → Karpathy packet → canonical knowledge note in the Brain/vault with justified backlinks → learning candidates + a standalone human-readable brief in Directus (Accept/Decline) → truthful Telegram completion card with links. Duplicate submission creates no duplicate artefacts; a restart mid-processing reconstructs and completes safely.

## Scoped capabilities (in this delivery)

1. **Unified hub contract** — one durable event/decision/command spine: authenticated source+actor, stable correlation ID, RAW payload + provenance, channel/bot context, explicit-or-bounded routing, durable work state, idempotency/leases/retry/dead-letter, decision requests + responses, command requests + receipts, evidence references, contextual outbound projections.
2. **Build-acceptance mechanism (WP0)** — `BUILD-CONTRACT.md` in Git; minimal Supabase approved-version record; Directus contract-review page with Approve / Request-changes bound to the exact version + Git SHA + content hash.
3. **YouTube knowledge ingress skeleton** — reusing TubeAIR; the full flow above.
4. **Suggested-learnings review loop** — learning candidates extracted separately from the knowledge note; Directus Accept/Decline creating durable, governed decision events (never a silent write to protected material).
5. **Bidirectional control** — one Telegram A/B/C answer becoming a durable decision reaching Larry/a specialist without manual relay; one safe Directus command reaching the hub and returning a receipt.
6. **Obsidian on the Yoga** — official Windows release opening the governed canonical vault; minimal authenticated **localhost-only** Local REST API; secret-safe; queue-not-lose on outage; agreed startup/reboot recovery.
7. **Bounded Shopper / email / voice routes** — after the YouTube skeleton: controlled AsdAIr list/item intake (no auto-substitute, no checkout); one watched-mailbox/fixture email adapter preserving source metadata; one voice note preserved + transcribed + A/B/C-routed. Adapter proofs, not full platforms.

## Explicit non-goals (out of scope for this delivery)

Autonomous merge · Asda checkout/payment · automatic substitutions · automatic permanent learning without approval · full email client · native Fusion app · full Health / CareerAIr integration · a second Brain or duplicated vault · public/LAN/tailnet exposure of the Obsidian API · paid Obsidian Sync/Publish · uncontrolled plugin installation · generic multi-user platform · rebuilding TubeAIR / AsdAIr planner / Tower / Directus / the merged capture gateway · replacing the BUILD-014 control plane · retiring ClickUp · backlink spam · auto-created low-value entity stubs.

## Objectives

1. Establish one coherent Fusion input/decision/command hub.
2. Remove Warwick's manual relay between channels and workers.
3. Deliver a complete YouTube-to-Brain vertical slice.
4. Make source-derived knowledge readable in Obsidian and Directus.
5. Make learning proposals reviewable rather than silently applied.
6. Give Larry durable Telegram and Directus decisions/commands.
7. Establish the lightweight build-contract and approval mechanism.
8. Give Codex merge QA a bounded, approved contract at merge time.

## Implementation / WP sequence (vertical slices)

| WP | Slice | Gate |
| --- | --- | --- |
| WP0 | Build contract → Supabase draft record → Directus approval page | **This session.** Warwick approval before substantial implementation. |
| WP1 | Obsidian install + secure localhost API proof | Secret-safe; outage-queues; reboot recovery. |
| WP2 | YouTube URL → RAW → knowledge note → Directus → Telegram | The walking-skeleton acceptance journey. |
| WP3 | Suggested-learning Accept/Decline loop | Durable decision events; governed apply. |
| WP4 | Directus → Larry safe command + Telegram A/B/C decision | Audited command spine. |
| WP5 | Shopper integration (AsdAIr specialist route) | No auto-substitute / no checkout. |
| WP6 | Bounded email + voice adapter routes | Metadata-preserving adapter proofs. |
| WP7 | Restart / duplicate / exact-head Codex merge QA | `READY_TO_MERGE` at the exact head. |

Delivery discipline: **no session spent only on schemas/governance/frameworks unless it immediately unlocks the next live slice.** Do not build a generic platform before the YouTube skeleton is visible. One integration PR by default; do not merge without Warwick.

## Acceptance criteria (principal — the contract passes only if all hold)

- **AC1 — Approved build pack.** `BUILD-CONTRACT.md` (and any companion artefacts Warwick designates) exist in Git; Supabase records exact path, version, commit SHA and content hash; Directus displays the contract clearly; Warwick can Approve or Request-changes; a material change creates a new version requiring reapproval; approval binds to the exact version + SHA + hash.
- **AC2 — Obsidian operational.** Obsidian installed on the Yoga; the governed canonical vault opens; existing Markdown/backlinks intact; the local API is authenticated and localhost-only; a worker can read, search, write and open a test note; secrets appear in no repo/log/ClickUp/Supabase; an outage queues work and loses no input; recovery works through the agreed startup path.
- **AC3 — YouTube end-to-end.** From a real URL: one durable Telegram event; automatic classification + routing; full available timestamped transcript; immutable, provenance-linked RAW transcript; Karpathy packet; canonical template applied; a standalone knowledge note preserving substantive content; Cairn categorisation into the Brain/vault; justified backlinks; honest claims/uncertainty; the originating Telegram card ends with truthful status + links.
- **AC4 — Directus review experience.** Each processed source has its own stable, readable Directus page (works on desktop and S21); suggested learnings are readable with evidence; Warwick can Accept or Decline each; decisions are durable and correlated.
- **AC5 — Bidirectional control.** One Telegram A/B/C answer becomes a durable decision reaching Larry/the specialist without manual relay; one safe Directus command reaches the hub and returns a receipt.
- **AC6 — Reliability.** Duplicate URL delivery creates no duplicate notes/transcripts/effects; a restart mid-processing reconstructs and completes safely; exhausted failures do not hammer YouTube; a failed card update never reverses completed durable work; no false completion is ever shown.
- **AC7 — Regression.** Existing DevBot Save-to-Brain flow still works; TubeAIR, AsdAIr and Tower/Directus tests/controls remain green and safe; no private data or secret enters the public repo; no existing canonical note is silently overwritten.
- **AC8 — Bounded email + voice proofs.** One email/fixture enters the hub with source metadata preserved and is routed correctly; one voice input is preserved and transcribed; ambiguous voice intent resolves via A/B/C and routes correctly.
- **AC9 — Codex merge QA.** Codex receives the BUILD ID, approved contract version/hash, exact PR head SHA, scope/non-goals, acceptance criteria, required tests/evidence, actual CI/evidence, Larry's completion claim, and declared exceptions. Missing approval, hash mismatch, moved head, or missing mandatory evidence fails closed. Codex is QA and does not merge.

## Required tests & evidence (at completion the PR must carry)

Approved contract version + content hash; exact branch / PR / head SHA; Directus desktop + S21 proof; Telegram card references; RAW-transcript and processed-note paths; Obsidian API read/search/write/open proof; duplicate + restart proof; CI results (TubeAIR / AsdAIr / gateway / control-plane suites green); one safe Directus command receipt; A/B/C decision evidence; declared limitations and deferred work.

## Authority & data boundaries

- **Source-of-truth boundary (fixed):** Git/Markdown/Obsidian = canonical durable knowledge; Supabase = operational infrastructure + approved-version/QA record (never the only copy of the contract, never a competing Brain); approved domain stores (`asdair`, etc.) = governed structured records; Directus/Telegram = projections of durable hub state, never authoritative.
- **Approval semantics:** Warwick is the sole contract approver. Directus **inserts a decision/command request**; it does not directly rewrite approval history or runtime truth — a worker/Larry applies the approval and binds it to the exact version + SHA + hash.
- **Learning governance:** source-derived notes may be created automatically with an honest review state (`ai_created` / `pending_warwick_review`); material changes to canonical notes, standing rules, skills, agent instructions or policy become reviewable learning candidates, never silent edits.
- **Secrets:** Obsidian API key and any credentials live in the Yoga secret store only — never in Git, logs, ClickUp, PR text, Supabase, or Markdown.
- **Personal data:** the Fusion247PKA repo is PUBLIC; personal/entrusted data (e.g. AsdAIr household) stays in the private domain store + gitignored-local, never in Git.
- **Live actions:** building code and opening one integration PR is authorised; **merge to main and any live-sensitive/irreversible/credential/paid action return to Warwick.**

## Material decisions & constraints

- **D1 — One BUILD, several front doors.** BUILD-002 is the umbrella; no competing gateway/Brain/store/control-plane is created. Reuse the merged gateway, TubeAIR, AsdAIr, Tower and Directus components.
- **D2 — WP0 contract record lives in the live `cockpit` schema, not the DEV-only `ops` model.** The rich `ops.*` contract-acceptance model (control-plane migrations 001–006) is explicitly DEV-schema-only and encodes *reviewer* verification (which structurally forbids Warwick from writing). Warwick's *contract sign-off* is a different concern, so WP0 uses a minimal `cockpit.build_contract` projection (the schema Directus already reads) plus a decision/command approval path — reusing the live cockpit substrate and the existing Directus write-back seam. (Larry's delegated schema decision per the order.)
- **D3 — "Kaspersky template" is interpreted** as: existing TubeAIR Karpathy packet + canonical `F247.template.youtube-transcript-knowledge-note` + current immutable-source/classification/backlink rules. No new template is invented.
- **D4 — RAW ≠ processed note.** RAW is the complete, timestamped, immutable evidence; the processed note is a standalone knowledge reconstruction, never a transcript copy or thin summary.
- **D5 — Threat bar.** First-party, non-adversarial personal hub: built for correctness, accidental-leak safety, availability, and audit-integrity — not adversarial hardening.

## Canonical source references

- Warwick remote-control order — BUILD-002 Unified Hub resumption (2026-07-22).
- ClickUp BUILD-002 Doc `2kxuxw3a-852` — page 05 (Build Brief, `…-5992`), page 06 (Build Contract / PRD, `…-6012`).
- Foundry IDEA-002 (`…-1132`), IDEA-012 convergence (`…-5932`), IDEA-013 convergence (`…-5952`).
- Repo record: `Builds/BUILD-002-unified-personal-capture-gateway/` — build control doc, `Contracts/capture-contract-pack-v1.md`, `Architecture/`, `Security/`, `Work Packages/`.
- Merged runtime: `services/fusion-capture-gateway/` (capture gateway), TubeAIR core, `services/asdair/` (AsdAIr core), `services/control-plane/` (Tower + Directus cockpit).

## Contract version

**v0.1-draft** — authored by Larry from Warwick's order + ClickUp/Foundry source material, 2026-07-22. Not approved; does not authorise substantial implementation. Supersedes nothing. Warwick's approval via Directus (bound to this version + the committed Git SHA + content hash) is required before substantial build begins.
