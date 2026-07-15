---
# Identity
id: tsk-2026-07-15-001
title: "Reconcile SOP-002's documented procedure with the actual regen script the Cockpit runs"

# Ownership & priority
assignee: silas
priority: 2

# Status (mirrors folder location)
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-15T17:00:00Z
updated: 2026-07-15T17:00:00Z
due: null

# Provenance
created_by: larry
source: Surfaced by Silas during the 2026-07-15 mypka.db regen (WS-004 Team Retro Step 6) — a Tier 1 proposal per WS-004's trigger contract, not yet actioned pending Warwick's approval.
parent: null

# Cross-references
linked_sops:
  - SOP-002-convert-mypka-to-sqlite
linked_workstreams:
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines: []
linked_my_life: []
linked_session_logs:
  - 2026-07-15-mypka-to-sqlite
linked_journal_entries: []
linked_deliverables: []

# Tagging
tags: [sop-drift, sqlite, cockpit, tier-1-proposal, ssot]
---

# Reconcile SOP-002's documented procedure with the actual regen script the Cockpit runs

## Context one click away

- Procedure: [[SOP-002-convert-mypka-to-sqlite]]
- Workstream: [[WS-004-team-retro-and-self-improvement-loop]] (this gap surfaced during Step 6 of the first Team Retro's landing)
- Session log: [[2026-07-15-mypka-to-sqlite]]
- The actual script in use: `Expansions/mypka-cockpit/scripts/regen-mypka-db.py`

## What this is

During the 2026-07-15 Team Retro's `mypka.db` regen (WS-004 Step 6), Silas found that `SOP-002-convert-mypka-to-sqlite`'s literal documented procedure describes a from-scratch build producing a 10-table database — but no such script exists anywhere in this repo's history. What actually builds and maintains `mypka.db` is `Expansions/mypka-cockpit/scripts/regen-mypka-db.py`, a 23-table superset that includes the governance/agent tables (`agents`, `sops`, `guidelines`, `workstreams`, `deliverables`) SOP-002's table list doesn't cover at all. Silas ran the real script rather than hand-building a fresh one from the stale prompt, correctly declining to edit SOP-002 himself since that's a content change requiring approval.

This is a genuine SSOT/documentation-drift gap: a specialist following SOP-002 literally today would produce an incompatible database missing most of what the Cockpit actually reads.

## Required output

Silas reconciles SOP-002's text with reality — either by rewriting its procedure to point at `Expansions/mypka-cockpit/scripts/regen-mypka-db.py` as the canonical regen mechanism (documenting its actual table set), or by explicitly scoping SOP-002 to a narrower legacy case and cross-linking the Cockpit script as the current one. Whichever it is, SOP-002 should stop describing a script that doesn't exist.

## Success criteria

- SOP-002's documented procedure matches what `regen-mypka-db.py` actually does (table list, invocation, output).
- No specialist following SOP-002 literally would produce a `.db` incompatible with what the Cockpit reads.
- Change reviewed/approved before landing, per WS-004's human-gate invariant (this is a Tier 1 proposal, not yet authorized to implement).

## Updates

- 2026-07-15 17:00 (larry) — created from Silas's finding during the Team Retro's mypka.db regen; not yet authorized to implement.
