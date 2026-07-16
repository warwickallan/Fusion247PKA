---
# Identity
id: tsk-2026-07-16-001
title: "Idea: Exact-SHA Review Gate Automation (Corpus Reconciliation Pipeline)"

# Ownership & priority
assignee: unassigned
priority: 3

# Status (mirrors folder location)
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-16T09:28:00Z
updated: 2026-07-16T09:28:00Z
due: null

# Provenance
created_by: larry
source: Warwick's explicit instruction at BUILD-000 closure (2026-07-16) — "Create one separate Foundry improvement idea/task... Do not implement it during this close." Bounded to capturing requirements only; no implementation authorized.
parent: null

# Cross-references
linked_sops:
  - SOP-018-independent-change-qa
  - SOP-write-session-log
linked_workstreams:
  - WS-005-fusion247-brain-migration-reconciliation
linked_guidelines: []
linked_my_life: []
linked_session_logs:
  - 2026-07-16-09-30_larry_build-000-merge-and-closure
linked_journal_entries: []
linked_deliverables: []

# Tagging
tags: [idea, automation, process-improvement, build-000, corpus-reconciliation, review-gate, not-implemented]
---

# Idea: Exact-SHA Review Gate Automation ("Corpus Reconciliation Pipeline")

## What this is

A captured improvement idea, not an authorized build. BUILD-000 (the Fusion247 Brain 84-source frozen-pack semantic merge assurance, closed via PR #23) went through three rounds of independent review because each corrective commit changed the PR's head SHA and the review discipline had to be manually re-applied and manually re-verified as still current each time. This idea captures a reusable pipeline that would make that discipline structural instead of manual, for any future corpus-reconciliation-style build (BUILD-003, a future BUILD-000-style pass on newer Fusion247 Brain content, or any other frozen-manifest-driven assurance exercise).

**Do not implement this during or as part of BUILD-000's closure.** This task exists to hold the requirements so they aren't lost, not to start the build.

## Lessons this idea is drawn from (BUILD-000)

- A same-model author cannot certify their own corrections as independently reviewed — this had to be caught and corrected mid-PR (SOP-018's own principle, restated the hard way).
- A stale independent-review verdict silently carrying forward past a head change is a real, recurring risk — Fable's own reviews explicitly had to declare themselves stale twice in this one PR.
- Reclassification/finding-count arithmetic errors recurred across two correction rounds (Doc 1's row miscount, the 56-vs-77 accounting, the nine-vs-ten whitelist count) — mechanical validation would have caught these immediately instead of requiring a third review pass.
- `agent_id`, `runtime_host`, and `model_id` are three distinct facts that got conflated more than once during this build — worth keeping structurally separate from the start in any future pipeline, not just in the session-log SOP this build patched.
- An "unknown-for-constraint" escape hatch that doesn't name its source is unauditable and was actually invented and used incorrectly once during this build before being caught.

## Requirements to capture (not implement)

- Ingest a frozen manifest automatically (the equivalent of BUILD-000's Merge Manifest Included/Excluded tabs).
- Create one controlled row per source — never allow a blanket reread or a filename-resemblance closure.
- Use explicit, mutually exclusive outcomes: `verified-already-present`, `implemented-now`, `defunct/no-further-action`, `routed-to-build`, `routed-to-foundry`, `pilot/reference-only`, `retained-as-evidence`, `rejected-with-reason`.
- Never equate a row's disposition with proof of semantic merge — routing and disposition are not the same claim as "this source's meaning was checked and assimilated." This was BUILD-000's single biggest correction and should be structural in any successor, not a rule someone has to remember to apply.
- Maintain a direct-read queue for genuinely uncertain sources, distinct from sources closed on prior evidence.
- Validate row count, Copy-ID uniqueness, and full manifest coverage mechanically, every time — not asserted, computed.
- Validate evidence pointers and repository paths mechanically (does the cited file/path/commit actually exist).
- Synchronise approved status colours back to the control Sheet (the Warwick/GPT-recoloured Merge Manifest used in BUILD-000).
- **Automatically invalidate any prior review the moment the PR head changes** — no verdict should silently carry forward past a new commit.
- Generate a delta-only independent-review brief after each push (what changed since the last reviewed head, not a full re-audit) — this is what let BUILD-000's later review rounds stay bounded instead of re-reading everything each time.
- Require merge approval to name an exact, immutable SHA — never "the current head" as a moving target.
- Distinguish the author session from the independent-reviewer session structurally, and **prevent a same-session persona switch from being represented as independent review** — this exact failure mode was attempted and correctly refused once during BUILD-000 (see [[2026-07-16-09-30_larry_build-000-merge-and-closure]] and the session log immediately prior to it).
- Capture `agent_id`, `runtime_host`, and `model_id` as three separate fields, never conflated — the session-log SOP patch from BUILD-000 (`Team Knowledge/SOPs/SOP-write-session-log.md`) is the immediate precedent; a pipeline version would apply the same discipline structurally to every reconciliation row, not just session logs.
- Prevent closure (of the Workstream, the Build, or any tracking system) until merge SHA, independent-review evidence, and control-system (e.g. ClickUp) updates all point at the same exact state.

## Required output (when this is eventually picked up — not now)

A design proposal, following [[WS-005-fusion247-brain-migration-reconciliation]]'s own "produces a report, does not migrate/implement itself" discipline: a named implementer, a scoped build plan, and explicit Warwick approval before any code or automation is written. This task is the requirements capture only.

## Success criteria (for this task, not the eventual pipeline)

- Requirements above are captured durably and linked from WS-005 and the BUILD-000 closure record.
- No automation code, script, or pipeline is built as part of this task.
- Routed to Nolan/Pax (research + scoping) or held here as backlog — Warwick's call, not decided by this task.

## Updates

- 2026-07-16 09:28 (larry) — created per Warwick's explicit instruction at BUILD-000 closure. Requirements captured; no implementation performed or authorized.
