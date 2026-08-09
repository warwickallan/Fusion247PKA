# RETURN — WO-2026-08-09-08 · B15-3 R4 · Restore rule 37

**Builder self-test evidence — NOT independent review.**

- **Status:** `PARTIAL` — five of the seven acceptance criteria fully met, **AC1 met in one half and
  refused in the other**, AC3 met with the restored coverage. The unmet half is named precisely in
  § AC1 and it is a **design decision, not an implementation gap**.
- **work_order_id:** WO-2026-08-09-08
- **Branch:** `b15-3/integration` · **worktree:** `C:/Fusion247PKA-b153-int`
- **Branch point:** `c7f13d9` · **commit:** see § Commit
- **Governance head named in dispatch:** `c7f13d9`.
  `git rev-parse "c7f13d9:Team/Keel - Implementation Engineer/AGENTS.md"` →
  `500c6c5171074c2573f55810f93dc82a5e81508b` — the **identical blob** the order's envelope cites at
  `4bc4848`. The contract did not move between the two heads.
- **Sole-writer check:** the only commits above `4bc4848` on this branch are Larry's own
  (`fd85244`, which adds this order, and the merge `c7f13d9`). Nothing appeared in the worktree that
  I did not make.

---

## WORK ORDER READ-BACK

*(Returned at the top of this document, per the order's own § Sequencing: "Do NOT hold for my
acceptance; state it at the top of your return and continue.")*

```
WORK ORDER READ-BACK

Outcome understood:
  Rule 37 is not a bargain judgement and must stop being treated as one. Its
  outcome - "3 is odd, so buy 4" - is arithmetic on a quantity, reachable before
  the browser handoff from data the planner already has, with no price, no offer
  state and no browser. So the Sure quantity policy becomes executable in
  planning again, proven from a catalogue carrying NO price field at all, and
  R3's control against price arithmetic keeps standing and keeps firing. Only
  the genuine price/value rows (31 and 36) stay archived. The suite GROWS: rule
  37's regression coverage returns and every non-price case R3 put in its place
  stays. Two documents that are now false get corrected.

  The test I hold throughout: DOES THE OUTCOME REQUIRE PRICE ARITHMETIC - not
  does the prose mention an offer.

Owned files/surfaces:
  services/asdair/skill/rulebook.js            (declared; NOT written - see below)
  services/asdair/skill/rulebook.test.js
  services/asdair/skill/README.md
  services/asdair/pipeline/rulebookWiring.test.js
  Deliverables/2026-08-09-return-B15-R4-restore-rule-37.md   (this file)
  Nothing else. No path outside that list was written.

Inputs and authorities:
  credential_scope: none · live_authority: none · network: none ·
  dependency_policy: no-new-runtime-deps ·
  private_surface: NONE - stated back explicitly. This order declares no
  `C:/.fusion247/` surface, none was read or written, and the secrets store is
  denied by default (GL-012).
  operational_handoff: none, so the runbook gate does not apply and I do not
  refuse for a missing runbook_path.
  schema_decision: n/a - no schema change, so Silas is not in the loop.
  Inputs taken as authoritative and NOT re-derived: the staged live corpus
  (`Deliverables/2026-08-09-live-rule-corpus-and-value-rule-identification.md`)
  and R3's return. I queried NO database and opened no connection.
  Git: commit only, on this branch, in this worktree. No push, no PR, no main,
  no merge.

Acceptance evidence (each checked against reality BEFORE building):
  * All eight suites executed for a baseline before I wrote anything, by
    COUNT from each runner's own `# tests`/`# pass`/`# fail` - never from an
    exit code. They reproduce R3's recorded post-state exactly (§ Baselines).
  * `skill` really does carry exactly 7 environment failures, and I recorded
    them BY NAME so an eighth cannot hide behind an unchanged count.
  * `rulebook.test.js` really held 31 tests before I started.
  * `node services/asdair/handoff/mutation-proof.js` runs here: 9/9.
  * `bash scripts/secret-scan.sh --surface <the four service paths>` runs here
    in --surface mode and exits 0 over 4 files. Exit 2 would be NOT SCANNED.
  * The AC4 re-mutation is a real two-direction proof: sha256 snapshot first,
    restore from an in-memory byte snapshot in a `finally`, byte-identical
    check after. It calls NO git command - a `git checkout --` in a mutation
    harness would silently destroy uncommitted work.

Assumptions (each one a defect in the order, named rather than absorbed):
  1. THE ONE THAT MATTERS. AC1 asks for two outcomes: (a) the odd quantity is
     rounded UP to the next even number, and (b) "the female variant is ADDED to
     complete the final pair". (b) is an ADD-A-LINE-TO-THE-BASKET outcome. The
     safety envelope has three verbs - set_product, set_quantity, ask - and none
     of them can put a new item in a basket; `set_product` may only re-resolve a
     line the planner HELD, and only from candidates that line itself offered.
     A `map`-resolved Sure line is status `add` and `planBasket` gives it an
     EMPTY alternatives array (planner.js:1904 - only `needs_decision` lines get
     ranked candidates), so the women's product cannot even be a candidate. I
     have NOT invented a fourth verb. See § AC1 for what I did instead and what
     it would take to do the rest.
  2. The order says the female variant "is already a mapped product" via rule
     24. True, and irrelevant to (1): rule 24 maps the LIST TERM 'Sure female';
     it does not put that product on a line the household did not write.
  3. The live rule text carries a currency symbol. This file's fixtures are pure
     ASCII by a rule stated in its own header, so rule 37's fixture text is the
     LIVE wording transliterated ("GBP X" for the symbol) and nothing else is
     paraphrased. The transliteration cannot affect the outcome, which is
     arithmetic on a quantity.
  4. AC6 says to make `rulebookWiring.test.js`'s "fixture rule texts ... worded
     as best-value / pair-rounding rules" true. Pair-rounding is now the
     RETAINED class, so I aligned that fixture's wording with the retained
     rule's own arithmetic rather than re-cutting it; the genuinely archived
     wording was the OTHER fixture ("pick the best value by price per wash"),
     and that one is re-worded to a non-price preference.

Contradictions:
  1. AC1(b) versus the module's own authoritative contracts. `skill/README.md`
     and `rulebook.js`'s header both state that the vocabulary is three verbs,
     that the module "is NOT a second directive vocabulary", and that "adding a
     fourth is a design decision, not a way of teaching the system a new kind of
     rule". SOP-022 step 8 puts those above the Work Order. Named here rather
     than resolved by writing the fourth verb.
  2. `document_impact: []`, but this order necessarily changes a document
     (`skill/README.md`, in `file_surface`) and leaves others stale. Listed in
     § Document impact as observed. Larry's field to own; Veritas verifies it.

Missing requirements:
  None that blocked the work. AC1(b) is not a missing FIELD - it is a missing
  capability in the module, and deciding whether to build it is not mine.

Refusal conditions: none tripped. The order carries the
  `GENERATED by tools/wo/envelope.mjs` marker, every mandatory field is
  populated, both authority fields are `none`, the declared surface is one I may
  write, and no acceptance criterion required a prohibited capability.

Verdict: ACCEPT, with the AC1(b) boundary declared above and not crossed.
```

---

## Preflight findings — what was checked against reality

| Checked | Result |
|---|---|
| Worktree, branch, head | `C:/Fusion247PKA-b153-int` on `b15-3/integration` at `c7f13d9`, clean before I started |
| Sole writer | The two commits above the envelope's `4bc4848` are Larry's order and its merge. Nothing unexplained |
| Every `file_surface` path exists | Yes, except this return file, which the order asks me to create |
| Contract blob at the dispatch head | `500c6c517107…` — identical to the blob the envelope cites at `4bc4848` |
| Eight-suite baseline | **Reproduced by execution, not trusted** (§ Baselines). Matches R3's recorded post-state exactly |
| The 7 `skill` failures | Confirmed **by name**, not by count, before and after |
| `rulebook.test.js` = 31 tests | Confirmed by execution before the change |
| Secret scan reaches the surface | Confirmed at preflight in `--surface` mode: exit 0, 4 files, 26 detection classes |
| Can the envelope express AC1(b)? | **No** — established by reading `planner.js:1904-1910` (only `needs_decision` lines receive ranked alternatives) and `rulebook.js` `applyJudgement`. This is the finding that shapes the whole return |
| Does rule 37 need a module change at all? | **No** — established by execution: `rulebook.js` is **byte-identical** to its R3 state after this order (sha256 `10f223fa…`, the same hash R3's own return recorded). The prose is the interface, exactly as designed |
| Would restoring rule 37 strain R3's control? | **No.** All four mutants still RED, control untouched (§ AC4). AC4's stop-and-report condition was never reached |

Nothing in the preflight blocked the work.

---

## The finding that shapes this return: rule 37 needed NO code change

`rulebook.js` was declared in `file_surface` and **was not written.** Its sha256 after this order is
`10f223facb2dac01d1931c4ce96dc86f3dbcc7f13c3afdb01a7cd1c0d32c07cc` — the identical hash R3's return
recorded for it. That is not an omission; it is the evidence for Warwick's own point.

R3 removed money from the packet and the prompt. It removed **no rule**, because the module
hard-codes no rule id. Rule 37 therefore never stopped being carried by the code — it stopped being
*covered by a test*, and the README started saying it was archived. So "restoring rule 37" is exactly
two things: **restore its executable regression coverage**, and **stop the documents saying it is
gone.** Anything more would have been building a mechanism the design deliberately does not have.

---

## AC1 — met in the quantity half, refused in the variant half

**Met.** A Sure line asking for an odd quantity is rounded **UP to the next even number**, before the
browser handoff, from grounded catalogue and household data, with **no price anywhere in the path**.
The live example is executed as the canonical case: **3 male → 4**.

```
AC3 rule 37: an ODD Sure quantity is rounded UP to the next even number, from a catalogue with NO price
AC3 rule 37: the boundary is SWEPT, not spot-checked - odds move, evens are left alone
```

The second is a boundary sweep rather than a spot check: `1→2, 2→2, 3→4, 4→4, 5→6`, and an
already-even quantity must produce **no** audit entry — a rule that "changes" 2 to 2 is a rule that
fired when it should not have.

**Not met, and not attempted.** *"add a FEMALE variant to complete the last pair."*

- It is an **add-a-line** outcome. The safety envelope's three verbs are `set_product`,
  `set_quantity`, `ask`. None adds an item to a basket.
- `set_product` cannot be bent into it: it only re-resolves a line the planner **held**, and only
  from candidates **that line offered**. `planBasket` gives ranked alternatives to `needs_decision`
  lines only (`planner.js:1904`), and a Sure line resolved by `map` rule 23 is status `add` with an
  empty alternatives array. There is no candidate list for the women's product to be in.
- Building it means: a fourth verb, a new grounding shape that can offer a product from *another
  rule's* mapping, new safety bounds for a model reply that can **put products in Warwick's real
  trolley**, and new attribution and recount paths. That is architecture, and `rulebook.js`'s own
  header and `README.md` both already say a fourth verb is a design decision. I do not take it.

**What I did instead, so the clause is never lost — and this is proven, not asserted:**

```
AC3 rule 37: the FEMALE-variant clause is NEVER LOST - it reaches the consumer and the line, verbatim
```

Three places, each executed: **(a)** the planner's advisory echo already puts rule 37's full words —
including `add a FEMALE variant to complete the last pair (Mum 3 male -> add 1 female = 4)` — on the
line's note **before the rulebook runs at all**; **(b)** the grounding packet and the rendered prompt
carry the rule's text **verbatim** to the consumer; **(c)** the applied quantity change names the
female variant in the note a person reads at the handoff, so the outcome is not silently "4 male".

**The honest limit, stated so no reviewer over-reads it:** the basket still plans **4 male**, not
3 male + 1 female. A person reading the handoff is told what the household rule wants. **The system
does not do it.**

**My recommendation, which is Larry's and Warwick's to decide, not mine.** Two realistic routes:

| Route | What changes | Cost |
|---|---|---|
| **A — leave it said, not done** | Nothing. The clause is carried to the person and to Terra; the basket rounds to an even count of the male variant | Zero. Warwick adds the female one himself, the same way he already handles the bargain half |
| **B — a companion-line capability** | A fourth verb plus a bounded way to offer a product from another rule's `map` as a candidate | A real design change to the safety envelope, on the path that fills a real trolley. Needs Warwick's decision, not a Work Order amendment |

I would take **A** until a real shop has run, because nothing has yet exercised this path end to end
and B widens what a model may put in a basket.

---

## AC2 — driven from a catalogue with NO price field, and the ground is asserted first

The rule-37 case plans `UNPRICED_SURE`, and **asserts the absence of money before it asserts the
behaviour** — a control that stopped examining its ground would otherwise pass silently:

- every catalogue row is asserted to have **no `price` own-property**;
- `summary.estimated_total` is asserted `null` — there is no money in the plan either;
- the grounding packet is walked recursively and **no key** may match `/price|cost|amount|gbp/i`.

Only then is `3 → 4` asserted. **The implementation needs no price**, and § AC4's mutant M4 is the
proof in the other direction: to make rule 37 depend on a price you must first put price back in the
packet, and doing so trips R3's control immediately.

---

## AC3 — the suite GREW; nothing R3 added was removed

`rulebook.test.js`: **31 → 34 tests, 34 pass, 0 fail.** Asserted against my own diff:

```
$ git diff c7f13d9 -- services/asdair/skill/rulebook.test.js | grep -E "^-.*\btest\("
(no output — not one test was deleted)

$ git diff c7f13d9 -- services/asdair/skill/rulebook.test.js | grep -E "^-\s+id: [0-9]+,"
(no output — not one rule fixture was deleted)
```

All three of R3's re-cut non-price cases (rules 41, 42, 43) stand untouched, as do both `ARCHIVED`
controls, all four AC1 cases, all three AC2 cases, both AC4 attribution cases, all seven AC5 cases,
all six SAFETY cases, both AC6 cases and the REGRESSION case. **Three tests added, zero removed.**

Two assertions were **updated rather than removed**, and both are stronger for it — the inert-rule
enumeration now expects `[32, 37, 38, 41, 42, 43]`, and the omitted-rule count for a milk-only basket
moves `2 → 3` with rule 37 named. Both are the kind of assertion that must move when a rule returns;
leaving either would have been a test that no longer describes the corpus.

**The new tests are load-bearing, and I made them fail to prove it.** Neutering the rule-37 handler
(`if (q % 2 === 0) return null;` → `if (true) return null;`) turns both rounding tests RED:

```
not ok 11 - AC3 rule 37: an ODD Sure quantity is rounded UP to the next even number, from a catalogue with NO price
not ok 12 - AC3 rule 37: the boundary is SWEPT, not spot-checked - odds move, evens are left alone
# tests 34  # pass 32  # fail 2
```

Restored: `# tests 34  # pass 34  # fail 0`.

---

## AC4 — R3's archival control SURVIVES, is UNWEAKENED, and still fires

**It was not touched.** `rulebook.js` and the README's `ARCHIVED-PRICE-VOCABULARY` pin are
byte-identical to their R3 state. **AC4's stop-and-report condition was never reached** — restoring
rule 37 put no pressure on the control at all, which is itself the evidence that the implementation
uses no price.

Re-mutation-tested at this head, **four mutants, all RED, restore proven by hash**:

```
ORIGINAL mod    sha256 10f223facb2dac01d1931c4ce96dc86f3dbcc7f13c3afdb01a7cd1c0d32c07cc  35571 bytes
ORIGINAL readme sha256 51cbf20716b246441caafc031973749e5d04a292db61c874f43c6f7cd7dfa4ea  34629 bytes
ORIGINAL test   sha256 c60bc88a89536141265345ff8112f964df6693c1a401c9c32ef87bc3c2b0d224  55689 bytes

===== BEFORE: the prohibition holds, with rule 37 RESTORED =====
exit 0  # tests 34  # pass 34  # fail 0

===== MUTANT M1: candidates carry price again =====
exit 1  # tests 34  # pass 31  # fail 3
   RED: ARCHIVED: a PRICED catalogue still produces a packet and a prompt with no money in it
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins
   RED: AC5: the packet is IDENTICAL whether or not the catalogue carries prices

===== MUTANT M2: dead price-per-wash arithmetic, never sent to the consumer =====
exit 1  # tests 34  # pass 33  # fail 1
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins

===== MUTANT M3: a token quietly deleted from the README pin =====
exit 1  # tests 34  # pass 33  # fail 1
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins

===== MUTANT M4: rule 37 made to DEPEND on a price in the packet =====
exit 1  # tests 34  # pass 31  # fail 3
   RED: ARCHIVED: a PRICED catalogue still produces a packet and a prompt with no money in it
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins
   RED: AC5: the packet is IDENTICAL whether or not the catalogue carries prices

===== RESTORED: the prohibition holds again =====
exit 0  # tests 34  # pass 34  # fail 0

RESTORED mod    sha256 10f223facb2dac01d1931c4ce96dc86f3dbcc7f13c3afdb01a7cd1c0d32c07cc   BYTE-IDENTICAL: YES
RESTORED readme sha256 51cbf20716b246441caafc031973749e5d04a292db61c874f43c6f7cd7dfa4ea   BYTE-IDENTICAL: YES
RESTORED test   sha256 c60bc88a89536141265345ff8112f964df6693c1a401c9c32ef87bc3c2b0d224   BYTE-IDENTICAL: YES
```

- **M1–M3** are R3's own three mutants, re-run at this head, with identical results. The control is
  unchanged in strength.
- **M4 is new, and it is the check on Larry's correction.** It makes the rule-37 handler refuse to
  answer unless every candidate carries a numeric price — i.e. rule 37 genuinely needing money. To
  make that even possible the packet must carry price again, and the moment it does, **both halves of
  the control go RED**. A price-using rule 37 cannot pass this suite.

**The honest limit of M4:** the RED comes from the module mutation that M4 requires, not from the
test-side dependency by itself. What it establishes is the implication — *"rule 37 reads a price"*
entails *"the packet carries money"* entails *"the control fires"*. It does not establish that some
other, price-free-looking route to money is impossible.

The harness restores from an **in-memory byte snapshot in a `finally`** and runs no git command; all
three files are byte-identical afterwards, verified by hash rather than by inspection.

---

## AC5 — only rules 31 and 36 remain archived

Asserted against my own diff, not against memory:

- **Rule 37 is restored** as a live fixture carrying the live wording, and is executed.
- **Nothing else was removed** — the two `git diff` greps in § AC3 return no deleted test and no
  deleted rule fixture.
- **The Nescafe rules (12 / 25) are untouched.** Rule 12 is in the fixture, unmodified; rule 25 was
  never in it. The only diff line mentioning them is new README prose recording *why* they stay:
  their directive is `needs_decision`, so they **ask a person** rather than optimise — Warwick's own
  distinction, from the other direction.
- **Rules 31 and 36 stay archived.** I restored neither, and I did not soften the control that keeps
  them out (§ AC4). The archival SQL is Larry's to run; **I connected to no database.**

---

## AC6 — the two stale documents are corrected

### `services/asdair/skill/README.md`

| Was | Now |
|---|---|
| *"**Nothing is wired.** No pipeline caller invokes `applyRulebook` yet"* — made false by R2 | Records that `runPipeline.js` calls it on the production path and `rulebookWiring.test.js` drives the whole journey — **and keeps the part that is still true**: every test injects a stand-in consumer, so no real shop has exercised it |
| *"The rows affected are the best-value-per-wash rule, the multibuy … rule (36), and the `any 2 for GBP X` pair rounding rule (37)"* | *"The rows affected are **31 and 36, and nothing else**"*, cited to the staged live corpus |
| *"Rules 36 and 37 were archived by Warwick on 2026-08-09"* (the WO-Y table note) | Two separate corrections: 31 and 36 archived; **rule 37 RETAINED and the WO-Y row above it explicitly marked WRONG**, with Warwick's own words for why |

Added, because a reader needs the rule and not just the outcome: Warwick's two-class distinction
quoted in full, the test stated as *does the **outcome** require price arithmetic, not does the
**prose** mention an offer*, and a new "what this does NOT do" bullet recording that the envelope
cannot add a basket line — so AC1(b)'s gap is in the module's own documentation, not only in this
return.

The `ARCHIVED-PRICE-VOCABULARY` block is **untouched** — verified by diff.

### `services/asdair/pipeline/rulebookWiring.test.js`

- Line 8's *"has 29 of its own tests"* is corrected, **and defused**: it now says the figure is
  narrative, that nothing asserts it, and that it went stale twice in one day — so the next reader
  reads the suite rather than the comment. A number nobody checks is a defect generator; deleting the
  claim's authority is worth more than updating it.
- `PAIR_RULE`'s text is aligned with the **retained** rule's own arithmetic (*"round the quantity UP
  to an even number so every pair is complete"*) and a comment records that pair-rounding is still a
  live class after Warwick's correction.
- `UNRELATED_RULE`'s text — *"pick the best value by price per wash"* — was the genuinely archived
  judgement. Its job in that test is to be **irrelevant to the basket**, not to be a bargain rule, so
  it is now *"we always want the non-bio one"*.
- The two injected `why` strings and one comment are aligned with the even-number wording.

`pipeline`: **344 / 344 / 0** before and after.

---

## AC7 — counts, all eight suites, before and after

Read from each runner's own `# tests` / `# pass` / `# fail`. **Never inferred from an exit code.**

| Suite | Before | After |
|---|---|---|
| `pipeline` | 344 / 344 / 0 | **344 / 344 / 0** |
| `handoff` | 114 / 114 / 0 | **114 / 114 / 0** |
| `packet` | 109 / 109 / 0 | **109 / 109 / 0** |
| `browser-runner` | 75 / 75 / 0 | **75 / 75 / 0** |
| `bot` | 165 / 165 / 0 | **165 / 165 / 0** |
| `intake` | 34 / 34 / 0 | **34 / 34 / 0** |
| `reconcile` | 106 / 106 / 0 | **106 / 106 / 0** |
| `skill` | 283 run / 274 pass / **7 fail** / 2 skipped | **286 / 277 / 7 fail / 2 skipped** |

Command, per suite: `cd services/asdair/<suite> && node --test`. Node **v22.18.0**. No count
decreased. `skill` **+3** = the three new rule-37 tests; `rulebook.test.js` itself went 31 → 34.

**The seven `skill` failures are the known environment ones, identical BY NAME before and after, and
there is no eighth:**

```
not ok   1 - lastOrder.test.js                     (Cannot find module 'pg')
not ok   7 - schemaCompat.test.js                  (ASDAIR_DB_URL not set)
not ok 279 - assertSafeDbTarget: accepts local hosts and *_test databases
not ok 280 - assertSafeDbTarget: empty host is local ONLY when PGHOST is unset
not ok 281 - assertSafeDbTarget: refuses live Supabase / pooler hosts
not ok 282 - assertSafeDbTarget: refuses a non-local host that is not a *_test database
not ok 284 - assertSafeDbTarget: refuses empty host when PGHOST is set (finding #1)
```

*(The `not ok` numbers shift by 3 because three tests were added ahead of them in file order. The
failing test NAMES are identical.)*

Also executed, unchanged: `node services/asdair/handoff/mutation-proof.js` → **`9/9 guards proven
load-bearing`**, exit 0.

---

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| **AC1** — rule 37's behaviour executable in planning: odd → next even, **and** the female variant added | **PARTIAL** | Rounding half **met and executed** (3→4, boundary swept). Variant half **not delivered and not attempted** — no verb in the safety envelope can add a basket line; the clause is instead proven to reach the person, the packet and the prompt verbatim. § AC1 |
| **AC2** — works with NO price data whatsoever | **met** | `UNPRICED_SURE`; absence of `price` asserted on every row, `estimated_total` asserted `null`, packet walked for money keys — all **before** the behaviour is asserted. § AC2 |
| **AC3** — regression coverage restored; R3's non-price cases kept | **met** | 31 → **34** tests. Zero tests and zero rule fixtures deleted, proven by two `git diff` greps. New tests mutation-proved RED. § AC3 |
| **AC4** — R3's archival control survives and still fires, unweakened | **met** | Control byte-identical. Four mutants, all RED, restore hash-verified. Stop-and-report condition never reached. § AC4 |
| **AC5** — only rules 31 and 36 remain archived; Nescafe untouched | **met** | Asserted against my own diff. No database was queried or connected to. § AC5 |
| **AC6** — the two stale documents corrected | **met** | Three false README statements corrected, the stale wiring-test comment corrected **and defused**, the archived-class fixture re-worded. § AC6 |
| **AC7** — counts, all eight suites, before and after; `skill` exactly 7 failures | **met** | § AC7. No count decreased; same seven failures by name; no eighth |

---

## Files touched

| Path | In `file_surface` | What changed |
|---|---|---|
| `services/asdair/skill/rulebook.js` | yes | **NOT WRITTEN.** Byte-identical to its R3 state (§ The finding that shapes this return) |
| `services/asdair/skill/rulebook.test.js` | yes | Rule 37 restored as a live fixture; `UNPRICED_SURE`; a rule-37 handler; three new tests; two enumerating assertions updated; header records Warwick's correction. 31 → 34 tests |
| `services/asdair/skill/README.md` | yes | Three false statements corrected; Warwick's two-class distinction recorded; a new "does NOT do" bullet for the add-a-line gap. Pin block untouched |
| `services/asdair/pipeline/rulebookWiring.test.js` | yes | Stale test-count comment corrected and defused; the archived-class fixture re-worded; pair fixture aligned with the retained rule |
| `Deliverables/2026-08-09-return-B15-R4-restore-rule-37.md` | yes | This file |

**Paths written outside `file_surface`: 0.** Reconciled by `git diff --stat c7f13d9` — three modified
files plus this one, and nothing else.

---

## Commands executed

| Command | Exit | What it covered |
|---|---|---|
| `cd services/asdair/<suite> && node --test` × 8, before and after | 0 (7 pre-existing env failures in `skill`) | 1233 executed tests after the change, counted from each runner's own `# tests`. Not one count inferred from an exit code |
| `node --test rulebook.test.js` | 0 | **34 executed, 34 pass, 0 fail** |
| the new-test mutation (handler neutered, restored) | 1 → 0 | 2 RED, then 34/34 — the new tests are load-bearing |
| the AC4 mutation harness (4 mutants, `finally` restore, sha256 both ends) | — | Output pasted verbatim in § AC4. All three files byte-identical after |
| `node services/asdair/handoff/mutation-proof.js` | 0 | **9/9 guards proven load-bearing** |
| `git diff --stat c7f13d9` / two deletion greps | 0 | 4 paths, all declared; zero tests and zero rule fixtures deleted |
| `bash scripts/secret-scan.sh --surface <5 declared paths>` | **0** | See § Secret scan |

**Not run, and why:** `services/cockpit/render-check.mjs` — no cockpit asset was touched, so it would
report on ground unrelated to this change.

### Secret scan

```
bash scripts/secret-scan.sh --surface \
  services/asdair/skill/rulebook.js \
  services/asdair/skill/rulebook.test.js \
  services/asdair/skill/README.md \
  services/asdair/pipeline/rulebookWiring.test.js \
  Deliverables/2026-08-09-return-B15-R4-restore-rule-37.md
```

**Exit `0` — SCANNED and clean.** Coverage stated rather than implied: the run enumerated **exactly
the five declared `file_surface` paths and nothing else** — the `--surface` form, not the
zero-argument repo-wide form whose green says nothing about a deliverable. 26 detection classes.
`private_surface` is `none`, so GL-012 §5's private-surface asymmetry does not arise; nothing under
`C:/.fusion247/` was read or written. The scanner's own declared blind spot — a credential with no
recognisable shape in an ordinarily-named variable — is unchanged and is not closed by this run.

---

## Document impact, as observed after the work

The order carried `document_impact: []`. What I actually changed or made stale:

| Path | State | Owner |
|---|---|---|
| `services/asdair/skill/README.md` | **Changed by me**, inside `file_surface` | keel (this order) |
| `services/asdair/pipeline/rulebookWiring.test.js` | **Changed by me**, inside `file_surface` | keel (this order) |
| `Deliverables/2026-08-09-return-B15-R3-archive-best-value.md` § *"On rule 37 — I agree with Larry's reading"* | **Superseded by Warwick.** Historical return; its rule-37 reasoning is now overruled | Larry to route; outside this surface |
| `services/asdair/skill/ruleConsumption.test.js` | Its live-corpus fixture carries a **paraphrase** of rule 37 missing the `Mum 3 male -> add 1 female = 4` example and the rotate clause, and gives rule 32 directive `info` where the staged live corpus says `rotate`. Green today (it is a fixture, not a query) | Larry to route; outside this surface |
| The active Wayfinder | Rows recording R3 as having archived rule 37, and the `2f59307` note that rule 31 "may never have existed" — the staged live corpus supersedes both | **Larry — I may not write it** |

---

## Out-of-scope findings — REPORTED, not fixed

| # | Severity | Finding |
|---|---|---|
| **F1** | **medium** | **The rulebook cannot add a basket line, so the second clause of a live household rule is carried but never executed** (§ AC1). This is not a defect I introduced and not one I may fix; it is a gap between what the household writes and what the safety envelope can do. It will recur for any rule of the form "…and also get one of X". Route A / Route B in § AC1. |
| **F2** | **medium** | Carried forward from R3 and **unchanged**: `planner.js` `rankAlternatives` ranks candidates by **price proximity**, weight 0.7 (`skill/planner.js:685-790`). The packet carries no price but does carry the candidates **in that order**. The order parks this explicitly; it is still true. |
| **F3** | low | `skill/ruleConsumption.test.js` states its rule-37 wording is CONSTRUCTED *"because the live text carries a currency symbol"*. The staged corpus now gives the live text; an ASCII transliteration is available (I used one). Its rule 32 directive is also stale (`info`, now `rotate`). Outside this surface. |
| **F4** | low | R3's return recorded rule 31's live existence as "not established", citing `ruleConsumption.test.js:62`. The staged live corpus establishes that rule 31 **exists and is active**. That correction is already in the corpus document; noting it here so a reader of R3's return alone is not misled. |
| **F5** | informational | The archival SQL for rules 31 and 36 remains **unexecuted**. Until it runs, `planner.js:1151` keeps surfacing both as advisory notes. Larry's to run under Warwick's authority; I connected to no database. |

None of these blocks the current route.

---

## Not verified / known limitations

- **No real shop has run. This order completes nothing.** It changed two test files and a README.
  It proves nothing about the integrated production journey — typed text → Terra interpretation →
  prose-rule application → durable decision/recompute → honest unresolved behaviour. **B15-3 is not
  live-complete**, and nothing here should be read as saying otherwise.
- **The stand-in consumer is not Terra.** Every rulebook test drives a fake that can only answer from
  the grounding it was handed. It proves selection, assembly, attribution, the safety envelope and
  the question path. It proves **nothing** about whether a model applies household prose well —
  including whether a real Terra would read *"round qty UP to an even number"* the way my stand-in
  handler does. The first evidence of that is a live shop.
- **AC1's variant half is not delivered.** The basket plans 4 male, not 3 male + 1 female. The
  household's instruction is visible to the person and to the model; the system does not act on it.
- **`rulebook.js` was not modified**, so nothing in this order re-proves the module's behaviour
  beyond what R3 already proved. My new tests exercise existing code paths.
- **The archival control covers `rulebook.js` only** — not `planner.js`, `deps.js`, the browser
  phase or Terra's own prompt (F2). *"No price arithmetic in the rulebook path"* is what is proven;
  *"no price arithmetic anywhere in AsdAIr"* is not.
- **The external pin is a sibling document** in the same `file_surface`, not an unwritable authority.
  A single change touching module, README and test defeats it. Unchanged from R3; restated so no
  reviewer over-reads it.
- **The live rule text was taken from a staged document, not from a query I ran.** The order forbids
  querying, and I did not. If that document is wrong about rule 37's wording, my fixture is wrong
  with it.
- **Seven `skill` failures remain** — pre-existing, environmental (`pg` absent, `ASDAIR_DB_URL`
  unset), unchanged in count and identical by name. Not introduced here and not repaired here.
- **This is builder evidence.** My tests are untrusted by default; that is the design.

---

## Commit

Committed on `b15-3/integration` in `C:/Fusion247PKA-b153-int`, staged by **explicit pathspec** —
never `git add -A`.

**No push. No PR. `main` untouched. No merge.** Merge is Warwick's `merge-decision` and it has not
been given.

**Builder self-test evidence — NOT independent review.**
