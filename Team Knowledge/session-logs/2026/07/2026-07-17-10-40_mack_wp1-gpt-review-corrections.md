---
agent_id: mack
session_id: wp1-gpt-review-0001-corrections
timestamp: 2026-07-17T10:40:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-002 WP1 — three GPT-review corrections (Mack)

Branch `build-002/wp1-cloud-intake-foundation`. Applied the three material
engineering corrections from GPT-BUILD-002-WP1-REVIEW-0001. L-2/L-3/L-1/FU-5
untouched. No live bot / no deploy / no secrets / no worker restart.

## What I changed

1. **Credential headers (correction 1).** New pure `credential.js`
   (resolver + header builder) in the edge dir. Legacy service_role JWT →
   `apikey` + `Authorization: Bearer`; modern `SUPABASE_SECRET_KEYS` → named
   `default` key on `apikey` ONLY (opaque keys are not JWTs). Missing / malformed
   JSON / non-object / no string `default` all fail closed with no key content.
   `index.ts` now wires env → descriptor → `buildRpcHeaders`. Portable tests in
   `credential.test.js` (node --test, no Deno).

2. **Deno artifact CI (correction 2).** `deno-check` job on the existing
   `supabase/**` workflow, pinned `denoland/setup-deno@v2` + Deno `v2.9.3`,
   `deno check index.ts`. Added `deno.json`. Installed Deno via scoop and RAN
   the check locally: **Deno 2.9.3, `deno check index.ts` PASS (exit 0)** — the
   whole edge import graph resolves and type-checks.

3. **Private-direct-chat boundary (correction 3).** ONE shared predicate
   `chatBoundary.js` (`isPrivateDirectChat`) in the edge dir, imported by BOTH
   `handler.js` and the poll mapping `telegramMapping.js` (the same physical
   file — cannot drift). Requires `chat.type === 'private'` AND
   `chat.id === sender id`; group/supergroup/channel/missing/malformed → quiet
   default-deny, zero rows, both message + callback paths. Sender allowlist stays
   a separate authority (DB RPC for webhook, inline for poll), so E2E-6's
   layer-2 default-deny proof is preserved. Cutover doc §8 added (BotFather
   `/setjoingroups` disable + code-enforcement-is-mandatory).

## Key design call

The shared predicate keys on `chat.id === senderId` (a genuine 1:1 DM), NOT on a
copy of the allowlisted id in the edge. This kept the allowlist authority in the
DB (single source), needed no new edge secret/env, and preserved the stranger-
in-private → RPC-refused proof. The composite (predicate + allowlist) still
guarantees "only the authorised user's own private chat."

## Blast radius handled

Adding the poll-path gate to `mapTelegramUpdate`/`mapTelegramCallbackQuery`
broke ~20 test fixtures that omitted `chat` (real Telegram always sends it).
Fixed the fixtures to carry realistic `chat: { id, type: 'private' }` — fidelity
strengthened, assertions unchanged. No test weakened/skipped/deleted.

## Verification (real numbers)

- No-DB `node --test`: **289 tests, 257 pass, 0 fail, 32 skip** (DB-gated).
- Fresh throwaway scoop Postgres 17.4 on port 54331, migrations 0001→0006 on
  fresh DBs, full DB-gated run: **289 tests, 289 pass, 0 fail, 0 skip.** Cluster
  torn down.
- E2E-1..6: all pass. Migration static guards: 15/15 pass.
- Node/Deno parity: 20 tests pass (9 pinned vectors ×2 + 64-input agreement).
- `deno check`: 2.9.3, PASS.
- `secret-scan.sh`: clean, 364 files.

## Commits (branch, not pushed — Larry pushes)

- `b05a2e8` credential header handling
- `085a8c8` private-direct-chat boundary
- `160f135` Deno artifact CI

## For the next agent

- The poll-path chat gate takes effect on the NEXT worker restart (Larry's) —
  it does not touch the running worker (PID 28480) in place.
- `chatBoundary.js` and `credential.js` are pure/portable — reuse over reimplement.
