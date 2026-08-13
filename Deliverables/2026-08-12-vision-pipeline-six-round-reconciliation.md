---
title: "Vision pipeline — six-round reconciliation, per Warwick's explicit instruction"
date: 2026-08-12
author: Larry
build: BUILD-015 AsdAIr
status: MANDATORY READING before any further vision-pipeline implementation. Supersedes treating any
  further round as a "one more bug" patch. Warwick's ruling, this document's trigger, quoted in full at
  the end.
---

# Vision pipeline — six-round reconciliation

**Why this exists.** Six Work Order rounds (`WO-2026-08-11-B15-VISION-01` through
`WO-2026-08-12-B15-VISION-06`) each fixed a real, live-verified defect. The dominant failure — roughly
half the photograph's lines omitted, every run — has not moved. Warwick's instruction: stop patching
symptoms, reconcile what actually happened, and answer by execution whether a fundamentally different
process is buildable at sensible cost. This document is that reconciliation. It is honest about what
each round proved, what remains probabilistic, and it does not round up.

**The discriminating case throughout**: the same real household shopping-list photograph, with an
independently-established 39-line PHOTO truth (not the 41-line final trolley, which includes 3 Regulars
additions and 1 deliberate skip — see `2026-08-11-list-reconciliation-blocks-browser-build.md` for that
distinction, settled early and never re-litigated).

---

## Round-by-round reconciliation

### Round 1 — `WO-2026-08-11-B15-VISION-01` (the initial build)

- **What was attempted**: the whole mechanism, built for the first time — deterministic image prep
  (orientation, deskew, crop via `sharp`), one household-aware region-grounded vision call, deterministic
  sanity checks, a confidence-or-anomaly-triggered follow-up, four-way provenance persistence
  (`shop_line_provenance`), a canonical shop-state (`shop.human_state`).
- **First live result**: 20/41 correct (49%) — against the WRONG denominator (41, not 39; corrected
  after this round). Richmond sausages read correctly once, then recurred as quantity 16 in a sibling
  run. The A/B test run in the same session showed individually-called region crops clearly beating a
  single bundled call (35/41 named vs. 24/41).
- **Root cause diagnosed**: none — this was the baseline measurement. It triggered Warwick's Amendment 4
  ruling: no model switch, fix Terra's process, correct the denominator to 39.
- **What became structurally impossible**: nothing yet — this round built the mechanism, it did not fix
  a specific defect.
- **Still present / probabilistic**: everything. This is the baseline every later round is measured
  against.

### Round 2 — `WO-2026-08-12-B15-VISION-02`

- **What was attempted**: quantity semantics as a class (separate raw text from a
  quantity-evidence-gated field), adaptive per-region re-inspection instead of blanket calls, the
  wrong-milk identity fix, duplicate reconciliation (the Vanish exact-duplicate case), real cost
  instrumentation.
- **Live result** (first test against the *correct* 39-line denominator): 21/39 and 23/39 correctly
  identified (~56% avg), 17/15 omitted (~41% avg). **Richmond fix held** — no recurrence to 16 across
  either run. **Wrong-milk fix held** — no confident misresolution. **Vanish duplicate fix held.**
  **New findings, not previously named**: TRESemme and Lucozade Raspberry hallucinations reappeared
  despite a DB-level provenance fix that had tested clean offline; a new Febreze-shape duplicate
  appeared; real cost measured at more than double the pre-run estimate.
- **Root cause**: Richmond/milk/Vanish were genuine, narrow, correctly-fixed defects — proven and held.
  TRESemme/Lucozade's DB-level fix never reached the actual source (the vision/interpretation layer,
  which the DB-only fix could not touch).
- **Structurally impossible after round 2**: Richmond's pack-size-as-quantity misread (verified across
  two independent live runs); the specific wrong-milk confident misresolution; the specific Vanish
  same-region exact duplicate.
- **Still probabilistic / open**: omission (~41%, untouched by design), hallucinations, the general
  duplicate-collapse mechanism (a label computed but not yet acted on), quantity calibration, Yazoo
  Chocolate instability.

### Round 3 — `WO-2026-08-12-B15-VISION-03`

- **What was attempted**: investigate-first on omission. Found and fixed the "a region producing
  literally ZERO lines never triggers a follow-up" gap (`silentRegions()` added). Hardened the prompt
  against a "known products" context licensing invented lines. Fixed the general duplicate-collapse
  mechanism (the `possible_duplicate` label was computed but never read by anything downstream — every
  line materialised into the basket regardless; fixed by making the catalogue resolver authoritatively
  exclude a second same-product-same-quantity reading).
- **Live result**: **omission got WORSE, not better** — 50.0% average (19.5/39) vs. round 2's 41.0%
  (16/39). Root cause of the regression, confirmed against the round's own new observability field: the
  fix only covers a region producing NOTHING; the dominant failure — a region producing SOME lines but
  still missing most of what's on it — was untouched and is what actually happened in the worst run.
  **Lucozade Raspberry got WORSE** — recurred in both runs (was 1 of 2 in round 2). **A new, higher-
  consequence regression**: the "authoritative" dedup fix, correct on its own terms, combined with a
  pre-existing catalogue-identity bug to **silently delete a real item** (Febreze mis-identified as
  Lenor, second reading excluded) — worse than round 2's "appears twice, at least visible." **Quantity
  assertions collapsed** to ~25% of lines (down from ~70-87%), masked by a "0 wrong quantities" metric
  that improved only because the model mostly stopped stating quantities — caught only because the
  mechanism behind the metric was checked, not trusted.
- **Root cause**: the zero-line trigger fix is real and narrow, correctly scoped to the case it targets.
  The dedup fix's logic is correct; it was exposed by a *different*, pre-existing bug (catalogue
  mis-identification) it had no way to know about. The quantity collapse was an uninvestigated side
  effect of the round's own prompt/schema changes.
- **Structurally impossible after round 3**: a region producing literally zero lines silently escaping
  re-inspection; an exact same-product-same-quantity duplicate *from the same region* surviving to the
  final basket.
- **Still probabilistic / open**: partial-region omission (the actual dominant mode, still completely
  untouched); cross-region collision silent deletion (new, worse than round 2's shape); quantity
  calibration (now over-corrected the other way); Lucozade Raspberry (worse, not better).

### Round 4 — `WO-2026-08-12-B15-VISION-04`

- **What was attempted**: make the dedup exclusion non-authoritative for cross-region collisions (both
  colliding lines demote to `needs_confirmation` rather than one being silently trusted); trace and fix
  the quantity-assertion collapse (found: an over-broad caution clause in rule 1, not the quantity rule
  itself, which had been byte-identical across rounds); investigate an omission-density heuristic
  (correctly declined to ship — judged it would repeat the "confidently wrong, unproven" pattern this
  build has paid for three times already).
- **Live result**: **the fix never executed on the live path, at all.** `source_region` was `null` on
  every single resolved line in every run, because `interpretPhotoOrchestrator.js`'s own return
  statement stripped the field before it ever left the function — three steps upstream of the code round
  4 actually edited. The identical Lenor/Febreze silent-deletion shape reproduced live, twice, despite
  round 4's own unit test passing 6/6. That test could not have caught this: it called the resolver
  directly with hand-built fixtures that already carried `source_region`, bypassing the exact chain that
  was broken.
- **Root cause**: a wiring gap. The *consuming* code (the resolver's collision check) was correctly
  fixed; the *producing* code (the orchestrator's own return value) never actually delivered the value
  the consumer needed. Proof-by-unit-test without proof-by-integration missed a defect sitting entirely
  outside the unit under test.
- **Structurally impossible after round 4**: nothing new, live — the design was correct, the wiring was
  not.
- **Still probabilistic / open**: everything round 4 targeted remained genuinely broken on the live path;
  the exact defect location was now known precisely, which is what made round 5 narrow and fast.

### Round 5 — `WO-2026-08-12-B15-VISION-05`

- **What was attempted**: wire `source_region` through the orchestrator's actual return value; prove it
  with an integration-level test exercising the real chain, not a fixture that can route around the
  break; mutation-test the fix itself (revert it, confirm the new test genuinely fails and reproduces the
  live regression shape, restore it, confirm it passes).
- **Live result**: **PROVEN, for real this time.** `source_region` non-null on 67/67 resolved lines
  across two runs. The exact captured Lenor/Febreze cross-region collision reproduced live and both lines
  correctly surfaced as `needs_confirmation` — neither silently dropped. **A new, adjacent finding**: the
  SAME two products, read from the SAME region rather than different ones, still cause a silent loss —
  via a *different* mechanism (the catalogue matcher itself assigns both readings the same regular ID, an
  identity-matching bug, and the already-correct same-region auto-collapse then drops the real item
  believing it's a genuine duplicate).
- **Root cause**: genuinely closed, and independently verified live. This is the one round-over-round
  claim in this document that is unconditionally true: the cross-region silent-deletion defect this build
  spent rounds 3-5 chasing is fixed.
- **Structurally impossible after round 5, proven**: a cross-region collision silently keeping one line
  as authoritative while dropping the other with no human visibility.
- **Still probabilistic / open**: the same-region alias-mismatch variant (new); omission (~49%, entirely
  unchanged — round 5 did not touch it, by design); quantity assertion still well below round 2's
  baseline (~34% vs. ~78%); Lucozade Raspberry (persistent, unaddressed until round 6).

### Round 6 — `WO-2026-08-12-B15-VISION-06`

- **What was attempted**: calibrate an omission-detection signal against real historical data (five
  rounds' worth of captures, in principle); fix the newly-found same-region alias-mismatch (a catalogue
  matching defect, not a dedup-logic defect); investigate and, if possible, fix the persistent Lucozade
  Raspberry hallucination.
- **Result — an honest null on the central question**: the promised "round 3/4/5" calibration corpus
  turned out to only be genuinely usable from round 5 (`source_region` was null throughout rounds 3-4,
  pre-dating round 5's fix — the corpus itself was smaller than assumed, found and reported rather than
  worked around). Two candidate deterministic signals (raw line-count per region; average word-count per
  region) were tested against the only usable data and **both pointed the wrong direction** — the region
  with the *fewest* lines had *zero* omission in both runs; the region with the *most* content had the
  *highest* omission rate in both runs. **No signal shipped, correctly, per the order's own explicit
  permission for a null result.** A further finding, not asked for but material: ground-truth region
  attribution is **not stable across two independent live reads of the same photograph** — 10 of 25
  attributable products landed in *different* regions between the two runs. **A separate, significant
  finding**: `vision_confidence` is `null` on every real captured line, in every round checked — the
  re-read trigger has only ever run on its anomaly leg; its confidence leg has been silently disconnected
  since Gate Zero.
- **What was fixed and proven at unit level (live confirmation pending, interrupted by this redirect)**:
  the same-region alias-mismatch (a brand-anchor guard added to the catalogue matcher's pass 4, closing a
  generic-word-overlap false match, proven against the real product names); a second, previously
  unscoped prompt rule that could independently license hallucinated lines from purchase history (the
  suspected Lucozade Raspberry mechanism — plausible, well-reasoned, **not yet confirmed live**).
- **Root cause**: the alias-mismatch fix is real. The omission-signal null result is the single most
  important finding of this whole reconciliation — see below.
- **Structurally impossible after round 6 (pending live confirmation)**: the specific same-region
  Febreze/Lenor identity confusion.
- **Still probabilistic / open**: omission — now with real evidence that a cheap, deterministic,
  post-hoc signal on the model's own returned lines cannot detect it, because the missing lines simply
  aren't in the output to check. Lucozade Raspberry (unconfirmed). The confidence-wiring gap (identified,
  not yet restored).

---

## The four-category diagnosis Warwick asked for

**A. Visual coverage — did Terra actually inspect every part of the page?**
**This is the dominant, unsolved failure**, and it is the only category where six rounds of work
produced almost no movement. Round 3 closed one narrow slice (a region producing *nothing*). The
dominant slice — a region producing *some* lines while still missing most of what's on it — has never
been directly targeted, and round 6's own honest investigation found that no cheap signal derived from
the model's own output can detect it, because an omitted line leaves no trace in that output at all.
Round 6's region-instability finding (the same photo read twice, attributing GT items to different
regions each time) is further evidence that the underlying visual process itself is inconsistent, not
merely under-triggered.

**B. Recognition — given a visible region, what did Terra think it said?**
Richmond's pack-size-as-quantity misread is arguably B/C-adjacent (a semantics problem once the text is
correctly read, not a misreading of the handwriting itself) and was fixed at round 2, held through every
subsequent round. No round found a systematic "misreads clearly visible handwriting" defect distinct
from omission — when a region *is* read, what it reports for that content has not been the dominant
source of error.

**C. Identity resolution — given the text, which Regular/Favourite/catalogue product did it mean?**
This is where five of six rounds' genuine, proven progress actually landed: the wrong-milk fix (round
2), the Vanish exact-duplicate fix (round 2), the general duplicate-collapse mechanism (built round 3,
corrected round 4, actually wired round 5), the same-region alias-mismatch fix (round 6, unit-proven).
Every one of these is real and, where live-tested, held.

**D. Planning — what should actually be bought, once A/B/C are settled?**
Not meaningfully implicated in any round's failures. The 39-photo/+3-Regulars/−1-skip split was
established early (this session, before round 1) and has not needed revisiting.

**The conclusion this reconciliation exists to state plainly**: rounds 2-6 repeatedly, correctly, fixed
real defects in category C, and one narrow defect in category A. **None of that can fix the dominant
category-A failure, because C-layer fixes operate on lines the model already returned — and the
omitted ~50% were never returned to operate on.** Continuing to patch C or D-adjacent issues, however
real each individual fix is, was never going to move the omission number. Round 6's own null result on
the calibration question is the evidence that confirms this, not merely an assertion.

---

## Warwick's ruling that triggered this document, quoted in full

> "This has now had ~12 hours of engineering attention and the live result is still approximately HALF
> THE LIST OMITTED. That is not 'nearly there.' At this point the problem is no longer individual bugs.
> The PROCESS is wrong... DO NOT start another symptom-fix round. DO NOT tweak another threshold, dedup
> rule or prompt and call it Round 7... WHAT IS THE SIMPLEST PRODUCTION ARCHITECTURE THAT LETS TERRA
> INSPECT THE IMAGE ITERATIVELY LIKE THAT, AT SENSIBLE COST?... Check the gateway/harness capability
> now... Establish the actual deployed surface [by execution, not inferred from public docs]... If YES
> [a simple durable process can work]: build the simplest version, prove it on the known photograph,
> integrate it, and move on. If NO: do not hide behind another Work Order or another 5% improvement.
> Come back with the evidence."

**Next action, per this ruling, not a Round 7**: establish the Fusion gateway's actual deployed
capability — multi-image input (already known working), multi-turn continuation, targeted follow-up/crop
calls, tool/function-calling support for a model-directed re-inspection request, image-detail/resolution
controls, prompt caching, usage telemetry — by direct execution against the live gateway, not inference
from documentation. This is Asdair's task, dispatched separately, since it requires the live gateway
credentials no other actor in this build holds.
