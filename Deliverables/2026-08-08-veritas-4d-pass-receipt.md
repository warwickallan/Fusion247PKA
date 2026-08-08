---
build: BUILD-020
scope: phase-4d-capae
gate: 2

boundary: >
  Sub-phase 4D — CAPAE, against Warwick's 22-item acceptance surface. This receipt closes the
  2026-08-08 HOLD by confirming blocking finding D-1; D-2 and D-3 were confirmed closed at 5b20dc2.
  The 20 requirements that passed at 83bcdec were not re-graded.

reviewed_sha: 7afac1d3d4425871d2fa937da2cbbcc520e9ad81
governance_sha: 83bcdec6486df2d801d8df99177c3456e18bad84
branch: main
remote_reachable: true

evidence_method: mixed — target checkout (read-only execution), the real GitHub Actions run via gh (read-only), and one ephemeral `git archive 7afac1d` export used solely for mutation testing
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\a2725267-efa8-4c85-911a-2e4ba4cdfeb1\scratchpad (export deleted after use; never committed)
worktree_head_at_start: 7afac1d3d4425871d2fa937da2cbbcc520e9ad81
worktree_head_at_end: 7afac1d3d4425871d2fa937da2cbbcc520e9ad81
worktree_status_clean: true
ci_run_inspected: 31257962740 (cockpit-private-apps, head 7afac1d, conclusion SUCCESS, zero skipped steps)

d1_verdict: CONFIRMED CLOSED
d2_verdict: CONFIRMED CLOSED at 5b20dc2; its CI step now executes (success in run 31257962740)
d3_verdict: CONFIRMED CLOSED at 5b20dc2
hold_discharged: true

verdict: PASS
receipt_sha256: 46a64fb187ce9e4db95e8ad0482c6cefe5fde48611938385f58a44d677978f67
receipt_sha256_boundary: >
  sha256 over UTF-8 bytes from the anchored body heading to EOF, i.e.
  src.slice(/^(hash)(hash) Scope reviewed$/m.exec(src).index) where (hash) is the '#' character.
  STATED THIS WAY DELIBERATELY: this frontmatter contains no literal body-heading text, because
  twice a naive indexOf matched inside the frontmatter and hashed the wrong span. Recompute to check.
prior_receipts_verbatim: >
  Deliverables/2026-08-08-veritas-4d-focused-confirmation-receipt.md at 7afac1d is byte-identical to
  what Veritas wrote (13751 bytes, Buffer.equals true). Its stated digest 9e59b28a... reproduces when
  the boundary is anchored to the heading. Nothing was altered; no errata is owed.
reviewed_by: veritas
reviewed_date: 2026-08-08
next_review_trigger: >
  A material change to the 4D promised outcome — executable behaviour, accepted functional scope,
  a load-bearing interface or dependency, runtime wiring, or an active instruction altering the
  executable journey. NOT this receipt, its commit, documentation repair, or a moved HEAD.
---

# Veritas — Sub-phase 4D (CAPAE), Gate 2: HOLD discharged, PASS

## Scope reviewed

**D-1 only**, per the trigger I set: *"cockpit-private-apps GREEN at the head carrying the corrected copy loop, with the CAPAE step showing success rather than skipped."* D-2 and D-3 were confirmed closed at `5b20dc2` and are not reopened. The 20 requirements that passed at `83bcdec` are not re-graded.

`git diff --stat 5b20dc2..7afac1d` = 3 files: `services/cockpit/provenance-check.mjs` (+35/−11), the workflow (+3/−4), and my own prior receipt. No other product change entered the boundary.

## D-1 — CONFIRMED CLOSED

**The CI evidence, which is what the trigger required.** Run **31257962740**, workflow `cockpit-private-apps`, headSha `7afac1d3d4425871d2fa937da2cbbcc520e9ad81`, conclusion **success**. Every step succeeded; none skipped. The three that matter:

```
success   Build provenance is read from loaded bytes, never from git
success   CAPAE read layer and the attention derivation behind Home and System
success   Rotation reports map NULL and zero as different values
```

**The `CAPAE read layer` step shows `success`, not `skipped`.** That was the specific outstanding item on D-2's CI binding, and it is now discharged by the same run.

**The fix is the diagnosis applied, and I checked it rather than accepting it.** The copy root is now `<tmp>/services/cockpit`, mirroring the real depth, so `../../tools/governor/capae-brief.mjs` resolves to `<root>/tools/governor/…` — inside the isolation directory, exactly as it resolves inside the repository. `path.join` became `path.resolve`. **The guarded assertion is byte-untouched** — `provenance-check.mjs:185` still reads `ok('the same bytes OUTSIDE any repository hash identically', sourceHash({ dir: copy }) === baseline, …)`, and it does not appear in the diff.

**The containment assertion is non-vacuous — I made it fail.** Inside a `git archive 7afac1d` export I added a genuinely escaping entry to `SOURCE_MODULES` (`../../../escape-me.mjs`, with a real file at the target so the run reached the guard rather than dying earlier on a missing read):

```
FAIL  ⭐ every copied module lands INSIDE the isolation directory (no `../` escape) — ../../../escape-me.mjs
PROVENANCE-CHECK FAIL — 2 of 30 assertions failed.        exit=1
```

Restored → `PROVENANCE-CHECK PASS — 30 assertions executed, 0 failed`. **The guard names the offender rather than merely going red**, which is the property that makes it useful to whoever trips it next. It is the right instrument: this failed twice on path arithmetic, and an assertion does not depend on anyone noticing.

**The original D-1 property still holds at the new head, re-proven by mutation on both modules** — including the cross-tree one, which is the entry the whole defect turned on:

| State | `sourceHash()` |
|---|---|
| baseline | `c6639b7cf012c627` |
| `capae.mjs` mutated | `2de7d942bb6699a8` |
| `../../tools/governor/capae-brief.mjs` mutated | `0e3a615d4ae8d016` |
| restored | `c6639b7cf012c627` |

The digest is no longer blind to the 4D surface, and the export was deleted rather than left mutated.

**Pollution removed and verified absent:** `ls "C:/Users/Buggly/AppData/Local/tools"` → `No such file or directory`.

**Duplicate step removed:** `grep -n "run: node services/cockpit/rotation-report-check.mjs"` returns exactly one line (133). The comment left in its place records why a second step is not wanted, which is the correction that survives a future editor.

## Consequence for the phase verdict

With **D-1, D-2 and D-3 all closed**, the two held items on Warwick's acceptance surface are now met:

| # | Requirement | Was | Now |
|---|---|---|---|
| 21 | Live Cockpit provenance is canonical/current | HOLD | **PASS** — `provenance-check` green in CI run 31257962740; digest covers `capae.mjs` and `capae-brief.mjs`, mutation-proven. |
| 22 | Home/System acceptance surfaces exercised by meaningful, non-vacuous checks | HOLD | **PASS** — `capae-check.mjs` 40 assertions asserting `capaeOverview`/`familiesByUrgency`, mutation-proven in three directions at `5b20dc2`, and now **executing in CI**. |

**The HOLD of 2026-08-08 is DISCHARGED. Sub-phase 4D — CAPAE is `PASS` at `7afac1d` against Warwick's 22-item acceptance surface, all 22 items PASS.**

**What this PASS does NOT cover, named so it is not over-read:**

- **Item A** — phone-width visual acceptance is Warwick's own. I found no objective responsive or render defect, and I did not look through a browser.
- **Item B** — no family is EFFECTIVE. Zero qualified exposures have occurred and manufacturing one is prohibited. Deferred to 4F as natural evidence.
- **Item C** — the Pax comparison has not run through a natural `/rotate`. The mechanism and contract exist and are executable now; the behavioural result is 4F's.
- **Item D** — confirmed working during the first review, not deferred.
- **Outside this surface, and still Larry's to carry:** the map's own `OUTSTANDING` item 1 — a real `/close-session` → real fresh launch, observed — remains unmet. It was not on the 22-item list I was given and I have not graded it. **It is not discharged by this PASS**, and 4D should not be reported complete on the strength of this receipt alone while that row stands.

## Evidence executed

| # | Command or artefact | Exit | Result |
|---|---|---|---|
| 1 | `git rev-parse HEAD` · `git status --porcelain` · `git branch -r --contains 7afac1d` | 0 | `7afac1d…`, clean, on `origin/main` |
| 2 | `gh run view 31257962740 --json headSha,conclusion,workflowName` | 0 | `cockpit-private-apps \| success \| 7afac1d…` |
| 3 | `gh run view 31257962740 --json jobs` step conclusions | 0 | all `success`; **zero `skipped`** |
| 4 | `git diff 5b20dc2..7afac1d -- services/cockpit/provenance-check.mjs` | 0 | copy-root + containment guard; guarded assertion absent from the diff |
| 5 | `grep -n "the same bytes OUTSIDE any repository"` | 0 | line 185, text unchanged |
| 6 | `node services/cockpit/provenance-check.mjs` in export | 0 | 30 assertions, 0 failed |
| 7 | **MUTATION:** escaping `SOURCE_MODULES` entry (target file created so the guard is reached) | **1** | containment guard **FAILS and names the offender** |
| 8 | restore → re-run | 0 | 30 assertions, 0 failed |
| 9 | **MUTATION:** `capae.mjs` then `../../tools/governor/capae-brief.mjs` → `sourceHash()` | 0 | `c6639b7c` → `2de7d942` → `0e3a615d` → `c6639b7c` |
| 10 | `ls "C:/Users/Buggly/AppData/Local/tools"` | 2 | **No such file or directory** — pollution gone |
| 11 | `grep -n "run: node services/cockpit/rotation-report-check.mjs"` | 0 | exactly one step (line 133) |
| 12 | byte-compare banked prior receipt: disk vs `git show 7afac1d:` | 0 | 13751 bytes each, `Buffer.equals` **true** |

## The banked receipt — verbatim, and my own boundary defect

**The prior receipt was committed verbatim. Proven:** the working-tree file and the blob at `7afac1d` are byte-identical (13751 bytes, `Buffer.equals` true), no CRLF. **Nothing was altered.**

**But its stated `receipt_sha256` did not reproduce on a first attempt, and the fault is mine again, on the same axis.** My own frontmatter contains the literal string `'## Scope reviewed' to EOF` inside the field explaining the *previous* boundary confusion — so a naive `indexOf('## Scope reviewed')` matches **inside the frontmatter** and hashes the wrong span. Anchored to the heading, it reproduces exactly:

```js
const m = /^## Scope reviewed$/m.exec(src);
sha256(Buffer.from(src.slice(m.index), 'utf8'))
  === 9e59b28aa3ca0cce080e8609828a2b5bfc9130e839bff304960179347b2101d3   // true
```

**Recorded as my defect, not as a note.** Twice now I have stated a digest whose boundary was reproducible only if you guessed my intent — the first time by excluding the H1, the second by putting the boundary marker inside the frontmatter I then told people to skip. A tamper-evident receipt whose recipe is ambiguous is weaker than it claims to be, and *"recompute to check"* only works if the recipe is exact. **The boundary is stated below as an anchored regex, and this receipt's frontmatter deliberately contains no body-heading text.** No errata is owed to either prior receipt: both are unaltered and both now have an exact recipe.

Larry recording the digest he observed rather than asserting a match is what surfaced this, both times. That is the correct behaviour and it worked.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| — | — | **No open defects.** D-1, D-2 and D-3 are closed with executed evidence. | — | — |
| V-1 | Low | Veritas's own receipt-digest boundary was ambiguous twice. Corrected in this receipt by anchoring the boundary and keeping the marker out of frontmatter. | non-blocking | Veritas |

My three earlier parked items (`/api/health` freezing `sha`/`dirty` at boot · the map's *"no new table"* wording · `snapshotOpeningBrief()` firing on resume/compact) remain parked and were correctly not actioned.

## Verdict

**PASS** — D-1 is closed, proven by CI run 31257962740 at `7afac1d` and by a mutation that makes the new containment guard fail; with D-2 and D-3 already closed, requirements 21 and 22 are met and the 2026-08-08 HOLD on Sub-phase 4D is discharged. All 22 of Warwick's acceptance items PASS.

## Next review trigger

A **material change to the 4D promised outcome** — executable behaviour, accepted functional scope, a load-bearing interface or dependency, runtime wiring, or an active instruction that alters the executable journey. **Explicitly NOT a trigger:** this receipt, its commit, documentation repair, or a moved HEAD. The deferred items A/B/C and the map's outstanding real `/close-session` → fresh-launch acceptance belong to their own future boundaries, not to a re-review of this one.
