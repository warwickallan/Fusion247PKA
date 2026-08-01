---
name: build-018-session-governor-estate
type: build-estate-record
build: BUILD-018
status: open
created: 2026-07-31
---

# BUILD-018 — Larry Session Governor & Context-Rotation Layer — ESTATE RECORD

This file records the isolation decision and its evidence. It is written first, before any
implementation file, so that the base of this build is provable rather than remembered.

## Identity and ownership

| Field | Value |
|---|---|
| Build ID | **BUILD-018** |
| Name | Larry Session Governor & Context-Rotation Layer |
| Branch | **`build-018/session-governor`** |
| Worktree | **`C:/Fusion247PKA-governor`** |
| Base SHA | **`ef96a3327f896e025731769c72157fd722daa02f`** (= `origin/main` at 2026-07-31) |
| Owner | Larry (orchestration + integration authority) |
| Commissioned by | Warwick, directly — 2026-07-31 |
| Phase | Phase 1 — Wayfinder / architecture (Opus). Implementation is explicitly NOT this phase. |

**On the identifier.** `018` is the next free number: the estate uses a shared IDEA/BUILD numbering
sequence and `IDEA-017` (note-structure-validator) is the highest in use. **BUILD-018 was commissioned
directly by Warwick and was NOT promoted from a Foundry idea** — there is deliberately no `IDEA-018`.
Recorded here so no future reader concludes one is missing.

## Base decision — why `ef96a33` and not the alternatives

Evidence gathered before cutting anything (`git fetch` then `git log --graph --all`):

```
95c265d  (recovery/2026-07-31-governor-abort-handoff, origin/recovery/...)  ← FORBIDDEN as base
de92306  (main)  Session close: CareerAIR ...                              ← local-only, unpushed
ef96a33  (origin/main, origin/HEAD)  Merge PR #85 ...                      ← CHOSEN BASE
```

| Candidate | SHA | Verdict |
|---|---|---|
| `origin/main` | `ef96a33` | **CHOSEN.** The published shared base every other branch reconciles to. |
| local `main` | `de92306` | Rejected — one unpushed commit of *unrelated* work (CareerAIR session close). Basing here entangles BUILD-018 with a commit that belongs to another programme item. |
| recovery branch | `95c265d` | Rejected — explicitly forbidden by the commissioning instruction, and correctly so: it is awaiting its own PR review. |

Note for the reconciliation record: `de92306` is **already published** as an ancestor of the pushed
recovery branch, so choosing `ef96a33` does not strand it. When the recovery PR merges, `main` will
carry `de92306` + `95c265d`; this branch reconciles onto that head normally. No overlap in files is
expected — see the dependency below for the one place it matters.

## Dependency — GL-012 §6a is NOT in this worktree

**This is a real hazard and must not be discovered by a worker at handback.**

The settled private-surface session-log ruling (**GL-012 §6a**, plus its propagation into GL-009,
SOP-022 step 9c and the work-order template) exists **only on `recovery/2026-07-31-governor-abort-handoff`
at `95c265d`**. It is *not* on `origin/main`, therefore *not* in this worktree's checkout.

Consequence: a worker in this worktree that opens
`Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md` will read the **pre-§6a** text and
may re-escalate the very conflict §6a settles.

**Mitigation, mandatory on any ticket touching privacy or session-log placement** — read the settled
text directly from the recovery commit rather than from the working tree:

```
git show 95c265d:"Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md"
git show 95c265d:"Team Knowledge/SOPs/SOP-022-work-order-preflight.md"
```

This dependency clears itself the moment the recovery PR merges to `main` and this branch reconciles.
Until then it is live.

## Constraint discovered at worktree creation — hook wiring cannot be delivered by git

`.claude/settings.local.json` is **globally gitignored** (`C:/Users/Buggly/.config/git/ignore:1` →
`**/.claude/settings.local.json`). Verified: `git ls-files --error-unmatch` reports it unknown to git.

Two consequences, both architectural, not incidental:

1. **This worktree has no hook configuration at all.** That is *good* for isolation — probes and tests
   run here will not fire the live Tower/capture-gateway hooks — but it means the worktree is not a
   faithful replica of the live hook environment, and a green test here does not prove live behaviour.
2. **The Governor's own hook wiring is not a deliverable git can carry.** Whatever `SessionStart` /
   `PreCompact` / `statusLine` entries the Governor needs must be *installed into the primary
   checkout's untracked `settings.local.json`* by an explicit, idempotent activation step. A ticket
   that "adds the hook" by editing a file in this worktree ships nothing.

This is recorded as a first-class dependency in the map, not a footnote.

## What this build must NOT touch — standing boundary

Carried from the commissioning instruction and verified as current estate baseline:

- **Local `main`** (`de92306`) — not altered, not reset, not pushed by this build.
- **`recovery/2026-07-31-governor-abort-handoff`** (`95c265d`) — banked; its PR is **not** to be opened
  or merged during this build.
- **Six Cairn source-intake items** under `Team Knowledge/Sources/` (3 `_raw/` dirs + 3 `.md`) —
  deliberately untouched, in the primary checkout only. Read-only reference is permitted; modification,
  move and deletion are not, absent proof of owner and disposition.
- **Twenty pre-existing worktrees** (17 `.claude/worktrees/agent-*` + `Fusion247PKA-audit`,
  `-tower`, `-w01`). **Baseline evidence, not cleanup permission.** None may be removed without first
  proving owner, branch, status and integration disposition.

## Verification receipt

```
worktree HEAD: ef96a3327f896e025731769c72157fd722daa02f
branch:        build-018/session-governor
base == origin/main: YES
working tree:  clean at creation
```
