-- =====================================================================
-- BUILD-015 AsdAIr Stage 1 - migration 007: the 'rotate' directive
--
-- WHY: the planner can now rotate a variant week to week (planner.js
-- chooseRotatedVariant, fed by data.js loadLastOrder). But the INSTRUCTION to
-- rotate had nowhere to live: asdair.rules.directive was CHECK-constrained to
-- ('info','exclude','needs_decision','map'), so a rotation rule could not be
-- stored at all. The mechanism was live and unreachable - rotation could only
-- happen if a caller passed it in by hand, which is precisely the
-- session-resident behaviour this build exists to end.
--
-- The alternative - sniffing the word "rotate" out of rule_text prose - was
-- deliberately rejected. The planner's whole design forbids parsing prose;
-- directives are structured for exactly this reason.
--
-- WHAT THIS DOES NOT DECIDE. The household currently holds a REAL CONFLICT:
-- rules 23/24 map "sure male" to a FIXED variant, while rule_qa_log #5 says
-- ROTATE it. This migration makes the rotate instruction STORABLE; it does not
-- resolve that conflict and must not be read as resolving it. The planner
-- surfaces the clash as `fixed_variant_conflict` -> needs_decision -> a question
-- to Warwick. Widening the constraint is a schema capability, not an answer.
--
-- Rules of the road: PURE ASCII, no secrets, no rows, idempotent, safe to
-- re-run. Depends on 001_asdair_schema.sql.
-- =====================================================================

do $$
begin
  -- Idempotent: only rewrite the constraint if it does not already permit 'rotate'.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'asdair.rules'::regclass
      and conname  = 'rules_directive_check'
      and pg_get_constraintdef(oid) not like '%rotate%'
  ) then
    execute 'alter table asdair.rules drop constraint rules_directive_check';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'asdair.rules'::regclass and conname = 'rules_directive_check'
  ) then
    execute 'alter table asdair.rules add constraint rules_directive_check '
         || 'check (directive in (''info'',''exclude'',''needs_decision'',''map'',''rotate''))';
  end if;
end $$;

-- A 'rotate' rule must say WHAT it rotates, exactly as 'map'/'exclude' must.
-- The pre-existing rules_directive_target_check already enforces
-- "directive = 'info' OR a match_term/match_category is present", so a rotate
-- rule with no target is already refused. No extra constraint is needed here;
-- this comment records that the check was considered, not forgotten.
