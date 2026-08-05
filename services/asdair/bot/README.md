# AsdAIr ShopperBot — the control surface

**BUILD-015, Stage 1.** ShopperBot is how Warwick drives the whole supervised weekly shop from
Telegram: he sends a list, and every subsequent step — build, answer, basket, close — happens by
tapping a button or typing a reply on his phone.

This folder is **the message layer and nothing else**.

> **This module renders and routes only.**
> It **never plans**, **never resolves a product**, **never drives the browser**, **never checks
> out** and **never pays**. It turns an already-computed object into words and buttons, and turns a
> tap or a typed reply back into a structured intent. Every consequential action belongs to the
> pipeline that consumes those intents, and every *irreversible* one belongs to Warwick.

It is also **not a receiver**. It never polls Telegram — see [Why there is no poller](#why-there-is-no-poller).

---

## Files

| File | What it is |
|---|---|
| `callbackProtocol.js` | The wire format. One module owns the exact bytes on a button, imported by both halves so they cannot drift. |
| `renderMessages.js` | The message catalogue. Nine pure renderers, each returning `{ text, reply_markup }`. |
| `inboundRouter.js` | Maps one inbound Telegram update onto one intent `{ action, shopRef, arg, responder, raw }`. |
| `questionRender.js` | Builds a question card **and its render contract** from one list, and persists what was displayed. |
| `questionStore.js` | The durable Store behind that contract, over `asdair.shop_question`. Two factories — a pg client, or a read/write query pair. |
| `resolveTap.js` | Resolves a tapped index back through the stored contract to a product — or refuses it, visibly. |
| `sendShopperMessage.js` | The outbound sender: `sendMessage` · `editMessageText` · `answerCallbackQuery`. Injectable HTTP client. |
| `*.test.js` | `node --test`, fully offline. No network, no database, no credentials file. |

Zero runtime dependencies. ESM. Node ≥ 18.

```bash
cd services/asdair/bot && node --test
```

---

## The callback wire format

```
asd:<action>:<shopRef>[:<arg>]
```

Everything is namespaced `asd:` so this protocol and the hub's `decision:<card_id>:<choiceKey>`
protocol (`services/hub/decision/telegramInbound.mjs`) can share the same phone without either
router ever claiming the other's taps. A `decision:` payload arriving here is refused by namespace,
and vice versa.

### Actions

| Action | Arg | Meaning |
|---|---|---|
| `build` | — | Build this shop |
| `review` | — | Review the list as received |
| `cancel` | — | Cancel this shop |
| `answer` | *(none)* | Open the question queue |
| `answer` | `<questionKey>.<candidateIndex>` | Pick candidate *n* for that question |
| `search` | `<questionKey>` | Search ASDA for that question |
| `skip` | `<questionKey>` | Skip that item this week |
| `basket` | — | Build the ASDA basket |
| `status` | — | View status |
| `held` | — | View held items |
| `pause` | — | Pause the build |
| `exceptions` | — | View exceptions |
| `close` | — | Close the shop |
| `retry` | — | Retry the failed step |
| `confirm` | — | Send order confirmation (prompts Warwick to forward the ASDA email) |

`answer` is the one action whose meaning depends on whether an arg is present, so
`parseCallbackData` always reports `arg` explicitly — `null`, never absent — and a handler must
branch on it.

**There is no `checkout`, no `pay`, no `order` and no `slot` action.** An action that does not exist
in the protocol cannot be put on a button, cannot be parsed off one, and therefore cannot reach a
handler. `noPolling.test.js` asserts this over the whole action vocabulary.

### How the 64-byte limit is enforced

Telegram hard-limits `callback_data` to **1–64 bytes**. An over-long value is rejected by the Bot
API — or, worse, mangled in transit into a button that answers the wrong question. Five things make
that impossible rather than unlikely:

1. **Nothing is ever truncated.** There is no code path in this folder that shortens a callback
   value. `buildCallbackData` **throws** on an over-long shop ref. A thrown render is a visible bug
   Larry fixes by supplying a compact ref; a trimmed ref is an invisible bug that answers the wrong
   shop.
2. **Declared per-field budgets that sum to exactly 64**, so the *worst legal combination* lands on
   the ceiling rather than over it:

   | Part | Bytes |
   |---|---|
   | `asd` | 3 |
   | `:` | 1 |
   | action (longest is `exceptions`) | 10 |
   | `:` | 1 |
   | `shopRef` (`MAX_SHOP_REF_BYTES`) | 32 |
   | `:` | 1 |
   | `arg` (`MAX_ARG_BYTES`) | 16 |
   | **total** | **64** |

3. **An ASCII-only charset** (`[A-Za-z0-9._-]`, which also excludes the `:` separator), so byte
   length always equals character length. Thirty-two emoji would be 32 characters but 128 bytes;
   the charset check rejects them outright.
4. **A re-measurement of the assembled string** with `Buffer.byteLength`, which throws if it is
   over. That line is unreachable given (2) and (3) — it exists so a future edit to the action list
   or a budget cannot quietly ship an over-long button. The module also refuses to *load* if the
   budgets stop summing to ≤ 64.
5. **The parser enforces the same ceiling**, so a forged or corrupted inbound payload is refused
   rather than half-read.

The **candidate index travels, not the product id**: an ASDA product id is unbounded, an index is
one to three digits, and that is what keeps the budget provable. The caller must therefore persist
the candidate list against the question key **in the order it was rendered**.

Proven by `callbackProtocol.test.js`, which includes the exact-64-byte worst case, a brute-force
sweep of every action across every ref and arg length, a 500-character shop ref, a 400-character
arg, and a 32-emoji ref.

---

## The message catalogue

Nine renderers, all **pure**: no clock, no network, no database, no filesystem, no randomness, no
global state. Every number and name in the output comes from the argument object. Called twice with
the same argument, a renderer returns byte-identical output.

All messages are sent as **plain text with no `parse_mode`** — the same call
`services/hub/decision/renderCard.mjs` makes, for the same reason: real product names routinely
contain `_ * [ ] ( )` and backticks (`Nature's Pick 100% Fruit (6 pack)`), which a Markdown send
would break or silently swallow.

| # | Renderer | Sent when | Buttons |
|---|---|---|---|
| 1 | `renderReceipt` | The week's list lands | `Build this shop` · `Review list` · `Cancel` |
| 2 | `renderPlanReady` | The planner has resolved the list | `Answer N questions` · `Build ASDA basket` · `View status` |
| 3 | `renderQuestionCard` | One genuinely unresolved item | *candidates…* · `Search ASDA` · `Skip this week` |
| 4 | `renderProgress` | A build milestone is reached | `View held items` · `View status` · `Pause` |
| 5 | `renderBasketReady` | The basket is built, nothing ordered | `Send order confirmation` · `View exceptions` · `Close shop` |
| 6 | `renderStatus` | Warwick asks where things stand | `View held items` · `View exceptions` |
| 7 | `renderFailure` | A step failed | `Retry` · `View status` |
| 8 | `renderConfirmationReceived` | Warwick forwards the ASDA confirmation | `View status` |
| 9 | `renderReconciliationSummary` | Actual is compared to planned | `View exceptions` · `Close shop` |

`MESSAGES` exports the catalogue by name, and the test suite walks it — so a renderer added there is
automatically covered by the shape, purity, byte-budget and secret-leak proofs.

### Never fabricate

**A value that is missing, null, or not a finite number renders as the literal word `unknown`.**
Never `0`, never `-`, never a guess. `count()` and `value()` are the only route a dynamic value has
into the text, so this holds across the whole catalogue, not just the status card.

This matters more than it looks. Mid-shop, *"I do not know how many items are held"* is a true and
useful answer; *"0 held"* is a lie that would send Warwick to checkout with items missing. A real
zero still renders as `0` — the distinction between "none" and "not known" is preserved, not
flattened.

`estimatedTotal` is `unknown` in almost every real shop today: there is no price column on
`products` or `regulars`, so rule 7 (budget band) is structurally unevaluable (BUILD-015 goal
contract, *Deferred*). The card says so rather than inventing a figure.

### Why the receipt has no "Keep raw" button

Deliberate, and the one omission worth stating out loud.

The raw list — the typed text, or the photo of Mum's handwriting — is **always** retained,
unconditionally and without asking. It is the evidence the shop was produced from: every later claim
("this is what you asked for", "this line was excluded by a standing rule", "that substitution was
never authorised") is only checkable against the original.

Offering a choice would make retention *look* optional, and a single mis-tap would destroy the audit
trail for that week's shop. Retention is a property of the system, not a decision on a card.
A test asserts no `keep` / `raw` / `discard` / `delete` button ever appears on the receipt.

---

## The render contract

### Who calls this in production, and where

**`sendQuestionCard()` has a production caller.** It is
`services/asdair/pipeline/runtime.js`, and the route is worth knowing before you wire anything new,
because it is not obvious by grep:

```
runPipeline.stepPlan()          opens an asdair.shop_question row (status 'open')
   -> runtime.queueShopCards()  enqueues an outbox row of kind `question`, ONE per question
   -> runtime.drainOutbox()     intercepts kind `question` and calls bot.sendQuestionCard()
   -> questionRender            sends the card, THEN seals the render contract against the
                                message id Telegram allocated
```

Three things a future caller will get wrong, so they are stated here rather than rediscovered:

1. **A question card must never go through the generic renderer.** `MESSAGES.question` is
   `renderQuestionCard`, which will happily render and send a perfectly good card — with **no render
   contract recorded**. Every button on it then refuses forever, because an index is meaningless
   without the stored list it indexes into. `drainOutbox` therefore intercepts kind `question`
   *before* the `MESSAGES` lookup. Sending a question any other way is the defect, not a shortcut.

2. **The planner's candidate shape is not this module's candidate shape.**
   `runPipeline.planCandidates()` writes `{ label, regular_id, source }` for the catalogue
   resolver's alternatives and `{ label, source }` — **no id at all** — for the planner's ranked
   name suggestions. `candidateIdOf()` accepts `id` / `productId` / `product_id` and *throws* on
   anything else, so the raw planner shape cannot be rendered. `normaliseStoredCandidates()` bridges
   it: `regular_id` becomes the id **`regular:<n>`**, and the prefix is load-bearing — a bare number
   would lose which table the id came from, and a `product_alternatives` primary key is **not** an
   `asdair.regulars` id. Candidates with no trustworthy id are returned separately and shown as card
   *text* the human can reply to; they never become buttons, because a button resolving an index to
   a label reintroduces the exact ambiguity this contract exists to remove.

3. **Idempotency for a question card is NOT `outboxEverQueued`.** That reads per *kind* per shop, and
   one shop holds many questions — using it would card the first question and silently swallow every
   other one, forever. The real guard is `shop_question.card_message_id`, set only after a card is
   genuinely on the wire, plus ledger adoption of a still-pending row for the window in between.

**A question button carries a candidate *index*. That is what forces everything below.**

The index is not a shortcut — it is the only encoding that provably fits Telegram's 64-byte
`callback_data` ceiling. An ASDA product id is unbounded; an index is one to three digits. The whole
byte budget above depends on it.

The consequence is absolute:

> **An index is meaningless except against the exact list that was displayed.**

If the candidates for a question are ever recomputed in a different order — a fresh catalogue
search, a re-ranked match, a candidate that has gone out of stock and dropped out — then button #2
on the card still sitting in Warwick's scrollback now points at a **different product**. Nothing
errors. The wrong thing is simply added to the basket, and nobody finds out until it arrives.

So the ordered list is **persisted at render time**, and a tapped index is resolved against **that
stored list**, never against a freshly computed one. There is no code path in `resolveTap.js` that
recomputes candidates, and there must never be one.

### What is stored

`asdair.shop_question` (migration 006, extended by 009) holds one contract per
`(shop_id, question_key)` — the **current** render:

| Column | What it is |
|---|---|
| `card_chat_id`, `card_message_id` | The Telegram card this contract is bound to. |
| `rendered_candidates` (jsonb) | `[{ index, id, label }, …]` — the displayed candidates, **in display order**. |
| `render_fingerprint` (text) | Seal over what was displayed (below). |
| `render_version` (integer) | 1 for the first card; bumped by every re-render. |
| `callback_index` (integer) | Which index was actually tapped, once answered. |

`UNIQUE (shop_id, question_key)` already guarantees a question is asked at most once per shop.

### One function builds both the card and the contract

`prepareQuestionCard()` calls `renderQuestionCard()` and derives the contract from the **same
sliced, ordered array**. They cannot drift, because there is no second list to drift from.
(`renderQuestionCard` caps a card at `MAX_CANDIDATE_BUTTONS`; a contract built from the uncapped
input would disagree the moment a question had nine candidates.)

```js
import { sendQuestionCard } from './questionRender.js';

await sendQuestionCard({
  sender, store, chatId,
  shopRef: 'shop-2026-07-28',
  questionKey: 'q7',
  item: 'natural yogurt',
  candidates: [                       // { id, label } — a bare string is REFUSED
    { id: 'P-1001', label: 'Yeo Valley Natural Yogurt 500g' },
    { id: 'P-1002', label: 'Arla Skyr Natural 450g' },
  ],
});
```

**Every candidate must carry an id.** A bare string is refused even though `renderQuestionCard`
renders one happily: a string is a *label*, and two ASDA products can share a label
("Semi Skimmed Milk 2 Pints"). Resolving a tap to a label would reintroduce, one layer down, exactly
the ambiguity the contract exists to remove.

The order is **send, then persist** — the contract keys on a `message_id` Telegram has not allocated
until the card is sent. The failure window is therefore *"a card exists with no contract"*, and that
direction is safe: a tap with no contract is refused. The dangerous direction — a contract that does
not describe the live card — is unreachable. If the persist does fail, the card is edited to say it
is not usable, so Warwick is not left tapping a button that will only ever refuse.

### The fingerprint, exactly

```
render_fingerprint = sha256_hex( JSON.stringify([
  "asdair.shop_question.render/v1",   // FINGERPRINT_DOMAIN
  question_key,
  render_version,
  [candidate_id_0, candidate_id_1, …] // DISPLAY ORDER
]) )
```

Three properties earn the JSON tuple over a delimiter-joined string:

1. **Injection-proof.** JSON escapes every field, so an id containing a separator cannot forge an
   extra element and collide with a different list. `['A:B','C']` and `['A','B:C']` fingerprint
   differently; under a naive `join(':')` they would not.
2. **Order-sensitive.** The ids are an array, not a set. Reordering the *same* candidates changes
   the fingerprint — which is the entire point.
3. **Version-bound.** `render_version` is inside the hash, so version *N* and version *N+1* of an
   identical list still differ, and a contract cannot be replayed across versions.

Deliberately **not** in the hash: chat id and message id. The fingerprint seals *what* was
displayed; *where* is checked separately by exact `(card_chat_id, card_message_id)` match. Keeping
them apart lets the fingerprint be computed **before** the card is sent — i.e. before a message id
exists — and lets a caller pin an expected fingerprint into a downstream job.

### How a stale tap is detected

**The fingerprint cannot ride in `callback_data`, and that is arithmetic, not oversight.** The arg
budget is 16 bytes, and `<questionKey>.<candidateIndex>` already spends all 16 in the worst case
(12 + 1 + 3). Widening it pushes the worst legal payload past 64 bytes, which Telegram rejects — and
narrowing the question key to make room would break existing keys.

So **the card itself is the render token.** Each render version is bound to exactly one Telegram
message, and `persistQuestionRender()` **throws** if asked to bind a changed candidate ordering to a
`message_id` an earlier version already used. Editing a question card's candidates in place would
leave the old buttons live, addressing the new list, with no signal that anything had changed — the
precise silent misresolution this exists to stop. **Re-render = new card. Always.**

A tap then falls into exactly one of three buckets:

| `(chat_id, message_id)` | Meaning | Result |
|---|---|---|
| **is** the recorded card | the live render | resolve the index through `rendered_candidates` |
| **is not**, but the question exists | a **superseded** card | **refuse**, offer a refresh |
| neither | unknown card | **refuse** |

On top of that, three further checks fail closed rather than guessing:

* the stored contract is **re-hashed** and must match its stored fingerprint — a row edited without
  re-sealing is refused as corrupt;
* a caller that knows which render it expects may pin `expectedRenderVersion` /
  `expectedRenderFingerprint`, and a mismatch is refused;
* the index must be **inside** the stored list — an index past the end is a shrunken re-render, and
  is treated as staleness, not as a bad tap.

Nowhere does `resolveTap` conclude *"probably still the same order"*.

### What Warwick sees

A refusal is a Telegram **alert** (`show_alert: true` — a popup he must dismiss), not a silent toast:

> *This card is out of date — the options were re-listed since it was sent. Nothing was changed. Ask
> for the question again to get a fresh card.*

The result carries `refresh: true`, plus which card was tapped and which card is current, so the
pipeline can offer a fresh one. **Nothing is written on any refusal.**

### Idempotency: first answer wins

Telegram redelivers. Warwick double-taps. A repeated tap must return the **same** durable answer and
must not rewrite it — otherwise the second tap of a fat-fingered pair would overwrite a decision
that has already been acted on.

Enforcement is a **compare-and-set in the store**, not a read-then-write in `resolveTap`: two taps
racing must not both see `open` and both write.

```sql
-- store.recordAnswer() MUST be this shape. The `and status = 'open'` is load-bearing.
update asdair.shop_question
   set status         = 'answered',
       answer_text    = $2,
       answer_source  = 'button',
       callback_index = $3,
       answered_at    = $4
 where id = $1
   and status = 'open'
returning *;
-- 0 rows updated => somebody else answered first. Re-read the row and return
-- THAT answer verbatim: { applied: false, question: <row> }.
```

A losing tap gets `outcome: 'already_answered'`, `wrote: false`, and the winner's answer. If it
tapped a *different* candidate it also gets `conflicting: true` — reported, never acted on.

### The Store contract

Injected, never constructed in this folder — no module here opens a database connection (a test
proves it). Four async methods:

```js
store = {
  getQuestionByCard({ chatId, messageId }),          // -> row | null
  getQuestionByKey({ shopRef, questionKey }),        // -> row | null
  saveRender({ shopRef, questionKey, chatId, messageId,
               renderedCandidates, renderFingerprint, renderVersion }),   // -> row
  recordAnswer({ questionId, answerText, answerSource,
                 callbackIndex, answeredAt }),       // -> { applied, question }
};
```

Rows come back in the **database's own shape** — the snake_case columns of `asdair.shop_question`,
plus a joined `shop_ref` (`asdair.shop`), because reading them leniently is how a misread starts.

`questionStore.js` is the real implementation, and it has **two factories**:

```js
createQuestionStore(client)                         // a connected pg client
createQuestionStoreFromQueries({ read, write })     // a read/write query PAIR
```

The pair exists because the pipeline runtime holds no client — it holds `deps.readQuery` and
`deps.writeQuery`, two pools against two roles, and the read role is SELECT-only *deliberately*, so
a bug cannot write through it. Handing the store one `client.query` would collapse that separation
for every caller. The two reads go to `read`; `saveRender` and `recordAnswer` go to `write`. The SQL
still has exactly one owner.

### The refusal contract — the two "no"s are different facts

`resolveTap.js` also exports **`resolveCandidateAnswer()`**, the READ half on its own: every
staleness check `resolveTap` makes, in the same order, with the same vocabulary — and **no write and
no acknowledgement.** That is what the pipeline runtime uses, because a tap there becomes a member
of the *command* surface (`answerQuestion`), so a tap on the phone and a click in the Cockpit are
one durable write. Calling `resolveTap()` as well would write the same answer twice, by two paths,
and the ledger would stop being the record of what happened.

A tap falls into exactly one of three buckets, and **the last two must never be collapsed into one
message**:

| The tapped `(chat, message)` | Verdict | What Warwick is told |
|---|---|---|
| **is** the recorded card | the live render — resolve the index | the answer |
| is **not**, but the question exists | `STALE_CARD`, `refresh: true` | the card is out of date, ask again |
| neither | `UNKNOWN_CARD` | this card is not on record |

"Superseded" and "never heard of it" are different facts, and the first is the one he needs. Every
refusal carries a `notice` from `TAP_NOTICES` (exported, so a caller answering the tap itself does
not grow a second copy of the strings), and **no refusal ever carries a candidate label, a product
id or an answer** — a refusal that leaks a plausible-looking answer is worse than one that does not.

### Resolving a tap

```js
import { handleAsdairTap } from './resolveTap.js';

const out = await handleAsdairTap(update, { store, sender });
// { ok: true,  outcome: 'answered' | 'already_answered', candidateId, candidateLabel,
//   answerText, candidateIndex, renderVersion, renderFingerprint, wrote, acknowledged }
// { ok: false, code: <TAP_REFUSALS.*>, notice, refresh, acknowledged }
```

`handleAsdairTap` is the seam between `inboundRouter.routeAsdairUpdate` (what was asked, by whom)
and `resolveTap` (what it means, durably). The two stay separate on purpose — routing is not
deciding. A foreign `decision:` callback is handed back **unacknowledged**, so the hub keeps its own
spinner; a *typed* reply is handed back unresolved, because matching words to a candidate is a
decision made downstream.

**`answerCallbackQuery` is emitted on every path, including every refusal.** A tap that is never
answered spins for ~30 seconds and then looks, to Warwick, like the bot died — which is worse than
an honest "this card is out of date". If the acknowledgement itself fails, the resolve still stands
and the result says `acknowledged: false` with a masked `ackError`.

---

## How a typed reply is correlated to its question

Warwick often will not tap. He replies *"the Yeo Valley one please"*. That must land on the right
question, or it must not land at all.

Correlation works exactly as `services/hub/decision/telegramInbound.mjs` does it:

1. A question card is sent; the caller records the resulting `message_id` against its `questionKey`.
2. Warwick **replies to that message**. Telegram puts the original's `message_id` in
   `reply_to_message`.
3. `routeAsdairUpdate` hands `(chatId, replyToMessageId)` to the **injected**
   `resolveQuestionByMessage` lookup, which returns `{ questionKey, shopRef }` (or a bare
   `questionKey`, or `null`).
4. No match → `{ ok: false, reason: 'reply not correlated to a known asdair question' }`. **The
   reply is refused, never attached to a guess.**

```js
routeAsdairUpdate(update, {
  resolveQuestionByMessage: (chatId, messageId) => /* your reverse lookup */ null,
});
```

`questionRender.questionLookupFrom(rows)` builds that lookup off the **same** stored render
contracts the buttons use, so a tap and a typed reply correlate through one source of truth rather
than two that can disagree. (`routeAsdairUpdate` calls the lookup synchronously, so it is built over
a snapshot of rows the caller has already loaded — which keeps the choice of *when* to read the
database with whoever owns the connection.)

The lookup is injected because the question state belongs to whoever owns it, not to the router.
The reply **text is passed through verbatim** in `raw.text` (trimmed only) and the intent's `arg` is
the **question key, not a candidate index** — deciding which candidate the words mean is a decision,
and this module does not make decisions.

### The intent

```js
{ action, shopRef, arg, responder, raw }
```

`responder` is `telegram:<numeric id>` — the only non-spoofable part of an update — or
`telegram:unknown`. `raw.kind` is `'callback'` or `'reply'`, and carries `callbackQueryId`,
`chatId`, `messageId`, `replyToMessageId`, `data` and `text` as applicable.

Everything unrecognised gets a **structured refusal** with a distinct reason (`REFUSALS`): a foreign
namespace, an unknown action, a malformed payload, an uncorrelated reply, a missing lookup, an empty
reply. Nothing is guessed. A plain (non-reply) message is explicitly **not claimed** — that belongs
to the intake receiver.

**The router routes. It never decides an outcome and never touches a database.**

---

## Sending

```js
import { createShopperSenderFromEnv } from './sendShopperMessage.js';
import { renderQuestionCard } from './renderMessages.js';

const { sender, chatId } = createShopperSenderFromEnv();       // env by NAME only
const sent = await sender.sendMessage(chatId, renderQuestionCard({ ... }));
// … Warwick answers …
await sender.answerCallbackQuery(intent.raw.callbackQueryId, { text: 'Got it' });
await sender.editMessageText(chatId, sent.message_id, {
  text: 'Answered: Yeo Valley Natural 500g',
  reply_markup: { inline_keyboard: [] },                        // card can't be answered twice
});
```

`fetchImpl` is injectable (defaulting to the Node global `fetch`, no npm dependency), exactly as
`services/asdair/intake/shopperIntake.js` does it — so the whole suite runs offline against a fake.

### Environment

| Name | Secret | Purpose |
|---|---|---|
| `SHOPPER_BOT_TOKEN` | **yes** | The @Fusion247shopperbot token. **Same name the receiver uses** — one bot account, one credential. |
| `SHOPPER_CHAT_ID` | no | The chat the control surface talks to. |
| `SHOPPER_TELEGRAM_API_BASE` | no | Test/diagnostic override of the Bot API base. |

Supply the token with `node --env-file=<credentials file>` — never on a command line, never in git.
**No credentials file is opened, parsed, printed or inspected by this folder.** Env names only.

### Secret hygiene

The token appears in exactly one place: the request URL handed to `fetchImpl`. It is never logged,
never thrown, never returned by `describe()`, and every error this module produces goes through
`maskTokenIn()` first — so a Telegram error that echoes the request URL cannot leak it. `maskToken`
keeps only the public numeric bot-id prefix.

Proven by tests that drive **every** failure path (rejection, transport throw, unreadable JSON,
edit, callback-answer) with a token-shaped fixture and assert it appears in no message, no stack, no
`describe()`, no rendered output, and nothing written to stdout or stderr.

---

## Why there is no poller

Telegram long-polling is **destructive**: fetching updates with an offset **acks every update below
it**. Exactly one consumer of the @Fusion247shopperbot stream exists — `services/asdair/intake/` —
and a second one would race the receiver, with the loser silently swallowing the week's shopping
list. No error, no alert; a list that simply never arrives.

So no module here contains the poll-method identifier, or a webhook-setting call. `noPolling.test.js`
scans this folder's own source (tests included) and fails if any of them ever appears, alongside
scans proving no module opens a database connection, reads a credentials file, reaches for a
browser, or can check out, pay or book a slot. **Enforced by a test, not by memory.**

This module is *handed* updates by whoever is already polling. It never reaches for them.
