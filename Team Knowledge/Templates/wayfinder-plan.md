# Wayfinder plan — canonical template

> **This file is the single source of truth for the SHAPE of a Wayfinder plan.** Copy it, fill it, commit it before implementation begins.
>
> **The mandate** — that every Fusion247 build requires a durable Wayfinder before implementation, what a map must carry, when it may be updated, and the PASS/PARTIAL/FAILED discipline — is canonical in root `CLAUDE.md` §"Wayfinder" and is **not restated here.** Read it there. This template gives you the layout only.
>
> **Where a filled Wayfinder lives:** `Deliverables/YYYY-MM-DD-<build-slug>-wayfinder-plan.md`.
>
> **What a Wayfinder is NOT:** an execution tracker, a ticket system, or a governance layer. That is canonical in `CLAUDE.md` too. A map is a *record*, and it stops where further detail would be invention rather than route.

## 1. The START / RESUME block — copied, never written

Your map's lines 3–13 are the START/RESUME block, **copied byte-identical from the proven map** `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md`. It is deliberately not reproduced in this template: a third copy is a third thing to drift. Do not reword it, do not "improve" it.

**After editing either file, compare those eleven lines and confirm they are still identical** — the active map carries the exact command that does it, and a template is not the place to keep a control.

## 2. ⚑ WORK CLASSIFICATION — the block a reader must hit first

**Warwick, 2026-08-17 — the durable requirement:** *"Every Wayfinder must make it immediately obvious what kind of work is currently happening, what comes next, and what is merely carried/admin residue."*

Put this table immediately after the map's STATUS heading, **above** the detail. It replaces reading three sections to work out what is going on; if it makes the map longer to read rather than shorter, it is being filled in wrongly.

| | Work type | Outcome | Owner | Model / effort | Blocks what | Done when |
|---|---|---|---|---|---|---|
| **FRONTIER** | | | | | | |
| **NEXT** | | | | | | |
| **SIDECAR / NON-BLOCKING** | | | *(only these three)* | — | — | — |
| **PARKED** | | | *(only these three)* | — | — | — |

**All six fields for FRONTIER and NEXT. SIDECAR and PARKED need only work type, outcome and owner** — SIDECAR is non-blocking by definition and PARKED blocks nothing by definition, so filling `Blocks what` there is noise that dilutes the two rows where it carries weight.

> **⛔ THE CELLS STATE CLASS, OUTCOME AND A FALSIFIABLE `DONE WHEN` — NEVER THE DAY'S PROGRESS.**
>
> This is what keeps the block a reading aid instead of a tracker. A map may be updated **only at a phase boundary**; a cell reading *"evidence is complete as of Tuesday"* is false by Wednesday, at no boundary, and turns the block into the execution tracker a Wayfinder is explicitly not. **`Done when` is a condition, not a state** — write it so anyone can test whether it has been met, and the FRONTIER row stays true between boundaries.

### The four work classes

| Class | Means |
|---|---|
| **BUILD** | Creating or changing actual product capability. |
| **ACCEPT** | Proving already-built capability in its intended / live environment. |
| **REMEDIATE** | Correcting a demonstrated defect or operational failure. |
| **ADMIN** | Continuity, Pax/CAPAE, evidence filing, bookkeeping and other process work. |

### The four sections

| Section | Rule |
|---|---|
| **FRONTIER** | **Exactly one active item.** Not two, not a list. |
| **NEXT** | The next substantive item after the frontier completes. |
| **SIDECAR / NON-BLOCKING** | May be collected or banked opportunistically. **Must not interrupt the frontier unless it exposes a genuine blocker.** |
| **PARKED** | Real outstanding work deliberately outside the current route. |

### The rules that stop this decaying

- **Carried-over ADMIN must never become the apparent frontier merely because it survived the previous session.** Surviving a rotation is not a claim to priority.
- **ACCEPT must not be described as BUILD**, and **REMEDIATE must not be buried inside generic "remaining work".** Naming the class wrongly is how a map stops being readable.
- **MODEL / EFFORT belongs to the CURRENT work item, not the whole build.** When the work class changes — ACCEPT → BUILD, say — **recalculate it for that next item** rather than inheriting the previous phase's figure.
- **Fresh-session orientation surfaces this block before substantive work begins**, so Warwick sees at once what kind of work is happening, which model/effort fits, what actually blocks progress, and what is only background residue.

## 3. The body

Fill the sections `CLAUDE.md` §"Wayfinder" requires: the goal contract and North Star · current reality and verified assets · the system map and product boundaries · known decisions · unresolved fog and contradictions · human dependencies and the point each is required · security, permissions, ownership and recovery boundaries · acceptance evidence · the execution route · the current frontier and next useful action · parked and non-goal work · resumable state after `/clear` or a fresh session.

Two conventions worth carrying, because both were learned expensively:

- **A "SHIT TO DO" section for parked tangents.** Tangents get written there and the plan continues — including tangents from Warwick, who has explicitly asked to be told to wait.
- **An execution-route table** with, per phase: outcome · gate/evidence · model. The gate is what a later review claim is derived from, so write it as something falsifiable rather than as an aspiration.

## 4. Phase status — the durable table

Update **only** at a phase boundary, with an evidence pointer.

| Phase | Status | Model | Evidence |
|---|---|---|---|
| 0 — … | ⬜ NOT STARTED | | — |

**PASS is not Larry's to record.** What it additionally requires is canonical in `CLAUDE.md` §"Wayfinder".

## 5. Amendments

Two rules bite here more than anywhere else — attribution, and re-cutting the body an amendment contradicts. Both are canonical in `CLAUDE.md` §"Amendments". Read them there before appending anything to a map.

## References

- Root `CLAUDE.md` §"Wayfinder" — the mandate, required contents, update discipline and amendment rules. **Canonical.**
- `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md` — the proven map; source of the START/RESUME block.
- [[Templates/work-order]] — the shape of the Work Orders a map's phases get dispatched as.
- [[Templates/veritas-receipt]] — the shape of the receipt a PASS depends on.
