# Estate Map — Fusion247PKA repository, worktrees, branches, PRs

**Written 2026-07-28 by Larry**, executing `Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md`.
Reconstructed from live sources; nothing in the mission file was trusted without checking.

> This document is a **snapshot with a date on it**. Re-derive before acting on it.
> The commands that produced it are listed at the bottom.

---

## What was actually wrong

Three real problems, in descending order of how much they would have cost:

1. **`main`'s CI was silently red for two days.** Not just red — *quietly* red. See below.
2. **The knowledge-capture path leaks.** Source notes are written to the working tree and never
   committed, so every capture sits on one machine, unbacked, until a human runs `git status`.
3. **Work existed on exactly one machine.** Most notably an unpushed, uncommitted fix to the Tower
   merge-check runtime that closes a real reviewer-correctness defect.

Everything else was noise: 37 scratch branches and seven worktrees with nothing unique in them.

---

## 1. `main` was red, then went quiet

`build-002-tests / gateway` has failed on `main` since **PR #60 merged on 2026-07-26**. Four
consecutive merges went in red — **#60, #61, #64, #66**. Last genuinely green run: **#59, 2026-07-25**.

It then stopped *looking* broken. Every merge after #66 (#70, #71, #73, #74, #75) touched only
path-filtered paths, so the workflow never re-ran. A casual `gh run list --branch main` shows an
unbroken wall of green, because the failing workflow simply stopped being invoked. **The most recent
result for that workflow was still a failure.**

**Cause.** PR #60 gave *Save to Brain* its own full-width row so the label stops truncating to
"Save to Brai…", making the keyboard `[[Save to Brain], [Ask Larry, Keep Raw]]`.
`telegramLiveAdapter.test.js` read `inline_keyboard[0]` only and asserted all three labels lived in
it. The product code is correct and deliberate (`telegramLiveAdapter.js:176-183`); the assertion was
never updated alongside it.

**Fixed** on `hygiene/2026-07-28-estate-rescue`. The test now asserts the **full two-row layout**
rather than one row — reading a single row is precisely what let the drift through, and the row
split is the behaviour #60 meant to lock in. All three buttons still ship. No product code changed.

Gateway suite run exactly as CI runs it (`node --test` in `services/fusion-capture-gateway`):
**320 tests, 288 pass, 0 fail** — previously 287 pass / 1 fail.

> **The durable lesson is not the fixture.** It is that a path-filtered workflow going *unrun* looks
> identical to it going *green*. A red `main` disappeared from view without anyone fixing it.

---

## 2. The capture path leaks knowledge

> **Correction (later the same night).** This section originally named
> `services/obsidiwikai/src/bin/compile-source.mjs` as the writer. That is wrong — it is a 36-line
> wrapper the ObsidiWikAi README lists as *parked*. The real writer is
> `services/hub/youtube/generate-source-note.mjs` → `ingestYouTube()` in
> `services/hub/youtube/ingest.mjs`. The leak itself was real and is described correctly below;
> only the attribution was wrong. **Now fixed** — see `services/hub/youtube/persistCapture.mjs`.

`services/hub/youtube/generate-source-note.mjs` writes source notes and their `_raw` evidence into
the working tree. **Nothing committed them.** Two were sitting untracked tonight, and the second
appeared *during* this pass — which is what proves it is a standing leak rather than an oversight:

- `Team Knowledge/Sources/bcljofch8ms-…md` + `_raw/bCljOfCH8Ms/` (44KB note)
- `Team Knowledge/Sources/zxyslutljw4-…md` + `_raw/zXysLUTLjw4/` (33KB note)

They were **not gitignored** — every other `Sources/` note and `_raw/` capture on `main` is tracked.
They were simply never committed. Both are now preserved on the rescue branch, still at
`review_state: ai_created` / `pending-warwick-review`. **Preserved, not endorsed.**

**Decision for Warwick, not a hygiene fix:** should captures auto-commit? The `pending-warwick-review`
state may be a deliberate gate, in which case the answer is a different mechanism (a staging area, or
a notification) rather than an auto-commit. Larry did not assume.

---

## 3. Work that existed on one machine only

| Item | Where it was | Now |
|---|---|---|
| **Tower merge-check fix** — packet parameterisation + large-PR diff handling | uncommitted in `C:\Fusion247PKA-tower` | committed `3c08e45`, pushed to `build-014/tower-recovery` |
| `build-014/before-live-hardening` — WIP migration `003_head_authority_structural.sql`, genuinely not on `main` | local branch only | pushed to origin |
| `build-014/campaign-codex-review` — Codex dogfood review harness + 5 result sets | local branch only | pushed to origin |
| `Deliverables/2026-07-19-gpt-pr36-review-acceptance.md` | untracked inside a worktree being deleted | on the rescue branch |
| 2 Cairn source notes | untracked | on the rescue branch |
| 6 superseded local branch heads | local only | preserved as `archive/2026-07-28/*` tags on origin |

**The Tower fix is the one that mattered.** It closes two real defects in the merge-review path:

1. `brief_excerpt` was a **hardcoded Tower-specific acceptance line**. Sending that with a
   non-Tower diff produces an internally inconsistent packet — the reviewer is asked to judge diff A
   against brief B, and rightly refuses to approve. Now parameterised, with a neutral fallback
   derived from the classified build ref rather than a foreign brief.
2. `gatherGitEvidence` caps the diff at 60KB, reducing a large PR to a useless sample. The diff is
   now re-collected excluding bulky *non-code* artifacts (RAW transcripts, Deliverables, raw review
   dumps) under a much larger cap, so the reviewer sees the actual code, tests and migrations.

The merge gate itself is unchanged — `classifyMergeRun` still fails closed on missing
build_ref / repo / PR / full head SHA.

---

## The classified estate

### Worktrees — 13 → 6

| Worktree | Branch | Class | Status |
|---|---|---|---|
| `C:\Fusion247PKA` | `hygiene/2026-07-28-estate-rescue` | **A** | Primary. Live processes run from here (`liveRunner`, `apply-contract-command --watch`). |
| `C:\Fusion247PKA-tower` | `build-014/tower-recovery` | **A** | Tower merge-check runtime home. Was dirty; rescued and committed. |
| `C:\Fusion247PKA-w01` | `idea-017/w01-note-structure-validator` | **A** | **PR #72 is open.** Head matches the PR exactly. |
| `C:\Fusion247PKA-towerfix` | `build-010/tower-reliability-hotfix` | **D** | Paused hotfix, +6 commits over `main`. Pushed. Kept deliberately. |
| `C:\Fusion247PKA-b002wp2` | `build-002/wp2-telegram-governance-control-surface` | **D** | +3 over `main`, no PR. Pushed. Kept. |
| `C:\Fusion247PKA-b010wp1` | `build-010/wp1-reliable-autonomous-governance-loop` | **D** | +15 over `main`, no PR. Pushed. Kept. |

**Removed (class B — branch fully merged into `origin/main`, clean, no live process):**
`-fu1`, `-idea012`, `-w02`, `-w04`, `-baton`, and `.wt-campaign-codex-review` (which was nested
*inside* the primary working tree — bad hygiene in itself; its branch was pushed first).

**Removed (class C→B after rescue): `C:\Fusion247PKA-b010`.** This was the one that looked
frightening and turned out to be the opposite. It held `main` checked out at `d5578dd`, **270 commits
behind**, with 58 staged changes. Those changes were **a regression, not work**: a stale index that
*deleted* the AsdAIr control-plane, the asdair service, both CI workflows, and — most importantly —
**the `.gitignore` block protecting household personal data from this public repo**. Committing it
would have been actively harmful. Its one unique artefact was rescued first. Its removal also freed
the local `main` ref, which was pinned 270 behind; `main` now tracks `origin/main` at `dbba164`.

Every remaining worktree is clean.

### Branches

- **37 `worktree-agent-*` scratch branches deleted.** Every commit proven reachable from `origin`
  first. Pure agent-isolation residue.
- **6 superseded local branches deleted**, each preserved first as an `archive/2026-07-28/*` tag on
  origin: `wp-d-cockpit-proof`, `wp-d-cockpit-v2`, `wp-d-writeback-seam`, `wp-d-proof-preserve`,
  `wpd-v2-work`, `mack-tower-supervisor-fixes`.
- **Local branch count 91 → 48.**
- **Zero local-only commits remain.** Every commit on this machine is on `origin`, as a branch or an
  archive tag.

**Remote branches were classified, not deleted** — 49 merged, 15 unmerged. Deleting merged remote
branches is safe but it is history the repo currently carries deliberately; that is a call for
Warwick, not a side-effect of a cleanup pass.

Unmerged remote branches worth naming: `build-014/directus-live-cockpit` (+15),
`tower/codex-qa-merge-gate` (+6), `build-002/multimodal-intake` (+1), and four old `claude/*`
branches (`agent-count`, `good-morning`, `idea-002-scaffold-fit`, `ws-004-team-retro-recovery`).

### PRs

**Exactly one is open: #72** — BUILD-002 executable structural gate for the YouTube knowledge note
(IDEA-017 Experiment 0). Its `gateway` check is red **for the pre-existing `main` failure described
above, not for anything #72 did** — it adds two files under `services/hub/youtube/` and touches the
gateway nowhere. Once the fixture fix lands on `main`, #72 should go green on a re-run.

All other PRs #36–#75 are MERGED, except **#43 CLOSED** (superseded by #54).

---

## Corrections to the mission file's own leads

| Lead | Claim | Reality |
|---|---|---|
| 1 | Doctrine merged to `main` via #74 — *verify it* | **Confirmed.** `SOP-021-run-the-weekly-asdair-shop.md`, `SOP-022`, the Asdair contract, `.claude/agents/asdair.md` and the reconciled iron rule are all on `origin/main`. |
| 2 | **PR #73 is OPEN and deliberately unmerged; do not merge it** | **Stale — it was already MERGED**, 2026-07-27 22:34, as `352aee7`. After the handoff line was written, the two HIGHs were closed (`205d46d`) and Warwick recorded merge authorisation (`4c30eaf`). Nothing to protect. |
| 3 | Several worktrees may hold uncommitted work; one sat on deleted CI workflows | **Confirmed and resolved.** That tree was `-b010`; its deletions were a stale-index regression, not work. Its untracked artefact was rescued. |
| 4 | `main` failing CI on a Telegram card test | **Confirmed, and worse than stated** — red for four merges and then invisible. Diagnosed and fixed. |
| 5 | `.codex/agents/` holds 13 shims — audit later, do not touch | **Untouched**, as instructed. |

---

## What Warwick actually needs to decide

1. **Merge `hygiene/2026-07-28-estate-rescue`?** It carries the CI fix that un-reds `main`, plus five
   rescued artefacts. Merge-to-main is his gate; the branch is pushed and waiting.
2. **Should knowledge captures auto-commit?** The leak is real and recurring. The fix depends on
   whether `pending-warwick-review` is a deliberate gate.
3. **Delete the 49 merged remote branches?** Safe, but it is his history.
4. **The three class-D worktrees** (`-towerfix`, `-b002wp2`, `-b010wp1`) hold paused streams with
   3–15 unmerged commits each. All pushed, so the worktrees themselves are now disposable. Keep as
   working context, or remove and resume from the branch later?

---

## Not done, deliberately

Nothing was merged to `main`. No repository visibility changed. `C:\.fusion247\` untouched. Fable not
invoked. `.codex/agents/` untouched. No content verification performed — explicitly out of scope, so
the rescued source notes are **preserved, not accepted**.

## How to re-derive this

```
git worktree list
git -C <each> status --porcelain
git for-each-ref --format='%(refname:short)' refs/heads/   # then per branch:
git rev-list --count <branch> --not --remotes=origin --tags # 0 == nothing local-only
git rev-list --count <remote-branch> --not origin/main      # 0 == merged
gh pr list --state all --limit 40
gh run list --workflow build-002-tests.yml --branch main    # the workflow that went quiet
```

Note the `--not --remotes=origin --tags` form: a second `--not` **toggles negation back on**, so
`--not --remotes=origin --not --tags` silently counts tag-reachable commits as local-only. That
mistake was made and caught during this pass.
