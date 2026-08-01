# Wayfinder plan — the operating reset

_2026-08-02. **The single canonical route.** Supersedes the joint proposal (false runtime premise) and folds in the corrected reset inventory + GPT's review of 2026-08-01. Reviewable on git by Warwick and GPT. **Nothing here is executed** — this is a plan, and it stops at clarity._

**Rule 5 (new, Warwick 2026-08-02; scope narrowed after GPT review):** use Wayfinder **only when there is material route uncertainty that must be resolved before safe execution.** NOT for routine or already-understood work — otherwise "complexity" becomes an excuse to plan everything, and VlogOps needs a Wayfinder plan to decide whether it needs a Wayfinder plan. This document is the first application, and a live test of whether Wayfinder actually works.

---

## 1. What is now KNOWN (was the fog; now resolved by verification)

The old "runtime ceiling" was wrong. Verified against current Claude Code (two capability passes + GPT's doc check):
- The main session can run as a restricted agent (its own tool set).
- Specialists have separate tools, permissions, models, hooks and isolated worktrees.
- **PreToolUse fires for MCP tools and can match individual MCP writes.** MCP does NOT bypass gates.
- `deny` rules disable tools; **managed settings take precedence and cannot be loosened** by project or CLI settings.

**Consequence:** native enforcement IS available here. The strongest argument for leaving to Hermes (you need a different runtime to enforce this) is **false**. The joint proposal, whose premise was the opposite, is **SUPERSEDED** — see banner on that file.

## 2. The remaining FOG (what is genuinely still uncertain — this is what the journey resolves, nothing more)

- **F1 — can Larry keep bounded routine git *safely*?** This is FOG, not a settled decision. The intended boundary (Warwick, 2026-08-02) is that Larry retains routine git — the historical problem was never git itself, it was a fresh `claude -p` proof process inheriting Larry's push authority and pushing to main. Phase 1 must **prove** Larry can keep routine git while: spawned proof/recovery/review processes are **git-read-only**; unrelated files are untouchable; protected actions (push/merge protected main, force-push, delete-unique-branch) are gated. If that cannot be proven mechanically, Phase 1 reports **FAILED** — it does NOT fall back to "Larry will behave."
- **F2 — the continuity WRITE journey.** Proven so far: a *manually-prepared* packet is *read* by a fresh session. NOT proven: a normal session automatically derives its *true* final state (focus, latest decision, completed work, next action), persists it at close, and the next session recovers *that*. The `set` step is currently manual. This is the real memory journey and it is unbuilt/unproven.
- **F3 — zero avoidable prompts.** Whether a realistic delegated task runs in auto mode with zero routine prompts, and which edges (destructive ops, secrets, unknown infra) only close with managed settings.

Where the way is already clear (native permissions over a homemade gate; surgical deletion not blind revert; product assets untouched), this plan does not over-map. That over-mapping was the BUILD-018 error.

## 3. The route — a reversible journey; every delete/harden is CONDITIONAL on evidence

**Ordering rule (GPT):** do not delete the old bridge before the new route has carried one real vehicle. Establish the native replacement → prove it → then delete the redundant component.

| Phase | What | Reversible? | Gate to proceed |
|---|---|---|---|
| **0** | This plan on git | yes | Warwick + GPT review the route |
| **1** | **Probe F1** in project-local settings: prove (a) protected/dangerous git (push/merge protected main, force-push, delete-unique, commit-unrelated) is denied silently for everyone, and (b) a spawned proof/recovery/review process **cannot mutate git** while primary Larry keeps routine git. **If unprovable → report FAILED and return the evidence. No behavioural fallback.** | yes (local settings) | Both proven to fire, or FAILED |
| **2** | **Resolve remaining duty ownership.** Git stays with Larry (no orphan). Session-logs + continuity-update remain Larry's (he keeps Write). **Regrowth cap (GPT):** resolve these using existing native or already-built routes wherever possible; any NEW mechanism requires separate evidence that no existing route can satisfy the need. No casual new subsystem. | yes (config) | No duty orphaned; no new subsystem without evidence |
| **3** | **Prove F2** — the full continuity journey: a normal session auto-captures true final state → persists → a fresh session recovers *that update*. Until this passes, `continuity.mjs` = **KEEP PROVISIONALLY** and rotation + fallback recovery are **NOT deleted**. | yes | The automatic write/read journey passes once, live |
| **4** | **Run Warwick's acceptance test** (F3): one realistic delegated task, auto mode; Larry stays available and delegates; specialist implements + tests; count every prompt Warwick receives; **mutation-test the gates** (attempt a denied action, confirm blocked). One avoidable prompt → FAILED, fix the map. | yes | Zero avoidable prompts + gates proven to fire |
| **5** | **Only after 1–4 pass:** prepare the BUILD-018 teardown + `CLAUDE.md` thinning + memory active/historical split as a **reviewable diff on a branch** (nothing landed). Un-park Tower enough for a **bounded Codex review of that REAL diff, run twice, repeatable** (Decision C). Warwick sees the diff and the review. Tower does NOT block the harmless local probes (1–4); it reviews the actual teardown before it lands. | diff prepared, not yet landed | Tower/Codex reviewed the real teardown diff, twice |
| **6** | **Only after the diff is reviewed and the local journey passed in front of Warwick:** integrate the teardown; then harden to managed settings (machine-wide). | integration + machine-wide = last | Diff reviewed + journey passed |

## 4. Decisions — corrected (A–D + git + rule 5)

- **A — yes in principle, deletion deferred to Phase 5** (conditional on the journey). Not sanctioned "from the old inventory."
- **B — REJECTED as written.** No homemade outward-action gate. Use native agent permissions + MCP permission rules + PreToolUse, project-local first.
- **C — yes, bounded.** Tower/Codex reviews the **actual teardown diff before it lands** (Phase 5), run twice, repeatable. Not a standing gate until that's proven.
- **D — delete the GOV footer.** Already dropped from replies.
- **Git — NOT a settled decision; it is F1 (fog).** The *target* is Larry retains bounded routine git (inspect, branch/worktree, commit, push feature branches, prepare integration, tidy) so **Warwick gains zero git responsibility** — but only if Phase 1 proves proof/recovery/review subprocesses are read-only, unrelated files untouchable, and protected actions gated. Reverses the earlier "specialist executes git" overcorrection. Until Phase 1 passes, it is fog, not a decision.
- **Rule 5 — Wayfinder only on material route uncertainty** (narrowed; see top).

## 5. GPT's corrections, folded in explicitly

1. Joint proposal **SUPERSEDED** (false enforcement ceiling) — retained for history only.
2. Decision B **replaced** by a native, project-local permissions proof.
3. Continuity marked **PROVISIONAL** until the automatic write→read journey passes; rotation + fallback recovery retained until then.
4. Larry's **git / session-log / continuity-update** ownership resolved under restricted permissions (Phase 2) — so the first restricted session does not hit a denied tool and stall.
5. Deletion made **conditional** on the reversible lived journey passing first (Phase 5+).
6. "All MCP connectors untouched" **qualified:** connector infrastructure, credentials and data remain untouched; *connector tool access will be explicitly assigned by role* — a real behavioural change, not "untouched."
7. Memory: **preserve all on disk; only the pointer-sized core stays actively loaded.** Distinguish active instructions from preserved history.
8. "0 of 4 rules enforced" is grounds to remove *most* of BUILD-018, **not proof every component is worthless** — e.g. wrong-worktree protection / recovery evidence may add safety outside the four rules. Establish native replacement, prove it, then delete (Phase 5).

**Corrections from GPT's review of the first draft (2026-08-02):**
9. **Behavioural fallback REMOVED.** Phase 1 no longer says "fall back to Larry behaving." If the mechanical route can't be proven, it reports **FAILED** — a promise that Larry will behave is exactly the failure being fixed.
10. **Git is fog, not a decided handoff.** The earlier "specialist executes git" was itself an overcorrection quietly baked into the map. Reframed: target is Larry keeps bounded routine git, *proven safe* in Phase 1 (subprocess read-only + gates), else FAILED.
11. **Rule 5 narrowed** from "genuine complexity" to "material route uncertainty that must be resolved before safe execution" — so it can't become the next compliance monster.
12. **Tower/Codex moved BEFORE the deletion lands** (Phase 5), reviewing the real teardown diff — not after it (was Phase 6).
13. **Phase 2 regrowth-capped:** existing routes first; any new mechanism needs evidence no existing route suffices.

## 6. Where this stops (Wayfinder discipline)

The route to a decision is clear, so the mapping stops here. There are no tickets, no programme, no execution tracker — those were the BUILD-018 mistake. **Nothing is executed.**

**The next action is Warwick's** (a `product-decision`): sanction the *route* (not the deletions), and give the go to run **Phase 1** — the reversible local probe — which needs one Claude Code restart. Deletions (Phase 5) and machine-wide hardening (Phase 6) are sanctioned separately, only after the journey has worked in front of Warwick.

## 7. What Larry got wrong (on the record)

- Overstated `continuity.mjs` — the automatic write journey is unproven; only a manual-packet read was demonstrated. GPT caught it; correct.
- Claimed the runtime ceiling, then over-corrected to "trivially possible." Both were assertions ahead of evidence. Now settled by verification, with F1 still to prove empirically.
- Did not resolve Larry's orphaned duties under restriction. Now Phase 2 (and largely dissolved, since git stays with Larry).
- **Quietly made two unsettled decisions inside the map** (GPT caught both): that a behavioural Larry-delegates fallback was acceptable, and that git leaves Larry. Neither was settled. Both corrected — behavioural fallback removed (FAILED instead), git-retention reframed as F1 fog to prove. A Wayfinder map must not smuggle in decisions as if they were settled route.
