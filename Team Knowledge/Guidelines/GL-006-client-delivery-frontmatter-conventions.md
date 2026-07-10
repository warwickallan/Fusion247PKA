# GL-006 - Client Delivery Frontmatter Conventions

> **This Guideline is a general rule every agent reads on every relevant action.** Every entity note Warden writes under `Client Delivery/` reads this file. SOPs and Workstreams `[[wikilink]]` here rather than restating the schema.

This is the source of truth for the YAML frontmatter that sits at the top of every entity note under **`Client Delivery/`** — the business/client-delivery root owned by Warden, structurally separate from `PKM/`. Every other file that needs to talk about `Client Delivery/` field names `[[wikilink]]`s here.

## Why this Guideline exists, and why it is not part of GL-002

[[GL-002-frontmatter-conventions]] is the schema for the eight entity types that live under `PKM/` — the user's personal knowledge. Its own "How to extend this Guideline" section ties adding a new entity type to "a new folder under `PKM/`." `Client Delivery/` is deliberately **not** under `PKM/` — it is a separate root, on what will eventually be a separate dashboard, holding business/client-delivery governance data that the user wants structurally apart from personal-life PKM.

Rather than stretch GL-002's stated scope to cover a domain it was never written for, `Client Delivery/` gets its own sibling Guideline. This keeps the separation the user asked for legible in the schema layer too: PKM entities and their SQLite mirror ([[SOP-002-convert-mypka-to-sqlite]]) stay exactly as they are; `Client Delivery/` entities get their own home here, free to grow (a Write-and-Verification Log entity, a Handover entity, and eventually its own derived-data mirror) without touching GL-002 or SOP-002 at all.

**This Guideline does not duplicate GL-002's mechanics.** The mechanical rules — kebab-case/snake_case field names, ISO date typing, list typing, and the foreign-key-stores-the-slug convention — are defined once in [[GL-002-frontmatter-conventions]] §§2-4 and apply here unchanged. Read those four rules there. This file only defines: which entity types exist under `Client Delivery/`, their fields, and the naming pattern specific to this domain (compound slugs — see below).

## Core rules specific to this domain

### 1. Mechanical rules inherited from GL-002

Field names are `snake_case`. Dates are ISO `YYYY-MM-DD`. Lists are YAML arrays. Foreign-key fields store the **slug** of the target file, never its title. See [[GL-002-frontmatter-conventions]] §§2-4 for the full statement of each rule — not restated here.

### 2. Slugs are engagement-prefixed to stay globally unique

Unlike the eight PKM entity types (each living flat in one folder, e.g. all People in `PKM/CRM/People/`), `Client Delivery/` entities nest per engagement. To keep foreign-key-by-slug resolvable across the whole root (per GL-002 rule 4, and per [[GL-001-file-naming-conventions]] rule 8's collision-handling doctrine), every Work Package and Register Item slug is prefixed with its parent Engagement's slug:

- Engagement slug: `<client-slug>-<short-project-slug>`, e.g. `bellrock-npl-implementation`.
- Work Package slug: `<engagement-slug>-wp-<NNN>-<short-slug>`, e.g. `bellrock-npl-implementation-wp-001-mobilisation`.
- Register Item slug: `<engagement-slug>-reg-<NNN>`, e.g. `bellrock-npl-implementation-reg-014`.

`NNN` is zero-padded to three digits, sequential within its parent engagement, never reused (same non-reuse doctrine as [[GL-001-file-naming-conventions]] rule 6). Work Packages and Register Items number independently of each other.

### 3. One entity type per file, same as PKM

An Engagement note is the Project PRD. A Work Package note is one unit of authorized scope. A Register Item note is one risk, issue, change, or decision. Never combine two engagements, two work packages, or two register entries into one file. The "combined register" in Warden's contract means **risk, issue, change, and decision share one entity type** (via the `kind` field, see below) and one reviewed folder per engagement — not that entries share one file. Each item gets its own file so it is independently linkable, frontmatter-queryable, and safe to update without clobbering its siblings.

## Folder map

```
Client Delivery/
└── <engagement-slug>/
    ├── Project Control/
    │   └── <engagement-slug>.md                          -> Engagement entity (the Project PRD)
    │   └── <engagement-slug>-implementation-plan.md       -> plain markdown, no frontmatter (see note below)
    ├── Sources (Immutable)/                                -> raw captures, no frontmatter, never edited post-capture
    ├── Work Packages/
    │   ├── <engagement-slug>-work-package-catalogue.md    -> plain markdown rollup, no frontmatter (see note below)
    │   └── <engagement-slug>-wp-<NNN>-<slug>.md           -> Work Package entity, one per file
    ├── Risk-Issue-Change-Decision Register/
    │   └── <engagement-slug>-reg-<NNN>.md                 -> Register Item entity, one per file
    ├── Reporting-QA-Comms/                                 -> Write-and-Verification Log; schema not yet defined (see below)
    └── Handover-Closure/                                   -> Support Handover; schema not yet defined (see below)
```

**Implementation Plan and Work Package Catalogue stay plain structured markdown, no frontmatter, for now.** Both are narrative/rollup documents (a sequenced approach; a table of links to Work Packages) rather than individually-referenceable entities — nothing else needs to foreign-key *into* them. If that changes (e.g. the user wants to query implementation-plan phases structurally), route back to Silas to add a schema here, same as any other extension.

**Write-and-Verification Log and Support Handover are out of scope for this pass.** The task that produced this Guideline covered engagement, work package, and register item only. When Warden's work produces real Write-and-Verification Log entries or a real Handover document, that is a follow-up schema request to Silas — do not invent fields for them in the meantime; keep writing plain markdown per Warden's contract until they land here.

## Entity schemas

### Engagement - `Client Delivery/<engagement-slug>/Project Control/<engagement-slug>.md`

The Engagement note **is** the Project PRD: intent and boundaries, not a task list, per Warden's Method step 1.

```yaml
---
name: Bellrock NPL Implementation          # required
engagement_id: BRK-NPL-001                 # optional, client/business-facing code (free text, not a slug)
client_org: bellrock-npl                   # optional, slug of an Organization in PKM/CRM/Organizations
client_contacts:                           # optional, slugs of People in PKM/CRM/People
  - jane-doe
status: active                             # scoping | active | paused | closing | closed | archived
engagement_type: fixed-price               # fixed-price | time-and-materials | retainer | internal | other
start_date: 2026-02-01
target_end_date: 2026-08-31
actual_end_date:
owner: warwick-allan                       # optional, slug of Person - internal accountable owner
tags:
  - cafm-rollout
---
```

Notes:
- `name` is the only required field, consistent with GL-002 rule 5's "require only what makes the note identifiable."
- `client_org` and `client_contacts` are the one deliberate bridge back into `PKM/CRM/`: the client's organization and the people involved are still part of the user's contact graph, even though the engagement itself is governed outside `PKM/`. They store slugs per GL-002 rule 4, resolving into `PKM/CRM/Organizations/` and `PKM/CRM/People/` respectively.
- `status` values follow a PRINCE2-flavoured engagement lifecycle, distinct from the Project `status` enum in GL-002 (which is personal-project-shaped).
- `owner` is the internal person accountable for the engagement (an account/delivery lead) — a slug of a Person, not a title string.
- Body section conventions: `## Problem & intent`, `## Who this is for`, `## Definition of done`, `## Out of scope`, `## Stakeholders`, `## Status update`.

### Work Package - `Client Delivery/<engagement-slug>/Work Packages/<engagement-slug>-wp-<NNN>-<slug>.md`

A Work Package is an authorization unit, not a to-do item, per Warden's core philosophy #1: it has a named owner and a defined done-state before it starts.

```yaml
---
name: Mobilisation                         # required
engagement: bellrock-npl-implementation    # required - slug of the parent Engagement (the anchor rule)
wp_number: WP-001                          # optional, human-facing sequence label within the engagement
owner:                                     # optional, slug of Person accountable for this work package
status: not-started                        # not-started | in-progress | blocked | done | cancelled
done_state: Mobilisation plan approved and kickoff held with client sponsor
target_date: 2026-02-15
actual_completion_date:
linked_register_items:                     # optional, slugs of Register Items affecting this work package
  - bellrock-npl-implementation-reg-003
tags:
  - mobilisation
---
```

Notes:
- **`engagement` is REQUIRED, mirroring the Goal `key_element` anchor rule in GL-002.** A Work Package with no Engagement is scope with no home — it must always name the engagement it belongs to. This is the one place this Guideline departs from "require only the name," for the same reason GL-002 does.
- `status` includes `blocked` as a value on the enum, never a separate folder or file — same "blocked-state as metadata, not a folder" doctrine the team already follows elsewhere. Do not create a "Blocked Work Packages" folder.
- `done_state` is a short plain-text description of what "authorized as complete" looks like for this work package — the acceptance criterion Warden's philosophy requires before work starts. Free text, not an enum; it is describing a specific outcome, not a category.
- `linked_register_items` stores slugs per GL-002 rule 4, pointing into the same engagement's Register.
- Body section conventions: `## Scope of this work package`, `## Acceptance / done-state`, `## Dependencies`, `## Status update`.

### Register Item - `Client Delivery/<engagement-slug>/Risk-Issue-Change-Decision Register/<engagement-slug>-reg-<NNN>.md`

One entity type covers all four registers, distinguished by `kind`. **Decision: one type with a `kind` field, not four separate entity types.** Risk, issue, change, and decision share the same lifecycle shape (raised, owned, tracked to a resolution, reconciled against new source material) and Warden's own contract already calls them "a single combined register." Four entity types would mean four near-identical schemas and four templates for a distinction that a single enum field captures cleanly; the "combined register" language becomes literal (one folder, one schema, filterable by kind) rather than aspirational.

```yaml
---
kind: risk                                 # required - risk | issue | change | decision
title: Client sponsor unavailable for UAT sign-off   # required
engagement: bellrock-npl-implementation    # required - slug of the parent Engagement
status: open                               # open | monitoring | in-review | accepted | rejected | resolved | closed
severity: medium                           # low | medium | high | critical - risk/issue only, leave blank for change/decision
raised_date: 2026-03-10
raised_by: jane-doe                        # optional, slug of Person
owner:                                     # optional, slug of Person accountable for resolution
target_resolution_date:
resolved_date:
linked_work_packages:                      # optional, slugs of Work Packages this affects
  - bellrock-npl-implementation-wp-001-mobilisation
source_ref:                                # optional, wikilink or path to the immutable source this was extracted from
tags:
  - uat
---
```

Notes:
- `kind` and `title` and `engagement` are all required — `kind` and `engagement` because a register item is meaningless without knowing which register-flavour it is and which engagement it belongs to (same anchor-rule reasoning as Work Package); `title` because that's the field that names the thing per GL-002 rule 5's general principle.
- `status` is intentionally a superset spanning all four kinds. A given kind will only use the values that make sense for it in practice (a `decision` typically moves `open -> accepted` or `open -> rejected`; a `risk` typically moves `open -> monitoring -> closed`) — the schema does not enforce a per-kind subset, Warden does by convention.
- `severity` applies to `risk` and `issue`; leave blank for `change` and `decision` where it doesn't map cleanly.
- `source_ref` is the provenance pointer — per Warden's "provenance discipline" philosophy, when a register item is extracted from a raw source (a transcript, a client email) captured under `Sources (Immutable)/`, `source_ref` links back to it. Never edit the source; reconcile the register item's own fields and body instead.
- **The "dated reconciliation entries" Warden's contract requires live in the body, under `## Reconciliation log`, not as separate files.** Each time new source material touches this item, append a dated line (`- 2026-04-02 — new transcript reviewed, downgraded severity to low`) rather than overwriting prior state. This is how "one register, reviewed, not written-once" (Warden's core philosophy #2) is realized structurally: the register *is* the folder of these items, and each item's own reconciliation log is its review history.
- `linked_work_packages` stores slugs per GL-002 rule 4.
- Body section conventions: `## Description`, `## Impact`, `## Reconciliation log`, `## Resolution`.

## How to extend this Guideline

Same two paths as [[GL-002-frontmatter-conventions]] §"How to extend this Guideline":

1. **Add a new optional field to Engagement, Work Package, or Register Item.** Edit the schema above, add the field with its typing rule, commit.
2. **Add a new entity type scoped to `Client Delivery/`** (e.g. Write-and-Verification Log entry, Support Handover). Add the schema here, add a template to [[Templates/INDEX]], and decide separately whether it should feed a SQLite mirror (see the SOP-002 flag below) — do not assume it does.

Both paths: pick one field name, document it here, never invent ad-hoc keys in a Warden-authored note. If GL-002's own mechanical rules (§§2-4) ever change, this Guideline inherits the change automatically via the wikilink — do not copy the rule text here.

## Does this feed the SQLite mirror?

**Not yet, and this is a real open decision, not a technicality.** [[SOP-002-convert-mypka-to-sqlite]] is scoped entirely to `PKM/` — its folder map, table list, and validation queries all assume the PKM root. `Client Delivery/` entities are not in SOP-002's table list and this Guideline does not add them there.

Whether `Client Delivery/` should ever feed the same SQLite file, a separate one, or stay markdown-only depends on how the "possibly-separate dashboard" the user mentioned actually gets built — a decision for the user, informed by whoever builds that dashboard, not something to default into SOP-002 as a drive-by edit. Flagged for a follow-up pass; SOP-002 is intentionally untouched by this change.

## Cross-references

- [[GL-002-frontmatter-conventions]] - the mechanical rules this Guideline inherits (§§2-4) and the PKM entity schemas this Guideline sits alongside without modifying.
- [[GL-001-file-naming-conventions]] - slug rules, ISO date format, collision handling (the basis for this Guideline's engagement-prefixed compound slugs).
- [[Templates/INDEX]] - copy-and-edit starter templates for Engagement, Work Package, and Register Item.
- `Team/Warden - Delivery Manager/AGENTS.md` - the specialist who writes through these schemas.
- `Client Delivery/INDEX.md` - the hub for the root this Guideline governs.

## Updates to this Guideline

If the rules change, update this file. Do not duplicate the change into Warden's contract or into `Client Delivery/INDEX.md` — they `[[wikilink]]` here and inherit the change automatically.

### Version history

- **v1.0** - Initial schema pass. Defined Engagement, Work Package, and Register Item (combined risk/issue/change/decision via a `kind` field). Created as a sibling Guideline to GL-002 rather than an extension of it, because `Client Delivery/` is a structurally separate root from `PKM/` by explicit user design. Write-and-Verification Log and Support Handover explicitly deferred - not yet schema'd. SQLite mirror question explicitly deferred to a future decision, not defaulted into SOP-002.
