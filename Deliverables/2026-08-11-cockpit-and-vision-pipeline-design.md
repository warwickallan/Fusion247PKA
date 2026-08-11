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

---

## Part 1 — Vision pipeline improvement

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
   original, generate a few overlapping horizontal strips for a long/dense handwritten page. No model
   call, no added cost.
2. **One multimodal call**, page + strips together, with the household's Regulars/Favourites/aliases
   context already proven to matter (removing it makes results worse — established this build).
   Per-line output required: literal text seen, quantity, best product match if any, confidence,
   **and — amendment 1 — an evidence locator** (which strip/region the line came from). "No line
   without visible evidence" is a prompt request; the locator is what lets the next stage actually
   check that, in code, rather than trust the model said so.
3. **Deterministic sanity checks, no LLM.** Implausible quantities (16 sausage packs), duplicates,
   lines with no catalogue match, lines with no evidence locator, model-invented lines. This is not
   new — `2026-08-11-list-reconciliation-blocks-browser-build.md` already concluded "a plausibility
   check would have caught this" about the Richmond ×16 misread. This closes that finding.
4. **One batched follow-up call, only if checks find genuine uncertainty** — every flagged crop in a
   single request, not one call per line. A clean list costs one vision call; a hard one costs two.
   Never more without a fresh decision.
5. **Durable photo-truth persisted before enrichment.** Every line answerable: "why is this in the
   shop?" — photo, Regulars, standing rule, or Warwick's explicit decision this week. Never
   "somewhere in the pipeline."
6. **Enrichment (Regulars/rules) stays a separate stage** — this is exactly the 39 + 3 − 1 = 41 split
   this session proved matters; do not re-blend it.

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

**Research task, to run with AsdAIr's own gateway credentials once the surface question above is
settled:**
1. Fresh `GET {gateway}/v1/models` (or gateway-appropriate equivalent) — does Luna or Sol exist on
   the registered roster now?
2. If yes: what are their stated capabilities/cost relative to Terra?
3. **Test protocol, not a swap:** apply the improved single-call pipeline (rotation + strips +
   context, still on Terra) to the one photograph this build already knows the correct answer for.
   If Terra-with-better-input matches the verified trolley, the model was never the problem —
   stop there, no model change needed.
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
- **One rule above all: every screen derives its status from the same computed state.** Before
  redesigning the render layer to guarantee this, verify whether tonight's observed contradiction
  (differing resolved-counts on Overview vs Details) is the already-documented stale-process hazard
  (`services/cockpit/README.md`: `capae.mjs`/`rotation-report.mjs` load once at startup, need a
  restart) rather than a genuine multi-source-of-truth bug. Cheap to check, and it changes whether
  this is a render-layer fix or a state-model rearchitecture.
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
