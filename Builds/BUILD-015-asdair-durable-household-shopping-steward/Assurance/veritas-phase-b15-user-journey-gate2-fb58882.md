---
build: BUILD-015-asdair-durable-household-shopping-steward
scope: phase-b15-active-accepted-user-journey
gate: 2

boundary: THE ACTIVE ACCEPTED USER JOURNEY — Warwick photographs a list in Telegram → catalogue-grounded
  interpretation → he is asked ONLY what genuinely needs asking → he answers naturally including in free
  text → answers change THIS shop and, where appropriate, become durable household knowledge → he can see
  what he has answered and what remains → READY_TO_SHOP only when he can tell nothing is unresolved →
  he taps Build ASDA basket → handover card with a tappable checklist → supervised browser → a basket he
  can check out himself.

reviewed_sha: fb588826e891ffd2944a29499ce77c400e0f2ea7
governance_sha: fb588826e891ffd2944a29499ce77c400e0f2ea7
branch: main (also reachable from origin/build-015/durable/2026-08-10-live-shop-fixes)

evidence_method: mixed — live runtime and read-only cockpit-api (current durable production state) ·
  primary checkout (production path tracing) · git archive export (suite execution)
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/a8a4a211-d8c2-42c1-8bb3-d7d87ba2540f/scratchpad/exp
worktree_head_at_start: fb588826e891ffd2944a29499ce77c400e0f2ea7
worktree_head_at_end: 6eb815ea8745861b167ba8657cf062c863962b36
  # NOT equal to worktree_head_at_start, and recorded rather than smoothed over. Larry committed TWO
  # DOCUMENTATION-ONLY commits (d1bab9a rotation handover, 6eb815e wayfinder pointer) DURING this review.
  # `git diff --stat fb58882..HEAD` = 2 files, both Deliverables/*.md, ZERO product files. My evidence was
  # gathered against fb58882 bytes throughout, the running runtime bytes are unchanged, and per contract
  # a head differing only by documentation is the SAME SCOPE. Verdicts stand unaltered.
worktree_status_clean: true  # no tracked file modified by Veritas at any point; the only untracked additions are these two receipts

verdict: HOLD
receipt_sha256: (stated in Veritas's return)
reviewed_by: veritas
reviewed_date: 2026-08-10
next_review_trigger: A material change to the durable production state relevant to the next photograph
  (specifically: shop 14 leaving the active set), OR a raw capture of the new board from the real Bot API.
  **This readiness verdict names the state it rests on and EXPIRES when that state moves.**
---

## Scope reviewed

The accepted user journey exactly as stated in the dispatch. **Larry did not attempt to narrow it and I
did not accept a narrower slice.** The scope floor and ceiling are the accepted journey.

The dispatch's central question — *is Warwick now safe to send a fresh photograph?* — is answered under
§"Current readiness is NOT capability" against the state that exists **right now**, not against
capability.

## The anti-overclaim block — all six items, mandatory

**1. The exact next real event.** Warwick sends a fresh shopping-list photograph to the AsdAIr Telegram
chat.

**2. The measured production state relevant to that event** — measured by me through the read-only
`asdair-cockpit-api`, not assumed, not taken from the dispatch:

| Fact | Measured value |
|---|---|
| Runtime | PID 12204, `runtime.js --watch`, started **2026-08-10T20:40:57Z**, from the primary checkout at `fb58882` |
| Launch route | scheduled task `MyPKA-AsdAIr-Runtime`, last run 20:40:28Z, `LastTaskResult: 0` |
| Active (non-terminal) shops | **TWO** — id **7** `SHOP-2026-08-09` `READY_TO_SHOP`; id **14** `SHOP-2026-08-10-M64` `NEEDS_DECISION` |
| Open questions on shop 14 | **2**, and they are its **only** two questions — so their ordinals are **1 and 2** |
| `SHOP-2026-08-10` (id 11) | `CANCELLED` — **terminal** |
| Terminal junk shops M76/M77/M79/M82 | `CANCELLED` — all four out of the active set |
| `checklist_base_url` | tailnet URL present in the User environment |
| `listActiveShops` ordering | `WHERE status NOT IN ('RECONCILED','CANCELLED') … ORDER BY id ASC` |

**3. The production decision or path that will consume it.** `runOnce` → `loadOpenQuestions` (reads
BEFORE the fetch) → `pollIntake` → `receiveList` → `shopStore.createOrResumeShop`.

**4. State-dependent collision, rejection, resume and idempotency conditions.** Three, traced below.
Two are safely resolved; **one is not**.

**5. Has that exact event actually been executed?** **NO.** No photograph has been sent since the
20:40:57Z restart. I did not manufacture one, and I did not ask Warwick to send one.

**6. What evidence establishes that the CURRENT state will admit it correctly** — and where it does not.

## What will actually happen to his photograph — traced against measured state

**Hop 1 — is it eaten as an answer?** Shop 14 holds 2 open questions, so `openQuestions.length === 2`
and the claim path **is armed**. But `runtime.js:1724-1725` reads *"A photo is ALWAYS a list. Only text
can be an answer"* and returns false on `verdict.kind !== 'text'`. **The photograph is NOT claimed as an
answer to M64's open questions.** This was a genuine hazard created by preserving M64 with questions
open, and it is closed. ✅

**Hop 2 — does it die in a grave?** `nextShopRef('2026-08-10')` = `SHOP-2026-08-10`, which is held by
id 11, `CANCELLED`. Insert writes nothing → inbound key does not match (new message id) → ref matches
id 11 → **terminal** → `collisionShopRef` derives `SHOP-2026-08-10-M<msgid>` → fresh insert →
**a genuinely new live shop is created.** ✅

> **This is the important finding of this review, and it is positive.** The catastrophic failure of
> 2026-08-10 — photograph absorbed into a terminal row, offset advanced, list lost with no card — **will
> not recur from the state that exists right now.** I established that from measured current state and a
> traced path, not from tests, wiring or the fact that it worked later that day.

**Hop 3 — and this is where it stops being safe.**

The new shop enters the active set **alongside** shop 14. `loadOpenQuestions` iterates every active shop
and flattens their open questions into one array, assigning `ordinal` as the **per-shop** position
(`runtime.js:228`). `correlateTypedAnswer` then does, at line 464:

```js
const byOrdinal = new Map(open.map((q) => [q.ordinal, q]));
```

**`open` spans two shops; `ordinal` is per-shop; duplicate Map keys silently keep the last.** Shop 14
occupies ordinals **1 and 2**. The moment the new shop asks its own questions 1 and 2, those ordinals
exist twice, and `ORDER BY id ASC` means the **newer** shop wins them.

Consequences, in the order Warwick would meet them:

- A board reply `1: …` resolves to the **new** shop — correct by accident, because newest wins.
- Shop 14's questions 1 and 2 become **permanently unanswerable by number**, silently.
- A mixed reply such as `1: the big one` / `2: the sliced` **splits across two different shops** the
  moment the new shop has fewer questions than shop 14 at some position — the code logs
  `board_reply_correlated`, claims the update, and surfaces **no error**.

There is no user-visible signal for any of this. It is a **silent cross-shop misroute on exactly the
surface this phase promises**, live in the current state, on the exact next action.

**The hazard is created by a preservation decision, not by a code change.** Keeping `SHOP-2026-08-10-M64`
as evidence is right. Keeping it **ACTIVE with questions open** is what arms the collision. Those are
separable.

**Hop 4 — the list row, and this one I could not settle.** Migration 019 exists precisely so *"two shops
on one date can each own their own list"*, and it is **UNAPPLIED**. A new shop created today would be the
second shop on `2026-08-10` alongside shop 14. Whether the pre-019 uniqueness on `asdair.shopping_lists`
admits a second list for the same household and date is **NOT ESTABLISHED** — I could not execute against
the live store (credentials under `C:\.fusion247\**`, GL-012, no declared surface). That 019's own backfill
resolves *"the LIVE shop winning any shared row"* implies shared rows are a real condition, not a
theoretical one. **UNKNOWN on a load-bearing precondition of the next action ⇒ HOLD.**

## The interface — judged as Warwick receives it

**The eight-card surface that produced the last Gate 2 FAIL is durably captured** in
`Deliverables/2026-08-10-warwick-telegram-capture-m64.md` — his own verbatim paste. That is the only raw
capture of the real interface in existence for this journey.

**The board that replaces it has never met the real Telegram Bot API.** `editMessageText` is unproven
against Telegram. **No rendered artefact of the new board exists** — not in this repository, not in the
live store, nowhere I can read it.

My contract permits me to discharge this duty by reading rendered artefacts where they are durably
persisted. **I looked, and there are none for the replacement surface.** So the accepted journey's whole
"he can see what he has answered and what remains / READY_TO_SHOP only when he can tell nothing is
unresolved" limb rests on a surface for which **the only evidence available is backend correctness** —
which §"GATE 2 MUST INSPECT THE REAL HUMAN INTERFACE" forbids me from substituting.

**This is §Method 2a**: the property requires an actor who can produce the evidence. It is a **HOLD with
the limit named**, not a FAIL, and not a criticism of the implementation.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | The batch attacks the real journey failures Warwick hit, not adjacent work |
| Design fidelity | PASS | Fixes sit on the production path; nothing bolted alongside it |
| Functional proof | HOLD | Hops 1 and 2 proven against measured state. Hop 3 defective; hop 4 unknown |
| Integration | HOLD | The board integrates with the question spine in code; its integration with **Telegram** is unproven |
| Durability | PASS | Runtime restarts from a scheduled task on canonical bytes without Larry; `createOrResumeShop` idempotent on both natural keys |
| Test quality | PASS | Two independent mutations turned green suites red on named tests (Gate 1 receipt) |
| Git truth | PASS | Head remotely reachable; state as reported |
| Documentation truth | HOLD | The map does not record the cross-shop ordinal hazard, because nobody had found it |
| Residual risk | HOLD | Hop 4 is an unbounded unknown on the next action |
| Completed automation | PASS | The real production event invokes the runtime from the scheduled task, from a stable approved runtime, with no Larry step. Restart at 20:40:57Z proves it, and the task's own `LastTaskResult: 0` is observable |

## The question Larry asked: is Warwick safe to send a fresh photograph?

**Not yet — HOLD.** And because Larry asked for the specific consequence rather than a verdict, here is
exactly what would happen:

1. **His photograph would NOT be lost, and it WOULD create a new live shop.** The failure that nearly
   cost him his list this morning is genuinely fixed, and I established that from the state that exists
   now. He would get his acknowledgement.
2. **Then it would land in a two-active-shop state that the answer surface does not handle.** Once the
   new shop asks questions, the board's numbers are shared with `SHOP-2026-08-10-M64`, and a numbered
   reply can be recorded against **the wrong shop's question**, silently, with no error and no way for
   him to tell from the product. That is the same class of failure as this morning's — an answer going
   somewhere he cannot see — on the very surface built to fix it.
3. **And a step earlier than that is unmeasured**: whether the second shop on `2026-08-10` can acquire
   its own list row at all with migration 019 unapplied. If it cannot, the new shop stalls after
   acknowledgement, and he would be waiting for a plan that never arrives.

**The cheapest thing that changes this answer is not code.** Shop 14 leaving the active set removes
hazard 2 entirely and makes hazard 4 moot — one shop, one date, no shared ordinals. Preserving M64 as
evidence does not require it to remain active. **That disposition is Larry's to choose and Warwick's to
authorise; it is not mine to instruct**, and I raise no Work Order.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| G2-1 | **High** | **Cross-shop ordinal collision** (`runtime.js:228` per-shop `ordinal`; `:464` `new Map` over questions spanning all active shops). A numbered board reply can be recorded against another shop's question, silently, whenever two active shops hold open questions | **blocking** — it blocks the exact next action, *"Warwick sends a fresh photograph and answers the questions it raises"* | Larry |
| G2-2 | **High** | **The replacement board has never met the real Telegram Bot API**; `editMessageText` unproven and no rendered artefact of it exists. The accepted journey's "he can tell what remains" limb is unevidenced at the human surface | **blocking** — §Method 2a, discharge requires a raw capture or Warwick's recorded acceptance | Larry |
| G2-3 | Medium | **Unmeasured:** whether a second shop on one date can acquire its own `shopping_lists` row with migration 019 unapplied. Load-bearing on the next action; not established within my granted surface | **blocking** as an UNKNOWN on a load-bearing precondition | Larry |
| G2-4 | Low | Durable household learning (`promoteDecision`) remains built, tested and **deliberately unwired**. The accepted journey's *"become durable household knowledge"* limb has never run in production | non-blocking — already recorded on the map as known and queued | Larry |
| G2-5 | Low | Evidence limitation, not a product defect: the runtime log and intake offset file are under `C:\.fusion247\**`; GL-012 denies them and my dispatch declared no `private_surface`. I could not confirm the runtime is completing polling passes. A future dispatch declaring the exact surface closes this | non-blocking | Larry |

## Verdict

**HOLD** — the catastrophic list-loss failure is genuinely fixed and I proved it against current state;
but a numbered answer can still be silently misrouted between two active shops, the replacement board
has never been seen by a human through Telegram, and a load-bearing list-identity precondition is
unmeasured.

**This is not a FAIL.** Nothing here is a false completion claim, no accepted design is violated, and
Larry's own reporting was accurate throughout — he flagged three of these areas himself before I looked,
and his four scrutiny items were honest ones. The journey is closer than it has been. It is not yet safe
to hand back to Warwick.

**⚠️ THIS VERDICT NAMES THE STATE IT RESTS ON AND EXPIRES WHEN THAT STATE MOVES.** It rests on: two
active shops (7 and 14), shop 14 holding exactly 2 open questions at ordinals 1 and 2, `SHOP-2026-08-10`
terminal, and migration 019 unapplied. **Neither Larry nor I may quote this verdict forward once that
state changes.**

## Next review trigger

Shop 14 leaving the active set, or the ordinal collision being closed in code; **and** a raw capture of
the new board from the real Bot API. One focused confirmation of these blocking findings only — not a
re-run of Gate 1.
