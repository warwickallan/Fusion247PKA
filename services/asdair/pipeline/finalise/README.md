# `finalise/` — reconciliation and the final shopping list

WO-2026-08-13-04 (WP-B15-37). Turns the frozen 39-line reading of the real photograph into a
durable, brand-sorted shopping list and a browser-ready handoff, through the production path.

> **This is PRODUCT CAPABILITY EVIDENCE, not acceptance.** No production photograph event is
> exercised, no live database is written, and **no browser, trolley, checkout, payment, slot or
> order action is performed or requested.** Nothing here may be described as a live run, as
> end-to-end, or as AsdAIr being accepted.

## What runs

`produceFinalList.mjs` drives the **real production modules, verbatim** — `runPipeline.js`,
`stages.js`, `shopLines.js`, `shopStore.js`, `shopState.js`, `resolveByCatalogue.js`,
`shopperRoute.mjs`, `asdairCommands.mjs`, `planner.js`, `rulebook.js`,
`buildExecutionPacket.js`, `buildHandoff.js` — over the package's own offline durable store
(`pipeline/test/fakePg.js`, which carries the real unique indexes).

**Why not the live database.** The Work Order requires the actual production path *and* forbids any
database write. Those cannot both hold literally: `stepInterpret` is constitutively a writer
(`upsertLines`, `executeIntents`, `linkListItem`, `advanceWithList`) and the browser step calls the
durable `openHandoff`. The production code is therefore real and the *store* is offline. That is
stated rather than implied, and this run is not evidence about the live database.

## The four pieces

| File | Job |
|---|---|
| `householdSnapshot.mjs` | **SELECT-only** read of `asdair.regulars` and `asdair.rules`, banked as committed JSON so the whole run is reproducible from committed bytes. Never writes. |
| `corroborate.js` | Reconciliation. Collapses duplicate observations of one physical page line; never collapses different purchases. Cross-run corroboration is the anti-phantom mechanism. |
| `settleQuantity.js` + `packIdentityRule.js` | The quantity a line gets, or an honest refusal to decide. Pack counts are product identity, not purchase quantity. |
| `finalList.js` + `accounting.js` | The durable brand-sorted artefact, its four-way provenance ledger, and the closure check that every observation has exactly one fate. |

## The anti-phantom mechanism, and its limits

Vision is **final and parked**. Its positional field was measured to **cost** detection and measured
**not** to separate phantoms from real lines, so it is off — vision ships with **no structural
anti-phantom mechanism** and 1–2 catalogue-valid inventions per run reach reconciliation.

What is used instead is **agreement between three independent readings of the same photograph**.
Measured on the three frozen runs: **support ≥ 2 selects exactly 39 observations, covering all 39
page lines, and excludes all 3 measured inventions** (`1 TROP. SMOOTH ORANGE`,
`1 PKT. STRAWBERRY CAKE`, `1 VANN... 5 A DAY PROM...`).

**⛔ What it cannot do, and no artefact may imply otherwise:**

- **A phantom every reading reproduces is invisible to it.** Three readings by one model of one
  photograph are not independent in the statistical sense. Asserted, not just described, in
  `reconciliation.test.js`.
- **A page line no reading saw cannot be recovered.**
- **It grades nothing against the page.** A line it clears is **corroborated**, never *verified*.

## The pack-identity rule

A leading count is refused as a purchase quantity only when **all three** hold: no purchase marker
(`x`, `pk`, `pkt`, `pack`, `box`, `bag`, `pts`, …) travels with it; the count is ≥ 10; and the
**resolved catalogue product carries a standalone pack count of its own** (`Richmond 12 Skinless
Pork Sausages 319g`, `Ariel 4in1 PODS, Washing Capsules 33`). The third condition is what makes it
Warwick's rule rather than a bare threshold — it fires only where the product genuinely has a pack
count for a page number to be confused with.

**The boundary, stated:** a genuine *unmarked* purchase of ten or more of a counted-pack product
would be reduced to one. The refused number stays on the line, so it is visible rather than lost.

## Cost — AC9

**Projected before the run: $0.00. Actual: $0.00.** Ceiling $2.00. Vision is parked and its three
frozen runs (measured $0.3707 + $0.3387 + $0.3333 = **$1.0427**, already spent under WP-B15-34) are
**consumed as evidence, not re-executed.** No model call of any kind is made by this module.

## Running it

```
node --env-file=C:/.fusion247/asdair.env finalise/householdSnapshot.mjs   # SELECT-only, refreshes the bank
node finalise/produceFinalList.mjs                                        # offline, no model, no network
node --test finalise/                                                     # the proofs
```

Artefacts land in `finalise/out/`: `final-shopping-list.json`, `final-shopping-list.md`,
`accounting.json`, `browser-handoff.json`, `household-1-snapshot.json`.
