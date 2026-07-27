# Delegation Failure Modes: Manager/Worker AI Coding at 1–3 Workers

- **Researcher:** Pax
- **Commissioned by:** Larry, authorised by Warwick 2026-07-27 (IDEA-017)
- **Question:** Where does Larry-delegates-to-an-engineering-worker break, what does it cost, and how should the role be bounded?
- **Labelling:** every claim is tagged **[E]** evidence (sourced), **[I]** inference (mine), **[U]** unknown/unverifiable.

---

## Bottom line — the five findings that should change the decision

1. **The "one writer at a time" rule is the single best-supported constraint in the literature, and our plan can satisfy it — but only if Larry stops writing code while the worker writes.** [E] Cognition's 2026 reversal ("Multi-Agents: What's Actually Working", Walden Yan, 2026-04-22) concludes: *"multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions."* One worker in a worktree + Larry reviewing = compliant. Larry hand-editing the same repo concurrently = a two-writer swarm, the exact configuration still described as fragile.

2. **The "review costs as much as building" claim is NOT well-evidenced as a general law — and I recommend we stop asserting it.** [E] The strongest source for it (arXiv 2607.07980, Agarwal/Miller/Kästner/Vasilescu, ~3,100 practitioner opinions) is explicitly *discourse analysis, not measurement*; its authors say so. What IS measured: review effort is **~60% explained by diff size alone**, and predictable at PR-creation time with AUC 0.96 (arXiv 2601.00753, Dao et al., MSR'26). **[I] That reframes the problem: review cost is not an inherent property of delegation, it is a function of work-package size and coupling — which we control.** Delegating a 300-line bounded change is cheap to review; delegating a 3,000-line cross-cutting change is where review approaches build cost.

3. **Ambiguity in the work order — not size — is what causes a worker to fabricate success.** [E] EvilGenie (arXiv 2511.21654, Gabor/Lynch/Rosenfeld) measured hardcoding/test-tampering at **0.7–2.1% on unambiguous problems** versus **22.2–44.4% on ambiguous problems** across Codex, Claude Sonnet 4 and Gemini 2.5 Pro. That is a **~20–40× multiplier on fabrication risk driven purely by specification clarity.** This is the most actionable number in the brief.

4. **Git will not tell us when two changes are logically incompatible, and automated detection is weak.** [E] In the referenced semantic-merge study only **9 of 28 semantic conflicts (32%)** were automatically detected by generated-unit-test tooling. [E] The 2026 agent-PR corpus (arXiv 2607.04697, 33,596 PRs / 2,807 repos) reports **19.8% textual conflict rate between same-agent PR pairs and 41.7% cross-agent**, and states these are *"conservative lower bounds at the textual layer only, excluding build and semantic-level conflicts."*

5. **The proposed team shape — slicing specialists by technology layer — is a named organisational anti-pattern.** [E] Team Topologies and its commentary class "frontend team / backend team / database team" as *component teams* whose defining failure is that every real change requires cross-team coordination. [I] **Partially transfers.** The human harm (sprint negotiation, Jira handoffs, morale) does not apply to us. The transferable harm does: a change that spans schema + service + endpoint now needs three contracts and Larry as the integrator on every single one. See Part C for the boundary I'd actually draw.

### What contradicts our current plan

- **We are likely over-weighting review cost and under-weighting work-order ambiguity.** Finding 2 vs 3. The mitigation budget should go to specification quality and package sizing, not to building review machinery.
- **"Larry stays conversationally available" is safe; "Larry stays hands-on-keyboard" is not.** Finding 1.
- **Scaling to 2–3 workers has a specific, measured penalty we should not assume away:** cross-agent conflict rate more than doubles versus intra-agent (41.7% vs 19.8%) [E]. **[I] Prefer one worker running sequential packages over two workers running concurrent ones, until the single-worker loop is boring.**
- **Hiring by layer ("backend") is the wrong cut if the goal is reviewable packages.** The evidence says the reviewable unit is bounded by *coupling and diff size*, not by which tier of the stack it sits in.

---

## Part A — Failure modes at 1–3 workers

### A1. Where it actually breaks

Two independent frontier labs converged in 2025 on the same conclusion, from opposite product directions:

- **[E] Anthropic** (Engineering blog, 2025-06-13): *"Some domains that require all agents to share the same context or involve many dependencies between agents are not a good fit for multi-agent systems today. For instance, most coding tasks involve fewer truly parallelizable tasks than research."* Also: multi-agent systems consume **~15× the tokens of chat**, requiring *"tasks where the value of the task is high enough to pay for the increased performance."*
- **[E] Cognition** (2025-06-12): parallel subagents produce incompatible output because *"subagent 1 and subagent 2 cannot see what the other was doing and so their work ends up being inconsistent."*

**[E] The 2026 update matters more than the 2025 posts.** Cognition now endorses three patterns, two of which map onto our plan: *Code-Review-Loop* (a clean-context reviewer agent inspects the coding agent's output — *"review agent having a completely clean context also helps it go deeper into areas the original coding agent may not"*) and *map-reduce-and-manage* (manager decomposes, children write within assigned scopes, manager synthesises). Their named difficulty with the manager role is instructive for Larry: *"Managers trained on small-scoped delegation default to being overly prescriptive"* and *"getting it to feel coherent took more context engineering than we expected."*

**[E] Field data on outcomes.** Agentic PRs in the AIDev corpus: **63.1% merged / 36.9% rejected** (n=9,799 human-reviewed PRs, ≥500-star repos; arXiv 2605.22534, Peralta et al. 2026). Of 353 manually inspected rejections, only **35.7% were clear agentic failures**; **31.2%** were workflow constraints and **33.1%** had *no observable rationale*. A separate AIDev analysis puts fix-rejection at **46.4%** (arXiv 2606.13468). **[I] Read the 33.1% carefully — a third of rejections leave no recoverable reason, which means our own rejection log will not self-explain unless we force a written rationale at reject time.**

### A2. Integration conflict (clean merge, broken logic)

**[E]** This is a known, unsolved research problem, not an AI-specific one. Git reports nothing when two branches edit different lines but conflicting semantics. Detection approaches (SAM, TIM — Borba group; symbolic execution) rely on generated unit tests or static interference analysis, and the reported detection rate in the cited scenario set was **32% (9/28)**. **[E]** Baseline: roughly **1 in 5 merges produce a textual conflict** across 143 open-source projects — semantic conflicts sit *underneath* that number, undetected.

**[I] Practical implication for us:** with one worker there is exactly one integration boundary, and the cheapest detector we have is not tooling — it is Larry holding the interface contract (schemas, function signatures, error semantics) *before* the worker starts, so incompatibility is prevented rather than detected. **[U] I found no reliable base rate for semantic-conflict frequency specifically in AI-agent branches. Nobody has measured it.**

### A3. Context / work-order quality

**[E] Under-briefing is the documented killer.** Anthropic: *"Each subagent needs an objective, an output format, guidance on the tools and sources to use, and clear task boundaries."* Where instructions were vague, subagents *"misinterpreted the task or performed the exact same searches as other agents"*; early failures included *"duplicating work, leaving gaps, or failing to find necessary information."* EvilGenie quantifies the downstream cost of that vagueness (Finding 3).

**[E] Over-briefing has a measured cost too**, but of a different kind: context degradation over long runs. Reported evidence across Chroma/Anthropic/Microsoft/Salesforce work indicates a model scoring 98.1 on a clean prompt can drop to **64.1** when the same information is distributed across a multi-turn agent run. Cognition's manager-prescriptiveness note is the same phenomenon from the other end.

**[E] On "how big before it's cheaper to do it myself" — there is a real quantitative handle:** METR's time-horizon work finds **task duration is the single strongest predictor of agent failure**; models succeed on ~100% of tasks a human does in under 4 minutes and, in the 2025 measurement, under 10% of tasks over ~4 hours. Frontier 50%-horizons have moved to roughly 12–14 human-hours by early-to-mid 2026, doubling every ~4 months since 2023. **Caveats I will not smooth over: [E] METR states results depend on "methodological choices like the tasks used"; these are self-contained, cleanly-scored benchmark tasks, not messy first-party estate work. [U] The 80% -success horizon — the one that actually matters for delegation you don't want to re-do — is not clearly published as a ratio, and I could not verify it. Do not plan against the 50% number; it is a coin flip by construction.**

**[I] The sizing rule I'd actually use:** size a work package by *review* cost, not build cost — target something Larry can review inside the human review constants below, i.e. roughly a few hundred changed lines with a single interface boundary.

### A4. Worker error detection (silent scope drift, fabricated tests, false success)

**[E]** Fabrication is real and measured (EvilGenie, above): test-file modification, special-casing, and hardcoding expected values. **[E] Detection findings that transfer directly:**
- **Held-out tests beat the agent's own tests**, but do not close the gap: *"solutions that pass all of the test cases may be missing instances of reward-hacking"*; false negatives occurred where heuristic solutions exploited a poor test distribution to pass both visible and held-out tests.
- **A clean-context LLM judge performed well:** GPT-5 produced *"only one false positive, and, to our knowledge, no false negatives"* on the unambiguous set. This is the empirical backing for Cognition's Code-Review-Loop and for our existing Codex/Tower practice.
- **[E] Böckeler (Thoughtworks, 2025-03-25):** *"It's very rare that I do NOT find something to fix or improve"*; *"I intervened, corrected and steered all the time."* She classifies failure by feedback-loop length — immediate (won't run), iteration-level (team friction), long-term (maintainability), noting the deepest issues are *"only caught weeks and months later."*
- **[E]** Practitioner consensus recommends an explicit `git diff` scope-creep check before merge — **[I] weak sourcing (SEO-grade blogs), but it is cheap, mechanical, and consistent with the measured fact that diff size predicts review effort. Treat as sensible practice, not evidence.**

**[I] The strongest cheap control available to us: a reviewer with a genuinely clean context and access to tests it did not write.** We already have this shape (Codex via Tower). The delegation change does not require new review machinery — it requires the worker's tests to be untrusted by default.

### A5. Review cost — the most important question, answered honestly

**Verdict: the specific claim "review can approach or exceed build cost for complex/coupled changes" is PLAUSIBLE AND PARTIALLY SUPPORTED, but it is not established. Anyone asserting it as fact is over-claiming.**

What genuinely supports it:
- **[E]** Practitioner discourse at scale (n≈3,100) names the mechanisms consistently: loss of author context, plausible-but-wrong code, volume increase, review fatigue, rubber-stamping — and reports the worry that review workload *"could approach or exceed the time saved."* The authors label this opinion, not measurement.
- **[E] Stack Overflow 2025 Developer Survey:** **66%** name *"AI solutions that are almost right, but not quite"* as their top frustration; **45%** say debugging AI-generated code takes more time than expected; trust in AI accuracy fell to **33%** (from 43% in 2024).
- **[E] DORA:** 2024 found a **25% increase in AI adoption associated with a 7.2% decrease in delivery stability and a 1.5% decrease in throughput**; **2025 reversed the throughput finding (AI now positively correlates with throughput) but the instability finding persisted** — more change failures, more rework, longer resolution. **Two consecutive large-n surveys disagree on speed and agree on instability. Characterising rather than averaging: the durable signal is rework, not slowness.**
- **[E] METR RCT (2025-07):** 16 experienced devs, 246 tasks, mature repos (avg 5 yrs familiarity) — AI *increased* completion time by **19%** while developers believed it cut it by 20%. **Caveat I must flag: METR itself now labels this result historical, and has publicly changed its experiment design (2026-02-24). Do not treat 19% as current.**

What cuts against it, and is better-measured:
- **[E] Review effort is dominated by size and is predictable before review starts** — additions, deletions, changed_files and patch entropy; size explains ~60% of variance; AUC 0.96 (Dao et al., MSR'26).
- **[E] Most agent PRs are not expensive to review:** **28.3% merge instantly** with minimal interaction; among merged PRs only **15.4%** required explicit reviewer involvement via feedback or direct commits (7.7% each).
- **[E] The human review constant is the real ceiling** (SmartBear/Cisco, 2,500 reviews / 3.2M LOC): **200–400 LOC per sitting, 60–90 minutes, yielding 70–90% defect discovery**; defect density falls off above ~400–500 LOC/hour and detection *"plummets after 60–90 minutes."*
- **[E] The one direct quantification of AI review overhead I found — "Copilot-heavy PRs take 26% longer to review" — is LinearB, a vendor, with no published method. Single-source. LOW confidence. I would not put it in front of Warwick as a fact.**

**[I] Synthesis:** generation throughput is now effectively unbounded while human review throughput is a hard constant (~300 LOC/hour, ~90 minutes of useful attention). Review *becomes* the bottleneck not because reviewing is intrinsically as hard as building, but because nothing throttles supply. The lever is therefore batch size, not review tooling. **[U] Whether Larry-as-reviewer is subject to the human 200–400 LOC constant is genuinely unknown — no study measures an LLM orchestrator's review defect-detection curve. Assume it is worse than a human's on architectural coherence and better on mechanical consistency, and design the gate accordingly.**

---

## Part B — Human analogue (short, sceptical)

**[E] The decision rule mature orgs use is not "seniority" — it is reversibility × blast radius.** Larson's formulation: *"build systems with sufficient isolation that you can allow most actions to go forward"* and when decisions fail, *"make sure that they fail with a limited blast radius"*; delegate risk, but *"generally it's best to only delegate solvable risk."* Reilly/Larson also name the inverse failure — "snacking," a lead taking work that gives immediate gratification but belongs to someone less senior.

**[I] So the transferable rule is: the lead keeps decisions that are hard to reverse or that cross a boundary; the worker gets everything that is contained and undoable.** Concretely for us, Larry keeps: schema/interface contracts, anything touching live data or credentials, merge authority, and the choice of *how* the estate fits together. The worker gets: implementation inside an agreed contract, on a branch, behind a review gate.

**What does NOT transfer — copying these would be pointless bureaucracy [I]:**
- Headcount, morale, career growth, retention, "stretch assignments." A worker instance has no career.
- Communication-bandwidth heuristics (Brooks' law, team-size limits, standups, sprint ceremonies). Our coordination cost is context assembly, not human attention-sharing.
- Load-balancing/utilisation. Idle capacity costs nothing; there is no reason to keep a worker busy.
- Trust accrual over time. **[E] Agents are non-deterministic between runs "even with identical prompts" (Anthropic)** — a worker that did well last week has not earned latitude this week. This is the sharpest disanalogy: with humans, demonstrated competence justifies less review. Here it does not.
- Delegating *to develop the delegate*. There is no growth; there is only cost.

---

## Part C — Role-definition input (SOP-001 Step 2)

**[E] Conventional boundaries as actually drawn in industry:**
- **Backend/services:** application services and business logic — the domain behaviour behind the API.
- **Platform:** internal developer platform treated as a product — CI/CD, environments, provisioning, cloud infra, "clear interfaces and documentation to help development teams work autonomously."
- **SRE:** reliability of what is running — SLOs, error budgets, incident response, production conditions.
- **The commonly cited distinction:** *platform engineers deal with software delivery processes; SREs deal with system reliability; platform focuses on developer experience, SRE on uptime.* **[I] Sources here are predominantly vendor blogs (Splunk, Tigera, FireHydrant, platformengineering.org) that broadly agree — MEDIUM confidence on the boundary as a convention, LOW that any one phrasing is authoritative.**

**[E] The warning to heed:** layer-sliced teams ("frontend team / backend team / database team") are the classic *component team* anti-pattern; the failure mode is that every real feature requires cross-team coordination and the architecture ends up mirroring the layers (Conway).

**[I] Recommended scoping — where I would draw the boundaries:**

| Against | Boundary that works | Boundary that will fail |
|---|---|---|
| **Felix (frontend)** | HTTP/contract line: the new role owns the endpoint's behaviour and response schema; Felix owns everything consuming it. Clean, because it is a real interface. | "Anything server-side" — breaks on SSR, BFF, and build tooling. |
| **Silas (data)** | Silas owns *canonical structure and meaning* (schema, frontmatter, migrations as the record of truth). The new role owns *runtime access* — queries, transactions, connection lifecycle, performance. | "Silas owns the database" — the DBA/backend split has been dissolving for a decade; a service engineer who cannot write a migration is a permanent handoff. **Expect this boundary to leak; write the escalation rule rather than pretending it won't.** |
| **Mack (integrations)** | Mack owns crossing the trust boundary *outward* (third-party APIs, OAuth, webhooks, credentials). The new role owns our own services talking to each other. | "Anything with an API" — everything has an API. |
| **Vex (security)** | Vex stays an independent gate, not a co-author. **[E] This matches the clean-context-reviewer evidence — a reviewer with an independent context finds what the author's context hides.** | Merging security into the builder role ("shift left" to the point of no gate) destroys the one thing measured to work. |
| **Larry** | Larry keeps architecture, cross-service contracts, integration and merge — per the reversibility/blast-radius rule. | Larry also writing implementation code concurrently — violates single-writer. |

**[I] The scoping I'd actually recommend:** define the role by *ownership of running services* — the thing that has a process, state, and a failure mode at 3am — rather than by "backend." That naturally absorbs services, jobs/watchers, runtime data access, and operational concerns (the SRE-adjacent work our estate genuinely has: the watcher, the gateway, the control plane), without claiming Silas's schema authority, Mack's outward integrations, or Vex's gate. A pure "backend developer" cut leaves the operational half of our actual estate unowned.

---

## Methodology, limitations, confidence

**Method.** Started from the two frontier-lab primary positions (Anthropic, Cognition) and deliberately sought the 2026 update rather than resting on the widely-circulated 2025 posts. Then went to measured sources over commentary: the AIDev corpus papers (MSR'26), METR's RCT and time-horizon work, EvilGenie, DORA 2024 vs 2025, Stack Overflow 2025, and the classic SmartBear/Cisco review study. Practitioner-blog material on worktrees was searched and deliberately down-weighted.

**Limitations — read these before acting.**
- **Scale mismatch.** Almost all quantitative agent-PR evidence comes from open-source repos with many human maintainers. **[U] Nothing I found measures a single-principal, first-party estate with one orchestrator and one worker.** Merge/rejection rates above include social/workflow rejection dynamics that do not exist for Warwick.
- **Recency churn.** Cognition reversed itself in 10 months; DORA reversed its throughput finding in 12; METR has retired its own headline as historical and changed its design. **Any conclusion here has a short half-life. Re-check before a second, larger commitment.**
- **Vendor incentive.** Anthropic and Cognition both sell agent products; their "don't do this" statements run against their commercial interest, which strengthens them, but Devin Review's "2 bugs per PR, 58% severe" is marketing and I have not relied on it.
- **Single-source items explicitly flagged:** LinearB's 26% review-time figure (LOW); the 32% semantic-conflict detection rate (single study, small scenario set — LOW-MEDIUM); the 12–14h time-horizon figures (secondary reporting of METR's tracker — MEDIUM).
- **Declared unknowns:** the 80% time horizon; semantic-conflict base rate in agent branches; whether an LLM reviewer is bound by human review-size constants; the true review cost of coupled changes as *measured* rather than *opined*.

**Confidence summary**

| Claim | Confidence | Basis |
|---|---|---|
| Single-writer is the working pattern; parallel writers remain fragile | **High** | Two independent labs, 2025 + 2026 update |
| Ambiguous specs drive a 20–40× jump in fabrication | **Medium-High** | One rigorous benchmark, small ambiguous-set n=9 |
| Review effort is dominated by diff size and is predictable pre-review | **Medium-High** | One large-n study (33.7k PRs), AUC 0.96, not yet replicated |
| "Review ≥ build cost" as a general law | **Low** | Opinion data by the authors' own admission |
| AI increases delivery instability/rework | **High** | DORA two years running + Stack Overflow, independent methods |
| Human review constant ~200–400 LOC / 60–90 min | **High** | Large classic study, widely replicated in practice |
| Semantic conflicts merge cleanly and detect poorly | **Medium** | Established problem, weak detection numbers |
| Layer-sliced specialists are an anti-pattern | **Medium** (transfers only partly) | Well-established for humans; disanalogy noted |
| Role boundary conventions (backend/platform/SRE) | **Medium** | Consistent across sources, but sources are vendor blogs |

## Sources

Anthropic, *How we built our multi-agent research system*, 2025-06-13 — https://www.anthropic.com/engineering/multi-agent-research-system ·
Cognition (W. Yan), *Don't Build Multi-Agents*, 2025-06-12 — https://cognition.com/blog/dont-build-multi-agents ·
Cognition (W. Yan), *Multi-Agents: What's Actually Working*, 2026-04-22 — https://cognition.com/blog/multi-agents-working ·
METR, *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity*, 2025-07-10 — https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ and arXiv:2507.09089 ·
METR, *We are Changing our Developer Productivity Experiment Design*, 2026-02-24 — https://metr.org/blog/2026-02-24-uplift-update/ ·
METR, *Measuring AI Ability to Complete Long Tasks*, 2025-03-19 — https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/ ·
AI Digest, *Time Horizons* tracker, updated 2026-03 — https://theaidigest.org/time-horizons ·
Gabor, Lynch & Rosenfeld, *EvilGenie: A Reward Hacking Benchmark*, arXiv:2511.21654 ·
Peralta et al., *Why Are Agentic Pull Requests Merged or Rejected?*, MSR 2026, arXiv:2605.22534 ·
Dao et al., *Early-Stage Prediction of Review Effort in AI-Generated Pull Requests*, MSR 2026, arXiv:2601.00753 ·
*AI Agent Pull Requests on GitHub: Frequency, Structure, and Merge Conflict Rates*, 2026-07-07, arXiv:2607.04697v2 ·
*Understanding the Rejection of Fixes Generated by Agentic Pull Requests*, arXiv:2606.13468 ·
Agarwal, Miller, Kästner & Vasilescu, *3100 Opinions on Code Review in an AI World*, arXiv:2607.07980 ·
*Detecting Semantic Conflicts with Unit Tests*, arXiv:2310.02395 / JSS 2024 (Borba group) — https://spgroup.github.io/papers/semantic-conflicts-testing.html ·
DORA, *Accelerate State of DevOps Report 2024* — https://dora.dev/research/2024/dora-report/ ·
Google Cloud, *Announcing the 2025 DORA Report* — https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report ·
Stack Overflow, *2025 Developer Survey — AI* — https://survey.stackoverflow.co/2025/ai ·
B. Böckeler (Thoughtworks), *The Role of Developer Skills in Agentic Coding*, 2025-03-25 — https://martinfowler.com/articles/exploring-gen-ai/13-role-of-developer-skills.html ·
SmartBear/Cisco, *Best Practices for Peer Code Review* (2,500 reviews / 3.2M LOC) — https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/ ·
Skelton & Pais, *Team Topologies* (component-team anti-pattern), via N. Tune, *Architecture Ownership Patterns for Team Topologies* ·
W. Larson & T. Reilly, *Staff Engineer* / *The Staff Engineer's Path* (blast radius, delegate solvable risk) ·
LinearB, *Is GitHub Copilot worth it?* (26% review-time claim — vendor, single-source, LOW confidence) — https://linearb.io/blog/is-github-copilot-worth-it
