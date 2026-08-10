# Schema decision — `asdair.shopping_lists` identity

- **Author:** Silas (Database Architect)
- **Date:** 2026-08-10
- **Build:** BUILD-015 / AsdAIr
- **Governance head:** `ce84d94`
- **Status:** DECISION PACKET — no migration written, no code edited, no live DB touched.
- **Scope of authority used:** read-only against the primary checkout. `credential_scope: none · live_authority: none · private_surface: none`.

---

## 1. The decision, in one line

**The date is not the identity of a shopping list — the SHOP is, and the schema already says so.**
Recommended: **Option C — add `shop_id` to `asdair.shopping_lists`, make it the uniqueness key, and demote `(household_id, list_date)` from a constraint to an index.** Forward-only, one migration (`019`), no existing row moved, rewritten or orphaned.

**The interim (shop-scoped working set via `shop_lines`) is safe as a bridge and is doing real work on the already-damaged 2026-08-10 rows. It is NOT safe to leave as the permanent answer.** The concrete reason is in §6 — it is not theoretical, and it is reachable on Warwick's real data with one ordinary next message.

---

## 2. What I verified myself (not taken on trust)

| Claim | Verified how | Result |
|---|---|---|
| No later migration relaxes the unique index | `grep -rniE "alter +table[^;]*shopping_lists\|drop +constraint\|drop +index\|shopping_lists_household" --include=*.sql services/` | **CONFIRMED.** Only `007` drops a constraint, and it is on `asdair.rules`. `shopping_lists` appears in `001` (table, FKs, `idx_lists_household`), `006` (FK from `shop.list_id`), `010`/`012` (grants only). Nothing alters the table after `001`. |
| The constraint has no `status` in it | `services/asdair/db/001_asdair_schema.sql:251` — `unique (household_id, list_date)` | **CONFIRMED.** A second row for the same household+date is refused whatever status it carries. Keel's consequence stands. |
| `listDateOf()` strips the `-M<n>` suffix | `services/asdair/pipeline/runPipeline.js:391-395` | **CONFIRMED**, and deliberately so — the comment at 382-390 explains why WP-B15-07 needs it. |
| `findOrCreateDraftList` keys on the bare date | `services/control-plane/wp-d-proof/asdairCommands.mjs:34-50` | **CONFIRMED.** `where household_id=$1 and status='next_week_draft' and list_date=$2 order by id desc limit 1`. |
| **The "UPSERT on `(list_id, lower(item_name))`" is NOT a database constraint** | `grep -rniE "unique.*shopping_list_items" --include=*.sql services/` returns **nothing**; `001:351-352` declares only `idx_list_items_list` and `idx_list_items_status` | **CONFIRMED, and load-bearing for this decision.** It is an application-level `select … for update` then insert-or-update (`asdairCommands.mjs:66-69`, `96-108`), serialised by `pg_advisory_xact_lock(household_id)` (`:64`, `:93`). Postgres enforces nothing here. |
| Two **live** shops can share one date | `services/asdair/shop/shopStore.js:297-329` looks up **only the plain-date ref**; `shopState.js:72` `TERMINAL_STATUSES = ['RECONCILED','CANCELLED']` | **CONFIRMED — see §6.** Once the plain-date shop is terminal, *every* subsequent non-redelivered inbound message for that date mints its own fresh `-M<id>` shop. Nothing checks whether an earlier `-M` shop is still live. |
| `asdair.shop.list_id` already exists | `services/asdair/db/006_shop_control_surface.sql:50` | **CONFIRMED.** The schema already asserts shop→list ownership. Today it contradicts the unique index. |

---

## 3. Is the date the right identity? No — and that is the original mistake

`001:236` says it plainly: *"One weekly list per household. list_date is unique per household."* That was a true statement about the intended **cardinality** of a well-behaved week, expressed as a **key**. Those are different things, and the difference is exactly what broke.

- `list_date` answers *"which week is this list for?"* — a **property**.
- The identity question every consumer actually asks is *"which shop does this list belong to?"* — and `asdair.shop.list_id` has answered it since migration `006`.

The schema is therefore **internally contradictory today**: one column says shop→list is 1:1; one index says list identity is (household, date). WP-B15-07 correctly moved shop identity off the bare date and grounded it in the inbound message. The list layer was left behind. This decision finishes that move rather than inventing a new idea.

**`list_date` stays, stays `not null`, and stays meaningful** — as the week the list is for. It is read by `skill/data.js:214,258,488,513`, rendered by `control-plane/cockpit/project-shopping.mjs:69-80`, and is the reason `listDateOf` refuses to consult a clock. What it stops being is a **key**.

---

## 4. Recommended option — C, "the shop owns the list"

New file: `services/asdair/db/019_shopping_list_owned_by_shop.sql`. House style of `006`/`008`: pure ASCII, no rows, no secrets, idempotent, forward-only. Depends on `001` and `006`.

**Ordering is deliberate and fail-safe: add → backfill → build the new indexes → only then drop the old constraint.** If any index build fails, the old constraint is still standing and the database is exactly where it started.

```sql
-- 1. The owning shop. NULLABLE on purpose: the cockpit and Shopper routes
--    legitimately create a list with no shop behind it.
alter table asdair.shopping_lists
  add column if not exists shop_id bigint references asdair.shop(id);

-- 2. Backfill from the link that already exists. THE LIVE SHOP WINS a shared
--    row (see the note below - this rule is not cosmetic).
with owner as (
  select s.list_id,
         (array_agg(s.id order by (s.status in ('RECONCILED','CANCELLED')) asc, s.id desc))[1] as shop_id
    from asdair.shop s
   where s.list_id is not null
   group by s.list_id
)
update asdair.shopping_lists sl
   set shop_id = o.shop_id
  from owner o
 where o.list_id = sl.id
   and sl.shop_id is null;

-- 3. Observability, not silence: say when a row had more than one claimant.
do $$
declare n int;
begin
  select count(*) into n from (
    select list_id from asdair.shop where list_id is not null
     group by list_id having count(*) > 1) x;
  if n > 0 then
    raise notice '019: % list row(s) were claimed by more than one shop; the live/most-recent shop was made owner. Items already materialised stay where they are and are NOT moved.', n;
  end if;
end $$;

-- 4. The real key: one list per shop.
create unique index if not exists uq_lists_shop
  on asdair.shopping_lists (shop_id) where shop_id is not null;

-- 5. Keep the guarantee the old constraint was genuinely providing, for the
--    unowned lane only (cockpit / Shopper with no shop behind them).
create unique index if not exists uq_lists_household_date_unowned
  on asdair.shopping_lists (household_id, list_date) where shop_id is null;

-- 6. Preserve the lookup the read path depends on, as an INDEX not a constraint.
create index if not exists idx_lists_household_date
  on asdair.shopping_lists (household_id, list_date);

-- 7. Drop the old constraint BY DISCOVERY - its name is auto-generated by
--    Postgres and must not be guessed.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'asdair.shopping_lists'::regclass and contype = 'u'
     and pg_get_constraintdef(oid) like '%(household_id, list_date)%';
  if c is not null then
    execute format('alter table asdair.shopping_lists drop constraint %I', c);
  end if;
end $$;
```

### Why "the live shop wins" is load-bearing, not a tie-break preference

On Warwick's real data, `SHOP-2026-08-10` (CANCELLED) and `SHOP-2026-08-10-M64` (live) almost certainly **both** carry `list_id` = the same row, because `stepInterpret` binds `shop.list_id` to whatever `findOrCreateDraftList` returned (`runPipeline.js:677-693`).

If the migration gave that row to the *earliest* shop, the CANCELLED one would own it and **M64 would be left without a list**. Its next write would create a fresh list — but `shop_line.list_item_id` is already set on its lines, and the replay guard at `runPipeline.js:679-684` will not re-materialise a line that already carries one. **M64's items would be stranded on a row it no longer owns.** Preferring the non-terminal shop, then the highest id, makes the still-running shop the owner and leaves the dead one — which will never write again — as the one without ownership. Harmless.

---

## 5. What happens to existing rows — precisely

| Row class | Effect |
|---|---|
| Every existing `shopping_lists` row | **Not deleted, not moved, not rewritten.** One nullable column is added (no table rewrite, no default, brief `ACCESS EXCLUSIVE` only). |
| A list linked from exactly one shop | Gets that shop's id as owner. Nothing else changes. |
| A list linked from more than one shop (the 2026-08-10 case) | Owned by the **live** shop. The terminal shop keeps its `shop.list_id` pointer — it is not nulled, so its history still reads correctly — it simply is not the owner. A `raise notice` names how many such rows existed. |
| A list linked from no shop (cockpit / Shopper origin) | `shop_id` stays NULL, and lands in the unowned lane, where `uq_lists_household_date_unowned` reproduces exactly the guarantee it has today. |
| Every `shopping_list_items` row | **Untouched. Not one item changes list.** The migration never moves an item between lists — that is a deliberate non-goal. |
| `orders.list_id`, `shop.list_id`, `shop_line.list_item_id`, `shop_question.list_item_id`, `product_alternatives.list_item_id` | All by id. All still resolve. Nothing is orphaned. |
| The already-damaged 2026-08-10 rows | **Left exactly as they are.** `019` makes tomorrow correct; the interim scoping is what makes today's shop usable. No data surgery, no retro-splitting of list item 210. |

`uq_lists_household_date_unowned` is guaranteed to build: the constraint it replaces already forbade any two rows sharing (household, date), so any subset is also unique.

---

## 6. Is the interim safe indefinitely? No. The named risk

The interim (scope each shop's working set to the items it created, via `shop_lines`) **correctly fixes the READ side** and should ship. It does not touch the WRITE key, and three things follow from that. I am naming the concrete mechanism, not a category.

**The reachable state.** `shopStore.createOrResumeShop` looks up `SELECT_SHOP_BY_REF_SQL` using the **plain-date ref only** (`shopStore.js:297-298`). `SHOP-2026-08-10` is CANCELLED, i.e. terminal. So the *next* photo or "forgot the milk" message Warwick sends on 2026-08-10 does not resume M64 — it mints `SHOP-2026-08-10-M<newid>` and **both are live at once**. Nothing in `collisionShopRef` or `createOrResumeShop` checks for a live `-M` sibling. This is one ordinary user action away on his real data, today.

**What then goes wrong, with the interim in place:**

1. **Silent quantity and status clobber — wrong groceries.** Both live shops resolve to the same `list_id`, so `add_list_item`'s select-then-update (`asdairCommands.mjs:96-108`) finds **one row** for "Milk". M64 asked for 2; the new shop asks for 1; the row becomes 1. M64's `shop_line.list_item_id` still points at it. The basket silently loses a unit, and the shop-scoped read cannot recover a value that no longer exists in the database. This is the interim's own stated limit, and it is the failure mode Warwick actually notices at the door.
2. **Spurious questions.** The same shared row's `status` flips to `needs_decision` under the second shop's interpretation, re-opening a question on the first shop's plan. Structurally identical to the item-210 defect that started this, one level down.
3. **The durable rulebook learns from a merged list.** `orders.list_id` is a single list; `reconcile/reconcile.js:251` compares the ASDA confirmation against "the original list", and `outcome/promoteDecision.js` writes the result back as durable rules and remembered choices. Learning from a union of two shops writes a **wrong rule that persists and re-fires every subsequent week**. Under Warwick's proportionality test this is the one that clears the bar: it is self-reinforcing corruption of important data and of the system's core function, not a display glitch, and it is not obvious from the outside which week taught it.

**Verdict:** the interim is correct, should ship now, and should stay as **provenance** — `shop_lines` is genuinely the right place to know which lines a shop owns. What must not become permanent is using it as a **substitute for the write key**. Retire the parts of it whose only job is filtering out foreign items once §8(d) passes; keep the rest.

---

## 7. What breaks — named by path

### Write path (must change; this is where the fix actually lives)

| Path | Change |
|---|---|
| `services/control-plane/wp-d-proof/asdairCommands.mjs:34-50` | `findOrCreateDraftList(client, householdId, listDate, shopId)`. When `shopId` is present: `select id from asdair.shopping_lists where shop_id=$1`; on miss, insert `(household_id, status, list_date, shop_id)`. When absent: **behaviour unchanged** — the unowned lane keeps today's query exactly. **This single change is the fix.** |
| `services/control-plane/wp-d-proof/asdairCommands.mjs:73-109` | `add_list_item` reads `args.shop_id` and passes it through. Args are free-form on the `command_request` payload (`shopperRoute.mjs:38`), and `assertAllowedIntents` (`pipeline/deps.js:721-729`) allowlists **commands only**, not arg keys — so this is purely additive. Validate it as a positive integer and fail closed on garbage, as every other arg does. |
| `services/asdair/pipeline/runPipeline.js:709-776` (`buildGroundedIntents`) | Emit `args.shop_id`. `shop.id` is already in scope at the call site (`:671-677`). |
| `services/asdair/pipeline/runPipeline.js:677`, `:1534-1555`; `services/asdair/pipeline/deps.js` (`realExecuteIntents`) | `executeIntents(intents, { householdId, listDate })` gains `shopId`. |
| `services/asdair/pipeline/runPipeline.js:26`, `:674-676` | Two comments assert the upsert is per-list idempotency. After this change that claim becomes **true**; before it, it was true of the wrong list. Update the wording, do not delete it. |
| `services/control-plane/wp-d-proof/asdairCommands.mjs:56-71` (`add_regular_to_next_week`) | **Behaviour consequence worth calling out.** No shop, so it stays in the unowned lane — meaning a cockpit "add to next week" tap would land on a *different* list from the live shop Warwick is running. That is not what he means when he taps it. Recommended safe default (an ordinary technical choice, not a Warwick decision): resolve the household's current non-terminal shop's list when one exists, else the unowned lane. |
| `services/hub/shopper/shopperRoute.mjs:24-51` | No change required — it has no shop and belongs in the unowned lane. Confirm that is intended rather than an oversight before implementing. |

### Read path

| Path | Effect |
|---|---|
| `services/asdair/skill/data.js:213-216` (`loadList`) | **The one read that genuinely breaks.** `… WHERE household_id=$1 AND list_date=$2 LIMIT 1` with **no `ORDER BY`** is non-deterministic the moment more than one list can share a date. Minimum repair: `ORDER BY id DESC`. Better: prefer the list owned by the household's live shop. Must ship in the same change. |
| `services/control-plane/cockpit/project-shopping.mjs:69-72` | Groups by `list_id`, displays `sl.list_date`, `order by sl.created_at desc limit 10`. Will now show two cards for one date. Cosmetic; label with `shop_ref`. **Non-blocking.** |
| `services/asdair/pipeline/store.js:270` · `shop/shopStatus.js:78` · `cockpit-api/readWorkspace.js:88,264` · `cockpit-api/assembleWorkspace.js` · `interpret/loadCatalogue.js:89` · `reconcile/reconcile.js:251` · `outcome/buildOutcome.js` · `skill/data.js:513-525` | All resolve by `list_id` or by FK. **Unaffected.** These are precisely the consumers that stop being polluted once each shop owns its own list. |
| `services/asdair/pipeline-runtime/proof/run-proofs.mjs:365,465-468,510,537` | Assert `counts.shopping_lists <= 1` / `=== 1`. These encode the one-list-per-run world. They are per-run and should still pass, but they are exactly where a wrong fix would surface — **re-read them against the new invariant, do not just watch them go green.** |

### Grants

`040_cockpit_grants.sql:47` already grants `select, insert, update on asdair.shopping_lists to cp_worker`; `010:84` grants `select, insert` to `asdair_rw`. These are **table-level**, so a new column is covered with no grant migration. The FK check against `asdair.shop` is expected to need no extra privilege for the inserting role because Postgres runs RI checks with the referenced table's owner privileges — **expected, not asserted: prove it by running the insert as `cp_worker` in the dbtest (§8e) rather than reasoning about it.**

### The `(list_id, lower(item_name))` upsert — what my option does to it

**Nothing, and that is the point.** It is application-level, not a constraint (§2). My option leaves the statement byte-identical and makes it *more* correct: it currently keys on a `list_id` that can be the wrong list; afterwards, `list_id` is the shop's own list, so the same statement becomes genuine per-shop idempotency — which is what `runPipeline.js:674-676` already claims it is. The "two live shops, one row, later write wins" loss in §6(1) disappears at the root, because the two shops no longer share a row.

**Explicitly rejected for this migration:** adding `create unique index on shopping_list_items (list_id, lower(item_name))` to make that idempotency structural. It is the right long-term shape, but live data may already hold duplicate rows from before the advisory lock covered every path, in which case the index build **fails and blocks the whole migration**. Do not bundle a build that can fail on live data with a change that must land. **Park it** as a separate, cheap, independently-provable step: count duplicates first, then decide.

---

## 8. Proof route — and `fakePg.js` is not it

**`services/asdair/pipeline/test/fakePg.js` cannot prove this option, and would go green on a fix real Postgres rejects.** Confirmed at `fakePg.js:1035-1049`: the `shopping_lists` insert handler pushes a row with **no uniqueness check of any kind**. Two further hazards specific to this change:

- The insert regex `^insert into asdair\.shopping_lists \(household_id, status, list_date\)` is **positional** and will stop matching once the statement gains `shop_id`. That fails loudly rather than silently, which is the good outcome — but the fake must be updated in the same change.
- The fake must additionally **model both new unique indexes**, or the offline suite stays blind to the exact class of defect that produced this packet.

**The real proof route is `services/control-plane/wp-d-proof/add-list-item.dbtest.mjs`, run by the `cockpit-db` job at `.github/workflows/build-002-tests.yml:72-96` against a real `postgres:16` service. Yes — that is the right harness. It is NOT sufficient as it stands.**

`add-list-item.dbtest.mjs:36-37` does `drop schema if exists asdair cascade` then applies **`001` only**. A `shop_id` FK to `asdair.shop` requires **`006`**, and the new index requires **`019`**. The harness must apply the chain (`001`, the `regulars` stub at `:39`, `006`, `008`, `019`). **Extending that harness is what decides whether this fix is real.**

Required new assertions, named so they cannot be fudged:

- **(a)** two lists, same household, same `list_date`, **different** `shop_id` → both insert. *This is the constraint that used to refuse, and the whole reason for the migration.*
- **(b)** a second list for the **same** `shop_id` → refused by Postgres (`23505`), not by application code.
- **(c)** two lists with `shop_id IS NULL` for the same household+date → refused by `uq_lists_household_date_unowned`.
- **(d)** `add_list_item` for the **same `item_name`** on the **same date** under `shop_id=A` and `shop_id=B` → **two distinct item rows with independent quantities.** *This is the §6(1) defect, proven closed. Without (d) the migration is unproven.*
- **(e)** the whole sequence executed **as `cp_worker`**, proving no grant is missing and the FK insert needs no extra privilege.
- **(f)** `019` re-applied → no-op, no error (idempotence, as every migration in this tree claims).
- **(g)** a pre-migration fixture with two shops pointing at one list → the **live** shop is the owner afterwards, and no `shopping_list_items` row changed its `list_id`.

Additionally: run `services/asdair/pipeline-runtime/proof/run-proofs.mjs` and read the assertions at `:365,465-468,510,537` — do not merely observe the exit code.

---

## 9. Alternatives rejected

| # | Option | Why rejected |
|---|---|---|
| **A** | **Do nothing — keep the interim, keep the constraint.** | A legitimate outcome that I considered seriously and am rejecting on evidence, not on principle. It leaves the write key wrong, and §6 shows the failure is reachable on Warwick's real data with one ordinary next message: silent quantity clobber, and a durable rulebook that learns from a merged list and re-fires that wrong lesson every week. Keeping a compensating control as permanent architecture after the root cause is understood is also the pattern this estate has already paid for once. |
| **B** | **Partial unique over non-terminal/non-archived lists** — `(household_id, list_date) where status not in (…)`. | Three defects. (i) It requires inventing and policing a `status` vocabulary that does not exist: `001:248` documents `pending\|processed\|archived`, the code writes `next_week_draft`, and there is **no CHECK constraint** — three vocabularies already. (ii) It requires an UPDATE to cancel the list when its shop is cancelled; **no code performs that today** and `asdair_rw` is not even granted UPDATE on `shopping_lists` (`010:84`). (iii) **It still fails the real case** — two *live* shops on one date are both non-terminal and would still collide. It fixes the incident that happened and not the one that will. |
| **C'** | **A free-text `source`/discriminator column** re-cut into the unique. | A discriminator with no referent is a second, weaker identity for something that already has a real one. It invites unconstrained `'shopper'`/`'cockpit'`/`'telegram'` strings, and it **cannot express "this list belongs to THAT shop"**, which is the question every consumer actually asks. If a column is being added, add the FK — `asdair.shop.list_id` already proves the relationship exists. |
| **D** | **Drop the unique entirely**, rely on the advisory lock. | Surrenders the one guarantee the constraint was genuinely providing — the unowned cockpit lane cannot fork — for no gain over C. C keeps it as `uq_lists_household_date_unowned`. |
| **E** | **`shop_id NOT NULL`** — every list must have a shop. | Over-reach. The cockpit and Shopper routes legitimately create a list with no shop, and minting a synthetic shop for them is machinery this outcome does not need. Nullable + partial unique is the honest shape and models reality exactly. |
| **F** | **Put items on `shop` and retire `shopping_lists`.** | Rewrites every consumer in §7, orphans `orders.list_id`, and forfeits the reconcile/history model, for zero product gain. This is the formal-data-modelling answer, and it is the wrong one for a household shopping brain. |

---

## 10. Proportionality check (Warwick's rule, applied honestly)

*"If this were actually exploited or failed, would it meaningfully affect Warwick's real life?"*

**Yes, narrowly and specifically** — on two of the named grounds and no others: **loss of the system's core function** (his photographed list was nearly lost once already, on 2026-08-10) and **corruption of important data** (the learning write-back durably teaching itself from a merged list, silently, every week thereafter).

What I am **not** doing on the back of that: no RLS work, no status ENUM, no audit table, no ownership model, no `shopping_list_items` unique index bundled in, no retro-repair of the 2026-08-10 rows, no new register or checker. **One migration, one column, three indexes, one function signature, one `ORDER BY`.** If the honest answer had been "the interim is fine", this packet would say so.

---

## 11. Handback

- **Warwick decision required:** none. This is an ordinary schema choice with a safe default and a proof route.
- **Not done here, deliberately:** the migration file, any service-code edit, any live-DB contact. This packet specifies `019`; it does not create it.
- **Sequencing recommendation:** ship the interim now (it is doing real work on the damaged rows) → implement `019` + §7 write-path + `data.js:214` → extend the dbtest harness per §8 and require (a)–(g) green in the `cockpit-db` job → then retire the interim's *filtering* role only, keeping its provenance role.

---

## 12. LARRY'S CROSS-CHECK — appended 2026-08-10, and clearly not Silas's work

> **This section is Larry's, not Silas's. Silas's analysis above is unaltered.** It is appended
> because Silas could not have known the fact below — it lies outside the schema scope it was given
> — and because a reader of §Handback alone would over-rate one severity claim.

**Silas's worst case does not currently fire.** §Recommendation warns that a merged list would let
`reconcile.js` / `promoteDecision.js` *"learn durable rules from a merged list that then re-fire
every subsequent week"*. That is the correct reading of the schema — **but the learning path is not
wired.**

`services/asdair/pipeline/deps.js:317` states **`DELIBERATELY NOT WIRED HERE: promoteDecision`**,
and `buildAnswerLearning` hard-errors on an absent `applies_going_forward` boolean precisely so
nobody can infer it. Established independently and recorded at
[[2026-08-10-finding-durable-learning-built-not-wired]].

**Consequence, and it cuts both ways:**

- **The interim mitigation is SAFER than §Recommendation assesses.** The durable-rule contamination
  — the most serious harm named — cannot occur today, because nothing writes a rule at all.
- **The urgency is therefore lower, and the deadline is real.** The moment the learning half is
  wired (queued behind WP-B15-09), a merged list becomes exactly as dangerous as Silas describes.
  **`019` must land before durable learning is switched on**, not before Warwick's next shop.

The remaining harms Silas names — silent quantity clobber through the shared row, and spurious
re-opened questions — are unaffected by this cross-check and stand as written.

**Nothing in §§1-11 is withdrawn.** The recommendation, the rejected options, the proof route and
the sequencing all stand; only the severity of one named consequence is corrected, and its timing
made explicit.
