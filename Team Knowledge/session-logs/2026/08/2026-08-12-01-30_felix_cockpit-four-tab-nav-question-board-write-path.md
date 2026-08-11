---
agent_id: felix
session_id: WO-2026-08-11-B15-COCKPIT-UI-01
timestamp: 2026-08-12T01:30:00Z
type: end-of-session
linked_sops: [SOP-003-felix-build-a-component]
linked_workstreams: []
linked_guidelines: [GL-003-design-system]
---

# Cockpit UI — four-tab nav, question board, exception-first Shop, write path (BUILD-015 B15-26)

## What I built

Work Order `WO-2026-08-11-B15-COCKPIT-UI-01`, worktree `C:/Fusion247PKA-cockpit-ui`, branch
`build-015/b15-26-cockpit-ui`. Surface: `services/cockpit/public/**` only.

Restructured AsdAIr's own internal navigation inside the existing Fusion247 Cockpit shell (the
Home/Apps/Ideas/Brain/Outputs/System top-level nav is untouched) from the previous five views
(Overview/Details/Basket/Rules/About) into exactly four primary tabs — **Shop, Questions, Basket,
Rules** — with a settings/cog icon reaching a consolidated **Diagnostics** screen (About + History +
raw payload drawers + the technical per-line detail this build moved off the primary surface).

- **`services/cockpit/public/apps.js`** — added an optional `primary` field to the `AppView` shape
  (defaults `true`; `normaliseApp` now stamps it on every view of every app, so no other app's
  behaviour changes). AsdAIr's `views[]` re-cut to `shop / questions / basket / rules / about
  (primary:false)`.
- **`services/cockpit/public/app.js`** — the bulk of the work:
  - One canonical six-value state → presentation function (`asdairStatePresentation`), reading a
    single named field (`shop.cockpit_state`) and never recomputing a status from raw counts (AC2).
    The field is a **documented placeholder** — flagged at read-back, accepted by Larry — pending
    Keel's parallel WP (amended to additive-only this round). Absent/unknown renders an honest
    "Status unknown" fallback, never a guess.
  - Exception-first line list on Shop (default: needs-attention + changed only; "All" one tap away),
    folded in from the old Details screen since AC1 caps AsdAIr at four tabs.
  - A new Questions screen — the question board: one-tap accept per candidate, free-text override,
    "not this week", answered items collapsed but openable. Every write goes through
    `answerQuestion`'s own `allowed_replies`, never an invented action.
  - The AsdAIr write path: **one** function (`asdairCommand`) calling **one** route
    (`POST /api/asdair/command`), which the backend forwards to the shared command surface. Grepped
    and confirmed: exactly one `fetch()` call site for writes, exactly two commands invoked
    (`answerQuestion`, `correctLine`), both named exactly as the shared surface defines them.
  - "Something looks wrong" — every line, resolved or not, is tappable with a Change action
    (`correctLine`), per the design doc's escape hatch.
  - The photo: small thumbnail by default, "view original" opens the full auto-rotated (browser's own
    EXIF handling) photo in a sheet. No per-line region-crop data exists anywhere upstream yet — that
    is Part 1/vision-pipeline scope, still fog — so the honest interim is a thumbnail + full-photo
    link, never a fabricated crop.
  - Moved every developer/diagnostic surface off Shop/Questions/Basket/Rules per AC3: raw status
    keys, confidence decimals, match-basis text, catalogue ids, ASDA product ids, the raw-JSON
    debugging drawers, the shop ref, the "other shops" history list, the event timeline. All of it now
    lives behind the cog, on one consolidated Diagnostics screen — nothing was deleted, only moved.
  - New self-contained AsdAIr action sheet (photo / question / change), separate from the app's
    generic detail sheet, with its own focus-management (moves in on open, returns to the workspace
    heading on close — WCAG 2.4.3).
- **`services/cockpit/public/styles.css`** — no new colour tokens. New rules (`.app-cog`,
  `.asdair-photo-thumb`/`.asdair-photo-sm`, `.as-seg`, `.as-choice`, `.asdair-input`) all reuse
  already-measured GL-003 §2b pairings. `.as-choice` deliberately does NOT reuse `.as-tag`'s mono
  font for candidate product names — GL-003 §3 reserves mono for "measurement or machine string",
  which a product name is not.

## Verification performed

- `node services/cockpit/template-check.mjs` → **PASS** — "1 template compiled + structurally
  balanced (132103 bytes), 1 app(s) registered, views: asdair[shop|questions|basket|rules|about]".
  This is the project's own mutation-tested compile+structure gate (real `Vue.compile()` against the
  vendored production build, plus an independent tag/quote/`{{ }}` balance scan) — I found and fixed
  one genuine defect it caught (backtick characters inside two of my own HTML comments were
  prematurely terminating the outer JS template-literal string — a real `node --check` syntax error,
  caught before it could reach `git commit`, let alone Warwick's phone).
- `node services/cockpit/contrast-check.mjs` → ran clean, all eight self-validation pins still match
  (I did not touch `:root`), confirming no regression to the sixteen closed defects.
- `bash scripts/secret-scan.sh --surface services/cockpit/public` → exit 0, 9 files scanned, 0 found.
- The six-state pure function, extracted and **executed** (not re-typed) straight out of the shipped
  `app.js` via a throwaway Node script: all six canonical values plus an unrecognised value, `null`
  and `undefined` each produce a distinct, correct `{label, tone}` — pasted in the Work Order return.
- Grep-based citation of the write path: exactly one `fetch()` call site touches
  `/api/asdair/command`; exactly two commands are dispatched (`answerQuestion`, `correctLine`).
- **What I could NOT get clean, and why, honestly:** I tried to execute the real render function
  against realistic Shop/Questions fixtures using the same no-browser `vm` technique
  `render-vm-check.mjs` already proves out (that file itself is Keel's surface, not edited). My own
  throwaway reproduction hit a DOM-mock fidelity issue in Vue's compile-time entity decoder that the
  original harness's fixtures never exercise — I bisected it and confirmed the actual template TEXT
  compiles cleanly in complete isolation with the same vendored Vue build, so I'm confident this is a
  harness artefact, not a product defect, but I did not chase it to full resolution. Separately,
  `node server.mjs` (which Larry explicitly authorised for local loopback-only self-verification)
  fails to start in this worktree — `Cannot find module '../control-plane/node_modules/pg/lib/index.js'`
  from `services/cockpit/db.mjs` — an environment/dependency-installation gap in this worktree
  checkout, not something in my `file_surface`, and not something `dependency_policy: no-new-runtime-deps`
  lets me fix by running an install. **Net effect: I have strong compile/structure/logic evidence, but
  no first-person visual confirmation.** That is exactly what Vera's gate is for, and I've said so
  plainly in my final report rather than claiming more than I verified.

## Cross-WP gaps flagged (both raised at read-back, both accepted by Larry as build-now-reconcile-later)

1. `shop.cockpit_state` — the one canonical six-value field AC2 requires — does not exist in the
   backend yet (Keel's WP amended additive-only this round). Built against a documented placeholder
   field name; degrades honestly when absent.
2. `POST /api/asdair/command` — the proxy route in `services/cockpit/server.mjs` (Keel's surface, not
   mine) that the write path needs — does not exist yet either. My call is built exactly against the
   real, already-documented `POST /asdair/command` contract in `services/asdair/cockpit-api/httpApi.js`,
   so it is correct the moment that route lands.
3. **New finding, not in the read-back:** Keel's `services/cockpit/render-vm-check.mjs` carries fixed
   scenario names (`'overview'`, `'details'`) that no longer exist as view keys after this build's
   AC1-mandated restructure. Running it today throws (`currentView` resolves to `undefined` because
   `app.views.find(v => v.key === 'overview')` now finds nothing). This is expected and correct given
   what AC1/AC3 required — not a regression in my product code — but the fixture file needs updating
   to the new `shop`/`questions` keys, and that file sits outside `services/cockpit/public/**`, so I
   reported it rather than touching it.

## Design-system notes for Iris (informational, no action taken)

- `.as-choice` is a genuinely new pattern (a plain-language, clickable product-name pill) — not a
  reuse of `.as-tag`. Flagging in case Iris wants to formalise it as a named component rather than
  leave it as one-off CSS.
- The "Answered" question-history disclosure reuses `.tech`/`summary` (mono, uppercase, `--ink2`) —
  visually a "debugging drawer" treatment applied to ordinary answered-question history. Functionally
  correct (collapsed but openable, per the design doc) but the typography may read oddly to Warwick;
  parking for Vera/Iris rather than inventing a new disclosure style mid-build.

## Handoff

Route to Vera for the quality gate — I have not self-certified anything beyond what's listed above.
Two specific things worth her attention given I couldn't get a real render: (1) confirm the Shop/
Questions/Basket/Rules screens actually render against live or fixture data once Keel's parallel WP
lands enough to run `node server.mjs`; (2) WCAG check the new AsdAIr action sheet's focus management
(`asdairOpenSheet`/`asdairCloseSheet`) and the exception-filter segmented control's keyboard/AT
behaviour — I built to the pattern the rest of the app already uses but did not verify with a screen
reader.
