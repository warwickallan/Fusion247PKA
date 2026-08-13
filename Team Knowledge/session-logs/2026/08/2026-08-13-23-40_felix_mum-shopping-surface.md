---
agent_id: felix
session_id: WO-2026-08-13-14 / WP-B15-45
timestamp: 2026-08-13T23:40:00Z
type: end-of-session
linked_sops: [SOP-003-felix-build-a-component, SOP-022-work-order-preflight]
linked_workstreams: []
linked_guidelines: [GL-003-design-system]
---

# WP-B15-45 — the household shopping surface, and what measuring caught that reading did not

## What I built

A separate household-facing surface at `/shopping.html` (`services/cockpit/public/shopping.{html,css,js}`),
implementing Addendum B's S1 weekly page. Two gates guard it: the existing `render-vm-check.mjs`
extended with a household vocabulary detector, and a new `shopping-geometry-check.mjs` that measures
the rendered result in a real browser.

The build itself is in the commit messages and in the files. This entry is for the things that
should outlive them.

## The one that matters most: a comment is not a control

This surface produced the same defect class **four separate times**, and every instance had the same
shape — **a declaration that read correctly and behaved differently.**

1. `.q-btn { width: 88px }` rendered at **82×88**. A flex item defaults to `flex-shrink: 1`, so a
   declared width is a preference the browser may overrule. The floor that exists for her hands was
   not a floor.
2. Scroll clearance under the sticky footer was correct arithmetic for a **one-line** footer and
   wrong for the **two-line** footer portrait actually produces.
3. The stylesheet asserted, in prose, that the quantity display "sits between them and is inert".
   It supplied the **distance** and none of the **inertness** — a tap between `−` and `+` bubbled to
   the row and toggled it. On a selected item, a near-miss on `−` **removed it**.
4. Token parity with GL-003 was carried by a comment saying "if GL-003's `:root` ever changes, THIS
   BLOCK IS STALE". `contrast-check.mjs` reads `styles.css` only, so a token change would have left
   every contrast figure I reported silently stale and **nothing would have failed**.

Every one was invisible to reading and obvious to measuring. **(3) and (4) were caught by Vera, not
by me**, and (3) is the worst of the four because *I had written the justification myself*.

**The durable rule: if a comment states a property, either an assertion enforces it or the comment
is a wish.** GL-003 §2b-bis already says this about `opacity` compositing. It generalises.

## The second one: an assertion is only as good as its scope

`coveredAtRest` derived its subject from `q('.add, .row')` and took the **last** element. That
returns **document order**, so it was always the "Add something else" control and **never an item
row**. The assertion could not see the failure mode it existed to see, and reported clean while rows
were occluded at five of six viewports. The HIGH-1 defect had to be found **by hand**.

**A check whose scope excludes the failure is worse than no check, because it gets quoted as
coverage.** When writing an assertion, state which elements it can and cannot see, then verify that
the set is non-empty and contains the interesting case.

## The third: hit-test behaviour, do not infer it from geometry or from the DOM

Fixing the dead space took **three attempts, each caught by the gate**, and a geometric check would
have read a satisfied 72px at every stage:

- `.q-num { pointer-events: none }` → the hit moved up to `.q`, which still bubbled.
- `.q { pointer-events: none }` → the hit fell **through** to the row underneath. *`pointer-events:
  none` makes a region transparent; transparent is not dead when the thing behind it is the target.*
- `.q` **swallowing** the click via `@click.stop` → genuinely dead.

Then the gate itself was wrong: it asked `hit.closest('button, [role=checkbox]')`, which walks the
DOM and finds the row every time regardless of whether a tap can reach it. **It stayed red after the
defect was fixed.** The honest test dispatches a real click and records whether a listener on the
row fires. `dispatchEvent` is synchronous, so this needs no waiting, and in the passing case nothing
mutates.

**Geometry, DOM ancestry and behaviour are three different questions.** Only the third is the one a
user experiences.

## Mutation-testing found two of my own assertions were vacuous

`--self-test` reported a clean catch rate while two mutations **could never fire**:

- `::after { content: " Cockpit" }` — CSS generated content is **not** in `innerText`.
- `.page-pad { padding-bottom: 0 }` for the footer overlap — that makes the page *shorter*, so the
  content fits and nothing overlaps. It was the real bug's opposite.

And later, a single missing IIFE took the catch rate from 7/7 to 0/7 silently: `Runtime.evaluate`
runs at the **top level of a persistent execution context**, so a bare `const` survives the call and
the *second* invocation throws `Identifier has already been declared`. The throw happened **in the
page**, so every mutation reported MISSED while the control stayed clean. The gate now checks
`exceptionDetails`, because a page-side throw must never read as "the detector did not fire".

## Where I deliberately did NOT add a mutation, and why that is not laziness

The footer-overlap assertion ships **unmutated**. Every synthetic mutation either pushed the control
below the fold (so nothing overlapped) or tripped a *different* assertion first — and **a mutation
that goes red for the wrong reason is a vacuous catch**, which is the exact failure above in a
better disguise. Its non-vacuity rests on the real defect it caught in this package. Vera agreed
explicitly: *"recording the absence was right."*

**Proof by the bug it found is stronger than proof by injected fault.** Say so, rather than
manufacturing a mutation to make a table look complete.

## Two spec defects found by building against the spec

- **Addendum B §5.1 vs §6.3 contradict.** §5.1 wants 24px of dead space between *any* two
  actionable controls; §6.3 makes the *whole row* the select target. Both cannot hold. Addendum E
  A10 words it correctly — **between controls of opposite effect** — and that is buildable.
- **Addendum B §6.2's wireframe copy says "press the green button".** B §6.7 itself requires that
  button to render **disabled and grey** until her first selection, so the spec's own instruction is
  wrong at the one moment she reads it. Naming a control by colour also fails WCAG 1.4.1.

Both were recorded against the spec rather than silently diverged from.

## Where the design system genuinely could not help

GL-003 §3 (type) and §4 (spacing) are `<unset>`, and the live operator scale starts at **9px** —
roughly a third of this profile's floor. There was nothing to inherit, so the `--m-*` values are
surface-local and flagged, sitting where Iris can promote them (G-5/G-6). Colour took GL-003's
**adopt branch**: every token is a §2a token at its §2a light value under its §2a name, and the
7:1 bar is met by confining text to `--ink` on `--panel`/`--bg`/the three tints.

**Two figures that do not meet Addendum B §5.1's own non-text bar and are recorded rather than
rounded away:** `--ok` is 3.49 in light and `--park` is 3.42 in dark. Both clear WCAG 1.4.11's 3:1,
and §6.5's four simultaneous selection signals mean no rail is load-bearing alone — but the number
is not met, and that is Iris's to resolve.

## Round two — the fix that became the regression

Vera failed the remediation commit. Two HIGHs, and **the first was introduced by my own HIGH-1 fix.**

**I added `max-height: 40vh; overflow: hidden` to the footer as a "defensive ceiling" and never
measured it.** Its own comment said it stopped a future third line "reclaiming the screen" — but
`position: static`, three lines above, had already made that impossible: **a static footer is in
flow, so extra height extends the scroll; it cannot overlay anything.** The ceiling defended against
sticky behaviour on a footer that was no longer sticky, and it clipped the primary action to 30
painted pixels of 88 and the post-send message to **zero**.

**She presses SEND at 200% zoom and nothing happens.** That is the one message Addendum B §9.6 and
Addendum E criterion 9 make load-bearing.

**And my gate reported `min-target=88px` on a 30px button**, because `getBoundingClientRect()`
returns the **layout box, which an ancestor's `overflow: hidden` does not change.** Vera named it
the third instance of one class in a single package:

| mechanism | declared | rendered |
|---|---|---|
| `flex-shrink` | 88px | 82px |
| D-17 `opacity` | 5.02:1 | 3.91:1 |
| clipping | box 88px | **painted 30px** |

**The box passes; the render does not.** This log's own central lesson, committed a third time by
the person writing it down.

## The narrowing I did not know I had made

I flagged two narrowings and shipped a **third silently**: `unreachableAtEnd` went from
`covered **OR** off-screen` to `covered **AND** off-screen`. Those limbs are near mutually
exclusive — **a control buried under a bottom-pinned footer is inside the viewport**, so the
off-screen limb is false and the condition could never fire. Vera reinstated the genuine defect at
800x1280 and the gate went red on **nothing**.

Worse, the comment above it still defended the pair's non-vacuity **on a bug caught before the
narrowing**. *A stale comment defending a defanged check is worse than no comment: it is what a
reviewer reads instead of re-deriving the argument.*

**Changing a boolean condition inside an edit about something else is a separate change and needs
saying out loud.** Both narrowings I announced were accepted. The one I did not announce broke the
check.

## Two instruments that lied, and one guard that could never fire

- **My backtick guard could never fire.** A stray backtick is a *parse* error, so the module never
  loads and no runtime check inside it executes. It was a control that looked like a control. Fixed
  properly: `MEASURE` is now a real function passed through `toString()`, so the trap no longer
  exists to be guarded.
- **That conversion then broke the backdrop walk.** A regex escaped for a template literal (`\(`)
  is wrong as ordinary source (`\(`), so it stopped matching `rgba(0, 0, 0, 0)` and returned
  *transparent* as though it were a real background. Every pairing measured 1.28:1 and the run
  produced **804 contrast violations on a surface that had not changed**. Loud, but pointing at the
  wrong thing — a reader could have spent an evening restyling a perfectly good page. There is now a
  sanity assertion: a transparent backdrop means **the instrument is broken, not the surface**.
- **The dead-space hit test was examining zero rows** at three viewports, because `elementFromPoint`
  returns null outside the viewport and the early return skipped every row below the fold. The
  honest "caught at 9 of 10 viewports" in the self-test was the symptom. Rows are scrolled into view
  first, and the number actually tested is now asserted to be non-zero.

## Candidate for graduation

Everything above is one rule with two halves:

1. **A stated property needs an executable assertion, and the assertion must measure behaviour
   rather than declaration.**
2. **The instrument must be able to report itself broken** — and a control that cannot fire is not a
   control, whether it is a mutation that cannot fire, a boolean whose limbs exclude one another, or
   a guard that runs after the error it guards.

If this recurs on another surface it should graduate out of this log into SOP-003.
