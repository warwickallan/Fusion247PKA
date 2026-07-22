---
build_id: BUILD-002
title: Unified Fusion Hub — exact-head evidence packet (WP7)
branch: build-002/unified-fusion-hub
pr: 57
head_sha: 1ccdac573b3d9234de12ef21bc021fc10f8bce58  # code-complete head; any later commits are docs/memory only — use the live branch head for review
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
| **WP4** | Bidirectional decision control | inbound A/B/C parse+correlate+continue (decision_response + parseChoice); safe Directus command route (command_request, allowlisted, fail-closed); outbound dry-run card renderer | inbound 10/10, command 9/9, card 13/13, parseChoice 5/5 | **~90%** | the real Telegram phone ping (`dry_run=false` + worker `--allow-send`) is with-Warwick |
| **WP5** | Shopper / AsdAIr route | typed/photo/voice front door (the parked "B half"), reuses AsdAIr normaliser → add-only list intents; no checkout/payment/substitution; ambiguous → durable needs_decision | shopper 6/6 | **~70%** | LIVE household write (extend `asdair-worker` allowlist with `add_list_item` + write the real shopping schema) — deferred by the **personal-data doctrine**, a reviewed with-Warwick step |
| **WP6** | Fixture-first email + voice | email intake preserving message-id/recipients/subject/body/attachments + routing; voice intake transcribe + ambiguous→A/B/C seam | email 6/6, voice 4/4 | **~85%** | live mailbox / voice credentials are OPTIONAL (fixture-first is complete); real transcriber wiring is with-Warwick |
| **WP7** | Assurance | duplicate-delivery + restart/recovery harness; full-chain migration reproducibility+rollback; this evidence packet; scope reconciliation | assurance 4/4, full-chain 16/16 | **~80%** | independent Codex/Fable review (pre-merge gate) |

**Overall BUILD-002 completion: ~80%.** The remaining ~20% is almost entirely **Warwick-gated live actions + independent review + merge** — not un-built logic. Every non-blocked arm is built and proven.

## Scope / non-goal reconciliation (BUILD-CONTRACT)

- **Channel-neutral hub (inputs → route → decision → output):** all four arms exist and are proven — Telegram/email/voice/Directus in; router; decision (dry-run cards + inbound A/B/C + command route); knowledge + follow-on out.
- **Non-goals honoured:** no competing Brain (one VaultWriter, one gateway spine); Shopper has **no checkout/payment/automatic substitution** (guarded, add-only); personal/household data stays in AsdAIr/Postgres, never the public repo or the general Brain; no API key / paid autonomous runtime (D-cairn); no merge without independent review + Warwick.
- **Least-privilege trust seam** reused for every write path (contract, learning, decision_card, decision_response, command_request, follow_on_task): cp_directus files intents only; cp_worker executes; guards enforce immutability + legal transitions; proven by the 42501/23514/23503 assertions in each proof.

## Live migrations (all applied + idempotent + schema-cascade reversible)

`db/mypka/` 060–120 (prior) + **130 decision_card**, **140 follow_on_task**, **150 decision_response**, **160 command_request** (this continuation). Each applied AND re-applied cleanly (idempotent); all live in the `cockpit` schema, reversed by `teardown.sql`'s `drop schema cockpit cascade`. New Directus collections registered (decision_card, follow_on_task, decision_response, command_request) — **surface on the next Directus restart** (not restarted overnight; intermittent-boot risk to the live cockpit).

## Test + proof inventory (at head 22c509c)

- **Hub suite** (`services/hub`, `node --test`): **46/46** — youtube classify/ingest, vault, decision renderCard + parseChoice, router route + assurance, shopper, email, voice.
- **Gateway suite** (`services/fusion-capture-gateway`): **285 pass / 0 fail / 32 skipped** (spine edits safe).
- **Live seam proofs** (synthetic, self-cleaning): contract 8/8, learning 10/10, decision-card 13/13, decision-response 10/10, command-request 9/9.
- **Migration reproducibility** (throwaway cluster): full-chain 010–160 apply + idempotent re-apply + teardown reversal **16/16**.

## Known limitations / findings (honest)

1. **Live cut-overs are Warwick-gated** (by design + safety): Directus restart to surface new collections; `HUB_YOUTUBE_ROUTE=1` + restart + stop poller; real Telegram send; live AsdAIr household write; live mailbox/voice credentials.
2. **Pre-existing AsdAIr suite failures (NOT WP5):** `services/asdair/skill` `node --test` shows 6 failures — `schemaCompat.test.js` (RULES_SELECT_COLUMNS vs schema drift) + 5 `dbSafeTarget` guard tests. No `services/asdair` file was modified by this Build; the reused normaliser fixtures are all green. Recorded for a separate fix.
3. ~~Migration reproducibility harness covers only 010–050.~~ **RESOLVED:** `apply-teardown-full.test.mjs` (+ `run-migration-test-full.sh`) now applies the FULL 010–160 chain to a throwaway Postgres, proves idempotent re-apply, asserts every BUILD-002 object, and proves `teardown.sql` fully reverses the cockpit layer while leaving AsdAIr untouched — **16/16 on a clean cluster.**
4. **Independent review not yet run.** Per [[merge-ready-means-independently-reviewed]], PR #57 needs an exact-head Codex (+ Fable where useful) pass before merge. This packet is the review input.

## Resume-after-dependency map

- Warwick restarts Directus → the 4 new collections surface → he can review candidates + file decisions.
- Warwick enables `HUB_YOUTUBE_ROUTE=1` + restarts + stops the poller → the spine route goes live (single durable service).
- Warwick approves a real card send → flip `dry_run=false` + run the worker with `--allow-send`.
- Warwick approves the AsdAIr write → extend `asdair-worker` allowlist with `add_list_item` (+ its own regression proof) → live Shopper writes.
- Warwick + Codex exact-head review → merge with the head-SHA guard.
