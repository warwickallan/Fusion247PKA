---
build: BUILD-010
component: Fusion Tower / Governance Mode
wp: WP0
artifact: wp0-security-review
reviewer: vex
review_method: re-execution (ran the suite + secret scan + own probes; privileged paths read line-by-line)
worktree: C:\Fusion247PKA-b010
branch: build-010/wp0-fusion-tower
head: 3f8423a
date: 2026-07-17
verdict: GREEN-WITH-CONDITIONS
critical: 0
high: 1
medium: 1
low: 1
info: 4
---

# Fusion Tower — WP0 Security Delta Review (Vex)

Parent build: [[BUILD-010-fusion-tower]]

## Verdict — GREEN-WITH-CONDITIONS

The WP0 delta is safe to advance with two conditions attached to the live-adapter path. No CRITICAL findings, no committed secret, no autonomous-merge code path, identity honesty is locked in both DB and code, RLS is deny-by-default service_role-only, and every guardrail is tested as an executable control. The two conditions (one HIGH, one MEDIUM) are latent — neither is remotely reachable in WP0's current wiring — but both must be closed before the live acceptance proof spawns a real agent with any event-influenced prompt content.

Review was by re-execution, not trust: I ran the full test suite (85 tests: 71 pass, 0 fail, 14 DB-gated skips) and the tracked-file secret scanner (373 files, 0 secrets, exit 0) myself, ran my own merge-path / injection probes, and read every privileged path line-by-line. I never read a secret value and did not apply the migration or touch any live Supabase / Telegram / GitHub / ClickUp surface.

### Severity counts
- CRITICAL: 0
- HIGH: 1
- MEDIUM: 1
- LOW: 1
- INFO: 4 (positives / hardening notes)

---

## Gated live actions — explicit YES/NO

| # | Gated live action | Verdict | Gate |
|---|---|---|---|
| a | Apply migration `0001_wp0_control_plane` to the live `ftw` schema | **YES** | Static-verified clean; RLS deny-by-default, service_role-only, honest CHECK, dedup constraints real, idempotent seed, zero secrets/PII. Silas applies on Warwick's authority. |
| b | Provision host `.env` and run the dispatcher live | **YES — with conditions** | Config masks every secret; `.env` gitignored; fixtures/fail-closed model sound. Conditions: set `DATABASE_SSL_CA_FILE` (verify-full TLS) AND provision all three `TOWER_HMAC_SECRET_*` so signatures are actually verified, not silently skipped (F-MED-01). The runtime `tick()` does not auto-dispatch adapter turns, so no untrusted content reaches a spawn on this path. |
| c | Open the WP0 PR | **YES** | Tree clean, tests green, scan clean, no secrets, no merge path. Opening a PR is a human action; the Tower performs none. |
| d | Proceed to the live acceptance proof once Warwick's credential gates are met | **YES — with conditions** | This is the only path that spawns a real `claude`/`codex`. Conditions: (i) close F-HIGH-01 (Larry-adapter `shell:true` argv injection) OR confirm the live proof feeds only constant/trusted prompt content with no event-derived text reaching the Larry prompt; (ii) provision + require all HMAC signing secrets (F-MED-01). Not a RED — the injection is not remotely reachable in WP0 wiring — but the fix must land before any WP wires event text into a prompt. |

There is no RED / no-override finding in this delta.

---

## Scope verification (each item, with evidence)

### 1. NO AUTONOMOUS MERGE — hard invariant — LOCKED
- `src/core/guardrails.js`: `FORBIDDEN_ACTIONS` includes merge, merge_pr, squash_merge, rebase_merge, delete_branch, force_push, delete_repo, close_pr_and_delete, deploy, release, delete_task; `ALLOWED_ACTIONS` is a closed set that excludes merge. `assertNoAutonomousMerge()` throws on any forbidden verb AND on any verb not in the allow-list (deny-by-default).
- `src/dispatcher.js:170-173`: every adapter-proposed `proposed_action` is passed through `assertNoAutonomousMerge()` and `assertWithinScope()` BEFORE it is recorded or surfaced.
- `src/adapters/larryAdapter.js`: `LARRY_ALLOWED_TOOLS` is a fixed constant (Read/Grep/Glob/Edit/Write + `git diff/log/status` only). `assertNoMergeTool()` scans it for the substrings merge/push/gh pr merge/force at construction and throws if any appear. The list is not derived from run state, so it cannot be widened at runtime. Codex adapter runs `--sandbox read-only --ask-for-approval never`.
- Merge-path grep across `src/` returns only guardrail code, comments, and the `no_autonomous_merge` DB flag — no `gh pr merge`, no `PUT /pulls/{n}/merge`, no merge REST call, no `git push` anywhere.
- Tested as a control: `guardrails.test.js` (no-autonomous-merge blocks merge and destructive actions), `dispatcher.test.js` (runTurn REJECTS a merge action; surfaceReady emits exactly one READY notice and never merges).
- The `ready` outcome routes to `awaiting_decision` (human merge decision), never a merge — confirmed in `dispatcher.surfaceReady`.

### 2. HONEST SIGNED IDENTITY — LOCKED
- DB pin: migration 0001 `agent_identity_provider_honest_chk` constrains `provider` to {anthropic-claude-code, openai-codex, human, fusion-tower}; the seed row binds gpt_codex -> openai-codex. A future edit relabelling gpt_codex as xAI/Grok fails the CHECK.
- Code pin: `core/envelope.js` `HONEST_PROVIDER` maps gpt_codex -> openai-codex, plus an explicit `FORBIDDEN_CODEX_LABELS` deny-list (xai-grok, grok, xai, ...). `assertHonestLabel()` throws on any mismatch; `buildEnvelope()` calls it on every envelope; the Codex adapter passes provider openai-codex explicitly. Nothing anywhere labels it xAI/Grok.
- Signature verification is real and fail-closed: `verifyEnvelope()` re-asserts the honest label, HMAC-SHA256 over RFC-8785-style canonical bytes, `crypto.timingSafeEqual` constant-time compare, length-mismatch guarded. `dispatcher.verifySignedResult()` throws (rejects the return) on a bad signature. Tested: tampered payload, tampered provider label, wrong secret, and wrong-signer all fail verification (`envelope.test.js`, `guardrails.test.js` signer-must-match-responder).
- Signing-secret handling: per-principal, read from env NAMES only (`config.signingSecret(principal)`), never returned to any external surface; `agent_identity.signing_key_ref` stores the env NAME (pointer), never a key value — enforced by column comment + the migration security-gate banner. No secret in VCS/logs/state.

### 3. GUARDRAILS enforced, not cosmetic — CONFIRMED
- Scope-lock: `isWithinScope`/`assertWithinScope` (repo + action + path-glob); forbidden verbs are never in scope regardless of lock. Tested.
- Max review rounds (default 2): `DEFAULT_MAX_REVIEW_ROUNDS = 2`; enforced in the loop (`roundBudgetOk`, `dispatcher.dispatchNextTurn`) AND in SQL (`governance_run_round_within_max_chk`, round_count <= max_rounds). Tested both layers.
- Token/time budget: `budgetOk` terminates on overspend or passed deadline; enforced in the loop. Tested.
- Decision gates: `openDecisionGate` parks the run in `awaiting_decision` with decision_required = true and does not auto-resolve; terminal outcome decision_required. Tested.
- 5-min dead-man watchdog: `dispatcher.watchdog()` + `store.watchdogSweep()` touch only state=dispatched with lease_deadline_at <= now() (partial index `run_turn_watchdog_idx`); a returned turn is never clobbered; reaped turns retry within budget (new ordinal, append-only) or terminalise to timed_out. Tested (reaps only EXPIRED dispatched turns; a returned turn is untouched; retry-vs-terminal).
- Terminal-only Telegram: `telegramControls.notifier` throws on any non-terminal notice kind; only READY/BLOCKED/TIMED_OUT/DECISION_REQUIRED/CLOSED reach the outbox; `/status` is an explicit pull, not a push. Tested (notifier REFUSES a non-terminal notice kind).

### 4. RLS + schema posture (migration 0001) — CONFIRMED (static)
- RLS `enable row level security` on all four tables (agent_identity, governance_run, run_turn, run_event).
- One permissive `FOR ALL TO service_role` policy per table; no anon/authenticated grant and no anon/authenticated policy -> both the privilege check and RLS deny them (deny-by-default from both gates).
- Concurrency-safe role guard (inner exception blocks) carried from BUILD-002 0003.
- No enum/table name collision (enums run_status/run_outcome/turn_state/principal/event_source vs tables governance_run/run_turn/run_event/agent_identity).
- Dedup real UNIQUE controls: `run_event_source_eventid_key` (primary) + partial-unique `run_event_source_headsha_kind_key` (secondary, GitHub redelivery/self-storm). Turn idempotency `run_turn_run_ordinal_key`. Advance-once = `processed` flag flipped exactly once via `markEventProcessed ... where processed = false`.
- Evidence/payload columns are pointers only; column comments forbid storing secrets/content. No PII; the four seed rows are non-secret reference data.
- The RLS/dedup/advance-once/idempotency behaviours are written as integration tests (`postgresStore.integration.test.js` #1-14) and correctly skip without a DB — verified statically here; must not be applied live in this review.

### 5. SECRET HYGIENE — CLEAN
- `config.js` reads env NAMES only; `maskSecret()` returns a masked marker / (unset); `describe()` masks every secret; `signingSecret()` (value) is documented in-process-only; `signingSecretEnvName()` returns the NAME. `tower.js` startup log uses `describe()` (masked).
- `.gitignore` ignores `.env` / `.env.*` and un-ignores `.env.example`. Only `.env.example` is tracked (git ls-files confirms — names with empty values, no real values).
- Secret scanner (`scripts/secret-scan.sh`) run from the worktree: clean — 373 tracked files, 0 secret values, exit 0.
- Codex adapter passes the API key via env only, never on argv (avoids a process-list leak) — verified in `runCodex`.

### 6. EVENT INTAKE trust boundary — CONFIRMED
- Self-loops ignored: `claimNextEvent` filters self_generated = false AND source <> tower (both memory + Postgres stores); `TOWER_SELF_MARKER` flags the Tower's own comments; `ingestEvent` sets selfGenerated from marker or source=tower.
- Dedup rejects provider redelivery (primary key) + same-head-SHA storms (secondary partial-unique, code 23505 handled as a no-op read-back). Proven in the synthetic E2E (redelivery_isNew:false, sha_rerun_isNew:false).
- Malformed events create no state: `normalizeGithubEvent`/`normalizeClickupEvent` return null for unrecognised shapes; `ingestEvent` throws if source/sourceEventId missing.
- Untrusted comment bodies are dropped at intake — the GitHub comment payload stores only pr_ref/author/is_self, never the body. Good defensive minimisation (also closes a prompt-injection feed; see F-HIGH-01).
- Telegram control surface: `isAuthorised` is fail-closed — requires a configured numeric allowlist id AND chatType === private AND a matching user id, checked BEFORE any dispatcher action. Unauthorised/group commands do nothing and disclose nothing (recorded to an internal `rejected` audit array, no reply). Tested (unauthorised update is fail-closed and audited).

### 7. ADAPTER injection surface — one HIGH (latent), otherwise sound
- Codex adapter is safe from argv injection: `CODEX_EXEC_FLAGS` is a fixed constant and the prompt is fed via stdin (`-`), not argv; the API key is env-only.
- Larry adapter has a latent command-injection surface via `shell:true` on Windows with the prompt on argv — see F-HIGH-01. Not remotely reachable in WP0 wiring.
- Sandbox intent: Codex `--sandbox read-only --ask-for-approval never --ephemeral --ignore-user-config`; Larry `--permission-mode plan` + the scoped `--allowedTools`. Fail-closed when the binary/credential is absent (signed blocked result, never a hang, never an auto-install). Windows-sandbox caveat for Codex is honestly recorded in the adapter header (Pax R3).

---

## Findings

### [HIGH] F-HIGH-01 — Larry adapter spawns with shell:true on Windows and an unescaped prompt on argv (latent command injection)

**Where:** `services/fusion-tower/src/adapters/larryAdapter.js` — `runClaude()` line 207 (`spawn(claudeBin, argv, { cwd, shell: process.platform === 'win32' })`), with `argv = ['-p', prompt, ...]` and `prompt` built by `buildLarryPrompt()` from `run.scope` / `run.title` / `boundedContext.task` (lines 52-63, 165-172).

**What:** When `shell` is true, Node hands the whole command line to `cmd.exe /d /s /c` by naively joining argv with spaces and performs no escaping (Node's own docs warn: if the shell option is enabled, do not pass unsanitized user input; any input containing shell metacharacters may be used to trigger arbitrary command execution). The prompt is a single argv element carrying `run.scope` / `boundedContext.task`. A value containing cmd.exe metacharacters (& | > < ^ %VAR% ") breaks out of the `claude` invocation and executes on the always-on host.

**Reachability (why HIGH, not CRITICAL):** not remotely reachable in WP0 today — (a) `run.scope` is fed only by the Telegram `/start` argline, gated to the single authorised user (Warwick); (b) GitHub/ClickUp comment bodies are dropped at intake, so no external text reaches the prompt; (c) the runtime `tick()` does not auto-dispatch adapter turns with event-derived `boundedContext`. It becomes exploitable the moment a future WP wires event text (PR title, task name, comment body) into `boundedContext.task`.

**Reproduction:** withheld from this public record. A prompt-derived value containing shell metacharacters is interpreted by `cmd.exe` rather than passed as prompt text; the private verification step below reproduces it against a fake spawn. (Public-repo responsible-disclosure: finding, location, and fix are recorded; the working payload is not.)

**Fix recommendation:** feed the prompt to `claude` via stdin (mirror the Codex adapter's `-` + `child.stdin.write(prompt)` pattern) and spawn with shell:false; if a Windows shim (`claude.cmd`) forces shell:true, resolve the concrete binary path and spawn without a shell, or `execFile` it. Never place untrusted-influenced text on an argv element under shell:true. Keep the intake body-drop as the second layer.

**Verification step:** re-run with `boundedContext.task = 'x & echo INJECTED > pwned.txt'` against a fake spawn that records the exact argv/stdin; assert the payload appears only as a single inert prompt token/stdin body and that no second command is constructed. Add a unit test asserting shell is false (or the prompt is on stdin) for the Larry spawn.

### [MEDIUM] F-MED-01 — HMAC signature verification is silently skipped when a per-principal signing secret is unset (fail-open on misconfiguration in live mode)

**Where:** `services/fusion-tower/src/dispatcher.js:70-78` (`verifySignedResult`: `if (secret && result.envelope && result.signature) { verify }`); mirrored by the adapters, which emit an unsigned envelope when `config.signingSecret(principal)` is null (`larryAdapter.js:126-132`, `codexAdapter.js:105-107`).

**What:** In fixtures mode this is correct. But in live/runtime-ready mode, if an operator provisions `DATABASE_URL` yet forgets a `TOWER_HMAC_SECRET_*`, turn results are recorded unsigned and unverified — the cryptographic integrity control degrades silently instead of failing closed. The identity-honesty invariants still hold unconditionally (`assertSignerMatchesResponder` and the honest-label assertion always run, regardless of secret), so a gpt_codex result can never be relabelled larry; only the envelope-byte integrity check is skipped. Practical forgery risk in WP0 is low because adapters are in-process (the result is a direct return value, not a network message) — HMAC is defense-in-depth for a future host split — hence MEDIUM.

**Fix recommendation:** in live mode (`config.isRuntimeReady()`), require a signing secret for every `can_sign` principal and refuse to record an unsigned/unverifiable result (fail-closed). At minimum, gate live acceptance on all three `TOWER_HMAC_SECRET_*` being present and assert their presence at startup.

**Verification step:** with `DATABASE_URL` set but `TOWER_HMAC_SECRET_LARRY` unset, dispatch a Larry turn and assert the dispatcher rejects the unsigned result (throws / records a blocker) rather than accepting it.

### [LOW] F-LOW-01 — Error-path / glob hygiene (defense in depth)

**Where:** `tower.js:109` and `watchdog.js:38` fatal handlers log `err.message`; `guardrails.js:106` `matchGlob` builds a RegExp from `scope_lock.path_globs`.

**What:** A pg/URL error surfaced via `err.message` could in principle include host detail from a malformed `DATABASE_URL`; and `matchGlob` compiles operator-supplied globs into a RegExp. Neither is attacker-controlled in WP0 (scope_lock is operator/Tower-authored, and pg errors do not echo the password), so risk is low.

**Fix recommendation:** ensure fatal logs serialize only a sanitised message (never the connection string); keep path_globs short and operator-authored (they are). No change required for WP0 sign-off; noted for hardening.

**Verification step:** feed a deliberately malformed `DATABASE_URL` and confirm the fatal log contains no host/credential substring.

### [INFO] Positives worth recording
- I-01: Codex API key is env-only, never on argv (no process-list leak) — `codexAdapter.runCodex`.
- I-02: TLS is verify-full with a pinned CA and rejectUnauthorized:true; the code never sets rejectUnauthorized:false — `store/pgSslConfig.js`.
- I-03: All SQL is fully parameterised ($n placeholders, ::jsonb casts on stringified JSON); no string-concatenated SQL anywhere in `postgresStore.js`. Advance-once and single-dispatch claims use FOR UPDATE SKIP LOCKED.
- I-04: `pg` is imported dynamically inside the factory, so the unit suite runs with no DB and no pg dependency reached — the no-DB review path is honest.

---

## Remediation (2026-07-17)

Mack closed the two conditions on this branch (`build-010/wp0-fusion-tower`) with real fixes + executable controls; no exploit/PoC text is reproduced here (responsible-disclosure level, finding + fix only).

- **F-HIGH-01 — FIXED** (`eb230a5`). The Larry adapter no longer places any prompt-derived text on argv, and no longer uses a shell. `runClaude()` and `verifyClaudeInvocable()` spawn with `shell:false`; the (untrusted-influenced) prompt is delivered on **stdin** (mirroring the Codex adapter), and argv is a fixed, fully-trusted constant flag set. The live headless invocation still works (`claude` is a native executable resolved via PATH/PATHEXT; re-proven by `scripts/proof-e2e.js` → "REAL headless claude", signatures verified). Guarded by `test/larryInjection.test.js`: a shell:false + prompt-on-stdin assertion and an injection-trace test (`boundedContext.task = 'x & echo INJECTED > pwned.txt'`) proving the payload stays an inert stdin token, never reaches argv, constructs no second command, and creates no `pwned.txt`.

- **F-MED-01 — FIXED** (`bc853e3`). HMAC verification now fails **closed** in live mode. `dispatcher.verifySignedResult` requires, for every signing principal when `config.isRuntimeReady()`, a provisioned per-principal secret AND a verifiable signed envelope — a missing secret / unsigned result / bad signature is refused, never recorded (identity signer-match stays unconditional; fixtures mode stays lenient). `config.requireLiveSigningSecrets()` + a `createTowerRuntime` startup gate assert all `TOWER_HMAC_SECRET_*` are present in live mode, failing loud with a masked (NAMES-only) fatal. Guarded by `test/failClosed.test.js` (live rejection, live accept-when-provisioned, config both-ways, startup fail-closed).

- **F-LOW-01 — OPEN (noted hardening item).** Error-path / glob hygiene is unchanged; not attacker-controlled in WP0, carried forward as a hardening note, not a sign-off blocker.

CI added (`4600d17`): `.github/workflows/fusion-tower-tests.yml` (unit no-DB + integration on `postgres:16`) so both the guardrail suite and the 14 DB-gated proofs run on every change to the service. Local re-run: no-DB 79 pass / 14 skip; live throwaway Postgres 17 93 pass / 0 skip; secret scan clean.

## Definition-of-done for this review
- [x] Privileged paths read line-by-line (migration, envelope, dispatcher, guardrails, both adapters, event intake, Telegram controls, config, both stores, SSL config, watchdog, tower entrypoint, E2E proof).
- [x] Test suite run by the reviewer: 85 tests, 71 pass, 0 fail, 14 DB-gated skips.
- [x] Secret scanner run by the reviewer: clean, 373 files, 0 secrets, exit 0.
- [x] Own probes run: merge-path grep, injection trace, tracked-.env check, self-loop/dedup trace.
- [x] Every finding carries where / what / proof / fix / verification and an honest severity.
- [x] No secret value read or echoed; no live surface touched; migration not applied.
- [x] Four gated live actions answered YES / YES-with-conditions explicitly. No RED.
