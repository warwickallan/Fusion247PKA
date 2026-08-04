# asdair-packet — the Sonnet Browser Execution Packet producer

**BUILD-015 · WO-P (implemented under WO-2026-08-04-Z3).**

Turns resolved shop state into **one durable, deterministic, Brand A–Z ordered execution
packet** that validates against the committed contract, plus a phone-scannable checklist
rendering of the same packet in the same order.

> On 2026-08-03 Warwick's basket was built from **three plan files assembled by hand**, over
> about eight hours, against his own ~5 minute benchmark. The ruling is explicit:
> **"No Claude session constructs this packet manually."** This module is the product doing
> it instead.

Contract: `Builds/BUILD-015-asdair-durable-household-shopping-steward/SONNET-BROWSER-EXECUTION-PACKET.schema.json`
Process: `CANONICAL-WEEKLY-SHOP-PROCESS.md` §E · Runtime: `RUNTIME-DECISION.md` · Audit: blocker 3.

---

## What it is

Pure and deterministic, in the same discipline as `services/asdair/outcome/buildOutcome.js`:
no DB, no network, no fs, no clock, no randomness. It never mutates its arguments and it
returns a deeply frozen packet. **It reaches into nothing** — every input arrives as an
argument, so the caller owns all data access.

## Usage

```js
import { buildExecutionPacket } from '../packet/buildExecutionPacket.js';
import { renderChecklist } from '../packet/renderChecklist.js';

const packet = buildExecutionPacket({
  shop_ref:     'SHOP-2026-08-03',      // ^SHOP-\d{4}-\d{2}-\d{2}$
  generated_at: new Date(),             // REQUIRED — see "No clock" below
  household_id: 1,                      // optional
  lines: [ /* unsorted resolved lines — see below */ ],
  held:  [ /* optional standalone held entries */ ]
});

const checklist = renderChecklist(packet, {
  guidance: [{ text: 'A failed add means OUT OF STOCK, not an expired slot.', rule_id: 38 }]
});
```

### An input line

| Field | Required | Notes |
|---|---|---|
| `original_list_line` | yes | Verbatim, what was written on the photograph. Never lost. |
| `origin` | yes | `known` \| `new_approved` |
| `canonical_product_name` | yes | Looked up from **our rows**, never model prose. |
| `source_view` | yes | `regulars` \| `favourites` \| `search` — **taken explicitly, never inferred** |
| `required_quantity` | yes | Integer 1–99, already resolved by the caller |
| `canonical_product_id` | when `known` | Must be a real positive id; `null` is rejected for a known item |
| `asda_product_ref` | when `known` | 3–12 digits; `null` is rejected for a known item |
| `approved_search_term` | when `new_approved` | Warwick's approved wording, **never invented** |
| `brand` | no | `null` permitted and sorts last |
| `asda_url`, `substitutes_allowed`, `applied_rules`, `quantity_rationale`, `shop_line_no` | no | |
| `hold` | no | `{ reason, detail?, rule_id? }` — routes the line to `packet.held` |

Unknown keys are **rejected**, not ignored: a silently-dropped typo on `approved_search_term`
produces a packet that is wrong in the one way nobody notices.

## The sort — the entire speed argument

1. normalized brand A–Z, **`NULL`/blank brand last**
2. then normalized canonical product name A–Z
3. then input order, so the result is deterministic without relying on sort stability

`seq` is assigned **after** sorting. Normalization is NFKC → trim → lowercase → every
non-letter/non-digit run collapses to a single space. Comparison is by **code unit**, never
`localeCompare`, whose collation varies by platform and ICU version — that would make the
order irreproducible and defeat the point of publishing a sort contract at all.

`sort_contract: "brand_az_then_product_az"` is emitted so a consumer can **assert** the order
rather than trust it.

> **The limit of `sort_contract`, stated rather than implied.** `line.normalized_brand` lets a
> consumer reproduce the **primary** key from the packet alone. The contract declares no field
> for the product-name key and `line` is `additionalProperties: false`, so the **secondary**
> key cannot be emitted — a consumer verifying the full order must call the exported
> `normalizeSortKey()`.

## Reconciliation inputs

- `expected_total_units` — the **sum** of `required_quantity`, not the line count.
- `expected_distinct_products` — the count of distinct **product identities**
  (`canonical_product_id` → else `asda_product_ref` → else the normalized approved term).
  Two list lines resolving to one product count **once**, because that is what the basket
  actually shows. Counting lines would report a false mismatch the moment a list says milk
  twice.

Held lines are excluded from both.

## `held[]` — nothing is silently dropped

Every line deliberately not in the basket appears in `held[]` with a reason from the
contract's enum: `ambiguous`, `awaiting_decision`, `excluded_by_rule`, `not_stocked`,
`out_of_stock`, `possible_duplicate`.

**There is no `substituted` member, deliberately: substitution is never a permitted outcome
anywhere in this product.** A test asserts its absence against the committed schema file, so
adding it there fails the suite here.

Reasons are **taken explicitly and never inferred**. `asdair.shop_line.status` uses a
different vocabulary (`matched`, `needs_confirmation`, `unmatched_new_item`, `unreadable`,
`possible_duplicate`, `excluded`) and no mapping between the two is defined anywhere; this
module refuses to invent one.

### `source_view: "favourites"` is a forward contract, not a description of live data

Same discipline for `source_view`, and here the gap is wider than "unconstrained". Verified
live on 2026-08-04: **`asdair.regulars` holds 103 rows, every one of them `source = 'regular'`.
There is no `'favourite'` value anywhere in the table.** Favourites are not merely
unvalidated — they are entirely absent, while the canonical process requires Regulars and
Favourites to be distinguished end to end.

So `source_view: "favourites"` is a **contract this producer honours the moment real data
exists**, not a claim that anything currently produces it. This module is unaffected either
way: it infers nothing from `regulars.source` and takes `source_view` from its caller,
rejecting anything outside the enum. `'regular'` and `'decisions-log'` are not members and
must never be silently mapped onto `'regulars'` — that mapping decision belongs at the wire
point, where the data is.

**An all-held shop throws**, naming the held count. The contract sets `lines.minItems = 1`, so
such a shop has no valid packet — and an empty or invalid packet reaching the Sonnet handoff
is worse than a hard stop.

## Defence in depth on the identity requirement

The original contract used `required` alone, which asserts **presence only**, and typed
`canonical_product_id`, `asda_product_ref` and `approved_search_term` as nullable. That made
this schema-valid:

```json
{ "origin": "known", "canonical_product_id": null, "asda_product_ref": null }
```

— a known item with **no identity at all**, which Sonnet could only resolve by free-searching
it, which is forbidden. Schema validation would have been trusted as proof of the one property
that branch exists to enforce, and it was not.

**Raised at read-back on 2026-08-04 and closed in the schema the same day** (`943a262`, which
added `not: { const: null }` to both conditional branches). **The hole is shut on both sides.**

This module **still rejects it independently**, and that is deliberate: a schema is a contract,
not a substitute for the producer's own guard, and this half must hold even if the contract is
ever loosened again. The test asserts both — that the committed schema rejects the null-identity
shapes, and that the producer rejects them on its own account. It asserts the *property*, not
the mechanism, so a schema that closes the hole a different way still passes.

## No clock

`generated_at` is **required from the caller**. This module has no clock and never invents a
timestamp — the same rule `buildOutcome.js` follows, and what keeps the output deterministic.

## The checklist

`renderChecklist(packet, { guidance })` renders the same packet, in the same order, as pure
ASCII wrapped to 72 columns for a phone. It **renders; it never re-derives** — order, `seq`,
counts and identity all come straight from the packet, so the checklist and the JSON cannot
disagree.

Standing boundaries (never free-search a known item; never substitute; never book a slot,
check out or pay; stop at a checkout-ready basket) always appear, whatever the caller passes.
They are product invariants from `RUNTIME-DECISION.md`, not rulebook rows.

**Packet-level guidance** (e.g. rule 38, *"a failed add means OUT OF STOCK, not an expired
slot"*) is passed in as `options.guidance` and printed with its rule id, so a rule that fires
is visible and attributable — the concern behind D-2026-08-04-04.

> **There is no schema-valid home for guidance inside the JSON packet.** The contract's root is
> `additionalProperties: false` and declares no such property, so guidance lives on the
> checklist only. A handoff that needs it in JSON must carry it alongside the packet. Reported
> rather than worked around.

Guidance **text is not hardcoded here** on purpose: rule 38 lives in `asdair.rules`, and
copying its wording into source is how a rulebook and its renderer drift apart.

## `schemaAssert.js` — and why it fails closed

`dependency_policy: no-new-runtime-deps`, and no validator is reachable from
`services/asdair/**`, so this is a small draft-2020-12 subset validator rather than `ajv`.

**It throws on any keyword it does not implement.** A partial validator that silently ignores
what it does not understand is worse than no validator: it returns a confident green over
ground it never examined. The contract is owned by someone else and is being tightened; if
that introduces an unsupported keyword, the correct outcome is a loud `NOT VALIDATED` failure,
never a quiet pass.

Two deliberate deviations, both **stricter** than the draft so neither can manufacture a false
green: `format` is asserted rather than annotated, and only the 2020-12 single-schema form of
`items` is accepted.

`schemaAssert.test.js` mutation-tests the validator itself — one deliberately-broken instance
per keyword class it claims to implement — because a validator nobody has watched reject
anything is an untested control.

## Tests

```
cd services/asdair/packet
npm test
# or: node --test schemaAssert.test.js buildExecutionPacket.test.js renderChecklist.test.js
```

The test script names files **explicitly**. On this estate's Node (v22.18.0)
`node --test <dir>` fails with `MODULE_NOT_FOUND`, and `node --test "<glob matching nothing>"`
**exits 0 having run zero tests** — a stale path would then report success. Always read the
executed count, never just the exit code.

Tests load the committed schema **from the build folder by relative path** rather than from a
vendored copy: the whole value of "validated against the schema" is that the schema is a
literal held *outside* the code under test. A missing schema **throws** and is never caught
into a skipped test.
