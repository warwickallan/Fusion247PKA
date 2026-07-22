-- =============================================================================
-- MyPKA cockpit migration 100 — permit a github_url-only correction on build_contract_doc
--
-- Pre-completion fix 3 (commit-pinned URLs): the loaded doc rows stored branch-relative GitHub URLs
-- (which move if the branch moves). The commit-pinned URL (/blob/<commit>/…) is DERIVED display
-- metadata — NOT part of the approval binding (commit + blob + content_sha256 + pack_content_hash,
-- all already commit-pinned and untouched). This refines the append-only guard so ONLY github_url
-- may be corrected; identity, body, hashes and Git blob stay frozen, and DELETE stays rejected.
-- The approved three-document pack (the Markdown content + its binding) is NOT altered.
-- Idempotent (create or replace). Reversible via teardown.sql (cockpit-schema cascade).
-- =============================================================================
create or replace function cockpit.build_contract_doc_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'cockpit.build_contract_doc is append-only: DELETE is rejected (supersede the pack, never delete)'
      using errcode = '23514';
  end if;
  -- Everything except github_url is immutable (a changed document is a NEW pack version).
  if new.id is distinct from old.id
     or new.build_id is distinct from old.build_id
     or new.pack_version is distinct from old.pack_version
     or new.doc_role is distinct from old.doc_role
     or new.title is distinct from old.title
     or new.github_path is distinct from old.github_path
     or new.git_commit_sha is distinct from old.git_commit_sha
     or new.git_blob_sha is distinct from old.git_blob_sha
     or new.content_sha256 is distinct from old.content_sha256
     or new.body_markdown is distinct from old.body_markdown
     or new.sort is distinct from old.sort
     or new.created_at is distinct from old.created_at then
    raise exception 'cockpit.build_contract_doc is append-only except a github_url correction: a changed document is a NEW pack version, never an edit'
      using errcode = '23514';
  end if;
  return new;
end $$;
