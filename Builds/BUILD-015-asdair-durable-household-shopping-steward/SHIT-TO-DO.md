# BUILD-015 — SHIT TO DO

**Warwick's instruction, 2026-08-04:** park tangents here, keep a log here of why Work Orders get
rejected, and **review this file before anyone says the build is complete.**

> ## THE COMPLETION GATE
>
> **This file is reviewed before BUILD-015 is described as complete, and the review is recorded.**
> Nothing here blocks a completion by itself — a parked item may be closed as won't-fix with a reason —
> but an *unreviewed* list does. Larry cannot declare the build complete in any case: that needs a
> `VERITAS_PASS` on the exact integrated head and Pax's final product acceptance. This gate sits
> underneath both, not beside them.

**Where things live, so this file does not become a competing list:**

- **Here** — tangents raised during BUILD-015 that have no other owner, and the Work Order challenge log.
- **`Deliverables/BACKLOG.md`** — estate-wide feature requests, bugs, and items held by Larry with no
  other owner. Anything not specific to BUILD-015 goes there, not here.
- **The directive resumption brief's DECISIONS WAITING ON WARWICK** — anything needing Warwick's ruling.
  Items are **cross-referenced from here, never duplicated into here.** SSOT golden rule.
- **The Veritas receipts under `Assurance/`** — the register of assurance findings. There is no findings
  ledger and none is to be built.

**The rule, from `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md`:** when Warwick drags Larry
off-plan mid-build — and he will, and he knows he does — the tangent gets written here and the plan
continues. It gets worked at the **end**, not the moment it is mentioned. Warwick has explicitly asked to
be told to wait, so doing it is compliance, not insubordination.

---

## 1. PARKED TANGENTS

An item leaves this list in exactly two ways: it becomes an authorised Work Order, or it is explicitly
closed as won't-fix with a reason. **"Larry is holding it in his head" is not holding it.**

**Larry recommends a disposition. He never decides one.** A parked list is Warwick's decision queue.

| # | Item | Raised | Source | Recommendation | Status |
|---|---|---|---|---|---|
| 1 | **Six agent shims over-claim `MultiEdit`, which this host does not deliver** — `cairn`, `felix`, `mack`, `nolan`, `silas`, `warden`. Re-confirmed live 2026-08-04 by Nolan's own instantiation, which requested it and was not granted it. Same defect class as the note frozen at `.claude/agents/keel.md:4-9`: a shim must not claim tools it does not get. | 2026-08-04 | Nolan's sibling-shim sweep, WO-2026-08-04-01 | Correct each at the next authorised touch of that shim. Not worth a dedicated dispatch. | OPEN |
| 2 | **Seven shims are entirely silent on git authority** — `felix`, `vera`, `vex`, `silas`, `mack`, `pax`, `penn` — while receiving Work Orders that carry `worktree` and `branch` fields. Silence is not an over-grant, so this is an omission class rather than a contradiction. | 2026-08-04 | Nolan's sibling-shim sweep, WO-2026-08-04-01 | Decide once whether shim silence on git means "no authority" by default, then state it in one place rather than seven. **Do not build a mechanism for it.** | OPEN |
| 3 | **`Team/Nolan - HR/AGENTS.md` §6 and its never-list are written around hires, not around maintaining an existing shim after its wiki contract changes.** Nolan did WO-2026-08-04-01 substantively correctly, but the contract basis was thinner than the Work Order frontmatter implied. | 2026-08-04 | Nolan, WO-2026-08-04-01 out-of-scope finding (MEDIUM) | Needs an `AGENTS.md` edit, reserved to Warwick. Cross-referenced in the directive documents' decision list — see it there, this row is the pointer. | WITH WARWICK |
| 4 | **`.claude/agents/thin-larry.md:33`** says *"As at 2026-08-02 no such binding is committed"* — dated and true, but it does not carry root `CLAUDE.md` Rule 4's history that the binding **was** installed, damaged Larry/team MCP operation, and Warwick removed it deliberately. A reader of the shim alone gets a thinner story than the constitution tells. | 2026-08-04 | Nolan, WO-2026-08-04-01 out-of-scope finding (LOW) | Fold the one-line history in at the next authorised touch. Low value, low risk. | OPEN |
| 5 | **`Deliverables/2026-07-27-nolan-engineering-hire-recommendation.md` still carries the withdrawn "Never merges, pushes, opens PRs" wording** in three places. It is an explicitly historical reasoning document, already superseded by `Team Knowledge/Templates/work-order.md`, so it is not an active instruction. | 2026-08-04 | Larry's own sweep; independently confirmed by the WO-2026-08-04-02 worker | **Leave it.** Correcting a dated historical record would falsify it. Recorded so a future sweep does not re-raise it as a live defect. | CLOSED — won't-fix, by design |
| 6 | **BUILD-015 had no Wayfinder map.** Verified absent 2026-08-04 across `Deliverables/`, the build record and every branch. **Written**: `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`, 430 lines, all twelve required elements, phased against the Veritas gates. **Warwick authorised the route on 2026-08-04.** The precedence chain was re-seated across five documents in the same pass so the map did not become a fifth competitor. | 2026-08-04 | Warwick, direct instruction | Nothing outstanding. **Not "complete"** — it rides in the Gate 3 package and is subject to the same `VERITAS_PASS` as everything else in it. | DELIVERED — IN THE GATE 3 PACKAGE |
| 7 | **Honcho's privacy scrubber silently blanks the two most orienting continuity fields.** The `RESTRICTED` regex in `tools/governor/continuity.mjs:52` (`health\|medical\|diagnos\|salary\|wage\|bellrock\|password\|secret\|api[_-]?key\|token\|passport\|dob\|national insurance\|nino`) has **no word boundaries and no allowlist**, so ordinary engineering vocabulary trips it — `token` and `secret` appear constantly in governance and footer work, and `dob`/`nino`/`wage` match inside longer words. For roughly twelve hours the continuity brief rendered `focus` and `warwick_last_request` as `[withheld: restricted per privacy rules]`, showing a fresh instance no statement of what it was doing and no record of what Warwick last asked. **It fails silently and the placeholder reads as deliberate protection**, which is why it survived a rotation unnoticed. | 2026-08-04 | Larry, answering Warwick's "confirm Honcho is working correctly" | Add word boundaries and an allowlist for engineering vocabulary; make a scrub **visible as a scrub** rather than indistinguishable from a deliberate withholding. **This is a bug fix to an existing tool, not new machinery** — do not build a scrubbing service around it. Not done mid-package: `continuity.mjs` is load-bearing and this deserves its own change with its own proof. | OPEN |
| 8 | **A `D-G3-01`…`D-G3-11` disposition table lives in `NEXT-ASDAIR-SESSION-brief.md`.** `Team Knowledge/Templates/work-order.md` is explicit that the receipt's own IDs are the register and that **there is no findings ledger and none is to be built.** The dispositions now also live in four Work Orders' `veritas_findings` blocks, which is the sanctioned home, so the brief's copy is redundant. | 2026-08-04 | WO-2026-08-04-04 worker, flagged not fixed | Redundant rather than harmful today, and removing it is a judgement about the register that is Warwick's rather than a worker's. **Recommendation: delete it at the next authorised touch of the brief**, leaving the receipt path and the Work Order ids. Watch it: a per-finding table in a resumption brief is a ledger growing quietly. | WITH WARWICK |
| 9 | **`Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md:112` carries a 7-character SHA `1cb73e8`** (resolves to `1cb73e81a185044c93b19fd304d0482c4abdf570`). Pre-existing, written by nobody in this package. AC7 (every SHA 40 characters, resolved) and AC10 (that file changes only by the precedence block) collide on it. | 2026-08-04 | WO-2026-08-04-04 worker | Expand it at the next authorised touch of that file. It resolves today, so it misleads nobody now — but a short SHA is an identifier that stops resolving the moment history is rewritten. | OPEN |
| 10 | **The host appears to inject the COMMITTED `CLAUDE.md` into a subagent's context, not the working tree.** A dispatched worker's injected copy carried the superseded `:90` wording and lacked Rule 4's correction, matching `HEAD`'s blob rather than the on-disk file. If it holds, **every uncommitted correction is invisible to every subagent** — a sharper mechanism than the receipt's `D-G3-10`, which recorded only that a corrected record need not reach a fresh agent. | 2026-08-04 | WO-2026-08-04-04 worker, reproduced live in its own dispatch | **One observation with a mechanism, not established host behaviour.** Recorded as fog in the map. Practical consequence, already acted on: commit corrections sooner rather than accumulating them. **Do not design a probe** — that stays Nolan's, on Warwick's word. The live-probe criterion remains OPEN. | OPEN |

---

## 2. WORK ORDER CHALLENGE LOG

**Why this log exists.** Larry's measured failure signature is **asserting facts he has not executed**, and
the estate's measured failure mode is **the order, not the work**. Workers have repeatedly protected the
outcome from mistakes in Larry's instructions. Every `REFUSE` and every `CLARIFY` is therefore a data
point about the *order*, and losing it wastes the most expensive lesson available.

**What gets logged:** every read-back returning `REFUSE` or `CLARIFY`, and every occasion a worker catches
a false statement in a Work Order or in one of Larry's messages. A `CLARIFY` counts — it is a rejection of
the order as written.

**What this log is NOT:** a scoreboard, a quality metric, or a thing to optimise. **The target is fewer
preventably invalid dispatches, never fewer refusals.** A worker that stops challenging because a log
exists has made this file harmful. If that ever looks like it is happening, delete the log and say so.

### 2026-08-04 — Veritas Gate 3 discharge package (this session)

Three orders issued, **three CLARIFY, zero REFUSE, zero clean ACCEPT.**

| Work Order | Worker | Verdict | Why the order was rejected as written |
|---|---|---|---|
| `WO-2026-08-04-01` — Keel host shim | Nolan | **CLARIFY** | **(a)** AC1 and AC2 contradicted each other on the same sentence: AC2 ordered the routing list preserved, AC1 forbade any statement prohibiting what the contract authorises, and `:3`'s *"Not for … integration/merge (Larry)"* was both. **(b)** AC6 required a dated provenance note while AC3 froze the only obvious place to put it. **(c)** The order granted execution authority **without its matching refusals** — force-push, branch deletion, `main`, the `merge-decision` precondition — which over-grants by omission. **(d)** AC5 demanded proof the shim "still loads as an agent definition", which a dispatched subagent structurally cannot produce. **(e)** `contract_basis` carried no entry for any of the four required non-file actions, though the template mandates one per action. |
| `WO-2026-08-04-02` — root `CLAUDE.md` | general-purpose | **CLARIFY** | **(a)** AC8 required a provenance line and never said where it goes. **(b)** The order quoted the `:119` correction starting one sentence too late, which would have deleted the false argument and left its false conclusion standing. **(c)** Whether `:56` was editable at all was unstated. **(d)** The order did not anticipate that removing the false premise would expose a live contradiction with root `AGENTS.md` §3, which retains Larry's authority to act personally on integration, merges and git surgery. The worker raised it rather than resolving it, which is what `CLAUDE.md` §"Source of truth" requires. |
| `WO-2026-08-04-03` — four resumption briefs | general-purpose | **CLARIFY** | **(a)** **The prescribed FRONTIER opened with an item the order itself said was sequenced behind a Gate 3 PASS the estate does not hold — so the order's own acceptance property could not be satisfied.** **(b)** AC4's proof grep returns five files, not one, because three other builds' maps use the same phrase — a false red at the gate. **(c)** AC5 read as a string ban would have deleted its own correction sentence. **(d)** AC6 (every SHA 40 characters) collided head-on with AC10 (change that file only by the precedence block). **(e)** The instruction to copy the orientation block verbatim would have imported three statements that are false inside a brief. **(f)** The deliberately four-way-duplicated precedence block breaches the SSOT golden rule unless it says why. **(g)** The block's markdown `> ` prefixes would have rendered its heading as quoted text rather than a heading. |
| `WO-2026-08-04-04` — Wayfinder map + precedence | general-purpose | **CLARIFY** | **(a)** AC10 froze two documents whose pointer sentences the order's own outcome made false — it would have shipped two active documents sending a fresh instance to hunt a next action in a file that no longer had one, **the `D-G3-01` class recreated by the order convened to close it**. **(b)** AC3 was unprovable as written: entry 1 of the precedence chain is a *directory* of fifteen documents, several legitimately imperative, which no grep can discriminate. **(c)** The order left two competing routes alive — the map's phase table and the brief's twelve-item frontier, the same work in two orderings. **(d)** `contract_basis` cited a clause of root `AGENTS.md` that **does not exist** — Larry wrote a gloss and attributed it. **(e)** The order under-described the brief edit: §STARTUP / ORIENTATION also became false, not just the next-action section. **(f)** Larry's "all three current maps carry the block" was incomplete — it is four by hash, and a fifth wayfinder-named plan does not carry it at all. |

**One further catch, not a Work Order defect but the same class.** In answering Nolan's read-back, Larry
wrote *"`:17` you assessed as correct-as-written and I agree"*. **Nolan made no such assessment** — that
assessment came from the `WO-2026-08-04-02` worker, and Larry conflated the two returns. Nolan flagged the
invented attribution rather than accepting the credit. Left unchallenged it would have entered the record
as a verification that never happened, **inside the package convened to remove exactly that defect.**

**And a second, caught by the `WO-2026-08-04-03` worker.** Larry amended `WO-2026-08-04-01` at
read-back acceptance — adding `.claude/agents/thin-larry.md` to its `file_surface`, plus six other
rulings — **verbally, in a dispatch message, and never wrote the amendment into the artefact.** A
sibling worker then observed a modified file that no order on disk authorised. **This is precisely
the defect the `worker_contract` / `contract_basis` / `capability_evidence` block was introduced to
prevent**, recorded in `7f83d4c` as *"bound to the Work Order artefact rather than to Larry's
memory"* — and Larry reproduced it in the same session, in the package convened to discharge the
findings about it. All three orders were amended on disk before integration. **The rule that
follows: an amendment issued in a message is not an amendment until it is in the artefact.**

**And a third — same signature, third shape, one night.** `WO-2026-08-04-04`'s `contract_basis`
cited root `AGENTS.md` with the gloss *"read-only reconnaissance is unrestricted."* **No such clause
exists in that file.** Larry wrote a plausible-sounding justification and attributed it to a
document he had not checked. The permission was never in doubt — SOP-022 §"Phase 2 — the preflight"
mandates exactly those actions — so this was a **defective citation, not a defective grant**, and it
was re-cited before the work began. Taken together the three are one failure wearing three costumes:
an amendment issued in a message and never written to the artefact · an assessment attributed to a
worker who never made it · a clause attributed to a document that does not contain it. **All three
are "asserting a fact not executed", which is the failure signature the whole estate is built
around, and all three were caught by workers rather than by Larry.**

**One instrument defect, logged because it nearly produced a false green.** The `WO-2026-08-04-04`
worker hashed file regions through `sed`, which on this machine's Git Bash strips `CR`. The four
briefs were CRLF in the working tree and its splice rewrote them LF — **a hash taken through `sed`
cannot see that.** It surfaced only because an AC10 pre-image hash refused to reproduce and the
worker chased it instead of waving it through. Harmless in the end (`core.autocrlf=true`, no
`.gitattributes`, `git diff --ignore-cr-at-eol` identical to plain), but the lesson generalises:
**this is the CRLF trap the rotation brief warns about, arriving through the measuring instrument
rather than through the edit.** Verify a line-ending claim with something that can see line endings.

### Earlier rounds — recorded, not re-derived

- **2026-08-04, pre-rotation (recorded in `7f83d4c`'s commit message).** Six Work Orders drew **four
  REFUSE and two CLARIFY. Every challenge was correct.** Most starkly, Larry sent Keel a documentation
  order whose surface Keel's permanent contract categorically forbids, and paid for a full specialist
  dispatch to discover it. **A Work Order cannot override a permanent contract.** That round produced the
  `worker_contract` / `contract_basis` / `contract_conflicts` / `capability_evidence` block.
- **2026-07-28/29 (recorded in `Team Knowledge/SOPs/SOP-022-work-order-preflight.md` §"Why this exists").**
  Five defective orders in one session; **workers caught all five; none gamed a criterion.** The four
  named defects: a definition-of-done that fails on this machine's Node; **an acceptance command that
  passes on nothing** — a `node --test "<glob>"` matching no files exits 0 having run zero tests, so a
  stale path reports success; a writer told to use `ASDAIR_DB_URL`, which is contractually SELECT-only;
  and an order assuming one database when there are two.

### The patterns, as they actually appear

Derived from the log above, not asserted in advance. Each is a thing to check **in the order, before
dispatch** — not a checklist to add to the template.

1. **Acceptance criteria that fight each other.** Three separate instances on 2026-08-04 alone
   (AC1/AC2, AC3/AC6, AC6/AC10). Two ACs written at different moments about the same sentence.
2. **Acceptance criteria written as string-matches instead of as claims.** AC4 and AC5 both. A criterion
   that greps for a string will fire on the correction as readily as on the defect.
3. **Asking for a proof the worker's position structurally cannot produce.** AC5's host-load.
4. **Prescribing work that is sequenced behind a gate the estate does not hold.** The clearest single
   defect of the session, and it sat in the acceptance property.
5. **Granting an authority without its matching refusals.** Half a boundary reads as a whole one.
6. **Asserting a fact not executed** — the standing signature. On 2026-08-04 it took the form of an
   invented attribution in a message rather than a false claim in an order.
7. **Envelope fields that are populated but not earned.** A missing `contract_basis` action entry; a
   `governance_sha` anchoring a contract that did not contain the cited field at that commit.
8. **A citation to a clause that does not exist.** Distinct from a wrong fact: the *permission* was
   real and the *attribution* was invented. A reader checking the citation finds nothing and cannot
   tell whether the grant is absent or merely mis-cited.
9. **An instrument that cannot see the property it is being used to verify.** A `sed`-based hash
   over CRLF files. The check passes, and it passes for a reason unrelated to what was being
   checked.

**The recurring root cause across 1-4:** Larry writes the criteria from what he wants to be true at the
end, rather than from what a worker standing at the start can actually check. *A populated field is not a
performed check.*

---

## 3. REVIEW RECORD

**No review has been performed yet.** The first entry goes here when BUILD-015 first approaches a
completion claim. A review records: the date, who performed it, every open item and its disposition, and
the exact head reviewed against.

| Date | Reviewer | Head | Open items at review | Outcome |
|---|---|---|---|---|
| — | — | — | — | Not yet reviewed |
