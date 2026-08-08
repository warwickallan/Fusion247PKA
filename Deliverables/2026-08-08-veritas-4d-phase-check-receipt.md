---
build: BUILD-020
scope: phase-4d-capae
gate: 2

boundary: >
  Sub-phase 4D — CAPAE, and the outcome it promised: a small, honest, closed learning loop
  that reaches Warwick through the live Cockpit and reaches a fresh Larry at Continue,
  without becoming another governance system. Graded against Warwick's 22-item acceptance
  surface, verbatim, one verdict per item.

reviewed_sha: 83bcdec6486df2d801d8df99177c3456e18bad84
governance_sha: 83bcdec6486df2d801d8df99177c3456e18bad84
branch: main
remote_reachable: true

evidence_method: mixed — live runtime (Cockpit 127.0.0.1:8090 and the installed ~/.mypka/governor runtime), target checkout (read-only execution of existing checks and suites), and two ephemeral `git archive` exports used solely for mutation testing
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\a2725267-efa8-4c85-911a-2e4ba4cdfeb1\scratchpad (both exports deleted after use; never committed)
worktree_head_at_start: 83bcdec6486df2d801d8df99177c3456e18bad84
worktree_head_at_end: f709f38a0820117d209764e03af92ff3fd989915
worktree_head_moved_by: >
  NOT Veritas. The dispatching party committed `f709f38 docs(4d): bank Pax's and Nolan's
  adversarial CAPAE evaluations` during the review — 2 files, +473 lines, both
  Deliverables/*.md, zero product code. Recorded rather than smoothed over. Not a new scope.
worktree_status_clean: true
review_ceiling: ONE pass, <= ~150k tokens (named in the dispatch; not extended)

verdict: HOLD
receipt_sha256: 15e40c40d75a7ec6702711187ae82a5c9a2c2b4159a1f3c0f2793fc39a1c67e4
reviewed_by: veritas
reviewed_date: 2026-08-08
next_review_trigger: >
  ONE focused confirmation of D-1, D-2 and D-3 only — provenance-check.mjs green, an executed
  assertion over capaeOverview that turns red when needsAttention is forced, and the
  app.js:1826 comment corrected. A receipt, a documentation repair or a moved HEAD is NOT a trigger.
---

# Veritas receipt — Sub-phase 4D (CAPAE), Gate 2 phase check

## Scope reviewed

**Sub-phase 4D — CAPAE**, and the outcome it promised: a small, honest, closed learning loop that reaches Warwick through the live Cockpit and reaches a fresh Larry at Continue, without becoming another governance system.

**In scope:** Warwick's 22-item acceptance surface, verbatim, one verdict each. The live Cockpit on `127.0.0.1:8090` (running from `C:\Fusion247PKA`), the CAPAE modules, the governor brief/snapshot path, the installed `~/.mypka/governor/` runtime, the `/rotate` contract, and the repository's own check scripts.

**Deliberately NOT in scope:** phone-width visual acceptance (Warwick's own — item A); manufacturing a qualified exposure (prohibited — item B); the behavioural result of the Pax comparison (deferred to 4F — item C); estate-wide Git archaeology; Codex's PR/release gate.

**Item D was corrected mid-review by the dispatcher and I re-established it myself** — see Evidence executed, row 14. It is not deferred; it is observed working.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | CAPAE + Session/Rotation Reports live under SYSTEM, not Settings | PASS | Heading extraction over `app.js`: System pane opens at line 1790 → `System` (1791) · `CAPAE — the learning loop` (1801) · `Session / Rotation Reports` (2006). The Settings pane (1779–1787) contains only "This app" (version, host, reload hint). | none |
| 2 | System leads with the important learning/attention signal | PASS | CAPAE is the first content group in System; its first rendered element is the `cap-exec` alert bound to `capOverview.attention` (app.js 1827–1831). The pre-existing "Happening now" group is now below at 2407. | The *ordering* inside System is asserted by no executed check (non-blocking; see D-2 for the derivation gap, which is blocking). |
| 3 | Home has ONE useful CAPAE/System attention signal when genuinely warranted, quiet when not | PASS | `homeAttention` returns `null` unless `capOverview.needsAttention` (app.js 232–244); MONITORING is deliberately excluded. `render-vm-check.mjs` renders both branches and asserts `no attention card at all when nothing needs attention` and `Home does NOT become a second CAPAE dashboard`. Live: `overview.needsAttention: true`, one CHALLENGED family (`record-amended-body-not-recut`, 5 occurrences) — genuinely warranted. | The template branch is proven; the *derivation* that decides which branch runs is not — see D-2. |
| 4 | Recent Activity is broader than ingestion WITHOUT inventing a new event system | PASS | `latest` (app.js 204–221) merges four existing sources — `outputs.produced_at`, `ingested.updated_at`, `wins.happened_at`, and CAPAE `last_occurrence_at`. No new table, endpoint or event store; a family with no honest timestamp is omitted rather than dated "now" (line 212). `render-vm-check` asserts `Recent activity carries the CAPAE event, not just ingestion`. | none |
| 5 | Larry economics and specialist economics visible as peers, NEVER meaninglessly summed | PASS | `sessionEconomics` (rotation-report.mjs 466–499) returns two separate objects; there is no code path that adds them. Live `/api/rotation-reports`, 2026-08-07 row: `larry {contextIn:null, contextOut:null, movement:null, measured:false}` beside `specialist {tokens:2093268, dispatches:8, count:4, measuredCount:4}`. `movement` is `null` unless both ends were measured. | none |
| 6 | Specialist drill-down answers who did what and measured cost where evidence exists | PASS | Live roster, 2026-08-07 (4A): `keel d2 t197193 · mack d3 t481422 · nolan d3 t376819 · pax d3 t502531 · veritas d4 t663631`. Where cost was never captured the value is `null`, not `0`: 2026-08-06 row shows `dispatches 19, measuredCount 0` with every `tokens: null`. `tokensAreDerived` labels a fallback sum rather than passing it off as measured. | none |
| 7 | Pax reports still Open and Download correctly | PASS | Executed live: `GET /api/deliverable?file=2026-08-07-session-performance-report-subphase-4b.md` → `ok:true` with the real Pax bytes (`# Session performance report — Sub-phase 4B … Written by Pax.`). `rrDownloadDoc` (app.js 698–711) fetches first when the doc is not open, then saves the *same* fetched text, so the button cannot save an empty file. | none |
| 8 | Historical empty findings are NEUTRAL rather than falsely positive | PASS | `reportSummary` (rotation-report.mjs 366–375) returns `tone:'neutral'` + `No structured findings recorded` when `findings.length === 0`; `quiet` only when findings exist, `urgent` on failures. Live: three 2026-08-06 rotations render `neutral / No structured findings recorded`; 2026-08-07 renders `quiet / 21 findings, none a failure`; 2026-08-08 renders `urgent / 3 preventions failed to stick`. | none |
| 9 | The LIVE CAPAE brief contains genuine operational families, not test fixtures | PASS | Live `/api/capae`: 6 families — `work-order-not-generated` (pilot, occ 2) · `built-tested-never-activated` (occ 4) · `record-amended-body-not-recut` (CHALLENGED, occ 5) · `authority-inferred-from-desired-outcome` (UNMEASURABLE, occ 2) · `control-cannot-reach-what-it-checks` (occ 4) · `acceptance-proves-mechanism-not-outcome` (occ 3). Every one traces to a recorded estate failure. None of `capae-check.mjs`'s fixtures (`pilot-fam`, `proven-fam`, `rare-fam`, `doubt-fam`) is present. | none |
| 10 | Fresh-session orientation loads the small relevant active brief | PASS | Production event traced end to end: `~/.claude/settings.json` `SessionStart` → `node C:/Users/Buggly/.mypka/governor/reorient.mjs` → line 53 imports `readBrief, renderActiveBrief, snapshotOpeningBrief` → lines 1105–1109 append the rendered block to the hook's stdout. Installed copy is byte-identical to `tools/governor/reorient.mjs` and `tools/governor/capae-brief.mjs` (`diff` → no output). Rendered live brief measured at 1791 chars / 14 lines / 4 families. | none |
| 11 | SessionStart snapshots the EXACT brief Larry actually received | PASS | `reorient.mjs` calls `snapshotOpeningBrief()` **before** `renderActiveBrief(readBrief())` (lines 1105–1106) — both read the same file with nothing between them. Evidence on disk from this host's real session start: `capae-opening.json` carries `snapshot_of: …capae-active.json`, `snapshot_at: 2026-08-08T11:35:35.475Z`, `written_at: 2026-08-08T11:10:32.557Z`, and its four families are byte-for-byte those of `capae-active.json`. | `snapshotOpeningBrief()` fires on *every* SessionStart event, so a compact occurring after a `/rotate` within one host would overwrite the opening snapshot (non-blocking, N-3). |
| 12 | `/rotate` hands Pax that exact HISTORICAL opening brief, not a rewritten current one | PASS | `.claude/commands/rotate.md` step 6a names `~/.mypka/governor/capae-opening.json` and states `capae-active.json` is NOT a substitute, because `capae-sync.mjs` rewrites it at every rotation. It further instructs: *"If the snapshot is absent, say so and grade nothing"* — the failure mode is refusal, not substitution. Both files exist on disk with distinct mtimes (12:10 vs 12:35). | Behavioural result deferred to 4F (Warwick's item C). The mechanism and contract exist and are executable now. |
| 13 | Pax is REQUIRED to compare the six things | PASS | `rotate.md` step 6a enumerates six questions answered *separately and by name*: what Larry was told · whether a qualified exposure occurred (four-word vocabulary) · what Larry actually did **from evidence** · whether prevention held · improved/unchanged/degraded/no-comparable-prior · whether the same error repeated despite being in the opening brief. It also mandates the executive CAPAE paragraph and states `This is ANALYSIS, not enforcement.` | Deferred behavioural result (item C). |
| 14 | Effectiveness uses the STRICT four exposure dispositions | PASS | `EXPOSURE_DISPOSITION` is a frozen four-key map (`clean`·`recurrence`·`none-this-session`·`unmeasurable-at-this-frequency`). `dispositionFor` returns `null` for anything else — the previous `return 'RECURRENCE'` default is gone, with the reason recorded in-file. `capae-sync.mjs` rejects an unreadable exposure **before any write**, exits 3, prints the accepted words, and makes the whole sync unsuccessful. `node --test tools/session-report/capae-sync.test.mjs` → 14/14 pass, exit 0. | none |
| 15 | A clean qualified exposure can advance proof | PASS | `deriveFamily` (capae-sync.mjs 104–140): `CLEAN-EXPOSURE` increments the streak and sets `reachedEffective` once `streak >= required`; `state` becomes `EFFECTIVE`. Covered by executed test `deriveFamily: with no threshold set, clean exposures accumulate but never self-declare EFFECTIVE` and siblings in the 14-test suite. | none |
| 16 | A recurrence can reopen a previously proven family | PASS | Same function: a failure disposition resets the streak to 0 and, if `reachedEffective` was already true, sets `challenged` — so the family drops out of EFFECTIVE and `selectActive` picks it back up. No special case; it falls out of "effectiveness is the clean streak since the last failure". Live proof of the state existing in real data: `record-amended-body-not-recut` is `CHALLENGED`. | none |
| 17 | A no-op/unmeasurable exposure does NOT manufacture effectiveness evidence | PASS | `NONE-THIS-SESSION` and `UNMEASURABLE` are recorded as history and move nothing (capae-sync.mjs 130). `effectivenessLine` refuses a fraction on an unmeasurable family and reports `NOT YET MEASURED` at 0 clean rather than `0/5 — on track`. `capae-check.mjs` asserts `no fraction on an unmeasurable family` and `0 clean is not progress`. Live: `authority-inferred-from-desired-outcome` renders UNMEASURABLE with no counter, and is excluded from Larry's brief. | none |
| 18 | CAPAE remains small enough for repeated startup use | PASS | Measured, not estimated: the live rendered `⟦GOV⟧ CAPAE WATCH` block is **1791 chars / 14 lines / ≈448 tokens**, 4 families. `selectActive` caps at 4 and excludes EFFECTIVE and UNMEASURABLE, so the list bounds and rotates itself. `renderActiveBrief` returns `''` when nothing is actionable. Read from a local JSON file — no network call on the hook. | none |
| 19 | CAPAE has NOT become another governance/admin/token system | PASS | No new service, daemon, control plane, registry, validator or Cockpit governance surface. Occurrence counts are **derived from rows**, never incremented, so there is no register anybody maintains. `rotate.md` step 6a states `This is ANALYSIS, not enforcement` and forbids a compliance engine. Nothing forces Larry to obey the brief. The zero-model, zero-token Stop idle hook (item D) is the same restraint applied at the notification edge. | The 4D map note *"No schema change, no migration, no new table, no register"* is true of the effectiveness carrier but reads as a claim about 4D overall, while `session_report.capae_family` and `capae_occurrence` were added at `e25aec4` (ancestor of the reviewed head). Two small tables are proportionate — the wording is not (non-blocking, N-2). |
| 20 | The old `/rotate` blocking/non-blocking contradiction has genuinely been removed | PASS | All four contradicting surfaces re-cut **in the same document**, with the superseded text struck through rather than left standing: step 6 (line 71, was *"WAIT for Pax's return. Do not proceed…"*), step 12 (line 122, `no required worker result is outstanding` → `named as outstanding`), and the two closing rules (144, 145). Grep for residual blocking language returns only the struck-through quotations and their dated re-cut notes. | none |
| 21 | Live Cockpit provenance is canonical/current | **HOLD** | Half proven, half broken. **Proven:** served `/app.js` is byte-identical to `services/cockpit/public/app.js` (191212 bytes, `Buffer.equals` true), and the live `sourceHash` `99f77edf7326e077` equals the value recomputed locally — the Cockpit runs from the repository, not an installed copy. **Broken:** `provenance-check.mjs` **FAILS** at the reviewed head (1 of 29), and the defect is real — see D-1. | **Blocking.** D-1. |
| 22 | Home/System acceptance surfaces are exercised by MEANINGFUL, NON-VACUOUS checks | **HOLD** | Partly true and materially incomplete. `render-vm-check.mjs` genuinely exercises the Home and System *templates* — 26 scenarios, 61 assertions, including the negative branch — and is in CI. But the **server derivation** behind both surfaces is asserted by nothing, and the source claims otherwise. See D-2 and D-3. | **Blocking.** D-2, D-3. |

## Evidence provenance

- **What was inspected, and how — mixed, stated per row.**
  - **Live runtime:** the Cockpit on `http://127.0.0.1:8090`, started by `MyPKA-Local-Services-Live`, reporting `build.sha 83bcdec`, `startedAt 2026-08-08T11:48:46.044Z`. Used for `/api/health`, `/api/capae`, `/api/rotation-reports`, `/api/deliverable`, `/app.js`.
  - **Live installed runtime:** `C:\Users\Buggly\.mypka\governor\` — `reorient.mjs`, `capae-brief.mjs`, `capae-active.json`, `capae-opening.json`, `idle-check-state.json`. Read only; `diff` against repo source.
  - **Target checkout:** `C:\Fusion247PKA` — read-only inspection and execution of existing checks and test suites.
  - **Ephemeral export:** `git archive 83bcdec | tar -x` into the session scratchpad, twice, for the two mutation tests. Never a `git worktree`. Both exports deleted after use; nothing was committed.
- **Repository `git rev-parse HEAD` — start `83bcdec6486df2d801d8df99177c3456e18bad84` / end `f709f38a0820117d209764e03af92ff3fd989915`. THEY DO NOT MATCH, and the reason is recorded rather than smoothed over:** the dispatching party committed `f709f38 docs(4d): bank Pax's and Nolan's adversarial CAPAE evaluations` during the review. `git diff --stat 83bcdec..f709f38` = 2 files, +473 lines, both `Deliverables/*.md`, **zero product code**. This is not a new scope and did not reopen anything.
- **`git status --porcelain` — start:** two untracked files (`Deliverables/2026-08-08-nolan-capae-architecture-challenge.md`, `…-pax-capae-implementation-evaluation.md`). **End:** empty. The change is entirely accounted for by that commit. **Veritas modified nothing in the working tree.**
- **`reviewed_sha` remote reachability:** `git branch -r --contains 83bcdec` → `origin/main`. Reachable on the canonical remote.
- **Mutations applied only inside exports**, and both exports were destroyed rather than reverted.

## Evidence executed or inspected

| # | Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|---|
| 1 | `node --test tools/governor/*.test.mjs` | 0 | 512 | 512 pass, 0 fail |
| 2 | `node --test tools/session-report/capae-sync.test.mjs` | 0 | 14 | 14 pass, 0 fail |
| 3 | `node services/cockpit/capae-check.mjs` | 0 | 27 | PASS |
| 4 | `node services/cockpit/rotation-report-check.mjs` | 0 | 124 | PASS — "NULL never became 0" |
| 5 | `node services/cockpit/render-vm-check.mjs` | 0 | 61 (26 scenarios) | PASS |
| 6 | `node services/cockpit/nav-check.mjs` | 0 | 42 | PASS |
| 7 | `node services/cockpit/template-check.mjs` | 0 | 1 template, 130567 bytes | PASS |
| 8 | `node services/cockpit/render-check.mjs` | 0 | DOM 9581 bytes | PASS |
| 9 | `node services/cockpit/private-apps-check.mjs` | 0 | 245 | PASS |
| 10 | `node services/cockpit/sw-version-check.mjs` · `down-reason-check.mjs` · `origin-boundary-check.mjs` · `clone-portability-check.mjs` | 0 | 12 · 17 · — · — | PASS |
| 11 | **`node services/cockpit/provenance-check.mjs`** | **1** | **29 (1 failed)** | **FAIL** — `SOURCE_MODULES … declared=[…9 modules] computed=[../../tools/governor/capae-brief.mjs, capae.mjs, …]` |
| 12 | **MUTATION** (export): append a comment to `services/cockpit/capae.mjs`; recompute `sourceHash()` | 0 | 3 reads | `b5a1529657be5225` → `b5a1529657be5225` → `b5a1529657be5225`. **The digest never moved.** |
| 13 | **MUTATION** (export): `const needsAttention = ineffective.length > 0 \|\| reopened.length > 0;` → `const needsAttention = true;`, then run every check | all 0 | capae-check, render-vm-check, nav-check, render-check, rotation-report-check, template-check | **All six exit 0. Nothing turned red.** |
| 14 | `cat ~/.mypka/governor/idle-check-state.json` beside `Date.now()` | 0 | — | `lastStopMs 1786191266056` vs now `1786191276980` — the marker was rewritten **~11 s before I read it**, inside this running host. The Stop hook IS firing in production. **Item D independently re-established.** |
| 15 | `diff ~/.mypka/governor/reorient.mjs tools/governor/reorient.mjs` and same for `capae-brief.mjs` | 0 | 2 | Byte-identical. Installed runtime is not a stale fork. |
| 16 | `curl -s http://127.0.0.1:8090/app.js` vs `services/cockpit/public/app.js` | 0 | 1 | 191212 bytes each, `Buffer.equals` **true** |
| 17 | `node -e "import('./services/cockpit/provenance.mjs')…sourceHash()"` vs live `/api/health` | 0 | 1 | `99f77edf7326e077` both |
| 18 | `curl -s /api/capae` · `/api/rotation-reports` · `/api/deliverable?file=…4b.md` | 0 | 3 | 6 families · 9 reports · real Pax bytes |
| 19 | `node -e "…renderActiveBrief(readBrief())"` | 0 | 1 | 1791 chars / 14 lines / ≈448 tokens |
| 20 | `git branch -r --contains 83bcdec` | 0 | — | `origin/main` |

**Evidence NOT available, named rather than smoothed over:** no browser at phone width (Warwick's item A); no natural qualified exposure (item B — manufacturing one is prohibited); no natural `/rotate` executed (item C); no `/close-session` → fresh-launch cycle observed.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | 20 of 22 of Warwick's own acceptance items are met with executed evidence. The two that are not (21, 22) are *his* items, not additions of mine. |
| Design fidelity | PASS | One selection contract (`selectActive`) imported by the Cockpit rather than reimplemented — the previous 5-vs-4 divergence is genuinely closed. Derivations live in `.mjs` beside their data, not in the template. No new store, service or control plane. |
| Functional proof | PASS | The real production paths were executed: the live Cockpit's four endpoints, the installed SessionStart hook's imports and its on-disk output, the sync's disposition vocabulary, and the deliverable read. |
| Integration | PASS | `server.mjs:27 → capae.mjs:27 → tools/governor/capae-brief.mjs` is a real cross-tree import, and the same function computes both the Cockpit's "Larry's Active Brief" and the brief Larry receives. `~/.claude/settings.json SessionStart → reorient.mjs → capae-brief.mjs` is registered and firing. |
| Durability | PASS | The brief is precomputed to disk and read without a network call, so orientation survives Supabase or Cockpit being down. `capae-opening.json` survives the rewrite of `capae-active.json` by construction. |
| Test quality | **HOLD** | Two mutation tests were run and **both survived**: `sourceHash` is blind to `capae.mjs` (row 12), and the executive derivation can be made to lie with every check still green (row 13). `capae-check.mjs` is not in any CI workflow. This is the dimension the whole review turns on. |
| Git truth | PASS | `83bcdec` resolved, on `main`, reachable from `origin/main`. The mid-review HEAD move to `f709f38` is docs-only and is recorded above rather than absorbed. |
| Documentation truth | PASS | `rotate.md`'s contradiction is genuinely superseded, not appended to. One non-blocking inaccuracy (N-2) and one **false evidence claim inside product source** (D-3), which is counted under Test quality because that is what it misstates. |
| Residual risk | PASS | Items A–D are Warwick's own classifications and are recorded as such. Item D is now *observed working*, not deferred. N-1/N-2/N-3 are bounded and named. |
| Completed automation | PASS | Mandatory here, and it is satisfied for the automatic outcomes 4D claims: the **real** SessionStart event invokes `reorient.mjs` from the stable installed runtime and its output is observable on disk (`capae-opening.json`, `snapshot_at 11:35:35Z`); the **real** Stop event invoked the idle hook ~11 s before I looked. Neither depends on Larry remembering. **The `/rotate` → `capae-sync` leg is not claimed automatic** — it is an explicit step in a human-invoked command, correctly classified as manual. |

## Production caller and journey

**Journey A — Warwick opens the Cockpit.** Scheduled task `MyPKA-Local-Services-Live` → `ensure-local-services.mjs` → `node services/cockpit/server.mjs` **from `C:\Fusion247PKA`** → `GET /` serves `public/app.js` (proven byte-identical to the repo file) → `onMounted` → `ensureCapaeSignal()` → `GET /api/capae` → `capaeResponse(q)` → `capaeFamilies` + `activeBrief`(=`selectActive`) + `capaeOverview` + `familiesByUrgency` → Home renders one attention card **only** when `needsAttention`; System renders CAPAE first, then Session/Rotation Reports. **Every hop executed.**

**Journey B — a fresh Larry says `Continue`.** Host reads `~/.claude/settings.json` → `SessionStart` → `node ~/.mypka/governor/reorient.mjs` → `snapshotOpeningBrief()` writes `capae-opening.json` → `renderActiveBrief(readBrief())` → the block is appended to the hook's stdout. **Proven by the on-disk snapshot written at this host's real session start, not by calling the function myself.**

**Journey C — `/rotate` closes the session.** `rotate.md` step 6a hands Pax `capae-opening.json`; step 6b binds a `family` slug and one of four exposure words to every material finding; step 7c runs `capae-sync.mjs`, which derives counters from rows and rewrites `capae-active.json`. **Executable now; not yet exercised by a natural rotation (Warwick's item C).** The disposition gate on this journey *was* executed directly and is proven (rows 2, 14 of Evidence).

**Reached only by a check calling it directly, and therefore recorded as such:** `capaeOverview`, `familiesByUrgency`, `effectivenessProgress`, `latestRecurrence`, `STATE_PRESENTATION` — these are on the *production* journey (Journey A) but on **no test journey at all**. That is D-2.

## Restart and durability

`n/a` for a kill-and-revive cycle: 4D claims no new persistent process. What durability it does claim was checked in place — the precomputed brief is a file on disk read with no network dependency, and `capae-opening.json` is a separate file specifically so that rewriting `capae-active.json` cannot destroy it. Both were observed on disk with distinct timestamps.

## Documentation contradiction scan

- **Larry's declared residuals:** items B, C, D unexercised; phone-width uninspected; the live Cockpit broken twice today by template edits, both caught by `template-check`, both repaired.
- **Verified independently:** `template-check` does pass now (row 7), and the served bytes match the repo (row 16), so the repairs held. B and C are correctly classified. **D was declared wrongly and the dispatcher corrected it mid-review; I re-established it myself (row 14) rather than accepting either version.**
- **What his list missed:** `provenance-check.mjs` is red at the head he submitted, and it is a CI step. It was not declared. This is the finding a residual list is supposed to surface and did not.
- **Active documents that would misdirect a fresh instance:** none found. `rotate.md`'s superseded steps are struck through in place, and the Wayfinder's 4C block carries its historical banner.
- **Closure claims since the last receipt, and the receipt behind each:** the Wayfinder's 4D EXECUTION block claims `DELIVERED at 4901917` but **does not claim 4D complete** — it carries an explicit `⛔ OUTSTANDING — 4D may not be reported complete until these are true` list. That is the correct, honest form. **No unbacked closure claim found.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D-1 | High | `SOURCE_MODULES` in `services/cockpit/provenance.mjs` (lines 47–57) omits `capae.mjs` and `../../tools/governor/capae-brief.mjs`, both in `server.mjs`'s real import closure. `provenance-check.mjs` is therefore **red at the reviewed head** and is a CI step (`.github/workflows/cockpit-private-apps.yml:90`). Mutation-proven: editing `capae.mjs` leaves `sourceHash` unchanged at `b5a1529657be5225`, so the digest whose entire purpose is "what code is ACTUALLY RUNNING" is blind to the whole 4D surface. It is currently correct only by coincidence. | **blocking** — gates PASS on requirement 21 and gates Codex, which requires CI green. | Larry to dispatch |
| D-2 | High | `capaeOverview()` and `familiesByUrgency()` — the server-side derivation behind **Home's single attention signal** and **System's leading alert** — are asserted by no check anywhere in the repository. `render-vm-check.mjs` stubs `capOverview` as a fixture object, so it proves the template given an answer, never the answer. Mutation-proven: forcing `needsAttention = true` left capae-check, render-vm-check, nav-check, render-check, rotation-report-check and template-check **all exit 0**. Requirements 2 and 3 are therefore delivered but unguarded. Compounding: `capae-check.mjs` is in **no** CI workflow. | **blocking** — gates PASS on requirement 22. | Larry to dispatch |
| D-3 | Medium | A **false claim about acceptance evidence, inside product source**: `services/cockpit/public/app.js:1826` reads *"Derived server-side by capae.mjs capaeOverview(), so capae-check.mjs asserts it."* `capae-check.mjs` imports only `capaeResponse, activeBrief, effectivenessLine, mapFamily, num` and never references `res.overview` or `res.ordered`. A future reader will trust this comment and not add the assertion. | **blocking** (with D-2 — it is the reason D-2 would otherwise stay invisible) | Larry to dispatch |
| N-1 | Low | `/api/health` freezes `sha` and `dirty` at process start (`PROVENANCE` is a module constant), so the live surface reported `sha 83bcdec, dirty:true` while the tree stood at `f709f38`, clean. Defensible as "what I loaded", but the field names read as current state. | non-blocking | parked |
| N-2 | Low | The Wayfinder's 4D note *"No schema change, no migration, no new table, no register"* is true of the effectiveness carrier but reads as a claim about 4D overall, while `session_report.capae_family` and `session_report.capae_occurrence` were added at `e25aec4`. The tables are proportionate; the sentence is not. | non-blocking | parked |
| N-3 | Low | `snapshotOpeningBrief()` fires on every SessionStart event, including resume/compact, so a compact after a `/rotate` within one host would overwrite the opening snapshot with the post-rotation brief — the exact substitution the function exists to prevent, through a narrow door. | non-blocking | parked |

## The pattern the dispatcher asked me to name

I was asked not to soften this, so I will not. **Item D was wrong in the dispatch, and I confirm the correction is right** — the marker `lastStopMs 1786191266056` was rewritten ~11 seconds before I read it, inside a running host, so the Stop hook is firing in production and item D is observed working, not deferred.

But the pattern is broader than one direction of error. Today's instances run both ways: twice a mechanism was called active when it was not, and here a mechanism was called inactive when it was. **What is common is not optimism — it is that an activation state was reported before it was executed.** D-1, D-2 and D-3 are the same failure with a different subject: three statements about *acceptance evidence* — a declared module list, a code comment naming its own asserter, and a residual list omitting a red gate — none of which had been executed against the thing they describe.

This is material to the verdict and is why it is a HOLD rather than a pass with notes: 4D's product is good, and the estate's own live record already names this cause twice — `built-tested-never-activated` (4 occurrences) and `acceptance-proves-mechanism-not-outcome` (3 occurrences). **I record the observation and stop there.** Whether this session presented a qualified exposure for either family is a judgement for the rotation report, not for a reviewer, and I have manufactured nothing.

## Verdict

**HOLD** — 20 of Warwick's 22 acceptance items pass on executed evidence; requirements **21** and **22** do not, each with a mutation-proven defect (D-1, D-2) and one false in-source evidence claim (D-3), all three small and directly fixable.

**Deliberately not "PASS WITH DEFERRED EVIDENCE".** Items A–D are genuinely deferred or Warwick-classified and I have not counted any of them against 4D. The two failures are the opposite of deferred: they are present, reproducible today, and one of them is a red CI gate at the submitted head. An overall PASS may not conceal a mandatory HOLD.

**What this HOLD gates:** the claim that Sub-phase 4D is complete, and — through the red `provenance-check` — a Codex invocation. **It does not block continuing safe work on the active route**, and the frontier remains the Wayfinder's.

## Next review trigger

**ONE focused confirmation of D-1, D-2 and D-3 only** — `provenance-check.mjs` green, an executed assertion over `capaeOverview` that turns red when `needsAttention` is forced, and the app.js:1826 comment corrected. Nothing else reopens this gate: not a receipt, not a commit of these deliverables, not documentation repair, and not a moved HEAD.
