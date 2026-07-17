---
agent_id: mack
session_id: build-002-wp1-delta-review-0002
timestamp: 2026-07-17T11:19:54Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-002 WP1 — poll-path chat-boundary ordering fix (GPT delta review 0002)

## Scope
Branch `build-002/wp1-cloud-intake-foundation`. Fixed the ONE material ordering
defect GPT-BUILD-002-WP1-DELTA-REVIEW-0002 flagged; everything else in that review
was accepted and left untouched. No live 0006 apply, no edge deploy, no secret
create/rotate, no setWebhook, no live bot change, and the running worker (PID
24392) was NOT restarted or touched — the fix takes effect on a future restart.

## The defect
In `src/adapters/telegramMapping.js :: mapTelegramUpdate`, the poll path checked
unsupported-content BEFORE the private-direct-chat boundary. The live runner
(`src/live/liveRunner.js`) sends a visible "Text only in WP0" notice on
`unsupported_content_type`. So an authorised sender posting a photo/voice/
document/empty-text INTO A GROUP/supergroup/channel was content-rejected first,
and the runner REPLIED INSIDE the non-private chat — breaking the quiet
private-chat boundary.

## The fix
Reordered `mapTelegramUpdate` decision order to:
1. valid message + sender extraction (malformed → default-deny `no_message`);
2. authorised-sender allowlist (stranger → `unauthorised_sender`, quiet, before
   any chat/content inspection);
3. private-direct-chat boundary via shared `isPrivateDirectChat` (non-private →
   `non_private_chat`, quiet, zero rows, no notice);
4. content-type support (unsupported → `unsupported_content_type`);
5. envelope derivation.

Because a non-private context now returns `non_private_chat` BEFORE content is
examined, the runner's notice branch — which fires ONLY on
`unsupported_content_type` (liveRunner.js line 124) — is now reachable only inside
the authorised user's own private chat. The runner does NOT inspect content before
the mapper verdict, so no runner change was needed.

## Webhook handler — deliberately NOT changed
The webhook (`supabase/functions/fcg-webhook-intake/handler.js`) already stays
SILENT on unsupported content (no notice, ever). Both `non_private_chat` and
`unsupported_content_type` produce identical observable behaviour there (200,
ignored, no RPC, no telegram send, zero rows), so there is no behavioural defect
to fix. Reordering it would only flip an accepted test assertion (U4, webhookHandler
line 258) — i.e. revisit accepted work — for a cosmetic reason-string change. Left
as-is per the "fix only this defect" boundary.

## Tests
- Reordered fixtures that assumed the old order (added a genuine private chat so
  they still test the content-type verdict, assertions unchanged):
  `telegramMapping.test.js` media block; `liveRunner.test.js` private-photo test;
  `tap-gated-capture.test.js` non-text-seam test.
- New mapper-level regression tests (telegramMapping.test.js): decision-order
  proof; non-private group photo / supergroup voice / channel document →
  `non_private_chat`; non-private whitespace-only text → `non_private_chat`;
  non-private authorised text → `non_private_chat`; stranger private unsupported →
  `unauthorised_sender`.
- New live-runner-level regression tests (liveRunner.test.js) that exercise the
  ACTUAL notice projection via the mock adapter's send-observability:
  group photo / supergroup voice / channel document / group whitespace → each
  asserts `sentMessages.length === 0` AND `sentCards.length === 0` (no "Text only"
  notice, no card) + zero rows + zero writes + the `non_private_chat` runner
  diagnostic; stranger private unsupported → `unauthorised_sender`, zero response.
  Private-photo test retained: exactly ONE "Text only" notice, zero rows.

## Full battery (real numbers, 2026-07-17)
- a. no-DB `node --test`: 267 pass / 0 fail / 32 skipped (Postgres-gated), 6.1s.
- b. fresh throwaway Postgres 17.4 cluster (new data dir, port 54332, roles
  anon/authenticated/service_role created), migrations 0001→0006 applied cleanly
  and deterministically (twice): postgresStore integration 10/10.
- c. synthetic E2E: webhookE2E 6/6, liveEndToEnd 4/4, webhookRpc 12/12.
- Full suite WITH DATABASE_URL (nothing skipped): 299 / 299 pass, 38.9s.
- d. Node/Deno parity: Node U12 parity test passes (both impls vs pinned golden
  vectors); Deno 2.9.3 runtime run of the edge `derive.js` against the 9 pinned
  vectors → 0 mismatches.
- e. `deno check supabase/functions/fcg-webhook-intake/index.ts`: exit 0, clean
  (deno 2.9.3).
- f. migration static guards (migrations.test.js): pass (in the node suite).
- g. `bash scripts/secret-scan.sh`: clean — 364 tracked files, 0 secret values.
- Throwaway cluster stopped and data dir removed after the run.

## Handoff / next
Fix is committed on the branch. Larry pushes (not pushed here). The corrected
ordering takes effect on the NEXT worker restart; the currently-running worker
(PID 24392) was intentionally left running per the review boundary.
