# BUILD-015 AsdAIr — Wayfinder plan

## START / RESUME HERE — ordered by Warwick

- This Git Wayfinder is the sole route and source of truth.
- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- Read the current phase, gate and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer.
- Continue autonomously until completion or a genuine Warwick-only blocker.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate and next action.
- **Tangents go in "SHIT TO DO" below. Do not chase them.** See the rule there — it binds even when the tangent comes from Warwick.

## SHIT TO DO — parked tangents

**The canonical parked list for this build is
`Builds/BUILD-015-asdair-durable-household-shopping-steward/SHIT-TO-DO.md`.** It is not duplicated
here. Go there to park a tangent, to read the rule the bullet above points at, or to read the Work
Order challenge log. It also carries the completion gate: that file is reviewed, and the review
recorded, before BUILD-015 is ever described as complete.

**Estate-wide items that are not specific to BUILD-015 go in `Deliverables/BACKLOG.md`, not there
and not here.**

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

## WHAT THIS MAP IS, AND WHEN IT WAS WRITTEN — read before trusting its shape

**Written 2026-08-04, at roughly ninety percent of the build.** BUILD-015 was promoted on
2026-07-27 and predates the 2026-08-02 Wayfinder mandate, so **it ran without a map for its whole
implementation.** Warwick asked for one on 2026-08-04 and authorised writing it, for a stated
reason: Wayfinder is how rotations and model switches are tracked, and with Veritas now gating every
integrated head, properly-phased boundaries carry real assurance weight.

**This is a route record for the remainder. It is not a plan that governed the work.** Phases
already passed are described **retrospectively**; phases 0–5 below are the forward route. Presenting
it as though it planned BUILD-015 would be a fiction, and it would be a fiction inside a
documentation-truth review.

> ### THE ROUTE IS AUTHORISED. THE MAP AS A DOCUMENT IS NOT ACCEPTED. These are different things.
>
> **This is the single record of Warwick's route authorisation in the estate. Everything else that
> speaks to it defers to this block.**
>
> **What happened.** On **2026-08-04**, replying in session to a message containing the six-phase
> table now at §9, Warwick said: **"Yes I authorise and agree that."** That is an authorisation of
> **the six-phase route**, and it is real.
>
> **What that authorisation rests on, stated so a reader can weigh it.** It was given in
> conversation. **Nothing in Git recorded it until this line, and this line is Larry's account of
> it** — attested by Larry, not verifiable from the repository, and not independently reproducible
> by any reviewer working from the estate alone. Veritas found this authorisation unevidenced at
> `d63668f` (`D-G3-13`) and **was right to**: it reviews the repository, and the repository was
> silent. The defect was the estate's silence, not the authorisation.
>
> **Residual risk, which only Warwick can close.** This block writes a `product-decision` into the
> map from a second-hand account of a conversation. **If Larry's recollection is wrong, a false
> authorisation is now recorded one layer deeper than the contradiction it replaced.** The cheapest
> closure is Warwick confirming it once in a later session, giving the line a second attestation.
> **No mechanism is to be built to manage this.**
>
> **What Warwick has NOT done, and it is not a technicality.** He authorised the route. **He has
> not read or accepted this 430-line map as a document.** The map carries far more than §9 — the
> current reality table, the fog register, the boundaries, the acceptance evidence and the frontier
> — and none of that has been in front of him. **Do not read "the route is authorised" as "the map
> is accepted."** A fresh instance must not begin phase 1 work on the strength of a document
> Warwick has never seen; root `CLAUDE.md` §Wayfinder — *"Do not begin implementation until Warwick
> accepts the plan"* — is satisfied for the route and **not** for the map.

**Nothing in this map records any work package, phase, build, service or journey as complete,
operational, durable, ready, accepted, production-safe or closed.** Larry holds no such authority
(`GOVERNANCE-VERITAS-HIRE`, 2026-08-04). **BUILD-015 currently holds an open Veritas Gate 3 HOLD.**

---

## 1. GOAL CONTRACT AND NORTH STAR

**Canonical: `Builds/BUILD-015-asdair-durable-household-shopping-steward/BUILD-015-goal-contract.md`.**
Not restated here. The North Star, in Warwick's terms:

> **Send Mum's list to ShopperBot and have the shopping sorted, without disturbing Warwick or Larry
> while other work is in flight.**

The formal contract's north star is a genuinely durable, spawnable household-shopping specialist
that orients from committed function plus Supabase state, plans correctly, asks for decisions when
required, persists outcomes and learning safely, and survives fresh runtime instances.

**The accepted bar is SUPERVISED, not hands-off** (Warwick, 2026-07-28). Fully hands-off shopping
was descoped 2026-07-21. **Warwick remains the checkout and payment gate, permanently.**

**The failure this build exists to close:** the method lived only in machine-local memory and
per-session scratchpads, and the three loop tables had zero writers anywhere in the repo. Each week
started no better informed than the last.

**Larry is outside the weekly operating path.** AsdAIr must run with zero Claude Code involvement;
model calls go through `FUSION_GATEWAY_URL`.

## 2. CURRENT REALITY AND VERIFIED ASSETS

**Resolved by execution 2026-08-04. Every head named here will have moved — resolve it yourself.**

| | |
|---|---|
| Branch | `build-015/live-acceptance-recovery-2026-08-03` |
| HEAD when written | `cd51ac066895985463e88d3933de4e0c1db7c0db` (`git rev-parse HEAD`) |
| Gate 3 reviewed heads | **TWO reviews, both HOLD, both receipts committed.** `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` (11 defects, 5 HIGH) and then `d63668f653e233a22b5a28b6eb60f5fb84ecce48` (9 defects, 3 HIGH). **The live HOLD is the second.** Enumerate `Builds/BUILD-015-…/Assurance/` rather than trusting this row |
| Open PR for this branch | **none.** Five PRs open estate-wide; enumerate live, never carry the list forward |
| Suites | 14 asdair suites, **1,609 tests · 1,606 pass · 0 fail · 3 skipped**, pinned to the head above. **The per-suite split is deliberately carried forward nowhere — it goes stale within a commit. Re-run it, and read the executed count rather than the exit code** |
| CI | **UNVERIFIABLE OFFLINE.** No CI result is claimed at any head. An absent run is never a passing run |
| Live database | **UNVERIFIABLE OFFLINE** — `live_authority: none` throughout this map |

**Verified assets — real, tested, and reachable from something:** the intake receiver, shop state
store and status projection, the ShopperBot control surface, vision transcription through the
gateway, catalogue-grounded interpretation (`interpret/`), the deterministic planner with tolerant
term matching (`skill/termMatch.js`), reconciliation (`reconcile/`), the outcome and regulars
writers, and the Cockpit read surface. `sendQuestionCard` **now has a production caller**, bound in
`pipeline/runtime.js`.

**Verified assets with NO production caller — built, tested, and reached by nothing:** the execution
packet producer `packet/buildExecutionPacket.js`. Enumerated 2026-08-04: every reference outside
`packet/` is a comment or a cross-module test pin in `handoff/`. **A tested module with no caller is
not delivered.**

**The standing risk, stated as the risk it is: no row has ever been written to Postgres by this
journey.** All three skipped tests are the destructive Postgres tests gated on
`ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`. The `RESUMABILITY` tests build a fresh deps container over the
**same in-memory JS object graph** — which proves no state hides in the container, **not** that
anything survives process death.

## 3. SYSTEM MAP AND PRODUCT BOUNDARIES

**The canonical end-to-end process is
`Builds/BUILD-015-.../CANONICAL-WEEKLY-SHOP-PROCESS.md` (steps A–H).** Its own status table records,
per step, what is implemented and what is not. **That table is the authority on implementation
status; this map does not duplicate it.**

Shape of the journey: photograph → ShopperBot intake → durable shop row → catalogue loaded **before**
interpretation → catalogue-constrained vision → identity resolved from our rows → rule and alias
matching → questions only for genuinely new items → answers → replan → **Sonnet Browser execution
packet (Brand A–Z)** → basket built → reconciliation against expected counts → basket-ready handback
→ outcome recording → learning write-back.

**Product boundaries, canonical in `Builds/BUILD-015-.../RUNTIME-DECISION.md`:**

- **Sonnet in Claude for Chrome is the Stage 1 live basket writer.** Not Larry, not a Claude Code
  subagent, not the CDP runner at `services/asdair/browser-runner/`.
- The CDP runner is **experimental, deferred, not the live default, not a blocker to Stage 1, and
  prohibited from further live-account testing without fresh authority from Warwick.**
- **Deferred as Stage 2c and not to be built:** a persistent external-LLM daemon, a fully autonomous
  planning daemon, an unattended ASDA browser, automated checkout, automated payment.
- The Cockpit read contract is published and binding on the read side:
  `Builds/BUILD-015-.../COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md`. Its producers do not exist
  yet.

## 4. KNOWN DECISIONS

Each is settled. **Do not re-open one; point at it.**

| Decision | Where it is canonical |
|---|---|
| Sonnet in Claude for Chrome writes the basket | `RUNTIME-DECISION.md` (Warwick, 2026-08-04) |
| Sort order is **BRAND A–Z**, for the ASDA grid and the packet | Goal contract Q2, `CANONICAL-WEEKLY-SHOP-PROCESS.md` §E |
| Supervised bar, not hands-off; Warwick is the checkout and payment gate | Goal contract |
| Stage 2a/2b are REQUIRED parts of Stage 1; only 2c is deferred | Goal contract §"Stage 1 scope" |
| Execution-packet schema: `bigint`, surrogate PK, **append-and-retain never upsert**, `unique (shop_id, packet_fingerprint)`, `packet_version` GENERATED STORED, full `asdair_ro`/`asdair_rw` grants — migration **015** | Silas's recorded schema decision; restated in the directive brief's frontier |
| Ordinary shopping content is **explicitly not private**; only secrets stay out of the repo | GL-009 (Warwick, ruled twice — do not ask again) |
| Packet stored as whole schema-valid `jsonb`, cockpit renders `lines` in array order and does not re-sort | `COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md` |
| The accepted provenance residual (TQA-PR73-002) proves provenance of **citation**, never of content | `ACCEPTANCE-AND-EVIDENCE.md` |
| Veritas gates every integrated head; Larry may not declare his own work complete | `GOVERNANCE-VERITAS-HIRE`, root `CLAUDE.md` |

## 5. UNRESOLVED FOG AND CONTRADICTIONS

**Recorded rather than silently resolved. Nothing here is to be settled by picking the convenient
source.**

1. **The `sure`-variant conflict — three artefacts disagree.** `skill/planner.js:524` returns
   `fixed_variant_conflict`; `services/asdair/db/007_rules_rotate_directive.sql`'s header states the
   household holds a real conflict and that the migration does not resolve it; `ACTIVATION-DEFERRED.md`
   calls it *"Real, unresolved."* **Establish which is true against the live rules table.**
   `UNVERIFIABLE OFFLINE`. **The separate three-way reading Warwick already closed is retracted and
   settled — this is not that, and it does not re-open it.**
2. **`Arla BOB Semi-Skimmed 2L` (regular 69) is ACTIVE while rule 10 says never buy BOB**, and rule
   10 is `info` with no `match_term`, so nothing enforces it. The old reasoning that `milk` resolved
   safely *because regular 69 carries no alias* was written when matching was exact-string. **Matching
   is now tolerant, so the reason that safety held may no longer hold.** More urgent, not less.
   `UNVERIFIABLE OFFLINE`.
3. **Migrations 013 and 014 were applied live and have no committed files.** `services/asdair/db/`
   stops at `012_complete_grant_matrix.sql` — verified by listing. **The live database is ahead of
   the repository, and a fresh clone or bootstrap restore does not reproduce live state.**
4. **The producer's actual database role is unverified**, and it is the highest-risk unknown before
   any live migration application. `UNVERIFIABLE OFFLINE`.
5. **Whether Favourites is genuinely a distinct source view.** `asdair.regulars` holds one distinct
   `source` value; no `'favourite'` row has ever existed, so `source_view: "favourites"` is a forward
   contract describing nothing live. `UNVERIFIABLE OFFLINE`. Product intent is Warwick's — §7 item 2.
6. **A `BUILD-002 live proof` test row is recorded as still sitting in a `next_week_draft` list.**
   `UNVERIFIABLE OFFLINE`.
7. **A corrected record may not reach a fresh agent. UNEXPLAINED — three observations across three
   sessions, three different relationships to the repository, and no mechanism consistent with all
   three** (`D-G3-10`, `D-G3-20`, and a third recorded below).

   **Every SHA below is a full 40 characters and was resolved through `git rev-parse --verify`. The
   two `CLAUDE.md` versions in play are blob `8d865ed166c339208a94a425e1a508115b556c04` (the
   superseded text) and blob `75a19c4b895a23190f43a20412c156641adbcc4f` (the corrected text).**

   | # | Session | Repository `HEAD` at the time | What the injected `CLAUDE.md` actually was |
   |---|---|---|---|
   | 1 | Veritas, round 1 | `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` | superseded text, while the on-disk blob was current |
   | 2 | Veritas, round 2 | `d63668f653e233a22b5a28b6eb60f5fb84ecce48` | blob `8d865ed166c339208a94a425e1a508115b556c04` — **neither `HEAD` nor the working tree**, but the previous commit |
   | 3 | A dispatched worker, 2026-08-04 | `c9b04cfa3e74b7fb6621f720a0afeca131cfedbb` | blob `8d865ed166c339208a94a425e1a508115b556c04` **again** — while `HEAD:CLAUDE.md` was `75a19c4b895a23190f43a20412c156641adbcc4f`, the on-disk file was `75a19c4b895a23190f43a20412c156641adbcc4f`, **and the previous commit `d63668f653e233a22b5a28b6eb60f5fb84ecce48:CLAUDE.md` was also `75a19c4b895a23190f43a20412c156641adbcc4f`** |

   **Two candidate mechanisms have now been recorded and both are falsified.** "The injected copy
   matched the file at `HEAD`" is falsified by observations 2 and 3. "It matched the previous
   commit" — the replacement offered in the `d63668f` receipt — is falsified by observation 3, where
   the previous commit carried the corrected blob and the injected copy did not. Observation 3
   matched a blob **four commits back**. **No mechanism is offered here to replace them.** Caching or
   snapshotting is a hypothesis, not a finding, and re-narrowing this to a third guess is how the
   first two got written.

   **A real limit on this evidence, not a hedge:** all three observations are **first-person** — an
   agent reporting the contents of its own injected context — and **none is reproducible from the
   repository**. A reader working from Git alone cannot confirm any of them.

   **The live-probe criterion is OPEN. Do not record it as solved and DO NOT DESIGN A PROBE** —
   Nolan specifies one if and when Warwick asks. The behavioural rule this implies for a reader is
   in the directive brief.
8. **The proven ASDA basket-building mechanism is thinly evidenced.** `EXPERIMENT-RESULT.md` records
   that a bulk control *exists*; it does not record it used successfully at scale. Warwick's
   first-hand "fast ordered traversal" account is authoritative and the repository does not
   corroborate it. Close the gap by capturing evidence during the next real shop.

## 6. HUMAN DEPENDENCIES — and the phase at which each becomes blocking

**The detail of each decision — the options, the recommendation, the evidence — is in
`Deliverables/NEXT-ASDAIR-SESSION-brief.md` §"DECISIONS WAITING ON WARWICK". Not duplicated here.**
This map owns only *which dependency blocks what, and when*.

| # in the brief | Dependency | Becomes blocking at |
|---|---|---|
| 1 | **Asdair's contract still says Asdair runs `runner.js` itself**, which `RUNTIME-DECISION.md` supersedes and prohibits | **Before any Asdair dispatch, at any phase.** A dispatched Asdair reads its own contract first and that contract outranks every brief. The prohibited action is a **live ASDA account** action. **DO NOT DISPATCH ASDAIR UNTIL WARWICK HAS RULED.** |
| 2 | Should Favourites be a real second ASDA view? | **Phase 1** — it decides whether the packet's `source_view` contract describes anything |
| 3 | Should the dedupe guard live in the schema rather than in one writer? | **Phase 1**, with migrations 013/014 |
| 4 | `D-G3-08` — Keel's contract enumerates three conditions after "when all of these hold" | **Non-blocking.** Fold in at Warwick's next authorised touch of that contract |
| 5 | Root `CLAUDE.md:90` vs root `AGENTS.md` §3 on whether Larry may act personally on integration | **Phase 4**, when documentation is reconciled and Git truth is re-submitted |
| 6 | Nothing obliges re-reconciling a `.claude/agents/` shim when its wiki contract changes — how `D-G3-03` happened | **Non-blocking.** Needs an `AGENTS.md` edit reserved to Warwick. **No mechanism is to be built** |
| 7 | `.claude/agents/nolan.md:4` requests `MultiEdit`, which this host does not deliver | **Non-blocking.** Parked in `SHIT-TO-DO.md` |

**Plus the one this map itself creates, and its current state:** the six-phase route below was a
`product-decision`, and **Warwick authorised it on 2026-08-04** — see the authorisation block at the
top of this map, which is the single record of it and carries its provenance and its limits.
**It no longer blocks phase 1.** What still stands between this map and phase 1 is the open Veritas
Gate 3 HOLD, and — separately — the fact that **Warwick has not read or accepted this map as a
document**, which is not the same decision and has not been made.

## 7. SECURITY, PERMISSIONS, OWNERSHIP AND RECOVERY BOUNDARIES

- **Two credentials, both in `C:/.fusion247/asdair.env`:** `ASDAIR_DB_URL` (`asdair_ro`,
  **SELECT-only**) and `ASDAIR_WRITE_DB_URL` (`asdair_rw`, narrow write). **Consume the environment,
  never inspect it.** A writer told to use `ASDAIR_DB_URL` is a defect — that variable is
  contractually SELECT-only precisely so a bug *cannot* write.
- **The secrets store is denied by default.** `C:\.fusion247\**` is reachable only through one exact
  declared `private/<project>/**` subtree. Rule:
  `Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md`. **Every Work Order declares
  `private_surface`, mandatory even when `none`.**
- **Shopping content is not a privacy matter** (GL-009), including the migrations encoding it. Only
  secrets stay out of the repo. **Do not widen "private" to mean "anything concerning a household."**
- **Permanently human-controlled, and no change of runtime touches them:** never auto-substitute ·
  never book a slot · never check out · never pay · never enter the ASDA password · `checked_out`
  stays false, enforced as a SQL literal.
- **A real reduction in mechanical guarantee, stated rather than glossed:** the CDP runner enforced
  the substitution ban in three independent code layers. **Sonnet in Chrome has none** — the boundary
  there is instruction and supervision. That is why the live pass is supervised and stops at
  checkout-ready.
- **Recovery boundary — the honest one.** Durability is **claimed nowhere in this build**. Restart
  and resume are proven only over an in-memory object graph. Until phase 2 lands, **recovery from
  process death is unproven, not partial.**
- **Ownership:** Larry owns implementation sequencing, integration and all reversible technical
  decisions, and the entire git lifecycle. Warwick retains genuine product decisions, consequential
  external actions and merge-to-main. **The specialist defines domain correctness; engineering
  implements.**

## 8. ACCEPTANCE EVIDENCE — what counts, and what has been produced

**Canonical record: `Builds/BUILD-015-.../ACCEPTANCE-AND-EVIDENCE.md`. Assurance receipts:
`Builds/BUILD-015-.../Assurance/`. Neither is restated here.**

Four assurance receipts exist. **Enumerate the directory rather than trusting this table — it goes
stale the moment a receipt is committed, and it has done so once already:**

| Receipt | Head reviewed | Verdict |
|---|---|---|
| `veritas-wp-red-suite-recovery-0f8a1bc.md` | `0f8a1bcd715ac04833534bf014a15563f3df9dff` | **HOLD** |
| `veritas-wp-red-suite-recovery-0f8a1bc-provenance-addendum.md` | same | isolation PROVEN, **HOLD stands** |
| `veritas-gate3-governance-ecfb04b.md` | `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` | **HOLD** — 11 defects, 5 HIGH |
| `veritas-gate3-documentation-d63668f.md` | `d63668f653e233a22b5a28b6eb60f5fb84ecce48` | **HOLD** — 9 defects, 3 HIGH. **This is the live one** |

**The finding-level accounting — severities, which findings fell outside the dispatched scope, and
the disposition of each — is in `Deliverables/NEXT-ASDAIR-SESSION-brief.md` §"THE VERITAS POSITION".
It is not repeated here. The receipt itself is the register.**

**The evidence bar this build is held to, learned the hard way:**

- **A green suite is not evidence a caller exists.** Five separate builders reported "zero production
  callers" about their own work in one night.
- **A join is only proven when deleting it turns the suite RED.** D1's replacement protection clears
  that bar — Veritas reinstated the defect and got 17 failures.
- **A suite reporting zero executed subtests is a FAILURE, never a pass.** Read the count, never the
  exit code.
- **A skip is not a pass.** The 3 skips are the destructive Postgres tests.
- **Component passes do not answer the Gate 2 question** — *«Can Warwick now do the thing this phase
  promised, in the real intended context?»*
- **Larry may not record a phase PASS.** PARTIAL and FAILED are his; **PASS additionally requires a
  Veritas receipt against the exact integrated head.**

## 9. THE EXECUTION ROUTE — phased against the Veritas gates

**Phased against assurance, not narrative progress.** Gate 1 = integrated Work Package · Gate 2 =
phase or vertical slice · Gate 3 = documentation and Git truth. **This table is the six-phase route
Warwick authorised on 2026-08-04** — see the authorisation block at the top of this map for the
quoted words, the provenance and the limits of that record. **His authorisation covers this table.
It does not extend to the map as a document, which he has not read.**

| Phase | Outcome | Gate | The question the gate answers | Status |
|---|---|---|---|---|
| **0** | Gate 3 documentation and Git truth discharged | Veritas Gate 3 | Does every active document agree with the code and with Git? | **IN PROGRESS** |
| **1** | Repository and live database reconciled — migrations 013/014 authored as artefacts, the packet table contract settled | Gate 1 per WP | Does a fresh clone reproduce the live state? | Not started |
| **2** | Execution packet durable — 015 applied, producer wired to a real production caller, persistence and restart proven | **Gate 2** | **Can Warwick's plan survive a process death?** | Not started |
| **3** | Injected end-to-end journey green with duplicate, stale-answer, mutation and restart controls | **Gate 2** | **Photograph → correctly resolved, Brand A–Z, checkout-ready basket, in the real intended context?** | Not started |
| **4** | Documentation reconciled against the implemented journey; one clean PR; CI bound to the exact head | Gate 3 | Is what we say we built what we built? | Not started |
| **5** | Codex external QA within the three-pass maximum, then Pax's final product acceptance | External, then Pax | Would an independent party accept this? | Not started |

**No phase is marked PASS. Phase 0 is IN PROGRESS.**

> **Phase 2's question is the one every green suite in this build has so far failed to answer.** The
> `RESUMABILITY` tests prove no state hides in the deps container; they prove nothing about process
> death. **No row has ever been written to Postgres by this journey.** Treat that as the standing
> risk of the whole build, not a phase-2 detail.

### What sits inside each phase

**Phase 0 — Gate 3, current. Two rounds so far, both HOLD.**

- **Round 1 — `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`, HOLD, 11 defects, 5 HIGH.** `D-G3-01`
  through `D-G3-07` were the correction set; `D-G3-08` through `D-G3-11` were recorded for
  disposition. Corrected at `d63668f`, and **the receipt records `D-G3-03`, `-04`, `-06`, `-07` and
  `-11` as genuinely discharged.**
- **Round 2 — `d63668f653e233a22b5a28b6eb60f5fb84ecce48`, HOLD, 9 defects, 3 HIGH. This is the live
  HOLD.** Documentation truth FAILED a second time: the sole directive document stated a next action
  already complete at the head carrying it (`D-G3-12`), a Warwick authorisation was asserted that the
  estate held no record of (`D-G3-13`), and a remediation was recorded as done that had never been
  written into the artefacts (`D-G3-14`). `D-G3-15` through `D-G3-20` follow. **All nine are assigned
  to `WO-2026-08-04-05`.**

**The receipt is the register of findings — there is no findings ledger and none is to be built.**
Dispositions live in the `veritas_findings` block of the Work Orders under
`Builds/BUILD-015-.../Work Packages/`.

**Phase 1 — repository/live reconciliation.** The remaining D5 documentation classes: **classes 4–8
are outstanding; the verified per-class evidence table is in `NEXT-ASDAIR-SESSION-brief.md` §D5** and
is not copied here, because it goes stale item-by-item inside this phase. Then migrations 013 and 014
as repository artefacts under the settled GL-009 classification, and the packet table contract.

**Phase 2 — durability.** Migration 015 per Silas's recorded schema decision. **Verify the producer's
actual database role before any live application** — the highest-risk unknown in the sequence. Wire
the execution-packet producer into the real production pipeline; **persisting it without wiring it
produces a durable store nothing writes to.** Then prove persistence, read-back and restart against
the strongest safe environment available.

**Phase 3 — the journey.** Photo → interpretation → planning with rules and prior answers consulted
**before** questions → question cards → answers → persistence → packet (Brand A–Z) → handoff → basket
observation → reconciliation → `basket_ready`, with duplicate, stale-answer, mutation and restart
controls. Also in this phase: Keel's delivery half of the Codex closure-enumeration package through
the existing Tower routes.

**Phase 4 — documentation and Git truth.** Reconcile documentation against what was actually
implemented; one clean PR against `main`; CI evidence bound to the exact head, checked **per
workflow** — an unrun workflow vanishes from run lists and looks exactly like a green one.

**Phase 5 — external acceptance.** Codex external QA within the three-execution maximum, then Pax's
final BUILD-015 acceptance. **Pax is a different hat, not a different model:** report its verdict as
independent review by the same model, never as external verification. Merge-to-main is Warwick's
`merge-decision`.

## 10. CURRENT FRONTIER AND THE EXACT NEXT ACTION

**Phase 0, IN PROGRESS. Gate: Veritas Gate 3. BUILD-015 holds an open Gate 3 HOLD — two rounds so
far, the live one against `d63668f653e233a22b5a28b6eb60f5fb84ecce48`. Resolve the current position
with the discharge test below rather than from this sentence.**

> ### THE EXACT NEXT ACTION
>
> **Submit the head that contains this line to Veritas for a Gate 3 re-review, and obtain the
> receipt that does not exist at it.**
>
> **Resolve the head; do not read it from here.** No SHA is written into this block, because the
> head that carries these words cannot be known while they are being written — that is precisely how
> the previous two next-actions went stale.
>
> ```
> git rev-parse HEAD          # this is the head to submit
> ```
>
> The submission carries `WO-2026-08-04-05`, which discharges `D-G3-12` through `D-G3-20` from the
> `d63668f` receipt, on top of the `WO-2026-08-04-01`…`-04` package already committed at `d63668f`.
>
> #### The discharge test — run this BEFORE acting, and believe it over this document
>
> ```
> ls Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/
> ```
>
> **If that directory holds a receipt naming the head you just resolved, this action is already
> done and this map is behind the estate. Stop, read that receipt, and take your next action from
> its verdict** — a `HOLD` names its own correction set, a `PASS` opens phase 1. **If there is no
> such receipt, the action above is outstanding and is yours.**
>
> **Why it is written this way, so it is not "corrected" back.** An action of the form *"integrate
> the uncommitted package"* is **falsified by the very commit that carries it** — it describes work
> that the act of shipping it completes. This action is the opposite shape: **the commit creates its
> subject rather than discharging it.** A receipt for a head cannot exist at that head, so this stays
> true from the moment it is committed until a reviewer answers it.
>
> **The honest limit — this is a detector, not a fix.** Once the receipt exists, this block is stale
> like any other. The only thing bought is that **the reader can discover that unaided, in one
> command**, instead of acting on a stale instruction. **Nothing makes a map self-updating, and
> building something that would is exactly the regrowth the estate has already paid for once.** Do
> not add one.
>
> **Until that receipt exists, the maximum permitted statement is «Integrated at "\<SHA>" and
> submitted to Veritas for assurance.»** Not done, not complete, not ready.

**On `VERITAS_PASS`, phase 0 closes and phase 1 begins.** The six-phase route itself is authorised
(2026-08-04 — see the authorisation block at the top of this map). **The whole route remains
sequenced behind a Gate 3 PASS the estate does not hold**, and a fresh instance should note
separately that **Warwick has not read or accepted this map as a document**.

**This is the only document permitted to state an exact next action.** If another document in
`Deliverables/` appears to state one, that document is the defect — see the precedence block above.

## 11. PARKED AND NON-GOAL WORK

**Parked tangents:** canonical in `Builds/BUILD-015-.../SHIT-TO-DO.md`. Not duplicated.
**Estate-wide items:** `Deliverables/BACKLOG.md`.

**Explicit non-goals, from the goal contract:** no shopping-platform redesign · no generic
agent-platform work · no broader cockpit changes · no new learning behaviour beyond the existing
design · no expansion of the specialist into an implementation engineer.

**Superseded and not to be revived as gaps:** **WO-C** (plan builder) is off the live-runtime critical
path, superseded in purpose by the Sonnet execution packet. **WO-D** (bulk add via the Regulars grid)
is cancelled as live-runtime work — it rested on a description of the proven process Warwick has
since corrected. Neither is deleted from the ledger; a fresh instance should see a decision, not a
gap.

**Deferred with the claim corrected rather than the capability pretended:** rule 7 (budget band) is
structurally unevaluable — no price column exists, so `budget_flag` is permanently `unknown`. The
rule is documented, implemented and dead. **Do not claim budget flagging works until a price source
exists.**

> ### THE REGROWTH CAP APPLIES TO THIS MAP
>
> **A Wayfinder map is a record. It is not an execution tracker, a ticket system or a governance
> layer.** BUILD-018 grew a validator → store → parser → registry around rules it never once
> enforced. **If the response to anything in this map is to build a mechanism, the diagnosis was
> rejected.** No new specialist, service, registry, validator, state machine or control plane.

## 12. RESUMABLE STATE AFTER `/clear` OR A FRESH SESSION

**Say these four things before touching a tool:**

1. **Recovered map** — `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` (this file).
2. **Goal** — `BUILD-015-END-TO-END-RECOVERY`: photograph → ShopperBot → checkout-ready basket, every
   gap closed, integrated, run and proven, with Larry outside the weekly operating path.
3. **Phase and gate** — **phase 0, IN PROGRESS, Veritas Gate 3**, with an open HOLD. **Two Gate 3
   receipts exist and the live HOLD is the later one — enumerate `Assurance/` rather than naming a
   head from here.**
4. **Exact next action** — §10 above, **including its discharge test, which tells you whether §10
   is still outstanding.** Run the test before acting on the action.

**Then verify by execution, not belief:**

```
git rev-parse HEAD          # resolve it; every head named in this map WILL have moved
git status --porcelain      # see the warning below before reading anything into this
gh pr list --state open     # never carry a PR list forward
ls Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/   # the live gate position
```

> #### ⚠️ THE DIRTY WORKING TREE IS NOT A BUILD-015 PACKAGE. DO NOT COMMIT IT AS ONE.
>
> `git status --porcelain` in this checkout returns **pre-existing, unrelated entries that belong to
> no BUILD-015 work package** and have been carried, untouched, across every Gate 3 review. As at
> 2026-08-04 they are:
>
> - `Team Knowledge/.obsidian/community-plugins.json`
> - `services/asdair/skill/planner.js` — **modified flag only; `git diff --numstat` is empty.** A
>   CRLF/LF artefact with no content change. Recorded in both Gate 3 receipts.
> - `services/hub/youtube/persistCapture.mjs`
> - `services/hub/youtube/watch-captures.mjs`
> - `Deliverables/2026-08-03-vlog-build-018-the-governor-episode-LARRY-FIRST-DRAFT-UNAPPROVED.md`
> - two Felix session logs under `Team Knowledge/session-logs/2026/08/`
>
> **No total is given here, deliberately.** A count drifts between the moment it is written and the
> commit that carries it — which is the same mechanism that produced `D-G3-12`. **Identify these by
> path, and treat anything else the command returns as genuinely new work needing its own
> attention.** An earlier version of this section glossed the output as *"four uncommitted packages
> were in flight"*; a fresh instance following it would have committed unrelated files as the Gate 3
> package.

**Two things that will mislead you if you skip them:**

- **The Honcho continuity brief is a POINTER, never the authority.** A stale brief must never
  override this map. Open the map and let it self-correct.
- **The `CLAUDE.md` injected at your session start may not be the file on disk** — see §5 item 7.
  **Read the file, do not trust the injection.**

**Before reading further into the build:** the operational hazards, the hard rules and the
do-not-rebuild warnings are in `Deliverables/NEXT-ASDAIR-SESSION-brief.md`. **Read it before touching
`services/asdair/**` — it is non-directive, and it will still save you a night.**
