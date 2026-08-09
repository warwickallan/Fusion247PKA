---
build: BUILD-015
scope: WP-B15-2 — FOCUSED CONFIRMATION of the held AC3 finding only
gate: 1
kind: focused confirmation (successor to veritas-wp-b15-2-confirmation-cafa340.md). NOT a re-review.

boundary: >
  AC3 of WO-2026-08-09-B15-02, as ruled by Warwick (option B, WO-B15-03): free text is interpreted
  by BOUNDED TERRA, and the binding must be evidenced by a test that FAILS if somebody quietly
  switches it back to `reason`. Nothing else at fe56305 was re-reviewed.

reviewed_sha: fe563057f62c3350046a87851059e5a622ccb2d0
governance_sha: d90735046081420e7d97925c55871adeafd7073b
branch: build-015/wp-b15-2
remote_reachable: true   # git ls-remote origin -> refs/heads/build-015/wp-b15-2 = fe56305

evidence_method: export (git archive of fe56305) + read-only inspection of the canonical repository
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\8461a9fd-ca53-4a78-af8e-5cefa89d2ee0\scratchpad\vx-ac3
worktree_head_at_start: a76cfabfc78d024ef9549ac3017bb34ec06dc4d2
worktree_head_at_end: 5c9e41124f55ca5dcdbbc1ac856e05f1ac7df4c7
worktree_head_moved_by: Larry, concurrently — NOT by Veritas. No Veritas write touched the repository
                        except this receipt. Every mutation was applied and reverted inside the export,
                        and the export was proven byte-identical to fe56305 afterwards.
worktree_status_clean: true   # empty at end; the only new path is this receipt

verdict: HOLD
ac3_status: NOT DISCHARGED
review_ceiling: 30 minutes (dispatch); not extended
receipt_sha256: 993e547103c191ae2350677db467f56aee91838b12657c2b5c9c8f08bf8bd061
reviewed_by: veritas
reviewed_date: 2026-08-09
next_review_trigger: >
  The discriminating test made to assert ABSENCE of any non-Terra model call in the interpreter
  body, not merely presence of one Terra call. ONE focused confirmation of that. A moved HEAD,
  a receipt or a documentation commit is not a trigger.
---

## Verdict first

**AC3 is NOT discharged.** You asked me to run the aliased mutation and said plainly: *"If a second
disguise still slips through, this is not discharged. It is the whole acceptance property."*

**A second disguise slipped through. The suite stayed 290/290 green with the live interpretation
call rebound to `reason`.**

The Terra binding itself is correct, well-reasoned and honestly documented. The **evidence that it
cannot be switched back** — which is the acceptance property Warwick actually ruled on — does not
yet hold.

## The mutation you asked for: reproduced. **RED, as claimed.**

```
MUT-A  const { reason: answer, answerModel } = await import('.../models.mjs');
       -> not ok 7 - TERRA: the interpreter imports EXACTLY {answer, answerModel}
       -> 18 tests, 17 pass, 1 fail
```

Keel's claim is true and I verified it by execution, not by reading the assertion. The re-pin to
import-specifier source names does defeat the aliased switch-back.

## The disguise that still gets through — **MUT-B, mine**

```js
// line 405 — LEFT HONEST, so the specifier assertion still passes
const { answer, answerModel } = await import('../../obsidiwikai/src/core/models.mjs');
// line 406 — a SECOND import of the same module
const { reason }              = await import('../../obsidiwikai/src/core/models.mjs');
...
let parsed = await extractJson(await reason(prompt));   // <- the PRIMARY call, rebound
if (...) parsed = await extractJson(await answer(       // <- the retry, left on Terra
```

```
productionWiring.test.js : 18 tests, 18 pass, 0 fail
full pipeline suite      : 290 tests, 290 pass, 0 fail
```

**Every real free-text answer would be interpreted by `fusion.reason` on the first attempt.** Only
the strict-JSON retry — a formatting repair that most answers never reach — would touch Terra. This
is a more plausible switch-back than the aliased one, because it is what a well-meaning edit looks
like: *"reason is fine for the first pass, keep Terra for the retry."*

### Why it gets through — two holes, both in the same test

1. **`.exec()` returns the FIRST match only.** `interpreterBody()` is scanned with a single
   `.exec` for the import line, so a second `await import` of the same module is invisible. The
   honest line at 405 satisfies the assertion; the dishonest line at 406 is never examined.
2. **`assert.match(body, /await answer\(/)` is a PRESENCE check.** It requires *at least one* call
   site to use `answer`. It cannot tell one-of-two from two-of-two, and it says nothing at all
   about what the other call site uses.

**The root cause is a category error, and it is worth naming because it will recur.** Warwick's
requirement — *"would fail if somebody quietly switched this back to `reason`"* — is an **ABSENCE**
property. The test asserts the **presence** of the right thing. Presence of Terra and absence of
`reason` are different claims, and only one of them was written. The predecessor form of this very
test already had the right shape once: `assert.doesNotMatch(body, /lightrag/)`. The re-cut dropped
the absence half and kept only the presence half.

**Not my instruction — Larry dispatches, and I do not prescribe the fix.** But so the correction
can be targeted rather than guessed at: the property that closes both holes is an assertion over
**every** import from that module in the body, plus **absence of any non-Terra model callee**
(`reason(`, `vision(`, `lightrag`) anywhere in it. That is one assertion, not a new mechanism.

## Your three other questions

**1. Is the `gpt-5.6-terra` residual honestly bounded? Yes — and it does not leave AC3 unproven.**

The reasoning in `answerModel()` is the best-argued piece of work in this package. It is correct
that `GET /v1/models` returns alias *names* and never their *targets*, so what `fusion.query` points
at is genuinely unknowable from this repository; that `gpt-5.6-terra` is directly addressable **is**
established by a real recorded probe; and the `fusion.vision`/400 incident in the ledger is the
right precedent, cited for the right reason. Defaulting to the name the probe confirms, overridable
by `FUSION_MODEL_ANSWER`, resolved at call time, is the honest construction — **and I confirmed by
execution that the wire body carries `model: "gpt-5.6-terra"`, with `fetch` captured and no request
leaving the process.**

The remaining residual — *whether `gpt-5.6-terra` on that gateway is the model Warwick means* — is
box configuration outside this repository, is stated rather than asserted, and is bounded correctly.
**It is not what holds AC3.** MUT-B is.

**2. The inverted guarantee: the park still speaks. Confirmed by execution.**

You are right that `answer()` throwing makes D-2 load-bearing where it was not. I drove the throw
shape through the real advancer:

```
decisions written : 0
shop status       : PROCESSING   step: wait:line_resolution
outbox kinds      : ["receipt","plan_ready","lines_unresolved","confirm_interpretation"]
lines_unresolved queued? : TRUE      shop FAILED? : false
```

The throw is caught in `stepReplan`, no decision row is written, the line stays unresolved, the gate
refuses `READY_TO_SHOP`, **and the card is queued.** The shop does not fail.

**This also corrects my own note from the `cafa340` receipt in Keel's favour.** There I found that
the no-gateway path never reached the D-2 park, so D-2 was not the control holding it up. Under
this design it *is* — the throw produces no decision row at all, which routes to the park rather
than to a clarification round. Keel's dependency claim was wrong at `cafa340` and is **right at
`fe56305`**. The record should say so.

**3. The two re-cuts were correct. No guarantee was quietly dropped — the surviving one is stronger.**

The `gatewayConfigured`-precedes-`reason(` ordering assertion asserted that *the caller remembers to
check*. Once the callee throws, the guarantee no longer depends on caller discipline at all, and
keeping the old assertion would have required re-introducing a redundant guard purely to satisfy a
test. Both re-cuts quote their old form and give the reason, which is the standard this estate asks
for. **I would not have accepted the re-cut had it merely deleted the assertions.** It replaced them
with the degradation-chain assertion, which is the stronger claim.

**4. Your `answerModel()`-versus-`ROLE_ALIAS` decision: I agree with you, and I would have ruled the
same way.** Two resolution mechanisms is a real cost and worth recording once. But a static
`ROLE_ALIAS` entry is captured at import, and `interpreted_model` is a **provenance** column — a row
must record the alias that was actually invoked, not one captured at process start. Call-time
resolution is what makes that column true, and truth of the durable record is the whole reason this
Work Package exists. Widening the surface to touch `transcribe/visionRole.test.js`'s `deepEqual`
would also have broken an out-of-surface test to satisfy a preference. **Keeping `answerModel()` was
the right call.** The residual worth one line in the record: `ROLE_ALIAS` no longer enumerates every
role, so a future reader must know to look in two places.

## Evidence executed

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `pipeline && node --test` at `fe56305` | 0 | **290** | 290 pass, 0 fail (was 283) |
| `bot` / `shop` — not re-run (untouched by this delta) | — | — | out of this confirmation's scope |
| **MUT-A** aliased switch-back (`reason: answer`) | — | 18 | **1 RED** — claim verified |
| **MUT-B** second import + primary call rebound to `reason` | — | 18 / 290 | **0 RED. GREEN THROUGHOUT.** The finding. |
| **VX probe** — `answer()` throws, driven through the real advancer | 0 | 1 | park reached, `lines_unresolved` queued, shop not failed |
| `obsidiwikai && node --test` at `fe56305` | — | **42** | **33 pass / 9 fail** |
| ...`models.mjs` reverted to `d907350`, re-run | — | 42 | **33 pass / 9 fail — IDENTICAL** |
| ...restored to `fe56305`, re-run | — | 42 | 33 pass / 9 fail |

**The revert-and-compare holds: the obsidiwikai red is genuinely PRE-EXISTING and is not caused by
this work. Nothing was laundered.** One correction to the record, small but it is an evidence
figure: the dispatch reports **8** failures; the suite reports **9** (42 tests, 33 pass). The pass
count matches; the fail count does not. The conclusion is unaffected — it is identical on both
sides of the revert — but a receipt should carry the number the suite actually printed.

**Not executed, declared:** no gateway was reached and no model was called (the wire-body test
captures `fetch`; I did not lift that). No Postgres. 017 unapplied. The `gpt-5.6-terra` target on
the live gateway is not evidence I hold. Live acceptance is still not claimed.

**Isolation.** All mutations applied and reverted **inside the export only**; export proven
byte-identical to `fe56305` afterwards (`services/asdair` clean; `models.mjs` restored byte-exact via
`git archive` and diffed). The repository working tree was never modified by Veritas. `HEAD` moved
from `a76cfab` to `5c9e411` **during** the review — that was Larry committing concurrently, not
Veritas, and `git status --porcelain` is empty at the end.

## Verdict

**AC3: NOT DISCHARGED. Gate 1 remains HOLD — and does NOT reach PASS.**

To answer the question exactly as you asked it: **no, Gate 1 does not reach PASS at `fe56305`.**

The Terra binding is right. The reasoning behind `answerModel()` is right. The re-cuts are right.
The no-fallback throw is right, and D-2 catches it. **What is not yet true is the one thing Warwick
actually ruled on** — that the binding be evidenced by a test which fails when somebody switches it
back. One switch-back still passes, and it is the more likely of the two.

**One blocking finding, and it is small:** the discriminating test asserts presence where the
acceptance property is absence. Everything else in this delta stands.

**Effect on the queue:** unchanged in shape. Gates completion, closure, Gate 2, PASS and merge for
WP-B15-2 only; Codex remains prohibited. Corrective dispatch is owed for **this one finding**, then
ONE focused confirmation of it. The `ROLE_ALIAS`-no-longer-exhaustive note and the 8-versus-9 count
correction are **reported once and parked** — neither is a Work Order.

## Next review trigger

The discriminating test made to assert absence of any non-Terra model callee in the interpreter
body, over every import from that module. One focused confirmation of that finding.
