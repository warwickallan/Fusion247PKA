# Rotation brief — 2026-08-04, ~04:45

## RESUMPTION PRECEDENCE — recorded 2026-08-04, discharging Veritas `D-G3-07`

**Recorded by `WO-2026-08-04-03`, re-seated by `WO-2026-08-04-04` when this map was added. Exactly
one document may direct the next session. This is the order, and every resumption-shaped document
in `Deliverables/` carries this identical block.**

1. **`Builds/BUILD-015-asdair-durable-household-shopping-steward/`** — the build record is the
   **authority for every BUILD-015 fact, and it is not a route.** A document that disagrees with it
   is wrong.
2. **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`** — **THE Wayfinder map. The sole
   route, and the only document that may state the exact next action.**
3. **`Deliverables/NEXT-ASDAIR-SESSION-brief.md`** — **NON-DIRECTIVE.** Operational hazards and
   code-level do-not-rebuild warnings the map points at. It states no next action.
4. **`Deliverables/2026-08-04-rotation-brief.md`** — **NON-DIRECTIVE.** A dated snapshot of the
   2026-08-04 rotation, kept for its record of what changed and the traps it names. It states no
   next action.
5. **`Deliverables/BUILD-015-STAGE1-continuation-brief.md`** — **NON-DIRECTIVE. Superseded
   2026-07-28 snapshot**, kept as a historical record only.
6. **`Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md`** — **NOT a BUILD-015 resumption
   document.** A standing repository-hygiene mission; it never directs BUILD-015 work.

**This block is deliberately duplicated byte-identically across all five documents, as a recorded
exception to the SSOT Golden Rule** (root `AGENTS.md` §1), because a fresh instance may open any one
of them first and must learn from that one which document it is allowed to act on.

**The Honcho continuity brief is a POINTER, never the authority** (root `CLAUDE.md` Step 2).
**Verify by execution, not belief.**

---

> ## THIS DOCUMENT IS A DATED SNAPSHOT. IT DIRECTS NOTHING.
>
> It records the state of the estate at the 2026-08-04 rotation and the lessons that rotation
> produced. **It states no exact next action and no frontier of live work.** For either of those, go
> to `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` — **the Wayfinder map, which is the
> sole route and the only document that may state the exact next action.**
>
> **Snapshot head: `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`.** Everything below describes the
> estate as it stood at that exact commit, not as it stands now. The branch tip has advanced since.
> Resolve the current head yourself.

Written at rotation by the Larry who did the work, and submitted to Veritas Gate 3 as part of the
same head rather than left outside the documentation-truth review (Warwick's instruction,
2026-08-04). The brief before this one was stale at its own commit and instructed a rejected design;
that is why this one went inside the gate.

---

## THE GATE 3 VERDICT ON THIS SNAPSHOT

**Veritas Gate 3 returned `HOLD` on `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`: 11 defects, of which
5 are HIGH.** Receipt:
`Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-gate3-governance-ecfb04b.md`.
Documentation truth was the dimension that failed.

**The HIGH findings are `D-G3-01`, `D-G3-02`, `D-G3-03`, `D-G3-04` and `D-G3-05`.** `D-G3-06` and
`D-G3-07` are MEDIUM; `D-G3-08` through `D-G3-11` are LOW.

**Three of those five HIGH findings fell outside the scope Larry dispatched** — the scope was
`7f83d4c2657b757b4aa8cbceb3274f15e0158fff`'s five files plus this brief. The three outside it were
`D-G3-01` (`NEXT-ASDAIR-SESSION-brief.md`), `D-G3-03` (`.claude/agents/keel.md`) and `D-G3-04` (root
`CLAUDE.md`). `D-G3-02` and `D-G3-05` landed on documents that were inside it.

**Commit `7ca8c3b58523758010d83855177f29175f32f283`'s message says "4 HIGH", and so did an earlier
revision of this brief. Both were wrong. The commit message is immutable history and cannot be
corrected; this document has been.**

What the receipt found, and where each finding now stands:

- **`D-G3-01` HIGH** — `NEXT-ASDAIR-SESSION-brief.md` would have sent a fresh instance to redo
  completed D1 work. Addressed in that file, which has since been rewritten as one clean document.
  **D1 is discharged at `d30beb1cf4a807d4232d3a1ebc51c60784883f0c`.**
- **`D-G3-02` HIGH** — **D5 is `0-of-8` discharged, not 1-of-8.** Larry's claim was wrong. The
  per-class accounting now lives in the directive brief.
- **`D-G3-03` HIGH** — `.claude/agents/keel.md:3` still says *"Never merges, pushes, opens PRs"*.
  The contract and the agent index were reconciled; **the shim is what the host actually loads** and
  it was not. Assigned to a separate work order.
- **`D-G3-04` HIGH** — root `CLAUDE.md:90/:117/:119` still assert the withdrawn "no `Bash`" premise
  as fact, contradicting `:56` in the same file. Assigned to a separate work order.
- **`D-G3-05` HIGH** — this brief previously claimed both HIGH defects from the earlier receipt were
  fixed. **They were not, and the passage is corrected below.**
- **`D-G3-06` MEDIUM** — this brief previously said *"No PR open."* **False estate-wide, and
  corrected below.**
- **`D-G3-07` MEDIUM** — no recorded precedence across the four resumption documents. Addressed by
  the block at the top of this file.
- **`D-G3-08` through `D-G3-11`** — recorded for disposition. `D-G3-11` is addressed by pinning this
  snapshot to an exact 40-character SHA.
- **`D-G3-10`, and carry this one:** Veritas's *own* injected `CLAUDE.md` carried the superseded
  "BOUND" Rule 4 while the identical blob on disk said "UNBOUND". **A corrected record need not
  reach a fresh agent** — which is the assumption every documentation fix rests on. The live-probe
  criterion is OPEN; see below.

---

## WHAT CHANGED AT THIS ROTATION, AND WHY IT MATTERED MORE THAN THE CODE

**Veritas exists.** Warwick hired an internal quality-and-truth assurance specialist
(`GOVERNANCE-VERITAS-HIRE`). **Larry no longer holds authority to declare his own work complete,
operational, durable, ready, accepted, production-safe or closed.** Until Veritas passes an exact
integrated head, the maximum permitted statement is:

> «Integrated at "<SHA>" and submitted to Veritas for assurance.»

**Veritas's first act was to HOLD its own commissioner's work**, finding two HIGH defects behind
1,599 passing tests. **Of those two, one is fixed and one is not.** D1 is discharged at
`d30beb1cf4a807d4232d3a1ebc51c60784883f0c` — `selectProjection()` now derives the projection from
the statement text in `services/asdair/pipeline/test/fakePg.js`, and Veritas independently
reinstated the defect and got 17 failures. **D5 stands at `0-of-8` discharged.** An earlier revision
of this brief said "both are now fixed"; that was a false completion claim, written into the same
document that says not to make them. Read
`Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md`
and its provenance addendum before forming any view of BUILD-015's state.

**Contract and capability checks now happen BEFORE dispatch.** Six Work Orders drew six correct
challenges; several found defects in *Larry's order* rather than in the work. The Work Order
template now carries `worker_contract` / `contract_basis` / `contract_conflicts` /
`capability_evidence`. **`file_surface` stays pure path data — never annotate it.** SOP-022 carries
the procedure. **The target is fewer preventably invalid dispatches, never fewer refusals.**

---

## THE STATE AT THIS SNAPSHOT — `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`

**Historical. Do not act on these numbers; the Wayfinder map carries current state.**

- **Branch** `build-015/live-acceptance-recovery-2026-08-03`. **Head at this snapshot:**
  `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`, the commit carrying this brief together with the
  five-file governance change, submitted to Gate 3 as one head.
- **Suites, measured at that head by Larry, 14 suites: 1,609 tests · 1,606 pass · 0 fail · 3
  SKIPPED.** Per suite (tests/pass): `skill` 281/279 · `outcome` 194/193 · `pipeline` 192/192 ·
  `bot` 148/148 · `cockpit-api` 132/132 · `pipeline-runtime` 130/130 · `reconcile` 106/106 ·
  `packet` 104/104 · `shop` 91/91 · `handoff` 81/81 · `browser-runner` 65/65 · `transcribe` 36/36 ·
  `interpret` 25/25 · `intake` 24/24. Veritas verified every one of these figures independently.
  **The 3 skips are not passes.** Two are in `skill` and one in `outcome`; all three are the
  destructive Postgres integration tests gated on `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`. **Nothing here
  ran against a real database.** An earlier draft of this brief said "1,606 tests, all green", which
  would have hidden them — caught and corrected before submission.
- **Five PRs were open estate-wide** at this snapshot, including **#91 `fix/thin-larry-mcp-grant`**,
  the branch this very brief flags as a hazard below. **No PR was open for this branch** — that is
  the accurate statement, and the earlier unqualified *"No PR open"* was false. **Enumerate them
  live before any PR work; never carry a PR list forward.**
- Pre-existing and **not that rotation's work, leave alone**: `services/hub/youtube/*.mjs`, a
  `.obsidian` config, a BUILD-018 vlog draft, two Felix session logs.

---

## WHAT WAS OUTSTANDING AT THIS ROTATION — a record, not a frontier

**This list is a snapshot of what was open on 2026-08-04. It is not a work queue and it is not
sequenced for you.** The live, ordered route is the phase table in
`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` §9. Where the two differ, that one is
right and this one is old.

- **Veritas D5 stood at `0-of-8`.** The stale documents recorded as still needing reconciliation,
  all Larry's (no implementation contract permits these paths): `END-TO-END-PROCESS-AUDIT.md`
  (far wider than two lines — its blocker 1 and blocker 3 are false or half-false; the packet
  **producer** exists, **persistence** does not, so "simply false" would create the opposite error)
  · `CANONICAL-WEEKLY-SHOP-PROCESS.md:89-91` and its status table · `DEFECT-LEDGER.md`
  D-2026-08-03-15, D-2026-07-28-10 and the `:1037` root cause · `ACTIVATION-DEFERRED.md:74` and
  `:76-77` · `SOP-021:407` (an **active operational SOP**). **`SOP-021a` was searched and is clean —
  do not glob it in.**
- **Staleness by omission is the method that catches what a wrong-sentence search misses.**
  `grep -l "Veritas" Builds/BUILD-015-.../` returned **only** the two files in `Assurance/`. No goal
  contract, acceptance document or process document recorded that a `VERITAS_PASS` is now a
  precondition of complete. Use the same inversion elsewhere.
- **Execution packet persistence.** Silas had ruled the schema (`bigint` not `integer`; surrogate
  PK; **append-and-retain**, not upsert, because the handoff already stores a packet fingerprint and
  upsert would destroy the document it identifies; `unique (shop_id, packet_fingerprint)` via the
  existing `fingerprintPacket()`; `packet_version` GENERATED STORED; complete `asdair_ro` +
  `asdair_rw` grants; migration **015**). **Unverified and highest-risk: which DB role the producer
  connects as.** Check before applying.
- **Migrations 013 and 014 had no committed files.** Warwick's classification
  (`BUILD-015-SHOPPING-DATA-CLASSIFICATION`) makes them committable. The live DB is ahead of the
  repo until they exist.
- **The execution packet had no production caller anywhere.** Nothing outside its own tests imports
  `buildExecutionPacket.js`. Persisting it without wiring it produces a durable store nothing writes
  to. **Journey step 12, unbuilt rather than half-built.**
- **The Codex closure-enumeration package** — Warwick's ratified text is inserted into
  `tower-qa-skill.md`. Keel's half was unbuilt: existing-route delivery via `mergeCheck.mjs` /
  `watcher.mjs`, the receipt inventory through the whitelisted `evidence_refs`, correcting the stale
  capability comment, and proving the recorded fingerprint is the amended skill's actual SHA-256.
  Report **`BUILT — NOT LIVE-PROVEN`** until a real Codex run at a PR head.
- **The injected end-to-end journey**, then restart/resume/duplicate/mutation controls.
- **One clean PR, CI green at the exact head, Codex, then Pax's final acceptance.**

---

## DECISIONS WAITING ON WARWICK

**Recorded as they stood at this rotation. The live list is in
`Deliverables/NEXT-ASDAIR-SESSION-brief.md` §"DECISIONS WAITING ON WARWICK", which carries more of
them; the Wayfinder map records the phase at which each becomes blocking.**

1. **`Team/Asdair - .../AGENTS.md`** still says Asdair runs `runner.js` itself, which
   `RUNTIME-DECISION.md` supersedes and prohibits. **A dispatched Asdair following its own contract
   would do the prohibited thing.** Hard rule forbids touching any `AGENTS.md` without approval.
2. **Should Favourites be a real second ASDA view?** `asdair.regulars` holds one distinct `source`
   value. No `'favourite'` row has ever existed.
3. **Whether the dedupe guard belongs in the schema** rather than in one writer.

---

## THE LIVE-PROBE CRITERION IS OPEN — do not record it as solved

**Thin Larry is UNBOUND, deliberately.** `.claude/settings.json` was installed, **damaged Larry and
team MCP operation, and Warwick removed it.** A fresh Larry holding `Bash`, `Edit` or `Write` is
**expected**, not a mysterious failed binding. This is **discipline, not enforcement.**

`fix/thin-larry-mcp-grant` holds an attempted repair. It **predates current governance and must not
be merged or rebound blindly.** Do not restore `.claude/settings.json`.

**A fresh Larry now reads the correct record — but a record is not a probe.** If the state changes
without the record changing, he is misled again in exactly the way he was tonight. At first fresh
startup: determine whether the host exposes an authoritative live tool/grant inventory; if it does,
capture the observed grant as evidence; if not, Nolan specifies a bounded probe.

---

## TRAPS THAT COST REAL TIME TONIGHT

- **`perl -0pi -e 's/…\n…/…/'` silently matches nothing on the CRLF files under `services/**` and
  exits 0** — leaving the file untouched and the suite green. A worker fabricated a pass this way
  and caught it only by hashing. **Hash before and after every mutation.**
- **Three stale zero-byte `.git/index.lock` files occurred**, each ~10–35 minutes old with no live
  git process. **Prove staleness before clearing; never clear on sight.** Serialising writers is
  Larry's job, not a worker's.
- **A test fake that vouches for itself in a comment is the thing under test.** `fakePg` claimed to
  detect a dropped SELECT column and could not — not even against syntactically invalid SQL.
- **A negative capability claim never fails loudly.** The "Codex cannot read files on Windows"
  comment was true in July, false by August, and was still shaping design decisions.
- **`CLAUDE.md`'s "prefer the existing `reviewDiff.mjs` route" is shorthand that points at the
  ad-hoc claim route.** The PR routes are `mergeCheck.mjs` and `watcher.mjs`.

---

## WHAT NOT TO DO

- **Do not build a new mechanism** in response to any of this. No new specialist, service, registry,
  validator, state machine or control plane. BUILD-018 is the cautionary tale and Warwick restated
  the cap in every ruling tonight.
- **Do not declare anything complete.** That authority no longer exists without a Veritas PASS.
- **Do not distil a Veritas receipt into a Work Order.** Cite the receipt path, the `reviewed_sha`
  and **every** finding ID with an explicit disposition. Larry lost three of eight findings doing
  exactly this, twice.
- **Do not widen "private" to mean "anything concerning a household."** GL-009 carries Warwick's
  classification; ordinary shopping content is explicitly public, including the migrations encoding
  it. He has ruled this twice and asked not to be asked again.
- **Do not treat a passing test as evidence it tests what it claims.** Four separate builders found
  their own tests passing for the wrong reason.
