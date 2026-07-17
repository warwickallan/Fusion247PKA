---
agent_id: larry
session_id: idea-013-tubeair-local-capture
timestamp: 2026-07-17T23:00:00Z
type: end-of-session
linked_sops:
  - SOP-015-cairn-process-external-source
  - SOP-016-cairn-process-youtube-transcript
linked_workstreams: []
linked_guidelines:
  - GL-011-immutable-source-retention
  - GL-008-source-classification-registry
runtime_host: Claude Code
---

# IDEA-013 TubeAIR built as a local terminal capture tool; Cairn handoff, FusionDevBot inbox bridge

## Context

Warwick issued an authorised build-start for IDEA-013 (TubeAIR / Youtubair, project
F247-YT-INGRESS-001): turn a YouTube URL into a full transcript capture + a
Warwick-specific analysis packet, as a **local terminal build**. Stage gate first
(read the Foundry/Drive source set), then build the leanest working version.

Two mid-build corrections from Warwick shaped the design:
1. **Telegram is NOT deferred — FusionDevBot is the intake source.** FusionDevBot is
   the live BUILD-002 `fusion-capture-gateway`. Decision (Warwick-approved):
   **inbox handoff** — TubeAIR reads `Team Inbox/captures/` read-only; the gateway is
   not modified (avoids a second poller / getUpdates 409; honours "one bot, many
   routes"). See [[build-002-runtime-on-this-machine]].
2. **Cairn is the live downstream** (it has absorbed the legacy CategorisAIr
   source-to-WIKI role — verified against Cairn's contract + SOP-015 dispositions).
   Frontmatter uses `pending_cairn` / `next_agent: cairn`; `pending_categorisair` /
   `categorisair` retained as secondary aliases only.

## What was built

`tools/tubeair/` (isolated venv, key-free): `tubeair.py` (deterministic core + CLI),
`tubeair_inbox.py` (FusionDevBot bridge, read-only), `test_tubeair.py` (30 tests),
`testdata/captures/test-fixture-0001.md`. One shared `process_capture` code path for
CLI + inbox. Output packets → `out/tubeair/…` (gitignored). WP-D handoff writes the
raw transcript to `Sources (Immutable)/` + a register row.

## Closeout evidence

- **Tests:** 30/30 no-network unit tests pass (URL parsing, timestamp/markdown gen,
  `pending_cairn`-primary vs `categorisair`-legacy, honest-failure format, URL extraction).
- **Karpathy live proof:** `zjkBMFhNj_g` "[1hr Talk] Intro to Large Language Models" —
  **1704 timestamped segments**, full transcript preserved (no summary substituted),
  real metadata. Three analyses authored from the transcript (relevance, monetisation,
  self-learning), recommendations-only, `pending_warwick_review`.
- **Honest failure proof:** bad URL → exit 1, no packet; non-existent video id → exit 2,
  `transcript_status: extraction_failed`, `error_category: video_unavailable`, retry
  guidance, "a link without a transcript is NOT a successful capture". Handoff correctly
  skipped; no immutable payload written for a failed capture.
- **Cairn handoff behaviour (WP-D):** raw transcript → `Sources (Immutable)/2026/07/…md`
  (GL-011, gitignored payload) + register row (`disposition: pending_cairn`). Idempotent
  (re-run reported "existed / already present"); never mutates a captured payload.
- **Local runtime dependency:** YouTube egress works on this machine; the MyPKA cloud
  worker may be blocked, so the bridge/capture must run locally. Analysis is an
  agent-authored step (key-free), not autonomous.
- **No living-knowledge writes:** no PKM note, SOP, agent instruction, or WIKI change.
  Analyses stay in `out/`. The only tracked governance change is one `Sources
  (Immutable)/INDEX.md` register row (approved).

## Isolation / safety

Committed to a clean branch `idea-013/tubeair-local-capture` **off main** (main already
contained the merged BUILD-002 WP1 work). Commit `58b0321` contains exactly 6 files;
secret scan clean (410 files); `services/` and `supabase/` untouched. BUILD-002 /
FusionDevBot code was READ only, never modified.

## Follow-ups / recommendations (not implemented)

- **Vex prompt-injection recommendation** drafted at
  [[2026-07-17-tubeair-vex-prompt-injection-recommendation]] — captured transcripts are
  untrusted external text; downstream LLM analysis is a prompt-injection surface for both
  TubeAIR and BUILD-002. Recommendation/risk only; no SOP/agent change made.
- Native in-gateway YouTube route (phone → packet back) remains a future,
  BUILD-002-coordinated step (needs Vex + Mack), deliberately not built this pass.
- Analysis auto-fill via an LLM API key is backlog (would introduce a secret; out of the
  key-free lean scope).

## Next executable action

Open PR for `idea-013/tubeair-local-capture`; on merge, TubeAIR is usable via
`tubeair.py --url … --handoff` and the FusionDevBot bridge `tubeair_inbox.py --handoff`.
