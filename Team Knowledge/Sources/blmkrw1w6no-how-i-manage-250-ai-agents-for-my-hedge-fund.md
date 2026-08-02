---
source_id: BLMkrw1W6No
type: source-knowledge-note
source_type: youtube_transcript
title: How I manage 250+ AI Agents for my Hedge Fund
source_url: "https://www.youtube.com/watch?v=BLMkrw1W6No"
video_id: BLMkrw1W6No
channel: Nath Aston
published: 2026-08-01
transcript_source: auto_captions
captured_at: "2026-08-01T23:41:18+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/BLMkrw1W6No/tubeair-report.md
  - Sources/_raw/BLMkrw1W6No/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
  - recommendation-overruled
---

> ## ⛔ OVERRULED — one recommendation in this note is REJECTED for Fusion247 (Larry, 2026-08-02)
>
> **What is overruled:** the "behavior validation contract" recommendation in *What this means for Fusion247*
> (the YAML-defined expected-steps spec → registry → monitoring agent → scheduler shape), and the
> "per-automation ledger" suggestion in *Actions & open questions* that carries the same shape at a smaller grain.
>
> **Why.** That is the BUILD-018 growth path, arriving pre-blessed by an external source. BUILD-018 grew a
> validator → store → parser → registry around four rules it never once enforced, and cost roughly a month.
> The standing **regrowth cap** in `CLAUDE.md` is explicit: *if the response to an operating rule is to BUILD
> something, the diagnosis was rejected.* A YAML behaviour spec plus a registry plus a monitoring agent plus a
> scheduler is four new mechanisms to enforce rules that a written sentence already binds — and a written
> sentence binds on any machine with nothing installed, which is the property that actually matters here.
>
> **The tell, and why it is worth recording rather than just declining.** This note reached the estate through
> the normal intake route, correctly classified and correctly labelled as interpretation. The guardrails held —
> nothing was built. But an outside recommendation carries borrowed authority that an internal proposal does
> not, and "a hedge fund does this" is not evidence that *this* estate needs it. Aston runs ~250 concurrent
> agents across three machines with real money at risk. myPKA is Warwick's personal, first-party hobby brain.
> The threat model, the scale and the cost of a wrong mechanism are all different, and a pattern does not
> transfer just because the vocabulary does. **Recording the overrule is the point:** an undocumented decline
> looks identical to nobody having read it, and the next session would re-litigate it from scratch.
>
> **What is NOT overruled — the rest of this note stands**, including the observation that a genuinely useful
> discipline sits next to the rejected one: Aston's **fresh, non-continued audit agents per review round**, and
> **per-task model routing**, are close cousins of the estate's existing multi-model build-verify loop and need
> no new mechanism to adopt. Take the discipline; leave the platform.
>
> *Scope of this ruling: Fusion247/myPKA only. It says nothing about whether the practice is sound for the
> operator who described it.*

## Executive orientation
This is a solo-founder walkthrough by Nath Aston, who runs an agentic hedge fund with zero employees, describing how he coordinates roughly 250 concurrent AI agent sessions across three machines and multiple model subscriptions (GPT Pro, Claude Max, Kimi). It matters because it's a concrete, load-bearing operating model — not a demo — for running an entire organization (development, research, monitoring, compliance-style validation) through agent orchestration, with real money and real production risk at stake.

## What the source says

### The core reframe: hiring agents instead of people
Aston frames every agent deployment as a hiring decision. Traditional hiring — identify a problem, write a job spec, advertise, interview, onboard — takes months before someone reaches full capacity, and even then people can quit early [01:15]-[02:47]. Agent hiring collapses this: he has a skill called "agent recruitment" where an agent interviews him about the problem/workflow, breaks it into positions (sub-agents), and the resulting skill is run as a scheduled automation [02:47]-[03:13]. He uses Kimi K3 for this design/interview process specifically because he found it excellent at prompt-writing and this kind of structured design work [03:13]-[04:18].

### Infrastructure layout (three-machine model)
- **Personal MacBook Pro** — active/interactive work only, deliberately capped at ~10-20 concurrent chats; beyond ~20 he feels "pulled in a lot of different directions" [04:18]-[05:05].
- **Mac mini** ("workhorse") — runs ~150 automations continuously, at varying cadences (hourly, daily, weekly) [05:05]-[05:30].
- **M2 Max** (an old laptop, currently in Georgia) — dedicated R&D machine running ~100 agents doing isolated backtesting: running millions of backtests, analyzing results, proposing new filters/configurations, iterating autonomously toward quantitative goals (drawdown, returns, a custom scoring system) [05:30]-[07:45].
He deliberately keeps his personal machine's workspace clean by migrating automations to the Mac mini once mature [05:30].

### Orchestration pattern: main agent as manager, not worker
Skills are treated like SOPs (standard operating procedures) — explicit instruction manuals [04:18]. Within a skill, a main agent acts purely as an orchestrator and spins up sub-agents to do the actual work, each reporting back in sequence [07:45]-[08:35]. The stated reason is a quality mechanism, not just a scaling one: agents "do their best thinking when they have the most free space in their context window," and output quality degrades once the context starts compacting [08:35]-[09:11]. He compares the visual shape of this to a Zapier/Make.com/n8n workflow: the skill = the workflow, each node/step = a sub-agent [09:11]-[09:32].

### Shared memory via a simple ledger
Agentic "departments" share memory through a plain JSON file acting as a ledger — a history of work done. Each automation run first reads the ledger to see what prior runs (that hour, that week) did, so work doesn't overlap, or in some cases so it can continue from where the last run left off [09:32]-[10:07].

### Standing automations catalogue
He lists recurring automation types he runs [10:07]-[13:13]:
- Bug-finding: scan the codebase, fix, open a **draft** PR (never auto-merge without review).
- A separate PR-scoring automation that risk-scores draft PRs — some categories (e.g., pure monitoring changes) can be allowed to merge autonomously; others require his explicit sign-off.
- Monitoring integration: watch Sentry and Better Stack (via dashboards/MCP servers) for issues, auto-generate a fix, open a draft PR.
- Chat/session auditing: review agent chat transcripts (e.g., over the past 7 days) for recurring blockers — commonly environment setup issues, or conflicting instructions between docs and actual code — and feed findings back into documentation/skills so agents stop repeatedly wasting tokens on the same problem. This turned into a genuinely self-improving loop: it caught testing-suite problems occurring on a machine he wasn't actively watching.

### Production-safety layer: golden-input regression testing
Because the system executes real trades with real money, Aston built a regression-testing mechanism using **golden inputs and outputs**: fixed datasets (e.g., a fixed price series over fixed dates) are run through the trading system and the outputs are frozen as the expected baseline [12:11]-[13:13]. He has "thousands" of these covering different configurations/paths in the trading system, because even tiny percentage shifts change outcomes [13:13]-[13:34]. If a code change alters a frozen output, deployment is blocked unless he explicitly approves it — and that approval must come from a **second admin GitHub account that only exists on his phone**, specifically so agents cannot have access to it and cannot bypass the gate [13:34]-[14:23]. This is a deliberate human-in-the-loop chokepoint enforced by device/account separation, not just process convention.

### "As complex as necessary, as simple as possible" — anti-complexity discipline
A recurring, explicitly named principle he says he's "obsessed" with [14:23], [22:57]-[24:24]. His reasoning: it's now so cheap and frictionless to generate code that agents constantly over-add complexity, and every unit of unnecessary complexity compounds — more code, more tests, more context for agents to search through, more failure points, more time. He treats fighting this as one of his primary ongoing time investments, and warns that without deliberate counter-pressure, agent-built systems trend toward "spaghetti" as they scale.

### Behavior validation contracts (production trust layer)
A second, complementary safety mechanism to golden-input tests, aimed at validating that code *actually works correctly in production* over time (not just that it worked once) [14:23]-[17:45]. Structurally: a YAML file lays out expected steps for a critical feature/cron/workflow (e.g., "cron starts, fetches from database..."), a cadence is specified (hourly/daily/weekly/monthly), and a monitoring agent is assigned to verify the contract is being fulfilled at that cadence. His concrete example: he ingests comments from ~50 data sources (Reddit, TikTok, Instagram, news, finance publications) feeding his investment theses; a behavior validation contract checks that comments are being correctly absorbed, saved to the database, and correctly run through the sentiment-analysis pipeline. He explicitly likens this to site-reliability monitoring applied across the whole organization, and flags OpenAI Codex's "computer use" capability (agent controls mouse/keyboard) as unlocking more advanced/intricate validation than was previously possible with code-only checks.

### Adversarial dual-agent PR review (added since his last video)
Every PR now has a **required, checked-off field** requiring sign-off comments from two independent "adversarial" agents whose explicit job is to attack the plan/PR — look for weaknesses, unagreed points, challenge the other agents' thinking, not simply agree [40:15]-[41:21]. He reports this catches cases where a change silently breaks another module as the codebase scales — a category of regression ordinary review misses.

### Plan-iteration loop (a major stated unlock)
Building on Anthropic/community "Superpowers" skills (via a creator he refers to but can't recall the name of, whose brainstorming skill interviews the user on what they want built), Aston built his own extension: after an initial plan is produced and the first agent says "ready to implement," he launches **two fresh adversarial audit agents** to find gaps/weaknesses/things needing clarification, resolves their findings with the user, updates the plan, then repeats [30:15]-[33:43]. Key details:
- Each audit pass uses genuinely fresh agents with no continuation from prior chats — deliberately "fresh pair of eyes" every time.
- Most value shows up in the first 2-3 iterations; for critical/high-stakes code paths (finance-related) he'll run up to 10 iterations.
- He deliberately over-specifies plans up front rather than fixing a wrongly-built PR after the fact — this trades ~2-3 hours of up-front planning time for much less downstream rework.
- He runs the two audit agents on **different models deliberately** (GPT 5.5 high + GPT 5.6 "Sol") because "they think in very different ways" and surface different findings; he notes 5.6 Sol, despite being framed as smarter, "misses a lot more" as an auditor, and that he personally dislikes speaking to/using 5.6 Sol for planning/design work even though he rates it for building/implementation.
- His stated mindset: tokens are cheap relative to the intelligence/value gained, so "throw tokens at problems" via extra audit passes rather than economizing on review depth.

### Model-selection practice (per-task routing)
He assigns different models to different roles rather than using one model for everything [35:38]-[37:20]:
- **Kimi K3** — front-end/UX design work (cites a strong internally-built dashboard result), prompt-writing, running his automations, and as the main personality/model behind his Hermes chief-of-staff agent (liked for its "nice personality").
- **GPT 5.6 Sol (high)** — building/implementation and some QA.
- **GPT 5.5 (high/extra-high)** — planning, architecture, writing plans (brainstorming skill).
- **Fable 5** — "ultra code" / one-shot side projects, where it can spawn ~120 agents at once; used partly because it's "satisfying to watch."
- **Opus 5** (released about a week before this recording) — light use so far, mainly code review; general positive impression.
He states plainly that everyone has access to the same underlying models, and that the ceiling is set by how large a problem you're willing to assign them and how clearly you prompt/scope the work — not by access to better tools than anyone else has.

### Codex App Server — orchestrator-of-orchestrators
An officially OpenAI-built API exposed by running `codex app server`, giving programmatic endpoints to act on Codex chats/sessions: send a message, rename, archive, create new chats [26:01]-[27:10]. Aston uses this to let one Claude (or Kimi) chat concurrently manage and triage potentially hundreds of open Codex chats — surfacing which are blocked and need his attention versus which are superseded and safe to archive. He reports having had as many as 700-800 open chats on the Mac mini at once, at which point manual management becomes impossible, making this triage layer necessary rather than optional. He also flags a major recent constraint change: Codex previously had a **5-hour coding session limit** that made spawning 20-30 concurrent agents impractical; that limit has since been removed (only a weekly limit now applies, at least on the Pro plan, unconfirmed for other tiers), which he calls "a massive unlock" [27:10]-[27:54].

### Hermes as "chief of staff," used from Telegram via voice
He runs Hermes (configured on Kimi K3, connected via Codex App Server) as a personal chief-of-staff layer he interacts with by voice note over Telegram, because Telegram feels native to him for this [28:10]-[29:45]. Practically, he spends ~2 hours each morning walking and sending voice notes to chief-of-staff agents on each of his three isolated machines (each machine has its own separate Hermes installation). To get Kimi K3 working with Hermes before official support existed, he used an open-source tool called **Vibe Proxy**, which he also notes can be used to access models that otherwise block subscription-based use through Hermes (his example: Gemini normally disallows subscription auth via Hermes, but routing through Vibe Proxy allows use of Gemini Flash).

### Voice/call-based orchestration and computer-use
OpenAI's Codex mobile/native app now supports audio calls with an orchestration agent (he believes named "Luna," though the app doesn't explicitly label it) that can manage all Codex chats over a live call [37:20]-[38:16]. He spent ~3 hours on one such call the day before recording, doing planning. He rates its particular strength as simplifying/re-explaining advanced concepts more clearly when he's confused mid-conversation. Separately, he highlights **computer use** (agent controls mouse/keyboard/screen) as one of the most under-discussed but valuable capabilities released in the past year, using it for tasks from ordering coffee to debugging, and now — combined with the new voice-call feature — he can voice-command an agent to directly operate his machine hands-free [38:16]-[39:35]. Most recently (within the week prior to recording), OpenAI's mobile app added a "remote" call feature letting him call his laptop from his phone while out walking (contingent on stable internet on both ends) and have it launch up to a configured number of sub-agents (he has it set to 24) [39:35]-[40:15].

### Decision throughput as the real bottleneck
A explicit structural claim: once agents can work 24/7, the constraining resource becomes the human's decision-making — specifically, how many decisions a person can make per day, and the *quality* of those decisions, since "you now essentially have infinite leverage through AI" [20:18]-[21:47]. He frames his own role now purely as "product owner" — choosing direction, reviewing PRs — and states he hasn't written a line of code since he started using Codex (roughly since November of the prior year). His practical response to this bottleneck is building workflows and skills specifically so he never has to repeat the same explanation to different agents, because repetition both wastes his time and causes decision fatigue.

### Preference-mining from historical chat archives
Because he has an extensive history of Codex chats sitting unused, he uses Kimi's **swarm feature** (can spawn up to 128 concurrent agents) to sweep all historical Codex chats and mine them for design/product decisions and stated preferences, compiling the findings into a shared document committed to the codebase so all agents (not just the one originally told) gain access to that context [18:23]-[20:18]. He frames this as solving a structural problem of agent context isolation: previously, information given to one agent chat stayed siloed there.

### Skills referenced by name (behavioral/process skills)
- **Superpowers** brainstorming skill — interview-style plan generation (source: a well-known, highly-starred GitHub repo whose creator he discusses via a podcast but can't name) [30:15]-[31:22].
- **Century's skill-writer skill** — for designing workflows [07:45].
- **Ponytail** — makes agents behave as a "lazy engineer," actively avoiding over-engineering, seeking reusable existing code, resisting unnecessary complexity — a direct implementation of the "as simple as possible" principle [41:21]-[41:44].
- **Caveman** — changes how the agent communicates back to the user, aimed at making responses clearer/more concise; connects to his broader push toward "decision packets" (a self-devised format where agents present him structured suggested options — e.g., "A, B, or C" — with concrete real-world examples of how each option would affect production behavior) so he can make more high-quality decisions faster [41:44]-[43:11].

### Emerging/adjacent tools mentioned
- **Buzz App** — a new "Slack for agents" tool, built by Jack Dorsey, gaining early traction. Lets him invite agents into shared workspaces/rooms where e.g. Claude and Codex communicate with each other. He's trialing it as a long-sought replacement for Slack (he dislikes Microsoft Teams as the only real alternative), but stresses it's early-stage and he's just monitoring it, not relying on it [43:11]-[44:10].
- **A self-devised alerting SaaS concept** (unbuilt, mentioned as something he's considering building): a keyword-triggered social-media monitoring/alerting tool, akin to Google Alerts but for social platforms, built on the same ~50-source comment-scraping infrastructure he already runs for investment research. Example use cases he gives: monitoring brand mentions, monitoring an OnlyFans model's mentions (including flagging things like leaked content), or monitoring niche commercial keywords (e.g., "where to buy peptides in Dubai") [44:10]-[46:06]. He states current monitoring scale as scraping hundreds of millions of TikTok posts and comments alone, plus ~30 finance applications, Reddit, and newsletters.

## Mechanisms, methods & implementation detail
- **Agent recruitment process**: problem → Kimi K3-led interview/brainstorm → skill design broken into sub-skills/positions → skill run as a Codex cron-job automation → monitor outputs → iterate [02:47]-[04:18].
- **Ledger-based coordination**: single JSON file per department acting as a work history; each run reads it first to avoid duplicate/overlapping work, or to pick up continuation [09:32]-[10:07].
- **Draft-PR-then-score pipeline**: agent finds bug/issue → fixes → opens PR in draft → separate PR-scoring automation risk-rates it → low-risk categories can auto-merge, others require Aston's explicit approval [10:07]-[11:36].
- **Golden-input regression gate**: fixed dataset → run through trading system → freeze output as baseline → any future deviation blocks deployment until approved from a phone-only second GitHub admin account [12:11]-[14:23].
- **Behavior validation contract lifecycle**: define expected steps in YAML for a critical workflow → set a check cadence (hourly/daily/weekly/monthly) → assign a monitoring agent to validate against it on that cadence, optionally using computer-use for deeper validation [15:23]-[18:23].
- **Plan-iteration loop**: draft plan produced → 2 independent fresh audit agents (different models) review and surface gaps → clarify with Aston → update plan → repeat (up to ~10x for critical paths) [31:22]-[33:43].
- **Chat/preference mining**: Kimi swarm (up to 128 agents) sweeps historical Codex chats → extracts design/product decisions and preferences → compiles into a committed document → all agents reference it going forward, run on a recurring (e.g. weekly) schedule [18:23]-[20:18].
- **Multi-machine isolation & migration**: automations prototyped/run locally on the personal MacBook are migrated to the Mac mini (manually or via an agent SSH-ing in) once mature, to keep the personal workspace clear [05:30].
- **Adversarial PR sign-off**: two adversarial agents required to comment/check a sign-off field on every PR before it's considered reviewed [40:15]-[41:21].

## Tools, people, products & organisations
- **Nath Aston** — the presenter; runs a one-person agentic hedge fund with no employees/consultants/agencies; background in growth hacking and (per his own account) an early recruitment job (ages 18-21) that shaped how he thinks about "hiring."
- **GPT Pro** — $200/month OpenAI plan; he holds three subscriptions.
- **Claude Max** — one subscription.
- **Kimi (K2.6/K3)** — one subscription; used for prompt-writing, skill design/brainstorming, front-end work, swarm-based chat mining, and as the Hermes chief-of-staff model.
- **Codex (OpenAI)** — primary programming/agent-running environment; includes the native app, mobile app, App Server API, computer-use, and voice/call orchestration ("Luna").
- **Codex App Server** — official OpenAI API exposing endpoints (send message, rename/archive/create chat) for orchestrating Codex chats programmatically.
- **Hermes** — a chief-of-staff-style agent product Aston runs per-machine, primarily via Telegram voice notes; configured on Kimi K3.
- **Vibe Proxy** — open-source tool used to route model access (e.g., using a Kimi subscription, or unlocking Gemini Flash) through Hermes where direct subscription auth is otherwise blocked.
- **Sentry / Better Stack** — external monitoring/observability platforms with dashboards and MCP servers; agents poll them for issues to auto-fix.
- **Superpowers** — a highly-starred GitHub skills repo (creator unnamed by Aston) providing a brainstorming/planning skill that interviews the user; basis for his plan-iteration loop.
- **Century** — provider of a "skill writer" skill for designing workflows.
- **Ponytail** — a skill enforcing "lazy engineer" / anti-over-engineering behavior.
- **Caveman** — a skill changing agent communication style toward clarity/conciseness.
- **Buzz App** — a new agent-workspace/"Slack for agents" tool built by Jack Dorsey; early-stage, being trialed.
- **Fable 5** — model/tool Aston favors for large one-shot "ultra code" builds, able to spawn ~120 agents.
- **Opus 5, GPT 5.5 (high/extra-high), GPT 5.6 Sol (high)** — models used for specific roles (see Model-selection practice above).
- **Ghosty** — a terminal/tool he mentions using, noting he's moved away from a prior tool referred to as "walk" (unclear proper name from audio) in favor of native Codex plus Ghosty.
- **Render** — platform hosting some of his cron jobs/workflows referenced under behavior validation contracts.

## Examples & use cases
- Trading-system regression safety: frozen golden-input tests spanning "thousands" of configurations so silent output drift is caught before production deployment [12:11]-[13:34].
- Comment-ingestion behavior contract: verifying ~50-source comment ingestion (Reddit, TikTok, Instagram, news, finance publications) is captured, saved, and correctly run through sentiment analysis [16:23]-[17:20].
- Backtesting R&D loop: agents on the M2 Max machine run millions of backtests, analyze results using quantitative scoring (drawdown, returns), and propose new filters/configurations autonomously [05:30]-[07:45].
- Self-improving bug discovery: a chat-auditing automation caught a testing-suite problem occurring on a machine Aston wasn't actively monitoring, without his direct awareness [11:36]-[12:11].
- Alerting-tool concept examples: brand mentions, an OnlyFans model's mentions (including leaked-content flags), or commercial keyword tracking (e.g., "where to buy peptides in Dubai") surfaced via monitored social platforms [44:10]-[46:06].
- Model-selection example: Kimi K3 rebuilding an internal dashboard with strong UX/data-density judgment for a complex trading platform [35:38]-[36:00].
- Voice/computer-use example: using voice calls plus computer-use to walk through a complex planning session and operate his machine hands-free while out and about [38:16]-[40:15].

## Claims & confidence
- Aston runs ~250 active agent sessions at a time across three machines. [claim, high confidence — stated plainly as his own operating figure, not independently verifiable]
- He holds 3x GPT Pro ($200/mo each), 1x Claude Max, 1x Kimi subscription. [fact as self-reported, high confidence]
- Codex's prior 5-hour coding session limit has been removed, leaving only a weekly limit (at least on the Pro plan). [claim, medium confidence — Aston himself notes uncertainty about whether this applies to all plans]
- Golden-input regression tests number in the "thousands." [claim, medium confidence — round/approximate figure, not verifiable from the source]
- Deployment approval for changes to frozen trading outputs requires sign-off from a second admin GitHub account accessible only from his phone, specifically to prevent agent bypass. [fact as self-reported operating control, high confidence — clearly and specifically described]
- Agent output quality degrades as context window compaction increases, even though this has "gotten better." [opinion/claim, medium confidence — his own operating heuristic, not benchmarked]
- GPT 5.6 Sol, despite being positioned as a smarter model, "misses a lot more" than GPT 5.5 high when used as a plan-auditing agent. [opinion, medium confidence — a personal comparative judgment from his own workflow, explicitly framed as his own dislike/preference, not a rigorous benchmark]
- Kimi's swarm feature can spawn up to 128 concurrent agents; his OpenAI remote-call setup can launch up to 24 sub-agents (configurable). [fact as self-reported product capability, high confidence — specific and consistent with plan mechanics described]
- His overall output is "5 to 10x" what it was previously, "probably way more." [opinion, low-to-medium confidence — self-described as "very hard to quantify," offered as a rough impression rather than a measured figure]
- Buzz App is built by Jack Dorsey and is gaining early traction. [claim, medium confidence — Aston states this as known fact but the source itself gives no corroborating detail beyond his own assertion]

## Caveats & source gaps
- Aston is explicit that he is withholding real detail on his actual trading/investment strategy, backtesting logic, and the specifics of what his R&D department finds — the video is deliberately framed to stay "globally applicable" rather than reveal his edge. Anyone reading this note should not expect insight into his actual investment thesis or performance.
- He does not name the creator of the Superpowers repo despite discussing him at some length ("I've completely forgotten his name") — this is a genuine gap in the source, not an omission by this note.
- The name of OpenAI's voice-orchestration agent ("Luna") is Aston's own guess/belief ("I think it's Luna, but it doesn't actually specify") — not a confirmed fact from the source.
- No performance numbers, cost breakdown per subscription/automation, or ROI figures were given beyond the very rough, self-described-as-hard-to-quantify "5-10x+" output claim.
- The Buzz App segment is thin: Aston says he's "been playing around with it" and deliberately doesn't demo it because of confidential content, so this note's coverage reflects genuinely limited source detail, not compression on our part.
- No detail was given on team size, cost totals, or how the ~250 concurrent-session figure was measured/counted (e.g., whether idle vs. active chats are counted differently).
- The "decision packets" concept is introduced but Aston explicitly cuts it short ("I won't get into it now cuz this is already a really long video") — the source itself is thin here beyond the basic definition given.

## What this means for Fusion247
*(Interpretation — not sourced from the video.)*
- The **golden-input regression test + phone-only second-admin-account gate** pattern is directly analogous to Fusion247's own existing invariant-pinning and merge-gate discipline (see memory: [[a-control-is-not-evidence-until-made-to-fail]], and the merge-protocol's expected-head SHA guard) — Aston's mechanism is essentially the same idea (freeze known-good behavior, block silent drift, require an out-of-band human approval channel) applied specifically to a live-money trading system. Worth comparing against Tower's own drift-detection posture.
- His **adversarial two-agent plan-iteration loop**, using deliberately fresh agents and different models per audit pass, is a close structural cousin of Fusion247's own multi-model build-verify loop (Opus builds → Codex read-only QA → Fable adversarial). His insistence on *fresh, non-continued* agents for each audit pass, and running up to 10 iterations for critical paths, is a stronger discipline than what's currently standing here and may be worth adopting explicitly for CRIT-tier work.
- His **behavior validation contract** (YAML-defined expected steps + cadence + monitoring agent) is conceptually close to what Fusion247's "reviewers QA, not pen-test" framing already gestures at, but formalizes the cadence and ownership more explicitly than anything currently documented in this repo — could be a useful pattern to borrow for ongoing monitoring of BUILD-014/Tower-class always-on systems.
- The **ledger-as-shared-memory** pattern (a JSON work-history file each automation reads before acting) is structurally similar to Fusion247's own programme-state/banked-state mechanism, but applied at a much smaller, per-automation grain — could inform how finer-grained recurring automations (if any get built) coordinate without a full programme-state file.
- His stated bottleneck — "the constraint is now the human's decision throughput and decision quality, not agent capacity" — echoes the standing Fusion247 concern about Larry becoming a bottleneck (see [[larry-owns-the-build-method]], the iron rule on delegation-first). Aston's "decision packets" concept (structured A/B/C options with concrete production-impact examples) is a candidate pattern for how Larry could present decisions back to Warwick more efficiently, consistent with the standing Governor-advice and never-escalate-what-a-safe-default-resolves rules already in force here.
- Nothing in this source should be read as validating any *specific* tool for adoption (Buzz App, Vibe Proxy, Codex App Server, etc.) — those are one operator's choices for a different stack (OpenAI-centric, hedge-fund-specific) and would need independent evaluation before any adoption decision in this repo, per standing research/verification practice (Pax's role).

## Key concepts & takeaways
- **Agent recruitment**: treat agent deployment as a hiring workflow — problem → interview/brainstorm → skill design → scheduled run → iterate.
- **Orchestrator-keeps-clean-context principle**: the main/manager agent should stay maximally unburdened; sub-agents absorb the actual work, because agent reasoning quality degrades as context fills/compacts.
- **Ledger-based coordination**: a simple shared JSON history file, read before each automation run, prevents duplicate work without complex state machinery.
- **Golden-input regression testing**: freeze known-good outputs on fixed inputs; block any deployment that silently changes them; require an out-of-band (device-separated) human approval to override.
- **Behavior validation contracts**: YAML-defined expected behavior + monitoring cadence + an assigned validating agent, extending beyond "does it build" into "does it keep behaving correctly in production."
- **"As complex as necessary, as simple as possible"**: an explicit, actively-enforced anti-complexity discipline against agents' tendency to over-engineer.
- **Fresh-agent adversarial plan iteration**: repeated rounds of independent, non-continued audit agents (across different models) sharply improve plan quality before implementation; most value in the first 2-3 rounds, with diminishing but real returns up to ~10 for critical work.
- **Decision throughput as the real constraint**: once agent capacity is effectively unlimited, the bottleneck shifts entirely to how many good decisions a human can make and communicate per day.
- **Preference-mining from chat history**: agent swarms can retroactively mine historical chat logs for undocumented decisions/preferences, converting siloed one-off context into shared, durable documentation.
- **Per-task model routing**: no single "best" model — Aston deliberately assigns different models to planning, building, front-end, QA, and orchestration roles based on observed behavioral differences, not benchmarks.

## Actions & open questions
- Consider whether a lightweight, per-automation "ledger" pattern (plain JSON work-history, read-before-act) would help any of Fusion247's own recurring/scheduled automations avoid overlap, distinct from the heavier full programme-state mechanism.
- Consider whether Fusion247's CRIT-tier build-verify loop should adopt Aston's discipline of deliberately fresh (non-continued) audit agents per iteration round, and running multiple iteration rounds before implementation begins, rather than a single review pass.
- Evaluate (via Pax, if warranted) whether Codex App Server or a similar chat-triage-at-scale mechanism has any relevance here, given Fusion247 does not currently run anywhere near 250 concurrent sessions — likely low priority given current scale, but worth noting as a pattern for if/when session volume grows.
- No urgent action required — this is a single-operator's personal workflow account, useful as a comparative reference, not a build input in itself.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/BLMkrw1W6No/` — `tubeair-report.md` (sha256 `efaa7c981a99…`), `manifest.json` (sha256 `ce4cde9e18da…`). Preserved as captured; never edited or summarised.
