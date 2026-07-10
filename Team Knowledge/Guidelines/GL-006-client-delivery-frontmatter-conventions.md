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

## Source-tier precedence doctrine

`Client Delivery/` mixes artifacts that were never meant to carry equal weight — a signed SOW and a Warden-generated status report both describe "the engagement," but only one of them can obligate anything. When two artifacts disagree about the same fact, this is the order that resolves it: higher tier wins, and the disagreement gets recorded, never silently overwritten.

| Tier | Category | Answers | Typical home in `Client Delivery/` |
|---|---|---|---|
| 1 | Contractual authority | What are we actually obligated to do? | Contract, SOW, schedules, approved change requests — captured under `Sources (Immutable)/` |
| 2 | Approved baseline | What did we agree to build or deliver? | Signed-off requirements or solution design — captured under `Sources (Immutable)/`, reflected in the Engagement note's `## Definition of done` / `## Out of scope` |
| 3 | Project evidence | What actually happened? | Transcripts, emails, meeting notes — captured under `Sources (Immutable)/` |
| 4 | Structured project knowledge | What did we extract and decide from that evidence? | Register Items, Work Packages, Engagement frontmatter and body |
| 5 | Generated outputs | What did we report, based on the above? | Status reports, summaries, client-facing artifacts — `Reporting-QA-Comms/` |

**Why this order, not some other:** each tier is derived from the one above it, never the reverse. A generated output (tier 5) restates structured knowledge (tier 4); structured knowledge is extracted from evidence (tier 3); evidence proves what happened against a baseline (tier 2); the baseline only has force because a contract obligates it (tier 1). Derivation only flows downward. A report can never overrule a register item. A register item can never overrule what a transcript actually shows. No volume of project evidence overrides what the contract says is owed — a disputed contractual obligation only moves via a tier-1 artifact (an approved change request), never a tier-3 or tier-4 one.

**When tiers conflict:** the higher tier (lower number) governs the fact. The lower-tier artifact is not silently edited to match it — the conflict itself is recorded. For a Register Item, that means a dated `## Reconciliation log` entry naming the discrepancy and which tier resolved it. For an Engagement note, that means a dated line in `## Status update`. Never quietly overwrite a prior structured-knowledge state to make it agree with a newer source; the discrepancy is itself information Warden's philosophy #3 ("provenance discipline") requires be kept, not erased.

**This doctrine governs `source_ref`, and is distinct from `evidence_type` / `confidence` below.** A Register Item's `source_ref` points at a piece of evidence; that evidence's tier is implied by what kind of document it is (a contract vs. a transcript, both under `Sources (Immutable)/`). Tier says which artifact wins when two disagree. `evidence_type` and `confidence` (see the Register Item schema) say how much to trust a single extraction on its own, independent of tier. A tier-3 transcript can still produce a `high`-confidence, `direct-statement` register item; a tier-1 contract clause can still be extracted with `low` confidence if the clause itself is ambiguous.

## Folder map

```
Client Delivery/
└── <engagement-slug>/
    ├── Project Control/
    │   └── <engagement-slug>.md                          -> Engagement entity (the Project PRD, business case, and benefits log all fold into this note's body)
    │   └── <engagement-slug>-implementation-plan.md       -> plain markdown, no frontmatter (see note below)
    ├── Sources (Immutable)/
    │   ├── INDEX.md                                        -> per-engagement document register (see below)
    │   └── <captured files>                                -> raw captures, no frontmatter, never edited post-capture
    ├── Evidence Packs/
    │   └── <source-slug>-evidence-pack.md                 -> Evidence Pack, one per source, plain markdown, no frontmatter (see note below)
    ├── Work Packages/
    │   ├── <engagement-slug>-work-package-catalogue.md    -> plain markdown rollup, no frontmatter (see note below)
    │   └── <engagement-slug>-wp-<NNN>-<slug>.md           -> Work Package entity, one per file
    ├── Risk-Issue-Change-Decision Register/
    │   └── <engagement-slug>-reg-<NNN>.md                 -> Register Item entity, one per file
    ├── Reporting-QA-Comms/
    │   ├── <engagement-slug>-comms-plan.md                 -> Comms Plan, plain markdown, no frontmatter (see below)
    │   └── <verification log entries>                      -> Write-and-Verification Log; schema not yet defined (see below)
    ├── Handover-Closure/                                   -> Support Handover; schema not yet defined (see below)
    └── Archive/                                            -> OPTIONAL — created only the first time a file is retired, never scaffolded by default (see §"Archive, intake, and UAT/training semantics" below)
        ├── INDEX.md                                        -> one row per archived file: original location, reason archived, date archived, replacement/successor
        └── <retired files>                                 -> whole files retired from active use — never a Register Item, Work Package, or raw Source (those never move here, see below)
```

**Implementation Plan, Work Package Catalogue, Comms Plan, and the Sources index all stay plain structured markdown, no frontmatter, for now.** Each is a narrative/rollup document (a sequenced approach; a table of links to Work Packages; who needs which update on what cadence; a table of captured sources) rather than an individually-referenceable entity — nothing else needs to foreign-key *into* any one of them as a whole. The Sources index specifically is a table: title, capture date, source tier (per the precedence doctrine above), one-line description, wikilink to the file — maintained by whoever captures the source. If any of these needs to become queryable on its own (e.g. the user wants to query implementation-plan phases structurally), route back to Silas to add a schema here, same as any other extension.

**Evidence Pack lives in its own top-level `Evidence Packs/` folder, a sibling to `Sources (Immutable)/`, never nested inside it.** An Evidence Pack ([[SOP-010-warden-extract-source-to-evidence-pack]]'s output — a per-source distillation: structured summary, speaker/topic index, key extracts, linked Register Items) is **tier 4 (structured project knowledge)** per the precedence doctrine above, not tier 3 — it is a processed read of a source, not the source itself. It is also, deliberately, **not immutable**: a reread pass appends a dated entry to its own `## Reread log` rather than rewriting the prior read, the same append-only discipline as a Register Item's `## Reconciliation log`. An earlier draft of SOP-010 nested it at `Sources (Immutable)/Evidence Packs/` for 1:1 proximity to the source it describes; a pre-merge QA pass correctly flagged that as a real naming/tooling hazard — a documented-mutable file sitting under a folder named "Immutable" risks a future validation script (or a careless agent) treating it as immutable-by-name and refusing to update it, or a human skimming the folder wrongly assuming everything inside is raw and unedited. Moving it to its own `Evidence Packs/` folder removes that hazard without losing discoverability: the pack's own `## Source metadata` section wikilinks back to the raw file and its `Sources (Immutable)/INDEX.md` row, so 1:1 traceability never depended on folder nesting in the first place. See [[SOP-010-warden-extract-source-to-evidence-pack]] for the pack's full content shape.

**Write-and-Verification Log and Support Handover are out of scope for this pass.** The task that produced this Guideline covered engagement, work package, and register item only. When Warden's work produces real Write-and-Verification Log entries or a real Handover document, that is a follow-up schema request to Silas — do not invent fields for them in the meantime; keep writing plain markdown per Warden's contract until they land here.

## Where the six Project Control artifacts live

A QA pass over an earlier architecture proposal for this domain flagged six artifacts that needed an explicit home once the "Project Control" folder they used to live under got reorganised without re-homing them: business case, project brief, comms plan, benefits log, stakeholder register, document register. None of these get a new entity type — each has a home in the schema that already exists, made explicit here so it stops being implicit:

| Artifact | Home | Why not a new entity type |
|---|---|---|
| Business case | Engagement note, body section `## Business case` | One fact (why this engagement is worth doing) about one Engagement — a body section, not a separate file to keep in sync. |
| Project brief | Engagement note body — `## Problem & intent`, `## Who this is for`, `## Definition of done`, `## Out of scope`, collectively | The Engagement note already **is** the Project PRD (see the schema below); a project brief is the same document under a different name. These four sections already say what a brief says. |
| Comms plan | `Reporting-QA-Comms/<engagement-slug>-comms-plan.md`, plain markdown, no frontmatter | Same shape as the Implementation Plan and Work Package Catalogue — narrative/rollup, nothing foreign-keys into it. `Reporting-QA-Comms/` was already the intended home per `Client Delivery/INDEX.md`; this Guideline now says so explicitly. |
| Benefits log | Engagement note, body section `## Benefits realization` | Deliberately lightweight — a dated log of benefit-against-baseline entries, same append-only shape as a Register Item's `## Reconciliation log`. Not a structured field, not a new entity. |
| Stakeholder register | Engagement note, new optional field `linked_stakeholders` (list of objects, see the schema below); narrative content stays in the existing `## Stakeholders` body section | `client_contacts` is a flat list of Person slugs and cannot carry role, influence, or cadence — the actual content of a stakeholder register. A structured field is proportionate; a whole new entity type (one file per stakeholder per engagement) is not. |
| Document register | `Sources (Immutable)/` plus the new per-engagement `INDEX.md` (see the folder map above) | Every source already lands in one immutable, engagement-scoped folder. A table (title, date, tier, description, wikilink) is the register. A real Document entity type — its own frontmatter, its own SQLite table — would only earn its cost once `Client Delivery/` needs to query documents structurally across engagements. Not yet; see §Future extension candidates. |

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
linked_stakeholders:                       # optional - list of objects, the stakeholder register (see notes)
  - person: jane-doe                       # required per entry - slug of a Person in PKM/CRM/People
    role: Client Sponsor                   # free text - their role on this engagement
    influence: high                        # high | medium | low
    cadence: weekly                        # ad-hoc | weekly | biweekly | monthly | milestone-only
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
- **`linked_stakeholders` is the stakeholder register, structured.** It is a list of objects, not a flat slug list — the one deliberate departure from GL-002 rule 4's "list of slugs" shape, made in this Guideline because a stakeholder register needs more than an identity pointer to do its job. Each entry's `person` key still stores a slug per rule 4; `role`, `influence`, and `cadence` are per-entry attributes with no meaning outside their entry, so they nest under it rather than becoming parallel top-level lists that would need index-matching to stay aligned (a `linked_stakeholder_roles[0]` matching `linked_stakeholders[0]` shape is exactly the fragility this avoids). `client_contacts` stays as-is for the simple case (someone you deal with but aren't formally tracking); `linked_stakeholders` is for people actually part of the governed register. A person can appear in both. The existing `## Stakeholders` body section stays for narrative (their stake in the outcome, relationship notes) — the frontmatter field is the queryable register, the body section is the story.
- `status` values follow a PRINCE2-flavoured engagement lifecycle, distinct from the Project `status` enum in GL-002 (which is personal-project-shaped).
- `owner` is the internal person accountable for the engagement (an account/delivery lead) — a slug of a Person, not a title string.
- Body section conventions: `## Problem & intent`, `## Who this is for`, `## Definition of done`, `## Out of scope`, `## Business case`, `## Stakeholders`, `## Benefits realization`, `## Status update`. `## Business case` is the investment rationale (why this is worth doing, what it costs to not do it) — new in this pass, folding the "business case" and "project brief" artifacts into the Engagement note per §"Where the six Project Control artifacts live" above. `## Benefits realization` is a dated, append-only log of benefit-against-baseline entries, same shape as a Register Item's `## Reconciliation log` — deliberately lightweight, not a structured field.

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
- `status` includes `blocked` as a value on the enum, never a separate folder or file — same "blocked-state as metadata, not a folder" doctrine the team already follows elsewhere. Do not create a "Blocked Work Packages" folder. The same doctrine covers `cancelled` and `done`: a superseded or completed Work Package stays in `Work Packages/`, filterable by status, and is never moved into `Archive/` — see §"Archive, intake, and UAT/training semantics" below for why this doctrine is unaffected by the optional `Archive/` folder this Guideline defines for whole retired files elsewhere.
- `done_state` is a short plain-text description of what "authorized as complete" looks like for this work package — the acceptance criterion Warden's philosophy requires before work starts. Free text, not an enum; it is describing a specific outcome, not a category.
- `linked_register_items` stores slugs per GL-002 rule 4, pointing into the same engagement's Register.
- Body section conventions: `## Scope of this work package`, `## Acceptance / done-state`, `## Dependencies`, `## Status update`.

### Register Item - `Client Delivery/<engagement-slug>/Risk-Issue-Change-Decision Register/<engagement-slug>-reg-<NNN>.md`

One entity type covers all four registers, distinguished by `kind`. **Decision: one type with a `kind` field, not four separate entity types.** Risk, issue, change, and decision share the same lifecycle shape (raised, owned, tracked to a resolution, reconciled against new source material) and Warden's own contract already governs them as one register. Four entity types would mean four near-identical schemas and four templates for a distinction that a single enum field captures cleanly; the "combined register" language becomes literal (one folder, one schema, filterable by kind) rather than aspirational.

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
evidence_type:                             # optional - direct-statement | demonstrated | agreed-decision | suggested-option | assumption | inference | unresolved-discussion
confidence:                                # optional - high | medium | low (named band with a documented reason, not a percentage - see notes)
reread_flag: not-required                  # optional - not-required | recommended | mandatory (default not-required if omitted)
tags:
  - uat
---
```

Notes:
- `kind` and `title` and `engagement` are all required — `kind` and `engagement` because a register item is meaningless without knowing which register-flavour it is and which engagement it belongs to (same anchor-rule reasoning as Work Package); `title` because that's the field that names the thing per GL-002 rule 5's general principle.
- `status` is intentionally a superset spanning all four kinds. A given kind will only use the values that make sense for it in practice (a `decision` typically moves `open -> accepted` or `open -> rejected`; a `risk` typically moves `open -> monitoring -> closed`) — the schema does not enforce a per-kind subset, Warden does by convention.
- `rejected`, `resolved`, and `closed` are also this schema's archive states — a Register Item that reaches any of them stays exactly where it is, in `Risk-Issue-Change-Decision Register/`, filterable by status, never moved to a separate folder. See §"Archive, intake, and UAT/training semantics" below.
- `severity` applies to `risk` and `issue`; leave blank for `change` and `decision` where it doesn't map cleanly.
- `source_ref` is the provenance pointer — per Warden's "provenance discipline" philosophy, when a register item is extracted from a raw source (a transcript, a client email) captured under `Sources (Immutable)/`, `source_ref` links back to it. Never edit the source; reconcile the register item's own fields and body instead.
- **`evidence_type` classifies how this item was established from its source** — how it was said, not how important it is. `direct-statement` — someone stated it plainly. `demonstrated` — observed in action, not just stated (a system behaviour, a missed deadline). `agreed-decision` — explicit sign-off from someone with authority to decide. `suggested-option` — raised as a possibility, not committed to. `assumption` — filled in because no source said otherwise; flagging it as such stops it reading as fact. `inference` — someone connected dots the source did not state directly. `unresolved-discussion` — the source shows disagreement or an open thread with no resolution reached. Leave blank if the item predates this field or the distinction adds no value.
- **`confidence` is a named band with a documented reason, never a manufactured percentage.** `high` — direct or demonstrated evidence, a single clear source, no contradiction elsewhere. `medium` — evidence is real but indirect (an inference, a single unconfirmed statement, or a source with some ambiguity). `low` — an assumption, a disputed point, a single verbal mention with no corroboration, or evidence that contradicts another source. The band is the queryable flag; write the *reason* for it in `## Description` or `## Reconciliation log` — reasoning is prose, per the frontmatter/body split this whole schema follows.
- **`reread_flag` tells a reviewer whether the original source needs another pass before this item can be trusted as-is.** `not-required` (the default) — nothing about this item calls its extraction into question. `recommended` — worth a second look when time allows. `mandatory` — do not treat this item as settled until the source has been reread. Set `recommended` or `mandatory`, and note which trigger applied in `## Reconciliation log`, when any of the following hold:
  - `confidence: low`.
  - Attribution is disputed (who said or agreed this is contested).
  - The source shows contradictory discussion (two people, or the same person at two points, said different things).
  - `evidence_type: inference` — anything inferred rather than stated deserves a check before it is treated as settled.
  - The item, or any output built from it, intends to state something was **"agreed"** — agreement is a strong claim and needs direct confirmation in the source before it is asserted as fact.
  - A possible conflict with a tier-1 (Contractual authority) artifact per §"Source-tier precedence doctrine" above — this always warrants at least `recommended`, and `mandatory` if the item's resolution depends on which side is right.
- **The "dated reconciliation entries" Warden's contract requires live in the body, under `## Reconciliation log`, not as separate files.** Each time new source material touches this item, append a dated line (`- 2026-04-02 — new transcript reviewed, downgraded severity to low`) rather than overwriting prior state. This is how "one register, reviewed, not written-once" (Warden's core philosophy #2) is realized structurally: the register *is* the folder of these items, and each item's own reconciliation log is its review history.
- `linked_work_packages` stores slugs per GL-002 rule 4.
- Body section conventions: `## Description`, `## Impact`, `## Reconciliation log`, `## Resolution`.

## Archive, intake, and UAT/training semantics

Three omissions Pax's Fusion247 Brain migration coverage matrix (`Deliverables/2026-07-10-fusion247-brain-migration-coverage-matrix.md` §3) flagged against F247's 13-stage taxonomy. Resolved explicitly here rather than left inferable — each is a real call, made by checking Warden's actual workflow and this Guideline's own existing doctrine, not a reflexive port of F247's folder.

**Archive — a hybrid rule, superseding this Guideline's earlier "git history alone covers it" resolution.** F247's `11_Archive` stage held superseded/deprecated/rejected content per engagement. The original v1.3 resolution here leaned entirely on git history and rejected any Archive folder. On review, git history alone was found insufficient as the *only* mechanism for whole retired files, for two concrete reasons: (a) it is conditional on the user having opted into the myPKA "time machine" git baseline (`ADAPTER-PROMPT.md` §5) — a user without it enabled has no recovery path at all; (b) even when enabled, git gives **recoverability, not discoverability** — nobody browsing the current `Client Delivery/` folder tree can find a retired artifact without already knowing it existed and going to dig through commit history. Git and `Archive/` do different jobs. This Guideline now states the distinction explicitly rather than blurring them:

1. **Git handles version history of continuing files — unchanged from the original resolution.** When the Implementation Plan gets edited, a Comms Plan gets revised, or wording changes inside an existing rollup, that is normal version history for a document that is still active. No physical copy, no Archive folder, no change from before.
2. **A new optional per-engagement `Archive/` folder handles whole files retired from active use.** Examples: an abandoned draft approach, a superseded working document that would mislead a reader if it still looked current, an obsolete generated artifact, a deprecated local guide replaced by a different canonical artifact. The file still has historical or evidential value but no longer belongs among active material.
3. **`Archive/` is created only on first use, not scaffolded into every engagement.** It is not a standard row in the per-engagement folder map (see the folder map above, where it is marked optional) — it appears only when a genuinely retired file exists that needs it. An engagement with nothing ever retired has no `Archive/` folder at all.
4. **What never moves to `Archive/` — unchanged from the original resolution, restated here so it does not get lost in the hybrid rewrite:**
   - **Register Items and Work Packages with a terminal status** (`resolved`, `rejected`, `closed` on Register Item; `cancelled`, `done` on Work Package) — they stay exactly where they are, filterable by status (see §Entity schemas above and the note on both schemas' status fields). Moving them would break slug-based foreign-key resolution (`linked_register_items`, `linked_work_packages`, per GL-002 rule 4) and the audit trail, for zero benefit — status already answers the question a folder move would be trying to answer.
   - **Raw sources in `Sources (Immutable)/`** — that is historical evidence, not archived clutter, and is already governed by its own immutability doctrine (never edited or moved post-capture).
5. **Mechanism for the required metadata: a per-engagement `Archive/INDEX.md` row, not frontmatter on the archived file.** Every file placed in `Archive/` must be traceable to, at minimum, its original location, the reason it was archived, the date it was archived, and its replacement/canonical successor where one exists. This Guideline records that as one row per archived file in `Archive/INDEX.md` — wikilink to the archived file, original location, reason archived, date archived, replacement/successor (or "none") — the same table-register shape already established for `Sources (Immutable)/INDEX.md` (title, capture date, tier, description, wikilink). No frontmatter block is added to the archived file itself. Reasoning: `Archive/` holds heterogeneous survivors of whatever shape they were before retirement — some are plain-markdown rollups that never had frontmatter to begin with, some might be a stray Engagement-adjacent draft that did. Register Items and Work Packages, the two entity types with an actual frontmatter schema, never land in `Archive/` at all (rule 4 above), so there is no entity-type frontmatter contract for this folder to extend in the first place — inventing one here would mean schema-ing a folder whose only job is "hold retired files and say why," not defining a new entity type. An `INDEX.md` row is proportionate to that job and consistent with the one other precedent in this Guideline for exactly this situation (untyped files needing a discoverable register): `Sources (Immutable)/INDEX.md`.

Archive-not-delete stays a hard doctrine independent of the folder — it is the exact failure named in the live Fusion247 Brain incident behind Warden's Critical rule 8 (a README deleted, not archived). The behavioral half of that doctrine is unchanged: never `rm` a `Client Delivery/` file outright. What changes here is that a file being *retired from active use* (not merely edited) now has a real, discoverable destination — `Archive/` plus its `INDEX.md` row — rather than relying solely on the user having git version history enabled to ever find it again.

**Intake/staging — no new folder; `Sources (Immutable)/INDEX.md` already is the staging record.** F247's `00_Project_Inbox` staged unprocessed inputs before they were formally accepted into the register, ahead of formal scoping. Checked directly against Warden's actual workflow ([[SOP-010-warden-extract-source-to-evidence-pack]] §1, "Confirm the source is captured and indexed"): a source is logged in `INDEX.md` at the moment it's confirmed captured, not after a separate acceptance step — no SOP or contract in this domain describes a "captured but not yet accepted" state. This genuinely is not a gap, for two structural reasons:

- `Client Delivery/<engagement-slug>/` does not exist until an engagement is formally scoped (`Client Delivery/INDEX.md`: built out "the first time Warden takes on a real client project"). F247's inbox staged material *before* an engagement/register existed at all; myPKA has no equivalent pre-engagement limbo inside `Client Delivery/`, because the folder itself only comes into being after scoping has already happened.
- Once an engagement exists, `Sources (Immutable)/INDEX.md`'s row (title, capture date, source tier, description, wikilink — already required at capture time, per the folder-map notes above and SOP-010 §1) *is* the staging record, logged at the point of capture rather than as a downstream promotion. A source that later proves unused simply stays there, unreferenced and harmless — immutability means leaving it costs nothing — the same "not yet extracted" state every other freshly-captured source sits in until SOP-010 processes it. No separate "accepted" flag or folder is needed to distinguish it.

**UAT/training evidence — routes through three existing homes by artifact kind, not one new folder.** F247's `08_UAT_Training` held training/UAT evidence as one stage. The coverage matrix's own guess — "could plausibly fold into `Reporting-QA-Comms/`" — is checked here rather than left as a guess, and the honest answer is that UAT/training material is not one kind of artifact, so it does not have one home:

- **Raw UAT scripts, sign-off documents, and training materials**, as captured → `Sources (Immutable)/`, tiered per the source-tier precedence doctrine like any other captured document (a signed UAT acceptance is typically tier 2, approved baseline; a training deck or test script is typically tier 3, project evidence).
- **Confirmation that UAT was completed and signed off, or that training was delivered and received** → a Write-and-Verification Log entry in `Reporting-QA-Comms/`, per Warden's philosophy #4 ("sent is not verified") — this is exactly the "what was sent, when, to whom, confirmed landed" shape the log already exists for. UAT sign-off and training delivery are both outbound-artifact-confirmation events, not a new category needing its own folder.
- **Findings, defects, or decisions arising from UAT** (a defect found during testing, a decision to accept a known defect and proceed to go-live) → a normal Register Item (`kind: issue` or `kind: decision`), in the engagement's Register — structured project knowledge extracted from evidence, exactly like any other.

No new folder, field, or entity type is added by any of the three resolutions above. Each resolves to doctrine already present in this Guideline, stated here explicitly because the coverage matrix correctly found it wasn't written down anywhere before this pass.

## Future extension candidates (not built this pass)

Noted for a future schema pass, not built now — each would need real data from a second engagement before it earns its own entity type, per this buildout's own sequencing decision (don't over-fit the schema to one engagement):

- **Meeting Metadata** — structured attendee/date/type fields for meetings, distinct from the raw transcript captured under `Sources (Immutable)/`.
- **Deliverables** — a queryable entity distinct from Work Packages, if "what we owe the client" ever needs tracking separately from "what work produces it."
- **Requirements** — structured, individually-referenceable requirements, if the Engagement note's `## Definition of done` prose ever needs to become a queryable list.
- **Dependencies** — cross-engagement or cross-work-package dependency tracking beyond the free-text `## Dependencies` section already on Work Package.
- **Action** — a discrete `kind` (or a standalone entity) for action items, distinct from risk/issue/change/decision. Not built in v1: [[SOP-010-warden-extract-source-to-evidence-pack]] and [[SOP-011-warden-meeting-prep]] both currently map "actions" onto a `decision` Register Item's own follow-through (`owner` + `target_resolution_date`) or a Work Package's `target_date`, and both flag this as a schema-fit gap to watch, not act on, until a second real engagement shows the mapping isn't holding up.
- **`owner_side` (internal | client | third-party)** — see §"Known gaps" below.
- **Verification metadata** (`created_by` / `review_status` / `reviewed_by` / `reviewed_date`) — see §"Known gaps" below.

Route any of these back to Silas via Larry when real data makes the case for them. Do not schema them speculatively.

## Known gaps (documented, not built)

Two enforcement questions surfaced during a pre-merge QA pass (2026-07-10). Both are honestly documented here as open gaps rather than closed with a speculative field — each is a candidate for the next schema pass once a second engagement's real activity makes the case for it, per this Guideline's own "don't over-fit to one engagement" sequencing discipline.

**1. Warden's Critical rule 8 ("writer never self-verifies") is a written policy today, not a machine-checkable one.** The rule requires that whoever wrote a Register Item is never the one who marks it verified. Nothing in this schema records *who* wrote an item or *who* reviewed it — there is no `created_by`, `review_status`, `reviewed_by`, or `reviewed_date` field on Register Item. Checked against the other two candidate enforcement paths:
- **Git history doesn't help.** Every commit in this repo is authored by one generic identity regardless of which specialist voice produced the content — git blame cannot distinguish "Warden wrote this" from "a different party reviewed this."
- **Session logs don't structurally help either.** They carry an `agent_id` field, but a session log is a separate file linked to a Register Item only by prose (a sentence that happens to name the item's slug), not a structured foreign key. Answering "which Register Items are still unverified" today means grepping body text and manually inferring writer vs. reviewer from `## Reconciliation log` prose — not a queryable field, not reliable at scale.

Conclusion: a real enforcement gap exists. Rule 8 is currently enforced by Warden (and any other agent) following the written policy, with no structural check that would catch a violation. `created_by` / `review_status` / `reviewed_by` / `reviewed_date` are the obvious candidate fields — not added by this pass.

**2. `owner` alone cannot say whether an owner is internal, client-side, or third-party.** [[SOP-011-warden-meeting-prep]] asks Warden to split owned-internally vs. owned-by-the-client. `owner` on a Register Item or Work Package is just a Person slug and carries no side information on its own. Two cross-reference paths give a partial answer:
- **Client-side detection works when the data is populated:** if the `owner` slug appears in the Engagement's `client_contacts` or `linked_stakeholders`, or a Person note's own `company` matches the Engagement's `client_org`, the owner is client-side. Both signals depend on optional fields that may not be filled in.
- **Internal-vs-third-party is not derivable at all.** Nothing in GL-002 or this Guideline marks a Person as "our own team" vs. "a subcontractor/vendor" — there is no concept of "internal" anywhere in the schema. An owner not found via the client-side paths above is currently indistinguishable between internal team member and third-party contractor.

Conclusion: partially derivable (client vs. not-client, when the optional fields are populated), not reliably derivable for the full three-way split. [[SOP-011-warden-meeting-prep]] §4 has been updated to state the best-effort derivation and its limits rather than imply a clean read of `owner` alone. A future `owner_side: internal | client | third-party` field, or richer stakeholder-relationship data, is the candidate fix — not added by this pass.

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
- `Deliverables/2026-07-10-fusion247-brain-migration-coverage-matrix.md` - the coverage matrix whose §3 flagged the Archive/intake/UAT-training omissions that §"Archive, intake, and UAT/training semantics" above resolves.

## Updates to this Guideline

If the rules change, update this file. Do not duplicate the change into Warden's contract or into `Client Delivery/INDEX.md` — they `[[wikilink]]` here and inherit the change automatically.

### Version history

- **v1.4** - Archive hybrid-rule pass (Silas, user's final implementation decision superseding v1.3's Archive sub-point only, 2026-07-10). The user reviewed v1.3's "no Archive folder at all, git history covers it" resolution for whole retired files and rejected git-history-only as insufficient: it is conditional on the optional "time machine" git baseline being enabled, and even when enabled it gives recoverability, not discoverability. Rewrote the **Archive** sub-point of §"Archive, intake, and UAT/training semantics" to state a hybrid rule, keeping git and `Archive/` doing explicitly different jobs: (1) git still handles version history of continuing files — unchanged; (2) a new **optional** per-engagement `Archive/` folder now handles whole files retired from active use (an abandoned draft, a superseded working document, an obsolete generated artifact, a deprecated local guide) — has historical value but no longer belongs among active material; (3) `Archive/` is created only on first use, never scaffolded by default — added to the folder map as a conditional/optional entry, not a standard row; (4) Register Items and Work Packages with a terminal status, and raw sources in `Sources (Immutable)/`, still never move there — restated explicitly, unchanged from v1.3; (5) every archived file's required metadata (original location, reason archived, date archived, replacement/successor) is recorded as **one row in a per-engagement `Archive/INDEX.md`**, not as frontmatter on the archived file itself — chosen for consistency with the only existing precedent for registering untyped files in this Guideline (`Sources (Immutable)/INDEX.md`), and because the two entity types with an actual frontmatter schema never land in `Archive/` in the first place, so there is no entity contract for a frontmatter block to extend. The Intake/staging and UAT/training sub-points of v1.3's §"Archive, intake, and UAT/training semantics" are unchanged by this pass. Adjusted one cross-reference in the Work Package schema note (status-as-archive doctrine) to stay accurate now that an optional `Archive/` folder exists elsewhere in this Guideline. Checked `Client Delivery/INDEX.md`, `Team/Warden - Delivery Manager/AGENTS.md`, and `SOP-010` through `SOP-014` for the old git-history-only framing — none of them mention Archive at all (confirmed by the same grep discipline as the v1.3 pass), so no cross-file changes were needed; they inherit this change automatically via wikilink per this Guideline's own "Updates to this Guideline" rule.
- **v1.3** - Clarification pass (Silas, closing the three suspected omissions in Pax's Fusion247 Brain migration coverage matrix §3, 2026-07-10). Added **§"Archive, intake, and UAT/training semantics"**, resolving all three with explicit reasoning rather than a new folder: (1) **Archive** — no new folder; Register Item's `rejected`/`resolved`/`closed` and Work Package's `cancelled`/`done` are already the archive states, generalizing the existing "blocked-state as metadata, not a folder" doctrine from `blocked` to every terminal status on both entity types; plain-markdown rollups rely on archive-not-delete as a behavioral rule (never `rm`, always edit-in-place), backed opportunistically by the myPKA git version-history baseline where the user has enabled it. (2) **Intake/staging** — no new folder; `Sources (Immutable)/INDEX.md` already is the staging record, logged at the moment of capture, and `Client Delivery/<engagement-slug>/` itself doesn't exist until after formal scoping, so there is no pre-engagement limbo inside this root for an inbox to serve. (3) **UAT/training evidence** — no new folder; routes through three existing homes by artifact kind (raw materials to `Sources (Immutable)/`, delivery/sign-off confirmation to the Write-and-Verification Log in `Reporting-QA-Comms/`, findings/defects/decisions to Register Items). Extended the Work Package and Register Item schema notes to cross-reference the new section. No folder added to the folder map, no field added to any schema, no entity type added — this pass is documentation only, closing three flagged omissions with real, reasoned calls rather than reflexively porting F247's `11_Archive` / `00_Project_Inbox` / `08_UAT_Training` folders.
- **v1.2** - Pre-merge QA pass (external QA review relayed by the user, 2026-07-10). **Relocated the Evidence Pack** from `Sources (Immutable)/Evidence Packs/` to its own top-level `Evidence Packs/` folder (sibling to `Sources (Immutable)/`) — closes a real naming/tooling hazard (a documented-mutable file nested under a folder named "Immutable"); folder map and a new explanatory note added; GL-006 is now the canonical source for this location decision (previously only stated in SOP-010). Retired the literal "single combined register" quote in §3 (Warden's contract no longer uses that exact phrase; the underlying model — one entity type, one folder, many files — is unchanged). Added **§"Known gaps"**: (1) Warden's Critical rule 8 ("writer never self-verifies") is currently a written-policy-only rule with no machine-checkable trail — no `created_by`/`review_status`/`reviewed_by`/`reviewed_date` fields, git history doesn't distinguish authoring agents, and session logs aren't structurally linked to specific Register Items; (2) `owner` alone cannot express internal/client/third-party side — partially derivable via `client_contacts`/`linked_stakeholders`/`company` cross-reference when those optional fields are populated, not derivable at all for internal-vs-third-party. Both documented as real gaps, not built. Added **`Action`**, **`owner_side`**, and **verification metadata** to §"Future extension candidates". No existing field renamed, removed, or added to any entity schema — this pass is documentation and one structural relocation, not new schema.
- **v1.1** - Enrichment pass, re-deriving principles surfaced by a QA review of the user's prior Fusion247 Brain system (not copied — re-derived in myPKA's own voice and schema shape). Added **§"Source-tier precedence doctrine"**: five tiers (Contractual authority > Approved baseline > Project evidence > Structured project knowledge > Generated outputs), which artifact wins when two disagree, and how the disagreement gets recorded (never silently overwritten). Added optional **`evidence_type`**, **`confidence`**, and **`reread_flag`** fields to Register Item, with documented enum meanings and reread-flag trigger conditions. Added **§"Where the six Project Control artifacts live"**, closing a gap a prior architecture proposal had left open (business case, project brief, comms plan, benefits log, stakeholder register, document register all now have an explicit home): business case and benefits log become new Engagement body sections (`## Business case`, `## Benefits realization`); project brief confirmed as already covered by the Engagement note's existing sections; comms plan confirmed to live in `Reporting-QA-Comms/` as plain markdown; stakeholder register becomes a new optional `linked_stakeholders` field on Engagement (list of objects — person/role/influence/cadence — the one deliberate departure from the flat-slug-list convention, scoped to this Guideline only); document register resolved as `Sources (Immutable)/` plus a new per-engagement `INDEX.md`, not a new entity type. Added **§"Future extension candidates"** (Meeting Metadata, Deliverables, Requirements, Dependencies) as documented-but-not-built. All changes additive and backward-compatible; no existing field renamed or removed. SQLite mirror question and Write-and-Verification Log / Support Handover schemas remain deferred, untouched by this pass.
- **v1.0** - Initial schema pass. Defined Engagement, Work Package, and Register Item (combined risk/issue/change/decision via a `kind` field). Created as a sibling Guideline to GL-002 rather than an extension of it, because `Client Delivery/` is a structurally separate root from `PKM/` by explicit user design. Write-and-Verification Log and Support Handover explicitly deferred - not yet schema'd. SQLite mirror question explicitly deferred to a future decision, not defaulted into SOP-002.
