---
title: "Schema decision — photo-truth provenance ledger, region grounding, cross-strip dedup, and the canonical six-value Cockpit/Telegram state"
date: 2026-08-12
author: Silas (Database Architect)
build: BUILD-015 AsdAIr
commissioned_by: Larry, for the vision-pipeline improvement Work Order about to go to Keel
reviews: Deliverables/2026-08-11-cockpit-and-vision-pipeline-design.md (Part 1),
  Deliverables/2026-08-11-pax-vision-pipeline-and-luna-sol-terra-research.md (Finding 2)
implements: services/asdair/db/020_shop_line_provenance_and_human_state.sql
status: SCHEMA DECISION AND MIGRATION FILE ONLY. Not applied to any database. Not pipeline code —
  that remains Keel's Work Order once this lands. Citable as the schema_decision field on that
  Work Order.
---

# Schema decision — photo-truth provenance, region grounding, dedup, and the six-value Cockpit state

## Correction to the commissioning brief, stated up front

The brief named `017_shop_decision.sql` as the latest migration and asked for `018_*`. That was
stale: `018_remembered_choice.sql` and `019_shopping_list_shop_identity.sql` already exist in
`services/asdair/db/`. The actual latest is **019**. This decision's migration is numbered
**`020_shop_line_provenance_and_human_state.sql`**, not 018. Larry's Work Order to Keel should cite
020.

## What this decides, in one paragraph

Two new tables (`asdair.shop_image_region`, `asdair.shop_line_provenance`), one evidence-only
column on an existing table (`asdair.shopping_list_items.evidence_provenance_id`), and one new
column on `asdair.shop` (`human_state`). Together they give the vision pipeline a durable,
anti-hallucination-enforced record of every line in a week's shop — where it came from, what the
model actually saw, which real region it points at, and whether a later, better reading superseded
it — plus a single canonical human-facing state column both Cockpit and Telegram read instead of
each deriving their own.

---

## Decision 1 — the durable photo-truth table

### New table: `asdair.shop_image_region`

The application-generated, model-cannot-write list of numbered regions (full page + overlapping
strips) a photograph is cut into during deterministic image prep, before any model call. This is
the region list the vision call is constrained to cite against.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity` | PK |
| `shop_id` | `bigint not null` | FK → `asdair.shop(id) on delete cascade` |
| `region_no` | `integer not null` | The number stamped into the prompt (1, 2, 3…). Unique per shop. |
| `region_kind` | `text not null` | `'full_page'` \| `'strip'` — closed vocabulary, CHECK-enforced |
| `pixel_top/left/bottom/right` | `integer`, nullable together | Crop bounds for Cockpit's "view the relevant photo region"; CHECK enforces all-four-or-none |
| `image_fingerprint` | `text`, nullable | sha256-hex evidence of which photograph, same shape as migration 016's fingerprint; **not an FK** — see "Why no dependency on 016" below |
| `created_at` | `timestamptz not null default now()` | |

Indexes: `(shop_id, region_no)` unique (one "region 2" per shop); `(id, shop_id)` unique (feeds the
composite FK from the provenance table below); `(shop_id, region_no)` plain index for ordered reads.

### New table: `asdair.shop_line_provenance`

One row per interpreted line, covering **all four** provenance kinds in one closed vocabulary:
`PHOTO`, `REGULARS`, `RULE`, `WARWICK`. PHOTO rows are written by the vision-interpretation stage
before enrichment runs; REGULARS/RULE/WARWICK rows are written by enrichment (or the explicit-
decision path) immediately after, into the same ledger.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity` | PK |
| `shop_id` | `bigint not null` | FK → `asdair.shop(id) on delete cascade` |
| `line_no` | `integer`, nullable | Ordinal within its own reading pass — informational, **not** a uniqueness key |
| `provenance` | `text not null` | `PHOTO` \| `REGULARS` \| `RULE` \| `WARWICK` |
| `source_region_id` | `bigint`, nullable | **The load-bearing anti-hallucination field.** Composite FK → `shop_image_region(id, shop_id)`, so a cited region must belong to *this shop's own* region list. |
| `interpreter_model` | `text`, nullable | e.g. `'gpt-5.6-terra'`; required for PHOTO |
| `prompt_version` | `text`, nullable | the household-aware prompt's own version tag; required for PHOTO |
| `raw_text` | `text`, nullable | literal text seen; required and non-empty for PHOTO |
| `matched_regular_id` | `bigint`, nullable | genuine FK → `asdair.regulars(id)` — a model/rule/decision cannot name a product that doesn't exist |
| `quantity` | `integer`, nullable | 1–999 when present |
| `confidence` | `numeric`, nullable | 0–1 when present; null is the honest value for a deterministic REGULARS/RULE/WARWICK addition |
| `superseded_by_id` | `bigint`, nullable | self-referencing composite FK, same-shop-bound — the dedup/re-read supersession trail (Decision 3) |
| `interpreted_at`, `created_at` | `timestamptz` | |

**The anti-hallucination constraint, exactly as commissioned:**

```sql
constraint shop_line_provenance_region_iff_photo check (
  (provenance = 'PHOTO') = (source_region_id is not null));
```

This is a biconditional, not a one-directional check: a PHOTO row **must** carry a resolvable
region (the ask), and — the stronger form — **only** a PHOTO row may ever carry one, so a
REGULARS/RULE/WARWICK row can never masquerade as photographically grounded. Combined with the
composite foreign key `(source_region_id, shop_id) references shop_image_region(id, shop_id)`, a
row asserting PHOTO provenance without a real, same-shop region is **structurally unstorable** —
a CHECK-and-FK combination violation at INSERT time, not an application-level habit the pipeline
code might skip.

**Provenance-specific completeness constraints**, mirroring `shop_decision`'s own per-kind CHECK
style (migration 017):

- PHOTO must carry non-empty `raw_text`, and both `interpreter_model` and `prompt_version`.
- REGULARS must carry `matched_regular_id` (a Regulars addition is, by definition, a known
  catalogue item).
- RULE / WARWICK must carry either `matched_regular_id` or non-empty `raw_text` — some real content,
  though not necessarily a catalogue match (a rule or Warwick's own decision can legitimately
  introduce a genuinely new item; that item's *name* is deliberately **not** re-invented as a column
  here — it already has a home at `asdair.shop_decision.decided_item_name`, and duplicating it would
  create exactly the "two things that are supposed to agree, written twice" defect migration 018
  names explicitly).

### Why a new table, not an extension of `asdair.shop_line`

Larry's brief offered either shape. This is a **grain and scope mismatch**, not a coverage gap —
the same category of reason migration 017 gave for not reusing `shop_question`:

1. `shop_line` (migration 008) is documented as the durable home for the *interpreted list* —
   photographed-or-typed lines, post-dedup, with a human-confirmation workflow bolted on
   (`confirmed_by`/`confirmed_at`/`status`). It has no concept of a REGULARS/RULE/WARWICK-origin
   line at all: per migration 017's own comment, a `source_kind='text'` shop has **no** `shop_line`
   rows.
2. `shop_line`'s `UNIQUE (shop_id, line_no)` assumes a single, positional identity per line — but
   the photo-truth ledger must legitimately hold **more than one** candidate row for the same
   physical line before cross-strip dedup resolves (this is Pax's Finding 2, item 2). Widening
   `shop_line` to tolerate that would break the invariant its own human-confirmation workflow
   depends on.
3. `shopStore`'s INSERT/UPDATE column allowlists on `shop_line` are frozen by migration 016's own
   ruling. Widening that table's shape reaches outside this migration's remit.

A new table keeps `shop_line`'s existing, working contract untouched. This is the same choice
migration 017 made for `shop_decision` and migration 018 made for `remembered_choice`: a new
invariant with a new grain gets a new table.

### The one evidence join point

`asdair.shopping_list_items` — the table that holds every line of the actual week's shop regardless
of origin, unlike `shop_line` which only exists for photo/typed lines — gets one new nullable,
evidence-only column:

```sql
alter table asdair.shopping_list_items
  add column if not exists evidence_provenance_id bigint
    references asdair.shop_line_provenance(id) on delete set null;
```

This is deliberately the **only** join point. A second link from `shop_line` itself was considered
and rejected — `shop_line.list_item_id` already reaches `shopping_list_items`, and a second,
parallel evidence path back to the provenance ledger would be exactly the duplicated-source-of-truth
risk this build has already been burned by (the two `normaliseTerm` implementations named in
migration 018). One path answers "why is this line in the shop" for all four provenance kinds.

### Why no dependency on migration 016 (`shop_source_image`)

016 is its own header's words: "AUTHORED, NOT APPLIED" as of 2026-08-08. Migrations 017/018/019
already established the pattern of not building a hard dependency on it. This migration carries its
own `image_fingerprint` column on `shop_image_region` rather than joining `shop_source_image`, for
the same reason — a fingerprint captured at intake for the whole photograph and a fingerprint
recorded per generated region describe genuinely different moments (intake vs. deterministic
image-prep), and forcing them to be the same column would hide a divergence rather than let it be
seen if one ever occurs.

### The honest limit, stated once

Naming a real region proves the model did not invent a location out of nothing. It does **not**
prove the model read the pixels inside that region correctly — it cannot. This is Pax's own
underlined caveat in Finding 2/3, and it is carried into the schema by not overclaiming what the
constraint proves.

---

## Decision 2 — where the six-value Cockpit/Telegram state lives

### New column: `asdair.shop.human_state`

```sql
alter table asdair.shop
  add column if not exists human_state text not null default 'ASDAIR_WORKING';
```

with a closed-vocabulary CHECK for exactly the six named values: `NEEDS_WARWICK`, `ASDAIR_WORKING`,
`READY_FOR_WARWICK`, `BROWSER_WORKING`, `COMPLETE`, `FAILED`.

**Decision: a column on the existing `asdair.shop` table, not a side table, and not a
database-generated column.**

- **Not a side table.** `shop_image_region`/`shop_line_provenance`/`shop_decision`/
  `remembered_choice` are all insert-only ledgers — each row is a permanent fact about a point in
  time. `human_state` is the opposite shape: it is a **live-updating summary** that changes as the
  shop's lifecycle advances, structurally identical to `shop.status` itself (which is already a
  plain, UPDATE-able column on `shop`, already in migration 012's LIFECYCLE grant tier). It belongs
  next to the thing it summarises.
- **Not a Postgres `GENERATED` column.** This was seriously considered — a generated expression
  would make "computed once, never independently derived" a database-enforced guarantee rather than
  a code-discipline one. It was rejected because the `status → human_state` mapping is a genuine
  **product/UX judgement call**, not a database fact — is `BASKET_READY` "ready for Warwick" or
  "AsdAIr still working while it reconciles"? Is a `CANCELLED` shop `COMPLETE` or something the six
  values don't cleanly cover? — and this build's own precedent (`shopState.js`'s
  `TERMINAL_STATUSES`/`LIVE_STATUSES` groupings) keeps exactly this kind of status-derived judgement
  in application code, where it can be tuned without a drop-and-recreate migration every time the
  mapping changes.
- **No new grant needed.** `asdair.shop` already carries `select, insert, update` for `asdair_rw`
  (migration 012). Postgres table-level privileges cover a column added later — a column-level grant
  here would be a no-op, per 017/018's own established reasoning.

**What this migration guarantees vs. what it deliberately leaves to Keel:** the six-value
vocabulary and the single column both surfaces read. The *mapping* from `shop.status` to
`human_state` is Keel's to implement, in `shopState.js`, in the same code path that already
transitions `status` — so Cockpit and Telegram only ever `SELECT human_state` and never
independently derive their own reading of it. That is the exact defect this column exists to close:
the design doc's "two pieces of status text on the same screen contradicting each other because they
were computed independently."

**Backfill.** Unlike `shop_decision`/`remembered_choice` (which refuse backfill because it would
fabricate a decision nobody made), `human_state` **is** backfilled, because it's a mechanical
re-expression of a fact — `shop.status` — that is already fully and reliably present on every
existing row. Leaving every historical row at the column default regardless of actual status would
itself be the misleading act (an old `RECONCILED` shop reading `ASDAIR_WORKING`). The migration's
backfill mapping is Silas's **proposed default**, flagged as such rather than asserted as final —
two calls are genuinely arguable (`BASKET_READY → READY_FOR_WARWICK` vs. `ASDAIR_WORKING`;
`CANCELLED → COMPLETE` as the nearest of six buckets) and are for Keel/Warwick to confirm when the
mapping function is actually written. For any shop still live at migration time, the backfilled
value is a safe placeholder corrected at that shop's very next legitimate status transition.

| `shop.status` | proposed `human_state` |
|---|---|
| RECEIVED, TRANSCRIBING, PROCESSING | ASDAIR_WORKING |
| NEEDS_DECISION | NEEDS_WARWICK |
| READY_TO_SHOP | READY_FOR_WARWICK |
| WAITING_FOR_BROWSER, SHOPPING | BROWSER_WORKING |
| BASKET_READY | READY_FOR_WARWICK *(arguable — confirm with Keel/Warwick)* |
| ORDER_CONFIRMATION_RECEIVED | ASDAIR_WORKING |
| RECONCILED | COMPLETE |
| FAILED | FAILED |
| CANCELLED | COMPLETE *(arguable — confirm with Keel/Warwick)* |

---

## Decision 3 — the cross-strip duplicate problem

**Schema implication: yes, but minimal — a single `superseded_by_id` self-reference, not a
merge-group system.**

`asdair.shop_line_provenance.superseded_by_id` is a nullable, same-shop-bound, self-referencing
composite FK: `NULL` means "this row is the current, canonical reading"; a non-null value points at
the row that replaced it. This single mechanism is deliberately reused for **two** structurally
identical situations rather than building two:

1. **Cross-strip duplication** — the same physical line read once from strip 2 and once from strip
   3. If the pipeline chooses to persist both raw candidate rows for audit before resolving, the
   losing row's `superseded_by_id` points at the winner.
2. **Triggered follow-up re-read** — a batched follow-up call producing a better reading for a line
   flagged uncertain in the initial pass. The improved row supersedes the earlier, uncertain one via
   the same column.

Both are, structurally, "a later row that replaces an earlier reading of the same physical thing."
Building two separate mechanisms for the same shape would be exactly the kind of regrowth this
build's operating discipline forbids.

**This does not force the pipeline to persist raw pre-dedup candidates.** The design's own pipeline
diagram places "durable photo-truth row per line" *after* the deterministic sanity-check/dedup
stage, meaning the cheapest valid implementation is: dedup resolves in memory, and only the winning
row is ever inserted. `superseded_by_id` exists so that if Keel decides the dedup step's own
decisions should be auditable (a real, evidence-culture argument given every other table in this
schema stores its resolution evidence), the schema can hold that without a follow-up migration — it
is optional to populate, never mandatory.

`ON DELETE SET NULL` on this self-FK (not `CASCADE`): if a superseding row is ever removed
(owner-level only — no role holds `DELETE` on this table), the superseded row simply reverts to
"not marked as superseded" rather than being destroyed alongside its replacement, which would
destroy audit evidence for the wrong reason.

---

## Grants and immutability

Both new tables are **insert-only**: `SELECT, INSERT` to `asdair_rw`, `SELECT` to `asdair_ro`,
`UPDATE`/`DELETE` granted to nobody — the same "immutability enforced by absent grants" model
migrations 016/017/018 already established. A better later reading is a **new superseding row**,
never an edit. The two new columns on existing tables (`shopping_list_items.evidence_provenance_id`,
`shop.human_state`) need no new grant statements — both tables already carry table-level `UPDATE`
for `asdair_rw` (migration 012), which automatically covers a column added later.

As with `shop_decision` and `remembered_choice` before them, `shop_image_region` and
`shop_line_provenance` will be **absent** from migration 012's enumerated grant matrix. That's now
four tables recorded as owed to a future matrix re-enumeration. 012 is deliberately not amended by
this migration.

---

## What this migration does not do

- Does not touch any JS/pipeline code. The `status → human_state` mapping function, the actual
  vision-call orchestration, the dedup logic, and the enrichment writer are all Keel's Work Order.
- Does not apply to any database. Authored only, per the commission's explicit boundary.
- Does not backfill `shop_image_region` or `shop_line_provenance` for any existing shop. Every
  `shop_line` row that exists today was interpreted before this ledger existed; synthesising
  evidence for it now would be fabricating a grounding call that never happened. An absent
  `shop_line_provenance` row means "interpreted before this ledger existed" or "not photo-sourced" —
  never "no evidence exists."
- Does not touch migration 012's grant matrix, migrations 016–019, or any other file under
  `services/asdair/db/**`.

---

*Migration file: `services/asdair/db/020_shop_line_provenance_and_human_state.sql`. Cross-references:
[[Deliverables/2026-08-11-cockpit-and-vision-pipeline-design]] (the design this decision implements),
[[Deliverables/2026-08-11-pax-vision-pipeline-and-luna-sol-terra-research]] (Finding 2, the
cross-strip dedup gap this decision closes), `services/asdair/db/017_shop_decision.sql` and
`018_remembered_choice.sql` (the composite-FK and insert-only-by-grant idioms this decision reuses),
`services/asdair/shop/shopState.js` (where the `status → human_state` mapping function belongs, not
written here).*
