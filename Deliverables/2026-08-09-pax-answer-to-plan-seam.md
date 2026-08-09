# The answer-to-plan seam — can Warwick's answer change THIS WEEK'S shop?

**Pax · 2026-08-09 · READ-ONLY establishment · governance head `d907350`**
Commissioned by Warwick. No implementation, no Work Package, no design. Evidence only.

---

## Verdict

> ## **C — neither path reliably changes the current-week plan.**

Not B. B would require that buttons work structurally while free text does not. They do not
differ: **a button answer and a typed answer take the identical path and die at the identical
two barriers, both of which sit downstream of `answer_source`.** The seam is not in the
channel. It is in what the pipeline does with an answer once it has one.

**Larry's reading of the live database is corroborated by the code, not contradicted.** One
detail strengthens it beyond what he claimed — see §6.

---

## 1. The consumption path, hop by hop

| # | Hop | File:line | What it writes / reads |
|---|---|---|---|
| 1 | `commands.answerQuestion` | `services/asdair/pipeline/commands.js:301-331` | Records a LATCH command row, then `shopStore.answerQuestion` sets `shop_question.status='answered'`, `answer_text`, `answer_source`. **Nothing else.** |
| 2 | `stepReplan` | `services/asdair/pipeline/runPipeline.js:595-653` | Reads answered questions, calls `recordAnswerLearning`, transitions to `PROCESSING`. |
| 3 | `recordAnswerLearning` → `promoteDecision` | `runPipeline.js:626-642` | Writes one `asdair.rule_qa_log` row with **`applies_going_forward: false`** (`runPipeline.js:638`, a hard-coded literal). |
| 4 | `stepPlan` | `runPipeline.js:363-389` | Re-runs `planBasket` over `listItems`, `rules`, `products`, `regulars`, `budget`, `lastOrder`, `priorAnswers`. **It never reads `shop_question.answer_text`.** |
| 5 | `loadRuleQaLog` | `services/asdair/skill/data.js:293-301` | SELECTs every `rule_qa_log` row for the household. No filter here. |
| 6 | `eligiblePriorAnswers` | `services/asdair/skill/planner.js:1087-1097` | **`if (qa.applies_going_forward !== true) return false;`** — line 1091. |

**The chain terminates at hop 6.** Every row hop 3 writes is discarded by hop 6, on the exact
field hop 3 hard-codes. Confidence: **High** (both sides read directly).

**`shop_line` is never touched by the answer path at all.** The only writer of the
human-resolution columns is `shopLines.markCorrected` (`shopLines.js:205-208`, SQL at
`:87-89`), and **it has zero production callers** — the only call sites are
`shopLines.test.js:52` and `runPipeline.test.js:578`. The interpretation upsert is
column-allowlisted to exclude `confirmed_by`, `confirmed_at`, `corrected`, `list_item_id`
(`shopLines.js:55-58`). So `corrected = false` and `confirmed_by = NULL` on every row is not
a live-data anomaly — **it is the only state the shipped code can produce.**

---

## 2. The semantic seam, resolved by execution

**Both sides confirmed. The combination means a freshly answered question can NEVER alter
this week's matched product, quantity, skip or variant.** Confidence: **High.**

There are **two independent barriers**, and removing either one alone changes nothing:

**Barrier 1 — the flag.** `runPipeline.js:638` writes `applies_going_forward: false`;
`planner.js:1091` admits only `=== true`. The 30-line comment block at `runPipeline.js:570-585`
asserts the opposite:

> *"It is NOT a no-op… That log row is what data.js loadRuleQaLog() reads back as `priorAnswers`, which stepPlan now feeds to the planner - so the loop closes through the decision log, not through rule promotion."*

**That claim is false.** The row is written and read, then filtered out. The comment is
accurate about hops 3 and 5 and wrong about hop 6. This is the most consequential finding in
the brief: **the defect is documented as the fix.**

**Barrier 2 — the ceiling.** Even if the flag were `true`, `planner.js:1080-1085` states a
prior answer *"may never set matched_product"*. The test suite asserts it:

- `services/asdair/skill/ruleConsumption.test.js:578-579` — `'consulting the log must not change WHICH product was resolved'`
- `services/asdair/skill/ruleConsumption.test.js:582-588` — `test('a one-off answer (applies_going_forward false) is ignored')`

**The exact behaviour Warwick wants is a passing test asserting the opposite.** An eligible
prior answer can only attach a `'prior decision on record'` flag to a line and suppress a
re-ask. It cannot change the basket.

---

## 3. How `READY_TO_SHOP` is decided — **this is the defect, in those terms**

`services/asdair/pipeline/stages.js:306-318`:

```js
export function planOutcome({ openQuestions, needsReview, interpretationConfirmed }) {
  if (Number(openQuestions) > 0) { return { to: 'NEEDS_DECISION', ... }; }
  if (needsReview && !interpretationConfirmed) { return { to: null, ... }; }
  return { to: 'READY_TO_SHOP', reason: 'every line is resolved' };
}
```

`openQuestions` is `store.countOpenQuestions(shop.id)` (`runPipeline.js:432`) — a count of
`shop_question` rows with `status='open'`. **No line status is consulted anywhere in this
function.**

**So yes: closing a question is what makes a line "resolved", regardless of whether the line
was actually decided.** A line still `unmatched_new_item` or `needs_confirmation`, with
`matched_regular_id` NULL, passes this gate the moment its question row stops being open.

The mechanism that guarantees it: the re-plan re-runs `planBasket`, the line is *still*
`needs_decision`, so `stepPlan` calls `openQuestion` again (`runPipeline.js:419-428`) — which
is `ON CONFLICT (shop_id, question_key) DO NOTHING` plus a re-select and returns
`already_answered` (`shopStore.js:42-44`). The question does not reopen. `countOpenQuestions`
returns 0. **`planOutcome` then reports `'every line is resolved'` over a plan that just
classified the line as needing a human.** The string is not a summary of the lines; it is an
unconditional literal on the fall-through branch. Confidence: **High.**

---

## 4. The Telegram surface — code-complete and wired; **not proven live**

The free-text path exists end to end and is wired into the real entry point:

- `runtime.js:173-181` `replyTargetOf` — extracts `(chatId, reply_to_message.message_id)`
- `runtime.js:219-229` — `questions.getQuestionByCard(replyTo)` before routing
- `bot/inboundRouter.js:113-149` — correlates via injected lookup; **text passed through verbatim**, trimmed only (`:127-130`)
- `pipeline/telegramAdapter.js:118-127` — `raw.kind === 'reply'` → `ANSWER_QUESTION` with `answerSource: 'typed'`
- `runtime.js:777-827` `realWiring` — binds `questionStore`, `sendQuestionCard`, `questions`, `routeAsdairUpdate`. **Genuinely wired, not a stub.**

**Correlation is exact and card-bound.** A reply resolves only against `(card_chat_id,
card_message_id)` (`questionStore.js:69-80`). A question card that was never sent has no
binding, so **no reply to it can ever correlate** — it is refused (`UNCORRELATED_REPLY`),
never guessed. Question cards are only sent via `sendQuestionCard`, which sends *then* seals
the render contract (`runtime.js:642-654`, `:814-819`); a runtime without that sender leaves
the card queued rather than sending an unbindable one.

**Usable TODAY: NOT ESTABLISHED, and I could not establish it read-only.**
`RUNTIME-PROOF.md:352` records **FINDING 2 — "the live runtime cannot start today: `pg` is
unresolvable"**, and `:36` records that no shop from a real list existed at proof time.
Whether that is now fixed and the runtime armed is **not recorded** — the DEFECT-LEDGER
(`:715`) says of the arming gate: *"Whether it has since been enabled and armed is **NOT
RECORDED** in the file sources."*

**And it does not matter for the verdict.** Even a perfectly delivered typed reply lands at
`commands.answerQuestion` — hop 1 — and then dies at hops 3/6 exactly as a button does.

---

## 5. The Cockpit surface — **backend only. Not built.**

Of the three options offered: **backend only.** Neither candidate buttons nor free-text entry.

- The **live** Cockpit (`services/cockpit/server.mjs:394-397`) exposes exactly four AsdAIr routes, **all read-only GETs**: `/api/asdair/workspace`, `/rules`, `/packet`, `/media`. **There is no AsdAIr POST route.**
- `services/asdair/cockpit-api/httpApi.js:196-222` **does** implement `POST /asdair/command`, bound to the shared surface including `answerQuestion` (`commandSurface.js:42`). **It is a separate service and is not mounted by the live Cockpit** — no import of `cockpit-api` or `httpApi` exists anywhere in `services/cockpit/`.
- The served UI (`services/cockpit/public/app.js:336-444`) fetches workspace and rules and renders them. **No question list, no answer control.** Its own copy routes Warwick away: *"Waiting on you — check Telegram for what AsdAIr needs."* (`app.js:374`).

**Anti-pattern worth naming.** `services/cockpit/public/apps.js:121` ships this to screen:

> *"The cockpit… forwards the same named commands the Telegram bot uses, so an answer given on the phone clears the same question here."*

**The first clause is false of the served Cockpit.** It forwards no commands. This is
architectural intent rendered as delivered capability — the exact shape of `runPipeline.js:570-585`,
one layer up.

---

## 6. On Larry's testimony — corroborated, and strengthened

I was asked to say so plainly if the code showed he had misread. **It does not. It shows he
read it correctly**, and one item is stronger than he put it:

**The identical `answered_at` to the microsecond across eleven rows is not merely suspicious —
it is inconsistent with the command surface having been used.** `shopStore.answerQuestion`
stamps `answered_at = now()`, and Postgres `now()` is **transaction start time**. Eleven
separate `answerQuestion` calls are eleven transactions and would produce eleven distinct
timestamps. One identical microsecond means **one statement**. Nothing in the shipped command
path can produce that signature. Confidence: **High** (code-grounded; the row values are
Larry's observation, not mine).

Supporting, weaker: `list_item_id = NULL` on all eleven, while `stepPlan` populates it when
opening a question (`runPipeline.js:425`). Consistent with the rows not having been opened by
`stepPlan` — but `:422-424` documents a legitimate NULL for a plan line answering to no
stored list item, so this one is **Medium**, not proof.

---

## 7. Confidence ledger

| Claim | Status |
|---|---|
| Answer never reaches `shop_line`; `markCorrected` has no production caller | **Proven** (enumerated all callers) |
| `applies_going_forward: false` ∧ planner admits only `true` ⇒ answers discarded | **Proven** (both sides read) |
| A prior answer may never set `matched_product`, even when eligible | **Proven** (asserted by `ruleConsumption.test.js:578`) |
| `READY_TO_SHOP` ignores line status entirely | **Proven** (`stages.js:306-318`) |
| Live Cockpit has no answer UI and no AsdAIr POST route | **Proven** (server routes + UI enumerated) |
| Telegram typed-reply path is code-complete and wired | **Proven** in code; **live operation UNESTABLISHED** |
| Runtime currently armed / `pg` blocker cleared | **Unestablished** — deliberately not checked (read-only boundary) |
| Shop 6 answers were written by one statement, not the command surface | **Documented-but-unproven** — code-side corroboration of Larry's DB reading |

**Method.** Static read of `services/asdair/**` and `services/cockpit/**` at `d907350`.
Chain traced forward from `answerQuestion` and backward from `planOutcome`; every writer of
the resolution columns enumerated rather than inspected. **No database read, no runtime
touched, no file modified.** Out of scope by instruction: browser/basket/packet seam,
stale-claim defect, future-week learning, catalogue enrichment.

**Open questions I could not resolve:**
1. Is the runtime armed and is the `pg` blocker (`RUNTIME-PROOF.md:352`) cleared? Needs an operational check I was boundaried out of.
2. Do shop 6's eleven questions carry `card_chat_id` / `card_message_id`? **If NULL, no typed reply could ever have correlated** — one SELECT settles whether the Telegram path was even reachable that night.
3. A skipped answer leaves the line `needs_decision` in `shopping_list_items`. Whether such a line still reaches the basket packet is the parked packet seam — flagged, not investigated.
