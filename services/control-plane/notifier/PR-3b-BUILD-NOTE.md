# BUILD-014 PR-3b — Notification SENDER (notifier worker) — BUILD NOTE

**Author:** Mack (Automation Specialist) · **Status:** built + executed-tested, DEV/synthetic only, NO real Telegram send path, NOT applied to any hosted DB, NO PR opened.
**Branch:** `build-014/wp-3b-notifier-sender` (off `build-014/wp-3a-notification-outbox` @ `90e7730`, which carries migrations 001+002+005).
**Scope:** the notification **SENDER** deferred by PR-3a — a worker loop over the outbox that claims due rows, delivers via an **injectable transport**, drives the delivery state machine, plus the **`sending` reclaim watchdog** PR-3a deferred. No new migration; the sender runs entirely on PR-3a's least-privilege `notifier` surface.

## What / why

PR-3a built the durable `ops.notification_outbox` projection + delivery state machine + the least-priv `notifier` role and its `claim_notification` / `mark_notification_sent` / `mark_notification_failed` helpers, and explicitly deferred the sender ("no sending watchdog yet"). This PR is that sender. It is a **worker loop over the outbox, not a new queue** — it mirrors the WP-B worker (`worker/worker.mjs`): claim one due row, act, drive state, repeat.

Design guarantees carried:

1. **Only ACTION_NEEDED + MILESTONE are dispatched; SILENT is never sent.** `claim_notification` only leases `queued` rows; a SILENT event is born terminal `suppressed` (PR-3a biconditional CHECK), so it is unclaimable — SILENT is unsendable by construction. The sender **also** asserts this defensively (a claimed-SILENT row, which cannot be represented, would fail closed loudly, never dispatch).
2. **Restart-safe / no dup spam.** An already-`sent` row is terminal and never re-claimed, so a delivered notification is never re-sent. Proven by a restart re-run that dispatches nothing.
3. **Crash mid-send is reclaimed and re-driven once.** A process that claims (`sending`) then dies before `mark_*` strands the row. The `SendingWatchdog` re-drives any `sending` row older than a lease deadline (`updated_at <= now() - staleSeconds`) via the SAME guarded `mark_notification_failed` (sending→failed→queued/dead_letter). Bounded (batch limit + generous prod lease) and idempotent (two watchdogs, or a watchdog racing a real completion, collide harmlessly — the guarded helper only acts on a still-`sending` row).
4. **Bounded retry + backoff.** Transport failure/throw → `mark_notification_failed` with exponential backoff (`base·2^(attempt-1)`, capped) into `next_attempt_at`, which gates the next claim; `dead_letter` at the budget. `attempts` is counted at claim, so the crashed/failed attempt is charged and the budget cannot loop.

## The injectable-transport seam (and where real Telegram gates in later)

The sender does not know how a notification is physically delivered — the **transport is injected** exactly the way `reviewHandler.mjs` injects its `reviewers` array. Contract:

```
transport.send({ id, notificationClass, destination, headline, message, cockpitUrl, githubUrl })
  -> { ok: true }              -> row -> sent (terminal)
  -> { ok: false, errorCode }  -> row -> failed -> retry(backoff) | dead_letter
  -> THROW                     -> treated as { ok: false } (sanitised)
```

- **DEV/tests:** `createFakeTransport()` — records every call, returns canned success/failure. NO network, NO credentials, NO Telegram.
- **LIVE (NOT wired here):** `createTelegramTransport()` is a documented STUB that **refuses to construct in DEV**. Turning it on is a **separate, gated live step**: it would resolve the LOGICAL `destination` (e.g. `warwick_primary`) to a real bot token + chat-id from a **notifier-only secret store** (env / OS keychain) held **outside any reviewer process**, POST to the Telegram API with the headline/message + the `cockpit_url`/`github_url` deep links, and map 2xx→`{ok:true}` / 4xx-5xx-network→`{ok:false, errorCode}`. That wiring, a real token, a live chat-id and Warwick's go-ahead are **not part of PR-3b** — `transport.mjs` marks exactly where they gate in.

**No secrets introduced.** No token/chat-id anywhere in this layer or the tests; `destination` stays a logical label; the payload carries only pointers + sanitised text + deep links.

## Files

- `notifier/transport.mjs` — the injectable transport seam: `createFakeTransport` (DEV/tests) + `createTelegramTransport` (fail-closed live stub).
- `notifier/notifier.mjs` — `Notifier` (claim → transport → mark, backoff, `drain`/`runLoop`) + `SendingWatchdog` (the deferred `sending` reclaim ticker). Both optionally run under `SET ROLE notifier` (`sessionRole`) to prove the least-priv surface.
- `notifier/index.mjs` — runtime ASSEMBLY (pool + injected transport + notifier + watchdog). **No auto-launch**; direct-run prints how it wires and refuses to open a live send path.
- `notifier/test/notifier.test.js` — 6 executed proofs (apply 001+002+005, fake transport, throwaway Postgres).
- `notifier/test/run-notifier-tests.mjs` — one-command runner; provisions a disposable Postgres cluster, **fails on 0 executed subtests**.
- `package.json` — `test:notifier` script + appended to the aggregate `test`.

## Executed test output (proven = EXECUTED, not skipped)

Throwaway Postgres cluster (scoop PostgreSQL, Node 22), migrations 001+002+005 applied per subtest:

```
# notifier proofs — node notifier/test/run-notifier-tests.mjs
ok 1 - claim -> send(fake) -> sent; ACTION_NEEDED + MILESTONE each dispatched exactly once; deep links present
ok 2 - RESTART re-run sends NO duplicate: an already-sent row is never re-dispatched
ok 3 - transport failure -> failed -> retry WITH BACKOFF (gates claim) -> dead_letter at budget
ok 4 - CRASH mid-sending is reclaimed by the watchdog and re-driven exactly once
ok 5 - SILENT is NEVER dispatched (suppressed is unclaimable; transport sees nothing)
ok 6 - LEAST-PRIVILEGE: the sender + watchdog surface runs under SET ROLE notifier
# tests 6  # pass 6  # fail 0  # skipped 0

# 001 regression — node db/test/run-db-tests.mjs
# tests 25  # pass 25  # fail 0  # skipped 0

# outbox 005 regression — node db/test/run-outbox-tests.mjs
# tests 9  # pass 9  # fail 0  # skipped 0
```

Each mandated proof maps to a subtest: claim→send(fake)→sent + deep links + exactly-once per row (1); restart no-dup (2); failure→backoff-gated retry→dead_letter at budget (3); crash-mid-sending reclaimed + re-driven once (4); SILENT never dispatched (5); least-priv notifier role drives the full sender+watchdog surface (6). 001 + outbox(005) re-run prove no regression (this PR adds no migration).

## Self-review vs discipline

- **Injectable transport** (no baked-in delivery, DEV=fake, live=gated stub) mirrors `reviewHandler.mjs`'s injected `reviewers`. ✓
- **Worker-loop shape** (claim → act → drive state → poll; watchdog as a separate ticker) mirrors `worker/worker.mjs` + `Reclaimer`. ✓
- **No new DB objects / no migration** — runs only on PR-3a's granted helpers + delivery columns. Mack does not author the DB layer (that is Silas's PR-3a/PR-4). ✓
- **No secrets:** no token/chat-id in code, tests, or logs; transport errors are sanitised (`sanitizeError`) so no raw bytes reach logs; structured logs carry only pointers (id, destination, class, attempt). ✓
- **Fail-closed:** transport throw ≡ failure; a lost mark_sent race does NOT re-send; a defensive SILENT-claimed path fails loud. ✓
- **Executed proofs, fail-on-0-subtests**, throwaway Postgres, DEV-only. ✓

## Decisions

- **Watchdog uses `updated_at` as the lease clock (no new `lease_owner`/deadline column).** PR-3a deliberately added no durable lease column; the toucher sets `updated_at=now()` at claim, so `state='sending' AND updated_at <= now() - staleSeconds` is a sound, catalog-free staleness test computed server-side (no app/DB clock skew). This keeps the sender inside PR-3a's exact surface and adds no schema.
- **App-code reclaim via the existing guarded helper, not a new SQL function.** The watchdog SELECTs stale `sending` ids (notifier SELECT grant) and re-drives each via `mark_notification_failed` (notifier EXECUTE grant). Concurrency is safe because the helper only acts on a still-`sending` row; the loser of a race RAISES and is swallowed as a benign no-op. No migration, no new grant.
- **Short-lived connections, role-per-unit-of-work.** `claim` and `mark` each take their own short-lived pooled client (optionally `SET ROLE notifier`), so no DB connection is held across the transport's network send. In production the sender process connects AS the notifier login role (PR-4); the class is role-agnostic and `sessionRole` proves the surface is sufficient today.
- **Backoff is deterministic exponential** (`base·2^(attempt-1)`, capped) — proven as a pure function and via a future `next_attempt_at` that gates the next claim. No jitter (deterministic tests); jitter can be layered later if thundering-herd ever matters (it will not at hobby-brain volume).

## Residuals for reviewers (Codex product-QA / Fable adversarial)

- **At-least-once at the WIRE, not exactly-once.** The outbox guarantees a row reaches `sent` at most once (mark_sent only fires on a still-`sending` row). But if a real transport *delivers* and the process crashes *before* `mark_sent`, the watchdog re-drives → a duplicate Telegram message. Telegram has no server-side dedup, so true exactly-once needs an idempotent transport (e.g. a client-side idempotency key / a "last delivered event id" checkpoint). Mitigation today: a **generous production lease** so only genuinely-crashed sends are reclaimed. Documented, accepted for DEV; flag for the live-wiring PR.
- **`mark_sent` lost-race outcome (`sent_unrecorded`).** If a slow send's row was reclaimed and re-queued, `mark_notification_sent` RAISES; we log and do NOT re-send. The row is then re-driven by the fresh queue entry (another at-least-once instance of the point above). Reviewers: confirm this is the right call vs. attempting a compensating action.
- **Watchdog lease vs. a legitimately slow send.** `staleSeconds` must exceed the real transport's worst-case send time or a live in-flight send could be reclaimed (→ duplicate). Default 300s is generous for a Telegram POST; the live-wiring PR should set it from the transport's real timeout budget.
- **Least-priv is proven via `SET ROLE`, not a dedicated login role.** Test 6 runs the full sender+watchdog surface under `SET ROLE notifier` (grants + guard). The dedicated notifier LOGIN role + denied-access matrix on hosted DEV is PR-4's job (as PR-3a stated).

## Boundaries honored

DEV/synthetic only · NO real Telegram credentials or send path anywhere · NO BUILD-002 capture-intake interference (never read/modified `C:/.fusion247/*`, its webhook, poll offset, or the live FusionDevBot binding) · no new migration · not applied to any hosted/live DB · no PR opened, no merge, no live apply.
