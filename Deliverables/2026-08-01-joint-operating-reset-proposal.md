> **⛔ SUPERSEDED 2026-08-02 — based on an INCORRECT assessment of Claude Code's enforcement capabilities.**
> Its governing premise (only Rule 2 enforceable · MCP writes bypass hooks · Larry's own tools can't be restricted · Rule 4 needs Hermes) is **FALSE** against the current runtime: the main session can be a restricted agent, PreToolUse fires on MCP writes, deny rules disable tools, managed settings take precedence. The false ceiling shapes sections 0, 1, 3 and 6, so this is not patchable — it is retained for history only.
> **Canonical route: [2026-08-02-wayfinder-operating-reset-plan.md](2026-08-02-wayfinder-operating-reset-plan.md).**

# Joint operating-reset proposal — Larry + Nolan + Pax + Keel

_2026-08-01. Synthesis of four same-model analyses. **This is a proposal to Warwick, not an executed change.** Nothing is deleted, edited, or wired until Warwick accepts it. No build, no programme, no tickets, no new governance._

Source briefs (detail lives there, not duplicated here):
- `2026-08-01-pax-mypka-systemic-rca.md` — root cause
- `2026-08-01-pax-hermes-vs-mypka-decision.md` — Hermes vs myPKA
- `2026-08-01-nolan-roles-and-durable-instructions.md` + `2026-08-01-nolan-contracts-free-larry.md` — roles/contracts
- `2026-08-01-pax-reset-challenge.md` — adversarial challenge
- Keel's BUILD-018 teardown map (delivered by message; persisted in §2 below)

---

## 0. The one honest finding that governs everything

**In the Claude Code runtime, only ONE of the four rules can be externally enforced — Rule 2, and even that leaks.** A `PreToolUse` deny hook can reliably block a Bash `git push`/merge, but it is **blind to the connector surface**: an MCP write (Supabase `apply_migration`, a GitHub-MCP merge, Zapier) bypasses it entirely. Rules 1, 3 and 4 remain **prose the agent polices on itself** — and the rule against self-certification is itself self-certified.

**Rule 4 ("orchestrator not executor, via tool/capability boundaries") is not achievable here at all** — the orchestrator process holds Edit/Write/Bash and cannot remove its own tools. That is a *runtime property*, not a prompt. So is "an owner that runs without Larry." **Both are exactly what Hermes supplies and Claude Code does not.**

Decision consequence: the reset below is worth doing regardless — it removes the admin monster by subtraction and keeps the working assets — **but it buys "much less admin + honest labels + one leaky gate," not "durable/enforced."** True enforcement of Rules 3 and 4 is a *runtime* decision (Hermes), for which this strip is the prerequisite either way.

---

## 1. The four rules — enforceability, honestly

| Rule | Enforceable here? | How, and the catch |
|---|---|---|
| **1. Warwick's outcome > maintenance** (maintenance only on explicit "Enter maintenance mode") | **Prose only** | No mechanism. But it is the single most important rule — every failure today was a request amplified into maintenance. Larry adopts it as first priority. |
| **2. External gate on outward/irreversible actions** | **Partly** | A real `PreToolUse` deny works for Bash git push/merge/spend. **Leaks on MCP/connector writes.** Must be *shown firing*, not assumed. |
| **3. Consequential claims need external evidence, else BUILT-NOT-VERIFIED / PARTIAL / FAILED** | **Prose + a proof gate** | Hard cap (Pax): evidence = **real output pasted in the same message**; the labels are words Warwick reads, **never machine-managed fields**. The different-model gate (Codex) is the teeth — but unproven (see §4). |
| **4. Larry orchestrator not executor, via capability boundaries** | **No — aspirational here** | Cannot remove Larry's own tools in this runtime. Stays discipline until a runtime enforces it (Hermes). The *behavioural* half (thin Larry, offload duties) is done via §3. |

**Regrowth warning (Pax):** Rule 3 is the monster's most likely comeback — a "taxonomy" invites validator → store → parser → registry, which is exactly how BUILD-018 grew. Keep evidence as pasted output and labels as words. Rule 4 risks rebuilding the `delegation-gate` retired today. **If the response to any rule is to *build* something, the diagnosis was rejected.**

---

## 2. BUILD-018 — keep / delete map (Keel)

**Verdict: bin almost all of it. It currently enforces nothing (status `complete`; hooks inert without an active programme). Against the four rules it scores 0/4.** Binning loses no enforcement.

**KEEP (load-bearing):**
- `tools/governor/continuity.mjs` — standalone Honcho read/write (zero governor imports). **This is the one asset serving the memory pain.** Lived test already passed once this session (a fresh `claude -p "continue"` received VlogOps + the BUILD-018 episode from Honcho); re-prove after the hook re-point below.

**KEEP ONLY IF the phone footer is wanted (a set — no half-deletes):** `statusline-live.mjs` + `footer.mjs` + `sampler.mjs` + `evaluator.mjs` + `health-store.mjs`. `footer.mjs` also holds the frozen `HANDBACK_CODES` literal the constitution references.

**DELETE (spine that serves only BUILD-*/rotation, 0/4 rules):** `reorient.mjs` (after re-hosting the Honcho read), `stop-controller.mjs` (blocks turn-*end* — the "won't let go" trap; not an outward gate), `worktree-guard.mjs` (gates *location*, inert — **harvest its Bash classifier first if building the Rule-2 gate**), `atomic-write.mjs`, `programme-state.*`, `rotate-session.mjs`, `collect-state.mjs`, `worktree-recon.mjs`, `install-hooks.mjs`, `fixtures/`, `.claude/commands/rotate-session.md`, and their tests.

**ALREADY GONE (removed at closure):** model-gate, delegation-gate, escalation-gate, build-registry, qa-binding, merge-readiness, programme-pr, status-line. Nothing to do.

**Method: surgical deletion + hand-edit of the gitignored `.claude/settings.local.json` — NOT `git revert`** (revert can't touch the gitignored hooks, and the Honcho commit `421053b` is interleaved with the constitution edits — a range-revert would take both). Couplings that break if a file is deleted without a matching settings edit: SessionStart→`reorient.mjs`, Stop→`stop-controller.mjs`, PreToolUse→`worktree-guard.mjs`, statusLine→`statusline-live.mjs`, plus `.github/workflows/governor-tests.yml` (goes red on deleted tests), plus **`CLAUDE.md`/`AGENTS.md` name `stop-controller.mjs`/`footer.mjs`** (coordinated constitution edit — Nolan's lane, not Keel's).

**The single protective step:** before deleting anything, re-point the SessionStart hook `reorient.mjs` → `continuity.mjs read`, and verify a fresh session still receives the continuity brief.

---

## 3. Roles — thin Larry, no hire (Nolan)

**No new hire. Silas must NOT absorb Larry's duties** (that creates the exact Larry/Silas crossover to avoid). Of 15 recurring duties: **8 automate, 2 delete, 2 become gates, 3 stay with Larry (pure orchestration), 0 need a new person.**

- **Devbot / "finished" pings → wire to the event, don't remember.** Deterministic notifier (Mack-maintained if a human owner is wanted). This *is* Rule 4 in miniature: Larry **loses the job** rather than promising to recall it.
- **Tower/Codex pre-merge → an external merge-blocking gate**, not something Larry invokes from memory — its value is independence a same-model persona can't give.
- **Git stays with Larry** (integration *is* orchestration) but its labour automates → only a *decision* remains; the *authorisation* stays Warwick.
- **Named team off the boot path:** contracts load on dispatch, not read every session. ~18 contracts read each boot for mostly-never-dispatched specialists is pure read-tax.
- **Residual Larry = three things:** talk to Warwick, route/integrate, own git (after verification). Memory is a *tool* (Honcho). Verification is a *different model*.

**Acid test for "owner" (Pax):** an owner must be a thing that **runs without Larry** (event/cron/external/separate runtime). A specialist that exists only when Larry dispatches it is Larry-as-executor renamed — again a runtime property Hermes supplies and Claude Code does not.

---

## 4. The verification gate (Codex/Tower) — do NOT trust until proven NOW

Rule 3's teeth is a **different-model** gate. Current reality (Pax):
- Codex QA runs through Tower's `mergeCheck.mjs`, and **Tower is PARKED** — a standing gate requires un-parking it (Warwick's decision).
- Must be proven before Rule 3 leans on it: (1) a **live end-to-end mergeCheck today**; (2) the diff **actually staged into Codex's prompt** (Windows read-only can't self-read — an empty-diff review is worse than none); (3) **repeatable on demand**.
- **Fable cannot be the standing gate** (confirm-first hardlock).
- If "external evidence" silently means "Codex signed off" while Codex can't be evoked, Rule 3 becomes BUILD-018's zero-firings failure rebuilt.

---

## 5. The lived acceptance test (unchanged from GPT's proposal, endorsed)

- Warwick opens a fresh session, types only `continue`.
- Larry recovers VlogOps + the BUILD-018 episode as the next action (Honcho read). **Already demonstrated once this session.**
- Larry routes substantive work and stays available; **no maintenance begins**; startup makes **no mutations**; **no consequential claim is self-certified**; **no protected outward action bypasses its gate.**

---

## 6. What we recommend, and what needs Warwick's decision

**Recommended (all subtraction, reversible):**
1. Re-point the SessionStart hook to `continuity.mjs read`; re-prove the boot test.
2. Delete the BUILD-018 spine per §2; hand-edit the gitignored settings; retire/narrow the CI workflow.
3. Thin `CLAUDE.md` to a pointer core (four rules + current-focus record + compact routing index); remove dangling module references; contracts load on dispatch.
4. Wire the pings to events; make pre-merge a merge-blocking gate.
5. Collapse Larry to the three residual duties.

**Needs an explicit Warwick decision (we do NOT proceed without it):**
- **A. Bin BUILD-018 and thin the constitution?** (edits `CLAUDE.md`; deletes code.)
- **B. Build the one small Rule-2 outward-action gate?** (New code — tiny, but new; and it leaks on MCP writes. Only real enforcement myPKA can add.)
- **C. Un-park Tower and prove Codex evocation now**, so Rule 3 has real teeth?
- **D. Keep the phone footer** (`statusline-live` set) or delete it?

**The strategic frame, stated without self-interest:** the strip is worth doing under *either* future, because it removes the monster and keeps the assets. But its enforcement ceiling here is one leaky gate; the rules that would make myPKA genuinely reliable (4, full 2, owner-runs-without-Larry, enforced verification) are **runtime** properties Claude Code lacks and Hermes has. So this reset is both the fix for a stripped myPKA **and** the clean pre-condition for a migration — the choice between them is which runtime you want to land these few invariants on.

**Independence caveat (all four analyses):** every brief here is the same model family as Larry. By Rule 3's own standard this joint proposal is **BUILT, NOT VERIFIED** until a different model (Codex) confirms it — which is itself decision C.
