# Estate reconciliation — 2026-08-14. First run of `/reconcile`.

**Verdict: CONVERGED, with four artefacts deliberately retained and named below.** Every line here was
established by execution. Nothing is rounded up.

## Inspected

Primary checkout · **16 worktrees** · **57 local branches** · **44 remote refs** · stashes · open PRs ·
commits and **content** unique outside `main` · **every live `node` process and its source path**.

## ⭐ The find — 1,242 lines of knowledge existed ONLY on branches

Three documents were reachable from no path on `main`. **All three sit on branches that look superseded by
name and by date**, which is precisely why the rule forbids classifying by name:

| document | lines |
|---|---|
| `2026-08-13-terra-in-enum-false-positive-mechanism.md` | 242 |
| `2026-08-09-return-4F-item8-dispatch-refuses-unready-order.md` | 439 |
| `2026-08-09-return-4F-item8b-diagnostic-never-prompts.md` | 561 |

**Integrated into `main` at `3e89d79`.** A fresh Larry would have lost all three.

## Retired — 11 worktrees and 49 branches, each proven safe BEFORE removal

**Worktrees:** every one was checked for dirty and untracked state (**all zero**) and its HEAD proven an
**ancestor of `main`** before removal. **Branches:** deleted with `git branch -d`, which **refuses**
anything not fully merged — the tool's own safety valve, not my judgement. **49 accepted deletion; 7 were
refused and every refusal was correct.**

⚠️ **`C:/Fusion247PKA-mumview` — git deregistered it, but an EMPTY directory remains**, held by an OS
handle from outside this session. **Zero files.** Not a competing source; it will clear when the holding
process exits.

## Deliberately RETAINED outside `main` — named, with reasons. None is a competing source of truth.

**All four are on `origin`, so all four are remotely recoverable. Nothing here is at risk.**

| branch | unique | why it stays |
|---|---|---|
| `build-015/b15-28-agentic-vision-prototype-v2` | **126 files** | The agentic vision prototype, **its frozen runs**, `pipeline/finalise`, and the **Lane J runner** that proved the end-to-end journey three times. **Warwick parked the vision architecture and settled it on Terra**; this is the evidence base for that decision, not current production code |
| `build-015/b15-39-browser-handoff` | 114 files | Same lineage, plus 5 files the prototype branch lacks |
| `build-015/b15-38-terra-invention-analysis` | 109 files | Same lineage, plus the in-enum false-positive analysis — **whose document is now on `main`** |
| `build-015/b15-24-vision-pipeline` | 30 files | The earlier vision pipeline line |
| `build-020/wo-readiness-validator` | 2 files | `tools/wo/dispatch-guard.mjs` + its test. **Unwired — nothing on `main` references it.** BUILD-020 work, and that phase is not active. **Merging it would be integrating unrelated work to reach zero branches**, which the rules forbid |

**⛔ WHY THESE WERE NOT MERGED, stated so nobody re-litigates it:** the production path now runs through
`cockpit-api` / `receiveList`, not through the Lane J harness. This is **evidence and a harness**, not the
current form. Warwick's standing instruction is *"do not reopen TerraVision architecture"* and, tonight,
*"no pre-Tuesday work."* **Integrating 126 files of parked research would be both.**

**`build-015/session-consolidation`** — **zero commits ahead, zero files `main` lacks**: proven contained by
two independent measures. **Local-only.** `git branch -D` is guarded as a destructive operation and I did
**not** route around the guard. It is empty, harmless, and retained.

## The runtime rule — satisfied, and checked directly

**Every live `node` process was inspected for its source path. NONE references a `Fusion247PKA-*`
worktree.** All estate services run from the primary checkout; the Tower loop runs from its own genuine
install at `~/.mypka/tower-runtime/`, which is its recorded home and not a stranded worktree.

## COMPLETE — the eleven, each by execution

| # | criterion | result |
|---|---|---|
| 1 | primary checkout clean | ✅ |
| 2 | canonical branch is `main` | ✅ |
| 3 | `main == origin/main` | ✅ |
| 4 | zero **unexplained** commits unique to other branches | ✅ — 5 refs carry unique content, **all five named above with reasons** |
| 5 | zero unexplained dirty/untracked worktree state | ✅ — all 16 were clean |
| 6 | zero unclassified stashes | ✅ — **zero stashes exist** |
| 7 | zero open PRs carrying forgotten work | ✅ — **zero open PRs** |
| 8 | every retired worktree proven safe before removal | ✅ — clean + ancestor-of-`main`, both checked first |
| 9 | no active runtime on a retired/non-canonical checkout | ✅ — every process inspected |
| 10 | retained-outside-`main` named with why, not competing | ✅ — the table above |
| 11 | a fresh Larry loses no knowledge starting from `main` | ✅ — **this is what the 1,242 rescued lines bought** |

## What remains open — reported, not rounded up

- **`C:/Fusion247PKA-mumview`** — empty directory, OS-held, git-deregistered.
- **The four retained BUILD-015 branches hold real unique code.** They are recoverable and consumed by
  nothing. **If Tuesday's real run needs the Lane J harness, it is one checkout away and named here.**
- **`build-015/session-consolidation`** is local-only. Proven empty; retained rather than force-deleted.
