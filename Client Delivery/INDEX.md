# Client Delivery - Master Hub

This is the business/client-delivery side of the team's work — structurally separate from [[PKM/INDEX]] by design. Personal projects stay in `PKM/My Life/Projects/` with the user and Penn. Anything that governs a client engagement or business initiative (scope, work packages, risk/issue/change/decision register, handover) lives here instead, owned by **Warden**. See [[Team/Warden - Delivery Manager/AGENTS]].

## Status

**Stub.** This root and this INDEX exist so the structure has a home. No engagement has been scoped yet, so the nested taxonomy below is not built out. It gets created per-engagement, the first time Warden takes on a real client project.

## Intended structure (per engagement)

Each engagement gets its own subfolder under `Client Delivery/<engagement-slug>/`, shaped like this:

- **Project Control** — the Project PRD and Implementation Plan for the engagement. Intent and boundaries, not a task list.
- **Sources (Immutable)** — raw inputs (transcripts, client documents, emails) as captured. Never edited after capture; processed artifacts elsewhere cite back to these with source/date/confidence.
- **Evidence Packs** — one reusable, per-source distillation (structured summary, speaker/topic index, key extracts, linked Register Items) produced by [[SOP-010-warden-extract-source-to-evidence-pack]]. Lives in its own folder, not inside Sources (Immutable) — unlike a raw capture it is documented-mutable (a reread pass appends to it), and nesting it under an "Immutable" folder was a naming hazard. See GL-006.
- **Work Packages** — the Work Package Catalogue. Each work package is independently referenceable, with a named owner and a defined done-state.
- **Risk-Issue-Change-Decision Register** — one combined, reviewed register for the engagement. Dated reconciliation entries whenever new source material lands. This is the source of truth for engagement state — never a dashboard or board view.
- **Reporting-QA-Comms** — status reporting and the Write-and-Verification Log for every outbound client artifact (what was sent, when, to whom, confirmed landed).
- **Handover-Closure** — the Support Handover document at engagement close. A structured schema, not a farewell message.

## Schema status (read before writing real engagement data)

`Client Delivery/` entities have a schema: [[GL-006-client-delivery-frontmatter-conventions]], a sibling Guideline to [[GL-002-frontmatter-conventions]] scoped to this root (GL-002 itself stays PKM-only). It defines three entity types — Engagement (the Project PRD, one file per engagement under `Project Control/`), Work Package (one file per authorized unit of scope under `Work Packages/`), and Register Item (one file per risk/issue/change/decision, distinguished by a `kind` field, under the Register folder) — each with a starter template in `Team Knowledge/Templates/`. Work Package and Register Item slugs are engagement-prefixed (`<engagement-slug>-wp-NNN-...`, `<engagement-slug>-reg-NNN`) to stay globally unique across engagements. The Write-and-Verification Log and Support Handover do not have a schema yet — keep those in plain structured markdown until a real one is needed, then flag it to Silas via Larry.

## SSOT applies here too

If a fact about an engagement shows up in two places, the register or the PRD is the source of truth; everything else `[[wikilink]]`s to it. No duplication.

## Cross-references

- [[Team/Warden - Delivery Manager/AGENTS]] — the specialist who owns this root.
- [[GL-001-file-naming-conventions]] — slug, date, filename rules.
- [[GL-002-frontmatter-conventions]] — PKM entity frontmatter schema; GL-006 inherits its mechanical rules (§§2-4).
- [[GL-006-client-delivery-frontmatter-conventions]] — the frontmatter schema for this root's own entity types (Engagement, Work Package, Register Item).
- [[PKM/INDEX]] — the user's personal knowledge, kept structurally separate from this root.
