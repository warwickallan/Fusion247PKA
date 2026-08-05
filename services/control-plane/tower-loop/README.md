# tower-loop — the durable turn loop, the watcher, and the PR-comment seam

The `tower.*` subsystem. A governed turn (`tower.turn`) carries Warwick's instruction and Larry's
response; the persistent watcher claims it, stages a reviewer packet reconstructed **purely from the
database**, records the review, and fires notifications.

> **This is one of THREE separate schemas in this repo and they share no tables and no code.**
> `services/fusion-tower/` is `ftw.*`; `services/control-plane/{review,ingress,worker,db}/` is
> `ops.*`; this directory is `tower.*`. If you arrived here from a `finding` or `disposition` in the
> other two, you are in the wrong subsystem.

## The PR-comment seam (WO-OR-22)

**A response written in a PR comment becomes machine-readable input to the next review round.**

Before this, a reply about a review lived only in the PR — invisible to the loop — and an open
finding could ride silently from one round to the next with no answer attached to it. Now:

1. `ingestComment.mjs` takes a GitHub PR-comment payload, preserves the **body verbatim**, binds it
   to the exact `(repo, pr_number, head_sha, comment_id, author, received_at)`, and stores it in
   `tower.pr_comment`.
2. The finding dispositions written in that comment land on `tower.finding`, carrying **where they
   came from** (`disposition_source='pr_comment'` plus the comment row id) and **which head they were
   judged at**.
3. The next review round reads them straight out of the database (`findings.mjs` → `watcher.mjs`) and
   stages them to the reviewer. Nothing is hand-carried.
4. If a prior open finding has **no disposition**, or its disposition was judged at a **different
   head**, the round is **REJECTED before any reviewer is invoked**.

### The comment grammar

Ordinary PR-comment prose, with directives anywhere in the body:

```
Looks good overall — two things from the last round.

@tower head: a1b2c3d4e5f60718293a4b5c6d7e8f9012345678
@tower finding aaaaaaaa-0000-4000-8000-000000000001: addressed — the leak is fixed; pool.end() is in a finally block.
@tower finding bbbbbbbb-0000-4000-8000-000000000002: remains_open — cap the retry budget before this lands.
```

- `@tower head:` is **mandatory** and must be a canonical **lower-case 40-hex** SHA. A comment that
  does not state the head it was written against is refused: binding it to a head its author never
  saw is the exact defect this seam exists to prevent. (A GitHub `issue_comment` webhook payload does
  not carry the PR head SHA, which is why the head comes from the body rather than the envelope.)
- Dispositions are exactly three: `addressed` · `remains_open` · `unrelated`. These are the
  estate's existing prior-finding vocabulary (`review/reviewClassification.mjs:20`). **They are NOT
  the `ops.required_disposition` merge-authority values** — a different axis in a different schema
  that must not be imported here.
- A rationale after `—` (or `-` or `:`) is required. A directive missing one is reported as malformed
  and the whole comment is refused, rather than becoming a disposition with no reason.

## Running the proof

Nothing below touches a live service, a real GitHub PR, Codex, or Telegram. Every external party is a
local double. It needs `node_modules` installed under `services/control-plane/` — and **no database
server**.

### 1. Point at a throwaway store

Since WO-TW-01 the store is a single WAL SQLite file at `TOWER_SQLITE_PATH`, defaulting to
`~/.mypka/tower/tower.db`. There is no cluster to start and no connection string to export. Put a
throwaway one **outside the repo** — a store inside a git worktree is one `git clean` away from
destroying itself, and the default path is the REAL watcher's durable state, which a rehearsal must
never trample.

```bash
export TOWER_SQLITE_PATH="$(mktemp -d)/tower.db"
```

Tear down by deleting the directory.

### 2. Apply the schema

```bash
cd services/control-plane/tower-loop
node apply.mjs      # base + watcher + hold + comment + verdict-post deltas, all idempotent
node seed.mjs       # the active supervisor prompt (required before any round)
```

Re-running is always safe — every statement is `if not exists` or guarded.

### 3. Create a round and open a finding

```sql
insert into tower.turn (id, build_ref, instruction, larry_response, state, kind, repo, pr_number, head_sha)
values ('11111111-0000-4000-8000-000000000001','BUILD-014',
        'Warwick: review the connection handling.','Larry: first pass pushed.',
        'complete','ordinary','warwickallan/Fusion247PKA',87,
        'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678');

insert into tower.finding (id, build_ref, opened_turn_id, description)
values ('aaaaaaaa-0000-4000-8000-000000000001','BUILD-014','11111111-0000-4000-8000-000000000001',
        'pool.end() is not in a finally block — connection leak on throw');
```

### 4. Ingest a comment

```bash
node ingestComment.mjs --payload test/fixtures/pr-comment-dispositions.json --json
```

The committed fixtures carry `__HEAD_SHA__` / `__FINDING_A__` / `__FINDING_B__` placeholders, because
finding ids are database-generated uuids — substitute your own before running.

**Exit codes:** `0` applied · `2` rejected (stale — persisted, nothing applied) · `1` refused
(unbindable: no head directive, malformed directive, missing payload field, no matching turn).

### 5. Run the next round

Start the watcher in another terminal. It claims any `pending` turn and processes it:

```bash
TOWER_SQLITE_PATH=... \
TOWER_REVIEWER_MODULE=$PWD/test/doubles/fakeReviewer.mjs \
TOWER_GIT_EVIDENCE_MODULE=$PWD/test/doubles/fakeGitEvidence.mjs \
TOWER_NOTIFY_TRANSPORT=none \
TOWER_PR_POLL=off \
node watcher.mjs
```

The two `*_MODULE` doubles replace Codex and git evidence with canned, offline stand-ins;
`TOWER_NOTIFY_TRANSPORT=none` replaces Telegram. **Drop all three and it calls the real ones** —
which is a live action, and not something this runbook authorises. `TOWER_PR_POLL=off` AND
`TOWER_PR_WRITEBACK=off` stop the watcher reaching for the real `gh` during a rehearsal — you need
BOTH, for the reason set out under "When the write fails" below.

Then read the exact text that reached the reviewer:

```sql
select staged_input from tower.supervisor_review where turn_id = '<turn>';
```

## The first hop — a real GitHub comment, no hand-built payload (WO-OR-24)

Step 4 above ingests a **file**. That was the honest state of things after WO-OR-22 and it was also
the gap: everything from an `issue_comment`-shaped payload onward was proven, and nothing delivered
one. `pollPrComments.mjs` is the missing step and nothing more.

```bash
TOWER_SQLITE_PATH=... \
node pollPrComments.mjs --repo warwickallan/Fusion247PKA --pr 87 [--marker <substring>] [--json]
```

> Since WO-TW-02 you do **not** have to run this by hand — the watcher runs it for you. The CLI
> remains for one-shot diagnosis. See "The automatic trigger" below.

It asks GitHub two questions through `gh api` and hands the answer to `ingestPrComment` unaltered:

| Call | Why |
|---|---|
| `repos/<repo>/pulls/<n> --jq .head.sha` | the PR's **real** head — never a SHA someone typed |
| `repos/<repo>/issues/<n>/comments --paginate` | every comment; those carrying `@tower` are candidates |

`--marker` narrows to comments containing a given substring. Comments with no `@tower` directive are
ignored entirely.

**Exit codes:** `0` every candidate applied or already-ingested · `2` at least one refused or
rejected · `1` the poll itself could not run (bad repo/PR, API failure, unreadable store).

### It is a POLLER, not a webhook — and that distinction is the point

A webhook needs a public listener and inbound ingress; that is a new service and it was not wanted.
**Nothing here evidences push-delivery.** What it evidences is narrower: bytes that provably
originated on github.com reach the ingest path with no human constructing a payload. Cite it that way.

### Two head checks, and they are not the same check

```
layer 1  pollPrComments.mjs   body `@tower head:`  vs  the PR's real head from the API
layer 2  ingestComment.mjs    body `@tower head:`  vs  the turn's current head   ← the stale check
```

`ingestComment.mjs` binds a comment to the head named in its **body**, deliberately — that records
the head the author actually reviewed, and an envelope-supplied head could bind a comment to a head
its author never saw. **That design is not reopened here.** Layer 1 exists because a typed SHA is not
on its own evidence of anything: it validates the author's declaration against GitHub, so the typed
value never becomes authority while still being what gets recorded.

- Layer 1 catches a comment that **misdescribes the PR** → `refused_head_mismatch`, nothing persisted.
- Layer 2 catches a comment that is **honest about a head the work has moved past** → `rejected_stale`,
  persisted as `applied=false` with a reason, nothing applied.

Both fail closed. If the API head cannot be established the poll **aborts** — it never falls back to
the body head, and it does not even fetch the comments.

### Read-only, structurally

`gh` holds its own credential in the OS keyring; this module never reads, prints, passes or stores a
token, and has no code path that writes to GitHub. The argv is built internally from `repo` and
`prNumber`, and `assertReadOnlyArgs` refuses any invocation carrying `-X`, `--method`, `-f`, `-F`,
`--field`, `--raw-field` or `--input`. Two independent reasons the same defect cannot happen.

### Re-running is safe

The poller re-sees every comment on every run. Re-ingest is a no-op via `(source, comment_id)` on
`tower.pr_comment` — WO-OR-22's constraint doing the work. **The poller keeps no memory of what it has
already seen**, on purpose: that would be a second source of truth waiting to disagree with the first.

### Recovering it

There is no state to corrupt. As a one-shot command: read the exit code above, fix the cause, and run
it again — a repeat run cannot double-apply. Inside the watcher, a failed poll round is logged and
retried on the next interval, and a persistent failure raises an alarm (below). If `gh` is not
authenticated (`gh auth status`), that is a Mack task, not a code change.

## The automatic trigger (WO-TW-02)

**The gap this closes was stated in this file's own words: *"Something must still invoke the
poller."*** Everything above was real and proven, and none of it ever ran unless a human typed it.

The watcher's loop now has one more step. That is the whole feature — no scheduler, no second
process, no new table.

```
poll PR comments  →  reclaim stale leases  →  claim ONE pending turn  →  process  →  heartbeat  →  sleep
└── every TOWER_PR_POLL_MS (default 60s), not every 1.5s: GitHub is not asked at loop speed
```

### A checkpoint comment opens its own review round

`ingestPrComment` resolves the turn a comment answers and **throws** when there is none. So an
automatic poll on its own would have refused every real comment unless somebody had already created
the turn by hand — which is exactly the manual prerequisite that made the journey not unattended.

A comment carrying an **explicit `@tower checkpoint:` marker** now creates its turn, in the poll
step, before ingest:

```
Shipped WP-3. Tests green, CI clean.

@tower checkpoint: BUILD-019
@tower head: c1d2e3f405162738495a6b7c8d9e0f1122334455
```

- **Only the explicit marker does this.** A stray PR comment can never conjure a review round: with
  no marker there is no turn, and the pre-existing refusal stands untouched.
- **The head is still the API's.** The turn is created at the head `repos/<repo>/pulls/<n>` reports,
  and the comment only got this far because layer 1 already validated its body directive against it.
  A typed SHA remains a declaration, never authority.
- **Idempotence belongs to the database, not to this code.** The turn carries a deterministic
  `session_turn_key` of `pr-checkpoint:<repo>#<pr>@<comment_id>`, and the partial unique index
  `tower.turn_session_turn_key_uniq` is what refuses the second insert. Re-polling — or restarting
  mid-round — cannot duplicate a round, because no application state carries the guarantee.
- **Editing the comment re-binds to the same round** (GitHub keeps the comment id). Posting a *new*
  checkpoint comment is how you ask for a new round.
- The build ref comes from the marker. Omit it and the turn falls back to `TOWER_BUILD_REF` or
  `UNCLASSIFIED` — it is never guessed from prose.

### Which PRs get polled

**Every OPEN pull request, asked of GitHub every round.** Not derived from Tower's own work state,
and not configured anywhere.

```
repos/<owner>/<name>/pulls?state=open&per_page=100   --paginate --jq .[].number
```

#### What this replaced, and why it kept dying (WO-2026-08-03-05)

Targets used to be the distinct `(repo, pr_number)` of turns `where state <> 'complete'`. Read that
back slowly: **a round that finished removed its own PR from the poll list.** Success and blindness
were the same event — the better the loop worked, the more certainly it went quiet — and a PR nobody
had opened a turn against was invisible from the start. The only thing that ever *added* a PR was a
human supplying `TOWER_PR_SEED` at launch: a value living solely in `process.env`, refreshed by
nothing, lost the moment the process was replaced.

Measured on 2026-08-03: a healthy watcher with an advancing heartbeat had polled **PR #90 — merged
at 2026-08-02T23:30:33Z — 140 rounds in a row**, returning `checkpointsCreated: 0` every time, while
#91, #81 and #80 sat open and unpolled.

The cut now is:

| Question | Whose fact it is | Where it comes from |
|---|---|---|
| Is this PR open? | GitHub's | asked every round |
| Does this PR have a live round? | ours | `state <> 'complete'`, used **only to rank** under the cap |

#### Where the repository comes from — three sources, all durable

1. **this checkout's `origin` remote** — on disk, re-read every round, unaffected by restart;
2. **every repo any turn in the store names** — no state filter, deliberately: filtering here would
   reintroduce the self-extinguishing bug one level up;
3. `TOWER_PR_SEED` — retained as an escape hatch for a repository that is neither of the above.

**`TOWER_PR_SEED` is no longer load-bearing and its PR number no longer has any power.** A seed entry
contributes only its `owner/name`; the PR it names is polled if and only if GitHub says it is open.
A stale seed can no longer pin the watcher to a merged PR. The grammar is unchanged, so nothing an
operator has already set needs editing.

If **no** repository can be determined from any source, the round logs `pr_poll_no_repos` — a
deliberately distinct event from `pr_poll_no_targets`, because "there is nothing open to watch" and
"I do not know where to look" must not share a line.

#### The cap, and why truncation is loud

At most **5** PRs per round (`PR_POLL_MAX_TARGETS`, a literal, not config). PRs with a live round
rank first, then the rest newest-first, so a round waiting on a disposition comment is never the one
dropped. Truncation logs `pr_poll_targets_truncated` naming what it dropped — a PR that is silently
never polled is invisible for exactly the same reason a merged target was. Cost at the cap: one
discovery call plus two per PR per round, ≈660 requests/hour against GitHub's 5,000.

### When it fails

A poll failure never takes the turn loop down — GitHub being briefly unreachable is not a reason to
stop supervising turns already in the store. It is logged as `pr_poll_failed`, and after **3
consecutive rounds in which every target failed** a `tower_failure` TowerBot message fires naming
the cause.

**A DISCOVERY failure throws rather than returning an empty list, and that is load-bearing.** An
empty target list is exactly what a healthy idle watcher produces, so discovery that failed quietly
would be indistinguishable from a repository with nothing open. The throw is converted by
`runWatcher` into a failed round, which feeds the same 3-strike alarm. It fires **once per failure streak**: not every round (spam gets ignored) and not never
(silence from this watcher is indistinguishable from "nothing to review").

### The build ref is validated, and a bad one is visible

`classifyBuildRef` enforces `/^BUILD-\d{3}$/` and never guesses. A marker of `@tower checkpoint:
BUILD-TYPO` therefore opens the round as **`UNCLASSIFIED`** — which is correct fail-safe behaviour
and also a trap, because that round's findings then carry forward against a build nobody is
watching. `ensureCheckpointTurn` returns `buildRefRequested` and `buildRefHonoured` so the mismatch
is reported rather than silent. **Check the poll log if a checkpoint lands on the wrong build.**

## The verdict goes back ONTO the PR (WO-TW-02)

`postVerdict.mjs`. After a round is reviewed, the verdict is posted as a PR comment on the same
`(repo, pr_number)` the turn is bound to — so someone reading the pull request sees the review,
not a checkpoint followed by silence.

### It is a SEPARATE module with a SEPARATE seam, and that is the design

`pollPrComments.mjs` is read-only *structurally*: `assertReadOnlyArgs` throws on `-X`, `--method`,
`-f`, `-F`, `--field`, `--raw-field` and `--input`. **That guard is not relaxed, bypassed or made
conditional to add writing.** The poller reads; `postVerdict.mjs` writes; they share no seam.

The two guards are deliberate mirrors:

| Module | Guard | Shape |
|---|---|---|
| `pollPrComments.mjs` | `assertReadOnlyArgs` | **denylist** — forbids a category of mutation |
| `postVerdict.mjs` | `assertCommentPostArgs` | **allowlist** — permits exactly `--method POST repos/<o>/<n>/issues/<pr>/comments -f body=…` and nothing else, not even one extra argument |

A writer is the wrong place for a denylist: it would only forbid the mutations somebody thought of.

### Not posting twice

`tower.pr_verdict_post.post_key` is `pr-verdict:review:<review_id>` and **UNIQUE**. The claim row is
INSERTed *before* GitHub is called, and only a caller that wins that insert may post — the same
claim-then-send shape `notify()` uses for Telegram. A restart mid-sweep cannot double-post, because
the guarantee is not held in the process.

**The one window a key alone cannot close** is a crash after GitHub accepted the comment but before
`posted = 1` was written. Every body therefore ends with an invisible
`<!-- tower-verdict-key: … -->` marker, and a RETRY (`attempts > 0`) reads the PR's comments looking
for it before posting again. That is the only reason the writer is handed a reader.

### When the write fails

Fail-closed: the row keeps `posted = 0` with `last_error` set, so **nothing anywhere records the
round as answered on the PR**, and the sweep retries it on the next poll interval. After **3
consecutive failed sweeps** a `tower_failure` TowerBot message fires — once per streak — saying
reviews are not reaching the pull request.

`TOWER_PR_WRITEBACK=off` disables posting entirely (rehearsals, a second watcher, CI).

> ⚠️ **A rehearsal must set BOTH `TOWER_PR_POLL=off` AND `TOWER_PR_WRITEBACK=off`.** The verdict
> sweep is global by design — it has to be, or a failed post would never be retried — so disabling
> only the poll still lets a watcher post the verdict of any turn in its store that carries a
> repo and PR number. This was found the hard way: the test suite's own watchers reached the real
> `gh` and attempted a real POST against a PR that did not exist.

## What a rejection looks like

A rejected round ends `tower.turn.state = 'blocked'` with a `tower.supervisor_review` row whose
`reviewer` is **`tower_findings_gate`** (not `gpt_codex`) — that is how you tell a gate rejection from
a reviewer verdict. The watcher logs `review_round_rejected` with `required` / `disposed` / `errors`
counts, and **no reviewer is invoked**, so a round that cannot be trusted spends nothing.

**Undisposed finding:**

```
Review round REJECTED — 1 finding-disposition problem(s): prior open finding
aaaaaaaa-0000-4000-8000-000000000001 has no disposition (no silent carry-over, fail-closed) —
"pool.end() is not in a finally block — connection leak on throw"
```

**Disposition from an older head** (the PR moved on after the comment was written):

```
Review round REJECTED — 1 finding-disposition problem(s): prior open finding
aaaaaaaa-0000-4000-8000-000000000001 was disposed at head a1b2c3d4e5f6 but this round is at head
b2c3d4e5f607 — a disposition from an older head is STALE and is not carried forward
(re-answer it at the current head)
```

**Stale comment at ingest** — `ingestComment.mjs` exits `2`, and the comment is still **persisted**
with `applied = false` and a `rejected_reason`. That is deliberate: a silently dropped comment is
indistinguishable from one that never arrived.

To clear a rejection, post a new comment at the **current** head disposing every open finding, ingest
it, and re-run the round.

## RUNBOOK — operating the watcher

Everything here is Mack's, and none of it requires reading the source.

### Start

```bash
node --env-file=<your TowerBot env file> services/control-plane/tower-loop/run-watcher.mjs
```

It stops any watcher already running, starts a new detached one, and prints the pid, the store path,
the log path and whether notifications and the PR poll are on.

**The launcher reads no secret file of its own.** It validates that `TELEGRAM_BOT_TOKEN` and
`AUTHORISED_TELEGRAM_USER_ID` are present **in its own environment** and refuses to start otherwise,
naming the missing variable. Supplying them is an operations task; the code never sees where they
live. To start deliberately without TowerBot, set `TOWER_NOTIFY_TRANSPORT=none`.

> This is a behaviour change (WO-TW-02). Launching with a bare environment now **fails** where it
> used to silently work by loading files under `C:\.fusion247\`. A launcher that silently works on
> wrong configuration is how an estate ends up believing a control is live when it is inert.

### Stop

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*tower-loop*watcher.mjs*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

The watcher also handles `SIGINT`/`SIGTERM`: it finishes the turn in flight, logs
`watcher_down_clean` and exits.

### Restart

Just run the start command again — it is single-instance by construction. **A restart is safe by
design and needs no cleanup:** an in-flight turn's lease expires and is reclaimed
(`reclaimed_stale`), a turn that already has a review is never re-reviewed, and a checkpoint comment
re-seen after restart re-finds its existing round rather than opening a second one.

### Where state lives

| What | Where |
|---|---|
| Durable store (all `tower.*` tables, incl. `pr_verdict_post`) | `~/.mypka/tower/tower.db` — override with `TOWER_SQLITE_PATH` |
| Log | `~/.mypka/tower/logs/watcher.log` |

**Never point either at a worktree, a temp directory or a scratchpad.** A daemon pinned to
disposable storage loses its durable state silently.

### How to tell it is alive

```bash
# 0. verdicts that have not reached the PR (should normally be empty)
sqlite3 ~/.mypka/tower/tower.db "select post_key, repo, pr_number, attempts, last_error from tower.pr_verdict_post where posted = 0;"

# 1. the process
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*tower-loop*watcher.mjs*' } | Select-Object ProcessId"

# 2. its own heartbeat — the authoritative answer, written by the loop itself
sqlite3 ~/.mypka/tower/tower.db "select watcher_id, last_beat, state from tower.watcher_heartbeat order by last_beat desc;"

# 3. the log tail
tail -n 40 ~/.mypka/tower/logs/watcher.log
```

A healthy watcher writes a heartbeat every loop (~3s as launched) and logs `pr_poll_ok` or
`pr_poll_no_targets` every `TOWER_PR_POLL_MS`. **A heartbeat older than a minute means it is not
running, whatever the process list says** — trust the heartbeat over the pid.

### What a failure looks like

| Log event | Meaning | Action |
|---|---|---|
| `watcher_crash` | the loop threw; a `tower_failure` TowerBot message is sent, then it exits `1` | read the log, fix, restart |
| `pr_poll_failed` | one target failed this round (usually `gh`) | none if isolated; it retries |
| `pr_poll_round_failed` | every target failed this round | watch the `consecutive` count |
| **`pr_poll_alarm_fired`** | **3 consecutive failed rounds — TowerBot has been told Tower is no longer seeing PR checkpoints** | check `gh auth status` and network |
| `pr_poll_alarm_failed` | the alarm itself could not be delivered | **investigate immediately** — the loud path is deaf |
| `pr_verdict_queued` | a completed round's verdict is claimed for posting | none |
| `pr_verdict_posted` | the verdict is now a comment on the PR | none |
| `pr_post_failed` | a verdict could not be posted; it stays `posted=0` and is retried | watch the `consecutive` count |
| **`pr_post_alarm_fired`** | **3 consecutive failed sweeps — reviews are NOT reaching the PR** | check `gh auth status` and that the token still has write scope |
| `pr_post_alarm_failed` | the write-back alarm could not be delivered | **investigate immediately** |
| `reclaim_busy` / `claim_busy` | write contention, self-correcting | none unless persistent |
| `store_open` | normal boot; shows the store path actually opened | confirm it is the intended one |

**Silence is not health.** No log lines at all means the process is gone, not that nothing is
happening.

## Tests

```bash
node test/run-tower-loop-tests.mjs      # no database server, no network, no gh binary
```

Fails loudly on **zero executed subtests** — a run that skips everything is never a pass.
`W1`–`W8` cover the comment seam; `P1`–`P6` cover the GitHub → Tower first hop; `T0`–`T7` are the
pre-existing watcher acceptance tests; `A1`–`A16` plus `A-unit` cover the WO-TW-02 automatic
trigger, the verdict write-back and the chained disposition journey. **41 subtests.**

`P1`–`P6` and `A1`–`A9` drive the `gh` boundary through an **injected seam**
(`test/doubles/fakeGh.mjs`, and `test/doubles/fakeGhModule.mjs` for a spawned watcher), so the suite
needs no network and no `gh` binary. The double refuses any endpoint it does not model — a permissive
double would answer an argv the real seam rejects, and then the suite proves something about the
double rather than about the code.

> ⚠️ **NOTHING UNDER `test/` HAS A MAIN GUARD — IMPORTING ANY OF IT RUNS IT.** `prove-hold.mjs`
> connects to a live database on import. `classifyBuild.test.mjs`, `notify.test.mjs` and
> `reviewTooling.test.mjs` register `node:test` cases at import. `run-tower-loop-tests.mjs` is a
> script. Spawn them; never import them. (`run-watcher.mjs` used to share this shape and had the
> worst version of it — it is now guarded, and A10 proves it.)
## Known limits

- **A POLLER IS STILL NOT A WEBHOOK.** WO-TW-02 closed *"something must still invoke the poller"* —
  the watcher now invokes it, unprompted, forever. It did **not** make delivery a push. There is no
  live listener and no inbound ingress; **GitHub cannot reach this code**, and detection is bounded
  by `TOWER_PR_POLL_MS`. Cite it as "polled automatically", never as "webhook".
- ~~**THE RESPONSE DOES NOT GO BACK ONTO THE PR.**~~ **SUPERSEDED and it was stale in place** —
  corrected 2026-08-03. `postVerdict.mjs` writes the verdict onto the PR and has since WO-TW-02; the
  entry above it described the state before that landed and was never updated. What remains true is
  narrower and is the part worth keeping: **the POLLER still never writes** (`assertReadOnlyArgs`
  forbids it structurally), and the write lives in a separate module behind a separate allowlist
  seam. See "The verdict goes back ONTO the PR".
- ~~**The store-derived poll cannot bootstrap itself.**~~ **SUPERSEDED** by WO-2026-08-03-05:
  targets are now every OPEN PR asked of GitHub, so there is no bootstrap hole and no first-
  checkpoint blind spot. The residual limit is different and smaller: **if no repository can be
  determined from the checkout's `origin`, the store, or `TOWER_PR_SEED`, nothing is polled.** That
  round logs `pr_poll_no_repos` rather than looking idle, but it raises no alarm.
- **A checkpoint marker on a PR whose head has moved is refused, not queued.** Layer 1 compares the
  body head to the API head; if the PR advanced between writing and polling, the comment is
  `refused_head_mismatch` and **no round opens**. Re-post at the current head.
- **Layer 1 rejects before layer 2 can fire.** Because the poller refuses a comment whose body head
  disagrees with the API head, a genuinely stale comment written against an *older* head is stopped
  at layer 1 (`refused_head_mismatch`, nothing persisted) rather than reaching
  `ingestComment.mjs`'s stale branch, which would have persisted it as `applied=false` with a
  reason. Both fail closed and neither applies anything, but **the audit trail differs**: layer 1
  leaves no `tower.pr_comment` row. Reachable via `ingestComment.mjs --payload` directly, and that
  is the path `W3` exercises.
- **The ingest entrypoint still accepts a file** (`ingestComment.mjs --payload`). The poller does not
  replace it and does not disable it; a hand-built payload remains possible by design.
- **The head guarantee is one-sided.** `tower.pr_comment.head_sha` and
  `tower.finding.disposition_head_sha` use the `tower.git_sha` domain (canonical lower-case 40-hex,
  enforced by the database). **`tower.turn.head_sha` is plain `text` and is not constrained** — the
  existing acceptance tests deliberately seed non-canonical heads (`'aaaa1111bbbb2222'`,
  `'UNRESOLVABLE'`) to exercise the fail-closed evidence path. Staleness comparison is exact, but the
  turn side can hold a value the comment side never could. Pre-existing; out of scope for WO-OR-22.
- **A turn with no `head_sha` skips the staleness comparison** — only the presence rule applies. An
  ordinary non-PR delivery turn has no head for a disposition to be stale against.
- **A finding opened by the turn currently under review is exempt** from the gate; it has not had a
  round in which to be answered yet. A finding with no `opened_turn_id` is treated as prior
  (fail-closed).
