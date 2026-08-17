# ASDA trolley reconciliation — SHOP-2026-08-19

- Work Order: **WO-2026-08-17-B15-BASKET**
- Run status: **completed** · generated 2026-08-17T21:20:57.867Z
- Frozen manifest: 37 lines, expected £120–£150

## Trolley, as read back off the page

- **Order total:** £132.52
- **Item count:** 55
- **Distinct products:** 35

## Substitutions control

- control found on the trolley page - its ticked/unticked state is NOT readable from page text and was NOT clicked
- **This executor never clicks that control, in either direction.** `guards.cjs` refuses it, and that was not weakened.

```
Showing 

1-2

 of 

2

 incomplete offer

View all

Your products

(35) products

Sort

Department name (most recent)

Allow Substitutions for all

Save trolley

Empty trolley

Pain Relief

1 Product

ASDA Paracetamol 500mg Capsules 16 Capsules

is£0.64

16PK, 4.0p/ea

Substitutes unavailable

Ice Cream & Ice Lollies

3 Products

ASDA Assorted Fruit Splits 
```

## Outcome by line

Added 2 · wrong quantity 0 · out of stock 0 · ambiguous 0 · failed 0 · not attempted 35

| # | Product (manifest) | Qty | Status | ASDA ref | In trolley | Discrepancy |
|---|---|---|---|---|---|---|
| 1 | Cravendale Arla Filtered Fresh Semi Skimmed Milk 2L | 3 | not_attempted | 489747 | yes | not attempted in this run |
| 2 | ASDA British Milk Semi Skimmed 6 Pints | 1 | not_attempted | 166556 | yes | not attempted in this run |
| 3 | Warburtons Danish Lighter White Bread 400g | 2 | not_attempted | 139863 | yes | not attempted in this run |
| 4 | TGI Fridays BBQ Pulled Pork 400g | 2 | not_attempted | — | no | not attempted in this run |
| 5 | McCain Air Fryer Hash Brown Bites 600g | 1 | not_attempted | 9297593 | yes | not attempted in this run |
| 6 | Yazoo Strawberry Milk Drink 400ml | 3 | not_attempted | 5277569 | yes | not attempted in this run |
| 7 | Yazoo Chocolate Milk Drink 400ml | 2 | not_attempted | 5277567 | yes | not attempted in this run |
| 8 | Lucozade Sport Drink Orange 4 x 500ml | 2 | not_attempted | 4801401 | yes | not attempted in this run |
| 9 | Lucozade Sport Drink Raspberry 4 x 500ml | 1 | not_attempted | 4801403 | yes | not attempted in this run |
| 10 | Princes Lean Corned Beef 200g | 1 | not_attempted | 391036 | yes | not attempted in this run |
| 11 | Lurpak Slightly Salted Butter 200g | 2 | not_attempted | 7731768 | yes | not attempted in this run |
| 12 | ASDA Crispy Skin-On Fries 750g | 3 | not_attempted | 6966614 | yes | not attempted in this run |
| 13 | ASDA Free Range 6 Large Eggs | 1 | not_attempted | — | no | not attempted in this run |
| 14 | Exceptional by ASDA Roast Topside of Beef 90g | 2 | not_attempted | — | no | not attempted in this run |
| 15 | Heinz Tinned Baked Beans in a Rich Tomato Sauce 6 x 415g | 1 | not_attempted | — | no | not attempted in this run |
| 16 | Heinz Baked Beans & Richmond Pork Sausages 200g | 5 | not_attempted | — | no | not attempted in this run |
| 17 | Twix Chocolate & Caramel Ice Cream 4pk | 2 | not_attempted | 7725445 | yes | not attempted in this run |
| 18 | Ben & Jerry's Cookie Dough ice cream tub | 1 | not_attempted | — | no | not attempted in this run |
| 19 | ASDA Assorted Fruit Splits Lollies 6 x 73ml (438ml) | 1 | added | 3675350 | yes | — |
| 20 | Gourmet Mon Petit Intense Cod, Sardine, Salmon Wet Cat Food 6x50g | 1 | not_attempted | 4996753 | yes | not attempted in this run |
| 21 | Dreamies Cat Treat Biscuits With Cheese Flavour 200g | 1 | not_attempted | 6325769 | yes | not attempted in this run |
| 22 | Smart Litter Wood Pellet Litter 10 Litres | 1 | not_attempted | 3104303 | yes | not attempted in this run |
| 23 | Vanish Oxi Action Laundry Stain Remover Powder 450g | 1 | not_attempted | 6016740 | yes | not attempted in this run |
| 24 | Lenor Outdoorable Spring Awakening Fabric Conditioner 86 Washes | 1 | not_attempted | 9230530 | yes | not attempted in this run |
| 25 | Febreze Air Freshener Sun-Kissed Vanilla 185ML | 1 | not_attempted | — | no | not attempted in this run |
| 26 | Loctite Super Glue Original 3g | 1 | not_attempted | 6755212 | yes | not attempted in this run |
| 27 | Walkers Cheese & Onion Multipack Crisps 6x25g | 1 | not_attempted | 5017321 | yes | not attempted in this run |
| 28 | Sudocrem Antiseptic Cream 125g | 1 | not_attempted | 6316368 | yes | not attempted in this run |
| 29 | Wet body wipes for women | 1 | not_attempted | — | no | not attempted in this run |
| 30 | Sure Nonstop Protection Quantum Dry Anti-Perspirant Aerosol 250 ml | 2 | not_attempted | — | no | not attempted in this run |
| 31 | TRESemme Rich Moisture HAIR CONDITIONER 680 ml | 1 | not_attempted | — | no | not attempted in this run |
| 32 | TRESemme Rich Moisture HAIR SHAMPOO 680 ml | 1 | not_attempted | — | no | not attempted in this run |
| 33 | ASDA Dairy Toffee 180g | 2 | not_attempted | — | no | not attempted in this run |
| 34 | Canderel Granular Low Calorie Sweetener 75g | 1 | not_attempted | — | no | not attempted in this run |
| 35 | Sweetex Calorie Free Sweeteners 600 Tablets | 1 | not_attempted | — | no | not attempted in this run |
| 36 | ASDA Paracetamol 500mg Capsules 16 Capsules | 2 | added | 7518379 | yes | — |
| 37 | Fairy Max Power Washing Up Liquid 545ML | 1 | not_attempted | 9227130 | yes | not attempted in this run |

## In the trolley, but not accounted for by any manifest line

- `9309045` — Febreze Air Freshener Spray Vanilla Butterscotch 185ML
- `7596507` — Ben & Jerry's Cool-Lection Cookie & Brownie Ice Cream Multipack 4 x 100ml
- `9397262` — ASDA 10 Smoked Back Bacon Rashers 310g
- `9132742` — TGI Fridays BBQ Pulled Pork 400g
- `7123692` — Wet Ones Be Gentle 12 Antibacterial Hand & Body Wipes Fragrance Free with Aloe
- `21173` — Canderel Granular Low Calorie Sweetener 75g
- `9108418` — ASDA Dairy Toffee 180g
- `7608842` — TRESemme Rich Moisture HAIR CONDITIONER 680 ml
- `7608834` — TRESemme Rich Moisture HAIR SHAMPOO 680 ml
- `9190635` — Heinz Baked Beans & Richmond Pork Sausages 200g
- `9125427` — Exceptional by ASDA Roast Topside of Beef 90g
- `166779` — ASDA Free Range 6 Large Eggs

## What this report is not

Builder self-test evidence — NOT independent review. Checkout was not entered; no payment, slot or substitution action was taken or is reachable from this executor.
