# Why Terra still invents lines — the mechanism, from our own captured runs

**Work Order:** WO-2026-08-13-08 (WP-B15-43), LANE E
**Branch:** `build-015/b15-38-terra-invention-analysis` · worktree `C:/Fusion247PKA-terra` · cut from `df18e64`
**Governance head:** `42b4514` on main
**Evidence base:** `services/asdair/pipeline/agenticVisionPrototype/runs/` (frozen run captures), `fixtures/photo39.fixture.json`, `services/asdair/pipeline/finalise/out/`
**Method:** analysis of already-captured files only. **No model API call was made.** No model comparison. No prompt change proposed.

---

## THE ANSWER, IN PLAIN ENGLISH

Terra is not inventing freely. It is **filling a gap with the most plausible thing you already buy.**

Every band we send it is a tall, narrow strip of the photograph. Because the strips must overlap so no line falls down a crack, **each strip is cut through real handwriting at its top and bottom edge.** At those cut edges a line is half-visible — a few strokes, a clipped word.

When Terra can read the clipped line, it reports it and nothing goes wrong. **When it cannot, it does not leave the space empty. It reaches into the candidate list we handed it — your own regulars and favourites — and writes down the nearest neighbour by category.**

The evidence for that is not a theory. It is a switch, and it flips cleanly:

- In band 2 the clipped line is **`1 LENOR OUTDOOR`** — Lenor Outdoorable **Fabric Conditioner**.
  In **6 runs out of 6**, when Terra read Lenor, there was no phantom. When it failed to read Lenor, a phantom **`TRESemme conditioner`** appeared in its place — the only other **conditioner** in your 109-item catalogue. Never both. Never neither.
- In band 7 the neighbouring real line is **`16 Richmond SKINLESS PORK SAUSAGES`**.
  The phantom that appears there is **`WALLS SAUSAGE ROLLS`** — Wall's 4 **Pork Sausage** Rolls. 5 runs out of 6.
- In band 5 of the final runs, the phantom **`1 TROP. SMOOTH ORANGE`** appeared in **exactly the one run of three** where the neighbouring milkshake line degraded from `YAZOO STRAWBERRY MILK SHAKE` to a brand-less `STRAWBERRY MILK SHAKE`.

So the mechanism is: **a degraded reading at a band edge, plus a closed list of things you genuinely buy, equals a confident wrong line.** The closed enum stopped Terra inventing brands you have never heard of. It did not stop it inventing *your own* products — and it arguably made that easier, because now every guess is a real, plausible household item.

**Three things you should know beyond that.**

1. **Nothing inside a single run catches these.** All three residual phantoms in the frozen final set passed reconciliation, were written to `finalLines` with `photo_evidence.supported: true` and `needs_human: false`. The only reason none reached your shopping list is that we ran the photograph **three times and required a line to appear in more than one reading**. That cross-run vote is the only working control.
2. **That control is defeated by exactly the phantoms that matter.** In the `wp1533` family, `WALLS SAUSAGE ROLLS` appeared in **all three runs**. Had that family been the frozen set, a phantom pack of sausage rolls would have gone into the shop with full consensus behind it. The vote filters *random* errors; these errors are not random.
3. **Two of the three residuals are a different failure from the one we had named.** Only `TROP. SMOOTH ORANGE` is an in-enum false positive. The other two claim no product identity at all (`UNKNOWN_VISIBLE_ITEM`) — they are phantom *readings*, not phantom *identifications*. See §3.

**On the comparison with an interactive session.** You observe Claude or ChatGPT reading this same ordinary photograph successfully. The observable difference in *our* implementation, and the only one this evidence supports: our pipeline shows the model **one pre-cut 100-pixel strip at a time, once, with no ability to ask for another look**, and requires it to answer from a supplied 109-item list. Every phantom in this report sits at a cut edge that a reader free to re-crop would simply look at again. Band 7 already flagged itself — `lookAgainRegions: [5,7]` — and nothing in the pipeline acts on that flag. **No claim is made here about how any other product is built internally; that is not established and is not in scope.**

---

## 1. Corrections to the premises of the Work Order

Both were checked because a wrong number that survives into a deliverable becomes estate fact.

| Premise as issued | Established by execution | Locator |
|---|---|---|
| "31 committed run JSON files; 105,041 lines" | `runs/` holds **31 files of all types**, of which **19 are JSON** and only **16 are run captures**. The rest: 2 `.md`, 2 `.mjs`, 7 `.jpg`, 3 non-run JSON. Lines: **107,347** all files, **104,378** JSON only. | `find runs -type f` |
| "Three inventions were measured across the frozen runs and **reconciliation rejected all three**" | The count of **three is correct**. **Reconciliation rejected none of them.** All three reached `finalLines`. The only rejections were a struck-through line and an empty string. They were stopped later, by cross-run consensus in `finalise`. | `grounded.rejected` in all three `*-wp1534-final.json`; `finalise/out/final-shopping-list.json` `skipped[1]`, `skipped[6]`, `skipped[7]` |

The second correction matters: it identifies **which control is actually load-bearing**, and §5 shows that control failing.

---

## 2. How the evidence was traced

Bands are vertical strips of a rotated photograph, 100 px wide with 20 px overlap, spanning `y 192–991`:

| Region | Pixel span (x) |
|---|---|
| 2 | 0–100 |
| 3 | 80–180 |
| 4 | 160–260 |
| 5 | 240–340 |
| 6 | 320–420 |
| 7 | 400–500 |
| 8 | 480–576 |

*(`plan.regions[]`, identical in all three final runs.)*

**Recorded `source_region` and covering geometry cannot disagree on this path, and that is by design.** `bandInspection.js` sends one band per call and **stamps `source_region` itself** — its header states the intent: *"SOURCE REGION BECOMES A FACT, not a claim… Region grounding stops being something the model could get wrong and becomes something it cannot."* So the order's request to report both where they diverge has a null answer, and the reason is a deliberate property rather than an absence of checking.

**Band renders** at `runs/h1-band-legibility/band-*-upscale3.jpg` were read directly as corroborating pixels. **Limit, stated:** these were committed at `051ff68` (WP-B15-31), an **earlier** work package than the final runs (`54c3b0b`). They share the band coordinates and `upscale=3` of `plan.regions`, but they are **not proven to be the exact bytes sent in the final runs**. They are used here only to establish *what handwriting physically sits in a band* — never to grade a specific run's output.

---

## 3. Per-phantom trace — the three residuals in the frozen final set

Established from the files: inventions are **1, 0 and 2** across the three `*-wp1534-final.json` runs — **three in total**, confirming the count. One run was clean.

### P1 — `1 VANN... 5 A DAY PROM...`

| Field | Value |
|---|---|
| Run | `2026-08-13T00-19-40-221Z-wp1534-final.json` |
| Application-owned region | **7** (x 400–500), stamped by the application |
| `as_written` | `1 VANN... 5 A DAY PROM...` — note the model's own ellipses, signalling truncation |
| Identity claimed | **`UNKNOWN_VISIBLE_ITEM`** — no catalogue candidate selected |
| Confidence | **0.34** — the lowest of any phantom in the estate |
| `look_again` | **true**; run recorded `lookAgainRegions: [5,7]` |
| Similarity to nearest page line | **0** |
| Similarity to nearest catalogue text | **0** (no identity claimed) |
| Recurs? | No — 1 of 16 run captures |
| Correlates with a real neighbour? | Region 7 did **not** report `WEETABIX PROTEIN` in this run, which band 7's render shows clipped at its bottom edge. **Suggestive, not established.** |
| Reconciliation | **Not rejected.** Reached `finalLines` with `photo_evidence.supported: true`, `needs_human: false` |
| Stopped by | Cross-run consensus — `support: 1 of 3` → `skipped`, routed to cockpit review queue |

**Classification: D — genuinely stochastic. Confidence: LOW.** It is not catalogue-derived, so it is not C. It cannot be tied to a specific neighbouring line, so B is not established. **What it actually read is UNESTABLISHED.** The 39-line fixture enumerates *purchase lines only*, so a true reading of non-purchase text on the paper would also score as an invention — `5 A DAY PROM…` reads like printed promotional matter rather than the household's handwriting. **What would establish it:** the source photograph (`tg-shopper-chat-8601328832-msg-86-AQADfhFrG0iN2FN-.jpg`) or the run-1 band-7 render, **neither of which is committed** — the photo is passed as an argv path (`runAgenticVisionPrototype.js:729`).

### P2 — `1 TROP. SMOOTH ORANGE` → product_id `47` ← **the in-enum false positive**

| Field | Value |
|---|---|
| Run | `2026-08-13T00-25-29-715Z-wp1534-final.json` |
| Application-owned region | **5** (x 240–340) |
| `as_written` | `1 TROP. SMOOTH ORANGE` |
| Identity selected | **`47`** = *Tropicana Smooth Orange Fruit Juice 1.5L*, category `Bigger Pack Juice`, aliases `["smooth orange juice","smooth oj"]` |
| Confidence | **0.83** — high, and it did **not** ask to look again |
| Similarity to nearest page line | **0.33** (`2 4PK. LUCOZADE ORANGE SPORT`) — below `MATCH_FLOOR` 0.5 |
| Similarity to catalogue entry | **0.67** — `as_written` tracks the **catalogue**, not the page |
| On the page at all? | **No.** id `47` appears nowhere in the 39 ground-truth lines |
| In band 5's pixels? | **No orange juice of any kind.** Band 5 carries Princes Corned Beef, Lurpak, Double Gloucester, Birds Eye Quarter Pounders, Yazoo Strawberry Milk Shake, and right-column Febreze/Dettol/Kleenex |
| Correlates with a real neighbour? | **Yes, 3 of 3.** The phantom appears in exactly the one final run where band 5's adjacent milkshake line lost its brand token: `- 1 YAZOO STRAWBERRY milk SHAKE.` (clean run) → `- 2 YAZOO STRAWBERRY MILK SHAKE` (clean run) → **`1 STRAWBERRY MILK SHAKE.`** (phantom run). Both products are drinks |
| Reconciliation | **Not rejected.** Reached `finalLines`, `photo_evidence.supported: true`, `needs_human: false` |
| Stopped by | Cross-run consensus — `support: 1 of 3` → `skipped` |

**Classification: C — catalogue-context over-selection. Confidence: MEDIUM-HIGH.** Triggered by a B-type edge degradation. The `as_written` field is the tell: the prompt explicitly forbids it (`buildAgenticPrompt.js:137` — *"Never replace it with a tidied or catalogue-matched product name"*), yet `TROP. SMOOTH ORANGE` is a compression of the catalogue name wearing the household's shorthand style, with no page support.

### P3 — `1 PKT. STRAWBERRY CAKE`

| Field | Value |
|---|---|
| Run | `2026-08-13T00-25-29-715Z-wp1534-final.json` |
| Application-owned region | **7** (x 400–500) |
| Identity claimed | **`UNKNOWN_VISIBLE_ITEM`** |
| Confidence | **0.56**; `look_again` **true** |
| Similarity to nearest page line | **0.33**; to catalogue **0** — tracks the page, not the catalogue |
| Correlates with a real neighbour? | **Yes, and decisively.** Page line 33 is `1 SULTARA + CHERRY CAKE` (id `28`). In the two clean final runs region 7 read it as `1 SULTANA & CHERRY CAKE{28}`. In this run region 7 instead produced `1 PKT. STRAWBERRY CAKE{UNKNOWN}` — and **region 6, which overlaps region 7, read `1 SULTANA & CHERRY CAKE` correctly in the same run.** Band 7's render shows this line clipped at the band's bottom edge |
| Why it scored as an invention | The real page line was already claimed by region 6's better reading. The divergent overlap re-read matched no unclaimed fixture line, so it was orphaned and counted as invented (`twoLayerScore.js:718–748`) |
| Reconciliation | **Not rejected** — the two readings diverged too far to merge as duplicates |
| Stopped by | Cross-run consensus — `support: 1 of 3` → `skipped` |

**Classification: B — neighbouring-line / region confusion. Confidence: HIGH.** This is not an invented product; it is a **damaged second reading of a real line at a band edge**, which the scorer is obliged to call an invention.

---

## 4. Cross-family recurrence — reported separately, and not merged with the final set

The `variance` and `wp1533` families are **not** the frozen final set and their counts must not be averaged with it. They carry the strongest evidence about whether phantoms are random.

**Across all 12 itemised phantoms in the estate, 10 claim a catalogue identity — and all 10 have an `as_written` closer to the catalogue entry than to any page line.** Seven of the ten reproduce a catalogue name or alias at similarity ≥ 0.95. The two that do not track the catalogue are precisely the two that claim no identity (P1, P3).

| product_id | Product | Runs | Region | Signature |
|---|---|---|---|---|
| `17` | TRESemme Rich Moisture **HAIR CONDITIONER** | **4** | **always 2** | **6/6 perfect anti-correlation with `LENOR OUTDOOR` (id `5`, Lenor Outdoorable **Fabric Conditioner**)** |
| `102` | Wall's 4 **Pork Sausage** Rolls | **4** | **always 7** | 5/6 anti-correlated with `WEETABIX PROTEIN`; band 7 carries `16 Richmond SKINLESS **PORK SAUSAGES**` |
| `47` | Tropicana Smooth Orange | 1 | 5 | See P2 |
| `103` | Milky Way Multipack | 1 | 5 | `as_written` `1 box MILKY WAY` = alias `pk milky way` at similarity **1.0** |

**The id `17` result is the cleanest evidence in this report.** Six runs, one region, no exceptions:

| Run | `LENOR OUTDOOR` read in region 2? | `TRESemme` phantom? |
|---|---|---|
| `22-18-47` | yes | no |
| `22-21-44` | no | **yes** |
| `22-24-48` | no | **yes** |
| `23-17-43` | no | **yes** |
| `23-22-17` | yes | no |
| `23-27-12` | no | **yes** |

The two products share the word **conditioner** and nothing else — different aisle, different category, no visual resemblance. The bridge is **semantic, through the supplied candidate list**, not visual.

**Classification for `17` and `102`: A — systematic, repeated model bias, expressed through mechanism C. Confidence: HIGH.** Same region, same trigger, same substitute, across runs and across families.

---

## 5. The finding with the sharpest operational edge

**A phantom survived 3-of-3 consensus in the `wp1533` family.**

| Family | Phantom | Runs supporting | Effect under the shipped rule |
|---|---|---|---|
| `wp1533` | `102` Wall's Sausage Rolls | **3 / 3** | **would enter the shop** |
| `wp1533` | `17` TRESemme | 2 / 3 | would survive a 2-of-3 rule |
| `variance` | `17` TRESemme | 2 / 3 | would survive a 2-of-3 rule |
| `wp1534-final` | all three residuals | 1 / 3 each | correctly skipped |

The shipped `finalise` rule skips a line *"seen by only 1 of 3 independent readings"* (`final-shopping-list.json`, `skipped[*].reason`). **Systematic phantoms are seen by more than one.** The clean result in the frozen final set is therefore **a property of which three runs were frozen**, not proof that the control works against this failure class.

---

## 6. A measurement defect in our own instrument

**`inventedFromSuppliedCandidate` reads `0` in every one of the 16 run captures — including every run containing an in-enum false positive.** The counter cannot fire for this failure. `twoLayerScore.js:641–645` builds its `identityPairs` only where:

```js
if (line.identified && exp.expected_product_id
  && String(line.product_id) === String(exp.expected_product_id)) {
  identityPairs.push({ ai, ei });
}
```

`exp` ranges over the 39 **page** lines. A phantom naming a product that is **not on the page** can never form a pair. Verified: ids `47`, `17`, `102`, `103` are **all absent** from the fixture's `expected_product_id` set. So the metric named for "a supplied candidate became a photo line" measures only *misattribution of a product that is genuinely present* — the opposite of the phenomenon under investigation.

Everything else falls to **`inventedFreeGeneration`**, which therefore silently merges three mechanistically different failures: catalogue over-selection (P2), damaged overlap re-reads (P3), and unmatched declared-unknown readings (P1).

**The naming asserts something false.** On these runs the enum is closed and `assertProductIdsInEnum` throws on any value outside it — free generation is structurally impossible. The sibling metric is guarded honestly; `arbitraryOutOfSetNote` states that its `0` is *"STRUCTURALLY IMPOSSIBLE on this run, not merely absent… quoting it as evidence of model restraint would be false."* **`inventedFreeGeneration` carries no equivalent caveat.** That asymmetry is the defect: a reader who trusted these two counters would conclude that catalogue over-selection never happens and that unconstrained invention does — and both conclusions would be backwards.

Recorded as an observation for your decision. **No Work Order is raised** and no fix is proposed here; vision is parked.

---

## 7. Classification counts

**Frozen final set — the three residuals (the answer to the order):**

| Class | Count | Residual | Confidence |
|---|---|---|---|
| A — systematic / repeated model bias | **0** | — | — |
| B — neighbouring-line or region confusion | **1** | `1 PKT. STRAWBERRY CAKE` | **HIGH** |
| C — catalogue-context over-selection | **1** | `1 TROP. SMOOTH ORANGE` → id `47` | **MEDIUM-HIGH** |
| D — genuinely stochastic | **1** | `1 VANN... 5 A DAY PROM...` | **LOW** — could be B; what it read is UNESTABLISHED |

**Full estate, all 12 itemised phantoms across the 8 runs carrying itemised detail:**

| Class | Count | Members |
|---|---|---|
| A (via C) | **8** | `17` ×4, `102` ×4 |
| B | **1** | `1 PKT. STRAWBERRY CAKE` |
| C | **2** | `47` ×1, `103` ×1 |
| D | **1** | `1 VANN... 5 A DAY PROM...` |

**A and C are one mechanism at two frequencies**, not two mechanisms: every A member is a C-type catalogue substitution that proved reproducible at a fixed region. The split is by evidence of recurrence, not by cause.

---

## 8. What remains UNESTABLISHED

1. **What P1 (`1 VANN... 5 A DAY PROM...`) actually read.** *Would establish it:* the source photograph or the run-1 band-7 render — neither committed; the photo is an argv path.
2. **Whether the photograph carries non-purchase printed text.** The fixture enumerates purchase lines only, so any true reading of other text scores as invention. *Would establish it:* the source photograph.
3. **The 21 inventions in the `arm-a`…`arm-e` family.** Those runs predate `metricFamilies` and carry **no itemised invention detail** — only totals. They are counted nowhere in §7 and cannot be classified. *Would establish it:* re-scoring those captures with the current scorer, which is a re-measurement of frozen files and needs no model call.
4. **Whether the band renders in `h1-band-legibility/` are byte-identical to the final runs' renders.** Same coordinates and upscale, different work package (`051ff68` vs `54c3b0b`). Used only for what handwriting sits in a band, never to grade a run.
5. **Whether the substitution generalises beyond this catalogue and this photograph.** Every finding rests on one 39-line page and one 109-item catalogue. The `17`/`5` result is 6/6 but **n = 6 runs of one image**.
6. **The true phantom rate under 3-of-3 consensus.** One family produced a 3/3 phantom and two did not. Three families is not a rate. *Would establish it:* more frozen runs — a measurement decision, not proposed here.
7. **Why `look_again` / `lookAgainRegions` is recorded but not acted upon.** Both P1 and P3 set it. Whether anything consumes it downstream was not traced — out of scope.

---

## 9. Constraints observed

- **No model API call.** Analysis of captured files only.
- **No model comparison**, no Sonnet/Opus bake-off.
- **No prompt-tuning, no OCR architecture, no reopening of vision** — parked by Warwick's order. §6 records an observation; it raises no Work Order.
- **No claim about any other product's internal harness.** §"The answer" contrasts only the observable shape of *our* workflow against *our* outputs.
- Where the frozen record could not decide, the answer is **UNESTABLISHED** with the establishing evidence named.
