# CareerAIR Funnel + Zapier route evidence (public process-level)

```yaml
date: 2026-08-06
branch: build-020/phase4-automation-law
private_surface: C:\.fusion247\private\careerair\**
funnel_host: warwick-yoga.tailbc1fe3.ts.net
public_intake_path: /careerair/email-intake
active_provider: zapier_webhook
outlook_connector: DISABLED_NOT_CONFIGURED
```

**No email bodies, secrets, tokens, or mailbox content in this file.**

## Funnel

| Check | Result |
|---|---|
| Funnel enabled on tailnet | YES (Warwick) |
| `tailscale funnel --bg 8787` | Public HTTPS → `127.0.0.1:8787` |
| GET `/careerair/health` via Funnel | ok, secretConfigured true (length only) |
| POST intake unauthenticated | **401** |
| GET `/` | **404** (no open root app) |
| Authenticated fixture via Funnel | **200** persisted, id assigned |
| Duplicate via Funnel | **200** `duplicate:true` |
| Processor | claimed 1 / processed 1 → opportunity path |

## Task economics (24 remaining)

Canonical private note: `C:\.fusion247\private\careerair\config\ZAPIER-TASK-ECONOMICS.md`

| Item | Value |
|---|---|
| Charge unit | 1 Webhook POST action = 1 task |
| Empty event-trigger periods | **0 tasks** |
| Avoid | Schedule + folder search (charges empty) |
| Heartbeat Zap | **Not used** — local liveness (0 Zapier) |
| Projected exhaustion | Depends on email volume; moderate ~3/day ≈ 8 days on 24 |
| Paid plan | **Not authorised** |

## Fail-loud (independent of Zapier)

| Check | Result |
|---|---|
| Controlled stop of webhook | CareerAIR bot **ALERT** `receiver_stopped` sent |
| Restart + liveness | **RECOVERED** message sent |
| Dedup | second consecutive same incident suppressed |
| Scheduler | `CareerAIR-Ops-Liveness` every 30 min |

## Durable outside PR

| Item | Location |
|---|---|
| Runtime root | `C:\.fusion247\private\careerair` (not BUILD-020 worktree) |
| Install marker | `runtime/INSTALLED-FROM.txt` |
| Ops state | `runtime/ops/state.json` |
| Supervisor | `ensure-local-services.mjs` + `MyPKA-Local-Services-Live` |
| Processor tasks | CareerAIR-Email-0800/1200/1700 |
| Provider config | `config/source-providers.json` |
| Switchover | `config/OUTLOOK-CONNECTOR-SWITCHOVER.md` |

## Provider seam (secondary)

| Check | Result |
|---|---|
| Offline tests | 4/4 pass (`tests/email/providers.test.mjs`) |
| zapier_webhook | active |
| outlook_connector | DISABLED_NOT_CONFIGURED; credential load refuses |
| Mutual exclusion fence | REFUSE if both writers enabled |

## Residual for full automatic Outlook→CareerAIR

**Zapier Zaps** must be created once in Zapier UI against `warwickallan@outlook.com` folders (MCP cannot author Outlook Zaps). Funnel + receiver + processor + fail-loud are live. Until Zaps exist, automatic folder delivery does not start; contact staleness alerts after tolerance.

## Cockpit

Browser shoot earlier same day + live `email-ops` healthy when services up. Overview email strip present in overlay.
