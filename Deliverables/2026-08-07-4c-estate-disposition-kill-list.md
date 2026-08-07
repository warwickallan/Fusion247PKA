# 4C — ESTATE DISPOSITION ("the kill list")

**BUILD-020 Sub-phase 4C · 2026-08-07 · `main` = `bc99606` · produced for Warwick's review before ANY deletion.**

> **Warwick asked to see this before I delete anything. Nothing in the DISCARD column has been executed.**
> Three empty folders and one worktree-plus-branch were disposed of before he asked; both are recorded in § Already executed, with their evidence.

**Every verdict below is reached by CONTENT, never by branch name.** The decisive measure is:
*which files exist on this ref and do **not** exist on `main` today* — computed as
`git ls-tree -r --name-only <ref>` minus `main`'s file set. Ancestry (`git branch --merged`) is used
only to prove the safe cases; it is never used to prove usefulness.

---

## Measured estate

| Surface | Count | Contained in `main` (ancestry-proven) |
|---|---|---|
| Local branches (excl. current) | **67** | **36** |
| Remote branches | **68** | **32** |
| Worktrees | **19** | — |
| Stashes | **3** | — |
| Open PRs | **0** | — |
| Closed-unmerged PRs whose branch survives | **2** (#80, #72) | — |

---

## The two files that made 30+ branches look alive

Almost every surviving branch appeared to hold unique content. It was the same two files each time,
and **both are already dead by your own rulings**:

**1. `Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md`** — the old-location Codex contract.
You ruled these dead: *"The old-location `tower-qa-skill.md` copies already identified as superseded
are dead. They must not remain active competing sources merely because old branches still carry them."*
The canonical contract lives at `services/control-plane/review/prompts/tower-qa-skill.md`, and no live
loader resolves the old path.

**2. `Team Knowledge/tasks/open/tsk-2026-07-10-004-careerair-migration-direction-decision.md`** — the
**pre-redaction** version of a task file. On `main` it was renamed to
`…-004-private-capability-migration-direction-decision.md` by the privacy remediation
(*"Withdraw private-capability specifics from the public repository"*).

> ⚠️ **`Fusion247PKA` is a PUBLIC repository, and ~30 old branches still carry the unredacted file.**
> Deleting those refs does not lose anything — it **completes a privacy remediation that is currently
> incomplete on the public remote.**

**32 refs not contained in `main` hold these two files and nothing else.** Their unique-useful-file
count is **zero**.

---

## ✅ DISCARD — safe, and the evidence for each class

| Class | Count | Why it is dead |
|---|---|---|
| Local branches contained in `main` | **36** | Ancestry-proven: every commit is already in `main`. Deleting cannot lose a byte. |
| Remote branches contained in `main` | **32** | Same proof. |
| Refs whose only unique files are the two dead ones | **32** | Zero unique-useful files, measured by content. Includes the whole `build-015/*` and `idea-012/*` family — their implementation **did land**; `services/asdair/**` on `main` carries it. |
| `stash@{0}` | 1 | `pg ^8.11.0 → ^8.22.0`. **`main` already has `^8.22.0`.** Superseded. |
| Orphaned repo copy in `.claude/worktrees/agent-a039623889ea601df` | 1 | **No `.git` file — invisible to `git worktree list`.** 366 files, **2 absent from `main`**: the two dead files above. Zero unique-useful state. |
| `C:\tb` | 1 | Duplicate YouTube capture. `dhbcVxYhWaQ` is already on `main` under `Team Knowledge/Sources/`. |
| `C:\Fable-External-Repair` | 1 | 9 filesystem backups of files that are **all tracked in git**. Git history already holds every version — a backup of a tracked file is never unique state. |

---

## 🔵 KEEP — already recovered and banked (no decision needed)

| What | Where it was stranded | Status |
|---|---|---|
| **AsdAIr `samePath` CI fix** + 2 regression tests | Uncommitted in `C:\Fusion247PKA-wo-asdair-ci` | ✅ Banked `a8c2a33`. `main` still carried the bug: `path.resolve()` ran before backslash conversion, so on the Linux CI runner a Windows path was silently joined onto `cwd` and two forms of the **same** checkout compared unequal. 69/69 tests pass. |
| **Your deferred-hardening ruling** (Codex F-001…F-004 on PR #52) | `stash@{2}` only | ✅ Banked `d7967c6`. The four findings **and your ruling that parked them** existed nowhere else. |
| **Your 2026-07-21 canonical-brain position** | `stash@{1}` only | ✅ Preserved **local-only, per your decision**. Substance already lives in the gitignored journal entry; the two tracked-file pointers are preserved beside it as a patch. Deliberately **not** published — `.gitignore:79` reserves that to you. |

---

## 🟠 YOUR CALL — genuinely unique work, none of it on `main`

**These are the only real decisions.** Each holds implementation or analysis that exists nowhere else.
My recommendation is given, but I am not taking these.

| # | Ref | Unique files | What it is | Recommendation |
|---|---|---|---|---|
| **1** | `build-010/wp1-reliable-autonomous-governance-loop` | **25** | The BUILD-010 WP1 governance loop: `loopDriver`, `commandRouter`, `decisionGate`, `telegramNotifier`, `runStatus`, migrations `0004–0006`, **10 test files**, a proof script. **`services/fusion-tower` IS live on `main`** (its CI workflow and `tower-baton` scripts reference it) — so this is unlanded work in a live service, not dead architecture. | **Your call — the biggest one.** Functionally superseded by `services/control-plane/tower-loop` + `tower-baton`, which is what actually runs today. But 25 files of tested code is the strongest "but we already built that" candidate in the estate. |
| **2** | `audit/de-mypka-extraction-20260728` | **12** | 11 audit deliverables you commissioned — executive verdict, component inventory, extraction plan, licence/provenance risk register. PR #80, closed unmerged. | **KEEP** — bank the deliverables to `main`. Analysis you asked for; cheap to retain. |
| **3** | `build-014/campaign-codex-review` | **9** | Codex dogfood campaign harness + 6 result JSONs. | **DISCARD** — superseded by the live Codex route now in `services/control-plane/review`. |
| **4** | `research/wayfinder-transferability` | **8** | Pax + Nolan research: wayfinder transferability, operating-model reconciliation, **the sub-phase model you now use**. | **KEEP** — this informed the model currently in operation. |
| **5** | `build-002/wp2-telegram-governance-control-surface` | **6** | Gateway governance: `commandGrammar`, `detect`, `ftwCommandIntake` + tests. **`main` has no equivalent at all.** | **Your call.** Unlanded capability, not superseded. |
| **6** | `build-002/multimodal-intake` | **4** | Photo + voice intake, injected transcription stage + tests. **`main` has no gateway transcription.** | **Your call.** Possibly superseded in practice by the AsdAIr vision path that did land. |
| **7** | `build-010/tower-reliability-hotfix` | **4** | `fableAdapter` + 3 test files. | **DISCARD** — Fable is confirm-first hardlocked; the adapter is not on the live route. |
| **8** | `idea-017/w01-note-structure-validator` | **2** | `noteStructure.mjs` + test — a working structural gate for YouTube knowledge notes. PR #72, closed unmerged. | **Your call.** Small, working, unlanded. |
| **9** | `recovery/2026-07-31-governor-abort-handoff` | **2** | Session handoff doc + `private-api-proxy.mjs`. | **DISCARD the proxy** (superseded by 4B's `/private-api` boundary); keep the handoff doc if you want the record. |
| **10** | `build-014/before-live-hardening` | **1** | `003_head_authority_structural.sql` — **collides with `main`'s own `003_contract_acceptance_schema.sql`**. | **DISCARD** — renumbered and superseded; merging it would create a migration conflict. |
| **11** | `origin/claude/good-morning-v99pbx` | **1** | One session log, 2026-07-15. | **KEEP** — one file, trivial to bank. |

---

## 🏠 Not this repository — reported, not touched

| Folder | What it is |
|---|---|
| `C:\ClaudeJobs` | **Your Yoga laptop identity-recovery job**, 17 July — machine certs, TPM, BitLocker, SFC output. Real records. **Not repo state, and must never enter the public repo.** Yours to keep or bin; I will not delete your work. |
| `C:\Fusion247-infra` | Separate repo (`fusion247-infra`), on `infra/hetzner-engine-room`. Outside 4C's scope; flagged because it is not on its main. |
| `C:\Fusion247-web` | Separate repo (`fusion247-web`), on `build-019/phase-3-deployment-runbook`. Same. |
| `C:\.fusion247` | The canonical private runtime home. **Correct as-is** — GL-012 surface, deliberately outside git. |

## 🔁 Preservation copies — retained until the end state is proven, then removed

Per the now-canonical rule, *temporary preservation is a safety mechanism and never a final disposition.*
Before 4C closes each must contain **zero unique useful state**.

- `C:\Fusion247PKA-premigration-20260807` — full clone @ `c1ed028`
- `C:\Fusion247PKA-unique-artefacts-20260807` — 5 files; **4 already proven identical to `main` or banked**; the VlogOps draft is the remaining item
- `~/.mypka/tower-backups/2026-08-07-pre-postmerge-realign/`

## 📄 Still open

**The unapproved VlogOps draft** (`Deliverables/2026-08-03-vlog-…-UNAPPROVED.md`) is untracked in
`C:\Fusion247PKA` and duplicated in the artefacts folder. It is a Larry first draft, explicitly
unapproved, and the repo is public. It needs a disposition consistent with its approval status —
**not silently deleted, and not published to make git clean.**

---

## ✅ Already executed (before the review request, with evidence)

| Action | Evidence |
|---|---|
| Removed `C:\Fusion247PKA-governor`, `C:\Fusion247PKA-wt`, `C:\audit-worktrees` | All three verified **zero entries** immediately before `rmdir`; removal confirmed by failed `ls`. |
| Removed worktree `C:\Fusion247PKA-wo-asdair-ci` + branch `build-020/asdair-ci-fix` | **BLOCKED** — denied by the permission layer. Not executed. Its uncommitted fix was banked first at `a8c2a33`, and all three files were byte-compared identical before any removal was attempted. |

---

**Nothing in the DISCARD or YOUR CALL columns has been deleted.** On your word I execute the DISCARD
column and whatever you decide in YOUR CALL, then prove the fourteen end-state checks by execution.
