---
build: BUILD-010
component: Fusion Tower / Governance Mode
wp: WP0
artifact: codex-review-draft
status: draft — NOT posted to ClickUp (bounded write not yet authorised)
author: gpt_codex (OpenAI Codex, independent reviewer) — turn driven by Mack via the Fusion Tower dispatcher
reviewed_branch: build-010/wp0-fusion-tower
reviewed_head_sha: c3e7351
created: 2026-07-17
---

# BUILD-010 WP0 — Independent Codex Review (DRAFT)

Parent build: [[BUILD-010-fusion-tower]] · Reviewer contract: [[fusion-tower-operating-instructions]]

> **This is the FULL detailed review, staged as a draft.** In WP0 the bounded
> ClickUp write is **not yet authorised**, so this review is NOT posted to the
> ClickUp control thread (`869e5zu97`). The draft file is the deliverable. When the
> bounded write is authorised, this is the content the Tower posts (the reviewer's
> `proposed_action` was `post_review`).

## Provenance — how this review was produced

- **Reviewer identity:** the INDEPENDENT OpenAI/Codex reviewer (`gpt_codex` = provider `openai-codex`) — **not Larry**. Genuinely separate model + runtime + session from the Claude-Code author, so this satisfies [[SOP-018-independent-change-qa]] for the claims below.
- **Tower-OWNED invocation:** driven through `codexAdapter` + `dispatcher` (not a bare CLI call). One bounded, read-only turn.
- **Binary:** `…\OpenAI\Codex\bin\5dee10576ec7a5b8\codex.exe` (discovered by newest-mtime, hash NOT hard-coded), `codex-cli 0.145.0-alpha.18`.
- **Auth:** ChatGPT-OAuth via `auth.json` (no API key). Exec flags: `--sandbox read-only --skip-git-repo-check --ignore-user-config --json --output-schema <file> -C <workdir> -` (prompt on stdin).
- **Signed honest envelope (verified):**
  - `agent: gpt_codex`, `provider: openai-codex`, `model_id: openai-codex-exec`
  - `run_id: 61205a0b-5782-4a99-85de-d5b8cbadb905`, `ordinal: 1`, `head_sha: c3e7351`, `ts: 2026-07-17T12:24:32Z`
  - HMAC-SHA256 signature `9746e213…6b524` — **verifyEnvelope → true**
- **Token spend:** 3932 tokens (one turn).

## Verdict

**`request_changes`** — three of four claims confirmed; the DB-side honest-identity claim is **partial** (code is pinned; the DB CHECK is not per-principal). One MEDIUM finding, one INFO boundary.

> Reviewer summary (verbatim): "Reviewed staged evidence and actual disk implementation. `git diff main...build-010/wp0-fusion-tower` worked in-sandbox. Live GitHub/CI fetch was not verified: network/remote git attempt was blocked by policy. Three claims are confirmed; the DB-side honest-identity claim is only partial because the CHECK constrains provider to an allowed set but does not enforce principal-to-provider mapping."

## Per-claim verification

| # | Claim | Status | Evidence (file:line) |
|---|---|---|---|
| 1 | RLS deny-by-default on every `ftw` table | **confirmed** | Tables `agent_identity`, `governance_run`, `run_turn`, `run_event` at `migrations/0001_wp0_control_plane.sql:131,166,235,309`; RLS enabled lines 396-399; only `service_role` granted policies lines 435-460; line 462 states no anon/authenticated policies. |
| 2 | No autonomous merge — no adapter/dispatcher path can merge/push | **confirmed** | `guardrails.js:22-30` omits merge/push from `ALLOWED_ACTIONS`; `:34-38` forbid merge/force_push/etc.; `:45-55` throw on forbidden/unlisted. `dispatcher.js:207-212` calls `assertNoAutonomousMerge` before recording/surfacing. `larryAdapter.js:25-36` read/safe-git only, rejects merge/push. `codexAdapter.js` read-only flags + never-merge prompt. |
| 3 | Honest identity — `gpt_codex` pinned to `openai-codex` in BOTH DB CHECK and code | **partial** | Code IS pinned: `envelope.js:19-24` maps gpt_codex→openai-codex; `:55-67` throw on dishonest/forbidden labels; `:96-97` enforce in `buildEnvelope`. Seed correct at `migrations/0001…sql:381-385`. **But** the DB CHECK `:146-152` only checks provider ∈ allowed set — it does not enforce that `principal='gpt_codex'` requires `provider='openai-codex'`. |
| 4 | Vex F-HIGH-01 (shell-injection) + F-MED-01 (HMAC fail-open) remediated | **confirmed** | F-HIGH-01: `larryAdapter.js:220` spawn `shell:false` + stdin prompt `:232-233`; `codexAdapter.js` spawn `shell:false` + stdin prompt. F-MED-01: `dispatcher.js:81-112` live mode requires secret/envelope/signature and rejects missing/bad; `tower.js:27-40` startup fail-closed when live signing secrets absent. |

## Findings

### F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL — MEDIUM

- **Evidence:** `migrations/0001_wp0_control_plane.sql:146-152` defines `agent_identity_provider_honest_chk` as `provider IN (...)`. Seed at `:381-385` is correct (gpt_codex→openai-codex), but the CHECK would also allow `gpt_codex` with provider `human`, `fusion-tower`, or `anthropic-claude-code`.
- **Rationale:** The control-task claim says gpt_codex is pinned to openai-codex **in the DB CHECK**. The current constraint enforces an allowed provider *vocabulary*, not the *principal→provider binding*. The code pin is correct, but the database invariant can drift after seed insertion (an UPDATE could relabel gpt_codex to another allowed provider without violating the CHECK).
- **Required correction:** Replace/extend the DB CHECK with a per-principal mapping, e.g. `(principal='gpt_codex' AND provider='openai-codex') OR (principal='larry' AND provider='anthropic-claude-code') OR (principal='warwick' AND provider='human') OR (principal='tower' AND provider='fusion-tower')`.

### F-INFO-CI-NOT-LIVE-VERIFIED — INFO (sandbox boundary)

- **Evidence:** `git ls-remote https://github.com/Fusion247/Fusion247PKA.git HEAD` was **rejected by sandbox policy**. Local `git diff main...build-010/wp0-fusion-tower` **succeeded** and returned the branch diff.
- **Rationale:** The reviewer could inspect the implementation on disk and compare against the local diff, but could not fetch live GitHub CI status from the network boundary in this read-only sandbox.
- **Required correction:** Treat live CI as unverifiable from this reviewer run; verify GitHub Actions/CI in an environment with authorised network access (the Tower would stage CI evidence as a further pointer).

## Sandbox boundary (recorded)

| Capability | In read-only sandbox | Note |
|---|---|---|
| Local file reads (`Get-Content`, `findstr`, `rg`) | **allowed** | Reviewer read the migration, dispatcher, guardrails, envelope, adapters, config, tower. |
| Local `git diff` / `git status` / `git rev-parse` | **allowed** | `git diff main...build-010/wp0-fusion-tower` returned the diff. |
| Network / remote git (`git ls-remote`) → live GitHub CI | **blocked by policy** | Confirms the Tower must stage CI evidence as a pointer; the reviewer cannot fetch live CI. |
| Writes / merge / push | **blocked** (and never proposed) | Read-only turn; `proposed_action = post_review`. |

## Masked transcript (evidence of real investigation)

Codex `--json` event stream: `thread.started`×1, `turn.started`×1, `command_execution`×52 (25 unique read-only commands), `agent_message`×2, `turn.completed`×1. No secret appeared in the stream. Representative read-only commands executed:

```
git status --short --branch
git diff main...build-010/wp0-fusion-tower -- services/fusion-tower/migrations/0001_wp0_control_plane.sql
Get-Content -LiteralPath _ftw_evidence_tmp.md            # the staged ClickUp control task
Get-Content -LiteralPath services/fusion-tower/migrations/0001_wp0_control_plane.sql
Get-Content -LiteralPath services/fusion-tower/src/{dispatcher,core/guardrails,core/envelope,config,tower}.js
Get-Content -LiteralPath services/fusion-tower/src/adapters/{larryAdapter,codexAdapter}.js
rg -n "merge|push|spawn|exec|shell|stdin|verifySignedResult|signingSecret|isRuntimeReady" services/fusion-tower/src
git diff --name-status main...build-010/wp0-fusion-tower
git ls-remote https://github.com/Fusion247/Fusion247PKA.git HEAD   # BLOCKED by policy (network boundary)
```

## Posting status

**NOT posted to ClickUp.** The bounded ClickUp write is not yet authorised in WP0 (Warwick gate). This draft is the deliverable. `proposed_action.type = post_review`, `target = build-010/wp0-fusion-tower` — the Tower would post this review to control task `869e5zu97` once the bounded write is authorised.

## Reviewer-quality note

The review is genuinely independent and non-rubber-stamp: it produced a substantive MEDIUM finding (the DB CHECK enforces a provider vocabulary, not the per-principal binding — the code pin is correct but the DB invariant can drift) that the same-model author's own review did not surface, and it honestly recorded the network/CI boundary rather than guessing CI status.
