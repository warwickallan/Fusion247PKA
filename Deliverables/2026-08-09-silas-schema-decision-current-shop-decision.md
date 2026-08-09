# Schema decision — the durable CURRENT-SHOP decision (BUILD-015 WP-B15-2)

**Author:** Silas (Database Architect)
**Date:** 2026-08-09
**Governance head:** `d907350`
**Repo:** `C:\Fusion247PKA` · `private_surface: none`
**Status:** DECISION. Read-only dispatch — no migration authored, no live data touched.
**Scope boundary:** current-shop meaning only. Nothing here touches `asdair.rule_qa_log`,
`applies_going_forward`, or rule promotion. That is Lane B and it is parked.

---

## 1. The decision

> **Carrier: a NEW table, `asdair.shop_decision`, one row per question, INSERT-only by grant,
> with a composite foreign key to `asdair.shop_question`.**
>
> **Plus two columns on `asdair.shop_question` (`question_round`, `parent_question_id`) so a
> clarification round is a genuine second question row rather than an overwrite.**
>
> **Migration number: 017.**

**Keel's carrier reasoning is right and its placement is wrong.** The *question*, not the
*line*, is the correct anchor — I verified all four of its reasons and two of them are
decisive. But the decision must not be columns **on** `shop_question`, for a schema reason
Keel did not reach:

**`asdair_rw` already holds table-level `UPDATE` on `asdair.shop_question`** (migration 006
line 207, re-stated in 012's LIFECYCLE tier). Postgres table-level UPDATE automatically covers
every column added later. So a decision stored as columns on `shop_question` is **rewritable by
any code path that already holds the shop-question write grant** — `saveRender` and
`recordAnswer` among them. There is no way to make it immutable there without revoking
table-level UPDATE and replacing it with a column-level grant, which is a breaking change to
the live question write path and is not acceptable against three live shops.

Migration 016 established the estate's answer to exactly this problem, in its own words:
*"UPDATE and DELETE are deliberately granted to NOBODY — ... immutability enforced by absent
grants survives every code path."* A separate table is the only shape that lets a
current-shop decision inherit that guarantee.

Secondary, and weaker on its own but real: `shop_question` already carries three concerns —
the ASK (`question_key`, `question_text`, `candidates`), the RENDER contract
(`rendered_candidates`, `render_fingerprint`, `render_version`, `callback_index`, card ids)
and the RAW ANSWER (`status`, `answer_text`, `answer_source`, `answered_at`). The interpreted
decision is a fourth, and it is the only one of the four that must never change once written.

---

## 2. Assessment of Keel's four reasons — verified independently

| # | Keel's reason | Verdict | What I found |
|---|---|---|---|
| 1 | Coverage is not guaranteed | **UPHELD — decisive** | Confirmed at `pipeline/runPipeline.js:391-392`, `:409-424`. Questions are opened from `plan.items` (planner output over `asdair.shopping_list_items`); `shop_line` rows come only from the photo interpreter (`pipeline/shopLines.js` `upsertLines`). The bridge is `new Map(interpreted.map(l => [normaliseTerm(l.raw_reading), l]))` consulted as `byReading.get(...) \|\| null` — a tolerated miss. A `source_kind='text'` shop has **no `shop_line` rows at all**. |
| 1b | *(stronger than Keel argued)* | **ADDED** | It is not only a coverage gap, it is a **grain error**. `shop_line` is 1 row per *photographed line* `(shop_id, line_no)`; a question is 1 row per *normalised item*. `dedupeList` merges two photographed lines into one list item, so two `shop_line` rows map to one question. The relation is **N:1, not 1:1** — there is no single line on which to write the decision even when lines exist. That, not coverage alone, is what rules `shop_line` out. |
| 2 | Two of seven kinds not representable | **UPHELD** | `shop_line_status_known` (008:56-57) has no `clarification_required`. `raw_reading` is `not null` verbatim photographic evidence **and** is inside `INTERPRETATION_COLUMNS` (`shopLines.js:55-58`), so a re-read overwrites it — writing a chosen new-item name there would be both a semantic corruption and a transient one. |
| 3 | Third statement shape / `match_basis` overloading | **PARTIALLY UPHELD** | The "exactly two statement shapes" half is **weaker than stated**: `shopLines.js` holds five SQL constants (`UPSERT`, two `SELECT`s, `LINK_LIST_ITEM`, `MARK_CORRECTED`); the invariant the test pins is that the *mutating* shapes are INSERT and column-restricted UPDATE, with no DELETE. A decision write would still be an UPDATE. This is a module-ownership argument, not a schema argument, and carries no independent weight. The **`match_basis`/`match_confidence` half IS a schema argument and is upheld**: those columns mean *how confident the camera-read identity is*, and overloading them with *what Warwick decided* would destroy the invariant 008's header states — model reads, catalogue determines identity, human resolves. |
| 4 | Terra's provenance has no columns | **TRUE BUT NOT DECISIVE** | True of `shop_line` and equally true of `shop_question`. Columns can be added to either. It does not select a carrier. |

Reasons **1 (with 1b)** and **2** decide it. Keel refused correctly.

---

## 3. The seven kinds — where each one lands

The brief lists seven kinds. **Six are kinds; the seventh is an orthogonal attribute, and
conflating them would force a false choice.** *"One packet, and yes get it every week"* is
simultaneously a quantity decision **and** a forward signal. A single `decision_kind` column
could only record one of the two facts.

| Brief's kind | Where it lands |
|---|---|
| existing candidate / regular | `decision_kind = 'existing_regular'` + `decided_regular_id` |
| quantity change | `decision_kind = 'quantity_change'` + `decided_regular_id` + `decided_quantity` |
| skip this week | `decision_kind = 'skip_this_week'` |
| new item | `decision_kind = 'new_item'` + `decided_item_name` |
| variant choice | `decision_kind = 'variant_choice'` + `decided_regular_id` |
| clarification required | `decision_kind = 'clarification_required'` + `clarification_reason` |
| **forward-intent signal (yes/no/unclear)** | **`forward_intent text` — orthogonal, nullable, on every kind** |

`forward_intent` is **stored and routed nowhere.** It is a recorded signal about the current
shop's answer, not a learning input. Consuming it is Lane B.

`NULL` and `'unclear'` are deliberately different: `NULL` means no forward signal was
expressed; `'unclear'` means one was expressed and Terra could not read it.

---

## 4. The migration Keel can implement — migration 017

Forward-only. Idempotent. Pure ASCII. No rows. Depends on 001 (schema), 004 (regulars),
006 (shop, shop_question), 008 (shop_line). **Does not depend on 016**, which is
authored-but-not-applied.

### 4.1 `asdair.shop_question` — two columns and one guard index

```sql
alter table asdair.shop_question
  add column if not exists question_round     integer not null default 1;
alter table asdair.shop_question
  add column if not exists parent_question_id bigint
      references asdair.shop_question(id) on delete cascade;
```

Constraints — **Postgres has no `add constraint if not exists`, so each needs a `pg_constraint`
guard.** There is no precedent for this in `services/asdair/db/` (every prior constraint is
inline in a `create table`), so it is called out explicitly:

```sql
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_question_round_sane') then
    alter table asdair.shop_question
      add constraint shop_question_round_sane check (question_round >= 1);
  end if;

  -- Round 1 IFF no parent. Makes an incoherent chain unstorable, and is what
  -- limits the damage of the fact that asdair_rw holds table-level UPDATE here.
  if not exists (select 1 from pg_constraint where conname = 'shop_question_round_parent_agree') then
    alter table asdair.shop_question
      add constraint shop_question_round_parent_agree
        check ((parent_question_id is null) = (question_round = 1));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'shop_question_not_own_parent') then
    alter table asdair.shop_question
      add constraint shop_question_not_own_parent
        check (parent_question_id is null or parent_question_id <> id);
  end if;
end $$;
```

```sql
-- Required so shop_decision can carry a COMPOSITE foreign key and its shop_id
-- can never drift from its question's shop_id. Cannot fail: id is already the PK.
create unique index if not exists shop_question_id_shop_uniq
  on asdair.shop_question (id, shop_id);

-- One live round chain per parent: round N of a question cannot be opened twice
-- even if the key derivation were mis-derived.
create unique index if not exists shop_question_round_uniq
  on asdair.shop_question (shop_id, parent_question_id, question_round)
  where parent_question_id is not null;
```

`(shop_id, question_key)` unique (006:107) is **untouched**. "Ask each distinct question at
most once per shop" still holds — a clarification is a *different* question, with a different
key (see §5).

### 4.2 `asdair.shop_decision` — the carrier

```sql
create table if not exists asdair.shop_decision (
  id                    bigint generated by default as identity primary key,

  -- Identity. The composite FK makes shop_id provably equal to the question's
  -- shop_id: it cannot drift, and no code has to be trusted to keep it aligned.
  shop_id               bigint not null,
  question_id           bigint not null,

  decision_kind         text not null,

  -- WHAT WAS DECIDED. Exactly one shape per kind; the CHECKs below make every
  -- wrong combination unstorable rather than merely discouraged.
  decided_regular_id    bigint references asdair.regulars(id),   -- NO ACTION: a
                                                                 -- decision must
                                                                 -- never dangle
  decided_quantity      integer,
  decided_item_name     text,
  clarification_reason  text,

  -- ORTHOGONAL to decision_kind. Stored, routed nowhere. Lane B consumes it.
  forward_intent        text,

  -- WHO INTERPRETED, AND FROM WHAT.
  interpreted_by        text not null,
  interpreted_model     text,
  interpreted_at        timestamptz not null default now(),

  -- Terra's structured return AND the sanitized grounding it was given, as two
  -- top-level keys: { "model_return": {...}, "grounding": {...} }.
  -- NEVER credentials, tokens or gateway configuration.
  decision_evidence     jsonb not null default '{}'::jsonb,

  -- Hash of the exact catalogue/decision packet supplied to the model, so
  -- "was this decided against the same catalogue?" is answerable without
  -- parsing jsonb. Evidence, not identity - nullable, like 016.byte_length.
  grounding_fingerprint text,

  -- EVIDENCE ONLY, NEVER IDENTITY. Present only for a photographed line that
  -- happened to map; null for typed lists, dedupeList-merged lines and
  -- rule-generated lines. Deliberately NOT composite-keyed to shop_id: it is
  -- corroboration, and a guard index would imply a reliability it does not have.
  evidence_shop_line_id bigint references asdair.shop_line(id) on delete set null,

  created_at            timestamptz not null default now(),
  -- NO updated_at, DELIBERATELY. No role is granted UPDATE, so a column
  -- claiming to record a modification time would be a lie waiting to be told.

  constraint shop_decision_question_fk
    foreign key (question_id, shop_id)
    references asdair.shop_question (id, shop_id) on delete cascade,

  constraint shop_decision_kind_known check (decision_kind in (
    'existing_regular','quantity_change','variant_choice',
    'new_item','skip_this_week','clarification_required')),

  -- A kind that names a stocked product must name a REAL one. The FK above makes
  -- the id real; this makes its ABSENCE impossible. Same invariant as 008's
  -- shop_line_matched_has_id: nothing records a confident decision about nothing.
  constraint shop_decision_regular_required check (
    decision_kind not in ('existing_regular','quantity_change','variant_choice')
    or decided_regular_id is not null),

  -- A new item is by definition absent from the catalogue: it carries Warwick's
  -- approved NAME and never a regulars id.
  constraint shop_decision_new_item_shape check (
    decision_kind <> 'new_item'
    or (decided_item_name is not null and decided_regular_id is null)),

  -- ONLY a new_item may carry a name. Everywhere else the canonical name is
  -- looked up from asdair.regulars by id, so model prose can never masquerade as
  -- a product we stock (008's rule, extended to decisions).
  constraint shop_decision_name_only_for_new check (
    decision_kind = 'new_item' or decided_item_name is null),
  constraint shop_decision_name_shaped check (
    decided_item_name is null
    or (btrim(decided_item_name) <> '' and length(decided_item_name) <= 200)),

  constraint shop_decision_qty_required check (
    decision_kind <> 'quantity_change' or decided_quantity is not null),
  -- Mirrors 008's shop_line_qty_sane. Null means "not decided", never 1.
  constraint shop_decision_qty_sane check (
    decided_quantity is null or (decided_quantity > 0 and decided_quantity <= 999)),
  -- A skip decides nothing about how much. It MAY name the regular skipped.
  constraint shop_decision_skip_shape check (
    decision_kind <> 'skip_this_week' or decided_quantity is null),

  -- A reason exists IFF the decision is that a clarification is required.
  constraint shop_decision_clarification_shape check (
    (decision_kind = 'clarification_required') = (clarification_reason is not null)),
  constraint shop_decision_clarification_decides_nothing check (
    decision_kind <> 'clarification_required'
    or (decided_regular_id is null and decided_quantity is null)),

  constraint shop_decision_forward_intent_known check (
    forward_intent is null or forward_intent in ('yes','no','unclear')),

  constraint shop_decision_interpreter_known check (
    interpreted_by in ('terra','human','rule')),

  constraint shop_decision_evidence_is_object check (
    jsonb_typeof(decision_evidence) = 'object'),

  -- THE GOVERNANCE CONSTRAINT. A model-derived decision cannot exist without the
  -- evidence of what it was given. CANONICAL-WEEKLY-SHOP-PROCESS.md section B:
  -- "Record sanitized evidence of what catalogue and decisions were supplied to
  -- the model. Asserting that loadCatalogue() was called is not evidence."
  constraint shop_decision_terra_shows_its_work check (
    interpreted_by <> 'terra' or decision_evidence <> '{}'::jsonb),

  constraint shop_decision_grounding_fingerprint_shaped check (
    grounding_fingerprint is null or grounding_fingerprint ~ '^[0-9a-f]{16,128}$')
);
```

### 4.3 Indexes

```sql
-- ONE decision per question, EVER. This is the structural idempotency: a
-- re-run of interpretation resolves to the same row instead of producing a
-- second, possibly different, reading of the same answer. Writer pattern is
-- INSERT ... ON CONFLICT (question_id) DO NOTHING + re-select, exactly as
-- shopStore.openQuestion does.
create unique index if not exists shop_decision_question_uniq
  on asdair.shop_decision (question_id);

-- Per-shop read order, mirroring shop_event_shop_idx.
create index if not exists shop_decision_shop_idx
  on asdair.shop_decision (shop_id, id);

-- "What did we skip / what needs clarifying this week", mirroring
-- shop_question_open_idx and shop_line_shop_status_idx.
create index if not exists shop_decision_shop_kind_idx
  on asdair.shop_decision (shop_id, decision_kind);
```

No index on `decided_regular_id`. That query — *"what have we decided about product X over
time"* — is Lane B, and building the index for a parked lane is exactly the anticipation the
regrowth cap forbids.

---

## 5. Clarification rounds — the ruling (brief question 3)

> **A clarification round is a NEW `shop_question` ROW with `parent_question_id` set and
> `question_round = N`, whose `question_key` is a FRESHLY DERIVED 9-byte digest key — NOT a
> textual suffix on the parent key.**

### Why not one row, re-opened

Re-opening the existing row is not available. `recordAnswer` is a compare-and-set on
`status = 'open'` (`bot/questionStore.js:120-133`); after round 1 the status is `'answered'`,
so a round-2 answer can never be recorded unless the status is forced back to `'open'` — and
the only place round 1's answer lives is `answer_text` on that same row, which the round-2
answer would then overwrite. **That destroys Warwick's exact original words, which the brief
requires be preserved.** One row per round is forced by the schema as built, not chosen.

### Why NOT `<key>#clarify.1` — three independent blockers

1. **`#` is not a legal callback character.** `bot/callbackProtocol.js:107` —
   `FIELD_RE = /^[A-Za-z0-9._-]+$/`. `buildCallbackData` **never truncates, it throws**
   (`:38-45`). A question key containing `#` produces a clarification card that cannot be
   rendered at all.
2. **Byte budget.** `MAX_QUESTION_KEY_BYTES = 12` (`:118`); `questionKeyFor` emits exactly 9
   (`pipeline/keys.js:216, :234-240`). `qXXXXXXXX#clarify.1` is 19 bytes → throw.
3. **Even a legal short suffix is fragile by one character.** `parseAnswerArg` splits on
   `lastIndexOf('.')` (`:263`), so `qXXXXXXXX.c2` parses — at *exactly* the 12-byte ceiling,
   with zero headroom. `.c10` is 13 bytes and breaks. A scheme that survives rounds 2–9 and
   fails at round 10 is a latent defect, not a design.

### The derivation Keel must implement

```
round 1 : q + digest(normaliseTerm(itemName), 4)                  // BYTE-FOR-BYTE UNCHANGED
round N : q + digest(normaliseTerm(itemName) + '#' + N, 4)        // N >= 2
```

The `#` lives **inside the hash input**, never in the output. Every key stays exactly 9 ASCII
bytes forever, whatever the round number.

> ⚠️ **Round 1 keys must not change by a single byte.** Three live shops carry existing
> `shop_question` rows keyed by the current derivation; altering it orphans every open
> question and re-asks settled ones. Keel must add the round parameter as a branch that leaves
> the 1-argument call path byte-identical, and pin that with a test against a literal.

The key is opaque by design — it does not advertise that it is a clarification. That job
belongs to `parent_question_id` and `question_round`, which are readable, joinable, and
constrained.

---

## 6. Grants (brief question 4)

```sql
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw absent - skipping 017 grants';
    return;
  end if;

  -- SELECT + INSERT only. UPDATE and DELETE are granted to NOBODY, so a
  -- current-shop decision is immutable BY GRANT rather than by convention -
  -- 016's model, and the reason this is a table and not columns on
  -- shop_question (which asdair_rw may already UPDATE at table level).
  execute 'grant select, insert on asdair.shop_decision to asdair_rw';
  execute 'grant usage on sequence '
       || pg_get_serial_sequence('asdair.shop_decision','id') || ' to asdair_rw';
end $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_ro') then
    raise notice 'asdair_ro absent - skipping 017 read grant';
    return;
  end if;
  execute 'grant select on asdair.shop_decision to asdair_ro';
end $$;
```

Explicit grant implications:

- **`asdair_ro` gains `SELECT` and nothing else.** It stays SELECT-only. No `INSERT`,
  `UPDATE`, `DELETE` or sequence grant appears anywhere in 017 for that role.
- **`asdair_rw` gains `SELECT`, `INSERT` and sequence `USAGE` on `shop_decision` only.**
- **No new grant is needed — or permitted — for the two new `shop_question` columns.**
  Postgres table-level privileges cover columns added later, and 006/012 already grant
  `select, insert, update` on `asdair.shop_question` to `asdair_rw` and `select` to
  `asdair_ro`. Adding a column-level grant here would be a no-op that misleads a future reader.
- **A correction to migration 012 is owed but is NOT in 017's scope.** 012 is the enumerated
  complete grant matrix; `shop_decision` will be absent from it. Record it once — a future
  matrix re-enumeration must pick it up. Do not amend 012 in this Work Order.

### Known limit, stated honestly

Because `asdair_rw` holds table-level `UPDATE` on `asdair.shop_question`, the new
`question_round` and `parent_question_id` columns **are mutable** by the runtime. That is not
fixable without revoking table-level UPDATE, which is a breaking change against three live
shops and is rejected. The `shop_question_round_parent_agree` CHECK prevents the most damaging
incoherence (an orphaned or self-contradictory round), and the **decision itself** — the thing
that must never be rewritten — is immutable in `shop_decision`. This limit is documented, not
discharged.

---

## 7. Migration and data risk to the three existing shops

| Risk | Assessment |
|---|---|
| Table rewrite / long lock | **None.** `add column ... integer not null default 1` is a non-rewriting catalog-only operation on Postgres 11+. `parent_question_id` is nullable with no default. At three shops the scale is irrelevant regardless. |
| CHECK validation against existing rows | **Passes.** Every existing question backfills to `question_round = 1`, `parent_question_id = null`. `(null is null) = (1 = 1)` → true. `question_round >= 1` → true. `parent_question_id is null` → self-parent check true. Verified by inspection of the default. |
| Idempotency of the new constraints | **Requires the `pg_constraint` guards in §4.1.** `alter table ... add constraint` has no `if not exists` form; without a guard, a re-run of 017 fails with `42710` and the whole migration aborts. This is the single most likely implementation defect and there is no precedent for it in `services/asdair/db/`. |
| `shop_question_id_shop_uniq` | Cannot fail — `id` is already the primary key, so `(id, shop_id)` is trivially unique. |
| `shop_decision` creation | Zero risk. New table, no rows, nothing existing referenced destructively. |
| **Backfill** | **NONE, deliberately.** The three existing shops' questions were answered before this mechanism existed. Synthesising decision rows for them would be fabrication of exactly the kind catalogue grounding exists to prevent. **A reader must treat a missing `shop_decision` row as "unknown / decided before this table existed", never as "no decision was made".** Keel should encode that as a comment in the migration and honour it in any projection. |
| Dependency on 016 | **None.** 017 depends on 001, 004, 006 and 008 only. It applies cleanly whether or not 016 (authored-not-applied) has reached the live database. |
| Rollback | Dropping `asdair.shop_decision` loses only data created after 017. The two `shop_question` columns are additive and harmless if left in place. No forward-only migration is reversed. |
| Live/repo table drift | Unaffected. 017 introduces no dependency on the three live-only tables (`command_request`, `previously_ordered`, `skill_steps`), and reconciles nothing — per Warwick's ruling (Asda Build 002 SS3). |
| Public-repo data classification | The migration ships **structure and no rows**. `decision_evidence` will at runtime hold ordinary household shopping content, which GL-009 explicitly permits in this repository. It must **never** hold gateway credentials, tokens or account-session material — stated as a constraint on the writer, not on the schema. |

---

## 8. Anomalies found while verifying (for Larry's synthesis, not for this Work Order)

1. **`answer_text` is not always Warwick's prose.** For a *typed* answer it is his exact words;
   for a *button tap* it is the candidate label (`bot/resolveTap.js:507, :540` —
   `answerText: candidateLabel || candidateId`). The decision layer must not assume free text.
   This does not weaken the design — for a tap, the tap *is* the answer — but any code or
   document that says "Warwick's exact original words live in `answer_text`" is imprecise for
   half the paths.
2. **`asdair.shop_decision` will be absent from migration 012's enumerated grant matrix.**
   Recorded once here. Not work.
3. **Keel's reason 3 overstates the "exactly two statement shapes" invariant** (five SQL
   constants; the pinned invariant is INSERT + column-restricted UPDATE + no DELETE). It does
   not change the outcome and is recorded for accuracy only.

---

## 9. What this decision deliberately does NOT do

- No `rule_qa_log` column, join, trigger or write path.
- No `applies_going_forward`, no rule promotion, no cross-week aggregation, no index built for
  a cross-week query.
- No amendment to migration 012, 008 or 006.
- No change to `(shop_id, question_key)` uniqueness or to `openQuestion`'s
  `ON CONFLICT DO NOTHING` semantics.
- No new table, view, trigger, function or role beyond `asdair.shop_decision`.
