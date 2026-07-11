# GL-010 - Warwick Knowledge Value Profile

## Purpose

The Warwick Knowledge Value Profile is the shared private/local operating layer that helps the team judge whether a source, idea, task, or journal signal matters to Warwick now.

It is not a public biography and not a new PKM entity type. It is a context component governed by [[GL-009-public-private-knowledge-boundary]].

## Canonical files

- Private/local profile: `PKM/My Life/Current Context/warwick-knowledge-value-profile.md`
- Private/local human-facing view: `PKM/My Life/Current Context/about-warwick.md`
- Public architecture record: [[2026-07-11-warwick-knowledge-value-profile-proposal]]

The private/local files are excluded from public Git while the repository remains public. Public Team Knowledge files may describe the mechanism, but personal evidence stays local/private unless Warwick explicitly approves exact publication.

## Stewardship

- **Owner/steward:** Silas owns structure and schema integrity.
- **Contributors:** Penn proposes journal-derived signals, Cairn records intake outcomes, Larry records session-level decisions, Pax may add verified research implications when routed.
- **Approver:** Warwick is the only authority who can promote an inference or short-term signal into confirmed stable profile knowledge.
- **Consumers:** Cairn, Penn, Pax, Larry, future intake adapters, task routing, retrieval, and dashboards.

## Profile sections

The profile must keep these four layers separate.

### 1. Confirmed stable facts

Warwick-approved durable context. This may include stable interests, working preferences, ambitions, constraints, exclusions, commercial themes, and long-term aims.

Agents may propose additions. They may not silently promote them.

### 2. Active structured context

References to existing canonical files:

- active Goals
- active Projects
- active Habits
- active Topics
- open tasks
- recent decisions

This section stores links and a short synthesis only. The source facts stay in their original notes.

### 3. Recent signals

Short-term context derived from recent journals, intake answers, and session decisions.

Rules:

- default expiry is 14 days
- each signal links to its source
- each signal is labelled `observed`, `inferred`, or `awaiting_confirmation`
- inferred signals cannot be treated as fact

### 4. Longer-term candidates

Signals that recur beyond the 14-day window, or that Warwick explicitly asks the team to track, move here as candidates for stable profile knowledge.

Promotion paths:

- **Recurrence:** the same signal appears repeatedly across short-term windows.
- **Explicit ask:** Warwick asks the team to keep tracking it.
- **Approval:** Warwick confirms it as a stable aim, goal, preference, constraint, or exclusion.

Until approved, longer-term candidates are still candidates, not confirmed stable facts.

## Human-facing view

The `about-warwick.md` view should be short and inspectable. Required headings:

- `## Stable`
- `## Active Now`
- `## Recent Signals`
- `## Longer-term Candidates`
- `## Needs Confirmation`
- `## Useful Retrieval Hooks`

It should answer: "What should the team know about Warwick right now before deciding whether this source, task, or idea matters?"

It must link to canonical notes rather than duplicating full journal, project, goal, or topic content.

## Intake valuation

When SOP-015 processes an external source, Cairn evaluates it through:

1. Warwick's intake intent.
2. The Warwick Knowledge Value Profile.
3. The source's novelty, contradiction risk, evidence quality, actionability, and processing cost.

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

No promotion is a successful disposition when the source does not earn living knowledge.

## Retrieval rule

Promoted knowledge must be reachable from a later relevant task without a vault-wide search. At minimum, it should be findable through one of:

- a destination note backlink
- task frontmatter arrays
- active Topic, Project, Goal, or Habit links
- the Knowledge Value Profile
- the human-facing `Useful Retrieval Hooks` section

If a source creates knowledge but no later agent can retrieve it at the point of use, the intake failed structurally.

## Update cadence

- Recent signals are reviewed on journal capture and session close.
- Expired signals either drop, recur into longer-term candidates, or are promoted after Warwick approval.
- Stable facts change only by Warwick confirmation.
- The profile should remain compact enough for agents to read before intake, routing, and task work.
