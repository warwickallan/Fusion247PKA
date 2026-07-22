-- =============================================================================
-- MyPKA cockpit migration 090 — readable per-document BODIES for the contract pack
--
-- GPT review item 4: Directus must display all three exact Git-bound documents as READABLE
-- MARKDOWN, not merely paths/hashes or a JSON metadata array — reproducibly, from committed
-- code (no manual live-row editing). This table holds one row per pack member with its full
-- Markdown body plus its exact Git identity (path/commit/blob/sha256). cp_directus gets SELECT
-- (render-only). Populated by the committed loader wp-d-proof/load-contract-pack.mjs, which reads
-- the bodies straight from Git at a given commit.
--
-- Append-only: a member is immutable once written (a changed document is a NEW pack version).
-- Idempotent DDL; reversible via teardown.sql (cockpit-schema cascade).
-- =============================================================================
create table if not exists cockpit.build_contract_doc (
  id               uuid primary key default gen_random_uuid(),
  build_id         text not null,
  pack_version     text not null,
  doc_role         text not null check (doc_role in ('brief','contract','plan')),
  title            text,
  github_path      text not null,
  github_url       text,
  git_commit_sha   text not null,
  git_blob_sha     text,
  content_sha256   text not null,
  body_markdown    text not null,            -- the readable document body (from Git)
  sort             int  not null default 0,  -- brief=0, contract=1, plan=2
  created_at       timestamptz not null default now(),
  unique (build_id, pack_version, doc_role)
);

comment on table cockpit.build_contract_doc is
  'Readable Markdown body + exact Git identity for each member of a build-contract PACK. Directus '
  'renders body_markdown so Warwick reads the actual documents, not paths/hashes. Populated '
  'reproducibly from Git by load-contract-pack.mjs. Append-only: a changed document is a NEW pack version.';

-- Append-only guard: identity + body immutable once written; DELETE rejected (retained for audit).
create or replace function cockpit.build_contract_doc_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'cockpit.build_contract_doc is append-only: DELETE is rejected (supersede the pack, never delete)'
      using errcode = '23514';
  end if;
  raise exception 'cockpit.build_contract_doc is append-only: a changed document is a NEW pack version, never an edit'
    using errcode = '23514';
end $$;

drop trigger if exists build_contract_doc_guard_t on cockpit.build_contract_doc;
create trigger build_contract_doc_guard_t
  before update or delete on cockpit.build_contract_doc
  for each row execute function cockpit.build_contract_doc_guard();

-- Least-privilege: cp_directus renders it (SELECT only). Owner (loader) writes. cp_worker not involved.
grant usage on schema cockpit to cp_directus;
grant select on cockpit.build_contract_doc to cp_directus;
