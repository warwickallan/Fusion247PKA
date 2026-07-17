---
build: BUILD-010
component: Fusion Tower / Governance Mode
wp: WP0
artifact: codex-delta-review-medium-fixes
status: generated
author: mack
reviewer: gpt_codex (openai-codex) — INDEPENDENT, not Larry
created: 2026-07-17
reviewed_delta: 9fda8fd..3c48211
verdict: approve
---

# Fusion Tower — Codex DELTA review #3: the two GPT MEDIUM fixes (masked)

Parent build: [[BUILD-010-fusion-tower]]

This is the required, Tower-owned **independent Codex delta review** of
`9fda8fd..3c48211` — the post-review code that closes the two MEDIUM findings the
GPT final review raised against head `9fda8fd`:

- **MEDIUM-1** — ClickUp write idempotency was process-local (an in-memory `Map`).
- **MEDIUM-2** — the no-relay ack proof used `MemoryStore` + a scratchpad while
  claiming "durable Tower state".

It was produced by a **fresh, genuinely-separate reviewer** (signer `gpt_codex`,
provider `openai-codex`) driven **through the Fusion Tower dispatcher + codexAdapter**
— the real `codex.exe` binary, ChatGPT-OAuth, `--sandbox read-only`
`--ignore-user-config`, strict `--output-schema`, and the HMAC-signed honest
envelope. The reviewer inspected the ACTUAL delta (`git diff 9fda8fd..3c48211`, file
reads, `git diff --name-only` immutability checks); it was NOT handed a summary to
rubber-stamp. The bounded ClickUp write is **not** authorised for this round, so the
full review is staged here rather than posted — see [[fusion-tower-operating-instructions]] §4.

## Run provenance (masked)

| Field | Value |
|---|---|
| Reviewer principal | `gpt_codex` |
| Provider (honest label) | `openai-codex` (never xAI/Grok, never Anthropic) |
| Model id | `openai-codex-exec` |
| Auth method | ChatGPT-OAuth (`auth.json`) — no API key on argv, no secret logged |
| Sandbox | `read-only` (host `elevated` overridden via `--ignore-user-config`) |
| Tower run id | `740ba3b8-5067-47da-b6df-54b494ea2156` |
| Turn ordinal | 1 (round 1 of max 2) |
| Reviewed head SHA | `3c48211582f791f23fa3471a52075515227fb31a` |
| Reviewed delta | `9fda8fd..3c48211` |
| Output tokens | 5351 |
| Envelope schema | `ftw.turn-envelope/v1` |
| Signature | HMAC-SHA256, 64 hex — **verified** with the per-run ephemeral secret |
| Wiring dry-run | synthetic fake-codex turn first (zero quota), then ONE real bounded turn |

The signing secret is an **ephemeral per-run** key generated in-process purely so the
Tower can sign and verify the honest envelope; it is never printed or written. All
DATABASE_URL / token surfaces are masked by `config.describe()`.

## Structured verdict (schema-conforming, signed)

```json
{
  "verdict": "approve",
  "medium1_closed": true,
  "medium2_closed": true,
  "new_findings_count": 1,
  "reviewed_delta": "9fda8fd..3c48211",
  "findings_by_severity": { "low": 1 },
  "proposed_action": { "type": "post_comment", "target": "BUILD-010 WP0 delta 9fda8fd..3c48211" }
}
```

`proposed_action` was guardrail-checked by the dispatcher (`assertNoAutonomousMerge` +
`assertWithinScope`) before recording. A merge/destructive action is impossible by
construction; the reviewer can only propose `post_review | post_comment | noop`.

## Reviewer summary (verbatim)

> Delta 9fda8fd..3c48211 closes MEDIUM-1 and MEDIUM-2 at implementation level. I found
> one non-blocking test-evidence gap: the concurrent duplicate-post behaviour is not
> explicitly exercised against two real Postgres store/poster instances, though the SQL
> implementation uses a durable UNIQUE mutation_key claim path.

## Per-claim verdicts (grounded in file:line evidence)

### MEDIUM-1 — durable ClickUp write idempotency — **CLOSED**

- **[confirmed]** Durable outbox exists with per-mutation uniqueness, response-id guard,
  service_role-only RLS. `migrations/0003_wp0_external_write_outbox.sql:98` creates
  `ftw.external_write`; `:104-105` make `mutation_key` UNIQUE; `:127-128` make
  `mutation_id` UNIQUE; `:138-139` enforce `applied_verified` requires `response_id`;
  `:182` + `:218-236` enable RLS and grant/policy **only** `service_role`.
- **[confirmed]** `clickupPoster` is rewired **off** the process-local task `Map` and
  onto durable store APIs. `src/adapters/clickupPoster.js:177-182` requires
  `store.claimWrite`/`markWriteApplied`; `:267-270` claim the durable write before
  posting; `:272-299` handle existing durable rows without duplicate reposts; **no
  process-local Map guard remains** in the file.
- **[confirmed]** Idempotency key identifies the **mutation, not the task**.
  `clickupPoster.js:145-151` derives `mutationKey` from `runId | turnId |
  targetKind:targetId | payloadChecksum`; migration comment `0003:149-153` documents the
  same per-mutation constraint.
- **[confirmed]** `applied_verified` impossible without a real comment id at **both**
  store and DB layers. `src/store/postgresStore.js:588-595` rejects an empty
  `responseId` before update; `0003:138-139` adds the DB CHECK
  `external_write_applied_requires_response_chk`.
- **[confirmed]** Ambiguous timeout reconciles by searching target comments for the
  embedded `mutation_id` **before** retrying. `clickupPoster.js:185-199` searches
  `getTaskComments` for `mutationMarker`; `:209-218` mark applied with the found id
  before any retry; `:322-324` route post errors through `reconcile`.
- **[confirmed]** A distinct later review to the **same** ClickUp task is allowed.
  `test/clickupPoster.test.js:156-175` proves two distinct bodies to the same task
  produce distinct mutation keys and two writes; `test/postgresStore.integration.test.js:401-411`
  proves distinct mutation keys to `target_id 869e5zu97` both claim in Postgres.
- **[partial]** The six MEDIUM-1 behaviours are test-proven. Same-mutation /
  new-process / timeout-reconcile have **PG poster** tests
  (`test/clickupPoster.test.js:338-408`); distinct-review and missing-id/DB-CHECK have
  **PG store** tests (`test/postgresStore.integration.test.js:401-411` and `:372-395`).
  **However** the concurrent duplicate-post test (`test/clickupPoster.test.js:218-220`)
  uses `createMemoryStore`, and no `Promise.all`/concurrent/race coverage exists in
  `postgresStore.integration.test.js`. → see finding **F-LOW-PG-CONCURRENT-TEST-GAP**.

### MEDIUM-2 — no-relay ack proof durability — **CLOSED**

- **[confirmed]** The proof now uses **real Postgres** with a genuine restart, recovery,
  a real headless Larry ack, a persisted signed result, a second reconnect, no relay,
  and zero ClickUp writes. `scripts/proof-norelay-ack.js:105` creates `PostgresStore`;
  `:134-142` close `store1` and create `store2` **before** the dispatch; `:148-155`
  recover the run/event; `:174-180` run the dispatcher and verify the signature;
  `:193-215` close `store2` and read via `store3`; `:218-223` record zero ClickUp
  writes / no relay. The generated evidence records all assertions true at
  `Builds/BUILD-010-fusion-tower/Architecture/larry-norelay-ack-2026-07-17.md`.
- **[confirmed]** The "durable Tower state" claim is now **accurate** — the transcript
  shows recovery from Postgres after the pool close, the returned signed ack persisted
  to Postgres, and a second reconnect with successful signature verification.

### No weakening — **confirmed across the board**

- **[confirmed]** Migrations `0001` and `0002` are **byte-immutable** in this delta —
  `git diff --name-only 9fda8fd..3c48211` returns no path for either. (Independently
  re-confirmed by Mack: `git diff --quiet` on each is clean.)
- **[confirmed]** The honest-label pin and no-autonomous-merge guardrails are
  **untouched** — `git diff --name-only 9fda8fd..3c48211` returns no path for
  `src/core/envelope.js`, `src/core/guardrails.js`, `src/dispatcher.js`, or
  `src/adapters/eventIntake.js`.
- **[confirmed]** ClickUp target validation + self-marker are intact.
  `clickupPoster.js:39` pins `ALLOWED_CLICKUP_TASK_ID` to `869e5zu97`; `:81-89` reject
  any other target; `:92-99` require `TOWER_SELF_MARKER` before posting.
- **[confirmed]** RLS deny-by-default extends to the **new** `external_write` table —
  `0003:182` enables RLS; `:218-236` grant + policy `service_role` only; `:241`
  documents "No anon/authenticated policies on purpose". No anon/authenticated grant or
  policy is added anywhere in the delta.

## Findings

### F-LOW-PG-CONCURRENT-TEST-GAP — severity **low** (non-blocking)

- **Evidence.** `test/clickupPoster.test.js:218-220` defines the concurrent
  duplicate-post test using `createMemoryStore`; a search over
  `test/postgresStore.integration.test.js` finds no `Promise.all`/concurrent/race
  coverage for `claimWrite` or poster calls against Postgres.
- **Rationale.** The durable implementation relies on Postgres `UNIQUE`/`ON CONFLICT`
  semantics and appears sound, but the acceptance checklist asks whether the six
  behaviours are genuinely test-proven. Five are exercised against Postgres directly or
  via Postgres store tests; the **concurrent** duplicate-post behaviour is only
  unit-proven against the memory fixture, not with two real Postgres-backed
  claimers/posters.
- **Required correction.** Add a DB-gated integration test that creates two
  Postgres-backed poster/store attempts for the **same** mutation concurrently, asserts
  exactly one remote `createTaskComment` call, and asserts both callers observe the same
  durable outbox row / comment result (or a non-posting in-flight result).
- **Mack's independent corroboration.** Confirmed accurate: the `(f) concurrent` test at
  `test/clickupPoster.test.js:219` does use `createMemoryStore`, and no PG-backed
  concurrent/race test exists. This is a **test-coverage completeness** observation, not
  a defect in the implementation — the durable claim path (`mutation_key` UNIQUE + the
  `applied_requires_response` CHECK) is present and PG-proven for five of six
  behaviours; the sixth is memory-proven. It does **not** re-open MEDIUM-1.

## Disposition

- **Verdict: `approve`.** Both GPT MEDIUMs are genuinely closed in the delta; no
  weakening of RLS, honest-label, no-merge, immutability, target-validation, or
  self-marker; one **LOW**, non-blocking test-coverage finding that does not reopen
  either MEDIUM.
- The one LOW finding is logged for a follow-up (a DB-gated concurrent poster test); it
  is not a merge blocker for the WP0 delta.

## Independent-review posture ([[SOP-018-independent-change-qa]])

This review satisfies the "same-model review is not independent review" rule for the
claims it verifies: the reviewer is a **different model + runtime + session** (OpenAI
Codex via the Tower's read-only sandbox) relative to Larry (Anthropic Claude Code). It
was staged with pointers only — the reviewer pulled the real diff, migration, adapters,
proof script, and tests itself.

## Boundaries honoured this round

- Read-only Codex turn; no write, no merge, no push, no destructive action.
- **No ClickUp write** — the bounded write is not authorised for this round; this review
  is staged, not posted.
- **No live Supabase apply** — the migration was read, not applied; DB-gated tests were
  not run live from this review turn.
- No secret printed or committed; the ephemeral HMAC key exists only in-process.

## References

- [[fusion-tower-operating-instructions]] — the reviewer role of record.
- [[codex-rereview-2026-07-17]] — the prior (head `9fda8fd`) Codex re-review (approve).
- [[larry-norelay-ack-2026-07-17]] — the MEDIUM-2 no-relay proof transcript.
- `services/fusion-tower/migrations/0003_wp0_external_write_outbox.sql` — MEDIUM-1 durable outbox.
- `services/fusion-tower/src/adapters/clickupPoster.js` — MEDIUM-1 poster rewired onto the outbox.
- `services/fusion-tower/scripts/proof-norelay-ack.js` — MEDIUM-2 no-relay proof on real Postgres.
