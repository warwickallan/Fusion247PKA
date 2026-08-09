# RETURN — WO-2026-08-09-05 · Wire the prose rulebook into the production planning path

| | |
|---|---|
| **Status** | **COMPLETED** |
| **Work Order** | `WO-2026-08-09-05` (B15-3 R2, Veritas D1 corrective) |
| **Branch / worktree** | `b15-3/integration` · `C:/Fusion247PKA-b153-int` |
| **Branch point** | `a1499ca47c7aab371a1624cad1bf8847e706236b` |
| **Git endpoint** | commit only — no push, no PR, `main` untouched, no merge, as ordered |
| **Read-back** | Stated, then continued without holding, per Sequencing §1. **Verdict: ACCEPT.** |

**Builder self-test evidence — NOT independent review.**

---

## WORK ORDER READ-BACK

**Outcome understood.** `services/asdair/skill/rulebook.js` is complete, proven to 29/29 with
mutation in both directions, and imported by nothing except its own two test files. This order makes
a real shop reach it: the household's inert judgement rules are handed to Terra as prose on the live
planning path, and the judgement that comes back changes the actual basket, with the rule id
attached. It closes a **code path**, not the outcome — no real shop has run, and nothing here may
read as if one had.

**Owned files/surfaces.** `services/asdair/pipeline/deps.js` · `runPipeline.js` ·
`productionWiring.test.js` · `rulebookWiring.test.js` (new) ·
`Deliverables/2026-08-09-return-B15-R2-wire-the-rulebook.md`. Reconciled against `file_surface`:
identical, five paths, nothing else needed. `services/asdair/skill/**` and `decisionSpine.test.js`
are constraints, not surfaces.

**Inputs and authorities.** R1's return § "AC7 — the interface Larry must wire" (authoritative);
the Gate 1 receipt; `rulebook.js` read, not modified. `credential_scope: none`, `live_authority:
none`, `network: none`, `dependency_policy: no-new-runtime-deps`, **`private_surface: none`** —
stated explicitly: the secrets store is denied by default and this order goes nowhere near it. No
path in `file_surface` is under `C:/.fusion247/`, so the field and the surface agree.

**Acceptance evidence** (each command run *before* being trusted — see Preflight below): the eight
suites by executed count, the two-direction mutation with a byte-identical restore,
`handoff/mutation-proof.js`, and the surface-scoped secret scan.

**Assumptions** (each one a thing the order left me to decide):

1. **Stage order = precedence.** "Immediately after the single `deps.planBasket(` call" puts the
   rulebook *between* the planner and `applyDecisionsToPlan`, so a recorded human answer always
   overrules a model judgement about the same line. Pinned by a test.
2. **`deps.consult` is passed through UNGUARDED.** Where no inert rule speaks, the module never asks
   for it and nothing is spent; where a rule *does* speak and nothing is bound, it throws loudly
   rather than skipping the judgement layer and leaving the shop looking planned. Same choice
   `realLoadPlanningInputs` makes about `priorAnswers`, for the same reason.
3. Fixture rule ids `3701`/`3702` are synthetic and deliberately outside the live corpus range.
4. The two tests that need a post-basket state set the fake DB row's status to `BASKET_READY`
   directly, standing in for the browser runner's leg (a different lane). Everything after that line
   is production code.

**Contradictions.** None that block. One benign provenance mismatch: the dispatch names governance
head `a1499ca`, the order header `459271c`. `git rev-parse` on both yields the **same** Keel contract
blob `500c6c5171074c2573f55810f93dc82a5e81508b`, so the governing bytes are identical.

**Missing requirements.** None. **Refusal conditions.** None tripped. **Verdict: ACCEPT.**

---

## Preflight — what was checked against reality, before anything was written

| Check | Result |
|---|---|
| Every path in `file_surface` exists (bar the two new files) | held |
| The eight baselines in `capability_evidence` | **verified by execution, all eight matched exactly** — pipeline 327, handoff 114, packet 109, browser-runner 75, bot 165, intake 34, reconcile 106, skill 281 run / 272 pass / 7 fail |
| `mutation-proof.js` baseline | `9/9 guards proven load-bearing` |
| `decisionSpine.test.js:70` — one `deps.planBasket(` call site | real, binding, and satisfied by wiring *around* the existing call. That file was not touched. |
| `rulebook.js` `cloneItem` vs `planBasket`'s public item shape | **identical, all 8 fields.** The interface is wireable with no `skill/**` change — no finding against R1. |
| Would wiring break existing suites via the `consult` requirement? | No. `applyRulebook` demands `consult` only when a rule actually speaks; the harness default and the one test supplying `planningInputs` both pass `rules: []`, so grounding is `null` there. Confirmed by the post-change sweep. |
| CRLF | **All four source files are CRLF.** Verified by execution that `'\n}\n'` occurs **0 times** in `runPipeline.js` while `'\r\n}\r\n'` occurs at offset 6909 — see finding 3. All new source-scanning splits on `/\r?\n/`. |

---

## What was built

**`deps.js`** — `realConsultRulebook(grounding)`, bound as `consult` in the real `createDeps()`
beside `interpretAnswer` / `correlateAnswer`. Gateway-only `answer()` (Terra), which throws rather
than falling back to the box; the prompt comes from `buildRulebookPrompt`, never re-composed at the
wire; **no second catch** — `applyRulebook` already owns the failure and makes it visible.

**`runPipeline.js`** — `applyRulebook` imported directly from the real module (pure apart from the
injected callable, exactly like `applyDecisionsToPlan`), and called once, inside `planWithDecisions`,
between the planner and the decisions. That function is the only place a plan is built, so applying
the household's judgement rules is a property of the function rather than a discipline each call site
must remember — the same argument WP-B15-2 made for the decisions.

**Tests** — `productionWiring.test.js` +7 (the chain walk, precedence, the real container, the name
agreement, the Terra absence property, the prompt ownership, the single error layer);
`rulebookWiring.test.js` +10, all driven from `runPipeline(handle, deps)` and **none of them calling
`applyRulebook`**.

---

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| **AC1** chain real, proven from the runtime entry, no test-only hop | **met** | `R2: applyRulebook is REACHED from the runtime entry point, with no test-only hop` walks four hops from disk — `runtime.js main() → createDeps()`, `runtime.js → runPipeline({shopId}, deps)`, `runPipeline.js → planWithDecisions`, `planWithDecisions → requireCjs('../skill/rulebook.js') + await applyRulebook({` — asserts each hop file is a production file, and bounds `planWithDecisions` by the **next function declaration** (`/\r?\n(export )?(async )?function /`), not by a line-ending literal |
| **AC2** a discarded rule changes a planned line **through the wired path** | **met** | `AC2 CONTROL` pins the unjudged basket at `expected.total_units = 3`; `AC2` injects only a `deps.consult` judgement built **from the grounding production assembled** and the durable `browser_build_request.progress.handoff.expected.total_units` becomes **4**. `AC2 ATTRIBUTION` reads the finished plan at the production `deps.buildConfirmationPayload` seam: `planned_qty 4`, flags include `rulebook rule 3701` and `quantity set by household rule`, note reads `rule 3701 set the quantity to 4`, `summary.rulebook.applied` records `[3701, 3, 4]` |
| **AC3** `deps.consult` bound in the **real** `createDeps()` | **met** | `R2: the REAL production container supplies a callable consult` calls `createDeps()` with no overrides. Mutation-proved: commenting the binding out turns it **RED** (with the pre-existing general D-1 test), while `rulebookWiring.test.js` stays green — which is exactly why the real-container test has to exist |
| **AC4** the no-rules path costs nothing | **met** | Two tests, both counting calls: no rules at all → `consult` called **0** times across the whole journey; an inert rule about washing powder over a basket of cat food → **0**. Plus `COST:` — a **parked** shop consults **0** however many times the loop looks at it |
| **AC5** mutation-proved, both directions | **met** | Below |
| **AC6** no count goes down; pipeline ≥ 327 | **met** | Below. Pipeline **327 → 344** |
| **AC7** nothing else weakens | **met** | `9/9 guards proven load-bearing`; `skill` shows the same **7** environment failures, no eighth, and the same 2 skipped |

---

## Executed evidence

### AC6 — all eight suites, by executed count, before and after

| Suite | Before | After |
|---|---|---|
| `pipeline` | 327 run / 327 pass / 0 fail | **344 run / 344 pass / 0 fail** |
| `handoff` | 114 / 114 / 0 | 114 / 114 / 0 |
| `packet` | 109 / 109 / 0 | 109 / 109 / 0 |
| `browser-runner` | 75 / 75 / 0 | 75 / 75 / 0 |
| `bot` | 165 / 165 / 0 | 165 / 165 / 0 |
| `intake` | 34 / 34 / 0 | 34 / 34 / 0 |
| `reconcile` | 106 / 106 / 0 | 106 / 106 / 0 |
| `skill` | 281 run / 272 pass / **7 fail** / 2 skipped | 281 run / 272 pass / **7 fail** / 2 skipped |

Counts read from each runner's own `# tests` / `# pass` / `# fail`, never inferred from an exit code.
`+17` on `pipeline` = `+7` productionWiring, `+10` rulebookWiring. The seven `skill` failures are the
known environment ones (`Cannot find module 'pg'`, `ASDAIR_DB_URL not set`) — named individually and
unchanged: `lastOrder.test.js`, `schemaCompat.test.js`, and five `assertSafeDbTarget` cases.

### AC5 — mutation, both directions

**Direction 1 — sever the call site** (`const { plan: judged } = await applyRulebook({...})` →
`const judged = planned;`). Source mutated via a script that takes a sha256 first and restores in a
`finally`.

```
ORIGINAL sha256 6205a7321d95d5405967fc435dafb92be0b2113d18c107ed8e9dfb4294dc14c8  92629 bytes

===== BEFORE: the wiring is live =====
productionWiring.test.js  exit 0  {"tests":38,"pass":38,"fail":0}
rulebookWiring.test.js    exit 0  {"tests":10,"pass":10,"fail":0}

===== MUTANT: the call site no longer calls applyRulebook =====
productionWiring.test.js  exit 1  {"tests":38,"pass":35,"fail":3}
   RED: R2: applyRulebook is REACHED from the runtime entry point, with no test-only hop
   RED: R2: the PRECEDENCE is planner -> rulebook -> Warwick, so a human answer is never overruled
   RED: R2: the consumer and the provider agree on the NAME, exactly
rulebookWiring.test.js    exit 1  {"tests":10,"pass":2,"fail":8}
   RED: AC2 CONTROL: with no judgement, the basket is exactly what the deterministic planner alone decided
   RED: AC2: a rule the deterministic planner DISCARDS changes a real planned line, all the way to the durable handoff
   RED: AC2 ATTRIBUTION: the changed line carries `rulebook rule <id>` where a production consumer can read it
   RED: COST: one consult per plan recomputation, and a parked shop consults NOTHING
   RED: A consult that THROWS degrades visibly - the shop still completes and nothing is guessed
   RED: An unreadable reply is never read as approval
   RED: A judgement naming a product nobody offered can never buy it - it becomes a question
   RED: A quantity beyond the module bound is refused, and the refusal is recorded

RESTORED sha256 6205a7321d95d5405967fc435dafb92be0b2113d18c107ed8e9dfb4294dc14c8
BYTE-IDENTICAL to the pre-mutation source: YES

===== AFTER: restored, the wiring is live again =====
productionWiring.test.js  exit 0  {"tests":38,"pass":38,"fail":0}
rulebookWiring.test.js    exit 0  {"tests":10,"pass":10,"fail":0}
```

**Direction 2 — unbind `deps.consult`** in the real container.

```
===== MUTANT: nothing binds deps.consult in the REAL container =====
productionWiring.test.js  # tests 38  # pass 35  # fail 3
   RED: D-1: EVERY dep runPipeline consumes is present in the real container
   RED: R2: the REAL production container supplies a callable consult
   RED: R2: the consumer and the provider agree on the NAME, exactly
rulebookWiring.test.js    # tests 10  # pass 10  # fail 0     <-- STAYS GREEN, on purpose

RESTORED deps.js sha256 c9370a03b8a1f17b44dab4e0e50b54a9cae7f95d44cbc3d83ee0360c4f73bcf6  (byte-identical)
===== AFTER: restored ===== productionWiring.test.js  # tests 38  # pass 38  # fail 0
```

`rulebookWiring.test.js` staying green under direction 2 is the D-1 lesson restated: it injects its
own `consult`, so **only** the real-container test can see an unbound dep. That is why AC3 needed its
own assertion and could not ride on the behavioural suite.

**Both source files verified byte-identical to their pre-mutation state**, and `git status` after the
run shows only the four intended paths.

### `handoff/mutation-proof.js`

```
9/9 guards proven load-bearing.
Every two-writers guard was removed on purpose and the break was detected.
```

### Secret scan — surface-scoped, exit 0

```
bash scripts/secret-scan.sh --surface services/asdair/pipeline/deps.js \
  services/asdair/pipeline/runPipeline.js services/asdair/pipeline/productionWiring.test.js \
  services/asdair/pipeline/rulebookWiring.test.js
→ SCANNED 4 file(s) of the named surface, 0 secret value(s) found.   exit 0
```

Re-run after this document existed, over **all five** paths of the declared `file_surface`:

```
… --surface <the four above> Deliverables/2026-08-09-return-B15-R2-wire-the-rulebook.md
→ SCANNED 5 file(s) of the named surface, 0 secret value(s) found.   exit 0
```

**Coverage stated, not implied:** exit `0` here means SCANNED-and-clean over exactly the five
declared paths across 26 detection classes — **not** a repo-wide green borrowed from elsewhere. The
scanner's own stated blind spot — a shapeless credential in an ordinarily-named variable — is
unchanged by this work, and `private_surface` is `none`, so nothing in the estate's private store was
read, written or quoted.

### Scope

`git diff --stat a1499ca` → `deps.js` +55, `productionWiring.test.js` +219, `runPipeline.js` +60/-2,
plus the untracked `rulebookWiring.test.js`. **Paths outside `file_surface`: 0.** No other commit
appeared in this worktree.

---

## ⚠️ NOT PROVEN — read before believing the defect is closed

1. **NO REAL SHOP HAS RUN. The production event has not happened.** Everything above is capability,
   not completed automation. Typed text → Terra interpretation → prose-rule application → durable
   decision/recompute → honest unresolved behaviour has **not** been exercised end to end against the
   real gateway, the real household corpus and the real database. **This order could not close that
   and did not.** The outcome stays on the frontier.
2. **The consumer in every test is a fake.** It answers from the grounding it was handed, which is
   what makes the mutation meaningful — it proves selection, assembly, the call, the safety envelope,
   attribution and every degraded path. **It proves nothing about how well Terra judges household
   prose.** Only a live shop can.
3. **No model call was made.** `answer()` was never invoked; the Terra binding is proven by an
   absence property over the source, exactly as the answer path's is.
4. **AC4's two tests are not severance-sensitive**, by construction — "consult is never called" is
   true with or without the wiring. They are not in the AC5 red list and should not be read as if
   they were.
5. **The seven `skill` failures are environment, not product**, and are unchanged. Not mine, not
   fixed.
6. **Nothing was pushed and no PR exists.** Independent review has not happened.

---

## Out-of-scope findings — REPORTED, never fixed

**1. HIGH — the plan recomputation is no longer deterministic, and `runPipeline.js` still says it
is.** `stepRecordConfirmation`'s own doc comment reads: *"planBasket is pure and deterministic, so
given the same durable inputs it reproduces the same plan — which is exactly what makes recomputation
honest rather than a guess."* With the rulebook inside `planWithDecisions` that sentence is no longer
true: **each recomputation makes a fresh model call.** Measured on a full journey — `stepPlan`,
`buildBrowserHandoff`, `stepRecordConfirmation` = **3 consults** (pinned by the `COST:` test; a parked
shop consults **0**). So the basket a runner was handed and the plan the reconciliation checks it
against **can legitimately disagree**, which is the same class of failure `applyDecisionsToPlan` was
created to remove. This is a consequence of the interface I was told to wire, not a defect in
`rulebook.js`, and it cannot be resolved inside this surface: it needs either the judgement persisted
per shop, or an explicit decision that a re-judged plan is acceptable. **Larry's call.**

**2. MEDIUM — the attribution never reaches the browser handoff.** `packetLinesFromPlan` reads only
`status` and `planned_qty`; the `rulebook rule <id>` flag and the human-readable note are dropped
before the packet is built, so neither the durable handoff row nor a supervised runner can say *why*
the quantity is 4. "Why did it do that" is answerable today only from the confirmation-payload path.

**3. MEDIUM (pre-existing, out of surface) — `decisionSpine.test.js:78` is CRLF-broken.**
`fn.indexOf('\n}\n')` returns `-1` on this CRLF file (verified: `'\n}\n'` occurs **0** times in
`runPipeline.js`), so `body = fn.slice(0, -1)` is the whole remainder and the second assertion —
*"the single planBasket call site is inside `planWithDecisions`"* — currently only means *"somewhere
in `runPipeline.js`"*. **The first assertion (exactly one call site) is unaffected and still fully
binding**, which is why the constraint the order named is real and was satisfied. Not my file; my new
AC1 test asserts the narrower property correctly.

**4. MEDIUM (in surface, deliberately unchanged) — `productionWiring.test.js:425` has the same
defect** in Lane C's `stepQueueBrowserBuild` slice. Its current effect makes one assertion stricter
than intended and two weaker; it passes today. I did not touch it: no AC requires it, and narrowing
the slice would change what Lane C's proof means. That is a decision, not a repair.

**5. LOW — `deps.consult` is a generic name** in a container whose other members are intent-named
(`interpretAnswer`, `correlateAnswer`, `loadPlanningInputs`). The order and R1 both fix the name, so I
used it; `consultRulebook` would be self-describing.

**6. LOW — no strict-JSON retry on the rulebook consult.** `realInterpretPhoto`,
`realInterpretAnswer` and `realCorrelateAnswer` each allow exactly one, as a formatting repair. The
order specified the one-liner exactly, so this has none. The degradation is safe — flag plus audit
error, nothing guessed — so it costs a lost judgement, never a wrong basket.

---

**Builder self-test evidence — NOT independent review.** Nothing here is acceptance,
merge-readiness, or a claim that AsdAIr's judgement layer is live.
