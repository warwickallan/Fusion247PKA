-- =============================================================================
-- BUILD-002 WP0 — Deletion / erasure path + retention (Supabase / Postgres DDL)
-- Migration: 0002_wp0_deletion_and_retention
--
-- Source of truth for this shape:
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     supabase-operational-foundation-boundary.md  (§1.1)
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     source-of-truth-and-authority-matrix.md      (§2 retention, §3 guardrail)
--   Builds/BUILD-002-unified-personal-capture-gateway/Contracts/
--     capture-contract-pack-v1.md                  (§5)
--
-- WHY THIS EXISTS (security finding F-03, DATA-LAYER half):
-- Before any real (non-synthetic) PERSONAL data is introduced, an ERASURE path
-- is a §6 hard-stop (GDPR right-to-erasure). This migration makes deleting a
-- single `capture_envelope` row a COMPLETE operational erasure: every dependent
-- operational row for that capture is removed with it. The in-memory fixture
-- (src/store/operationalStore.js :: deleteCapture) mirrors this exact semantics
-- so callers can drop in the real store later without behaviour change.
--
-- FIXTURES-ONLY NOTE: this file is the migration ARTIFACT. It is NOT executed by
-- the WP0 test suite. No secrets, no data, no real project are provisioned here.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- RLS stays ENABLED and deny-by-default on every table (established in 0001).
-- Nothing here adds a permissive policy and nothing here relaxes RLS. Erasure is
-- performed server-side by the `service_role` erasure worker only; the
-- `anon`/publishable key never gains delete rights.
-- =============================================================================

-- --------------------------------------------------------------------------
-- ERASURE ORDERING — deleting a capture_envelope removes all its dependents.
--
-- 0001 declared the child FKs (idempotency_key.capture_id, processing_state.
-- capture_id, evidence_pointer.capture_id -> capture_envelope.capture_id, and
-- capture_envelope.raw_object_ref -> raw_object.raw_object_id) WITHOUT an
-- ON DELETE action, i.e. the default ON DELETE NO ACTION — which would REFUSE to
-- delete a capture that still has children. That blocks erasure. Here we make
-- the child rows cascade so one delete of the parent capture erases:
--   - its processing_state row (queue/lease/attempt history)
--   - its evidence_pointer rows (operational pointers, not knowledge)
--   - its idempotency_key row (freeing the key for a genuinely new capture)
-- --------------------------------------------------------------------------

alter table fcg.idempotency_key
  drop constraint idempotency_key_capture_id_fkey,
  add constraint idempotency_key_capture_id_fkey
    foreign key (capture_id) references fcg.capture_envelope (capture_id)
    on delete cascade;

alter table fcg.processing_state
  drop constraint processing_state_capture_id_fkey,
  add constraint processing_state_capture_id_fkey
    foreign key (capture_id) references fcg.capture_envelope (capture_id)
    on delete cascade;

alter table fcg.evidence_pointer
  drop constraint evidence_pointer_capture_id_fkey,
  add constraint evidence_pointer_capture_id_fkey
    foreign key (capture_id) references fcg.capture_envelope (capture_id)
    on delete cascade;

-- The raw_object row (a private-bucket POINTER) is set-null on capture delete so
-- the object can be garbage-collected by the erasure worker after the storage
-- object itself is removed (see APPLICATION ERASURE PATH below). We do NOT
-- cascade-delete raw_object from the envelope because a raw_object may be shared
-- as a retention original; the erasure worker decides and deletes it explicitly.
alter table fcg.capture_envelope
  drop constraint capture_envelope_raw_object_ref_fkey,
  add constraint capture_envelope_raw_object_ref_fkey
    foreign key (raw_object_ref) references fcg.raw_object (raw_object_id)
    on delete set null;

-- --------------------------------------------------------------------------
-- APPLICATION ERASURE PATH (NOT SQL) — what this migration does NOT do.
--
-- Two artifacts of a capture live OUTSIDE Postgres and are therefore erased by
-- the application erasure orchestration (Mack's erase(), built on the store's
-- deleteCapture(captureId,{now}) -> {deleted, capture_id}), NOT by this SQL:
--   1. The storage object in the private raw bucket (fcg-raw-private) — deleted
--      via the Storage API before/with the raw_object row is dropped.
--   2. The GOVERNED MARKDOWN NOTE — the canonical copy of the knowledge lives in
--      Markdown/myPKA (matrix §3), never in Supabase. Erasing personal data
--      means the application also removes/redacts that note and its git history
--      per policy. SQL cannot and must not reach it.
-- The SQL cascade above and the application deletes together form ONE erasure.
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- RETENTION / BACKUP NOTE.
--
-- A delete here is a TRUE ERASURE of personal data, not a soft-delete/tombstone.
-- Consequently every SHADOW COPY must also be purged within the stated retention
-- window, including:
--   - Postgres PITR / logical backups and WAL archives,
--   - Supabase Storage object versions / soft-delete buckets,
--   - any read replica, export, or downstream cache.
-- Backups that still contain an erased subject after the retention window are a
-- compliance violation. The retention original (matrix §2) is RETAINED only for
-- the initial build and is itself subject to erasure once a subject exercises
-- right-to-erasure — retention never overrides erasure.
-- =============================================================================
