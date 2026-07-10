---
# Identity
id: tsk-2026-07-10-006
title: "Proposal: close the content-integrity QA gap (fabricated-reference + unlogged-change detection) — VerifiAIr equivalent"

# Ownership & priority
assignee: unassigned
priority: 3
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:48:00Z
updated: 2026-07-10T23:48:00Z
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
tags: [tier-1-proposal, design-proposal, fusion247-brain, verifiair, content-integrity, awaiting-approval, new-in-review]
---

# Proposal: close the content-integrity QA gap (fabricated-reference + unlogged-change detection) — VerifiAIr equivalent

## What this is

This is a **Tier-1 design proposal only**, per [[WS-004-team-retro-and-self-improvement-loop]] §"Tier 1." Nothing here is implemented; it awaits the user's approval of a direction. This is the **new, sixth item** the coverage review surfaced — not one of the original five follow-ups — per [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] decision 14: *"#6 (new) VerifiAIr / content-integrity QA gap — Tier-1 proposal, not in the original five."*

**The gap** (Migration Coverage Matrix row 15): Larry's own Librarian pass (per `Team/Larry - Orchestrator/AGENTS.md` Duty 2) already runs structural QA at every session close — SSOT violations, broken `[[wikilinks]]`, orphaned files, missing `INDEX.md` entries. What it has **no equivalent for** is two specific failure modes:

1. **Fabricated-reference detection** — a claim or citation in a deliverable that was invented rather than verified against an actual source.
2. **Unlogged-change detection** — a canonical file edited without a corresponding session-log entry or task `## Updates` line recording that it happened.

Per the parent task, these are the same two failure modes that motivated Fusion247 Brain's own `F247.skill.update-qa-claude` to grow dedicated sections — i.e., this isn't a hypothetical gap, it's one a prior, related system had to build a real fix for after encountering it in practice.

**Note on sourcing:** as with the other three siblings of this task, the Migration Coverage Matrix deliverable itself was not present on disk when this task was written; this task works from [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] decision 14's summary, plus the more detailed framing given directly in the dispatch brief for this task. Flagged as an open question in this session's report back to Larry.

## Design options (not a final pick — the user decides)

**Option A — Extend Larry's own Librarian-pass checklist.** Add fabricated-reference and unlogged-change detection as two new always-on checks Larry runs at every session close, alongside the four existing structural checks (SSOT violations, broken wikilinks, orphaned files, missing INDEX entries). Pros: runs automatically, every session, no separate invocation to remember — mirrors how the existing four checks already work. Cons: fabricated-reference detection specifically may require real external verification (re-checking a citation against its actual source), which is a heavier, potentially costly operation to run unconditionally on every session close, unlike the other four checks which are pure structural/graph operations over files already on disk.

**Option B — A new, on-demand SOP** (e.g. `SOP-content-integrity-audit`), invoked periodically rather than folded into every session close — mirroring how [[WS-004-team-retro-and-self-improvement-loop]]'s Tier-2 retro is on-demand with an optional periodic nudge, not automatic every session. Pros: keeps session close lightweight; the heavier verification work only runs when actually triggered. Cons: an on-demand check that nobody remembers to demand is exactly the failure mode [[GL-007-human-facing-writing-conventions]] was just written to name — "a rule that exists but is never re-read at the point that matters is functionally the same as no rule." A Tier-2-style periodic nudge would need to be built in deliberately, not assumed.

**Option C — Widen Vera's remit beyond UI QA.** Vera's whole operating philosophy (`Team/Vera - QA Specialist/AGENTS.md`) — "evidence over opinion," severity-tagged findings, "check before you check off," never marking PASS with open Critical/High issues — is a strong *philosophical* match for content-integrity QA. But her contract is explicitly and repeatedly scoped to visual/accessibility/design-system work (WCAG 2.2 AA, three responsive breakpoints, design-token citations), and her own "What Vera never does" list states plainly: "Does not write content or copy. Penn captures journal-shaped inputs; the user owns content." Folding fabricated-reference detection into Vera's remit would be a genuine scope-boundary crossing, not a natural extension — her entire report template, tone, and cross-reference set (GL-003 design system) is built around a different domain.

## Pax's lean (not a ruling)

Option A, split in two rather than adopted wholesale: fold **unlogged-change detection** into Larry's automatic Librarian pass now (it's a pure structural/graph check — did this canonical file's mtime or content change without a matching session-log/task-update entry — no external verification needed, same shape as the four checks Larry already runs). Treat **fabricated-reference detection** as the heavier half and consider Option B for that piece specifically, since real source-verification cost is a legitimate reason not to force it into every session close unconditionally. Option C looks like the weakest fit of the three, for the scope-boundary reasons above — offered for completeness, not as a lean. This split-the-baby framing is itself a suggestion, not a ruling; the user may reasonably prefer one clean option over a hybrid.

## Context one click away

- Governing loop: [[WS-004-team-retro-and-self-improvement-loop]]
- Related recent Guideline (same underlying discipline — "a rule that's never re-read is no rule"): [[GL-007-human-facing-writing-conventions]]
- Larry's existing Librarian-pass contract (Duty 2, what this proposal would extend): `Team/Larry - Orchestrator/AGENTS.md`
- Vera's existing QA contract (Option C candidate, scope-boundary considered): `Team/Vera - QA Specialist/AGENTS.md`
- Parent task: [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]
- Working artifacts:
  - [[2026-07-10-fusion247-brain-migration-coverage-matrix]]

## Success criteria

- The user reviews the three options (and Pax's split-the-baby lean) and approves a direction, or asks for more exploration.
- If approved, a follow-up implementation task captures the actual build — this task closes once the direction is decided.

## Updates

- 2026-07-10 23:48 (pax) — created, per tsk-2026-07-10-001 decision 14 disposition of Migration Coverage Matrix follow-up #6 (new item, not one of the original five). Cross-refs: 2/7 populated (workstreams, deliverables). All other slots walked and confirmed genuinely empty — no existing SOP or Guideline governs content-integrity QA specifically yet (that's the gap this task proposes closing), no My Life entry applies, no session log or journal entry covers this.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
