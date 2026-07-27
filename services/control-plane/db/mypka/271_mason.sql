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
  atom_key         text,                         -- CONTENT hash (origin|source|target|reasoning) — stable identity
  n                int,                          -- display index only (NOT identity — positional keys corrupt on re-run)
  source_ref       text not null,               -- source id / label
  engine           text,                         -- T1 | T2 (generator tier)
  frames           text[],                       -- contributing reasoning frames (T2)
  convergence      text,                         -- single | context_induced | novel_independent
  category         text,                         -- brain | cash
  fusion_target    text,
  spin             jsonb,                        -- { situation, problem, implication, need_payoff }
  transfer_reasoning text,
  source_evidence  jsonb,                        -- { quote, timestamp, named_mechanism, verified }
  nvfi             jsonb,                        -- { novelty, viability, fit, impact } PROVISIONAL
  meta             jsonb not null default '{}',  -- traps / forced_analogy / graph_note — the atom's risk channel
  origin           text not null default 'production',  -- production | experiment
  atom_state       text not null default 'registered'
    check (atom_state in ('registered','surfaced_member','emerging_member','standalone','rejected_member')),
  created_at       timestamptz not null default now()
);
create index if not exists idea_atom_state_idx on cockpit.idea_atom (atom_state);
-- CONTENT-HASH identity (Fable B2): re-seeding/re-running UPSERTS on the transfer's content, so it never
-- content-swaps or duplicates an atom the way a positional key does; atom_id + provenance + disposition-carry stay stable.
-- The key is computed in ONE place — atom-register.mjs atomKey() (JS) — so migration only adds the column + index;
-- pre-existing rows are rekeyed by mason-backfill's rekey step (never in SQL, to avoid JS/SQL hash-basis drift).
alter table cockpit.idea_atom add column if not exists atom_key text;
alter table cockpit.idea_atom add column if not exists meta jsonb not null default '{}';
drop index if exists cockpit.idea_atom_natkey;   -- retire the positional key
create unique index if not exists idea_atom_key on cockpit.idea_atom (atom_key);  -- NULLs distinct: pre-rekey rows coexist

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
  -- Warwick's DISPOSITION is durable human authority, separate from synthesis `state`. A re-synthesis updates
  -- content/evidence/membership but must CARRY the disposition forward (matched by atom-set overlap), or flag a
  -- conflict for Warwick rather than guessing. Never silently overwrite his call.
  disposition        text check (disposition in ('watching','researching','brief','later','declined')),
  disposition_at     timestamptz,
  disposition_conflict boolean not null default false,  -- ambiguous carry-forward → needs Warwick review
  matched_from       uuid,                              -- prior opportunity this one inherited disposition from
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists opportunity_state_idx on cockpit.opportunity (state, otype);
-- idempotent for installs created before the disposition columns existed
alter table cockpit.opportunity add column if not exists disposition text;
alter table cockpit.opportunity add column if not exists disposition_at timestamptz;
alter table cockpit.opportunity add column if not exists disposition_conflict boolean not null default false;
alter table cockpit.opportunity add column if not exists matched_from uuid;

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

-- Grants only where each cockpit role exists — guarded PER ROLE so an env with one but not the other still
-- applies cleanly (skipped entirely on the dev sandbox that has neither).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'cp_directus') then
    grant usage on schema cockpit to cp_directus;
    grant select on cockpit.idea_atom, cockpit.opportunity, cockpit.opportunity_atom,
                    cockpit.opportunity_run, cockpit.opportunity_event to cp_directus;
    grant insert on cockpit.opportunity_event to cp_directus;
  end if;
  if exists (select 1 from pg_roles where rolname = 'cp_worker') then
    grant usage on schema cockpit to cp_worker;
    grant select on cockpit.idea_atom, cockpit.opportunity, cockpit.opportunity_atom,
                    cockpit.opportunity_run, cockpit.opportunity_event to cp_worker;
    grant insert on cockpit.opportunity_event to cp_worker;
    grant update (state, disposition, disposition_at, disposition_conflict, matched_from, updated_at) on cockpit.opportunity to cp_worker;
  end if;
end $$;
