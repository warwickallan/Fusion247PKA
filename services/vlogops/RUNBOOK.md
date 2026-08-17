# VlogOps — runbook

**Read this before operating VlogOps. You should not need to read its source.**

> ## ⚠️ WHAT THIS SERVICE IS TODAY — read this first, it changes what you are expected to do
>
> **At Phase 2 there is still NO long-running service, NO daemon, NO scheduled task and NO
> listening port.** VlogOps is a library, two database migrations and **two command-line
> tools** — an intake and a compiler — each of which runs when a person runs it and exits when
> it is done. Compilation is invoked for a seed exactly as intake is invoked for a window.
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

Then, once a seed exists, a second step turns it into the **evidence pack** the later phases
read from:

| Step | Command | What it means |
|---|---|---|
| **compile** | `vlogops-compile compile --seed <seed_id>` | Turn a sealed seed into a bounded, ordered, provenance-complete evidence pack |
| **verify** | `vlogops-compile verify --pack <pack_id>` | Re-check a stored pack against the frozen bytes it was built from |

**A pack is a narrowing, not a copy.** The seed holds everything intake judged sufficient for
the window; the pack holds what fits the story's budget, in chronological order, with the
duplicates collapsed. **A pack that had to leave something out says so** — see §6.

## 2. Configuration

One required environment variable, one optional.

| Variable | Required | What it is |
|---|---|---|
| `VLOGOPS_DB_URL` | **yes** | Postgres connection string for the Content Seed store. The only database variable. |
| `VLOGOPS_REPO_ROOT` | no | Which repository checkout Route 1 reads records from. Defaults to the one the service lives in. |

**Values live outside this repository.** Nothing in the repository opens that file, and the
service never reads a value from any file inside the repository. `.env.example` documents
names only.

### Where the value actually comes from — the managed project

**This section previously stopped at "values live outside this repository", which sent the
operator to a person instead of to the product. That was a real defect, found by assurance.**

The approved credentials file for this estate's managed Postgres is
`C:/.fusion247/fusion-capture-gateway.env`, and it is the same fixed path
`tools/session-report/populate.mjs` uses. **It supplies the connection string under the name
`DATABASE_URL`, while this service requires `VLOGOPS_DB_URL`** — so the name must be mapped.

**Copy this line. It is the whole answer, and it has been executed exactly as printed.** Run it
from the repository root; put your own subcommand and flags after the closing quote:

```bash
node --env-file=C:/.fusion247/fusion-capture-gateway.env \
  -e "const r=require('child_process').spawnSync(process.execPath,['services/vlogops/bin/vlogops-intake.mjs',...process.argv.slice(1)],{stdio:'inherit',env:{...process.env,VLOGOPS_DB_URL:process.env.DATABASE_URL}});process.exit(r.status??1)" \
  records --from 2026-08-05 --to 2026-08-05
```

For the compiler, change `vlogops-intake.mjs` to `vlogops-compile.mjs` and pass `compile --seed …`
or `verify --pack …`.

It spawns the real entry point unchanged, and **it forwards the child's exit code**, so §5 still
means what it says — verified: `64` for a bad command line, `1` for a missing pack, `0` on success.

> **⚠️ Two forms that look right and DO NOT WORK. Both were printed here before and both were
> caught by assurance actually running them — which is the only reason this section is now correct.**
>
> - `node --env-file=<file> bin/vlogops-intake.mjs records …` → **exit 78**, *"VLOGOPS_DB_URL is
>   required … unset or empty"*. `--env-file` supplies `DATABASE_URL`; this service reads the other
>   name and does not fall back.
> - `node --env-file=<file> -e "process.env.VLOGOPS_DB_URL=process.env.DATABASE_URL"` → **exit 0
>   and nothing runs at all.** It sets a variable in a process that then exits. It never launches
>   the service, and its success is silent, which is worse than the failure above.
>
> `export VLOGOPS_DB_URL="$DATABASE_URL"` also works **only after you have loaded the approved file
> into the shell yourself.** If you have not, `$DATABASE_URL` is empty and you get exit 78.

**Do not copy the connection string into a new file to avoid the mapping.** Two files holding
one credential means a rotation silently leaves one stale.

> **⛔ OPEN DECISION — Warwick's, and PARKED by him. Do not act on it and do not raise it again.**
> Whether to add `VLOGOPS_DB_URL` to the approved file, or give VlogOps a dedicated role and
> location, is his call and is explicitly **non-blocking**. Until he rules, the mapping above
> is the route. The related question of whether this service should keep connecting as the
> schema owner is parked with it.

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

> **The managed store already holds seeds, so `deduplicated: true` with no new row is a likely
> FIRST experience — and it is the system working.** Re-taking a source that has not changed is
> meant to produce one seed, not a second copy. You have done nothing wrong and there is nothing
> to clean up. Only a *new or changed* source produces `deduplicated: false`.

Compiling that seed is the same shape — one command, one line of JSON, exit **0**:

```bash
node services/vlogops/bin/vlogops-compile.mjs compile --seed 3f9a… --emit pack.json
```

```json
{"pack_id":"92f6…","seed_id":"3f9a…","deduplicated":false,"entries":8,
 "entry_bytes":233501,"bounded":true,"omitted":4,"candidates":12}
```

- `bounded: true` — the budget bound and **something real was left out.** Not an error; see §6.
- `deduplicated: true` — the same pack already existed. Same meaning as above: expected, safe.
- `--emit <path>` writes the pack's canonical document. Two independent compiles of the same
  seed write **byte-identical** files, which is the cheapest way to check nothing has drifted.

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

**Is a given pack still whole?** This is the check that matters most, and it is one command:

```bash
node services/vlogops/bin/vlogops-compile.mjs verify --pack <pack_id>
```

```json
{"pack_id":"92f6…","ok":true,"entry_count":8,"entries_verified":8,"bounded":true,"problems":[]}
```

Exit **0** and `ok: true` means every entry still traces to its frozen source bytes and those
bytes still hash to what the pack claims. **Exit 1 and `ok: false` is a real finding** — read
`problems`, do not repair anything, and escalate per §10.

**This check never re-reads the original file, which is the whole point.** It keeps answering
correctly after the source has been edited, moved or deleted, because it reads only what was
frozen at intake. A pack that verifies after its sources are gone is the normal case, not a
lucky one.

**Reading a bounded pack honestly.** `bounded: true` means a budget bound and evidence was
left out. What was dropped, and why, is recorded on the pack itself:

```bash
psql "$VLOGOPS_DB_URL" -c "
  select pack_id, entry_count, bounded, jsonb_array_length(omitted) as omitted
    from vlogops.evidence_pack order by created_at desc limit 10"

psql "$VLOGOPS_DB_URL" -c "
  select jsonb_pretty(omitted) from vlogops.evidence_pack where pack_id = '<pack_id>'"
```

Each omission names the source, the reason (`over-budget` or `duplicate-content`) and which
limit or duplicate caused it. **A pack cannot claim to be complete while having dropped
something for budget** — the database refuses that row outright — so `bounded` can be trusted
without cross-checking it.

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
- **Killed mid-compile → nothing was written. Run the same compile again.** The pack, all of
  its entries and its ledger row commit in one transaction, exactly as intake does, so there
  is no half-written pack and no repair step.
- **Compiled the same seed twice → one pack**, and both attempts appear in `compile_run`. The
  ledger keeps the record of what was attempted even where nothing needed writing.
- **A source was edited or deleted after a pack was compiled → do nothing.** The pack is
  unaffected by design. Confirm with `verify --pack` if you want the reassurance.

**What you must never do:** do not `UPDATE` or `DELETE` rows in `vlogops.source_snapshot`,
`vlogops.intake_run`, `vlogops.evidence_pack`, `vlogops.evidence_pack_entry` or
`vlogops.compile_run`, or the identity columns of `vlogops.content_seed`. The database will
refuse you — those tables are append-only by trigger, deliberately, because a later failure
must never be able to rewrite what an earlier run captured. **If you find yourself wanting to
edit one of these rows, escalate instead.**

**Do not "fix" a pack by recompiling it either.** A pack's identity is its content, so a
recompile of the same seed lands on the same pack. If you believe a pack is wrong, that is a
finding for Larry, not an operation.

## 9. The database

The store lives in its own `vlogops` schema and touches nothing else. It holds no grants for
any API role, so it is not reachable through the managed project's Data API — only through a
direct connection with `VLOGOPS_DB_URL`.

**Applying or changing the schema is not an operations task.** The migrations are
`db/001_vlogops_content_seed.sql` and `db/002_vlogops_evidence_pack.sql`, applied in numeric
order; applying them to the managed project is a live action owned by Larry, after review. Do
not apply them, and do not run `db/teardown.sql` against anything that holds real seeds — it
drops the whole `vlogops` schema, packs included.

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
