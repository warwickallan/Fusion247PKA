# WP-B15-34 — AC8 cost projection, recorded BEFORE the first gateway call

**Committed before any gateway call of WO-2026-08-13-01 is made.** AC8 requires the projection to be on the
record before spending, precisely so it cannot be written after the number is known.

## Ceiling

**$3.00** for the whole Work Order, **including the AC1 controlled comparison**.

## The correction Larry asked for

WP-B15-33's projection was **18% light**. The cause is now measured rather than guessed: the positional
field's prompt paragraph and schema property cost more than the ≈250-token estimate allowed for.

| Arm | Runs | Mean cost/run | Spread |
|---|---|---|---|
| Positional field **OFF** (`54e1743`, `*-variance.json`) | 3 | **$0.3404** | $0.3212 – $0.3674 |
| Positional field **ON** (`5755805`, `*-wp1533.json`) | 3 | **$0.4019** | $0.3920 – $0.4075 |

**The ON premium is +18.1%** — which is the whole of the previous under-projection, and it is carried
explicitly below rather than absorbed.

## Why AC1 is NOT run at full-page granularity — the arithmetic that forced the design

AC1 asks for "enough runs each to tell a regression from a draw". At full-page granularity that is not
purchasable inside this ceiling:

- 3 ON + 3 OFF full-page runs = 3($0.4019) + 3($0.3404) = **$2.23**, and AC6's three frozen runs add
  **$1.21** → **$3.44, which is 15% OVER the ceiling.**
- Worse, 3v3 has **almost no statistical power**. The regression is a single line in 39. Fisher's exact
  test on 0/3 versus 2/3 failures returns **p ≈ 0.40** — indistinguishable from a draw by construction.
- Reaching p < 0.05 at full-page granularity needs n ≈ 7 per arm ≈ **$5.20 for AC1 alone.**

**So the comparison is run at BAND granularity**, which is where the evidence actually lives:

- The lost line — page 25, `1 LOCTITE SUPERGLU` — is reported from **region 2 in every one of the six
  stored runs**, ON and OFF alike. It is a single-band event.
- One region-2 band call costs **$0.0583 – $0.0690, mean $0.0622** (measured, `perBand[].costUsd`).
- An ON/OFF **pair** therefore costs ≈ **$0.124**, against ≈ **$0.742** for a full-page pair. **6× the
  observations per dollar.**
- **12 pairs ≈ $1.49**, which powers Fisher's exact at 12v12 to detect e.g. 12/12 versus 7/12 at
  **p ≈ 0.037**.

**What this design cannot see, stated plainly:** a band-scoped A/B measures the field's effect on region 2
only. If the field also costs detection in some other band, this comparison would miss it. That residual is
covered — imperfectly — by the three AC6 full-page frozen runs and by the six full-page runs already
banked, and it is reported as a limitation rather than papered over.

## Why the existing six runs are already a controlled comparison, and why they are not enough

Established by execution, not assumed: `git diff 54e1743..5755805` over the three model-facing files
(`bandInspection.js`, `lineSchema.js`, `bandPlan.js`) shows the **only** delta reaching the model is the
`band_position_pct` prompt rule 2b and its schema property. Every other change in that range is
application-side reconciliation that runs *after* the model has answered.

So the banked 3-versus-3 **is** a like-for-like comparison of the field. It is simply underpowered
(p ≈ 0.40). The band-scoped A/B buys the power the ceiling could not buy at full page.

## Projection

| Item | Basis | Projected |
|---|---|---|
| AC1 band-scoped A/B, 12 ON + 12 OFF region-2 calls | 24 × $0.0622 | **$1.49** |
| AC6 three frozen full-page runs, field ON | 3 × $0.4019 | **$1.21** |
| *(AC6 if AC1 kills the field — OFF instead)* | 3 × $0.3404 | *($1.02)* |
| **Total projected** | | **$2.70** |
| **Against the $3.00 ceiling** | | **90%** |

Headroom is **$0.30** — one further region-2 pair plus contingency. It is deliberately thin, because the
+18.1% premium is now carried in the ON figures rather than discovered afterwards.

**Everything else in this Work Order — AC2 calibration, AC3, AC4, AC5, AC7 mutation proofs, and every
re-score of a stored artefact — costs $0.00.** `rescoreArtefact()` re-grades banked raw model output with
no gateway call, so the deterministic layers are measured for free.

## What is reported afterwards

Actual per-call and per-run cost, actual total, and actual against this projection — **including if it
lands above.**

## What this projection is NOT

It is not a claim that the runs will meet any target. Cost and correctness are independent, and **no
acceptance of any kind is claimed by this Work Order.**
