---
title: Forward correction — the 2026-08-10 current-readiness conclusion was falsified by the first real action
date: 2026-08-10
author: Larry (orchestrator), on Warwick's direct order
status: durable record — corrects forward, rewrites nothing
corrects: Deliverables/2026-08-10-veritas-d1-confirmation-receipt.md (the D-1 confirmation) and Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-phase-b15-live-readiness-gate2-3696960.md (the Gate 2 live-readiness receipt)
governs: Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md § "Current readiness is NOT capability"
---

# The current-readiness conclusion was falsified by the first authorised real action

**This document corrects the assurance record FORWARD. No prior receipt has been edited,
summarised or deleted, and none may be.** The receipts remain exactly as Veritas wrote them;
this record sits beside them and states what the first real event established.

## What was concluded

Across the 2026-08-10 assurance rounds the estate arrived at a position that, **in substance**,
told Warwick the live journey was ready to be exercised and that he could send a fresh
photograph. The final confirmation was carefully scoped in its own words — it said explicitly
that no card had been emitted and that the handover card was **not** proven end to end — but
the operative conclusion Warwick was given, and reasonably acted on, was **"send the
photograph."**

## What happened

**The very first real photograph falsified it.** Warwick sent a genuine shopping-list
photograph (Telegram msg 63, update 171031156) at ~15:33Z. It was downloaded, the Telegram
offset advanced to `consumed`, and **no shop row was created at all**. He received no
acknowledgement card. The list would have been lost outright had the downloaded image not
survived on disk.

## Why this was NOT an unknowable edge case

Every fact needed to predict the failure was **already present and knowable** at the time the
readiness conclusion was formed:

| Fact | Where it was already established |
|---|---|
| Shop identity was **date-derived** — `nextShopRef(date)` = `'SHOP-' + date` | source, unchanged for the life of the module |
| **`SHOP-2026-08-10` already existed** | `asdair.shop`, created `00:15:15` |
| That row was **TERMINAL** (`CANCELLED`) | `asdair.shop_event` id 46, `00:49:37`, described in its own audit trail as *"SPURIOUS… Never a real week"* |
| The next authorised real action was **"Warwick sends a fresh photograph"** | stated as the acceptance event in the assurance record itself |
| `receiveList` → `createOrResumeShop` is `INSERT … ON CONFLICT DO NOTHING` across **both** unique indexes, including `(household_id, shop_ref)` | source |

Joined, those five facts predict the failure exactly: **the next inbound photograph is absorbed
into a terminal row, the offset advances, and nothing reaches a live shop.**

**Larry had himself created and cleaned up that state, and recorded it. Veritas had inspected
the live estate. Neither joined those facts to the next action before the action was declared
ready.**

## The miss, named precisely

> **Veritas proved wiring, capability and historical journey evidence, and failed to test the
> exact next inbound event against the production state it already had available.**

**This is a defect in assurance METHOD.** It is recorded as such deliberately:

- it is **not** to be recorded as *"live testing found an edge case"*;
- it is **not** evidence that independent assurance is pointless — the method is at fault, not
  the existence of the reviewer;
- **Larry's share is the larger one.** Gates were commissioned on the things Larry had just
  built (the rulebook wiring, the checklist link). No gate was ever commissioned on *"can a new
  week actually start?"*, and commissioning is Larry's job, not Veritas's.

## A contributing equivocation, recorded so it stops recurring

**`READY_TO_SHOP` is a durable status column on `SHOP-2026-08-09`.** It meant that one older
shop's lines were all resolved. It never meant *"the system is ready for your next shop."*
Those two readings are far apart, and the phrase carried the second meaning into human
conversation. Assurance and orchestration language must distinguish **the state of an existing
entity** from **the readiness of the next action**.

## What has changed as a result

`Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md` now carries
**§ "Current readiness is NOT capability"** (Warwick, 2026-08-10, binding), which:

- separates **CAPABILITY** from **CURRENT READINESS** and forbids reporting the second on
  evidence of the first;
- makes the question *«Given the durable state that exists RIGHT NOW, what will the production
  system do when the user performs the exact next authorised real action?»* mandatory before any
  `PASS` / `CONFIRMED` / "ready to exercise" verdict on a stateful journey;
- makes an unexamined load-bearing state interaction **UNKNOWN**, and therefore **`HOLD`**;
- permits read-only inspection, traced production paths using measured state, non-mutating
  preflight, or observation of the real event — and **forbids** manufacturing an acceptance
  event or mutating production to satisfy it;
- requires any receipt using readiness language to name six specific things (§ anti-overclaim);
- carries **this exact case as the discriminating worked counterexample**: applied to the
  pre-fix estate, the rule must return **`HOLD`**, and a formulation that would still have
  passed it has not been implemented.

## The discriminating result

**Pre-fix estate, evaluated under the amended rule:**

- exact next action: Warwick sends a fresh Telegram photograph;
- measured state: `SHOP-2026-08-10` exists, status `CANCELLED` (terminal);
- consuming path: `pollIntake` → `persist` → `receiveList` → `createOrResumeShop`;
- state-dependent condition: ref collision on `(household_id, shop_ref)` resolves to a terminal
  row, `ON CONFLICT DO NOTHING`, resumed, nothing written;
- executed? **No.**
- evidence that current state would admit it correctly? **None — and the traced path shows it
  would not.**

**Verdict under the amended rule: `HOLD`.** Not PASS, and not PASS-with-a-caveat. That is the
proof the amendment bites.
