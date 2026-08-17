# PROPOSED REDLINE — CLAUDE.md §"Wayfinder", work classification

- **Date:** 2026-08-17
- **Status:** **NOT APPLIED. Awaiting Warwick's explicit approval.**
- **Author:** Larry
- **Independent review:** Nolan (accidental-complexity sanity check)

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

**INSERT:**

> - **⚑ Carry the WORK CLASSIFICATION block, from [[Templates/wayfinder-plan]]** (Warwick, 2026-08-17). A map must make it immediately obvious **what kind of work is happening now, what comes next, and what is merely carried residue** — work type (**BUILD** / **ACCEPT** / **REMEDIATE** / **ADMIN**), outcome, owner, model/effort, what it blocks, and what done looks like — split into **FRONTIER** (exactly one), **NEXT**, **SIDECAR / NON-BLOCKING** and **PARKED**. **Carried-over ADMIN never becomes the apparent frontier merely because it survived a rotation**, ACCEPT is never described as BUILD, REMEDIATE is never buried inside "remaining work", and **model/effort belongs to the current item — recalculated when the work class changes, never inherited from the previous phase.** Fresh-session orientation surfaces it before substantive work begins. The shape is canonical in the template and is not restated here.

## What this deliberately does NOT do

- **No new tracker, register, counter, validator or control plane.** The regrowth cap applies at full force; the change is one clause, one bullet and one template file, reusing the existing `Templates/` convention that already carries the Work Order and Veritas receipt shapes.
- **No change to the START/RESUME block**, which stays byte-identical and unreworded. Verified still exit 0 on the active BUILD-006 map after today's edits, and the check was mutation-tested.
- **No new gate, and no change to any existing gate**, verdict, interrupt reason or authority.
- **No third copy of anything.** The template points at `CLAUDE.md` for the mandate; `CLAUDE.md` points at the template for the shape. One fact, one home, per the SSOT golden rule.

## Worked example, already live

`Deliverables/2026-08-03-build-006-vlogops-publishing-engine-wayfinder-plan.md` carries the block as of `5254f15`, filled from today's real state: FRONTIER = **ACCEPT** (Phases 1–2 live acceptance, awaiting Veritas) · NEXT = **BUILD** (#109 Phase 3, model recalculated for that item, not inherited) · SIDECAR = **ADMIN** (Pax/CAPAE, landed and banked) · PARKED = **REMEDIATE** (#106, #108, #111).

That example is what a fresh session now hits before the detail, and it is the test of whether this makes the map shorter to read rather than longer.
