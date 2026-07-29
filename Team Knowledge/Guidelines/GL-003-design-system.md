# GL-003 - Design System

> **This Guideline is a general rule every creative agent reads on every relevant action.** Charta, Pixel, and any future visual specialist consume this file at the start of every task. Iris is the default author, but the values are the user's.

> **Empty is honest; placeholder is dangerous.** Until a value has actually been chosen, the placeholder stays. A populated-with-defaults design system silently sets choices the user never made. Anything below still reading `<unset>` is **not yet pinned** — the agent routes to Iris or works in flagged fallback mode for that section, and never improvises a value.

> **Edits are Iris-only.** The user proposes; Iris authors. Charta and Pixel only ever read this file. The split keeps the schema coherent — multiple authors silently drift it.

---

## Status and authority (read before using this file)

**Populated:** 2026-07-29 by Iris, from the live cockpit stylesheet. This is the first population; before it, every value in all six sections was a literal `<placeholder>`.

**§2b / §2b-bis / §2c amended:** 2026-07-29 by **Felix**, after closing D-1…D-16 in `styles.css`. ⚠️ **This file is Iris-only by the rule at the top, and Felix is not Iris.** The amendment is confined to what the fix *measured* — updated ratios, re-keyed line numbers, closed defects, two newly-found ones — and makes **no visual-language decision**. Three judgement calls are deliberately left open and flagged as Iris's: the `.act.accept` fill demotion (D-11), the `--ok-ink` / `--warn-ink` token gap (§2a), and how to resolve D-17/D-18 without losing the faded-state signal. **Iris should ratify or revise this amendment.** It is recorded here rather than done silently because an unattributed edit to an SSOT is how the SSOT stops being trusted.

**Scope.** This design system documents the **Fusion247 Cockpit** — the surface at `services/cockpit/public/`. It is not yet a whole-estate brand. If a second surface is built, it either adopts these tokens or GL-003 is extended to carry two themes; it does not fork silently.

**Direction of authority — important, and not yet what it should be.**

- **Today:** `services/cockpit/public/styles.css` `:root` (lines 5–15) is the *de facto* source. GL-003 is **descriptive of record** — it documents that block and makes its implicit intent explicit.
- **Intended:** GL-003 becomes prescriptive and the CSS reads from it.
- **Reconciliation — partially done, 2026-07-29.** The separate authorised change anticipated here has now happened for the *usage* half: **D-1…D-16 are fixed in `styles.css`.** Note what did **not** change — **`:root` is untouched. Not one token value moved, and no token was added.** All sixteen were fixed by changing *which existing token each rule reaches for*, which is why every §2b figure below still holds. Two new defects (D-17, D-18) were found in the process and are open.
- **Consequence:** if the CSS `:root` changes, **every contrast figure in §2 is stale until re-measured.** Do not trust a number here against a `:root` you have not diffed. §2d names two executable tools that redo the whole measurement, one of which reads the token hexes straight out of `styles.css` and refuses to run if it cannot reproduce five independently-pinned figures.

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
| `--ink3` | `#768498` | `#6c7a8f` | **Decoration and non-essential ornament only.** Legitimate uses: the `.chev` affordance glyph and the `.crumb-sep` separator — marks whose meaning is fully carried by adjacent text. | **Any text a user needs to read.** Not descriptions, not empty-state explanations, not lane subtitles, not the "why" line, not timestamps, not nav labels, not eyebrows, not technical detail. It is sub-4.5:1 on **every** surface in light mode and on `--panel`/`--panel2` in dark. If you want muted informative text, the token is `--ink2`. See §2c — D-1…D-10, ten of the sixteen original defects, were all this one rule being broken. They are now closed, and `--ink3` survives on exactly two selectors (`.chev`, `.crumb-sep`). **Keep it that way: if a third appears, it is almost certainly a defect.** |
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
| Success as **text/ink** | `--ok-ink` `<unset>` | **The gap D-11 ran into.** `--ok` is a tint-strength signal colour; there is no green dark enough to sit under white or over `--ok-w` at AA. The D-11 fix therefore had to demote `.act.accept`'s solid fill to a tint. An `--ok-ink` (the `--accent`/`--accent-ink` pattern, applied to green) would let the affirmative button keep a solid fill. **Iris's call — not invented here.** |
| Attention as **text/ink** | `--warn-ink` `<unset>` | Same gap, same shape: `--warn` fails as text on `--panel` in light (4.23) and behind white in both (4.23 / 2.17). D-13 and D-16 both routed around it rather than inventing a token. `.app-status.down` and the inline `style="color:var(--warn)"` at `app.js:347,355` are the remaining places that want it. |

### 2b. Measured contrast — every pairing that actually occurs

All figures computed from the token hexes above using WCAG 2.x relative luminance (§2d), rounded to two decimals. **AA thresholds:** 4.5:1 normal text · 3:1 large text (≥24px, or ≥18.66px bold) · 3:1 non-text UI/graphical. This table is a **lookup**, not a warning list — the passes are as load-bearing as the failures.

**Reversal you must not assume away.** In **light** mode `--panel` (#fff) is the *most* forgiving surface and `--bg` the least. In **dark** mode that **reverses**: `--panel` (#18212e) is *lighter* than `--bg` (#0f151d), so a mid-grey ink scores *worse* on `--panel` and *better* on `--bg`. `--ink3` is 3.36 on `--bg` in light but 4.21 on `--bg` in dark — the same pairing, better in dark. **Never infer one scheme's figure from the other.** This is precisely how a wrong dark-mode figure got into circulation.

#### Text on `--panel` (cards, topbar, nav, detail sheet)

| Foreground | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `--ink` | **16.40** | **13.76** | PASS | `.i-title`, `.t-lbl`, `.grp h2`, `.brand`, `.read` |
| `--ink2` | **7.47** | **7.37** | PASS | `.status-line`, `.refresh`, `.status-mini`, `.d-reason`, `.opp-body`, `.app-status`, `.read blockquote`, **and (since the D-1…D-10/D-16 fix) `.t-desc`, `.nav-btn`, `.i-why`, `.fresh`, `.opp-atom`, `.d-eyebrow`, `.opp-body .mono`, `.i-eyebrow.decision`** |
| `--ink3` | **3.80** | **3.72** | FAIL as text — **now used only as ornament** | `.chev`\* only |
| `--accent-ink` | **7.70** | **9.67** | PASS | `.back`, `.crumb`, `.d-links a`, `.read a`, `.nav-btn.on`, `.i-eyebrow.suggestion` |
| `--accent` | **4.95** | **7.57** | PASS (thin in light) | `.opp-body summary` |
| `--stop` | **5.02** | **5.30** | PASS **as declared** — but see §2b-bis, `.i-eyebrow.blocked` renders at `opacity:.85` and lands at 3.91 / 4.17 (D-17) | `.err`, `.status-mini.red`, `.status-line.red`, `.i-eyebrow.blocked` |
| `--warn` | **4.23** | **7.47** | **FAIL light** — no longer used as text | (none since D-16; survives as the `.item.amber` rail, which is non-text) |
| `--ok` | **3.49** | **8.11** | FAIL light as normal text; **PASS as large text** | only `.t-num` (32px/700) — passes on the large-text threshold, not the normal one |

\* `.chev` is a decorative affordance glyph; see §2c note on legitimate `--ink3` use.

#### Text on `--bg` (the page canvas)

| Foreground | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `--ink` | **14.48** | **15.57** | PASS | `.grp h2`, `.p-h h1` |
| `--ink2` | **6.59** | **8.34** | PASS | `.app-blurb`, `.crumb.on`, **and (since the D-2/D-3 fix) `.empty`, `.empty.big`, `.lane-sub`** |
| `--ink3` | **3.36** | **4.21** | FAIL as text — **now used only as ornament** | `.crumb-sep`\* only |
| `--accent-ink` | **6.80** | **10.94** | PASS | — |
| `--accent` | **4.37** | **8.57** | **FAIL light** as text; PASS as non-text (focus ring) | worktree focus outline |

#### Text on `--panel2` (button faces, code, the tech drawer)

| Foreground | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `--ink` | **15.55** | **12.65** | PASS | `.act`, `.read code`, `.read pre` |
| `--ink2` | **7.08** | **6.78** | PASS | `.act.defer`, `.app-pill`, **and (since the D-9/D-10 fix) `.tech summary`, `.mono`** |
| `--ink3` | **3.60** | **3.42** | **FAIL both** | **no longer used** — nothing on `--panel2` reaches for `--ink3` since D-9/D-10 |
| `--stop` | **4.76** | **4.87** | PASS | `.act.decline` |
| `--ok` | **3.31** | — | FAIL light | not currently used as text on `--panel2` |

#### Text on tint backgrounds

| Pairing | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `--accent-ink` on `--accent-w` | **6.64** | **8.23** | PASS | `.count`, `.g-count`, `.chip.prog`, `.opp-disp`, `.app-nav-btn.on` |
| `--ink` on `--ok-w` | **14.39** | **11.77** | PASS — the strongest text pairing in the system | `.act.accept` (since D-11) |
| `--ink2` on `--ok-w` | **6.55** | **6.30** | PASS | `.app-pill.up`, **`.done-pill`, `.chip.ok`** (since D-14) |
| `--ink2` on `--warn-w` | **6.40** | **6.16** | PASS | `.app-pill.down`, **`.opp-conflict`** (since D-13) |
| `--ink2` on `--stop-w` | **6.16** | **7.02** | PASS | **`.chip.block`** (since D-15) |
| `--ok` on `--ok-w` | **3.06** | **6.93** | **FAIL light as text** — PASS as the non-text dot (3:1) | `.chip.ok .d` only |
| `--warn` on `--warn-w` | **3.63** | **6.25** | **FAIL light as text** — PASS as a non-text ring (3:1) | `.opp-conflict` 1px inset ring |
| `--stop` on `--stop-w` | **4.14** | **5.05** | **FAIL light as text** — PASS as the non-text dot (3:1) | `.chip.block .d` only |

#### White text on a colour fill

**This whole category is now nearly empty, and that is the point.** A saturated status colour is a *fill*, and the palette has no light-on-dark ink that survives the way `--ok`/`--warn`/`--stop` invert between schemes. Two of the three rows below are historical.

| Pairing | Light | Dark | Verdict | Used by |
|---|---|---|---|---|
| `#fff` on `--stop` | **5.02** | 3.06 | PASS light / FAIL dark → **light only** | `.nav-badge`, `.load-err` **in light only**; dark is overridden (next row) |
| `--bg` on `--stop` | 4.43 | **5.99** | FAIL light / PASS dark → **dark only** | `.nav-badge`, `.load-err` **in dark only** (D-12 fix) |
| `#fff` on `--warn` | **4.23** | **2.17** | **FAIL both** | **no longer used** (was `.opp-conflict`; D-13 moved it to the tint) |
| `#fff` on `--ok` | **3.49** | **2.00** | **FAIL both — worst pairing in the system** | **no longer used** (was `.act.accept`; D-11 moved it to the tint) |
| `--ink` on `--ok` | 4.70 | 1.70 | PASS light by 0.20 / FAIL dark | **rejected** for D-11 — recorded because the 4.70 was the deciding measurement |
| `--bg` on `--ok` | 3.08 | 9.18 | FAIL light / PASS dark | **rejected** for D-11 — see §2c note |

#### Non-text (3:1 floor where the boundary or state carries meaning)

| Pairing | Light | Dark | Verdict | Note |
|---|---|---|---|---|
| `--park` rail on `--panel` | **4.74** | **3.42** | PASS | neutral status `border-left` |
| `--stop` rail on `--panel` | **5.02** | **5.30** | PASS | |
| `--accent` rail on `--panel` | **4.95** | **7.57** | PASS | |
| `--warn` rail on `--panel` | **4.23** | **7.47** | PASS | |
| `--ok` rail on `--panel` | **3.49** | **8.11** | PASS | thinnest of the five in light. Also the `.act.accept` border, which is what now carries that button's weight after D-11 demoted its fill. |
| `--warn` rail on `--panel` (`.item.amber`) | **4.23** | **7.47** | PASS | This is where D-16's amber went. The decision state is signalled by the rail, not by the eyebrow's ink. |
| `--ok` dot on `--ok-w` | **3.06** | **6.93** | PASS | `.chip.ok .d` — thin in light but over the 3:1 non-text floor |
| `--stop` dot on `--stop-w` | **4.14** | **5.05** | PASS | `.chip.block .d` |
| `--warn` ring on `--warn-w` | **3.63** | **6.25** | PASS | `.opp-conflict` 1px inset ring — keeps the amber signal after the fill was demoted |
| `--hair` border on `--panel` | **1.24** | **1.32** | below 3:1 | Advisory, not a violation: every bordered control also carries a text label, so the border is not required to identify it. It **is** required if it ever becomes the only cue. |
| `--panel` vs `--bg` (elevation) | **1.13** | **1.13** | below 3:1 | Advisory. The card/canvas step is deliberately whisper-quiet and identical in both schemes. Nothing may depend on that step alone. |

**All five status rails clear 3:1 in both schemes** — the colour-coding system itself is sound. The failures below are all *text* failures, not signal-system failures. And no state in the cockpit is signalled by colour alone: every rail is accompanied by a word. Keep it that way.

### 2b-bis. Opacity-composited pairings — the figures a token table cannot show

**A token audit measures declared colours. A user sees composited ones.** Every table above assumes `opacity:1`. Where CSS `opacity` is applied, the browser renders that element's whole subtree into a layer and composites it over the backdrop, which moves the *text and its background together* toward the surface behind them. **The declared pairing can pass while the rendered pairing fails**, and no amount of staring at token hexes reveals it.

Two rules in the cockpit do this: `.i-eyebrow { opacity:.85 }` (`styles.css:139`) and `.item.deferred { opacity:.7 }` (`styles.css:137`). They **nest** — an eyebrow inside a deferred item renders at an effective 0.595.

Model: `seen_text = α·declared + (1−α)·backdrop`, and where the element's own card is also inside the faded layer, `seen_bg = α·card + (1−α)·backdrop`. Compositing happens on gamma-encoded sRGB values, then the §2d luminance formula applies to the result.

| Rule | Declared pairing | α | Light | Dark | Verdict |
|---|---|---|---|---|---|
| `.i-eyebrow.decision` (post-D-16) | `--ink2` on `--panel` | .85 | **5.08** | **5.71** | PASS both — the D-16 fix survives compositing |
| `.i-eyebrow.suggestion` | `--accent-ink` on `--panel` | .85 | **5.38** | **7.39** | PASS both |
| `.i-eyebrow.blocked` | `--stop` on `--panel` | .85 | **3.91** | **4.17** | **FAIL both — D-17.** Declared 5.02 / 5.30 passes; composited it does not. |
| `.item.deferred .i-title` | `--ink` on `--panel` | .7 | **6.25** | **7.40** | PASS both |
| `.item.deferred .i-why` / `.fresh` (post-D-5/D-7) | `--ink2` on `--panel` | .7 | **3.63** | **4.30** | **FAIL both — D-18.** The `--ink3`→`--ink2` lift raised this from 2.41 / 2.49 but did **not** clear the floor. |
| `.item.deferred .i-eyebrow.blocked` | `--stop` on `--panel` | .85 × .7 = .595 | **2.55** | **2.66** | **FAIL both — D-18 compounded.** The worst rendered text pairing in the cockpit. |

**Rule this establishes: `opacity` is a contrast operation, not a styling flourish.** Any rule that fades text must be measured composited. "Muted" is already a token decision (`--ink2`); reaching for `opacity` *on top of* a muted token double-mutes it and is how a passing token becomes a failing pixel.

### 2c. Defect register — sixteen closed, two newly opened

**Status: D-1…D-16 are CLOSED in `services/cockpit/public/styles.css`. D-17 and D-18 are newly OPEN.** The register no longer describes shipping defects for D-1…D-16; it records what they were, what closed them, and the measured evidence. Every figure below comes from `services/cockpit/contrast-check.mjs` and was independently confirmed in a real browser by `services/cockpit/a11y-probe.mjs` (see §2d). **Line numbers are keyed to the post-fix file** — the previous edition's numbers referred to a pre-merge file and were stale.

Severity per [[SOP-007-audit-content-for-design-system-compliance]] §Step 4, weighted by whether the text is on a primary reading path.

#### Closed: D-1…D-10 — `--ink3` used as text

All ten were the same root cause and took the same fix: **the declared colour changed from `--ink3` to `--ink2`.** No new token, no per-scheme rule, no scoped exception.

| ID | Rule (post-fix `styles.css`) | Was | Now | Sev | Note |
|---|---|---|---|---|---|
| **D-1** | `.t-desc` (L49) | `--ink3` on `--panel` 3.80 / 3.72 | **7.47 / 7.37** | HIGH | Pre-existing. Tile description — the L1 glance line. Found by Vera. |
| **D-2** | `.empty` / `.empty.big` (L111) | `--ink3` on `--bg` 3.36 / 4.21 | **6.59 / 8.34** | HIGH | Pre-existing. The empty state *is* the whole content when a lane is empty. Found by Vera. The scoped `.app-view .empty` mitigation has been **deleted** — it is a no-op now the shared rule is correct. |
| **D-3** | `.lane-sub` (L110) | `--ink3` on `--bg` 3.36 / 4.21 | **6.59 / 8.34** | HIGH | Found by Vera. The scoped `.apps-pane .lane-sub, .apps-pane .t-desc` mitigation has likewise been **deleted**. |
| **D-4** | `.nav-btn` (L35) | `--ink3` on `--panel` 3.80 / 3.72 | **7.47 / 7.37** | HIGH | Every inactive bottom-nav / rail label (10.5px phone, 14px desktop). Primary navigation. |
| **D-5** | `.i-why` (L147) | `--ink3` on `--panel` 3.80 / 3.72 | **7.47 / 7.37** | HIGH | The L2 reason line. **Caveat: inside `.item.deferred` this lands at 3.63 / 4.30 — see D-18.** |
| **D-6** | `.opp-atom` (L118) | `--ink3` on `--panel` 3.80 / 3.72 | **7.47 / 7.37** | MEDIUM | Evidence atoms under an Opportunity. |
| **D-7** | `.fresh` (L150) | `--ink3` on `--panel` 3.80 / 3.72 | **7.47 / 7.37** | MEDIUM | Freshness timestamp. **Same D-18 caveat as D-5.** |
| **D-8** | `.d-eyebrow` (L188) | `--ink3` on `--panel` 3.80 / 3.72 | **7.47 / 7.37** | MEDIUM | Detail-sheet category eyebrow, 10px uppercase. |
| **D-9** | `.tech summary` (L196) | `--ink3` on `--panel2` 3.60 / 3.42 | **7.08 / 6.78** | MEDIUM | The L4 technical drawer's own label. |
| **D-10** | `.mono` (L197) | `--ink3` on `--panel2` / `--panel` 3.60 / 3.80 · 3.42 / 3.72 | **7.08 / 6.78** on `--panel2`, **7.47 / 7.37** on `--panel` | MEDIUM | Technical detail body text. |

#### Closed: D-11…D-16 — status colours used as text or as fills behind white

These did **not** share one fix. Three moved to a tint, one needed a per-scheme override, two changed ink only.

| ID | Rule (post-fix `styles.css`) | Was | Now | Sev | How it closed |
|---|---|---|---|---|---|
| **D-11** | `.act.accept` (L166) | `#fff` on `--ok` **3.49 / 2.00** | `--ink` on `--ok-w` **14.39 / 11.77** | **HIGH** | **The worst pairing in the system.** Both routes were measured. Keeping the solid fill needs per-scheme ink and yields **4.70 in light** (`--ink` on `--ok`) — over 4.5 by 0.20, and 1.70 in dark, so it also needs a dark override to exist at all. That margin was judged not worth having: any future nudge to `--ok` silently re-opens it. **Trade, recorded plainly: Accept is no longer a solid green button.** Weight is carried by the `--ok` border (3.49 / 8.11, non-text) and `font-weight:650`. **Iris owns whether that demotion is acceptable**; an `--ok-ink` token is the alternative and is parked for her. |
| **D-12** | `.nav-badge` (L38), `.load-err` (L112) | `#fff` on `--stop` 5.02 ✔ / **3.06** | light `#fff` **5.02**, dark `--bg` on `--stop` **5.99** | HIGH | The one genuine per-scheme fix: the declaration passes in light and fails in dark, so no single value works. A new `@media (prefers-color-scheme: dark)` block at **L228, deliberately the last thing in the file**. See the specificity note below. |
| **D-13** | `.opp-conflict` (L128) | `#fff` on `--warn` **4.23 / 2.17** | `--ink2` on `--warn-w` **6.40 / 6.16** | MEDIUM | Failed *both* schemes, and **no fill-keeping option clears light** (`--ink` on `--warn` 3.88, `--bg` on `--warn` 3.73). The fill was demoted to the tint; a 1px `--warn` inset ring (3.63 / 6.25, non-text) keeps the amber signal. The off-token `#e08a1e` fallback was dropped — as a fallback for a *tint* it would paint saturated amber behind `--ink2`. |
| **D-14** | `.done-pill` (L169), `.chip.ok` (L180) | `--ok` on `--ok-w` **3.06** / 6.93 ✔ | `--ink2` on `--ok-w` **6.55 / 6.30** | MEDIUM | Text only. `.chip.ok .d` keeps `--ok` — a dot is non-text and clears 3:1. |
| **D-15** | `.chip.block` (L180) | `--stop` on `--stop-w` **4.14** / 5.05 ✔ | `--ink2` on `--stop-w` **6.16 / 7.02** | MEDIUM | As D-14. `.chip.block .d` keeps `--stop`. |
| **D-16** | `.i-eyebrow.decision` (L145) | `--warn` on `--panel` **4.23** / 7.47 ✔ | `--ink2` on `--panel` **7.47 / 7.37** (5.08 / 5.71 composited at `opacity:.85`) | MEDIUM | **Closed without an amber ink token**, because the amber was never load-bearing on the word: a decision item renders `.item.amber`, whose 4px `--warn` rail measures **4.23 / 7.47** against `--panel`, comfortably over the 3:1 non-text floor that governs a state indicator. The state colour moved from the word to the rail — where it was already doing the signalling — and the word "DECISION" still carries the meaning. |

**Why the D-12 block sits at the bottom of the file, and why moving it is a silent regression.** A media query contributes **nothing** to specificity. `.nav-badge` (L38) and `.load-err` (L112) are single-class selectors setting `color:#fff`, and the pre-existing dark block is at **L12 — above both**. An override placed there would tie on specificity and lose on source order: the CSS would read correctly and render wrong. This was **not** inferred from source order; it was verified by measuring `getComputedStyle` in headless dark mode (`.nav-badge` resolves to `#0f151d` on `#ee6a5f`).

**Legitimate `--ink3` uses (do not "fix" these):** `.chev` (L150) and `.crumb-sep` (L66) — retained deliberately. Both are `›` glyphs whose meaning is fully carried by adjacent text and by the control they sit on. They are ornament. They are what the token is *for*. At 3.80 / 3.72 and 3.36 / 4.21 they clear the 3:1 non-text floor that actually governs them.

**`.app-blurb` (L54) was NOT touched.** It was listed for deletion as a redundant scoped override; it is not one. No other rule sets `.app-blurb`'s colour, so removing `color:var(--ink2)` would drop it to inherited `--ink` — a visual change, not a no-op. Its 6.59 / 8.34 already passes.

#### Open: D-17, D-18 — opacity compositing

**These are new. They are not fixed, and they were not visible to a token-level audit** — both are cases where the *declared* pairing passes or nearly passes and the *rendered* pairing does not. Evidence and the compositing model are in §2b-bis.

| ID | Rule (`styles.css`) | Declared | Composited Light | Composited Dark | Sev | Note |
|---|---|---|---|---|---|---|
| **D-17** | `.i-eyebrow` `opacity:.85` (L139) applied to `.i-eyebrow.blocked` (L145) | `--stop` on `--panel` — 5.02 / 5.30, **passes** | **3.91** | **4.17** | MEDIUM | The `opacity:.85` on `.i-eyebrow` pushes an otherwise-compliant pairing under the floor. `.decision` (post-D-16) and `.suggestion` both survive compositing; only `.blocked` fails. Cheapest honest fix is dropping `opacity` from `.i-eyebrow` — but that is a visual-weight decision, so it is **Iris's call, not a passing change**. |
| **D-18** | `.item.deferred` `opacity:.7` (L137) | `--ink2` on `--panel` — 7.47 / 7.37, **passes** | **3.63** (`.i-why`, `.fresh`) · **2.55** (`.i-eyebrow.blocked`, α=.595) | **4.30** · **2.66** | MEDIUM | `opacity:.7` on the whole card fades text *and* card together. The D-5/D-7 lift improved this from 2.41 / 2.49 to 3.63 / 4.30 but **did not clear the floor** — so D-5 and D-7 are closed for normal items and **remain open for deferred ones**. `.i-title` (`--ink`) survives at 6.25 / 7.40. Deferring is a *state*, and fading is how it is signalled; making it accessible without losing that signal is a design decision for Iris. |

**Count: 16 closed, 2 open.** The sixteen closed cleanly with no new colour token. The two open ones are a *different class of defect* — not "wrong token chosen" but "correct token, then faded" — which is why the original audit could not see them: it read declarations, and `opacity` does not appear in a declaration's colour.

**The lesson worth keeping:** the first audit found the token misuse; only measuring the *rendered* result found the compositing. A design-system audit that stops at declared token pairings is incomplete by construction.

**Off-token colour values in the live CSS** (drift, LOW severity, recorded for completeness):

| Value | Location | Note |
|---|---|---|
| `#c0392b` | `.load-err` fallback `var(--stop,#c0392b)` | Not in the palette. Unreachable while `--stop` is defined, but it is an off-token hex in the file. |
| ~~`#e08a1e`~~ | ~~`.opp-conflict` fallback~~ | **Resolved by D-13.** Dropped: as a fallback for a *tint* background it would have rendered a saturated amber behind `--ink2`, so keeping it would have been a bug rather than a safety net. |
| `rgba(6,10,16,.5)` | `.sheet` scrim | Untokenised. A `--scrim` token would be the honest home. |
| `#0e1620` | `icon.svg` background | Close to but not equal to `--bg` dark `#0f151d`. |
| `#fff` | two rules (`.nav-badge`, `.load-err`, light only) | Literal white as a fill-text colour. Down from five: D-11 and D-13 removed two, and D-12 confined the remaining pair to light mode. Still untokenised. |

### 2d. How these figures were produced

Reproducible by hand or by script. WCAG 2.x:

1. Per channel, `s = v / 255`; `lin = s / 12.92` if `s ≤ 0.04045`, else `lin = ((s + 0.055) / 1.055) ^ 2.4`.
2. `L = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin`.
3. `contrast = (L_lighter + 0.05) / (L_darker + 0.05)`.

For opacity (§2b-bis), composite first, on the **gamma-encoded** sRGB values, then apply the above: `seen = α·fg + (1−α)·backdrop`. Nested `opacity` multiplies.

**Two executable sources, and they must agree.**

| Tool | What it does | Why both exist |
|---|---|---|
| `services/cockpit/contrast-check.mjs` | Parses the token hexes **out of `styles.css`** and computes every pairing in §2b/§2b-bis. | The arithmetic. Cannot drift from the CSS because it reads the CSS. |
| `services/cockpit/a11y-probe.mjs` (+ `a11y-probe.html`) | Serves `styles.css` on its own port, loads it in headless Edge under **both** `preferredColorScheme` settings, and reports what `getComputedStyle` actually resolved. | The **cascade**. Arithmetic cannot tell you whether a rule *wins*. D-12's override is a specificity trap that only a rendered measurement can settle. |

The two agree to ±0.04 on every composited figure — the residual is the browser compositing on 8-bit integers where the script uses floats.

**Self-validation is a hard precondition, not a courtesy.** `contrast-check.mjs` refuses to print anything unless it first reproduces **eight** pinned figures exactly: `.t-desc` 3.80/3.72, `.empty` 3.36/4.21, `.lane-sub` 3.36/4.21, and the two ratios asserted in the CSS comments at `styles.css:55-57` (`--ok` on `--ok-w` "3.1" → 3.06; `--warn` on `--warn-w` "3.6" → 3.63). If a pinned figure ever disagrees, the script exits non-zero and **no figure it produces may be quoted**. Those five independently-established figures are the anchor that keeps a plausible-looking wrong model out of this document.

**Run the probe on your own port.** `render-check.mjs` defaults to `127.0.0.1:8090`, which is the **live cockpit**. `a11y-probe.mjs` defaults to 8097 and serves from `services/cockpit/` (not `public/`), so the probe page never reaches the cockpit's web root.

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
