# BUILD-020 — Wayfinder plan

> **This file is the single BUILD-020 Wayfinder map.** Its filename still says `proofline` because it began as the Proofline map on 2026-08-04 and **a file rename would break every pointer to it**; the mismatch is recorded here rather than fixed. **Proofline is BUILD-020's completed proof application** (Warwick, 2026-08-04) — not a separate build, no `BUILD-0NN` of its own. **Do not create a second or competing map** (Warwick, 2026-08-04): the next phase extends this file.

---

## ⟦ROTATION BLOCK⟧ — read this first, then verify every line of it by execution

**Written 2026-08-04 at the rotation boundary. Everything below was true when written and is a claim about the past, not the present.**

| | |
|---|---|
| **Map path** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — this file. The only BUILD-020 map. |
| **Branch** | `build-020/live-trial` |
| **Worktree** | `C:\Fusion247PKA-build-020-trial` |
| **Head when written** | `ca4580298e1c3aad4f922637c3d836854b4af539`, **advanced by the commit that added this block.** `git rev-parse HEAD` is the authority — this map has recorded a stale head three times (C-3, and twice in the Work Order envelope). **Do not trust a SHA in this file over the repository.** |
| **Upstream** | ~~**NONE CONFIGURED.** 51 commits ahead of `origin/main`.~~ **CORRECTED 2026-08-04 by execution (R-2): upstream IS `origin/build-020/live-trial`, 54 commits ahead, and PR #94 is already open as a DRAFT.** Remote is `https://github.com/warwickallan/Fusion247PKA.git`. |
| **Phase complete** | **Phase 1 — Proofline. PASSED by Warwick, 2026-08-04**, on his own completed walkthrough. |
| **Frontier** | **Phase 2 — Honcho and Tower as durable shared myPKA infrastructure.** Not started. The fresh session owns implementation. |
| **First safe action** | §13 below. Verify reality, then route. **Do not implement before the route exists.** |

### ⚠️ RESUMPTION PRECEDENCE — and the active misdirection risk

**Automatic reorientation to this map WILL NOT HAPPEN.** Stated plainly because assuming otherwise is the failure:

1. **No SessionStart hook is registered for this worktree** — the only one is hardcoded to `C:/Fusion247PKA/tools/governor/reorient.mjs`. A fresh Larry opened here receives **no continuity brief at all**.
2. **If one is opened in the main worktree instead, it receives a brief naming BUILD-015 AsdAIr** — `~/.mypka/governor/continuity.json` was last written `2026-08-04T06:42Z` and contains no occurrence of "proofline" or "BUILD-020".
3. **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` declares itself the sole route** and carries its own precedence block. A fresh session that opens it will be told, correctly for BUILD-015, that it is the authority. **It is not the authority for BUILD-020.**

**So the risk is not a blank orientation — it is a confident wrong one.** Fixing that is Phase 2's N-2.

**Precedence for BUILD-020, until N-2 lands:**

| Rank | Source | Authority |
|---|---|---|
| 1 | **This file** | **THE BUILD-020 route. The only document that may state the exact next action for BUILD-020.** |
| 2 | `Deliverables/proofline/WO-2026-08-04-01-*.md` and the two `*-veritas-proofline-*receipt.md` | Evidence and contracts. **Never a route.** |
| 3 | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` | **Authoritative for BUILD-015 ONLY. NON-DIRECTIVE here.** Do not take its next action as yours. |
| 4 | `Builds/` | **No `BUILD-020-*` record exists** (P-5). Its absence is a recorded fact, not a missing file to go and find. |
| 5 | The Honcho continuity brief | **Pointer with zero authority** (root `CLAUDE.md` #9) — and currently **stale and wrong for BUILD-020**. Verify against this file; never the reverse. |

**Until Phase 2 fixes it, a fresh session is reached by naming this path:**
`Deliverables/2026-08-04-proofline-wayfinder-plan.md`

### 🚨 The instrument warning — read before ANY live-state check

**In Git Bash on this machine, MSYS silently mangles `/FLAG` arguments into Windows paths.** `tasklist /FI "IMAGENAME eq node.exe"` became `C:/Program Files/Git/FI` and errored; I read the empty result as *"no processes are running"* and **stated it to Warwick as a fact.** It was wrong. Sixteen node processes were running, including the Tower watcher.

**Always `export MSYS_NO_PATHCONV=1`, or use `//c` / `//FI`.** Re-verified correct form:

```bash
MSYS_NO_PATHCONV=1 tasklist /FI "IMAGENAME eq node.exe" /FO CSV
MSYS_NO_PATHCONV=1 cmd.exe /c "…"
```

This matters more than it looks: **the entire next phase is about proving what is and is not running.** A mangled instrument produces a confident, wrong negative — which is exactly the failure this build already paid for once.

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

---

## 0. AMENDMENT 1 — the corrections forced by Keel's executed read-back (2026-08-04)

**This is the single plan amendment Warwick authorised.** Version 1 of this map was written before implementation and before any preflight. Keel's read-back (`REFUSE`, class-A — a defect in the order, not in the work) executed probes on this machine and overturned four things. They are recorded here rather than silently overwritten, because a map that hides its own corrections is worth less than one that shows them.

| # | What v1 claimed | What execution proved | Disposition |
|---|---|---|---|
| **C-1** | F-1: prove the kill is abrupt "by asserting an un-fsynced write would have been lost" | **False.** A completed `writeSync` lands in the OS page cache, which survives process death. Under `SIGKILL`, fsync and no-fsync are byte-identical. **`SIGKILL` cannot distinguish them — only power loss can.** v1 demanded a proof that does not exist, and the only way to make it "pass" was fabrication | **Replaced** by three separate proofs (§8 T-3a/T-3b/T-3c) |
| **C-2** | §7: "`services/proofline/.data/` — gitignored" | **False at time of writing.** `git check-ignore -v` matched nothing; no `.data` rule exists in the root `.gitignore`. **Fusion247PKA is a public repository, so Warwick's submitted text was committable** | **Fixed:** `services/proofline/.gitignore` is written as build step 1, before the store can create a single file |
| **C-3** | §2/§11/§12: HEAD `4a3b873` | Stale. The map recorded HEAD *before* committing itself; its own commit is `d3180118` | **Corrected** throughout. Governance head is now `d3180118e07b0bab3981de92a57c7a320b042163` |
| **C-4** | F-3: a "small deliberate work step" would make the background transition observable | Measured: a realistic ~1 KB paste processes in **2.451 ms** (64 KB → 7.7 ms; 1 MiB → 120 ms). `processing` is **not** browser-observable at any human polling interval. An artificial delay inserted to make a state visible is **fabricating the evidence for G-3** | **G-3 restated** to the true, provable claim (§1). No artificial delay will be built |

Keel additionally **proved the kill is genuinely abrupt** — no `exit`, `beforeExit` or signal handler runs, verified against a graceful control where the same handler *does* fire — and found two harness traps recorded in §6.

**Also settled by Warwick, 2026-08-04:** the finish level is the **functional route with a clean, usable UI** — not deliberately ugly, and not a design-system deliverable. Felix, Vex and Vera are **not** engaged unless a specific acceptance failure demonstrates one is necessary. Veritas remains at the single already-planned gate.

---

## SHIT TO DO — parked tangents

Parked, not chased. Reporting them is Larry's; deciding their fate is Warwick's.

| # | Item | Why parked |
|---|---|---|
| P-1 | ~~Promote Proofline to a `Builds/BUILD-0NN` record~~ | **CLOSED by Warwick 2026-08-04** — Proofline is the proof application inside BUILD-020; no new number |
| P-2 | Multi-process / multi-worker concurrency | Single local process is the stated shape |
| P-3 | Auth on the HTTP surface | Loopback-only, single user, no credentials |
| P-4 | Cockpit / Expansion integration | Standalone by request |
| P-5 | **No `Builds/BUILD-020-*` record exists on disk.** BUILD-020 is currently only a branch and commit-message convention; `git ls-files` and a repo-wide grep both return nothing | Observation, reported once. Creating one is scope growth and is Warwick's call |
| P-6 | CI workflow (`.github/workflows/**`) for Proofline | Not asked for. Explicitly out of scope |
| P-7 | `HANDBACK_CODES` in `tools/governor/footer.mjs` has no importing consumer since `stop-controller.mjs` was deleted — only a human reader ties it to CLAUDE.md | Estate-wide, unrelated to Proofline |
| **P-8** | **`node --test` counts helper modules as passing tests (F-A).** Any service in the estate whose `test/` holds non-test `.js`/`.mjs` files has an inflated `# tests` count, and every one of those entries asserted nothing. A count assertion built on it is weaker than it looks | **Estate-wide, and it touches every service's acceptance evidence.** Reported once for Warwick's decision. Not a Work Order — a finding is an observation, not an instruction |
| **P-9** | **First live start of Proofline** — G-11 is established only by Warwick starting it himself and it outliving the session. Keel has `live_authority: none` and correctly did not claim it | Held for Phase 4 (H-2). Not a defect |
| **P-10** | **MEDIUM, estate-wide — `git checkout`/`git restore` is not a safe byte-restore in this repository.** `core.autocrlf=true` with **no root `.gitattributes`** (both verified). The working tree holds LF, git's checkout representation is CRLF. Restoring a file via `git checkout` produced byte-different content from the original while git reported the tree clean; restoring the true original bytes made git report it *modified* with an empty `git diff`. **This is the same root cause as the Veritas receipt's own digest caveat.** A root `.gitattributes` would close it | Outside the Proofline surface and affects every worktree in the estate. Reported once for Warwick's decision. **Not a Work Order** |
| **P-11** | LOW — the brittle-pattern class, not just the two fixed lines: any future `deepEqual` over a shared trace bus is exposed to the same race. `assertQuiesced` guards the three tests in this file; nothing generalises it, and nothing was built to | Deliberately not generalised. Regrowth cap |
| **P-12** | **Contract deviation, found in the live journey 2026-08-04.** §5.4 specifies `decision` as an object `{verdict, note, at}`. The service returns the bare string `"approved"`. **The approval note IS durably stored** — the `job.decided` journal record carries it — **but it is not readable back through the API**, so a note Warwick writes when approving can never be seen again. Verified live: journal record 4 holds the note; `GET /api/jobs/:key` does not. Also minor: `error` is absent from the response rather than `null` as specified | **Reported once for Warwick's decision.** Not blocking the launch journey, and **not** a Work Order — a finding is an observation. Either the contract is wrong or the code is; that is his call |
| **P-13** | **The rendered browser page is still unproven.** Chrome could not load `http://127.0.0.1:7317/` under automation — the extension requires a site-level permission for this origin that only Warwick can grant in the extension UI. The page *serves* correctly (a full browser-shaped request returns all 3,791 bytes with `content-type: text/html`), but **serving is not rendering** | G-1 and G-5's UI halves remain **H-2 — Warwick's own walkthrough**, exactly as the map has said throughout |

---

## 1. Goal contract and North Star

**North Star:** Warwick opens a browser on his own machine, submits text under a key he chooses, and can *prove* — not be told — that the work was durably recorded, processed off the request path, held for his approval, and survived the process being killed.

| # | Property | Acceptance test | Provable by WP-1? |
|---|---|---|---|
| G-1 | Submit text + a unique key from a browser | Real page served, real POST | **Partly** — page and POST provable headlessly; a real browser is H-2, Warwick's own walkthrough |
| G-2a | Ack is written only **after** `fsyncSync` returned | Call-**ordering** assertion via an injected `fs` façade | Yes |
| G-2b | A record acknowledged before an abrupt kill is still there after restart | Real kill, real restart, journal read | Yes |
| G-2c | The durable write is what makes G-2b true — **NARROWED 2026-08-04 by execution (Veritas D-2)**. The honest claim is: *a writer that returns while the bytes are still in userspace loses an acknowledged record on an abrupt kill.* It is **not** "`createWriteStream` loses data" | **Mutation:** swap `writeSync+fsyncSync` for a **corked** stream, kill, assert the record is **lost**. An **uncorked** stream measured `at ack: ON DISK; after kill: RETAINED` — libuv flushed first, so asserting loss there would be asserting libuv's flush timing, which is not a property of Proofline | Yes, as narrowed |
| G-2d | Survives power loss | — | **NOT CLAIMED.** See F-2 |
| G-3 | Processed **in the background** — *restated per C-4:* submission does not block on processing | Submit response returns `queued` with `result: null`; the journal's ordered, separately-fsynced records show the HTTP response was emitted before `job.started` | Yes. **`processing` is a journal-observable state, not a UI-observable one** — it lasts ~2.5 ms |
| G-4 | Result is **deterministic and structured** | Same text → byte-identical `resultSha256`, across keys, across restarts, across processes | Yes for keys/restarts/processes. **"Across machines" is structurally engineered (§5) but NOT proven** — one machine available |
| G-5 | Status and output visible | Rendered in the UI and available on the API. The UI shows the **durable state timeline** from the journal, so Warwick sees that the job passed through `queued` and `processing` with timestamps even though he could not watch it live | API half yes; UI render is H-2 |
| G-6 | **Pauses for approval** | `awaiting_approval` never self-advances | Yes |
| G-7 | Approval **saved** | Decision survives kill + restart | Yes |
| G-8 | **Recovers** if killed and restarted | Job re-queued on restart and completes exactly once, up to the attempt guard (§5) | Yes |
| G-9 | **Never duplicates on repeat key** | Second POST creates no second job; journal contains exactly one `job.created` | Yes |
| G-10 | No external API, credential, spend or live service | Zero npm dependencies; loopback bind asserted. **"Zero network egress" is a negative claim** — proportionate substitute is a static assertion that no `http(s)` client, `fetch`, `dns` or socket-connect call exists in the source. Named as a limitation, never as proof | Partly |
| G-11 | Keeps working after this chat closes | Launcher + runbook + a detached start Warwick performs | **NOT WP-1's to claim.** First live start is a Warwick gate at Phase 4 |

---

## 2. Current reality (executed 2026-08-04 — corrected per C-3)

| Fact | Value |
|---|---|
| Worktree | `C:\Fusion247PKA-build-020-trial` |
| Branch | `build-020/live-trial` |
| **Governance head** | **`d3180118e07b0bab3981de92a57c7a320b042163`** |
| Node / npm | `v22.18.0` / `10.9.3` |
| `node:sqlite` | present, **experimental** |
| Existing Proofline | none, on any branch |
| `node --test` from a service dir | **CORRECTED 2026-08-04 by execution (F-A).** It executes **every `.js`/`.mjs` under `test/**`**, not only `*.test.js` — a helper module runs and is counted as a passing entry that asserted nothing, quietly inflating `# tests` and weakening a count assertion. Mitigated by collapsing all harness code into one file, so the inflation is exactly 1 and stated. It also **returns exit 0 on ZERO tests** (`# tests 0`) — a vacuous green. The count must be asserted, not the exit code |
| `node --test test/` (directory arg) | **fails**, exit 1. Do not use |
| `scripts/secret-scan.sh --surface <path>` | runs; exit 2 + "NOT SCANNED" when the target does not exist |

---

## 3. System map

```
Browser (127.0.0.1:7317)
  │  static HTML/CSS/JS — clean and usable, no build step, no CDN, no framework
  ▼
node:http server  ── src/server.mjs        the §5 HTTP contract
  ▼
Store  ── src/store.mjs        append-only JSONL + fsyncSync, replay-on-start,
  │                            torn-tail tolerant, mid-file corruption fails LOUD
  │                            services/proofline/.data/journal.jsonl  (gitignored)
  ▼
Worker ── src/worker.mjs       startup recovery + periodic scan while live
  │        src/recovery.mjs    isOrphaned(job, epoch) — INJECTABLE pure predicate
  ▼
Processor ── src/processor.mjs + src/canonical.mjs
             PURE function of text. No I/O, no clock, no locale, no float.
```

---

## 4. Decisions

| ID | Decision | Reason |
|---|---|---|
| D-1 | `services/proofline/` | Estate convention (8 sibling services) |
| D-2 | **Zero npm dependencies** | An install is a network operation and a future breakage surface. G-10 and G-11 are the same requirement twice |
| D-3 | **Append-only JSONL + `fsyncSync`**, index rebuilt by replay | Durable, provably append-only, human-inspectable. `node:sqlite` **rejected: experimental** — its API may change under a Node upgrade, which directly threatens G-11 |
| D-4 | Ack only after `fsync` returns | Persistence is a precondition of an acknowledgement, not a consequence |
| D-5 | Idempotency on the user's `key`; check-and-append with **no `await` between them** | Node's event loop is single-threaded, so a synchronous critical section is a real guarantee here |
| **D-6** | **Recovery via process epoch — AMENDED.** The epoch is a **journal-persisted, monotonically increasing integer**, allocated at startup and **fsynced before any job is leased**. Recovery runs **at startup AND periodically while the worker is live** | Keel: unspecified allocation would reintroduce the clock defect D-6 exists to avoid (D-6a). And with one process, "epoch mismatch" and "any `processing` job at startup" are the same set — so at startup the epoch is **not load-bearing** and a no-epoch implementation would still pass. It earns its place only in the live periodic scan, where it is what stops the running worker re-queueing its own in-flight job and processing it twice (D-6b) |
| **D-6c** | The predicate is an **exported pure function `isOrphaned(job, currentEpoch)` injected into the worker** | §8's mutation test needs a seam. Mutating source text mid-run is fragile and can leave the tree dirty |
| D-7 | No floats, no timestamps, no locale APIs inside `result` | Float formatting and `localeCompare` both drift across machines; a timestamp destroys G-4 |
| D-8 | Bind `127.0.0.1` explicitly, port `7317` (`PROOFLINE_PORT` overrides) | Never the default all-interfaces bind |
| D-9 | Approval is a journal record, not a mutated row | Decision and its ordering both durable and auditable |
| **D-11** | **Clean, usable UI is inside WP-1**, built by Keel | Warwick, 2026-08-04, explicitly. Bar is *clean and usable*, not a design-system deliverable. Felix is not engaged |

---

## 5. The contract — settled, no field left to a guess

### 5.1 Canonical text handling

**The text is hashed exactly as received.** UTF-8 bytes from the request body. **No Unicode normalisation, no CRLF→LF, no trimming.** `sha256("a\r\nb") !== sha256("a\nb")` and `sha256(NFC "é") !== sha256(NFD "é")` — both verified — and that is correct: the digest describes what arrived.

The UI **must** post `application/json` so newlines survive transit unchanged.

### 5.2 Processor spec — the whole basis of G-4, stated exhaustively

```
RAW        = the text exactly as received
CP(s)      = Unicode code points in s          // Array.from(s).length — never .length
TOKEN_RE   = /[\p{L}\p{N}_']+/gu               // Unicode-aware, locale-INDEPENDENT
tokens     = RAW.match(TOKEN_RE) ?? []
lower(t)   = t.toLowerCase()                   // NEVER toLocaleLowerCase
cmp(a,b)   = a < b ? -1 : a > b ? 1 : 0        // code-unit order. NEVER localeCompare

textSha256         = SHA-256 over the exact received UTF-8 bytes
chars              = CP(RAW)
charsNoWhitespace  = CP(RAW.replace(/\s/gu, ''))
lines              = RAW === '' ? 0 : (count of '\n' in RAW) + 1
words              = tokens.length
uniqueWords        = size of Set(tokens.map(lower))
sentences          = RAW.trim() === '' ? 0 : max(1, matches of /[.!?]+(?=\s|$)/gu)
paragraphs         = RAW.split(/\n[ \t]*\r?\n/) → blocks containing /\S/ → count
avgWordLengthMilli = words === 0 ? 0 : trunc( sum(CP(t) for t in tokens) * 1000 / words )
topTerms           = counts over tokens.map(lower); sort by count DESC, then cmp(term) ASC; first 10
longestLine        = over RAW.split('\n') with ONE trailing '\r' stripped per line:
                     the FIRST line of maximal CP length → { index, length }
                     RAW === '' → { index: 0, length: 0 }
readingTimeSeconds = ceil(words * 3 / 10)      // exact integer arithmetic for 200 wpm
```

**Every value is an integer. No float ever reaches JSON.** `avgWordLengthMilli` is explicitly guarded at `words === 0` — without it, `0/0` yields `NaN`, which `JSON.stringify` silently renders as `null` (verified). `'Z'.localeCompare('a')` returns `1` while code-unit compare returns `-1` — opposite orderings on a differently-configured machine, which is why `localeCompare` is banned.

`resultSha256` = SHA-256 of the canonical JSON of `result`: keys sorted ascending by `cmp`, recursively, no whitespace, array order preserved.

### 5.3 Job states

```
queued ──▶ processing ──▶ awaiting_approval ──▶ approved
   ▲            │                              └▶ rejected
   └────────────┘  recovery: isOrphaned(job, epoch) && attempts < 3
                │
                └──▶ failed   recovery: isOrphaned(job, epoch) && attempts >= 3
```

`attempts` increments **at lease time** (`queued → processing`). **G-8 boundary, stated:** a killed job is re-queued and completes — up to **3 leases**. A job killed during a 3rd attempt becomes `failed` with the reason recorded. `failed` is reachable and testable by killing the same job three times.

`awaiting_approval` **never** self-advances. That is G-6.

### 5.4 Objects

**Job** (detail endpoint) — as v1, **plus `text`** (resolves F-4: T-3 asserts the text is intact and the UI must show it back).

**Summary** (list endpoint, no text): `{ key, state, textSha256, textLength, submittedAt, startedAt, completedAt, decidedAt, attempts, resultSha256 }`

**Health `counts`**: `{ queued, processing, awaiting_approval, approved, rejected, failed, total }`

**Result**: exactly the fields in §5.2, plus `version: 1` and `textSha256`.

### 5.5 HTTP contract

| Method | Path | Success | Failure |
|---|---|---|---|
| `POST` | `/api/jobs` `{key,text}` | `201 {job}` new · **`200 {job, duplicate:true, textMatches:bool}`** existing | `400` invalid key/text · **`413` text > 1 MiB (1048576 B)** · **`413` body > 2 MiB (2097152 B)** — two distinct limits, distinct messages |
| `GET` | `/api/jobs` | `200 {jobs:[summary]}` | — |
| `GET` | `/api/jobs/:key` | `200 {job}` | `404` |
| `POST` | `/api/jobs/:key/approve` `{note?}` | `200 {job}` | `404` · **`409`** not in `awaiting_approval` |
| `POST` | `/api/jobs/:key/reject` `{note?}` | `200 {job}` | `404` · `409` |
| `GET` | `/api/health` | `200 {ok,epoch,uptimeMs,counts}` | — |

**Two limits, not one** (resolves the v1 self-contradiction): v1 said text ≤ 1 MiB *and* body ≤ 1 MiB, which made a 1 MiB text unacceptable once JSON escaping was added. Body is counted **as bytes arrive**, not after buffering.

**`textMatches`** (resolves F-9): re-submitting a key with *different* text correctly returns the original job unchanged — that is G-9 — but it is a silent data-loss surface. The flag lets the UI say *"this key already exists; the text you just submitted was not stored."*

### 5.6 Journal replay

- A **trailing** partial line (torn by an abrupt kill) is discarded and logged. A single `writeSync` append is not guaranteed atomic.
- A **mid-file** corrupt line is data loss and **fails loud**. It is never silently skipped.
- Tested deterministically by synthesising a truncated journal on disk, not by hoping to catch a real tear.

### 5.7 Keys

Charset `[A-Za-z0-9._:-]+`, 1..128 chars. It admits `.` and `..`, and `:` is illegal in a Windows filename. **Keys are never used to construct a filesystem path** — the single-journal design means no key ever becomes one. Stated explicitly so a later change cannot quietly turn this into traversal.

---

## 6. Fog — resolved and remaining

| # | Status |
|---|---|
| F-1 kill abruptness | **RESOLVED by execution.** `process.kill(pid,'SIGKILL')` on win32 → `TerminateProcess`. No `exit`, `beforeExit` or signal handler runs, proven against a control where the same handler fires. Userspace-buffered stream data is destroyed outright. **T-3 is a real crash test.** |
| **F-1a trap** | The killed child reports **`code=1`, `signal=null`** on win32 — *not* `signal==='SIGKILL'`, not 137. A harness asserting the POSIX shape fails on this machine. |
| **F-1b trap** | **`SIGTERM` and `SIGINT` are equally abrupt** when delivered via `process.kill` from a parent, and `process.on('SIGKILL')` registers without throwing but never fires. There is **no signal-delivered graceful shutdown path on Windows** — so "graceful shutdown" code would be untestable decoration, and the runbook must say *stop is abrupt, and that is safe by design*. |
| F-2 fsync→platter | **Out of scope, permanently.** The claim is "fsync returned before ack", never "survives power loss". Recorded so nobody upgrades it later. |
| F-3 background visibility | **RESOLVED by measurement → C-4.** G-3 restated. No artificial delay. |
| **F-4 torn journal line** | **NEW, open until built.** §5.6 is the design; the test synthesises the tear. |

---

## 7. Security, permissions, ownership, recovery

- **`private_surface: none`.** Nothing touches `C:\.fusion247\**`. GL-012 not engaged.
- **Credentials: none. Network: loopback only** — explicit host argument.
- **`services/proofline/.gitignore` is build step 1**, before the store can create a file (C-2). Fusion247PKA is public; Warwick's text must never be committable.
- Static files served from an **allowlist of known filenames**, never by joining user input to a directory.
- Input limits per §5.5, counted as bytes arrive.
- **Recovery boundary:** recovery restores *jobs*, not decisions-in-flight. A decision is atomic — fsynced or it never happened.
- Larry owns route, sequencing, integration, git lifecycle. Keel executes. Warwick decides merge.

---

## 8. Acceptance evidence — EXECUTED, not asserted

| ID | Test | Proves |
|---|---|---|
| T-1 | Same key twice → one job, `200 duplicate:true`, **exactly one `job.created` in the journal bytes** | G-9 |
| T-2 | Same text under two keys → identical `resultSha256`; restart, reprocess → still identical; empty and whitespace-only text produce integers, never `null` | G-4 |
| **T-3a** | **Abruptness control:** an exit-handler marker that fires on graceful exit is asserted **absent** after the kill | the kill is a crash, not a stop |
| **T-3b** | Real spawn → submit → `SIGKILL` mid-`processing` → restart → re-queued → completes; `attempts` incremented; text intact | G-2b, G-8 |
| **T-3c** | **Mutation (NARROWED, Veritas D-2):** swap the store's `writeSync+fsyncSync` for a **corked** stream; kill; assert the record is **LOST**. Restore; assert it survives. The **uncorked** variant is kept as a reported measurement with **no loss assertion** — it retains the record, and asserting otherwise would assert libuv's flush timing | G-2c as narrowed — that a writer returning with bytes still in userspace loses an acknowledged record |
| **T-3d** | Injected `fs` façade records the call sequence; assert `fsyncSync` **returned before** the HTTP response was written | G-2a |
| T-4 | Approve → `SIGKILL` → restart → decision present and identical | G-7 |
| T-5 | Approve a `queued` job → `409`, job unchanged | G-6 |
| **T-6a** | **Mutation:** `isOrphaned` always **false** → job stuck in `processing` forever → test FAILS | recovery predicate is load-bearing |
| **T-6b** | **Mutation:** `isOrphaned` always **true** → live worker re-queues its own in-flight job and processes it twice → test FAILS | **the failure v1's T-6 could not catch**, and the one that actually breaks G-8 |
| T-7 | Journal prefix stability across further work | append-only is real |
| **T-8** | Synthesised truncated journal → clean recovery; synthesised **mid-file** corruption → **loud failure** | §5.6 |
| **T-9** | Static source assertion: no `http`/`https` client, `fetch`, `dns` or socket-connect in `src/`; bind asserted `127.0.0.1` | G-10, **labelled a limitation, not a proof** |

**Runner gate:** `node --test` from `services/proofline`. **Assert `# tests` ≥ expected AND `# fail 0`** — never the exit code alone, because zero tests returns exit 0 (verified §2).

---

## 9. Execution route — collapsed per Warwick, 2026-08-04

| Phase | Work package | Owner | Gate |
|---|---|---|---|
| 0 | Wayfinder map + Amendment 1 | Larry | **ACCEPTED by Warwick 2026-08-04** |
| 1 | **WP-1** — the whole service: store, worker, processor, recovery, idempotency, HTTP API, **clean usable UI**, tests T-1..T-9, launcher, runbook | **Keel** | T-1..T-9 green with counts asserted; executed output pasted |
| 2 | Integration at a single head | Larry (decision) / Keel (execution) | — |
| 3 | **Veritas** on the **exact integrated head** | Veritas | `VERITAS_PASS` required before any completion claim |
| 4 | Warwick's browser walkthrough + first live start | **Warwick** | H-2 |
| 5 | Merge decision | **Warwick** | `merge-decision` |

**Felix, Vex and Vera are NOT engaged** unless a specific acceptance failure demonstrates one is necessary (Warwick, 2026-08-04).

Before Veritas passes the integrated head, the maximum permitted statement is: «Integrated at "\<SHA\>" and submitted to Veritas for assurance.»

---

## 10. Human dependencies

| # | Dependency | Required at |
|---|---|---|
| ~~H-1~~ | ~~Warwick accepts the plan~~ | **DONE 2026-08-04** |
| H-2 | Warwick's browser walkthrough + first live start — his eyes on the real surface. **This is the only route by which G-11 is ever claimed** | Phase 4 |
| H-3 | Merge decision | Phase 5 |

He is not asked to run a git command, choose a git route, or understand a git concept at any point.

---

## 11. Phase status (update ONLY at a phase boundary: PASS / PARTIAL / FAILED + evidence)

| Phase | Status | Evidence | Date |
|---|---|---|---|
| 0 — Map + Amendment 1 | **PASS** — *without a Veritas receipt.* Veritas noted this and declined to escalate: the claim is true, evidenced by Warwick's own acceptance, asserts no capability, and no receipt was suppressed, because the route Warwick accepted places the single gate at Phase 3. **Whether a planning boundary needs a receipt is Warwick's to decide, not mine** | this document at `d3180118`; Keel read-back `REFUSE` (class-A) discharged by Amendment 1; Warwick's acceptance 2026-08-04 | 2026-08-04 |
| 1 — WP-1 | **PARTIAL** — built and integrated; **not** PASS. Veritas `HOLD` with 3 blocking findings. D-1 is a real code defect: `T-3d` failed **4 of 11** full-suite runs | commit `3a32525`, 27 files, 0 outside surface; Veritas receipt below | 2026-08-04 |
| 2 — Integration | **PARTIAL** — *corrected 2026-08-04, Veritas `D-12`.* **Larry recorded this as `PASS`, which he has no authority to do.** Root `CLAUDE.md`: *"PARTIAL and FAILED are Larry's to record without one; PASS is not."* Veritas's Integration **dimension** passing is not a Phase 2 verdict, and the head it named carries a HOLD. The underlying facts are true and independently verified — the label was not mine to award | integrated head `39a553cb600b7a79d8b4c1845b2bb19e31a2bc69`, tree clean, surface reconciled; corrective head `78c14c8` | 2026-08-04 |
| 3 — Veritas gate | **HOLD** — 3 blocking, 7 non-blocking. Goal fidelity, design fidelity, functional proof, integration and durability all PASS; test quality, git truth, documentation truth and residual risk HOLD | `Deliverables/2026-08-04-veritas-proofline-wp1-receipt.md`, `receipt_sha256: 745703891a077d6bda21ee57fcae3abc0b298f9708d454908db8b37a29744815`, against `39a553cb` | 2026-08-04 |
| 4a — Walkthrough, **first attempt** | **FAILED — and this record stands.** Warwick: *"The earlier launch failure and subsequent repair remain part of the evidence; the PASS does not erase them."* Warwick's real walkthrough **could not start the application**. Two independent defects, both shipped: **(a)** `RUNBOOK.md` opened with *"From PowerShell:"* and a `.ps1` path; from cmd.exe `.PS1` is absent from `PATHEXT` and has **no registered handler**, so Windows raised the "Select an app" picker and no server started. **(b)** Invoked correctly via `powershell.exe -NoProfile -ExecutionPolicy Bypass -File …`, the script **still failed to parse**: it is UTF-8 without a BOM, Windows PowerShell 5.1 decodes unmarked `.ps1` as ANSI, so the em-dash at line 96 became `â€"` — whose trailing character is a curly quote — and the parser reported *"The string is missing the terminator"*. **The launcher was never valid on his machine.** | Warwick's own report, 2026-08-04; root cause reproduced mechanically by Keel from cmd.exe (`PATHEXT` lacks `.PS1`; `assoc .ps1` → not found; `ftype` → no open command; port 7317 refused) | 2026-08-04 |
| **4b — Walkthrough, after repair** | **PASS — recorded on Warwick's own authority, 2026-08-04.** *"I have now completed the real Proofline walkthrough. The application opens, I can view and use it, and I PASS and approve the Proofline product phase."* **This is his pass, not mine** — Larry may not record a PASS without a receipt, and does not here. Stated honestly alongside it: the second Veritas pass returned **HOLD on documentation truth only**, discharged at `b4cba53`; all functional dimensions passed. **P-12 and P-13 remain open and are not erased by this pass** | Warwick's completed walkthrough; launcher repaired at `8d130eb`; functional journey proven live by Larry at `ca45802` | 2026-08-04 |
| 5 — Merge | NOT STARTED — and **not** the next step. Phase 2 lands first; Codex reviews the complete integrated change | — | — |

### 🏁 PHASE 1 — PROOFLINE — CLOSED

**Warwick PASSED and approved the Proofline product phase on 2026-08-04.** What that pass does and does not cover, stated exactly:

- **It covers** the product journey he performed himself: the app opens, he can view and use it, he approves it.
- **It does not erase** the launch failure (4a) or the repair. Both stay in the evidence at his explicit instruction.
- **It does not resolve** P-12 (approval notes are durably stored but unreadable through the API) or P-13 (the rendered page was never proven under automation — his walkthrough is what closed that gap, and only for him).
- **It is not a Veritas PASS.** The gate's last verdict on this scope was HOLD on documentation truth; those three cells were corrected at `b4cba53` and no third pass was authorised.

### Veritas HOLD — disposition of the three blocking findings

Discharged **inside `WO-2026-08-04-01`**. A finding is an observation, not an instruction; none of these creates a new Work Order.

| ID | Finding | Owner | Disposition |
|---|---|---|---|
| **D-1** | Suite flaky at this head. `test/ordering.test.js:92` asserts the *exact* prefix of the event trace; under full-suite load the worker's 100 ms scan lands at index 0 and the assertion fails. `:136` shares the pattern. The narrow G-2a claim (`fsyncSync.return` before the response) held in **every** run — it is the stricter "nothing else happened first" form that races | Keel | **DONE at `78c14c8`.** Reproduced worse than measured first — **8 failures in 15 runs** at the unmodified head. Root cause: `events` is a shared trace bus and the worker's 100 ms heartbeat writes to it. **The strict assertion was NOT weakened — it is byte-identical.** The noise was removed at source (60 s scan interval for those tests) and a new `assertQuiesced` makes the quiescing *checked* rather than assumed. **Stability: 55 consecutive full-suite runs, 0 failures** (30 after fix, 15 after mutation restore, 10 post-commit), read from `# tests`/`# pass`/`# fail`, never the exit code |
| **D-2** | Map §1 G-2c and §8 T-3c stated an acceptance test the evidence disproves | **Larry** | **DONE** — both narrowed to the corked variant above |
| **D-3** | Map §12 still directed a fresh session to "Keel implements WP-1" | **Larry** | **DONE** — §11 and §12 corrected |
| D-4 | `RUNBOOK.md` claims the service will *"never contact anything outside your machine"*, while `README.md` correctly lists zero-egress as **not** claimed. The runbook is the document Warwick operates from | Keel | **DONE at `78c14c8`.** Bullet removed from "will never do"; the residual now sits under "Limits, stated plainly" with **"zero egress is NOT claimed"** stated first, the source-level assertion described as what it is, and the missing packet capture named. Whole runbook swept — that was the only instance |

| D-8 | The runner gate is an instruction, not a mechanism — `"test": "node --test"` is the exit-code route the map itself calls a vacuous green | — | **Parked. Veritas explicitly does not recommend building one**, and neither do I. Regrowth cap |
| **D-12** | **Larry recorded Phase 2 as `PASS` without a receipt** — a status label written without the authority to write it, two rows above the HOLD it contradicts | **Larry** | **DONE** — Phase 2 corrected to `PARTIAL` above |
| **D-13** | The disposition table was broken by a paragraph inserted mid-table, so the parked `D-8` row rendered as literal pipe text and was invisible | **Larry** | **DONE** — paragraph moved below the table |
| D-7 | `WO-2026-08-04-01` envelope still read `status: ISSUED` after the work was delivered | **Larry** | **DONE** — envelope corrected |

**Proof that the strict assertion is load-bearing, not decoration (`M-A`).** Keel mutated *production* source — moving `worker.nudge()` before `send()` in `src/server.mjs` — and the narrow claim **still held**: `fsyncSync.return` still preceded `http.response`. Only the strict "nothing else happened first" assertion caught it. Had it been quietly downgraded to the narrow form to stop the flake, that regression would now pass silently. **Veritas re-ran this mutation itself and confirmed it**, and additionally ran a mutation Keel did not — dropping the quiet scan interval to 5 ms — to prove `assertQuiesced` is not vacuous. All mutations restored and verified byte-exact.

**Independent stability measurement (Veritas, at `e4a4f645`):** 40 sequential runs + 20 at 4× concurrency + 15 in a byte-exact export = **75 runs, 0 failures**. At the pre-fix head it measured **15 failures in 15 runs** — worse than the 8-in-15 recorded above, so this map *under*-states the original flake rather than overstating it. The flake is gone, not moved.

---

## 12. Current frontier and the exact next action

**Frontier:** Phase 3, on a Veritas `HOLD`. **WP-1 is built and integrated at `39a553cb` — do NOT re-implement it.** Work Order `Deliverables/proofline/WO-2026-08-04-01-proofline-service-core.md` remains open for the HOLD disposition above; it is not reissued.

**Exact next action:** **Warwick re-attempts the walkthrough** using the one command below. That is the only outstanding step, and it is his.

```
C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd
```

Then `http://127.0.0.1:7317/`. Works from cmd.exe and PowerShell, pasted identically, from any directory.

**Launcher defect discharged at `8d130eb`** — a `.cmd` that invokes `node` directly (no PowerShell, no execution policy, no file association, no encoding hazard), both original failures reproduced as controls first, and both launcher files asserted pure ASCII by byte scan rather than by eye. **Functional journey proven live at that head by Larry through the one-liner:** submit → `queued` with `result: null` → `awaiting_approval` with a result digest → duplicate key with different text returns `200 duplicate:true textMatches:false` with the stored text unchanged → approve → `approved`, all four durable transitions recorded, 5 journal records on disk.

**Still unproven and still his: the rendered page** (P-13). Earlier HOLD findings D-1..D-4 were discharged at `78c14c8` and re-reviewed; the second Veritas pass returned HOLD only on documentation truth, and those three cells were corrected at `b4cba53`.

**Phase 1 is CLOSED — Warwick passed it 2026-08-04.** The frontier has moved. **Go to §13.**

**Resumable state:** branch `build-020/live-trial`, worktree `C:\Fusion247PKA-build-020-trial`. Verify HEAD by execution before trusting any SHA here — this map got that wrong three times.

---

# 13. PHASE 2 — Honcho and Tower as durable shared myPKA infrastructure

**Set by Warwick, 2026-08-04, at the rotation boundary. The fresh session owns implementation. Nothing here has been started.**

## 13.1 North Star — his words

> **Honcho and Tower become durable shared myPKA infrastructure rather than branch-local or worktree-local experiments.**
>
> *"I need Honcho to orient a fresh Larry to the correct active Wayfinder and frontier across branches and worktrees, without stale instructions and without me reconstructing the build."*
>
> *"I need exactly one current Tower runtime that remains online, survives restart, cannot be replaced by a legacy watcher, does not flash terminal windows, and is available for the later Codex merge review."*
>
> *"These changes must have a clear route into main and a stable machine-level installation. They must not be left marooned on this trial branch or dependent on this particular worktree."*

## 13.2 Acceptance — **executed reality**, by the revised Veritas contract Warwick is reviewing externally

| # | Property | The bar |
|---|---|---|
| **N-1** | Tower remains durably online **and only the current watcher can start** | Not "we removed the old one" — a legacy watcher must be *unable* to take over. Prove by attempting it. |
| **N-2** | Honcho gives a fresh Larry **the correct current Wayfinder and frontier** | Not a packet that exists — a packet that names *this map* and the *live* frontier. |
| **N-3** | It works **from a different worktree** and **survives restart** | Both, separately, by execution. |
| **N-4** | Operational state and landing route are **durable outside Larry's context** | If it only lives in a session, it does not exist. |

**Then:** Codex reviews the complete integrated change for merge. **After merge**, Warwick starts a fresh Larry and tests whether he can orient and carry on. **That test is the real acceptance**, and it is his.

## 13.3 Verified reconnaissance — executed 2026-08-04, and already stale

**This is a snapshot, not the present. Re-verify every line before acting on it** — and read the instrument warning in the rotation block first, because the first attempt at this reconnaissance produced a confidently wrong answer.

### Tower — there are THREE watchers, not two

| Name | Path | State 2026-08-04 |
|---|---|---|
| **tower-loop** — the GitHub-driven turn loop | `C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs` (launcher `run-watcher.mjs`) | **CURRENT. Running, PID 31268**, from the **main** worktree |
| **tower-baton** — BUILD-010, ClickUp-driven | `C:\Fusion247PKA\services\tower-baton\bin\tower-watch.js` | **LEGACY, dormant.** Stale lock `C:\.fusion247\tower-baton.lock` names dead PID 39920. **Not formally retired** — the migration plan puts retirement explicitly out of scope |
| **FusionTowerWatchdog** | `C:\Fusion247PKA\services\fusion-tower\src\watchdog.js` | Different subsystem. `Register-ScheduledTask` block is **commented out**; header says ANNOUNCE-DON'T-LAUNCH. Never registered |

Evidence: `Deliverables/2026-08-02-tower-watcher-github-sqlite-migration-plan.md` (line 69 names the two Tower implementations; line 24 parks retirement); `run-watcher.mjs:3` — *"Starts the CORRECT watcher (NOT the BUILD-010 tower-baton)"*.

**⚠️ That migration plan is stale on facts** — it asserts two watchers running simultaneously at PIDs that no longer exist. Treat it as a decision record, not a state record.

### 🔥 The terminal-flash cause, and the legacy-takeover cause, are the SAME thing

A **Startup-folder shortcut** — invisible to `tasklist`, `schtasks` and `sc query`:

`C:\Users\Buggly\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\mypka-tower-cp-watcher.vbs:4`
→ runs `C:\.fusion247\run-tower-cp-watcher.ps1` hidden, which:

1. **Kills any running tower-loop watcher** (line 23 — a `Stop-Process` over every `node.exe` whose command line matches `*tower-loop*watcher.mjs*`), then
2. **starts a stale one from `C:\Fusion247PKA-tower`** (line 7) — a worktree on `build-014/tower-recovery` (`3c08e45`) where the console-hiding fix **`a100dbf` is not an ancestor** and the fixed files do not exist.

The stale copy's `spawn` calls carry no `windowsHide`, and `git`/`gh` are console applications — so a bare spawn from a windowless parent **creates a visible console window**.

**This single file is simultaneously N-1's failure ("a legacy watcher replaces the current one") and the terminal-flash defect.** It is the highest-value target in the phase. Its log last wrote `Jul 24 08:25`, so **whether it currently succeeds at logon is NOT established** — establishing it needs a logon observed.

**Route-into-main facts:** `a100dbf` (*"stop gh/git flashing a console window over Warwick's screen every 30s"*) is an ancestor of both working heads but **NOT of `origin/main`**. Branch `fix/windows-hide-spawn` (`bf52920`, `c575853`) fixes 26 further sites and is **merged nowhere**.

### Honcho — a fresh Larry currently gets NOTHING here

- **Hosted remote service:** `https://api.honcho.dev/v3`, bearer auth. Credentials file `C:\.fusion247\honcho.env` **exists** (values not read, not reported). Workspace/session/peer: `larry-continuity`.
- **No SessionStart hook is registered for this worktree.** The only registration is `C:\Fusion247PKA\.claude\settings.local.json`, hardcoded to `node C:/Fusion247PKA/tools/governor/reorient.mjs`. **A fresh Larry opened anywhere but the main worktree receives nothing** — which is exactly N-2 and N-3.
- **The installed render is the wrong one.** `C:\Fusion247PKA\tools\governor\continuity.mjs` has **zero** occurrences of `packetContentHash`, `storedMapPath` or `CONTINUITY POINTER`. It still emits a block headed *"AUTHORITATIVE current focus"* closing *"This is the source of truth for what Warwick is doing"* — which **directly contradicts root `CLAUDE.md` precedence #9**, where the brief is *"a pointer with zero authority."* **A live governance contradiction, not a style problem.** The BUILD-020 pointer render exists **only in this trial worktree**, uninstalled.
- **No writer emits `map_path`.** `buildPacket` produces exactly eight fields — `focus, immediate_objective, warwick_last_request, accepted_decisions, completed, blockers, next_action, notes`. So even with the pointer render installed, `storedMapPath()` returns null. **N-2 needs a writer change, not just a hook.**
- **Last local state** `~/.mypka/governor/continuity.json`, updated `2026-08-04T06:42:01.586Z`: focus is **BUILD-015 AsdAIr**. It contains no occurrence of "proofline" or "BUILD-020". Last packet delivered `cont-1785846026092-143-rqjtww` at `2026-08-04T12:20:30.472Z`, seq 143.

### DevBot ding — the small configuration issue is real, and it is one line

- **Delivering path:** `services/control-plane/tower-loop/notify.mjs` — direct Telegram Bot API POST, driven by `watcher.mjs`. Outbox `tower.notification` in `C:\Users\Buggly\.mypka\tower\tower.db`.
- **Last successful delivery: `2026-08-02T23:37:56.301Z`, Telegram `message_id 457`, ok.** Three rows total, all succeeded, **zero failures, zero dead-letter.**
- **🎯 `TOWER_NOTIFY_TRANSPORT=none` at `C:\.fusion247\tower-baton.env:8`.** `notify.mjs` then records the row and sends nothing; `run-watcher.mjs` treats it as a deliberate no-Telegram run and **starts anyway with notifications disabled** — i.e. a watcher launched from that env file runs with its failures invisible. Token and chat-id in that file are non-empty.
- **Do NOT use `services/control-plane/notifier/`.** Its real transport is a stub that throws by construction (`transport.mjs:76-82`); it has never delivered anything. `mypka.db` at the repo root has **no outbox** — it is the PKM store.
- The Larry→Warwick ding primitive is outside the repo: `C:\.fusion247\larry-ding.mjs` (FusionDevBot), needing `TELEGRAM_BOT_TOKEN` + `AUTHORISED_TELEGRAM_USER_ID` from `fusion-capture-gateway.env`.

**Warwick's boundary, binding:** restore the ding *"where that is genuinely a small configuration issue, but it must not expand this into another sprawling infrastructure programme."* **If it stops being a config change, STOP and report.**

### Codex — for the later merge review

- **`reviewDiff.mjs` needs NO PR.** It reviews any local `base..head` in any repo dir; `--claim` takes a JSON file, fail-closed on `summary`, `brief_excerpt`, `checkpoint_id`, `build_id`, `brief_ref`. Dependencies present on disk: `codex.exe 0.146.0-alpha.3.1` (discovered outside `PATH`, at `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\`), `~/.codex/auth.json` (OAuth, `last_refresh 2026-08-01`), and the QA skill file. **Token validity and network are NOT established without a real run.**
- **`mergeCheck.mjs` is NOT ready.** It requires a PR number *and* a Postgres table `tower.merge_check_run` **which does not exist in the live SQLite store**. It is also the only route that pings TowerBot.
- The watcher's PR poll requires an explicit `@tower checkpoint:` marker. It ran ~21 hours across 2026-08-03/04 returning `refused_no_head_directive` on every candidate — **zero turns, zero reviews, zero notifications.**
- **Last Codex run of any kind: 2026-08-02.** Everything on 2026-08-04 was Veritas, which is internal and is not Codex.

## 13.3a Re-verified reconnaissance — SECOND execution, 2026-08-04, fresh session

**§13.3 warned it was already stale. It was.** Every line below is executed output from this session, with `MSYS_NO_PATHCONV=1` set as the instrument warning requires. Contradictions are recorded here, not silently overwritten.

| # | §13.3 / rotation-block claim | Executed reality | Effect on the route |
|---|---|---|---|
| **R-1** | Head `ca45802` | **`25825b1a65341760cb2d85493ab49827820c8fdc`**, tree clean. Two commits further on | None. The map warned its own SHAs are untrustworthy; they were |
| **R-2** | **"Upstream NONE CONFIGURED, 51 ahead"** | **WRONG. Upstream is `origin/build-020/live-trial`; 54 ahead of `origin/main`; PR #94 is ALREADY OPEN as a DRAFT**, titled *"BUILD-020: Proofline (Warwick PASSED) + Phase 2 route"* | **§13.4 step 1 is already done.** The route starts at step 2, not step 1 |
| **R-3** | "The only registration is hardcoded to `reorient.mjs`" | **UNDERSTATED. FOUR machine-level entries in `C:\Fusion247PKA\.claude\settings.local.json`, every one hardcoded to `C:/Fusion247PKA/`:** two `SessionStart` hooks (`ensure-capture-gateway.mjs`, then `reorient.mjs`), one `PreToolUse` hook (`worktree-guard.mjs`), and the `statusLine` (`statusline-live.mjs`) | **The install surface for N-3/N-4 is four entries, not one.** Materially widens WP-2B |
| **R-4** | Startup VBS is the live legacy-takeover risk | **CONFIRMED verbatim — and it is ARMED BUT DORMANT, which is worse than the map implies.** The machine has **not rebooted since 2026-07-21 23:21:22**. Watcher PID 31268 started **2026-08-04 00:47:36** — not at logon. The VBS log last wrote **2026-07-24**. **So the takeover has never yet fired against the current watcher, and it is scheduled to fire at the next logon** | **Raises N-1's priority.** The failure is pending, not past. It also means N-3's "survives restart" is currently **unproven in the strongest possible sense — nothing has been restarted** |
| **R-5** | *(not in the map)* | The VBS launcher's own watcher **died on 2026-07-24 and could not report it**: last two log lines are `watcher_crash` *"Connection terminated unexpectedly"* then `crash_notify_failed` *"getaddrinfo ENOENT db.iiqstxfqjbrbyplwwsql.supabase.co"* | Evidence that the legacy path fails silently. Strengthens N-1 |
| **R-6** | "`TOWER_NOTIFY_TRANSPORT=none` at `tower-baton.env:8`" | **CONFIRMED at exactly line 8 — but `run-tower-cp-watcher.ps1` explicitly `Remove-Item Env:TOWER_NOTIFY_TRANSPORT`.** The Startup path *clears* it. The `none` bites only routes that load that env file wholesale | Narrows the ding fix. Still one line, still config-only |
| **R-7** | Honcho: installed render is wrong; no writer emits `map_path` | **BOTH CONFIRMED.** Installed `continuity.mjs` (main): **0** occurrences of `packetContentHash`/`storedMapPath`/`CONTINUITY POINTER`. This worktree: **9**. `buildPacket` (`continuity.mjs:162`) emits **exactly 8 fields** — no `map_path` — while the pointer render at `:263` reads `p.map_path`, which is therefore **always null** | **N-2 needs the writer changed FIRST, then installed.** Installing the render alone yields a pointer pointing at nothing |
| **R-8** | continuity.json focus is BUILD-015 | **CONFIRMED byte-for-byte, and unchanged** — `updated_at` still `2026-08-04T06:42:01.586Z`, still zero occurrences of "proofline" or "BUILD-020". Its `next_action` still directs a fresh Larry into BUILD-015 Gate 3 | The misdirection risk in the rotation block is **live and current** |
| **R-9** | *(not in the map)* | Sibling worktree **`C:\Fusion247PKA-external-repair` sits at the SAME head `25825b1`** on branch `build-020/veritas-focus-redline` | Noted so a later reader does not treat it as divergent work |

**Unchanged and re-confirmed:** `a100dbf` is **not** an ancestor of `origin/main`; `fix/windows-hide-spawn` (`bf52920`) is contained in **no** branch but its own — it is **PR #92, still open**; `C:\Fusion247PKA-tower` is on `build-014/tower-recovery` at `3c08e45`; the current watcher (PID 31268) runs from the **main** worktree; **no** SessionStart hook is registered for this worktree.

---

# 14. PHASE 2 ROUTE — **ACCEPTED AND AMENDED by Warwick, 2026-08-05**

**Status: the `product-decision` handback is DISCHARGED.** Warwick accepted the route and amended it materially. §14.0 records what he decided; the work packages below are revised against it. Written from R-1..R-9, not from §13.3.

## 14.0 Warwick's Phase 2 decision — 2026-08-05

**His scope, in his terms:** *"make Honcho, Tower, the watcher and the DevBot ding shared, dependable myPKA services rather than things tied to a build, worktree or Larry remembering how to start them."*

**His North Star, superseding §13.1 by widening it:** *"wherever Larry starts and whichever build or PR is active, he is accurately oriented by Honcho to the current Wayfinder, Tower is available, Codex can be called, and the real QA conversation is visible to me."*

**Five directions that change the route:**

| # | Direction | Effect |
|---|---|---|
| **W-1** | *"Honcho should support the Wayfinder rather than compete with it. A fresh Larry must receive current orientation automatically and must never be confidently sent back to stale work."* | Confirms WP-2B and names the failure mode precisely — the danger is a **confident wrong** orientation, not a blank one. Matches the rotation block's own warning |
| **W-2** | *"Verify the legacy Tower is genuinely obsolete, then remove it so it cannot restart or confuse the current runtime."* | **SCOPE CHANGE. §13.5 parked legacy retirement OUT of scope** (*"Retiring `tower-baton` is not the goal"*). Warwick has now explicitly authorised removal. §13.5 is amended by §14.0a below. **Verification comes first — removal is conditional on obsolescence being established, not assumed** |
| **W-3** | *"The current Tower and watcher should be the single shared route and remain available while this laptop stays running. **I do not require reboot or power-cut testing; record that accepted boundary.**"* | **BOUNDARY ACCEPTED — and it MOVES the verdict, it is not a caveat.** See §14.0b. **H-4 is WITHDRAWN** |
| **W-4** | *"TowerBot to show the actual Codex findings and Larry's actual response to how he is handling them, as a genuine ongoing QA exchange rather than a mirror or one-way notification. That exchange must have one clearly identified durable source of truth."* | **NEW WORK PACKAGE — WP-2E.** This is the largest addition and the least specified by prior reconnaissance. Both halves of the exchange must be durable, and exactly one store must be named as canonical |
| **W-5** | *"Resolve that split using the quickest, least-token route that leaves one canonical working system. My preference was Supabase, but SQLite appears the better answer for this machine and current architecture unless your live evidence shows otherwise."* | **NEW WORK PACKAGE — WP-2F.** He has stated a preference **and** subordinated it to live evidence. The decision is mine, and it must rest on executed evidence, not on reading |

**Also:** *"The DevBot ding has reached me; make sure it is genuinely event-driven and durable rather than manually triggered in this session."* — sharpens WP-2C. The ding that reached him on 2026-08-04 (`message_id 318`) was **triggered by Larry in-session**, which is exactly what he is ruling out. Config-only remains the boundary; if it stops being config, STOP and report.

**And:** *"Own the route and ordinary technical decisions. Build the product, not another shiny monkey-house floor."* — Decisions A and B (§14.2) revert to me. The regrowth cap is restated in his own words.

### 14.0a Amendment to §13.5 — what is no longer out of scope

**§13.5 still binds in full, EXCEPT:** *"Retiring `tower-baton` is not the goal — it is parked out of scope in the migration plan. Touch it only if it is the minimal way to satisfy N-1."* **That line is SUPERSEDED by W-2.** Removal of the legacy Tower is now an explicit, authorised outcome, conditional on verified obsolescence.

**Everything else in §13.5 stands unchanged** — no new watcher, no new registry, validator, store, control plane, governance wrapper or enforcement counter, no second map, no new BUILD number. W-5 resolves a store split by **removing one of two existing stores**; that is consolidation, not growth, and it is the only store work permitted.

### 14.0b The accepted durability boundary — stated so it cannot be quietly upgraded

**Warwick does not require reboot or power-cut testing.** The recorded bar is: **the current Tower and watcher remain available while this laptop stays running.**

**What this changes, honestly:**

- **N-3's "survives restart" half is WITHDRAWN as an acceptance criterion.** It is not deferred, not caveated, not "proven under a limitation" — it is **not claimed at all**. A recorded limit that leaves the original claim standing is not a discharged limit.
- **H-4 (a real logon) is WITHDRAWN.** It existed only to prove restart survival.
- **No document may state or imply that Tower survives a restart, a logon, or a power cut.** If a runbook, README or receipt says so, that is a defect to fix, not a nuance to explain.
- **This does NOT weaken W-2.** "A legacy watcher cannot return" is still proven **by attempt** — running the legacy start path against the live current runtime and asserting the current one survives. That proof needs no reboot, which is precisely why it survives this boundary.
- **The residual risk is named, not hidden:** if this laptop reboots, nothing in Phase 2 guarantees Tower comes back. That is an accepted operating cost of Warwick's decision, recorded here once.

### 14.0c Phase 2 success gate — for revised Veritas

**Warwick's words, as the gate:** *"another fresh Larry/worktree is oriented correctly, legacy Tower cannot return, current Tower works across builds and PRs, the real Codex/Larry dialogue appears on TowerBot, and none of it depends on this Larry's context."*

Veritas assesses the **exact integrated head** against these five, each of which must be proven by execution in the real intended context — not by component pass:

| Gate | The proof that counts | Not sufficient |
|---|---|---|
| **S-1** | A **fresh Larry, started in a DIFFERENT worktree**, is oriented to *this* map and the *live* frontier — automatically, with no path typed by Warwick | A packet that exists; a correct render in this worktree only |
| **S-2** | **Legacy Tower cannot return** — proven by *attempting* every enumerated start path against the live current runtime | "We deleted it"; an absence check |
| **S-3** | **Current Tower works across builds and PRs** — exercised against more than one build/PR context | Working for BUILD-020 only |
| **S-4** | **The real Codex/Larry dialogue appears on TowerBot** — actual finding content and actual disposition, followable by Warwick, from ONE named durable source | A notification that a review ran; a mirror; a one-way post |
| **S-5** | **None of it depends on this Larry's context** — it survives this session ending | Anything a running session holds |

**The mandatory Veritas question applies as always:** *«Can Warwick now do the thing this phase promised, in the real intended context?»* **Scope of the verdict is bounded by §14.0b** — restart durability is outside the claim and must not be assessed as a failure or recorded as a pass.

**Warwick's own post-merge fresh-Larry test (§13.2) remains the real acceptance and cannot be self-certified.**

**The organising finding:** three of the four acceptance properties fail for the *same* reason — **every durable install point hardcodes a worktree path**, and the one automated install point (the Startup VBS) points at a stale worktree and actively kills the current runtime. Fixing files inside this worktree satisfies none of them. That is why the route is ordered install-point-first.

## 14.1 Work packages

| WP | Outcome | Satisfies | Owner |
|---|---|---|---|
| **WP-2A** | **The legacy takeover is removed, and proven unable to recur.** `C:\.fusion247\run-tower-cp-watcher.ps1` no longer kills the running watcher and no longer starts from the stale `C:\Fusion247PKA-tower`. Proof is **by attempt**: run the legacy launcher against a live current watcher and assert the current one survives, no second appears, and no console window is created | **N-1** (both halves — legacy takeover *and* terminal flash are the same file) | Keel |
| **WP-2B** | **A fresh Larry in ANY worktree is oriented to the correct current map and frontier.** Three ordered changes: (1) `buildPacket` emits `map_path` + frontier — without it the pointer render is null by construction (R-7); (2) the pointer render replaces the installed one, which currently claims *"source of truth"* against `CLAUDE.md` #9; (3) registration moves to a **worktree-independent** install point so it applies outside `C:\Fusion247PKA` | **N-2, N-3, N-4** | Keel |
| **WP-2C** | **The DevBot ding delivers again.** Configuration only, per Warwick's binding boundary. **If it stops being a config change, STOP and report** | — | Keel |
| **WP-2D** | **The change lands.** PR #94 taken out of draft, Codex reviews the complete integrated change, Warwick decides the merge | **N-4, S-5** | Larry (decision) / Keel (execution) |
| **WP-2E** | **TowerBot carries the real QA exchange (W-4).** Actual Codex finding content and Larry's actual disposition of each, followable by Warwick on Telegram, backed by **one named durable source of truth**. Not a mirror, not a one-way notification | **S-4** | Keel |
| **WP-2F** | **One canonical store (W-5).** The live-Tower/merge-check split resolved by *removing* one of two existing stores, by the quickest least-token route. Consolidation only — no third store | **S-3** | Keel |

**WP-2E and WP-2F are shaped by evidence still in flight** (three read-only investigations dispatched 2026-08-05: the store split, legacy obsolescence, and the QA-exchange path). **Their designs are not settled here and must not be guessed** — this table states the outcome each owes, not its method.

## 14.2 Decisions A and B — **resolved by Larry**, per Warwick's *"own the route and ordinary technical decisions"*

**Decision A — where the durable Tower runtime lives: A3, minimally.** Warwick's scope sentence decides it — *"shared, dependable myPKA services rather than things tied to a build, worktree or Larry remembering how to start them."* **A1 (repoint the stale worktree) is ruled out by that sentence**, because it leaves the runtime worktree-tied and free to go stale again exactly as it did. A2 was already ruled out by the launcher's own design note. So the runtime moves to a **machine-level location outside any worktree**.

**The regrowth-cap discipline on A3:** the danger is that "deploy step" grows into a pipeline. It must be a **documented copy with a recorded source SHA** — no scheduler, no watcher-of-the-watcher, no registry. If it starts to need one, that is the signal to stop and report, not to build it.

**Decision B — PR #92 `fix/windows-hide-spawn`: merge it into this change.** Same defect class as the terminal flash; already a reviewed PR; and leaving it open is precisely how `a100dbf` ended up absent from `main`. Carrying a partial fix would leave 26 known sites unfixed and a second PR open indefinitely.

## 14.3 What this route deliberately does NOT build

Per §13.5 and the regrowth cap: **no new watcher, no registry, no validator, no store, no control plane, no enforcement counter, no second map, no new BUILD number.** N-1's "a legacy watcher must be *unable* to start" is satisfied by **removing the takeover capability**, not by building a guard that polices it. If any WP starts to grow a mechanism, that is the signal the diagnosis was wrong.

## 14.4 Human dependencies

| # | Dependency | Status |
|---|---|---|
| ~~**H-4**~~ | ~~A real logon (or reboot) performed by Warwick~~ | **WITHDRAWN 2026-08-05 by W-3.** It existed only to prove restart survival, which is no longer claimed (§14.0b). **Removing it removes the claim, not just the test** |
| **H-5** | **Warwick's post-merge fresh-Larry orientation test** (§13.2) — starting a fresh Larry and seeing whether it orients and carries on | **The real acceptance. Cannot be self-certified.** S-1 is the internal proof; this is his |
| H-3 | Merge decision | Stands |

H-2 is discharged (Phase 1 walkthrough, PASSED).

## 14.5 Sequence

**WP-2F (one canonical store) comes FIRST** — WP-2E's durable source of truth cannot be named while two stores are in contention, and WP-2A's runtime move touches the same connection configuration. Sequencing it last would mean building WP-2E twice.

**WP-2F → WP-2A (legacy verified obsolete, then removed, then attempt-proof) → WP-2B (writer, then render, then worktree-independent install) → WP-2E (the QA exchange) → WP-2C (ding made event-driven) → WP-2D (Codex, then `merge-decision`).**

WP-2B(1) — the `map_path` writer — is independent of everything else and can start in parallel immediately. **WP-2A's removal step is gated on its verification step**; if obsolescence is not established, removal does not proceed and Warwick is told why.

## 14.6 Evidence still owed before implementation begins

Three read-only investigations were dispatched 2026-08-05 and **must land before WP-2A, WP-2E or WP-2F is issued as a Work Order**:

| Investigation | Decides |
|---|---|
| The Tower store split — live reads/writes, SQLite contents, whether the Supabase host is reachable at all, every call site | **WP-2F's direction.** Warwick prefers Supabase; the DNS failure logged 2026-07-24 is evidence against it, and evidence decides |
| Legacy Tower obsolescence — is it running, **every** path by which it could start, what still consumes it, what would break | **Whether WP-2A's removal is authorised at all**, and what "cannot return" must cover |
| The QA-exchange path — where Codex findings live, where Larry's disposition lives (if anywhere), whether any inbound path exists | **WP-2E's design**, and which store is nominated canonical |

**Also owed and NOT yet verified:** Warwick states Proofline remained available on port 7317 across a complete Claude Code session restart. **That is being verified independently before it is recorded** as a phase fact — it is a durability claim, and this build does not record durability claims it has not executed.

## 13.4 Landing route — how this reaches main and stops being worktree-local

1. ~~**`build-020/live-trial` has NO upstream and is 51 commits ahead of `origin/main`.** Push and open the PR **early** — recorded is not visible.~~ **SUPERSEDED by R-2, 2026-08-04: already done.** Upstream is `origin/build-020/live-trial`, 54 ahead, and **PR #94 is open as a DRAFT**. The remaining work is taking it out of draft at the right moment — see WP-2D.
2. **Codex reviews the complete integrated change** via the PR head. Budget: max three executions per gate.
3. **Warwick decides the merge** (`merge-decision`).
4. **The machine-level install is the part most likely to be left marooned.** Both live install points hardcode absolute worktree paths — the SessionStart hook (`C:/Fusion247PKA/...`) and the Startup VBS (`C:\Fusion247PKA-tower\...`). **A fix that only edits files inside this worktree changes nothing about either.** N-3 and N-4 are lost by default unless the install point itself is addressed.

## 13.5 Explicitly OUT of scope — the regrowth cap

**If the response to any requirement here is to build a mechanism, the diagnosis was rejected.** BUILD-018 grew a validator → store → parser → registry around rules it never enforced.

- **No new watcher.** One current implementation exists; the work is making it the *only* one that can start.
- **No new registry, validator, store, control plane, governance wrapper or enforcement counter.**
- **No second map, no new BUILD number** (Warwick, explicit).
- **Retiring `tower-baton` is not the goal** — it is parked out of scope in the migration plan. Touch it only if it is the minimal way to satisfy N-1.
- **DevBot is configuration only.** See the boundary above.

## 13.6 First safe continuation — for the fresh session

**Do not implement. Route first.** The Wayfinder mandate applies to this phase as it did to Proofline: no map, no build.

1. **Orient**: state the four things, then open this file.
2. **`export MSYS_NO_PATHCONV=1`** before any live check. Then verify by execution, contradicting this map wherever reality disagrees:
   - `git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD`, `git status --porcelain`
   - `MSYS_NO_PATHCONV=1 tasklist /FI "IMAGENAME eq node.exe" /FO CSV` — is a tower-loop watcher alive, and **from which worktree**?
   - Does the Startup VBS still exist and still point at `C:\Fusion247PKA-tower`?
   - Is a SessionStart hook registered for the worktree you are actually in?
3. **Record contradictions in this file** rather than overwriting one source.
4. **Then extend this map** with the Phase 2 route, and get Warwick's acceptance before implementing (`product-decision`).

**✅ STEPS 1–4 DONE, 2026-08-04 (fresh session).** Reconnaissance re-executed and its nine contradictions recorded in **§13.3a**; the Phase 2 route is written in **§14** and is **awaiting Warwick's acceptance**. **The frontier is now §14, not §13.6.** Nothing has been implemented.

**Human dependencies for Phase 2:** Warwick's acceptance of the Phase 2 route · his merge decision · **his fresh-Larry orientation test after merge, which is the real acceptance and cannot be self-certified.**
