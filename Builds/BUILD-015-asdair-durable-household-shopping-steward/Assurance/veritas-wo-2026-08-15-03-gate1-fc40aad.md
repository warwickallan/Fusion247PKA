---
build: BUILD-015
scope: WO-2026-08-15-03 — Codex F-3, the render-gate mutation anchor
gate: 1

boundary: >
  WO-2026-08-15-03 and the outcome it promised — `render-vm-check.mjs --self-test` passes again, so the
  SECOND invocation (the real gate, which inspects Mum's shopping template and the Cockpit template
  against fixtures) runs in CI, and the further steps silently skipped behind it run too.

reviewed_sha: fc40aad5412849e4151a97dfc12f69da398c163e
governance_sha: 64e9656d115f2e0004423ba002ba71d9ca8e9d85
branch: build-015/f3-render-gate-anchor  (PR #108, unmerged; reachable at origin/build-015/f3-render-gate-anchor)

evidence_method: mixed — `git archive` export (all local execution and all mutation testing) + GitHub Actions runs at the exact head + read-only inspection of the target worktree's HEAD and status
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/0deb55dc-12c0-4c50-b8fb-8756fb3f0ecc/scratchpad/veritas-f3
worktree_head_at_start: 5696166c99a013eae50a5b66ce76e8a890bfe198
worktree_head_at_end: 5696166c99a013eae50a5b66ce76e8a890bfe198
worktree_status_clean: true

verdict: PASS
receipt_sha256: 781b7776e421a0c0e840ae47994fca1803bea9a86ba73d46ab653f98a1e22771
reviewed_by: veritas
reviewed_date: 2026-08-15
next_review_trigger: >
  A material change to what this control executes — the mutation set, the anchor mechanism, the
  templates it renders, or the CI step that invokes it. Merging this branch unchanged is not a
  trigger. A receipt, documentation or clerical commit is never a trigger.
---

## Scope reviewed

WO-2026-08-15-03 in full — all six numbered acceptance criteria, graded separately. One changed file
(`services/cockpit/render-vm-check.mjs`, +137/−28) confirmed as the entire product delta against `main`.

Deliberately NOT in scope, and NOT claimed anywhere below: whether Mum's screen is *correct*. This gate
grades a **control**, not the surface the control guards. See §Residual limit.

Also not in scope: the state of `main`. The work lives on `build-015/f3-render-gate-anchor` and is
unmerged; the control is running again **on that branch**, not yet on the default branch. Merge is
Warwick's decision and is not graded here.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | The anchor matches what ships, and survives the NEXT attribute — a stable stem, not a full opening tag | **PASS** | Stems are `<div class="page page-pad"` and `<div class="app-view"` — no closing `>`. Shipped tag is `public/shopping.js:1004` `<div class="page page-pad" :data-send-state="sendState">`, i.e. the stem matches today AND the old literal does not — the break, confirmed at source. Probe (below) proves: placement **byte-identical** to a naive replace of the *current full tag*, for both anchors; and still correct after adding a further attribute **whose value contains `>`**. Exactly-once assertion present and **proven to fire** (mutation B). | The stem ends at the class attribute's closing quote, so adding a class *inside* that attribute, or inserting an attribute *before* `class`, still breaks it. It breaks **loudly** (mutation A), never silently. Recorded, non-blocking. |
| AC2 | The mutations still actually mutate — assert the mutated text DIFFERS from the source | **PASS** | All seven household mutations plus the household control are wrapped in `assertMutated`; so are the three app-view cases, the stray-JSON case, the four vocabulary cases and the SHOP control. Two independent no-op guards, **both made to fire**: `injectAfterOpenTag`'s identical-template hard stop (mutation C1) and `assertMutated` (mutation C2), each exit 1. Run output prints `proof   15 stem-anchored mutations each changed the template (no silent no-op)`, and `mutationsProven === 0` is itself a hard stop. | The three `RR_ANCHOR` rotation mutations are not `assertMutated`-wrapped and are excluded from the count of 15. Their no-op risk is closed structurally instead — an exact-match `includes()` abort before use, and replacement strings that differ from the anchor by construction. AC5 authorises leaving RR alone. Non-blocking. |
| AC3 | `--self-test` passes end to end, with its executed count; the mutation set NOT reduced | **PASS** | `node render-vm-check.mjs --self-test` → **exit 0**, `SELF-TEST PASS — 18/18 mutations caught, control clean`, `control  244 assertions executed on the unmutated template, all green`, `control  all 66 unmutated scenarios clean`. Set parity proven, not asserted: the 17 named mutation labels are **byte-identical between `main` and this head** (`git show <ref>:… | grep -oE … | sort` — same 17 lines both sides), plus the stray-JSON case = 18. Nothing removed, nothing weakened. | none |
| AC4 | The REAL gate runs, and the result is reported honestly | **PASS** | `node render-vm-check.mjs` (no `--self-test`) → **exit 0**, `RENDER-VM-CHECK PASS — 66 scenarios rendered, 244 assertions executed, 0 failed. No missing bindings, no raw JSON in visible text, and no unknown rendered as a zero.` Executed independently in the export **and** present verbatim in the CI log at this head. **Identical to the builder's reported figures.** His conclusion — the screen was UNGUARDED, not DEFECTIVE — is supported by this evidence, within the limit stated below. | none |
| AC5 | The other two ticking anchors reported, not necessarily fixed | **PASS** | The app-view anchor (old line 1765) **was** converted to `APP_VIEW_STEM` and is byte-identity proven. `RR_ANCHOR` is deliberately left and explicitly labelled in-source (`⚠️ KNOWN TICKING ANCHOR — deliberately NOT converted … (WO-2026-08-15-03 AC5, reported to Larry and accepted)`) with the reason: it is a whole-row replace target, not an opening-tag anchor, and stem-converting it risks weakening the one guard that proves the verdict layer still verdicts. Its loud `includes()` abort is intact. | RR_ANCHOR stays brittle by design. Recorded, non-blocking. |
| AC6 | CI proves it — the job reaches and executes every step after the render step | **PASS** | **push**-event run `31852963880` at `fc40aad…` — success, 16 steps, **0 non-success**. PR run `31852986234` at the same head — job `private-apps`, steps 4–13 all `success`, **none skipped**: step 6 is the render step, steps 7–13 are the **seven** steps behind it (sw-version, down-reason, provenance, CAPAE, db-clone, origin-boundary, rotation-report). CI log at the head carries `SELF-TEST PASS — 18/18`, `proof   15`, `control  244`, and `RENDER-VM-CHECK PASS — 66 scenarios … 0 failed`. | none |

## Evidence provenance

- **Export**, not a worktree: `git archive fc40aad5412849e4151a97dfc12f69da398c163e | tar -x -C <scratchpad>/veritas-f3`. Every local execution and **every mutation** happened inside that export.
- Reviewer home `C:/Fusion247PKA`: `git rev-parse HEAD` = `5696166c99a013eae50a5b66ce76e8a890bfe198` at start and at end, identical. `git status --porcelain` unchanged — the same two untracked `Team Knowledge/Sources/*.md` files at start and end, neither written by this review.
- Target worktree `C:/Fusion247PKA-f3`: inspected **read-only** — `git rev-parse HEAD` = `fc40aad…`, `git status --porcelain` **empty** at start and at end. Nothing was executed against it.
- Mutations A, B, C1 and C2 were applied to the export only, each preceded by an assertion that the **source actually changed** (`MUTANT DID NOT CHANGE SOURCE` → exit 9), each restored from a backup, and the export re-run clean afterwards (`SELF-TEST PASS — 18/18`, exit 0).
- CI evidence read from the GitHub API at the exact head; no CI was triggered by this review.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node render-vm-check.mjs --self-test` (export) | 0 | 18 mutations caught / 18; 15 mutations proven to change the template; 244 control assertions over 66 scenarios | `SELF-TEST PASS — 18/18 mutations caught, control clean.` |
| `node render-vm-check.mjs` (export, the REAL gate) | 0 | 66 scenarios, 244 assertions | `RENDER-VM-CHECK PASS — 66 scenarios rendered, 244 assertions executed, 0 failed.` |
| `node probe-placement.mjs` — extracts the shipped `injectAfterOpenTag` body verbatim (1795 bytes) and compares against a naive full-current-tag replace | 0 | 4 | `BYTE-IDENTICAL` for both anchors; `FUTURE-ATTR OK` for both after adding `data-future="x>y"` |
| **Mutation A** — rename `page page-pad` → `page page-padRENAMED` in `public/shopping.js` | **1** | — | `SELF-TEST FAIL — the mutation anchor stem is missing: <div class="page page-pad"` + the three-line remediation message |
| **Mutation B** — duplicate the element so the stem matches twice | **1** | — | `SELF-TEST FAIL — the mutation anchor stem matches MORE THAN ONCE: <div class="page page-pad"` |
| **Mutation C1** — injected html set to `''` (a genuine no-op injection) | **1** | — | `SELF-TEST FAIL — the mutation produced an IDENTICAL template: <div class="page page-pad"` |
| **Mutation C2** — a `mutate()` that silently returns the template unchanged | **1** | — | `SELF-TEST FAIL — mutation did not change the template: household: the word COCKPIT reaches her screen` |
| Export restored, re-run | 0 | 18 / 15 / 244 | `SELF-TEST PASS — 18/18 mutations caught, control clean.` |
| Mutation-set parity: 17 named labels on `main` vs `fc40aad…`, sorted | 0 | 17 vs 17 | Identical line-for-line. Set not reduced. |
| `gh api …/actions/runs/31852963880` | 0 | 16 steps | `event: push`, head `fc40aad…`, `success`, **0 non-success steps** |
| `gh api …/actions/runs/31852986234/jobs` | 0 | steps 1–13, 25–27 | every step `success`; steps 7–13 (the seven behind the render gate) executed |
| `gh run view 31852986234 --log` | 0 | — | Real-gate verdict present verbatim in CI, matching the local run exactly |
| `bash scripts/secret-scan.sh --surface services/cockpit/render-vm-check.mjs` | 0 | 1 file scanned | `SCANNED 1 file(s) of the named surface, 0 secret value(s) found.` Not exit 2. |
| `git diff --stat main...fc40aad…` | 0 | — | `1 file changed, 137 insertions(+), 28 deletions(-)` — the workflow file is **not** in the diff |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | The promised outcome is exactly what the evidence shows: `--self-test` green, the real gate executed, and the steps behind it running. |
| Design fidelity | PASS | The repair follows the lesson the file already recorded for `DRAWER_STEM` — match the stable stem — and refuses the naive shortening that would have been worse than the defect. |
| Functional proof | PASS | Real gate executed twice independently (export + CI) with identical output. |
| Integration | PASS | The control is invoked by the real CI step on a real push, not by a hand-run script. Steps 7–13 measured executing behind it. |
| Durability | PASS | Attribute-growth durability is the property that failed on 2026-08-13 and it is now proven, including for an attribute value containing `>`. Remaining brittleness (class-list change, attribute inserted before `class`, `RR_ANCHOR`) fails **loudly** — proven by mutation A. |
| Test quality | PASS | Three failure paths made to fire; the guard now proves each mutation **changed** the template rather than that a string existed; the count is printed so a reader can check it; a zero count is a hard stop. Strictly stronger than what it replaced. |
| Git truth | PASS | One file, one branch, head reachable on `origin`, PR #108 open and unmerged. Reported scope matches the measured diff. |
| Documentation truth | PASS | The in-source record of the defect, the trap and the deliberate RR exception is accurate against the code. One clerical discrepancy, non-blocking — see Defects #2. |
| Residual risk | PASS | Every limit below is explicit and bounded, and the builder's stated limit is confirmed **as stated**, not softened. |
| Completed automation | PASS | Root `CLAUDE.md` §"Nothing may live only in Larry's head" satisfied for this scope: the real production event (a push to the branch) invoked it, on GitHub Actions, observably, with the verdict in the log, and nothing depends on Larry remembering. Acceptance is the CI run — **not** the local invocation. |

## Production caller and journey

`git push` → GitHub Actions `cockpit-private-apps` (push run `31852963880`, exact head) → job `private-apps`
→ step *"Template survives real payload shapes (self-test first)"* → `node services/cockpit/render-vm-check.mjs --self-test`
(exit 0) → `node services/cockpit/render-vm-check.mjs` (exit 0, real gate) → steps 7–13 execute → job success.

Every hop was observed in the run record at the exact head. The export runs are corroboration of the same
binary behaviour; the **CI run is the journey**.

## Restart and durability

n/a as process durability — nothing stateful is claimed. The durability property that *is* claimed
(the anchor surviving the next attribute) is graded under AC1 and the Durability dimension, and was
established by executing the shipped function against a template carrying a newly-added attribute.

## Residual limit — confirmed AS STATED, not softened

A green `render-vm-check` is **not** a claim that Mum's screen is correct. It is a claim that, across
**66 scenarios rendered against SYNTHETIC fixtures** (the fixture payloads self-identify:
`{"_fixture":"SYNTHETIC. Structurally faithful to GET /asdair…`), no missing binding, no raw-JSON leak,
no banned vocabulary and no unknown-rendered-as-zero appears. **Two browser gates
(`render-check.mjs`, `nav-check.mjs`) need Edge, are broken on this machine (D-2026-08-03-11) and did
not run** — the workflow says so in its own comment, and this receipt does not stand in for them.

Nothing in this receipt authorises or recommends any live household action.

## Documentation contradiction scan

- Larry's declared DOCUMENT IMPACT (from the Work Order): `[]` — no active document describes this anchor.
- Verified independently: no document in the repository references the anchor literal or the stem. Confirmed.
- **What was missed:** the Work Order's `outcome` says *"the **eight** further gates that have been silently skipped"*; the measured number of steps after the render step is **seven** (steps 7–13). The Work Order's own `acceptance_property` says *"every subsequent step"*, which is what was graded, so nothing turns on it. Clerical, non-blocking.
- Active documents that would misdirect a fresh instance: none found.
- Closure claims since the last receipt in this build's `Assurance/` folder: none made against this scope; no receipt is missing.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| 1 | Medium | `--self-test` and the real gate remain **two commands in one `bash -e` step** (`.github/workflows/cockpit-private-apps.yml:67-69`). An instrument self-test failure still suppresses the real gate **and the seven steps behind it** — the exact amplification that made this incident cost eight gates instead of one. The workflow was correctly **excluded** from the Work Order's `file_surface` (the generator returned UNRESOLVED and it was removed rather than the boundary quietly widened), the builder reported it and did not touch it, and the measured diff confirms that: one file changed. **Recorded, not fixed, and deliberately not opened here.** | non-blocking | Larry — Warwick's decision whether it becomes separate work |
| 2 | Low | Work Order `outcome` says "eight further gates"; measured is seven steps behind the render step. | non-blocking | Larry (scheduled reconciliation) |
| 3 | Low | The stems terminate at the class attribute's closing quote, so a change *inside* `class="…"`, or an attribute inserted *before* `class`, still breaks them. Fails loudly, never silently — proven. | non-blocking | recorded only |
| 4 | Low | `RR_ANCHOR`'s three mutations carry no differs-from-source assertion and are excluded from the printed `proof 15` count; their no-op risk is closed by the exact-match abort instead. Deliberate under AC5 and labelled in-source. | non-blocking | recorded only |

## Verdict

**PASS** — all six acceptance criteria are separately evidenced by execution; the repair is a genuine
stable stem rather than a literal swap, its `String.replace`-target trap is closed and proven closed by
four mutations that each turned the test red, the mutation set was not reduced, the real gate passes at
66 scenarios / 244 assertions / 0 failed, and the CI job on a real push executes every step behind it.
The control that guards Mum's screen is running again **on `build-015/f3-render-gate-anchor`** — not yet
on `main`, which this gate does not grade.

## Next review trigger

A material change to what this control executes — the mutation set, the anchor mechanism, the templates it
renders, or the CI step that invokes it. Merging this branch unchanged is **not** a trigger.
