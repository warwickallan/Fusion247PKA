---
# Identity
id: tsk-2026-07-12-001
title: "Evaluate the Client Delivery operational schema and query-layer gap surfaced by IDEA-003"

# Ownership & priority
assignee: silas
priority: 2

# Status (mirrors folder location)
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-12T09:00:00Z
updated: 2026-07-12T09:00:00Z
due: null

# Provenance
created_by: larry
source: Warwick's explicit, narrowly-scoped authorization, 2026-07-12 — "Create and execute one documentation-and-evaluation task only... This is not authority to implement WP1–WP6," issued after Warwick confirmed Larry's pushback that a "Larry Briefing" PDF's mandate language overstepped the Fusion247Foundry's own governance boundary (a draft work package does not authorise implementation)
parent: tsk-2026-07-11-002

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops:
  - SOP-002-convert-mypka-to-sqlite
  - SOP-010-warden-extract-source-to-evidence-pack
  - SOP-011-warden-meeting-prep
  - SOP-012-warden-configuration-guide
  - SOP-013-warden-meeting-summary
  - SOP-014-warden-consultant-summary
  - SOP-create-task
linked_workstreams:
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines:
  - GL-006-client-delivery-frontmatter-conventions
  - GL-009-public-private-knowledge-boundary
  - GL-011-immutable-source-retention
linked_my_life: []
linked_session_logs:
  - 2026-07-12-09-00_larry_idea-003-governance-and-evaluation-scoping
linked_journal_entries: []
linked_deliverables:
  - 2026-07-12-client-delivery-operational-schema-evaluation

# Tagging
tags: [client-delivery, warden, schema, evaluation, tier-1-proposal, gl-006, foundry, idea-003]
---

# Evaluate the Client Delivery operational schema and query-layer gap surfaced by IDEA-003

## Context one click away

- Procedure: [[SOP-002-convert-mypka-to-sqlite]], [[SOP-010-warden-extract-source-to-evidence-pack]], [[SOP-011-warden-meeting-prep]], [[SOP-012-warden-configuration-guide]], [[SOP-013-warden-meeting-summary]], [[SOP-014-warden-consultant-summary]]
- Guideline: [[GL-006-client-delivery-frontmatter-conventions]], [[GL-009-public-private-knowledge-boundary]], [[GL-011-immutable-source-retention]]
- Working artifacts:
  - [[2026-07-12-client-delivery-operational-schema-evaluation]] — the one evaluation deliverable this task produces
- Birthed in: [[2026-07-12-09-00_larry_idea-003-governance-and-evaluation-scoping]]
- Parent: [[tsk-2026-07-11-002-migration-closure-audit-remaining-blockers]] — this task's "confirmed merge blocker" (validating GL-006/Warden's schema against a real engagement) is directly relevant background, not superseded by this evaluation.
- Related, explicitly not authoritative: Drive `Fusion247Foundry/ideas/IDEA-003-sheets-vs-flat-markdown-project-registers/` (the exploration doc, the converged brief, and the "Larry Briefing" PDF) — Foundry material, evidence and context only. Per the Foundry's own `00_README` doctrine, none of it authorises implementation.

## What this is

A substantial design document about operational project registers (`Fusion247 Brain/01_Inbox/Inbox Unsorted/Sheets.docx`, the "Sheets" doc) was missed during the original Warden/GL-006 build (`tsk-2026-07-10-001`) — it sat unprocessed in an inbox folder and was never weighed against the flat-Markdown direction GL-006 actually took. Warwick's own Drive-based "Fusion247Foundry" ideation layer independently surfaced the same gap as **IDEA-003**, converged it into a brief proposing six work packages, and handed Larry a briefing document written with "mandate"/"start with WP1" language.

**This is not authority to implement any of those six work packages.** The Foundry's own `00_README` doctrine is explicit: "Neither an idea nor a draft work package authorises implementation. Warwick must explicitly tell Larry to collect the named package." Warwick reviewed Larry's pushback on this point and confirmed it was correct, then issued one narrow authorization: produce **one concise architectural evaluation**, not an implementation plan, establishing the correct decision and the smallest sensible next step — without presuming the Foundry's recommended Markdown → SQLite → Cockpit design, or any of its six candidate packages, is already approved.

**Genuinely verified before this task was created** (not taken on the briefing's word): GL-006's Register Item `kind` enum really is `risk | issue | change | decision` only — no Action/Configuration Change/Milestone/Meeting entity types, all sitting in GL-006's own "Future extension candidates" section. `SOP-002` and the Cockpit expansion really have zero mentions of Client Delivery, engagements, or register_items — nothing from `Client Delivery/` feeds any SQLite mirror or Cockpit view today. Both of the briefing's load-bearing claims check out against the actual current repo state.

## Required evaluation (what the assignee must independently review, not accept on the brief's word)

- The original missed "Sheets" document (`Fusion247 Brain/01_Inbox/Inbox Unsorted/Sheets.docx` in the local `fusion247brain` git mirror).
- The live NPL workbook structure and field schemas — **use the sanitized structural abstraction already extracted** (sheet names, column headers, row counts only, no client data values) rather than opening the raw `.xlsx` files directly. Ask Larry for this abstraction if not already supplied.
- The original and reframed IDEA-003 documents in Drive (`Fusion247Foundry/ideas/IDEA-003-sheets-vs-flat-markdown-project-registers/`) — read directly, do not take Larry's summary as complete.
- `GL-006-client-delivery-frontmatter-conventions.md` and its own documented gaps (§"Known gaps", §"Future extension candidates").
- `SOP-010` through `SOP-014` — particularly where Actions or other unbuilt entity types are currently inferred via workarounds (e.g. SOP-010/011's existing "action = a decision Register Item's own follow-through" mapping).
- The existing SQLite regeneration architecture (`SOP-002-convert-mypka-to-sqlite`) and the Cockpit's data contract (`Expansions/mypka-cockpit/`).
- `Deliverables/2026-07-11-migration-closure-audit.md` and its active successor, [[tsk-2026-07-11-002-migration-closure-audit-remaining-blockers]].

Do not accept the Foundry's proposed answer merely because it is written confidently. Distinguish, throughout: (1) confirmed requirements actually demonstrated by real NPL usage; (2) genuine gaps in the current production model; (3) useful principles worth retaining regardless of which architecture wins; (4) assumptions or premature design choices in the Foundry material; (5) candidate future capabilities that have not yet earned implementation.

## Required output — one evaluation document, not an implementation plan

Write `Deliverables/2026-07-12-client-delivery-operational-schema-evaluation.md`, containing exactly these eight sections:

1. **Verified current state** — what GL-006, Client Delivery, SQLite, and Cockpit actually support today.
2. **Confirmed operational gaps** — which record types or retrieval needs are genuinely unsupported or poorly represented.
3. **Schema-level reconciliation** — at entity level, assess Actions, Configuration Changes, Questions, Milestones, Meetings, Sources, Uncertainty, and any other live NPL types using exactly one of: retain / adapt / add / merge / reject / insufficient evidence.
4. **Architecture options** — fairly assess at least: (a) current structured Markdown with no dedicated query mirror; (b) structured Markdown with a generated SQLite mirror; (c) Google Sheets as an interim operational layer; (d) another justified hybrid or alternative.
5. **Recommendation** — preferred direction, trade-offs, and the evidence supporting it.
6. **Smallest useful next proof** — recommend exactly one next work package. Do not automatically select the Foundry's WP1, and do not activate anything.
7. **Warwick decisions required** — the precise decisions Warwick must make before implementation may begin.
8. **Effect on migration closure** — state whether this is a merge blocker, a production validation blocker, a roadmap item, or a combination, with reasoning, and how it relates to the existing "one real or synthetic Client Delivery engagement" blocker already tracked in `tsk-2026-07-11-002`.

## Hard boundaries — do not

- Edit `GL-006`, or add/alter any schema or template.
- Modify SQLite regeneration code or the Cockpit.
- Build any retrieval skill.
- Migrate any NPL record, or retire/alter the live NPL Sheet.
- Create six Git tasks from the six Drive documents — this task produces at most one recommended next-proof suggestion in §6 of the deliverable; it does not spawn sub-tasks itself.
- Treat any Foundry `TASK-WP*` status, owner, or priority field as production authority.
- Merge anything without Warwick's review — this lands on a fresh branch, in an open, reviewable PR, not merged.

## Privacy boundary (GL-009)

The repository is public. Do not copy client-sensitive NPL content, participant names, transcript excerpts, contractual details, or live record values into Git. Use abstract entity/field names, counts where safe, synthetic examples, and Drive references/source identifiers without reproducing sensitive contents. Any detailed client-data mapping that cannot safely live in public Git stays in the private Drive evidence layer, with only an abstract conclusion recorded in the repository.

## Success criteria

- One evaluation deliverable exists at the path above, with all eight required sections.
- Every entity in the schema-reconciliation table has one of the six allowed dispositions, with reasoning.
- No schema, SQLite, Cockpit, or skill files touched. No client-sensitive content in any committed file.
- Lands on a fresh branch (this designated branch, reset from `main`); a PR is opened; nothing is merged.
- Larry verifies the deliverable directly (not on the assignee's summary alone) before reporting back to Warwick.

## Updates

- 2026-07-12 09:00 (larry) — created, per Warwick's explicit narrow authorization following the Foundry-governance pushback on the "Larry Briefing" PDF's mandate language. Routed to Silas (schema/derived-data architecture lead) with an explicit instruction to read Warden's actual contract and `SOP-010`–`014` directly to represent operational-delivery-requirements validation, rather than treating this as two separate dispatches. Sanitized NPL workbook structural abstraction (sheet names, column headers, row counts — no client data values) already extracted by Larry and handed off, so the assignee never needs to open the raw client `.xlsx` files.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
