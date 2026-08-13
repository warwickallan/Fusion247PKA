---
agent_id: felix
session_id: WO-2026-08-13-03 · WP-B15-36
timestamp: 2026-08-13T01:15:00Z
type: end-of-session
linked_sops: [SOP-003-felix-build-a-component, SOP-022-work-order-preflight]
linked_workstreams: []
linked_guidelines: [GL-003-design-system]
---

# Cockpit UI convergence — the one sentence, and the harness that was never running

BUILD-015 · WP-B15-36 · branch `build-015/b15-26-cockpit-ui`, worktree `C:/Fusion247PKA-cockpit-ui`.
Files touched: `services/cockpit/public/app.js`, `services/cockpit/public/styles.css`,
`services/cockpit/render-vm-check.mjs`. No backend file touched.

## The thing worth carrying forward

**The AsdAIr half of `render-vm-check.mjs` had not rendered anything since `f7bf71a`, and its
mutation self-test was passing vacuously.** B15-26 renamed the AsdAIr view keys `overview` → `shop`
and `details` → `questions` in `apps.js` and did not update the harness, so
`app.views.find(v => v.key === viewKey)` returned `undefined` and `currentView.label` threw in the
breadcrumb before a single node rendered. Four assertions went red with it.

The worse half: the `--self-test` block used the same stale key, so all three binding mutations
reported `caught -> threw: Cannot read properties of undefined (reading 'label')`. **Every one was
caught by the breadcrumb, not by the detector the block exists to prove.** The stray-JSON mutation
reported MISSED on every run for the same reason. A mutation test that passes for the wrong reason
is worse than no mutation test, because it gets quoted as evidence.

Established by execution, not inference: identical failures reproduce on untouched `86cfc08` with
this WP's changes stashed. **Generalised lesson: when a registry key is renamed, grep for that key
outside the registry. A harness keyed by string to a registry is a silent dependency.**

## What reading the RENDER caught that reading the diff could not

Two defects, both invisible in a diff and both exactly what Warwick's "not a database view" test is
about:

1. An unreadable line carries the API's own word `"unknown"` in BOTH name fields, and the title
   expression printed it — the word `unknown` sitting where a product name belongs. Now
   `asdairLineTitle()`, which says *"AsdAIr couldn't read this line"*. Pinned by an assertion that
   no rendered text part equals `unknown`.
2. `.as-crop` used `border:1px`. Percentage width/height on the image resolve against the CONTENT
   box while `aspect-ratio` sizes the BORDER box, so the horizontal and vertical scales came out
   0.735 and 0.722 — **the crop was silently squashed by ~1.7% on one axis.** Measured in a real
   browser, not reasoned about. Fixed with an inset `box-shadow`, which is outside layout.

**And the contrast comment I wrote was wrong about the surfaces.** I named `--panel` for `.as-answer`
and `.as-compact-why`; getComputedStyle says the real backdrops are `--bg` and `--panel2`. Both still
PASS, but a figure quoted against a surface the element does not sit on is the wrong-number class
GL-003 §2d warns about. The comment now records the MEASURED surfaces.

## ⛔ CORRECTION to my own evidence markers — Vera, gate HOLD 2, and she is right

**I labelled AC5's crop RENDER-VERIFIED. It is CODE-VERIFIED ONLY, and this correction is the record.**

I did measure the crop in a browser probe and the geometry I quoted is real — but **the executed
suite has ZERO coverage of the crop's positive path.** All 40 VM scenarios render the *absence*
branch, **including the fixture that carries all four pixel bounds**, because `asdairMediaSize` is
populated only by `img.onload`, which cannot fire in a Node `vm`, and no fixture sets `region.url`.
`asdairCropBoxStyle`, `asdairCropImgStyle` and the percentage arithmetic are therefore never executed
there.

The measurement was real; the label was not. One hand-driven probe against a scratch fixture server
is not the same claim as "the suite renders this", and I let the two blur into a single word.
**The rest of the markers survived her audit** — everything I called code-verified-only was genuinely
unexecuted, and nothing I called render-verified rested on a synthesised node. That is precisely why
this one is worth writing down instead of quietly amending.

**No code fix is owed.** On the current backend contract neither `region.bounded` nor
`region_image_url` is published, so the crop is unreachable today; what Warwick actually meets is the
honest fallback, and that IS covered. **Re-gate it when the backend lands regions** — the assertion
to add then renders a crop with `asdairMediaSize` primed, so the arithmetic is executed rather than
measured by hand.

**Generalisable: "I measured it" and "the suite executes it" are different claims, and a measurement
performed once by hand is the weaker of the two.** A probe proves the code CAN work; a suite proves
it keeps working. When one word has to carry both, it will quietly carry the stronger one.

## Design decisions worth preserving

- **The backend seam is a declared, ordered list, not a guess.** `ASDAIR_STATE_FIELDS =
  ['human_state', 'canonical_state', 'cockpit_state']`, and `asdairSeam` records WHICH field
  answered, surfaced in Diagnostics. The backend was converging in parallel; a single guessed field
  name would have blanked the chip and looked like a UI bug.
- **`command_names` is the honest gate for a moving backend.** The payload already carries the
  published command list, so a control with no command behind it renders disabled and says why,
  rather than being invented or omitted. Used for "not this week" on a line and for rule editing.
- **The blocking sentence takes its SHAPE from the canonical state and its NUMBERS from the same
  fields the counters read.** That is what makes them structurally unable to contradict each other.
  Where they still do, the disagreement is named as a FAULT in words — never two numbers left for
  the user to reconcile.
- **`asdairWaitingOn()` was DELETED, deliberately.** It derived a second status sentence from raw
  stage/needs_review/counts alongside the canonical chip. Two independently-derived sentences on one
  screen is the exact contradiction the design doc records. A comment marks the grave.
- **The service-availability band now stands down when AsdAIr's own canonical band is on screen.**
  Both were `.app-status` — same dot, same bold lead — which is one visual language saying two
  things. Verified by measurement: `status-bands-on-screen=1`.
- **No new JS file.** `public/` is served with no build step and `sw.js`'s shell list plus
  `sw-version.mjs`'s hash inputs are the distribution layer. Everything went into `app.js`, which is
  already in both. This is the omission my contract names by name.

## Vera's three residuals

1. **39px tab switcher** → `min-height:44px` on `.app-nav-btn`, GLOBALLY not scoped, because
   `.app-back` and `.app-cog` in the same header are already 44×44 and a fourth scoped exception to
   a shared primitive is how a global token stops being trusted. Measured at 44 in a browser.
2. **Focus-trap body bounce** → two focusable sentinels either side of the sheet, each bouncing to
   the opposite edge of the card's live focusable set (disabled controls excluded). No hand-rolled
   key cycle. Verified by dispatching focus at both sentinels in a real browser.
3. **Chromium `:focus-visible` on scripted focus** → `focusSel()` now passes `{focusVisible:true}`
   AND adds its own `.kb-focus` class, cleared on blur, rendering the SAME `--accent` ring. The
   indicator no longer depends on a heuristic nobody here controls. Measured: `kb-focus=true`,
   `outline=2px rgb(14,124,134)`.

## Reported, not fixed (out of scope)

`provenance-check.mjs` FAILs 1/30 — `provenance.mjs`'s `SOURCE_MODULES` omits `asdair-checklist.mjs`,
which `server.mjs` imports. **Pre-existing on `86cfc08`, both files are backend, and this order
forbids touching them.**

## After Vera's CONDITIONAL PASS — what changed

**MEDIUM 1 — the same `unknown` defect survived on the Rules screen.** I fixed the pattern on the
Shop screen and wrote an assertion banning it *there*, and the identical leak sat two screens away
rendering `#2 · unknown`. **A one-site fix for a wording rule is how the rule fails to travel** —
so the fix is now a named helper, `asdairSaid(value, absent)`, which the next site can reach for
instead of re-deriving. Rules renders `no category recorded`, matching the `no target recorded`
vocabulary already four lines below it. **I then swept all four primary tabs in a browser rather
than fixing only the two instances Vera named: zero bare `unknown` remain on Shop, Questions,
Basket or Rules.**

**LOW 3 — the recurrence guard, and it is the most valuable line in this WP.** `scenario()` now
throws when a view key does not resolve, naming the key, the scenario and the registry's real keys.
**Mutation-proved rather than asserted**: re-pointing one scenario at `'overview'` produces that
message and exit 1; restored afterwards. The Home/System plans, which override `area` and render no
app view, now carry a named `NO_APP_VIEW` sentinel instead of the same dead `'overview'` string —
a real key sitting unused is indistinguishable from a real key that has gone stale, which is the
whole failure being prevented.

## Parked — Vera's three LOW focus sub-findings, backlog by her verdict, not acted on

Recorded here so they are not rediscovered. My recommendation is in each.

1. **`.as-trap` carries `tabindex="0"` and `aria-hidden="true"`** — the axe `aria-hidden-focus`
   condition. Near-zero real impact (the sentinels are empty and instantly redirect focus), but an
   automated scan WILL flag it. *Recommendation: drop `aria-hidden`; empty spans announce nothing,
   so it buys nothing and costs a permanent scan finding.* One attribute.
2. **`asdairTrapFocus()` does not add `.kb-focus`** — so the sheet-edge wrap still leans on the very
   `:focus-visible` heuristic residual 3 was written to remove. *Recommendation: route it through
   `focusSel()`'s ring, so there is one focus-indicator mechanism rather than two.*
3. **`focusSel()` is called from mouse-driven `openApp()`**, giving a mouse user a keyboard ring.
   Cosmetic. *Recommendation: only add `.kb-focus` when the last input was a key — or accept it, as
   an over-visible focus ring harms nobody and a missing one harms a keyboard user.*

These are deliberately NOT bundled into this commit: they touch code Vera has already reviewed and
passed, and re-opening reviewed surface after a CONDITIONAL PASS to carry three cosmetic changes is
a worse trade than logging them plainly.
