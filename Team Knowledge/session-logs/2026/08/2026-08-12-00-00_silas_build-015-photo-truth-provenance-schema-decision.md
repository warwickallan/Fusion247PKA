---
agent_id: silas
session_id: build-015-photo-truth-provenance-schema-decision
timestamp: 2026-08-12T00:00:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-015 AsdAIr — schema decision: photo-truth provenance, region grounding, dedup, six-value Cockpit state

Commissioned by Larry to unblock the vision-pipeline Work Order about to go to Keel
(`Deliverables/2026-08-11-cockpit-and-vision-pipeline-design.md` Part 1), which needed a
`schema_decision` citation before Keel's contract would accept it as anything other than
under-specified.

## Correction surfaced during the commission

Larry's brief named `017_shop_decision.sql` as the latest migration and asked for a `018_*` file.
That was stale — `018_remembered_choice.sql` and `019_shopping_list_shop_identity.sql` already
exist in `services/asdair/db/`. Verified by directory listing before writing anything. The real
next number is **020**. Flagged back to Larry rather than silently numbered 018 and collided.

## What I did

Read `Deliverables/2026-08-11-cockpit-and-vision-pipeline-design.md` Part 1 in full and
`Deliverables/2026-08-11-pax-vision-pipeline-and-luna-sol-terra-research.md` Finding 2 (Pax's
independent technical review, in particular the cross-strip dedup gap it names). Read every
existing migration under `services/asdair/db/` to understand this build's actual conventions
before proposing anything — composite-FK same-shop binding (017/018), insert-only-by-absent-grant
immutability (016/017/018), the ADD→BACKFILL→INDEX→DROP-OLD ordering discipline (019), and the
"evidence is a join, never a copy" rule (018).

Wrote `services/asdair/db/020_shop_line_provenance_and_human_state.sql` (authored only, not
applied — no live database access, per the commission's explicit boundary) and
`Deliverables/2026-08-12-silas-schema-decision-photo-truth-and-cockpit-state.md` (the citable
reasoning document).

**The three decisions:**

1. **`asdair.shop_image_region`** (new table) — the application-owned, model-cannot-write list of
   numbered regions a photograph is cut into. **`asdair.shop_line_provenance`** (new table) — one
   row per interpreted line, closed four-value `provenance` vocabulary (`PHOTO`/`REGULARS`/`RULE`/
   `WARWICK`). The anti-hallucination invariant is a CHECK biconditional
   (`(provenance = 'PHOTO') = (source_region_id is not null)`) combined with a composite foreign
   key binding the cited region to the row's own `shop_id` — a PHOTO row without a resolvable,
   same-shop region is structurally unstorable, not merely flagged. New table chosen over
   extending `asdair.shop_line` because of a genuine grain mismatch (shop_line has no
   REGULARS/RULE/WARWICK concept, its unique index refuses the multiple pre-dedup candidate rows
   this ledger needs to be able to hold, and its INSERT/UPDATE column allowlist is frozen by
   migration 016's own ruling). One evidence join point added:
   `shopping_list_items.evidence_provenance_id`.
2. **`asdair.shop.human_state`** (new column, not a side table, not a Postgres `GENERATED`
   column) — the six-value canonical state (`NEEDS_WARWICK`/`ASDAIR_WORKING`/`READY_FOR_WARWICK`/
   `BROWSER_WORKING`/`COMPLETE`/`FAILED`). Plain column because the `status → human_state` mapping
   is a genuine product/UX judgement call this build already keeps in application code
   (`shopState.js`'s `TERMINAL_STATUSES`/`LIVE_STATUSES` precedent), not a database fact — a
   `GENERATED` column would need a drop-and-recreate migration every time the mapping is tuned.
   Backfilled for existing rows (unlike `shop_decision`/`remembered_choice`'s no-backfill rule,
   because this is a mechanical re-expression of `shop.status`, already reliable on every row, not
   a fabricated decision). Two mapping calls flagged as arguable and left for Keel/Warwick to
   confirm (`BASKET_READY`, `CANCELLED`).
3. **Cross-strip dedup** — a single nullable, same-shop-bound self-referencing `superseded_by_id`
   on `shop_line_provenance`, deliberately reused for both cross-strip duplication and
   triggered-follow-up-re-read supersession (one mechanism, two structurally identical uses,
   rather than building two). Optional to populate — the pipeline may resolve dedup in memory and
   insert only the winner; the column exists so the resolution can be made auditable if Keel
   decides that's worth it, without a follow-up migration.

## Discipline notes for whoever reads this next

- Did not touch any JS/pipeline code, migration 012's grant matrix, or any file outside
  `services/asdair/db/**` and my own Deliverables output — matches the commission's explicit
  scope boundary.
- Verified all new CHECK constraint names are under Postgres's 63-character identifier limit
  before finalizing.
- Found and fixed my own draft's use of non-ASCII box-drawing characters (`─`, `·`) before
  writing the file — migrations 017/018 use them too despite each declaring itself "PURE ASCII,"
  a pre-existing minor inconsistency I chose not to replicate since I had the choice available.

## Next resumption point

Larry issues the Work Order to Keel citing
`Deliverables/2026-08-12-silas-schema-decision-photo-truth-and-cockpit-state.md` as
`schema_decision`, and `services/asdair/db/020_shop_line_provenance_and_human_state.sql` as the
migration file. Nobody has applied 020 to any database yet.
