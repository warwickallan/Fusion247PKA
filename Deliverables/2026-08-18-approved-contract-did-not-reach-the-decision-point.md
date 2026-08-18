# The approved contract did not reach the decision point

**Warwick, 2026-08-18, correcting Larry's account of his own finding:**

> The failure was NOT: *"Warwick never changed the contract."*
> The failure was: **"the approved contract change did not reach the specialist/runtime decision point,
> while Larry reported the contract as durably changed."**

**That distinction is the whole finding, and it is recorded here because the wrong version is already
in a commit message on `main` (`3f53532`).**

## What I claimed, and why it was wrong

I ran two commands — `git log` over `Team/Asdair - Household Shopping Steward/AGENTS.md` and over
`.claude/agents/asdair.md` — found nothing since 2026-08-05, and reported: *"the contract was never
changed."* I measured **one artefact** and generalised to **the decision**. It is the same error as
reconciling to a derived list instead of the source, committed twice in one day.

## What is actually true — the trace, by execution

### 1. The Goal Contract WAS re-cut, and it is intact on `main`

```
cc6d906  2026-08-17T21:00:58+01:00  BUILD-015 GOAL CONTRACT RE-CUT — AsdAIr is Mum's autonomous AI shopping operator
2b77224  2026-08-17T21:16:36+01:00  AsdAIr ITSELF is the weekly shopping runtime — the operational contract, banked
57c1986  2026-08-17T21:28:56+01:00  The ASDA product NAME is the identity. The product id is not.
```

`Builds/BUILD-015-asdair-durable-household-shopping-steward/BUILD-015-goal-contract.md` carries the
ruling today — **7 occurrences** of the agentic/autonomous/AI-judgement language. Its own words:

> **AI JUDGEMENT IS NOW THE CONTRACT, NOT A FALLBACK.** A previously unseen product with no stored ASDA
> id is a NORMAL case AsdAIr resolves itself… **A deterministic executor may provide the hands but must
> never be the semantic decision-maker.**

> **THE CAUSAL DIAGNOSIS, recorded in the contract so it is not re-learned:** the capable model was
> engineered out of the loop and replaced by weak deterministic components, each certified in isolation.

### 2. It was banked into the Wayfinder

§ 1 GOAL CONTRACT AND NORTH STAR, re-cut 2026-08-17. The ⚑ OPERATIONAL CONTRACT block: *RUNTIME OWNER
— AsdAIr itself · LARRY — not the weekly runtime · FAILURE — any technical or manual bridge through
Warwick or Larry.*

### 3. Nothing later removed or superseded it

`git log --since=2026-08-17` over the goal contract returns those three commits and nothing else. **No
merge, reconcile or convergence touched it.** The approved change is not lost; it is unpropagated.

### 4. Where propagation failed — three places, and the third is the worst

| Authority | Should carry the ruling | Last changed | State |
|---|---|---|---|
| `Builds/…/BUILD-015-goal-contract.md` | ✅ canonical | 2026-08-17 | **CORRECT** |
| Wayfinder § 1 + ⚑ OPERATIONAL CONTRACT | ✅ | 2026-08-17 | **CORRECT** |
| `Team/Asdair …/AGENTS.md` | ✅ the specialist's own law | **2026-08-05** | ⛔ **CONTRADICTS IT** |
| `.claude/agents/asdair.md` | ✅ the shim a dispatch reads | **2026-08-11** | ⛔ stale |
| **The runtime itself** | ✅ the actual decision point | — | ⛔ **CONSUMES NO CONTRACT AT ALL** |

The specialist contract still states the reversed architecture as current:

> line 13 — *"Asdair is the **judgement, explanation and supervised-operation layer** over the
> **deterministic** BUILD-015 shopping pipeline"*
> line 28 — *"Review and explain the **deterministic** basket plan."*

**And the third row is the one that matters most.** `SOP-021` appears in `services/asdair/**` only
inside code comments. **There is no runtime authority document and no channel by which any contract
reaches the executing code.** So even a perfectly propagated specialist contract would not reach the
decision point — the executable half of this gap is a separate defect from the documentary half.

## The consequence, measured

A full day of 2026-08-18 was spent improving deterministic components — a word-overlap corroboration
gate, an answer-binding rule, a planner word filter — because **the authority a worker actually reads
still said the deterministic pipeline was the architecture.** Each order was well-formed. Each was
aimed below the frontier. **Warwick had to say it four times.**

This is the estate's own named class, applied to itself: **a rule that exists, is correct, and is
never consumed is indistinguishable from a rule that was never written.** It was already the diagnosis
for why AsdAIr asks Warwick questions his Favourites already answer. It turns out to be the diagnosis
for why *that* was not fixed either.

## Disposition

- **Documentary half:** dispatched to Nolan — propagate the approved ruling into the specialist
  contract and its shim, superseding in place. **Not a new contract; the goal contract stays canonical.**
- **Executable half:** the runtime has no contract channel. That is the frontier work and it is
  **implementation of an existing approved contract**, not a new product decision.
- **`3f53532`'s commit message is corrected by this document.** History is not rewritten.
