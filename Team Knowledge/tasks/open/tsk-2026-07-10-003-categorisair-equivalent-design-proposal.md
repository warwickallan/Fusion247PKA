---
# Identity
id: tsk-2026-07-10-003
title: "Design proposal: myPKA equivalent for general-purpose source-to-WIKI triage (CategorisAIr gap)"

# Ownership & priority
assignee: unassigned
priority: 3
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:45:00Z
updated: 2026-07-10T23:45:00Z
due: null

# Provenance
created_by: pax
source: tsk-2026-07-10-001 decision 14 / Migration Coverage Matrix §6
parent: tsk-2026-07-10-001

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops:
  - SOP-001-how-to-add-a-new-specialist
linked_workstreams:
  - WS-002-import-external-knowledge-base
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines:
  - GL-001-file-naming-conventions
  - GL-002-frontmatter-conventions
linked_my_life: []
linked_session_logs: []
linked_journal_entries: []
linked_deliverables:
  - 2026-07-10-fusion247-brain-migration-coverage-matrix

# Tagging
tags: [tier-1-proposal, design-proposal, fusion247-brain, categorisair, awaiting-approval]
---

# Design proposal: myPKA equivalent for general-purpose source-to-WIKI triage (CategorisAIr gap)

## What this is

This is a **Tier-1 design proposal only**, per [[WS-004-team-retro-and-self-improvement-loop]] §"Tier 1": *"The task is the proposal — it is not the change."* Nothing here is implemented. It awaits the user's approval of a direction before any implementer touches anything.

**The gap** (Migration Coverage Matrix row 13, per the Fusion247 Brain migration coverage review): myPKA has no equivalent for **CategorisAIr** — Fusion247 Brain's general-purpose source-to-WIKI triage capability. CategorisAIr's job was to take an arbitrary piece of content and decide, with an explainable justification, where it belongs in the wiki and what it should backlink to. This is a genuinely different job from what myPKA's two closest existing capabilities do today:

- [[WS-002-import-external-knowledge-base]] is shaped for **bulk migration from a known PKM-tool export** — it runs a full source-detection → inventory → plan/approve → normalize pipeline, and its mapping table assumes a whole source, not a single ad-hoc document dropped in mid-conversation.
- Penn (per `Team/Penn - Journal Writer/AGENTS.md`) routes the **user's own personal-life inputs** (screenshots, voice notes, thoughts) into PKM using an established routing map, in a warm/reflective register tuned specifically for daily capture — not general external source material on arbitrary subjects.

Neither produces an explicit, human-readable **justification** for why a piece of content landed where it did or why it backlinked to what it backlinked to — which is the specific feature CategorisAIr's name and function point at.

**Note on sourcing:** the Migration Coverage Matrix deliverable this task cites (`Deliverables/2026-07-10-fusion247-brain-migration-coverage-matrix.md`) was not present on disk at the time this task was written — only [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] decision 14's summary of it was available. This task is written from that summary; the row-13 detail above is Pax's reconstruction from the parent task's framing, not a direct read of the matrix. Flagged as an open question in this task's creator's report back to Larry.

## Design options (not a final pick — the user decides)

**Option A — Hire a new specialist via Nolan, per [[SOP-001-how-to-add-a-new-specialist]].** A dedicated triage/categorization role. Pros: clean ownership, matches the precedent set by Warden's hire (a bounded, real-world role Pax can research properly). Cons: heaviest option — adds standing headcount for a capability whose actual usage frequency in myPKA is not yet demonstrated.

**Option B — Extend [[WS-002-import-external-knowledge-base]]'s remit.** Add a lightweight "single ad-hoc source" branch alongside its existing bulk-import branch, and add an explicit justification field to its Step-4 planning output (why this entity type, why this destination, why these backlinks). Pros: reuses WS-002's existing plan/approve gate, entity-mapping table, and wikilink-normalization machinery almost unchanged — the skeleton is already closest to what CategorisAIr needs. Cons: WS-002 is currently scoped and named around "importing an external knowledge base," and stretching it to cover single-document ad hoc triage may blur what WS-002 is for; would need a clear sub-section split so bulk-import users aren't confused by triage-only language.

**Option C — Extend Penn's remit.** Pros: Penn already owns "where does this piece of content go in the wiki" logic and stub-creation judgment for personal inputs. Cons: weakest fit — Penn's tone and scope (per her own contract's "What You Never Do" list) is deliberately tuned to the user's personal-life register, not general external source material on arbitrary subjects; stretching her into general-purpose triage risks scope creep into territory Pax and Silas already partially cover.

## Pax's lean (not a ruling)

Option B looks like the lowest-cost path that reuses real, already-built machinery rather than adding a new specialist for an unproven volume of work — but this is a recommendation, not a decision. Usage-frequency evidence the user has and Pax does not (how often does "here's a random source, file it somewhere sensible" actually come up outside a full import?) should weigh heavily on whether Option A is worth it instead.

## Context one click away

- Procedure (if Option A chosen): [[SOP-001-how-to-add-a-new-specialist]]
- Workstream (if Option B chosen): [[WS-002-import-external-knowledge-base]]
- Governing loop: [[WS-004-team-retro-and-self-improvement-loop]]
- Guidelines: [[GL-001-file-naming-conventions]], [[GL-002-frontmatter-conventions]]
- Parent task: [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]
- Working artifacts:
  - [[2026-07-10-fusion247-brain-migration-coverage-matrix]]

## Success criteria

- The user reviews the three options and either approves a direction (A, B, C, or a fourth option none of these anticipated) or asks for more exploration before deciding.
- Once a direction is approved, a follow-up implementation task is created — this task itself closes as "direction decided" without doing any of the build.

## Updates

- 2026-07-10 23:45 (pax) — created, per tsk-2026-07-10-001 decision 14 disposition of Migration Coverage Matrix follow-up #1. Cross-refs: 5/7 populated (sops, workstreams, guidelines, deliverables; my_life, session_logs, journal_entries genuinely empty after the walk — no existing session log covers this yet, no journal priors exist for any specialist, no My Life entry applies).

## Outcome
_(filled when status flips to done — see SOP-close-task)_
