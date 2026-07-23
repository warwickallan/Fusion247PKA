# Fusion247 mailbox → Cairn (Microsoft Graph email adapter)

The dedicated Outlook mailbox is Fusion247's `inbox@` — the external email door into the brain.
**Everything sent to it is intentionally for Fusion247**; Cairn works out what each message is.
Graph reads it from the Hetzner engine room, so the Yoga can be off.

The adapter only: **retrieves → durably captures body/metadata/attachments → dedupes → receipts →
hands `capture_id` to Cairn.** It contains no routing logic — Cairn owns routing.

---

## One-time setup (your ~10 minutes)

### 1. Create the dedicated account (NOT an alias)
Create a genuinely new Microsoft account, e.g. **`warwickallan-f247@outlook.com`**.
An alias shares your existing inbox; a new account gets its own separate inbox — which is what we want.
Add it to desktop Outlook on the Yoga if you like *seeing* it, but the Yoga does not feed Fusion.

### 2. Register a public-client app (gives delegated Mail.Read)
In the Azure/Entra portal (portal.azure.com → *App registrations* → *New registration*):
- **Name:** `Fusion247 Email Adapter`
- **Supported account types:** *Personal Microsoft accounts only* (or *…and org accounts*)
- **Redirect URI:** leave blank (device-code flow)
- After creating, open *Authentication* → *Advanced settings* → set **Allow public client flows = Yes**.
- Copy the **Application (client) ID**.

No client secret is needed (device-code + public client). The client ID is not a secret.

### 3. Drop the env file
Create `C:\.fusion247\msgraph.env`:

```env
MS_GRAPH_CLIENT_ID=<the Application (client) ID from step 2>
MS_GRAPH_TENANT=consumers
MS_GRAPH_MAILBOX=warwickallan-f247@outlook.com
MS_GRAPH_SCOPE=offline_access Mail.Read
# optional: EMAIL_ATTACH_BYTE_CAP=3000000
```

### 4. Authorise once
```bash
cd services/obsidiwikai
node --env-file=C:/.fusion247/msgraph.env --env-file=C:/.fusion247/fusion-capture-gateway.env \
  src/bin/email-authorize.mjs
```
It prints a short code + a URL. Open the URL, enter the code, **sign in as
`warwickallan-f247@outlook.com`**, approve *Mail.Read*. The rotating refresh token is then persisted
server-side (Supabase `obsidiwikai.oauth_token`) — the poller runs forever, Yoga off.

### 5. Establish the baseline (ignores pre-existing welcome/security mail)
```bash
node --env-file=C:/.fusion247/msgraph.env --env-file=C:/.fusion247/fusion-capture-gateway.env \
  src/bin/email-baseline.mjs
```
Only mail arriving **after** this point is ever captured.

---

## Running the poller

```bash
ENVS="--env-file=C:/.fusion247/msgraph.env --env-file=C:/.fusion247/lightrag.env \
  --env-file=C:/.fusion247/neo4j.env --env-file=C:/.fusion247/honcho.env \
  --env-file=C:/.fusion247/fusion-capture-gateway.env"

# one pass
node $ENVS src/bin/email-poll.mjs

# daemon (Hetzner) — poll every 60s
EMAIL_POLL_INTERVAL_S=60 node $ENVS src/bin/email-poll.mjs
```

Each new mail → durable row in `obsidiwikai.inbound_email` (+ `email_attachment`) → Cairn decision →
correct destination → receipt on the row. Replays dedupe (unique `dedupe_key`). A routing failure
leaves the mail captured (`routed=false`) and `routeUnrouted()` re-drives it on the next cycle.

## What Cairn does with it (examples)
| You send to the mailbox | Cairn routes to |
|---|---|
| Subject **"Honch that"** (GPT emails a conversation excerpt) | Honcho context lane → Context Outbox |
| An article / a YouTube link | Encyclopedia (learn), confirm-first |
| "remind me to chase this Tuesday" | Task lane |
| Anything unclear | Asks you (no guess) |

## Rollback
The deprecated `fusiongptbot` Telegram bot stays available as rollback until this path passes live
end-to-end acceptance, then it is retired.
