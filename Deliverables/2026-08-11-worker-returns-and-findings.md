---
title: Worker returns 2026-08-10/11 — the findings, banked out of the agent transcripts
date: 2026-08-11
author: Larry
build: BUILD-015 AsdAIr
status: durable record of three Keel returns. NOT an acceptance of any of them.
---

# Three workers, three CLARIFYs, and what they found

**All three Keel workers returned `CLARIFY` at the SOP-022 read-back gate, and all three were
right.** Between them they found more defects in Larry's Work Orders than the orders found in the
code. That is the measured pattern and it is not new — SOP-022 already records it.

**Everything below is builder self-test evidence. None of it is independent review. Nothing here is
Veritas-passed.**

## WP-B15-18 — cross-shop answer routing · `8181db4` · NOT INTEGRATED

**The order was wrong about the size of the defect.** Larry sent it after an ordinal collision. Keel
established, before writing a line, that the ordinal collision is **the least dangerous of five**:

1. **Step 1, exact candidate** (`runtime.js:482`) — leaks cross-shop.
2. **Step 2, single-open-question** (`runtime.js:497`) — **the worst, and it carries no number at
   all.** Shop A's board fully answered, shop B has one open question, Warwick replies to A's board →
   **B's question is answered with words aimed at A**, with nothing in the message for a reviewer to
   blame. The AC8 notice did not fire because it tested `openQuestions.length === 0` **globally**.
3. **Step 3, Terra `byKey`** (`runtime.js:537`) — leaks because **`questionKeyFor` (`keys.js:260`)
   has no shop component**, so two shops asking about the same item mint byte-identical keys. That
   derivation is data-shaped and pinned; the fix scopes the lookup, never the key.
4. **The ordinal collision** (`runtime.js:464`) — the one Larry knew about.
5. **`recordedAnswerMatches`** (`runtime.js:277`) — same class, no AC covered it.

**Keel's design beat the order** on the refusal path: rather than invent a new card to tell Warwick,
re-scope the existing AC8 guard so the **already-shipped `reply_not_taken` card** becomes reachable.
Taken as offered.

### 🔴 F1 — HIGH, PRE-EXISTING, NOT FIXED, needs Larry's decision

**`recordedAnswerMatches` cannot serve a cross-*pass* redelivery at all.** Proven with ONE shop and no
cross-shop element:

```
PASS 1  answers: [{"question_key":"q9a24dc4d","duplicate":false}]  row: "the 12 skinless ones"
PASS 2  answers: [{"question_key":"q9a24dc4d","error":"not recorded - the question was
                  already answered with different words"}]
```

**The words were identical. The message is false.** Root cause: it resolves the shop by searching
`openQuestions`, read once at the top of a pass — so in the very case the function exists for, the
question is already settled and absent from that list, and it returns `false`. Only *same-pass*
double delivery works. **Consequence:** a reply redelivered because the offset never advanced is not
claimed and falls through to intake. **No existing test covers this path.** Likely fix, not applied:
resolve the shop from the `cardRow` already in hand at `:1789` rather than from `open`.

### F2 — process lesson worth keeping

**The mutation step found that AC3 had ZERO coverage.** Keel's first eight tests all replied to a
board, so the candidate set was always already one shop and the ambiguity guard was **inert** — the
mutant survived and the guard could have been deleted with everything still green. **The tests alone
would never have proven it; only mutation exposed it.**

### Other

- `boardStateOf`'s `byOrdinal` (`runtime.js:1198/1207/1227`) is **dead** — built, returned, consumed
  by nothing estate-wide. Not used, not deleted.
- `productionWiring.test.js:562-580` is a source-**text** pin; a comment containing `pollIntake` near
  the `loadOpenQuestions` call reddens it while the wiring is correct.
- Commit message says "15 tests"; the true count is **12** (485−473). Not amended — force-push is an
  outward irreversible action the contract says to report, not resolve.

## WP-B15-19 — supervised completion route · `cf59894` · NOT INTEGRATED

**Corrected three of Larry's line numbers by execution** (`shopStore.js:713`/statement `:730`, not
`:729`; `shop-cli.js:238`, not `:232`; `claimHandoff` `:285`, not `:294`). Substance held.

**Its reading of the job is the sentence the order should have carried:** *"I am not building a
transition; I am supplying the durable fact the transition already reacts to."*

**Found before writing a line that `pg` does not resolve from `handoff/`** and `handoff/package.json`
was out of surface — which would otherwise have surfaced at the very end.

**Found the fake was hiding a vacuous proof:** `fakeRequestStore.js` hard-coded `completeHandoff`'s
three clauses, so mutating the real SQL changed nothing and two guard "proofs" would have passed
inertly. Made the fake derive the clauses from the statement text first.

**Its own preflight was wrong about CRLF and it said so:** reported "LF only", the files are CRLF, and
the faulty check was `head -c 4000 | grep $'\r'`. The hazard then bit — a mutation anchor found 0
occurrences and the harness threw rather than silently no-opping.

**Stated limit, carried forward honestly:** the automatic leg is proven at
`decideNextStep → runPipeline → stepRecordBasketReady`, **one level below `runtime.js`'s real poll
loop**. Under root `CLAUDE.md` § "Nothing may live only in Larry's head", **this package is NOT
proven-automatic**. It did not simulate the loop to make it look closed.

**Reported, not fixed:** `pipeline/test/fakePg.js` does not model the new AC6 `WHERE` predicate, so
the fake will accept a write real Postgres now refuses.

### The operator invocation, for SOP-021

Run from `services/asdair/handoff`, `ASDAIR_WRITE_DB_URL` in the environment (never on the command
line): `peek` → `claim` → `report-basket --file basket.json` → optional `release`. The report needs
one line per packet line using the packet's own `seq`; `added`/`out_of_stock` **must** carry a whole
`quantity`; `packet_fingerprint` must be the one `peek` printed; **there is deliberately no
`substituted` status**; an empty trolley is reported honestly and refused loudly downstream.
**Nothing in this route moves the shop** — the pipeline advances it on its own next pass.

## WP-B15-20 — remembered-choice lookup · `602caea` · NOT INTEGRATED

**Found a defect in the order:** "the lookup" is in **two** places. The SQL, and
`applyRememberedToPlan`'s `memories.get(term)` keyed on the **stored** spelling via `row.choice_term`.
**A SQL-only fix would fetch the row and still miss on the Map.** Its design — key the Map on the
**requested** term — leaves `applyRememberedToPlan` byte-unchanged and pure, and makes the
visible-refusal AC fall out for free.

**Found a SECOND gate Larry had missed:** `runPipeline.js:317` short-circuits on
`memoriesByTerm.size === 0`, so today `applyRememberedToPlan` **is never called at all** and the miss
is invisible even before the inner gate.

**Verified Larry's central claim rather than trusting it** — `squash(normaliseTerm(x))` does yield
`"vanishpretreatgel"` for both spellings, and proved the stronger property across 7 pairs.

### ⚠️ Its mutation evidence may be unsound — re-run before any gate

See the scratchpad incident below. B15-20's mutation harness is the file that was replaced and
executed by another worker's process.

## ⚠️ THE SCRATCHPAD IS SHARED BETWEEN CONCURRENT WORKERS — reported independently by TWO workers

**The session scratchpad path is presented as session-isolated and is not.** One worker wrote its
mutation harness to `…/scratchpad/mutate.mjs`; between the write and the execution, **that file's
contents were replaced by a different worker's harness**, and it ran under the first worker's
process, **mutating and restoring a file in a worktree that was not its own and outside its declared
file surface**.

Damage assessment: the file was restored and independently hashed twice — byte-identical
(`b95fc12ffbda`). **No lasting damage.** But if both harnesses ran concurrently on one file, **the
mutation results from that window are not sound.**

**The durable lesson:** treat *"write a script, then run it"* as **unsafe without a content check in
between**. Namespace scratchpad paths per worker, and have the harness refuse any target outside its
own worktree. One worker implemented exactly that mitigation and its later runs show
`integrity gate: PASS`.

## What none of this is

**Not integrated. Not live. Not user-exercised. Not Veritas-passed.** Four branches, all pushed, all
sitting outside `main`. The runtime has none of them.
