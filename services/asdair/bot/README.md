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
| `sendShopperMessage.js` | The outbound sender: `sendMessage` · `editMessageText` · `answerCallbackQuery`. Injectable HTTP client. |
| `*.test.js` | `node --test`, fully offline. 77 tests, no network, no database, no credentials file. |

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
