---
name: NOLAN-02-wayfinder-review
type: review
build: BUILD-018
author: Nolan
reviews: research/PAX-01-wayfinder-adaptation.md
reviewed_at_head: 7d5e940fa7e9d193146a62d798b77b34a6690e7a
branch: build-018/session-governor
created: 2026-08-01
status: returned-to-larry
private_surface: none
---

# NOLAN-02 — Review of Pax's Wayfinder brief

**Read-only review. Nothing here was implemented, adopted or installed. No git state was mutated.**
Reviewed at HEAD `7d5e940`, worktree `C:/Fusion247PKA-governor`.

---

## 0. Read-back

**(a) Outcome.** Review `PAX-01-wayfinder-adaptation.md` for accidental complexity, duplication and
failure to serve the original outcome, and judge every recommendation against Warwick's actual user
experience rather than process sophistication. I am the brake, not a second enthusiast.

**(b) Plan.** Read the brief and its context (`02-MAP.md`, `01-GOAL-CONTRACT.md`, the Work Order
template, SOP-022, the earlier builds' shape). Then verify rather than accept: check the ADOPT items
against what the `programme-state.json` **schema** actually already carries, and verify §2a's incident
claim against git history at the commits themselves. Return ACCEPT/REJECT/TRIM per item, every
duplication collision with a winning name, a verdict on the trigger test, and what §2a obliges
Outcome A to do.

**(c) What the order failed to settle.** One thing, and it is not material: §4 forbids me proposing a
new SOP, Guideline or document type, while Pax's item A6 *is* a proposal for a new SOP and Guideline.
I read the prohibition as binding on my own recommendations, not as preventing me from judging A6 —
so I judge it, and I propose nothing new.

**(d) What looks wrong in the order.** Nothing that blocks. One note: the order asks me to check the
boundary table's Session Governor and execution-controller rows "because those two are being BUILT
RIGHT NOW". They are not two things. There is no execution controller in this estate — the
continuation/escalation logic is a module composed onto the governor's own hook surface. That framing
in the order mirrors the defect I found in Pax's table, so I flag it rather than adopt it.

**No material ambiguity. Proceeded in the same run.**

---

## 1. The headline

**The most valuable content in this brief is not the recommendation, and the recommendation is mostly
already built.**

§2a is a genuine, verified, load-bearing finding about session recovery. It would stand in full if
Wayfinder were rejected outright. The ADOPT list, by contrast, is six items of which **two survive
contact with the estate's own schema, one survives in trimmed form, and three are duplication or
process for its own sake.**

And while checking §2a I found the same defect **live, today, at HEAD** — see §6. That finding is
worth more to Warwick than the entire adoption question.

---

## 2. ADOPT list, item by item

Judged against the operational-cost test in `Team/Larry - Orchestrator/AGENTS.md` §"Governed-work
operating discipline" #6: *it must reduce expected future effort or risk more than it adds in present
complexity, tokens, maintenance and retrieval burden.*

### A1 — The five fixed map headings → **TRIM**

The problem is real and I hit it myself: `02-MAP.md` is 454 lines and ~35,000 tokens. It **exceeded
the read cap on a single tool call.** A navigation artefact that cannot be read in one pass by the
workers navigating with it is a live retrieval cost, paid on every dispatch. Pax is right to name it.

But "exactly five headings, anything else does not belong" is the original's shape imported without
the original's context. Pocock's map sits beside a tracker holding everything else; here the map is
the *only* human-readable artefact. Applied literally, the five headings evict §1 (architecture),
§2 (telemetry inventory), §4 (health model), §7 (dependency graph) and §11 (reusable seams) — none of
which is journal, all of which is navigation, and none of which has another home. That trades a
reading cost for a new-files-plus-new-hops cost and calls it a cap.

**Take the cap, drop the fixed five.** The bulk is §9 (ticket index) and §10 (write-back log), and
both are already duplicated elsewhere: §9's status is `tickets[]`, and §10 is an append-only history
of commits — which is what `git log` is. Cap the map and move those two, and the size problem is
solved without evicting the navigation content.

### A2 — Typed decision tickets with a HITL/AFK flag → **REJECT as proposed; ACCEPT the residue**

Pax calls this "highest value" on the claim that *"myPKA has no artefact for an unresolved question:
a Build Contract assumes the outcome is known, a Work Order assumes the decision is made."*

**That claim is false.** `tools/governor/programme-state.schema.json` already defines:

```
blockers[].kind   enum: fog | question | external | defect
blockers[].owner  enum: warwick | larry | research | external
blockers[].recommendation
```

`owner` **is** the HITL/AFK flag. `kind` **is** the ticket typing. `recommendation` is Larry's
pre-answer so Warwick can agree rather than derive. The live banked state carries **16** of these
(F-4, F-5, F-7, Q-1…Q-5, X-1, X-2, D-1…D-6), and `renderSessionHandoff` already prints them as
`**ID** (kind, owner: X) — summary — Recommendation: …`.

So A2 is a proposal to build a thing that shipped in T-09. Adopting it would create a second
vocabulary for one idea — **Pax's own anti-pattern A-4**, committed by Pax.

**The residue that is real:** `blockers[]` has **no `resolved` field**. Q-5 and X-2 therefore carry
`"RESOLVED 2026-07-31 by T-11"` as *prose inside the `summary` string*. That is §2a's exact defect
class — status carried in prose — recurring **inside the ledger that won the §2a argument.** Adding
`resolved` (boolean + resolving ticket) is the whole of A2 worth having, and it is one schema field.

### A3 — The graduate-fog test → **ACCEPT, as one sentence, not as an SOP**

*Ticket it now if you can state the question sharply, even if blocked; otherwise it stays fog.* It is
a genuine discrimination rule, it costs one sentence, and it is the only defence against a fog table
of vague gestures. Accept it — as a line in the map's own §5 header, where it is read at the moment
it applies. Not in a new SOP, which is read never.

### A4 — Destination as a hard scope-fixer → **REJECT**

Duplication, and a dangerous one. `01-GOAL-CONTRACT.md` opens: *"If an implementation ticket cannot be
traced to a line in this contract, it is scope creep. If this contract and any ticket disagree, this
contract wins."* AD-17(1) ranks it the product SSOT owning outcome, invariants and scope.

**Pax's own boundary table contradicts A4.** §4 assigns "the scope boundary" to the Build Contract and
says the map must *"never carry route, sequence, ticket status or open questions"* — then §5-A4 makes
the map's Destination the hard scope-fixer. Two owners for one fact is the §2a failure with the
subject changed. The Goal Contract owns scope. A map Destination is a pointer to it.

### A5 — `Awaiting Warwick (n)` in the generated status block → **ACCEPT (and it is cheaper than Pax thinks)**

This is the one item that unambiguously serves Warwick's actual experience: he sees whether the build
is blocked **on him** without asking, in the block he already reads. It is also **not a Wayfinder
adoption at all** — the data exists (`blockers[].owner === 'warwick'`), the renderer exists
(`renderMapStatusBlock`), the handoff already prints blockers. It is a filter and a count over data
BUILD-018 already banks, which means **it can ship inside Outcome A without accepting Wayfinder.**

**Conditional on the A2 residue.** Without `blockers[].resolved`, the count includes anything answered
but written up in prose. A counter that overstates is a nag, and a nag gets ignored — which converts
the one item that helps Warwick into one more thing he learns to skip.

### A6 — One short SOP plus the trigger test as a Guideline → **REJECT**

This is precisely what Warwick twice said not to create. Two new governance artefacts — in an estate
that already carries 30 SOPs and 12 Guidelines every agent is told to read — for a method that would
fire on perhaps one build a quarter. The operational-cost test fails on retrieval burden alone: an SOP
is a candidate at every routing decision forever; the saving is one charting conversation, rarely.

Worse, it is self-defeating. Pax's own A-3 warns the method will be over-applied *because it is new
and interesting*. **An SOP makes over-application easier, not harder** — it converts "should we?" into
"there's a procedure for it."

If any of this is adopted, the estate's own precedent is a **Template**, not an SOP: `work-order.md`
lives in `Team Knowledge/Templates/` and SOP-022 holds only the procedure. A template is retrieved
when used. An SOP is retrieved when deciding.

### Verdict summary

| # | Item | Verdict | One line |
|---|---|---|---|
| A1 | Five fixed map headings | **TRIM** | Take the size cap (the map broke a read cap); drop "exactly five" — it evicts §1/§2/§4/§7/§11, which have no other home |
| A2 | Typed tickets + HITL/AFK flag | **REJECT** (accept residue) | Already shipped as `blockers[].kind` + `.owner`; the real gap is a missing `resolved` field |
| A3 | The graduate-fog test | **ACCEPT** | One sentence in the fog table's header. Free, and it bites where it is read |
| A4 | Destination as scope-fixer | **REJECT** | The Goal Contract owns scope and says so; A4 contradicts Pax's own §4 |
| A5 | `Awaiting Warwick (n)` | **ACCEPT** | The only item that serves Warwick directly; already-banked data, existing renderer — conditional on A2's residue |
| A6 | New SOP + Guideline | **REJECT** | Exactly the expanding framework Warwick forbade; an SOP makes over-application easier |

KEEP (K1–K4) and DISCARD (D1–D4) are correct as written and I do not disturb them. K4's instinct —
generalise `checkExecutionProjectionAgreement` — is right and §6 shows it is more urgent than Pax knew.

---

## 3. Duplication collisions, with the winning name

| # | Pax proposes | Already exists as | Winner |
|---|---|---|---|
| 1 | Ticket types (research/prototype/grilling/task) | `blockers[].kind` — `fog \| question \| external \| defect` | **`blockers[].kind`** |
| 2 | HITL/AFK flag | `blockers[].owner` — `warwick \| larry \| research \| external` | **`blockers[].owner`** (`owner: warwick` *is* HITL) |
| 3 | Destination as hard scope-fixer | `01-GOAL-CONTRACT.md` + AD-17(1) | **The Goal Contract** |
| 4 | "A queueable batch of Warwick's decisions" | `blockers[].recommendation`, already carrying Larry's pre-answers on Q-2/Q-3 | **`blockers[].recommendation`** |
| 5 | `Awaiting Warwick (n)` as a new block | `renderSessionHandoff`'s existing `**Blockers (n):**` section | **The existing renderer** — extend it, never add a parallel one |
| 6 | A new SOP for map/ticket procedure | `Team Knowledge/Templates/work-order.md` precedent (shape = Template, procedure = SOP) | **A Template, if anything** |
| 7 | Five fixed headings replacing the map body | `02-MAP.md` §1/§2/§4/§7/§11 | **The existing sections** — cap size instead |
| 8 | "Fog" vocabulary (Pax's own A-4) | `kind: fog` in the schema; `02-MAP.md` §5 is the fog table | **`fog`** = not yet knowing enough to decide; **`blocker`** = the umbrella record type, not a synonym |

**Note on #8:** A-4 names the five-vocabularies problem and then does not resolve it. That is a gap in
the brief, not a finding — a brief that flags a naming collision owes the resolution. The estate has
in fact already chosen (the schema enum), and the brief did not check.

---

## 4. Does it serve the original outcome?

The outcome: *effective planning for genuinely large or foggy builds, with a human-readable map in
Git, decisions/dependencies/fog/frontier easy for Warwick to inspect, easy for Larry and the named
team to follow, and autonomous execution with minimum human interruption.*

**Partially — and the part that serves it is the smallest part.**

- **Serves it:** A5 (Warwick sees whether he is the blocker, without asking) and A2's residue. A1
  trimmed serves "human-readable" — the current map genuinely is not readable in one pass, and that
  is a live defect against the outcome, correctly named.
- **Does not serve it:** A2-as-proposed adds a second vocabulary for an existing one. A4 adds a rival
  scope authority. A6 adds two files everyone must carry so that one build a quarter can be planned.

**Drift verdict.** The brief is disciplined in intent — it has a DISCARD list, an explicit "not to be
built" line, a cost estimate, and it correctly refuses the tracker, the one-ticket-per-session rule
and the disposable spec. It is not a framework proposal. But half its ADOPT list is process for its
own sake, and its strongest content (§2a) is not a Wayfinder finding at all. **That asymmetry is the
tell: the brief's value is concentrated in the part that is not the recommendation.**

The honest summary for Warwick: *the estate already has the artefact for an unresolved question; what
it lacks is a render of it and a `resolved` field on it.* That is a defect list, not a method adoption.

---

## 5. The trigger test — is it decidable in advance?

Pax's test: chart a map only when **all three** hold — (1) the work will not fit one conversation even
with rotation; (2) ≥3 open questions that change the shape of the build, at least one not answerable
by Larry; (3) Larry cannot name the first three work packages with confidence.

**Two of the three are rationalisable into "yes"; one is genuinely decidable.**

- **(1) Span** is a forecast, made by the party who wants to chart. Larry would answer yes about
  almost any commissioned build, and would usually be right — which is why it discriminates nothing.
- **(2) Fog count** looks countable but the counting is the judgement being tested: whether a question
  "changes the shape" or is "implementation detail" is exactly what an enthusiastic charter decides in
  his own favour. It is also trivially inflatable — BUILD-018's own live state has 16 blockers.
- **(3) Route** is the good one, and it is good for a specific reason: it demands a **producible
  artefact**. Larry either writes three named work packages or he does not, and a third party can
  check afterwards which happened.

Because the test requires all three, the weak conditions do not inflate it. But the failure mode
Warwick actually fears — A-3, charting work that was already clear — runs entirely through condition
3, and conditions 1 and 2 are decoration that lends the appearance of rigour to an assertion.

### The sharper test

> **Larry writes the first three work packages. If he can, there is no map.**
>
> A map is charted only after Larry has **attempted and failed** to write three named, orderable work
> packages with acceptance shapes — naming in one line the specific thing that blocks each. The failed
> attempt is the evidence, and it is kept. **And the decision to chart is Warwick's, not Larry's.**

Why this is sharper on all three counts:

1. **It cannot be rationalised, because it cannot be answered without doing the work.** The current
   test is answered by assertion; this one is answered by an artefact.
2. **The cheap outcome is also the desired outcome.** If Larry succeeds, the build is planned and the
   test cost nothing — that is a Build Contract and three Work Orders, which is the existing process.
3. **Fog falls out for free.** The three "what blocks this" lines *are* condition 2, produced as a
   by-product rather than counted in advance by the interested party.

The Warwick-decides clause is the binding half: **the party that benefits from charting must not be
the party that authorises it.** Pax's workflow step 1 already has Larry proposing and Warwick saying
yes; it should be the rule, not the courtesy.

---

## 6. The boundary table — overlaps and gaps

### Overlaps

**O-1 — Two owners for scope.** The Wayfinder row owns "the destination"; the Build Contract row owns
"the scope boundary"; A4 then makes the Destination a hard scope-fixer. Fold the Destination into a
pointer at the Goal Contract. One owner.

**O-2 — "Execution controller" is not a sixth artefact, and this row will mislead Outcome A.**
The table gives it a peer row beside the Session Governor. **No execution controller exists.** What
exists is T-17's escalation gate and T-16's delegation gate — modules composed additively onto
`reorient.mjs` and `worktree-guard.mjs`, inside `tools/governor/`, on the governor's own hook surface.

This is the wrong boundary the order asked me to look for, and it is wrong in the direction that
costs most: Larry is building the resumption path now, and a table telling him the
continue-or-stop logic is a **separate artefact** invites a second entry point, a second state store
and a second place to look for "why did it stop" — reintroducing exactly the two-sources problem §2a
exists to close. **Fold the row into the Session Governor row as a named responsibility.**

Folding also resolves a live tension in the table: the Governor row says it *"only projects and
transports what the ledger already says"*, while the execution-controller row has it *"refusing the
manufactured pause"* — which is a judgement. In one row the tension resolves correctly: the governor
may refuse on an **enumerable** rule (T-17's git-verb vocabulary) without deciding product content.

### Gaps

**G-1 — There is no row for `programme-state.json` / the execution ledger.** This is the most
important omission in the table. It is the execution-state SSOT under AD-17(2), it is the artefact
§2a is *about*, and a table whose stated job is telling a fresh Larry which artefact owns what cannot
answer "which file wins" without it.

**G-2 — There is no row for `session-handoff.md` / the reorientation brief** — the artefact a fresh
Larry actually reads **first**. It is a projection (AD-17(5)) and belongs beside the ledger so the
projection-versus-source rank is visible in one glance.

**G-3 — The Implementation Plan row describes an artefact BUILD-018 does not have.** There is no
`IMPLEMENTATION-PLAN.md` under BUILD-018 (BUILD-002 has one). Not wrong, but it is a row about other
builds sitting in a table used to orient in this one.

---

## 7. §2a — verified against the artefacts, and it is worse than Pax knew

### 7.1 The incident claim: **VERIFIED on every particular I checked**

I did not accept Pax's account. I traced `tickets[T-14].state` and `resumption.ticket` across every
commit that touched `programme-state.json`.

| Evidence | Result |
|---|---|
| `12592ea` (07-31 18:13) — bank | ledger `T-14=frontier`, `resumption.ticket=T-14`; map does **not** yet claim T-14 resolved. Consistent. |
| **`e306431` (07-31 19:04) — bank** | ledger `T-14=frontier`, `resumption.ticket=T-14`, `next_action="Implement T-14 as Opus: …"` — **while the same commit's `02-MAP.md` §9 reads `**T-14** \| ~~…~~ **RESOLVED 2026-07-31**` with a full §10 write-back row.** |
| `git branch -r --contains e306431` | `origin/build-018/session-governor` — **it was pushed.** |
| `92b4d3d` (07-31 19:27) | *"fix T-14 dual-write staleness — one execution-s…"*. Divergence window closed. |
| `programme-state.mjs:578` / `rotate-session.mjs:152` | `checkExecutionProjectionAgreement` exists and is wired into the refusal path. |

So the failure is exactly as described: **a rotation banked and pushed a resumption pointer
instructing a fresh session to redo finished work**, and Pax's "the very next `/rotate-session`" is
literally accurate — the window is one bank wide.

**One correction to the framing.** Pax's headline attributes the incident to **AD-9's inversion**
("making a map assert execution status caused a real failure"). Over-attributed. AD-9 concerns ticket
**specs**, and AD-17's own corrected text says so: *"Refines AD-9 (map-over-tickets, which is about
ticket specs, not ticket status, and is unaffected)."* The cause was AD-17's **original** wording
naming the map an "execution SSOT" — which Pax does state, two paragraphs later. It matters because
blaming AD-9 makes the deviation from the original look more culpable than it was, which inflates the
case for importing the original.

### 7.2 Is the derived rule correctly scoped?

The rule: *"The map holds navigation — destination, fog, decisions, dependencies. It never holds
status."*

**Right in direction, mis-scoped in both directions as literally worded.**

- **Over-general.** As written it condemns the fix. BUILD-018's `GOVERNOR:STATUS` block *is* status,
  *in the map* — and is correct, because it is machine-rendered between markers from the ledger. The
  rule needs the qualifier Pax uses elsewhere but omits from the rule itself: *the map never asserts
  status **on its own authority**; a generated, marker-delimited projection of the ledger is not an
  assertion.*
- **Under-general.** The rule says "map". The defect class is **any hand-authored artefact carrying a
  fact a machine-readable source also carries** — and I found it recurring one field over, in the
  ledger itself (`blockers[]` has no `resolved`, so Q-5 and X-2 carry `"RESOLVED 2026-07-31 by T-11"`
  inside `summary`).

**Correctly scoped:**

> **Every status fact has exactly one machine-readable field and exactly one sanctioned writer.
> Prose may describe a status; it may never carry it. A generated projection, delimited and
> regenerated from the source, is not prose.**

### 7.3 THE LIVE DEFECT — found while verifying §2a, present at HEAD `7d5e940`

**The banked `locked_decisions[AD-17]` in `programme-state.json` still carries the PRE-CORRECTION
text — and it is being rendered into the live handoff a fresh session reads first.**

Verbatim, from the live file at HEAD and from `Team Knowledge/fusion-brief/session-handoff.md:100`:

> *"(2) The Wayfinder map (02-MAP.md) is the **LIVE EXECUTION / NAVIGATION SSOT** … (4)
> **programme-state.json** and session-handoff.md are **GENERATED PROJECTIONS** — never a rival
> source; a disagreement between a projection and its source is a defect in the projection."*

And `resumption.read_first[0]`, surfaced by `reorient.mjs:490` into the `READ FIRST` block of every
post-`/clear` reorientation:

> *"Deliverables/BUILD-018-session-governor/02-MAP.md - **the live execution SSOT (AD-17)**"*

The map's own corrected AD-17 says the exact opposite: `tickets[]` is the execution-state SSOT and the
map is a navigation projection.

**Three consequences, in order of severity:**

1. **The ledger is banking a decision record saying it lost the argument.** A fresh Larry reoriented
   from this state is told, in his first pointer and in his locked-decisions list, that the map
   outranks the ledger — and clause (4) instructs him that a disagreement is *"a defect in the
   projection"*, i.e. **resolve map-versus-ledger conflicts in favour of the map.** That is precisely
   the rule that caused the T-14 incident, still live, in the channel built to prevent its recurrence.
2. **`checkExecutionProjectionAgreement` cannot see it.** It compares §9's ticket table against
   `tickets[].state`. It does not compare `locked_decisions` against the map's §3. So the
   projection-agreement control **reports success over ground it never examined** — INV-5's exact
   wording, and the estate's own "a control is not evidence until made to fail" lesson, recurring
   inside the control written to close this defect class.
3. **It is one string edit** (two, with `read_first[0]`) via `applyTicketResolution`, plus one
   extension to the agreement check.

I did not fix it. This is a read-only review and the fix is Larry's, in Outcome A.

### 7.4 What §2a obliges Outcome A to do — four testable obligations

Larry is building the resumption path now and asked what this obliges. These, in priority order:

1. **Correct the banked `locked_decisions[AD-17]` and `resumption.read_first[0]` to the corrected
   AD-17 text, via the sanctioned write path, before the next rotation.** Highest value, lowest cost,
   and it is a live defect not a hypothetical.
2. **Extend `checkExecutionProjectionAgreement` beyond §9's ticket table** to compare
   `locked_decisions` against the map's §3, and `blockers[]` against §5/§6. Give `blockers[]` a
   `resolved` field first, or the blocker half has nothing to compare against. Today the check's scope
   note is honest — *"a ticket absent from that table is out of scope and not asserted either way"* —
   but §7.3 shows the unexamined ground contains a rule inversion, not a rounding error.
3. **Assert, by source-scan test, that the resumption path never reads the map.**
   `deriveResumption` must take the ledger as its only input. It does today; make that a control
   rather than a property, in the same style as T-05's import scan.
4. **Make Warwick's catch mechanical.** He caught the incident by reading the banked output before
   typing `/clear` — a human step that happened to fire once. Rotation should print the pointer it is
   about to bank and refuse if the named ticket is not on the computed frontier. `deriveResumption`
   already refuses an off-frontier *override*; extend the same refusal to the *banked* value, and make
   that printed pointer the last thing on screen before `/clear`.

Obligation 1 is worth doing this session regardless of what Warwick decides about Wayfinder.

---

## 8. What I did not do

- Nothing implemented, adopted or installed. Wayfinder remains research-only.
- No mutating git. No file edited except this one.
- No new SOP, Guideline, ticket series, registry or document type proposed. The two artefacts I
  recommend touching (`blockers[].resolved`; the `GOVERNOR:STATUS` block) already exist.
- The BUILD-018 configuration audit was not redone; unrelated defects were not reopened.
- `GL-012` was not read from this worktree. `private_surface: none`; no access to `C:\.fusion247\**`.

## 9. Bottom line

**Not a Wayfinder decision now — three small Outcome-A defects now, and the adoption question later.**

Accept A5 and A2's residue and A3-as-one-sentence — roughly one schema field, one filter, one
sentence, all inside work Larry is already doing. Reject A2-as-proposed, A4 and A6 outright. Trim A1
to a size cap. Replace the three-condition trigger with the produce-three-work-packages test, and put
the charting decision in Warwick's hands rather than Larry's.

And fix §7.3 today. It is the §2a defect, alive, in the reorientation channel, at HEAD.
