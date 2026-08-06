# CareerAIR live Zap acceptance — attempt log (process-level)

```yaml
date: 2026-08-06
head: f0d2614 (tip may advance with docs)
private_surface: C:\.fusion247\private\careerair\**
```

## Controlled messages

| ID | Action | Result |
|---|---|---|
| T1 CAREERAIR-LIVE-ZAP-20260806-T1 | Sent to self → moved to CareerAIR/Opportunities | In folder; **no** accepted email_message within 8+ min |
| T2 CAREERAIR-LIVE-ZAP-20260806-T2 | Same after Authorization Bearer support | In folder; **no** accepted email_message within 10+ min |

## Funnel / receiver (still green)

| Check | Result |
|---|---|
| Funnel health | ok |
| X-CareerAIR-Token POST | 200 |
| Authorization: Bearer POST | 200 (added after first missing_token diagnosis) |
| No auth | 401 |

## Delivery ledger (relevant)

| Approx time (UTC) | Disposition | Reason |
|---|---|---|
| 17:13 | accepted/duplicate | Prior funnel fixture (Larry) |
| 17:26 | rejected_auth | **missing_token** (coincident with T1 window) |
| 17:37 | rejected_auth | **missing_token** (coincident with auth restart / T2 window) |

**No accepted delivery from Zap after Zaps declared live.** Receiver is reachable; authentication material is not arriving on those POSTs.

## Auth fix banked privately

`src/email/auth.mjs` now accepts both `x-careerair-token` and `Authorization: Bearer`.  
Auth rejections record **header names only** (never values) for next diagnosis.

## Residual (account / Zapier config)

Warwick to confirm both Zaps send header **X-CareerAIR-Token** (or Bearer) and re-Test.  
Ding #344 describes the fix. No paid plan change.

## Not blocked for interim product claims

- Funnel → durable queue → processor (prior fixtures)
- Fail-loud bot
- Durable private install
- Provider seam

**Automatic Outlook→Zap→CareerAIR** remains HOLD until one accepted delivery lands without Larry POST.
