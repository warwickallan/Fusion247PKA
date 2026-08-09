---
build: BUILD-015
scope: WP-B15-2 — the answer-to-plan spine (Lane A, the critical spine)
gate: 1

boundary: >
  WP-B15-2 (WO-2026-08-09-B15-02) and the outcome it promised —
  "Warwick receives a real question, answers naturally or by exact candidate, and THAT ANSWER
  CHANGES THIS WEEK'S SHOP — with no Larry in the path."

reviewed_sha: 2d84dd17815562c07051ad12c9bded850eaac40d
governance_sha: d90735046081420e7d97925c55871adeafd7073b
branch: build-015/wp-b15-2
remote_reachable: true   # git ls-remote origin -> refs/heads/build-015/wp-b15-2 = 2d84dd1

evidence_method: export (git archive of 2d84dd1) + read-only inspection of the canonical repository
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\8461a9fd-ca53-4a78-af8e-5cefa89d2ee0\scratchpad\vx-b15-2
worktree_head_at_start: 1cb7dd66d1635fc355f646d20d6173e78a819cf6
worktree_head_at_end: 1cb7dd66d1635fc355f646d20d6173e78a819cf6
worktree_status_clean: true   # empty at start and at end; the only new path is this receipt
review_ceiling: 45-60 minutes (dispatch); not extended

verdict: HOLD
receipt_sha256: 46b3b6a9c7c22b02ce4e3fe83359c5fd520d94eae8ba38ef4534676400fda995
reviewed_by: veritas
reviewed_date: 2026-08-09
next_review_trigger: >
  A production binding for `deps.interpretAnswer` (or an explicit Warwick reclassification of the
  free-text half as manual/deferred), plus observability on the `wait:line_resolution` park.
  ONE focused confirmation of those blocking findings only. Not a receipt, documentation or
  clerical commit.
---

## Scope reviewed

Gate 1 on WP-B15-2: the eight numbered acceptance criteria of `WO-2026-08-09-B15-02` and the
outcome that order promised. Reviewed the integrated work where it lives — branch
`build-015/wp-b15-2` at `2d84dd1` (two commits, 15 files, +2601/-48), taken as a clean
`git archive` export.

**Deliberately not in scope:** Gate 2 (the phase North Star journey — a separate receipt, not owed
here); the live application of migration 017 (Warwick's live authority, excluded by the order);
Lane B, Lane C3, `services/asdair/skill/**`; estate reconciliation and convergence.

**Scope widening applied (contract §"Scope is Veritas's to widen"):** none needed on the
requirement list — the dispatch named all eight functional rows. One material fact was supplied
mid-review by Larry (the absent `interpretAnswer` binding); it was **re-established by my own
execution** before being used, and is graded below.

## Accepted requirements

| # | Requirement (abridged from WO-2026-08-09-B15-02) | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **AC1** | Migration 017 implemented exactly as Silas decided — `asdair.shop_decision` insert-only by grant, plus `question_round`/`parent_question_id`. **Authored, not applied.** | **PASS** | Read `db/017_shop_decision.sql` line by line against Silas's decision: six kinds + orthogonal `forward_intent` ✓, composite FK `(question_id, shop_id)` ✓, `shop_decision_question_uniq` ✓, grants SELECT+INSERT only, UPDATE/DELETE to nobody ✓, no backfill ✓, no dependency on 016 ✓, three `pg_constraint` guards present ✓. `node --test schemaCompat.test.js` 14/14; guard control **mutation-proven** (removing one guard → `not ok 9`). | 017 has **never been executed against any Postgres**. Idempotency, and the acceptance of a `CREATE UNIQUE INDEX` (not a named unique *constraint*) as the target of `shop_decision_question_fk`, are **reasoned and text-asserted, not proven**. First live application must be a two-run test on a disposable database. |
| **AC2** | A tap naming an exact candidate produces the decision directly, **with no model call**, proven by test. | **PASS** | `answerJourney.test.js` "a button naming an exact candidate spends NO model call" asserts `interpretAnswer.calls.length === 0` — a counted number, not an inspection. Source-ordering control (`resolveExactCandidate` before `deps.interpretAnswer`) **mutation-proven** in M-A below. A candidate with a label but no `regular_id` correctly refuses to resolve. | none |
| **AC3** | **Free text is interpreted by bounded Terra, grounded**; may assert only an identity present in its evidence; unknown ⇒ `clarification_required`; model stubbed at the dep boundary, zero spend in the suite. | **HOLD** | The *bounding* is real and proven: closed evidence packet asserted field-by-field, `shop`/`deps`/`listItems`/`plan` proven absent, `decided_regular_id` a real FK, `buildDecision` refuses a clarification that also names a product, suite spends nothing. **But `deps.interpretAnswer` has NO production binding.** Established by my own execution at `2d84dd1`: `grep -rn "interpretAnswer" --include=*.js .` returns `runPipeline.js:799/834/842` (the consumer) and test files **only**; `services/asdair/pipeline/deps.js` does not wire it. | **Blocking.** The order's evidence clause ("stub at the dep boundary") is satisfied; the criterion's own subject — *"free text **is** interpreted by bounded Terra"* — is not achievable in production. In production today `decideAnswer` returns `no interpreter is wired into this runtime` for every free-text answer. |
| **AC4** | Route B: a pure `applyShopDecisions(plan, decisions)` inside `pipeline/**`, seamed so planner-level consumption can replace it later without a data-model rewrite. | **PASS** | `applyDecisions.js` has **zero imports** — verified by reading the whole file. Takes plain data (plan items, decisions keyed by question key, an injected `questionKeyFor`, a regulars Map) and returns plain data. `skill/planner.js` could import and call it unchanged; only the call site would move. Input plan is never mutated; the summary is recomputed rather than carried. | none |
| **AC5** | **Enumerate** every production recomputation on the shopping journey and prove **by execution** that each applies the decisions before readiness is assessed. | **PASS** | Enumeration is real, not asserted. `decisionSpine.test.js` reads `runPipeline.js` off disk and requires **exactly one** `deps.planBasket(` call site, inside `planWithDecisions`, which must also call `applyDecisionsToPlan`; then names both consumers (`stepPlan`, `stepRecordConfirmation`) explicitly. I confirmed independently: `deps.planBasket` appears in production only at `runPipeline.js:79`; the three out-of-surface `planBasket` consumers the test names (`skill/cli.js`, `outcome/record-shop.js`, `outcome/buildOutcome.js`) are the complete set, and the first two are CLI-only. Behavioural proof at both sites, not structure alone. **Mutation-proven in both directions (M-A, M-B).** | See finding D-3 — a second, unrequested behaviour change rode in on this refactor. |
| **AC6** | `READY_TO_SHOP` unreachable while a required line's meaning is unresolved, **without the livelock**. | **HOLD** | The stated property is met and proven: `planOutcome` gains `unresolvedLines`, parks at `wait:line_resolution` with `to: null`, writes no transition; `runPipeline.test.js:253` now drives two passes and asserts `stepped:false`, no bounce to `NEEDS_DECISION`, no manufactured questions. **But the park is completely silent** — `grep -rn "AWAIT_LINE_RESOLUTION"` finds no outbox message, no card, no event anywhere. This is shop 6's exact live failure shape, which WP-B15-1 was commissioned to remove for the sibling park `wait:interpretation_confirmation` (`runPipeline.js:546-558`). | **Blocking.** Root `CLAUDE.md` §"Nothing may live only in Larry's head": *"success or failure must be observable; failure must never be silent."* With AC3 unbound, this silent park is the **guaranteed destination of every free-text answer in production**. The shop stops, forever, and nothing tells Warwick. |
| **AC7** | A `clarification_required` decision opens a NEW `shop_question` row via Silas's derivation with `parent_question_id`/`question_round`, delivered as a real card; **round-1 keys byte-for-byte unchanged, mutation-proven**. | **HOLD** | The mechanism is correct and proven end-to-end. Round-2 chain: real second row, correct parent, `status='open'`, round-1's `answer_text` and `answered` status untouched, opened once not per pass. Round-1 pin **mutation-proven** (M-D). I drove the chain to **round 3** myself (probe, since no test does) — key `qb77925c4` matches `questionKeyFor('fruit splits', 3)`, parent correct, chain resolves to `READY_TO_SHOP` on answering. **But nothing in production can produce a `clarification_required` decision.** `resolveExactCandidate` never returns that kind; only the interpreter branch can, and it is unbound (AC3). | **Blocking.** Contract §Identity: *"A tested function with no caller is not a feature."* AC7's production trigger does not exist at this head. Also non-blocking F-4: from round 3 onward the plan line is not found (`lineByKey` is keyed on round-1 keys, `held.question_key` is the highest-round key), so a round-3+ card is built from a stub with no `alternatives`. |
| **AC8** | The false comment at `runPipeline.js:570-585` is corrected or deleted. | **PASS** | Corrected in place, not deleted, with the old text quoted and the actual failure named (`eligiblePriorAnswers` admits only `applies_going_forward === true`; the step passes the literal `false`, so every row written was filtered out by the consumer). | Non-blocking F-5: **the same false claim survives one file over** — `runPipeline.test.js:1023-1024` still reads *"…reads back as `priorAnswers`, which JOIN 1 feeds to the planner. **The loop closes here.**"* directly above an assertion that the row is `applies_going_forward: false`. |

**Overall Gate 1: HOLD.** Five PASS, three HOLD. Per contract, an overall PASS cannot conceal a
held mandatory requirement.

## Evidence provenance

- Contract, template and root governance loaded from the canonical repository at
  `d907350`; `git hash-object` of the working-tree contract = `635653a…` = the committed blob at
  that head. Verified, not assumed.
- Product evidence from a `git archive` export of `2d84dd1` into the session scratchpad
  (path in frontmatter). **No `git worktree` was created.** All five mutations were applied and
  reverted **inside the export only**.
- Export integrity proven after mutation testing: a second independent `git archive 2d84dd1` into
  `/tmp/vxref`, then `diff -r` against the working export → **identical**. No mutation survived.
- Repository `git rev-parse HEAD` start / end — `1cb7dd6…` / `1cb7dd6…`, identical.
- Repository `git status --porcelain` — empty at start and at end.
- Remote reachability: `git ls-remote origin` → `2d84dd17815562c07051ad12c9bded850eaac40d
  refs/heads/build-015/wp-b15-2`. The head is pushed; it has not left Larry's machine only.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `cd <export>/services/asdair/pipeline && node --test` | 0 | **264** | pass 264, fail 0 (baseline 205) |
| `cd <export>/services/asdair/bot && node --test` | 0 | **156** | pass 156, fail 0 |
| `cd <export>/services/asdair/shop && node --test` | 0 | **91** | pass 91, fail 0 |
| `bash scripts/secret-scan.sh --surface services/asdair/pipeline services/asdair/bot services/asdair/db services/asdair/shop` | 0 | 26 detection classes | **71 files scanned, 0 secrets.** Not "exit 2 / NOT SCANNED". |
| **M-A** mutation: disable `stripComments` in `decisionSpine.test.js` | — | 28 | `not ok 1` — AC5 enumeration. Proves the strip is load-bearing and the control now measures **code, not prose**. |
| **M-B** mutation: insert a **real** second `deps.planBasket(` call site in `stepReconcile` | — | 28 | `not ok 1`. Proves the control still fires on genuine code. Restored → 28/28. |
| **M-C** mutation: remove one `pg_constraint` guard from 017 (`shop_question_round_sane`) | — | 14 | `not ok 9`. And separately, disabling `stripSqlComments` also produces `not ok 9` — proving the SQL strip is load-bearing too. |
| **M-D** mutation: fold round-1 key derivation into the round-N form (`term#1`) | — | 264 | `not ok 101`, `not ok 103` — the round-1 literal pin holds. |
| **M-E** mutation: fold the round chain to a round-1-only lookup in `applyDecisions.js` | — | 264 | `not ok 9` — "AC7 JOURNEY: answering the clarification round resolves the line". The real bug's regression test genuinely fails. |
| **VX probe** (written in the export, run, deleted): drive the clarification chain to **round 3** | 0 | 1 | Round-3 row opened with the correct round-aware key and parent; answering it reaches `READY_TO_SHOP`. Candidates `[]` (see F-4). |
| `grep -rn "interpretAnswer" --include=*.js .` over the whole export | 0 | — | **Consumer + tests only. `deps.js` does not bind it.** Independently re-established, not adopted from the dispatch. |
| `grep -rn "AWAIT_LINE_RESOLUTION" --include=*.js .` | 0 | — | `stages.js` (definition + the park) and three test files. **No outbox message, no card, no event.** |
| `grep -c "shop_decision" db/012_complete_grant_matrix.sql` | — | — | **0** — the residual Larry reported is true. |
| `grep -rn "markCorrected" --include=*.js .` | — | — | Definition + two test files. **Zero production callers** — the residual Larry reported is true. |

**Unavailable evidence, declared:** no Postgres was reached, no Telegram card was rendered, no
model was called. Migration 017 was not applied. The live journey was not executed. None of these
are treated as passed.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | The order's own outcome sentence — *"answers **naturally** … and THAT ANSWER CHANGES THIS WEEK'S SHOP"* — is unachievable at this head for the natural-language half. The exact-candidate half is delivered. |
| Design fidelity | PASS | Silas's carrier decision implemented faithfully and without re-derivation; Route B taken as Warwick conditioned it; the seam is genuinely pure. One unrequested widening — D-3. |
| Functional proof | **HOLD** | The production path works for taps. For free text the production path terminates at `no interpreter is wired into this runtime`. |
| Integration | **HOLD** | Both plan recomputations are wired, enumerated and mutation-proven — this is the best-integrated part of the work. The failure is at the *other* end: the interpreter seam has a consumer and no provider. |
| Durability | PASS | Idempotency is structural (`ON CONFLICT (question_id) DO NOTHING` + re-select), proven by a restart-shaped test that re-drains the whole pipeline from durable state and asserts one row, the same id, one model call. `question_round` is read from the database rather than counted in a process that may have restarted. |
| Test quality | **PASS — and above the bar** | Five controls mutation-tested by me in both directions (prose does not trip them; real code does). The enumeration control reads source off disk rather than trusting a comment. Two self-corrected controls (comment-counted-as-code) verified: **both strips are load-bearing and both now measure what they claim.** No zero-subtest suites. |
| Git truth | PASS | Branch, head, commit count and diffstat as reported; head reachable on `origin`. The builder's claimed numbers (264/156/91, 71 files, 0 secrets) were re-executed and are exact. |
| Documentation truth | HOLD (non-blocking) | AC8's named comment is properly corrected with the old text preserved. F-5: the sibling false claim survives at `runPipeline.test.js:1023-1024`. The migration honestly records its own known limits rather than discharging them. |
| Residual risk | **HOLD** | The builder's stated limits are honest and complete as far as they go (017 unexecuted, `fakePg` is not Postgres, live acceptance not claimed). **The unbound interpreter was not among them** — it was neither stated by the builder nor caught by Larry, and it is the largest residual in the package. |
| **Completed automation** | **FAIL on the dimension** | Mandatory here: the outcome claims *"with no Larry in the path."* Root `CLAUDE.md` §"Nothing may live only in Larry's head" requires that **the real production event invoke it** and that **failure never be silent**. Neither holds for the free-text path: the real production event invokes nothing (no binding), and when it declines, the shop parks with no card. A green suite over an injected stub evidences **capability only** — which is precisely what this dimension exists to catch. |

## Production caller and journey

Traced from the real entry point, hop by hop.

**Tap path — complete.**
`commands.answerQuestion` → `shopStore.recordAnswer` (compare-and-set on `status='open'`) →
`runPipeline` → `stepReplan` → `decideAnswer` → `shopDecisions.resolveExactCandidate` (exact label
+ trustworthy `regular_id`) → `recordDecision` INSERT → next pass `stepPlan` → `planWithDecisions`
→ `planBasket` → `applyDecisionsToPlan` → line status `add`, `matched_product` looked up **from the
catalogue by id, never from the decision row** → `planOutcome` → `READY_TO_SHOP`. Every hop
executed in `answerJourney.test.js` through the real advancer with only the model stubbed.

**Free-text path — breaks at hop 5.**
`commands.answerQuestion` → `recordAnswer` → `runPipeline` → `stepReplan` → `decideAnswer` →
`resolveExactCandidate` returns `null` → **`typeof deps.interpretAnswer !== 'function'`** → returns
`{decided:false, reason:'no interpreter is wired into this runtime…'}` → no `shop_decision` row →
`applyDecisionsToPlan` reports the line `unresolved` → `stepPlan` re-opens nothing (round 1 already
exists, `ON CONFLICT DO NOTHING`) → `openQuestions === 0`, `unresolvedLines === 1` → **park at
`wait:line_resolution`, no transition, no event, no card, on every pass, forever.**

`deps.interpretAnswer` is reached **only** by a test calling it through `depsOverride`. Per contract,
it is therefore **not on the production journey**, and this receipt records it as such.

**Second production recomputation** — `stepRecordConfirmation` → `planWithDecisions` — is genuinely
wired and enumerated. That half of AC5 is real.

## Restart and durability

Kill-and-revive is modelled rather than executed (no live process was available and none was in
scope). What *is* executed: `answerJourney.test.js` "ONE DECISION PER QUESTION, EVER" re-drives the
entire advancer from durable state as a restarted runner would, and asserts one decision row, the
same `id`, one model call. `runPipeline.test.js:253` proves the park is stable across passes and
writes no transition. `question_round` is read from the database, not counted in process. This is
sufficient for the durability claims the WP actually makes.

## Documentation contradiction scan

- **Larry's declared `DOCUMENT IMPACT`:** `runPipeline.js:570-585` — the 30-line comment asserting
  "the loop closes through the decision log".
- **Verified independently:** corrected in place, with the superseded text quoted and the real
  mechanism named. Correct, and revert-proof in the sense the contract asks for — a future editor
  cannot innocently restore it, because the *reason* is recorded beside it.
- **What his list missed (the point of this control):**
  1. **F-5** — the identical false claim survives at `runPipeline.test.js:1023-1024` ("*The loop
     closes here*"), sitting directly above `assert.equal(logged.applies_going_forward, false)`,
     the exact literal that makes it false. The file was edited by this WP; the defect class was
     not closed, only its named instance.
  2. `runPipeline.js:69/73`'s doc-comment asserts *"`runPipeline.test.js` asserts on this module's
     source that no other `deps.planBasket(` call site exists."* **The assertion is real but lives
     in `decisionSpine.test.js`, not `runPipeline.test.js`.** Wrong file named; harmless, but it is
     a comment describing a control, which is the category this WP exists to distrust.
- **Active documents that would misdirect a fresh instance:** none found within the reviewed
  surface beyond the two above.
- **Closure claims since the last receipt, and the receipt behind each:** none. No document at
  `2d84dd1` claims WP-B15-2 complete, closed or accepted. `Builds/BUILD-015-…/Assurance/`
  contains no prior WP-B15-2 receipt. **No suppressed receipt detected.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1** | **HIGH** | `deps.interpretAnswer` has **no production binding**. `deps.js` wires the photo interpreter, catalogue, planner, learning and database — not the answer interpreter. The seam is built, bounded and tested; the provider is absent. Blocks the exact next action of **claiming WP-B15-2 delivers its outcome**, and blocks Gate 1 PASS. | **blocking** | Larry (dispatch) |
| **D-2** | **HIGH** | The `wait:line_resolution` park is **silent** — no outbox message, no card, no event. It is the guaranteed production destination of every free-text answer while D-1 stands, and it re-creates shop 6's live failure shape that WP-B15-1 removed for the sibling park. Violates root `CLAUDE.md` §"Nothing may live only in Larry's head" — *"failure must never be silent."* Blocks the same action as D-1. | **blocking** | Larry (dispatch) |
| **D-3** | MEDIUM | `stepRecordConfirmation` now receives `priorAnswers`, which it never did. This is a **second, unrequested live behaviour change** riding on the AC5 refactor — see the plain answer below. No test covers it. | non-blocking | Larry (decision) |
| **F-4** | LOW | From **round 3 onward**, `lineByKey` (keyed on round-1 keys) cannot match `held.question_key` (the highest-round key), so `planCandidates` receives a stub with no `alternatives` and the clarification card is degraded. Reachable only on a chain of three or more rounds. | non-blocking | Larry (park) |
| **F-5** | LOW | `runPipeline.test.js:1023-1024` still asserts "*The loop closes here*" — the same false claim AC8 removed from `runPipeline.js`, one file over, in a file this WP edited. | non-blocking | Larry (park) |
| **F-6** | LOW | `runPipeline.js:69/73` names the wrong test file for the enumeration control (`runPipeline.test.js`; it is in `decisionSpine.test.js`). | non-blocking | Larry (park) |
| **R-1** | — | Carried, correctly, from the dispatch and confirmed true by execution: `shopLines.markCorrected` still has **zero production callers**; `asdair.shop_decision` is **absent from migration 012's grant matrix** (017 records this itself and does not amend 012); `shopStore.js` browser-request claim remains lease-less and unfenced (Lane C3 surface). **Not closed by this receipt.** | non-blocking | Larry (park) |
| **R-2** | — | Migration 017 has **never been executed against any Postgres**. Idempotency and FK-target acceptance are reasoned and text-asserted only. `fakePg` is not Postgres. Live acceptance is not claimed. **These limits are the builder's own, stated honestly, and they are upheld — not discharged — by this receipt.** | non-blocking | Warwick (live authority) |

## The three things Larry asked me to answer plainly

**1. Did you widen the WP under cover of an acceptance criterion?**

**Half yes, and the half that matters is the half you did not name.**

Passing `priorAnswers` into `stepRecordConfirmation` **is** correctly justified by AC5 — that site
is a production recomputation on the shopping journey, AC5 says *every* one of them, and making the
two sites plan from the same inputs is the criterion, not creep. Your reasoning holds.

But `priorAnswers` is **not** a structured decision. The builder's own module comment says so:
*"This is the FORWARD-LEARNING channel (`asdair.rule_qa_log`) and it is NOT how a current-shop
decision travels … Lane B owns it."* And the order explicitly parks Lane B: *"prior-answer
cross-week consumption — Lane B, parked by Warwick."* So the `priorAnswers` half is a change to a
**parked lane's input at a production site**, made as a side effect of factoring both sites through
one function.

Is it inert? **No.** `eligiblePriorAnswers` admits only `applies_going_forward === true`, and the
pipeline writer always writes `false` — but `skill/ruleConsumption.test.js` models live standing
rows (*"Warwick read the live rows in full on 2026-08-04"*), so real `true` rows exist. The
reconciliation plan will therefore differ from what it was before this WP, on live shops, and **no
test asserts it**. The direction is almost certainly corrective — the two sites disagreeing was
itself the latent defect. But it is an unproven live change in a parked lane, made under an AC that
did not ask for it. That is worth one sentence to Warwick, not a Work Order.

**2. Are there other seams where the parts are proven and the wiring is not?**

**Yes — and the biggest one is the same class of defect as the bug you found, at the other end of
the same feature.** `deps.interpretAnswer` is a consumer with no provider: eight tests exercise it
through `depsOverride`, one asserts it is *not* called, and nothing in production supplies it. That
is `buildAnswerLearning`/`recordAnswerLearning` again — complete, tested, uncalled — reappearing
inside the Work Package commissioned to remove it. I found no third instance; the plan-recomputation
seam, the question-writer seam and the round-key seam are all genuinely wired and mutation-proven,
and the round-3 chain (F-4) is a degradation, not a break.

**3. Does a mutation demonstration prove less than it appears to?**

**No — these five are unusually good, and I verified them rather than reading about them.** Each
was applied and reverted inside the export, and the export was proven byte-identical to `2d84dd1`
afterwards. I additionally ran the *converse* mutations the builder did not: disabling each of the
two comment-strippers, and adding a **genuine** second `planBasket` call site. Both controls now
discriminate prose from code in both directions. The self-correction Larry flagged as a worry is,
on the evidence, the opposite — a control that failed loudly, was fixed, and now measures what it
claims.

What the mutations **cannot** prove, and must not be read as proving: any of them are executed
against `fakePg` and stubs. `M-C` proves the *text* of 017 carries its guards. It does not prove
017 applies, is idempotent, or that Postgres accepts the composite FK against a bare unique index.
That distinction is the builder's own stated limit and it survives this review intact.

## Verdict

**HOLD** — the decision spine is genuinely built, genuinely wired at both plan recomputations, and
better test-controlled than anything else I have reviewed on this build; but the promised outcome
cannot occur in production for the natural-language half, because the interpreter it depends on has
no production binding and the state it falls into is silent.

**On where the fault lies.** Larry is right that this is a defect in the *order*, not in the
builder's work: AC3's evidence clause asked for a stub at the dep boundary and the builder delivered
exactly that, said so plainly in the test file's own header, and flagged nothing false. I have
graded AC3 HOLD on the criterion's own subject — *"free text **is** interpreted by bounded Terra"* —
not on the evidence clause, which is met.

**And to answer the question in the words Larry asked for:** **Gate 1 does not pass on the ACs, and
the WP is also not the product boundary Larry claimed.** Both are true, and they are separate
failures. Five of eight criteria pass on their own terms. Three do not, and the three that do not
are the three the outcome sentence actually runs through.

**Effect on the queue** (root `CLAUDE.md` §Finding disposition): this HOLD gates the completion
claim, closure, Gate 2, PASS and merge **for WP-B15-2 only**. It does not block unrelated safe work
on the active route, and it does not transfer the frontier to Veritas. **Codex is prohibited** on
this boundary until Gate 1 PASS. Corrective dispatch is owed for **D-1 and D-2 only**; D-3 and
F-4/F-5/F-6 are parked to the scheduled reconciliation and must not become Work Orders.

## Next review trigger

A production binding for `deps.interpretAnswer` — or Warwick's explicit reclassification of the
free-text half as deferred/manual — **and** observability on the `wait:line_resolution` park. Then
**ONE focused confirmation of those two findings**, not a re-review of the package. A receipt,
documentation or clerical commit is not a trigger, and a moved HEAD is not a new scope.
