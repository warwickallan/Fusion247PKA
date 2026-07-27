---
source_id: m6IXL_YGqBQ
type: source-knowledge-note
source_type: youtube_transcript
title: This New Skill Finally Solves Thinking For AI Agents
source_url: "https://www.youtube.com/watch?v=m6IXL_YGqBQ"
video_id: m6IXL_YGqBQ
channel: AI LABS
published: 2026-07-22
transcript_source: auto_captions
captured_at: "2026-07-26T08:42:21+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/m6IXL_YGqBQ/tubeair-report.md
  - Sources/_raw/m6IXL_YGqBQ/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is an AI Labs (software company/YouTube channel) product video reviewing a trending open-source Claude Code / Codex skill (unnamed by proper noun in transcript, referred to as "the ADHD skill") that fixes a specific failure mode: coding agents asked to brainstorm or ideate default to safe, repetitive, reworded-not-different answers. The skill fixes this by forcing the agent to fragment its own attention — spinning up multiple isolated sub-agents ("tree of thought"), each reasoning through a different "frame" (lens) on the same problem with zero shared context, then scoring and merging the results via a critic agent. The video matters because it names a concrete, install-now tool plus two demonstrated high-value use cases (test-strategy planning, pre-launch UX/churn review) that map directly onto Fusion247's own agent-orchestration practice (Larry's team-of-specialists model).

## What the source says

### The core problem: agents can't ideate
[00:00–02:08] Every agent (Claude Code, Codex, "pretty much every other agent") can think a problem through step by step but cannot generate genuinely new angles. Asked for brainstorm variations, what comes back "sounds different when you read it, but all of them are just the same idea reworded differently." The presenter frames this as inherent to how LLMs are trained: a model reaches for "the pattern that showed up most often in the data it learned from, because seeing the same answer repeated is what taught it that the answer is a good one." This isn't wrong, just narrow — it never surfaces the other viable angles.

### The counterintuitive reframe: splitting already happens for execution, never for ideation
[00:41–01:40] The video explicitly sets up an assumption-then-reversal: agents are already good at decomposing large **execution** tasks — they break big tasks into chunks, hand them to sub-agents each in its own context window, and run work in parallel automatically, without being asked. The assumption a viewer might carry is "well then they must decompose brainstorming/ideation the same way." **The reversal: they don't.** "All of that splitting up only happens for the work itself. None of it happens when you ask them to ideate." Ideation stays in one shared context window, so ideas "bleed into each other" and the context fills with noise, making the thinking worse, not better. This gap — decomposition-for-execution vs. no-decomposition-for-ideation — is the whole reason the skill exists.

### The "ADHD" framing itself (a second reversal)
[02:08] The presenter names the tool's core trick "weirdly enough... actually ADHD" — a condition normally framed as a deficit (attention scattering instead of staying on one thing) is reframed as "a superpower when you're an AI agent." The assumption being overturned: scattered attention is bad. The reversal: for creative ideation specifically, forcibly *scattering* an agent's attention across isolated parallel threads is what produces real creative range, because it prevents any one line of reasoning from converging early onto the "safe," most-common answer.

### How the skill works — tree of thought + frames + critic
[02:08–04:38]
- **Tree of thought structure:** the problem is split across separate agents, each an independent branch, that work in isolation on different ideas — the same way tree branches split apart. Once each branch settles on a possibility, all branches merge back into a final answer.
- **Isolation is deliberate and total:** each spun-up agent works in its own context window and gets a different "framing" of the same problem. They share zero context and don't know what the other branches are doing. The stated purpose of isolation is *not* to divide labor (as with normal task-splitting) but purely to keep ideas from influencing/contaminating each other.
- **Frames:** the mechanism that keeps agents apart is a "frame library" — a set of different lenses through which to view the problem. Each agent is assigned one frame from the library and receives that frame's prompt, plus the system prompt, plus the original problem.
- **Critic agent scoring:** after branches return, a separate critic agent grades every idea on three axes: **Novelty** (how new/creative), **Viability** (could you realistically build it), **Fit** (how well it matches the actual problem). The critic runs under a prompt instructing it to act as "a skeptical senior engineer," i.e., deliberately hard-to-please, and decides survive-or-discard per idea based on score.
- **Shortlisting + trap list:** the skill shortlists the strongest ideas and also produces a "trap list" — problems each surviving idea could cause if actually implemented — then prioritizes ideas flagged as "non-obvious."

### Deliberate anti-laziness instruction inside the skill
[05:18] The skill.md file itself explicitly instructs agents to push past their first three answers, stating that the first three responses are "the most common responses in the data these models learned from" and "the ones any senior agent could come up with immediately" — the genuinely interesting output only starts after that point.

### Cost control: a pre-check gate before burning tokens
[05:18–06:27] Because spinning up many parallel agents is token-expensive, the skill only auto-fires after passing a 3-question pre-check (this only applies when the agent decides to auto-invoke the skill — calling it explicitly via slash command or direct request skips the gate and fires immediately):
1. **Is the problem open-ended?** — would an experienced person have multiple different valid answers, or is there only one right answer? If only one right answer exists, multi-angle thinking is pointless/wasteful and it stops.
2. **Are the stakes actually high?** — would it genuinely cost something if the obvious/first answer were wrong?
3. **How was it asked?** — wording like "quick" or "standard" signals the user wants the straightforward answer, so the skill stands down.

## Mechanisms, methods & implementation detail

### Installation [04:38–05:18]
- Install command is on the project's GitHub repo (not named/spelled out in the transcript — no URL given).
- Run the install command in a terminal opened in the target project.
- It prompts for **which coding agent** to install for — supports "more than 45" agents.
- It prompts for **scope**: project-only vs. available from any project.
- Default install lands the skill in a folder called `.agents` — this is what tools like Codex use for configuration, but **Claude Code only recognizes a `.claud` folder by default**, so Claude Code users must rename `.agents` → `.claud` for it to be picked up.
- End result: a single `skill.md` file that "handles everything by itself with no reference files or dependencies next to it."

### Invocation modes
- Explicit: call via a slash command or ask for it directly → skips the pre-check, fires the full multi-agent process straight away (this is how both demonstrated use cases were run).
- Implicit: agent decides on its own to invoke it → gated by the 3-question pre-check described above.

### Workflow use case 1 — Test-Driven Development test planning [07:51–10:52]
Preconditions the presenter says are necessary before running the skill for this purpose:
- A **PRD** (Product Requirements Document) — lays out what the app does, the problem it solves, goals, and audience.
- A **technical specification document** — locks in technical/tool choices so the agent isn't re-asked repeatedly.
- Both documents linked inside the project's `claude.md` file so the agent has that context from the start.

Procedure: invoke the skill's slash command with a prompt describing the app and asking it to "write test cases using a TDD approach." Because invoked explicitly, it skips the pre-check and spins up **five agents** immediately, each reasoning via the frame best matching the problem, each producing a different testing approach. The critic scores each against novelty/viability/fit, the **top three** are picked and explored in more depth.

**Score notation observed:** shorthand like `N9` (novelty=9), `V8` (viability=8), `F10` (fit=10, i.e. perfect). Each surviving idea comes with: a build sketch, the risks involved, and first steps to get started.

**Output and limits:** the skill produces the *testing strategy/plan* — three deeply explored branches, each covering a different path through the application, including edge cases and performance issues that a normal single-pass agent test-write would miss. **The skill does not write the tests themselves** — it hands back the strategy, and the user picks one direction (or all three) for the agent to actually implement. Implementing all three takes longer since the agent works through them sequentially, one at a time. The presenter's stated payoff: much more detailed tests than would otherwise result, because the whole strategy was planned in depth before a single test was written — useful pre-build since it covers most ground upfront and reduces the odds of breaking the app later.

### Workflow use case 2 — Pre-launch UX / churn evaluation [10:52–12:20+]
Procedure: run the skill on an app about to ship, ask it to evaluate the user experience and flag anything that could confuse users or drive **churn** (defined in the source as "when people stop using your product after they've already started" — commonly because a feature didn't work as expected, especially on a paid product where they then want a refund).

Applied by the presenter's own team on their own community website mid-launch of a new feature (chosen carefully because they already have a large existing member base and don't want to break the experience for existing users). Steps taken: invoked via slash command, gave it the feature description, asked it to identify churn risks / bad-experience risks. The skill first went through the application in depth to gather context, then spun up its branch agents the same way as before, and surfaced **around 30 different ideas/findings**. Top three were selected and explored further. Each finding came graded on novelty/viability/fit, with a suggested fix and an associated list of traps/risks.

**Notable catch reported:** it found gaps that "had gone completely undetected" — specifically, features promised in the PRD that were never actually built, meaning the team would have shipped something not matching what they'd said it would do.

**Same output limit as use case 1:** the skill does not implement fixes itself — findings are handed back to the (presumably a different/normal) agent to implement. The stated benefit is surfacing these issues before public launch rather than after.

## Tools, people, products & organisations
- **AI Labs** — the channel/company producing this video; self-described as "a software company" whose channel focuses on showing how to optimize processes with AI, based on their own internal practice.
- **The "ADHD skill"** — the video's central subject; an unnamed-by-proper-noun (in transcript) trending skill/tool for Claude Code, Codex, and 45+ other coding agents. Ships as a single `skill.md` file. Source/repo referenced as "the project's GitHub repo" but no URL or exact name given in the transcript.
- **Claude Code** — named explicitly as one target agent; also the specific agent for which the `.agents`→`.claud` folder rename workaround is needed.
- **Codex** — named as another target agent; also cited as an agent that natively uses the `.agents` config folder.
- **AI Labs Pro** — the presenter's paid community, described as where "all the skills, workflows, and resources" shown in their videos are made available; monetization/support plug, not itself analyzed.
- **TopView** — this video's **sponsor segment** [06:27–07:51], clearly a paid placement, not part of the core skill review. Described as "the world's first all-in-one AI video skill" living inside coding agents (Claude, Code, Cursor, Codex), aggregating multiple video-generation models (VEO, Kling, SeaDance, Nano Banana, "and more") behind one interface so a single agent command can batch-generate many video variants (demo: "10 variations of a 15-second TikTok ad" from one product image). This is sponsor content and is not connected mechanically to the ADHD/tree-of-thought skill.

## Examples & use cases
1. **TDD test-strategy generation** — five parallel framed agents propose different testing approaches for an app; critic scores and shortlists top 3; output is a strategy document (build sketch, risks, first steps, N/V/F scores) that a human/agent then implements. Result cited as far more edge-case and performance-issue coverage than a normal single-pass test-writing agent produces.
2. **Pre-launch UX/churn review** — run against the presenter's own community website mid-feature-launch; surfaced ~30 ideas, narrowed to top 3, including a concrete catch of PRD-promised-but-unbuilt features that would otherwise have shipped silently broken/missing.

## Claims & confidence
- Agents fall back to the most statistically common answer when asked to ideate, rather than genuinely novel angles — **[opinion/claim, medium confidence]**: presented as the presenter's causal explanation of model behavior; plausible and consistent with known LLM behavior, but not independently sourced or benchmarked in the video.
- Agents already auto-decompose large execution tasks into parallel sub-agent chunks without being asked — **[claim, medium confidence]**: asserted as general behavior of "Claude Code, Codex, or any other agent"; no citation, but matches known agentic-tool patterns (todo lists + sub-agent delegation).
- The skill "picked up a lot of stars within a few days" (i.e., is genuinely trending on GitHub) — **[claim, low-to-medium confidence]**: unverifiable from the transcript alone; no repo name, star count, or date given.
- The skill supports "more than 45" agents — **[claim, low confidence]**: stated as fact during the install walkthrough, not independently verified in the video.
- Critic agent grades on Novelty/Viability/Fit and this reliably distinguishes worthwhile ideas from noise — **[opinion, medium confidence]**: this is the tool's own design claim as relayed by the presenter; the video's two demos support that scoring output exists and was used, not that it is reliably calibrated or accurate.
- Running the skill produced materially better test coverage and caught real UX/churn risks (incl. an unbuilt-but-promised feature) — **[claim from direct first-party demonstration, medium-high confidence]**: the presenter reports this from their own team's actual use on their own product, which is stronger evidence than a hypothetical, but it is still self-reported and unverified by any outside party or metric.
- The skill only plans/strategizes — it does not write tests or implement fixes itself — **[fact as stated by source, high confidence]**: stated plainly and consistently across both demonstrated use cases as a design boundary of the tool.

## Caveats & source gaps
- **No exact name, repo URL, author, or license for the core skill** is given anywhere in the transcript — "the ADHD skill" is the video's own informal label, not necessarily the tool's actual name. This is a significant gap for anyone wanting to install it from this note alone.
- **No performance/cost data**: the video says spinning up multiple agents "burns a lot of tokens" but gives no concrete cost, latency, or token-count figures for either demonstrated run.
- **No frame library contents shown**: the video mentions a "frame library" and a "table of frames" exists inside the skill but does not enumerate or describe any specific frames.
- **No detail on the merge step**: how branches are actually merged/synthesized into a "final answer" after critic scoring is asserted but not mechanically explained.
- **Pre-check gate details are thin**: the three gate questions are stated, but there's no detail on how the agent operationalizes "is this open-ended" or "are stakes high" — e.g., no rubric, no examples of borderline calls.
- **Anecdotal, single-source evidence only**: both use-case demonstrations are the presenter's own, self-reported, unaudited by any third party — there's no external benchmark, comparison against a baseline (e.g., same task without the skill), or long-term outcome data (e.g., did churn actually drop after shipping the fixes).
- **Sponsor content is embedded mid-video** (TopView) and should not be mistaken for an endorsement connected to the ADHD skill's technical claims — it's a separate, paid, unrelated product.

## What this means for Fusion247
*(Cairn's interpretation — not sourced from the video.)*

- This is a close external validation of the idea-engine architecture already authorized for Fusion247 ([[idea-engine-agent-architecture]]): Arc's role (divergent, multi-frame generation) maps closely onto this skill's tree-of-thought/frame-library step, and Mason's role (convergent synthesis) maps onto the critic-agent's Novelty/Viability/Fit scoring and shortlisting. The video is effectively independent evidence that this two-faculty (diverge-then-converge) pattern is a recognized, currently-trending solution to the exact "agents give safe, reworded answers" problem Fusion247's own idea engine was built to solve.
- Worth flagging: Fusion247's NVFI scoring convention already mirrors this tool's N/V/F grading almost exactly — the "I" (impact, presumably) is Fusion247's own addition beyond what this source shows.
- The isolation discipline described here (agents "share zero context... so ideas can't influence each other") is a concrete, reusable design detail: it argues Fusion247's own Arc/frame-based generation should keep frame-agents strictly context-isolated from one another during generation, only merging after independent scoring — not something to relax for efficiency.
- The TDD use case (PRD + tech spec linked in `claude.md`, then multi-branch test-strategy planning before implementation) is a directly reusable pattern for Fusion247's own build-verify pipeline ([[multi-model-build-verify-loop]], [[build-verify-defaults-from-wpa-rca]]) — using a frame-diversified planning pass *before* Codex/Fable review, specifically to generate a stronger initial test/edge-case net, could reduce review rounds.
- The pre-launch UX/churn-review use case is a plausible template for a lightweight pre-merge or pre-live-apply check on Cockpit/Tower work — cheap to trial, and the "caught a PRD-promised-but-unbuilt feature" result is exactly the class of gap Fusion247's own Builder Preflight ([[builder-preflight-before-merge-check]]) is designed to catch by different means (git/artifact parity checks rather than agent-driven UX reasoning).
- Actionable caution: given the source-gap on the skill's actual name/repo, this note alone is **not sufficient to install anything** — before any adoption decision, this would need a Pax research pass to identify and vet the actual tool (name, repo, maintainer, license, real star/adoption data) rather than acting on this video's descriptions alone.

## Key concepts & takeaways
- **Tree of thought**: isolated parallel agent branches, each reasoning independently, merged after individual convergence.
- **Frames**: distinct lenses/prompts that force each branch agent into a genuinely different angle on the same problem.
- **Critic agent / N-V-F scoring**: a dedicated, deliberately skeptical scoring pass (Novelty, Viability, Fit) that decides which generated ideas survive.
- **Trap list**: an explicit list of risks/problems attached to each surviving idea, not just the idea itself.
- **Pre-check gate**: 3-question cost-control gate (open-ended? high-stakes? wording signals "quick"?) that prevents expensive multi-agent fan-out on low-value prompts — only applies to implicit/auto-invocation, not explicit calls.
- **Plans, doesn't implement**: a recurring, load-bearing design boundary — the skill's output in both demonstrated cases is a graded strategy/findings report, never the actual code or fix.
- **The core reversal**: agents already decompose *execution* work automatically but never decompose *ideation* work — and deliberately fragmenting an agent's attention (the "ADHD" framing) is presented as the fix precisely because it prevents convergence on the safest/most common answer.

## Actions & open questions
- Decide whether it's worth a Pax research brief to identify the actual skill (real name, GitHub repo, maintainer, license, real trending metrics) before any adoption decision — this note cannot support installation on its own since the source never names it.
- If adopted, evaluate installing it against Fusion247's own build pipeline for the TDD test-strategy use case specifically (PRD + tech spec already exist per idea per [[build-inputs-need-prd-and-robust-home]] gap) — could plug into the pre-build test-writing stage.
- Consider whether the isolation/frame/critic design pattern described here should inform a review pass of Arc's and Mason's actual current implementation, purely as an external design sanity-check (not a re-architecture) — flag to Warwick as optional, not urgent.
- Open question: is the "30 ideas → top 3 → PRD gap caught" UX/churn-review use case worth a small pilot against the Cockpit before its next feature ships, as a cheap pre-live-apply check layered on top of (not replacing) Builder Preflight?

---

**RAW transcript — immutable source evidence:** `Sources/_raw/m6IXL_YGqBQ/` — `tubeair-report.md` (sha256 `1ef5672476b9…`), `manifest.json` (sha256 `4db379ae53b4…`). Preserved as captured; never edited or summarised.
