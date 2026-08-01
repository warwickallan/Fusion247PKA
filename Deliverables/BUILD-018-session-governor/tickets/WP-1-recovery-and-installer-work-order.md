---
# --- identity and authority ---
name: Session recovery coverage, installer honesty, and the model-recommendation source
work_order_id: WO-2026-08-01-01
build: BUILD-018
wp_number: WP-1
status: draft
authorised_by: Warwick
authorised_date: 2026-08-01
owner: keel
return_to: larry
blocking_dependencies: []
tags: [build-018, wp-1, session-governor]

# --- scope ---
outcome: >
  A session that starts fresh, resumes, or is cleared actually reorients; the installer tells the
  truth about what it changed and what must happen before that change can take effect; and the
  status line's model recommendation comes from the active build rather than whichever state file
  sorts first.
file_surface:
  - tools/governor/reorient.mjs
  - tools/governor/reorient.test.mjs
  - tools/governor/install-hooks.mjs
  - tools/governor/install-hooks.test.mjs
  - tools/governor/statusline-live.mjs
  - tools/governor/statusline-live.test.mjs
out_of_scope_policy: report-only

# --- authority ---
credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none

# --- environment ---
worktree: C:/Fusion247PKA-wo-01
branch: build-018/wp1-recovery-and-installer

# --- inputs and handoffs ---
schema_decision: n/a — no schema change in this WP
security_inputs: n/a
operational_handoff: none
runbook_path: n/a
---

# WP-1 — recovery coverage, installer honesty, model-recommendation source

Three defects, all established by execution, none dependent on any design decision still open.
Silas is concurrently deciding the execution controller, the footer grammar and the constitution's
placement — **none of that is in this Work Order.** Do not build toward it.

## The evidence behind each defect

Read `Deliverables/BUILD-018-session-governor/evidence/LARRY-hook-contract-probe.md` (Larry's own
executed probe) and `Deliverables/BUILD-018-session-governor/audit/NOLAN-01-visible-journey-and-config.md`
(Nolan's independent audit). Both are committed on the parent branch. They are the source for
everything asserted below; if you find either contradicts reality, that is a `CLARIFY` at read-back.

### D1 — reorientation never runs on a fresh or resumed session, and the defect is two layers deep

- `install-hooks.mjs` installs the `SessionStart` hook with `matcher: 'clear'` and nothing else.
- `reorient.mjs` **separately** refuses any other source internally:
  ```js
  if (source !== 'clear') {
    return { verdict: VERDICT.SKIPPED, context: null, reason: `source=${source ?? '(absent)'} is not "clear"` };
  }
  ```
- Observed `SessionStart.source` values on Claude Code 2.1.220: **`startup`** (fresh process,
  confirmed), **`resume`** (`claude -c`, confirmed), `clear` (the installed matcher), `compact`
  (not probed — treat as unknown, and say what you did about it).

**Widening the matcher alone changes nothing** — the hook would fire and the script would return
`SKIPPED`. Both layers must change together. A test asserting only the matcher would pass while the
behaviour stayed broken; that is the exact false-control failure this estate has already been burned
by, so the acceptance test must assert a **rendered brief**, not an invocation.

Warwick's requirement, verbatim: *"On every new Claude session and every SessionStart following
`/clear`"*. `resume` is included because it is one of the three real ways a build is re-entered.

### D2 — the installer cannot be observed to work, and misreports what it did

Nolan established that **hooks are snapshotted at Claude Code process launch**: a hook deleted from
settings at 17:05:08Z still fired at 21:39Z, and one `claude.exe` started before the install has
served every session since. `statusLine`, by contrast, is read live. So:

- **Installing a hook has no effect until Claude Code is fully restarted, and nothing says so.**
- `install-hooks.mjs` contains **zero** occurrences of `statusLine`, so the one surface that
  currently works is not reproducible after a merge or on another machine.
- `--check` reproduces a **superset** of the live state, silently activating the delegation observer
  and gate.
- It reports `pruned: none` while a hook whose script does not exist is still executing.

### D3 — the model recommendation is read from the wrong file

`statusline-live.mjs:recommendedModel()` iterates `Deliverables/*` and returns the **first**
`programme-state.json` it finds, not the active build's. It also renders a byte-identical
`next: <model>` at GREEN, AMBER, RED **and** BLIND.

**In scope here:** select the *active build's* state file, and do not render a recommendation
sourced from a state file that does not correspond to the running build.
**NOT in scope here:** the `UNSET` predicate and the footer grammar — Silas owns those. If the
correct source cannot be identified, render nothing rather than a wrong value, and report it.

## Acceptance criteria

- **AC1** — `reorient()` produces a rendered brief for `source` in `startup`, `clear` and `resume`.
  Proven by a test that asserts on the **brief's content**, not on the fact that the function was
  called. A deliberate mutation (revert the source guard) must turn that test red.
- **AC2** — `install-hooks.mjs` installs the `SessionStart` hook with a matcher covering the same
  source set as AC1, and a test proves the written settings object contains it.
- **AC3** — any run of `install-hooks.mjs` that **changed** anything emits an unmissable notice that
  Claude Code must be fully restarted before the change takes effect. A run that changed nothing
  must not emit it. Both directions tested.
- **AC4** — `install-hooks.mjs` installs `statusLine` as part of its managed set, idempotently, and
  a test proves a fresh install reproduces it.
- **AC5** — `--check` reports the live state faithfully: it must not present a superset as though it
  were current, and it must not report `pruned: none` when a prunable hook is present. Tested with a
  fixture containing a hook whose target script does not exist.
- **AC6** — `recommendedModel()` resolves the **active build's** state file, proven by a fixture with
  two `Deliverables/*` state files where the alphabetically-first one is NOT the active build.
- **AC7** — the pre-existing suite still passes in full. Baseline executed by Larry at parent HEAD
  `6a01498`: **607 tests, 607 pass, 0 fail** via `node --test "tools/governor/*.test.mjs"`.
  Note `node --test tools/governor/` (directory form) fails with `MODULE_NOT_FOUND` on this machine —
  use the glob form.

## Required evidence

- `node --test "tools/governor/*.test.mjs"` → must report **>0 executed subtests** and 0 failures.
  A suite reporting zero executed subtests is a FAILURE, not a pass.
- For AC1 and AC5, the **mutation test**: show the command, the deliberate break, and the test going
  red — then restored. INV-5 of the Goal Contract: no control is trusted until it has been made to fail.
- `bash scripts/secret-scan.sh --surface tools/governor` → exit `0`. Exit `2` is NOT SCANNED and is
  not a pass; state what the scan actually covered next to whatever it returned.
- `git diff --stat` against your branch point, reconciled against `file_surface`; count outside must be 0.

## Inputs supplied

- Larry's executed hook-contract probe — `Deliverables/BUILD-018-session-governor/evidence/LARRY-hook-contract-probe.md`
- Nolan's independent audit — `Deliverables/BUILD-018-session-governor/audit/NOLAN-01-visible-journey-and-config.md`
- Goal Contract (wins over this order if they disagree) — `Deliverables/BUILD-018-session-governor/01-GOAL-CONTRACT.md`

## Explicitly out of scope

- The `Stop` hook / execution controller, the Governor footer, the `UNSET` predicate, and any change
  to `CLAUDE.md`, any `AGENTS.md`, `Team/agent-index.md` or `programme-state.schema.json`. Silas is
  deciding these now; building against a guess would be rework.
- Removing, relocating or repairing the Tower `bridge-ingest.mjs` Stop hook or
  `ensure-capture-gateway.mjs`. Larry has proven multiple `Stop` hooks compose safely; Tower is
  PARKED and stays untouched.
- `02-MAP.md`, `programme-state.json`, and any ticket resolution. Larry owns those.
- Any git operation beyond committing inside `C:/Fusion247PKA-wo-01`. **Larry owns branches, pushes,
  PRs and merges** — this is constitution clause 5, not a preference.
