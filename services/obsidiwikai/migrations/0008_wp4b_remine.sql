-- WP4B additive historical semantic re-mining.
-- The temporary extraction graph is disposable processing machinery. These
-- ledgers preserve the frozen evidence, decisions, apply receipts and rollback
-- pre-images that make authoritative LightRAG writes auditable and replay-safe.

set search_path to obsidiwikai, public;

create table if not exists obsidiwikai.wp4b_bundle (
  run_id                      uuid primary key references obsidiwikai.processing_run(run_id) on delete cascade,
  source_id                   text not null references obsidiwikai.source(source_id),
  faithful_clean_sha256       text not null,
  lens_fingerprint            text not null,
  extraction_profile_version  text not null,
  approved_additions          jsonb not null default '[]'::jsonb,
  before_state                jsonb not null,
  candidate_bundle            jsonb,
  canonical_plan              jsonb,
  after_state                 jsonb,
  real_delta                  jsonb,
  validator_result            jsonb,
  status                      text not null default 'before_frozen'
                              check (status in (
                                'before_frozen','extracted','canonicalised','applying',
                                'applied','validated','held','rolled_back','failed'
                              )),
  temp_workspace_retired_at   timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (source_id, faithful_clean_sha256, lens_fingerprint, extraction_profile_version)
);
create index if not exists wp4b_bundle_source_idx
  on obsidiwikai.wp4b_bundle(source_id, created_at desc);

create table if not exists obsidiwikai.wp4b_operation_receipt (
  operation_id   uuid primary key default gen_random_uuid(),
  run_id         uuid not null references obsidiwikai.wp4b_bundle(run_id) on delete cascade,
  sequence       int not null,
  operation_key  text not null,
  operation_kind text not null
                 check (operation_kind in (
                   'entity_create','entity_evidence','relation_create','relation_evidence'
                 )),
  target         jsonb not null,
  pre_image      jsonb,
  request        jsonb not null,
  response       jsonb,
  verification   jsonb,
  rollback       jsonb,
  state          text not null default 'planned'
                 check (state in ('planned','applied','verified','rolled_back','failed')),
  error          text,
  created_at     timestamptz not null default now(),
  applied_at     timestamptz,
  verified_at    timestamptz,
  unique (run_id, operation_key),
  unique (run_id, sequence)
);
create index if not exists wp4b_receipt_run_idx
  on obsidiwikai.wp4b_operation_receipt(run_id, sequence);

comment on table obsidiwikai.wp4b_bundle is
  'Frozen additive WP4B before/candidate/after evidence; never a second encyclopedia.';
comment on table obsidiwikai.wp4b_operation_receipt is
  'Per-mutation pre-image, verification and compensating rollback receipt for WP4B.';
