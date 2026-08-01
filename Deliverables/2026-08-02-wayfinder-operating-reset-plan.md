# Wayfinder plan — the operating reset

_2026-08-02. **The single canonical route.** Supersedes the joint proposal (false runtime premise) and folds in the corrected reset inventory + GPT's review of 2026-08-01. Reviewable on git by Warwick and GPT. **Nothing here is executed** — this is a plan, and it stops at clarity._

**Rule 5 (new, Warwick 2026-08-02):** wherever there is genuine complexity, Wayfinder the plan to git *before* acting, so the route is reviewable and no one relies on Larry's context. This document is the first application of Rule 5, and a live test of whether Wayfinder actually works.

---

## 1. What is now KNOWN (was the fog; now resolved by verification)

The old "runtime ceiling" was wrong. Verified against current Claude Code (two capability passes + GPT's doc check):
- The main session can run as a restricted agent (its own tool set).
- Specialists have separate tools, permissions, models, hooks and isolated worktrees.
- **PreToolUse fires for MCP tools and can match individual MCP writes.** MCP does NOT bypass gates.
- `deny` rules disable tools; **managed settings take precedence and cannot be loosened** by project or CLI settings.

**Consequence:** native enforcement IS available here. The strongest argument for leaving to Hermes (you need a different runtime to enforce this) is **false**. The joint proposal, whose premise was the opposite, is **SUPERSEDED** — see banner on that file.

## 2. The remaining FOG (what is genuinely still uncertain — this is what the journey resolves, nothing more)

- **F1 — main-agent lock mechanism.** The exact way to strip Edit/Write/Bash from *Larry* while specialists keep them (a restricted main-agent definition vs settings scope) is not yet confirmed empirically. Needs a probe.
- **F2 — the continuity WRITE journey.** Proven so far: a *manually-prepared* packet is *read* by a fresh session. NOT proven: a normal session automatically derives its *true* final state (focus, latest decision, completed work, next action), persists it at close, and the next session recovers *that*. The `set` step is currently manual. This is the real memory journey and it is unbuilt/unproven.
- **F3 — zero avoidable prompts.** Whether a realistic delegated task runs in auto mode with zero routine prompts, and which edges (destructive ops, secrets, unknown infra) only close with managed settings.

Where the way is already clear (native permissions over a homemade gate; surgical deletion not blind revert; product assets untouched), this plan does not over-map. That over-mapping was the BUILD-018 error.

## 3. The route — a reversible journey; every delete/harden is CONDITIONAL on evidence

**Ordering rule (GPT):** do not delete the old bridge before the new route has carried one real vehicle. Establish the native replacement → prove it → then delete the redundant component.

| Phase | What | Reversible? | Gate to proceed |
|---|---|---|---|
| **0** | This plan on git | yes | Warwick + GPT review the route |
| **1** | **Probe F1** in project-local settings: prove Larry loses Edit/Write/Bash while a specialist keeps them. If no clean lock exists → fall back to behavioural Larry-delegates + hard-gated dangerous actions. | yes (local settings) | Larry-restriction mechanism resolved either way |
| **2** | **Resolve Larry's orphaned duties under restriction** (GPT correction 4), BEFORE any restricted session runs: git → bounded specialist/integration route (Larry owns the decision, not the keystrokes); session-logs → delegated or one narrow purpose-built capability; continuity-update → a bounded mechanism available to restricted Larry (NOT restored general file/shell access). | yes (config) | No duty left that would hit a denied tool |
| **3** | **Prove F2** — the full continuity journey: a normal session auto-captures true final state → persists → a fresh session recovers *that update*. Until this passes, `continuity.mjs` = **KEEP PROVISIONALLY** and rotation + fallback recovery are **NOT deleted**. | yes | The automatic write/read journey passes once, live |
| **4** | **Run Warwick's acceptance test** (F3): one realistic delegated task, auto mode; Larry stays available and delegates; specialist implements + tests; count every prompt Warwick receives; **mutation-test the gates** (attempt a denied action, confirm blocked). One avoidable prompt → FAILED, fix the map. | yes | Zero avoidable prompts + gates proven to fire |
| **5** | **Only after 1–4 pass:** surgically delete the redundant BUILD-018 components; thin `CLAUDE.md` to a pointer core (four rules + current focus + routing index); split memory into *active* vs *preserved-historical* (GPT: don't leave stale doctrine actively loaded). | deletion = last, reversible via git | Native replacements proven in 1–4 |
| **6** | **Only after the local journey passes in front of Warwick:** harden to managed settings (machine-wide); un-park Tower for the bounded Codex proof, run it twice on a real diff. | machine-wide = last | Local journey demonstrably worked |

## 4. Decisions — corrected (A–D + git + rule 5)

- **A — yes in principle, deletion deferred to Phase 5** (conditional on the journey). Not sanctioned "from the old inventory."
- **B — REJECTED as written.** No homemade outward-action gate. Use native agent permissions + MCP permission rules + PreToolUse, project-local first.
- **C — yes, bounded (Phase 6).** Not a standing gate until a real diff reaches Codex twice, repeatably.
- **D — delete the GOV footer.** Already dropped from replies.
- **Git — option (ii):** a bounded specialist executes git; Larry coordinates the outcome and integrates. Cleanest proof Larry stays orchestrator.
- **Rule 5 — Wayfinder-to-git for complexity** (this document).

## 5. GPT's corrections, folded in explicitly

1. Joint proposal **SUPERSEDED** (false enforcement ceiling) — retained for history only.
2. Decision B **replaced** by a native, project-local permissions proof.
3. Continuity marked **PROVISIONAL** until the automatic write→read journey passes; rotation + fallback recovery retained until then.
4. Larry's **git / session-log / continuity-update** ownership resolved under restricted permissions (Phase 2) — so the first restricted session does not hit a denied tool and stall.
5. Deletion made **conditional** on the reversible lived journey passing first (Phase 5+).
6. "All MCP connectors untouched" **qualified:** connector infrastructure, credentials and data remain untouched; *connector tool access will be explicitly assigned by role* — a real behavioural change, not "untouched."
7. Memory: **preserve all on disk; only the pointer-sized core stays actively loaded.** Distinguish active instructions from preserved history.
8. "0 of 4 rules enforced" is grounds to remove *most* of BUILD-018, **not proof every component is worthless** — e.g. wrong-worktree protection / recovery evidence may add safety outside the four rules. Establish native replacement, prove it, then delete (Phase 5).

## 6. Where this stops (Wayfinder discipline)

The route to a decision is clear, so the mapping stops here. There are no tickets, no programme, no execution tracker — those were the BUILD-018 mistake. **Nothing is executed.**

**The next action is Warwick's** (a `product-decision`): sanction the *route* (not the deletions), and give the go to run **Phase 1** — the reversible local probe — which needs one Claude Code restart. Deletions (Phase 5) and machine-wide hardening (Phase 6) are sanctioned separately, only after the journey has worked in front of Warwick.

## 7. What Larry got wrong (on the record)

- Overstated `continuity.mjs` — the automatic write journey is unproven; only a manual-packet read was demonstrated. GPT caught it; correct.
- Claimed the runtime ceiling, then over-corrected to "trivially possible." Both were assertions ahead of evidence. Now settled by verification, with F1 still to prove empirically.
- Did not resolve Larry's orphaned duties under restriction. Now Phase 2, before any restricted session.
