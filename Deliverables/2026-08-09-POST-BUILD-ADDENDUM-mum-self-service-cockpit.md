# POST-BUILD ADDENDUM — Mum's self-service Cockpit

> # ⛔ NON-GATING. THIS IS NOT BUILD-015.
>
> **This addendum begins AFTER BUILD-015 succeeds.** It does **not** alter, extend, delay or re-grade
> BUILD-015 in any way.
>
> **BUILD-015's North Star, acceptance criteria, migration route, final-head review, production-017
> authority and fresh-photo acceptance remain EXACTLY as they are.** Nothing in this document may
> become a blocker for closing BUILD-015, and **nothing here changes today's definition of "done".**
>
> Commissioned by Warwick on 2026-08-09 as parallel scope/establishment while session budget
> remained. **Researched and scoped now; built afterwards.**

---

## The separate North Star

> **Can Mum — an 84-year-old, technology-phobic woman with poor eyesight and coordination —
> independently create and resolve her own weekly shopping order from her Amazon Fire tablet, with
> Warwick required only when the real ASDA checkout and payment must be performed?**

**This is primarily A DIFFERENT INPUT METHOD INTO ASDAIR. It is NOT a second shopping pipeline.**
It reuses the product truth BUILD-015 is establishing.

---

## What is REUSED UNCHANGED from BUILD-015 — the point of the whole design

BUILD-015 has just built, and Gate-1 assured, the machinery this addendum depends on. **None of it is
rebuilt:**

- **`asdair.shop_decision`** (migration 017, **insert-only by grant**, composite FK to `shop_question`)
  — the durable current-shop decision, with `question_round` and `parent_question_id` carrying
  clarification rounds.
- **`decideAnswer`** — a deterministic candidate resolves with **zero model calls**; free text goes to
  **bounded Terra** (`gpt-5.6-terra`, gateway-only, no fallback), which may only assert product
  identities present in its supplied grounding, with the FK as the enforcement.
- **`clarification_required` → a real round-2 question**, and the five failure paths that now all
  land there rather than stranding.
- **The gate**: `READY_TO_SHOP` is unreachable while a required line is unresolved.
- **The park that speaks**, and the outbox/renderer machinery behind it.
- **Truthful provenance**: `interpreted_by` ∈ `terra | human | rule`, and a durable actor on commands.

> **⛔ DO NOT DUPLICATE THE DECISION SPINE.** No Cockpit-only shadow question table. No separate
> interpretation semantics. No Larry relay. No requirement for Mum to own Telegram.

---

## The architecture question that decides this addendum

**Find the earliest TRANSPORT-INDEPENDENT seam.** Telegram/photo, the Mum Cockpit and any future
input surface must converge into **ONE durable shopping-list/shop representation as early as
possible**, after which the existing machinery owns everything:

```
list / shop → planning → questions → answers → durable current-shop decisions
           → recomputation → readiness → packet / trolley → reconciliation
```

**Known selections are already structured facts** and must not spend a Terra call to rediscover an
identity we already hold. **Free text travels the normal semantic path**, where interpretation is
genuinely needed.

> **The establishment must name the exact existing production caller and seam — NOT "the Cockpit can
> call the pipeline."** Warwick's standing technique applies at full force:
> **when a module looks complete, find its production caller; when a comment says the loop closes,
> trace the value to the consumer.**

**Known starting fact:** the Cockpit is **backend-only today**. `cockpit-api/httpApi.js:196` implements
`POST /asdair/command`, the live Cockpit server never mounts it, and its own shipped copy claims it
*"forwards the same named commands the Telegram bot uses"* before routing the user away to Telegram.

---

## Questions must come back to MUM

**Mum does not use Telegram.** A clarification must appear **visibly in HER Cockpit** — *"which Ariel
did you mean?"*, *"I couldn't understand 'nice biscuits', which of these?"*, *"just this week or from
now on?"* — answerable by **large deterministic candidate buttons** or a **large free-text box**, and
entering **the same durable question/answer/decision path**.

**Refresh or restart must not lose a pending question.** If something is waiting for her, the Cockpit
must make that **unmistakable**.

## Warwick observes; he does not relay

He keeps useful Telegram notifications so he can **monitor**: shop started/submitted · waiting on Mum
· questions resolved · plan ready · trolley progress · blocked/failure needing him · **basket ready
for his checkout**. **Not every UI interaction**, and **an ordinary clarification must never be
actionable only from his Telegram.**

## Separate principal

**Same household does NOT mean same human.** Durable evidence must distinguish **Mum submitted this ·
Warwick submitted this · rule/system decided this · Terra interpreted this**. **Tailnet reachability
is not authentication** — do not share Warwick's administrative Cockpit identity merely because both
devices sit inside it. Authentication must suit a permanently assigned household tablet and **must not
put an 84-year-old through repeated login ceremonies**; the secure low-friction option, not an
enterprise IAM project.

## The human-factors bar

> **"This is not satisfied because a developer can operate the page on Chrome."**

Fourteen acceptance criteria centred on the actual human, ending at: **the journey reaches a correctly
built and reconciled basket without Warwick operating the shopping process, and his first required
intervention is checkout and payment.** Accessibility deliberately **more generous** than generic
minimums, with **concrete numbers** — *"WCAG compliant"* is not evidence.

---

## Supporting establishments — commissioned 2026-08-09, filed separately

| | Establishment | File |
|---|---|---|
| **A** | Device / connectivity / accessibility platform truth | `2026-08-09-addendum-A-fire-platform-truth.md` |
| **B** | Product / UX specification | `2026-08-09-addendum-B-mum-cockpit-ux.md` |
| **C** | Pipeline / data architecture seam | `2026-08-09-addendum-C-pipeline-seam.md` |
| **D** | Identity / security / routing | `2026-08-09-addendum-D-identity-and-routing.md` |
| **E** | Acceptance / assurance matrix | `2026-08-09-addendum-E-acceptance-matrix.md` |

**Consolidated conclusions, work-package slices, dependencies, and the split between unresolved facts
and genuine Warwick product decisions are folded in as each establishment returns.** Where an
establishment did not return before the session closed, that is stated here rather than left blank.
