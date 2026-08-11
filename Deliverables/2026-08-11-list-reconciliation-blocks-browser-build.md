---
title: "SHOP-2026-08-11-M93 list reconciliation — BLOCKS the browser build. Do not proceed to Build ASDA basket without resolving this."
date: 2026-08-11
author: Larry
build: BUILD-015 AsdAIr
status: OPEN BLOCKER. This supersedes the earlier "M93 reached READY_TO_SHOP" milestone claim as a
  reason to proceed — it does NOT supersede the fact that it happened, only the conclusion that it
  meant the list was trustworthy.
---

# The list is not trustworthy yet — full comparison, real discrepancies

**Warwick's own words, and they are the standard this document is held to:** *"this whole thing is
pointless if I can't trust that the list is right."* He is right. Reaching READY_TO_SHOP proves the
pipeline mechanics work end to end for the first time — it does NOT prove the plan is correct. Those
are different claims and conflating them is exactly the failure this whole session's Gate Zero work
was about.

## What was compared

`Deliverables/2026-08-11-trolley-reconciliation-41-lines.md` — last night's 41-product list, verified
line-by-line against the REAL ASDA trolley Warwick actually built by hand — against
`SHOP-2026-08-11-M93`'s final resolved plan (32 `requested` list items, `asdair.shop` id 26), which
went through tonight's fixed pipeline (Gate Zero repair, `gpt-5.6-terra` vision model) against the
SAME photograph, deliberately resent by Warwick as a controlled test.

## The discrepancies, in full

### Quantity errors — 9 items wrong

| Product | Tonight | Should be (verified) |
|---|---|---|
| ASDA British Milk Semi Skimmed 6 Pints | 4 | 1 |
| Batchelors Pasta 'n' Sauce Cheese, Leek & Ham | 1 | 4 |
| Gourmet Mon Petit cat food | 1 | 3 |
| **Richmond 12 Skinless Pork Sausages** | **16** | **1** |
| Rustlers All Day Breakfast Sausage Muffin | 1 | 2 |
| Twix Multipack Chocolate Biscuit Bars | 2 | 1 |
| Yazoo Chocolate Milk | 1 | 2 |
| Yazoo Strawberry Milk | 1 | 3 |

Richmond sausages at 16 (should be 1) is the standout — a genuine, confident OCR misread of a
handwritten quantity, not a repeat of the earlier hallucination-signature defect. **A plausibility
check would have caught this**: 16 packs of sausages is an implausible household quantity and was
never sanity-checked against anything.

### Missing entirely — at least 9 real items never appeared in tonight's plan

ASDA Crispy Skin-On Fries · Exceptional Creamy Mashed Potato · Weetabix Protein 24-pack · Batchelors
Mac 'n' Cheese · ASDA 4 Beef Quarter Pounders · ASDA Dairy Toffee · ASDA Shortbread Fingers · Twix
Ice Cream 4pk · ASDA Assorted Fruit Splits Lollies · Vanish Pre-Treat Gel · Lenor Outdoorable fabric
conditioner · Loctite Super Glue · Ariel 4in1 Pods 33 (never resolved to a requested item despite an
answer being submitted for it — worth checking separately whether that answer actually landed).

### Present tonight, not in last night's verified list

ASDA Cottage Pie · ASDA Minced Beef Hotpot · Birds Eye 4 Beef Burgers · **Bloo Spa Moments Toilet
Rim** · Lucozade Sport Raspberry · Mars Caramel Multipack.

**Bloo is not a reading question — it's a remembered-decision question.** Warwick explicitly said
"Bloo — skip this week" last night because his regular was out of stock. Its reappearance tonight
might be because the underlying handwritten line is genuinely on the list every week regardless of
one week's stock-out (in which case tonight surfacing it again is arguably *correct*, and it was
last night's skip that was the one-off, not a standing exclusion) — or it might be a durable-learning
gap where a one-time operational skip should have suppressed re-asking this week specifically. **Not
resolved here. A genuine product decision for Warwick, not something to silently assume either way.**

Cottage Pie / Minced Beef Hotpot / Birds Eye Burgers plausibly correspond to genuinely ambiguous
handwritten lines that Larry's manual read last night and tonight's `gpt-5.6-terra` read interpreted
differently (Cottage Pie vs Mashed Potato are visually/positionally adjacent on the page; ASDA Beef
Quarter Pounders vs Birds Eye Burgers are both "4 beef burger" shaped products). **Neither reading has
been re-verified against the actual photograph with full rigor this session — that re-read was
in progress, interrupted by the context-rotation instruction, and is the natural next action.**

Lucozade Raspberry and Mars Caramel Multipack are worth particular suspicion: both appeared
independently across *multiple* separate model runs tonight (both `gpt-5-mini` and `gpt-5.6-terra`),
never in last night's careful manual read. That consistency cuts both ways — it could mean they are
genuinely on the photograph and were missed by hand last night, or it could mean there is a residual
catalogue-bias effect on these two specific household regulars that survives the model switch. **Not
settled. Needs the same fresh photograph re-read the other ambiguous lines need.**

## What this means for the immediate next action

**Do NOT proceed to "Build ASDA basket" on `SHOP-2026-08-11-M93` as it currently stands.** The plan
has 9 wrong quantities, 9+ missing real items and 6 items of uncertain provenance. Building a browser
basket from this would repeat exactly the shape of the 2026-08-10 failure — a plausible, well-formed,
*wrong* trolley — just with a better hit rate than last night's `gpt-5-mini` run, not a solved problem.

**Also unresolved, separately:** the `browser_build_request` (id 7) that queued for the supervised
build tonight was generated at `2026-08-11T19:29:52Z`, **before** several of the corrections in this
document's own history landed — it is stale relative to current DB state and must not be used as-is
even once the list itself is fixed. A fresh plan regeneration is needed before any browser attempt.

**The browser tooling itself also needs settling before any live attempt**: Warwick's environment is
supposed to run AsdAIr's browser step headless via CDP (the dedicated Chrome profile at
`C:/.fusion247/asdair/chrome-profile`, confirmed listening at `127.0.0.1:9222` earlier this session),
but the Claude-in-Chrome extension `list_connected_browsers` returned empty when Larry tried to drive
it directly. Whether the intended path is Larry driving via Claude-in-Chrome (requiring the extension
connected to that specific Chrome window) or the existing `services/asdair/browser-runner` CDP path
(currently marked experimental/deferred/prohibited from further live testing without fresh authority
per `SOP-021 §4`) was not resolved this session and needs a decision, not an assumption, next time.

## The open product question Warwick raised

**Is `gpt-5.6-terra` capable enough for this task, or does it need a stronger model?** Real, measured
evidence from tonight: terra is a large, genuine improvement over `gpt-5-mini` (zero of the known
hallucination-signature items, 39 lines vs mini's 26-30, much better coverage of genuinely-present
items) — but this reconciliation proves it is **not yet fully trustworthy** on this specific hard,
dense, multi-column handwritten photograph: real quantity misreads (Richmond ×16) and real coverage
gaps (9+ missing items) remain. Warwick asked whether an even more capable model ("Sol") is needed —
**unresolved**; no model by that name was found among the 9 the gateway registers tonight
(`gpt-5-mini`, `gpt-5.6-terra`, `gpt-5-nano`, `text-embedding-3-large`, and the `fusion.*` role
aliases). Worth checking with Warwick directly next session what he meant, and whether the gateway's
model roster has grown since.

## What IS proven and stands, regardless of this blocker

- Gate Zero repair is real and working (see `2026-08-11-GATE-ZERO-source-truth-established.md`) —
  the mechanism (confidence gating, provenance persistence, honest uncertainty surfacing) is sound
  and independently Veritas-verified. This reconciliation is not evidence the REPAIR failed; it is
  evidence the underlying vision model still has real, measurable limits on hard source material,
  which the repair was never claimed to eliminate.
- The full backend integration (B15-18/19/20/21), the Gate Zero repair, and the AsdAIr app
  restoration are all genuinely integrated, tested and Veritas-passed (Gate 1 PASS, Gate 2 preflight
  PASS) — see the Assurance receipts under `Builds/BUILD-015-.../Assurance/`.
- `SHOP-2026-08-10-M64` and the stray `SHOP-2026-08-11-M109` (a misrouted Telegram reply that
  briefly became its own shop and reached `READY_TO_SHOP`) are both genuinely cancelled and inert.
- The Stop hook that was causing a runaway self-notification loop (`idle-ding-check.mjs`) is disabled
  in `.claude/settings.json`, committed — takes effect next session.

## The honest next action for a fresh session

1. Read this document and `2026-08-11-live-acceptance-run-in-progress.md` in full.
2. Re-read the actual photograph (`C:\.fusion247\asdair\shopper-media\tg-shopper-chat-8601328832-msg-86-AQADfhFrG0iN2FN-.jpg`)
   with full rigor against every discrepancy line named above — settle Cottage Pie/Mashed Potato,
   Beef Quarter Pounders/Birds Eye Burgers, and the Lucozade Raspberry / Mars questions with actual
   evidence, not inference.
3. Ask Warwick directly: is Bloo a standing exclusion or a one-off stock skip; what did he mean by
   "Sol"; does he want a stronger model tried, a second independent model cross-check, or a different
   verification strategy entirely.
4. Fix the confirmed-wrong quantities and missing items through the real command surface (`correctLine`
   for genuine corrections, matching the pattern already established and evidenced this session).
5. Regenerate a fresh `browser_build_request` (the current one, id 7, is stale) once the list is
   genuinely reconciled — not before.
6. Resolve the browser-driving mechanism (Claude-in-Chrome connection vs the existing CDP runner)
   before attempting a live build.
7. Only then run the supervised build, and reconcile the finished trolley against the photograph with
   the same rigor as last night's manual rescue — this time from a genuinely verified plan.
