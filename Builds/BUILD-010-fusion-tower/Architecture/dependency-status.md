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
| **ClickUp bounded write** | **PROVEN (one authorised write)** | Warwick authorised exactly one bounded comment (LRY-...-HANDOFF-0001). The Tower composed + target-validated (only `869e5zu97` writable; substitution refused; one-write guard; self-marker; redaction — `clickupPoster.js` + tests). Posted once → ClickUp comment id **`90120242550572`**. Round-trip read-back confirmed live. No other task/field changed. |
| **Larry no-relay handoff** | **PROVEN** | Tower state → staged authorised read-back → one bounded real-`claude` Larry turn → Larry independently read verdict `approve` + SHA `9fda8fd` (neither in the prompt) → signed ack (signer `larry`, verifyEnvelope→true) → dispatcher recorded. No human copy-paste; no second ClickUp write. [[larry-norelay-ack-2026-07-17]]. |
| **Codex MEDIUM (F-MED-DB-...)** | **CLOSED** | Migration `0002` per-principal binding CHECK (Silas); Vex bounded delta **GREEN**, MEDIUM closed; Codex re-review of the fix verdict **approve**, 0 new findings. [[wp0-delta-review-identity-binding-2026-07-17]], [[codex-rereview-2026-07-17]]. |
| **OpenAI API key** | **NOT REQUIRED** | The existing route authenticates via ChatGPT-OAuth. `codexReady`/`CODEX_API_KEY` remain a valid alternate, but the live route needs no API key and no billing budget. |
| **Telegram Desktop** | **INSTALLED — operator client only** | `%APPDATA%\Telegram Desktop\Telegram.exe` v7.0.1.0, `tdata` session present (existence noted only; NOT launched/automated, credentials untouched). A visible notification/control client for Warwick later — NOT a bot-token substitute. |
| **Telegram bot architecture** | **OPEN** | Separate Tower bot token vs shared router with the BUILD-002 capture bot — Warwick decision (a second long-poll on the capture bot's token would 409). No BotFather/webhook/polling change made. |
| **Live Supabase migration** | **NOT APPLIED** | 0001/0002 are design+CI-proven only; no live `ftw` apply (Warwick/Vex-gated). |
| **Windows service** | **NOT INSTALLED** | Registration scripts + runbook provided (announce-only). Must run as user `Buggly` for Codex auth (see boundary below). |

## Windows-owned-context identity/auth boundary (carried into the runbook)

The binary resolves by path (a Windows **service** finds it with no PATH entry).
Auth is **user-scoped**: `auth.json` lives under `%USERPROFILE%\.codex`, so the
dispatcher must run **as the authenticated user** (here `Buggly`) OR carry a
`CODEX_API_KEY`. A service as `LocalSystem`/other account is NOT authenticated and
every Codex turn fail-closes to a `no_credential` blocker. Full detail:
[[tower-host-runbook]] §1a.

## Independent-review finding — CLOSED

The first live review raised **F-MED-DB-CODEX-PROVIDER-CHECK-NOT-PER-PRINCIPAL**:
the DB CHECK enforced a provider *vocabulary*, not the *principal→provider* binding.
**Closed** by migration `0002_wp0_identity_provider_binding.sql` (Silas) — an exact
four-pair binding CHECK, total over the `ftw.principal` enum, with real-Postgres
tests (valid pairs / cross-pair rejection / invalid provider / update-drift / RLS).
Vex bounded delta review **GREEN** (MEDIUM closed, 0 regressions); the Tower-owned
Codex re-review of the discrete `0002` delta returned **approve**, 0 new findings.
0001 remains byte-immutable. This closes the honest-identity claim at BOTH the code
and DB layers.
