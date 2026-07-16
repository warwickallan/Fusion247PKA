# fusion-capture-gateway

WP0 **fixtures-only** baseline for **BUILD-002 — Unified Personal Capture Gateway**.
The smallest reusable slice of the capture platform: a channel-neutral intake, a
durable operational store, and a local worker that performs a governed Markdown
write and proves it with an evidence pointer.

> **Hard boundary.** This is fixtures only. NO real secrets, NO real Supabase, NO
> real Telegram bot token, NO real personal data. Real values and the live
> phone-visible acceptance proof are introduced **only after the Vex WP0 security
> gate passes** (`Builds/BUILD-002-.../Security/wp0-security-gate.md` §6).

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

## Migrations (artifacts — not executed by the test suite)

`migrations/0001_wp0_operational_baseline.sql` + `0002_wp0_deletion_and_retention.sql`
are the Postgres/Supabase DDL artifacts. They are never applied against a real
database in WP0. The four foreign keys `0002` drops-and-recreates with `ON DELETE`
actions carry **explicit** `constraint <name>` declarations in `0001` — not an
assumption about Postgres's implicit default naming — and `test/migrations.test.js`
statically verifies the two files stay consistent (every name `0002` drops is
declared in `0001` and re-added under the identical name), plus that RLS stays
enabled deny-by-default and `0002` never weakens it.

## Dependencies

**Zero runtime dependencies.** Node 22 stdlib only (`node:fs`, `node:os`,
`node:path`, `node:crypto`, `node:test`, `node:assert`).
