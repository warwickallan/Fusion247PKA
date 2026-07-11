---
agent_id: larry
session_id: knowledge-value-profile
timestamp: 2026-07-10T23:45:16Z
type: realignment
linked_sops:
  - SOP-015-cairn-process-external-source
  - SOP-016-cairn-process-youtube-transcript
linked_workstreams:
  - WS-001-daily-journaling
linked_guidelines:
  - GL-002-frontmatter-conventions
  - GL-008-source-classification-registry
  - GL-009-public-private-knowledge-boundary
---

# Knowledge value must be judged through Warwick's purpose and current context

## Context

Warwick asked the team to stop treating transcript processing as a content-only exercise. He wants the team to ask why he added a transcript before processing it, and asked whether the PKA can maintain a central picture of his current interests, aims, goals, and lived day-to-day context from journals.

## What we did

- Cairn's intake procedure was amended so raw capture may happen immediately, but semantic processing waits for an explicit intake-intent answer.
- Larry separated raw-source retention from the shared knowledge-valuation capability and created a dedicated architecture task.
- Silas's raw-source-retention proposal was made dependent on the valuation design before it can close.

## Decisions made

- **Question:** What is the first relevance signal for an external source?
  **Decision:** Warwick's stated reason for adding it. The team asks before reading, extracting, or promoting unless the purpose was already explicit.
- **Question:** Is a central picture of Warwick the responsibility of Cairn?
  **Decision:** No final ownership decision yet. The working direction is a shared canonical profile consumed by Cairn, Penn, Pax, and future intake channels, with Warwick-controlled stable facts and clearly labelled journal-derived current signals.

## Insights

- Raw source capture, knowledge valuation, and knowledge promotion are separate concerns. Preserving a transcript does not imply it should create living knowledge.
- The existing My Life model contains useful components, but it does not yet provide a single trustworthy current-context view. Most current example notes are seeded course samples and must not be mistaken for confirmed facts about Warwick.
- Journal-derived context can influence relevance, but it must be time-bounded, provenance-linked, and distinguish observation from inference.

## Realignments

- Warwick's correction: the Brain must ask why he added a transcript and evaluate it against a living picture of what matters to him now, rather than assuming extraction, categorisation, or linking proves value.

## Open threads

- [ ] Design the shared Warwick Knowledge Value Profile and its refresh, confirmation, retrieval, and provenance rules.
- [ ] Decide whether the canonical human-facing view is called "About me", "Current context", or another name.
- [ ] Complete Task 007 only after the valuation design proves raw retention and promotion remain separate.

## Next steps

- Silas leads the architecture proposal with Penn and Cairn input.
- Warwick answers the first real intake-intent question for the transcript that prompted this change.

## Cross-links

- [[tsk-2026-07-10-007-raw-source-retention-design-proposal]]
- [[SOP-015-cairn-process-external-source]]
- [[WS-001-daily-journaling]]

## Public/private boundary update

Warwick confirmed that the repository may remain public during testing, but personal current-context material should be maintained without being published by default. Larry added [[GL-009-public-private-knowledge-boundary]] and `.gitignore` entries for the local/private PKM surfaces. The public record keeps the architecture decision; detailed personal evidence remains in local/private context unless Warwick explicitly approves exact publication.
