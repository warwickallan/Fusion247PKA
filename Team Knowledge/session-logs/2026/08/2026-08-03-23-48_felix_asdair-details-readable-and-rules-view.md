---
agent_id: felix
session_id: felix-asdair-details-rules-2026-08-04
timestamp: 2026-08-03T23:48:34Z
type: end-of-session
linked_sops: [SOP-003-felix-build-a-component, SOP-022-work-order-preflight]
linked_workstreams: []
linked_guidelines: [GL-003-design-system]
---

# AsdAIr: Details made readable, and a new Rules view

Warwick's words about the live Details tab were *"wtf is this... make it human readable. how the
fuck am I supposed to reference or verify this shite."* He was right. This is what changed and,
more usefully for the next agent, how it was verified without the tool that normally does it.

## The defect was worse than the brief said

The brief pointed at the `<details class="tech">` drawer dumping `JSON.stringify({history, plan,
browser, order})`. That was real, but it was not the thing on screen. The actual screamer was the
interpretation list:

```js
<div v-else v-for="(ln,i) in ..." class="item grey">
  <div class="i-title">{{ ln.raw_display || ln.title || JSON.stringify(ln) }}</div>
```

`ln.raw_display` and `ln.title` **do not exist** on the payload — the real fields are
`raw_reading_display` and `canonical_product_name_display`. So every one of 34 lines fell through
to `JSON.stringify(ln)` and rendered a whole JSON object. Same bug in the Questions list
(`q.text` → undefined → blob; the real field is `question_text_display`).

**The lesson worth keeping: an `a || b || JSON.stringify(x)` fallback chain is not defensive, it is
a silent failure that looks like defensive code.** Nothing errored. Nothing logged. The view just
quietly became a JSON dump, and it stayed that way until a human looked at it. If the shape is
unconfirmed, render *nothing* and say so — an empty state is loud, a stringify fallback is not.

## What the verification problem actually was

`services/cockpit/public/*` is served straight from the working tree, no build step, so a save is
instantly live on Warwick's phone. `node --check` only validates JS syntax — **a broken Vue
template is a perfectly valid JS string** and blanks the whole cockpit for every app.
`render-check.mjs` is broken on this machine (D-2026-08-03-11, headless Edge self-relaunches and
detaches). I confirmed `nav-check.mjs` is broken the same way, and proved it is *pre-existing* by
running it against untouched `HEAD` content: **identical 11/41 failure**, same assertion list. Its
30 static-parse assertions still pass.

So I built two instruments in the scratchpad and mutation-tested them **before** touching a file:

| Instrument | Catches | Measured limit |
|---|---|---|
| `Vue.compile()` from the vendored build | malformed expressions, bad `v-for` | **The PROD build does NOT report unclosed tags, stray closes or unterminated attributes.** It silently auto-recovers. |
| An independent structural scan (tag balance, `{{ }}` balance) | exactly the class the compiler is blind to | — |

That table is the point. I nearly shipped the compiler check alone; it passes on
`<div><span>hi</div>`. **Verifying with one instrument is how a green gets issued over ground it
never examined** — the second instrument was not belt-and-braces, it was the only thing covering
half the failure modes.

Mutation test: 7 distinct breakages injected one at a time, **7/7 caught, control clean**. Re-run
after the rebuild so the proof applied to the new template, not just the old one.

### The harness that actually found bugs

Compiling proves well-formedness. It does not prove the *expressions* survive real data — which is
precisely the class that shipped. So I also **executed the compiled render function** against the
live `/api/asdair/workspace` payload across 7 scenarios (live shop / every-section-empty /
service-down / live rulebook / read-failed / empty rulebook) and dumped the visible text.

Two things it caught that review would not have:

1. **The proxy `has` trap must return false for `_`/`$` keys**, exactly as Vue's own
   `PublicInstanceProxyHandlers` does. The compiled render function closes over `_Vue` and
   `_createElementVNode` *outside* the `with(_ctx)` block; a blanket `has: () => true` shadows
   every one with `undefined`. Found by executing it.
2. **Driving a context override is not the same as driving the ref.** My first pass overrode
   `asdairWs` on the render context, but `asdairShop` is a computed reading the *ref* — so the
   Details scenario silently rendered the offline placeholder while the harness reported a pass.
   Caught only by *reading the rendered text*, not by trusting the vnode count. A harness that
   reports a pass on the wrong branch is the same defect class as the bug it was hunting.

## Two real data bugs found in passing (reported, not fixed — backend)

- **Line 1 renders "No catalogue match" while its note says "matched by approximate alias".** The
  payload carries `matched_regular_id: null` *and* `note_display: "matched by approximate alias"`.
  Per the module's own README rule 3 a claimed match with no catalogue id should be downgraded to
  `needs_confirmation`; it is arriving as `unmatched_new_item` with a contradicting note. The UI
  shows both, so the contradiction is visible rather than resolved — resolving it in the view would
  have been inventing.
- **`asdair.rule_qa_log.asked_on` is a `date`.** `present.when()` renders it as a full ISO instant,
  printing a `T00:00:00.000Z` midnight that was never recorded — and worse, node-postgres parses
  `date` to *local* midnight, so `toISOString()` shifts the calendar day **backwards** in any zone
  ahead of UTC. Fixed inside `readRules.js` with a `dateOnly()` that reads local parts, plus a test
  pinning the timezone case.

## Design-system notes (GL-003)

Not one new colour token. Every pairing in the new CSS is an already-measured §2b row:
`--ink2` on `--panel` 7.47/7.37, on `--panel2` 7.08/6.78, on `--warn-w` 6.40/6.16 (the D-13
pairing). Two new *selectors* — `.chip.neutral`, `.chip.warn` — reuse existing pairings with
precedent (`.app-pill.down`, `.opp-conflict`). Nothing reaches for `--ink3`, and **nothing fades
text with `opacity`** (GL-003 §2b-bis / D-17 / D-18 — opacity is a contrast operation, not a
flourish). Colour is never the sole signal: every status rail is accompanied by a word chip.

One CSS trap worth recording: **`.i-why` is `nowrap` + ellipsis**, so reusing it for the matched
product name would have truncated exactly the half of the comparison Warwick is trying to verify.
That is why `.as-sub` exists as a wrapping twin, and why `.as-raw` is explicitly never truncated.

## Nothing parked for Iris

No token gap was hit. The two pre-existing open items (`--ok-ink` / `--warn-ink`, and D-17/D-18)
were not touched and remain hers.

## For the next agent

- The two harnesses live in this session's scratchpad, not the repo. **`render-check.mjs` being
  broken leaves a real hole**; landing a mutation-tested compile+structure+render check next to it
  is a decision for Larry, not a scope I could take unilaterally.
- Both a `server.mjs` change **and** a `services/asdair/cockpit-api` change need a restart, and
  they are **two different processes** (8090 and 8710). The brief named one. Verified by execution:
  8710 still advertises the old 4-route surface.
