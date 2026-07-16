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
  - `src/worker.js` — the pull/claim/write/evidence/complete cycle.

## Run the tests

```sh
node --test
```

Fully hermetic: no network, no real credentials. Sandbox dirs use
`os.tmpdir()` + `fs.mkdtempSync` and are cleaned up per test.

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
4. **Evidence-gated completion.** `completed` is reachable **only** via
   `written → evidenced → completed`, and only once a destination pointer **and**
   an evidence pointer both exist. No false completion is possible.
5. **Cards are retryable projections.** A card is a pure function of the store
   record. A **failed card edit never reverses or duplicates** the completed
   write — the worker swallows the projection error and leaves the state
   completed; the card can be re-projected later.

## Boundaries

- **Store separation.** The operational store carries captures *in flight* only.
  Markdown is canonical. Nothing here promotes operational data to canonical
  except the governed worker write.
- **Single-user, default-deny.** One authorised numeric Telegram id; any other
  sender is silently ignored and logged, never actioned.
- **Secrets.** Never committed. Only `.env.example` (names only) is tracked;
  `.env` is gitignored. Secrets are masked in every echo.

## Dependencies

**Zero runtime dependencies.** Node 22 stdlib only (`node:fs`, `node:os`,
`node:path`, `node:crypto`, `node:test`, `node:assert`).
