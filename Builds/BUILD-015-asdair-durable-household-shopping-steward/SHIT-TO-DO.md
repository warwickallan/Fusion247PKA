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
| 6 | **BUILD-015 had no Wayfinder map.** Verified absent 2026-08-04 across `Deliverables/`, the build record and every branch. **Written**: `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`, all twelve required elements, phased against the Veritas gates. **Warwick authorised the six-phase route on 2026-08-04; he has NOT read or accepted the map as a document.** The single record of that authorisation — its quoted words, its provenance, and the fact that it is attested by Larry and not verifiable from the repository — is the authorisation block at the top of the map. **This row is a pointer to it, not a second record.** The precedence chain was re-seated across five documents in the same pass so the map did not become a fifth competitor. | 2026-08-04 | Warwick, direct instruction | **Outstanding: Warwick's acceptance of the map as a document**, which is a different decision from the route and has not been made. **Not "complete"** — it rides in the Gate 3 package and is subject to the same `VERITAS_PASS` as everything else in it. | ROUTE AUTHORISED · MAP NOT ACCEPTED · IN THE GATE 3 PACKAGE |
| 7 | **Honcho's privacy scrubber silently blanks the two most orienting continuity fields.** The `RESTRICTED` regex in `tools/governor/continuity.mjs:52` (`health\|medical\|diagnos\|salary\|wage\|bellrock\|password\|secret\|api[_-]?key\|token\|passport\|dob\|national insurance\|nino`) has **no word boundaries and no allowlist**, so ordinary engineering vocabulary trips it — `token` and `secret` appear constantly in governance and footer work, and `dob`/`nino`/`wage` match inside longer words. For roughly twelve hours the continuity brief rendered `focus` and `warwick_last_request` as `[withheld: restricted per privacy rules]`, showing a fresh instance no statement of what it was doing and no record of what Warwick last asked. **It fails silently and the placeholder reads as deliberate protection**, which is why it survived a rotation unnoticed. | 2026-08-04 | Larry, answering Warwick's "confirm Honcho is working correctly" | Add word boundaries and an allowlist for engineering vocabulary; make a scrub **visible as a scrub** rather than indistinguishable from a deliberate withholding. **This is a bug fix to an existing tool, not new machinery** — do not build a scrubbing service around it. Not done mid-package: `continuity.mjs` is load-bearing and this deserves its own change with its own proof. | OPEN |
| 8 | **A `D-G3-01`…`D-G3-11` disposition table lives in `NEXT-ASDAIR-SESSION-brief.md`.** `Team Knowledge/Templates/work-order.md` is explicit that the receipt's own IDs are the register and that **there is no findings ledger and none is to be built.** The dispositions now also live in four Work Orders' `veritas_findings` blocks, which is the sanctioned home, so the brief's copy is redundant. | 2026-08-04 | WO-2026-08-04-04 worker, flagged not fixed | Redundant rather than harmful today, and removing it is a judgement about the register that is Warwick's rather than a worker's. **Recommendation: delete it at the next authorised touch of the brief**, leaving the receipt path and the Work Order ids. Watch it: a per-finding table in a resumption brief is a ledger growing quietly. | WITH WARWICK |
| 9 | **`Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md:112` carries a 7-character SHA `1cb73e8`** (resolves to `1cb73e81a185044c93b19fd304d0482c4abdf570`). Pre-existing, written by nobody in this package. AC7 (every SHA 40 characters, resolved) and AC10 (that file changes only by the precedence block) collide on it. | 2026-08-04 | WO-2026-08-04-04 worker | Expand it at the next authorised touch of that file. It resolves today, so it misleads nobody now — but a short SHA is an identifier that stops resolving the moment history is rewritten. | OPEN |
| 10 | **A corrected `CLAUDE.md` does not reliably reach a fresh agent. UNEXPLAINED — three observations across three sessions, three different relationships to the repository, and no mechanism consistent with all three.** (1) Veritas at `ecfb04b`: injected text superseded while the on-disk blob was current. (2) Veritas at `d63668f653e233a22b5a28b6eb60f5fb84ecce48`: injected blob was `8d865ed166c339208a94a425e1a508115b556c04`, the `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` version — neither `HEAD` nor the working tree. (3) A dispatched worker at `c9b04cfa3e74b7fb6621f720a0afeca131cfedbb`, 2026-08-04: injected blob was **`8d865ed166c339208a94a425e1a508115b556c04` again**, while `HEAD:CLAUDE.md` was `75a19c4b895a23190f43a20412c156641adbcc4f`, the on-disk file was `75a19c4b895a23190f43a20412c156641adbcc4f`, **and the previous commit `d63668f653e233a22b5a28b6eb60f5fb84ecce48:CLAUDE.md` was also `75a19c4b895a23190f43a20412c156641adbcc4f`** — a blob four commits back. **Every SHA here is 40 characters and resolves through `git rev-parse --verify`.** **Two candidate mechanisms have been recorded and BOTH are falsified:** "matched the file at `HEAD`" (this row's own earlier wording) by observations 2 and 3, and "matched the previous commit" (the `d63668f` receipt's replacement) by observation 3. | 2026-08-04 | `D-G3-10`; `D-G3-20`; and the `WO-2026-08-04-05` worker, first-person in its own dispatch | **Do not re-narrow this to a third mechanism.** Caching or snapshotting is a hypothesis, not a finding — the first two guesses are exactly how this row and the receipt both came to be wrong. **A real limit on the evidence: all three observations are first-person reports of an agent's own injected context, and none is reproducible from the repository.** Practical consequence, already acted on: commit corrections sooner rather than accumulating them. **DO NOT DESIGN A PROBE** — that stays Nolan's, on Warwick's word. The live-probe criterion remains OPEN. | OPEN — UNEXPLAINED |

| 11 | **`scripts/secret-scan.sh` exits 0 when it cannot scan.** In Veritas's isolated export of `d63668f` — created by `git archive`, so with no `.git` directory — the script printed `fatal: not a git repository` and **still returned 0**. Veritas refused the exit code and substituted a manual pattern grep. **Consequence: every "secret scan exit 0" produced outside a git working tree in this estate is unevidenced**, including the claim in `d63668f`'s own commit message. This is *"unrun CI looks like green CI"* arriving inside a control that other controls lean on. | 2026-08-04 | Veritas, `veritas-gate3-documentation-d63668f.md` §"Evidence unavailable" item 1 | **Make it exit non-zero when it cannot scan** — the script already has a `not_scanned` path and an `exit 2` convention for exactly this, so the fix is to route the `git rev-parse --show-toplevel` failure into it rather than to build anything. **NOT fixed here and deliberately so:** it is outside this order's surface, it is a control, and **a control changed in passing is how a false green is created.** It needs its own change with its own mutation proof. *Not reproduced by the `WO-2026-08-04-05` worker — inherited from Veritas's evidence, which is first-hand.* | OPEN |
| 12 | **The Veritas receipt integrity digest produces a FALSE TAMPER SIGNAL on a clean clone.** Every receipt carries `receipt_sha256` over its body. The receipts are committed as **LF** blobs, but this repository runs `core.autocrlf=true` with **no `.gitattributes`**, so a fresh Windows checkout materialises them with **CRLF** and the recomputed digest will not match. Verified at `c9b04cfa3e74b7fb6621f720a0afeca131cfedbb`: the digest `d7dbd99320b979bd44763564361e1633f40dfae8f855a38eb8fe16b401f08d35` (a SHA-256 content digest, not a git object id, so it does not resolve through `git rev-parse`) reproduces against the working file, the staged blob **and** the committed blob — **but only because that working file was written by Veritas in-session and has never been through a checkout.** A future verifier who clones and recomputes gets a mismatch and may reasonably conclude the receipt was tampered with. | 2026-08-04 | Larry, `WO-2026-08-04-05` | **The digest is only meaningful against the blob** (`git show <sha>:<path>`), never against a checked-out working file. Fix by either stating that in the receipt template in terms, **or** adding a `.gitattributes` entry pinning `Assurance/*.md` to `eol=lf`. **NOT done here and deliberately so:** a `.gitattributes` entry changes line-ending behaviour for a whole path class and belongs in its own change with its own proof, and the receipt template is out of surface. | OPEN |

> ### THE PATTERN BEHIND ROWS 11 AND 12 — one failure wearing two faces
>
> **Row 11 reports success it did not earn** — exit 0 having scanned nothing. **Row 12 reports
> failure that did not happen** — a digest mismatch with nothing wrong. Opposite directions, same
> root: ***a control is not evidence until it has been made to fail on purpose*** — and neither of
> these two ever had been.
>
> **A tamper-evidence control that fires on a clean clone is worse than no control**, because the
> first false positive teaches everyone to ignore the next one, and the next one might be real. The
> same holds for row 11 from the other side: a scanner that greens over nothing teaches everyone
> that green means safe.
>
> **Neither is fixed in `WO-2026-08-04-05`, by explicit instruction.** Recording a control defect
> and repairing it are different acts, and repairing one in passing — inside a package whose whole
> subject is false assurance — is how the next false green gets made.

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

**Five orders issued, five CLARIFY, zero REFUSE, zero clean ACCEPT.** Four in the first round
(`WO-2026-08-04-01`…`-04`) and one corrective order after the second Gate 3 HOLD
(`WO-2026-08-04-05`).

| Work Order | Worker | Verdict | Why the order was rejected as written |
|---|---|---|---|
| `WO-2026-08-04-01` — Keel host shim | Nolan | **CLARIFY** | **(a)** AC1 and AC2 contradicted each other on the same sentence: AC2 ordered the routing list preserved, AC1 forbade any statement prohibiting what the contract authorises, and `:3`'s *"Not for … integration/merge (Larry)"* was both. **(b)** AC6 required a dated provenance note while AC3 froze the only obvious place to put it. **(c)** The order granted execution authority **without its matching refusals** — force-push, branch deletion, `main`, the `merge-decision` precondition — which over-grants by omission. **(d)** AC5 demanded proof the shim "still loads as an agent definition", which a dispatched subagent structurally cannot produce. **(e)** `contract_basis` carried no entry for any of the four required non-file actions, though the template mandates one per action. |
| `WO-2026-08-04-02` — root `CLAUDE.md` | general-purpose | **CLARIFY** | **(a)** AC8 required a provenance line and never said where it goes. **(b)** The order quoted the `:119` correction starting one sentence too late, which would have deleted the false argument and left its false conclusion standing. **(c)** Whether `:56` was editable at all was unstated. **(d)** The order did not anticipate that removing the false premise would expose a live contradiction with root `AGENTS.md` §3, which retains Larry's authority to act personally on integration, merges and git surgery. The worker raised it rather than resolving it, which is what `CLAUDE.md` §"Source of truth" requires. |
| `WO-2026-08-04-03` — four resumption briefs | general-purpose | **CLARIFY** | **(a)** **The prescribed FRONTIER opened with an item the order itself said was sequenced behind a Gate 3 PASS the estate does not hold — so the order's own acceptance property could not be satisfied.** **(b)** AC4's proof grep returns five files, not one, because three other builds' maps use the same phrase — a false red at the gate. **(c)** AC5 read as a string ban would have deleted its own correction sentence. **(d)** AC6 (every SHA 40 characters) collided head-on with AC10 (change that file only by the precedence block). **(e)** The instruction to copy the orientation block verbatim would have imported three statements that are false inside a brief. **(f)** The deliberately four-way-duplicated precedence block breaches the SSOT golden rule unless it says why. **(g)** The block's markdown `> ` prefixes would have rendered its heading as quoted text rather than a heading. |
| `WO-2026-08-04-04` — Wayfinder map + precedence | general-purpose | **CLARIFY** | **(a)** AC10 froze two documents whose pointer sentences the order's own outcome made false — it would have shipped two active documents sending a fresh instance to hunt a next action in a file that no longer had one, **the `D-G3-01` class recreated by the order convened to close it**. **(b)** AC3 was unprovable as written: entry 1 of the precedence chain is a *directory* of fifteen documents, several legitimately imperative, which no grep can discriminate. **(c)** The order left two competing routes alive — the map's phase table and the brief's twelve-item frontier, the same work in two orderings. **(d)** `contract_basis` cited a clause of root `AGENTS.md` that **does not exist** — Larry wrote a gloss and attributed it. **(e)** The order under-described the brief edit: §STARTUP / ORIENTATION also became false, not just the next-action section. **(f)** Larry's "all three current maps carry the block" was incomplete — it is four by hash, and a fifth wayfinder-named plan does not carry it at all. |
| `WO-2026-08-04-05` — second Gate 3 discharge (`D-G3-12`…`-20`) | general-purpose | **CLARIFY** | **(a)** **The order's own proof of `D-G3-14` was fabricated** — see the fifth instance below. **(b)** The order said the tree carries "seven unrelated dirty files"; `git status --porcelain` returns **eight** entries, the eighth being the order's own untracked file. A count that drifts between drafting and commit is the `D-G3-12` mechanism in miniature. **(c)** `D-G3-14`'s site list was incomplete: **six** sites, not four — `wo-g3d:58` inherits the invented clause through "As above", and `wo-g3d:60` is a *separate* invented citation of root `AGENTS.md` for a required-evidence rule that lives in `Templates/work-order.md` §"Body sections". AC4 says *anywhere*. **(d)** A **seventh** unprovable citation nobody had named: `wo-g3b:34` cites `BUILD-015-AUTONOMOUS-RECOVERY-RESTART`, which `grep -rn` finds **only in the citation itself** — a Warwick ruling ID, real but unverifiable from the estate, the `D-G3-13` class again. **(e)** The order's `contract_basis` for `.claude/agents/thin-larry.md` claimed Warwick's explicit written authorisation; that instruction named `keel.md` and root `CLAUDE.md` only, and the real basis is his weaker separate standing instruction. **Grant sound, attribution overstated.** **(f)** `wo-g3a` has no `contract_basis` entry for `thin-larry.md` at all, though the amendment added it to `file_surface`. **(g)** The map recorded the open HOLD against `ecfb04b` in **five** places and the brief in **three**, while the live HOLD is `d63668f` — stale at this head, named by neither the order nor the receipt. **(h)** `SHIT-TO-DO.md:92`'s "All three orders were amended on disk" is the same countable defect as `D-G3-18`. **(i)** The order's "must end up saying one thing" would, read literally, have rewritten the acceptance criteria of an **already-executed** order (`wo-g3d:124`/`:190`) — **falsifying the record of what was required at the time**, a worse defect than the contradiction it removed. Larry accepted the worker's alternative: record the supersession in `## AMENDMENTS` instead. |

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
findings about it. **The rule that follows: an amendment issued in a message is not an amendment
until it is in the artefact.**

> **Corrected 2026-08-04 by `WO-2026-08-04-05`.** This paragraph previously ended *"All three orders
> were amended on disk before integration."* **That was a miscount of the same class as `D-G3-18`,
> and it was not fully true.** Four orders were CLARIFY'd. **Three carry an `## AMENDMENTS` section**
> — `wo-g3a:97`, `wo-g3b:96`, `wo-g3c:113` — **and `wo-g3d` carried none at all**, which Veritas
> raised separately as `D-G3-15`. So the sentence undercounted the orders and overstated the
> remediation in one stroke: the order whose read-back caught six defects, including the `D-G3-01`
> relocation that then shipped, was the one with no amendment record. `wo-g3d`'s `## AMENDMENTS`
> section was written in this Work Order.

**And a third — same signature, third shape, one night.** `WO-2026-08-04-04`'s `contract_basis`
cited root `AGENTS.md` with the gloss *"read-only reconnaissance is unrestricted."* **No such clause
exists in that file.** Larry wrote a plausible-sounding justification and attributed it to a
document he had not checked. The permission was never in doubt — SOP-022 §"Phase 2 — the preflight"
mandates exactly those actions — so this was a **defective citation, not a defective grant.**

> **Corrected 2026-08-04 by `WO-2026-08-04-05`, and this is the worse half of `D-G3-14`.** This
> paragraph previously ended *"and it was re-cited before the work began."* **It was not.** The
> re-citation was decided in a message and never written into any artefact, so at `d63668f` all of
> `wo-g3b:36`, `wo-g3c:59`, `wo-g3d:56` and the prose at `wo-g3a:114` still carried the invented
> clause — **while this log recorded the defect as already remediated.** That is the identical
> failure named two paragraphs above (*"an amendment issued in a message is not an amendment until
> it is in the artefact"*), reproduced **in the very entry that records the lesson**, and it is why
> `D-G3-14` is a HIGH. **A false remediation claim is worse than the defect it claims to have
> fixed**, because it stops anyone looking again.
>
> **`WO-2026-08-04-05` found two more sites than the receipt named — six, not four.** `wo-g3d:58`
> inherits the invented clause through `"As above"`, and `wo-g3d:60` is a **separate** invented
> citation, attributing a required-evidence rule to root `AGENTS.md` when it lives in
> `Team Knowledge/Templates/work-order.md` §"Body sections". All six are corrected in this order and
> **each surviving citation was proved by grepping the document it names.**

Taken together the three are one failure wearing three costumes: an amendment issued in a message
and never written to the artefact · an assessment attributed to a worker who never made it · a
clause attributed to a document that does not contain it. **All three are "asserting a fact not
executed", which is the failure signature the whole estate is built around, and all three were
caught by workers rather than by Larry.**

**And a fifth, on the same night, inside the correction of the third.** `WO-2026-08-04-05` — the
order convened to discharge `D-G3-14` — asserted as its proof that root `AGENTS.md` *"is 336 lines
and `grep -i "recon"` returns nothing."* **It is 336 lines. `grep -i "recon"` returns two hits and
exits 0** — `reconcile` at `:76` and `reconciled` at `:116`. **Larry wrote an unexecuted grep result
as the evidence for a finding about unexecuted assertions**, and `veritas-gate3-documentation-d63668f.md`'s
evidence row (`grep -i "recon\|read-only" AGENTS.md` → exit 1, "no match") carries the same defect
independently.

**The finding itself stands and is confirmed.** The terms actually tested by the
`WO-2026-08-04-05` worker, each returning **exit 1, no match**, are **`reconnaissance`**,
**`read-only`** and **`unrestricted`**. The cited clause is genuinely absent. **Only the proof of it
was fabricated** — which is the sharpest available illustration of why a citation must be checked
rather than recalled: *the fabricated evidence and the true conclusion looked identical on the
page.* Neither false sentence is reproduced in any artefact.

**That is five instances in one night, and the second inside a document about the pattern.** The
progression is worth reading in order: an amendment never written down · an assessment attributed to
the wrong worker · a clause attributed to a document that lacks it · a remediation recorded that
never happened · **a grep result reported that was never run.** Each was caught by a worker. None
was caught by Larry.

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
6. **Asserting a fact not executed** — the standing signature, and **five instances on 2026-08-04
   alone**: an amendment never written down · an assessment attributed to the wrong worker · a
   clause attributed to a document that lacks it · a remediation recorded that never happened · **a
   grep result reported that was never run.** The last two are the dangerous shape, because they
   are *claims about the correction rather than about the work* — and a false claim that something
   is already fixed stops anyone checking. **Two of the five were written inside documents whose
   subject is this very pattern.**
7. **Envelope fields that are populated but not earned.** A missing `contract_basis` action entry; a
   `governance_sha` anchoring a contract that did not contain the cited field at that commit.
8. **A citation to a clause that does not exist.** Distinct from a wrong fact: the *permission* was
   real and the *attribution* was invented. A reader checking the citation finds nothing and cannot
   tell whether the grant is absent or merely mis-cited. **Its sibling: a citation to a document
   that does not exist in the estate at all** — `BUILD-015-AUTONOMOUS-RECOVERY-RESTART`, a real
   Warwick ruling ID that lives only in session. **The authority is genuine and the record is
   unverifiable, which is a provenance problem and not a fabrication** — the fix is to label it as
   attested, never to delete it.
9. **An instrument that cannot see the property it is being used to verify.** A `sed`-based hash
   over CRLF files. The check passes, and it passes for a reason unrelated to what was being
   checked. **See also §1 rows 11 and 12** — a scanner that exits 0 having scanned nothing, and a
   tamper digest that fires on a clean clone. ***A control is not evidence until it has been made to
   fail on purpose.***
10. **A state claim that is true when written and false when committed.** `D-G3-12`: a next action
    describing work that the act of shipping it completes, and a `git status` gloss pinned to a
    count that drifts. **The test for any state sentence is not "is this true now" but "will this be
    true at the head that contains it"** — and the durable answer is to write an action whose
    subject the commit *creates* rather than *discharges*, plus a check the reader can run to
    discover for themselves that it is done.

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
