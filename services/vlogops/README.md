# VlogOps — the durable Content Seed store and the Source Compiler

**BUILD-006 Phases 1 and 2.** A seed comes in by one of three human-initiated routes and lands
in Postgres in a form that cannot later be argued with. A **Source Compiler** then turns that
seed into a bounded, ordered, provenance-complete **evidence pack**.

These phases deliver a **library, two migrations and two CLIs**. There is no long-running
service yet, no Cockpit UI, and no Scribe — those are Phases 3 to 7.

**Phase 2 is not a second component.** It imports Phase 1's modules, compiles seeds Phase 1's
own intake routes created, and inherits Phase 1's identity, immutability and single-transaction
guarantees rather than restating them. One growing spine, not two.

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

## Phase 2 — the evidence pack, in one paragraph

A pack is **the second narrowing**. Intake asks *"what is the smallest sufficient evidence for
this window"*; the compiler asks *"what is the smallest sufficient evidence for this story"*.
Its identity is `sha256` over a canonical manifest — the same construction as `seed_id`, using
the same functions — so two unrelated processes compiling the same seed produce the same pack
and the second write is a no-op. Entries are **deduplicated by content hash**, **selected**
breadth-first by class then rank under a module-constant budget, and **presented in
chronological order** by the source's own time. Selection and ordering are two different rules,
separately versioned, because conflating them is how "chronological" quietly starts meaning
"in the order we liked them".

| Property | How it is held |
|---|---|
| **Deterministic** | Every decision is made in `src/pack.mjs`, which cannot reach a clock, a socket or a random source. No clock, row id, pid, hostname or insertion order enters the manifest. |
| **Bounded, and visibly so** | `PACK_MAX_ENTRIES` / `PACK_MAX_BYTES` are module constants no environment variable can widen. `bounded` is `true` **iff** `omitted` holds an over-budget entry — a CHECK constraint, so a silent truncation is not a writable row. |
| **Provenance-complete** | An entry is a FOREIGN KEY to the snapshot Phase 1 froze, not a copy of it. An entry that points at nothing cannot be inserted. |
| **Independently checkable** | `verify --pack` recomputes the pack id from the stored manifest and re-hashes every entry's stored bytes. It never re-reads the original source. |
| **A later source failure changes nothing** | The compiler has no code path that reads the disk. Break a source, delete another: the pack reads back byte-identical. |
| **A kill mid-compile leaves no half-pack** | Pack, entries and ledger row commit in one transaction. Killed before COMMIT: nothing. After: one complete pack. |

**What the pack deliberately is not:** it is not a copy of the bytes, not a rendering, not a
story, and not a hook for Phase 3. The map stops the compiler at a bounded evidence pack and so
does this code.

## Phase 3 — Scribe and the Master Story Package, in one paragraph

Scribe is **not a drafting agent**. It is a **versioned contract** (`src/scribe/contract/*.md`,
identified by the sha256 of its own bytes) plus everything deterministic around it, with the
language model confined to **one seam** that refuses rather than substitutes. A package is **one
canonical creative truth** — a story question, beats and narrative claims, stored as rows — with
**four siblings derived from it**: script, blog, titles and thumbnail direction.

**The design decision worth reading before the code:** there is no stored blog document and no
stored script document. A sibling is a **projection of cited rows**, and the citations are
foreign keys. The obvious alternative — generate prose, then validate it for uncited sentences —
is advisory dressed as enforcement: it runs after the fact, it can be skipped, and its verdict
is an opinion about text. Here there is no free prose to police.

| Property | How it is held |
|---|---|
| **Every sibling segment carries a citation** | `NOT NULL` columns. A segment with no evidence is not a writable row. |
| **Every citation resolves to a pack entry** | `FK -> vlogops.evidence_pack_entry (pack_id, source_ref)` — Phase 2's own unique key, reused. |
| **A citation cannot reach another pack** | `FK -> vlogops.story_package (package_id, pack_id)`. |
| **A sibling cannot assert what the master does not** | `FK -> vlogops.story_claim_citation (package_id, claim_id, pack_id, source_ref)`. A sibling may not bring its own evidence. |
| **A sibling cannot exist without a master** | `FK -> vlogops.story_claim`. Remove the beat and the sibling goes with it. |
| **Every master claim rests on something** | A deferred constraint trigger — the one thing a foreign key cannot say. |
| **The header cannot misreport its body** | A deferred constraint trigger ties `claim_count`/`segment_count` to the rows. |
| **Versioned, and unreachable by a later contract** | Identity is `sha256` of the contract's bytes, stored on the package; the package is immutable, so a new contract makes a new row and never rewrites an old one. |
| **The model seam refuses loudly** | No gateway, or a gateway with no model named → `EVLOGOPSNOMODEL`, exit `69`. **No fallback, and no default model name.** |
| **Deterministic where determinism is honest** | The prompt, the citations, the structure and `derivation_id` are pure functions of pack + contract. **The model's words are not, and nothing here claims they are.** |

**⛔ What a green suite over this proves, and what it does not.** Every proof runs over a
deterministic stub. They establish the **contract** and the **plumbing**. They say **nothing**
about whether Scribe writes in Warwick's voice — that is a creative judgement, it is Warwick's
alone, and it happens at **Phase 5**. See `samples/README.md`.

## Layout

```
db/001_vlogops_content_seed.sql   the seed schema — additive, idempotent, forward-only
db/002_vlogops_evidence_pack.sql  the pack schema — same discipline, same namespace
db/003_vlogops_story_package.sql  the package schema — traceability AS FOREIGN KEYS
db/teardown.sql                   reverses all three, and nothing else
src/config.mjs                    aggregated startup validation + the budgets + the version labels
src/db.mjs                        lazy pool + the single-transaction seal
src/identity.mjs                  canonical manifest, hashing, normalisation
src/snapshot.mjs                  capture, provenance, integrity verification
src/intake.mjs                    the seal all three routes converge on
src/routes/{records,promotion,supplied}.mjs
src/pack.mjs                      dedupe · select · order · pack identity  (PURE)
src/compiler.mjs                  the compile seal, and the read-back
src/scribe/contract/scribe-v1.md  THE VERSIONED CONTRACT — its bytes are its identity
src/scribe/contract.mjs           loading and identifying a contract version
src/scribe/model.mjs              THE MODEL SEAM — refuses, never substitutes
src/scribe/prompt.mjs             deterministic prompt assembly + derivation identity  (PURE)
src/scribe/proposal.mjs           the named-refusal layer, before anything is written  (PURE)
src/scribe/package.mjs            package identity + the sibling projection  (PURE)
src/scribe/stub.mjs               the deterministic placeholder composer — NOT a model
src/scribe/store.mjs              the draft seal, and the traceability read-back
bin/vlogops-intake.mjs            the intake CLI
bin/vlogops-compile.mjs           the compiler CLI
bin/vlogops-scribe.mjs            the Scribe CLI
samples/                          one real package, committed, labelled as stub output
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

# then compile a seed into its evidence pack, and check it back
node bin/vlogops-compile.mjs compile --seed <seed_id> --emit pack.json
node bin/vlogops-compile.mjs verify  --pack <pack_id>

# then draft the Master Story Package from that pack, and check its traceability
node bin/vlogops-scribe.mjs status                        # which contract, and is a model configured
node bin/vlogops-scribe.mjs draft  --pack <pack_id> --emit package.md
node bin/vlogops-scribe.mjs verify --package <package_id>
```

`draft` defaults to `--model gateway` and **refuses with exit `69`** when no gateway and model
are configured. That default is deliberate: one that quietly stubbed would make every run a lie
about what produced it. `--model stub` is available, must be asked for by name, and stamps the
package with a binding that says so permanently.

`npm test` needs `initdb`, `pg_ctl`, `postgres` and `createdb` on PATH (or `POSTGRES_BIN`
pointing at the Postgres bin directory). It never touches an existing database: it creates
its own throwaway cluster, uses it, and deletes it. Set `REUSE_DATABASE_URL=1` to run against
a pre-existing `$DATABASE_URL` instead — that is the CI service-container path.

## Applying the migration to the managed project

**Not from here.** This service is proven entirely against a disposable local cluster and
never connects to the managed project. Applying `db/001_*.sql`, `db/002_*.sql` or
`db/003_*.sql` there is a live action that belongs to Larry, after review. Every one of them is
additive, issues no grants, and touches no other namespace — and `db/teardown.sql` reverses
exactly what they added.

## Operations

See [RUNBOOK.md](RUNBOOK.md).
