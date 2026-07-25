-- Cairn — Unified Intake Intelligence. The routing layer between durable capture and the
-- specialist processors. Every decision is receipted; every correction becomes learning.
-- Idempotent; safe to re-run.

create schema if not exists cairn;
set search_path to cairn, public;

do $$ begin
  create type cairn.route_action as enum ('act','confirm','ask');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cairn.decision_status as enum ('decided','acted','pending_confirm','pending_ask','corrected','failed');
exception when duplicate_object then null; end $$;

-- One routing decision per captured object (idempotent by capture_id).
create table if not exists cairn.decision (
  decision_id   uuid primary key default gen_random_uuid(),
  capture_id    text not null unique,               -- durable capture this routes (BUILD-002 guarantees durability first)
  source_type   text,                                -- youtube | url | text | email | ...
  what          text,                                -- Cairn's read of what the object is
  intent        text not null,                       -- learn | keep | journal | task | ask
  privacy_domain text not null default 'world',      -- world | personal | work | restricted
  lane          text not null,                       -- encyclopedia | personal | task | work | unknown
  treatment     text,                                -- keep | learn (knowledge lane) / lane-specific
  confidence    numeric not null default 0.5,
  rationale     text,                                -- bounded, human-readable why
  action        cairn.route_action not null,         -- act | confirm | ask
  status        cairn.decision_status not null default 'decided',
  decided_by    text not null default 'rules',       -- rules | learned | warwick
  routed_ref    jsonb,                                -- what the lane adapter returned
  error         text,
  created_at    timestamptz not null default now(),
  acted_at      timestamptz
);
create index if not exists decision_status_idx on cairn.decision(status);
create index if not exists decision_lane_idx on cairn.decision(lane);

-- Governed routing feedback — Warwick's corrections/confirmations raise future confidence.
-- Explicit instruction always outranks learned behaviour; never crosses privacy/domain silently.
create table if not exists cairn.routing_feedback (
  feedback_id   uuid primary key default gen_random_uuid(),
  pattern_key   text not null,                        -- e.g. 'youtube', 'url_host:medium.com', 'channel:The AI Automators'
  correct_lane  text not null,
  correct_intent text,
  correct_treatment text,
  privacy_domain text,                                -- a learned pattern may NOT upgrade privacy scope
  weight        int not null default 1,               -- repeated corrections raise weight → confidence
  source        text not null default 'warwick',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (pattern_key, correct_lane)
);
