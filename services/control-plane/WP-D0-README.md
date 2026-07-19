# BUILD-014 WP-D0 — Authoritative current-head hardening (design note)

**Status:** DEV-only build artifact. **No live DB apply, no Directus, no live GitHub webhook** —
those are separate gates. Additive migration `002` on top of the immutable, already-merged `001`.
Threat model unchanged: first-party, non-adversarial personal control plane — built for
correctness, accidental-leak safety, availability, audit-integrity.

## The defect this closes (the required-before-live WP-C finding)

Both WP-C reviewers flagged the same head-binding bug class the whole build exists to structurally kill:

1. **Stale window.** Ingress of head B created checkpoint B + its review job but did **not**
   supersede head A's live `ops.merge_gate`. `readLiveGate(build)` kept returning head A as
   `mergeable` until something later re-evaluated — a consumer (the coming cockpit) reads a stale
   "mergeable" for a head that has already moved.
2. **Revive-old-head.** `evaluatePolicyGate` trusted whatever `{checkpointId, headSha}` the caller
   passed. Called with an OLD checkpoint after a newer one was live — reachable under normal ops via
   an **out-of-order review-job completion** (a reclaimed/slow stale job for head A completing after
   head B) — it superseded the newer gate and re-inserted the old head as live.

## The head-authority model (structural, at the boundary)

Per the banked lesson (*canonicalize at the boundary + bind durable state to the authoritative
identity; don't rely on every call site passing the right head*):

- **`ops.build_head`** — ONE row per build. `build_id` is the **PRIMARY KEY**, so "at most one
  authoritative current head per build" is a structural fact, not a convention. Its
  `(build_id, current_checkpoint_id, current_head_sha)` **composite-FKs onto**
  `checkpoint(build_id, id, head_sha)` (the WP-A G1 target), so the authoritative head is **always a
  real recorded checkpoint head for this build**, canonical by the `ops.git_sha` domain. A
  non-canonical head cannot even be stored.
- **`ops.advance_build_head(build, checkpoint, head)`** — the boundary operation. Ingress
  (`ingestWebhook`) calls it **in the same transaction** as the checkpoint upsert. It:
  1. canonicalises the head (`ops.canonicalize_sha` — refuses short/upper/whitespace-padded);
  2. takes the build-scoped advisory lock **first** (see lock order);
  3. confirms `(build, checkpoint, head)` is a recorded checkpoint (defense; the FK also enforces it);
  4. is **MONOTONIC** — advances the authority only to a **strictly-newer** checkpoint, ordered by
     `(created_at, checkpoint_id)`. A redelivery of an old/current head is a **no-op**, so it can
     never move the head backward — the *revive-via-ingress* path is closed;
  5. on an actual advance, **supersedes any live `merge_gate` bound to a different head** — closing
     the **stale window at the edge**.
- **`evaluatePolicyGate` fail-closed head check** (`gate/policyGate.mjs`) — after taking the same
  advisory lock, it reads `ops.build_head` and **refuses** (returns `{ refused: true, action:
  'refused_non_current_head' }`, touching nothing) unless the requested `(checkpoint_id, canonical
  head)` **equals** the authoritative `(current_checkpoint_id, current_head_sha)`. This structurally
  kills *revive-old-head* **regardless of caller**: a stale/out-of-order completion for a
  non-current head is refused and can never supersede or revive.

### Why this is structural, not per-call-site

The authority lives in **one row per build** enforced by a primary key, and the "is this the current
head?" decision is a **single fail-closed check at the gate boundary** reading that row — not a head
comparison sprinkled across each caller. Ingress advances the authority + closes the stale gate **at
the edge, in the checkpoint transaction**. Any present or future caller of `evaluatePolicyGate` (the
review job, a reclaimed job, a cockpit action, a new WP) is bound by the same check without having to
remember to pass the right head. Adding a new call site cannot reintroduce the bug.

## Lock order (deadlock / lock-ordering analysis)

Two paths touch both `ops.build_head` and `ops.merge_gate`: `advance_build_head` (ingress) and
`evaluatePolicyGate`. To make AB-BA impossible, **both take `ops.build_head_lock_key(build_id)` as a
transaction-scoped `pg_advisory_xact_lock` FIRST — before any row lock.** The key derivation is a
single shared function so the two paths lock the **identical** key.

Acquisition order:

| Path | 1st (outermost) | then | then | then |
|---|---|---|---|---|
| `advance_build_head` (ingress) | `build_head_lock_key(build)` | `build_head` row | live `merge_gate` row (supersede) | — |
| `evaluatePolicyGate` | `build_head_lock_key(build)` | `merge_gate` live row (`for update`) | *(approve only)* `(build,checkpoint,head)` advisory | active `verdict` rows (`for update`) |

- **advance vs evaluate / advance vs advance / evaluate vs evaluate** (same build): the outermost
  lock both acquire is the same build-scoped advisory lock, so they **fully serialise** — no cycle
  is possible between the `build_head` row and the `merge_gate` row. Proven by tests 4 and 5 (two
  connections, no `40P01`).
- The nested `(build, checkpoint, head)` advisory lock (WP-A R4-3B, taken **inside** the
  require-reviewers trigger on approve, and by `verdict_supersede_invalidates_gate`) is a **different
  key, taken later**, so this new outermost lock does not change that path's accepted residual
  clean-abort behaviour (approve-vs-verdict-supersede). advance's supersede sets the decision to
  `superseded` (not `approved`), so it never enters the require-reviewers approve branch and never
  takes that nested lock — advance takes only the `merge_gate` **row** lock, so advance vs
  verdict-supersede has no cross-lock cycle either.

## New tests (the ones the WP-C e2e HID) — `test/wp-d0-e2e.test.js`, 9 DB-gated proofs

| # | Proof |
|---|---|
| 1 | Ingress advances `build_head`; the gate for the current head reaches `mergeable`; authority binds to the ingested checkpoint. |
| 2 | **(a)** Read the live gate **immediately** after a moved-head ingress (no evaluate re-run) — the old gate is already superseded; nothing reads `mergeable`. |
| 3 | **(b)** An out-of-order `evaluatePolicyGate` for an **old** head after a newer head is current is **refused** — no revive, the current gate is **not** superseded. |
| 4 | **(c1)** Two connections: a stale evaluate genuinely **blocks** on the build-scoped head-authority advisory lock, then **refuses** once released. |
| 5 | **(c2)** Two connections: a concurrent head-advance (ingress) vs a stale evaluate — **no deadlock** (no `40P01`), stale refused, head advanced, old head not revived. |
| 6 | **(d)** Redelivery/convergence: redeliveries of old/current heads are no-ops (single `build_head` row, monotonic — no backward move, no double-supersede, gate stable). |
| 7 | Structural: `build_id` PRIMARY KEY ⇒ at most one authoritative head per build (a second insert is `23505`). |
| 8 | Structural: advance refuses a non-recorded `(build, checkpoint, head)` fail-closed (`23514`); the head is canonicalised at the boundary (upper-case → lower-40-hex). |
| 9 | Regression fence: every `ops` plpgsql/sql function (incl. the WP-D0 additions) pins `search_path`. |

No regression to the merged suites: **WP-A 25 + WP-B 23 + WP-C 14 + WP-D0 9 = 71**, all green on real
Postgres. (WP-C's `freshPool` now applies `001 + 002` because ingress depends on `advance_build_head`;
the 14 WP-C proofs are otherwise unchanged.)

## How to run

```
cd services/control-plane
npm ci
npm run test:wpd0    # WP-D0 only (provisions a throwaway Postgres, or REUSE_DATABASE_URL=1 + DATABASE_URL)
npm test             # WP-A + WP-B + WP-C + WP-D0
```

Requires `initdb`/`pg_ctl`/`postgres` on PATH (or `POSTGRES_BIN`) and the `pg` driver. The runner
provisions a DISPOSABLE cluster and NEVER touches an existing database. `DATABASE_URL` must point at
an ISOLATED dev Postgres — never applied to any live/prod project by this work package.

## Assumptions / honesty flags

- **Monotonic order key = `checkpoint.created_at`** (immutable per the WP-A guard), tie-broken by
  `checkpoint_id`. This assumes checkpoint creation time reflects ingestion order — true for the
  first-party ingress flow (each webhook is its own transaction; a later head's checkpoint has a
  later `created_at`). A redelivery does not change `created_at`, which is exactly what makes
  redelivery a no-op. Two *distinct* checkpoints created in the same microsecond are resolved
  deterministically by the `checkpoint_id` tiebreaker (never observed in practice; not
  semantically meaningful, only stable).
- **The out-of-order completion is modelled by calling `evaluatePolicyGate` directly** for a stale
  head (as WP-C's tests do), because WP-C does not yet wire a runtime entrypoint that calls the gate
  after review. The fail-closed refusal is caller-agnostic, so this faithfully exercises the reclaimed
  /slow-job path.
- **Full-tuple bind includes `checkpoint_id`.** The gate requires the requested checkpoint to equal
  the authoritative `current_checkpoint_id`, not only the head SHA. In the ingress model these always
  correspond; the stricter check is deliberate fail-closed rigor (binds to `(build_id, checkpoint_id,
  canonical head)`).
- **Advance lives in the DB** (`ops.advance_build_head`, called by ingress on the pinned client) so
  the monotonic + supersede logic is structural and cannot be bypassed by a caller that forgets it.
- Everything is DEV-only; `002` is additive and never modifies `001`; no live apply performed.
