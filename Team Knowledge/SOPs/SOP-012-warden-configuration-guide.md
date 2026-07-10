# SOP-012 - Implementation & Configuration Guide

- **Default owner:** Warden
- **Reusable by any agent.** A technical/consultant owner executing configuration work can also run this to (re)generate the guide.
- **Triggered by:** "build the configuration guide for [engagement]" / "what needs configuring for X" / "write up the implementation steps for Y."
- **Output:** a Configuration Guide rollup under `Work Packages/`.
- **References:** [[GL-006-client-delivery-frontmatter-conventions]] (`kind: change`/`kind: decision` Register Items, Work Package schema, `reread_flag` triggers), [[SOP-010-warden-extract-source-to-evidence-pack]].

## Purpose

Turn `kind: change` and `kind: decision` Register Items, plus their linked Work Packages, into a practical, per-item implementation checklist — objective through to outstanding decision — that a technical or consultant owner can actually execute against. Reuses Evidence Packs by default; reopens the original source only when GL-006's own `reread_flag` triggers say it's warranted, tied to a specific gap in *this* guide.

## When to call this

The engagement is in-flight, a batch of configuration-relevant changes/decisions exist in the register, and Larry needs an execution checklist — not a vague to-do list, and not a fresh interpretation of what "should" happen.

## Steps

### 1. Pull inputs

- Register Items with `kind: change` or `kind: decision` for the engagement, any status.
- Their `linked_work_packages`.
- The Evidence Pack(s) each item's `source_ref` points to.

### 2. Default to zero rereads — reopen only against GL-006's own triggers, and only when the gap is specific to this guide

Read the register item plus its Evidence Pack entry first. Only reopen the original source when:

- The item is `reread_flag: mandatory`, **and** the configuration instructions in its `## Description` / `## Reconciliation log` are genuinely incomplete without a reread.
- The item is `reread_flag: recommended`, **and** the ambiguity it flags is exactly the ambiguity blocking a concrete configuration step in this guide — not an unrelated ambiguity on the same item.

Do not invent a new trigger category (e.g. "reconstruct a demo," "reopen for extra colour") — if it isn't on GL-006's list, it isn't grounds for a reread inside this SOP. If the source needs a genuinely fresh pass for reasons outside these triggers, that's a new SOP-010 run, not a shortcut here.

### 3. Write each configuration item

For every `kind: change`/`kind: decision` item in scope:

- **Objective** — what this configuration is trying to achieve.
- **Current state** — as the register item / Evidence Pack describes it.
- **Required state** — the target, per the register item.
- **Steps** — concrete, numbered configuration steps, sourced from the item's body or Evidence Pack extracts.
- **Environment** — only if the source actually names one. Blank, not invented.
- **Dependencies** — `linked_work_packages`, and any other register items the body names as related. myPKA has no separate Dependencies register in v1 (see GL-006's Future extension candidates) — state dependencies in prose, don't invent a structured field.
- **Validation checks** — how to confirm the configuration actually worked. An instruction with no way to confirm it isn't a configuration guide, it's a wish list.
- **Owner** — the register item's own `owner` field. If blank and you're naming a likely owner based on the linked Work Package's owner, mark it **proposed** — never silently promote a Work Package owner into the register item's owner field.
- **Status** — the register item's own `status`, verbatim.
- **Source evidence** — wikilink to `source_ref` and to the specific Evidence Pack section/anchor behind this item.
- **Outstanding decision** — anything still open on the item, or any unresolved `reread_flag`.

### 4. Never resolve an outstanding decision yourself

If a configuration item's required state hinges on a scope or risk-acceptance call, list it under Outstanding decision and escalate it to the user via Larry, per Warden's Critical rule 4. Do not pick a side to make the guide look more finished.

### 5. QA checklist (Configuration Guide-specific)

- Every step traces to the register item's body or the Evidence Pack — not filled in from general product knowledge presented as if the source said it.
- Environment and Dependencies are stated only where the source actually names them.
- Any item still `reread_flag: mandatory` and unresolved is listed under Outstanding decision, not written up as settled.
- Every item has a Validation check — no exceptions.

### 6. Save

`Client Delivery/<engagement-slug>/Work Packages/<engagement-slug>-configuration-guide.md`. Plain markdown rollup, no frontmatter.

**Why this location, not a new folder or per-item files:** configuration items already have their canonical homes — Register Items own their state, Work Packages own their scope. This guide is a read-only, derived assembly of both, built for execution rather than for being foreign-keyed into. `Work Packages/` already hosts exactly this shape of document — the Work Package Catalogue (`<engagement-slug>-work-package-catalogue.md`, plain markdown, no frontmatter, per GL-006's folder map). The Configuration Guide is the same kind of rollup, so it takes the same folder rather than earning a new one.

## Worked example

Bellrock's register has six open `kind: change` items tagged `uat` and `configuration`. Warden pulls all six plus their linked Work Packages (WP-004, WP-005), reads their Evidence Pack entries — five have enough detail already captured. One (`reg-019`, permit-expiry notification routing) is `reread_flag: recommended` and the ambiguity (who the notification recipients actually are) is exactly what's blocking its Required state. Warden reopens the anchored section of the relevant transcript, confirms the recipient list wasn't actually settled, and writes it up under Outstanding decision rather than guessing. Saved to `Work Packages/bellrock-npl-implementation-configuration-guide.md`.

## Common mistakes to avoid

- Rereading a source for general context instead of a specific, named gap — turns "targeted" into "full" by another name.
- Filling in Environment or Dependencies from assumption because the guide "feels incomplete" without them.
- Promoting a Work Package's owner into a blank register-item Owner field without marking it proposed.
- Writing a configuration step with no Validation check.
- Silently resolving an Outstanding decision instead of routing it to the user via Larry.
