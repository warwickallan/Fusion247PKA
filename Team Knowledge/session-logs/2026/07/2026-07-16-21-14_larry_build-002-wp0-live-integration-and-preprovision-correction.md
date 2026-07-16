---
agent_id: larry
session_id: build-002-wp0-live-integration-and-preprovision-correction
timestamp: 2026-07-16T21:14:58Z
type: close-session
linked_sops: ["SOP-019-fusion-delivery-tracking"]
linked_workstreams: []
linked_guidelines: []
---

# BUILD-002 WP0 — live-integration backend + long-poll runner built and proven; credential model corrected; live phone proof blocked by execution-environment egress

## Coverage window

- **Previous close checkpoint:** `[[2026-07-16-09-45_larry_close-session]]`
- **Covered from:** 2026-07-16T09:45Z
- **Covered to:** 2026-07-16T21:14:58Z
- **First checkpoint:** no

_The BUILD-002 promotion + WP0 setup at the front of this window is already logged in `[[2026-07-16-12-00_larry_build-002-promotion-and-wp0-setup]]`; this entry cross-links it and does not retell it, covering the WP0 build arc that followed._

## Context

Across many sequential Warwick/GPT instructions this window, we took BUILD-002 (Unified Personal Capture Gateway) from promotion through the whole WP0 arc: fixtures baseline → cross-model reviews → PR #28 merge → the live-integration slice (PR #29) → a pre-provisioning correction pass → a live-wiring resume attempt that stopped honestly at an environment boundary. The acceptance gate — the real phone-visible Telegram → Save-to-Brain → governed Markdown → Completed proof — is not yet met.

## What we did

- **Larry** promoted IDEA-002 → BUILD-002 and stood up the WP0 foundation (see the 12:00 log), then routed the build to specialists and synthesized throughout.
- **Silas** built the domain core + migrations, the real Postgres operational-store adapter (`FOR UPDATE SKIP LOCKED` transactional claim, RLS deny-by-default + service_role policies, retention, cascade erasure, due-retry index), and — this window's tail — migration `0005` adding the durable card target (`processing_state.card_ref`) + the long-poll offset cursor (`fcg.channel_poll_offset`), with both stores gaining `recordCardRef`/`findCaptureIdByCard`/`get`/`setPollOffset`.
- **Mack** built the adapters/worker/intake, the F-04..F-10 pre-live controls, the real Telegram Bot-API adapter, the async unification (one code path drives fixture + Postgres), and — this window's tail — the executable long-poll runner (`src/live/liveRunner.js`, `npm run live:proof`): callback handling, restart-safe card projection, durable offset, secret masking, honest failure.
- **Sonnet 5** (cross-model) ran a review-and-fix pass on PR #28 and found the real retry-runtime gap (added `retryPolicy.js` + `recordFailure()` + autonomous due-reclaim) and an erasure defect.
- **GrokQA** ran an independent adversarial review (PASS WITH CORRECTIONS, no BLOCKER/HIGH/MEDIUM).
- **Vex** ran the security delta on PR #28 (PASS, SECURITY DELTA GREEN); the live credential/transport sign-off remains deferred until real credentials exist.
- **Larry** corrected the Supabase credential model, resolved the governed Markdown destination to `Team Inbox/captures/`, updated all governance records (PR #29 body/comment; ClickUp pages 00.1/01.1/02/03; the WP0 task + subtasks), and on the resume attempt inspected the environment and reported the egress blocker without improvising.
- Proof state at close: `node --test` (no DB) **145 pass / 14 skip / 0 fail**; with real Postgres **159 pass / 0 fail** (migrations 0001–0005, card_ref + offset persistence, the runner e2e across a restart, full saga/offline/dead-letter); secret scan clean (338 files); CI unit + postgres:16 integration + secret-scan all green on head `05a804b`.

## Decisions made

- **Question:** How should the Supabase credential model be represented in config?
  **Decision:** Three distinct surfaces — (A) build-time project access via Supabase MCP (not an env secret); (B) `DATABASE_URL` = the Postgres connection string carrying the **project DB password** (not a service_role key); (C) Supabase Data API keys optional/reserved and unused. Minimal `REQUIRED_AT_RUNTIME` = `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `AUTHORISED_TELEGRAM_USER_ID`, `WORKER_ID`.
- **Question:** What transport for the first WP0 proof?
  **Decision:** Telegram **getUpdates long polling** — no webhook, HTTP server, DNS, inbound firewall, or `TELEGRAM_WEBHOOK_SECRET`. Webhook code retained as future infrastructure only.
- **Question:** Where does the governed live write land?
  **Decision:** `Team Inbox/captures/<capture_id>.md` — the authority-backed governed inbox (root `AGENTS.md` + `Team Inbox/README.md` + authority matrix §1). The mechanical worker lands the raw capture; Penn/Larry triage the semantic PKM home later.
- **Question:** How to handle restart-safe card targeting + the poll offset?
  **Decision:** Persist both durably (migration 0005); the worker re-targets the original card from `card_ref`, and the offset advances only after the intake commit point (monotonic).

## Insights

- Running the merged migration against a **real** Postgres caught a genuine defect (an enum + table both named `processing_state`) that static-only tests missed — real-substrate verification earns its keep.
- "WAITING ON HUMAN" was over-applied: a large slice of the "remaining" work (credential model, long-poll runner, restart safety, governed destination) was agent-ownable and only looked human-blocked.
- An execution environment's **network egress policy** is a first-class dependency for any live-integration proof — as real as secrets or code. This web environment's policy 403-denies Telegram + Supabase, so the proof cannot run here regardless of secrets.

## Realignments

- **Warwick (PREPROVISION-CORRECTION-0001):** "stop classifying the remaining work as entirely WAITING ON HUMAN." — "Do not describe DATABASE_URL as containing a service_role key or service_role password." — "remove SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from REQUIRED_AT_RUNTIME unless you add and justify an actual runtime use." — "Use the existing getUpdates long-polling capability for WP0." — "CAPTURE_BRAIN_DIR must not remain an unspecified default for the acceptance proof. Determine the exact governed Markdown destination from the existing myPKA authority."
- **Warwick (LIVE-RESUME-0001):** "Do not improvise another PostgreSQL or production destination if MCP access fails." — "Do not request or provision: TELEGRAM_WEBHOOK_SECRET; SUPABASE_URL; SUPABASE_SECRET_KEY; anon keys; service_role keys." — "The original Telegram token appeared in a screenshot. Treat it as compromised unless Warwick confirms that it has been rotated." — (proxy contract) organisation policy denials (403/407) are reported, not retried.

## Open threads

- [ ] **Live phone proof is blocked** by this environment: egress 403-denies `api.telegram.org` + the Supabase host; no Supabase MCP tool in-session; the four runtime secrets absent; bot-token rotation unconfirmed. Needs an environment with Telegram+Supabase egress, the secrets, and MCP-or-`DATABASE_URL`.
- [ ] **Warwick to confirm** whether the `@Fusion247devbot` token (seen in a screenshot) has been rotated — only a rotated token may enter the secret store.
- [ ] **PR #29 open, DO-NOT-MERGE** (head `05a804b`), awaiting the phone proof then Vex live credential/transport sign-off.
- [ ] **Vex live sign-off** pending against the real wiring (real `DATABASE_URL` credential/TLS, live token handling, RLS against the real project, getUpdates auth + allowlist for id `8601328832`).

## Next steps

- **Exact next resumption point:** re-run the live wiring from an environment that has all of — (1) egress allow-listed to `api.telegram.org` + the Supabase project host (Postgres via direct `5432` or the Supabase pooler), (2) the four runtime secrets injected, (3) the Supabase MCP connected **or** `DATABASE_URL` present for `psql` migrations — e.g. Warwick's authorised dev-machine Claude Code, or a web execution environment whose network policy allow-lists those hosts. Confirm the bot token was rotated first.
- Then: apply migrations `0001–0005`; wire `createLiveRunner` to the managed secrets; verify connection + RLS + getUpdates auth with masked diagnostics; run the phone-visible proof; hand to Vex.
- Do not merge PR #29 without Warwick's explicit merge decision; WP0 is complete only after the phone proof passes.

## VlogOps / story signals

- **Guardrailed-autonomy arc** (ties to Handbook 10.1 "BUILD-002 Lessons"): a multi-model relay — Larry/Silas/Mack build, Sonnet + GrokQA + Vex challenge — with the human holding the merge and the live boundary.
- **Real reversal, honestly handled:** the migration defect that only a real database caught; and the closing beat — the live proof stopped at an environment egress wall and was *reported, not faked*. Memorable line: "the proof cannot run from this environment — reported, not retried."
- Visible demonstration when it runs: a phone card flipping to **Completed** with a link to a note that appears in `Team Inbox/captures/`.

## Cross-links

- `[[2026-07-16-09-45_larry_close-session]]` — previous close checkpoint (start boundary).
- `[[2026-07-16-12-00_larry_build-002-promotion-and-wp0-setup]]` — the promotion + WP0 setup at the front of this window (not retold here).
