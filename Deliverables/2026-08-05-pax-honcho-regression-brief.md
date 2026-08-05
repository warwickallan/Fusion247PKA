# Why did Honcho regress? — investigation brief

**Pax · 2026-08-05 · WO-2026-08-05-11 (+ Amendment 1) · governance head `65757c6`**
**Documentary half only.** Q-2 and the install-delta half of Q-3 are UNESTABLISHED and named as such — Mack's `EVIDENCE-2026-08-05-honcho-regression.md` had not landed when this was written.

---

## The answer

**We did not regress in correctness. Nothing broke.** The remote read now times out because a fixed 9-second per-request timeout meets a message store that has grown roughly 77% since that page size was chosen — the code comment at `continuity.mjs:682` still says *"today's 86 packets fit in ONE request"*, and the store's own sequence counter now reads **152**. The single most expensive request in the whole system, page 1 asking for 100 complete continuity packets, no longer reliably returns inside 9 seconds.

**What made this look like a regression rather than a slow-down is a separate, one-branch gap.** The failure path is the **only** render branch in `readContinuityBrief` that omits both the cached content's age and the "open the map" instruction that every other branch carries. So a twelve-hour-old focus was presented in the same visual register as a fresh one, and the session was left to orient from a Deliverables sweep without ever being told it was flying on stale recall.

---

## Q-1 — What exactly failed? **Two things, and one of them is not a fault**

Larry's framing conflates three items. They separate cleanly.

| | What | Verdict | Confidence |
|---|---|---|---|
| **A** | The remote Honcho read aborted | **Genuine failure** | High |
| **B** | `continuity.json` is ~12 h stale (`updated_at: 2026-08-05T09:54:14.545Z`) | **Working as designed — not a fault** | High |
| **C** | The fallback rendered B with no age and no instruction | **The defect that matters** | High |

**On A.** `continuity.mjs:931` composes the `UNAVAILABLE this session (<message>)` string inside a `catch`. The parenthetical is the caught error's own text. The only in-process abort site is `:111`, `setTimeout(() => ctrl.abort(), timeoutMs)`, with `READ_TIMEOUT_MS = 9000` at `:45`; `This operation was aborted` is Node/undici's `AbortError` text. **A missing credential is excluded by message discrimination** — `:109` throws the distinct `no HONCHO_API_KEY (looked in C:/.fusion247/honcho.env)`, which Warwick did not see. The private surface was never needed.

**A is narrower than it looks.** `listAllMessages:772-778` rethrows **only on page 1**; a later page breaks quietly and sets `complete: false`. So the abort came from page 1 (or `ensureStore`) — the largest single request in the system.

**On B.** `continuity.json` is the semantic state Larry maintains by explicit `write`; the Stop hook re-persists it to Honcho but does not refresh it. Its content is exactly as old as the last time Larry deliberately updated it. It faithfully held what it was last told. **Its contents confirm Larry's L-5 in full** — the `focus` names Phase 2 as live while `blockers`/`completed` describe BUILD-015 AsdAIr Gate 3 work.

**On C — the actual defect, in one comparison.** Four of the five render branches end by telling the reader where to go (`:895`, `:900`, `:914`, `:926` — *"orient from `Deliverables/` per `CLAUDE.md` Step 2"* / *"Open the map"*). The fifth, `:932-933`, renders `cached.focus` and stops. It has already parsed the whole state file — `updated_at` is in hand and discarded. **Every branch that succeeds says what to do; the one branch that fails does not.** That is precisely how a failed primary came out looking like a degraded success.

**Independent corroboration that A is about the read and not the service.** `continuity-last.json` records packet `cont-1785962741497-152-dxrlo7` written **`2026-08-05T20:45:44.278Z`** — 21:45 local, minutes from the failing session's start. **A write succeeded while a read aborted, on the same network, same credential, same minute.** A write is one small POST; a read is a 100-packet page. Honcho's own status page records no incident in that window (its only 4–5 August event was scheduled maintenance, 4 Aug 14:30–17:20 UTC, over a day earlier). Two independent sources point away from the service and at the cost of our own read.

---

## Q-2 — What was different at the Phase 1→2 respawn? **UNESTABLISHED as a code delta; a data delta is the leading candidate**

**I cannot answer the code half. I hold no `Bash` and cannot read `git log`.** Mack's item 9 owns it. I have not approximated it.

The candidate I *can* evidence is that **the delta is in the data, not the code.** `LIST_PAGE_SIZE = 100` and the store's growth put the read on a page boundary: at 86 packets the read was **one request**; at 152 sequence numbers it is **two or more**, and page 1 itself carries ten times the payload it was sized against. The failure probability rises every session, because every session appends a packet. Nothing had to change in the code for this to stop working.

**Confidence: Medium.** `seq 152` and the `86 packets` comment are both facts. The store size *at the respawn* is not established — and it is the single most decision-relevant unknown in this brief.

---

## Q-3 — Did Phase 2's own work cause it?

**Q-3a (adopted as primary) — the fixed timeout meeting a grown dataset. LEADING. Medium-High.**
Mechanism established from code end to end. Not established: the actual elapsed time of the failing request, because **no governor log exists** — verified by enumerating the whole granted machine surface `C:\Users\Buggly\.mypka\**`; the only log there is Tower's `watcher.log`, a different subsystem.

**Q-3b (write-authority race) — NOT the cause, but it produced a real secondary finding. High.**
The guard cannot suppress a *read*. But `writeContinuity:596-612` performs a **full `readLatest` inside the write path** whenever `map_path` is set, wrapped in a `catch` that falls back to an unconditional write. Two consequences worth recording: Phase 2 **doubled the network work at every session end**, adding the expensive read to the Stop hook; and **the guard is silently inert exactly when the read is slow** — which is now the normal condition. Phase 2's own fix is being disabled by Q-3a, and nothing would report it.

**Q-3c (stale install) — largely EXCLUDED. Medium-High.**
`INSTALLED-FROM.txt` records *"RESYNCED 2026-08-05 from post-merge main `c21c3f3` … All 8 files byte-verified"*, which also explains the 21:25 install mtime Larry observed. I independently compared the installed copy against the repo at five load-bearing regions — lines 45, 111, 682, 685 and the entire `926-937` fallback block — **identical, at identical line numbers**. A byte-level diff remains Mack's item 10.

---

## Q-4 — What did Phase 2's acceptance establish, and what did it miss? **High**

*Scope note, per Amendment 1 A-1: this states what the gate's question covered. It does not re-read the receipt for correctness, judge the verdict, or assess whether Veritas performed properly — that would reopen Phase 2, which Warwick forbade.*

The gate asked S-1..S-5 — *"can Warwick do the thing this phase promised"* — and answered it by **one successful execution** of `readContinuityBrief()` against the live store. Its own row records the result as *"Renders the correct current map pointer and today's real focus, content age 9h18m at read time — not stale, not a guess."*

So the PASS establishes: **the path works, end to end, once, in the real context.** It does not establish, and did not ask about: **repeatability** (the operation was never run twice, so no latency or timeout exposure could surface); **cost** (no request was timed, and no measurement of the store's size or growth was taken); or **the failure branch** (the `:929-936` fallback was never exercised, so nothing tested what a failed read *tells the reader*).

**The honest answer is the third of the three the order offered, with a qualification.** The fault did not arrive afterwards — it was already latent and already growing at the moment of the PASS, and the receipt even recorded a 9h18m content age without that being the gate's question to ask. **The gate's question was a single-sample availability question. The property that failed is reliability-under-growth plus fallback honesty. Neither was in the question.**

---

## What remains UNESTABLISHED

1. **The code delta between the Phase 1→2 respawn and now** — no `git` access. Mack item 9.
2. **The store size at the respawn** — the pivot for Q-2; needs a Honcho read, which is barred.
3. **The elapsed time of the failing request** — unrecoverable; no governor log exists anywhere under `~/.mypka/**` (established, not assumed).
4. **Byte-level install parity** — Mack item 10. My check was line-level over five regions.
5. **Whether the 20:45:44Z write had its authority guard active or silently bypassed.**
6. **Whether this particular abort was inevitable or a one-off.** The evidence establishes that the read is expensive and on a monotonically worsening trajectory. It does not establish that *this* request had to fail. **This does not change the recommendation**, which is right under either.

---

## The smallest change — a recommendation, not an instruction

**Change the failure branch to say what every other branch already says.** At `continuity.mjs:932-933`, the cached state is already parsed and `fmtAge()` already exists in the module (`:453`, used at `:913` and `:920`). Render the cached focus **with its age**, and add the same *"orient from the map per `CLAUDE.md` Step 2"* line the other four branches carry.

**That is roughly two lines, in one function, using a helper already in the file.** No new checker, monitor, validator, registry, role or document. It converts a silent degradation into a loud one, which is the property W-1 and N-2 exist to protect — and it is correct whether or not Q-3a proves to be the whole story.

**A second-order option, named and explicitly NOT recommended yet:** the brief only ever needs `packets[0]`, and with `reverse=true` the newest packet is on page 1 — so the full walk is arguably unnecessary for this caller. Reducing what page 1 asks for would cut the cost directly. **But** `contentTimestampFrom` uses the walked history to find when the content last *changed*, so this is not free, and it touches a path Phase 2 proved. **Do not act on it before Mack's timing evidence.** Larry decides the fate of both; I decide neither.

---

## What this means for Phase 3 (§15.3c / §15.3d)

**This is a clean, small, non-hypothetical case for the delivery-tax investigation, and it points away from more process.** The Phase 2 gate ran more than twenty distinct verification commands against the real machine, the real repository and the real running processes — and still could not have caught this, because **not one of them ran the same operation twice or measured what it cost.** More documentation would not have found it. One repeat would have.

The generalisable lesson, offered for §15.3d and for nobody to build anything from: **a single successful sample proves a capability exists; it says nothing about whether it will still exist next week.** Where a system accumulates state on every use — and this one appends a packet at every session end — the acceptance question *"does it work"* and the real question *"does it keep working as it grows"* are different questions, and only the first was ever asked.
