---
agent_id: mack
session_id: LRY-BUILD-002-WP1-PR-READY-0001
timestamp: 2026-07-17T08:20:50Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# WP1 — close the two remaining Vex LOW findings (L-2, L-3)

Branch `build-002/wp1-cloud-intake-foundation`, based on merged main. Authority
LRY-BUILD-002-WP1-PR-READY-0001. Scope: real fixes + tests for L-2 and L-3,
full verification battery, commit (NO push — Larry pushes). Hard boundaries held:
0006 not applied live, edge not deployed, no webhook secret created/rotated, no
setWebhook, live bot + running worker untouched, C:\.fusion247 untouched, no WP2.

## L-3 — authenticate before body read (CLOSED)

The Deno shell (`supabase/functions/fcg-webhook-intake/index.ts`) did
`bodyText: await req.text()` before invoking the pure handler, so an
unauthenticated POST forced the function to buffer an arbitrary body before the
constant-time secret-token gate ran.

Fix (kept the thin-shell / pure-handler contract; single auth authority):
- `handler.js` request contract gains a LAZY `readBody: () => Promise<string>`.
  **Exact ordering now: (1) method gate → 405; (2) constant-time
  `timingSafeEqualStrings` secret-token check → 401 with NO body read, NO rpc,
  NO telegram, NO durable write; (3) ONLY after auth passes, `await readBody()`;
  then parse → route.** On 401 the handler returns without ever invoking
  readBody. `bodyText` retained as a compat fallback for the unit suite; the
  deployed shell uses the lazy reader. Body-read failure on an authed request →
  500 (Telegram redelivers). Constant-time compare stays in ONE place.
- `index.ts` now passes `readBody: () => req.text()`.
- New unit test **U2b** drives a `readBody` SPY across missing/empty/wrong-secret
  + non-POST and asserts the spy is NEVER called, plus zero rpc + zero telegram +
  401; a positive control proves an authed request invokes the lazy reader
  exactly once and drives normal intake.

Commit `a203027`.

## L-2 — fatal-path secret-redactor regression coverage (CLOSED)

`config.buildSecretRedactor` serves both the live runner's per-cycle diagnostics
(safeErr) and the entrypoint fatal catch in `liveRunner.main()`, but was only
probe-verified (FU-4) — no committed test. New `test/secret-redaction.test.js`
(synthetic canaries only; never reads C:\.fusion247):
- Direct coverage: complete DATABASE_URL, bare password component, Telegram bot
  token, and complete secret-bearing URLs (Supabase key + webhook secret) each
  render `***redacted***` with the raw substring absent; a combined message drops
  all at once; URL-encoded DSN passwords scrubbed in both spellings; non-URL
  (libpq key=value) DSN gets whole-string redaction; empty config → safe no-op.
- **Wiring assertion**: spawns the REAL entrypoint (`liveRunner.js` as main
  module) with canary env forcing a deterministic, hermetic construction-time
  fatal (non-PEM CA file → `buildPgSslConfig` throws before any socket opens).
  The thrown message carries the canary DB password; the test asserts the fatal
  line is emitted, the marker is present, and the raw password/bot token/whole
  DSN are absent — proving the fatal catch routes through the redactor. No
  network, no real credential.

Commit `fa37512`.

## Invariant re-confirmation (items 4 & 5)

- **Item 4** — all still test-enforced and GREEN in the 265/265 real-Postgres
  run: DB-side allowlist (strangers zero rows, E2E-6), transport dedup
  independent of capture idempotency, cloud tap-confirm fail-closed
  (accepted→offline_queued only, tap-gate-invariant + migrations guards),
  duplicate callbacks + webhook redelivery harmless (E2E-2/3/5), card-send
  failure never false-completes (E2E-4/U11), worker drains offline_queued with
  no claim-loop change (worker + offline suites), Node/Deno derivations
  byte-identical (20/20 golden-vector parity).
- **Item 5 (cutover safety)** — grep across all executable source: NO
  `setWebhook`/`deleteWebhook` anywhere runnable (hits are only docs, code
  comments, README narrative, and session logs). The Telegram client in
  `index.ts` exposes exactly `sendMessage`/`editMessageText`/
  `answerCallbackQuery`.

## Cutover-safety finding

Cutover is **DOCS-ONLY**. `scripts/` contains only `tls-extract-ca.mjs` and
`tls-verify-probe.mjs` — no cutover/setWebhook tool exists. The only cutover
surface is `wp1-safe-cutover.md` plus its DO-NOT list. No runnable setWebhook
path exists, so there was nothing to harden and no tool to invent. No third
commit needed.

## Full verification battery (real numbers)

- **a. No-DB full suite** (`node --test`): 265 tests, **233 pass, 0 fail, 32
  skip** — up from the prior 223/32 by exactly the +10 new tests (U2b + 9
  redaction tests).
- **b. Real-Postgres full suite** (fresh throwaway scoop PG 17.4, port 54330,
  new data dir, migrations 0001→0006 applied by the tests): **265 tests, 265
  pass, 0 fail, 0 skip** (all 32 DB-gated tests green).
- **c. Synthetic E2E**: E2E-1 PASS, E2E-2 PASS, E2E-3 PASS, E2E-4 PASS, E2E-5
  PASS, E2E-6 PASS (6/6).
- **d. Golden-vector Node/Deno parity**: 20/20 pass — 9 pinned vectors ×
  {Node, Deno-port} byte-identical + fixture-coverage sanity + 64 random-input
  agreement. Full agreement.
- **e. Migration static guards** (`migrations.test.js`, incl. the 0006 guards):
  15 tests, 15 pass, 0 fail.
- **f. `secret-scan.sh`**: clean — **359 tracked files, 0 secret values**
  (359 = 358 baseline + the new test file, staged so the scan covers it).

Throwaway cluster stopped (`pg_ctl stop`); data dir kept at scratchpad
`pgdata-wp1-54330`. Live Supabase project never touched.

## Commits

- `a203027` — L-3 (handler + shell + U2b).
- `fa37512` — L-2 (secret-redaction regression test).

Not pushed (Larry pushes).

## For the next agent

- L-1 (TOFU CA dashboard cross-check) is the one Vex condition still open and is
  Warwick's named morning action — NOT touched here.
- The four Vex-gated live actions (0006 apply, edge deploy, PR open, worker FU-1
  restart) remain morning-gated per the delta review; L-2 and L-3 are now closed
  with committed tests, so the "PR open" condition (suite green, scan clean,
  guards in CI) is satisfied on the code side.
