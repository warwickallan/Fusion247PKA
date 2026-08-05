# Overnight Estate Closure — DONE / DEFERRED / BLOCKED

**2026-07-28, Larry, under overnight execution authority.** Independently reconstructed from live
sources at the end of the run. Every claim below has a command behind it.

---

## DONE

### 1. PR #76 merged — `main` is genuinely green again

| | |
|---|---|
| Reviewed head | `ac9e9efa05ec774d068d87426e030647eaf4313d` |
| Merge commit | `beb4551ab3155316b0a7d08dd386ea4066fd1116` |
| `origin/main` now | `beb4551ab3155316b0a7d08dd386ea4066fd1116` |
| Merged at | 2026-07-28T01:12:29Z, with `--match-head-commit` guard |

**CI evidence bound to the exact head, not to "the PR"** — three workflows *ran* at `ac9e9ef`
(`build-002-tests`, `fusion-capture-gateway-tests`, `secret-scan`), all `success`; 11 check-runs
success, 1 `skipped` (Supabase Preview — no migrations in this PR, not required). No branch
protection exists on `main`, so "required" means every workflow the repo actually runs.

**After the merge, verified on `main` itself:** all three workflows ran at `beb4551` and passed.
`build-002-tests` went `failure`(`db026c8`) → `failure`(`d0ad341`) → **`success`(`beb4551`)**.
The `gateway` check that had been red since 2026-07-26 is green at main's exact SHA.

### 2. Merged remote branches deleted — 49

Re-verified mechanically against the **new** `main` immediately before each deletion, not from the
stale count. Remote heads **64 → 16**.

Every deletion required all four: fully merged into `beb4551` · exists on the real remote · not an
open-PR head · not `archive/*`. Each branch's SHA was logged before deletion; all are ancestors of
`main`, so every one is recoverable.

One entry in the original "49 merged" list was **excluded**: `origin` — which is not a branch at all
but the short display name of `refs/remotes/origin/HEAD` (a symbolic pointer to `origin/main`).
Deleting it was never possible or desirable. The 49th deletion was instead
`hygiene/2026-07-28-estate-rescue`, the branch of the PR merged in step 1 — provably merged, zero
unique state, and leaving it behind would have been exactly the "unexplained junk" to avoid.

**Local branches 48 → 12**, all tracking a live remote. One lying upstream corrected
(`build-002/multimodal-intake` tracked `origin/main` instead of its own remote branch).

### 3. Paused worktrees dropped — 3

`-towerfix`, `-b002wp2`, `-b010wp1`. Each re-checked immediately before removal: local HEAD ==
`origin/<branch>`, zero dirty, zero untracked. **Worktrees 6 → 3.** Their branches survive on origin
untouched — a worktree is an execution surface, not the work.

### 4. Doctrine updated — CI truth is exact-head evidence

`Team/Larry - Orchestrator/AGENTS.md` **§8a**, placed beside §8 "Independent QA remains important".
Root `AGENTS.md` carries a one-line pointer next to its existing *"a clean task board is not
completeness evidence"* rule — the identical failure shape. SSOT respected: the fact lives in one
file, the root contract links it. No orphan retrospective file was created.

PASS / FAIL / **NOT RUN-UNKNOWN**, and NOT RUN is never PASS.

**The doctrine immediately earned its place.** Applying its own method — enumerate every workflow and
read the last result for each — surfaced a second stale-red workflow that `gh run list --branch main`
had been hiding for eighteen days. See DEFERRED §A.

### 5. Generated captures auto-persist

`services/hub/youtube/persistCapture.mjs` + 8 tests, wired into `generate-source-note.mjs` after a
successful ingest and **before** the DB write, so a capture and its immutable `_raw` evidence survive
even if the DB is unreachable.

Stages **only** the named capture paths and commits with `--only`, so unrelated work — including
work already staged by someone mid-edit — can never be swept in. Makes no empty commit on re-run.
**Never touches `review_state` or the `pending-warwick-review` tag**; the commit message records
"STORED, NOT APPROVED" so `stored != approved` survives in history, not just frontmatter. Fail-soft
by construction: no git, not a repo, or any git error is reported and the capture continues.

Tests drive a **real temporary git repo**, not a mocked git, because the behaviour under test *is*
the git behaviour. **8/8 new; full hub suite 74/74.**

### 6. Stranded work rescued (from the earlier pass, all now on origin)

Tower merge-check fix (`3c08e45`), two local-only branches, two Cairn source notes, a recovered
deliverable, and six superseded heads preserved as `archive/2026-07-28/*` tags.

---

## DEFERRED

### A. `notify-snapshot-consumers.yml` — red since 2026-07-10, and **correctly so**

Found by applying the new doctrine. Last result on `main`: `failure` at `76fcc7f8`, 2026-07-10 —
eighteen days invisible, same pattern as the gateway failure.

**Not a defect. Do not "fix" it.** The workflow's own header documents the behaviour: it needs two
repo secrets (`MYPKA_SYNC_TOKEN`, `MYPKA_SOURCE_REPO`) and *"until both secrets exist this workflow's
dispatch step fails fast and harmlessly (it changes nothing in either repo)"*. It only fires when
`Expansions/` changes on `main`.

Deferred because the remedy is configuring secrets, which was explicitly out of scope. **Your call:**
configure the secrets, or disable the workflow so it stops emitting a permanent false red.

`release-scaffold.yml` has never run on `main` — tag/manual triggered. Normal, no action.

### B. A push policy for auto-persisted captures

The implementation commits but deliberately **does not push**. Pushing means choosing a branch and a
moment on the caller's behalf — whatever happens to be checked out, mid-work — which is precisely the
"uncertain repository semantics" I was told not to invent overnight. Committing already removes the
loose-untracked failure mode; off-machine durability currently follows the branch's normal push/PR
flow. If you want durability *at capture time*, the decision needed is: which ref, and when.

### C. `stash@{0}` — retained locally, not published

Two repo-level stashes exist (one shared `refs/stash`, visible from every worktree — not per-worktree
work). **Neither was dropped.**

- `stash@{1}` — a session-log addendum in an already-public path, no secrets. **Preserved to origin**
  as `archive/2026-07-28/stash-tower-supervisor-parking-addendum`.
- `stash@{0}` — touches `PKM/Journal/INDEX.md` and `PKM/My Life/Topics/ai-tooling.md`. **Not
  published.** `.gitignore:79` states the PKM layer stays unpublished *"unless Warwick explicitly
  approves publication for that change"*, and that approval is not in my overnight authority. The
  content is your MyPKA-as-canonical-brain position — no secrets, no household data — but publishing
  it to a **public** repo is your call, not mine. It remains safe in `.git`.

### D. `.codex/agents/` — 13 shims, untouched

Per your standing ruling: a deliberate separate pass, not a side-effect. Zero uncommitted changes.

---

## RESOLVED after Warwick's final rulings (2026-07-28 morning)

**PR #77 was merged**, under an explicit ruling and an exact-head guard.

| | |
|---|---|
| Authorised head | `2c69b6d212387ebd4808fef0dfb5d7a63a927f04` — re-verified as the live head before merging |
| Merge commit / `origin/main` | `6939aee071e42953c3c19d653a390675adb6ab9f` |
| Merged at | 2026-07-28T07:10:10Z |
| CI on the resulting **main**, at its exact SHA | `build-002-tests` **success**, `secret-scan` **success**; 7 check-runs success; combined status `success` |

**The doctrine is now genuinely on `main`** — `Team/Larry - Orchestrator/AGENTS.md` §8a at line 131,
with the root `AGENTS.md` pointer, plus `persistCapture.mjs` and its tests. A fresh Larry loads it.

Rulings 3 and 4 (the `notify-snapshot-consumers.yml` remedy, and off-machine capture persistence)
were **recorded, not implemented**, in `Deliverables/BACKLOG.md`. Capture persistence stays
**commit-only**; the checked-out branch is not auto-pushed.

The section below is retained as the record of what was blocked overnight and why.

## BLOCKED (overnight — since resolved above)

### PR #77 — needed Warwick's click

**Contains overnight items 4 and 5** (the doctrine and the capture persistence).

| | |
|---|---|
| Branch | `hygiene/2026-07-28-doctrine-and-capture-persistence` |
| Code head (items 4 + 5) | `a22bd1879ab2de9def3310a7447a3d6e245afa3a` — `build-002-tests` **success**, `secret-scan` **success**, `hub` green with the 8 new tests |
| Head after this report was committed | advances by the docs commit; CI re-verified green at each new head |

> Adding this report to the branch moves the head, so any SHA written here is stale the moment it is
> written — which is the doctrine's own point. **Verify the tip before merging**, do not trust this
> table's SHA:
> `gh api "repos/warwickallan/Fusion247PKA/commits/$(gh pr view 77 --json headRefOid -q .headRefOid)/check-runs"`

**Blocked, not failed.** My authority granted merge on **PR #76 only** and explicitly barred merging
unrelated PRs, so I stopped. **It matters that this lands:** until it is on `main`, a fresh Larry does
not load the CI doctrine — which was the entire point of item 4.

Also still open and untouched: **PR #72** (structural gate; its previously-red `gateway` check was the
inherited `main` failure, so it should go green on a re-run now) and **PR #24** (draft, WS-004 team
retro, from 2026-07-10).

> Correction worth flagging: my earlier estate map said there were 2 open PRs. There were 3 — my first
> survey used `gh pr list --limit 40`, which silently truncated below #36 and hid PR #24. The estate
> map has been corrected.

---

## FINAL ESTATE PROOF

| Proof | Result |
|---|---|
| `origin/main` | `beb4551ab3155316b0a7d08dd386ea4066fd1116` |
| PR #76 | **MERGED** `beb4551`, head-guarded |
| Required CI on resulting main | **PASS at exact SHA** — 3 workflows ran, 10 check-runs success |
| Meaningful local-only commits | **ZERO** — verified across all 12 local branches |
| Worktrees | **3**, each justified (below) |
| Local branches | **12**, all tracking a live remote |
| Remote heads | **16** (15 unmerged preserved + `main`), was 64 |
| Merged remote branches removed | **49**, each re-verified at deletion time |
| Archive refs | **7**, all present on origin |
| Stashes | **2**, both intact, neither dropped |
| Repository visibility | **PUBLIC** — unchanged |
| Secrets | `C:\.fusion247\` untouched; no secret read, written, or exposed |
| Fable | **not invoked** |
| `.codex/agents/` | **untouched**, 13 shims, 0 uncommitted changes |

### Why each worktree still exists

| Worktree | Branch | Why |
|---|---|---|
| `C:\Fusion247PKA` | `hygiene/2026-07-28-doctrine-and-capture-persistence` | Primary. Live processes run from here (`liveRunner`, `apply-contract-command --watch`). |
| `C:\Fusion247PKA-tower` | `build-014/tower-recovery` | Tower merge-check runtime home. **SUPERSEDED 2026-08-05 — see the correction below.** |
| `C:\Fusion247PKA-w01` | `idea-017/w01-note-structure-validator` | Open **PR #72**; head matches the PR exactly. |

> **Correction, 2026-08-05 (WO-2026-08-05-03, BUILD-020 proofline).** `C:\Fusion247PKA-tower` is **no
> longer the Tower merge-check runtime home** and must not be treated as one. The row above is
> accurate as of 2026-07-28 and is kept as the record of that date.
>
> The live Tower runtime is `C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs` — verified
> by execution on 2026-08-05 (`Win32_Process`, PID 31268). The `-tower` worktree is pinned at
> `3c08e45` on `build-014/tower-recovery` and is **stale**: it carries a superseded `mergeCheck.mjs`
> and has **no `reviewDiff.mjs` at all**, which is the current Codex review route. Anyone sent there
> for merge-check evidence is reading a tree three weeks behind the estate.
>
> The worktree is authorised for `git worktree remove` under WO-2026-08-05-03 and that step is
> **sequenced behind WO-2026-08-05-04** (the machine-level launcher deletion), so at the time of
> writing the directory may still exist. Its existence is not a reason to use it.

### Unmerged remote branches preserved (15)

`build-002/multimodal-intake` (+1) · `build-002/wp2-telegram-governance-control-surface` (+3) ·
`build-010/tower-reliability-hotfix` (+6) · `build-010/wp1-reliable-autonomous-governance-loop` (+15) ·
`build-014/before-live-hardening` (+1) · `build-014/campaign-codex-review` (+1) ·
`build-014/directus-live-cockpit` (+15) · `build-014/tower-recovery` (+1) ·
`claude/agent-count-kdved6` (+3) · `claude/good-morning-v99pbx` (+1) ·
`claude/idea-002-scaffold-fit-cp8idp` (+1) · `claude/ws-004-team-retro-recovery` (+4, **open PR #24**) ·
`hygiene/2026-07-28-doctrine-and-capture-persistence` (+1, **open PR #77**) ·
`idea-017/w01-note-structure-validator` (+3, **open PR #72**) · `tower/codex-qa-merge-gate` (+6)

### How to re-derive

```
git rev-parse origin/main
gh pr view 76 --json state,mergeCommit
gh api "repos/warwickallan/Fusion247PKA/commits/<SHA>/check-runs"      # exact-head CI
gh api "repos/warwickallan/Fusion247PKA/actions/runs?head_sha=<SHA>"   # which workflows RAN
for wf in .github/workflows/*.yml; do gh run list --workflow $(basename $wf) --branch main --limit 1; done
git rev-list --count <branch> --not --remotes=origin --tags   # 0 == nothing local-only
git worktree list && git stash list && git ls-remote --heads origin
```

Two `git rev-list` traps met and caught tonight, both worth remembering: a second `--not` **toggles
negation back on** (`--not --remotes=origin --not --tags` silently counts tag-reachable commits as
local-only), and `%(refname:short)` renders `refs/remotes/origin/HEAD` as plain **`origin`**, which
will look like a stray branch in any branch sweep.
