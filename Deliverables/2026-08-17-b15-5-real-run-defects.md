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
