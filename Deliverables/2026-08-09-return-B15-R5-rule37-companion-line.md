# RETURN — WO-2026-08-09-09 · B15-3 R5 · Rule 37's companion line

**Builder self-test evidence — NOT independent review.**

- **Status:** `COMPLETED` — all six acceptance criteria met with executed evidence. **The ceiling in
  the order still stands: no real shop has run and this order completes nothing.**
- **work_order_id:** WO-2026-08-09-09
- **Branch:** `b15-3/rule37-companion` · **worktree:** `C:/Fusion247PKA-r37`
- **Branch point:** `e3de027` · **commit:** see § Commit
- **Governance head named in dispatch:** `e3de027`.
  `git rev-parse "e3de027:Team/Keel - Implementation Engineer/AGENTS.md"` →
  `500c6c5171074c2573f55810f93dc82a5e81508b` — the **identical blob** the order's envelope cites at
  `341b091`, and the same blob R4 worked under. The contract has not moved.
- **Sole-writer check:** the only commits above `341b091` on this branch are Larry's own — `97b5cc6`
  (adds this order, 228 lines, one file) and the merge `e3de027`. **Nothing appeared in this worktree
  that I did not make**, and nothing under `services/asdair/pipeline/**` or `services/asdair/db/**`
  was touched by anyone in it.

---

## WORK ORDER READ-BACK

*(Returned at the top of this document, per the order's § Sequencing: "Do NOT hold for my acceptance;
state it at the top of your return and continue.")*

```
WORK ORDER READ-BACK

Outcome understood:
  Rule 37 has two clauses and only one of them was executable. "Round qty UP to
  an even number" was; "add a FEMALE variant to complete the last pair" was not,
  because it puts a NEW LINE in a basket and no verb could do that. R4 refused to
  invent a general "add a product" verb and that refusal stands. What I build is
  narrower: the rulebook may emit a companion line, and the product on it can
  only ever be one an ACTIVE `map` RULE OF THIS HOUSEHOLD ALREADY RESOLVES. Rule
  24 decided which women's deodorant this household means, weeks ago; no model
  chooses it now. I build the REFUSAL first and the permission second, and the
  bound is proven in every direction a plausible name can arrive from.

  The test I hold throughout: could this reply put a product in Warwick's real
  trolley that no rule of his ever named? If yes, the guard is wrong.

Owned files/surfaces:
  services/asdair/skill/rulebook.js
  services/asdair/skill/rulebook.test.js
  services/asdair/skill/README.md
  Deliverables/2026-08-09-return-B15-R5-rule37-companion-line.md   (this file)
  Nothing else. No path outside that list was written.

Inputs and authorities:
  credential_scope: none · live_authority: none · network: none ·
  dependency_policy: no-new-runtime-deps ·
  private_surface: NONE - stated back explicitly. This order declares no
  `C:/.fusion247/` surface, none was read or written, and the secrets store is
  denied by default (GL-012). No no-public-trace classification arises.
  operational_handoff: none, so the runbook gate does not apply.
  schema_decision: n/a - the companion line is a planning-time output, not a
  stored row, so Silas is not in the loop.
  Inputs taken as authoritative and NOT re-derived: the staged live corpus, R4's
  return, and this order's own `capability_evidence` for rules 23/24. I queried
  NO database and opened no connection.
  Git: commit only, on this branch, in this worktree. No push, no PR, no main,
  no merge.

Acceptance evidence (each checked against reality BEFORE building):
  * All eight suites executed for a baseline before I wrote anything, BY COUNT
    from each runner's own `# tests`/`# pass`/`# fail`, never from an exit code.
    They reproduce R4's recorded post-state exactly (S Baselines).
  * The seven `skill` failures confirmed BY NAME, not by count, before and after,
    so an eighth cannot hide behind an unchanged number.
  * `rulebook.test.js` held 34 tests before I started.
  * `node services/asdair/handoff/mutation-proof.js` runs here: 9/9.
  * `bash scripts/secret-scan.sh --surface <paths>` runs here in --surface mode,
    exit 0 over the service paths. Exit 2 would be NOT SCANNED.
  * The AC3 re-mutation is a real two-direction proof with a byte-identical
    restore from an in-memory snapshot in a `finally`. It runs NO git command.

Assumptions (each one a defect in the order, named rather than absorbed):
  1. THE ARITHMETIC. AC1 says "the male line at the rounded-up-to-even quantity
     minus one, plus a separate line for the female variant at quantity 1 - i.e.
     3 male -> 2 male + 1 female = 4". Those two halves disagree: 2 + 1 is 3, not
     4. The order anticipates this and says to implement what the RULE TEXT says.
     The live text is "Mum 3 male -> add 1 female = 4", and "rounded-up-to-even
     minus one" for 3 is (4 - 1) = 3. Both of those give THREE male. So I
     implemented 3 male + 1 female = 4, and the "2 male" parenthetical is the
     slip. What is rounded up to an even number is the PAIR TOTAL, not the male
     line.
  2. R4's two rounding tests assert the male line moves 3 -> 4. Under the
     completed rule that is now WRONG behaviour - it buys four men's deodorants -
     so those two assertions are UPDATED, not deleted, and both are stronger for
     it (S AC1). Zero tests and zero rule fixtures were removed.
  3. The order forbids querying and points at the staged corpus as authoritative,
     but that document does not contain rules 23, 24 or 39 - only 31, 36, 37 and
     the borderline rows. The product string for rule 24 therefore comes from the
     order's own `capability_evidence` block. The module names no product and no
     rule id, so a wrong string there makes my FIXTURE wrong and the code no less
     correct. Recorded in the fixture's provenance header.
  4. "Leave the line alone" on a refusal: I read it as the SHOPPING being left
     alone - same product, same count, same status - not as saying nothing. The
     module's own header and README make "nothing is dropped in silence"
     load-bearing, and SOP-022 step 8 puts an authoritative contract above the
     Work Order. So a refused companion leaves the plan untouched and still
     writes a flag, a note and an audit entry. Asserted both ways.

Contradictions:
  1. `document_impact: []`, but this order necessarily changes a document
     (`skill/README.md`, in `file_surface`) and makes R4's return partly
     historical. Listed in S Document impact as observed. Larry's field to own.
  2. None between the order and an authoritative contract. `rulebook.js`'s header
     and README both said "a fourth verb is a design decision" - which is exactly
     what this order carries, on Warwick's quoted authority, so it is a decision
     being TAKEN rather than a contract being broken. Both documents are updated
     to say so, and both now say a FIFTH verb is the next design decision.

Missing requirements:
  None that blocked the work.

Refusal conditions: none tripped. The order carries the
  `GENERATED by tools/wo/envelope.mjs` marker, every mandatory field is
  populated, both authority fields are `none`, the declared surface is one I may
  write, and no acceptance criterion required a prohibited capability.

Verdict: ACCEPT, with assumption 1 (the arithmetic) resolved to the rule text as
  the order instructs, and assumption 2 declared before it was acted on.
```

---

## Preflight findings — what was checked against reality

| Checked | Result |
|---|---|
| Worktree, branch, head | `C:/Fusion247PKA-r37` on `b15-3/rule37-companion` at `e3de027`, clean before I started |
| Sole writer | The two commits above `341b091` are Larry's order and its merge. Nothing unexplained |
| Every `file_surface` path exists | Yes, except this return file, which the order asks me to create |
| Contract blob at the dispatch head | `500c6c517107…` — identical to the blob the envelope cites at `341b091` |
| Eight-suite baseline | **Reproduced by execution, not trusted** (§ Baselines). Matches R4's recorded post-state exactly |
| The 7 `skill` failures | Confirmed **by name** before and after; there is no eighth |
| `rulebook.test.js` = 34 tests | Confirmed by execution before the change |
| Secret scan reaches the surface | Confirmed at preflight in `--surface` mode: exit 0, 3 files, 26 detection classes |
| Is the staged corpus sufficient for this order? | **No** — it carries rules 31/36/37 and the borderline rows, but **not 23, 24 or 39**. Named at read-back; the order's own `capability_evidence` is the source used |
| Does AC1's arithmetic hold together? | **No** — "2 male + 1 female = 4" is internally inconsistent. Resolved to the rule text as the order directs |
| Would adding rule 24 to the fixture disturb the existing plan? | **No** — established by execution before writing the fixture: `matchTerms('sure male','sure female')` returns `tier: null`, so the male line is unaffected |
| Is `services/asdair/pipeline/**` at risk? | `rulebookWiring.test.js` uses `set_quantity` but asserts nothing about the verb LIST, so an additive verb cannot break it. Confirmed after: `pipeline` 344/344 unchanged |

---

## The design, in one paragraph — because the bound IS the deliverable

`add_companion` is a fourth reply verb. Its product does not come from the model: the module derives
a **closed pool** from the household's own active `map` rules (`mappedProducts`), offers it in the
grounding packet **only when some line could actually take a companion**, and at apply time runs six
guards in order — is this line being bought · was a product named · does an `exclude` rule forbid it ·
did a `map` rule of this household resolve it · is it already in the basket · is the count within
`1..24`. There is exactly **one** path out of `applyCompanion` that adds anything and it is reached
only by surviving all six. No rule id and no product name is hard-coded: a household that writes a new
`map` row gets a new companion candidate with no code change, which is the same property that lets
archiving a rule stay a data change.

---

## AC1 — the companion line exists, and it is a LINE

Executed against the real module and the real planner, from a catalogue with **no `price` key on any
row** (asserted, then printed):

```
catalogue rows carrying a `price` key: 0

DETERMINISTIC PLAN, before any rule is applied:
  line 1: Sure Men Anti-Perspirant (blue variant)  x3  [add]
  basket estimate: null

WHAT THE CONSUMER MAY ADD (the pool, derived from map rules only):
  [{"name":"Sure Men Anti-Perspirant (blue variant)","rule_id":23},
   {"name":"Sure Women Anti-Perspirant Deodorant (white variant)","rule_id":24}]
  candidates offered on the line itself: []

----- AC1: rule 37 applied in full -----
  line 1: Sure Men Anti-Perspirant (blue variant)  x3  [add]
     flags: product mapped by rule | rule advisory | companion added by household rule | rulebook rule 37
     note : rule advisory: Sure "any 2 for GBP X": round qty UP to an even number ... ;
            rule 37 also added 1 x Sure Women Anti-Perspirant Deodorant (white variant)
            as a separate line (product named by rule 24)
  line 2: Sure Women Anti-Perspirant Deodorant (white variant)  x1  [add]
     flags: added by household rule | rulebook companion | rulebook rule 37 | rulebook rule 24
     note : added by rule 37 to go with "sure male"; rule 24 decided which product that is
            - the rule says to complete the pair
  UNITS IN BASKET: 4
  applied : [{"line_no":1,"item_name":"sure male","rule_id":37,"kind":"add_companion",
              "from":null,"to":"Sure Women Anti-Perspirant Deodorant (white variant)",
              "quantity":1,"product_rule_id":24,"why":"the rule says to complete the pair"}]
```

**3 male + 1 female = 4** — the rule's own worked example. Note `candidates offered on the line
itself: []`: the pool is a **separate** list and never becomes a `set_product` candidate (AC5).

The boundary is **swept, not spot-checked**: `1→2, 2→2, 3→4, 4→4, 5→6` as PAIR TOTALS, with the male
line asserted to stay at what was asked for every time, exactly one companion on odd, and **zero
companions and zero extra lines on even** — a rule that fires on an already-complete pair is a rule
that fired when it should not have.

---

## AC2 — the bound, proven in three directions (plus four more)

The order asked for three. All three are executed and pasted below; four further refusals are proven
in the suite because each is a different way the same bound could leak.

```
----- AC2 (i): UNMAPPED product named -----
  line 1: Sure Men Anti-Perspirant (blue variant)  x3  [add]      <- unchanged
  UNITS IN BASKET: 3
  REFUSED : [{"line_no":1,"rule_id":37,"kind":"add_companion",
              "product":"Sure Women Invisible Aqua 250ml",
              "reason":"no active map rule of this household resolves that product, so it may not be added"}]

----- AC2 (ii): CATALOGUE-ONLY product named (a real row no rule maps) -----
  line 1: Sure Men Anti-Perspirant (blue variant)  x3  [add]      <- unchanged
  UNITS IN BASKET: 3
  REFUSED : [{... "product":"ASDA Womens Anti-Perspirant Deodorant 150ml",
              "reason":"no active map rule of this household resolves that product, so it may not be added"}]

----- AC2 (iii): product mapped for ANOTHER HOUSEHOLD named -----
  line 1: Sure Men Anti-Perspirant (blue variant)  x3  [add]      <- unchanged
  UNITS IN BASKET: 3
  REFUSED : [{... "product":"Sure Women Bright Bouquet 150ml",
              "reason":"no active map rule of this household resolves that product, so it may not be added"}]
```

**(ii) is the dangerous one and it is why "catalogue-only" was worth its own case:** that product is
real, the planner can see it, and it would go into an actual trolley. The only thing keeping it out is
the map-rule bound.

In each case the line's `status`, `matched_product` and `planned_qty` are asserted **identical to
before** — and the refusal is still visible on the line (`rulebook answer rejected`, plus a note
naming what was asked for and why it was refused) and in `summary.rulebook.rejected`.

The four further refusals, each its own test: an **excluded** mapped product (refused *and* never
offered on the pool), a line that is **not being bought**, a product **already in the basket**, and a
**quantity outside `1..24`** (refused, never clamped).

---

## AC3 — R3/R4's archival control still stands, still fires, and was not weakened

**It was not touched.** The `ARCHIVED-PRICE-VOCABULARY` pin in `README.md` is byte-identical (proven
by `git diff` returning no line in that block), and both ARCHIVED tests are unmodified.
**AC3's stop-and-report condition was never reached** — nothing in the companion path wanted money,
which is itself the evidence that it needs none.

Re-mutation-tested at this head. **Fourteen mutants, twenty-six REDs, zero vacuous mutations, restore
proven by hash.** M1–M3 are R3's own three, re-run unchanged; M4 is R4's, re-expressed against the
companion path; N1–N10 are new and prove the new guards are load-bearing.

```
ORIGINAL mod    sha256 3f214f5f327aa5535b3c1df5640810d10f48855a57e9aa4f8040453cd945449a  49845 bytes
ORIGINAL test   sha256 c16d6d33dc0961120af17e62e2ea1eca11ae3f99b4ec7e3c233595f8d48740bc  79883 bytes
ORIGINAL readme sha256 fb6f2f137900c173774a714c03c2946ea24cfbe67359b740c5b90876cd6bfda9  38168 bytes

===== BEFORE: the suite as committed =====        # tests 44  # pass 44  # fail 0

===== M1: candidates carry price again =====      # tests 44  # pass 41  # fail 3
   RED: ARCHIVED: a PRICED catalogue still produces a packet and a prompt with no money in it
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins
   RED: AC5: the packet is IDENTICAL whether or not the catalogue carries prices
===== M2: dead price-per-wash arithmetic, never sent =====   # pass 43  # fail 1
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins
===== M3: a token quietly deleted from the README pin =====  # pass 43  # fail 1
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins
===== M4: the COMPANION path made to DEPEND on a price =====  # pass 41  # fail 3
   RED: ARCHIVED: a PRICED catalogue still produces a packet and a prompt with no money in it
   RED: ARCHIVED: rulebook.js contains none of the price vocabulary README.md pins
   RED: AC5: the packet is IDENTICAL whether or not the catalogue carries prices

===== N1: THE BOUND REMOVED - any named product accepted =====  # pass 41  # fail 3
   RED: AC2: an UNMAPPED product is refused, and the line is left alone
   RED: AC2: a CATALOGUE-ONLY product is refused - being real is not being mapped
   RED: AC2: a product mapped for ANOTHER HOUSEHOLD is refused
===== N2: the EXCLUSION guard removed from the apply path ===== # pass 43  # fail 1
   RED: AC2: a mapped product an EXCLUDE rule forbids is refused, and never offered
===== N3: the HOUSEHOLD filter removed from the pool =====      # pass 42  # fail 2
   RED: AC2: a product mapped for ANOTHER HOUSEHOLD is refused
   RED: AC6: the judgement vocabulary is FOUR verbs, one of them is "ask", and the fourth is bounded
===== N4: the ALREADY-IN-THE-BASKET guard removed =====         # pass 43  # fail 1
   RED: AC2: a product already in the basket is not bought twice
===== N5: mayAddCompanion fails OPEN =====                      # pass 43  # fail 1
   RED: AC2: a companion may not hang off a line that is not being bought
===== N6: the companion QUANTITY bound removed =====            # pass 43  # fail 1
   RED: AC2: a companion quantity outside the bound is refused, not clamped
===== N7: an EXCLUDED product allowed onto the offered pool === # pass 43  # fail 1
   RED: AC2: a mapped product an EXCLUDE rule forbids is refused, and never offered
===== N8: the companion added but its ATTRIBUTION dropped ===== # pass 43  # fail 1
   RED: AC4 rule 37: the companion says WHY it is in the trolley - rule 37 asked, rule 24 chose
===== N9: the companion is never actually appended =====        # pass 39  # fail 5
   RED: AC1 rule 37: an odd Sure line plans as the male line PLUS a female companion line ...
   RED: AC1 rule 37: the boundary is SWEPT ... odds get a companion, evens are left alone
   RED: AC4 rule 37: the companion says WHY it is in the trolley - rule 37 asked, rule 24 chose
   RED: AC3 rule 37: the FEMALE-variant clause is now DONE as well as said
   RED: SHAPE: one line can produce SEVERAL companions, of different products, at different quantities
===== N10: set_product allowed to draw from the pool too =====  # pass 43  # fail 1
   RED: AC5: the companion pool is not a back door into set_product

===== RESTORED: the suite as committed =====      # tests 44  # pass 44  # fail 0

RESTORED mod    sha256 3f214f5f...   BYTE-IDENTICAL: YES
RESTORED test   sha256 c16d6d33...   BYTE-IDENTICAL: YES
RESTORED readme sha256 fb6f2f13...   BYTE-IDENTICAL: YES
```

**The harness itself had to be fixed before it could be trusted, and the fix is worth recording.** Four
multi-line mutants silently failed to apply on the first run: the checked-out files are **CRLF**, so an
anchor written with `\n` matches nothing. A mutation that does not mutate produces a **green that
proves the opposite of what it claims**. The harness now tries both line endings and treats a missing
anchor as a hard error, so a vacuous mutant can no longer be read as a surviving guard. Same CRLF
defect that already bit two tests in this file, third occurrence.

**N10 caught a real defect in my own test, and this is the most useful thing in this return.** The
first version of *"the companion pool is not a back door into set_product"* used a basket with only a
held line — so the pool was **empty**, and the test proved only that an empty list contains nothing. It
stayed **GREEN** under a mutation that merged the two lists. Rewritten to carry a settled line *so that
the pool is real*, with the pool's contents asserted before the behaviour. It now goes RED. A control
that reports on ground it did not examine is worse than no control, and this one was mine.

---

## AC4 — attribution names TWO rules, because there are two questions

Warwick asks *"why is there a women's deodorant in my trolley"*. The shop answers from the line
itself: flags `rulebook rule 37` (asked for a companion) **and** `rulebook rule 24` (decided which
product), plus `rulebook companion`; a note reading *"added by rule 37 to go with "sure male"; rule 24
decided which product that is"*; and the audit entry carrying `rule_id: 37` and `product_rule_id: 24`.
**The source line says it too** — *"rule 37 also added 1 x Sure Women … as a separate line (product
named by rule 24)"* — so the pair is legible from either end rather than by inferring a connection
between two lines. Mutant N8 proves those assertions bite.

---

## AC5 — the existing safety envelope is not widened elsewhere

Asserted against my own diff and by execution:

- **`set_product` is unchanged.** Its candidate list is still `item.alternatives` and nothing else; the
  companion pool is a separate field and never merges into it. Proven by mutant **N10**, and by the
  packet assertion `candidates offered on the line itself: []` in a basket where the pool is non-empty.
- **Exclusion is unchanged and now defended twice** — an excluded product never reaches the pool
  (mutant N7) and is refused again at apply time by name (mutant N2), so a product that never made the
  list cannot arrive by another route either.
- **Household separation is unchanged** (mutants N1, N3).
- **`MAX_JUDGED_QTY` is unchanged at 24** and now bounds the companion count too (mutant N6).
- **The three existing verbs, the hold-cause allowlist, the benign-flag allowlist, the ask path, the
  unreachable-consumer path and the estimate invalidation are untouched.** A new line invalidates the
  basket estimate for the same reason a quantity change does, and takes the same path.
- **No new directive value, no new rule vocabulary.** The AC6 directive test — which reads the permitted
  set from `db/007`, not from a literal — is unmodified and green.

---

## AC6 — counts, all eight suites, before and after

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
| `skill` | 286 run / 277 pass / **7 fail** / 2 skipped | **296 / 287 / 7 fail / 2 skipped** |

Command, per suite: `cd services/asdair/<suite> && node --test`. Node **v22.18.0**. No count decreased.
`skill` **+10** = `rulebook.test.js` going **34 → 44**.

**The seven `skill` failures are the known environment ones, identical BY NAME before and after, and
there is no eighth:**

```
not ok   1 - lastOrder.test.js                     (Cannot find module 'pg')
not ok   7 - schemaCompat.test.js                  (ASDAIR_DB_URL not set)
not ok 289 - assertSafeDbTarget: accepts local hosts and *_test databases
not ok 290 - assertSafeDbTarget: empty host is local ONLY when PGHOST is unset
not ok 291 - assertSafeDbTarget: refuses live Supabase / pooler hosts
not ok 292 - assertSafeDbTarget: refuses a non-local host that is not a *_test database
not ok 294 - assertSafeDbTarget: refuses empty host when PGHOST is set (finding #1)
```

*(The `not ok` numbers shift by 10 because ten tests were added ahead of them in file order. The
failing test NAMES are identical.)*

Also executed, unchanged: `node services/asdair/handoff/mutation-proof.js` → **`9/9 guards proven
load-bearing`**, exit 0.

**Nothing was deleted to make room.** Proven against my own diff:

```
$ git diff e3de027 -- services/asdair/skill/rulebook.test.js | grep -E "^-\s+id: [0-9]+,"
(no output — not one rule fixture was deleted)

$ diff <(old test names) <(new test names)
  4 names replaced (3 rule-37 cases + the verb enumeration), 13 added, 30 untouched
```

The four replacements are the two R4 rounding assertions (now asserting the completed rule), the
"clause is never lost" case (now also asserting the clause is DONE), and the verb enumeration
(three → four, with the bound pinned beside it).

---

## The second evidenced consumer — rule 39. Shaped for, NOT implemented

**Not implemented. No rule-39 rule text, product or fixture exists in my diff.** What the order asked
for is whether the seam is accidentally Sure-shaped. **It is not, and that is proven by execution
rather than asserted** — `SHAPE: one line can produce SEVERAL companions, of different products, at
different quantities` drives one line to two companion lines at quantities 2 and 1, using two
throwaway `map` rows and no rule-39 wording.

**So the cost of rule 39 later, stated precisely:**

| Rule 39 needs | Does the seam already do it? |
|---|---|
| One line → several companion lines | **Yes.** Proven. |
| Different quantities per companion | **Yes.** Proven (2 and 1). |
| Reducing the source line's own count alongside | **Yes** — `set_quantity` on the same line in the same reply. Untested for that combination; nothing in the design prevents it. |
| Products that are **not** resolved by a `map` rule | **NO. This is the whole cost.** Rule 39's own text says the products are *"NOT in regulars — it needs a search"*. The bound refuses exactly that. |
| Hanging a companion off a line that is **held** rather than being bought | **No** — guard 1 refuses it. A "3 Mince Hotpot" line with no mapping would be `needs_decision`, so this would bite too. |

**The two realistic routes, and neither is mine to choose:** (a) Warwick writes two `map` rows for the
beef and chicken ready meals, and rule 39 works through this seam **with no code change at all**; or
(b) the product source is widened beyond `map` rules — which is a real design change to what a model
may put in a trolley, and a Warwick decision, not a Work Order amendment. **Route (a) costs nothing
and is consistent with how this household already teaches the system.**

---

## Files touched

| Path | In `file_surface` | What changed |
|---|---|---|
| `services/asdair/skill/rulebook.js` | yes | `add_companion` verb; `mappedProducts` / `excludedProduct` / `mayAddCompanion`; `companion_products` on the packet; `may_add_companion` per line; the companion half of the prompt, rendered only when the pool exists; `applyCompanion`'s six guards; ctx wiring; header rewritten |
| `services/asdair/skill/rulebook.test.js` | yes | Rule 24 added as a live fixture; three refusal fixtures; rule 37's handler completed; 13 tests added, 4 replaced, 0 deleted. 34 → 44 |
| `services/asdair/skill/README.md` | yes | New "The companion line" section; the envelope table row; the "does NOT do" bullet corrected; the rule-37 bullet corrected. **`ARCHIVED-PRICE-VOCABULARY` block untouched** |
| `Deliverables/2026-08-09-return-B15-R5-rule37-companion-line.md` | yes | This file |

**Paths written outside `file_surface`: 0.** Reconciled by `git diff --stat e3de027` — three modified
files plus this one, and nothing else. `git status --porcelain` shows no stray untracked file. Nothing
under `services/asdair/pipeline/**` or `services/asdair/db/**` was written.

---

## Commands executed

| Command | Exit | What it covered |
|---|---|---|
| `cd services/asdair/<suite> && node --test` × 8, before and after | 0 (7 pre-existing env failures in `skill`) | 1243 executed tests after the change, counted from each runner's own `# tests`. Not one count inferred from an exit code |
| `node --test rulebook.test.js` | 0 | **44 executed, 44 pass, 0 fail** |
| the mutation harness (14 mutants, `finally` restore, sha256 both ends) | — | Output pasted in § AC3. 26 REDs, no vacuous mutant, all three files byte-identical after |
| the AC1/AC2 demonstration driver | 0 | Output pasted in § AC1 and § AC2. Real module, real planner, price-free catalogue |
| `node services/asdair/handoff/mutation-proof.js` | 0 | **9/9 guards proven load-bearing** |
| `git diff --stat e3de027`, deletion greps, test-name diff | 0 | 4 paths, all declared; zero rule fixtures deleted; 30 of 34 test names untouched |
| `bash scripts/secret-scan.sh --surface <4 declared paths>` | **0** | See § Secret scan |

**Not run, and why:** `services/cockpit/render-check.mjs` — no cockpit asset was touched, so it would
report on ground unrelated to this change.

### Secret scan

```
bash scripts/secret-scan.sh --surface \
  services/asdair/skill/rulebook.js \
  services/asdair/skill/rulebook.test.js \
  services/asdair/skill/README.md \
  Deliverables/2026-08-09-return-B15-R5-rule37-companion-line.md
```

**Exit `0` — SCANNED and clean.** Coverage stated rather than implied: the run enumerated **exactly the
four declared `file_surface` paths and nothing else** — the `--surface` form, not the zero-argument
repo-wide form whose green says nothing about a deliverable. 26 detection classes. `private_surface` is
`none`, so GL-012 §5's private-surface asymmetry does not arise; nothing under `C:/.fusion247/` was read
or written. The scanner's declared blind spot — a credential with no recognisable shape in an
ordinarily-named variable — is unchanged and is not closed by this run.

---

## Document impact, as observed after the work

The order carried `document_impact: []`. What I actually changed or made stale:

| Path | State | Owner |
|---|---|---|
| `services/asdair/skill/README.md` | **Changed by me**, inside `file_surface` | keel (this order) |
| `Deliverables/2026-08-09-return-B15-R4-restore-rule-37.md` § AC1 "not met, and not attempted" and finding **F1** | **Now historical.** F1 ("the rulebook cannot add a basket line") is **closed for the mapped-product case** and remains open for the unmapped case (rule 39). Its Route A / Route B table is superseded: Warwick took a narrower option than either | Larry to route; outside this surface |
| `services/asdair/skill/ruleConsumption.test.js` | Unchanged and still green. Its live-corpus fixture still carries a paraphrase of rule 37 and gives rule 32 directive `info` where the corpus says `rotate` — carried forward from R4's F3, untouched here | Larry to route; outside this surface |
| The active Wayfinder | Records rule 37 as half-restored | **Larry — I may not write it** |

---

## Out-of-scope findings — REPORTED, not fixed

| # | Severity | Finding |
|---|---|---|
| **F1** | **medium** | **The companion pool includes the source line's own mapped product.** Rule 23's blue variant is in the pool for a Sure line, so a consumer could name it; it is refused by the "already in the basket" guard rather than by never being offered. The refusal is correct, but the pool would be tighter if a product already on a line were filtered out at build time. Not changed here — filtering at build time would weaken the *reason* recorded on the refusal, and I will not trade an accurate audit for a shorter list without being told to. |
| **F2** | **medium** | **The pool is a menu.** A consumer is shown every product this household's `map` rules resolve, and the guards prevent it adding an *unmapped* product — not a mapped one nobody asked for. The compensating controls are that it must attribute to a rule that was sent, the line must be one being bought, and the companion is flagged and noted. On the live corpus that pool is small; on a household with many `map` rules it grows. Worth watching after the first real shop. |
| **F3** | low | Carried forward from R3/R4 and **unchanged**: `planner.js` `rankAlternatives` ranks candidates by price proximity, weight 0.7. The packet carries no money but does carry candidates **in that order**. Parked by the order; still true. |
| **F4** | low | Carried forward from R4: `skill/ruleConsumption.test.js`'s rule-37 wording is a constructed paraphrase and its rule 32 directive is stale (`info`, now `rotate`). Outside this surface. |
| **F5** | low | **Third occurrence of the CRLF defect** in this directory: two tests already carry comments about it, and it silently disabled four mutants in my harness before I caught it. Any future source-scanning or file-mutating helper here must split on `/\r?\n/` and assert its anchor applied. |
| **F6** | informational | The archival SQL for rules 31 and 36 remains **unexecuted**. Larry's to run under Warwick's authority; I connected to no database. |

None of these blocks the current route.

---

## Not verified / known limitations

- **No real shop has run. This order completes nothing.** It changed one module, one test file and a
  README. It proves nothing about the integrated production journey. **B15-3 is not live-complete**,
  and nothing here should be read as saying otherwise.
- **The stand-in consumer is not Terra.** Every test drives a fake that can only answer from the
  grounding it was handed. It proves selection, assembly, attribution, the six guards and the question
  path. It proves **nothing** about whether a model reads *"add a FEMALE variant"* and picks the white
  Sure Women row out of the pool — including whether it picks the right one when the pool holds several
  women's products. **The first evidence of that is a live shop.**
- **The pool's usefulness depends on `map` rows existing.** Rule 37 works because rule 24 exists. A
  household rule of the same shape whose product has no `map` row will be refused and become a
  question. That is the design, not a defect — but it means the seam's reach is exactly the reach of
  the household's own map rules.
- **`rulebookWiring.test.js` was not extended.** The pipeline suite is green and unchanged (344/344), so
  the new verb breaks nothing on the wired path, but **no test drives a companion line through
  `runPipeline.js`**. That file is outside my surface and a second lane is live in it.
- **Nothing downstream of the plan was checked.** Whether the handoff packet, the browser runner and
  the reconcile phase handle an item that was never on the household's written list is **not proven
  here** — those suites are green but none of them was given a companion line. This is the most likely
  place for the next real defect.
- **The live rule text and the rule-24 product string came from staged documents and from the order,
  not from a query I ran.** The order forbids querying and I did not.
- **Seven `skill` failures remain** — pre-existing, environmental, unchanged in count and identical by
  name. Not introduced here and not repaired here.
- **This is builder evidence.** My tests are untrusted by default; that is the design.

---

## Commit

Committed on `b15-3/rule37-companion` in `C:/Fusion247PKA-r37`, staged by **explicit pathspec** —
never `git add -A`.

**No push. No PR. `main` untouched. No merge.** Merge is Warwick's `merge-decision` and it has not
been given.

**Builder self-test evidence — NOT independent review.**
