# CareerAIR — Zapier MCP personal-mailbox path (honest status)

```yaml
date: 2026-08-06
status: BLOCKED — Zapier MCP has no Microsoft Outlook tools in this host session
mailbox_target: warwickallan@outlook.com
not_used: Claude Outlook connector (warwick.allan@bellrock.co.uk work)
not_used: Entra app registration / Graph device-code
not_used: paid Zapier Webhooks / Custom Request / published Zaps
```

## Correction (Warwick 2026-08-06)

1. **Do not use** the Claude **Outlook** connector — that is the **work** account (`warwick.allan@bellrock.co.uk`). A prior folder list in this session used that connector by mistake.
2. **Do not use** Entra / free app registration for Graph. Not authorised as the path.
3. **Use** Zapier MCP with the connected personal account **`warwickallan@outlook.com`**.
4. Paid Zapier Webhooks remain cancelled. Funnel + authenticated webhook + queue + processor + Cockpit + fail-loud stay **dormant adapter**.
5. Automatic Outlook collection is **not live** until mail from the personal mailbox is collected and accepted into CareerAIR without a false claim.

## Proven in this Grok session

| Check | Result |
|---|---|
| Zapier MCP server connected | Yes (`zapier` server, tools available) |
| Zapier tools present | **ClickUp + GitHub only** (plus config helpers) |
| `zapier__microsoft_outlook_find_email` | **Tool not found** |
| Search for any `zapier__*outlook*` / Microsoft mail tool | **None** |
| Claude Outlook connector (`outlook__*`) | Present — **work mailbox** — **must not be used for CareerAIR** |
| Zapier MCP config URL | https://mcp.zapier.com/mcp/servers/ccffef98-9615-4a5d-967a-83b4ab3acd0e/config |

Having a Microsoft Outlook **app connection** inside Zapier is **not** the same as exposing Outlook **MCP actions** on this server. No Find Email / Get Email (or equivalent) action is currently bound here, so Larry cannot read `warwickallan@outlook.com` via Zapier MCP until those actions are added.

## Single unblock (free — not paid Webhooks)

On the Zapier MCP config page above, **add Microsoft Outlook actions** for the account **`warwickallan@outlook.com`**, at minimum:

- Find Email (or List/Search emails)
- Get Email (full body) if separate from Find

Then re-open this session (or reconnect MCP). Larry will:

1. List CareerAIR/Opportunities + CareerAIR/Application Updates via those tools only  
2. POST into the existing local CareerAIR queue (localhost webhook / store — **no** Zapier Custom Request)  
3. Run the existing processor  
4. Confirm Cockpit email-ops  

That is **not** building a paid Zap. It is enabling free MCP actions on the already-connected personal Outlook app.

## What is already ready (dormant / local)

- Funnel + `/careerair/email-intake` auth + durable queue + processor  
- Cockpit projection + fail-loud CareerAIR bot  
- Folder IDs in private `outlook-scout.json` for personal mailbox CareerAIR folders  
- Graph poller code may exist on disk but is **not** the authorised route and is **not** claimed live  

## Automation honesty

Zapier MCP tools only run when a host agent session has them. They are **not** a background Windows schedule by themselves. After MCP Outlook actions work end-to-end once, Larry will wire the durable collect path that does **not** require paid Zapier Webhooks and does **not** use the work Outlook connector.

## Claim bar

**Do not** claim automatic Outlook collection accepted until a real message from `warwickallan@outlook.com` CareerAIR folders is accepted into `email_message` and processed, via the Zapier-MCP (or later durable) path — not via synthetic Larry POST alone, and not via the work Outlook connector.
