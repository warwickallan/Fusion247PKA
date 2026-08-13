# Mum's display names — the only rows Warwick needs to rule

**Warwick, 2026-08-13:** *"Do not make Warwick review all 109 display names. Show him only the … rows you
have flagged because they are sensitive, ambiguous or collide with another Regular… Treat every unflagged
proposed display name as approved by default."*

**So: 34 of the 55 are APPROVED BY DEFAULT and are not shown here.** They are the unambiguous ones —
Bananas, Bread, Tea bags, Coffee, Sugar, Toilet roll, Bleach, Paracetamol and the like. The full list
remains in `2026-08-13-mum-display-names-PROPOSAL.md` if he ever wants to look.

**⚠️ CORRECTION TO MY OWN COUNT: I wrote "fourteen rows" in the proposal's prose while the table actually
marked 21.** It is **21 rows in 11 decisions** — because a collision is one decision covering two or three
rows. The prose was wrong, not the table.

---

## THE 11 DECISIONS

### 1. Three Sure deodorants — rows 18, 25, 54
They differ only by variant. *"Deodorant"* three times is unusable.

| id | catalogue name | proposed |
|---|---|---|
| 18 | Sure Nonstop Protection **Sport Cool** Anti-Perspirant Aerosol 250 ml | **Deodorant — Sport** |
| 25 | Sure Nonstop Protection **Quantum Dry** Anti-Perspirant Aerosol 250 ml | **Deodorant — Quantum** |
| 54 | Sure Nonstop Protection **Invisible Pure** Anti-Perspirant Aerosol 250 ml | **Deodorant — Invisible** |

**Why you:** does she distinguish them at all, or is one of them simply *"deodorant"* and the others rarely
bought? If she does not think in variants, three near-identical rows are worse than one.

### 2. Three toffee products — rows 33, 49, 78
| id | catalogue name | proposed |
|---|---|---|
| 33 | ASDA **Dairy** Toffee 180g | **Dairy toffee** |
| 49 | ASDA Toffee **Assortment** 200g | **Toffee assortment** |
| 78 | ASDA Toffee **Cheesecakes** 2 x 100g | **Toffee cheesecakes** |

**Why you:** 78 is a dessert, not a sweet. If she calls it *"the cheesecakes"* the word "toffee" may only
confuse the three.

### 3. Two boxes of eggs — rows 27, 32
| id | catalogue name | proposed |
|---|---|---|
| 27 | ASDA **12** Free Range Large Eggs | **Eggs — box of 12** |
| 32 | ASDA Free Range **6** Large Eggs | **Eggs — box of 6** |

**Why you:** does she ever want the 6? If not, one row called **Eggs** is kinder than two.

### 4. Two Vanish products — rows 43, 62
| id | catalogue name | proposed |
|---|---|---|
| 43 | Vanish Gold Oxi Action Stain Remover **Powder** 450g | **Vanish powder** |
| 62 | Vanish **Pre-Treat Gel** | **Vanish gel** |

**Why you:** "powder" and "gel" is my distinction, not necessarily hers.

### 5. Two Febreze products — rows 30, 44
| id | catalogue name | proposed |
|---|---|---|
| 30 | Febreze **Fabric** Freshener Spray Lenor Spring Awakening | **Fabric freshener** |
| 44 | Febreze **Air** Freshener Sun-Kissed Vanilla | **Air freshener** |

**Why you:** genuinely different jobs, but "Febreze" may be the only word she uses for both.

### 6. Two beef slices — rows 80, 81
| id | catalogue name | proposed |
|---|---|---|
| 80 | ASDA **Sliced** Topside of Beef 90g | **Sliced beef** |
| 81 | Exceptional by ASDA **Roast** Topside of Beef 90g | **Roast beef** |

**Why you:** both are sliced topside at 90g. The difference may be invisible to her.

### 7. Two Batchelors sachets — rows 75, 77
| id | catalogue name | proposed |
|---|---|---|
| 75 | Batchelors Pasta 'n' Sauce **Mac 'n' Cheese** | **Macaroni cheese sachet** |
| 77 | Batchelors Pasta 'n' Sauce **Roast Chicken & Bacon** | **Chicken and bacon pasta sachet** |

**Why you:** the second is long. *"Chicken pasta"* may be what she says.

### 8. Two baked-bean products — rows 79, 63
| id | catalogue name | proposed |
|---|---|---|
| 79 | Heinz Tinned Baked Beans in Rich Tomato Sauce 6 x 200g | **Baked beans** |
| 63 | Heinz Baked Beans **& Richmond Pork Sausages** 200g | **Beans and sausages** |

**Why you:** confirm 63 is the beans-with-sausages tin and not something she'd also call "beans".

### 9. BOB milk — row 69
| id | catalogue name | proposed |
|---|---|---|
| 69 | Arla **BOB** Semi-Skimmed Milk 2L That Tastes Like Whole | **BOB milk** |

**Why you:** *"milk"* is already an alias on the Cravendale. If she says "milk" for this one too, they
collide — and this is the product the BOB ruling turns on, so it matters more than most.

### 10. Cat litter — row 31
| id | catalogue name | proposed |
|---|---|---|
| 31 | Smart Litter Wood Pellet Litter 10 Litres | **Cat litter** |

**Why you:** I guessed "cat". I do not actually know there is a cat.

### 11. ⛔ Row 51 — YOURS ALONE
| id | catalogue name | proposed |
|---|---|---|
| 51 | Always Discreet Incontinence Pads Women Normal 39 Count | **Pads** |

**Why you:** whatever she calls these. I have proposed the plainest word I can and I will not argue for it.
It is not a word for anyone else to choose, and it will appear on a screen she looks at every week.

---

## What happens the moment you rule these

1. The 34 default-approved names and your 11 rulings are written to a curated `display_name` column —
   **values from this file, never from a heuristic.**
2. **Vera's zero-fallback condition is re-run as an assertion, not a claim:** ZERO active regulars fall
   back to a retailer string. Her words: *"otherwise we have closed HIGH-4 with prose, which is precisely
   the thing MEDIUM-C existed to stop."*
3. Measured **against the live catalogue, not the committed fixture** — the fixture under-reported this by
   2.5×, which is how both Vera and Larry got the severity wrong first time.
