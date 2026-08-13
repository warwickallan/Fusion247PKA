# asdair/cockpit-api — the read side behind `Apps → Asdair → Details`

The cockpit is a **second view of one shop**, not a second brain. This module is what makes that true:
it **reads** durable state and it **forwards** commands. It contains no shopping logic at all.

```
Telegram (ShopperBot) ─┐
                       ├─► services/asdair/pipeline/commands.js ─► asdair.* tables
Cockpit (Apps>Asdair) ─┘            (the ONE command surface)              │
                                                                          ▼
                          cockpit-api (SELECT only) ◄── shop/shopStatus.js projection
```

An answer given on the phone clears the same question in the cockpit **because both went through the same
command against the same row** — not because two implementations were kept in step by hand.

## Files

| File | |
|---|---|
| `present.js` | PURE. The two presentation rules, in tested code: unknown reads as `"unknown"` (never `0`), and money always carries its basis so a **derived** price can never be shown as an ASDA-quoted figure. |
| `assembleWorkspace.js` | PURE. Durable rows → the workspace payload. Enforces the catalogue-grounding invariant at the boundary. |
| `readWorkspace.js` | The reader for ONE SHOP. ONE `BEGIN TRANSACTION READ ONLY`; reuses `getShopStatus()` on the same client rather than reimplementing the projection. |
| `readRules.js` | The reader for the **durable rulebook** — `asdair.rules`, `asdair.rule_qa_log`, `asdair.regulars` (with their `aka` aliases). Same construction as `readWorkspace.js`: SELECT-only, one read-only snapshot, presentation via `present.js`. Shop-independent, so it is a separate route rather than another key on the workspace. |
| `commandSurface.js` | Names the 10 shared commands, binds to `../pipeline/commands.js`, and refuses anything on the deny list. **No local fallback, deliberately.** |
| `httpApi.js` | PURE-ish router. **Thirteen routes**; `httpApi.test.js` pins the count to a literal so the surface cannot grow by accident, and it has now caught six additions in a row. *(This row previously said "Five routes" and listed five while `ROUTES` held eleven — the pin caught every addition; this prose did not.)* |
| `cockpitIntake.js` | PURE. The Cockpit's **translator**, not a second intake service: one submitted list → the `receiveList` spec the shared command already accepts. Owns the evidence text, the content fingerprint behind `sourceId`, and the `list_date` comparison. |
| `checkItem.js` | **WP-B15-50.** The sense-check behind `POST /asdair/check-item`. Calls `resolveReading` from `../interpret/` — it is not a second matcher — and **seals** its response to four keys so a candidate list can never reach Mum's screen. |
| `notifyShopper.js` | **WP-B15-50.** Tells Warwick, on ShopperBot, when Mum's submission recorded something. Fired by `POST /asdair/list` itself. Never throws, never messages Mum, never polls. |
| `displayName.js` | **WP-B15-51.** The third field. Holds **both halves of one decision**: the write behind `POST /asdair/display-name` (Warwick sets it) and `displayNameFor()`, the single rule for **what Mum reads** wherever a product name reaches her. PURE at import. |
| `server.js` | The node:http binder. Started by `node server.js` and nothing else. Owns `CONFIG_SPEC` / `validateConfig()` — the startup contract. |

## The rules this module exists to keep

**1. Unknown is unknown.** `shopStatus.js` returns `null` where a fact is genuinely not known — no list yet,
no basket count reported, no total stated. `present.js` turns that into the string `"unknown"`. It never
turns it into `0`, because "0 lines" reads as *an empty list* rather than *we do not know yet*. A **measured**
zero still prints as `0`.

**2. A derived price is never an ASDA price.** Migration 006's `price_basis` (`stated` / `derived` /
`unknown`) travels with every amount. Only `stated` is presented as a figure ASDA quoted; anything else
carries `is_asda_quoted: false` and a display string that says *inferred — not an ASDA price*.

**3. Identity comes from the catalogue, never from prose.** A line is only ever shown as `matched` when it
carries a real `asdair.regulars.id`, and the product name shown is **looked up from our own row by that id**.
The raw reading is preserved verbatim beside it as evidence. A stored line claiming `matched` with no id is
**downgraded to `needs_confirmation`** and flagged — fail-safe, never a confident match nobody can trace.

**4. A build request is a request.** `requestBasketBuild` writes a durable `browser_build_request` row. The
existence of that row is never reported as evidence that a basket exists. Nothing here drives a browser,
books a slot, checks out or pays.

**5. A rule that cannot explain itself is SHOWN, not hidden.** Many `asdair.rules` rows carry
`note = null` (defect D-2026-08-03-16). `readRules.js` reports `has_note: false` and counts them in
`rules.without_note_display`; it never drops the row and never invents prose for it. The same applies
to a `rule_qa_log` answer marked *applies going forward* with no `promoted_rule_id` — the planner acts
on rules, not on the log, so that pairing is counted as `decisions.unpromoted_standing_display` and
surfaced as the gap it is.

## The command surface

`confirmInterpretation` · `correctLine` · `buildShop` · `answerQuestion` · `requestBasketBuild` ·
`pauseBasketBuild` · `submitConfirmation` · `retryStage` · `cancelShop` · `getStatus`

These bind to `services/asdair/pipeline/commands.js`. If that module is absent, `loadCommands()` throws
`ASDAIR_COMMANDS_NOT_BOUND` and `POST /asdair/command` answers **503** — the cockpit says so rather than
pretending. `commandSurface.test.js` fails the moment the names drift in either direction.

## Configuration

All from the environment. **This module never reads, prints or logs a credential**, and any connection
string that reaches an error message is scrubbed by `httpApi.safeMessage()`.

| Variable | |
|---|---|
| `ASDAIR_DB_URL` | the **SELECT-only** `asdair_ro` connection string. Never the write URL. |
| `ASDAIR_COCKPIT_PORT` | default `8710` |
| `ASDAIR_COCKPIT_BIND` | default `127.0.0.1`. A tailnet address must be set deliberately. |
| `ASDAIR_COCKPIT_ALLOWED_ORIGIN` | exact origin of the Directus cockpit. **Unset = no CORS header at all**; there is no `*` default. Required for the Vue module to read this service cross-origin. |
| `ASDAIR_MEDIA_ROOT` | directory the retained list photos live under. Unset = `GET /asdair/media` is disabled. The file path comes from the **database row**, never from the request, and must resolve inside this root. |
| `SHOPPER_BOT_TOKEN` | **SECRET.** The `@Fusion247shopperbot` token — the same one the intake process uses, because there is one bot account and one credential. Consumed **by name**: `notifyShopper.js` hands the environment to the bot module's own loader and never reads, parses, prints or returns the value. |
| `SHOPPER_CHAT_ID` | the chat the notification goes to. **Not a secret**, and the **only** source of that destination — no field of any HTTP request can influence it. |

### ⛔ The notification variables: set BOTH, or NEITHER

The service **refuses to start** when exactly one is present. `loadSenderConfig` throws on a missing
token but returns a **null chat id happily**, so a token without a chat id looks configured, boots
clean, accepts Mum's list, and finds it has nowhere to send at the moment it needs one. Neither set is
a legitimate state — notifications are explicitly off, a loud startup warning says so, and every
submission answers `notify_error: notify_not_configured`. Full table in
[`../CONFIGURATION.md`](../CONFIGURATION.md).

## WP-B15-50 — the sense-check and the notification

**`POST /asdair/check-item`** — *"have I already got this?"*, asked while she is typing.

```
request   { "household": 1, "text": "<her exact words>", "chosen": ["<regulars.id_display>", ...] }
200       { "ok": true, "status": "matched"|"possible_duplicate"|"needs_confirmation"
                                 |"unmatched_new_item"|"unreadable",
            "matched_name": "<what MUM should read>"|null, "matched_regular_id": <n>|null,
            "already_on_list": true|false }
```

**`matched_name` is her name for it, not the catalogue's (WP-B15-51 AC3a).** It is
`display_name` when Warwick has set one, and the catalogue name otherwise. This route read the raw
retailer string out to her until 2026-08-13, when Warwick typed "milk" on the live Cockpit and was told
*"you've already got cravendale arla filtered fresh semi skimmed milk"*. The **identity** still comes
from the resolver and is unchanged; only the words are hers.

SELECT-only: it opens no write pool and dispatches no command, so nothing posted to it can change a
row. `chosen` is what makes `possible_duplicate` reachable at all — a single `resolveReading()` call
cannot produce it, because that status comes from a batch's `seen` set.

**⛔ It can never ask Mum a question.** The resolver returns `alternatives` — a ranked candidate array
— on `needs_confirmation`. `checkItem.js` never spreads the verdict; it assembles the response through
`sealed()`, which **throws** on any key outside the frozen four. The route has nowhere to put a
question, which is why this is a control rather than a promise. `matched_name` and
`matched_regular_id` are non-null **only** on `matched` and `possible_duplicate`.

## WP-B15-51 — `display_name`, the third field

**The three fields, and the boundary between them.** Migration `db/021_regulars_display_name.sql`.

| field | what it is | editable | who reads it |
|---|---|---|---|
| `name` | the official ASDA listing — the truth about what the product is | **no** | the matcher, and Warwick |
| `aka` | what Mum writes on her lists — **a matching term**, not a label | **no** | the matcher **only** |
| `display_name` | **what Mum reads** | **yes — Warwick** | Mum's surfaces **only** |

**⛔ The matcher never reads `display_name`, and that is the whole safety property.** The obvious fix
for "Mum's tile shows a catalogue string" was to let Warwick edit `aka` — but `aka` is what
`resolveByCatalogue.js` matches on, so improving what she *reads* would have changed what *matches*.
Setting a `display_name` that names a **different** product changes nothing about resolution;
`displayName.test.js` proves that by execution against the real resolver, with the column injected
directly into the rows it is handed.

**The read rule is `displayNameFor(regular, fallback)`, and it is a rule rather than a patch:**
`display_name` when Warwick has set one, otherwise whatever would have been shown. Anywhere a product
name reaches **Mum**, it goes through that function. `name` and `aka` are unchanged everywhere else.

**`POST /asdair/display-name`** — Warwick's route, and his only.

```
request   { "id": <regulars.id>, "display_name": "<text>"|null }
200       { "ok": true, "id": <n>, "display_name": "<text>"|null }
4xx/5xx   { "ok": false, "error": "<machine_code>", "message": "<one plain sentence>" }
```

- **`null` or empty clears it** — he can undo a bad name, not only overwrite it.
- **Trimmed, otherwise untouched.** His words are his; over 60 characters is a `400`, never a truncation.
- **One column.** The route reads exactly `id` and `display_name` off the body and passes two validated
  primitives to `displayName.js`, which issues one fixed single-column `UPDATE`. A body carrying `name`
  or `aka` leaves both untouched — proven end to end against a real database, not only with a stub.
- **`name` is refused by PostgreSQL regardless**: `asdair_rw` holds no `UPDATE` on it (migration 005's
  column-scoped grant). `aka` **is** granted to that role — the weekly learning write-back needs it — so
  `aka` is safe here because of how the route is written, not because of the grant. Both are true; they
  are not the same statement.

**Reading it back is column-probed, deliberately.** `readWorkspace.js` and `checkItem.js` add
`display_name` to their `SELECT` **only when the database reports the column**. That is not defensiveness
about an edge case: migration 021 reaches the live database by hand *after* this code ships, and a blind
column list would take the workspace read and the sense-check down in that window.

**The ShopperBot notification** fires from `POST /asdair/list` — the real submission event, no script
and no manual step — when `created` **or** `recorded_new` is true, and **not at all** when neither is.
It is deliberately *not* inside the shared `receiveList` command: Telegram drives that too, and
Warwick does not need pinging for his own lists.

On `created:false, recorded_new:true` the message carries **her typed words verbatim**, because
nothing else records them: `raw_*` is excluded from `shopStore`'s UPDATE allowlist, so the shop's
evidence text still belongs to her first submission, and the command row's payload holds a content
hash rather than her words. Mum's page says *"I've told Warwick what you changed"* — this message is
what makes that true.

A failed notification **never** fails her submission (the response stays `ok:true`) and is **never**
silent: `notified` and `notify_error` are on the response, and one structured line goes to the error
log. The send is bounded at 5 s.

```bash
node --env-file=<env> server.js
```

## Tests

```bash
cd services/asdair/cockpit-api && node --test
```

Offline. No database, no Telegram, no model. `readWorkspace.test.js` drives the reader against the scripted
fake client from `../shop/fakeClient.js` and asserts **every statement issued is a SELECT**.
