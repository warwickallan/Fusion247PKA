-- BUILD-014 Tower supervisor loop — minimal durable turn schema (isolated Supabase DEV).
-- Codex acts as GPT-style product supervisor; the FULL exchange is stored here durably so a
-- turn can be reconstructed after a restart. DEV/synthetic. No AsdAIr/live data. Idempotent.

create schema if not exists tower;

-- The active Warwick-approved GPT product-supervisor prompt. Loaded FIRST on every turn.
create table if not exists tower.supervisor_prompt (
  id           uuid primary key default gen_random_uuid(),
  version      integer not null,
  content      text    not null,
  content_hash text    not null,          -- sha256 of content, bound onto every review
  active       boolean not null default false,
  approved_by  text,
  created_at   timestamptz not null default now()
);
-- At most one active prompt.
create unique index if not exists supervisor_prompt_single_active
  on tower.supervisor_prompt ((active)) where active;

-- One governed turn: the Warwick/Tower instruction + Larry's response, bound to the prompt used.
create table if not exists tower.turn (
  id             uuid primary key default gen_random_uuid(),
  seq            bigint generated always as identity,
  build_ref      text not null default 'BUILD-014',
  prompt_id      uuid references tower.supervisor_prompt(id),
  prompt_version integer,
  prompt_hash    text,
  instruction    text not null,           -- what Warwick / Tower asked
  larry_response text,                     -- Larry's response or proposed action
  state          text not null default 'open',  -- open|reviewed|acted|blocked|awaiting_warwick|complete
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Codex's supervisor review of a reconstructed turn (Codex never sees Supabase creds; Tower stages).
create table if not exists tower.supervisor_review (
  id            uuid primary key default gen_random_uuid(),
  turn_id       uuid not null references tower.turn(id),
  reviewer      text not null default 'gpt_codex',
  model_id      text,
  packet_hash   text,                      -- hash of the reconstructed turn staged to Codex
  aligned       boolean,                   -- is Larry doing what Warwick asked?
  over_engineering boolean,
  drifting      boolean,                   -- into governance/architecture/scope
  administering boolean,                   -- merely administering vs delivering
  next_action   text,
  warwick_needed boolean,
  verdict       text,                      -- continue|correct|block|ask_warwick
  summary       text,
  raw_output    jsonb,
  created_at    timestamptz not null default now()
);

-- Every automatic Telegram the Watcher sends (real delivery result recorded).
create table if not exists tower.notification (
  id                  uuid primary key default gen_random_uuid(),
  turn_id             uuid references tower.turn(id),
  reason              text not null,       -- warwick_input_required|codex_block_or_redirect|goal_complete|tower_failure
  state               text not null,
  message             text not null,
  telegram_ok         boolean,
  telegram_message_id bigint,
  created_at          timestamptz not null default now()
);
