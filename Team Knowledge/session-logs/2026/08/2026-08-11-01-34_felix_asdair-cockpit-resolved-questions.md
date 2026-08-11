---
agent_id: felix
session_id: b15-23-asdair-app-restoration
timestamp: 2026-08-11T01:34:49Z
type: end-of-session
linked_sops: [SOP-003-felix-build-a-component]
linked_workstreams: []
linked_guidelines: [GL-003-design-system, GL-012-secrets-store-access-boundary]
---

# AsdAIr cockpit: the app already existed — the gap was "resolved vs outstanding"

## What I was asked to build

Larry's brief (BUILD-015, `b15-23-asdair-app-restoration`) described the AsdAIr cockpit tile as a
placeholder with no real UI behind it, and asked me to build a full human-readable page: what was on
the list, interpreted product/quantity, what's uncertain, what's resolved vs outstanding, and whether
the shop is blocked — matching CAPAE's "human-readable, relevant, informative, never raw rows" bar.

## What I actually found (read the codebase before building, per my own SOP)

The brief was stale. `services/cockpit/public/app.js` already carries a full AsdAIr app — Overview,
Details, Basket, Rules, About — wired to a real read service
(`services/asdair/cockpit-api`, `readWorkspace.js` / `assembleWorkspace.js` / `readRules.js` /
`readPacket.js`) that already does almost everything the brief asked for: verbatim raw readings next
to catalogue-grounded product names, per-line status chips, a reconciled/not-reconciled basket view,
a plain-English "waiting on you" line, and a collapsed raw-JSON drawer that is never the primary
surface. `apps.js`'s own comment claiming "not deployed as a real UI" was wrong; I corrected it.

The one genuine, load-bearing gap against Warwick's acceptance bar: **`buildQuestions()` in
`assembleWorkspace.js` only ever returned OPEN questions.** Answered and skipped questions were read
from `asdair.shop_question` and then silently dropped — there was no way to see what had already been
resolved, which is exactly requirement 3 of the brief ("answered questions shown with their answer,
open questions shown as still open, in plain language"). Confirmed against the REAL live shop
(SHOP-2026-08-10-M64, id 14 — last night's misread shop) via the already-running read-service: its
`last_event_display` showed a question had been answered ("Richmond 12 Skinless Pork Sausages 319g"),
but nothing in the UI could show that.

I also found `asdair.shop_decision` (migration 017) — the durable, per-question decision record — was
never read at all by the cockpit-api, even though it exists specifically to answer "what did an answer
MEAN for this shop".

## What I built

- `services/asdair/cockpit-api/readWorkspace.js` — added `DECISIONS_SQL` (SELECT-only, asserted by
  the existing `ALL_SQL` test) and `readDecisions()`, which degrades to `[]` if `asdair.shop_decision`
  doesn't exist yet on a given database (same pattern as the existing `probeItemColumns`) — a missing
  table is "not yet decided", never a 500.
- `services/asdair/cockpit-api/assembleWorkspace.js` — `buildQuestions()` now returns BOTH `items`
  (open, unchanged shape) and a new `resolved` array (newest-first): Warwick's own answer verbatim
  (`answer_text_display`), plus — only when a `shop_decision` row exists — a plain-language
  `resolution_display` translated from `decision_kind` and the catalogue-grounded product name (never
  from model prose; `decided_regular_id` is looked up by id exactly like every other grounded field in
  this module). No decision row → the raw answer is shown alone, never a guessed sentence.
- `services/cockpit/public/app.js` — Details view now shows "Still waiting on you" (renamed from "Open
  questions", and its per-item eyebrow no longer shows the raw `question_key` — replaced with "Needs
  your answer") alongside a new "Resolved" section (`You said: "…"` + `→ Resolved to …` when a
  decision exists). Overview's Questions stat now reads "N still waiting on you · M resolved" and
  turns amber when N > 0. `asdairWaitingOn()` now says "Waiting on 2 answers in Telegram before this
  shop can go ahead" instead of the generic "there's a decision to make" — matches the brief's own
  example sentence.
- Small, deliberate extra: added an optional `?app=<key>&view=<key>` deep-link on mount (silently
  ignored if absent/unknown) — partly so I could render-check the AsdAIr Details view directly, partly
  because it's real product value matching the existing `checklistPath` precedent (a cockpit URL
  handed to Warwick from a Telegram card).
- `services/asdair/cockpit-api/assembleWorkspace.test.js` — 4 new unit tests for the resolved-question
  logic (verbatim-answer-with-no-decision, skipped-with-no-decision, decision-translated sentence
  grounded by catalogue id, newest-first ordering). 28/28 pass; full cockpit-api suite 152/152.
- `services/cockpit/fixtures/workspace.sample.json` + `render-vm-check.mjs` — the committed fixture's
  `questions` shape was ITSELF stale (field names like `question_display`/`answered_display` that
  don't exist on the real payload — the exact "fixture drifted from reality" failure this harness was
  built to catch, just never applied to this field). Fixed it to the real shape and added 4 explicit
  assertions to the `DETAILS (live shop)` scenario. `--self-test` still catches all 7 mutation classes
  with the new fixture; 65/65 assertions green on the control.

## How I verified render (not just tests)

No memory of prior sessions, so: started the already-registered `MyPKA-AsdAIr-ReadService` scheduled
task (it wasn't running), confirmed it reaches the real database, and ran my worktree's `server.mjs`
on port 8099 (proxying to that real service) to render-check the pre-existing content against real
production data (shop 14) — confirmed no regressions. For the NEW "Resolved" section specifically —
which the currently-running (unmodified, primary-checkout) read-service can't emit yet — I did **not**
start my own instance against the real database, because that would mean personally supplying
`--env-file` arguments into `C:\.fusion247\` myself (GL-012; my Work Order's `private_surface: none`
means zero access, and starting a pre-registered scheduled task is a different, already-authorised
action from constructing a new credential-loading path myself). Instead I generated a fixture via the
REAL `assembleWorkspace()` function (not hand-typed JSON) using realistic values, served it from a
throwaway static+stub HTTP server in scratchpad, and dumped the rendered DOM with headless Edge. Both
render passes are on record; scratch artefacts were not committed.

## Design-system compliance

Every class used (`.item.amber/.green/.grey`, `.as-stack`, `.as-sub`, `.as-sub.strong`, `.as-note`,
`.i-eyebrow`, `.g-count`) already exists in `styles.css` and is already measured in GL-003 §2b as
AA-passing. No new token, no new opacity composition (so none of the D-17/D-18 defect class). Ran
`contrast-check.mjs`, `template-check.mjs`, `nav-check.mjs`, `render-vm-check.mjs` (incl.
`--self-test`) — all clean; `contrast-check.mjs`'s output is unchanged from GL-003's own documented
baseline, confirming nothing new was introduced.

## What's parked for Iris

Nothing new. The two open design-system defects (D-17, D-18, both opacity-compositing) are pre-existing
and untouched by this work — I introduced no new `opacity` rule.

## Handoff

Branch `build-015/b15-23-asdair-app-restoration`, worktree `C:\Fusion247PKA-asdair-app`, pushed to
origin. Not merged. Route to Vera for the quality gate.
