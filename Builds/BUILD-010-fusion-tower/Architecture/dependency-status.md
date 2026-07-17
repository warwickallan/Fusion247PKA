---
build: BUILD-010
component: Fusion Tower / Governance Mode
wp: WP0
artifact: dependency-status
status: living-ledger
author: mack
created: 2026-07-17
updated: 2026-07-17
---

# BUILD-010 WP0 — Dependency status ledger

Parent build: [[BUILD-010-fusion-tower]]

The live-dependency posture for the Codex live-controller spike. Updated as gates
clear. Evidence: [[codex-review-draft-2026-07-17]] (one live Tower-owned turn),
[[wp0-synthetic-proof]] (synthetic loop), [[tower-host-runbook]] (host/auth boundary).

## Ledger

| Dependency | Status | Evidence / note |
|---|---|---|
| **Codex binary** | **CLOSED** | Discovered by path (never PATH), newest-mtime of `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe`; `<hash>` = `5dee10576ec7a5b8` today but the **hashed dir changes on update** so it is never hard-coded (a sibling hashed dir holding only `rg.exe` is skipped). Version `codex-cli 0.145.0-alpha.18`. `CODEX_BIN` env overrides. `resolveCodexBin()` in `codexAdapter.js`. |
| **Authentication** | **PROVEN** | ChatGPT-OAuth via `%USERPROFILE%\.codex\auth.json` (`tokens` block) → runs UNATTENDED, **no OpenAI API key required**. Adapter checks existence + key NAMES only (never values); observed key names: `auth_mode, OPENAI_API_KEY, tokens, last_refresh`. API key is an accepted alternate, not a requirement. |
| **Unattended Tower invocation** | **PROVEN** | One live, bounded, read-only turn driven THROUGH `codexAdapter` + `dispatcher` (not a bare CLI call) returned a schema-conforming, HMAC-signed, honestly-labelled result (`gpt_codex=openai-codex`, verifyEnvelope→true), verdict `request_changes`, 3932 tokens. Fail-closed blockers proven for malformed/timeout/non-zero-exit (unit tests). |
| **Structured output** | **PROVEN (with constraint)** | `--output-schema` works, BUT OpenAI structured-outputs STRICT mode requires `additionalProperties:false` on every object + all properties in `required` (a non-strict schema → HTTP 400 `invalid_json_schema`). `CODEX_RESULT_SCHEMA` is fully strict. |
| **GitHub read (independent)** | **PROVEN (local) / BLOCKED (network)** | In-sandbox `git diff main...build-010/wp0-fusion-tower`, `git status`, `git rev-parse`, and file reads **worked**. Network/remote git (`git ls-remote`) was **rejected by sandbox policy** → the reviewer cannot fetch live GitHub CI. The Tower must stage CI evidence as a pointer. |
| **ClickUp read (independent)** | **PROVEN (via staged governed read)** | Larry performed the authorised live ClickUp READ; the Tower staged it (`clickup-control-task.md`) and the reviewer read it in-sandbox (`_ftw_evidence_tmp.md`). Codex does not itself hold a ClickUp credential in this route. |
| **ClickUp bounded write** | **NOT YET AUTHORISED** | Warwick gate. The full review is staged as [[codex-review-draft-2026-07-17]] (`proposed_action = post_review`, target task `869e5zu97`); nothing was posted. |
| **OpenAI API key** | **NOT REQUIRED** | The existing route authenticates via ChatGPT-OAuth. `codexReady`/`CODEX_API_KEY` remain a valid alternate, but the live route needs no API key and no billing budget. |

## Windows-owned-context identity/auth boundary (carried into the runbook)

The binary resolves by path (a Windows **service** finds it with no PATH entry).
Auth is **user-scoped**: `auth.json` lives under `%USERPROFILE%\.codex`, so the
dispatcher must run **as the authenticated user** (here `Buggly`) OR carry a
`CODEX_API_KEY`. A service as `LocalSystem`/other account is NOT authenticated and
every Codex turn fail-closes to a `no_credential` blocker. Full detail:
[[tower-host-runbook]] §1a.

## Independent-review finding to carry forward

The live review raised **F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL**: the DB
`agent_identity_provider_honest_chk` enforces a provider *vocabulary*, not the
*principal→provider* binding — so the honest-identity claim is **partial at the DB
layer** (code is fully pinned). Owner: Silas (migration). Tracked in
[[codex-review-draft-2026-07-17]]; a fix belongs in a follow-up migration, not this
read-only spike (no live Supabase apply authorised here).
