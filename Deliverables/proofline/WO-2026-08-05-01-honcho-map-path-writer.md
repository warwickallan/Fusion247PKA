# WO-2026-08-05-01 — Honcho packet writer emits the active Wayfinder pointer

| Field | Value |
|---|---|
| **status** | ISSUED |
| **issued** | 2026-08-05 |
| **issued_by** | Larry |
| **owner** | Keel |
| **governance_head** | `279e15353a17628500d502975aaa31e0435498cf` |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — §14, WP-2B(1) |
| **branch** | `build-020/honcho-map-path-writer`, cut from `279e1535` |
| **worktree** | Keel creates and owns one, cut from that exact SHA. **NOT from `origin/main`** — it is ~56 commits behind and cutting from it silently discards this branch |
| **private_surface** | `none`. Nothing under `C:\.fusion247\**`. GL-012 not engaged |
| **credential_scope** | none |
| **live_authority** | none. **Do not install anything, do not register a hook, do not restart the running watcher (PID 31268), do not touch `~/.mypka/governor/continuity.json`** |
| **review_ceiling** | not an assurance dispatch |

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
