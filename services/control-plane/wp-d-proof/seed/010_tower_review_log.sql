-- =============================================================================
-- BUILD-014 WP-D increment 1 — SYNTHETIC Tower review log seed          (author: mack)
--
-- Populates the ops.* control-plane tables with a small, REPRESENTATIVE, entirely
-- SYNTHETIC record of the multi-model review interaction (Codex correction-loop +
-- Fable cold-final + Larry's summaries to Warwick) for a couple of builds.
--
-- CAPTURE SCOPE (per the ledger scope decision): the durable record is
--   (1) Larry's summaries to Warwick, and (2) the Tower review interaction
--       (the Codex / Larry / Fable exchange beats + verdicts).
--   NOT the running blow-by-blow commentary.
--
-- EVERYTHING HERE IS SYNTHETIC / DEV DATA. The commit SHAs are fabricated 40-char
-- hex placeholders, not real repository commits. No real personal/entrusted data.
--
-- This file is applied by wp-d-proof/provision.mjs AFTER 001 + 002 against a fresh,
-- disposable, localhost-only Postgres cluster. It is never applied to prod.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Synthetic canonical heads (40-char lower-case hex — pass the ops.git_sha domain).
-- ---------------------------------------------------------------------------
-- WPA_HEAD1 (first review round)  09efabd10a0a0a0ac0ffee001122334455667788
-- WPA_HEAD2 (post-correction)     09efabd20a0a0a0ac0ffee001122334455667788
-- WPC_HEAD                        a6b64dd0feedface00112233445566778899aabb
-- T010_HEAD                       4dc368d0dead0bee00112233445566778899aabb

begin;

-- ---------------------------------------------------------------------------
-- Builds
-- ---------------------------------------------------------------------------
insert into ops.build (build_ref, repo, title, classification) values
  ('BUILD-014', 'warwickallan/Fusion247PKA', 'Fusion247 Control Plane (SYNTHETIC)', 'internal'),
  ('BUILD-010', 'warwickallan/Fusion247PKA', 'Tower reliability hotfix (SYNTHETIC)', 'internal');

-- ---------------------------------------------------------------------------
-- Agent runs (minimal working-span records)
-- ---------------------------------------------------------------------------
insert into ops.agent_run (build_id, principal, status)
select id, p::ops.principal, 'ended'
from ops.build, (values ('larry'), ('gpt_codex'), ('fable')) as r(p)
where build_ref = 'BUILD-014';

-- ---------------------------------------------------------------------------
-- Checkpoints (one logical checkpoint ref bound to an EXACT head)
-- ---------------------------------------------------------------------------
insert into ops.checkpoint (build_id, checkpoint_ref, head_sha, branch, brief_ref)
select id, 'WP-A', '09efabd20a0a0a0ac0ffee001122334455667788', 'build-014/wp-a-min-schema', 'WP-A brief'
from ops.build where build_ref = 'BUILD-014';

insert into ops.checkpoint (build_id, checkpoint_ref, head_sha, branch, brief_ref)
select id, 'WP-C', 'a6b64dd0feedface00112233445566778899aabb', 'build-014/wp-c-tower-on-baton', 'WP-C brief'
from ops.build where build_ref = 'BUILD-014';

insert into ops.checkpoint (build_id, checkpoint_ref, head_sha, branch, brief_ref)
select id, 'tower-hotfix', '4dc368d0dead0bee00112233445566778899aabb', 'build-010/tower-reliability-hotfix', 'BUILD-010 brief'
from ops.build where build_ref = 'BUILD-010';

-- ---------------------------------------------------------------------------
-- Verdicts — the review interaction, as head-bound evidence.
--
-- WP-A: Codex correction-loop opens with request_changes, then (after the fix) is
--       superseded by an approve at the SAME head; Fable cold-final approves. This is
--       the supersede-then-insert correction loop the schema enforces.
-- WP-C: converged in one round — Codex approve + Fable approve.
-- BUILD-010: paused/hotfix — Codex approve but Fable cold-final request_changes
--            (a genuine NOT-ready state; shows the gate withholding readiness).
-- ---------------------------------------------------------------------------

-- WP-A — Codex correction loop (request_changes -> superseded -> approve)
insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
select c.id, c.head_sha, 'gpt_codex', 'correction_loop', 'request_changes', 'qa-skill:v1:codex:r1'
from ops.checkpoint c join ops.build b on b.id = c.build_id
where b.build_ref = 'BUILD-014' and c.checkpoint_ref = 'WP-A';

update ops.verdict set state = 'superseded'
where reviewer = 'gpt_codex' and verdict_type = 'correction_loop' and verdict = 'request_changes'
  and checkpoint_id = (select c.id from ops.checkpoint c join ops.build b on b.id = c.build_id
                       where b.build_ref = 'BUILD-014' and c.checkpoint_ref = 'WP-A');

insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
select c.id, c.head_sha, 'gpt_codex', 'correction_loop', 'approve', 'qa-skill:v1:codex:r5'
from ops.checkpoint c join ops.build b on b.id = c.build_id
where b.build_ref = 'BUILD-014' and c.checkpoint_ref = 'WP-A';

-- WP-A — Fable cold-final approve
insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
select c.id, c.head_sha, 'fable', 'cold_final', 'approve', 'qa-skill:v1:fable:final'
from ops.checkpoint c join ops.build b on b.id = c.build_id
where b.build_ref = 'BUILD-014' and c.checkpoint_ref = 'WP-A';

-- WP-C — one-round convergence: Codex approve + Fable approve
insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
select c.id, c.head_sha, 'gpt_codex', 'correction_loop', 'approve', 'qa-skill:v1:codex:r1'
from ops.checkpoint c join ops.build b on b.id = c.build_id
where b.build_ref = 'BUILD-014' and c.checkpoint_ref = 'WP-C';

insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
select c.id, c.head_sha, 'fable', 'cold_final', 'approve', 'qa-skill:v1:fable:final'
from ops.checkpoint c join ops.build b on b.id = c.build_id
where b.build_ref = 'BUILD-014' and c.checkpoint_ref = 'WP-C';

-- BUILD-010 — Codex approve, Fable withholds (request_changes) => NOT merge-ready
insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
select c.id, c.head_sha, 'gpt_codex', 'correction_loop', 'approve', 'qa-skill:v1:codex:r2'
from ops.checkpoint c join ops.build b on b.id = c.build_id
where b.build_ref = 'BUILD-010' and c.checkpoint_ref = 'tower-hotfix';

insert into ops.verdict (checkpoint_id, reviewed_commit_sha, reviewer, verdict_type, verdict, prompt_fingerprint)
select c.id, c.head_sha, 'fable', 'cold_final', 'request_changes', 'qa-skill:v1:fable:final'
from ops.checkpoint c join ops.build b on b.id = c.build_id
where b.build_ref = 'BUILD-010' and c.checkpoint_ref = 'tower-hotfix';

-- ---------------------------------------------------------------------------
-- Agent events — the append-only "Tower conversations" beats + Larry's summaries.
-- occurred_at is staggered so the timeline reads in order. payload holds a SANITISED
-- one-line summary pointer only (never running commentary, never secrets).
-- ---------------------------------------------------------------------------
insert into ops.agent_event (build_id, delivery_key, event_kind, actor, payload_hash, payload, classification, occurred_at)
select b.id, e.delivery_key, e.event_kind, e.actor::ops.principal,
       md5(e.summary), jsonb_build_object('summary', e.summary, 'checkpoint_ref', e.checkpoint_ref),
       e.classification::ops.data_classification, now() - (e.mins_ago || ' minutes')::interval
from ops.build b
join (values
  -- (delivery_key, event_kind, actor, summary, checkpoint_ref, classification, mins_ago)
  ('BUILD-014','evt-014-01','summary.to_warwick','larry','WP-A built: minimum Phase-0 schema — typed SHA binding, append-only events, dual-gate. Ready for review.','WP-A','internal',600),
  ('BUILD-014','evt-014-02','review.posted','gpt_codex','Codex correction-loop r1: REQUEST_CHANGES — active-verdict uniqueness must drop active_generation from the key; readiness view must be robust.','WP-A','internal',560),
  ('BUILD-014','evt-014-03','review.relayed','larry','Relayed Codex r1 findings; applying fixes F1-F15 and re-staging at a new head.','WP-A','internal',540),
  ('BUILD-014','evt-014-04','review.posted','gpt_codex','Codex correction-loop r5: APPROVE — default-deny merge_gate immutability confirmed; 25/25 proofs executed on real Postgres.','WP-A','internal',120),
  ('BUILD-014','evt-014-05','review.posted','fable','Fable cold-final: APPROVE — adversarial probes on head-binding + evidence guards pass; merge-ready.','WP-A','internal',110),
  ('BUILD-014','evt-014-06','summary.to_warwick','larry','WP-A merge-ready: both reviewers approve at the same head, CI green on real Postgres db-proofs. Your merge call.','WP-A','internal',100),
  ('BUILD-014','evt-014-07','summary.to_warwick','larry','WP-C built: Tower on Supabase + git — GitHub ingress + Fusion policy gate + ported Codex/Fable adapters on the WP-B baton.','WP-C','internal',80),
  ('BUILD-014','evt-014-08','review.posted','gpt_codex','Codex correction-loop: APPROVE — WP-C converged in one round; RCA defaults baked into round 1 paid off.','WP-C','internal',60),
  ('BUILD-014','evt-014-09','review.posted','fable','Fable cold-final: APPROVE — no wrong-head commit path; merge-ready.','WP-C','internal',55),
  ('BUILD-014','evt-014-10','summary.to_warwick','larry','WP-C merge-ready in a single round. Your merge call.','WP-C','internal',50),
  ('BUILD-010','evt-010-01','summary.to_warwick','larry','Tower reliability hotfix staged; head-binding canonicalised at the boundary.','tower-hotfix','internal',300),
  ('BUILD-010','evt-010-02','review.posted','gpt_codex','Codex correction-loop: APPROVE — gate sound, residuals fail-safe.','tower-hotfix','internal',260),
  ('BUILD-010','evt-010-03','review.posted','fable','Fable cold-final: REQUEST_CHANGES — fold residuals into records-architecture before proceeding; PAUSE.','tower-hotfix','internal',250),
  ('BUILD-010','evt-010-04','summary.to_warwick','larry','Tower hotfix PAUSED at the hotfix head — reviewers split, holding for records-architecture fold.','tower-hotfix','internal',240)
) as e(build_ref, delivery_key, event_kind, actor, summary, checkpoint_ref, classification, mins_ago)
  on e.build_ref = b.build_ref;

commit;
