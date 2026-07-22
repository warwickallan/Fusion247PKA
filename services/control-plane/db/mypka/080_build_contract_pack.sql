-- =============================================================================
-- MyPKA cockpit migration 080 — evolve build_contract to the THREE-DOCUMENT PACK model
--
-- Warwick decided (2026-07-22) the approval unit is a three-document pack (BUILD-BRIEF +
-- BUILD-CONTRACT + IMPLEMENTATION-PLAN), and approval binds the EXACT pack. This migration adds:
--   documents         jsonb  — one element per pack member {doc_role, github_path, github_url,
--                              git_commit_sha, git_blob_sha, content_sha256}
--   pack_content_hash text   — the single value approval binds to: sha256 over the three member
--                              content_sha256 hex lines in fixed order (brief, contract, plan),
--                              newline-terminated. Reproducible from Git.
-- The guard is extended to freeze documents + pack_content_hash ONCE SET (a changed member = a new
-- pack version, never an in-place edit). Additive, idempotent, reversible via teardown.sql.
-- =============================================================================
alter table cockpit.build_contract
  add column if not exists documents         jsonb not null default '[]'::jsonb,
  add column if not exists pack_content_hash text;

comment on column cockpit.build_contract.pack_content_hash is
  'The value Warwick approval binds to for a multi-document pack: sha256 over the member '
  'content_sha256 hex lines (order: brief, contract, plan; newline-terminated). Reproducible from Git.';

-- Guard v2: identity + Git-binding + created_at immutable; documents + pack_content_hash immutable
-- once set; validated lifecycle transitions; approval needs by+at. (Replaces the 060 guard body.)
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
    raise exception 'cockpit.build_contract identity + Git binding is immutable — a changed contract is a NEW version'
      using errcode = '23514';
  end if;
  -- Pack binding is immutable once set (a changed member is a NEW pack version).
  if old.pack_content_hash is not null and new.pack_content_hash is distinct from old.pack_content_hash then
    raise exception 'cockpit.build_contract.pack_content_hash is immutable once set — supersede with a new pack version'
      using errcode = '23514';
  end if;
  if old.documents <> '[]'::jsonb and new.documents is distinct from old.documents then
    raise exception 'cockpit.build_contract.documents is immutable once set — supersede with a new pack version'
      using errcode = '23514';
  end if;
  if new.lifecycle_state is distinct from old.lifecycle_state
     and not ( (old.lifecycle_state = 'draft'              and new.lifecycle_state in ('pending_approval','superseded'))
            or (old.lifecycle_state = 'pending_approval'   and new.lifecycle_state in ('approved','changes_requested','superseded'))
            or (old.lifecycle_state = 'changes_requested'  and new.lifecycle_state in ('pending_approval','superseded'))
            or (old.lifecycle_state = 'approved'           and new.lifecycle_state in ('superseded')) ) then
    raise exception 'invalid build_contract lifecycle transition % -> %', old.lifecycle_state, new.lifecycle_state
      using errcode = '23514';
  end if;
  if new.lifecycle_state = 'approved' and (new.approved_by is null or new.approved_at is null) then
    raise exception 'build_contract cannot be approved without approved_by + approved_at' using errcode = '23514';
  end if;
  return new;
end $$;
