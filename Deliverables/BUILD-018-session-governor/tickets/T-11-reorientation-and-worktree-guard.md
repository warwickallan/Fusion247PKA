---
ticket: T-11
build: BUILD-018
title: "Reorientation on /clear, canonical-location verification, and the wrong-worktree deny gate"
state: resolved
model: Opus
depends_on: [T-09, T-10]
resolved: 2026-07-31
private_surface: none
---

# T-11 — Closing the rotation loop, and making the location a control

## The outcome

One active build has **one canonical branch, one canonical worktree and one
persistent build session**. `/clear` rotates context *inside* that session.
Warwick never has to understand, choose or change a branch or a worktree, and
never has to re-brief a fresh Larry.

T-10 delivered the banking half: state gets *out* of a dying session reliably.
T-11 delivers the other half and the thing that makes it safe:

1. **Reorientation** — `SessionStart(source="clear")` finds the banked state and
   injects a bounded pointer brief automatically.
2. **Location verification** — before any implementation, the session's actual
   cwd, repository root, branch and HEAD are compared against the banked state.
3. **The deny gate** — a committed `PreToolUse` hook refuses `Write`, `Edit`,
   `MultiEdit`, `NotebookEdit` and mutating `Bash` while the session is not in
   the canonical worktree/branch.

Without (2) and (3), (1) is a suggestion. A Larry holding correct absolute paths
can write perfectly good code into the right *files* from the wrong *repository
state*: it lands on the wrong branch, nothing errors, and the session looks
productive. **Absolute-path luck is not a control.**

## What shipped

| File | Role |
|---|---|
| `tools/governor/reorient.mjs` | `SessionStart` hook: discovery, validation, freshness (AD-14), location verification, the ≤10,000-char pointer brief. |
| `tools/governor/worktree-guard.mjs` | The shared location comparison **and** the `PreToolUse` deny gate. |
| `tools/governor/install-hooks.mjs` | Committed, idempotent activation of BOTH hooks + the Q-5 reconciliation. |
| `*.test.mjs` for each | 84 tests across the three files; 223 across the whole Governor suite. |

The brief and the gate **read the same comparison from the same module**, so the
brief can never say "aligned" while the gate is denying, or the reverse.

## The brief (requirement 3)

`hookSpecificOutput.additionalContext`, hard-capped at 10,000 characters, carrying:
programme/build · phase · **exact next ticket** · recommended model · canonical
worktree · canonical branch · **current pushed head** (read live from the
remote-tracking ref, not the head that happened to be pushed at banking) · banked
head · open blockers · frontier · do-nots · read-firsts · safe resumption
instruction · and the paths to read for everything else. It is a **pointer**, not
a state dump — a dump cannot fit and would go stale in the same breath.

## Decisions settled here

- **AD-17 — the artefact hierarchy** (requirement 10). Goal/Build Contract =
  product SSOT › Wayfinder map = live execution SSOT › Implementation Plan =
  initial route only › `programme-state.json` + `session-handoff.md` = generated
  projections. A projection disagreeing with its source is a defect in the
  projection. This is what makes `/rotate-session` regenerating them safe.
- **AD-18 — what the gate keys on.** cwd, repository root and branch ONLY. HEAD
  is compared and reported (staleness, AD-14) but **never denies**: the moment a
  session makes its first legitimate commit its HEAD diverges from the banked
  head, and a gate keyed on HEAD would block the session for having succeeded.
- **AD-19 — which way each failure falls.** Cannot establish *where we are* while
  a canonical location IS known → **DENY** (unknown is never aligned). No active
  programme at all, or the guard itself throws → **ALLOW**. A guard that bricks
  unrelated sessions, or turns its own bug into a total work stoppage, gets
  removed within a day — and a removed control protects nothing. Both directions
  are proven by test.
- **AD-20 — the operating responsibility** (requirement 11). Warwick never
  manages branches, worktrees, commits, pushes or PR creation. Larry owns the
  complete Git lifecycle. This is printed in every brief, and the recovery
  protocol in every refusal says so explicitly.
- **AD-21 — the EnterWorktree recovery protocol** (requirement 7). Larry
  initiates it; under Remote Control the approval may appear only in the local
  terminal, so Larry must immediately say the exact sentence *"Approve the
  pending EnterWorktree request in the local Claude terminal"*, then wait. Larry
  must not spin silently, must not continue by absolute paths, and must not ask
  Warwick to run git commands. The protocol is embedded verbatim in the deny
  message and in the brief, because a recovery instruction that lives in a
  document nobody is reading at that moment is not a recovery instruction.

## Constraints resolved

- **X-2** — `.claude/settings.local.json` is globally gitignored, so hook wiring
  cannot travel by git. Resolved by shipping `install-hooks.mjs`: committed,
  idempotent, reviewable, re-runnable on any machine. The *behaviour* is in git;
  only the activation touches the untracked file. (Requirement 9.)
- **Q-5** — the dangling `ensure-watcher.mjs` `SessionStart` hook. Reconciled,
  not stacked beside (requirement 8). The rule is deliberately generic and
  self-limiting: **prune `SessionStart` command hooks whose target script does
  not exist on disk.** It cannot over-reach (a hook whose script exists is never
  touched), it fixes the class rather than the instance, and everything pruned is
  reported and backed up. Governor-managed hooks are exempt, so a fresh clone can
  install before it builds.

## Two real defects the tests caught

Both were found by tests, not by reading — recorded because they are exactly the
kind of thing that ships silently:

1. **`git rev-parse --abbrev-ref` is sticky.** `rev-parse --show-toplevel
   --abbrev-ref HEAD HEAD` prints the branch name *twice* and the SHA never. The
   live HEAD would have been silently wrong. Fixed by asking for the SHA first.
2. **One programme, many copies.** A `programme-state.json` is a tracked file, so
   every worktree carrying that branch holds a copy — and after merge, main does
   too. Counting *files* reported one build as two "active programmes", and the
   guard stood down on the exact estate it was written for. Identity is now the
   programme **ID**, with the self-consistent copy preferred.

## Known bound (not a defect, recorded honestly)

The guard discovers the estate by enumerating `git worktree list` from the
session's cwd. From a *completely unrelated* repository it therefore cannot know
about the build. Mitigated by `--estate <path>`, which the installer always
passes (pointing at the primary checkout). A session in a foreign repo with no
estate hint gets no guard — recorded rather than papered over.

## Handback

- The installed hook commands point at `C:/Fusion247PKA-governor/tools/governor/*`,
  where the scripts currently live. **When BUILD-018 merges, re-run
  `node tools/governor/install-hooks.mjs` from the primary checkout** to re-point
  them. The installer is idempotent and re-pointing is a single detected change.
- Evidence: `Deliverables/BUILD-018-session-governor/evidence/T-11-reorientation-and-guard.md`
- Follow-on work is **T-14** (registry/launcher, automatic programme PR,
  exact-head QA binding, single merge decision) — specified, deliberately NOT
  implemented here.
