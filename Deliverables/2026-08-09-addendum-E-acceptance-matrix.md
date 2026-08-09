# Addendum E — Acceptance Matrix: "MUM can use it"

**Author:** Vera (QA Specialist) · **Date:** 2026-08-09
**Status:** SPECIFICATION OF A FUTURE GATE. **NON-GATING.**
**Scope:** How the future post-build addendum will be judged. This document does **not** grade, alter, extend, delay or re-open BUILD-015. No BUILD-015 branch, worktree or executable head was read, touched or inspected to produce it.
**Repo hygiene:** PUBLIC repo. No household personal data appears here, and none may be pasted into it later — see §D.

---

## 0. The bar this matrix encodes

> **"This is not satisfied because a developer can operate the page on Chrome. The post-build acceptance must ultimately demonstrate that MUM can use it."** — Warwick

**Subject:** Mum, 84, technology-phobic, poor eyesight, poor coordination.
**North Star:** she creates and resolves her own weekly shop from an Amazon Fire tablet.
**Boundary of success:** Warwick's *first required* operational intervention is the ASDA checkout and payment. Any earlier intervention by Warwick — including a single "let me just tap that for you" — is a **FAIL of criterion 13**, not a rough edge.

### 0.1 The three evidence classes — used in every row below

| Class | Meaning | Who produces it | What it can and cannot prove |
|---|---|---|---|
| **DEV** | Developer-verifiable. Deterministic, repeatable, machine- or inspector-measurable on a rig. | Felix produces, **Vera verifies independently** | Proves the *capability exists and is correctly built*. **Never** proves usability. |
| **PROXY** | Observed use by a non-developer stand-in who has not seen the build, following no script. | A recruited adult unfamiliar with the system, observed by Vera | Catches gross comprehension failures cheaply, before Mum's time is spent. **A pass here is not a pass.** |
| **MUM** | Mum's own unassisted, unrehearsed, unprompted use, observed silently. | Warwick observes; Vera defines the observation protocol | The **only** evidence that satisfies the bar. Cannot be simulated, inferred or substituted. |

**The rule that governs the whole matrix:** where a row carries a MUM requirement, **DEV PASS + PROXY PASS + MUM absent = HOLD, never PASS.** Reporting a DEV pass as satisfaction of a MUM criterion is the precise failure this addendum exists to prevent.

### 0.2 Observation protocol for every MUM row (defined once)

1. **No coaching, no pointing, no narration.** Warwick observes and records; he does not steer. The single permitted intervention is ending the session if Mum is distressed.
2. **Unrehearsed.** The task is stated once, in outcome language ("do this week's shop"), never in interface language ("tap the green button").
3. **Recorded observably:** for each criterion — *completed unaided* / *completed after hesitation >30 s* / *completed only after prompting* / *not completed*. "Completed only after prompting" is a **FAIL** of that row, not a partial.
4. **Three separate sessions on three different days.** A first-session success can be recall of a demonstration; a third-session success is use. **Criterion 10 is only meaningfully testable across sessions.**
5. **Her own tablet, her own lighting, her own seat, her own reading glasses, her own network.** A rig test is a DEV artefact and is labelled as one.
6. **Failure is the signal, not the embarrassment.** A row failing here is the addendum working.

---

## A. Accessibility floor — deliberately MORE generous than WCAG 2.2 AA

**Warwick: "Do not merely write 'WCAG compliant' and call that evidence."** WCAG 2.2 AA is the *floor beneath* this profile, not the target. Every number below carries its source and its reason for exceeding the generic minimum.

**SOURCE-OF-AUTHORITY FINDING — read before using this table.** These numbers are **not currently in GL-003**. GL-003 §3 records the type scale as `<unset>` (18 literal sizes, from **9px** to 32px) and §4 records the spacing scale as `<unset>`. **A 9px eyebrow and a 10.5px nav label are roughly one third of the floor this profile requires.** The Cockpit as documented therefore does **not** meet this profile today, and the gap is structural, not incidental. **Before Vera can gate anything against §A, one of two things must happen:** (a) Iris adopts this as a named accessibility profile inside GL-003, populating §3 and §4 for it; or (b) Warwick explicitly designates §A of this document as the binding profile for the Mum surface, and GL-003 records that pointer. **Until then §A is a proposal, and any verdict citing it must say so.** Gating against a standard that lives only in a Deliverable is exactly the "check of the wrong thing" my contract forbids.

| # | Property | **This profile requires** | Generic minimum, for contrast | Source / reason |
|---|---|---|---|---|
| A1 | **Body text size** | **>= 20 px** CSS, computed, at default zoom | WCAG sets **no** minimum text size at all | RNIB clear-print guidance treats 12-14 pt (16-19 px) as the *minimum* for general readers, and 16-22 pt as large print. 20 px sits inside large-print territory at default. |
| A2 | **Primary decision text** — item names, quantities, question text, button labels | **>= 24 px**, weight >= 600 | — | These are the only words she must read in order to act. 24 px is also the WCAG large-text threshold, which lets A6 relax honestly rather than by exemption. |
| A3 | **Absolute floor — any visible text anywhere** | **>= 18 px.** No exceptions: no eyebrows, no timestamps, no chips, no captions, no small print | — | The failure mode is not "small text is hard to read"; it is that small text teaches her the screen is not for her. GL-003 §3 currently permits 9 px. |
| A4 | **Text scaling** | Layout survives **200 %** OS/browser text scaling with no clipping, no overlap, no loss of function and **no two-dimensional scrolling** | WCAG 1.4.4 Resize Text (200 %) and 1.4.10 Reflow (320 px equivalent), both AA | Fire OS exposes a font-size setting and Mum may already have raised it. If she has, the default-scale test never ran. **Test at her actual device setting AND at 200 %.** |
| A5 | **Contrast — body and all decision text** | **>= 7:1** | AA is 4.5:1 | WCAG **1.4.6 Contrast (Enhanced)**, the AAA criterion. AAA is adopted deliberately here for poor eyesight. |
| A6 | **Contrast — text >= 24 px** | **>= 4.5:1** | AA large text is 3:1 | The large-text tier of 1.4.6. |
| A7 | **Contrast — non-text: control boundaries, state indicators, focus rings, selection marks** | **>= 3:1**, and **no state may be carried by colour alone** — every selected/deselected state must also differ by shape, mark or word | WCAG 1.4.11 Non-text Contrast (3:1) and 1.4.1 Use of Colour | GL-003 §2b already establishes "every rail is accompanied by a word". Extend that rule to selection. |
| A8 | **Contrast measurement method** | Measured on the **rendered, composited** pixel, in both colour schemes | — | GL-003 §2b-bis: `opacity` is a contrast operation, not a styling flourish. D-17 and D-18 are open defects a declared-token audit could not see. **Any faded, "deferred" or "muted" treatment on the Mum surface must be measured composited, or it is unmeasured.** |
| A9 | **Touch target size** | **>= 60 x 60 CSS px** for every tappable control; **>= 72 x 72** for the primary per-item controls (select/deselect, quantity plus/minus) | WCAG **2.5.8 Target Size (Minimum)** AA is **24 x 24**; **2.5.5 Target Size (Enhanced)** AAA is 44 x 44; Apple HIG 44 x 44 pt; Material 48 x 48 dp | Even AAA's 44 is calibrated for an average adult finger, not for poor coordination. 60/72 is a deliberate, stated exceedance of every published minimum. |
| A10 | **Target spacing** | **>= 16 px** clear gap between adjacent targets; **>= 24 px** between any two controls with *opposite* effect (select vs remove, plus vs minus) | Material recommends 8 dp | Coordination error is a miss-by-distance problem. Spacing, not size, is what stops her hitting the wrong one — and the cost of a mis-hit is highest between opposite-effect pairs. |
| A11 | **Control density** | **<= 1 primary decision per row**, and **<= 7 interactive controls visible per screen** at her device's own scaling setting | No published standard sets this | Density is the strongest predictor of technology-phobic abandonment. **This is a judgement threshold offered for Warwick or Iris to ratify — not a cited standard.** Labelled honestly rather than dressed up with a fabricated citation. |
| A12 | **Accidental-tap recovery** | Every state-changing tap is **reversible by one visible control**, labelled in plain words ("Undo", "Put it back"), present for **>= 30 s**, dismissible only by her, and **never auto-expiring while it is the only route back** | WCAG **3.3.4 / 3.3.6 Error Prevention**, **2.2.1 Timing Adjustable** | A toast that vanishes in 5 s is invisible to an 84-year-old reader. 30 s is the floor; a persistent control is better. |
| A13 | **Activation timing** | Action fires on **pointer-up**, on the same target; dragging off the control cancels it. **No action fires on pointer-down.** No double-tap, long-press or swipe as the *only* route to any function | WCAG **2.5.2 Pointer Cancellation** (AA); **2.5.7 Dragging Movements** (AA, new in 2.2) | Poor coordination means a finger lands and then slides. Pointer cancellation is the single highest-value accessibility control for her. |
| A14 | **No time limits** | No session timeout, no auto-dismissing question, no countdown, no auto-advance | WCAG 2.2.1 Timing Adjustable, **2.2.6 Timeouts** | She will put the tablet down in the middle of the shop. That must cost her nothing. |
| A15 | **Orientation** | Full function and full layout in **both portrait and landscape**; no rotation lock; no "please rotate your device" | WCAG **1.3.4 Orientation** (AA) | A Fire tablet in a case sits at whatever angle it sits, and she will not think to turn it. |
| A16 | **On-screen keyboard behaviour (Fire)** | When the soft keyboard opens, the focused input **and its label and its submit control** remain visible with no manual scrolling; nothing the keyboard covers is needed to complete the action; dismissing the keyboard never discards typed text | WCAG 3.2.2 On Input; **2.4.11 Focus Not Obscured (Minimum)** (AA, new in 2.2) | The Fire soft keyboard takes roughly half the viewport in landscape. This is where criterion 5 — "add an item in your own words" — actually dies. |
| A17 | **Physical / Bluetooth keyboard and switch access** | Full keyboard operability, with a **visible focus indicator >= 3:1 against both adjacent colours and >= 2 px thick**, a logical focus order and no keyboard trap | WCAG 2.1.1, 2.1.2, 2.4.7, 2.4.11, **2.4.13 Focus Appearance** | Not because Mum uses a keyboard — because it is the cheapest DEV proxy for structural operability, and a Fire keyboard case is a plausible future aid. **DEV-only. It claims nothing whatsoever about Mum.** |
| A18 | **Screen reader** | Every control has an accessible name **matching its visible label**; state (selected / not, quantity) is announced; the real check uses **Fire OS VoiceView**, not desktop NVDA alone | WCAG 4.1.2 Name Role Value; **2.5.3 Label in Name** | Poor eyesight may become worse eyesight. And a control with no accessible name is usually one with a weak visible label too. |
| A19 | **Motion** | `prefers-reduced-motion` honoured; no parallax, no autoplay, and **no motion that moves a target while a finger is descending on it** | WCAG 2.2.2 Pause Stop Hide, 2.3.3 Animation from Interactions | Moving targets and poor coordination compound each other. |
| A20 | **Viewport baseline for the rig** | Test at **Fire HD 8 class (~800 x 500 CSS px)** and **Fire HD 10 class (~960 x 600 CSS px)**, both orientations, **plus** the three standard breakpoints (375 / 768 / 1280) | SOP-005 Phase 4 | **The exact CSS viewport of Mum's actual device and Silk version must be measured on the device itself, never assumed from these figures.** Model-derived numbers are a starting rig, not evidence. |

**Two standing method rules for §A.** (1) Every figure above is verified on **the physical tablet**, in **both colour schemes**, at **her** scaling setting and at 200 %. A desktop-Chrome measurement is a smoke test, not evidence — which is Warwick's whole point. (2) Contrast figures are produced the way GL-003 §2d requires: composited, both schemes, never inferred from one scheme to the other.

---

## B. The fourteen criteria as a testable matrix

Legend: **DEV** = developer-verifiable · **PROXY** = stand-in observation · **MUM** = only her real use proves it · **[?]** = cannot be honestly written as a test until the thing exists (collected in §C).

---

### 1. Tablet starts simple; she reaches the Cockpit with no technical steps

**Observable:** from the tablet in its normal resting state — asleep, on the side table — Mum reaches the working shop screen having performed **zero technical steps**. No URL, no typed login, no app store, no "which icon", no network dialog, no update prompt, no session-expired screen.

| Class | What is observed | By whom | What counts as evidence |
|---|---|---|---|
| DEV | Cold boot and wake-from-sleep both land on the shop surface. Session persists >= 7 days with no re-authentication. No dialog can pre-empt the shop screen. A no-network start produces a plain-words screen, not a browser error. | Felix builds; **Vera verifies on the physical tablet** | Recorded screen capture of wake to shop, timed, with Wi-Fi toggled off and on to exercise the offline path |
| MUM | **Tap count from the resting tablet to the shop screen, unaided, on day 3, with no reminder of how.** | Warwick observes | The count and the hesitation. **Target: <= 2 taps, no hesitation.** |

**Only Mum's use proves:** that the route is still discoverable a week later without being retaught. A developer can only prove it is *short*.
**Hard fail:** any credential prompt · any browser chrome she must interpret · any "add to home screen" step she must perform · any OS update modal able to appear before the shop screen.
**[?] Not testable yet:** the exact tap sequence, because the launch mechanism (kiosk app / home-screen PWA / pinned Silk tab) is undecided. **What is testable now is the invariant** — zero technical steps, <= 2 taps, survives 7 days idle. Write the invariant now; write the script when the mechanism is chosen.

---

### 2. She recognises the Regulars / Favourites she wants

**Observable:** shown the list, Mum can point to and name the things she actually buys, **without reading a product code, a pack-size string or a supermarket's SEO title.**

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | Every entry renders a **household-language name** — the name she uses — not the retailer's raw title. Name >= 24 px (A2), >= 7:1 (A5). No ellipsis truncation of any name at either orientation or at 200 % scaling (A4). Any image carries meaningful `alt` and is never the sole identifier. | Felix; Vera verifies | Rendered screenshots at every §A20 viewport, with measured sizes and ratios |
| MUM | **Read-aloud test.** She reads the list aloud in her own time. Recorded: items named correctly, items misread, items she says she does not recognise, items she recognises but cannot find. | Warwick observes | Counts of *unrecognised* and *misidentified*. **Target: zero misidentified.** |

**Only Mum's use proves:** recognition itself. Whether "ASDA Semi Skimmed Milk 2.27L" or "the big blue milk" is the recognisable form is *her* fact — no developer, no stand-in and no heuristic can supply it.
**[?] Untestable before the naming decision is made, not merely before the build.** If display names are derived from retailer data rather than curated household names, this criterion is at material risk. **That risk should be surfaced to Warwick now, not discovered on her sofa.**

---

### 3. She selects and deselects reliably

**Observable:** she adds and removes items, and **the screen agrees with her intent every time.**

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | Targets >= 72 x 72 (A9); spacing >= 16 px, and >= 24 px to any opposite-effect control (A10). Fires on pointer-up only; cancels on drag-off (A13). The selected state differs by **mark or word AND colour**, non-text contrast >= 3:1 (A7). The toggle is idempotent — a double-fire cannot land the state opposite to her last completed tap. Undo per A12. State announced by VoiceView (A18). | Felix; Vera verifies with a pointer-event harness **and** by hand on the physical tablet | Event-log proof of up-event-only firing; measured geometry; composited contrast in both schemes |
| MUM | **Error rate across a full real shop.** Recorded: intended taps, mis-taps on the wrong item, double registrations, taps that produced no visible change — and, for each, **whether she noticed**. | Warwick observes | **Target: zero unnoticed wrong-state items reaching the basket.** A noticed-and-corrected mis-tap is a pass. An unnoticed one is a FAIL. |

**Only Mum's use proves:** "reliably" is a statement about *her hands*. A developer proves the control is correct; only she proves it is hittable.

---

### 4. She alters quantities reliably

**Observable:** she changes 2 to 3, and 3 to 1, and the number she sees is the number she meant.

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | Plus/minus controls >= 72 x 72 with >= 24 px between them — they are opposite-effect (A9/A10). Quantity numeral >= 24 px, weight >= 600 (A2). **No free-text-only quantity entry**, no precision spinner, no slider or drag (A13, 2.5.7). No auto-repeat on hold that runs the number away. The lower bound is explicit: what happens at 1 then minus must be a defined, labelled, reversible outcome — **never a silent removal.** | Felix; Vera verifies | Geometry measurements; a held-press test proving no runaway; screenshots of the 1-then-minus boundary |
| MUM | Whether the quantities in the submitted plan match what she says she wanted — established **by asking her afterwards**, not by reading the screen together. | Warwick observes | Per-item intended-versus-actual comparison. **Target: exact match.** |

**Only Mum's use proves:** whether a removal at zero reads to her as "gone" or as "broken".

---

### 5. She adds a new item in her own words

**Observable:** she adds something not on the list, typing or speaking **her own vocabulary** — and the system does not punish her for it.

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | Input text >= 24 px. A **visible label, not a placeholder** (SOP-005 Phase 5.6). The soft keyboard obscures neither the field, its label, nor the submit control (A16). Typed text survives keyboard dismissal, rotation and app backgrounding (A16, and criterion 10). **No format requirement:** free text accepted, no mandatory units, no mandatory quantity, and no autocomplete that overwrites what she typed. A voice route where the device supports it. Submitting an unmatched item is a **success**, not an error — it enters the plan as a human-readable request. | Felix; **Vera verifies on the physical tablet with the real soft keyboard** | Video of the keyboard-open state in both orientations; a typed-then-rotated-then-submitted transcript |
| MUM | **Her actual words, unprompted, recorded verbatim** — into the private observation log, never into this repo. Whether the item reached the plan in a form a human can act on. Whether she abandoned mid-entry. | Warwick observes | The verbatim string and its downstream fate. **Target: her string reaches the plan intact and actionable.** |

**Only Mum's use proves:** what "her own words" actually are. Every vocabulary list a developer writes is a guess about her.
**[?] Flag:** an autocomplete or matching layer that "helpfully" rewrites her phrasing is the most likely single cause of failure here, and it cannot be tested until it exists. **The invariant testable now: her literal string is preserved and remains visible to her after submission.**

---

### 6. She submits confidently

**Observable:** she reaches the end and **knows she is done**, without asking anyone.

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | One unambiguous submit control: plain words, label >= 24 px, target >= 72 x 72, visually dominant (SOP-005 Phase 3.7). Confirmation is **a state change she can see and read**, not a three-second toast (A12, A14). The post-submit screen states in plain words what happens next and that she need do nothing. Double submission is impossible or harmless. Status announced per WCAG **4.1.3 Status Messages**. | Felix; Vera verifies | Screenshot of the post-submit state; a double-tap-submit test |
| MUM | **Does she ask "did that work?"** Asking *is* the failure. And afterwards: does she put the tablet down (confidence) or keep poking at it (uncertainty)? | Warwick observes | Verbatim of any question asked, plus post-submit behaviour. **Target: no confirmation-seeking question.** |

**Only Mum's use proves:** confidence. It is not a property of the interface; it is a property of her, observable only in what she does after the tap.

---

### 7. When AsdAIr asks a question she notices it, and understands it

**Two criteria fused into one line. Test them separately** — a noticed-but-not-understood question and an understood-but-unnoticed question fail in different ways and need different fixes.

**7a — she notices it.**

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | The pending question is visible on the screen she lands on — **not behind a tab, a badge, a scroll position, or a push notification she had to have seen earlier.** Signalled by position AND word AND shape, never colour alone (A7). Persistent, no auto-dismiss (A14). Announced as a status message (4.1.3). | Felix; Vera verifies | Landing-screen screenshots with a question pending, at every §A20 viewport, both orientations, at 200 % scaling |
| MUM | **Elapsed time from her arriving on the screen to her engaging with the question, unprompted** — and whether she engages at all in that session. | Warwick observes | The time, and unprompted yes/no. **Target: noticed unprompted within one session, with no hint given.** |

**7b — she understands it.**

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | Question text >= 24 px at >= 7:1. **No jargon and no system nouns** — not "SKU", "substitution", "reconcile", "basket line", "plan". No question requires knowing what AsdAIr is. Each question is self-contained, answerable without recalling a previous screen. Plain English, short sentences. *(Offered as a judgement bar, not a cited standard: automated readability scores are a poor instrument on a twelve-word question and must not be dressed up as evidence.)* | Felix; **Vera reviews the full question corpus line by line** | The corpus, with each question marked pass/fail against the vocabulary bar |
| MUM | **She restates the question in her own words before answering.** That restatement is the evidence. | Warwick observes | Verbatim restatement versus the question's actual intent. **Target: intent preserved.** |

**Only Mum's use proves both.** Noticing is attention; understanding is comprehension. Neither has a developer-side proxy worth anything.
**[?] Untestable before the question corpus exists** — and, more seriously: **if the questions are model-generated and unbounded, this criterion cannot be fully tested at all.** That is a design consequence Warwick should know *before* the build, not after. The honest testable form in that case is a reviewed sample plus a hard vocabulary-and-length constraint enforced at generation time.

---

### 8. She answers by button or ordinary language

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | **Both** routes work for **every** question: a button set (>= 72 x 72, labels >= 24 px, >= 16 px apart, plain words — "Yes", "No", "Skip this", never "Confirm" or "Reject") **and** a free-text or voice route. Free-text answers are accepted with no format rules. Answering never requires finding the "right" phrasing. Buttons are real `<button>` elements; accessible names match visible labels (A18). | Felix; Vera verifies | An enumeration of every question type crossed with both answer routes |
| MUM | Which route she actually uses, and whether an answer given in ordinary language was **accepted as she meant it**. | Warwick observes | Her verbatim answer, the system's interpretation, and whether they agree. **Target: agreement, or a visible clarification — never a silent misinterpretation.** |

**Only Mum's use proves:** whether "ordinary language" is *her* ordinary language.
**[?] Silent misinterpretation is the dangerous failure here, and it cannot be seen from the screen.** It is visible only by comparing her stated intent against the durable plan. **Test 8 and 9 together in one pass, or neither is proven.**

---

### 9. Her answers genuinely alter the same durable plan the shopping journey uses

**The integrity criterion — and the one row where a DEV proof is genuinely decisive. It must not be waved through on the grounds that the screen looked right.**

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | **The single durable plan record is read back from the store after her answer, and differs in exactly the way her answer implied.** No second copy, no UI-local state, no optimistic render the backend never received. The shopping journey then consumes **that same record** — proven by tracing record identity from her answer through to basket construction. The change survives a process restart. A concurrent answer plus plan regeneration cannot silently discard her answer. | Felix builds; **Vera requires a before/after read of the durable record — not a screenshot** | Before and after record state with the record identity visible, and a restart interposed between them |
| MUM | That the outcome she experienced matches what she asked for — that is, criterion 13's basket contains her answer's effect. | Warwick observes | Her stated intent versus the final basket |

**Only Mum's use proves:** nothing here that DEV cannot — **except** the correspondence between what she *thought* she said and what the record holds. That gap is criterion 8's silent-misinterpretation risk, and it is real.
**Hard fail:** any answer that changes the display but not the durable record. This is the classic "it worked in the demo" defect, and it is invisible without a store-side read.

---

### 10. Refresh or restart does not strand her

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | An interruption matrix, each interruption tested **at three stages** — mid-selection, mid-typing, and after submit. Interruptions: page/app refresh · sleep then wake · backgrounded >= 30 min · full device restart · Wi-Fi drop and recovery · rotation · soft keyboard open and close · **battery-empty shutdown**. In every cell she returns to a screen that makes sense; her work is intact, or explicitly and recoverably absent; and there is **no login, no re-setup, no error page**. | Felix; **Vera runs the full matrix on the physical tablet** — this one cannot be proven in a desktop browser | The completed interruption-by-stage matrix, with the observed outcome recorded per cell |
| MUM | **Session 3 of the observation protocol.** Whether she returns days later and resumes without help — and whether she *believes* her earlier work is still there. | Warwick observes | Resumed unaided yes/no; and whether she asks "is my list still there?" |

**Only Mum's use proves:** that the resumed screen is *recognisable* to her. A developer can prove state persisted; only she can prove she knows it persisted.
**[?] Note:** this criterion is the strongest argument for the three-session protocol in §0.2. **A single-sitting test cannot test it at all.**

---

### 11. Errors are visible and recoverable, never silent

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | **Enumerate every failure mode** — network loss, ASDA or service unavailable, item unavailable, save rejected, answer save failed, plan generation failed, session lost, storage full. For each: (i) it is **surfaced to her in plain words**; (ii) it names a **recovery action she can take**, or explicitly says "Warwick has been told, you need do nothing"; (iii) it is **never** a raw code, a stack trace, a browser error page, a blank screen, or a spinner that never resolves; (iv) it satisfies WCAG **3.3.1 Error Identification** and **3.3.3 Error Suggestion**; (v) it is announced as a status message (4.1.3); (vi) **it also fires the criterion 12 notification.** A failure invisible to both Mum and Warwick is the CRITICAL case. | Felix; **Vera fault-injects every mode** — a described error path is not a tested one | A screenshot per failure mode, produced from injected faults, on the tablet |
| MUM | Whether she **noticed** an error that actually occurred, and what she did next. | Warwick observes | Noticed yes/no; action taken; whether she abandoned the shop |

**Only Mum's use proves:** whether the message is comprehensible enough to act on. DEV proves it is *present*; she proves it is *useful*.
**[?] Cannot be fully enumerated before the thing exists.** The list above is the starting set. The acceptance requirement is that **Felix hands over the complete enumeration** and Vera injects every entry. **An un-enumerated failure surface is itself a FAIL of this criterion**, because "never silent" is a claim about the cases nobody listed.

---

### 12. Warwick gets monitoring notifications on Telegram

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | **The real production event fires the notification** — not a manually invoked script, not a test harness, not "the function exists". Credentials and configuration come from a stable approved runtime. A send failure is itself observable and never silent. A fresh session or a reboot uses it without being reminded. Content is actionable and carries **no household personal data beyond what Warwick already holds**. | Felix; **Vera verifies by causing the real event and observing the real message arrive on the real device** | Timestamped real event, timestamped received message — plus a proof that a *failed* send is visible |
| MUM | Nothing. This criterion is about Warwick, not Mum. **Stated explicitly so that nobody scores it from her session.** | — | — |

**This row is governed by root `CLAUDE.md` § "Nothing may live only in Larry's head".** A callable script, a green unit test, a documented command or a successful manual invocation prove **capability only**, and do not satisfy this criterion. Either the real production event has been exercised, or the outcome is explicitly reclassified as manual.
**Which events must notify is a Warwick decision and is not invented here.** The minimum set proposed for his ratification: shop submitted · a question pending unanswered beyond a threshold · any criterion 11 error · basket built and ready for checkout · run failed. **Flagged as a proposal, not a specification.**

---

### 13. The journey reaches a correctly built and reconciled basket without Warwick operating the shopping process

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | The basket is built from the criterion 9 durable plan, and reconciliation is verifiable line by line: every item she selected is present or its absence is explained; quantities match; her free-text additions (criterion 5) are represented or explicitly surfaced as unresolved; her answers (criteria 8 and 9) are reflected. **The reconciliation report is machine-checkable against the plan record.** | Felix; **Vera diffs the plan record against the final basket** | A line-by-line plan-versus-basket diff with zero unexplained discrepancies |
| MUM | **The count of Warwick's operational interventions during her run. The target is ZERO.** Every intervention logged with: what she was trying to do, what stopped her, what he did. | Warwick self-reports honestly | The intervention log. **Any entry before checkout is a FAIL of this criterion** — including "I just tapped it for her", and including him answering a question on her behalf. |

**Only Mum's real run proves this**, and it is the criterion most easily failed quietly, by a helpful hand. **Warwick's own honesty about his interventions is the load-bearing instrument here, and no mechanism can supply it.** Naming that is more useful than inventing a proxy that pretends otherwise.
**On the word "correctly":** correctness of the *basket* is DEV-verifiable. Correctness of *what she wanted* is knowable only by asking her afterwards, item by item, without the screen in front of her.

---

### 14. Warwick's first required intervention is checkout and payment

| Class | What is observed | By whom | Evidence |
|---|---|---|---|
| DEV | The system reaches a **checkout-ready** state and stops there by design — it does not book a slot, check out, or pay. (Asdair's contract already forbids all three.) The handover to Warwick is explicit and unambiguous. | Felix; Vera verifies | The checkout-ready state, plus proof that no payment or slot action is reachable from it |
| MUM / Warwick | **The criterion 13 intervention log, read in order. The first entry must be checkout.** | Warwick | The log. **This criterion is scored entirely from criterion 13's log; it has no independent test.** |

**Stated plainly:** 14 is not a separate observation. It is the *ordering assertion* over criterion 13's log. Writing it as an independent test would be inventing a proxy, which is the thing this document refuses to do.

---

## C. Criteria that CANNOT be honestly tested before the thing exists

Collected here because writing an untestable line is worse than naming the gap.

| Ref | What cannot honestly be tested yet | What CAN be written now instead |
|---|---|---|
| 1 | The tap sequence — the launch mechanism (kiosk / PWA / pinned tab) is undecided | The invariant: zero technical steps, <= 2 taps, survives 7 days idle |
| 2 | Whether the displayed names are recognisable — this depends on a naming decision not yet made | The invariant: household-language names; plus a **flagged risk** that retailer-derived titles will fail this outright |
| 5 | Autocomplete / matching behaviour against her real phrasing | The invariant: her literal string is preserved and visible to her after submission |
| 7 | The question corpus does not exist. **If questions are model-generated and unbounded, full enumeration is impossible in principle** | Review a representative sample, and enforce vocabulary and length constraints at generation. **Surface the consequence to Warwick now.** |
| 8 + 9 | Silent misinterpretation — visible only by comparing her intent to the durable record | Run 8 and 9 as one combined pass; never separately |
| 10 | Cross-session resumption, by definition, in a single sitting | The three-session protocol in §0.2 |
| 11 | The complete failure-mode enumeration does not exist | Require Felix to hand over the enumeration; make an un-enumerated surface a FAIL |
| 12 | Which events warrant a notification is **Warwick's product decision, not a QA finding** | A proposed minimum set, labelled a proposal |
| A11 | The control-density threshold has no standards citation | Offered as a judgement bar for Warwick or Iris to ratify, and labelled honestly as one |
| A20 | Mum's actual device CSS viewport and Silk version | Measure on the device. The model-class figures are a rig, not evidence |
| **All MUM rows** | **Nothing in evidence class MUM is testable before the thing exists and she has used it.** That is the point of the addendum, not a defect in it | Define the observation protocol (§0.2) now, so that the observation is not improvised on the day |

---

## D. Process conditions on the future gate

1. **This document is not a gate result.** It is the specification of one. Vera has inspected nothing, and no verdict is expressed or implied about BUILD-015 or any other work.
2. **The §A profile is not yet authoritative.** See the finding at the head of §A: it is not in GL-003, and GL-003 §3 and §4 are `<unset>` with a live 9 px floor. **Either Iris adopts it into GL-003, or Warwick designates §A binding for the Mum surface.** Until one of those happens, any verdict citing §A must state that its standard lives in a Deliverable rather than in the design-system SSOT.
3. **Read-back gate.** When the future addendum is dispatched, Vera returns the read-back block per SOP-022 and holds. Per her contract a verdict produced without an accepted read-back is `REFUSED` on process grounds, and its findings do not count as a gate result.
4. **Coverage is stated beside every verdict** — which surface, which build, which physical device, which viewports, which colour scheme, and **which criteria carry MUM evidence and which do not.**
5. **Verdict rules (SOP-005) apply, with one addition:** a criterion carrying a MUM requirement but no MUM evidence is **HOLD**, never PASS, regardless of how green the DEV results are.
6. **Personal data.** Mum's verbatim strings, her item list, her observation logs, and any screenshot containing her data **must not** be written to this public repo. They belong on the private surface under `C:\.fusion247\private\<project>\**` per GL-012, declared in the Work Order's mandatory `private_surface` field. **The QA report published here carries counts, verdicts and non-identifying descriptions only.**
7. **Screenshots are mandatory evidence** (SOP-005 Phase 2) and must be captured on the **physical Fire tablet** for every criterion whose evidence class includes the device. A desktop-Chrome screenshot is not evidence for this bar — which is precisely the point Warwick made.

---

## References

- [[SOP-005-vera-quality-gate]] — the gate procedure this matrix will be executed under
- [[GL-003-design-system]] — the design SSOT. §3 and §4 `<unset>`; D-17 and D-18 open; 9 px live floor
- [[SOP-022-work-order-preflight]] — the mandatory read-back gate
- [[GL-012-secrets-store-access-boundary]] — the private surface for her data
- [[Team/Asdair - Household Shopping Steward/AGENTS]] — never books a slot, checks out, or pays
- WCAG 2.2 criteria cited above: 1.3.4 · 1.4.1 · 1.4.4 · 1.4.6 · 1.4.10 · 1.4.11 · 2.1.1 · 2.1.2 · 2.2.1 · 2.2.2 · 2.2.6 · 2.3.3 · 2.4.7 · 2.4.11 · 2.4.13 · 2.5.2 · 2.5.3 · 2.5.5 · 2.5.7 · 2.5.8 · 3.2.2 · 3.3.1 · 3.3.3 · 3.3.4 · 3.3.6 · 4.1.2 · 4.1.3
- Apple Human Interface Guidelines (44 x 44 pt) · Material Design (48 x 48 dp, 8 dp spacing) · RNIB clear-print guidance
