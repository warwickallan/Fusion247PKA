# 05 — Defunct, Duplicate and Superseded Candidates

Per the defunct-candidate standard: L4 is only assigned where all eight conditions hold (no caller, no
routing dependency, no CI/test dependency, no runtime/deployment dependency, no canonical governance
requirement, no accepted future purpose, no provenance/evidence reason to retain, no unresolved
external-runtime uncertainty). **Nothing in this repository met all eight.** Weaker evidence is classified
QUARANTINE CANDIDATE, per instruction, rather than forced into DELETE.

## 1. Proven defunct

**None.** No component in this repository satisfies the full 8-point standard. This is itself a finding: the
repository has accumulated superseded generations (see §3) but has not accumulated genuinely orphaned dead
code — everything retains at least a CI dependency, a historical-evidence reason, or unresolved external-
runtime uncertainty.

## 2. Likely defunct

**`.github/workflows/notify-snapshot-consumers.yml`** — closest candidate to defunct, but deliberately
*not* classified as such, because Warwick issued an explicit ruling on it earlier tonight (recorded in
`Deliverables/BACKLOG.md`): it is red by design (fails fast pending two unconfigured repo secrets,
`MYPKA_SYNC_TOKEN`/`MYPKA_SOURCE_REPO`) and its remedy (disable the trigger, or report an explicit
NOT-CONFIGURED state) is already decided but deliberately not implemented tonight. **Disposition: leave as
recorded in `BACKLOG.md`; this audit adds no new information and defers to that ruling.**

## 3. Superseded (full chains, with disposition)

### Tower / merge-QA lineage — 4 generations

| Generation | Path | Status | Evidence |
|---|---|---|---|
| 1 | `services/fusion-tower/` | Superseded | Own session log calls it "the frozen reactor" the very next day. Own CI (`fusion-tower-tests.yml`) still passes — proves internal coherence only, not use. |
| 2 | `services/tower-baton/` | Superseded | `services/control-plane/WP-C-README.md`: adapters "faithfully ported from tower-baton/src/*"; the ClickUp wire deliberately not ported. |
| 3 | `services/control-plane/tower-loop/` | Partially superseded / narrowed | Full per-turn supervisor scope explicitly PARKED (`2026-07-20-20-55_larry_build-014-tower-supervisor-loop-parking.md`: "watcher branch NOT merged; CI red"), later rebuilt as a narrower audit-log-only component. Still CI-covered (`test:tower-loop`), still has a live wiring path (`bridge-ingest.mjs` on a Claude Stop hook) — this generation is **not fully dead**, just reduced. |
| 4 | `services/control-plane/tower/merge-check.mjs` | **Canonical, current** | README self-describes as "Tower's active gate"; withheld a real merge earlier today. |

**Removal impact if #1 or #2 disappeared**: none on current operation — nothing live imports from them
(confirmed: WP-C-README documents *copying*, not dependency). **Removal impact if #3 disappeared**: would
break `bridge-ingest.mjs`'s Stop-hook wiring, whose installation status on the live machine is itself
unverifiable from this worktree (L6) — do not remove without confirming that hook is genuinely retired first.

**Tests required before removal**: none needed for #1/#2 (already proven unreferenced). For #3: confirm the
Stop-hook is either uninstalled or intentionally retired before touching `bridge-ingest.mjs`.

**Rollback method**: standard git revert; nothing here has ever been deleted, so no rollback precedent needed.

**Historical repo vs new core**: #1 and #2 → historical repo only, never extracted. #3 → historical repo only
in its full parked form; its narrower live slice is itself a candidate to be *rebuilt from requirements* in
the new core's `CORE/audit-and-qa`, not carried forward as code. #4 → the design (not the code verbatim) is
the extraction candidate — see `03`.

### Admin-surface — in-progress, not complete

`services/control-plane/wp-d-proof/directus/` (Directus admin shell) vs. `services/cockpit/` (documented
successor). **Not classified as superseded outright** — both show live-reference evidence, and no repository
artefact confirms Directus has actually been retired. **Disposition: QUARANTINE CANDIDATE.** Confirming which
is currently authoritative requires either a live check (out of this audit's boundary) or a direct question to
Warwick — flagged in `00`'s top-five questions, not resolved here.

## 4. Duplicate (not supersession — genuinely parallel, confirmed complementary not competing)

None of the candidate near-duplicates investigated turned out to be true duplicates:

- `services/hub/youtube/*` vs. `tools/tubeair/*` — confirmed complementary (hub's own file header: "ties the
  walking skeleton together downstream of TubeAIR extraction"), not two implementations of the same thing.
- `services/control-plane/wp-d-proof/asdair-worker.mjs` vs. `services/asdair/{skill,outcome}` — confirmed
  complementary (a trusted command-queue executor for cockpit-issued intents vs. the planner/outcome-recorder
  it executes for), not a duplicate.

**No genuine unresolved duplicate was found in this repository.**

## 5. Quarantine pending evidence

| Item | Why quarantined, not deleted or kept |
|---|---|
| `.codex/agents/*.toml` (13 files) | Warwick has already explicitly ruled this needs its own dedicated future review pass, separate from any cleanup — this audit does not have standing to resolve it and does not attempt to. |
| `services/control-plane/wp-d-proof/directus/` vs `services/cockpit/` | Live-reference evidence exists for both; no repository artefact confirms a completed cutover. |
| `Expansions/app-developer/`, `Expansions/designer-pack/` folders (as *folders*, not as the capability they seeded) | Confirmed dormant/unreferenced at runtime, but they are the licensed source-of-record for 6 of the 16 live specialists — removing the folder is separable from "is the capability still needed" and was not in this audit's authorised scope to act on regardless. |
| The 4 new `PKM/CRM/` entries + `.user.yaml` | Genuinely uncertain whether further scaffold demo content or real Warwick contacts — content deliberately not read; classification withheld rather than guessed. |

## 6. Historical evidence that should remain in the old repository (not extracted, not deleted)

- `Deliverables/` (76 files) — reports, RCAs, architecture decisions; the evidentiary record behind every
  governance decision referenced elsewhere in this audit.
- `Builds/` (49 files across 3 BUILD folders) — the literal exact-head Codex review evidence trail.
- `ideas/IDEA-007/` — the PRD/Implementation-Plan/Traceability trail for an idea already promoted into
  `services/obsidiwikai`.
- `Team Knowledge/session-logs/` (62 files) and `Team Knowledge/tasks/` (15 files, 9 done) — Fusion's
  operational memory; belongs to the historical record and to `INSTANCES/Warwick`'s private continuity, never
  to the reusable core.
- The entire `Team Knowledge/Sources/_raw/` transcript store — retained as evidence of what was captured and
  when, pending resolution of the copyright question in `09` (retention here is not itself a redistribution
  decision — the repo staying as historical lineage is different from actively republishing it further).

## Organisational inconsistency worth flagging (not a supersession, a process gap)

`Builds/` contains only 3 of what appear to be many BUILD-numbered efforts (BUILD-002, BUILD-010, BUILD-015).
BUILD-014's full governance record — brief, contract, architecture, work-package evidence — was never filed
into a `Builds/BUILD-014-*/` folder and instead lives scattered across at least 18 dated `Deliverables/` files.
This is not itself a defunct/duplicate finding, but it means BUILD-014's evidence trail is harder to locate
than BUILD-002/010/015's, and a future extraction effort mining `Builds/` for the governance template shape
(per `03`, item 9) should be aware the sample is incomplete.
