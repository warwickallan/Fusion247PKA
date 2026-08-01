---
ticket: T-14
build: BUILD-018
title: "Build-session registry/launcher, automatic programme PR, exact-head QA binding, single merge decision"
state: resolved
model: Opus
depends_on: [T-10, T-11]
resolved: 2026-07-31
private_surface: none
---

> **RESOLVED 2026-07-31.** All four deliverables shipped; see `02-MAP.md` §10 for the
> full write-back, including the three bounds that remain **open** and were not
> counted as closed. Interface contract: `../T-14-CONTRACT.md`. Decisions recorded
> as AD-22..AD-25.

# T-14 — From "a rotation works" to "a build runs itself"

**Specified in T-11 as required remaining work. Deliberately NOT implemented
inside T-11** — T-11's job was to close the rotation loop and make the location a
control. This ticket is the next layer up: making the whole build lifecycle
something Warwick never has to operate.

## Why this exists

T-11 guarantees that *if* you are in the right place, you resume correctly, and
that if you are not, you are stopped. It does not yet answer the question Warwick
actually asks: **"carry on with the governor build"** — by name, with no path, no
branch, no worktree, no PR mechanics, and one decision at the end.

## Scope — four deliverables

### 1. A human-friendly build-session registry and launcher, by build name

A durable registry of active builds keyed on the **build name**, mapping to its
canonical worktree, canonical branch, programme-state path and session identity.
A launcher that takes `governor` (or `BUILD-018`) and puts the session in the
right place, or reports precisely why it cannot.

- Warwick names a build. Nothing else.
- The registry is a **projection** under AD-17 — generated from banked state,
  never hand-authored, and a disagreement with its source is a defect in it.
- Must handle: build not found; build found but worktree missing; two builds
  claiming one worktree; a build whose branch has been merged and cleaned.
- The `--estate` bound recorded in T-11 (a session in a foreign repository cannot
  discover the estate) is properly closed here: the registry is the estate's
  index and does not depend on `git worktree list` from an arbitrary cwd.

### 2. Automatic create/update of the programme PR at merge readiness

When a programme reaches merge readiness, the PR is **created or updated by
Larry**, not requested from Warwick (AD-20). Body derived from the goal contract,
the map's settled decisions and the resolved-ticket evidence — a projection, not
a fresh composition (document-mirroring rule: one canonical source, copied).

- "Merge readiness" must be a **defined, checkable predicate**, not a vibe:
  every ticket in scope resolved with evidence, suite green, tree clean, local
  HEAD == remote head, independent review complete.
- Idempotent: re-running updates the existing PR, never opens a second.
- Must NOT merge. Creating a PR and merging it are different authorities.

### 3. Exact-head QA binding

A review verdict is only meaningful against the **exact commit it reviewed**.
Bind every QA/review record to the full identity tuple (repo, branch, commit SHA)
and refuse to present a stale verdict as current.

- If the head moves after review, the verdict is **not** carried forward — it is
  marked superseded and re-review is required at the integrated head.
- Fails closed: an unknown or unreadable head is never "the reviewed head".
- Canonicalise the SHA once at the boundary and key durable state on it, rather
  than re-deriving it at each call site.

### 4. Present only the final merge decision to Warwick

Everything above happens without Warwick. What reaches him is one decision:
**merge this, or not**, with the evidence attached and the risks named. Branch
management, worktree management, commits, pushes, PR creation and re-review are
Larry's (AD-20). Merge-to-main remains Warwick's — it is the single standing gate.

## Out of scope

- Merging. T-14 prepares and presents; it never merges.
- Replacing the reviewers or their independence.
- Any change to the T-11 deny gate's semantics (AD-18 / AD-19).

## Notes for whoever takes it

- Read `02-MAP.md` first — it is the live execution SSOT (AD-17).
- The registry is the natural home for the T-11 known bound; do not re-solve that
  bound inside the guard.
- Size the work by coupling and review cost, not by file count. (1) and (4) are
  separable from (2) and (3) and could ship first as a thin working slice.
