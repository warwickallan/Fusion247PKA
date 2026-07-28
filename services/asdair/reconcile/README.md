# asdair/reconcile — the order-confirmation loop

**What it does:** takes the real ASDA **order confirmation** Warwick pastes into ShopperBot, parses it, compares it
line by line against the **stored plan**, and records both — so the shop that actually happened becomes durable
learning for next week instead of evaporating with the session.

It closes the last open link in the loop:

```
list → plan → approve → shop → basket → ORDER CONFIRMATION → reconcile → learn → next week's plan
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        this module
```

| Module | What it is |
|---|---|
| `parseConfirmation.js` | **Pure.** Pasted confirmation text → structured lines (name, quantity, pack size, promotion, price) plus the order total *when ASDA showed one*. No DB, network, fs, clock or randomness. |
| `reconcile.js` | **Pure.** Parsed confirmation + the stored plan + the original list + regulars → one `outcome` per line, plus a summary. Matches using the **planner's own** `normaliseTerm`. |
| `recordConfirmation.js` | Writes one confirmation: the `asdair.order_confirmation` header + all its `asdair.order_confirmation_line` rows, in a single transaction. Idempotent per shop. |
| `record-confirmation.js` | **The runtime caller.** `node --env-file=<env> record-confirmation.js --file <payload.json> [--dry-run]`. `--dry-run` validates the whole pipeline, prints what *would* be written and opens **no connection at all**. |
| `fixtures.js` | Test support only. Synthetic fixtures; no real household data. |

---

## THE PRICE CONTRACT

**Every line carries a required `price_basis`. It is a field, not a flag, and there is no code path that produces a
line without one.**

| `price_basis` | Meaning | `line_price` |
|---|---|---|
| `stated` | ASDA **explicitly showed** this price on this line. | the number ASDA showed |
| `derived` | ASDA did **not** show it. It was computed by subtraction from an ASDA-stated **order total**. **NOT an ASDA-quoted value and must never be presented as one.** | the computed number |
| `unknown` | No price is known. | **always `null`** |

### The critical rule

> **A line with no visible price gets `line_price: null` and `price_basis: 'unknown'`. A price is NEVER invented.**

Not `0`, not the shelf price, not an average, not last week's. Unknown is a first-class value and it survives all
the way into the database.

### When a price may be derived — and never otherwise

Derivation is **opt-in** (`derive_single_missing_price: true`) and is refused unless **all** of:

1. an **authoritative** order total was explicitly shown (`Order total`, `Total to pay`, …);
2. **exactly one** line is unpriced — two unknowns cannot be separated by one residual;
3. every other line is `stated` — derivation is never chained on top of another derivation;
4. the confirmation showed **no** non-product charge or adjustment (delivery, bags, service charge, savings,
   voucher, discount). If it did, the residual is not attributable to the missing line;
5. the residual is strictly positive (`>= 0.01`). A zero or negative residual is a parse disagreement, not a free
   item.

Every refusal is recorded in `derivation.blocked_reasons`, so *"why is this still unknown"* is always answerable.

### How the distinction is made impossible to lose

- `price_basis` is set **in the same object literal** as the number it describes. There is no window in which a
  derived amount exists without its basis.
- Parsed lines are **frozen**. `line.price_basis = 'stated'` throws.
- `formatLinePrice(line)` is the **only** sanctioned human presentation. Its three branches produce three
  non-overlapping strings, the derived one always contains the word **DERIVED**, and an out-of-vocabulary basis
  throws rather than falling through to the stated form:
  - `GBP 3.35 (as shown by ASDA)`
  - `GBP 3.50 (DERIVED by subtraction - NOT quoted by ASDA)`
  - `price not shown by ASDA`
- The **writer refuses** at the boundary, before any connection is opened: `unknown` with a price, `stated` or
  `derived` without one, `derived` with no stated total behind it, an `omitted` line carrying a price, or any
  basis outside the CHECK vocabulary.
- `asdair.order_confirmation.stated_total` means *"ASDA explicitly showed this"*. It is emitted as the **SQL
  literal `null`** unless `stated_total_basis === 'stated'` — it is not even a bound parameter otherwise — so no
  input value can put an inferred number into it.
- `summary.stated_line_price_sum` counts **only** stated prices. Derived amounts are summed separately, so
  "what ASDA said" and "what we worked out" stay separable at the total level too, not just per line.

**Quantities follow the same rule.** A quantity ASDA did not show stays `null`. It is never assumed to be 1.

---

## The seven outcomes

Every line — including plan-derived ones — gets **exactly one**:

| Outcome | Meaning |
|---|---|
| `as_planned` | Matched a planned line; same product, same quantity (or no quantity was shown, so nothing contradicts the plan). |
| `qty_changed` | Matched a planned line; both quantities known and different. |
| `variant_changed` | Matched a planned line, but a materially different product arrived. |
| `added_after_planning` | On the confirmation, not in the planned basket, but recognisable to this household (a regular, or a list line that was excluded / held for a decision). |
| `unmatched` | On the confirmation and recognisable as nothing at all. Deliberately **not** called an addition — we do not know whether it was bought off-plan or mis-parsed. |
| `omitted` | **Planned** and not on the confirmation. |
| `price_missing` | Matched and otherwise as planned, but ASDA showed no price. |

**Precedence** (why exactly one, and which one wins):

```
unmatched > added_after_planning > variant_changed > qty_changed > price_missing > as_planned
```

Match-quality findings outrank the price finding, because a line that is the *wrong product* is a bigger fact than
a line whose price was not printed. No information is lost: `price_basis`, `price_missing` and `note` ride on every
line whichever outcome won, and the summary counts unpriced lines separately. The ladder is **data**
(`OUTCOME_PRECEDENCE`), not a chain of `if`s, so "exactly one outcome" and "which one wins" are the same statement.

### `omitted` is derived from the PLAN, and can be derived no other way

A thing absent from a receipt is only *omitted* if it was actually **planned**. So `omitted` lines are produced
**only** by walking the stored plan and finding planned lines that no confirmation line claimed. They can never be
inferred from the confirmation, because a receipt cannot mention what is not on it.

- "Planned" means the plan line's status is `add`. A line the planner held for a decision, or excluded, was never
  going to be bought — its absence is correct behaviour, not an omission.
- With an **empty plan**, `omitted` is always zero, no matter what the receipt says.
- An omitted line is emitted with `price_basis: 'unknown'`, `line_price: null`, and a `note` that says it is
  **plan-derived, not from the confirmation**.
- `plan` is a **required** argument. Calling `reconcile` without it throws rather than guessing.

### Matching

Passes run exact-before-loose; each plan line is claimed at most once; an *ambiguous* candidate set matches
**nothing** rather than picking one (the planner's rule-6 discipline).

1. `asda_product_id` — the strongest identity there is.
2. Exact confirmation name == planned product name.
3. Exact confirmation name == the household's own list term.
4. Both sides resolve to the **same regular** (its name, an `aka` alias, or its `asda_product_id`).
5. Bounded containment — one name wholly contains the other, **mutually unique** pairings only.
6. Significant-word overlap — the deliberately loose last pass, planned lines only, mutually unique only. This is
   what surfaces genuine substitutions. Every match it makes records its evidence in the line's `note`.

Normalisation is the **planner's own** `normaliseTerm`, imported from `services/asdair/skill/planner.js` rather
than reimplemented, so the reconciler can never drift from the planner and report a matched line as omitted. That
folder is read-only by contract and is only ever **read** here.

Household scope is the same boundary the planner enforces: global rows plus the active household's, never another
household's, and never an inactive regular.

---

## Idempotency — the natural key

```
NATURAL KEY = (shop_id, content_fingerprint)
```

`content_fingerprint` is a SHA-256 over the confirmation's own **evidence**: its normalised `raw_text`, or its
`raw_media_path` when there is no text, plus the `source_kind`. Normalisation folds line endings, trailing
whitespace and leading/trailing blank lines — and nothing else, so a genuinely different confirmation always
produces a different key.

- **Re-pasting the same confirmation is a no-op.** That is the real failure mode: a Telegram redelivery or an
  impatient second tap. The writer finds the existing row and returns it with `created: false`, `lines_written: 0`.
- **An amendment is new evidence, not a duplicate.** If ASDA changed the order the text differs, so the fingerprint
  differs, and it is correctly recorded as a second confirmation. Losing an amendment would be worse than storing
  two rows.
- It needs no id ASDA may or may not have printed, so it works for a paste, a photo transcript and a document
  alike — and the same text arriving as a paste and as a photo transcript are **not** conflated.

`asdair.order_confirmation` carries no unique index for this (migration 006 defines none), so uniqueness is
enforced **inside the transaction** with the shop row locked `FOR UPDATE`. Two concurrent submissions of the same
paste therefore serialise: the second finds the first's row and writes nothing. The fingerprint is stored at
`parsed->>'content_fingerprint'`, which is exactly where the lookup reads it.

---

## Credentials

The connection string comes **only** from `process.env.ASDAIR_WRITE_DB_URL` (falling back to `ASDAIR_DB_URL`). It is
never hardcoded, never passed on the command line, never printed and never logged, and **no credentials file is
ever read**. `pg` is required lazily, so every pure module and all of the validation loads and runs on a box with
no dependencies installed.

The writer needs `INSERT` on `asdair.order_confirmation` and `asdair.order_confirmation_line`, plus
`SELECT`/`UPDATE` on `asdair.shop` for the row lock — exactly the grants migration 006 provisions for `asdair_rw`.

---

## What this module never does

- **It never contacts ASDA.** No browser, no HTTP, no scraping — it reads text you already have.
- **It never books a slot, checks out, or pays.** Standing rule 8 is untouched; nothing here can place an order.
- **It never invents a price, a quantity or a total.** Unknown is a first-class value and survives to the database.
- **It never writes outside `asdair.order_confirmation` / `asdair.order_confirmation_line`.**
- **It never deletes anything.** Raw evidence is always retained; a reconciliation is re-derivable from the stored
  `raw_text` and `parsed` blob.

---

## Running it

```bash
# always dry-run first: full validation, no connection, no credentials needed
node record-confirmation.js --file payload.json --dry-run

# then record it
node --env-file=/path/to/asdair.env record-confirmation.js --file payload.json
```

Payload shape is documented at the top of `record-confirmation.js`. `plan` is required.

## Tests

```bash
node --test      # or: npm test
```

Everything is **offline**: pure-logic tests need nothing, and the writer is proven against a fake `pg` client that
records the statements it is given and keeps a tiny in-memory table. No connection is opened, no migration is
applied, and `ASDAIR_WRITE_DB_URL` is never set by the suite. Fixtures are synthetic only.

`schemaCompat.test.js` checks every column and CHECK vocabulary against `db/006_shop_control_surface.sql`. That
migration is delivered by a sibling work package; until it is on the same branch those checks **skip with a loud
reason** rather than failing, and start biting the moment it lands.

## Known gaps / worth a human glance

- **`asdair.order_confirmation_line.outcome` has no database CHECK** in migration 006, and the column comment there
  does not list `price_missing`. The vocabulary is enforced in `recordConfirmation.assertRecordable`;
  `schemaCompat.test.js` will fail if a CHECK is added later that omits an outcome this module emits.
- **The loose passes (5 and 6) are judgement, not proof.** Anything they match says so in its `note`
  ("worth a human glance"). A wrong pairing shows up as a `variant_changed` that should have been an
  `omitted` + `added_after_planning`, which is visible rather than silent — but it is still a human call.
- **Nothing here promotes learning into rules yet.** This module produces the reconciled record; turning
  `variant_changed` / `added_after_planning` into a durable `aka` alias or rule is `outcome/`'s job
  (`update-regulars.js`, `promoteDecision.js`) and is not wired to this output.
