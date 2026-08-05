---
agent_id: felix
session_id: build-019-live-cockpit-asdair-views
timestamp: 2026-08-03T16:34:38Z
type: end-of-session
linked_sops: [SOP-003-felix-build-a-component]
linked_workstreams: []
linked_guidelines: [GL-003-design-system]
---

# AsdAIr Overview/Details — real views, live-serving cockpit

## What I built

Dispatched mid a real live AsdAIr shop (`SHOP-2026-08-03`), with the cockpit served directly from the
working tree (no build step) to Warwick's phone. Scope: replace the shared "this view is not wired to
it yet" placeholder with real Overview/Details rendering for the `asdair` app only, per Larry's Work
Order.

**`services/cockpit/server.mjs`** — two small read-only proxies, same shape as the existing
`apiAppStatus`:
- `GET /api/asdair/workspace` → forwards to `cockpit-api`'s `GET /asdair/workspace?household=1`,
  returns the body verbatim (never reshaped), fails soft with `{ ok:false, error }`.
- `GET /api/asdair/media?shop=<id>` → streams the evidence photo through. **Added beyond the literal
  brief** because `cockpit-api` binds to `127.0.0.1:8710`; a phone browser hitting that address
  directly would be its own loopback, not the server's — the photo would silently never load without
  this proxy. Flagged this reasoning at read-back before building it.

**`services/cockpit/public/app.js`** — new `asdair`-only branch inside the existing
`.app-view` `v-else` (the shared placeholder), gated on `currentApp.key==='asdair' && status==='up'`.
Everything else's placeholder is untouched. Data flow: one `asdairWs` ref holds the raw workspace JSON
untouched, fetched once per `openApp('asdair')`, read by both Overview and Details. "What's waiting on
you" is derived ONLY from real fields (`failure`, `is_terminal`, `needs_review_display`, `stage`) —
per Larry's explicit instruction, unmapped stages fall back to the raw `stage_label_display` rather
than a guessed sentence. Fields of unconfirmed shape (`history`, `plan`, `browser`, `order`,
`interpretation`) are never turned into invented UI — they're either read defensively with a documented
fallback (`asdairPrevOrderTotal` tries the API's own `*_display` naming convention, falls back to "on
file" from the real `prior_order_known` boolean, never fabricates a number) or dumped as raw JSON in a
`.tech`/`.mono` drawer, matching the app's existing L4-technical pattern.

**`services/cockpit/public/styles.css`** — one new rule, `.asdair-photo` (display/max-width/radius/
border only), reusing `--hair`/`--panel2` and the existing 13px radius step. No new colour tokens — no
Iris gap to report.

**`services/cockpit/public/sw.js`** — bumped `CACHE` `v23` → `v24`. The shell (`app.js`, `styles.css`)
is cache-first; without this bump the change would never reach an already-visited session. This is the
exact failure mode my own contract (§"Read back before you build," the `sw.js` incident) warns about —
caught it at read-back this time.

## Verification — and a real environment finding

`render-check.mjs` (the mandated instrument) **failed identically against the untouched, committed
baseline** (verified by `git stash`-ing my three static-file changes and re-running) **and against
`https://example.com`** — headless Edge produces zero stdout/stderr for any URL in this shell, even
with an isolated `--user-data-dir`. This is a pre-existing environment issue (11 `msedge.exe` processes
were already running on this desktop; the tool doesn't isolate against that), not something my diff
caused. I did not fix `render-check.mjs` itself — out of this WP's scope and I didn't want to widen a
live-hazard diff under time pressure — but flagging it here since it affects every future cockpit
change, not just this one.

In its place I ran Vue's own compiler (`Vue.compile()`, loaded from the actual `vendor/vue.global.prod.js`
bundle, in a minimal Node `vm` context with a hand-rolled entity-decoder standing in for the browser's
`document`) directly against the edited template string. **Mutation-tested first**: an unterminated
`{{` interpolation correctly failed compilation (`missing ) after argument list`); the actual edited
template then compiled cleanly (`COMPILE OK`), as did the untouched baseline. This proves no Vue
template-syntax error was introduced — it does **not** prove the real data-shape assumptions render
correctly in a browser, which still wants a genuine `render-check.mjs` pass once the tooling issue is
independently sorted.

## What's NOT done — the live restart

`server.mjs` needs the live cockpit Node process (PID on port 8090, plain `node server.mjs`, no
watcher) **restarted** to pick up the two new `/api/asdair/*` routes — static files apply instantly,
server code does not. I attempted this (`taskkill /PID ... /F`) and it was **correctly denied by the
permission system** as a live-action gate. Until restarted: AsdAIr's health check still reports "up"
(unaffected, separate code path), but the new client branch will try `loadAsdairWorkspace()`, get a 404
against the old server, and show `currentApp.offline` ("AsdAIr's read service is not answering...") —
which is honest-shaped but **less accurate than the previous "not wired yet" copy** for the few minutes
until restart, since the read service genuinely is answering. Restarting the cockpit process does not
touch the AsdAIr order pipeline (a separate service on 8710) or the live order itself; the client already
retries `/api/state` on failure.

## Pattern for the next app

`asdairWs` / `loadAsdair*` / `asdair*` — one raw-JSON ref per app, fetched on `openApp`, read by every
view of that app, unknown-shaped fields dumped to a `.tech` drawer rather than guessed at. Deliberately
not generalised into a framework yet — only one app does this so far.

## Follow-ups for Larry

- Authorise + perform the cockpit process restart (or delegate it) so the new routes go live.
- `render-check.mjs` needs an isolated headless-Edge invocation (or a different verification path) —
  it's not currently trustworthy on a desktop with Edge already open. Worth Vera or Larry's attention,
  not something I fixed under this WP's scope.
- Once restarted, a real `render-check.mjs` pass (once fixed) plus a manual phone check of both views
  against the live `SHOP-2026-08-03` data would close this out properly.
