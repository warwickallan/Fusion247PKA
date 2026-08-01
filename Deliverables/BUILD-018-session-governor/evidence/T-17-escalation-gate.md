---
ticket: T-17
build: BUILD-018
kind: evidence
date: 2026-08-01
private_surface: none
---

# T-17 evidence — mechanical git-lifecycle escalation gate

All proofs below were **executed**, not reasoned about.

Work Order: `Deliverables/BUILD-018-session-governor/tickets/T-17-escalation-gate-work-order.md`
(WO-2026-07-31-03). Keel returned a CLARIFY read-back naming two concrete concerns
(the "is this cosmetic" determination has no mechanical signal and would be
self-attestation by the escalating actor; the gate as first specified would cover only
one narrow shape of AD-26, not AD-26 generally). Larry answered with an **amended**
Work Order rather than overriding the CLARIFY — both concerns are fixed at the design
level, not papered over: the cosmetic determination is removed from the gate entirely
and the refusal is re-grounded on AD-20 alone (Larry owns the complete git lifecycle,
unconditionally); the narrowed scope is accepted knowingly and AC6 requires this
document and the module header to say so in terms. Per SOP-022, an amended order is
itself the authorisation to proceed; this build did not require a second read-back.

## 1. Deliverable

- `tools/governor/escalation-gate.mjs` — `classifyEscalation(describedEscalation)` (pure
  core, AD-11: zero filesystem/git/myPKA-estate imports) + `evaluateEscalationGate(...)`
  (the one impure composition function, matches only `AskUserQuestion`, injectable
  `describe`/`classify` for testing) + `runEscalationGateHook(raw)` (stdin-based
  PreToolUse entrypoint, mirrors `delegation-gate.mjs`'s `runCheckHook`) + a `check` CLI
  subcommand, never wired into `install-hooks.mjs` (out of scope).
- `tools/governor/escalation-gate.test.mjs` — 60 tests.

## 2. ACTUAL COVERAGE — stated honestly, per AC6

**This gate detects and refuses exactly one mechanically-decidable shape**: an
`AskUserQuestion` whose offered options propose a git history/lifecycle operation
(`push --force`/`-f`, `--force-with-lease`, `commit --amend` targeting an already-pushed
ref, `rebase`, `reset --hard`, `filter-branch`, `filter-repo`) as a choice for Warwick.
The refusal rests on **AD-20 alone** — Larry owns the complete git lifecycle,
unconditionally — never on any judgement about whether the underlying defect is
cosmetic. That determination has no mechanical signal and was removed from the design
entirely (see Keel's CLARIFY read-back, recorded in the Work Order's AMENDMENT section).

**This gate does NOT enforce AD-26 generally.** AD-26 also says never escalate typos,
wording, formatting, naming, ticket boundaries, completed workers, or ordinary routing
choices. **None of those categories have any enumerable, mechanical signal this module
(or, as far as this ticket determined, any mechanical module) can check.** They have no
detector here and remain **unenforced**. Larry observing AD-26 for those categories is,
exactly as before this ticket, unaided by any control. Do not read any wording in this
document, the module header, or the returned verdict reasons as implying broader
coverage than the single shape above.

## 3. Governor suite — before/after, zero regressions

Before (this ticket's own preflight baseline, matches the Work Order's stated baseline
exactly):

```
node --test "tools/governor/*.test.mjs"
1..528
# tests 528
# pass 528
# fail 0
```

After:

```
node --test "tools/governor/*.test.mjs"
1..588
# tests 588
# suites 13
# pass 588
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

588 − 528 = 60, exactly this ticket's new file. Zero regressions, zero new failures.

## 4. This ticket's own suite

```
node --test "tools/governor/escalation-gate.test.mjs"
1..60
# tests 60
# suites 13
# pass 60
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

## 5. AC1 — three-way enumerable verdict

`VERDICT = { REFUSED, ALLOWED, UNCLASSIFIABLE }`, each with a distinct `EXIT_CODE`
(`ALLOWED: 0`, `UNCLASSIFIABLE: 1`, `REFUSED: 2` — UNCLASSIFIABLE deliberately never
shares ALLOWED's code, mirroring `evaluator.mjs`'s BLIND-is-never-GREEN discipline).
`UNCLASSIFIABLE` is proven distinct from ALLOWED by construction: an explicitly-supplied
empty `proposedOperations: []` is a confident, checked "nothing here" → **ALLOWED**; a
missing or malformed `proposedOperations` field is "cannot tell" → **UNCLASSIFIABLE**
(absence is unknown, never zero — the same rule `evaluator.mjs` applies to every
signal). Both are exercised as distinct test cases.

## 6. AC2 — enumerable vocabulary, not free-text intent parsing

`GIT_LIFECYCLE_OPERATIONS` is exported and contains exactly the seven required tokens:
`push-force`, `force-with-lease`, `amend-pushed`, `rebase`, `reset-hard`,
`filter-branch`, `filter-repo`. `classifyEscalation` — the pure core — makes its
decision by membership check against this frozen array over an already-structured
`proposedOperations` list; it does zero text parsing itself. Each of the seven
operations is proven individually to produce REFUSED (7 tests), plus a multi-operation
case and an unrecognised-token-is-ignored case.

A **separate, honestly-labelled heuristic layer** (`detectGitLifecycleOperations`,
`detectEscapeHatchReason`, `describeEscalationFromToolInput`) exists below the core
because the real `AskUserQuestion` surface hands this module free text, not a
pre-built list. It is exported and tested independently from the mechanical core so the
two are never confused: the module header names this split explicitly and states the
heuristic is biased toward **under**-detection (a missed paraphrase falls through to the
safe UNCLASSIFIABLE/ALLOWED path) and must never invent a match that produces a
wrongful REFUSED. Proven:

- bare `"amend"` with no push/pushed context never fires `amend-pushed` (a routine,
  unpushed amend must never be treated as escalation-worthy);
- `"amend"` + `"already-pushed"` context fires `amend-pushed` even without the word
  "force" — exactly D-4's own phrasing;
- `"force push"` (two words) and `--force-with-lease` are each detected as distinct
  operations;
- two explicit false-positive checks: `"roll back the deploy"` does not fire
  `reset-hard`/`rebase`; `"force a customer refund"` does not fire `push-force`.

## 7. AC3 — the D-4 scenario, with NO "is cosmetic" input anywhere

Two independent tests, both asserted to classify **REFUSED**, and grep-checked at
review time to confirm neither constructs a field named `cosmetic`/`isCosmetic`/
`defectKind` or similar:

1. **Structured**: `{ proposedOperations: ['amend-pushed', 'push-force'] }` →
   `classifyEscalation` returns REFUSED, reason text matches `/AD-20/` and explicitly
   states `"regardless of whether the underlying defect is cosmetic"`.
2. **Text-extraction, end to end**: a realistic `AskUserQuestion` `tool_input` built
   from D-4's actual wording ("Amend and force-push" / "force-push the already-pushed
   history to correct the subject line") is run through
   `describeEscalationFromToolInput` → `detectGitLifecycleOperations` correctly detects
   both `push-force` and `amend-pushed` → `classifyEscalation` → REFUSED →
   `evaluateEscalationGate({ toolName: 'AskUserQuestion', toolInput })` → `DECISION.DENY`.

Neither test path ever reads, sets, or checks any cosmetic-related field — the refusal
demonstrably stands on the matched operations (AD-20) alone.

## 8. AC4 — fail-open, proven in every direction, plus the positive control

**Positive control** (the required proof that a genuinely warranted escalation is never
refused): three realistic escalations modelled on the WO's own named examples — a merge
decision, a spend decision, an irreversible live action — are each run through
`describeEscalationFromToolInput` (confirmed to extract zero git-lifecycle operations —
no false positive) and through the full `evaluateEscalationGate`, asserted never to
return `DECISION.DENY`.

**Mutation tests, every direction**:

| Forced failure | Result |
|---|---|
| `describe()` (extraction) throws (injected) | `ALLOW`, never propagates |
| `classify()` throws (injected), on an input that the REAL classifier would have marked REFUSED | `ALLOW`, never `DENY` — the dangerous-direction case: fail-open holds even when the injected failure hides a genuine match |
| Malformed JSON stdin | `ALLOW` |
| Empty stdin | `ALLOW` |
| Valid JSON but not an object (an array) | `ALLOW` |
| A would-be-REFUSED payload run end-to-end with NO injected failure | `DENY` — confirms the mutation tests above are not vacuously always-ALLOW; the gate genuinely can and does deny when nothing is broken |

`classifyEscalation` itself is proven capable of throwing under adversarial input (a
`Proxy`-wrapped array whose iterator throws) — proving the injected mutation in
`evaluateEscalationGate`'s tests exercises a real failure class, not a synthetic no-op.

Non-`AskUserQuestion` tools (tested: `Bash`) always `DEFER`, regardless of `tool_input`
content — a `git push --force` inside a `Bash` call is worktree-guard's/delegation-gate's
business, not this gate's; this gate only ever looks at `AskUserQuestion`.

## 9. AC5 — the escape hatch is a closed enum, checked by exact equality

`ESCAPE_HATCH_REASONS = ['unsafe-repository-state']`, frozen, single-entry (not
v1-populated beyond what AD-26 actually names — mirrors `delegation-gate.mjs`'s
`SPECIALIST_MATCH_ENUM` "reserved but not populated" discipline). Proven:

- a valid reason clears a matched operation to ALLOWED, and `escapeHatchUsed` is
  populated in the returned verdict — **visible, not silent**;
- **mutation**: an arbitrary unrecognised string (`"because-i-said-so"`) does **not**
  clear a refusal — proves the enum is genuinely closed, not merely documented as
  closed;
- **mutation**: an empty-string reason does not clear a refusal;
- the escape hatch present with no matched operations is a harmless no-op and is
  correctly *not* recorded as used (nothing needed excusing).

Detection from real text uses a **literal marker string**
(`[AD-26:unsafe-repository-state]`), not sentiment: prose describing an unsafe state
*without* the literal marker is correctly **not** recognised — proven by test — because
inferring the escape hatch from free text would reopen exactly the judgement problem
this gate exists to avoid.

## 10. AC6 — coverage honesty, checked structurally

A dedicated test reads the module's own source and asserts the header literally
contains `"IT DOES NOT ENFORCE AD-26 GENERALLY"`, `"UNENFORCED"`, and names each of the
seven unenforced categories (typo, wording, formatting, naming, ticket boundaries,
completed workers, ordinary routing) — so a future edit to the header that silently
drops this honesty statement fails the suite rather than drifting unnoticed.

## 11. Real subprocess CLI proof (AC1 — "usable from a PreToolUse hook")

Not wired into `install-hooks.mjs` (explicitly out of scope), but the `check` CLI
subcommand is proven as a real child process, not just in-process function calls
(mirrors T-15's own precedent for this):

- a REFUSED-shaped payload over real stdin → process exits **0** (a PreToolUse hook
  always exits 0, even when it denies) and prints the correct `hookSpecificOutput` deny
  JSON, reason text matching `/AD-20/`;
- an ALLOWED-shaped payload → exit 0, **no stdout output at all**;
- malformed stdin → exit 0, no crash, no output;
- an unrecognised subcommand → exit **1** with usage on stderr (a CLI usage error, not a
  hook failure — the one path where non-zero is correct, matching `delegation-gate.mjs`'s
  own `main()` convention).

## 12. Structural checks

- A source-scan test asserts `escalation-gate.mjs` never imports `node:fs` or
  `node:child_process` and never shells out — genuinely pure end-to-end except for the
  CLI's own stdin read, which is unavoidable for a process reading a hook payload.
- `worktree-guard.mjs` and `delegation-gate.mjs` are **byte-unmodified**:
  - `node --test "tools/governor/worktree-guard.test.mjs"` → 27/27, `git diff --stat`
    empty.
  - `node --test "tools/governor/delegation-gate.test.mjs"` → 60/60 on a clean rerun.
    **Noted honestly**: one earlier rerun in this same session reported 59/60 (one
    failure) while multiple heavy test suites were being run back-to-back on this
    machine; the very next rerun, in isolation, was clean at 60/60 with an unmodified
    `git diff`. This is recorded as an observed one-off flake under load, not silently
    omitted — `delegation-gate.test.mjs`'s own concurrency test spawns real OS
    processes and its header already documents sensitivity to timing. No change was
    made to `delegation-gate.mjs` or its test file at any point; the file's `git diff`
    was empty throughout.

## 13. Secret scan — surface-scoped, coverage and exit code

```
bash scripts/secret-scan.sh --surface tools/governor/escalation-gate.mjs tools/governor/escalation-gate.test.mjs Deliverables/BUILD-018-session-governor/evidence/T-17-escalation-gate.md
```

Reported verbatim, with exit code and coverage, in the handback return to Larry per
critical rule 15 — this document is written before that final run.

## 14. Known fog — carried forward honestly, not solved here

- **The real `AskUserQuestion` PreToolUse `tool_input` schema is unproven.** No local
  evidence of it exists anywhere in this estate (Keel's T-17 preflight searched and
  found none — unlike T-01's proven statusLine schema). `describeEscalationFromToolInput`
  is built against Keel's own documented assumption
  (`tool_input.questions: [{ question, header, options: [{ label, description }] }]`).
  If the real shape differs, extraction yields nothing usable and the call falls
  through to UNCLASSIFIABLE → ALLOWED (fail-open still applies) — but this has **not**
  been confirmed against a real captured payload. This is fog for the separate,
  not-yet-authorised activation step, exactly as T-03's sampler deferred live
  statusLine wiring.
- **AD-26's non-git categories remain entirely unenforced** (see §2). This is not a gap
  in this ticket's execution; it is the accepted, knowing scope of what shipped —
  Larry's own acceptance of the amended Work Order names this explicitly.

## 15. Explicitly not done here (out of scope, per the amended Work Order)

- Not installed/activated into `.claude/settings.local.json` via `install-hooks.mjs`.
- `worktree-guard.mjs` and `delegation-gate.mjs` were not modified (see §12).
- No attempt to classify "cosmetic vs material" or to enforce AD-26's non-git
  categories — removed by the amendment, see §2.
- `programme-state.json`'s `tickets[]`, `02-MAP.md`'s `GOVERNOR:STATUS` block, and the
  write-back log were not touched.
