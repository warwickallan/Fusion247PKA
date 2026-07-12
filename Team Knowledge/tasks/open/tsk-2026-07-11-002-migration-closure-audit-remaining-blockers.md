---
# Identity
id: tsk-2026-07-11-002
title: "Track migration-closure-audit's remaining blockers and Warwick decisions"

# Ownership & priority
assignee: larry
priority: 3

# Status (mirrors folder location)
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-11T22:00:00Z
updated: 2026-07-12T22:00:00Z
due: null

# Provenance
created_by: larry
source: Fable's external review closure remedial on PR #9 (tsk-2026-07-11-001) — "preserve 2026-07-11-migration-closure-audit.md as an active deliverable... one minimal successor migration-closure task referencing the audit and remaining blockers"
parent: tsk-2026-07-11-001

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops:
  - SOP-018-independent-change-qa
linked_workstreams: []
linked_guidelines:
  - GL-006-client-delivery-frontmatter-conventions
  - GL-011-immutable-source-retention
linked_my_life: []
linked_session_logs:
  - 2026-07-11-06-00_larry_migration-closure-audit
linked_journal_entries: []
linked_deliverables:
  - 2026-07-11-migration-closure-audit
  - 2026-07-11-independent-change-qa-doctrine-absorption
  - 2026-07-12-client-delivery-operational-schema-evaluation

# Tagging
tags: [migration-closure, fusion247-brain, warwick-decision-required, roadmap]
---

# Track migration-closure-audit's remaining blockers and Warwick decisions

## Context one click away

- Procedure: [[SOP-018-independent-change-qa]]
- Guideline: [[GL-011-immutable-source-retention]], [[GL-006-client-delivery-frontmatter-conventions]]
- Working artifacts:
  - [[2026-07-11-migration-closure-audit]] — the audit this task exists to keep active and track to eventual closure
  - [[2026-07-11-independent-change-qa-doctrine-absorption]] — doctrine-absorption matrix; kept active (not archived with `tsk-2026-07-11-001`'s other closed deliverables) specifically because this task tracks its row-#37 `open-follow-up-gap` (the session-log `model`/`runtime` metadata decision) to eventual resolution
  - [[2026-07-12-client-delivery-operational-schema-evaluation]] — the IDEA-003 schema evaluation ([[tsk-2026-07-12-001-evaluate-client-delivery-operational-schema-gap]]); its §6 recommended next proof and §7/§8 Warwick decisions are tracked in this task's own "Warwick decisions required" bucket below
- Birthed in: [[2026-07-11-06-00_larry_migration-closure-audit]]
- Parent: [[tsk-2026-07-11-001-absorb-independent-change-qa-doctrine]] (done, `Team Knowledge/tasks/done/2026/07/`) — closed with T009/T013 resolved; this task is its minimal successor, created specifically so `2026-07-11-migration-closure-audit.md` stays an active, referenced deliverable rather than being archived on that task's close.

## What this is

`tsk-2026-07-11-001` resolved T009 and T013 (the only two obligations in `Deliverables/2026-07-11-migration-closure-audit.md` it was scoped to close) with genuine independent confirmation (Fable, Pass with minor closure remedials, head SHA `6622a0ade5c54fbd0ca4929dae5085cb061aebc3`) and is now closing. The audit itself still has real, unresolved content beyond T009/T013 — this task is the minimal placeholder that keeps it an active, owned deliverable (per [[GL-004-task-resource-linking]]'s one-way task→resource rule) rather than letting it fall out of any task's `linked_deliverables` and become an ownerless orphan, or get archived prematurely by `tsk-2026-07-11-001`'s close.

This task does not attempt to resolve any of the items below. It exists to hold the pointer and the tracking; each item resolves only when Warwick makes the named decision (and, where a build is implied, a future task is scoped for it).

## Remaining blockers and decisions tracked (from the audit's own "Answers to the seven required questions" and sign-off checklist)

**Confirmed merge blockers:**
- Final Drive read-only/historical handover disposition — never decided.
- ~~One real or synthetic `Client Delivery/` engagement to validate GL-006/Warden's schema (the B9 Phase 3 / GL-F247-001 validation gate).~~ **Resolved 2026-07-12** — [[tsk-2026-07-12-002-synthetic-client-delivery-engagement-proof]] built and merged the synthetic engagement (PR #18, merge commit `6797b1d35245530d33c29ec3f6615fdbd6093eac`). See that task's `## Outcome` for full detail.
- Implementation Plan Phase 5's acceptance-criterion-4 failure — substantially the same underlying gap as the item above, **very likely also satisfied by the same proof**, but not independently re-checked against that specific acceptance criterion's exact wording — confirm before striking this one through too.

**Warwick decisions required (not yet blockers, not yet roadmap):**
- F247-T024 — does Warden need a formal engagement-intake SOP?
- F247-T025 — does myPKA's own template model already satisfy the "golden-master release pattern" intent?
- F247-T029 — does `build.icor.md`/Addendum A/B's provenance need a Git-side record?
- Whether `lessons` (and possibly `dependency`) should be added to `GL-006`'s Register Item `kind` enum.
- **New, surfaced by [[tsk-2026-07-11-001-absorb-independent-change-qa-doctrine]]'s closure (deferred, not implemented, per that task's own round-4 correction):** whether session-log frontmatter needs a `model`/`runtime` field distinct from the existing `agent_id` (specialist-persona) field, so metadata can eventually name the actual underlying model/runtime that processed a source — currently invisible because every specialist in this repo shares one underlying model. See [[2026-07-11-independent-change-qa-doctrine-absorption]] row #37 (`open-follow-up-gap`). This is a schema decision for Silas (frontmatter owner) and Warwick, not something to implement unilaterally.
- **New, per [[2026-07-12-client-delivery-operational-schema-evaluation]] (IDEA-003 evaluation, `tsk-2026-07-12-001`):** whether to authorize a scoped Register Item write-and-verification metadata addition (`created_by`/`review_status`/`reviewed_by`/`reviewed_date`, or a standalone entity) — the evaluation's recommended smallest-useful-next-proof, closing GL-006's own already-documented "Known gaps" #1. Its precondition (a synthetic/real engagement to test against) is now satisfied — see the resolved item above — but the decision itself remains tracked separately as GitHub issue #17, **not yet authorized**.

**Explicitly not blockers (roadmap or external-input-blocked, tracked for completeness only, not chased here):**
CareerAIR (`tsk-2026-07-10-004`), AsdAIr (`tsk-2026-07-10-005`), TubeAIR capture adapter, ICOR course-note adapter + business-domain naming, ClickUp/Withings/calendar connectors, raw ChatGPT export + WS-002 import (blocked on Warwick exporting the material).

## Success criteria

This task has no single "done" state by design — it's a tracking placeholder, not a build task. It closes (or is superseded) when one of these happens:
- Warwick works through the audit's sign-off checklist far enough that the audit itself can be marked closed/archived, at which point this task closes with the audit's final disposition recorded in `## Outcome`; or
- A specific decision above gets made and spawns its own dedicated task (e.g. "build a Warden engagement-intake SOP"), at which point that item is struck through here with a pointer to the new task, the same way `tsk-2026-07-11-001` struck through T009/T013 in the audit itself; or
- Warwick explicitly says this tracking placeholder is no longer needed.

## Updates

- 2026-07-11 22:00 (larry) — created, per Fable's explicit closure remedial on `tsk-2026-07-11-001`/PR #9: "preserve `2026-07-11-migration-closure-audit.md` as an active deliverable... one minimal successor migration-closure task referencing the audit and remaining blockers, including the deferred model/runtime metadata decision." No decisions resolved yet; this is the placeholder itself.
- 2026-07-11 22:30 (larry) — Fable's final mechanical-correction pass caught that this task was tracking the doctrine-absorption matrix's row-#37 gap by prose citation only, without actually listing the matrix in `linked_deliverables` — the file was staying unarchived only because a grep-based sharing check happened to catch the literal-path citation, not because this task genuinely owned it. Added `2026-07-11-independent-change-qa-doctrine-absorption` to `linked_deliverables` and the `Context one click away` body mirror as a deliberate, owned reference. No other content changed.
- 2026-07-12 09:00 (larry) — **The missed "Sheets" source has been found and reviewed.** Warwick asked directly whether the Fusion247 Brain project schema/ontology had been thoroughly absorbed; a repo-wide check turned up `Fusion247 Brain/01_Inbox/Inbox Unsorted/Sheets.docx` — a genuine design document (atomic records, durable IDs, source anchors, selective retrieval, migration path) that sat unprocessed the entire migration and was never cited in the migration-closure audit, the SOP-018 doctrine matrix, GL-006, or the Warden build task. This exposes **a genuine, unresolved Client Delivery schema/query-layer decision**: GL-006/Warden currently ship flat Markdown Register Items with no dedicated queryable layer (SQLite mirror explicitly deferred), while the live NPL pilot has been running its own structured Sheets-based register (RAID types, Actions, Config Changes, Open Questions, Milestones, Sources, Uncertainty, plus a Write-and-Verification Log) that was never weighed against GL-006's direction. Warwick separately surfaced **IDEA-003** (in a new Drive "Fusion247Foundry" ideation layer) and a "Larry Briefing" PDF proposing six candidate work packages (schema reconciliation → SQLite mirror extension → retrieval proof → Cockpit views → controlled writes → NPL migration/cutover). **None of those six candidate packages is authorised for implementation** — the Foundry's own governance doctrine states a draft work package does not authorise action, and Warwick has now confirmed this explicitly: the briefing's "mandate"/"start with WP1" framing overstepped the Foundry's own boundary. **Warwick has authorised one child evaluation task only** — [[tsk-2026-07-12-001-evaluate-client-delivery-operational-schema-gap]] — to establish the correct decision and the smallest sensible next step, without presuming the Foundry's recommended architecture or any of its six packages are pre-approved. This task's own "Confirmed merge blockers" bullet above ("One real or synthetic `Client Delivery/` engagement to validate GL-006/Warden's schema") is directly relevant background for that evaluation, not superseded by it.
- 2026-07-12 10:30 (larry) — [[tsk-2026-07-12-001-evaluate-client-delivery-operational-schema-gap]] complete. Silas produced [[2026-07-12-client-delivery-operational-schema-evaluation]]: GL-006's Markdown-first design is more aligned with the missed Sheets doc's own principles than either side recognized; the sharpest confirmed gap is write-and-verification enforcement (GL-006's own "Known gaps" #1, with a working reference implementation already live in the NPL Write-and-Verification Log workbook); recommends against adopting Sheets as a second source of truth; recommends exactly one next proof (Register Item verification metadata, schema-only, tested against the synthetic worked-example engagement this task already tracks). Added the corresponding line to this task's own "Warwick decisions required" bucket above. Verified directly by Larry against GL-006, SOP-002, and the Cockpit expansion before accepting — not taken on Silas's summary alone; one real issue caught and fixed (the deliverable and Silas's session log spelled out the real client organisation's actual name/product where the convention at the time, used throughout the migration-closure audit, was an invented placeholder, `BRK-001` — corrected throughout both files before commit, per GL-009; `BRK-001` was itself later retired per Warwick's naming-convention clarification, see the 2026-07-12 12:00 update below).

- 2026-07-12 11:30 (larry) — Fable's round-4 review of PR #10 caught this task was missing the evaluation deliverable from its own `linked_deliverables`/body mirror despite already citing it in prose above (a GL-004 gap, same pattern Fable caught in round-0 closure on this task's own creation). Fixed: `2026-07-12-client-delivery-operational-schema-evaluation` added to both. No other content changed; this task remains a tracking placeholder, still open.

- 2026-07-12 12:00 (larry) — Warwick settled the Client Delivery engagement-naming convention (three-character human-readable mnemonics, e.g. `NPL`, not private) via [[GL-006-client-delivery-frontmatter-conventions]] v1.5, retiring the invented `BRK-001` placeholder used across [[2026-07-12-client-delivery-operational-schema-evaluation]]'s earlier correction rounds. No content change to this task's own tracked items above; recorded here because this task links that deliverable.

- 2026-07-12 13:30 (larry) — PR #10 merged (`6390e903e7b44958a7398c85615933a6bb549218`); [[tsk-2026-07-12-001-evaluate-client-delivery-operational-schema-gap]] closed done. No change to this task's own tracked blockers/decisions above — the synthetic/redacted `Client Delivery/` engagement remains the confirmed merge blocker and the required precondition for the evaluation's recommended write-and-verification proof; neither is authorized or started.
- 2026-07-12 14:30 (larry) — Fusion delivery now also tracked visually in ClickUp (Workspace → Team Space → Folder `IDEA-003 — Client Delivery operating layer` → List `WP1 — Schema and synthetic validation`). This task's two open blockers are mirrored there as ClickUp tasks: the synthetic/redacted engagement proof (https://app.clickup.com/t/869e3mw1z, status `to do`, not authorized) and the later schema-acceptance decision (https://app.clickup.com/t/869e3mw29, status `to do`, blocked on the proof above). ClickUp is operational/visual tracking only — this task file remains the durable decision record; GitHub's merged state and this file win if the two ever disagree.

- 2026-07-12 22:00 (larry) — **A confirmed merge blocker is resolved.** PR #18 (synthetic Client Delivery engagement, [[tsk-2026-07-12-002-synthetic-client-delivery-engagement-proof]]) merged following Warwick's explicit authorization. The "one real or synthetic engagement" blocker above is struck through. This task stays open — the Drive handover disposition and several Warwick decisions remain, and the schema-acceptance decision the new proof enables (GitHub issue #17) is tracked separately and still unauthorized.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
