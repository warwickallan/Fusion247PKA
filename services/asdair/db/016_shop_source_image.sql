-- =====================================================================
-- BUILD-015 AsdAIr WP-B15-1 - migration 016
--
-- EXACT-SOURCE PHOTOGRAPH BINDING (invariant C, wrong-week protection).
--
-- One row per shop, binding the shop to the IMMUTABLE CONTENT of the
-- photograph it was interpreted from: a content hash computed at intake from
-- the downloaded bytes, before the Telegram offset is acknowledged. Until this
-- table, a shop was bound to its image only by a MUTABLE file path plus
-- Telegram identifiers - nothing durably said WHICH pixels produced the
-- reading, so a wrong-week or swapped photograph was undetectable in the
-- record. The confirmation card renders this fingerprint (prefix) beside a
-- human-readable prior-photo comparison, so the human confirming the
-- interpretation can see which photograph it came from.
--
-- ── WHY A SIDE TABLE AND NOT A COLUMN ON asdair.shop ─────────────────────────
-- (Larry's ruling on WO-2026-08-08-B15-01, 2026-08-08, amending AC4.)
-- shopStore's INSERT column list and UPDATE allowlist are deliberately frozen
-- ("progressing a shop can never rewrite what arrived") and are owned by a
-- module outside this Work Order's file surface. A shop_id-keyed side table
-- written by pipeline/store.js keeps the binding durable, keyed to the shop
-- row, and leaves that freeze untouched. The PRIMARY KEY on shop_id makes the
-- binding at-most-one and FIRST-WRITE-WINS (the writer is
-- INSERT ... ON CONFLICT DO NOTHING); no UPDATE or DELETE is granted to any
-- role below, so the fingerprint is immutable BY GRANT, not by convention.
--
-- ── NUMBERING: WHY 016 ───────────────────────────────────────────────────────
-- * Repo migrations stop at 012 (001, 004-010, 012; gaps at 002, 003, 011).
-- * "Migration 015" is referenced in the estate record for the packet-chain
--   table. NO 013/014/015 FILE exists in this repository or anywhere in its
--   git history (verified 2026-08-08: `git log --all -- "*015*.sql"` is
--   empty); per the estate record 015 was a recorded schema DECISION, never an
--   authored file. 016 numbers PAST that reservation so a later authoring of
--   013-015 cannot collide with this file.
-- * The live database additionally holds three tables absent from the repo
--   (command_request, previously_ordered, skill_steps). That is TABLE drift,
--   not numbered-migration state; it reserves no number, and per Warwick's
--   ruling (Asda Build 002 SS3) NOTHING here reconciles it. The debt is
--   recorded once, here, and repatriated by nothing in this Work Order.
--
-- ── AUTHORED, NOT APPLIED ────────────────────────────────────────────────────
-- Warwick's migration authority for WP-B15-1 (Asda Build 002 SS3) covers
-- AUTHORING this file. Application to the live household database happens only
-- through the established safe migration route, under his explicit authority,
-- with the resulting schema state proven read-only afterwards. Nothing in
-- WO-2026-08-08-B15-01 applies it.
--
-- PURE ASCII, no secrets, no rows, idempotent. Depends on 001 (asdair.shop).
-- =====================================================================

create table if not exists asdair.shop_source_image (
  shop_id     bigint primary key references asdair.shop(id) on delete cascade,
  -- Lowercase hex content hash of the stored image bytes, computed at intake
  -- from the exact buffer that was written to the media store.
  fingerprint text not null,
  -- The hash algorithm, so the fingerprint is verifiable against the stored
  -- bytes without guessing. One member today; extending the CHECK is a new
  -- migration, deliberately.
  algo        text not null default 'sha256',
  -- Size of the hashed bytes. Cheap corroboration that the fingerprinted file
  -- is the stored file; nullable because it is evidence, not identity.
  byte_length integer,
  -- When the fingerprint was captured - the receiver's own stamp, carried
  -- through intake, falling back to the database clock only when no stamp
  -- travelled.
  captured_at timestamptz not null default now(),
  constraint shop_source_image_fingerprint_shaped check (fingerprint ~ '^[0-9a-f]{16,128}$'),
  constraint shop_source_image_algo_known check (algo in ('sha256')),
  constraint shop_source_image_bytes_sane check (byte_length is null or byte_length > 0)
);

-- Grants mirror migration 009's shape: the pipeline's writer role may INSERT
-- and SELECT; the reader role may SELECT. UPDATE and DELETE are deliberately
-- granted to NOBODY - an image fingerprint is a permanent fact about the shop,
-- and immutability enforced by absent grants survives every code path.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asdair_rw') then return; end if;
  execute 'grant select, insert on asdair.shop_source_image to asdair_rw';
  execute 'grant select on asdair.shop_source_image to asdair_ro';
end $$;
