# Proofline — Wayfinder plan

## START / RESUME HERE — ordered by Warwick

- This Git Wayfinder is the sole route and source of truth.
- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- Read the current phase, gate and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer.
- Continue autonomously until completion or a genuine Warwick-only blocker.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate and next action.
- **Tangents go in "SHIT TO DO" below. Do not chase them.** See the rule there — it binds even when the tangent comes from Warwick.

## SHIT TO DO — parked tangents

Parked here, not chased. Reporting them is Larry's; deciding their fate is Warwick's.

| # | Item | Why parked |
|---|---|---|
| P-1 | Promote Proofline to a `Builds/BUILD-0NN-*` record | It did not come through the Foundry (IDEA-NNN → BUILD-NNN). Inventing a build number would fabricate governance. Warwick's call. |
| P-2 | Multi-process / multi-worker concurrency | Single local process is the stated shape. Cross-process locking is unbuilt and unneeded. |
| P-3 | Auth on the HTTP surface | Loopback-only, single user, no credentials. Adding auth is hardening beyond the hobby-brain bar. |
| P-4 | Cockpit / Expansion integration | Proofline is standalone by request. |

---

## 1. Goal contract and North Star

**North Star:** Warwick opens a browser on his own machine, submits text under a key he chooses, and can *prove* — not be told — that the work was durably recorded, processed in the background, held for his approval, and survived the process being killed.

**The goal contract, as stated, decomposed into eight acceptance properties.** Every one is testable by execution. Nothing here is satisfied by a claim.

| # | Property | Acceptance test |
|---|---|---|
| G-1 | Submit text + a unique key from a browser | Real page, real form, real POST |
| G-2 | Stored **durably** | Survives `SIGKILL` of the process; ack returned only *after* `fsync` |
| G-3 | Processed **in the background** | Submit returns while state is `queued`; the browser observes `queued → processing → awaiting_approval` |
| G-4 | Result is **deterministic and structured** | Same text → byte-identical result digest, across keys, across restarts, across machines |
| G-5 | Status and output visible | Both rendered in the UI and available on the API |
| G-6 | **Pauses for approval** | Terminal-before-decision state `awaiting_approval`; nothing auto-advances past it |
| G-7 | Approval **saved** | Decision survives `SIGKILL` + restart |
| G-8 | **Recovers** if killed and restarted | A job killed mid-`processing` is re-queued on restart and completes; no loss, no duplicate |
| G-9 | **Never duplicates on repeat key** | Second `POST` with same key creates no second job; returns the existing one |
| G-10 | No external API, credential, spend or live service | Zero npm dependencies; zero network egress; loopback bind only |
| G-11 | Keeps working after this chat closes | Plain `node` process + launcher + runbook; nothing depends on Claude Code, an agent, or a session |

**G-11 is the property most often faked.** It is satisfied only by a documented, executed start command that a human runs, with the process outliving this session — not by "it should work".

---

## 2. Current reality and verified assets (executed 2026-08-04, not assumed)

| Fact | Value | How verified |
|---|---|---|
| Worktree | `C:\Fusion247PKA-build-020-trial` | `git worktree list` |
| Branch | `build-020/live-trial` | `git rev-parse --abbrev-ref HEAD` |
| HEAD | `4a3b87306a3731ce65436db159eb5210f9cb8eb9` | `git rev-parse HEAD` |
| Tree | clean | `git status --porcelain` (empty) |
| Node | `v22.18.0` | `node --version` |
| npm | `10.9.3` | `npm --version` |
| `node:sqlite` | present, emits `ExperimentalWarning` | `require('node:sqlite')` |
| Existing Proofline | **none**, on any branch | `git log --all -i --grep=proofline` empty; `git ls-files` empty |
| Estate service convention | `services/<name>/` | `ls services/` — 8 existing services |
| Governor footer | `tools/governor/footer.mjs` present | `ls -la` |

**No contradictions found between sources.** Nothing was overwritten to reach this table.

---

## 3. System map and product boundaries

```
Browser (127.0.0.1:7317)
  │  static HTML/CSS/JS — no build step, no CDN, no framework
  ▼
node:http server  ── services/proofline/src/server.mjs
  ├── POST /api/jobs            submit (idempotent on key)
  ├── GET  /api/jobs            list
  ├── GET  /api/jobs/:key       detail + result
  ├── POST /api/jobs/:key/approve
  ├── POST /api/jobs/:key/reject
  └── GET  /api/health
        │
        ▼
  Store  ── src/store.mjs      append-only JSONL journal + fsync, replay-on-start
        │      services/proofline/.data/journal.jsonl   (gitignored)
        ▼
  Worker ── src/worker.mjs     in-process loop, epoch-leased, re-queues orphans
        │
        ▼
  Processor ── src/processor.mjs   PURE function of text → structured result
```

**In scope:** the loop above, end to end, with executable proof.
**Out of scope (boundaries, deliberate):** multi-process workers · authentication · remote access · any network call · any database server · any npm dependency · Cockpit integration · a job type beyond the one deterministic text analysis.

---

## 4. Decisions — made, with reasons (Larry's, as ordinary technical choices)

| ID | Decision | Reason | Rejected alternative |
|---|---|---|---|
| D-1 | Location `services/proofline/` | Matches the estate's 8 existing services | Repo root — inconsistent |
| D-2 | **Zero npm dependencies.** Node stdlib only | `npm install` is a network operation and a future breakage surface. G-10 and G-11 are both served by having nothing to install | Express / better-sqlite3 |
| D-3 | Storage = **append-only JSONL journal + `fsyncSync`**, index rebuilt by replay on start | Durable, crash-safe, human-inspectable, and the recovery path is *provable* by reading the file. No experimental API | `node:sqlite` — **rejected: experimental**, API may change under a Node upgrade, which directly threatens G-11 |
| D-4 | Ack the browser **only after `fsync` returns** | Persistence is a precondition of an acknowledgement, not a consequence | Ack-then-write |
| D-5 | Idempotency key = the user's `key`, checked-and-appended with no `await` between check and write | Node's event loop is single-threaded; a synchronous critical section is a real guarantee here, not a hope | Optimistic insert + dedupe later |
| D-6 | Recovery via **process epoch**, not wall-clock lease timeout | A clock-based lease is untestable without sleeping and is wrong if the clock moves. Epoch is exact: a `processing` job stamped with a *previous* epoch is by definition orphaned | Heartbeat timestamps |
| D-7 | Result carries **no floats and no timestamps** | Float formatting drifts across platforms; a timestamp inside the result destroys G-4. Averages are stored integer-scaled (×1000) | Floating-point averages |
| D-8 | Bind `127.0.0.1` only, port `7317` (`PROOFLINE_PORT` overrides) | No external exposure; explicit loopback, never `0.0.0.0` | Default all-interfaces bind |
| D-9 | Approval is a **journal record**, not a mutated row | The decision and its ordering are both then durable and auditable | In-place update |
| D-10 | Retain as a `Deliverables/` + `services/` build, **not** a `BUILD-0NN` record | It did not come through the Foundry. See P-1 | Invent a build number |

---

## 5. The shared contract — published BEFORE any parallel work

Disjoint file ownership prevents collisions; it does not prevent shared misunderstanding. This section is the contract every specialist codes against.

### Job states

```
queued ──▶ processing ──▶ awaiting_approval ──▶ approved
   ▲            │                              └▶ rejected
   └────────────┘  (crash recovery: epoch mismatch on restart)
                │
                └──▶ failed   (after attempts > 3)
```

`awaiting_approval` **never** self-advances. That is G-6.

### Job object (returned by the API)

```jsonc
{
  "key":          "string, 1..128 chars, [A-Za-z0-9._:-]+",
  "textSha256":   "hex64",
  "textLength":   0,
  "state":        "queued|processing|awaiting_approval|approved|rejected|failed",
  "submittedAt":  "ISO-8601",
  "startedAt":    "ISO-8601|null",
  "completedAt":  "ISO-8601|null",
  "decidedAt":    "ISO-8601|null",
  "attempts":     0,
  "epoch":        0,
  "result":       null,          // structured result, or null
  "resultSha256": "hex64|null",  // digest of canonical JSON of `result`
  "decision":     null,          // { "verdict": "approved|rejected", "note": "", "at": "ISO-8601" }
  "error":        null           // { "message": "", "at": "ISO-8601" }
}
```

### Deterministic result object

Pure function of `text` **only**. Not of the key, not of the time, not of attempt number.

```jsonc
{
  "version": 1,
  "textSha256": "hex64",
  "chars": 0, "charsNoWhitespace": 0,
  "lines": 0, "words": 0, "sentences": 0, "paragraphs": 0,
  "uniqueWords": 0,
  "avgWordLengthMilli": 0,      // integer, length*1000/words, truncated — NO floats
  "topTerms": [ { "term": "x", "count": 3 } ],   // top 10; ties broken alphabetically ascending
  "longestLine": { "index": 0, "length": 0 },
  "readingTimeSeconds": 0       // integer, ceil(words * 60 / 200)
}
```

`resultSha256` = SHA-256 of `JSON.stringify` over a **key-sorted canonical** form. Two different keys carrying identical text MUST produce identical `resultSha256`. That is the G-4 test.

### HTTP contract

| Method | Path | Success | Failure |
|---|---|---|---|
| `POST` | `/api/jobs` `{key,text}` | `201 {job}` new · **`200 {job, duplicate:true}` existing key** | `400` invalid key/text · `413` text > 1 MiB |
| `GET` | `/api/jobs` | `200 {jobs:[summary]}` | — |
| `GET` | `/api/jobs/:key` | `200 {job}` | `404` unknown |
| `POST` | `/api/jobs/:key/approve` `{note?}` | `200 {job}` | `404` unknown · **`409` not in `awaiting_approval`** |
| `POST` | `/api/jobs/:key/reject` `{note?}` | `200 {job}` | `404` · `409` |
| `GET` | `/api/health` | `200 {ok,epoch,uptimeMs,counts}` | — |

The `200 + duplicate:true` on repeat key is G-9 and is **not** an error path. Re-submitting a key with *different* text also returns the original job unchanged — the key is the identity, and silently reprocessing would violate G-9.

---

## 6. Unresolved fog

Genuinely open. Not padding.

| # | Fog | How it gets resolved |
|---|---|---|
| F-1 | Windows `SIGKILL` semantics under Node — `process.kill(pid,'SIGKILL')` on win32 maps to `TerminateProcess`. Does it truly skip flush handlers, making the crash test *real*? | WP-1 must prove the kill is abrupt by asserting an un-fsynced write would have been lost — not by assuming |
| F-2 | Whether `fsyncSync` on NTFS actually reaches the platter or stops at the drive cache | Out of our control and out of scope. The claim we will make is "fsync returned before ack", never "survives power loss". Recorded so nobody upgrades the claim later |
| F-3 | Browser-observable background transition — is processing fast enough that `queued` is never seen? | WP-1 makes the worker poll interval and a small deliberate work step explicit so the transition is genuinely observable, and the test asserts a non-`awaiting_approval` state is returned by the submit response |

---

## 7. Security, permissions, ownership, recovery boundaries

- **`private_surface: none`.** No work package in this build touches `C:\.fusion247\**`. GL-012 is not engaged.
- **Credentials: none.** No secret is read, written, or required.
- **Network: loopback only.** `server.listen(port, '127.0.0.1')` — an explicit host argument, never the default.
- **Static file serving must reject path traversal.** Serve from an allowlist of known filenames, not by joining user input to a directory.
- **Input limits:** key ≤ 128 chars against a strict charset; body ≤ 1 MiB, enforced by counting bytes as they arrive, not after buffering.
- **Data at rest:** `services/proofline/.data/` — gitignored. Warwick's submitted text never enters Git. (Fusion247PKA is a public repo.)
- **Recovery boundary:** recovery restores *jobs*, not decisions-in-flight. A decision is atomic: it is either fsynced or it never happened.
- **Ownership:** Larry owns route, sequencing, integration, git lifecycle and the merge recommendation. Specialists execute. Warwick decides merge.

---

## 8. Acceptance evidence — what must be EXECUTED, not asserted

A control is not evidence until it has been made to fail. Tests T-1..T-7 are the gate; **T-6 is the mutation test that proves T-3 can fail.**

| ID | Test | Proves | Bar |
|---|---|---|---|
| T-1 | Submit key `k` twice → one job, second returns `200 duplicate:true`, journal contains exactly one `job.created` for `k` | G-9 | Assert on the **journal bytes**, not just the API response |
| T-2 | Same text under keys `a` and `b` → identical `resultSha256`; restart; reprocess → still identical | G-4 | Byte equality of the digest |
| T-3 | Spawn server → submit → `SIGKILL` while state is `processing` → restart → job returns to `queued`, then completes; `attempts` incremented; text intact | G-2, G-8 | Real child process, real kill, real restart |
| T-4 | Approve → `SIGKILL` → restart → decision present and identical | G-7 | Real kill |
| T-5 | Approve a `queued` job → `409`; job unchanged | G-6 | Negative test |
| T-6 | **Mutation:** disable the epoch check in recovery → assert T-3 **FAILS** | T-3 is a real control | Test harness asserts the failure, and asserts a non-zero count of executed tests |
| T-7 | Journal prefix stability: capture bytes, run more work, assert the original prefix is unchanged | Append-only is real | Byte-prefix comparison |

Plus a **live browser walkthrough**, screenshotted: submit → watch status change → read output → approve → reload → approval still there.

**Every claim in the final report carries its evidence in the same message, or it is labelled BUILT-NOT-VERIFIED.**

---

## 9. Execution route

| Phase | Work package | Owner | Gate |
|---|---|---|---|
| 0 | Wayfinder map (this document) | Larry | Warwick accepts the plan — `product-decision` |
| 1 | **WP-1** — service core: store, worker, processor, recovery, idempotency, HTTP API, functional UI, tests T-1..T-7, launcher, runbook | **Keel** | Read-back accepted; then T-1..T-7 green, executed output pasted |
| 2 | **WP-2** — UI polish on the working surface (states, output rendering, approval affordance) | **Felix** | Builds only on the WP-1 contract; no API change |
| 3 | **WP-3** — proportional security pass: loopback bind, traversal, input limits, no-egress check | **Vex** | Findings reported once; only ACTIVE `BLOCKS_CURRENT_MERGE` items become work |
| 4 | **WP-4** — visual + WCAG 2.2 AA QA | **Vera** | Sign-off |
| 5 | Integration + live browser walkthrough | Larry (integration), specialist (execution) | Evidence captured |
| 6 | **Veritas** on the **exact integrated head** | Veritas | `VERITAS_PASS` required before any completion claim |
| 7 | Merge decision | **Warwick** | `merge-decision` |

**Parallelism:** WP-2 and WP-3 may run concurrently after WP-1 lands, on disjoint file surfaces, with git serialised by Larry. WP-4 follows WP-2.

**Before Veritas passes the integrated head, the maximum permitted statement about this build is:** «Integrated at "\<SHA\>" and submitted to Veritas for assurance.»

---

## 10. Human dependencies

| # | Dependency | Required at |
|---|---|---|
| H-1 | Warwick accepts this plan (`product-decision`) | Phase 0 → 1 boundary. **Now.** |
| H-2 | Warwick's own browser walkthrough — his eyes on the real surface | Phase 5 |
| H-3 | Warwick's merge decision (`merge-decision`) | Phase 7 |

Nothing else requires him. He is not asked to run a git command, choose a git route, or understand a git concept at any point.

---

## 11. Phase status (the tracker — update ONLY at a phase boundary: PASS / PARTIAL / FAILED + evidence)

| Phase | Status | Evidence | Date |
|---|---|---|---|
| 0 — Wayfinder map | **AWAITING WARWICK'S ACCEPTANCE** | this document, at `4a3b873` | 2026-08-04 |
| 1 — WP-1 service core | NOT STARTED (read-back dispatched) | — | — |
| 2 — WP-2 UI polish | NOT STARTED | — | — |
| 3 — WP-3 security | NOT STARTED | — | — |
| 4 — WP-4 visual QA | NOT STARTED | — | — |
| 5 — Integration + walkthrough | NOT STARTED | — | — |
| 6 — Veritas gate | NOT STARTED | — | — |
| 7 — Merge | NOT STARTED | — | — |

---

## 12. Current frontier and the exact next action

**Frontier:** Phase 0 complete as a document; the plan-acceptance gate is open.

**Exact next action:** Warwick accepts, amends or rejects this plan. On acceptance, Larry issues WP-1 to Keel against governance head `4a3b87306a3731ce65436db159eb5210f9cb8eb9` and Keel begins implementation from the read-back already returned.

**Resumable state after `/clear` or a fresh session:** everything needed is in this file. Branch `build-020/live-trial`, worktree `C:\Fusion247PKA-build-020-trial`. Verify HEAD by execution before trusting the SHA above.
