# Redline — Keel's contract: `credential_scope` / `live_authority` authority deviation

**Author:** Nolan (HR) · **Date:** 2026-08-12 · **Work Order:** WO-2026-08-12-03
**Authority:** Warwick, 2026-08-12, verbatim — *"Put the contract conflict past Nolan and fix it."*
**Governance head:** `f01414334b2f640ac11f5964fcce6168f527fe45`
**Amended file:** `Team/Keel - Implementation Engineer/AGENTS.md`
**Also amended:** `.claude/agents/keel.md` (host shim — de-duplication, not restatement)

> **This document is written BEFORE the amendment is applied**, per `CLAUDE.md` § "No silent
> constitutional self-modification", which requires Warwick's explicit approval (given), an exact
> proposed redline (this document), and independent review of the resulting patch (Larry dispatches
> Veritas afterwards). It is committed on its own so that the ordering is checkable in commit history.
>
> **It stands alone without the diff.** Every changed passage appears below in full, before and after.

---

## 1. The conflict being closed

Keel's contract makes any `credential_scope` or `live_authority` value other than `none` **a refusal
condition in itself**. The estate's canonical Work Order template (`Team Knowledge/Templates/work-order.md`
L134–142) defines those same fields as **standing defaults** — *"these are the standing defaults; any other
value needs Warwick"* — and `tools/wo/envelope.mjs` emits deviations with a **mandatory
`--deviation-authority`**, refusing to generate a `machine_surface` order without one.

**The contract forbids what the tooling is built to express.** It has blocked two consecutive
correctly-formed Work Orders (WO-2026-08-12-01-v2 and WO-2026-08-12-02), each resolved only by Larry
invoking `CLAUDE.md` precedence inside the order body — a workaround, not a fix.

**What this redline does NOT do.** It does not widen Keel's authority. Every limit below is one the estate
was *already* applying in practice through order-body rulings; the amendment moves them into the contract
so they are checkable by the worker, and makes everything outside them unreachable.

---

## 2. Site classification (AC1) — established by reading the whole contract

Every site in `Team/Keel - Implementation Engineer/AGENTS.md` deriving behaviour from `credential_scope` or
`live_authority`, classified **(a)** standing default · **(b)** refusal trigger · **(c)** genuine safety
behaviour.

| Line(s) | Passage | Class | Disposition |
|---|---|---|---|
| **121–123** | *"…standing defaults and the only values Keel may act under; any other value is itself a REFUSED condition until Nolan has amended this contract."* | **(a) + (b) fused in one sentence** | **CHANGED — Change 1.** The primary conflict site. |
| **382–383** | Critical rule 3 — *"NEVER touch a live service, scheduled task, or non-throwaway database."* | **(c), and an INDEPENDENT absolute** | **CHANGED — Change 2.** Not in the original order's site list; see §3. |
| **623–625** | REFUSED verdict definition — *"`credential_scope`/`live_authority` other than `none`"* | **(b)** | **CHANGED — Change 3.** Must move with Change 1 or the contract self-contradicts. |
| **301–302** | *"This follows directly from `credential_scope: none`: Keel writes the code that reads and validates a variable, and never sees, requests or writes its value."* | **(c)** Keel/Mack configuration-ownership boundary | **UNTOUCHED** — see §5. |
| **311–313** | *"Two standing rules survive this boundary unchanged … critical rule 3 … and `live_authority: none`. … it never means Keel operates the live thing."* | **(c)** | **UNTOUCHED** — see §5. |
| **401–402** | *"`credential_scope: none` is absolute and a declared private surface never widens it."* | **(c) — a DIFFERENT PROPOSITION** (no harvesting of credential material, `~/.codex/*` included) | **UNTOUCHED, and explicitly re-asserted** by limb 4 of Change 1 and by Change 2's never-reachable list. |
| `.claude/agents/keel.md:3` | Host shim `description:` asserts *"credential_scope none, live_authority none"* and *"Never touches live services or credentials"* **as facts** | **(a) restated one layer up** | **CHANGED — Change 4.** De-duplicated to a pointer, NOT re-copied with new values. |

**Sites checked and found clean (no change needed):** `Team Knowledge/SOPs/SOP-022-work-order-preflight.md`
(no occurrence), `Team/Mack - Automation Specialist/AGENTS.md` L98 (states the default; does **not** make a
non-`none` value a refusal trigger), `Team/agent-index.md` L11 (Mack envelope summary, same),
`Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md` L40 (a different proposition — that a
private surface never widens `credential_scope`; compatible with, and re-asserted by, limb 4).

**The drift is Keel-specific.** No other specialist contract in the estate makes a non-`none` authority
value a refusal condition in itself.

---

## 3. Why critical rule 3 had to move too

The original Work Order named only sites 121–123 and 623–625. **Amending only those would not have reached
the order's own stated outcome**, because critical rule 3 is an *independent* absolute:

> *"NEVER touch a live service, scheduled task, or non-throwaway database."*

WO-2026-08-12-02's own bounded deviation grants **live Fusion gateway calls** and **SELECT-only reads of
`asdair.regulars` — a live, non-throwaway database.** A fresh Keel reading a contract amended only at the two
named sites could still refuse that order on critical rule 3 alone, and the conflict would recur on the next
live-execution order.

Raised at read-back, **upheld by Larry** (WO-2026-08-12-03 § ⚑ AMENDMENT 1, C1/M1), and option **(B)** —
reconcile critical rule 3 in the same commit — was authorised, with the three never-reachable items required
to appear **in the contract text itself**.

---

## 4. The changes, in full

### Change 1 — `Team/Keel - Implementation Engineer/AGENTS.md`, § "Work Order intake", lines 121–123

**BEFORE (exact):**

```
Missing any mandatory field → **REFUSED**, naming the missing field. `credential_scope: none` and
`live_authority: none` are the standing defaults and the only values Keel may act under; any other
value is itself a REFUSED condition until Nolan has amended this contract.
```

**AFTER (exact):**

```
Missing any mandatory field → **REFUSED**, naming the missing field.

### The authority defaults, and the only route by which they move

*(Amended by Nolan, 2026-08-12, on Warwick's explicit instruction — WO-2026-08-12-03. The previous wording
made any value other than `none` a refusal condition in itself, which contradicted the canonical Work Order
template and `tools/wo/envelope.mjs`, both of which treat these as defaults with a declared deviation
route. This amendment closes that contradiction; it does not widen what Keel may do.)*

`credential_scope: none` and `live_authority: none` are the **standing defaults**. They bind unless the
Work Order carries an explicit deviation **on the field itself** — and a deviation is valid **only** when
**all four** of these hold. Check them at the read-back, in this order:

1. **DECLARED.** Written on the field in the order's frontmatter, with its escalation. Never inferred from
   the outcome or the acceptance criteria, never read out of prose or a narrative aside, never supplied
   mid-dispatch by a message. **An authority that is not on the field does not exist.**
2. **EXTERNALLY AUTHORISED.** Carrying an escalation naming **who** authorised it and **when** — Warwick,
   or Larry recording Warwick's explicit instruction. **Nobody authorises their own deviation, and you
   never grant yourself one** — not from the shape of the work, not because the acceptance criteria appear
   to need it, not because refusing would cost a round trip.
3. **BOUNDED.** Naming the exact systems, operations and limits. "as needed", "full access", "whatever the
   work requires", or any phrasing whose scope you would have to interpret, is **not a deviation — it is a
   missing field** → REFUSED.
4. **NEVER WIDENING CRITICAL RULE 4.** A `credential_scope` deviation may permit credential material to be
   **CONSUMED by a mechanism the order names** — a runtime loading an env file whose path the order
   declares, for example — with the carrier never opened by you. It may **never** permit you to read, open,
   parse, echo, log, quote, copy or write credential material, and never to touch another session's
   credentials or credential store, `~/.codex/*` included. **Critical rule 4 is unchanged by any deviation,
   and no deviation may be read as widening it.**

**Anything the deviation does not name is still `none`.** A deviation is a narrow enumerated exception —
never a mode you enter, and never a general licence for the duration of the order.

**Three things NO deviation ever reaches** (critical rule 3 carries the same list, and it governs):

- a **migration or DDL** against a non-disposable database;
- **any write to live data** — INSERT, UPDATE, DELETE;
- **operating or supervising a live service** — start, stop, restart, deregister.

Fail any limb, or find that you must infer the scope → **REFUSED**, naming the limb that failed.

**Where the generated envelope table and the operative frontmatter disagree on an authority field**, that is
a **defect in the order** → **CLARIFY at the read-back**, naming both values. **Never act on the wider of
the two** until Larry confirms which governs. A known generator defect prints the template defaults in the
table while the frontmatter carries the deviation; that contradiction is never a licence.
```

---

### Change 2 — same file, § "Critical rules", rule 3, lines 382–383

**BEFORE (exact):**

```
3. **NEVER touch a live service, scheduled task, or non-throwaway database.** Migrations run only
   against a disposable local/CI Postgres.
```

**AFTER (exact):**

```
3. **NEVER touch a live service, scheduled task, or non-throwaway database.** Migrations run only
   against a disposable local/CI Postgres.

   **This binds absolutely under the standing default, and is displaced ONLY to the exact extent of a
   valid bounded `live_authority` deviation** — one that passes all four limbs in "Work Order intake" and
   **names both the target and the permitted operations**. A deviation naming a live *read* never permits
   a write; one naming a single system never reaches another; **anything it does not name remains
   forbidden.** *(Amended by Nolan, 2026-08-12, on Warwick's explicit instruction — WO-2026-08-12-03.)*

   **⛔ Three things NO deviation ever reaches, and no Work Order may grant:**

   - a **migration or DDL** against a non-disposable database;
   - **any write to live data** — INSERT, UPDATE, DELETE;
   - **operating or supervising a live service** — start, stop, restart, deregister. That is Mack's, and
     the first live start is a Warwick gate (see "The Mack boundary").

   An order purporting to grant one of those three is **REFUSED**, naming it. The deviation mechanism
   cannot reach them, so no authority written into an order can confer them.
```

---

### Change 3 — same file, § "Verdict definitions", REFUSED, lines 623–625

**BEFORE (exact):**

```
- **REFUSED** — the Work Order was not actionable (missing mandatory field — including `runbook_path`
  on a Work Order that hands a service to Mack — `credential_scope`/`live_authority` other than `none`,
  a material defect found at preflight, or an AC that cannot be delivered inside the surface).
```

**AFTER (exact):**

```
- **REFUSED** — the Work Order was not actionable (missing mandatory field — including `runbook_path`
  on a Work Order that hands a service to Mack — a `credential_scope`/`live_authority` **deviation that
  fails any of the four limbs** in "Work Order intake": undeclared or self-assumed, carrying no named
  authority, vague or unbounded, or purporting to widen critical rule 4 or to reach one of critical
  rule 3's three never-reachable items — a material defect found at preflight, or an AC that cannot be
  delivered inside the surface).
```

**Why this wording:** the refusal now points at the **test**, in its one canonical home, rather than
restating a value. Change 1 and Change 3 can no longer drift apart, because Change 3 no longer carries an
independent statement of the rule.

---

### Change 4 — `.claude/agents/keel.md`, `description:` (line 3) — two passages

The shim is a **thin pointer**. `CLAUDE.md` § "Hard rules that constrain edits here": *"Two layers max for
any specialist: the wiki contract plus the host shim."* The shim currently asserts the authority values **as
facts**, which is a duplicated operating rule in a pointer file — **the duplication that produced this drift
in the first place.** It is therefore de-duplicated, **not re-copied with fresher values**.

**BEFORE (exact, passage S1):**

```
Spec-bound and ephemeral — one instance per Work Order, bounded to a declared file surface, credential_scope none, live_authority none.
```

**AFTER (exact, passage S1):**

```
Spec-bound and ephemeral — one instance per Work Order, bounded to a declared file surface and to whatever authority the Work Order declares under the contract's rules; the standing authority defaults and the only valid deviation route are defined in the contract, never here.
```

**BEFORE (exact, passage S2):**

```
Never touches live services or credentials, expands scope, performs a first live start, force-pushes, deletes branches, touches `main` outside an authorised merge, acts outside its assignment, or declares its own work merge-ready or operationally accepted.
```

**AFTER (exact, passage S2):**

```
Never expands scope, performs a first live start, force-pushes, deletes branches, touches `main` outside an authorised merge, acts outside its assignment, or declares its own work merge-ready or operationally accepted; access to live systems and to credential material is governed solely by the contract's authority rules and its critical rules, which this shim does not restate.
```

**Nothing else in the shim changes.** Its body already carries the governing line — *"Contract loaded; it
governs; on any difference with this shim, the contract wins."*

---

## 5. Sites deliberately left untouched, and why

- **L301–302** (*"…never sees, requests or writes its value"*) — the Keel/Mack **configuration-ownership**
  boundary. It states what holds under the default, and Change 1's *"anything the deviation does not name is
  still `none`"* keeps it true. Editing it would put a second statement of the deviation rule into the file,
  which is what Change 3 exists to remove.
- **L311–313** (*"Two standing rules survive this boundary unchanged…"*) — the proposition is that **the Mack
  boundary** does not weaken critical rule 3 or `live_authority: none`. That remains exactly true, and its
  operative claim — *"it never means Keel operates the live thing"* — is now **strengthened**, appearing
  verbatim in Change 2's never-reachable list.
- **L401–402** (critical rule 4, *"`credential_scope: none` is absolute"*) — **a different proposition**: no
  harvesting of credential material, including another session's store. Untouched by design and re-asserted
  twice (Change 1 limb 4, Change 2). Collapsing it into the standing-default clause was the single most
  likely way to fail this Work Order.
- **`Team Knowledge/Templates/work-order.md`** — out of surface, and it is the **correct** position. The
  contract drifted from it; it is not edited to meet the contract halfway.

---

## 6. AC6 — verdict walk-through against the amended wording

The safety property is tested in **both** directions: one ACCEPT case, then **five** REFUSE counter-cases —
one per limb, plus one for the never-reachable list. *(The Work Order asked for one counter-case; walking a
single limb under-tests the property. Expansion confirmed by Larry, AMENDMENT 1.)*

### ACCEPT case — the real order, `Deliverables/2026-08-12-wo-b15-30-region-granularity-and-measurement.md`

Its frontmatter carries four deviations, each with the escalation comment
*"# DEVIATION from standing default `none`. ESCALATION: Warwick, 2026-08-12 — region-granularity ruling;
dispatch explicitly authorised without further approval."*

| Limb | Test | Evidence in the order | Verdict |
|---|---|---|---|
| 1 DECLARED | on the field in frontmatter | `credential_scope:` and `live_authority:` both carry the value on the field, each with its escalation comment | **PASS** |
| 2 EXTERNALLY AUTHORISED | names who and when | *"ESCALATION: Warwick, 2026-08-12 — region-granularity ruling"* | **PASS** |
| 3 BOUNDED | exact systems, operations, limits | *"live Fusion gateway calls against the one named photograph, and SELECT-only reads of `asdair.regulars`. NO database writes, NO browser, NO ASDA session, NO checkout, NO production call site invoked"*; network *"the Fusion gateway host only"* | **PASS** |
| 4 NOT WIDENING RULE 4 | consumed, never inspected | *"credentials CONSUMED, never inspected, exclusively via `node --env-file`… The carrier file is NOT a surface and must NEVER be opened, parsed, echoed, logged or written"* | **PASS** |
| Never-reachable (rule 3) | no DDL · no live write · no operating a service | *"SELECT-ONLY… NO INSERT, UPDATE, DELETE or DDL"*; no start/stop/restart of any service | **NONE REACHED** |
| Rule 3 displacement | target and operations named | live gateway (named host, one named photograph) and `asdair.regulars` (SELECT-only) — both named | **VALID, to that extent only** |

**Verdict on the authority question: ACCEPT.** Under the *pre-amendment* contract this same order was
**REFUSED** twice on the bare value, and again reachable on critical rule 3.

> **Whole-order caveat, and it is not a defect in this amendment.** That order's *generated envelope table*
> prints `credential_scope | none` and `live_authority | none` (lines 286–288) while its frontmatter carries
> the deviations. Under Change 1's final paragraph, a fresh Keel's **whole-order** verdict is therefore
> **CLARIFY**, naming both values — **not REFUSE, and never silent action on the wider value.** The
> generator defect is Larry's to fix; this clause is the worker-side safeguard until he does.

### Counter-case 1 — limb 1, SELF-ASSUMED

Same order, deviations **stripped from the frontmatter** (fields read `none`), while the acceptance criteria
still require live gateway execution. → *"An authority that is not on the field does not exist"*; *"never
inferred from the outcome or the acceptance criteria."* → **REFUSED**, naming limb 1.

### Counter-case 2 — limb 2, NO NAMED AUTHORITY

Deviations present and bounded, **escalation comment removed** (or left as `AUTHOR REQUIRED`). → *"Carrying
an escalation naming who authorised it and when"*; *"Nobody authorises their own deviation."* → **REFUSED**,
naming limb 2.

### Counter-case 3 — limb 3, UNBOUNDED

`live_authority: as needed for the experiment`, escalation properly named. → *"'as needed', 'full access',
'whatever the work requires'… is not a deviation — it is a missing field."* → **REFUSED**, naming limb 3.

### Counter-case 4 — limb 4, ANOTHER SESSION'S CREDENTIALS

`credential_scope: BOUNDED — read the gateway key from the local .env and from ~/.codex/auth.json`,
declared, authorised by Warwick, and tightly bounded — **it passes limbs 1, 2 and 3.** → limb 4: *"may never
permit you to read, open, parse… credential material, and never to touch another session's credentials or
credential store, `~/.codex/*` included. Critical rule 4 is unchanged by any deviation."* → **REFUSED**,
naming limb 4. Critical rule 4 (L401) is untouched and independently forbids it.

### Counter-case 5 — the never-reachable list (critical rule 3)

`live_authority: BOUNDED — apply migration 0007 to the production asdair database`, declared, authorised,
and bounded — **it passes limbs 1, 2 and 3.** → *"a migration or DDL against a non-disposable database"* is
never reachable; *"An order purporting to grant one of those three is REFUSED, naming it."* → **REFUSED**.
**This is the counter-case that proves option (B) closed the conflict without loosening the absolute.**

**Both halves hold.** The amendment permits a bounded, declared, externally-authorised deviation, and
refuses a self-assumed one, an unauthorised one, an unbounded one, one reaching credential material, and one
reaching a live write, a DDL, or the operation of a live service.

---

## 7. REPORT ONLY — NOT APPLIED

*Everything in this section is a recommendation. Nothing here has been implemented. It is placed in the
redline so an independent reviewer sees it without being told it exists (WO-2026-08-12-03 AC5, M3).*

### 7.1 Nolan's own contract does not grant contract amendment (AC5)

`Team/Nolan - HR/AGENTS.md` covers **hiring** — authoring a **new** specialist's contract via the eight-step
SOP-001 sequence. **It contains no clause about amending an existing contract**, which is why
`tools/wo/envelope.mjs` could not clear the surface for this Work Order and why every `contract_basis` entry
had to be resolved by Larry's explicit grant instead of by extraction. Yet Keel's contract has, until today,
named Nolan as the amender (*"until Nolan has amended this contract"*). **The estate assumed an ownership
that was never written down.**

**Recommended closure — Warwick's decision, not mine, and deliberately NOT applied here:**

1. **Add a short § "Amending an existing contract" to `Team/Nolan - HR/AGENTS.md`**, stating: Nolan owns
   specialist contract *text* estate-wide; he may amend an existing contract **only** on an explicit Warwick
   authorisation naming the conflict; the exact redline is written and committed **before** the amendment is
   applied; **Nolan never amends his own contract**; and independent review follows the patch. That is four
   or five sentences, and it is the smallest thing that closes the gap.
2. **Do NOT create a new SOP for it.** SOP-001 is the hiring procedure and should stay that. An amendment is
   a bounded, Warwick-authorised, rare act, and the sequence above is short enough to live in the contract.
   `CLAUDE.md`'s regrowth cap applies at full force — a new SOP, register or tracker would be the diagnosis
   Warwick has already rejected.
3. **Separately and independently: `Team/Nolan - HR/AGENTS.md` has no § "Where Nolan writes".** This is why
   the envelope generator emitted `permitted_file_surface: NOT EXTRACTABLE` and `critical_rules: NOT
   EXTRACTABLE` for this dispatch. Every future Nolan Work Order will hit the same wall and be resolved by
   hand. Adding a "Where Nolan writes" section (`Team/<Name> - <Role>/AGENTS.md` for hires, `.claude/agents/
   <slug>.md`, `Team/agent-index.md`, `Deliverables/**` for briefs and redlines) would make Nolan's orders
   machine-checkable like Keel's.

**Why I did not apply any of it:** Warwick authorised fixing the **Keel** conflict. Self-modification on
relayed authority is exactly what `CLAUDE.md` § "No silent constitutional self-modification" prohibits, and
a specialist quietly granting itself the authority it has just been observed to lack is the worst possible
precedent to set inside a Work Order about unauthorised authority.

### 7.2 Other findings — reported, not fixed

- **The envelope-table defect is real and I saw it live.** `Deliverables/2026-08-12-wo-b15-30-…md` prints
  `none` for `credential_scope`, `live_authority` and `network` in its generated table (lines 286–288) while
  its frontmatter carries four bounded deviations. **Every deviating order contradicts itself on its own
  face.** Change 1's final paragraph is the worker-side safeguard; the generator remains Larry's to fix, and
  the safeguard should be retired once it is (`CLAUDE.md`: retire a compensating control once the root cause
  is fixed).
- **The same drift does NOT exist in other contracts.** Mack's contract (L98), `Team/agent-index.md` (L11)
  and GL-012 (L40) state the standing defaults but none makes a non-`none` value a refusal trigger. **No
  sweep is needed**, which is the answer to the Work Order's "if the same drift exists elsewhere" question.
- **GL-012 L40** — *"`credential_scope: none` is the standing authority for every worker and is unchanged by
  this Guideline"* — is compatible with this amendment and needs no change. Its proposition is that a
  declared private surface never widens `credential_scope`, which Change 1 limb 4 re-asserts verbatim in
  effect. Recorded here only so a reviewer does not have to re-derive it.
- **The Work Order's required secret-scan command was malformed** — `--surface Team/Keel - Implementation
  Engineer/AGENTS.md` is unquoted and contains spaces, so a shell splits it into `Team/Keel`, `-`,
  `Implementation`, … and the scan either exits `2` or examines ground that is not the surface. Caught at
  read-back, upheld, and superseded by Larry; the properly quoted form was run instead.

---

## 8. Independent review

**This amendment has not been independently reviewed at the time of writing.** Larry dispatches Veritas on
the resulting commit, per `CLAUDE.md` § "No silent constitutional self-modification". **The three
never-reachable items in Change 2 are the safety property** — a reviewer should start there, then check that
critical rule 4 (L401) is byte-unchanged, then walk §6's six cases against the applied text.

**Nolan self-assessment — NOT independent review.**
