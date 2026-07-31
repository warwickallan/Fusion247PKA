---
name: T-10-rotate-session
type: work-order
build: BUILD-018
ticket: T-10
ticket_type: implementation
status: resolved
resolved: 2026-07-31
model: Opus
private_surface: none
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor
---

# T-10 — `/rotate-session`: bank, verify safety, emit the `/clear` instruction

## Outcome

The shortest working end-to-end rotation path: Larry runs `/rotate-session`, it
collects and validates the live programme state, **refuses with a precise reason
when the estate is unsafe**, and when safe banks + pushes the state, writes the
canonical handoff, and prints the exact `/clear` command for Warwick — without
invoking `/close-session`, ClickUp or Google Drive.

## The seam this ticket actually owns

T-13 collects the estate and T-09 validates and persists it. **T-10 owns only the
judgement between them** — whether this estate is safe to rotate at all — plus the
banking act. That is why it is Opus: everything mechanical was already split out.

## Decisions taken

### D-1 — Fail CLOSED here, and that does not contradict INV-2

INV-2 ("never trap Warwick") governs **blocking paths in his live session** — the
RED preflight hook (T-06), which must fail open. Rotation is not such a path:
refusing costs a delay, while banking a wrong or incomplete state is silently
wrong for every future session. So **every uncertainty resolves toward refusing**,
and "could not determine" is never "safe" — the same rule that makes `BLIND`
first-class in the evaluator (INV-1, AD-3).

Concretely: `clean === null` refuses ("unknown is not clean"), `unpushed_commits
=== null` refuses ("unknown is never zero"), an unreadable HEAD refuses, and a
**safety-critical field declared in `unknown` by the collector becomes an
obstacle** rather than a check that quietly passed over ground nobody examined.

### D-2 — Live-worker detection is biased toward refusing, and excludes itself

F-7 keeps worker detection best-effort. A false refusal costs a delay; a false
all-clear rotates out from under a running worker. So any unexplained live pid in
**this programme's own worktree** refuses. Two necessary refinements:

- **Self-exclusion.** The rotation process and its parent are not "live workers" —
  the CLI passes `[process.pid, process.ppid]` as `excludePids`, or the command
  would always refuse against itself. `--exclude-pid` handles known false matches.
- **Scope.** A live worker in *another* worktree is not this rotation's business
  and does not block it.

### D-3 — AD-14 implemented as a named, exported comparison

`banked.head_sha` is the head the state **describes** — the parent of the banking
commit — because a file cannot contain its own commit's SHA. `isBankingCommit({
headSha, bankedHeadSha, headParentSha })` is the comparison every consumer (T-11
especially) must use instead of a naive `HEAD !== banked.head_sha`, which would
report every freshly banked state as stale and fire RECOVERY on **every** rotation,
training Warwick to ignore it. Proven on real git, with a positive control.

### D-4 — `--dry-run` genuinely writes nothing

The first cut wired `--dry-run` to `push: false`, which still wrote the state,
wrote the handoff and committed — a "dry run" that mutates the repository is a
trap. It now performs the entire judgement and returns before the first write.

### D-5 — Three distinct exit codes

`0` rotated · `1` refused · `2` BLIND. "Refused" and "could not tell" are
different facts and must not share a code — the same reason `BLIND` has its own
exit code in the evaluator design.

## Delivered

| Path | What |
|---|---|
| `tools/governor/rotate-session.mjs` | `assessRotationSafety` (pure judgement), `isBankingCommit` (AD-14), `renderClearInstruction`, `renderRefusal`, `rotateSession` (compose + bank + push), git adapter, CLI. |
| `tools/governor/rotate-session.test.mjs` | 31 tests. |
| `.claude/commands/rotate-session.md` | The Larry-facing slash command, matching the estate's existing frontmatter convention (`name`/`description`/`user_invocable`). |

## Acceptance criteria

- [x] **Refuses with the precise obstacle when unsafe** — proven three ways in real
      git (dirty tree, unpushed commit, live worker), each also asserting **nothing
      was committed** (HEAD unchanged) and no handoff was written.
- [x] **Banks, writes the handoff, commits and pushes when safe** — end-to-end
      against a real scratch repo with a real bare origin; asserts the pushed ref on
      origin matches local HEAD, the state re-reads as valid, and the tree is clean
      afterwards.
- [x] **Writes the canonical handoff, derived not composed** — the end-to-end test
      asserts all five `HANDOFF_SECTIONS` appear **in order** and the file carries
      `provenance: derived`.
- [x] **Honours AD-14** — asserts `bankedHeadSha === git rev-parse HEAD^` after
      banking, and `!== HEAD`, on real git.
- [x] **Does not invoke `/close-session`, ClickUp or Google Drive** — see below.
- [x] 31/31 passing; **137/137** across the whole governor suite.

## Mutation tests (all passing)

The map's specified mutation — *"Dirty tree / unpushed commit / live worker →
refuses. Assert it can actually say no."* — implemented against **real git** for
all three, each with the "nothing was committed" assertion so a refusal that
silently banked anyway would fail.

Also made to fail: unreadable HEAD, null cleanliness, null unpushed count,
safety-critical `unknown`, own worktree missing from the report, missing state
file, corrupt state file, and a failing `git push` (reported as
`banked-not-pushed`, never as a successful rotation). Plus a **negative control**
proving a non-safety-critical `unknown` (`branches.behind`) does **not** block
rotation — without it, the "unknown blocks" rule could pass by blocking everything.

## Finding — a substring ban was the wrong control

The first INV-4 test forbade the strings `close-session`, `clickup`, `drive` etc.
anywhere in the module. It failed immediately — because the module legitimately
**prints** `"This command did NOT run /close-session"`. A test that forbids the
string would forbid the very sentence that tells Warwick the invariant held.

Replaced with controls that assert the *invocation shape* rather than a proxy:
(1) no import resolves to any of those surfaces; (2) **every `execFile` call in the
module shells out to `git` and nothing else**; (3) the session-log surface is never
referenced and the single permitted write target is reached through T-09's
`sessionHandoffPath()`. These would actually catch the thing the substring ban was
standing in for.

## Handback

**Proven live, not just in tests.** Run against the real estate mid-ticket while
this ticket's own work was uncommitted, `/rotate-session` **correctly refused**
with `[dirty-tree]` and banked nothing — requirement 3 demonstrated against the
real repository rather than only a scratch one.

**One cosmetic defect, not fixed (out of scope, logged not silently absorbed):**
`worktree-recon.mjs` (T-07) lets child `git rev-list` failures print
`fatal: no upstream configured for branch ...` to stderr — 14 lines of noise on
every rotation, from worktrees with no upstream. It is harmless (the adapter
already returns `null`, correctly, for those) but it is ugly on a Warwick-facing
command. Belongs to T-07's module; not touched here.

**`Team Knowledge/fusion-brief/session-handoff.md` is now overwritten by rotation**,
which is exactly what T-09 deferred to "T-10's act at a real rotation". It happens
on this build branch only — `main`'s copy is untouched.
