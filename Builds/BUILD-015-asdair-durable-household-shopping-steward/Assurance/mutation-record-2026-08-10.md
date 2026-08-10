# Mutation record — WO-2026-08-10-B15-04 and B15-05

**Written to discharge the Gate 1 HOLD on B15-04 AC4** (`veritas-wp-b15-04-05-gate1-3696960.md`):

> *"no committed mutation record anywhere I could find, and M4 reported **ineffective** means an
> assertion is unproven with nothing naming which. Unknown on a mandatory property → HOLD."*

**Provenance is stated per row and is not uniform.** Rows marked **worker-reported** are the builders'
own accounts, transcribed by Larry and **not independently re-executed**. The row marked
**Larry-executed** was re-run against `main` after integration, with its output pasted.

---

## The one Veritas actually named — re-run independently

**M4 was ineffective**, and the assertion it failed to test was **the duplicate guard**: that a
duplicate receipt carrying *different words* must not count as settled. M4 set the initialiser
`let recorded = true`, which the `if (duplicate)` branch overwrites on the very next line — so it
applied cleanly, changed nothing, and left the suite green for the wrong reason.

**Larry-executed, 2026-08-10 ~02:5x, against `main` at `0f180c3`.** Mutation disables the guard
itself rather than its initialiser:

```
recorded = await recordedAnswerMatches(deps, {...});   ->   recorded = true;
```

```
--- diff must be non-empty (proves the mutation APPLIED) ---
 services/asdair/pipeline/runtime.js | 4 +---
 1 file changed, 1 insertion(+), 3 deletions(-)
diff lines: 15
--- running pipeline suite (expect RED) ---
not ok 269 - B15-04 DUPLICATE: a duplicate receipt with DIFFERENT words is not settled, so nothing is swallowed
# tests 385
# pass 384
# fail 1
RESTORED, sha256 matches: de26c682912b60cc
```

**One test red, and it is the right one. The assertion M4 left unproven is proven.**

> **⚠️ The first attempt at this same mutation SILENTLY FOUND NOTHING** — the pattern was written with
> `\n` and the file is CRLF. The harness printed `diff lines: 0` and refused to report a result
> (`MUTATION DID NOT APPLY - result meaningless`). **That is the same CRLF trap the AC3 builder reported
> hitting earlier the same night.** Restore ran from a `trap`, so the source was never left mutated —
> `sha256` verified identical on every exit, including the two failed attempts.

---

## Worker-reported ledgers — transcribed, NOT independently re-executed

### WO-2026-08-10-B15-04

| # | Mutation | Reported result |
|---|---|---|
| M1 | deferred-clarification window recognition off | 3 tests red |
| M2 | remove the notice enqueue while keeping the claim (the **silent drop** Larry forbade) | 3 AC2 tests red |
| M3 | per-message idempotency guard off | the 20-pass storm test red |
| **M4** | `let recorded = true` on the initialiser | **INEFFECTIVE — reported as such by the builder, not hidden.** Value overwritten by the next branch; suite stayed green for the wrong reason |
| M4b | duplicate guard removed | red |

Each was verified applied by diff against a saved copy before any red or green was trusted, and
`runtime.js` was reported byte-identical afterwards.

### WO-2026-08-10-B15-05

| # | Mutation | Reported result |
|---|---|---|
| 1 | empty-plan guard disabled | only the AC6(f) refusal test fails |
| 2 | lease restored to `45_000` | only the lease invariant fails |
| 3 | `openedBy: 'manual:larry'` | only the AC5 provenance test fails |
| 4 | `handoffBlock` reverted to the receipt shape | **4 tests across 2 packages** fail — both AC7 tests and the AC5 real-pass test |

Plus `handoff/mutation-proof.js`: **9/9 guards still load-bearing.**

---

## The transferable lesson, because it cost two attempts tonight

**An UNAPPLIED mutation and an APPLIED-BUT-INEFFECTIVE one are indistinguishable from the exit code.**
The saved-byte-copy diff catches the first. **Only reasoning about reachability catches the second** —
ask whether the value you changed is the one the assertion depends on, *and whether control reaches it
before something overwrites it*. A mutation that does not change behaviour has tested nothing, and it
looks exactly like a passing test.

Banked to memory: `a-control-is-not-evidence-until-made-to-fail`.
