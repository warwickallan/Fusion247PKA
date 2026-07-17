---
build: BUILD-010
component: Fusion Tower / Governance Mode
wp: WP0
artifact: wp0-delta-review-identity-binding
reviewer: vex
review_method: re-execution (ran no-DB suite + secret scan; CHECK totality verified statically; integration assertions read line-by-line; throwaway Postgres attempted)
scope: BOUNDED single-fix delta — closes F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL
delta_base: b18341d
delta_commits: 48679ea, 6832a2e
worktree: C:\Fusion247PKA-b010
branch: build-010/wp0-fusion-tower
date: 2026-07-17
verdict: GREEN
critical: 0
high: 0
medium: 0
low: 0
info: 3
medium_closed: yes
---

# Fusion Tower — WP0 Delta Review: honest per-principal provider binding (Vex)

Parent build: [[BUILD-010-fusion-tower]]
Prior baseline: `Security/wp0-security-review-2026-07-17.md` (GREEN-WITH-CONDITIONS)

## Verdict — GREEN

Bounded delta only. The single correction that closes the Codex MEDIUM
`F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL` is sound and introduces no
regression. It ONLY tightens the honest-identity invariant. Reviewed by
re-execution, not trust.

### Severity counts (this delta)
- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0
- INFO: 3 (positives)

## MEDIUM — CLOSED (genuinely, not cosmetically)

`services/fusion-tower/migrations/0002_wp0_identity_provider_binding.sql` drops
the vocabulary-only `agent_identity_provider_honest_chk` and adds
`agent_identity_provider_binding_chk`, an EXACT four-pair disjunction:
larry->anthropic-claude-code, gpt_codex->openai-codex, warwick->human,
tower->fusion-tower.

Totality proof (static, airtight): in 0001 `principal ftw.principal NOT NULL`
(PK) is a CLOSED enum of exactly four values and `provider text NOT NULL`. Every
principal value is covered by exactly one disjunct, so any row must carry its
own honest provider; no NULL escape exists (both columns NOT NULL, so the CHECK
cannot evaluate to unknown/pass). Therefore every cross-pair
(e.g. gpt_codex/anthropic-claude-code, larry/openai-codex) and every invalid
provider (e.g. xai-grok) is rejected. The defect — a cross-labelled identity
passing the old vocabulary CHECK — is eliminated at the DB layer, matching the
code-level pin in src/core/envelope.js HONEST_PROVIDER.

## No weakening — every prior control intact

- 0001 is UNCHANGED by this delta (git diff b18341d..6832a2e touches only the
  three named files; 0001 SQL not in the diff). It stays immutable.
- 0002 does ONLY the guarded drop + guarded add; it touches no RLS statement, no
  grant, no policy, and no other constraint. RLS stays ENABLED deny-by-default on
  all four ftw tables; service_role-only grants + policies intact;
  anon/authenticated still receive neither grant nor policy.
- The honest seed rows from 0001 satisfy the new CHECK by construction (the four
  seeded pairs ARE the four honest bindings; Postgres validates existing rows at
  ADD CONSTRAINT time).
- Code-level honest-label pin (envelope.js) and the no-autonomous-merge invariant
  (governance_run.no_autonomous_merge default true, in immutable 0001) are
  untouched by this delta.

## Controls are genuine (spot-checked, not trusted)

- Static guards `test/migrations.test.js`: assert each exact pair is present in
  0002, that it predicates on `principal` (not a bare provider-IN list — anti-drift
  to the defective form), that 0001 keeps RLS/service_role-only/honest seed, and
  that 0002 carries no `disable row level security` and no anon/authenticated
  grant/policy. They assert what they claim.
- Real-Postgres proofs `test/postgresStore.integration.test.js` (MIGRATIONS chain
  updated to apply 0001 THEN 0002): group 15 (all valid pairs insert), 16 (six
  cross-pairs rejected against `agent_identity_provider_binding_chk`), 17 (invalid
  provider rejected), 18 (UPDATE drift of larry to a dishonest provider rejected,
  honest value unchanged), 19 (RLS still enabled on all four tables; anon denied,
  service_role permitted after 0002). A cross-pair really fails and an update-drift
  really fails — the assertions bind on the named constraint / a permission-denied.

## Idempotency / safety of 0002

Sound. The drop is `drop constraint if exists`; the add is wrapped in a
`pg_constraint` existence guard on the exact conname + conrelid, so re-applying
0002 on an already-migrated DB is a no-op. Apply order is fixed 0001 THEN 0002.

## Re-execution evidence

- No-DB suite (`node --test`, no DATABASE_URL): 124 tests, 105 pass, 0 fail, 19
  DB-gated skips (incl. groups 15-19). Static migration guards ran and passed.
- Secret scan over both delta commits (48679ea, 6832a2e): 0 secrets. The only
  key/token tokens present are pointer/label references (signing_key_ref pointer,
  token_budget counters, "NEVER a secret value" prose) — no value ever stored.
- Behavioural Postgres confirmation attempted on a throwaway cluster (fresh port
  54329, isolated PGDATA): the local scoop Postgres 17.4 substrate failed to boot
  under this sandbox (Windows exception 0xC0000142, startup-process DLL init) — an
  environmental fault, NOT a migration defect. CHECK totality is proven statically
  and the integration assertions are read line-by-line, which the delta scope
  permits in lieu of standing up Postgres. Throwaway cluster fully removed.

## Note

No prior control regressed. This is a bounded single-fix delta; the parent
GREEN-WITH-CONDITIONS baseline (two latent live-adapter conditions) stands
unchanged and is not re-litigated here.
