# AsdAIr — SHOP W/C 16 AUGUST 2026: the transcript, RECONCILED AGAINST THE PHOTOGRAPH

- **Date:** 2026-08-17
- **Why this exists:** the pipeline's own reading of Mum's list was wrong in ways that would have bought the wrong food. Warwick supplied the photograph directly and authorised one corrected attempt. This file is the corrected source, written down **before** anything is bought, so what went into the basket can be checked against it afterwards.
- **Status:** Larry's reading of the photograph. **This is a one-off recovery, not the weekly route.** The product is supposed to read the list itself through `FUSION_GATEWAY_URL`; a human standing in for that step is the defect, not the design. It is recorded as such so nobody later mistakes it for normal operation.

## What the pipeline got wrong — the reconciliation that was never run

| # | Mum's list (photograph) | What AsdAIr recorded | Effect if shopped |
|---|---|---|---|
| 14 | **2 sliced roast beef** | `2 skinny cow bars` — **an invented product** | The beef is missing entirely; a fiction is bought instead. Note the drift: *beef → cow*. `ASDA Sliced Topside of Beef 90g` is in regulars (id 80) and would have matched. |
| 16 | **1 x 5pk Heinz sausage & beans** | `1 x 6pk Heinz baked beans` — a **duplicate of line 15** | Two identical bean packs; **no sausage & beans at all**. |
| 8 | **2 x 4pk orange sport Lucozade** | `1 x 4pk` | Half the quantity. |
| 18 | **2 pks Ben & Jerry's cookie dough** | `1 x 4pk` | Wrong quantity and wrong pack description. |
| 19 | **1 x 4pk ASDA fruit lolly ices** | `1 pk fruit lolly ice` | "4pk" and the "ASDA" brand dropped — which is precisely why it then failed to match and became a question. |
| 31 | **1 TRESemme hair conditioner, blue label** | matched to `TRESemme Rich Moisture HAIR SHAMPOO` | Conditioner replaced by a second shampoo; the real shampoo line was then flagged a duplicate. **Two shampoos, no conditioner.** |

**Lines I could not read with certainty from the photograph, and did not guess:** the Gourmet cat food pack count, the Dreamies pack size, and how `CAT LITTER` / `GREEN LABEL` map onto the single "Smart litter" line AsdAIr produced. These are carried at the pipeline's reading and flagged for check at the shelf.

## The corrected list

Quantities are Mum's. Where a line maps to a known regular, that is named; where it does not, it is marked NEW and must be searched at ASDA, never substituted.

| # | Line | Disposition |
|---|---|---|
| 1 | 3 x 4pt Arla semi skimmed milk | regular — Cravendale/Arla filtered semi skimmed |
| 2 | 1 x 6pt ASDA semi skimmed milk | regular |
| 3 | 2 Warburtons white Danish | regular |
| 4 | 2 pulled pork (TGI Fridays) | regular |
| 5 | 1 McCain air fryer hash browns | regular |
| 6 | 3 Yazoo strawberry milk shakes | regular |
| 7 | 2 Yazoo chocolate milk shakes | regular |
| 8 | **2** x 4pk orange sport Lucozade | regular — **quantity corrected from 1** |
| 9 | 1 x 4pk raspberry sport Lucozade | regular |
| 10 | 1 Princes lean corned beef | regular |
| 11 | 2 Lurpak butter | regular |
| 12 | 3 chips with skins on | regular — ASDA crispy skin-on fries |
| 13 | 6 ASDA large free range eggs | regular **32** — `ASDA Free Range 6 Large Eggs`. Six, as written |
| 14 | **2 sliced roast beef** | regular **80** — `ASDA Sliced Topside of Beef 90g`. **Replaces the invented "skinny cow bars"** |
| 15 | 1 x 6pk Heinz baked beans | `Heinz Baked Beans in a Rich Tomato Sauce 6 x 415g` — Warwick named the size |
| 16 | **1 x 5pk Heinz sausage & beans** | distinct product — **restored**; was lost as a duplicate |
| 17 | Twix ice creams | regular 114 — `Twix Chocolate & Caramel Ice Cream 4pk` |
| 18 | **2 pks** Ben & Jerry's cookie dough | **NEW** — search ASDA, no substitute |
| 19 | **1 x 4pk ASDA fruit lolly ices** | **NEW to the mirror** — present in ASDA Favourites; take what the Favourites page holds |
| 20 | Gourmet Petit cat food | regular — pack count to check at shelf |
| 21 | Dreamies cheese biscuits | regular — pack size to check at shelf |
| 22 | Smart litter, green label | regular |
| 23 | 1 large Vanish, pink tub | regular |
| 24 | 1 Lenor fabric conditioner, Outdoorable | regular |
| 25 | 1 Febreze air freshener, vanilla | regular |
| 26 | 1 Loctite super glue | regular |
| 27 | 1 Walkers cheese & onion crisps | regular |
| 28 | 1 Sudocrem antiseptic healing cream | regular |
| 29 | 1 wet wipes — **wet body wipes for women** | **NEW** — Warwick's own words. **NOT cat food** |
| 30 | 2 Sure deodorant male | rules **23** (male → blue variant) + **32** (rotate off last week's variant) |
| 31 | **1 TRESemme hair CONDITIONER, blue label** | **corrected** — must not resolve to shampoo |
| 32 | 1 TRESemme shampoo | regular — a genuine second line, not a duplicate |
| 33 | 2 pkts ASDA plain toffees | regular **33** — `ASDA Dairy Toffee 180g` ("plain", as opposed to the Assortment) |
| 34 | 1 Canderel red label | regular |
| 35 | 1 Sweetex | regular **35** — `Sweetex Calorie Free Sweeteners 600 Tablets` |
| 36 | 2 ASDA paracetamol | regular |
| 37 | 1 Fairy Max | regular |

## The other fault, recorded because it is separate and worse

Warwick's nine typed answers were **mis-bound**. Two were never recorded at all ("New item" for Ben & Jerry's; "in favourites!! ffs" for the toffees), and every answer after each drop slid onto the next question — so Ben & Jerry's held the lolly answer, the lolly held the wet-wipes answer, the wet wipes held the deodorant answer, and the toffees held the Sweetex answer. Several lost their first character. Two questions were never answered at all.

`answerQuestion` is first-answer-wins by construction, so those four rows **cannot be corrected through the answer surface**. That is why the corrupted shop is abandoned rather than repaired.
