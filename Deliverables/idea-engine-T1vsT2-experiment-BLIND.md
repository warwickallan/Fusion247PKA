# Idea-engine — FROZEN T1-vs-T2 experiment · BLIND candidate set (for scoring)

> **Blind copy.** Within each source, candidates from BOTH engines are merged, shuffled, de-labelled and
> provenance-scrubbed — you cannot tell which engine produced which, by design. Score each on four axes; the origin
> key is held until your scores are in. Thin/poor-fit sources are expected to yield little — a low score is useful signal.

**Per candidate:** DEFENSIBLE? y/n · VALUE? low/med/high · TIMING? now/later/no · SURPRISED-ME? y/n
_A high-value "later" is still a win. The prize is a defensible, high-value, surprising idea one engine found and the other missed._

---

## Source 1 — AI-agent skill (ADHD)  
_rich, same-domain positive_

#### E1
**Before spinning up several expensive agents, the source runs three cheap questions to decide if that expense is even justified.**

- **Problem:** Every team running heavy multi-agent workflows burns tokens on fan-out even when a single-pass answer would've done.
- **Implication:** That triage judgment — open-ended? high-stakes? how did you phrase it? — is a small, separable piece of logic that has nothing to do with the rest of the pipeline and could stand alone.
- **Need-payoff:** Package that three-question gate as a standalone lightweight skill or plugin and license it to other AI-heavy teams as a token-cost governor, sitting in front of their multi-agent workflows the same way it could sit in front of Fusion's own.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Triage logic extracted as a standalone distributable skill/plugin
- **Transfer reasoning:** A three-question pre-check that decides whether an expensive multi-agent fan-out is even worth running is a small, self-contained heuristic, independent of the rest of the pipeline it currently sits inside — small enough to package and distribute on its own. Any team running agentic multi-agent workloads and worried about token spend is a plausible buyer for that gate alone, packaged as a lightweight plugin or skill, rather than trying to sell the whole idea-engine.
- **Source evidence:** "spinning up this many agents burns a lot of tokens, so there's a pre-check step that decides whether this skill should run at all... The first one is whether the problem is open-ended... whether the stakes are actually high... how you asked" 05:44-06:27 (three-question pre-check gate (open-endedness / stakes / phrasing) deciding whether to invoke expensive multi-agent divergence at all)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** obsolescence risk: Anthropic or the host tooling itself may ship equivalent cost-governance natively, undercutting any standalone product fairly quickly.; no distribution channel: No existing marketplace or audience to sell a standalone plugin into — needs a go-to-market answer, not just a build, before it's real.

**Your scoring — E1:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E2
**The Outputs Layer's whole job is telling Warwick 'you nearly missed this' — across money, relationships, deadlines, and blind spots — but only when it's genuinely non-obvious.**

- **Problem:** If all that signal gets reasoned over together in one shared pass, the loudest recurring pattern — an overdue invoice, a looming deadline — keeps winning, while a quiet, real miss in a domain that isn't habitually scanned never gets its own dedicated look.
- **Implication:** The exact thing Outputs Layer promises is what a single shared-context pass is structurally worst at: it applies toward the familiar and drowns out the rare-but-real signal underneath it.
- **Need-payoff:** Give each domain — financial, relationship, deadline, 'the thing you're not looking at' — its own isolated scan that can't see the others' output, then merge and gate on a novelty score before anything reaches the Cockpit.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Outputs Layer surfacing/synthesis pipeline (not yet built)
- **Transfer reasoning:** Isolating each evaluation from the others, then gating the merged result on a novelty score, is what stops a shared-context pass from collapsing toward whichever pattern is most familiar. The Outputs Layer's synthesis step — turning Honcho, Neo4j, and journal signal into 'you nearly missed this' items — is exactly that kind of shared-context evaluation, which means it inherits the same applies risk: the loud, recurring category of miss keeps surfacing while a rare one in an under-attended domain stays invisible. Running each domain as its own isolated scan, merged only afterward through a novelty-weighted filter, keeps the rare-but-real signal from being drowned out before Warwick ever sees it.
- **Source evidence:** "They're isolated, so they share zero context and none of them know what the others are working on... it's about keeping each idea separate so they can't influence each other." [02:08] (cross-blind isolated framing agents, gated by a novelty-weighted critic before anything surfaces)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** needs-evidence: Outputs Layer doesn't exist yet — this should land as part of that build's own design, not get bolted on afterward.; cost: Multi-lens fan-out per incoming signal is expensive if run on everything ingested rather than a pre-filtered subset or a schedule.; false-positive-noise: A domain-isolated scan has no visibility into what Larry already handled elsewhere — needs a dedup/merge pass against the decision-rationale log before anything reaches Warwick, or it erodes trust.; unproven-mechanism: The claim that isolation genuinely improves diversity (vs. just looking different while being equally shallow) is anecdotal — treat as a hypothesis worth a small pilot on real Outputs Layer data.

**Your scoring — E2:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E3
**The idea-engine's Critic agent grades every idea on novelty, viability, fit by running a prompt telling it to act as a skeptical senior engineer.**

- **Problem:** That critic is built from the same kind of model that defaults to whatever pattern repeats most in training data — so when it scores an unfamiliar idea's viability, it may be pattern-matching 'unfamiliar equals infeasible' rather than reasoning about real feasibility.
- **Implication:** If the Critic under-scores real novelty because novelty pattern-matches as 'risky,' the shortlist Warwick sees has already been silently re-homogenized before he looks at it.
- **Need-payoff:** Periodically spot-check the Critic's own verdicts — an occasional independent second read on a sample of rejected-but-high-novelty candidates — rather than trusting critic scores as ground truth by default.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Critic stage in idea-engine (N/V/F+traps)
- **Transfer reasoning:** Nothing structurally exempts a scoring or critic step from the same bias its own generation stage is designed to escape — a critic built from a pattern-completing model can score an unfamiliar idea's viability as 'unfamiliar therefore infeasible' rather than reasoning about real feasibility. The idea-engine's Critic stage sits in exactly that spot, converging judgment after several divergent proposals, so an occasional independent second read on a sample of rejected-but-high-novelty candidates is worth doing rather than trusting critic scores as ground truth by default.
- **Source evidence:** "This grading happens in an agent of its own, running a prompt that tells it to act as a skeptical senior engineer. So, its whole job is to be hard on everything it reads." [03:41] (single critic-agent scoring convergence step after divergent candidate generation)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** infinite-regress: Checking the checker invites checking the check-checker; needs a bounded, occasional spot-check, not a new permanent layer.; Fable-temptation: The obvious 'second opinion' reach is Fable — HARDLOCKED to confirm-first, don't default to it.

**Your scoring — E3:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E4
**The Cockpit is now the front door to the Brain, and the whole point of the Brain is catching things Warwick would otherwise miss.**

- **Problem:** The pre-ship check on a Cockpit/Outputs feature today is a fixed checklist — does it match the design system, is it accessible, is it secure. It only catches problems Larry already knew to look for.
- **Implication:** A feature that was promised in the plan but quietly never got built, or a piece of friction that makes you stop opening the Cockpit, could ship invisibly. You'd only discover it by living with it — which is exactly the 'nearly missed this' failure the Brain exists to prevent, this time aimed at its own front door.
- **Need-payoff:** Before a significant Cockpit/Outputs launch, one divergent pass that checks the shipped thing against its own PRD and hunts for friction that would make you quietly stop using it — catching the unknown-unknowns a fixed checklist structurally can't.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit / Outputs Layer pre-ship gate, run once per significant Warwick-facing feature launch, alongside (not replacing) the builder-preflight checklist
- **Transfer reasoning:** The builder-preflight 7-point check is a deterministic, known-checklist gate. This source's technique is generative — it surfaces gaps nobody thought to enumerate, specifically PRD-promises-never-built and friction that would make the one real user disengage. Turning that same lens on Fusion's own output surface, for the one user who matters, is a direct application of the Brain's stated north star rather than a new idea.
- **Source evidence:** "it caught gaps that had gone completely undetected, like features that were promised in the PRD but never actually got built" 12:20 (post-build, pre-ship generative audit comparing the shipped feature against its PRD and surfacing churn-risk friction, run on the real intended user rather than a checklist)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** redundant-with-preflight: must be scoped to what the deterministic 7-point preflight can't catch, or it's duplicate spend covering the same ground

**Your scoring — E4:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E5
**A pre-launch scan for churn — people quietly abandoning a product after one small thing didn't work — makes sense when you have many users to average across.**

- **Problem:** Fusion's Cockpit has exactly one user, so there is no aggregate 'X% dropped off' signal that could ever exist there.
- **Implication:** If Warwick quietly stops using a Cockpit feature because something small annoyed him once, nothing detects that the way churn analytics would for a multi-user product — it just looks like silence, and could persist indefinitely as an unflagged regression.
- **Need-payoff:** A lightweight periodic self-check — which Cockpit features have gone quiet versus their historical use — instead of assuming silence means everything's fine.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit — feature-level engagement monitoring
- **Transfer reasoning:** Churn detection relies on an aggregate drop-off signal across many users — a signal that structurally can't exist for a single-user system. But the underlying failure it's built to catch, quiet abandonment after one small overlooked friction, can still happen with exactly one user; it just produces silence instead of a statistic. Cockpit has no way today to tell 'nobody's using this feature because it's fine' apart from 'nobody's using this feature because something annoyed Warwick once' — a lightweight periodic check on which features have gone quiet versus their historical use gives it that signal without needing aggregate data.
- **Source evidence:** "anything that could push them to churn, which is basically when people stop using your product after they've already started. And churn happens a lot once your site is out there with real people using it" [10:52] (pre-launch churn-scan across the whole app to catch small overlooked frictions before they cause quiet abandonment)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** privacy/telemetry: Any usage-logging must stay local/private per the personal-data doctrine, never uploaded.; over-instrumentation: Risk of building monitoring disproportionate to a one-user product — keep it a manual periodic question, not new infra.

**Your scoring — E5:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E6
**Warwick has already flagged, unprompted, that the input side of builds is the bottleneck — no robust home yet for a PRD plus impl plan per idea, and the real long-term fix isn't built yet.**

- **Problem:** Until that lands, every build starts from context Larry has to reconstruct or chase down rather than context that's already sitting in front of him.
- **Implication:** Builds risk drifting from what was actually agreed because the governing PRD isn't in the file read at session start — it's fetched or half-remembered, the same shape of gap as a promised-but-unbuilt feature, just one step earlier, at build-start instead of merge-check.
- **Need-payoff:** A zero-infra interim fix usable today: link the governing PRD/brief path directly at the top of each active build's scope file, so it's picked up from the very start — directly testable on the current build right now.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Per-build context-file slot linking to the governing PRD/brief (interim, ahead of the bigger fix)
- **Transfer reasoning:** Putting the governing spec directly into the file an agent always reads beats relying on it to fetch or recall that spec elsewhere. Fusion already has this exact gap named and unsolved — no robust home yet for a PRD plus impl plan per build — and the cheapest available fix, ahead of any bigger downstream build, is to link the governing PRD/brief path directly into the top of that build's own scope file so it's loaded from the first turn rather than chased down mid-build.
- **Source evidence:** "you need to write down what needs to be built like a PRD... alongside that, you should also give it a technical specification document... You link both of those inside your claw.md file, so it picks up that context from the very start" 08:37-09:00 (PRD + tech-spec linked directly into the agent's always-loaded context file)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** superseded-by-plan: The stated direction is a larger real fix elsewhere — this is deliberately a stopgap; don't let it calcify into scaffolding that competes with or delays the actual plan.

**Your scoring — E6:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E7
**Builder Preflight is the mandatory checklist Larry runs before every merge-check — clean git, matching heads, tests green, docs matching deploy.**

- **Problem:** None of its points ask whether the build actually delivers everything the governing PRD/brief promised, or whether something in it would quietly annoy Warwick on first real use.
- **Implication:** A build can pass every mechanical check and still ship with a promised feature missing or a rough edge nobody was assigned to look for — the exact gap that's cheap to catch before merge and expensive to unwind after.
- **Need-payoff:** Add one more checklist point: read the governing PRD/brief line by line, confirm every promised capability is actually built and usable, plus a quick 'would this trip Warwick up on first use' pass — minutes of extra work, catching a class of gap the current checklist structurally can't see.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Builder Preflight 7-point self-check / merge-ready gate
- **Transfer reasoning:** A dedicated pass that compares what was promised against what was actually built and used catches a gap class that mechanical checks — git state, test status, matching heads — miss by construction. Builder Preflight's current seven points are all mechanical; none of them re-read the governing PRD or brief against the delivered result. Adding that comparison, plus a short first-use friction check, closes exactly the gap that lets a build which looks clean but ships a broken promise get through.
- **Source evidence:** "it caught gaps that had gone completely undetected, like features that were promised in the PRD but never actually got built, so we'd have shipped something that didn't match what we said it would do" 12:20 (pre-ship PRD-promise / churn-risk audit pass, run as its own step before launch)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** scope-creep: Keep this to the PRD-line-by-line + first-use check; don't let it regrow into new multi-agent fan-out infrastructure across every merge — that's the review-platform Warwick already flagged and killed once.; cost: A fuller isolated multi-lens audit fan-out is worth reserving for builds with real user-facing surface, not running on every PR.

**Your scoring — E7:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E8
**Right now, every source that gets fed to the Brain — including this very transcript — goes through a mining pass to see if anything in it transfers to Fusion. That's literally what the live idea-016 branch is calibrating at this moment.**

- **Problem:** There's no cheap first filter before that mining runs. A thin source where any experienced person would land on one obvious answer gets the same expensive multi-agent treatment as a genuinely rich one.
- **Implication:** That's tokens spent finding nothing on weak sources, and it muddies the ongoing T1-vs-T2 tiering experiment — you can't tell if a cheap-tier result was cheap because the source was thin, or because tiering picked wrong.
- **Need-payoff:** A near-free 3-question check before mining starts — is this source open-ended (multiple genuinely different valid angles)? are the stakes real? did Warwick's own phrasing signal 'just log it' vs 'dig in'? — lets the system self-select the right tier instead of guessing, cutting wasted spend on thin sources.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cairn's intake triage step — the decision point that currently routes a captured source to T1 (light) vs T2 (full Transfer-Intelligence mining)
- **Transfer reasoning:** The source's skill burns tokens fast per invocation, so it front-loads a near-free classifier to decide whether the expensive divergent path is warranted at all, rather than always running it or having a human pick. Fusion's Cairn-triage-into-Transfer-Intelligence path has the identical cost shape, and there's already a live experiment (T1 vs T2) trying to solve the same tiering question by hand — the invariant worth transferring is that a cheap upfront gate can make that call automatically.
- **Source evidence:** "it runs the problem through three questions... The first one is whether the problem is open-ended... The second one is whether the stakes are actually high... And the third one is how you asked" 06:01 (3-question pre-check gate (open-ended? high-stakes? phrasing signal?) run before the expensive multi-agent branching is allowed to fire)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★☆☆
- **Traps/risks:** scope-overlap: check the T1vsT2-experiment-KEY/COST deliverables before building this — it may duplicate a gate that experiment already establishes; silent-miscalibration: a wrong pre-check answer silently downgrades a genuinely rich source to T1 with no human visibility — needs a visible audit trail, not silent routing

**Your scoring — E8:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E9
**Before Larry runs the full multi-lenses Transfer-Intelligence pass instead of just answering directly, something has to decide in the moment whether the request is open-ended and high-stakes enough to earn it.**

- **Problem:** That judgment call is made informally — no explicit checklist, no record of which way it went — so a request that actually needed multi-angle thinking can quietly get the safe single-pass answer, and it looks exactly like a normal, competent answer either way.
- **Implication:** A misjudged 'this is simple' verdict is invisible and uncorrectable after the fact — Warwick can't tell a corner was cut, and there's no loggable trail showing why depth was or wasn't invoked.
- **Need-payoff:** Make the gate explicit and visible: a three-question pre-check (is this open-ended? are the stakes high enough that a wrong 'obvious' answer costs something? did the phrasing signal 'quick'?) as a loggable one-line decision, plus a visible depth-tier tag on the response itself so Warwick can catch a wrong call and ask for more depth.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Larry/Cairn tier-selection gate (idea-engine T1/T2 + general Agent/Workflow dispatch judgement)
- **Transfer reasoning:** The decision of whether to invoke expensive divergent multi-agent thinking is itself made by a cheap, nameable checklist — open-ended? high-stakes? how was it phrased? — rather than an ad-hoc read of the request, and that same checklist can double as a visible marker on the resulting output. Larry's tier-selection judgment, both in the idea-engine and in general Agent/Workflow dispatch, makes an equivalent call today, but informally: there's no explicit checklist and no visible trace of which way it went, so a request that actually needed depth can quietly get a single-pass answer that looks just as competent as one that didn't need it. Turning the three questions into a loggable one-line decision, and stamping the chosen depth-tier onto the response, makes the judgment call itself auditable and correctable instead of invisible.
- **Source evidence:** "The first one is whether the problem is open-ended... The second one is whether the stakes are actually high... And the third one is how you asked." 06:01-06:27 (three-question pre-check gate before tree-of-thought fan-out, made explicit and loggable, paired with a visible depth-tier tag on the output)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** scope-creep: Keep it to a one-line loggable decision and one visible tag — don't let it balloon into a full meta-logging system.; false-confidence: A depth-tier label doesn't fix a misjudgment, only makes it auditable after the fact.; already-partially-done: Cairn triage plus the existing cost tiers already act as an informal version of this gate — this makes it explicit and loggable, not a new capability.

**Your scoring — E9:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E10
**The source's skill deliberately stops at strategy — it plans in depth but, in its own words, doesn't do the work; you get direction, not the done thing.**

- **Problem:** Fusion already has a live, named case of exactly this handoff failing: a backlog item where capture happened but the note-writing was deferred to 'next session' and never got done.
- **Implication:** The idea-engine pipeline ends at the identical shape of output — a scored strategy Warwick 'Accepts' — with no forcing function turning that Accept into a scheduled build, the same gap that already broke the earlier item.
- **Need-payoff:** Treat Cockpit 'Accept' as creating a durably tracked open item with an owner and a next-session trigger, not just a decision-log entry, so accepted ideas can't join the 'pending — next session' pile.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit Accept action → Foundry/build-record handoff
- **Transfer reasoning:** A deliberate plan-then-build split is fine when something forces the handoff from plan to execution — but Fusion already has a live case of that handoff failing quietly: a backlog item marked as pending that never actually got written. The idea-engine pipeline ends at the identical shape of output — a scored strategy Warwick 'Accepts' — with nothing forcing that Accept into a scheduled build. Treating Accept as creating a durably tracked open item with an owner and a next-session trigger closes the same gap that already broke the earlier item, before it recurs here.
- **Source evidence:** "One thing to be clear about here, though, the skill plans the tests, it doesn't actually write them. What you get back is the strategy." [08:37] (plan/strategy output deliberately decoupled from execution)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** process-overhead: Turning every Accept into a tracked item risks the 'governance before the thing works' anti-pattern already rejected.; duplicate-tracking: Must not spawn a second backlog system alongside the existing ones.

**Your scoring — E10:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E11
**When a builder starts a work package today, it writes its own tests as it goes, and those tests get their real stress-test later, at the Codex+Fable review stage.**

- **Problem:** Builder-written tests reliably cover the same obvious paths — that's not a guess, it's a named failure mode in the source — so gaps like the concurrency/permissions edge cases your own build-verify-defaults RCA already flagged as costly tend to surface late, at review, instead of before the code is written.
- **Implication:** That means more review rounds and more Codex/Fable spend catching things that could have been designed for up front — exactly the outcome your own RCA said you wanted to avoid by 'prescribing up front.'
- **Need-payoff:** Running one divergent-branch pass on the TEST STRATEGY (not the idea, not the code) before the builder starts — grounded in that WP's own PRD/spec — gives the builder a genuinely wider test plan from the start and should shrink downstream review rounds.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Larry's pre-implementation step for a WP (ahead of handing it to a builder subagent) — insert a divergent test/edge-case strategy pass whose output joins the PRD/tech-spec in the build brief
- **Transfer reasoning:** The source explicitly diagnoses that even a dedicated test-author agent regresses to common patterns unless forced to diverge first — this is the same failure Fusion's build-verify-defaults memory already names as expensive to catch late. The transfer isn't 'use the branch+critic pattern' (already built) — it's moving WHEN that pattern runs: before a builder starts a WP, not only after code exists.
- **Source evidence:** "the tests are way more detailed than they would have been otherwise because the whole testing strategy got planned out in depth before a single test was written" 10:52 (pre-build divergent test-strategy authoring (isolated branches + critic scoring) grounded in a linked PRD + tech-spec, run before implementation starts)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** cost: multi-branch test-strategy authoring is itself token-expensive — reserve it for WPs that actually hit the RCA's blocker classes (immutability/permissions/concurrency), not routine small WPs; not-a-substitute: a richer pre-build test plan is additive, not a replacement for the independent Codex+Fable review gate (merge-ready-means-independently-reviewed still applies in full)

**Your scoring — E11:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E12
**Every Transfer-Intelligence pass is told to 'discard the most obvious mappings' before proposing anything.**

- **Problem:** 'Discard the obvious' is a vibe, not a rule — there's no concrete count forcing a pass past its first, most pattern-matched answers, so what counts as 'obvious' varies run to run.
- **Implication:** A pass can quietly under-discard on any given run and nothing would catch it, because there's no explicit number to check against.
- **Need-payoff:** Bake a literal, numeric threshold into the lenses-library prompt contract: generate at least N raw candidates internally and throw out the first several before scoring any of them.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Transfer-Intelligence lenses library / prompt contract
- **Transfer reasoning:** A concrete numeric floor — generate at least N candidates and discard the first several before scoring any of them — replaces a vague 'discard the obvious ones' instruction with something a prompt contract can actually enforce and check. Transfer-Intelligence's prompt contract already gestures at the same goal qualitatively but never quantifies it, which means how much gets discarded varies run to run. Hard-coding the exact threshold closes that gap with a small, contained edit to the prompt file itself.
- **Source evidence:** "The file straight up says those first three are the most common responses in the data these models learned from, and they're also the ones any senior agent could come up with immediately." [05:18] (hard-coded discard-first-N threshold inside the prompt contract, not a vague quality instruction)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** needs-evidence: No data yet showing Fusion's passes actually under-discard without a hard number — worth a quick before/after sample rather than hard-coding blind.

**Your scoring — E12:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E13
**Fusion already built a multi-agent generate-and-grade engine for scoring its own ideas.**

- **Problem:** That machinery currently only ever looks inward — it never earns anything from anyone outside Fusion.
- **Implication:** A capability this expensive to build is being used once a session for internal ideation when the exact same mechanism, pointed outward, is a sellable audit product other founders would pay for.
- **Need-payoff:** Repoint the same generate-and-grade pipeline at 'what did this other team promise vs. ship, and where will their users churn' — a paid pre-launch audit, sold externally, using capacity Fusion already has.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Idea-engine (generate+critic architecture) repurposed as an external audit product under Client Delivery
- **Transfer reasoning:** The same isolated-generation-then-critic mechanism used for internal ideation is structurally identical to a pre-launch audit that checks what a team promised against what it actually shipped, and flags where its users will likely churn — the only difference is which direction it's pointed. Repointing it outward turns an internal capability that currently runs once a session into a PRD-vs-Shipped Gap and Churn-Risk Audit that other founders or agencies shipping software would pay for, sold as a client deliverable with an independent verification step before handoff — a genuine external-revenue path built from capacity that already exists, not new infrastructure.
- **Source evidence:** "it caught gaps that had gone completely undetected, like features that were promised in the PRD but never actually got built... And it works the same way as the tests here. It's not fixing anything itself, so you just hand the findings you want back to the agent" 11:40-12:20 (pre-launch UX/churn-risk audit run through isolated agents, scored and output as a findings report against the PRD)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** boundary: Risks blurring Client Delivery with the internal idea-engine SSOT — needs a clean interface, not a shared codepath, or it breaches the existing separation between them.; unproven demand: No evidence yet that outside founders will pay for this vs. free/cheap alternatives — needs a market check before any build.

**Your scoring — E13:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

## Source 2 — Running a business — 4 tasks  
_rich, non-AI, transferable_

#### E14
**Business owners with no dashboard at all are effectively driving by feel about how much revenue is actually coming.**

- **Problem:** Full CRMs are overkill and annoying to set up for a one-or-two-person business, so they just don't bother tracking their pipeline at all.
- **Implication:** That gap — too small for a CRM, too blind without one — describes a real, underserved segment of solo and micro service businesses.
- **Need-payoff:** A zero-setup, phone-first pipeline view — same shape as an internal capture-and-triage tool — that a solo owner texts or voice-notes deals into and gets back a plain 'here's what's likely to close, here's what's gone quiet' read, with no CRM configuration required.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit (phone-first control/output surface), repurposed as a white-label micro-CRM/pipeline-visibility product for solo and micro service businesses
- **Transfer reasoning:** A phone-first surface that turns messy incoming items into a simple triaged view without asking the user to configure a tool solves exactly the gap named here: solo owners who won't touch a CRM but would use 'even a spreadsheet.' Repurposing that same capture-and-triage pattern as a stripped-down, external-facing pipeline-visibility product (deals in via text or voice, triaged the same way) turns an internal control surface into a paid micro-product for that underserved segment.
- **Source evidence:** "You need a dashboard, a CRM, heck, even just a spreadsheet for some small businesses... a spreadsheet might do the job for you right here" 08:38 (minimum-viable pipeline measurability (dashboard/CRM/spreadsheet tier))
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★☆☆ · Fit ★★★☆☆ · Impact ★★★☆☆
- **Traps/risks:** crowded-market: pipeline/CRM tools are heavily commoditized (Trello, Pipedrive, free-tier HubSpot) — only works if the zero-setup/capture-first angle is sharply differentiated; already-doing-it-elsewhere: close enough to the existing triage pattern that it may just be 'sell the same shape to strangers' rather than a genuinely new mechanism — worth checking it isn't double-counting the sales-extraction-product candidate

**Your scoring — E14:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E15
**Warwick captures a YouTube link into Fusion expecting a finished knowledge note to come out the other end.**

- **Problem:** Right now capture just replies "knowledge note pending — I'll write it next session," with no fixed point in the pipeline where that actually happens.
- **Implication:** Every captured link becomes a silent IOU that depends on some future session remembering to close it — the same ad hoc, memory-dependent pattern that lets a client get followed up twice then ignored, or forgotten for three weeks.
- **Need-payoff:** One deterministic last step in the pipeline that always produces the note in the same run, so 'pending' stops being a state the system is allowed to leave things in.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** TubeAIR ingestion (tools/tubeair/) → Cairn intake — replace the deferred 'knowledge note pending' state with a mandatory write step executed in the same run as capture
- **Transfer reasoning:** Invariant: any commitment that lives only as conversational intent, rather than as a system step, will randomly fail to complete once attention moves elsewhere. A capture pipeline that defers the actual note-write to 'next session' is doing the same thing as ad hoc follow-up that defers to 'whenever it feels right' — both are in-the-moment improvisation standing in for a system. The fix is not a bigger note-writing framework, it's making the write step unconditional within the same run that does the capture, so nothing is left in a pending state waiting on a future session's memory.
- **Source evidence:** "One client you followed up twice and then ignored them. Another potential customer you forgot about for 3 weeks before you got back to them." 03:31 (a follow-up/delivery step that depends on the owner's mood and memory instead of a fixed sequential process)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** already-partial: TubeAIR already produces the cleaned transcript — confirm this is genuinely a missing last step, not a bigger redesign, before treating it as new work

**Your scoring — E15:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E16
**Larry's grasp of why past decisions were made, and what's currently mid-flight, exists only inside the live conversation.**

- **Problem:** When a session compacts or restarts, none of that is written down anywhere a fresh instance can read — the reasoning and the in-progress state both vanish at once.
- **Implication:** Work gets silently redone or reversed, Warwick has to re-explain context he's already given, and every restart pays a full ramp-up tax instead of picking up where things left off.
- **Need-payoff:** A durable, sequential record — written at decision-time and updated for what's still in flight — that any fresh instance can read cold and act on immediately, not "next session."

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Larry's decision-rationale log (seeded (a recent commit) for the Fresh-Larry WHY gap) — extend it to also capture in-flight/live session state, not just closed decisions
- **Transfer reasoning:** Invariant: a process or piece of knowledge held in only one transient locus — an owner's head, a live session — cannot survive a handoff without loss, and the fix is never 'remember harder,' it's writing the sequence down as it happens so any other actor can execute or continue without ramp-up. Applied to session compaction, the fix isn't a bigger context window, it's a structured log written at decision-time — covering both the WHY behind past calls and the state of whatever is still mid-flight — indexed so a fresh instance can reconstruct enough to act without replaying the whole conversation.
- **Source evidence:** "This entire spider web of a sales process that you're currently using lives in your head... A business where the selling only exists inside the business owner's head isn't a business with a sales system." 03:50 (externalize a tacit, single-locus process into a documented artifact before a handoff is ever needed)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** already-partial: (a recent commit) already seeded a decision-rationale log — confirm the specific value-add (ramp-up-free handoff for a FRESH instance, and coverage of in-flight state) is actually still missing before treating as new work; redundant-with-existing: verify this needs an extension of the existing log, not a second parallel system; over-build: risk of building a heavy state-machine when a lightweight running note of what's mid-flight may be enough

**Your scoring — E16:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E17
**The T1-vs-T2 calibration harness decides, per idea, whether it gets a fast standard pass or a slow bespoke deep pass.**

- **Problem:** If the harness treats every idea's need for bespoke T2 depth as a given, rather than checking whether ideas actually cluster into a small number of recurring shapes, it pays full bespoke-analysis cost far more often than genuine structural divergence requires.
- **Implication:** Cost and latency scale with how many ideas come in rather than with how much genuine novelty they contain — the same 10x tax that kept a business owner capped at the same revenue for a decade.
- **Need-payoff:** Mine the T2 corrections already on record into a reusable T1 default template, and add a cheap pre-check that tags an incoming source's structural shape before committing it to a full bespoke pass — reserving true T2 depth for sources that actually diverge from the known skeleton.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** services/control-plane/cockpit/t2-calibrate.mjs and t2-experiment.mjs — mine the frozen T2 corrections into a reusable T1 skeleton, and add a cheap structural pre-tag so bespoke T2 depth is spent only on genuine divergence
- **Transfer reasoning:** Invariant: a felt need for bespoke handling is usually an undocumented common pattern in disguise, not genuine per-case uniqueness — documenting the pattern once collapses n-times-bespoke into once-templated-plus-exceptions. Applied to the calibration harness, that means two complementary moves: mining the T2 corrections already gathered into a reusable T1 skeleton after the fact, and adding a cheap pre-classification step that tags an incoming source's structural shape before running it through full multi-pass analysis, so bespoke effort only gets spent on the genuinely new remainder.
- **Source evidence:** "he thought, wrongly, he thought that he needed a bespoke approach to every single client that he worked with... now he's got a seamless step-by-step plan for the next prospect that comes into his inbox to run through" 06:00 (collapse perceived per-case uniqueness into one documented template plus a smaller set of true exceptions)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★☆☆☆ · Fit ★★★☆☆ · Impact ★★★☆☆
- **Traps/risks:** premature-optimization: only worth attempting once enough T2 runs exist to mine a real common skeleton — with just the Audi calibration plus the 6-fresh experiment set, the sample may still be too small to templatize safely; unverified-premise: assumes source archetypes cluster meaningfully — untested, needs verification before anyone builds it; self-referential-shortcut: a pass proposing a way to cut its own analysis workload deserves extra suspicion — convenient conclusion, not a proven one

**Your scoring — E17:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E18
**There's a live gap around Larry's rich context and relationship-building not surviving compaction or restart.**

- **Problem:** The fixes tried so far have been effort-based — write better memory files, log sessions more diligently — which assumes the constraint is discipline, not capacity.
- **Implication:** If the real limit is the shape or size of the container holding context between sessions, no amount of more-careful writing this session raises the ceiling — each session keeps re-filling the same size pot and topping out at the same point, so depth never compounds.
- **Need-payoff:** Ask explicitly whether the container itself is big enough for the relationship wanted twelve months from now — a capacity question, not a discipline question — before assuming better-written memory files are the whole fix.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** The persistent-context architecture behind Larry's identity (MEMORY.md + per-topic files) versus the parked Honcho pilot on fusion247-core — treat 'is this the right container' as a separate, explicit question from 'am I writing memories well'
- **Transfer reasoning:** Past a capacity ceiling, the fix is a bigger container, not more careful tending. A gap that's been treated as a writing-quality problem may actually be a container-size problem: flat memory files are a fixed-size container regardless of how well any single entry is written, so the open question is whether the underlying storage architecture itself needs to change, separate from whether entries are being written well.
- **Source evidence:** "that plant can only grow as big as the pot is going to allow it to... it doesn't matter how nutrient dense the soil is or what plant food you give it or how much you water it. Once those roots hit the edge of that container, the plant growth has been contained." 13:18 (capacity-ceiling: quality/effort of inputs cannot exceed a fixed container size, so the fix must be structural, not behavioral)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** scope creep: could be used to justify a premature Honcho build — this only reframes where to look; any build decision still needs verification and Warwick's yes

**Your scoring — E18:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E19
**The video makes a sharp claim: if you personally dread or keep deferring a task (he uses sales), that feeling isn't a character flaw — it's proof no system exists yet to carry it without you.**

- **Problem:** The backlog already flags, as HIGH, that live YouTube capture still says 'knowledge note pending — I'll write it next session' — a recurring deferral that's been treated as a to-do rather than read as a diagnostic signal.
- **Implication:** Following the video's logic, the real issue isn't that Larry hasn't gotten around to it — it's that the note-writing step still depends on a future session's attention and mood, exactly the pattern the video says guarantees things stay stuck.
- **Need-payoff:** Instead of another 'I'll write it next session' promise, make the note-writing step fire automatically at capture time (or get queued to a forced job) so it no longer depends on any session remembering to follow through — closing a HIGH item for good rather than deferring it again.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Gateway / TubeAIR knowledge-note capture pipeline
- **Transfer reasoning:** The video reframes procrastination as data about missing infrastructure, not willpower. Applied to the TubeAIR/Gateway 'pending — next session' pattern, the same reframe implies the fix is a forcing function at capture time, not another intention to try harder next session.
- **Source evidence:** "how you feel about sales is irrelevant. In fact, if you feel anything about sales at all, then it just means you've not built a system yet that takes all of this sales stress... off your shoulders" 02:22 (emotional avoidance as a systemization-gap diagnostic, not a discipline failure)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** duplicate-work: verify this isn't already scheduled/in-flight work before building — the backlog item is already known, so the value here is the forcing-function framing, not rediscovery of the problem.

**Your scoring — E19:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E20
**Fusion's Cockpit is meant to give Warwick an at-a-glance, trustworthy read on the idea pipeline and the system's own state.**

- **Problem:** The self-model tables it reads from (cockpit.build, cockpit.overall_state) are already stale — last touched 2026-07-22 — and structured as a single mutable status field rather than named, per-stage counts.
- **Implication:** A stale reading is more dangerous than no reading at all: it manufactures false confidence that everything is accounted for, and problems (a stalled pipeline, a pile-up at one stage) stay invisible until they're already a crisis.
- **Need-payoff:** Restructure the self-model as named, per-stage counts refreshed on a cadence, with drift/staleness itself treated as a trust-breaking defect — not a single freshness-prone blob that can quietly go wrong.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** cockpit.build / cockpit.overall_state — restructure as explicit per-stage funnel counts (proposed / accepted / declined / stale-beyond-N-days) with auto-refresh or drift-detection, replacing the single mutable status field
- **Transfer reasoning:** Invariant: visibility only counts if it's structured as concrete, per-stage counts refreshed regularly — a single summary field that can go stale silently is structurally identical to having no gauge at all, except worse, because a broken gauge is still trusted the way a working one would be. A stale status field will keep being read as authoritative even though it hasn't been refreshed in days; the fix is the same one that turns a feeling about the pipeline into real numbers — named counters per stage, plus drift-detection so staleness itself gets flagged rather than silently accumulating.
- **Source evidence:** "think about driving at night at high speed with no speedometer, with no fuel gauge, with nothing in front of you... you're just driving and you're hoping for the best" 06:00 (instrumentation absent or silently broken → operator can't detect degradation until collision; false sense of motion substitutes for real visibility)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★★☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** scope-creep: the source itself says a spreadsheet-equivalent (a handful of named counters) is sufficient at this scale — don't balloon into a full CRM-style dashboard; vanity-metric: a dashboard that shows numbers but doesn't trigger action from Warwick is decoration — tie stale/quiet counts to something actionable; maintenance-burden: if the refresh mechanism is itself manual, it drifts stale again exactly like cockpit.build already did; already-flagged: staleness is already a logged MED item — the added value here is the 'stale is worse than absent' severity reframing, which should raise its priority

**Your scoring — E20:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E21
**Small service-business owners run their entire sales process from memory, with nothing written down.**

- **Problem:** Because it only exists in one person's head, no one can hand it off, fix what's broken in it, or make it any faster to run.
- **Implication:** They stay capped at whatever revenue one exhausted person can personally close, and any hire they bring in takes months to become useful because there's nothing to train them on.
- **Need-payoff:** An AI-guided interview that pulls the whole sales process out of someone's head in a couple of calls and hands back a written, delegatable system — the same fix a consultant sells one-to-one, but productized and cheap enough to sell at scale.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain (LightRAG->Neo4j compiler) + Cairn intake pipeline, repointed at an external-facing 'sales-process extraction' product for small service businesses
- **Transfer reasoning:** An engine that already takes messy, unstructured, in-someone's-head material and compiles it into a structured, queryable, handoff-ready document can be pointed at a paying external user instead of an internal one: interview or transcribe a business owner about how they actually sell, and generate a written SOP and onboarding doc a hire could follow on day one — turning a consultant's billable week into a repeatable product.
- **Source evidence:** "over the course of a one-to-one call that we did, a couple of consulting calls over the rest of the week, we pulled his entire sales process out of his head. We removed all the dumb parts that he was doing that he didn't need to do" 06:00 (process-extraction consulting engagement (unstructured head-knowledge -> written SOP))
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** scope-creep-into-services: easy to slide back into one-to-one bespoke consulting instead of a scalable product — needs a hard productization boundary (fixed interview flow, templated output) or the economics never beat a human consultant; needs-evidence: no validation yet that small business owners would pay for an AI-generated SOP over just hiring a $500 coach for an afternoon — viability rating is provisional until someone actually asks a real owner

**Your scoring — E21:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E22
**The video's whole first 'job' is: get the sales process OUT of your head and onto paper, because a system that only lives in one person's head is invisible, undelegatable, and depends entirely on that person's mood and memory on any given day.**

- **Problem:** Fusion flagged today (2026-07-26) that Larry's rich context must not evaporate on compaction/restart — right now a fresh or compacted session is exactly the 'lives in your head' failure mode: continuity depends on Larry remembering to reconstruct it, not on a forced process.
- **Implication:** Just like a sales process that 'only works when you're the one doing it,' Larry's context is currently immune to nothing — a bad compaction, a rushed restart, or a distracted session can silently drop the why-we-decided-this thread, and nobody notices until a decision contradicts an earlier one.
- **Need-payoff:** Make context-recovery a forced procedural step on every session start (query the decision-rationale log, don't rely on remembering to), the same way the video insists a sales system must be 'immune to your emotions, whether you're feeling good, bad, sharp, or slow.'

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Larry (orchestrator) — session-context / decision-rationale continuity across compaction and restart
- **Transfer reasoning:** The video's invariant is that anything living only in one person's transient state is unreliable by construction, no matter how good that person is. Larry's session-to-session context is structurally the same kind of thing — the fix isn't 'try to remember better,' it's making recovery a forced, checked step rather than a hoped-for habit.
- **Source evidence:** "sales stop depending on your mood and your memory... it becomes immune to your emotions, whether you're feeling good, bad, sharp, or slow" 04:17 (system immune to operator mood/memory — externalize what lives only in your head)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** scope-creep: risk of building a whole context-governance apparatus before proving the simple version works — matches the already-rejected pattern of building verify/governance machinery before the thing works; keep the first version to 'force a lookup at session start,' nothing heavier.

**Your scoring — E22:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E23
**The video says most struggling business owners are flying blind on their own pipeline — no speedometer, no fuel gauge — so they only find out something's wrong when it's already a crisis.**

- **Problem:** Fusion has its own version of that instrument panel — the self-model tables that record what state the build and the overall system are in — and it's already going stale (cockpit.build last updated 2026-07-22, flagged MED in the backlog) with no cadence forcing a refresh.
- **Implication:** A stale self-model is exactly the 'driving at night with no gauges' failure: everything feels fine right up until something's badly wrong and you can't see it coming, so the fix arrives late and in panic mode instead of calmly.
- **Need-payoff:** Turn the self-model into a genuinely watched gauge — a small recurring check that either refreshes it or loudly flags that it's stale — so you get the 'coffee at the start of the month, look at the numbers' calm instead of a surprise.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit self-model tables (cockpit.build / cockpit.overall_state)
- **Transfer reasoning:** The video's core claim is that invisible state isn't neutral — it silently produces reactive panic. Fusion's own operational self-model (cockpit.build / cockpit.overall_state) is the direct analogue of the missing speedometer: it exists, but nothing forces it to stay true, so it can quietly rot until it misleads rather than informs.
- **Source evidence:** "think about driving at night at high speed with no speedometer, with no fuel gauge, with nothing in front of you... you're just driving and you're hoping for the best" 06:00 (instrumentless operation → invisible-until-crash / feast-famine cycle)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★★ · Fit ★★★★☆ · Impact ★★★☆☆
- **Traps/risks:** metrics-theatre: a refresh cadence that just re-timestamps the table without checking truth would recreate the same blind spot with false confidence.

**Your scoring — E23:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E24
**Warwick tells Fusion what he intends to prioritize — in journal entries, capture-tool decisions, stated session goals.**

- **Problem:** What he says he'll do and what he actually acts on can quietly diverge over many sessions, and nothing is watching for that gap.
- **Implication:** The same deferred decision, person, or task can resurface and get pushed back repeatedly without ever being named as a pattern — costing real opportunity while looking, on paper, like normal backlog churn.
- **Need-payoff:** A recurrence-of-deferral flag — 'you've deferred this three sessions running' — turns a silent avoidance pattern into one explicit, non-judgmental proactive output.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Outputs Layer, cross-referencing PKM/Journal entries and Cockpit 'Later' taps against later session logs to flag recurring-deferral patterns as a distinct proactive-output type
- **Transfer reasoning:** Taking a stated priority at face value misses the real signal, which lives in the gap between what's declared and what actually happens over time. Two halves of that same signal — stated intent and actual outcome — are already captured separately across journal entries, capture-tool decisions, and later session logs; diffing them against each other surfaces avoidance as its own distinct, actionable category of insight, rather than treating it as an ordinary missed-deadline reminder.
- **Source evidence:** "For some business owners, it's a belief that sits deep in the back of the mind, in the subconscious, and until that belief goes, this limiting belief, there is no selling system that's going to stick because they're just going to quietly, unconsciously sabotage it when it is implemented." 13:18 (diagnosing the real bottleneck from behavioral discrepancy (stated priority vs actual follow-through) rather than trusting the stated request)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★☆☆ · Fit ★★★☆☆ · Impact ★★★☆☆
- **Traps/risks:** psychologizing risk: must stay descriptive — 'you've deferred this N times' — never diagnose Warwick's motives; a recurrence flag, not armchair therapy

**Your scoring — E24:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

## Source 3 — Context Graphs (Neo4j)  
_rich, high-relevance positive_

#### E25
**You're trying to work out when the expensive, careful-thinking tier (T2) is actually worth paying for over the cheap fast tier (T1).**

- **Problem:** Right now 'does T2 sound better' is a vibe check on prose quality, not a measurement of whether T2 actually recovered something T1 missed.
- **Implication:** Without a hard test you either pay for T2 everywhere out of caution, or quietly under-invest it somewhere that mattered — and you won't know which until it's too late.
- **Need-payoff:** Plant one fact that's true but doesn't lexically resemble the question, then check which tier actually surfaces it — a repeatable pass/fail test of whether T2 earns its keep, not a taste test.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** services/control-plane/cockpit/t2-calibrate.mjs (T2 calibration harness)
- **Transfer reasoning:** Same question, escalating tiers of context, diff what reappears — turns tier selection into a measurement instead of a judgment call. Folding a planted 'causally relevant, lexically dissimilar' fact into T2 calibration fixtures and scoring tiers on whether it surfaces gives a concrete pass/fail test for when the expensive tier earns its cost.
- **Source evidence:** "So Clearly the patient here has a history of smoking, has had an operation. So there is certain things which are background information that was lost in the similarity search." 04:58 (one fixed question answered at escalating context tiers to reveal exactly which decision-critical fact each tier recovers or silently drops)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** already-doing-it: Haven't verified whether t2-calibrate.mjs already scores on fact-recovery rather than prose quality — check before treating this as new.; needs-evidence: Only one demo case seen; the 'plant a hidden causal fact' protocol needs a few worked fixtures before trusting it as a general test.

**Your scoring — E25:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E26
**Warwick built myPKA to solve his own 'disparate knowledge, no single brain' problem.**

- **Problem:** Every solo operator, consultant, or small team has the exact same problem — knowledge trapped in disconnected tools, no system that remembers context across conversations and decisions.
- **Implication:** That's a large population paying for note apps, CRMs, and assistants separately, getting none of them to talk to each other — and currently nobody is offering them what Warwick already has running.
- **Need-payoff:** myPKA's core spine (Cockpit + Brain + Gateway capture) could be offered as a hosted product to other individuals or small teams, turning a personal tool into a second, direct revenue line.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** myPKA Cockpit + Brain (LightRAG->Neo4j) + Gateway capture — hosted multi-tenant product
- **Transfer reasoning:** Pouring N siloed data sources for an org into one context graph and exposing it through one simple UI is the product, not any single source. myPKA already does this for one user across journal/CRM/sources/decisions; the same spine offered multi-tenant is a sellable product for anyone else drowning in the same fragmentation — a different business from doing Fusion's own knowledge work better internally.
- **Source evidence:** "we've hooked it up to a support ticket system, a CRM, and an internal business data system with 10 different MCP tools that it has access to" 13:25 (multi-source context-graph consolidation behind one simple front end)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★☆☆☆ · Fit ★★★☆☆ · Impact ★★★★★
- **Traps/risks:** scope-creep: This is a full strategic pivot from personal hobby-brain to SaaS business (multi-tenancy, support, onboarding, its own security/privacy bar) — needs its own build-vs-buy decision from Warwick, flagged not built.; already-considered-elsewhere: Overlaps existing 'unified gateway categoriser' and myPKA-as-product notions that may already be parked LATER — check before treating as novel.

**Your scoring — E26:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E27
**Cockpit lets Warwick Accept/Decline/Later an idea with one tap.**

- **Problem:** That tap currently just updates Cockpit's own state — the Brain never finds out what Warwick actually decided.
- **Implication:** The Brain keeps surfacing things blind to Warwick's real accept/reject history, so future output can't learn from his actual choices — it's a one-way mirror, not a loop.
- **Need-payoff:** Every Cockpit decision writes back into the Brain as a reasoning-trace edge, so the next idea surfaced is informed by everything Warwick has already said yes or no to.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit (Accept/Decline/Later action) -> Brain write path
- **Transfer reasoning:** Retrieval and action aren't the end of the cycle — the outcome gets written back into the same graph so future retrieval is smarter. Fusion's Cockpit-to-Brain path is currently one-way (Brain surfaces, Cockpit records); closing it into a write-back loop is what compounding value depends on.
- **Source evidence:** "it's using a combination of knowledge graphs, vector search, and um data science algorithms. Then when you go through the agent loop, it's then pushing that back into the context memory which gets added back into the graph. And subsequent queries are then pulling this back as part of your reasoning traces" 12:31 (closed-loop agent memory write-back)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★☆☆ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** cost: requires a new Cockpit->Brain write trigger that doesn't exist yet — not free, needs its own WP; coupling: must not block the Cockpit UI tap on a synchronous graph write; queue it

**Your scoring — E27:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E28
**Companies putting AI agents into regulated decisions are under growing pressure to show WHY an AI said no, not just that it did.**

- **Problem:** Right now those firms get a verdict with no defensible trail — no auditable chain of reasoning, only a black-box output.
- **Implication:** That's a compliance and reputational liability that grows as governance rules tighten, and it's the exact gap that kills deals or triggers fines.
- **Need-payoff:** Fusion already built the machinery for this internally (the durable decision-rationale log) — repackaged as a 'Decision Provenance' module, it turns a governance chore Fusion already pays for into a product other companies would pay to bolt onto their own agents.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit decision-rationale log + Brain (Neo4j) — externally-sold 'Decision Provenance' module
- **Transfer reasoning:** Storing WHY an agent recommended a decision as a queryable, explainable graph layer separate from the verdict itself — decision provenance as first-class structured data, not prose buried in logs — is already live at Fusion's Brain/Cockpit layer via the decision-rationale log. Stripping it out of internal governance and offering it as a hosted add-on targets SMEs running LLM agents in compliance-sensitive flows who cannot justify building this themselves.
- **Source evidence:** "unlike a traditional audit log, they're capturing the the why, the decision traces that happens while you're evaluating your models" 11:53 (context-graph reasoning trace / financial-services loan-approval demo)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** vendor-pitch-source: the source demo is marketing collateral for a database vendor, not evidence of real paying demand — needs actual buyer conversations before any build.; regulatory-timing-unverified: 'regulation tightening' is asserted, not checked — viability depends on a regulatory landscape not yet verified.

**Your scoring — E28:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E29
**The idea engine already runs a kill-pass (the Critic step) that decides a mined idea isn't worth pursuing.**

- **Problem:** Once an idea is killed, that reasoning just ends — nothing in the current architecture shows it being captured anywhere durable and linked back to its source.
- **Implication:** The same weak or manufactured connection can resurface later and cost you attention re-declining it, and the Brain never gets to learn from its own misses.
- **Need-payoff:** If killed ideas get stored with their reasoning as real graph data — not just discarded — future mining runs can check 'have we already killed this and why,' cutting repeat noise and letting the Brain's judgment compound, the same way the loan system stored the rejection reasoning as carefully as the approval.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** idea-engine Critic kill-pass output -> Brain graph (Neo4j)
- **Transfer reasoning:** SOURCE captures a negative decision (loan rejection) with the same reasoning-trace richness as a positive one; the invariant is 'a decision's reasoning is data regardless of its verdict'; at the idea-engine Critic kill-pass it means persisting killed-candidate reasoning into the Brain graph, linked to the source and entities, instead of letting it vanish once declined.
- **Source evidence:** "the AI model recommends not giving her the loan, but it gives us the reasons, the risk factors, it gives us previous decisions which should influence this." 15:24 (rejection decisions carry a reasoning trace as rich as approvals)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** false-negative-lockin: A killed idea might become viable later with new evidence; the negative trace must act as a prior for the Critic to weigh, not a permanent ban — otherwise it silently pre-filters future Transfer Specialist runs, which breaches this role's own WHOLE-SOURCE/NEVER-MANUFACTURE rules.

**Your scoring — E29:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E30
**Larry keeps a live self-model of Fusion's state in flat SQL tables (cockpit.build, cockpit.overall_state).**

- **Problem:** Those tables only update when someone remembers to write to them, and there's no structural signal when they go stale — cockpit.build hasn't updated since 2026-07-22, 4 days stale as of today.
- **Implication:** Larry could confidently report 'current state' that's actually days out of date, with nothing in the flow surfacing that gap to Warwick.
- **Need-payoff:** Make staleness structurally visible — at minimum a cheap last-write-age check surfaced on read, and further out, model the self-model as its own small graph (separate from the domain graph) written at end-of-turn so staleness becomes a queryable node property instead of a silent row.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** cockpit.build / cockpit.overall_state self-model tables
- **Transfer reasoning:** Keeping 'what is true' (domain graph) separate from 'what we decided and are tracking' (reasoning graph), and refreshing the reasoning graph as a routine loop step rather than an occasional maintenance task, prevents self-models from going stale unnoticed. Fusion's self-model tables are reasoning-graph material but currently live as ad-hoc SQL rows nobody's loop touches, so they go stale silently. The fix has two weights: cheapest is a read-time staleness flag off the existing tables' last-write timestamp; more structural is moving the self-model into its own small Neo4j reasoning subgraph written at end-of-turn, making staleness a visible node-age property.
- **Source evidence:** "we've used our cloud agents to create open AI embeddings and then populated Neo4j context graph with a lot of this information so that it has a domain graph and a reasoning graph which it can look into" 13:45 (two structurally separate graphs — a domain graph of facts and a reasoning graph of decisions/policies/risk — refreshed as a normal step of every agent-loop turn)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** cost: Start with the cheap read-time staleness flag on the existing tables; the full reasoning-graph migration is a heavier structural change and may be over-engineering a currently small, well-understood bug — treat it as a possible phase 2, not the first move.

**Your scoring — E30:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E31
**The Brain's whole reason for existing is to tell Warwick 'you nearly missed this' — something newly relevant that he wasn't looking for.**

- **Problem:** Every retrieval mechanism Fusion has today starts from a query — something has to be asked before the graph answers.
- **Implication:** A surfacing system that only speaks when spoken to can never proactively flag a connection Warwick didn't know to ask about — the one thing the north star actually requires.
- **Need-payoff:** Run the same community-grouping algorithm used for retrieval periodically over the whole graph instead of from a question, and treat 'this node just changed which cluster it belongs to' as the signal — no question needed, no LLM judgment call, just a structural event to surface.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Outputs Layer (proactive surfacing consumer of the Brain's Neo4j graph)
- **Transfer reasoning:** Instead of query-in/answer-out, running community detection periodically as new sources land and watching for nodes whose community membership shifts flips a reactive lookup mechanism into a proactive one: a shift means new information just recontextualized something already in the graph — structurally the definition of 'you nearly missed this,' firing without a question or a separate LLM judgment pass.
- **Source evidence:** "using graph embeddings like fast RP, we can also do vector lookups, which is a great way to get a starting point or hook into the graph where we navigate using algorithms like the Louvain algorithm for community grouping" 09:28 (embedding-based entry point into the graph, then Louvain community-detection traversal outward from that point)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** cost: Periodic Louvain runs over a growing graph (via Neo4j GDS) add an ongoing compute job, not a one-off feature.; needs-evidence: Unverified whether community-membership shifts correlate with actually-useful misses versus noisy graph churn — needs a pilot against real ingested sources before trusting the signal.

**Your scoring — E31:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E32
**The idea-engine (T1 vs T2 calibration) is actively deciding how ideas get scored and stored right now.**

- **Problem:** There's no settled shape yet for how an 'idea', the 'event' of scoring/accepting it, and the 'why' behind that score relate to each other in the graph.
- **Implication:** Without a clean split, idea data, decision events, and rationale risk tangling into one blob of properties on a single node — hard to query, hard to extend as tiers get added.
- **Need-payoff:** Borrow a proven 3-layer shape from a live production example — the thing, the event, the context — as three distinct linked node types instead of one wide node.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** idea-engine graph schema (T1/T2 calibration)
- **Transfer reasoning:** A strict 3-way node-type split (who, what-happened, why) rather than folding decision + rationale into entity properties maps directly onto the idea-engine's live schema question: Idea (entity) / Calibration-run or Accept-Decline (event) / NVFI+traps+reasoning (context) — timed to land while the schema is still being decided.
- **Source evidence:** "we're going to have entities of different people and organizations, um different events for decisions, transactions, and approvals which happened during the workflow... And then the context of why, what policies were applied, what risk factors are there, what was the employee reasoning behind giving a certain recommendation" 13:03-13:25 (entity / event / context three-layer graph schema)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** premature-lock: T1-vs-T2 experiment is still running (frozen harness) — proposing a schema now risks locking in before the calibration result is even in; sequence this AFTER the experiment concludes

**Your scoring — E32:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E33
**Warwick reviews new ideas or recommendations that Larry or the Cockpit surfaces to him, and separately taps Keep/Decline/Later on them.**

- **Problem:** Neither direction currently uses the other — a new candidate isn't checked against prior similar Declines before it's shown, and a Decline doesn't store a reason string that later passes could check against.
- **Implication:** Warwick either burns time re-deciding something he already settled, or a near-duplicate idea resurfaces and gets re-reviewed from scratch, with no compounding signal telling future ideation passes to avoid that territory.
- **Need-payoff:** Capture a reason string on every Decline, check new candidates against it before they're proposed, and surface any match inline as one line ('similar to X, declined Y, because Z') right next to the new recommendation.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit (Keep/Decline/Later) and idea-engine shortlist — precedent surfacing + dedup
- **Transfer reasoning:** Pulling the specific prior decision and reason and putting it in front of the human at the moment of a new decision — rather than leaving it in a general audit trail someone has to dig through — requires two structural pieces: a stored reason (not just a status flag) on the past decision, and a check that runs against new candidates before they're shown. Fusion's Cockpit Decline action and idea-engine currently do neither; wiring both closes that loop.
- **Source evidence:** "You can see there was a previous rejection. ... it gives us the reasons, the risk factors, it gives us previous decisions which should influence this" 14:42 (precedent lookup surfaced alongside a new recommendation, before the decision is made)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** overlap-check: May already be partly covered by the decision-rationale log and by the dedup correction already planned in the Cockpit lift-out (IDEA-016) — confirm scope (do either cover idea Declines specifically, and surface the prior OUTCOME+REASON inline, not just prevent duplicates) before building anything new.; scope-creep: Keep this to one inline line ('similar to X, declined Y, because Z') — do not let it grow into a full audit-trail UI, which is a different and much bigger build.

**Your scoring — E33:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E34
**You've already flagged that Larry's rich context — the reasoning behind decisions — can evaporate when a session compacts or restarts.**

- **Problem:** That context currently lives loosely in memory files and conversation history, not as durable data tied to the actual decisions and entities it belongs to.
- **Implication:** Every session reset risks Larry silently losing the 'why' behind a call, or you having to re-explain things already settled — the exact gap the Fresh-Larry rationale log was meant to close, but it's still a flat log rather than something the Brain can traverse and connect.
- **Need-payoff:** If Larry's in-session working memory gets written into the same Neo4j Brain graph as a distinct 'short-term' layer (separate from settled long-term facts), it survives compaction/restart automatically and becomes queryable, connected data instead of a file you hope gets re-read.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** idea-engine decision-rationale log / Larry context-preservation (Brain graph schema)
- **Transfer reasoning:** SOURCE treats short-term/working memory as a first-class, graph-persisted layer alongside long-term and reasoning memory; the invariant is 'ephemeral working state should live in the same durable structure as settled facts, not a separate fragile channel'; at Larry's session-context layer it means writing in-session working notes/decisions as short-term-memory nodes in the same Neo4j Brain graph, so compaction/restart reads them back instead of losing them.
- **Source evidence:** "short-term memory is things which are happening in the current pipeline with agents, the conversation, the current state of activities... this can all be persistent in the knowledge graph and it gives important information in the execution pipeline." 06:19-06:53 (short-term memory persisted as a distinct graph layer, alongside long-term and reasoning memory)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★☆☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** scope-creep: Risk of designing a full memory-tier taxonomy up front instead of slicing to the narrow case (survive compaction) first — matches Warwick's own 'slice only to prove' rule.; governance: Short-term memory nodes may capture raw conversational content; must confirm none of it is personal/entrusted data before it lands in the Brain graph, per the private-data boundary.

**Your scoring — E34:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E35
**Larry sometimes hits a context compaction or a restart in the middle of a session.**

- **Problem:** Whatever Larry was actively working on right now — not yet written up as a finished note — can vanish when that happens.
- **Implication:** Warwick has to stop and re-explain where things were, or worse, Larry quietly loses the thread and picks back up wrong without either of them noticing until later.
- **Need-payoff:** If Larry's in-flight task state gets written into the graph as it happens, not just summarized at session close, a compaction or restart just means Larry re-reads it and picks up exactly where he left off.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain (Neo4j graph) — current-task/current-session node, written incrementally
- **Transfer reasoning:** Short-term (in-flight) memory as its own persisted category, written incrementally, not reconstructed after the fact. Fusion's current fix for context loss on compaction/restart is session-close logging — after the fact. Writing a distinct current-task/current-session node incrementally, read back first after any compaction or restart, separate from both the long-term domain graph and the decision-rationale log, transfers the incremental-write invariant rather than the summary.
- **Source evidence:** "short-term memory is things which are happening in the current pipeline with agents, the conversation, the current state of activities which your agent architecture is working on. So this can all be persistent in the knowledge graph" 06:19 (explicit short-term memory persisted continuously into the graph, distinct from long-term domain memory)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** overlap-check: The decision-rationale log may already partially cover this — confirm it captures in-flight/incomplete state, not just closed decisions, before building a separate store.; needs-evidence: whether writing on every turn is cheap enough, and whether Larry actually reads it back on restart, needs to be checked before this gets built.

**Your scoring — E35:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E36
**Larry answers Warwick's questions by pulling from the Brain (LightRAG→Neo4j).**

- **Problem:** A vector-similarity retrieval path can lose the one background fact that actually mattered even while it confidently produces an answer.
- **Implication:** Warwick gets an answer that sounds grounded but is actually shallow — worse than 'I don't know', because a confident-sounding generic answer doesn't announce its own gap.
- **Need-payoff:** Confirm brain_ask / output queries walk the graph's relationships for any question tied to a specific entity's history, rather than resting on vector similarity alone.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain retrieval path (LightRAG→Neo4j) feeding brain_ask / output queries
- **Transfer reasoning:** Retrieval method determines what background survives: similarity search can fail to preserve context that graph traversal preserves. At Fusion's Brain/brain_ask retrieval layer, the same failure mode applies if similarity search is the default path for entity-specific questions.
- **Source evidence:** "there is certain things which are background information that was lost in the similarity search" 05:24 (vector-similarity RAG dropping entity-specific background context)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** evidence: unverified whether the current brain_ask path skips graph traversal for entity-specific queries — read the retrieval code before acting

**Your scoring — E36:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E37
**Fusion just started keeping a log of WHY decisions were made (the Fresh-Larry WHY gap fix, seeded 2026-07).**

- **Problem:** That log is a flat file sitting next to the Brain graph, not part of it — so nothing in the Brain can query 'why' the way it queries 'what'.
- **Implication:** Every future agent that needs to explain a past call has to go read a separate document instead of just asking the graph — and the log can silently drift out of sync with the graph it's explaining.
- **Need-payoff:** Fold rationale entries into the Neo4j graph as linked nodes, so 'why' is one Cypher hop from 'what', for any agent, permanently.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain (LightRAG->Neo4j) — decision-rationale log ingestion path
- **Transfer reasoning:** A context graph's structural advantage over a plain audit log is entity/relationship-linked WHY, queryable alongside WHAT. Fusion's decision-rationale log is currently WHAT-style flat storage, not graph-native — folding new entries in as linked nodes closes that gap.
- **Source evidence:** "unlike a traditional audit log, they're capturing the the why, the decision traces that happens while you're evaluating your models" 11:53 (context graph as decision-provenance store vs. flat audit log)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** needs-evidence: confirm current decision-rationale log format before assuming it's flat — check its actual schema, may already be closer to graph-linked than assumed; scope-creep: don't let 'fold into graph' become a full log migration project; start with new entries only

**Your scoring — E37:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E38
**Multiple Fusion specialists all need to read and write the Brain's memory.**

- **Problem:** Right now that most likely means each one hand-writes its own Cypher against the graph directly.
- **Implication:** Every direct-query call-site is a place a future graph-schema change can quietly break something else — there's no shared contract holding them together.
- **Need-payoff:** A thin shared memory-API (fetch short-term / long-term / reasoning) that every specialist calls instead of hand-rolled Cypher — a seam that isolates schema changes to one place.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain (LightRAG->Neo4j) access layer
- **Transfer reasoning:** Packaging graph access behind a standard memory API rather than leaving every agent to query the graph raw addresses fan-out risk (several specialists reading/writing one Brain graph) — but this is weaker fidelity than a data-shape mapping; it's an infra-abstraction pattern.
- **Source evidence:** "it brings these three concepts together, short-term memory, long-term memory, reasoning into a context graph structure" 09:57 (unified memory API package (Neo4j agent memory))
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★☆☆☆ · Fit ★★★☆☆ · Impact ★★★☆☆
- **Traps/risks:** premature-abstraction: Fusion doesn't yet have enough distinct call-sites to justify a dedicated API layer — building this now risks exactly the 'abstraction beyond what's needed' anti-pattern; hold until call-site count justifies it

**Your scoring — E38:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E39
**The Cockpit is your phone-first front door for reviewing mined ideas one at a time (Keep/Decline/Later).**

- **Problem:** As more ideas get mined, if they arrive as a flat list, you have to mentally group the related ones yourself.
- **Implication:** That's exactly the attention-cost you've said you want minimised — more mining should mean less sorting work for you, not more.
- **Need-payoff:** If the graph auto-groups related ideas into thematic clusters before they hit the Cockpit, using graph algorithms Neo4j already supports, you'd review 'the memory-persistence cluster' or similar together instead of shuffling a flat pile.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Cockpit Ideas Brain feed (Neo4j GDS Louvain clustering)
- **Transfer reasoning:** SOURCE uses fastRP vector embeddings purely as an entry hook into the graph, then Louvain community detection to group and navigate; the invariant is 'algorithmic thematic clustering beats a flat similarity-ranked list for surfacing related items together'; at the Cockpit's Ideas Brain feed it means running Louvain over mined-idea nodes so related ideas surface as a cluster rather than a flat queue.
- **Source evidence:** "using graph embeddings like fast RP, we can also do vector lookups, which is a great way to get a starting point or hook into the graph where we navigate using algorithms like the Louvain algorithm for community grouping." 09:08 (vector-entry hook plus Louvain community-detection navigation)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★☆☆
- **Traps/risks:** unverified-dependency: Neo4j GDS (Louvain) plugin availability on the fusion247-core Neo4j 5.26 instance is unconfirmed — needs a Pax check before scheduling, not just assumed present.

**Your scoring — E39:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

## Source 4 — How Audi Cheated in 1988  
_rich, adversarial POOR-FIT_

#### E40
**Every build or session produces a trail — commit messages, session logs, decision-rationale entries, review verdicts.**

- **Problem:** That trail currently exits into a log and sits there unless someone manually re-reads it; the Brain graph is only fed by deliberately-ingested external sources.
- **Implication:** The highest-signal, most user-specific source of all — the operational history of the work itself — never becomes graph fuel.
- **Need-payoff:** Route a thin slice of that trail (starting with decision-rationale entries) back into the Brain via intake, so operational history compounds into future signal instead of sitting inert.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** A lightweight intake path that treats completed decision-rationale entries (and later, session logs) as a Brain source, so operational history becomes queryable graph evidence rather than just an archive.
- **Transfer reasoning:** The turbo's move isn't 'add more fuel,' it's 'stop wasting what you already made.' A decision-rationale log and session artefacts are already generated as a byproduct of normal work — that's the exhaust, currently unused by the Brain. Closing the loop means feeding that exhaust back into the intake so the same operational effort produces compounding signal instead of a one-time record nobody re-reads.
- **Source evidence:** "if we're pushing out all this air at the speed of kaboom, can't we turn it into something useful?... we use the exhaust to spin another thing... to suck fresh air into the engine so the explosions are even bigger" 06:32-07:03 (Turbocharging — a byproduct that would otherwise be discarded is captured and fed back as input to the very process that produced it)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★☆☆
- **Traps/risks:** needs-evidence: Unclear whether session-log volume would flood the graph with low-signal noise next to deliberately-curated external sources — needs a filter/threshold, not a raw dump.; scope-creep-risk: Could balloon into a second full ingestion subsystem — the thin version (decision-rationale entries only) is the whole ask, not a pipeline project.

**Your scoring — E40:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E41
**you've already hardlocked Fable so it can never be summoned without your explicit per-use yes, because it kept 'sneaking in' disguised as GPT-relayed directive or policy text.**

- **Problem:** the way that's being defended right now is reactive — noticing a new phrasing that smuggled it in and patching around that specific wording.
- **Implication:** patch-by-patch defenses fix the shape you've already seen, not the category — the source shows a rule-maker do exactly this (smaller tires, then a restrictor, then ballast) and lose every single time until they finally banned the whole category outright; reactive patching against a determined workaround is a losing game long-term.
- **Need-payoff:** close the whole class at once: treat any GPT-relayed text that reads as a directive/operating-instruction toward summoning Fable as refused-by-default, regardless of its exact wording, rather than adding one more phrasing-specific check.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Governance layer — Fable confirm-first hardlock enforcement against GPT-relayed directive/policy text
- **Transfer reasoning:** The regulator kept writing narrower and narrower rules against the specific technique it had already seen, and the team kept finding a new legal path to the same outcome, because the rules targeted symptoms (weight, tire size, power) not the category (an inherent AWD/turbo advantage). The Fable-hardlock loophole has the same shape: each fix targets one observed phrasing of 'GPT relays something that reads like a directive,' not the category itself.
- **Source evidence:** "You broke the spirit of the rules... the spirit of law is what you wanted to happen or what you meant." [09:08]-[09:59] (tires/restrictor/ballast patches) and [14:22]-[15:52] (spirit-vs-letter argument, then the categorical AWD ban) (incremental letter-of-the-rule patches fail repeatedly against a structural workaround; only a categorical rule closes the gap)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** overreach_risk: a blanket filter on 'directive-shaped' text risks false-positiving on GPT's normal reasoning/relay role — needs careful scoping so it blocks the summon-Fable category specifically, not GPT collaboration generally

**Your scoring — E41:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E42
**Rear-wheel-drive cars push all their power through two tires; the AWD car splits the same power four ways.**

- **Problem:** One heavy channel taking all the load runs hotter and wears out faster than several lighter channels sharing it.
- **Implication:** If a capture→categorise step routes every item through one heavy LLM classification call, that single channel is the one that overheats under volume — cost spikes, rate limits, latency.
- **Need-payoff:** Split the same total classification work across a cheap pre-filter plus a targeted LLM pass, so no single channel carries full load at peak volume.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Gateway capture→categorise→route: split single heavy-LLM classification into a cheap pre-filter + targeted LLM tier to reduce per-call cost/rate-limit load at volume.
- **Transfer reasoning:** Invariant: routing identical total load through more parallel channels lowers peak stress per channel and extends the working life of the weakest one. This maps onto any path forcing all classification/ingestion load through a single heavy channel — splitting into a cheap heuristic pre-filter plus LLM-only-when-needed distributes load the way AWD does.
- **Source evidence:** "Your cars send all their power to the rear wheels. It's like lifting heavy weight with one arm. But our car splits all that power between four wheels... like lifting the same weight with both arms." 11:24-11:44 (all-wheel-drive torque distribution reducing per-wheel thermal/wear load)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** already-doing-it: The idea-engine's own T1-vs-T2 tiering is this exact invariant already implemented elsewhere in Fusion — verify Gateway genuinely lacks it before treating this as new.

**Your scoring — E42:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E43
**Fusion gates real work behind written checklists — NVFI thresholds, Vex's security checklist, Builder Preflight's 7 points, Tower's merge-check, the 'merge-ready means independently reviewed' rule.**

- **Problem:** A checklist can be satisfied on the letter while missing the intent it was written to protect — every explicit item ticked, the actual purpose untouched.
- **Implication:** Something could tick every box — tests exist, reviewers ran, docs match — and still ship the thing the gate existed to stop, because nobody re-asked whether it satisfies what was MEANT versus what was WRITTEN.
- **Need-payoff:** Pair each enumerated checklist with one recurring meta-question — could this be gamed literally and still fail the point of the gate — so gates aren't purely letter-of-the-law and don't need a new clause bolted on after every miss.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Fusion's enumerated review gates as a class — NVFI gating criteria, Vex's security checklist, Builder Preflight's 7-point self-check, Tower's mergeCheck.mjs criteria, and the 'merge-ready = independently reviewed' rule — add an explicit outcome/purpose check alongside the written criteria.
- **Transfer reasoning:** An enforcement system built as an explicit, enumerable rule list can be satisfied literally while violating its underlying intent, and the enforcer's only recourse after the fact is to bolt on more explicit clauses — never to penalize intent-violation directly. Every Fusion gate built the same way — NVFI's scoring thresholds, Vex's security checklist, Builder Preflight's 7 points, Tower's merge-check, the 'independently reviewed' rule — is structurally exposed to the identical gap: satisfied on paper, missed on purpose.
- **Source evidence:** "You can only enforce the letter of the law. What was written. Not the spirit of the law is what you wanted to happen or what you meant." 14:22-14:44 (letter-vs-spirit rule enforcement — an enumerable checklist can only bind what's written, not intent)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** self-referential: Confirm this scrutiny of the idea-engine's own gate is wanted, not just of external systems, before acting on it.; already-mitigated: Codex+Fable independence already closes the crudest version of this gap; the residual risk is narrower — whether checklist wording itself can be satisfied cosmetically.

**Your scoring — E43:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E44
**Rich accumulated context can evaporate on compaction or restart — flagged as a real, unresolved HIGH-ish blind spot this session.**

- **Problem:** Everything currently rides on one long main thread that keeps accumulating load for the whole session, with nothing kept warm in the background between the last durable capture and the moment context is needed again.
- **Implication:** The longer a session runs, the more is riding on that single channel at the exact moment — restart, handback, a live decision — when the accumulated context matters most and is least affordable to lose.
- **Need-payoff:** Two complementary fixes: default to routing heavy token/context churn into subagent dispatches instead of letting it pile onto the main thread for long sessions, and keep a small continuous background state snapshot going during idle so a restart never hits a cold rebuild at the worst moment.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Session/context persistence and orchestration discipline — default to routing heavy token churn into Agent-tool subagent dispatches for long-running sessions, plus a small continuous background state snapshot during idle, aimed directly at the logged compaction/context-loss failure mode.
- **Transfer reasoning:** Two invariants from the same source point at the same gap. First: a single channel carrying full load degrades fastest under sustained duty, and the payoff of splitting it shows up specifically in the later, longer stretches — exactly where session-length compaction risk bites. Second: an expensive-to-restart resource kept artificially warm through an idle phase is instantly ready at peak demand instead of paying a cold-start lag right when it matters most. Applied to session orchestration: push token-churning work off the single main thread into subagent dispatches as a duration-triggered default, and keep a light rolling state snapshot during idle so restart after compaction doesn't cold-rebuild at the worst possible moment.
- **Source evidence:** "our car splits all that power between four wheels... our tires last longer, especially later in the race... If I stay on the gas and press the brake, you slow down for the corner and the turbo keeps spinning." 10:55-14:03 (AWD load distribution (reduces per-channel wear over a long race) combined with anti-lag pre-spooling (keeps an expensive-to-restart process hot through the idle phase))
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** already-partially-covered: Delegation already happens opportunistically; this only adds leverage as a default duration-triggered discipline, not just parallel-independent-work delegation.; needs-evidence: No data yet confirming main-thread token volume is what actually drives the compaction context-loss; worth a quick check before treating this as the fix rather than a hypothesis.; already-partially-addressed: The decision-rationale log already durable-logs WHY; verify this targets compaction/restart continuity specifically, not re-solve rationale capture that's already shipped.; cost: A full context re-embed on every idle tick would be too expensive; needs a small bounded cost, not continuous heavy writes.

**Your scoring — E44:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E45
**An idea-engine's self-kill pass constantly produces candidates recognised, analogised, then killed for lacking fit, viability, or evidence.**

- **Problem:** That discarded output is thrown away every run, even though it's the same raw material other founders/creators pay for as inspiration.
- **Implication:** A saleable-quality byproduct is being generated for free and deleted, while the actual build cost of packaging it is near zero — the analysis already happened.
- **Need-payoff:** A lightweight 'things we didn't build' digest turns work already being done into a second, low-effort revenue or audience-building line.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Transfer-Intelligence specialist's discarded_obvious/zero_reason output, surfaced via Cockpit as a curated public digest or newsletter.
- **Transfer reasoning:** The turbo doesn't add a new energy source; it recaptures energy the engine was already discarding as exhaust and feeds it back to boost intake. A Transfer-Intelligence pass already produces a structurally identical exhaust stream every run — discarded_obvious entries and zero_reason kills — currently vented rather than recaptured. The invariant maps directly onto turning killed candidates into a distinct, sellable output rather than deleting them.
- **Source evidence:** "We thought, if we're pushing out all this air at the speed of kaboom, can't we turn it into something useful?" 06:32-06:49 (turbocharger exhaust-energy recapture — the waste output of one process becomes the input energy of another)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★☆ · Impact ★★★☆☆
- **Traps/risks:** needs-evidence: No proof anyone will pay for or subscribe to a 'rejected ideas' feed — trial with a handful of already-declined Cockpit items before committing a cadence.; cost: Raw discards likely need light editing/anonymising before external release; not literally zero-cost.

**Your scoring — E45:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E46
**A turbo keeps spinning under its own momentum even after the driver lifts off the throttle — the input stopped, but the downstream process didn't, and the trapped pressure has nowhere to go.**

- **Problem:** A system can wrongly assume 'trigger stops → everything downstream stops cleanly'; when it doesn't, pressure backs up silently until it vents itself violently and unpredictably.
- **Implication:** A background loop that runs on its own momentum after its trigger goes quiet — a poller, a retry/backoff loop, a watcher — can build backlog nobody's watching for, then surface as a burst of duplicate processing precisely when nothing looks to be happening.
- **Need-payoff:** Give momentum-carrying background loops an explicit release/reset path when their trigger disengages, instead of relying on 'no new input' to mean 'no residual state.'

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Tower CP watcher and any Gateway/poller retry-backoff loop — check for an explicit reset/drain path when the upstream trigger disengages.
- **Transfer reasoning:** The turbo's failure mode is a missing blow-off valve: the assumption 'stopping the input stops the system' is false because the downstream component has inertia. If an upstream trigger — a channel, a webhook, a message stream — goes quiet or errors, a watcher/poller's own momentum (retry counters, backoff state) may keep building with no explicit drain, then dump as a burst later.
- **Source evidence:** "When we stopped pressing the throttle, we block the flow of air. But the turbo is still spinning and the air has nowhere to go. So it tries to escape." 07:32-07:59 (compressor surge / blow-off — decoupled momentum outliving its trigger with no release valve, so it escapes violently instead)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★☆☆ · Fit ★★★☆☆ · Impact ★★★☆☆

**Your scoring — E46:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E47
**When a system's assumed cause of a problem isn't the verified cause, fixing the assumption doesn't fix anything.**

- **Problem:** Fixing the assumed mechanism instead of the verified one burns a 'fix' and leaves the real cause live to resurface later, worse, because everyone now believes it's handled.
- **Implication:** Two self-model tables have gone stale — if the next fix targets an assumed cause ('someone forgot to update it') without checking the actual write-path mechanism, the staleness just recurs under a different trigger.
- **Need-payoff:** Before patching the stale tables, verify the actual write-path mechanism — what's supposed to update them and where that broke — rather than assuming and re-patching the visible symptom.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** cockpit.build / cockpit.overall_state self-model tables (stale since 2026-07-22) — verify the actual write mechanism before patching.
- **Transfer reasoning:** This is a diagnosis failure, not an engineering one: a plausible, obvious theory of cause is legislated against instead of verified against telemetry. It's tempting to assume a stale table 'just needs a cron re-run' without checking whether the actual update mechanism is broken, missing, or was silently removed — the real cause.
- **Source evidence:** "That doesn't make sense. You were supposed to wear your tires out first... your cars send all their power to the rear wheels... our car splits all that power between four wheels... our tires last longer." 11:24-11:44 (regulator penalizes power/weight (assumed cause) while the real advantage is tire-wear distribution + a turbo-lag workaround (actual cause), so penalties never land)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★★☆ · Fit ★★★★☆ · Impact ★★★☆☆
- **Traps/risks:** needs-evidence: Requires actually tracing what process (if any) currently writes these tables before proposing a fix — otherwise this recommendation repeats the same failure mode it's warning about.

**Your scoring — E47:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E48
**Every Cockpit tap — Keep, Decline, Later — and every candidate the idea-engine kills mid-pass is a verdict on what's actually useful.**

- **Problem:** None of that verdict currently goes anywhere except a log. It doesn't change how the next batch of ideas gets ranked, weighted, or scored.
- **Implication:** The system re-runs the same ranking and scoring logic every cycle regardless of what was just confirmed good or bad — it's burning the same fuel each lap instead of getting a boost from what it already learned.
- **Need-payoff:** Route Cockpit Keep/Decline/Later signal — and the engine's own self-kill verdicts — back into the next ranking/lens-weighting pass and into the scoring stage itself, so acceptance patterns compound instead of dead-ending in a log line.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain graph ranking/lens-weighting pass AND the Transfer-Intelligence self-kill/NVFI scoring stage — both driven by the currently-unused Cockpit Keep/Decline/Later + self-kill signal.
- **Transfer reasoning:** The turbo's invariant: a system's own byproduct, otherwise wasted, is captured on a shared shaft and forced back in as amplified input to that same system's next cycle — no new fuel added, output becomes input. Cockpit Keep/Decline/Later and the engine's own self-kill verdicts are that byproduct today: recorded, not looped. Coupling them back into the ranking/lens-weighting pass, and into the scoring stage that produced the original verdict, closes the shaft that's currently missing.
- **Source evidence:** "We use the exhaust to spin another thing... One side spins from the exhaust and the other side spins to suck fresh air into the engine. So the explosions are even bigger." 06:32-07:03 (turbocharger — exhaust-driven turbine sharing a shaft with the intake compressor)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** already-doing-it: Check whether ObsidiWikAi's lens-conditioning (WP1.5, PR #59) already closes part of this loop before building a new one.; cold-start: A feedback loop needs enough decisions banked before it has anything useful to force back in — early volume may be too low to matter.; scope-creep: Don't let this balloon into a fine-tuning pipeline — an appended log plus a periodic human-readable digest is the whole ask.; privacy: Declined ideas may carry personal context; this corpus stays local, never in the public Fusion247PKA repo.

**Your scoring — E48:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E49
**you're mid-experiment comparing T1 (baseline) vs T2 (enhanced) idea-engine calibration, and T2 keeps winning.**

- **Problem:** the natural reflex when one variant keeps beating another, run after run, is to tune the winner down to 'make it fair' — the process doesn't yet require explaining WHY T2 wins before acting on that result.
- **Implication:** without the mechanism nailed down first, you're exposed to two opposite mistakes at once — nerfing something that's genuinely better, or missing that the win is actually an artifact (a leak, a scoring quirk) dressed up as real skill.
- **Need-payoff:** add one explicit step to the calibration process: before any tuning decision, require a causal explanation of the win margin (not just the score) — cheaper than repeated blind tune-and-retest cycles, and it protects against acting on the wrong read of the data.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** idea-engine T1-vs-T2 calibration harness (services/control-plane/cockpit/t2-calibrate.mjs, t2-experiment.mjs)
- **Transfer reasoning:** The rule-maker's early instinct is to call a repeated blowout result 'cheating' and nerf it on suspicion alone; the story only resolves once the actual mechanism (turbo + AWD + left-foot braking) is explained, and even then the fixes are still symptom-level guesses until that understanding lands. The same reflex risk sits in a T1-vs-T2 result: a consistent gap is a signal to explain, not just a number to close.
- **Source evidence:** "Where did you finish last race? First. And the race before that first. And the race before that first and before that. Fifth. Do they still give out points for fifth?" [05:19]-[05:44], mechanism explained [10:55]-[12:14] before any rule change is treated as legitimate (demanding a causal mechanism for a repeated dominant result before reacting to it)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★★☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** needs_evidence: t2-calibrate.mjs may already capture a causal rationale for T2's wins rather than just a score — check the current script before treating this as a real gap

**Your scoring — E49:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E50
**A real technical mechanism, taught through an adversarial dialogue where a skeptical straight-man forces a plain-English explanation, is itself a monetisable format.**

- **Problem:** Companies with genuinely interesting engineering constantly fail to make it land with a general audience — the info is accurate but the story is missing or told dry.
- **Implication:** The exact cognitive move already used every run — recognise a mechanism, then re-explain it through a forced analogy for a general audience — is the same move that makes this kind of explainer content work.
- **Need-payoff:** Package that recognise-then-analogise step as a script-generation service: feed it a company's real technical mechanism, get back an engaging explainer dialogue, sell it as technical-marketing content.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** The Transfer-Intelligence specialist's recognise-then-analogise step, repointed at external client input as a standalone explainer-script generation offering.
- **Transfer reasoning:** Stating a mechanism and then forcing it into a plain-English analogy a non-expert gets in seconds is the literal recognise-then-analogise step already in use. Re-pointed at a paying client's technical mechanism instead of an internal roster, the same step becomes a content-generation engine: input a client's real technical differentiator, output an engaging explainer script for their marketing.
- **Source evidence:** "Engines take air and fuel and explode it. Here we turn the push from the explosion into spin, and then we use that to spin the wheels. It's like using a revolving door." 06:07-06:32 (adversarial explainer-dialogue format — a skeptic forces a technical concept into a plain-English analogy)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★☆☆
- **Traps/risks:** cost: The engine only produces the written script — voice, video production and distribution are real additional work, not covered by this transfer.; already-doing-it: Adjacent to TubeAIR, which consumes this genre for internal use rather than producing it for clients — check the two don't compete for the same attention/build time before scoping this.

**Your scoring — E50:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E51
**A cold turbo has a beat of dead time between stepping on the gas and power arriving — deadly mid-corner.**

- **Problem:** Drivers found a way to keep the turbine spinning through the corner (off-throttle) so power is already there the instant it's needed, instead of spooling up from cold.
- **Implication:** If a proactive-surfacing pipeline only computes its pass when a trigger fires, there's a real lag between the real-world moment and the nudge reaching the user — by which time the moment may have already passed.
- **Need-payoff:** Keep a cheap background pass over live signals continuously spinning during idle, so the moment a trigger condition is met, the output fires instantly with zero spool-up.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Outputs Layer trigger pipeline — maintain a continuous low-cost background traversal/candidate-generation pass over live signals so trigger-to-card latency is near zero, instead of computing cold per trigger.
- **Transfer reasoning:** Invariant: keep an expensive-to-restart process running through the low-output/waiting phase so that when the trigger condition ends, full output is available with zero spool-up delay — a cold restart would introduce exactly the lag the mechanism exists to kill. This maps onto the risk in a proactive-surfacing design: if relevance computation happens on-demand at trigger time rather than continuously in the background, the nudge arrives late — the same lag the turbo trick eliminates.
- **Source evidence:** "If I stay on the gas and press the brake, you slow down for the corner and the turbo keeps spinning. And the moment I let off the brake... insane inline 5 noises." 13:09-14:03 (anti-lag — two-pedal technique that keeps the turbo pre-spooled through a low-throttle phase)
- **Provisional scores:** Novelty ★★★★★ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** cost: An always-on background pass costs compute/tokens even when no trigger fires; needs a cost ceiling.; needs-evidence: Unverified whether the Outputs Layer (not yet built per backlog) is even at the design stage where this decision is live — confirm before treating as actionable.

**Your scoring — E51:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E52
**Larry carries a lot of live context about you and the work in flight, and the backlog already flags that this context must not evaporate on compaction or restart.**

- **Problem:** there's currently no mechanism to keep that context 'warm' across a gap — after compaction or a restart, Larry effectively cold-starts and has to rebuild understanding from scratch.
- **Implication:** every compaction/restart becomes a mini-outage: you either wait while things get re-derived, or you re-explain things you already told me, and threads that never got written down can quietly go missing.
- **Need-payoff:** a small, cheap 'keep it spinning' touch on the critical context — done periodically even when it's not actively needed — means that when you do need full context, it's already primed instead of cold, the same way a driver feathers the brake to keep the turbo spooled through a corner instead of losing boost and waiting for it to rebuild.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Larry/Brain session continuity across compaction and restart (the flagged 'context must not evaporate' backlog item)
- **Transfer reasoning:** Turbo lag is a latency problem: the component that provides power needs continuous exhaust flow to stay 'ready', and any gap (lifting off) causes it to spin down, so power isn't there when you next need it. The fix isn't a bigger turbo, it's a small continuous background action (trail-braking) that keeps it spinning through the gap. Larry's context has the same shape: a rich, 'spun-up' understanding of you and the work that spins down across a compaction/restart gap, forcing a slow rebuild ('lag') right when it's needed most.
- **Source evidence:** "We found a problem with our turbo, and we fixed it by pressing the brakes more... if I stay on the gas and press the brake, you slow down for the corner and the turbo keeps spinning. And the moment I let off the brake — insane power." [12:42]-[13:57] (left-foot braking to keep the turbo spooled through a corner, eliminating lag on corner exit)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★☆☆ · Fit ★★★★★ · Impact ★★★★☆
- **Traps/risks:** needs_evidence: check whether the existing prompt-cache TTL mechanism already gives this 'stay warm' effect before building anything new — don't duplicate an existing keep-alive

**Your scoring — E52:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

## Source 5 — Clean an Air Fryer (26s)  
_thin / negative_

#### E53
**The Brain's hot-air circulation is exactly what makes the graph valuable - relation-propagation and similarity-linking connect facts across separate sources.**

- **Problem:** That same connective mechanism can carry a bad or duplicate entity out to everything it links to, not just the one ingest it came from.
- **Implication:** A single messy source doesn't stay contained to its own node - the very mechanism that makes the Brain useful is the one that fans mess out network-wide, so a small ingest error can surface far from where it entered.
- **Need-payoff:** Graph-signal auditing should explicitly trace propagation paths along relation/similarity edges, not just check individual nodes in isolation.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Neo4j graph-signal audit - relation-propagation and similarity-edge logic in the Brain compiler
- **Transfer reasoning:** Invariant: when one mechanism is responsible both for a system's core value and for distributing its byproducts, contamination is never localized to the input point - it travels wherever the value-producing mechanism reaches. A bad entity travels wherever relation-propagation/similarity-matching reaches, which reframes graph-signal auditing from per-node checks to path-tracing.
- **Source evidence:** "The heat from the air fryer circulates that grease all around." 00:00 (the value-producing mechanism (circulation) is also the contamination-spreading mechanism)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** duplication-risk: may already sit inside the delegated graph-signal audit's scope - check that report before spinning up new work; unfalsifiable-as-stated: no concrete evidence yet that a bad ingest has actually propagated this way - treat as a hypothesis to test, not a confirmed defect

**Your scoring — E53:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E54
**Dedup/entity-merge corrections for the graph are already planned as part of the Cockpit lift-out work.**

- **Problem:** The video warns that most cleaning hacks 'do more harm than good' because they scratch the non-stick coating for a quick win. The same shape of mistake is available in dedup logic: an automated merge that looks like a fast, effective cleanup can permanently collapse two genuinely distinct entities.
- **Implication:** Grease can be re-cleaned next time; a bad auto-merge can't. If dedup is built to auto-merge or auto-delete outright, one bad match doesn't just add noise — it destroys the pre-merge state for good, the same way an abrasive hack destroys a coating with no way back.
- **Need-payoff:** Make irreversibility — not confidence-of-match or how 'trusted' the automation is — the trigger for a human gate: any merge/delete that can't be trivially undone gets staged for review; anything reversible can run automatically.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain — Neo4j entity-resolution/dedup logic (Cockpit lift-out corrections)
- **Transfer reasoning:** The invariant: shortcuts that trade speed for irreversibility are the dangerous ones, regardless of how good they look in the moment — the coating damage isn't visible until it's already done. Fusion's existing principle is 'human-in-the-loop while proving, automate once trusted,' which gates on trust level; this sharpens the actual criterion to irreversibility of the specific action, since a trusted automation can still perform an unrecoverable merge.
- **Source evidence:** "There are tons of cleaning hacks out there, but keep in mind that most will do more harm than good" 00:00 (a fast shortcut that appears to clean but permanently damages the substrate)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★☆ · Impact ★★★☆☆
- **Traps/risks:** already_known_principle: only survives as non-redundant if the dedup design isn't already gating on reversibility specifically — if it is, this collapses into the existing 'automate once trusted' principle and adds nothing.

**Your scoring — E54:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E55
**Some inputs to the Brain are known in advance to be messy - raw YouTube transcripts, voice notes, and large bulk imports - while most content flows in clean.**

- **Problem:** Cleanup for these known-messy paths currently happens only after the fact, once duplicates and junk have already merged into the live graph, instead of being intercepted before they ever touch it.
- **Implication:** Cleaning up after the mess has already merged into the graph is far more expensive and riskier than catching it at the door - once junk is baked into relations and merges, unpicking it is much harder than filtering it on the way in.
- **Need-payoff:** A cheap, selective pre-ingestion interception layer - applied only to source types already known to run messy - sits between capture and the live graph, catching mess before it ever reaches the core.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Pre-ingestion staging/normalization for known-messy input paths: Gateway-side normalization for raw transcripts/voice notes before they reach the Brain's extraction stage, plus a staging/quarantine layer for bulk/high-volume imports (WS-002/Silas route) before merge into the live graph
- **Transfer reasoning:** Invariant: when you already know in advance which inputs will run messy, intercepting the mess at the boundary with a cheap, selective barrier is structurally cheaper than cleaning the core mechanism after contact. That applies twice here: at the Gateway, known-messy source types (raw transcripts, voice notes) can be normalized before they reach the Brain's extraction stage; and for known-messy volume patterns (bulk/high-volume imports), the same liner logic argues for a staging layer before merge into the live graph, so a bad batch is a delete, not a graph repair. Existing no-LLM transcript cleanup for YouTube sources is the closest working precedent for the first case.
- **Source evidence:** "For really messy recipes, grab some perforated air fryer parchment sheet." 00:00 (a disposable liner intercepts mess before it reaches the core surface, used selectively by mess-level of the input)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★★☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** scope-creep: must stay a thin optional pre-filter, not a new general ingestion layer - echoes the BUILD-014 platform-instead-of-slice mistake; already-partial: YouTube transcript cleanup already does this for one source type - confirm whether extending to others is genuinely new ground; needs-evidence: unverified whether bulk imports already stage before touching the live graph

**Your scoring — E55:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E56
**Every source that gets ingested into the Brain passes through one specific step: entity extraction and merge, the part of the pipeline that actually turns raw text into graph nodes.**

- **Problem:** That's exactly the stage where mess collects - duplicate entities, uncertain merges, contradiction flags - but none of it shows up if you just browse the graph normally, same as grease you'd never see just by glancing at a clean-looking basket.
- **Implication:** Left unchecked, the buildup sits at one concentrated point and quietly degrades everything downstream that reads from the graph (Outputs Layer, Cockpit surfacing) without ever throwing an obvious error.
- **Need-payoff:** A recurring, narrowly-targeted audit of just the extraction/merge stage - not a full graph review - would catch it early, the same way you'd specifically check around the heating element instead of only wiping the basket.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain compiler's LightRAG->Neo4j entity-extraction/merge stage (the step ObsidiWikAi's WP1.5 lens-conditioning already touches)
- **Transfer reasoning:** Invariant: in a system with one central transformation point, that point accumulates a byproduct of its own operation - not from misuse - and the byproduct is invisible to normal-mode inspection, only found by looking directly at that component. General upkeep misses the one place actual transformation happens, so the fix is a narrow, recurring check aimed at that single stage rather than a broader sweep.
- **Source evidence:** "Cleaning around the heating element. This is what it looks like if you don't routinely clean it." 00:00 (targeted inspection of the core active component, distinct from routine surface cleaning)
- **Provisional scores:** Novelty ★★☆☆☆ · Viability ★★★★☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** scope-creep: keep this a thin recurring spot-check, not a new governance platform - echoes the BUILD-014 lesson about building the machine instead of the thing; evidence-needed: unverified - needs confirmation the extraction/merge stage currently lacks any targeted audit before this is built

**Your scoring — E56:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E57
**Right now, the only thing that gets looked at is what surfaces in the Cockpit — the ideas and sources you actually see and Accept/Decline.**

- **Problem:** The Neo4j/LightRAG graph underneath never gets its own inspection. Every ingestion, even a throwaway 3-minute cleaning-tips video like this one, writes new entities, embeddings and relationships into that shared substrate — and none of it gets checked unless a downstream card happens to look obviously wrong.
- **Implication:** Like grease from basic fries quietly coating the whole inside of the air fryer, low-grade or messy extractions can build up in the graph's internals for months without anyone noticing — until Outputs start surfacing duller or wrong ideas, by which point the rot is baked into everything downstream.
- **Need-payoff:** A scheduled, separate substrate check — orphaned nodes, drifted embeddings, index bloat — run on the graph itself, independent of whether any single source's card looked fine, catches structural decay before it quietly degrades every future output.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain — Neo4j/LightRAG graph internals (entity + embedding layer), as a check distinct from Cockpit per-source review
- **Transfer reasoning:** The invariant: the part touched by EVERY use, including trivial ones, and never directly interacted with by the user (heating element) silently accumulates residue and is exactly the part people skip because it's invisible — while the visible 'basket' gets all the attention. At the Brain, Cockpit per-source review is the basket; the Neo4j/LightRAG entity and embedding layer is the heating element — touched by every ingestion, inspected by no one.
- **Source evidence:** "here is a step most people skip. Cleaning around the heating element... remember that heating even basic French fries can leave your air fryer greasy. The heat from the air fryer circulates that grease all around" 00:00 (invisible high-traffic internal part accumulates residue from every use (even the most basic one) while attention stays on the visible surface)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★☆ · Fit ★★★★☆ · Impact ★★★☆☆
- **Traps/risks:** possible_overlap: backlog already flags 'stale Fusion self-model tables' (cockpit.build/overall_state) as MED — that's status metadata, not graph internals, but check for overlap before standing up a second monitoring path.

**Your scoring — E57:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E58
**Larry's own self-model tables - cockpit.build and cockpit.overall_state - sit outside the normal day-to-day work loop, so nobody is naturally in them the way they're naturally in the Cockpit's visible screens.**

- **Problem:** These tables have already gone stale (last touched 2026-07-22) because updating them is a manual afterthought that's easy to forget, while attention stays on the visible surface.
- **Implication:** By the time anyone notices, Larry has been reasoning from an outdated picture of what's actually built - the same way a hidden, un-cleaned component quietly gets worse while everything visible still looks fine.
- **Need-payoff:** Bind the self-model refresh to the event that makes it stale - a merge or build - so it fires automatically every time, rather than depending on someone remembering to run a periodic check.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** cockpit.build / cockpit.overall_state self-model tables (plus cross-compaction context store) - refreshed automatically on every merge/build event rather than manually
- **Transfer reasoning:** Invariant: the component hardest to see gets the least maintenance and the worst decay, precisely because looking fine at the surface hides it. The self-model tables (cockpit.build, cockpit.overall_state) and cross-compaction context are structurally the same kind of component - internal, load-bearing, invisible during normal use. The fix is to bind their refresh to the event that dirties them (a merge or build) rather than to memory or a calendar, so the hidden layer gets the same 'clean after every use' treatment the visible layer already gets.
- **Source evidence:** "Cleaning around the heating element. This is what it looks like if you don't routinely clean it. I borrowed a friend to show you just how bad it can get." 00:00 (neglected-because-invisible component silently accumulating damage, routinely skipped)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** scope-creep: keep this a lightweight post-merge hook touching the two known-stale tables, not a new monitoring/observability platform - the BUILD-014 mistake; needs-evidence: confirm stale tables actually degrade decisions rather than being only cosmetically stale, by checking what currently reads from them

**Your scoring — E58:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E59
**There are plenty of quick cleaning hacks that promise a fast fix but actually scratch the surface they're meant to help.**

- **Problem:** The same trap exists for Fusion's governed knowledge graph: a quick manual edit written straight into Neo4j or Directus to fix something fast bypasses the governed ingestion pipeline and scratches the canonical guarantee that every fact lives in exactly one governed place.
- **Implication:** It looks like a harmless shortcut in the moment, but it seeds a small permanent scratch - a fact now out of sync with its source of truth - that gets worse every time the same shortcut gets reached for again.
- **Need-payoff:** Treat any direct/manual write to the graph or Directus store as an abrasive hack by default: route fixes back through the governed pipeline, or explicitly flag and track the scratch so it doesn't silently compound.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Neo4j knowledge graph / Directus canonical store - manual writes bypassing the governed ingestion pipeline
- **Transfer reasoning:** Inverted assumption: 'a quick fix is harmless because it solves the immediate problem.' In fact the fix itself is the damage vector because it acts on a surface that needs a specific, gentler process. The governed graph/store is exactly this kind of surface: it needs to be written to only through its designed pipeline, not patched directly.
- **Source evidence:** "There are tons of cleaning hacks out there, but keep in mind that most will do more harm than good." 00:00 (well-intentioned shortcut that damages the protective surface it was meant to help)
- **Provisional scores:** Novelty ★★★★☆ · Viability ★★★☆☆ · Fit ★★★★☆ · Impact ★★★★☆
- **Traps/risks:** manufactured-risk: no confirmed instance yet of a manual Neo4j/Directus write bypassing the governed pipeline on this repo - this is a preventive pattern from the analogy, not an observed incident

**Your scoring — E59:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

#### E60
**Every routine capture into the Brain - an ordinary YouTube transcript, a quick journal note - passes through the same shared ingestion mechanism as any large or obviously messy import.**

- **Problem:** If graph hygiene passes only trigger off perceived-messy events (bulk imports, migrations), the ordinary day-to-day captures can still quietly foul the graph between those passes, because whatever mechanism touches the whole graph on ingest (re-embedding, re-clustering) touches it on every input, big or small.
- **Implication:** Nobody budgets cleanup time for 'just a routine note', so drift from everyday captures accumulates invisibly while attention stays fixed on the big, obviously messy imports instead.
- **Need-payoff:** Run graph hygiene on a fixed cadence regardless of how clean recent inputs looked, rather than triggering it only off perceived-messy events - sized for cumulative routine drift, not just flagged large imports.

<details><summary>Details (evidence · reasoning · scores)</summary>

- **Suggested target:** Brain/Neo4j hygiene-pass trigger logic - moving from messy-event-triggered to fixed-cadence, to catch drift from routine everyday captures as well as bulk imports
- **Transfer reasoning:** Invariant: fouling here doesn't come from extreme inputs but from the ordinary operating mechanism touching the whole system on every routine use. If any Brain process similarly touches the whole graph on every ingest, it will foul the whole graph on routine, low-effort captures just as much as on big imports - so a hygiene trigger keyed to 'was this input messy' misses the actual fouling pathway. The fix is a hygiene pass on a fixed cadence, independent of perceived import size.
- **Source evidence:** "Remember that heating even basic French fries can leave your air fryer greasy. The heat from the air fryer circulates that grease all around." 00:00 (routine normal-use residue circulating through the whole system via the same mechanism that produces its value)
- **Provisional scores:** Novelty ★★★☆☆ · Viability ★★★★★ · Fit ★★★★★ · Impact ★★★★★
- **Traps/risks:** needs-evidence: assumes the ingestion pipeline has a global-touch property (e.g. re-embedding reaching unrelated nodes); if ingestion is genuinely localized/incremental the transfer collapses - verify the mechanism before acting; already-doing-it: if a fixed-cadence hygiene pass independent of import size already exists, this is redundant - check the current maintenance schedule first

**Your scoring — E60:** DEFENSIBLE ______ · VALUE ______ · TIMING ______ · SURPRISED ______

</details>

## Source 6 — Clean an Air Fryer (7s)  
_thin / negative_

_Both engines emitted zero here — nothing to score (expected for this source class)._

---
_run 45fc7e1b · 2026-07-26 19:50 UTC_
