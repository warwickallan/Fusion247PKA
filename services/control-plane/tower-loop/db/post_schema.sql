-- WO-TW-02 Tower supervisor loop — PR VERDICT WRITE-BACK, schema delta (SQLite, WAL).
-- Applied by apply.mjs -> applyPostSchema(); the watcher re-applies it on boot (idempotent).
--
-- WHY A TABLE AND NOT A FLAG. The verdict now leaves Tower and lands on a PR as a comment — an
-- OUTWARD, IRREVERSIBLE action. "Did we already post this?" therefore has to survive process
-- death, because the failure mode of getting it wrong is a PR filling with duplicate review
-- comments, and the failure mode of over-correcting is a verdict that silently never arrives.
-- Application logic cannot hold that guarantee: a restart skips it by definition.
--
-- THE GUARANTEE IS THE UNIQUE INDEX, exactly as tower.turn_session_turn_key_uniq is for
-- checkpoint turns. `post_key` is deterministic in the REVIEW id (one review per turn, enforced
-- by tower.supervisor_review_turn_uniq), so the same verdict can only ever claim one row. The
-- writer INSERTs first and only calls GitHub if it WON that insert — the same claim-then-send
-- shape notify() already uses for Telegram, for the same reason.
--
-- SQLite quirk carried over from WO-TW-01: in DDL the schema qualifier goes on the INDEX name,
-- never on the table — `create index tower.x on pr_verdict_post (...)`.

create table if not exists tower.pr_verdict_post (
  id          text primary key default (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),

  -- The durable idempotency key. UNIQUE below; deterministic in review_id.
  post_key    text not null,

  review_id   text not null references supervisor_review(id),
  turn_id     text not null references turn(id),
  repo        text not null,
  pr_number   integer not null,
  head_sha    text,

  -- The exact text posted (or to be posted), kept verbatim so what landed on the PR is
  -- checkable from the store after the fact rather than reconstructed from a template.
  body        text not null,

  posted      integer not null default 0,   -- 0 = claimed but not yet on GitHub, 1 = posted
  attempts    integer not null default 0,
  comment_id  integer,                      -- GitHub's id for the comment we created
  comment_url text,
  last_error  text,

  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- THE CONTROL. Without this index the write-back is idempotent only for as long as nothing
-- crashes at the wrong moment, which is not idempotent.
create unique index if not exists tower.pr_verdict_post_key_uniq
  on pr_verdict_post (post_key);

-- Pending sweep: retries live here, and a partial index keeps the scan proportional to the
-- number of UNPOSTED verdicts rather than to every verdict ever posted.
-- NOTE: `rowid` cannot appear in a SQLite index (it is not a column), so the sweep orders by
-- `created_at, rowid` and this indexes the leading key. Same `, rowid asc` tie-break convention
-- WO-TW-01 established everywhere else, for the same reason: SQLite timestamps are millisecond
-- resolution and its sort is not required to be stable.
create index if not exists tower.pr_verdict_post_pending_idx
  on pr_verdict_post (created_at) where posted = 0;
