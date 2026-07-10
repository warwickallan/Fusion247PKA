---
# Identity
id: tsk-2026-07-10-006
title: "Proposal: close the content-integrity QA gap (fabricated-reference detection, unlogged-change detection, content-level drift, safe corrective boundaries) — VerifiAIr equivalent"

# Ownership & priority
assignee: unassigned
priority: 3
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:48:00Z
updated: 2026-07-11T02:20:00Z
due: null

# Provenance
created_by: pax
source: tsk-2026-07-10-001 decision 14 / Migration Coverage Matrix §6; revised per external QA review of the full matrix
parent: tsk-2026-07-10-001

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops: []
linked_workstreams:
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines:
  - GL-007-human-facing-writing-conventions
linked_my_life: []
linked_session_logs: []
linked_journal_entries: []
linked_deliverables:
  - 2026-07-10-fusion247-brain-migration-coverage-matrix

# Tagging
tags: [tier-1-proposal, design-proposal, fusion247-brain, verifiair, content-integrity, awaiting-approval, revised]
---

# Proposal: close the content-integrity QA gap (fabricated-reference detection, unlogged-change detection, content-level drift, safe corrective boundaries) — VerifiAIr equivalent

## What this is

This is a **Tier-1 design proposal only**, per [[WS-004-team-retro-and-self-improvement-loop]] §"Tier 1." Nothing here is implemented; it awaits the user's approval of a direction. This is the **new, sixth item** the coverage review surfaced — not one of the original five follow-ups — per [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] decision 14: *"#6 (new) VerifiAIr / content-integrity QA gap — Tier-1 proposal, not in the original five."*

**Revision note (read this first):** this task originally covered fabricated-reference detection and unlogged-change detection well (matrix row 15) but was silent on two other dimensions of the same gap. Larry has since pulled the real matrix, and an external QA review of the full matrix instructed: *"Larry's Librarian and the validation script cover structural integrity, but the report says they do not fully cover: fabricated-reference detection; unlogged-change detection; content-level drift; safe corrective boundaries across the Brain. Scope a content-integrity QA capability, deciding whether Vera should own it, Larry's Librarian role should be extended, or a dedicated SOP is needed."* This revision adds the two missing dimensions — sourced from matrix row 12 — and expands the options and the lean to address all four. See `## Updates` for the full change record; the original framing is preserved there, not deleted.

## The gap — two matrix rows, four dimensions

**Row 15** (`F247.skill.update-qa-claude` — the 15-point external QA checklist: folder hygiene, link verification, fabricated-reference check, unlogged-change detection, Manifest conformance): Larry's own Librarian pass (per `Team/Larry - Orchestrator/AGENTS.md` Duty 2) already runs structural QA at every session close — SSOT violations, broken `[[wikilinks]]`, orphaned files, missing `INDEX.md` entries. What it has **no equivalent for** is:

1. **Fabricated-reference detection** — a claim or citation in a deliverable that was invented rather than verified against an actual source.
2. **Unlogged-change detection** — a canonical file edited without a corresponding session-log entry or task `## Updates` line recording that it happened.

Per the parent task, these are the same two failure modes that motivated Fusion247 Brain's own `F247.skill.update-qa-claude` to grow dedicated sections — i.e., this isn't a hypothetical gap, it's one a prior, related system had to build a real fix for after encountering it in practice.

**Row 12** (VerifiAIr's original scope — "Brain QA," crawling/checking/fixing the existing knowledge base after the fact, run via `/update brain`): the matrix's own assessment is that Larry's Librarian pass covers VerifiAIr's *structural* QA lane but is "genuinely narrower, not equivalent" to VerifiAIr's full scope, which was **"R/U/suggest-D over the whole Brain, safe-additive-repair rules."** That original scope surfaces the two dimensions this task was missing:

3. **Content-level drift** — the matrix states plainly: myPKA "has no myPKA equivalent for content-level drift, only structural drift." Structural QA (what Larry's Librarian already does) catches broken links, orphaned files, missing index entries — shape problems. Content-level drift is a different failure mode: a note's actual content silently diverging from what it should say — becoming stale relative to a source it depends on, or two statements of the same fact quietly disagreeing in substance rather than in link-graph shape. This can happen even when every edit *was* logged (distinct from failure mode 2 above) — the gap is nobody re-checks whether content still holds up, only whether the graph is intact.
4. **Safe corrective boundaries across the Brain** — VerifiAIr's own CRUD boundary was explicit: **Read and Update freely, suggest-Delete, never autonomous Delete.** Nothing in myPKA today states this boundary explicitly for content-level fixes. Larry's Librarian pass today gets close but doesn't name the rule: per Larry's own contract, "Larry fixes structural drift on his own. He flags content drift... and asks the user to resolve" — that's an *implicit* R/U-auto, D-never-autonomous pattern already in practice for structural fixes, but it has never been written down as an explicit rule, and it has never been extended to cover the *content*-level fixes this task's other three dimensions would require (e.g., "is it safe to auto-correct a stale fact once content-drift detection finds one?" — no rule answers this today).

Together, rows 12 and 15 are the reviewer's full "content-integrity QA" scope — not row 15 alone, which is what the original version of this task treated as the whole gap.

## Design options (not a final pick — the user decides)

Re-derived to address all four dimensions explicitly, not just the two the original draft covered.

**Option A — Extend Larry's own Librarian-pass checklist.** Add all four as new checks/rules Larry runs at every session close, alongside the four existing structural checks:

- Fabricated-reference detection and unlogged-change detection (row 15) as originally proposed.
- Content-level drift detection (row 12) — a new check comparing a note's content against whatever it claims to be sourced from or consistent with, not just checking that its links resolve.
- An explicit **safe-corrective-boundary rule**, written into Larry's Duty 2 text: Larry may autonomously **R**ead and **U**pdate (fix a broken link target, add a missing INDEX entry, correct an unambiguous structural issue), may **suggest** a **D**elete or a content-level correction, but **never autonomously deletes or autonomously rewrites a fact's substance** — that always surfaces to the user, mirroring VerifiAIr's own R/U/suggest-D-never-autonomous-D rule from row 12.

Pros: runs automatically, every session, no separate invocation to remember — mirrors how the existing four checks already work; the safe-corrective-boundary rule in particular is a small, low-cost text addition that formalizes a pattern Larry already follows informally today. Cons: fabricated-reference detection and content-level drift detection both require real verification work — re-checking a citation against its actual source, or re-checking a fact against whatever it should still match — which is a heavier, potentially costly operation to run unconditionally on every session close, unlike the four existing checks, which are pure structural/graph operations over files already on disk. This cost concern now applies to *two* of the four dimensions (fabrication + content-drift), not just one.

**Option B — A new, on-demand SOP** (e.g. `SOP-content-integrity-audit`), invoked periodically rather than folded into every session close — mirroring how [[WS-004-team-retro-and-self-improvement-loop]]'s Tier-2 retro is on-demand with an optional periodic nudge, not automatic every session. The SOP would own all four dimensions, or just the two heavier ones (fabrication, content-drift) if Option A's lighter half is adopted separately — see the lean below.

Pros: keeps session close lightweight; the heavier verification work only runs when actually triggered. Cons: an on-demand check that nobody remembers to demand is exactly the failure mode [[GL-007-human-facing-writing-conventions]] was just written to name — "a rule that exists but is never re-read at the point that matters is functionally the same as no rule." A Tier-2-style periodic nudge would need to be built in deliberately, not assumed. This concern applies equally whichever subset of the four dimensions lands here.

**Option C — Widen Vera's remit beyond UI QA.** Vera's whole operating philosophy (`Team/Vera - QA Specialist/AGENTS.md`) — "evidence over opinion," severity-tagged findings, "check before you check off," never marking PASS with open Critical/High issues — is a strong *philosophical* match for content-integrity QA generally, and specifically a close match for dimension 4 (safe corrective boundaries): Vera's own critical rule "NEVER mark a task PASS if Critical or High issues exist... no exceptions" and her never-fixes-only-finds discipline are functionally the same shape as VerifiAIr's R/U/suggest-D-never-autonomous-D rule — find, flag severity, recommend, never silently resolve. But her contract is explicitly and repeatedly scoped to visual/accessibility/design-system work (WCAG 2.2 AA, three responsive breakpoints, design-token citations), and her own "What Vera never does" list states plainly: "Does not write content or copy. Penn captures journal-shaped inputs; the user owns content." Folding fabricated-reference detection or content-level drift detection into Vera's remit would be a genuine scope-boundary crossing for the *content* dimensions — her entire report template, tone, and cross-reference set (GL-003 design system) is built around a different domain. The *boundary-discipline* dimension (4) is a better philosophical fit for Vera than the *content-checking* dimensions (1, 3) are.

## Pax's lean (not a ruling)

The original lean split two ways: fold unlogged-change detection into Larry's automatic pass now, and treat fabricated-reference detection as a future on-demand SOP candidate. That split still holds for those two dimensions — unlogged-change detection is a pure structural/graph check (did this canonical file's mtime or content change without a matching session-log/task-update entry) with the same shape as the four checks Larry already runs; fabricated-reference detection genuinely needs external verification, which is a legitimate reason to keep it out of every session close unconditionally.

The two dimensions this revision adds need their own placement, not silence:

- **Content-level drift** is the same weight class as fabricated-reference detection — both require comparing content against something outside the file's own link graph, not a pure structural operation — so it should travel with fabrication detection to whichever destination (Option A's heavier half, or Option B) the user picks for that pair.
- **Safe corrective boundaries** is the odd one out and arguably the most urgent of the four to resolve regardless of which option the user picks for the other three: Larry is *already* performing R/U-shaped autonomous fixes today (Duty 2), without an explicit written rule for what's safe to auto-fix versus what must always surface. Recommend writing the explicit safe-corrective-boundary rule into Larry's Duty 2 text now — a small, low-cost, low-risk change — independent of and prior to deciding who owns the heavier fabrication/content-drift detection work. This is a three-way split rather than the original two-way split: (a) unlogged-change → Larry, now; (b) fabrication + content-drift → a future on-demand SOP, paired together; (c) the explicit safe-corrective-boundary rule → Larry's Duty 2 text, now, regardless of (a)/(b).

Option C looks like the weakest fit for owning the *whole* capability, for the scope-boundary reasons above, though its philosophy is worth citing as a model for how the safe-corrective-boundary rule (dimension 4) should read, wherever it lands. This split-the-baby framing is itself a suggestion, not a ruling; the user may reasonably prefer one clean option over a hybrid, or a different split entirely.

## Context one click away

- Governing loop: [[WS-004-team-retro-and-self-improvement-loop]]
- Related recent Guideline (same underlying discipline — "a rule that's never re-read is no rule"): [[GL-007-human-facing-writing-conventions]]
- Larry's existing Librarian-pass contract (Duty 2, what this proposal would extend): `Team/Larry - Orchestrator/AGENTS.md`
- Vera's existing QA contract (Option C candidate, scope-boundary considered): `Team/Vera - QA Specialist/AGENTS.md`
- Parent task: [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]
- Working artifacts:
  - [[2026-07-10-fusion247-brain-migration-coverage-matrix]]

## Source material and retrieval map

Per explicit user instruction: exact source title, Drive object ID where confirmed in the extracted F247 Drive Object Registry snapshot, canonical path, and purpose. Citation only; no source content is copied into this task.

| Source | Drive object ID | Canonical path | Purpose |
|---|---|---|---|
| F247.agent.verifiair | `1Id8fwXRd02X6pFdRZmWQs2I0pRyYO6old7pfMw8p5b8` — confirmed, F247 Drive Object Registry (Objects sheet), row "F247.agent.verifiair" | `Fusion247 Brain/00_System/agents/F247.agent.verifiair.docx` | The Brain QA/closeout agent whose R/U/suggest-D-never-autonomous-D scope this proposal's content-integrity capability is measured against. |
| F247.skill.update-qa-claude | Not in Drive Object Registry snapshot. Note: F247.master.index's own Document Register still lists this title as **"Active draft"** with a Google Doc ID (`1CZTcbqxAa28nVyttoFGW5dDz4RMuDsDNsv4qSlDsfvs`) — implying a live Drive copy exists that was not captured in this local export. | Live/current version: **not found in this export.** Only a superseded snapshot exists at `Fusion247 Brain/08_Archive/Superseded/ZZ_superseded - F247.skill.update-qa-claude - pre-Rev2 snapshot 2026-07-08.docx`. | The 15-point external QA checklist (fabricated-reference check, unlogged-change detection, Manifest conformance) that motivated this proposal — only the pre-Rev2 archived snapshot is retrievable here; do not treat the archived snapshot as current, and do not invent a path for the live version. |
| F247.review.external-qa-claude — 2026-07-02 | Not in Drive Object Registry snapshot. Master-index Document Register ID `1GWCoXF83AfFOHE1EqnjgiNFpRUJF2OnxzfV0yJvd0gc`, described there only as "Control-doc defect review." | `Fusion247 Brain/00_System/Governance/Reviews/F247.review.external-qa-claude — 2026-07-02.docx` | Candidate source for the fabricated-reference and/or unlogged-change incident — **not confirmed**, see note below. |
| F247.review.external-qa-claude-update-fusion-2026-07-03 | Not in Drive Object Registry snapshot. Master-index Document Register ID `1R7VCCxYqiKB21jB14zVZyHawvlE4yw5zBISpyCaZI24`, described there only as "update-fusion evidence review." | `Fusion247 Brain/00_System/Governance/Reviews/F247.review.external-qa-claude-update-fusion-2026-07-03.docx` | Candidate source for the fabricated-reference and/or unlogged-change incident — **not confirmed**, see note below. |
| F247.review.external-qa-claude-control-docs-2026-07-03 | Not in Drive Object Registry snapshot; no entry found in F247.master.index's Document Register either. | `Fusion247 Brain/00_System/Governance/Reviews/F247.review.external-qa-claude-control-docs-2026-07-03.docx` | Candidate source for the fabricated-reference and/or unlogged-change incident — **not confirmed**, see note below. |
| F247.review.external-qa-claude — 2026-07-04 | Not in Drive Object Registry snapshot. Master-index's "Document Register additions — 2026-07-08" section lists ID `1CqPLlkBQ5RS2mdh8VI_uEy7P4OP2j700sBps52DQfVM`, noting only that the document was "found at Drive root and relocated" — no content description given. | `Fusion247 Brain/00_System/Governance/Reviews/F247.review.external-qa-claude — 2026-07-04.docx` | Referenced by the Brain's own QA process; not the primary source for either incident (see resolved note below — the primary source is the Session Log, not these review docs). |
| Session Log | `17pUoGCc9Hr2mWmzEayqDqen4TWIMvIUq5tUqXSWBy8o` — confirmed, F247 Drive Object Registry (Objects sheet), row "Session Log" | `Fusion247 Brain/00_System/Indexes/Session Log` | **The actual primary source for both named incidents** — see resolved note below. |

**Note — incident attribution, resolved:** Pax's original pass could not open the four binary `.docx` review files and flagged the attribution as unconfirmed. Larry re-checked using the plain-text Session Log extract already on disk from this session (`/tmp/claude-0/.../scratchpad/session-log.txt`) and found both incidents directly, dated and described in the Brain's own Session Log — not in any of the four `F247.review.external-qa-claude*` review docs, which is why Pax's docx-only search came up empty:
- **Fabricated-reference incident (BCC/Bristol City Council):** a fictional worked example used during an ontology-design session leaked into real control documents as if it were live project state — confirmed present in "README, F247.current-state, F247.agent.categorisair and the source-classification registry; no such project or folder exists in Drive" (Session Log entry, QA pass dated 2026-07-04/05). A second, live instance was caught and fixed later: a folder-schema example in the README literally read "05_Projects - Bellrock/BRK-001 - North Bristol Concerto Implementation" — replaced with the real worked example. The decision log (`F247.decision-log`) separately records the ruling that these were fictional examples, never real project state.
- **Unlogged-change incident:** two separate confirmed instances, both in the Session Log. (1) "~55-folder, entirely empty, unlogged and unregistered template scaffold created 23:53–00:03 under 05_Projects/Work Projects/Bellrock/_Project Template Master — conflicts with the approved pack... and places a reusable master under a client folder." (2) A separate incident: "the original 2026-07-06 Asda/AsdAIr household build was not found as a proper same-day Session Log entry... the second confirmed unlogged build incident."
These two incidents are exactly what motivated `F247.skill.update-qa-claude`'s later sections (per the Session Log itself: *"Updated F247.skill.update-qa-claude after section 9 with five new mandatory checks: Folder Hygiene, Link and Reference Verification, Fabricated Reference Check, Unlogged Change Detection and Connector Verification"*) — confirming this proposal's premise directly rather than by inference.

## Success criteria

- The user reviews the three options (all four dimensions addressed in each) and Pax's revised lean, and approves a direction, or asks for more exploration.
- If approved, a follow-up implementation task captures the actual build — this task closes once the direction is decided.

## Updates

- 2026-07-10 23:48 (pax) — created, per tsk-2026-07-10-001 decision 14 disposition of Migration Coverage Matrix follow-up #6 (new item, not one of the original five). Cross-refs: 2/7 populated (workstreams, deliverables). All other slots walked and confirmed genuinely empty — no existing SOP or Guideline governs content-integrity QA specifically yet (that's the gap this task proposes closing), no My Life entry applies, no session log or journal entry covers this.
- 2026-07-10 23:59 (pax) — **revision pass, superseding the sourcing-caveat framing above.** The Migration Coverage Matrix (`Deliverables/2026-07-10-fusion247-brain-migration-coverage-matrix.md`) was not on disk when this task was originally written; the task worked from a summary. Larry has since pulled the real matrix content; this task is now sourced directly from it. An external QA review of the full matrix instructed that the original scope (row 15 only: fabricated-reference + unlogged-change detection) was missing two dimensions from row 12 (VerifiAIr's original R/U/suggest-D-never-autonomous-D scope): content-level drift, and safe corrective boundaries across the Brain. Reworked: `## The gap` section now covers both rows and all four dimensions explicitly; all three options expanded to address all four (Option A now includes content-drift detection and an explicit safe-corrective-boundary rule for Larry's Duty 2; Option C's fit is now split — weak for content-checking, a reasonable philosophical model for the boundary-discipline dimension specifically); the lean is now a three-way split instead of two, explicitly placing content-drift (paired with fabrication) and the safe-corrective-boundary rule (recommended as a low-cost, do-now change to Larry's Duty 2 independent of the other three). Cross-refs re-walked: added `GL-007-human-facing-writing-conventions` to `linked_guidelines` in frontmatter (it was already referenced in the body's `## Context one click away` section but had been left out of the frontmatter array in the original version — a genuine gap in the original walk, now resolved). Still a Tier-1 proposal, still nothing implemented, still the user's call which option (if any).
- 2026-07-11 02:20 (pax) — Added "## Source material and retrieval map" per explicit user instruction, before any implementation. Citation only. Confirmed `F247.agent.verifiair`'s Drive object ID against the F247 Drive Object Registry snapshot (row 17, exact match). Confirmed `F247.skill.update-qa-claude` has no live document in this export — only the pre-Rev2 archived snapshot — but flagged that F247.master.index's own Document Register still lists it as "Active draft" with a Google Doc ID, implying a live Drive copy exists outside this export. Could not determine which of the four QA review docs describes the fabricated-reference incident versus the unlogged-change incident — all four are binary `.docx` with no content-extraction tool available this pass; listed all four as candidates with paths and flagged the attribution as unresolved rather than guessing, citing the closest actually-verified match (tsk-001 decision 7, a different artifact) instead.
- 2026-07-11 02:30 (larry) — Resolved Pax's flagged attribution gap: neither incident was in the four QA review docs Pax examined — both are documented directly in the Session Log itself (already extracted to plain text this session), which Pax's docx-only search couldn't reach since it's a different document. Found and cited both: the BCC/Bristol fictional-example-leaked-as-real fabrication (with a second, later live instance in a README folder-schema example), and two separate unlogged-build incidents (the ~55-folder Bellrock template scaffold, and the Asda/AsdAIr build). Confirmed both directly motivated `F247.skill.update-qa-claude`'s five new mandatory checks per the Session Log's own account, not by inference. Added Session Log as a properly-cited row (real Drive object ID, confirmed against the registry) and rewrote the note as resolved.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
