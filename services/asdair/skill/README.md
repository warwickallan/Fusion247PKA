# AsdAIr skill (IDEA-012, WP1)

The "brain" half of the household-shopping agent. It takes a weekly shopping
list and produces a **basket plan**: the exact products to add, the quantities,
and the flags that need a human. It has **no browser** and it **never places an
order**. Larry runs the live-data acceptance separately.

## What this is (and is not)

- IS: a deterministic planner that decides what a checkout-ready basket should
  contain, plus a read-only adapter that feeds it live data, plus a CLI to view
  the plan.
- IS NOT: a browser automation, an order placer, or anything that writes to the
  database. There is no checkout step anywhere, by construction.

## Architecture

Three clean layers:

1. **`planner.js` - pure, deterministic, dependency-free.**
   `planBasket({ listItems, rules, products, regulars, budget }) -> { items, summary }`
   No DB, no network, no fs, no clock, no randomness. Same inputs -> same output.
   All the shopping logic lives here (see "Standing rules" below). `regulars` is
   an ARGUMENT like `rules` / `products`; the planner never loads it itself.

2. **`data.js` - read-only Postgres adapter.**
   `loadList(listDate, household)`, `loadRules()`, `loadProducts()`,
   `loadRegulars(household)`, `loadBudget(household)`,
   `loadLastOrder(household)`. **SELECT statements only**
   - no INSERT / UPDATE / DELETE / DDL anywhere. Every query runs inside a
   `BEGIN TRANSACTION READ ONLY` so the database itself rejects any accidental
   write.

3. **`cli.js` - view a plan.**
   Loads via `data.js`, runs `planner.js`, prints a human-readable basket plan
   followed by the raw JSON. Never writes to the DB.

Each output item is:

```
{ item_name, matched_product|null, requested_qty, planned_qty, status, flags: [], note }
```

where `status` is one of `add | needs_decision | excluded_this_week | excluded`.

Two kinds of exclusion are kept apart:

- `excluded_this_week` - a TRANSIENT one-week exclusion, item-level only
  (`one_week_only` true or the list line's own `status='excluded_this_week'`).
  Flag: `excluded this week only`. For THIS list only; never promoted (rule 10).
- `excluded` - a STANDING exclusion, driven by an `exclude` DIRECTIVE rule (a
  learned, PERMANENT "never buy this again" hard rule). Flag: `excluded by
  standing rule` (plus the rule's reason in the note when it carries one). A
  standing exclude takes precedence over a one-week mark on the same line, so a
  permanent rule is never mislabelled as transient.

For both kinds `planned_qty` is 0 and the item is never added, never
substituted, and never checked out.

The `summary` is:

```
{ total_requested, planned_add, needs_decision,
  excluded, excluded_standing, excluded_this_week,
  estimated_total|null, currency, budget_flag }
```

`excluded` is the TOTAL across both exclusion kinds (so totals reconcile);
`excluded_standing` and `excluded_this_week` are additive breakdown counts.

`budget_flag` is one of `within | below | above | unknown`.
`estimated_total` is only computed when every planned-add line has a price;
otherwise it is `null` and `budget_flag` is `unknown`.

## Standing rules the planner implements

1. Quantities on a list are ITEM COUNTS, not pack sizes.
2. An item with no quantity defaults to 1.
3. Duplicate lines for the same item are deduped (counts summed).
4. Items are expected in Favourites / Regulars. `asdair.regulars` is a real
   resolution source for the planner (see "How Regulars drive resolution").
5. Nothing is added unless it is explicitly on the list.
6. Out of stock or not confidently matched -> `needs_decision`, with any
   alternatives surfaced for a human. **NEVER auto-substitute.**
   **CONFIDENTLY MATCHED** means the planner can NAME a product for the line -
   `matched_product` is non-null after all four resolution sources (explicit
   in-scope `matched_product_id` > `products.list_term` > `map` directive >
   regulars). Anything else is `needs_decision` with ranked candidates
   surfaced, `planned_qty` 0, flags `no explicit product mapping` +
   `never auto-substitute`. It is never status `add` with a flag - that was the
   old behaviour and it produced confidently wrong plans (`needs_decision: 0`
   on a list that genuinely needed a human).
7. A normal shop is GBP 120-150 excluding delivery; the basket is **flagged**
   (never blocked) when the estimated total falls outside that band.
   **NOT CURRENTLY OPERATIVE - do not claim budget flagging works.** The rule is
   documented and implemented but structurally unevaluable: neither `products`
   nor `regulars` carries a price column, and `estimated_total` is only computed
   when EVERY planned-add line has a price. On any real list the total is
   therefore `null` and `budget_flag` is permanently `unknown` - which the
   outcome recorder correctly treats as "not outside the band", never as a
   breach. Reviving the rule needs a price source; deferred, with the claim
   corrected rather than the capability pretended (see BUILD-015).
8. The goal is a checkout-ready basket; the planner **NEVER checks out**.
9. Product matches come from the `products` table (list_term -> matched_product)
   plus product-scope directive rows in `rules`, honouring household scope.
10. `one_week_only` and `excluded_this_week` are honoured for THIS list only and
    never promoted to a standing rule.

### How rules drive planning

The migrated `asdair.rules` rows carry free-text `rule_text`, which the pure
planner treats as **informational** (it does not parse prose). A rule only
changes a plan when it carries **structured directive fields**:

- `directive`: `exclude` | `needs_decision` | `map` | `info` (default `info`)
- `match_term` / `match_category`: what the rule targets
- `matched_product`: replacement product for a `map` directive
- `active` (default true), `scope`, `household_id`: applicability

Free-text-only rows have no planning effect. This keeps the planner deterministic
and auditable rather than guessing intent from prose.

### `info` rules are CARRIED, not actioned (WO-Y, 2026-08-04)

Until 2026-08-04 `actionableRules()` **discarded every `info` row before
matching**. On the live rulebook that is rules 32, 36, 37 and 38 -- *every
rotation rule and every multibuy rule in the system*. They were correct,
complete, written weeks earlier, and had **never once fired**. That is the
defect WO-Y exists to close, and it cost Warwick an evening on 2026-08-03
answering questions he had already answered.

The fix is **not** to make `info` actionable. For most of these rules `info` is
the *correct* directive and the content simply cannot be executed here:

| Live rule | Verdict | What now happens |
|---|---|---|
| 32 -- rotate the Sure variant weekly | `info` is the **wrong** directive; it should be `rotate` | Handed back as a migration for Warwick to apply. Not applied here. |
| 36 -- multibuy: buy up to the offer quantity when the extra items are >=50% off | `info` is **correct** and must stay | **Cannot be evaluated. There is no price column on `products` or `regulars` anywhere in the schema** -- the same reason standing rule 7 above is inoperative. No evaluator is faked. It surfaces at basket review. |
| 37 -- round a "any 2 for X" quantity up to an even number | `info` is **correct** | Same: conditional on an offer this planner cannot see. Carried to the line. |
| 38 -- an add-to-trolley failure means OUT OF STOCK, not an expired slot | not a planner rule at all | Guidance for whatever drives the browser. Carried, never implemented here. |

So:

- **Targeted `info` rules** (rules 32, 37 -- both target `sure male`) attach to
  the line they name: flag `rule advisory`, and the rule's own words in the
  note.
- **Global `info` rules** (rules 36, 38 -- `match_term` *and* `match_category`
  both NULL) belong to the basket rather than to any one line, and surface once
  in **`summary.advisories`**, an additive key. Pasting a global rule onto all
  forty lines would be noise, and noise is how a real signal gets missed.
- An advisory **never** changes status, quantity or matched product.

**Do not read `summary.advisories` as "the multibuy rule works".** It does not.
It means the rule finally reaches a human instead of being thrown away.

> **This table is the WO-Y record and is left as written.** Two of its rows have
> since been overtaken, and both corrections are stated here rather than edited
> silently into the table above:
>
> - **Rules 31 and 36 are ARCHIVED** (Warwick, 2026-08-09) -- see *"The
>   best-value judgement is ARCHIVED"* below. The verdict above describes why 36
>   could never be executed here; it is no longer wanted here either.
> - **Rule 37 is RETAINED, and its row above is WRONG.** *"Conditional on an
>   offer this planner cannot see"* is the reading Warwick overruled later the
>   same day: *"Do not discard a deterministic quantity/variant rule merely
>   because its prose mentions a multibuy context."* Rule 37's outcome is
>   arithmetic on a quantity -- **`Mum 3 male -> add 1 female = 4`** -- and needs
>   no price, no offer state and no browser. It is executed through the rulebook
>   path below, and `rulebook.test.js` drives it from a catalogue carrying no
>   price field at all.

### `rulebook.js` -- the prose rulebook, and the rules that finally ACT (B15-3, lane R1)

The section above ends at *"the rule finally reaches a human instead of being
thrown away."* That was as far as a deterministic planner could go, and it was
not far enough:

> **Warwick:** *"there is no way to teach the system new rules and get it to
> learn if I keep having to tell it which aerial every bloody week!"*

`rulebook.js` closes the rest. It takes the rules `actionableRules()` drops --
**23 of 39 active rules, and precisely the judgement layer** -- assembles them as
the household's **own prose**, hands them to a **reasoning consumer**, and
applies the answer to the plan.

**It adds no directive type, no rule grammar, no matcher DSL and no registry.**
A household rule needs no code here, ever. The prose is the interface; the model
is the interpreter. Growing a `directive` per kind of judgement is an
ever-lengthening mini-language that is always one household sentence behind, and
that shape of regrowth is exactly what this lane must not produce.

```js
const { applyRulebook } = require('./rulebook.js');

const plan = planBasket({ listItems, rules, products, regulars, budget, household });
const { plan: judged, audit } = await applyRulebook({
  plan,                 // the planBasket result
  rules,                // the SAME rules array planBasket was given
  household,
  consult,              // async (grounding) => reply | raw model text
});
```

`applyRulebook` is **pure apart from the injected `consult`**: no I/O, no env
var, no model client, no credential -- the same shape as the rest of this
directory. `buildRulebookPrompt(grounding)` and `parseRulebookReply(raw)` are
exported so the production binding is thin.

**The safety envelope is the load-bearing part.** A judgement may:

| May | May not |
|---|---|
| name a product for a line the planner could **not identify** (`ambiguous match`, `ambiguous regulars match`, `no explicit product mapping`), **and only from the candidates that line actually offered** | overrule a `map`, an `exclude`, an out-of-stock, a quantity conflict, a foreign-household product id, a line a `needs_decision` rule deliberately holds, or **any hold cause this module does not recognise** -- unrecognised means untouched |
| change the quantity of a line already being bought, a whole number, `1..24` | set a quantity of zero, or add anything to the basket that was excluded |
| **ask** | fall back on the deterministic answer when it is unsure |

**Uncertainty is spoken.** An unclear rule, two rules pointing different ways, a
reply naming a product nobody offered, a quantity outside the bound, a verb
outside the vocabulary, an attribution to a rule that was never sent -- none of
them degrade to a silent deterministic answer. Each becomes a question carrying
the household's own words, or a visible `rulebook answer rejected` flag plus an
audit entry. An unreachable consumer flags **every** affected line
`rulebook not consulted` and records the error in `summary.rulebook`.

**Attribution is mandatory.** Every applied change carries flag
`rulebook rule <id>`, names the rule in the line's note, and appears in
`summary.rulebook.applied` with `from`/`to`. *"Why did it do that"* has an
answer, or the change does not happen.

**What this does NOT yet do, stated plainly:**

- **Category-targeted rules** are carried at basket scope with their category
  stated in the prose, because `planBasket`'s public item shape carries no
  category. Declared over-inclusion, not a silent omission.
- **The estimate.** A changed quantity makes `summary.estimated_total` wrong
  rather than stale, and this module cannot recompute it (it never sees unit
  prices). It is set to `null` with `budget_flag: 'unknown'` and
  `summary.rulebook.estimate_invalidated: true`.
- **Adding a basket LINE.** The three verbs are `set_product`, `set_quantity`
  and `ask`; none of them can put a new item in a basket, and `set_product` may
  only re-resolve a line the planner already held, from candidates that line
  itself offered. So the second clause of live rule 37 -- *"add a FEMALE variant
  to complete the last pair"* -- is **carried and said, never applied**: the
  advisory echo puts it on the line, the grounding packet sends it verbatim to
  the consumer, and the applied quantity change names it in the note a person
  reads. A fourth verb is a design decision, not a way of teaching this system a
  new kind of rule, and it is not taken here.
- **It is WIRED, but no real shop has run.** *(Corrected 2026-08-09: this bullet
  used to read "Nothing is wired. No pipeline caller invokes `applyRulebook`
  yet." B15-3 lane R2 made that false.)* `pipeline/runPipeline.js` calls
  `applyRulebook` on the production path, and `pipeline/rulebookWiring.test.js`
  drives the whole journey from the pipeline entry to prove it. What is still
  true is the part that matters: **every test injects a stand-in consumer, so no
  real shop has ever exercised it.** That proves the path carries, applies and
  refuses; it proves nothing about how well a model judges household prose.

### The best-value judgement is ARCHIVED (Warwick, 2026-08-09)

Warwick changed his mind and **removed** the bargain-hunting half of the
rulebook. His words are the specification:

> *"Do not make Terra, the planner, or the browser phase attempt to optimise
> Ariel/other choices by live price, price-per-wash, multibuy maths, or bargain
> judgement before handing the list to the browser. ... The objective is
> deliberately to SIMPLIFY the handoff. ... For now, Warwick remains the bargain
> hunter at the ASDA end. **AsdAIr should prepare the right shop reliably. It
> does not need to become a supermarket arbitrage desk.**"*

What that means concretely, and all of it is enforced by `rulebook.test.js`:

- **No money leaves this module.** `buildRulebookGrounding` maps a line's
  `alternatives` to **names only**; the planner's `price` field is dropped and
  never forwarded. `renderLines` prints no figure, no currency and no
  `(price unknown)` -- saying a price is unknown is still an invitation to shop
  on it.
- **The prompt does not invite a value judgement.** It states plainly that the
  consumer is shown no money, must not ask for or estimate any, and should
  `ask` where a rule can only be settled by comparing what things cost.
- **Nothing is left behind a flag.** A dormant price path is exactly what was
  removed; re-introducing one is a code change that the control below fails.
- **The rules themselves are archived as DATA**, in `asdair.rules`, by Warwick.
  This module hard-codes no rule id, so archiving a rule is never a code change
  here. **The rows affected are 31 and 36, and nothing else** -- the
  best-value-by-price-per-wash rule (31) and the ">=50% off the extra item, buy
  up to the offer quantity" rule (36). Established by live query on 2026-08-09
  and staged at
  `Deliverables/2026-08-09-live-rule-corpus-and-value-rule-identification.md`.
- **RULE 37 IS NOT ARCHIVED, and the line between the two classes is Warwick's
  own** *(corrected 2026-08-09 -- this bullet previously listed 37 among the
  archived rows, which was wrong)*:

  > *"You have conflated two different classes of behaviour: **PRICE/VALUE
  > JUDGEMENT -- archive this** ... anything that requires current price/offer
  > arithmetic to choose the economically 'best' option. **DETERMINABLE
  > HOUSEHOLD SHOPPING POLICY -- retain this. Rule 37 is in this class.** ... Do
  > not discard a deterministic quantity/variant rule merely because its prose
  > mentions a multibuy context."*

  **The test is whether the OUTCOME requires price arithmetic, not whether the
  PROSE mentions an offer.** Rules 12 and 25 (Nescafe Azera) stay for the same
  reason from the other direction: their directive is `needs_decision`, so they
  **ask a person** rather than optimise. Rule 37's outcome is arithmetic on a
  quantity and is executed through this module; `rulebook.test.js` drives it
  from a catalogue with no price field at all, and asserts the absence of the
  price field before it asserts the behaviour.
- **Out of scope of the removal:** `planBasket`'s budget estimate
  (`estimated_total` / `budget_flag`, standing rule 7) and `rankAlternatives`'
  price-proximity *similarity* score are planner behaviour, not a bargain
  judgement, and are untouched. The rulebook still nulls a basket estimate its
  own quantity change has invalidated.

#### The prohibition control, and where its vocabulary is pinned

`rulebook.test.js` scans `rulebook.js` -- comments stripped, split on
`/\r?\n/` because these files are CRLF -- for the vocabulary below, and reads
**this list, from this file**, so that widening the module can never widen its
own check. Editing the list here is a visible, reviewable act.

<!-- ARCHIVED-PRICE-VOCABULARY: read by rulebook.test.js. One backticked token per list line. -->

- `price`
- `per wash`
- `multibuy`
- `cheapest`
- `best value`

<!-- /ARCHIVED-PRICE-VOCABULARY -->

The source scan is the weaker half and it is stated as such: the load-bearing
control is behavioural -- a **priced** catalogue is planned, and the assembled
packet and the rendered prompt are asserted to contain no money at all. Both
halves are mutation-proved in the return for WO-2026-08-09-07.

### Prior answers: `asdair.rule_qa_log` is a planning input (WO-Y)

`CANONICAL-WEEKLY-SHOP-PROCESS.md` section D requires that *"previous decisions must be
consulted before any question is generated"*. Nothing in the planning path had
**ever** read `rule_qa_log`: its only non-test readers in the whole service were
`outcome/promoteDecision.js` (a writer) and `cockpit-api/readRules.js` (a
display reader). So on 2026-08-03 the shop asked about Ariel Pods while the
recorded answer -- *"best value/wash"*, 2026-07-21 -- sat in the database.

- `data.js` **`loadRuleQaLog(household)`** (SELECT only) reads the household's
  rows plus the global ones.
- `planBasket({ ..., priorAnswers })` consults them **before** the status chain
  runs. A matching row adds the flag `prior decision on record` and the answer
  itself to the note.
- Only `applies_going_forward` rows count, and household scope is honoured.
- **A prior answer never names a product.** "Best value/wash" is a selection
  heuristic, not an identity, and evaluating it needs a price that does not
  exist. It can stop a line being an *unexplained* question; it can never pick
  the item. Standing rule 6 is untouched.

#### The live rows are not single-topic, and the shaping that follows from that

The first implementation emitted the whole `answer` string, on fixtures that
assumed one question meant one decision. **The live rows say otherwise**
(queried 2026-08-04), and two shapes break that assumption:

- **BATCH (live row 5).** One question covering seven ambiguities, answered as
  seven `Key=value` fragments in a single string. Linking `"Ariel Pods"` to it
  is correct; emitting all seven households' decisions onto that card is not.
- **POINTER (live row 2).** *"Established the product-specific matching rules
  now recorded in `asdair.rules` with scope=product (rules 10-16, 18-22)."*
  That states no decision at all -- it records where the decisions went.
  Surfacing it as a prior decision tells Warwick nothing and reads like a
  malfunction.

So an answer is shaped into exactly one of three outcomes, and **both failure
directions are made visible rather than guessed at**:

| Outcome | When | What the card gets |
|---|---|---|
| `fragment` | single-topic, or exactly one `Key=` fragment names the line | flag `prior decision on record` + that fragment only |
| `unsplit` | it demonstrably covers the line but zero or several fragments match | flag `prior batch answer not split` + *"a prior batch answer from <date> covers this; it could not be split automatically"* + the raw text |
| `pointer` | the answer names rules (`rule N`, `rules N-M`) instead of stating one | **never presented as a decision.** Followed to the rules it names: if one of them already speaks to this line, flag `prior decision recorded as rules` and nothing more, since that rule's own words are already on the card. If none do, nothing at all is surfaced. |

**Linking runs by two routes**, because the batch question names its topics
loosely -- it says *"Sure variant"* where the list says *"Sure male"*:

1. the **question** names the line (every word of the line appears in it); or
2. a compound answer's own **fragment key** names the line, uniquely.

A key that matches more than one fragment resolves to `unsplit`, never to a
guess. A rule reference is parsed only after the literal word `rule`/`rules`,
so a pack size (`Wall's=4-pack`, `8x35ml`) can never be read as one.

### Tolerant matching (WO-Y) -- and why it is deliberately grudging

Alias and rule matching were **exact string equality**, so `"2 yazoo choc"`
missed the stored alias `"choc yazoo"` (word order) and
`"Double Glouester cheese"` missed `"double gloucester"` (one letter). Both are
real 2026-08-03 failures against real stored aliases.

`termMatch.js` is now the **single** matcher, shared by `planner.js` and
`interpret/resolveByCatalogue.js` -- they previously had two different
implementations, which is how the read path and the plan path came to disagree
about what "the same product" means.

It grades every match, and the grades have different powers:

- **CONFIDENT** (`exact`, `token_set`, `typo`, `key_subset`) may establish
  identity -- resolve a regular, apply a `map`, seed a rotation ring.
- **ADVISORY** (`shared_distinctive`) may **only** attach a reason and **hold**
  a line for a human. It can never name a product.

That asymmetry is the whole design: a matcher that is too loose silently buys
the wrong product, while one that is too tight asks a question. Every threshold
in `termMatch.js` fails towards asking, and every one has a real counter-example
pinned in `termMatch.test.js` (`beans`/`beers`, `butter`/`batter`,
`milk`/`silk`, `Sure male`/`Sure female`, `bread`/`shortbread`). **Loosening a
threshold without adding its counter-example re-opens this defect.**

Exact matching still runs first and still wins, so no line that resolved before
can change its answer.

### How Regulars drive resolution

`asdair.regulars` is the household's standing "this is what we actually buy"
set: `name`, `aka` (alias array), `brand`, `asda_product_id`, `typical_qty`,
`substitutes_allowed`. `loadRegulars(household)` reads the ACTIVE rows for the
named household plus the global ones (never another household's), and
`planBasket` takes them as an argument.

Regulars are the **lowest-priority** resolution source. Existing precedence is
unchanged:

```
explicit matched_product_id  >  products.list_term  >  `map` directive rule  >  regulars
```

A regulars match is case-insensitive over `name` and every `aka` alias, honours
household scope (household-scoped beats global), and sets `matched_product` to
the regular's brand + name, flag `matched from regulars`, with
`regulars asda_product_id <id>` surfaced in the note. Two or more active
regulars answering the same term is AMBIGUOUS -> `needs_decision` (flags
`ambiguous match` + `ambiguous regulars match`); the planner never picks one
(rule 6). `substitutes_allowed = false` adds the informational flag
`no substitutes allowed` - the planner never substitutes at all.

**Schema note:** `asdair.regulars` is defined by `db/004_asdair_regulars.sql`,
faithful to the live table. Its `household_id` is **NOT NULL** - unlike
`products` and `budget_settings` there is no global regular - so
`loadRegulars` requires a named household and throws rather than silently
returning an empty set.

### The last order, and rotation ("a different variant each week")

`SOP-021` makes the PREVIOUS order a **required** planning input: some regulars
rotate deliberately, and rotation cannot be resolved without knowing what the
last shop actually contained. Nothing loaded it, so every rotation rule was
structurally unimplementable - the same "documented, implemented, dead" class as
standing rule 7. Two additive pieces close that:

- **`loadLastOrder(household)`** (adapter, SELECT only) returns
  `{ household_id, order, lines }` for the most recent COMPLETED order, or
  `null` when the household has never completed one (a first shop must not
  crash). Each purchased line carries the item name, the matched product, the
  quantity ACTUALLY added, and the `asdair.regulars` row it resolves to, so a
  caller can reason in regulars rather than free text. Two regulars answering
  the same name is ambiguous: no id is chosen (rule 6 discipline).
  - **COMPLETED means `orders.total_added IS NOT NULL`** - the outcome recorder
    wrote back reconciled totals for the run. It CANNOT mean `checked_out`: that
    column is false by construction (rule 8), so it would match nothing forever.
  - **MOST RECENT means `COALESCE(run_at, created_at) DESC, id DESC`** -
    `run_at` is the truth when known, but the clock-free outcome builder leaves
    it NULL when the run did not say when it happened, so `created_at` (NOT NULL,
    defaulted) is the fallback and `id DESC` the deterministic tie-break.

- **`planBasket({ ..., lastOrder, rotation })`** and the pure exported helper
  **`chooseRotatedVariant({ candidates, lastOrder, itemName, fixedProduct })`**.
  Both new inputs are OPTIONAL: with neither supplied, planning is byte-for-byte
  what it was. A rotation instruction targets a line the same way a rule does
  (`match_term` / `match_category`, household scope, `active`); candidates are
  the instruction's own list, or every active in-scope regular answering the
  line's term. The choice is deterministic - a stable ring ordered by name,
  anchored on the variant the last order leant on most (largest `added_qty`),
  then the next eligible variant round the ring. No clock, no randomness.

  **It never guesses.** The line becomes `needs_decision`, carrying a question,
  when there are no candidates, when every candidate was in the last order (the
  ring is exhausted - it will not silently repeat), or on a genuine variant
  clash.

  **CORRECTED 2026-08-04 (WO-Y), on Warwick's reading of the live rows.** This
  paragraph used to say a `map` rule plus a rotate instruction was itself the
  conflict, citing rules 23/24 against the decision log. **That premise was
  wrong.** The live rows compose rather than clash:

  - **23** `map "Sure male"` -> *"Sure Men Anti-Perspirant Deodorant (blue
    variant)"*
  - **32** `rotate "Sure male (men's blue)"` -- rotate the scent weekly
  - **37** `info "Sure male"` -- round the quantity up to complete a pair

  Rule 32 **opens by agreeing with rule 23** and then refines it: 23 picks the
  family, 32 picks this week's member, 37 handles the quantity. Three rules at
  three levels. Had the old reading shipped, Sure would have become a
  `needs_decision` **every single week** -- the exact failure WO-Y exists to
  end, reintroduced by its own fix.

  **A genuine clash still asks:** two `map` directives naming DIFFERENT
  products for the same line. That is mechanically decidable and is detected.

  **NOT detected, and deliberately not attempted:** a `rotate` whose *prose*
  contradicts rather than refines its `map`. Deciding that means reading the
  rules as language, and this planner does not parse prose -- the property that
  keeps it deterministic and auditable. Stated as a real limit rather than
  faked with a keyword sniffer.

  **CORRECTED 2026-08-04 (WO-Y).** This paragraph used to say there was no
  database carrier for the rotation instruction, because
  `asdair.rules.directive` was CHECK-constrained to
  `info | exclude | needs_decision | map`. **That has not been true since
  `db/007_rules_rotate_directive.sql` landed**, which widened the constraint to
  include `rotate`. The stale claim survived here for weeks and was still being
  quoted as a reason rotation could not work -- while the actual reason was
  simply that nothing derived instructions from those rows.

  **`planBasket` now derives rotation instructions from the rulebook itself:**
  every active rule carrying `directive = 'rotate'` and a target becomes a
  rotation instruction, using the same `match_term` / `match_category` /
  `household_id` targeting a directive rule uses. `stepPlan()` already passes
  `rules` and `lastOrder`, so **rotation needs no new pipeline wiring at all**.
  An explicitly-passed `rotation` argument is still honoured and still wins,
  so a caller can always override the rulebook.

  **What this does NOT do:** change any rule's directive. Live rule 32 ("Sure
  male: ROTATE the variant each week") still carries `info`, so it still does
  not rotate. Making it rotate is a **data** change to the household's rulebook
  and is Warwick's to apply, not this layer's to assume.

## Run the CLI (live acceptance)

The connection string comes ONLY from the environment. It is never passed on the
command line and never printed.

```
cd services/asdair/skill
npm install                      # installs pg (runtime dependency of the adapter)
export ASDAIR_DB_URL='postgres://...'      # bash
# or PowerShell:  $env:ASDAIR_DB_URL='postgres://...'

node cli.js --list-date 2026-07-13 --household <household-name>
```

Output: a human-readable table (status / qty / item / matched product, with
flags and notes), then the raw JSON `{ items, summary }`.

### ASDAIR_DB_URL must be a least-privilege, READ-ONLY role

`ASDAIR_DB_URL` must point at a **least-privilege, READ-ONLY database role** that
holds `SELECT` (and nothing else) on the `asdair` schema. **Do NOT** use a
superuser DSN or the Supabase service-role connection string here. The adapter
only ever issues SELECTs inside a `BEGIN TRANSACTION READ ONLY`, but the DB role
is the real backstop: a SELECT-only grant means even a bug or a bad input
physically cannot write. Example provisioning (run once, as an admin, OUTSIDE
this tool):

```
create role asdair_ro login password '...';           -- store the password only in ASDAIR_DB_URL
grant usage on schema asdair to asdair_ro;
grant select on all tables in schema asdair to asdair_ro;
alter default privileges in schema asdair grant select on tables to asdair_ro;
```

### Handling live output (contains real household data)

A clean database is built from `db/001_asdair_schema.sql` alone (the seed with
real rows is gitignored), and the CLI runs strictly read-only against it. Once it
is pointed at the live `asdair` schema, though, the basket plan it prints is
**real household data** (real list items, real product preferences, real
budgets).

**SUPERSEDED (Warwick's ruling, 2026-07-27): shopping content is explicitly NOT
a privacy matter.** This paragraph previously warned that live basket output was
personal data and must never leave the machine. That is no longer the rule, and
it directly contradicted the contract and SOP-021 -- a fresh Asdair instance
found the conflict and had no reliable way to adjudicate it beyond noticing one
statement carried a date.

Baskets, items, brands, quantities and preferences may be reported plainly. Do
not redact them or add data-sensitivity ceremony.

What still applies is **secrets**, which is security rather than privacy: no
tokens, connection strings, passwords or key material in git, logs or any shared
channel. Separately -- and for engineering reasons, not secrecy -- committed
fixtures stay synthetic, because runtime STATE belongs in Postgres where the
planner can read it, never in repo files. See [[SOP-021-run-the-weekly-asdair-shop]].

## Run the tests

```
cd services/asdair/skill
node --test
```

The test suite uses **synthetic fixtures only** ("Widget A", "Generic Milk 2L",
household ids 1/2). It contains zero real household data and is safe to run in CI
on the public repo. The planner and its tests have no third-party dependencies.

## Hard guardrails

- **Read-only.** The adapter issues SELECT only, inside a read-only transaction.
  The planner has no side effects. Nothing here writes to the database.
- **No browser, no checkout, no pay.** The planner produces a plan; it never
  emits a checkout / pay / place-order action. A test asserts the output surface
  is strictly `{ items, summary }` with no action verbs.
- **Never auto-substitute.** Out-of-stock / ambiguous / not-confidently-matched
  items become `needs_decision`; alternatives are surfaced in the note (and as
  ranked candidates) for a human and are never written into `matched_product`.
- **No secrets in git.** The connection string lives only in `ASDAIR_DB_URL`.
- **No personal data in git.** All committed fixtures are invented. Pure ASCII
  throughout; currency is written as "GBP".
