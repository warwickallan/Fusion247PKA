# RETURN — WO-2026-08-09-07 · B15-3 R3 · Archive the best-value judgement

**Builder self-test evidence — NOT independent review.**

- **Status:** `COMPLETED`
- **work_order_id:** WO-2026-08-09-07
- **Branch:** `b15-3/integration` · **worktree:** `C:/Fusion247PKA-b153-int`
- **Branch point:** `3b87961` · **commit(s):** see § Commit
- **Governance head named in dispatch:** `3b87961`. `git rev-parse "3b87961:Team/Keel - Implementation Engineer/AGENTS.md"` → `500c6c5171074c2573f55810f93dc82a5e81508b`, the **identical blob** the order's envelope cites at `519a157`. The contract did not move between the two heads.
- **Sole writer check:** every commit on this branch above `3b87961` is mine. Nothing appeared in the worktree that I did not make.

---

## WORK ORDER READ-BACK

*(Returned at the top of this document, per the order's own § Sequencing: "Do NOT hold for my acceptance; state it at the top of your return and continue.")*

```
WORK ORDER READ-BACK

Outcome understood:
  Take the bargain-hunting out of AsdAIr's planning path and leave the rulebook
  smaller. Nothing between a typed list and the browser handoff may reason about
  what things cost: no price-per-wash, no multibuy arithmetic, no cheapest/
  best-value comparison, and no dormant version of any of it behind a flag.
  The rulebook keeps its real remaining job - carrying the household's genuinely
  non-price prose (rotation, out-of-stock meaning, exclusions, aliases, standing
  quantities) to the reasoning consumer - so the three R1 tests that proved the
  archived behaviour are RE-CUT onto that job, not deleted. A control has to fail
  if the arithmetic ever comes back. `runPipeline.js` has to stop claiming a
  determinism it lost the day the rulebook was wired. The rules themselves are
  Warwick's DATA: I write the archival SQL and execute nothing.

Owned files/surfaces:
  services/asdair/skill/rulebook.js
  services/asdair/skill/rulebook.test.js
  services/asdair/skill/README.md
  services/asdair/pipeline/runPipeline.js
  Deliverables/2026-08-09-return-B15-R3-archive-best-value.md   (this file)
  Nothing else. No path outside that list was written.

Inputs and authorities:
  credential_scope: none · live_authority: none · network: none ·
  dependency_policy: no-new-runtime-deps · private_surface: NONE - stated back
  explicitly: this order declares no `C:/.fusion247/` surface, none was touched,
  and the secrets store is denied by default (GL-012).
  operational_handoff: none, so the runbook gate does not apply and I do not
  refuse for a missing runbook_path.
  schema_decision: n/a. Silas is separately deciding the remembered-last-choice
  schema; I have not anticipated, stubbed or hooked for it.
  Git: commit only, on this branch, in this worktree. No push, no PR, no main,
  no merge.

Acceptance evidence (each checked against reality BEFORE building):
  * Eight suites, by executed count, run before I wrote anything - and they
    reproduce Larry's `capability_evidence` baselines exactly (see § Baselines).
  * `rulebook.test.js` really did hold 29 tests, and its three AC3 cases really
    were rules 31, 36 and 37. Verified by reading and by running the file.
  * `node services/asdair/handoff/mutation-proof.js` runs here and reports
    `9/9 guards proven load-bearing`.
  * `bash scripts/secret-scan.sh --surface <the four service paths + this file>`
    runs here in `--surface` mode. Exit `2` would mean NOT SCANNED, never a pass.
  * The AC3 mutation is a real two-direction proof: sha256 first, restore in a
    `finally`, byte-identical check after.

Assumptions (each one a defect in the order, named rather than absorbed):
  1. "Rules 31, 36 and 37 in `asdair.rules`, with the current `status`/`directive`
     values it expects" - `asdair.rules` HAS NO `status` COLUMN. Archival on this
     table is `active = false` (the schema's own comment: "superseded rules are
     set active=false (kept for audit)"). I wrote it that way and say so here.
  2. Rule 31's live existence is NOT established. The only live-verified rule
     list in the repository (`skill/ruleConsumption.test.js:62`, queried
     2026-08-04) contains 12, 25, 32, 36, 37 and 38 - and no 31. R1 recorded 31's
     wording as CONSTRUCTED for the same reason. My SQL is written so a missing
     rule 31 is a visible zero-row result, not an error and not a silent no-op.
  3. AC3 asks the control to be pinned "outside the module under test where you
     reasonably can". The strongest external anchor available inside this
     `file_surface` is `skill/README.md`. It is a sibling document I also wrote,
     not an unwritable external authority like AC6's migration - stated plainly
     rather than dressed up (see § AC3).
  4. "Anywhere `applyRulebook` can reach" - I read this as the rulebook path:
     the packet it assembles, the prompt it renders and the code that does it.
     The planner's own budget estimate and its price-PROXIMITY similarity score
     are neither in this surface nor a bargain judgement; both are reported
     below rather than touched.

Contradictions:
  1. `document_impact: []`, but this order necessarily changes a document
     (`skill/README.md`, in `file_surface`) and makes statements elsewhere stale
     - listed in § Document impact, as observed. Larry's field to own; Veritas
     verifies it at the gate.
  2. Larry's rule-37 call is recorded as his reading rather than Warwick's words,
     and the order invites disagreement. I AGREE WITH IT, and the live text is
     the reason - see § On rule 37.

Missing requirements: none that blocked the work.

Refusal conditions: none tripped. Order was produced on the ordinary generation
  route (the `GENERATED by tools/wo/envelope.mjs` marker is present), every
  mandatory field is populated, both authority fields are `none`, and the
  declared surface is one I may write.

Verdict: ACCEPT
```

---

## Preflight findings — what was checked against reality

| Checked | Result |
|---|---|
| Worktree, branch, head | `C:/Fusion247PKA-b153-int` on `b15-3/integration` at `3b87961`, clean before I started |
| Every `file_surface` path exists | Yes, except this return file, which the order asks me to create |
| Larry's eight baselines | **Reproduced exactly** by execution, not trusted (§ Baselines) |
| `rulebook.test.js` = 29 tests | Confirmed by execution before the change |
| The seven `skill` failures | Confirmed by NAME, not by count: `lastOrder.test.js`, `schemaCompat.test.js`, five `assertSafeDbTarget` cases (`pg` absent / `ASDAIR_DB_URL` unset) |
| `runPipeline.js:1441` | The false sentence is exactly where the order says it is |
| "3 consults on a full journey" | Not taken on trust — asserted by an executed test I read: `pipeline/rulebookWiring.test.js` § COST steps a whole journey to `calls === 3` |
| `asdair.rules` schema | Read from `db/001_asdair_schema.sql`: no `status` column; `active boolean not null default true` is the archive flag |
| Who else consumes the packet | `grounding.lines[].candidates` has **no consumer anywhere in the service** outside `rulebook.js` — grepped. Dropping the price field could not break another module, and did not |
| CRLF hazard named in AC3 | Honoured. Every source scan splits on `/\r?\n/`, and the new control additionally **proves the stripper stripped** before trusting its own result |

Nothing in the preflight blocked the work.

---

## What was actually removed

`rulebook.js` never did price arithmetic itself. It did something more consequential: it **shipped the money to the reasoning consumer and asked it to shop on it.** Three things carried the archived behaviour, and all three are gone:

1. **The packet carried prices.** `buildRulebookGrounding` mapped each candidate to `{ name, price }`. It now maps to `{ name }`. The planner's `price` field is dropped and never forwarded.
2. **The prompt rendered money.** `renderLines` printed `GBP 4.50` per candidate, and `(price unknown)` where it had none. Both are gone — *saying* a price is unknown is still an invitation to shop on it, so it was removed rather than kept as a courtesy.
3. **The prompt asked for a bargain judgement.** It opened by telling the consumer that several rules express a judgement — `"pick the best value"`, `"round it up"`, `"buy up to the offer"` — and listed `a price, an offer, a pack size` as things to ask about. It now says, in as many words, that the consumer is shown no money at all, must not ask for or estimate any, and should answer `ask` where a rule can only be settled by comparing what things cost.

**Nothing is behind a flag.** There is no option, no environment variable and no dormant branch. Re-introducing any of it is a code change that the new control fails — proven three ways in § AC3.

**No rule id is hard-coded anywhere in the module**, before or after. That is why archiving rules 31/36/37 is a DATA change (§ The archival SQL) and never a code change here.

### On rule 37 — I agree with Larry's reading, and the live text is why

The order records rule 37's archival as Larry's judgement, not Warwick's words, and asks me to say if I think it is wrong. **I think it is right.** The live wording (`skill/ruleConsumption.test.js:95-99`, queried 2026-08-04) is:

> *"Sure any 2 for GBP X: round qty UP to an even number to capture every pair; add a FEMALE variant to complete the last pair."*

That rule opens on a multibuy price offer and cannot be evaluated without offer evidence at plan time — which is exactly the evidence Warwick removed from the path. It is a multibuy rule wearing a rounding rule's clothes. Archiving it follows from his own words rather than extending them.

**What that leaves unresolved, and it is his to decide, not mine:** the *non-price* half of Warwick's habit — "we always want an even number of these" — dies with rule 37. If he wants it back it is a new, offer-free rule row, not a code change. Recorded here; not acted on.

---

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| **AC1** — the price/bargain judgement is gone from the rulebook path, not behind a flag | **met** | The three carriers above removed. Comment-stripped `rulebook.js` now contains **zero** occurrences of `price`, `per wash`, `multibuy`, `cheapest`, `best value`. `git diff` shows no flag, no option and no conditional preserving the old path |
| **AC2** — R1's AC3 tests RE-CUT, not deleted; count not below 29 | **met** | `rulebook.test.js` **29 → 31 tests, 31 pass, 0 fail**. Every removed assertion accounted for by name in § AC2 |
| **AC3** — a control that fails if price arithmetic re-enters, mutation-tested both directions, pinned outside the module where reasonable | **met** | Two tests, three independent mutations, all RED, restore byte-identical (§ AC3) |
| **AC4** — `runPipeline.js` stops claiming a determinism it does not have | **met** | § AC4. Comment rewritten; **no behaviour changed**, and nothing anticipates the remembered-last-choice work |
| **AC5** — counts, all eight suites, before and after; `skill` shows exactly its 7 environment failures and no eighth | **met** | § Baselines. No count decreased. `skill` 7 failures, same seven by name, plus the same 2 skipped |
| **AC6** — nothing resurrected to compensate | **met** | § AC6, asserted against my own diff |

---

## Baselines — all eight suites, by executed count, before and after

Counts read from each runner's own `# tests` / `# pass` / `# fail`. **Never inferred from an exit code.**

| Suite | Before (verified, not trusted) | After |
|---|---|---|
| `pipeline` | 344 run / 344 pass / 0 fail | **344 / 344 / 0** |
| `handoff` | 114 / 114 / 0 | **114 / 114 / 0** |
| `packet` | 109 / 109 / 0 | **109 / 109 / 0** |
| `browser-runner` | 75 / 75 / 0 | **75 / 75 / 0** |
| `bot` | 165 / 165 / 0 | **165 / 165 / 0** |
| `intake` | 34 / 34 / 0 | **34 / 34 / 0** |
| `reconcile` | 106 / 106 / 0 | **106 / 106 / 0** |
| `skill` | 281 run / 272 pass / **7 fail** / 2 skipped | **283 run / 274 pass / 7 fail / 2 skipped** |

Command, per suite: `cd services/asdair/<suite> && node --test`. Node **v22.18.0**.

**Every one of Larry's `capability_evidence` baselines reproduced exactly.** Nothing decreased. `skill` **+2** = the two new `ARCHIVED` control tests; `rulebook.test.js` itself went 29 → 31.

The seven `skill` failures are the known environment ones and are the **same seven, by name**, before and after:

```
not ok 1   - lastOrder.test.js                     (Cannot find module 'pg')
not ok 7   - schemaCompat.test.js                  (ASDAIR_DB_URL not set)
not ok 276 - assertSafeDbTarget: accepts local hosts and *_test databases
not ok 277 - assertSafeDbTarget: empty host is local ONLY when PGHOST is unset
not ok 278 - assertSafeDbTarget: refuses live Supabase / pooler hosts
not ok 279 - assertSafeDbTarget: refuses a non-local host that is not a *_test database
not ok 281 - assertSafeDbTarget: refuses empty host when PGHOST is set (finding #1)
```

*(The `not ok` numbers shift by 2 because two tests were added ahead of them in file order. The failing test NAMES are identical. No eighth failure.)*

Also executed, unchanged: `node services/asdair/handoff/mutation-proof.js` → **`9/9 guards proven load-bearing`**, exit 0.

---

## AC2 — every re-cut and every removed assertion, by name

**The three R1 AC3 cases were re-cut mechanism for mechanism**, so nothing the old three exercised lost coverage:

| R1 case (archived) | Mechanism it proved | Re-cut as |
|---|---|---|
| **rule 31** — best value by price per wash | targeted rule → `set_product` on a line the planner held | **rule 41** — *"Shower gel: rotate the scent - never the same one two weeks running."* Rotation names a product on an ambiguous line, attributed |
| **rule 37** — round up to complete a pair | targeted rule → `set_quantity` on a line already being bought | **rule 42** — *"Milk: we get through 2 bottles a week - if the list says fewer, make it 2."* Standing quantity, 1 → 2, attributed |
| **rule 36** — buy up to the multibuy quantity | **basket-scope** rule reaching a line no targeted rule names | **rule 43** — *"Where a line does not say a size, we always want the FAMILY size."* Basket-scope, changes a kitchen-roll line nothing targets, attributed |

The stand-in consumer's three handlers were re-cut with them and still answer **only from the grounding they were given**. They no longer *can* compute a price: there is none in the packet. That is structural, not discipline.

**Assertion accounting — nothing shrank silently.** Final count is **31, up from 29**. Two assertions lost their subject; both were replaced by something stronger, and this is the by-name justification the order requires:

| R1 assertion | Fate | Why |
|---|---|---|
| `AC5: an absent price is SAID, never rendered as GBP 0.00` — asserted the prompt contains `(price unknown)` | **replaced, not deleted** | It has no subject: no price is rendered either way now. Its replacement, `AC5: the packet is IDENTICAL whether or not the catalogue carries prices`, is a **stronger** property — the presence of money in the catalogue makes no difference at all to what the consumer sees. It caught mutation M1 |
| the `washesIn()` price-per-wash helper in the fake consumer | **deleted** | It computed `price / washes`. There is no price in the packet to compute from. Deleting it is the removal working; keeping it would be the dormant path Warwick is trying not to have |

Everything else in the file is preserved: all four AC1 tests, all three AC2 tests, the raw-model-text test, both AC4 attribution tests, all seven AC5 tests, all six SAFETY tests, both AC6 tests, and the REGRESSION test. **Two tests added** (the `ARCHIVED` block). `PRICED_PODS` was deliberately **kept** — the control needs real money to prove is being dropped.

---

## AC3 — the control, and it was made to fail

**Two tests, and the load-bearing one is behavioural.** A source scan says what the module does not *say*; the behavioural test says what it does not *do*, which is the property Warwick actually bought.

1. **`ARCHIVED: a PRICED catalogue still produces a packet and a prompt with no money in it`** — plans the priced Ariel fixture (GBP 4.50 / 9.00 / 16.00), then asserts: the fixture really is still priced (a control that stopped examining its ground would otherwise pass silently); **no key anywhere in the packet** matches `/price|cost|amount|gbp/i`, by recursive walk; **none of the three price values** appears anywhere in the serialised packet; and the rendered prompt contains no `GBP`, no `£`, no money-shaped `\d+\.\d{2}`, no `price`, and no `best value|per wash|multibuy|cheapest`.
2. **`ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins`** — reads the forbidden vocabulary **from `README.md`**, not from a literal in the test and not from the module under test, so widening the code cannot widen its own check. The test's own literal pins README.md in turn, so quietly deleting a token there fails here. **This is AC6's shape**, applied to a different prohibition.

**The CRLF defect named in the order is handled, and then some.** Both scans split on `/\r?\n/`. The new one additionally asserts that a phrase which exists **only inside a comment** is present in the raw file and **absent after stripping** — so if the stripper ever silently no-ops again, the control fails loudly instead of false-positiving. That guard fired for real during development (my first anchor phrase spanned two comment lines), which is the only reason I know it works.

**Mutation, three directions, all RED — and it is the same evidence in both directions:**

```
ORIGINAL rulebook.js sha256 10f223facb2dac01d1931c4ce96dc86f3dbcc7f13c3afdb01a7cd1c0d32c07cc  35571 bytes
ORIGINAL README.md   sha256 9db43f9da770f016e75b78ae2cb7c0c099c34c10dba8645edb37b46d19096719  31547 bytes

===== BEFORE: the prohibition holds =====
exit 0  # tests 31  # pass 31  # fail 0

===== MUTANT M1: candidates carry price again =====
exit 1  # tests 31  # pass 28  # fail 3
   RED: ARCHIVED: a PRICED catalogue still produces a packet and a prompt with no money in it
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins
   RED: AC5: the packet is IDENTICAL whether or not the catalogue carries prices

===== MUTANT M2: dead price-per-wash arithmetic, never sent to the consumer =====
exit 1  # tests 31  # pass 30  # fail 1
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins

===== MUTANT M3: a token quietly deleted from the README pin =====
exit 1  # tests 31  # pass 30  # fail 1
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins

===== RESTORED: the prohibition holds again =====
exit 0  # tests 31  # pass 31  # fail 0

RESTORED rulebook.js sha256 10f223facb2dac01d1931c4ce96dc86f3dbcc7f13c3afdb01a7cd1c0d32c07cc
RESTORED README.md   sha256 9db43f9da770f016e75b78ae2cb7c0c099c34c10dba8645edb37b46d19096719
BYTE-IDENTICAL rulebook.js: YES
BYTE-IDENTICAL README.md  : YES
```

- **M1** reintroduced `price` into the candidate map — the realistic regression. Caught by **both** halves plus the packet-equality test.
- **M2** added price-per-wash arithmetic that **never reaches the packet**. The behavioural test cannot see it; the source scan catches it alone. That is why both halves exist.
- **M3** left the code alone and quietly weakened the **external pin** instead. Caught. The pin is not decorative.

The mutation ran a real script that took the sha256 first and restored in a `finally`; both files are byte-identical afterwards, verified by hash, not by inspection.

**The honest limit of this control:** the README is a sibling document in the same `file_surface`, not an unwritable external authority the way AC6's migration is. Someone editing the module *and* the README *and* the test literal in one change defeats it. It raises the cost of regrowth from an accident to a deliberate, visible, three-file act. It also examines `rulebook.js` **only** — see the reported findings for what lies outside it.

---

## AC4 — the determinism claim

`runPipeline.js` § `stepRecordConfirmation` claimed:

> *"planBasket is pure and deterministic, so given the same durable inputs it reproduces the same plan - which is exactly what makes recomputation honest rather than a guess."*

The first clause is still true; **the conclusion is not.** Since B15-3 wired the rulebook, every plan on this path is built by `planWithDecisions`, which consults a model at each recomputation. The comment now says that, quotes the sentence it replaces so the correction is legible, and states the **narrower** guarantee that is actually true today: the deterministic layer reproduces; Warwick's answers are applied last and always win; an unconfident judgement becomes a visible question rather than a silent substitution, so a divergence is something a person can see and answer.

**No behaviour changed. Not one line of executable code in `runPipeline.js` was touched** — the diff there is comment-only, which `git diff` shows. The comment ends by recording that making a judged choice durable is separate work and is **deliberately not anticipated, stubbed or hooked for here**.

The "3 consults on a full journey" figure is not repeated on trust: `pipeline/rulebookWiring.test.js` § COST steps a whole journey and asserts `calls === 3`, and it is green in the run above.

---

## AC6 — nothing was resurrected to compensate

Asserted against my own diff, path by path:

- **No browser round-trip added.** `browser-runner`, `handoff` and `packet` are untouched; their suites are unchanged at 75 / 114 / 109.
- **No new Terra call.** No new `consult` call site anywhere. `runPipeline.js`'s single `applyRulebook` call is unchanged; the consult count is still exactly 3 per journey, and 0 for a parked shop or a household with no inert rule.
- **No price fetch.** No network call, no new dependency, no new import in any touched file. `dependency_policy: no-new-runtime-deps` honoured — zero packages added.
- The change is a **net removal** in the module: `rulebook.js` code is smaller, the packet is smaller, the prompt is shorter.

---

## The archival SQL — WRITTEN, NOT EXECUTED

**I connected to no database.** `live_authority: none`, `credential_scope: none`. This is text for Larry to run under Warwick's authority. The rules are Warwick's data.

**Read this first — the order's field names do not match the table.** `asdair.rules` has **no `status` column**. Archival on this table is `active = false`; the schema's own comment (`db/001_asdair_schema.sql:97`) reads *"superseded rules are set active=false (kept for audit)"*. Nothing is deleted, so the audit trail survives.

**Expected current values**, from the only live-verified rule list in the repository (`skill/ruleConsumption.test.js:62`, queried 2026-08-04): rules **36 and 37** are `active = true`, `directive = 'info'`, `scope` `global` / `product`. **Rule 31 does not appear in that list** — it may have been renumbered, superseded or already inactive. The statement is written so that is a visible zero-row result rather than an error.

**Step 1 — READ ONLY. Run this first and read what comes back.**

```sql
select id,
       active,
       directive,
       scope,
       match_term,
       match_category,
       left(rule_text, 90) as rule_text
  from asdair.rules
 where id in (31, 36, 37)
    or rule_text ilike '%price per wash%'
    or rule_text ilike '%price-per-wash%'
    or rule_text ilike '%best value%'
    or rule_text ilike '%multibuy%'
    or rule_text ilike '%any 2 for%'
 order by id;
```

The `ilike` arms are there **only** so a renumbered or unknown-id best-value rule shows up rather than being missed. Do not widen step 2 to match them without reading what step 1 returned — an `ilike` sweep is not an archival plan.

**Step 2 — THE ARCHIVAL. Guarded, idempotent, and it tells you what it did.**

```sql
update asdair.rules
   set active = false
 where id in (31, 36, 37)
   and active = true
   and directive = 'info'
returning id, active, directive, scope, match_term, left(rule_text, 90) as rule_text;
```

- **`and active = true`** makes a second run a no-op returning zero rows.
- **`and directive = 'info'`** is a safety guard, not decoration: if any of these ids has since become a `map`, `exclude`, `needs_decision` or `rotate` rule, it is no longer the rule this order is archiving, and it is left alone for a human to look at.
- **Expect 2 rows** (36, 37) if rule 31 is absent or already inactive, **3 rows** if it is live. Any other count means step 1 was not read.
- **No `delete`** — `active = false` is the archive, and the row stays for audit.
- **No `superseded_by`** — nothing replaces these rules. Warwick is the bargain hunter at the ASDA end.
- No constraint is at risk: `rules_directive_check` and `rules_directive_target_check` both key off `directive`, which is unchanged.

**After it runs, one thing goes stale and it is not mine to fix:** `skill/ruleConsumption.test.js` (outside this order's surface) carries the live corpus as a fixture, including rules 36 and 37, and asserts their prose reaches the consumer. That test is **green today and stays green** — it is a fixture, not a live query — but it will then describe an archived corpus. Reported below.

---

## Files touched

| Path | In `file_surface` | What changed |
|---|---|---|
| `services/asdair/skill/rulebook.js` | yes | Price dropped from the packet, money removed from the rendered lines, the prompt no longer invites a value judgement; header rewritten to record the archive |
| `services/asdair/skill/rulebook.test.js` | yes | Three AC3 cases re-cut onto non-price rules; the `ARCHIVED` control added; 29 → 31 tests |
| `services/asdair/skill/README.md` | yes | New § *The best-value judgement is ARCHIVED*, carrying the vocabulary pin the control reads; the stale "Prices" bullet removed; a note under the WO-Y table |
| `services/asdair/pipeline/runPipeline.js` | yes | **Comment only.** AC4 |
| `Deliverables/2026-08-09-return-B15-R3-archive-best-value.md` | yes | This file |

**Paths written outside `file_surface`: 0.** Reconciled by `git diff --stat` against the branch point `3b87961` — four modified files plus this one, and nothing else.

---

## Commands executed

| Command | Exit | What it covered |
|---|---|---|
| `cd services/asdair/<suite> && node --test` × 8, before and after | 0 (7 pre-existing env failures in `skill`) | 1228 executed tests after the change, counted from each runner's own `# tests`. Not one count inferred from an exit code |
| `node --test rulebook.test.js` | 0 | **31 executed, 31 pass, 0 fail** |
| `node services/asdair/handoff/mutation-proof.js` | 0 | **9/9 guards proven load-bearing** |
| the AC3 mutation script (3 mutants, `finally` restore, sha256 both ends) | — | Output pasted verbatim in § AC3. Both files byte-identical after |
| `bash scripts/secret-scan.sh --surface <5 declared paths>` | **0** | See § Secret scan |
| `git diff --stat 3b87961` | 0 | 5 paths, all declared |

**Not run, and why:** `services/cockpit/render-check.mjs` — no cockpit asset was touched, so it would report on ground unrelated to this change.

### Secret scan

```
bash scripts/secret-scan.sh --surface \
  services/asdair/skill/rulebook.js \
  services/asdair/skill/rulebook.test.js \
  services/asdair/skill/README.md \
  services/asdair/pipeline/runPipeline.js \
  Deliverables/2026-08-09-return-B15-R3-archive-best-value.md
```

**Exit `0` — SCANNED and clean.** Coverage stated rather than implied: the run enumerated **exactly the five declared `file_surface` paths and nothing else** — it is the `--surface` form, not the zero-argument repo-wide form whose green says nothing about a deliverable. `private_surface` is `none`, so GL-012 §5's private-surface asymmetry does not arise; nothing under `C:/.fusion247/` was read or written.

---

## Document impact, as observed after the work

The order carried `document_impact: []`. What I actually changed or made stale:

| Path | State | Owner |
|---|---|---|
| `services/asdair/skill/README.md` | **Changed by me**, inside `file_surface` | keel (this order) |
| `services/asdair/skill/ruleConsumption.test.js` § 7 | Green and correct today. Becomes a description of an **archived** corpus once Warwick runs the SQL | Larry to route; outside this surface |
| `services/asdair/pipeline/rulebookWiring.test.js` | Comment at line 8 says *"`skill/rulebook.js` has 29 of its own tests"* — now 31. Fixture rule texts still read *"pick the best value by price per wash"* and *"round the quantity up to complete a pair"* | Larry to route; outside this surface |
| `Deliverables/2026-08-09-return-B15-R1-terra-prose-rulebook.md` | Historical return; its AC3 section describes behaviour now archived | Larry |
| The active Wayfinder | Rows describing the best-value rule as delivered capability | **Larry — I may not write it** |

---

## Out-of-scope findings — REPORTED, not fixed

| # | Severity | Finding |
|---|---|---|
| **F1** | **medium** | **`planner.js` `rankAlternatives` ranks candidates by PRICE PROXIMITY, weight 0.7** (`skill/planner.js:685-790`). The rulebook no longer forwards the price, but it forwards the candidates **in that order**, so a price-derived *ordering* still reaches the consumer. Two things bound it: proximity to the line's own price is a *similarity* heuristic, not a bargain judgement; and on the live corpus neither `products` nor `regulars` carries a price column at all, so the score is neutral and the ordering is price-free in practice. `planner.js` is outside this `file_surface` and I did not touch it. **If Warwick wants the ordering guaranteed price-free, that is a separate order against `planner.js`.** |
| **F2** | low | `rankAlternatives` also writes `reason: "... price GBP 4.50"` onto each alternative. That string is **not** forwarded into the packet (only `name` is), so nothing leaks today — but it is one field-addition away from leaking again. The behavioural control would catch it. |
| **F3** | low | `pipeline/rulebookWiring.test.js:8` states `rulebook.js` "has 29 of its own tests". Now 31. Its fixture rules are still worded as best-value and pair-rounding rules; harmless as prose, stale as narrative. Outside this surface. |
| **F4** | low | `skill/README.md` § `rulebook.js` still says **"Nothing is wired. No pipeline caller invokes `applyRulebook` yet"**. R2 wired it. I did **not** repair this: it was made false by R2, not by my change, and critical rule 7 says report rather than quietly fix. It is a one-line correction in a file already in this surface if Larry wants it in a follow-up. |
| **F5** | informational | `asdair.rules` has no `status` column (§ archival SQL). Worth carrying into the next order that talks about archiving rules, so the same mismatch is not re-drafted. |

None of these blocks the current route.

---

## Not verified / known limitations

- **No real shop has run.** This order changed a module and its tests. It proves nothing about the integrated production journey — typed text → Terra interpretation → prose-rule application → durable decision/recompute → honest unresolved behaviour. **B15-3 is not live-complete and this order completes nothing.** Warwick has ruled that explicitly and I am not describing it otherwise.
- **The stand-in consumer is not Terra.** Every rulebook test drives a fake. It proves selection, assembly, attribution, the safety envelope and the question path. It proves **nothing** about whether a model applies household prose well. The first evidence of that is a live shop.
- **The prohibition control covers `rulebook.js` only.** It does not examine `planner.js`, `deps.js`, the browser phase or Terra's own prompt — see F1. "No price arithmetic in the rulebook path" is what was proven; "no price arithmetic anywhere in AsdAIr" was not.
- **The external pin is a sibling document**, not an unwritable authority (§ AC3). Stated so no reviewer over-reads it.
- **The archival SQL is unexecuted and untested against a live database.** Its expected values come from a repository fixture recorded on 2026-08-04, not from a query I ran. **Read step 1's output before running step 2.** Rule 31's live existence is genuinely unknown.
- **Seven `skill` failures remain** — pre-existing, environmental (`pg` absent, `ASDAIR_DB_URL` unset), unchanged in count and identical by name. Not introduced here and not repaired here.
- **This is builder evidence.** My tests are untrusted by default; that is the design.

---

## Commit

Committed on `b15-3/integration` in `C:/Fusion247PKA-b153-int`, staged by explicit pathspec — never `git add -A`.

**No push. No PR. `main` untouched. No merge.** Merge is Warwick's `merge-decision` and it has not been given.

**Builder self-test evidence — NOT independent review.**
