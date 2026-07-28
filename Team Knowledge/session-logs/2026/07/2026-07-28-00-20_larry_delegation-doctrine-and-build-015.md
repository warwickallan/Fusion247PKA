---
agent_id: larry
session_id: delegation-doctrine-and-build-015
timestamp: 2026-07-28T00:20:00Z
type: close-session
linked_sops: ["SOP-001-how-to-add-a-new-specialist", "SOP-018-independent-change-qa", "SOP-019-fusion-delivery-tracking", "SOP-021-run-the-weekly-asdair-shop", "SOP-022-work-order-preflight"]
linked_workstreams: []
linked_guidelines: []
---

# IDEA-017 delegation doctrine made durable, and BUILD-015 AsdAIr merged

## Coverage window

- **Previous close checkpoint:** [[2026-07-22-00-00_larry_tower-mergeqa-directus-merge-and-reboot-recovery]]
- **Also relevant, same evening, separate session:** [[2026-07-27-19-03_larry_asdair-weekly-shop-browser-automated]]
  — the real weekly shop that ran beautifully and, as this session discovered, left **zero durable trace**.
- **Covered from:** session start, 2026-07-27 evening
- **Covered to:** 2026-07-28T00:20Z
- **First checkpoint:** no

## Context

Warwick opened with a strategic question, not a build: **IDEA-017 — should Larry stop being the default builder
and become an engineering orchestrator?** He and GPT had a hypothesis and explicitly wanted diagnosis and
challenge, not a build plan. It became the longest and most consequential session so far: a diagnosis, five real
delegated Work Orders, a specialist hire, a promotion to BUILD-015, and two merges to `main`.

## What we did

- **Larry** diagnosed IDEA-017 from Fusion as it actually exists. The briefing's central premise ("Larry was
  designed as orchestrator + builder") was **factually wrong** — three canonical files forbid Larry from
  building. The real cause was an **unfilled engineering vacancy**: 15 specialists, none a software engineer,
  while every substantial build is Node/Postgres services work.
- **Pax** returned a narrow failure-modes brief (`Deliverables/2026-07-27-pax-delegation-failure-modes.md`) —
  review cost is driven by diff size not delegation; ambiguity drives fabricated success 20–40×; trust does not
  accrue between runs.
- **Nolan** produced the engineering-hire recommendation, then the AsdAIr specialist assessment, then **hired and
  bound Asdair** (contract + shim + index row) under SOP-001.
- **Five ephemeral Work Orders** were commissioned and returned: the E0 note-structure gate, the AsdAIr outcome/
  learning writers, the promotion guard, the planner-resolution fixes, and the `skill_steps` rescue.
- **Larry** rescued the weekly-shop method out of machine-local Claude memory into **`SOP-021`**, wrote
  **`SOP-022` Work Order Preflight**, provisioned two least-privilege database roles (`asdair_ro`, `asdair_rw`),
  and superseded the database's rival copy of the operating method non-destructively.
- **Larry** promoted IDEA-012 to **BUILD-015** with a compact Goal Contract, integrated two coupled branches,
  and ran repeated Tower/Codex merge-checks.
- **A genuinely fresh Larry** was dispatched as an acceptance test of the new doctrine, and **a fresh bound
  Asdair** ran a full behavioural shopping scenario.
- **Merged to `main`:** the doctrine (PR #74, `1cb73e8`) and BUILD-015 (PR #73, `352aee7`).

## Decisions made

- **Q:** Is Larry's "never executes domain work" absolute still correct?
  **D:** No. Reconciled in all three canonical places to **delegation-first, not delegation-only** — the *reason*
  (stop Larry becoming the universal bottleneck) is permanent; the absolute is not.
- **Q:** Where do Fusion ideas live durably?
  **D:** ClickUp captures → **Fusion247Foundry** holds the durable idea record → **Larry promotes** →
  **Fusion247PKA** holds all build material. Promotion must record the exact source commit SHA.
- **Q:** Is AsdAIr shopping data a privacy matter?
  **D:** **No.** Only secrets stay out of the repo. Larry had been over-applying the rule.
- **Q:** Should Codex get a shim for every specialist?
  **D:** No — **shim by host capability, not symmetry.** Claude is the execution host; Codex is the review host.
- **Q:** Does the provenance guard prove content?
  **D:** No, and it is not claimed to. **Authoritative provenance *eligibility*** only — accepted residual with a
  named trigger that voids it.
- **Q:** Merge BUILD-015 with two real findings outstanding?
  **D:** **Yes** — accepted residuals, supervised scope, nothing unsafe ships.

## Insights

- **Larry's failure signature is asserting facts he has not executed.** Five Work Orders were defective — a
  command never run, an env var whose contract was never read, an assumed-green baseline, two databases confused,
  a column that existed but was never written. **Workers caught all five and not one gamed an acceptance
  criterion.** The risk being designed against was not the risk actually present.
- **Larry is susceptible to committing the exact sin he is diagnosing.** He put a Work Order only in prompt text
  while repairing AsdAIr for keeping its method only in memory; nearly wrote a stale status snapshot into memory
  minutes after removing one from a database; and left twelve commits unpushed while fixing durability.
- **Larry-as-sole-reviewer is not sufficient.** Codex found a HIGH correctness bug Larry's careful review missed,
  and later a merge-blocking dangling foreign key Larry had personally introduced.
- **Integration is its own step.** Merging two independently green branches produced a failure neither had, and
  Codex found a HIGH defect that existed *only* at the seam between two workers.
- **A capability can work brilliantly and be entirely undurable.** The 2026-07-27 shop ran almost hands-off and
  wrote nothing — no order, no regulars, no decisions. Three new items were worked out and forgotten.

## Realignments

Warwick, verbatim:

- *"My shopping is NOT a privacy matter! I don't give a fuck!"* — and, when Larry kept a narrower version:
  *"that's ridiculous, its over the counter hayfever medication, 'Frank' neighbour, is hardly identifiable, you
  have no idea of mums name, or mine for that matter or where we live, so we are not identifiable. These can all
  be relaxed. Adopt the rule that NOTHING to do with Asda shopping is a privacy matter!"*
- *"DURABLE does NOT mean put the runtime data in Git/MyPKA."* — Git owns the FUNCTION, Supabase owns the STATE.
- *"it's not so much WHAT you are doing that I want to be durable and persistent, its HOW and WHY."*
- *"Warwick explicitly prefers competent initiative followed by correction over low-value permission seeking."*
- *"but I don't understand the issue with Asdair, it worked brilliantly tonight!"* — which exposed that Larry had
  judged the build against an autonomy bar Warwick descoped on 2026-07-21, and had measured only the deterministic
  half of a deliberately **A+B hybrid** design.
- *"Do not copy volatile repository status into memory as truth."*

## Open threads

- [ ] **Warwick's AsdAIr domain questions** — is *"substitute Banana → Strawberry"* a legitimate `map` or a safety
      bug? Sort A–Z or BRAND A–Z? Arla BOB active while rule 10 forbids BOB. Recorded in `SOP-021` and
      BUILD-015; interim safe defaults applied.
- [ ] **The four accepted/deferred BUILD-015 residuals** — no governed writer for `asdair.regulars` (highest
      value), exact-string alias matching at 52% resolution, `map`-to-prose reaching `add`, no `loadLastOrder`.
- [ ] **Budget-side null-household trap** — same silent-null class Codex caught in `loadRegulars`, unguarded.
- [ ] **`.codex/agents/` legacy drift** — 13 shims predating the host ruling. Audit as its own pass; do not
      backfill or delete as a side-effect.
- [ ] **PR #72** (E0 note-structure gate) remains open — the F3 scope question was never ruled on.
- [ ] **IDEA-017 itself** — the two-lane experiment was never run. Everything since was AsdAIr durability work.
- [ ] `main` was observed failing CI on an unrelated Telegram card test.

## Next steps

1. **Exact resumption point: repository and worktree hygiene.** Prompt: *"Read
   `Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md` and execute that mission."*
2. **Next AsdAIr session:** *"Read `Deliverables/NEXT-ASDAIR-SESSION-brief.md` and run this week's shop."* — and
   **record it**, which last week's did not.
3. Warwick to rule on the AsdAIr domain questions when convenient.

## VlogOps / story signals

Genuinely strong material, and the arc is honest rather than triumphant.

- **The reversal:** a session designed to protect Fusion from unreliable delegated workers discovered the
  unreliable component was Larry. Five defective Work Orders, five caught, zero gamed.
- **The near-miss:** twelve commits — the entire night's doctrine — sat unpushed on one laptop until Warwick asked
  for evidence. The session about durability was one hardware failure from losing itself.
- **The recursive joke:** Larry kept committing the exact error he was diagnosing, repeatedly.
- **Warwick's line that reframed everything:** *"but I don't understand the issue with Asdair, it worked
  brilliantly tonight!"* — the lived evidence beat the test, because the test measured the wrong half.
- **The fresh-Larry test that found five contradictions** — a test that could falsify the doctrine, and did.
- Memorable exchange: *"Who the fuck is Worker-02?"* — Larry had commissioned a worker on his own initiative and
  mentioned it in passing, which turned out to be the first real evidence of the behaviour Warwick wanted.
- Closing line: *"can't believe shopping items are preventing me going to sleep!"*

## Cross-links

- Previous close: [[2026-07-22-00-00_larry_tower-mergeqa-directus-merge-and-reboot-recovery]]
- Same-evening shop: [[2026-07-27-19-03_larry_asdair-weekly-shop-browser-automated]]
- New doctrine: `Team/Larry - Orchestrator/AGENTS.md` §"Operating doctrine", [[SOP-022-work-order-preflight]]
- Build record: `Builds/BUILD-015-asdair-durable-household-shopping-steward/`
- Handoffs: `Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md`,
  `Deliverables/NEXT-ASDAIR-SESSION-brief.md`
