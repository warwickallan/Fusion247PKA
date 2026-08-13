# AsdAIr — the configuration contract

**This file is canonical.** Every environment variable the AsdAIr product reads is listed
here, with the process that consumes it and what breaks without it. Other files point here;
none of them restates the table.

Written 2026-08-03 (Work Order WO-B) after `SHOP-2026-08-03` failed live four times on
configuration that `--preflight` had just declared fine. Three of the variables below were
missing for hours and only surfaced as a vision-model failure mid-shop.

> **Standing rule (Warwick, 2026-08-03).** AsdAIr's weekly operation must be completely
> independent of any Claude Code / Larry session. Any model call this product needs is made
> by the product's own code, through `FUSION_GATEWAY_URL`, to a real OpenAI-compatible API —
> never by an interactive AI session standing in for it.

> **⚠️ 2026-08-04, ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`.** The
> `ASDAIR_CDP_ENDPOINT` / `ASDAIR_CHROME_EXE` / `ASDAIR_CHROME_PROFILE_DIR` /
> `ASDAIR_RUNNER_ID` / `ASDAIR_RUNNER_STATE_DIR` rows below configure the custom Node/CDP
> runner at `services/asdair/browser-runner/`, which is now **experimental, deferred, not the
> live default, and prohibited from further live-account testing without fresh authority from
> Warwick.** **The live basket writer is Sonnet in Claude for Chrome.** Those rows stay
> documented and accurate for the deferred adapter; they are not preconditions for a live
> weekly shop. Canonical:
> `Builds/BUILD-015-asdair-durable-household-shopping-steward/RUNTIME-DECISION.md`.

## How to read this

- **Consumed by** — the *process* that reads the variable. This matters more than it looks:
  the runtime and `cockpit-api` are **separate processes with separate `--env-file` pairs**,
  so setting a variable for one does nothing for the other.
- **Preflight** — whether `ensure-asdair-runtime.mjs --preflight` checks it, and at what
  severity. **BLOCKING** stops a start; **ADVISORY** warns and does not.
- **Secret** — never commit it, never print it, never paste it into a chat or a return
  message. Real values live outside this public repository (see *Provisioning*).

## Provisioning — where the real values live

All real values live **outside this repository**, under `C:\.fusion247\`, and are passed in
with `node --env-file=`. No file in this repo opens, parses or prints one; the code knows
variable **names** only.

| Env file | Feeds |
|---|---|
| `C:\.fusion247\.env keys\shopper.env.txt` | the bot token and the sender allowlist |
| `C:\.fusion247\asdair.env` | database URLs, media root, gateway, vision model, household |
| the `cockpit-api` pair | the cockpit read service (its own, separate pair) |

**Mack owns the values and their placement. This document owns their names and shapes.**

---

## The runtime — `ensure-asdair-runtime.mjs` and the pipeline it launches

| Variable | Required | Consumed by | Format | Default | Preflight | What fails without it | Secret |
|---|---|---|---|---|---|---|---|
| `SHOPPER_BOT_TOKEN` | yes | intake (`shopperIntake.js`) | `<digits>:<url-safe token>` | none | **BLOCKING** (presence); token *shape* is ADVISORY | No Telegram intake at all — no list ever arrives | **YES** |
| `SHOPPER_ALLOWED_SENDER_IDS` | yes (or its alias) | intake | numeric Telegram user ids, separated by space, comma or semicolon | none — **default-deny** | **BLOCKING**, and it must *parse* to ≥1 id, not merely be set | Nothing is accepted from anyone | no (but identifying) |
| `SHOPPER_ALLOWED_USER_IDS` | alias | intake | as above | none | as above | — | no |
| `ASDAIR_DB_URL` | yes | pipeline, skill, interpret, cockpit-api, status | Postgres URL for **`asdair_ro`** | none | **BLOCKING** — connects for real, and asserts the role is `asdair_ro` | No planning reads; the runtime starts and dies on its first query | **YES** |
| `ASDAIR_WRITE_DB_URL` | yes | pipeline (`deps.js`), outcome, reconcile | Postgres URL for **`asdair_rw`** | none | **BLOCKING** — connects for real, and asserts the role is `asdair_rw` | No durable writes; a shop cannot progress | **YES** |
| `ASDAIR_HOUSEHOLD_ID` | no | `pipeline/runtime.js` | integer | `1` | not checked | Falls back to household 1 — wrong household silently, if you ever have two | no |
| `ASDAIR_MEDIA_ROOT` | recommended | **`cockpit-api/server.js` only** | absolute directory path | unset = feature disabled | **ADVISORY** — see the note below | Cockpit Details photo evidence silently disabled (`media_root_not_configured`) — D-02 | no |
| `FUSION_GATEWAY_URL` | yes | `transcribe` → `obsidiwikai/src/core/models.mjs` | OpenAI-compatible base URL, usually ending `/v1` | none | **BLOCKING** — the endpoint is actually called | Every photo list dies at TRANSCRIBING: *"no vision-capable gateway configured"* — D-04 | **YES** — it may carry userinfo |
| `FUSION_GATEWAY_KEY` | yes | as above | bearer token | none | **BLOCKING** — an authenticated call must return 200 | Gateway reachable but every call 401s | **YES** |
| `FUSION_MODEL_VISION` | **yes** | `transcribe`, `interpret-list.js` | a model id the gateway actually serves | `fusion.vision` — **which this gateway does not serve** | **BLOCKING** — the id must appear in the gateway's own `/models` response | Gateway reachable and authenticated, but rejects the default alias with `Invalid model name`; every photo list dies at TRANSCRIBING — D-05 | no |
| `ASDAIR_CDP_ENDPOINT` | no | `browser-runner/cdp.js` | `http://host:port` | `http://127.0.0.1:9222` | **ADVISORY** — Chrome is opened when a basket is built, not at logon | The runner cannot attach to Chrome | no |
| `ASDAIR_CHROME_EXE` | no | preflight (documented for the runner) | absolute path to `chrome.exe` | the two standard Program Files locations | **BLOCKING** — the file must exist | No browser to drive | no |
| `ASDAIR_CHROME_PROFILE_DIR` | no | preflight (documented for the runner) | absolute directory path | `C:/.fusion247/asdair/chrome-profile` | **BLOCKING** — the directory must exist | The runner drives a profile that is **not signed in**, and fails halfway through a basket with an unexplained empty page | no (but it *contains* a live session) |

### Why `ASDAIR_MEDIA_ROOT` is only ADVISORY

It is read by `cockpit-api/server.js` — a **separate process, started with its own
`--env-file` pair**. The runtime's environment therefore proves nothing about cockpit-api's,
in either direction. Blocking the weekly shop because a photo viewer is misconfigured would
be the wrong trade, so preflight reports what it found *in this process* and says so
explicitly in the check's own text. **Set it in both env files.**

### `FUSION_MODEL_VISION` — the one to get right

The fallback lives in `services/obsidiwikai/src/core/models.mjs` and is `fusion.vision`.
**No such alias is registered on this gateway.** Confirmed working on 2026-08-03:
`gpt-5-mini`. List what your gateway actually offers with the recipe in *Testing* below.

Warwick, 2026-08-03: *"A default model name that the gateway does not provide must never
survive preflight again."* That is why an **unset** `FUSION_MODEL_VISION` is a BLOCKING
preflight failure rather than a silent fallback.

---

## Runtime state paths

State lives **outside this public repo** — the Telegram offset, the runtime log and the
downloaded list photos are household personal data.

| Variable | Required | Consumed by | Default | Preflight | Notes |
|---|---|---|---|---|---|
| `ASDAIR_RUNTIME_STATE_DIR` | no | `runtime-paths.mjs` | `C:/.fusion247/asdair` (Windows), `~/.fusion247/asdair` otherwise | used, not checked | Holds `runtime.pid`, `runtime.log`, `runtime.armed`, `status.json`. **Tests must point this somewhere disposable.** |
| `SHOPPER_INTAKE_STATE_FILE` | no | intake, status | `<state dir>/shopper-intake-state.json` | used, not checked | The durable Telegram offset. The single most loss-bearing file in the product. |
| `SHOPPER_INTAKE_MEDIA_DIR` | no | intake | platform default under the intake home | not checked | Where received list photos are written |
| `SHOPPER_TELEGRAM_API_BASE` | no | intake | Telegram's public API | not checked | Override for testing |
| `SHOPPER_POLL_TIMEOUT_SECONDS` | no | intake | 50 (clamped) | not checked | Long-poll window |
| `ASDAIR_RUNTIME_SETTLE_MS` | no | launcher | `8000` | not checked | How long a spawned runtime must survive to count as started |

---

## `cockpit-api` — a separate process, a separate env-file pair

| Variable | Required | Format | Default | Preflight | What fails without it |
|---|---|---|---|---|---|
| `ASDAIR_COCKPIT_PORT` | no | integer | `8710` | not checked (different process) | Binds the wrong port; the cockpit proxy cannot reach it |
| `ASDAIR_COCKPIT_BIND` | no | IP address | `127.0.0.1` | not checked | Loopback only by default; a tailnet address exposes it further |
| `ASDAIR_COCKPIT_ALLOWED_ORIGIN` | recommended | exact origin, e.g. `https://cockpit.example` | none | not checked | Cross-origin requests from the cockpit shell are refused |
| `ASDAIR_DB_URL` | yes | as above | none | not checked *here* | The read service has nothing to read |
| `ASDAIR_MEDIA_ROOT` | recommended | as above | unset = disabled | not checked *here* | `/asdair/media` returns `media_root_not_configured` |
| `SHOPPER_BOT_TOKEN` | for notifications | `<digits>:<url-safe token>` | none | **presence only** — `cockpit-api` never reads, parses or prints the value | Warwick is not told when Mum sends her list |
| `SHOPPER_CHAT_ID` | for notifications | integer (negative for a group) | none | **BLOCKING when malformed**, at startup | The notification has no destination |

### ⛔ The two notification variables: set BOTH, or NEITHER

`cockpit-api` **refuses to start** when exactly one of `SHOPPER_BOT_TOKEN` / `SHOPPER_CHAT_ID` is
present. This is deliberate, and it is the one configuration state that used to fail silently.

`loadSenderConfig` throws on a missing token but returns a **null chat id perfectly happily**. So a
process started with a token and no chat id *looks* configured, boots clean, accepts Mum's list — and
discovers it has nowhere to send at the exact moment it needs one, on a path nobody is watching.

The three states:

| `SHOPPER_BOT_TOKEN` | `SHOPPER_CHAT_ID` | What happens |
|---|---|---|
| set | set | Notifications on. `enabled.notify_shopper: true` at startup. |
| absent | absent | **Starts.** Loud startup warning; every submission answers `notify_error: notify_not_configured`. Legitimate — it is how the service runs before the values are placed. |
| one of them | the other absent | **REFUSES TO START**, naming which one is missing. |

⚠️ **While notifications are off, Mum's page can still say "I've told Warwick what you changed" when
he was not told.** The response carries `notified: false` and `notify_error`, so the page *can* tell —
but the two halves are configured independently, and this is the gap between them.

The same `SHOPPER_BOT_TOKEN` as the intake process (one bot account, one credential). The chat id is
**not** a secret. `cockpit-api` consumes the token **by name only** — `notifyShopper.js` hands the
environment to the bot module's own loader and never touches the value, so the token appears in no
log, no error, no response and no diagnostic on this service.

---

## Testing a variable without printing it

Never `echo` a secret. Every recipe below answers a yes/no question instead.

```bash
cd services/asdair/pipeline-runtime
ENV='--env-file="C:\.fusion247\.env keys\shopper.env.txt" --env-file=C:\.fusion247\asdair.env'

# Everything at once - this is the intended route, and the only one that checks
# the gateway, the model list and the grant matrix together.
node $ENV ensure-asdair-runtime.mjs --preflight
```

Individually, when you need to isolate one:

```bash
# Presence, without the value:  prints only true/false
node $ENV -e "console.log(Boolean(process.env.FUSION_GATEWAY_KEY))"

# Which models the gateway ACTUALLY serves (ids are not secret; the key is):
curl -s -H "Authorization: Bearer $FUSION_GATEWAY_KEY" "$FUSION_GATEWAY_URL/models" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.map(m=>m.id).join('\n')))"

# Which role a connection string is really for - the value never appears:
psql "$ASDAIR_WRITE_DB_URL" -Atc "select current_user"

# The allowlist parses, without printing the ids:
node -e "import('./services/asdair/intake/shopperIntake.js').then(m=>console.log(m.parseAllowedSenderIds(process.env.SHOPPER_ALLOWED_SENDER_IDS).length+' id(s)'))"
```

**A dry run proves nothing about the step it skips.** `interpret-list.js --dry-run`
explicitly does not call the model, which is exactly why a dry run passed on 2026-08-03
while the real path was broken (D-04).

---

## Known gaps, recorded rather than implied away

1. **`asdair_ro`'s `SELECT` on `asdair.regulars` exists in no migration.** The live planning
   path reads that table under the read-only role, but none of `005/006/008/009/010` grants
   it — the same provenance gap class as D-07. Preflight therefore asserts nothing about
   that pair: absence of a grant statement is not a committed denial, and inventing one
   would be a schema decision. **This needs a migration** (WO-G).
2. **A third role, `cp_worker`**, reaches the same command surface through
   `services/control-plane/wp-d-proof/asdair-worker.mjs` using its own connection settings.
   Its grants are not in this matrix and are not checked.
3. `ASDAIR_HOUSEHOLD_ID` silently defaults to `1`. Harmless today; wrong the moment a second
   household exists.

## See also

- `services/asdair/pipeline-runtime/README.md` — the supervised runtime
- `services/asdair/db/` — migrations `005/006/008/009/010` carry the grant matrix preflight checks
- `Builds/BUILD-015-asdair-durable-household-shopping-steward/DEFECT-LEDGER.md` — D-01, D-02, D-04, D-05, D-07
- `Team Knowledge/SOPs/SOP-021a-asdair-live-execution-method.md` — the mechanical execution reality
