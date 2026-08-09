-- =====================================================================
-- BUILD-015 AsdAIr WP-B15-2 - migration 017
--
-- THE DURABLE CURRENT-SHOP DECISION.
--
-- Until this table, a human answer could not change THIS WEEK'S shop. The
-- answer path recorded `shop_question.answer_text` and then wrote one
-- `asdair.rule_qa_log` row with `applies_going_forward: false`, which
-- `planner.js` filters out on exactly that field - so every answer Warwick
-- ever gave was written, read back, and discarded. Meanwhile the only writer
-- of the human-resolution columns on `asdair.shop_line`
-- (`pipeline/shopLines.js markCorrected`) had ZERO production callers, and
-- `READY_TO_SHOP` was decided solely by `countOpenQuestions === 0` - so
-- closing a question, not deciding a line, is what made a shop "ready".
--
-- This table is the durable home of what an answer MEANT for the current
-- shop. It is deliberately NOT a learning record: nothing here touches
-- `asdair.rule_qa_log`, `applies_going_forward`, or rule promotion. Current-
-- shop meaning and future household learning are different concerns and are
-- stored apart (Warwick, 2026-08-09).
--
-- ── WHY A NEW TABLE AND NOT COLUMNS ON asdair.shop_question ──────────────────
-- (Silas's schema decision, 2026-08-09. Implemented, not re-derived.)
-- `asdair_rw` already holds TABLE-LEVEL UPDATE on `asdair.shop_question`
-- (006:207, restated in 012's LIFECYCLE tier), and Postgres table-level UPDATE
-- automatically covers every column added later. A decision stored there would
-- therefore be rewritable by `saveRender`, `recordAnswer` and anything else
-- holding that grant. Migration 016 set the estate's answer to this problem:
-- immutability enforced by ABSENT GRANTS survives every code path, where a
-- convention does not. A separate table is the only shape that inherits it -
-- below, `asdair_rw` receives SELECT and INSERT and nothing else, so a
-- decision cannot be rewritten by any code path that exists or is later
-- written.
--
-- ── WHY NOT asdair.shop_line ────────────────────────────────────────────────
-- A GRAIN ERROR, not merely a coverage gap. `shop_line` is one row per
-- PHOTOGRAPHED line `(shop_id, line_no)`; a question is one row per NORMALISED
-- item. `dedupeList` merges two photographed lines into one list item, so the
-- relation is N:1 - there is no single line on which to write the decision
-- even when lines exist. A `source_kind='text'` shop has no `shop_line` rows
-- at all, and the bridge in `runPipeline.js` is a tolerated miss
-- (`byReading.get(...) || null`). `shop_line.raw_reading` is also verbatim
-- photographic evidence inside INTERPRETATION_COLUMNS, so a re-read would
-- overwrite anything written there.
--
-- ── NUMBERING: WHY 017 ──────────────────────────────────────────────────────
-- Repo migrations are 001, 004-010, 012, 016 (gaps at 002, 003, 011, 013-015;
-- see 016's header for why 013-015 are not to be claimed). 017 is the next
-- free number and collides with nothing.
--
-- Depends on 001 (schema), 004 (regulars), 006 (shop, shop_question) and
-- 008 (shop_line). It does NOT depend on 016, which is authored-but-not-
-- applied, and applies cleanly whether or not 016 has reached the database.
--
-- ── NO BACKFILL, DELIBERATELY ───────────────────────────────────────────────
-- The three existing shops' questions were answered before this mechanism
-- existed. Synthesising decision rows for them would be fabrication of exactly
-- the kind catalogue grounding exists to prevent.
--
--   A MISSING shop_decision ROW MEANS "decided before this table existed" or
--   "not yet decided". IT NEVER MEANS "no decision was made".
--
-- Every projection over this table must honour that reading.
--
-- PURE ASCII, no secrets, no rows, idempotent and re-runnable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. asdair.shop_question - clarification rounds become real rows.
--
-- A clarification is a NEW question row, never a re-opened one. `recordAnswer`
-- is a compare-and-set on `status = 'open'` (bot/questionStore.js), so a
-- round-2 answer could only be recorded by forcing the status back to 'open' -
-- and round 1's answer lives in `answer_text` on that same row, which round 2
-- would then overwrite. That would destroy Warwick's exact original words,
-- which are the evidence every later decision rests on.
--
-- `(shop_id, question_key)` uniqueness (006:107) is UNTOUCHED. "Ask each
-- distinct question at most once per shop" still holds: a clarification is a
-- DIFFERENT question with a different, freshly derived key.
-- ---------------------------------------------------------------------
alter table asdair.shop_question
  add column if not exists question_round     integer not null default 1;

alter table asdair.shop_question
  add column if not exists parent_question_id bigint
      references asdair.shop_question(id) on delete cascade;

-- POSTGRES HAS NO `alter table ... add constraint if not exists`. Without a
-- guard, re-running this migration aborts the WHOLE file with 42710. There is
-- no precedent for this shape anywhere in services/asdair/db/ (every prior
-- constraint is inline in a `create table`), which is precisely why it is
-- spelled out rather than assumed.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_question_round_sane') then
    alter table asdair.shop_question
      add constraint shop_question_round_sane check (question_round >= 1);
  end if;

  -- Round 1 IFF no parent. Makes an incoherent chain unstorable, and limits
  -- the damage of asdair_rw holding table-level UPDATE on this table.
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

-- Required so shop_decision can carry a COMPOSITE foreign key and its shop_id
-- can never drift from its question's shop_id. Cannot fail: id is already the
-- primary key, so (id, shop_id) is trivially unique.
create unique index if not exists shop_question_id_shop_uniq
  on asdair.shop_question (id, shop_id);

-- One live round chain per parent: round N of a question cannot be opened
-- twice even if the key derivation were mis-derived.
create unique index if not exists shop_question_round_uniq
  on asdair.shop_question (shop_id, parent_question_id, question_round)
  where parent_question_id is not null;

-- ---------------------------------------------------------------------
-- 2. asdair.shop_decision - the carrier.
--
-- One row per question, EVER. The unique index on question_id is the
-- structural idempotency: a re-run of interpretation resolves to the SAME row
-- instead of producing a second, possibly different, reading of the same
-- answer. The writer is INSERT ... ON CONFLICT (question_id) DO NOTHING plus a
-- re-select, exactly as shopStore.openQuestion does.
--
-- The CHECK constraints below make every WRONG COMBINATION UNSTORABLE rather
-- than merely discouraged. That matters here more than usual: the rows are
-- written from a model's structured return, and a constraint the database
-- enforces is the only guard that does not depend on the interpreting code
-- being correct.
-- ---------------------------------------------------------------------
create table if not exists asdair.shop_decision (
  id                    bigint generated by default as identity primary key,

  -- Identity. The composite FK below makes shop_id provably equal to the
  -- question's shop_id: it cannot drift, and no code has to be trusted to
  -- keep it aligned.
  shop_id               bigint not null,
  question_id           bigint not null,

  decision_kind         text not null,

  -- WHAT WAS DECIDED. Exactly one shape per kind.
  -- decided_regular_id is a genuine FOREIGN KEY to asdair.regulars with NO
  -- ACTION on delete: a model cannot assert a product that does not exist -
  -- the database refuses the row rather than the code hoping to - and a
  -- decision can never be left dangling.
  decided_regular_id    bigint references asdair.regulars(id),
  decided_quantity      integer,
  decided_item_name     text,
  clarification_reason  text,

  -- ORTHOGONAL to decision_kind, and that is the point: "one packet, and yes
  -- get it every week" is simultaneously a quantity decision AND a forward
  -- signal, and a single enum could record only one of the two facts.
  -- STORED, ROUTED NOWHERE. Consuming it is Lane B and is parked.
  -- NULL and 'unclear' differ deliberately: NULL means no forward signal was
  -- expressed; 'unclear' means one was and it could not be read.
  forward_intent        text,

  -- WHO INTERPRETED, AND FROM WHAT.
  interpreted_by        text not null,
  interpreted_model     text,
  interpreted_at        timestamptz not null default now(),

  -- The model's structured return AND the sanitized grounding it was given,
  -- as two top-level keys: { "model_return": {...}, "grounding": {...} }.
  -- NEVER credentials, tokens or gateway configuration.
  decision_evidence     jsonb not null default '{}'::jsonb,

  -- Hash of the exact catalogue/decision packet supplied to the model, so
  -- "was this decided against the same catalogue?" is answerable without
  -- parsing jsonb. Evidence, not identity - nullable, like 016.byte_length.
  grounding_fingerprint text,

  -- EVIDENCE ONLY, NEVER IDENTITY. Present only for a photographed line that
  -- happened to map; null for typed lists, dedupeList-merged lines and
  -- rule-generated lines. Deliberately NOT composite-keyed to shop_id: it is
  -- corroboration, and a guard index would imply a reliability it does not
  -- have.
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

  -- A kind that names a stocked product must name a REAL one. The FK makes the
  -- id real; this makes its ABSENCE impossible. Same invariant as 008's
  -- shop_line_matched_has_id: nothing records a confident decision about
  -- nothing.
  constraint shop_decision_regular_required check (
    decision_kind not in ('existing_regular','quantity_change','variant_choice')
    or decided_regular_id is not null),

  -- A new item is by definition absent from the catalogue: it carries
  -- Warwick's approved NAME and never a regulars id.
  constraint shop_decision_new_item_shape check (
    decision_kind <> 'new_item'
    or (decided_item_name is not null and decided_regular_id is null)),

  -- ONLY a new_item may carry a name. Everywhere else the canonical name is
  -- looked up from asdair.regulars by id, so model prose can never masquerade
  -- as a product we stock (008's rule, extended to decisions).
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

  -- THE GOVERNANCE CONSTRAINT. A model-derived decision cannot exist without
  -- the evidence of what it was given. CANONICAL-WEEKLY-SHOP-PROCESS.md
  -- section B: "Record sanitized evidence of what catalogue and decisions were
  -- supplied to the model. Asserting that loadCatalogue() was called is not
  -- evidence."
  constraint shop_decision_terra_shows_its_work check (
    interpreted_by <> 'terra' or decision_evidence <> '{}'::jsonb),

  constraint shop_decision_grounding_fingerprint_shaped check (
    grounding_fingerprint is null or grounding_fingerprint ~ '^[0-9a-f]{16,128}$')
);

-- ONE decision per question, EVER - the structural idempotency described above.
create unique index if not exists shop_decision_question_uniq
  on asdair.shop_decision (question_id);

-- Per-shop read order, mirroring shop_event_shop_idx.
create index if not exists shop_decision_shop_idx
  on asdair.shop_decision (shop_id, id);

-- "What did we skip / what needs clarifying this week", mirroring
-- shop_question_open_idx and shop_line_shop_status_idx.
create index if not exists shop_decision_shop_kind_idx
  on asdair.shop_decision (shop_id, decision_kind);

-- No index on decided_regular_id. That query - "what have we decided about
-- product X over time" - is Lane B, and building an index for a parked lane is
-- exactly the anticipation the regrowth cap forbids.

-- ---------------------------------------------------------------------
-- 3. Grants.
--
-- SELECT + INSERT only. UPDATE and DELETE are granted to NOBODY, so a
-- current-shop decision is immutable BY GRANT rather than by convention -
-- 016's model, and the whole reason this is a table rather than columns on
-- shop_question (which asdair_rw may already UPDATE at table level).
--
-- No grant is needed - or permitted - for the two new shop_question columns:
-- Postgres table-level privileges already cover columns added later, and a
-- column-level grant here would be a no-op that misleads a future reader.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw absent - skipping 017 write grants';
    return;
  end if;
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

-- KNOWN LIMIT, DOCUMENTED RATHER THAN DISCHARGED. Because asdair_rw holds
-- table-level UPDATE on asdair.shop_question, the new question_round and
-- parent_question_id columns ARE mutable by the runtime. Fixing that would
-- mean revoking table-level UPDATE and replacing it with a column-level grant
-- - a breaking change to the live question write path against three live
-- shops, and rejected. shop_question_round_parent_agree prevents the most
-- damaging incoherence, and the DECISION itself - the thing that must never be
-- rewritten - is immutable in asdair.shop_decision.
--
-- RECORDED, NOT WORK: asdair.shop_decision is absent from migration 012's
-- enumerated grant matrix. A future matrix re-enumeration must pick it up.
-- 012 is deliberately NOT amended here.
