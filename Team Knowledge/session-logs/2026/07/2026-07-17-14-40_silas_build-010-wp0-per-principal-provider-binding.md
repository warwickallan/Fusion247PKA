---
agent_id: silas
session_id: build-010-wp0-per-principal-provider-binding
timestamp: 2026-07-17T14:40:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-010 WP0 — close F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL

Worktree `C:\Fusion247PKA-b010`, branch `build-010/wp0-fusion-tower` (from `b18341d`).
Commits `48679ea` (migration 0002 + static guards) and `6832a2e` (real-Postgres
proofs). Not pushed — Larry pushes. Live Supabase untouched.

## The defect

Migration 0001's `ftw.agent_identity_provider_honest_chk` enforced only a provider
VOCABULARY — `check (provider in {anthropic-claude-code, openai-codex, human,
fusion-tower})`. It did not bind each principal to its own provider, so a
cross-labelled row (e.g. `gpt_codex` with provider `anthropic-claude-code`) passed
the CHECK. `src/core/envelope.js` (HONEST_PROVIDER) pins the binding in app code,
but the DB invariant could drift.

## What I did

- **Migration path (Larry's decision): ADD `0002`, keep `0001` immutable.** New
  `services/fusion-tower/migrations/0002_wp0_identity_provider_binding.sql`: house-style
  provenance header (cites the finding id), DO-NOT-WEAKEN security block, explicit
  constraint name. Drops `agent_identity_provider_honest_chk` and adds
  `agent_identity_provider_binding_chk` — an EXACT per-principal binding CHECK, total
  over the four-value `ftw.principal` enum. Idempotent-safe (`drop constraint if
  exists` + pg_constraint-guarded add). No re-seed; 0001's honest seed rows satisfy
  the new CHECK (validated at ADD CONSTRAINT time).
- **Static guards:** new `test/migrations.test.js` (no prior static-guard file
  existed, so nothing weakened). Asserts the per-principal binding statically (all
  four exact pairs; predicates on `principal`, not a vocabulary-only `provider IN`),
  that 0002 does not weaken RLS, and 0001's immutable shape (RLS enabled on all four
  tables, service_role-only, honest seed).
- **Real-Postgres proofs:** extended `postgresStore.integration.test.js` — migration
  chain now applies 0001 THEN 0002 — with 5 new groups: valid pairs insert (15);
  cross pairs rejected (16); invalid provider rejected (17); UPDATE drift rejected
  (18); RLS regression intact (19).

## The 0002 constraint (exact)

```sql
alter table ftw.agent_identity
  drop constraint if exists agent_identity_provider_honest_chk;
-- guarded add (idempotent):
alter table ftw.agent_identity
  add constraint agent_identity_provider_binding_chk
  check (
       (principal = 'larry'     and provider = 'anthropic-claude-code')
    or (principal = 'gpt_codex' and provider = 'openai-codex')
    or (principal = 'warwick'   and provider = 'human')
    or (principal = 'tower'     and provider = 'fusion-tower')
  );
```

## Verification

- No-DB `node --test`: 124 tests, 105 pass, 0 fail, 19 skipped (DB-gated). Static
  guards green.
- Real-Postgres: throwaway scoop cluster (PG 17.4, fresh data dir, port 54335), applied
  0001->0002, `postgresStore.integration.test.js` = 19/19 pass, 0 fail (original 14 on
  the 0001->0002 chain + new groups 15-19). Cluster torn down.
- Secret scan: clean — 380 tracked files, 0 secret values.

## Verdict

The honest per-principal binding is now DB-ENFORCED: no principal can hold another
principal's provider, no invalid provider is accepted, and no UPDATE can drift an
identity to a dishonest provider — proven on real Postgres and guarded statically.
0001 remains immutable. RLS and all other constraints unweakened.
