-- BUILD-006 Phase 3 — Scribe's durable output: the Master Story Package.
--
-- ADDITIVE AND ISOLATED, exactly as 001 and 002 are. This migration adds four tables and two
-- functions to the EXISTING `vlogops` namespace and writes nothing outside it. It creates no
-- schema of its own, issues NO GRANTS, and touches row-level security nowhere. Every object is
-- schema-qualified; there is no search_path dependency in this file.
--
-- FORWARD-ONLY and IDEMPOTENT. Applying it twice against a fresh cluster succeeds and leaves
-- identical structure. `teardown.sql` already reverses it — it drops the `vlogops` namespace
-- with CASCADE, and every object below is created inside that namespace and nowhere else.
-- Nothing in teardown.sql needed to change.
--
-- Numbering continues 002 in this directory and is derived from nothing else.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- WHY THIS SCHEMA LOOKS LIKE THIS — read before the DDL, because the shape IS the feature
--
-- The Work Order's acceptance property is that every claim in every sibling traces to an entry
-- in the evidence pack, and that no sibling asserts something the master narrative does not.
--
-- The obvious implementation is a validator: generate the blog, then walk its prose looking for
-- uncited sentences. That is ADVISORY DRESSED AS ENFORCEMENT. It runs after the fact, it can
-- be skipped, it degrades the moment prose stops looking the way the parser expects, and its
-- verdict is an opinion about text rather than a property of the store.
--
-- So there is no free prose here to police. A SIBLING IS A PROJECTION OF CITED ROWS:
--
--     story_claim            the master's canonical assertions — the only creative truth
--     story_claim_citation   what each master claim RESTS ON, as a foreign key into the pack
--     story_segment          a sibling's unit of output, which MUST name a master claim AND a
--                            citation that master claim actually holds
--
-- Read the foreign keys and the four failure modes are all unwritable, by the database, against
-- any client — including a future one that has forgotten why the rule exists:
--
--   a sibling segment with no citation ................. NOT NULL columns
--   a citation to an entry not in the pack ............. FK -> vlogops.evidence_pack_entry
--   a citation to an entry in SOMEBODY ELSE'S pack ..... FK -> vlogops.story_package (package_id, pack_id)
--   a sibling asserting what the master does not ....... FK -> vlogops.story_claim_citation
--                                                         (package_id, claim_id, pack_id, source_ref)
--   a sibling with no master at all .................... FK -> vlogops.story_claim
--
-- That last one is the whole of AC4 and it is a constraint, not a promise. 002 made
-- provenance-completeness a property of the schema rather than a promise made by the compiler;
-- this makes traceability a property of the schema rather than a promise made by Scribe.
--
-- The application refuses the same four things FIRST, loudly, with named error codes, before a
-- transaction is ever opened — see src/scribe/proposal.mjs. That is deliberate belt-and-braces
-- and the two layers answer to different readers: the named error tells a human what the model
-- got wrong; the constraint means it could not have been stored even if nobody was looking.
-- ═════════════════════════════════════════════════════════════════════════════════════════


-- ---------------------------------------------------------------------------
-- story_package — one row per Master Story Package identity.
--
-- package_id is the sha256 of a canonical manifest, on exactly the pattern 001 established for
-- seed_id and 002 for pack_id: a pure function of content, with the hashed bytes stored beside
-- the hash so any reader can recompute it from the row rather than trusting the writer. No
-- clock, no row id, no pid and no insertion order contributes to it.
--
-- derivation_id is a DIFFERENT and deliberately weaker identity: the hash of the deterministic
-- INPUTS ONLY — the pack, the contract, the assembled prompt bytes and the derivation rule. It
-- is stable across runs even when the model's words are not, which is the honest way to say
-- "everything except the model's own output is reproducible". Two packages with the same
-- derivation_id were asked exactly the same question of exactly the same evidence under exactly
-- the same contract; whether they answered it the same way is a separate fact, visible in
-- package_id.
--
-- model_binding records WHAT PRODUCED THE WORDS — provider, client or model, and whether a real
-- gateway was configured. A package drafted by the deterministic stub says so, in the row, for
-- as long as the row exists. Nobody downstream has to remember which run was which.
create table if not exists vlogops.story_package (
  package_id     char(64) primary key
                 check (package_id ~ '^[0-9a-f]{64}$'),
  pack_id        char(64) not null,
  seed_id        char(64) not null,

  derivation_id  char(64) not null
                 check (derivation_id ~ '^[0-9a-f]{64}$'),

  -- Bump these when the contract or the derivation rule changes: a package produced under a
  -- different contract is honestly a different package, and both participate in identity.
  scribe_version      text not null,
  contract_version    text not null,
  contract_id         char(64) not null
                      check (contract_id ~ '^[0-9a-f]{64}$'),
  derivation_rule_version text not null,
  prompt_sha256       char(64) not null
                      check (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_algo       text not null default 'sha256-canonical-json-v1',

  model_binding  jsonb not null,
  manifest       jsonb not null,

  -- The one sentence the whole package answers. Denormalised out of the manifest so an operator
  -- can read the store's contents with psql and no JSON path expression.
  story_question text not null
                 check (length(btrim(story_question)) > 0),

  claim_count    integer not null check (claim_count > 0),
  segment_count  integer not null check (segment_count > 0),
  created_at     timestamptz not null default now(),

  -- The package's seed is the PACK's seed. Not a second opinion about which seed this is:
  -- one reference, both facts, and a package cannot be attached to a pack while claiming a
  -- different origin.
  constraint story_package_pack_fk
    foreign key (pack_id, seed_id) references vlogops.evidence_pack (pack_id, seed_id),

  -- Redundant against the primary key, and required: the citation table references this pair,
  -- which is what stops a claim citing an entry that belongs to a different pack entirely.
  constraint story_package_package_pack_unique unique (package_id, pack_id)
);

create index if not exists story_package_pack_idx
  on vlogops.story_package (pack_id, created_at desc);

create index if not exists story_package_derivation_idx
  on vlogops.story_package (derivation_id);


-- ---------------------------------------------------------------------------
-- story_claim — THE MASTER. One canonical creative truth, as rows.
--
-- The story question, the beats and the narrative claims are the same kind of thing — an
-- assertion the package makes — so they are one table with a `kind`, not three tables that
-- would have to be kept consistent with each other by hand.
--
-- Nothing else in this migration can exist without one of these rows. That is what "siblings
-- are DERIVED from one truth" means when it is written as a schema instead of as a sentence.
create table if not exists vlogops.story_claim (
  package_id  char(64) not null,
  claim_id    text     not null
              check (claim_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  kind        text     not null
              check (kind in ('story-question', 'beat', 'narrative-claim')),
  ordinal     integer  not null check (ordinal >= 0),
  text        text     not null
              check (length(btrim(text)) > 0),

  primary key (package_id, claim_id),

  constraint story_claim_package_fk
    foreign key (package_id) references vlogops.story_package (package_id),

  -- Two claims cannot occupy the same position in the same kind. The master has an order and
  -- it is a fact about the package, not about the order rows were written.
  constraint story_claim_position_unique unique (package_id, kind, ordinal)
);


-- ---------------------------------------------------------------------------
-- story_claim_citation — what a master claim RESTS ON.
--
-- A claim may rest on several entries, so this is a table rather than a column. Three foreign
-- keys, each closing a different hole:
--
--   _claim_fk    the citation belongs to a real claim of this package
--   _package_fk  the pack cited is THIS package's pack, not another one that happens to
--                contain a file with the same path
--   _entry_fk    the entry cited is really in that pack — Phase 2's own unique (pack_id,
--                source_ref), reused rather than re-derived
--
-- Together: a citation that does not resolve cannot be written down.
create table if not exists vlogops.story_claim_citation (
  package_id  char(64) not null,
  claim_id    text     not null,
  pack_id     char(64) not null,
  source_ref  text     not null,

  primary key (package_id, claim_id, source_ref),

  constraint story_claim_citation_claim_fk
    foreign key (package_id, claim_id) references vlogops.story_claim (package_id, claim_id),

  constraint story_claim_citation_package_fk
    foreign key (package_id, pack_id) references vlogops.story_package (package_id, pack_id),

  constraint story_claim_citation_entry_fk
    foreign key (pack_id, source_ref) references vlogops.evidence_pack_entry (pack_id, source_ref),

  -- The exact quad a sibling segment points at. Carrying pack_id in the key is what stops a
  -- segment naming pack A while its master's citation named pack B.
  constraint story_claim_citation_quad_unique unique (package_id, claim_id, pack_id, source_ref)
);

create index if not exists story_claim_citation_entry_idx
  on vlogops.story_claim_citation (pack_id, source_ref);


-- ---------------------------------------------------------------------------
-- story_segment — THE SIBLINGS. Script, blog, titles, thumbnail direction.
--
-- A segment is one unit of sibling output — a scene, a paragraph, a candidate title, a
-- direction. It is NOT free text with a citation attached as an afterthought: it cannot exist
-- without naming the master claim it adapts AND a citation that master claim actually holds.
--
-- Titles and thumbnail direction are the awkward cases and they are handled honestly. A title
-- is not a proposition, so it does not carry its own evidence; it cites the master claim it
-- dramatises, and that claim carries the evidence. The chain still resolves to a pack entry,
-- in two hops, totally, because every foreign key on the way is NOT NULL.
create table if not exists vlogops.story_segment (
  package_id  char(64) not null,
  sibling     text     not null
              check (sibling in ('script', 'blog', 'titles', 'thumbnail-direction')),
  ordinal     integer  not null check (ordinal >= 0),

  role        text     not null
              check (length(btrim(role)) > 0),
  text        text     not null
              check (length(btrim(text)) > 0),

  claim_id    text     not null,
  pack_id     char(64) not null,
  source_ref  text     not null,

  primary key (package_id, sibling, ordinal),

  constraint story_segment_package_fk
    foreign key (package_id) references vlogops.story_package (package_id),

  -- A SIBLING CANNOT BE GENERATED WITHOUT A MASTER. Not a rule the generator follows — a row
  -- that cannot be inserted.
  constraint story_segment_claim_fk
    foreign key (package_id, claim_id) references vlogops.story_claim (package_id, claim_id),

  -- The one-hop guarantee AC3 asks for literally: the segment's own citation resolves to an
  -- entry of the pack, directly, with no reasoning required by the reader.
  constraint story_segment_entry_fk
    foreign key (pack_id, source_ref) references vlogops.evidence_pack_entry (pack_id, source_ref),

  -- THE LOAD-BEARING ONE, and the whole of AC4. The segment's citation must be one its OWN
  -- master claim rests on. A sibling that cites real evidence its master never used is drift —
  -- it is how a blog quietly acquires a claim the video never made — and it is unwritable.
  constraint story_segment_cites_its_master
    foreign key (package_id, claim_id, pack_id, source_ref)
      references vlogops.story_claim_citation (package_id, claim_id, pack_id, source_ref)
);

create index if not exists story_segment_claim_idx
  on vlogops.story_segment (package_id, claim_id);


-- ---------------------------------------------------------------------------
-- The two things a foreign key cannot say, said with deferred constraint triggers.
--
-- A foreign key expresses "at most one, and it must exist". It cannot express "at least one".
-- Both rules below are AT-LEAST-ONE rules, and both are checked at COMMIT rather than at INSERT
-- because the whole package is written inside one transaction and the rows necessarily arrive
-- in an order where an immediate check would fire on a perfectly correct write.
--
-- DEFERRABLE INITIALLY DEFERRED is doing real work here: it moves the question from "is this
-- row acceptable yet" to "is the finished package acceptable", which is the question that
-- actually matters.

-- Every master claim rests on at least one entry. A claim citing nothing is an assertion the
-- package cannot support, and the acceptance property does not survive one of them.
create or replace function vlogops.require_claim_citation() returns trigger
language plpgsql as $require_cite$
begin
  if not exists (
    select 1 from vlogops.story_claim_citation c
     where c.package_id = new.package_id and c.claim_id = new.claim_id
  ) then
    raise exception 'vlogops: story_claim %/% cites no evidence; a master claim must rest on at least one pack entry',
      new.package_id, new.claim_id
      using errcode = 'integrity_constraint_violation';
  end if;
  return null;
end;
$require_cite$;

-- The counts on story_package are a CLAIM about the rows beneath it, so they are tied to those
-- rows rather than trusted. Same discipline as 002's `bounded` flag, which cannot be set
-- without the disclosure that justifies it: here the header cannot misreport its own body.
create or replace function vlogops.require_package_counts() returns trigger
language plpgsql as $require_counts$
declare
  actual_claims integer;
  actual_segments integer;
begin
  select count(*) into actual_claims
    from vlogops.story_claim where package_id = new.package_id;
  select count(*) into actual_segments
    from vlogops.story_segment where package_id = new.package_id;

  if actual_claims <> new.claim_count then
    raise exception 'vlogops: story_package % declares % claims and holds %',
      new.package_id, new.claim_count, actual_claims
      using errcode = 'integrity_constraint_violation';
  end if;

  if actual_segments <> new.segment_count then
    raise exception 'vlogops: story_package % declares % segments and holds %',
      new.package_id, new.segment_count, actual_segments
      using errcode = 'integrity_constraint_violation';
  end if;

  return null;
end;
$require_counts$;

drop trigger if exists story_claim_requires_citation on vlogops.story_claim;
create constraint trigger story_claim_requires_citation
  after insert on vlogops.story_claim
  deferrable initially deferred
  for each row execute function vlogops.require_claim_citation();

drop trigger if exists story_package_counts_are_true on vlogops.story_package;
create constraint trigger story_package_counts_are_true
  after insert on vlogops.story_package
  deferrable initially deferred
  for each row execute function vlogops.require_package_counts();


-- ---------------------------------------------------------------------------
-- Immutability, enforced by the database rather than by convention.
--
-- Reusing 001's vlogops.deny_mutation() rather than writing a third one. Called with no
-- arguments it refuses every UPDATE and every DELETE.
--
-- A package is fully immutable, like a pack and unlike a seed: it carries no lifecycle column,
-- so there is nothing about it a caller has any business rewriting. This is also what makes
-- AC5 true rather than promised — changing the Scribe contract cannot retroactively alter an
-- existing package, because no client can alter an existing package at all. A new contract
-- produces a new identity and a new row; the old row keeps saying what it always said, under
-- the contract_id that produced it.
drop trigger if exists story_package_immutable on vlogops.story_package;
create trigger story_package_immutable
  before update or delete on vlogops.story_package
  for each row execute function vlogops.deny_mutation();

drop trigger if exists story_claim_immutable on vlogops.story_claim;
create trigger story_claim_immutable
  before update or delete on vlogops.story_claim
  for each row execute function vlogops.deny_mutation();

drop trigger if exists story_claim_citation_immutable on vlogops.story_claim_citation;
create trigger story_claim_citation_immutable
  before update or delete on vlogops.story_claim_citation
  for each row execute function vlogops.deny_mutation();

drop trigger if exists story_segment_immutable on vlogops.story_segment;
create trigger story_segment_immutable
  before update or delete on vlogops.story_segment
  for each row execute function vlogops.deny_mutation();
