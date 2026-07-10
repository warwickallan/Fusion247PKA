---
agent_id: silas
session_id: warden-schema-gap-2026-07-10
timestamp: 2026-07-10T19:05:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: [GL-002-frontmatter-conventions, GL-006-client-delivery-frontmatter-conventions]
---

# Schema pass for `Client Delivery/` — resolved Warden's schema gap

## What I did

Warden (Delivery Manager, hired via SOP-001) was instructed to write plain structured
markdown for `Client Delivery/` — no frontmatter, no invented YAML keys — pending a
schema decision. GL-002's own "How to extend this Guideline" path 2 ties adding a new
entity type to "a new folder under `PKM/`," which does not fit: `Client Delivery/` is a
deliberately separate top-level root (own eventual dashboard, off the personal PKM by
design). Rather than stretch GL-002's stated scope or its PKM-only SQLite mirror
(SOP-002) to cover a domain neither was written for, I created a sibling Guideline.

**New file:** `Team Knowledge/Guidelines/GL-006-client-delivery-frontmatter-conventions.md`.
Defines three entity types for Warden:

- **Engagement** — `Client Delivery/<engagement-slug>/Project Control/<engagement-slug>.md`.
  This file *is* the Project PRD. Required: `name`. Bridges back into `PKM/CRM/` via
  optional `client_org` / `client_contacts` slugs — the one deliberate touchpoint between
  the two roots.
- **Work Package** — `Client Delivery/<engagement-slug>/Work Packages/<engagement-slug>-wp-<NNN>-<slug>.md`.
  Required: `name`, `engagement` (anchor rule, same shape as Goal→`key_element` in GL-002).
  `status` includes `blocked` as an enum value, never a folder, per the Fusion247-pattern
  "blocked as metadata, not a folder" doctrine in the source brief.
- **Register Item** — `Client Delivery/<engagement-slug>/Risk-Issue-Change-Decision Register/<engagement-slug>-reg-<NNN>.md`.
  **One entity type, not four** — a `kind` enum (`risk | issue | change | decision`)
  covers all of them, matching Warden's own "single combined register" language
  literally. Dated reconciliation entries (Warden's core philosophy #2) live in the
  body under `## Reconciliation log`, appended, never overwritten — resolved the
  apparent tension between "one combined register" and "one entity per file": the
  register is the *folder*, each risk/issue/change/decision is its own *file*.

**Slug pattern:** Work Package and Register Item slugs are engagement-prefixed
(`<engagement-slug>-wp-001-...`, `<engagement-slug>-reg-014`) to stay globally unique
across engagements, since (unlike the flat PKM entity folders) Client Delivery entities
nest per-engagement and FKs still resolve by slug per GL-002 rule 4.

**Deferred, explicitly:** Write-and-Verification Log and Support Handover — not asked
for in this pass, still plain markdown until a real schema request lands. Implementation
Plan and Work Package Catalogue stay plain markdown permanently (narrative/rollup docs,
nothing FKs into them).

**SOP-002 / SQLite — flagged, not touched.** SOP-002 is scoped entirely to `PKM/`
(folder map, table list, validation queries). Whether `Client Delivery/` ever joins that
mirror, gets its own separate one, or stays markdown-only depends on how the
"possibly-separate dashboard" gets built later — a real decision for the user and
whoever builds that dashboard, not a drive-by SOP-002 edit. GL-006 states this
explicitly rather than defaulting either way.

## Files touched

- `Team Knowledge/Guidelines/GL-006-client-delivery-frontmatter-conventions.md` (new)
- `Team Knowledge/Guidelines/GL-002-frontmatter-conventions.md` (added extension path 3
  in "How to extend this Guideline"; v2.5 version-history entry)
- `Team Knowledge/Guidelines/INDEX.md` (GL-006 row, next-slot bumped to GL-007)
- `Team Knowledge/Templates/engagement.md` (new)
- `Team Knowledge/Templates/work-package.md` (new)
- `Team Knowledge/Templates/register-item.md` (new)
- `Team Knowledge/Templates/INDEX.md` (new Client Delivery templates section)
- `Client Delivery/INDEX.md` (schema status section rewritten from "pending" to resolved;
  cross-references updated)
- `Team/Warden - Delivery Manager/AGENTS.md` (§Schema note rewritten to point at the real
  schema; References section updated — surgical, rest of contract untouched)
- `.claude/agents/warden.md` (shim's cold-start step 4 updated to point at GL-006)

## What the next agent must know

- Warden should now write real frontmatter-bearing Engagement / Work Package / Register
  Item notes starting from the three new templates — no more "plain markdown only" for
  those three types.
- No engagement has been scoped yet (`Client Delivery/` is still just `INDEX.md`), so
  none of this has been exercised against real data. First real engagement is the actual
  test of the schema — watch for friction on the compound-slug pattern in particular.
- If/when Write-and-Verification Log or Support Handover need real data, that's a new
  GL-006 extension (path 1 or 2 within GL-006 itself, not a new sibling Guideline —
  GL-006 is now the home for all `Client Delivery/` entity types).
- The SQLite-mirror question for `Client Delivery/` is still open. Don't let it get
  silently decided by someone just adding a table to SOP-002 without the explicit
  separate-dashboard conversation the user flagged.
