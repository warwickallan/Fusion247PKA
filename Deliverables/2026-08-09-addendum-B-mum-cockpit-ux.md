# Addendum B — The Mum Cockpit: screen-flow and wireframe specification

> **Author:** Felix (Frontend Developer) · **Date:** 2026-08-09
> **Status:** SPECIFICATION ONLY. Not production code. No component was written and no branch was touched.
> **⚠️ NON-GATING.** This document must NOT alter, extend, delay or re-grade BUILD-015. It describes a surface that does not yet exist and creates no obligation on any BUILD-015 head.
> **Repo hygiene:** PUBLIC repo. Every product name, note and message in this document is an invented illustration. No household data.

---

## 0. What this document is, and what it is not

**It is** a screen-flow, wireframe and behaviour specification for a **separate Cockpit** intended for one person: Warwick's mother. It fixes the screens, the states, the interaction laws, the copy rules and the acceptance criteria, at the level of detail a builder needs and no further.

**It is not** an implementation. There is no component code, no route table, no API contract, no data model. Where this specification needs something the backend does not yet expose, it says so in §12 rather than inventing an endpoint.

**The bar it is written against**, in Warwick's words:

> *"This is not satisfied because a developer can operate the page on Chrome."*

That sentence is the acceptance test for everything below. A design decision that is defensible in the abstract but fails an 84-year-old with poor eyesight and poor coordination on a tablet in her kitchen has failed.

---

## 1. Who this is for

| Attribute | Consequence for the design |
|---|---|
| **84 years old** | No learned mobile idioms. Nothing may depend on a convention she has never met. |
| **Technology-phobic** | Fear of "breaking it" dominates. Every screen must make it obvious that nothing is lost and nothing is irreversible. Confirmation dialogs *increase* anxiety; visible undo reduces it. |
| **Poor eyesight** | Large type is the baseline, not an accessibility mode. Contrast well above AA. No thin weights, no low-contrast "secondary" text carrying meaning. |
| **Poor coordination** | Large, well-separated targets. No precision required, ever. A mis-tap must be cheap and visibly reversible. |
| **Does not use Telegram** | Every question the system needs to ask her must surface *in this Cockpit*. There is no out-of-band channel to her. |
| **Does not know the system's vocabulary** | She never sees a catalogue identity, an ASDA reference, a regular id, a slot, a basket state, or the word "AsdAIr". |

**Design consequence stated once, because everything else follows from it:** this surface has **one job per screen** and **one obvious primary action** at any moment. Anything that is not that job is either removed or pushed below the fold where it cannot compete.

---

## 2. Relationship to the existing Cockpit — a separate surface, not a mode

**This is a SEPARATE Cockpit.** It is not a "Mum mode" toggle inside Warwick's administrative Cockpit, and it must not be built as one.

Reasons, recorded so this is not re-litigated:

1. **A mode is reachable by accident.** Any control that switches *into* her view is a control that can switch *out of* it. One stray tap and she is inside an operator console.
2. **A mode inherits the wrong defaults.** The admin Cockpit's information density, type sizes, status vocabulary and navigation are correct for a single technical operator glancing at a phone. Every one of those defaults is wrong here.
3. **A mode couples the release cycles.** An admin change would then be able to break her weekly shop.
4. **The audiences want opposite things.** Warwick's surface optimises for information per glance. Hers optimises for certainty per tap.

**What is shared:** the underlying data and the household's real state. **What is not shared:** navigation, layout, type scale, colour usage, terminology, and error presentation.

**Naming.** Referred to in this document as **her Cockpit**. The word "Cockpit" is a builder's word — **it must not appear on her screen**. See the copy rules in §10.

---

## 3. Target device and runtime

| Item | Value | Consequence |
|---|---|---|
| Device | Amazon Fire tablet | Landscape is the natural resting orientation in a stand; portrait must still work. |
| Browser | Silk (Chromium-based) | Modern CSS is available. Silk is *not* Chrome — do not assume Chrome-only behaviour, and do not rely on features behind Chrome flags. |
| Viewport | Design for a **1024–1280 px wide, 600–800 px tall** CSS viewport; verify at both orientations | Both orientations are first-class. Nothing may be reachable only in landscape. |
| Input | Touch only | **No hover state may carry meaning.** No right-click, no keyboard shortcuts as the only path. |
| Pointer | Imprecise, possibly tremor-affected | Minimum target sizes in §5 are floors, not targets to design down to. |
| Network | Household Wi-Fi, may drop | Offline and slow-network behaviour are specified in §9, not left to the browser. |

**Silk-specific cautions for the builder** (verify, do not assume):

- Silk's "Reader"/optimisation features and any Amazon-injected chrome must not be relied on or fought.
- Font stack: system-native only, consistent with GL-003 §3 (no webfonts). Verify that the chosen weights actually render distinctly on the device's system font — if 650 and 700 are indistinguishable there, weight cannot be a state signal.
- Test with the **device's own display size / font size accessibility settings turned up**, because she may well have done that. The layout must survive it.

---

## 4. Screen inventory and flow

Five screens. That is the whole product. Anything a sixth screen would do is either not needed or belongs on the weekly page.

```
                        ┌───────────────────────────┐
                        │  S1  THIS WEEK'S SHOPPING │   ← the home screen, and
                        │      (the weekly page)    │     the only place she starts
                        └─────────────┬─────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────────┐   ┌─────────────────────────┐   ┌───────────────────────┐
│ S2  ADD SOMETHING │   │ S3  A QUESTION FOR YOU  │   │ S4  SENT — THANK YOU  │
│     ELSE          │   │     (one question at a  │   │     (confirmation)    │
│  (free text)      │   │      time)              │   │                       │
└─────────┬─────────┘   └────────────┬────────────┘   └───────────┬───────────┘
          │                          │                            │
          └──────────► back to S1 ◄──┴────────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │  S5  SOMETHING'S WRONG    │
                        │  (visible, recoverable    │
                        │   error — never silent)   │
                        └───────────────────────────┘
```

**Flow laws:**

1. **S1 is home.** Every other screen has exactly one way back to it, in the same place, with the same words: a large **`← Back to my shopping`** control, top-left.
2. **No nested navigation.** Nothing is ever two levels deep. There is no menu, no tab bar, no hamburger, no drawer.
3. **She can always get home**, from any state, including from an error.
4. **S3 and S4 are interruptions, not destinations** — they appear because the system needs something or has confirmed something, then return her to S1.
5. **There is no settings screen, no account screen, no history screen, no admin escape hatch.** Those live on Warwick's Cockpit.

---

## 5. Global interaction laws

These bind every screen. A violation of any one is a build defect, not a style preference.

### 5.1 Required

| Law | Specification |
|---|---|
| **Minimum tap target** | **72 × 72 CSS px** for any control. `+` / `−` / primary actions: **88 × 88 px minimum**. (WCAG 2.2 AA asks 24×24; that floor is irrelevant to this user. These are the real numbers.) |
| **Minimum gap between targets** | **24 px** of dead space between any two independently-actionable controls. A mis-tap must land on nothing, not on the neighbour. |
| **Body text** | **≥ 22 px**. Product names **≥ 28 px**. Quantity numeral **≥ 44 px**. Primary action label **≥ 26 px**. |
| **Contrast** | **≥ 7:1 for all text** (AAA-level), not 4.5:1. Non-text state indicators **≥ 4.5:1**, not 3:1. See §11 and the design-system gap in §13. |
| **One primary action per screen** | Exactly one control has primary visual weight at any moment. Everything else is visibly secondary. |
| **State carried by more than colour** | Every state must be readable with colour vision removed: shape, position, a tick mark, a word. Colour is reinforcement, never the carrier. |
| **Visible undo** | Any action that changes something offers a plainly-worded undo for at least **20 seconds**, in a fixed location, with a normal tap target. Not a toast that slides away in 4 seconds. |
| **Single tap** | Every action is one tap. |
| **Immediate visible feedback** | Every tap produces a visible change within **100 ms**, even if the network call is still in flight. Optimistic UI with a visible pending marker, never a frozen screen. |
| **Full keyboard/focus support** | Even though the device is touch-only, focus order and visible focus rings are specified and built — a Bluetooth keyboard, a switch device, or a screen reader must all work. Focus ring: **3 px solid, ≥ 4.5:1 against both the control and the page**, with a 2 px offset. |

### 5.2 Forbidden — explicitly, and each with its reason

| Forbidden | Why |
|---|---|
| **Drag and drop** | Requires sustained coordination. Fails on tremor. |
| **Tiny dropdown arrows / `<select>` menus** | Small targets, and Silk's native picker is an unfamiliar modal she did not ask for. |
| **Any gesture** — swipe, pinch, two-finger, edge-swipe, pull-to-refresh | Invisible, undiscoverable, and easy to trigger by accident. |
| **Hover-only behaviour** | Does not exist on touch. A tooltip on hover is information that never arrives. |
| **Double-tap dependency** | Timing-dependent. Fails on slow or imprecise input. |
| **Long-press dependency** | Same. Also invisible. |
| **Auto-advancing carousels or anything that moves on its own** | Moving targets are unhittable and alarming. |
| **Time-limited interactions** | No countdown, no session timeout that loses her work, no auto-dismiss of anything she needs to read. |
| **Modal dialogs that trap focus with a small close `×`** | If a modal is unavoidable it is full-screen with a large, worded close control. |
| **`window.confirm` / `alert` / `prompt`** | Native dialogs are small, unstyled, and cannot meet the type-size floor. Consistent with Felix's contract critical rule 2. |
| **Infinite scroll / lazy pagination of her item list** | Her list is finite and must be finite on screen. See §6. |
| **Placeholder text as the only label** | Disappears on focus, is low-contrast by convention. Every field has a persistent visible label. |

---

## 6. S1 — the weekly page

### 6.1 The rule

**All current household Regulars/Favourites on ONE scrolling page.** No pagination, no "load more", no search-to-find, no hunting through screens.

**"One page" means one coherent scrolling shopping page** — it does not mean the catalogue fits above the fold, and it must not be compressed to try. Scrolling is a familiar, forgiving, coordination-light action and is the one motion this design leans on.

**Logical section headings are permitted** where they aid finding an item — but they are **headings, not navigation**. Specifically:

- **Allowed:** a plain heading row in the flow of the page (`Fridge`, `Cupboard`, `Fruit and veg`, `Household`).
- **Not allowed:** jump links, sticky category tabs, a collapsed accordion she must open, a filter bar, or anything that hides items behind a control.
- **Nothing is ever hidden.** Every item is present in the scroll at all times. A heading may not collapse.
- **Grouping order is stable week to week.** Her muscle memory for "the milk is near the top" is a real accessibility feature; reordering by frequency or recency would destroy it. **Order is fixed and only changes when the household's item list changes.**

### 6.2 Wireframe — S1, landscape

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   This week's shopping                                     Friday 9 August   │   ← page title 40px/700
│   Tap the things you'd like. Then press the green button at the bottom.      │   ← 24px, one sentence
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ╔════════════════════════════════════════════════════════════════════════╗  │
│  ║  ❓  There's a question for you                                        ║  │   ← §7 banner. Present ONLY
│  ║      I need to check one thing before I can order.                     ║  │     when something is pending.
│  ║                                          ┌──────────────────────────┐  ║  │     Cannot be dismissed.
│  ║                                          │   See the question   →   │  ║  │
│  ║                                          └──────────────────────────┘  ║  │
│  ╚════════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│   FRIDGE                                                                     │   ← section heading, 26px/800
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  ○     Semi-skimmed milk                        ┌────┐  ┌────┐  ┌────┐  │  │
│  │        4 pints                                  │ −  │  │  1 │  │ +  │  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  ✓     Butter                                   ┌────┐  ┌────┐  ┌────┐  │  │   ← SELECTED row.
│  │  ────  Salted, 250g                             │ −  │  │  2 │  │ +  │  │  │     Tick + tinted fill +
│  └────────────────────────────────────────────────────────────────────────┘  │     thick left rail + border.
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  ○     Eggs                                     ┌────┐  ┌────┐  ┌────┐  │  │
│  │        Box of 6, free range                     │ −  │  │  1 │  │ +  │  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   CUPBOARD                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  ○     Tea bags                                 ┌────┐  ┌────┐  ┌────┐  │  │
│  │        Box of 80                                │ −  │  │  1 │  │ +  │  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                    ⋮  (scrolls)                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   ➕   ADD SOMETHING ELSE                                               │  │   ← §8. Always the last
│  │        Something not on this list? Tell me in your own words.          │  │     thing before the footer.
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│   You've chosen 6 things            ┌─────────────────────────────────────┐  │   ← sticky footer bar
│                                     │   SEND MY SHOPPING LIST             │  │     THE one primary action
│                                     └─────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Portrait** uses the identical row anatomy; only the row wraps the `− n +` cluster onto a second line, right-aligned, still at full target size. **The row never becomes a compact variant.**

### 6.3 The item row — anatomy and rules

```
   [ select ]     LARGE PRODUCT NAME              [ − ]    n    [ + ]
   ◄──88px──►     ◄──── flexible, min 340px ────► ◄88px► ◄72px► ◄88px►
```

| Part | Specification |
|---|---|
| **Select control** | A large tick target, **88 × 88 px**, at the row's leading edge. Unselected: an empty outlined circle. Selected: a filled shape with a **solid tick glyph**. It is a checkbox in semantics (`role="checkbox"`, `aria-checked`), never a switch — "on/off" is a harder concept than "ticked". |
| **Whole row is the select target** | Tapping **anywhere on the row except the `−` / `+` controls** toggles selection. This is the single largest accessibility win available and it is required, not optional. The `−`/`+` controls must therefore stop event propagation. |
| **Product name** | **≥ 28 px, weight 700.** Plain household English. Never a catalogue string, never a code, never truncated with an ellipsis — **it wraps to a second line and the row grows.** |
| **Sub-line** | Optional, **≥ 22 px**, the size/pack detail she would say out loud ("4 pints", "box of 6"). Must clear **7:1** — it may not be a faint "secondary" grey. If a sub-line cannot be written in her words, it is omitted rather than filled with a reference. |
| **`−` and `+`** | **88 × 88 px each**, thick glyphs, **≥ 36 px** stroke-visible symbol. Separated from each other by the quantity display. Bordered so the hit area is visible, not implied. |
| **Quantity** | **≥ 44 px, weight 700, tabular/mono numerals**, in a fixed-width box so the row does not reflow as the number changes. Never an editable text input on this row. |
| **Row height** | **≥ 120 px.** Vertical gap between rows **≥ 20 px**. |
| **Row order** | Fixed. Selecting an item **never** moves it, never sorts it to the top, never re-groups it. |

### 6.4 Quantity rules — the negative-quantity requirement

**Quantity cannot accidentally go negative. Stated as enforceable rules:**

1. **Minimum is 1**, not 0. An unselected item still shows `1` — that is the quantity it *would* have if she selected it. There is no zero state on the row.
2. **At quantity 1, `−` is disabled**: visibly greyed, `aria-disabled="true"`, and it **does not respond to taps at all**. It is not hidden — a control that disappears is worse than one that is visibly unavailable, because its absence shifts the layout and moves `+` under her finger.
3. **Removing an item is done by untapping the tick, never by decrementing to zero.** These are two different concepts and the UI must never conflate them.
4. **Maximum is 20** by default, `+` disabled at the cap with the same treatment. A cap prevents a stuck finger producing an absurd order.
5. **Clamping is enforced in state, not only in the view.** Any quantity value is clamped to `[1, 20]` at the point of update, so a repeated-event, double-fire or race can never produce `0` or a negative. **The disabled button is the affordance; the clamp is the guarantee. Both are required.**
6. **No key repeat / no press-and-hold acceleration.** One tap, one increment.
7. **Changing quantity on an unselected row automatically selects it.** She has expressed intent; making her also find the tick is a trap.
8. Quantity changes are announced to assistive tech via a polite live region: *"Butter, 2"*.

### 6.5 Selected state — visually obvious

Selection must be unmistakable from across the room, and must survive greyscale. **Four simultaneous signals, all required:**

1. **A solid tick** inside the select control (shape).
2. **A tinted row fill** distinct from the unselected surface (colour).
3. **A thick leading rail — 8 px** down the row's leading edge (position/weight).
4. **A visible row border** at greater weight than the unselected row (edge).

Plus: the footer count updates, and `aria-checked` flips.

**Not acceptable as the sole signal:** a colour change alone, an opacity change, a subtle border, a small checkmark, or a change of text weight.

**Opacity is forbidden as a state signal on this surface.** GL-003 §2b-bis records D-17/D-18 — the admin cockpit's `opacity` fades push compliant token pairings below the contrast floor. On a surface built for poor eyesight, fading is never the answer.

### 6.6 Undo

- Every selection toggle and every quantity change is individually reversible by repeating the action — that is the primary undo and it needs no UI.
- Additionally, a persistent **`Undo my last change`** control sits in the footer area, always present once she has made at least one change in the session, showing what it will undo in words: *"Undo — Butter removed"*.
- **It does not time out during the session.** The 20-second minimum in §5.1 applies to transient confirmations; this one is durable.
- **There is no "clear everything" control.** The upside is negligible and the downside is catastrophic.

### 6.7 The footer — one obvious primary action

- **Sticky to the bottom of the viewport** so it is reachable without scrolling to the end, but it must not overlap the last row (the scroll container gets bottom padding equal to the footer height plus 24 px).
- Left: a plain running count — **`You've chosen 6 things`** — at ≥ 24 px. Zero state: **`You haven't chosen anything yet`**.
- Right: **the one primary action**, `SEND MY SHOPPING LIST`, **≥ 26 px label in an ≥ 88 px tall control**.
- **When nothing is selected it is disabled** — visibly, with the reason stated beside it: *"Tap some things first"*. It must not be hidden, and it must not be tappable-then-scolding.
- **After sending, it is replaced by the sent state (§9.3), not left tappable.** Double-send is prevented in state, not by her restraint.
- **No secondary action shares the footer.** Not "save draft", not "clear", not "settings".

---

## 7. Questions come back to HER

**Mum does not use Telegram.** When the system needs clarification, that clarification **must appear visibly in her Cockpit**. There is no other channel to her, and a question that waits silently is the same as a shop that silently fails.

### 7.1 The unmistakable pending signal

When one or more questions are waiting:

1. **A banner at the very top of S1**, above the first section heading, inside the initial viewport in both orientations. Full-width, high-contrast, with an icon **and** the words `There's a question for you`.
2. **It cannot be dismissed.** There is no `×`. It disappears only when the questions are answered.
3. **It survives refresh and restart.** Pending state is server-held, re-fetched on load — never held only in memory or in a tab's session state.
4. **The page title also changes** (`(1) This week's shopping`) so a background tab shows it.
5. **On load with something pending, focus is moved to the banner** and it is announced via an assertive live region.
6. **If she reaches the send action while a question is unanswered**, the send is still permitted — but the confirmation screen (S4) states plainly that one thing is still being checked, and the banner remains. **Blocking her send behind an unanswered question is not acceptable**; it strands her.

### 7.2 S3 — the question screen

**One question at a time.** Never a queue on one screen, never a form with several unknowns.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────┐                                             │
│  │  ←  Back to my shopping     │                                 Question 1 of 2 │
│  └─────────────────────────────┘                                             │
│                                                                              │
│   A question for you                                                         │   ← 40px/700
│                                                                              │
│   You asked for "washing powder". Which one did you mean?                    │   ← 30px, her own words quoted
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │   Ariel washing powder — big box                                       │ │   ← candidate button
│   │                                                                        │ │     ≥ 96px tall, ≥ 30px label
│   └────────────────────────────────────────────────────────────────────────┘ │
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │   Ariel washing liquid — 2 litres                                      │ │
│   └────────────────────────────────────────────────────────────────────────┘ │
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │   Ariel washing pods — tub of 30                                       │ │
│   └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │   None of these — let me say it another way                            │ │   ← always present escape
│   └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│   ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│   Or tell me in your own words:                                              │
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │                                                                        │ │   ← ≥ 140px tall, ≥ 28px text
│   │                                                                        │ │
│   └────────────────────────────────────────────────────────────────────────┘ │
│                                     ┌─────────────────────────────────────┐  │
│                                     │   SEND MY ANSWER                    │  │
│                                     └─────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Question-screen rules

| Rule | Specification |
|---|---|
| **Candidate buttons are deterministic** | Each candidate is a plain, complete, self-describing sentence in household English. **Never** a product code, catalogue id, ASDA reference or truncated string. **Maximum 4 candidates**, plus the escape. If the system has more than four, it shows the best four and the escape — a long list is a worse experience than an honest "none of these". |
| **Candidate buttons are ≥ 96 px tall**, full width, with ≥ 24 px between them | Coordination floor. |
| **Tapping a candidate answers immediately** | No "select then confirm". One tap, then S4 or the next question. This is the only place a single tap commits, and it is justified because every answer is correctable via the visible undo on the confirmation. |
| **`None of these` is always present** | She must never be cornered by four wrong options. |
| **The free-text box is always present too** | Both routes, always, on every question. Never one or the other. |
| **The free-text box has a persistent visible label**, not a placeholder | Placeholders vanish. |
| **Her own words are quoted back** | *"You asked for 'nice biscuits'"* — so she can see what the system heard. This is the single most trust-building element on the screen. |
| **Scope questions are asked in plain terms** | *"Just this week, or shall I get this every week from now on?"* → two large buttons: `Just this week` / `Every week from now on`. Never "persist to regulars". |
| **No question is ever destructive** | Answering wrongly must always be recoverable on the next screen. |
| **Progress is shown honestly** | `Question 1 of 2`, so she knows the end exists. |
| **Answering the last question returns to S1**, with the banner gone and a confirmation strip — **not** silently. |

### 7.4 Illustrative question shapes

All invented examples; no household data.

| Situation | What she sees |
|---|---|
| Ambiguous brand | *"You asked for 'washing powder'. Which one did you mean?"* + up to 4 candidates + escape + free text |
| Unparseable request | *"I couldn't quite work out 'nice biscuits'. Is it one of these?"* + candidates + free text |
| Scope | *"Just this week, or every week from now on?"* + two buttons |
| Unavailable | *"They've run out of the usual eggs. Shall I get one of these instead, or leave them out this week?"* + candidates + `Leave them out this week` |
| Quantity sanity | *"You've asked for 12 boxes of tea. Is that right?"* + `Yes, 12 is right` / `No, change it back to 1` |

---

## 8. S2 — ADD SOMETHING ELSE

### 8.1 Entry

A single, unmistakable, full-width control at the end of the weekly list — **never** a small `+` in a corner, never a floating action button, never in a menu.

```
┌────────────────────────────────────────────────────────────────────────┐
│   ➕   ADD SOMETHING ELSE                                               │   ← ≥ 110px tall, label ≥ 30px
│        Something not on this list? Tell me in your own words.          │
└────────────────────────────────────────────────────────────────────────┘
```

### 8.2 The screen

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────┐                                             │
│  │  ←  Back to my shopping     │                                             │
│  └─────────────────────────────┘                                             │
│                                                                              │
│   Add something else                                                         │
│                                                                              │
│   Tell me what you'd like, in your own words.                                │
│   For example: "nice ham", "yoghurts for grandad", "two tins of tomatoes".   │
│                                                                              │
│   What would you like?                                                       │   ← persistent label, 26px
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │                                                                        │ │   ← ≥ 180px tall, ≥ 30px text
│   │                                                                        │ │
│   │                                                                        │ │
│   └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│   You've added:                                                              │   ← appears only once ≥1 added
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │  ✓   "nice ham"                                       [  Remove  ]     │ │
│   └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│         ┌──────────────────────┐          ┌──────────────────────────────┐   │
│         │   ADD ANOTHER        │          │   DONE — BACK TO MY LIST     │   │
│         └──────────────────────┘          └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Rules

1. **Free text, her words, no interpretation on screen.** What she types is what is displayed back to her, verbatim, in quotation marks. The system may interpret it internally; the interpretation is **never** shown as if it were her request. If interpretation is uncertain, that becomes a question (§7) — it does not silently rewrite her words.
2. **She never sees, types or chooses a catalogue identity.** No product search, no autocomplete against a catalogue, no id, no ASDA reference, no "regular", no barcode.
3. **No autocomplete or predictive dropdown.** A list appearing under her finger while she types is exactly the kind of moving target §5.2 forbids.
4. **No validation beyond "not empty".** No character limits she can hit in normal use (cap at a generous 200 chars with a *visible* count only once she passes 150), no format rules, no rejection of spelling.
5. **Multiple items are added one at a time**, each confirmed into the "You've added" list, each individually removable with a full-size `Remove` control.
6. **Added items are visible on S1 too**, in their own section at the end (`Things you added`), with the same row anatomy so nothing feels different.
7. **The on-screen keyboard must not cover the text box or the primary action.** The layout scrolls the focused field into view; the action buttons are in the document flow, not pinned under the keyboard.
8. **Nothing is lost if she backs out.** Text typed but not added is preserved if she returns within the session, and the back control is worded so it is obviously safe: `← Back to my shopping`.

---

## 9. The five states

These are the states the brief names, specified as a state machine with the exact on-screen treatment for each. **Every state is visible on S1 without scrolling, in both orientations.**

```
        ┌──────────────────┐
        │ 1. NOTHING       │  ← the resting state
        │    PENDING       │
        └────────┬─────────┘
                 │ she taps SEND MY SHOPPING LIST
                 ▼
        ┌──────────────────┐
        │ 3. SUBMITTED     │ ─────────────┐
        └────────┬─────────┘              │ system needs clarification
                 │ system finishes        ▼
                 │                ┌──────────────────┐
                 │                │ 2. WAITING FOR   │
                 │                │    YOUR ANSWER   │
                 │                └────────┬─────────┘
                 │                         │ she answers (§7)
                 │◄────────────────────────┘
                 ▼
        ┌──────────────────┐
        │ 4. PLAN READY    │
        └──────────────────┘

        ┌──────────────────┐
        │ 5. BLOCKED       │  ← reachable from ANY state; always exits to a human
        └──────────────────┘
```

### 9.1 State 1 — nothing pending (resting)

- **No banner.** The page is just her shopping list.
- Footer: `You haven't chosen anything yet` / running count, with the primary action.
- **The absence of a banner is itself the signal**, which is only safe because the banner is unmissable when present. Nothing else may ever occupy that banner slot.

### 9.2 State 2 — waiting for her answer

- **The §7.1 banner, undismissable, at the top of S1.**
- Icon **and** words. Never a badge or a dot alone.
- **Survives refresh and restart** — server-held, re-fetched, re-rendered.
- If more than one question waits: `There are 2 questions for you`.
- **This is the highest-priority state.** If both a question and a plan-ready condition exist, the question banner wins the slot and the plan-ready notice sits directly beneath it.

### 9.3 State 3 — submitted

- Footer's primary action is **replaced** (not merely disabled) by a calm, non-actionable strip: **`Sent — thank you. I'm getting your shopping ready.`**
- **She can still change her mind**: a full-size `I want to change something` control returns the page to editable and re-sends. This is critical — an 84-year-old who realises she forgot the bread must not be stuck.
- Item rows go read-only *only if* the backend genuinely cannot accept a change; if it can, they stay editable. **The UI must not pretend to be locked when it isn't, and must not pretend to be editable when it isn't.**
- S4 is the full-screen version of this, shown once immediately after sending, with a large `← Back to my shopping`.

### 9.4 State 4 — plan ready

- A banner in the same slot, distinct colour and icon from state 2, reading e.g. **`Your shopping is ready — all 14 things are on the list.`**
- **Read-only and reassuring.** It is information, not a task. There is no action she must take.
- If any requested item could not be found, it is named here in her words: *"I couldn't find 'nice ham', so I've left it out."* — **named plainly, never hidden in a count.**
- It does not auto-dismiss. It clears when the next week's list is prepared.

### 9.5 State 5 — blocked

- A banner in the same slot, visually the most urgent, reading in plain language what happened and what happens next: **`I'm sorry — something's gone wrong and I can't order your shopping. Warwick has been told and will sort it out.`**
- **It must state that a human knows.** An 84-year-old facing an unexplained failure with no named next step is the worst outcome this product can produce.
- **Her list is preserved and still visible.** Blocked never means "start again".
- **It never shows a technical error, a stack trace, a status code, a service name, or the word "AsdAIr".**
- **Blocked must fire a notification on Warwick's channel.** A blocked state she can see but he cannot is a silent failure with extra steps. (Delivery mechanism is Warwick's existing channel — out of scope for this document beyond stating the requirement.)

### 9.6 Cross-cutting state rules

| Rule | Specification |
|---|---|
| **Refresh or restart loses nothing** | State is server-held. A reload re-fetches and re-renders the identical state, including a pending question, her selections, her quantities, and her free-text additions. **Nothing load-bearing lives only in memory, in a JS variable, or in a tab's session storage.** |
| **Local drafts are a safety net, not the source** | Her in-progress, unsent changes may be mirrored to device storage so a crashed tab does not lose them — but the server is authoritative and any conflict resolves in favour of showing her both and asking (§7). |
| **Errors are visible and recoverable, never silent** | A failed save shows an inline, plain-language message beside the thing that failed, with a full-size `Try again`. It never fails quietly, never only logs to console, never leaves the UI showing success. |
| **Offline / no network** | A persistent plain strip: *"I can't reach the internet at the moment. Your list is safe — I'll send it when it comes back."* Her taps continue to work locally and queue. **The UI never claims something was sent when it was not.** |
| **Slow network** | Optimistic UI with a visible pending marker on the affected row, resolving to confirmed or to an inline error. Never a full-page spinner that hides her list. |
| **She is never stranded** | From every state, including blocked and offline, there is a visible, worded route back to her shopping list. |

---

## 10. Copy rules

### 10.1 Voice

- **Second person, warm, short sentences.** *"Tap the things you'd like."*
- **The system speaks as a helpful person, in the first person** — *"I couldn't find…"*, *"I'll send it when it comes back."* This is already the register the question copy uses and it should be consistent.
- **No exclamation marks. No emoji as the carrier of meaning** (emoji may reinforce a banner icon; per GL-003 §5 they cannot carry state, and they render inconsistently).
- **No jargon, no abbreviations, no metaphors.** "List", not "basket", "cart", "order", "queue" or "run".
- **Never blame her.** Never "invalid", "error", "you must", "required", "failed".

### 10.2 Banned vocabulary — must never appear on her screen

`AsdAIr` · `ASDA reference` · `catalogue` · `catalogue id` · `product id` · `regular` / `regular id` · `favourite id` · `SKU` · `slot` · `basket` · `checkout` · `sync` · `API` · `endpoint` · `queue` · `job` · `run` · `parse` · `resolve` · `candidate` · `alias` · `persist` · `session` · `token` · `cockpit` · `submit` · `payload` · any status code, service name, or SHA.

### 10.3 Replacements

| Internal concept | What she reads |
|---|---|
| Regulars / Favourites | *the things you usually get* |
| Add to basket | *(never shown — she is choosing, not shopping)* |
| Submit / send order | **`SEND MY SHOPPING LIST`** |
| Needs-decision queue | *a question for you* |
| Ambiguous candidate resolution | *"Which one did you mean?"* |
| Persist to regulars | *"every week from now on"* |
| One-off | *"just this week"* |
| Item unavailable | *"they've run out of…"* |
| Plan ready | *"your shopping is ready"* |
| Blocked / error | *"something's gone wrong — Warwick has been told"* |

### 10.4 GL-003 §6 not populated

Per GL-003, voice samples are `<unset>`. **This section is written in flagged fallback mode** and is Felix's proposal, not a ratified voice. It is a candidate for Iris to ratify — and note that this surface's voice is legitimately *different* from the admin cockpit's, which is a reason GL-003 may need two voices rather than one.

---

## 11. Accessibility specification

Target: **WCAG 2.2 AA as the floor, with AAA-level contrast and target sizes**, because AA's minimums were never written for this user.

| Area | Requirement |
|---|---|
| **Contrast** | **≥ 7:1 all text** (AAA). Non-text state indicators and focus rings **≥ 4.5:1** (above the 3:1 AA floor). Every pairing measured with the GL-003 §2d method and recorded before build sign-off. |
| **No opacity fades** | Forbidden as a state or emphasis mechanism on this surface — see GL-003 §2b-bis D-17/D-18. |
| **Text sizing** | Layout survives **200 % browser zoom** and the device's own font-size setting at maximum, with **no horizontal scrolling and no clipped content** (WCAG 1.4.4, 1.4.10). |
| **Reflow** | Content reflows to a 320 px-equivalent width without loss (1.4.10), even though the device is larger — this is the cheapest proof the layout is not brittle. |
| **Semantics** | Native `<button>`, `<input type="checkbox">`, `<textarea>`, real `<h1>`/`<h2>` structure. **No `<div>` with a click handler.** Item rows expose `role="checkbox"` + `aria-checked` if a custom control is unavoidable, with full keyboard operation. |
| **Labels** | Every control has a programmatic name that matches its visible label (2.5.3). `+` / `−` are labelled with the product: *"One more Butter"* / *"One less Butter"* — never bare `+`. |
| **Live regions** | Quantity and count changes → `aria-live="polite"`. Pending question on load → `aria-live="assertive"` plus focus move. Errors → `role="alert"`. |
| **Focus** | Visible **3 px** ring, ≥ 4.5:1, 2 px offset, on every interactive element. Logical DOM order = visual order. Focus is never trapped. Focus is moved deliberately on screen change and announced. |
| **Motion** | No animation beyond a ≤ 150 ms state transition. `prefers-reduced-motion` honoured. Nothing moves on its own (2.2.2). |
| **Timing** | No time limits anywhere (2.2.1). Nothing auto-dismisses that carries information. |
| **Target size** | Every target meets **72 px** minimum (AAA asks 44; AA asks 24). Documented as an intentional overshoot. |
| **Colour independence** | Every state readable in greyscale (1.4.1). Verified by screenshot in greyscale, not by assertion. |
| **Screen reader** | The full journey — arrive, see pending question, answer it, select items, change a quantity, add free text, send — completes with TalkBack on the device. |

---

## 12. What this specification deliberately does not settle

Recorded honestly rather than invented.

1. **The data source for "all current household Regulars/Favourites".** This document assumes such a list can be read and rendered as household-English names with optional size sub-lines. **If the only available names are catalogue strings, that is a real gap** — §6.3 forbids showing them, and a display-name layer would be needed. Backend question, not a frontend one.
2. **The transport for pending questions.** §9.6 requires server-held state that survives refresh. Whether that is polling, SSE or WebSocket is an implementation choice, but **the requirement — survives refresh and restart, never lost — is not negotiable.**
3. **Authentication.** Not specified. Whatever it is, it must not put a login form with small fields in front of an 84-year-old every week. A long-lived device trust on her tablet is the obvious shape; **it is a Warwick decision with a security dimension and is not decided here.**
4. **How her Cockpit is served and reached.** URL, host, and whether it is installed as a home-screen app. **If it is installed as a PWA, the service-worker caching path must be named in the build brief** — per Felix's critical rule 10, a cache-first `sw.js` is the classic reason a correct change never reaches the user. The existing admin cockpit ships one (`services/cockpit/public/sw.js`); hers must not silently inherit it.
5. **Whether the plan-ready state names every item or only exceptions.** §9.4 specifies naming the exceptions; whether she also wants the full confirmed list is a product question.
6. **The section-heading taxonomy.** §6.2 uses `Fridge / Cupboard / Fruit and veg / Household` illustratively. The real grouping should be the one *she* would use, which is a question for her, not a decision for a builder.

---

## 13. Design-system gaps — parked for Iris

**GL-003 is law and I have invented no token.** These are recorded as gaps, not filled.

| # | Gap | Why it matters here |
|---|---|---|
| **G-1** | **GL-003 §2 is scoped to the admin cockpit** — explicitly *"a private, single-operator surface on a tailnet… glanced at on a phone"*. That is a different audience with different requirements. GL-003 §Scope already says a second surface *"either adopts these tokens or GL-003 is extended to carry two themes; it does not fork silently."* **This is that moment.** Iris's decision. |
| **G-2** | **No token pairing in GL-003 §2b reaches 7:1 across the board.** `--ink2` on `--panel` is 7.47/7.37 (passes) but `--ink2` on `--bg` is 6.59 light, and every status-tint pairing sits in the low 6s. **An AAA-contrast palette for this surface does not exist and must not be improvised.** |
| **G-3** | **`--ink3` is unusable here.** It is sub-4.5:1 everywhere. This surface has **no** legitimate use for a decorative-only ink; it should be excluded from her theme entirely rather than reserved for ornament. |
| **G-4** | **No `--focus` token** — GL-003 §2a records it as `<unset>`, with the live CSS having no `:focus-visible` styling at all and the in-flight worktree using a raw `var(--accent)`. This surface requires a named focus token at ≥ 4.5:1. |
| **G-5** | **No type-scale tokens** (GL-003 §3 `<unset>`; 18 literal sizes including half-pixel steps). This surface needs a genuine large-type scale — roughly `22 / 26 / 28 / 30 / 40 / 44 px`. **I have not created one**; the sizes quoted throughout this document are *requirements*, and Iris owns turning them into named tokens. |
| **G-6** | **No spacing tokens** (GL-003 §4 `<unset>`). This surface depends on generous, *consistent* spacing — the 24 px inter-target gap is a safety requirement, not a style preference, and it wants a name. |
| **G-7** | **No `--ok-ink` / `--warn-ink`** (GL-003 §2a). The selected-row treatment and the plan-ready banner both want an affirmative colour that is safe as *text*. D-11 already had to demote the admin cockpit's Accept button for exactly this reason. |
| **G-8** | **Icon language.** GL-003 §5 records emoji-as-icons as a consequence, not a choice, and forbids introducing a vector icon family into a cockpit-adjacent deliverable. This surface needs **large, unambiguous, recolourable** icons for the banner states — **emoji cannot carry state and cannot be recoloured.** This is a genuine decision for Iris, and it is the strongest case in the estate for making it. |
| **G-9** | **Voice.** GL-003 §6 `<unset>`. §10 above is written in flagged fallback mode and needs ratification — plausibly as a *second* voice, since this surface should not sound like an operator console. |

**Nothing in §13 blocks writing this specification. All of it blocks building the surface**, and it should be routed to Iris before a builder starts.

---

## 14. Acceptance criteria — for Vera's quality gate on the eventual build

Written now so the build is measured against the user, not against a developer's Chrome window.

| # | Criterion | How it is verified |
|---|---|---|
| A-1 | Every current household item appears on one scrolling page, with no pagination, no hidden/collapsed content, and stable order | Count rendered rows against the source list; scroll to the end; reload and confirm identical order |
| A-2 | Every interactive target ≥ 72 px (≥ 88 px for `+`/`−`/primary), with ≥ 24 px separation | Measured on the device, not in a desktop emulator |
| A-3 | All text ≥ 7:1 contrast; all state indicators ≥ 4.5:1; verified in both orientations and any shipped colour scheme | GL-003 §2d method; recorded figures, not assertions |
| A-4 | Quantity cannot reach 0 or a negative value by any route — rapid tapping, double-fire, keyboard repeat, or a network retry | Adversarial tapping on the device **and** a state-level test of the clamp |
| A-5 | Selected state is unmistakable in greyscale from ~2 m | Greyscale screenshot + a real look at the device across a room |
| A-6 | Every change is undoable, with the undo visible for ≥ 20 s and the session undo persistent | Manual walkthrough |
| A-7 | A pending question is unmissable on load, undismissable, and survives refresh, tab close, and device restart | Kill and revive the tab and the device with a question pending |
| A-8 | Every question is answerable by large candidate buttons **and** by free text, with an escape route from the candidates | Walkthrough of each question shape in §7.4 |
| A-9 | Free text accepts her own words verbatim, with no catalogue identity, code or reference visible anywhere on the surface | Grep the rendered DOM for the §10.2 banned vocabulary — **zero occurrences** |
| A-10 | All five states render distinctly and correctly, and are reachable in testing | Drive each state from the backend |
| A-11 | Errors, offline and blocked states are visible, plainly worded, and offer a route back — never silent, never technical | Kill the network; force a failure; confirm the UI never claims success |
| A-12 | The full journey completes with TalkBack, at 200 % zoom, and with the device font size at maximum | On-device |
| A-13 | The build introduces no hover-only behaviour, gesture, drag, double-tap or long-press dependency | Code review + on-device |
| A-14 | If distributed as a PWA, a change to the surface actually reaches the device after deploy | Deploy a visible change; confirm on the tablet **after** a normal reopen, not a hard reset |
| A-15 | **The person test.** Someone matching the user profile — not a developer — completes: see a question, answer it, choose six items, change a quantity, add something in their own words, and send | Observed, unaided. **A-15 is the acceptance criterion. A-1 to A-14 are how it becomes likely.** |

---

## 15. Summary of hard requirements

1. A **separate** Cockpit. Not a mode.
2. **One scrolling page** with every household item, stable order, nothing hidden.
3. **One simple row per item**: big tick, big name, big `−` / big number / big `+`.
4. **Quantity floors at 1**, enforced in state as well as in the view. Removal is untapping the tick.
5. **Selection is obvious** by tick + fill + rail + border, and survives greyscale.
6. **One obvious primary action**, in the footer, always.
7. **ADD SOMETHING ELSE** in her own words, with no catalogue identity anywhere.
8. **Questions come to her, in her Cockpit**, one at a time, answerable by big buttons or big free text.
9. **Pending is unmissable and survives refresh and restart.**
10. **Errors are visible, plain and recoverable. She is never stranded.**
11. **Five states**: nothing pending · waiting for her answer · submitted · plan ready · blocked.
12. **7:1 contrast, 72 px targets, 22 px+ text, no gestures, no hover, no drag, no double-tap.**

---

## References

- [[GL-003-design-system]] — the design-system SSOT; §13 above records what it does not yet cover for this surface.
- [[SOP-003-felix-build-a-component]] — the build procedure for the eventual implementation.
- [[Team/Iris - Design System Architect/AGENTS]] — owner of the §13 gaps.
- [[Team/Vera - QA Specialist/AGENTS]] — owner of the §14 gate.
- [[Team/Asdair - Household Shopping Steward/AGENTS]] — the standing job this surface is the household-facing front end of.
