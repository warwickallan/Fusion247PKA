-- WO-OR-22 Tower supervisor loop — the PR-COMMENT ⇄ TOWER SEAM (idempotent schema delta on
-- top of db/loop_schema.sql + db/watcher_schema.sql).
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
-- DEV/synthetic only. No live data, no credentials — no column here stores a secret.

-- --------------------------------------------------------------------------
-- 1) DOMAIN tower.git_sha — canonical head binding, enforced by the DATABASE.
--
--    Mirrors the estate's existing `ops.git_sha` (db/migrations/001) — the encoding of the
--    Tower head-binding bug fix: lower-case, FULL 40 hex characters. A short (`abc1234`),
--    upper-case or padded head cannot be stored at all, so "bound to the exact head" is a
--    structural fact rather than a runtime `if` a caller can forget.
--
--    SCOPE — DELIBERATELY NARROW, DO NOT WIDEN (WO-OR-22 F3, ruled by Larry 2026-08-02):
--    this domain is applied ONLY to the NEW columns below. `tower.turn.head_sha` stays plain
--    `text` and is NOT retrofitted, because the existing CI suite deliberately seeds
--    non-canonical heads ('aaaa1111bbbb2222' in T5, 'UNRESOLVABLE' in T6) to exercise the
--    fail-closed evidence path. Retrofitting the domain onto that column would break two
--    passing tests, and editing a passing test to fit a new constraint is exactly how a suite
--    becomes decoration. The resulting guarantee is therefore ONE-SIDED and is documented as
--    such: the comment side is canonical, the turn side is lax.
-- --------------------------------------------------------------------------
do $$ begin
  create domain tower.git_sha as text
    constraint git_sha_canonical_chk check (value ~ '^[0-9a-f]{40}$');
exception when duplicate_object then null; end $$;

comment on domain tower.git_sha is
  'A canonical git commit SHA: lower-case, full 40 hex chars. Mirrors ops.git_sha (001). '
  'Applied to the WO-OR-22 comment-seam columns ONLY — tower.turn.head_sha is intentionally '
  'NOT retrofitted (existing tests seed non-canonical heads on purpose). DO NOT WIDEN without '
  'first fixing those tests properly.';

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
  id              uuid primary key default gen_random_uuid(),
  turn_id         uuid references tower.turn(id),   -- the turn this comment answers (null when unresolvable)
  source          text not null default 'github_pr_comment',
  repo            text not null,                    -- owner/name
  pr_number       integer not null,
  head_sha        tower.git_sha not null,           -- EXACT head the comment was written against
  comment_id      bigint not null,                  -- the provider's own comment id
  author          text not null,
  body            text not null,                    -- preserved VERBATIM
  received_at     timestamptz not null,             -- when the provider says it was written
  ingested_at     timestamptz not null default now(),
  applied         boolean not null default false,   -- did its dispositions reach tower.finding?
  rejected_reason text                              -- set iff applied = false and it was refused
);

-- IDEMPOTENT INGEST: a redelivered provider comment cannot double-apply. Same discipline as
-- turn_session_turn_key_uniq (watcher_schema §8) and ftw.run_event's PRIMARY DEDUP.
create unique index if not exists pr_comment_source_commentid_uniq
  on tower.pr_comment (source, comment_id);

create index if not exists pr_comment_pr_head_idx
  on tower.pr_comment (repo, pr_number, head_sha);

do $$ begin
  alter table tower.pr_comment
    add constraint pr_comment_source_chk
    check (source in ('github_pr_comment'));
exception when duplicate_object then null; end $$;

-- An unapplied comment must say WHY; an applied one must not carry a rejection. Keeps the
-- audit trail honest in both directions.
do $$ begin
  alter table tower.pr_comment
    add constraint pr_comment_rejection_chk
    check ((applied = true and rejected_reason is null)
        or (applied = false and rejected_reason is not null));
exception when duplicate_object then null; end $$;

comment on table tower.pr_comment is
  'WO-OR-22: an ingested PR comment, body preserved verbatim, bound to an exact 40-char head. '
  'The PR is the system of record; this is its durable landing place. A stale comment is stored '
  'with applied=false + rejected_reason and is NEVER read by the review path.';
comment on column tower.pr_comment.head_sha is
  'The EXACT head the comment author was reviewing, as declared in the comment body. Canonical '
  'by domain constraint. Compared against the turn head at ingest to reject a stale comment.';

-- --------------------------------------------------------------------------
-- 3) tower.finding — the DISPOSITION axis (additive, nullable, legacy-compatible).
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
-- --------------------------------------------------------------------------
alter table tower.finding add column if not exists disposition            text;
alter table tower.finding add column if not exists disposition_rationale  text;
alter table tower.finding add column if not exists disposition_source     text;
alter table tower.finding add column if not exists disposition_comment_id uuid;
alter table tower.finding add column if not exists disposition_head_sha   tower.git_sha;
alter table tower.finding add column if not exists disposition_at         timestamptz;

do $$ begin
  alter table tower.finding
    add constraint finding_disposition_vocab_chk
    check (disposition is null or disposition in ('addressed', 'remains_open', 'unrelated'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table tower.finding
    add constraint finding_disposition_source_chk
    check (disposition_source is null or disposition_source in ('pr_comment', 'manual'));
exception when duplicate_object then null; end $$;

-- A disposition is only decision-grade if we know WHERE it came from and WHICH HEAD it was
-- judged at. Without the head binding a disposition given three heads ago would silently count
-- for today's round — the exact "stale answer applied to a newer head" failure.
do $$ begin
  alter table tower.finding
    add constraint finding_disposition_complete_chk
    check (disposition is null
        or (disposition_source is not null
            and disposition_head_sha is not null
            and disposition_at is not null));
exception when duplicate_object then null; end $$;

-- THE PROVENANCE GUARANTEE: a disposition claiming to come from a PR comment must name the
-- comment row it came from. This is what makes "ingested from a PR comment" and "hand-typed"
-- structurally distinguishable rather than a matter of trusting a label.
do $$ begin
  alter table tower.finding
    add constraint finding_disposition_provenance_chk
    check (disposition_source is distinct from 'pr_comment'
        or disposition_comment_id is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table tower.finding
    add constraint finding_disposition_comment_fk
    foreign key (disposition_comment_id) references tower.pr_comment(id);
exception when duplicate_object then null; end $$;

create index if not exists finding_undisposed_open_idx
  on tower.finding (build_ref) where state = 'open' and disposition is null;

comment on column tower.finding.disposition is
  'PRIOR-FINDING axis (addressed|remains_open|unrelated) — verbatim from '
  'review/reviewClassification.mjs:20 PRIOR_FINDING_STATUSES. NOT the ops.required_disposition '
  'merge-authority axis (006), which must not be imported here. NULL = undisposed, which the '
  'review gate FAILS CLOSED on rather than carrying silently.';
comment on column tower.finding.disposition_source is
  'pr_comment | manual. A pr_comment disposition MUST name its comment row '
  '(finding_disposition_provenance_chk) — that is what makes an ingested disposition and a '
  'hand-typed one distinguishable in the data.';
comment on column tower.finding.disposition_head_sha is
  'The EXACT head the disposition was judged at. The review gate re-checks this against the '
  'round head, so a disposition recorded at an older head cannot be reused at a newer one.';
