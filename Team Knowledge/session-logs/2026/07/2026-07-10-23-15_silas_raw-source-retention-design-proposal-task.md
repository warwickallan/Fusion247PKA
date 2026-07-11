---
agent_id: silas
session_id: raw-source-retention-design-proposal-task-2026-07-10
timestamp: 2026-07-10T23:15:00Z
type: end-of-session
linked_sops: [SOP-create-task, SOP-015-cairn-process-external-source, SOP-016-cairn-process-youtube-transcript, SOP-010-warden-extract-source-to-evidence-pack]
linked_workstreams: [WS-004-team-retro-and-self-improvement-loop]
linked_guidelines: [GL-002-frontmatter-conventions, GL-006-client-delivery-frontmatter-conventions, GL-008-source-classification-registry, GL-001-file-naming-conventions]
---

# Filed the Tier-1 design proposal task for canonical raw-source retention in general PKM intake

## What I did

Larry routed a named, real gap to me directly (not a build request): Cairn's SOP-015 pilot
(`[[2026-07-11-04-30_cairn_hermes-transcript-pilot]]`) and its follow-on SOP-016
(`[[2026-07-10-23-50_cairn_sop-016-transcript-chunk-mapping]]`) both hit and flagged the same
open gap on real work — general PKM intake (`PKM/`, `Team Knowledge/`) has no equivalent of
Warden's `Sources (Immutable)/` (GL-006), which is scoped exclusively to `Client Delivery/`.
SOP-015 Step 9 currently just honestly states the absence rather than resolving it.

Per SOP-create-task, ran the duplicate check first (none — grepped `open/` and `in-progress/`
for "immutable"/"raw-source"/"TubeAIR", no existing task covers this), generated the next id
(`tsk-2026-07-10-007`, highest existing sequence for today was `-006`), and walked all seven
`linked_*` arrays before writing.

Wrote `[[tsk-2026-07-10-007-raw-source-retention-design-proposal]]` as a genuine Tier-1
proposal per [[WS-004-team-retro-and-self-improvement-loop]] §"Tier 1" — nothing implemented,
no folders created, no TubeAIR build. The task states the gap, three design options for the
canonical location (a PKM-wide date-nested immutable store; per-entity-type source folders;
a GL-008-category-bucketed store), a recommendation (the PKM-wide date-nested store, reasoned
the same way GL-006's `Sources (Immutable)/` was reasoned but re-scoped off engagement-nesting
onto the existing `PKM/Journal/`, `PKM/Images/`, `Team Knowledge/session-logs/` date-nesting
doctrine — [[AGENTS]] hard rule 5 — since raw-source capture is a dated event, not a flat
concept), and the explicit constraint TubeAIR's future design must satisfy once this is
decided: preserve the raw transcript and available metadata into the canonical location
*before* handing off to Cairn/SOP-015, so SOP-015 Step 9 can cite a stored copy instead of a
bare citation line.

Assignee: `silas` (per Larry's brief). Priority: 2 (high) — not urgent today (no TubeAIR build
in flight to block right now), but this is a genuine precondition that blocks TubeAIR ever
being built safely, so it shouldn't sit at normal/low.

## Cross-reference walk (6/7 populated)

- `linked_sops`: SOP-015, SOP-016 (both named the gap on real pilot work), SOP-010 (the Client
  Delivery precedent this proposal adapts, not copies), SOP-create-task (the procedure this
  task itself was created through).
- `linked_workstreams`: WS-004 (defines the Tier-1 proposal discipline this task follows).
  Left `WS-002-import-external-knowledge-base` out of the frontmatter after checking it against
  the boundary tsk-2026-07-10-003 already drew — WS-002 is one-time bulk migration, this gap is
  about ongoing ad hoc intake (SOP-015/016's domain), not WS-002's; mentioned as a boundary note
  in the task body instead of forcing a frontmatter link that doesn't actually govern this work.
- `linked_guidelines`: GL-002 (mechanical rules any new folder inherits), GL-006 (the precedent
  being adapted), GL-008 (the classification vocabulary reused as an INDEX column, not a folder
  axis), GL-001 (date-nesting and slug rules the proposed folder must follow).
- `linked_my_life`: `ai-tooling` — the concrete Topic note Cairn's pilot enriched, the live
  illustration of what a preserved raw source would have been provenance for.
- `linked_session_logs`: the three session logs that surfaced or touched this gap on real work,
  plus this one.
- `linked_journal_entries`: `[]` — genuinely empty. No specialist has a journal entry yet (every
  `Team/<Name>/journal/` folder holds only `_template.md`); confirmed by directory walk.
- `linked_deliverables`: `[]` — the proposal lives entirely in the task body, same shape as
  `tsk-2026-07-10-003`'s own design-options sections; no separate Deliverables artifact was
  created for this pass.

## Files touched

- `Team Knowledge/tasks/open/tsk-2026-07-10-007-raw-source-retention-design-proposal.md` — new.
- `Team Knowledge/tasks/INDEX.md` — rebuilt (new open task row, summary counts updated).
- This session log — new.

## What the next agent must know

- This is a proposal only — no folder, no template, no GL-002/GL-006 edit has been made. The
  user still needs to approve a direction (or ask for more exploration) before anyone builds
  anything, exactly as `tsk-2026-07-10-003` is waiting on its own direction decision.
- If the user approves Option A (the recommendation), the actual build touches: a new date-nested
  root folder, an `INDEX.md` register pattern copied from GL-006's own `Sources (Immutable)/
  INDEX.md` mechanics, an SOP-015 Step 9 rewrite (cite the stored copy instead of flagging the
  absence), and — only once TubeAIR is actually scoped for a build — TubeAIR's own design
  inheriting the "preserve before handoff" constraint stated in this task.
- The "does this feed the SQLite mirror" question is deliberately left open in the task body,
  same deferred posture GL-006 already carries for `Client Delivery/` — not decided this pass.
