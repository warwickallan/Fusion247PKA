# VlogOps Phase 1 — the functional demonstration

**What this is:** the three intake routes driven end to end **through the real CLI, in real
processes, over real content**, with the output recorded verbatim. It is not the test suite
and it does not reuse the test harness. A green suite says the parts behave; this says the
product works.

- **Date:** 2026-08-15 · **Work Order:** WO-2026-08-14-01 · **Branch:** `build-006/b6-01-content-seed-store`
- **Target:** a disposable PostgreSQL 17.4 cluster on loopback, created for this run and
  destroyed at the end of it. **The live Supabase project was never contacted**
  (`live_authority: none`). The DSN throughout was
  `postgres://vlogops_demo@127.0.0.1:54329/vlogops_demo` — trust auth on 127.0.0.1, so it
  carries no credential.
- **Every exit code below was captured unpiped.**

## What a reader should conclude

1. **All three intake routes work through the real command-line surface**, not only from tests.
2. **Identity is content-derived and independently checkable.** The manifest that was hashed is
   stored beside the identity, and re-hashing it reproduces the identity exactly.
3. **The same source taken in twice yields ONE seed** — proven with two separate invocations.
4. **The selection rule visibly chooses**: 185 candidates considered, 12 admitted, 173 rejected.
5. **`Deliverables/` and git history are genuinely first-class.** The demonstration window has
   **zero session logs** and still produced a full 12-artefact bundle.
6. **An incomplete seed cannot be created**, and **a stored snapshot cannot be rewritten** —
   both refused, live, in front of you.

---

## 0. Setup — the cluster and the schema

```
$ initdb -D <tmp>/data -U vlogops_demo -A trust --encoding=UTF8 --no-locale
INITDB_EXIT_UNPIPED=0
$ pg_ctl -D <tmp>/data -o "-p 54329 -c listen_addresses=127.0.0.1" -w -l <tmp>/server.log start
PGCTL_START_EXIT_UNPIPED=0
$ createdb -h 127.0.0.1 -p 54329 -U vlogops_demo vlogops_demo
CREATEDB_EXIT_UNPIPED=0
$ psql "$VLOGOPS_DB_URL" -tAc "select version()"
PostgreSQL 17.4 on x86_64-windows, compiled by msvc-19.42.34436, 64-bit

$ psql "$VLOGOPS_DB_URL" -v ON_ERROR_STOP=1 -f db/001_vlogops_content_seed.sql
PSQL_APPLY_EXIT_UNPIPED=0
CREATE SCHEMA / CREATE TABLE ×3 / CREATE INDEX ×3 / CREATE FUNCTION / CREATE TRIGGER ×4

$ psql "$VLOGOPS_DB_URL" -c "\dt vlogops.*"
 vlogops | content_seed    | table
 vlogops | intake_run      | table
 vlogops | source_snapshot | table

$ psql "$VLOGOPS_DB_URL" -tAc "select 'content_seed='||count(*) from vlogops.content_seed"
content_seed=0
```

The store starts empty. Everything below is what the CLI put into it.

---

## 1. Route 1 — existing records, over a real repository window

**The window is `2026-08-05`, and it was chosen because it is awkward**: a real, ordinary, busy
day in this estate that produced **zero session logs**. Session logs are the stream the North
Star names first. If Route 1 only worked when they exist, it would work beautifully on the days
that have them and return nothing on the days that do not — and on any single window you cannot
tell those two cases apart.

```
$ node bin/vlogops-intake.mjs records --from 2026-08-05 --to 2026-08-05 --privacy internal
EXIT_UNPIPED=0
{"seed_id":"ee329d3cf50b751312f10ec16c7ca18509033fcd874b4816dfade85de0672666","deduplicated":false,"members":12}
```

### 1a. The same source, a second time, as a genuinely separate process

```
$ node bin/vlogops-intake.mjs records --from 2026-08-05 --to 2026-08-05 --privacy internal
EXIT_UNPIPED=0
{"seed_id":"ee329d3cf50b751312f10ec16c7ca18509033fcd874b4816dfade85de0672666","deduplicated":true,"members":12}

$ psql -c "select count(*) as seed_rows from vlogops.content_seed"
 seed_rows
-----------
         1

$ psql -c "select outcome, count(*), sum(member_count) as members from vlogops.intake_run group by outcome"
   outcome    | count | members
--------------+-------+---------
 deduplicated |     1 |      12
 sealed       |     1 |      12
```

**Same identity. One row. Both attempts recorded; only one of them wrote anything.** Nothing was
carried between the two runs except what is in the database — they are separate operating-system
processes with separate memory.

### 1b. Watching the rule choose — considered versus admitted

What it **considered**, over the real window:

```
CANDIDATES CONSIDERED, by class:
  session-log       0 candidate(s)      <-- the stream the North Star names first
  deliverable       6 candidate(s)
  build-record     29 candidate(s)
  git-commit      150 candidate(s)
  TOTAL           185
```

What it **admitted** — the 12 rows the CLI actually stored:

```
    class     |                                        source_ref                                        | bytes
--------------+------------------------------------------------------------------------------------------+--------
 build-record | file:Builds/BUILD-015-…/Assurance/veritas-gate3-documentation-d63668f.md                  |  27318
 build-record | file:Builds/BUILD-015-…/Assurance/veritas-gate3-truth-94f135f.md                          |  30328
 build-record | file:Builds/BUILD-015-…/DEFECT-LEDGER.md                                                  | 133204
 build-record | file:Builds/BUILD-015-…/END-TO-END-PROCESS-AUDIT.md                                       |  41342
 build-record | file:Builds/BUILD-015-…/SHIT-TO-DO.md                                                     |  33442
 deliverable  | file:Deliverables/2026-08-05-pax-honcho-regression-brief.md                               |  15513
 deliverable  | file:Deliverables/2026-08-05-pax-nolan-gap-brief.md                                       |  12019
 deliverable  | file:Deliverables/2026-08-05-veritas-claude-md-codex-boundary-receipt.md                  |  16960
 deliverable  | file:Deliverables/2026-08-05-veritas-phase2-gate-receipt.md                               |  19541
 deliverable  | file:Deliverables/2026-08-05-veritas-rotation-readiness-discharge-receipt.md              |   9171
 deliverable  | file:Deliverables/2026-08-05-veritas-rotation-readiness-receipt.md                        |  18981
 git-commit   | git-commit:996a838f222e2a0f7ed8f334544e58f5d359e6cb                                       |   8112
```

A sample of what it **considered and rejected** — real files, by name:

```
  REJECTED  build-record    11126b  Builds/BUILD-006-vlogops-publishing-engine/SOURCE-foundry-boundary-decision-2026-08-02.md
  REJECTED  build-record     7558b  Builds/BUILD-010-fusion-tower/Architecture/tower-host-runbook.md
  REJECTED  build-record     6423b  Builds/BUILD-010-fusion-tower/Runtime/recovery.md
  REJECTED  build-record     8216b  Builds/BUILD-015-…/ACTIVATION-DEFERRED.md
  REJECTED  build-record    21524b  Builds/BUILD-015-…/Assurance/veritas-gate3-governance-ecfb04b.md
  REJECTED  build-record     9124b  Builds/BUILD-015-…/Assurance/veritas-wp-red-suite-recovery-0f8a1bc-provenance-addendum.md
  REJECTED  build-record    14443b  Builds/BUILD-015-…/Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md
  REJECTED  build-record    15696b  Builds/BUILD-015-…/BUILD-015-goal-contract.md
  REJECTED  build-record    12541b  Builds/BUILD-015-…/CANONICAL-WEEKLY-SHOP-PROCESS.md
  REJECTED  build-record    10620b  Builds/BUILD-015-…/COCKPIT-OPERATIONAL-STATUS.md
  ... plus 149 git commits in range that were considered and not admitted
```

And the seed carries the record of its own decision, so this is auditable later by someone who
was not here:

```json
{
    "rejected": 173,
    "selected": 12,
    "max_bytes": 2097152,
    "rule_version": "records-smallest-sufficient-v1",
    "max_artefacts": 12,
    "selected_bytes": 365931,
    "classes_present":  ["build-record", "deliverable", "git-commit"],
    "classes_selected": ["build-record", "deliverable", "git-commit"],
    "candidates_considered": 185
}
```

**Read the two lists together and the design is visible.** 185 in range, 12 taken — this is
"smallest sufficient", not "everything available". Every class that was present is represented,
which is the guarantee that stops any one stream being silently starved. And with **zero session
logs in range**, the bundle is carried entirely by `Deliverables/`, build records and git
history — which is the point the window was chosen to make.

---

## 2. Route 2 — promoting another Fusion247 output

A real promotion of a real output: the AsdAIr session log from the day a photograph falsified a
green assurance.

```
$ node bin/vlogops-intake.mjs promote \
    --origin "AsdAIr weekly shop, 2026-08-10 — the run where a photograph falsified a green assurance" \
    --angle  "How a single photograph falsified a suite that said 23 of 23 were correct" \
    --file   "Team Knowledge/session-logs/2026/08/2026-08-10-20-00_larry_the-day-a-real-photograph-falsified-the-assurance.md" \
    --privacy internal
EXIT_UNPIPED=0
{"seed_id":"739c10ada40d5096e3c90a58e15c82a83481e82f017ab59c34aa5dec86b0399e","deduplicated":false,"members":1}
```

### 2a. The same promotion with one field removed

```
$ node bin/vlogops-intake.mjs promote --origin "…" --file "…" --privacy internal    # no --angle
EXIT_UNPIPED=65
Error: vlogops: promotion rejected
  - angle is required — the proposed angle is part of the promotion contract, not an afterthought
```

**Rejected, with nothing written.** A partial promotion is worse than no promotion, because it
looks like a seed to everything downstream — the Source Compiler, Scribe, verification — and each
stage would inherit the gap without ever being told there was one.

---

## 3. Route 3 — a seed Warwick supplies directly

```
$ node bin/vlogops-intake.mjs supplied --text "Today I thought X was a fucking good idea. …"    # no --angle
EXIT_UNPIPED=65
Error: vlogops: supplied seed rejected
  - angle is required — the angle or question is required INPUT and is never inferred from the text
```

**The angle is required input and is never inferred.** Inferring it would be the system quietly
deciding what he meant — and it would do so most confidently on exactly the material where he is
being least literal.

Supply the angle and it lands:

```
$ node bin/vlogops-intake.mjs supplied \
    --text  "Today I thought X was a fucking good idea. GPT and Pax told me it was shite. This is what I missed." \
    --angle "What did I actually miss, and why was I so certain before I asked anyone?" \
    --privacy private
EXIT_UNPIPED=0
{"seed_id":"70f423303895b06e599000dcd7d4a7f8a2d7ea70445ff39bc55f327accd918b2","deduplicated":false,"members":1}
```

The **same text under a different question is a different seed**, deliberately:

```
$ node bin/vlogops-intake.mjs supplied --text "<the same text>" \
    --angle "Why do I keep asking the machines only after I have already decided?" --privacy private
EXIT_UNPIPED=0
{"seed_id":"1fea2854d600d111791eacca56315a55481f765df177d4f3eb9bcdcb53376ab9","deduplicated":false,"members":1}
```

---

## 4. Identity — recomputed independently from what was stored

The stored manifest for `70f4233038…`:

```json
{
    "v": 1,
    "angle": "What did I actually miss, and why was I so certain before I asked anyone?",
    "route": "supplied",
    "members": [
        {
            "source_ref": "supplied:1",
            "content_sha256": "70a367347923dc368d9d84eff31382d25f1358623d6aa1c3d036e6ec241b2bd9"
        }
    ]
}
```

Hashing it reproduces the identity:

```
stored seed_id  : 70f423303895b06e599000dcd7d4a7f8a2d7ea70445ff39bc55f327accd918b2
recomputed      : 70f423303895b06e599000dcd7d4a7f8a2d7ea70445ff39bc55f327accd918b2
MATCH           : YES

the exact canonical bytes that were hashed:
{"angle":"What did I actually miss, and why was I so certain before I asked anyone?","members":[{"content_sha256":"70a367347923dc368d9d84eff31382d25f1358623d6aa1c3d036e6ec241b2bd9","source_ref":"supplied:1"}],"route":"supplied","v":1}
```

**Nothing in those bytes is a row id, a timestamp, a process id or an ordinal.** That is why two
unrelated processes on two different days reach the same answer. And because the manifest is
stored, the identity is a claim anyone can check rather than one you have to take on trust.

---

## 5. Snapshot integrity — provenance, hash, and a check that survives its source

```
source_ref     | promotion:AsdAIr weekly shop, 2026-08-10 — the run where a photograph falsified a green assurance
content_sha256 | 539ad900cfc163895a4f7d01b0096eb6967f9924ec0070b725ab7a8a4017de8a
byte_length    | 9234
media_type     | text/plain
privacy_state  | internal
captured_at    | 2026-08-15 01:00:43.048509+01
provenance     | {
               |     "route": "promotion",
               |     "origin": "AsdAIr weekly shop, 2026-08-10 — …",
               |     "captured_by": "vlogops/1",
               |     "source_system": "fusion247",
               |     "promoted_angle": "How a single photograph falsified a suite that said 23 of 23 were correct"
               | }
```

Verified by **Postgres hashing the stored bytes itself** — a different tool from the one that
wrote them:

```
        hash_recorded_at_intake         |        hash_of_bytes_as_stored         | match | length_match
----------------------------------------+----------------------------------------+-------+--------------
 539ad900cfc163895a4f7d01b0096eb6967f99… | 539ad900cfc163895a4f7d01b0096eb6967f99… | t     | t
```

### Why 9234 stored bytes and not the 9388 on disk

Because supplied and promoted **text** is normalised on the way in — CRLF to LF, NFC, trimmed —
and then the **normalised bytes are what get both stored and hashed**. Fully accounted for, with
nothing lost:

```
raw bytes            : 9388
normalised bytes     : 9234
difference           : 154
CR characters removed: 153
trimmed from ends    :   1
```

153 + 1 = 154. **The rule is: normalise in, hash what you store, never normalise out.** It is what
lets re-hashing a stored snapshot be a real integrity check rather than a restatement of the same
assumption. (Files taken by Route 1 are hashed and stored **raw**, with no normalisation at all.)

---

## 6. Can a later failure rewrite history?

Tried directly in SQL, as an operator with full database access would:

```
$ psql -c "update vlogops.source_snapshot set content = 'rewritten'::bytea where seed_id='739c10ad…'"
ERROR:  vlogops: source_snapshot is append-only; UPDATE refused
CONTEXT:  PL/pgSQL function vlogops.deny_mutation() line 11 at RAISE
PSQL_UPDATE_EXIT_UNPIPED=1

$ psql -c "delete from vlogops.source_snapshot where seed_id='739c10ad…'"
ERROR:  vlogops: source_snapshot is append-only; DELETE refused
PSQL_DELETE_EXIT_UNPIPED=1
```

**Refused by the database, not by the application.** The build's reliability rule — a later source
or connector failure cannot erase or reinterpret an existing run — holds against any client,
including a future one that has forgotten why the rule exists.

---

## 7. Final state

```
   route   | privacy_state | status | seeds
-----------+---------------+--------+-------
 promotion | internal      | sealed |     1
 records   | internal      | sealed |     1
 supplied  | private       | sealed |     2

 content_seed | source_snapshot | intake_run | sealed | deduplicated
--------------+-----------------+------------+--------+--------------
            4 |              15 |          5 |      4 |            1
```

Every seed produced:

```
   route   |                             seed_id                              | snaps
-----------+------------------------------------------------------------------+-------
 promotion | 739c10ada40d5096e3c90a58e15c82a83481e82f017ab59c34aa5dec86b0399e |     1
 records   | ee329d3cf50b751312f10ec16c7ca18509033fcd874b4816dfade85de0672666 |    12
 supplied  | 1fea2854d600d111791eacca56315a55481f765df177d4f3eb9bcdcb53376ab9 |     1
 supplied  | 70f423303895b06e599000dcd7d4a7f8a2d7ea70445ff39bc55f327accd918b2 |     1
```

**4 seeds · 15 snapshots · 5 intake attempts, of which 4 sealed and 1 correctly deduplicated.**

The counts reconcile, and it is worth walking them because that is how you check a store is
telling the truth. **Seven CLI invocations were made:**

| # | Invocation | Exit | Effect |
|---|---|---|---|
| 1 | `records` 2026-08-05 | 0 | **sealed** — 12 snapshots |
| 2 | `records` 2026-08-05, again | 0 | **deduplicated** — nothing written |
| 3 | `promote`, all five fields | 0 | **sealed** — 1 snapshot |
| 4 | `promote`, no `--angle` | 65 | **refused** — never reached the database |
| 5 | `supplied`, no `--angle` | 65 | **refused** — never reached the database |
| 6 | `supplied` + angle | 0 | **sealed** — 1 snapshot |
| 7 | `supplied` + a different angle | 0 | **sealed** — 1 snapshot |

Five succeeded and two were refused. The five successes are the five `intake_run` rows; the four
that wrote are the four seeds; 12 + 1 + 1 + 1 = the 15 snapshots. **The two refusals appear
nowhere in the store, which is the correct outcome** — a rejected seed leaves no trace to be
mistaken later for a real one.

## 8. Teardown

```
$ psql -v ON_ERROR_STOP=1 -f db/teardown.sql
TEARDOWN_EXIT_UNPIPED=0
NOTICE:  drop cascades to 4 other objects — content_seed, source_snapshot, intake_run, deny_mutation()
DROP SCHEMA
$ psql -tAc "select count(*) from pg_namespace where nspname='vlogops'"
0
$ pg_ctl -D <tmp>/data -w -m immediate stop
PGCTL_STOP_EXIT_UNPIPED=0
cluster directory removed: YES
```

---

## What this demonstration does NOT show

Stated plainly, because a demonstration that oversells itself is worse than none.

- **It is not independent verification.** It was produced by the same party that built the thing.
  Internal assurance and external QA are separate steps and neither has happened here.
- **It says nothing about the live Supabase project.** Nothing connected to it. The migration has
  never been applied there, and doing so is a gated live action.
- **It is not a first live start.** There is no long-running service at Phase 1 to start.
- **The crash-recovery behaviour is not shown here** — that is proven by the AC7 kill proofs in
  the test suite, where four real processes are killed mid-transaction. This demonstration covers
  the human intake journey, not the failure path.
- **The Route 1 bundle is specific to the repository state at this commit.** Re-running it on a
  window whose files have since changed will correctly produce a different identity.
