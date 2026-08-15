-- BUILD-006 Phase 2 — the Source Compiler's durable output: the evidence pack.
--
-- ADDITIVE AND ISOLATED, exactly as 001 is. This migration adds three tables to the
-- EXISTING `vlogops` namespace and writes nothing outside it. It creates no schema of its
-- own (001 already did), issues NO GRANTS, and touches row-level security nowhere. Every
-- object is schema-qualified; there is no search_path dependency in this file.
--
-- FORWARD-ONLY and IDEMPOTENT. Applying it twice against a fresh cluster succeeds and
-- leaves identical structure. `teardown.sql` already reverses it: it drops the `vlogops`
-- namespace with CASCADE, and every object below is created inside that namespace and
-- nowhere else. Nothing in teardown.sql needed to change, which is the property that made
-- 001's one-statement teardown worth writing that way.
--
-- Numbering continues 001 in this directory and is derived from nothing else.
--
-- ─────────────────────────────────────────────────────────────────────────────────────
-- THE ONE STRUCTURAL DECISION WORTH READING BEFORE THE DDL
--
-- AN ENTRY DOES NOT CARRY THE SOURCE BYTES. It carries a FOREIGN KEY to the snapshot
-- Phase 1 already froze. There is therefore exactly one copy of the truth in this store,
-- and the composite reference (seed_id, source_ref) -> vlogops.source_snapshot makes it
-- STRUCTURALLY IMPOSSIBLE for a pack to contain an entry that does not point at a real,
-- frozen, provenance-bearing snapshot. "Provenance-complete" is then a property of the
-- schema rather than a promise made by the compiler.
--
-- It is also what makes a later source failure a non-event. The compiler never re-reads
-- the original artefact; the snapshot is immutable by 001's trigger; so an entry's content
-- cannot be altered or erased by anything that happens to the file on disk afterwards.
-- The reliability rule is inherited from the design, not re-implemented here.
-- ─────────────────────────────────────────────────────────────────────────────────────


-- ---------------------------------------------------------------------------
-- evidence_pack — one row per compiled pack identity.
--
-- pack_id is the sha256 of a canonical manifest, on exactly the pattern 001 established
-- for seed_id: a pure function of content, with the hashed bytes stored beside the hash so
-- any reader can recompute it from the row rather than trusting the compiler. No clock, no
-- row id, no pid, no hostname and no insertion order contributes to it — which is what
-- makes two unrelated processes compiling the same seed land on this same row.
--
-- `manifest` holds those exact bytes. `budget` records the limits that were in force, and
-- `omitted` records WHAT WAS LEFT OUT AND WHY. A bounded pack that cannot be told apart
-- from a complete one is the defect this table exists to prevent, so `bounded` is stored
-- as a fact rather than inferred by a reader counting rows.
create table if not exists vlogops.evidence_pack (
  pack_id        char(64) primary key
                 check (pack_id ~ '^[0-9a-f]{64}$'),
  seed_id        char(64) not null
                 references vlogops.content_seed (seed_id),

  -- Bump these when the manifest shape or either rule changes: a pack compiled under a
  -- different rule is honestly a different pack, and the version participates in identity.
  compiler_version      text not null,
  selection_rule_version text not null,
  ordering_rule_version  text not null,
  manifest_algo         text not null default 'sha256-canonical-json-v1',

  manifest       jsonb    not null,
  budget         jsonb    not null,

  -- Every candidate entry that did NOT make the pack, each with its reason. An empty array
  -- is a claim that nothing was dropped, not an absence of record-keeping.
  omitted        jsonb    not null,

  entry_count    integer  not null check (entry_count >= 0),
  entry_bytes    bigint   not null check (entry_bytes >= 0),

  -- TRUE when a budget actually bound. Read with `omitted` it tells a reader the difference
  -- between "this is everything the seed had" and "this is the part that fitted".
  bounded        boolean  not null,

  created_at     timestamptz not null default now(),

  -- A pack with no entries is not a bounded pack, it is a failed compile. It is not storable.
  constraint evidence_pack_non_empty check (entry_count > 0),

  -- `bounded` means precisely ONE thing: a BUDGET bound. Not "something was dropped" —
  -- collapsing a duplicate drops a row while losing no evidence, and a reader who cannot
  -- tell those two apart has been told something false in a field named for precision.
  --
  -- So the flag is tied to the disclosure that justifies it, in the database: `bounded` is
  -- true if and only if `omitted` actually contains an over-budget entry. The compiler
  -- cannot set the flag without producing the evidence for it, and cannot produce the
  -- evidence without setting the flag. A silent truncation is unwritable.
  constraint evidence_pack_bounded_discloses
    check (bounded = jsonb_path_exists(omitted, '$[*] ? (@.reason == "over-budget")')),

  -- Redundant against the primary key, and required: the composite foreign key from
  -- evidence_pack_entry below references this pair, which is what stops an entry claiming a
  -- different seed from the pack that contains it.
  constraint evidence_pack_pack_seed_unique unique (pack_id, seed_id)
);

create index if not exists evidence_pack_seed_idx
  on vlogops.evidence_pack (seed_id, created_at desc);


-- ---------------------------------------------------------------------------
-- evidence_pack_entry — one row per artefact IN the pack, in presentation order.
--
-- `ordinal` is the CHRONOLOGICAL position the compiler decided, not the order rows were
-- written. `occurred_at` is the source's own time where one is derivable from the frozen
-- provenance, and NULL where none is — an honest unknown rather than a fabricated
-- timestamp or a silent substitution of the capture clock, which would be a different
-- number wearing the same name.
--
-- `occurred_at_basis` records WHY the entry sits where it does. A tidier ordering that hid
-- the gap would be worth less than this: a reader can see which entries are genuinely
-- placed and which are merely bucketed.
create table if not exists vlogops.evidence_pack_entry (
  pack_id        char(64) not null,
  seed_id        char(64) not null,
  ordinal        integer  not null check (ordinal >= 0),
  source_ref     text     not null,
  content_sha256 char(64) not null
                 check (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_length    bigint   not null check (byte_length >= 0),
  media_type     text     not null,

  occurred_at       timestamptz,
  occurred_at_basis text not null
                    check (occurred_at_basis in ('git-commit-time', 'dated-filename', 'unknown')),

  provenance     jsonb    not null,

  primary key (pack_id, ordinal),

  -- The same artefact cannot appear twice in one pack. Dedupe is the DATABASE's ruling,
  -- not an in-memory Set's — the same discipline 001 applied to seed identity.
  constraint evidence_pack_entry_unique_ref unique (pack_id, source_ref),
  constraint evidence_pack_entry_unique_content unique (pack_id, content_sha256),

  -- The entry belongs to this pack, and the pack is for this seed. One reference, both facts.
  constraint evidence_pack_entry_pack_fk
    foreign key (pack_id, seed_id) references vlogops.evidence_pack (pack_id, seed_id),

  -- THE LOAD-BEARING ONE. An entry must point at a snapshot that Phase 1 actually froze,
  -- under the same seed. An entry referencing nothing, or referencing another seed's
  -- snapshot, cannot be written at all.
  constraint evidence_pack_entry_snapshot_fk
    foreign key (seed_id, source_ref) references vlogops.source_snapshot (seed_id, source_ref),

  -- A basis of 'unknown' means no time was derivable; any other basis means one was. The
  -- two halves cannot disagree.
  constraint evidence_pack_entry_basis_matches_time
    check ((occurred_at_basis = 'unknown') = (occurred_at is null))
);

create index if not exists evidence_pack_entry_content_sha_idx
  on vlogops.evidence_pack_entry (content_sha256);

create index if not exists evidence_pack_entry_seed_idx
  on vlogops.evidence_pack_entry (seed_id, source_ref);


-- ---------------------------------------------------------------------------
-- compile_run — an append-only ledger of compile attempts.
--
-- THIS IS AN AUDIT TRAIL, NOT A QUEUE, for the same reason intake_run is not one: the
-- compile writes its pack, all of its entries and this row inside ONE transaction, so a
-- killed compiler leaves either nothing or one complete pack. There is no third state, so
-- there is no lease, no claim, no visibility timeout and nothing for a reconciler to do.
create table if not exists vlogops.compile_run (
  pack_id      char(64) not null,
  attempt_key  char(64) not null
               check (attempt_key ~ '^[0-9a-f]{64}$'),
  seed_id      char(64) not null,
  outcome      text     not null
               check (outcome in ('compiled', 'deduplicated')),
  entry_count  integer  not null check (entry_count >= 0),
  recorded_at  timestamptz not null default now(),

  primary key (pack_id, attempt_key)
);


-- ---------------------------------------------------------------------------
-- Immutability, enforced by the database rather than by convention.
--
-- Reusing 001's vlogops.deny_mutation() rather than writing a second one: one rule, one
-- implementation, one place it can be got wrong. Called with no arguments it refuses every
-- UPDATE and every DELETE.
--
-- A pack is fully immutable — unlike content_seed it carries no lifecycle column, so there
-- is nothing about it that a caller has any business rewriting. A pack that could be edited
-- after the fact would make "a later source failure cannot alter an existing run" a promise
-- about the application's manners.
drop trigger if exists evidence_pack_immutable on vlogops.evidence_pack;
create trigger evidence_pack_immutable
  before update or delete on vlogops.evidence_pack
  for each row execute function vlogops.deny_mutation();

drop trigger if exists evidence_pack_entry_immutable on vlogops.evidence_pack_entry;
create trigger evidence_pack_entry_immutable
  before update or delete on vlogops.evidence_pack_entry
  for each row execute function vlogops.deny_mutation();

drop trigger if exists compile_run_immutable on vlogops.compile_run;
create trigger compile_run_immutable
  before update or delete on vlogops.compile_run
  for each row execute function vlogops.deny_mutation();
