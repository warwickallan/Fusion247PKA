# 4E convergence evidence — estate inventory and dispositions for the PR #99 merge decision

**Produced 2026-08-08 by Larry for the Codex merge-class review of PR #99 (BUILD-020 Sub-phase 4E),
discharging TQA-4E-002. Every row below was established by execution on 2026-08-08; the exact
probes are quoted. Declared limits are at the end — this document says what was NOT probed.**

## 1. Branch / worktree / stash / ref inventory (probes: `git branch -a`, `git worktree list`, `git stash list`, `gh pr list --state open`)

| Item | State | Disposition |
|---|---|---|
| `main` (local) | `218d124` — **1 commit ahead of `origin/main` (`29f3f37`)**. The unpushed commit banks the Veritas 4E receipt + Proofline map status; its push to `main` is gated by the main-push guard and awaits Warwick's approval | **KEEP — push at Warwick's next approval.** Nothing is strandable: the receipt's exact bytes are ALSO staged in this merge unit, so the evidence reaches canonical `main` by either route |
| `build-020/4e-build-015-prep` | `origin`-tracked, PR #99, the 4E merge unit. Sole content: the reconciled BUILD-015 Wayfinder + this evidence package | **MERGE on Warwick's decision, then delete branch and prep worktree** (temporary preservation is not a final disposition) |
| Other branches | **NONE.** `git branch -a` returns exactly the two above plus their remote-tracking refs | n/a |
| Worktrees | `C:/Fusion247PKA` (primary, `main`) · `C:/Fusion247PKA-4e-prep` (prep, temporary) | Prep worktree removed at convergence |
| Stashes | **NONE** (`git stash list` empty) | n/a |
| Open PRs | **#99 only** | The merge unit itself |

**No BUILD-015 branch exists anywhere** — `build-015/live-acceptance-recovery-2026-08-03` was merged
via the 4C estate reconciliation (PR #98) and deleted; verified by enumeration, not recollection.

## 2. Runtime-dependency evidence — examined surfaces, results, dead references, and the mandatory limitation (check-6 form)

**Surfaces examined, by execution 2026-08-08, for the AsdAIr-relevant processes (PID 40920 —
`runtime.js --watch`; PID 31216 — ShopperBot `server.js`):**

1. **Executable path** (`Win32_Process.ExecutablePath`): both are
   `C:\Program Files\nodejs\node.exe` — the system Node install, **not any checkout**.
2. **Command line** (`Win32_Process.CommandLine`): PID 40920 names the absolute script path
   `C:\Fusion247PKA\services\asdair\pipeline\runtime.js` — the **primary canonical checkout, not a
   superseded or deleted checkout**. PID 31216's script argument is **relative** (`server.js`) —
   see the limitation below; its env-file arguments name `C:/.fusion247/asdair.env` and
   `C:/.fusion247/.env keys/shopper.env.txt` (approved secrets store, GL-012).
3. **Loaded OS modules** (`Get-Process -Module`, non-`C:\Windows` entries): both processes load
   only `C:\Program Files\nodejs\node.exe` and `C:\Program Files\Bonjour\mdnsNSP.dll`.
   **Zero modules load from any repository checkout path, current or superseded.**

**Dead references, reported separately: NONE observed.** Every path named on the examined command
lines exists (`Test-Path` true for the runtime script and the env files). No process references a
deleted checkout or missing file.

**⚠️ MANDATORY LIMITATION — `Win32_Process` cannot expose a process's current working directory.**
Consequences, stated rather than glossed: (a) PID 31216's relative `server.js` cannot be resolved
to an on-disk file from this surface — its source lineage is asserted from operational knowledge
(the ShopperBot service folder), not proven by this probe; (b) the Cockpit server (PID 29436,
identified by its `127.0.0.1:8090` listener) likewise runs a relative `server.mjs` and inherits the
same limit; (c) for a Node process, the OS-module surface does not enumerate V8-loaded JavaScript —
which files `require()` resolved is inferable only from the script path, and a long-running process
may hold **memory-resident bytes older than the files now at those paths.** That last point is a
measured fact here: PID 40920 started 2026-08-03 21:31 and PID 31216 2026-08-04 02:37, both before
the 2026-08-04 fix commits, so both execute **pre-fix bytes** regardless of the current on-disk
source. Recorded in the reconciled Wayfinder §2; restart is explicitly deferred to post-jump
BUILD-015 work.

**Zero-live-dependency result for THIS merge:** the PR #99 diff is documentation-only
(`Deliverables/*.md` + one `.json` claim record). **No examined process references any file this
merge changes**, so merging it alters no runtime dependency.

- Scheduled task `MyPKA-AsdAIr-Runtime`: **Ready** (probed read-only). The stale
  `ACTIVATION-DEFERRED.md` claim ("Disabled, not armed") is corrected in the reconciled map.

## 3. Non-Git / private / runtime state (declared homes, GL-012)

- **Secrets store `C:\.fusion247\**`** — untouched by 4E. `private_surface: none` for this merge
  unit; no file in the diff reads or references a private path.
- **Supabase (Fusion 247 MyPKA project)** — the approved non-Git data store for rotation/session
  state and the AsdAIr household schema. **Not queried and not mutated during 4E**
  (`live_authority: none` throughout; recorded in the map as UNVERIFIABLE at this boundary).
- **ASDA basket / Telegram** — untouched; no live shop ran.

## 4. What this merge adds to canonical `main`

Exactly: the reconciled BUILD-015 Wayfinder (one file, reviewed in Codex pass 1 at `d122006` —
all 14 acceptance rows pass), the Veritas 4E PASS receipt (verbatim bytes of the banked receipt),
this evidence document, and the Codex claim record. **No executable file changes.**

## 5. Declared probe limits — what was NOT established

- The live household database was not queried (no `live_authority`); all live-DB facts are on the
  map's deferred-verification list.
- Remote state was enumerated via `origin` remote-tracking refs and `gh` only; no other remotes
  exist in config, and no other machines were probed.
- CI truth is per-workflow: `asdair-tests.yml` does not run on this docs-only diff; its newest run
  on `main` (2026-08-08, `eb03696`) FAILED in the integration job — recorded in the map §2, root
  cause deliberately deferred to post-jump investigation. An unrun workflow is not a green one.
- The `94f135f` Gate 3 receipt's standing after this reconciliation is a named
  deferred-verification item, not silently discharged.
