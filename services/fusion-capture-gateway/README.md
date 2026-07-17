# fusion-capture-gateway

WP0 slice of **BUILD-002 — Unified Personal Capture Gateway**. The smallest
reusable slice of the capture platform: a channel-neutral intake, a durable
operational store, a local worker that performs a governed Markdown write and
proves it with an evidence pointer, and an executable **live runner** that
long-polls Telegram and drives the whole saga.

> **Hard boundary.** No real secrets, no real project, no personal data are
> committed here. The unit suite is fully hermetic. The live phone-visible
> acceptance proof runs only against an **isolated dev** Telegram bot + Supabase
> project, with secrets injected from the environment's secret store, and only
> after the Vex WP0 credential-boundary review
> (`Builds/BUILD-002-.../Security/wp0-security-gate.md` §6).

## What it is

- **Contracts + state machine + idempotency + operational store** (Silas's domain
  core) — channel-neutral Capture Envelope / Action / Receipt, the processing
  state machine, deterministic idempotency keys, and an in-memory operational
  store that mirrors the Supabase seam.
- **Adapters + worker** (this stage):
  - `src/config.js` — env-var **names** only; fixtures mode when secrets absent.
  - `src/adapters/telegramAdapter.js` — thin channel adapter mapping a synthetic
    Telegram update onto the neutral envelope, with a single-user allowlist
    (default-deny) and an in-memory card log (no network).
  - `src/markdownWriter.js` — sandboxed, **idempotent** governed Markdown write.
  - `src/receiptProjection.js` — pure, retryable receipt + card projections.
  - `src/intake.js` — the durable acceptance path (commit point + dedup).
  - `src/worker.js` — the pull/claim/write/evidence/complete cycle, including
    autonomous retry scheduling and retry-exhaustion → dead-letter.
  - `src/core/retryPolicy.js` — deterministic bounded-retry backoff (pure logic).
- **Governance control surface** (BUILD-002 WP2) — the sole Telegram poller also
  recognises governance signals and routes them to the Fusion Tower, WITHOUT a
  second poller:
  - `src/governance/commandGrammar.js` — pure grammar: `/status`, `/trace`,
    `/watch on|milestones|off`, `/pause`, `/resume`, `/stop`, `/approve`, and the
    `/gov`|`/run` run-start prefix (recognised so it is not captured; run-start
    execution is the Tower's job), plus the `dec:<gate_token>:<decision>`
    decision-card callback parse.
  - `src/governance/detect.js` — the additive pre-check that classifies an update
    as `capture | gov_command | gov_decision | ignore`, reusing the SAME allowlist
    + private-direct-chat gate (`authorisePrivateChatSender`) as capture. Auth
    runs first: an unauthorised / non-private update returns `capture` WITHOUT
    parsing the command, so no governance oracle leaks to a stranger.
  - `src/store/ftwCommandIntake.js` — a thin, least-privilege writer of
    `ftw.run_event` rows (`kind='command:<name>'` deduped on the `update_id`;
    `kind='command:decision'` deduped on `cb:<callback_query.id>`) via
    `INSERT … ON CONFLICT (source, source_event_id) DO NOTHING`. The live backend
    REUSES the operational store's service_role connection (the `store.query`
    seam — no second pool); fixtures use an in-memory backend. WP2 only DETECTS +
    WRITES these events; the Tower consumes and executes them and sends any reply.
  - **Fail-closed decision (documented).** If a governance event cannot be written
    (no ftw writer wired, or the ftw schema/connection absent so the insert
    throws), the runner logs a **masked, structured error** and does **not**
    capture the command as a note and does **not** silently swallow it. Dropping a
    governance command with a loud audit trail is the safe posture; misfiling a
    `/stop` as a Brain note is not. The offset still advances — this is the sole
    poller, so wedging it on a poison command would also block real captures. A
    decision tap is always answered (`answerCallbackQuery`, **outbound only, no
    poll**) so Telegram stops the button spinner.

## Run the tests

```sh
node --test
```

Fully hermetic: no network, no real credentials. Sandbox dirs use
`os.tmpdir()` + `fs.mkdtempSync` and are cleaned up per test.

**Enforced in CI:** `.github/workflows/fusion-capture-gateway-tests.yml` runs
this full suite on Node 22 for every push/PR that touches this service or its
BUILD contract records — the test suite is not local-only evidence.

## The durable-saga model (why captures are never lost or falsely completed)

1. **Supabase acceptance = the commit point.** The instant `recordIntake`
   returns, the capture is durable — independent of worker liveness. The card
   renders **"safe and waiting"**, never "Completed".
1b. **Tap-gated confirmation (Warwick decision, 2026-07-16).** An accepted text
   capture **holds at the pending, non-claimable `accepted` state** — the card
   shows the action buttons and NOTHING is written until the user taps
   **"Save to Brain"** (`intake.confirmSave`), which enqueues it for the worker.
   Double-taps and taps after completion are idempotent no-ops; an untapped card
   stays pending forever in WP0 (no timeout logic). The pending hold is
   restart-safe: the durable `card_ref` routes a post-restart tap back to its
   capture. A **non-text** update (photo/voice/document/sticker/empty text) is
   rejected before the commit point (`unsupported_content_type`) — no envelope,
   no queue row, no markdown — and answered with a plain "Text only in WP0"
   notice.
2. **Leased claims.** The worker atomically claims the oldest queued item and
   sets a lease. A crashed worker's lease expires and the row auto-releases, so a
   second worker can reclaim it.
3. **Idempotent Markdown writes.** The write target is a deterministic path
   derived from `capture_id`. If the note already exists, the writer detects it
   and does **not** rewrite — resume after a crash never double-writes.
4. **Autonomous bounded retry, then dead-letter.** A failed governed write
   transitions to `failed` and is stamped with a deterministic backoff due time
   (`src/core/retryPolicy.js`, exponential, capped). `store.claim()` is the ONLY
   place retry re-entry happens — it autonomously reclaims a `failed`/`partial`
   item once its due time arrives, with **no external scheduler or test helper**.
   Reclaiming before the due time is refused. Once `attempt_count` reaches
   `MAX_DELIVERY_ATTEMPTS` the item is parked in the terminal `dead_letter` state
   instead of being rescheduled — permanently distinguishable from a transient,
   still-retryable `failed`.
5. **Evidence-gated completion.** `completed` is reachable **only** via
   `written → evidenced → completed`, and only once a destination pointer **and**
   an evidence pointer both exist. No false completion is possible.
6. **Cards are retryable projections.** A card is a pure function of the store
   record. A **failed card edit never reverses or duplicates** the completed
   write — the worker swallows the projection error and leaves the state
   completed; the card can be re-projected later (`worker.retryCardProjection`).

## Live WP0 proof (Telegram → Brain over long polling)

The `src/live/` layer runs the exact same intake + worker against real Postgres
and the real Telegram Bot API. It uses **getUpdates long polling** — NO public
webhook, NO HTTP server, NO DNS, NO inbound firewall, NO webhook secret — so the
first proof runs from any authorised environment.

**Run it** (after the required secrets are present in the environment):

```sh
npm run live:proof     # node src/live/liveRunner.js
```

It refuses to start in fixtures mode (missing required NAMES) and prints a
masked diagnostic saying which are absent. On `SIGINT`/`SIGTERM` it stops the
poll loop and closes the Postgres pool.

### Credential model (three DISTINCT surfaces — do not blur them)

- **A. Build-time project access** — migrations are applied to the dev Supabase
  project via the project-scoped **Supabase MCP** (browser OAuth). This is tool
  access, *not* an env secret. No Supabase password or personal access token is
  requested.
- **B. Database runtime access** — the ONE runtime secret: `DATABASE_URL`, the
  libpq connection string from the Supabase **Connect** screen (**session pooler**
  host). It carries the **project database password** (the postgres role
  password). It is **not** a service_role API key. TLS is **verify-full with the
  pinned pooler CA** (FU-1): set `DATABASE_SSL_CA_FILE` to the committed
  `certs/supabase-pooler-ca.pem` (preferred), or spell the DSN
  `?sslmode=verify-full&sslrootcert=<ca path>`. A bare require-mode `sslmode`
  DSN does **not** verify the CA in node-postgres and fails the CI guard.
- **C. Supabase Data API keys** — `SUPABASE_URL` + a Supabase secret key are
  needed only if code calls the REST/Data API. The WP0 runtime reaches Postgres
  over `DATABASE_URL` and does **not** use them, so they are optional/reserved
  and **not requested**. A future Data-API need should prefer Supabase's current
  publishable/secret key model.

### Minimal required environment (WP0)

| NAME | Secret? | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Supabase Connect Postgres string, session-pooler host (DB password inline; keep ssl params OUT of it when the pinned-CA form is active) |
| `DATABASE_SSL_CA_FILE` | no | FU-1 — path to the pinned pooler CA (`certs/supabase-pooler-ca.pem`); activates verify-full via an explicit ssl config object |
| `TELEGRAM_BOT_TOKEN` | yes | @BotFather token for a throwaway **dev** bot |
| `AUTHORISED_TELEGRAM_USER_ID` | no | your numeric Telegram id (allowlist of one) |
| `WORKER_ID` | no | worker principal label |
| `CAPTURE_BRAIN_DIR` | no | *optional* override of the governed destination |

`TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` are **not**
required for the long-poll proof (see `.env.example`).

### Where each secret goes

Into the **runtime environment's managed secret store** (Claude Code on the web:
the environment's Secrets/Environment-variables settings; local dev: an OS
keychain or an `.env` kept outside the repo, chmod 600) — read from the process
environment at startup, masked in every diagnostic. **Never** in Git, ClickUp, PR
text, Markdown, or chat. The committed `.env.example` carries NAMES only.

### Governed Markdown destination (authority-backed)

| Aspect | Value |
|---|---|
| **Destination** | `Team Inbox/captures/<capture_id>.md` (repo `Team Inbox/`) |
| **Authority** | root `AGENTS.md` ("where the user drops raw inputs for Larry to route; Penn files into PKM") + `Team Inbox/README.md`; matrix §1 (Markdown canonical; Larry/Penn/Cairn decide semantic destination) |
| **Why the inbox, not a PKM note** | the mechanical worker lands the raw capture; it does **not** decide the semantic PKM home. Penn/Larry triage `Team Inbox/` into the Journal/CRM later — the worker "performs the governed write, it does not invent structure" |
| **Traversal boundary** | the writer confines all writes to `<baseDir>/captures/`; `capture_id` is charset-sanitised; any resolved path outside the leaf is refused |
| **Evidence-pointer form** | `{ evidence_kind: 'markdown_write', target_ref: <absolute note path>, content_hash: <git-blob sha1 of the note> }`, persisted in `fcg.evidence_pointer` |
| **Phone card reference** | on completion the card is edited in place to ``Completed — saved to your Brain (`<note path>`)`` — the path sits in a Markdown code span (parse_mode `Markdown`) so Telegram renders it monospace instead of auto-linking the `.md` filename — re-targeting the **original** card message (recovered from the durable `card_ref` after any restart) |

### Restart safety (§4)

- The long-poll **offset** is persisted in `fcg.channel_poll_offset` and advanced
  only after an update reaches the durable intake commit point, so a restart
  neither loses nor re-processes acknowledged updates (idempotent intake dedups
  any redelivery; the idempotent write means no duplicate Markdown; completion is
  evidence-gated so there is no false completion).
- The card target (`{chat_id, message_id}`) is persisted in `processing_state.card_ref`,
  so a restarted worker with a fresh adapter re-targets the **original** card.

## Boundaries

- **Store separation.** The operational store carries captures *in flight* only.
  Markdown is canonical. Nothing here promotes operational data to canonical
  except the governed worker write.
- **Single-user, default-deny.** One authorised numeric Telegram id; any other
  sender is silently ignored and logged, never actioned.
- **Secrets.** Never committed. Only `.env.example` (names only) is tracked;
  `.env` is gitignored. Secrets are masked in every echo.

## Secret scanning (F-02)

A zero-dependency scanner at the repo root, `scripts/secret-scan.sh`, checks every
**tracked** file for secret *values* (Telegram/JWT/Stripe/AWS/PEM/generic quoted
secrets) and fails the build on any hit. It excludes `*.md`, `.env.example`, and
itself to avoid matching name references.

- **Enforced control:** the GitHub Actions workflow
  `.github/workflows/secret-scan.yml` runs it on every `push` and `pull_request`.
  CI is the control that cannot be bypassed.
- **Run it locally:** `npm run scan` (from this service dir) or
  `bash scripts/secret-scan.sh` from the repo root. It exits `0` on a clean tree.
- **Optional local convenience hook** (mirrors CI, catches issues pre-commit):

  ```sh
  git config core.hooksPath services/fusion-capture-gateway/.githooks
  # ...or copy services/fusion-capture-gateway/.githooks/pre-commit
  #    to .git/hooks/pre-commit and chmod +x it.
  ```

  The hook runs the secret scan and `node --test`. It is a convenience only — the
  enforced control is CI.

## Migrations

The Postgres/Supabase DDL, applied in order:

- `0001_wp0_operational_baseline.sql` — schema, enums, tables, RLS-enabled.
- `0002_wp0_deletion_and_retention.sql` — cascade FKs + retention.
- `0003_wp0_rls_policies.sql` — service_role-only policy set (deny-by-default).
- `0004_wp0_retry_retention_indexes.sql` — partial due-retry index + retention.
- `0005_wp0_card_target_and_poll_offset.sql` — durable `card_ref` + long-poll
  offset cursor (restart safety, §4).
- `0006_wp1_cloud_intake_rpcs.sql` — WP1 always-on cloud intake: transport dedup
  ledger (`channel_update_dedup`), `intake_transport` marker, and the three
  SECURITY DEFINER RPCs (`fcg_webhook_intake` / `fcg_webhook_confirm_tap` /
  `fcg_webhook_card_ref`) — EXECUTE service_role-only, owned by the
  least-privilege `fcg_rpc_owner`, `search_path=''`. `fcg` stays non-exposed.

`test/migrations.test.js` statically verifies FK-name consistency between 0001
and 0002 and that RLS stays enabled deny-by-default (0002/0005/0006 never weaken
it), plus the 0006 tap-gate/EXECUTE-surface guards. The integration suites
(`{ skip: !DATABASE_URL }`) apply every migration against a real throwaway
Postgres and exercise the store — see below.

## Run the integration suite (real Postgres)

The unit run above skips the real-Postgres proofs. To run them, point
`DATABASE_URL` at a throwaway Postgres (a local service container is enough — no
real project, no personal data):

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres node --test
```

This applies migrations 0001–0006 from an empty schema and proves: transactional
`FOR UPDATE SKIP LOCKED` claim, RLS deny/allow, due-retry index, cascade erasure,
`card_ref` persistence + reverse lookup, the monotonic poll offset, the full
async saga end-to-end incl. the live **runner** (offset + card target durable
across a restart), the WP1 RPC surface (`test/webhookRpc.integration.test.js`,
P1–P12: EXECUTE matrix, definer hardening, cloud allowlist zero-rows,
transport + cross-transport dedup, rate guard, confirm-tap state matrix,
erasure interplay), and the WP1 synthetic end-to-end proof
(`test/webhookE2E.integration.test.js`, E2E-1…E2E-6: real pure edge handler →
real RPCs → real worker drain → markdown + completed card, incl. restart and
duplicate-redelivery safety). CI runs both jobs (see the workflow).

## WP1 — always-on cloud intake (webhook path)

The WP1 edge function lives at `supabase/functions/fcg-webhook-intake/`
(pure portable handler + Deno shell; the handler is unit-tested by this
service's suite — `test/webhookHandler.test.js`, `test/idempotencyParity.test.js`).
The worker/drain contract is UNCHANGED: cloud-confirmed captures land in
`offline_queued`, which the existing claim loop already drains on wake. Design
of record + the safe cutover procedure (bot-B testing, setWebhook/deleteWebhook
rules, DO-NOT list while polling is live):
`Builds/BUILD-002-unified-personal-capture-gateway/Architecture/wp1-*.md`.

## Dependencies

The unit suite is **zero-dependency** (Node 22 stdlib only) — `pg` is imported
**dynamically**, reached only on the live Postgres path, so `node --test` with no
`DATABASE_URL` never loads it. `pg` is the sole runtime dependency, used by the
live adapter store.
