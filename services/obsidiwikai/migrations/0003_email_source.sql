-- Email source adapter — a GENERIC inbound-mail door into Unified Capture (Fusion247 mailbox).
-- The adapter only: retrieves, durably captures body/metadata/attachments, dedupes, receipts,
-- and hands capture_id to Cairn. NO routing logic lives here — Cairn owns routing.
-- Idempotent; safe to re-run.

create schema if not exists obsidiwikai;
set search_path to obsidiwikai, public;

-- Durable capture of one inbound email. Written BEFORE Cairn runs, so a routing failure
-- never loses the mail (it stays here, routed=false, and is re-driven by the reconcile sweep).
create table if not exists obsidiwikai.inbound_email (
  capture_id        text primary key,                  -- stable id handed to Cairn ('email:<dedupe_key>')
  dedupe_key        text not null unique,               -- internetMessageId (RFC-unique) else Graph id — replay-safe
  graph_message_id  text,                               -- Microsoft Graph message id
  internet_message_id text,
  mailbox           text not null,
  from_address      text,
  from_name         text,
  to_addresses      jsonb not null default '[]'::jsonb,
  subject           text,
  body_text         text,
  body_html         text,
  received_at       timestamptz,
  has_attachments   boolean not null default false,
  raw               jsonb,                              -- trimmed Graph metadata (audit)
  routed            boolean not null default false,     -- handed to Cairn yet?
  cairn_receipt     text,                               -- Cairn's receipt line
  cairn_capture_ref text,                               -- Cairn decision capture_id (== capture_id)
  error             text,
  captured_at       timestamptz not null default now(),
  routed_at         timestamptz
);
create index if not exists inbound_email_routed_idx on obsidiwikai.inbound_email(routed);
create index if not exists inbound_email_received_idx on obsidiwikai.inbound_email(received_at);

-- Attachments captured durably alongside the mail (bytes stored up to a cap; larger = metadata + truncated flag).
create table if not exists obsidiwikai.email_attachment (
  attachment_id  uuid primary key default gen_random_uuid(),
  capture_id     text not null references obsidiwikai.inbound_email(capture_id) on delete cascade,
  graph_attachment_id text,
  name           text,
  content_type   text,
  size_bytes     bigint,
  is_inline      boolean not null default false,
  content_id     text,
  content        bytea,                                 -- null when over the byte cap
  truncated      boolean not null default false,        -- true = content omitted (too large), metadata retained
  created_at     timestamptz not null default now(),
  unique (capture_id, graph_attachment_id)
);

-- Delta cursor per mailbox. The BASELINE run walks the initial delta to its end and stores the
-- deltaLink WITHOUT ingesting — pre-existing Microsoft welcome/security mail never enters capture.
-- Only mail arriving AFTER baseline_at is captured.
create table if not exists obsidiwikai.graph_delta_state (
  mailbox        text primary key,
  delta_link     text,                                  -- resume token for the next poll
  baseline_at    timestamptz,                           -- when the baseline cursor was established
  last_polled_at timestamptz,
  updated_at     timestamptz not null default now()
);

-- OAuth token store for the daemon poller (Hetzner watches the mailbox; the Yoga can be off).
-- MS personal-account refresh tokens rotate on use, so they must persist server-side, not in an
-- env file. Access is gated by the service role. One row per provider.
create table if not exists obsidiwikai.oauth_token (
  provider       text primary key,                      -- 'msgraph'
  refresh_token  text,
  access_token   text,
  expires_at     timestamptz,
  scope          text,
  account        text,                                  -- the authorised mailbox (audit)
  updated_at     timestamptz not null default now()
);
