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

Verify byte-identity after any edit to either file:

```bash
diff <(sed -n '3,13p' Deliverables/2026-08-02-wayfinder-operating-reset-plan.md | tr -d '\r') \
     <(sed -n '3,13p' Deliverables/YYYY-MM-DD-<build-slug>-wayfinder-plan.md | tr -d '\r')
```

Exit 0 means identical. **Mutation-test it once** — append a byte to a copy and confirm `diff` reports a difference — so an identical result is a real match and not a control that always passes.

## 2. ⚑ WORK CLASSIFICATION — the block a reader must hit first

**Warwick, 2026-08-17 — the durable requirement:** *"Every Wayfinder must make it immediately obvious what kind of work is currently happening, what comes next, and what is merely carried/admin residue."*

Put this table immediately after the map's STATUS heading, **above** the detail. It replaces reading three sections to work out what is going on; if it makes the map longer to read rather than shorter, it is being filled in wrongly.

| | Work type | Outcome | Owner | Model / effort | Blocks what | Done when |
|---|---|---|---|---|---|---|
| **FRONTIER** | | | | | | |
| **NEXT** | | | | | | |
| **SIDECAR / NON-BLOCKING** | | | | | | |
| **PARKED** | | | | | | |

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

**PASS additionally requires a Veritas receipt against that phase boundary and the outcome it promised.** PARTIAL and FAILED are Larry's to record without one; **PASS is not.** Canonical in `CLAUDE.md`.

## 5. Amendments

**⛔ What Warwick said is quoted. What Larry concluded is labelled as Larry's and never enters the heading.** And **an amendment that changes a phase's state is not complete until the rows and pointers describing that phase are re-cut in the same commit** — supersede the body, or do not append the amendment. Both rules are canonical in `CLAUDE.md` §"Amendments" and are pointed at here because this is where they get broken.

## References

- Root `CLAUDE.md` §"Wayfinder" — the mandate, required contents, update discipline and amendment rules. **Canonical.**
- `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md` — the proven map; source of the START/RESUME block.
- [[Templates/work-order]] — the shape of the Work Orders a map's phases get dispatched as.
- [[Templates/veritas-receipt]] — the shape of the receipt a PASS depends on.
