# Cockpit ⇄ producer interface: the Sonnet packet and basket reconciliation

**Status:** PUBLISHED 2026-08-04 by Felix under WO-ZG. **Binding on the read side as built.**
**Authority:** Larry, 2026-08-04 — *"You publish; Keel matches."*
**Consumers:** the Cockpit AsdAIr **Packet** and **Reconciliation** views.
**Producers:** **WO-P** (packet, Keel) and **WO-S** (reconciliation, Keel) — **neither exists yet.**

> **Why this document exists.** The read side and the producers are being built in parallel by
> different agents. Disjoint file ownership prevents collisions; it does **not** prevent shared
> misunderstanding. Unbriefed, the Cockpit would have invented a contract Keel then had to match, and
> both halves would have gone green while disagreeing. So the read side publishes first and states
> exactly what it will read. **If this shape is wrong, change it here and tell Felix — do not quietly
> write something else.**

---

## 1. The canonical shape is the committed schema — not this file

`SONNET-BROWSER-EXECUTION-PACKET.schema.json` (tightened at `943a262`) is the **single source of
truth for the packet document**. This document does not restate it and must never be read as a second
definition of it.

Two consequences the cockpit relies on, both already in that schema:

- **Brand A–Z, then canonical product name A–Z.** `lines` arrive **pre-sorted**; `sort_contract`
  declares it so a consumer can assert rather than trust. **The cockpit renders `lines` in array
  order and does not re-sort.** The ordering is the speed in ASDA, so it is the producer's to own.
- **`applied_rules` and `quantity_rationale` are the point of the surface**, not decoration. They are
  what let Warwick see *why* a quantity is what it is. A packet that omits them technically validates
  and defeats the purpose; the cockpit shows an explicit "no rationale recorded" where they are
  absent, so their absence is visible rather than invisible.

---

## 2. Storage — what the producer writes

**Recommendation, and what the reader is built against: store the whole schema-valid document as
`jsonb`.** The schema is already committed and authoritative; a column-per-field contract would be a
second definition that must be kept in sync with it, and drift between the two would be silent.

```
asdair.execution_packet
  shop_id          integer  not null   -- FK asdair.shop(id)
  packet_version   integer  not null   -- mirrors payload->>'packet_version'
  generated_at     timestamptz not null
  payload          jsonb    not null   -- the FULL schema-valid document
  -- one row per shop; latest by generated_at wins if more than one is ever kept

asdair.basket_reconciliation
  shop_id          integer  not null   -- FK asdair.shop(id)
  reconciled_at    timestamptz not null
  payload          jsonb    not null   -- the document in section 4 below
```

The reader needs `SELECT` on both for the `asdair_ro` role. **A grant that is missing is a blocker at
runtime, not a detail to discover later** — please add it in the same migration.

---

## 3. Read route (built, mine)

```
GET /asdair/packet?shop=<shop_id|SHOP-ref>&household=<id>
```

Returns **both halves in one response**, because they are read on one screen, for one shop, at one
moment — and a phone should not pay two round trips for it. Each half is **independently nullable**:
the packet routinely exists before reconciliation does.

```jsonc
{
  "ok": true,
  "generated_from": "durable state only",
  "unknown_means_unknown": true,
  "shop_ref_display": "SHOP-2026-08-03",
  "packet": null,          // null = not produced yet. NOT an empty packet.
  "reconciliation": null   // null = has not run yet. NOT a zero reconciliation.
}
```

**`null` versus empty is load-bearing and the cockpit renders them differently.** `null` means the
producer has not run — the UI says so in words and shows nothing else. An object with `lines: []`
means it ran and found nothing, which is a completely different fact. **Never emit an empty document
to mean "not produced".**

The cockpit shell proxies this as `GET /api/asdair/packet?shop=…` (the browser never names a
host:port).

---

## 4. Reconciliation document — NEW, defined here

WO-S has prose but no schema. This is the shape the reader is built against, derived from the ruling
§3 requirements. **It is a proposal until Keel builds against it; say so if it does not fit.**

```jsonc
{
  "reconciliation_version": 1,
  "shop_ref": "SHOP-2026-08-03",
  "reconciled_at": "2026-08-03T18:12:00Z",

  // Headline counts. Ruling §3: a matching headline count alone is NOT sufficient proof.
  "expected_distinct_products": 12,
  "expected_total_units": 19,
  "actual_distinct_products": 11,
  "actual_total_units": 17,

  // Ruling §3 requires positive confirmation that none of these happened.
  // Tri-state on purpose: false = confirmed not done, null = NOT CHECKED.
  // The cockpit shows null as "not confirmed", never as a reassuring "no".
  "checkout_performed": false,
  "payment_performed": false,
  "slot_booked": false,

  "lines": [
    {
      "seq": 1,
      "canonical_product_id": 11,
      "canonical_product_name": "…",     // from OUR rows, never model prose
      "brand": "…",
      "expected_quantity": 2,
      "actual_quantity": 2,              // null = not found in the basket
      "identity_match": "exact",         // exact | different_product | missing | unexpected
      "quantity_match": "exact",         // exact | short | over | unknown
      "expected_product_ref": "1000001",
      "actual_product_ref": "1000001",
      "detail": null
    }
  ],

  // Deliberately NOT in the basket. "substituted" is not a permitted value anywhere
  // in this product, exactly as the packet schema's heldLine.reason forbids it.
  "unavailable": [
    { "original_list_line": "…", "canonical_product_name": "…",
      "reason": "out_of_stock",          // out_of_stock | not_stocked | ambiguous |
                                         // awaiting_decision | excluded_by_rule | possible_duplicate
      "detail": null }
  ],

  // In the basket but not in the packet — the other direction, which a count alone hides.
  "unexpected": [
    { "canonical_product_name": "…", "actual_product_ref": "…", "actual_quantity": 1, "detail": null }
  ]
}
```

### Rules the cockpit enforces on this document

1. **Unknown reads as unknown.** A missing count renders "unknown", never `0`. A **measured** zero
   renders `0`. These are different facts and the UI keeps them different.
2. **A count match is never presented as a pass on its own.** Headline counts and per-line identity
   are shown together, because equal totals with a wrong product is the failure the ruling names.
3. **`unavailable` is rendered visibly distinct from the basket lines**, and never as a substitution.
4. **`checkout_performed: null` is "not confirmed"**, not "no".

---

## 5. What the cockpit will NOT do

- **Not re-sort the packet.** Brand A–Z is the producer's contract.
- **Not compute reconciliation.** It renders what the producer recorded. If reconciliation has not
  run, it says so — it does not diff the packet against the basket itself and present the result as
  fact.
- **Not resolve upstream contradictions.** Where a line carries a claimed match with no catalogue id,
  the cockpit shows **both** and flags it. Resolving it in a view would be inventing.
- **Not write.** The reader is `SELECT`-only, inside a read-only transaction, over a read-only
  connection — same construction as `readWorkspace.js` and `readRules.js`.

---

## 6. Until the producers exist

Both halves return `null` and the cockpit degrades honestly:

> **The execution packet has not been produced for this shop yet.** Nothing is being guessed at — when
> the product generates one it will appear here, in Brand A–Z order.

That state is live now, and it is verified by fixture in `services/cockpit/render-vm-check.mjs`
(`fixtures/packet.sample.json` exercises the populated path, and a `null` scenario exercises this
one). **The absent-producer path is therefore already tested, not merely intended.**
