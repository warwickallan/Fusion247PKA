---
artifact: tower-qa-skill
version: 999
status: approved
governs_live: true
standing_use_ratified: true
owner: TEST-ONLY (WO-2026-08-05-09 qaExchange.test.mjs)
approved_by: n/a — never used outside this test file
approved_at: n/a
scope: TEST FIXTURE ONLY. Never delivered to a real Codex call.
---

# TEST-ONLY governing-prompt fixture — WP-2E (WO-2026-08-05-09)

This file exists solely so `test/qaExchange.test.mjs` can exercise `processTurn`'s REAL
merge-class path (including its fail-closed governing-prompt load via `loadCodexContract` /
`assertDeliveredContract`) without depending on the production
`services/control-plane/review/prompts/tower-qa-skill.md`, which is **deliberately DRAFT and
unratified** pending Warwick's own decision (§14.19 "Warwick owes" — item 1) — a decision this
Work Order does not make and must not route around.

This fixture is reached **only** when a test explicitly sets `TOWER_QA_SKILL_PATH` to this exact
path — the documented override seam in `watcher.mjs` ("overridable via env for tests / relocated
checkouts"). Nothing in the live watcher, the real Codex call, or any other test in this suite
points here. It never governs a real review and is never delivered to a real reviewer.

F247-CODEX-CONTRACT-SENTINEL-1
