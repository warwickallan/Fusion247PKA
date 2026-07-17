-- =============================================================================
-- BUILD-010 WP0 — Fusion Tower control-plane, delta migration
-- Migration: 0002_wp0_identity_provider_binding                 (author: silas)
--
-- PROVENANCE — closes a Tower-owned Codex review finding:
--   Finding id: F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL  (severity: MEDIUM)
--   Defect:  migration 0001's `agent_identity_provider_honest_chk` enforced only a
--            provider VOCABULARY — check (provider in {anthropic-claude-code,
--            openai-codex, human, fusion-tower}). It did NOT bind each PRINCIPAL to
--            its own honest provider. A row could therefore store
--            (principal='gpt_codex', provider='anthropic-claude-code') — a
--            cross-labelled identity — and still pass the CHECK. The application
--            layer (src/core/envelope.js HONEST_PROVIDER) pins the per-principal
--            binding, but the DB invariant could drift out from under it.
--   Fix:     replace the vocabulary-only CHECK with an EXACT per-principal binding
--            CHECK. Because ftw.principal is a closed enum of exactly four values
--            (larry, gpt_codex, warwick, tower), the four-pair disjunction below is
--            TOTAL: every valid principal has exactly one honest provider, and
--            every cross-pair and every invalid provider is rejected.
--
-- WHY A NEW MIGRATION (not an edit to 0001):
--   0001 is committed, Vex-reviewed, and part of the WP0 proof history — it is
--   IMMUTABLE. This discrete 0002 delta is also the surface the upcoming Codex
--   re-review inspects. Apply order is always 0001 THEN 0002 on a clean DB.
--
-- HONEST BINDINGS ENFORCED (the ONLY rows agent_identity may hold):
--   larry     -> anthropic-claude-code
--   gpt_codex -> openai-codex        (NEVER 'anthropic-claude-code', NEVER 'xai-grok')
--   warwick   -> human
--   tower     -> fusion-tower
--
-- SEED IMPACT: none. 0001 already seeds exactly these four honest pairs; they
-- satisfy the new CHECK by construction (verified at ADD CONSTRAINT time — Postgres
-- validates existing rows). No re-seed here.
--
-- !! SECURITY GATE (Vex) — DO NOT WEAKEN !!
-- This migration ONLY TIGHTENS the honest-identity invariant. It does NOT touch
-- RLS, grants, policies, or any other constraint. RLS remains ENABLED
-- deny-by-default on every ftw table; `service_role` stays the only principal with
-- a grant + policy; `anon`/`authenticated` remain denied by both the privilege
-- check and RLS. Do NOT relax the binding back to a vocabulary-only CHECK, do NOT
-- drop this constraint without an equal-or-stronger replacement, do NOT add a
-- cross-pair, and do NOT disable RLS or store a secret value.
-- =============================================================================

-- Drop the vocabulary-only CHECK from 0001. `if exists` keeps 0002 re-runnable and
-- tolerant of a DB where a prior 0002 already replaced it.
alter table ftw.agent_identity
  drop constraint if exists agent_identity_provider_honest_chk;

-- Add the EXACT per-principal binding CHECK. Explicitly named
-- `agent_identity_provider_binding_chk`. Guarded by a pg_constraint existence
-- check so re-applying 0002 on an already-migrated DB is a no-op (ADD CONSTRAINT is
-- not natively idempotent). The four-pair disjunction is total over the principal
-- enum, so it rejects every cross-pair AND every invalid provider value.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_identity_provider_binding_chk'
      and conrelid = 'ftw.agent_identity'::regclass
  ) then
    alter table ftw.agent_identity
      add constraint agent_identity_provider_binding_chk
      check (
             (principal = 'larry'     and provider = 'anthropic-claude-code')
          or (principal = 'gpt_codex' and provider = 'openai-codex')
          or (principal = 'warwick'   and provider = 'human')
          or (principal = 'tower'     and provider = 'fusion-tower')
      );
  end if;
end
$$;

comment on constraint agent_identity_provider_binding_chk on ftw.agent_identity is
  'Honest per-principal binding (closes F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-'
  'PRINCIPAL). Each principal is bound to its OWN honest provider; every cross-pair '
  'and every invalid provider is rejected. Total over the ftw.principal enum. '
  'DO NOT WEAKEN back to a vocabulary-only (provider IN (...)) CHECK.';
