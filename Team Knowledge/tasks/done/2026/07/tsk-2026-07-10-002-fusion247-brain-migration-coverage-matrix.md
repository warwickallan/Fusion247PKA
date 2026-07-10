---
# Identity
id: tsk-2026-07-10-002
title: "Produce Fusion247 Brain Migration Coverage Matrix (report only, no implementation)"

# Ownership & priority
assignee: pax
priority: 2

# Status (mirrors folder location)
status: in-progress
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T20:29:13Z
updated: 2026-07-10T20:29:13Z
due: null

# Provenance
created_by: larry
source: user session — explicit request for a scoped migration-reconciliation audit, 2026-07-10
parent: tsk-2026-07-10-001

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops: []
linked_workstreams:
  - WS-005-fusion247-brain-migration-reconciliation
linked_guidelines:
  - GL-006-client-delivery-frontmatter-conventions
linked_my_life: []
linked_session_logs:
  - 2026-07-10-23-10_silas_warden-pr4-qa-pass
linked_journal_entries: []
linked_deliverables: []

# Tagging
tags: [fusion247-brain, reconciliation, audit, report-only, multi-session]
---

# Produce Fusion247 Brain Migration Coverage Matrix (report only, no implementation)

## What this is

The user explicitly asked for a scoped reconciliation audit to determine whether Fusion247 Brain's Google Drive operating model has been *fully* absorbed into myPKA — not just the Client Delivery/Warden slice tracked in the parent task, but the whole source system, judged against its own canonical registers in precedence order (Drive Object Registry, master index, decision log, work list, session log, implementation plan, gap-analysis). **Explicit instruction: do not migrate or modify anything as part of this task.** The deliverable is a Migration Coverage Matrix — one row per canonical Drive object or distinct capability, exactly one disposition each (absorbed / mapped-to-existing / retained-as-source / deferred / rejected / duplicate-superseded / unresolved), citing git file + PR/commit for absorbed/mapped items. Copying a file is not the same as preserving its meaning — dispositions must reflect that.

This is the first run of [[WS-005-fusion247-brain-migration-reconciliation]], authored alongside this task to make future reconciliation passes repeatable rather than one-off.

## Context one click away

- Procedure: [[WS-005-fusion247-brain-migration-reconciliation]]
- Parent task (the buildout this reconciles against): [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]
- Guideline: [[GL-006-client-delivery-frontmatter-conventions]]
- Most recent context: [[2026-07-10-23-10_silas_warden-pr4-qa-pass]]
- Source materials (extracted to plain text by Larry, Step 1 of WS-005 — Pax reads these, not the original Drive export):
  - `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/registry-drive-object.txt` (F247 Drive Object Registry, xlsx source)
  - `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/master-index.txt`
  - `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/decision-log.txt`
  - `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/work-list.txt`
  - `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/session-log.txt`
  - `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/implementation-plan.txt`
  - `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/gap-analysis.txt`
  - `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/mypka-git-history.txt` (this repo's commit history + full file tree, for citation)

## Success criteria

- Migration Coverage Matrix exists in `Deliverables/`, one row per canonical object/capability, every row has exactly one disposition, every `absorbed`/`mapped-to-existing` row cites a real path + commit.
- Report includes all six required sections per WS-005: overall coverage, unresolved items, suspected omissions, conflicting decisions, active Drive-only governance, proposed bounded follow-up PRs.
- Nothing outside `Deliverables/` and this task was modified while producing the report.
- User has the report; no follow-up PR has been implemented without separate explicit approval.

## Updates

- 2026-07-10 20:29 (larry) — created, alongside authoring WS-005. Source materials extracted and provisioned (see Context above). Dispatching Pax next.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
