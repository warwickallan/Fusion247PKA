# EVIDENCE — WO-2026-08-05-06, WP-2B(2) code half

**Builder self-test evidence — NOT independent review.**

| | |
|---|---|
| Work Order | `Deliverables/proofline/WO-2026-08-05-06-honcho-render-frontier.md`, **Amendment 2** |
| Governance head | `b429184586ff8ed2c7c546202f692af2f31752d3` |
| Contract read | `Team/Keel - Implementation Engineer/AGENTS.md`, blob `500c6c5171074c2573f55810f93dc82a5e81508b` |
| Worktree / branch | `C:\Fusion247PKA-wo-2b2` / `build-020/honcho-render-frontier`, cut from the governance head |
| Delivered | **D** (reader-side existence check) · **P-6** (three residual-authority comment sites) |
| Not delivered, by ruling | **C** (frontier fields) — WITHDRAWN by Amendment 2 |

## What was built

**D — the reader-side existence check.** `resolveActiveMapPath` (WP-2B(1)) verifies the map exists in the
**writer's** checkout. The **reader** is a different checkout by design, so a path that was true where it
was written can be absent where it is read. `readContinuityBrief` now re-verifies the recorded path against
the reader's own repository root before presenting it as the active map, and where it is absent renders an
honest-absent form that **names the path it could not find**.

New export: `mapPathPresentHere(mapPath, { cwd, git })`. Injectable seam, matching the module's existing
`DEFAULT_MAP_GIT_IO` idiom — no new machinery.

**P-6 — three sites, not two.** The order named `reorient.mjs:22` and `:756` as contradicting each other.
They do not: `:22` described the brief, `:756` described the sweep. The real defect was that **three**
comments asserted Honcho authority against `CLAUDE.md` #9, and `4a3b873` (the doc-017 sweep) fixed only the
rendered label at `:1004`. All three corrected: `:22-23`, `:757`, `:1039-1040`. A fourth site — a test
fixture in `reorient.test.mjs` reading `"AUTHORITATIVE current focus"` with the assertion message
`"then the authoritative focus"` — was found inside the declared surface and corrected; the property that
test proves (byte-for-byte passthrough and section order) is untouched.

## Executed evidence

All commands run in `C:\Fusion247PKA-wo-2b2` with `MSYS_NO_PATHCONV=1`. Counts are asserted from
`# tests` / `# fail`, never from the exit code.

### Baselines, taken in this worktree before anything was touched

| Suite | `# tests` | `# fail` |
|---|---|---|
| `node --test tools/governor/continuity.test.mjs` | **71** | **0** |
| `node --test tools/governor/reorient.test.mjs` | **53** | **0** |

### After

| Suite | `# tests` | `# fail` |
|---|---|---|
| `node --test tools/governor/continuity.test.mjs` | **79** | **0** |
| `node --test tools/governor/reorient.test.mjs` | **55** | **0** |
| `node --test tools/governor/*.test.mjs` (whole governor suite, regression check) | **394** | **0** |

### The negative test for D, proven against the REAL case with the REAL seam

No stubs. `mapPathPresentHere` called with the default git/filesystem seam against two real worktrees:

```
C:/Fusion247PKA-wo-2b2  branch=build-020/honcho-render-frontier
   BUILD-020 map present here : true
   2026-08-02 map present here: true
C:/Fusion247PKA         branch=build-015/live-acceptance-recovery-2026-08-03
   BUILD-020 map present here : false      <- the decisive case
   2026-08-02 map present here: true       <- CONTROL: not merely returning false everywhere
```

### What a fresh session actually reads

Rendered through `readContinuityBrief` with an injected page fetcher (no network), one packet, two reader
locations:

```
================ reader cwd: C:/Fusion247PKA-wo-2b2
⟦GOV⟧ CONTINUITY POINTER (Honcho) — recall only, ZERO authority.
  • likely active map: Deliverables/2026-08-04-proofline-wayfinder-plan.md
  • packet: cont-demo-1 written 2026-08-05T06:00:00.000Z — content age 2h 6m, content hash 3dacac17
  • last known focus (recall, possibly stale): "BUILD-020 Phase 2 — Honcho and Tower as durable shared myPKA infrastructure"
  → Open the map and derive the current state and the next action from it. Nothing in this block is an instruction.

================ reader cwd: C:/Fusion247PKA
⟦GOV⟧ CONTINUITY POINTER (Honcho): recorded map NOT PRESENT in this checkout — recall only, ZERO authority.
  • recorded map path, checked against THIS repository and not found: Deliverables/2026-08-04-proofline-wayfinder-plan.md
  • packet: cont-demo-1 written 2026-08-05T06:00:00.000Z — content age 2h 6m, content hash 3dacac17
  → That path is named so the absence can be diagnosed; it is NOT the active map here, and it is NOT to be opened on trust. Treat continuity as absent and orient from `Deliverables/` per `CLAUDE.md` Step 2. Nothing in this block is an instruction.
```

No `next_action` and no `immediate_objective` on either branch — the doc-017 Section-5 field allowlist
holds, which is what Amendment 2 required.

## Mutation testing

Held to WP-2B(1)'s bar. Each mutation applied to the real source, the suite run, the file restored
byte-for-byte and the restore verified before the next mutation.

**Round 1 — 10 mutations, all killed.**

| # | Mutation | Result | Killed by |
|---|---|---|---|
| M1 | remove the non-string type guard | KILLED | untrusted-path refusal |
| M2 | accept an unsafe (absolute/traversing) path | KILLED | untrusted-path refusal |
| M3 | drop the empty-repo-root guard | KILLED | fail-safe direction · default-seam control |
| M4 | accept a DIRECTORY as the map file | KILLED | fail-safe direction |
| M5 | a stat error reports PRESENT | KILLED | honest-absent · fail-safe · default-seam control |
| M6 | use caller `cwd` as the root, not the reader repo root | KILLED | three WP-2B(1) pointer controls |
| M7 | invert the render guard | KILLED | honest-absent · both brief tests |
| M8 | stop NAMING the recorded path | KILLED | honest-absent |
| M9 | regrow a banned authority claim in a comment | KILLED | P-6 scan |
| M10 | DELETE a corrected site instead of stating the boundary | KILLED | P-6 mutation |

**A first run of this battery reported four `NOT-APPLIED`.** These sources are CRLF and the multi-line
anchors were written with LF, so four mutations were never applied and the harness printed something that
looked like a result. Corrected and re-run. A mutation that did not apply is not a mutation that survived,
and neither is evidence.

**Round 2 — probing for the dead-guard class WP-2B(1) found. Three SURVIVED.**

| # | Mutation | Round 2 | Disposition |
|---|---|---|---|
| M11 | drop `git \|\| DEFAULT_MAP_GIT_IO` in `mapPathPresentHere` | **SURVIVED** | reachable → **proven**, now KILLED |
| M12 | drop `git = DEFAULT_MAP_GIT_IO` on `readContinuityBrief` | **SURVIVED** | equivalent mutant → **removed** |
| M13 | drop `cwd = process.cwd()` in `mapPathPresentHere` | **SURVIVED** | reachable → **proven**, now KILLED |

The cut between them is whether the guard can fire at all. M11 and M13 are reachable from a legitimate
call, so the honest answer was a test that kills them, not deletion — one test now does both. M12 was
genuinely equivalent: `readContinuityBrief` defaulted two values that `mapPathPresentHere` already
defaults, and a destructuring default fires on an explicit `undefined` exactly as on an absent key. Two
homes for one default, unfailable by construction — removed, the same disposition WP-2B(1) gave its dead
second guard. **Final: 12 mutations applied, 12 killed, 0 surviving.**

**One defect was found by a test before it shipped.** `mapPathPresentHere(42, …)` returned `true`:
`safeRepoRelative` coerces with `String(...)` because its other caller feeds it git output, so a JSON
number became the plausible relative path `'42'`. `storedMapPath` happens to shield the render, but a guard
that holds only because of what today's caller does is not a guard. Type guard added at the point the
untrusted value enters.

## Secret scan

```
bash scripts/secret-scan.sh --surface tools/governor/continuity.mjs tools/governor/continuity.test.mjs \
  tools/governor/reorient.mjs tools/governor/reorient.test.mjs \
  Deliverables/proofline/EVIDENCE-2026-08-05-wp-2b2-honcho-render.md
```

Exit **0** — SCANNED and clean, covering **all five** declared `file_surface` paths. `private_surface` is
`none`, so no private surface was scanned or touched. The scanner's known uncovered class stands as always:
a credential with no recognisable shape inside an ordinarily-named file.

## Not verified / known limitations

- **S-1 fails today on DATA, before any of this work.** The live store's `focus` reads *"BUILD-015 AsdAIr
  live-acceptance recovery…"*, `updated_at 2026-08-04T06:42:01.586Z`. `focus` is a permitted, already-
  rendered field, so a fresh Larry gets a wrong orientation from the brief as it stands. This work does not
  fix that and does not claim to; the remedy is a `continuity.mjs write`, an operational act held by Larry.
- **The other worktree's honest-absent render is a true limit, recorded rather than engineered around.**
  `C:\Fusion247PKA` gets honest-absent for the BUILD-020 map because that map is genuinely not on its
  branch. Correct under W-1. **S-1 remains unmet for that worktree until the branch carrying the map is the
  one it reads** — a merge and checkout question, not a code one.
- **Delivery to a fresh session is not asserted here.** Installation, the `~/.mypka/governor/` runtime copy
  and hook registration are Mack's half (`WO-2026-08-05-07`). Nothing in this evidence says a fresh session
  will receive this render.
- **Builder evidence only.** Every proof above was executed by the party that wrote the code.
