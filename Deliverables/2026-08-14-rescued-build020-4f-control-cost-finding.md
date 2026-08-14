# BUILD-020 4F — the control-cost finding, rescued by `/reconcile` 2026-08-14

**Rescued from `build-020/4f-control-cost-evidence`, which carried 257 lines of content on no path from `main`.**
**Warwick's instruction inside it is explicit: _"Do not solve this 4F question now. BANK IT for 4F."_ — so it is banked here, unsolved, and this document directs nothing.**

**Why it was nearly lost:** the branch showed **zero files absent from `main`**, because the file it edits *does* exist on `main`. Only a **line-level content** comparison found it. *That is the exact trap the reconciliation rules name — never infer "merged" from similar filenames.*

---


---

## 📋 FIRST-CLASS 4F FINDING — **DOES THIS CONTROL HELP WARWICK REACH THE PRODUCT STAR?** (Warwick, 2026-08-09)

> **Banked for 4F, NOT solved here. Warwick's explicit instruction: "Do not solve this 4F question now. BANK IT for 4F."**

**The recurring failure is no longer merely "a rule was present but Larry did not follow it."** Warwick's larger question, his words:

> **«DOES THIS CONTROL HELP WARWICK REACH HIS GOAL AND PRODUCT STAR, WITH QUALITY AND RELIABILITY, AS QUICKLY AND EFFICIENTLY AS REASONABLY POSSIBLE?»**

**4F must examine every governance / assurance / permission mechanism against three outcomes:**

- **A.** preventing a meaningful **product, safety, reliability, authority or recoverability** failure;
- **B.** helping the team ship the Product Star **faster or with materially better confidence**;
- **C.** consuming time correcting, debating, reviewing and recording **administration whose practical consequence is negligible**.

**If C, the default answer is REMOVE, COLLAPSE or SIMPLIFY the control — NOT add another rule explaining it.**

**This is NOT an instruction to weaken quality, assurance, provenance, safety or product reliability. It IS an instruction that those mechanisms must justify their cost against Warwick's actual outcome.**

### The BUILD-015 evidence carried into 4F — natural, not manufactured

Every item below happened during real product work on 2026-08-08/09 and is recorded elsewhere with its own evidence:

1. **Long periods spent on attribution, record and convergence corrections while the actual shopping journey remained unfinished.** Sharpest instance: Veritas Gate 2 defect `D1` — Larry misattributed Warwick's own §11 acceptance criterion to himself and retired it on that basis, then a correction cycle followed. Real defect, correctly caught; the 4F question is what the whole cycle cost against the Star.
2. **Native "Allow Claude to run?" prompts leaving an expensive session idle overnight.** An unattended Larry waiting hours for a routine approval is a productiveness defect, not a safety feature.
3. **192 one-off permission literals accumulated in `.claude/settings.local.json`** from repeated approvals — a control being routed around one literal at a time, which is the signature of a control that is not working as designed.
4. **A main-push protection change unintentionally making ordinary feature work interrupt Warwick** — any push-shaped command containing `$(` classified as a main push, so every routine feature-branch push asked him. A gate protecting a real boundary, mis-scoped into the everyday path.
5. **Wrong-worktree protection believed active while actually INERT** — no active programme state existed, so `findCanonical` returned null and the entire location half never ran. **A control everyone believed was live had been enforcing nothing.** This is the strongest single instance of the 4F question: the cost was paid in belief, and the protection was not there.
6. **Governance behaviour being debated while the Product Star still had unexecuted links** — the packet seam, the basket writer and both learning flows remained unexecuted throughout.

### ⚖️ WARWICK'S WORD IS THE HUMAN AUTHORITY GATE — a 4F product/governance requirement

> **Recorded now so 4F cannot graduate while Warwick is still being used as a human Enter key.**

**Once Warwick has explicitly written a decision — approve this work · proceed · merge this reviewed head · perform this authorised runtime action — THAT IS THE HUMAN DECISION.**

**He should NOT then be asked to decipher an additional low-level "Allow Claude to run?" command box merely because the implementation happens to use Git, PowerShell, Bash or another tool.** His words: *"Those boxes are not meaningful human governance for me. I generally cannot sensibly evaluate the command text, so they add delay without adding real authority."*

**The target operating model:**

```
WARWICK SEMANTIC AUTHORITY
        ↓
Larry executes the authorised route
        ↓
machine controls prevent genuinely forbidden/destructive acts
        ↓
NO SECOND HUMAN CONFIRMATION unless the HARNESS technically requires one
that we cannot lawfully eliminate
```

Specifically:

| Situation | Required behaviour |
|---|---|
| Normal feature-branch writes / commits / pushes | **NO** Warwick allow prompt |
| PR creation / update | **NO** Warwick allow prompt |
| An already-authorised merge | **NO** second command-level allow prompt |
| An already-authorised main update that is part of that merge route | **NO** redundant push prompt |
| Force push / history rewrite / ref deletion / genuinely destructive unapproved action | **machine DENY** |
| A new consequential decision not previously authorised by Warwick | **ask Warwick in plain English** |
| Unavoidable host/harness security confirmation that cannot technically be removed | the **ONLY** acceptable mechanical "Allow" prompt class |

**NOT implemented in the 2026-08-09 governor hotfix, deliberately** (Warwick: *"Do NOT implement this whole authority model now inside the governor hotfix"*). Doing it properly requires distinguishing **Warwick's durable semantic decision** from **the host's mechanical permission layer**, which is 4F work.

**What the hotfix DID deliver against this model, and its limit:** ordinary feature-branch writes, commits and pushes no longer prompt, and destination-main still asks. **The main-push ASK is still a command-level box** — under the model above, an *already-authorised* merge route should not raise it. That gap is real, is not closed, and belongs to 4F.

### 🅿️ PARKED TO 4F BY WARWICK, 2026-08-09 — active-programme-state / multi-worktree semantics

**Wrong-worktree enforcement is a REAL DEFECT and must not be forgotten.** It is currently unreachable live because no active programme state exists. Warwick's ruling, verbatim: **"NO — do not restore/re-design multi-worktree enforcement now… solving active-programme-state / multi-worktree semantics is now explicitly PARKED to BUILD-020 4F. Do not let it become a side quest inside BUILD-015."**

The DENY path is proven **by construction** in `tools/governor/worktree-guard.test.mjs` § CONTRACT, and is deliberately **not** claimed to be live.

---

## 📋 FIRST-CLASS 4F FINDING — **WAYFINDER METHOD REGRESSION, not a missing feature** (Warwick, 2026-08-09)

> **Banked for 4F. Not solved here. Warwick's classification, and the correction is the point of it:
> this is a REGRESSION / FAILURE TO APPLY THE EXISTING WAYFINDER METHOD — NOT a missing feature
> requiring a new governance rule.**

**Warwick correctly recalls that the proven Wayfinder operating method ALREADY requires this
behaviour.** The evidence he cites, already present in the estate:

- Larry owns worker/specialist allocation, technical sequencing and parallelisation.
- If one path waits on Warwick, **all safe independent work continues**.
- The Wayfinder maps outcomes, dependencies, interfaces and evidence.
- Build order inside a phase is Larry's responsibility.
- Larry's orchestration role is decomposition, sequencing, integration and truth — turn an outcome
  into work packages with explicit dependencies, and decide retain-vs-delegate-vs-sequence.
- The original Wayfinder method explicitly supports dependent decisions and parallel planning.

### What actually failed in BUILD-015

The deliberately narrow **4E entry route** — `bootstrap → Pax → one earliest-broken-link WP → Nolan →
Warwick → implementation` — **was appropriate for entering BUILD-015 safely.** The failure is that it
**became the planning model for the continuing build.**

Larry followed the live Product-Star critical path **serially**, without maintaining the surrounding
implementation and dependency picture. **Warwick could no longer see:** the major product phases ·
dependencies between them · which work could proceed independently · which research should already be
running · which modules were ready to slot in · which specialists should be working concurrently.

**Cost: avoidable elapsed time and token inefficiency while large amounts of parallel worker capacity
sat idle.**

### The graduation question 4F must now test — EXTENDED

It is no longer merely *"Can a fresh Larry recover the next action?"* It must also be:

> **«Given a new Warwick destination, can a fresh Larry use the Wayfinder method to construct and
> maintain a coherent implementation route?»**

Testing all eleven:

1. identifies the major outcome phases;
2. identifies real dependencies between them;
3. identifies the critical Product-Star path;
4. decomposes phases into bounded work packages;
5. delegates suitable work;
6. runs independent research/implementation/assurance **in parallel**;
7. keeps dependent PRODUCT EXECUTION **serial where truth requires it**;
8. continues safe independent work while another path waits;
9. **selects appropriate worker/model cost** rather than defaulting expensive reasoning everywhere;
10. keeps Warwick able to **see the whole build, current frontier and parallel activity without
    reconstructing it himself**;
11. adapts the map at evidence/phase boundaries rather than **collapsing into one-ticket-at-a-time
    tunnel vision**.

### The principle

> **PARALLEL PREPARATION. DEPENDENCY-AWARE IMPLEMENTATION. SERIAL PRODUCT TRUTH WHERE REQUIRED.**

Optimising together for: **Warwick's Product Star · build quality · reliability · elapsed delivery
time · token/model burn · Warwick interruption cost.**

### ⛔ What 4F must NOT do

**Do not create another Wayfinder rule or framework to solve this.** The regrowth cap applies at full
force: the method already exists and already says this. **First establish WHY an operating method
already present in the proven Wayfinder failed to affect BUILD-015 behaviour.**

Candidate causes for 4F to weigh on evidence — **the cause is unestablished and must not be assumed:**

- the BUILD-015 **map shape**;
- **loss during the BUILD-020 → BUILD-015 transfer**;
- **Larry salience / consultation** — the method was present but never consulted at the moment of
  sequencing;
- **over-weighting "earliest broken link"** into serial execution;
- or another evidenced cause.

**Then prove the EXISTING method works** in the 4F fresh-Larry graduation exercise.

### Larry's own evidence, recorded as Larry's and not as Warwick's ruling

Corroborating instances from this session, offered as natural evidence rather than as a diagnosis:

- Five workers were dispatched in parallel **only after** Warwick issued an explicit parallelisation
  ruling — the capacity was available for hours beforehand and was not used.
- The four-lane execution view was written **only after** he named the visibility failure. The lanes
  and their dependencies were derivable from evidence already banked days earlier.
- The Lane C1 and Lane A file-surface collision (`services/asdair/shop/**` unassigned in both orders)
  is a **dependency-mapping** failure of exactly the kind item 2 above names — and it was caught by a
  worker's refusal, not by the map.

---

## 📋 FIRST-CLASS 4F CAPA — **THE WORK ORDER READINESS GATE IS A SYNTAX CHECK WEARING A SEMANTICS BADGE** (Warwick, 2026-08-09)

> **This is the direct escalation of the finding immediately above.** That one ended: *"caught by a
> worker's refusal, not by the map."* It happened again, five more times, in a single day — so it is
> no longer a mapping lapse. It is a **tooling defect**.

### The evidence, and it is what makes this a CAPA rather than a lesson

**Six Work Orders issued on 2026-08-09. Not one reached a worker in a buildable state.**

| # | Order | Failure |
|---|---|---|
| 1–4 | governor, ingress, Lane C, ingress-2 | **REFUSED** — envelope generated but never authored. `--count-markers` → **24 blank mandatory fields** on two of them. |
| 5 | Lane C, authored | **CLARIFY** — surface granted five browser-runner *source* files and **zero test paths**, so the required mutation proof was undeliverable inside it. |
| 6 | Lane C, amended | **CLARIFY** — the grant was pasted into **`contract_basis`** instead of **`file_surface`**. **It passed `ready: true`.** |

**Row 6 is the whole finding.** The readiness gate returned `ready: true` for an order whose write
authority was in a field that does not grant write authority. **The gate validates presence of
markers, not executable semantics.**

> **Warwick, verbatim:** *"You have now demonstrated that the recurring Work Order problem is NOT a
> memory/compliance problem. It is a tooling defect… The lesson is not 'Larry must remember to fill
> the right field.' The lesson is **'the system must make the wrong field impossible to pass as
> ready.'**"*

**And it is the same failure class as Lane C, on the same day:**
**THE RULE EXISTS, BUT THE EXECUTION PATH IS NOT FORCED TO OBEY IT.** In Lane C, `instructions.js`
v2 is complete and nothing delivers it. Here, the surface discipline is canonical and nothing
enforces it. **Two independent instances of one defect shape, found within hours of each other.**

### The invariant

> **AN AGENT CANNOT BE DISPATCHED WITH A SEMANTICALLY UNDER-AUTHORED WORK ORDER.**

### Required behaviour — Warwick's ten, recorded verbatim in substance

1. **`ready: true` must mean semantically executable**, not merely "no blank markers".
2. **`file_surface` is the SOLE grant of writable surface.** `contract_basis`, narrative text,
   dispatch prose and cited files may **never** implicitly grant write authority.
3. If the work **names, traces to, or necessarily requires** modification of a file absent from
   `file_surface`, **readiness FAILS before dispatch**.
4. If `contract_basis` mentions an implementation file absent from `file_surface`, **flag it
   explicitly** rather than allowing readiness.
5. **Trace the actual production/file surface before authoring.** Do not guess from memory.
6. Mandatory placeholders, unresolved decisions, contradictory boundaries or missing acceptance
   criteria ⇒ **readiness FAIL**.
7. **Amend an existing order after CLARIFY.** Do not regenerate a fresh envelope unless the work
   package genuinely changed.
8. **The dispatch command itself must enforce the validator.** It must not be possible for Larry to
   bypass it accidentally by sending a worker directly. *(This is the load-bearing one: items 1–7
   are all bypassable while dispatch remains a free-form message.)*
9. **Mutation tests for the exact failures of today** — see below.
10. Bank as tooling/CAPAE work, **run PARALLEL to AsdAIr**. Do not stop product execution to
    redesign the Work Order framework.

### The five mutation tests, named by Warwick

| Case | Expected |
|---|---|
| 24 blank mandatory fields | **FAIL** |
| Required file only in `contract_basis`, absent from `file_surface` | **FAIL** |
| Implementation target named in acceptance criteria but absent from `file_surface` | **FAIL** |
| Correctly authorised order | **PASS** |
| CLARIFY amendment retaining the same order identity | **PASS** |

### What this must NOT become

**⛔ Not another lesson telling future Larry to be more careful.** Warwick ruled that out explicitly,
and two such lessons were already written today
(`read-the-settled-contract-before-demonstrating`, and the dispatch-defect record in
`Deliverables/2026-08-09-lane-c-progress-and-the-dispatch-defect.md`). **Neither would have stopped
row 6**, because row 6 was not carelessness — it was a gate that said `ready` when it was not.

**⛔ Not a new control plane.** The regrowth cap applies at full force. The validator belongs **in
`tools/wo/envelope.mjs` and the dispatch path**, which already exist. **No registry, no tracker, no
service.**

### Honest scope limit

**Item 8 is the one that decides whether this works.** A validator Larry can forget to run is the
same class of defect as the rule it replaces — a control that depends on a habit. Until dispatch
itself refuses an unready order, items 1–7 are advisory. **That must be stated in the delivered work
rather than discovered later.**

### Status

**RECORDED, NOT YET BUILT.** Banked 2026-08-09 on Warwick's instruction, to run parallel to
BUILD-015 Lane C and B15-3. **No product execution was paused to write this.**
