# Phase 6 — integrate, harden, clean up — evidence

_2026-08-02. Operating reset Phase 6. Zero Codex calls._

## Merge

| | |
|---|---|
| PR | #86 |
| Reviewed head | `e040496b5104d3f736011810ee3d2c5504091887` |
| Merge commit | `1ecedb5db06289433fade76056e473f7f4d5f90b` |
| Route | `gh pr merge --merge` (no force, no rewrite) |
| `e040496` ancestor of main | yes |
| Teardown present | reorient/footer/reviewDiff/thin-larry present; BUILD-018 modules deleted |

## Local + CI verification on merge SHA

| Suite | Result |
|---|---|
| reorient | **53/53** |
| CI-shaped seven | **221/221** |
| all-eight | **274/274** |
| GitHub @ `1ecedb5` | **success**: governor-tests, control-plane-tests, secret-scan, cockpit-private-apps |

## Managed settings

| | |
|---|---|
| Canonical managed path | `C:\Program Files\ClaudeCode\managed-settings.json` (written via elevated copy after Program Files ACL initially denied) |
| Content | F1a deny floor only (force-push, force-ref, branch -D, bare push to main) — **not** the project allowlist |
| Prior managed file | **none** |
| Backup of “no prior” note | `C:\Users\Buggly\.claude\config-backups\managed-settings.json.bak-PHASE6-2026-08-02T16-33-15` |
| **Exact restore command** | `Remove-Item -Force 'C:\Program Files\ClaudeCode\managed-settings.json'` (if elevated write is required: run elevated PowerShell) |
| Project deny floor (live-binding proven path) | `.claude/settings.local.json` deny array = same 9 patterns |
| Local backup before edit | `.claude/settings.local.json.bak-PHASE6-2026-08-02T16-33-15` |
| Local restore | `Copy-Item -Force '.claude/settings.local.json.bak-PHASE6-2026-08-02T16-33-15' '.claude/settings.local.json'` |

Also written to legacy `C:\ProgramData\ClaudeCode\managed-settings.json` when Program Files first failed; Program Files copy succeeded after elevation.

## Live permission proofs

| Proof | Result |
|---|---|
| Ordinary git (`git status` in scratch) | ok |
| `git push --force origin main` under thin-larry + project deny | **DENIED before execution** — message `Permission to use Bash with command … has been denied`; no git stdout/stderr |
| thin-larry Write tool | **NO_WRITE_TOOL** / `main-wrote.txt` absent |
| Specialist Write via Task under thin-larry | **`out/phase6-proof/sub-wrote.txt` = `SUB_DID_THIS`** |
| reorient SessionStart path | exit 0, emits location probes block |

## Codex calls this phase

**ZERO.**

## Worktrees

See Phase 6 close log: WO-OR-* removed only where commits already on main.
