# PROPOSED REDLINE — CLAUDE.md §"Wayfinder", work classification

- **Date:** 2026-08-17
- **Status:** ✅ **APPLIED 2026-08-17**, after Nolan's independent review and Warwick's explicit authorisation. Kept as the provenance record for the change.
- **Author:** Larry
- **Independent review:** Nolan — **SHIP WITH NAMED CUTS.** He found genuine duplication, so per Warwick's condition his smallest correction was incorporated and the *reviewed* redline applied, not the original.

## What Nolan changed about this patch, and why the applied version is smaller

He verified two claims I had understated, and both held by measurement:

- **`Team Knowledge/INDEX.md` contained ZERO occurrences of the word "template"**, and `CLAUDE.md` referenced `Templates/` exactly once (the Veritas receipt). A fresh Larry therefore had **no path** to the new template. That made the change *capability*, not the automation Warwick asked for — squarely § "Nothing may live only in Larry's head". **Fixed:** `Team Knowledge/INDEX.md` now carries a Templates section pointing at the Wayfinder plan, alongside this file's CLAUDE.md pointer.
- **Change 2 as originally drafted restated all six fields, all four sections and all four decay rules, then closed with "The shape is canonical in the template and is not restated here."** It was restated there; that closing sentence was the tell. **Applied version keeps only** the mandate, the four class names, FRONTIER = exactly one, the carried-ADMIN rule and the pointer — so the sentence is now true. Fields and decay rules live in the template alone.

He also cut, and I applied: the `diff`/`sed` byte-identity control out of the template (a layout template growing an executable control is the BUILD-018 opening move, and a command opening with `diff` prompts Warwick on this machine); the enumeration in `Templates/INDEX.md` (a third copy); and two restate-then-disclaim passages in the template.

**His finding I have NOT yet acted on, held deliberately:** the block currently adds six lines to the BUILD-006 map and removes zero, with all four rows duplicated in the STATUS table beneath it — so *"does it make the map shorter"* is honestly **not yet satisfied**. His named cuts to that map are held only because **Veritas is mid-review of those exact rows**, and re-cutting them under a running reviewer is the failure this estate paid 5h27m for. They are applied the moment Veritas returns.

## Why this is a proposal and not an edit

Warwick authorised the durable process change and named where it must live: *"the canonical Wayfinder/template/operating guidance used to create and resume future Wayfinders."* The template half is **done and committed** — `Team Knowledge/Templates/wayfinder-plan.md`, registered in `Templates/INDEX.md`.

`CLAUDE.md` §"Wayfinder" is **operating law**, and `CLAUDE.md` §"Hard rules" states: *"No silent constitutional self-modification… Such a constitutional change requires Warwick's explicit approval, an exact proposed redline, and independent review of the resulting patch."* He authorised an outcome; he did not name this file. So the redline is produced rather than applied.

**This is the one thing standing between the change and his stated acceptance test** — *"a fresh future Wayfinder created from the canonical mechanism naturally presents FRONTIER / NEXT / SIDECAR / PARKED… without Warwick having to ask"* — because the creation route a fresh Larry actually reads is this section, not the template. Without the pointer, the template is discoverable but not mandated. **One word applies it.**

## The redline — two changes, both additive

### Change 1 — the required-contents sentence (line 320)

**BEFORE:**

> Every map must carry: the goal contract and North Star · current reality and verified assets · the system map and product boundaries · known decisions · unresolved fog and contradictions · human dependencies and the point each is required · security, permissions, ownership and recovery boundaries · acceptance evidence · the execution route · the current frontier and next useful action · parked and non-goal work · resumable state after `/clear` or a fresh session.

**AFTER** (one clause added, marked):

> Every map must carry: **the ⚑ work classification block (below)** · the goal contract and North Star · current reality and verified assets · the system map and product boundaries · known decisions · unresolved fog and contradictions · human dependencies and the point each is required · security, permissions, ownership and recovery boundaries · acceptance evidence · the execution route · the current frontier and next useful action · parked and non-goal work · resumable state after `/clear` or a fresh session.

### Change 2 — one new bullet, immediately after the "Copy the startup/orientation block verbatim" bullet (line 323)

**INSERTED — the reviewed version, ~60% shorter than drafted, per Nolan:**

> - **⚑ Carry the WORK CLASSIFICATION block, whose shape is canonical in [[Templates/wayfinder-plan]]** (Warwick, 2026-08-17). A map must make it immediately obvious **what kind of work is happening now, what comes next, and what is merely carried residue** — the work classes being **BUILD**, **ACCEPT**, **REMEDIATE** and **ADMIN**, split into **FRONTIER** (exactly one active item), **NEXT**, **SIDECAR / NON-BLOCKING** and **PARKED**. **Carried-over ADMIN never becomes the apparent frontier merely because it survived a rotation.** Fresh-session orientation surfaces this block before substantive work begins. The fields, and the rules that stop it decaying into a tracker, live in the template.

*(The three decay rules and the six field names were removed from this bullet and left in the template only — that is what makes its closing sentence honest.)*

## What this deliberately does NOT do

- **No new tracker, register, counter, validator or control plane.** The regrowth cap applies at full force; the change is one clause, one bullet and one template file, reusing the existing `Templates/` convention that already carries the Work Order and Veritas receipt shapes.
- **No change to the START/RESUME block**, which stays byte-identical and unreworded. Verified still exit 0 on the active BUILD-006 map after today's edits, and the check was mutation-tested.
- **No new gate, and no change to any existing gate**, verdict, interrupt reason or authority.
- **No third copy of anything.** The template points at `CLAUDE.md` for the mandate; `CLAUDE.md` points at the template for the shape. One fact, one home, per the SSOT golden rule.

## Worked example, already live

`Deliverables/2026-08-03-build-006-vlogops-publishing-engine-wayfinder-plan.md` carries the block as of `5254f15`, filled from today's real state: FRONTIER = **ACCEPT** (Phases 1–2 live acceptance, awaiting Veritas) · NEXT = **BUILD** (#109 Phase 3, model recalculated for that item, not inherited) · SIDECAR = **ADMIN** (Pax/CAPAE, landed and banked) · PARKED = **REMEDIATE** (#106, #108, #111).

That example is what a fresh session now hits before the detail, and it is the test of whether this makes the map shorter to read rather than longer.
