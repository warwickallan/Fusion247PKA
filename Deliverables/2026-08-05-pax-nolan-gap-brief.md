# The Nolan gap — WP-3C research brief

**Pax · 2026-08-05 · `WO-2026-08-05-14` + Amendments 1 and 2 · RESEARCH AND EVIDENCE ONLY**

**Warwick answered Q-1, Q-2 and Q-3 himself (Amendment 2). His words are precedence #1.** This brief
confirms them against the record rather than restating them, reports the one place the record goes further
than his account, and spends itself on **Q-4**.

**Evidence base.** Worktree at `717a366`, proven byte-identical to governance head `7bcfef7` across `Team/`,
`Team Knowledge/`, `AGENTS.md`, `CLAUDE.md` and `services/control-plane/review/prompts/` (git query #1,
empty). Git history banked at `Deliverables/proofline/EVIDENCE-2026-08-05-wp3c-git-history.md`. No external
sources; none would have changed a conclusion.

---

## Q-1 to Q-3 — confirmed against the record. Nothing on disk contradicts his account.

**Confirmation 1 — never canonically assigned.** `Team/Nolan - HR/AGENTS.md`: **one commit, `2eb9461`,
2026-07-10, never amended.** Content is hiring only. `SOP-001:4` — *"a skill, not a 1:1 ownership"* — and
SOP-001 carries no amendment procedure; where it touches an existing `AGENTS.md` (§7) the gate is **Warwick**.
Confidence: **High.**

**Confirmation 2 — Nolan filled it informally, and this is his claim I could verify hardest.** Five BUILD-018
commits, 2026-08-01, none of them hiring: *"Nolan's independent visible-journey and configuration audit"*
(`e695c14`) · *"land Nolan's constitution audit"* (`d278c82`) · *"Nolan's review of the Wayfinder brief"*
(`e23c0fb`) · *"apply Nolan's final audit — corrections, and the merge precondition"* (`8b31f51`) · *"land
Nolan's re-check"* (`6f5f171`). Plus the 2026-07-31 delegation-enforcement gate (`ce5a0cd`, `6f31544`).
**Warwick's "independent organisational/governance mind" is exactly what those commits describe, and none of
it is in his contract.** Confidence: **High.**

### The one thing the record adds: the informal owner was **formally de-assigned on 2026-08-04**

`Team/agent-index.md:42-45`, in the file's own amendment note:

> *"This table previously read **'Independently audits — Nolan'**. Build assurance is now Veritas's standing
> gate; **Nolan's audit remit is team hygiene and hiring, which is what his contract actually covers.**"*

So the responsibility was not merely unformalised — **it was carried in the routing table, noticed to be
unbacked by his contract, and removed** (`f78d121`, `GOVERNANCE-VERITAS-HIRE`, 2026-08-04). The replacement is
**contractually barred from the half that was lost**: root `CLAUDE.md` and `agent-index:85` both state **"no
pre-inspection of a Work Order before implementation"** and that the Veritas gate **fires after
integration**.

**BUILD-020's Work Orders begin the same day** (`WO-2026-08-04-01`). Stated as correlation with a named
mechanism, **not proven causation**: the pre-implementation half of independent review was removed on
2026-08-04, and the defect cluster runs from 2026-08-04 onward. Confidence: **Medium-High** on the
mechanism, **High** on the dates.

*This sharpens his account rather than contradicting it: "never canonically assigned" is exactly right about
the contract, and the routing table is where the appearance of an owner came from.*

### The residue — his ruling does not clear Larry, and the evidence says so

Warwick calls bad envelopes a **consequence**, and on the evidence he is right about *existence*. But the
missing checker does not explain **recurrence**: `Builds/**` in a barred surface **twice** (WO-03, WO-05) ·
`private_surface` at the secrets-store root **twice** (WO-02, WO-03) · `live_authority` at a forbidden value
**twice** (WO-03, WO-06) · **WO-04 reproduced WO-03's over-claim one order later**, after Larry had documented
it himself. **Repeating a defect you have just written down is not caused by the absence of an independent
reader.** Separable, narrow, real — and **it does not change Q-4**, because an independent check catches
recurrence whatever its cause. Cause belongs to §15.3d. Confidence: **High** that it is separable; **Low** on
its cause, which is not mine to settle here.

**Count, from disk, as of 2026-08-05:** 15 Work Orders in `Deliverables/proofline/`; **13 carry a worker
challenge Larry upheld**; 2 record none (`WO-08`, `WO-09`). The ledger has now been restated three times
(six → seven → nine → thirteen). *Recommend it stop carrying a number and carry a method.*

---

## Q-4 — The smallest correction

### **The procedure already exists and is already mandatory. Only the actor is wrong. Change the actor.**

**SOP-022 already contains everything Warwick asked for** — the pre-dispatch compatibility check, the
envelope-first discipline, the five questions, the final-text pass, and the defect taxonomy. It also already
names the class: **Class A — "preventable before dispatch… specialist contract conflicts · prohibited file
surfaces · missing permissions · impossible acceptance evidence"** — with **`Owner: Larry`** (SOP-022:344).

**All thirteen BUILD-020 refusals were class A.** The procedure caught nothing in advance because
**SOP-022:352 tells the author to check his own order**: *"preflight your own Work Order before issuing
it."*

> **That is structurally the same defect Warwick named.** He asked for *"independently checking that the
> implementer was not defining the law governing its own work."* The issuer is currently the sole author
> **and** the sole checker of the envelope that governs the work. **The independence boundary is missing at
> both ends of the estate, not one.**

**The regrowth test — ownership AND procedure — is already satisfied by parties that exist:**

| Required | Exists today? |
|---|---|
| An owner independent of Keel and Mack | **Nolan.** Never implements, never operates, never touches service code or live machines. Independent **by construction** |
| That owner already does this work | **Yes** — five BUILD-018 audit commits, and the `agent-index` row he held until 2026-08-04 |
| A procedure | **SOP-022's pre-dispatch compatibility check.** Canonical, detailed, mandatory, unamended |
| The tools to run it | **Yes** — `.claude/agents/nolan.md` grants `Read, Write, Edit, MultiEdit, Bash, Glob, Grep` |

**Nothing is hired. Nothing is built. No new document, role, registry, checker, validator or document
family.** The lifecycle diagram is unchanged. **This is `change` — one of his four verbs.**

### The exact proposed redline — for Warwick's approval and independent review

Four files, all small. **Barred to Larry and to me; this is a proposal, not a change.**

**R-1 · `Team Knowledge/SOPs/SOP-022-work-order-preflight.md` — three lines, the load-bearing one**
- `:344` Class A owner: `**Larry**, via the compatibility check above` → **`**Nolan**, via the compatibility
  check above. Larry owns the outcome, the routing and the decision to dispatch.`**
- `:352` *"preflight your own Work Order before issuing it"* → **"send the drafted order to Nolan for the
  class-A check before issuing it. You no longer preflight your own."**
- `:8` add: **"Nolan owns the class-A pre-dispatch check on the order."**
- **Add one sentence so this cannot become a blocking bureaucracy:** *"Nolan returns a verdict, not a veto.
  Larry may dispatch over an objection, and records it in the order."* — preserving root `CLAUDE.md` Rule 4,
  under which route and sequencing stay Larry's.

**R-2 · `Team/Nolan - HR/AGENTS.md` — one new section, in Warwick's own three clauses**
> Beyond hiring, you own the independent organisational and governance seam: **(1)** translate Warwick's
> settled decisions into governing contracts and Work Order envelopes; **(2)** define and challenge role
> boundaries and interfaces **before Keel implements and Mack operates**; **(3)** check that no implementer
> is authoring the law that governs its own work. You never implement and never operate — that independence
> is the whole value. **You draft; Warwick ratifies.** You never approve your own text and never ratify a
> governing document.

**R-3 · `.claude/agents/nolan.md` — the `description:` line.** It currently routes on hiring only, so Larry
would never route an envelope to him and **the habit would decay silently**. Add: *"Use proactively before
any Work Order is issued — Nolan holds the class-A pre-dispatch check (SOP-022)."* **Without R-3 the other
three are decorative.**

**R-4 · `Team/agent-index.md` — Nolan's row, and one row in the build-team table** restoring an independent
pre-implementation owner alongside Veritas's post-integration gate.

### Why this is not a governance layer, stated so it can be attacked

No artefact is created. No step is added to the lifecycle — SOP-022's check **already runs before dispatch**
and is already mandatory. **The cost is a substitution, not an addition:** today 13 of 15 orders pay a full
worker dispatch to return a class-A refusal (SOP-022:284 — *"discovering that costs a full dispatch; checking
it costs a minute"*). A Nolan pass reads an envelope and two contracts; a Keel refusal reads those **plus**
probes the repo and writes a read-back. **It replaces the more expensive of the two.**

**And it must not reduce refusals.** SOP-022:335 — *"The target is fewer preventably invalid dispatches —
never fewer refusals."* Class B is genuine discovery and stays entirely with the worker.

### The one real design choice inside Q-4 — Warwick's, and I recommend A

- **A — Nolan CHECKS.** Larry drafts; Nolan holds the class-A verdict. Smallest change; preserves Larry's
  route authority; closes the author-checks-own-work defect directly.
- **B — Nolan AUTHORS.** Nolan writes the envelope from Larry's stated outcome. Closer to Warwick's wording
  (*"translate… into governing contracts and Work Orders"*); larger; moves work rather than adding a check.

**Recommend A, on evidence not preference:** every one of the thirteen defects was an **envelope-field**
defect visible to any independent reader of the envelope — surface, authority, `private_surface`, acceptance
outrunning surface. **None required authoring to catch.** A is sufficient and smaller. If A runs and the
defects continue, that is the evidence for B, and it will have been earned rather than assumed.

**Recommending, not deciding. All of it is Warwick's.**

---

## Unestablished — named

1. **Whether the 2026-08-04 de-assignment caused the defect cluster.** Dates and mechanism are established;
   causation is not, and a 15-order sample cannot settle it.
2. **Whether Nolan's informal audits were actually good.** Five commits prove he *performed* the role, not
   that he performed it well. Not assessed. Reading `e695c14` and `d278c82` would settle it.
3. **Whether a Nolan pass would have caught these thirteen.** Untested and untestable in advance. **The
   honest counter-case: Nolan is the same model, and a same-model reviewer is not independent review.** His
   independence here is *structural* (no implementation stake), not *model* independence — the distinction
   Pax's own contract requires be stated plainly.
4. **`reviewer-classification-amendment.md` has no `author:` field**, so Larry's WO-05 two-sibling precedent
   for ruling Keel's authorship in is **half unverified**. Needs `git log --follow -p` on that path.
5. **`supervisor-prompt.md`** (`approved_by='ai-authored-unapproved'`, reaches Codex every watcher turn) is
   the last governing text outside the ratification gate that now protects its siblings. **Ratify it or take
   it off the live route** — a `change` or a `remove`, no mechanism required. Its live *effect* is
   unestablished.
6. **git query #6 failed** (`--follow requires exactly one pathspec`), so whether this gap was inherited from
   BUILD-010 is unverified.
