---
agent_id: felix
session_id: WO-2026-08-13-07 · WP-B15-42
timestamp: 2026-08-13T09:30:00Z
type: end-of-session
linked_sops: [SOP-003-felix-build-a-component, SOP-022-work-order-preflight]
linked_workstreams: []
linked_guidelines: [GL-003-design-system]
---

# One exception board, one brand-sorted list, and the word that must never appear

BUILD-015 · WP-B15-42 · branch `build-015/b15-26-cockpit-ui`, worktree `C:/Fusion247PKA-cockpit-ui`.
Files touched: `services/cockpit/public/app.js`, `public/styles.css`, `public/apps.js`,
`services/cockpit/render-vm-check.mjs`. No backend file touched.

## The thing worth carrying forward

**A sort sentinel is not a value, and it will render as one.** The real reconciled artefact
(`final-shopping-list.json`, WP-B15-37) carries `brand: "ZZ (no brand recorded)"` on **every** held
line. That string exists so unbranded lines sort last. Print it and Warwick reads a brand called
*"ZZ (no brand recorded)"*. Its sibling: `product: null` on the same lines, because a held line has
no settled product — so `list_item_name` is the only honest title.

This is the **same defect class** as the API's word `unknown` reaching a product title, which Vera
caught on WP-B15-36. That one was fixed on the Shop screen and the identical leak was still
rendering on Rules two screens away **in the same commit**. Generalisation: **machinery that exists
to order or pad data is indistinguishable from data once it reaches a template.** Look for it at the
boundary, once, by name.

## What changed the shape of the work

**Three exception surfaces became one.** Shop's "Needs your attention", Questions' "Still waiting on
you", and Basket's "Held back" were three partial answers to one question, with three counts that
could drift apart. That *is* the incoherence Warwick describes when he says he should not have to ask
Larry. The board is now the Questions screen (relabelled **Exceptions**); Shop and the list screen
**route** to it and render no controls of their own. The deleted "Held back" block has a comment
where it stood saying why, because the next person will otherwise "restore" it.

**Held lines join their question by `routed_question` → `question_key`.** `readPacket.js` does not
publish that key yet (Lane C is adding it), so the board works **without** the join — an unjoined
held line becomes its own entry that says plainly no question was routed for it — and improves when
the key lands. Built to degrade, not to wait.

## The detector, and why it is not a sweep

Larry held me to this and he was right: **the "verified" ban is a harness assertion, not a one-time
sweep, because a sweep decays the moment someone adds a string.** `bannedVocabulary()` in
`render-vm-check.mjs` runs on **every** scenario and bans three things: `verified` where only
corroboration exists (Warwick's ruling — 2-of-3 is corroboration, and so is 3-of-3, because three
readings by one model of one photograph are correlated), the API word `unknown` as a value, and the
`ZZ` brand sentinel. Three mutations prove it fires; two controls prove it does not cry wolf.

**It caught my own shipping copy on its first run — seven scenarios.** The corroboration caveat is
the sentence that *denies* the claim ("…is corroboration, not verification…"), so it necessarily
contains the banned word. **The exemption is pinned to `ASDAIR_CORROBORATION_CAVEAT` read out of the
app itself, not to a copy of its text.** A copied string would rot the moment the wording improved,
the gate would go red on correct code, and the next person would relax the *pattern* rather than the
exemption. Reading the constant means the exemption follows the wording and covers exactly one
sentence.

## ⛔ Two guards that were silently doing nothing, found by making them fail

1. **`e instanceof SyntaxError` is FALSE for an error thrown by `node:vm`.** The script compiles
   inside a **context with its own intrinsics**, so the SyntaxError is not the host realm's. My new
   backtick guard therefore never ran. `e.name === 'SyntaxError'` is the realm-safe test. **I only
   found this because I mutated the source to make the guard fail rather than trusting it worked** —
   the same lesson as WP-B15-36's vacuous mutation block, arriving by a different route.
2. **`--window-size=375,812` produced a 492px viewport** (browser chrome plus a 144%-scaled host).
   The first probe run reported every banned word "absent" at a "375px" breakpoint **while rendering
   nothing at all** — a vacuous pass with a real-looking number beside it. The viewport is now pinned
   by an **iframe of exact width**, and `window.innerWidth` is printed on every run so the claim and
   the measurement cannot separate.

**Both are the same failure: a control that reports success without having done anything.** The tell
in each case was a value that should have been impossible — `has-corroborated = no` on a screen whose
whole job is corroboration, and a guard whose message never appeared.

## The backtick trap, twice in one WP

`app.js`'s Vue template is a **JS template literal**. One backtick anywhere inside it — including in
an HTML comment quoting a field name the way you would in a code comment — ends the string and the
whole file stops parsing. Node reports `SyntaxError: Unexpected identifier` pointing at a word in the
middle of a comment, which says nothing about the cause. It cost me two rounds. There is now a guard
that names the cause and lists the offending lines, and it is mutation-proved.

## Design decisions worth preserving

- **Brand grouping preserves the producer's order and does NOT re-sort.** Both producers declare
  Brand A–Z then product A–Z and `readPacket.js` *asserts* that contract. Grouping consecutive runs
  renders the brand-sorted list Warwick asked for when the producer honours it — and when it does
  not, the same brand appears twice and a loud banner fires. **A UI-side sort would silently repair
  the display and hide a producer defect that costs real time in ASDA.** Showing the breach is the
  honest half.
- **BLOCKING is deliberately a narrower number than NEEDS YOU.** A line held *out* of the basket
  blocks the shop; a question about a line still in it does not. Where nothing publishes held state,
  blocking is `null` and renders as `—` with a sentence, never as a zero nobody measured.
- **The durable-knowledge offer is shown even when it cannot be taken.** Warwick is owed the
  knowledge that the choice exists *and* the truth that it cannot yet be made, so with no command
  published the control is **disabled with the reason**, never hidden and never live-looking. An
  offer that quietly discarded the answer would corrupt trust in the whole surface.
- **A skip is never offered for remembering.** "Not this week" is a statement about *this* week;
  turning it into a standing rule inverts its meaning.
- **View keys `questions` and `basket` were NOT renamed** — only their labels ("Exceptions", "The
  list") and blurbs. Renaming a key in `apps.js` without sweeping its string consumers is exactly
  what destroyed every AsdAIr render assertion between `f7bf71a` and WP-B15-36.
- **The focus ring now follows the keyboard, and defaults to SHOWN.** If the modality listeners never
  attach, the ring appears. An over-visible ring harms nobody; a missing one strands a keyboard user.
  The failure mode is chosen toward the accessible outcome.

## Vera's three parked LOW findings — all three closed

1. **`aria-hidden="true"` dropped from both `.as-trap` sentinels.** A focusable element marked
   aria-hidden is the axe `aria-hidden-focus` contradiction. It bought nothing (the spans are empty)
   and cost a permanent scan finding.
2. **`asdairTrapFocus()` now routes through `focusWithRing()`**, the same mechanism `focusSel()`
   uses — one focus-indicator mechanism instead of two.
3. **Modality tracking added**, so mouse-driven `openApp()` no longer hands a mouse user a keyboard
   ring.

## Measured, in a real browser, at 375 / 768 / 1280 in both schemes

Focus ring resolves `--accent` in both schemes (`rgb(14,124,134)` light, `rgb(55,195,201)` dark).
`.as-line-sum` is 44px at every width. `opacity: 1` on every new component — GL-003 §2b-bis says
opacity is a contrast operation, and D-17/D-18 are open precisely because faded text stopped clearing
the floor. No horizontal overflow at any width. The tally's cascade-resolved pairing measured
`--ink2` on `--warn-w`, matching GL-003's table figure exactly.

## For Iris — a documentation gap, not a token gap

Two pairings this WP uses are **not in GL-003 §2b**: `--ink` on `--warn-w` (**14.06** light /
**11.51** dark) and `--ink` on `--stop-w` (**13.52** / **13.11**). Both PASS comfortably. **No token
was added and no token value changed**, so every existing figure in §2b still holds. These want
adding to the table — **Iris's edit, not mine.** The previous Felix amendment to GL-003 was recorded
as a rule violation and I am not repeating it.

## Reported, not fixed (outside my surface)

- `provenance-check.mjs` still FAILs 1/30 — `provenance.mjs`'s `SOURCE_MODULES` omits
  `asdair-checklist.mjs`, which `server.mjs` imports. Pre-existing, both files backend.
- `render-vm-check.mjs`'s header says the real payloads "are personal data that must never be
  committed". **That contradicts Warwick's thrice-repeated ruling that shopping data is not private.**
  Fixtures stay synthetic regardless (they are cleaner as fixtures), but the stated *reason* is wrong
  and should be corrected by whoever next owns that file.
