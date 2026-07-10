---
# Identity
id: tsk-2026-07-10-002
title: "Produce Fusion247 Brain Migration Coverage Matrix (report only, no implementation)"

# Ownership & priority
assignee: pax
priority: 2

# Status (mirrors folder location)
status: done
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T20:29:13Z
updated: 2026-07-10T21:46:00Z
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
linked_deliverables:
  - 2026-07-10-fusion247-brain-migration-coverage-matrix

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
- Deliverable: [[2026-07-10-fusion247-brain-migration-coverage-matrix]]
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
- 2026-07-10 21:45 (pax) — Matrix complete at [[2026-07-10-fusion247-brain-migration-coverage-matrix]]: 43 rows covering the full Drive Object Registry plus every capability named in the master index (not just the Client-Delivery/Warden slice). 14 absorbed, 18 mapped-to-existing (several flagged partial/narrower), 1 retained-as-source, 1 rejected (Pax's own judgment, not a user decision — Drive/Zapier write-methods don't apply to myPKA's runtime), 5 deferred (CareerAIR, AsdAIr, TubeAIR, ICOR course notes, Anti-AI Writing Pack — all live in the source, none touched in myPKA), 4 unresolved (chief among them: CategorisAIr's general-purpose source-triage engine has no confident myPKA equivalent). Flagged an evidence-quality caveat: 18 of the mapped/absorbed rows cite myPKA files that predate the provisioned git-history window (pre-existing base-scaffold machinery, not built in response to Fusion247) — verified by direct file `Read` rather than a session commit SHA, disclosed per-row rather than downgraded to unresolved. All six required WS-005 return-format sections included in the deliverable. No writes outside `Deliverables/` and this task file.
- 2026-07-10 21:46 (larry) — done: reviewed the matrix, endorsed Pax's citation-quality judgment call (verified-by-direct-read + honest per-row disclosure beats a blanket downgrade to `unresolved` for pre-existing scaffold files — that would have understated real evidence), synthesized all six sections for the user. No sub-tasks exist yet for the five proposed follow-up PRs — none are approved, so none were created; whichever the user picks becomes a new task with `parent: tsk-2026-07-10-002` at that point.

## Outcome

What shipped: the first run of [[WS-005-fusion247-brain-migration-reconciliation]] — a 43-row Migration Coverage Matrix auditing the full Fusion247 Brain Drive Object Registry (not just the Client-Delivery/Warden slice) against myPKA's current state, with all six required WS-005 sections (overall coverage, unresolved items, suspected omissions, conflicting decisions, active Drive-only governance, proposed follow-ups). Audit-only, as scoped — nothing migrated or implemented.

Where it lives: [[2026-07-10-fusion247-brain-migration-coverage-matrix]] in `Deliverables/`.

Follow-ups: 5 proposed PRs listed in the matrix's §6, none approved or created as tasks yet — the user decides which (if any) to pursue.

Lessons: the matrix's own closing anti-pattern note is worth carrying forward as team knowledge, not just a report footnote — "a documented rule that exists but isn't referenced at the point of use doesn't run" (the Anti-AI Writing Source Pack existed in Fusion247 Brain and still let an em-dash into a submitted cover letter because nothing in the drafting workflow pointed at it). This is the exact failure mode myPKA's Guidelines-are-wikilinked-not-restated discipline exists to prevent.

Archived deliverables: **deliberately not archived.** The matrix stays live in `Deliverables/` (not moved to `_archive/`) because the user's upcoming follow-up-PR decisions will reference it directly — archiving now would bury the one document needed to make that call. Revisit archiving once the follow-ups are resolved or explicitly declined.
