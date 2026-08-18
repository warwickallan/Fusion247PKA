# Five of the seven questions should never have reached Warwick

**From the joined production run, `SHOP-2026-08-18-M128`, 2026-08-18.** Warwick's words on seeing the
card: *"Asdair is supposed to be dealing with this shit… not me. He can't be, there is no way these
suggestions came from something intelligent or something that has read the rules."*

**He is right, and this is the larger finding of the run** — larger than the candidate-quality bug
already dispatched as WP-B15-54, and **not covered by it**.

## The seven, judged against the household's own catalogue, rules and Favourites

| # | Question | State in the DB | Should it have been asked? |
|---|---|---|---|
| 1 | `2 sliced roast beef` | line 14, **matched, confidence 0.99**, `needs_confirmation` | **NO — already matched.** `ASDA Sliced Topside of Beef 90g` (regular 80) is its own top candidate. |
| 2 | `Heinz Tinned Baked Beans in a Rich Tomato Sauce 6 x 415g` | line 15, **matched, confidence 0.99** | **NO — and it is the strangest of the seven.** It asks Warwick to identify a product *by quoting that product's own full catalogue name back at him*, with no candidates offered. |
| 3 | `1 x 4pk Ben & Jerrys cookie dough` | `unmatched_new_item` | **YES.** Genuinely new; the ground truth says search ASDA, no substitute. The *candidates* were rubbish, but the question is legitimate. |
| 4 | `1 pk. ASDA fruit lolly ices` | `unmatched_new_item` | **NO.** The corrected transcript records it as *present in ASDA Favourites — take what the Favourites page holds.* |
| 5 | `1 wet wipes` | `unmatched_new_item` | **NO.** Warwick's own answer on 17 August was *"there is a rule about this"*. A rule exists and did not reach the decision point. |
| 6 | `2 Sure deoderent male` | `unmatched_new_item` | **YES.** Four plausible Sure variants, genuine ambiguity, and the one case where candidates were sensible. |
| 7 | `2 pkts ASDA plain toffees` | `unmatched_new_item` | **NO.** Warwick on 17 August: *"n favourites FFS stupid question."* |

**Two of seven are legitimate. Five are not.**

## Why this is a different defect from WP-B15-54

WP-B15-54 fixes **what is offered** once a question is asked — the low-information token bug where
`asda` matched the alphabetical head of the catalogue, `wet` matched cat food and `4pk` matched Twix.
Its AC5 also asks why an already-matched line is questioned, which covers rows 1 and 2.

**It does not touch rows 4, 5 and 7**, and those share a single cause: **the household's own
Favourites and rules are not consulted before a line is declared unresolved.** This is the exact
complaint of 17 August — three of the nine answers that day were protests that the question should
never have been asked — and it has recurred unchanged on the next real run.

## The rule this violates, already written and already binding

> **Rules must reach the DECISION POINT — a rule in Git or Supabase that the runtime does not consume
> is FAIL.** (Wayfinder §12, standing constraints.)

A rule that exists, is correct, and is never read is indistinguishable from a rule that was never
written. **Warwick is the one who notices, which is the failure.**

## Status

**RECORDED, NOT DISPATCHED.** WP-B15-54 is live in `C:/Fusion247PKA-planner` and touches neighbouring
code. A second writer in the same files is corruption, so this waits for that branch to land. It is
**not parked** — it is a North-Star gap and it belongs before Veritas, with the Cockpit
control-surface parity and the migration-017 grant question.
