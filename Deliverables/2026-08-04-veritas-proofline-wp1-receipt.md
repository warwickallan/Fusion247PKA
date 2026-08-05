---
build: BUILD-020
scope: WP-1 -- Proofline service core, widened per section "Scope reviewed"
gate: 1
reviewed_sha: 39a553cb600b7a79d8b4c1845b2bb19e31a2bc69
governance_sha: 39a553cb600b7a79d8b4c1845b2bb19e31a2bc69
branch: build-020/live-trial
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA-build-020-trial/f992c884-6940-4f7f-810d-0f0fa6a11b14/scratchpad/export-39a553c
worktree_head_at_start: 39a553cb600b7a79d8b4c1845b2bb19e31a2bc69
worktree_head_at_end: 39a553cb600b7a79d8b4c1845b2bb19e31a2bc69
worktree_status_clean: true
verdict: HOLD
receipt_sha256: 745703891a077d6bda21ee57fcae3abc0b298f9708d454908db8b37a29744815
reviewed_by: veritas
reviewed_date: 2026-08-04
next_review_trigger: A new exact integrated head after the three blocking findings are corrected -- D-1 (test/ordering.test.js:92 and :136 trace-sequence intermittency, 4 failures in 11 full-suite runs at this head), D-2 (map section 1 G-2c and section 8 T-3c state an acceptance test the evidence disproves; an uncorked createWriteStream RETAINS the record), D-3 (map section 11 and section 12 record Phase 1 as IN PROGRESS and the next action as "Keel implements WP-1" at a head where WP-1 is built and integrated).
---

## Scope reviewed

**As dispatched:** WP-1 (`WO-2026-08-04-01`) at the exact integrated head `39a553cb` — `services/proofline/**` (27 files), the Wayfinder map, and the Work Order.

**Scope I widened, and why.** The dispatch named Gate 1 (integrated WP) but asked the Gate 2 mandatory question. I answered both, and I widened in three places Larry did not ask for:

1. **I mutated production source, not only the injected mutants.** The four mutation tests carry their own mutants through injection seams. That proves the *seam* discriminates; it does not prove the *shipped* code is what the control is holding. I re-ran the proofs against `src/recovery.mjs` and `src/store.mjs` actually edited. See D-nothing — they all held.
2. **I executed the real production journey myself** through `bin/proofline.mjs`, not through the harness — page, submit, repeat-key, background completion, approval, abrupt kill, restart.
3. **I ran the full suite eleven times.** One run is not evidence of a suite's state. That is how D-1 was found; a single run would have passed.

**Deliberately not in scope:** the browser render (H-2, Warwick's) · the first live start (P-9, Warwick's, `live_authority: none` correctly held) · the four estate-wide parked items P-5..P-8.

**Receipt location.** No `Builds/BUILD-020-*` directory exists (map P-5 parks creating one as Warwick's call, and creating one is not Veritas's to do). The receipt therefore takes the template's second declared location, `Deliverables/`.

## Evidence provenance

- Isolated export of `reviewed_sha` at `…/scratchpad/export-39a553c`, created with `git archive 39a553cb… | tar -x -C <workspace>` (exit 0). No worktree was created; no `.git` state was touched.
- Repository `git rev-parse HEAD` at start / end — `39a553cb600b7a79d8b4c1845b2bb19e31a2bc69` / `39a553cb600b7a79d8b4c1845b2bb19e31a2bc69`, identical.
- Repository `git status --porcelain` — empty at start, empty at end.
- All mutations applied **inside the export only**. Restored and verified: `sha256sum -c` over `src/*.mjs` → 8/8 `OK`.
- Live journey ran against a temp data dir outside the repository, on ports 7391/7392, never the default 7317.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test` from `services/proofline`, × 11 runs | 0 / 1 | `# tests 83` each run | **7 runs `# fail 0`; 4 runs `# fail 1`.** The failure is always `not ok 47 — T-3d`. See D-1 |
| `node --test --test-reporter=tap` (test enumeration) | 1 | 83 `ok` lines | 82 named subtests + exactly **one** file-level entry `test\helpers\harness.mjs`. **The `83 = 82 + 1 helper` claim is honest** |
| M1 — production `src/recovery.mjs` `isOrphaned` → always `false` | 1 | 14 | **6 red**, incl. `T-3b` and `T-6a CONTROL`. Discriminates |
| M2 — production `src/recovery.mjs` `isOrphaned` → always `true` | 1 | 8 | **2 red**, incl. `T-6b CONTROL`. Discriminates |
| M3 — production `src/store.mjs` durable writer → corked `createWriteStream` | 1 | 17 | **10 red**, incl. `T-3b`, `T-3c CONTROL`, `T-4`, `T-7`, `T-8a/b`. Discriminates |
| M4 — production `src/store.mjs` `fsyncSync` removed | 1 | 3 | **2 red**: `T-3d` and `G-3 (process half)`. Discriminates |
| M5 — harness `kill()` → graceful exit (T-3a discriminance) | 1 | 1 | `crash.test.js` red. Discriminates |
| `T-3c MEASUREMENT` diagnostic | 0 | — | `uncorked stream — at ack: ON DISK; after kill: RETAINED`. **This is what makes D-2 a defect** |
| Live journey: `node bin/proofline.mjs`, real HTTP, real `SIGKILL`, restart | 0 | — | see §Production caller and journey |
| `bash scripts/secret-scan.sh --surface services/proofline` | 0 | 26 detection classes | `SCANNED 27 file(s), 0 secret value(s) found` |
| `git check-ignore -v services/proofline/.data/journal.jsonl` | 0 | — | `services/proofline/.gitignore:8:.data/` — matched. `git ls-files` shows no `.data` path tracked |
| **Unavailable, named:** a second machine (G-4 across-machines), a packet capture (G-10), a real browser (G-1/G-5 render), the first live start (G-11) | — | — | **Not treated as passed.** All four are recorded as unproven by the builder |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | Every clause of Warwick's sentence exists and I executed it end to end. The two parts held back (browser render, keeps-working) are recorded as held back in four separate documents, not smuggled through |
| Design fidelity | PASS | Map §5 implemented as written; D-1..D-11 honoured. The epoch is journal-persisted and fsynced before any lease (proven, not asserted); zero npm dependencies; `127.0.0.1` is a constant no environment variable can widen |
| Functional proof | PASS | The real production path, executed by me through `bin/proofline.mjs` — not the harness, not a component call |
| Integration | PASS | One wiring (`src/app.mjs`) serves both production and tests; every test seam defaults to the production value. No component is reachable only from a test. The UI is served by the same server that owns the API |
| Durability | PASS | Kill-and-revive performed at the real entrypoint, and the three durability controls made to fail against edited production source (M1, M2, M3) |
| Test quality | **HOLD** | The mutation tests are genuine and I verified all four against production source. But **T-3d fails intermittently at this exact head** (D-1), so the map's own runner gate `# fail 0` does not reliably hold; and the "runner gate" has no implementing artefact (D-8) |
| Git truth | **HOLD** | Head, branch, tree state and file surface are all exactly as reported, and no personal data is committable. But the map's stated **next action and phase status are wrong at this head** (D-3), and the Work Order envelope still reads `ISSUED` (D-7) |
| Documentation truth | **HOLD** | Three substantive misstatements — D-2 (an acceptance test the evidence disproves), D-5 (a proof attributed to the wrong artefact), D-4 (the RUNBOOK states as absolute what the README lists as not claimed) |
| Residual risk | **HOLD** | The four named limits are unusually well recorded — except that D-4 overstates one of them in the operator's own document, and the intermittency in D-1 is recorded nowhere |

## Production caller and journey

Traced from the entry point a real user reaches, hop by hop, executed live at `39a553cb`:

`.\scripts\start-proofline.ps1` → `bin/proofline.mjs` → `loadConfig()` (fail-fast) → `createApp()` → `worker.start()` **before** the port accepts → `server.listen('127.0.0.1')`.

| Hop | Executed result |
|---|---|
| `GET /` | `200`, `text/html`, 3894 bytes, 32 `id=` anchors — the real page, from the static allowlist |
| `POST /api/jobs {key,text}` | `201`, `state:"queued"`, `result:null`, `attempts:0`, `startedAt:null` |
| journal on disk at ack | `epoch.started \| job.created` — the record was there before the client was answered |
| background completion | `timeline: [job.created, job.started, job.completed]`, `words:5`, `resultSha256 bc338df2…` |
| `POST` same key, **different** text | `200`, `duplicate:true`, `textMatches:false`, stored text **unchanged**, journal `job.created = 1` |
| `POST /api/jobs/:key/approve` | `200`, `state:"approved"`, note recorded |
| `SIGKILL` the listening PID | abrupt; no handler runs (T-3a proves this separately) |
| restart on the same journal | `epoch: 2`, `counts.approved: 1`; the approval, its note, its `decidedAt` and its `resultSha256` all came back **identical**; `attempts` unchanged |

**Not on the journey, and recorded as such:** `isOrphaned` is reached in production only via `worker.scanOnce`, which I exercised live through the restart above — it is on the journey. `canonicalJson`'s float-refusal path is reached only from tests; no production input can produce a non-integer. The UI's `renderDetail`/`renderTimeline` were verified as served bytes and by their API inputs — **not rendered in a browser.** That is H-2.

## Restart and durability

Kill-and-revive executed, not reasoned about. An approval written to a live process survived `SIGKILL` and a restart on the same journal with `decidedAt`, `note` and `resultSha256` byte-identical, and the job was not reprocessed (`attempts` unchanged). Separately, M3 proves the store is what makes this true: with the durable writer replaced by a corked stream in **production source**, ten tests including `T-4` turn red.

**Boundary, correctly stated by the builder and confirmed by me:** `fsync` returning is not a statement about the platter. Power-loss survival is not claimed anywhere.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** the Wayfinder map is Larry's; `README.md` and `RUNBOOK.md` are Keel's (`WO` §Envelope).
- **Verified independently:** `git grep -il proofline` outside the service returns exactly two files — the map and the Work Order. No continuity brief, session log, SOP, INDEX or AGENTS contract references Proofline, so there is no third surface to drift.
- **What his list missed:** three claims in his own map are wrong at this head (**D-2, D-3, D-5**), and one claim in Keel's runbook is stronger than the evidence the same service's README refuses to give it (**D-4**). The map has been corrected twice already; this is the third round of the same failure mode, and each round has been found by execution rather than by re-reading.
- **Active documents that would misdirect a fresh instance:** `Deliverables/2026-08-04-proofline-wayfinder-plan.md:314` — *"Keel implements WP-1 in build order (§B of the Work Order), returning executed test output. Larry integrates, then dispatches Veritas…"* — WP-1 is built and integrated at this head and Veritas has been dispatched. §11 compounds it: Phase 1 `IN PROGRESS`, Phase 2 `NOT STARTED`, Phase 3 `NOT STARTED`.
- **Closure claims since the last receipt (`c1ed028` → `39a553cb`), and the receipt behind each:**
  - `Deliverables/2026-08-04-proofline-wayfinder-plan.md:301` — **Phase 0 marked `PASS`**, evidence *"Warwick's acceptance 2026-08-04"*. **No Veritas receipt.** See D-6, including why I did not escalate this to `FAIL`.
  - **No completion claim of any kind is made for WP-1.** §11 reads `IN PROGRESS`; the implementing commit labels its own evidence *"Builder self-test evidence - NOT independent review."* That is correct conduct and is recorded here as such.

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| **D-1** | **HIGH — blocking** | **`T-3d` is intermittent at this exact head: 4 failures in 11 full-suite runs (~36%).** `test/ordering.test.js:92` asserts `deepEqual(events.slice(0, idxResponse), [writeSync.enter, writeSync.return, fsyncSync.enter, fsyncSync.return])`. Under full-suite CPU load the worker's 100 ms periodic scan fires between `events.length = 0` and the POST, so `'worker.scan'` lands at index 0 and the assertion fails. The **narrow G-2a claim is unaffected** — `idxFsyncReturn < idxResponse` holds in every run — it is the *stronger* "nothing else happened first" assertion that races. `G-3 (process half)` at `:136` uses the same brittle pattern and is exposed to the same race. **Blocks:** recording WP-1's acceptance evidence as green and any PASS of WP-1, because the map's own runner gate (`# fail 0`) is not reproducible at this head, and the commit message's *"83 pass, 0 fail, twice consecutively"* reads as a stability the suite does not have | Larry to dispatch; Keel |
| **D-2** | **HIGH — blocking** | **The map states an acceptance test that the evidence disproves.** §1 G-2c and §8 T-3c both read *"swap `writeSync+fsyncSync` for `createWriteStream`, kill, assert the record is **LOST**"*. Executed on this machine, an **uncorked** `createWriteStream` gives `at ack: ON DISK; after kill: RETAINED` — the test as written in the contract would fail. The narrowing to the **corked** variant exists in `crash.test.js`, in the test diagnostic and partly in the README, but **not in the map**, which is the acceptance contract. §8 T-3c's *"Restore; assert it survives"* also does not match the implementation, which uses a separate control run rather than a restore. **Blocks:** using §8 as the acceptance basis for WP-1 | Larry |
| **D-3** | **HIGH — blocking** | **The map's frontier is stale at its own head.** §12 gives the exact next action as *"Keel implements WP-1"*; §11 records Phase 1 `IN PROGRESS` and Phase 2 Integration `NOT STARTED`. Both are false at `39a553cb`. A fresh Larry or specialist resuming from this map would re-dispatch work that already exists. Larry may not record Phase 1 `PASS` without this receipt — but `PARTIAL` and the Phase 2 boundary are his to record, and neither was. **Blocks:** any resume from this map, and a PASS under Gate 3's *"No PASS while an active document would send a fresh Larry, specialist or user down a superseded route"* | Larry |
| **D-4** | MEDIUM — non-blocking | **`RUNBOOK.md:178` states as absolute what `README.md:133` lists as not claimed.** The runbook's *"What this service will never do"* opens *"Contact anything outside your machine."*; the README says *"Zero network egress — a negative claim… What is proven is a static source assertion plus a runtime bind check, not the absence of egress."* Two documents in one service, opposite strengths, same claim — and the runbook is the one Warwick operates from at Phase 4. Mitigating: the same runbook sentence carries its own basis inline | Larry |
| **D-5** | MEDIUM — non-blocking | **The map attributes the G-3 proof to the wrong artefact.** §1 G-3's acceptance test reads *"the journal's ordered, separately-fsynced records show the HTTP response was emitted before `job.started`"*. **The journal contains no record of the HTTP response** and cannot show this. The property *is* proven — by the in-process trace in `ordering.test.js:122`, mutation-verified by M4 — and `http.test.js:70-76` says so explicitly and honestly. The map is the only document that gets it wrong. **On the dispatch's question:** the restated G-3 is honest and genuinely proven; it is not a weaker claim wearing the original's name. Its *stated evidence route* is wrong | Larry |
| **D-6** | HIGH — non-blocking | **Map §11 records Phase 0 as `PASS` with no Veritas receipt behind it** (`d318011`, since the last receipt). Root `CLAUDE.md` makes a receipt a precondition of a `PASS` phase boundary without exception. **I did not escalate this to `FAIL`, and the reasoning belongs in the open:** the thing claimed is *"Warwick accepted the plan"*, it is independently evidenced by Warwick's own recorded acceptance (H-1 `DONE`), it asserts no product capability, and **no receipt was suppressed** — the route Warwick himself accepted places the Veritas gate at Phase 3 only. Gate 3's receipt-enumeration control exists to catch a suppressed receipt; nothing was suppressed here. Whether planning-phase boundaries need a receipt is a governance question for Warwick, not a defect I will resolve inside a review | Larry to report; Warwick to decide |
| **D-7** | LOW — non-blocking | `WO-2026-08-04-01` §Envelope still reads `status: ISSUED`. Per `Templates/work-order` the lifecycle for returned-and-integrated work is `VERITAS_PENDING` | Larry |
| **D-8** | LOW — non-blocking | **The "runner gate" is an instruction, not a mechanism.** Map §8 and README both say *"Assert `# tests` ≥ expected AND `# fail 0` — never the exit code alone"*, but nothing implements it: `package.json` `"test": "node --test"` is exactly the exit-code route the map calls a vacuous green. The wording is accurate as an imperative and easy to misread as a control. **I am not recommending one be built** — the regrowth cap applies, CI is out of scope (P-6), and the honest correction here is wording | Larry to report; Warwick to decide |
| **D-9** | LOW — non-blocking | Two map facts overtaken by this head: §6 `F-4` still reads *"NEW, open until built"* (built and proven by T-8), and §2 *"Existing Proofline — none, on any branch"* | Larry |
| **D-10** | LOW — non-blocking | The map's governance head (§2, §12) reads `d3180118`, two commits stale. Mitigated by the map's own instruction to verify HEAD by execution — the C-3 lesson working as intended | Larry |

**On the four mutation tests, answered directly.** All four are real, and I did not take the builder's word for it. Each carries an injected mutant *and* I re-proved it by editing production source: T-6a (M1, 6 red), T-6b (M2, 2 red), T-3c (M3, 10 red), T-3d (M4, 2 red), T-3a (M5, red). **The tests turn red when the capability is removed.**

**On the `# tests 83` count, answered directly.** Honest. TAP enumeration shows 82 named subtests plus exactly one file-level entry, `test\helpers\harness.mjs`. Collapsing all harness code into a single file is a real mitigation and the inflation is exactly the 1 that was declared.

**On the four unproven properties, answered directly.** G-1 (UI render), G-4 (across machines), G-10 (zero egress) and G-11 (keeps working) are recorded as unproven in the map §1, the README's *"What is deliberately NOT claimed"* table, the Work Order's `live_authority: none`, and map P-9. A reader meets them. **The single exception is D-4.** The first live start is honestly outstanding and correctly not claimed.

## Verdict

**HOLD** — the service is substantially correct and its production journey works end to end under my own execution, but the acceptance suite does not reliably pass at this head, one acceptance test in the contract is disproved by the evidence, and the map's own next action is false at its own commit.

## Next review trigger

A new exact integrated head resubmitted after the three blocking findings are corrected: **D-1** (`test/ordering.test.js` intermittency, both the `:92` and `:136` trace assertions), **D-2** (map §1 G-2c and §8 T-3c narrowed to the corked mutant, and the "restore" step reconciled with the implementation), **D-3** (map §11 and §12 brought true at the resubmitted head). D-4, D-5, D-7, D-9 and D-10 are non-blocking, gate PASS, and may ride the same corrective pass at Larry's discretion. **D-6 and D-8 are Warwick's to decide and are not corrective work.**

> **Digest caveat, carried forward from the `94f135f` receipt and still open.** `core.autocrlf=true` with no `.gitattributes` means recomputing `receipt_sha256` from a fresh clone's working tree yields a false tamper signal. Recompute against the blob: `git show <sha>:<path> | tail -n +18 | sha256sum`. This receipt is **tamper-evident, not tamper-proof.**
