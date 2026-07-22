-- =============================================================================
-- MyPKA cockpit migration 060 — BUILD-002 build-acceptance contract layer
--
-- WP0 of the resumed BUILD-002 Unified Fusion Hub. Two objects in the existing `cockpit`
-- schema (the schema Directus already reads via cp_directus SELECT):
--
--   1. cockpit.build_contract   — the OPERATIONAL approved-version RECORD + readable projection
--        of the canonical Git contract (Builds/BUILD-002-.../BUILD-CONTRACT.md). GitHub Markdown
--        stays CANONICAL; this row is the operational/QA record + what Directus renders. It is
--        NOT the only copy of the contract. cp_directus gets SELECT only — Directus can render
--        it but can NEVER mutate approval state.
--   2. cockpit.contract_command — the APPROVAL INTENT queue. Mirrors the asdair.command_request
--        write-back seam exactly: the cockpit (cp_directus) may only INSERT an intent
--        (approve_contract / request_changes, status=requested, no receipt); a trusted worker
--        (cp_worker) claims + APPLIES it to build_contract, binding the approval to the EXACT
--        contract version + Git SHA + content hash, and writes a receipt. Directus never rewrites
--        approval history or runtime truth (order §6/§17).
--
-- Idempotent (create if not exists + create-or-replace + drop/create trigger). Reversible via
-- teardown.sql. Grants live in 070_build_contract_grants.sql (atomic revoke-then-grant, like 040).
-- No secret value is stored: content_ref/url are pointers; hashes are integrity fingerprints.
-- =============================================================================
create schema if not exists cockpit;

-- ---------------------------------------------------------------------------
-- cockpit.build_contract — operational approved-version record + readable projection.
-- ---------------------------------------------------------------------------
create table if not exists cockpit.build_contract (
  id                      uuid primary key default gen_random_uuid(),
  build_id                text not null,                 -- e.g. 'BUILD-002'
  contract_version        text not null,                 -- e.g. 'v0.1-draft'
  doc_type                text not null default 'build_contract',
  title                   text not null,
  outcome                 text not null,                 -- the one-sentence original outcome
  executive_summary       text,
  scope                   jsonb not null default '[]'::jsonb,   -- scoped capabilities (readable list)
  non_goals               text,
  objectives              jsonb not null default '[]'::jsonb,
  wp_sequence             jsonb not null default '[]'::jsonb,   -- [{wp, slice, gate}]
  acceptance_criteria     jsonb not null default '[]'::jsonb,   -- [{ref, text}]
  required_evidence       text,
  material_decisions      jsonb not null default '[]'::jsonb,   -- [{ref, text}]
  authority_boundaries    text,
  canonical_refs          jsonb not null default '[]'::jsonb,
  -- Git identity (canonical readable contract) — the approval binds to these.
  github_path             text not null,
  github_url              text,
  git_commit_sha          text not null,
  git_blob_sha            text,
  content_sha256          text not null,                 -- sha256 over the committed blob content
  current_wp              text not null default 'WP0',
  -- Lifecycle / approval state (operational).
  lifecycle_state         text not null default 'draft'
                            check (lifecycle_state in
                              ('draft','pending_approval','approved','changes_requested','superseded')),
  approved_by             text,
  approved_at             timestamptz,
  changes_requested_note  text,
  superseded_by_version   text,
  is_synthetic            boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (build_id, contract_version)
);

comment on table cockpit.build_contract is
  'BUILD-002 build-acceptance contract: OPERATIONAL approved-version record + readable Directus '
  'projection of the canonical Git contract (GitHub Markdown stays canonical; this is not the only '
  'copy). cp_directus SELECT-only — Directus renders it, never mutates approval state. Approval is '
  'applied by cp_worker from an intent in cockpit.contract_command, bound to git_commit_sha + '
  'content_sha256.';

-- Guard: identity + Git-binding + created_at are IMMUTABLE; only lifecycle/approval fields move;
-- lifecycle transitions are validated; DELETE is rejected (retained for audit — no delete grant).
create or replace function cockpit.build_contract_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'cockpit.build_contract is retained for audit: DELETE is rejected (supersede, never delete)'
      using errcode = '23514';
  end if;
  if new.id <> old.id
     or new.build_id <> old.build_id
     or new.contract_version <> old.contract_version
     or new.doc_type <> old.doc_type
     or new.github_path is distinct from old.github_path
     or new.git_commit_sha is distinct from old.git_commit_sha
     or new.git_blob_sha is distinct from old.git_blob_sha
     or new.content_sha256 is distinct from old.content_sha256
     or new.created_at <> old.created_at then
    raise exception 'cockpit.build_contract identity + Git binding (id/build_id/version/doc_type/github_path/git_commit_sha/git_blob_sha/content_sha256/created_at) is immutable — a changed contract is a NEW version'
      using errcode = '23514';
  end if;
  -- Valid lifecycle transitions only.
  if new.lifecycle_state is distinct from old.lifecycle_state
     and not ( (old.lifecycle_state = 'draft'              and new.lifecycle_state in ('pending_approval','superseded'))
            or (old.lifecycle_state = 'pending_approval'   and new.lifecycle_state in ('approved','changes_requested','superseded'))
            or (old.lifecycle_state = 'changes_requested'  and new.lifecycle_state in ('pending_approval','superseded'))
            or (old.lifecycle_state = 'approved'           and new.lifecycle_state in ('superseded')) ) then
    raise exception 'invalid build_contract lifecycle transition % -> %', old.lifecycle_state, new.lifecycle_state
      using errcode = '23514';
  end if;
  -- An 'approved' state must carry who + when (set together by the worker applying the intent).
  if new.lifecycle_state = 'approved' and (new.approved_by is null or new.approved_at is null) then
    raise exception 'build_contract cannot be approved without approved_by + approved_at' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists build_contract_guard_t on cockpit.build_contract;
create trigger build_contract_guard_t
  before update or delete on cockpit.build_contract
  for each row execute function cockpit.build_contract_guard();

-- ---------------------------------------------------------------------------
-- cockpit.contract_command — approval INTENT queue (mirrors asdair.command_request).
-- ---------------------------------------------------------------------------
create table if not exists cockpit.contract_command (
  id                 uuid primary key default gen_random_uuid(),
  requested_by       text        not null,
  command            text        not null
                       check (command in ('approve_contract','request_changes')),
  build_id           text        not null,
  contract_version   text        not null,
  bound_git_sha      text        not null,   -- the git_commit_sha this approval binds to
  bound_content_hash text        not null,   -- the content_sha256 this approval binds to
  note               text,                    -- reason (request_changes) / optional approval note
  status             text        not null default 'requested'
                       check (status in ('requested','claimed','done','failed')),
  idempotency_key    text        not null unique,
  receipt            jsonb,
  is_synthetic       boolean     not null default false,
  requested_at       timestamptz not null default now(),
  claimed_at         timestamptz,
  completed_at       timestamptz
);

create index if not exists cockpit_contract_command_status_idx
  on cockpit.contract_command (status, requested_at);

comment on table cockpit.contract_command is
  'BUILD contract approval INTENT queue. cp_directus may only INSERT status=requested (no receipt); '
  'the trusted cp_worker claims + applies the approval to cockpit.build_contract (bound to '
  'bound_git_sha + bound_content_hash) + writes the receipt. The cockpit can never execute or '
  'rewrite approval history.';

-- Guard 1: INSERTs are intent-only.
create or replace function cockpit.contract_command_insert_guard() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from 'requested' then
    raise exception 'contract_command may only be INSERTed with status=requested (got %)', new.status using errcode = '23514';
  end if;
  if new.receipt is not null then
    raise exception 'contract_command may not be INSERTed with a receipt (execution is the worker''s job)' using errcode = '23514';
  end if;
  if new.claimed_at is not null or new.completed_at is not null then
    raise exception 'contract_command may not be INSERTed already claimed/completed' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists contract_command_insert_guard_t on cockpit.contract_command;
create trigger contract_command_insert_guard_t
  before insert on cockpit.contract_command
  for each row execute function cockpit.contract_command_insert_guard();

-- Guard 2: request CORE immutable + only valid forward transitions.
create or replace function cockpit.contract_command_update_guard() returns trigger
language plpgsql as $$
begin
  if new.requested_by is distinct from old.requested_by
     or new.command is distinct from old.command
     or new.build_id is distinct from old.build_id
     or new.contract_version is distinct from old.contract_version
     or new.bound_git_sha is distinct from old.bound_git_sha
     or new.bound_content_hash is distinct from old.bound_content_hash
     or new.idempotency_key is distinct from old.idempotency_key
     or new.requested_at is distinct from old.requested_at
     or new.is_synthetic is distinct from old.is_synthetic then
    raise exception 'contract_command core fields are immutable after creation' using errcode = '23514';
  end if;
  if old.status in ('done','failed') then
    raise exception 'a completed contract_command (status=%) is immutable', old.status using errcode = '23514';
  end if;
  if new.status is distinct from old.status
     and not ( (old.status = 'requested' and new.status = 'claimed')
            or (old.status = 'claimed'   and new.status in ('done','failed')) ) then
    raise exception 'invalid contract_command status transition % -> %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists contract_command_update_guard_t on cockpit.contract_command;
create trigger contract_command_update_guard_t
  before update on cockpit.contract_command
  for each row execute function cockpit.contract_command_update_guard();
