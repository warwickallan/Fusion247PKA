---
build: BUILD-015
scope: gate3-documentation-and-git-truth-resubmission
gate: 3
reviewed_sha: d63668f653e233a22b5a28b6eb60f5fb84ecce48
governance_sha: d63668f653e233a22b5a28b6eb60f5fb84ecce48
branch: build-015/live-acceptance-recovery-2026-08-03
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/c--Fusion247PKA/76f29046-649e-43fc-8650-08e4c2b3def7/scratchpad/veritas-g3-d63668f
worktree_head_at_start: d63668f653e233a22b5a28b6eb60f5fb84ecce48
worktree_head_at_end: d63668f653e233a22b5a28b6eb60f5fb84ecce48
worktree_status_clean: true
verdict: HOLD
receipt_sha256: d7dbd99320b979bd44763564361e1633f40dfae8f855a38eb8fe16b401f08d35
reviewed_by: veritas
reviewed_date: 2026-08-04
next_review_trigger: Resubmission of a new exact integrated head after D-G3-12 through D-G3-17 are corrected -- specifically the Wayfinder map's section 10 exact next action and section 12 git-status gloss, SHIT-TO-DO.md:45 and :95-100, wo-g3d's missing AMENDMENTS section, thin-larry.md:35, and ACTIVATION-DEFERRED.md:5/:29.
---

## Scope reviewed

**In scope, as dispatched:** the thirteen files Larry named at `d63668f`.

**Scope I widened, and why.** Gate 3 fires on *every affected active source*. The diff from my last
reviewed head is **fifteen** files, not thirteen — it additionally carries `565351d`'s
`tower-qa-skill.md` and my own `ecfb04b` receipt. Beyond the diff I widened to: **all 89 documents in
`Deliverables/`** (resumption-shaped enumeration, not Larry's four); **the whole BUILD-015 build
record**, because the new precedence block promotes it to "the authority for every BUILD-015 fact";
**all four Work Order artefacts as artefacts**, not as descriptions of work; **every `.claude/agents/`
shim**; and an estate-wide sweep for the two withdrawn premises. **Three of the six blocking findings
below are outside the thirteen files** — in `SHIT-TO-DO.md`, `wo-g3d`, and `ACTIVATION-DEFERRED.md`.

**Deliberately out of scope:** the seven pre-existing dirty entries (verified below as untouched and
unrelated); `565351d`'s Tower skill amendment (Warwick sequenced it separately); Codex's external PR
and release gate; Pax's final BUILD-015 acceptance.

## Evidence provenance

- Isolated export of `reviewed_sha` at
  `…/scratchpad/veritas-g3-d63668f`, created with
  `git archive d63668f653e233a22b5a28b6eb60f5fb84ecce48 | tar -x -C <workspace>` — exit 0, 1,901
  files. No `.git` in the export. **No `git worktree` was created.**
- Repository `git rev-parse HEAD` at start / end — `d63668f653e233…` / `d63668f653e233…`, identical.
- Repository `git status --porcelain` at start / end — **byte-identical**: 4 modified + 3 untracked,
  all pre-existing. Every one left exactly as found. `services/asdair/skill/planner.js` remains
  CRLF-only with an empty `git diff --numstat`, as recorded last review.
- `reviewed_sha` and `governance_sha` are **identical** at this review. My contract and the receipt
  template were loaded from this checkout; neither is touched by the reviewed diff.
- No mutation testing was required — the code tree is unchanged (proved below), so `ecfb04b`'s
  mutation evidence carries forward unaltered.
- No commit, stage, push or mutating git command executed. `private_surface: none`,
  `credential_scope: none`, `live_authority: none` — all honoured. `C:\.fusion247\**` never read.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git rev-parse ecfb04b:services` vs `d63668f:services` | 0 | — | **`faa781b5…` both** — code tree byte-identical |
| `git rev-parse ecfb04b:tools` vs `d63668f:tools` | 0 | — | **`17e1a6b1…` both** — identical |
| `node --test` in `services/asdair/packet` (in the export) | 0 | **104** | 104 pass · 0 fail · 0 skip |
| `ecfb04b` 14-suite run — **reused**, bound by tree identity above | 0 | **1609** | 1606 pass · 0 fail · **3 skipped**, all `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE` |
| PyYAML parse of `keel.md` + `thin-larry.md` frontmatter | 0 | — | both parse; tools grants read back correctly |
| sha256 of the precedence block, 5 documents | 0 | — | **`9388e211…` × 5 — byte-identical, verified** |
| sha256 of the START/RESUME block across 4 wayfinder maps | 0 | — | **`3e1ba529…` × 4 — identical** |
| `gh pr list --state open` | 0 | — | **5 open** (#93 #92 #91 #81 #80); **none for this branch** |
| `git ls-tree -r d63668f` for the six package artefacts | 0 | — | **all six present in the commit** |
| `git status --porcelain` ∩ package paths | 1 | — | **no match** — the package is fully committed |
| `grep -i "recon\|read-only" AGENTS.md` (336 lines) | 1 | — | **no match** — the cited clause does not exist |
| Secret-pattern grep over the full 15-file diff | 0 | — | **clean**; every hit is prose about secret-scan |

**Evidence unavailable, declared by name, never treated as passed:**
1. **`scripts/secret-scan.sh` could not run in the export** — it requires a `.git` directory and
   emitted `fatal: not a git repository` while still exiting 0. **That exit code is meaningless and I
   do not accept it.** I substituted a manual pattern grep over the whole diff (clean). Larry's
   commit-message claim "Secret scan exit 0 over every declared surface" is **unverified by me**.
   *A scanner that exits 0 without scanning is the "unrun CI looks like green CI" failure in a new place.*
2. **No CI run exists at this head.** An absent run is not a passing run.
3. **No live database was reached.** Every live-state claim in the package remains `UNVERIFIABLE OFFLINE`.
4. **Host load of the two edited shims** is not observable from here. Frontmatter parses; that is all
   that is established, and it is not the same property.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | `D-G3-01`–`07` are genuinely addressed as artefact changes. `CLAUDE.md:90/:117/:119` reconciled to `:56` with every dependent rule preserved, and `:119`'s absolute replaced by an explicit open-and-unproven rather than by its opposite — the harder and correct choice. The keel shim carries the grant **and** its refusals, with a dated do-not-restore note naming the receipt: **revert-proof**, which my contract requires and which most corrections here have lacked. |
| Design fidelity | **PASS** | No mechanism grown. `SHIT-TO-DO.md` is a markdown record — no service, store, registry, parser, validator or schema — and it self-limits (*"If that ever looks like it is happening, delete the log and say so"*). The map is a record and says so. Regrowth cap holds. One watch item under Residual risk. |
| Functional proof | **n/a** | Documentation and governance scope. No runtime capability is claimed by it; the suite was executed as provenance, not as proof of a production path. |
| Integration | **HOLD** | **The correction reached the repository and did not reach the consumer.** The `CLAUDE.md` injected into this review's context is the **`ecfb04b` blob**, carrying every one of the three withdrawn-premise passages this package removed (`D-G3-20`). The first hop of the governance journey does not deliver the corrected file. |
| Durability | **n/a** | Nothing durable is claimed. The map states plainly that durability is *"claimed nowhere in this build"* and that recovery from process death is **unproven, not partial** — a correction of the honest kind. |
| Test quality | **PASS** | 104 executed live in the export, non-zero. The 1609/1606/0/3 figure is reused on proof of tree-object identity rather than re-run — evidence reuse, not assumption. The 3 skips are correctly carried as not-passes in four separate documents. |
| Git truth | **PASS** | Branch, head and PR state accurate. Every SHA in the package is 40 characters and resolves (`D-G3-11` discharged). "No PR for this branch; five open estate-wide" verified live (`D-G3-06` discharged). `7ca8c3b`'s "4 HIGH" error is correctly recorded in two active documents as immutable and uncorrectable. |
| Documentation truth | **FAIL** | `D-G3-12` through `D-G3-17`. The sole directive document states an exact next action that is already complete; a false Warwick authorisation is asserted; and a remediation is recorded as done that was never written to the artefacts. |
| Residual risk | **PASS** | The strongest part of the submission again. `UNVERIFIABLE OFFLINE` applied consistently; the live-probe criterion left OPEN in four places under pressure to close it; *"no row has ever been written to Postgres by this journey"* carried as the standing risk of the whole build; the packet's absent production caller stated plainly; and row E's *"half wrong, and the correction must not overshoot"* is precisely the discipline this dimension exists to reward. |

## Production caller and journey

**Governance scope — the journey is the route by which a fresh instance is actually directed.**
Traced hop by hop at this head:

1. Host session start → root `CLAUDE.md`. **The repository file is correct** (`75a19c4b…`, all three
   passages reconciled). **The file delivered to this reviewer was not** — it was `8d865ed1…`, the
   `ecfb04b` blob. **Hop 1 is broken, and it is broken for the exact content this package fixed.**
2. → `Deliverables/` sweep. **Now sound.** The precedence block is byte-identical across all five
   resumption-shaped documents (`9388e211…`), and no sixth carries a competing route. `D-G3-07` is
   properly discharged, and this is the single best piece of work in the package.
3. → the map, precedence entry 2, "the only document that may state the exact next action" →
   **§10 states an action already performed at this head** (`D-G3-12`). **The journey terminates in a
   stale instruction, and by design there is no second document permitted to correct it.**
4. → the build record, precedence entry 1, "the authority for every BUILD-015 fact" →
   `ACTIVATION-DEFERRED.md:5` "**The build is complete and merged**" (`D-G3-17`).
5. → dispatch route: `Team/agent-index.md` → Keel's contract → `.claude/agents/keel.md`. **Now
   reconciled at all three layers**, with the shim revert-proofed. `D-G3-03` genuinely discharged.

**On the journey and sound:** the precedence chain, the keel three-layer reconciliation, the
`CLAUDE.md` repository text, the rotation brief and `NEXT-ASDAIR-SESSION-brief.md` as non-directive
hazard documents.

**Not on the journey:** the four Work Orders. Their `veritas_findings` dispositions are reachable only
by a reader who already knows to open them; no active document routes a fresh instance there. Recorded
because Larry's dispatch treats them as the sanctioned home of the dispositions — as a *register* that
is correct, as a *route* it is not.

## Restart and durability

**n/a** — no durability is claimed by the reviewed scope, and the package is explicit that none exists
in the build either. Recorded: all three skipped tests remain the destructive Postgres tests; the
`RESUMABILITY` suites are correctly described as proving no state hides in the deps container and
**nothing** about process death. No kill-and-revive was owed and none was performed.

## Documentation contradiction scan

**Larry's declared DOCUMENT IMPACT:** 7 changed · 4 created (map, `SHIT-TO-DO.md`, four Work Orders) ·
5 identified-and-deliberately-unchanged (D5 classes 4–8).

**Verified independently — what held.** The withdrawn-premise sweep is genuinely clean: every
surviving instance of *"Larry holds no `Bash`"* or *"never merges, pushes, opens PRs"* is either a
quotation inside a receipt or Work Order, or sits in `Team/Keel .../AGENTS.md:216` where it is
explicitly labelled *"stated as fact, and **false**"*, or in
`Deliverables/2026-07-27-nolan-engineering-hire-recommendation.md` inside "Proposed content. NOT
WRITTEN." blocks under a status line that reclassifies the whole body as reasoning-of-record. **No
active document asserts either premise as operative fact.** That half of the acceptance property is
**met**. The precedence block's byte-identity is real, verified by hash, not by reading.

**What his list missed — the point of the control:**
1. **`SHIT-TO-DO.md` asserts a Warwick authorisation that does not exist** (`D-G3-13`). Not in his
   list because he wrote the file and the claim in the same pass.
2. **`wo-g3d` has no `## AMENDMENTS` section**, contradicting his dispatch's blanket statement that
   all four carry one (`D-G3-15`). Three do; the fourth — the one that produced the directive map — does not.
3. **The invented `AGENTS.md` citation survives in all four orders** while `SHIT-TO-DO.md` records it
   as re-cited (`D-G3-14`).
4. **`ACTIVATION-DEFERRED.md:5`'s completion claim** (`D-G3-17`). He declared that file, but only for
   the exact-string claim at `:74`; `:5` is a different class and was not declared.
5. **`.claude/agents/thin-larry.md:35` overstates Keel's git coverage** (`D-G3-16`) — and this very
   package is the counter-example.
6. **The map's own next action** (`D-G3-12`) — the one thing he asked me to attack, and it is there.

**Active documents that would misdirect a fresh instance:**
- `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:358` — *"Integrate the four-Work-Order
  Gate 3 discharge package **currently uncommitted in the working tree**"*, and `:417` —
  *"`git status --porcelain` # four uncommitted packages were in flight"*.
- `Builds/BUILD-015-…/SHIT-TO-DO.md:45` — *"**Warwick authorised the route on 2026-08-04.**"* and
  *"Nothing outstanding."*
- `Builds/BUILD-015-…/SHIT-TO-DO.md:95-100` — *"it was **re-cited** before the work began."*
- `Builds/BUILD-015-…/ACTIVATION-DEFERRED.md:5` — *"**The build is complete and merged.**"*
- `.claude/agents/thin-larry.md:35` — *"**now covered by a specialist contract**"*.
- Four Work Orders — `permitted_by: "Root AGENTS.md — read-only reconnaissance is unrestricted."`

**Closure claims since the last receipt, and the receipt behind each.** Four commits enumerated in
full (`565351d`, `7ca8c3b`, `cd51ac0`, `d63668f`) plus repository state. **No commit records any Work
Package, phase, build, service or journey as complete, closed, accepted, operational, durable, ready
or production-safe** — `d63668f`'s message carries an explicit `NOT CLAIMED` section. All four Work
Orders are `status: draft`. No phase is marked PASS; the map states `Phase 0 IN PROGRESS` and
`Not started` × 5. `VERITAS_PASS` appears nowhere as an assertion, only as a precondition.
**No closure claim lacks a receipt. No suppressed receipt detected.** The two claims in `D-G3-13` and
`D-G3-14` are a false *authorisation* and a false *remediation* — neither is a closure claim, which is
why this is `HOLD` and not `FAIL`, on the same calibration as `ecfb04b`.

## Answers to the five questions Larry asked me to attack

1. **Relocated, not removed.** The rewrite genuinely cleared `NEXT-ASDAIR-SESSION-brief.md`, and then
   re-created the identical defect in the Wayfinder map — the one document the package designates as
   the sole holder of an exact next action. `D-G3-12`. The `WO-2026-08-04-04` worker warned of exactly
   this class at read-back, in writing, at `SHIT-TO-DO.md:77(a)`: *"the `D-G3-01` class recreated by
   the order convened to close it."* The warning was accepted, and the defect shipped anyway in a
   different sentence of the same document.
2. **The SSOT exception is justified.** Verified byte-identical, and the stated reason survives
   scrutiny: a pointer-stub would require a fresh instance to follow a link *to learn that it opened
   the wrong file*, which defeats the property being bought. This is not a manufactured hazard.
   **The undischarged part** is that adding, renaming or re-ordering a resumption document now
   requires five synchronised edits with no detection route — and building one would breach the
   regrowth cap. Carried as residual risk, not as a defect. The honest position is: accept the
   duplication, accept the drift risk, and do **not** build a checker.
3. **The map, judged hard.** Structurally the best orientation artefact in this estate: all twelve
   required elements, phased against the assurance gates rather than against narrative, retrospective
   phases labelled retrospective, `UNVERIFIABLE OFFLINE` used with discipline, and an unusually honest
   §5. **It fails on the one thing a route document exists to do** — its exact next action is done
   (`D-G3-12`) and its verification hint actively points a fresh instance at seven unrelated dirty
   files. A map that is excellent everywhere except the frontier is still not usable at the frontier.
4. **Warwick is right and you were wrong; the commit message is the artefact at fault.** My `ecfb04b`
   receipt lists eleven defects of which `D-G3-01`–`05` are HIGH: **11 defects, 5 HIGH.** `7ca8c3b`'s
   message says "4 HIGH" and is wrong. Neither you-now nor Warwick is mistaken, and both the rotation
   brief `:66-68` and `NEXT-ASDAIR-SESSION-brief.md:62-64` record this correctly, including that a
   commit message cannot be corrected. That handling is right.
5. **`SHIT-TO-DO.md` is a record, not a mechanism.** Markdown table, no runtime, no schema, no
   validator, cross-references rather than duplicates, and it names its own kill condition. **You did
   not breach the regrowth cap here.** Two things to watch rather than fix: §"THE COMPLETION GATE"
   institutes a **third** completion gate beside `VERITAS_PASS` and Pax's acceptance — that is
   Warwick's instruction rendered faithfully, so it is legitimate, but it is a gate and should be
   named as one; and §3 `REVIEW RECORD` is an empty table awaiting rows, which is the exact shape a
   tracker has on the day before it becomes one. Watch it; do not pre-emptively remove it.

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| D-G3-12 | **HIGH** | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:358` gives THE EXACT NEXT ACTION as *"Integrate the four-Work-Order Gate 3 discharge package **currently uncommitted in the working tree**"*. **All six artefacts are committed at this head** — proved by `git ls-tree -r d63668f`. `:417` compounds it: *"`git status --porcelain` # four uncommitted packages were in flight"*, which at this head returns **seven dirty entries, none belonging to the package** (`services/hub/youtube/**`, an Obsidian config, `planner.js`, a BUILD-018 vlog draft, two Felix session logs). A fresh instance following the map re-does completed work, or commits those seven unrelated files as "the Gate 3 package". **`D-G3-01` relocated into the sole directive document**, and by the package's own design no other document may correct it. | Larry |
| D-G3-13 | **HIGH** | `Builds/BUILD-015-…/SHIT-TO-DO.md:45`: *"**Warwick authorised the route on 2026-08-04.**"* and *"Nothing outstanding."* **Contradicted four times**: the map's `:69` banner *"WARWICK'S ACCEPTANCE OF THE ROUTE IS OUTSTANDING — a `product-decision`"*, `:233`, `:367`, and `wo-g3d:124` *"Writing it is authorised; the route it proposes is not yet agreed"* (restated as AC5 at `:190`). No evidence of route acceptance exists anywhere in the estate. **A false authorisation claim for a `product-decision`, in the file Warwick created as the parked-tangent register** — and the map makes that acceptance the thing blocking phase 1. | Larry |
| D-G3-14 | **HIGH** | `SHIT-TO-DO.md:95-100` records the invented `AGENTS.md` citation as remediated — *"it was **re-cited** before the work began"*. **It was not.** All four orders still carry `permitted_by: "Root AGENTS.md — read-only reconnaissance is unrestricted."` (`wo-g3b:36`, `wo-g3c:59`, `wo-g3d:56`, and in prose at `wo-g3a:114`). Root `AGENTS.md` is 336 lines and `grep -i "recon"` returns **nothing**. This is the defect the same log names two paragraphs earlier — *"an amendment issued in a message is not an amendment until it is in the artefact"* — reproduced a **fourth** time, in the commit that records the lesson. | Larry |
| D-G3-15 | MEDIUM | `wo-g3d-wayfinder-map-and-precedence.md` carries **no `## AMENDMENTS` section** and no record of its CLARIFY anywhere in the artefact; `wo-g3a`, `-b` and `-c` all do. Larry's dispatch states *"every amendment is recorded in an `## AMENDMENTS` section in the order itself."* **False for the one order that produced the directive map**, whose read-back caught six defects including the `D-G3-01` relocation that then shipped. | Larry |
| D-G3-16 | MEDIUM | `.claude/agents/thin-larry.md:35` now claims *"**The repository git lifecycle that `CLAUDE.md` § Git ownership assigns to Larry is now covered by a specialist contract**"* (Keel). Keel's contract rule 5 (`Team/Keel …/AGENTS.md:420-422`) **forbids** editing `AGENTS.md`, `CLAUDE.md`, `.claude/`, `Builds/` and active Wayfinder maps under `Deliverables/**` — every surface in this package. Keel executed none of it; three orders went to `general-purpose` and one to Nolan. Governance and documentation git still has **no contracted owner**, and this line tells Warwick one of the four routes blocking a rebinding decision is settled when it is not. | Larry |
| D-G3-17 | MEDIUM | `Builds/BUILD-015-…/ACTIVATION-DEFERRED.md:5` — *"**The build is complete and merged.**"* — with §*"What IS complete and merged"* at `:29`. Dated, scoped to PR #82, and under a partial-supersession banner; but **the new precedence block promotes the build record to "the authority for every BUILD-015 fact"**, which converts this into an authoritative completion claim contradicting the map's phase 0-of-5, the packet's absent production caller, "no row ever written to Postgres", and the open HOLD. Declared by Larry under D5 class 7 **only for the `:74` exact-string claim**; the completion claim is a different, undeclared class. | Larry |
| D-G3-18 | LOW | `SHIT-TO-DO.md:70` — *"**Three orders issued**, three CLARIFY, zero REFUSE"* — while the table immediately below lists **four** (`WO-2026-08-04-01`…`-04`), all CLARIFY. A countable mismatch in the log whose own pattern 7 is *"envelope fields that are populated but not earned"*. Same class as `D-G3-08`. | Larry |
| D-G3-19 | LOW | `NEXT-ASDAIR-SESSION-brief.md:115` heads its D5 table *"Status at `cd51ac0…`"* and `:253` pins suite counts to `cd51ac0669…` — the **parent** of this head — while rows 1 and 3 read *"ADDRESSED IN THIS REWRITE"*, a rewrite that exists only at `d63668f`. Substantively harmless (services tree object identical across both) but the table's pin does not resolve to the head it describes. | Larry |
| D-G3-20 | LOW — observation, **not** a repository defect | **`D-G3-10` reproduced, and the recorded mechanism is falsified.** The `CLAUDE.md` injected into *this* review's context at session start is blob **`8d865ed166c33920…`** — the **`ecfb04b`** version — carrying *"Under the `thin-larry` grant Larry holds no `Bash`, so…"*, *"The trigger can never appear"*, and Rule 4 **without** its 2026-08-04 provenance line. Repository `HEAD` **and** the on-disk file are both `75a19c4b895a2319…`. **The injected copy matched neither `HEAD` nor the working tree — it matched the previous commit.** That directly contradicts the candidate mechanism recorded at `SHIT-TO-DO.md:49` and map §5 item 7 (*"the injected copy matched the file at `HEAD`, not the working tree"*) and points at caching or snapshotting instead. **This package's `CLAUDE.md` corrections did not reach the agent reviewing them.** Both active records of the mechanism are now wrong and should be widened to "unexplained", not re-narrowed. **The live-probe criterion stays OPEN, and no probe is to be designed.** | Larry to record; Warwick to note |

**Creditable, recorded so the corrections are not over-read.** `D-G3-03`, `D-G3-04`, `D-G3-06`,
`D-G3-07` and `D-G3-11` are **genuinely and well** discharged. The keel shim's dated do-not-restore
note naming this receipt is the first **revert-proof** correction in this build — my contract asks for
that property by name and it has been absent until now. `CLAUDE.md:119` replacing a false absolute
with an explicit *open and unproven*, rather than with its convenient opposite, is the harder and
correct choice. The precedence chain is byte-verified across five files. The rotation brief and
`NEXT-ASDAIR-SESSION-brief.md` are now honest, non-directive and free of struck text. The suite
figures, the skip accounting and the "nothing ran against a real database" statement are exact again.
And the `SHIT-TO-DO` challenge log documents Larry's own three failures of the night by name — that is
the estate working, and it is why three of the six findings above were findable at all.

## Verdict

**HOLD** — the corrective work is substantially real and several parts of it are the best documentation
work in this build, but **documentation truth fails again**: the sole document permitted to state the
route states an action already completed at this head, a Warwick authorisation is asserted that does
not exist, and a remediation is recorded as done that was never written into the four artefacts it
concerns.

**Why HOLD and not FAIL, on the same calibration as `ecfb04b`.** The closure enumeration is clean —
no Work Package, phase, build, service or journey is recorded complete anywhere, all four orders are
`status: draft`, no phase is marked PASS, and `d63668f`'s own message carries an explicit `NOT CLAIMED`
section. `D-G3-13` and `D-G3-14` are a false *authorisation* and a false *remediation*, not false
*completion* claims. This remains inconsistency and unwritten-back correction, not concealment.

**On the standing instruction not to pass this to let work continue:** it does not deserve a PASS, and
the single most consequential finding is again a resumption hazard — this time inside the document
built to eliminate resumption hazards.

**On my own scope, stated so it can be audited:** three of the six blocking findings sit outside the
thirteen files dispatched. Larry predicted the widening would be necessary and it was.

## Next review trigger

Resubmission of a **new exact integrated head** after `D-G3-12` through `D-G3-17` are corrected —
specifically: the map's §10 exact next action rewritten so it states work genuinely outstanding at the
head that carries it, and §12's `git status` gloss corrected; `SHIT-TO-DO.md:45`'s authorisation claim
withdrawn and `:95-100`'s remediation claim made true **in the four artefacts**;
`wo-g3d`'s amendments written to disk; `thin-larry.md:35` narrowed to what Keel's contract actually
permits; and `ACTIVATION-DEFERRED.md:5`/`:29` either scoped to the 2026-07-28 merge event or marked
non-operational throughout. `D-G3-18` through `D-G3-20` are recorded for disposition and do not by
themselves require a new head — but `D-G3-20` should be carried into the next rotation brief, because
it is now the second time a corrected governance record has failed to reach the agent relying on it.
