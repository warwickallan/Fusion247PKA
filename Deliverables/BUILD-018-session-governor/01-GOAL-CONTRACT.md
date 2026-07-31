---
name: build-018-goal-contract
type: goal-contract
build: BUILD-018
status: proposed
created: 2026-07-31
---

# BUILD-018 — GOAL CONTRACT

Compact and binding. If an implementation ticket cannot be traced to a line in this contract, it is
scope creep. If this contract and any ticket disagree, **this contract wins** and the ticket is the
defect.

## The outcome, in one sentence

**One logical Larry owns a substantial Fusion build across many fresh Claude Code conversations
without losing product intent, decisions, worker outputs, source-control control, or the exact next
action — and Warwick is told, reliably and once, when the current conversation should be rotated.**

## What "done" looks like (the acceptance shape)

Warwick can run a multi-week build. When a conversation approaches its useful limit he receives a
single clear recommendation with the evidence behind it. He runs `/rotate-session`; state is banked
and *verified*; he is told the exact command to type; he types `/clear`; the fresh Larry comes up
already knowing what it is building, what was decided, what is in flight, and what to do next — with
no re-briefing from Warwick.

## Seven capabilities (from the commission — each maps to tickets)

1. **Advice** — reliable recommendation on when rotation is worthwhile.
2. **Proof** — executable checks proving whether rotation is *safe*.
3. **Banking** — durable capture of programme and repository state.
4. **Instruction** — the exact `/clear` invocation for Warwick.
5. **Reorientation** — the fresh Larry is oriented automatically.
6. **Reconciliation** — worktree and worker lifecycle accounted for.
7. **Protection** — a new substantial item cannot be started when health says rotate.

## Non-negotiable invariants

- **INV-1 — BLIND IS NOT GREEN.** If the evaluator cannot read the telemetry it needs, it reports
  `BLIND`, never `GREEN`. A governor that silently stops measuring must become *louder*, not quieter.
  Every state carries a distinct exit code so "did not run" can never be mistaken for "healthy".
- **INV-2 — The governor must never trap Warwick.** Every blocking path fails **open**. A hook that
  errors, times out, or cannot parse its input lets the prompt through. Availability of Warwick's own
  session outranks enforcement, always.
- **INV-3 — Durable state is the source of truth; conversation memory is not.** Anything the fresh
  Larry must know is on disk and in git before rotation is declared safe.
- **INV-4 — Rotation never runs the close ceremony.** `/rotate-session` must not invoke
  `/close-session`, write a programme session log, or perform sign-off.
- **INV-5 — No control is trusted until it has been made to fail.** Every check ships with a mutation
  test proving it goes red on a broken input, and asserts a non-zero count of things actually examined.
- **INV-6 — Privacy survives rotation.** Banked state for a private-surface build obeys
  GL-012 §6a: the full record lives in the private surface, the public repo gets a generic marker.
- **INV-7 — Recommend, do not act.** The governor never rotates by itself, never runs `/clear`, never
  commits on Warwick's behalf without the standing push authority already in force.

## Explicitly out of scope

- Any change to `/close-session`'s behaviour.
- Automatic invocation of `/clear` (it is native, human-invoked, and stays that way).
- The VlogOps product build.
- Cleaning, pruning or merging any pre-existing worktree or branch.
- Opening or merging the recovery PR.

## Success measures

| # | Measure | How proven |
|---|---|---|
| M1 | Health verdict correct across the state space | Unit tests over synthetic signal sets + mutation tests |
| M2 | `BLIND` never renders as `GREEN` | Mutation test: delete/corrupt the state file, assert exit code ≠ GREEN |
| M3 | Rotation safety catches a genuinely unsafe estate | Mutation test: dirty tree / unpushed commit / live worker → refuses |
| M4 | Fresh Larry reorients with zero re-briefing | **Live dogfood**: an actual rotation, then a fresh session completes a ticket unaided |
| M5 | Recommendation delivered once, not nagged | Test: repeated evaluations at steady state produce one delivery |
| M6 | Portable | Evaluator core has zero myPKA paths; runs against a synthetic estate adapter |

**M4 is the real acceptance test.** The others are necessary; only M4 proves the product.
