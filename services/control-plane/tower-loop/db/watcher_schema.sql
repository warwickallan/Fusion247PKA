-- BUILD-014 Tower supervisor WATCHER — schema delta on top of db/loop_schema.sql (SQLite, WAL).
-- WO-TW-01: translated from the Postgres original. This is the SMALLEST set of tables and indexes
-- the persistent watcher literally cannot operate without. Nothing speculative. DEV/synthetic only.
--
-- Applied by apply.mjs -> applyWatcherSchema(); the watcher also re-applies it on boot
-- (idempotent). Every statement is `if not exists`, safe to run repeatedly.
--
-- WHERE THE DELTA'S COLUMNS WENT. SQLite has no `add column if not exists`, so the columns this
-- delta used to ALTER onto tower.turn (lease, goal_complete, merge-class fields, session key) and
-- onto tower.supervisor_review (staged_input, prompts_applied, merge_review) are declared inline
-- on those tables in db/loop_schema.sql, each labelled with the delta it came from. The post-apply
-- shape is identical. Everything this delta CREATES in its own right — the dedup index, the
-- heartbeat table, tower.finding, and the two uniqueness backstops — is still here.

-- 1) Notification dedup — required by "no duplicate Telegram". notify() does
--    INSERT ... ON CONFLICT (turn_id, reason) DO NOTHING and only POSTs when it wins the insert.
--    (turn_id NULL rows — crash notifications — stay distinct: SQLite, like Postgres, treats NULLs
--    in a unique index as distinct from one another. That is by design.)
create unique index if not exists tower.notification_turn_reason_uniq
  on notification (turn_id, reason);

-- 2) Watcher heartbeat — one upserted row per watcher so aliveness is checkable from the store.
create table if not exists tower.watcher_heartbeat (
  watcher_id   text primary key,
  last_beat    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_turn_id text,
  state        text
);

-- 3) Finding carry-forward (case D). Tiny by design: an open finding on a build must not silently
--    disappear from one turn's review to the next. The watcher injects a build's OPEN findings
--    into the Codex-staged input; carry-forward is the default (a finding stays 'open' until
--    something explicitly resolves it).
--
--    THE DISPOSITION AXIS below arrived with the WO-OR-22 comment seam (db/comment_schema.sql §3)
--    and is declared here only because SQLite cannot ADD CONSTRAINT to an existing table. Its
--    vocabulary, its rules and the reasoning behind them are documented where they belong, in
--    db/comment_schema.sql §3 — read that before touching any of the four CHECKs. The constraint
--    NAMES are identical to the Postgres originals, deliberately: the proofs match on them.
--
--    All disposition columns NULLABLE: a pre-existing finding is untouched and simply has no
--    disposition yet — which is exactly the state the review gate FAILS CLOSED on (findings.mjs).
create table if not exists tower.finding (
  id             text primary key default (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  build_ref      text not null default 'BUILD-014',
  opened_turn_id text references turn(id),
  description    text not null,
  state          text not null default 'open',   -- open|resolved
  created_at     text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- from db/comment_schema.sql §3 — the PRIOR-FINDING disposition axis.
  disposition            text,
  disposition_rationale  text,
  disposition_source     text,
  -- NOT declared as a REFERENCES here on purpose: its parent table tower.pr_comment is created by
  -- db/comment_schema.sql, and SQLite resolves a foreign-key parent when the child row is
  -- written, so a declared FK would make tower.finding unusable until the comment delta had also
  -- been applied. The same guarantee is enforced from that file by the named trigger pair
  -- finding_disposition_comment_fk_{ins,upd}, where both tables exist.
  disposition_comment_id text,
  -- was DOMAIN tower.git_sha; SQLite has no domains, so the same rule is a named CHECK. Canonical
  -- means lower-case, FULL 40 hex characters — see db/comment_schema.sql §1.
  disposition_head_sha   text constraint git_sha_canonical_chk
                         check (disposition_head_sha is null
                             or (length(disposition_head_sha) = 40
                                 and disposition_head_sha not glob '*[^0-9a-f]*')),
  disposition_at         text,

  constraint finding_disposition_vocab_chk
    check (disposition is null or disposition in ('addressed', 'remains_open', 'unrelated')),
  constraint finding_disposition_source_chk
    check (disposition_source is null or disposition_source in ('pr_comment', 'manual')),
  -- A disposition is only decision-grade if we know WHERE it came from and WHICH HEAD it was
  -- judged at. Without the head binding a disposition given three heads ago would silently count
  -- for today's round — the exact "stale answer applied to a newer head" failure.
  constraint finding_disposition_complete_chk
    check (disposition is null
        or (disposition_source is not null
            and disposition_head_sha is not null
            and disposition_at is not null)),
  -- THE PROVENANCE GUARANTEE: a disposition claiming to come from a PR comment must name the
  -- comment row it came from. This is what makes "ingested from a PR comment" and "hand-typed"
  -- structurally distinguishable rather than a matter of trusting a label.
  constraint finding_disposition_provenance_chk
    check (disposition_source is not 'pr_comment' or disposition_comment_id is not null)
);
create index if not exists tower.finding_build_open_idx
  on finding (build_ref) where state = 'open';

-- 4) Idempotent ingest key (FIX 2) — the uniqueness half of tower.turn.session_turn_key. The
--    session Stop-hook bridge derives a deterministic (session_id : last-assistant-uuid) key so
--    the SAME Larry reply cannot double-ingest. Partial, so unkeyed turns stay unconstrained.
create unique index if not exists tower.turn_session_turn_key_uniq
  on turn (session_turn_key) where session_turn_key is not null;

-- 5) Exactly-once persisted review per turn (FIX 4). A long Codex run + a second watcher
--    reclaiming mid-flight must still yield EXACTLY ONE review row. The claim/process path checks
--    for an existing review before invoking Codex; this constraint is the durable backstop
--    (INSERT ... ON CONFLICT (turn_id) DO NOTHING → read the existing review).
create unique index if not exists tower.supervisor_review_turn_uniq
  on supervisor_review (turn_id);
