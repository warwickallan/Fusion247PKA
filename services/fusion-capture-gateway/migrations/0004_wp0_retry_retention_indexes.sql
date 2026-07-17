-- =============================================================================
-- BUILD-002 WP0 — Retry index + retention class + idempotency note
-- Migration: 0004_wp0_retry_retention_indexes
--
-- Source of truth for this shape:
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     source-of-truth-and-authority-matrix.md      (§2 retention, F-08)
--   Builds/BUILD-002-unified-personal-capture-gateway/Contracts/
--     capture-contract-pack-v1.md                  (§5, §6 retry)
--   src/store/operationalStore.js :: claim()        (due-retry claimable predicate)
--   src/core/retryPolicy.js                         (backoff -> next_attempt_at)
--
-- WHY THIS EXISTS:
--   1. Vex indexing finding D-01 — the worker's due-retry claim scan filters
--      `state IN ('failed','partial') AND next_attempt_at <= now()
--       AND attempt_count < cap`. Without an index it is a Seq Scan of the whole
--      queue on every poll. A PARTIAL index on next_attempt_at restricted to the
--      two retryable states keeps it tiny and index-driven.
--   2. Security finding F-08 (retention) — raw objects must be created with an
--      EXPLICIT retention class and retained=true during the initial build, so a
--      raw original is never silently un-retained. A CHECK + a small enum make
--      that a schema invariant rather than an application convention.
--
-- FIXTURES-ONLY NOTE: this file is the migration ARTIFACT, proven by applying it
-- against the throwaway localhost verification DB. No secrets, no data.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- Nothing here adds a permissive RLS policy for anon/authenticated or disables
-- RLS. Retention NEVER overrides erasure (see 0002's retention note): a subject
-- exercising right-to-erasure still removes the raw object regardless of class.
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. DUE-RETRY partial index (D-01).
-- Supports: SELECT ... FROM fcg.processing_state
--             WHERE state IN ('failed','partial')
--               AND next_attempt_at <= now()
--               AND attempt_count < MAX_DELIVERY_ATTEMPTS
--             ORDER BY next_attempt_at
-- The partial predicate keeps the index confined to the (usually small) set of
-- retryable rows; next_attempt_at is the leading key so the <= now() range and
-- the ORDER BY are both index-driven.
-- --------------------------------------------------------------------------

create index processing_state_due_retry_idx
  on fcg.processing_state (next_attempt_at)
  where state in ('failed', 'partial');

-- --------------------------------------------------------------------------
-- 2. RETENTION CLASS (F-08).
-- Every raw object is classified. Defaulting to 'private_raw' matches the
-- private-by-default bucket in 0001. The CHECK makes retained=true a hard
-- invariant for the initial build: a raw object cannot be inserted un-retained.
-- Erasure is a SEPARATE, higher-authority path (0002) and DELETEs the row — it
-- does not flip retained to false, so this CHECK never blocks a lawful erasure.
-- --------------------------------------------------------------------------

create type fcg.retention_class as enum (
  'operational',   -- transient operational artefact, shortest life
  'private_raw',   -- private-bucket raw original (default for the build)
  'sensitive'      -- elevated-sensitivity original, strictest handling
);

alter table fcg.raw_object
  add column retention_class fcg.retention_class not null default 'private_raw';

-- Initial-build invariant: raw objects are RETAINED. (Erasure DELETEs the row
-- rather than clearing this flag, so it stays compatible with 0002's cascade /
-- set-null path — retention never overrides erasure.)
alter table fcg.raw_object
  add constraint raw_object_retained_during_build_chk
  check (retained = true);

comment on column fcg.raw_object.retention_class is
  'F-08: explicit retention classification. Every raw object is created with a '
  'class and retained=true during the initial build. True erasure (0002) still '
  'overrides retention by DELETing the row.';

-- --------------------------------------------------------------------------
-- 3. IDEMPOTENCY uniqueness / idempotent-insert note.
-- fcg.idempotency_key.idempotency_key is already the PRIMARY KEY (0001), so it is
-- UNIQUE: a duplicate insert of the same key is rejected by the PK, and the
-- application intake uses INSERT ... ON CONFLICT (idempotency_key) DO NOTHING to
-- turn that rejection into an idempotent no-op (upsert-by-key = the commit point).
-- Documented here so the guarantee is discoverable at the schema level; the
-- integration suite asserts a duplicate insert yields exactly one row.
-- --------------------------------------------------------------------------

comment on constraint idempotency_key_pkey on fcg.idempotency_key is
  'Idempotency guarantee: one logical capture = one key. A duplicate insert is '
  'rejected by this PK; intake uses ON CONFLICT DO NOTHING for an idempotent no-op.';
