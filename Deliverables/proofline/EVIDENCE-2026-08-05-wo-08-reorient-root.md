# EVIDENCE — WO-2026-08-05-08, `reorient.mjs` sweeps the SESSION's root

**Builder self-test evidence — NOT independent review.**

| | |
|---|---|
| Work Order | `Deliverables/proofline/WO-2026-08-05-08-reorient-explicit-root.md` |
| Governance head | `a2302edf913687b5295dc24f5cfe4a9aaefc7b6a` (the dispatch's head; the order's own `governance_head` field names `1b299e3`, one commit earlier — **both resolve the Keel contract to the same blob**, see "Preflight findings") |
| Contract read | `Team/Keel - Implementation Engineer/AGENTS.md`, blob `500c6c5171074c2573f55810f93dc82a5e81508b` |
| Worktree / branch | `C:\Fusion247PKA-wo-reorient` / `build-020/reorient-explicit-root`, cut from the governance head |
| `private_surface` | `none` — no path under `C:\.fusion247\**` was read or written |

## Preflight findings

- **The defect is real and reproduced from the order's own description.** `reorient.mjs:765` derived the
  sweep root from `import.meta.url`; `buildBrief` called `sweepFn()` with no argument. Reproduced by real
  relocation before a line was changed — see "The relocation proof".
- **`sweepOpenDeliverables` has no production caller other than `buildBrief`.** Repo-wide grep: the only
  other references are inside `reorient.test.mjs`, and **every one of them already passes an explicit
  root.** So the module-relative default was reachable from exactly one place in the estate and no test
  could ever have exercised it. A default no test can reach is a default nothing defends.
- **`ESTATE_ROOT` had one consumer.** Removing it leaves `dirname` and `fileURLToPath` unused; both are
  dropped from the imports. `worktree-guard.mjs`'s `GOVERNOR_ESTATE_ROOT` is an unrelated env var.
- **One discrepancy in the order, non-blocking.** The order's `governance_head` field is `1b299e3` while
  the dispatch names `a2302ed`. `git rev-parse <head>:Team/Keel - Implementation Engineer/AGENTS.md`
  returns `500c6c51…` at **both**, so the governing contract is identical either way and there was nothing
  to resolve. Reported, not resolved.
- **Acceptance commands checked against reality before being trusted.** `node --test <file>` reports
  `# tests`/`# fail`; counts are read from those lines and never from the exit code.

## The change — one argument, and one deletion

`tools/governor/reorient.mjs`:

1. `const ESTATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')` — **deleted**, and with
   it the `root = ESTATE_ROOT` default on `sweepOpenDeliverables`. The root is now a required argument.
2. `buildBrief` calls `sweepFn(where)` — `where` being the session location it already resolves from the
   hook payload `cwd`, and already reports the location probes against.
3. `dirname` / `fileURLToPath` imports dropped (no remaining use).

**No fallback was kept, deliberately.** An unusable root throws out of `join` and `buildBrief`'s existing
`catch` renders `⟦GOV⟧ OPEN DELIVERABLES: sweep failed (…)`. That is a **pre-existing branch**, so the
"no silent fallback" requirement cost zero new code: nothing was added to handle it, and the outcome is
louder than the honest-absent alternative rather than quieter. **No resolver, no config, no
root-discovery helper** — the regrowth cap is met literally: one argument passed, one constant removed.

This is also **more correct than the previous behaviour for every non-main worktree**, which until now
swept the main checkout's `Deliverables/` no matter where the session actually was.

## The relocation proof — real, not a fixture

`reorient.mjs` copied byte-for-byte (md5 verified both times) to
`…/scratchpad/home/.mypka/governor/`, mirroring WP-2B(2)'s install shape. Its module-relative root is
`…/scratchpad/home`, and `readdir` of `Deliverables` there returns **ENOENT** — asserted, not assumed.
`continuity.mjs` is stubbed beside it **and only that**: the Honcho passthrough is orthogonal to the sweep
root, and stubbing it keeps the proof off the network and away from a credential file. The module under
test is the real one, run as the real CLI, reading a real payload from stdin.

Command, identical in both runs:

```
cd <relocated>/  &&  node reorient.mjs < payload.json
payload.json = {"source":"startup","cwd":"C:/Fusion247PKA-wo-reorient"}
```

**BEFORE the fix** — md5 `19206169fee7974e58e6a53207471664`:

```
⟦GOV⟧ SESSION START — This is a FRESH session. Nothing has been established in this context yet.

⟦GOV⟧ SESSION LOCATION PROBES (executed; each line states what was measured):
  cwd          : C:/Fusion247PKA-wo-reorient (directory type measured; session enterability NOT established — hook process is not in this directory)
  worktree root: C:/Fusion247PKA-wo-reorient (LINKED worktree)
  branch       : build-020/reorient-explicit-root
  HEAD         : a2302edf913687b5295dc24f5cfe4a9aaefc7b6a
  working tree : clean
  …

⟦GOV⟧ HONCHO CONTINUITY: (stubbed for this proof — not exercised)

=== SWEEP SECTION PRESENT? === false
```

**Note what that output is.** The location probes resolved the session *perfectly* — right worktree, right
branch, right HEAD. The sweep section is simply not there, with no error text anywhere. Nothing in that
brief tells a reader a section is missing. That is the whole defect.

**AFTER the fix** — md5 `475b3e2f1e9e3a3b2e4a65659c870b18`, same relocation, same payload, same command,
exit `0`:

```
(fallback — non-directive list)
⟦GOV⟧ OPEN DELIVERABLES (loose, not BUILD-* — nothing else surfaces these):
  • YouTube source pipeline — comprehension regression DIAGNOSIS (no implementation) — Deliverables/youtube-source-comprehension-DIAGNOSIS.md
  • Larry Builder Delegation / Orchestration — DESIGN (for Warwick + GPT review; NOT yet GO to build) — Deliverables/larry-builder-delegation-DESIGN.md
  • Synthesis Layer — atoms → opportunities (DESIGN, no build) — Deliverables/idea-engine-synthesis-layer-DESIGN.md
  • Transfer Specialist — FINAL experiment spec (red-team-corrected) — nothing locked, no build — Deliverables/idea-engine-specialist-SPEC.md
  • Smallest proof — atoms → opportunities (Brains synthesis, one pass) — Deliverables/idea-engine-synthesis-PROOF.md
  • DRAFT FOR REVIEW — Transfer-Intelligence Specialist + T1 Experiment Spec — Deliverables/idea-engine-specialist-DRAFT.md
  • Idea-engine — Neo4j graph-signal audit (investigation only, 2026-07-26; live reads) — Deliverables/idea-engine-neo4j-audit.md
  • Idea-engine — FROZEN evaluation fixture set — Deliverables/idea-engine-eval-fixtures-FROZEN.md
  … and 85 more recent deliverable(s) not shown (display cap 8) — this list is NOT complete.

=== SWEEP SECTION PRESENT? === true
```

The acceptance property, executed: **the module ran from outside the repository and swept the session's
`Deliverables/`, resolved from the hook payload `cwd`, at a path where a module-relative root yields
nothing.**

**That proof is now in the suite, not only in this document.** `SWEEP ROOT: the RELOCATED module still
sweeps the session` performs the same relocation, the same ENOENT control and the same CLI run inside
`node --test`, so the defect cannot return silently.

## Baselines and suites — `# tests` / `# fail`, never the exit code

Taken in `C:\Fusion247PKA-wo-reorient` before anything was touched, and again after.

| Suite | before `# tests` | before `# fail` | after `# tests` | after `# fail` |
|---|---|---|---|---|
| `tools/governor/atomic-write.test.mjs` | 19 | 0 | 19 | 0 |
| `tools/governor/continuity-derive.test.mjs` | 23 | 0 | 23 | 0 |
| `tools/governor/continuity.test.mjs` | 79 | 0 | 79 | 0 |
| `tools/governor/evaluator.test.mjs` | 34 | 0 | 34 | 0 |
| `tools/governor/footer.test.mjs` | 65 | 0 | 65 | 0 |
| `tools/governor/health-store.test.mjs` | 14 | 0 | 14 | 0 |
| **`tools/governor/reorient.test.mjs`** | **55** | **0** | **58** | **0** |
| `tools/governor/sampler.test.mjs` | 43 | 0 | 43 | 0 |
| `tools/governor/statusline-live.test.mjs` | 34 | 0 | 34 | 0 |
| `tools/governor/worktree-guard.test.mjs` | 28 | 0 | 28 | 0 |
| **TOTAL** | **394** | **0** | **397** | **0** |

Three tests added, none removed, none weakened.

## Mutation testing — 8 applied, 8 killed

Each mutation applied to the real source, **proved present on disk before the suite was read**, the suite
run, the file restored from a pristine buffer, and the restore compared **byte-for-byte** before the next
mutation. Sources are CRLF.

| # | Mutation | applied? | `# tests` | `# fail` | Verdict | First test to fail |
|---|---|---|---|---|---|---|
| M1 | restore a module-relative DEFAULT for the sweep root | YES | 58 | 1 | **KILLED** | no-module-relative-fallback |
| M2 | revert the call to no argument (**the original defect**) | YES | 58 | 2 | **KILLED** | session-root-from-payload |
| M3 | sweep the module's own directory explicitly | YES | 58 | 3 | **KILLED** | session-root-from-payload |
| M4 | sweep the hook PROCESS's cwd instead of the claimed session root | YES | 58 | 3 | **KILLED** | session-root-from-payload |
| M5 | swallow a sweep failure — the section silently disappears again | YES | 58 | 2 | **KILLED** | no-module-relative-fallback |
| M6 | return null for an unusable root instead of failing loudly | YES | 58 | 1 | **KILLED** | no-module-relative-fallback |
| M7 | use the RAW claimed cwd rather than the resolved session location | YES | 58 | 1 | **KILLED** | relocated-module |
| M8 | add the SILENT module-relative fallback the Work Order bans | YES | 58 | 1 | **KILLED** | no-module-relative-fallback |

**8 / 8 applied and killed. Restore verified byte-identical after every mutation.**

**M2 is the load-bearing row:** the exact defect Mack found in operation is now a red suite.

**The apply guard fired, and it is reported rather than smoothed over.** A first run of this battery
returned `M6 = NOT-APPLIED`. The cause was **the harness, not the mutation**: its applied-predicate asked
"the anchor is no longer present", which is false for an INSERT-shaped mutation whose replacement
legitimately still contains the anchor line. Corrected to an exact expected-bytes comparison and the whole
battery re-run — the eight rows above are all from that single corrected run. **A mutation that did not
apply is not one that survived**, and a harness that reports a green it did not measure is the same defect
this module exists to prevent.

## Secret scan

```
bash scripts/secret-scan.sh --surface tools/governor/reorient.mjs tools/governor/reorient.test.mjs \
  Deliverables/proofline/EVIDENCE-2026-08-05-wo-08-reorient-root.md
```

Exit **0** — SCANNED and clean, covering **all three** declared `file_surface` paths and nothing else.
`private_surface` is `none`, so no private surface was scanned or touched. The scanner's known uncovered
class stands as always: a credential with no recognisable shape inside an ordinarily-named file.

## Not verified / known limitations

- **The Honcho passthrough was stubbed in the relocation proof**, deliberately, to keep it off the network
  and away from `C:/.fusion247/honcho.env`. What the *real* `continuity.mjs` does when relocated is
  **outside this Work Order and is not claimed here** — it resolves its own store path from `homedir()`,
  not from the module location, but that is an observation from reading, not an executed proof.
- **This does not prove WP-2B(2)'s install works.** It proves the module survives relocation. Installation,
  hook registration and what a genuinely fresh session receives are Mack's half and remain unproven here.
- **No live session was started.** Every run above is a CLI invocation with a synthetic payload, not a
  real Claude Code `SessionStart`.
- **Builder evidence only.** Every proof above was executed by the party that wrote the code.

**Builder self-test evidence — NOT independent review.**
