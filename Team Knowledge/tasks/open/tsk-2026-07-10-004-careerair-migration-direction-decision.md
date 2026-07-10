---
# Identity
id: tsk-2026-07-10-004
title: "Direction decision: CareerAIR migration scope (hire vs. retain-external vs. fold into an existing specialist)"

# Ownership & priority
assignee: unassigned
priority: 3
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:46:00Z
updated: 2026-07-10T23:46:00Z
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
linked_my_life: []
linked_session_logs: []
linked_journal_entries: []
linked_deliverables:
  - 2026-07-10-fusion247-brain-migration-coverage-matrix

# Tagging
tags: [tier-1-proposal, direction-decision, fusion247-brain, careerair, awaiting-approval]
---

# Direction decision: CareerAIR migration scope (hire vs. retain-external vs. fold into an existing specialist)

## What this is

This is a **Tier-1 direction-and-scoping decision, not a build plan**, per [[WS-004-team-retro-and-self-improvement-loop]] §"Tier 1." The question this task answers, if the user approves a direction, is *what kind of decision this should be* — not the content of a CareerAIR-equivalent capability itself. Nothing is implemented here.

**The gap** (Migration Coverage Matrix row 36): Fusion247 Brain's CareerAIR handled CV / cover letter / career-narrative drafting work for the user personally. myPKA currently has no equivalent home for this.

**Note on sourcing:** the same caveat as [[tsk-2026-07-10-003-categorisair-equivalent-design-proposal]] applies — the Migration Coverage Matrix deliverable was not present on disk when this task was written. This task works from [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] decision 14's summary only.

**Why this is directly relevant to [[GL-007-human-facing-writing-conventions]]:** CV and cover-letter drafting is precisely the category of human-facing external prose GL-007 exists to govern — this is the same category of work as the source incident (an em dash slipping into a submitted cover letter) that motivated GL-007 in the first place. Whichever direction is chosen here, the implementer must wire GL-007's drafting-time wikilink into whatever ends up producing this material.

## Real options (not a final pick — the user decides)

**Option A — Hire a dedicated CV/career specialist via Nolan, per [[SOP-001-how-to-add-a-new-specialist]].** Pros: matches the precedent already set for Warden — a bounded, well-understood real-world role (CV strategy, cover-letter craft, interview prep, career narrative) that Pax could research properly for "what does world-class look like." Cons: adds standing team headcount for what may be an infrequent personal-life activity; needs a clear boundary against Penn's existing "Career" life-dimension capture role so the two don't overlap awkwardly.

**Option B — Retain CareerAIR as external / personal-only, outside myPKA.** The user keeps this workflow in whatever tool/prompt it currently lives in; myPKA does not absorb it. Pros: zero build cost, no team-hygiene overhead, appropriate if career-document work is infrequent. Cons: cuts against myPKA's whole-of-life design intent — career materials stay disconnected from `PKM/My Life/Key Elements` and `PKM/CRM/People` (referees, hiring contacts), so nothing about a candidacy is wikilinked into the user's own knowledge graph.

**Option C — Fold into an existing specialist's remit.** Two candidates surfaced, both with real mismatches:
- **Penn** — career already sits conceptually under `PKM/My Life/Key Elements` as a stable life dimension (no `career.md` Key Element exists yet, confirmed via `PKM/My Life/Key Elements/` — only `health.md` exists today), so Penn *could* own tracking career goals/habits. But Penn's contract is explicitly tuned to warm/reflective daily-capture prose, not document drafting under GL-007's external-facing discipline — a real tone mismatch.
- **Pax** — closer skill match (structured, evidence-backed writing; already does hire-research-style comparative work) but Pax's own "Scope boundaries" section states Pax does not "make decisions for the user," and career-document authorship is arguably decision-adjacent (framing a candidacy) in a way pure research isn't. Would be a genuine remit expansion, not a natural extension.

## Pax's lean (not a ruling)

This hinges on information only the user has: how often does career-document work actually recur? If it's a recurring, real workload (the way client-delivery governance turned out to be for Warden), Option A mirrors a hire pattern that already worked well for this team. If it's occasional, Option B is the honest, low-overhead answer and nothing forces the team to build standing infrastructure for a rare need. Option C is Pax's weakest-fit read of the three, for the tone/scope reasons above — offered for completeness, not as a lean.

## Context one click away

- Procedure (if Option A chosen): [[SOP-001-how-to-add-a-new-specialist]]
- Guideline this directly touches once built: [[GL-007-human-facing-writing-conventions]]
- Guideline for entity/schema fit: [[GL-002-frontmatter-conventions]]
- Governing loop: [[WS-004-team-retro-and-self-improvement-loop]]
- Parent task: [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]
- Working artifacts:
  - [[2026-07-10-fusion247-brain-migration-coverage-matrix]]

## Success criteria

- The user reviews the three options and picks a direction (or declines all three, which is also a valid outcome per WS-004's edge cases table).
- If a direction is approved, a follow-up task captures the actual scoping/build work — this task closes once the direction itself is decided.

## Updates

- 2026-07-10 23:46 (pax) — created, per tsk-2026-07-10-001 decision 14 disposition of Migration Coverage Matrix follow-up #4. Cross-refs: 5/7 populated (sops, workstreams, guidelines, deliverables; my_life confirmed genuinely empty — no `career.md` Key Element exists yet to link; session_logs and journal_entries empty — no existing entries cover this).

## Outcome
_(filled when status flips to done — see SOP-close-task)_
