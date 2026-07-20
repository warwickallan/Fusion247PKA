-- BUILD-014 Tower supervisor WATCHER — minimal, idempotent schema delta on top of
-- db/loop_schema.sql. This is the SMALLEST set of columns/tables/indexes the persistent
-- watcher literally cannot operate without. Nothing speculative. DEV/synthetic only.
--
-- Applied by apply.mjs -> applyWatcherSchema(); the watcher also re-applies it on boot
-- (idempotent). Every statement is `if not exists`, safe to run repeatedly.

-- 1) Durable lease on a turn — the ONLY way the watcher can guarantee exactly-once claim
--    across restarts. `state` gains two working values: 'pending' (arrived, unprocessed)
--    and 'claimed' (leased by a watcher). state is free text (no CHECK), so no enum change.
alter table tower.turn add column if not exists lease_owner        text;
alter table tower.turn add column if not exists lease_deadline_at  timestamptz;

-- 2) A durable goal-complete signal carried on the turn. The watcher processes turns purely
--    from the DB, so a caller's "this ships the goal" flag must live on the row, not memory.
alter table tower.turn add column if not exists goal_complete boolean not null default false;

-- 3) The exact text staged to Codex (base reconstructed turn + injected open findings).
--    Persisted verbatim so "Codex input reconstructed from persisted data" is directly
--    auditable and byte-identical after a restart. packet_hash = sha256(staged_input).
alter table tower.supervisor_review add column if not exists staged_input text;

-- 4) Notification dedup — required by "no duplicate Telegram". notify() does
--    INSERT ... ON CONFLICT (turn_id, reason) DO NOTHING and only POSTs when it wins the
--    insert. (turn_id NULL rows — crash notifications — stay distinct, by design.)
create unique index if not exists notification_turn_reason_uniq
  on tower.notification (turn_id, reason);

-- 5) Watcher heartbeat — one upserted row per watcher so aliveness is checkable from the DB.
create table if not exists tower.watcher_heartbeat (
  watcher_id   text primary key,
  last_beat    timestamptz not null default now(),
  last_turn_id uuid,
  state        text
);

-- 6) Finding carry-forward (case D). Tiny by design: an open finding on a build must not
--    silently disappear from one turn's review to the next. The watcher injects a build's
--    OPEN findings into the Codex-staged input; carry-forward is the default (a finding
--    stays 'open' until something explicitly resolves it).
create table if not exists tower.finding (
  id             uuid primary key default gen_random_uuid(),
  build_ref      text not null default 'BUILD-014',
  opened_turn_id uuid references tower.turn(id),
  description    text not null,
  state          text not null default 'open',   -- open|resolved
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists finding_build_open_idx
  on tower.finding (build_ref) where state = 'open';

-- 7) Merge-class turn fields (FIX 1). A merge-class turn (PR / checkpoint / completion
--    claim / review / merge / deploy) must ALSO run the APPROVED Tower QA skill against REAL
--    Git evidence. These carry the explicit merge-review signal + the exact code target. All
--    nullable; ordinary turns leave them unset. `kind` defaults to 'ordinary' (free text, no
--    enum change) — 'merge_review' marks an explicitly-declared merge-class turn.
alter table tower.turn add column if not exists kind      text not null default 'ordinary';
alter table tower.turn add column if not exists pr_number integer;
alter table tower.turn add column if not exists repo      text;
alter table tower.turn add column if not exists base_sha  text;
alter table tower.turn add column if not exists head_sha  text;

-- 8) Idempotent ingest key (FIX 2). The session Stop-hook bridge derives a deterministic
--    (session_id : last-assistant-uuid) key so the SAME Larry reply cannot double-ingest.
--    Nullable + UNIQUE: turns created without a key (e.g. accept harness) stay unconstrained.
alter table tower.turn add column if not exists session_turn_key text;
create unique index if not exists turn_session_turn_key_uniq
  on tower.turn (session_turn_key) where session_turn_key is not null;

-- 9) Which supervisor prompt(s) ran + their fingerprints (FIX 1), and the merge-class QA
--    review result (Tower QA skill over Git evidence). Ordinary turns carry only the
--    delivery supervisor; merge-class turns carry both. Persisted for audit.
alter table tower.supervisor_review add column if not exists prompts_applied jsonb;
alter table tower.supervisor_review add column if not exists merge_review    jsonb;

-- 10) Exactly-once persisted review per turn (FIX 4). A long Codex run + a second watcher
--     reclaiming mid-flight must still yield EXACTLY ONE review row. The claim/process path
--     checks for an existing review before invoking Codex; this constraint is the durable
--     backstop (INSERT ... ON CONFLICT (turn_id) DO NOTHING → read the existing review).
create unique index if not exists supervisor_review_turn_uniq
  on tower.supervisor_review (turn_id);
