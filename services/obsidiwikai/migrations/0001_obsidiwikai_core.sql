-- ObsidiWikAi core schema (IDEA-007).
-- Supabase = canonical operational + provenance ledger. Neo4j holds the graph; this schema
-- makes the encyclopedia REBUILDABLE (FR-020) and keeps every decision auditable (FR-016).
-- Idempotent: safe to re-run.

create schema if not exists obsidiwikai;
set search_path to obsidiwikai, public;

-- ---------- enums ----------
do $$ begin
  create type obsidiwikai.run_state as enum
    ('received','lens_built','extracting','canonicalising','projected','carded','completed','held','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type obsidiwikai.concept_status as enum
    ('candidate','accepted','held','rejected','superseded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type obsidiwikai.classification as enum
    ('SAME_CONCEPT','ALIAS_OF','BROADER_THAN','NARROWER_THAN','RELATED_TO',
     'SUPPORTS','CONTRADICTS','SUPERSEDES','NEW_CONCEPT','UNCERTAIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type obsidiwikai.interest_horizon as enum
    ('enduring','active','emerging','goal','project','question','negative');
exception when duplicate_object then null; end $$;

do $$ begin
  create type obsidiwikai.packet_state as enum
    ('queued','validated','delivered','rejected','held');
exception when duplicate_object then null; end $$;

-- ---------- source + processing run ----------
create table if not exists obsidiwikai.source (
  source_id     text primary key,                 -- stable id (e.g. youtube video_id)
  kind          text not null default 'youtube',
  title         text,
  source_url    text,
  capture_id    uuid,                              -- link to fcg.capture_envelope
  raw_ref       text,                              -- immutable evidence pointer (TubeAIR _raw/<id>)
  raw_sha256    text,
  privacy_domain text not null default 'world',
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);

create table if not exists obsidiwikai.processing_run (
  run_id        uuid primary key default gen_random_uuid(),
  source_id     text not null references obsidiwikai.source(source_id),
  lens_id       uuid,
  state         obsidiwikai.run_state not null default 'received',
  idempotency_key text not null,                   -- source_id + content hash: re-run replaces, no dup universe (FR-018)
  attempt       int not null default 1,
  stats         jsonb not null default '{}'::jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  unique (idempotency_key)
);
create index if not exists run_source_idx on obsidiwikai.processing_run(source_id);
create index if not exists run_state_idx on obsidiwikai.processing_run(state);

-- ---------- the Warwick lens (FR-003/004, FR-D) ----------
-- Canonical, CRUD-able interest record lives HERE (portable, inspectable); Honcho enriches/reasons.
create table if not exists obsidiwikai.canonical_interest (
  interest_id   uuid primary key default gen_random_uuid(),
  label         text not null,
  horizon       obsidiwikai.interest_horizon not null,
  weight        numeric not null default 0.5,      -- 0..1 strength
  confidence    numeric not null default 0.5,
  evidence      jsonb not null default '[]'::jsonb,
  status        text not null default 'active',     -- active | expired
  source        text not null default 'seed',       -- seed | honcho | warwick | feedback
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  review_at     timestamptz,
  unique (label, horizon)
);

-- The lens snapshot actually used for a run (so we can explain why a source was read a given way).
create table if not exists obsidiwikai.interest_lens (
  lens_id       uuid primary key default gen_random_uuid(),
  lens_version  bigint not null,
  origin        text not null default 'honcho+supabase', -- honcho | supabase_seed | manual
  enduring      jsonb not null default '[]'::jsonb,
  active        jsonb not null default '[]'::jsonb,
  emerging      jsonb not null default '[]'::jsonb,
  goals         jsonb not null default '[]'::jsonb,
  current_projects jsonb not null default '[]'::jsonb,
  open_questions   jsonb not null default '[]'::jsonb,
  negative_signals jsonb not null default '[]'::jsonb,
  adjacent_topics  jsonb not null default '[]'::jsonb,
  generated_at  timestamptz not null default now()
);

-- ---------- candidate + canonical concepts (encyclopedia provenance mirror) ----------
create table if not exists obsidiwikai.candidate_concept (
  candidate_id  uuid primary key default gen_random_uuid(),
  run_id        uuid not null references obsidiwikai.processing_run(run_id) on delete cascade,
  source_id     text not null references obsidiwikai.source(source_id),
  raw_name      text not null,
  entity_type   text,
  description   text,
  pass          text not null default 'broad',      -- broad | interest
  relevance     numeric,                             -- interest-conditioned score (0..1)
  lightrag_ref  text,                                -- entity_id / source_id in LightRAG
  evidence      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists cand_run_idx on obsidiwikai.candidate_concept(run_id);

-- The canonical concept: Neo4j is the live graph; this row is the durable, rebuildable record.
create table if not exists obsidiwikai.canonical_concept (
  canonical_id  text primary key,                    -- stable slug id
  canonical_name text not null,
  description   text,
  type          text not null default 'Concept',
  status        obsidiwikai.concept_status not null default 'accepted',
  aliases       jsonb not null default '[]'::jsonb,   -- source-preserving aliases (FR-012)
  confidence    numeric not null default 0.7,
  privacy_domain text not null default 'world',
  source_count  int not null default 0,
  evidence_count int not null default 0,
  superseded_by text references obsidiwikai.canonical_concept(canonical_id),
  first_seen    timestamptz not null default now(),
  last_updated  timestamptz not null default now()
);
create index if not exists concept_name_idx on obsidiwikai.canonical_concept(lower(canonical_name));
create index if not exists concept_status_idx on obsidiwikai.canonical_concept(status);

create table if not exists obsidiwikai.concept_evidence (
  evidence_id   uuid primary key default gen_random_uuid(),
  canonical_id  text not null references obsidiwikai.canonical_concept(canonical_id) on delete cascade,
  source_id     text not null references obsidiwikai.source(source_id),
  run_id        uuid references obsidiwikai.processing_run(run_id) on delete set null,
  original_wording text,
  extracted_claim  text,
  transcript_span  text,
  model         text,
  confidence    numeric,
  created_at    timestamptz not null default now(),
  unique (canonical_id, source_id, original_wording)   -- evidence-once per source wording (FR-016/018)
);

-- Canonicaliser decisions — audit + reusable resolution evidence (FR-A).
create table if not exists obsidiwikai.resolution (
  resolution_id uuid primary key default gen_random_uuid(),
  run_id        uuid not null references obsidiwikai.processing_run(run_id) on delete cascade,
  candidate_id  uuid references obsidiwikai.candidate_concept(candidate_id) on delete set null,
  candidate_name text not null,
  matched_canonical_id text references obsidiwikai.canonical_concept(canonical_id),
  classification obsidiwikai.classification not null,
  confidence    numeric not null,
  decided_by    text not null default 'auto',        -- auto | model | warwick
  rationale     text,
  created_at    timestamptz not null default now()
);

-- The uncertain band → one-tap Directus questions (FR-A, FR-014).
create table if not exists obsidiwikai.review_item (
  review_id     uuid primary key default gen_random_uuid(),
  run_id        uuid not null references obsidiwikai.processing_run(run_id) on delete cascade,
  candidate_id  uuid references obsidiwikai.candidate_concept(candidate_id) on delete set null,
  question      text not null,
  options       jsonb not null,                      -- [{key,label}]
  status        text not null default 'open',        -- open | answered | expired
  answer_key    text,
  answered_by   text,
  created_at    timestamptz not null default now(),
  answered_at   timestamptz
);
create index if not exists review_open_idx on obsidiwikai.review_item(status) where status = 'open';

-- The deferred reservoir — below-threshold knowledge kept, not discarded (FR-B).
create table if not exists obsidiwikai.deferred_candidate (
  defer_id      uuid primary key default gen_random_uuid(),
  source_id     text not null references obsidiwikai.source(source_id),
  candidate_id  uuid references obsidiwikai.candidate_concept(candidate_id) on delete set null,
  raw_name      text not null,
  reason        text not null,                       -- below_relevance | below_confidence | uncertain
  lens_version  bigint,
  confidence    numeric,
  created_at    timestamptz not null default now(),
  revisited_at  timestamptz
);
create index if not exists defer_open_idx on obsidiwikai.deferred_candidate(revisited_at) where revisited_at is null;

-- ---------- Warwick-facing knowledge card (FR-022, PRD §8) ----------
create table if not exists obsidiwikai.knowledge_card (
  card_id       uuid primary key default gen_random_uuid(),
  run_id        uuid not null references obsidiwikai.processing_run(run_id) on delete cascade,
  source_id     text not null references obsidiwikai.source(source_id),
  status        text not null default 'rendered',
  what_arrived  jsonb not null default '{}'::jsonb,
  what_contains jsonb not null default '{}'::jsonb,
  why_it_matters jsonb not null default '{}'::jsonb,
  how_changed   jsonb not null default '{}'::jsonb,
  what_follows  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists card_run_idx on obsidiwikai.knowledge_card(run_id);

-- ---------- grounded suggestions (FR-025/026, WP5) ----------
create table if not exists obsidiwikai.suggestion (
  suggestion_id uuid primary key default gen_random_uuid(),
  run_id        uuid references obsidiwikai.processing_run(run_id) on delete set null,
  kind          text not null,                       -- self_improve | fusion247 | content | monetise | learning
  summary       text not null,
  evidence      jsonb not null default '[]'::jsonb,   -- cited canonical_ids (FR-025 must cite)
  confidence    numeric,
  assumptions   text,
  benefit       text,
  next_step     text,
  what_invalidates text,
  status        text not null default 'proposed',     -- proposed | accepted | dismissed
  created_at    timestamptz not null default now()
);

-- ---------- ChatGPT -> Honcho Context Outbox (CONTEXT-OUTBOX.md, WP2) ----------
create table if not exists obsidiwikai.context_packet (
  packet_id     uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,              -- replay-safe single Honcho write
  type          text not null,                       -- preference|correction|decision|interest|standing_instruction|session_conclusion
  summary       text not null,
  evidence      text,
  confidence    text,
  sensitivity   text not null default 'ordinary',    -- ordinary|restricted|prohibited
  lifespan      text not null default 'permanent',   -- permanent|temporary|<review date>
  source_pointer text,
  supersedes    uuid references obsidiwikai.context_packet(packet_id),
  state         obsidiwikai.packet_state not null default 'queued',
  honcho_ref    text,
  error         text,
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz
);
create index if not exists packet_state_idx on obsidiwikai.context_packet(state);

-- ---------- feedback (Warwick's actions teach the lens; FR-023/024) ----------
create table if not exists obsidiwikai.feedback_event (
  feedback_id   uuid primary key default gen_random_uuid(),
  run_id        uuid references obsidiwikai.processing_run(run_id) on delete set null,
  target_kind   text not null,                       -- concept | resolution | suggestion | interest | card
  target_id     text,
  action        text not null,                       -- approve|reject|correct|merge|split|reclassify|adopt_interest|dismiss|mark_low_value
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
