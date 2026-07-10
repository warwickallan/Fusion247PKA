---
# Identity
id: tsk-2026-07-10-003
title: "Design proposal: myPKA Knowledge Intake and Synthesis capability (matrix rows 13, 16, 38, 40, 41, 42)"

# Ownership & priority
assignee: unassigned
priority: 3
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:45:00Z
updated: 2026-07-11T02:10:00Z
due: null

# Provenance
created_by: pax
source: tsk-2026-07-10-001 decision 14 / Migration Coverage Matrix §6; revised per external QA review of the full matrix
parent: tsk-2026-07-10-001

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops:
  - SOP-001-how-to-add-a-new-specialist
  - SOP-010-warden-extract-source-to-evidence-pack
linked_workstreams:
  - WS-001-daily-journaling
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
tags: [tier-1-proposal, design-proposal, fusion247-brain, categorisair, knowledge-intake-and-synthesis, awaiting-approval, revised]
---

# Design proposal: myPKA Knowledge Intake and Synthesis capability (matrix rows 13, 16, 38, 40, 41, 42)

## What this is

This is a **Tier-1 design proposal only**, per [[WS-004-team-retro-and-self-improvement-loop]] §"Tier 1": *"The task is the proposal — it is not the change."* Nothing here is implemented. It awaits the user's approval of a direction before any implementer touches anything.

**Revision note (read this first):** this task originally covered only Migration Coverage Matrix row 13 (CategorisAIr / general source-to-WIKI triage), scoped against Penn and WS-002 only. Larry has since pulled the real matrix, and an external QA review of the full matrix instructed that this proposal is too narrow: *"Do not authorize a new hire yet. The Tier-1 proposal should define one broader Knowledge Intake and Synthesis capability... That resolves several rows together rather than creating a narrow 'CategorisAIr clone.'"* This revision reworks the task's scope, options, and boundaries accordingly. See `## Updates` for the full change record — the original framing is preserved there, not deleted.

## The gap — six matrix rows, one capability

Read together, the matrix names six rows that are facets of a single missing capability, not six separate small gaps:

| Row | Item | Disposition |
|---|---|---|
| 13 | **CategorisAIr** — general-purpose source-to-WIKI triage engine; template-selection registry; backlink-justification rule | unresolved |
| 16 | **`F247.update-fusion`** — chat-to-knowledge harvesting; the hard evidence rule that only current-context or preserved-raw-source counts as direct evidence, else the capture is tagged `Reconstructed / Needs verification` | unresolved |
| 38 | **TubeAIR** — YouTube-transcript-to-inbox capture pipeline (Zapier-first route in the source system) | deferred |
| 40 | **ICOR course-note intake route** — `F247.template.icor-course-notes`, structured course-lesson capture | deferred |
| 41 | **`F247.template.source-classification-registry`** — general registry routing arbitrary incoming source types to the correct processing template; explicitly distinct from WS-002's one-time import mapping table; explicitly entangled with row 13 | unresolved |
| 42 | **Backlink-justification rule** (don't create a backlink without a knowledge-bearing reason) + **root-clutter-prevention rule** (file directly into destination folders, never park in root as staging) | unresolved |

Framed as one capability, **"Knowledge Intake and Synthesis,"** the scope this proposal is actually deciding covers:

1. **Arbitrary source classification** — given an incoming piece of content (an article, a PDF, a transcript, a pasted chat excerpt), decide what kind of source it is and which processing template applies (rows 13, 41).
2. **Ongoing source-to-WIKI processing** — as a standing, recurring capability, not a one-time bulk migration event (row 13, contrasted explicitly with WS-002's scope below).
3. **Current-context vs. reconstructed evidence tagging** — the discipline of honestly labeling whether a captured fact came from something currently visible (chat context, a preserved raw source) versus something recalled/reconstructed, tagged accordingly rather than silently written as settled fact (row 16).
4. **Template selection** — the same registry problem named twice (rows 13, 41): route an arbitrary source to the correct destination shape.
5. **Justified backlinks** — a wikilink only gets created when there's an explainable, knowledge-bearing reason for it, not by default (rows 13, 42).
6. **Root-clutter prevention** — new content is filed directly into its destination folder; root is never used as a staging area (row 42).
7. **TubeAIR as an input adapter** — a YouTube-transcript capture channel that feeds *into* this capability, not a separate specialist or pipeline of its own (row 38).
8. **ICOR course notes as an input adapter** — a structured course-lesson capture channel that likewise feeds into this capability rather than needing its own owner (row 40).

This is the reviewer's framing: one capability with eight facets, resolved by one design decision, rather than six independent narrow gaps each requiring separate follow-up tasks.

**What this is explicitly not:** a proposal to build a "CategorisAIr clone" that only does source-to-WIKI triage. The evidence-tagging discipline (row 16) and the two input adapters (rows 38, 40) are qualitatively different kinds of work bundled under the same capability name because they share one property — they all decide *how something not yet in the wiki gets into the wiki, correctly labeled and correctly linked.*

## Design options (not a final pick — the user decides)

Re-derived against the widened scope. The tradeoffs shift materially once the scope is six rows wide instead of one.

**Option A — Hire a new specialist via Nolan, per [[SOP-001-how-to-add-a-new-specialist]].** A dedicated "Knowledge Intake and Synthesis" role owning: source classification, template routing, the evidence-tagging discipline, backlink-justification and root-clutter rules, and both input adapters (TubeAIR, ICOR notes) as its own intake channels.

- Pros: single, clean owner for a capability that — once widened to this scope — starts to resemble the size and shape of Warden's hire (a bounded but genuinely multi-faceted domain with its own doctrine, not a one-line utility), rather than a small triage utility. Two recurring input adapters plus an evidence-honesty discipline is a real, standing job, not an occasional favor.
- Cons: still the heaviest option — adds standing headcount. Usage-frequency evidence (how often does "here's a random source, file it somewhere sensible with a justified backlink, tagged for its evidence quality" actually happen) is still not something Pax has; it's the user's to supply.
- **Note versus the original version of this task:** in the narrow (row-13-only) framing, Option A looked like overkill for an unproven volume of work. At six-rows-wide, with two recurring capture channels and a distinct evidence-honesty rule attached, the case for a dedicated owner is measurably stronger than it was — this option should be read as more live than the original draft treated it.

**Option B — Extend [[WS-002-import-external-knowledge-base]]'s remit.** Add an ongoing "single ad-hoc source" branch alongside WS-002's existing bulk-import branch, extend Step 4's planning output with an explicit backlink-justification field, add the evidence-tagging discipline as a new step, and wire TubeAIR/ICOR-notes in as named input adapters that call into the extended workstream.

- Pros: reuses WS-002's existing plan/approve gate, entity-mapping table, and wikilink-normalization machinery — genuinely applicable groundwork.
- Cons — **materially heavier than the original version of this task suggested.** In the narrow framing, this looked like the lowest-cost path (just add a branch and a justification field to an existing mapping table). Against the full six-row scope, WS-002 would now also need to own: two standing capture channels that are not imports in any normal sense (TubeAIR/ICOR notes are recurring content channels, not one-time "bring in my Notion vault" events); an evidence-tagging discipline (row 16) that has nothing to do with import mapping at all; and general hygiene rules (backlink justification, root-clutter prevention, row 42) that apply to *all* wiki writing, not just imports. Stretching WS-002 this far risks it becoming "the general knowledge-intake system, which happens to have an import workstream inside it" — an identity and naming problem for WS-002 itself, not just a scope-creep problem. This option looks less obviously right than the original draft's lean suggested once the real scope is visible.

**Option C — Extend Penn's remit.** Penn already owns "where does this piece of content go in the wiki" judgment and stub-creation discipline for the user's own inputs.

- Cons — weakest fit, and arguably weaker under the wider scope than under the narrow one: the widened capability explicitly includes general external source material on arbitrary subjects (course notes, YouTube transcripts, articles) that is not "the user's own personal-life input," which is precisely the boundary Penn's own contract draws (see boundary statement below). Stretching Penn into general-purpose intake-and-synthesis — including an evidence-tagging discipline unrelated to journaling — is a bigger reach now than it was when the scope was a single triage-only row.

## Boundaries with adjacent specialists

The reviewer named four specialists this capability must be explicitly bounded against, regardless of which option (A/B/C) is chosen. These boundaries hold under any of the three options — they define what the capability is *not*, independent of who ends up owning it.

**Boundary vs. Penn** ([[Team/Penn - Journal Writer/AGENTS]]). Penn owns the user's own personal-life inputs — screenshots, voice notes, thoughts, business cards — routed with a warm, present-tense, reflective register tuned specifically to daily capture. Knowledge Intake and Synthesis owns general external source material on arbitrary subjects (an article, a transcript, a course note) that is not the user's own life narrative. The dividing line is content origin (the user's own life vs. external material), not mechanism — both may end up writing into similar destination folders, but the register, tone, and "why does this exist" question differ. Penn never gains the evidence-tagging discipline (row 16) or the general source-classification registry (rows 13, 41); those stay with this capability regardless of who owns it.

**Boundary vs. WS-002 / Silas** ([[Team/Silas - Database Architect/AGENTS]], [[WS-002-import-external-knowledge-base]]). WS-002 owns one-time, whole-source bulk migrations: a known PKM-tool export, run through full source-detection → inventory → plan/approve → normalize, once. Knowledge Intake and Synthesis owns ongoing, ad hoc, single-document-at-a-time intake as a *standing* capability — a recurring "here's one more thing, file it" job, not a migration event. If Option B is chosen, the workstream needs an explicit two-branch split (bulk-import vs. ongoing-triage) so the two jobs don't blur into one undifferentiated workstream; if Option A is chosen, WS-002 stays exactly as scoped today and this capability is a separate, standing process that may still call WS-002's plan/approve-gate pattern as a reusable procedure, not as shared ownership.

**Boundary vs. Warden** ([[Team/Warden - Delivery Manager/AGENTS]], [[SOP-010-warden-extract-source-to-evidence-pack]]). Warden's SOP-010 already does a structurally similar job — one full read of a source, producing structured outputs (Register Items, an Evidence Pack) instead of rereading a source three times across three different deliverables. But SOP-010 is scoped exclusively to `Client Delivery/` engagements, governed by [[GL-006-client-delivery-frontmatter-conventions]], producing formal Register Items with `evidence_type`/`confidence`/`reread_flag` fields specific to client-delivery governance. Knowledge Intake and Synthesis is scoped to general/personal PKM (`PKM/`, `Team Knowledge/`) — the two never overlap in scope (the folder boundary `Client Delivery/` vs. everything else is the dividing line), even though they share the underlying design pattern ("read once, produce multiple structured, reusable outputs"). Neither absorbs the other; if the evidence-tagging discipline (row 16) proves useful inside `Client Delivery/` too, that is a separate proposal to extend GL-006, not something this capability does directly.

**Boundary vs. Pax** ([[Team/Pax - Researcher/AGENTS]]). Pax does deep, cross-source-verified research and produces decision-grade briefs to `Deliverables/` — going out and finding, checking, and triangulating facts about the world. Knowledge Intake and Synthesis processes an *already-acquired* piece of content into the wiki's structure (classify it, pick its destination, justify its backlinks, tag its evidence honestly) — it does not go find or verify the truth of claims about the world. If a source being filed makes a claim that needs independent verification, that's a hand-off to Pax, not something this capability does itself. The row-16 evidence-tagging discipline ("current-context or preserved-source, else `Reconstructed/Needs verification`") is a lighter-weight, capture-honesty discipline about *where a captured fact came from*, distinct from Pax's cross-source-triangulation discipline about *whether a claim is true*. The two are easy to conflate by name ("evidence") but are different jobs.

## Pax's lean (not a ruling)

Given the widened scope, Option A reads as more defensible than the original version of this task suggested — bundling two recurring capture channels, an evidence-honesty discipline, and general hygiene rules under one owner starts to look like a real, standing role rather than a small utility extension, closer in shape to Warden's hire than to "add a branch to WS-002." Option B is not ruled out, but its case has weakened materially now that the true scope is visible — it would need the explicit two-branch split named in the boundary section above to avoid muddying WS-002's identity. Option C remains the weakest fit. This is still a recommendation, not a decision: usage-frequency evidence (how often this class of need actually arises) is the user's to supply and should weigh heavily, especially between A and B.

## Context one click away

- Procedure (if Option A chosen): [[SOP-001-how-to-add-a-new-specialist]]
- Workstream (if Option B chosen): [[WS-002-import-external-knowledge-base]]
- Reference pattern (boundary discussion): [[SOP-010-warden-extract-source-to-evidence-pack]], [[WS-001-daily-journaling]]
- Governing loop: [[WS-004-team-retro-and-self-improvement-loop]]
- Guidelines: [[GL-001-file-naming-conventions]], [[GL-002-frontmatter-conventions]]
- Parent task: [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]
- Working artifacts:
  - [[2026-07-10-fusion247-brain-migration-coverage-matrix]]

## Source material and retrieval map

Per explicit user instruction: exact source title, Drive object ID where confirmed in the extracted F247 Drive Object Registry snapshot, canonical path, and purpose. Most items below are **not** rows in that registry — said honestly rather than invented. Citation only; no source content is copied into this task.

| Source | Drive object ID | Canonical path | Purpose |
|---|---|---|---|
| F247.agent.categorisair | `1pu2dlMYXtbLeVww4-HGJHmom0tW1xWYHBItPJXoEYMU` — confirmed, F247 Drive Object Registry (Objects sheet), row "F247.agent.categorisair" | `Fusion247 Brain/00_System/agents/F247.agent.categorisair.docx` | The general source-to-WIKI triage agent this new specialist supersedes/replaces. |
| F247.update-fusion | Not a row in the Drive Object Registry (Objects sheet). F247.master.index's own, separate Document Register lists a Google Doc ID for this title (`1xRX6HGf7e7X4etqno3NSktQK_3ere3jLMf1sMi9qx0w`) — a different index, not cross-verified against the Object Registry; cited for completeness only. | `Fusion247 Brain/00_System/commands/F247.update-fusion.docx` | The chat-to-knowledge harvesting command with the evidence-scope rule (current-context/preserved-source only, else `Reconstructed/Needs verification`) — the exact discipline this specialist's evidence-origin labeling must carry forward. |
| F247.tubeair.project-readme | Not in registry snapshot. | `Fusion247 Brain/05_Projects/Project Fusion247/F247 YT Transcript Ingress/00_Project_Control/F247.tubeair.project-readme.docx` | TubeAIR project overview — one of the input-adapter artifacts this specialist accepts a handoff from. |
| F247.tubeair.workpackage-plan | Not in registry snapshot. | `Fusion247 Brain/05_Projects/Project Fusion247/F247 YT Transcript Ingress/01_Workpackages/F247.tubeair.workpackage-plan.docx` | TubeAIR delivery plan for the YouTube-transcript intake adapter. |
| F247.tubeair.agent-and-command-spec | Not in registry snapshot. | `Fusion247 Brain/05_Projects/Project Fusion247/F247 YT Transcript Ingress/02_Agent_and_Command_Specs/F247.tubeair.agent-and-command-spec.docx` | TubeAIR's own agent/command boundary spec. |
| F247 TubeAIR build prompt pack | Not in registry snapshot. | `Fusion247 Brain/05_Projects/Project Fusion247/F247 YT Transcript Ingress/03_Technical_Build_Spec/F247 TubeAIR build prompt pack.docx` | TubeAIR's technical build spec. |
| F247 TubeAIR governance review | Not in registry snapshot. | `Fusion247 Brain/05_Projects/Project Fusion247/F247 YT Transcript Ingress/05_QA_and_Governance/F247 TubeAIR governance review.docx` | QA/governance sign-off on the TubeAIR adapter design. |
| F247.template.youtube-transcript-knowledge-note | Not in registry snapshot; also has no ID anywhere in F247.master.index's Document Register (only named, undated, in its Agent and Template Register). | `Fusion247 Brain/00_System/Templates/F247.template.youtube-transcript-knowledge-note.docx` | Destination template TubeAIR hands captures off to. |
| YouTube Transcripts (raw-capture folder) | Not a row itself. Its parent folder `02_Sources` is a registry row (`1Kwaad9cBKQsu-cT4wEdd0kYJz8ed-52k`, Structural Spec sheet) — the `YouTube Transcripts` subfolder has no separate ID in the snapshot. | `Fusion247 Brain/02_Sources/YouTube Transcripts/` | Raw-capture landing folder TubeAIR writes into before processing. |
| F247.template.icor-course-notes | Not a Drive Object Registry row. F247.master.index's Document Register lists a Google Doc ID for this title (`1FLrpnMbnV2WJa2ZUtweUwdwd4BCE7ssJUuqmkGgs07c`) — different index, cited for completeness only. | `Fusion247 Brain/00_System/Templates/F247.template.icor-course-notes.docx` | Structured course-lesson capture — another real input adapter. |
| F247.template.source-classification-registry | Not a Drive Object Registry row. F247.master.index's Document Register lists a Google Doc ID for this title (`1697s4v0Fruj8iGlt0_yFeHXf1WFxfyP4Gak5_NdZNjc`) — different index, cited for completeness only. | `Fusion247 Brain/00_System/Templates/F247.template.source-classification-registry.docx` | The precedent this specialist's own canonical source-classification registry (hire-research Part 2) should study, not copy. |
| Backlink-justification / root-clutter-prevention rules | Same object ID as the row above (`1pu2dlMYXtbLeVww4-HGJHmom0tW1xWYHBItPJXoEYMU`) — confirmed by content, not just filename. | `Fusion247 Brain/00_System/agents/F247.agent.categorisair.docx`, dated sections "Latest backlink rule — 2026-07-02" and "Problem It Solves" | The rule this specialist's justified-backlink and no-root-staging discipline must carry forward. |

**Note on the backlink-justification/root-clutter rule (resolved):** Pax's original pass flagged this as unconfirmed — `.docx` is binary and Pax has no content-extraction tool. Larry re-extracted the file directly and confirmed both rules are stated explicitly, not paraphrased or inferred:
- **Backlink justification**, dated section "Latest backlink rule — 2026-07-02": *"CategorisAIr must not create backlinks automatically for every named thing. A backlink is justified only where there is sufficient source-derived knowledge to add to a WIKI note, or where an existing WIKI note can be enriched by the source... Example: NetworkChuck liking coffee belongs under `[[NetworkChuck]]` if relevant to persona; it does not justify creating `[[Coffee]]`."*
- **Root-clutter prevention** is stated as the agent's core reason for existing, under "Problem It Solves": *"Fusion247 will fail if incoming knowledge piles up in loose Google Drive documents, inbox folders, transcripts, chat exports and root-level clutter. The problem is not lack of storage. The problem is unsorted intake."* — with an explicit "Inbox Archive Rule" (processed originals move to a dated archive path, never left in root) as the mechanism.

This also resolved a useful extra: the doc's own "CRUD boundary" section states *"CategorisAIr = Create, Read, Update, suggest Delete; VerifiAIr = Read, Update, suggest Delete"* — directly relevant precedent for how this new specialist's own authority boundary should be framed (it creates; it does not have final delete authority).

## Success criteria

- The user reviews the widened scope (six matrix rows bundled into one capability) and the three re-derived options, and either approves a direction (A, B, C, or a fourth option none of these anticipated) or asks for more exploration before deciding.
- Once a direction is approved, a follow-up implementation task is created — this task itself closes as "direction decided" without doing any of the build.

## Updates

- 2026-07-10 23:45 (pax) — created, per tsk-2026-07-10-001 decision 14 disposition of Migration Coverage Matrix follow-up #1. Cross-refs: 5/7 populated (sops, workstreams, guidelines, deliverables; my_life, session_logs, journal_entries genuinely empty after the walk — no existing session log covers this yet, no journal priors exist for any specialist, no My Life entry applies).
- 2026-07-10 23:58 (pax) — **revision pass, superseding the sourcing-caveat framing above.** The Migration Coverage Matrix (`Deliverables/2026-07-10-fusion247-brain-migration-coverage-matrix.md`) was not on disk when this task was originally written — the row-13 detail was Pax's reconstruction from a one-line parent-task summary, flagged honestly at the time. Larry has since pulled the real matrix content; this task is now sourced directly from it. An external QA review of the full matrix instructed that the original row-13-only framing was too narrow and should bundle rows 13, 16, 38, 40, 41, 42 into one "Knowledge Intake and Synthesis" capability. Reworked: `## The gap` section now covers all six rows explicitly; the three design options are re-derived against the wider scope (Option A now reads as more defensible, Option B's case has weakened); added a new `## Boundaries with adjacent specialists` section covering all four specialists the reviewer named (Penn, WS-002/Silas, Warden, Pax) — the original version only discussed Penn and WS-002. Cross-refs re-walked against the full matrix and widened scope: added `SOP-010-warden-extract-source-to-evidence-pack` to `linked_sops` and `WS-001-daily-journaling` to `linked_workstreams` (both needed once the Warden and Penn boundary statements were written — genuine gaps in the original walk, now resolved). Still a Tier-1 proposal, still nothing implemented, still the user's call which option (if any).
- 2026-07-11 02:10 (pax) — Added "## Source material and retrieval map" per explicit user instruction, before any implementation. Citation only — no source content copied. Confirmed via `Glob` against the Fusion247 Brain export (`/workspace/fusion247brain/Fusion247 Brain/`) that all named TubeAIR/ICOR/source-classification-registry/categorisair/update-fusion paths exist as given; cross-checked `F247.agent.categorisair`'s Drive object ID against the F247 Drive Object Registry snapshot (confirmed, exact row match). Could not confirm the exact home of the backlink-justification/root-clutter-prevention rule inside `F247.agent.categorisair.docx` itself — binary `.docx`, no content-extraction tool available this pass; cited the two closest textual matches found in the plaintext registry (ROUTE-002, ROUTE-008) instead and flagged the gap openly rather than guessing.
- 2026-07-11 02:20 (larry) — Resolved Pax's flagged gap: extracted `F247.agent.categorisair.docx` directly (have a docx-content script, Pax doesn't). Both rules are stated explicitly in the source, not inferred — backlink justification in its dated "Latest backlink rule — 2026-07-02" section, root-clutter prevention as the agent's core "Problem It Solves" framing plus its Inbox Archive Rule mechanism. Updated the retrieval-map row and note with the real quotes and citation. Also surfaced a useful bonus: the doc's own CRUD boundary ("Create/Read/Update/suggest-Delete") is directly relevant precedent for framing the new specialist's authority boundary.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
