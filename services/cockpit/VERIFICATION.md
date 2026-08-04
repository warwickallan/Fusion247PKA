# Cockpit render verification — what runs, what is broken, and why there are two instruments

**Status: current as at 2026-08-04.** Landed by Felix under WO-ZG.

## Why this file exists

`services/cockpit/public/*` is served **straight from the working tree with no build step**. Saving a
file is instantly live on Warwick's phone. There is no compile stage between an edit and the device,
so the only thing standing between a typo and a blank cockpit is a check somebody actually runs.

Two of the three checks that were supposed to do that **do not work on this machine**. The two that
replace them lived in a session scratchpad until this commit, which meant the only working render
verification in the estate would have evaporated when the session ended. That is what this file and
its two siblings fix.

## The four checks, and their real state

| Check | State | What it covers |
|---|---|---|
| `template-check.mjs` | **WORKING** — landed here | The template compiles *and* is structurally balanced |
| `render-vm-check.mjs` | **WORKING** — landed here | The template *executes* against real payload shapes |
| `render-check.mjs` | **BROKEN — environmental** | (was) full-browser render of the live cockpit |
| `nav-check.mjs` | **BROKEN — environmental** | (was) navigation across every app/view |

### The two broken ones — D-2026-08-03-11

`render-check.mjs` and `nav-check.mjs` both drive **headless Edge**, and on this machine Edge
self-relaunches into a detached process, so the harness gets nothing back and reports a failure that
has nothing to do with the code under test.

**This was established as environmental, not a code defect, by running both against untouched
`HEAD`** — where they fail identically (`nav-check.mjs`: the same 11 of 41). Do not "fix" a cockpit
change because one of these went red; check it against untouched `HEAD` first.

They are kept rather than deleted: the defect is in the environment, and on a machine with a
well-behaved Edge they are still the stronger instruments — they measure the *real* browser, which
neither replacement can.

## The two that work — and why it takes two

Both run in a Node `vm`. No browser, so neither is affected by D-2026-08-03-11. **Neither is a
substitute for the other**; they catch different classes of defect.

```sh
node services/cockpit/template-check.mjs              # is the template well-formed?
node services/cockpit/render-vm-check.mjs             # does it survive real data?

node services/cockpit/template-check.mjs  --self-test # prove each can still fail
node services/cockpit/render-vm-check.mjs --self-test
```

### `template-check.mjs` — well-formedness

Runs `vue → apps.js → app.js` in **one** vm context, in the browser's own order, with
`Vue.createApp` stubbed to capture the real options object. So the string it checks is the real
post-interpolation template, not a regex guess at it — and a duplicate top-level `const APPS` across
`apps.js` and `app.js` throws here exactly as it does in the browser. That last class is invisible to
`node --check`, because each file is valid *on its own*.

> ### The finding that makes the second instrument load-bearing
>
> **The vendored PRODUCTION `Vue.compile()` does not report unclosed tags, stray closing tags, or
> unterminated attribute quotes. It silently auto-recovers from all of them.**
>
> The dev build would warn. The prod build is what ships, and it does not. So a check built on
> `Vue.compile()` alone returns a confident green over a class of defect it never examined — and
> that is not a theoretical worry, it is why the structural scanner exists.
>
> This is measured, not assumed. Run `--self-test` and read which instrument catches what: of the
> seven mutations, **`unclosed tag`, `stray closing tag`, `unterminated attribute quote` and
> `mismatched close` are caught only by `structure:`** and never by `compiler:`. One instrument alone
> would have shipped a false green.

Hence two instruments in one file: **(A)** `Vue.compile()` for expressions and directive syntax, and
**(B)** an independent structural scan (tag balance, quote balance, `{{ }}` balance) covering exactly
what A is blind to.

### `render-vm-check.mjs` — survival against data

Compiling proves a template is well-formed. It does **not** prove the expressions inside it survive
real data.

> The bug that established this: the Details view referenced `raw_display` and `title` — **fields
> that do not exist** on the workspace payload — so all 34 lines fell through to
> `JSON.stringify(ln)`. The raw JSON on Warwick's phone was a *fallback*, not a deliberate drawer.
> It compiled perfectly. A compile check structurally cannot see it.

So this harness **executes** the compiled render function across eight scenarios (live · every
section empty · service down · rulebook live/failed/empty · about) and reports anything thrown, any
identifier the template reached for that the component does not expose, and any raw-JSON blob that
leaked into visible text.

Missing bindings are caught by a Proxy `has` trap, because Vue's browser build compiles to
`with(_ctx)` — without the trap an unknown identifier silently falls through to an outer scope
instead of failing.

## Both are mutation-tested, and that is the point

**A check that has never been made to fail is not evidence.** `--self-test` injects deliberate
breakages and asserts each is caught, then runs a control on the unmutated template asserting no
false positive. Current state, both re-verified on landing:

- `template-check.mjs` — **7/7 mutations caught, control clean**
- `render-vm-check.mjs` — **4/4 mutations caught, control clean**

`render-vm-check.mjs`'s stray-JSON detector is mutation-tested in **both directions**, deliberately:
it must catch a reinstated per-line `JSON.stringify` fallback, *and* it must **not** flag the
sanctioned collapsed "Raw payload (debugging only)" drawer. A detector that fires on the feature gets
ignored, which is the same outcome as one that misses the bug. Its first version did exactly that and
was tightened — the discriminator is now position (is the blob behind a drawer label?), not size.

## The fixtures are synthetic, deliberately

`fixtures/*.json` are hand-written, structurally faithful to the live payloads, and contain **no
household data**.

**This repository is public. The real payloads are a real household's shopping list.** They must
never be committed. To check against real data, capture a live payload somewhere outside the repo and
point the harness at it:

```sh
node services/cockpit/render-vm-check.mjs --ws /path/outside/repo/ws.json --rules /path/outside/repo/rules.json
```

Keep that capture out of Git. The committed fixtures are what CI runs.

## When you change the cockpit UI

1. Run **both** working checks with `--self-test` first — confirm the instruments still work.
2. Run both as gates.
3. **Bump nothing by hand for the service worker.** The cache version is now derived from content at
   serve time (see the header of `public/sw.js` and `sw-version.mjs`). This used to be a manual habit
   and the habit was the control; it is not any more.
4. If a browser check went red, run it against untouched `HEAD` before believing it.
