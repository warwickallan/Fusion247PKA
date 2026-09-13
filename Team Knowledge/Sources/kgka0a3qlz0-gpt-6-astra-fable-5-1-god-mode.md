---
source_id: KgKA0A3qlz0
type: source-knowledge-note
source_type: youtube_transcript
title: GPT 6 Astra + Fable 5.1 = GOD MODE
source_url: "https://www.youtube.com/watch?v=KgKA0A3qlz0"
video_id: KgKA0A3qlz0
channel: Chase AI
published: 2026-09-07
transcript_source: auto_captions
captured_at: "2026-09-13T23:06:28+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/KgKA0A3qlz0/tubeair-report.md
  - Sources/_raw/KgKA0A3qlz0/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is a Chase AI YouTube video pitching a workflow for combining OpenAI's GPT-6 Astra and Anthropic's Claude Fable 5.1 (the two current frontier models) with cheaper mid/low-tier models (OpenAI's Terra and Luna) inside Claude Code / Codex, via two custom skills: an updated **ClaudeX Loop** (adversarial plan/execute/review cycling between opposite-vendor models) and a new **ClaudeX Route** (automatic model-selection routing based on task complexity and cost). The core argument: don't pick a "best" model — assign the *cheapest adequate* model per task and always have a *different* model review a model's own work, because self-grading is unreliable. It matters because it's a concrete, installable pattern for cutting API/subscription cost while improving quality via cross-model adversarial review.

## What the source says

### Thread 1 — The "which model is best" framing is wrong
The presenter opens by rejecting the framing of "GPT-6 Astra vs Claude Fable 5.1" as competitors to choose between. [00:00] The real question is how to extract value from *both* vendor's full model lineups — including their respective cheap/small models (Anthropic's presumed Luna/Tara-equivalents, referred to loosely) — since many day-to-day coding tasks don't need frontier-model power at all. [00:24]

### Thread 2 — The cost/performance gap in Anthropic's cheap-model tier (counterintuitive reversal)
This is the video's biggest reversal claim: Astra and Fable 5.1 are the two frontier models for big planning/design tasks, but both are described as extremely expensive: $10 input / $50 output per (unspecified token unit). [00:47] For everyday smaller tasks, the presenter says the "expected" assumption — that Anthropic's own lineup (Claude Sonnet 5) is the natural cheap/fast choice for its users — is **wrong**: Sonnet 5 is described as underwhelming relative to its benchmarks and "just doesn't feel great," and Anthropic currently has **no good cheap/effective model** in this tier gap. [01:36]

Instead, the presenter claims OpenAI fills that gap with two models, **Terra** and **Luna**:
- **Terra**: slightly pricier than Sonnet 5 token-for-token but cheaper in practice because it's more token-efficient. [02:11]
- **Luna**: framed as "what Haiku should have been" (implying Anthropic abandoned/neglected Haiku). Pricing given as ~20 cents input, ~2 cents cache, $1.20 output — described as "basically free" relative to alternatives, with performance matching or exceeding Sonnet 5. [02:32]

The practical recommendation drawn from this: even a committed Anthropic user (e.g., on a 20x Anthropic plan) might benefit from also holding a cheap ($20/mo-class) OpenAI plan specifically to route small tasks to Luna and save tokens. [03:03]

### Thread 3 — Benchmark evidence (Deep Sweet benchmark, cited by presenter)
Using what's called the "Deep Sweet" benchmark, the presenter reports:
- Peak/"max" performance: Sonnet ~54%, Terra ~70%, Luna ~67%. [03:37]
- Peak average cost per task: Sonnet ~$26, Luna ~60 cents, Terra ~$4. [03:37]
- At "low" effort setting: Sonnet ~$2.19/task vs Luna ~1 cent vs Terra ~34 cents (Sonnet's low-effort output is characterized as low quality — "not doing anything for you"). [04:02]
- Claimed pattern: Luna's cost barely rises from low→max effort while its effectiveness "completely spikes," whereas Sonnet is described as having no efficient middle ground and being prone to runaway token consumption/cost. [04:02]

*(Source gap: "Deep Sweet" is not a benchmark name I can independently verify from the transcript alone — treat the name and all numbers as claims from the presenter, not independently confirmed facts. No methodology, task set, or date is given.)*

### Thread 4 — Why cross-model (not same-model) review matters: the self-grading problem
Second major reason given for combining vendors: a model should never evaluate its own or its own vendor-family's work. [04:44] Workflow described: Fable 5.1 produces a plan → Astra (with a blank/fresh context, free of Fable's "idiosyncrasies") reviews it and flags good/bad/fixes → feedback returns to Fable, which agrees/disagrees → sent back to Astra → repeating adversarially until convergence ("this is good to go"). [05:10] This is the mechanism the **ClaudeX Loop** skill implements. [05:10]

Explicit safeguards exist to cap runaway iteration/token burn, but the presenter argues the loop still saves tokens net versus the alternative (building first, discovering flaws later, and re-iterating after the fact). [05:32] The pattern is stated to generalize down the cost ladder too — e.g., Opus builds, Terra or Luna reviews — not just frontier-vs-frontier. [05:52]

**Explicit stated rationale (near-verbatim claim):** "these models in general tend to grade their own work poorly... in a very favorable light. Fable's always going to think Fable's work is great. Astro's always going to think Astro's work is great." [05:52–06:07] This is presented as a general property of LLM self-assessment, not specific to one vendor.

### Thread 5 — Sponsor segment (commercial thread — material, not incidental)
A mid-video sponsor break: the presenter promotes "Chase AI Plus," his own paid product, which has newly released a Claude Code Masterclass and a Codex Masterclass, pitched at non-technical users, updated weekly, focused on "real examples." [06:07–06:42] This is a commercial/monetization thread of the source itself (the presenter selling his own course alongside the free skill content) — material to understanding the source's incentives, separate from the technical content.

### Thread 6 — The ClaudeX Route skill (new)
**ClaudeX Route** is described as usable inside either Claude Code or Codex. [06:58] Usage: give it a brief description of the task ("I'm trying to do this particular task, can you use ClaudeX Route to figure out what model I should use?"). [07:03] It does **not** just name a model — for very simple tasks it will actually invoke Luna; for ambiguous/difficult work it will invoke Astra. [07:18] The routing decision is based on published model information/usage guidelines from the frontier labs plus actual cost data, removing the user's need to judge which model fits a "gray area" task. [07:24]

Mechanically: if routed to Astra from within Claude Code, ClaudeX Route silently spins up a **headless Codex instance** (invisible CLI instance) to do the work, then returns the results and location of the produced code back to Claude Code. [07:49] The reverse direction (starting in Codex, routing to an Anthropic model) also works. [08:07]

### Thread 7 — The ClaudeX Loop skill (updated) — four-stage structure
Contrasted with Route (one-off feature routing), **ClaudeX Loop** is for large implementations, walking the user from planning through execution, and it's built around the model A executes / model B checks principle. [08:24–08:51]

Mechanics: whichever tool you're in, the *opposite* vendor's model acts as the plan author, and your home tool's model is the inspector (e.g., inside Codex, Astra plans; Claude Code (the opposite side) checks — and vice versa depending on platform). [08:51–09:00]

Four stages described:
1. **Reconnaissance** — deep research via spawned sub-agents; example given: cloning "WhisperFlow" — the loop investigates what the target product actually is, prior clone attempts, and validates the user's assumptions before any building starts. [09:00–09:32]
2. **Clarifying questions** — the skill asks the user what they want changed, what they care about, their vision for the project. [09:32]
3. **Plan construction + adversarial review** — the "builder" model (e.g., Astra) drafts the plan, sends it to the other model (e.g., Claude Code), and they iterate for several rounds until reaching an approved verdict. [09:32–09:50]
4. **Execution + adversarial review of execution** — the user is asked whether Astra or Fable should execute; one executes, the opposite reviews the executed result and reports misses or approval. [09:50–09:58]

Stated purpose: catching blind spots the user themselves likely cannot catch, because for many users the code produced already exceeds their own ability to independently verify it — the loop substitutes a second model's adversarial check for the user's own review, producing (his words) "a warm and fuzzy feeling" of confidence rather than a guarantee. [10:24] Presenter is explicit that this is a practical convenience mechanism, not a formal verification method. [10:24]

Installation: copy the GitHub repo URL, point Claude Code and/or Codex at it, and it installs. [10:39]

### Thread 8 — Career/spend strategy thread (distinct from the technical mechanism)
Closing argument, a strategic/financial thread separate from the technical workflow: rather than treating GPT and Claude as an either/or subscription choice (worrying about running two $200/mo-class plans simultaneously), the presenter recommends splitting spend — e.g., a 5x-tier plan with each vendor — specifically to explore which you personally prefer, especially for people who have been Anthropic-only for the last 6–12 months. [11:17–11:48] Broader closing claim (opinion): given how fast the field is moving, users need to stay **tool-agnostic**, and that's only achievable by actually using multiple vendors' tools rather than committing to one. [11:48]

## Mechanisms, methods & implementation detail
- **Installation**: both skills live in a GitHub repo ("the Claudex Loop GitHub repo"); copying the repo URL and pointing Claude Code or Codex at it triggers install — no other setup steps described. [06:42], [10:39]
- **ClaudeX Route invocation**: slash-command style, e.g. `/ClaudeXRoute` inside Claude Code, followed by a natural-language description of the task; skill returns a model recommendation and can directly dispatch the task to a headless instance of the other vendor's CLI tool, then relays results back. [07:34–08:07]
- **ClaudeX Loop invocation**: run inside either Claude Code or Codex; the *other* vendor's tool automatically becomes the plan author while the home tool becomes the checker (roles swap depending on which tool you started in). [08:51–09:00]
- **Loop stage order**: reconnaissance (sub-agent research) → clarifying questions to user → plan draft + multi-round adversarial plan review → execution by one model + adversarial review of the executed output by the other. [09:00–09:58]
- **Anti-runaway safeguard**: the adversarial back-and-forth has limits built in so it can't loop indefinitely and exhaust tokens, though the specific limit mechanism/parameters are not described. [05:32] (Source gap: no detail on what triggers termination — round count, cost cap, or convergence detection.)
- **Cross-model review principle (generalizable)**: not limited to Astra/Fable — explicitly stated to extend to any build/check pairing, e.g., Opus builds, Terra or Luna reviews. [05:52]

## Tools, people, products & organisations
- **Chase AI** — the channel/presenter's brand; also sells "Chase AI Plus," a paid membership with Claude Code and Codex masterclasses aimed at non-technical users, updated weekly. [06:07–06:42]
- **GPT-6 Astra** — OpenAI's current frontier model per this source; used for large/ambiguous planning and design tasks; expensive ($10 in/$50 out). [00:47]
- **Claude Fable 5.1** — Anthropic's current frontier model per this source; same pricing tier and use case as Astra; the pairing partner for Astra in the adversarial loop. [00:47]
- **Claude Sonnet 5** — Anthropic's mid-tier model; described as underperforming relative to benchmark expectations, without a great cost/performance sweet spot, and prone to excessive token usage/cost especially at higher effort settings. [01:36], [03:37]
- **Terra** (OpenAI) — mid/cheap-tier model; more token-efficient than raw per-token pricing suggests; cited as outperforming Sonnet 5 on the referenced benchmark at similar or lower effective cost. [02:11]
- **Luna** (OpenAI) — cheapest-tier model discussed; described as filling the role Anthropic's Haiku line is claimed to have abandoned; cited as matching/exceeding Sonnet 5 performance at drastically lower cost. [02:32]
- **Claude Code** — Anthropic's CLI coding tool; one of the two host environments the skills run in.
- **Codex** — OpenAI's CLI coding tool; the other host environment; can be run "headlessly" (invisibly) when invoked by ClaudeX Route from within Claude Code. [07:49]
- **ClaudeX Loop** — the presenter's custom skill for adversarial plan→execute→review cycling between opposite-vendor models across 4 stages. [08:24]
- **ClaudeX Route** — the presenter's new custom skill for automatic per-task model selection/dispatch. [06:58]
- **"Deep Sweet" benchmark** — cited as the source of the cost/performance figures for Sonnet, Terra, and Luna; not otherwise described (methodology, provider, or date unstated). [03:11]
- **WhisperFlow** — used only as a hypothetical worked example of a clone target to illustrate the loop's reconnaissance stage; not otherwise discussed. [09:11]

## Examples & use cases
- **Reconnaissance example**: "I want to clone something like WhisperFlow" — illustrates the loop spawning sub-agents to research what the target product is, whether it's been cloned before, and to validate the user's assumptions before planning begins. [09:11–09:32]
- **Route example**: "I'm starting this new project, I think it's going to be pretty complicated. What model should I use?" → Route returns "Astra" and dispatches the work to a headless Codex instance automatically. [07:34–08:07]
- **Cost/benchmark table example** (Deep Sweet): comparative cost-per-task figures at "max" and "low" effort settings for Sonnet vs Terra vs Luna, used to argue Luna is disproportionately cheap for its performance. [03:37–04:02]

## Claims & confidence
- Astra and Fable 5.1 both cost "$10 input / $50 output" — **[claim]**, presenter-stated pricing figure, no source cited, unit (per-token vs per-million-token) unstated. Low-moderate confidence. [00:47]
- Anthropic currently has no good cheap/effective model comparable to OpenAI's Terra/Luna — **[opinion]**, presenter's subjective assessment of Sonnet 5's real-world "feel." Low confidence as fact, though clearly and strongly held by the presenter. [01:36]
- Luna priced at ~20¢ input / ~2¢ cache / $1.20 output — **[claim]**, unverified specific pricing figure. Moderate confidence it reflects some real published pricing at time of recording, but not independently confirmed here. [02:32]
- "Deep Sweet" benchmark numbers (54/70/67% max scores; $26/$0.60/$4 max cost-per-task; $2.19/$0.01/$0.34 low-effort cost) — **[claim]**, sourced to an unnamed/unverifiable benchmark shown on-screen only. Low confidence in the specific figures without seeing the chart; moderate confidence in the general direction (Luna is cheap relative to Sonnet). [03:37–04:02]
- Models "grade their own work poorly, in a very favorable light" (self-assessment bias) — **[opinion]** stated as general fact about LLM behavior, no citation or study referenced, though it aligns with commonly discussed self-evaluation bias in LLM literature generally. Moderate confidence as a real, broadly-observed phenomenon; low confidence in it being universally true across all models/tasks. [05:52–06:07]
- ClaudeX Loop and ClaudeX Route function as described (auto model-selection, headless cross-CLI dispatch, 4-stage adversarial loop) — **[claim]**, first-person description by the tool's own creator of his own skill; internally consistent and plausible given how Claude Code/Codex skills work, but not independently verified in this transcript (no live demo shown in this specific video — presenter refers viewers to a separate video for the full walkthrough). Moderate confidence. [10:24]
- Recommendation to split spend ~50/50 between Anthropic and OpenAI plans (e.g., two 5x-tier plans) rather than one $400/mo combined spend — **[opinion]**, presenter's personal advice. [11:17–11:48]

## Caveats & source gaps
- No methodology, sample size, task set, or provenance is given for the "Deep Sweet" benchmark — all comparative numbers should be treated as presenter-reported, not independently verified.
- Pricing figures for Astra/Fable ("$10/$50") and Luna ("20¢/2¢/$1.20") are given without units being fully disambiguated (likely per-million-tokens by industry convention, but not stated) and without a citation or date, so they should be treated as approximate and time-sensitive.
- The video does not show a live/actual run of either skill — it refers viewers to a separate, earlier video for the full ClaudeX Loop walkthrough ("here's what GPT found, here's all the errors..."). No worked example of ClaudeX Route's actual output is shown either.
- "Anti-runaway safeguards" for the loop are asserted but never explained (no round limit, cost ceiling, or convergence criterion given).
- Names "Terra" and "Luna" are used consistently but their exact provenance/official names within OpenAI's lineup are not stated beyond what's said in-video; treat these as the presenter's own labels for models being discussed, not necessarily official product names verified independently here.
- The self-grading-bias claim is presented as flat fact with no supporting study, benchmark, or example given in this transcript beyond assertion.
- No discussion of failure modes for the routing/loop skills (e.g., what happens if the two models can't converge, or if a headless CLI dispatch fails).

## What this means for Fusion247
*(This section is Larry/Fusion247 interpretation — not sourced content.)*

- This directly parallels and validates architecture already in use across the Fusion247 estate: cross-model adversarial review (Fable builds → Codex/GPT reviews with blank context) is essentially the multi-model build-verify loop already documented in memory (`multi-model-build-verify-loop.md`), and the "never let the model that built it grade it" principle matches Veritas being structurally distinct from the builder and Codex being the different-model external QA authority.
- The **cost-routing** idea (cheap model for simple tasks, frontier model only when needed) is conceptually adjacent to the existing Larry delegation-first discipline (Rule 4) and to `multi-model-loop-usage-pacing.md` (Codex+Fable is usage-expensive, match review weight to stakes) — but Fusion247's existing constraints (Codex budget of 3 executions per gate, Fable confirm-first hardlock, proportionality/regrowth-cap discipline) already govern this far more conservatively than "just auto-route to whatever's cheapest."
- **Do not build a ClaudeX-style auto-router or auto-loop skill for this estate** without treating it through the regrowth-cap lens — a new automatic model-routing/self-installing skill is exactly the shape of mechanism the constitution repeatedly warns against building reflexively (BUILD-018 pattern). If this is ever considered, it would need to go through Nolan/hire-style scrutiny, not be adopted casually because a YouTuber built one.
- The claim that "Sonnet 5 underperforms and Anthropic lacks a good cheap tier" is presenter opinion from a specific point in time (video likely recorded ~Sept 2026 given "GPT-6," "Fable 5.1," "Claude Sonnet 5" naming) and should not be treated as settled fact for any Fusion247 model-selection decision — worth spot-checking against current Anthropic pricing/model docs before acting on it.
- The sponsor segment is a reminder this is a monetized/opinionated source (presenter sells a competing-interest paid course) — treat enthusiasm for the "combine both vendors" thesis as partly marketing-motivated, not purely technical analysis.

## Key concepts & takeaways
- **Model-per-task cost routing**: match task complexity to the cheapest adequate model rather than defaulting to a frontier model for everything.
- **Cross-vendor adversarial review**: never let a model (or its own vendor family) grade its own work — use a different vendor's model, with blank context, as reviewer.
- **Two distinct skill shapes**: a *router* (one-off task → best model) versus a *loop* (full plan→build→adversarially-reviewed-execution cycle for larger work).
- **Headless cross-CLI dispatch**: one CLI tool can silently invoke the other vendor's CLI tool in the background and relay results back into the original session.
- **Reconnaissance-before-planning**: sub-agent research and assumption validation as an explicit first stage before any plan is drafted.
- **Tool-agnosticism as a career/practice stance**: deliberately splitting subscription spend across vendors to stay adaptable as the field moves quickly.

## Actions & open questions
- If curious about adopting either skill, verify current pricing for Terra/Luna/Sonnet 5/Astra/Fable 5.1 directly from OpenAI/Anthropic docs before trusting this video's specific figures (they are unsourced and likely stale by the time this note is read).
- Decide whether the existing Fusion247 multi-model loop (Fable/Codex build-verify pattern, already documented in memory) already achieves what ClaudeX Loop offers, making adoption of a third-party skill redundant — this looks likely given `multi-model-build-verify-loop.md` and the Codex/Veritas separation-of-duties architecture already in place.
- No install or trial of ClaudeX Loop/Route is warranted without going through the normal "new capability" scrutiny (regrowth cap, Nolan-style hire/tooling review) rather than adopting it because a video recommended it.
- Open question the source doesn't answer: what actually happens when the two adversarial models fail to converge, or when the headless cross-CLI dispatch fails mid-task — worth investigating independently if this pattern is ever evaluated seriously.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/KgKA0A3qlz0/` — `tubeair-report.md` (sha256 `b015d5fc556a…`), `manifest.json` (sha256 `cb0f30453a38…`). Preserved as captured; never edited or summarised.
