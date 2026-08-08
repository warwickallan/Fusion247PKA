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

> ⚠️ **`Fusion247PKA` is a PUBLIC repository, and ~30 old branches still carried the unredacted file.**
> Deleting those refs removes them from the **active estate**.

> ### 🔴 CORRECTION — my earlier claim was WRONG, and Warwick was right to challenge it
>
> I first wrote that deleting these branches *"completes a privacy remediation that is currently incomplete."*
> **That is false.** Warwick's correction — *"do not claim that alone completes historical privacy removal"* —
> is right, and the reason is stronger than he put it.
>
> **The pre-redaction content is reachable from `main`'s own history.** Commit `7d16e66` added the file and
> is an **ancestor of `main`**; `6bf7092` merely deleted it going forward. Established by execution:
> `git merge-base --is-ancestor 7d16e66 main` → true, and the blob still reads.
>
> **So the content was never only on those branches, and deleting them changes nothing about historical
> exposure.** Branch deletion achieves the 4C goal — removing **active competing sources** — and nothing more.
>
> **Classification, per Warwick's test:** the withdrawn material is a **private capability name and its
> purpose** (that "CareerAIR" drafted CVs, cover letters and career narrative for Warwick personally), plus
> a minor anecdote. **No credentials, no secrets, no third-party personal data.** That is
> **obsolete / private-by-policy**, not information requiring historical purge. **Therefore branch removal
> is sufficient for this 4C convergence goal**, and the residual is **reported, not purged.**
>
> **RESIDUAL, stated rather than hidden:** the pre-redaction wording remains readable in `main`'s history and
> may persist in GitHub caches and PR references. **No history rewrite has been performed and none is
> proposed** — Warwick forbade launching one without explicit authority, and this material does not warrant it.

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
| `C:\tb` | 1 | **Corrected on closer inspection — not a straight duplicate.** It is an **earlier capture of the same video** (`dhbcVxYhWaQ`): Warwick's live DevBot test of **2026-07-20T00:13:27Z**, `user_note: "Warwick live test via DevBot 2026-07-20"`. `main` carries a **later** capture of the same video (2026-07-22T02:35:02Z, `user_note: "BUILD-002 WP2 auto-detect"`). With newlines normalised, the **only** differences are `captured_at`, `user_note` and `output_dir` — the transcript and report body are the same. **The knowledge is canonical on `main`; the delta is capture metadata from a superseded run. Recorded here so the fact of that first live test is not silently lost, then discarded.** |
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

---

# 🔴 THE DELETION PROOF WAS WRONG — recorded before anything else, because it invalidates part of this document

**An external review of the 4C work found a substantive defect in the measure this document is built on. It is correct.**

**The flawed measure:** *files present on `<ref>` and absent from `main`* (`git ls-tree` minus `main`'s path set).
**What it actually proves:** which **pathnames** are absent. **What it does NOT prove:** that a branch which
**modifies** a file `main` also has holds no unique useful implementation. Such a branch scores **zero** on
this measure while carrying real work.

**Worse, and it is the honest part:** the same-path signal *was* computed earlier in the session — 138
differing shared files on `build-015/runtime-recovery`, 131 on `idea-012/asdair-stage1-durability` — and was
**dismissed as "main has moved on" without being tested.** The right number was in hand and was reasoned away.

**What this invalidates:** ancestry-proven deletions (36 local + 32 remote, every commit already in `main`)
remain sound — containment is a complete proof. **Every NON-CONTAINED ref whose discard rested materially on
`files_absent_from_main = 0` is NOT yet proven safe.**

## Recoverability secured before any analysis

| Control | State |
|---|---|
| `gc.auto`, `gc.pruneExpire`, `gc.reflogExpire`, `gc.reflogExpireUnreachable` | **disabled** in the repo |
| Deleted branch tips re-pinned | **40** under `refs/recovery/4c/**` |
| Previously-unreachable commits re-pinned | **75** under `refs/recovery/4c-unreachable/**` |
| `git fsck --unreachable` | **zero** unreachable commits |

**Destructive deletion is STOPPED** and does not resume until every recovered tip is accounted for.

## The corrected method, and two traps found while establishing it

The question is Warwick's: **"Does this old state contain any useful behaviour, implementation, decision or
evidence that is not represented by the canonical system?"** Evidence is three-way merge, diff and code
reading — **never pathname subtraction**.

- `git merge-tree --write-tree <canonical> <ref>`; a resulting tree equal to the canonical tree proves the ref
  contributes **nothing**. **8 refs already prove this.**
- ⚠️ **Trap 1:** `git diff main..<ref>` `+lines` mostly measures **main moving on**, not unique branch work.
- ⚠️ **Trap 2:** `merge-tree` renders **conflicted regions as additions** with `<<<<<<<` markers, so raw
  insertion counts **over-report**. A file showing "190 insertions" turned out to be one where `main` is
  simply the larger evolved version.

**First properly-proven result:** `build-015/pipeline-orchestrator` is **superseded** — `main`'s `store.js` is
818 lines to the branch's 427, and `routeTaps()` exists on `main` at `services/asdair/pipeline/runtime.js:204`
with an evolved signature the branch lacks. Its "absent" lines are the branch's **older variants**.

**Ownership** (Warwick, 2026-08-07): this forensic re-audit is **Larry's estate-convergence responsibility**
with an implementation specialist doing the mechanical and semantic comparison. **Veritas does NOT perform
repository archaeology** — that scope was removed from her contract earlier the same day, and dispatching her
to it was Larry's error, corrected. Her 4C assurance remains the **human boundary outcome**. **Codex** performs
the final independent merge-class challenge once the candidate is stable.

## 📌 F-001 — a genuine finding, deliberately NOT expanded into 4C

**The defect:** `services/control-plane/tower-loop/notify.mjs` claims the `(turn_id, reason)` dedup row at
**lines 86–98**, and the Telegram POST does not happen until **line 121**. A crash in that gap leaves
`telegram_ok=0`, and the next pass returns *"deduped — Telegram not re-sent"*. **No resend path exists
anywhere in the subsystem** — established by reading the code, not inferred.

**The estate finding underneath it, and it is the North Star failure inside `main` itself:** the durable outbox
that fixes this **was already built** — `services/control-plane/notifier/notifier.mjs`, watchdog-backed,
with bounded retry and dead-lettering — and it is **imported by nothing except its own test.** The estate holds
**three** notification-outbox designs (`ops.*` on main, `ftw.*` on a dead branch, `tower.*` on the live path),
and the one path that actually sends Warwick's Telegram is **the only one without retry**.

**Safety determination for 4C, which is the only question 4C must answer:** F-001 is **pre-existing on `main`**
and 4C changes nothing on that code path. **It does NOT make the current 4C merge or convergence unsafe.**

**Disposition (Warwick, 2026-08-07):** *"do NOT allow it to expand 4C automatically… route it to the appropriate
subsequent work rather than turning estate convergence into a programme to repair every historical defect on
main."* **Recorded here, routed onward, NOT fixed in 4C.** Fixing it needs a schema decision and a production
caller — neither is 4C's.

**Protected, per his instruction:** `notifier.mjs` is **on `main`**, so no branch deletion can lose it. It is
recorded here so convergence does not leave it invisible, and so it is not mistaken for dead code later.

---

# ✅ RECOVERY-PIN ACCOUNTING — all 115 accounted for

**Warwick's gate: *"Only when all 115 recovery pins are accounted for may destructive cleanup resume."*
And his constraint: *"Do not perform 75 manual archaeological reviews unnecessarily."***

## The 40 branch tips — re-audited under the stronger method

Independently re-audited (WO-4C-07) with four orthogonal tests: ancestry · `merge-tree` contribution ·
**set algebra from the shared merge base** (`diff(B→tip)` minus `diff(B→canon)` — immune to "main moved
on", because canon's own evolution is subtracted rather than counted) · symbol-absence and prose-orphan
indexes against the canonical estate. **T3, T4a and T4b converged independently on the same refs.**

| Verdict | Count |
|---|---|
| SURVIVOR | **3** — S-1, S-2, S-3 below |
| SAFE-CONTAINED | 1 |
| CONTRIBUTES-NOTHING | 7 |
| SUPERSEDED | 29 |

## The 75 previously-unreachable commits — accounted for, not archaeologically reviewed

**65 of 75 are stash artefacts** (`WIP on…`, `index on…`, `untracked files on…`, `On <branch>…`).
**Most were already unreachable before 4C began** — historical `git stash drop`/`pop` residue, not work
this Sub-phase deleted. Three correspond to stashes dropped this session.

| Category | Count | Basis |
|---|---|---|
| Contributes nothing to canon (`merge-tree` tree-identical) | **24** | mechanical |
| Own delta vs parent is empty | **15** | mechanical |
| Own delta fully represented on canon | **2** | line-level |
| Own delta has orphan lines, **parent state already dispositioned** | **29** | parent in `main` (22) or under an audited tip (7) |
| **Genuinely independent states** | **5** | examined individually — below |

**The 5 independent states, each resolved by execution:**

| Commit | Resolution |
|---|---|
| `9cdaf417`, `debc5452` — *"Land first WS-004 Team Retro"* | **REPRESENTED.** `Deliverables/2026-07-15-team-retro-proposals.md` is on canon and the orphan count against it is **0**. |
| `0d19a541`, `e21ad09f` — *"Regen mypka.db after Team Retro"* | **REPRESENTED.** Orphan count **0** on every real path; `mypka.db` is a generated SOP-002 mirror. |
| `c3a10575` — WIP on `build-020/live-trial` (139 orphan lines, the largest) | **SUPERSEDED.** Its orphans are docstring drafts plus line-break variants of the `TOWER_PR_REPOS` live-discovery feature, which **landed** — `TOWER_PR_REPOS` appears 5× on canon's `watcher.mjs`. Its local `fetchOpenPrNumbers` was replaced by the **paginated, fail-loud `fetchOpenPrs`** extracted to `pollPrComments.mjs`. Canon's is the better implementation. |

**Method validation, unprompted:** `c9597067` (the PKM position deliberately kept off canon per Warwick's
own decision) correctly reports orphan lines, and `b9a28f6e` (the deferred-hardening stash whose content
**was** canonicalised at `d7967c6`) correctly reports **contributes-nothing**. The instrument distinguishes
the two cases it was built to distinguish.

**A known limit, stated rather than hidden:** line-level orphan detection reports **reformatting as
orphans**. That is exactly what happened on `c3a10575`, and it is why every flagged case was resolved by
reading the code and checking symbols, never by the count alone.

---

# ⚡ EXECUTION RECORD — Warwick authorised the full disposition, 2026-08-07

**His ruling, and the constraint on every KEEP:** *"KEEP means extract/canonicalise the useful value onto
main and then remove the old branch/worktree. It does not authorise another permanent side state."*

## Measured before → after

| Surface | Before | After | Notes |
|---|---|---|---|
| **Worktrees** | 19 | **2** | canonical `main` + the ONE active piece of work |
| **Local branches** | 67 | **6** | `main`, 4C, its ancestor, and 4 held while Keel ports from them |
| **Remote branches** | 68 | **6** | same set |
| **Stashes** | 3 | **0** | each verified preserved or superseded *before* dropping |
| **Orphaned repo copy** | 1 | **0** | `.claude/worktrees/agent-a039623889ea601df` — no `.git`, invisible to `git worktree list` |
| **Empty C-root leftovers** | 3 | **0** | `Fusion247PKA-governor`, `Fusion247PKA-wt`, `audit-worktrees` |

## KEEP — canonicalised onto the 4C branch, then the source deleted

| Value | Evidence | Source branch |
|---|---|---|
| de-mypka extraction audit, 11 docs | byte-identical to `c5160a9`, verified per file | deleted |
| Wayfinder-transferability research, 8 docs | byte-identical to `619c548`, verified per file | deleted |
| 2026-07-31 governor-abort handoff record | byte-identical to `cded1d6` | deleted — **its `private-api-proxy.mjs` discarded as superseded, per Warwick** |
| 2026-07-15 memory-checkpoints session log | restored from `84f22d8` | deleted |
| **AsdAIr `samePath` CI fix + 2 regression tests** | `a8c2a33`; `main` still carried the bug; 69/69 pass | worktree removed |
| **Codex F-001…F-004 + Warwick's deferred-hardening ruling** | `d7967c6`; existed only in `stash@{2}` | stash dropped |
| **Warwick's 2026-07-21 canonical-brain position** | preserved **local-only per his decision**; patch byte-identical to the live stash before dropping | stash dropped |

## Still held — deliberately, and why

**Four branches survive only because Keel is porting from them** (`build-010/wp1-…`, `build-002/wp2-…`,
`build-002/multimodal-intake`, `idea-017/w01-…`). Warwick ruled KEEP-the-value on all four; they are deleted
the moment the port lands. **`build-020/phase4-automation-law`** is an ancestor of the 4C branch and goes
when 4C merges.

**Not yet executed:** `C:\tb` · `C:\Fable-External-Repair` · the three preservation copies · the untracked
VlogOps draft (durable copy taken at `~/.mypka/unpublished-drafts/`; disposition still Warwick's) · the
final 4C merge · the fourteen end-state checks.

**One residual requiring a permission grant:** nothing outstanding — the earlier `git worktree remove` and
`git branch -D` denials were subsequently approved and all queued deletions completed.
