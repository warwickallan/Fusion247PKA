---
title: ROTATION HANDOVER — 2026-08-10 evening. Read this first.
date: 2026-08-10
author: Larry
build: BUILD-015 AsdAIr
closing_head: fb58882
durable_remote: origin/build-015/durable/2026-08-10-live-shop-fixes
status: handover — NOT a completion claim
---

# Rotation handover, 2026-08-10

## Warwick's position, in his words, and it is the honest frame for everything below

> *"900k — a whole other session this evening after being told this morning it was ready to shop.
> still dont know it works, still no shop, more time, more expense."*

**He is right on every count.** This morning he was told the system was ready to be exercised. He
sent one photograph. It was silently absorbed into a cancelled shop and produced nothing. A full
evening later he still has **no completed shop**, and **nobody has yet proved the fixed journey
works end to end**, because that requires a photograph nobody has asked him to send yet.

**Nothing in this document is a completion claim.** An independent session measurement is at
[[2026-08-10-pax-session-performance-report]] and its corrections to this account take precedence
over it.

## Where the estate is, established by execution

| | |
|---|---|
| Closing head | `fb58882` on local `main`, worktree clean |
| Durable remote | `origin/build-015/durable/2026-08-10-live-shop-fixes` — everything pushed |
| `origin/main` | **NOT updated.** That push and the merge remain Warwick's (`merge-decision`) |
| Runtime | PID 12204, started `20:40:57Z` **via the scheduled task**, `mode: live`, on `fb58882` bytes, checklist base URL present |
| Estate suites | pipeline 473 · skill 341 · bot 184 · handoff 124 · browser-runner 92 · reconcile 106 · shop 102 · intake 43 · interpret 30 · packet 110 · outcome 193 · cockpit-api 148 · transcribe 36 — **all zero-fail** |
| Live shops | `SHOP-2026-08-10-M64` at `NEEDS_DECISION`, 2 open questions — **PRESERVED EVIDENCE, not the acceptance vehicle**. `SHOP-2026-08-09` at `READY_TO_SHOP` |

## What was delivered — eleven work packages

| WP | Outcome |
|---|---|
| B15-07 | a new list never dies in a terminal shop |
| B15-08 | a typed answer is never also a shopping list; dead `Search ASDA` withdrawn |
| B15-09 | **ONE question board, edited in place** — cleared the Gate 2 FAIL |
| B15-10 | a dead shop's items stop reaching a live plan |
| B15-11 | the pack-size rule is SHARED; the intake CLI can no longer eat a pending list |
| B15-12 | no false `BASKET_READY`; a dry run no longer moves real shop state |
| B15-13 | separator-blind grounding — `VANISH PRETREAT GEL` finds `Vanish Pre-Treat Gel` |
| B15-14 | **both** supervised hops now advance in the product |
| B15-15 | `blocked` is three-valued; the board can no longer claim a stuck shop is fine |
| B15-16 | **migration 019**, proven on real PostgreSQL 17.4 — **UNAPPLIED** |
| Larry | harness deletion · board wording · pack-size re-point — all mutation-proven |

## ⛔ WHAT IS NOT DONE — read before claiming anything

1. **The journey has NEVER been run end to end.** No photograph has traversed the fixed path. The
   board has never met the real Bot API — `editMessageText` is unproven against Telegram.
2. **Migration 019 is UNAPPLIED**, and even applied, the live pipeline still creates lists in the
   unowned lane because nothing supplies `shop_id` yet. That follow-on is not written.
3. **Nothing calls `completeHandoff`** on the live route, so the supervised leg still terminates in
   a gap even though both transitions now exist.
4. **No handoff artefact has ever been generated**, so item 11's "executable shopping instructions"
   remains unproven — see [[2026-08-10-finding-supervised-browser-dead-end]].
5. **Durable learning has never run**, because no shop has ever reached `RECONCILED`. It is NOT
   missing code — see [[2026-08-10-finding-durable-learning-built-not-wired]] and its correction.
6. **The remembered-choice mismatch is unfixed** — Warwick will be asked again next week under a
   different spelling. See [[2026-08-10-finding-remembered-choice-normaliser-mismatch]].
7. **WP-B15-13's worker never returned.** Its work is integrated on MY evidence, not a self-report.

## ⚖️ THE VERDICTS — both gates HOLD at `fb58882`

**Veritas Gate 1: HOLD. Gate 2: HOLD.** Receipts committed verbatim at `f22bfa5`.

### The good half, established from MEASURED state and not from capability

**If Warwick sends a photograph it will NOT be lost, and it WILL create a live shop.**
`SHOP-2026-08-10` is CANCELLED, so `createOrResumeShop` takes the terminal branch and inserts a
genuinely new `SHOP-2026-08-10-M<msgid>`; and a photo is never eaten as an answer because
`verdict.kind !== 'text'` returns false before the claim path. **This morning's exact failure will
not recur.**

### 🔴 THE BLOCKER — a defect Larry did NOT find, live right now

`loadOpenQuestions` (`runtime.js:228`) flattens open questions across **all** active shops while
computing `ordinal` **per shop**. `correlateTypedAnswer:464` then builds
`new Map(open.map((q) => [q.ordinal, q]))` — **duplicate ordinals silently keep the last.**

So once a second shop asks its own questions 1 and 2, **a numbered board reply can be recorded
against the WRONG shop's question** — logged `board_reply_correlated`, update claimed, no error,
nothing Warwick can see. **That is this morning's failure class — an answer going somewhere
invisible — on the very surface built to fix it.**

**It is armed by a PRESERVATION DECISION, not by code.** Keeping `M64` as evidence is right; leaving
it **ACTIVE with two open questions** is what creates the collision. Those are separable, and
separating them is the cheapest thing that changes the verdict.

**Third:** with 019 unapplied, whether a second shop on one date can acquire its own
`shopping_lists` row is **unmeasured**. Unknown on a load-bearing precondition → HOLD.

### Also corrected by Veritas, and both are mine

- **I carried the 019 limit only half way.** The map records it UNAPPLIED but NOT that **nothing
  supplies `shop_id`** — every production insert into `asdair.shopping_lists` was searched and only
  test files were found. A fresh session reads *one gated action away* when it is **two pieces of
  work** away.
- **`WO-B15-FIX1` was in the series and absent from my dispatch**, so it went ungraded.
- Veritas could not read `C:\.fusion247\**` (no `private_surface` declared), so it could not confirm
  the runtime is completing polling passes. **Declare that surface next time.**

## The next real action

**Ask Warwick for a fresh photograph — and NOTHING before it.** That is the acceptance event, it is
the only thing that proves the journey, and it is the one thing only he can do. It must be a CLEAN
journey; `M64` is evidence and must not be used.

**Before asking:** confirm the Veritas Gate 1 and Gate 2 verdicts at `fb58882` (dispatched this
session, receipts due in `Builds/BUILD-015-.../Assurance/`), and apply §"Current readiness is NOT
capability" to that exact action against the state that exists at the time.

## Traps that cost real time tonight — do not re-learn these

- **Restart the runtime ONLY via the scheduled task `MyPKA-AsdAIr-Runtime`.**
  `ASDAIR_COCKPIT_BASE_URL` comes from the Windows **user environment**, not the credentials files.
  A launcher restart from a shell silently drops the checklist URL. I did this and broke it.
- **Isolated worktrees have no `node_modules`.** Suites there report false failures (`skill` 295/7
  in a worktree, 333/0 on main). Do not report those as pre-existing defects — I did, to two workers.
- **A worktree carrying a `node_modules` junction must have the junction removed with a
  NON-RECURSING delete first.** `rm -rf` follows it and destroys the primary checkout's dependencies.
- **Mutations silently no-op on CRLF.** Four instances tonight. Assert the source ACTUALLY CHANGED
  and the executed count is non-zero before believing any red.
- **`git diff --numstat` is the WRONG instrument for "is anything stranded".** Use
  `git diff --diff-filter=A --name-only HEAD origin/main`.

## Governance changed tonight, and it binds the next session

The Veritas contract was amended **three times** on Warwick's direct authority — `65f7375`,
`62aa2e8`, `0658290` — each independently read back. Current readiness is not capability · Gate 2
grades the real interface and **Larry does not set its scope** · the user-outcome rule binds by
**requirement type** at whatever gate grades it · `PASS`/`HOLD`/`FAIL` only. **Read the contract
before commissioning any gate.** Two forward corrections record the falsified verdicts.

## The honest summary

Eleven work packages, a governance correction that will outlive them, and **no shop**. The defects
were real and every one was found because Warwick used the product — which is the measure of how
much the assurance was worth before tonight. Whether that justifies the spend is his call, and
Pax's independent report is the input to it, not this document.
