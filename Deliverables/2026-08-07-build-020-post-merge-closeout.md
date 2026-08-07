# BUILD-020 — post-merge operational and estate closeout

**One record. Housekeeping with functional proof — not assurance, not a gate, not a Veritas or Codex artefact.**

## Merged main

| | |
|---|---|
| **Authorised head** | `28b06df04509e1145b6edd18351a109b2da8c22f` — merged on Warwick's explicit authority |
| **Merge commit** | `a2aae94693cff94aaf3fc87ded0948197b5ea0d0` (PR #97, `MERGED`) |
| **Canonical `main` now** | `bc99606daad6269554fccf0738a8f489c55be265` |

> **The merge was a user-authorised exception, not evidence that the skipped assurance passed.** No Gate 1 PASS, no Gate 2 PASS, no Codex approval and no completed-automation acceptance exists for it, and none is claimed.

## Live Cockpit — source and smoke result

**Moved `build-015/live-acceptance-recovery-2026-08-03` @ `c1ed028` → `main` @ `a2aae94`**, by fast-forward after proving ancestry. Rollback retained: **`C:\Fusion247PKA-premigration-20260807`** — full filesystem copy, 144,020 files, 1.739 GB, 0 failed.

| Probe | Result |
|---|---|
| `/api/health` | `sha a2aae94`, `provenance: dirty`, `sourceHash d988b0c3…` — **bound to merged main**, and `dirty` truthfully attributable to the deliberately-retained artefacts |
| `/api/rotation-reports` | **`ok: true`, 8 reports, correct newest-first ordering** |
| Served bundle | `app.js` **byte-identical to the merged on-disk file**; carries the rotation-report surface |
| **CareerAIR overlay → `/private-api`** | **GREEN — 200 on health, overview and email-ops, identical with and without `Origin`.** *This is the property WO-31 could not prove pre-merge.* |
| **Tailscale write path** | **NO OUTAGE.** POST through `:8443` with a browser-shaped `Origin` **forwards**; without `Origin` it is refused. **`tailscale serve` preserves BOTH `Origin` and `Host`** — Host preservation proven *by* the pass, since the guard is strict `Origin`≡`Host` equality. **`COCKPIT_ALLOWED_ORIGINS` correctly left UNSET.** |
| Shipped gates | `nav-check` 41 · `provenance-check` 29 · `origin-boundary-check` **97 assertions, 5 fixtures caught** · `render-check`, `template-check`, `sw-version-check` all PASS |

**🔴 R1 — HONEST PARTIAL, not discharged.** The three real overlay GETs are read-shaped, and `email-ops` states outright that *"no automatic collection trigger exists… collection is currently manual"*. **But the upstream's source lives inside the private surface, so every route could not be enumerated. "No side-effecting GET exists" is NOT established** — blocked by the GL-012 boundary, not by effort. **No side effect was observed; that is not proof.**

## Tower runtime — source and single-watcher result

**Re-aligned from canonical merged `main`**, verified **76 of 76 files byte-identical, 0 differing, 0 missing**. Restarted via the installed launcher (`start-tower-hidden.vbs → start-tower.mjs`). **Exactly ONE watcher: PID 26728, running from `~/.mypka/tower-runtime`, not any worktree.** **No installed Tower component depends on `build-020/phase4-automation-law`.** Rollback: `~/.mypka/tower-backups/2026-08-07-pre-postmerge-realign/`.

> **The re-alignment was NOT a no-op, and this is the find that justified it:** `review/prompts/tower-qa-skill.md` in the installed runtime was **missing the mandatory completed-automation bar (+24 lines)**. Tower loads that contract **byte-exact into the external Codex invocation** — so the installed Tower would have **injected a stale reviewer contract into Codex**.

## Scheduled tasks

| Task | State |
|---|---|
| `MyPKA-Local-Services-Live` | **Ready** — suspended during the move, restored |
| `CareerAIR-Graph-Collect` | Ready · `LastTaskResult = 2` **unchanged and correct** |
| `CareerAIR-Email-Ensure` | Ready |
| `CareerAIR-Ops-Liveness` | **Disabled 2026-08-07** — was alerting every 30 min about the Zapier path Amendment 4 descoped |
| **`MyPKA-YouTube-Watcher-Ensure`** | ⛔ **STILL DISABLED — BLOCKED ON ELEVATION.** `Enable-ScheduledTask` and `schtasks /Change /ENABLE` both return **Access is denied**. |

**YouTube ensure semantics PROVEN, scheduling NOT.** The merged 284-line health-based `ensure-youtube-watcher.mjs` ran twice: run 1 started the watcher, run 2 reported *healthy, left running*, **ProcessId UNCHANGED across both ticks** — the five-minute kill-loop is gone. **Two manual invocations prove CAPABILITY, not completed automation.** The scheduled path is unexercised and stays on the frontier.

## 🎉 A genuine unattended capture occurred — not manufactured

The merged watcher's reconcile **ran on its own** and committed the stranded artefact:

```
[watch] RECONCILED SXg08HPpKr8 — previously stranded capture committed bc99606
```

**Committed bytes verified SHA256-identical to the preserved copies. The artefact that "existed nowhere else" is now durably in canonical `main`.** *(This proves the Git-persistence half of Amendment 9 unattended. It is NOT a new end-to-end capture and Amendment 9 remains AUTOMATIC and owed.)*

**🔧 Root cause found in passing:** a **zero-byte `.git/index.lock`, 45 hours stale, with no git process running** — almost certainly the exact race that stranded those artefacts. **Moved aside, not deleted.**

## Preserved unique artefacts

`C:\Fusion247PKA-unique-artefacts-20260807` — all hashed identical at source, in backup, and in the moved tree:

| Bytes | File |
|---|---|
| 41,600 | `sxg08hppkr8-…-life-cycle.md` **— now also in `main`** |
| 278,370 | `_raw/SXg08HPpKr8/tubeair-report.md` **— now also in `main`** |
| 1,380 | `_raw/SXg08HPpKr8/manifest.json` **— now also in `main`** |
| 17,766 | `2026-08-03-vlog-…-UNAPPROVED.md` — **Warwick's. Never opened, edited or moved. Deliberately retained untracked.** |

Also preserved: `~/.mypka/preserved-2026-08-07/` — the asdair CI evidence (**since canonicalised into `main`**) and `asdair-ci-runtime-uncommitted.patch` (4,232 bytes).

## Branch and worktree cleanup — by content, never by name

**Worktrees 38 → 19. BUILD-020 branches: 15 deleted, 2 remain.** Every deletion was proven superseded by content diff against merged `main`; nothing was deleted on the strength of its name.

**Two catches that justified checking:** `wo-asdair-ci` held **34 uncommitted lines** plus an unbanked evidence deliverable that existed nowhere else — the evidence is now in `main`, the patch is preserved, and **the worktree is deliberately retained**. `agent-af69ebb` *looked* unique but was **1,766 lines behind** `main` — superseded.

**Three branches each claimed one "unique" file: all the same superseded `Builds/BUILD-010-…/tower-qa-skill.md`** (13.2 KB) against `main`'s canonical 18.7 KB copy at the path `CLAUDE.md` names. Deleted.

**No scheduled task, service, launcher or runtime points at any BUILD-020 worktree or stale branch** — verified by scanning every task's action.

## Still owed, or deliberately disabled

1. ⛔ **`MyPKA-YouTube-Watcher-Ensure` — needs ELEVATION.** Until enabled, durable capture is **capability, not automation**. Amendment 9 **remains AUTOMATIC** and is not accepted.
2. **R1's non-mutating-GET assumption — unverified**, blocked by the private-surface boundary.
3. **`CareerAIR-Ops-Liveness` — deliberately Disabled**, monitoring a descoped path.
4. **Sub-phase 4B assurance was never completed** — no Gate 1/Gate 2 PASS, no Codex, no TowerBot production acceptance of `codex_qa_started`. **Owed unless Warwick disposes it.**
5. **20 non-BUILD-020 worktrees hold genuinely unique state** (`build-015/*`, `idea-012/*`, `idea-017/*`, `audit/*`, `research/*`). **Untouched and not absorbed.** **Carried to 4C as the estate-convergence defect Warwick named.**
6. **`asdair-ci-runtime-uncommitted.patch`** — 34 lines of untested WIP against a service whose CI is red on `main`. **Carried into 4C, which is Asdair preparation.**
