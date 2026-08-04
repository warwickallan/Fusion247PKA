# WO-2026-08-05-01 — Honcho packet writer emits the active Wayfinder pointer

> **AMENDMENT 1 — 2026-08-05.** Keel's read-back returned **`REFUSE`, class A**, and it was right: v1 declared no `file_surface`, so the worker's one absolute rule had nothing to bind to, and seven further mandatory envelope fields were absent. **The refusal was narrow and proportionate — it rejected the envelope, not the work, and re-executed R-7 to confirm the order's reconnaissance holds.** This amendment supplies the envelope and settles all three contradictions Keel raised. **One additional fresh read-back is authorised** (root `CLAUDE.md`); after that, proceed unless an ACTIVE in-scope blocker remains.

| Field | Value |
|---|---|
| **status** | ISSUED — AMENDED 1 |
| **issued** | 2026-08-05 |
| **issued_by** | Larry |
| **owner** | Keel |
| **governance_head** | `72b44b3c356e496b3647a6703c4e64307ff0413c` — **corrected.** v1 named `279e1535`, which is the parent and **does not contain this Work Order**. Keel verified the only diff between them is this file, so no contract changed |
| **authorised_by / date** | Warwick, 2026-08-05 (Phase 2 route accepted — map §14.0) |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — §14, WP-2B(1) |
| **branch** | `build-020/honcho-map-path-writer`, **cut from `72b44b3` or later on `build-020/live-trial`** |
| **worktree** | Keel creates and owns one, cut from that exact SHA. **NOT from `origin/main`** — it is ~57 commits behind and cutting from it silently discards this branch |
| **file_surface** | `tools/governor/continuity.mjs` · `tools/governor/continuity.test.mjs` — **complete and absolute.** `continuity-derive.mjs` is **excluded** (see Contradiction 3 below) |
| **acceptance_property** | A continuity packet built in this repository carries a **repo-root-relative** path to the Wayfinder map this branch is actually working on, **verified to exist**, and carries **no `map_path` at all** when that cannot be established |
| **private_surface** | `none`. Nothing under `C:\.fusion247\**`. GL-012 not engaged |
| **credential_scope** | none |
| **network** | none |
| **live_authority** | none. **Do not install anything, do not register a hook, do not restart the running watcher (PID 31268), do not touch `~/.mypka/governor/continuity.json`** |
| **veritas_gate** | 1 — this WP is inside the Phase 2 gate (§14.0c), not a gate of its own |
| **integration_owner** | Larry |
| **document_impact** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **owner: larry.** Keel is forbidden to write an active Wayfinder map and must not |
| **out_of_scope_policy** | report-only |
| **operational_handoff** | none. **Keel's reasoning is adopted:** this is a change inside an already-released module, not a service handed to Mack, so the runbook gate does not apply and **no `runbook_path` is owed.** Recorded so it is not re-litigated |
| **blocking_dependencies** | none. Independent of WP-2A, WP-2E, WP-2F |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ `72b44b3` (blob `500c6c5171074c2573f55810f93dc82a5e81508b`) |
| **contract_conflicts** | none identified at read-back |
| **review_ceiling** | not an assurance dispatch |

## Amendment 1 — the three contradictions, settled

**Contradiction 1 — `frontier` is DEFERRED to WP-2B(2), deliberately.** Keel is right that the map's WP-2B(1) says *"`map_path` + frontier"* while v1 silently dropped the frontier, and right that emitting it now would be **dead on arrival** — the render prints only map path, packet id, focus and `warwick_last_request`, and constraint 6 forbids touching the render. **Emit `map_path` only.** The frontier moves to WP-2B(2), where the render change that displays it also lands. The map is corrected to match.

**Contradiction 2 — cut from `72b44b3` or later.** Accepted as Keel proposed.

**Contradiction 3 — the render EXISTS; do not touch it.** The correct reading is the former: `storedMapPath()` and `readContinuityBrief()` are **out of surface**. v1's phrasing was ambiguous and is withdrawn. `continuity-derive.mjs` is likewise **out of surface** — Keel's plan not to touch it is adopted as the instruction.

## Amendment 1 — the method, ACCEPTED as proposed

Keel's design is adopted rather than re-specified, because it is better than the order it answered:

- **Identify candidates by the verbatim orientation marker** `CLAUDE.md` mandates in every map — not by filename. Proven sharper: it finds a marked map a `*wayfinder-plan.md` filter would miss, and correctly excludes a superseded one.
- **Select by git commit recency, branch-scoped first** (`merge-base(origin/main,HEAD)..HEAD`), repo-wide recency second. **Never filesystem mtime** — a fresh clone or new worktree stamps every file at checkout time, which is noise in exactly the "started anywhere" case this exists for.
- **Emit a repo-root-relative POSIX path.** An absolute path would re-import the exact hardcoding defect this phase exists to remove.
- **The honest-absent rule is the acceptance property, not a nicety.** Omit the field entirely unless the map is marker-identified, resolves to a real file, and selection is unambiguous. **Never a guess, never a stale carry-forward** — the render prints whatever string it is handed as *"likely active map"* without checking, so the writer is the only place W-1's confident-wrong-orientation can be prevented.

**Assumptions 2 and 4 are granted:** an optional `cwd`/root option on `buildPacket(state, opts)` is in scope, and an injectable git seam paired with a control test asserting the default reads real git is the right shape — it matches the existing `DEFAULT_GIT_IO` and `spawnFn` idioms and is not a test-convenience seam.

**Baseline to measure against, from Keel's own pre-change execution:** `continuity.test.mjs` = **53 tests, 53 pass, 0 fail**; full governor suite = **366 tests, 0 fail** across 10 files, per file. The directory form `node --test tools/governor/` measured **`# tests 1 # fail 1` with `EXIT=0`** — a live confirmation of P-8 on this exact surface. **Per-file form, assert counts.**

## Amendment 1 — out-of-scope findings: parked, not actioned

All three of Keel's reported findings are **correctly reported and correctly not fixed.** The `storedMapPath()` shape-only validation is real and belongs to **WP-2B(2)**, where the render is in surface — a packet already in Honcho from an older session is not re-validated on read. The `stop`-dedupe observation is recorded as **closing** the "no expensive work on the Stop path" concern. The `worktree-guard.mjs` fail-direction is unproven-by-attempt and will be reported if it bites.

---

## Why this exists — the defect, verified

`tools/governor/continuity.mjs:162` — `buildPacket()` emits **exactly eight** content fields: `focus, immediate_objective, warwick_last_request, accepted_decisions, completed, blockers, next_action, notes`.

The BUILD-020 pointer render in the **same file** at `:263` reads `p.map_path`. **No writer ever sets it, so it is null by construction** and the render always takes its absent-form branch. Installing the pointer render without this change produces a pointer that points at nothing.

Verified this session (R-7): installed `C:\Fusion247PKA\tools\governor\continuity.mjs` has **0** occurrences of `packetContentHash`/`storedMapPath`/`CONTINUITY POINTER`; this worktree has **9**.

## Outcome owed

**A continuity packet carries enough for a fresh Larry, started anywhere, to open the correct current Wayfinder map and know the live frontier — without Warwick typing a path.**

That is the outcome. **The method is yours**, bounded by the constraints below.

The one thing the outcome does *not* permit: a hardcoded map path. Warwick's Phase 2 scope sentence is *"shared, dependable myPKA services rather than things tied to a build, worktree or Larry remembering how to start them."* A literal `2026-08-04-proofline-wayfinder-plan.md` in source is build-tied and fails that on the day the map changes. **How the active map is determined is the substantive design question in this order — propose it at read-back.**

## Constraints

1. **Zero new dependencies.** The governor tools are dependency-free; keep them that way.
2. **REGROWTH CAP — binding.** No registry, no validator, no store, no manifest format, no discovery service. If your design needs one to work, **stop and say so at read-back** rather than building it. Warwick, 2026-08-05: *"Build the product, not another shiny monkey-house floor."*
3. **The brief is a POINTER with ZERO authority** (root `CLAUDE.md` precedence #9). The packet may carry the map's *location* and identity. It must not carry anything that reads as an instruction to execute — the exact next action comes from the map, never from the packet.
4. **Privacy scrubbing already exists** in `buildPacket` (`scrub()`, `RESTRICTED`, `WITHHELD_MARK`). Any new field passes through the same discipline. A map path is ordinary, but do not create a bypass.
5. **`continuity.test.mjs` already supplies `map_path` in its fixture** (`:67`) — the test surface anticipates this field. Read it before designing; it may already encode the intended shape.
6. **Do not change the render** in the same change. WP-2B(2) installs it; this order is the writer only. Keeping them separable is deliberate.
7. **Do not commit anything outside `tools/governor/`** without saying so first.

## Acceptance evidence — executed, pasted, not asserted

- `node --test tools/governor/continuity.test.mjs` — **assert `# tests` ≥ the pre-change count AND `# fail 0`.** **Never the exit code alone**: `node --test` returns exit 0 on zero tests, and it counts non-test helper `.js`/`.mjs` files under `test/` as passing entries that asserted nothing (P-8, verified on this estate).
- A test proving a built packet carries a **resolved, real** map path — not a fixture-supplied one.
- **A negative test**: when no active map can be determined, the packet renders the honest absent form. It must never emit a stale or guessed path. **A confident wrong orientation is the failure mode Warwick named by name (W-1); it is worse than a blank one.**
- The full governor suite still green: `node --test tools/governor/` — or, if the directory argument fails as it does elsewhere in this estate, each file, with counts.

## Read-back gate — MANDATORY

**Return a READ-BACK and HOLD. Do not implement first.** State:

1. The outcome in your own words.
2. Your proposed method — **especially how the active map is determined**, and why that survives the map being renamed, a second map existing, or a different worktree being active.
3. **What this order fails to settle.**
4. **What looks wrong in it.** Preflight it against reality; if it is under-specified, return `REFUSE` with the defect rather than guessing. The last order on this build was refused class-A and the refusal was correct — it improved the build.

Git for this branch is yours to execute. You do not decide the merge.
