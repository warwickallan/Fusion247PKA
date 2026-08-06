# CareerAIR — Zapier cancelled; Graph collector route

```yaml
date: 2026-08-06
status: Zapier paid Webhooks not authorised — automatic collection NOT live until Graph consent
private_surface: C:\.fusion247\private\careerair\**
```

## Correction

- **No Zapier Zaps** will be used (paid plan required; not authorised).
- MCP Outlook app connection ≠ background collector.
- Funnel + authenticated webhook + queue + processor + Cockpit email-ops + fail-loud: **preserved as dormant/replaceable adapter**, not “auto collection live”.
- Prior `missing_token` ledger noise is **not** attributed to a CareerAIR Zap.

## Replacement route (owned by Larry)

| Piece | Location |
|---|---|
| Graph auth (MSAL public client + cache) | `src/email/graph-auth.mjs` |
| Folder poll → same `email_message` store | `src/email/graph-collect.mjs` |
| Bootstrap (device code) | `scripts/careerair-graph-bootstrap.mjs` |
| Collect entry | `scripts/careerair-graph-collect.mjs` |
| Cursor | `runtime/graph/cursor.json` |
| Provider config | `config/source-providers.json` — zapier **disabled/dormant**; outlook_connector **ACTIVE_WHEN_GRAPH_AUTH** |

## Single Warwick action (after prep)

**Free Entra public-client app id + one device-code sign-in as `warwickallan@outlook.com` with Mail.Read.**  
No paid Zapier. No manual Zap field mapping.

Until that completes: collector exits `GRAPH_CLIENT_ID_MISSING` or `GRAPH_AUTH_REQUIRED` and fail-loud can alert.

## Acceptance bar (honest)

Automatic Outlook collection is **accepted only after**:

1. Graph bootstrap succeeds (token cache present),
2. Scheduled/manual collect pulls a real/controlled message from CareerAIR folder(s),
3. `email_message` accepted (or duplicate),
4. Processor advances,
5. Cockpit email-ops truthful.

## Not done in this note

Veritas/Codex while row 2 was falsely “Zap live” — correctly deferred.
