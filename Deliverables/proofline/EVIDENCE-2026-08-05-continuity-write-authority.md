# EVIDENCE — continuity write-side pointer protection (session-start-time vs. stored-write-time)

**Builder self-test evidence — NOT independent review.**

| | |
|---|---|
| Work Order | In-prompt, time-critical, issued directly by Larry (not a filed `Deliverables/proofline/WO-*.md` this time — noted honestly rather than inventing a path). Corrected mid-flight by Larry, on Warwick's confirmation, before any implementation began: the original design compared the candidate map's own git-commit timestamp against the stored pointer; Warwick caught that this would wrongly reject a deliberate switch to an older, dormant build, and the corrected design (session-start-time vs. stored-write-time) is what is implemented and evidenced below. |
| Governance head | `48195d7ff8d1d1f6f42c21d58f4a7d9ff8f4dd97` (`build-020/live-trial`) — realigned twice during this dispatch after two upstream force-updates/fast-forwards; confirmed both times that `tools/governor/continuity.mjs`, `tools/governor/continuity.test.mjs` and Keel's own contract were byte-identical across every head visited, so the earlier reconnaissance stayed valid throughout. |
| Contract read | `Team/Keel - Implementation Engineer/AGENTS.md`, blob `500c6c5171074c2573f55810f93dc82a5e81508b` |
| Worktree / branch | `C:\Fusion247PKA-wo-continuity-race` / `build-020/continuity-write-authority`, cut from the governance head — **not** the shared worktree `C:\Fusion247PKA-build-020-trial`, per the order |
| `credential_scope` / `live_authority` / `network` | `none` / `none` — code and tests only, no real network call anywhere in this suite |
| `private_surface` | `none` |

## What was built

**The race.** `continuity.json`/the Honcho session is one shared store written by every session's Stop
hook across every worktree and build on this machine. Before this change, `buildPacket` resolved a
`map_path` purely from the calling session's own branch-scoped git state and `writeContinuity` posted it
unconditionally — with zero comparison against what was already the latest stored pointer. An old/unrelated
worktree session, closed after a more current session had already posted the right pointer, could silently
overwrite it on nothing more than post-time ordering: exactly the "confident wrong orientation" (W-1) this
whole mechanism exists to prevent, moved from the read side (already closed by `mapPathPresentHere`,
WP-2B(2)) to the write side, which had never been checked.

**The signal is session start time, not map commit-recency.** An earlier design (mine, before Warwick's
correction) compared the candidate map's own git-commit timestamp against the stored pointer. That is
wrong: commit-recency answers "when did this file last change", not "when did this session decide to
point at it" — it would have rejected a deliberate switch to an older, dormant build outright. The
corrected signal is: is THIS session's start time (derived from the Stop hook's own `transcript_path`
payload field) strictly after the write-timestamp (`ts` — an existing packet field, nothing new) of the
packet `readLatest` currently reports as newest? If yes, the candidate `map_path` is genuinely current and
is written normally, regardless of how old the target map itself is by commit. If no, `map_path` is
omitted from the outgoing packet — every other field (focus, next_action, etc.) still writes normally, so
only the pointer itself is protected. The honest-absent render logic (`readContinuityBrief`) already
handles a packet with no `map_path` correctly; this triggers that existing degradation, it does not build
a new one.

**Changes to `tools/governor/continuity.mjs`:**

1. `ensureStore(request = hf)` and `deliver(packet, { request = hf } = {})` — the write path gained an
   injectable `request`, the *same* `request = hf` idiom `fetchMessagePage` already uses for the read path
   in this file, extended to the one write call site that lacked it. **Not a second seam** — required so
   the new comparison could be tested with no network, and so a test's `readLatest` (via `fetchPage`) and
   `deliver` (via `request`) can be made to agree on where "the store" is.
2. `writeContinuity(state, opts)` — before allowing a candidate `map_path` out, and only when one is
   present, it now reads the currently-latest stored packet (`readLatest(readOpts)` — the *existing*
   `readLatest`, reused at one more call site, not a new mechanism) and compares `opts.sessionStartedAt`
   against `current.latest.ts`. Reject (strip `map_path`) unless the session genuinely started after that
   write.
3. `transcriptPathFrom(raw)`, `readTranscriptHead(path, maxBytes)`, `sessionStartFromTranscript(path)` —
   new, small, local helpers. `readTranscriptHead` mirrors `sampler.mjs`'s existing `readTranscriptTail`
   (same shared transcript file, scanned from the opposite end for the opposite reason) — `sampler.mjs`
   sits outside this Work Order's `file_surface`, so this is a sibling function rather than an import, but
   the fd/fstat/read/close shape is the identical established idiom in this codebase, not a new technique.
   Bounded to 1 MB from the head, exported for direct testing.
4. `cli()`'s `stop` handler now resolves `sessionStartedAt` from the Stop hook's stdin `transcript_path`
   field and threads it into `writeContinuity`. Manual `write`/`backfill` are untouched — they carry no
   Stop hook payload and so have no session to time; the write-side protection simply cannot apply there
   and falls back to the existing unconditional-write behaviour (see "Accepted limitations" below).

**Nothing in `resolveActiveMapPath` / `mostRecentlyCommitted` / the WP-2B(1) map-selection logic was
touched.** The corrected design does not use map commit-recency at all, so that logic — already correct,
already verified dynamic — did not need to change. This made the actual diff smaller than my first
(superseded) design would have been.

## Required proof — Warwick's own acceptance script, executed

All five scenarios use `writeContinuity` directly, injecting `git` (to control which map a session
resolves to and its commit age), `fetchPage`/`request` (an in-memory fake Honcho session shared between
the read and write paths — `fakeHoncho()` in the test file, built from `pagingServer`/`msg()`, both already
defined in this suite), and `sessionStartedAt` (to control the one new signal). Every "observable outcome"
assertion is checked against a **subsequent** `readLatest`/`readContinuityBrief` call, never only against
an internal function's return value.

| # | Scenario | Test | Result |
|---|---|---|---|
| 1 | Session A posts `map_path` for a deliberately-current build | `WRITE-AUTHORITY: a session that STARTED BEFORE…` (A half) | `a.packet.map_path === 'Deliverables/map-A.md'` |
| 2 | Session B — started BEFORE A's write — Stop fires AFTER A | same test (B half) | `b.packet` carries **no** `map_path`; every other field (`focus`) still delivered |
| 3 | Observable outcome: B's stale write must not become the visible pointer | same test | subsequent `readLatest` shows B as newest-by-post-time with **no** `map_path`; subsequent `readContinuityBrief` matches `/map path missing or invalid/` and **never** matches B's stale path |
| 4 | Session C — started AFTER A's write — switches to an older/dormant build whose own map is OLDER by commit-recency | `DIFFERENTIATING PROOF: …` | `switchToDormant.packet.map_path === 'Deliverables/map-dormant-build.md'`; a subsequent `readLatest` resolves to it, **despite** a controlled CONTROL assertion proving that map's commit ts (`1000`) is far older than the currently-stored map's commit ts (`1754000000`) |
| 5 | Mutation-style control, both directions, identical candidate + identical prior | `MUTATION: the session-start comparison is REAL…` | OLDER `sessionStartedAt` → `map_path` stripped; NEWER `sessionStartedAt` (same candidate, same prior) → `map_path` present |

**Scenario 4 is the differentiating proof.** Under the superseded commit-recency design this exact write
would have been WRONGLY REJECTED — the candidate's own map commit (`1000`) is far older than the stored
pointer's map commit (`1754000000`), which is precisely the shape of input that design would have refused.
Under session-start-time comparison it is accepted, because the deliberate switch happened after the
stored write, which is all the new design asks. The new source code does not read map commit timestamps
in this comparison at all — the CONTROL assertion in the test (`dormantAlone.map_path` really does resolve
to the far-older map) exists specifically so this could not pass by construction.

### Test run — the 13 new tests, by name

```
ok 80 - WRITE-AUTHORITY CONTROL: no prior stored packet — the candidate is written unconditionally
ok 81 - WRITE-AUTHORITY: a session that STARTED BEFORE the stored pointer's last write does NOT replace it
ok 82 - DIFFERENTIATING PROOF: a session that STARTED AFTER the stored write DOES replace it — even though its own map is OLDER by commit-recency
ok 83 - MUTATION: the session-start comparison is REAL — force OLDER (reject) and NEWER (accept) against the SAME seeded prior
ok 84 - FALLBACK: a readLatest failure degrades to the unconditional write, not a block
ok 85 - FALLBACK: no sessionStartedAt (a manual `write`/`backfill` has no session to time) — nothing to compare, writes unconditionally
ok 86 - SEAM CONTROL: `deliver` routes EVERY Honcho call through the injected `request`, including `ensureStore`
ok 87 - TRANSCRIPT: the FIRST line carrying a top-level timestamp is the session start
ok 88 - TRANSCRIPT: an unparseable, missing or timestamp-less transcript resolves to null, never a guess
ok 89 - TRANSCRIPT: an invalid timestamp value is skipped in favour of the next valid line
ok 90 - TRANSCRIPT MUTATION: the bounded head-read is REAL — a valid line beyond it is never found
ok 91 - TRANSCRIPT MUTATION CONTROL: the SAME valid line, with no oversized padding ahead of it, IS found
ok 92 - PRODUCT PATH: `stop` derives sessionStartedAt from the REAL transcript_path in its stdin payload, without breaking the existing map pointer
```

**A defect this suite actually caught, in-flight, before handback.** The first drafts of tests 81 and 82
used fixed literal ISO dates (e.g. `'2026-08-05T08:00:00.000Z'`) for `sessionStartedAt`, compared against
`buildPacket`'s REAL wall-clock `ts` for the "prior" write. That is non-deterministic by construction — its
pass/fail depends on what time the suite happens to run — and test 82 failed outright on the first real
run for exactly that reason (a literal chosen without checking it against the real clock). Both tests were
corrected to derive their comparison timestamps from `a.packet.ts` / `current.packet.ts` (the actual
value `buildPacket` stamped), never a fixed literal. The `MUTATION` test (83) was never affected — it
constructs its "prior" packet directly as a literal object with a literal `ts`, so its own comparison
values were always self-consistent regardless of real time.

## Mutation test on the shipped source (not just the test's own fixtures)

To prove the accept/reject guard is real rather than vacuous, the live comparison in `writeContinuity` was
inverted (`!(sessionStartMs > priorWriteMs)` → `(sessionStartMs > priorWriteMs)`) directly in
`tools/governor/continuity.mjs`, the suite re-run, the file restored byte-for-byte, and the restore
re-verified (`git diff --stat` showing the exact same insertion/deletion counts as before the mutation, and
the full suite green again).

```
=== MUTATION: comparison direction inverted ===
# tests 92
# pass 89
# fail 3

not ok 81 - WRITE-AUTHORITY: a session that STARTED BEFORE the stored pointer's last write does NOT replace it
not ok 82 - DIFFERENTIATING PROOF: a session that STARTED AFTER the stored write DOES replace it — even though its own map is OLDER by commit-recency
not ok 83 - MUTATION: the session-start comparison is REAL — force OLDER (reject) and NEWER (accept) against the SAME seeded prior

=== RESTORED ===
git diff --stat -- tools/governor/continuity.mjs
 tools/governor/continuity.mjs | 164 ++++++++++++++++++++++++++++++++++++++----
 1 file changed, 151 insertions(+), 13 deletions(-)
# tests 92 / # pass 92 / # fail 0
```

**Exactly the three tests that assert the accept/reject decision went red, and only those three** — every
other test (including the transcript-parsing suite, which does not exercise this comparison) stayed green,
which is what distinguishes a real guard from a test suite that happens to be fragile everywhere.

## Full suite — before and after, executed count and `# fail`, verbatim

Both runs executed in this worktree, `MSYS_NO_PATHCONV=1` not required (no Windows-path-mangling command
involved). "Before" = the unmodified files at this exact governance head, obtained via `git stash` (not a
separate checkout, so no risk of drifting from the head under review); "after" = the working tree as
handed back.

| Run | Command | `# tests` | `# pass` | `# fail` |
|---|---|---|---|---|
| **Before** (stashed to original) | `node --test tools/governor/continuity.test.mjs` | **79** | **79** | **0** |
| **After** | `node --test tools/governor/continuity.test.mjs` | **92** | **92** | **0** |

79 → 92 is exactly the 13 new tests listed above; zero pre-existing tests were touched, weakened, skipped
or deleted (the import line and the two `writeContinuity` call sites in `cli()` were the only edits inside
previously-existing code; every other change is additive).

## Secret scan

```
$ bash scripts/secret-scan.sh --surface tools/governor/continuity.mjs tools/governor/continuity.test.mjs \
    Deliverables/proofline/EVIDENCE-2026-08-05-continuity-write-authority.md
```

Exit **0** — SCANNED and clean, covering all **three** declared paths (26 detection classes plus the
credential-shaped filename deny-list). `private_surface` is `none`, so no private surface was scanned or
touched. The scanner's known uncovered class stands as always: a credential with no recognisable shape
held in an ordinarily-named variable — not applicable here (no credential-shaped content was written).

## Acceptance criteria table

| Criterion | Met | Evidence |
|---|---|---|
| The write-side comparison uses SESSION START TIME, not map commit-recency | ✅ | source diff — the comparison reads `opts.sessionStartedAt` vs. `current.latest.ts` only; `resolveActiveMapPath`/commit-recency logic is untouched and not consulted here |
| Session B (started before A's write) does NOT replace A's stored pointer | ✅ | `WRITE-AUTHORITY: …` test, scenarios 2-3 above |
| Session C (started after A's write, older map by commit) DOES replace the pointer | ✅ | `DIFFERENTIATING PROOF: …` test, scenario 4, with an explicit CONTROL proving the map really is older by commit |
| Mutation-style control proves both directions are real | ✅ | `MUTATION: …` test, scenario 5; source-level inversion above |
| No prior stored packet → always write | ✅ | `WRITE-AUTHORITY CONTROL: no prior stored packet…` |
| `readLatest` failure → unconditional write, named as an accepted limitation | ✅ | `FALLBACK: a readLatest failure…`; named in-source and here |
| No `sessionStartedAt` (manual `write`/`backfill`) → unconditional write, named as an accepted limitation | ✅ | `FALLBACK: no sessionStartedAt…`; named in-source and here |
| `transcript_path` → session start time derivation is correct and bounded | ✅ | `TRANSCRIPT: …` suite (5 tests) including a mutation/control pair proving the head-read bound is enforced |
| Real CLI wiring (`stop` → `transcript_path` → `sessionStartedAt` → `writeContinuity`) does not crash or silently drop the pointer | ✅ | `PRODUCT PATH: 'stop' derives sessionStartedAt…` |
| Full existing suite still green, before and after, `# fail 0` | ✅ | 79/79/0 → 92/92/0 above |
| Secret scan clean over the declared surface | ✅ | exit 0, three files, above |

## Assumptions made

- **The transcript's FIRST line carrying a top-level `timestamp` field is treated as the session's genuine
  start.** Verified against a real transcript file on this machine during reconnaissance (this session's
  own transcript): the first one or two lines (`mode`, `file-history-snapshot`) commonly carry no top-level
  `timestamp`, and the first message line that does is a close, honest proxy for session start. This is a
  reasonable proxy, not a guaranteed exact instant — named here rather than left implicit.
- **The 1 MB head-read bound is generous but not infinite.** A pathological transcript whose first
  timestamped line sits beyond 1 MB of leading content would resolve to `null` (no comparable session
  start), which — per the design — degrades to the unconditional-write fallback rather than blocking. Named
  as an accepted limitation, and its bound is directly proven enforced by the `TRANSCRIPT MUTATION` pair.

## Out-of-scope findings

None found outside the declared surface during this Work Order.

## Not verified / known limitations

- **This is builder self-test evidence only.** Every proof above was executed by the party that wrote the
  code; no independent reviewer has examined this change.
- **The comparison is against the SINGLE newest stored packet, matching the reader's own latest-wins
  semantics exactly — `readLatest` has never walked packet history, and this does not start it walking
  now.** It answers "is this write current relative to the last one", not "what is the best map ever
  recorded across this session's whole history". Named explicitly in-source (see the comment block above
  `writeContinuity`) because a reviewer's first instinct will be to ask about it.
- **No prior stored packet, an absent/unparseable `sessionStartedAt`, or a `readLatest` failure all fall
  back to the CURRENT unconditional-write behaviour rather than blocking** — a real, accepted limitation
  named per the Work Order's explicit instruction, not a silent gap. A Stop hook that throws ends Warwick's
  turn with an error, and a stricter guard here would trade a rare race for a routine failure.
- **`sampler.mjs` was read but not modified.** `readTranscriptHead` is a small sibling of its
  `readTranscriptTail`, deliberately duplicated rather than imported because `sampler.mjs` sits outside
  this Work Order's `file_surface`. A future consolidation of the two (a shared bounded-read helper) is a
  reasonable tidy-up but is not this Work Order's to make.
- **Nothing in this evidence asserts anything about the LIVE installed copy at `~/.mypka/governor/`.** Per
  the order, that copy is untouched; Larry re-installs once this fix is proven, same as every prior
  governor change.
- **Two upstream force-updates/fast-forwards occurred on `origin/build-020/live-trial` during this
  dispatch** (`6b12b68…` → `0572745…` → `55f22b8…` → `48195d7…`), all before any commit of this Work Order's
  own existed. Each realignment was checked for overlap with this file_surface (none) and for contract
  drift (none — same blob throughout) before proceeding. Recorded for the reviewer's awareness, not because
  it affected the outcome.

**Builder self-test evidence — NOT independent review.**
