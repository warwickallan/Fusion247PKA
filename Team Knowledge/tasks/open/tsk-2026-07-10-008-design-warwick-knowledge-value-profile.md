---
# Identity
id: tsk-2026-07-10-008
title: "Design the shared Warwick Knowledge Value Profile and current-context view"

# Ownership & priority
assignee: silas
priority: 2
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:45:16Z
updated: 2026-07-10T23:45:16Z
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
linked_my_life:
  - ai-tooling
linked_session_logs:
  - 2026-07-11-00-45_larry_knowledge-value-profile-realignment
linked_journal_entries: []
linked_deliverables: []

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
- Guidelines: [[GL-002-frontmatter-conventions]], [[GL-004-task-resource-linking]], [[GL-008-source-classification-registry]]
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

## Updates

- 2026-07-11 00:45 (larry) - created from Warwick's knowledge-valuation realignment. Cross-refs: 5/7 populated; no specialist journal priors or deliverables exist yet.

## Outcome
_(filled when status flips to done - see SOP-close-task)_
