# Why did Honcho regress? — investigation brief

**Pax · 2026-08-05 · WO-2026-08-05-11 (+ Amendment 1) · governance head `65757c6`**
**Revision 2** — completed with Mack's executable evidence (`Deliverables/proofline/EVIDENCE-2026-08-05-honcho-regression.md`, committed `6156127`). Q-2 and the install-delta half of Q-3 are now closed. Two questions remain open and **both need a Honcho network call, which is barred**; they are named below, not estimated.

---

## The answer

**We did not regress in correctness, and no code in the regression window is implicated in what Warwick saw.** Mack's `git log -S` is decisive: the 9,000 ms timeout, the `AbortController` and the `UNAVAILABLE` string are unchanged since `421053b` on 2026-08-01 — four days before the incident, before the window even opened. **The code that aborted is the code that worked.** What changed is the data it reads: the store was 86 packets when `LIST_PAGE_SIZE = 100` was chosen (the comment at `continuity.mjs:682` still says so) and is at **seq 152** now.

**What turned a slow read into an apparent regression is a one-branch gap.** The failure path at `:932-933` is the only render branch that omits both the cached content's age and the "open the map" instruction the other four carry. A twelve-hour-old focus was presented in the same register as a fresh one.

**And a second, independent defect exists that did not fire on the night but is the bigger risk.** Mack found it: `744a67a`'s write-authority guard can strip `map_path` from packets. It would break the same promise by a different route, with no read failure at all.

---

## Q-1 — What exactly failed? **One fault chain fired. A second defect exists and did not.**

| | What | Verdict | Confidence |
|---|---|---|---|
| **A** | The remote read aborted | **9,000 ms client-side timeout on page 1** | **High** |
| **B** | No map pointer; Deliverables sweep instead | **Consequence of A on this occasion** | **High** |
| **C** | The fallback rendered stale focus with no age, no instruction | **The defect that made A invisible** | **High** |
| **D** | `continuity.json` ~12 h stale | **Not a fault** — `stop` structurally cannot write it | **High** |

**A is established, not inferred.** Mack reproduced `AbortError: "This operation was aborted"` locally on Node v22.18.0 with no network; it is the only `AbortController` in the path (`:110-111`). A missing credential produces the visibly different `no HONCHO_API_KEY (looked in C:/.fusion247/honcho.env)`; an HTTP error names method, path and status. Neither was seen. **Neither of us opened the private surface, and neither of us needed to.** It failed on **page 1** specifically — `listAllMessages:772-776` propagates only a page-1 failure; a later page would have rendered `⚠️ PAGINATION INCOMPLETE` instead.

**D is settled, and Larry's sharpest lead was a false one.** `continuity.mjs:1127` sets `writeArgs = null` for every command except `write`, and `:1192-1193` is the only `saveState` call. **`stop` can never write `continuity.json`. Not conditionally — ever.** It is stale because nobody ran `continuity.mjs write` since 10:54. An operating gap, not a code fault. I reached this from the code independently; Mack's execution confirms the mechanism.

**C remains the defect that matters.** Four of five render branches end by telling the reader where to go (`:895`, `:900`, `:914`, `:926`). The fifth renders `cached.focus` and stops — having already parsed `updated_at` and discarded it. **Every branch that succeeds says what to do; the one branch that fails does not.**

---

## Q-2 — What was different? **Answered. Nothing in the code.** *(High)*

Mack's git evidence closes this, and it closes it in the direction that matters:

- **`git log -S 'READ_TIMEOUT_MS'`, `-S 'ctrl.abort()'`, `-S 'HONCHO CONTINUITY: UNAVAILABLE'` → all three return `421053b`, 2026-08-01, and nothing since.**
- `git diff --stat 65757c6..c39825c -- tools/governor/` → empty.

**A regression with no code delta has an environmental or data delta.** The only one measured is growth: 86 packets → seq 152, a ~77% increase against a fixed 9-second budget and a fixed 100-item page.

**Mack raises one objection to this and it does not survive.** He writes that the growth reading *"cuts against itself — the failure was on page 1, which existed before the growth."* Page 1 existed; **page 1's cost did not stay the same.** With `reverse=true, size=100`, page 1 returned 86 packets then and returns 100 now — and the packets themselves have grown, since `continuity.json` is 3,449 bytes and every packet embeds that state. Page 1 is now on the order of **340 KB in a single response**. It is the most-growing request in the system, on two axes at once. His objection would hold only if its cost were constant.

**Still not measured: the actual latency.** See M-2.

---

## Q-3 — Did Phase 2's own work cause it?

**Q-3a (the fixed timeout meeting a grown dataset) — LEADING for symptom A. Medium-High.** Mechanism established end to end from code; strengthened by Q-2's decisive negative and by the write/read control below. Unmeasured: elapsed time. **No governor log exists anywhere under `~/.mypka/**`** — Mack enumerated the whole tree; the only log is Tower's `watcher.log`, which returns zero matches for `honcho|continuity|abort`. A failed Stop delivery leaves no durable trace at all.

**The natural control that points away from the service.** `continuity-last.json` is written **only** on `r.ok`, and it records packet `cont-1785962741497-152-dxrlo7` at **`2026-08-05T20:45:44.278Z`** — a 2.8-second round trip, in the same minute as the failing read. **A write succeeded while a read aborted: same host, same credential, same `hf()`.** A write is one small POST; a read is a ~340 KB page. Honcho's own status page records no incident in the window (its only 4–5 August event was scheduled maintenance, 4 Aug 14:30–17:20 UTC, over a day earlier). Two independent sources point away from the upstream and at the cost of our own read.

**Q-3b (the write-authority guard) — NOT the cause of A, and Mack and I agree on why.** It cannot suppress a write: its only effect is `delete packet.map_path`, and it **fails open** — with no valid start time, or when the read throws, `map_path` is kept and `deliver()` runs unconditionally. My separate finding stands and is not contradicted: `writeContinuity:596-612` performs a **full `readLatest` inside the write path**, so Phase 2 **doubled the network work at every session end** and made its own guard **silently inert exactly when the read is slow**. Mack answered *"can it suppress the write"* (no); I answered *"what does it cost, and when is it inert"*. Both hold.

**Q-3c (stale install) — DEAD, not "largely excluded". High.** All eight files byte-identical to the git blob at **both** `c21c3f3` and `65757c6`. The apparent size delta was CRLF in the worktree — the per-file deltas match the CRLF census exactly, eight for eight. My line-level check was right; Mack's raw-sha256 comparison settles it.

---

## The reconciliation Larry asked for: ONE fault or TWO?

**Mack's evidence file contradicts itself here, so this cannot be resolved by deferring to it.** §1 and §12-3 say *"symptom B follows mechanically from A"*; §12's closing hypothesis says *"two independent faults"* and *"symptom B would reproduce even with Honcho fully healthy."*

**Both halves are true of different things, and the rendered string tells them apart.**

- **For the observed incident: one fault chain.** Once `readLatest` throws, control reaches the `catch` at `:929`, and the map pointer is only ever built on the success path above it. Decisively: had `map_path` stripping been the cause, the render would have been `:900` *"map path missing or invalid"* or `:914` *"recorded map NOT PRESENT in this checkout"* — **distinctive strings Warwick did not see.** He saw the `catch` branch's string. Same message-discrimination method that excluded the credential. **On 2026-08-05, B followed from A.**
- **As a standing defect: Mack is right, and it is serious.** I verified his mechanism against the code. `priorWriteMs` is the newest *stored* packet from any session; after a session's first delivered packet, `priorWriteMs` advances past that session's own start, so `sessionStartMs > priorWriteMs` is false thereafter and `map_path` is stripped from every later packet that session writes. `readLatest` returns the newest packet. **Had the read succeeded, Warwick may well have got "map path missing or invalid" anyway.**

**So: I accept Mack's claim that two distinct causal mechanisms exist, and I reject his framing that both fired on 2026-08-05.** The evidence discriminates, and it should not be blurred.

**Two refinements to his hypothesis, both drawn from his own evidence, both narrowing it:**

1. **The dedupe bounds the rate.** `stop` first hashes `(focus, next_action, decisions, completed, blockers, sessionId)` and returns having written nothing if unchanged (`:1198-1211`). In a session where the semantic state never changes, only the **first** `stop` writes — and that packet **keeps** its `map_path`. The stripping bites only where state changes more than once in a session. "Every subsequent packet" overstates it.
2. **The two defects partially mask each other.** When the `readLatest` inside `writeContinuity` times out, the guard fails open and `map_path` is **kept**. So a slow Honcho *suppresses* the stripping defect. That is very likely why neither was visible until now, and it is the strongest reason M-1 must be measured rather than reasoned about.

**Does this change the recommendation? No — and the reason is worth stating.** The stripping defect renders on the **success** path, at `:900`/`:914`, which already carry an honest diagnosis and an orientation line. **That defect is already loud.** It needs a correctness fix, not an honesty fix. Two different changes, two different decisions; conflating them would repeat the error of conflating the symptoms.

---

## Q-4 — What did Phase 2's acceptance establish? *(High)*

*Scope note, per Amendment 1 A-1: this states what the gate's question covered. It does not re-read the receipt for correctness, judge the verdict, or assess whether Veritas performed properly — that would reopen Phase 2, which Warwick forbade.*

The gate asked S-1..S-5 and answered by **one successful execution** of `readContinuityBrief()` against the live store, recording the result as *"content age 9h18m at read time — not stale, not a guess."*

**The PASS establishes that the path works, end to end, once, in the real context.** It did not ask about **repeatability** (the operation was never run twice, so no timeout exposure could surface), **cost** (no request was timed, no store size measured), or **the failure branch** (`:929-936` was never exercised, so nothing tested what a failed read tells the reader).

**The gate's question was single-sample availability. The properties that failed are reliability-under-growth and fallback honesty. Neither was in the question** — and the fault was already latent and already growing at the moment of the PASS.

---

## The two measurements that remain open — both barred here

**Neither is estimated below. Both need an authenticated Honcho read; `credential_scope: none`, and no reproduction attempt is permitted under this order.**

| | Measurement | What it decides |
|---|---|---|
| **M-1** | **Do the packets currently in Honcho carry `map_path`?** | Whether the `744a67a` stripping defect is **live in the data** or merely latent. If the newest stored packets lack `map_path`, N-2/N-3 is broken **independently of the timeout** and the correctness fix is urgent. If they carry it, the defect is bounded by the dedupe and by the fail-open masking, and it is a hardening item. **Highest value of anything remaining.** |
| **M-2** | **Actual elapsed time of a page-1 list request at the current store size — repeated, not sampled once.** | Whether 9 s is **marginal** (the growth reading holds; this will recur and worsen every session) or **comfortably clear** (the abort was a transient one-off and the growth reading is wrong). A single sample cannot decide it — which is precisely the Q-4 lesson. |

Everything else Mack listed as open (hook merge-vs-replace semantics, the `c9c41ae` diff, the health-store root-identity split) is documentary, does not bear on Warwick's question, and is Larry's to schedule.

---

## The smallest change — a recommendation, not an instruction

**One change, now.** At `continuity.mjs:932-933`, render the cached focus **with its age** — `fmtAge()` already exists in the module at `:453` and is already used at `:913` and `:920`, and `updated_at` is already parsed — and add the same *"orient from the map per `CLAUDE.md` Step 2"* line the other four branches carry. **Roughly two lines, one function, no new file.** No checker, monitor, validator, registry, role or document family. It converts a silent degradation into a loud one, and it is correct whether or not Q-3a proves to be the whole story.

**One thing to decide, not to do.** The `744a67a` stripping defect is a **correctness** question, not a visibility one, and **M-1 decides whether it is urgent or latent.** Proposing a code change to it before that measurement would be guessing. **Larry decides the fate of both; I decide neither.**

**Explicitly not recommended:** reducing what page 1 asks for. It would cut the cost directly, but `contentTimestampFrom` uses the walked history to determine when content last *changed*, so it is not free, and it touches a path Phase 2 proved. **Not before M-2.**

*Two items outside my scope, recorded once because neither Mack nor I should close them: `INSTALLED-FROM.txt` misdescribes the machine (the project-level settings file was not removed; the governor entries were removed from inside it), and `C:\Fusion247PKA-build-020-trial\.claude\settings.local.json` carries a standing `Read(//c/.fusion247/**)` grant that may deserve a GL-012 look. Larry's calls.*

---

## What this means for Phase 3 (§15.3c / §15.3d)

**This is a small, clean, non-hypothetical case for the delivery-tax investigation, and it points away from more process.** The Phase 2 gate ran more than twenty distinct verification commands against the real machine, the real repository and the real running processes — and could not have caught this, because **not one of them ran the same operation twice or measured what it cost.** More documentation would not have found it. One repeat would have.

Two lessons, offered for §15.3d and for nobody to build anything from:

1. **A single successful sample proves a capability exists; it says nothing about whether it will still exist next week.** Where a system accumulates state on every use — and this one appends a packet at every session end — *"does it work"* and *"does it keep working as it grows"* are different questions, and only the first was ever asked.
2. **Two defects that mask each other are invisible to component testing and to a single end-to-end sample alike.** The slow read suppressed the `map_path` stripping; the stale cache made the slow read look survivable. Each fault was hiding the other — which is why the phase closed clean and the next session did not.
