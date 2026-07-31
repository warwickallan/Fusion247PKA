---
ticket: T-05
build: BUILD-018
kind: evidence
date: 2026-07-31
private_surface: none
---

# T-05 evidence — status-line renderer for the T-04 evaluator verdict

All proofs below were **executed**, not reasoned about. Where a control claims a
behaviour, it was run and observed, including the mutation named by the map (a control
that has never been made to fail is an assumption).

Work Order: `Deliverables/BUILD-018-session-governor/tickets/T-05-status-line-work-order.md`
(WO-2026-07-31-02). Read-back returned and ACCEPTed by Larry before any implementation —
all four points raised in the read-back (fixture-reuse reading, injectable `evaluateFn`
parameter, synthetic BLIND-on-throw construction, single-line vs. model-gate.mjs's
multi-line precedent) were confirmed as read, in writing, before this module was built.

## 1. Deliverable

- `tools/governor/status-line.mjs` — `renderStatusLine(verdict)` (pure: verdict object
  in, string out; zero filesystem/git/myPKA-estate imports — only imports from
  `./evaluator.mjs`) and `computeStatusLine(signals, { evaluateFn = evaluate })` (the
  one impure composition function; catches any throw from `evaluateFn` and renders a
  synthetic BLIND verdict instead of propagating it).
- `tools/governor/status-line.test.mjs` — 14 tests.

## 2. Governor suite — before/after, zero regressions

Before (captured at read-back, pre-implementation):

```
node --test "tools/governor/*.test.mjs"
1..514
# tests 514
# pass 514
# fail 0
```

After:

```
node --test "tools/governor/*.test.mjs"
1..528
# tests 528
# pass 528
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

528 − 514 = 14, exactly this ticket's new file. Zero regressions, zero new failures.

## 3. This ticket's own suite

```
node --test "tools/governor/status-line.test.mjs"
1..14
# tests 14
# pass 14
# fail 0
```

## 4. AC1 — a distinct, readable line for each of the five states, driven by real `evaluate()`

Representative signal combinations were built from `evaluator.mjs`'s own `SIGNAL_KEYS`
shape (not invented signal names), one per state:

| State | Signals | Real `evaluate()` state (asserted) |
|---|---|---|
| GREEN | `{ contextUsedPercentage: 10 }` | GREEN |
| AMBER | `{ contextUsedPercentage: 60 }` | AMBER |
| RED | `{ contextUsedPercentage: 90, safeBoundary: true }` | RED |
| RECOVERY | `{ contextUsedPercentage: 10, compactions: 1 }` | RECOVERY |
| BLIND | `{}` | BLIND |

Both `renderStatusLine(evaluate(signals))` and `computeStatusLine(signals)` (the real
integration path, default `evaluateFn`) were exercised over all five and asserted to
name their own state and carry the evaluator's own advice text. All five rendered lines
were asserted pairwise distinct (`Set` size 5).

## 5. AC2 — the mutation test named by the map (02-MAP.md section 9, T-05 row)

**"Evaluator throws → line still renders, shows BLIND."** Forced by injecting a
throwing `evaluateFn`:

```
MUTATION (AC2): evaluate() throwing an Error -> status line still renders, and renders BLIND, not a crash
ok

MUTATION (AC2): evaluate() throwing a non-Error value (e.g. a bare string) -> still renders BLIND, never crashes
ok
```

Asserted: `computeStatusLine` never propagates the throw (`assert.doesNotThrow`), the
returned line is a non-empty string, it names `BLIND`, and it never reports its own
state as GREEN/AMBER/RED/RECOVERY. (One early version of this assertion blanket-checked
the line for the *substring* `"GREEN"` and failed — the real BLIND advice text
legitimately contains the words "never report GREEN" as part of its own warning. Fixed
to check the line's actual reported state via the `GOVERNOR <STATE> ` prefix instead of
a substring ban; noted here because it is exactly the kind of false-positive a mutation
test can produce if written carelessly.)

## 6. AC3 — AD-11 purity split

- `renderStatusLine` exercised directly with **hand-built verdict objects** (one per
  state, matching the real shape `evaluate()` returns) — `evaluate()` is never called
  in this test. All five hand-built lines asserted distinct.
- Structural regression guard: `status-line.mjs`'s own source is read and every
  `import` line asserted to reference only `./evaluator.mjs`; explicitly asserted
  absent: `node:fs`, `node:child_process`, `node:process`, and every stateful
  estate module (`health-store.mjs`, `programme-state.mjs`, `worktree-guard.mjs`,
  `collect-state.mjs`, `sampler.mjs`).

## 7. AC4 — degrades gracefully

Verdict missing `advice` entirely, missing `unknownSignals` entirely, carrying an empty
`reasons` array, `null`, `undefined`, and a non-object (bare string) verdict were all
passed to `renderStatusLine` and asserted to render a non-empty string without
throwing.

## 8. Secret scan — surface-scoped, exit code and coverage reported

```
bash scripts/secret-scan.sh --surface tools/governor/status-line.mjs tools/governor/status-line.test.mjs Deliverables/BUILD-018-session-governor/evidence/T-05-status-line.md
```

Reported inline in the handback return, per critical rule 15 (this document is written
before that final run — see the return to Larry for the executed output and exit code).

## 9. Explicitly not done here (out of scope, per the Work Order)

- Not wired into the live `statusLine` command or `.claude/settings.local.json`.
- No live signal gathering (health store reads, git state) — this module only renders
  a verdict object; producing one from the real estate is T-12's scope.
- `programme-state.mjs`, `02-MAP.md`'s `GOVERNOR:STATUS` block, and
  `programme-state.json`'s `tickets[]` were not touched.
