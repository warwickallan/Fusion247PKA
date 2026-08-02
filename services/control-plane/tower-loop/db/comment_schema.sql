-- WO-OR-22 Tower supervisor loop — the PR-COMMENT ⇄ TOWER SEAM (SQLite, idempotent schema delta
-- on top of db/loop_schema.sql + db/watcher_schema.sql). WO-TW-01: translated from the Postgres
-- original.
--
-- WHY THIS EXISTS
--   A Warwick/Larry response written in a PR comment must become MACHINE-READABLE input to the
--   next Tower/Codex review round. Before this, a reply about a review lived only in the PR
--   (invisible to the loop) and finding dispositions were carried by nobody — tower.finding had
--   a free-text `state` and no disposition axis at all, so an open finding could silently ride
--   from one round to the next with no answer attached to it.
--
--   This delta makes the PR COMMENT the system of record: its body is preserved verbatim, its
--   provenance is recorded structurally, it is bound to an EXACT 40-char head SHA, and the
--   dispositions parsed out of it land on tower.finding where the next review round reads them
--   straight from the database.
--
-- APPLIED BY apply.mjs -> applyCommentSchema(); watcher.mjs also re-applies it on boot
-- (idempotent). Every statement is `if not exists` / guarded, safe to run repeatedly.
--
-- WHERE §3'S COLUMNS WENT. SQLite has no `alter table ... add column if not exists` and no
-- `alter table ... add constraint`, so the disposition columns and their four CHECKs are declared
-- inline on tower.finding in db/watcher_schema.sql (the file that creates that table), each
-- labelled as coming from here. THE CONSTRAINT NAMES AND THE ENFORCEMENT ARE UNCHANGED. §3 below
-- is retained in full because it is where the reasoning lives.
--
-- DEV/synthetic only. No live data, no credentials — no column here stores a secret.

-- --------------------------------------------------------------------------
-- 1) `tower.git_sha` — canonical head binding, enforced by the DATABASE.
--
--    Postgres carried this as a DOMAIN mirroring the estate's existing `ops.git_sha`
--    (db/migrations/001). SQLite has no domains, so the identical rule is a NAMED CHECK applied
--    to each column that used the domain — same name (`git_sha_canonical_chk`), same failure, so
--    the proofs match on the constraint name exactly as before. The encoding of the Tower
--    head-binding bug fix: lower-case, FULL 40 hex characters. A short (`abc1234`), upper-case or
--    padded head cannot be stored at all, so "bound to the exact head" is a structural fact
--    rather than a runtime `if` a caller can forget.
--
--    The regex `^[0-9a-f]{40}$` becomes `length(x) = 40 and x not glob '*[^0-9a-f]*'`. GLOB is
--    case-sensitive in SQLite, so an upper-case SHA is refused exactly as the domain refused it.
--
--    SCOPE — DELIBERATELY NARROW, DO NOT WIDEN (WO-OR-22 F3, ruled by Larry 2026-08-02):
--    applied ONLY to the columns below and to tower.finding.disposition_head_sha.
--    `tower.turn.head_sha` stays plain text and is NOT retrofitted, because the existing CI suite
--    deliberately seeds non-canonical heads ('aaaa1111bbbb2222' in T5, 'UNRESOLVABLE' in T6) to
--    exercise the fail-closed evidence path. Retrofitting it would break two passing tests, and
--    editing a passing test to fit a new constraint is exactly how a suite becomes decoration.
--    The resulting guarantee is therefore ONE-SIDED and is documented as such: the comment side is
--    canonical, the turn side is lax.
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- 2) TABLE tower.pr_comment — the ingested PR comment, body preserved.
--
--    One row per ingested comment. `body` is kept VERBATIM: the whole point is that the PR
--    becomes the system of record, so the artefact the human actually wrote is the durable
--    thing, not a summary of it. `source` + `comment_id` are what make an INGESTED COMMENT
--    and a HAND-TYPED CLAIM distinguishable in the data (see the finding provenance CHECK in
--    section 3 — the distinction is enforced, not merely conventional).
--
--    A comment REJECTED as stale is still persisted, with applied=false and a rejected_reason.
--    Recording the rejection is deliberate: a silently-dropped comment is indistinguishable
--    from one that never arrived, which is precisely the failure this seam exists to end.
--    applied=false rows are never read by the review path.
-- --------------------------------------------------------------------------
create table if not exists tower.pr_comment (
  id              text primary key default (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  turn_id         text references turn(id),         -- the turn this comment answers (null when unresolvable)
  source          text not null default 'github_pr_comment',
  repo            text not null,                    -- owner/name
  pr_number       integer not null,
  -- EXACT head the comment was written against. Was `tower.git_sha not null`; see §1.
  head_sha        text not null constraint git_sha_canonical_chk
                  check (length(head_sha) = 40 and head_sha not glob '*[^0-9a-f]*'),
  comment_id      integer not null,                 -- the provider's own comment id
  author          text not null,
  body            text not null,                    -- preserved VERBATIM
  received_at     text not null,                    -- when the provider says it was written
  ingested_at     text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  applied         integer not null default 0,       -- did its dispositions reach tower.finding?
  rejected_reason text,                             -- set iff applied = false and it was refused

  constraint pr_comment_source_chk check (source in ('github_pr_comment')),
  -- An unapplied comment must say WHY; an applied one must not carry a rejection. Keeps the
  -- audit trail honest in both directions.
  constraint pr_comment_rejection_chk
    check ((applied = 1 and rejected_reason is null)
        or (applied = 0 and rejected_reason is not null))
);

-- IDEMPOTENT INGEST: a redelivered provider comment cannot double-apply. Same discipline as
-- turn_session_turn_key_uniq (watcher_schema §4) and ftw.run_event's PRIMARY DEDUP.
create unique index if not exists tower.pr_comment_source_commentid_uniq
  on pr_comment (source, comment_id);

create index if not exists tower.pr_comment_pr_head_idx
  on pr_comment (repo, pr_number, head_sha);

-- --------------------------------------------------------------------------
-- 3) tower.finding — the DISPOSITION axis (additive, nullable, legacy-compatible).
--
--    DECLARED IN db/watcher_schema.sql (see the note in this file's header) — the reasoning
--    stays here, where it was written.
--
--    VOCABULARY: exactly the three literals already used by the estate's reviewer-classification
--    contract — review/reviewClassification.mjs:20 PRIOR_FINDING_STATUSES = addressed |
--    remains_open | unrelated. This is the PRIOR-FINDING axis: what a reviewer says about a
--    finding carried in from an earlier round.
--
--    !! DO NOT OVERLOAD, AND DO NOT IMPORT ops.required_disposition HERE !!
--    ops.finding carries a SEPARATE five-value MERGE-AUTHORITY axis (BLOCKS_CURRENT_MERGE …
--    NOTE_ONLY, migration 006), whose own header says "do NOT overload". Two different
--    questions, two different vocabularies. They have confusingly similar names; conflating
--    them would be a subtle and durable defect. This delta implements ONLY the prior-finding
--    axis, which is the one a PR comment actually answers.
--
--    All columns NULLABLE: a pre-existing finding is untouched and simply has no disposition
--    yet — which is exactly the state the review gate FAILS CLOSED on (see findings.mjs).
--    Representable-but-absent is intentional, same reasoning as 006's guarded CHECK.
--
--    The four CHECKs, by name and by job:
--      finding_disposition_vocab_chk       — off-vocabulary disposition refused.
--      finding_disposition_source_chk      — source is pr_comment | manual, nothing else.
--      finding_disposition_complete_chk    — a disposition must carry its source, its head and
--                                            its timestamp, or it is not decision-grade.
--      finding_disposition_provenance_chk  — a pr_comment-sourced disposition MUST name the
--                                            comment row it came from. That is what makes an
--                                            ingested disposition and a hand-typed one
--                                            distinguishable in the data.
--      finding_disposition_comment_fk      — and that named comment row must actually exist.
-- --------------------------------------------------------------------------
create index if not exists tower.finding_undisposed_open_idx
  on finding (build_ref) where state = 'open' and disposition is null;

-- finding_disposition_comment_fk — the named comment row must actually exist.
--
-- In Postgres this was `alter table tower.finding add constraint ... foreign key ...`. SQLite has
-- no ADD CONSTRAINT, and declaring it on tower.finding in db/watcher_schema.sql is not an option
-- either: SQLite resolves a foreign-key parent at WRITE time, so tower.finding would be unusable
-- until this file had also been applied. Enforced here instead, where both tables exist, by a
-- trigger pair carrying the constraint's own name — still the DATABASE refusing the write, not a
-- runtime `if` a caller can forget.
create trigger if not exists tower.finding_disposition_comment_fk_ins
before insert on finding
when new.disposition_comment_id is not null
begin
  select raise(ABORT, 'FOREIGN KEY constraint failed: finding_disposition_comment_fk')
   where not exists (select 1 from pr_comment where id = new.disposition_comment_id);
end;

create trigger if not exists tower.finding_disposition_comment_fk_upd
before update on finding
when new.disposition_comment_id is not null
begin
  select raise(ABORT, 'FOREIGN KEY constraint failed: finding_disposition_comment_fk')
   where not exists (select 1 from pr_comment where id = new.disposition_comment_id);
end;
