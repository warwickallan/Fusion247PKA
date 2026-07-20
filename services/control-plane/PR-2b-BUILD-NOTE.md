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
