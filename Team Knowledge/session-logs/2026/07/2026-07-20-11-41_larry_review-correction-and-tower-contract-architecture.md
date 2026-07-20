---
agent_id: larry
session_id: 99ae3521-review-correction-and-tower-contract
timestamp: 2026-07-20T11:41:00Z
type: close-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-014 control-plane completion, a review-process failure and its correction, and Tower re-designed as an approved product-contract architecture

## Coverage window

- **Previous close checkpoint:** `[[2026-07-18-22-10_larry_asdair-wp1-and-tower-baton-completion]]`
- **Covered from:** 2026-07-18T22:10Z
- **Covered to:** 2026-07-20T11:41Z
- **First checkpoint:** no

## Context

A single ~4-day continuous session Warwick drove from his phone. It carried BUILD-014 (the Fusion247 Control Plane / "Tower on Supabase + git") through WP-C and WP-D0 to merge and a local cockpit proof; then a Warwick callout exposed that Larry had been labelling feature PRs "merge-ready" without the independent Codex+Fable loop. Correcting that reshaped the whole review approach and, ultimately, Tower's architecture into an approved product-contract design ready to build next session.

## What we did

- **Mack** built WP-C (GitHub ingress + Fusion policy gate + ported review adapters), WP-D0 (authoritative current-head hardening, migration 002), the WP-D cockpit proof inc-1 (local Postgres + Directus, synthetic data, 11/11 permission test), the TubeAIR URL-validation fix, transcript-cleanup, and Telegram-bridge watcher, the AsdAIr alternative-ranker + list-normaliser, the multimodal gateway intake, and all subsequent correction passes.
- **Codex (read-only) and Fable (adversarial, executed)** independently reviewed every WP; **Vex** ran the WP-D security/data-hygiene gate.
- **Larry** orchestrated, adjudicated the Codex/Fable splits on the code, ran the merge protocol (PR → reconcile → CI → exact-head-guarded merge), authored the reviewer-classification amendment, the findings ledger, and the Tower contract design v1→v3 + the approved completion-campaign brief.
- Merged to main (exact-head guarded): WP-C (#40), WP-D0 (#41), TubeAIR URL-fix (#42), and — after the review correction — the four corrected features: AsdAIr ranker (#45), normaliser-fixes (#48), TubeAIR watcher (#47), TubeAIR cleanup (#46). Deliverables (design chain, brief, ledger) pushed durably (`docs/tower-design-and-campaign-2026-07-20`).

## Decisions made

- **Q:** How should reviewers classify findings? **Decision:** Adopted the three-axis reviewer amendment (technical impact / reachability / disposition; severity never drives the merge verdict) — APPROVED + LIVE.
- **Q:** What does "merge-ready" mean? **Decision:** It REQUIRES an independent Codex+Fable review (both) with fixes applied — never the builder's own tests; Warwick's merge yes sits on top of review, never replaces it.
- **Q:** Why do Codex/Fable miss product defects GPT catches? **Decision:** They were briefed to pen-test; re-orient to QA / fitness-for-purpose ("the GPT check"); reserve adversarial depth for real trust boundaries; Codex = primary systemic reviewer, Fable = selective/risk-triggered (expensive + availability risk).
- **Q:** Overnight auto-merge? **Decision:** Trialled ("give auto-merge a try"), then paused when GPT's stricter boundary arrived; the safe destination is mechanical, matrix+findings-gated auto-merge (future).
- **Q:** Tower architecture? **Decision:** Foundry→Build promotion creates versioned PRD + Plan + acceptance matrix + findings ledger in Supabase; Codex=product-QA, Fable=risk-triggered adversarial; a fail-closed `review_packet`; checkpoint-level assurance; cockpit derived from the event ledger. **v3 APPROVED as final (no v4); the BUILD-014 completion campaign is authorized (DEV/synthetic).**

## Insights

- The review loop pen-tested because there was no machine-readable statement of intent to QA against — the durable fix is the acceptance matrix + findings ledger, not a better prompt. (Graduation candidate → SOP once the Tower campaign proves it.)
- Findings genuinely vanished/moved between correction rounds when tracked only in per-round prose; a durable ledger is essential.
- Codex-systemic and Fable-executed are genuinely complementary — Fable verifies properties by running them; Codex reasons about sequences the tests don't cover (it found the `.bak`-clobber durability bug the tests missed).
- Parallel file-mutating subagents in one working tree clobber each other's git state — always use worktree isolation, and don't hold the target branch checked out in the main tree when spawning an isolated agent on it.

## Realignments

- Warwick: *"where is codex and fable? I haven't seen a single [sign-off] for any of the PRs ready to merge... they need running past fable and codex as normal and any fixes applied before they can be called ready to merge."*
- Warwick: *"Codex and Fable seem to be spending all their time poking in crevices that are unlikely to ever be an issue to me and not enough time doing the GPT checks. Feels to me that they are both pen testing rather than QAing."*
- Warwick (stricter bar, overruling "acceptable residual"): close the signed/decimal/Unicode-quantity and marker-only-line findings (#48); close the persistent-service boundary (#47).
- Warwick: *"V3 is good enough to stop designing and start building. I would not burn another session creating a v4."* + the correction that the TOWER RUNTIME (not the model subprocesses) holds the GitHub/Supabase access.

## Open threads

- [ ] **THE resumption point:** implement the BUILD-014 Tower completion campaign per `Deliverables/2026-07-20-build-014-tower-completion-campaign-brief.md` (DEV/synthetic; the 16-test TubeAIR proof; evidence bundle). Flagged in memory `[[tower-completion-campaign-authorized]]`.
- [ ] Multimodal intake (`build-002/multimodal-intake` @ 573ae37) — reviewed merge-ready, HELD (not in the authorised batch).
- [ ] Held PRs: #43 (WP-D inc-1), #33 (SOP-019, held for Foundry redesign), #49 + `docs/tower-design-and-campaign` (docs, sanity pass), #24 (stale, not mergeable).
- [ ] Deferred residuals in the findings ledger (F-047-A/B/C, F-MM-*, F-014-BLH before-live hardening) — land before their live-apply gates.
- [ ] #4 AsdAIr data-boundary decision (defaulted synthetic; needed before any AsdAIr live/cockpit-consumes-real-data step).

## Next steps

- **Start a FRESH session** (this one's context is maxed) with: "Continue the BUILD-014 Tower completion campaign per the approved brief." It rehydrates from `[[tower-completion-campaign-authorized]]` → the campaign brief → v3.
- Build the campaign in coherent PRs, each QA-lens + risk-tiered reviewed at exact heads before merge with Warwick's yes.

## VlogOps / story signals

- The arc of the session: a review-process *failure* (calling things merge-ready that weren't) → Warwick catching it → the loop being re-oriented → three real bugs found → and the whole thing maturing into an approved architecture. A genuine "the mistake made the system better" story.
- Warwick's *"after me stress testing you last night (sorry lol)"* + Larry's *"thank you, not sorry"* — the collaboration tone.
- The live demo: Warwick pasted a real YouTube URL into Telegram; Larry pulled it off the bot and produced the full Karpathy-format packet from his actual video ("The $1,000/hour Solo AI business", 1,748 segments). Visible, shareable.
- "Octolarry" 🐙; the clickable cockpit artifact; the honest overnight brief; the findings ledger.

## Cross-links

- `[[2026-07-18-22-10_larry_asdair-wp1-and-tower-baton-completion]]` — the prior close checkpoint (Tower-on-baton + AsdAIr WP1).
