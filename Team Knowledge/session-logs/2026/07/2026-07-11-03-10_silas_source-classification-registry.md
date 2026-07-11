---
agent_id: silas
session_id: source-classification-registry-2026-07-11
timestamp: 2026-07-11T03:10:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: [GL-008-source-classification-registry, GL-002-frontmatter-conventions, GL-006-client-delivery-frontmatter-conventions]
---

# Drafted GL-008 — Source Classification Registry, closing Cairn's open dependency

## What I did

Larry routed a follow-up build task: Cairn (Knowledge Intake Specialist, just hired)
needs a small, governed vocabulary of source types mapped to processing guidance and
destination, rather than improvising a category per source. Cairn's own contract had
explicitly deferred this to Silas at hire time, estimating it would land at GL-008.
Full account is decision 18 in
`Team Knowledge/tasks/in-progress/tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden.md`.

1. **Confirmed the live slot rather than trusting the estimate.** Checked
   `Team Knowledge/Guidelines/INDEX.md` directly — still GL-008, unchanged since Cairn's
   hire. Bumped the index's "next free slot" note to GL-009.
2. **Read the user's own prior attempt for structural precedent, not content.**
   `F247.template.source-classification-registry.docx` in the Fusion247 Brain export
   (`/workspace/fusion247brain/Fusion247 Brain/00_System/Templates/`) — a
   five-dimension classification matrix (source form, content domain,
   context/ownership, intended output, sensitivity) mapped toward a template-selection
   system, never more than an AI-authored draft awaiting the user's review. Re-derived
   rather than copied: this Guideline converges on one fixed, six-category vocabulary
   mapped directly onto GL-002's eight existing entity types instead of a second
   classification axis or a parallel template system.
3. **Six categories, checked against what actually recurs for this user**, not lifted
   wholesale from the task brief's own illustrative list: Article/Written Source,
   Document/Report, Video/Audio Transcript, Course/Lesson Note, Chat/Conversation
   Excerpt, Email/Correspondence. Kept Document/Report distinct from Article — a
   personal record to retain vs. informational content to learn from is a real
   destination difference (GL-002's Document entity already encodes a
   "must be locatable as a record" test) — rather than merging them for a lower count.
   Sized to the 4-7 band Pax's taxonomy-governance research recommends
   ([[2026-07-11-knowledge-intake-synthesis-hire-research]] §1-2).
4. **Per category: "typically maps to" and "rarely/never" guidance against GL-002's
   entity types**, explicitly framed as guidance Cairn still reasons with per source,
   not a rigid lookup table. Added a note that Goal/Habit/Key Element are deliberately
   absent as typical mappings — those are the user's own deliberately-set operating
   layer, never inferred outright from external material; Cairn surfaces a suggestion,
   never creates one unilaterally.
5. **Explicit owner/steward model.** Silas owns and edits; Cairn consumes only, mirroring
   the existing "Cairn does not edit GL-002" rule. A candidate new category is not added
   on a single observed misfit — it needs to recur at least twice, independently, in
   Cairn's session-log flags before Silas considers it. Directly implements the
   "explicit owner/steward model so the vocabulary doesn't drift under casual editing"
   requirement from Pax's research and the task brief.
6. **Explicit integration statement, not restatement, for Cairn's other two
   disciplines.** A new §"How this integrates with evidence-origin labeling and
   backlink-justification" states this registry is orthogonal — it answers "what kind
   of source, which entity" only, never upgrades a claim's evidence-origin label and
   never grants a backlink a free pass — with a worked three-layer example (classify →
   evidence-origin label → backlink justification) on one fictional YouTube-transcript
   source, cross-referencing Cairn's own contract rather than duplicating its content.
7. **Explicitly NOT a new entity type or new frontmatter field, stated twice.** A
   top-level "What this is explicitly NOT" section near the top of the file, and a
   restatement inside §How to extend this Guideline, both make clear Cairn still files
   into the existing eight GL-002 entity types unchanged — any real schema need routes
   through GL-002/GL-006's own extension paths, never this file.
8. **Explicit `Client Delivery/` boundary.** Sources inside `Client Delivery/` are
   Warden's, governed by GL-006/SOP-010; this registry does not apply there — stated in
   §What this is explicitly NOT and cross-referenced.

## Files touched

- `Team Knowledge/Guidelines/GL-008-source-classification-registry.md` — new file, v1.0.
- `Team Knowledge/Guidelines/INDEX.md` — new GL-008 row, next-free-slot bumped to GL-009.
- `Team/Cairn - Knowledge Intake Specialist/AGENTS.md` — §Method step 2 now classifies
  against GL-008 by name (previously "no registry exists yet"); the "Open dependency"
  paragraph in §Cross-references rewritten to confirm GL-008 exists and summarize its
  governance model; new GL-008 line added to §References.
- `.claude/agents/cairn.md` — added GL-008 as on-every-invocation read #4; replaced the
  stale "no governed registry exists yet" operating-discipline line with the
  six-category classify-against-GL-008 instruction; updated the return-format line to
  reference GL-008's recurrence-gated growth model instead of "Silas's future registry."
- `.codex/agents/cairn.toml` — same three edits as the Claude Code shim, kept in sync
  (translated, not re-derived, per the existing two-host-shim discipline from decision 12).
- `Team Knowledge/tasks/in-progress/tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden.md`
  — decision 18, an `## Updates` line, `updated` bumped, `linked_guidelines` gained
  `GL-008-source-classification-registry`.

**No entity data existed to migrate** — this is a schema/doctrine-layer pass only.
Cairn had not yet run its pilot source at the time of this pass, so there was no live
classification decision to reconcile against the new registry.

## What the next agent must know

- GL-008 is live at `Team Knowledge/Guidelines/GL-008-source-classification-registry.md`.
  Cairn's contract and both host shims now point at it by name — do not reintroduce the
  "no registry exists yet" framing anywhere.
- The next free Guideline slot is **GL-009**, not GL-008 — `Team Knowledge/Guidelines/INDEX.md`
  reflects this.
- GL-008's growth is recurrence-gated (two independent misfits, not one) — if Cairn's
  pilot run (or any future intake) surfaces a source that doesn't fit the six categories,
  the correct move is a session-log flag, not an ad-hoc seventh category or a direct edit
  to GL-008 by anyone other than Silas.
- `F247.template.source-classification-registry.docx` was read directly via a small
  Python/`zipfile` extraction (no `pandoc` needed) — same technique available for any
  future `.docx` in the Fusion247 Brain export if the `Read` tool's native `.docx`
  support isn't available.
