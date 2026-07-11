# Warwick Knowledge Value Profile - architecture proposal

## Status

Proposed for Warwick review. Do not implement schema or workflow changes from this document until Warwick approves the shape.

## Decision

Create one shared component: **Warwick Knowledge Value Profile**.

- **Canonical public mechanism:** this proposal, Task 008, and the SOP/contract changes listed below.
- **Canonical private/local evidence:** `PKM/My Life/Current Context/warwick-knowledge-value-profile.md`, excluded from public Git while [[GL-009-public-private-knowledge-boundary]] applies.
- **Human-facing view:** `PKM/My Life/Current Context/about-warwick.md`, generated or refreshed from the profile and live context, also excluded from public Git.
- **Owner/steward:** Silas owns structure and schema integrity.
- **Content contributors:** Penn contributes journal-derived signals, Cairn contributes source-intent outcomes, Larry curates session-level decisions, Warwick approves stable facts.
- **Consumers:** Cairn, Penn, Pax, Larry, future intake adapters, task routing, retrieval, and any later dashboard.

The profile is not a new public fact dump about Warwick. It is a private/local operating layer that tells the team how to judge relevance, timing, and usefulness.

## Component shape

The profile has four sections. They must remain visibly separate.

### 1. Confirmed stable facts

Warwick-approved, durable facts that can influence agent behavior across sessions.

Examples of field families:

- stable interests
- active ambitions
- preferred working style
- recurring constraints
- exclusions or things not to infer
- commercial themes

Only Warwick can promote a fact into this section. Agents may propose candidates but cannot silently add them as stable.

### 2. Active structured context

Derived from existing canonical files, not copied from them:

- active Goals
- active Projects
- active Habits
- active Topics
- open tasks
- recent decisions

This section stores references and a short synthesized readout. The source facts stay in their original notes.

### 3. Recent journal-derived signals

Time-bounded observations drawn from recent Journal entries.

Rules:

- each signal must cite its source journal entry
- default expiry is 14 days unless Warwick confirms it as stable
- each signal is labelled `observed`, `inferred`, or `awaiting_confirmation`
- agents may use `observed` signals for lightweight context, but may not treat `inferred` signals as fact

### 4. AI inferences awaiting confirmation

Candidate patterns the team thinks may matter.

Rules:

- never used as canonical truth
- always linked to evidence
- either expires, is rejected, or is promoted by Warwick
- appears in the human-facing view so Warwick can correct it

## About Warwick / Current Context view

The human-facing view should be short and inspectable. Proposed headings:

- **Stable**
- **Active Now**
- **Recent Signals**
- **Needs Confirmation**
- **Useful Retrieval Hooks**

It should answer: "What should the team know about Warwick right now before deciding whether this source, task, or idea matters?"

It should not duplicate full journal entries, project details, or topic notes. It should link to them.

## Intake valuation model

SOP-015 should evaluate every external source through three inputs:

1. **Intake intent:** why Warwick added it and what he suspects it may affect.
2. **Knowledge Value Profile:** stable interests, active context, and recent signals.
3. **Source assessment:** novelty, contradiction, evidence quality, actionability, and cost to process.

The output is exactly one disposition:

| Disposition | Meaning |
|---|---|
| Promote | Add durable living knowledge to the correct canonical note. |
| Enrich | Update an existing note with evidence-labelled material. |
| Experiment | Create or update a task to test, build, or learn something. |
| Verify | Hand off a claim to Pax or another owner before treating it as knowledge. |
| Surface for Warwick | Ask Warwick because the implication is ambiguous, high-impact, or preference-sensitive. |
| Retain source only | Preserve provenance/raw material where policy allows, but promote no living knowledge. |
| Discard where policy permits | No retained value, no required preservation, and no policy reason to keep it. |

No promotion is a normal successful outcome. A 45-minute transcript can produce zero living notes if it does not pass relevance, novelty, or usefulness gates.

## Novelty and contradiction

Do not equate repetition with truth.

- **Already known:** the source repeats material already present in canonical notes without adding better evidence, clearer language, stronger actionability, or a new connection.
- **Novel:** the source adds a new concept, method, decision criterion, example, tool, risk, or useful framing that changes future behavior.
- **Contradiction:** the source conflicts with a canonical note, a current assumption, or another source. Contradictions trigger `Verify` or `Surface for Warwick`, not silent overwrite.
- **Source quality:** record whether the claim is directly present, marketing/assertion, anecdotal, independently supported, or needs Pax verification.

## Staged processing

Use the cheapest useful pass first.

### Stage 0 - Capture

Save enough metadata or raw material so the source is not lost. No semantic processing yet if intake intent is missing.

### Stage 1 - Intent and cheap relevance

Ask the SOP-015 intake question. Check the profile and active context. Decide whether deeper reading is justified.

### Stage 2 - Structured read

Read the whole source once. For long transcripts, run SOP-016 chunk mapping.

### Stage 3 - Valuation

Compare source claims against the profile, active context, existing notes, and task register. Assign one disposition.

### Stage 4 - Promotion or no-promotion closeout

Write to the destination note, task, or session log. If no living knowledge is promoted, record why.

## Retrieval requirements

Promoted knowledge must be reachable later, not merely filed.

Retrieval hooks:

- destination note backlinks
- task frontmatter arrays
- profile references to active Topics, Goals, and Projects
- session-log links for decisions and provenance
- explicit `Useful Retrieval Hooks` in the human-facing view

Acceptance test: after a source is promoted, a later relevant task should find it by reading the profile plus the linked Topic/Project/Goal, without searching the entire vault.

## Acceptance tests

1. **Valuable source**
   A source matches Warwick's intake intent and active context, adds a reusable pattern, and enriches a Topic.
   Expected: `Enrich` or `Promote`.

2. **Current-project-only source**
   A source is useful only because of an active Project.
   Expected: `Experiment`, `Enrich` the Project, or `Retain source only` after the Project closes.

3. **Duplicate idea**
   A source repeats an existing idea without stronger evidence or actionability.
   Expected: `Retain source only` or `Discard where policy permits`.

4. **Contradiction**
   A source conflicts with an existing note or active assumption.
   Expected: `Verify` or `Surface for Warwick`.

5. **Commercially ambiguous source**
   A source might imply a consultancy/product opportunity but the value is unclear.
   Expected: `Surface for Warwick` or create an Experiment task.

6. **Long transcript with no living knowledge**
   A 45-minute transcript is complete and chunk-mapped, but adds no durable or current value.
   Expected: no note promotion; session log records the no-promotion disposition.

7. **Retrieval proof**
   A later task relevant to the same Topic receives the promoted note via profile/context links.
   Expected: the note is discovered without broad manual search.

## Required changes after approval

### GL-010 or GL-002

Recommended: create **GL-010 - Warwick Knowledge Value Profile** instead of extending GL-002 immediately. Reason: the profile is a private/local operating component, not one of the eight PKM entity schemas yet. GL-010 can define the structure without forcing SQLite/frontmatter migration work before the shape is proven.

If later promoted into formal PKM schema, Silas can extend GL-002 and the templates.

### SOP-015

Add a valuation step after source read and before filing:

- load the Knowledge Value Profile
- check active structured context
- assign one of the seven dispositions
- require a no-promotion reason when nothing is filed

### SOP-016

Clarify that chunk maps feed valuation as well as classification:

- chunk maps should flag possible profile/context relevance
- no chunk map implies a note must be created
- long transcript processing can close with `Retain source only` or `Discard where policy permits`

### WS-001

Add an optional post-journal extraction step:

- Penn may propose recent signals for the Knowledge Value Profile
- signals are time-bounded and evidence-linked
- Warwick approval is required before any signal becomes stable

### Penn contract

Add boundary language:

- Penn captures journal entries as primary narrative
- Penn may propose current-context signals
- Penn does not silently rewrite the profile

### Cairn contract

Add consumption rule:

- Cairn consumes the profile during valuation
- Cairn does not own or define Warwick
- Cairn records when profile context affected a disposition

### Larry contract

Add orchestration rule:

- Larry keeps the profile/current-context view on the route map
- at session close, Larry may flag profile candidates, but approval remains explicit

## Open approval questions

1. Is the human-facing name **About Warwick / Current Context** acceptable, or should it be one of those only?
2. Should recent journal signals expire after 14 days by default?
3. Should the first implementation live under `PKM/My Life/Current Context/` as proposed?
4. Should GL-010 be created before editing SOP-015/SOP-016/WS-001?
