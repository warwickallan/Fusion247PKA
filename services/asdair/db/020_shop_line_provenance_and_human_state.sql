-- =====================================================================
-- BUILD-015 AsdAIr - migration 020: PHOTO-TRUTH PROVENANCE LEDGER,
--                                    REGION GROUNDING, AND THE CANONICAL
--                                    SIX-VALUE COCKPIT/TELEGRAM STATE
--
-- Silas's schema decision for the vision-pipeline + Cockpit design
-- (`Deliverables/2026-08-11-cockpit-and-vision-pipeline-design.md` Part 1,
-- and Pax's independent review in
-- `Deliverables/2026-08-11-pax-vision-pipeline-and-luna-sol-terra-research.md`
-- Finding 2). Reasoning is recorded in full in
-- `Deliverables/2026-08-11-silas-schema-decision-photo-truth-and-cockpit-state.md`;
-- this file is the IMPLEMENTATION, not a re-derivation.
--
-- THIS FILE DOES THREE THINGS, and they are independent enough to read
-- separately even though they land in one migration for one Work Order:
--
--   1. asdair.shop_image_region  - the application-owned, model-cannot-write
--      list of numbered regions (full page + strips) a photograph was cut
--      into. This IS the "region list" the vision call is constrained to
--      cite against.
--   2. asdair.shop_line_provenance - one row per interpreted line, covering
--      ALL FOUR provenance kinds (PHOTO, REGULARS, RULE, WARWICK), with the
--      anti-hallucination invariant enforced as a database CHECK + composite
--      FOREIGN KEY, not an application-level habit. Also carries the
--      cross-strip-duplicate / triggered-reread supersession trail.
--   3. asdair.shop.human_state - the durable home for the six-value
--      canonical human-facing state (NEEDS_WARWICK / ASDAIR_WORKING /
--      READY_FOR_WARWICK / BROWSER_WORKING / COMPLETE / FAILED), so Cockpit
--      and Telegram read ONE value instead of each deriving their own from
--      raw counts.
--
-- NUMBERING: WHY 020 ------------------------------------------------------
-- The commissioning brief for this migration named 017 as the latest file.
-- That was stale: 018 (remembered_choice) and 019 (shopping_list_shop_identity)
-- already exist in this tree. Repo migrations are 001, 004-010, 012, 016-019
-- (gaps at 002, 003, 011, 013-015 - see 016's header for why 013-015 are not
-- to be claimed). 020 is the next free number and collides with nothing.
--
-- DEPENDENCIES, STATED RATHER THAN ASSUMED --------------------------------
--   Depends on: 001 (asdair.shopping_list_items), 004 (asdair.regulars),
--               006 (asdair.shop), 008 (asdair.shop_line).
--   Does NOT depend on 016 (asdair.shop_source_image), DELIBERATELY. 016 is
--   its own header's words "AUTHORED, NOT APPLIED" as of 2026-08-08, and 017/
--   018/019 already established the pattern of not building a hard dependency
--   on it. This file carries its OWN image_fingerprint column on
--   shop_image_region rather than joining shop_source_image, for exactly that
--   reason - a fingerprint captured at intake for the whole photograph and a
--   fingerprint recorded per generated region describe genuinely different
--   moments (intake vs. deterministic image-prep) and do not need to be the
--   same column to agree; if they diverge, that is itself a signal worth
--   having, not a bug to hide by sharing one column.
--   Does NOT depend on 017 or 018 (shop_decision, remembered_choice). Nothing
--   here reads or writes either table.
--   Does depend on 019 having landed in spirit only, not by reference: 019's
--   shop_id column on shopping_lists is not touched or read here.
--
-- WHY A NEW TABLE (shop_line_provenance) AND NOT AN EXTENSION OF
--    asdair.shop_line ------------------------------------------------------
-- Larry's brief offered either shape. This is a GRAIN AND SCOPE mismatch, not
-- merely a coverage gap - the same category of reason 017 gave for not
-- reusing shop_question:
--
--   * shop_line is DOCUMENTED (008's own header) as "the durable home for the
--     INTERPRETED list" - photographed-or-typed lines, post-dedup, with a
--     human-confirmation workflow (confirmed_by/confirmed_at/status) bolted
--     on. It has NO concept of a REGULARS/RULE/WARWICK-origin line: a
--     source_kind='text' shop has no shop_line rows at all (017's own
--     comment), and shop_line's UNIQUE (shop_id, line_no) assumes a
--     positional identity on a photographed-or-typed page that a Regulars
--     addition simply does not have.
--   * The photo-truth ledger this migration adds must legitimately hold MORE
--     THAN ONE candidate row for the same physical line before cross-strip
--     dedup resolves (Pax's Finding 2, item 2) - shop_line's unique index on
--     (shop_id, line_no) would refuse exactly the rows this ledger exists to
--     keep as an audit trail of what dedup discarded.
--   * shopStore's INSERT/UPDATE column allowlists on shop_line are frozen
--     (016's own ruling, restated here rather than re-litigated): widening
--     that table's shape is a change to a module outside this migration's
--     remit and risks the same frozen-surface violation 016 was written to
--     avoid.
--
-- A new table keeps shop_line's existing, working contract untouched and adds
-- the provenance/grounding concern as a SEPARATE, joinable ledger - the same
-- choice 017 made for shop_decision and 018 made for remembered_choice, for
-- the same underlying reason: a new invariant with a new grain deserves a new
-- table, not a widened one.
--
-- HOW shop_line_provenance CONNECTS TO THE REST OF THE SCHEMA ------------
-- Deliberately ONE join point, not two. asdair.shopping_list_items gets a new
-- nullable evidence_provenance_id column (section 4) pointing at the winning
-- provenance row for that final list item - covering ALL FOUR provenance
-- kinds, because shopping_list_items (not shop_line, which only exists for
-- photo/typed lines) is the table that holds every line of the actual week's
-- shop regardless of origin. A second link from shop_line itself was
-- considered and rejected: shop_line.list_item_id already reaches
-- shopping_list_items, and a second, parallel evidence path back to this
-- ledger would be exactly the "two things that are supposed to agree, written
-- twice" defect 018 names by quoting skill/termMatch.js. One path answers
-- "why is this line in the shop" for every provenance kind; a second one
-- would only invite drift.
--
-- NO BACKFILL OF shop_line_provenance OR shop_image_region, DELIBERATELY -
-- 017/018's rule, for 017/018's reason. Every shop_line row that exists today
-- was interpreted before this ledger existed; synthesising a photo-truth row
-- or a region for it now would be fabricating evidence of a grounding call
-- that never happened. AN ABSENT shop_line_provenance ROW MEANS "interpreted
-- before this ledger existed" or "not photo-sourced". IT NEVER MEANS "no
-- evidence exists".
--
-- shop.human_state DOES GET A BACKFILL, AND THAT IS A DIFFERENT CASE -----
-- See section 5's own comment for why: human_state is a MECHANICAL
-- re-expression of a fact (shop.status) that is ALREADY fully and reliably
-- present on every existing row, not a synthesis of a decision nobody made.
-- That is not the shop_decision/remembered_choice situation at all.
--
-- PURE ASCII, no secrets, no rows beyond the mechanical human_state backfill,
-- idempotent and re-runnable, forward-only.
-- =====================================================================


-- =====================================================================
-- 1. asdair.shop_image_region - the application-supplied region list.
--
-- Written by DETERMINISTIC IMAGE PREP, before any model call. This table is
-- the ground truth the vision call's `source_region` output is constrained
-- against - the model may name one of these regions; it can never invent
-- coordinates, and section 2's composite foreign key is what makes that a
-- database fact rather than a prompt request. "No line without visible
-- evidence" is what the prompt asks for; a region that must resolve against a
-- real, application-owned row is what lets section 2 ENFORCE it.
--
-- HONEST LIMIT, stated once here and not repeated: naming a real region
-- proves the model did not invent a location out of nothing. It does NOT
-- prove the model read the pixels inside that region correctly - it cannot.
-- Pax's independent review underlines this distinction explicitly; it is
-- carried into the schema by NOT overclaiming what this table proves.
-- =====================================================================
create table if not exists asdair.shop_image_region (
  id                bigint generated by default as identity primary key,
  shop_id           bigint  not null references asdair.shop(id) on delete cascade,

  -- The number stamped into the vision prompt (1, 2, 3...) and the ONLY
  -- identifier the model is allowed to cite. Unique per shop so "region 2"
  -- means exactly one thing for one shop.
  region_no         integer not null,

  -- 'full_page' (the whole prepared image) or 'strip' (one overlapping
  -- horizontal slice). Closed vocabulary; a third kind is a new migration,
  -- deliberately - matching remembered_choice_authorised_by_known's own
  -- reasoning for a closed, migration-gated vocabulary.
  region_kind       text    not null,

  -- Pixel bounds of this region within the prepared (rotated/deskewed) image,
  -- for Cockpit to render the exact crop next to the line it is evidence
  -- for (Part 2's "view the relevant photo region for any questionable
  -- line"). Nullable together: a full_page region legitimately has no
  -- meaningful sub-crop, and the CHECK below makes "some but not all four"
  -- unstorable rather than merely unlikely.
  pixel_top         integer,
  pixel_left        integer,
  pixel_bottom      integer,
  pixel_right       integer,

  -- Which photograph this region was cut from. EVIDENCE, not a foreign key -
  -- see the header for why this is not joined to shop_source_image. Same
  -- hex-hash shape as 016's fingerprint, deliberately, for one visual
  -- grammar across this build's evidence columns.
  image_fingerprint text,

  created_at        timestamptz not null default now(),

  constraint shop_image_region_kind_known check (region_kind in ('full_page','strip')),
  constraint shop_image_region_no_sane check (region_no > 0),

  -- All four pixel bounds present, or none. A region with only some of its
  -- bounds set could never be rendered as a crop and is a defect, not a
  -- partial fact.
  constraint shop_image_region_bounds_sane check (
    (pixel_top is null and pixel_left is null and pixel_bottom is null and pixel_right is null)
    or (pixel_top >= 0 and pixel_left >= 0 and pixel_bottom > pixel_top and pixel_right > pixel_left)
  ),

  constraint shop_image_region_fingerprint_shaped check (
    image_fingerprint is null or image_fingerprint ~ '^[0-9a-f]{16,128}$')
);

-- One "region 2" per shop.
create unique index if not exists shop_image_region_shop_no_uniq
  on asdair.shop_image_region (shop_id, region_no);

-- Required so shop_line_provenance can bind (source_region_id, shop_id) to
-- the REGION'S OWN shop_id, not merely to some region somewhere. Cannot
-- fail: id is already the primary key, so (id, shop_id) is trivially unique.
-- 017's own device (shop_question_id_shop_uniq), one layer up.
create unique index if not exists shop_image_region_id_shop_uniq
  on asdair.shop_image_region (id, shop_id);

create index if not exists shop_image_region_shop_idx
  on asdair.shop_image_region (shop_id, region_no);


-- =====================================================================
-- 2. asdair.shop_line_provenance - the durable, four-way provenance ledger.
--
-- ONE ROW PER INTERPRETED LINE, covering every reason a line is in this
-- week's shop:
--   PHOTO     - read from the photograph, grounded to a real region.
--   REGULARS  - added because the household normally buys it. No image
--               evidence required or expected; labelled "Added from
--               Regulars."
--   RULE      - added by a standing household rule. No image evidence.
--   WARWICK   - this week's explicit decision. No image evidence.
-- These four are never silently interchangeable (Warwick's review of the
-- design doc, made explicit there and carried here as the CHECK constraints
-- below).
--
-- PHOTO rows are written by the vision-interpretation stage BEFORE
-- enrichment runs. REGULARS/RULE/WARWICK rows are written by the enrichment
-- stage (or the explicit-decision path) immediately after, into the SAME
-- ledger - so "why is this line in the shop" is always one query away,
-- regardless of which of the four answers it turns out to be.
--
-- INSERT-ONLY, DELIBERATELY (section 6's grants). A photo-truth row is
-- durable evidence of what was interpreted and from what; it is never
-- rewritten. A BETTER later reading - because a batched follow-up call
-- resolved genuine uncertainty, or because cross-strip dedup determined two
-- rows described the same physical line - is recorded as a NEW row that
-- SUPERSEDES the old one (superseded_by_id), never as an UPDATE. This is one
-- mechanism doing both jobs deliberately: a triggered re-read and a
-- cross-strip duplicate are both, structurally, "a later row that replaces
-- an earlier reading of the same physical thing," and building two separate
-- mechanisms for the same shape would be exactly the regrowth this build's
-- constitution forbids.
-- =====================================================================
create table if not exists asdair.shop_line_provenance (
  id                 bigint generated by default as identity primary key,
  shop_id            bigint  not null references asdair.shop(id) on delete cascade,

  -- Ordinal within its own reading pass. INFORMATIONAL ONLY - deliberately
  -- NOT a uniqueness key. Before cross-strip dedup resolves, or across an
  -- initial pass plus a follow-up re-read, more than one row can legitimately
  -- claim to be "about the same line", and this ledger's whole job is to be
  -- able to hold that rather than refuse it. shop_line's own
  -- (shop_id, line_no) uniqueness is untouched and remains the place a
  -- SINGLE canonical position per line is enforced, once dedup has run.
  line_no            integer,

  provenance         text    not null,

  -- -- PHOTO-ONLY GROUNDING ------------------------------------------------
  -- source_region_id: THE anti-hallucination constraint. See the composite
  -- foreign key in section 3 - a PHOTO row's region must belong to THIS
  -- shop, not merely exist somewhere. No inline FK here on purpose; the
  -- composite constraint is what makes shop_id agreement a database fact
  -- rather than a column the writer has to remember to keep aligned (017's
  -- own reasoning for shop_decision_question_fk, applied here to regions).
  source_region_id   bigint,
  interpreter_model  text,     -- e.g. 'gpt-5.6-terra'
  prompt_version     text,     -- the household-aware prompt template's own version tag

  -- What the model believes is physically on the paper, kept VERBATIM -
  -- shop_line's own raw_reading rule, restated here for the same reason: it
  -- is the evidence every later decision rests on, and the only field of
  -- model prose in this table.
  raw_text           text,

  -- Interpreted product match. A genuine FOREIGN KEY to asdair.regulars, so a
  -- model (or a rule, or Warwick's typed answer) cannot assert a product
  -- that does not exist - shop_line_matched_has_id's invariant (008),
  -- restated at this ledger's own grain. No explicit on-delete: regulars are
  -- retired via active=false and never hard-deleted (004's own rule), so the
  -- default NO ACTION costs nothing and matches shop_line's own choice.
  matched_regular_id bigint references asdair.regulars(id),

  quantity           integer,
  confidence         numeric,  -- meaningful for PHOTO; null is the honest value for a deterministic REGULARS/RULE/WARWICK addition, never a guessed 1.0

  -- -- DEDUP / RE-READ SUPERSESSION (Pax's Finding 2, item 2) ----------------
  -- Points at the row that REPLACED this one - a later, better reading of
  -- the same physical line. NULL means "this row is the current, canonical
  -- reading." No inline FK here for the same composite-binding reason as
  -- source_region_id; see section 3.
  superseded_by_id   bigint,

  interpreted_at     timestamptz not null default now(),
  created_at         timestamptz not null default now(),

  constraint shop_line_provenance_provenance_known check (
    provenance in ('PHOTO','REGULARS','RULE','WARWICK')),

  -- THE LOAD-BEARING CONSTRAINT. A row asserting PHOTO provenance without a
  -- resolvable source_region is UNSTORABLE, not merely flagged low-
  -- confidence - and by the same biconditional, only a PHOTO row may ever
  -- carry a region at all. A REGULARS/RULE/WARWICK row claiming photographic
  -- grounding would misrepresent itself exactly as much as a PHOTO row
  -- claiming none.
  constraint shop_line_provenance_region_iff_photo check (
    (provenance = 'PHOTO') = (source_region_id is not null)),

  -- A PHOTO row must show literal text - "no line without visible evidence"
  -- made a database fact, not just a prompt request.
  constraint shop_line_provenance_photo_has_text check (
    provenance <> 'PHOTO' or (raw_text is not null and btrim(raw_text) <> '')),

  -- A PHOTO row must name which model and which prompt version produced it -
  -- the two facts Larry's brief named explicitly, and the facts that make a
  -- future accuracy regression debuggable ("did the model change or did the
  -- prompt change").
  constraint shop_line_provenance_photo_has_model check (
    provenance <> 'PHOTO' or (interpreter_model is not null and prompt_version is not null)),

  -- A REGULARS row is, by its own definition, a known catalogue item - "no
  -- image evidence required or expected... labelled 'Added from Regulars'"
  -- presupposes a real regular being referenced, not free text.
  constraint shop_line_provenance_regulars_has_product check (
    provenance <> 'REGULARS' or matched_regular_id is not null),

  -- RULE and WARWICK rows are more open-ended than REGULARS (a rule or
  -- Warwick's own decision can introduce a genuinely new, non-catalogue
  -- item), but a row identifying NOTHING is not evidence of anything. Either
  -- a real regular or non-empty text is required. A non-catalogue new item's
  -- NAME is deliberately not re-invented as a column here - that facility
  -- already exists at asdair.shop_decision.decided_item_name, and adding a
  -- second free-text-item store here would be exactly the kind of
  -- unrequested duplication this build's constitution names as a defect
  -- class, not a convenience.
  constraint shop_line_provenance_rule_warwick_names_something check (
    provenance not in ('RULE','WARWICK')
    or matched_regular_id is not null
    or (raw_text is not null and btrim(raw_text) <> '')),

  constraint shop_line_provenance_raw_text_shaped check (
    raw_text is null or (btrim(raw_text) <> '' and length(raw_text) <= 1000)),
  constraint shop_line_provenance_model_shaped check (
    interpreter_model is null or (btrim(interpreter_model) <> '' and length(interpreter_model) <= 100)),
  constraint shop_line_provenance_prompt_version_shaped check (
    prompt_version is null or (btrim(prompt_version) <> '' and length(prompt_version) <= 100)),

  -- Mirrors shop_line_qty_sane (008) and shop_decision_qty_sane (017). Null
  -- means "not decided / not visibly written", never a guessed 1.
  constraint shop_line_provenance_qty_sane check (
    quantity is null or (quantity > 0 and quantity <= 999)),

  constraint shop_line_provenance_confidence_sane check (
    confidence is null or (confidence >= 0 and confidence <= 1)),

  constraint shop_line_provenance_line_no_sane check (
    line_no is null or line_no > 0),

  constraint shop_line_provenance_not_own_superseder check (
    superseded_by_id is null or superseded_by_id <> id)
);

-- Required so a superseding row can be bound to the SAME shop as the row it
-- replaces (section 3). 017's device, one more layer.
create unique index if not exists shop_line_provenance_id_shop_uniq
  on asdair.shop_line_provenance (id, shop_id);

create index if not exists shop_line_provenance_shop_idx
  on asdair.shop_line_provenance (shop_id, id);

create index if not exists shop_line_provenance_shop_kind_idx
  on asdair.shop_line_provenance (shop_id, provenance);

-- The common read: "the current, canonical lines for this shop" - i.e.
-- exclude anything a later row has superseded. Partial, because that is the
-- actual query shape, mirroring shop_decision's own reasoning for which
-- indexes earn their place.
create index if not exists shop_line_provenance_live_idx
  on asdair.shop_line_provenance (shop_id, line_no)
  where superseded_by_id is null;

-- No index on matched_regular_id. "What have we ever read about product X
-- across shops" is a question nobody has asked yet - building an index for
-- an unasked query is exactly the anticipation the regrowth cap forbids
-- (017 and 018 both make this same call for their own regulars FKs).


-- =====================================================================
-- 3. The two composite foreign keys.
--
-- POSTGRES HAS NO `alter table ... add constraint if not exists`. Without a
-- guard, re-running this migration aborts the WHOLE file with 42710. 017
-- established this shape and it is repeated here rather than assumed, for
-- both composite constraints this file needs.
-- =====================================================================
do $$
begin
  -- source_region_id must name a region belonging to THIS row's own shop_id.
  -- THIS is what turns "the model named some region that exists somewhere"
  -- into "the model named a region of the photograph actually in front of
  -- it this week" - the difference between a real anti-hallucination
  -- guarantee and a decorative one.
  if not exists (select 1 from pg_constraint where conname = 'shop_line_provenance_region_fk') then
    alter table asdair.shop_line_provenance
      add constraint shop_line_provenance_region_fk
        foreign key (source_region_id, shop_id)
        references asdair.shop_image_region (id, shop_id)
        on delete no action;
  end if;

  -- superseded_by_id must point at a row of THIS SAME shop. ON DELETE SET
  -- NULL, not CASCADE: if a superseding row is ever removed (owner-level
  -- only - no DELETE is granted to any role below), the superseded row
  -- simply reverts to "not marked as superseded" rather than being destroyed
  -- alongside it. Destroying audit evidence because its replacement was
  -- removed would be exactly backwards.
  if not exists (select 1 from pg_constraint where conname = 'shop_line_provenance_supersede_fk') then
    alter table asdair.shop_line_provenance
      add constraint shop_line_provenance_supersede_fk
        foreign key (superseded_by_id, shop_id)
        references asdair.shop_line_provenance (id, shop_id)
        on delete set null;
  end if;
end $$;


-- =====================================================================
-- 4. asdair.shopping_list_items - the one evidence join point.
--
-- Nullable, evidence-only - "provenance is a join, never a copy" (018's own
-- phrase, carried forward). Answers "why is this in the shop?" for EVERY
-- final list line, whichever of the four provenance kinds produced it,
-- without shopping_list_items needing to know or duplicate anything about
-- HOW that answer was reached. ON DELETE SET NULL matches 017/018's pattern
-- for every other evidence-only FK in this schema: losing the provenance
-- trail is a degraded state, never a reason to fail or cascade a delete.
--
-- A nullable column with no default on an already-existing table is a
-- catalogue-only change - no table rewrite, only a brief ACCESS EXCLUSIVE
-- lock (019's own reasoning, restated because it applies identically here).
-- =====================================================================
alter table asdair.shopping_list_items
  add column if not exists evidence_provenance_id bigint
    references asdair.shop_line_provenance(id) on delete set null;


-- =====================================================================
-- 5. asdair.shop.human_state - the canonical six-value surface state.
--
-- Exactly six values, closed vocabulary, enforced by CHECK:
--   NEEDS_WARWICK * ASDAIR_WORKING * READY_FOR_WARWICK * BROWSER_WORKING *
--   COMPLETE * FAILED
--
-- A PLAIN COLUMN, NOT a generated/computed one - considered and rejected.
-- The status -> human_state mapping is a genuine PRODUCT/UX judgement call
-- (is BASKET_READY "ready for Warwick" or "AsdAIr still working while it
-- awaits reconciliation"? is a CANCELLED shop COMPLETE or something else?),
-- not a database fact, and this build's own precedent (shopState.js's
-- TERMINAL_STATUSES / LIVE_STATUSES groupings) keeps exactly this kind of
-- status-derived judgement in application code, not baked into a Postgres
-- GENERATED expression that would need a drop-and-recreate migration every
-- time the mapping is tuned. What THIS migration guarantees is the
-- vocabulary and the single column both surfaces read; WHAT MAPS TO WHAT is
-- Keel's to implement (extending shopState.js with the mapping function),
-- written by the SAME code path that already transitions shop.status, so
-- Cockpit and Telegram only ever SELECT this column and never independently
-- derive their own reading of it - which is the whole defect this column
-- exists to close (the design doc's "two pieces of status text on the same
-- screen contradicting each other because they were computed independently").
--
-- NO GRANT STATEMENT for this column, DELIBERATELY. asdair.shop is already
-- in migration 012's LIFECYCLE tier (select, insert, update to asdair_rw;
-- select to asdair_ro) - Postgres table-level privileges already cover a
-- column added later, and a column-level grant here would be a no-op that
-- misleads a future reader (017's and 018's own words, restated because the
-- reasoning is identical).
--
-- BACKFILL, AND WHY THIS IS NOT THE shop_decision/remembered_choice
--    "NO BACKFILL" SITUATION ------------------------------------------------
-- 017 and 018 refuse to backfill because doing so would FABRICATE a decision
-- nobody actually made. This column is different in kind: shop.status is
-- ALREADY, RELIABLY present on every existing row - human_state is a
-- MECHANICAL RE-EXPRESSION of a fact already recorded, not a synthesis of
-- something unknown. Leaving it at the column default for every existing row
-- regardless of actual status would itself be the misleading act (an old
-- RECONCILED shop reading ASDAIR_WORKING on a History screen), so the
-- backfill below is required for correctness, not merely permitted.
--
-- THE MAPPING BELOW IS SILAS'S PROPOSED DEFAULT, NOT A LOCKED PRODUCT
-- DECISION - flagged plainly rather than silently asserted as final. Two
-- calls in particular are genuinely arguable and are for Keel/Warwick to
-- confirm at implementation time, not settled here:
--   * BASKET_READY -> READY_FOR_WARWICK (built, awaiting his review) vs.
--     ASDAIR_WORKING (still reconciling) - mapped to READY_FOR_WARWICK below.
--   * CANCELLED -> COMPLETE (closed, nothing more will happen) is the
--     nearest of the six buckets; Part 2's design already moves cancelled
--     shops off the Cockpit front page into History as a UI filter, so this
--     mapping is a low-stakes default rather than something users will
--     actually see foregrounded.
-- For a LIVE shop caught mid-flight by this migration, the backfilled value
-- is a safe placeholder that gets corrected the next time that shop's
-- status legitimately transitions (imminent, since it is by definition still
-- moving) - a low-risk, recorded residual, not a defect requiring a second
-- migration to close.
-- =====================================================================
alter table asdair.shop
  add column if not exists human_state text not null default 'ASDAIR_WORKING';

update asdair.shop
   set human_state = case status
         when 'RECEIVED'                     then 'ASDAIR_WORKING'
         when 'TRANSCRIBING'                 then 'ASDAIR_WORKING'
         when 'PROCESSING'                   then 'ASDAIR_WORKING'
         when 'NEEDS_DECISION'               then 'NEEDS_WARWICK'
         when 'READY_TO_SHOP'                then 'READY_FOR_WARWICK'
         when 'WAITING_FOR_BROWSER'          then 'BROWSER_WORKING'
         when 'SHOPPING'                     then 'BROWSER_WORKING'
         when 'BASKET_READY'                 then 'READY_FOR_WARWICK'
         when 'ORDER_CONFIRMATION_RECEIVED'  then 'ASDAIR_WORKING'
         when 'RECONCILED'                   then 'COMPLETE'
         when 'FAILED'                       then 'FAILED'
         when 'CANCELLED'                    then 'COMPLETE'
         else human_state
       end;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_human_state_known') then
    alter table asdair.shop
      add constraint shop_human_state_known check (
        human_state in (
          'NEEDS_WARWICK','ASDAIR_WORKING','READY_FOR_WARWICK',
          'BROWSER_WORKING','COMPLETE','FAILED'));
  end if;
end $$;


-- =====================================================================
-- 6. Grants.
--
-- shop_image_region and shop_line_provenance: SELECT + INSERT to asdair_rw,
-- SELECT to asdair_ro. UPDATE and DELETE granted to NOBODY - immutability
-- enforced by absent grants, 016/017/018's model, and the whole reason a
-- "better later reading" is a NEW superseding row rather than an edit.
--
-- shopping_list_items.evidence_provenance_id and shop.human_state need NO
-- new grant statements - both tables already carry table-level UPDATE for
-- asdair_rw (012), which covers a column added later. Stated once here,
-- not repeated as a no-op GRANT.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw absent - skipping 020 write grants';
  else
    execute 'grant select, insert on asdair.shop_image_region to asdair_rw';
    execute 'grant usage on sequence '
         || pg_get_serial_sequence('asdair.shop_image_region','id') || ' to asdair_rw';

    execute 'grant select, insert on asdair.shop_line_provenance to asdair_rw';
    execute 'grant usage on sequence '
         || pg_get_serial_sequence('asdair.shop_line_provenance','id') || ' to asdair_rw';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_ro') then
    raise notice 'asdair_ro absent - skipping 020 read grants';
  else
    execute 'grant select on asdair.shop_image_region to asdair_ro';
    execute 'grant select on asdair.shop_line_provenance to asdair_ro';
  end if;
end $$;

-- RECORDED, NOT WORK: asdair.shop_image_region and asdair.shop_line_provenance
-- will be ABSENT from migration 012's enumerated grant matrix, as
-- asdair.shop_decision and asdair.remembered_choice already are (017, 018).
-- That makes four. A future matrix re-enumeration must pick up all four.
-- 012 is deliberately NOT amended here.

-- THE INSERT-ONLY CLAIM RESTS ON ONE MORE THING THAN THIS GRANT MATRIX ---
-- Same fact 017 and 018 each established and re-stated for their own tables:
-- FOREIGN KEY REFERENTIAL ACTIONS RUN WITH OWNER AUTHORITY AND BYPASS GRANTS.
-- So section 3's two composite FKs and section 4's evidence FK can each
-- change a row without any role holding UPDATE or DELETE:
--   * a superseding shop_line_provenance row being removed NULLs the
--     superseded row's superseded_by_id (on delete set null);
--   * a shop_line_provenance row being removed NULLs
--     shopping_list_items.evidence_provenance_id (on delete set null);
--   * deleting an asdair.shop CASCADES away its shop_image_region and
--     shop_line_provenance rows entirely (on delete cascade) - correct
--     semantics: evidence for a shop that no longer exists is not evidence
--     of anything.
-- None of these are asdair_rw doing an UPDATE or DELETE it was not granted;
-- they are the owner's own referential actions, and the claim depends on
-- asdair_rw continuing to lack DELETE on asdair.shop, which was true as of
-- 017/018 and is not re-verified here.
