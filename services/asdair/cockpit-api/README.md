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
| `readWorkspace.js` | The reader. ONE `BEGIN TRANSACTION READ ONLY`; reuses `getShopStatus()` on the same client rather than reimplementing the projection. |
| `commandSurface.js` | Names the 10 shared commands, binds to `../pipeline/commands.js`, and refuses anything on the deny list. **No local fallback, deliberately.** |
| `httpApi.js` | PURE-ish router: `GET /asdair/health`, `GET /asdair/workspace`, `POST /asdair/command`, `GET /asdair/media`. |
| `server.js` | The node:http binder. Started by `node server.js` and nothing else. |

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

```bash
node --env-file=<env> server.js
```

## Tests

```bash
cd services/asdair/cockpit-api && node --test
```

Offline. No database, no Telegram, no model. `readWorkspace.test.js` drives the reader against the scripted
fake client from `../shop/fakeClient.js` and asserts **every statement issued is a SELECT**.
