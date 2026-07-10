# Client Delivery - Master Hub

This is the business/client-delivery side of the team's work — structurally separate from [[PKM/INDEX]] by design. Personal projects stay in `PKM/My Life/Projects/` with the user and Penn. Anything that governs a client engagement or business initiative (scope, work packages, risk/issue/change/decision register, handover) lives here instead, owned by **Warden**. See [[Team/Warden - Delivery Manager/AGENTS]].

## Status

**Stub.** This root and this INDEX exist so the structure has a home. No engagement has been scoped yet, so the nested taxonomy below is not built out. It gets created per-engagement, the first time Warden takes on a real client project.

## Intended structure (per engagement)

Each engagement gets its own subfolder under `Client Delivery/<engagement-slug>/`, shaped like this:

- **Project Control** — the Project PRD and Implementation Plan for the engagement. Intent and boundaries, not a task list.
- **Sources (Immutable)** — raw inputs (transcripts, client documents, emails) as captured. Never edited after capture; processed artifacts elsewhere cite back to these with source/date/confidence.
- **Work Packages** — the Work Package Catalogue. Each work package is independently referenceable, with a named owner and a defined done-state.
- **Risk-Issue-Change-Decision Register** — one combined, reviewed register for the engagement. Dated reconciliation entries whenever new source material lands. This is the source of truth for engagement state — never a dashboard or board view.
- **Reporting-QA-Comms** — status reporting and the Write-and-Verification Log for every outbound client artifact (what was sent, when, to whom, confirmed landed).
- **Handover-Closure** — the Support Handover document at engagement close. A structured schema, not a farewell message.

## Schema status (read before writing real engagement data)

`Client Delivery/` entities (engagements, work packages, register items) are not yet part of [[GL-002-frontmatter-conventions]]'s eight tracked entity types. Before real engagement data is written with frontmatter, this needs a schema pass with **Silas** (new entity type per GL-002 §"How to extend this Guideline") — see Warden's contract §Schema note. Until then, Warden works in plain structured markdown rather than inventing ad-hoc YAML keys.

## SSOT applies here too

If a fact about an engagement shows up in two places, the register or the PRD is the source of truth; everything else `[[wikilink]]`s to it. No duplication.

## Cross-references

- [[Team/Warden - Delivery Manager/AGENTS]] — the specialist who owns this root.
- [[GL-001-file-naming-conventions]] — slug, date, filename rules.
- [[GL-002-frontmatter-conventions]] — entity frontmatter schema; extension pending for this root's entity types.
- [[PKM/INDEX]] — the user's personal knowledge, kept structurally separate from this root.
