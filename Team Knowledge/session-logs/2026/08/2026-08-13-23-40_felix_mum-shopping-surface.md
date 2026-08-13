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

## The backtick, three times

`MEASURE` is a template literal. A backtick anywhere inside it — **including inside a comment
quoting a CSS selector** — ends the string, and Node reports it as a `SyntaxError` or
`ReferenceError` pointing at an unrelated word several lines away. It cost three debugging rounds
here, having already cost two on WP-B15-42 in `app.js`.

There is now a guard in `shopping-geometry-check.mjs` that refuses to run if `MEASURE` contains one,
mirroring the guard `render-vm-check.mjs` already carries. **A self-inflicted trap that recurs is a
missing control, not carelessness.**

## What the next agent should know

- **The write path does not exist.** Every write lives in `services/asdair/cockpit-api`. Her
  selections live only in the tab, and the send action says so plainly rather than faking success.
  Anyone "finishing" this must start there, not in the UI.
- **The naming gap is confirmed, not theoretical.** `asdair.regulars.name` is retailer-shaped; `aka`
  is a matching term, not a curated display name, and is absent on some rows. **Addendum E criterion
  2 cannot pass** until a curated `display_name` column exists. That is backend work.
- **All fourteen Addendum E MUM criteria are HOLD**, by construction. They need Mum.
- **The geometry gate measures Chromium, not Silk, and not her tablet.** Addendum A's five device
  checks are unrun — above all the **Tailscale power-cycle test**, the only finding with genuine
  product-failure potential.
- **Run the gates sequentially.** `nav-check` binds 8099 and the geometry check binds 8124/9333.
- `provenance-check` fails identically at untouched HEAD `111c8cd` — pre-existing, proven by stash.

## Candidate for graduation

The four instances above are one rule: **a stated property needs an executable assertion, and the
assertion must measure behaviour rather than declaration.** If it recurs on another surface, it
should graduate out of this log into SOP-003.
