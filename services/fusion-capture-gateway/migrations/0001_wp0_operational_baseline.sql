-- =============================================================================
-- BUILD-002 WP0 — Operational baseline (Supabase / Postgres DDL)
-- Migration: 0001_wp0_operational_baseline
--
-- Source of truth for this shape:
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     supabase-operational-foundation-boundary.md  (§1.1)
--   Builds/BUILD-002-unified-personal-capture-gateway/Architecture/
--     source-of-truth-and-authority-matrix.md      (§3 guardrail)
--   Builds/BUILD-002-unified-personal-capture-gateway/Contracts/
--     capture-contract-pack-v1.md                  (§1, §4, §5)
--
-- SCOPE: the smallest reusable, CHANNEL-NEUTRAL operational model. Supabase is
-- OPERATIONAL INFRASTRUCTURE ONLY. It carries captures in flight — never the
-- canonical copy of durable general knowledge. Markdown / myPKA stays canonical
-- (matrix §3). Evidence rows hold POINTERS (path / commit-sha / message-id),
-- never the knowledge itself.
--
-- FIXTURES-ONLY NOTE: this file is the migration ARTIFACT. It is NOT executed by
-- the WP0 test suite. No secrets, no data, no real project are provisioned here.
--
-- EXPLICIT FK CONSTRAINT NAMES (Sonnet review fix, area D): the four foreign
-- keys that migration 0002 later drops-and-recreates with ON DELETE actions
-- (capture_envelope.sender_identity_ref is NOT one of them and is named purely
-- for consistency) carry EXPLICIT `constraint <name>` clauses below, using the
-- exact names Postgres would otherwise assign implicitly. Before this fix, 0002
-- silently ASSUMED those undeclared implicit names — correct today, but a
-- future edit to this file that added or renamed a constraint could silently
-- desync 0002 with no error until applied against a real database. Naming them
-- here makes the contract between the two files explicit and machine-checked
-- (see test/migrations.test.js, a static parser that fails CI if 0002 ever
-- drops a name not declared here).
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- Row-Level Security MUST be ENABLED on every table below before any real (non-
-- synthetic) data or real credentials are introduced. WP0/WP1 is a SINGLE
-- authorised user; the `service_role` worker/API principals operate server-side
-- only. The `anon`/publishable key must never bypass RLS. RLS-enable + policy
-- statements are stubbed at the foot of this file and MUST be reviewed and made
-- restrictive by the security gate before promotion. Nothing here grants broad
-- access.
-- =============================================================================

-- Namespaced so later platform consumers (IDEA-007/008/009, BUILD-003, VlogOps,
-- specialist bot facades) attach WITHOUT forking the project. "fcg" =
-- fusion-capture-gateway, the first schema tenant of the shared foundation.
create schema if not exists fcg;

-- --------------------------------------------------------------------------
-- Enumerated types (channel-neutral). Nothing here names "Telegram" — it is
-- one `source_channel` value among future many.
-- --------------------------------------------------------------------------

create type fcg.source_channel as enum (
  'telegram', 'email-inbox', 'web', 'api', 'other'
);

create type fcg.recorded_intent as enum (
  'LarryDirect', 'SaveToBrain', 'ConfirmedAction'
);

create type fcg.technical_source_type as enum (
  'text', 'voice', 'image', 'photo', 'pdf_office', 'url', 'email', 'youtube', 'unknown'
);

-- Processing lifecycle. `completed` is only ever set AFTER written + evidenced
-- both exist (enforced in application logic; see states.js and §4 of the pack).
create type fcg.processing_state as enum (
  'received',
  'accepted',
  'queued',
  'offline_queued',
  'claimed',
  'writing',
  'written',
  'evidenced',
  'completed',
  'partial',
  'failed',
  'needs_clarification',
  'cancelled'
);

create type fcg.evidence_kind as enum (
  'markdown_write', 'git_commit', 'card_update'
);

-- --------------------------------------------------------------------------
-- Operational relationships: which authorised principal on which channel.
-- Operational graph ONLY — this is NOT the PKM relational model and must not
-- mirror entity notes (boundary §1.1.4).
-- --------------------------------------------------------------------------

create table fcg.channel_identity (
  identity_ref  text primary key,              -- opaque ref, e.g. identity:usr_wp0_primary
  channel       fcg.source_channel not null,
  -- opaque per-channel principal handle (NOT the raw phone/handle in the clear)
  channel_principal_ref text not null,
  is_authorised boolean not null default false, -- WP0/WP1: exactly one true row
  created_at    timestamptz not null default now(),
  unique (channel, channel_principal_ref)
);

-- --------------------------------------------------------------------------
-- Raw-object bucket reference. WP0 keeps text inline; this row points at a
-- private-by-default Supabase Storage object for future images/audio/oversized
-- text. Access only via short-lived signed URLs minted server-side (§1.1.6).
-- Originals are RETAINED throughout the initial build (matrix §2).
-- --------------------------------------------------------------------------

create table fcg.raw_object (
  raw_object_id uuid primary key default gen_random_uuid(),
  store         text not null default 'supabase-storage',
  bucket        text not null default 'fcg-raw-private',   -- private bucket, no public URLs
  object_key    text not null,
  content_type  text,
  bytes         bigint check (bytes is null or bytes >= 0),
  sha256        text,                                      -- integrity digest (optional)
  retained      boolean not null default true,             -- must stay true throughout initial build
  created_at    timestamptz not null default now(),
  unique (bucket, object_key)
);

-- --------------------------------------------------------------------------
-- Intake envelope records — one row per accepted capture (boundary §1.1.1,
-- pack §1). Carries WHAT was captured + WHAT the user asked for; never a
-- semantic verdict. The intake COMMIT POINT: durable the instant this row lands.
-- --------------------------------------------------------------------------

create table fcg.capture_envelope (
  capture_id            uuid primary key,               -- server-assigned canonical id
  schema_version        text not null default 'capture-envelope/v1',
  source_channel        fcg.source_channel not null,
  sender_identity_ref   text not null
    constraint capture_envelope_sender_identity_ref_fkey
    references fcg.channel_identity (identity_ref),
  recorded_intent       fcg.recorded_intent not null,
  technical_source_type fcg.technical_source_type not null,

  -- Inline text kept in-row for WP0; larger/binary payloads point at fcg.raw_object.
  payload_text          text,
  raw_object_ref        uuid
    constraint capture_envelope_raw_object_ref_fkey
    references fcg.raw_object (raw_object_id),

  -- Retention pointer to the untouched original (nullable only for pure inline text).
  original_store        text,
  original_object_key   text,
  original_message_ref  text,
  original_retained     boolean not null default true,

  -- Opaque per-channel routing hints (e.g. card handle). Operational metadata.
  channel_context       jsonb,
  text_preview          text,                            -- truncated; not authoritative
  client_meta           jsonb,

  captured_at           timestamptz not null,            -- user submitted at cockpit
  received_at           timestamptz not null,            -- intake accepted server-side
  created_at            timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Idempotency keys (boundary §1.1.3, pack §5). One logical capture = one key,
-- even if delivered twice. The UNIQUE constraint is what makes intake
-- upsert-by-idempotency-key: a re-fired webhook maps to the SAME envelope.
-- --------------------------------------------------------------------------

create table fcg.idempotency_key (
  idempotency_key text primary key,                      -- <channel>:<native_msg_id>:sha256:<digest>
  capture_id      uuid not null
    constraint idempotency_key_capture_id_fkey
    references fcg.capture_envelope (capture_id),
  created_at      timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Processing-state / queue — the work list the local worker pulls from
-- (boundary §1.1.2). One row per capture. Lease columns let a crashed worker's
-- claim auto-release (reclaimable after lease_expires_at).
-- --------------------------------------------------------------------------

create table fcg.processing_state (
  capture_id       uuid primary key
    constraint processing_state_capture_id_fkey
    references fcg.capture_envelope (capture_id),
  state            fcg.processing_state not null default 'accepted',
  claimed_by       text,                                 -- worker principal id
  claimed_at       timestamptz,
  lease_expires_at timestamptz,                           -- crashed claim auto-releases past this
  attempt_count    integer not null default 0,
  next_attempt_at  timestamptz,                           -- exponential backoff on retry
  last_error       text,
  destination_ref  jsonb,                                 -- canonical Markdown pointer once written
  updated_at       timestamptz not null default now()
);

create index processing_state_claimable_idx
  on fcg.processing_state (state, lease_expires_at);

-- --------------------------------------------------------------------------
-- Evidence pointers (boundary §1.1.5, pack §3). Proves the capture reached its
-- governed destination WITHOUT copying the knowledge into Supabase. target_ref
-- is a POINTER (path / commit-sha / message-id), never content. Keyed to
-- capture_id so retries reuse or supersede — not multiply — evidence (§5.4).
-- --------------------------------------------------------------------------

create table fcg.evidence_pointer (
  evidence_id   uuid primary key default gen_random_uuid(),
  capture_id    uuid not null
    constraint evidence_pointer_capture_id_fkey
    references fcg.capture_envelope (capture_id),
  evidence_kind fcg.evidence_kind not null,
  target_ref    text not null,                            -- path / commit sha / message id
  created_at    timestamptz not null default now(),
  unique (capture_id, evidence_kind, target_ref)          -- idempotent evidence
);

-- =============================================================================
-- SECURITY GATE (Vex) — RLS. DO NOT WEAKEN.
-- Enable RLS on EVERY table. Policies below are intentionally EMPTY stubs: with
-- RLS enabled and no permissive policy, access defaults to DENY for non-service
-- roles. The security gate must add restrictive, single-authorised-user
-- policies (and server-side-only service_role access) BEFORE any real data or
-- production promotion. Leaving RLS disabled is a boundary violation.
-- =============================================================================

alter table fcg.channel_identity   enable row level security;
alter table fcg.raw_object         enable row level security;
alter table fcg.capture_envelope   enable row level security;
alter table fcg.idempotency_key    enable row level security;
alter table fcg.processing_state   enable row level security;
alter table fcg.evidence_pointer   enable row level security;

-- (No permissive policies defined here on purpose — deny-by-default until the
--  Vex security gate authors the single-authorised-user policy set.)
