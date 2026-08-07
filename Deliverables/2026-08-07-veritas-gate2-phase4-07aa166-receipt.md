---
build: BUILD-020
scope: phase-4-north-star-closure
gate: 2
reviewed_sha: 07aa166fe64b019f69a75a12a7e61be391c278d9
governance_sha: 07aa166fe64b019f69a75a12a7e61be391c278d9
branch: build-020/phase4-automation-law
remote_reachable: true
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA-build-020-trial\e1a5349f-4c7d-4ce4-bb91-f2ea51224e07\scratchpad\export-07aa166
worktree_head_at_start: 07aa166fe64b019f69a75a12a7e61be391c278d9
worktree_head_at_end: 07aa166fe64b019f69a75a12a7e61be391c278d9
worktree_status_clean: true
ci_at_reviewed_head: five workflows completed/success bound to this SHA; only cockpit-private-apps and secret-scan ran on `push` — governor-tests, control-plane-tests and build-002-tests ran on `pull_request` against a merge commit
review_ceiling: one pass, <= ~200k tokens (dispatch-stated; not extended)
private_surface: C:\.fusion247\private\careerair\** (declared; NOT entered)
credential_scope: none
verdict: FAIL
receipt_sha256: 5d4d489ac3effe46f0ab68bb4c3b3f20b8f2506672385eaff0368b5b79bf83fe
reviewed_by: veritas
reviewed_date: 2026-08-07
next_review_trigger: a fresh Gate 2 dispatch at a new exact head after the map, the durability record and the installed Tower provenance record state the live position truthfully; and, for the phase promise itself, after route step 18 has executed against the canonical merged runtime
---

## Scope reviewed

**Gate 2 only** — the BUILD-020 **Phase 4 / North-Star closure** question at `07aa166fe64b019f69a75a12a7e61be391c278d9`. **Gate 1 is running in parallel at the same head and grades functional rows 1, 2 and 4. Nothing below re-grades those rows**, and no Gate 1 verdict is expressed or implied here.

**The accepted phase outcome was reconstructed from the durable record, not from the dispatch.** It is the two-part final acceptance in `Deliverables/2026-08-07-subphase-4A-closure-and-4B-handover.md` §§ PART A / PART B, in Warwick's words:

> «Is everything delivered across BUILD-020's previous Phases durable, correctly captured and independent of the old branch, worktree, installed accident and Larry's context — and is everything required to create a completely new Build Wayfinder now understood, durable and reproducible by a genuinely fresh Larry?»

**Build North Star** (map §1): Warwick opens a browser on his own machine and can *prove* — not be told — that work was durably recorded, processed off the request path, held for approval, and survived the process being killed.

**Scope widened, and recorded as required by contract §"Scope is Veritas's to widen".** The dispatch named the phase question, the four records and the six Gate 1 receipts. **I additionally examined the nine commits between the last assured head `3254c69` and this head** — WO-32, WO-33 and the Tower durability record — because they change a **machine-installed live runtime** and are therefore squarely inside Part A. The dispatch did not name them as Gate 2 material. **They are the source of two of the three blocking findings below.**

**Deliberately not reviewed:** functional rows 1/2/4 (Gate 1, concurrent) · any attack detail, probe shape or reproduction step (Warwick's publication ruling — this repository is public) · anything under `C:\.fusion247\**` (declared surface `private/careerair/**` was **not entered**; `credential_scope: none` honoured, no credential file opened).

## Accepted requirements — the phase promise

| # | Requirement (verbatim source) | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **A** | **Durability** — every load-bearing BUILD-020 outcome exists in canonical Git · is in the correct merge unit · is **installed from canonical merged source where required** · survives `/clear`, restart, fresh session and worktree recreation · **depends on no unmerged branch, dirty clone, transcript or previous Larry context** · has truthful evidence and provenance · leaves no valuable work stranded | **FAIL** | Repo-local durability is genuinely good and I re-confirmed the parts I could: branch is remotely reachable; worktree clean at the exact head; the machine-global governor half is real (`~/.mypka/governor/` is worktree-independent); the Tower watcher is machine-installed and session-independent (PID 22708, launched from `HKCU\…\Run → MyPKA-Tower-Watcher → start-tower-hidden.vbs`, executing `~/.mypka/tower-runtime/…/watcher.mjs`, heartbeat `2026-08-07T16:59:46Z`, current). **But the clause "installed from canonical merged source … depends on no unmerged branch" is now VIOLATED BY THE LIVE ESTATE, not merely unproven** — see D-2. | Live Cockpit still `c1ed028`, 183 commits behind, on `build-015/…`, 12 dirty entries. Live `/api/health` returns **no** `dirty`/`provenance`/`sourceHash` — the WO-24 truthful-provenance outcome does not exist on the surface Warwick uses. |
| **B** | **New-Build Wayfinder reproducibility** — a genuinely fresh Larry, from a Goal Contract alone, can reproducibly establish one authoritative Wayfinder, phases, gate questions, the START/RESUME interface, the `ACTIVE SESSION WORK PACKAGE` anchor, safe rotation … **without copying the Proofline map and without Warwick reconstructing the method from chat** | **HOLD** | **Not exercised at this head, and no artefact for it exists.** Executed: `Team Knowledge/Templates/` contains 14 templates — `work-order`, `work-package`, `veritas-receipt` and the PKM entity set — and **no Wayfinder template**. No SOP, Guideline or Workstream under `Team Knowledge/` mentions Wayfinder (`grep -rln "Wayfinder" "Team Knowledge/SOPs" "Team Knowledge/Guidelines" "Team Knowledge/Workstreams"` → **no matches**). The only reusable instruction is root `CLAUDE.md` § Wayfinder, which says to **copy the startup block from the 2,956-line proven map** — the exact thing Part B's acceptance bar forbids. | **The known trap Part B must clear is still open.** `tools/governor/continuity.mjs:314` — `if (!picked.path) picked = mostRecentlyCommitted(io, repoRoot, candidates, null);` — the repo-wide recency fallback `LARRY-01` proved misfires for a brand-new build's branch is **present and unrepaired at this head**. |

**Overall cannot be PASS. Part A is FAIL and Part B is HOLD.**

## The mandatory Gate 2 question, answered plainly

> **«Can Warwick now do the thing this phase promised, in the real intended context?»**

**NO — and on the surface he actually uses, none of Sub-phase 4B is reachable.** Executed against the live Cockpit at `127.0.0.1:8090`:

- `GET /api/rotation-reports` → **HTTP 404 `not found`**. Amendment 7's whole surface does not exist for him.
- `GET /api/health` → `{"status":"ok","build":{"version":"0.11.0","sha":"c1ed028",…}}` — **no `dirty`, no `provenance`, no `sourceHash`.** The WO-24 truthful-provenance outcome does not exist for him either.
- `C:\Fusion247PKA` is at `c1ed02889405c5850d43d02eecb8f38e032bee57`, branch `build-015/live-acceptance-recovery-2026-08-03`, **12 dirty entries**.

**That much is by deliberate design and is HOLD, not FAIL.** The migration is post-merge, its §3 preconditions bind, and Larry stated this position honestly and without softening it. **Had that been the only finding, this receipt would read HOLD.**

**It is not the only finding.** Three active records now **misstate the live position** in ways that would send a fresh Larry to redo finished work and would leave him unaware that a machine-installed runtime has been changed. Under Amendment 6 ② — *"where an active statement points a fresh Larry toward closed or superseded work · misstates the live Phase or next action … Veritas returns FAIL, not merely HOLD; the artefact is demonstrably wrong, not pending"* — that is the FAIL, and it is carried by the **truth record about the live estate**, not by the engineering.

## Evidence provenance

- Isolated export of `reviewed_sha` created with `git archive 07aa166… | tar -x -C …\scratchpad\export-07aa166`, **outside the repository**, never committed. Export verified populated (28 top-level entries).
- Repository `git rev-parse HEAD` at start / end — `07aa166…` / `07aa166…`, **identical**.
- Repository `git status --porcelain` — **0 entries at start, 0 entries at end.** Unchanged throughout.
- `git branch -r --contains 07aa166…` → `origin/build-020/phase4-automation-law`; `git ls-remote origin build-020/phase4-automation-law` → `07aa166…`. **Remotely reachable.**
- Governance blob bound before reading anything: `git rev-parse 07aa166…:"Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md"` → `8c85fdbce3b8418d0f5640183d84ca5284ea1e1a`.
- **No mutation testing was performed and none was needed** — this gate's blocking findings are properties of live state and of active records, established by direct observation.
- **Live-state probes were strictly read-only.** HTTP `GET`s against `:8090`; `Get-ScheduledTask` / `Get-CimInstance` queries; the Tower SQLite store opened with `better-sqlite3` in **`readonly: true`** mode. **Nothing on the live machine was started, stopped, enabled, written or restarted.**
- **No path under `C:\.fusion247\**` was opened, listed or quoted.** Where a fact depends on `tower-baton.env` I have recorded it as **unverifiable under my credential scope** rather than inferring it — see D-3.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `curl -s -w "%{http_code}" http://127.0.0.1:8090/api/rotation-reports` | 0 | n/a | **404 `not found`** — Amendment 7 surface absent on the live Cockpit |
| `curl -s http://127.0.0.1:8090/api/health` | 0 | n/a | `{"status":"ok","build":{"version":"0.11.0","sha":"c1ed028",…}}` — **no provenance fields** |
| `git -C /c/Fusion247PKA rev-parse HEAD` + `status --porcelain \| wc -l` | 0 | n/a | `c1ed028…` · `build-015/live-acceptance-recovery-2026-08-03` · **12** dirty entries |
| `gh run list --commit 07aa166…` | 0 | 7 runs | five workflows `completed/success`; **`push` event for only `cockpit-private-apps` and `secret-scan`**; the other three on `pull_request`. **Larry's dispatch stated this precisely and correctly.** |
| `gh pr view 97` | 0 | n/a | OPEN, `headRefOid` = `07aa166…`, MERGEABLE, not draft. **Title still reads *"Veritas Gate 1 FAIL @0cf70c9 — NOT merge-ready"*** — stale, but errs conservative |
| `Get-CimInstance Win32_Process` (node, tower) | 0 | 1 match | **PID 22708**, `~/.mypka/tower-runtime/…/tower-loop/watcher.mjs`, created 17:30:15 — **not** any `Fusion247PKA*` checkout |
| `Get-ItemProperty HKCU:\…\Run` | 0 | n/a | `MyPKA-Tower-Watcher : wscript.exe "…\.mypka\tower-runtime\start-tower-hidden.vbs"` — autostart chain real |
| `sha256sum` runtime vs repo `notify.mjs` / `watcher.mjs` | 0 | 2 files | **BOTH IDENTICAL to this unmerged branch.** `notify.mjs` `a3d4b558…`, `watcher.mjs` `eec56a2e…` |
| Tower store, `readonly` — `select reason, count(*), max(created_at) from notification group by reason` | 0 | 4 rows | `warwick_input_required` 2 · `finding_disposed` 2 · `codex_block_or_redirect` 4 · `tower_failure` 2. **`codex_qa_started` = ZERO rows. Last notification of any kind: 2026-08-05T19:07:21Z.** |
| Tower store — `select pr_number, count(*) from turn group by pr_number` | 0 | 3 rows | PR **80**, **90**, **94** only. **No turn has ever existed for PR #97.** |
| Tower store — `watcher_heartbeat` | 0 | 3 rows | newest `2026-08-07T16:59:46.293Z`, `state: idle` — **live and current** (wall clock 17:59 local) |
| `Get-ScheduledTask` | 0 | 10 tasks | **`MyPKA-YouTube-Watcher-Ensure` = `Disabled`** (deliberate, migration precondition 5). All others `Ready` |
| `ls ~/.mypka/youtube-watcher-state.json` | 2 | n/a | **absent.** Watcher process 28240 alive since 11:06:04, but **nothing revives it if it dies** |
| `git -C ~/.mypka/tower-runtime rev-parse --is-inside-work-tree` | 128 | n/a | **`fatal: not a git repository`** — the `TOWER_EVIDENCE_REPO_DIR` default (`run-watcher.mjs:110` → `REPO_ROOT`) resolves to a non-git directory |
| `grep -c TOWER_EVIDENCE_REPO_DIR …/start-tower.mjs` | 1 | n/a | **0 references** — the launcher does not set it. Whether `tower-baton.env` does is **outside my declared surface and UNVERIFIED** |
| `node -e "require('./.claude/settings.json').hooks"` + `ls .claude/state/return-cues` | 0 / 2 | n/a | `{}` · directory **absent**. Amendment 5 descope holds at this head |
| `grep -rln "Wayfinder" "Team Knowledge/SOPs" "Team Knowledge/Guidelines" "Team Knowledge/Workstreams"` | 1 | 0 matches | **No Part B artefact exists anywhere in Team Knowledge** |
| `tools/governor/continuity.mjs:294-325` (inspected) | n/a | n/a | repo-wide recency fallback **present and unrepaired** |
| `services/cockpit/private-api.mjs:142` (inspected) | n/a | n/a | `{ allowed: false, reason: 'no-origin-unsafe-method' }` — **R2 is APPLIED in code** |
| `Deliverables/2026-08-07-cockpit-private-api-boundary-record.md:109` | n/a | n/a | *"**R2 — APPLIED, 2026-08-07. WO-32 @ `4c55781`.**"* |
| Five prior 4B Gate 1 receipts (`3e4c9d9`, `275ec07`, `443d0fa`, `19fc792`, `3254c69`) | n/a | n/a | Each read; **none claims Gate 2, none claims merge readiness, and none is contradicted by anything I found.** *(The dispatch said "six"; **five** exist for 4B at this head — the sixth is the concurrent Gate 1, not yet written.)* |

**Evidence I could not obtain, named rather than smoothed over:** whether `TOWER_EVIDENCE_REPO_DIR` is set at the credential layer (GL-012 — outside `private/careerair/**`); the live `:8090` browser journey on Warwick's device (post-merge by construction); Amendment 9's real unattended capture (requires an enabled scheduled task, forbidden pre-merge).

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| **Goal fidelity** | **HOLD** | The engineering serves the North Star well. But the North Star's own verb is *"Warwick opens a browser … and can prove"* — and on his browser the phase's outputs return 404 and a provenance-free health payload. The gap is scheduled and owed, not abandoned. |
| **Design fidelity** | **PASS** | The pre-merge/post-merge split (Amendments 10 ②, 12 ①) is applied as Warwick wrote it. The regrowth cap held: no new store, no supervisor, no control plane. WO-31's extraction of the handler out of `server.mjs` is a genuine design improvement, not a patch. |
| **Functional proof** | **HOLD** | Branch-runtime proof is real and was independently re-executed at earlier heads. **The live production path is unexercised by construction.** |
| **Integration** | **HOLD** | Integration *between* work packages is sound where I could test it (WO-25/26 against a frozen contract; WO-31 correctly added to `SOURCE_MODULES`). **The integration that matters at Gate 2 — branch → merged `main` → live clone → Warwick's browser — has not been performed.** |
| **Durability** | **FAIL** | Not because the mechanisms are fragile — the governor and Tower autostart chains are genuinely machine-installed and session-independent, and I verified both. **Because the live machine-installed Tower runtime now runs bytes from an UNMERGED branch, and its own provenance record still says otherwise** (D-2). Part A's clause *"installed from canonical merged source … depends on no unmerged branch"* is currently **false of the live estate**. |
| **Test quality** | **PASS** | The mutation discipline in this sub-phase is the estate's best. WO-29's `3 of 54 RED` under the null-collapse mutation caught the *Unknown / not established / 0* distinction collapsing **inside the gate meant to protect it** — that is a test proving a property, not covering a line. The loud-skip in `clone-portability-check` (22 vs 23, naming the missing path) is the anti-vacuous-green design working in a real scenario. |
| **Git truth** | **PASS** | Branch, head, worktree cleanliness, remote reachability and the CI position are all reported **exactly** as I measured them. The `push`-versus-`pull_request` precision in the dispatch is correct to the run. Larry's own earlier overclaim was corrected on the record rather than quietly dropped. |
| **Documentation truth** | **FAIL** | Three active records misstate the live position — D-1, D-2, D-3. Two of them are the artefacts explicitly written *so that a fresh instance does not rediscover the state*, which is the exact failure mode they were created to prevent. |
| **Residual risk** | **PASS** | Every limitation I independently confirmed was already named honestly, in the strongest form available: *"CAPABILITY ONLY. Not durable, not automatic."* · *"the honest form is two workflows green on `push`"* · *"WO-33 is CAPABILITY until the real production event proves it."* **I found no limitation that had been softened, and no false completion claim anywhere in the package.** This remains the estate's strongest dimension. |
| **Completed automation** | **FAIL** | Three outcomes intended to be automatic; **not one has been invoked by its real production event.** ① **TowerBot Codex/Larry visible sequence** — `codex_qa_started` has **never** been emitted (zero rows), and **no turn has ever existed for PR #97**. ② **Amendment 9 durable YouTube capture** — `MyPKA-YouTube-Watcher-Ensure` is `Disabled`, no state file exists, and nothing revives the watcher if it dies. **Reclassified MANUAL for Gate 1 acceptance and evidence purposes ONLY; it REMAINS AUTOMATIC as a product requirement and its binding seven-condition post-merge re-test is owed.** ③ **The Codex checkpoint trigger and the Gate 3 enumeration check** both currently depend on Larry composing something from a route document — which the map itself names as *"precisely the condition § Nothing may live only in Larry's head exists to name."* |

## Production caller and journey

**The journey the phase promises, traced hop by hop to the point it stops:**

```
Warwick's browser / phone
  └─ https (tailscale serve) ──► 127.0.0.1:8090  ── LIVE COCKPIT
       served from C:\Fusion247PKA @ c1ed028, branch build-015/…, 12 dirty entries
       ├─ GET /api/health          → 200, NO provenance fields   ◄── WO-24 outcome ABSENT
       ├─ GET /api/rotation-reports→ 404 not found               ◄── Amendment 7 surface ABSENT
       └─ System tab               → no Session/Rotation Reports ◄── WO-26 outcome ABSENT
   ✗ JOURNEY STOPS HERE. The code that satisfies these is on build-020/phase4-automation-law,
     unmerged, 166 commits ahead of main.
```

```
Warwick reading TowerBot
  └─ HKCU Run → start-tower-hidden.vbs → start-tower.mjs → run-watcher.mjs → watcher.mjs (PID 22708)
       ├─ fetchOpenPrs  → discovers PR #97 dynamically, no seed          ✔ VERIFIED
       ├─ heartbeat     → 2026-08-07T16:59:46Z, idle                     ✔ VERIFIED
       ├─ ingest `@tower checkpoint:` comment on PR #97                  ✗ NEVER OCCURRED
       ├─ codex_qa_started card                                          ✗ NEVER EMITTED (0 rows)
       └─ TOWER_EVIDENCE_REPO_DIR → default resolves to a NON-GIT dir    ⚠ UNRESOLVED
   ✗ The producer is proven. The card is not. The acceptance test has not been run.
```

**Components reached only by a test calling them directly, and recorded as such:** `rotation-report.mjs` (proven via `rotation-report-check.mjs` against an injected query function, and once against real Postgres by Larry) · `private-api.mjs` (proven over real HTTP at the **branch** runtime against a synthetic upstream) · the `codex_qa_started` emission (fixture-driven composer tests only). **None of these is on the live production journey today.**

## Restart and durability

**Durability is claimed for three things. I tested what could be tested read-only.**

| Claim | Result |
|---|---|
| Tower watcher survives reboot / logoff / no Claude session | **HOLDS as a mechanism.** Autostart registry entry present; exactly one watcher; running from `~/.mypka/tower-runtime`, outside every checkout; heartbeat current. **Not proven across an actual reboot since the 17:27 alignment** — the process (17:30:15) postdates it, so the aligned bytes are the loaded bytes, but the *reboot* path has not been re-exercised since. |
| Governor half survives a dead Larry session | **HOLDS.** `~/.mypka/governor/` is machine-global and each invocation is already a fresh process — that is the property itself, not a proxy. |
| YouTube watcher recovers from reboot / logon / process death | **DOES NOT HOLD TODAY.** Ensure task `Disabled`; no state file; the surviving process is a single unsupervised PID. **This is deliberate and correctly recorded** — but it means the durability outcome does not currently exist. |
| Live Cockpit survives restart carrying 4B's outcomes | **UNTESTABLE.** It does not carry them. |
| **Session-independence established from installed-runtime facts instead of from a rotation (§3b)** | **ADEQUATE for the property it names, and NOT adequate for the property Part B needs.** See the assessment below. |

### On the §3b substitution — asked directly by the dispatch, answered directly

**Warwick vetoed rotation, so §3b established session-independence from installed-runtime facts. Is that substitution adequate?**

**For the Tower repair: YES, and it is arguably stronger than a rotation would have been.** A rotation proves one instance handed over once. The installed facts prove a *structural* property: the producer is launched by the OS, runs outside every checkout, discovers its own work from GitHub, and has no code path through a Claude session at all. I verified each of those independently — the registry entry, the single PID, the execution path, the dynamic PR discovery, the current heartbeat. **A rotation could not have proven more, and could have proven less.**

**For Part B: NO, and the substitution does not reach it.** Part B is not a claim about a *process* surviving a session; it is a claim that **a fresh Larry, with no inherited context, can reproducibly create a new Wayfinder**. That property has exactly one instrument — a genuinely fresh Larry doing it — and no quantity of installed-runtime facts is evidence for it. **§3b is correctly scoped and does not overclaim; the gap is that nothing else covers Part B.** It is recorded here so the two are never conflated later.

## Documentation contradiction scan

- **Larry's declared position:** stated fully and, on every point I could check, **accurately**. The live Cockpit position, the 404, the Amendment 10 ① binding, the `Disabled` task, the never-seen `codex_qa_started` card, the Phase 2 S-4 false-positive framing, the owed post-merge items and the CI `push`/`pull_request` precision are **all true as written**. That is unusual and it is worth recording.
- **Verified independently of his list — what it missed:** the dispatch does not mention that the **nine commits since `3254c69`** (WO-32, WO-33, the Tower alignment) have changed a **machine-installed live runtime**, nor that the map, the durability record and the installed runtime's own provenance file have not been updated to say so. **That is where all three blocking findings are.**
- **Active documents that would misdirect a fresh instance:**
  - `Deliverables/2026-08-04-proofline-wayfinder-plan.md:2798` — `| ⑯ | R2 — belt-and-braces guard … | ⬜ OWED — WO-32 |` in the live `🎯 THE ONE CURRENT NEXT ACTION` table. **R2 was applied at `4c55781`.**
  - `Deliverables/2026-08-07-tower-larry-card-durability-record.md` §5 — a section headed *"OUTSTANDING — the exact state, so attempt 10 does not rediscover it"* whose items **1, 2 and 4 are all false at this head**.
  - `~/.mypka/tower-runtime/INSTALLED-FROM.txt` — *"RESYNCED 2026-08-05 from post-merge main `c21c3f3`… Key files byte-verified: `watcher.mjs`…"*. **Both `watcher.mjs` and `notify.mjs` were replaced on 2026-08-07 from this unmerged branch.**
- **Closure claims since the last receipt, and the receipt behind each:** I enumerated them. **None found.** Every 4B artefact I read states the position conservatively — *"NONE of them ASSURED"*, *"CAPABILITY ONLY"*, *"no completion claim, and no PASS"*. PR #97's title still cites the superseded `0cf70c9` FAIL, which is stale but errs safe. **No completion or closure claim exists anywhere without a receipt behind it.**
- **Phase 2 S-4:** assessed as instructed. `git log --all -S` provenance in the durability record shows the `codex_qa_started` card **never existed**, and I confirmed **zero** such rows in the store. **There is no evidence of regression and I claim none.** The correct label is Warwick's: **FALSE-POSITIVE ACCEPTANCE** — a mechanism proven with fixture prose while the real production event was never exercised. **This is the single most useful precedent for the present gate, because two of today's three automatic outcomes sit in exactly the same position.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1** | high | **The map's live next-action table carries a completed item as owed.** `…proofline-wayfinder-plan.md:2798` row ⑯ reads `⬜ OWED — WO-32` while R2 is applied in code (`private-api.mjs:142`) and recorded as applied in the boundary record (`:109`). **A fresh Larry reading the one authoritative next-action table would re-issue a Work Order for merged work** — the identical failure the same table was repaired for at `275ec07`. **Blocks:** the next action it names, and any Gate 2 PASS (Amendment 6 ②). | **blocking** | Larry |
| **D-2** | high | **The live machine-installed Tower runtime runs UNMERGED branch code, and no record says so.** `~/.mypka/tower-runtime/…/notify.mjs` and `watcher.mjs` are byte-identical to this branch (`a3d4b558…`, `eec56a2e…`), while `INSTALLED-FROM.txt` still states the install was resynced from **merged main `c21c3f3`** with `watcher.mjs` byte-verified. **The map records no WO-32 or WO-33 row at all**, so the map is silent on the largest live change in the sub-phase. Part A's *"installed from canonical merged source · no dependency on an unmerged branch"* is therefore **false of the live estate** and is not recorded as such. *(The alignment itself was authorised by Warwick — §1b(4). **The defect is the silence, not the action.**)* **Blocks:** Part A acceptance and any Phase PASS. | **blocking** | Larry |
| **D-3** | medium | **The Tower acceptance test was enabled while its own named gating precondition remains unconfirmed.** The durability record §5.3 states `TOWER_EVIDENCE_REPO_DIR` **UNCONFIRMED — GATES EITHER OPTION**, and that if unset the visible sequence becomes *"Codex QA started"* immediately followed by an evidence failure — *"worse than no card."* Executed: `run-watcher.mjs:110` defaults it to `REPO_ROOT`; `~/.mypka/tower-runtime` is **not a git repository**; `start-tower.mjs` contains **0** references to it. Whether `tower-baton.env` supplies it is **outside my declared surface and I did not look**. Option A was nevertheless executed. **Blocks:** running the real Codex checkpoint (route step 5) as the acceptance test, until set/unset is confirmed. | **blocking** | Larry → Warwick (credential layer) |
| **D-4** | medium | **Durability record §5 "OUTSTANDING — the exact state" is stale in three of its six rows** — ①`WO-33 IN FLIGHT` (integrated `b03119c`) · ②`RUNTIME ALIGNMENT — WARWICK DECISION OPEN … Larry recommended B` (Option A resolved in §1b and **already executed** per §3b) · ④`WO-32 NOT YET ISSUED` (issued, amended and applied). A record written so *"attempt 10 does not start from a conversation"* now requires a conversation to interpret. | **non-blocking** *(parked to the scheduled reconciliation; it does not direct the frontier, D-1 does)* | Larry |
| **D-5** | medium | **Part B has no artefact and its known trap is unrepaired.** No Wayfinder template, SOP or Guideline exists; the only route is copying the 2,956-line Proofline map, which Part B's acceptance bar forbids. `continuity.mjs:314`'s repo-wide fallback — proven by `LARRY-01` to orient a brand-new build's branch to the **Proofline** map — is present at this head. **Part B is not merely unexercised; nothing yet exists to exercise.** | **non-blocking for the current route** *(it blocks Phase close, not the next action, which is Gate 1 → merge decision)* | Larry → Warwick (scope) |
| **D-6** | low | **`/api/rotation-reports` returns HTTP 200 with `ok:false` on a read failure.** The UI reads the body so the surface is truthful, but a status-code monitor would read a failed read as success. **Already reported once by Larry for Warwick's decision; I confirm it and do not re-raise it.** | **non-blocking** | Warwick's decision |
| **D-7** | low | **Clerical.** `WO-2026-08-07-32-*.md` and `WO-2026-08-07-33-*.md` both carry `status: draft` while both are integrated. PR #97's title cites the superseded `0cf70c9` FAIL. Neither misdirects; both err conservative. | **non-blocking** | Larry |

**A finding is an observation, not an instruction. None of the above is a Work Order, and Veritas does not create one.**

## Queue effect — stated so it is not over-read

**This FAIL gates the Phase-4 closure claim, the Part A/Part B acceptance, and any statement that BUILD-020 is complete, durable, closed or merge-ready at the phase level. It gates nothing else.**

It does **not** block Gate 1, does **not** invalidate the concurrent Gate 1 verdict, does **not** stop the frozen-head/CI/Gate-1 sequence continuing, and does **not** transfer the work queue. **Gate 1 PASS + Gate 2 FAIL is a coherent outcome here**, exactly as Gate 1 PASS + Gate 2 HOLD would have been: rows 1/2/4 are a branch-runtime question and the phase promise is a live-estate question.

**D-1, D-2 and D-3 are repairable now and none requires touching the live Cockpit.** D-1 and D-2 are record corrections; D-3 is a confirmation Warwick can give in one line.

## Verdict

**FAIL** — the phase promise is unreachable on Warwick's live surface (which alone would be HOLD, and is correctly designed that way), **but three active records now misstate the live position** — a merged repair still listed as owed in the one authoritative next-action table, a machine-installed runtime silently running unmerged code against Part A's explicit clause, and an acceptance test enabled while its own named gating precondition is unconfirmed. **The engineering is not what fails here. The truth record about the live estate is** — and by Amendment 6 ② that is FAIL, not HOLD.

## Next review trigger

A fresh Gate 2 dispatch at a new exact head once D-1, D-2 and D-3 are closed. **The phase promise itself cannot receive PASS at any head until route step 18 has executed against the canonical merged runtime** — including Amendment 9's binding seven-condition re-test, Amendment 7 ⑥/⑨, the live `:8090` journey, `installed-runtime restart` (service half), *"branch from main after #97 merges"*, and the first real `@tower checkpoint:` on a live PR producing the visible card sequence.
