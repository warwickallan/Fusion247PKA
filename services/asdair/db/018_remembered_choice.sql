-- =====================================================================
-- BUILD-015 AsdAIr WP-B15-3-M1 - migration 018
--
-- THE HOUSEHOLD'S REMEMBERED LAST CHOICE.
--
-- Warwick, 2026-08-09:
--
--   "WHEN THERE IS MORE THAN ONE VALID CHOICE, REMEMBER THE CHOICE I MADE
--    LAST TIME. ... use that last choice so the list can resolve BEFORE
--    browser execution rather than asking me the same choice again. ... It is
--    a PREFERENCE, NOT PERMISSION to invent products or ignore hard
--    exclusions. If the remembered product is unavailable or no longer a valid
--    grounded candidate, behave honestly rather than fabricating a match."
--
-- Implemented from Silas's schema decision of 2026-08-09
-- (`Deliverables/2026-08-09-silas-schema-decision-remembered-last-choice.md`,
-- committed f0ebf31). The decision is IMPLEMENTED HERE, not re-derived: every
-- column, constraint, grant and referential action below traces to a numbered
-- section of that document, and where this file diverges from 017 it says so
-- and says why.
--
-- ── HARD DEPENDENCY ON 017 BEING *APPLIED*. STATE IT, DO NOT ASSUME IT ──────
-- 017 was deliberately written to apply cleanly whether or not 016 had landed.
-- 018 CANNOT BE. The composite foreign key in section 3 references
-- asdair.shop_decision (id, decision_kind) - a table 017 creates and a unique
-- index section 1 below adds to it. On any database where 017 is
-- authored-but-not-applied, THIS FILE FAILS at that foreign key, loudly, and
-- writes nothing.
--
--   018 depends on: 001 (schema, households), 004 (regulars), 006 (shop),
--                   017 (shop_decision) - APPLIED, not merely authored.
--   018 depends on 016: NOT AT ALL.
--
-- ── NUMBERING: WHY 018 ─────────────────────────────────────────────────────
-- Repo migrations are 001, 004-010, 012, 016, 017 (gaps at 002, 003, 011,
-- 013-015; see 016's header for why 013-015 are not to be claimed). 018 is the
-- next free number and collides with nothing.
--
-- ── NO BACKFILL, DELIBERATELY ──────────────────────────────────────────────
-- 017's rule, for 017's reason: past choices were made before this mechanism
-- existed, and synthesising rows for them would be fabrication of exactly the
-- kind catalogue grounding exists to prevent.
--
--   AN ABSENT REMEMBERED CHOICE MEANS "NOT YET CHOSEN UNDER THIS RULE".
--   IT NEVER MEANS "NO PREFERENCE EXISTS".
--
-- ── WHAT THIS TABLE DELIBERATELY CANNOT DO ─────────────────────────────────
-- It carries ONE asdair.regulars id and NO directive vocabulary - no exclude,
-- no map, no matched_product, no quantity, no price. Warwick's "a preference,
-- not permission" is therefore an ABSENCE OF COLUMNS rather than a rule
-- somebody has to remember. There is no way to SPELL a fabricated match, a
-- hard exclusion or a quantity change in this table.
--
-- ⛔ NO `price` / `price_at_choice` COLUMN. EXPLICIT NON-GOAL (Silas s8.1).
-- The future household price-history work Warwick described for the
-- reconciliation stage is a SEPARATE store keyed on asdair.regulars.id, and it
-- inherits order_confirmation_line.price_basis. A price column here would
-- become an accidental, sparse, unreconciled second price store competing with
-- the real one. Recorded so that nobody adds one "while we're in there".
--
-- PURE ASCII, no secrets, no rows, idempotent and re-runnable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. asdair.shop_decision - the index the composite foreign key needs.
--
-- Required so asdair.remembered_choice can bind (source_decision_id,
-- source_decision_kind) to the SOURCING DECISION'S OWN KIND. Cannot fail: id
-- is already the primary key of that table, so (id, decision_kind) is
-- trivially unique. This is 017's own device - `shop_question_id_shop_uniq`
-- exists for exactly the same reason one layer down.
--
-- THIS IS NOT A WIDENING OF 017. No column is added, no constraint is
-- loosened, no grant is changed. A unique index over an already-unique column
-- pair adds a lookup path and nothing else.
-- ---------------------------------------------------------------------
create unique index if not exists shop_decision_id_kind_uniq
  on asdair.shop_decision (id, decision_kind);

-- ---------------------------------------------------------------------
-- 2. asdair.remembered_choice - the carrier.
--
-- APPEND-ONLY, NEWEST WINS. A changed mind is a NEW ROW, never an edit. That
-- single decision buys, at once: immutability by ABSENT GRANT (section 4);
-- a complete preference history for free; no `updated_at` lie; and no
-- supersession mechanism to build. Volume is trivial - roughly five questions
-- a week, so a few hundred rows a year.
--
-- The reader's query is:
--
--   select ... from asdair.remembered_choice
--    where household_id = $1 and choice_term = $2
--    order by chosen_at desc, id desc limit 1
--
-- EVERY ROW IN THIS TABLE IS, BY CONSTRUCTION, A REMEMBERED CHOICE. There is
-- no filter, and therefore no boolean to leave false. That is the whole
-- correction of `asdair.rule_qa_log.applies_going_forward`, which was a filter
-- a writer had to remember to set, defaulting to the value that discarded
-- everything - and per 017's own header, "every answer Warwick ever gave was
-- written, read back, and discarded". NO BOOLEAN SUCCESSOR TO THAT FIELD IS
-- CREATED HERE, AND NONE MAY BE ADDED LATER.
-- ---------------------------------------------------------------------
create table if not exists asdair.remembered_choice (
  id                    bigint generated by default as identity primary key,

  -- ── IDENTITY OF THE AMBIGUITY (Silas s2) ──────────────────────────────
  -- Keyed on (household_id, normalised choice_term), in PLAIN READABLE TEXT.
  --
  -- NOT question_key: it is round-bearing (a settled ambiguity would get a
  -- different key depending on how many clarification rounds it happened to
  -- take), opaque (an 8-hex digest Warwick cannot audit in the Cockpit), and
  -- unscoped by household. It stays the right key for joining a decision to a
  -- question INSIDE one shop, and 018 does not disturb that.
  --
  -- NOT the candidate-set hash: `resolveReading` returns 'unmatched_new_item'
  -- with an EMPTY alternatives array, so every unmatched new item would
  -- collapse onto one key - a WRONG-MATCH failure, not a miss. And the
  -- catalogue changes more often than list wording: adding a single `aka`
  -- re-shapes the candidate set and would orphan every memory derived from it.
  --
  -- THE STATED FAILURE MODE, NOT HIDDEN: "ariel" one week and "ariel pods" the
  -- next normalise to DIFFERENT terms, so the lookup MISSES and AsdAIr asks
  -- again. He answers, a SECOND row is written for the second spelling
  -- pointing at the SAME regulars id, and from week three both spellings are
  -- covered. The mechanism self-heals by use and fails in the safe direction:
  -- one extra question, never a wrong product.
  --
  -- ⛔ DO NOT MAKE THIS KEY FUZZY TO CLOSE THAT. The household's real mechanism
  -- for alternate wording is asdair.regulars.aka, matched through the ONE
  -- shared matcher. A fuzzy preference key would create a SECOND, competing
  -- notion of "the same item" - verbatim the defect skill/termMatch.js:20-22
  -- exists to prevent: "Two matchers that are supposed to agree, written
  -- twice, are exactly how the defect got in."
  --
  -- household_id is NOT NULL with a real FK. asdair.rule_qa_log, .rules and
  -- .products all use NULL-means-global, and 001 had to bolt on partial unique
  -- indexes twice to stop NULL-permissive duplication. Warwick's rule says
  -- "the household's most recent preference" - there is no global scope in it,
  -- so NOT NULL deletes the whole NULL-semantics class rather than defending
  -- against it a third time.
  household_id          bigint not null references asdair.households(id),
  choice_term           text not null,

  -- WHICH normaliser produced choice_term, e.g. 'keys.normaliseTerm@1'.
  --
  -- There are TWO normaliseTerm implementations in this tree -
  -- pipeline/keys.js and skill/termMatch.js normaliseMatchText - pinned to
  -- agree only by a SAMPLE-BASED test, not by identity. A key written by one
  -- and looked up by the other is a silent-miss surface nobody would notice.
  -- Naming the producer makes a future normalisation change a QUERYABLE,
  -- VISIBLE break rather than a memory that quietly stops firing. The
  -- underlying duplication is pre-existing and is not addressed here.
  term_normaliser       text not null,

  -- ── THE CHOICE (Silas s5) ─────────────────────────────────────────────
  -- AN ID, WITH A FOREIGN KEY - so a fabricated match is UNSTORABLE rather
  -- than merely discouraged. 017's invariant carried forward: "the database
  -- refuses the row rather than the code hoping to."
  --
  -- ON DELETE NO ACTION, deliberately: a memory must never be silently NULLed
  -- or removed by a catalogue deletion - the delete should FAIL instead.
  -- Regulars are retired by `active = false` and never deleted (004:52), so
  -- this costs nothing and closes a silent-rewrite path.
  chosen_regular_id     bigint not null references asdair.regulars(id) on delete no action,

  -- THE GROUNDED CANDIDATE SET THAT WAS ON THE TABLE WHEN HE CHOSE.
  -- EVIDENCE, NEVER IDENTITY - 017's phrase for evidence_shop_line_id.
  --
  -- It is what lets AsdAIr say "last time the choice was between A, B and C;
  -- this week B is not a candidate, so I am asking again" instead of silently
  -- falling back. The reader's rule (and it is a READ-TIME rule, not a stored
  -- flag) is: apply the memory ONLY when chosen_regular_id is in THIS WEEK'S
  -- grounded candidate set AND is still an active regular. Otherwise, ask.
  --
  -- Deliberately NOT a foreign key - Postgres cannot FK an array element - and
  -- deliberately NO guard index: 017's warning applies, a guard would "imply a
  -- reliability it does not have". The load-bearing FK is chosen_regular_id.
  candidate_regular_ids bigint[] not null,

  -- ── AUTHORISATION (Silas s6) ──────────────────────────────────────────
  -- WHICH STANDING AUTHORISATION produced this row, with its vocabulary closed
  -- by CHECK. Not a per-row toggle a writer can flip.
  --
  -- HONEST CAVEAT, because it matters: this is a RECORD of authority, not an
  -- enforcement of it - a writer can pass the literal. What makes it more than
  -- a comment is that adding a new KIND of learning requires a migration,
  -- whereas flipping a boolean does not. The load-bearing guard is the
  -- composite FK below, not this column.
  authorised_by         text not null,

  -- THE SOURCING DECISION'S KIND, bound to the decision itself by the
  -- composite foreign key in section 3. PROVED, NOT ASSERTED.
  source_decision_kind  text not null,

  -- ── PROVENANCE AND TIME (Silas s4) ────────────────────────────────────
  -- WHEN WARWICK MADE THE CHOICE - sourced from the decision's interpreted_at
  -- or the question's answered_at, NEVER from the clock at write time.
  --
  -- NO DEFAULT, DELIBERATELY. A `default now()` would quietly re-date a
  -- replayed or backfilled choice, and "how old is this preference" is the
  -- entire point of the column. The absence of a default forces the writer to
  -- supply the truth.
  chosen_at             timestamptz not null,

  -- WHICH SHOP - yields shop_ref (SHOP-YYYY-MM-DD), the handle Warwick and the
  -- bot both use.
  source_shop_id        bigint not null references asdair.shop(id),

  -- WHICH DECISION - and through it the question, his exact words, the model's
  -- structured return, and the grounding_fingerprint of the catalogue it was
  -- decided against. PROVENANCE IS A JOIN, NEVER A COPY, so it cannot drift
  -- from what it claims.
  --
  -- source_question_id is deliberately NOT carried: it is reachable through
  -- shop_decision.question_id, and duplicating it would create a second
  -- drift-capable path to one fact.
  --
  -- The FK is declared in section 3 as part of the composite constraint.
  source_decision_id    bigint not null,

  -- When the ROW was written. Two clocks, two meanings - 017 keeps
  -- interpreted_at and created_at apart for the same reason.
  created_at            timestamptz not null default now(),

  -- NO updated_at, NO is_stale, NO expires_at, NO chosen_product_name,
  -- NO price. Each absence is load-bearing:
  --
  --   updated_at   no role is granted UPDATE, so a column claiming a
  --                modification time would be "a lie waiting to be told"
  --                (017's exact reasoning).
  --   is_stale     staleness is a READING - now() - chosen_at, plus "is the
  --                target still an active regular" - computed at read time. A
  --                stored flag would need UPDATE, the thing that must not
  --                exist, and would go wrong silently the first time nobody
  --                recomputed it.
  --   expires_at   would invent a retention policy Warwick did not state and
  --                require a number nobody has decided. The AGE is visible;
  --                what age is too old is his call, later, and needs no schema
  --                now. EXPLICIT NON-GOAL.
  --   chosen_product_name
  --                THE NAME IS LOOKED UP FROM asdair.regulars BY ID AT READ
  --                TIME (008's rule, restated by 017's
  --                shop_decision_name_only_for_new). Consequence: a preference
  --                whose product was renamed renders as its CURRENT name, and
  --                a preference whose product is gone renders as NOTHING AT
  --                ALL - never as a stale string that still looks like a live
  --                product. This is what makes honest failure the natural
  --                path rather than merely the permitted one.
  --   price        see the header. Explicit non-goal.

  -- ── CONSTRAINTS ───────────────────────────────────────────────────────

  -- A CHOICE THAT WAS NEVER AMONG ITS OWN CANDIDATES IS INCOHERENT.
  constraint remembered_choice_chosen_is_a_candidate check (
    chosen_regular_id = any(candidate_regular_ids)),

  -- WARWICK'S RULE FIRES ONLY "WHEN THERE IS MORE THAN ONE VALID CHOICE".
  -- Fewer than two candidates is not the thing he authorised, and making it
  -- UNSTORABLE is what stops the mechanism quietly widening into "remember
  -- everything". A one-candidate resolution is not an ambiguity.
  constraint remembered_choice_needs_an_ambiguity check (
    array_length(candidate_regular_ids, 1) >= 2),

  -- An id array carrying a NULL would silently defeat the membership check
  -- above (`x = any(...)` over a NULL element is NULL, not false).
  constraint remembered_choice_candidates_are_ids check (
    array_position(candidate_regular_ids, null) is null),

  -- CHOICE_TERM IS ITS OWN NORMALISED FIXED POINT, so an un-normalised term is
  -- unstorable. Order matches pipeline/keys.js normaliseTerm EXACTLY:
  --   lower -> punctuation-to-space ('&' preserved) -> collapse -> trim.
  --
  -- KNOWN RESIDUAL, STATED RATHER THAN DISCHARGED: JS `\s` covers the full
  -- Unicode space set where Postgres `[[:space:]]` covers only ASCII/C-locale
  -- - the identical divergence 001 recorded at :223-225. This CHECK is a
  -- strong guard, NOT a proof that the two normalisers agree, which is
  -- precisely why term_normaliser is carried as well.
  constraint remembered_choice_term_normalised check (
    choice_term = btrim(regexp_replace(
      regexp_replace(lower(choice_term), '[^a-z0-9&[:space:]]', ' ', 'g'),
      '[[:space:]]+', ' ', 'g'))),
  constraint remembered_choice_term_shaped check (
    btrim(choice_term) <> '' and length(choice_term) <= 200),
  constraint remembered_choice_normaliser_shaped check (
    btrim(term_normaliser) <> '' and length(term_normaliser) <= 80),

  -- THE CLOSED AUTHORISATION VOCABULARY. A future second learning rule adds a
  -- value IN A FUTURE MIGRATION: deliberate, reviewable, visible.
  constraint remembered_choice_authorised_by_known check (
    authorised_by in ('standing-rule-2026-08-09')),

  -- ONLY TWO DECISION KINDS MAY SOURCE A ROW. `skip_this_week`, `new_item`,
  -- `quantity_change` and `clarification_required` are STRUCTURALLY never
  -- remembered. Paired with the composite FK in section 3, this is not an
  -- assertion by the writer - it is PROVED equal to the sourcing decision's
  -- own kind.
  constraint remembered_choice_source_kind_known check (
    source_decision_kind in ('existing_regular','variant_choice'))
);

-- ---------------------------------------------------------------------
-- 3. The composite foreign key - "AUTHORISED, NOT ACCIDENTAL", PROVED.
--
-- This is the strongest single element of the design and the clearest reason
-- the shape is worth a migration.
--
-- The distinction Warwick drew - "an explicitly authorised standing
-- preference/learning rule, NOT an accidental promotion of an ordinary
-- one-week answer" - cannot be a plain CHECK, because it depends on another
-- table's row. It is NOT a trigger either: a trigger is exactly the machinery
-- the regrowth cap forbids. 017's own precedent for a cross-row invariant is a
-- COMPOSITE FOREIGN KEY, and it applies here byte-for-byte.
--
-- Bound this way, source_decision_kind is PROVABLY EQUAL to the sourcing
-- decision's decision_kind. It is not trusted from a writer and not trusted
-- from a model's structured return: a row claiming to come from a
-- `variant_choice` when the decision was a `skip_this_week` DOES NOT EXIST.
--
-- ── ON DELETE NO ACTION, AND THIS IS WHERE 018 DELIBERATELY DIVERGES FROM
--    017 ─────────────────────────────────────────────────────────────────
-- 017 CASCADES a decision away when its question is deleted, correctly: "a
-- decision about a deleted question is not a decision." A REMEMBERED choice is
-- the opposite case - it has OUTLIVED its shop by design, and deleting last
-- month's question must not erase this month's memory. So NO ACTION.
--
-- ⛔ DO NOT "FIX" THIS BACK TO CASCADE. The divergence is the point.
--
-- CONSEQUENCE TO RECORD, NOT TO DESIGN AROUND: with NO ACTION, deleting an
-- asdair.shop_question will now FAIL (through 017's own cascade to
-- shop_decision) where it previously succeeded. No runtime path hits this -
-- asdair_rw holds SELECT, INSERT, UPDATE and NO DELETE on shop_question
-- (006:207, 012:113-119) - but an owner-level cleanup would.
--
-- POSTGRES HAS NO `alter table ... add constraint if not exists`. Without a
-- guard, re-running this migration aborts the WHOLE file with 42710. 017
-- established this shape; it is repeated here rather than assumed.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'remembered_choice_decision_fk') then
    alter table asdair.remembered_choice
      add constraint remembered_choice_decision_fk
        foreign key (source_decision_id, source_decision_kind)
        references asdair.shop_decision (id, decision_kind)
        on delete no action;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Indexes.
-- ---------------------------------------------------------------------

-- STRUCTURAL IDEMPOTENCY, 017's model: ONE remembered choice per decision,
-- EVER. The writer is INSERT ... ON CONFLICT (source_decision_id) DO NOTHING
-- plus a re-select, so a replayed interpretation resolves to the SAME row
-- instead of minting a second, differently-read one.
create unique index if not exists remembered_choice_decision_uniq
  on asdair.remembered_choice (source_decision_id);

-- THE READ PATH: newest wins, for one household and one normalised term.
-- Ordered exactly as the reader orders, so "the most recent preference" is an
-- index scan and not a sort.
create index if not exists remembered_choice_lookup_idx
  on asdair.remembered_choice (household_id, choice_term, chosen_at desc, id desc);

-- No index on chosen_regular_id. "What have we chosen about product X over
-- time" is a question nobody has asked yet, and building an index for it is
-- exactly the anticipation the regrowth cap forbids.

-- ---------------------------------------------------------------------
-- 5. Grants.
--
-- SELECT + INSERT to asdair_rw. SELECT to asdair_ro. UPDATE and DELETE to
-- NOBODY - so a remembered choice cannot be silently rewritten by a code path
-- that exists OR IS LATER WRITTEN. 016's and 017's model, and the whole reason
-- this is a new table rather than a column on something asdair_rw may already
-- UPDATE.
--
-- A changed mind is a NEWER ROW. There is deliberately no update path to
-- write, because the database would refuse one.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then
    raise notice 'asdair_rw absent - skipping 018 write grants';
    return;
  end if;
  execute 'grant select, insert on asdair.remembered_choice to asdair_rw';
  execute 'grant usage on sequence '
       || pg_get_serial_sequence('asdair.remembered_choice','id') || ' to asdair_rw';
end $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_ro') then
    raise notice 'asdair_ro absent - skipping 018 read grant';
    return;
  end if;
  execute 'grant select on asdair.remembered_choice to asdair_ro';
end $$;

-- ── THE INSERT-ONLY CLAIM RESTS ON MORE THAN THIS GRANT MATRIX ─────────────
-- 017 established, against real PostgreSQL, that FOREIGN KEY REFERENTIAL
-- ACTIONS RUN WITH OWNER AUTHORITY AND BYPASS GRANTS. 018 RE-STATES IT RATHER
-- THAN ASSUMING IT, and closes the two paths it opens:
--
--   * chosen_regular_id  -> asdair.regulars      ON DELETE NO ACTION
--   * source_decision_id -> asdair.shop_decision ON DELETE NO ACTION
--
-- Neither is `cascade` and neither is `set null`, so NO referential action can
-- change or remove a row of this table. A delete upstream FAILS instead, which
-- is the correct outcome for a durable memory.
--
-- A THIRD DEPENDENCY, RECORDED BECAUSE IT IS NOT VISIBLE FROM THIS FILE: the
-- TARGET cannot be rewritten to mean something else. asdair_rw holds
-- table-level SELECT on asdair.regulars and a COLUMN-SCOPED UPDATE that
-- EXCLUDES name, household_id and active (005:71-75, 012:96-103), so the
-- runtime cannot rename or retire the product a memory points at. The claim
-- depends on that upstream grant staying as it is; it is recorded here so that
-- a future grant change is understood to reach this table too.
--
-- RECORDED, NOT WORK: asdair.remembered_choice will be ABSENT from migration
-- 012's enumerated grant matrix - as asdair.shop_decision already is (017:343-
-- 345). That makes two. A future matrix re-enumeration must pick up both.
-- 012 IS DELIBERATELY NOT AMENDED HERE.
--
-- ── WHAT 018 DOES NOT TOUCH ────────────────────────────────────────────────
-- Nothing here reads or writes asdair.rule_qa_log, asdair.rules,
-- applies_going_forward, or rule promotion. Nothing here consumes
-- shop_decision.forward_intent, which remains STORED AND ROUTED NOWHERE:
-- "yes, get it every week" is a REPEAT-PURCHASE signal and is a different fact
-- from "when this is ambiguous, this is the one I pick". Conflating them would
-- make a parked column suddenly basket-affecting. Current-shop decisions and
-- their provenance are untouched - Warwick required that explicitly.
