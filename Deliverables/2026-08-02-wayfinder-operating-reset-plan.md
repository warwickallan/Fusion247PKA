# Wayfinder plan — the operating reset

## START / RESUME HERE — ordered by Warwick

- This Git Wayfinder is the sole route and source of truth.
- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- Read the current phase, gate and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer.
- Continue autonomously until completion or a genuine Warwick-only blocker.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate and next action.

## Phase status (durable — the tracker; update ONLY at a phase boundary: PASS / PARTIAL / FAILED + evidence)

- **Phase 0 — plan on git — PASS** (Warwick reviewing live).
- **Phase 1 — F1a bounded git + F1b thin-Larry edit asymmetry — PASS.** Restricted Larry blocked from editing while a specialist performed + reversed the edit (objective file checks). Evidence: `Deliverables/2026-08-02-phases-2-4-evidence.md`.
- **Phase 2 — duty ownership under restriction — PASS.** Git + continuity via Larry's Bash routes; session-logs via delegation; no general Write retained.
- **Phase 3 — F2 automatic continuity journey — PASS.** Session-end auto-derive → Honcho → fresh session recovered it (ACME-TEAL-42 write→fresh-read round trip). Fix: recursion guard + SessionEnd `timeout:120`, commit `bb88771`. **Automatic staple PROVEN:** a fresh session that opens this map auto-derives a Honcho packet carrying this exact git path with no manual `set` (proven, packet session `c9ee48cd`). **Visible orient-first on resume PROVEN:** with the START/RESUME orient-first rule + the injected Honcho brief, a real thin-Larry session (real tools) given only `continue` visibly states map path + goal + phase/gate + next action BEFORE any tool call, then opens the map (proven — main session `e23be9af`; its first assistant message is the orientation, no tool_use precedes it). **Known Phase-3 follow-up (found 2026-08-02, not yet fixed — stop-clean, no code change this session):** Honcho `messages/list` returns ≤50 items (even at `size:500`) and, once the session holds >50 packets, may exclude the newest — so `readLatest` can surface a slightly-stale packet. Recovery still holds because that packet carries the git-map pointer and the map is authority (open-map-first self-corrects), but `continuity.mjs listMessages` should paginate/reverse to fetch the true newest. Next session: fix this, and never let a stale Honcho brief override the map.
- **Phase 4 — F3 acceptance test — PASS.** Part 1: realistic task fully delegated under thin-Larry, specialist implemented + tested (5/5, assertions mutation-checked); after fixing the map (`Bash(node --test:*)` allow-rule) the re-run had **zero prompts reaching Warwick**. Part 2: gate mutation-test in an isolated scratch repo — ordinary git ran, `git push --force` was **DENIED by the permission layer before execution**. Zero avoidable prompts + gate proven to fire. Evidence: this session; `out/phase4-demo/`.
- **Phase 5 — teardown review candidate — NOT STARTED (decision recorded 2026-08-02; execute on next resume; no Phase 5 code/teardown/review changes were made in the recording session).**
  - **Decision (Warwick):** Phase 5 will prepare the **full review candidate — including proposed CLAUDE.md and footer changes** — as one reviewable branch diff; **preserve the proven continuity behaviour until any replacement is runtime-proven**; make the **`Deliverables/`-sweep trade-off explicit** (that sweep, and programme-state recovery, are performed by `reorient.mjs` and are lost when it is retired); and obtain **independent Codex/Tower review before integration**. Integrate nothing until Warwick decides. **Footer / Decision D — KEEP + REPAIR, NOT bin** (Warwick 2026-08-02: the ⟦GOV⟧ block is useful and correctly placed): the review candidate **preserves** the footer's useful signal — state, continue/rotate advice, and a **model-AND-effort recommendation for the phase ahead** (the governor must advise both model and effort for the next phase, not just a model) — and **repairs** the context-% indicator, which is BLIND because its only data source is the terminal `statusLine` (`statusline-live.mjs`) that never runs on Warwick's web/Android clients → re-source it client-independently (e.g. token count from the transcript/session, sampled by a hook that fires everywhere). Trim only genuine per-reply telemetry noise. Do NOT modify any `AGENTS.md` (hard rule). Resume per ledger `2026-08-01-reset-inventory-keep-bin-reallocate.md` §C/§F under these constraints.
- **Phase 6 — integrate, then managed-settings hardening — pending.**

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

- **F1 — the mechanical Larry boundary. TWO separate questions, both must be proven or Phase 1 is FAILED.** (GPT caught that fixing the git overcorrection had quietly let the second one slip to behavioural — the exact loophole behind the original problem.)
  - **F1a — bounded git, safely.** Larry keeps routine git (inspect, branch/worktree, commit, push feature branches, integrate, tidy) — the historical break was a fresh `claude -p` proof process inheriting push authority, not git itself. Prove: proof/recovery/review processes are **git-read-only**; unrelated files untouchable; protected actions (push/merge protected main, force-push, delete-unique-branch) gated.
  - **F1b — mechanical thin-Larry.** Larry's **general implementation capability (Edit/Write/arbitrary Bash) is mechanically restricted** while the correct specialist retains it. Larry keeps only a **narrow route** for session-logs and continuity-updates — he does NOT retain general Write/Edit/Bash merely because those two duties exist. Observing Larry delegate once (Phase 4) is behavioural, NOT proof he can't start editing on the next task; this must be mechanical.
  - If **either** separation cannot be achieved cleanly, Phase 1 reports **FAILED** and returns the evidence. No behavioural fallback.
- **F2 — the continuity WRITE journey.** Proven so far: a *manually-prepared* packet is *read* by a fresh session. NOT proven: a normal session automatically derives its *true* final state (focus, latest decision, completed work, next action), persists it at close, and the next session recovers *that*. The `set` step is currently manual. This is the real memory journey and it is unbuilt/unproven.
- **F3 — zero avoidable prompts.** Whether a realistic delegated task runs in auto mode with zero routine prompts, and which edges (destructive ops, secrets, unknown infra) only close with managed settings.

Where the way is already clear (native permissions over a homemade gate; surgical deletion not blind revert; product assets untouched), this plan does not over-map. That over-mapping was the BUILD-018 error.

## 3. The route — a reversible journey; every delete/harden is CONDITIONAL on evidence

**Ordering rule (GPT):** do not delete the old bridge before the new route has carried one real vehicle. Establish the native replacement → prove it → then delete the redundant component.

| Phase | What | Reversible? | Gate to proceed |
|---|---|---|---|
| **0** | This plan on git | yes | Warwick + GPT review the route |
| **1** | **Probe F1** in project-local settings. Prove **F1a**: protected/dangerous git denied silently for all, and proof/recovery/review processes cannot mutate git while primary Larry keeps routine git. Prove **F1b**: Larry's general Edit/Write/arbitrary-Bash is mechanically restricted while the correct specialist retains it, with only a narrow log/continuity route left to Larry. **If either is unprovable → report FAILED and return the evidence. No behavioural fallback.** | yes (local settings — backed up + restore route recorded first) | **Both** F1a and F1b proven to fire, or FAILED |
| **2** | **Resolve remaining duty ownership.** Git stays with Larry (proven in F1a). Session-logs + continuity-update run through a **narrow purpose-specific route** for Larry (proven in F1b) — NOT retained general Write. **Regrowth cap (GPT):** use an existing/already-built route first (e.g. `continuity.mjs`'s own `set`); any NEW mechanism requires separate evidence that no existing route can satisfy the need. | yes (config) | Duties owned via narrow routes; no general Write retained; no unjustified new subsystem |
| **3** | **Prove F2** — the full continuity journey: a normal session auto-captures true final state → persists → a fresh session recovers *that update*. Until this passes, `continuity.mjs` = **KEEP PROVISIONALLY** and rotation + fallback recovery are **NOT deleted**. | yes | The automatic write/read journey passes once, live |
| **4** | **Run Warwick's acceptance test** (F3): one realistic delegated task, auto mode; Larry stays available and delegates; specialist implements + tests; count every prompt Warwick receives; **mutation-test the gates** (attempt a denied action, confirm blocked). One avoidable prompt → FAILED, fix the map. | yes | Zero avoidable prompts + gates proven to fire |
| **5** | **Only after 1–4 pass:** prepare the BUILD-018 teardown + `CLAUDE.md` thinning + memory active/historical split as a **reviewable diff on a branch** (nothing landed), **prepared against the detailed ledger [`2026-08-01-reset-inventory-keep-bin-reallocate.md`](2026-08-01-reset-inventory-keep-bin-reallocate.md)** (the file/hook/workflow coupling map), applying this plan's corrections. Un-park Tower enough for a **bounded Codex review of that REAL diff, run twice, repeatable** (Decision C). Warwick sees the diff and the review. Tower does NOT block the harmless local probes (1–4); it reviews the actual teardown before it lands. | diff prepared, not yet landed | Tower/Codex reviewed the real teardown diff, twice |
| **6** | **Only after the diff is reviewed and the local journey passed in front of Warwick:** integrate the teardown; then harden to managed settings (machine-wide). | integration + machine-wide = last; managed file backed up + restore route recorded first | Diff reviewed + journey passed |

**Config reversibility (MANDATORY — Warwick, 2026-08-02).** Git restores committed code, but `.claude/settings.local.json` is **gitignored** and managed settings live **outside the repo**. So before Phase 1 edits local settings, or Phase 6 writes managed settings, that phase MUST first: (1) copy the current file to a **timestamped backup**, and (2) record the **exact one-command restore route** (path + command) in the phase's evidence, *before* the change. Live machine configuration must be as reversible as the code — restored by a recorded command, never reconstructed after the fact. This gap (config not travelling with git) has bitten before.

## 4. Decisions — corrected (A–D + git + rule 5)

- **A — yes in principle, deletion deferred to Phase 5** (conditional on the journey). Not sanctioned "from the old inventory."
- **B — REJECTED as written.** No homemade outward-action gate. Use native agent permissions + MCP permission rules + PreToolUse, project-local first.
- **C — yes, bounded.** Tower/Codex reviews the **actual teardown diff before it lands** (Phase 5), run twice, repeatable. Not a standing gate until that's proven.
- **D — delete the per-reply footer NOISE, PRESERVE the useful signal (revised, Warwick 2026-08-02).** The per-reply telemetry is gone. But keep the one capability BUILD-018 got right and Warwick valued: a **proactive "safe to clear / rotate now" nudge** plus the **context-% indicator** (it worked, and he can't see the statusline on his phone). Deliver it **event-driven** — surfaced when context approaches the threshold — NOT stapled to every reply. Noise deleted; the safe-to-clear signal kept, moved out of the message stream into a proactive nudge.
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
14. **Config reversibility made explicit (Warwick, 2026-08-02):** before editing gitignored `.claude/settings.local.json` or out-of-repo managed settings, preserve the previous file (timestamped) and record the exact restore route first. Live config must be as reversible as code — git does not cover these files.

**Second review corrections (2026-08-02):**
15. **Mechanical thin-Larry restored (GPT).** Fixing the git overcorrection had let thin-Larry slip to behavioural. F1 now proves BOTH F1a (bounded git safely) AND F1b (Larry's general implementation mechanically restricted, specialists retain it, only a narrow log/continuity route left to Larry) — else Phase 1 FAILED. One observed delegation is not proof.
16. **Phase 5 bound to the teardown ledger** `2026-08-01-reset-inventory-keep-bin-reallocate.md` — the diff is prepared against that detailed coupling map.
17. **Decision D revised (Warwick):** keep the genuinely useful BUILD-018 capability — the proactive safe-to-clear suggestion + context-% indicator — event-driven, not a per-reply footer. Delete only the noise.

## 6. Where this stops (Wayfinder discipline)

The route to a decision is clear, so the mapping stops here. There are no tickets, no programme, no execution tracker — those were the BUILD-018 mistake. **Nothing is executed.**

**The next action is Warwick's** (a `product-decision`): sanction the *route* (not the deletions), and give the go to run **Phase 1** — the reversible local probe — which needs one Claude Code restart. Deletions (Phase 5) and machine-wide hardening (Phase 6) are sanctioned separately, only after the journey has worked in front of Warwick.

## 7. What Larry got wrong (on the record)

- Overstated `continuity.mjs` — the automatic write journey is unproven; only a manual-packet read was demonstrated. GPT caught it; correct.
- Claimed the runtime ceiling, then over-corrected to "trivially possible." Both were assertions ahead of evidence. Now settled by verification, with F1 still to prove empirically.
- Did not resolve Larry's orphaned duties under restriction. Now Phase 2 (and largely dissolved, since git stays with Larry).
- **Quietly made two unsettled decisions inside the map** (GPT caught both): that a behavioural Larry-delegates fallback was acceptable, and that git leaves Larry. Neither was settled. Both corrected — behavioural fallback removed (FAILED instead), git-retention reframed as F1 fog to prove. A Wayfinder map must not smuggle in decisions as if they were settled route.
