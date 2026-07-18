# BUILD-010 Tower — Product Recovery Map (baton MVP)

**Corrected product definition:** Tower is the automated **baton-carrier + QA reviewer** that replaces the one unpaid job — Warwick copying Larry's checkpoint to GPT, waiting for QA, pasting it back. Larry posts a checkpoint + `READY_FOR_TOWER_REVIEW` → Tower detects it in ClickUp, reads the approved brief + checkpoint + GitHub evidence, runs read-only Codex QA against the brief, and posts the QA **back into the same ClickUp thread** → Larry reads it and continues **autonomously** → repeat until `READY_FOR_FINAL_REVIEW`. Warwick returns only for material decisions/merge/live. Telegram = milestones, not a console.

## KEEP (reuse from frozen `build-010/wp1-...` @ 994fcdf — copy the useful modules, do not depend on the reactor)
- **Codex adapter** (`codexAdapter.js`) — read-only `codex exec`, reads branch/SHA/diff, strict signed structured verdict, honest `gpt_codex`/`openai-codex` label, fail-closed. *The QA engine.*
- **Approved Codex QA prompt** (`fusion-tower-operating-instructions.md`, `status: approved`) → re-homed as the **modifiable Tower QA skill** (Warwick addition #1), loaded fresh per turn + **fingerprinted**.
- **GitHub evidence collector** — git diff/log/CI reads bound to the exact head SHA.
- **ClickUp read + write** — governed read of the brief/checkpoint; post the QA reply to the same thread (additive comment — no page-replace).
- **Dedup** — by `checkpoint_id` (concept reused; store locally, not in ftw).
- **Round limits** — max correction rounds (default 3).
- **Telegram milestone notifier** — outbound-only via FusionDevBot; the milestone set only.
- **Signing/identity** — honest-label envelope for the QA verdict.

## PARK (freeze on the reactor branches as evidence — NOT deleted, NOT in the MVP)
- Telegram command centre (`commandRouter.js` /status /trace/…).
- Per-round Warwick decision cards (`decisionGate.js`) — the fork is decided: routine rounds are autonomous.
- Tower launching / controlling Larry (loop driver's Larry dispatch) — Tower does **not** launch Larry; Larry hands over + waits + resumes.
- Break-glass/reactor controls + Supabase-dependent latch.
- **Live Supabase `ftw` governance state machine** — the baton MVP needs **no Supabase**: dedup + recovery state live in a **local durable file outside the repo**. (Also: live Supabase apply is prohibited this pass.)
- WP2 capture-worker governance routing (Telegram command routing) — parked.
- Windows service beyond the smallest user-level scheduled watcher.

## MISSING (build on `build-010/wp1-clickup-baton-mvp`)
1. **Larry checkpoint format** `[LARRY → TOWER] state: READY_FOR_TOWER_REVIEW …` (concise, factual).
2. **`handoff-to-tower` Larry command** — posts the checkpoint, polls the same ClickUp thread for the matching Tower reply (by `checkpoint_id` + `reviewed_head`), returns it into Larry's session; honest timeout → `TOWER_UNAVAILABLE` + Telegram alert + Larry stops QA-dependent work.
3. **Tower watcher** — polls ClickUp for new `READY_FOR_TOWER_REVIEW`; dedup by `checkpoint_id`; resolve brief + WP scope; verify branch/exact head SHA/diff/CI from GitHub (fail closed if unresolvable); load the QA skill fresh + fingerprint; invoke Codex read-only; post `[TOWER → LARRY]` (verdict + ≤3 material findings + one next_action) to the thread; local durable dedup/recovery state.
4. **Cross-build**: keyed on `build_id`/`wp_id`/`brief_ref` from the checkpoint — works for any build, not just BUILD-010.
5. **Live user-level scheduled watcher** on the Yoga under `Buggly` (after proofs).
6. **The modifiable Tower QA skill md** (versioned, fingerprinted).

## Key simplification vs the reactor
No Supabase, no `ftw` tables, no command centre, no cards, no Larry-dispatch, no service. A **watcher + Codex QA + ClickUp read/write + GitHub evidence + local state + milestone Telegram + a Larry handoff command.** Minimum moving parts to remove Warwick from the copy-paste relay on every build.
