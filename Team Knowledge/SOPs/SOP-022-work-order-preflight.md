# SOP-022: Work Order Read-Back and Preflight

- **Status:** Active (created 2026-07-27 after the IDEA-017 delegation experiments; the read-back gate
  added 2026-07-29 on Warwick's direct instruction, issued while the failure and the correction were
  both still live).
- **Applies to:** **every** worker or specialist instance executing a bounded Work Order in this estate.
  No exceptions, no "obvious" orders.
- **Owner:** the executing worker. **Larry owns the quality of the order itself, and owes a timely reply
  to every read-back. Nolan owns the class-A pre-dispatch check on the order** (Warwick, 2026-08-05).
- **Canonical shape of a Work Order:** [[Templates/work-order]]. This SOP is the procedure; that file is
  the artefact. Neither restates the other.
- **This is not a review ceremony. It is the first phase of execution.** It should take minutes, not a
  round trip of hours.

## The lifecycle — mandatory, and a worker cannot skip it

```
DRAFT  →  WORKER READ-BACK  →  LARRY ACCEPTS OR AMENDS  →  ISSUED  →  RUNNING
```

**The worker must not begin implementation until Larry explicitly accepts the read-back or issues an
amended Work Order.**

**The consequence, stated so it bites:** work produced without an accepted read-back **is not accepted
work.** Larry does not review it, its evidence does not count toward any acceptance criterion, and it is
returned `REFUSED` on process grounds however good the work is. A worker who skipped the gate has no
standing to argue the order was sound — establishing that, in advance, at the cost of one short round
trip, is the entire purpose of the gate.

## Two phases, and why both are needed

The two checks answer **different questions and catch different failures.** Neither substitutes for the
other, which is why this SOP now carries both rather than one bolted onto the other.

| Phase | Verifies | The failure it catches |
|---|---|---|
| **1 — Read-back** | **Understanding.** Does the worker's model of the job match Larry's? | The order is factually fine and the worker is about to build the wrong thing — or the order is silently incomplete and only becomes visibly so when someone states what they think they were asked for. |
| **2 — Preflight** | **Reality.** Do the order's claims survive contact with the machine? | The order is understood perfectly and is *wrong about the world* — a command that passes on nothing, a `SELECT`-only variable named as a writer, the wrong one of two databases. |

**Which runs when.** Phase 1 is first **in the lifecycle and in authority**: the read-back is the gate,
and no file is written before Larry answers it. Phase 2 is subordinate evidence-gathering that happens
*beneath* the gate — **the preflight checks are read-only**, so running them costs nothing and writes
nothing, and their findings are what make the read-back substantive.

**Do not invert this into "read-back, then preflight, then build" — this ordering is deliberate and was
ruled, not drifted into (2026-07-29).** The instruction that created this gate said "the read-back is the
first phase, ahead of the existing preflight checks." Taken *literally* that guts it: four of the nine
read-back fields — *Acceptance evidence*, *Assumptions*, *Contradictions*, *Missing requirements* — are
**produced by** preflight. A worker cannot report that an acceptance command exits 0 on zero tests
without having run it. A read-back returned before any reality check can therefore only paraphrase the
order back at Larry, which proves nothing and turns the gate into theatre — **and a gate that produces no
findings is one people learn to skip, which is the exact failure this SOP exists to close.**

The resolution was reviewed and upheld the same day: **nothing is written before the gate** (the stated
outcome is preserved exactly), and the read-only preflight runs *beneath* it to fill it. Anyone
"correcting" this back to the literal wording is reintroducing a known defect. Leave it. In practice: read the order → run the
read-only preflight → return the read-back **carrying** those findings → hold for ACCEPT or an amended
order → implement.

So the honest sequence is:

1. Read the Work Order in full, and [[Templates/work-order]] if you have not.
2. Run the preflight below. Read-only. Write nothing.
3. Return the read-back block, with the preflight findings inside it.
4. **Stop. Hold.** Do not implement.
5. Larry accepts, amends, or answers your `CLARIFY` points.
6. Implement.

## Phase 1 — the read-back

Return exactly this block. Its field-by-field filling guide is in [[Templates/work-order]] §"The
read-back block" and is not repeated here.

```
WORK ORDER READ-BACK

Outcome understood:
Owned files/surfaces:
Inputs and authorities:
Acceptance evidence:
Assumptions:
Contradictions:
Missing requirements:
Refusal conditions:
Verdict:
  - ACCEPT
  - CLARIFY
  - REFUSE
```

**Verdicts:**

- **ACCEPT** — the order is sound. The worker still holds until Larry says go; ACCEPT is the worker's
  assessment, not the worker's own authorisation.
- **CLARIFY** — buildable once the named points are settled. Name them precisely and hold.
- **REFUSE** — not actionable as written (a missing mandatory field, a material defect found at
  preflight, an acceptance criterion that cannot be delivered inside the declared surface, or an
  authority value the worker may not act under). **No files written.**

**Restating the order back verbatim is not a read-back.** The value is in the paraphrase — a misreading
only becomes visible when the words change.

**A clean read-back is still worth returning.** One line telling Larry the order was examined and found
sound is worth having; it distinguishes *sound* from *unexamined*.

## Larry's half of the gate

The gate is symmetrical and it fails if only the worker holds up their end.

- **Larry owes a reply.** A read-back returned and never answered has not been accepted. The worker
  holds. **Silence is not consent.**
- **Answer the findings, do not wave them through.** An `ACCEPT` verdict that carries three assumptions
  and a contradiction is not a green light — it is three defects in the order that Larry must settle
  before saying go.
- **When a worker improves on the design, take it. Do not defend the Work Order.**
- **Amend the order, do not patch it in chat.** A correction that lives only in a dispatch message is
  invisible to the next reader and to any second worker on the same seam.
- **Relay any discovered false assumption to every in-flight worker immediately.** Disjoint file
  ownership prevents collisions; it does not prevent shared misunderstanding.

## Phase 2 — the preflight

Verify the order against observable reality. Read-only; nothing here writes.

1. **Paths and files** — does everything the order references actually exist?
2. **Commands** — do the referenced commands actually run here? Run the acceptance command *before*
   trusting it as a gate. If it fails, establish whether it fails for an untouched neighbour too, which
   distinguishes "my change broke it" from "this order is wrong."

   **2a. A command that can succeed without doing anything is not a gate.** An exit code of 0 is not
   evidence on its own — confirm the command actually *executed the work it claims to prove*. For a test
   command that means reading a **non-zero count of executed tests/subtests** out of the runner's own
   output, not inferring it from the exit code. **Treat "0 executed" as FAILURE, never as a pass**, and
   say the count in the return.

   Known live defects on this estate's Node (v22.18.0), both confirmed by execution:
   - `node --test <dir>` fails with `MODULE_NOT_FOUND`.
   - `node --test "<glob matching nothing>"` **exits 0 having run zero tests.**

   So a stale, misspelled or wrongly-rooted path in a Work Order's `required_evidence` produces a clean
   green that proves nothing. Prefer an explicit file list, or a runner that reports counts and fails on
   zero — the pattern already used in this estate's CI. If the order's acceptance command cannot be shown
   to have executed anything, that is a defect **in the order**: report it, and do not accept its green.

   **2b. A control that reports on ground it did not examine is worse than no control.** Establish what
   each cited tool actually covered, not just what it exited. A scanner run against the wrong file set
   returns a green that is true about nothing you built.
3. **Environment variables** — do they mean what the order claims? Check the authoritative contract for
   the variable, not just its name.
4. **Datastore, schema and environment** — **establish which actual database/schema/environment the job
   refers to** before implementing. Do not infer it from a variable name.
5. **Permissions and grants** — do the permissions the work needs actually exist? **Check both halves of
   any boundary: a writer that is correctly locked out of what it must not touch, but has no grant on
   the tables it owns, is half a boundary and will fail at runtime.** A write path with no write grant is
   a blocker, not a detail to discover at the end.
6. **Internal consistency** — do the acceptance criteria contradict each other, or the stated scope?
   **Read every precedence and conflict-resolution rule literally, and ask what the worst-behaved input
   does to it** — a rule that sounds reasonable in prose can, applied exactly, let a weak constraint
   switch off a strong one.
7. **Completeness of the change set** — does delivering the outcome require touching something the order
   did not name? **A caching or distribution layer is the classic omission**: a service worker, a
   manifest, a CDN key, a build artefact list. If the change cannot become visible without it, the order
   is incomplete even though every path it *did* name was correct.
8. **Authoritative contracts** — does the requested behaviour contradict a README, schema comment, SOP or
   `AGENTS.md`? Those outrank the Work Order.
9. **A `file_surface` under `C:/.fusion247/` — the secrets store is denied by default.** Canonical rules
   in [[GL-012-secrets-store-access-boundary]]; check the order against them and do not re-derive them.
   Two checks belong here specifically:

   **9a. Is the declaration a valid grant at all?** One exact project subtree
   (`C:/.fusion247/private/<project>/**`) is valid. `C:/.fusion247/**`, `C:/.fusion247/private/**`, or
   any surface at or above a project directory is **not** — that is a `REFUSE` at the read-back, naming
   the specific directory the order should have declared. It is not a finding to note and build past.

   Check the envelope's **`private_surface`** field against `file_surface` while you are here. It is
   mandatory on every order **including when it is `none`**, you read it and never infer it, and the two
   must agree — a `private_surface: none` order carrying a `C:/.fusion247/` path in `file_surface` (or the
   reverse) is a contradiction you name at read-back rather than resolve. State the field back explicitly
   even when it is `none`: that line is what carries [[GL-012-secrets-store-access-boundary]] into orders
   whose worker has no contract of its own.

   **9b. Can the surface be scanned — and read the asymmetry exactly.** Establish that
   `bash scripts/secret-scan.sh --surface <declared paths>` can reach the surface. **Refuse at preflight
   only for reasons that will still hold at handback** — unreadable parent, symlink, untraversable path,
   or an invalid grant per 9a. **A greenfield subtree that enumerates to zero files is the HONEST case
   and must not be refused**: nothing has been written yet, and firing the gate there teaches everyone
   to ignore it. The blocking check lands at handback instead, where exit `2` over a declared private
   surface can no longer be innocent. This asymmetry was ruled, not drifted into; do not harmonise it.

## Outcomes

- **Order is sound** → return `ACCEPT`, hold for Larry, then proceed. Note anything checked that was
  non-obvious.
- **Order is materially wrong or ambiguous** → return `CLARIFY` or `REFUSE` at the gate, naming precisely
  what was wrong and what you verified. **This is the cheap moment.** The same finding delivered at
  completion has already cost a full dispatch.
- **Order is sound but a constraint is unmet** (e.g. a missing grant) → say so in the read-back's
  *Missing requirements*. If Larry accepts anyway, implement to spec, document the tension in the code,
  and report it. Do not silently invent a workaround.

**Never:**
- begin implementation before Larry has accepted the read-back or issued an amended order;
- accept an exit code as proof without confirming that work was actually executed;
- cite a control as assurance about ground it did not examine;
- game an acceptance criterion to make it pass;
- silently rewrite Larry's intent;
- work around a contradiction without reporting it;
- treat "the order said so" as authority over an authoritative repo contract.

A correct refusal is a better result than a confident wrong guess. This is explicitly wanted behaviour,
not insubordination.

## Reporting

The **read-back comes first, before any work exists**. In the final return, preflight findings come
**first**, before the implementation report: what was checked, what held, what did not. A preflight that
found nothing wrong is still worth one line — it tells Larry the order was sound rather than unexamined.

## Why this exists

> **The lesson, in one line: worker pushback is valuable, but it must happen before implementation
> rather than rescuing a defective order at completion.**

And the standing fact that motivates it:

> **Larry's failure signature is asserting facts he has not executed.** Five defective Work Orders in one
> session; workers caught all five; **none gamed a criterion.** The order needs more scrutiny than the
> work.

### Round one — the orders that were wrong about the world (Work Orders W01, W02)

| Defect | What Larry asserted | Reality |
|---|---|---|
| Broken definition-of-done | `node --test youtube/` was the acceptance command | That form fails on this machine's Node — repo-wide, not caused by the change |
| **Acceptance command that passes on nothing** (found 2026-07-29) | a `node --test "<glob>"` invocation treated as proof | On Node v22.18.0 here, **a glob that matches no files exits 0 having run zero tests.** A typo'd or stale path reports success. This is worse than the row above: a broken command fails loudly, a vacuous one goes green |
| Wrong env var | writers should read `ASDAIR_DB_URL` | That variable is contractually **SELECT-only**, specifically so a bug *cannot* write |
| Wrong datastore | (implicit) one database | There are **two**; `CONTROL_PLANE_DEV_DATABASE_URL` does not contain the `asdair` schema |

In each case the worker **challenged reality rather than following the order blindly**, and in each case
that was the correct outcome. One of them prevented an acceptance criterion being satisfied on a false
green.

> **The dangerous assumption was never "workers might disobey Larry."** On the evidence, workers have
> repeatedly protected the outcome from mistakes in Larry's instructions. The operating model must
> therefore assure **both the execution and the quality of the Work Order that commissioned it.**

### Round two — why "report it at the end" was not enough (2026-07-28/29)

Round one produced the preflight. Round two produced the **gate**, because the preflight was being run
and its findings were still arriving too late to be cheap.

- **A worker caught a defective precedence rule in an evidence contract.** "Most specific wins", applied
  literally, let a narrow **advisory** constraint displace a broader **blocking** one — meaning the
  strongest control in the model could be switched off by adding a *weaker* rule. The worker implemented
  it as written and flagged it rather than quietly reinterpreting it, which is exactly right. Contract
  amended.
- **A migration lacked the grants its intended writer needs.** The derivative writer was correctly locked
  out of canonical evidence while having **no write access to the tables it owns** — half a boundary.
  Found by a *sibling* worker reading the file: not by its author, and not by Larry.
- **A frontend brief omitted the service worker.** The cockpit's `sw.js` is cache-first, so without a
  shell-list entry and a cache bump, installed PWAs keep serving the old bundle and the change appears
  never to have happened. The brief said three hand-edits; it was four.
- **Multiple workers identified defects only *after* receiving flawed Work Orders.** One returned six
  material corrections — every one of them correct — but they arrived in the final report, after a long
  dispatch had already been spent building against the flaw.
- **The successful correction, and the reason this is doctrine rather than an argument:** the fix rounds
  that used a **read-back before implementation** worked. That is why the read-back was promoted from
  advisory prose to an enforced gate on 2026-07-29, in the same session as the failures.

The pattern across both rounds is one thing: **the order is the weak link, and the worker is the control
that catches it.** A control that fires at completion still finds the defect — it just charges a full
dispatch for the privilege.

## The pre-dispatch compatibility check — the issuer's, and it runs BEFORE anyone is spawned

**Canonical here. Larry's contract carries the obligation and points at this section; no specialist
contract restates the mechanism.**

Phase 2 below verifies the order against **reality**. This check verifies it against the **worker's
permission to perform it** — a different question, and the one that was missing. On 2026-08-04 six Work
Orders were dispatched and returned four REFUSE and two CLARIFY. **Every challenge was correct**, and
several found defects in the *order* rather than the work — most starkly a documentation reconciliation
whose surface included `Builds/**` and `Team Knowledge/**`, which the assigned specialist's contract flatly
prohibits. **A Work Order cannot override a permanent contract.** Discovering that costs a full dispatch;
checking it costs a minute.

**Envelope first.** Before drafting the route or acceptance, fix the envelope from two inputs only: the chosen worker's envelope invariants (its agent-index line; the contract governs) and the named needs of the outcome. Every authority field starts at its standing default; a non-default value must cite the outcome need that requires it, and a need the defaults cannot satisfy is a routing or design question — split the order, choose another owner, or ask Warwick. Never widen a field to fit an evidence idea.

**Route and acceptance are written inside the fixed envelope.** An evidence item the envelope cannot execute is a defect in the evidence idea, never a licence for the envelope.

Before dispatch, Larry answers five questions and **records the answers in the order's frontmatter**, in
`worker_contract`, `contract_basis`, `contract_conflicts` and `capability_evidence`:

1. **May this specialist write every declared path?** Every `file_surface` entry needs a `contract_basis`
   entry citing the exact contract heading or clause that permits it.
2. **May it perform every required non-file action?** Push, PR, migration authorship, script execution —
   each needs its own `contract_basis` entry.
3. **Does the acceptance evidence require a prohibited capability?** An acceptance criterion the worker
   cannot satisfy without breaking its contract is a defect in the order.
4. **Is the order relying on an obsolete assumption about its tools?** `capability_evidence` records what
   was actually observed, and from where.
5. **Does delivery need another owner for part of the outcome?** If so, split or reroute **now**.

**Rules that make this a check rather than a ritual:**

- **The contract version is anchored to an exact commit.** `worker_contract.governance_sha` records the SHA
  whose contract was read. A contract citation with no SHA is a citation of whatever the file says today.
- **The worker validates the block at read-back and never trusts it because it is populated.** A populated
  field is a claim by the issuer, and this SOP exists because the issuer's claims are the measured failure
  mode. Any mismatch between the order, the cited contract, or observable reality is **CLARIFY or REFUSE
  before implementation**.
- **`contract_conflicts: none` is an earned result, not a default placeholder.**
- **`capability_evidence.source: unknown` is honest but is not permission.** Any capability the
  implementation genuinely requires must be resolved before issue. **A static contract claim never
  substitutes for a live capability fact** — a contract describes what a worker *may* do, never what the
  running host *grants*.
- **`file_surface` stays pure path data.** Git, the scope check and the secret scanner read those entries;
  justification lives in `contract_basis`, which quotes a surface entry verbatim rather than annotating it.
- **If this block becomes reflexively populated ceremony, report the evidence and simplify it
  deliberately.** Do not quietly stop filling it in, and do not skip it because the issuer believes he
  remembers the contract.

**The final-text pass — a contradiction reconciliation, not a preflight.** Read the completed order once, as its worker will: (a) no field wider than its cited need; (b) every evidence item executable under this order's own surface, authorities and prohibitions — no spend and no outward action unless separately authorised in the order; (c) every "every / all / no / closed-list" claim names its inventory and stays inside this owner's surface, with the remainder named as evidenced-elsewhere. This pass rereads no contract and duplicates no worker preflight; the read-back remains the reality gate. A contradiction found here is corrected before issue, not discovered by a dispatch.

**This check reduces invalid dispatches. It is not a control.** Nothing mechanically confines a worker to
its `file_surface`, and a shim's `tools:` list may over-claim — six shims requested `MultiEdit` and never
received it. Say so wherever this is relied upon, or it becomes the next false assurance.

## Healthy refusal versus wasteful dispatch — they are not the same event

**A correct worker refusal is successful protection of the build.** It is the gate working. Repeated correct
refusals are evidence that **routing or Work Order construction is defective**, never that the worker is
resisting too much.

**The target is fewer preventably invalid dispatches — never fewer refusals.** A reduction achieved by
letting prohibited or under-specified work through is not an improvement, it is the failure this SOP exists
to prevent. **Never weaken a refusal condition** to reduce token cost, improve an acceptance rate, make the
issuer's instructions proceed more smoothly, or avoid an inconvenient second routing step.

Two classes, and only one of them is preventable:

| Class | Nature | Owner |
|---|---|---|
| **A — preventable before dispatch** | specialist contract conflicts · prohibited file surfaces · missing permissions · missing required capabilities · stale capability assumptions · absent schema decisions · impossible acceptance evidence · actions the specialist may not perform | **Nolan**, via the compatibility check above. Larry owns the outcome, the routing and the decision to dispatch |
| **B — genuine discovery** | code or runtime behaviour contradicting the order · hidden missing callers · false inherited baselines · deeper defects visible only after inspecting the implementation · interactions no contract or routing check could establish | **the worker**, via the read-back — this is what the gate is *for* |

A class-A refusal is a defect in the dispatch. A class-B refusal is the system working as designed. **Both
are correct refusals**, and neither is ever a reason to loosen the worker's conditions.

## For Larry

The mirror of this SOP: **send the drafted order to Nolan for the class-A check before issuing it — you no
longer preflight your own — and answer every read-back.**

**Nolan returns a verdict, not a veto. Larry may dispatch over an objection, and records it in the order.**
Every defect above was avoidable by running the command, reading the variable's contract, confirming the
datastore, or asking what the change actually needs to touch. On current evidence the Work Order deserves
more scrutiny than the returned work does — which is what the research predicted, pointing at the
commissioner rather than the worker.

## References

- [[Templates/work-order]] — the canonical Work Order shape and the read-back block. Canonical there.
- [[GL-012-secrets-store-access-boundary]] — canonical for preflight step 9: `C:\.fusion247\**` deny by
  default, the declared-project-subtree allowlist, and the preflight/handback scanner asymmetry.
- [[SOP-018-independent-change-qa]] — the independent QA layer a worker's evidence feeds and never replaces.
- Ambiguity is the primary driver of fabricated success (measured 20–40× risk multiplier):
  `Deliverables/2026-07-27-pax-delegation-failure-modes.md`
- Return-contract discipline: `Deliverables/2026-07-27-nolan-engineering-hire-recommendation.md`
  (historical reasoning document — its §7 Work Order shape is **superseded** by [[Templates/work-order]])
