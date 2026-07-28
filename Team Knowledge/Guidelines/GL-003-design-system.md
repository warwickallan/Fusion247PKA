# GL-003 - Design System

> **This Guideline is a general rule every creative agent reads on every relevant action.** Charta, Pixel, and any future visual specialist consume this file at the start of every task. Iris is the default author, but the values are the user's.

> **Empty is honest; placeholder is dangerous.** Until a value has actually been chosen, the placeholder stays. A populated-with-defaults design system silently sets choices the user never made. Anything below still reading `<unset>` is **not yet pinned** — the agent routes to Iris or works in flagged fallback mode for that section, and never improvises a value.

> **Edits are Iris-only.** The user proposes; Iris authors. Charta and Pixel only ever read this file. The split keeps the schema coherent — multiple authors silently drift it.

---

## Status and authority (read before using this file)

**Populated:** 2026-07-29 by Iris, from the live cockpit stylesheet. This is the first population; before it, every value in all six sections was a literal `<placeholder>`.

**Scope.** This design system documents the **Fusion247 Cockpit** — the surface at `services/cockpit/public/`. It is not yet a whole-estate brand. If a second surface is built, it either adopts these tokens or GL-003 is extended to carry two themes; it does not fork silently.

**Direction of authority — important, and not yet what it should be.**

- **Today:** `services/cockpit/public/styles.css` `:root` (lines 5–15) is the *de facto* source. GL-003 is **descriptive of record** — it documents that block and makes its implicit intent explicit.
- **Intended:** GL-003 becomes prescriptive and the CSS reads from it. Reconciling the two (fixing the recorded defects below) is a **separate, deliberate, authorised change**. It has not happened.
- **Consequence:** if the CSS `:root` changes, **every contrast figure in §2 is stale until re-measured.** Do not trust a number here against a `:root` you have not diffed. The measurement method is in §2d so anyone can redo it.

**Section fill status.**

| Section | Status |
|---|---|
| §1 Identity | **Partial** — brand name observed; voice/tone, audience `<unset>` |
| §2 Color palette | **Populated + measured** — the substantive content of this file |
| §3 Typography | **Partial** — families populated; type-scale tokens `<unset>` (none exist) |
| §4 Spacing scale | **`<unset>`** — no spacing tokens exist in the live CSS |
| §5 Imagery style | **Partial** — icon reality recorded; photography/illustration `<unset>` |
| §6 Voice samples | **`<unset>`** — not derivable from an artefact; needs the user |

A partial GL-003 is more dangerous than an empty one, because agents use the populated values and silently default the missing ones. That is why the table above exists. **Read it before reading anything else.**

---

## 1. Identity

- **Brand name:** `Fusion247` — no space, capital F, digits closed up.
  - Product name of record: **`Fusion247 Cockpit`** (`manifest.webmanifest` `name`, `<title>`).
  - Short name: **`Fusion247`** (`manifest` `short_name`, `apple-mobile-web-app-title`).
  - Wordmark: **`F247`** (in `icon.svg`, weight 800, letter-spacing `-1`).
  - ⚠️ **Unresolved:** the spaced variant `Fusion 247` appears elsewhere in the estate (e.g. connected-service names). The cockpit surface is unambiguous; the estate is not. This needs one decision from the user, then locking here. Until then, **on cockpit surfaces use `Fusion247`.**
- **Voice/tone descriptors:** `<unset>`
  *Reason:* not derivable from a stylesheet. Deriving adjectives from existing UI strings would be inventing a decision the user never made. Needs a guided session per [[SOP-006-author-a-design-system]] §Step 2.
- **Audience:** `<unset>`
  *Reason:* same. One observable **scope constraint** is recorded here because it bounds every later choice and is a fact about the artefact, not a guess: the Cockpit is a **private, single-operator surface on a tailnet**, not a public marketing property. It is designed to be glanced at on a phone, worked on a laptop, and read across a room. That constrains type size and contrast; it does not tell us who the brand *speaks to*, which remains `<unset>`.

---

## 2. Color palette

Sixteen colour tokens, all defined twice — once in `:root` and once under `@media (prefers-color-scheme: dark)`. **Both schemes ship. Both are live. Any change must be evaluated in both**, because which surface is "worse" *reverses* between them (see §2b note).

`--park` is the one token **not** overridden in dark mode; it carries the same value in both.

### 2a. Tokens and intent

The intent column is the load-bearing part of this file. A token list without intent is what the CSS already is, and it is exactly what failed.

| Token | Light | Dark | What it is FOR | What it must NEVER be |
|---|---|---|---|---|
| `--bg` | `#eef1f5` | `#0f151d` | The page canvas behind `.main` — the outermost surface. | A card surface. Cards sit on `--panel` so the elevation step reads. |
| `--panel` | `#fff` | `#18212e` | The raised surface: `.tile`, `.item`, `.topbar`, `.nav`, `.sheet-card`. Where content lives. | Text. |
| `--panel2` | `#f7f9fc` | `#1d2836` | The inset/recessed surface: `.act` button faces, `.read code`/`pre`, the `.tech` drawer, the neutral `.app-pill`. | Text. Also not a *third* elevation for content — it means "inset", not "higher". |
| `--ink` | `#16202e` | `#e7edf5` | Primary text: titles, labels, headings, `.read` body, button labels. Highest-contrast reading. | A background. |
| `--ink2` | `#47566b` | `#a3b0c2` | **Secondary text — the muted-but-readable role.** Descriptions, reasons, status lines, blurbs, breadcrumb-current. **The lowest-contrast token that clears AA for body text on every surface in both schemes** (worst case 6.16:1). | A background. Do not reach past it to `--ink3` for muted text; `--ink2` *is* the muted-text token. |
| `--ink3` | `#768498` | `#6c7a8f` | **Decoration and non-essential ornament only.** Legitimate uses: the `.chev` affordance glyph and the `.crumb-sep` separator — marks whose meaning is fully carried by adjacent text. | **Any text a user needs to read.** Not descriptions, not empty-state explanations, not lane subtitles, not the "why" line, not timestamps, not nav labels, not eyebrows, not technical detail. It is sub-4.5:1 on **every** surface in light mode and on `--panel`/`--panel2` in dark. If you want muted informative text, the token is `--ink2`. See §2c — the entire open-defect register is this rule being broken. |
| `--hair` | `#e2e7ee` | `#2a3644` | 1px borders, dividers, scrollbar thumbs, the `blockquote` rule. A *hint* of an edge. | Text, ever. Also never the sole means of delineating something the user must find — at 1.24:1 (light) / 1.32:1 (dark) against `--panel` it is below any perceptibility floor for a required boundary. |
| `--park` | `#66748a` | `#66748a` | The **neutral status rail**: the default 4px `border-left` on `.tile`/`.item` meaning "no status colour applies", and the neutral `.app-status` dot. | Text. Also never a background for text. |
| `--accent` | `#0e7c86` | `#37c3c9` | The brand colour as a **mark**: hover borders, the focus outline, the blue tile numeral, `.chip.prog` dot, `summary` disclosure links. | Small text on light surfaces if it can be avoided — 4.95:1 on `--panel` clears AA but with almost no margin, and 4.37:1 on `--bg`. **For text, use `--accent-ink`.** |
| `--accent-ink` | `#0a5c64` | `#6fd8dc` | The accent as **text**: links, `.back`, `.crumb`, active nav label, and all text sitting on `--accent-w`. Comfortable in both schemes (6.64:1 worst case). | A fill behind white text. |
| `--accent-w` | `#e2f1f2` | `#123138` | The accent **tint background** for pills, counts, active tabs. | Paired with anything but `--accent-ink`. |
| `--ok` | `#1f9d57` | `#3ad07f` | Success as a **rail, dot or numeral** — the green `border-left`, the up dot, the large `.t-num`. | A fill behind white text (2.00:1 in dark — see D-11), and not small text on `--panel2` or on `--ok-w`. It is a tint-strength colour, not an ink. |
| `--ok-w` | `#e4f4ea` | `#10331f` | Success **tint background** for pills and chips. | Paired with `--ok` as text (3.06:1 light). Pair with `--ink2` (6.55:1 / 6.30:1). |
| `--warn` | `#b26a12` | `#e0a63a` | Attention as a **rail, dot or numeral** — "needs a decision", "service not answering". | A fill behind white text (4.23:1 light / 2.17:1 dark — both fail). Not small text on `--panel` in light (4.23:1). Not `--warn-w`-backed text. |
| `--warn-w` | `#f8ecda` | `#3a2c12` | Attention **tint background**. | Paired with `--warn` as text (3.63:1 light). Pair with `--ink2`. |
| `--stop` | `#c1453c` | `#ee6a5f` | Blocked / error / destructive: the red rail, error text, `.act.decline`, `.nav-badge` and `.load-err` fills. The only status colour that is AA-safe as text on `--panel` in **both** schemes. | A white-text fill in **dark** (3.06:1). Not `--stop-w`-backed text in light (4.14:1). |
| `--stop-w` | `#f8e5e3` | `#3a1c19` | Error **tint background**. | Paired with `--stop` as text in light (4.14:1). Pair with `--ink2` (6.16:1 / 7.02:1). |

**The rule the three status tints share, stated once:** `--ok`, `--warn`, `--stop` are *signal* colours sized for rails, dots and large numerals. Their `-w` partners are *surfaces*. **A signal colour on its own tint is not a text pairing** — that combination is 3.06:1, 3.63:1 and 4.14:1 in light. The tint carries the tone; `--ink2` carries the words. The cockpit already states this reasoning in a comment at `styles.css:55-57` for `.app-pill`; this row is that reasoning promoted from a comment into a rule.

**Missing token — recorded, not invented.**

| Role | Token | Status |
|---|---|---|
| Focus indicator | `<unset>` | The **live** CSS has no `:focus-visible` styling at all; the browser default ring is the only keyboard affordance. The in-flight worktree adds `outline:2px solid var(--accent)` on three selectors (`.tile`, `.app-nav-btn`, `.crumb`) — 4.37:1 / 8.57:1 against `--bg`, which clears the 3:1 non-text floor. **If that ships, a `--focus` token should be named here rather than left as a raw `var(--accent)` in three places.** |

### 2b. Measured contrast — every pairing that actually occurs

All figures computed from the token hexes above using WCAG 2.x relative luminance (§2d), rounded to two decimals. **AA thresholds:** 4.5:1 normal text · 3:1 large text (≥24px, or ≥18.66px bold) · 3:1 non-text UI/graphical. This table is a **lookup**, not a warning list — the passes are as load-bearing as the failures.

**Reversal you must not assume away.** In **light** mode `--panel` (#fff) is the *most* forgiving surface and `--bg` the least. In **dark** mode that **reverses**: `--panel` (#18212e) is *lighter* than `--bg` (#0f151d), so a mid-grey ink scores *worse* on `--panel` and *better* on `--bg`. `--ink3` is 3.36 on `--bg` in light but 4.21 on `--bg` in dark — the same pairing, better in dark. **Never infer one scheme's figure from the other.** This is precisely how a wrong dark-mode figure got into circulation.

#### Text on `--panel` (cards, topbar, nav, detail sheet)

| Foreground | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `--ink` | **16.40** | **13.76** | PASS | `.i-title`, `.t-lbl`, `.grp h2`, `.brand`, `.read` |
| `--ink2` | **7.47** | **7.37** | PASS | `.status-line`, `.refresh`, `.status-mini`, `.d-reason`, `.opp-body`, `.app-status`, `.read blockquote` |
| `--ink3` | **3.80** | **3.72** | **FAIL both** | `.t-desc`, `.nav-btn`, `.i-why`, `.fresh`, `.opp-atom`, `.d-eyebrow`, `.chev`\*, `.opp-body .mono` |
| `--accent-ink` | **7.70** | **9.67** | PASS | `.back`, `.crumb`, `.d-links a`, `.read a`, `.nav-btn.on`, `.i-eyebrow.suggestion` |
| `--accent` | **4.95** | **7.57** | PASS (thin in light) | `.opp-body summary` |
| `--stop` | **5.02** | **5.30** | PASS | `.err`, `.status-mini.red`, `.status-line.red`, `.i-eyebrow.blocked` |
| `--warn` | **4.23** | **7.47** | **FAIL light** | `.i-eyebrow.decision` (9.5px) |
| `--ok` | **3.49** | **8.11** | FAIL light as normal text; **PASS as large text** | only `.t-num` (32px/700) — passes on the large-text threshold, not the normal one |

\* `.chev` is a decorative affordance glyph; see §2c note on legitimate `--ink3` use.

#### Text on `--bg` (the page canvas)

| Foreground | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `--ink` | **14.48** | **15.57** | PASS | `.grp h2`, `.p-h h1` |
| `--ink2` | **6.59** | **8.34** | PASS | `.app-blurb`, `.crumb.on` |
| `--ink3` | **3.36** | **4.21** | **FAIL both** | `.empty`, `.empty.big`, `.lane-sub`, `.crumb-sep`\* |
| `--accent-ink` | **6.80** | **10.94** | PASS | — |
| `--accent` | **4.37** | **8.57** | **FAIL light** as text; PASS as non-text (focus ring) | worktree focus outline |

#### Text on `--panel2` (button faces, code, the tech drawer)

| Foreground | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `--ink` | **15.55** | **12.65** | PASS | `.act`, `.read code`, `.read pre` |
| `--ink2` | **7.08** | **6.78** | PASS | `.act.defer`, `.app-pill` |
| `--ink3` | **3.60** | **3.42** | **FAIL both** | `.tech summary`, `.mono` |
| `--stop` | **4.76** | **4.87** | PASS | `.act.decline` |
| `--ok` | **3.31** | — | FAIL light | not currently used as text on `--panel2` |

#### Text on tint backgrounds

| Pairing | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `--accent-ink` on `--accent-w` | **6.64** | **8.23** | PASS | `.count`, `.g-count`, `.chip.prog`, `.opp-disp`, `.app-nav-btn.on` |
| `--ink2` on `--ok-w` | **6.55** | **6.30** | PASS | `.app-pill.up` |
| `--ink2` on `--warn-w` | **6.40** | **6.16** | PASS | `.app-pill.down` |
| `--ink2` on `--stop-w` | **6.16** | **7.02** | PASS | (not yet used — the safe pairing for `.chip.block`) |
| `--ok` on `--ok-w` | **3.06** | **6.93** | **FAIL light** | `.done-pill`, `.chip.ok` |
| `--warn` on `--warn-w` | **3.63** | **6.25** | **FAIL light** | (not used as text — correctly avoided) |
| `--stop` on `--stop-w` | **4.14** | **5.05** | **FAIL light** | `.chip.block` |

#### White text on a colour fill

| Pairing | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `#fff` on `--stop` | **5.02** | **3.06** | **FAIL dark** | `.nav-badge`, `.load-err` |
| `#fff` on `--warn` | **4.23** | **2.17** | **FAIL both** | `.opp-conflict` |
| `#fff` on `--ok` | **3.49** | **2.00** | **FAIL both — worst pairing in the system** | `.act.accept` |

#### Non-text (3:1 floor where the boundary or state carries meaning)

| Pairing | Light | Dark | Verdict | Note |
|---|---|---|---|---|
| `--park` rail on `--panel` | **4.74** | **3.42** | PASS | neutral status `border-left` |
| `--stop` rail on `--panel` | **5.02** | **5.30** | PASS | |
| `--accent` rail on `--panel` | **4.95** | **7.57** | PASS | |
| `--warn` rail on `--panel` | **4.23** | **7.47** | PASS | |
| `--ok` rail on `--panel` | **3.49** | **8.11** | PASS | thinnest of the five in light |
| `--hair` border on `--panel` | **1.24** | **1.32** | below 3:1 | Advisory, not a violation: every bordered control also carries a text label, so the border is not required to identify it. It **is** required if it ever becomes the only cue. |
| `--panel` vs `--bg` (elevation) | **1.13** | **1.13** | below 3:1 | Advisory. The card/canvas step is deliberately whisper-quiet and identical in both schemes. Nothing may depend on that step alone. |

**All five status rails clear 3:1 in both schemes** — the colour-coding system itself is sound. The failures below are all *text* failures, not signal-system failures. And no state in the cockpit is signalled by colour alone: every rail is accompanied by a word. Keep it that way.

### 2c. Known defects — open, measured, not fixed

**These are real and currently shipping.** This register exists so that nobody reads §2a/§2b and concludes the system is compliant. No CSS has been changed by this document.

Severity per [[SOP-007-audit-content-for-design-system-compliance]] §Step 4, weighted by whether the text is on a primary reading path.

| ID | Rule (live `styles.css`) | Pairing | Light | Dark | Sev | Note |
|---|---|---|---|---|---|---|
| **D-1** | `.t-desc` (L49) | `--ink3` on `--panel` | 3.80 | 3.72 | HIGH | Pre-existing. Tile description — the L1 glance line. Found by Vera. |
| **D-2** | `.empty` / `.empty.big` (L59) | `--ink3` on `--bg` | 3.36 | 4.21 | HIGH | Pre-existing. The empty state *is* the whole content when a lane is empty. Found by Vera. Partially mitigated in the worktree: `.app-view .empty` is scoped to `--ink2`; the **shared** rule is untouched. |
| **D-3** | `.lane-sub` (L58) | `--ink3` on `--bg` | 3.36 | 4.21 | HIGH | 7 existing usages, an 8th added in the in-flight change. Found by Vera. |
| **D-4** | `.nav-btn` (L35) | `--ink3` on `--panel` | 3.80 | 3.72 | HIGH | **Not previously flagged.** Every inactive bottom-nav / rail label (10.5px phone, 14px desktop). Primary navigation. |
| **D-5** | `.i-why` (L84) | `--ink3` on `--panel` | 3.80 | 3.72 | HIGH | **Not previously flagged.** The "why this matters" line on every item — the L2 reason, arguably the most important text in the product. |
| **D-6** | `.opp-atom` (L66) | `--ink3` on `--panel` | 3.80 | 3.72 | MEDIUM | **Not previously flagged.** Evidence atoms under an Opportunity. |
| **D-7** | `.fresh` (L85) | `--ink3` on `--panel` | 3.80 | 3.72 | MEDIUM | **Not previously flagged.** Freshness timestamp — informative, not decorative. |
| **D-8** | `.d-eyebrow` (L107) | `--ink3` on `--panel` | 3.80 | 3.72 | MEDIUM | **Not previously flagged.** Detail-sheet category eyebrow, 10px uppercase — small type makes this worse in practice than the ratio implies. |
| **D-9** | `.tech summary` (L115) | `--ink3` on `--panel2` | 3.60 | 3.42 | MEDIUM | **Not previously flagged.** The L4 technical drawer's own label. |
| **D-10** | `.mono` (L116) | `--ink3` on `--panel2` / `--panel` | 3.60 / 3.80 | 3.42 / 3.72 | MEDIUM | **Not previously flagged.** Technical detail body text. |
| **D-11** | `.act.accept` (L91) | `#fff` on `--ok` | **3.49** | **2.00** | **HIGH** | **Not previously flagged. The single worst pairing in the system.** The primary confirm button (12.5px/650). 2.00:1 in dark is barely above the theoretical 1:1 floor. |
| **D-12** | `.nav-badge` (L38), `.load-err` (L60) | `#fff` on `--stop` | 5.02 ✔ | **3.06** | HIGH | **Not previously flagged.** Passes in light, fails in dark. `.load-err` is the "something broke" message; `.nav-badge` is the unread count. Classic light-only-tested defect. |
| **D-13** | `.opp-conflict` (L70) | `#fff` on `--warn` | **4.23** | **2.17** | MEDIUM | **Not previously flagged.** Fails both schemes. 10.5px bold is not large text. |
| **D-14** | `.done-pill` (L93), `.chip.ok` (L99) | `--ok` on `--ok-w` | **3.06** | 6.93 ✔ | MEDIUM | **Not previously flagged.** Light-only. |
| **D-15** | `.chip.block` (L99) | `--stop` on `--stop-w` | **4.14** | 5.05 ✔ | MEDIUM | **Not previously flagged.** Light-only, and close — but 4.14 < 4.5. |
| **D-16** | `.i-eyebrow.decision` (L82) | `--warn` on `--panel` | **4.23** | 7.47 ✔ | MEDIUM | **Not previously flagged.** Light-only. |

**Count: 16 open defects.** Ten are the `--ink3`-as-text rule (D-1…D-10); six are status colours used as text or as fills behind white (D-11…D-16). Vera's gate found three of the sixteen — correctly, because her scope was the change in front of her. **The token-level blast radius is larger than any single gate could see. That is the argument for this document existing.**

**Legitimate `--ink3` uses (do not "fix" these):** `.chev` (L85) and, in the in-flight worktree, `.crumb-sep`. Both are `›` glyphs whose meaning is fully carried by adjacent text and by the control they sit on. They are ornament. They are what the token is *for*.

**Off-token colour values in the live CSS** (drift, LOW severity, recorded for completeness):

| Value | Location | Note |
|---|---|---|
| `#c0392b` | `.load-err` fallback `var(--stop,#c0392b)` | Not in the palette. Unreachable while `--stop` is defined, but it is an off-token hex in the file. |
| `#e08a1e` | `.opp-conflict` fallback `var(--warn,#e08a1e)` | Same. |
| `rgba(6,10,16,.5)` | `.sheet` scrim | Untokenised. A `--scrim` token would be the honest home. |
| `#0e1620` | `icon.svg` background | Close to but not equal to `--bg` dark `#0f151d`. |
| `#fff` | five rules | Literal white as a fill-text colour. Untokenised, and the subject of D-11/D-12/D-13. |

### 2d. How these figures were produced

Reproducible by hand or by script. WCAG 2.x:

1. Per channel, `s = v / 255`; `lin = s / 12.92` if `s ≤ 0.04045`, else `lin = ((s + 0.055) / 1.055) ^ 2.4`.
2. `L = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin`.
3. `contrast = (L_lighter + 0.05) / (L_darker + 0.05)`.

**Verification:** this model reproduces the three independently-measured figures (`.t-desc` 3.80/3.72, `.empty` 3.36/4.21, `.lane-sub` 3.36/4.21) to two decimals before any other figure in §2b was published. It also reproduces the two ratios already asserted in the CSS comments at `styles.css:55-57` (`--ok` on `--ok-w` "3.1" → 3.06; `--warn` on `--warn-w` "3.6" → 3.63).

**When you change a token, re-measure both schemes.** A figure carried over from one scheme, or from a previous value, is how a wrong number enters the record.

---

## 3. Typography

Two font tokens exist. There is **no separate display face** — headings are the body stack at heavier weight. That is a real design decision and it is now recorded as one.

| Role | Token | Family stack | Weights in use | Usage |
|---|---|---|---|---|
| Heading | `--font` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | 700, 800 | `.brand` (800), `.grp h2` (800), `.p-h h1`, `.sheet-card h1`, `.t-lbl` (700), `.read h1`–`h4`. Headings tighten tracking: `letter-spacing:-.02em`. |
| Body | `--font` | same stack | 500, 600, 650, 700 | All copy, labels, buttons. 650 is the house "emphasis without bold" weight (`.i-title`, `.act`, `.d-links a`). |
| Mono | `--mono` | `ui-monospace, "Cascadia Code", Consolas, monospace` | 600, 700 | Numerics and machine text: `.t-num`, `.count`, `.g-count`, `.chip`, `.i-eyebrow`, `.d-eyebrow`, `.fresh`, `.mono`, `.read code`/`pre`, `.app-pill`. **Mono means "this is a measurement or a machine string"** — it is a semantic signal here, not decoration. |

**No webfonts are loaded.** The stack is system-native by design (`index.html` has no font `<link>`). Charta and Pixel must not introduce a webfont into a cockpit-adjacent deliverable without extending this section first.

**Type scale tokens: `<unset>`.**
*Reason:* no `--text-*` tokens exist in the live CSS. Every size is a literal, and the set is **not a scale** — 18 distinct values including half-pixel steps (`9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 18, 19, 20, 21, 22, 32px`). Inventing a ladder here to fill the table would be designing a new system, which this document does not do. Recording the observed set is the honest answer, and it is what a future scale must be reconciled against.

**Observed roles (descriptive, for lookup):**

| Size | Role in use |
|---|---|
| 32px / 700 mono | `.t-num` — the glance numeral |
| 22px, 21px | pane title, sheet title |
| 20px, 18px | `.read h1`, `.read h2` |
| 15–16px | item titles, tile labels, `.read` body, `.d-reason`, big empty state |
| 13–14px | status lines, group headings, links, app-nav, empty state |
| 12–12.5px | descriptions, buttons, the "why" line, `.opp-body` |
| 9–11.5px | eyebrows, chips, counts, nav labels, timestamps, atoms |

**Line-height:** declared only where reading depth demands it — `1.65` (`.read`), `1.6` (`.d-reason`), `1.45` (`.opp-body`, `.app-status`), `1.55` (`.app-blurb`, in-flight), `1` (`.t-num`, `.nav-ico`). Everything else uses the browser default. `<unset>` as a token; recorded as observed practice.

**The large-text threshold, stated once because §2 depends on it.** AA relaxes to 3:1 only at ≥24px, or ≥18.66px bold. In this system that is satisfied by **exactly three** rules: `.t-num` (32px/700), `.p-h h1` (22px, bold by default) and `.sheet-card h1` (21px, bold by default). **Everything else in the cockpit is normal text and needs 4.5:1.** Do not reach for the 3:1 exemption on a 15px label.

---

## 4. Spacing scale

- **Base unit:** `<unset>`
  *Reason:* no `--space-*` tokens exist in the live CSS, and the literal values in use do not sit on a consistent 4px or 8px ladder. Observed padding / margin / gap values: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 34, 40px`. Nine of those are odd numbers; several differ by 1px from a neighbour. Declaring a base unit here would assert a grid the product does not follow.

| Token | Value | Use |
|---|---|---|
| `--space-xs` … `--space-2xl` | `<unset>` | No spacing tokens exist. |

**Consequence for Charta and Pixel:** you have **no spacing grammar to inherit** from this system. For cockpit-adjacent work, match the observed values of the nearest analogous component rather than imposing a ladder — and say in the deliverable that §4 was `<unset>`.

**Border radius:** also untokenised. Observed, and it *is* semantically consistent even though it is not a named ladder — larger radius means larger surface:

| Radius | Applied to |
|---|---|
| `50%` | dots (`.brand .dot`, `.chip .d`, `.as-dot`) |
| `20px` | pills and counts (`.chip`, `.count`, `.g-count`, `.opp-disp`, `.app-pill`) |
| `18px` | the detail sheet |
| `15px` | tiles |
| `13px` | items, status lines |
| `9–11px` | buttons, small controls, `.load-err` |
| `5–8px` | inline code, code blocks, scrollbar thumb |

That progression is a real, working rule. It is recorded as observed practice; promoting it to named tokens is a decision for the user, not for Iris.

---

## 5. Imagery style

- **Photography style:** `<unset>` — the cockpit ships no photography. Not a gap in the product; a genuine absence of a decision.
- **Illustration style:** `<unset>` — no illustration in the product.
- **Icon style:** **Emoji glyphs, rendered by the platform font.** Not an icon family.
  - *Nav set (`app.js:9-13`):* 🏠 Home · 💡 Ideas · 🧠 Brain · 📤 Outputs · 🛠 System.
  - *Chrome:* `›` as the chevron and breadcrumb separator, set in the text font, not an icon.
  - *App icon:* a single hand-authored `icon.svg` — dark `#0e1620` field, an `--accent`→field gradient, `#37c3c9` line strokes with round caps, a filled dot, and the `F247` wordmark in `#e7edf5`.
  - ⚠️ **This is a consequence, not a choice on record.** Emoji render differently on every platform and cannot be recoloured, so they can never carry state — the cockpit correctly never asks them to. If the user ever wants a consistent icon voice, that is a genuine decision (Lucide / Phosphor / Tabler / custom) and it belongs in this section. Until then, **agents must not introduce a vector icon family into a cockpit-adjacent deliverable** — it would silently create a second icon language.
- **Family lock:** `<unset>`

---

## 6. Voice samples

`<unset>`

*Reason:* voice is authored by the user, never derived. Three sample sentences reverse-engineered from existing UI strings would read as canonical while being Iris's invention — the exact failure mode this file's second framing note warns about. Needs a guided session per [[SOP-006-author-a-design-system]] §Step 7.

Until then, any agent writing copy for a cockpit-adjacent deliverable works in **flagged fallback mode** and notes "GL-003 §6 not populated" on the deliverable.

---

## How agents use this file

- **At session start, every creative agent reads this Guideline.** Charta and Pixel always; Iris on every authoring or audit task.
- **Read the §Status fill table first.** Sections marked `<unset>` are not pinned. Do not improvise them — either route to Iris via [[SOP-006-author-a-design-system]], or work in flagged fallback mode and note "GL-003 §X not populated" in the deliverable.
- **Before shipping any text-on-colour pairing, check §2b.** If the pairing is not in the table, compute it with §2d and bring the number — do not estimate, and do not infer one scheme's figure from the other.
- **§2c is an open register, not history.** The cockpit currently ships 16 measured sub-AA pairings. Do not describe the system as compliant, and do not copy a defective pairing into a new deliverable on the grounds that it is already in use.
- **When a violation surfaces a missing token, extend GL-003** rather than special-casing the deliverable. `--ink3`-as-body-text is the canonical example: the answer is a token-role rule, not a per-component patch.
- **When this Guideline evolves,** in-flight deliverables that referenced the changed section are flagged for re-render. Older deliverables become stale candidates and get re-rendered next time they are touched (boy-scout rule), not bulk-rebuilt on the spot.
- **Audit cadence.** Iris runs [[SOP-007-audit-content-for-design-system-compliance]] on request, when a token is added, or when drift is suspected. The audit names violations; the user decides which to fix.

## References

- [[SOP-006-author-a-design-system]] — the procedure for populating or extending this Guideline.
- [[SOP-007-audit-content-for-design-system-compliance]] — the procedure for verifying deliverables against this Guideline.
- [[SOP-008-build-an-infographic]] — Charta's skill; reads from this Guideline.
- [[SOP-009-generate-a-styled-image]] — Pixel's skill; reads from this Guideline.
- [[GL-001-file-naming-conventions]] — slug, date, filename rules.
- [[GL-002-frontmatter-conventions]] — entity frontmatter schema.
- [[Team/Iris - Design System Architect/AGENTS]] — Iris's contract; the default author of this Guideline.
- Source of record for §2–§5: `services/cockpit/public/styles.css` (`:root`, lines 5–15), `index.html`, `manifest.webmanifest`, `icon.svg`, `app.js:9-13`.
