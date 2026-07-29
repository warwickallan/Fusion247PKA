---
# Identity
id: tsk-2026-07-10-004
title: "Direction decision: migration scope for a withheld private capability (hire vs. retain-external vs. fold into an existing specialist)"

# Ownership & priority
assignee: unassigned
priority: 4
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:46:00Z
updated: 2026-07-29T00:00:00Z
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
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines:
  - GL-007-human-facing-writing-conventions
  - GL-002-frontmatter-conventions
  - GL-012-secrets-store-access-boundary
linked_my_life: []
linked_session_logs: []
linked_journal_entries: []
linked_deliverables: []

# Tagging
tags: [tier-1-proposal, direction-decision, fusion247-brain, redacted-for-privacy, awaiting-approval]
---

# Direction decision: migration scope for a withheld private capability

## REDACTED — content withdrawn from the public repository on 2026-07-29

**This file has been deliberately emptied of its substance. Nothing here is a record of what was
decided; it is a record that a decision existed and that its detail does not belong in a public
repository.**

### What was withdrawn, described without disclosing it

This task was a Tier-1 direction-and-scoping decision (per
[[WS-004-team-retro-and-self-improvement-loop]] §"Tier 1") about whether a capability inherited
from Fusion247 Brain should be migrated into myPKA as a bounded specialist, retained outside
myPKA, or folded into an existing specialist's remit. Nothing was ever implemented under it.

Its previous content carried, in addition to the capability's name:

- a table of **real third-party organisation names** evidencing live personal activity;
- **document-store object identifiers** for private personal records;
- **titles and canonical paths** of private personal documents;
- a description of the personal activity the capability supports.

Each of those is a disclosure in its own right, independent of the capability's name, and several
are more sensitive than the name. They were removed together rather than individually, because the
*combination* is what identifies the activity.

### Why redaction rather than rewording

The governing ruling is that nothing specific to this capability belongs in a public repository,
and that the ruling covers **metadata** — filenames, paths, tags, commit subjects — not only prose.
A reworded version of this task would still have been a public statement about a private personal
activity, which is the exact thing the ruling forbids. There is no wording of the original content
that satisfies it, so the content is gone rather than disguised.

The file was also **renamed**; its previous filename carried the capability's name and was
therefore itself part of the disclosure.

### What this redaction does NOT do

**It does not remove anything from git history.** Every commit that ever contained the original
text still contains it, and the previous filename remains in the history of this path. Removing it
from the working tree reduces what a reader of the current repository sees; it does not make the
repository's history private. Whether to act on that history is a separate, owner-level decision
that has deliberately not been taken here — see the accompanying assessment.

**It does not close the task.** The underlying direction question may well have been answered
elsewhere, but that is not established from inside this repository and is not asserted here.

## Success criteria

- Warwick rules on the historical-corpus question (see the accompanying privacy assessment).
- Warwick confirms whether this task is superseded and may be closed, or should be reopened and
  continued on a private surface.

## Updates

- 2026-07-10 23:46 (pax) — created, per tsk-2026-07-10-001 decision 14 disposition of Migration
  Coverage Matrix follow-up #4.
- 2026-07-11 00:15 (larry) — recommended direction added atop the three options.
- 2026-07-11 01:35 (larry) — deprioritized (3 → 4, low) per explicit user instruction.
- 2026-07-11 02:15 (pax) — added a source-material and retrieval map, citation only.
- 2026-07-29 (privacy remediation) — **file renamed and content redacted** under the
  public-repository privacy ruling. The prose, the option analysis, the source-material table and
  the previous filename were removed from the working tree. Recorded here rather than done
  silently: a redaction that hides the fact of its own existence is a falsified record, not a
  private one.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
