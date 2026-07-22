-- =============================================================================
-- MyPKA cockpit seed — BUILD-002 Unified Fusion Hub THREE-DOCUMENT PACK, v1.0-draft (DRAFT)
--
-- Warwick decision 2026-07-22: the approval unit is a three-document pack. This seed:
--   1. supersedes the interim single-document row (v0.1-draft -> superseded);
--   2. seeds the v1.0-draft pack row bound to:
--        pack commit        456ba5b44fbb8359378b80f82484c757b53f2895
--        pack_content_hash  e995ebc4af63929135ef7a24851922407824d9117f46f5caa5998f37e85fd06f
--        members (doc_role / content_sha256):
--          brief     406626b28ef043fc6db47c23b48eba50b73e60b83acf2d5a2011dcb31b9740d6
--          contract  b804030a1d03ae7f5edd6ddd08743fa60100776a7504be9646ac12152a52e32f
--          plan      a1434a0d62da47c5db3048dfe60427d7ed594683723737fa69b305459e0a17e2
--      pack_content_hash = sha256 over those three content_sha256 hex lines (order brief,
--      contract, plan; newline-terminated) — reproducible from Git.
--
-- Binding fields (documents[], pack_content_hash, git shas, lifecycle) are exact; the readable
-- projection columns (outcome / executive_summary / scope / acceptance_criteria / ...) are a
-- convenience MIRROR of the canonical Git docs and are populated from them at apply time. GitHub
-- Markdown stays canonical. Idempotent (supersede guarded by lifecycle=draft; insert on conflict
-- do nothing). Reversible via teardown.sql.
-- =============================================================================
update cockpit.build_contract
   set lifecycle_state='superseded', superseded_by_version='v1.0-draft', updated_at=now()
 where build_id='BUILD-002' and contract_version='v0.1-draft' and lifecycle_state='draft';

insert into cockpit.build_contract (
  build_id, contract_version, doc_type, title, outcome,
  github_path, github_url, git_commit_sha, git_blob_sha, content_sha256,
  documents, pack_content_hash, current_wp, lifecycle_state, is_synthetic
) values (
  'BUILD-002','v1.0-draft','build_contract_pack',
  'BUILD-002 — Unified Fusion Hub · Approval Pack (Brief + Contract + Plan)',
  'Warwick can send information or instructions through the most natural front door and one central Fusion hub safely preserves, routes, processes and returns the result without Warwick manually relaying work between systems.',
  'Builds/BUILD-002-unified-personal-capture-gateway/BUILD-CONTRACT.md',
  'https://github.com/warwickallan/Fusion247PKA/blob/build-002/unified-fusion-hub/Builds/BUILD-002-unified-personal-capture-gateway/BUILD-CONTRACT.md',
  '456ba5b44fbb8359378b80f82484c757b53f2895','aeac7815968b24a137852c5d68ea8b9821f7985e','b804030a1d03ae7f5edd6ddd08743fa60100776a7504be9646ac12152a52e32f',
  '[{"doc_role":"brief","github_path":"Builds/BUILD-002-unified-personal-capture-gateway/BUILD-BRIEF.md","git_commit_sha":"456ba5b44fbb8359378b80f82484c757b53f2895","git_blob_sha":"8aa3f548349ad62042942409f7abe31ef0198448","content_sha256":"406626b28ef043fc6db47c23b48eba50b73e60b83acf2d5a2011dcb31b9740d6"},{"doc_role":"contract","github_path":"Builds/BUILD-002-unified-personal-capture-gateway/BUILD-CONTRACT.md","git_commit_sha":"456ba5b44fbb8359378b80f82484c757b53f2895","git_blob_sha":"aeac7815968b24a137852c5d68ea8b9821f7985e","content_sha256":"b804030a1d03ae7f5edd6ddd08743fa60100776a7504be9646ac12152a52e32f"},{"doc_role":"plan","github_path":"Builds/BUILD-002-unified-personal-capture-gateway/IMPLEMENTATION-PLAN.md","git_commit_sha":"456ba5b44fbb8359378b80f82484c757b53f2895","git_blob_sha":"10c84762ae0c9cb2294b594b98a5205d088cd284","content_sha256":"a1434a0d62da47c5db3048dfe60427d7ed594683723737fa69b305459e0a17e2"}]'::jsonb,
  'e995ebc4af63929135ef7a24851922407824d9117f46f5caa5998f37e85fd06f',
  'WP0','draft',false
)
on conflict (build_id, contract_version) do nothing;
-- NB: the live row also carries the full readable projection (scope/objectives/acceptance_criteria/
-- material_decisions/etc.) populated from the canonical Git docs; omitted here for brevity.
