---
build: BUILD-015
scope: WP-B15-23 (AsdAIr cockpit app restoration — human-readable read/interpret/resolved view)
gate: visual/UX QA (Vera)
reviewed_sha: 08ec03c55a8cb0ec1f9498edd649606efe0c9ac3
branch_at_review: build-015/b15-23-asdair-app-restoration
merged_at: eb7c7ad0d6a243eec2719bf6b188cab5e776a32f
reviewed_by: vera
reviewed_date: 2026-08-11
verdict: PASS (initial pass: CONDITIONAL PASS with one HIGH finding; re-inspection after fix: PASS)
---

# Vera QA receipt — AsdAIr cockpit app restoration

**Written by Larry, banking Vera's two review returns durably — this file did not previously exist
in the repository, which Veritas's Gate 1 review correctly flagged as a documentation gap
(non-blocking, out of Gate 1's numbered scope, recorded for closure here).**

## Pass 1 — commit `9967f594` — CONDITIONAL PASS

Independently rendered the changed page (real `assembleWorkspace()` output, not the checked-in
fixture, served through a throwaway stub and headless Microsoft Edge via CDP, at 375/768/1280px),
independently re-ran all six automated controls Felix reported (`node --test` cockpit-api 152/152,
`render-vm-check.mjs` 65/65, its `--self-test` 7/7, `contrast-check.mjs`, `template-check.mjs`,
`nav-check.mjs` — all reproduced exactly), and confirmed `styles.css` byte-identical to `main`
(D-17/D-18 pre-existing opacity-compositing defects genuinely untouched, no new opacity usage).

**One HIGH finding:** the new "Resolved" section's `.i-eyebrow` line rendered a raw ISO-8601
timestamp (`answered_at_display`, via `present.js`'s `when()` → `toISOString()`) as primary content —
directly undercutting the acceptance bar this feature exists to meet ("no raw IDs or engineering
state as primary content"). Root cause pre-existing in `present.js`, first newly exposed by this
diff's Resolved section.

**One LOW finding (pre-existing, not introduced by this diff):** raw `list_item_id` shown as
"· line item N" in both old and new eyebrow text — inherited from `main` unchanged, reported for a
separate decision, not blocking.

## Pass 2 — commit `08ec03c` — PASS (re-inspection)

Verified the HIGH finding's fix independently, not trusted from the report: a scoped `humanWhen()`
formatter added to `assembleWorkspace.js`, applied only to `answered_at_display` and
`interpreted_at_display` in the new code paths; `present.js`'s global `when()` and every other call
site left untouched (correct — a global retrofit was explicitly out of scope for this fix). Recomputed
a fresh payload from the real function, rendered live: `"11 Aug, 11:08"`, never a raw ISO instant.
All six automated controls re-run fresh and reproduced exactly (`node --test` 153/153,
`render-vm-check.mjs` 66/66, self-test 7/7, contrast/template/nav all PASS). `styles.css` remained
byte-identical across `main` → `9967f59` → `08ec03c`. D-17/D-18 and the LOW finding above both
confirmed still present, unchanged, correctly left alone.

**One new MEDIUM, non-blocking observation surfaced during re-inspection:** the pre-existing
"What happened" / Timeline section on the same Details page shows the identical raw-ISO-timestamp
defect class (same root cause, `present.js`'s `when()`), currently masked by the checked-in
`workspace.sample.json` fixture hand-authoring a friendly string the real function doesn't produce —
the same masking pattern that hid the original HIGH finding. Not a regression from this diff, not
this Work Order's scope. **Parked for a future decision**: either extend `humanWhen()` to the
Timeline call site as a fast-follow, or narrow `render-vm-check.mjs`'s new guard comment so it
doesn't overclaim coverage it doesn't have.

## Verdict

**PASS** as of `08ec03c`. Ready to ship from the quality-gate side. Two items parked, non-blocking,
for a later decision: the LOW raw-line-item-id finding, and the MEDIUM Timeline-timestamp finding.
