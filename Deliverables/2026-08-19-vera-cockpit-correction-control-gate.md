---
type: qa-report
inspector: vera
date: 2026-08-19
subject: AsdAIr answer-correction control, Fusion247 Cockpit
verdict: PASS
verdict_history: [FAIL @ 2e7ff43, PASS @ 2617c59, PASS @ dbdf041 (final)]
governance_head: dbdf04102587d117bd3151a578ff094a2f9af5ae
first_gate_head: 2e7ff43de6577e9424aa72e526010c70a83ab62e
linked_guidelines: [GL-003-design-system]
linked_sops: [SOP-005-vera-quality-gate, SOP-022-work-order-preflight]
---

# QA Report: AsdAIr answer-correction control (Fusion247 Cockpit)

**Inspector:** Vera · **Date:** 2026-08-19

| Gate | Build | Verdict |
|---|---|---|
| 1 | `2e7ff43` | **FAIL** — 3 HIGH |
| 2 (re-inspection) | `2617c59` | **PASS** — 0 CRITICAL, 0 HIGH, 1 new MEDIUM (V-10) |
| 3 (final, narrow) | `dbdf041` | **PASS** — V-10 closed, nothing open above LOW |

**Sections 1-9 below are the FIRST gate and are left as written.** Re-inspection is section 10; the final narrow gate is section 11.

Evidence folder: `Deliverables/2026-08-19-vera-cockpit-correction-control-gate/`
(12 screenshots + the 8-file read-only inspection harness, prefixed `harness-`)

---

## READ THIS BEFORE YOU INSPECT THIS CONTROL

**As of 2026-08-19 the live Cockpit workspace returns `questions.resolved: []`.**

`app.js:3269` renders the whole Resolved group behind `v-if="asdairBoardDone.length"`. With no
resolved questions, **the correction control does not exist in the live DOM at
`http://127.0.0.1:8090`** — not enabled, not disabled, not present. A visual pass against the live
Cockpit will inspect an empty region and can return a green that is true about nothing.

`command_names` **does** publish `correctAnswer` (12 names, verified live). That is a real fact about
the command surface and it says nothing about what renders. **Do not infer one from the other.** This
report exists in part because that inference was made in the brief that commissioned it.

To inspect the control at all, use the harness in the evidence folder (section 7) or wait for a shop
with settled answers.

---

## 1. Summary

The control replaces a button that rendered `Saved: "<new text>."` over a write that never happened
(`answerQuestion` is compare-and-set on `status='open'`; against a settled row it no-ops and returns
`{ok:true, changed:false, duplicate:true}`, and the UI checked only `ok`).

**On the refusal path Felix named, the replacement is correct and the trap is closed.** On two other
receipt shapes that `pipeline/commands.js` genuinely returns, it is not. **V-2 is the finding of this
gate: the guard that decides success-versus-refusal tests for the absence of a specific negative
rather than the presence of the positive the API publishes — the old path read `ok` as a result, this
one reads not-duplicate as a result.** It survived a mutation matrix because that matrix proved
rendering and gating and never reached `asdairSubmitCorrection`.

Everything measurable about the *presentation* passes, and comfortably: 16 rendered contrast pairings
across 3 breakpoints and 2 colour schemes, zero failures; no horizontal scroll anywhere; all tap
targets at or above 44px; correct modal semantics; and — checked specifically — **no deletion
vocabulary and no `--park` used as text**.

---

## 2. Scope and coverage of this verdict

**State the coverage, not just the result.**

| | |
|---|---|
| **Surface** | `services/cockpit/public/app.js`, `services/cockpit/public/styles.css` |
| **Build** | `main` at `2e7ff43de6577e9424aa72e526010c70a83ab62e`, worktree clean |
| **Commits under gate** | `c542062` (the control), `0045e14` (per-row `allowed_replies` contract) |
| **Breakpoints** | 375 / 768 / 1280 — **not supplied by the brief**; contract minimum used |
| **Colour schemes** | light and dark, via `Emulation.setEmulatedMedia` |
| **Inspected against** | GL-003 (populated 2026-07-29, amended 2026-08-13) and WCAG 2.2 AA |
| **Method** | headless Edge over CDP against a read-only proxy of the live cockpit's own bytes |
| **NOT covered** | a real end-to-end correction against a live shop; no POST was made to the live command route, and the live shop has no settled answer to correct |

---

## 3. Findings

### HIGH · V-1 — The sheet names the wrong superseded answer, contradicting its own receipt

**Where:** `app.js:1714-1719` (`asdairCorrectDone` built from the question row) and `app.js:3304`
(the control, rendered on every resolved row)
**Evidence:** `V1-superseded-row-claim.png`

The board keeps superseded rows visible — correctly — and renders an **enabled** "Change this answer"
on them. `assembleWorkspace.js:667` attaches `allowed_replies` to *every* resolved item with no
superseded exclusion, and `asdairCorrectCommandFor` therefore returns a live command for a row the
board itself labels SUPERSEDED.

The backend does not correct the row that was tapped. `commands.js:516-531`, under the heading
**"CORRECT THE NEWEST ROUND, NOT THE ONE HE POINTED AT"**, walks `parent_question_id` to the tip.

Measured, tapping the superseded round-1 row:

| | |
|---|---|
| Receipt carried | `superseded_answer_text: "Arla Cravendale Whole Milk 2L"` |
| Screen displayed | **WAS "Cravendale Semi Skimmed 2L" · yesterday at 7:42pm** |

The receipt publishes `superseded_answer_text` and `superseded_answered_at` for exactly this purpose.
`commands.js:683`: *"AC2, carried out to the caller so a card can SAY it rather than infer it."* The
sheet infers it from the tapped row instead. `app.js:1710-1713` states the reason — avoiding
client-side date formatting of the receipt's raw timestamp. **That trade buys correct formatting at
the price of a false fact**, on the one surface whose purpose is to be the record of what was asked.

Second symptom, same root: `asdairCorrectReady` (`app.js:1584`) compares the typed text against the
**tapped** row's answer rather than the tip's, so the "same answer" pre-check guards the wrong string.

**Cited rule:** the deliverable's own stated principle at `app.js:1537` — *"straight from the
command's own receipt — never re-derived here"* — plus the brief's requirement that the record of
what Warwick was actually asked survives intact.

**Fix (either; both is better):**

1. Render `was` / `when` from `r.superseded_answer_text` / `r.superseded_answered_at`. If the raw
   timestamp cannot be formatted client-side without inventing a presentation the server owns, omit
   the time rather than substitute a different row's time.
2. Disable the control where `asdairIsSuperseded(q)` is true, with a note pointing at the current
   round — the row is already visually marked, so the live affordance is the inconsistency.

---

### HIGH · V-2 — A receipt that is neither corrected nor duplicate renders as a completed supersede

**Where:** `app.js:1706` — `if (r && r.duplicate === true && r.corrected !== true)`
**Evidence:** `FALLTHRU-openround-2-after-1280-light.png`

The guard tests for the **absence of a specific negative** instead of the **presence of the positive
the API publishes**. Fed the verbatim `commands.js:571-578` return —

    { corrected:false, opened:false, duplicate:false,
      answered_open_round:true, successor_question_key:null }

— whose own recorded audit payload reads `outcome: 'answered an open round - nothing was superseded'`,
the screen rendered:

> **CHANGED**
> **WAS** "Arla Cravendale Whole Milk 2L" · today at 8:10am
> **NOW** "Oatly Barista Oat Drink 1L"
> *The original is kept on record. AsdAIr asked the question again and took your new answer.*

plus the flash **"Changed to: Oatly Barista Oat Drink 1L."**

Every clause is false for this receipt. Nothing was superseded, no round was opened, AsdAIr did not
ask again, and there is no was/now pair to show. `round` additionally renders `null` in silence,
because `question_round` is absent from this shape and `app.js:1718` reads it unconditionally.

**Reachability is ordinary, and the backend author documented it.** `commands.js:534-537`: *"the
newest round of that line is a question still waiting on him — typically a clarification AsdAIr
opened because it could not read his last answer."* Warwick answers round 1, AsdAIr opens a
clarification round, the board still shows round 1 under Resolved with a Change button, he taps it,
this receipt.

**This is the defect being closed, reappearing in the replacement.** The old path read `ok` as a
result. This one reads not-duplicate as a result.

**And it has no test.** `render-vm-check.mjs` contains **zero** assertions naming `duplicate`,
`corrected`, `answered_open_round` or `asdairSubmitCorrection`. The mutation matrix proved
`asdairSupersededBy`, `asdairSupersedes`, `asdairCanCorrect` and the `answerQuestion` guard — all of
them rendering and gating logic. **The guard that replaced the lie is the one thing left uncovered,
and that gap is the durable finding of this gate.**

**Fix:**

1. Gate the success render on `r.corrected === true`.
2. Give `answered_open_round` its own honest outcome — e.g. *"AsdAIr was still waiting on this one.
   Your answer is recorded. Nothing was superseded."*
3. Read `round` from `r.question_round` only when present.
4. Add receipt-shape scenarios to `render-vm-check.mjs` covering the full enumeration in section 6,
   and mutation-prove them.

---

### HIGH · V-3 — The refusal is silent to a screen reader; the success is announced

**Where:** `app.js:4255` — `<p class="err" v-if="asdairSheetErr">`
**Measured:** `role: null`, `aria-live: null`
**Cited rule:** WCAG 2.2 AA **4.1.3 Status Messages**

The success flash at `app.js:2973` and `app.js:3163` carries `role="status" aria-live="polite"`. The
refusal carries nothing.

Warwick presses "Change my answer", the correction is refused, and **nothing is announced**. The
sheet stays open, the button re-enables, and there is no audible change. Silence is the one signal
that does not read as refusal — it reads as *"the tap didn't register"*, and the reasonable response
is to press again.

**The asymmetry is the defect**: success speaks, refusal does not. This file already learned the
lesson elsewhere — `app.js:3677-3683` documents a live region added for precisely this reason.

**Fix:** `role="alert"` on the sheet's `.err`, and on the board-level `.err` at `app.js:3260` and
`app.js:3309`.

---

### MEDIUM · V-4 — "Nothing was written just now" is an absolute the receipt does not support

**Where:** `app.js:1707`

Two different `correctAnswer` returns reach the duplicate branch:

- `commands.js:592-599` (`unchanged:true`) — genuinely wrote nothing. The sentence is true.
- `commands.js:679-689` with `duplicate:true` — reached **after** the audit row at `commands.js:630`,
  and possibly after `opened:true` created a successor question row.

The receipt publishes `opened`; the UI ignores it.

**Fix:** reserve the absolute sentence for `r.unchanged === true`. Otherwise say what is true —
*"AsdAIr already has this answer. Nothing changed."*

---

### MEDIUM · V-5 — A raw developer error is Warwick's error message

**Where:** `app.js:1726` from `app.js:1621` from `httpApi.js:780` (`message: safeMessage(err)`) from
`commands.js:616-620`
**Evidence:** `RAWERR-2-after-1280-light.png`

Measured: 48px of 12px red text reading

> `commands: correctAnswer cannot reproduce question key "milk:2" (round 2) from any name this
> question carries on shop SHOP-2026-08-18-M128. A successor derived from a different name would be
> invisible to the planner - recorded, and inert. Refusing rather than writing one. Nothing was
> written.`

It is honest, and it says *"Nothing was written"*, so it **does not read as success** and clears the
brief's bar. It is not usable by the person the brief describes — a man checking whether the right
thing is in the trolley. The brief's own warning applies: if it is ambiguous he will not use it, and
the escape hatch will not exist.

Note the contrast within the same change: `asdair-list.mjs:226-230` already writes excellent plain
English for the *proxy's* own failures, and distinguishes carefully between "nothing was changed" and
"I cannot tell whether that went through". Upstream errors bypass that care entirely.

**Fix:** map `d.error` codes to plain sentences with an honest generic fallback; put the raw text in
the `.tech` drawer, not on the primary line.

---

### LOW findings

| ID | Where | Finding | Fix |
|---|---|---|---|
| **V-6** | `app.js:3273` | The `as-chip-old` span and the following `Answered` text have no separator. Visually spaced by `margin-right:6px`, but `textContent` yields **`SUPERSEDEDANSWERED`** — what a screen reader may announce and what copy-paste produces. | Insert a space or separator node. |
| **V-7** | `app.js:3304-3308` | The disabled control has `aria-describedby: null`; its plain-English reason is a sibling `p.as-note`. Reading order carries it, so not a failure. | `aria-disabled` plus `aria-describedby` pointing at the note, to make it certain. |
| **V-8** | `styles.css:603` | **PRE-EXISTING, NOT THIS WORK.** `.act:disabled { opacity:.5 }` composites the disabled label to a measured **3.13:1**. WCAG 1.4.3 exempts inactive components, so **not a WCAG failure**; GL-003 section 2b-bis governs it as a *state* fade with a compensating cue present. | **Park with D-18 in Iris's queue.** Do not attach it to this change. |
| **V-9** | `styles.css:301-330` | Radius drift, advisory only (GL-003 section 4 is `<unset>`): `999px` chips and `8px` panels sit outside the observed ladder for their surface tier. Visually indistinguishable from `20px` at 10.5px chip height. | None required; note if a radius scale is ever tokenised. |

---

## 4. What passes — measured, not assumed

1. **Refusal does not read as success — PASS on the named path.** Real `duplicate` receipt: no
   "Saved", `.as-flash` measured `null`, sheet stays open, original still on screen, message reads
   *"You already made this change — AsdAIr has it as ... . Nothing was written just now."*
   (`REFUSE-dup-2-after-1280-light.png`, `S-sheet-refused-375-light.png`)
2. **The original stays visible and legible — PASS.** The "ON RECORD NOW — KEPT, WHATEVER YOU DO
   HERE" panel renders `--ink` on `--panel2` at **15.55 / 12.65**, above the field, throughout; and
   survives on the board with the chain block. No strikethrough, no `--stop`, no red anywhere in the
   superseded treatment.
3. **No deletion vocabulary — PASS.** Ten words (delete, remove, eras, wipe, destroy, discard, gone,
   lost, strike, overwrit) scanned across board and sheet in four scenarios and both outcomes. The
   only hits are *"wet wipes"* and *"baby wipes"* — Warwick's own shopping list.
4. **The disabled state is honest — PASS.** 140x44, greyed, honest `title`, and a visible
   plain-English sentence naming the reason. (`D1-disabled-1280-light.png`, `D1-disabled-1280-dark.png`)
5. **`--park` is not used as text anywhere in the correction states.** Verified in source and by
   computed style. Felix's parked measurement (4.49 light / 3.14 dark) is correct and correctly
   avoided; every `--park` use in the file remains a `border-left-color` or a dot.
6. **Contrast: 16 rendered pairings across 3 breakpoints and 2 schemes — all AA, zero failures.**
   Exceeds the 10/10 claim. Full table in section 5.
7. **Responsive: clean.** `scrollWidth == clientWidth` at 375, 768 and 1280 in all six runs. No
   clipping, no truncation, sensible reflow to the bottom-sheet form on mobile.
8. **Tap targets: all at or above 44px.** The 20x20 checkbox sits inside a 335-640 x 44 label, which
   is the target — as the CSS comment claims. (WCAG 2.5.5 / 2.5.8)
9. **Dialog semantics: correct.** `role="dialog"`, `aria-modal="true"`,
   `aria-label="Change an answer you already gave"`, `nav.nav` and `div.shell-main` both `inert`,
   focus moved in on open, trap sentinels at both ends, both inputs labelled,
   `aria-describedby="asdair-correct-help"` resolves, focus ring `2px solid var(--accent)`.
10. **The deliberate act works.** Measured: submit disabled with text only; disabled with tick only;
    enabled only with both.
11. **No new `opacity` on text.** GL-003 section 2b-bis respected — notable given D-17 and D-18 are
    the estate's open contrast debt.

---

## 5. Measured contrast — every new pairing, both schemes

Computed from `getComputedStyle` on the rendered page (effective opacity folded in), per GL-003
section 2d. **The model self-validated against three GL-003 section 2b anchors before printing**
(`--ink` on `--panel` 16.40, `--ink2` on `--panel` 7.47, `--accent-ink` on `--panel` 7.70) and
refuses to emit a figure otherwise. Identical at 375, 768 and 1280.

| Selector | Size | Light | Dark | Verdict |
|---|---|---|---|---|
| `.as-chip-old` | 10.5px | 7.08 | 6.78 | PASS |
| `.as-chip-new` | 10.5px | 6.63 | 8.23 | PASS |
| `.as-superseded > summary` | 11px | 7.08 | 6.78 | PASS |
| `.as-chain` | 12.5px | 7.08 | 6.78 | PASS |
| `.as-was-h` | 11px | 7.08 | 6.78 | PASS |
| `.as-was-a` | 14px | 15.55 | 12.65 | PASS |
| `.as-was-w` | 12.5px | 7.08 | 6.78 | PASS |
| `.as-done-h` | 11px | 14.39 | 11.77 | PASS |
| `.as-done-b` | 13.5px | 14.39 | 11.77 | PASS |
| `.as-confirm` and its span | 13px | 16.40 | 13.76 | PASS |
| `.sheet-card .err` | 12px | 5.02 | 5.30 | PASS |
| `.as-note` | 12.5px | 7.47 | 7.37 | PASS |
| `.as-flash` | 13px | 6.55 | 6.30 | PASS |

Lowest figure in the set is `.sheet-card .err` at 5.02 light — `--stop` on `--panel`, which GL-003
section 2b already records as the one status colour that is AA-safe as text in both schemes.

---

## 6. The receipt enumeration — pin this, it is what V-2 was missing

Every shape `pipeline/commands.js` `correctAnswer` can return, and what the UI does with it today.

| # | Source | Receipt | UI today | Correct? |
|---|---|---|---|---|
| 1a | `commands.js:571-578` | `corrected:false, opened:false, duplicate:false, answered_open_round:true` | **"CHANGED / WAS ... / NOW ..."** plus flash | NO — **V-2** |
| 1b | `commands.js:571-578` | `corrected:false, duplicate:true, answered_open_round:true` | refusal | yes |
| 2 | `commands.js:592-599` | `corrected:false, duplicate:true, unchanged:true` | refusal, "nothing was written" | yes |
| 3a | `commands.js:679-689` | `corrected:true, opened:true, duplicate:false` | success | yes |
| 3b | `commands.js:679-689` | `corrected:false, duplicate:true, opened:true` | refusal, "nothing was written" | partly — **V-4**, a row *was* written |
| 4 | `commands.js:615-620` throw | HTTP 500, raw `message` | raw text in `.err` | partly — **V-5** |
| 5 | `httpApi.js:756-760` | HTTP 400 `unknown_command` | plain English in `.err` | yes |

**Note on shape 2, and how to reach a refusal by hand.** The client's "same answer" pre-check
(`app.js:1584`) is case-sensitive and does not collapse internal whitespace; the server
(`commands.js:589`) is case-insensitive and does. **Retyping an existing answer with different
capitalisation therefore passes the client check and is refused by the server** — the cheapest way to
exercise the refusal path without a harness.

---

## 7. How to reproduce this inspection

The live Cockpit cannot show this control (see the banner at the top of this report). The harness in
the evidence folder can, and it is read-only by construction.

    node Deliverables/2026-08-19-vera-cockpit-correction-control-gate/harness-vera-stub.mjs

- Serves on **127.0.0.1:8098** and proxies **the live cockpit's own bytes verbatim** from 8090, so
  what renders is the shipped artefact and not a copy.
- Shapes exactly two payloads: `questions.resolved` on `/api/asdair/workspace`, and the receipt
  returned by `/api/asdair/command`.
- **`/api/asdair/command` is never forwarded upstream.** No live write is possible.
- Receipt fixtures are **copied from `pipeline/commands.js`, not invented** — this matters: an
  invented receipt would only have re-tested the inspector's own assumptions, which is the same
  error one layer down.
- Scenario switch:
  `GET /vera/set?s=chain|plain|unpublished&r=corrected|duplicate|dupOpened|openRound|refuseKey|unknown`

`harness-vera-cdp.mjs` drives headless Edge over the DevTools protocol with no npm dependencies
(Node 22 global `WebSocket`); `harness-vera-sweep.mjs` runs the breakpoint by scheme by contrast
matrix. **Do not point `render-check.mjs` or any probe at 8090 for this** — GL-003 section 2d already
warns that 8090 is the live cockpit.

**Recommendation to Larry, not a decision:** if this control is going to be re-gated repeatedly, the
harness belongs in `services/cockpit/` as Felix's tooling rather than as a QA artefact under
`Deliverables/`. That is a routing call and it is not mine to make.

---

## 8. Verdict

**FAIL.** Three HIGH findings — SOP-005 section "Verdict rules": three or more HIGH is a hard fail.

It also fails on merit rather than on the count. **V-2 is the defect class this change exists to
close, reappearing inside the replacement, on a path the backend author documented as the ordinary
case, and surviving a mutation matrix that never reached the guard in question.**

Note what this FAIL is *not*. The control is currently unreachable on the live surface, so nothing is
lying to Warwick today. The finding is that **the escape hatch will lie the first time it is used in
these two ways** — which, given a real weekly shop was lost on 2026-08-17 for want of exactly this
escape hatch, is the right time to catch it.

Fix V-1, V-2 and V-3. V-4 and V-5 are cheap and in the same file. Then close the coverage gap V-2
exposed. **Vera re-inspects. No second-hand confirmation.**

---

## 9. Note on the commissioning brief

Recorded because SOP-022 exists for this and because the estate has spent two days on this exact
failure mode.

The brief stated: *"It is published now (12 names, verified live), so the enabled path is what you
will see."* The twelve names were real and verified. What would render was asserted, not measured,
and it was wrong — `questions.resolved` is empty and the control renders nowhere. **A confident
statement derived from a real measurement of a different thing.** Larry recorded the miss himself on
return and it is his omission, not a defect in the work under gate.

The operational consequence is the banner at the top of this report, which exists so the next
inspector does not walk into the same empty region.

Two other brief gaps, recorded without argument: **no breakpoints were named** (contract minimum
375 / 768 / 1280 used), and **no mechanism was given for forcing a backend refusal** on a live shop
that has no settled answer to refuse against. Both were resolved by the harness in section 7.

---

## References

- [[GL-003-design-system]] — section 2a token intent, 2b measured pairings, 2b-bis the normative
  opacity rule, 2d the measurement method
- [[SOP-005-vera-quality-gate]] — the gate procedure and the severity ladder
- [[SOP-022-work-order-preflight]] — the read-back gate that caught the brief defect in section 9
- `services/cockpit/README.md` — the estate SSOT for "the Cockpit serves `public/*` straight off disk"
- `services/asdair/pipeline/commands.js` — `correctAnswer`, the authority for section 6
- `services/asdair/cockpit-api/assembleWorkspace.js:617-669` — the resolved-item payload contract

---

# 10. RE-INSPECTION — build `2617c59` — **PASS**

Fixes at `ed03ba7`, merged to `main` at `2617c59`. Re-inspected 2026-08-19.
Evidence prefixed `R2-` in the evidence folder.

## 10.1 Live state, established by execution

| Check | Result |
|---|---|
| `main` HEAD | `2617c59b8e1d23784f5b61d1fc0bec67a15032f9`, worktree clean |
| `:8710/asdair/health` | 12 command names, `correctAnswer` present |
| `POST :8090/api/asdair/command` | 400 — route exists |
| `:8090` workspace | **`questions.resolved: []` — STILL EMPTY** |

**The banner at the top of this report still applies.** The control remains absent from the live DOM.
Larry did not assert otherwise this time; I checked, and it is unchanged.

## 10.2 A NEAR-MISS THAT ALMOST BECAME A SECOND FALSE FAIL

**On first re-run, V-2 reproduced exactly** — same false "CHANGED", same WAS/NOW pair, same flash.

It was a **stale service-worker bundle in my own harness**, not a defect. The Cockpit ships a
cache-first `sw.js`; my Edge profile persisted between runs and executed the old `app.js` while the
network served the new one.

Three checks, and **two of them were misleading**:

1. `md5` on the wire — disk equals 8090 equals 8098, new function present. Proved transport only.
2. Byte length inside the page — 332,026 against 334,143 on disk. **Nearly written up as staleness.
   It is UTF-8 bytes versus UTF-16 code units.** A false finding, caught only by asking why the gap
   was 2,117 rather than large.
3. A DOM marker present only in the fixed build (`.as-sep`). **Decisive and cheap.**

**The harness now refuses to inspect without proof of provenance**: service workers unregistered and
caches cleared on navigate, `Network.setBypassServiceWorker` and `setCacheDisabled` on, and
`assertFreshBundle` throwing before any assertion runs.

Recorded here rather than quietly fixed, because a QA instrument that cannot prove which bytes it
measured is the same class of defect as the control it was inspecting.

## 10.3 The decision function, executed standalone from the shipped file

`asdairCorrectionOutcome` extracted from `services/cockpit/public/app.js` by brace-matching and run
in Node — possible **only because Felix separated it from the write**, which is the actual repair.

| Receipt shape | kind | ok | done |
|---|---|---|---|
| `answered_open_round:true, corrected:false, duplicate:false` | `answered_open_round` | true | null |
| `answered_open_round:true, duplicate:true` | `answered_open_round` | true | null — **V-10** |
| `duplicate:true, unchanged:true` | `unchanged` | false | null |
| `corrected:true, superseded_answer_text` present | `corrected` | true | `was` from the receipt |
| `corrected:false, duplicate:true, opened:true` | `duplicate` | false | null |
| `corrected:true`, **no** `superseded_answer_text` | `corrected` | true | **`was=null`** — absent, not wrong |
| novel shape | `unknown` | **false** | null |
| `null` | `unknown` | **false** | null |
| `corrected:true, unchanged:true` | `unchanged` | false | null |

An unrecognised shape returns `unknown` and never success. The `was=null` row is the one that proves
V-1 is genuinely receipt-sourced rather than coincidentally matching the tapped row.

## 10.4 Findings from gate 1 — status

| ID | Sev | Status | Verified by |
|---|---|---|---|
| **V-1** | HIGH | **CLOSED** | Superseded row `disabled=true`, title "Already changed — the later answer is the one to edit", tapping opens nothing. WAS from `r.superseded_answer_text`. Sheet opens on the chain tip. `R2-V1-board.png` |
| **V-2** | HIGH | **CLOSED** | `answered_open_round` closes the sheet with the honest sentence. No CHANGED, no WAS/NOW. `R2-openround-2-after-1280-light.png` |
| **V-3** | HIGH | **CLOSED** | `.err-region` present **before** any error, `role="alert" aria-live="assertive" aria-atomic="true"`. `R2-a11y-region.png` |
| **V-4** | MED | **CLOSED** | The absolute "nothing was written just now" is now reserved for `unchanged`. |
| **V-5** | MED | **CLOSED** | Plain English, with the raw text kept in a "What AsdAIr actually said" drawer. `R2-refuseKey-2-after-1280-light.png` |
| **V-6** | LOW | **CLOSED** | `.as-sep` separator — renders `SUPERSEDED · ANSWERED · ...` |
| **V-7** | LOW | **CLOSED** | `aria-describedby="as-nocorrect-a1"`, resolves. Residual, non-blocking: still `disabled` rather than `aria-disabled`, so it is not announced on focus; the reason sits in reading order immediately after. |
| **V-8** | LOW | **PARKED** | Unchanged, pre-existing. Measured **3.17 light / 4.32 dark**. WCAG 1.4.3 exempts inactive components. Parked with D-18 per Larry's ruling. |
| **V-9** | LOW | Open, advisory | Radius drift. GL-003 section 4 is `<unset>`. |

**The disabled copy is materially better, and it is worth naming.** The old note claimed *"AsdAIr does
not yet publish a command for correcting a settled answer"* on a superseded row — **false, and it
would have sent Warwick to wait for a capability that had already shipped.** It now reads: *"This
answer has already been changed, so it is kept here as history rather than offered for editing. The
answer that counts now is the later one — change that one instead."* True, and actionable.

## 10.5 The coverage gap — closed, and verified independently

`render-vm-check.mjs` went from **zero** assertions naming the receipt fields to **12 direct calls**
to `asdairCorrectionOutcome`. Gate: **71 scenarios, 277 assertions, 0 failed.**

I did not take the mutation claim on trust. **Four mutants of my own**, run by restoring the shipped
defect in `app.js` and re-running Felix's gate:

| Mutant | Result | Assertion that fired |
|---|---|---|
| `answered_open_round` branch disabled | **RED** (2 assertions) | "answered_open_round is NOT a supersede and must never render as one" |
| success gated on not-duplicate | **RED** (1) | "an UNRECOGNISED receipt is unknown, never success" |
| WAS ignores `superseded_answer_text` | **RED** (1) | "WAS is the receipt's superseded_answer_text, never the row Warwick tapped" |
| unknown-shape guard removed | **RED** (1) | "an UNRECOGNISED receipt is unknown, never success" |

Source restored under `finally` and verified: md5 `0a26133dea73a370b17b4b6e0bed5d7e`, identical
before and after; `git status` clean. Runner at `harness-vera-mutate.mjs`.

**Method note:** the fourth mutant first reported SKIP because the file is **CRLF** and my multi-line
pattern used a bare newline. My runner then printed "AT LEAST ONE MUTANT SURVIVED" — **conflating
skipped with survived, which is a control misreporting its own coverage.** Fixed by deriving the line
ending from the source. Both halves are recorded in the session log.

## 10.6 NEW — MEDIUM · V-10: a raced no-op on an open round reports as a successful write

**Where:** `app.js`, `asdairCorrectionOutcome` — `r.answered_open_round === true` is tested **before**
`r.duplicate === true`.
**Evidence:** `R2-openrounddup-2-after-1280-light.png`

`commands.js:571-578` sets `duplicate: answeredOpen.changed === false`. When the tip was open but the
write changed nothing — Warwick answered the same clarification **in Telegram** seconds earlier, the
two named control surfaces racing — the receipt is `answered_open_round:true` with `duplicate:true`.

Measured: the sheet closes and the flash says *"...your answer went to that open question."* **His
answer did not land; someone else's did.**

Narrow and self-correcting — it needs a sub-second race, it claims no supersede, and the board
reloads immediately with the truth on screen. **Non-blocking.**

**Fix, one line:** test `r.duplicate === true` before `r.answered_open_round === true`, or gate the
open-round branch on `r.duplicate !== true`, and say *"AsdAIr already had an answer for that question
— nothing was written just now. Check the board."*

## 10.7 Presentation re-swept — both files changed, so nothing was carried over

- **Contrast:** all pairings AA at 375 / 768 / 1280 in both schemes, including the new `.as-sep`
  (7.08 / 6.78). Model self-validated against three GL-003 anchors before printing. The only measured
  sub-AA figure is the **exempt** disabled state (V-8).
- **Responsive:** `scrollWidth == clientWidth` at all three widths, both schemes.
- **Tap targets:** unchanged and compliant — 44px buttons, 44px confirm label.
- **Deletion vocabulary:** re-scanned across the **new** copy in four scenarios and both outcomes.
  **CLEAN.** The only hits remain "wet wipes" and "baby wipes" from Warwick's own list.

## 10.8 Verdict

**PASS** at `2617c59`. Zero CRITICAL, zero HIGH. SOP-005: *"PASS — no CRITICAL or HIGH findings.
MEDIUM and LOW findings are documented but don't block."*

All three HIGH findings are closed and each was verified by execution rather than by reading the
diff. V-2's repair is the one that matters: **the decision was moved out of the write and made pure,
which is why it could be tested at all** — the defect survived the first gate precisely because it sat
where no test could reach it.

**Coverage of this PASS, stated plainly.** Inspected: the rendered control at three breakpoints in two
colour schemes; every receipt shape `correctAnswer` can return; the decision function executed
standalone from the shipped file; four independent mutants. **NOT inspected: a real end-to-end
correction against a live shop** — impossible while `questions.resolved` is empty, and it remains the
one thing no gate here has proven.

**Open against this build:** V-10 (MEDIUM, one line), V-9 (LOW, advisory), V-8 (LOW, pre-existing,
parked with D-18), and V-7's residual `aria-disabled` note.

---

# 11. FINAL GATE — build `dbdf041` — **PASS**

V-10 fix at `c66f14c`, merged to `main` at `dbdf041`. Narrow re-inspection, 2026-08-19.
Evidence prefixed `R3-`.

## 11.1 Scope, and why it is narrow

`git diff 2617c59..dbdf041` touches **`app.js` (+46/-15) and `render-vm-check.mjs` (+47) only**.
`styles.css` is byte-identical (`ae9ae5b71821f13312eef199662f463b`), so the 16-pairing contrast sweep
from gate 2 carries; I confirmed no new class was introduced and re-measured `.err` in place.
Bytes on the wire match disk (`dbe34dd084f66fee1005e033e21f0df0`). `app.js` is served off disk, so
this build is live.

**`:8090` workspace still returns `questions.resolved: []`.** Unchanged across all three gates. The
banner at the top of this report stands.

## 11.2 V-10 — CLOSED

`r.duplicate === true` is now tested before `r.answered_open_round === true`, and before `corrected`.
The shipped function was extracted from `app.js` and executed standalone across **twelve** shapes:

| Shape | kind | ok |
|---|---|---|
| open round, LANDED | `answered_open_round` | true |
| open round, **RACE LOST** | `open_round_already_answered` | **false** |
| unchanged (same words) | `unchanged` | false |
| corrected (supersede) | `corrected` | true |
| redelivery of his own correction | `duplicate` | false |
| corrected, no `superseded_answer_text` | `corrected` | true (`was=null`) |
| **contradictory** `corrected+duplicate` | `duplicate` | **false — fails closed** |
| **contradictory** + `answered_open_round` | `open_round_already_answered` | **false** |
| `unchanged+corrected` | `unchanged` | false |
| novel future shape / `null` / `{}` | `unknown` | false |

**Over-claiming outcomes: 0.** Every `ok:true` is backed by a receipt that reports a real write.

## 11.3 The two new sentences — the part worth the eye

Both were exercised through the UI at 1280 and 375. Neither names who answered, and neither asserts
what is recorded:

- **Race lost** — *"AsdAIr had already asked about this line again, and that question had been
  answered before this arrived — so «X» is not what is recorded. It may have been answered on
  Telegram. Reload to see what AsdAIr has."*
- **Duplicate** — *"AsdAIr already has an answer recorded for this line, so «X» was not taken. It may
  have been answered on Telegram. Reload to see what AsdAIr has."*

The old sentence had two halves and both could be false — the winning answer may have come from
Telegram, and first-answer-wins means the stored value need not be `X`. **Naming the other control
surface is the substantive improvement**: it turns "something odd happened" into a place to look,
which is what the single non-technical user of this screen actually needs.

`R3-openRoundDup-2-after-1280-light.png`, `R3-dupOpened-2-after-1280-light.png`, `R3-newcopy-375.png`

**One observation, non-blocking, no action recommended.** On the redelivery shape the answer *is*
recorded as `X`, so *"so «X» was not taken"* under-claims. The trade is deliberate and documented in
the code: it refuses to assert a stored value it cannot know, and the next sentence sends him to look.
**Under-claiming with a stated remedy is the safe direction** and I would not change it.

## 11.4 Regression — the three HIGH still closed

Re-verified by execution at **1280 and 375**:

| | Result |
|---|---|
| V-1 | 2 controls; tip enabled, superseded `disabled=true`, `aria-describedby` resolves |
| V-2 | un-raced open round still succeeds honestly — sheet closes, honest flash, no WAS/NOW |
| V-3 | `.err-region` present before any error, `role=alert` / `assertive` / `atomic` |
| V-6 | `.as-sep` present |
| Overflow | `scrollWidth == clientWidth` at both widths |
| Longer copy | error not clipped (`errBottom` inside `cardBottom`), no intra-element scroll |
| Vocabulary | **CLEAN** across all five outcome sentences |

## 11.5 Coverage verified independently

Gate: **71 scenarios, 284 assertions, 0 failed** (up from 277). Three mutants of my own, with
**whole-line anchors required to occur exactly once** — the discipline the builder's own
substring-anchor defect argues for:

| Mutant | Result |
|---|---|
| V-10 restored (duplicate no longer short-circuits the open round) | **RED** (1) |
| duplicate-first block removed entirely | **RED** (5) |
| blanket refusal — the un-raced open round becomes a failure | **RED** (2) |

`applied 3/3, RED 3/3`. Source restored under `finally`, md5 `dbe34dd084f66fee1005e033e21f0df0`
identical, `git status -- services/` clean.

**The third mutant is the one that matters most and is easy to omit.** It proves the fix did not
over-correct into refusing every open-round receipt — caught by *"the un-raced open round is STILL a
successful write — the fix is not a blanket refusal"*. **A guard in both directions, not just against
the reported defect.**

## 11.6 Verdict

**PASS** at `dbdf041`. Zero CRITICAL, zero HIGH, zero MEDIUM.

**Open, all LOW and none blocking:** V-9 (radius drift, advisory, GL-003 section 4 is `<unset>`),
V-8 (pre-existing `.act:disabled` opacity, WCAG-exempt, parked with D-18), V-7 residual
(`disabled` rather than `aria-disabled`, reason present in reading order).

**Coverage of this PASS, stated plainly.** Inspected: every receipt shape `correctAnswer` can return,
plus three contradictory and three malformed shapes, executed against the function as shipped; both
new sentences rendered at two breakpoints; the three prior HIGH re-verified; vocabulary re-scanned;
three independent mutants. **NOT inspected, across all three gates: a real end-to-end correction
against a live shop** — impossible while `questions.resolved` is empty. That remains the single
outstanding piece of evidence for this control, and it is a fact about the shop, not about the code.
