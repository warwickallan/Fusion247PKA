# Tower Product-Contract Architecture — Larry's Recommendation

**Status: design proposal for Warwick's approval. No prompts/schema/workflow/ClickUp changed.** Responds to Warwick's 2026-07-20 proposal (Foundry→Build promotion creates authoritative PRD + Plan + acceptance matrix in Supabase; Codex=product-QA, Fable=risk-triggered; findings ledger; Directus cockpit; risk-tiered auto-merge).

## Headline verdict
**Strong agree with the diagnosis and the direction.** Your root-cause hypothesis is correct: the reviewers pen-test because **there is no machine-readable statement of intent for them to QA against.** My session-fix (re-orienting the reviewer prompts from "try to break" to "fitness-for-purpose") treated the symptom; your proposal treats the cause. "Tower approved" can't mean "delivered per intent" until intent is a versioned, checkable contract.

**Crucial framing: this is a completion of BUILD-014, not a new build.** I already have, in the `ops` schema on Postgres/Supabase: `build`, `checkpoint` (SHA-bound), `verdict` (reviewer/head-bound), `merge_gate` (dual-gate, head-bound), `agent_event` (append-only ledger), `command_request`, and the `job` queue — plus the WP-D Directus cockpit proof and **model-agnostic review adapters** (codex/fable are injected, swappable). Your proposal adds ~2-3 tables (PRD, acceptance rows, findings), a wired QA prompt, risk-tiering, and a cockpit page. That's an evening-or-two of real work, not a platform.

---

## Q1 — Agree / disagree, point by point
- **PRD + Plan + Build Record at promotion → AGREE.** This is the machine-readable contract Tower is missing.
- **Acceptance/Evidence matrix as the core review contract → STRONGLY AGREE. This is the single most important artifact.** "Approved" becomes "every acceptance row for the WP is evidenced at the reviewed SHA." It directly kills "Tower approved ≠ meets intent."
- **Findings ledger (consumed + updated each round, never silently forgets) → STRONGLY AGREE, and this is the one I most viscerally learned this session** — I *was* relying on per-round prose, and findings genuinely moved/vanished between rounds. This is the highest-value, lowest-cost fix.
- **Codex = product QA (your 9 ordered questions) → AGREE.** Those 9 questions ARE the "GPT check" that was filed-not-wired. Wiring them is most of the win.
- **Fable = risk-triggered adversarial → AGREE.** Directly fixes the over-use you flagged (Fable spent on pure-logic formatters this session) and hedges the availability risk.
- **Directus cockpit per build with the state machine → AGREE.** Natural extension of WP-D.
- **Layering (ClickUp portfolio / Supabase contract / Directus cockpit / GitHub code) → AGREE.** This is already the BUILD-014 authority model.
- **Risk-tiered auto-merge on mechanical conditions → AGREE as the destination.** Your gated version is *safe* (mechanical, matrix+findings-gated) precisely where my earlier loose auto-merge trial was not.

## Q2 — Where ownership is wrong or duplicative (my pushbacks)
1. **Split "product QA" from "merge admin."** Codex should *assess* mergeability (your Q9), but it must NOT be the merge *authority*. A reviewer that also administers merges is a reviewer marking its own homework. The mechanical checks (PR current, head==CI-head==reviewed-head, no open blocker, no unresolved finding, gate green) and the *execution* belong to the **control plane** (`merge_gate` + a merge executor), not Codex's judgement. Codex verifies "meets PRD"; the control plane enforces "mechanically safe" and merges. Keep them separate.
2. **The PRD + acceptance criteria must be Warwick-approved at promotion.** If Larry auto-drafts the PRD from the Foundry idea and no one ratifies it, you've just moved the intent-gap from "does the code match intent" to "does the PRD match intent." So: promotion *drafts* Build Record + PRD + Plan; **Warwick approves the PRD + acceptance criteria** (they're the governing contract — same bar as the reviewer amendment). Then they're the review contract. This is the load-bearing human gate.
3. **Keep the review loop model-agnostic (hedge the Fable risk).** The WP-C adapters already inject the reviewer, so "if Fable goes away, slot a different adversarial model" is a config change, not a rewrite. Bake that in explicitly so no single vendor is load-bearing.
4. **Don't duplicate the Implementation Plan into Supabase — link it.** Architecture/WP/dependency detail lives fine in the repo + Foundry; Supabase needs the *machine-checkable* slivers (WP list, risk triggers, live-apply gates, current approved versions), not the prose.

## Q3 — Smallest sensible promotion schema
Extend `ops` with exactly what makes Tower checkable — nothing more:
- **`build`** (exists) + add: `title, idea_ref, outcome, owner, status, risk_tier, authorised_scope, exclusions, data_boundaries, current_prd_version, current_plan_version`.
- **`prd`**: `build_id, version, user_journey, acceptance_criteria (jsonb rows), non_goals, good_enough, needs_warwick_judgement, approved_by, approved_at`.
- **`acceptance_row`** (the contract): `id, build_id, prd_version, requirement, owning_wp, expected_proof, impl_path, evidence_ref, result (pending|pass|fail), reviewed_sha, open_finding_ids[], disposition`.
- **`finding`** (the ledger): `id, build_id, first_reported_sha, reviewer, description, impact, reachability, disposition, merge_blocker (bool), correction_sha, verification_reviewer, verification_sha, state (open|fixed|deferred_to_gate|rejected|superseded)`.
- **`plan`**: keep LIGHT — `build_id, version, wp_list, risk_triggers, live_apply_gates`, link out for the rest.
- Reuse existing `checkpoint`, `verdict`, `merge_gate`, `agent_event`, `command_request`.

**Build the two that fix the proven failures FIRST: `finding` + `acceptance_row`.** They're 80% of the value.

## Q4 — Wire the richer product-QA behaviour, testably
Root cause of the drift: **I hand-wrote each Codex prompt, and I wrote pen-test prompts.** Fix:
- A **standing, versioned, Warwick-approved "Tower-Codex product-QA" prompt** = your 9 ordered questions. (Same governance as the reviewer-classification amendment.)
- The WP-C `reviewHandler` builds a **packet** for the adapter — today it's the diff. Change it to include **the PRD, the acceptance rows for the WP, and the open findings for that build/head.** Now Codex reviews the delivery *against the contract*, not against a checklist in a vacuum.
- **Testable** = deterministic: run the same head twice → Codex must reference the same acceptance rows + open findings; a missing acceptance evidence must produce a fail. You can regression-test the reviewer itself against a fixture build with a known-incomplete matrix.

## Q5 — Risk-tiered Fable without weakening assurance
Decide it *mechanically* from the Build Record, not per-review vibes:
- `risk_tier` on the build + the WP's touched surface. **Fable REQUIRED** when the WP touches any trigger: credentials/secrets, auth/permissions, private/health data, live DB writes, public endpoints, autonomous commands, merge authority, irreversible actions, exactly-once/concurrency, material availability, or a Warwick "stress-test this" flag.
- Otherwise (reversible DEV-only formatter/parser/doc): **Codex product-QA + CI is the gate.** This is exactly this session's lesson — Fable on a pure-logic normaliser was disproportionate.
- Assurance isn't weakened because the triggers are explicit and conservative (any real trust boundary → Fable). Lower-risk work simply stops paying the Fable tax.

## Q6 — How Directus presents it simply
One page per build (extends the WP-D proof). Top: the **state machine as a single row of badges** — `built → review-ready → QA-approved → assurance-approved (if required) → merge-ready → merged → live-ready → live`. Below, four panels: **acceptance matrix** (green/red rows, the heart of the page), **open findings + dispositions**, **PRs/heads + Codex/Fable verdicts + CI**, **decisions waiting for you + live gates**. Keep it read-mostly; the only writes are the `command_request` controls I already proved (accept/reject/authorise), never a raw merge button. Simplicity rule: if the matrix is all-green and no finding is open and no gate is pending, the page says **"merge-ready"** in one glance.

## Q7 — Migration from ClickUp without losing records
Don't rip it out. **Layer it:**
- ClickUp → portfolio, idea discussion, human planning, high-level status + links (unchanged; existing records stay put).
- Supabase → authoritative operational state + the versioned delivery contract, **for new builds from now on**.
- Back-fill Supabase records **only for currently-active builds** (BUILD-014 itself first), not history.
- Each ClickUp build card gets a **pointer** to its Supabase build record (same pattern as the Foundry→build pointer rule). No data moves or is lost; ClickUp stops being the hidden engine and becomes the human surface.

## Q8 — Bounded proof on ONE build before rollout
Use the **TubeAIR YT→packet pipeline** (crisp, testable user journey: "paste a link → get a Karpathy packet"), or BUILD-014 itself (meta, self-proving). Steps:
1. Author its **PRD + acceptance matrix + findings ledger** in Supabase (Warwick approves the PRD).
2. Wire the **QA-Codex packet** to consume them.
3. Run **one** review round against a real head.
4. Check the outcome: does "Codex-approved" now mean "the user journey is evidenced + acceptance rows green + prior findings closed" — and would a GPT inspection of the same head now find *nothing obvious*?
5. Only if that holds, roll the contract out to other builds.

## Trade-offs / risks to hold
- **Bureaucracy creep:** for a hobby brain, a heavyweight PRD process would be worse than the disease. Your `good_enough` + `needs_warwick_judgement` fields are the right antidote — they encode the hobby-brain bar *into the contract* so reviewers stop chasing commercial-grade rigor. Keep every table lean; grow only on evidence of need.
- **Garbage-in:** the whole system is only as good as the approved PRD/acceptance rows. Hence the Warwick-approval gate on the PRD (Q2.2).
- **Auto-merge:** earn it. Prove the matrix+findings gate green→merge on 2-3 builds *manually confirmed* before trusting the mechanical path.

## What I'd do first (if you approve the direction)
1. `finding` + `acceptance_row` tables (fix the proven failures).
2. Wire the QA-Codex packet to consume PRD + acceptance + findings; stand up the versioned QA prompt.
3. Risk-tier field + the Fable-trigger rule.
4. The bounded proof on the TubeAIR pipeline.
5. Then the cockpit page + the mechanical auto-merge gate.
