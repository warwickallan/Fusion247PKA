# Overnight Decision Brief — 2026-07-20 (Larry → Warwick)

One brief for the morning. Auto-merge trial **paused**. **IMPORTANT correction (you caught this):** the feature PRs had NOT been through the independent Codex+Fable loop when I first called them "queued" — that was wrong, and I've since run every one properly. The loop **caught real bugs Mack's tests missed.** Banked as a hard rule ([[merge-ready-means-independently-reviewed]]).

## REVIEW-CORRECTION STATUS (the accurate, post-review picture)
| PR / branch | Real status now |
|---|---|
| **#48 asdair normaliser FIXES** | ✅ **MERGE-READY** — fixes the `"milk x2 x3"` mis-quantify + qty-bound + word-number bugs the review caught in #44; Fable executed-APPROVE, Codex dissent adjudicated (fail-safe). **Merge this to correct #44 which is already on main.** |
| **#47 tubeair watcher (+ backoff)** | ✅ **MERGE-READY** — the review caught it would hammer YouTube (~2880 req/day → IP-block); backoff added + Fable execution-proved (stuck video = exactly 5 fetches then 0). |
| **#45 asdair ranker** | ✅ **MERGE-READY** — both reviewers caught a real category-**union** bug (a juice line's stale hint surfaced cola at rank 1); fixed (true fallback chain + 4 folds), Fable execution-re-APPROVED (61/61 + 45 probes, cola regression passes), Codex's residual degenerate-data findings adjudicated EDGE/ACCEPT. Branch `295eafc`. |
| **#44 asdair normaliser** | ⚠️ on main WITH the bugs; #48 is its fix-forward. |
| **#46 tubeair cleanup** | ⚠️ **Codex-only, Fable PENDING (session limit hit ~04:00, resets 04:40)** — NOT merge-ready. Codex (static, couldn't execute) flags a possible dedup *over-collapse* (a caption starting with the prior one's last word could lose it) — needs Fable's executed confirm. |
| **multimodal intake (573ae37)** | ⚠️ **Codex-only, Fable PENDING** — NOT merge-ready. Codex confirmed security ordering is correct (allowlist + private-chat before content); its other findings are **before-live privacy items** that only bite when `acceptMultimodal` is ON + wired live (flag is default-OFF) → LATENT, not current blockers — but unadjudicated without Fable. |
| **#33 doc (SOP-019)** | Governance doc → your review (Larry-read: valid Foundry-vs-build boundary). |

**Session limit reached ~04:00 (resets 04:40am Europe/London).** The two Fable reviews above were cut off mid-run, so #46 + multimodal are honestly incomplete — resume their Fable pass after the reset before calling either merge-ready.
| **#43 WP-D cockpit proof** | Vex-cleared (infra/security); add Codex+Fable if you want the full set. |

Net: nothing merged overnight; **#47 + #48 are genuinely merge-ready for your yes**; the rest are honestly mid-review. Detail of the original items below (some now superseded by the above).

---

Nothing merged overnight except the one item that landed before the pause. Everything else is **merge-ready / decision-ready and waiting for you** — with the corrected review status above taking precedence over the pre-review table further down.

---

## 1. What got done (DEV-only, reversible)
- **TubeAIR URL-validation security fix — MERGED** (PR #42, before the pause). Fable executed 44/44 + a 55-case adversarial probe (37 hostile inputs rejected, 10 valid resolve); 0 merge-blockers.
- **Two AsdAIr product features built + PR'd** (queued): alternative-suggestion ranker (#45) and raw-list normaliser (#44).
- **WP-D cockpit proof (inc-1)** built + Vex-approved + PR'd (#43).
- **TubeAIR transcript cleanup** — built + PR'd (#46): dedupe rolling captions + reflow, raw transcript untouched, 64 tests green (+20).
- **Portfolio reconciliation sweep** (BUILD-000/002/005, fusion-health #5) + **BUILD-003 decision packet** — below.
- **Recovered a shared-worktree agent-collision incident** — no work lost; root cause + rule banked (parallel builders now always isolated).

## 2. Merge queue — your approvals (nothing merges without you)
| PR | What | Verdict | Note |
|---|---|---|---|
| #43 | WP-D cockpit proof (inc-1) | Vex APPROVE | Before-live: give Directus a least-privilege DB role (not superuser) before it leaves localhost. |
| #44 | AsdAIr raw-list normaliser | 30/30 tests, new feature | Pure/synthetic; keyless half of parked-B. |
| #45 | AsdAIr alternative ranker | +11 tests, 0 regression | Suggestion-only (never auto-substitutes). Flags: `products` has no `price` column; `alternatives` is an additive output-contract change. |
| #33 | SOP-019 Foundry-vs-build boundary | Refreshed onto main, clean | Governance doc → your review. |
| #46 | TubeAIR transcript cleanup | 64 tests green (+20), new feature | Raw transcript untouched (GL-011 immutable); cleaned view added alongside. |

**Decision:** approve/merge each (I can merge on your yes with SHA guards), or tell me to resume the auto-merge trial.

## 3. Reconciliation & closures (proposals — your call where authority/scope is involved)
- **BUILD-000 → confirmed CLOSED.** Every WS-005 acceptance criterion maps to merged PR #23 evidence; Git + myPKA already record it closed. **Only lag:** the ClickUp mirror (its MCP was disconnected during closure) — a 4-field paste when ClickUp's up. **Hygiene:** prune the stale merged branch `codex/build-000-assimilation`.
- **BUILD-002 → proposed record reconcile** (I did NOT edit it — it touches authority framing). The record says *"Only WP0 authorised,"* but PR #29 (live-integration), #31 (WP1 "Always-On Cloud Intake Foundation"), and #37 (FU-1/L-1 trust-anchor CLOSED) all merged. **Proposed:** WP0 row → add #29 + #37 (live phone-cutover still pending); WP1 row → rename to "Always-On Cloud Intake Foundation", status Planned → dev-proven & merged (PR #31), live cutover separately gated. **Your confirm on the authorisation framing.**
- **fusion-health PR #5 (canonical weight preview) → propose close-as-superseded** by PR #8 (v0.16 unified dashboard). You held it open by instruction, so it's your call; capture the `CanonicalWeight` logic as a parked artifact under the deferred Withings/scale block.
- **PR #24 (WS-004 Team Retro) → your review, not autonomous.** Overlaps #33 on SOP-019, also edits Larry's `AGENTS.md` + SOP-004 + SOP-close-task, and its `mypka.db` is stale (142 behind — needs regen post-rebase). Sequence **after** #33 merges: rebase, reconcile the SOP-019 overlap, you approve the AGENTS.md/SOP changes, then regen `mypka.db`.

## 4. BUILD-003 schema decision
Packet prepared: `Deliverables/2026-07-20-build-003-schema-decision-packet.md`. Issue #17 is now **unblocked** (its dependency #16 closed via PR #18). 7 open questions; the natural first decision is **#2 (build the synthetic engagement y/n)** — decisions 1/3/7 gate on it. No recommendation made (per boundary).

## 5. Decisions bundled for you (the morning list)
1. Approve the merge queue (§2) — and: resume auto-merge trial, or keep it paused?
2. BUILD-002 record reconcile framing (§3) — approve proposed text?
3. fusion-health PR #5 — close as superseded, or keep parked-open?
4. BUILD-003 — authorise issue #17 / decide question #2 (§4)?
5. PR #24 — when to sequence (after #33) + approve its AGENTS.md/SOP edits?
6. ClickUp mirror updates for BUILD-000/002 (when ClickUp's reachable).

## 6. Parked / preserved / follow-ups
- Before-live hardening WIP preserved at `60bf97b` (control-plane DB-structural triggers + sequence key) — not lost, deferred as "product over admin."
- WP-D inc-2 (CRUD + command_request + outage) — needs the stateful Directus/PG stack; run with you around, not unattended.
- 2nd-wave features (AsdAIr explain-trace #3, TubeAIR chapters #5) — wait for their same-file predecessors to merge.
- Follow-up: pre-existing `tubeair_inbox.py` uncaught-ValueError aborts a batch on a contrived uppercase link (not introduced by #42).
- Stale merged branches to prune (batch): `codex/build-000-assimilation` + others.
