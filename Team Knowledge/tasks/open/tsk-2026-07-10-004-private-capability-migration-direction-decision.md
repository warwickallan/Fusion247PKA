---
# Identity
id: tsk-2026-07-10-004
title: "Direction decision: CareerAIR migration scope (hire vs. retain-external vs. fold into an existing specialist)"

# Ownership & priority
assignee: unassigned
priority: 4
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:46:00Z
updated: 2026-07-11T02:15:00Z
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

## Recommended direction (user-provided, still gated — not implemented)

Relayed via external QA review and endorsed as the working direction for this task: **CareerAIR remains an active Fusion247 capability, intended for later migration into myPKA as a bounded career specialist/module.** This task's job, if approved, is to **produce a design brief and capability mapping only** — not a hire, not a build. This removes the ambiguity Option A/B/C below were originally posed to resolve, while still avoiding another large build tonight. The three options are kept below as the reasoning trail that led here; approving this direction supersedes picking among them from scratch.

## Real options (context for how the recommended direction above was reached — not a fresh menu)

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

## Source material and retrieval map

Per explicit user instruction: exact source title, Drive object ID where confirmed in the extracted F247 Drive Object Registry snapshot, canonical path, and purpose. None of the items below are rows in that registry (Objects sheet) — said honestly rather than invented. Application folders are listed by name only, per maximum-privacy discipline: no application, CV, or cover-letter file content was opened, read, or quoted.

| Source | Drive object ID | Canonical path | Purpose |
|---|---|---|---|
| SOP-create-tailored-CV.md | Not in registry snapshot. F247.master.index's own, separate Document Register lists a Google Doc ID for this title (`1oj2_VzLychCaLpmnHWcZAF6-Y76RxNb2ENcnpGn6VPg`) — different index, cited for completeness only. | `Fusion247 Brain/03_Knowledge/CV/skills/SOP-create-tailored-CV.md.docx` | Tailored-CV creation routine — one of CareerAIR's three SOPs. |
| SOP-application-closeout.md | Not in registry snapshot. Master-index Document Register ID `17GLUSlcRI2tAiINOBzuwU-7Gy9Zrg8VB2hnHh30ZALc` — different index. | `Fusion247 Brain/03_Knowledge/CV/skills/SOP-application-closeout.md.docx` | Application-outcome learning-loop routine. |
| SOP-update-career-source.md | Not in registry snapshot. Master-index Document Register ID `1tsH6VJA6bh0ATR8zWK6J9E6GD6N905UXyqLAIkOih4g` — different index. | `Fusion247 Brain/03_Knowledge/CV/skills/SOP-update-career-source.md.docx` | Career-source update routine. |
| CareerAIR house format | Not in registry snapshot; no ID found in F247.master.index's Document Register either. | `Fusion247 Brain/03_Knowledge/CV/skills/CareerAIR house format.docx` | House-style guide governing CV/cover-letter drafting. |
| AGENT — CareerAIR - Career Artefact Manager.md | Not in registry snapshot. Master-index Document Register ID `1NSIaK-1vacqczG5FuS2FeX6rkATArOEqaiwEMKIRwRE` — different index. | `Fusion247 Brain/03_Knowledge/CV/agents/AGENT — CareerAIR - Career Artefact Manager.md.docx` | Source agent definition for CareerAIR — the capability this task is deciding how (or whether) to migrate. |
| CV MASTER SOURCE — Full Career Record (never submit) | Not in registry snapshot; no ID found in master-index Document Register. | `Fusion247 Brain/03_Knowledge/CV/canonical/CV MASTER SOURCE — Full Career Record (never submit).docx` | Master career evidence record — cited for its existence and role only, not opened or quoted. |
| CV Senior Implementation Consultant - General | Not in registry snapshot; no ID found in master-index Document Register. | `Fusion247 Brain/03_Knowledge/CV/canonical/CV Senior Implementation Consultant - General.docx` | Derived general-purpose CV base — cited for its existence and role only, not opened or quoted. |
| Application folders (evidence of live use only — names, no content) | Not in registry snapshot. | `Fusion247 Brain/03_Knowledge/CV/applications/` — folders confirmed present: `ABS-2026-07/`, `Cognita Reply-2026-07/`, `Conquer AI - Delivery Lead - 2026-07/`, `ENSEK-2026-07/`, `LevickStanley-AIDeliveryManager-2026-07/`, `Oscar-2026-07/`, `dragonfly-projectmanager-2026-07/`, `evaluagent-2026-07/`, `peoplefoundry-seniordeliverymanager-2026-07/`, `vodafone-2026-07/` | Evidence only that application-closeout is a live, actively-used system with real history (10 real application folders as of this pass). No individual file inside any folder was opened, read, or quoted — maximum privacy discipline honored. |

## Success criteria

- The user approves (or amends) the recommended direction above.
- On approval: this task closes once a **design brief and capability mapping** (not a build) exists — what CareerAIR would own, its boundary against Penn's existing Career-adjacent capture and against GL-007's drafting-time discipline, and what a bounded future specialist would look like. No hire, no implementation, until that brief comes back for a separate review.

## Updates

- 2026-07-10 23:46 (pax) — created, per tsk-2026-07-10-001 decision 14 disposition of Migration Coverage Matrix follow-up #4. Cross-refs: 5/7 populated (sops, workstreams, guidelines, deliverables; my_life confirmed genuinely empty — no `career.md` Key Element exists yet to link; session_logs and journal_entries empty — no existing entries cover this).
- 2026-07-11 00:15 (larry) — added the explicit recommended direction (relayed from external QA review) atop Pax's three options: CareerAIR stays an active Fusion247 capability, intended for later migration as a bounded specialist, this task scoped to a design brief + capability mapping only. Still gated — no implementation without a separate approval on the brief itself.
- 2026-07-11 01:35 (larry) — deprioritized (3 → 4, low) per explicit user instruction: left open, not actively worked, while #1 (Knowledge Intake and Synthesis) proceeds first.
- 2026-07-11 02:15 (pax) — Added "## Source material and retrieval map" per explicit user instruction, before any implementation. Citation only. Confirmed via `Glob` that all three SOPs, the house-style guide, the agent definition, and both canonical CV documents exist at the given paths; none are Drive Object Registry rows (Objects sheet) — noted where F247.master.index's separate Document Register carries a Google Doc ID instead. Confirmed 10 real application folders exist under `03_Knowledge/CV/applications/`, listed by name only as evidence of live use — no individual application/CV/cover-letter file was opened or quoted, per maximum-privacy discipline.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
