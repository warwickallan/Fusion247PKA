---
name: WO-ZA — runtime health, recovery, and the private-surface leak in the proof harness
work_order_id: WO-2026-08-04-RUNTIME-HEALTH
build: BUILD-015
wp_number: WO-ZA
status: issued
authorised_by: Warwick
authorised_date: 2026-08-04
authority: BUILD-015-END-TO-END-RECOVERY
owner: keel
return_to: larry
blocking_dependencies: [WO-B]
tags: [asdair, build-015, runtime, health, recovery, private-surface]
private_surface: none
credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
out_of_scope_policy: report-only
worktree: none — primary checkout, C:\Fusion247PKA
branch: build-015/live-acceptance-recovery-2026-08-03 — DO NOT COMMIT, Larry holds git
schema_decision: n/a — no schema change
security_inputs: n/a
operational_handoff: none — bounded change inside an already-released service, not a new handoff to Mack
---

# WO-ZA — runtime health, recovery, and the proof harness's private-surface leak

**Outcome:** the AsdAIr supervised runtime reports its own health honestly, survives restart
without duplicating or dropping work, and cannot report an interpretation it did not perform.

> **This order was REFUSED at read-back on 2026-08-04 and the refusal was upheld.** The
> original was under-specified on eight mandatory fields, contained two acceptance items that
> could not be delivered inside the declared surface, and — the finding that mattered — was
> preflighted against a harness that violates its own declared private surface. What follows
> is the amended order. The refusal is recorded here rather than tidied away: the order needed
> more scrutiny than the work, which is the standing lesson.

## File surface

- `services/asdair/pipeline-runtime/**`
- `services/asdair/interpret/interpret-list.js` — fail-close only

Explicitly **not** owned: `pipeline/**`, `bot/**`, `skill/**`, `outcome/**`, `reconcile/**`,
`packet/**`, the rest of `interpret/**`, `cockpit-api/**`, `.github/workflows/**`.

## Items

### 1 — dependency-aware health *(restated at read-back)*

Strengthen dependency-aware health in `asdair-status.mjs`. `problems[]` / `healthy` already
go red when the `pg` driver is unresolvable (`asdair-status.mjs:184-185, 231`); build on that.

**The `/asdair/health` literal is NOT in this surface.** The `ok: true` that lied on
2026-08-03 is a hardcoded object at `cockpit-api/httpApi.js:100-107` — it depends on nothing
and can never go red. That half is assigned to the cockpit agent (WO-ZG), which is actively
writing that file. **Both halves get fixed, by different hands, in the same branch.** This
split is the serialisation the read-back correctly asked for.

### 2 — stall detection: liveness by wall clock, not by the process table

The runtime is judged healthy because its process exists. It must be judged by **when it last
did work**, against wall clock.

**Derive the threshold; do not invent it.** Read the actual poll/tick interval from code and
config, set the default as a stated multiple of the *measured* interval with a documented
floor, expose an env override, and write the derivation down. A number Larry picks from the
air is as arbitrary as one the builder picks — the difference that matters is grounding in the
real tick rate.

**Mutation-test the detector:** freeze the clock past the threshold and prove `healthy` goes
false. A stall detector never made to fire is not evidence (2026-07-29 standing lesson).

Recovery: detection plus surfacing through the existing `--status` / `--restart` / `--stop`
(`ensure-asdair-runtime.mjs:1101-1111`) is sufficient. **Do not build a new operator action.**

### 3 — restart and resume without duplicating or dropping

Neither duplicate a shop nor drop a Telegram update across restart. The persist-before-ack
boundary (fixed 2026-07-28 — the shop is written inside `onRecord` before the offset moves)
must be **verified and proven not regressed**, not assumed.

### 4 — one interpretation entry point, fail closed *(retirement foreclosed)*

**FAIL-CLOSE confirmed. Retirement is not available**: `catalogueGrounding.test.js:156-169`
reads `interpret-list.js` as text and pins three source strings — `loadCatalogue(client`,
`await vision(`, `buildGroundedPrompt`, **in that order**. That suite is in CI
(`.github/workflows/asdair-tests.yml:122`) and its file belongs to another agent. **Preserve
all three strings.**

Fail closed when: no catalogue · empty catalogue · catalogue not supplied to the model ·
model unavailable · output claims an unknown id.

**It must not be able to report success without the model call having happened.** This is
D-2026-08-03-04 — a `--dry-run` that skipped the model call entirely was mistaken for proof
the model path worked, and it cost a live shop.

### 5 — sanitized grounding evidence — **REMOVED from this order**

The production call is `realInterpretPhoto` (`pipeline/deps.js:157-181`, wired at `315-318`).
That is outside this surface and no agent owns it. **Larry takes it on the integration
surface.** Do not touch `pipeline/**`.

### 5A — **fix the private-surface leak in the proof harness** *(new; highest priority)*

`run-proofs.mjs` PROOF 9 overrides `ASDAIR_RUNTIME_STATE_DIR` but **not**
`SHOPPER_INTAKE_STATE_FILE`, so `collect()` → `readOffset()` → `intakeStateFile()`
(`runtime-paths.mjs:41-48`) falls through to the **real household intake state file** under
`C:/.fusion247/asdair/` **and prints its contents**. The file header asserts it touches no
credentials file. **That claim is false**, and has been on every run since.

- Override `SHOPPER_INTAKE_STATE_FILE`, and **sweep `runtime-paths.mjs` for every other path
  helper with the same fall-through**. Enumerate them; do not spot-check. If one escaped,
  assume siblings did.
- **Correct the file header** to say what it actually touches.
- **Add a control that fails if any proof resolves a path under `C:/.fusion247/`.** A boundary
  with no test is a comment.
- Print nothing from those files under any code path.

This is what makes `private_surface: none` true rather than merely written down.

### 5B — sequencing

**5A blocks the harness.** Land 5A first, then run `run-proofs.mjs` for items 2/3/6 evidence.
Do not run it again beforehand.

### 6 — correct the stale §5b narrative

`run-proofs.mjs:283` heading and its present-tense comment at 284-294 contradict the
assertions at 321-326, manufacturing a false data-loss alarm. Resolves to the
`DEFECT-LEDGER.md` **line-948** entry.

## Evidence bar

| Gate | Baseline at preflight |
|---|---|
| `node --test` in `pipeline-runtime` | 91 pass / 0 fail |
| `node proof/run-proofs.mjs` | 50/50 — **only valid after 5A** |
| `node --test` in `interpret` | 16 pass |
| `secret-scan.sh --surface <explicit file list>` | 0 secrets, exit 0 |

**The file-list scan form is the required evidence**, with its narrower coverage — named files
only, not the folder — **stated explicitly in the handback**, not implied away by exit 0. The
folder form exits 1 on three vendored `pg-connection-string` README examples in gitignored
`node_modules`; removing them would break the `pg` resolution WO-B depends on.

## Known and accepted gaps, to be restated in the handback

- **`pipeline-runtime` is absent from CI** (D-2026-07-28-20, still open). No step in
  `asdair-tests.yml` uses it as a working directory, so **every test added here is
  builder-run only and gates no merge**. Larry owns the fix; it must still appear in the
  handback rather than be resolved by a promise.
- `D-2026-08-03-21` is used **twice** in `DEFECT-LEDGER.md` (lines 868 and 948). Larry's to fix.

## Boundaries

Do not commit. Do not touch `pipeline/**` or `cockpit-api/**`. No new runtime dependencies.
Out-of-scope findings are reported, not fixed.
