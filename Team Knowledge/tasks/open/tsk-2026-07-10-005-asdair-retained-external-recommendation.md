---
# Identity
id: tsk-2026-07-10-005
title: "Recommendation: AsdAIr automation stays retained-external; project knowledge may enter PKM/My Life/Projects"

# Ownership & priority
assignee: unassigned
priority: 3
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:47:00Z
updated: 2026-07-11T00:15:00Z
due: null

# Provenance
created_by: pax
source: tsk-2026-07-10-001 decision 14 / Migration Coverage Matrix §6
parent: tsk-2026-07-10-001

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops: []
linked_workstreams:
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines: []
linked_my_life: []
linked_session_logs: []
linked_journal_entries: []
linked_deliverables:
  - 2026-07-10-fusion247-brain-migration-coverage-matrix

# Tagging
tags: [tier-1-proposal, recommendation, fusion247-brain, asdair, awaiting-approval]
---

# Recommendation: AsdAIr automation stays retained-external; project knowledge may enter PKM/My Life/Projects

## What this is

This is a **Tier-1 recommendation, not a ruling**, per [[WS-004-team-retro-and-self-improvement-loop]] §"Tier 1." Nothing is implemented here; this task exists so the recommendation has a durable, reviewable record and an explicit approval point — even though the direction below is already fairly clear, it still routes through the same human gate as the other three follow-up items, per explicit user instruction.

**Sourcing note:** this task was originally written by Pax without direct access to the Migration Coverage Matrix (it lived on a not-yet-merged branch at the time). Larry has since read the matrix directly and revised this task below with the actual row-37 content and a more precise recommendation relayed via external QA review. The original thinner version is preserved in the Updates log for the record.

## What AsdAIr actually is (Migration Coverage Matrix row 37)

AsdAIr / the Asda household-shopping project: a decisions log, order history, a weekly-list workflow, and Claude-in-Chrome basket-build browser automation. It is **primarily a household workflow/application** — order history and browser automation — **not merely a knowledge specialist** the way CategorisAIr or VerifiAIr are. That distinction matters for the recommendation below: "AsdAIr" is not one thing to accept-or-reject wholesale, it bundles a runtime/automation layer and a knowledge layer that don't need the same disposition.

## The recommendation

**Split the disposition by layer, rather than a single blanket retained-external call:**

- **The operational application and browser automation** (the Claude-in-Chrome basket-build flow, the live order-execution mechanics) — **stays external, not migrated into myPKA at this stage.** This is a runtime/automation concern, not a knowledge-management one; nothing in myPKA's current architecture (a markdown-first PKM, not an app-automation platform) is the right home for it.
- **The project's knowledge — decisions, status, order history as a record (not as live automation)** — **myPKA may hold this**, most likely as a `PKM/My Life/Projects/` entry (personal, recurring, per the existing GL-002 Project schema) rather than a new specialist or Workstream. This keeps the *knowledge* (what was decided, what's the current state, what was ordered when) inside the user's own knowledge graph even while the *automation* stays wherever it already runs.
- **Future path, noted not built:** once a Cockpit exists, AsdAIr could be exposed there as a linked external project/app rather than an in-Brain specialist — a view onto the automation, not the automation itself moving inside myPKA. Not proposed for building now; noted so the door isn't closed by this decision.

Reasoning: unlike CareerAIR (row 36 — an active drafting/knowledge capability with three working SOPs, a plausible future in-myPKA specialist), AsdAIr's core value is the automation runtime, which nothing in myPKA is built to host. Treating "AsdAIr" as all-or-nothing would either (a) wrongly exclude the household project from the user's own knowledge graph, or (b) wrongly imply myPKA should someday run browser automation, which is a different kind of build than anything else in this buildout.

## What this recommendation is explicitly not

- Not a claim that AsdAIr's automation should ever move into myPKA — the recommendation is that it explicitly should not, at least not now.
- Not a final decision on whether a `PKM/My Life/Projects/` entry gets created — that's a small, low-risk follow-up once this direction is approved, not bundled into this recommendation itself.

## Context one click away

- Governing loop: [[WS-004-team-retro-and-self-improvement-loop]]
- Parent task: [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]
- Schema, if a `PKM/My Life/Projects/` entry is approved: [[GL-002-frontmatter-conventions]] §"Projects"
- Working artifacts:
  - [[2026-07-10-fusion247-brain-migration-coverage-matrix]] (row 37 — now read directly, see above)

## Success criteria

- The user approves, amends, or declines the split-disposition recommendation above.
- If approved: this task closes with the disposition recorded as durable (automation stays external; knowledge may get a `PKM/My Life/Projects/` entry as a small separate follow-up), so AsdAIr does not resurface as an ambiguous open item in a future retro.
- If declined: a follow-up task captures whatever direction the user actually wants instead.

## Updates

- 2026-07-10 23:47 (pax) — created, per tsk-2026-07-10-001 decision 14 disposition of Migration Coverage Matrix follow-up #5. Cross-refs: 2/7 populated (workstreams, deliverables). All other slots (sops, guidelines, my_life, session_logs, journal_entries) walked and confirmed genuinely empty — no existing SOP, Guideline, My Life entry, session log, or journal entry covers AsdAIr specifically, and the source matrix row itself was not readable this session (flagged above and in report to Larry).
- 2026-07-11 00:15 (larry) — read matrix row 37 directly (now accessible) and substantially revised the recommendation per external QA review: split disposition by layer rather than a blanket call — the operational app/browser-automation stays external; the project's knowledge (decisions, status, order history as record) may get a `PKM/My Life/Projects/` entry; a future Cockpit could expose AsdAIr as a linked external app without moving the automation inside myPKA. Still gated for approval, not implemented.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
