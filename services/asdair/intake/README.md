# AsdAIr intake — the ShopperBot receiver (IDEA-012)

The weekly shopping list arrives as a Telegram message to a dedicated bot,
**@Fusion247shopperbot** — either typed text or a **photo of a handwritten list**.
This folder is the committed, tested receiver that fetches it.

It exists because the receiver used to be hand-written into a session scratchpad
every week and thrown away: rewritten from scratch each time, no tests, no shared
behaviour. Operational capability living in session memory instead of in Git is
the exact failure this project exists to end. It now lives here.

## What it is (and is not)

- **IS**: fetch pending ShopperBot updates → filter to an allowlist of permitted
  senders → emit a payload in exactly the shape the downstream shopper route
  already accepts, plus a stable unique `sourceId` — and, for a photo, download
  the highest-resolution image and report where it landed.
- **IS NOT**: a transcriber, an orderer, or a database client.
  - It **never transcribes**. Reading the handwriting is a **separate step**
    performed by a vision model, injected downstream as
    `transcribers.transcribeImage` into
    [`services/hub/shopper/shopperRoute.mjs`](../../hub/shopper/shopperRoute.mjs).
    This module's job ends at *"here is the payload + the downloaded image path"*.
    (A photo payload with no injected transcriber **fails closed** in
    `resolvePayload.mjs` — it is never guessed at.)
  - It **never places an order, never checks out, never pays.**
  - It **never connects to Postgres.** There is no DB code path in this folder.

## Files

| File | What it is |
| --- | --- |
| `shopperIntake.js` | The module. A pure core (allowlist parsing, update classification, photo selection, payload + `sourceId` construction, filename safety) plus small injected-dependency seams (Telegram client, offset state store, media store) and the `runIntake` receiver. |
| `fetch-shopper-list.js` | The runtime caller / CLI. Argument parsing, config loading, printing. |
| `shopperIntake.test.js` | `node --test`, **offline only** — the HTTP layer is a fake, every token is an obvious fake. |

## How to run it

Credentials are supplied by Node's `--env-file`; they are **never** passed as
arguments and this code never opens a credential file itself.

```bash
# See what would come in — downloads nothing, writes no state.
node --env-file=<path to the shopper credentials env file> \
     services/asdair/intake/fetch-shopper-list.js --dry-run

# Actually receive the week's list — ⛔ THIS CLI NO LONGER DOES THAT, AND MUST NOT.
#
# It REFUSES a live run and exits 2 (WP-B15-11, 2026-08-10). It used to advance
# the shared Telegram offset while persisting nothing, so ONE live run
# permanently consumed a pending shopping list and Telegram forgot it.
#
# The real receiver is the RUNTIME: the scheduled task MyPKA-AsdAIr-Runtime,
# whose pollIntake supplies onRecord and persists the shop BEFORE the offset
# moves. That ordering is what protects the list.
```

Options: `--dry-run`, `--state-file <path>`, `--media-dir <path>`,
`--timeout <seconds>`, `--json`, `--help`.

Tests:

```bash
cd services/asdair/intake && node --test
```

## Credential contract

Names only. Values live in the env file on the machine — never in this repo,
never in a command line, never in a log, never in a comment.

| Env var | Required | Meaning |
| --- | --- | --- |
| `SHOPPER_BOT_TOKEN` | **yes** | **SECRET.** The @Fusion247shopperbot bot token (a full bot account credential). Deliberately a different name from the capture gateway's `TELEGRAM_BOT_TOKEN`, so the wrong bot can never be picked up by accident. Always masked (`<botid>:***masked***`) in every diagnostic; never logged, thrown, or returned. |
| `SHOPPER_ALLOWED_SENDER_IDS` | **yes** | Allowlist of permitted Telegram **numeric** user ids, comma/space separated. Not a secret. Absent or empty ⇒ the receiver refuses to run — there is no allow-all. Usernames are rejected (spoofable). **Alias:** `SHOPPER_ALLOWED_USER_IDS` is also accepted (the machine credentials file for this bot predates this module and uses that name). The canonical name wins if both are set; the alias is a name, not a relaxation — default-deny still applies. |
| `SHOPPER_INTAKE_STATE_FILE` | no | Override the offset state file path. |
| `SHOPPER_INTAKE_MEDIA_DIR` | no | Override where downloaded list photos land. |
| `SHOPPER_TELEGRAM_API_BASE` | no | Bot API base override (diagnostics/tests). |
| `SHOPPER_POLL_TIMEOUT_SECONDS` | no | Long-poll wait. Default `0` (return immediately). Capped at **25s** — the home router silently kills connections held open ~45s (live finding, 2026‑07‑17). |

Rotation needs no code change: revoke/regenerate via BotFather, update the value
in the env file, re-run. Nothing is hardcoded.

## Authorisation

Single **numeric** sender allowlist, **default-deny**, checked before anything
else. A message from anyone not on the list is **ignored** — never processed,
never downloaded, never replied to — and logged as ignored (sender id + reason,
never their content). Messages outside a private direct chat are refused with the
same quiet posture. Adding a sender is a config change, never a chat-driven one.

## Offset / idempotency

The last successfully processed Telegram `update_id` is persisted to a **local
JSON state file**, written atomically (temp + rename). Re-running never
reprocesses a message already taken.

The path is **configurable** and **defaults outside this repo** —
`C:/.fusion247/asdair/shopper-intake-state.json` on Windows (the machine's
existing local runtime-state root), `~/.fusion247/asdair/…` elsewhere. Downloaded
photos default to the sibling `shopper-media/`. Both are household personal data
and the personal-data doctrine keeps them out of this public repo; the folder's
own `.gitignore` is defence in depth if anyone ever points them back inside.

Rules (the same ones the proven capture-gateway runner uses):

- The offset is advanced and persisted **only after** a message is fully handled.
- A **failure** (e.g. the photo download errored) does **not** advance the offset
  and **stops the batch** there, so that message — and every later one —
  redelivers next run rather than being silently skipped.
- An **ignored** message (unauthorised sender / wrong chat / unsupported type) is
  a terminal *decision*, not a failure: the offset advances past it, otherwise one
  stranger's message would wedge the queue forever. It is logged as ignored.
- `--dry-run` writes no state at all — not even the state directory.

## Output shape

One record per accepted message:

```js
{
  sourceId: 'tg:shopper:chat:<chatId>:msg:<messageId>',
  payload:  { kind: 'text',  text: '2 milk\nbread\neggs x6' }   // …or…
         // { kind: 'photo', imageRef: '<local path to the downloaded image>' },
  meta:     { channel, bot, updateId, messageId, chatId, senderId, caption,
              receivedAt, transcribed: false, /* photo: imagePath, size… */ },
}
```

`payload` is **exactly** a
[`resolvePayload`](../../hub/shopper/resolvePayload.mjs) shape. `sourceId` is
required by `shopperRoute` — it scopes the per-item idempotency keys so two
different messages can never collide on `shop-0`/`shop-1`. It is keyed on the
**message** identity (chat + message id), not the delivery, so a Telegram
redelivery of the same message dedups downstream instead of double-adding the
week's shopping. `meta` is receiver bookkeeping; the route ignores it.

Hand each record onward:

```js
import { shopperRoute } from '../../hub/shopper/shopperRoute.mjs';

await shopperRoute(record.payload, {
  sourceId: record.sourceId,
  listDate: '2026-08-03',
  transcribers: { transcribeImage: /* the separate vision step */ },
});
```

This is not a claim — `shopperIntake.test.js` imports the **real**
`shopperRoute.mjs` and routes the emitted payloads through it.
