# Return — WO-2026-08-10-01 · B15-3 FIX1 · the deferred-clarification card must be sent ONCE

**Keel · Implementation Engineer.** Worktree `C:/Fusion247PKA-b153-int` · branch `b15-3/integration`
· branch point `65efb94`.

---

## WORK ORDER READ-BACK

Returned at the top of this document, per the order's §Sequencing 1 ("state it at the top of your
return and continue; do NOT hold").

**Outcome understood.** A shop parked behind a reading Warwick has not yet confirmed must tell him
*once per held line* that a clarification is owed and has been deferred — and stay quiet after that,
however many planning passes run, across restarts, forever, until something genuinely new happens.
What is broken is **delivery only**: the deferral judgement, the gate that produced it, and the
card's honest "I have not guessed" content are all correct and are not mine to touch. A **new** held
line must still produce a **new** card, because a fix that stops repeats by stopping everything is a
worse defect than the one it replaces.

**Owned files/surfaces.** `services/asdair/pipeline/runPipeline.js` ·
`services/asdair/pipeline/productionWiring.test.js` · `services/asdair/pipeline/runPipeline.test.js`
· `Deliverables/2026-08-10-return-B15-FIX1-clarification-card-loop.md`. I wrote all four and nothing
else. I needed no path outside them.

**Inputs and authorities.** `credential_scope: none` · `live_authority: none` · `network: none` ·
`dependency_policy: no-new-runtime-deps` · **`private_surface: none`** — stated back explicitly: the
secrets store is denied by default, I declared no subtree under `C:/.fusion247/`, and I opened
nothing there. `operational_handoff: none`, so the runbook gate does not apply (this repairs a named
defect inside an already-released service). Git authority is the assignment: commit onto
`b15-3/integration`, **no push, no PR, no `main`, no merge** — and I did none of those.
`schema_decision: n/a`; I made no schema change and needed none.

**Acceptance evidence.** Every command below was run here before I relied on it. The baseline was
taken from each runner's own `# tests / # pass / # fail`, never from an exit code, **before I wrote a
single byte**. AC1's multi-pass test was written first and **executed RED** (5 cards over 6 passes,
running total `0, 1, 2, 3, 4, 5`) before the fix existed.

**Assumptions** — each one a defect in the order, named rather than absorbed. Three, below.

**Contradictions** — three, below. **One is material and changes the fix.**

**Missing requirements.** None that blocked the work.

**Refusal conditions.** None tripped. The order names a real defect, inside a surface I may write,
under standing authorities, with evidence I can execute.

**Verdict: ACCEPT**, with the material contradiction corrected in flight and reported here in full.
I continued rather than held, as the order and the dispatch both directed.

---

## Preflight findings — reality, before implementation

### FINDING 1 — MATERIAL. The order's stated cause is wrong, and it is provably wrong

The order states the cause as established fact and instructs *"do not re-derive it"*:

> *"the volatile `#N` is on the in-memory `held.question_key` and increments every pass … Find where
> that suffix is applied and read WHY before changing anything."*

**There is no such suffix, and there is nowhere to find it.** The `#N` on the live idempotency keys
is the **ledger generation**, appended by `ledgerIdempotencyKey(family, generation)`
(`pipeline/keys.js:152`) inside `store.recordLedgerEntry` — where the generation is
`spentLedgerGenerations(family)`, the count of rows of that family already in a **terminal** status.

Executed, not argued (`node -e` against the real `keys.js`, output verbatim in §Commands):

```
parse of the LIVE key: {"family":"outbox:1:clarification_deferred:SHOP-2026-08-09:clarification_deferred.q8f8d3866","generation":"3"}
family rebuilt from a CLEAN question_key: outbox:1:clarification_deferred:SHOP-2026-08-09:clarification_deferred.q8f8d3866
matches the live family exactly: true
gen 3 rebuilt: true
a # inside question_key THROWS: keys: action key may not contain "#" - it separates a ledger family from its generation
```

The last line is decisive. `ledgerFamilyKey` runs `requireKeyComponent` over every component and
**throws** on a `#`. **Had `held.question_key` carried `#3`, `enqueueMessage` would have thrown and
zero rows would exist. Eighteen rows exist.** The family was constant across all eighteen; only the
generation moved. The order's own two supporting facts were correct — `outboxKeyFor` appends nothing
and `questionKeyFor` never emits a `#` — but the conclusion drawn from them inverted where the
suffix comes from.

**Why this matters rather than being a footnote:** the order routed the fix to *"the key-construction
site, or its source"*. Both are correct as written and neither is the defect. Following the order
literally would have meant hunting a suffix that does not exist, and then — on not finding it —
either "fixing" a key builder that is right, or reaching for `outboxEverQueued`, which is the naive
fix the order's own AC4 exists to catch. **Mutation B in §AC5 shows that naive fix passing AC1 while
silently breaking AC2 and AC4.**

### FINDING 2 — the actual cause, and the house pattern that already solves it

`recordLedgerEntry` mints a **new generation once the previous one is terminal**, by design and
load-bearing: *"ask for the basket again after a pause"* and *"retry a shop that failed twice"* are
the CONSUME contract, and a globally-unique key would silently swallow both (`store.js`, the argument
is written out in full above the function). So the outbox key stopped a duplicate **only while the
card sat unsent**; the moment the card was delivered its generation was spent and the next pass
minted a genuinely new row.

The loop that drove it is exact and is already documented in `stages.js`: with `needs_review` true
and the interpretation unconfirmed, `planOutcome` returns `to: null` — a **park**, which writes no
transition and **re-runs `stepPlan` on the next pass**. One pass per runtime poll, ~65 s. That is the
observed live cadence.

The estate already contains the right guard for exactly this, and I reused it rather than inventing
one: `runtime.handbackAlreadySpent` asks `spentLedgerGenerations(family) > 0` **per family**.
`runtime.js:557` states in terms why the obvious alternative is wrong here — *"`outboxEverQueued` is
per-KIND-per-shop … exactly WRONG for questions: one shop holds many, so the first question would
card and every other question would be silently swallowed forever."*

### FINDING 3 — the test trap, one level below the one the order spotted

The order warns that a 2-pass test would pass while broken, and asks for ≥5 passes in a loop. **A
5-pass loop is still not enough on its own.** A pass that queues a row and never **resolves** it
leaves that row PENDING, and `recordLedgerEntry` **adopts** a pending row — so no duplicate ever
appears and the test goes green against the unfixed code. The duplicate exists only once the card has
been **sent**.

Every loop in my tests therefore sends what the pass queued, with the literal call
`runtime.drainOutbox` makes after `bot.send` (`resolveCommand(id, 'done', 'sent')`). This is the
difference between reproducing the defect and passing over it, and it is written into the test file
as a comment so the next reader cannot delete it by accident.

### FINDING 4 — a source-level test with a byte-count window

`productionWiring.test.js:614` sliced `runPipelineSrc` at `indexOf(gate) + 1200` and asserted three
strings inside that window. `1200` is a fact about the length of a **comment**, not about the code:
adding the guard pushed the branch's own `continue` out of the window and failed a test whose
property was completely untouched. I re-cut the window to **the branch itself** (gate marker → the
`const nextRound` where the ordinary round-opening code resumes). Same three assertions, same
strength, no magic number, and it cannot silently swallow the next branch either. **No assertion was
removed, relaxed or widened** — two were added (§AC6).

### FINDING 5 — process contradiction, named rather than resolved silently

Keel critical rule 16 and SOP-022 require the worker to **hold** after the read-back until Larry
answers. The order (§Sequencing 1) and the dispatch both direct me not to hold. I followed the order:
it is the issuer's own written instruction inside the artefact, the contract's carve-out is "or
issued you an amended Work Order", the defect is live, and the runtime is down behind it. Recording
it because a gate waived in a dispatch message is invisible to the next reader.

### Everything else preflight checked, and what held

- All three code paths exist; the worktree is `b15-3/integration` at `65efb94`, clean, and I was its
  only writer throughout (`git status` before and after).
- `65efb94` **descends from** the order's `governance_sha: a2269a1`, and the Keel contract blob is
  **identical at both** (`500c6c5171074c2573f55810f93dc82a5e81508b`) — so the head difference between
  the dispatch and the envelope is not a governance difference. Verified, not assumed.
- The eight suites all run here and report non-zero counts. `node --test` on this Node (v22.18.0)
  would exit 0 on a glob matching nothing; every count below is read from the runner's own
  `# tests / # pass / # fail`.
- `skill` carries exactly its 7 known environment failures, recorded **by name** before and after so
  an eighth cannot hide behind an unchanged total.
- No database connection was opened. No runtime was started. The 18 live rows were not touched.

---

## Status

**COMPLETED** · `work_order_id: WO-2026-08-10-01` · branch `b15-3/integration` · commit SHA in
§Commit below.

## Files touched — every path, exact

| Path | Change |
|---|---|
| `services/asdair/pipeline/runPipeline.js` | the guard, the import, and the comment at the old `:796` rewritten to what is true |
| `services/asdair/pipeline/productionWiring.test.js` | window re-cut to the branch; two assertions **added** |
| `services/asdair/pipeline/runPipeline.test.js` | five new behavioural tests + their fixtures |
| `Deliverables/2026-08-10-return-B15-FIX1-clarification-card-loop.md` | this return |

**Paths outside `file_surface`: 0.** Reconciled by `git diff --stat 65efb94`, which lists exactly the
three code paths (`294 insertions(+), 14 deletions(-)`), plus this document.

## The change, in one paragraph

Before enqueueing a `clarification_deferred` card, `stepPlan` now builds that held line's own ledger
**family** key and asks `store.spentLedgerGenerations` whether a generation of it is already spent.
Spent means the card has had its one life — sent, failed or retired — so the notice is skipped. A
**pending** row is deliberately not counted, because re-enqueueing computes the same family and
`recordLedgerEntry` adopts it: the database closes that window without this code reading first and
writing second. The family carries `held.question_key`, so the property is **once per held line**,
never once per shop. No new dependency, no new helper module, no schema change, no new store
function — `spentLedgerGenerations` was already exported and already used for this exact purpose by
`runtime.handbackAlreadySpent`.

---

## Acceptance criteria

| AC | Met | Evidence |
|---|---|---|
| **AC1** — ≥5 passes in a loop, assert the row COUNT | **MET** | `B15-3 FIX1 / AC1` runs a **6-pass loop**, sending what each pass queued, and asserts `DEFERRED_CARDS(db).length === 1`. Executed **RED first** at `5` cards (`running total per pass: 0, 1, 2, 3, 4, 5`), green after. A second AC1 test proves it across a **process restart** on the same durable database — 5 further passes, still 1 card. |
| **AC2** — two held lines still get two notices | **MET** | `B15-3 FIX1 / AC2`: two unreadable lines (`fruit splits`, `oven gloves` — the live shop-7 line), 6 passes, exactly 2 cards, and the **items are asserted by name**, not just the count. |
| **AC3** — the deferral judgement is UNCHANGED | **MET** | `B15-3 FIX1 / AC3`: zero round-2 questions opened while the reading is unconfirmed; the shop never reaches `READY_TO_SHOP`; the held line is not quietly `matched`; the card still carries the item and the reason. **This test passed on the unfixed code too** — which is the point: it is the control proving the defect was in delivery only. I changed no judgement logic. |
| **AC4** — a genuinely NEW held line still notifies | **MET** | `B15-3 FIX1 / AC4`: first line settles to one card over 5 passes; Warwick then corrects the list with a line the catalogue cannot name; it opens its own round-1 question, he answers it, the interpreter says it needs clarifying — and a **second** card is queued. Both cards asserted by item name, in order. |
| **AC5** — mutation-proved, both directions, byte-identical restore | **MET** | §AC5 below. Both directions RED, sha256 identical before and after. |
| **AC6** — the comment becomes true, or goes | **MET** | §AC6 below. |
| **AC7** — counts, all eight suites, before and after | **MET** | §AC7 below. `skill` shows exactly its 7 pre-existing failures, by name. |

### AC5 — the mutation proof, both directions

The harness lives **outside the repository** (the scratchpad) because a new file inside it would be
outside `file_surface`. It snapshots the source bytes in memory, mutates in place, runs the real
suite, and restores in a `finally`. **It calls no git command** — a `git checkout --` in a mutation
harness silently destroys uncommitted work.

```
source            C:/Fusion247PKA-b153-int/services/asdair/pipeline/runPipeline.js
sha256 BEFORE     0130caf5755adaa3e56a81744633b4a217b32ddbbf68d35b4bb79f06fa0c58e5

── MUTATION A - RESTORE THE PRE-FIX BEHAVIOUR (the guard removed, enqueue unconditional)
   replaced: if ((await store.spentLedgerGenerations(deps, noticeFamily)) === 0) {
   with:     if (true) {
   counts:   # tests 57  # pass 53  # fail 4
   FIX1 tests that went RED (4):
     not ok - B15-3 FIX1 / AC1: SIX planning passes over one stuck shop queue exactly ONE deferred-clarification card
     not ok - B15-3 FIX1 / AC1: the same shop stays quiet across a RESTART, not merely within one process
     not ok - B15-3 FIX1 / AC2: TWO held lines get TWO cards - one per line, not one per shop
     not ok - B15-3 FIX1 / AC4: a genuinely NEW held line still notifies - repeats are suppressed, news is not
   AC1 went RED: YES

── MUTATION B - THE NAIVE FIX (per-KIND-per-shop instead of per-FAMILY)
   replaced: if ((await store.spentLedgerGenerations(deps, noticeFamily)) === 0) {
   with:     if (!(await store.outboxEverQueued(deps, shop.id, 'clarification_deferred'))) {
   counts:   # tests 57  # pass 55  # fail 2
   FIX1 tests that went RED (2):
     not ok - B15-3 FIX1 / AC2: TWO held lines get TWO cards - one per line, not one per shop
     not ok - B15-3 FIX1 / AC4: a genuinely NEW held line still notifies - repeats are suppressed, news is not
   AC4 went RED: YES
   AC2 went RED: YES

sha256 AFTER      0130caf5755adaa3e56a81744633b4a217b32ddbbf68d35b4bb79f06fa0c58e5
byte-identical restore: YES
MUTATION HARNESS EXIT: 0
```

**Mutation B is the one worth reading.** The naive fix — the one a worker reaches for after being
told to hunt a suffix that does not exist — **passes AC1** and silently breaks AC2 and AC4. The
order's AC4 was right to exist, and it earned its place here.

Residue check after the run, because an interrupted mutation leaves the source mutated:
`grep -n 'if (true) {' runPipeline.js` → no match; the guard line is present at `:819`.

### AC6 — the comment at the old `:796`

The old comment claimed a property the code did not have:

> *"IDEMPOTENT BY OUTBOX KEY: one notice per question per shop, however many passes run while the
> reading stays unconfirmed. A stuck shop must not become a stream of identical cards."*

It is **gone**, replaced by what is now true — that the outbox key alone never gave that property,
what `recordLedgerEntry` actually guarantees and why the re-issue behaviour is deliberate, why the
question is asked **per family** rather than per kind, and why a pending row is deliberately not
counted. The eighteen cards are named in it, so the next reader inherits the evidence and not just
the rule.

Two source-level assertions were **added** to `productionWiring.test.js` so the guard cannot be
removed while the behavioural proofs still describe it — the same shape as the `lines_unresolved`
assertion already living beside it, and the second one explicitly forbids the per-KIND form.

### AC7 — counts, all eight suites, before and after

Read from each runner's own `# tests / # pass / # fail`. Never inferred from an exit code. Command
per suite: `cd services/asdair/<suite> && node --test`. Node **v22.18.0**.

| Suite | Before | After |
|---|---|---|
| `pipeline` | 366 / 366 / 0 | **371 / 371 / 0** |
| `handoff` | 114 / 114 / 0 | **114 / 114 / 0** |
| `packet` | 109 / 109 / 0 | **109 / 109 / 0** |
| `browser-runner` | 75 / 75 / 0 | **75 / 75 / 0** |
| `bot` | 165 / 165 / 0 | **165 / 165 / 0** |
| `intake` | 34 / 34 / 0 | **34 / 34 / 0** |
| `reconcile` | 106 / 106 / 0 | **106 / 106 / 0** |
| `skill` | 296 / 287 / **7 fail** / 2 skipped | **296 / 287 / 7 fail / 2 skipped** |

`pipeline` **+5** = the five new tests. No other count moved and no count decreased.

**The seven `skill` failures are the known environment ones, identical BY NAME before and after, and
there is no eighth:**

```
not ok 1   - lastOrder.test.js
not ok 7   - schemaCompat.test.js
not ok 289 - assertSafeDbTarget: accepts local hosts and *_test databases
not ok 290 - assertSafeDbTarget: empty host is local ONLY when PGHOST is unset
not ok 291 - assertSafeDbTarget: refuses live Supabase / pooler hosts
not ok 292 - assertSafeDbTarget: refuses a non-local host that is not a *_test database
not ok 294 - assertSafeDbTarget: refuses empty host when PGHOST is set (finding \#1)
```

---

## Commands executed — verbatim, with exit codes and coverage

| Command | Exit | What it covered |
|---|---|---|
| `node -e "<parse the live idempotency key against the real keys.js>"` | 0 | Finding 1. Executed against `pipeline/keys.js` itself, not against a description of it. |
| `cd services/asdair/<suite> && node --test` × 8, before | — | Baseline by COUNT, before any byte was written. |
| `node --test runPipeline.test.js` (AC1 written, fix absent) | non-zero | **4 fail** — the reproduction. `a stuck shop queued 5 deferred-clarification cards over 6 passes (running total per pass: 0, 1, 2, 3, 4, 5)`. |
| `node --test runPipeline.test.js` (after the fix) | 0 | `# tests 57 / # pass 57 / # fail 0`. |
| `node --test` in `services/asdair/pipeline` | 0 | `# tests 371 / # pass 371 / # fail 0` — the whole suite, all files. |
| `node <scratchpad>/mutate-fix1.mjs` | 0 | AC5, both directions, sha256-verified restore. Output pasted above in full. |
| `cd services/asdair/<suite> && node --test` × 8, after | — | The table above. |
| `node services/asdair/handoff/mutation-proof.js` | 0 | `9/9 guards proven load-bearing.` |
| `bash scripts/secret-scan.sh --surface <the three code paths>` | **0** | `SCANNED 3 file(s) of the named surface, 0 secret value(s) found` — 26 detection classes. Exit 0 = SCANNED and clean, over exactly my declared code surface. |
| `git diff --stat 65efb94` | 0 | Three code paths, all inside `file_surface`. Zero outside. |

**Coverage, stated beside the exit code rather than implied.** The secret scan's exit `0` is evidence
about the three files it enumerated and nothing else; it prints its own uncovered classes, including
a shapeless credential in an ordinarily-named variable. `private_surface` is `none`, so the private-
surface asymmetry does not apply here.

---

## Assumptions — each one a defect in the order

1. **AC5's first direction had to be re-read.** It asks me to *"restore the volatile key"*. There is
   no volatile key (Finding 1), so there is nothing to restore. I read the intent as *restore the
   pre-fix behaviour* and mutated the guard to `if (true)`, which reproduces the exact unguarded
   enqueue that existed at `65efb94`. Mutation A's RED output is the pre-fix behaviour, byte for byte
   in effect.
2. **"Report what else uses it; do not repurpose it"** presumes the suffix is a thing with other
   users. What actually exists is `GENERATION_SEPARATOR = '#'`, and I repurposed nothing. Its users,
   enumerated: `ledgerIdempotencyKey` · `legacyLedgerIdempotencyKey` · `parseLedgerIdempotencyKey` ·
   `requireKeyComponent` (which rejects it inside a component) · and `questionKeyFor`'s hash **input**
   for round > 1 (`${term}#${r}`), where it never reaches the output — `keys.test.js` pins that.
3. **AC7 says "all eight suites" without naming them.** I used the eight from the prior B15 returns
   (`pipeline`, `handoff`, `packet`, `browser-runner`, `bot`, `intake`, `reconcile`, `skill`), which
   matches the `skill`-carries-7-failures instruction. The `pipeline` baseline is **366**, not the
   344 recorded in the R4 return — later Work Packages added tests; I re-measured rather than
   inheriting.

---

## Out-of-scope findings — REPORTED, never fixed

1. **`messageForTransition`'s cards carry the same latent shape.** `plan_ready`,
   `confirmation_received`, `progress` and `reconciliation_summary` (`runPipeline.js:2053–2078`) are
   enqueued on a transition with no spent-generation guard, and their families are per-transition. A
   shop that legitimately re-enters `NEEDS_DECISION` — the ordinary answer → replan → NEEDS_DECISION
   cycle, once per question round — will queue a fresh `plan_ready` card each time.
   **Severity: LOW-MEDIUM, and honestly not the same defect.** Each repeat is driven by a human
   action, so it is news rather than a loop; it cannot run away the way this one did. `runtime.js:545`
   already flags the class in prose. Worth a decision, not a rescue.
   **The `failure` card at `:2013` is the same shape and I would leave it alone** — a shop that fails
   twice should say so twice.
2. **`productionWiring.test.js`'s remaining byte-count windows.** Other tests in that file slice the
   source by a fixed offset. They are fragile in exactly the way Finding 4 demonstrated: a comment
   edit fails a test whose property is untouched. **Severity: LOW.** Not fixed — outside this order's
   named defect, and a sweeping edit of that file would be scope expansion.
3. **The order's `capability_evidence` is load-bearing and was wrong in its conclusion.** The block
   asserted a cause as live-verified fact and told the worker not to re-derive it. The observations
   in it were sound; the inference from them was not. **Severity: MEDIUM, process.** It is a Work
   Order construction observation for Larry, not work.

## Not verified / known limitations — what a reviewer must still check

- **Everything here is offline builder evidence.** The pipeline suite runs against `test/fakePg.js`,
  an in-memory database carrying the real unique indexes. It models migration 009's TOTAL unique
  index and the spent-generation count query, and `recordLedgerEntry` is the real function — but it
  is a model, not Postgres. **The fix is not proven against the live database.**
- **The live shop 7 is not repaired by this change and I did not touch it.** The 18 sent rows remain
  as evidence, as the order requires. Whether the still-stuck shop needs anything beyond a restart is
  a question this Work Order did not ask and I have not answered.
- **I did not start the runtime.** No live behaviour was observed; the restart, and any live
  confirmation that the cards have stopped, is Larry's and is outstanding.
- **My tests are untrusted builder evidence by contract**, including the ones that went RED first. A
  reviewer should read the AC4 test hardest: it is the one standing between this fix and a silent
  suppression of real news.
- **No independent review has occurred.** No Veritas gate, no Codex run, no merge.

**Builder self-test evidence — NOT independent review.**
