# BUILD-014 WP-C — Tower on the Postgres baton (design note)

**Status:** DEV-only build artifact. **No live DB apply, no Edge-Function deploy, no live GitHub
webhook** — those are separate live gates. Adapters are FAKED in CI (the point is the wiring +
head-binding + fail-closed, not calling live CLIs). Threat model: first-party, non-adversarial
personal hobby brain — built for correctness, accidental-leak safety, availability, audit-integrity.

## What this is

The multi-model review loop moved OFF the ClickUp thread and ONTO the control plane (Postgres +
git). A GitHub checkpoint event lands via an HMAC-verified receiver, becomes an immutable event +
a canonical-SHA `checkpoint`, and enqueues a `review` job on the WP-B durable queue. A WP-B job
handler runs the two independent reviewers (ported Codex correction-loop + Fable cold-final) and
writes head-bound, role-correct `verdict` rows. The Fusion policy gate maintains the `merge_gate`
and can only report `mergeable` when both required reviewers have an ACTIVE approve at the CURRENT
head and the cached GitHub mechanical state agrees.

## Components (all under `services/control-plane/`)

| Component | File | Role |
|---|---|---|
| GitHub ingress | `ingress/githubIngress.mjs` | HMAC-256 verify (fail-closed) · delivery-id dedup · immutable `agent_event` · upsert `build`+`checkpoint` (canonical SHA) · `enqueue('review')` on the WP-B queue. |
| Review handler | `review/reviewHandler.mjs` | WP-B job handler for `review`: loads the checkpoint's OWN head, runs the injected adapters, writes head-bound role-correct verdicts (supersede-then-insert, idempotent). |
| Ported adapters | `review/codexAdapter.mjs`, `review/fableAdapter.mjs`, `review/envelope.mjs` | Faithfully ported from `Fusion247PKA-towerfix/services/tower-baton/src/*` — read-only Codex + tool-less Fable, fail-closed model-attestation, honest-provider labelling, secret denylist. Only `.js`→`.mjs` import extensions changed. The retired ClickUp wire (`watcher`/`clickupClient`/`handoff`) was NOT ported. |
| Policy gate | `gate/policyGate.mjs` | Evaluates/maintains `merge_gate`: dual-gate (Fusion policy vs cached GitHub) · moved head supersedes · exposes `overall_action_state`. Never invents a GitHub fact. |
| E2E proofs | `test/wp-c-e2e.test.js`, `test/run-wpc-tests.mjs` | 14 DB-gated proofs against real Postgres; 0-executed-subtest guard; CI-wired. |

## Vocabulary bridge (the one place two naming schemes meet)

The ported adapters sign under `gpt_codex` / `claude_fable` (envelope honest-provider map); the
WP-A `principal` enum uses `gpt_codex` / `fable`. `reviewHandler.mjs` `SIGNER_ROLE` is the ONLY
mapping site: `gpt_codex → (gpt_codex, correction_loop)`, `claude_fable → (fable, cold_final)`.
Any other signer principal is REFUSED — a mislabelled reviewer can never occupy a role slot. The
WP-A composite `verdict_reviewer_role_chk` is the structural backstop.

## The head-binding kill, twice

1. **Structural (WP-A, reused):** a `verdict` row composite-FKs `(checkpoint_id, reviewed_commit_sha)
   → checkpoint(id, head_sha)`, and SHAs are a canonical `ops.git_sha` domain. A verdict for the
   wrong head is a FK violation, not a runtime bug.
2. **App-layer (WP-C, defence-in-depth):** the review handler cross-checks each adapter's SIGNED
   `envelope.reviewed_head` against the checkpoint's DB head. An `ok` result that reviewed a
   different head is DOWNGRADED to `blocked` — we never record an approve for a head the reviewer
   never saw (test 7). Verdicts are always bound to the checkpoint's DB head, never the payload's copy.

## Fail-closed / robust patterns (RCA, applied to all analogous sites)

- **Default-deny:** blocked/absent/hostile adapter output → `blocked` verdict (never an approve).
  Missing webhook secret / bad signature / missing delivery-id → rejected with NO DB write.
- **Canonicalise SHAs at the boundary:** `canonicalizeShaOrNull` at ingress + handler, then the
  `ops.git_sha` domain re-enforces. An upper-case head is stored lower (test 3).
- **Idempotent + convergent:** every ingress step is individually idempotent (delivery-id event,
  checkpoint natural key, review-job idempotency key `review:<cpId>:<head>`), so a redelivery — even
  after a partial crash — heals to the same state (tests 4, 8, 14).
- **Bind to the full identity tuple:** `(build_id, checkpoint_id, reviewed_commit_sha/head)`
  everywhere; a moved head is a NEW checkpoint row and supersedes the prior gate.
- **Total on hostile-but-accidental input:** a thrown adapter, a missing/non-string verdict, an
  unmappable signer never escape — they route to `blocked` or a job `failed` (retry), never a crash.
- **Proven = executed in CI:** `.github/workflows/control-plane-tests.yml` runs `test:wpc` against a
  real Postgres service container with the 0-executed-subtest guard.

## Outcome-C (acceptance)

The system cannot report merge-readiness for a DIFFERENT or SUPERSEDED head. `mergeable` requires
`fusion_policy_decision='approved'` (DB-gated on a real head-bound two-reviewer approve) AND a cached
GitHub head that equals the expected head AND mechanically clean. A moved head supersedes the prior
gate (its `overall_action_state` reads `superseded`); the new head's gate is not approved until its
own reviews land. D1: superseding a supporting verdict auto-supersedes the approved gate (tests 12, 13, 14).

## How to run

```
cd services/control-plane
npm ci
npm run test:wpc     # WP-C only (provisions a throwaway Postgres, or REUSE_DATABASE_URL=1 + DATABASE_URL)
npm test             # WP-A + WP-B + WP-C
```

Requires `initdb`/`pg_ctl`/`postgres` on PATH (or `POSTGRES_BIN`) and the `pg` driver. The runner
provisions a DISPOSABLE cluster and NEVER touches an existing database. `DATABASE_URL` must point at
an ISOLATED dev Postgres — this is never applied to any live/prod project by this work package.

## Deferred / out of scope (live gates)

- Edge-Function / HTTP transport wrapping `ingestWebhook` (receiver logic is transport-agnostic here).
- Live GitHub webhook registration + the real observed-GitHub reader that fills the cached mechanical
  projection (WP-C supplies it as an explicit, labelled `github` argument; it never invents one).
- Wiring the REAL `createCodexAdapter()` / `createFableAdapter()` into the `reviewers` array in a
  runtime entrypoint (the handler is adapter-agnostic; CI uses fakes by design).
