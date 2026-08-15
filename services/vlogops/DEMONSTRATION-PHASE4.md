# VlogOps Phase 4 — verification, made to fail

**What this is:** the verification stage driven end to end **through the real command-line
surfaces, in real processes, against real packages**, with the output recorded verbatim. It is not
the test suite and it does not use the test harness. A green suite says the parts behave; this
says the product works.

- **Date:** 2026-08-15 · **Work Order:** WO-2026-08-15-05 · **Branch:** `build-006/b6-04-verification`
- **Target:** a disposable PostgreSQL 17.4 cluster on loopback, created for this run and destroyed
  at the end of it. **The live Supabase project was never contacted** (`live_authority: none`).
- **No model was called.** Every draft below comes from the deterministic stub, or from a planted
  variant of it. `credential_scope: none`, no gateway, no spend.
- **Every exit code below was captured unpiped.**

> **On the text:** em dashes in captured `stderr` are re-encoded here from the Windows console
> code page, which renders them as mojibake. Nothing else in any transcript has been edited.

## What a reader should conclude

1. **A clean package passes, and can move.** Five dimensions, five passes, advanced.
2. **A planted factual error, a planted private detail and a planted rights gap are each caught,
   and each one BLOCKS.** The map's gate for this phase, in one line.
3. **Blocking is a durable state, not a return value.** The block survives the tool process *and*
   a restart of the database, and re-running the verifier does not clear it.
4. **Every dimension answers for itself.** You can see *which* one objected and why, and each
   reports what it actually examined.
5. **Where the judgement is Warwick's, the verifier surfaces it rather than deciding it** — and a
   surfaced question stops the package just as a rule violation does.
6. **An override is possible and cannot be silent.** No reason, no override. And a refused command
   records nothing at all.

---

## 0. Setup — the cluster and the four migrations

```
$ psql -f db/001_vlogops_content_seed.sql      PSQL_APPLY_EXIT_UNPIPED=0
$ psql -f db/002_vlogops_evidence_pack.sql     PSQL_APPLY_EXIT_UNPIPED=0
$ psql -f db/003_vlogops_story_package.sql     PSQL_APPLY_EXIT_UNPIPED=0
$ psql -f db/004_vlogops_verification.sql      PSQL_APPLY_EXIT_UNPIPED=0

$ psql -tAc "select version()"
PostgreSQL 17.4 on x86_64-windows, compiled by msvc-19.42.34436, 64-bit

$ psql -c "\dt vlogops.*"
 vlogops | compile_run          | table
 vlogops | content_seed         | table
 vlogops | evidence_pack        | table
 vlogops | evidence_pack_entry  | table
 vlogops | finding_disposition  | table     <- Phase 4
 vlogops | intake_run           | table
 vlogops | package_advance      | table     <- Phase 4
 vlogops | source_rights        | table     <- Phase 4
 vlogops | source_snapshot      | table
 vlogops | story_claim          | table
 vlogops | story_claim_citation | table
 vlogops | story_package        | table
 vlogops | story_segment        | table
 vlogops | verification_finding | table     <- Phase 4
 vlogops | verification_run     | table     <- Phase 4
(15 rows)
```

Phase 4 adds five tables and alters none of the ten that were already there.

---

## 1. The real chain — a real seed, a real pack, a real package

The window is **2026-08-13 to 2026-08-14** of this repository: real session logs, real
`Deliverables/`, real commits.

```
$ node bin/vlogops-intake.mjs records --from 2026-08-13 --to 2026-08-14 --privacy internal
EXIT_UNPIPED=0
{"seed_id":"1ff6260e077bc47d77286f9e84fbfc30d6cafc229471d1d130289c5316aa4c71","deduplicated":false,"members":12}

$ node bin/vlogops-compile.mjs compile --seed $SEED
EXIT_UNPIPED=0
{"pack_id":"9ba2bf8bce54b93fd564b828faf1b4f616161fec2d856249437a4636098abe6a", ...
 "entries":8,"entry_bytes":139494,"bounded":true,"omitted":4,"candidates":12}

$ node bin/vlogops-scribe.mjs draft --pack $PACK --model stub
EXIT_UNPIPED=0
{"package_id":"1e87ca1f17c7da826cddcc7d23bd8432ed5dbaf217ef7e2cc33fc7ea82801fa5", ...
 "model":{"provider":"stub","client":"deterministic-stub-v1","configured":false,
          "warning":"MECHANICAL PLACEHOLDER TEXT — no language model was called. Not Warwick's voice."},
 "claims":8,"segments":14}
```

| | |
|---|---|
| **seed_id** | `1ff6260e077bc47d77286f9e84fbfc30d6cafc229471d1d130289c5316aa4c71` |
| **pack_id** | `9ba2bf8bce54b93fd564b828faf1b4f616161fec2d856249437a4636098abe6a` |
| **package_id** | `1e87ca1f17c7da826cddcc7d23bd8432ed5dbaf217ef7e2cc33fc7ea82801fa5` |

---

## 2. The positive control — a CLEAN package passes

**This comes first on purpose.** Refusals alone cannot tell a control apart from a wall: a
constraint set that blocked every package ever built would score identically on the three planted
defects below and be worth nothing. So the clean case is proven before the failures.

```
$ node bin/vlogops-verify.mjs verify --package $PKG --json
EXIT_UNPIPED=0
{
  "package_id": "1e87ca1f17c7da826cddcc7d23bd8432ed5dbaf217ef7e2cc33fc7ea82801fa5",
  "verification_id": "a438da1cf8a80f1f8a433a28381849d8ab98a5c1e82e5983f0ff2a5814e9640d",
  "verdict": "pass",
  "advanceable": true,
  "dimensions": {
    "fact": "pass",
    "quotation": "pass",
    "privacy": "pass",
    "rights": "pass",
    "cross-format": "pass"
  },
  "findings": 0
}

$ node bin/vlogops-verify.mjs advance --package $PKG --verification $CVID --by Warwick
{"packageId":"1e87ca1f17c7...","verificationId":"a438da1cf8a8...","advancedBy":"Warwick","advanced":true}
EXIT_UNPIPED=0
```

**The gate admits as well as refusing.** That is the half most gates never demonstrate.

---

## 3. Planted defect 1 — A FACTUAL ERROR

A claim that contradicts the evidence entry it cites. The draft is produced through the same
`draftStoryPackage` the Scribe CLI calls — **the shipped CLI deliberately offers no way to ask for
a bad draft**, so the demonstration uses a small driver to plant one.

The defect cannot be planted by editing a stored package: `db/003` refuses `UPDATE` and `DELETE` on
every story table, so there is no path that takes a good package and makes it bad. A planted defect
is planted where a real one would come from — **the draft**.

```
$ node <driver> $PACK factual-error
{"package_id":"e345a62aab2f617cc503539f93d42c1528f1d0387835645fbfe80007a5589383",
 "planted":"factual-error","model":"planted-defect-factual-error"}

$ node bin/vlogops-verify.mjs verify --package $P1 --json
EXIT_UNPIPED=1
verdict: blocked
dimensions: {"fact":"blocked","quotation":"pass","privacy":"pass","rights":"pass","cross-format":"pass"}
 - block FACT-1: master claim "claim-1" asserts currency "£8,241,660.75", which appears in none of
                 the 1 evidence entry it cites
 - block FACT-1: master claim "claim-1" asserts number "9,999,417", which appears in none of the
                 1 evidence entry it cites
```

**CAUGHT — and only the fact dimension objects.** A package blocking for four unrelated reasons
would not show that the planted defect is what caught it.

```
$ node bin/vlogops-verify.mjs advance --package $P1 --verification $P1V --by a-later-stage
Error: vlogops: package e345a62aab2f61... is BLOCKED and cannot advance — 2 undisposed blocking
finding(s) and 0 undisposed surfaced question(s), first: fact/FACT-1. A blocking finding is cleared
by a recorded override, a surfaced question by a recorded answer, or by fixing the draft (which
produces a different package). Re-running verification clears nothing.
EXIT_UNPIPED=1
```

**AND IT BLOCKS.**

---

## 4. Planted defect 2 — A PRIVATE DETAIL

Two shapes, because privacy has two. **The first is entirely through the shipped CLI** — a seed
drawn from material somebody classified `private`. Wayfinder §7 puts privacy state on every
snapshot precisely so this is a join rather than a guess.

```
$ node bin/vlogops-intake.mjs supplied --angle "..." --file private-material.md --privacy private
EXIT_UNPIPED=0
{"seed_id":"542b6a049541dc53b3d142bd34bb1efe656853cf8e69b940511b884e7ed8beb0","members":1}

$ node bin/vlogops-verify.mjs rights --seed $PS --ref supplied:1 --basis estate-owned --by Warwick
{"basis":"estate-owned","basis_source":"declared"}          # so the ONE thing wrong is privacy

$ node bin/vlogops-verify.mjs verify --package $PK --json
EXIT_UNPIPED=1
verdict: blocked
dimensions: {"fact":"pass","quotation":"pass","privacy":"blocked","rights":"pass","cross-format":"pass"}
 - block PRIV-1: the package cites "supplied:1", whose effective privacy state is "private" —
                 material classified private or restricted does not leave the estate

$ node bin/vlogops-verify.mjs advance --package $PK ...
Error: ... is BLOCKED and cannot advance — 1 undisposed blocking finding(s) ... first: privacy/PRIV-1
EXIT_UNPIPED=1
```

**The second shape: a private detail in the text that would actually be published.**

```
$ node <driver> $PACK private-detail
{"package_id":"0b0dd59c9df6e37c136ef3b7dc1ba4274fd38dce412cc5ab422b39cafa33c67b","planted":"private-detail"}

$ node bin/vlogops-verify.mjs verify --package $P2 --json
EXIT_UNPIPED=1
 - block FACT-2:        blog[0] asserts number "01632", which appears in none of the evidence its
                        master claim "beat-1" rests on
 - block FACT-2:        blog[0] asserts number "960111", which appears in none of the evidence its
                        master claim "beat-1" rests on
 - block PRIV-4/email:  blog[0] contains a email — 33 characters, shown masked as "n************d".
                        The value is deliberately not recorded here.
 - block PRIV-4/phone:  blog[0] contains a phone — 12 characters, shown masked as "0**********1".
                        The value is deliberately not recorded here.
```

**Read the last two lines carefully.** The finding names the rule, the length and a masked shape —
**never the value.** A privacy finding that copied the offending detail into the findings table,
and from there into this document and into a public repository, would have spread the exact thing
it exists to stop.

*(The two `FACT-2` findings are the phone number's digits, correctly reported as numbers that
appear in no cited evidence. Each finding is individually true; a planted detail tripping two
dimensions is noise worth knowing about rather than a defect.)*

---

## 5. Planted defect 3 — A RIGHTS GAP

**This one is worth reading twice, because it shows the difference between surfacing a question and
deciding it.**

Before anybody has declared anything, the material is `warwick-supplied` — pasted text, which is
exactly the class that can carry somebody else's words. The verifier **will not presume it is his**:

```
$ node bin/vlogops-verify.mjs verify --package $RK --json
EXIT_UNPIPED=1
verdict: blocked | rights dimension: surfaced
 - surface RIGHT-3: no rights basis is declared for "supplied:1" (source_system "warwick-supplied")
                    and none is derivable. Supplied material is never presumed to be Warwick's.
```

The dimension is **`surfaced`, not `pass` and not `blocked`** — a question was raised that this
machinery is not entitled to answer. The package still stops.

Then a human records what the material actually is:

```
$ node bin/vlogops-verify.mjs rights --seed $RS --ref supplied:1 \
      --basis third-party-unlicensed --holder "A Publisher We Have No Agreement With" --by Warwick
{"basis":"third-party-unlicensed","basis_source":"declared"}
EXIT_UNPIPED=0

$ node bin/vlogops-verify.mjs verify --package $RK --json
EXIT_UNPIPED=1
verdict: blocked | rights dimension: blocked
 - block RIGHT-2: "supplied:1" is declared third-party-unlicensed (holder: A Publisher We Have No
                  Agreement With) and cannot be published as-is

$ node bin/vlogops-verify.mjs advance --package $RK ...
Error: ... is BLOCKED and cannot advance — 1 undisposed blocking finding(s) and 1 undisposed
surfaced question(s), first: rights/RIGHT-2 ...
EXIT_UNPIPED=1
```

**CAUGHT, and it BLOCKS.** Note the count: *one block and one question*. The surfaced question from
the earlier run is still open. **A later verdict does not retire an earlier one.**

**Why the estate's own material does not trip this.** A source whose provenance says `git`,
`repository` or `fusion247` is Warwick's own, and the basis is **derived** — recorded as
`basis_source: derived-from-provenance`, so a reader can always tell an inference from a
declaration. Without that, the dimension would answer "unknown" about everything and be a wall.
That is why the clean package in §2 passed its rights dimension with nothing declared at all.

---

## 6. The block is DURABLE — not a return value somebody may ignore

A verdict a later stage can simply decline to read is advisory. This one is rows.

```
$ node bin/vlogops-verify.mjs state --package $RK          # a fresh process
EXIT_UNPIPED=1
{ "runs": 2, "undisposed_blocks": 1, "undisposed_surfaced": 1, "advanceable": false }

$ pg_ctl -m fast stop        PGCTL_STOP_EXIT_UNPIPED=0
$ pg_ctl start               PGCTL_START_EXIT_UNPIPED=0

$ node bin/vlogops-verify.mjs state --package $RK          # new process, new server
EXIT_UNPIPED=1
{ "undisposed_blocks": 1, "undisposed_surfaced": 1, "advanceable": false }

$ node bin/vlogops-verify.mjs advance --package $RK ...
Error: ... is BLOCKED and cannot advance ...
EXIT_UNPIPED=1

$ node bin/vlogops-verify.mjs verify --package $RK         # re-run the verifier
EXIT_UNPIPED=1
"verdict":"blocked"
"deduplicated":true
```

Three separate things are shown here:

1. **The block outlives the process that found it** — a fresh process reads the same answer.
2. **It outlives the database process too.**
3. **Re-running the verifier does not clear it.** `deduplicated: true` — the same package under the
   same ruleset is the same verdict, so a second run adds nothing to clear. The gate reads **every**
   run of a package, not the latest, which is what stops "run it again until it goes green".

The refusal comes from `db/004`'s `before insert` trigger on `vlogops.package_advance`, not from
the CLI. **Delete the CLI and the gate still holds.**

> ### ⛔ The limit of that claim, stated here rather than discovered later
>
> This gate is structural **for the advance operation Phase 4 defines**. Phases 5–7 do not exist
> yet, and nothing here can force a future stage to advance a package by writing to
> `vlogops.package_advance` rather than reading `vlogops.story_package` directly and pressing on.
> **This must never be described as unbypassable.** What it guarantees is narrower and still worth
> having: the advance operation this phase defines cannot be performed on a package carrying an
> undisposed finding, by any client, including a future one that has forgotten why the rule exists.

---

## 7. The override — possible, explicit, attributed, recorded

Warwick owns the product and may overrule any objection. He may not do it invisibly.

```
$ psql -c "every undisposed finding on this package, across every run"
 ordinal | dimension | severity |  rule
---------+-----------+----------+---------
       0 | rights    | block    | RIGHT-2
       0 | rights    | surface  | RIGHT-3
(2 rows)

$ node bin/vlogops-verify.mjs override --verification $RKV --finding 0 --by Warwick
vlogops: override needs --reason <value>
EXIT_UNPIPED=64
```

**No reason, no override.** An override with no reason is not storable, so "it was overridden and
nobody knows why" is not a state this store can reach.

```
$ node bin/vlogops-verify.mjs override --verification $RKV0 --finding 0 ...   # a SURFACED question
Error: vlogops verify: finding 3aefbf265fec...#0 is severity "surface", so the act available on it
is "answered", not "overridden". Overruling a rule violation and answering an unanswered question
are different decisions and are not interchangeable. Nothing was recorded.
EXIT_UNPIPED=64

$ psql -tAc "select count(*) from vlogops.finding_disposition"
dispositions=0
```

**The refused command wrote nothing.** That last line is there because an earlier version of this
code *did* write: asking to override a surfaced question recorded an **answer**, attributed to
Warwick, carrying his words as its reason, and *then* exited non-zero saying it had failed. A
refused command that has already recorded a decision nobody made is the silent override this phase
forbids, wearing an error message. It was found by driving this CLI for this document, and it is
fixed — the category check now happens before the write.

```
$ node bin/vlogops-verify.mjs override --verification $RKV --finding 0 --by Warwick --reason "..."
{"ordinal":0,"severity":"block","disposition":"overridden","decidedBy":"Warwick","recorded":true}
EXIT_UNPIPED=0

$ node bin/vlogops-verify.mjs answer --verification $RKV0 --finding 0 --by Warwick --reason "..."
{"ordinal":0,"severity":"surface","disposition":"answered","decidedBy":"Warwick","recorded":true}
EXIT_UNPIPED=0

$ psql -c "the record"
 ordinal | disposition | decided_by |                        reason
---------+-------------+------------+------------------------------------------------------
       0 | overridden  | Warwick    | I hold a written licence from the holder dated 2026-
       0 | answered    | Warwick    | I checked the source myself; the licence covers this
(2 rows)

$ node bin/vlogops-verify.mjs advance --package $RK --verification $RKV --by Warwick
{"packageId":"4dc2a857cca9...","advancedBy":"Warwick","advanced":true}
EXIT_UNPIPED=0
```

**Only now can it move.** Each decision names one finding, one person and one reason; the table is
append-only, so a change of mind is a new package rather than a rewritten record.

**Attribution, not authentication.** `--by` is a name this process was handed. There is no identity
system in this service and `credential_scope: none` means there is not going to be one here. What
this buys is that the decision is **undeniable afterwards** — never that anybody was authorised at
the time.

---

## 8. Where every package stands

```
$ psql -c "select * from vlogops.package_verification_state"
   package    | runs | blocks | questions | advanced | advanced_by | advanceable
--------------+------+--------+-----------+----------+-------------+-------------
 1e87ca1f17c7 |    1 |      0 |         0 | t        | Warwick     | t     <- clean
 4dc2a857cca9 |    2 |      0 |         0 | t        | Warwick     | t     <- rights gap, overridden
 03f50e98ad60 |    1 |      1 |         0 | f        |             | f     <- private material
 0b0dd59c9df6 |    1 |      4 |         0 | f        |             | f     <- private detail in text
 e345a62aab2f |    1 |      2 |         0 | f        |             | f     <- factual error

$ psql -c "select * from vlogops.verification_run"
 verification | verdict | finding_count | blocking_count | surfaced_count
--------------+---------+---------------+----------------+----------------
 a438da1cf8a8 | pass    |             0 |              0 |              0
 a264c6b83b2e | blocked |             2 |              2 |              0
 7a6638a25001 | blocked |             1 |              1 |              0
 84c05ecd2928 | blocked |             4 |              4 |              0
 3aefbf265fec | blocked |             1 |              0 |              1
 a4165a18a211 | blocked |             1 |              1 |              0
```

**Three packages are stopped and cannot move.** One passed cleanly. One moved only because a named
person overruled a named finding for a recorded reason.

---

## What this demonstration does NOT show

Stated plainly, because a demonstration that only lists its successes is advertising.

- **No model was called.** Every draft is stub output or a planted variant. This proves the rules
  fire against real stored rows from the real chain; it proves nothing about whether they would
  catch a real model's subtler falsehoods. **The planted defects and the detectors were designed by
  the same hand.**
- **The FACT dimension is not a fact-checker.** It grounds numbers of two or more digits, money,
  percentages, dates, times and quotations against the cited evidence, and it reports how much of
  the package carried none of those. **A rhetorical falsehood with no checkable token passes
  untouched, by construction.**
- **`QUOT-2` — an unverifiable quotation — is proven at the rule level only.** No current intake
  route produces a snapshot whose bytes are absent, so that path could not be exercised end to end
  here.
- **The gate binds the advance operation Phase 4 defines**, and cannot bind stages that do not
  exist yet. See the box in §6.
- **Nothing here is operational acceptance.** This is a disposable local cluster. The first live
  start is not Keel's to give.
