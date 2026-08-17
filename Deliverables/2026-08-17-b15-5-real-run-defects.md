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
