# BUILD-014 PR-2b — Tower RUNTIME (packet-builder + reviewHandler refactor + risk-routing + versioned product-QA prompt + feature-gated readiness)

**Branch:** `build-014/wp-2b-tower-runtime-packet-prompt` (off `build-014/wp-2a-reviewer-registry-packet-run` @ f6543fe)
**Status:** DESIGN/DEV ARTIFACT — **not applied to any hosted/live DB; no live GitHub writes; no real Telegram.** DEV/synthetic only. Never touches `asdair`/personal data. Consumes PR-2a's schema (migrations 001+002+003+004) unchanged — **no new migration**.
**Adds:** runtime `.mjs` under `services/control-plane/review/` + executed proofs. Applies the review→readiness path but keeps `role_based_readiness` OFF by default (live activation is a Warwick gate).

## What / why

PR-2a delivered the reviewer-trust SCHEMA (reviewer registry, `review_packet`, `review_run`, `checkpoint_assurance`, the OFF-by-default `role_based_readiness` flag). PR-2b is the application layer that makes it runnable and closes the load-bearing miss (the richer product-QA prompt written-but-not-wired).

| New file | Role |
|---|---|
| `review/productQaPrompt.mjs` | Loads + fingerprints the **versioned** product-QA prompt; assembles the acceptance-first, prior-findings-injected prompt. |
| `review/prompts/product-qa-runtime-orientation.md` | The DRAFT acceptance-first orientation layer (flagged NOT-YET-APPROVED). |
| `review/packetBuilder.mjs` | Trusted runtime: resolves every required evidence source, persists the RESOLVED IMMUTABLE PAYLOAD + `packet_hash`; fail-closed. |
| `review/riskRouting.mjs` | Pure `deriveDiffSurfaces` + `computeAssurance` + `persistAssurance` → `checkpoint_assurance` from the ACTUAL diff surface. |
| `review/registryDispatch.mjs` | Model-agnostic role→reviewer dispatch via the registry (no hardcoded model names). |
| `review/readiness.mjs` | Reads the feature-gated `checkpoint_effective_readiness`. |
| `review/towerReview.mjs` | The packet-driven orchestration (assurance → packet → dispatch → review_run + legacy verdict + events → consumed → readiness). |
| `review/reviewCore.mjs` | Shared verdict helpers extracted from `reviewHandler.mjs` (no import cycle). |
| `review/reviewHandler.mjs` | REFACTORED: consumes the `review_packet` (packet-driven path) when a `packetBuilder` is injected; the ORIGINAL WP-C ad-hoc path is preserved byte-for-byte when it is not (WP-C/WP-D0 unchanged). Re-exports `canonicalizeShaOrNull`/`verdictFromAdapterResult`/`recordVerdict` for ingress/policyGate/WP-C. |

### 1. Packet-builder (trusted runtime, fail-closed)
The trusted runtime holds read-only GitHub access (INJECTED as `evidenceSources.resolveGit` — CI/tests drive fakes + a real-diff fixture at `review/test/fixtures/sample.diff`; production wires the real allowlisted git) **plus** Supabase reviewer-view DB reads (PRD/Plan versions, acceptance rows, ALL prior open findings) done directly on the pool. **Reviewer subprocesses never get this access.** It persists ONE canonical, hashed, immutable `review_packet` (RESOLVED payload + `packet_hash` over an RFC-8785-ish canonicalisation, key-order independent). Fail-closed: any unresolvable MANDATORY source (`git`, `prd`, `plan`, `acceptance_rows`) → packet `state=blocked` + reason, outcome `BLOCKED — review evidence incomplete`. **No silent truncation:** a git-signalled truncated diff → BLOCKED (split/approved-bounded-scope required), never "review the available bits."

### 2. reviewHandler refactor
Consumes the `review_packet` (not the ad-hoc job payload). Stages the SAME snapshot+hash to each required reviewer; adapter secret-stripping (Fable tool-less neutral dir, Codex credential-stripped) is UNCHANGED — reviewers see only the staged evidence + hash. Writes a `review_run` per reviewer: `prompt_version` + `prompt_fingerprint`, `packet_hash`, exact reviewed head, prd/plan versions, honest registry identity (via the registry, model-agnostic), `evidence_accessed`, outcome. The existing **head-attestation cross-check is preserved** (a signed `reviewed_head` ≠ the checkpoint head downgrades to `blocked`). The legacy `verdict` is ALSO written for legacy principals, so the flag-OFF governing readiness is unchanged.

### 3. Risk-routing = `checkpoint_assurance`
Required roles computed from the touched surface (WP baseline + actual diff surfaces + Warwick stress flags): `product_qa` always; `adversarial_assurance` when a risk trigger is touched (autonomous command / permission / credential / public endpoint / live data / persistent worker); `security_assurance` where a security surface is touched; `warwick_approval_required` + `auto_merge_eligible` EXPLICIT (`auto_merge_eligible` is always `false` here — never inferred from green gates). Dispatch is registry-driven (Codex→product_qa, Fable→adversarial TODAY via their grants, not hardcode). **Adversarial-required-but-unavailable → BLOCKED**, never a silent product_qa-only fallback.

### 4. The REAL versioned product-QA prompt (the load-bearing fix)
- **Base (APPROVED, found + wired):** `Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md` — Warwick-authored, `status: approved`, `standing_use_ratified: true`, ratified line-by-line 2026-07-18. Its ordered checklist already puts acceptance-criteria alignment before "explore beyond," and it is a product-QA (not pentest) reviewer. The runtime loads it fail-closed (an unratified base fails the load) and binds its fingerprint on every `review_run`.
- **Orientation (DRAFT, flagged):** `review/prompts/product-qa-runtime-orientation.md` — a small layer authored by Mack (PR-2b) that makes two behaviours **explicit + testable**: (a) acceptance-FIRST ordering before exotic/perimeter probing, and (b) explicit consumption of EVERY prior open finding. It is **clearly flagged NOT-YET-APPROVED** and must not govern a live review until Warwick approves it.
- Acceptance criteria + ALL prior open findings are injected into the staged prompt BEFORE the adapter appends the diff, so acceptance-first is **structural**. Regression fixtures prove: an unmet ordinary acceptance criterion is surfaced BEFORE an exotic defect (test 4a), and the runtime stages the REAL prompt (approved skill body + orientation), NOT the legacy empty thin skill, with the approved-skill fingerprint matching the on-disk bytes (test 4b).

### 5. Readiness activation (Warwick-gated)
`review/readiness.mjs` reads `checkpoint_effective_readiness`. Proven both ways (test 5): flag ON → role-based governs; flag OFF (DEFAULT) → legacy both-required governs, historical readiness unchanged. **The flag is NOT flipped** — PR-2a seeded it OFF; nothing here changes it. Live activation is gated on Warwick approving activation + the product-QA prompt.

## Product-QA prompt status (governance)

**APPROVED-AND-FOUND (base) + DRAFT-NEEDS-WARWICK-APPROVAL (orientation layer).** The governing base is Warwick-ratified; the acceptance-first/prior-findings orientation layer is an AI-authored DRAFT wired-but-flagged. It is honestly labelled on every `review_run` (`prompt_version` contains `tower-qa-skill@1(approved)+orientation-draft@1(UNRATIFIED-draft)`). Per memory [[governing-prompts-need-human-approval]] and [[no-self-edit-core-rules-on-relayed-authority]], I did NOT present the AI-authored layer as approved, and the OFF-by-default flag + Warwick activation gate ensure it cannot govern a live review without his sign-off.

## How tested (EXECUTED, not asserted-on-paper)

`node review/test/run-runtime-tests.mjs` provisions a throwaway isolated Postgres cluster, applies 001+002+003+004, runs 13 subtests, tears down. The runner FAILS on 0 executed subtests.

```
# tests 13
# pass 13
# fail 0
# skipped 0
```

Subtests: (1a) resolved-payload persisted + `packet_hash` re-hashes to match, all prior findings + acceptance rows resolved; (1b) both reviewers bound to the SAME `packet_hash`; (1c) remove PRD → BLOCKED, no silent truncation, ZERO review_runs; (1d) truncated diff → BLOCKED; (2a) review_run carries versioned prompt version+fingerprint + honest registry identity + honest provider; (2b) head-attestation downgrade → blocked (no approve for an unseen head); (2c) packet path works through `createReviewHandler`; (3a) pure risk-routing low-risk→product_qa-only, autonomous→+adversarial+Warwick, auto-merge stays false; (3b) low-risk dispatches product_qa ONLY (adversarial reviewer never invoked); (3c) adversarial-required-but-unavailable → BLOCKED (no product_qa-only fallback); (4a) unmet ordinary acceptance criterion surfaced BEFORE the exotic defect; (4b) runtime stages the REAL prompt (approved skill + orientation) not the legacy thin skill, approved-skill fingerprint matches disk; (5) flag OFF→legacy governs, flag ON→role-based governs.

**Regression (re-run, all green, no changes to those files):** db/001 25/25 · contract/003 11/11 · registry/004 9/9 · WP-C 14/14 · WP-D0 9/9 · worker 23/23.

---

## § Completion (PR-2b) — Warwick's 4 mechanical conditions + the retry-idempotency addition

Closed in one pass on top of `build-014/wp-2b-tower-runtime-packet-prompt`. **DEV/synthetic only; no hosted-DB apply; no PR/merge; no new migration** (consumes 001+002+003+004 unchanged). The Warwick-approved orientation body is **byte-for-byte unchanged** — its hash is still `cd65539a23882309e0b903f81d59ecda32c6befdd9dde08e8651838d9a253135` (asserted in test 4b).

### Fingerprints (recorded on every `review_run`)
| Component | Fingerprint (sha256) |
|---|---|
| base — `tower-qa-skill.md` (APPROVED, ratified) | `f2fc2f26ef9b6adbaa2c64754a343acf93309898085e913a74a3eb59814b739a` |
| classification-amendment (APPROVED + LIVE) | `5c254258811800bf59520bdd60ee1473a3c99df25e9e1ff6047b1ed4de7c676d` |
| orientation (campaign-approved; body unchanged) | `cd65539a23882309e0b903f81d59ecda32c6befdd9dde08e8651838d9a253135` |
| **composed** = base+classification+orientation (recomputed) | `02fdfbc8968eb80b6b411b1a439629847c2a0e938eca9699b077ca2c1ff18041` |

`review_run.prompt_fingerprint` = the composed fingerprint; `review_run.prompt_version` carries all three component fingerprints + provenance stamps:
`tower-qa-skill@1(approved;fp=f2fc2f26ef9b)+classification-amendment@1(APPROVED_LIVE;fp=5c254258811800)+orientation@1(APPROVED_FOR_BUILD_014_DEV_CAMPAIGN;approved_by=warwick;governs_live=false);orientation_fp=cd65539a2388`.

### Condition 1 — LIVE classification governance as a versioned prompt component
New `review/prompts/reviewer-classification-amendment.md` carries the APPROVED+LIVE governing text verbatim from `Deliverables/2026-07-19-reviewer-classification-amendment-v1-DRAFT.md` (three judgements; disposition-governs-merge rule; R1 fail-closed split-on-HIGH+; R2 stated-baseline; round-economy). `productQaPrompt.mjs` loads it **fail-closed** (missing/empty/unratified → `ok:false`, like the base) and fingerprints it. **Composed prompt = base + classification-amendment + orientation + resolved evidence**, and `towerReview` stages that one composed prompt to EVERY required reviewer (Codex, adversarial/Fable, future Grok).

### Condition 2 — fail-closed output schema matched to the prompt + the runtime WRITE-PATH
- **Shared schema** (`codexAdapter.mjs::CODEX_RESULT_SCHEMA`, used by Codex AND Fable) extended with `acceptance_results[]`, `prior_finding_results[]`, and three-axis-classified `findings[]` (`technical_impact` / `reachability` / `required_disposition` / `assumed_deployment_baseline` + stable id + evidence + required_correction).
- **Fail-closed validation** (`review/reviewClassification.mjs::validateReviewerResult`): every staged acceptance criterion must carry a result, every prior open finding must carry a disposition (no silent carry-over), every finding must carry the full three-axis classification + a stated baseline (R2). Missing/malformed → the run is recorded **`blocked`** — never accepted with the answer buried in `summary`.
- **Write-path** (`persistReviewerClassification`, inside the `review_run` transaction): `acceptance_results` → `ops.acceptance_verification` (REVIEWER principal, bound to checkpoint + EXACT head + prd/plan versions); `prior_finding_results` → `ops.finding` disposition update (`addressed` → closed/fixed, append-only) + `review_run_finding` link; new `findings` → `ops.finding` (three-axis classification; `technical_impact`→severity, `reachability`→reachability enum, `required_disposition`+baseline in `impact`) + `acceptance_finding` link + `review_run_finding` relation `opened`. The legacy `verdict` write is kept (now the **disposition-derived** effective verdict), so flag-OFF readiness stays consistent. Proven executed: tests 6a–6d land rows in `acceptance_verification` + `finding` with the classification fields populated.
- **Merge rule wired:** the DISPOSITION (not severity) decides the merge — an improvement (NOTE_ONLY / TRACKED_FOLLOWUP) can never block; only a `BLOCKS_CURRENT_MERGE` finding (or a failed/blocked acceptance) blocks the current merge.

### Retry-idempotency (Warwick's addition)
The write-path is retry-idempotent at the same head: acceptance_verification uses `INSERT … WHERE NOT EXISTS` on `(acceptance_row_id, checkpoint_id, reviewer, exact_sha)`; findings use a deterministic `finding_ref` with `ON CONFLICT DO NOTHING`; the `addressed` transition is `… and state='open'` (single-valued); the whole persistence runs in the run's transaction (atomic on rollback). Proven by test **6d** (same review run twice at the same head → exactly one verification per (row, reviewer, head); no duplicate finding rows).

### Condition 3 — three dedicated fail-closed fixtures
- **6a** two-round finding persistence: a round-1 finding is injected into round-2's packet; an omitted round-2 disposition **fails closed** (blocked); the finding **cannot vanish** (still open, append-only).
- **6b** improvement does not block: NOTE_ONLY/TRACKED_FOLLOWUP (even technically HIGH) with verdict=approve → **approved**; a `BLOCKS_CURRENT_MERGE` finding → **blocks** even though the reviewer said approve.
- **6c** low-risk not over-polished: completed acceptance + no material blocker → approval permitted; optional improvement tracked + nonblocking; NO adversarial reviewer invoked where `checkpoint_assurance` does not require one.

### Condition 4 — approval recorded honestly WITHOUT changing the approved bytes
New `review/prompts/prompt-approvals.json` records `{fingerprint: cd65539a…253135, scope: BUILD_014_DEV_CAMPAIGN, approved_by: warwick, approved_at: 2026-07-20, governs_live: false}`. `productQaPrompt.mjs` reads it: when the on-disk orientation fingerprint matches an approved-for-campaign entry, the provenance stamp becomes `orientation@1(APPROVED_FOR_BUILD_014_DEV_CAMPAIGN;approved_by=warwick;governs_live=false)` — **not** `UNRATIFIED-draft`. The orientation `.md` body/frontmatter are untouched; `governs_live` stays false so `role_based_readiness`/live remain gated (the flag is NOT flipped). Composed fingerprint recomputed + recorded above.

### Test result (EXECUTED)
`node review/test/run-runtime-tests.mjs` → **17/17** (13 original + 6a/6b/6c/6d). Regression re-run, all green: db/001 25/25 · contract/003 11/11 · registry/004 9/9 · WP-C 14/14 · WP-D0 9/9 · worker 23/23 (WP-C/WP-D0 use the legacy non-packet `createReviewHandler` path, byte-for-byte unchanged).

## Self-review vs the discipline

- **Fail-closed everywhere:** thrown adapter → blocked; missing/blocked packet → no reviews; unresolved mandatory evidence / truncated diff → BLOCKED; unmappable/unavailable reviewer for a required role → BLOCKED; a thrown git source → blocked. No unhandled escape. ✔
- **No secrets to subprocesses:** the ported adapters' secret-stripping is untouched; the packet-builder's DB/GitHub access lives only in the trusted runtime; reviewers get only the staged text + hash. ✔
- **Injectable seams for CI:** `evidenceSources` (git), `reviewers` (adapters), `packetBuilder`, `productQaPrompt`, `findingLinker`, `riskInput.wpBaseline` all injected; a real-diff fixture drives the happy path. ✔
- **Head-binding preserved:** review_run `reviewed_head_sha` = the checkpoint's OWN recorded head (read from DB, never the payload); legacy attestation cross-check retained. ✔
- **Idempotency:** a completed `review_run` for the same (packet, reviewer, role) is skipped on retry; legacy verdict write is supersede-then-insert; events are delivery-keyed. ✔
- **Back-compat:** the legacy WP-C `createReviewHandler` path is byte-for-byte unchanged when no `packetBuilder` is injected; the three shared helpers are re-exported from the same module. ✔
- **House style:** matches the ported-adapter / migration comment discipline, `create`-injectable factories, structured logging, no new build step. ✔

## Residuals flagged for the reviewers

1. **`prompt_fingerprint` = the prompt TEMPLATE (skill+orientation) fingerprint**, stable across checkpoints; the per-checkpoint evidence identity lives in `packet_hash` (review_run binds both). This is deliberate (template identity vs evidence identity). If reviewers want the fingerprint to be the exact assembled bytes, that is a one-line change but makes the fingerprint per-checkpoint.
2. **Warwick decisions + CI are SOFT evidence** in the DEFAULT mandatory set (`git`,`prd`,`plan`,`acceptance_rows`). v3 Part A lists CI + decisions as required; the mandatory set is configurable (`mandatory` option) so a production wiring can promote them. No `warwick_decision` table exists in 001/003 yet, so decisions are an injectable soft source.
3. **`review_run_finding` is written only via an EXPLICIT `findingLinker`** (never fabricated from fuzzy reviewer text). Prior-finding CONSUMPTION is proven by injecting ALL open findings into the prompt + recording them in `evidence_accessed`; automatic opened/closed linkage against real `ops.finding` ids is left to a linker (default none) to avoid false closures.
4. **`auto_merge_eligible` is hard-coded `false`** in the risk policy (conservative + explicit). Policy/Warwick sets it true deliberately later; never inferred here.
5. **Single active PRD/Plan assumption:** the packet resolves the single ACTIVE PRD/Plan for the build (latest by `created_at` if multiple keys). A multi-PRD build would need the checkpoint→PRD linkage that a later slice adds.
6. **The orientation layer is AI-authored DRAFT** (residual by design): it needs Warwick's explicit approval before the `role_based_readiness` flag is flipped and it governs live.
7. **Base-SHA-required blocked path:** if even the git base cannot resolve, no `review_packet` row is constructable (base_sha is NOT NULL) — that case returns a row-less BLOCKED outcome + a durable `review.blocked` event instead of a blocked packet row. All other mandatory-source failures produce a blocked packet row with a reason.

---

## § Disposition correction (migration 006) — a first-class TYPED home for the merge lever

**Warwick's explicit direction:** the reviewer-classification merge lever must be TYPED, not free-text. Previously `review/reviewClassification.mjs` carried `required_disposition` (the merge lever) + `assumed_deployment_baseline` (R2) inside the free-text `ops.finding.impact` column — nowhere typed to put them. This slice gives them typed columns and makes readiness consume the enum, never a substring. **DEV/synthetic only; no hosted apply; no PR/merge; no prompt-byte changes; legacy findings NOT backfilled.**

### Schema (migration `006_finding_required_disposition.sql` — additive + idempotent, matching 001/003/004 discipline)
- **New enum** `ops.required_disposition` = `BLOCKS_CURRENT_MERGE | REQUIRED_BEFORE_LIVE | REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS | TRACKED_FOLLOWUP | NOTE_ONLY` (DO-block guarded). **Deliberately SEPARATE** from the lifecycle `ops.finding_disposition` (003) — two axes, two enums, never overloaded.
- **Three NULLABLE columns on `ops.finding`** (legacy compatibility — a legacy row keeps them NULL, no backfill): `required_disposition ops.required_disposition`, `assumed_deployment_baseline text` (a dedicated bounded field — NOT a deployment-registry subsystem), `classification_version text` (its presence marks a finding non-legacy).
- `technical_impact` stays mapped to the existing `severity`; `reachability` stays the existing `finding_reachability` enum (both already typed).
- **Guarded named CHECK** `finding_typed_disposition_needs_version_chk` = `(required_disposition is null or classification_version is not null)`. It does NOT force a classifier finding to carry a disposition — a classifier finding MISSING its `required_disposition` stays representable on purpose so the readiness gate FAILS CLOSED on it rather than a constraint hiding it.
- **No new RLS/grants:** `ops.finding` already has FORCED RLS + a `service_role` SELECT/INSERT/UPDATE grant (003); the table-level UPDATE covers the new columns; `anon`/`authenticated` get NEITHER. `search_path`-pinned funcs unchanged. Migration number **006** (not 005) avoids colliding with the external-write outbox `005` on the parallel chain.

### Write-path (`review/reviewClassification.mjs`)
A NEW classifier-produced finding now WRITES all of: `classification_version` (runtime-stamped `reviewer-classification-amendment@1`), `required_disposition` (typed enum), `assumed_deployment_baseline` (typed column), `technical_impact`→`severity`, `reachability`→`reachability`. The human-readable `impact` summary is retained for the cockpit, but **authority is never parsed from it**. Retry-idempotent unchanged: deterministic `finding_ref` + `ON CONFLICT DO NOTHING` — a re-run neither duplicates NOR alters the typed columns (proven `updated_at` identical across retries).

### Readiness consumes the typed lever (`ops.checkpoint_effective_readiness` replaced via create-or-replace; `review/readiness.mjs` surfaces two new advisory columns)
"Current material for checkpoint C" is recognised **structurally**: `finding ← review_run_finding(relation='opened') ← review_run ← review_packet(checkpoint_id=C)` — never by impact-text parsing. When `role_based_readiness` is **ON**:
- an open current finding with `required_disposition = BLOCKS_CURRENT_MERGE` → **structurally NOT merge-ready**;
- other dispositions do NOT block by themselves;
- an open current **classifier-produced** finding MISSING its `required_disposition` (NULL, but review_run-linked) → **fail closed**;
- LEGACY findings (never review_run-linked, `required_disposition` NULL) are OUT of scope — they neither block nor fail closed, staying behind the compatibility path.
When the flag is **OFF → the legacy both-required path is byte-for-byte unchanged** (the lever is advisory-only and cannot leak into the OFF path). Two appended advisory columns: `role_based_disposition_blocked`, `role_based_unclassified_finding`.

### Tests (EXECUTED, throwaway Postgres) — runtime suite now **22/22** (17 + 5 new)
`006` is added to the runtime suite's migration set. New named tests: **7a** flag OFF → historical readiness unchanged (a BLOCKS finding does not leak into the OFF path); **7b** flag ON → a non-blocking disposition does NOT block + a legacy open finding does not fail closed; **7c** flag ON → a BLOCKS_CURRENT_MERGE finding structurally blocks **even with all roles satisfied** (the block is isolated to the lever, roles unchanged); **7d** flag ON → a classifier finding missing its `required_disposition` fails closed; **7e** retry does not duplicate or alter the typed classification records (`updated_at` identical). **Regression re-run, all green:** db/001 25/25 · contract/003 11/11 · registry/004 9/9 · worker 23/23 · WP-C 14/14 · WP-D0 9/9.

### Prompt fingerprint — UNCHANGED (no prompt bytes touched)
This slice changes **zero** prompt-component bytes (`tower-qa-skill.md`, `reviewer-classification-amendment.md`, `product-qa-runtime-orientation.md`, `prompt-approvals.json` all untouched), so no re-approval is triggered. The campaign approval remains bound to the orientation hash `cd65539a…253135` (intact).

> **✓ Fingerprint reconciliation (Larry, 2026-07-20).** An earlier draft of this note recorded stale intermediate fingerprints (composed `6b3bc8e5…`, classification-amendment `6f963043…`). The § Fingerprints table + the prompt_version stamp above are now corrected to the **authoritative values computed by the runtime's own `loadProductQaPrompt()` at this head**: base `f2fc2f26…`, classification-amendment `5c254258…`, orientation `cd65539a…` (the campaign-approval anchor — intact + verified), composed `02fdfbc8…` (the value stamped on every `review_run.prompt_fingerprint`). No prompt-component bytes changed at any point; the classification component's content was verified faithful to the APPROVED+LIVE amendment. Approval remains bound to the orientation hash `cd65539a…`.
