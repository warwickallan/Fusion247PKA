# WO-2026-08-05-08 — `reorient.mjs` must sweep the SESSION's root, not the module's

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-08 |
| **status** | ISSUED · **issued/by:** 2026-08-05 / Larry · **owner:** Keel |
| **governance_head** | `1b299e317fcab4894504a7483c2b2d4a0cf826cc` |
| **authorised_by / date** | Warwick, 2026-08-05 — map §14.0 W-1, gate S-1. **Unblocks `WO-2026-08-05-07`** |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — §14.19, §14.20 |
| **branch** | `build-020/reorient-explicit-root` · **worktree:** `C:\Fusion247PKA-wo-reorient` — **yours, not the shared tree** |
| **file_surface** | `tools/governor/reorient.mjs` · `tools/governor/reorient.test.mjs` · `Deliverables/proofline/EVIDENCE-2026-08-05-wo-08-reorient-root.md` |
| **private_surface** | `none` · **credential_scope:** none · **network:** none · **live_authority:** `none` |
| **acceptance_property** | **`reorient.mjs` executed from OUTSIDE the repository still sweeps the SESSION's `Deliverables/`, resolved from the hook payload `cwd` — proven by running the module from a path where a module-relative root would yield nothing** |
| **veritas_gate** | Phase 2 (§14.0c S-1) · **integration_owner:** Larry · **out_of_scope_policy:** report-only |
| **operational_handoff** | none · **dependency_policy:** no new runtime deps · **blocking_dependencies:** none |
| **document_impact** | the map — owner: larry |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ the governance head |
| **contract_basis** | `tools/governor/**` — core Keel surface · `Deliverables/**` — not prohibited wholesale |
| **contract_conflicts** | none · **capability_evidence:** Keel delivered WO-01, -02, -03, -05 and -06 on this module this session · **return_to:** Larry |

## The defect — found by Mack in operation, escalated not patched

**`reorient.mjs:765`:**

```js
const ESTATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
```

`buildBrief` calls `sweepFn()` with **no argument**, so the sweep root comes from **the module's own location.**

**WP-2B(2)'s install relocates this module to `C:\Users\Buggly\.mypka\governor\`. `ESTATE_ROOT` then becomes `C:\Users\Buggly` — no `Deliverables\` there — which hits the branch the code itself calls *"the ONE honest silence"*: ENOENT → `null` → the section is omitted entirely, with no error text.**

**Proven by execution, same module, two locations:** in-tree → the sweep string; relocated → **`NULL`**.

**Why this blocks the install rather than being parked:** today a fresh Larry in the main worktree *gets* that sweep. The install removes the project-level registration, **so after it lands he stops getting it — everywhere, silently.** That is the behaviour whose absence once let a fresh session miss a live plan. **And it is invisible to every acceptance test in the install order**, which only inspects the continuity-pointer string.

**Mack was right not to patch it.** Governor source is yours; a defect found in operation is escalated, never patched by the operator.

## The fix — one line, and it is a genuine improvement, not a workaround

**`main()` passes an explicit root derived from the hook payload `cwd` — the same value `buildBrief` already computes as `where` — instead of relying on the module-relative default.**

**This is MORE correct than today for every non-main worktree**, which today sweeps the main checkout's `Deliverables/` regardless of where the session actually is. **Do not preserve the module-relative default as a silent fallback**: if the session root cannot be established, the honest-absent branch is the correct outcome, and a fallback to the module's own location is exactly how a wrong sweep would look right.

## Regrowth cap

**One argument passed. No resolver, no config, no root-discovery helper.** If your design needs more than that, **stop and say so at read-back.**

## Acceptance evidence — executed, pasted

- **The relocation proof**: run the module from a directory where a module-relative root yields nothing, and show the sweep still resolves the session's `Deliverables/`. **A fixture is not sufficient — reproduce the real relocation.**
- **A mutation half, at the bar you set on WP-2B(1) and held on WP-2B(2)** — and, per your own CRLF finding on that work package, **assert each mutation APPLIED before reading its result. A mutation that did not apply is not one that survived.**
- Baseline **in your own worktree** before and after: `node --test tools/governor/reorient.test.mjs`, plus the full governor suite per file. **`# tests`/`# fail`, never the exit code.**
- `bash scripts/secret-scan.sh --surface <each declared path>` — `--surface` mode only.

**Proceed if sound — one read-back only if a material defect remains.** `export MSYS_NO_PATHCONV=1`. Git for your branch is yours. You do not decide the merge.
