---
agent_id: mack
session_id: build-010-wp0-codex-live-controller
timestamp: 2026-07-17T13:28:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-010 WP0 — Codex live-controller spike (steps 4-7)

Worktree `C:\Fusion247PKA-b010`, branch `build-010/wp0-fusion-tower`. Built on Larry's
steps 1-3 (binary/auth/exec-shape/honest-identity findings). Commits: `42692ef` (step 4),
`e6cacce` (step 5), `c3e7351` (step 6a), `50095c3` (steps 6b+7). Not pushed.

## What I did

- **Step 4 — Tower-owned Codex invocation.** Rewrote `codexAdapter.js`: discovers the real
  `codex.exe` by newest-mtime under `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\` (hash never
  hard-coded; helper-only dirs like the `rg.exe` one are skipped; `CODEX_BIN` overrides).
  Authenticates via ChatGPT-OAuth `auth.json` (existence + key NAMES only, never values) OR
  an API key; absent both → fail-closed `no_credential` blocker, no spend. Proven exec shape
  `--sandbox read-only --skip-git-repo-check --ignore-user-config --json --output-schema
  <file> -C <workdir> -`, prompt on stdin, `shell:false` (strengthens F-HIGH-01). Distinct
  fail-closed blockers for malformed/timeout/exec_failed. Tests: Tower-owned dispatch through
  the dispatcher + robustness + discovery/auth units. Recorded the SYSTEM-vs-user auth
  boundary in the runbook.
- **Step 5 — Operating Instructions.** New `fusion-tower-operating-instructions.md`: reviewer
  = independent OpenAI/Codex (NOT Larry; persona-neutralised via `--ignore-user-config` + an
  explicit prompt), pointer-inputs (never the corpus), method, output (full review→ClickUp,
  compact→Tower). Linked from control + INDEX; the adapter prompt follows it.
- **Step 6a — synthetic reviewer wiring** test (fake GitHub+ClickUp+fake-codex → signed
  structured review, zero live calls).
- **Step 6b — ONE live turn.** Real Codex review through adapter+dispatcher: signed honest
  envelope (verifyEnvelope true), verdict `request_changes`, 3932 tokens. Full review staged
  as `codex-review-draft-2026-07-17.md`; NOT posted to ClickUp (bounded write unauthorised).
- **Step 7 — `dependency-status.md`** ledger.

## What the next agent should know

- **Two genuine bugs found + fixed (not reviewed security claims):** (1) the dispatcher passed
  `boundedContext` but both stores persist `boundedContextRef` → the bounded context was
  silently DROPPED on every turn (adapters fell back to a default task; no pointers ever
  reached a responder). Fixed the key mapping in `dispatcher.js`. (2) `--output-schema`
  rejected a non-strict schema with HTTP 400 `invalid_json_schema` — OpenAI structured-outputs
  STRICT mode requires `additionalProperties:false` on every object AND every property in
  `required`. `CODEX_RESULT_SCHEMA` is now fully strict.
- **The live reviewer raised a real MEDIUM the same-model author missed:** the DB
  `agent_identity_provider_honest_chk` enforces a provider *vocabulary*, not the *per-principal*
  `gpt_codex→openai-codex` binding — so the honest-identity claim is **partial at the DB layer**
  (code is fully pinned). Follow-up migration for **Silas**; do NOT apply live here (no Supabase
  apply authorised in this spike).
- **Sandbox boundary (recorded):** in read-only mode local `git diff`/file reads WORK; network
  (`git ls-remote`) is BLOCKED → the reviewer cannot fetch live GitHub CI. The Tower must stage
  CI evidence as a pointer.
- **API key NOT required** for the live route (ChatGPT-OAuth). Host must run the dispatcher as
  the authenticated user (`Buggly`) or provide `CODEX_API_KEY`; SYSTEM/other account fail-closes.
- **Remaining Warwick gates:** authorise the bounded ClickUp write (to post the review to task
  `869e5zu97`); decide the follow-up migration for the F-MED DB CHECK; live Supabase migration
  apply; Telegram bot-token decision. `proof-e2e` codex is now pinned to record-blocker (host is
  authenticated) to avoid live spend.

## Verify

`node --test`: 108 tests, 94 pass, 14 skipped (DB-gated), 0 fail. Secret scan clean (378
tracked files, 0 secret values). No secret exposed (auth.json read as key-NAMES only). Live
turn transcript captured (masked) in scratchpad + rendered into the draft.
