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
local double. It needs `initdb`/`pg_ctl`/`psql` on PATH and `node_modules` installed under
`services/control-plane/`.

### 1. Stand up a throwaway cluster

Put the data directory **outside the repo** — a cluster inside a git worktree is one `git clean` away
from destroying itself.

```bash
CL=/tmp/tower-proof            # any path outside the checkout
PORT=55432                     # any free port
initdb -D "$CL/data" -U wo22 -A trust --encoding=UTF8 --no-locale
pg_ctl -D "$CL/data" -o "-p $PORT -c listen_addresses=127.0.0.1" -w -l "$CL/server.log" start
createdb -h 127.0.0.1 -p $PORT -U wo22 towerloop
export CONTROL_PLANE_DEV_DATABASE_URL="postgres://wo22@127.0.0.1:$PORT/towerloop"
```

`-A trust` on a localhost-only throwaway keeps any password off disk. Tear down with
`pg_ctl -D "$CL/data" stop` and delete `$CL`.

> Do **not** use `wp-d-proof/provision.mjs` for this. Despite its header it drops and rebuilds the
> `ops` schema, applies two `ops` migrations, seeds synthetic rows into `public.*`, and writes a
> plaintext password to `.runtime/runtime.json`. None of that is wanted here.

### 2. Apply the schema

```bash
cd services/control-plane/tower-loop
node apply.mjs      # base + watcher + hold + comment deltas, all idempotent
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
CONTROL_PLANE_DEV_DATABASE_URL=... \
TOWER_REVIEWER_MODULE=$PWD/test/doubles/fakeReviewer.mjs \
TOWER_GIT_EVIDENCE_MODULE=$PWD/test/doubles/fakeGitEvidence.mjs \
TOWER_NOTIFY_TRANSPORT=none \
node watcher.mjs
```

The two `*_MODULE` doubles replace Codex and git evidence with canned, offline stand-ins;
`TOWER_NOTIFY_TRANSPORT=none` replaces Telegram. **Drop all three and it calls the real ones** —
which is a live action, and not something this runbook authorises.

Then read the exact text that reached the reviewer:

```sql
select staged_input from tower.supervisor_review where turn_id = '<turn>';
```

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

## Tests

```bash
node test/run-tower-loop-tests.mjs      # needs CONTROL_PLANE_DEV_DATABASE_URL
```

Fails loudly on **zero executed subtests** — a DB-gated run that skips everything is never a pass.
`W1`–`W8` cover the comment seam; `T0`–`T7` are the pre-existing watcher acceptance tests.

## Known limits

- **There is no live webhook and this does not build one.** The ingest entrypoint is a
  function/CLI over a payload, driven exactly like `apply.mjs` and `reviewDiff.mjs`. Nothing here
  evidences that a real GitHub delivery reaches this code.
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
