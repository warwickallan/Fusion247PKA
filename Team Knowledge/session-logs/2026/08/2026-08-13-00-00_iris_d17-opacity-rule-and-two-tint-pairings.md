---
agent_id: iris
session_id: wp-b15-42-design-system-decision
timestamp: 2026-08-13T00:00:00Z
type: end-of-session
linked_sops: ["SOP-006-author-a-design-system", "SOP-007-audit-content-for-design-system-compliance"]
linked_workstreams: []
linked_guidelines: ["GL-003-design-system"]
---

# GL-003: the opacity rule (D-17 decided) and four tint pairings recorded

Two items, both landed on me from Vera's WP-B15-42 Cockpit gate (CONDITIONAL PASS). Both are mine rather than the implementer's, and Larry drew that boundary correctly.

## What changed in GL-003

**§2b-bis — new normative rule, and it is the substantive output of this session:**

> `opacity` on text expresses **state**. It never expresses **hierarchy**.

With the test that makes it operable: remove the declaration and ask what information is lost. "Nothing, it just looks heavier" → it was hierarchy, and it does not belong. "The user can no longer tell this item is deferred" → it is state, it stays, and it gets measured composited.

**§2c — D-17 DECIDED:** remove `opacity:.85` from `.i-eyebrow` (`styles.css:328`). Priority raised MEDIUM → HIGH because the consolidation of three exception areas into one Exceptions board moved the affected label — "HELD OUT OF THE BASKET" — onto the operator's primary surface. Not a regression: the new markup reuses a class that already carried the defect. Implementation is Felix's; **D-17 is decided, not closed.**

**§2a / §2b — four shipping tint pairings recorded** (documentation gap, not drift; no token added, no value changed): `--ink` on `--warn-w` 14.06 / 11.51 · `--ink` on `--stop-w` 13.52 / 13.11 · and, found while filling the *Used by* column, `--accent-ink` on `--warn-w` 6.60 / 8.09 and on `--stop-w` 6.35 / 9.21. All four PASS.

## Why the decision went this way

The fade was the sixth muting mechanism on an element that already had five (9.5px, mono, uppercase, tracking, weight-in-small-size, plus a muted token on one variant). It charged an **unequal, invisible** contrast tax across all three eyebrow variants — 7.47→5.08, 7.70→5.38, 5.02→**3.91** — and only the variant with no headroom showed up as a defect. Two survived by luck. That is not something anyone can design against, which is why the answer had to be a rule about the mechanism and not a patch at the one site that happened to fail.

Rejected, and recorded in the file so they are not re-proposed: a `--stop-ink` token (would add a fourth ink to a palette already carrying two *unfilled* ink gaps, and would fix only the failing variant), and a scoped `.i-eyebrow.blocked { opacity:1 }` (the per-site special case the Guideline exists to prevent).

## The thing I want the next agent to know

**I re-derived every figure by hand from the token hexes rather than trusting the ones I was handed — and I calibrated the arithmetic against GL-003's own pinned anchors *first*** (`--ink` on `--panel` → 16.404 / 13.759; `--accent-ink` on `--panel` → 7.699; the composited `.item.deferred .i-title` → 6.2543). Only after my model reproduced four independently-pinned figures did I trust it to produce new ones. That is the same discipline `contrast-check.mjs` enforces on itself with its eight pinned figures, and it is the reason a plausible-looking wrong model has not entered this document. The reported numbers turned out to be correct — that is the outcome, not the method.

**D-18 must not be closed the way D-17 was.** The new rule protects it: `.item.deferred`'s fade *is* the state signal, so deleting `opacity:.7` would remove information. Implementing D-17 lifts D-18's worst row from 2.55 / 2.66 to 3.06 / 3.21 — a mitigation, not a closure. It stays open and it stays mine.

## Evidence the exclusion list works

Vera's probe flagged `.crumb-sep` (3.36) and `.chev` (3.80) as failures; §2c's "Legitimate `--ink3` uses" list overruled both, correctly — they are ornament under the 3:1 floor. Two false positives stopped before becoming work. I have recorded that in the file, because the argument for keeping an exclusion list is exactly this kind of evidence, and it is normally invisible.

## Downstream

- **Felix:** one deletion in `services/cockpit/public/styles.css`, then re-measure both schemes with both §2d tools before D-17 is marked closed.
- **Charta / Pixel:** no re-render owed. Nothing they consume changed value — §2b gained rows, §2b-bis gained a rule. Any *future* deliverable that fades text now has a rule to read first.
- **Still open and still Iris's:** the `.act.accept` fill demotion (D-11), the `--ok-ink` / `--warn-ink` token gap, and D-18. This pass settled D-17 only and does not ratify Felix's 2026-07-29 amendment beyond it.
