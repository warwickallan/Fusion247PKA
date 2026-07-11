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
updated: 2026-07-11T22:00:00Z
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

# Tagging
tags: [migration-closure, fusion247-brain, warwick-decision-required, roadmap]
---

# Track migration-closure-audit's remaining blockers and Warwick decisions

## Context one click away

- Procedure: [[SOP-018-independent-change-qa]]
- Guideline: [[GL-011-immutable-source-retention]], [[GL-006-client-delivery-frontmatter-conventions]]
- Working artifacts:
  - [[2026-07-11-migration-closure-audit]] — the audit this task exists to keep active and track to eventual closure
- Birthed in: [[2026-07-11-06-00_larry_migration-closure-audit]]
- Parent: [[tsk-2026-07-11-001-absorb-independent-change-qa-doctrine]] — closed with T009/T013 resolved; this task is its minimal successor, created specifically so `2026-07-11-migration-closure-audit.md` stays an active, referenced deliverable rather than being archived on that task's close.

## What this is

`tsk-2026-07-11-001` resolved T009 and T013 (the only two obligations in `Deliverables/2026-07-11-migration-closure-audit.md` it was scoped to close) with genuine independent confirmation (Fable, Pass with minor closure remedials, head SHA `6622a0ade5c54fbd0ca4929dae5085cb061aebc3`) and is now closing. The audit itself still has real, unresolved content beyond T009/T013 — this task is the minimal placeholder that keeps it an active, owned deliverable (per [[GL-004-task-resource-linking]]'s one-way task→resource rule) rather than letting it fall out of any task's `linked_deliverables` and become an ownerless orphan, or get archived prematurely by `tsk-2026-07-11-001`'s close.

This task does not attempt to resolve any of the items below. It exists to hold the pointer and the tracking; each item resolves only when Warwick makes the named decision (and, where a build is implied, a future task is scoped for it).

## Remaining blockers and decisions tracked (from the audit's own "Answers to the seven required questions" and sign-off checklist)

**Confirmed merge blockers:**
- Final Drive read-only/historical handover disposition — never decided.
- One real or synthetic `Client Delivery/` engagement to validate GL-006/Warden's schema (the B9 Phase 3 / GL-F247-001 validation gate).
- Implementation Plan Phase 5's acceptance-criterion-4 failure — substantially the same underlying gap as the item above.

**Warwick decisions required (not yet blockers, not yet roadmap):**
- F247-T024 — does Warden need a formal engagement-intake SOP?
- F247-T025 — does myPKA's own template model already satisfy the "golden-master release pattern" intent?
- F247-T029 — does `build.icor.md`/Addendum A/B's provenance need a Git-side record?
- Whether `lessons` (and possibly `dependency`) should be added to `GL-006`'s Register Item `kind` enum.
- **New, surfaced by `tsk-2026-07-11-001`'s closure (deferred, not implemented, per that task's own round-4 correction):** whether session-log frontmatter needs a `model`/`runtime` field distinct from the existing `agent_id` (specialist-persona) field, so metadata can eventually name the actual underlying model/runtime that processed a source — currently invisible because every specialist in this repo shares one underlying model. See `Deliverables/2026-07-11-independent-change-qa-doctrine-absorption.md` row #37 (`open-follow-up-gap`). This is a schema decision for Silas (frontmatter owner) and Warwick, not something to implement unilaterally.

**Explicitly not blockers (roadmap or external-input-blocked, tracked for completeness only, not chased here):**
CareerAIR (`tsk-2026-07-10-004`), AsdAIr (`tsk-2026-07-10-005`), TubeAIR capture adapter, ICOR course-note adapter + business-domain naming, ClickUp/Withings/calendar connectors, raw ChatGPT export + WS-002 import (blocked on Warwick exporting the material).

## Success criteria

This task has no single "done" state by design — it's a tracking placeholder, not a build task. It closes (or is superseded) when one of these happens:
- Warwick works through the audit's sign-off checklist far enough that the audit itself can be marked closed/archived, at which point this task closes with the audit's final disposition recorded in `## Outcome`; or
- A specific decision above gets made and spawns its own dedicated task (e.g. "build a Warden engagement-intake SOP"), at which point that item is struck through here with a pointer to the new task, the same way `tsk-2026-07-11-001` struck through T009/T013 in the audit itself; or
- Warwick explicitly says this tracking placeholder is no longer needed.

## Updates

- 2026-07-11 22:00 (larry) — created, per Fable's explicit closure remedial on `tsk-2026-07-11-001`/PR #9: "preserve `2026-07-11-migration-closure-audit.md` as an active deliverable... one minimal successor migration-closure task referencing the audit and remaining blockers, including the deferred model/runtime metadata decision." No decisions resolved yet; this is the placeholder itself.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
