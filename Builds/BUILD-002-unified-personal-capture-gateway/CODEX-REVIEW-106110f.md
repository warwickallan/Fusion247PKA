---
build_id: BUILD-002
title: Independent Codex review — triage + fixes
reviewer: OpenAI Codex (codex-cli 0.145.0-alpha.27), read-only sandbox, separate runtime
review_head: 106110fb80b07f30887bad80e497a5a1d50dee73
review_input: curated diff of the correctness-critical new logic (WP2–WP7), staged into the prompt (read-only sandbox cannot open files)
brief: fitness-for-purpose / first-party-hobby bar (correctness, accidental leak, availability, audit) — NOT adversarial pen-test
raw: CODEX-REVIEW-106110f-raw.md
---

# Independent Codex review — outcome

Codex returned **"not fit for merge as presented"** with **6 normal-use blockers** + 3 fold-before-live + 1 cosmetic. **Every finding was genuine** (my own tests missed several — notably the resume-queue UUID cast, which only breaks with a *mixed* follow-on queue). **All are now fixed and re-proven.**

## Blockers — all FIXED

| # | Finding | Fix | Re-proof |
| --- | --- | --- | --- |
| 1 | `emailToStore` called async `store.recordIntake()` synchronously → live-store write not awaited, rejection detached | made `emailToStore` async + `await`; all callers await | email→store 4/4 |
| 2 | Shopper default `keyPrefix='shop'` → `shop-0/1…` collide across DIFFERENT messages → a real 2nd message deduped away | `sourceId` (unique per inbound message) now REQUIRED; keys are `shop:<sourceId>:<n>`; missing → fail closed | shopper 8/8 incl. collision + missing-source tests |
| 3 | `add_list_item` accepted `list_date` but ignored it → item can land on the wrong week's list | `findOrCreateDraftList` honours `list_date` (select/create by household+status+date); malformed date rejected | add_list_item 19/19 incl. list_date |
| 4 | Existing-YouTube short-circuit returned a MANUFACTURED evidence hash `existing:<id>` → a partial/legacy row could falsely satisfy the "no false completion" evidence gate | `getExistingSource(videoId)` returns real `{raw_path, raw_sha256}`; short-circuit only when BOTH present, using the TRUE hash; else re-extract | route 6/6, assurance 4/4 |
| 5 | Ambiguous-voice `card.intent` lacked `idempotency_key` (NOT NULL) → the card could not be filed | added `idempotency_key: voice-decision:<ref>` + explicit `dry_run: true` | voice 4/4 |
| 6 | `resume-followups` cast `f.correlation_id::uuid` for ALL rows → a learning follow-on's non-UUID correlation raises `invalid input syntax for uuid` and breaks the ENTIRE resume queue | cast the uuid to text instead: `dc.id::text = f.correlation_id` (no text→uuid cast, order-independent) | full-loop 11/11 |

## Fold-before-live — all FIXED

- **Stale/mismatched TubeAIR packet** (`liveDeps`): now picks the NEWEST packet dir for the video AND validates `manifest.video_id === videoId`, refusing a stale/mismatched packet.
- **Shopper receipt under-reported note-only corrections** (`asdairCommands`): a note change now counts as `corrected` (no audit-integrity mismatch).
- **Cosmetic — YouTube completion wording**: changed to "Knowledge note pending in-session authoring, then it appears for review" (truthful about D-cairn).

## Seams Codex independently confirmed sound

Claim-before-apply prevents double-execution; the command route's fixed allowlist fails closed; completed rows are guard-protected; decision parsing is correlated to the card's own options and never guesses; a failed Telegram projection does not reverse durable completion; the routing writer preserves the plain-markdown path when off/non-YouTube; Shopper effects are bounded to draft-list add/correct (no checkout/payment/substitution); household ambiguity fails closed with per-household advisory locking.

## Post-fix test state

Hub suite **58/58** · gateway **285/0** · full-loop **11/11** · add_list_item **19/19** · decision-response 10/10 · command 9/9. Fixes committed after the review head; a re-review at the new head + the Fable selective-verification pass are the remaining pre-merge steps.
