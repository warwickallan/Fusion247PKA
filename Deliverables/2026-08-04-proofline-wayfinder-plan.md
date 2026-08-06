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
| **Frontier** | ⛔ **DO NOT READ A FRONTIER FROM THIS BLOCK. → §14.19 is the SINGLE statement of the live frontier.** *(This row said "Phase 2 … Not started" and was a THIRD competing frontier statement — the same defect §12 was corrected for, in the block §12's own diagnosis named. Corrected 2026-08-05, Veritas rotation-readiness HOLD.)* |
| **First safe action** | **→ §14.19.** *(This row pointed at §13, which lands on "awaiting Warwick's acceptance … nothing has been implemented" — false since 2026-08-05.)* |

### ✅ RESUMPTION — CORRECTED 2026-08-05. **Automatic reorientation NOW HAPPENS.**

**All three warnings below were true when written and are FALSE NOW. Retained struck-through, because the reasoning is the durable part and the correction is the evidence that Phase 2 delivered.**

1. ~~**No SessionStart hook is registered for this worktree**~~ — **FIXED at `eff3033`.** A **user-level** `SessionStart` hook is registered at `~/.claude/settings.json` running `C:/Users/Buggly/.mypka/governor/reorient.mjs`. **It fires in EVERY directory, verified by real sessions.**
2. ~~**a brief naming BUILD-015 AsdAIr**~~ — **FIXED at `eff3033`.** The stored focus now reads *"BUILD-020 Phase 2 — Honcho and Tower…"* and the brief names **this map**. Verified in a live session, not asserted.
3. **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` still declares itself the sole route** — **UNCHANGED and still true.** It is authoritative for **BUILD-015 only** and **NON-DIRECTIVE here.**

**The residual risk is now #3 alone: a confident wrong orientation from the BUILD-015 map, not a blank one.** The brief itself is correct and carries zero authority by design.

**Precedence for BUILD-020, until N-2 lands:**

| Rank | Source | Authority |
|---|---|---|
| 1 | **This file** | **THE BUILD-020 route. The only document that may state the exact next action for BUILD-020.** |
| 2 | `Deliverables/proofline/WO-2026-08-04-01-*.md` and the two `*-veritas-proofline-*receipt.md` | Evidence and contracts. **Never a route.** |
| 3 | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` | **Authoritative for BUILD-015 ONLY. NON-DIRECTIVE here.** Do not take its next action as yours. |
| 4 | `Builds/` | **No `BUILD-020-*` record exists** (P-5). Its absence is a recorded fact, not a missing file to go and find. |
| 5 | The Honcho continuity brief | **Pointer with zero authority** (root `CLAUDE.md` #9) — and currently **stale and wrong for BUILD-020**. Verify against this file; never the reverse. |

~~**Until Phase 2 fixes it, a fresh session is reached by naming this path**~~ — **NO LONGER REQUIRED (2026-08-05, `eff3033`).** A fresh Larry in any worktree is reached **automatically**. Naming the path still works and is harmless: `Deliverables/2026-08-04-proofline-wayfinder-plan.md`

### 🚨 The instrument warning — read before ANY live-state check

**In Git Bash on this machine, MSYS silently mangles `/FLAG` arguments into Windows paths.** `tasklist /FI "IMAGENAME eq node.exe"` became `C:/Program Files/Git/FI` and errored; I read the empty result as *"no processes are running"* and **stated it to Warwick as a fact.** It was wrong. Sixteen node processes were running, including the Tower watcher.

**Always `export MSYS_NO_PATHCONV=1`, or use `//c` / `//FI`.** Re-verified correct form:

```bash
MSYS_NO_PATHCONV=1 tasklist /FI "IMAGENAME eq node.exe" /FO CSV
MSYS_NO_PATHCONV=1 cmd.exe /c "…"
```

This matters more than it looks: **the entire next phase is about proving what is and is not running.** A mangled instrument produces a confident, wrong negative — which is exactly the failure this build already paid for once.

## START / RESUME HERE — ordered by Warwick

- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- This Git Wayfinder is the sole route and source of truth for BUILD-020.
- **Bare `Continue.` after a fresh session / `/clear` / resume is a one-time orientation handshake, not a blank cheque to execute.** Ordered steps (canonical also in root `CLAUDE.md` Step 2):
  1. Recover Honcho and **this** active Wayfinder (verify by execution: branch, HEAD, worktree).
  2. Establish exact branch, head, phase, **ACTIVE SESSION WORK PACKAGE** (§ below), acceptance criteria, completed items, open residuals and recorded next action.
  3. Produce **one concise orientation summary** to Warwick.
  4. **Explicitly ask Warwick to confirm whether anything has changed since rotation.**
  5. **Do not begin substantive execution** until that one confirmation is received.
  6. If Warwick supplies a change, **update the ACTIVE SESSION WORK PACKAGE first**, then proceed.
  7. After confirmation, execute autonomously without repeatedly asking route questions.
- **On a confirmed resume (not bare Continue. alone),** before any tool call, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action — then open this map and continue.
- Read the current phase, gate, **ACTIVE SESSION WORK PACKAGE** and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer — **except** the ACTIVE SESSION WORK PACKAGE, which Larry updates whenever Warwick amends the session requirements.
- Continue autonomously until completion or a genuine Warwick-only blocker **after** the orientation handshake.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate, ACTIVE SESSION WORK PACKAGE pointer and next action.
- **Before `/clear`, run `/rotate`. Clearing is unsafe until `/rotate` reports `SAFE TO CLEAR` after the installed Honcho readback matches this Wayfinder's current phase, frontier and exact next action.**
- **Tangents go in "SHIT TO DO" below. Do not chase them.** See the rule there — it binds even when the tangent comes from Warwick.
- **All Work Orders, Veritas dispatches, `/rotate` reporting and merge-readiness statements derive from the ACTIVE SESSION WORK PACKAGE.** No requirement may live only in chat, Larry's context or a stale rotation packet.

> ### 📣 The Warwick notification rule — **NOT COPIED HERE BY DESIGN**
>
> **Canonical: root `CLAUDE.md` § "Rule 4a — the Warwick notification rule". Read it there.**
>
> **The verbatim copy that stood here was REPLACED by this reference on Warwick's instruction, 2026-08-06.** A rule living in two places drifts, and the SSOT Golden Rule says every fact lives in exactly one file. **Do not restore a copy — restore a pointer if this one is ever lost.**
>
> **The one-line shape, so a reader knows what they are being sent to** (this is a signpost, not the rule): **decide before posting any substantive outcome and immediately after any specialist return · send BEFORE the chat update · then yield.** ⚠️ **Do not act on this summary — the criteria, the channel, the ordering and the availability clause are all in the canonical section.**

**Two facts that belong here rather than in the constitution, because they are this build's evidence:**

⚠️ **FusionDevBot and TowerBot are a real documented split and are not interchangeable — DevBot is Warwick's channel, TowerBot is Codex's** (`Deliverables/2026-07-21-tubeair-telegram-combined-gateway-handoff.md:28`). **Warwick himself wrote "TowerBot" on 2026-08-06 and corrected it to FusionDevBot.** Notifying him through TowerBot would deliver to the reviewer channel. **Do not "fix" it back.**

✅ **Orientation duty discharged 2026-08-06 by execution**, and the limitation that stood beside it is now **CLOSED**: `getMe` returned `{"ok":true,"username":"Fusion247devbot"}`, and **J2-e then proved a real send from the installed path with the credentials self-loaded** (§17.7, `message_id 326`). **The earlier caveat — that the path was available only to a caller that supplied credentials — no longer applies to the installed path.**

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

## 12. Phase 1's frontier — ⛔ SUPERSEDED AND HISTORICAL. **DO NOT READ THIS AS THE CURRENT FRONTIER.**

> ## 🚨 CORRECTED 2026-08-05 — this section stated a frontier that was THREE VERSIONS STALE
>
> **Found by Keel (WP-2B(2) read-back, P-4), and it is the most serious defect in this map.** This heading said *"Frontier: Phase 3, on a Veritas HOLD"* with an exact next action of *"Warwick re-attempts the walkthrough"* — **while the rotation block said Phase 2 and this section's own tail said "Go to §13."** Three different frontiers in one authoritative document.
>
> **Why it matters more than a stale label:** WP-2B(2) is building the mechanism that tells a fresh Larry where the frontier is. **Any code scraping §12 would have emitted "Phase 3, Veritas HOLD, next action: Warwick re-attempts the walkthrough" — a confident wrong orientation, delivered by the very mechanism built to prevent it.** That is W-1's named failure, and this map was the source of it.
>
> **THE CURRENT FRONTIER IS §14 (Phase 2) — see §14.16 and §14.19 for live status. §15 is Phase 3, recorded and NOT started.**
>
> Everything below in this section is **Phase 1 history, retained as evidence.** Phase 1 was **CLOSED and PASSED by Warwick on 2026-08-04.**

**Phase 1's frontier, as it stood before closure:** Phase 3, on a Veritas `HOLD`. **WP-1 is built and integrated at `39a553cb` — do NOT re-implement it.** Work Order `Deliverables/proofline/WO-2026-08-04-01-proofline-service-core.md` remains open for the HOLD disposition above; it is not reissued.

**Phase 1's exact next action, since completed:** Warwick re-attempted the walkthrough using the command below and **PASSED it on 2026-08-04.**

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
| **S-3** | **Current Tower works across builds and PRs** — exercised against more than one build/PR context | Working for BUILD-020 only · **a store change proven only in a worker branch.** ⚠️ **The live watcher runs from the MAIN worktree on `build-015/live-acceptance-recovery-2026-08-03`** (Keel, 2026-08-05). So "the same store the live watcher uses" is true of the **file** and false of the **code** — WP-2F reaches the running watcher's checkout **only at integration**, and S-3 may not be claimed before then |
| **S-4** | **The real Codex/Larry dialogue appears on TowerBot** — Codex's **actual finding content**, Larry's **actual rationale prose explaining how he is dealing with it**, and **each subsequent exchange or disposition as a further turn**, all rendered from ONE named durable source **after** the write. *(Sharpened by Warwick 2026-08-05 — see §14.7)* | A notification that a review ran · a mirror · a one-way post · **a disposition ENUM without the rationale text** · **a single digest instead of an ongoing thread** · **a summarisation cap that clips the rationale** |
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

---

## 14.7 WP-2E design — SETTLED by evidence, 2026-08-05

**The investigation returned a result that changes the work package from a build into a wiring job.** The exchange machinery already exists, is tested, and is connected to nothing.

### What execution established

| Finding | Evidence |
|---|---|
| **`tower.finding` holds ZERO rows** — while four real Codex findings sit stored inside `tower.supervisor_review.merge_review` as structured JSON (`TQA-001`, `TQA-002`, `TQA-003`, `TOWER-QA-001`), each with `technical_impact`, `reachability`, `required_disposition`, `evidence`, `required_correction` | Table row counts read from `C:\Users\Buggly\.mypka\tower\tower.db`; finding JSON pasted verbatim from the live row |
| **`openFinding()` exists and is never called by the live review path** — only by the acceptance harness (`accept.mjs:196`) and tests. **This single uncalled function is the whole gap** | `watcher.mjs:251-259`, call-site enumeration |
| **A complete disposition schema already exists** on `tower.finding`: `disposition` (checked enum), `disposition_rationale`, `disposition_source`, `disposition_comment_id`, `disposition_head_sha` (40-hex checked), `disposition_at` — with two constraints forcing completeness and forcing a `pr_comment` disposition to name its originating comment row | Schema read from the live DB |
| **A fail-closed disposition GATE already exists** — an undisposed prior finding, or one disposed at a *different head*, rejects the next review round before any reviewer is invoked | `findings.mjs:66-101` |
| **Inbound already works — via GitHub, not Telegram.** `pollPrComments.mjs` + `ingestComment.mjs` parse `@tower finding <id>: <disposition> — <why>` and persist with full provenance; head-mismatched comments are stored `applied=false` and never applied | Parser and gate read; grammar already published in every verdict Tower posts |
| **A disposition-only reply does NOT trigger a new Codex round** — turn creation is gated on a `checkpoint` marker being present | `pollPrComments.mjs:253` |
| **The PR verdict comment tells the reader to reply `@tower finding <id>: …` while listing no findings and no ids** — the instruction it publishes is literally unfollowable | `postVerdict.mjs:107-127` |
| **Telegram delivery is real and multi-part already** — `notify.mjs` splits an array into separate sends; three real deliveries with `telegram_ok=1` | `notify.mjs:51,87-95`; rows with `message_id` 453, 455, 457 |
| **Control-plane Postgres is DEAD on this machine** — `127.0.0.1:5432` connect failed | Executed connection attempt |
| `services/control-plane/notifier/` throws by construction and has never delivered | `transport.mjs:76-82` — confirmed, set aside |

### The nominated single source of truth

**`tower.db` — `tower.finding` as the exchange ledger, `tower.supervisor_review` as the immutable review record it derives from.** It is the only store that already models **both halves** of the exchange with provenance and head-binding; it is live and written today; it already backs a gate, so it has consequence rather than being a log; and it lives at `~/.mypka/tower/`, **outside any checkout**, which is exactly the durability property Phase 2 is about. Every alternative is dead (Postgres), a surface rather than a store (the PR thread), or new (a file convention).

**Telegram and the PR thread become renderings of it.** That is what answers Warwick's "not a mirror" requirement: one store, two views, and the store is the one with the gate attached.

### The four wires — no new store, no new mechanism

**W1** — after `supervisor_review` persists, loop `merge_review.qa.findings[]` and call the existing `openFinding()`. **This one loop lights up the disposition columns, the ingest parser and the gate simultaneously** — all built, all tested, all currently inert. **Must fail closed if the findings array is absent.**
**W2** — `composeVerdictComment` lists the findings it already tells the reader to reply about.
**W3** — `notify.mjs` gains a third message part carrying finding ids and impacts. No transport change.
**W4** — Larry disposes by posting one PR comment in the existing grammar with **no checkpoint marker**, so no new Codex round fires; Telegram then echoes **the parsed, persisted dispositions read back from the store**.

**W4's read-back-after-write is the spine of the design.** What Warwick reads is what the database accepted, not what Larry claimed. That is the difference between an exchange and a mirror.

### Warwick's clarification, 2026-08-05 — **settled, not a decision I take**

**I framed this as a decision I was taking on his behalf. It was never in question.** Warwick: *"I did not ask to reply to TowerBot from Telegram."* Recording the correction rather than quietly adopting the right answer.

**The settled division of surfaces:**

| Surface | Role |
|---|---|
| **GitHub / the PR** | **The control and disposition surface.** Where the review is *operated* — where Larry posts dispositions and where the grammar is parsed and persisted. Unchanged |
| **TowerBot / Telegram** | **The live visible conversation surface.** Where Warwick *watches* the QA exchange happen. **Not** where he operates it |

**Therefore: no Telegram inbound feature is required, and none will be built.** That **closes the only genuinely-new-code item** the investigation surfaced (no `getUpdates`, no webhook anywhere in `services/control-plane`). **WP-2E is now entirely a wiring job against code that already exists.**

### What TowerBot must actually SHOW — his words, and they are more than a findings list

> *"Codex's actual finding, Larry's actual response explaining how he is dealing with it, and any subsequent exchange or disposition."*

**Three requirements, and the second is the one W1–W4 under-delivered as drafted:**

1. **Codex's actual finding** — the real finding content: id, impact, reachability, required disposition, and the evidence text. Not a count, not a verdict word.
2. **Larry's actual response explaining how he is dealing with it** — **the `disposition_rationale` TEXT, not the `disposition` enum.** `addressed` alone tells Warwick nothing about *how*. The prose Larry writes when disposing a finding is the substance of his half of the conversation, and it must reach Telegram intact rather than being reduced to a status word.
3. **Any subsequent exchange or disposition** — this is an **ongoing thread**, not a single post-review digest. A follow-on round, a re-disposition at a new head, a finding that moves from `remains_open` to `addressed` — each is a further turn in the conversation and must appear as one.

**Consequence for W4:** the Telegram echo still renders **from the store after the write** — that is what keeps it an exchange rather than a mirror of Larry's intent — but what it renders is the **rationale prose**, and it fires on **every** disposition event, not once per review. **Truncation is the risk to watch:** `notify.mjs` has an existing summarisation cap, and a cap that clips the rationale would silently destroy exactly the content Warwick asked for. **The cap must be checked against the rationale field before W3/W4 are considered done.**

### Named as unestablished — not guessed

- Whether `merge_review.qa.findings[]` is **schema-guaranteed or model-dependent** — observed populated in 2 of 2 real reviews, but the validation path was not read. **W1 must fail closed on its absence.**
- Whether the **currently running watcher (PID 31268) can still send Telegram** — launched with no `--env-file`, may have inherited credentials; last successful send was 2026-08-02. **Needs a live check before W3 is relied on.**
- **Finding-id mapping** — Codex reused `TQA-001` across reviews and `tower.finding.id` is a generated UUID. How Codex's ref maps to the id Warwick types back is an open design point for W1.
- Whether Veritas receipts should join this ledger — not investigated, not assumed.

---

## 14.8 WP-2F decision — **SQLite is canonical for Tower.** And two corrections to §13.3a

### ⚠️ First: two things I reported that execution has now overturned

| ID | What I stated | What execution proved | Effect |
|---|---|---|---|
| **X-1** | **R-5:** the Tower watcher *"died on 2026-07-24 and could not report it"*, citing `watcher_crash` + `crash_notify_failed` in `C:\.fusion247\logs\tower-control-plane\watcher.log` | **I read the WRONG LOG.** That file belongs to the **stale** launcher. The **live** watcher logs to `C:\Users\Buggly\.mypka\tower\logs\watcher.log` and is healthy — polling PR #90, heartbeat **0.7 seconds old** at time of check. The crash was real but it was the *old* watcher's, not the current one's | R-5 is **withdrawn as a statement about the current runtime**. It remains true of the legacy path |
| **X-2** | The Supabase/Postgres host was failing DNS (`getaddrinfo ENOENT`), which I offered to Warwick as evidence against Postgres | **FALSE NOW. The host resolves, TCP connects, and the credential authenticates.** `db.iiqstxfqjbrbyplwwsql.supabase.co` → `2a05:d018:a0:6000:...`, **AAAA only, no A record** — the 2026-07-24 `ENOENT` was almost certainly a transient IPv6-only resolution failure, not a dead project. PostgreSQL 17.6, `tower` schema present with 922 turns, 172 reviews, 29 merge-check runs | **The "Supabase is broken" argument is GONE.** The recommendation survives, but on completely different reasoning. **This was the load-bearing fact in what I told Warwick, and it was wrong** |

**X-2 matters more than a corrected detail.** Had the decision been taken on my reasoning rather than on executed evidence, it would have been taken on a false premise and reached the right answer by luck.

### The decision: **SQLite, `C:\Users\Buggly\.mypka\tower\tower.db`, is the single canonical Tower store**

**Not because Postgres is unreachable — it is reachable.** Because:

1. **Only SQLite is alive.** SQLite heartbeat 0.7s old; Postgres heartbeat stale since **2026-07-24**. One is the system, the other is an archive.
2. **The split is small and was designed to be.** **7 modules are already store-agnostic** (they take `pool` as a parameter); only **3 operational call sites** open Postgres against `tower.*` — `tower-loop/mergeCheck.mjs`, `tower/merge-check.mjs`, `tower-loop/accept.mjs`. `db.mjs` is a pg-shaped façade returning `{rows, rowCount}` precisely so this would be cheap.
3. **The Codex route Larry is instructed to prefer needs no store at all.** `reviewDiff.mjs` imports no `pg`, no `openDb`, no `DATABASE_URL` — it stages git evidence and prints. That is why nobody has noticed this split since 2026-07-28.
4. **`~/.mypka/tower/` is outside the repo, outside any worktree, outside `C:\.fusion247\`** — exactly the durability shape Warwick asked for. The previous launcher died because it was pinned to a deleted worktree.
5. **Warwick's Supabase preference is honoured where it actually matters.** The `cockpit.*` schema — Brain, YouTube capture, attention items, the surfaces he looks at — **stays Supabase-resident and is untouched by this.** Verified: the 8 `cockpit/*.mjs` and `worker/*.mjs` modules contain **zero** references to `tower.*`. **Supabase is not going away.** This decision governs only the Tower watcher's operational store.

### The counter-argument, weighed and rejected — not omitted

**Unifying on Postgres would need ZERO new schema work.** `tower.merge_check_run` and `merge_check_message` already exist there with real DDL and 29 rows of history; SQLite needs new DDL and ~15 hand-rewritten `$n` → `?` literals. **The Postgres route genuinely looks cheaper, and it is the one Warwick's stated preference points at.**

It is rejected because it means **undoing WO-TW-01** — discarding a migration that was built, reviewed, merged and is *currently running* — and **re-introducing a network dependency into a poll loop that today cannot fail on DNS.** The cheaper-looking route is the one that throws away the working system. That is the trade, stated plainly so Warwick can overrule it.

### Known limit — recorded, not dressed up

**Backup is a genuine regression.** `~/.mypka/tower/tower.db` sits on one disk with no replication; Supabase was backed up by Supabase. It does not change the decision — Tower state is reconstructible from the GitHub PRs, and the data that actually matters (`cockpit.*`) stays in Supabase — but it is a real durability loss and is recorded here rather than discovered later.

### The migration route — one Work Order

1. **`db/merge_check_schema.sql`** + `applyMergeCheckSchema(db)` in `apply.mjs`, following the existing five-applier pattern. Two tables, 9 columns each, one FK. **SQLite DDL quirk: the schema qualifier goes on the *index* name, not the table.** Add `created_at`/`updated_at` to `TIMESTAMP_COLUMNS`. **Neither table has a boolean column, so the `BOOLEAN_COLUMNS` trap does not apply — stated explicitly so nobody "fixes" it.**
2. **Repoint 2 files** — `tower-loop/mergeCheck.mjs` and `tower/merge-check.mjs`: `pg.Pool` → `openDb()`, and `$n` → `?` at ~15 statements. `now()` already exists as a SQLite function. Delete the inline DDL in favour of the applier, and **drop the hard-coded `import pg from 'file:///C:/Fusion247PKA/...'`** while in there — that absolute path is its own latent breakage.
3. **`accept.mjs` — decide, do not migrate by reflex.** Establish first whether it is on any live route.
4. **Do NOT migrate the Postgres data.** The migration plan puts it explicitly out of scope. Leave the `tower` schema in Supabase as **read-only history** and document it as such.

### Named as unestablished — and one of these is serious

- **🚨 How the live watcher (PID 31268) was actually launched is NOT ESTABLISHED.** Parent PID 36416 no longer exists. The stale `run-tower-cp-watcher.ps1` is definitively **not** it — wrong path, wrong `WATCHER_ID` format (`YOGA_CP#` vs the live `WARWICK_YOGA#cp#`), logs stop 2026-07-21. **So there is no proven start path for the current Tower runtime.** That is precisely Warwick's *"or Larry remembering how to start them"* failure, and it must be closed by WP-2A rather than assumed away.
- **`tower.turn` in Postgres has a row from 2026-08-02T21:26**, nine days after its heartbeat stopped. Something wrote it. The writer was not traced.
- Whether `accept.mjs` and `run-proof.mjs` are on any live or documented route.
- **The 24-subtest tower-loop suite was not run** (read-only scope) — and `test:tower-loop` is **not** in the `test` aggregate in `package.json`, so a repo-wide `npm test` would not catch a regression in exactly this subsystem. Establish the baseline **before** the migration, not after.

---

## 14.7a WP-2C reconnaissance, 2026-08-05 (post-WP-2E integration session) — **NOT SETTLED. STOPPED per Warwick's own boundary.**

**§13.3's "one line" claim (R-6) is re-verified true as far as it goes, and materially incomplete.** Executed by Larry directly (GL-012 loaded first; `C:\.fusion247\**` reads below are narrow, targeted, and quote no credential value).

| # | Finding | Evidence |
|---|---|---|
| **C-1** | **The live watcher (PID 31268) bypasses the launcher's own credential gate.** `run-watcher.mjs` was hardened under a prior `WO-TW-02` — it now refuses to start unless `TELEGRAM_BOT_TOKEN`/`AUTHORISED_TELEGRAM_USER_ID` are present in its own environment, or `TOWER_NOTIFY_TRANSPORT=none` is explicit (`run-watcher.mjs:64-80`, `validateEnv()`). **But PID 31268's actual command line is `node.exe … tower-loop\watcher.mjs` — `watcher.mjs` directly, not `run-watcher.mjs`.** The hardened gate was never in this process's path. Whether it holds real credentials is genuinely unknown, not "probably fine" | `wmic process where "ProcessId=31268" get CommandLine` executed this session |
| **C-2** | **Untested, not proven broken.** `notification` table holds exactly 3 rows, all `2026-08-02`, all `telegram_ok=1` — all from a *previous* watcher instance, before PID 31268 existed. `watcher_heartbeat` confirms PID 31268 (`WARWICK_YOGA#cp#1785800856828`) is alive and beating as of `2026-08-05T13:08:33Z` today, `last_turn_id: null`. **Zero notification attempts of any kind since this watcher started** — no real PR turn has reached it, so it has never once tried to send Telegram and neither succeeded nor failed | `select … from notification/watcher_heartbeat` against `C:\Users\Buggly\.mypka\tower\tower.db`, read-only |
| **C-3** | **`TOWER_NOTIFY_TRANSPORT=none` is still literally at `tower-baton.env:8`, unchanged since R-6** — but whether that file is even loaded into PID 31268's environment is unestablished; nothing in its live command line references it, and per WO-TW-02's own commit note the launcher path that used to auto-load it was deliberately removed | Direct grep, line 8 only, no other content read |
| **C-4** | **A second, possibly-separate credential path exists and was never reconciled with the first.** `C:\.fusion247\larry-ding.mjs` ("FusionDevBot") draws `TELEGRAM_BOT_TOKEN`/`AUTHORISED_TELEGRAM_USER_ID` from `fusion-capture-gateway.env`, a **different file** from `tower-baton.env`. Whether "DevBot" (Warwick's own naming, §14.0) and "TowerBot" (tower-loop's own naming) are the same bot/chat, or two separate ones, is **not established** | §13.3 line 499 vs `tower-loop/mergeCheck.mjs:180-181` |
| **C-5** | **A safe, values-never-exposed equality check between the two files was attempted and BLOCKED outright by the harness's own auto-mode classifier before it ran** — not a judgement call declined, a hard block. No content of either file was read or exposed by the attempt | Executed this session; classifier denial, zero output |

### Why this stops here rather than proceeding to a fix

Warwick's own boundary on WP-2C: *"restore the ding where that is genuinely a small configuration issue… if it stops being a config change, STOP and report."* A one-line env edit is still config. But **closing this correctly requires knowing which credential file is authoritative for the bot Warwick actually watches, and that question hit a hard tooling block, not an open one I can reason past.** Guessing wrong here doesn't fail loud — `notify.mjs` records the row and moves on regardless of send success — so a wrong guess would look like it worked. Restarting PID 31268 without that answer risks silently misconfiguring, not fixing, his live notification path.

**RECOVERED 2026-08-05, within Warwick's 45-minute timebox — bounded recovery, not the full WP-2C build.** Warwick confirmed: DevBot and TowerBot are two different bots; `tower-baton.env` is TowerBot's authoritative, active route (preserve it, do not migrate); `.env keys/tower.env.txt` is unwired and out of scope. Fix applied: `tower-baton.env:8` (`TOWER_NOTIFY_TRANSPORT=none`) commented out — the one line, nothing else in the file touched or read. Watcher restarted via the existing, unmodified `run-watcher.mjs` (no new launcher code): old PID `31268` stopped by the launcher's own single-instance guard, new PID `42808` started from the same location (`C:\Fusion247PKA`), `TowerBot notifications: enabled`. Verified: exactly one `tower-loop*watcher.mjs*` process running; one real Telegram send via the existing, unmodified `notify.mjs` — `telegram_ok: true`, message id `460`; `fusion-capture-gateway.env`/`larry-ding.mjs` (DevBot) never opened or touched.

**Not claimed:** this is recovery, not the full WP-2C outcome (genuinely event-driven under real PR-review load, durable across a restart the way §14.0c's gate requires). That remains open for the Phase 2 gate. No new architecture, governance, secrets consolidation or launcher framework was built — Warwick's explicit boundary on this recovery.

**Frontier note:** WP-2C recovered to a working state; the broader "durable, event-driven" claim is still Veritas's to assess at the Phase 2 gate, not asserted here. §14.19 corrected.

---

## 14.9 WP-2A — legacy obsolescence **ESTABLISHED**. Removal is authorised, and it is six targets, not one

### Obsolescence, proven per implementation

| Implementation | Verdict | Evidence |
|---|---|---|
| **tower-loop (CURRENT)** | **LIVE and working.** PID 31268, `WATCHER_ID` `WARWICK_YOGA#cp#1785800856828` — the `run-watcher.mjs` format, and `1785800856828` decodes to its own creation time **2026-08-04 00:47:36**. **So it was started by a manual `run-watcher.mjs`, not by the Startup chain** | Live `pr_poll_ok` on PR #90; parent PID 36416 gone, correctly detached |
| **tower-baton (BUILD-010)** | **OBSOLETE.** Dead ~46 hours. Lock names PID 39920 — not running. Last log line is a *startup*, not work. Scheduled task `FusionTowerBatonWatcher` is **Disabled — but both triggers remain `enabled=True`**, so re-enabling is a one-command resurrection *and the daily trigger would then fire with no logon* | Lock decoded; `Get-ScheduledTask` output |
| **FusionTowerWatchdog** | **NEVER REGISTERED — established by enumeration, not by reading the commented-out block.** Absent from a full 19-task non-Microsoft enumeration; **zero of 333 Windows services** match tower/fusion/mypka/node | The negative is established, per the estate's own rule that negative claims require verification |
| **The stale copy at `C:\Fusion247PKA-tower`** | **Not running — and it is the live hazard.** `watcher.mjs` there is 25,566 bytes / SHA256 `9B788E2F…` against the current 43,513 bytes / `96331F65…`. It is a **linked git worktree**, not a clone | `git worktree` gitdir pointer; byte and digest comparison |
| **`services/control-plane/tower/merge-check.mjs`** | **A FIFTH "tower" thing I was not tracking.** Not a watcher, one-shot — flagged so it is not mistaken for dead weight during removal | Found by the investigation, not by my reconnaissance |

### The live hazard, now exact

**At the next interactive logon the Startup VBS fires and, in order: (1) force-kills PID 31268 — the current watcher — because the pattern `*tower-loop*watcher.mjs*` matches it; (2) starts the 22-July stale copy against the same live `~/.mypka/tower/tower.db`.** It is not a collision, it is a **takeover: the legacy watcher wins by killing the incumbent first.**

**The machine has not rebooted since 2026-07-21 23:21:22. That is luck, not a control.**

### 🔴 What removal must NOT touch — three traps found before cutting

1. **NEVER execute `run-tower-cp-watcher.ps1` for any reason, including "to test that it fails."** Its `Stop-Process` matches the live watcher. Confirmed by pattern comparison.
2. **`C:\.fusion247\tower-baton.env` is consumed by the CURRENT Codex-QA route** — `tower-loop/mergeCheck.mjs:142-143` falls back to it for `TELEGRAM_BOT_TOKEN` and `AUTHORISED_TELEGRAM_USER_ID`, as does `tower/merge-check.mjs:8`. **Delete it and TowerBot verdict delivery breaks — silently, because the README calls the mirror best-effort and non-blocking.** Keep the file; remove only the watcher.
3. **Deleting `services/tower-baton/` breaks a live test control.** `tower-loop/test/doubles/graph-probe.mjs:28` resolves `services/tower-baton/src/clickupClient.js` and exits 4 with `CONTROL_TARGET_MISSING` if absent; it is invoked as `control-trap` by the suite. **That is a negative control going missing — the exact "a control is not evidence until made to fail" failure.** Removing the tower-baton **source tree** is a SEPARATE decision from removing the **watcher**, and is not authorised by W-2.

### The six removal targets — "absence of code" is not enough

Three routes point at *paths* and one is a registered OS object:

1. Delete the Startup VBS `…\Startup\mypka-tower-cp-watcher.vbs` — the only automatic route to the stale copy.
2. Delete or neutralise `C:\.fusion247\run-tower-cp-watcher.ps1` — **it is documented as *the* launcher** in `Deliverables/2026-07-23-pr58-closure-evidence.md:105`, so a paste from a Deliverable resurrects both the stale path and the kill.
3. `Unregister-ScheduledTask -TaskName FusionTowerBatonWatcher` — **disabled is reversible; deleted is not.**
4. Delete `C:\.fusion247\run-tower-watcher.ps1` — the task's action target, independently runnable.
5. **`git worktree remove`** `C:\Fusion247PKA-tower` — **not a directory delete**; it is a linked worktree of `C:\Fusion247PKA\.git`.
6. **Correct `Builds/BUILD-010-fusion-tower/Runtime/recovery.md:81,90,91`** — it instructs a human to `schtasks /Create` the legacy watcher back. **A documented resurrection procedure is a start path with a human in the loop.** Also correct `Deliverables/2026-07-28-overnight-estate-closure-report.md:206` and `2026-08-01-pax-reset-challenge.md:61`, which still name `-tower` as the merge-check runtime home. **The main checkout is strictly ahead — `-tower` has no `reviewDiff.mjs` at all — so nothing is lost, but the documents would send the next fresh Larry to the stale tree.**

### The attempt-proof (S-2) — designed, deliberately NOT yet run

**A1** record the live PID and `WATCHER_ID` first; every later step asserts this exact PID still alive at the end — *that assertion is the "did not disturb the runtime" evidence*. **A2** attempt the VBS and the PS1 by absolute path → expect *file not found*. **A3** `schtasks /Query` then `/Run` → expect *cannot find the file*, **not** "task is disabled", which would prove only that it is off. **A4** run the stale `watcher.mjs` path → expect MODULE_NOT_FOUND. **A5** re-enumerate Startup and both `Run` hives → assert zero tower entries. **A6** re-assert A1's PID alive and the log advancing.

**A real logon is the only complete proof of A5, and it is the one that would kill the live watcher if step 1 or 2 were missed.** Under §14.0b Warwick does not require restart testing, so **it is named here as the one residual unproven step rather than quietly skipped.**

### Named as unestablished

- **The VBS firing at logon is inferred from configuration, not observed.** Its presence in an active Startup folder with no `StartupApproved` disable flag is strong — but it is not an observed firing.
- Why the PS1 has not logged since 2026-07-24 despite an `explorer.exe` restart on 2026-08-04 23:02. **Whether an explorer restart re-runs Startup items on this Windows build is contested and was not tested.** So it cannot be said whether the VBS is *overdue* or *already-run-and-failed*.
- ClickUp task `869e6859d` state — whether tower-baton left work half-done when it died.
- `C:\.fusion247\.env keys\tower.env.txt` (87 bytes) exists, is referenced by neither launcher, and was not opened. **Glance before removal.**

---

## 14.10 ✅ Proofline survived a full session restart — **CONFIRMED by independent execution**

**Warwick reported it; it is recorded because it was verified, not because it was reported.**

| Evidence | Value |
|---|---|
| Listener | `127.0.0.1:7317 LISTENING`, owning process **PID 38828** |
| Command / directory | `node bin\proofline.mjs`, from **`C:\Fusion247PKA-build-020-trial\services\proofline`** — this worktree |
| Health | `HTTP 200` · `{"ok":true,"epoch":1,"uptimeMs":8090444,"counts":{...,"approved":2,"total":2}}` |
| Uptime | **8,090,444 ms = 2 h 14 m 50 s**, consistent with a 22:03:17 start |
| **The survival proof** | **The grandparent process (PID 41332) is NOT RUNNING.** The launching process is dead and Proofline is still serving — genuinely orphaned and detached, which is what a survive-the-session claim requires. Live Claude sessions on the box are unrelated to that dead ancestor |
| Bonus | A `CLOSE_WAIT` peer traced to Chrome's network service — the UI was open in a browser at check time |

**Scope of this claim, stated exactly:** Proofline survived **the Claude Code session that launched it ending**. It has **not** survived a reboot, and under §14.0b that is not claimed. `epoch: 1` confirms it has never restarted and replayed.

---

## 14.9a 🚨 A SEVENTH start path — the removal order was falsified at read-back (2026-08-05)

**Keel returned `REFUSE` on seven grounds. The one that matters most is a discovery, not an envelope defect.**

### B1 — the acceptance property was FALSE as written

**`services/tower-baton/scripts/start-fusion-tower.ps1`** — documented at `Builds/BUILD-010-fusion-tower/Runtime/recovery.md:58` under the heading **"## 4. Start (canonical launcher — the only method)"**. Its own header states that Claude Code, Codex, foreground testing and the Scheduled Task **all** invoke it, *"or, equivalently, `node bin/tower-watch.js`, which uses the SAME runtimeConfig module. There is no separate startup method."*

**It survives all six removal targets.** It is in the repo and in every worktree and in git history; hard prohibition #3 forbids deleting `services/tower-baton/`; `services/**` was excluded from the order's file surface; and it depends on **none** of the six — not the VBS, not either root `.ps1`, not the scheduled task, not `C:\Fusion247PKA-tower`.

**So after a flawless execution of all six targets, `powershell -File services\tower-baton\scripts\start-fusion-tower.ps1 -TaskId <id>` still starts a legacy Tower watcher.** The order would have produced a proof that **reads as complete and is not** — the exact failure its own *"absence of code is not the bar"* section was written to prevent. **And it must not be closed by attempt-testing: unlike A2–A4, this attempt would SUCCEED.**

**An eighth, same class, lower severity:** `Builds/BUILD-010-fusion-tower/Architecture/tower-host-runbook.md` §3–§4 instructs a human to run `register-tower-service.ps1` (NSSM service) and `register-watchdog-task.ps1`. Both scripts exist and are committed. Never registered — but a documented resurrection procedure is a start path with a human in the loop, which is the order's own logic.

**Larry's proposed closure, for Warwick's decision:** **do not delete — make the legacy entrypoint REFUSE.** A guard in `bin/tower-watch.js` that exits with "tower-baton is retired" closes the path **by making it unable to start**, which is N-1's actual bar, and it is **provable by attempt** in a way deletion is not. Deleting only `scripts/start-fusion-tower.ps1` would *not* close it, because `bin/tower-watch.js` is the real entrypoint. The negative control at `graph-probe.mjs:28` resolves `src/clickupClient.js`, a different file, so it survives either way.

### Four class-A defects — all mine, all checkable before dispatch

| # | Defect | Rule breached |
|---|---|---|
| **A1** | I declared **`live_authority: BOUNDED`** | Keel's contract: `none` is *"the only value Keel may act under; any other value is itself a REFUSED condition"*. Not discretionary |
| **A2** | I put **`Builds/BUILD-010-fusion-tower/Runtime/recovery.md`** in `file_surface`, and `document_impact: owner: keel` | Keel's critical rule 5 names **`Builds/`** in its NEVER-edit list. **A Work Order cannot override a permanent contract.** SOP-022 cites this exact failure as its founding example |
| **A3** | **`private_surface: C:\.fusion247\` — the secrets root, AGAIN**, the same defect as WO-02 | GL-012 §4. **And it is NOT fixable by redeclaring:** GL-012 §1 permits exactly `C:/.fusion247/private/<project>/**`, while **both target files sit at the ROOT**. There is **no legal declaration that reaches them** |
| **A4** | Targets 1 and 3 — deleting an OS Startup registration and `Unregister-ScheduledTask` | Keel's critical rule 3: *"NEVER touch a live service, **scheduled task**…"*. The seam is explicit: **Mack registers with the supervisor; deregistration is the same seam.** A Work Order spanning it must name the split, and mine did not |

### B2 / B3 — two more findings worth keeping

- **B2:** the order's required suite evidence **cannot be produced**. `node_modules` exists only in `C:\Fusion247PKA`; a fresh worktree lacks it; installing is a write under `services/**`, excluded as WO-02's surface. **And separately: the repo surface is four markdown files — a markdown edit cannot regress the tower-loop suite.** Requiring it is a control reporting on ground the change never touches, and it couples this verdict to WO-02's in-flight state.
- **B3 — the two orders are NOT disjoint at the layer the acceptance property is measured.** `tower-loop/test/run-tower-loop-tests.mjs:90` spawns twelve-plus children whose command line is bare `"…\node.exe" watcher.mjs` — **indistinguishable by process name from a resurrected legacy watcher**. Keel observed two such processes appear and vanish during preflight. **Any "no second watcher appeared" assertion can false-positive.** Assert on the **absolute script path and `WATCHER_ID`**, never a name match, and serialise against WO-02's suite runs.

### ⚠️ An unexplained provenance — do not delete until it is explained

**`C:\.fusion247\run-tower-watcher.ps1` was created AND last written `2026-08-02 05:23:53`** — three days ago, and **the same date as the `FusionTowerBatonWatcher` daily trigger's start boundary (`2026-08-02T00:05`)**. By contrast `run-tower-cp-watcher.ps1` is unchanged since 2026-07-22.

**Something set this up on 2026-08-02 and then disabled it.** The investigation did not account for it. **Deletion is not reversible, and this is the one target whose provenance is unknown.**

### Also established at preflight

Three `MyPKA-*` scheduled tasks the earlier investigation never examined — `MyPKA-AsdAIr-Runtime`, `MyPKA-Directus-Live`, `MyPKA-Local-Services-Live` — were checked and **none starts a tower watcher.** Cleared. The 333-service negative and the `Run`-hive negatives were independently re-established. **Keel did not read `run-tower-cp-watcher.ps1` and therefore has not independently confirmed prohibition #1's premise** — it declined because the grant authorising even that read is invalid, which is itself the argument.

---

## 14.12 The Honcho pagination defect — **REPAIRED. Verified 2026-08-05, not assumed**

**Warwick asked for confirmation, 2026-08-05:** *"newer continuity packets can exist beyond the first 50 while `readLatest` returns an older reachable packet. The warning mitigation is not the repair."*

**Verdict: REPAIRED — and proven not to be a coincidental match.**

### The repair, and what it replaced

The defect was commit `7cb1560`: `page`/`size` were sent in the **request body**, which the server's one-property (`filters`) model **discards in silence**, defaulting to `page=1, size=50, reverse=false` — oldest-first. **Warwick is right that the warning was never the repair.** The repair is `7e3847c` (WO-OR-21), which moved them to the **query string**:

```js
const qs = new URLSearchParams({ reverse: String(!!reverse), size: String(size), page: String(page) });
```

`LIST_PAGE_SIZE = 100`, `LIST_REVERSE = true`, walk while `page < pages`, then sort **ts desc → seq desc → live-before-backfill** — so selection is by content, never by arrival order or array position. The `⚠️ PAGINATION INCOMPLETE` warning survives as a residual honesty signal for the 40-page cap, **no longer as a substitute for the fix.**

### Proven three ways against the live store

| Test | Result |
|---|---|
| Ground truth | **140 packets, 2 pages.** Genuine newest by seq **and** by ts: `cont-1785846026092-143-rqjtww`, seq 143 |
| **The deciding test** | `readLatest` returns **exactly that packet**. `complete: true` |
| **Not coincidence — 1** | The newest sits at **position 139 of 140** oldest-first. `reachable_in_first_50_oldest_first: **false**` |
| **Not coincidence — 2** | The old broken window reproduced live (size 50, oldest-first) returns seq 51 — **2 days 10 hours stale.** The defect is still reproducible against today's store; it is simply no longer on the code path |
| **Not coincidence — 3** | Forced `size:10, reverse:false` through the real walker still finds seq 143 across **14 pages**. Correctness comes from the walk plus the sort, not from `reverse=true` happening to put the answer on page 1 |
| Locking test already exists | `continuity.test.mjs:319` — *"MUTATION: a single-page read of the same store returns the STALE packet — the defect, reproduced"*, plus assertions that page/size/reverse are in the query string and nothing pagination-shaped is in the body. **71 pass, 0 fail. No new test is owed** |
| Contract | `Deliverables/2026-08-02-pax-honcho-messages-list-contract.md` — `page`/`size`/`reverse` are **query** params, size max 100, envelope `{items,total,page,size,pages}`, no cursor. **The live envelope matches it exactly** |

**Nothing is folded into WP-2B for this defect. There is nothing to repair.**

### ⚠️ But Warwick's acceptance bar has TWO halves, and only one is met

His bar: *"a fresh Larry receives the genuinely newest packet, containing the current Wayfinder path and frontier."*

| Half | Status |
|---|---|
| **Receives the genuinely newest packet** | ✅ **MET** — proven above |
| **Containing the current Wayfinder path and frontier** | ❌ **NOT MET.** The live brief renders **right now**: *"map path missing or invalid — treat continuity as absent"* |

**Cause — a deployment gap, not a code defect.** The Stop hook runs `C:/Fusion247PKA/tools/governor/continuity.mjs` — the **main** checkout at `c1ed028` on `build-015/...`, which has **zero** occurrences of `resolveActiveMapPath`/`map_path` and does **not** contain WP-2B(1) (`git merge-base --is-ancestor d3c08a7 HEAD` → **NO**). **So every packet the live hook writes carries no map pointer, and the render correctly shows its honest-absent form.** The read is right; the writer is behind.

**This is exactly WP-2B(2)'s install step, and it is now the thing standing between Phase 2 and S-1.** Recorded, not re-scoped.

### Correction to Larry's own reasoning

**I inferred from "seq 143 > 50" that the defect was live by arithmetic. That inference was WRONG** — the read path already paginates at size 100 with `reverse=true` and walks every page. It was flagged as an inference rather than a finding, and execution overturned it. **A plausible arithmetic argument is not evidence.**

### Named as unestablished

- Whether the server returns 422 on `size=101` — taken from the contract document, **not executed**.
- Honcho rate limits — recorded as NOT FOUND in any official source. **Unknown, not unlimited.**
- **`seq 143` against `count 140`: three sequence numbers are consumed but absent from the store.** Consistent with `nextSeq()` incrementing before a delivery that returned `ok:false`. **An observation, not a claim** — not investigated.

---

## 14.13 Warwick's decisions, 2026-08-05 — the two handbacks DISCHARGED

### D-A · The seventh start path: **make it REFUSE, do not delete**

> *"Make the seventh legacy start path refuse clearly rather than deleting the protected source tree. The outcome is that legacy Tower cannot start, while the negative control remains intact."*

**Accepted as recommended.** A guard at the legacy entrypoint that exits clearly. **`bin/tower-watch.js` is the real entrypoint** — the launcher's own header says invoking it is *"equivalently"* the same route — so **the guard belongs there**, not only in the `.ps1`. `services/tower-baton/src/clickupClient.js` — the negative control's target — is untouched. **Provable by attempt, which deletion never was.**

### D-B · 🔐 GL-012 NAMED EXCEPTION — granted by Warwick, 2026-08-05

> *"I also authorise the exact named exception needed to remove: `C:\.fusion247\run-tower-cp-watcher.ps1`, `C:\.fusion247\run-tower-watcher.ps1`."*

**This is the only authority under which anything at the `C:\.fusion247` ROOT may be touched in this build.** Recorded here as the durable trail, because GL-012 §1 otherwise permits only `private/<project>/**` and no specialist has a legal route to these paths.

**Scope of the exception — exactly two paths, delete only. It extends to nothing else:** not the root, not siblings, not parents, not any `.env`, not `.env keys\`, not `private/`.

**Three conditions Warwick attached, all binding:**

| # | Condition | How it is discharged |
|---|---|---|
| **C-1** | *"Confirm immediately before deletion that neither is used by the current Tower runtime"* | A live check **at deletion time**, not from this map. The live watcher (PID 31268) was started by `run-watcher.mjs` and its `WATCHER_ID` format proves neither `.ps1` launched it — **but that is evidence from 2026-08-05 and must be re-executed immediately before the delete** |
| **C-2** | *"preserve `tower-baton.env`"* | Already hard prohibition #2. It is consumed by the **current** Codex-QA route (`mergeCheck.mjs:142-143`) and deleting it breaks TowerBot verdict delivery **silently** |
| **C-3** | *"route the live machine-level removal through Mack where that is the correct contract boundary"* | **Confirms Keel's A4 refusal was right.** The work splits per §14.14 |

✅ **`run-tower-watcher.ps1`'s provenance is EXPLAINED — closed 2026-08-05 by Mack.** The scheduled task's own `Comment` field says it:

> *"Fusion Tower baton watcher. **Repaired 2026-08-02**: was logon-only and pinned to the **DELETED worktree `C:\Fusion247PKA-b010`**, so it **sat dead for 12 days in silence**. Now repeats every 10 min, is idempotent, and dings TowerBot on every failure path."*

**Nothing mysterious set it up. A prior session repaired a watchdog that had died silently.** The script's own header names the same three faults. **This was escalated to Warwick as unexplained; it is now explained, and the escalation was resolved by looking rather than by asking.**

**It is not in use:** `LastRunTime 2026-08-03 02:05:02`, `LastResult 0` — it ran successfully ~47 h ago and was disabled immediately after; `NumberOfMissedRuns 283` (≈47.2 h at `PT10M`); **zero `tower-watch` processes exist.** No STOP condition. Removal proceeds.

⚠️ **But the trigger is worse than recorded:** it is a daily trigger **with `Repetition = PT10M`** — a **ten-minute resurrection loop requiring no logon** — not "one run tomorrow". **`Unregister` matters more than the map implied.**

## 14.14 WP-2A split along the contract seams

Keel's four class-A refusals were all correct. The work divides:

| Owner | Scope | Why |
|---|---|---|
| **Keel** | The **refuse guard** at `bin/tower-watch.js` + `scripts/start-fusion-tower.ps1` · `git worktree remove C:\Fusion247PKA-tower` (verified to lose nothing — clean, pushed, no process holding it) · the **`Deliverables/**` documents** | Code and repo git are squarely inside its contract. `live_authority: none` restored |
| **Mack** | The **four** machine-level removals *(corrected from "five" — the list always had four; Mack, 2026-08-05)*: the Startup VBS · the two root `.ps1` files under D-B · `Unregister-ScheduledTask FusionTowerBatonWatcher`. **These land BEFORE Keel's worktree removal — see the sequencing note below** | Mack's contract owns supervisor registration; **deregistration is the same seam.** Warwick's C-3 confirms it |

**🚨 Sequencing, safety-critical (Mack, 2026-08-05).** In `run-tower-cp-watcher.ps1`, **line 23 (the `Stop-Process` kill) executes BEFORE line 24 (the start)**, so the kill is unconditional. Line 7's start target is `C:\Fusion247PKA-tower` — **the very worktree Keel is authorised to remove.** If the worktree goes first, an accidental invocation stops being a *takeover* and becomes a **silent Tower death**: it kills the live watcher and then has nothing to start. **Mack's deletions land first; Keel's `git worktree remove` is HELD until Larry releases it.**

**Also established:** Mack read `run-tower-cp-watcher.ps1` under the exception and **independently confirmed prohibition #1's premise** — `-like '*tower-loop*watcher.mjs*'` does match the live watcher's command line. Previously that premise rested on one uncorroborated reading.

**The machine layer is enumerated and closed — with one honest boundary.** Mack checked **all 216 scheduled tasks**, every `Run`/`RunOnce`/`RunOnceEx`/`RunServices`/Policies hive, WMI permanent subscriptions, Winlogon, `cmd.exe` AutoRun, Group Policy scripts, four PowerShell profiles and the Git Bash profiles: **no eighth registered machine route exists.** **But `C:\.fusion247` itself is un-enumerable under any grant** — prohibition #3 forbids listing it, and `run-tower-watcher.ps1:27` references a `C:\.fusion247\tower-ding.mjs` that appears in **no** investigation to date. **The honest claim is: every automatic/registered route is closed; unregistered scripts at the secrets root are the paste-to-resurrect class and cannot be enumerated under the current grant.** Not *"complete"*.
| **Larry** | **`Builds/BUILD-010-fusion-tower/**`** — `Runtime/recovery.md:58,81,90,91` and `Architecture/tower-host-runbook.md` §3–§4 | **Keel's critical rule 5 permanently bars `Builds/`, and a Work Order cannot override a contract.** These are build-fact corrections to documented resurrection procedures; Larry takes them as a bounded, reviewed, reversible exception under Rule 4 |

**The acceptance property is amended** (it was falsified — §14.9a B1): *every enumerated start path, **now eight**, fails or refuses when attempted, while PID 31268 remains alive and its log advancing.* **Assert on absolute script path and `WATCHER_ID`, never a process-name match** (B3 — the tower-loop suite spawns children indistinguishable by name).

---

# 15. PHASE 3 — token and process forensics. **GATE OPEN — NOT STARTED IN THIS CONTEXT**

**Set by Warwick, 2026-08-05. Explicitly NOT to be built now:** *"do not start building it until Phase 2 is complete, merged and we have rotated successfully. The fresh Larry owns the route."*

**Phase 2 is complete and merged** — PR #94 → `main` at `c21c3f3cfa5cdf8499d3972152bad6dc82986df3`, Veritas PASS at `abb9892c950b0d673691849baed9220cbfe321d2` (`Deliverables/2026-08-05-veritas-phase2-gate-receipt.md`). **The gate is open on Phase 2 completion; the remaining condition — "we have rotated successfully" — is for the FRESH Larry after `/clear` to establish, not this context.** This context does not start Phase 3, per explicit instruction (2026-08-05).

**Recorded here so it survives rotation. Any session that starts building this before rotation has happened is disobeying the instruction that created it.**

## 15.1 North Star — his words

> *"After a phase closes, I can quickly understand where the time and tokens went, what caused avoidable rework, and what should change before the next phase."*

## 15.2 The deliverable

> ⛔ **CORRECTED 2026-08-06 (Veritas V4-2). The DESTINATION below is SUPERSEDED — §17.5a is canonical.** Warwick reactivated §15.2 on 2026-08-06, and **reactivating a section reactivates its body**, so this line's "Google Drive" came back to life as an active instruction. **It is not one.** **The report is a GIT artefact under `Deliverables/`. NOT Google Drive, NOT Google Sheets, NOT Supabase.** The *substance* below — a phase-close report produced as the final job before `SAFE TO CLEAR`, showing token usage and, as far as evidence allows, where it went — **is reactivated and stands. Only the destination changed.**

~~**A durable phase-close report in Google Drive**~~ **→ a durable phase-close report committed under `Deliverables/`**, produced as **the final job before Larry says it is safe to `/clear`.** It shows **how many tokens the completed phase used** and, **as far as the available evidence allows, where they went.**

**Purpose, in his words:** *"not accounting for its own sake"* — it is to let him **spot obvious token-burning doom loops, disproportionate assurance work, repeated investigations, rework, unnecessary testing or other process smells without having to watch the build live.**

## 15.3 Mandatory content for THIS phase's report

**Every Work Order refusal**, and for each: **what was refused · why · whether the defect was in the ORDER or in the proposed WORK · how many amendments or reissues followed · and whether a repeatable pattern is emerging in Larry's dispatch quality or in the contracts themselves.**

**Phase 2 has already produced material for this, and it is not flattering — which is the point.** Raw data at close: **three refusals across three Work Orders, every one class-A, every one a defect in MY order, not in the proposed work.** A candidate pattern is already visible — **`private_surface` mis-declared as the secrets root TWICE in one session** — and the honest report must say whether that is a Larry defect, a template defect, or a missing pre-dispatch check. **The report is not to be written to make the phase look tidy.**

## 15.3a NAMED INVESTIGATION — Governor visibility and context economics

**Set by Warwick, 2026-08-05. RECORDED, NOT STARTED. Same gate as the rest of Phase 3: not before Phase 2 merges and rotates.**

### The issue, his terms

- this session previously **appeared** to consume roughly **58k tokens per turn**;
- he currently has **no visible sense of how large the session is**;
- **the footer has not appeared when it would have helped him decide whether to rotate**;
- **distinguish actual fresh input, cached input/read-write activity, total context presented, output, and any other relevant measure — rather than treating one number as "cost" without proving what it means**;
- establish **whether the current footer measures the right thing**, and **why its event-driven behaviour did not surface the state before repeated expensive turns**;
- evaluate **whether the intended solution actually works**: proactive rotation *before* a swollen transcript is repeatedly resent, with Honcho and the Wayfinder making `/clear` + `continue` a cheap, reliable recovery.

### Desired outcome — his words, and they bound the answer

> *"**Not** a footer stapled to every response and **not another governance mechanism.** It is that I can see the state when I ask, receive a timely warning when rotation genuinely becomes appropriate, and rotate without losing the route."*

**The regrowth cap applies at full force.** Two of the three desired properties may already exist and merely be mis-wired — see below.

### Live evidence captured 2026-08-05, before the investigation starts

**A footer rendered on request, from live session-bound telemetry 81 s old:**

```
⟦GOV⟧ ctx 42% · GREEN · KEEP GOING · next: Opus/high · CONTINUE
```

**Raw sample** (`~/.mypka/governor/health/C--Fusion247PKA-build-020-trial/<session>.json`): `used_percentage: 42` · `context_window_size: 1000000` · **`total_input_tokens: 418491`** · `total_output_tokens: 1637` · `exceeds_200k_tokens: true` · `model.id: claude-opus-5[1m]` · `effort.level: high` · `source: statusLine` · rate limits five-hour **31%**, seven-day **42%**.

**🎯 FINDING ALREADY IN HAND — the absolute count EXISTS and the footer does not read it.** `footer.mjs` takes its numerator from `context_window.used_tokens`. **That field is not in the sample** — the producer writes **`total_input_tokens`**. So `usedTokens` is `null`, the module falls back to the reported percentage, and renders `ctx 42%` **while `418,491` sits unread on disk.** **A producer/consumer naming mismatch, not missing data.** This is exactly *"I have no visible sense of how large the session is"*, and **the fix may be one field name — which is the first thing to test before anything is designed.**

**🎯 SECOND FINDING — the footer never grounds its own recommendation.** With no `--next`, the same telemetry renders `ctx 42% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE`. **The model/effort advice is CALLER-SUPPLIED.** It is not invented — telemetry independently records Opus/high — **but the module did not compute it**, and any claim that the footer "recommends" a model is false as built.

**❓ OPEN QUESTION, recorded as a question not a finding — `total_output_tokens: 1637` is implausibly low** for a session of this length, suggesting it is **per-turn or per-sample rather than cumulative.** **This is precisely the "one number treated as cost without proving what it means" hazard Warwick named.** *Establish what each field actually counts before any of them is used as cost.*

### Where the "58k per turn" figure must be tested, not assumed

**418,491 input tokens across this session is consistent with a growing transcript being resent each turn** — but *consistent with* is not *established*. **Do not reason from the number; find the producer and establish what it measures.** `source: statusLine`, `version: 2.1.221` names the producer.

### The uncomfortable question this investigation must actually answer

**Why did no footer appear during the expensive stretch?** The footer is deliberately event-driven — handback, rotation-advice, or on request (root `CLAUDE.md`). **At 42% GREEN, no rotation advice was owed, so the design behaved as specified and Warwick still could not see the state.** **So the honest question is not "did the mechanism fail" but "is the trigger set on the right thing" — and whether "rotation advice" firing only near a threshold is too late when the cost is incurred *per turn on the way there*.** **Answering that with a new mechanism is the rejected diagnosis.**

## 15.3b NAMED INVESTIGATION — Nolan's governance/contract role, and the ownership gap that let Keel draft reviewer law

**Set by Warwick, 2026-08-05. RECORDED, NOT STARTED — explicitly: *"Do not investigate now."*** Same gate as the rest of Phase 3.

**The question:** Nolan historically owns hiring, contracts and `agent-index.md` (SOP-001). **So who owns REVIEWER law?** In WP-2G, **Keel — an implementation engineer — authored the operating contract governing the external reviewer that decides whether Keel's own diffs may merge.** Larry ruled that in, narrowly and on his own authority, and recorded the ruling in `contract_basis`. **It shipped DRAFT precisely because nobody could ratify it — which is the gap showing itself.**

**Facts already on the record, so the investigation starts from evidence rather than recollection:**

- **Keel's contract bars it by function**, not just by path: *"any other document whose function is to define, govern or assess the work Keel is implementing."* Keel cited this when refusing the `Builds/**` delete — **and then authored the reviewer contract anyway, under Larry's ruling.** The tension is real and Keel named it: *"I want Larry's ruling recorded there, not my inference."*
- **The estate has a rule that AI-authored governing prompts need Warwick's approval before use**, and a **worked precedent in the same directory** — `product-qa-runtime-orientation.md`, DRAFT, never approved, and consequently **does not govern**.
- **Only Nolan may amend a specialist contract** (SOP-001). Nobody was asked whether authoring reviewer law belongs to any existing specialist.
- **`agent-index.md:39` deliberately lists Codex OUTSIDE the specialist table** — so the reviewer has no contract owner in the roster at all.
- **A second, unowned governing text exists:** `tower-loop/prompts/supervisor-prompt.md` reaches Codex on **every** watcher turn, is labelled `approved_by='ai-authored-unapproved'`, and carries no reviewer or disposition law (WP-2G finding F-7).

**What the investigation must NOT conclude by reflex:** that the answer is a new specialist, a governance role or a contracts registry. **Warwick's regrowth cap and the recorded lesson that a role IS subject to it both apply** — the real test is whether an existing owner or procedure already supplies standing separation. **It may be that the correct answer is "Warwick ratifies, Nolan owns the contract text, and nothing new is hired."**

## 15.3c NAMED INVESTIGATION — the recurring END-OF-PHASE COLLAPSE, and its smallest prevention

**Set by Warwick, 2026-08-05. RECORDED ONLY. Explicitly: *"Do not investigate or build it during Phase 2."***

### His observation, verbatim

> *"This phase started well, then degraded into repeated defective orders, refusals, narrated-but-unexecuted next actions, five hours idle while I slept, stale Needs Input state, and expensive chasing at ~500k context — all before Veritas and Codex, where every mistake costs even more."*

**Recorded without softening. Every element is corroborated below by this session's own record, so the investigation starts from evidence rather than from Larry's account of himself.**

### Corroborating evidence, from this phase — specific, dated, and Larry's

| # | Instance | Evidence |
|---|---|---|
| **E-1** | **Narrated-but-unexecuted next action.** After Keel's WP-2B(2) refusal, Larry corrected the map, then closed the turn with *"Amending the order now."* **He did not amend it and did not dispatch.** Nothing ran until Warwick asked hours later | Warwick: *"WP-2B(2) was dispatched four hours ago, but PR #94 is still at `2fc4d39`."* Verified at the time: **no agents in flight, nothing unpushed, zero unmerged worker branches** |
| **E-2** | **Idle while Warwick slept, with no signal.** The footer is event-driven and, at GREEN with no handback owed, **correctly emitted nothing** — so a stalled turn and a healthy working turn are **indistinguishable to Warwick** | §15.3a already records the trigger question. **E-1 is the case that proves the gap is not theoretical** |
| **E-3** | **A Work Order that existed ONLY in Larry's context.** WP-2B(2) was first dispatched in-prompt with **no WO on disk** — the failure mode S-5 exists to rule out, committed while building the mechanism meant to prevent it | Corrected at `WO-2026-08-05-06`; recorded in its own Amendment 1 |
| **E-4** | **Seven Work Order refusals/holds, EVERY ONE a defect in Larry's order** | Ledger at **§14.21** |
| **E-5** | **Defect severity rose as the phase progressed, even as refusal frequency stayed flat.** Early: a missing `file_surface`. Late: **an acceptance property that would have returned a FALSE PASS on the exact risk it existed to test** (WO-07 D2), **a relocation that silently kills the Deliverables sweep** (WO-07 D1), **an instruction reversing an approved governance redline** (WO-06 C) | §14.21 and the WO amendments |
| **E-6** | **Context economics.** Last *measured* telemetry: **418,491 input tokens / 1,000,000 (42%)**, and growing per turn. Warwick observes chasing *"at ~500k"* | §15.3a — **and note the footer does not render the absolute count even though it is in the sample** |

### What Warwick asked to be established

**Why delivery becomes less reliable near closure** — and the **smallest practical prevention**, across five named surfaces:

1. **Accurate in-flight state** — Warwick can see what is actually running.
2. **No silent stop after a refusal** — a refusal must not be able to end a turn without either a dispatch or an explicit handback.
3. **Durable dispatch before claiming work is running** — the order on disk *before* the claim, not after.
4. **Timely rotation before context becomes punitive.**
5. **Better preparation before Veritas/Codex** — where each defect costs most.

### 🔴 The constraint that decides the answer

> *"Analyse process and ownership first; **do not default to another checker, control plane or governance layer.**"*

**This is the third time this constraint has been applied in this build, and BUILD-018 is what happens when it is ignored.** The tempting answers — a dispatch-linter, a pre-flight validator, a state daemon — are all **rejected diagnoses**.

**Two candidate explanations the investigation should test FIRST, because both are process/ownership rather than mechanism:**

- **Larry batches too much into one turn near closure**, so a turn that ends early strands a queue that only he can see. **E-1 is exactly this shape.**
- **The reply is doing double duty as both the report and the dispatch record.** When the reply is written *as if* the action happened, the action's absence leaves no trace — because **the narration and the execution share no artefact.** E-1 and E-3 are the same defect at two scales.

**A third, uncomfortable, and testable:** the refusals mean the specialists were catching what Larry no longer was. **That is the system working — but it also means Larry's own error rate was rising while his confidence in each order did not.** *Whether closure pressure, context size, or accumulated unclosed state drives it is exactly what this investigation must establish rather than assume.*

**Do not fix E-1 by adding a check that Larry dispatched. Establish why the turn ended first.**

## 15.3d ⭐ NAMED INVESTIGATION — **DELIVERY TAX AND END-OF-PHASE COLLAPSE**

**Set by Warwick, 2026-08-05. RECORDED ONLY: *"Investigate after Phase 2 merges and the fresh Larry takes over."*** **This is the parent investigation; §15.3c's evidence (E-1..E-6) is its input, not a separate enquiry.**

### The North Star for the whole of Phase 3 — his words

> **"The process exists to ship trustworthy products quickly, not to produce immaculate paperwork about why they have not shipped."**

### His observation

> *"This phase has taken more than 12 hours and became dominated by Work Orders, amendments, refusals, provenance corrections, role-boundary disputes, evidence machinery, idle gaps and half-million-context chasers — with final Veritas, Codex and UAT still outstanding."*

### 📊 Hard baseline, measured 2026-08-05 — so the investigation starts from data, not recollection

| Measure | Value |
|---|---|
| **Elapsed, Phase 1 close → now** | **11 h 51 m** (`2026-08-04 22:07:06` → `2026-08-05 09:58:16`) |
| Commits in Phase 2 | **56** |
| **Documentation churn** | **`Deliverables/`: 18 files, +3,735 lines** |
| **Product code churn** | **`services/` + `tools/`: 26 files, +2,869 / −150** |
| **⚠️ RATIO** | **Paperwork lines EXCEED product lines — 3,735 vs 2,869.** *That single number is the delivery tax made visible* |
| Work Orders issued | **8** (WO-01 … WO-08) |
| **Amendments to those orders** | **~11** — more amendments than orders |
| **Refusals / holds** | **8** — 7 Work Order refusals (all class-A, all Larry's defects) + 1 Veritas HOLD |
| Files in `Deliverables/proofline/` | **14** |
| Last measured context | **418,491 input tokens / 1,000,000 (42%)**, still rising |
| **Delivered** | WP-2B(1) · WP-2F · WP-2A (both halves) · WP-2G · WP-2B(2) code · WO-08 |
| **Still outstanding** | WP-2B(2) install · WP-2E · WP-2C · **final Veritas · Codex · UAT · merge** |

### What to investigate — seven questions, his

1. **Where elapsed time and tokens actually went** — product implementation **versus** dispatch / admin / evidence / rework / waiting.
2. **Which controls prevented REAL defects, and which merely moved paperwork around.**
3. **Why reliability deteriorated near closure.**
4. **Why actions were narrated but not executed, and inactivity was invisible.**
5. **Why preventably invalid Work Orders repeatedly reached specialists.**
6. **Why contracts assign privileged machine work that subagents cannot perform.**
7. **How late-context degradation amplified every mistake.**

*(Q6 has a worked instance already: WO-07 Amendment 3 — registration is Mack's declared seam under its own contract and Warwick's C-3, and the runtime forbids a subagent from doing it.)*

### What to design — the smallest prevention, seven targets, his

1. **Worker boundaries available at the REASONING stage** — not discovered at read-back.
2. **Envelope first; route and evidence INSIDE it.**
3. **One durable dispatch BEFORE work is described as running.**
4. **Accurate visible in-flight state, and automatic surfacing of a silent stop.**
5. **Privileged parent-only actions recognised BEFORE dispatch.**
6. **Implementation banked and rotated BEFORE assurance at punitive context sizes.**
7. **Veritas and Codex retained for genuine assurance, not document churn.**

### 🔒 PRESERVE — not a target for reduction

> *"Preserve the specialist refusal system: it caught real defects."*

**The refusals are the most valuable thing this phase produced.** They caught: an acceptance test that would have **passed by blocking**; a relocation that would have **silently killed the Deliverables sweep everywhere**; an instruction **reversing an approved governance redline**; a **seventh start path** that falsified a removal proof; a measurement that would have **false-passed the exact risk it existed to test**; and **two GL-012 breaches**.

> *"The target is **fewer preventably invalid dispatches, less admin, less elapsed time and lower token burn** — not fewer challenges or weaker evidence."*

### 🔴 PROHIBITED — the answer may not be any of these

> *"Do not create another checker, validator, control plane, role, registry or document family."*

**Six named prohibitions. BUILD-018 grew a validator → store → parser → registry around rules it never enforced, and this build has already needed the regrowth cap four times.** **The answer must be to REMOVE, SHORTEN, COMBINE or CHANGE what exists** — Warwick's exact verbs.

### Required output

**Recommend exactly what to remove, shorten, combine or change in the existing process — with MEASURABLE TARGETS for the next build.** The baseline table above is what those targets must beat.

### One uncomfortable candidate the investigation should test, recorded now while it is inconvenient

**The Work Order envelope may be causing the defects it exists to prevent.** Every refusal was an *envelope* defect — surface, authority, acceptance property — **not a defect in the described work.** The work was understood every time. **So the question is not "how do we validate envelopes better" (prohibited, and it is the BUILD-018 shape) but "is the envelope carrying fields that Larry cannot reliably author, and should those fields be derived, defaulted, or removed?"** **Target 1 — boundaries at the reasoning stage — points directly at this.**

## 15.4 Route — the fresh Larry's to own, not this session's

**Not designed here.** One thing worth noting so the next session does not rediscover it: token attribution must be honest about what the evidence **cannot** show.

⛔ **CORRECTED 2026-08-06 (Veritas `V5-1`) — the THIRD live Google Drive instance.** This paragraph also read *"the Google Drive write is an outward action needing its own consideration."* **There is no Google Drive write on this route.** The report is a **GIT artefact under `Deliverables/`**, produced inside `/rotate` — `.claude/commands/rotate.md` is the operative procedure and §17.5a is canonical. ⚠️ **Larry claimed this contradiction was "corrected in both places". That was a COMPLETENESS CLAIM and it was WRONG** — a third instance survived, in the very section describing the route for the artefact `/rotate` is about to produce.

---

## 14.15 🚨 AMENDMENT 2 to Phase 2 — Codex is part of Tower, and its operating law is in the wrong home

**Warwick, 2026-08-05, after Fable established it. A scope amendment, not a Phase 3 tangent — his explicit ruling.**

> *"Fable has established that Codex's live operating law currently sits in a BUILD-010 Tower artefact, while the current estate-wide reviewer and finding-disposition law does not necessarily reach the external Codex instance that Tower actually invokes. **I consider Codex part of Tower.** … I do not want Tower-related structural debt dragged beyond the upcoming UAT."*

### Why this is structural, not cosmetic — it contradicts this estate's own precedence

`runtime-manifest.yaml` records `qa_skill: 'Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md'`, *"loaded fresh + SHA-256 fingerprinted per turn"*. **But root `CLAUDE.md` precedence #4 states `Builds/` is *"the authority for build FACTS, never a route."*** Operating law — what a reviewer may do, how findings are dispositioned — is a route. **It is currently living in a home the constitution says cannot hold it, inside a build that Phase 2 has just retired.**

Compounding it: **`Builds/**` is on Keel's permanent NEVER-edit list**, so the estate's own implementer cannot maintain the file that governs its reviewer.

### The amended Phase 2 outcome — his words, binding

**Tower, INCLUDING Codex, must be permanently durable across builds and PRs.** Codex's authoritative operating law must:

| # | Requirement |
|---|---|
| **X-1** | Live in **the correct durable home** — not a retired build's artefact directory |
| **X-2** | Have **clear precedence** — a reader must know what governs when sources disagree |
| **X-3** | **Reliably reach the real external Codex invocation.** Not "exists in the repo" — *reaches the process* |
| **X-4** | Depend on **none of**: BUILD-010 archaeology · this Larry's context · a temporary instruction added only to make tonight's test pass |
| **X-5** | **Remain true for later builds without manual repair** |

### 🔴 Hard gate — binding on WP-2D

> *"Resolve that properly **before making the first live Codex call**."*

**NO live Codex execution until X-1..X-5 are integrated.** WP-2D is blocked. This also protects the three-per-gate Codex budget: a call made against the wrong law would burn one and prove nothing.

### The UAT becomes the permanent acceptance certificate

Not a smoke test. **Five properties, all in one run:**

1. Tower invokes Codex **against a real PR**.
2. Codex **receives the current authoritative law**.
3. It reviews **the exact Git and PR state** with the **relevant Veritas evidence**.
4. It **behaves within its proper boundary**.
5. **The real Codex/Larry exchange and disposition travel through the intended durable GitHub and TowerBot surfaces.**

**And: *"The same structure must remain true for later builds without manual repair."*** — so the UAT certifies the *structure*, not one lucky run.

### Scope discipline he attached, and I will hold to it

> *"I am not prescribing the implementation route, file layout or team allocation. Own that. **I also do not want a wider redesign for its own sake.** Nail the structural problem as part of Phase 2, integrate it, and only call Codex once the system being tested is the permanent one."*

**The regrowth cap applies with full force.** The temptation here is a reviewer-governance layer. **The answer is almost certainly to move law into a home the constitution already recognises and make the loader read it — not to build a new one.** Beyond the UAT he will accept *"evidence-led wording refinements"* — **wording, not a second restructuring.**

### New work package

| WP | Outcome | Blocks |
|---|---|---|
| **WP-2G** | Codex's authoritative operating law is in its correct durable home with clear precedence, and **provably reaches the real external Codex invocation** | **WP-2D. No live Codex call before this lands** |

**Design deliberately NOT settled here** — an investigation is establishing what actually reaches the external invocation today. **Deciding the home before knowing what is in the prompt would be exactly the archaeology-dependent guess this amendment exists to end.**

---

## 14.16 WP-2A — DELIVERED and integrated. Status by gate, no completion claim

**Larry may not declare this complete.** Veritas rules on the exact integrated head. What follows is what was delivered and evidenced.

| Piece | Owner | State | Head |
|---|---|---|---|
| Refuse guard, both entrypoints, exit 78 | Keel | delivered, `158` tower-baton tests, 0 fail | `5bf0c42` |
| Four machine-level removals | Mack | delivered; `schtasks /Run` → *"cannot find the file specified"*, **not** *"disabled"* | `7682114` |
| `Builds/**` resurrection procedures closed | **Larry** | delivered | `9e721e3` |
| Worktree deregistration + residue | Keel / Mack | delivered | `65bbf2b`, `cf40bd9` |

**S-2 composes from THREE evidence files and none may be read as the whole claim** — each carries a boundary statement naming what it does not cover.

### Two findings from this WP that outlive it

**The junction.** `C:\Fusion247PKA-tower\services\control-plane\node_modules` was a **junction into the LIVE tree** — the `node_modules` PID 31268 runs on, holding `better-sqlite3` and `pg`. **Any recursive delete following reparse points would have killed the runtime this phase exists to protect.** `git worktree remove`'s `Invalid argument` failure is what prevented it. **The map's "not a directory delete" instruction was right for a far weaker reason (a dangling admin entry) than the one that mattered.**

**And the enumeration hazard is the sharper lesson: `Get-ChildItem -Recurse` can follow junctions** — so a scan can enumerate the *live* tree while believing it is enumerating the stale one, and report *"safe to delete"* **from inside the thing it is protecting.** Mack replaced it with a stack walk that refuses to descend into a reparse point, and **mutation-tested that containment on a decoy** rather than trusting the documentation.

**Proof by arithmetic, not exit code.** After `rmdir`: directories **109 → 108**, files **462 → 462**. Exactly one thing went and nothing went through the link — had `rmdir` followed the junction, the file count could not have held. **A zero exit code would have proven none of that.**

### Residual, named not skipped

A real interactive logon remains the only complete proof and is **not required** under §14.0b · `C:\.fusion247` stays **un-enumerable** under any grant · the `tower-ding.mjs` referenced there is **still uncovered by any investigation** · the `schtasks` / `Get-ScheduledTaskInfo` disagreement **reproduced live and is unexplained** — deletions were ordered so it could not affect the outcome · a **38-character literal** in a `$key` variable inside the deleted launcher was **never read and is now unrecoverable**; the live Codex route's credentials are in `tower-baton.env`, intact.

---

## 14.17 WP-2G — what actually reaches Codex. **Traced 2026-08-05.**

### The deciding question, answered plainly: **NO. Root `CLAUDE.md` never reaches the Codex process.**

Established by exhaustive grep, not inference. No `readFileSync` of `CLAUDE.md` exists anywhere in the review path. `"Finding disposition and queue effect"` returns exactly **one** file in the whole repo — `CLAUDE.md` itself.

**And the `required_disposition` vocabulary does NOT come from it.** Three independent sources, none constitutional: the **`--output-schema` tmpfile** (`codexAdapter.mjs:102`) — a second, out-of-band law channel; a **hardcoded trailer** in `.mjs` source (`:245`); and **prose in the skill file**. *Codex could produce the vocabulary from the schema alone.* The appearance of compliance was never evidence of reach.

### 🚨 The skill file is a hand-copied paraphrase, and it has ALREADY DRIFTED

It says *"Only a qualifying finding may block OR trigger another round (Warwick, 2026-08-02)"*. **CLAUDE.md's canonical section additionally requires a blocking finding to NAME THE EXACT NEXT ACTION it would make unsafe, and carries the "Documentation blocks according to effect" clause and the adverse-verdict/queue-ownership clause. None of those three reach Codex.** Kept roughly in step by hand, with no mechanism to stay so. **This is the SSOT Golden Rule being broken in the one place it decides what a reviewer may block.**

### Byte-order of what Codex actually receives (live route)

1. **The entire bytes of `Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md`**, `.trim()`ed — **YAML frontmatter included; nothing strips it** · 2. the bounded packet (pointers, `head_sha`, `brief_excerpt`) · 3. the staged diff · 4. a **10-line hardcoded trailer** ending on the disposition rule. Out of band: `CODEX_RESULT_SCHEMA` via `--output-schema`.

### Four further findings, each worse than the one it follows

| # | Finding |
|---|---|
| **G-1** | **The route carrying almost all the law is TEST-ONLY.** `towerReview.mjs` composes three law files plus a *"THE BAR FOR BLOCKS_CURRENT_MERGE (Warwick, 2026-08-02)"* block — and `loadProductQaPrompt` has **exactly two call sites, both tests**. It also needs a Postgres `ops` schema that WP-2F just moved off. **The live routes carry the LEAST law.** This is the exact defect `productQaPrompt.mjs:3` was written to close — *"written but never WIRED into the runtime"* — **recurring one layer up** |
| **G-2** | **No CI job runs any assertion about the QA skill when the QA skill changes.** `tower-baton-tests.yml` filters on `services/tower-baton/**`, so `qaSkill.test.js` — **the one test asserting the shipped skill is ratified** — does not fire on a skill edit. `fusion-tower-tests.yml` fires but asserts nothing about it. **Set the skill to `status: draft` and every gate stays green** |
| **G-3** | **The live readers do a bare `readFileSync` with ZERO frontmatter validation.** The ratification check (`standing_use_ratified \|\| status === 'approved'`) exists only in **retired** code (`tower-baton/src/qaSkill.js`) and **test-only** code (`productQaPrompt.mjs`). **The degradation risk is not an absent file — it is unratified content running as law** |
| **G-4** | **The SHA-256 fingerprint is provenance, not a control.** Compared in exactly two places, neither checking currency — an idempotency skip and an immutability trigger. Asserted only as *shape* (`length === 64`), never against a known value. **And it is not computed at all on `reviewDiff.mjs`/`mergeCheck.mjs` — the preferred route.** Forensically useful, preventatively worthless |

**A stale pin already exists**, proving the hazard is live: `tower-runtime.test.js:368` asserts `tower-qa-skill@1(approved` while the shipped file's frontmatter is `version: 2`.

### Decision — durable home: **`services/control-plane/review/prompts/tower-qa-skill.md`**

Beside `reviewer-classification-amendment.md` and `product-qa-runtime-orientation.md` — governing texts with `status`/`governs_live` frontmatter, loaded fail-closed. **The estate already built the home for this artefact class; the file simply is not in it.**

> **⚠️ CORRECTION, 2026-08-05 (Keel).** This paragraph originally said *"already Warwick-approved governing texts"*. **That is FALSE for the second file.** `reviewer-classification-amendment.md` is `status: approved` / `governs_live: true`; **`product-qa-runtime-orientation.md` is `status: DRAFT — NOT YET WARWICK-APPROVED` / `governs_live: false`, and consequently does not govern.** The home decision stands — but it rests on the *directory* being the right class of home, not on both occupants being ratified. **And that DRAFT file is the worked precedent for R-3: AI-authored governing wording sits unratified until Warwick approves it.** Three properties fall out free: it leaves `Builds/**` (**X-1**, and Keel's path ban); it lands inside `control-plane-tests.yml`'s existing `services/control-plane/**` filter so **CI fires on a law edit with no workflow change** (**G-2**); and the loader default stops naming a build, so later builds inherit it (**X-5**).

### Alternatives rejected — including the obvious one, which is a defect

- **🔴 Injecting `CLAUDE.md` into the Codex prompt.** This is the intuitive answer and it is **wrong**: CLAUDE.md says *"You are Larry"*, and `--ignore-user-config`, the skill's own role boundaries and **both** codex adapters exist specifically to neutralise that persona. **`fableAdapter.mjs:33` records a real past persona leak through exactly that channel.**
- **Letting Codex read the law off disk itself** — `--sandbox read-only` blocks its file reads on Windows. Reach would be unprovable and machine-dependent.
- **Hiring Codex into `Team/<Name>/AGENTS.md`** — it is external, has no subagent shim, and `agent-index.md:39` deliberately lists it outside the specialist table. Warwick's *"I consider Codex part of Tower"* points at Tower's prompt directory, not the roster.
- **`Team Knowledge/Guidelines/GL-013`** — defensible on precedence, but needs a **new CI path filter** to make reach provable and separates the file from its two ratified siblings. Strictly more change for the same result.
- **A reviewer-governance layer / law registry / precedence engine / shared loader module** — the named wrong answer. **Even a shared constants module is regrowth: a seventh file to avoid six one-line edits.**

### How reach is proven with **ZERO Codex spend**

The seam already exists — `buildCodexPrompt` is a pure export, and `runMergeReview` already accepts an injected `spawn`. The test: **resolve the path by importing each loader's own exported constant, never by re-deriving it** *(a test that computes the path itself passes over a loader pointing elsewhere)* → assert the file exists, parses, and is ratified → drive `runMergeReview` with a **fake `spawn` capturing the exact bytes written to `child.stdin`** → assert a **sentinel sentence held as a literal in the test file** appears there. **Mutation half, without which it is not evidence: the same assertions must FAIL for `skillText: ''` and for an unratified fixture.**

**Stated honestly: this proves reach up to and including the bytes handed to the child process. Only the UAT proves the live external process consumed them.**

### ⚖️ The one part that is Warwick's — a `product-decision`

**The duplication cannot be resolved without editing root `CLAUDE.md`, which the hard rule on *"no silent constitutional self-modification"* reserves to Warwick with an exact redline and independent review. Larry may not self-waive that, even under "own the route".** Redline presented separately; the rest of WP-2G proceeds meanwhile.

## 14.18 🔴 WP-2G CLARIFIED — Warwick, 2026-08-05. **REWRITE the law, do not merely rehome it**

> *"**Do not merely rehome Codex's existing contract unchanged.** We already know that several parts of the live wording are stale, contradictory or capable of causing exactly the churn this phase is intended to remove."*

**This supersedes the "move the file" framing of §14.17.** The home decision stands; the *content* is now in scope, and §14.17's G-1..G-4 are evidence for why.

### PRESERVE — the valid core, named by Warwick

Genuine **external independence** · **read-only** operation · **exact-head and diff** evidence · **fail-closed** behaviour · **Veritas-receipt verification** · **bounded findings** · the **three-call ceiling**.

### RESOLVE — the seven required operating outcomes, binding

| # | Outcome |
|---|---|
| **O-1** | **Codex reviews the complete proposed PR or release head BY DEFAULT — not every implementation checkpoint.** Earlier review requires **explicit commissioning** |
| **O-2** | Its **durable control set** is: the exact **Git and PR state** · the **accepted Wayfinder outcome** · relevant **Work Orders** · **tests and CI** · applicable **Veritas receipts**. **ClickUp is NOT the source of authority** |
| **O-3** | **Codex is the external PR/release reviewer. It verifies that Veritas's internal assurance honestly applies; it does NOT routinely rerun the entire phase gate** |
| **O-4** | Findings block or trigger another round **only through active, reachable, in-scope MATERIAL EFFECT.** Minor, clerical, theoretical and optional findings are **reported once and parked** |
| **O-5** | **Codex returns a TECHNICAL VERDICT. Warwick retains merge and final acceptance.** **The existence of an upcoming merge must NOT itself force `DECISION_REQUIRED`** |
| **O-6** | **GitHub is the durable review and disposition surface. TowerBot is the outbound live viewing surface** for the actual Codex/Larry exchange. **ClickUp is not the control thread. Telegram has no inbound authority** |
| **O-7** | The real external invocation **reliably receives this law across later builds and PRs.** **Any fingerprint or provenance claim must prove WHICH CONTRACT WAS ACTUALLY DELIVERED — not merely compute an unused hash** |

**O-7 is a direct ruling on G-4.** Today's fingerprint is asserted only as *shape* (`length === 64`), never against a known value, and **is not computed at all on the preferred route.** A hash nobody compares is decoration, and Warwick has now said so in requirement form.

**O-1 and O-3 together explain the observed churn.** The watcher's per-checkpoint polling plus a reviewer with no stated deference to Veritas produces re-review of ground already assured — which is the *"disproportionate assurance work"* and *"repeated investigations"* the Phase 3 report is meant to detect. **The fix is in the law's wording, not in a new control.**

### Scope discipline, restated by him

> *"I am defining the outcome, not the implementation route, destination, file layout or team allocation. Own those. **Do not call Codex until the permanent contract and its real delivery path are integrated and proved offline.**"*

**The hard gate now has two halves: the contract AND its delivery path, both integrated, both proved offline.** The zero-spend reach test (§14.17) is the offline proof.

### The UAT certifies wording, not behaviour-on-the-night

> *"The upcoming live UAT must certify that permanent structure **and wording**, not a temporary dispatch instruction and not the known-stale BUILD-010 behaviour."*

---

### Unestablished — named

`tower-loop/prompts/supervisor-prompt.md` **reaches Codex on EVERY watcher turn**, is labelled `approved_by='ai-authored-unapproved'`, and carries **no** reviewer or disposition law — a second governing text with its own home and its own unapproved status, and **§14.15 does not obviously reach it** · whether the `@1` pin currently fails (DB-gated, not executed) · Fable's own prompt additions unexamined, though `buildFablePrompt` wraps `buildCodexPrompt` so a move affects it identically.

---

## 14.19 ⭐ THE CURRENT FRONTIER — single statement, 2026-08-05

**This is the ONLY place in this map that states the live frontier. §12 is Phase 1 history and says so.**

| | |
|---|---|
| **Phase** | **Phase 2 — Honcho and Tower as durable shared myPKA infrastructure.** ✅ **PASS. CLOSED.** |
| **Merge** | **PR #94 merged to `main` at `c21c3f3cfa5cdf8499d3972152bad6dc82986df3`**, guarded to the exact approved head `fec1c89ec1953c9ccad12d079d63f98929d248d6`, `merge-decision` by Warwick, 2026-08-05. PRs #91/#92/#93/#94 all confirmed present on `main` by content and ancestry, not by title. PR #80 (unrelated audit-only draft) closed without merging, history preserved. |
| **Veritas gate** | ✅ **PASS at `abb9892c950b0d673691849baed9220cbfe321d2`** — `Deliverables/2026-08-05-veritas-phase2-gate-receipt.md`. S-1..S-5 all proven by independent execution, not builder self-report. |
| **Delivered, integrated, live** | Honcho: dynamic map-pointer discovery (marker + git-recency, not hardcoded) · write-authority race closed (session-start-time comparison, not commit-recency — a first design using commit-recency was wrong and was corrected before shipping) · machine-level install at `~/.mypka/governor/`, hooks and statusline machine-wide, no per-worktree dependency. Tower: machine-level install at `~/.mypka/tower-runtime/` · autostart via `HKCU\...\Run` → hidden VBS → `start-tower.mjs` (the ONLOGON scheduled-task route was tried and is genuinely blocked by OS elevation — recorded, not worked around) · exactly one watcher enforced · legacy resurrection proven closed by attempt · PR discovery genuinely dynamic (GitHub-queried every round, no seed/pre-config, proven on a completely untouched PR) · polling rotation closes starvation past the poll cap · git-evidence resolution via `gh` removes the dependency on any specific mutable worktree · the real Codex/Larry exchange, under the ratified `tower-qa-skill.md` contract, proven live on TowerBot with real finding content and disposition rationale. |
| **Deferred, not fixed here** | Two pre-existing AsdAIr (BUILD-015) CI failures, root-caused to 2026-08-04 commits, explicitly out of Phase 2 scope per Warwick — `Deliverables/BACKLOG.md` row 11. |
| **Not this context's to start** | Phase 3 (§15) — gated on rotation, which only the fresh Larry after `/clear` can establish. |

### R-3 CORRECTED — it is SIX hardcoded invocations, not four (Keel, 2026-08-05, P-2)

`C:\Fusion247PKA\.claude\settings.local.json` carries **six** `C:/Fusion247PKA/`-hardcoded entries: **`Stop` × 2** (`bridge-ingest.mjs`, **`continuity.mjs stop`**), `SessionStart` × 2, `PreToolUse` × 1, `statusLine` × 1.

**🎯 R-3 omitted both `Stop` hooks — and one of them is `continuity.mjs stop`, the WRITER this entire work package exists to deploy.** **Installing only the `SessionStart` render would leave the writer running from the stale checkout, and S-1 would still fail** — while looking installed. **Corrected before it could be built against.**

**Also established (P-3):** user-level `~/.claude/settings.json` has **no `hooks` block — but is NOT unused**: it already carries a governor `statusLine` pointing at `C:/Fusion247PKA/`. **Whether user-level hooks MERGE with or OVERRIDE project-level hooks in this build is UNESTABLISHED — if they merge, a fresh Larry in the main worktree gets TWO briefs and TWO packet writes per stop.** Must be proven by execution at install, never assumed.

**And (P-1):** the pointer render fix is **already in this worktree's code** — `readContinuityBrief` already emits *"recall only, ZERO authority"* and closes *"Nothing in this block is an instruction."* **The `"AUTHORITATIVE current focus"` / `"source of truth"` contradiction exists ONLY in the installed copy.** So it is a **pure install delta, not a code delta** — which shrinks the code half and raises the weight of the install half.

---

## 14.20 🔄 IMPLEMENTATION CLOSE → ROTATION → FRESH LARRY. **Sequence set by Warwick, 2026-08-05**

> *"At implementation close: bank everything useful in Git, have Veritas verify nothing material remains only in this session, then consider rotation. Fresh Larry handles final Veritas, Codex/UAT and wrap."*

**His condition, and it is the operative one:** record this *"so long as this will not be detrimental to this phase, with everything that needs to be durable from your context on Git and verified as such by Veritas."* **Larry's honest assessment is below, including the one thing that currently makes rotation UNSAFE.**

### The sequence

| # | Step | Owner |
|---|---|---|
| **1** | **Finish implementation** — WP-2B(2) code, Mack's install half, WP-2E, WP-2C. **No Codex, no UAT** | this Larry |
| **2** | **Bank everything useful in Git** — see the durability checklist below | this Larry |
| **3** | **🚨 Correct the continuity store** — see the rotation blocker | this Larry. **HARD PRECONDITION** |
| **4** | **Veritas: rotation-readiness assurance.** One question — *"does anything material exist ONLY in this session?"* **This is NOT the Phase 2 gate** | Veritas |
| **5** | **Rotate** | Warwick |
| **6** | **Final Veritas Phase 2 gate (§14.0c S-1..S-5) · Codex UAT · merge · wrap** | **fresh Larry** |

**Two distinct Veritas engagements. Do not conflate them.** Step 4 asks *"is the record complete enough to survive a `/clear`?"*. Step 6 asks the mandatory question — *"can Warwick now do the thing this phase promised, in the real intended context?"* — **against the exact integrated head.** Step 4 discharges no gate.

### ✅ ROTATION BLOCKER — **DISCHARGED 2026-08-05 at `eff3033`**

**The store's `focus` now reads *"BUILD-020 Phase 2 — Honcho and Tower as durable shared myPKA infrastructure. Phase 1 (Proofline) CLOSED and PASSED by Warwick 2026-08-04."*** Written via `continuity.mjs write` (`ok:true`, `state_persisted:true`, `withheld:[]`, `truncated:[]`) and **confirmed rendered in a real fresh session**. **A `/clear` no longer hands a fresh Larry a BUILD-015 orientation.** Step 3 of §14.20 is complete.

**The original blocker, retained because the reasoning is the durable part:**

### ~~🚨 THE ROTATION BLOCKER — rotating today would be actively harmful~~

**`~/.mypka/governor/continuity.json` still says `focus: "BUILD-015 AsdAIr live-acceptance recovery…"`, 30+ hours stale, with `next_action` a full imperative BUILD-015 Gate 3 procedure.**

**So a `/clear` performed right now hands the fresh Larry a confident, wrong orientation to the wrong build** — the exact failure the rotation block at the top of this map warns about, and the exact failure W-1 names. **`focus` is a PERMITTED, ALREADY-RENDERED field: no code change suppresses it. Only correct data fixes it.**

**Therefore step 3 is a hard precondition of step 5, and it is an operational act, not a code change.** WP-2B(2) and Mack's install make the pointer *robust*; **they do not make the stored content *true*.**

### Durability checklist — what must be in Git before step 4

Larry's assessment of what currently exists **only** in this session:

| Item | State | Action |
|---|---|---|
| Decision reasoning (why SQLite, why refuse-not-delete, why DRAFT, why Option 1) | **In commit messages and the map.** Durable | none |
| Work Orders and every amendment | **On disk, committed.** WO-01..WO-06 | none |
| Executed evidence per work package | **Committed** under `Deliverables/proofline/` | none |
| **The refusal ledger** — six Work Order refusals, every one class-A, every one a defect in Larry's order | **⚠️ PARTIAL.** Scattered across amendments and commit messages | **§14.21 — write it out once** |
| Warwick's decisions and their exact wording | **In the map** (§14.0, §14.13, §14.15, §14.18, §15.3a/b) | none |
| **Outstanding work and its exact shape** | **§14.19** | keep current |
| The Codex contract awaiting ratification | **Committed, DRAFT** | Warwick reads it |
| **Open items needing Warwick** | ratify contract · re-bind `prompt-approvals.json` hash · `merge-decision` | **listed in §14.19** |

### Is rotation detrimental to this phase? — Larry's honest answer

**No, PROVIDED steps 2–4 complete first — and it is positively beneficial for step 6.** The Codex UAT and the final Veritas gate are the most context-expensive work remaining, and they are exactly the work that benefits from a clean context reading a complete record rather than a long transcript.

**The genuine risk is not lost facts — it is lost *judgement about what was nearly wrong*.** Six refusals corrected six defects in Larry's orders; a fresh Larry who does not know that pattern may reissue one. **§14.21 exists to make that pattern durable rather than remembered.**

---

## 14.21 The refusal ledger — durable, because it is the Phase 3 input most likely to be lost

> **⚠️ CORRECTED 2026-08-05 — this ledger UNDER-COUNTED, and Veritas caught it.** It said "six" and claimed *"EVERY ONE"*, while `WO-07` line 67 — written by Larry — says *"seven orders have been refused or held."* **The seventh, Mack's `REFUSE` on WO-07, was absent entirely, as were its Amendments 2 and 3.** Grounds were understated throughout (WO-02: 3 of 5 · WO-03: 5 of 7 · WO-05: 3 of 7), and the derived statistic *"five of six involved a surface field"* was void at seven. **Nothing was softened or misattributed — every entry named Larry as the author of the defect. The failure was completeness, and a false "EVERY ONE" is what would stop a fresh Larry looking for the seventh.** *This is the Phase 3 input most likely to be self-serving, which is exactly why it was sent to be challenged.*

**SEVEN Work Order refusals/holds in Phase 2. Every one was class-A: a defect in Larry's ORDER, not in the proposed work. None was a worker declining work it should have done.**

| # | WO | Refused by | The defect — Larry's |
|---|---|---|---|
| 1 | WO-01 Honcho writer | Keel | **No `file_surface` declared** — the worker's one absolute rule had nothing to bind to; 7 further envelope fields missing |
| 2 | WO-02 canonical store | Keel | **`private_surface` = the SECRETS-STORE ROOT** (GL-012 breach) · an acceptance criterion that would have **spawned a real Codex run and sent two Telegram messages to Warwick** · `node_modules` absent so no evidence command could run |
| 3 | WO-03 legacy removal | Keel | **`Builds/**` in a surface the contract permanently bars** · `live_authority: BOUNDED`, not a permitted value · **scheduled-task work belonging to Mack** · `private_surface` = the secrets root **AGAIN** · **and a SEVENTH start path that falsified the acceptance property** |
| 4 | WO-04 machine removal | Mack | A condition requiring a check **the same order's own prohibition forbade** · an acceptance property claiming **eight paths from a four-path proof** — *the exact defect that had just refused WO-03, repeated one order later* |
| 5 | WO-05 Codex contract | Keel | **`Builds/**` again** · **a reach test that would have passed BY BLOCKING in CI** — the false green the WP existed to kill · ratification left to a worker who may not ratify |
| 6 | WO-06 Honcho render | Keel | **`live_authority` not `none`** · acceptance property unreachable in surface · **the first dispatch was IN-PROMPT ONLY, with no Work Order on disk — an order that lives only in Larry's context dies with the session, the exact failure S-5 exists to rule out** · **and `CLARIFY`: an instruction that reversed an approved governance redline by writing code** |
| **7** | **WO-07 Honcho install** | **Mack** | **`REFUSE` on FOUR grounds, then `BLOCKED`.** **D1: relocating `reorient.mjs` would have SILENTLY killed the Deliverables sweep machine-wide** — invisible to every acceptance test in the order · **D2: the acceptance property measured packet writes, which the Stop-path dedupe makes blind to a double-fire — a false pass on the exact risk it existed to test** · D3: `network`/`credential_scope` declared `none` while the required evidence fires a hook that POSTs and reads a credential at runtime · D4: two conflicting governance heads. **Then Amendment 2: the SHAs Larry named would have DEPLOYED THE DEFECT the amendment existed to prevent.** **Then `BLOCKED — required-but-unavailable`: every machine path is refused by the host classifier when the actor is a subagent, so the contract assigns work the harness forbids** |

### The patterns, stated plainly for the Phase 3 report

1. **Surface declaration is Larry's weakest discipline.** `private_surface` at the secrets root **twice**; `Builds/**` in a barred surface **twice**; a missing `file_surface` once; `live_authority` set to a value the contract forbids **twice**. **Five of SEVEN refusals involved a surface or authority field** *(statistic recomputed 2026-08-05 — the original said five of six and was void).*
2. **Larry writes acceptance properties that outrun the surface** — eight paths from four, an end-to-end run that needed spend, a live-store write forbidden by the same order.
3. **Repeating a defect he had just documented.** WO-04 reproduced WO-03's over-claim; WO-05 and WO-03 both put `Builds/**` in a Keel surface.
4. **Treating a specialist recommendation as authority** (WO-06) — *"a previous instance's standing buys this one nothing"* was the worker's correction, and it was right.
5. **Larry's own instruments were wrong twice, and workers caught both** — a mutation harness that reported four mutations applied when they had not (CRLF anchors), and a second whose predicate mis-scored an insert-shaped mutation. **A false green inside the instrument used to detect false greens.**
6. **The refusals were cheap and the defects were not.** Each cost one round trip; three would have shipped a false green, a governance reversal, or an incomplete removal that read as complete.

**No mechanism is proposed here. Phase 3 decides whether this is a Larry defect, a template defect, or a missing pre-dispatch check — and *"build a checker"* is the diagnosis Warwick has already rejected once.**

---

## 14.11 Evidence status — §14.6 discharged

All three investigations have landed and their findings are recorded above. **WP-2A, WP-2E and WP-2F may now be issued as Work Orders.** WP-2B(1) is issued and amended (`WO-2026-08-05-01`, Amendment 1) after a correct class-A `REFUSE`.

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

---

# 16. PHASE 3 — THE ROUTE. **Scope FIXED by Warwick, 2026-08-05. Build to the Star.**

> **⭐ THIS SECTION IS NOW THE LIVE FRONTIER. §14.19 is Phase 2, CLOSED and MERGED.**

**Warwick fixed this scope himself and closed the scope conversation:** *"Do not bring me another scope decision unless a genuine product decision or unavoidable permission boundary remains."* **The map records the route; it does not re-ask for acceptance of a scope he has just written.**

## 16.1 North Star — unchanged, his

> **"The process exists to ship trustworthy products quickly, not to produce immaculate paperwork about why they have not shipped."**

**Phase 3 is no longer a forensics-report phase.** The token/process report (§15.2) is **superseded as the deliverable** by his fixed scope below. §15.3a–d remain valid *evidence and investigation inputs*, and §15.3b is now WP-3C.

> ## 🔄 REACTIVATED 2026-08-06 — **the supersession above is REVERSED by Warwick**
>
> **His instruction: *"Reactivate the §15.2–§15.3d phase-close report as part of this work package."*** **§15.2's report is a DELIVERABLE again**, folded into the Phase 4 work package and sequenced in **§17.5**.
>
> **The paragraph above is retained, not deleted, because it is the true record of what was decided on 2026-08-05.** It is no longer operative. **§17.5 governs.** ⚠️ **Do not read the supersession as live** — this is the exact three-competing-frontiers defect §12 was corrected for, and the reason the reversal is recorded here rather than by quietly editing the sentence away.

## 16.2 Acceptance — his four. Nothing here is Larry's to soften

| # | Acceptance property |
|---|---|
| **AC-1** | **Honcho independently supplies the correct active map and current frontier** |
| **AC-2** | **Larry states and begins the correct next action without Warwick reconstructing or selecting the route** |
| **AC-3** | **The governor returns an accurate measured context and a sensible model recommendation at substantially reduced measured cost** |
| **AC-4** | **The fresh session returns a cleaned list containing only proper candidate jobs** |

**AC-1, AC-2 and AC-4 are proven only by the real fresh session after rotation, started with the single word `Continue`.** That is the acceptance test and it is Warwick's, not a builder's self-report.

## 16.3 Work packages

| WP | Outcome | Owner | Surface |
|---|---|---|---|
| **WP-3A** | **Fix Honcho properly** — (a) reliable current-frontier read at present **and expected** store size · (b) correct `map_path` delivery · (c) **no fail-open write-authority guard** · (d) a stale or degraded fallback **identifies itself as stale AND still orients to the map** | **Keel** | `tools/governor/continuity.mjs` + its test |
| **WP-3B** | **Fix the governor footer properly** — (a) return a **measured** context number · (b) **inspect the remaining work in the active phase** and recommend the appropriate model · (c) **no specialist reading an 82 KB module for one status line** · (d) **benchmark before and after, proving a reduction of at least an order of magnitude** from the observed ~79k tokens/render | **Keel** | `tools/governor/footer.mjs` + its test |
| **WP-3C** | **The Nolan gap — RESEARCH AND EVIDENCE ONLY.** What responsibility Nolan previously performed · why its absence resulted in Keel writing contracts or Work Orders · which exact ownership/routing gap existed · the smallest correction restoring the intended separation **without creating another governance layer**. **Do not implement from inference** | **Pax** | one brief |
| **WP-3D** | **Clean the candidate queue** — remove resolved, superseded, duplicated and non-actionable entries · **remove AsdAIr work, explicitly deferred** · remove parked maintenance not advancing the active Star · retain **only genuine, evidenced candidates** | **Larry** | this map's SHIT TO DO · `Deliverables/BACKLOG.md` |
| **WP-3E** | **Machine-level install of WP-3A/WP-3B** — the fixes are inert until the installed copy at `~/.mypka/governor/` carries them | **Mack** | `~/.mypka/**`, hook registration |

## 16.4 🔴 PROHIBITED — his words, and they bind every work package

> *"Do not attempt another generic Work Order template, validator or checker repair in this phase."*

**And the standing six from §15.3d:** no new checker, validator, control plane, role, registry or document family. **The verbs are REMOVE, SHORTEN, COMBINE, CHANGE.**

**The two first-pass refusals of this phase (WO-10 and WO-11, both `CLARIFY`, both class-A defects in Larry's orders) are RECORDED AS UNRESOLVED EVIDENCE — not as a problem to fix now.** Warwick: *"use Pax's Nolan research to determine the actual missing ownership before proposing anything."* **Any attempt to fix Larry's dispatch quality with a mechanism before WP-3C reports is the rejected diagnosis.**

## 16.5 Evidence already in hand — WP-3A and WP-3B start from measurement, not theory

**All executed evidence from the 2026-08-05 investigation, committed under `Deliverables/proofline/EVIDENCE-2026-08-05-honcho-regression.md` and `Deliverables/2026-08-05-pax-honcho-regression-brief.md`.**

| # | Established | Consequence for the build |
|---|---|---|
| **E-A** | **No code regression.** Timeout, `AbortController` and the `UNAVAILABLE` string unchanged since `421053b` (2026-08-01) | **Do not go looking for a broken commit. There isn't one** |
| **E-B** | **Page-1 latency: 884 / 747 / 244 / 237 / 430 / 381 / 216 / 387 / 223 / 648 ms — 10 of 10 succeeded, worst case 9.8% of the 9,000 ms budget** | **The 20:4x abort was a TRANSIENT. "Growth met the constant" is NOT established** and must not be built against as if it were |
| **E-C** | **Page 1 is already at the `size:100` cap** (`items:100, total:149, pages:2`, `content_bytes:420310`). Further growth adds **pages**, not page-1 items — **and later-page failures are swallowed, not raised** | **This is the real "expected store size" risk in WP-3A(a)**, and it is a *silent* one |
| **E-D** | **`map_path` stripping is LATENT, not LIVE.** From seq 144 on, 9 of 9 carry it | Nobody is misdirected today |
| **E-E** | **n = 1 under the guard, and that one is the masked case.** Only seq 152 was written with the guard active, inside the timeout window where it falls open | **The census cannot distinguish benign from masked. WP-3A(c) must not rest on it** |
| **E-F** | **The two defects PARTIALLY MASK EACH OTHER** — when `readLatest` inside `writeContinuity` times out, the guard fails open and `map_path` is **kept**. A slow Honcho *suppresses* the stripping defect | **Two faults that hide each other are invisible to component testing AND to a single end-to-end sample.** The phase's central test-design lesson |
| **E-G** | **Seq is 152; only 149 packets are stored.** `nextSeq()` increments before delivery → **three packets were built and never landed, and nothing logged any of them** | **This is why 20:4xZ is permanently unrecoverable.** Recorded as an observation |
| **E-H** | **The dedupe suppresses a Stop write when semantic state is unchanged**, so nothing has been written since seq 152 despite ~40 min and many Stops | **⚠️ The stripping defect can only fire when a packet IS written — and the next write is AT ROTATION.** Latent because nothing is happening; live at the worst possible moment |
| **E-I** | **`writeContinuity:596-612` runs a full `readLatest` inside the write path**, in a `catch` that falls back to an unconditional write | Doubles network work per session end, and **disables the guard exactly when the read is slow** |
| **E-J** | **The success render already carries age and an orientation line; the `:932-933` failure branch carries neither**, despite having parsed `updated_at` | **WP-3A(d) is a small change on a branch that already holds the data** |
| **E-K** | **No governor log exists anywhere under `~/.mypka/**`** (verified negative; only Tower's `watcher.log`, a different subsystem) | Nothing can be reconstructed after the fact |
| **E-L** | **The ~79k/render footer cost is Larry dispatching a specialist that READS an 82 KB module.** A subagent's floor is well above the target | **WP-3B(c) cannot be met by a cheaper subagent prompt. The render must not require a subagent at all** — see §16.6 |

## 16.6 ⚖️ The one CONSTITUTIONAL boundary in this phase — flagged, not decided by Larry

**Root `CLAUDE.md` states the footer "is rendered by a dispatched specialist running `footer.mjs` … and Larry pastes those exact bytes."** Warwick's WP-3B(c) — *"do not dispatch a specialist to read an 82 KB module for one status line"* — **cannot be satisfied while that clause stands**, because a subagent's floor cost is far above the order-of-magnitude target.

**Larry may NOT silently amend root `CLAUDE.md`** (*"No silent constitutional self-modification"*). So WP-3B delivers the cheap route **and an exact proposed redline**, which requires Warwick's explicit approval and independent review of the resulting patch. **This is a permission boundary, not a scope question** — the one category he left open.

## 16.7 Route and gates

| # | Step | Owner |
|---|---|---|
| 1 | WP-3A · WP-3B (isolated worktrees) · WP-3C in parallel | Keel ×2, Pax |
| 2 | WP-3D | Larry |
| 3 | Integration at a single head | Larry decides · Keel executes |
| 4 | **WP-3E machine install** | Mack |
| 5 | **Veritas on the EXACT integrated head.** *"Phase 3 does not pass on builder evidence"* | **Veritas** |
| 6 | Merge through the normal guarded PR route | **Warwick** (`merge-decision`) |
| 7 | **Rotate immediately** | Warwick |
| 8 | **Fresh session started with only `Continue`** — AC-1, AC-2 and AC-4 are proven here or not at all | **Warwick** |

**Before Veritas passes the integrated head, the maximum permitted statement is:** «Integrated at "&lt;SHA&gt;" and submitted to Veritas for assurance.»

## 16.8 Frontier

**Phase 3, step 1. Branch `build-020/phase3`, cut from `83cd6ae`. Worktree `C:\Fusion247PKA-build-020-trial`.**

**Verify HEAD by execution before trusting any SHA in this file — it has been wrong three times.**

---

## 16.9 ⭐ WP-3F — Nolan restored to the Work Order loop. **APPROVED by Warwick, 2026-08-05**

**This was not in the original Phase 3 scope. It arrived because WP-3C's research produced an answer Warwick then ruled on, and it is recorded here so the route is not reconstructed later from memory.**

### What he approved — Option A, his words

> **"Approved: restore Nolan to the Work Order loop using Pax's Option A.**
>
> **Larry drafts. Nolan performs one bounded Class-A pre-dispatch check. Nolan does not rewrite the order, investigate implementation or run a broad repo audit. He reads the final envelope, target specialist contract/shim and only the directly applicable rules, then returns PASS or concise exact corrections.**
>
> **Update the four coherent routing points Pax identified: Nolan's contract, SOP-022, agent-index and Nolan's shim. Preserve Larry's route and dispatch authority, Veritas post-integration QA and Codex PR/release QA. I ratify governing contract changes.**
>
> **Use a cost-appropriate model and measure the check. Acceptance is three consecutive real orders reaching specialists without a Class-A refusal, at materially lower cost than the refusal/rework pattern."**

### Why it survives the regrowth cap — and this is the whole reason it is permitted

**Option A hires nobody and builds nothing.** Pax established that **the procedure already exists and is already mandatory**: SOP-022 carries the pre-dispatch compatibility check, the envelope-first rule, the five questions and the class-A taxonomy. **It assigns class A to Larry** (`:344`) and tells him to *"preflight your own Work Order before issuing it"* (`:352`). **All thirteen BUILD-020 class-A refusals happened under that assignment.**

**The correction is a CHANGE OF ACTOR — one of Warwick's four permitted verbs.** No new role, registry, document family, validator or checker.

### The finding that made it necessary

**The responsibility was not merely unformalised — it was formally DE-ASSIGNED.** `Team/agent-index.md:42-45` records the build-team table *"previously read 'Independently audits — **Nolan**'"*, changed by **`f78d121` (`GOVERNANCE-VERITAS-HIRE`)**, 2026-08-04, on the explicit grounds that his contract did not cover it. **The replacement is contractually barred from the half that was lost** — *"no pre-inspection of a Work Order before implementation"* — and the Veritas gate fires **after integration**. **BUILD-020's Work Orders begin the same day.** Correlation with a named mechanism; **causation not proven, and Pax says so.**

**The anti-pattern in one line (Pax):** the estate had the independence boundary missing at **both** ends — Keel barred from authoring the law governing its own work, while **the issuer was the sole author *and* the sole checker of the envelope.**

### AC-5 — the new acceptance property, and it is FORWARD-LOOKING

| # | Acceptance property |
|---|---|
| **AC-5** | **Three consecutive real orders reach specialists without a Class-A refusal, at materially lower cost than the refusal/rework pattern** |

**AC-5 CANNOT be met inside this phase's implementation, and no receipt may claim it is.** It needs three real orders. **WP-3F delivers the route and the measurement; the acceptance accrues from the next dispatch onward.**

**Baseline to beat, measured 2026-08-05: 13 class-A refusals across 15 orders**, each costing a full round trip and several costing two.

### Provenance recorded honestly

**`WO-2026-08-05-15` is the last Work Order issued under the old route, by necessity — the check it creates does not yet exist.** **The first real class-A check is on the WP-3E install order for Mack.**

### Route addition

| # | Step | Owner |
|---|---|---|
| 1b | **WP-3F — Nolan drafts the four-point redline** as a ready-to-apply proposal (SOP-001 §7) | **Nolan** |
| 5b | **Warwick RATIFIES the governing contract changes** — his reservation, not Larry's to assume | **Warwick** |

**The redline reaches `main` only through Warwick's ratification plus the independent review already on this phase's route — Veritas on the exact integrated head, and Codex at PR level.** Larry does not apply it on his own authority.

---

## 16.10 Continuity published live — 2026-08-05, and the design defect it exposes

**Warwick, 2026-08-05:** *"Do not defer the continuity refresh until merge. Publish the truthful current Phase-3 state now through the installed production write path… Also record the remaining design defect for this phase: material frontier changes must trigger continuity."*

### Packet 1 of 2 — published and read back

**Written through the INSTALLED production path** (`~/.mypka/governor/continuity.mjs write`), not a repo copy: `state_persisted: true`, `withheld: []`, `truncated: []`.

**Read back immediately through the INSTALLED renderer:**

| | |
|---|---|
| Packet | `cont-1785971013511-153-6svm8`, **content age 0h 0m** |
| Focus | **BUILD-020 Phase 3** — no longer Phase 2. **The stale orientation is gone** |
| Map pointer | **present** — `Deliverables/2026-08-04-proofline-wayfinder-plan.md`. The write-authority path resolved rather than failing open, and did not strip it |
| Seq | 152 → **153** |

**A second packet is owed after merge**, carrying the merged SHA and the fresh-session next action, read back before `/clear`.

### ⚠️ Observation, recorded not assumed

**`continuity-last.json` still names packet 152 after 153 was written and read back.** Packet 153 is retrievable from Honcho, so it landed. **Whether the last-delivered marker is `stop`-path-only by design, or whether this is a gap, is UNESTABLISHED.** Not chased — recorded.

### 🔴 THE DESIGN DEFECT — Warwick's, and it is the one that matters

> **Material frontier changes must trigger continuity.**

**Today the continuity write is a Larry habit, not an event.** Nothing fires it. The packet sat **13 hours stale** through an entire phase of work — correct map pointer, wrong phase — and only moved because Warwick instructed it explicitly. **That is the same shape as every other compensating habit this estate has recorded: bound to a person remembering, not to an event, and therefore a dated liability.**

**The five events are already named** (§16.3 WP-3B / Warwick, 2026-08-05, for the recommendation cache): active frontier changes · next Work Order changes · phase boundary changes · context crosses a threshold · handback state changes. **The same trigger set applies here, and the cache half of it was already built in WP-3B.**

**Recorded as a defect, NOT dispatched.** It is out of this closure's scope, and **the regrowth cap applies at full force** — the answer is a trigger on an existing write path, never a new mechanism, daemon or watcher.

### Durable estate facts banked from this closure

- **Subagent writes to `~/.mypka/**` now SUCCEED** (Mack, probed and cleaned up, WO-16). **WO-07 Amendment 3's `BLOCKED — required-but-unavailable` is SUPERSEDED.**
- **The governor runtime carries governance head `696d4498`**, 8/8 byte-identical to the git blob, rollback executed and proven on a file with a real delta.
- **WP-3B's fix is observable in the product, not only in a hash:** the pre-fix copy renders `ctx 44% · GREEN` with **no figures**; the fixed copy renders `ctx 44% (440.1k/1000k)`.
- **`MessageDisplay` exists in host 2.1.222** with a completed-message path — the claim that no hook could ever render the footer was false as to mechanism. **Whether it reaches web/Android was never established and Warwick has closed the question.**

---

## 16.11 ⭐ PHASE 3 MERGED — and the exact fresh-start contract

| | |
|---|---|
| **MERGED SHA on `main`** | **`f242f3c8d1df6017dbe11b751cee12564b467517`** — PR #96, Codex waived on explicit Warwick authority, this occasion only |
| **Gate** | **HOLD, and NOT a Phase 3 PASS.** Veritas HOLD at `6858327`; its one blocking finding **D-1 DISCHARGED** at `f542de0` by narrow replay. **D-2..D-6 parked.** Larry records no PASS |
| **Runtime** | `~/.mypka/governor/` reinstalled from the merged head, 8/8 byte-identical to blob, rollback executed on the only file with a real delta |
| **Delivered** | Honcho write-authority repair (guard now asks WHO, not only WHEN) · governor footer RETIRED from the message stream · Work Order envelope generator (`tools/wo/`) · cleaned candidate queue · `/rotate` restored |

### THE NEXT ACTION for the fresh session — do these in order

1. **Fix the DevBot ding credentials.** `C:\.fusion247\larry-ding.mjs` returns `{"ok":false,"why":"missing token/chat (names only)"}` — the script is fine, the credentials are not loaded. **Warwick cannot be reached at all until this works**, and he asked for it directly. **Declare the private surface properly; it is the secrets-store root and GL-012 binds.**
2. **Ding rule, his words:** ding for a decision or action needed, **and** for a substantive update **even when no action is required**. **Never** for routine commentary.
3. **Then issue the next real Work Order through `tools/wo/envelope.mjs`** — the first live acceptance test of the generation repair. **Report whether it reached the specialist without a preventable class-A refusal.**

### Parked, deliberately, so it is a decision and not an omission

**D-2..D-6** (Veritas) · **the Nolan actor-change proposal**, unratified at `c2ebda4`, **do not merge or amend** · **C-1..C-15** in `Deliverables/BACKLOG.md` · **the eighth generator field** that would close the order-not-at-its-own-head defect · **frontier-change-triggers-continuity**, §16.10 · the 318-vs-331 neighbour count.

---

# 17. ⭐ PHASE-COMPLETION CONTRACT — set by Warwick, 2026-08-06. **THIS IS NOW THE LIVE FRONTIER.**

> **His instruction, verbatim in effect:** *"record that before this phase finishes, the following must all be complete and verified true."* **Some of it may already be done. Nothing here is complete on assertion — each line is complete only when verified true.**
>
> **Also his, and it binds the route:** *"Do not offer an option menu and do not reopen completed Honcho work unless the fresh-session journey itself fails."* **The 2026-08-06 fresh-session journey did NOT fail** — orientation recovered this map and the frontier from the Honcho pointer with `Continue` as the only input. **Honcho is therefore CLOSED and is not to be reopened.**

## 17.0 What this session had in flight when the contract arrived — stood down, recorded not buried

| | |
|---|---|
| **In flight** | A Work Order for **C-11** (`notify-snapshot-consumers.yml` permanently red by design) was drafted for Keel and **not dispatched** |
| **Stood down because** | JOB 1 requires the authoring route to be repaired **before** the first real order, which is the acceptance test. Dispatching C-11 on the unrepaired route would have **spent the acceptance test** on it |
| **Genuine preflight catch, retained as evidence** | Keel's contract permits `.github/workflows/<service>-tests.yml` — **`notify-snapshot-consumers.yml` is not that shape.** A class-A contract conflict caught **before** dispatch, not discovered after. **This is the preflight working, and it is exactly the defect class JOB 1 §2 must generate rather than leave to prose** |

## 17.1 JOB 1 — finish the Work Order authoring repair

### The ratification boundary — restated because it is the thing most likely to be quietly re-crossed

**The Nolan-per-order checker proposal remains PARKED and unratified at `c2ebda4`. Do NOT merge, recreate or apply it.** No Nolan contract, SOP-022 actor, `agent-index` or shim change is authorised. **The Phase-3 branch independently verified zero governing Nolan changes.** **Nolan remains an occasional structural/audit role, never a routine checker on every Work Order.**

**This supersedes §16.9's approved-Option-A route as a thing to implement.** §16.9 records what was approved on 2026-08-05; **2026-08-06 parks it unratified.** The later instruction governs.

### What exists today — established, not assumed

| # | Fact |
|---|---|
| **J1-a** | `tools/wo/envelope.mjs` **deterministically copies** canonical tools, surfaces, standing authority defaults, git authority, worktree state and producible-evidence constraints |
| **J1-b** | It correctly fails unknown fields as `UNRESOLVED` |
| **J1-c** | It prevents **11 of 41 scored historical defects — 27% BY DEFECT**, while touching **8 of 13 affected orders — 62% BY ORDER**. ⚠️ **Warwick: *"Never quote either rate without its unit."*** The two numbers measure different things and a bare "27%" or "62%" is a misreport |
| **J1-d** | It does **NOT** reach acceptance-property or reasoning defects |
| **J1-e** | It has **no automatic production caller** and currently depends on **Larry remembering** to invoke and use it |
| **J1-f** | **The first genuine Work Order after this respawn is the initial live acceptance test** |

### The eight requirements — all must be complete and verified true

| # | Requirement |
|---|---|
| **J1-1** | Canonical envelope generation is an **unavoidable part of Larry's ordinary dispatch route** — not a remembered optional command. ✅ **CLOSED 2026-08-06** outside `tools/wo/**`: SOP-022 § Ordinary dispatch route requires the ORDER_MARKER; workers REFUSE unmarked orders; issuer must run `tools/wo/envelope.mjs` then `--count-markers`. WO-18's provenance header remains the detectable origin evidence. **Not** closed by WO-18 alone (that history stands). **Closing was the route change outside tools/wo.** Prior text: OPEN, and explicitly NOT closed by WO-18. Keel's read-back established that `tools/wo/**` cannot close it: every acceptance criterion there is satisfiable by manually invoking the tool. WO-18's `outcome` amended to declare a **manual** deliverable. What WO-18 *does* contribute is a **provenance header** on every emitted order so a hand-authored order is **detectably** not generated. Historical note (superseded for status only): Closing J1-1 needed a route change outside `tools/wo/**`, and the standing prohibition on new checkers, actors, services and governance layers constrains what is permissible. Larry does not invent one; it is reported here** |
| **J1-2** | **`contract_basis` is GENERATED** from canonical contract/surface extraction, not authored prose |
| **J1-3** | **Standing defaults are not retyped.** Orders carry **only authorised deviations**, each explicitly escalated |
| **J1-4** | **The Work Order exists at the governance head it declares BEFORE the worker is dispatched** |
| **J1-5** | Larry authors **only** the variable outcome, scope, acceptance, evidence and sequencing |
| **J1-6** | A **same-context final reread of the complete issued text** is retained before dispatch |
| **J1-7** | **Reduce or remove fields that add ceremony without changing execution**, using the existing replay evidence. **Do not add another checker, actor, service or governance layer** |
| **J1-8** | **Prove the route with the first real Work Order: the worker begins substantive work on FIRST dispatch without a preventable Class-A refusal** |

**Warwick on what J1-8 does and does not establish:** *"A single successful order is initial acceptance, not proof of a permanent trend. Record subsequent real orders as accumulating evidence."* **And the failure route is named in advance: if preventable Class-A defects persist, REDUCE THE FORMAT FURTHER — do not resurrect Nolan-per-order.**

## 17.2 JOB 2 — make the Larry ding genuinely event-driven

**His diagnosis:** *"The current `larry-ding.mjs` is only a script Larry remembers to call, and its credentials depend on the invoking shell. That is not durable automation."*

**Confirmed by execution this session, and the cause was NOT what §16.11 recorded.** §16.11 step 1 said *"the credentials are not loaded."* **They were present on disk the entire time.** The failing invocation simply never handed them to node — `--env-file` was omitted, so the script fell through its own gate. Control: same script, same machine, **without** the flag → `{"ok":false,"why":"missing token/chat (names only)"}` exit 2; **with** it → credentials resolve, exit 0. **A real send then delivered: `{"ok":true,"message_id":320}`.** No credential value was read, echoed or logged.

**That repair is capability, NOT completed automation** — precisely the distinction §17.3 now makes canonical. The channel still works only when a caller remembers a flag.

### Required outcome — every line must be verified true

### 🔴 CORRECTED BY WARWICK, 2026-08-06 — **JOB 2 is NOT "make an event decide when to ding"**

> **His correction, and it re-scopes the whole job:** *"The decision is contextual and stays with Larry, grounded by the START / RESUME HERE rule."*
>
> **No daemon and no automatic event classifier are required.** **The durable outcome is the SEND PATH, not the trigger.**

**What this supersedes:** the requirement list below replaces the earlier J2-1..J2-8. **The `Stop`-hook trigger design recorded further down is SUPERSEDED and must not be built** — it is retained struck-through only because its *credential* finding survives and is now the crux.

| # | Requirement — Warwick, 2026-08-06 |
|---|---|
| **J2-a** | **Larry applies the written criteria himself:** ding for Warwick action/decision, **or** a substantive outcome worth knowing; **never routine progress.** The criteria are the START / RESUME HERE block — **that rule is the grounding, and it is not restated here** |
| **J2-b** | **FusionDevBot is Warwick's channel. TowerBot remains Codex/reviewer ONLY** |
| **J2-c** | **The FusionDevBot send path loads its approved credentials ITSELF** — **no remembered flag, no shell setup** |
| **J2-d** | **Send success or failure is VISIBLE, and failure is NEVER SILENT** |
| **J2-e** | **`getMe` proves bot identity ONLY.** **Acceptance is ONE REAL FusionDevBot MESSAGE ARRIVING ON WARWICK'S PHONE from the repaired path** |

**Read J2-e exactly.** It disqualifies every proof this session has produced so far: the three delivered dings all passed `--env-file` by hand, and `getMe` proves only that a bot exists. **Neither is acceptance.** Acceptance is a message that arrives having loaded its own credentials.

**What is NOT owed, stated so it is not built:** no daemon · no new service · no automatic event classifier · no trigger mechanism · no scheduler. **The judgement stays with Larry and is not to be mechanised.** Under root `CLAUDE.md` § *"Nothing may live only in Larry's head"*, **the send path is the mechanism and it must be complete; WHEN to send it is a judgement, and a judgement is not a mechanism.** That distinction is the whole of this correction.

### 🔴 MEASURED FAILURE OF THE JUDGEMENT HALF — 2026-08-06, and it is evidence, not an apology

**Warwick, verbatim, on being told step 2 was complete in chat with no ding: *"where we are is an update, so where was my ding!ffs"*** **He was right. Larry reported a substantive outcome in-channel and did not send it.**

| | |
|---|---|
| **The rule** | *"ding … for a substantive outcome he would reasonably want to know immediately even when no action is required"* |
| **Who wrote it into the map** | **Larry, the same day**, into the START / RESUME HERE block |
| **Elapsed before the first miss** | **~1 hour** |
| **Record before the miss** | 4 dings sent correctly (ids 320–324 span the sequence) — **fifth update, first miss** |
| **Conditions** | **No context pressure named, no failure in progress, nothing else going wrong.** The rule was fresh, self-authored and visible |

**Why this belongs in the phase report and not just in a correction:** it is a clean instance of the estate's own recorded pattern — **a control bound to a person remembering is a dated liability**, and *"compensating habits decay silently."* **The decay here was not slow. It was one hour, under ideal conditions, by the author of the rule.**

**⚠️ This does NOT reopen Warwick's decision, and must not be written up as if it does.** He ruled on 2026-08-06 that the ding **decision is contextual and stays with Larry**, explicitly **not** mechanised, and **no automatic event classifier is to be built.** **That ruling stands and is not relitigated here.** What is recorded is the *cost side* of it, honestly measured, so the report states the trade rather than only its benefits. **Warwick owns the trade; Larry owes him the number.**

**Recorded for §15.3d (delivery tax / end-of-phase collapse) as a first-party datum** — the failure is Larry's own, observed live, not reconstructed.

### 🚨 Known blocker on the J2 surface — a `permission`, and it is Warwick's

**The Claude Code auto-mode classifier DENIES writes into `C:\.fusion247\**`**, hit this session attempting to make `larry-ding.mjs` self-sufficient. **And GL-012 §4 independently bars dispatching any specialist there** — the script sits at the **secrets-store root**, which is never a valid `private_surface` grant. **So the surface is closed to Larry by the classifier and closed to every worker by GL-012.** J2-4's "approved stable runtime" must therefore resolve this, not route around it. **Dinged to Warwick 2026-08-06 as an A/B decision; unanswered at the time of writing.**

**Related and already recorded: C-9** — the governor writes **no log** when a continuity packet fails to deliver. **J2-5 and J2-6 are the same requirement arriving from a second direction**, and a fix that satisfies one should be checked against the other rather than built twice.

### ⛔ SUPERSEDED 2026-08-06 — the TRIGGER half of this reconnaissance is NOT to be built

> **Warwick re-scoped JOB 2 above: the decision is contextual and stays with Larry. There is no automatic event classifier and no trigger mechanism.** Everything in this subsection about the `Stop` hook, the dedupe discriminator and the five events **is retained as evidence only** — it is a correct finding about the estate and a **wrong route for J2.**
>
> **What survives and is now the CRUX:** the credential probe below. It is the direct proof of **J2-c** — the send path cannot rely on an inherited environment, so it must load its credentials itself.
>
> **Do not build the trigger. Do not delete this record either** — it is what stops the next session re-deriving the same design and mistaking it for the route.

**Retained for evidence — the original reconnaissance, correct as facts about the estate:**

| Need | What already carries it | Evidence |
|---|---|---|
| **J2-1 — a real production event** | **A `Stop` hook is ALREADY REGISTERED at USER level**: `node C:/Users/Buggly/.mypka/governor/continuity.mjs stop`. It fires at **every turn end, in every directory**, spawned **by the host** | `~/.claude/settings.json`, read 2026-08-06. Same registration route as the `SessionStart` reorient hook proven at `eff3033` |
| **J2-3 — routine narration must NOT ding** | Continuity's **existing semantic-change dedupe** already suppresses a Stop write when state is unchanged (**E-H**). **That is precisely the substantive-vs-routine discriminator J2-3 needs** — it exists, it is proven, and it does not have to be invented | E-H, §16.5 |
| **J2-5 / J2-6 — success AND failure durably observable, never silent** | **Tower's `notify.mjs` already does all of it**: a durable `tower.notification` row, a dedup claim, `telegram_ok` and `telegram_message_id` written back after the POST, and an **honest** `"not sent — missing TELEGRAM_BOT_TOKEN…"` detail recorded when credentials are absent rather than a silent no-op | `services/control-plane/tower-loop/notify.mjs:58-121`, read 2026-08-06 |
| **J2-2 — which events** | The **five already named** in §16.10: active frontier changes · next Work Order changes · phase boundary changes · context crosses a threshold · handback state changes | Warwick, 2026-08-05 |

### 🔓 This dissolves the §17.2 classifier blocker rather than routing around it

**The blocker was that writes to `C:\.fusion247\**` are denied to Larry by the classifier and to every worker by GL-012.** On this route **no write to that path is ever required.** The change lives in `tools/governor/continuity.mjs` (repo, Keel) and its installed copy under `~/.mypka/governor/` (Mack — **and §16.10 records that subagent writes to `~/.mypka/**` now SUCCEED**). Credentials are **read at runtime by the hook-spawned process** from the stable path — never written, never echoed, and never sourced from an interactive shell, which is exactly **J2-4**.

**The one thing reconnaissance did NOT establish, and it must not be assumed:** that the hook-spawned process actually resolves `TELEGRAM_BOT_TOKEN` / `AUTHORISED_TELEGRAM_USER_ID` in its own environment. **`notify.mjs` reads them from `process.env` exactly as `larry-ding.mjs` does**, so the *same* defect this session diagnosed can recur one layer up. **Establish it by execution before designing on it.**

#### ⛔ NOW ESTABLISHED BY EXECUTION, 2026-08-06 — **the risk was real, and it is the crux of J2-4**

| Probe | Result |
|---|---|
| Both credential names in an **inherited** (no `--env-file`) environment | **`TELEGRAM_BOT_TOKEN: ABSENT` · `AUTHORISED_TELEGRAM_USER_ID: ABSENT`** — presence tested, **no value read or printed** |
| Installed `~/.mypka/governor/continuity.mjs` — any `loadEnvFile`, env-file, credential or notify/ding reference | **NONE.** The file has no credential path whatsoever |

**Consequence, and it is the whole design constraint for J2:** a `Stop`-hook-spawned process **inherits nothing** and would fail with the *identical* `missing token/chat` gate that `larry-ding.mjs` hit this session. **The event route is right; the credential route is genuinely missing and must be built, not assumed.**

**J2-c therefore resolves to: the send path loads the credentials ITSELF at process start, from the approved stable path — no `--env-file`, no shell setup.**

### 🚧 The surface decision — and why it is NOT a Warwick permission after all

**The obstacle:** the natural repair is to edit `C:\.fusion247\larry-ding.mjs` so it self-loads. **The auto-mode classifier DENIES writes to `C:\.fusion247\**`** (hit this session), and **GL-012 §4 independently bars dispatching any specialist there** — it is the secrets-store root and never a valid grant. **Both doors are shut.**

**Two routes, and the second needs no permission:**

| | Route | Verdict |
|---|---|---|
| **(a)** | Warwick permits the one write to `C:\.fusion247\larry-ding.mjs` | **Not needed. Do not ask.** It also leaves the send path **outside version control** |
| **(b)** | **The send path moves into the repo at `tools/governor/` and is INSTALLED to `~/.mypka/governor/`**, reading the approved credentials at runtime from the stable path | **CHOSEN.** An ordinary technical decision, not a product one |

**Why (b) is decisively right, and it is not merely convenience:** `C:\.fusion247\larry-ding.mjs` is **not in version control**. It cannot be reviewed by Veritas, cannot be reviewed by Codex, has no history, and does not survive a rebuild of the machine. **A send path Warwick's acceptance depends on cannot live outside git.** Route (b) makes it versioned, reviewable and installable, and `~/.mypka/**` is a surface where subagent writes are proven to succeed (§16.10, Mack, WO-16).

**Reading is not writing, and the distinction is load-bearing here.** The classifier blocked a **write**; the running script performing a **runtime read** of the approved env file is exactly what `--env-file` already does today. **No credential value ever enters a model context**, and no worker opens that file — a worker writes a path literal, which is not access. ⚠️ **Constraint for the Work Order: the tests must NOT read the real credentials file.**

**Recorded honestly:** the legacy `C:\.fusion247\larry-ding.mjs` cannot be retired or edited, because that surface is closed. **It remains on disk as a legacy duplicate.** Two paths to one channel is a real defect — **reported once, not fixed**, since fixing it needs the permission route (a) exists for and Warwick has not been asked for it.

**Split, unchanged from WP-3A/WP-3E:** **Keel** authors under `tools/governor/` in the repo; **Mack** installs to `~/.mypka/governor/`, because a fix present only in the repo is inert — the §16.11 lesson. **J2-e's acceptance is a real message from the INSTALLED path, not the repo copy.**

**Convergence worth noting:** §16.10's parked *"frontier-change-triggers-continuity"* defect and J2-1 are **the same mechanism**. Building the ding trigger discharges the parked defect; they must not be built twice.

## 17.3 ⚖️ STANDING CANONICAL LAW — *"Nothing may live only in Larry's head"*

**Warwick supplied the exact block and instructed that it be added to root `CLAUDE.md` as the SOLE canonical definition.** That is his explicit approval and his exact text, which is what root `CLAUDE.md`'s *"no silent constitutional self-modification"* clause requires. **The independent review of the resulting patch is still owed** and is discharged by this phase's existing route — Veritas on the exact integrated head, Codex at PR level. **Larry does not self-certify it.**

**Where it lives:** root `CLAUDE.md`, canonical, once.

**Five projections, each POINTING to the root clause — *"must not paraphrase or weaken it"*:**

> ⚠️ **CORRECTED 2026-08-06 (Veritas V4-5, non-blocking, accepted).** **"Five projections" is really FOUR DISTINCT SURFACES plus a SELF-REFERENCE.** **L-5** landed in root `CLAUDE.md` § Wayfinder — **the canonical file pointing at itself** — because **no Wayfinder template file exists** and inventing one would be regrowth. **The START / RESUME block does not carry the automation-frontier clause.** The binding is real and the decision to avoid a new file was deliberate; **the count was overstated and is corrected here rather than defended.**

| # | Surface | What it binds |
|---|---|---|
| **L-1** | **Larry contract** | completion and dispatch bar |
| **L-2** | **Veritas contract** | **mandatory PASS dimension** |
| **L-3** | **Codex contract** (`services/control-plane/review/prompts/`) | **mandatory PR-review bar** |
| **L-4** | **Work Order template / SOP-022** | mandatory acceptance clause for intended automation |
| **L-5** | **Wayfinder template / start contract** | **automated outcomes remain FRONTIER until the canonical test passes** |

**The prohibitions, his words:** *"No new control plane. No Nolan routine checker. No manual steps disguised as automation. Build to the Star."*

## 17.5 ⭐ ORDERED CLOSURE — set by Warwick, 2026-08-06. **This is the phase-close sequence.**

**The §15.2–§15.3d phase-close report is REACTIVATED and is part of this work package** (§16.1's supersession is reversed above). **The steps are ORDERED, not a menu.**

### 🔄 SEQUENCE REVISED by Warwick, 2026-08-06 — **rotation now comes BEFORE Pax**

> **His correction, verbatim in effect: *"Do not rotate before Mack."*** and **"Pax remains untouched until after rotation."** **The table below is the operative sequence. The original six-step list is retained beneath it as the record of what it replaced.**

| # | Step | Owner | State |
|---|---|---|---|
| **1** | **Keel returns and JOB 2 is integrated** | Keel → Larry | ✅ **DONE.** Integrated at **`8b0528b`**, independently verified — 56/56, `ding.mjs` byte-identical across the addendum, Larry's own surviving mutation now caught (5 red) |
| **2** | **Mack installs the versioned FusionDevBot sender** | **Mack** | **IN FLIGHT.** `WO-2026-08-06-20` (WP-4C) dispatched at `0cc2ffe`. Hand-authored on the WP-3E `machine_surface` shape — see G-6 |
| **2b** | **WP-4C install** | Mack | ✅ **DONE.** Installed sha `0f26ef16…` **equals the git blob**, verified independently by Larry; 0 CR bytes; rollback **executed** (absent→install→delete→verify→reinstall→equal); `INSTALLED-FROM.txt` appended with **append-only PROVEN** (first 8,310 bytes hash to the pre-write baseline) |
| **3** | **Prove J2-e — ONE REAL MESSAGE arriving from the INSTALLED path**, credentials self-loaded, **no `--env-file` and no shell preparation** | **Larry**, then Warwick's eyes | ✅ **FIRED AND DELIVERED — see §17.7** |
| **4** | **Veritas reviews the exact integrated head** | **Veritas** | **NEXT** |
| **5** | **`/rotate` and reach `SAFE TO CLEAR`** — **now including the Pax report INSIDE the transaction** | Larry + Pax | Not started. **`/rotate` updated 2026-08-06 — see below** |
| ~~**6**~~ | ~~A fresh Larry picks up the Pax commission on the other side~~ | — | ⛔ **REVERSED 2026-08-06 — see §17.5a** |

### 🔄 §17.5a — Pax moves INSIDE `/rotate`. Warwick, 2026-08-06

> **His reason, and it is the load-bearing part: *"Do not defer the Pax report until after respawn. That would lose session-specific evidence that has not yet been turned into a durable artefact."*** **A rotation is the last moment that evidence exists. After `/clear` it is gone and no fresh Larry can reconstruct it.**

**`/rotate` is updated — `.claude/commands/rotate.md`, not a new mechanism.** Every rotation now: completes existing assurance and banking · **commissions Pax** for the closing session's performance/process report · **waits for the return** · **writes and commits it under `Deliverables/`** · **puts the pointer in the Wayfinder AND the Honcho packet** · and **withholds `SAFE TO CLEAR` until the Deliverable exists and the read-back matches.**

⛔ **The report is a GIT artefact. NOT Google Drive, NOT Google Sheets, NOT Supabase** — this supersedes the earlier "publish to Google Drive" step entirely. **Supabase reporting is explicitly DEFERRED to a fresh session after the next `/clear` and must not be built now.**

**For THIS rotation the report must carry:** Work Order evidence · rework and refusals · **the notification misses** · parent-channel availability and queued messages · token/context evidence **read from the instrument, never estimated** · and any other recorded delivery-tax findings.

## 17.8 📣 The attention correction — Warwick, 2026-08-06. **Integrated BEFORE Veritas, as ordered**

> **His diagnosis, and it reframes the whole problem: *"The DevBot transport is now proven. The repeated failure is attention at the point of judgement."*** **Correct it "without reopening automatic notification classification."**

**Four parts, all landed:**

| # | Change | Where |
|---|---|---|
| **1** | **One concise canonical notification rule beside Rule 4** — decide before posting any substantive outcome and immediately after any specialist return · **send BEFORE the chat update** · then yield. *"The judgement remains Larry's; delivery is mechanical."* | root `CLAUDE.md` § **Rule 4a** |
| **2** | **The Wayfinder copy REPLACED by an exact reference.** A rule in two places drifts; SSOT says one home | this map's START / RESUME block |
| **3** | **A zero-model `PostToolUse` reminder on Agent returns**, injecting the rule into the parent at the moment of decision | `.claude/hooks/notify-reminder.mjs` + `.claude/settings.json` |
| **4** | **Availability preserved** — eligible specialists run in the **background by default** and Larry **yields immediately after dispatch**. Foreground needs a genuine interactive-permission reason | root `CLAUDE.md` § Rule 4a |

**What the hook is NOT, asserted by source and not by promise** — `grep -cE "fetch\|https?:\|telegram\|Agent(\|spawn\|exec"` over it returns **0**:

- **does NOT classify significance** — the judgement is Larry's and stays Larry's;
- **does NOT send** — no network call of any kind;
- **does NOT launch an agent** — no model is invoked, so it costs **zero tokens**;
- **does NOT create a daemon** — it runs, prints, exits `0`.

**Executed proof it works as a program:** emits valid JSON with `hookEventName: PostToolUse` and a populated `additionalContext`; `settings.json` parses with matcher `Agent|Task`. **Exit 0 always — a reminder that can break the parent turn is worse than no reminder.**

### ⚠️ WRITTEN IS NOT LOADED — and this is the honest status

**Root `CLAUDE.md`: *"a hook present in a settings file has no effect until the host restarts… No reply may assert a control is active without evidence that it fired."*** **This hook has NOT yet been observed to fire.** It is **written and executable**, which is a different claim from **installed and firing**.

**Warwick set the live test himself: *"The Veritas return is the live test: the reminder must reach Larry, and if the return is substantive the ding must arrive before the chat update."*** **If the reminder does not appear on the Veritas return, that is a LOADING result, not a design failure** — and it must be reported as exactly that, not quietly absorbed and not dressed up as success.

### ✅ IT FIRED — and ⛔ at the WRONG MOMENT. Observed 2026-08-06

**The hook loaded WITHOUT a host restart and fired. Observed, not asserted** — the reminder text appeared in Larry's context immediately after the Veritas dispatch. **"Written is not loaded" is discharged for this hook: it is loaded and firing.**

**But it fired at DISPATCH, not at RETURN.**

**The mechanism, and it is not a bug in the hook:** `PostToolUse` fires when a **tool call completes**. For a **background** agent the tool call completes at **LAUNCH** — the specialist's return arrives later as a **task notification, which is not a tool result and therefore cannot trigger `PostToolUse` at all.**

**So on the default path the reminder lands at the one moment it is not needed, and is silent at the moment it is — which is exactly the moment that failed twice today.**

### ⚖️ The tension is between two of Warwick's OWN instructions, and Larry is not resolving it silently

| Instruction | What it requires |
|---|---|
| **Part 3** | the reminder fires on specialist **RETURNS** |
| **Part 4** | eligible specialists run in the **BACKGROUND by default**, so Larry stays available |

**Background dispatch is precisely what makes the reminder unable to fire on return.** They cannot both hold as written with this hook event.

**Options, reported for Warwick's decision — not chosen by Larry:**

| | Option | Cost |
|---|---|---|
| **A** | Accept it — a standing nudge once per dispatch, just early | Cheap, no change, **weaker than intended** |
| **B** | Move the reminder to the **`Stop` hook**, which fires at every turn end including the turn that processes a return | Still zero-model, still no classification — **but it fires on EVERY turn, so it becomes noise, and noise gets ignored.** That is how gates die |
| **C** | **Keep the hook as a partial aid and treat the CANONICAL RULE as the actual control** | Honest about what a reminder can and cannot fix |

**Larry's recommendation is C, and the reasoning is the part that matters:** **the hook is not what will fix the attention failure — Rule 4a is.** Calling the hook "the fix" would be the *mechanism-instead-of-discipline* pattern Warwick has rejected repeatedly, and the regrowth cap applies. **Recorded as a recommendation. The decision is his.**

### ⚖️ EXPLICIT RECLASSIFICATION — the attention correction is **MANUAL** (Veritas V4-4, accepted)

**Veritas: *"The reminder hook is intended-automatic, was never observed to fire at this head, and is not reclassified as manual. Capability, not completed automation."*** **Accepted in full. This is root `CLAUDE.md` § "Nothing may live only in Larry's head" caught against Larry a SECOND time in one session — by the law he wrote that morning.**

**The reclassification, using the root clause's own permitted resolution:**

> **The attention correction is a MANUAL control. Rule 4a is the mechanism, and Rule 4a is a JUDGEMENT Larry performs — not an automation.** **The `PostToolUse` reminder is a PARTIAL AID that does NOT fire at the moment it was intended to fire** (a background specialist's return is a task notification, not a tool result). **It is not, and must never be recorded as, completed automation.**

⚠️ **A subsequent firing does not undo this.** The hook **was** later observed firing — at **dispatch**, at head `34d0cd0`, after the reviewed head. **That proves loading, not delivery of the intended behaviour**, and it is measured for the wrong event. **Larry's original claim (e) — that Rule 4a "plus a zero-model reminder hook address notification attention" — overstated it, and Veritas was right to block it.**

**What is honestly true at this head:** Rule 4a exists and is canonical · the hook exists, loads and executes · **the attention failure has no automated guard, by design and by Warwick's ruling, and its two recorded failures today remain unguarded by anything except Larry's judgement.**

## 17.9 🔬 The subagent-return cue — RESEARCH COMMISSIONED. **📌 FOLLOW UP AFTER `/rotate`**

> **📌 WARWICK'S EXPLICIT FOLLOW-UP NOTE, 2026-08-06: *"make a note to follow up after `/rotate`."*** **The implementation decision comes AFTER `/clear`, alongside the separate Supabase performance-reporting job. Pax researches; Pax does NOT implement.** **This note must survive rotation — it belongs in the continuity packet.**

**Why it exists:** the dispatch-time hook fires at **LAUNCH**, not return (§17.8). Warwick's North Star: *"When a background specialist actually finishes, Larry's parent session receives one fresh, specialist-specific retrieval cue at the next safe parent turn."* **Commissioned to Pax as `WO-2026-08-06-21` → `Deliverables/2026-08-06-pax-subagent-return-cue-brief.md`.**

### ⚠️ A class-A defect in the commission, caught at PREFLIGHT by the generator

**Warwick's brief requires answers *"by execution, not inference"*. PAX HAS NO `Bash`** — Read, Write, WebFetch, WebSearch, Grep, Glob only. **As literally worded the order was impossible and would have earned an immediate `REFUSE`.**

**The generator caught it, not Larry.** It derives `producible_evidence` from the tool grant and emitted: *"acceptance evidence must NOT require an executed command · command execution: NOT available (tools: has no Bash)."* **This is WP-4A's repair preventing a real class-A defect on live work, at issue time.** Resolved by the established pattern: **Larry executes and stages; the worker analyses.**

### ✅ ESTABLISHED BY EXECUTION — Larry's probe, 2026-08-06

**Method:** `SubagentStop` hook registered in the **UNTRACKED** `.claude/settings.local.json`, three trivial background agents dispatched (one alone, then two concurrently), full stdin payload captured each time, probe then removed.

⚠️ **How far that claim is corroborated, stated exactly (Veritas `V5-5`, accepted):** git confirms `settings.json`'s last change is the `$CLAUDE_PROJECT_DIR` path fix at `755536e`, that no probe commit touches it, and that `settings.local.json` is untracked and gitignored. **But a transient uncommitted edit-and-revert is NOT DISPROVABLE BY GIT.** So the honest form is *"not contradicted by git"*, **not** *"proven"* — and `S-1`..`S-4` are **builder evidence Veritas could not reproduce** (`V5-4`: it holds no hook registration and no `Task`). **The raw payload file is untracked and ephemeral: the findings survive in this map, the payloads do not.**

| # | Finding |
|---|---|
| **S-1** | **`SubagentStop` DOES fire at the real completion moment for a BACKGROUND agent** — and fired **BEFORE** the task-notification reached Larry's context |
| **S-2** | Payload carries **`session_id` (the PARENT session)** · `agent_id` · **`agent_type`** · `agent_transcript_path` · `transcript_path` · `cwd` · `prompt_id` · `permission_mode` · `stop_hook_active` · `last_assistant_message` · `background_tasks` |
| **S-3** | **`agent_type` correctly distinguished `general-purpose` from `Explore`** — **specialist-specific cues are feasible on real data, not on assumption** |
| **S-4** | **Two CONCURRENT returns each fired their own `SubagentStop`** with distinct `agent_id`s; an append-only file queued them naturally |

**Warwick's steps 1 and 2 are PROVEN VIABLE. S-4 answers only the WRITE half of his queueing question** — ⚠️ **the CONSUME half (a later parent hook reading each marker exactly once) is UNTESTED and is Pax's to establish.**

**Larry's sequencing decision, recorded:** **the Veritas resubmission is HELD until Pax's brief is committed.** Veritas's own `V4-10` found the repo head moved *during* its last review, so a receipt no longer covered the branch tip. **Running both concurrently would repeat that exact defect.**

### 📋 PAX RETURNED — `BUILD`, reduced, **GATED ON ONE PROBE**. Brief: `Deliverables/2026-08-06-pax-subagent-return-cue-brief.md`

| | |
|---|---|
| **Verdict** | **`BUILD` — Option A, reduced — CONDITIONAL.** ⚠️ **Kill condition stated IN ADVANCE:** if `PreToolUse` firing *inside* a subagent does **not** carry `agent_id`, a parent tool call cannot be told from a specialist's, the cue can land in the **wrong context**, and the verdict **flips to `DO NOT BUILD` → fall back to Option C.** **Pax would not authorise the build without that probe** |
| **Option B — DEAD**, established from the docs | **No native event both fires on a background return AND reaches the parent's context.** `Notification`'s `agent_completed` matcher is the right moment but its only output is `systemMessage` — *"Warning message shown to the user"* — which **never reaches Claude**. `SubagentStop.additionalContext` lands *"at the end of the turn"* with exit-2 semantics *"prevents the subagent from stopping"*, i.e. it **injects back into the SPECIALIST** — the exact thing Warwick forbade |
| **The honest answer to the central question** | **NO hook is documented to fire after a background completion notification is processed.** The sub-agents page, verbatim: *"A background subagent's results reach Claude as a completion notification in a later turn."* **The relay is necessarily OPPORTUNISTIC** — next `PreToolUse` or `UserPromptSubmit`, whichever comes first. **That is not the clean answer the design assumed** |

**🚨 The finding worth the whole commission: TWO OFFICIAL ANTHROPIC PAGES CONTRADICT EACH OTHER on the field the design rests on.** The **Agent SDK hooks** page says *"`agent_id` and `agent_type` are populated when the hook fires inside a subagent… available to all hook types"*; the **CLI hooks reference** lists `PreToolUse`'s inputs with **no `agent_id`**. **Pax did not pick a side — the contradiction IS the probe.** ✅ Correct handling, and the opposite of inferring a capability from a plausible field name.

**The unexpected failure mode: the relay can fire EARLY.** A parent tool call one second after `SubagentStop` consumes the marker **before the completion notification has landed** — so Larry is told to act on a return he cannot yet see, **and the marker is gone.** Cheap mitigation, free from the executed evidence: **put `agent_type` in the cue** so Larry at least knows *who* returned. **Residual risk stands.**

> **Pax's anti-pattern, and it is the durable part: *"the failure mode is the text, not the build."*** A generic *"a specialist returned"* on every return **becomes a banner ad within a day — a gate that gets skimmed has died while still looking green.** **Warwick's specialist-specific canonical text is the only thing making this survivable. If it ever collapses back to one generic string, RETIRE the hook.**

**And the strongest argument for `BUILD`, worth defending if challenged:** the existing hook fires at dispatch, so it is **stale by the time the decision is due**. **Return-time firing is a CHANGE OF KIND, not a change of dose.**

**Unresolved, and labelled as such by Pax (pre-probe):** `agent_id` presence in parent vs subagent `PreToolUse` (**was UNESTABLISHED — now SETTLED**) · whether the relay materially improves retrieval **or just adds noise** (**still UNESTABLISHED and unprovable in advance**) · **host version pin** (**now captured**).

### ✅ §9 PROBE EXECUTED — 2026-08-06 post-rotation session

**Evidence:** `Deliverables/2026-08-06-s9-agent-id-probe-evidence.md`  
**Host version:** `2.1.222 (Claude Code)`  
**Method:** temporary untracked hooks in `.claude/settings.local.json` only (restored after; tracked `settings.json` untouched) · one `claude -p` parent with one background general-purpose Agent · 6 payloads · exit 0 · 44.9 s

| Observation | Result |
|---|---|
| Parent `PreToolUse` (Bash, Agent dispatch, Bash after) | **no** `agent_id`, **no** `agent_type` |
| Subagent `PreToolUse` (Bash, Read) | **`agent_id` + `agent_type` present** (`a515f57fcfad85cbd` / `general-purpose`) |
| `SubagentStop` | fired once with same `agent_id` + `agent_type` |
| `Notification` | **0 firings** under this non-interactive run (fold-in only) |
| **Kill condition** | **NOT triggered** |
| **Verdict** | **`BUILD` — Option A reduced may proceed** |

**What remains unestablished:** return-time efficacy vs noise · exactly-once consume under concurrent parent batches · Notification in interactive sessions.

**📌 EXACT NEXT ACTION (supersedes the post-rotation probe action):** **Issue and dispatch a bounded Work Order to implement Option A reduced** per `Deliverables/2026-08-06-pax-subagent-return-cue-brief.md` §§7–8 — `SubagentStop` marker writer · parent-only `PreToolUse`/`UserPromptSubmit` consumer gated on absent `agent_id` · specialist-specific cue text · zero model calls · no daemon · no auto-send. **Do not build a workaround for a failed probe — the probe passed.**

## 17.7 ✅ J2-e — PASSED BY EXECUTION, 2026-08-06

**Command, stated exactly, because the absence of flags IS the proof:**

```
node "C:/Users/Buggly/.mypka/governor/ding.mjs" <message-file>
```

**No `--env-file`. No exported variable. No shell preparation.** Verified immediately before firing, in the same shell: **`TELEGRAM_BOT_TOKEN: ABSENT · AUTHORISED_TELEGRAM_USER_ID: ABSENT`.**

| Evidence | Value |
|---|---|
| Return | `{"ok":true,"why":"sent","message_id":326}` — **exit 0** |
| Durable record, written on first invocation | `{"ts":"2026-08-06T01:30:20.851Z","outcome":"sent","exit":0,"message_id":326,"bytes":2310}` |
| Installed file | `0f26ef16…` = git blob at `8b0528ba`, **0 CR bytes** |

**What this PROVES:** the send path loads its own approved credentials from a stable runtime, delivers, and **durably records the delivery** — **J2-c, J2-d and J2-e's send half.**

⚠️ **What it does NOT prove, and no receipt may claim otherwise:**

- **Arrival on Warwick's phone is HIS confirmation, not Larry's.** Telegram returning `ok:true` with a `message_id` evidences that the message left and was accepted. **It is not the same claim as "he saw it."**
- **Nothing triggers this automatically, and nothing is supposed to.** Warwick ruled the ding **judgement** stays with Larry and is explicitly not mechanised. **Under root `CLAUDE.md` § "Nothing may live only in Larry's head", the MECHANISM (the send path) is now complete; the JUDGEMENT is not a mechanism** — which is exactly the boundary §17.2 records.

### 🔴 And the judgement half failed TWICE today — both misses, recorded

**Warwick, twice: *"where was my ding!ffs"*, then *"you absolutely should have dinged for the update on mack, that is substantial and a miss."*** **Both correct.**

| # | Occasion | Larry's error |
|---|---|---|
| **1** | Step 2 (Nolan resolution) completed | Reported in chat, no ding |
| **2** | **Mack's WP-4C return** — install verified, CRLF trap measured, contract correction accepted | Reported in chat, no ding |

**Two failures of the same rule, in one session, by the author of the rule, roughly an hour apart, with the instrument reading GREEN and nothing else going wrong.** **This is the single strongest delivery-tax datum the session produced and it is Pax's to analyse, not Larry's to explain away.** **It does not reopen Warwick's ruling** — he owns the trade; Larry owes him the number, and the number is now two.

### 📋 EVERY Larry error this session — the consolidated record. **Input for the rotation report.**

**Written here because Veritas (V4-11) found one that had been owned in conversation and never entered the record. A correction that exists only in chat does not exist.**

| # | Error | Caught by | Recorded |
|---|---|---|---|
| **E-1** | **Stale SHA in a dispatch** — named `c9390de` as the branch tip from memory when two of Larry's own later commits had moved it to `4214a66` | **Keel's read-back** | §17.6, WO-18 `AMENDMENT 1` |
| **E-2** | **Eyeballed a token figure and was ~2× wrong.** Claimed the envelope was *"roughly ten thousand tokens"*; **measured: 20,056 chars ≈ 5,014 tokens.** Also misattributed the bulk — missed `git_authority` at 14%, overstated `prohibited_file_surface`, which is 7% | **Keel's read-back** | ⚠️ **WAS ONLY IN THE WO FILE AND A COMMIT MESSAGE — added to the map here, 2026-08-06, on Veritas V4-11** |
| **E-3** | **Called Mack's contract a "GAP"** when it has no file-pattern grammar at all, so absence is not denial | **Mack's read-back** | §17.6 + `08344dd` |
| **E-4** | **Missed notification ×2** — step 2's completion, and Mack's WP-4C return | **Warwick, twice** | §17.7 above |
| **E-5** | **Asserted context was "very long" twice and recommended rotating — without reading the instrument.** It measured **~32% GREEN, CONTINUE** | **Larry, on finally measuring** | `c9803dc` |
| **E-6** | **Left a live Google Drive contradiction and a live Pax-timing contradiction** in the map after re-scoping, including in **§15.2 — the section Warwick reactivated, whose body Larry did not re-read** | **Veritas V4-2, V4-3** | Corrected 2026-08-06 |
| **E-7** | **Never pushed the branch.** 24 commits existed only on this machine; the reviewed head was on no remote | **Veritas V4-1** | Pushed 2026-08-06 |
| **E-8** | **Overstated the projection count** — "five projections" is four surfaces plus a self-reference | **Veritas V4-5** | §17.3 above |
| **E-9** | **Described the attention correction as delivered** when its hook was never observed to fire at the reviewed head and was not reclassified as manual | **Veritas V4-4** | §17.8, reclassified |

| **E-10** | **Committed `34d0cd0` while the branch was under assurance**, moving the head mid-review so the receipt no longer covered the branch tip | **Veritas V4-10** | ⚠️ **ADDED 2026-08-06 on Veritas `V5-2`** — it had appeared only as the *rationale* for a later sequencing decision, framed as Veritas's finding rather than as Larry's error |
| **E-11** | **Claimed the Google Drive contradiction was "corrected in both places."** A **third** live instance survived at §15.4 — in the very section describing the route for the artefact `/rotate` produces | **Veritas V5-1** | Corrected 2026-08-06 |

**The pattern worth Pax's attention, stated without excuse: NINE of the eleven were caught by someone else** — a specialist read-back or the assurance gate — **and only E-5 was caught by Larry.** **The two no reviewer could have caught (E-4) were caught by Warwick.** **A worker read-back and an independent gate are, on this session's evidence, the load-bearing controls; Larry's self-review caught almost nothing.**

> ### 🚨 The shape Veritas named, and it is worth more than either defect
>
> **`E-10` and `E-11` are both SWEEPS REPORTED AS EXHAUSTIVE.** *"Corrected in both places"* and *"EVERY Larry error this session"* are **completeness claims**, and **both were false when written.** ⚠️ **The defect is not the missed instance — it is the word "every".** A partial sweep honestly labelled partial costs a reader nothing; **a partial sweep labelled complete stops them looking.**
>
> **This belongs in the rotation report** (Veritas's own instruction) **and it generalises well past this session:** the same failure produced the three competing frontiers §12 records, and it is the reason a completeness claim should either be mechanically enumerated or stated as *"the instances I found"*.
>
> ### 🚨🚨 IT HAPPENED A THIRD TIME — **inside the very table written to fix it** (Pax, 2026-08-06)
>
> **`V5-2` was raised so this E-table would be COMPLETE before Pax wrote the report from it. `E-10` was added. §17.6's own *"Larry's input was wrong"* (`G-6`) WAS NOT.** **Added below as `E-12`.**
>
> **Pax's conclusion, and it is the durable finding of this session: *"Three failed completeness claims in one session, two of them AFTER the pattern was explicitly named, is not inattention — it is the shape of the claim."*** **A completeness claim made by re-reading is a claim about what the author noticed. It cannot be made reliable by trying harder; it can only be made mechanically or hedged honestly.**

| **E-12** | **§17.6 records `G-6` as *"Larry's input was wrong"* — a genuine error, omitted from this table even when the table was rewritten specifically to be complete** | **Pax** | Added 2026-08-06 — **the third failed completeness claim** |

**⛔ PAX IS UNTOUCHED UNTIL `/rotate` RUNS. No commission, no reconnaissance, no evidence gathering, no drafting before then.** Warwick's constraint still binds: *"Do not launch a separate report investigation before the Work Order route is ready — the Pax commission is also the first live acceptance test of that repaired route."* **The commission IS the investigation.**

⛔ **CORRECTED 2026-08-06 (Veritas V4-3).** This paragraph previously ended *"…and it belongs to the session after this one."* **That is FALSE and directly contradicted §17.5a.** **Pax is commissioned INSIDE `/rotate`, before `SAFE TO CLEAR`, by THIS session — not after respawn.** Warwick reversed the timing on 2026-08-06 because **deferring the report past `/clear` destroys the session-specific evidence it exists to capture.** ⚠️ **A fresh Larry reading the old wording at step 5 would have received two opposite instructions — which is exactly the defect this map has carried before.**

⛔ **CORRECTED 2026-08-06 (Veritas V4-2 and V4-3).** This paragraph previously read *"The Google Drive report (originally step 4) follows the Pax commission and is therefore also post-rotation"* and, above it, that the commission *"belongs to the session after this one"*. **BOTH statements are now FALSE and were live contradictions of §17.5a.** **The report is a GIT artefact under `Deliverables/`, and Pax is commissioned INSIDE `/rotate` before `SAFE TO CLEAR` — not after respawn.** ⚠️ **There is no Google Drive step anywhere on this route.**

<details><summary>Superseded — the original six-step ordering, retained as the record</summary>

**1** FusionDevBot durable send path · **2** Complete the Work Order / Nolan resolution · **3** Commission Pax for the phase-report evidence · **4** Larry publishes the durable Google Drive report once 1–3 are factually complete · **5** Veritas on the exact integrated head and report truth · **6** `/rotate`.

**What changed:** rotation moved from last to **before** Pax, and the Pax commission moved to a fresh session. **Step 2 (Nolan resolution) was completed under the original numbering and is recorded in §17.6** — it is not lost by the renumbering.

</details>

### ⚠️ One factual correction to step 3, recorded rather than silently absorbed

**Step 3 calls the Pax commission *"the first genuine Work Order through the repaired route"*. It is not — it will be the SECOND.** `WO-2026-08-06-19` (step 1, Keel) was **already generated by the repaired tool** at governance head `b30bf55` and dispatched at `394ce68`, before this instruction arrived. **The route was ready, so no instruction was breached** — the ordering constraint is satisfied either way.

**Why this is better for Warwick, not worse:** he asked for accumulating evidence rather than a single data point, and *"a single successful order is initial acceptance, not proof of a permanent trend."* **Two orders through the route give two observations. The Pax commission additionally tests the route against a DIFFERENT specialist and a research-shaped order** — WO-19 tested it against Keel and an implementation-shaped one. **That is a stronger test than repeating the same shape.**

### 📌 Step 2 — the reading Larry is acting on, stated so it can be overruled cheaply

**"Complete the Work Order / Nolan resolution" is read as CLOSE IT, not ratify it.** The basis is Warwick's own standing instruction, unreversed: the Nolan-per-order proposal is **parked and unratified at `c2ebda4`**, *"do not merge, recreate or apply it"*, no Nolan contract / SOP-022 actor / agent-index / shim change is authorised, and **Nolan remains an occasional structural/audit role, not a routine checker.**

**So the resolution to be COMPLETED is: the per-order checker is answered by the GENERATION repair, not by a change of actor.** Step 2 records that conclusion durably, retires the parked item, and leaves `c2ebda4` unmerged. **It ratifies nothing and creates no actor.**

**If Warwick meant ratify instead, that reverses his own explicit prohibition and is one word from him.** Recorded as an interpretation precisely so it costs nothing to correct.

## 17.6 ✅ STEP 2 — the Work Order / Nolan resolution, COMPLETED 2026-08-06

**Ratifies nothing. Creates no actor. `c2ebda4` stays unmerged.**

### The question that was open

**Who checks a Work Order envelope before dispatch?** Pax established (WP-3C) that the responsibility was not merely unformalised but **formally DE-ASSIGNED**: `Team/agent-index.md:42-45` records the build-team table *"previously read 'Independently audits — **Nolan**'"*, changed by **`f78d121`** on 2026-08-04. The replacement is contractually barred from the half that was lost — *"no pre-inspection of a Work Order before implementation"* — and the Veritas gate fires **after** integration. **Pax's one-line diagnosis: the issuer was the sole author *and* the sole checker of the envelope.** Baseline: **13 class-A refusals across 15 orders.**

### The resolution

**The per-order checker question is answered by the GENERATION repair, not by a change of actor.** The defect was never that nobody *re-read* the envelope — it was that the envelope was **hand-typed from memory by the one person who could not see their own blind spot.** A second reader inspects a fallible artefact after the fact; **generation removes the fallible step.** Warwick's four permitted verbs are REMOVE, SHORTEN, COMBINE, CHANGE — **this REMOVES the authoring step rather than ADDING a reader.**

**Standing position, unchanged and now closed:** Nolan remains an **occasional structural / audit role**, never a routine checker on every Work Order. **No Nolan contract, SOP-022 actor, `agent-index` or shim change is authorised or made.** §16.9 records what was approved on 2026-08-05 and is **superseded as a thing to implement** by the 2026-08-06 parking.

### The evidence, measured across the two orders that bracket the repair

| | **WO-18** — envelope **hand-authored** | **WO-19** — envelope **GENERATED** |
|---|---|---|
| Verdict | **`CLARIFY`** | **`ACCEPT`** |
| Preventable class-A in the order | **2 of material weight**, + 4 minor | **0** |
| Amendment required before build? | **YES** — `AMENDMENT 1`, a full round trip | **NO** |
| Defects found | 9 | 4 contradictions, **all in the envelope/authoring, none blocking** |

**The honest reading, and it is narrower than it looks: n = 2, and the two orders differ in more than one variable** — different scope, and the second was written by a Larry who had just read nine findings about the first. **Confounded, and stated so.** What is *not* confounded: the class-A defects in WO-18 were **envelope-shaped** (a `contract_basis` citing a generator field instead of a contract heading, a stale SHA typed from memory), and **both are structurally impossible in a generated envelope.**

### ⚠️ AC-5 accounting — stated exactly, because it is the property most likely to be over-read

**AC-5 requires THREE CONSECUTIVE real orders reaching specialists without a preventable class-A refusal.**

| Order | Counts toward the streak? |
|---|---|
| **WO-18** | **NO.** It did not refuse, but it carried 2 preventable class-A defects and **held for a full amendment before substantive work began** |
| **WO-19** | **YES** — clean, no amendment, worker proceeded on acceptance |

> ### ⚖️ CORRECTED 2026-08-06 by Pax — **and the correction runs AGAINST Larry, not in his favour**
>
> **Larry recorded the count as ONE. Pax's honest count at rotation is TWO — `WO-19` and `WO-21`** — **and `WO-22` would make three under one reading.** ⚠️ **Larry under-counted his own acceptance property**, which is the opposite of the error this record was watching for.
>
> **But the real defect is definitional, and it is Warwick's to settle in one word: "consecutive" has never been defined against an order the GENERATOR HAS NO SHAPE FOR.** `WO-20` (Mack, machine-install) was **hand-authored because the generator correctly refused** (`G-6`). **Does a clean order the route cannot produce break the streak, sit outside it, or count?** **Larry does not decide this** — a `product-decision`, recorded, not resolved.
>
> **Consequence, stated plainly: AC-5 MAY ALREADY BE MET. It is NOT recorded as met**, because the counting rule is undecided and **Larry may not choose the reading that favours him.**

**Warwick: *"A single successful order is initial acceptance, not proof of a permanent trend."*** **Whatever the count, no receipt may record AC-5 as met until the definitional question above is answered.**

### 📊 Pax's measured comparison against the ONLY baseline — §15.3d, Phase 2

| Metric | Phase 2 baseline | This session |
|---|---|---|
| Orders issued | 8 | **4** |
| Amendment round trips | ~11 | **2** |
| **Class-A refusals** | **7** | **0** |

**No worker refused an order this session.** **Both round trips were on HAND-AUTHORED envelopes; both GENERATED envelopes ran clean on first dispatch** — **unconfounded on the one variable that matters.**

⚠️ **Pax's caution, and it belongs beside the numbers: do NOT read the 33 clean notification minutes as the problem being fixed.** Both confirmed misses **predate** the installed send path's first row at `01:30`, and **the send path was never the failing half.** The likelier explanation for the clean window is **that Warwick had just corrected Larry twice — the loudest and shortest-lived correction available.**

### What the generated envelope did NOT fix — Keel's findings, accepted in full

**Reported once, not dispatched.** ⚠️ **Most of these are Larry's authoring, not the tool's:**

| # | Finding | Whose |
|---|---|---|
| **G-1** | **Value-plus-prose in one scalar makes no envelope field machine-readable.** `contract_conflicts: none — earned: …`, `operational_handoff: none — Mack installs …`. A worker told to *read* a field and **never infer** it had to parse English off the front to obey. One prose comma from costing something | **Larry's authoring** |
| **G-2** | **`worktree` contradicted itself inside one order** — frontmatter named it, the generated row said `n/a — no worktree supplied` under a **`supplied + verified`** provenance tag. **Lending an authority marker to an absence is the worst available shape** | Larry omitted the flag; **the provenance tag is the tool's** |
| **G-3** | **SSOT applied inconsistently in one table** — `permitted_file_surface` fully inlined while `prohibited_file_surface` is a pointer. **The asymmetry least likely to protect anyone** | Tool |
| **G-4** | **`producible_evidence` reads as constraining the deliverable.** *"network fetch: NOT available"* is true of the worker's tool grant and irrelevant to a deliverable whose job is an outbound POST | Tool |
| **G-5** | **The issuability footer is computed at generation and never recomputed** — stale the instant a slot is authored. Failed safe here; **fails dangerous in the other direction** | Tool |

**The accepted fix for the next iteration, Keel's recommendation:** **every field a bare value, prose in a sibling comment.** **Not dispatched — it is a candidate, and its disposition is Warwick's.**

### G-6 — the generator has NO shape for a MACHINE-INSTALL order. Found 2026-08-06 attempting WP-4C

**Larry generated WO-20 for Mack (install `ding.mjs` to `~/.mypka/governor/`) and the tool returned 3 `UNRESOLVED` and declared the order NOT ISSUABLE.** ✅ **The refusal was CORRECT, and Larry's input was wrong** — which is the tool behaving exactly as designed and is recorded as a success, not a defect.

**The real shape, established from the WP-3E precedent (`WO-2026-08-05-16`) rather than invented:** a machine-install order does **not** use `file_surface` at all. It uses:

| Field | WP-3E's value |
|---|---|
| **`machine_surface`** *(closed list)* | `C:\Users\Buggly\.mypka\governor\**` — **write permitted here and ONLY here** |
| **`live_authority`** | **BOUNDED — `~/.mypka/governor/**` only** (a deviation from the standing `none`) |

**Two distinct facts, and they must not be conflated:**

1. **`file_surface` is for REPO paths.** Passing a machine path to `--surface` asks the tool to match `~/.mypka/...` against a contract's repo patterns; **finding nothing and refusing is right.** A tool that "helpfully" resolved it would be fabricating a grant — the exact defect Keel fixed at `MUT-10`.
2. **The generator has no `machine_surface` concept and no way to express a bounded `live_authority`** beyond the generic `--deviate`. **So the estate's real machine-install shape cannot currently be generated** — it must be hand-authored, which reintroduces **G-1** on the two most safety-critical fields in the order.

**Consequence for AC-5's accounting, stated so it is not quietly skipped:** WO-20 **was not issued** on the generated route. **It does not count as a clean order and does not advance the streak.** Consecutive clean orders remains **ONE**.

**Disposition: reported once, NOT dispatched.** The fix is a candidate for the same iteration as G-1..G-5, and **it is Warwick's call**, not a Work Order Larry raises off his own finding.

#### ✅ Correction accepted from Mack's read-back — **"contract gap" was Larry's error, not a finding**

**Larry wrote WO-20's `contract_conflicts` as: the surface rests on his authorisation plus WP-3E precedent, *"NOT on a contract clause"*, and called it a KNOWN CONTRACT GAP. Mack showed that is wrong, and the correction is accepted and applied.**

> **Mack: *"My contract has no file-pattern grammar at all."*** The absence of a `~/.mypka/**` pattern is therefore **not a denial** — it is the absence of an enumeration **that was never written for any path.** ⚠️ **Reading it as a denial would equally forbid every `.env`, every `.mcp.json` and every supervisor registration the same contract explicitly ORDERS Mack to perform.**

**The basis is THREE-LEGGED, not one-legged:** Mack's affirmative grants (*"Mack owns operation of released services"*; *"Keel writes the hook … Mack registers it"*; MCP registrations written **outside** the repo) · Larry's bounded authorisation · WP-3E precedent, which **Mack verified by execution rather than trusting the document's description of itself.** **The residue is DOCUMENTARY, not authorising.**

**The durable lesson, and it generalises beyond Mack:** *absence of an enumeration in a prose contract is not a prohibition.* **Treating it as one manufactures a blocker and then requires an authorisation to clear a door that was never locked** — the mirror of the fabricated-grant defect Keel fixed at `MUT-10`. Both are the same error: **inferring a contract's answer from its silence.**

#### 🔬 The CRLF trap, MEASURED on this exact file — the first time both hashes have been produced

**Mack, before writing anything:**

| Source | Bytes | SHA-256 |
|---|---|---|
| **git blob** (`git cat-file -p`) | **17,454** | `0f26ef1624dcb85e031a30a74e6421f5de12e9a7266fb452b727e9e7e17b5d4b` |
| **working tree** `tools/governor/ding.mjs` | **17,863** | `c318bf0476ee700833e8281708d51d2befeb93b18305db267d03eeb889490ed7` |

**409 bytes divergent — and `git status --porcelain` on that path returns EMPTY. Git reports the tree clean.**

**This is the FOURTH time this trap has surfaced in BUILD-020 and the first time anyone produced both figures for the file in question.** **Installing from the working tree would have failed AC1 while every casual check looked fine.** Install method is `git cat-file blob`, which is also what `INSTALLED-FROM.txt` records for WP-3E — **and Mack confirmed the live `footer.mjs` already hashes identical to its blob**, so the runtime demonstrably holds blob bytes. **This is direct, current corroboration for C-2 and P-10** and it belongs in the phase report.

> **Keel's verdict on the generated envelope, quoted because it is the sharpest summary of what was actually bought:**
>
> **"The generated half is more trustworthy than prose about *provenance*, and less usable than prose about *values*."**

## 17.4 Frontier

## ⭐ ACTIVE SESSION WORK PACKAGE — single durable authority for this session

> **Warwick 2026-08-06 (amended — scope change, confirmed):** this section is the session’s durable accepted scope. **Functional acceptance = rows 1–4 only.** Assurance and release sequencing are **rows 5–7** and are **not** product requirements for Veritas to “PASS about itself.” Every Work Order, Veritas dispatch, `/rotate` report and merge-readiness statement **derives from here**. Prior Gate 1 PASS on rows 1–5 (WO/DevBot/cue/Watcher/Supabase) is **banked evidence of those mechanisms** — it is **not** this package’s acceptance and is **not** to be reopened unless current evidence proves a regression. **PR #97 remains unmerged until Warwick’s final merge authority.** Codex is **authorised by Warwick for this package only after Veritas Gate 1 PASS** at the frozen exact head.

| | |
|---|---|
| **Map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — this file |
| **Branch / worktree** | `build-020/phase4-automation-law` · `C:\Fusion247PKA-build-020-trial` |
| **PR** | **#97** open — **merge only after Codex + Warwick final decision** |
| **HEAD** | verify `git rev-parse HEAD` (package amendment `636e650` · private-api proxy `dfa36fb` · tip advances with banking) |
| **Phase** | BUILD-020 Phase 4 — amended WP in flight · Gate 2 re-verdict required at final head |
| **Evidence pack** | `Deliverables/2026-08-06-amended-wp-recon-evidence.md` |
| **Private surface (CareerAIR only)** | **`C:\.fusion247\private\careerair\**`** — never `C:\.fusion247\**` root/parent |
| **Authorised product decision (C-10)** | **Supersedes** prior “visibility first, automation decision separate.” Warwick **authorises restoration/completion of the already-intended automatic CareerAIR Outlook collection route** for this package. Linked: [[Deliverables/BACKLOG]] C-10 **moved out of candidate** into this authorised WP. |
| **Interrupt Warwick only for** | irreducible account-authority action · Veritas verdict · final merge readiness. No routine progress dings. |

### Package composition (Warwick)

| Block | Content |
|---|---|
| **A** | BUILD-020 durability, Phase 4 residual assessment, estate promotion readiness |
| **B** | CareerAIR Outlook intake repair + directly necessary Cockpit repair |
| **C** | Veritas assurance of the **complete amended** Work Package (Gate 1) |
| **D** | Final Codex review + merge decision pack for Warwick |

### Functional acceptance requirements (1–4) — Veritas Gate 1 grades these

| # | Requirement | Status | Evidence / residual |
|---|---|---|---|
| **1** | **BUILD-020 durability / promotion readiness.** Accepted operating mechanisms correctly classified (session-independent · machine-global install · generic repo assets in PR #97 · BUILD-020-specific). Survives: dead Larry session · worktree delete/recreate · fresh branch from current main · branch from main after #97 merges · installed-runtime restart. Replacement-machine DR **not** claimed unless executed. Exact merge unit + post-merge install alignment listed. | **MOSTLY DONE** | Recon banked in evidence pack. Merge unit = PR #97 generic assets. Live install alignment listed. Replacement-machine DR out of scope. |
| **2** | **Gate 2 Phase 4 residuals dispositioned against current evidence.** Every old Gate 2 residual at `95f8826` returns exactly one of: DISCHARGED · STILL OPEN · RECLASSIFIED · NOT PART OF THE PHASE. Do not copy old HOLD language forward. Valid: WP Gate 1 PASS + Phase Gate 2 HOLD pending post-merge. Do not manufacture Phase PASS to merge. | **DONE (disposition table banked)** | See evidence pack row 2. Phase close still needs fresh Gate 2 at final head. |
| **3** | **CareerAIR automatic Outlook intake.** Eligible mail from CareerAIR inbox/folder in `warwickallan@outlook.com` is retrieved **durably and automatically**, persisted safely, and processed through the **existing** CareerAIR product — without Warwick starting a session or reminding Larry. Wiring/ops repair only — no redesign of CV/fit/QA/rewrite/approval/submit/LinkedIn/browser. Acceptance journey: discover → self-load creds → persist before ack → no-dupe on restart → intake path → correct next governed state → no external consequential action → observable success/failure → resume from durable state → fresh session can read health/last success/pending depth/oldest age. | **MOSTLY DONE** | Funnel live → webhook auth+persist+dedupe+process proven; durable private install; fail-loud bot alert+recovery proven; ops state; task economics. Provider seam zapier active / outlook_connector DISABLED. **Residual:** one-time Zapier Zap UI create (2 Zaps, warwickallan account) if not already present — see private `ZAPIER-ACTIVATION.md`. Evidence: `Deliverables/2026-08-06-careerair-funnel-zapier-evidence.md` |
| **4** | **Live Cockpit production surface + truthful CareerAIR operational view.** Normal Cockpit route loads; core nav not regressed; Apps → CareerAIR opens; shows collector state, last success, pending count, oldest pending age, processing state, latest safe item summary/status, exact failure when unhealthy; “no messages” ≠ “collector unhealthy” ≠ “consumer not running”; same durable state as processor; survives service restart + cache refresh; health unhealthy when CareerAIR dependency missing. Executable browser journey required. | **MOSTLY DONE** | Overlay + private-api + email-ops + browser shoot. Re-verify strip after Funnel install. |

### ASSURANCE AND RELEASE SEQUENCE (not product requirements) — rows 5–7

| # | Step | Status |
|---|---|---|
| **5** | **Veritas Gate 1** — complete amended WP at stable exact head. | **HOLD** @ `f0d2614` — `Deliverables/2026-08-06-veritas-gate1-amended-wp-f0d2614-receipt.md` (rows 1/3/4 PASS; row 2 Zap residual; CI NOT RUN). **No Codex until Gate 1 PASS** |
| **6** | **Veritas Gate 2** — separate Phase 4 verdict at same head. | **HOLD** @ `f0d2614` — `Deliverables/2026-08-06-veritas-gate2-phase4-f0d2614-receipt.md` (mechanisms usable; PR#97 unmerged; not phase-complete) |
| **7** | **Codex + merge decision pack.** Warwick **authorises** final Codex after Gate 1 PASS. **No merge without Warwick’s explicit final authority.** | **BLOCKED** — Gate 1 PASS + CI green required first |

**Gate 1 PASS + Gate 2 HOLD is a valid outcome.** Do not call Gate 1 = Phase PASS.

### Explicitly OUT OF SCOPE (unless proven to block an acceptance journey above)

**C-1..C-9, C-11..C-15** · shopping projectors · general Builds/System projections · generic Telegram attention loop · withheld-capability demo · attention history · documentation privacy scanning · YouTube capture · unrelated Cockpit visual polish · replacement-machine disaster recovery · full IDEA-016 Cockpit programme · installing/chasing the next-WP Claude host hook (unless strictly required to preserve an already-proven file during merge prep).

Any newly discovered **unrelated** defect: record once in [[Deliverables/BACKLOG]] with evidence; continue this route.

### Prior mechanism evidence (banked — do not reopen without regression)

- WO route · DevBot · return-cue (Claude live / Grok Option C) · Watcher/Tower · `/rotate` + Supabase green — Gate 1 @ `0855e4e` isolation receipt and supporting Deliverables under `2026-08-06-*`
- Session report freeze: `Deliverables/2026-08-06-session-performance-report-rotate.md` · closing_head `3cf31c24…`

### Veritas / Codex dispatch law (this package)

**Gate 1:** map path · functional rows **1–4** · residuals · exact public head · private digest/surface · **separate PASS/HOLD/FAIL per Gate 1 dimension** · no narrowing · CI green + head frozen.  
**Gate 2:** BUILD-020 North Star · phase journey · estate vs branch · merge/install boundary · post-merge acceptance if any.  
**Codex:** only after Gate 1 PASS; Warwick has pre-authorised the final review for this package; still no merge without Warwick.

### 🎯 THE EXACT NEXT ACTION

1. **Unblock Gate 1 row 2:** fix Zapier Webhooks headers so POSTs include `X-CareerAIR-Token` (or `Authorization: Bearer`); ledger currently shows `missing_token` for inbound Zap-window POSTs. Re-Test until one `accepted` delivery. Ding **#344**.  
2. **CI green** at exact tip (runners were queued/NOT RUN at Gate 1).  
3. **Re-run Veritas Gate 1** at new tip if product advanced → then **Codex** → merge decision pack. Gate 2 already **HOLD** (valid with WP progress). Do not merge without Warwick.

### 📌 NEXT WORK PACKAGE (record only — do not execute in this Grok session)

Warwick launches a **fresh Claude Code session** after the present merge decision. That package will:

- start from updated main or explicitly approved post-merge state;
- align/install the identified Claude hook in the canonical Claude host/worktree;
- prove the live Claude return-cue journey from the merged source;
- run fresh-main orientation acceptance;
- verify installed-runtime/source alignment;
- complete any genuine residual **explicitly carried by Veritas Gate 2**;
- seek final Phase 4 closure where warranted.

**Name exact residuals, evidence and next actions into this section when Gate 2 returns — no vague dump.**

### 📌 Parked (not this WP)

**V4-9** · **C-1..C-9, C-11..C-15** · legacy `C:/.fusion247/larry-ding.mjs` · reminder-hook A/B/C product choice · next-WP Claude host hook install.
