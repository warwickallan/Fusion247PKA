-- BUILD-006 Phase 1 — the durable Content Seed store.
--
-- ADDITIVE AND ISOLATED, BY CONSTRUCTION. This migration creates one new namespace and
-- writes nothing outside it. Its destination is a managed Postgres project that already
-- holds real household data in other namespaces, so "additive" is the entire reason this
-- is safe to apply there at all. Every object below is schema-qualified; there is no
-- search_path dependency and no unqualified object anywhere in this file.
--
-- FORWARD-ONLY and IDEMPOTENT. Applying it twice against a fresh cluster succeeds and
-- leaves identical structure. `teardown.sql` reverses it and reverses nothing else.
--
-- NO GRANTS ARE ISSUED. Nothing is granted to anon, authenticated or service_role, so
-- this namespace is invisible to the managed project's Data API by default. The runtime
-- path is a direct connection under VLOGOPS_DB_URL. Row-level security is not touched
-- anywhere, on any namespace.
--
-- Numbering starts at 001 in this directory and is deliberately NOT derived from any
-- other migration ledger.

create schema if not exists vlogops;


-- ---------------------------------------------------------------------------
-- content_seed — one row per seed identity.
--
-- seed_id is the sha256 of a canonical, sorted manifest of what the seed contains. It
-- is a pure function of content: no row id, no clock, no insertion order and no
-- in-process state contributes to it. That is what makes the same source, taken in
-- twice by two unrelated processes, land on the same row.
--
-- manifest holds the exact bytes that were hashed, so any reader can recompute the
-- identity from the row alone and check it, rather than trusting the writer.
--
-- selection_key is the hash of the REQUEST rather than the result: same selector, same
-- key. It exists so a later phase can tell "this is the same selection, re-taken after
-- the underlying records changed" from "this is an unrelated seed". supersedes is the
-- link that phase would use. BOTH ARE RECORDED AND NOTHING READS THEM YET — there is
-- deliberately no supersession logic, no history walker and no reconciliation pass at
-- this phase.
create table if not exists vlogops.content_seed (
  seed_id        char(64) primary key
                 check (seed_id ~ '^[0-9a-f]{64}$'),
  selection_key  char(64) not null
                 check (selection_key ~ '^[0-9a-f]{64}$'),
  route          text     not null
                 check (route in ('records', 'promotion', 'supplied')),
  angle          text,
  origin         text,
  privacy_state  text     not null
                 check (privacy_state in ('unclassified', 'public', 'internal', 'private', 'restricted')),
  manifest       jsonb    not null,
  manifest_algo  text     not null default 'sha256-canonical-json-v1',

  -- Why THESE sources and not the others in range. Immutable, and deliberately NOT part
  -- of the identity: the seed is what it contains, not how it was chosen. Recorded so that
  -- "smallest sufficient" can be audited later by someone who was not there.
  selection      jsonb,
  status         text     not null default 'sealed'
                 check (status in ('sealed', 'abandoned')),
  supersedes     char(64) references vlogops.content_seed (seed_id),
  created_at     timestamptz not null default now(),
  sealed_at      timestamptz,

  -- Route 2's five-field promotion contract, enforced structurally: a promotion missing
  -- its origin or its proposed angle is NOT STORABLE. A rejected promotion is therefore
  -- a rejection, never a partial seed that someone later mistakes for a whole one.
  constraint content_seed_promotion_contract
    check (route <> 'promotion' or (angle is not null and origin is not null)),

  -- Route 3's angle is required input and is never inferred from the text.
  constraint content_seed_supplied_requires_angle
    check (route <> 'supplied' or angle is not null),

  constraint content_seed_sealed_has_timestamp
    check (status <> 'sealed' or sealed_at is not null)
);

create index if not exists content_seed_selection_key_idx
  on vlogops.content_seed (selection_key);

create index if not exists content_seed_route_created_idx
  on vlogops.content_seed (route, created_at desc);


-- ---------------------------------------------------------------------------
-- source_snapshot — the frozen bytes of one captured source artefact.
--
-- The primary key is (seed_id, source_ref) rather than the content hash: two byte-identical
-- artefacts captured from two different places are two snapshots with two provenances, and
-- collapsing them would lose the provenance that the whole build depends on.
--
-- content_sha256 is the hash of EXACTLY the bytes stored in this row. Normalisation, where
-- a route performs any, happens before storage — never after retrieval — so re-hashing the
-- stored bytes is a real integrity check rather than a restatement of an assumption.
create table if not exists vlogops.source_snapshot (
  seed_id        char(64) not null
                 references vlogops.content_seed (seed_id),
  source_ref     text     not null,
  content_sha256 char(64) not null
                 check (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_length    bigint   not null check (byte_length >= 0),
  media_type     text     not null,
  content        bytea,
  content_url    text,
  provenance     jsonb    not null,
  privacy_state  text     not null
                 check (privacy_state in ('unclassified', 'public', 'internal', 'private', 'restricted')),
  captured_at    timestamptz not null default now(),

  primary key (seed_id, source_ref),

  -- Either the bytes are here, or a content-addressed reference to them is.
  constraint source_snapshot_has_content
    check (content is not null or content_url is not null),

  -- byte_length describes the stored bytes when they are stored inline. A row whose
  -- declared length disagrees with its content is a corrupt row and cannot be written.
  constraint source_snapshot_length_matches
    check (content is null or octet_length(content) = byte_length)
);

create index if not exists source_snapshot_content_sha_idx
  on vlogops.source_snapshot (content_sha256);


-- ---------------------------------------------------------------------------
-- intake_run — an append-only ledger of intake attempts.
--
-- THIS IS AN AUDIT TRAIL, NOT A QUEUE. It holds no lease, no claim, no visibility timeout
-- and no worker pool, because a durable job queue is not what this phase needs: correctness
-- under an abrupt kill is carried by the single-transaction seal in the application, where
-- a seed and every one of its snapshots commit together or not at all. A killed process
-- leaves either nothing or a complete seed; there is no third state for a reconciler to
-- clean up. This table records what was attempted so an operator can see it.
create table if not exists vlogops.intake_run (
  seed_id     char(64) not null,
  attempt_key char(64) not null
              check (attempt_key ~ '^[0-9a-f]{64}$'),
  route       text     not null
              check (route in ('records', 'promotion', 'supplied')),
  outcome     text     not null
              check (outcome in ('sealed', 'deduplicated')),
  member_count integer not null check (member_count >= 0),
  recorded_at timestamptz not null default now(),

  primary key (seed_id, attempt_key)
);


-- ---------------------------------------------------------------------------
-- Immutability, enforced by the database rather than by convention.
--
-- The reliability rule this build inherits is that a later source failure cannot erase or
-- reinterpret an existing run. A rule that lives only in the application holds exactly as
-- long as every future caller remembers it. Here a snapshot cannot be updated or deleted
-- by any client, including a future one that has forgotten why.
--
-- On content_seed the immutable set is the identity-bearing columns. Lifecycle columns
-- remain writable so the row can be marked abandoned or linked without a rewrite of what
-- the seed IS.
create or replace function vlogops.deny_mutation() returns trigger
language plpgsql as $deny$
declare
  col text;
begin
  if tg_op = 'DELETE' then
    raise exception 'vlogops: % is append-only; DELETE refused', tg_table_name
      using errcode = 'integrity_constraint_violation';
  end if;

  if tg_nargs = 0 then
    raise exception 'vlogops: % is append-only; UPDATE refused', tg_table_name
      using errcode = 'integrity_constraint_violation';
  end if;

  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'vlogops: %.% is identity-bearing and immutable; UPDATE refused', tg_table_name, col
        using errcode = 'integrity_constraint_violation';
    end if;
  end loop;

  return new;
end;
$deny$;

drop trigger if exists source_snapshot_immutable on vlogops.source_snapshot;
create trigger source_snapshot_immutable
  before update or delete on vlogops.source_snapshot
  for each row execute function vlogops.deny_mutation();

drop trigger if exists intake_run_immutable on vlogops.intake_run;
create trigger intake_run_immutable
  before update or delete on vlogops.intake_run
  for each row execute function vlogops.deny_mutation();

drop trigger if exists content_seed_identity_immutable on vlogops.content_seed;
create trigger content_seed_identity_immutable
  before update on vlogops.content_seed
  for each row execute function vlogops.deny_mutation(
    'seed_id', 'selection_key', 'route', 'angle', 'origin',
    'manifest', 'manifest_algo', 'selection', 'created_at'
  );

drop trigger if exists content_seed_no_delete on vlogops.content_seed;
create trigger content_seed_no_delete
  before delete on vlogops.content_seed
  for each row execute function vlogops.deny_mutation();
