---
agent_id: larry
session_id: build-010-baton-live-proof
timestamp: 2026-07-18T02:50:00Z
type: close-session
linked_sops:
  - SOP-018-independent-change-qa
  - SOP-019-fusion-delivery-tracking
linked_workstreams: []
linked_guidelines: []
linked_tasks:
  - 869e64y0r
  - 869e6859d
runtime_host: Claude Code (Warwick's dev machine, the Yoga)
---

# BUILD-010 — Fusion Tower re-scoped to the ClickUp baton MVP; built, verified, LIVE-proven end-to-end (Codex QA working), findings escalated

## Coverage window
- **Previous close checkpoint:** [[2026-07-17-21-30_larry_close-session-convergence-build-and-merge-accountability]]
- **Covered from:** 2026-07-17T21:30Z (everything after the convergence/merge-accountability close)
- **Covered to:** 2026-07-18T02:50Z
- **First checkpoint:** no

## Context
Overnight autonomous run under Warwick's authorization `[BUILD-010-TOWER-BATON-RECOVERY-OVERNIGHT-0001]` plus a runtime-secret-persistence amendment. Tower was re-scoped from the parked autonomous-governance reactor to the **minimum that removes one unpaid human job**: Warwick copying Larry's build checkpoint to GPT for QA and pasting the reply back. This session built the baton, verified it independently, ran a **real live end-to-end proof** (real Codex, real ClickUp, real Telegram), fixed the defects the proof surfaced, and escalated the material findings Codex raised.

## What we did (who did each piece)
- **Mack:** built `services/tower-baton/` (watcher, handoff, ClickUp client, GitHub evidence, read-only Codex adapter, durable state, telegram notifier, runtimeConfig loader, launcher `scripts/start-fusion-tower.ps1`, `Runtime/runtime-manifest.yaml`, `Runtime/recovery.md`, the modifiable `baton-mvp/tower-qa-skill.md`) with the runtime-persistence amendment folded in; 68/68 tests.
- **Larry (verification + live proof):** independent verification (68/68, secret-scan, frozen branches untouched, correct authorship); scoped the loader to `*.env` (Warwick's `.env keys\*.txt` are human notes, not machine env); made the QA-skill provenance honest (PROVISIONAL ratification); drove **Proof 1** (Tower builds Tower) and **Proof 2** (cross-build TubeAIR) live via the real watcher + handoff; found and fixed three proof defects; added regression tests (→ 72/72); opened draft **PR #34**.
- **Codex (gpt_codex, read-only):** the QA engine — reviewed the real staged diffs and returned substantive, correct findings on BOTH builds, including a real TubeAIR security bug.
- **Fable (claude-fable-5):** independent final stress-test (verdict recorded in the checkpoint).

## Decisions made
- **Loader reads `*.env` only.** `.env keys\tower.env.txt`/`shopper.env.txt` are Warwick's human credential NOTES (label=value); including one made the malformed-file detector fail-close the whole loader. Removed from `DEFAULT_ENV_FILES` (config.js). Tower's own-bot wiring deferred to Warwick.
- **QA skill runs at PROVISIONAL ratification.** `status: approved` (loader run-gate, authorized by the overnight instruction) but `text_ratification: PROVISIONAL` — Warwick's line-by-line sign-off is pending; the standing scheduled watcher stays OFF until he ratifies. Honors [[governing-prompts-need-human-approval]].
- **Dev proof on FusionDevBot, clearly labelled** — per Warwick's convergence decision "the existing Fusion bot may be used only for a clearly labelled development proof." Final acceptance moves to the separate **Tower** bot Warwick provisioned tonight.
- **Codex reviews a Tower-STAGED diff** — on Windows a read-only Codex sandbox blocks ALL shell/file reads, so Tower stages the real unified diff (collected read-only via its allowlisted git). Read-only posture preserved; independence narrowed from free-navigation to staged-real-diff (flagged for Warwick).
- **Codex's DECISION_REQUIRED findings are NOT auto-fixed** — per the system's own governance, material findings escalate to Warwick, not to an autonomous fix.

## What the live proof proved (real, no copy-paste)
- **Proof 1 (Tower builds Tower):** Larry→Tower→Codex→Tower→Larry round on the baton itself. Verdict DECISION_REQUIRED — Codex found real issues.
- **Proof 2 (cross-build):** reviewed IDEA-013 TubeAIR code (a different build); Codex correctly summarized the design AND found a real security bug (URL validation accepts non-YouTube hosts). Verdict DECISION_REQUIRED.
- Milestones fired from **Tower's own notifier** (watcher_online / watcher_recovered / escalation); session-independent secret loading confirmed (watcher loaded from `C:\.fusion247` with no terminal env); Codex child env carried no Telegram/ClickUp secret.

## Defects found DURING the proof and fixed (with tests)
1. `bin/tower-watch.js` unref'd the poll interval → the process exited after one tick. Removed the unref.
2. `watcher.pollOnce` had no re-entrancy guard → a ~60s Codex turn >> 15s poll caused overlapping ticks to launch duplicate reviews (observed: 4 duplicate replies to PROOF1-0001, which also inflated the per-chain round counter). Added a one-cycle-at-a-time guard + test.
3. Codex read-only sandbox on Windows blocks shell/file reads → diff-staging (above) + packet identity (checkpoint_id/build_id/wp_id) + tests.

## Open threads (Warwick's decision queue — Codex-raised DECISION_REQUIRED, NOT auto-fixed)
- [ ] **Governing-prompt ratification** — sign off (or edit) `baton-mvp/tower-qa-skill.md` before the standing watcher goes live.
- [ ] **Tower Telegram identity** — normalize the `Tower` bot creds from `.env keys\tower.env.txt` into `tower-baton.env` and confirm the bot is `/start`-ed; confirm what `Shopper` is. Not wired by guessing.
- [ ] **Lock liveness** — a killed watcher leaves a stale lock reclaimed only after `staleMs` (no PID/owner liveness). Demonstrated live tonight.
- [ ] **Branch-unresolvable fail-closed** — `headMatchesBranch===null` currently does not block; Codex says it should.
- [ ] **Verdict signing** — `TOWER_HMAC_SECRET_GPT_CODEX` unset → honest but UNSIGNED envelope; decide whether signing is mandatory.
- [ ] **TubeAIR URL validation** (IDEA-013 scope) — accepts non-YouTube hosts; real security finding, routed to IDEA-013.
- [ ] **Standing scheduled watcher** — prepared, NOT installed; gated on the two ratification items above.
- [ ] **Diff truncation** — 120KB cap truncated the large Proof-1 self-review; incremental real checkpoints won't hit it, but raise/param if needed.

## Next steps
- **Exact next resumption point:** Warwick reviews PR #34 + the ClickUp control thread (task 869e6859d) where he can read exactly what Tower/Codex said to Larry; he then works the decision queue above (ratify the QA skill, decide the Tower bot, prioritize the 4 Codex findings). Nothing merges and no standing watcher starts without his go.
- Frozen reactor branches (`build-010/wp1-...`@`db9d0f3`, `build-002/wp2-...`@`b7fd473`) remain untouched evidence.

## VlogOps / story signals
- **"The QA robot found its own bugs."** Codex independently flagged the exact poll-re-entrancy race and SHA-correlation gap that Larry then fixed — the reviewer earned its keep on its first real night.
- **"It reviewed a totally different project and found a security hole."** Cross-build Proof 2 caught a real TubeAIR URL-validation bug.
- **The honest machine:** every verdict was DECISION_REQUIRED — the system escalated to the human instead of ever rubber-stamping an approval. The safety valve worked before the feature did.
- **Windows fought back:** the read-only Codex sandbox blocks all reads, so Tower learned to hand Codex the diff on a plate.

## Cross-links
- [[2026-07-17-21-30_larry_close-session-convergence-build-and-merge-accountability]] — previous close (start boundary).
- [[governing-prompts-need-human-approval]] · [[build-002-runtime-on-this-machine]] · [[scoped-authority-no-live-changes]]
- PR #34 (draft) · ClickUp control thread `869e6859d` · convergence record `869e64y0r`.
- `services/tower-baton/` · `Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md` · `Builds/BUILD-010-fusion-tower/Runtime/`.
