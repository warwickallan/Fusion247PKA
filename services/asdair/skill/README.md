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
  ring is exhausted - it will not silently repeat), or when a `map` rule FIXES
  the variant while an instruction says vary it. **That last conflict is live and
  real** (rules fix the men's deodorant variant while the decision log says
  rotate it) and it is Warwick's to settle, not the planner's.

  **What is NOT here:** a database carrier for the rotation instruction.
  `asdair.rules.directive` is CHECK-constrained to `info | exclude |
  needs_decision | map`, so a `rotate` directive cannot be stored without a
  migration, which is outside this layer. Until that lands the instruction must
  be passed in by the caller. The mechanism is live and tested; the row that
  would trigger it from live data is the remaining half.

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
