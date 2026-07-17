---
agent_id: mack
session_id: build-010-wp0-vex-remediation
timestamp: 2026-07-17T13:05:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-010 WP0 — closed the two Vex conditions (F-HIGH-01, F-MED-01) + added tower CI

Worktree `C:\Fusion247PKA-b010`, branch `build-010/wp0-fusion-tower`. Never touched `C:\Fusion247PKA`. No push, no live systems, no live migration.

## What I did

- **F-HIGH-01 (HIGH, larry adapter argv injection)** — `eb230a5`. `runClaude()` + `verifyClaudeInvocable()` now spawn `shell:false`; the prompt (built from `run.scope`/`boundedContext.task`) is delivered on **stdin**, not argv. argv is a fixed constant flag set. `claude` on this host is a native PE executable (`~/.local/bin/claude.exe`), resolved by libuv via PATH/PATHEXT — so shell:false keeps the live headless run working. Re-proven by `proof-e2e.js` ("REAL headless claude", signatures verified). Test: `test/larryInjection.test.js` (shell:false + stdin assertion; injection-trace with `x & echo INJECTED > pwned.txt`).

- **F-MED-01 (MEDIUM, HMAC fail-open)** — `bc853e3`. `dispatcher.verifySignedResult` fails **closed** in live mode (`config.isRuntimeReady()`): a signing principal must have its secret AND a verifiable signed envelope, else the result is refused. Added `config.requireLiveSigningSecrets()` and a `createTowerRuntime` startup gate (masked, NAMES-only fatal). Fixtures mode stays lenient. Test: `test/failClosed.test.js`.

- **CI** — `4600d17`. `.github/workflows/fusion-tower-tests.yml`, mirrors the fcg workflow: `unit` (no-DB) + `integration` (postgres:16, DATABASE_URL set), Node 22, `permissions: contents: read`.

- **Report** — appended a `## Remediation (2026-07-17)` section to `Builds/BUILD-010-fusion-tower/Security/wp0-security-review-2026-07-17.md` (finding+fix only, no PoC). F-LOW-01 remains a noted hardening item.

## Verification numbers (real)

- no-DB `node --test`: **93 tests, 79 pass, 0 fail, 14 skipped** (was 85/71 pre-fix; +8 remediation tests).
- Live throwaway scoop Postgres 17.4 (new data dir, port 54334, db `ftw_dev`): **93 pass, 0 skipped** — all 14 DB-gated integration tests ran green (migration 0001 applied clean). Cluster torn down.
- `bash scripts/secret-scan.sh`: **clean, 0 secrets**.
- `proof-e2e.js`: `passed: true`, live larry turn real, signatures verified, no autonomous merge, no live writes.

## For the next agent

- Windows Postgres gotcha (confirmed): forked `postgres.exe` backends need the Windows DLL dirs on PATH — start pg with `PATH="<pgbin>:/c/Windows/System32:/c/Windows:/usr/bin:/bin"`. But the **node test client connects over plain TCP**, so run `node --test` with the normal PATH (just export `DATABASE_URL`). Don't run node under the stripped Windows-only PATH — it hides `node`.
- Vex's four gated live actions still gate on Warwick's credentials; conditions (i) and (ii) on action (d) are now code-closed. No autonomous merge, no push performed.
