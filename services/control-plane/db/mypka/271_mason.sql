-- =============================================================================
-- MyPKA cockpit migration 271 — Mason / Brains synthesis layer (v1)
-- The synthesis capability the T1/T2 experiment proved is missing: a DURABLE atomic idea register
-- (every atom preserved + inspectable, never forced into Warwick's attention) + durable OPPORTUNITY
-- records (build theses) with full provenance back to atoms/sources. Mason (the agent) owns the Brains
-- capability: atoms -> coherence-gated synthesis -> a small set of build-sized opportunities.
-- Additive only (new tables); reversible by dropping them. Does not touch 270's idea_candidate.
-- =============================================================================
create schema if not exists cockpit;

-- Durable atomic idea register. Complete corpus lives here; atom_state records how synthesis placed it.
create table if not exists cockpit.idea_atom (
  atom_id          uuid primary key default gen_random_uuid(),
  n                int,                          -- stable corpus index for traceability
  source_ref       text not null,               -- source id / label
  engine           text,                         -- T1 | T2 (generator tier)
  frames           text[],                       -- contributing reasoning frames (T2)
  convergence      text,                         -- single | context_induced | novel_independent
  category         text,                         -- brain | cash
  fusion_target    text,
  spin             jsonb,                        -- { situation, problem, implication, need_payoff }
  transfer_reasoning text,
  source_evidence  jsonb,                        -- { quote, timestamp, named_mechanism }
  nvfi             jsonb,                        -- { novelty, viability, fit, impact } PROVISIONAL
  origin           text not null default 'production',  -- production | experiment
  atom_state       text not null default 'registered'
    check (atom_state in ('registered','surfaced_member','emerging_member','standalone','rejected_member')),
  created_at       timestamptz not null default now()
);
create index if not exists idea_atom_state_idx on cockpit.idea_atom (atom_state);

-- Re-runnable synthesis passes (each = one Mason run over the register).
create table if not exists cockpit.opportunity_run (
  run_id       uuid primary key default gen_random_uuid(),
  atom_count   int, surfaced int, emerging int, rejected int, standalone int,
  model        text default 'claude-sonnet-5',
  duration_ms  int, output_tokens int,
  notes        text,
  created_at   timestamptz not null default now()
);

-- Durable opportunity records (build theses). SPIN-first; ROI + evidence + what-we'd-build; provenance below.
create table if not exists cockpit.opportunity (
  opportunity_id  uuid primary key default gen_random_uuid(),
  run_id          uuid references cockpit.opportunity_run(run_id) on delete set null,
  headline        text not null,
  otype           text not null check (otype in ('strategic','self_improvement')),
  state           text not null default 'surfaced'
    check (state in ('weak','emerging','surfaced','interested','researching','brief','built','later','declined','rejected')),
  spin            jsonb,                          -- { situation, problem, implication, need_payoff }
  why_now         text,
  roi             jsonb,                          -- { value_type, band, note }
  evidence        jsonb,                          -- { independent_sources, frames, live_anchors, convergence_note }
  what_wed_build  text,
  coherence_note  text,
  rejected_reason text,                           -- for state=rejected: semantic | volume | incoherent
  score           numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists opportunity_state_idx on cockpit.opportunity (state, otype);

-- Provenance: which atoms support each opportunity (also carries rejected-cluster membership).
create table if not exists cockpit.opportunity_atom (
  opportunity_id uuid references cockpit.opportunity(opportunity_id) on delete cascade,
  atom_id        uuid references cockpit.idea_atom(atom_id) on delete cascade,
  primary key (opportunity_id, atom_id)
);

-- Append-only opportunity lifecycle log.
create table if not exists cockpit.opportunity_event (
  event_id       uuid primary key default gen_random_uuid(),
  opportunity_id uuid references cockpit.opportunity(opportunity_id) on delete cascade,
  ts             timestamptz not null default now(),
  actor          text not null,
  event          text not null,
  note           text
);
create index if not exists opportunity_event_idx on cockpit.opportunity_event (opportunity_id, ts);

-- Grants only where the cockpit roles exist (skipped on the dev sandbox that has no cp_* roles).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'cp_directus') then
    grant usage on schema cockpit to cp_directus, cp_worker;
    grant select on cockpit.idea_atom, cockpit.opportunity, cockpit.opportunity_atom,
                    cockpit.opportunity_run, cockpit.opportunity_event to cp_directus, cp_worker;
    grant insert on cockpit.opportunity_event to cp_directus, cp_worker;
    grant update (state, updated_at) on cockpit.opportunity to cp_worker;
  end if;
end $$;
