---
build_id: BUILD-002
title: Unified Fusion Hub — exact-head evidence packet (WP7)
branch: build-002/unified-fusion-hub
pr: 57
head_sha: 661b7a4cbb774d2a799b7aa7129fad229398f495  # code-complete head — Codex returned READY_TO_MERGE here (round 6). Later commits are docs/memory only.
codex_verdict: READY_TO_MERGE (round 6, bound to 661b7a4) — after 6 rounds: rounds 1-5 found blockers, all fixed + re-verified
pack_approved: v1.1-draft (commit 8e59cb4, pack hash 017a9db7, approved_by warwick)
status: DRAFT — not merged; needs exact-head Codex READY_TO_MERGE + Warwick
---

# BUILD-002 — evidence packet (continuation, 2026-07-22)

One integration branch, **PR #57 (DRAFT, not merged)**. Everything below is committed + pushed at head
`22c509c`. Nothing personal is on this public repo. No pack change, no API key, no autonomous paid runtime.

## Per-WP status + evidence

| WP | Contractual scope | Built this continuation | Proof | Completion | Remaining (all Warwick-gated unless noted) |
| --- | --- | --- | --- | --- | --- |
| **WP0** | Build-acceptance mechanism | (prior) approved v1.1 pack bound to `8e59cb4`/`017a9db7`, recorded via worker | contract 8/8 | **100%** | — |
| **WP1** | Obsidian + one write authority | (prior) VaultWriter (write-once, path-confined); Obsidian Local REST API live | VaultWriter 5/5, API 8/8 | **~90%** | community-plugin toggle already done by Warwick; a live Obsidian-REST VaultWriter adapter is optional (FsVaultAdapter is the production writer) |
| **WP2** | YouTube route on the durable spine | routing writer in the worker's governed-write slot (extract→RAW→youtube_source), truthful completed card, feature-flag + live deps; auto-detect watcher live | route 6/6, gateway 285/0, watcher proven live | **~90%** | LIVE cut-over = set `HUB_YOUTUBE_ROUTE=1` + restart gateway + stop the standalone poller (with-Warwick); in-session note authoring is inherent (D-cairn) |
| **WP3** | Learning Accept/Decline loop | ACCEPT creates governed, correlated follow-on work (follow_on_task), not a silent edit; decline/defer create none | learning 10/10 | **~90%** | Warwick's real Accept/Decline taps in Directus; Larry then DOING the accepted follow-on work |
| **WP4** | Bidirectional decision control | inbound A/B/C parse+correlate+continue; **real Telegram inbound mapper** (callback/reply → decision_response); **resumption consumer** (open-follow_on queue Larry resumes from); safe Directus command route (allowlisted, fail-closed); outbound dry-run card | inbound 10/10, command 9/9, card 13/13, parseChoice 5/5, **inbound-mapper 4/4, full-loop 11/11** | **~95%** | only the real Telegram phone send (`dry_run=false` + `--allow-send`) and wiring the mapper into liveRunner (needs restart) are with-Warwick |
| **WP5** | Shopper / AsdAIr route | typed/photo/voice front door (reuses AsdAIr normaliser) → add-only list intents; **add_list_item handler + allowlist + persistence BUILT** | shopper 6/6, **add_list_item 15/15 (throwaway asdair schema)** | **~90%** | only the final REAL household write (worker → live asdair DB) is Warwick-gated; the logic is complete + synthetic-proven |
| **WP6** | Fixture-first email + voice | **email→durable store** (not just a mapper); **real LOCAL voice transcription** (Windows SAPI, no credential) proving audio→transcript→routed durable work | email 6/6 + **email→store 4/4**, voice 4/4 + **real-audio 2/2** | **~90%** | a higher-accuracy transcriber (whisper) + a live mailbox credential are OPTIONAL — the local route is complete |
| **WP7** | Assurance | duplicate-delivery + restart/recovery harness; full-chain migration reproducibility+rollback; independent Codex review; evidence packet; scope reconciliation | assurance 4/4, full-chain 16/16, **AsdAIr suite 141/141**, Codex review (see below) | **~90%** | Fable selective-verification + merge are the pre-merge gate |

**Overall BUILD-002 completion: ~90%.** The remaining ~10% is **Warwick-gated live actions + the final Fable pass + merge** — not un-built logic. Every non-blocked arm is built and proven; the WP4 inbound + resumption, WP5 write handler, and WP6 real-audio paths that the second directive flagged are now implemented and tested.

## Scope / non-goal reconciliation (BUILD-CONTRACT)

- **Channel-neutral hub (inputs → route → decision → output):** all four arms exist and are proven — Telegram/email/voice/Directus in; router; decision (dry-run cards + inbound A/B/C + command route); knowledge + follow-on out.
- **Non-goals honoured:** no competing Brain (one VaultWriter, one gateway spine); Shopper has **no checkout/payment/automatic substitution** (guarded, add-only); personal/household data stays in AsdAIr/Postgres, never the public repo or the general Brain; no API key / paid autonomous runtime (D-cairn); no merge without independent review + Warwick.
- **Least-privilege trust seam** reused for every write path (contract, learning, decision_card, decision_response, command_request, follow_on_task): cp_directus files intents only; cp_worker executes; guards enforce immutability + legal transitions; proven by the 42501/23514/23503 assertions in each proof.

## Live migrations (all applied + idempotent + schema-cascade reversible)

`db/mypka/` 060–120 (prior) + **130 decision_card**, **140 follow_on_task**, **150 decision_response**, **160 command_request** (this continuation). Each applied AND re-applied cleanly (idempotent); all live in the `cockpit` schema, reversed by `teardown.sql`'s `drop schema cockpit cascade`. New Directus collections registered (decision_card, follow_on_task, decision_response, command_request) — **surface on the next Directus restart** (not restarted overnight; intermittent-boot risk to the live cockpit).

## Test + proof inventory (at review head — see `head_sha`)

- **Hub suite** (`services/hub`, `node --test`): **56/56** — youtube classify/ingest, vault, decision renderCard + parseChoice + telegram-inbound, router route + assurance, shopper, email + email→store, voice + real-audio SAPI.
- **Gateway suite** (`services/fusion-capture-gateway`): **285 pass / 0 fail / 32 skipped** (spine edits safe).
- **AsdAIr skill suite** (`services/asdair/skill`, after `npm ci`): **141 pass / 2 skipped** (DB-gated) — see finding 2.
- **Live seam proofs** (synthetic, self-cleaning): contract 8/8, learning 10/10, decision-card 13/13, decision-response 10/10, command-request 9/9, **full-loop 11/11**.
- **DB handler proofs** (throwaway cluster): full-chain migration 010–170 **16/16**; **add_list_item 15/15** (real asdair schema).

## Known limitations / findings (honest)

1. **Live cut-overs are Warwick-gated** (by design + safety): Directus restart to surface new collections; `HUB_YOUTUBE_ROUTE=1` + restart + stop poller; real Telegram send; live AsdAIr household write; wiring the inbound mapper + spine flag into liveRunner (needs a gateway restart); a higher-accuracy voice engine + a live mailbox credential (both optional).
2. ~~Pre-existing AsdAIr suite failures.~~ **RESOLVED (AC7 green):** the 6 failures were entirely a **missing local `npm install`** in `services/asdair/skill` (its declared `pg` dep was absent, so `schemaCompat` couldn't load pg and `dbSafeTarget` couldn't load `pg-connection-string`). After install the suite is **141/141 (2 DB-gated skips)**; no `services/asdair` file was ever modified, and CI runs `npm ci` so it was always green there. Not drift, not a regression — a local setup artifact.
3. ~~Migration reproducibility harness covers only 010–050.~~ **RESOLVED:** full-chain 010–170 apply + idempotent re-apply + teardown reversal, **16/16 on a clean cluster**.
4. **Restart/recovery proof is a FIXTURE SIMULATION, not a live OS proof.** `assurance.test.mjs` proves the *logic* of resume-after-failure (dedup, no double durable work, no false completion) on the in-memory spine. It does **NOT** prove that the live gateway/watcher survive a real Windows process kill or a machine reboot — that needs the reboot-recovery scheduled task (elevation = Warwick) and a genuine restart. That live process/reboot proof remains **Warwick-gated** and is not claimed here.
5. **Codex independent review:** run at the exact review head — see the "Independent review" section below. Fable selective-verification is the remaining pre-merge step.

## Independent review (WP7) — Codex, 6 rounds → READY_TO_MERGE

A read-only, separate-runtime (OpenAI Codex) review ran to convergence over **6 exact-head rounds**, each fixed + re-verified:

| Round | Head | Found | Outcome |
| --- | --- | --- | --- |
| 1 | `106110f` | 6 blockers + 3 fold + 1 cosmetic | all fixed |
| 2 | `d772e56` | 2 blockers (partial-row repair; re-answer mutates task) | all fixed |
| 3 | `56fb6af` | 3 blockers (log ref; decide-once; WP4 loop not closed in code) | all fixed |
| 4 | `03d870c` | return-shape; **auth hazard**; live wiring absent | all fixed |
| 5 | `0103e88` | 1 regression (decision-tap failure lost the tap) | fixed |
| **6** | **`661b7a4`** | — | **`READY_TO_MERGE`** |

Every blocker was a genuine normal-use defect (several my own tests missed — e.g. the resume-queue UUID-cast that only breaks with a *mixed* queue; the offset-advance-on-failure lost-tap). Full triage: `CODEX-REVIEW-106110f.md`; final verdict: `CODEX-REVIEW-661b7a4-READY_TO_MERGE.md`. Codex confirmed no remaining correctness/leak/availability/audit defect under first-party use, and that the two residuals below are correctly Warwick-gated activation work, out of scope for merge-readiness of the reviewed code.

- **Warwick-gated activation residuals** (NOT un-built logic): (a) inbound wiring activates with `HUB_DECISION_INBOUND=1` + a live gateway restart; (b) a real card shows A/B/C buttons only once the external `larry-ding` sender honours the `--reply-markup` the worker already emits (recorded in the dry-run receipt today).
- **Fable is NOT scheduled / not run.** Per Warwick (2026-07-23) Fable is **never** summoned without his explicit yes; Codex-only is the independent check here. [[fable-confirm-first-hardlock]]

## Resume-after-dependency map

- Warwick restarts Directus → the new collections surface → he can review candidates + file decisions.
- Warwick enables `HUB_YOUTUBE_ROUTE=1` + restarts + stops the poller → the spine route goes live (single durable service).
- Warwick approves a real card send → flip `dry_run=false` + run the worker with `--allow-send`; wire the inbound mapper into liveRunner.handleCallback.
- Warwick approves the AsdAIr write → point `asdair-worker` at the live asdair DB (the `add_list_item` handler + allowlist are already built + synthetic-proven).
- Warwick registers the reboot-recovery scheduled task (elevation) → the live process/reboot proof (finding 4) can be run.
- Warwick + Codex/Fable exact-head review → merge with the head-SHA guard.
