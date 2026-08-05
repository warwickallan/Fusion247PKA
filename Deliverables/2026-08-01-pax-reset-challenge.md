---
title: "PAX-05 — Adversarial challenge: the one-night operating reset (GPT proposal)"
type: challenge-brief
author: Pax (Senior Researcher)
commissioned_by: Warwick, via Larry
date: 2026-08-01
status: delivered
independence: "SAME model family as Larry (Opus). By this proposal's own Rule 3, THIS challenge is a consequential claim and must be externally verified by a DIFFERENT-MODEL reviewer (Codex/Fable) before Warwick acts on it. Flagged, not waived."
audience: Warwick
subject: Where the reset regrows into admin, which rules are secretly still prose, and what must be proven first
---

# PAX-05 — Challenge to the one-night reset

**I am challenging the proposal AND Warwick's assumptions, not just Larry's.** The proposal is good in intent and I agree with its direction. That is exactly why it is dangerous: a plausible reset is the easiest thing to quietly turn back into the monster it replaced. Blunt findings below.

---

## A. Scope-growth / hidden-admin audit — where this regrows into a monster

**The tell to watch: every rule that ships a NOUN invites a system to manage that noun. This proposal ships four — `evidence`, `gate`, `boundary`, `mode`. Three of the four are regrowth vectors.**

- **Rule 3 ("external evidence") is the prime suspect — confirmed.** It already ships a **three-value taxonomy** (BUILT-NOT-VERIFIED / PARTIAL / FAILED). An enum wants a validator; a validator wants tests; a taxonomy wants an evidence store, a "who-checked" registry, and a label-parser. **This is precisely how BUILD-018's `evaluator` + `footer` + `programme-state` grew.** Hard cap, stated now: **evidence = the real command output / lived result pasted into the same message. Full stop.** No store, no schema, no parser. The three labels are **words Warwick reads, never fields a machine enforces.** If anyone builds a thing to *manage* the labels, the disease is back.
- **Rule 2 ("external gate") is the second vector.** A gate invites a policy file, an allowlist, a bypass-request flow, an audit log — i.e. `build-registry` + `programme-pr` + `merge-readiness` reborn. Keep it to **one deny rule** (protected-main push/merge) on the **guard that already exists** (`worktree-guard.mjs`). Add no new gate module.
- **Rule 4 ("capability boundary") risks rebuilding what was just deleted.** myPKA **retired `delegation-gate` (937 lines) on 2026-08-01** (`RETIRED_MARKERS` in `install-hooks.mjs`). "Enforce via boundaries" is a standing invitation to re-author it under a new name. Do not.
- **Rule 1 is the safe one** — a priority rule, cheap, mostly prose, spawns nothing. Keep it as-is.

## B. Self-certification audit — which rules can ACTUALLY be externally enforced in THIS harness

The harness **does** have a real external mechanism: `PreToolUse` hooks (`GUARD_EVENT = 'PreToolUse'`, `worktree-guard.mjs`) can deny a tool call before it runs. That is the *only* external lever available. Measured against it:

| Rule | Externally enforceable **here**? | Honest label |
|---|---|---|
| **1** outcome > maintenance | **No.** No hook can tell "maintenance" from "outcome work." | **Prose, self-enforced.** Fine as intent — call it that. |
| **2** block outward/irreversible | **Partially — the one real one.** A `PreToolUse` deny on Bash `git push`/merge to protected main genuinely fires in this harness. | **Real but leaky + unproven.** See caveats. |
| **3** claims need external evidence | **No.** Nothing can read a chat message's semantics and block "done." **The rule against self-certification is itself self-certified.** | **Prose + human enforcement only.** |
| **4** orchestrator-not-executor via boundaries | **Largely no.** The guard blocks writes to *paths*; it cannot distinguish orchestration from execution, nor force delegation. | **Aspirational in this runtime.** |

**Rule 2's caveats are load-bearing:** (a) **"written is not loaded"** — the guard only bites after a host restart and lives *outside* the repo, so it is unproven until observed firing; (b) **it is leaky** — it catches Bash-git, but an **MCP connector** (Supabase `apply_migration`, a Zapier write, a GitHub-MCP merge) can perform an outward/irreversible action **without touching the guarded Bash surface at all**; (c) the incident that motivated this — a fresh `claude -p` pushing to main — ran in a process that **may not have had any guard installed.** So Rule 2 is *enforceable in principle for git-via-Bash, unproven in fact, and blind to the connector surface.*

**Rule 4, said plainly (the sharp one you asked for):** in THIS harness the main agent (Larry) *holds* Edit/Write/Bash. You can narrow WHERE it writes; you cannot make it *not the executor*. **"Enforce via tool/capability boundaries" is aspirational until a runtime where the orchestrator's process literally does not hold executor tools and must spawn sub-agents that do.** That is a **platform property, not a prompt** — and it is exactly the Hermes architecture (orchestrator layer + isolated sub-agents holding the tools). **Rule 4 cannot be truly enforced on Claude Code as configured; it can be enforced on a Hermes-shaped runtime.** Anyone who claims Rule 4 is "enforced by boundaries" here is self-certifying.

**Headline for B:** of four rules, **only Rule 2 is (partially) externally enforceable in this harness; 1, 3, and 4 are prose the agent polices on itself.** That is not a reason to reject them — it is a reason to **stop calling them enforcement.** They are disciplines Warwick must police by rejecting unevidenced output, until a different runtime makes 4 (and a real 2) structural.

## C. Binning BUILD-018 — is it correct, or does it kill the one working thing?

**Binning the governance mass is correct. Binning it *wholesale* would throw away the ONE asset that addresses Warwick's #2 pain (memory): the Honcho session-start read** (`continuity.mjs` + `reorient.mjs`, committed `421053b`). The `reorient.mjs` SessionStart brief was independently observed firing on `source=startup` in a fresh process (BUILD-018 NOLAN + Pax KEEP list §6). That is the REMEMBER leg, and it is the only part of BUILD-018 that serves a rule Warwick actually cares about.

**But do not grant it an exemption.** I verified earlier that the continuity augmentation is **untested** (no `continuity.test.mjs`; `reorient.test.mjs` covers none of it) and its **live firing has never been *shown*, only asserted.** So it is a **keep-candidate that must EARN its keep**, by the same lived test the proposal demands of everything else.

**Safe boundary — exact:**
- **BIN:** delegation/escalation/model gates, `build-registry`, `programme-pr`, `merge-readiness`, `qa-binding`, the 454-line map, the ~9,879 doc lines. None serves a rule; all are admin.
- **KEEP, but only after each passes a lived test THIS session:** (1) the `reorient` SessionStart brief + `continuity` Honcho read — *prove it fires on boot and returns last session's focus, by showing the output*; (2) the `PreToolUse` guard + `stop-controller` anti-loop — *these directly serve Rule 2, so keep the mechanism, drop the ceremony*; (3) `footer`/`evaluator` **only if** the footer is genuinely Warwick's read surface on his phone (NOLAN-04 found the footer had **no producer** — so this one is guilty until shown innocent).
- **The rule:** "keep only what serves a rule and passes a lived test" is right. Apply it to the Honcho read too. If `continuity.mjs` does not fire when shown, it goes — being "the one working thing" is a claim, and by Rule 3 an unshown claim is BUILT-NOT-VERIFIED.

## D. Codex/Tower gate reality check — do NOT assert reliability

Warwick asks whether Codex QA "can reliably be evoked as it was a week ago." **I will not assert it. Here is what must be PROVEN before Codex can be the standing verification gate for Rule 3:**

1. **A live evocation, reproduced NOW.** Run `mergeCheck.mjs` end-to-end on a real diff today and get a Codex verdict back. **"It worked a week ago" is a memory, not evidence** — that run must be reproduced at the current head. This is Rule 3 applied to Rule 3's own gate.
2. **Tower is a hard dependency, and it is PARKED.** Codex QA runs *through* Tower's `mergeCheck.mjs` (from `C:\Fusion247PKA-tower`), and memory records Tower as **MERGED + PARKED — "don't resume without a fresh decision."** So standing-Codex-gate **requires un-parking Tower**, which is itself a decision (it was parked for a reason). No un-park, no standing gate. — **PATH SUPERSEDED 2026-08-05: see the correction below. The dependency argument stands; the location does not.**

> **Correction, 2026-08-05 (WO-2026-08-05-03, BUILD-020 proofline).** `C:\Fusion247PKA-tower` is **not**
> where Codex QA runs from. Point 2's *reasoning* is untouched — Tower remains the route and its parked
> status remains a decision — but the path would send a fresh reader to a stale tree.
>
> The current Tower runtime is `C:\Fusion247PKA\services\control-plane\tower-loop\` (live watcher
> verified by execution 2026-08-05, PID 31268). The preferred Codex review route is `reviewDiff.mjs`,
> which **does not exist at all** in the `-tower` worktree; that worktree is pinned at `3c08e45` on
> `build-014/tower-recovery` and its `mergeCheck.mjs` is superseded. The `-tower` worktree is authorised
> for removal under WO-2026-08-05-03, sequenced behind WO-2026-08-05-04.
3. **The diff-staging path must be confirmed working.** Codex's read-only sandbox on Windows **cannot self-read files**, so the actual diff must be **staged into the prompt.** A gate that reviews an *empty* diff is worse than none — it manufactures false assurance. Prove Codex reasons over the staged diff, not an empty context.
4. **Fable is NOT the standing gate.** Confirm-first **hardlock** means every Fable evocation needs Warwick's explicit per-use yes — so it is an on-demand, human-gated escalation, **never** the automatic verifier. The standing gate is Codex-via-Tower **or nothing.**

**Verdict:** until (1)–(3) are demonstrated live, **treat the Codex gate as UNPROVEN and do not build Rule 3 on top of it.** If Rule 3's "external evidence" silently means "Codex signed off" while Codex cannot actually be evoked, Rule 3 collapses into *trusting a gate that never runs* — the **exact BUILD-018 zero-firings failure**, rebuilt.

## E. The recurring-owner requirement — the acceptance rule, and the real risk

**Acceptance rule (assert it):** *Every substantive recurring task must have a named **non-Larry** owner — a specialist contract, an external service, or a scheduled job. Larry may orchestrate and integrate; he may not be the standing executor of a recurring job.* If a *category* of recurring work keeps landing on Larry, that is a missing owner to assign, not work for Larry to absorb (his own AGENTS.md calls this "the illegitimate exception").

**The single biggest risk — named:** **there is no mechanical owner-check at the point of execution, so the rule already exists and is already violated.** Larry's own memory carries "dispatch-check before executing" and "Larry must not silently replace the team" — the rule **fires in prose but never at the point of action.** In this harness nothing stops Larry doing the recurring work himself, and he reabsorbs **exactly when he is busy or time-pressed** — the precise moment delegation feels like overhead.

**The acid test that makes "owner" real, not prose:** the owner must be **a thing that runs WITHOUT Larry** — a cron/scheduled job, an external service, or a separate agent runtime. **If the "owner" is a specialist that only exists when Larry dispatches it, Larry is still the executor by another name.** This, again, is a runtime property (Hermes's cron scheduler and always-on sub-agents supply it structurally; Claude Code does not).

---

## Overall verdict

**Adopt the reset's *direction*; reject the illusion that it is *enforced*.** In this harness only Rule 2 has any external teeth, and even that is leaky and unproven. Rules 3 and 4 — the two that matter most for "lies" and "over-build" — are **structurally unenforceable on Claude Code as configured** and become real only on a runtime where the orchestrator lacks executor tools and a standing verifier actually runs. **That is the same conclusion as PAX-04: the honesty and boundary fixes are platform properties, and Hermes supplies them structurally where myPKA can only supply them as prose.** Do the one-night subtraction (it is cheap and it buys an honest state either way), but do not report the reset "done" until each kept piece is *shown* firing — and get a **different-model** review of this very challenge first.

## Methodology & limits
- **Verified against source:** `install-hooks.mjs` (`PreToolUse` guard exists; `delegation-gate` in `RETIRED_MARKERS`, retired 2026-08-01); `continuity.mjs` / `reorient.mjs` untested-but-committed. **From memory (flagged, not re-run):** Tower PARKED; Codex read-only Windows self-read limit; Fable confirm-first hardlock; commit `421053b` cited by Warwick, not independently confirmed by me (no shell).
- **Could not verify (no shell):** live hook-firing state, live Codex evocability, the `421053b` SHA. All are exactly the things that must be *shown*, not asserted — the proposal's own Rule 3.
- **Independence:** same model family as Larry. **By Rule 3, this challenge is BUILT-NOT-VERIFIED until a different-model reviewer confirms it.**
