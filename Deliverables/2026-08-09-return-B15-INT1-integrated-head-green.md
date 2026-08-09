# RETURN — WO-2026-08-09-04 (B15-3-INT1) · The integrated head runs green

**Banked by Larry, not by the worker — for the SECOND time in one session.** The order's Sequencing
§5 instructed the worker to write this file while `file_surface` granted only three test-side paths.
`Deliverables/**` is a **conditional** carve-out in Keel's contract, valid only when the path is
inside the declared surface. **A body instruction cannot widen the envelope**, so the worker refused
and returned in-message.

> **This is Larry's defect, and worse than the first instance.** R1's return had already surfaced the
> identical contradiction, I told Warwick I was amending the running order, **and then I did not send
> the amendment** — I was pulled into the 4F return and never came back to it. Recording the miss,
> not just the defect.

| | |
|---|---|
| **Status** | **COMPLETED** |
| **Branch / worktree** | `b15-3/integration` · `C:/Fusion247PKA-b153-int` |
| **Commit** | `dde0d516f40060de724d7c68adbbf2e9eb1a38ff` |
| **Git endpoint** | commit only — no push, no PR, `main` untouched, as ordered |
| **Files touched** | **2.** Paths outside `file_surface`: **0** |
| **Read-back** | Stated, not held, per Sequencing §1. **Verdict: ACCEPT.** |
| **Worktree integrity** | *"No commit I did not make was observed in the worktree."* |

---

## Counts — the number, not the exit code (AC4)

Measured by the worker at pristine `29d685c` (files temporarily restored, then put back) and again
after. **It re-measured all seven baselines rather than trusting Larry's figures — they matched
exactly.**

| Suite | before | after |
|---|---|---|
| **pipeline** | **297** (294 pass, **3 fail**) | **327** (327 pass, **0 fail**) |
| handoff | 114 | 114 |
| packet | 109 | 109 |
| browser-runner | 75 | 75 |
| bot | 165 | 165 |
| intake | 34 | 34 |
| reconcile | 106 | 106 |

**327 ≥ 322** (Lane A's isolated figure — the acceptance bar). 0 skipped anywhere.
**`productionWiring.test.js` alone: 0 → 31.**

## AC1 — the duplicate declaration

Both lanes had added the **byte-identical** line
`const runtimeSrc = stripComments(fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf8'));` —
Lane C at line 414, Lane A at line 522. The worker removed **the second binding only** and left a
comment in its place explaining why it must not return.

**Every assertion of both lanes survives**, all reading the one binding: Lane C's four (`verifyBasket`
import and call site, `realWiring` supplying `verificationFor`) and Lane A's four
(`deps.correlateAnswer` consumed, `loadOpenQuestions` before `pollIntake` in `runOnce`, `claim` passed
into `runIntake`, the enqueued-kind sweep). Proof: **31/31 in that file**, named tests present in TAP.

## AC2/AC3 — the four statement shapes, and a defect that was hiding itself

Read directly off `services/asdair/handoff/claim.js`, as ordered. **Two of the four were already
being answered by the WRONG handler**, which is exactly why they never surfaced as "no handler":

- the `on conflict … where` insert was matched by the generic
  `INSERT INTO asdair.browser_build_request (` handler, which read `openHandoff`'s `$2` (a progress
  jsonb) as `shopStore`'s `$2` (a status);
- the supersede `update … set progress = (coalesce(progress,'{}'::jsonb) - '_lease' - 'report') || …`
  was matched by the `SET progress` handler, which looked for the row id in `openHandoff`'s progress
  parameter, found nothing, and returned no row.

Both existing patterns are now **pinned to their own shapes**, so an unmodelled statement reaches the
no-handler throw. The four new handlers model the partial index `bbr_one_live_per_shop`, `NULLS LAST`
ordering on `findComplete`, `status = any($2::text[])` read **from the parameter** rather than
hard-coded, and the supersede's three load-bearing parts (`-'_lease' -'report'` dropping the stale
lease, `||` as a shallow top-level merge, and the `status = any($4)` re-check).

**AC3 held — no fallback to the payload-less route was added.** `stepQueueBrowserBuild` still runs
`buildBrowserHandoff → buildHandoff → openHandoff`, and `requestBrowserBuild` remains absent from
that path, asserted by the Lane C tests that now actually run.

## AC5 — the loud-failure check, and it caught the worker

**This is the part worth reading.** The worker's first implementation validated the projection
*inside* the row loop. Its own demonstration failed: **a statement asking for a column the fake
cannot source returned an empty result whenever nothing matched the `WHERE`** — and "no rows" is the
*common* case for both new SELECTs. That is a silent wrong answer of **exactly the class D1 was**.

Fixed by hoisting the check to `assertBrowserProjection(selectProjection(sql))`, before any row is
looked at.

Executed demonstration, **14/14, exit 0**: an unmodelled SELECT/INSERT/UPDATE each reaching "no
handler"; an unsourceable column throwing on both new SELECTs **even with zero matching rows**; a
trailing comma before `FROM` erroring; and the real `openHandoff` driven through created → resumed →
superseded → live-writer-refused → completed-shop-guard → explicit reopen, with all four statements
confirmed issued. `listQuestionsProjection.test.js` (which owns the original loud-failure property):
**7/7**.

`node services/asdair/handoff/mutation-proof.js` → **`9/9 guards proven load-bearing`**, exit 0,
unchanged. **AC6:** no production source touched — `git diff --stat 29d685c HEAD` lists two test-side
paths and nothing else.

`bash scripts/secret-scan.sh --surface <the three declared paths>` → **exit 0**, *"SCANNED 3 file(s)
of the named surface, 0 secret value(s) found"*, 26 detection classes. **Declared surface only — not
a repo-wide green.**

## Out-of-scope findings — reported, not fixed. **Non-blocking; parked to the scheduled reconciliation.**

- **MEDIUM — `test/fakePg.js:502`, pre-existing, and the same defect the worker had just found in its
  own code.** The `listQuestions` handler computes `selectProjection(sql)` but only validates names
  inside `projectQuestionRow`, so **a shop with no questions returns `[]` instead of throwing when
  the statement asks for an unsourceable column.** The existing test seeds a question, so it never
  exercises the empty path. One-line fix. **In the worker's surface, but fixing it would have been
  scope expansion, so it did not.** *(Larry's note: that restraint is correct and the finding is
  real — it is the same silent-empty class as D1, in a control.)*
- **LOW — `test/fakePg.js:1105-1107`, pre-existing.** The injected-failure path nulls `failNext`
  before interpolating it, so every injected failure reports `fakePg: injected failure on "null"`.
  Two-line reorder.

## Not verified / known limitations

1. **The four new handlers have no committed regression test.** The 14 demonstrations ran from a
   scratchpad file because no test path for them was inside `file_surface`. The committed suite
   covers created and resumed via the two `runPipeline` tests; **supersede, the live-writer refusal
   and the completed-shop guard are proven only by a throwaway script.** A durable home needs a
   surface grant. **⚠️ Larry's read: this is the most consequential residual in the return.**
2. The insert's `RETURNING` list is **not** projection-checked the way the two SELECTs are — a column
   added to `RETURNING` alone would go undetected. Stated in a code comment rather than implied.
3. **This is a fake, not Postgres.** It proves the pipeline reaches `openHandoff` and behaves
   correctly against a faithful model of the partial index. **It proves nothing about the real
   database.**
4. CI was not run and the branch is unpushed — **no exact-head CI evidence for `dde0d51`.**
5. **AC6(f) untouched and still open**, as the order specified.

## Order defects found by the worker — Larry's, recorded

1. **Sequencing §5 ordered a write outside `file_surface`** (above). Second occurrence in one session.
2. **Governance head mismatch** — `78df74e` in the order, `29d685c` in the dispatch. Non-blocking:
   the worker resolved `Team/Keel - Implementation Engineer/AGENTS.md` at both and got the identical
   blob `500c6c5171074c2573f55810f93dc82a5e81508b`, so the governing bytes are the same.
3. **`document_impact: [] — no active document is affected; …` is not a YAML list; it parses as a
   string.** Envelope cosmetic, non-blocking. *(Larry's: a bare value with prose glued to it is
   exactly what the template's own guidance warns against, and I did it anyway.)*

**Builder self-test evidence — NOT independent review.** Veritas Gate 1 was commissioned against the
integrated head at `318e0e3`.
