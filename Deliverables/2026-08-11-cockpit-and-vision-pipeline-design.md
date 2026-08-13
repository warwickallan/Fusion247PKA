---
title: "Cockpit redesign + vision pipeline improvement — design capture"
date: 2026-08-11
author: Larry, synthesizing Warwick's brief and an external (GPT) design proposal he shared
build: BUILD-015 AsdAIr
status: DESIGN CAPTURED, NOT BUILD-AUTHORISED. No implementation has begun. This document exists so
  nothing from tonight's design conversation lives only in chat. Implementation requires Warwick's
  explicit acceptance and a scoped Work Order per root CLAUDE.md's Wayfinder rule.
---

# Cockpit redesign + vision pipeline improvement — design capture

## Why this exists

Same session as `2026-08-11-list-reconciliation-blocks-browser-build.md`. That document proved the
39-line photo read plus 3 Regulars-sourced additions minus 1 stock-skip reconciles exactly to the
verified 41-product trolley (see `2026-08-11-trolley-reconciliation-41-lines.md` for the ground
truth, and the live cross-check that confirmed it this session). Two follow-on decisions came out of
that success: (1) can the production vision model (`gpt-5.6-terra`) be brought up to the accuracy a
manually-directed, zoom-cropped read achieved, without turning this into a research programme; (2)
the Cockpit app needs to become the actual control surface for the shop, with Telegram demoted to a
notification channel. Warwick reviewed an external design proposal (GPT) for the Cockpit and asked
for it to be considered, improved, and captured here — not built yet.

**Warwick's explicit framing, verbatim intent:** cost-conscious, not opposed to "more machinery and a
better pipeline" if justified; not ready to retire Telegram; wants the Cockpit meaningfully better.

**⭐ PRIORITY, STATED EXPLICITLY SO IT CANNOT DRIFT: Part 1 (vision pipeline) is the critical-path
dependency. Part 2 (Cockpit) is parallel, secondary work — an exception-resolution surface, never a
substitute for fixing source truth.** Warwick's correction, this session, verbatim intent: *"if [the
Wayfinder frontier] has become primarily 'Cockpit redesign', [Larry] has lost the plot slightly.
Vision/source truth remains the first dependency. Everything in the Cockpit is just a nicer way of
displaying rubbish if that bit isn't fixed."* The scope is deliberately narrow — give Terra better
visual evidence without turning a weekly ASDA shop into a multi-model OCR factory — not a research
programme.

**The success criterion, stated once, plainly, and not to be restated more loosely later:**
> On a normal list, one household-aware vision call produces trustworthy source truth. A difficult
> list costs at most one additional batched reread.

---

## Part 1 — Vision pipeline improvement — THE CRITICAL-PATH DEPENDENCY

### The problem, stated precisely

`services/obsidiwikai/src/core/deps.js` / `models.mjs`'s `vision()` sends the raw, unrotated,
unprocessed image bytes to the gateway in a single call, with a single strict-JSON retry permitted
only for malformed output — never a second look at the image. Tonight's manually-directed read
(rotate → zoom-crop disputed lines → re-read → cross-check against known-correct ground truth)
produced 38/39 exact matches against the verified trolley; the production `gpt-5.6-terra` run on the
identical photograph produced 9 quantity errors and 9+ missing items. The mechanism difference is
resolution/legibility at read time, not a general model-capability claim — confirmed by reading the
actual code path, not inferred (see the cross-check agent's findings in this session's transcript).

### The design, adopted from Warwick's shared proposal with two amendments

**Pipeline shape:**

```
Telegram image → deterministic image prep (free, local, no API call)
              → ONE household-aware vision call (full page + overlapping strips, same request)
              → deterministic sanity checks (no LLM)
              → IF genuine uncertainty remains: ONE batched follow-up call on just the uncertain crops
              → durable photo-truth row per line (hash, model/prompt version, text, product match,
                 confidence, evidence locator)
              → Regulars/rules enrichment (separate stage — never blended with the photo-read stage)
              → Cockpit exceptions
              → basket
```

1. **Deterministic image prep** — correct orientation, deskew, trim borders, keep the full-resolution
   original, generate a few overlapping horizontal strips for a long/dense handwritten page,
   **numbered** (region 1, 2, 3…). No model call, no added cost.
2. **One multimodal call**, page + numbered strips together, with the household's
   Regulars/Favourites/aliases context already proven to matter (removing it makes results worse —
   established this build). Per-line output required: literal text seen, quantity, best product match
   if any, confidence, **and — amendment 1, tightened per Warwick's review — a `source_region`
   referencing one of the application-supplied region numbers**, not a model-asserted freeform
   bounding box. **The application creates the regions; the model may only point at one that exists.**
   This does not prove the model read the pixels correctly inside that region — it cannot — but it
   closes the much worse failure class: a line materialising with no visual source at all (the exact
   shape of the Route B / Lane A D-1 defect already on this build's record, where content reached the
   plan with nothing tying it back to what was actually said). "No line without visible evidence" is a
   prompt request; a `source_region` that must resolve against a real, application-owned region list
   is what lets the next stage enforce that in code.
3. **Deterministic sanity checks, no LLM.** Implausible quantities (16 sausage packs), lines with no
   catalogue match, lines with no evidence locator, model-invented lines, **and — per Pax's
   independent review, a named gap the design previously left unspecified — an explicit dedup/merge
   rule for the same physical line appearing in more than one overlapping strip.** Overlap between
   strips is deliberate (it's what lets a line near a seam get read at all) and reliably produces
   duplicate reads at the boundary; this must be resolved by region-adjacency or by requiring the
   model to name the single strip its best evidence came from even when a line appears in two, not
   left to a generic "duplicates" check that can't distinguish a strip-seam echo from a genuinely
   repeated household item (e.g. two real, separate milk lines at different quantities). This is not
   new — `2026-08-11-list-reconciliation-blocks-browser-build.md` already concluded "a plausibility
   check would have caught this" about the Richmond ×16 misread. This closes that finding.
4. **One batched follow-up call, only if checks find genuine uncertainty** — every flagged crop in a
   single request, not one call per line. A clean list costs one vision call; a hard one costs two.
   Never more without a fresh decision. **The trigger is deliberately NOT model-reported confidence
   alone.** This build already has a live, on-record failure of trusting self-reported confidence in
   isolation — the Gate Zero defect was exactly the model's own per-line confidence being solicited
   and then silently discarded, and separately, a "confidently wrong" read is precisely what
   production experienced tonight (Terra's single-pass run was not flagged as uncertain by itself; the
   errors were only visible against independently-verified ground truth). **A re-read triggers on
   EITHER low model confidence OR a deterministic reconciliation anomaly from step 3 (implausible
   quantity, unresolved cross-strip duplicate, no catalogue match, no evidence locator)** — the
   deterministic checks are a real, independent trigger, not a formality sitting after a confidence
   gate that already did the real work.
5. **Durable photo-truth persisted before enrichment.** Every line answerable: "why is this in the
   shop?" — photo, Regulars, standing rule, or Warwick's explicit decision this week. Never
   "somewhere in the pipeline."
6. **Enrichment (Regulars/rules) stays a separate stage** — this is exactly the 39 + 3 − 1 = 41 split
   this session proved matters; do not re-blend it.

**The four-way provenance rule, made explicit (Warwick's review, tightening the point above):**
a line's origin is one of exactly four values, and they are never silently interchangeable:
- **PHOTO** — MUST carry a valid `source_region` resolving against an application-supplied region.
  A photo-origin line with no valid region is a defect, not a low-confidence result.
- **REGULARS** — no image evidence required or expected; labelled "Added from Regulars."
- **RULE** — no image evidence; labelled as household-rule-derived.
- **WARWICK** — no image evidence; labelled as this week's explicit decision.
A line asserting PHOTO provenance without a resolvable region must be rejected by the deterministic
sanity-check stage, not passed through with a low confidence score.

**AMENDMENT 4 — Warwick's ruling, 2026-08-12, after the discriminating test scored 20/41 (49%) and
Richmond ×16 recurred in a sibling run. Supersedes the pipeline shape above where it conflicts; does
not restate what still stands.**

**The ruling, his words, load-bearing: "DO NOT switch to Sonnet/Opus and do not start another model
bake-off... Stick with Terra and improve the PROCESS around it until the production vision path is
trustworthy."** Warwick separately gave the same photograph to ChatGPT and Claude directly and both
read it extremely well — **the lesson is that AsdAIr's production vision workflow is impoverished
relative to a competent multimodal harness, not that Terra cannot read the list.** Give Terra the same
kind of visual workflow a competent harness provides. This is a weekly ASDA shop, not an OCR research
programme — keep it proportionate. **No further model comparison, no pausing to ask whether to
continue. Carry on.**

**Target economic shape, stated so it isn't lost under the detail below:** one normal first-pass Terra
call where possible; local/deterministic image work is effectively free; additional Terra calls ONLY
where the first pass genuinely needs closer inspection; do NOT create routine per-line calls just
because individual crops scored better in isolation; batch/sequence so a difficult list costs a little
more and a normal list does not; measure real cost from actual gateway usage, never an abstraction like
"2.4× calls."

1. **The test denominator was wrong and must be corrected before any further scoring.** The photograph
   has **39 source lines**. The 41-line trolley is NOT OCR ground truth — it's `39 photo lines − 1
   (Bloo, deliberately skipped) + 3 (Regulars, added separately) = 41`. Grade PHOTO INTERPRETATION
   against the 39-line photo truth only. Regulars enrichment is a separate stage with its own
   correctness question — do not count it as OCR success or failure either way. Every re-score from now
   on reports seven categories separately: correctly identified photo lines; omitted photo lines;
   invented photo lines; wrong identity; wrong quantity; genuinely uncertain lines; confident-but-wrong
   lines.
2. **Household context (Regulars/Favourites/aliases) stays in Terra's recognition context** — already
   the design's position, restated because it's load-bearing: Warwick already tested context-free
   reading and it was materially worse. Context may assist recognition; it may NOT manufacture source
   lines. PHOTO-derived content and REGULARS-derived enrichment remain different provenance classes,
   unchanged from the four-way rule above.
3. **Free visual preparation, unchanged in substance from steps 1-2 above** — EXIF orientation, correct
   auto-rotation, deskew where useful, sufficient original resolution retained, dead borders trimmed
   where useful, deterministic numbered source regions. **One correction: do not upscale and assume
   that manufactures information.** Processing only where it genuinely improves what Terra can inspect.
4. **The normal path still begins with ONE strong whole-page pass** — unchanged from step 2 above, with
   the per-line structured-output contract now stated completely: application-owned `source_region` ID;
   the visible/raw text interpretation; the interpreted product meaning; **requested quantity ONLY where
   actually supported by quantity evidence** (see point 7); a catalogue/household match where available;
   confidence/uncertainty; `provenance = PHOTO`. A photo-derived line with no supplied region is invalid,
   unchanged from the four-way provenance rule. Regulars/rules may not leak into PHOTO provenance —
   **this is now a live, confirmed defect** (point 8 below names it), not just a rule stated in the
   abstract.
5. **Do not trust confidence alone — unchanged in principle from step 4 above, list of checks now
   complete.** After the first pass, deterministic checks (no model tokens) for: missing/invalid region
   provenance; duplicate/near-duplicate lines; suspicious quantity interpretation; **pack-size numbers
   mistaken for requested quantity** (point 7); weak or contradictory catalogue identity; household match
   inconsistent with the visible interpretation; unexplained invented lines; competing matches; other
   known reconciliation anomalies from this build's record.
6. **Targeted re-inspection of SUSPECT REGIONS ONLY — corrects the design's prior "one batched call on
   flagged crops" into something more precise.** The A/B test proved individual-region inspection
   materially improves accuracy (35/41 named vs. 24/41 bundled, 27/41 correct vs. 21/41) — **that is a
   lesson about per-region fidelity, not a licence to make every line an individual call by default.**
   First pass finds the likely lines/regions; deterministic checks (step 5) identify suspect regions;
   Terra re-inspects ONLY those suspect regions at higher visual fidelity, using the cheapest reliable
   call shape the gateway supports for however many regions are actually suspect; the re-read reconciles
   deterministically back onto the SAME source-region identity — a correction of specific first-pass
   regions, never a second competing transcription of the whole shop. A clean list stays close to one
   call. A difficult list may legitimately cost more — acceptable if it prevents a wrong £140 trolley.
7. **Fix quantity semantics as a CLASS, not by moving a threshold.** Raising `MAX_PLAUSIBLE_QUANTITY`
   would not have been the fix even before this ruling — 16 can be a perfectly legitimate part of a
   product's own name/pack descriptor ("Richmond 16 Pork Sausages"). **The real invariant: a number
   inside a product identity is NOT automatically the requested purchase quantity.** Requested quantity
   must come from actual quantity evidence in the list/household rule/authorised decision — a leading
   count, an explicit "x3"/"buy 2", a household rule — never merely because a plausible-looking number
   appears in the product name. This is a schema/prompt-contract fix (separate the raw text from a
   justified quantity field), not a bound to relocate.
8. **Identity resolution is a separate concern from vision, and separate concerns get separate root
   causes.** The wrong-milk match ("ASDA Semi Skimmed 6 Pints" resolved against the Cravendale 2L
   regular) is a `resolveByCatalogue` bug, not an OCR problem — do not enlarge a crop to try to fix a
   deterministic resolver defect. Chase, as their own earliest causes, each independently: the wrong-milk
   identity match; the duplicate Vanish-line reconciliation gap; the provenance leak that let previously-
   excluded items (TRESemme, Viakal, Minced Beef Hotpot, Lucozade Raspberry) reappear despite being
   explicitly removed once already; the Yazoo Chocolate regression; the quantity-semantics class fix
   from point 7.
9. **Instrument and report ACTUAL cost, not an abstraction.** Use the real gateway usage/token records
   from the runs already executed tonight (the whole-page path, the individual-region A/B run) plus the
   proposed adaptive path once built, and this build's actual configured pricing, to report in human
   terms: *"Normal clean shop: approximately £/$X. Difficult shop requiring N re-reads: approximately
   £/$Y."* The optimisation target is **cost per trustworthy shop**, never minimum call count — do not
   save pennies by creating hours of human correction and a wrong basket.
10. **Re-run the SAME known photograph** (no 20-photo benchmark programme) against the corrected
    architecture until it demonstrates the intended behaviour. **The target is NOT "39/39 guessed with
    supreme confidence."** Trustworthy means: every photo-derived line grounded to a real image region;
    no invented source lines; no silent quantity guesses; no enrichment masquerading as photograph truth;
    high-confidence lines genuinely right; remaining ambiguous lines surfaced honestly for Cockpit
    resolution. *"38 resolved, 1 needs Warwick"* is a better outcome than *"39 resolved"* with several
    confidently wrong.
11. **Cockpit is the safety valve, not the OCR department** — the redesign continues as already built,
    unchanged. Warwick will not manually proofread 39 lines every week; the intended experience stays
    photo → trustworthy automatic interpretation → Cockpit shows only genuine exceptions → Warwick
    resolves naturally → source truth recomputes → plan proceeds, with each exception showing the real
    photo crop, what Terra read, what AsdAIr thinks it means, sensible alternatives, free-text
    correction, and whether a correction is this-shop-only or durable household knowledge.
12. **Do not stop. Do not ask whether to park this. Do not turn this into a provider comparison.**
    Vision/source truth remains the critical dependency; a beautiful Cockpit displaying an incorrectly
    read shopping list is still failure. Keep improving the process until it is economically sane and
    trustworthy.

---

**Amendment 2 — model question resolved by research, not assumption.** Warwick identified that
"Sol" (the open question in last night's blocker doc — "is Sol capable enough, and what did Warwick
mean by it") is a real model, and that Terra/Sol sit alongside a third name, Luna, as a family. The
last confirmed live probe of the gateway's actual model registry
(`services/obsidiwikai/src/core/models.mjs` lines 33-38, defect ledger `D-2026-08-03-05`) found only
`fusion.reason, fusion.query, fusion.extract, fusion.keyword, fusion.embed, gpt-5.6-terra,
gpt-5-mini, gpt-5-nano, text-embedding-3-large` — **no Luna or Sol alias registered as of that probe**,
which is now over a week old and known stale. Larry's own shell has no `FUSION_GATEWAY_URL`
configured (by design — AsdAIr's credentials are not Larry's), so this cannot be probed from here.

**Research task status: BLOCKED, not merely undone.** A first dispatch attempt (this session) correctly
`REFUSE`d rather than reach for the gateway credentials, because they require access to
`C:\.fusion247\**`, which `Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md` denies
by default absent an explicit `private_surface` declaration — which this task never carried. **A
genuine structural snag surfaced in the process, not just a missing field:** AsdAIr's runtime state
lives at `C:/.fusion247/asdair/**` (per `services/asdair/pipeline-runtime/runtime-paths.mjs`), but
GL-012 §4 only permits grants shaped `C:/.fusion247/private/<project>/**`. That path does not fit the
pattern as written. **Before this research task can be legitimately re-dispatched, the private-surface
question needs settling — is `C:/.fusion247/asdair/**` the correct existing convention GL-012 already
accommodates some other way, or does AsdAIr's runtime genuinely sit outside GL-012's stated shape and
need reconciling — a question for Larry and Warwick, not something a subagent should infer its way
past.**

**Amendment 3 — Pax's independent research (`2026-08-11-pax-vision-pipeline-and-luna-sol-terra-research.md`)
partially pre-answers this, from public sources, without touching the live gateway:** Luna, Terra and
Sol are confirmed-real, GA-since-9-July-2026 GPT-5.6 tiers (Sol=flagship, Terra=balanced,
Luna=cost-efficient) — Warwick's recollection was correct, and this specific question is now CLOSED,
not to be re-litigated. **What is NOT answered by that research, and still requires the live probe
below:** whether THIS gateway's model_list currently exposes `sol`/`luna` aliases at all — a local
config fact, not a public one. **Also from Pax, independently: public OCR/text-extraction benchmarks
show only a small, non-monotonic gain from Terra to Sol** (roughly 88.8%→90.7% mean similarity,
79.4%→82.5% text extraction — smaller than this build's actual 9-error/9-miss problem, and in one
metric Sol didn't clearly beat the PRIOR generation). This is independent evidence, not just Warwick's
instinct, that fixing input quality is more likely to be the real fix than a model swap — reinforcing,
not just repeating, item 5 below.

**Research task, to run with AsdAIr's own gateway credentials once the surface question above is
settled:**
1. Fresh `GET {gateway}/v1/models` (or gateway-appropriate equivalent) — does Luna or Sol exist on
   *this* registered roster now? (Their existence as models is no longer in question — see Amendment 3.)
2. If yes: confirm current cost/capability against Pax's public-source findings above rather than
   re-researching from scratch — a fresh pricing check is still worthwhile, since GPT-5.6 pricing has
   already moved once (a cut noted in Pax's research) in the month since release.
3. **Test protocol, not a swap:** apply the improved single-call pipeline (rotation + strips +
   context, still on Terra) to the one photograph this build already knows the correct answer for.
   If Terra-with-better-input matches the verified trolley, the model was never the problem —
   stop there, no model change needed. **Per Pax's recommendation, add one explicit A/B line item
   here: also test the flagged/uncertain strips as separate individual follow-up calls rather than
   only the single bundled page+strips call, and compare accuracy on the same known-answer photo** —
   published evidence is genuinely mixed on whether bundling or individual-crop calls read better,
   and this build already has the cheapest possible way to settle it empirically rather than guess.
4. Only if Terra-with-better-input still materially misses, run the same prepared input through Sol
   (or the next capable option) and compare.
5. **Do not build a Terra-then-Sol cascade** unless Terra's improved-input success rate is high
   enough to make a cascade cheaper than using the stronger model outright — a two-model cascade is
   only worth its complexity when the cheap path wins overwhelmingly often. If the stronger model is
   simply better, use it as the primary vision call, full stop. This is Warwick's own cost framing
   applied literally: cost per successful shop, not cost per API call.

---

## Part 2 — Cockpit redesign

**Product reframe, Warwick's own words carried into design:** Cockpit becomes the thing that answers
*"what, if anything, does AsdAIr need from me before it can finish this shop?"* Telegram becomes a
notification channel only — not retired, not the application.

### Overview screen

- Lead with shop status, not process/runtime facts (PID, port, DB reachability move to a
  Diagnostics/About screen, reachable from a small "AsdAIr online" indicator, not the front page).
- Structure: photo understood (N lines) → shop prepared (Regulars added, skips, final product/unit
  count) → **needs you** (count + one button) or **nothing waiting on you** with the next action
  (build basket) or **AsdAIr is working** (what it's doing).
- **Cheaply rule out the stale-process hazard first** (`services/cockpit/README.md`:
  `capae.mjs`/`rotation-report.mjs` load once at startup, need a restart) — but do not let "a restart
  fixed the number" close the UX finding. **Precisely restated per Warwick's review:** "0 resolved of
  41 lines" and "11 questions resolved" are not inherently contradictory — they count different
  entities (lines vs. questions) and can coexist honestly. **The genuine contradiction** is
  human-facing status text disagreeing with itself on the same screen — "Waiting on you — check
  Telegram" beside "0 still waiting on you," or "waiting for browser runner" beside 41 still-open
  lines. That's a state-model gap, not just a stale-cache symptom, and needs fixing regardless of what
  the restart check finds.
- **One canonical human-facing state, computed once in the pipeline and consumed by both Cockpit and
  Telegram — never recalculated independently by each surface.** Exactly six values:
  `Needs Warwick` / `AsdAIr working` / `Ready for Warwick` / `Browser working` / `Complete` /
  `Failed`. Every other screen and every Telegram message renders FROM this value; nothing derives its
  own competing read of "what's the state" from raw counts.
- "Other shops" (cancelled/historical) moves off the front page entirely, into History.
- Do not surface an inferred/unpriced total (e.g. "£140.97 — inferred, not an ASDA price")
  prominently on the front page — that's developer evidence, not user information. Historical spend
  goes somewhere secondary, or waits until there's a real price.

### Question board (replaces scattered Telegram cards)

- One screen, every open decision. Each item: the relevant photo crop, what AsdAIr read, its best
  guess with the confident alternative, one-tap accept buttons, and a free-text override.
- Answered items do not vanish — "N need you · M answered," with answered items collapsed but
  openable, showing what was asked, what Warwick answered, and whether it was applied to this shop
  only or remembered as a standing preference (with Change/Forget).
- A persistent "why isn't my basket ready?" control that always resolves to one human-readable
  sentence — never something inferred from counts.

### List screen (renamed from "Details")

- Exception-first: default view shows only "needs attention" and "changed" lines, not all 41 giant
  cards. An "All" filter is available but not the default.
- Resolved lines render compact (product, quantity, provenance tag), full card only on tap.
- Provenance shown in plain English, matching the categories this build already has real data for:
  **from the list** (photo-sourced) / **added — Regular** / **added — household rule** / **you
  decided this week** / **skipped this week** (with why).
- The source photograph auto-rotates for display; shown as a small crop next to the specific
  uncertain line it's evidence for, not as a dominant full-page image on every screen. A "view
  original" link covers the full-photo case.

### Basket — two distinct views, not one

- **Planned basket** (pre-build): product/unit counts, unresolved-count, substitution setting,
  build button.
- **ASDA trolley** (post-build): actual added/missing counts against the plan, an explicit
  "needs attention" section for anything that failed to add (e.g. an unavailable item with no
  substitute), and a "reconciled ✓" state that only shows once the real numbers match — never
  optimistic green.

### Rules screen

- Household-language, not engine-language: "Never auto-substitute," "Cravendale Semi-Skimmed —
  usually 4×2L," "Vanish — prefer Gold," "Richmond sausages — skinless 319g unless told otherwise."
  Each editable/forgettable. This is the same durable-learning intent already in BUILD-015's DEFECT
  history (D-1/D-2 in the Wayfinder's Lane A) given a face Warwick can actually read.

### Cockpit is a write-capable decision surface, not a better read-only report

**Explicit requirement, per Warwick's review:** the redesign is not display-only. Required actions,
all from the Question board:
- answer every outstanding question from one screen;
- type a free-text answer;
- accept a suggested match with one tap;
- change an already-resolved answer;
- mark an item "not this week" (a one-off skip, distinct from a standing exclusion — see Bloo,
  already a live example of this exact distinction mattering);
- distinguish "use this now" from "remember this going forward" wherever that isn't already obvious;
- view the relevant photo region for any questionable line;
- see, immediately after saving, exactly what remains unresolved;
- build the basket only once nothing actually blocks it.

**"Something looks wrong."** Any resolved line — not only flagged ones — must be tappable with a
plain "Change" action. Exception-first stays the default view; this is the escape hatch for when
Warwick notices something the pipeline was confident about but got wrong, without having to go
through Telegram or Larry to fix it.

**Every write goes through the existing accountable command surface — this is not optional.**
Free-text answers route through the same interpretation call Telegram answers already use (the
`answer()` gateway role); corrections route through `correctLine`, the same durable command path
already established. **A new Cockpit-only write path that reaches the database directly, bypassing
that interpretation/provenance chain, would be a second instance of the exact defect already on this
build's record** — `shopLines.markCorrected` existing with zero production callers, a correct command
nobody actually invoked. Cockpit gets a UI; it does not get a second, divergent way to mutate a shop.

### Navigation

Four primary tabs, collapsed from the current Overview/Details split: **Shop** (current state,
counts, exceptions, source list, additions/skips, expandable decision history) · **Questions** (the
focused interaction board above) · **Basket** (planned + post-build ASDA reconciliation) ·
**Rules** (durable household knowledge). Diagnostics, About and History move behind a settings/cog
icon — not a fifth tab competing for space on a phone screen.

### What the primary surface must never show

Shop identifiers (`SHOP-2026-08-11-M93`), raw catalogue counts ("109 products in household
catalogue"), match-method internals ("matched by approximate alias"), runtime ports, database
connectivity status, raw confidence decimals, and internal event/state names all belong in
Diagnostics, never on Shop/Questions/Basket/Rules. The product-facing line is never more than:
*"Cravendale Semi-Skimmed Milk 2L ×4 — from Mum's list · recognised from your Regulars."* Anything
more technical than that on the primary surface is the same failure this build's CAPAE record already
names elsewhere: exposing developer/diagnostic truth as if it were the user-facing answer.

### Telegram's new role

- Three message shapes only: "list read" (N lines, N Regulars added, N need attention, link to
  Cockpit), "shop ready" (final counts, nothing outstanding, link), "basket built" (added/missing
  counts, link to review). No card-per-question, no in-Telegram decision flow.

---

## Ownership note (not yet assigned)

Cockpit is a Node service (`services/cockpit/server.mjs` + `public/*`), not a component-library
frontend — implementation likely sits with Keel (service/backend + wiring) with Vera's visual/QA gate
on the rendered result, rather than a Felix component build from scratch. Confirm at Work Order time,
not assumed here.

## What this document is NOT

Not a Work Order. Not build authorisation. Not a claim that any of this is scheduled ahead of the
still-open list-reconciliation product decisions recorded in
`2026-08-11-list-reconciliation-blocks-browser-build.md` (Richmond pack size, Vanish pink/gold, Birds
Eye vs ASDA quarter pounders, Bloo restock check) — those remain open and this design work does not
supersede or delay them.
