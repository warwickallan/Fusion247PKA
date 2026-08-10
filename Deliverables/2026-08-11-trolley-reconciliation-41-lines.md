---
title: The 2026-08-11 trolley, itemised — the evidence behind "41/41 correct"
date: 2026-08-11
author: Larry
build: BUILD-015 AsdAIr
status: evidence record of a MANUAL RESCUE. Not acceptance, not a pipeline output.
---

# The trolley, line by line

**Written because the claim "41 of 41 correct" previously existed only as a total.** The cold-start
reader flagged that as a defect and it was right: the reconciliation that is the sole evidence for
this session's one good outcome was living in a session transcript and in the live ASDA basket, and
nowhere durable. Root `CLAUDE.md` § "Nothing may live only in Larry's head" names exactly that.

**Read from the live trolley's own quantity controls** (`Decrease <product> quantity` → adjacent
`input[type=number]`), never inferred from price — multibuys distort price, per SOP-021 § 5.

**Totals: 41 distinct products · 58 units · £140.97.** No slot booked. Not checked out. Nothing paid.

| # | Product as it appears in the ASDA trolley | Qty |
|---|---|---|
| 1 | ASDA British Milk Semi Skimmed 6 Pints | 1 |
| 2 | Cravendale Arla Filtered Fresh Semi Skimmed Milk 2L Fresher for Longer | 4 |
| 3 | Warburtons Danish Lighter White Bread 400g | 1 |
| 4 | ASDA Crispy Skin-On Fries 750g | 2 |
| 5 | Exceptional by ASDA Creamy Mashed Potato 400g | 1 |
| 6 | Exceptional by ASDA Roast Topside of Beef 90g | 1 |
| 7 | ASDA Sliced Ham on the Bone 400g | 1 |
| 8 | Richmond 12 Skinless Pork Sausages 319g | 1 |
| 9 | Weetabix Protein 24 pack cereal | 1 |
| 10 | Rustlers All Day Breakfast Sausage Muffin 155g | 2 |
| 11 | Batchelors Pasta 'n' Sauce Cheese, Leek & Ham Flavour Pasta Sachet 99g | 4 |
| 12 | Batchelors Pasta 'n' Sauce Mac 'n' Cheese Pasta Sachet 99g | 1 |
| 13 | Princes Lean Corned Beef 200g | 1 |
| 14 | Lurpak Slightly Salted Butter 200g | 1 |
| 15 | ASDA British Double Gloucester 400g | 1 |
| 16 | ASDA 4 Beef Quarter Pounders 454g | 1 |
| 17 | Yazoo Strawberry Milk Drink 400ml | 3 |
| 18 | Yazoo Chocolate Milk Drink 400ml | 2 |
| 19 | Lucozade Sport Drink Orange 4 x 500ml | 2 |
| 20 | Always Discreet Incontinence Pads Women Normal 39 Count | 1 |
| 21 | ASDA Dairy Toffee 180g | 1 |
| 22 | ASDA Shortbread Fingers 210g | 2 |
| 23 | Walkers Cheese & Onion Multipack Crisps 6x25g | 1 |
| 24 | Twix Chocolate & Caramel Ice Cream 4pk | 2 |
| 25 | Twix Multipack Chocolate Biscuit & Caramel Bars 9x20g | 1 |
| 26 | The BAKERY at ASDA Sultana & Cherry Cake | 1 |
| 27 | ASDA Paracetamol 500mg Capsules 16 Capsules | 2 |
| 28 | ASDA Allergy & Hayfever Relief 30 Tablets | 1 |
| 29 | ASDA Assorted Fruit Splits Lollies 6 x 73ml (438ml) | 1 |
| 30 | Febreze Fabric Freshener Spray Lenor Spring Awakening 385ML | 1 |
| 31 | Dettol Antibacterial All in One Disinfectant Spray Orchard Blossom 300ml | 1 |
| 32 | Kleenex Original Tissues - Twin Pack | 1 |
| 33 | Febreze Air Freshener Spray Vanilla Butterscotch 185ML | 1 |
| 34 | Vanish Gold Oxi Action Stain Remover Powder for clothes 450g | 1 |
| 35 | Vanish Pre-Treat Gel | 1 |
| 36 | Lenor Outdoorable Spring Awakening Fabric Conditioner 86 Washes | 1 |
| 37 | Calgon washing machine cleaner tablets limescale protection 15 tablets | 1 |
| 38 | Loctite Super Glue Original 3g | 1 |
| 39 | Gourmet GOURMET Mon Petit Intense Cod, Sardine, Salmon Wet Cat Food 6x50g | 3 |
| 40 | Dreamies DREAMIES Cat Treat Biscuits With Cheese Flavour 200g | 1 |
| 41 | Ariel 4in1 PODS®, Washing Capsules 33 | 1 |

**Sum of quantities = 58.** Diff executed programmatically against the intended list derived from the
photograph: **41 correct product and quantity · 0 missing · 0 wrong quantity · 0 unexpected extras.**

## The arithmetic, reconciled — the cold-start reader could not make it add up

The apparent contradiction (23 − 10 − 1 + ~20 ≠ 41) resolves as follows, and the "~20" was the loose
figure:

| Step | Distinct products |
|---|---|
| False trolley as first built from the pipeline's derived list | **23** |
| − products removed as not on the photograph (Mars, TRESemme ×2, Andrex, Wall's sausage rolls, Smart Litter, Viakal, Lucozade Raspberry, Hovis, Birds Eye Classic Beef Burgers) | −10 → **13** |
| + first Regulars batch (14 products) | +14 → **27** |
| + second Regulars batch: Mac 'n' Cheese, Vanish Gold Oxi, Vanish Pre-Treat Gel, Sultana & Cherry Cake | +4 → **31** |
| + searched: Richmond, Twix Ice Cream, Twix Biscuit Bars, Calgon, Loctite | +5 → **36** |
| + third Regulars batch: Febreze Vanilla Butterscotch (Bloo failed — out of stock) | +1 → **37** |
| + Warwick's late decisions: ASDA Sliced Ham on the Bone, ASDA 4 Beef Quarter Pounders, Dettol Orchard Blossom, Dettol Crisp Linen (duplicate) | +4 → **41** |
| + ASDA British Milk Semi Skimmed 6 Pints (Warwick caught this omission) | +1 → **42** |
| − duplicate Dettol Crisp Linen removed after trolley read-back showed the "failed" add had landed | −1 → **41** |

**41.** One photograph line can yield more than one product, and several photograph lines yielded
none (Bloo, and the crossed-out line).

## Why "38–40 photograph lines" and "41 products" are both right

The photograph carries roughly 38–40 handwritten lines. Two lines resolve to two products each in the
household's catalogue (the Batchelors pasta entries), several list-lines carry multi-unit quantities
rather than multiple products, and **Bloo is deliberately absent**. The counts are not the same kind
of number and should not be expected to match.

## Deliberately absent, and why

- **Bloo toilet rim ×2** — Warwick's regular, Bloo **Spa Moments Vitality**, returned no purchasable
  result (out of stock). Per SOP-021 the action is **drop and flag, never swap the scent or variant**.
  Warwick's explicit instruction: *"bloo - skip this week"*.
- **The crossed-out line** on the photograph — not ordered.

## Judgement calls made by Larry, NOT settled by Warwick

1. **Loctite Super Glue Original 3g** — the plain literal match; ASDA also stocks Control, Precision,
   Power Gel, XXL and Mini Trio variants.
2. **Febreze Air Freshener Spray Vanilla Butterscotch 185ML** — this is what his *ASDA Regulars* hold;
   the AsdAIr catalogue row says "Febreze Sun-Kissed Vanilla 185ML". The two disagree.
3. **Vanish Gold Oxi Action** — taken from Warwick's own recorded answer ("Vanish Oxi Gold") although
   the photograph appears to read "VANISH OXI PINK". His answer was preferred over Larry's reading of
   the handwriting.
4. **ASDA Sliced Ham on the Bone 400g** — ASDA also stocks a 120g "Cured Ham on the Bone"; the 400g
   is the unqualified name match.

## ⚠️ TWO SOP-021 § 5 STEPS WERE NOT PERFORMED — verify before Warwick orders

SOP-021 § 5 requires, as the last actions before hand-back:

1. **Untick "Allow substitutions for all"** and set per-item substitution flags deliberately. **This
   was NOT done.** The trolley screenshot shows *"Allow Substitutions for all"* **ticked**, and every
   line shows *"Allow substitutes"*. **Standing rule 6 is "never auto-substitute"** — leaving that
   toggle on invites ASDA to substitute at pick time. Under the supervised-Sonnet adapter there is
   **no mechanical enforcement** of this; it is instruction and supervision only.
2. **Write an `asdair.orders` row via `recordShopOutcome.js`.** **This was NOT done.** The only
   database writes from the rescue were to `asdair.regulars`.

**Neither omission affects what is in the basket. Both should be closed before Warwick checks out**,
and the substitution toggle is the one that could change what actually arrives.

## What this record is NOT

**Not acceptance. Not a pipeline output. Not evidence that durable learning works.** This trolley was
assembled by hand from Warwick's photograph **because the pipeline's derived list was false** — see
`Deliverables/2026-08-11-BLOCKER-input-truth-failure.md`.
