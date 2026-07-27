-- =============================================================================
-- MyPKA cockpit migration 270 — Transfer-Intelligence idea engine (T1 vertical slice)
-- Durable candidates with provenance + provisional NVFI + append-only event log + a mine record that
-- separates the Transfer-Intelligence payload cost from the Claude Code wrapper/cache overhead
-- (Warwick's Path-A acceptance requirement — the cost of the faculty itself must be visible, distinct
-- from the execution wrapper). Preserves the existing graph-wide suggestions.mjs as a separate capability.
-- =============================================================================
create schema if not exists cockpit;

create table if not exists cockpit.idea_mine (
  mine_id          uuid primary key default gen_random_uuid(),
  source_ref       text not null,                -- e.g. youtube video_id
  source_kind      text not null default 'youtube_transcript',
  brief_hash       text not null,
  brief_snapshot   text not null,                -- exact A+B+C brief the specialist saw
  b_provenance     text not null default 'curated_seed',
  model            text not null default 'claude-sonnet-5',
  status           text not null default 'complete',
  discarded_obvious jsonb not null default '[]',
  zero_reason      text,
  -- Token breakdown (Path-A): SEPARATE the faculty payload from the CC wrapper/cache overhead.
  payload_input_tokens    int,   -- our actual Mine input (source + brief + prompt) — the faculty's cost
  output_tokens           int,   -- model output — the faculty's cost
  wrapper_cache_creation_tokens int,  -- Claude Code system-prompt/tools (cache creation)
  wrapper_cache_read_tokens     int,  -- Claude Code framework (cache read)
  total_reported_tokens   int,   -- everything CC reported
  cost_usd        numeric,
  duration_ms     int,
  created_at      timestamptz not null default now()
);

create table if not exists cockpit.idea_candidate (
  candidate_id    uuid primary key default gen_random_uuid(),
  mine_id         uuid not null references cockpit.idea_mine(mine_id) on delete cascade,
  brief_hash      text not null,
  source_evidence jsonb not null,                -- { quote, timestamp, named_mechanism }
  transfer_reasoning text not null,
  fusion_target   text not null,
  spin            text,
  category        text not null check (category in ('brain','cash')),
  lens            text,
  nvfi            jsonb not null,                 -- { novelty, viability, fit, impact }  PROVISIONAL
  traps           jsonb not null default '[]',
  larry_recon     jsonb,                          -- brain only; null until reconciled
  lifecycle_state text not null default 'proposed'
    check (lifecycle_state in ('proposed','reconciled','kept','declined','later','researching','built','parked')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idea_candidate_mine_idx on cockpit.idea_candidate (mine_id);
create index if not exists idea_candidate_state_idx on cockpit.idea_candidate (lifecycle_state, category);

create table if not exists cockpit.idea_event (   -- append-only; never mutate in place
  event_id      uuid primary key default gen_random_uuid(),
  candidate_id  uuid references cockpit.idea_candidate(candidate_id) on delete cascade,
  mine_id       uuid references cockpit.idea_mine(mine_id) on delete cascade,
  ts            timestamptz not null default now(),
  actor         text not null check (actor in ('specialist','larry','warwick','pax','system')),
  event         text not null,   -- mined | reconciled | kept | declined | later | research_started | ...
  note          text
);
create index if not exists idea_event_candidate_idx on cockpit.idea_event (candidate_id, ts);

-- Grants: the runner writes as the service role (DATABASE_URL). The cockpit surface reads candidates
-- and files lifecycle transitions; cp_worker applies lifecycle updates + events.
grant select on cockpit.idea_mine, cockpit.idea_candidate, cockpit.idea_event to cp_directus, cp_worker;
grant insert on cockpit.idea_event to cp_directus, cp_worker;
grant update (lifecycle_state, larry_recon, updated_at) on cockpit.idea_candidate to cp_worker;
