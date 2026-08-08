# Warwick's route decision — MERGE-FIRST (SOURCE MIRROR)

**Received 2026-08-09, in response to Larry's fresh-session orientation.** This file is a verbatim
mirror of Warwick's ruling, kept because the decision governs the current BUILD-015 route and must
not live only in a chat turn. **What follows between the rules is Warwick's text. Nothing has been
added, reordered or paraphrased.** Larry's own consequent record-keeping is on the active Wayfinder
(`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` § THE ONE CURRENT NEXT ACTION) and is
labelled there as Larry's.

---

**[ACTION: Route decision — MERGE-FIRST remains the route. Continue from your verified orientation state.]**

Your fresh orientation changed one operational detail but not the decision.

Do NOT take option (a′).
Do NOT install `node_modules` into `C:\Fusion247PKA-b15` merely to resurrect the special acceptance launcher.
Do NOT engineer around the failed worktree runtime path.

Proceed MERGE-FIRST, with one amendment:

> The post-merge canonical runtime start is now an EXPLICIT acceptance step. Do not assume the logon-triggered scheduled task will restart it.

Current intended route:

`build-015/grounded-recognition`
→ one PR to `main`
→ establish CI truth on the EXACT PR head
→ Tower-visible Codex merge-check using the canonical `mergeCheck.mjs` route
→ Warwick merge decision
→ merge
→ explicitly start/restart the canonical AsdAIr runtime from `C:\Fusion247PKA`
→ prove by execution that the running process is consuming the merged canonical bytes
→ allow shop 6 to reach the new confirmation surface
→ real ShopperBot confirmation card
→ real Warwick tap on "Confirm this reading"
→ observe `needs_review` clear / replan / resulting shop state
→ §12 handback

Important boundaries:

1. Veritas Gate 1 is already PASS on the integrated WP boundary. Do not reopen Veritas unless you make a material executable change.

2. There is currently no open PR. Create the ONE BUILD-015 PR against `main`.

3. Establish CI for the exact current PR head before Codex.
   The known AsdAIr integration failure is inherited baseline. Do not launch a CI-repair side quest merely to make this WP look green.

4. If the canonical merge-check route can distinguish the inherited failure and proceed legitimately, use it.

5. If `mergeCheck.mjs` itself hard-requires green CI and blocks on the inherited baseline, STOP and hand me that exact gate.
   Do not bypass it.
   Do not use bare `reviewDiff.mjs`.
   Do not silently redefine the assurance rule.

6. Codex must be Tower-visible this time through `mergeCheck.mjs`.
   The prior route-selection recurrence is already banked as 4F evidence; do not repeat it.

7. After merge, do not assume runtime activation.
   Explicitly establish:
   - canonical merged SHA;
   - runtime process start;
   - runtime source/cwd/launcher lineage as far as executable evidence permits;
   - that the new card code is genuinely live.

8. Do not touch the next-slice findings yet:
   - durable human learning / intent promotion;
   - `substitutes_allowed` continuity loss;
   - invariant-D candidate evidence;
   - BOB;
   - browser-shopping-method recovery.

   They belong in the §12 handback / next product decision.

9. The disposable `db-card.tmp.cjs` probe is not product work. Remove it if clearly safe and untracked; otherwise ignore it. Do not let it become a detour.

The WP remains NOT COMPLETE until the real live acceptance event happens.

The next Warwick interruption should therefore be only:
- a genuine merge/assurance gate needing my decision;
- the merge decision itself;
- a substantive blocker;
- or the real ShopperBot card/tap acceptance event.

---

**Disposition of boundary 9, recorded by Larry:** `db-card.tmp.cjs` was an untracked one-shot
Postgres probe script written by Larry in the previous session (it counts `pipeline_command` confirm
rows and reads recent `shop_event` rows). It is not referenced by anything, carries no credentials
of its own, and was deleted from the main worktree on 2026-08-09. No product code was touched.
