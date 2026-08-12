# WP-B15-33 — AC8 cost projection, recorded BEFORE the first run

**This file is committed before any gateway call of WP-B15-33 is made.** AC8 requires the projection to be
on the record before spending, precisely so it cannot be written after the number is known.

## Ceiling

**$2.00** for the whole Work Order (WO-2026-08-12-06, AC8).

## Basis — measured, not estimated

The three WP-B15-32 variance runs on this exact photograph, this exact band plan, at `54e1743`:

| Run | Calls | Wall time | Cost |
|---|---|---|---|
| `2026-08-12T22-18-47-290Z` | 7 | 215.5 s | $0.3674 |
| `2026-08-12T22-21-44-350Z` | 7 | 161.7 s | $0.3212 |
| `2026-08-12T22-24-48-748Z` | 7 | 175.0 s | $0.3326 |
| **Total** | 21 | | **$1.0212** |

Mean $0.3404 per run, spread $0.3212–$0.3674 (±7.7% about the mean).

## What changed in this Work Order that could move the number

The band plan, the number of calls, the image count, the crop geometry, the 3× enlargement and the 111-value
candidate enum are **all unchanged** — so the dominant cost term, the image payload, is unchanged.

Two additions to the *text* of each request:

- `buildBandPrompt` gains one instruction paragraph (rule 2b, `band_position_pct`) — roughly 150 tokens;
- `buildLineSchema` gains one property with its description — roughly 100 tokens.

That is ≈250 additional **input** tokens per call, ×7 calls = ≈1,750 tokens per run against a run whose input
is dominated by seven enlarged image crops plus a 109-item catalogue block. Output grows by one small integer
field per line, ≈50 tokens per run.

The expected effect is **below the run-to-run variance already measured**, so the honest projection is the
measured band rather than a computed increase.

## Projection

- **Per run: $0.34, band $0.32–$0.38.**
- **Three runs: $1.03, band $0.95–$1.15.**
- **Against the $2.00 ceiling: projected to land at ~51% of ceiling, with headroom for a fourth run if one is
  needed to satisfy AC6's "minimum three".**

## What is reported afterwards

Actual per-run cost, actual total, and actual against this projection — **including if it lands above.** AC8:
*"If it lands above, say so and continue — the runs are the deliverable."*

## What this projection is NOT

It is not a claim that the runs will meet the target. Cost and correctness are independent, and no acceptance
of any kind is claimed by this Work Order.
