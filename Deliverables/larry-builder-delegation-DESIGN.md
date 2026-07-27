# Larry Builder Delegation / Orchestration — DESIGN (for Warwick + GPT review; NOT yet GO to build)

**Objective:** promote Larry from primary builder to **engineering orchestrator** — take an authorised
implementation plan, recruit/instantiate builder agent(s), issue bounded work packages, supervise, receive
evidence, challenge failures, coordinate QA, and return the completed build for governance/merge — while staying
available to Warwick for orchestration rather than disappearing into implementation. Tonight's session is the
argument for it: Larry spent long solo stretches editing live code, which blinded Warwick and caused an outage.

---

## 1. Proposed design / proof

**Shape:** Larry stays the quarterback and the ONLY holder of operational-truth, reconciliation, integration and
merge authority. Bounded implementation is delegated to **temporary builder agents** that receive a durable
**Work-Package (WP) packet**, work in **isolation**, and return **implementation + evidence** — never touching the
live tree, live DB, or main directly.

**Delegation loop (one WP):**
1. **Plan → WPs.** Larry decomposes an *authorised* implementation plan into bounded WPs, each with a durable
   packet: goal, acceptance criteria, the exact files/scope, constraints (standing rules, hobby-brain bar),
   required evidence, and a hard "do NOT touch" list (live tree, live DB, main, other WPs' files).
2. **Instantiate a builder.** Larry spawns a builder agent **in an isolated git worktree** (so parallel builders
   can't clobber each other or the live tree — the recurring hazard). Builder gets the packet + read access to
   the repo, write access only inside its worktree.
3. **Build + self-evidence.** Builder implements, runs the acceptance checks itself, and returns a **structured
   evidence report** (see §5) — diff, tests/checks run + output, render-check where UI, and an explicit
   "acceptance met / not met" with the actual command output, not a claim.
4. **Larry challenges.** Larry reviews the evidence adversarially: does the diff match the packet? Did the checks
   actually run (output present) or is it asserted? Are the "do NOT touch" boundaries respected? Failures bounce
   back with specifics; Larry never rubber-stamps.
5. **Independent QA.** On a passing WP, Larry routes to the independent reviewer (Codex default; Fable on explicit
   Warwick auth) — the same governance already used for Mason.
6. **Integrate.** Larry (and only Larry) merges the builder's worktree onto the working branch, reconciles,
   re-runs the acceptance at the integrated head, and returns DONE (or BLOCKED with the reason) to Warwick.

**The proof this works** is already partly demonstrated: today's Fable review ran as a delegated, isolated,
evidence-returning agent that found real blockers Larry then fixed — the review half of the loop is proven. The
*build* half (an agent that writes code in a worktree and returns render-checked evidence) is what §6 proves.

---

## 2. What authority / tools / skills a builder needs

- **Isolated worktree** (write access to its own copy only; never the live tree or main).
- **Read** access to the repo + the WP packet.
- **Build + test tooling** for its scope (node, the project's test/lint, and the relevant **verification harness**
  — e.g. `render-check.mjs` for cockpit UI, the dbtest/acceptance scripts for DB work).
- **NO** live-DB credentials, **NO** live-service restart rights, **NO** merge rights, **NO** `--dangerously-skip-
  permissions` / gate-disabled spawning (standing safety rule).
- Skill: follow the packet, produce the required evidence in the required shape, and STOP — not expand scope.

---

## 3. What Larry retains EXCLUSIVELY

- Operational truth (what is actually live / true right now).
- The implementation plan + WP decomposition (what gets built and how it's bounded).
- Reconciliation + integration onto the working branch.
- Live-apply, live-service restarts, and merge-to-main (the last two remain Warwick-gated on top).
- Adversarial challenge of builder evidence; the go/no-go on each WP.
- Talking to Warwick — Larry never delegates the relationship or the orchestration.

---

## 4. Strategic vs self-improvement (how delegation fits the operating model)

Delegation is the "delegated build" step of the canonical lifecycle. Self-improvement WPs (the common case) can
flow with minimal Warwick load once he's GO'd the outcome; strategic/product WPs keep tighter Warwick checkpoints.

---

## 5. How builders report progress/evidence — no invisible-deliverables

The failure mode to prevent (seen tonight and before): work happens, but Warwick/Larry can't *see* it, or a claim
("tests pass") isn't backed by output. Rules:
- **Evidence, not assertions.** Every acceptance claim carries the actual command + its output (test run, diff
  stat, render-check line). "It works" without output is treated as NOT DONE.
- **Structured return packet:** `{ wp_id, status: done|blocked, diff_summary, checks:[{name, cmd, output_tail,
  pass}], acceptance:[{criterion, met, evidence}], boundaries_respected, notes }`.
- **Progress is pull-able, not a black box:** the builder writes to a durable per-WP file + a one-line status Larry
  can surface to Warwick on demand (and dings on handback, per the standing reflex).
- **Larry re-verifies at the integrated head** — the builder's green is necessary, not sufficient.

---

## 6. Smallest REAL proof (one bounded task, end-to-end) — NOT built yet

Pick one genuinely bounded, low-blast-radius WP from the current backlog — proposed: **"add a `--dry-run` flag to
`mason-synthesise.mjs` that prints the synthesis result WITHOUT writing to the DB."** It's real, useful, isolated
to one file, has a crisp acceptance test, and touches nothing live.

Proof run:
1. Larry writes the WP packet (goal, the one file, acceptance: `--dry-run` prints the parsed opportunity set and
   exits with zero DB writes; evidence required: the command output + a before/after row-count proving no write).
2. Larry spawns ONE builder agent in an isolated worktree with the packet.
3. Builder implements, runs the acceptance itself, returns the structured evidence packet.
4. Larry challenges the evidence, routes to independent QA, integrates onto the branch, re-verifies, returns DONE.

**Acceptance of the PROOF (not the flag):** the bounded task was delivered by a delegated builder with real
evidence, Larry never wrote the implementation, the boundaries held (no live/DB/main touch), and Larry retained
challenge + integration. If that loop runs clean once, the capability is real and can scale to bigger WPs.

**Explicitly out of scope for the proof:** parallel multi-builder fan-out, autonomous WP generation, and any
live-apply by a builder. Those come after the single-loop proof, gated.
