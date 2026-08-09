# `substitutes_allowed` archaeology — where the 9-of-36 record lives, and what it actually is

**Pax · 2026-08-09 · governance head `d907350` · READ-ONLY (no source edited, no live data touched, no Work Package raised)**

---

## Executive summary

The historical "9 of 36 products have Allow substitutes ticked ON" record lives in **exactly one
original**: the Google Drive doc *"Asda - Order History"*, single entry **Week of 2026-07-06**, final
notes bullet. Everything in this repo is a staged copy of that one original.

**It is a PLATFORM OBSERVATION, not a household decision.** Confidence: **High**. The bullet is
written as an *audit* — a count of what ASDA's UI had ticked at the end of the run — and it has no
counterpart in the Decisions Log, contradicts the household's own standing rule 6, and the same
entry independently records that ASDA-side list state is not household intent (the BOB case).

**Therefore the live `substitutes_allowed = false` across all 103 regulars is NOT a continuity
loss.** No household substitution preference was ever expressed, so none was lost. `false` is the
schema default *and* the only value consistent with live rules 6 and 35.

**Nothing is escalated to Warwick.** No qualifying product choice exists: there is no household
intent to transfer, so the two genuine semantic conflicts found (below) are moot rather than
decisions.

---

## 1. Where the record physically lives

| Location | Form | Status |
|---|---|---|
| Drive doc `1cw9jvB79ZGrCxbG2-gTIKFc2FE1OZAMwBeB1rDVVlCA`, *"Asda - Order History"*, entry "Week of 2026-07-06", last-but-one notes bullet | **ORIGINAL.** All nine named | The only primary source |
| `<scratchpad>/pax-browser-audit/02-durable-instruction-docs.md` line 164 | Verbatim staged copy, all nine named | Larry-fetched 2026-08-09 |
| `Deliverables/2026-08-08-old-brain-asdair-corpus-staged.md` line 99 | Summarised ("9 of 36 ticked ON (named); other 27 off") — **names not enumerated** | Larry-staged 2026-08-08 |
| `Deliverables/2026-08-08-pax-old-brain-continuity-audit.md` lines 49, 193–195, 232–234 | Cited, and logged as open fetch **F6** | My own prior audit |

**Single-source flag (explicit).** The two repo copies are not independent corroboration — both
derive from the same Drive doc, fetched by the same route. The 9-of-36 claim rests on **one
document, one entry, one bullet, never re-observed**. That is adequate for archaeology and
inadequate as a basis for writing data.

The Order History contains **one entry only**. There is no second week to cross-check the audit
against, and no later entry re-states it.

---

## 2. Provenance — observation, not intent (the load-bearing finding)

Five converging lines, from three independent document families (Drive corpus · live DB extract ·
repo SOPs/schema):

**(a) The bullet's own form.** *"Allow substitutes audit: 9 of 36 products have 'Allow substitutes'
ticked on … The other 27 products all have substitutes switched off."* That is a **count of observed
UI state**. It records no question, no answer, and no forward applicability.

**(b) Wrong document, wrong template.** The household's decision format is the **Decisions Log**
entry template — `Question / Answer / Applies going forward (yes/no)`. Every genuine standing rule
in the old brain used it (quantities, Cravendale-not-BOB, Yazoo-never-Banana, Sure blue/white,
Aquafresh, Azera-on-offer). This bullet sits in **Order History**, the run record, whose declared
purpose is *"a running record of each week's basket"*. None of the twenty enumerated standing rules
mentions per-item substitutes.

**(c) It contradicts the household's actual policy.** Standing rule, restated in three old-brain
documents and live today as **rule 6**: *"Out-of-stock items get alternatives suggested, **never**
auto-substituted."* Live **rule 35** goes further — the trolley-level *"Allow substitutions for all"*
checkbox is a mandatory second-to-last unticking step. Nine items silently allowing substitution is
not a household position; it is the condition rules 6 and 35 exist to correct.

**(d) The BOB precedent, in the same entry.** The identical bullet list records: *"BOB is not in
Favourites (unfavourited already) and 'Regulars' has no manual remove option (it's auto-generated
from order history)."* The old brain **already knew** ASDA-side state is stale platform evidence
rather than household intent. Applying that same distinction to the substitutes checkboxes is not a
new inference — it is the old brain's own reasoning, applied consistently.

**(e) The mechanism, independently corroborated three weeks later.**
`Team Knowledge/SOPs/SOP-021a-asdair-live-execution-method.md` §4: *"On 2026-08-03 the finished
basket had ASDA's 'Allow substitutions for all' toggle ON, which violates standing rule 6."* Nobody
chose that. **ASDA turns substitution on by itself.** A basket ending with substitute flags set that
no human set is exactly the phenomenon the 2026-07-06 audit counted.

**Why 9 and not 36.** Unestablished, and it does not need to be. Per-item flags on ASDA carry from
prior orders and product-level defaults, so a mixed count is expected. What matters is that **not
one of the nine is attributed, anywhere in the corpus, to a household instruction.**

**Fact vs opinion, stated separately.** *Fact:* the bullet is an audit, sits in the run record, has
no Decisions Log counterpart, and contradicts rule 6; ASDA was independently observed setting the
toggle unaided. *Pax's judgement:* those facts make household-decision provenance not merely
unproven but implausible.

---

## 3. Mapping the nine onto current regular ids

Recorded for completeness. **Given §2 it is moot** — there is nothing to transfer.

| # | Historical name | Current regular | Verdict |
|---|---|---|---|
| 1 | Frank's 6-pint milk | id **2** — ASDA British Milk Semi Skimmed 6 Pints | **Unambiguous** |
| 2 | Cravendale Arla Milk | id **4** — Cravendale Arla Filtered Fresh Semi Skimmed 2L | **Unambiguous** |
| 3 | Yazoo Chocolate | id **15** — Yazoo Chocolate Milk Drink 400ml | **Unambiguous** |
| 4 | Yazoo Strawberry | id **59** — Yazoo Strawberry Milk Drink 400ml | **Unambiguous** |
| 5 | Nescafe Azera Coffee | none found | **Not present in available evidence** |
| 6 | Aquafresh Toothpaste | family, not a product | **Ambiguous** |
| 7 | Lenor Fabric Conditioner | none found | **Not present in available evidence** |
| 8 | Sure Men's (Sport Cool) | family, not a product | **Ambiguous + semantic conflict** |
| 9 | Sure Women's (Bright Bouquet) | family, not a product | **Ambiguous + semantic conflict** |

Evidence and caveats:

- Ids 2/4/15/59 are live rows, from `Deliverables/2026-08-08-live-db-extract-staged.md` §TRACE.
- **Azera:** shop-6 line 4, `raw_reading:"bottle Azera coffee"`, resolved
  `matched_regular_id:null`, `status:"unmatched_new_item"` (live extract §SHOP 6 LINES). No Azera
  regular appears in any staged extract.
- **Lenor:** zero occurrences of the string "Lenor" anywhere in the repo. The only trace is
  `previously_ordered` key `"lenor outdoor"` (3 orders) — an order-history key, not a catalogue row.
- ⚠️ **Trap, recorded so nobody falls in it.** `services/asdair/skill/ruleConsumption.test.js`
  contains rows id 90 *"Nescafe Azera Barista Style 100g"*, id 91/92 *"Sure Men …"*. These are
  **test fixtures, not live data** — live id 90 is *"Minced beef hotpot"*. Do not read them as a
  catalogue.
- **Aquafresh:** ambiguous by construction. The same historical entry records the requested size did
  not exist at ASDA; live rule 15 maps *"Toothpaste"* → *"Aquafresh, cheapest size available"* — a
  family. No single id is derivable.
- **Sure ×2 — the genuine semantic conflict.** The historical audit names **specific scents**
  (Sport Cool, Bright Bouquet). Current rules 13/23/24 say male = **any** blue variant, female =
  **any** white variant, *"not scent-specific"*, and rule **32** requires **rotating** the male
  variant weekly. A scent-pinned record is the exact thing current policy rejects. Under my brief
  this would qualify for escalation — **it does not, because the record was never a household
  decision.** Nothing is being lost by declining to transfer it.

**Access limitation, stated plainly:** I had no live DB access (read-only, no MCP). "Not present"
above means *not present in the repo's staged catalogue evidence*, and per my own standing rule that
a negative claim requires established absence, it is **not** a claim about the live 103 rows. One
query settles it — and given §2, that query buys nothing.

---

## 4. Consequence

1. **Close F6.** The open question from `2026-08-08-pax-old-brain-continuity-audit.md` is answered:
   `substitutes_allowed` did not lose old-brain knowledge, because there was none to lose.
2. **Do not restore the nine.** Writing them would put **platform residue into a
   household-intent column**, and would contradict live rules 6 and 35. That is the anti-pattern
   here, and it is a plausible-looking one — the phrase "the old knowledge was flattened" invites
   exactly this.
3. **`false` is currently correct**, and correct for the right reason. Schema
   (`004_asdair_regulars.sql:56–60, 80`): the column *"records the household's standing preference"*
   and *"never authorises the agent to substitute on its own"*, `not null default false`.
4. **Non-blocking observation, park it.** Because the column is `not null default false`, an unset
   default and a deliberate "no" are indistinguishable, and `readRules.js:206` /
   `readPacket.js:144` render it to the Cockpit as a flat *"no"* — i.e. as though the household had
   decided. Cosmetic today (every row is `false`); it would matter the first time Warwick genuinely
   sets one. Record once, do not act.

---

## Methodology

Staged Drive corpus first (`02-durable-instruction-docs.md`, the commissioned starting point), then
repo-wide grep for `Allow substitutes|allow_substitutes|substitutes_allowed|9 of 36` (48 files),
then the three prior deliverables that cite it, then schema and SQL grants for column semantics,
then `2026-08-08-live-db-extract-staged.md` for live catalogue/rules/shop-line evidence, then
SOP-021/021a for the live-execution counterpart. Provenance was tested by asking what *kind* of
document the claim sits in and whether the household's own decision format was used — not by asking
whether the claim is true.

## Limitations

- Single ultimate source for the 9-of-36 record; no second observation exists anywhere.
- No live DB access: mapping verdicts 5 and 7 are "not present in repo evidence", not "absent live".
- Why the count was 9 rather than 36 is unestablished and was not pursued.
- Whether a Lenor / Azera / Sure / Aquafresh row exists among the 103 is unresolved here.

## Escalation

**None.** No qualifying product decision was found. Provenance is platform-observation, so there is
no household intent to guess at, no record that cannot be safely transferred, and the two semantic
conflicts (Sure scents vs rules 13/23/24/32) resolve automatically once the record is recognised as
ASDA's state rather than the household's.
