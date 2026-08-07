# CareerAIR — Zapier-MCP demonstration collection: executed evidence

**Date:** 2026-08-06 · **Host:** Claude · **Branch:** `build-020/phase4-automation-law`
**Authority:** [[Deliverables/2026-08-04-proofline-wayfinder-plan]] § ACTIVE SESSION WORK PACKAGE, Amendment 3, row 3
**Private surface:** `C:\.fusion247\private\careerair\**` (declared; GL-012 loaded before access)

> ## 🔴 ROW 3 REMAINS **NOT LIVE**
>
> Everything below is **demonstration evidence that the intake path works on real mail**. It is
> **not** session-independent automatic collection. Every collection call in this record was made by
> **Larry, inside an interactive session**, through a Zapier MCP tool that **does not exist outside
> one**. It fails the standing test in root `CLAUDE.md` § *"Nothing may live only in Larry's head"*:
> the real production event does not invoke it, and a fresh session cannot use it unprompted.
>
> **A genuinely automatic trigger is still required before row 3 can PASS.** This record does not
> soften that, and must not be cited as if it did.

## Personal-data discipline

This file is in the **public** repo. It carries **ids, digests, counts, states and timings only** —
no subject, no sender, no body, no recipient. That mirrors the codebase's own rule
(*"Ids and enums only — never the subject, the sender or the body"*). Raw collected payloads live
**only** in the private surface at `runtime/mcp-staging/2026-08-06-demo-collection.json`.

## 1. The Grok-host blocker was host-specific — established, not assumed

The banked blocker (`6b48507`) recorded Zapier MCP as *"ClickUp + GitHub only, zero Outlook actions"*.
**On the Claude host that is false.** Executed:

- Microsoft Outlook enabled, **35 actions**, default connection **`warwickallan@outlook.com`**.
- `microsoft_outlook_find_emails` and `microsoft_outlook_find_emails_in_specific_folder` both present.
- The **second** Outlook connection was **not touched and not investigated** (Warwick, explicit).

## 2. 🔍 The finding that would have made a collector silently collect nothing, forever

`find_emails_in_specific_folder`'s folder picker returned **top-level folders only**. `CareerAIR`
appeared, and reading it returned `{"results":[]}`.

That empty result was **not** an empty mailbox. Direct Graph on the folder:

```
totalItemCount: 0 · sizeInBytes: 0 · childFolderCount: 2
```

The mail is in **child** folders the picker cannot see:

| Folder | Items | Unread |
|---|---|---|
| `CareerAIR/Application Updates` | 30 | 2 |
| `CareerAIR/Opportunities` | 130 | 119 |

**A collector built on Zapier's folder picker alone would have reported success and collected zero
messages indefinitely.** The empty result and a genuinely empty folder are indistinguishable without
the child-folder check. Recorded because it is the kind of silent-zero failure that survives review.

**Control that made the negative claim safe:** the same action against `Inbox` returned ~358k
characters, proving the read path worked before "empty" was believed.

**Reconciliation:** the two child folder ids match `config/outlook-scout.json` `folders.opportunities.id`
and `folders.applicationUpdates.id` **exactly**, and the connection used matches its recorded
`zapier_connection_id`. The config was right; the picker is the limited surface.

## 3. The journey, executed

Collected **4 real messages** (2 per channel) with the documented `$select`, staged to the private
surface, then fed through the **existing** contract → store → processor.

The driver `scripts/careerair-mcp-stage-ingest.mjs` calls only existing code —
`loadFolderRouting()` → `normaliseDelivery()` → `createPgEmailStore().enqueue()` — the same path the
HTTP endpoint takes *after* it authenticates. No validation, routing, digesting, dedupe or
persistence is re-implemented. The endpoint's **auth layer is deliberately not exercised**: the
shared token is credential material and GL-012 §2 forbids reading it.

| Property | Evidence |
|---|---|
| **Channel derived, never trusted** | 4/4 validated; channels derived from folder id (`application-updates` ×2, `opportunities` ×2) |
| **Persist before ack** | `INSERTED id=79..82 state=queued deliveries=1`, inside the store's transaction |
| **Dedupe (pre-processing)** | Re-ingest → `DUPLICATE id=79..82 deliveries=2`, `inserted=0`; **queue depth still 4** |
| **Intake + correct next state** | processor: `claimed 4, processed 4` → 2 new opportunities, 2 needs-review; exit 0 |
| **Queue drains** | `DRY RUN — 0 message(s) queued` |
| **Run idempotency** | second run → `skipped — run_already_recorded (one summary per run)` |
| **🔑 No-dupe on RESTART** | re-collect the same 4 **after** processing → `DUPLICATE … state=done deliveries=3`, **queue depth stays 0**. A re-collection cannot resurrect processed mail. |
| **No external consequential action** | no `fetch`/HTTP in `process.mjs`, `links.mjs`, `classify.mjs`; `links.mjs` only parses and canonicalises. Telegram sink unconfigured → Cockpit card only. |
| **Deny by default** | a delivery bearing the real **Inbox** id → `REFUSED reason=unknown_folder`, exit 1, **nothing written**, queue unchanged at 4. The Inbox is structurally unreachable, not merely un-requested. |

## 4. 🔴 Row 4 — a material truthfulness defect found and repaired

The Cockpit's `/careerair/api/email-ops` was reporting a **false operational picture**, and it
contradicted `runtime/ops/state.json` on the same fact.

**Cause, from the code — two separate conflations:**

1. `collector.state` was assigned **solely** from a health probe of the local webhook process. That
   probe answers *"is the door open"*, not *"is mail arriving"* — and the Zapier Funnel feeding that
   door is the **dormant** adapter with **no Zaps in existence**.
2. `collector.last_success_at` was assigned from `lastSuccess`, queried from **`careerair.email_run`**
   — the **processing** run table. A processing success was being published as a **collection** success.

**Observed before the repair:** `collector: "up"`, `healthy: true`, and `last_successful_collection`
pointing at **my own processing run** — a run that collected nothing.

**Repair (minimal, in the existing surface):** ingress is reported as its own fact; collector state
is sourced from the durable ops record and the provider selection; `last_successful_collection` is a
real collection event or `null`; the processing run is separately and correctly labelled.

| Field | Before | After |
|---|---|---|
| `healthy` | `true` | `false` |
| `collector.state` | `up` | `down` |
| `failure` | `null` | `collector unhealthy: graph_auth_required: CAREERAIR_GRAPH_CLIENT_ID not set…` |
| `last_successful_collection` | a processing run | `null` |
| ingress | conflated into collector | separate, `up` |
| `last_successful_processing_run` | *(absent)* | present and correctly labelled |

Row 4's required separation now genuinely holds: `no_messages: false` · `collector: down` (exact
reason) · `consumer: ok`. The surface now **agrees** with `runtime/ops/state.json` instead of
contradicting it.

## 4a. 🔴 D-4 — the same defect class, one layer further out (Veritas Gate 1 @ `0cf70c9`)

Veritas found that the repaired surface **still misdirected the operator**. The response contradicted itself:

```
"failure":  "collector unhealthy: graph_auth_required: CAREERAIR_GRAPH_CLIENT_ID not set…"
"collector": { … "provider_active": "zapier_webhook" }
```

It sent the operator to configure **Microsoft Graph** — a route the Work Package rules
**unauthorised** — when the true reason is that **no automatic trigger exists on the authorised
route**. An "exact failure" that names a forbidden remedy is worse than a vague one. Root cause is
the provider contradiction already recorded as residual 5, leaking onto the user-visible surface.

**Repaired and verified live:**

```
failure           : collector unhealthy: no automatic collection trigger exists on the
                    authorised route — collection is currently manual. (A stale incident from a
                    non-authorised route is also recorded; see recorded_incident. Do NOT act on
                    it without Warwick changing the route.)
authorised_route  : zapier_webhook
recorded_incident : {kind: graph_auth_required, since: 2026-08-06T20:50:06.100Z}
```

The raw incident is **preserved, not hidden** — it remains a true fact about the machine; it is
simply not the operator's next action.

## 5. Honest limitations and residuals — none of these are claimed as done

- **Row 3 is NOT LIVE.** No automatic trigger exists. `config/outlook-scout.json`
  `_ARCHITECTURAL_BLOCKER` (verified 2026-07-29) independently corroborates: headless `claude -p`
  returns NO-MCP-TOOLS and a subagent's nested run has no MCP either, so no scheduled run can reach
  this mailbox by any currently available route.
- **Contradiction, recorded not resolved:** `config/source-providers.json` declares
  `active: "outlook_connector"` (Graph poller) while the Work Package rules Graph **not** the
  authorised route, and `runtime/ops/state.json` reports `provider_active: "zapier_webhook"`.
  Three sources, two disagreements. **Not resolved here** — it needs Warwick's route decision.
- **Zapier MCP redacts the mailbox owner's own address** to a censored token, so `fromAddress` for
  self-sent mail is not recoverable through this route. Recorded, not worked around.
- **The private surface is not under version control** (`not a git repository`). Today's changes to
  `src/cockpit/server.mjs` and the new ingest driver therefore have **no history and no rollback**.
  Flagged as a durability risk; **not** fixed here.
- **CareerAIR private suite: 478 tests, 418 pass, 60 fail.** The 60 are in the evidence/fact-store
  DB-role suite; **zero** failing tests touch cockpit, email, ops, collector or intake, and
  `tests/email/**` is **4/4 green**. **Pre-existing and unrelated — recorded once, not adopted as
  work** per the finding-disposition rule.
- **Only 4 of 160 messages were collected.** This is a demonstration, not a backfill.
- **Builder self-test evidence, not independent review.** Veritas gates it.
