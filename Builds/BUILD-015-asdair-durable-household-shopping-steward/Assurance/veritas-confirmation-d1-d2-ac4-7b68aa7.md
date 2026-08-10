---
build: BUILD-015
scope: focused confirmation of the three named blocking items from the 3696960 receipts — AC4 mutation record, D-2 stale map pointers, D-1 reachable checklist surface
gate: 1 (AC4, D-2) and the Gate 2 Q2 question (D-1 / J-1), in one receipt as dispatched

boundary: WO-2026-08-10-B15-04 / -05 and the B15 live-readiness phase — the outcome promised being that the mutation evidence names what it proved, that the map's ACTIVE SESSION WORK PACKAGE orients a fresh session truthfully, and that Warwick can tap through from the handover card to a checklist he can read.

reviewed_sha: 7b68aa7701bb961f7e6098550bc860e34227d24c
governance_sha: 7b68aa7701bb961f7e6098550bc860e34227d24c
branch: main

evidence_method: mixed — repository working tree at the reviewed head, plus the LIVE runtime (Cockpit over the real tailnet origin, and the running `runtime.js` process inspected by process table only)
evidence_workspace: none — no export taken; no mutation applied by Veritas
worktree_head_at_start: 7b68aa7701bb961f7e6098550bc860e34227d24c
worktree_head_at_end: 595e5f9d596bc4c71bf32f02e70c326e0dd641b1
worktree_status_clean: true
head_moved_during_review: true — 7b68aa7..595e5f9 is `d1779f7` + `595e5f9`, BOTH session-log only (`git diff --stat` = one file, `Deliverables/...night-shift...md`, 22+/5-). No product file, test, configuration or runtime wiring differs between the two heads, so every source finding below holds at both. Recorded rather than smoothed over.

verdict: HOLD
receipt_sha256: <stated in the return>
reviewed_by: veritas
reviewed_date: 2026-08-10
next_review_trigger: ONE focused confirmation that the handover card, as emitted by the RUNNING pipeline process, carries an absolute tappable URL. Nothing else. A receipt, a session log, a documentation repair or a further clerical commit is NOT a trigger.
---

## Scope reviewed

**Exactly the three items named in the dispatch, and nothing else.** The six acceptance criteria that
passed at `3696960` are **not re-graded**; the non-blocking findings parked there stay parked; no new
area was opened. One incidental observation is recorded at the foot and is explicitly non-blocking.

## Accepted requirements — the three corrective items

| # | Item | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **AC4** | The mutation record must exist and must name the assertion M4 left unproven | **CONFIRMED — hold discharged** | `Builds/BUILD-015-.../Assurance/mutation-record-2026-08-10.md`, committed at `43966a9`. It names the assertion by name — the duplicate guard, *"a duplicate receipt carrying DIFFERENT words must not count as settled"* — and explains why M4 was ineffective (the `let recorded = true` initialiser is overwritten by the `if (duplicate)` branch on the next line). Corroborated independently in the tree: the test exists with **exactly** the title in the pasted output, `services/asdair/pipeline/runPipeline.test.js:1806`; the mutation target `recorded = await recordedAnswerMatches(deps, {…})` exists at `services/asdair/pipeline/runtime.js:1212` and is the assignment the duplicate assertion depends on, so disabling it is a reachable mutation and `not ok 269` / 385-384-1 is the shape that would result | **Declared, non-blocking:** only the one row is independently executed. M1–M3, M4b and the whole B15-05 ledger are **builder-reported and transcribed, not re-executed** — by anyone. The record says so itself, per row. That is a stated limit, which is what the contract asks for; it is not a hidden one. I did not re-run any mutation myself |
| **D-2** | The map's ACTIVE SESSION WORK PACKAGE must not misdirect a fresh session | **CONFIRMED — hold discharged** | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`: the false sentence is **struck through in place** at `:1180-1181` and superseded immediately below with the branch's merged state evidenced (`git rev-list --count main..b15-3/integration` = 0, worktree removed, mirrored to `origin/backup/2026-08-10-local-main-safety`); the red GATE 1 banner now reads **`— HISTORICAL`** *in its own heading* and is preceded by an explicit `✅ SUPERSEDED 2026-08-10 … this HOLD is DISCHARGED. The block below is HISTORY, not current state.`; the table header reads `Delivered — now on main (was b15-3/integration @ 318e0e3)`. **The supersession does not overstate:** the block restates, in its own words, that AC4, AC7 and Gate 2 were still held, so it cannot be read as "everything passed". Swept for survivors — the only two remaining occurrences of `b153-int` / `Unpushed` in the file are *inside* the struck-through text and inside the sentence that corrects it | **None blocking.** Now that AC4 and D-2 are discharged, that "what is NOT discharged" list is itself one item ahead of reality — record it once, repair it at the scheduled reconciliation, do not open a cycle for it |
| **D-1** | Warwick must be able to reach the rendered checklist without asking Larry | **STILL HELD** | See below — the destination is proven; the tap is not | **Blocking** |

## D-1 — what is proven, and the one thing that is not

**Proven, by execution against the real tailnet origin Warwick's phone would use:**

| Command | Result |
|---|---|
| `curl -sk -w "HTTP %{http_code} …" "https://warwick-yoga.tailbc1fe3.ts.net:8443/api/asdair/checklist?shop=SHOP-2026-08-09"` | **HTTP 200**, `content-type: text/plain; charset=utf-8`, 118 bytes |
| body | `# No checklist yet` / blank line / real prose — **rendered markdown with genuine newlines** |

**The `JSON.stringify` defect is genuinely fixed.** The body came back as readable text, not a quoted
one-liner with literal `\n`. The proxy exists (`services/cockpit/asdair-checklist.mjs`, imported and
routed at `services/cockpit/server.mjs:37`) and is live on the running Cockpit (PID 23640, started
02:48:06). The card path was moved to the proxied route — `runPipeline.js:2095` now emits
`` `/api/asdair/checklist?shop=${shop.shop_ref}` ``. `withChecklistUrl` (`runtime.js:972-981`) is
correct and conservative: it prefixes only a relative path, leaves an absolute one alone, and with no
base configured it returns the payload untouched rather than inventing a host.

**Not proven — and the observable evidence points the wrong way.**

The link depends entirely on `bot.checklistBaseUrl`, read **once, from the process environment**, at
`runtime.js:1452`: `process.env.ASDAIR_COCKPIT_BASE_URL || null`. The variable is set at **User**
scope — `[Environment]::GetEnvironmentVariable('ASDAIR_COCKPIT_BASE_URL','User')` returns
`https://warwick-yoga.tailbc1fe3.ts.net:8443`. **That is not the same thing as the running service
having it.**

Executed:

```
node -e "console.log('inherited-env:', JSON.stringify(process.env.ASDAIR_COCKPIT_BASE_URL))"
inherited-env: undefined
```

A node process spawned from a tool shell **right now**, with the User variable set, does **not** see
it. That is standard Windows behaviour: a User-scope registry write does not propagate into
already-running processes, and a child inherits its **parent's** environment block, not the registry.

The pipeline service is `PID 4648 — node C:\Fusion247PKA\services\asdair\pipeline\runtime.js --watch`,
**with no `--env-file`**, created **10/08/2026 02:50:10**, parent `PID 32412` — **which no longer
exists**, i.e. a transient tool-spawned shell of exactly the kind demonstrated above to carry a stale
environment block.

I could not read PID 4648's environment directly, and I will not claim I did. So the honest statement
is: **it is unproven that the running pipeline holds the variable, and the one measurement available
points against it.** If it does not hold it, `withChecklistUrl` correctly returns the payload
untouched and the card carries the bare path `/api/asdair/checklist?shop=…` — **which is D-1
unmoved**, one layer further out.

Two things make this unresolvable from the outside rather than merely unknown:

- **It is not observable.** `runtime.js` never logs, exposes or health-reports the base URL — grep for
  `createServer` / `listen(` / `/health` in it returns nothing, and there is no log file under
  `services/asdair` newer than 2026-08-10. Nobody, Larry included, can tell from outside whether the
  next card will carry a link or a bare path.
- **The real production event has not run.** `/api/asdair/checklist?shop=SHOP-2026-08-09` returns
  `not_handed_over`, so no handover card has been emitted through the live bot since the fix. Nothing
  has exercised the send path, which is the only place the base URL is applied.

That is root `CLAUDE.md` § "Nothing may live only in Larry's head" on its own terms: *credentials and
configuration must come from a stable approved runtime · success or failure must be observable · a
fresh session must use it without being reminded · acceptance must exercise the real production
event.* A User env var that a tool-spawned relaunch does not inherit, feeding a value nothing reports,
never exercised by a real send, meets none of the four.

**Blocks:** telling Warwick the tap-through works, and marking AC7 / D-1 / J-1 complete. **It does not
block** anything else on the live route.

## Assurance dimensions — the three items only

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | HOLD | AC4 and D-2 land; the human-reachable checklist, which is the goal of D-1, does not yet demonstrably reach the human |
| Design fidelity | PASS | The proxy shape, the relative-path-only join, and "unset renders the bare path rather than a plausible host" are all the right calls |
| Functional proof | PASS *for the destination*, HOLD *for the tap* | HTTP 200 with readable markdown over the real tailnet origin; the card's absolute URL unexercised |
| Integration | HOLD | Every hop from card → proxy → read service → renderer now exists; the hop that supplies the origin is unproven in the running process |
| Durability | HOLD | A User env var not inherited by the service's own relaunch route is not a stable approved runtime; the next restart is a coin toss nobody can observe |
| Test quality | PASS | `runtime.test.js:1751-1771` pins the join, the trailing slash, the null and blank base, the absent path and the already-absolute case. The disclosed control defect — the first gate assertion matched the *import* line, so deleting the dispatch left it green — is fixed and pinned, and `asdair-checklist-check.mjs` now carries a `--self-test` that feeds each source assertion a mutant and requires it to reject. **The comment at `:53-54` records why, in the file itself.** That is the right repair |
| Git truth | PASS | Reviewed head clean; the two commits that landed mid-review are session-log only and recorded above |
| Documentation truth | PASS *for D-2* | The supersession is done in place, the historical block is labelled in its own heading, and the live holds are restated inside it |
| Residual risk | PASS | The mutation record's non-uniform provenance is declared per row rather than averaged into a claim. That is the correct handling |
| Completed automation | **HOLD** | The checklist link is intended to be automatic. The real production event has not invoked it, the configuration does not come from a stable approved runtime, and failure is silent — the card simply degrades to an unopenable path with nothing reporting it |

## Production caller and journey

`runPipeline.js:2095` writes `checklistPath` into the durable outbox payload (no host — correct) →
`runtime.js:1036` `drainOutbox` renders it through `withChecklistUrl(item.payload,
bot.checklistBaseUrl)` at send time → **[UNPROVEN HOP: `bot.checklistBaseUrl` in PID 4648]** → Telegram
card → tap → Cockpit `server.mjs:37` `proxyAsdairChecklist` → read service → rendered markdown. **Every
hop except the bracketed one was executed or read at the reviewed head.** The tail of the journey — the
URL itself — I executed live and it returns 200 with readable prose.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1a** | **HIGH** | The checklist link's origin depends on a User-scope env var that the service's own relaunch route demonstrably does not inherit, is never logged or health-reported, and has never been exercised by a real send. **Blocks:** any claim that Warwick can tap through | **blocking** | Larry to dispatch — the shape is his, but the properties owed are: the value reaches the running process from a stable approved runtime, and the running service *reports* it |
| **N-1** | LOW | The map's superseded block still lists AC4 as not discharged. True when written, one item stale now | **non-blocking** — scheduled reconciliation | Larry |
| **N-2** | LOW | `mutation-record-2026-08-10.md` rows M1–M3, M4b and all four B15-05 rows are transcribed builder ledgers, never independently re-executed. Declared in the record itself | **non-blocking** — a declared limit, not work | — |

## Verdict

**HOLD** — **AC4 CONFIRMED, D-2 CONFIRMED, D-1 STILL HELD.** Two of the three corrective items are
genuinely discharged and well done. The third is closer than it was — the proxy is live, the response
is readable markdown over the real tailnet origin, and the card emits the proxied route — but the hop
that turns that route into a tappable link is unproven in the running process, unobservable from
outside, and never exercised by a real send.

**Gate 2 Q2 — can Warwick tap through and reach a checklist he can read?** **NOT YET.** He can reach
and read it *if handed the URL*; that half is proven. The tap is not.

**Queue effect** (root `CLAUDE.md` §Finding disposition): this gates completion, closure, PASS and
Codex for **D-1 / AC7 / J-1 only**. AC4 and D-2 are discharged and are not to be reviewed again. It
does not block safe continuation elsewhere, and the frontier remains the Wayfinder's.

## Next review trigger

**ONE focused confirmation of D-1a**: that the handover card, as emitted by the **running** pipeline
process, carries an absolute URL — with the base value arriving from a stable approved runtime and
observable from outside the process. Nothing else reopens this. A receipt, a session log or a
documentation repair is not a trigger.
