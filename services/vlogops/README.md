# VlogOps — the durable Content Seed store

**BUILD-006 Phase 1.** A seed comes in by one of three human-initiated routes and lands in
Postgres in a form that cannot later be argued with.

This phase delivers a **library, a migration and an intake CLI**. There is no long-running
service yet, no Cockpit UI, and no Source Compiler — those are Phases 2 to 7.

## What "cannot later be argued with" means, concretely

| Property | How it is held |
|---|---|
| **Identity is content-derived** | `seed_id` is sha256 over a canonical, sorted manifest. No row id, no clock, no insertion order, no in-process state contributes to it. |
| **Identity is checkable** | The manifest that was hashed is stored beside the identity. Anyone can recompute it from the row rather than trusting the writer. |
| **The same source twice yields one seed** | `ON CONFLICT DO NOTHING` on the primary key. The database decides, not an in-memory set. |
| **Snapshots are immutable** | A trigger refuses UPDATE and DELETE. The rule survives a future caller who has forgotten it. |
| **A later source failure cannot rewrite history** | The bytes are stored at intake and the integrity check reads only stored bytes. It still answers after the original is edited or deleted. |
| **An abrupt kill has no third state** | Seed, snapshots and ledger row commit in one transaction. Killed before COMMIT: nothing. After: one complete seed. |
| **The store touches nothing else** | One namespace, no grants, RLS untouched. Proven by applying over stub neighbour schemas and asserting they are unchanged. |

## Why there is no job queue

The map's §6 F4 says to reuse `services/control-plane/worker` rather than build a second
framework. That instruction is **deferred to Phase 6, not discarded** — see the preflight
census §0 for the three reasons it cannot be followed at Phase 1, of which the decisive one
is that Phase 1's gate is a durable state machine, not a worker pool.

Correctness under an abrupt kill is carried by the **single-transaction seal** in
`src/intake.mjs`. Because a partial seed is not representable, there is nothing for a
reconciler to reconcile — so no lease, no claim, no visibility timeout and no worker pool
are built. The `intake_run` table is an append-only audit trail, not a queue.

## Identity, in one paragraph

`seed_id = sha256(canonical_json({ v, route, angle, members: [{source_ref, content_sha256}…] }))`
with members sorted by `source_ref`, so discovery order cannot change the answer. The angle
participates for the two routes that require one: the same words taken with a different
question are honestly a different seed. `content_sha256` is the hash of **exactly the bytes
stored** — normalisation happens on the way in, never on the way out, which is what lets
re-hashing a stored snapshot be a real integrity check instead of a restatement of the same
assumption.

`selection_key` hashes the **request** rather than the result, and `supersedes` is a nullable
self-link. **Both are recorded and nothing reads them.** They exist so a later phase that
needs versioning is not forced to guess retroactively which seeds were re-takes of the same
selection. No supersession logic, history walker or reconciliation pass exists at this phase,
by explicit instruction.

## The three routes

**Route 1 — existing records.** A date or period; the intake compiles the *smallest
sufficient* evidence bundle. The rule is explicit in `src/routes/records.mjs`: take the best
candidate from every non-empty class first, then fill by rank until an artefact or byte
budget is reached; both budgets are module constants that no environment variable can widen.

`Deliverables/` and git history are **first-class sources, not fallback.** The map's §6 F3
recorded on 2026-08-03 that the session-log stream was dry; that was true when written and is
no longer true of August 2026. **The real property is intermittence, not dryness** — and on
any single window intermittence is indistinguishable from absence, so a session-log-first
compiler would work perfectly on the windows that happen to have logs and return nothing on
the ones that do not. The fixture window is **2026-08-05**: zero session logs, 164 commits,
6 deliverables.

**Route 2 — promotion.** Five fields or a rejection: source snapshot, provenance, privacy
state, origin, proposed angle. Missing any one is a rejected promotion, never a partial seed
— enforced in the route, in `validateSeedRequest`, and as a CHECK constraint.

**Route 3 — Warwick-supplied.** Free text, a pasted conversation or a document, **plus the
angle**. The angle is required input and is **never inferred from the text**; there is no
default and no best-guess path anywhere in the code.

## Layout

```
db/001_vlogops_content_seed.sql   the schema — additive, idempotent, forward-only
db/teardown.sql                   reverses it, and nothing else
src/config.mjs                    aggregated startup validation
src/db.mjs                        lazy pool + the single-transaction seal
src/identity.mjs                  canonical manifest, hashing, normalisation
src/snapshot.mjs                  capture, provenance, integrity verification
src/intake.mjs                    the seal all three routes converge on
src/routes/{records,promotion,supplied}.mjs
bin/vlogops-intake.mjs            the CLI
test/                             the proofs, and the runner that cannot go green on nothing
```

## Running it

```bash
npm install
npm test                                   # provisions a disposable Postgres and runs every proof

export VLOGOPS_DB_URL=postgres://…
node bin/vlogops-intake.mjs records  --from 2026-08-05 --to 2026-08-05
node bin/vlogops-intake.mjs promote  --origin "<output>" --angle "<angle>" --text "<text>"
node bin/vlogops-intake.mjs supplied --angle "<angle>" --file notes.md
```

`npm test` needs `initdb`, `pg_ctl`, `postgres` and `createdb` on PATH (or `POSTGRES_BIN`
pointing at the Postgres bin directory). It never touches an existing database: it creates
its own throwaway cluster, uses it, and deletes it. Set `REUSE_DATABASE_URL=1` to run against
a pre-existing `$DATABASE_URL` instead — that is the CI service-container path.

## Applying the migration to the managed project

**Not from here.** This service is proven entirely against a disposable local cluster and
never connects to the managed project. Applying `db/001_*.sql` there is a live action that
belongs to Larry, after review. The migration is additive, issues no grants, and touches no
other namespace — and `db/teardown.sql` reverses exactly what it added.

## Operations

See [RUNBOOK.md](RUNBOOK.md).
