# Guidelines - Index

**Guidelines are general rules every agent reads on every relevant action.** Where SOPs are skills (procedures the agent runs) and Workstreams are compositions (multi-agent choreography), Guidelines are the static rules and constraints that hold the whole system together. Naming, frontmatter, design system. SOPs and Workstreams `[[wikilink]]` to Guidelines rather than duplicating the rules.

Filename pattern: `GL-NNN-<title>.md`.

## Active Guidelines

| GL | Title | Description |
|---|---|---|
| GL-001 | [[GL-001-file-naming-conventions]] | Kebab-case rules, ISO date prefix on date-driven files, slug rules, image filename pattern. |
| GL-002 | [[GL-002-frontmatter-conventions]] | YAML frontmatter field schemas for all 8 entity types, typing rules, foreign-key convention. Aligns with [[SOP-002-convert-mypka-to-sqlite]]. |
| GL-003 | [[GL-003-design-system]] | Design-system / visual-identity SSOT — color, type, spacing, voice tokens that Iris authors and Charta/Pixel/Vera read from. *(Designer Pack — preinstalled in v3.0.0)* |
| GL-004 | [[GL-004-task-resource-linking]] | One-way Task → Resource linking rule, seven-array task frontmatter contract, `linked_deliverables` slug format, archive-on-close cascade. Read by [[SOP-create-task]], [[SOP-claim-task]], [[SOP-close-task]]. |
| GL-005 | [[GL-005-llm-agnostic-portable-core]] | The portable-core boundary: harness-agnostic core (`PKM/`, `Team Knowledge/`, the body of every `Team/*/AGENTS.md`) vs the per-harness adapter layer (`.claude/`, future `.codex/`, `.cursor/`). No harness names, host tool names, slash-command-only triggers, or hardcoded models in the core. Enforced by the `agnosticism-audit` in `validation-script.sh`. |
| GL-006 | [[GL-006-client-delivery-frontmatter-conventions]] | YAML frontmatter field schemas for `Client Delivery/`'s entity types (Engagement, Work Package, Register Item) — Warden's business/client-delivery root, structurally separate from `PKM/`. Sibling to GL-002, inherits its mechanical rules (§§2-4) rather than duplicating them. Not (yet) part of the SQLite mirror in [[SOP-002-convert-mypka-to-sqlite]]. |
| GL-007 | [[GL-007-human-facing-writing-conventions]] | Anti-AI-tell discipline for human-facing external prose (cover letters, client comms, reports) — current cited 2026 research on what reads as AI-written, a five-point self-check, and the hard rule that this Guideline must be wikilinked and re-read at the point of drafting, not just written once. Does not govern internal session-log/task register, which has its own existing no-em-dash convention. |
| GL-008 | [[GL-008-source-classification-registry]] | The small, governed vocabulary of source-type categories (Article/Written Source, Document/Report, Video/Audio Transcript, Course/Lesson Note, Chat/Conversation Excerpt, Email/Correspondence) Cairn classifies already-acquired external material against, mapped to GL-002's eight entity types. Silas-owned/stewarded, Cairn-consumed; creates no new entity type or frontmatter field. |

*Reserved:* none. Next free Guideline slot is GL-009.

## When to write a new Guideline

- The rule is static and applies across many files or procedures.
- More than one SOP or Workstream needs to know about it.
- Without it, you would copy-paste the same rule into multiple files.

If you find yourself restating the same rule in two files, stop and write a Guideline. Then `[[wikilink]]` to it from both files.
