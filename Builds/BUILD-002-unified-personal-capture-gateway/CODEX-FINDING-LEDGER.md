---
build_id: BUILD-002
title: Complete Codex finding ledger (every raw finding, durable disposition)
purpose: QA2 point 1 — reconcile EVERY finding from CODEX-REVIEW-106110f-raw.md + rounds 2-6, not the abbreviated triage
lesson: a triage narrative must NEVER replace the reviewer's raw list; every finding (incl. fold-before-live) gets a durable disposition
---

# Codex finding ledger — every finding, every disposition

My original round-1 triage narrative dropped four fold-before-live findings (7-10 below). This ledger records **every** raw finding with its true disposition, fixing commit, regression test, and current status. Verified = the fix is in the current head and its test passes.

## Round 1 (raw: `CODEX-REVIEW-106110f-raw.md`, at `106110f`)

| # | Finding | Severity | Disposition | Fixing commit | Regression test | Status |
|---|---|---|---|---|---|---|
| 1 | Email intake not awaited | BLOCKER | make async + await | `cab68ec` | emailToStore 4/4 | ✅ VERIFIED |
| 2 | Shopper keys collide across messages | BLOCKER | require source-scoped `sourceId`; no alias | `cab68ec`,`56fb6af` | shopper 8/8 (collision test) | ✅ VERIFIED |
| 3 | Shopper `list_date` ignored | BLOCKER | honour list_date in findOrCreateDraftList | `cab68ec` | add_list_item 19/19 | ✅ VERIFIED |
| 4 | YouTube existing-row manufactures evidence | BLOCKER | getExistingSource returns real raw_sha256; repair-on-conflict | `cab68ec`,`56fb6af` | route 6/6 | ✅ VERIFIED |
| 5 | Ambiguous voice card unfileable (no idempotency_key) | BLOCKER | add idempotency_key + dry_run | `cab68ec` | voice 4/4 | ✅ VERIFIED |
| 6 | Non-UUID correlation breaks resume queue | BLOCKER | `dc.id::text = correlation_id` | `cab68ec` | full-loop 11/11 | ✅ VERIFIED |
| 7 | **Concurrent answers → duplicate follow_on_task (finding A)** | FOLD | **DROPPED in triage** → partial unique index (mig 180) + ON CONFLICT | `67f975a` | prove-decision-concurrency 3/3 (two connections) | ✅ VERIFIED |
| 8 | **Accept-then-decline leaves open task (finding B)** | FOLD | **DROPPED in triage** → drop stale task in same txn + receipt records prev/new | `67f975a` | learning 13/13 | ✅ VERIFIED |
| 9 | **Telegram Markdown not escaped (finding C)** | FOLD | **DROPPED in triage** → renderCard is plain text (no parse_mode) | `67f975a` | renderCard punctuation test | ✅ VERIFIED |
| 10 | **Option keys unescaped in RegExp (finding D)** | FOLD | **DROPPED in triage** → key-shape constraint + parseChoice escape | `67f975a` | renderCard/parseChoice negative tests | ✅ VERIFIED |
| 11 | YouTube stale/mismatched packet | FOLD | newest dir + manifest.video_id check | `cab68ec` | liveDeps code (live-gated) | ✅ VERIFIED (code) |
| 12 | Shopper receipt under-reports note-only correction | FOLD | note change counts as corrected | `cab68ec` | add_list_item 19/19 | ✅ VERIFIED |
| 13 | YouTube completion wording | COSMETIC | truthful "note pending in-session" | `cab68ec` | route F | ✅ VERIFIED |

## Rounds 2-6 (curated re-reviews — see per-round CODEX-REVIEW-* / commit messages)

| Round | Finding | Fixing commit | Test | Status |
|---|---|---|---|---|
| 2 (`d772e56`) | Partial YouTube row never repaired | `56fb6af` | route/assurance | ✅ |
| 2 | Re-answer mutated the task | `56fb6af` | decision-response 13/13 | ✅ |
| 3 (`56fb6af`) | Undeclared `followId` log ref | `03d870c` | decision-response | ✅ |
| 3 | Decide-once inconsistent (same-choice applied:true) | `03d870c`,`0103e88` | decision-response 13/13 | ✅ |
| 3 | WP4 loop not closed in code | `03d870c` | full-loop 11/11 | ✅ |
| 4 (`03d870c`) | Return shape missing ok:true | `0103e88` | — | ✅ |
| 4 | **Auth hazard**: filer trusts from.id | `0103e88` | file-inbound-decision 4/4 | ✅ |
| 4 | Live inbound not wired | `0103e88` | liveRunner 20/20 | ✅ |
| 5 (`0103e88`) | Decision-tap failure lost the tap (offset advanced) | `661b7a4` | liveRunner offset-hold test | ✅ |
| 6 (`661b7a4`) | — | READY_TO_MERGE | — | (superseded by QA2) |

## QA2 adversarial pass (this pass)

| Point | Item | Fixing commit | Test | Status |
|---|---|---|---|---|
| 1 | Complete ledger reconciled (this file) | this commit | — | ✅ |
| 2 | Crash/restart lease-reclaim across all 5 cockpit queues | `039802e` | prove-crash-reclaim 6/6 | ✅ |
| 2 | Send-before-receipt window (durable send-attempt marker, mig 190) | `039802e` | (decision-card; real-send gated) | ✅ code |
| 3 | Typed-reply path (mig 200 map + async resolver + liveRunner routing) | `3c142cd` | liveRunner 20/20 | ✅ |
| 3 | Resumption claim narrowed (in-session queryable, not auto-push) | `3c142cd` | — | ✅ (narrowed) |
| 4 | Restore intent boundary (revoke cp_directus UPDATE on follow_on_task; mig 180) | `67f975a` | migration 16/16 | ✅ |
| 5 | Enforced CI for BUILD-002's own files | `ab0a47a` | build-002-tests.yml | ✅ |
| 6 | Process repair (this ledger, SHAs, same-model note, verdict-in-PR) | this commit | — | ✅ |
| 7 | Codex QA2 on the FULL PR at exact head | (Phase 7) | — | pending |

## Process notes (point 6)

- **"Same-model review" caveat:** the Codex CLI appends "Same-model review — not independently verified" as a stock disclaimer. The reviewer is **OpenAI Codex**, a different vendor + model from the implementer (**Claude Opus 4.8**), so the review IS cross-vendor independent; the phrase is Codex boilerplate, not a statement that the same model reviewed its own work. Surfaced honestly rather than suppressed.
- **Fable:** unauthorised; never scheduled/required. Codex-only independent review. [[fable-confirm-first-hardlock]]
- **Exact-head QA:** the final QA2 (point 7) reviews the FULL PR at the exact head; its verdict is recorded in the PR conversation (not a commit that would move the head after review).

## PARKED (2026-07-23, Warwick) — BUILD-002 frozen at c7f641b70bdfbf5257eeafd1ae697941a4ca5f6d

QA2 loop stopped by Warwick; Tower recovery took priority. PR #57 stays DRAFT/unmerged; no further Codex reviews.

**Open Warwick-gated LIVE-SEND ACTIVATION item (NOT repo code):** `C:\.fusion247\larry-ding.mjs` (external sender) does not yet consume `--reply-markup` or `--plain-text`, and does not return the Telegram `result.chat.id`. Until it does, a REAL decision-card send (`dry_run=false` + `--allow-send`, itself Warwick-gated) would: send no inline buttons, be sent without an explicit plain-text guarantee, and leave the typed-reply `sent_chat_id` map null (button taps still self-correlate). Dry-run (default) is unaffected. Fix at real-send cut-over: make larry-ding consume `--reply-markup`, omit `parse_mode`, and return `result.chat.id`; then a transport-contract test.
