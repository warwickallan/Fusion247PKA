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
   `planBasket({ listItems, rules, products, budget }) -> { items, summary }`
   No DB, no network, no fs, no clock, no randomness. Same inputs -> same output.
   All the shopping logic lives here (see "Standing rules" below).

2. **`data.js` - read-only Postgres adapter.**
   `loadList(listDate, household)`, `loadRules()`, `loadProducts()`,
   `loadBudget(household)`. **SELECT statements only** - no INSERT / UPDATE /
   DELETE / DDL anywhere. Every query runs inside a `BEGIN TRANSACTION READ ONLY`
   so the database itself rejects any accidental write.

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
4. Items are expected in Favourites / Regulars (informational).
5. Nothing is added unless it is explicitly on the list.
6. Out of stock or not confidently matched -> `needs_decision`, with any
   alternatives surfaced for a human. **NEVER auto-substitute.**
7. A normal shop is GBP 120-150 excluding delivery; the basket is **flagged**
   (never blocked) when the estimated total falls outside that band.
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

## Run the CLI (live acceptance)

The connection string comes ONLY from the environment. It is never passed on the
command line and never printed.

```
cd services/asdair/skill
npm install                      # installs pg (runtime dependency of the adapter)
export ASDAIR_DB_URL='postgres://...'      # bash
# or PowerShell:  $env:ASDAIR_DB_URL='postgres://...'

node cli.js --list-date 2026-07-13 --household mum
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

**WARNING: never paste live CLI basket output into public logs, PRs, ClickUp, or
any shared channel.** It is personal data. Keep live output on the local machine
only. Everything committed to this repo -- fixtures, tests, docs -- is synthetic
by rule; live runs are not, so they never leave your machine.

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
- **Never auto-substitute.** Out-of-stock / ambiguous items become
  `needs_decision`; alternatives are surfaced in the note for a human and are
  never written into `matched_product`.
- **No secrets in git.** The connection string lives only in `ASDAIR_DB_URL`.
- **No personal data in git.** All committed fixtures are invented. Pure ASCII
  throughout; currency is written as "GBP".
