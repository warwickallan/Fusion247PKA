---
# Identity
id: tsk-2026-07-10-008
title: "Design the shared Warwick Knowledge Value Profile and current-context view"

# Ownership & priority
assignee: silas
priority: 2
status: done
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:45:16Z
updated: 2026-07-11T02:45:00Z
due: null

# Provenance
created_by: larry
source: warwick-realignment-2026-07-11
parent: null

# Cross-references
linked_sops:
  - SOP-015-cairn-process-external-source
  - SOP-016-cairn-process-youtube-transcript
  - SOP-create-task
linked_workstreams:
  - WS-001-daily-journaling
linked_guidelines:
  - GL-002-frontmatter-conventions
  - GL-004-task-resource-linking
  - GL-008-source-classification-registry
  - GL-009-public-private-knowledge-boundary
  - GL-010-warwick-knowledge-value-profile
linked_my_life:
  - ai-tooling
linked_session_logs:
  - 2026-07-11-00-45_larry_knowledge-value-profile-realignment
linked_journal_entries: []
linked_deliverables:
  - 2026-07-11-warwick-knowledge-value-profile-proposal

# Tagging
tags: [architecture, knowledge-valuation, current-context, about-me, cairn, penn, retrieval]
---

# Design the shared Warwick Knowledge Value Profile and current-context view

## What this is

Design the canonical shared layer that lets any specialist judge whether information is specifically valuable to Warwick. It must combine Warwick-confirmed stable interests and principles with live context assembled from active Goals, Projects, Topics, unresolved tasks, recent decisions, and recent journals. Cairn consumes this layer during intake; Cairn does not define Warwick independently. The design must also provide a concise human-facing "About me / current context" view that Warwick can inspect and correct.

This task is architecture and acceptance criteria, not permission to infer a permanent profile silently from seeded examples or journal text. It must preserve the distinction between confirmed facts, time-bounded observations, and AI inference.

## Required design questions

- What is the canonical SSOT for Warwick-confirmed stable interests, values, constraints, ambitions, and exclusions?
- How is live context assembled from Goals, Projects, Topics, tasks, decisions, and recent Journal entries without duplicating their facts?
- Which journal signals may influence intake, how long do they remain current, and how can Warwick confirm, correct, or reject them?
- How does SOP-015 combine intake intent, the stable profile, and live context before deciding Promote, Enrich, Experiment, Verify, Surface for Warwick, Retain source only, or Discard where policy permits?
- How are novelty, contradiction, source quality, confidence, and "already known" assessed without equating links or repetition with truth?
- How does promoted knowledge become retrievable during future project work, agent routing, task execution, and decision-making?
- What is the cheapest staged-processing model, and when is deeper analysis justified?

## Context one click away

- Procedures: [[SOP-015-cairn-process-external-source]], [[SOP-016-cairn-process-youtube-transcript]], [[SOP-create-task]]
- Workstream: [[WS-001-daily-journaling]]
- Guidelines: [[GL-002-frontmatter-conventions]], [[GL-004-task-resource-linking]], [[GL-008-source-classification-registry]], [[GL-009-public-private-knowledge-boundary]], [[GL-010-warwick-knowledge-value-profile]]
- Current example Topic: [[ai-tooling]]
- Birthed in: [[2026-07-11-00-45_larry_knowledge-value-profile-realignment]]
- Related dependency: [[tsk-2026-07-10-007-raw-source-retention-design-proposal]]

## Success criteria

- The proposal names one shared canonical component, its owner/steward, its consumers, and its update authority.
- The human-facing current-context view clearly separates confirmed stable facts, active structured context, recent journal-derived signals, and AI inferences awaiting confirmation.
- Intake always records why Warwick added the source before semantic processing, unless that purpose was already explicit.
- The proposal defines all seven dispositions: Promote, Enrich, Experiment, Verify, Surface for Warwick, Retain source only, and Discard where policy permits. No promotion is a normal successful outcome.
- Acceptance tests include a valuable source, a source relevant only to a current project, a duplicate idea, a contradiction, a high-impact ambiguous commercial implication, and a 45-minute transcript that produces no living knowledge.
- Retrieval tests prove that promoted knowledge is supplied to a later relevant task or agent action, rather than merely filed and forgotten.
- Token-cost controls use staged triage and reserve novelty/contradiction analysis for candidates that pass cheap relevance checks.
- The proposal states the exact changes needed in SOP-015, SOP-016, WS-001, specialist contracts, and any new GL-009 guideline or profile note, without duplicating SSOT facts.
- Warwick reviews and approves the profile shape before any journal-derived inference becomes canonical.
- The design respects [[GL-009-public-private-knowledge-boundary]]: public architecture may describe the profile mechanism, while personal evidence remains local/private unless explicitly approved for publication.

## Updates

- 2026-07-11 00:45 (larry) - created from Warwick's knowledge-valuation realignment. Cross-refs: 5/7 populated; no specialist journal priors or deliverables exist yet.
- 2026-07-11 01:15 (cairn/larry) - intake gate refined from multiple prompts to one lightweight free-text question. The canonical signals are `why added` and `suspected effect`; both are optional and may remain uncertain.
- 2026-07-11 01:30 (larry) - public/private boundary added via [[GL-009-public-private-knowledge-boundary]]. Personal profile evidence stays local/private while this public PR carries the architecture and process contract.
- 2026-07-11 01:45 (silas/larry) - architecture proposal drafted at [[2026-07-11-warwick-knowledge-value-profile-proposal]]. Status remains open pending Warwick review and approval of the profile shape.
- 2026-07-11 02:05 (silas/larry) - Warwick approved the proposal with a two-stage signal rule: short-term signals expire after 14 days by default; recurring or explicitly requested signals become longer-term candidates before stable-fact approval. Implemented [[GL-010-warwick-knowledge-value-profile]], updated SOP-015, SOP-016, WS-001, Penn/Cairn/Larry contracts, and created ignored private/local skeleton files under `PKM/My Life/Current Context/`.
- 2026-07-11 02:45 (silas/larry) - acceptance pass completed before closure:
  - Duplicate/generic source: GL-010 defines `Retain source only` and `Discard where policy permits`; SOP-015 Step 3a requires one disposition before filing and says no-promotion is valid.
  - Useful idea: GL-010 retrieval rule and SOP-015 Step 9 route durable knowledge into existing destination notes, with Topic/Project/Goal/Habit hooks rather than new arbitrary entity types.
  - Later retrieval: GL-010 requires destination backlinks, task frontmatter arrays, active My Life links, the profile, or `Useful Retrieval Hooks`; later task work can load the profile and linked entities instead of vault-wide search.

## Outcome
What shipped: Warwick's Knowledge Value Profile is now an implemented public mechanism with private/local evidence surfaces. [[GL-010-warwick-knowledge-value-profile]] defines the profile structure, stewardship, 14-day short-term signal expiry, longer-term candidate promotion path, seven dispositions, and retrieval rule. SOP-015 now requires Cairn to load the profile and assign a disposition before filing. SOP-016 feeds transcript chunk maps into that valuation step. WS-001 lets Penn propose short-term and longer-term profile signals without silently promoting them to stable facts. Penn, Cairn, and Larry contracts and host shims were updated. The private/local skeleton files exist under ignored `PKM/My Life/Current Context/`.

Where it lives: [[GL-010-warwick-knowledge-value-profile]], [[2026-07-11-warwick-knowledge-value-profile-proposal]], [[SOP-015-cairn-process-external-source]], [[SOP-016-cairn-process-youtube-transcript]], [[WS-001-daily-journaling]], `PKM/My Life/Current Context/warwick-knowledge-value-profile.md`, and `PKM/My Life/Current Context/about-warwick.md`.

Follow-ups: none for Task 008. Future work may populate the private/local profile with Warwick-approved stable facts and current signals during normal journaling/intake.

Archived deliverables: deferred. [[2026-07-11-warwick-knowledge-value-profile-proposal]] remains active in `Deliverables/` while PR #6 is open because it is still useful review context.

- 2026-07-11 02:45 (silas/larry) - done: acceptance pass completed and Knowledge Value Profile task closed.
