# Rotation brief — 2026-08-04, ~04:45

**Written at rotation by the Larry who did the work, and submitted to Veritas Gate 3 as part of
the same head rather than left outside the documentation-truth review** (Warwick's instruction,
2026-08-04). The last brief was stale at its own commit and instructed a rejected design; that is
why this one is inside the gate.

> ## ⚠ THIS BRIEF IS UNDER AN OPEN VERITAS HOLD — READ THE RECEIPT FIRST
>
> **`Builds/BUILD-015-.../Assurance/veritas-gate3-governance-ecfb04b.md`** — Gate 3 on `ecfb04b`,
> **HOLD**, 11 defects, 4 HIGH. It found four of its five HIGH findings *outside* the scope I gave it.
> Corrections applied below where marked; **D-G3-03 and D-G3-04 are NOT fixed** and need Warwick.
>
> - **`D-G3-01` HIGH — `NEXT-ASDAIR-SESSION-brief.md` would have sent you to redo completed D1 work.**
>   Corrected there; **D1 is discharged at `d30beb1`.**
> - **`D-G3-02` HIGH — `D5` is `0-of-8` discharged, not 1-of-8.** My claim was wrong. Corrected below.
> - **`D-G3-03` HIGH — `.claude/agents/keel.md:3` still says *"Never merges, pushes, opens PRs"*.**
>   The contract and the agent index were reconciled; **the shim is what the host actually loads** and
>   it was not. **OPEN — outside my authorised surface.**
> - **`D-G3-04` HIGH — `CLAUDE.md:90/:117/:119` still assert the withdrawn "no `Bash`" premise as
>   fact, contradicting `:56` in the same file.** **OPEN — Warwick barred editing `CLAUDE.md` in this
>   package.**
> - `D-G3-05`/`06`/`07`/`11` — corrected below or noted.
> - **`D-G3-10`, and carry this one:** Veritas's *own* injected `CLAUDE.md` carried the superseded
>   "BOUND" Rule 4 while the identical blob on disk says "UNBOUND". **A corrected record need not
>   reach a fresh agent** — which is the assumption every documentation fix here rests on.
>
> **A struck line is not a reconciled document. Verify any instruction here against the code.**

---

## STARTUP / ORIENTATION — state these four things before any tool call

1. **Map / focus** — this brief, then `Builds/BUILD-015-asdair-durable-household-shopping-steward/`.
   **The build record is the authority.** The Honcho continuity brief is a POINTER, never the
   authority. If it disagrees with this file, open the build record and let it self-correct.
2. **Goal** — Warwick's `BUILD-015-END-TO-END-RECOVERY`: photograph → ShopperBot → checkout-ready
   basket, with Larry outside the weekly operating path.
3. **Phase / gate** — BUILD-015 holds a **VERITAS HOLD** on the WP red-suite recovery. Pax remains
   the sole *final* BUILD-015 acceptance gate. Veritas gates every integrated head from now on.
4. **Exact next action** — see **THE FRONTIER**, item 1.

**Verify by execution, not belief:** repository, worktree, branch, HEAD. Report the comparison.

---

## WHAT CHANGED TONIGHT, AND WHY IT MATTERS MORE THAN THE CODE

**Veritas exists.** Warwick hired an internal quality-and-truth assurance specialist
(`GOVERNANCE-VERITAS-HIRE`). **Larry no longer holds authority to declare his own work complete,
operational, durable, ready, accepted, production-safe or closed.** Until Veritas passes an exact
integrated head, the maximum permitted statement is:

> «Integrated at "<SHA>" and submitted to Veritas for assurance.»

**Veritas's first act was to HOLD its own commissioner's work**, finding two HIGH defects behind
1,599 passing tests. **~~Both are now fixed.~~ CORRECTED (`D-G3-05`) — D1 is fixed at `d30beb1`;
**D5 is `0-of-8` discharged**. "Both are now fixed" was a false completion claim, written into the
same document that tells you not to make them.** Read
`Builds/BUILD-015-.../Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md` and its provenance
addendum before forming any view of BUILD-015's state.

**Contract and capability checks now happen BEFORE dispatch.** Six Work Orders drew six correct
challenges; several found defects in *Larry's order* rather than in the work. The Work Order
template now carries `worker_contract` / `contract_basis` / `contract_conflicts` /
`capability_evidence`. **`file_surface` stays pure path data — never annotate it.** SOP-022 carries
the procedure. **The target is fewer preventably invalid dispatches, never fewer refusals.**

---

## EXACT STATE

- **Branch** `build-015/live-acceptance-recovery-2026-08-03`. **HEAD** — see the tip; this brief is
  committed with the five-file governance change and submitted to Gate 3 together.
- **Suites, measured at this head by Larry, 14 suites: 1,609 tests · 1,606 pass · 0 fail · 3
  SKIPPED.** Per suite (tests/pass): `skill` 281/279 · `outcome` 194/193 · `pipeline` 192/192 ·
  `bot` 148/148 · `cockpit-api` 132/132 · `pipeline-runtime` 130/130 · `reconcile` 106/106 ·
  `packet` 104/104 · `shop` 91/91 · `handoff` 81/81 · `browser-runner` 65/65 · `transcribe` 36/36 ·
  `interpret` 25/25 · `intake` 24/24.
  **The 3 skips are not passes.** Two are in `skill` and one in `outcome`; at least one is the
  destructive Postgres integration test gated on `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`. **Nothing here
  ran against a real database.** An earlier draft of this brief said "1,606 tests, all green",
  which would have hidden them — corrected before submission.
- ~~**No PR open.**~~ **CORRECTED (`D-G3-06`): FIVE PRs are open estate-wide, including **#91
  `fix/thin-larry-mcp-grant`** — the branch this very brief flags as a hazard below. No PR is open
  *for this branch*; that is what I meant and not what I wrote. **Enumerate them before any PR work.**
- Pre-existing and **not tonight's work, leave alone**: `services/hub/youtube/*.mjs`, a
  `.obsidian` config, a BUILD-018 vlog draft, two Felix session logs.

---

## THE FRONTIER — in this order

1. **Discharge Veritas D5 — `0-of-8`, not 1-of-8 (`D-G3-02`).** ~~Only `NEXT-ASDAIR-SESSION-brief.md`
   was reconciled.~~ **That brief was reconciled at `be6d1a5` and then went stale again at `d30beb1`,
   so no class is discharged.** Also discharge **`D-G3-01`…`D-G3-07`** from the Gate 3 receipt. Still
   stale, all **Larry's** (no implementation contract permits these paths):
   `END-TO-END-PROCESS-AUDIT.md` (far wider than two lines — its blocker 1 and blocker 3 are false
   or half-false; the packet **producer** exists, **persistence** does not, so "simply false" would
   create the opposite error) · `CANONICAL-WEEKLY-SHOP-PROCESS.md:89-91` and its status table ·
   `DEFECT-LEDGER.md` D-2026-08-03-15, D-2026-07-28-10 and the `:1037` root cause ·
   `ACTIVATION-DEFERRED.md:74` and `:76-77` · `SOP-021:407` (an **active operational SOP**).
   **`SOP-021a` was searched and is clean — do not glob it in.**
2. **Staleness by omission is the method that catches what a wrong-sentence search misses.**
   `grep -l "Veritas" Builds/BUILD-015-.../` returns **only** the two files in `Assurance/`. No goal
   contract, acceptance document or process document records that a `VERITAS_PASS` is now a
   precondition of complete. Fix that, and use the same inversion elsewhere.
3. **Execution packet persistence.** Silas has ruled the schema (`bigint` not `integer`; surrogate
   PK; **append-and-retain**, not upsert, because the handoff already stores a packet fingerprint
   and upsert would destroy the document it identifies; `unique (shop_id, packet_fingerprint)` via
   the existing `fingerprintPacket()`; `packet_version` GENERATED STORED; complete `asdair_ro` +
   `asdair_rw` grants; migration **015**). **Unverified and highest-risk: which DB role the producer
   connects as.** Check before applying.
4. **Migrations 013 and 014 must be authored as files.** Warwick's classification
   (`BUILD-015-SHOPPING-DATA-CLASSIFICATION`) makes them committable. The live DB is ahead of the
   repo until they exist.
5. **The execution packet has NO production caller anywhere.** Nothing outside its own tests imports
   `buildExecutionPacket.js`. Persisting it without wiring it produces a durable store nothing
   writes to. **This is journey step 12 and it is unbuilt, not half-built.**
6. **The Codex closure-enumeration package** — Warwick's ratified text is inserted into
   `tower-qa-skill.md`. Keel's half is unbuilt: existing-route delivery via `mergeCheck.mjs` /
   `watcher.mjs`, the receipt inventory through the whitelisted `evidence_refs`, correcting the
   stale capability comment, and proving the recorded fingerprint is the amended skill's actual
   SHA-256. Report **`BUILT — NOT LIVE-PROVEN`** until a real Codex run at a PR head.
7. **The injected end-to-end journey**, then restart/resume/duplicate/mutation controls.
8. **One clean PR, CI green at the exact head, Codex, then Pax's final acceptance.**

---

## DECISIONS WAITING ON WARWICK

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
