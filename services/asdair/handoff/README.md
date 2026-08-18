# AsdAIr — the Sonnet browser handoff

**BUILD-015, Workstream E.** Turns a Sonnet Browser Execution Packet into one durable handoff
artefact, wraps the supervised browser step in a single-writer claim/progress/completion
lifecycle, and ingests what Sonnet reports back into the reconciler's input.

> # 🔴🔴 SUPERSEDED 2026-08-17 — Warwick's product ruling. **Read the goal contract first, not this file.**
>
> **Canonical:** `Builds/BUILD-015-.../BUILD-015-goal-contract.md`, re-cut whole 2026-08-17 — register
> entries **S-9** and **S-10**.
>
> **AsdAIr is Mum's autonomous AI shopping operator. It operates the live ASDA browser itself and chooses
> its own execution mechanism. CDP is AUTHORISED.** There is no designated external basket writer.
>
> ⛔ ~~"The Stage 1 live basket writer is **Sonnet in Claude for Chrome**. Not Larry, not a Claude Code
> subagent, and **not** the custom CDP runner at `services/asdair/browser-runner/`, which is excluded from
> the live route and prohibited from further live-account testing."~~ — **SUPERSEDED. The CDP exclusion is
> LIFTED.** *(The statement that this module imports nothing from the runner remains a true fact about the
> code.)*

---

## ~~THERE IS NO PROGRAMMATIC SONNET TRIGGER HERE, AND THAT IS NOT AN OMISSION~~ ⛔ SUPERSEDED AS AN ARCHITECTURAL CONCLUSION, 2026-08-17

> **The FACT below stands: Claude for Chrome has no programmatic invocation surface.**
>
> **The CONCLUSION does not.** Under the 2026-08-17 North Star, **a route that cannot be invoked by the
> system is DISQUALIFIED from the runtime.** An un-invokable route is not an honest compromise — it is a
> route that fails the product contract. The heading was right about the mechanism and wrong about what
> follows from it.

**Claude for Chrome has no programmatic invocation surface. This module does not invent one and
makes no claim of unattended browser execution.**

The evidence already in this repository:
`services/asdair/browser-runner/EXPERIMENT-RESULT.md` records the Claude-in-Chrome extension as a
**host-level binding**, *"proven unreachable from a subagent (2026-07-28 probe) and unavailable to
any independent process."* That is a **fact about that mechanism**, and it is exactly why the
2026-08-17 ruling **disqualifies** the route rather than accommodating it.

> ⛔ **SUPERSEDED 2026-08-17 — the paragraph below described the module's purpose as a SUPERVISED
> hand-off to a human-started browser session. Supervision is no longer the acceptance bar** (goal
> contract **S-1, S-2, S-4**), and **a route the system cannot invoke is disqualified** (**S-9**).
>
> **What this module still legitimately delivers:** one durable, deterministic, ordered artefact
> that nobody has to explain, sort, translate or reconstruct — **produced by the product itself and
> never hand-assembled by a Claude session.** Its consumer is now **whichever executor AsdAIr
> chooses**, the authorised CDP runner included. The artefact is not superseded; the *human opens
> the browser and pastes it* delivery model is.

~~So what this module delivers is the honest thing instead: **the smallest truthful supervised route
that removes Larry completely.** One durable artefact, ready before Warwick opens the browser, which
nobody has to explain, sort, translate or reconstruct. Warwick opens Sonnet, pastes or points it at
the artefact, and the shop runs. A fake "trigger" would be worse than building nothing.~~

⛔ **SUPERSEDED 2026-08-17 (register entry S-10). None of the three is acceptable as the normal path.**
Starting the browser session and driving it are **AsdAIr's**. The substitution pass is governed by the
never-auto-substitute rule plus ask-Warwick-on-genuine-ambiguity — **not by a standing human step.**

~~**What is still human, stated plainly:** starting the browser session, giving Sonnet the artefact,
and the substitution pass before purchase.~~ **What is no longer human:** preparing, ordering,
validating, tracking and reconciling the work.

---

## The three parts

### 1. The artefact — `buildHandoff(packet)`

Pure. Same packet in, byte-identical artefact out; `generated_at` is copied from the packet and no
clock is read. That determinism is what makes the handoff idempotent.

It is **one** artefact with two renderings: the returned object *is* the machine-readable form once
`JSON.stringify`d (Sonnet consumes it as instructions), and `renderChecklist()` renders that same
object as phone-readable Markdown. Neither can drift from the other because there is one source.

It **asserts** rather than trusts:

| Checked | Refusal code |
|---|---|
| Lines really are in normalized-brand A–Z, NULL brand last, then product A–Z | `SORT_CONTRACT_VIOLATED` |
| `sort_contract`, when declared, is one this consumer can verify | `UNKNOWN_SORT_CONTRACT` |
| A known item that **has** a valid ASDA reference is not routed to free search | `KNOWN_ITEM_SENT_TO_SEARCH` |
| A known item carries its catalogue **identity** | `KNOWN_WITHOUT_ID` |
| An ASDA reference, where present, is 3–12 digits | `KNOWN_WITH_MALFORMED_ASDA_REF` |
| A new item carries Warwick's approved wording, never invented | `NEW_WITHOUT_APPROVED_TERM` |
| The declared reconciliation counts agree with the packet's own lines | `EXPECTED_DISTINCT_MISMATCH`, `EXPECTED_UNITS_MISMATCH` |
| `seq` runs 1..N with no gaps or repeats | `BAD_SEQ_SEQUENCE` |

### Known identity vs ASDA retrieval — Warwick's Product Ruling 2 (2026-08-09)

> Known household identity and ASDA retrieval method are **separate concerns**. Use the durable ASDA
> reference when available and valid; otherwise the supervised route **may** use bounded ASDA
> search/navigation from the canonical identity, brand and variant. The result **must be verified**
> against the known household identity before addition. **Search is RETRIEVAL — it does not redefine
> the item as "new".** No silent substitution. If several plausible products remain, **stop that line
> and ask Warwick** rather than choosing the least-bad result.

**What this retired.** `KNOWN_WITHOUT_ASDA_REF` used to fail the **entire weekly shop** whenever one
known household product had no 3–12 digit reference on file — against a catalogue where a large
minority have none. It is gone.

**What replaced it.** A known line with no usable reference is accepted and carries a `retrieval`
object: the identity to verify the found product against, and Ruling 2's four clauses
(`retrieval_permitted`, `identity_unchanged`, `verify_before_add`, `ambiguity_stops_line`).
`counts.retrieval_required` says how many lines are in that state. The line stays `origin: "known"`
and is never given search wording — approved wording is Warwick's and exists only for a
`new_approved` line.

**What did not change.** Identity is still mandatory (`KNOWN_WITHOUT_ID`). A **malformed** reference
is still refused (`KNOWN_WITH_MALFORMED_ASDA_REF`) — "available *and valid*" — because a broken
reference is an upstream defect, not a missing one, and silently downgrading it to "search instead"
would hide the bug.

**Known gap, recorded not papered over:** `LINE_REPORT_STATUSES` has no member for *"found several
plausible products, stopping to ask"*. The duty is carried in `COMPLETION_CONTRACT` wording instead,
because the status label map lives in `services/asdair/cockpit-api/readPacket.js`, outside the file
surface of the change that introduced this. Filing such a line as `not_found` is explicitly wrong:
*"I could not find it"* and *"I found too many"* are different facts.

**`expected_distinct_products` counts IDENTITIES, not lines**, using the same precedence as
`packet/buildExecutionPacket.js` (`canonical_product_id` → `asda_product_ref` → normalized
`approved_search_term`).

**A duplicate identity is a PRODUCER DEFECT, not a normal case.** `asdair.rules` id 3 — *"Duplicate
entries for the same item are deduped to a single line"* — settles it: one product, one line. Dedupe
belongs at **planning**, before the packet is built. `duplicate_identities` is therefore a **detector**:
it is not refused (that would strand the whole weekly shop over an upstream bug), it is reported on the
artefact and as a **STOP** block at the top of the checklist, and **Sonnet is never asked to choose
between one-combined and two-separate at the shelf.**

The one case rule 3 does *not* settle is two entries for one product with **different explicit
quantities**. That is flagged separately (`quantities_differ`) and must become a **question**, never a
guess in either direction.

### Operating guidance from `asdair.rules` — carried, never authored

Some household rules are guidance for the person at the shelf rather than product identity (rule 38 is
the ruled example). Two boundaries, both ruled:

- **Not in the packet JSON.** Its root is `additionalProperties: false` and stays closed — it is the
  deterministic identity-and-quantity contract, and operating guidance is a different kind of fact.
- **Not written into this module.** The wording lives in `asdair.rules.rule_text` and **the caller
  passes the row**: `buildHandoff(packet, { operatingRules: [row] })`. A rule copied into source is a
  second copy of a fact that has an owner, and it goes stale silently.

The row is validated (integer `id`, non-empty `rule_text`, `active !== false`) and rendered under its
own checklist heading **with its rule id attached**. It is never spliced into the pinned
`BROWSER_METHOD`.

> **Note for the packet producer (`services/asdair/packet/**`):** `sort_contract` is **optional** in
> the committed schema, so the order to "assert the sort contract" could not be satisfied by reading
> the declaration alone. The actual line ordering is therefore verified on **every** packet, declared
> or not. Nothing is re-sorted here — a mis-ordered packet is refused.

### 2. The lifecycle — `claim.js`

Over the **existing** `asdair.browser_build_request` (migration `006_shop_control_surface.sql`). No
new table, no migration, no second model. The concurrency design is reused from
`browser-runner/lease.cjs` — atomic claim, bounded lease expiry on the **database** clock, fencing on
every write — because that design is sound and was proven against real Postgres with real concurrent
processes (`browser-runner/RUNNER-PROOF.md`). The runner itself is not used.

**The lease is stored under the same `progress->'_lease'->>'runner_id'` key `lease.cjs` uses.** That
is a safety property, not tidiness: a different key would make each system's lease invisible to the
other, which *is* two writers.

Three guards keep one writer on the trolley, and one more keeps completion state:

1. `bbr_one_live_per_shop` — the partial unique index. At most one live request per shop, so a
   repeated handoff **resumes** instead of queueing again.
2. The atomic claim — `update … where id = (select … for update skip locked limit 1)`. Two claimers
   race; one wins; the loser gets zero rows.
3. The fence — every progress/heartbeat/completion write carries `and claimed_by = $writer and
   progress->'_lease'->>'runner_id' = $writer`. A writer whose lease was taken over stops at its very
   next write.
4. The completed-shop guard — the index is *partial*, so a completed request blocks nothing.
   `openHandoff` refuses to reopen a completed shop unless told to explicitly.

All three of 1–3 are **mutation-tested**: `node mutation-proof.js` removes each on purpose and
requires the property to break. A guard that stops being load-bearing fails the suite.

### 3. Completion ingestion — `ingestCompletion(handoff, report)`

Pure. Produces **Workstream F's input, and no verdict.** Whether the basket is correct, and whether
Warwick is told it is ready, are the reconciler's decisions.

It refuses a report whose `packet_fingerprint` does not match (a superseded packet), and refuses an
`added` **or `out_of_stock`** line with no quantity — there is no honest substitute for that number
and defaulting it would manufacture agreement. A newly approved product added without its ASDA
identity captured is **recorded** in `identity_capture_missing`, not refused: the basket is real and
still needs reconciling.

**No quantity is ever defaulted at the seam.** `verifyBasket`'s `requireQty` rejects `0` and demands a
whole number ≥ 1 on every `actual` line, exactly because that module exists to catch quantity errors.
An earlier version of `toBasketObservation` emitted `quantity: 0` for an unavailable line; that would
have thrown at the seam, and was an invented number besides. The quantity **sought** is now required
on an `out_of_stock` line — a fact Sonnet knows — so `unavailable` survives into the reconciler as
`unavailable` rather than degrading to the weaker `missing`.

---

## The signatures to wire

```js
const {
  buildHandoff, renderChecklist,
  openHandoff, claimHandoff, heartbeat, reportProgress, releaseHandoff, completeHandoff, peekHandoff,
  ingestCompletion,
} = require('../handoff');
```

```
buildHandoff(packet) -> handoff                       PURE. throws PacketContractError
renderChecklist(handoff) -> string                    PURE. phone-readable Markdown
fingerprintPacket(packet) -> "sha256:..."             PURE

openHandoff(query, { shopId, handoff, openedBy?, allowAfterComplete?, now? })
      -> { request, created, resumed, superseded }
      throws LiveWriterError | AlreadyCompleteError | HandoffStateError

claimHandoff(query, { shopId | requestId, writerId, leaseMs? }) -> row | null
heartbeat(query, { requestId, writerId, leaseMs? })            -> expires_at   throws LeaseLostError
reportProgress(query, { requestId, writerId, progress, lastError? }) -> row    throws LeaseLostError
releaseHandoff(query, { requestId, writerId, reason? })        -> row | null
completeHandoff(query, { requestId, writerId, packetFingerprint, report?, status?, lastError? })
      -> { request, alreadyComplete }                 throws LeaseLostError | HandoffStateError
peekHandoff(query, { shopId? | requestId? })          -> row | rows            read-only

ingestCompletion(handoff, report)      -> the full completion record   PURE
toBasketObservation(handoff, report)   -> { shop_ref, packet_fingerprint, lines[] }   PURE
      both throw CompletionContractError, including SUPERSEDED_PACKET
```

**Two outputs, because the reconciler takes a narrower thing than the shop needs to keep.**
`reconcile/verifyBasket.js` is `verifyBasket({ expected, actual })` where `expected` is the packet
(`handoff` satisfies it — `handoff.lines` carries every field `readExpectedLines` reads) and `actual`
is the captured basket. Sonnet reports per-line outcomes, not a basket, so:

```js
verifyBasket({ expected: handoff, actual: toBasketObservation(handoff, report) });
```

`ingestCompletion()` is the richer record kept alongside it — new-product identity capture, the five
boundary confirmations, held lines, missing/unknown lines, reporter notes. `verifyBasket` consumes
none of those and they must not be discarded to fit its shape.

`query` is **always injected**: `(text, params) => Promise<{ rows }>`, against the **write** pool.
This module has **zero dependencies**, never imports `pg`, and never opens a connection. It is
CommonJS so that both the ESM `pipeline/` and the CommonJS `reconcile/` can consume it.

### The intended sequence

```js
const handoff = buildHandoff(packet);                       // refuses a bad packet before anything is durable
const { request } = await openHandoff(query, { shopId, handoff, openedBy: 'pipeline' });
// -> send renderChecklist(handoff) to Warwick / Sonnet, and JSON.stringify(handoff) as the data

const claimed = await claimHandoff(query, { shopId, writerId });   // null => someone already has it
// ... heartbeat() while the supervised step runs; reportProgress() as lines are worked ...

const record = ingestCompletion(handoff, sonnetReport);            // refuses a superseded report
const actual = toBasketObservation(handoff, sonnetReport);
await completeHandoff(query, { requestId: claimed.id, writerId,
                               packetFingerprint: handoff.packet_fingerprint,
                               report: sonnetReport });
// -> verifyBasket({ expected: handoff, actual }). This module emits no verdict.
```

---

## What is NOT proven here

- **The SQL is not proven.** `test/fakeRequestStore.js` reproduces the protocol offline; it cannot
  demonstrate `for update skip locked` atomicity or the partial unique index. Those properties are
  **inherited** from statement shapes proven against real Postgres in `browser-runner/RUNNER-PROOF.md`
  and are **not re-proven** here. No database was available to this build.
- **The seam to `verifyBasket` was matched by READING it, not by agreeing it.** Both modules were
  built in parallel. `toBasketObservation` was written against `reconcile/verifyBasket.js` as it stood
  at the time of writing; the two have never been executed together, and no integration test spans
  them. Someone must run them end to end.
- **`expected_distinct_products` normalisation is mirrored, not shared — ruled, not drifted into.**
  This module reimplements the producer's `identityKey` rather than importing it: two zero-dependency
  modules that do not reach across service folders is the intended shape, and a shared package would
  be new machinery this build has not earned. The drift risk is **held above this module**, to be
  closed by a cross-module test pinning both implementations against one fixture set at integration.
  The loud `EXPECTED_DISTINCT_MISMATCH` refusal is the runtime backstop, not the primary control.
- **This module's prohibitions are instructions, not code — and that is now an argument for choosing
  an executor that DOES enforce them.** The CDP runner blocks checkout and substitution in three
  independent code layers, and **CDP is authorised** (goal contract **S-8**), so those layers are a
  **strength of that route**. This module pins the wording, versions it and asserts it is present; it
  cannot enforce it in a browser it does not drive. ~~*"That is a real reduction in guarantee,
  accepted deliberately in exchange for a process that works at human speed."*~~ — **SUPERSEDED
  2026-08-17**: it stated the trade backwards, and the mechanism carrying the enforcement is no
  longer excluded.

## Tests

```
node --test        # the suite
node mutation-proof.js   # the guards, removed on purpose
```
