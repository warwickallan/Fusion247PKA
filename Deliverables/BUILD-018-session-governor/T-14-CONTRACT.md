---
name: build-018-t-14-contract
type: interface-contract
build: BUILD-018
ticket: T-14
status: frozen
created: 2026-07-31
author: Larry (Opus) — published BEFORE parallel implementation
---

# T-14 — FROZEN INTERFACE CONTRACT

**Why this file exists.** T-14's four deliverables are being implemented in
parallel across disjoint files. Disjoint file ownership prevents *collisions*; it
does not prevent *shared misunderstanding*. This contract is published before any
worker starts so that three implementations cannot silently disagree about the
shapes they pass each other.

**Rank (AD-17):** this is an execution artefact. `01-GOAL-CONTRACT.md` wins over
it; `02-MAP.md` wins over it. If a worker finds this contract wrong, the correct
move is to say so at read-back, not to quietly implement something else.

**A signature in this file is frozen.** Adding an *optional* field is allowed.
Changing a name, a return shape, or a documented failure direction is not — raise
it instead.

---

## AMENDMENTS — ruled at read-back, 2026-07-31

The gate worked: three workers challenged this contract before writing anything,
and each of these is a correction to **the order**, not a divergence from it. The
sections below are as originally written; read them with these on top.

| # | Amendment | Why |
|---|---|---|
| **A1** | **Module 2 mutation test 2 is SPLIT.** "Unresolvable SHA" is proven at `canonicaliseTuple`; "null / malformed / abbreviated" is proven at `verdictStatus`. | As written it asked a **pure** function to observe a failure only git can see. `verdictStatus` has no git access and cannot tell a resolvable SHA from an unresolvable one. |
| **A2** | **`requiredReviewers: []` yields `allCurrentApproved: false`** — treated as *review not configured*, not as approval. | Vacuous truth over an empty ledger would let a programme with **no reviewers at all** pass Module 3's `independent-review` gate. Required-but-unconfigured is BLOCKED, exactly as required-but-unavailable is. |
| **A3** | **`independent-review` additionally requires `qa.checked > 0`.** | The consumer-side half of A2, found independently by a second worker. Kept deliberately **undeduplicated**: A2 stops a vacuous true being *produced*, A3 stops one being *believed*, and neither depends on the other being right. |
| **A4** | **Module 1 may make ONE bounded additive change to `worktree-guard.mjs`**: extract `discoverWorktreeRoots()`, which `findCanonical` then calls. AD-18/AD-19 untouched; that module's 27-test file run unmodified before and after as the control. | "Reuse `findCanonical`'s discovery" and "modify no existing file" could not both hold — the step was not exported. Re-expressing it would put one fact in two files against this estate's SSOT rule, and a drift test only *reports* divergence, it does not prevent it. |
| **A5** | **The "one programme, many copies" problem is in scope for Module 1** — dedupe by programme **id**, preferring the copy inside the worktree it names. | Omitted from this contract entirely. A `programme-state.json` is a tracked file, so it exists in every checkout holding the branch; un-deduped, every resolve on the real 22-worktree estate would have been `AMBIGUOUS`. |
| **A6** | **`PR_ACTION` gains a fifth value, `'dry-run'`**, alongside the additive `would: 'created'\|'updated'`. | The frozen enum had no honest slot for "would have, didn't", and overloading `'refused'` would make a consumer read a dry run as a failed readiness gate. The fix is a slot, not a euphemism. |
| **A7** | **`renderPrBody` projects `state.locked_decisions`** in place of the map-decisions parameter the prose required but the signature omitted. With `goalContractText: null` it says so rather than describing the build from memory. | Contract hole. |
| **A8** | **`head-pushed`'s `detail` must state that it compared a remote-*tracking* ref and did not contact the remote.** | AD-15 means nothing here fetches, so the check can read green on stale data. The check is pure and must not fix it; the string must not imply the remote was consulted. Recorded as an open bound. |
| **A9** | **`BRANCH_GONE`'s `reason` must distinguish "branch deleted" from "git would not answer".** | Same fail-closed status, different repair. The refusal text is the only thing on screen at the moment it matters. |

---

## Shared rules that bind all three modules

1. **ESM `.mjs`, Node built-ins only.** No new dependencies. Match the house style
   of `tools/governor/*.mjs`: named exports, pure functions separated from the one
   or two impure ones, dependency-injected `execFile` / `read` / `write` so tests
   need no mocking framework.
2. **Fail closed on `unknown`, per T-10's precedent.** `null`/absent is never `0`
   and never `pass`. `assessRotationSafety` in `rotate-session.mjs` is the
   reference implementation of this posture — read it before writing yours.
3. **INV-5 — no control is trusted until it has been made to fail.** Every check
   ships a mutation test proving it goes red on a broken input, and every
   evaluation returns a `checked` count that tests assert is non-zero. A control
   that reports success over ground it never examined is the exact defect this
   estate has already been burned by.
4. **Never reimplement an existing seam.** `programme-state.mjs`,
   `worktree-guard.mjs`, `worktree-recon.mjs`, `collect-state.mjs` and
   `rotate-session.mjs` are load-bearing and tested — import from them.
5. **Do not change T-11 gate semantics (AD-18 / AD-19).**
6. **Atomic writes**: temp file + rename, per-writer-unique temp name. See
   `health-store.mjs`.
7. **Paths are normalised with `normalisePath` from `worktree-guard.mjs`** —
   forward slashes, no trailing separator. Windows is the primary platform.

---

## Module 1 — `tools/governor/build-registry.mjs` (deliverable 1)

The estate's index of active builds, keyed on the build **name**.

### The safety property that defines this module

The registry is a **machine-local, generated INDEX — never a source** (AD-22).
It maps names to *where to look*, and then **every resolve re-reads the actual
`programme-state.json` from disk before returning a location**. A stale or
corrupt index can therefore only ever *fail to find*. It can never send a session
to the wrong place. If an implementation makes the index authoritative for the
location, that implementation is wrong.

Machine-local because it holds absolute machine paths, which are meaningless in
git and wrong on every other machine. Default root follows the health store's
convention: `~/.mypka/governor/registry.json`, overridden by
`MYPKA_GOVERNOR_REGISTRY`.

### Frozen exports

```js
export const REGISTRY_SCHEMA_VERSION = 1;

// Default path; honours MYPKA_GOVERNOR_REGISTRY.
export function registryPath({ env = process.env, home = os.homedir() } = {}) -> string

// Deterministic alias set for a build. Pure. Lower-cased.
// At minimum: the id ("build-018"), the id's numeric tail ("018"), and the
// home-directory slug minus the id prefix ("session-governor"), plus each
// hyphen-separated word of that slug that is >= 4 chars ("governor", "session").
// Must be deterministic and documented — a fuzzy matcher that changes its mind
// between runs is worse than no matcher.
export function aliasesFor(state) -> string[]

// Scan estate roots for Deliverables/<dir>/programme-state.json and build the
// index. Pure-ish: injectable readdir/read/exists/execFile.
// Roots are discovered from `git worktree list --porcelain` run in each probe,
// exactly as findCanonical() does — reuse that behaviour, do not fork it.
export function buildRegistry({ estateRoots = [], execFile, readdir, read, exists }) 
  -> { schema_version, generated_at, entries: RegistryEntry[], unknown: [{path, why}] }

// RegistryEntry:
// {
//   id, title, status,            // from programme.*
//   aliases: string[],
//   worktree, branch,             // from resumption.* / repository.*
//   state_path,                   // absolute, normalised
//   home,                         // programme.home (repo-relative)
//   banked_at, ticket,            // resumption.ticket = the next action's ticket
//   primary_checkout
// }

export function writeRegistry(registry, filePath) -> { ok, error }
export function readRegistry(filePath) -> { ok, registry, error }

// THE RESOLVER. `name` is whatever Warwick typed.
// MUST re-read entry.state_path from disk and derive the returned location from
// THAT document, not from the index entry.
export const RESOLVE = {
  OK: 'ok',
  NOT_FOUND: 'not-found',
  AMBIGUOUS: 'ambiguous',
  WORKTREE_MISSING: 'worktree-missing',
  STATE_UNREADABLE: 'state-unreadable',
  CONTESTED_WORKTREE: 'contested-worktree', // two builds claim one worktree
  BRANCH_GONE: 'branch-gone',               // branch merged/deleted
};
export function resolveBuild(name, { registry, execFile, exists, read })
  -> {
       status,                 // one of RESOLVE
       entry,                  // the matched entry, or null
       candidates: [],         // populated on AMBIGUOUS / CONTESTED_WORKTREE
       location,               // { worktree, branch, statePath, ticket } | null — DERIVED FROM THE RE-READ STATE
       reason,                 // human sentence, always present when status !== OK
       checked,                // number of entries actually examined (INV-5)
     }

// Warwick-facing render. Includes, verbatim when a move is needed, the AD-21
// EnterWorktree recovery protocol line:
//   "Approve the pending EnterWorktree request in the local Claude terminal"
// and NEVER instructs Warwick to run a git command (AD-20).
export function renderLaunch(resolution, { liveCwd = null } = {}) -> string
```

### Required failure modes (each needs a test)

| Case | Expected |
|---|---|
| name matches nothing | `NOT_FOUND`, reason names what *was* indexed |
| name matches two builds | `AMBIGUOUS`, both in `candidates`, refuses to pick |
| entry's worktree directory is gone | `WORKTREE_MISSING`, never a location |
| entry's state file unreadable/corrupt | `STATE_UNREADABLE`, never a location |
| two active builds name the same worktree | `CONTESTED_WORKTREE`, refuses |
| branch no longer exists in the repo | `BRANCH_GONE` |
| index is stale (state file moved) | resolves by re-read, or fails — never a wrong location |

### Mutation test (mandatory)

Point a registry entry at a location, then **change the on-disk
`programme-state.json` to name a different worktree**. Assert `resolveBuild`
returns the *new* location, proving the index is not authoritative. Then delete
the state file and assert `STATE_UNREADABLE`, not a stale success.

### Also ships

`.claude/commands/build.md` — frontmatter exactly `name` / `description` /
`user_invocable: true`, matching `.claude/commands/rotate-session.md`. The command
is Larry-operated: it resolves the name, and if a move is required Larry performs
it with `EnterWorktree` under AD-21. It must never ask Warwick to run git.

---

## Module 2 — `tools/governor/qa-binding.mjs` (deliverable 3)

Exact-head QA binding. A review verdict is only meaningful against the exact
commit it reviewed.

### The safety property that defines this module

**A verdict is `current` only at the exact canonical head. Any head movement
marks it SUPERSEDED. An unknown head is never "the reviewed head."** The SHA is
canonicalised **once at the boundary** (ingest) and durable state is keyed on the
full canonical tuple — never re-derived at each call site, and never compared as
a raw abbreviated string. (AD-23; this is the direct lesson of the Tower
head-binding defect.)

The ledger is a durable **source** artefact (not a projection): it lives with the
programme at `<programme.home>/qa-verdicts.json`, on the programme's branch, and
is git-versioned.

### Frozen exports

```js
export const QA_SCHEMA_VERSION = 1;
export const VERDICT = { APPROVE: 'approve', REJECT: 'reject', CHANGES: 'changes-requested' };
export const BINDING = {
  CURRENT: 'current',           // recorded at exactly this head
  SUPERSEDED: 'superseded',     // recorded, but at a different head
  ABSENT: 'absent',             // this reviewer has no verdict at all
  UNKNOWN_HEAD: 'unknown-head', // the head could not be established — fails closed
};

export function qaLedgerPath(programmeHome) -> string   // <home>/qa-verdicts.json

// THE BOUNDARY. Resolves a possibly-abbreviated sha to a full 40-hex commit sha
// via `git -C <repoPath> rev-parse --verify <sha>^{commit}`. Refuses anything it
// cannot resolve. repo/branch normalised here and nowhere else.
export function canonicaliseTuple({ repo, branch, sha, repoPath, execFile })
  -> { ok, tuple: { repo, branch, sha } | null, error }

export function readLedger(filePath) -> { ok, ledger, error }   // missing file => ok with an empty ledger
export function writeLedger(ledger, filePath) -> { ok, error }  // atomic

// Appends. Refuses an entry whose tuple did not canonicalise (fails closed).
// Re-recording the same (reviewer, tuple) REPLACES that entry rather than
// duplicating it — idempotent.
export function recordVerdict(ledger, entry) -> { ok, ledger, error }
//   entry = { tuple, reviewer, verdict, summary, evidence: string[], at }

// THE QUERY. requiredReviewers is a list of names that MUST each hold a CURRENT
// approve for `allCurrentApproved` to be true. A required reviewer who is absent
// or superseded => not approved. Required-but-unavailable is BLOCKED, not waived.
export function verdictStatus(ledger, { repo, branch, headSha, requiredReviewers = [] })
  -> {
       headKnown: boolean,
       head: string | null,          // canonical head as given
       reviewers: [{ reviewer, binding, verdict, sha, at, detail }],
       allCurrentApproved: boolean,
       superseded: [...],            // convenience list
       checked: number,              // verdicts actually examined (INV-5)
     }

export function renderVerdictSummary(status) -> string
```

### Mutation tests (mandatory — both named in 02-MAP.md §9)

1. Record an approve at SHA `A`; move the head to `B`; assert the verdict does
   **not** carry forward — `binding === SUPERSEDED` and
   `allCurrentApproved === false`. Use **real git** (a temp repo with two real
   commits), not synthetic strings.
2. Pass `headSha: null` (or an unresolvable sha) and assert every reviewer reads
   `UNKNOWN_HEAD`, `allCurrentApproved === false`, and `headKnown === false`.
   Assert `checked > 0` in the positive case so an empty scan cannot pass as a
   clean bill.
3. Positive control: record an approve at `A` and query at `A` → `CURRENT`,
   `allCurrentApproved === true`. Without this, test 1 could pass because the
   function always returns false.

---

## Module 3 — `tools/governor/programme-pr.mjs` + `merge-readiness.mjs` (deliverables 2 & 4)

### The safety property that defines these modules

**Creating or updating a PR and merging it are different authorities (AD-25).**
This code can never merge. That is proven by an **argv-shape control** — assert
the built argument vectors never contain a merging subcommand — and *not* by a
source-text substring ban. T-10 already learned that lesson: a test that bans the
string also bans the sentence proving the invariant held.

**Merge readiness fails closed (AD-24).** Any check that is `unknown` makes the
programme not ready. "Suite green" specifically requires an **executed** run with
a **non-zero test count** — "no failures found" over zero tests is the classic
green-that-never-ran.

### `merge-readiness.mjs` — frozen exports

```js
export const CHECK = { PASS: 'pass', FAIL: 'fail', UNKNOWN: 'unknown' };

export const CHECK_IDS = [
  'tickets-resolved-with-evidence',
  'suite-green',
  'tree-clean',
  'head-pushed',
  'independent-review',
];

// PURE. No filesystem, no git, no gh — signals in, verdict out (AD-11 posture).
export function assessMergeReadiness({ state, git, suite, qa })
  -> { ready: boolean, checks: [{ id, title, status, detail }], checked: number, blocking: [...] }
//   state = a validated programme-state document
//   git   = { clean: boolean|null, headSha: string|null, remoteHeadSha: string|null }
//   suite = { executed: boolean, total: number|null, failed: number|null } | null
//   qa    = the object returned by verdictStatus(), or null

export function renderReadiness(readiness) -> string
```

**The five checks, exactly — do not invent a sixth.**

| id | passes when |
|---|---|
| `tickets-resolved-with-evidence` | every ticket in scope has `state === 'resolved'` **and** a non-empty `evidence`. A resolved ticket with empty evidence is a `FAIL`, not a pass. |
| `suite-green` | `suite.executed === true` **and** `suite.total > 0` **and** `suite.failed === 0`. `null` suite → `UNKNOWN`. `total === 0` → `FAIL` (a suite that ran nothing is not green). |
| `tree-clean` | `git.clean === true`. `null` → `UNKNOWN`. |
| `head-pushed` | `git.headSha` and `git.remoteHeadSha` both known and equal. Either `null` → `UNKNOWN`. |
| `independent-review` | `qa.allCurrentApproved === true` and `qa.headKnown === true`. `null` qa → `UNKNOWN`. |

`ready === true` only when **all five are `PASS`**. Any `UNKNOWN` or `FAIL` →
`ready === false`, and the offending checks appear in `blocking`.

### `programme-pr.mjs` — frozen exports

```js
export const PR_MARKER = (buildId) => `<!-- governor:programme-pr ${buildId} -->`;

// A PROJECTION, not a fresh composition (document-mirroring rule): assembled from
// the goal contract, the map's settled decisions, and resolved-ticket evidence
// that already exist. Do not compose new prose describing the build.
export function renderPrBody({ state, readiness, qa, goalContractText = null }) -> string

// PURE argv builder. This is the control surface: it must be impossible for any
// return value to be a merging invocation.
export function buildGhArgs(action, opts) -> string[]
//   action ∈ 'list' | 'create' | 'edit'   — and nothing else. Any other action throws.

// The one impure entrypoint. Idempotent: finds an existing PR for the branch and
// EDITS it; only creates when none exists. Never opens a second. NEVER merges.
export function upsertProgrammePr({ state, readiness, qa, ghRepo, execFile, dryRun = false })
  -> { action: 'created'|'updated'|'refused'|'blind', number, url, reason, checked }
//   Refuses (action:'refused') unless readiness.ready === true, naming the blocking checks.
//   `gh` missing or failing => 'blind', never a silent no-op that reads as success.

// Deliverable 4 — the ONLY thing Warwick sees.
export function renderMergeDecision({ state, readiness, qa, pr }) -> string
//   One decision: merge this, or not. Carries the evidence, names the risks, and
//   states plainly that everything else (branches, worktrees, commits, pushes, PR
//   creation, re-review) was Larry's and is already done (AD-20).
```

### Mutation tests (mandatory)

1. **Never merges**: enumerate every `action` `buildGhArgs` accepts, assert no
   returned argv contains `merge`; assert an unknown action throws. Additionally
   assert that every `execFile` invocation made by `upsertProgrammePr` (captured
   through the injected `execFile`) uses `gh` with a first argument in the
   allowed set. Argv shape, not source text.
2. **Fails closed**: for each of the five checks in turn, set exactly that
   signal to `null` and assert `ready === false` with that check `UNKNOWN`. Then
   set all five to passing and assert `ready === true` — without that positive
   control the five negatives prove nothing.
3. **Zero-test suite is not green**: `{ executed: true, total: 0, failed: 0 }`
   must `FAIL` `suite-green`.
4. **Idempotent**: with an existing PR in the injected `gh` output, assert the
   action is `updated` and that no `create` invocation was made.
5. **Resolved-without-evidence fails**: a ticket `resolved` with `evidence: []`
   must make `tickets-resolved-with-evidence` `FAIL`.

---

## Integration (Larry, after the three land)

Larry runs the full suite (`node --test "tools/governor/*.test.mjs"` — the glob
form; the bare directory form fails), reconciles, writes back to `02-MAP.md`
§10, records AD-22..AD-25 in §3, updates the ticket, and commits. **No worker
commits, pushes, or touches git state** (AD-20, and three agents sharing one
worktree must not race on the index).
