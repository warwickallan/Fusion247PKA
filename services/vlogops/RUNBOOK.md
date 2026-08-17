# VlogOps — runbook

**Read this before operating VlogOps. You should not need to read its source.**

> ## ⚠️ WHAT THIS SERVICE IS TODAY — read this first, it changes what you are expected to do
>
> **At Phase 1 there is NO long-running service, NO daemon, NO scheduled task and NO listening
> port.** VlogOps is currently a library, a database migration and a **command-line intake**
> that runs when a person runs it and exits when it is done.
>
> **There is therefore nothing to supervise, nothing to keep alive, and no health endpoint to
> poll.** If you are looking for a process to register with a supervisor, there isn't one yet
> — that arrives with Phase 6 (production orchestration), and this runbook grows then.
>
> **This is not a handoff to Mack yet.** It is written now so that nobody has to reconstruct
> it later, and so the operational shape is on record while it is still simple.

---

## 1. What it does

Takes a "content seed" — the raw material for a video or article — and stores it durably in
Postgres with its source bytes frozen, so that later work can be traced back to exactly what
it was built from.

Three ways a seed arrives, all started by a person:

| Route | Command | What it means |
|---|---|---|
| **records** | `vlogops-intake records --from <date> --to <date>` | Compile evidence from what already exists in the repository for a date or period |
| **promote** | `vlogops-intake promote --origin … --angle … --text …` | Promote another Fusion247 output into a seed |
| **supplied** | `vlogops-intake supplied --angle … --file …` | Warwick supplies text or a document, plus the angle he wants taken |

## 2. Configuration

One required environment variable, one optional.

| Variable | Required | What it is |
|---|---|---|
| `VLOGOPS_DB_URL` | **yes** | Postgres connection string for the Content Seed store. The only database variable. |
| `VLOGOPS_REPO_ROOT` | no | Which repository checkout Route 1 reads records from. Defaults to the one the service lives in. |

**Values live outside this repository.** The estate convention is
`node --env-file=<path outside the repo> …`. Nothing in the repository opens that file, and
the service never reads a value from any file inside the repository. `.env.example` documents
names only.

**The service refuses to start on bad configuration, and tells you everything that is wrong
at once** — not just the first problem:

```
vlogops: invalid configuration
  - VLOGOPS_DB_URL is required (a Postgres connection string) and is unset or empty
  - VLOGOPS_REPO_ROOT must be an existing directory (resolved to /nope)
```

That is exit code **78**. Fix every line listed and run it again.

## 3. Starting it

There is no "start". You run one intake and it finishes.

```bash
export VLOGOPS_DB_URL='postgres://…'
node services/vlogops/bin/vlogops-intake.mjs records --from 2026-08-05 --to 2026-08-05
```

Success prints one line of JSON and exits **0**:

```json
{"seed_id":"3f9a…","deduplicated":false,"members":7}
```

- `seed_id` — the seed's permanent identity.
- `deduplicated: true` — **this is a normal, successful outcome, not an error.** It means this
  exact source was already stored, so nothing needed writing. Running the same intake twice is
  safe and is expected.

## 4. Stopping it

Press Ctrl-C, or kill the process. **You do not need to be careful about when.**

The intake writes everything inside a single database transaction, so at any instant it has
only ever done one of two things: nothing at all, or all of it. There is no half-written seed
to clean up, no lock to release by hand and no repair step. **If you kill it, just run the
same command again** — it will either complete the work or tell you it was already done.

## 5. Exit codes

| Code | Meaning | What to do |
|---|---|---|
| **0** | Done. A seed was stored, or was already stored. | Nothing. |
| **64** | The command line was wrong. | Read the usage it printed. |
| **65** | The seed was **rejected** — a required field was missing. | Read the message; it names each missing field. This is the service refusing to store something incomplete, working as designed. **Do not try to force it through.** |
| **78** | Configuration is invalid or missing. | See §2. Every problem is listed. |
| **1** | Something else failed — usually the database is unreachable. | See §7. |

## 6. Checking health

There is no health endpoint at this phase. Two checks tell you everything:

**Can it reach the store?**

```bash
psql "$VLOGOPS_DB_URL" -c "select count(*) from vlogops.content_seed"
```

**Is the store intact?**

```bash
psql "$VLOGOPS_DB_URL" -c "
  select route, status, count(*)
    from vlogops.content_seed group by 1,2 order by 1,2"
```

Every seed should be `sealed`. A row in any other state is worth reporting, not fixing.

## 7. Reading the logs

Output goes to the terminal — stdout for the result, stderr for errors, with a full stack
trace. There is no log file and no log rotation, because nothing runs unattended yet.

The three failures you will actually meet:

| What you see | What it means |
|---|---|
| `ECONNREFUSED` / `getaddrinfo` | The database is unreachable. Check `VLOGOPS_DB_URL` and that the host is up. |
| `vlogops: seed rejected` | A required field was missing. Not a fault — see exit 65. |
| `no source records found in <window>` | Route 1 found nothing in that date range. Usually the dates are wrong, or the range is genuinely empty. |

## 8. Recovery

**There is no recovery procedure, and that is a design property rather than an omission.**

- Killed mid-intake → nothing was written. Run it again.
- Killed after it printed its JSON → the seed is stored. Running it again is harmless and
  reports `deduplicated: true`.
- Ran it twice by accident → one seed. The database enforces this, not the program.

**What you must never do:** do not `UPDATE` or `DELETE` rows in `vlogops.source_snapshot`,
`vlogops.intake_run`, or the identity columns of `vlogops.content_seed`. The database will
refuse you — those tables are append-only by trigger, deliberately, because a later failure
must never be able to rewrite what an earlier run captured. **If you find yourself wanting to
edit one of these rows, escalate instead.**

## 9. The database

The store lives in its own `vlogops` schema and touches nothing else. It holds no grants for
any API role, so it is not reachable through the managed project's Data API — only through a
direct connection with `VLOGOPS_DB_URL`.

**Applying or changing the schema is not an operations task.** The migration is
`db/001_vlogops_content_seed.sql`; applying it to the managed project is a live action owned
by Larry, after review. Do not apply it, and do not run `db/teardown.sql` against anything
that holds real seeds — it drops the whole `vlogops` schema.

## 10. Escalation

| Situation | Who |
|---|---|
| The service will not run, or a command fails unexpectedly | **Larry** — raises a Work Order if it is a defect |
| A seed looks wrong, missing or duplicated | **Larry** — do not edit rows to correct it |
| The schema needs changing | **Larry** — never an operations change |
| Anything requiring the migration to be applied to the live project | **Larry** — it is a gated live action |

**Operational defects never go straight to the engineer.** They go to Larry, who decides
whether they become authorised work.

## 11. What this runbook does not yet cover

Phase 6 adds durable production orchestration — long-running work, retries, callbacks and
asset versions. **That is when this service becomes something to supervise**, and this runbook
gains a process-supervision section, a health endpoint, log locations and a restart procedure.
Until then there is genuinely nothing running between commands.

**The first live start of anything in this service has not happened and is not covered here.**
It is a Warwick gate, performed by Larry, and no evidence in this repository substitutes for it.
