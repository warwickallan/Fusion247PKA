# B15-5 — the real weekly run, 2026-08-17. **Three attempts, two abandoned, three real defects found.**

**This is what sub-phase B15-5 existed to produce.** Recorded from the durable event trail and Warwick's
own cancellation notes — **not from chat, and not by Larry's inference.** No fix has been attempted.

**Attempts:** `SHOP-2026-08-17` (photo) → **CANCELLED** · `SHOP-2026-08-18` (text) → **CANCELLED** →
superseded by `SHOP-2026-08-19`.

## ⛔ DEFECT 1 — Terra INVENTED a product on the real run, and lost another

**Warwick's words, `shop_event` 118:** *"transcript materially wrong (invented product on line 14 —
**skinny cow bars for sliced roast beef**; line 16 duplicated so **Heinz sausage and beans was lost**)"*

**This is the invention class the whole vision programme was measured against — occurring on a real
weekly shop, not a fixture.** One product hallucinated, one silently dropped by a duplicated line.

## ⛔⛔ DEFECT 2 — THE ANSWERS BOUND TO THE WRONG QUESTIONS. This is the worst of the three.

**Warwick:** *"nine typed answers mis-bound, two never recorded."*

**Visible in the durable rows, and the shift is systematic:**

| asked | answered with |
|---|---|
| *"Which product is 1 x 4pk **Ben & Jerry's cookie dough**?"* | *"**Ice lollies** are in favourites. stupid question"* |
| *"Which product is 1 pk **fruit lolly ice**?"* | *"new item. **wet body wipes** for women"* |
| *"Which product is 1 **wet wipes**?"* | *"there is a rule about this"* |

**Each answer landed on the question ABOVE the one it answers.** He was answering correctly; the system
recorded him answering the wrong thing.

## ⛔ DEFECT 3 — a SAFETY property became a TRAP

**Warwick:** *"`answerQuestion` is **first-answer-wins** so **four rows cannot be corrected**."*

**First-answer-wins exists so a later answer can never silently overwrite an earlier one.** That is a good
rule. **But when the binding is wrong, it permanently locks the wrong answer in** — and the only remaining
route was to abandon the whole shop. *A control that prevents one failure mode and makes another
unrecoverable needs the second case designed, not discovered.*

## What the answers also say about the QUESTIONS

Three answers are complaints about being asked at all — *"Ice lollies are in favourites. stupid
question"*, *"n favourites FFS stupid question"*, *"there is a rule about this"*. **The system asked
Warwick things his own favourites and rules already answer.** Separate from the binding defect, and
cheaper to fix.

## Status

**NOTHING FIXED. NOTHING DISPATCHED.** Warwick is driving the run himself and is on the third attempt.
**Recorded so the evidence survives the session** — the disposition is his.

---

# ⭐ ATTEMPT 3 SUCCEEDED — `SHOP-2026-08-19` reached the freeze point

**The ingestion half of B15-5's acceptance spine is PROVEN on a real weekly shop.**

```
SHOP-2026-08-19 · id 35 · source: text · READY_TO_SHOP / READY_FOR_WARWICK
18:45:38 created → 18:50 questions answered → 18:51 "re-planning with the answers in place"
18:52:37 PROCESSING → READY_TO_SHOP  "every line is resolved"
18:53:47 "browser build requested"            ← Warwick, one minute later
```

| | |
|---|---|
| shop lines | **37, every one resolved** |
| questions | **9 of 9 answered** |
| **the binding** | **CORRECT this time** — *"Sweetex"* → `Sweetex Calorie Free Sweeteners 600 Tablets`, *"toffee"* → `ASDA Dairy Toffee 180g` |

**Against the B15-5 acceptance spine:** real chosen input → grounded shopping truth → amendments permitted
→ **questions handled by Warwick through his existing process** → durable real shop → **browser/CDP
handoff, the freeze point. ALL REACHED.** What remains is the basket workflow beyond the handoff.

## ⚠️ What this does and does NOT settle about the three defects above

- **Defect 2 (mis-bound answers) did NOT recur** — 9 of 9 bound correctly. **But attempt 3 was `text` and
  the failure was on `photo`.** *Not the same path. This is not a fix and must not be recorded as one.*
- **Defect 1 (Terra invention) was NOT exercised at all** — a text list involves no vision reading.
- **Defect 3 (first-answer-wins as a trap) was not reached**, because nothing needed correcting.

> **The honest reading: the TEXT door completed the journey. The PHOTO door failed on a real shop and
> its three defects remain entirely open.** Warwick reached a working weekly shop by changing door, which
> is a legitimate route to a shop and is **not** evidence that the photo path works.

---

# ⭐⭐ 2026-08-18 — THE PHOTO PATH RE-RAN AND DID NOT REPRODUCE THE DEFECTS. **The invention is INTERMITTENT.**

`SHOP-2026-08-18-M128` · id 37 · **photo, arrived via Telegram** · 37 lines · **0 duplicate readings**.

**Read against the two known failures, on what is evidently the same list:**

| | 2026-08-17 (abandoned) | 2026-08-18 |
|---|---|---|
| line 14 | **"2 skinny cow bars"** — **INVENTED**, the item was sliced roast beef | **"2 sliced roast beef"** — **CORRECT** |
| line 16 | **duplicated**, so *Heinz sausage and beans* was **lost** | `1 x 6pk Heinz baked beans` **and** `1 x 5pk Heinz sausages & beans` — **both present, both distinct** |
| duplicate readings | present | **ZERO** |
| lines | — | **37** (same count as the successful text run) |

## ⛔ WHY THIS IS NOT "FIXED", AND MUST NEVER BE WRITTEN UP AS FIXED

**Nothing was changed between the two runs.** No code, no prompt, no model, no configuration. **The same
door, on the same list, produced a materially wrong transcript once and a correct one the next day.**

> **That makes the invention INTERMITTENT, not resolved — and intermittent is the harder finding.** A
> deterministic fault announces itself on every run. This one passes, and passes, and then silently
> substitutes one product for another and drops a third.
>
> **A single clean run is therefore NOT evidence the defect is gone. It is evidence the defect is not
> constant** — which is what "2-of-3 is corroboration, not verification" already says on this build.

**The practical consequence for a weekly shop:** the failure mode is a **wrong item bought and a needed
item missing**, with nothing on screen saying so. **It is only catchable by a human comparing the
transcript against the photograph** — which is exactly what Warwick did on the 17th, and why that shop was
abandoned rather than shipped.

## State at this point

**6 lines unmatched → 6 questions incoming.** The **answer-binding defect (Defect 2) has NOT yet been
re-exercised** — it only appears when the answers are submitted. **That is the next thing worth watching,
and it is the one that cost the 17th its shop.**
