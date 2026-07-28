---
agent_id: iris
session_id: iris-gl003-first-population
timestamp: 2026-07-29T00:30:00Z
type: end-of-session
linked_sops: ["SOP-006-author-a-design-system", "SOP-007-audit-content-for-design-system-compliance"]
linked_workstreams: []
linked_guidelines: ["GL-003-design-system"]
---

# GL-003 populated for the first time — from the live cockpit CSS, with 16 measured sub-AA defects recorded

## Coverage window

_(close-session entries only — not applicable. This is an `end-of-session` entry for a single dispatched task.)_

## Context

[[GL-003-design-system]] had shipped as a template and had **never been populated** — every value in all six sections was still a literal `<placeholder>`. The de-facto design system was the `:root` block in `services/cockpit/public/styles.css` (lines 5–15).

Vera gated a cockpit change and found three sub-AA text pairings, all `--ink3` used as body text on a light surface. Her root-cause finding, which Larry accepted and commissioned me on: **nothing anywhere recorded that `--ink3` is not a body-text colour.** A populated GL-003 with an intent per token would have caught all three at authoring time rather than at the gate.

The brief was explicit and correct: **document the system that exists, do not design a new one.** Warwick's palette was live in front of him; my job was to make the implicit explicit.

## What we did

- **Iris** read the live `:root` and every rule consuming a token, then computed WCAG contrast for **every colour pairing that actually occurs in the CSS** — both light and dark — and populated `Team Knowledge/Guidelines/GL-003-design-system.md`.
- Populated **§2 Color palette** in full: 16 tokens × two schemes, each with a *what it is FOR* and a *what it must NEVER be*. Added three subsections inside §2 rather than new top-level sections, so the six-section schema survives: **§2b** measured-pairings lookup, **§2c** open-defect register, **§2d** reproducible measurement method.
- Populated **§1 Identity** (partial), **§3 Typography** (partial), **§5 Imagery** (partial). Left **§4 Spacing** and **§6 Voice** `<unset>` with written reasons.
- Added a **§Status and authority** block at the top with a per-section fill table, because a partial GL-003 is more dangerous than an empty one.
- **Iris** flagged the contract conflict (my rule 5 requires this log; Larry's order scoped me to GL-003 alone) rather than silently breaching either. **Larry** resolved it in my favour and asked for this entry.

## Decisions made

- **Question:** Is GL-003 now the SSOT for the cockpit's visual system?
  **Decision:** **No — not yet, and the file says so.** Today GL-003 is *descriptive of record*; `styles.css` `:root` still holds authority. Asserting SSOT status while the CSS can change underneath would recreate the same silent-drift failure in a new file. The intended direction (GL-003 → CSS) is written down, along with the consequence: **every figure in §2 is stale the moment `:root` changes.** Larry asked for this framing kept exactly as written.

- **Question:** How should `--ink3` be remediated?
  **Decision (a recommendation, not a change — remediation is Warwick's call):** **Do not recolour `--ink3`. Reassign the role to `--ink2`.** `--ink2` already *is* the muted-but-readable token (7.47:1 light / 7.37:1 dark on `--panel`, worst case 6.16:1 anywhere). All ten defective rules move with **zero new colour and zero new token**. Recolouring `--ink3` would need ~4 steps of darkening and would change every decorative use to buy a fix the palette already contains. Honest cost, put to Warwick: light-surface text collapses from three weights to two (the step between `--ink` and `--ink2` is still 2.2×, so hierarchy survives, but it is a visible flattening).

- **Question:** Where does the "what must this never be" rule live when a violation surfaces?
  **Decision:** In the token's intent line in GL-003, **not** as a per-component patch. `--ink3`-as-body-text is now the canonical worked example of that principle.

- **Question:** Populate §1 voice/tone, §6 voice samples, §4 spacing from what's observable?
  **Decision:** **No.** Reverse-engineering voice adjectives from UI strings, or a base unit from literals that aren't on a grid, would read as canonical while being my invention. `<unset>` with a written reason is the honest answer. This is critical rule 1 doing its job.

## Insights

- **A gate sees its change; only a token-level audit sees the blast radius.** Vera correctly found three `--ink3` violations because three were in front of her. At token level there are **ten** informative-text uses of `--ink3` in the live CSS (eleven counting the in-flight `.crumb-sep`). No single gate could have seen that. This is the strongest argument for GL-003 existing at all, and it generalises beyond colour.

- **The commissioned finding was not the most serious one.** Measuring the whole palette surfaced six further defects nobody had flagged. The worst is **`.act.accept` — white on `--ok` at 2.00:1 in dark mode** (3.49:1 light): the *primary confirm button*, the worst pairing in the system. Larry's verdict: "a better find than the thing I commissioned you for." **Lesson: when commissioned to document one token, measure them all — the marginal cost was near zero and it changed the priority order.**

- **Light-mode-only checking is structurally blind, and the reason is counter-intuitive.** In light mode `--panel` (#fff) is the *forgiving* surface and `--bg` the harsh one. In dark mode this **reverses**, because dark `--panel` (#18212e) is *lighter* than dark `--bg` (#0f151d). `--ink3` on `--bg` is 3.36 light but **4.21 dark** — the same pairing, better in dark. `.nav-badge` passes at 5.02 in light and **fails at 3.06 in dark**. This reversal is exactly how a wrong dark-mode figure for `.empty` got into circulation. **Never infer one scheme's figure from the other.** Written into §2b as a standing warning.

- **Precise numbers are the point, and precision needs verification.** I had no shell, so every figure was computed by hand. I mitigated by validating my luminance model against **five independent data points before publishing anything else**: Vera's three measured figures (reproduced to two decimals) and the two ratios already asserted in the CSS comments at `styles.css:55-57`. Five agreements, zero disagreements. **That is strong but it is not an executed script**, and I said so. Larry accepted the caveat and ruled that nothing drives a remediation PR until §2d is re-derived by a computed check. *(This is the house lesson — "state what was PROVEN, not what it implies" — applied to my own output.)*

- **The product had already reached for the right fix twice, locally.** The in-flight worktree scopes `.app-view .empty` to `--ink2` and holds `.app-pill` text at `--ink2`, and its own comment says the shared `.empty` "is Iris's call". Good instincts hitting a missing system. **A recurring local workaround is a missing token announcing itself** — the right response is to promote it, not to keep patching.

- **Reasoning already existed in the codebase as comments; it just wasn't findable.** `styles.css:55-57` correctly reasons about `--ok`/`--warn` on their tints. A comment on line 55 cannot govern a decision made on line 98. Promoting it into §2a is most of what "authoring a design system" actually meant here.

## Realignments

- **Larry, on my flagged contract conflict:** _"You were right to flag rather than breach either instruction. My order scoped you to GL-003 and forbade report files; your rule 5 requires a session-log entry for any GL-003 edit. Your rule wins — it exists so a design-system change is never invisible. Write it at the path you named. **My scoping was the defect, not your contract.**"_
  → **Standing behaviour:** a Work Order that collides with a specialist contract gets flagged, not silently resolved in either direction. Neither breaching the contract nor ignoring the order is acceptable; naming the collision is.

- **Larry, on the measurement caveat:** _"Nothing will drive a remediation PR until those numbers are re-derived by a computed check."_ Accepted and recorded as a gate on remediation.

## Open threads

- [ ] **Warwick decision — `--ink3` remediation authorised?** And at what scope: the ten `--ink3` rules only (D-1…D-10), or all sixteen defects (adds D-11…D-16, the status-colour-as-text and white-on-fill failures)?
- [ ] **Warwick decision — brand name.** The cockpit surface is unambiguously `Fusion247` (no space) across `manifest.webmanifest`, `<title>`, `apple-mobile-web-app-title` and the `F247` wordmark. The spaced variant `Fusion 247` appears elsewhere in the estate. One decision, then locked in §1. Flagged in-file as unresolved.
- [ ] **Before any remediation PR:** re-derive every §2 figure with a computed check per §2d (~10 lines). Larry's gate.
- [ ] **16 defects remain open and shipping.** §2c is a live register, not history. No CSS was changed by this work.
- [ ] **If the worktree's `:focus-visible` work ships**, name a `--focus` token in §2a rather than leaving raw `var(--accent)` in three selectors. The **live** CSS has no focus styling at all — browser default only.
- [ ] **§4 and §6 remain `<unset>`.** They need a guided session with Warwick per [[SOP-006-author-a-design-system]] §Step 5 and §Step 7. Not urgent; genuinely blocking only if a creative deliverable needs a spacing grammar or a written voice.

## Next steps

- Warwick answers the two decisions above; Larry routes remediation to **Felix** if authorised (Iris documents and audits; Iris does not edit CSS).
- **Vera** can now gate directly against §2b as a lookup rather than measuring ad hoc; her three findings are D-1, D-2, D-3.
- **Charta and Pixel:** nothing to re-render — neither has produced a cockpit-adjacent deliverable against the old empty GL-003. Both now read §Status first; any deliverable touching spacing or voice carries a flagged-fallback note.
- If remediation lands, **Iris re-measures and updates §2b/§2c** in the same change. A defect register that outlives its defects is worse than none.

## VlogOps / story signals

_(end-of-session entry — recorded lightly.)_ There is a genuine arc here: a QA gate finds three contrast failures, the root cause turns out to be a document that was never written, and writing that document surfaces a *worse* defect on the primary confirm button that no gate had looked at — 2.00:1, white on green, in dark mode. The memorable line is Larry's: *"a better find than the thing I commissioned you for."* Good demonstration material — the before/after is visually obvious, and the light-vs-dark reversal is a genuinely counter-intuitive thing to show on screen.

## Cross-links

- `[[GL-003-design-system]]` — the artefact populated by this session.
- `[[SOP-006-author-a-design-system]]` — the authoring procedure followed (§Step 10 is why this entry exists).
- `[[SOP-007-audit-content-for-design-system-compliance]]` — the companion audit skill; §2c is the register a future audit works from.
- `[[2026-07-28-20-11_larry_build-015-asdair-stage1-merged]]` — closest prior session log.
