---
name: T-13-programme-state-collector
type: work-order
build: BUILD-018
ticket: T-13
ticket_type: implementation
status: resolved
resolved: 2026-07-31
model: Sonnet
private_surface: none
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor
---

# T-13 — Programme-state collector

## Outcome

Map live estate signals (git, `tools/governor/worktree-recon.mjs`, `gh`) onto the
durable programme-state schema (T-09), so `/rotate-session` (T-10) owns only the
refusal **judgement**, not also data collection — the split T-09's handback
identified: "mapping live git / worktree-recon / gh output onto a now-fixed,
validated schema is mechanical; deciding whether the estate is safe to rotate is
judgement."

## Scope decision — what T-13 collects, and what it deliberately does not

The schema's required top-level fields split cleanly into two kinds: fields git/
worktree-recon/`gh` can answer (`repository`, `worktrees`, `branches`,
`pull_requests`), and fields that are programme knowledge no estate scan can
produce (`programme`, `phase`, `tickets`, `blockers`, `model_recommendation`,
`resumption`, `locked_decisions`, `runtime_pointers`, `privacy`). T-13 collects
only the first kind and merges into a caller-supplied base document carrying the
second — it does not (and cannot) synthesize a full programme-state document
alone.

**`workers` is deliberately not collected here either.** F-7 already establishes
that even live-worker *detection* is best-effort; the dispatch *record* (which
subagent, which ticket, what it was expected to produce) is a different,
non-derivable fact that only the dispatching session holds. Attempting to invent
worker entries from OS process scans would manufacture false precision under a
schema field whose whole point (D-2 in T-09) is refusing to let an empty or
guessed collection read as ground truth.

## Implementation

`tools/governor/collect-state.mjs`, pure/adapter split (mirrors AD-11 and T-07's
own pattern):

- `collectRepository` — `head_sha`/`clean`/`upstream`/`unpushed_commits` via git,
  each call failing soft. The schema's required string fields (`head_sha`,
  `base_sha`, `branch`) fall back to the literal `"unknown"` sentinel the
  schema's own pattern already permits (never an empty string, which the schema
  would reject); nullable fields (`clean`, `unpushed_commits`, `upstream`) fall
  back to `null`, never a manufactured `0`/`false`.
- `collectWorktrees` — thin wrapper over T-07's `reconcile()`. A throw (or an
  empty result, which for a real repository is never a legitimate "there are
  none") collapses to `[]` **plus** a declared `unknown` entry — never a silent
  empty array.
- `collectBranches` — takes caller-supplied `branchSpecs` (which branches matter
  to *this* programme and their role is programme knowledge; git cannot single
  these out of hundreds of branches in this estate on its own). Per-branch head/
  ahead lookups fail soft to `null`; a wholly unreadable repository fails the
  whole collection to `unknown`. **`behind` is never computed** — a trustworthy
  behind-count needs a fresh `git fetch`, and a collector must not mutate the
  repository it is reporting on — so `branches.behind` is *always* declared
  `unknown`, matching the real BUILD-018 `programme-state.json`'s own existing
  precedent from T-09.
- `collectPullRequests` — via `gh pr list --head <branch> --state all`. An empty
  result for a branch is a genuine, positive "no PR" (`state: "none"`), not a
  failure; only a `gh` invocation *error* (not installed, not authenticated,
  unparseable output) counts as a source failure, and the first such error
  aborts the whole collection rather than degrading branch-by-branch (once `gh`
  is broken, every subsequent call would fail identically).
- `collectEstateState` — composes all four, deduplicating `unknown` by path.
- `mergeEstateIntoState(baseState, estate)` — overlays the four estate-derived
  fields onto a base document and unions `unknown`; does not validate itself
  (`programme-state.mjs` owns validation, kept single-purpose).

## Acceptance criteria

- [x] Produces a valid state document from the real estate — proven by running
      `collectEstateState` against **this actual repository** (no mocks: real
      git, real `gh pr list --repo warwickallan/Fusion247PKA`, real
      `worktree-recon.reconcile()`), merging onto the T-09 fixture's non-estate
      sections, and asserting `validateProgrammeState(...).ok === true`.
- [x] Everything it could not gather is declared in `unknown` with a reason —
      every failure path (repo unreadable, worktree unreadable, no `gh`, no
      branch specs, no `ghRepo` configured) returns a reasoned `unknown` entry,
      never a silently empty array.
- [x] `tools/governor/collect-state.test.mjs` — 18/18 passing (`node --test`).

## Mutation tests (map-specified, all passing)

Each source made to fail in turn, each proven to land its field in `unknown`
rather than an empty list or a zero:

- **No `gh`** (`gh` invocation throws, e.g. `spawn gh ENOENT`) → `pull_requests`
  is `[]` **and** `unknown` carries `{ path: "pull_requests", why: "...ENOENT" }`.
- **Unreadable worktree** (`reconcile()` throws) → `worktrees` is `[]` **and**
  `unknown` carries `{ path: "worktrees", why: "...worktree reconciliation
  failed..." }`.
- **Git error** (`git rev-parse --git-dir` fails — an unreadable repository) →
  both `repository.head_sha` falls back to the `"unknown"` sentinel (never a
  fake sha) with a matching `unknown` entry, **and** `branches` collapses to
  `[]` with its own `unknown` entry — proven as two separate assertions since
  they are two independently-failing code paths sharing one root cause.

Also covered: a single unresolvable branch (deleted/never-fetched) degrades to a
`null` head for *that* branch only, without breaking sibling branches in the same
collection — the per-branch failure boundary is real, not just claimed.

## Handback

**One thing worth flagging, not a blocker:** the map's ticket-index row lists
T-10's dependency on T-13 in parentheses — "may proceed without T-13... but
should not." Since T-13 is now resolved, `programme-state.json`'s `tickets[T-10]
.depends_on` has been updated to name it explicitly (`T-07`, `T-09`, `T-13`),
which is now simply true rather than aspirational, and directly answers "is T-10
fully unlocked" without leaving it implicit in prose.

No scope was reopened. `branches.behind` staying permanently `unknown` under this
collector is by design (see Implementation), not an oversight — flagged loudly in
code comments so a future reader building `/rotate-session` doesn't mistake it
for a bug to fix.
