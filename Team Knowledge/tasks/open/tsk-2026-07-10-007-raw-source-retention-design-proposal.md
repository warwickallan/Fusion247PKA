---
# Identity
id: tsk-2026-07-10-007
title: "Design proposal: canonical raw-source retention location for general PKM intake (TubeAIR precondition)"

# Ownership & priority
assignee: silas
priority: 2
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T23:10:00Z
updated: 2026-07-10T23:10:00Z
due: null

# Provenance
created_by: silas
source: larry-brief-2026-07-10, surfaced by Cairn's SOP-015/SOP-016 pilot work
parent: tsk-2026-07-10-003-categorisair-equivalent-design-proposal

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops:
  - SOP-015-cairn-process-external-source
  - SOP-016-cairn-process-youtube-transcript
  - SOP-010-warden-extract-source-to-evidence-pack
  - SOP-create-task
linked_workstreams:
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines:
  - GL-001-file-naming-conventions
  - GL-002-frontmatter-conventions
  - GL-006-client-delivery-frontmatter-conventions
  - GL-008-source-classification-registry
linked_my_life:
  - ai-tooling
linked_session_logs:
  - 2026-07-11-04-30_cairn_hermes-transcript-pilot
  - 2026-07-10-23-50_cairn_sop-016-transcript-chunk-mapping
  - 2026-07-11-03-10_silas_source-classification-registry
  - 2026-07-10-23-15_silas_raw-source-retention-design-proposal-task
linked_journal_entries: []
linked_deliverables: []

# Tagging
tags: [tier-1-proposal, design-proposal, schema, raw-source-retention, tubeair, cairn, awaiting-approval]
---

# Design proposal: canonical raw-source retention location for general PKM intake (TubeAIR precondition)

## What this is

This is a **Tier-1 design proposal only**, per [[WS-004-team-retro-and-self-improvement-loop]]
§"Tier 1": *"the task is the proposal, it is not the change."* Nothing here is implemented — no
folder created, no template written, no GL-002/GL-006 edit made, no TubeAIR build started. It
states the gap, at least two real design options with tradeoffs, and a recommendation, and it
awaits the user's sign-off on a direction before any implementer touches anything.

## The gap

Cairn (Knowledge Intake Specialist, `Team/Cairn - Knowledge Intake Specialist/AGENTS.md`,
canonical process [[SOP-015-cairn-process-external-source]]) ran its first real pilot filing a
YouTube transcript's knowledge into `PKM/My Life/Topics/ai-tooling.md`. SOP-015 Step 9 requires
addressing raw-source provenance honestly, and Cairn's pilot did exactly that — it surfaced this
line explicitly, in the note body and in its own session log:

> "the transcript itself lives only in this session's scratchpad, not in this repo — general PKM
> intake has no equivalent of Warden's `Sources (Immutable)/` (that pattern is scoped to
> `Client Delivery/` only)."

A follow-on pass, SOP-016 (`[[SOP-016-cairn-process-youtube-transcript]]`), hit the identical gap
again and again deliberately declined to paper over it — it defers entirely to SOP-015 Step 9's
honest-flagging behavior rather than assuming a store exists.

**This is a real, named, twice-recurring gap, not a one-off pilot footnote.** Warden's
`Client Delivery/` root solves this for business/client-delivery sources via
`Sources (Immutable)/` — a per-engagement folder of raw captures, never edited post-capture, plus
an `INDEX.md` register (title, capture date, source tier, description, wikilink to the destination
note), governed by [[GL-006-client-delivery-frontmatter-conventions]]. General PKM (`PKM/`,
`Team Knowledge/`) has no equivalent, and right now a preserved raw source depends entirely on the
processing note's own memory of the source being accurate, with nothing to check it against if
that memory ever drifts.

**Why this blocks TubeAIR specifically.** TubeAIR (the myPKA-side YouTube-capture adapter, still
unbuilt — matrix row 38 / [[tsk-2026-07-10-003-categorisair-equivalent-design-proposal]]
§Source material, citing the Fusion247 Brain precedent artifacts `F247.tubeair.project-readme`,
`F247.tubeair.workpackage-plan`, `F247.tubeair.agent-and-command-spec`) is explicitly designed to
land raw YouTube transcripts into a raw-capture folder (`Fusion247 Brain/02_Sources/YouTube
Transcripts/` in the source system) *before* handing off to processing. Building TubeAIR without
a canonical general-PKM raw-source home first would mean either (a) inventing an ad-hoc location
unilaterally at build time — exactly the kind of schema decision this team's discipline requires
routing through Silas first, or (b) shipping TubeAIR with the same "transcript only lives in a
session scratchpad" gap Cairn's pilot already flagged, permanently, for every future capture. The
user has explicitly stated this must not happen: **TubeAIR must preserve the immutable transcript
and available source metadata BEFORE Cairn processes it.** This task decides *where*, not
whether.

## Scope boundary

This proposal is scoped to **raw external-source retention for Cairn's domain** (already-acquired
external material processed via SOP-015/SOP-016, and the future TubeAIR/ICOR-course-note capture
adapters that will feed it — see [[tsk-2026-07-10-003-categorisair-equivalent-design-proposal]]
for the still-open question of who owns that ongoing intake capability). It is **not**:

- A redesign of `Team Inbox/`, `PKM/Journal/`, or `PKM/Images/` — Penn's existing personal-capture
  paths already have their own retention homes and are untouched by this proposal.
- A redesign of `WS-002-import-external-knowledge-base`'s bulk-migration scope. WS-002 imports a
  whole external PKM-tool export as a one-time event; the export itself typically stays wherever
  the user keeps it outside the repo. Whether WS-002 imports should *also* retain a raw copy
  through this same mechanism is a fair follow-up question, deliberately left open here rather
  than silently bundled in — see `## Open questions` below.
- A decision about `Client Delivery/`'s own `Sources (Immutable)/` pattern. GL-006 stays exactly
  as it is; this proposal studies its reasoning as precedent, it does not modify it.

## Design options (not a final pick — the user decides)

### Option A (recommended) — a single PKM-wide immutable store, date-nested

```
PKM/Sources (Immutable)/
├── INDEX.md                    -> the register: one row per captured file
└── YYYY/
    └── MM/
        └── <captured files>    -> raw captures, no frontmatter, never edited post-capture
```

- **Naming:** `YYYY-MM-DD-<slug>.<ext>` per [[GL-001-file-naming-conventions]] (a `.txt` for a
  transcript, whatever extension the source actually is).
- **Register (`INDEX.md`), one row per file:** capture date, title/apparent title, GL-008
  category ([[GL-008-source-classification-registry]] — reused as an INDEX column, not a new
  folder axis, see the rejected Option C below), acquisition channel (e.g. "Cairn direct paste,"
  "TubeAIR," future "ICOR course-note adapter"), destination note(s) as wikilinks, one-line
  description. Same table shape as GL-006's own `Sources (Immutable)/INDEX.md` and `Archive/
  INDEX.md` — no new register mechanic invented, the existing precedent is reused wholesale.
- **No frontmatter on the raw file itself** — same call GL-006 already made for its own raw
  captures: a `.txt`/`.pdf`/pasted-transcript file is not one of GL-002's eight entity types, and
  a table register is the proportionate mechanism (identical reasoning to GL-006 v1.4's Archive/
  INDEX.md decision).
- **Why date-nested, not engagement-nested:** `Client Delivery/`'s `Sources (Immutable)/` nests
  per engagement because an engagement is the natural unit of scope there. General PKM has no
  equivalent bounded unit — a captured source's natural axis is *when it was captured*, exactly
  like `PKM/Journal/`, `PKM/Images/`, and `Team Knowledge/session-logs/` already nest by
  `YYYY/MM/` per [[AGENTS]] hard rule 5 ("date-driven folder nesting"). This re-derives GL-006's
  reasoning rather than copying its structure wholesale, exactly as the brief asked.
- **Why one PKM-wide root, not scattered per capture:** a single canonical home means a source
  that ends up enriching more than one entity (e.g. a transcript that substantively informs both
  a Topic and a Person in the same SOP-015 pass) has exactly one home regardless of how many
  destination notes cite it back — no "which folder does this belong to" tie-break needed.

**Pros:**
- Directly reuses Warden's proven, already-reviewed pattern (immutable-once-captured, table
  register, no frontmatter on raw files) — no new doctrine invented, only re-scoped.
- Matches the scaffold's own existing date-nesting convention exactly — an agent who already
  understands `PKM/Journal/` or `Team Knowledge/session-logs/` understands this folder for free.
- Solves the multi-destination-source case cleanly (see above); Option B does not.
- Discoverable at the PKM root, next to Journal/Images/CRM/My Life/Documents, not buried inside
  an entity type.

**Cons:**
- A new PKM-root-level folder is a real structural addition — must be disciplined against
  root-clutter (mitigated: files are written directly into `YYYY/MM/` at capture time, never
  staged loose in `Team Inbox/` first or left in a root-level pile — the same "Inbox Archive
  Rule" / root-clutter-prevention doctrine matrix row 42 already names, applied here).
- Opens the same "does this feed the SQLite mirror" question GL-006 already carries as an
  explicit open flag for `Client Delivery/` — not resolved by this option, deliberately deferred
  the same way (see `## Open questions`).
- Requires a capture-time discipline (log the `INDEX.md` row when the file lands, not later) —
  the same discipline Warden already has to maintain for its own `Sources (Immutable)/INDEX.md`,
  now asked of Cairn/TubeAIR/any future adapter too.

### Option B — per-entity-type source folders

```
PKM/My Life/Topics/Sources/ai-tooling/<captured files>
PKM/CRM/People/Sources/<person-slug>/<captured files>
... (one per each of the eight entity folders)
```

Each of the eight entity folders gains a `Sources/` sub-folder, itself sub-folder per entity
slug, holding the raw captures that fed that specific entity.

**Pros:** tight 1:1 proximity between a raw source and the entity it enriched — browsing one
entity's own `Sources/` subfolder needs no separate register at all.

**Cons:**
- Breaks [[AGENTS]] hard rule 5's own "concept folders stay flat" doctrine ("Concept folders
  (Topics, Habits, Goals, Projects, Key Elements, People, Organizations, Documents) stay flat.
  One file per concept.") — this option requires nesting inside every one of those eight folders,
  a structural change none of them currently have.
- **Does not solve the multi-destination-source case at all.** SOP-015's own worked example
  enriched exactly one Topic, but Cairn's contract explicitly anticipates a source enriching a
  Person *and* a Topic in the same pass (see SOP-015 Step 5's "does this earn a note" test, run
  per candidate entity). Under Option B that source needs either a duplicate physical copy
  (breaks the single-immutable-original principle GL-006 itself relies on) or an arbitrary
  "which entity owns the file" tie-break this option has no answer for.
- No home at all for a source that is fully processed but yields **zero** destination entities —
  a real, documented outcome (Cairn's own Hermes pilot enriched one existing Topic and created
  zero new notes; a source that enriches nothing at all is an easy next case). Option A's
  PKM-wide root still has an obvious home; Option B has none.
- Eight separate "when does this entity type's `Sources/` subfolder first get created" decisions
  instead of one canonical answer.

### Option C — a GL-008-category-bucketed store (considered, not recommended)

```
PKM/Sources (Immutable)/Video-Audio-Transcript/<captured files>
PKM/Sources (Immutable)/Article-Written-Source/<captured files>
... (one per GL-008 category)
```

Bucketed by [[GL-008-source-classification-registry]]'s six governed categories instead of by
capture date.

**Why not recommended:** GL-008 is explicitly scoped as *filing guidance*, not a folder taxonomy
— its own "What this is explicitly NOT" section states it "does not create a new entity type and
does not add any new frontmatter field," and its category list is deliberately growth-gated
(two independent recurring misfits before a new category is even considered). Using it as a
folder-naming axis would quietly turn a governed *vocabulary* into a *structural dependency*: any
future GL-008 category rename or retirement (already anticipated in GL-008's own version-history
discipline) would now also require a coordinated folder rename across every raw source ever
filed — the exact fragility GL-002's own schema-extension doctrine warns against for frontmatter
fields, now baked into a folder name instead. It also loses the natural
"most-recent-capture-first" browsing order every other capture-event folder in the scaffold
already has, for no functional gain the `INDEX.md` register (Option A) doesn't already provide as
a queryable column.

## Recommendation

**Option A** — a single PKM-wide, date-nested `PKM/Sources (Immutable)/YYYY/MM/` root with a
GL-006-style `INDEX.md` register. This is a recommendation, not a unilateral decision — the user
signs off on a direction (A, B, C, or a fourth shape none of these anticipated) before anyone
builds anything.

## The explicit constraint TubeAIR's design must satisfy, once this is decided

Whichever option the user approves, TubeAIR's eventual design (still entirely unbuilt — no work
starts on it from this task) must satisfy this hard requirement, stated by the user directly:
**TubeAIR writes the raw transcript, plus every available piece of source metadata (video title,
channel, URL if known, capture timestamp), into the canonical location decided here — before
handing off to Cairn/SOP-015 for processing.** Once that lands, SOP-015 Step 9's provenance
write-up changes from "citation only, thinner than a preserved raw copy" (today's honest but weak
answer) to "wikilink to the stored raw copy plus its `INDEX.md` row" (a verifiable answer). This
is the one piece of this proposal that is not optional or up for a design trade — it is the
reason the gap needed resolving now rather than whenever TubeAIR eventually gets built.

## Open questions (not decided by this pass)

- **Does this feed the SQLite mirror?** Same deferred posture GL-006 already carries for
  `Client Delivery/` — [[SOP-002-convert-mypka-to-sqlite]] is scoped to `PKM/`'s eight entity
  folders today; whether a `Sources (Immutable)/` table should be added is a follow-up decision,
  not defaulted into SOP-002 by this task.
- **Should WS-002 bulk imports also retain a raw copy through this same mechanism?** Left open —
  WS-002's scope (one-time whole-export migration) is different enough from Cairn's ongoing
  ad hoc intake that forcing the same mechanism onto both without checking real usage first would
  be scope creep, not a resolved question.
- **Who owns the ongoing "Knowledge Intake and Synthesis" capability this raw-source store feeds
  into (Cairn as-is, a widened role, or something else)?** Explicitly out of scope here — that is
  [[tsk-2026-07-10-003-categorisair-equivalent-design-proposal]]'s own open decision, not
  reopened or pre-empted by this task.

## Context one click away

- Procedure (the gap surfaced here): [[SOP-015-cairn-process-external-source]],
  [[SOP-016-cairn-process-youtube-transcript]]
- Precedent pattern being adapted (not copied): [[SOP-010-warden-extract-source-to-evidence-pack]]
- Guidelines: [[GL-001-file-naming-conventions]], [[GL-002-frontmatter-conventions]],
  [[GL-006-client-delivery-frontmatter-conventions]], [[GL-008-source-classification-registry]]
- Governing loop: [[WS-004-team-retro-and-self-improvement-loop]]
- My Life context (the pilot's real destination note): [[ai-tooling]]
- Parent task: [[tsk-2026-07-10-003-categorisair-equivalent-design-proposal]]
- Birthed in: [[2026-07-11-04-30_cairn_hermes-transcript-pilot]],
  [[2026-07-10-23-50_cairn_sop-016-transcript-chunk-mapping]]

## Success criteria

- The user reviews the gap, the three design options, and the recommendation, and either
  approves a direction (A, B, C, or a fourth option none of these anticipated) or asks for more
  exploration before deciding.
- Once a direction is approved, a follow-up implementation task is created (new folder, `INDEX.md`
  register, SOP-015 Step 9 rewrite, and — separately, only once TubeAIR is actually scoped for a
  build — TubeAIR's own design inheriting the preserve-before-handoff constraint stated above).
  This task itself closes as "direction decided" without doing any of that build.

## Updates
- 2026-07-10 23:10 (silas) — created, per Larry's routing of the gap Cairn's SOP-015 pilot and
  SOP-016 both surfaced on real work. Cross-refs: 6/7 populated (sops, workstreams, guidelines,
  my_life, session_logs, journal_entries genuinely empty — no specialist has a journal entry yet;
  deliverables genuinely empty — the proposal lives entirely in this task body).

## Outcome
_(filled when status flips to done — see SOP-close-task)_
