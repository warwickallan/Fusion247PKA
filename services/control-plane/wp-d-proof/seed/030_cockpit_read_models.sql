-- =============================================================================
-- BUILD-014 WP-D increment 1 — cockpit read-model projections           (author: mack)
--
-- The canonical evidence lives in the append-only, trigger-protected ops.* tables.
-- Directus is the REPLACEABLE read cockpit and reads a PROJECTION (a read-model), not
-- the source of truth. These public tables are that projection: real primary keys so
-- Directus tracks them natively (Directus needs a PK; a bare SQL view has none).
--
-- The projection is REBUILT from ops.* on every provision (disposable proof). Mutating
-- the projection changes nothing authoritative — the immutable ledger is ops.agent_event,
-- whose append-only trigger the permission test exercises directly.
-- =============================================================================

begin;

drop table if exists public.tower_review_log cascade;
drop table if exists public.tower_verdicts cascade;

-- ---- The "Tower conversations" log: the review-interaction beats + Larry's summaries.
create table public.tower_review_log (
  id             uuid primary key,
  occurred_at    timestamptz not null,
  build_ref      text not null,
  actor          text not null,
  event_kind     text not null,
  summary        text,
  checkpoint_ref text,
  classification text not null
);

insert into public.tower_review_log (id, occurred_at, build_ref, actor, event_kind, summary, checkpoint_ref, classification)
select ae.id, ae.occurred_at, b.build_ref, ae.actor::text, ae.event_kind,
       ae.payload->>'summary', ae.payload->>'checkpoint_ref', ae.classification::text
from ops.agent_event ae
join ops.build b on b.id = ae.build_id;

create index tower_review_log_time_idx on public.tower_review_log (occurred_at);

comment on table public.tower_review_log is
  'Cockpit read-model: projection of the append-only ops.agent_event ledger (Tower review beats + Larry summaries). Canonical evidence is ops.agent_event.';

-- ---- Structured verdict outcomes (companion view for the cockpit).
create table public.tower_verdicts (
  id                  uuid primary key,
  build_ref           text not null,
  checkpoint_ref      text not null,
  reviewer            text not null,
  verdict_type        text not null,
  verdict             text not null,
  state               text not null,
  reviewed_commit_sha text not null,
  created_at          timestamptz not null
);

insert into public.tower_verdicts (id, build_ref, checkpoint_ref, reviewer, verdict_type, verdict, state, reviewed_commit_sha, created_at)
select v.id, b.build_ref, c.checkpoint_ref, v.reviewer::text, v.verdict_type::text,
       v.verdict::text, v.state::text, v.reviewed_commit_sha, v.created_at
from ops.verdict v
join ops.checkpoint c on c.id = v.checkpoint_id
join ops.build b on b.id = c.build_id;

comment on table public.tower_verdicts is
  'Cockpit read-model: projection of ops.verdict (head-bound review outcomes). Canonical evidence is ops.verdict.';

commit;
