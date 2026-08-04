---
build: BUILD-020
scope: WP-1 HOLD discharge -- the four findings of the 39a553cb receipt, plus anything the discharge itself introduced
gate: 1
reviewed_sha: e4a4f645d12f810a5a5551bb58fc09749478a80a
governance_sha: e4a4f645d12f810a5a5551bb58fc09749478a80a
branch: build-020/live-trial
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA-build-020-trial/f992c884-6940-4f7f-810d-0f0fa6a11b14/scratchpad/rr-bytes-e4a4f64 (byte-exact) and .../rr-e4a4f64, .../rr-old-3a32525
worktree_head_at_start: e4a4f645d12f810a5a5551bb58fc09749478a80a
worktree_head_at_end: e4a4f645d12f810a5a5551bb58fc09749478a80a
worktree_status_clean: true
verdict: HOLD
receipt_sha256: 756b332afe90b0644ef07479ece71ee42dc63ff42cf6d1aacc39713b7c8382b1
reviewed_by: veritas
reviewed_date: 2026-08-04
next_review_trigger: A new exact integrated head after the single blocking finding D-12 is corrected -- map section 11 records Phase 2 "Integration" as PASS at 39a553cb, a phase boundary Larry may not mark PASS while the only Veritas verdict at that head is HOLD.
---

## Scope reviewed

**As dispatched:** the HOLD discharge between `39a553cb` and `e4a4f645` — D-1 and D-4 (Keel, `78c14c8`), D-2 and D-3 (Larry, `3c8de67`), and the discharge record (`e4a4f645`) — plus anything the discharge itself introduced. Not a fresh full review.

**Scope I widened, in three places:**

1. **I re-ran the mutation myself rather than accepting Keel's report of it** (M-A), and added a mutation Keel did not run (**M-B**) to prove `assertQuiesced` is not vacuous.
2. **I re-measured the pre-fix head.** The map records "8 failures in 15 runs" at `3a32525`; I exported that head and ran it myself.
3. **I re-derived my own evidence isolation.** A plain `git archive` in this repository is **not** byte-identical to the blob — see §Evidence provenance. I rebuilt the export byte-exact and re-bound the key evidence to it.

**Carried, not re-executed:** goal fidelity, design fidelity, functional proof, integration and durability were PASS at `39a553cb`. `git diff --name-only 39a553cb e4a4f645 -- services/proofline/{src,public,bin,scripts} scripts` returns **0 files**, so those verdicts transfer by identity of bytes, not by assumption. The live journey was not re-executed.

**Deliberately not in scope:** the browser render (H-2, Warwick's) · the first live start (P-9, Warwick's, at Phase 4) · the estate-wide parked items P-5..P-8, P-10, P-11.

## Evidence provenance

- Repository `git rev-parse HEAD` at start / end — `e4a4f645d12f810a5a5551bb58fc09749478a80a` / `e4a4f645d12f810a5a5551bb58fc09749478a80a`, identical. `git status --porcelain` empty at start and at end. No worktree created; no `.git` state touched.
- Three isolated `git archive` exports, all outside the repository: `rr-e4a4f64` (reviewed head), `rr-bytes-e4a4f64` (reviewed head, byte-exact), `rr-old-3a32525` (pre-fix head).
- **Byte-exactness, proven not asserted.** For all 27 files under `services/proofline`, `sha256sum` of the extracted file equals `git cat-file blob e4a4f645:<path> | sha256sum` — **27 raw match, 0 mismatch**.
- **A correction to my own method, and it is the same root cause as P-10.** A plain `git archive` in this repository honours `core.autocrlf=true` and emits CRLF: the first export's `ordering.test.js` carried 188 CR bytes and 7712 bytes against the blob's 0 and 7524. `git hash-object` normalises on input, so a hash-object comparison **cannot detect this** — my earlier receipt's isolation proof used exactly that comparison. Content was identical and the divergence is immaterial to Node, but the claim "byte-identical" needed `git -c core.autocrlf=false archive` to be true. The second export uses it. Prior evidence stands on content identity; this receipt's stands on bytes.
- Mutations applied **inside the exports only**, restored and verified: `src/server.mjs` raw sha256 back to `83b99ab3…` = `git cat-file blob e4a4f645:services/proofline/src/server.mjs | sha256sum`; `ordering.test.js` blob-identical after restore.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test`, ×40 sequential (export at reviewed head) | 0 | `# tests 83` each | **40 runs, `# fail 0` in every one** |
| `node --test`, ×20 at **4× concurrency** (5 batches of 4) — a harsher load than the one that produced the original race | 0 | `# tests 83` each | **20 runs, `# fail 0` in every one** |
| `node --test`, ×15 in the **byte-exact** export | 0 | `# tests 83`, `# pass 83` each | **15 runs, `# fail 0` in every one** |
| **Total at this head: 75 runs, 0 failures.** My previous measurement at `39a553cb` was 4 failures in 11 | | | |
| `node --test`, ×15 in an export of the **pre-fix** head `3a32525` | 1 | 83 | **15 of 15 runs red**, every one `not ok 47 — T-3d`. The flake reproduces *worse* than the map records, not better |
| `git diff 39a553cb e4a4f645 -- test/ordering.test.js` — inspection of the assertion bodies | — | — | The `deepEqual` blocks at the old `:92` and `:136` appear in the diff with **no `-` lines**. Byte-identical. Keel's claim holds |
| **M-A** — production mutation: `worker.nudge()` moved before `send()` in `src/server.mjs` | 1 | 3 | **All three ordering tests red.** `assertQuiesced` **passed**; the failure is the strict `deepEqual`, actual `[…fsyncSync.return, writeSync.enter, writeSync.return, fsyncSync.enter, fsyncSync.return, worker.process.start]`. **The narrow claim still held** — `fsyncSync.return` at index 3, `http.response` at index 9. The strict form is what caught it |
| **M-B** — vacuity mutation I added: `QUIET_SCAN_INTERVAL_MS` 60_000 → 5 | 1 | 3 | **All three red on `assertQuiesced` itself**, message `the periodic scan must not fire during an ordering test — got ["worker.scan","worker.scan",…]`. **`assertQuiesced` is not vacuous** and fails loudly and deterministically if the interval regresses |
| `startApp` option precedence, `test/helpers/harness.mjs:137-146` | — | — | `scanIntervalMs: 100` sits **before** `...overrides`, so the test's 60 s value genuinely wins. The seam is real, not decorative |
| `recovery.test.js:68,94,201,223,243` | — | — | T-6a/T-6b run with a **live 50 ms periodic scan** against the real request path. The comment's claim that the narrowed coverage is owned elsewhere is **true**, not a shade |
| `RUNBOOK.md` swept whole for egress absolutes (`never`, `egress`, `fetch`, `DNS`, `outside your machine`) | 0 | 9 hits reviewed | The absolute is gone; the surviving `never` statements are all defensible. `README.md:133` and `RUNBOOK.md:188` now say the same thing |
| `config.mjs:16` `export const HOST = '127.0.0.1'`; `egress.test.js:96` | — | — | The runbook's surviving loopback claim is backed by a constant and a test that no environment variable widens it |
| `git config core.autocrlf` → `true`; `git ls-files \| grep gitattributes` → **0** | 0 | — | **P-10 is factually true**, both halves |
| `git show e4a4f645:Deliverables/…-wp1-receipt.md \| tail -n +18 \| sha256sum` | 0 | — | `745703891a07…44815` — **matches the frontmatter exactly. The previous receipt was committed verbatim and has not been altered** |
| `git diff --name-only 39a553cb e4a4f645 -- src public bin scripts` | 0 | — | **0 files.** Larry's "nothing under the production surface changed" is exact |
| **Unavailable, named:** Keel's own "55 consecutive runs" as a historical event | — | — | Builder self-report; not independently verifiable. **The property it claims is corroborated by my 75 runs**, which is the part that matters |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS (carried) | Zero bytes changed under `src/`, `public/`, `bin/`, `scripts/`. Verdict transfers by identity, proven by diff |
| Design fidelity | PASS (carried) | As above. The one design-relevant addition is a test-only seam already present in production wiring (`scanIntervalMs`) |
| Functional proof | PASS (carried) | As above; the full suite is green 75/75 at this head |
| Integration | PASS (carried) | As above |
| Durability | PASS (carried) | As above. The kill-and-revive evidence at `39a553cb` binds unchanged bytes |
| **Test quality** | **PASS** — up from HOLD | D-1 is genuinely discharged. The strict assertions are byte-identical (diff, no `-` lines); the strict form is load-bearing (M-A, reproduced by me, narrow claim still true); `assertQuiesced` is not vacuous (M-B); the lost coverage is really owned by T-6a/T-6b (verified, 50 ms live scan). **75 runs 0 failures here against 15/15 red at the pre-fix head — the flake is gone, not moved** |
| **Git truth** | **PASS** — up from HOLD | Head, branch and change surface exact: 4 files, 0 under the production surface. **The previous receipt was committed verbatim — its digest recomputes to the byte.** Phase 1 correctly recorded `PARTIAL`, which is Larry's to record |
| **Documentation truth** | **HOLD** — up from HOLD, one new blocking defect | D-2, D-3 and D-4 all fully discharged and swept beyond the lines I named. But the discharge **introduced** D-12: map §11 now records Phase 2 "Integration" as **PASS** at `39a553cb` — a phase boundary marked PASS at the exact head whose only Veritas verdict is HOLD, recorded two rows above the HOLD it contradicts |
| **Residual risk** | **PASS** — up from HOLD | The runbook overstatement is gone and the residual leads with "zero egress is NOT claimed". P-10 verified true by me and honestly parked; P-11 records the class rather than generalising a mechanism. The first live start is still recorded as outstanding in five places |

## Production caller and journey

Not re-traced. The production surface is byte-identical to `39a553cb`, where I executed the journey live end to end through `bin/proofline.mjs`. Re-executing it here would be regeneration, which the method forbids. **The only journey-relevant change is that the operator's runbook now tells the truth about egress** — verified by reading it whole.

## Restart and durability

Not re-executed, for the same reason: zero bytes changed in `src/`. The kill-and-revive evidence recorded at `39a553cb` binds to identical code. Stated as carried, not as re-proven.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT for the discharge:** map §1, §8, §11, §12 (his); `RUNBOOK.md` (Keel's).
- **Verified independently:** `git grep -il proofline` outside the service still returns exactly three files — the map, the Work Order and my previous receipt. No new surface. The D-2 narrowing reaches **both** places the claim appears in the map (§1 G-2c line 65, §8 T-3c line 256) and agrees with `crash.test.js:178-220`, which is where the corked/uncorked distinction actually lives. The D-4 correction is the only instance in the runbook — I swept all nine `never`/egress hits, not the one line named.
- **What his list missed:** the new §11 Phase 2 `PASS` row (**D-12**, blocking) and a broken markdown table (**D-13**).
- **Active documents that would misdirect a fresh instance:** **none for the route.** §12 now reads "WP-1 is built and integrated at `39a553cb` — do NOT re-implement it", §11 Phase 1 reads `PARTIAL`, and the resumable-state line still tells the reader to verify HEAD by execution. A fresh session opening this map is directed correctly. **D-3 is discharged.**
- **Closure claims since the last receipt (`39a553cb` → `e4a4f645`), and the receipt behind each:**
  - §11 Phase 1 — `PARTIAL`. **Correct**: PARTIAL is Larry's to record without a receipt, and it cites the `39a553cb` HOLD.
  - §11 Phase 2 "Integration" — **`PASS`**. Receipt at that head exists and is cited by path and digest, **but its verdict is HOLD**. See D-12.
  - §11 Phase 3 "Veritas gate" — `HOLD`, citing the receipt path, digest and head. **Accurate.**
  - §11 Phase 0 — `PASS` without a receipt, carried from the previous review as D-6 and now annotated in the map with my own reasoning. **Still Warwick's to decide.**

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| **D-12** | **MEDIUM — blocking** | **Map §11 line 305 records Phase 2 "Integration" as `PASS`, at head `39a553cb`, where the only Veritas verdict is `HOLD`.** The row was `NOT STARTED` before the discharge, so this is new at this head. Root `CLAUDE.md`: *"A phase boundary marked PASS additionally requires a Veritas receipt against the exact integrated head"* and *"PARTIAL and FAILED are Larry's to record without one; PASS is not."* Veritas's **Integration dimension** passing is not a Phase 2 verdict. **Why I did not escalate to `FAIL`, stated in the open:** nothing was suppressed — the receipt is committed verbatim, cited by digest, and its HOLD is recorded in the very next row; and the underlying fact (the work was integrated at that head, tree clean, surface reconciled) is true and I verified it myself. This is a status label recorded without the authority to record it, not a fabricated completion. **Blocks:** a PASS of this scope, and any use of §11 as the acceptance status of BUILD-020 at Phase 4 handoff. **The correction is one table cell** | Larry |
| **D-13** | LOW — non-blocking | The new §11 disposition table is broken: the `D-8` row (line 325) sits **after** the "Proof that the strict assertion is load-bearing" paragraph, with a blank line between it and the table. It will render as literal pipe text, not a table row, so the D-8 parked item is effectively invisible in any rendered view. Introduced by the discharge | Larry |
| D-7 | LOW — non-blocking, **carried unfixed** | `WO-2026-08-04-01` §Envelope still reads `status: ISSUED`. Reported at the last review, not corrected. Recorded once more, not re-raised | Larry |
| **N-1** | Note, not a defect | The map states the pre-fix reproduction as "**8 failures in 15 runs**". I measured **15 of 15** at `3a32525`. Both are honest measurements of a load-dependent race, and the map's own wording is "reproduced worse than measured first" — it under-states rather than over-states. No correction owed; recorded so the number is not later read as a fixed property | — |
| **N-2** | Note, method | `git archive` in this repository honours `core.autocrlf=true`. A plain export is **not** byte-identical to the blob, and `git hash-object` cannot detect the difference. **This is a second, independently-found face of P-10** and it bites assurance method, not just `git restore`. Future Veritas reviews here should export with `git -c core.autocrlf=false archive`. Recorded as evidence supporting P-10's MEDIUM rating; **not** a Work Order and **not** a recommendation to build anything | — |

**On the four discharged findings, answered directly.**

- **D-1 — discharged.** The strict `deepEqual` at both sites is byte-identical to the racing version: the diff contains no removal inside either assertion, only the insertion of `assertQuiesced(events);` above them. Nothing was filtered, relaxed or deleted. The fix removes the noise at source rather than tolerating it, and `assertQuiesced` converts a future regression from intermittent into deterministic. I proved both directions myself: M-A shows the strict form is load-bearing where the narrow form is not; M-B shows the guard is not vacuous.
- **D-2 — discharged.** Both occurrences narrowed to the corked variant, with the uncorked measurement retained and labelled as a measurement carrying no loss assertion. That matches `crash.test.js` exactly.
- **D-3 — discharged.** §11 and §12 are true at this head and a fresh session would not re-implement WP-1.
- **D-4 — discharged, and swept.** The absolute is gone from "What this service will never do"; the residual sits first in the limits table, leads with "**Zero egress is NOT claimed**", names the missing packet capture, describes what T-9 actually proves, and points at the README, which agrees. The surviving loopback claim is backed by a constant and a runtime test.

**On P-10's disposition, answered directly: honest.** Both halves of the claim are true by execution — `core.autocrlf=true`, and no `.gitattributes` tracked anywhere or present at the root. It is genuinely estate-wide, genuinely outside the Proofline surface, and reporting it once for Warwick rather than converting it into work is exactly what root `CLAUDE.md` §Finding disposition requires. **I found a second consequence of the same root cause (N-2), which strengthens the MEDIUM rating rather than undercutting it.** I am not recommending it be fixed inside this build.

**On the first live start, answered directly.** Still honestly outstanding: `README.md` "not claimed", `RUNBOOK.md` limits, the Work Order's `live_authority: none`, map P-9, and §11 Phase 4 `NOT STARTED`. §12 makes it conditional on a `VERITAS_PASS`. Nothing at this head claims it.

## Verdict

**HOLD** — the discharge is real: all four findings are genuinely fixed, the fix survived a harder test than the one that found the defect, and three of the four held dimensions now pass. It is held on **one new cell the discharge itself wrote** — a phase marked PASS at a head Veritas held.

## Next review trigger

A new exact integrated head with **D-12** corrected — map §11 Phase 2 recorded as something Larry has the authority to record at a head under HOLD. D-13 and D-7 are non-blocking and may ride the same commit. **N-1, N-2, D-6, D-8, P-10 and P-11 are not corrective work.**

> **Digest caveat, carried forward and now explained.** `core.autocrlf=true` with no `.gitattributes` means recomputing `receipt_sha256` from a working tree can yield a false tamper signal. Recompute against the blob: `git show <sha>:<path> | tail -n +18 | sha256sum`. Verified working on the previous receipt. This receipt is **tamper-evident, not tamper-proof.**
