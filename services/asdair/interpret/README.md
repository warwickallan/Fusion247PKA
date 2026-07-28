# asdair/interpret — catalogue-grounded list interpretation

**This module exists because of a wrong conclusion, measured and corrected on 2026-07-28.**

## THE INVARIANT — catalogue grounding is mandatory, not an optimisation

> **Never interpret a shopping list without first loading the household's catalogue.**

AsdAIr's job has never been *"read arbitrary handwriting and invent a product name."* It is:

> *"Given THIS household's known products and aliases, identify which of them each handwritten mark most likely
> refers to."*

The regulars, aliases, ASDA product IDs, brands, categories, typical quantities, rules and the previous order are
**required INPUTS to reading the next list** — not merely outputs to update after a shop.

### The measurement that settled it

Same photo of Mum's handwritten list. Same model (`gpt-5.6-terra`). Same gateway. Only the grounding changed.

| Line | Open-ended (WRONG method) | Catalogue-grounded |
|---|---|---|
| Gourmet cat food | "gourmet **coffee**" | **"3 gourmet cat food"** |
| Dreamies cheese | "**camomile** cheese" | **"1 Dreamies cheese large"** |
| Weetabix Protein | "**beefs** protein" | **"1 Weetabix protein"** |
| Wall's sausage rolls | "**waffles** sausage rolls" | **"4 Walls sausage rolls"** |
| Arla 4pt | "ARLA **1 litre**" | **"3 semi skimmed Arla 4pts"** |
| Milky Way / Mars | "**pork pie large**" | **"1 pk small Mars bars"** |
| (nothing on the page) | invented *"bottle of fruit shoot"* | **invented nothing** |

Deterministic matching over those grounded readings then resolved **28 of 31 lines (90%)**, against a previously
measured **52%**. The three misses were honest: Stardrops (genuinely not stocked at ASDA), "fruit splits" (a real
new item), and "choc Yazoo" (a genuine alias gap, since closed through the governed learning path).

**The earlier verdict — "the vision model is unfit for this handwriting" — is withdrawn.** The measured defect was
missing catalogue context. Do not reintroduce that conclusion without re-running the grounded comparison.

Equally: **do not claim the model is simply accurate.** The catalogue is doing much of the useful work. The
product is the *combined* system.

## THE CYCLE — both arcs, or neither works

```
   confirmed shop  ──►  new items + aliases + product IDs written to asdair.regulars
          ▲                                    │
          │                                    ▼
   catalogue-grounded interpretation  ◄──  next week's list is read AGAINST that catalogue
```

These are two arcs of **one cycle**. Break the write-back arc and next week's read arc degrades against a stale
catalogue — which is exactly what happened: the 2026-07-27 shop learned three new items in-session and persisted
none of them, so the following interpretation had no idea they existed.

**It worked "automatically" during a session only because the session's own context was holding the catalogue.**
That is not durability, it is a coincidence with a short half-life. The whole of BUILD-015 exists to move that
context out of a session and into Postgres.

## THE AUTHORITY BOUNDARY

| Actor | Responsibility |
|---|---|
| **the model** | READS and RANKS — supplies `raw_reading` and candidate suggestions |
| **the catalogue** | **DETERMINES IDENTITY** — `resolveByCatalogue.js` maps a reading to a real `regulars.id` |
| **the human** | resolves genuine ambiguity |
| **confirmed outcomes** | ENRICH ALIASES for next week |

The model is **never asked to name a product**. It returns a candidate id and a raw reading; canonical names are
looked up from our own rows by id. A product that does not exist therefore cannot reach a basket, whatever a
model claims. If nothing genuinely fits, the answer is `unmatched_new_item` — never the least-bad catalogue item
chosen because the output schema has a field for one.

## NOTHING LIVES PERMANENTLY IN A SCRATCHPAD

Working files are fine *during* a shop. **When the basket is deemed checkout-ready, everything still living in a
scratchpad that matters must be made permanent** — the order, the new regulars, the aliases, the harvested ASDA
product IDs, the rotation history, the pending favourite actions. A shop that ends with knowledge in a temp
directory has taught the household nothing, and next week starts from zero again.

## Files

| File | |
|---|---|
| `loadCatalogue.js` | READ-ONLY load of the canonical household context; shapes a **compact** candidate list (no database prose at the model) |
| `groundedPrompt.js` | PURE. Builds the one-shot grounded vision request |
| `resolveByCatalogue.js` | PURE. **Identity.** Exact alias → exact name → contained alias → brand+variant overlap. Ambiguity becomes `needs_confirmation`, never a coin toss |
| `interpret-list.js` | Runtime caller. `--dry-run` loads the catalogue and prints the prompt without a model call |
| `catalogueGrounding.test.js` | The invariant regression suite — 13 tests |

```bash
node --env-file=<env> interpret-list.js --image <path> [--household 1] [--dry-run]
```

`FUSION_MODEL_VISION` selects the model; there is currently no `fusion.vision` alias bound on the gateway, so
point it at a concrete id. Never places an order, never checks out, never pays.
