---
build: BUILD-015
scope: WP-B15-2 — the answer-to-plan spine. FINAL Gate 1 verdict.
gate: 1
kind: focused confirmation of the MUT-B closure, and the resulting Gate 1 verdict.

boundary: >
  WP-B15-2 (WO-2026-08-09-B15-02) and the outcome it promised — "Warwick receives a real question,
  answers naturally or by exact candidate, and THAT ANSWER CHANGES THIS WEEK'S SHOP — with no Larry
  in the path." This receipt confirms the last held finding and closes Gate 1.

reviewed_sha: a5f5b5e1018ccb07dbb8bd4f68307902b368144d
governance_sha: d90735046081420e7d97925c55871adeafd7073b
branch: build-015/wp-b15-2
remote_reachable: true   # git ls-remote origin -> refs/heads/build-015/wp-b15-2 = a5f5b5e

predecessors:
  - veritas-wp-b15-2-2d84dd1.md              # HOLD — D-1, D-2 blocking
  - veritas-wp-b15-2-confirmation-cafa340.md # D-1, D-2 DISCHARGED; AC3 held
  - veritas-wp-b15-2-ac3-fe56305.md          # AC3 NOT discharged — MUT-B

evidence_method: export (git archive of a5f5b5e) + execution in Keel's own worktree for the count dispute
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\8461a9fd-ca53-4a78-af8e-5cefa89d2ee0\scratchpad\vx-fin
worktree_head_at_end: cb0f260ef9eb0fac3ada882a8efc4d1baf302f7e
worktree_status_clean: true   # empty; the only new path is this receipt. HEAD moved during review
                              # by Larry committing concurrently, never by Veritas.

verdict: PASS
review_ceiling: 20 minutes (dispatch); not extended
receipt_sha256: 03c8c47e2488603405045554ffd3f1cb3c613f2cd5b0139b98eb961c92a859a3
reviewed_by: veritas
reviewed_date: 2026-08-09
next_review_trigger: >
  Gate 2 — the phase North Star journey, which this receipt does NOT answer and which requires a
  real shop, a real card and a real answer. Not a receipt, documentation or clerical commit.
---

## Verdict

**The MUT-B closure is DISCHARGED. Gate 1 on WP-B15-2 is PASS.**

All eight acceptance criteria are met. AC3 was the last one held, and it is now met on its own
terms — including the acceptance property Warwick actually ruled on, that the binding be evidenced
by a test which fails when somebody switches it back.

## The closure, tested rather than read

The category-error diagnosis was accepted and fixed correctly: two **absence** properties over the
whole body, `matchAll` rather than `exec`, and set equality rather than presence.

| Mutation | Imports | Primary call | Result |
|---|---|---|---|
| **MUT-A** aliased `{ reason: answer }` | dishonest | `answer` | **RED** |
| **MUT-B** second import, primary rebound | first honest, second added | `reason` | **RED** — `imports {answer, answerModel, reason} … across 2 import(s)` |
| **MUT-C** callee swapped, **imports left honest** | honest | `vision` | **RED** — `the answer path invokes {vision, answer}` |

**Your question — does assertion 2 bite on its own? Yes, and Keel's reasoning for adding MUT-C was
correct.** I ran MUT-C with the import block untouched: assertion 1 has nothing to complain about,
and the test still goes red on assertion 2 alone. Without that mutation, assertion 2 would have been
untested decoration sitting behind an assertion that catches everything first. **This is two
controls, not one, and both are now proven.** Keel finding that gap in its own work and closing it
unprompted is the behaviour this Work Package exists to produce.

## The third disguise — recorded, and NOT blocking

I looked for one, as you asked. There is one.

```js
const { answer, answerModel } = await import('.../models.mjs');  // honest, kept as camouflage
const m = await import('.../models.mjs');                        // namespace import
let parsed = await extractJson(await m.reason(prompt));          // primary call
```

**290/290 green.** Assertion 1 sees only destructured imports, and their union is honest.
Assertion 2's regex is `await\s+([A-Za-z_$][\w$]*)\s*\(`, which cannot match `await m.reason(`.

**I am not blocking on it, and I want the reasoning on the record rather than the conclusion alone:**

- **MUT-B was what a well-meaning edit looks like** — *"reason is fine for the first pass, keep
  Terra for the retry."* Nobody doing it would think they were doing anything wrong. That is why it
  was blocking.
- **MUT-D is not that.** It requires keeping a now-unused destructured import purely as camouflage,
  adding a second import of the same module in a different form, and calling through it. That is
  deliberate evasion, not a quiet switch-back, and it leaves a dead import behind as evidence.
- **The honest refactor is safe.** Someone genuinely moving to a namespace import would *remove* the
  destructure — `imports.length` becomes 0 and assertion 1 fails loudly. The only silent case is
  keeping both forms at once, which is odd enough that review would see it.
- **No static source-text control is exhaustive**, and demanding one that is would be asking for a
  control that cannot exist. Sufficient evidence, not maximum confidence.

Recorded once, labelled **non-blocking**, parked. **Not a Work Order.**

## The count: **9 is correct**, and Keel's instinct was right even though its figure was not

Settled by execution in **Keel's own worktree**, `C:\Fusion247PKA-wp-b15-2\services\obsidiwikai`,
not only in my export. Both locations give the identical result:

```
# tests 42     # pass 33     # fail 9
```

Nine distinct top-level failing files, named in both runs:
`bin/brain-mcp` · `bin/honcho-test` · `bin/wp4b-resume` · `cairn/router` · `core/contextOutbox` ·
`core/learnEnrich` · `core/reanalyse` · `core/systemImprovements` · `core/wp4b`.

**The check that settles it is arithmetic, and it is the one nobody ran: 33 + 8 = 41, and the suite
reports 42 tests.** The remainder is 9. `node_modules` is absent in both locations, so that is not
the difference either.

**Keel's principle is right and I endorse it without qualification:** *"deferring to a reviewer on a
factual count I can execute would be the same class of error as the one this finding is about."*
That is exactly the instinct this estate wants, and it should not be dented by having been wrong
once on the fact. It refused correctly and simply mis-tallied. **The fix is not "defer to Veritas" —
it is to cross-check a count against the total it must sum to.**

Immaterial either way: the revert-and-compare I ran at `fe56305` is what proves the red is
pre-existing, and it was identical on both sides.

## Correction to my own AC1 residual — Silas's proof supersedes it

My `2d84dd1` receipt carried R-2: *"017 has never been executed against any Postgres."* **That is
now stale and I am correcting it in my own record rather than leaving it to be read as current.**
`Deliverables/2026-08-09-silas-017-postgres-proof.md` exists and records real execution on
PostgreSQL 17.4 — applied three times to one database and once to another, `pg_dump --schema-only`
byte-identical, all three `pg_constraint` guards mutation-tested, all fifteen CHECKs fired across 25
negative cases, and insert-only proven with `UPDATE`/`DELETE`/`TRUNCATE`/`ON CONFLICT DO UPDATE` all
refused `42501`.

That discharges the idempotency and grant-immutability half of my residual, and it also answers the
narrower question I raised — whether Postgres accepts a bare `CREATE UNIQUE INDEX` as the target of
`shop_decision_question_fk` — since the migration applied cleanly.

**Remaining residual, correctly stated by Larry:** proven on **17.4**, CI runs **16**. That is
inference, not execution, and it stays on the record as such.

## Accepted requirements — final

| # | Requirement | Verdict | Where established |
|---|---|---|---|
| AC1 | Migration 017 as Silas decided, authored not applied | **PASS** | `2d84dd1` receipt; residual now discharged by Silas's Postgres proof (17.4-vs-CI-16 remains) |
| AC2 | Tap resolves deterministically, no model call | **PASS** | `2d84dd1` — proven by a counted zero |
| AC3 | Free text interpreted by **bounded Terra**, grounded | **PASS** | Bound at `fe56305`; wire body proven to carry `gpt-5.6-terra`; discriminating test closed and triple-mutation-proven here |
| AC4 | Route B, pure seam, no data-model rewrite to move it | **PASS** | `2d84dd1` — zero imports, plain data in and out |
| AC5 | Enumerate every production recomputation, prove by execution | **PASS** | `2d84dd1` — enumerated not sampled, mutation-proven both ways |
| AC6 | Honest gate, no livelock | **PASS** | Property at `2d84dd1`; silence closed at `cafa340`; park proven to speak under the throw design at `fe56305` |
| AC7 | Real clarification round, round-1 keys byte-for-byte pinned | **PASS** | `2d84dd1` (incl. my round-3 probe); production trigger created at `cafa340` |
| AC8 | The false comment goes | **PASS** | `2d84dd1` |

## Evidence executed at this head

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `pipeline && node --test` at `a5f5b5e` | 0 | **290** | 290 pass, 0 fail |
| **MUT-C** callee swapped, imports honest | — | 18 | **1 RED** — assertion 2 bites alone |
| **MUT-D** namespace-import disguise (mine) | — | 18 / 290 | GREEN — recorded non-blocking |
| `obsidiwikai && node --test` — export **and** `C:\Fusion247PKA-wp-b15-2` | — | 42 | **33 pass / 9 fail**, identical in both, nine files named |
| `Deliverables/2026-08-09-silas-017-postgres-proof.md` | — | — | present, 18 KB, records the 17.4 execution |

Mutations applied and reverted **inside the export only**; export proven byte-identical to
`a5f5b5e` afterwards. The repository working tree was never modified by Veritas; `HEAD` moved during
the review because Larry was committing concurrently, and `git status --porcelain` is empty at the
end.

## What Gate 1 PASS does and does NOT say — read this before quoting it

**It says:** each of the eight promised pieces works, is wired into the production path, is
integrated with what precedes and consumes it, and is honestly described. The interpreter is bound
in the real container. The park speaks. The provenance row is true. The controls fail when the
capability is removed.

**It does NOT say Warwick can now do the thing.** No real shop has run through this with a real
gateway, a real card and a real answer. **`Completed automation` is satisfied at Gate 1 scope — the
real production event invokes it — and is NOT satisfied at Gate 2 scope, where the event must have
been exercised.** That is the correct boundary, the Work Order drew it deliberately
(*"the live acceptance … is a SEPARATE product event and is NOT yours to declare"*), and Gate 2 is a
separate receipt that is not owed here and has not been earned.

**BUILD-015's final acceptance remains Pax's**, unchanged.

## Still parked, unchanged, and not to be quietly closed

D-3 (`priorAnswers` reaching `stepRecordConfirmation` — parked Lane B, untested on live rows;
adopted by Keel) · F-4 (round-3+ clarification cards lose their candidates) · F-5 (*"the loop closes
here"* survives at `runPipeline.test.js:1023`) · F-6 (wrong test file named in a comment) ·
`shopLines.markCorrected` still has **zero production callers** · `asdair.shop_decision` absent from
migration 012's grant matrix · `shopStore` browser claim lease-less · the general-form controls close
their subclasses, not the class · MUT-D · `ROLE_ALIAS` no longer enumerates every role · 017 proven
on 17.4 while CI runs 16.

**None of these is a Work Order.** They are the scheduled reconciliation's, and Warwick's to
dispose of.

## Verdict

**PASS.** Codex is now permitted on this boundary subject to Warwick's explicit authority, CI green
and scope match. Larry may mark WP-B15-2 complete.

## Next review trigger

Gate 2 — the phase journey, with a real shop. Not this.
