---
build: BUILD-015
scope: WP-B15-2 — FOCUSED CONFIRMATION of blocking findings D-1 and D-2 only
gate: 1
kind: focused confirmation (successor to veritas-wp-b15-2-2d84dd1.md). NOT a re-review.

boundary: >
  The two blocking findings of the Gate 1 HOLD at 2d84dd1 —
  D-1 (`deps.interpretAnswer` consumed by runPipeline, bound by nothing in production) and
  D-2 (the `wait:line_resolution` park queues no card, no event, nothing).
  Nothing else at cafa340 was re-reviewed.

reviewed_sha: cafa340f800084a693b7d6dc499875d0823f8d81
governance_sha: d90735046081420e7d97925c55871adeafd7073b
branch: build-015/wp-b15-2
remote_reachable: true   # git ls-remote origin -> refs/heads/build-015/wp-b15-2 = cafa340
predecessor_receipt: Builds/BUILD-015-.../Assurance/veritas-wp-b15-2-2d84dd1.md

evidence_method: export (git archive of cafa340) + read-only inspection of the canonical repository
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\8461a9fd-ca53-4a78-af8e-5cefa89d2ee0\scratchpad\vx-conf
worktree_head_at_start: 53b40ba0c6cd66c70ab32af4c56702f3c9d9621f
worktree_head_at_end: 53b40ba0c6cd66c70ab32af4c56702f3c9d9621f
worktree_status_clean: true   # the only new path is this receipt
review_ceiling: 30 minutes (dispatch); not extended

verdict: HOLD
d1_status: DISCHARGED
d2_status: DISCHARGED
receipt_sha256: 6d5e4339df39a8d475394f9d4631b2cfaaa47bef7de8c80d2bb3603f8483363b
reviewed_by: veritas
reviewed_date: 2026-08-09
next_review_trigger: >
  Warwick's ruling on the model-role substitution, and the durable-record correction that follows
  from it (`interpreted_by`). Nothing else. Not a receipt, documentation or clerical commit.
---

## What this receipt does and does not cover

**Covers:** D-1 and D-2, and only those. Both are **DISCHARGED**.

**Does not cover:** commit `cafa340` itself ("bigint-as-string audited and PINNED; 017 carries the
F2 precondition") is product change **outside** D-1 and D-2. I did not review it and this receipt
says nothing about it — silence here must not be read as assurance. D-3, F-4, F-5, F-6 and R-1
remain parked exactly as the predecessor receipt left them; `shopLines.markCorrected` still has
zero production callers at `cafa340`, confirmed by execution.

## D-1 — the interpreter is bound. **DISCHARGED.**

The finding was: *"a consumer with no provider."* It is closed, and closed at the right layer.

| Check | Result |
|---|---|
| `createDeps()` supplies `interpretAnswer` | `deps.js:559` — `interpretAnswer: realInterpretAnswer`. Verified in the real container, not from the diff. |
| Reached through the shared gateway | `import('../../obsidiwikai/src/core/models.mjs')` — same module the photo interpreter uses. No second credential path; no `process.env` key read; no hand-built auth header. |
| Refuses to guess | Every degraded return funnels through one `unreadable()` helper → `clarification_required`. Unparseable return, unknown kind, and **an id the model was never shown** all land there. |
| Grounding is enforced, not requested | `allowedIds` is built from the candidates and regulars actually supplied; `allowedIds.has(id)` rejects anything else **before** the row is built — a third guard behind `buildDecision` and the real FK. |
| Mutation **N1** — unbind `interpretAnswer` in `createDeps()` | **3 RED** in `productionWiring.test.js`, reproducing D-1 exactly. Restored → green. |

`node --test` re-executed by me at `cafa340`: **pipeline 283 / bot 156 / shop 91, zero failures.**

### The role deviation — my answer to the question you asked

You asked plainly whether D-1 counts as discharged when the seam is bound to a different model role
than the ruling named. **Yes. D-1 is discharged.** My finding was about a missing provider, and the
provider now exists, is real, is grounded and refuses to guess. The role is a **separate question**,
and you are right to put it to Warwick rather than settle it yourself.

I verified your claim independently rather than adopting it: `models.mjs` exports `reason`, `vision`,
`gatewayConfigured`, `visionConfigured` and the `ROLE_ALIAS` map. **There is no exported `query`
callable** — `query` exists only as a key inside `ROLE_ALIAS`. Your grep was right. I also found
harder evidence than either of us had: `Builds/BUILD-015-.../DEFECT-LEDGER.md:69` records the
gateway's actual model list, and it registers `fusion.reason`, `fusion.query` **and**
`gpt-5.6-terra` as **three separate aliases**. So `reason` is definitively not Terra — this is now
established from the estate's own evidence, not inferred.

**But there is a second half of this that your dispatch did not name, and it is the sharper one.**

`runPipeline.js:899` and `:911` hard-code **`interpreted_by: 'terra'`** on every model-interpreted
decision. So each row will now durably record:

```
interpreted_by    = 'terra'                              <- false
interpreted_model = 'fusion-gateway:reason:fusion.reason' <- true
```

The `deps.js` comment says *"the decision row says what actually answered."* Half of it does. The
other half asserts Terra interpreted a decision Terra did not make, in the audit column, on every
free-text answer. This is **pre-existing** — the literal was there at `2d84dd1` — but it was
unreachable then, because nothing was bound. **D-1's fix is what makes it start writing.**

It is not a one-line fix: `017`'s `shop_decision_interpreter_known` CHECK constrains
`interpreted_by` to `('terra','human','rule')`, so the vocabulary itself hard-codes the assumption.
Whatever Warwick rules on the role, the record must follow it. That is the same decision, not a
second one.

## D-2 — the park speaks. **DISCHARGED.**

| Check | Result |
|---|---|
| A card is queued on the park branch | `runPipeline.js:523` — gated on `gate.step === STEPS.AWAIT_LINE_RESOLUTION`, so it cannot fire on an unrelated pass. |
| Once ever, self-healing | `outboxEverQueued` over the full outbox history; a shop already parked before this shipped gets its card on the next pass, because every pass over a parked `PROCESSING` shop re-runs `stepPlan`. Same proven shape as the confirmation card. |
| Card and reason cannot disagree | The payload is built from the **same `unresolved` set the gate computed**. This is the right construction and it is the reason I am not asking for more evidence here. |
| It can actually be sent | `MESSAGES.lines_unresolved` exists; the card names the stuck items, distinguishes "never answered" from "answered but unreadable", states plainly that **nothing has been ordered**, and offers an action. |
| Mutation **N2** — delete the renderer from `MESSAGES` | **2 RED.** |
| Mutation **N3** — remove the enqueue block entirely | **4 RED**, including two *journey* assertions, not only structural ones. Restored → 283 green. |

### Your question 2 — "verify that dependency actually holds." **It does not hold as stated.**

This is the finding of this confirmation, and it is worth the dispatch on its own.

Keel says the `!gatewayConfigured → clarification_required` fallback *"is only safe because of D-2 —
a shop that cannot interpret can now say so."* I drove that exact shape through the real advancer
(`decision_kind: 'clarification_required'` with the no-gateway reason). Observed:

```
shop status      : NEEDS_DECISION        (not the D-2 park)
questions        : 2   rounds [1, 2]     (a real clarification round opened)
lines_unresolved card queued? : FALSE
```

**A shop that cannot interpret never reaches `AWAIT_LINE_RESOLUTION`.** A `clarification_required`
decision opens a genuine round-2 question, `countOpenQuestions` becomes non-zero, and `planOutcome`
takes its ordinary `NEEDS_DECISION` branch. D-2's card is gated on the park and therefore **never
fires on this path**.

What actually makes the degraded path visible is **`runtime.js queueShopCards` (line ~497)**, which
queues a `question` card for every open question with no `card_message_id` — an older mechanism,
untouched by this work. *(My probe showed zero question cards because it drives `runPipeline` only,
not `runtime.js`. That is a harness artefact and I am not reporting it as a defect.)*

**So: the closure is real, and the reasoning behind it is wrong.** Direction of the error matters —
it is the dangerous one. If `queueShopCards` ever stopped covering clarification rounds, the
degraded no-gateway path would go silent and **D-2 would not catch it**, because D-2 sits on a
branch that path never visits. The safety net Keel believes is underneath this decision is
somewhere else. The decision to refuse the LightRAG substitute is still correct — it is just not
D-2 that makes it safe.

### Your question 3 — the mutation that did not bite. **Genuinely doubly protected. Neither is illusory.**

`migration 009` line 49 creates `pipeline_command_idem_uniq` as a **TOTAL** unique index on
`idempotency_key` (migration 006's was partial; 009 made it total), and `INSERT_LEDGER_SQL` is
`ON CONFLICT (idempotency_key) DO NOTHING`. `outboxKeyFor(shop_ref, 'lines_unresolved')` is
deterministic and stable for the life of the shop. So once-ever is enforced **by a real migration
in the database**, not by `fakePg` modelling one — I checked the migration, not the fake.

`outboxEverQueued` is therefore defence in depth, and the database is the stronger of the two.
**Keel reporting three-of-four rather than presenting four-of-four is the correct call, and the
result is better than four would have been:** a mutation that fails to bite *because a stronger
guarantee absorbed it* is evidence about where the real protection lives. That is worth more than
a clean sweep. Note only that the surviving guard is pinned by a *structural* test asserting source
shape — the weaker of the pair — so if the guard is ever removed deliberately, the structural test
is the one that must be updated honestly rather than deleted.

## The two general-form controls — do they close the class?

**They close their two instances and one narrow subclass each. They do not close the class, and the
proof is in the same package.**

- **`markCorrected` still has zero production callers at `cafa340`** — I re-ran the grep. The suite
  is **283 green** with a named, still-open instance of "complete, tested, unwired" sitting inside
  the very file that cites it. The `deps.*` control cannot see it, because `markCorrected` is
  `shopLines.markCorrected`, not a `deps` consumption. Nor would it have caught
  `buildAnswerLearning`, `recordAnswerLearning` or `sendQuestionCard` — none of those were
  `deps.*` failures either. **All four of the header's own cited examples are outside the control's
  reach.**
- **Scope:** the `deps.*` scan reads `runPipeline.js` only. `shopDecisions.js` and `store.js` also
  take `deps`; a future unwired seam consumed from either is invisible. Destructuring
  (`const { x } = deps`) and `deps[name]` are also invisible — no instance today, verified.
- **The renderer control** is the better of the two: a closed loop between two enumerable sets, and
  the `store.enqueueMessage(` scoping is a genuine improvement over a bare `kind:` scan. But it also
  reads `runPipeline.js` only, while **`runtime.js:509` and `:577` queue `question` and
  `basket_ready`** outside its view. Both happen to have renderers, so there is no live gap — the
  claim *"every kind the pipeline queues"* is simply wider than the control's coverage.

**What I would say honestly in the record:** these are two good, mutation-proven controls that make
*their* failure mode structurally visible. Neither is the general form of "complete, tested,
unwired," and the record should not say they are. **This is an observation, not a request for more
machinery** — the regrowth cap applies, and I am not asking for a third control.

## Evidence executed

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `pipeline && node --test` at `cafa340` | 0 | **283** | 283 pass, 0 fail (was 264) |
| `bot && node --test` | 0 | 156 | 156 pass, 0 fail |
| `shop && node --test` | 0 | 91 | 91 pass, 0 fail |
| **N1** unbind `interpretAnswer` | — | 11 | 3 RED — D-1 reproduced exactly |
| **N2** delete `lines_unresolved` renderer | — | 11 | 2 RED |
| **N3** remove the park's enqueue block | — | 283 | 4 RED (2 structural, 2 journey) |
| **VX probe Q2** — no-gateway degraded shape through the real advancer | 0 | 2 | `NEEDS_DECISION`, round-2 question opened, `lines_unresolved` **not** queued |
| `grep` `models.mjs` exports / `markCorrected` / `enqueueMessage` callers / migration 009 | 0 | — | as reported above |

Export proven against `cafa340`; all three mutations applied and reverted **inside the export
only**; repository `HEAD` `53b40ba` and `git status --porcelain` identical at start and end.

**Not executed, declared:** no model was called, no gateway was reached, no Postgres was touched.
017 remains unapplied here; the PostgreSQL 17.4 result Larry reports is not evidence I hold, and
CI-runs-16 is inference, not execution. Live acceptance is still not claimed.

## Verdict

**D-1 DISCHARGED. D-2 DISCHARGED.** Both blocking findings from the `2d84dd1` HOLD are closed, at
the right layer, with controls I mutation-tested myself.

**Gate 1 remains HOLD — on AC3 alone, and no longer for an engineering reason.**

What is left is one product decision and the record correction that follows it: AC3's accepted words
name **Terra**; the bound role is **`reason`**; and `interpreted_by` will durably assert `'terra'`
on every model-interpreted decision regardless. **That is Warwick's call, exactly as Larry routed
it, and it is not Veritas's to settle.** AC6 and AC7 are discharged by these two fixes.

**Effect on the queue:** unchanged in shape. This HOLD gates completion, closure, Gate 2, PASS and
merge for WP-B15-2 only; Codex remains prohibited on this boundary. **No corrective dispatch is
owed** — there is nothing here for an implementer to do until Warwick rules. The Q2 mechanism
correction and the general-form scope notes are **reported once and parked**; they must not become
Work Orders.

## Next review trigger

Warwick's ruling on the model role, plus whatever `interpreted_by` must become to stay true under
it. One focused confirmation of that, if he rules for a change. A moved HEAD is not a new scope.
