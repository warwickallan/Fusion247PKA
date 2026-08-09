# RETURN — WO-2026-08-09-03 · Terra applies the household prose rulebook

**Banked by Larry, not by the worker.** The order's Sequencing §6 instructed the worker to write this
file, but `Deliverables/**` was **not in the granted `file_surface`**. The worker correctly refused
to widen its own envelope from a body instruction and returned in-message instead. **That is an
order defect of Larry's, and the refusal was right.** Recorded verbatim-in-substance below.

| | |
|---|---|
| **Status** | **COMPLETED** |
| **Branch / worktree** | `b15-3/terra-prose-rulebook` · `C:/Fusion247PKA-b153-rules` |
| **Commit** | `466cba990b338a3a702e3cfc2159266eaf3de3d7` |
| **Git endpoint** | commit only — no push, no PR, `main` untouched, as ordered |
| **Read-back** | Stated, then continued without holding, per Sequencing §1. **Verdict: ACCEPT.** |

---

## The route as traced from source

| Where | What it does |
|---|---|
| `skill/planner.js:952` `actionableRules()` | drops `info`, drops `rotate`, drops anything failing `hasTarget()` (`:839`). Its own comment concedes the dropped rules *"have never once fired."* |
| `skill/planner.js:1033` `advisoryRules()` → `:1674` / `:1476` | the **only** thing that happens to an inert rule today: targeted ones append `rule advisory: <text>` to a line's note; global ones land in `summary.advisories`. **Words carried. Nothing applied.** |
| `interpret/loadCatalogue.js:74` | the interpret stage's SQL filters `directive in ('exclude','map','rotate','needs_decision')` — **`info` prose is excluded by the query itself** |
| `interpret/groundedPrompt.js:44` `renderRules()` | read before designing, as ordered. It is a **vision** prompt (handwriting → candidate id) at a different pipeline stage and by construction never sees an `info` rule. **Extending it was not available**, and the worker said so rather than assuming. |
| `pipeline/deps.js:555` + `:399` `realInterpretAnswer` | the estate's existing shape for a bounded model consult. **Deliberately copied**, not reinvented. |

## What was built

`services/asdair/skill/rulebook.js` — new, CommonJS, zero runtime dependencies, pure apart from one
injected callable. Four jobs: enumerate what the deterministic planner drops · select what is
relevant and assemble it as the household's own prose · hand it to the consumer · apply the reply
inside a safety envelope, with attribution.

**`planner.js` changed by a COMMENT ONLY** (13 lines at `actionableRules`, pointing at where the
dropped rows now go). No planner behaviour changed — which is why `planner.test.js` needed no edit.

### The prohibition was answered directly

**No directive type, no rule grammar, no registry, no matcher DSL was added.** `inertRules()` is
computed as the *negative* of `actionableRules()` + `rotationInstructionsFromRules()`, so a rule that
later becomes actionable leaves the prose path automatically and **nothing enumerates rule ids by
hand**. A new kind of household rule needs **no code here at all**.

The one closed vocabulary added is a **reply** contract for a single model call — `set_product |
set_quantity | ask` — the same construct `interpretAnswer` already uses. **No rule is ever
classified, tagged or stored as one of them.**

### The safety envelope — the load-bearing part

A judgement may name a product **only** from the candidates that line actually offered, and **only**
where the line is held for an identification cause (`ambiguous match`, `ambiguous regulars match`,
`no explicit product mapping`); may set a whole-number quantity `1..24` on a line already being
bought; and may ask. It may **never** overrule `map`, `exclude`, out-of-stock, a quantity conflict, a
foreign-household product id, a line a `needs_decision` rule deliberately holds — **or any hold cause
the module does not recognise.** That last clause is an **allowlist**, so a flag added by a future
change makes a line untouchable rather than open.

## Executed evidence

**Baseline, from a pristine copy of `f390598` before any new code existed:**

```
# tests 250   # pass 241   # fail 7   # skipped 2
not ok 1   - lastOrder.test.js         (Cannot find module 'pg')
not ok 6   - schemaCompat.test.js      (Cannot find module 'pg')
not ok 243..248 - assertSafeDbTarget   (ASDAIR_DB_URL not set)
```

**After — `cd services/asdair/skill && node --test`:**

```
# tests 281   # pass 272   # fail 7   # skipped 2
```

**+31 executed tests, all passing; the same 7 pre-existing failures, no new one.** The 7 are
environment, not product, and were **proven pre-existing** by running from a pristine `f390598`.

- `node --test rulebook.test.js` → **29 tests, 29 pass, 0 fail**
- `node --test ruleConsumption.test.js` → **47 tests, 47 pass** (45 before, +2)

### Mutation — both directions

Mutant is a **copy** of the skill directory in the scratchpad; the real source is never mutated, so
an interrupted run cannot leave it broken. Mutation: `inertRules()` returns `[]` — the world before
this lane, rules on the floor.

```
===== MUTANT: the three named cases =====
not ok 8  - AC3 rule 31: ... the rulebook picks the best value per wash
              the line is still a question after the rulebook ran
not ok 9  - AC3 rule 37: a pair-rounding rule that has never fired changes the quantity
              rule 37 did not round the quantity up to complete a pair
not ok 10 - AC3 rule 36: a multibuy rule that has never fired buys up to the offer quantity
              rule 36 did not buy up to the offer quantity
# tests 29   # pass 7   # fail 22

===== REAL SOURCE, same three cases =====
ok 8  - AC3 rule 31 ...
ok 9  - AC3 rule 37 ...
ok 10 - AC3 rule 36 ...
```

### Secret scan

`SCANNED 6 file(s) of the named surface, 0 secret value(s) found`, 26 detection classes, **exit 0**.
Surface mode over exactly the six declared paths — **not a repo-wide green.** The scanner's own
stated blind spot (a shapeless credential in an ordinarily-named variable) is unchanged by this work.

### Scope

`git diff --stat f390598` plus the two new files → **5 paths, all inside `file_surface`. Paths
outside: 0.**

## Acceptance criteria

| AC | Verdict | Basis |
|---|---|---|
| **AC1** inert rules reach the consumer as prose | **met** | Assembled prose pasted in the worker's return. `ruleConsumption.test.js` §7 proves the two paths **partition** the live corpus (`actionable + inert === rules.length`) — no rule belongs to neither, which was the defect |
| **AC2** relevance, not the whole corpus | **met** | Targeted rule attaches on `match_term` against line text **or** resolved product name at **any** `termMatch` tier — looser than the planner's confident grade. **Failure direction chosen: over-inclusion**, because a false positive costs one ignored sentence and a false negative puts the rule back on the floor. Omissions are **counted** (`summary.rulebook.rules_omitted`), never silent |
| **AC3** a judgement rule changes a line | **met** | Rule 31: no product → **Ariel 76 Washes**, `add`, chosen on £0.211/wash vs 0.257 and 0.375. Rule 37: `sure male` qty **3 → 4**. Rule 36: `shower gel` qty **1 → 2**. All three fail under mutation |
| **AC4** attribution | **met** | Every change carries flag `rulebook rule <id>`, names the rule in the line's note in words a person reads, and appears in `summary.rulebook.applied` with `from`/`to`/`why`. A judgement naming a rule never sent is **refused** — tested both directions |
| **AC5** uncertainty is spoken | **met** | Six executed paths incl. unanswerable rule → question carrying rule 31's own words; contradictory rules → `needs_decision`; unreachable consumer → `rulebook not consulted` on every affected line; unparseable reply → error recorded, **never read as approval** |
| **AC6** no new deterministic directive type | **met, asserted against the diff** | The test reads the `CHECK` constraint out of `db/007_rules_rotate_directive.sql` — **a literal held outside the module** — and asserts every directive string `rulebook.js` compares against is inside it, plus `assert.doesNotMatch(src, /directive\s*[:=]\s*'/)`. Comments stripped first, so the prohibition warning cannot trip its own check |
| **AC7** the pure interface is stated | **met** | Below |

## AC7 — the interface Larry must wire

```js
const { applyRulebook, buildRulebookPrompt, parseRulebookReply } = require('./rulebook.js');

const { plan, grounding, audit } = await applyRulebook({
  plan,      // REQUIRED. the planBasket() result: { items, summary }
  rules,     // REQUIRED. the SAME rules array planBasket was given
  household, // optional. active household id; null/undefined = global rules only
  consult,   // REQUIRED. async (grounding) => reply object | raw model text
});
```

- Returns a **new** `{ items, summary }` of identical shape; **the input plan is never mutated**
  (tested). Adds `summary.rulebook` (`= audit`).
- Bind in `deps.js` as
  `consult: async (g) => extractJson(await answer(buildRulebookPrompt(g)))`.
- **`grounding` is `null` and `consult` is never called** when no inert rule speaks about the basket
  — a household with no judgement layer spends nothing.
- A `consult` that **throws** is caught: no line changes, every affected line flagged
  `rulebook not consulted`, `audit.error` set. **Never rethrows a model failure into the shop.**
- **One caller-visible side effect:** if any `planned_qty` changed and `summary.estimated_total` was
  non-null, it is set to `null` with `budget_flag: 'unknown'` and `estimate_invalidated: true`. The
  estimate came from unit prices this module cannot see, so a changed count makes it **wrong, not
  stale.**
- **Call site:** immediately after the single `deps.planBasket(` call inside `planWithDecisions` —
  `pipeline/decisionSpine.test.js:70` enforces exactly one such call site, so wire **around** it,
  not beside it.

## ⚠️ NOT PROVEN — read before believing the defect is fixed

1. **Nothing is wired and no real shop has exercised this.** `deps.js`, `runPipeline.js`,
   `runtime.js` are out of surface by design. **Capability, not completed automation — the outcome
   stays on the frontier.**
2. **The test consumer is not Terra.** `terraFake` answers only from what the grounding actually
   carried, which is what makes the mutation run meaningful. It proves selection, assembly,
   attribution, the envelope and the question path. **It proves nothing about how well a model judges
   household prose.** Only a live shop can.
3. **🔴 PRICE DATA IS THE REAL GATE ON RULES 31 AND 36.** Neither `products` nor `regulars` has a
   price column; price reaches the planner only via `shopping_list_items.price` /
   `product_alternatives.price`. **On today's live corpus these rules will mostly produce a REASONED
   QUESTION rather than a pick.** That is a large improvement on silence and is proved by an executed
   test rather than assumed — but it is **not** the same as *"Warwick is never asked which Ariel
   again"*. Getting there needs prices at plan time, **which is the browser lane's territory.** No
   price was faked.
4. **Category-targeted inert rules** are carried at basket scope with their category named in the
   prose, because `planBasket`'s public item shape carries no `category`. Declared over-inclusion,
   not silent omission.
5. **`MAX_JUDGED_QTY = 24`** is the worker's bound, not Warwick's. Pinned by a test so moving it is
   deliberate.
6. **7 pre-existing suite failures remain** (`pg` not installed in this worktree, `ASDAIR_DB_URL`
   unset). Not the worker's, not fixed, proven pre-existing.

## Out-of-scope findings — reported, not fixed. **Non-blocking; parked to the scheduled reconciliation.**

- **LOW** — `interpret/loadCatalogue.js:74` filters `info` rules out of the interpretation catalogue
  with the comment *"the planner applies it deterministically later"*, **which was never true** and
  is now doubly misleading. One-line comment correction when someone is next in that file.
- **LOW** — `planner.js:1531` names rule 37 as *"Sure male: round the quantity up to complete a
  pair"*, while `ruleConsumption.test.js` records the live text as **also** asking to *"add a FEMALE
  variant to complete the last pair"* — a second action the deterministic path cannot express either.
  The rulebook carries the full text, so the consumer sees it; nothing else acts on it.
- **INFO** — `db/007` records rule 32 as an `info` row that **should** be `rotate`. A data change for
  Warwick, not the worker's to apply.

## Order defects found by the worker — Larry's, recorded

1. **Sequencing §6 instructed a write to `Deliverables/**`, which was not in `file_surface`.** The
   template makes `file_surface` the complete writable set. **A body instruction cannot widen the
   envelope**, and the worker was right to refuse. *(The same defect was present in WO-B15-INT1 and
   was amended mid-flight once this return surfaced it.)*
2. **Governance head mismatch, benign** — the dispatch named `f390598`, the order header `492bc0e`.
   `git rev-parse` on both yields the **same contract blob** `500c6c517107`, so the governing bytes
   are identical.
3. **Rule 31's exact stored wording was unavailable** (no DB credential — correctly). A constructed
   paraphrase was used **and labelled as constructed**. Its *shape* — targeted, inert, never fired —
   is what the tests depend on.

**Builder self-test evidence — NOT independent review.**
