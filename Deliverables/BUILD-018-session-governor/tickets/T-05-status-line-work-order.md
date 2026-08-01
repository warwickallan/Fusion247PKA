---
# --- identity and authority ---
name: T-05 status-line display of the evaluator verdict
work_order_id: WO-2026-07-31-02
build: BUILD-018
wp_number: n/a
status: draft
authorised_by: Warwick
authorised_date: 2026-07-31
owner: keel
return_to: larry
blocking_dependencies: []
tags: [build-018, t-05]

# --- scope ---
outcome: >
  tools/governor/status-line.mjs exports a pure renderer that turns a T-04 evaluator verdict into a
  single compact status-line string covering all five states (GREEN/AMBER/RED/RECOVERY/BLIND), plus one
  impure composition function that calls evaluate(signals) defensively so that an evaluate() throw still
  renders a BLIND line rather than crashing the caller or silently reporting a healthier state.
file_surface:
  - tools/governor/status-line.mjs
  - tools/governor/status-line.test.mjs
  - Deliverables/BUILD-018-session-governor/evidence/T-05-status-line.md
out_of_scope_policy: report-only

# --- authority (standing defaults) ---
credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none

# --- environment ---
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor

# --- inputs and handoffs ---
schema_decision: n/a
security_inputs: n/a
operational_handoff: none
runbook_path: n/a
---

## Acceptance criteria

AC1 — A renderer (exact export name Keel's choice, documented in the return) renders a distinct,
readable line for each of the five evaluator states — GREEN, AMBER, RED, RECOVERY, BLIND — driven by
real `evaluate()` output over representative signal combinations (reuse `evaluator.test.mjs`'s existing
fixtures / the 64-combination sweep rather than inventing new signal shapes).

AC2 — **Mutation test named by the map (02-MAP.md §9, T-05 row): when `evaluate(signals)` throws, the
status line still renders, and it renders BLIND** — never crashes the caller, never returns
`undefined`/empty, and never reports GREEN/AMBER/RED/RECOVERY on a throw (INV-1, AD-3: unreadable
telemetry is never GREEN).

AC3 — AD-11 purity split, matching the `model-gate.mjs` (T-15) precedent: the function that turns a
verdict into text is pure — zero filesystem/git/myPKA imports, verdict-object in, string out — and
exactly one impure composition function wraps `evaluate()` in a try/catch and calls the pure renderer.
The pure renderer itself must be independently unit-testable with a hand-built verdict object, without
ever calling `evaluate()`.

AC4 — Degrades gracefully: a verdict object missing optional fields (e.g. `advice` absent, `reasons`
empty, `unknownSignals` absent) still renders without throwing.

## Required evidence

- `node --test "tools/governor/status-line.test.mjs"` → must report **>0** executed subtests, verbatim
  output and exit code.
- `node --test "tools/governor/*.test.mjs"` → full governor suite green, before/after counts, zero
  regressions (current baseline: 514/514 — see 02-MAP.md §9 T-16 row).
- `bash scripts/secret-scan.sh --surface tools/governor/status-line.mjs tools/governor/status-line.test.mjs Deliverables/BUILD-018-session-governor/evidence/T-05-status-line.md`
  → exit 0. Report exit code and what it covered per critical rule 15 (exit 2 = NOT SCANNED, not a pass).

## Inputs supplied

- `tools/governor/evaluator.mjs` (T-04, resolved) — the verdict shape to render:
  `{ state, exitCode, reasons, unknownSignals, examinedSignals, advice }`, states in
  `evaluator.mjs`'s `STATE` export, priority `BLIND > RECOVERY > RED > AMBER > GREEN`.
- `tools/governor/model-gate.mjs`'s `renderCompactGate` (T-15) — the precedent pattern to follow: pure
  core + one impure composition wrapper, compact multi-line text format. Read it before writing the new
  module; do not reinvent the split.
- `Deliverables/BUILD-018-session-governor/02-MAP.md` §4 (state meanings/advice) and §9 (T-05's own
  acceptance + mutation test row) — canonical for what "renders all five states" and "degrades
  gracefully" mean here.
- No schema decision, no security findings — this ticket touches no data store and no external surface.

## Explicitly out of scope

- **Wiring this renderer into the live `statusLine` command / `.claude/settings.local.json`.**
  Deliberately deferred, matching T-03's sampler precedent: production activation into the primary
  checkout's live config needs separate Warwick per-use authorisation under a read-back gate this
  dispatch does not carry. Build and prove the renderer in isolation; do not wire it live.
- Gathering live signals from the real estate (health store reads, git state, worktree recon) beyond
  what is needed to drive the pure renderer's tests. That is T-12's portability-adapter scope, still
  frontier and not part of this order.
- Any change to `tools/governor/programme-state.mjs`, `02-MAP.md`'s `GOVERNOR:STATUS` block, or
  `programme-state.json`'s `tickets[]`. Those are Larry-only, via `resolveTicketAndAdvance`, after this
  Work Order closes.
- T-06 (RED preflight block), T-08 (live dogfood), T-12 (portability extraction) — separate tickets.
