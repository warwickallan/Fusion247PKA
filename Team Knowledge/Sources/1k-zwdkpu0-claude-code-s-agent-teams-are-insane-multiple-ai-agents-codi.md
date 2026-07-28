---
source_id: -1K_ZWDKpU0
type: source-knowledge-note
source_type: youtube_transcript
title: Claude Code's Agent Teams Are Insane - Multiple AI Agents Coding Together in Real Time
source_url: "https://www.youtube.com/watch?v=-1K_ZWDKpU0"
video_id: -1K_ZWDKpU0
channel: Cole Medin
published: 2026-02-09
transcript_source: auto_captions
captured_at: "2026-07-27T12:11:50+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/-1K_ZWDKpU0/tubeair-report.md
  - Sources/_raw/-1K_ZWDKpU0/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is a hands-on demo-and-explainer video by YouTuber Cole Medin covering Anthropic's new **experimental "Agent Teams" feature** in Claude Code, which lets multiple Claude Code instances collaborate on a shared task list (rather than working in isolation like sub-agents). Medin shows a live 4-agent code review, explains how to enable and run the feature, contrasts it against sub-agents, names two reliability problems he's hit, and promotes a custom "skill"/command he built (with a contract-first-spawning approach) to make agent teams more reliable. It matters because it's a structurally new coordination primitive for agentic coding — peer-to-peer, shared-task-list collaboration — not just parallel isolated workers.

## What the source says

### Agent Teams: what it is and why it's novel
Claude Code's new Agent Teams feature can spin up multiple Claude Code instances (shown here as four) working at the same time in separate terminal panes, collaborating on one shared task. [00:00] Medin frames this as feeling like "peering into the future of agentic engineering." He's careful to note that split-pane, multi-terminal agent setups aren't new by themselves [00:00] — what's novel is two specific things: (1) the **primary/lead agent decides the team composition itself**, based on the user's request, rather than the user manually defining each worker; and (2) all spawned agents **work off the exact same shared task list** and actively talk to each other mid-task ("let me complete this before you work on this") — which Medin says goes "way beyond sub agents." [00:46]

### How it works mechanically
A lead Claude Code agent receives the user's request, analyzes it, decides what team to form, and spawns each teammate as its own tmux/iTerm2 terminal pane in real time. [05:41] Each spawned agent is literally a fresh Claude Code session, launched via a command that passes in a role-specific prompt (e.g., "you are the security reviewer") plus access to the shared task list so it can coordinate with the others. [05:41] Once all agents finish, the lead agent tears down the terminals and returns control to the simple single-agent view. [07:49]

### Agent Teams vs. Sub-agents — the core distinction (COUNTERINTUITIVE REVERSAL preserved)
Medin frames this as the most important — and most confused — distinction right now, since the two features "operate really similarly" on the surface. [01:18], [10:?]
- **Sub-agents = context isolation.** You dispatch a large, token-heavy task and get back only a summary; the primary agent stays unpolluted by the sub-task's full context. [11:?] Downside: **zero coordination** between sub-agents — it's a black box, only the final summary comes back. This makes sub-agents good for *research* (where only the end result matters) but bad for *implementation*, because the main agent loses visibility into what was actually built, and multiple sub-agents working on related code will "step on each other's toes" without knowing it — bugs the main agent then has to discover and fix afterward. [11:?]
- **Agent Teams = true peer-to-peer coordination.** Agents share a task list, update each other on progress, and communicate role-relevant changes directly — e.g., a backend agent that changes an API endpoint can directly tell the frontend agent to update the component that consumes it. [12:04] Medin states this explicitly reverses the old sub-agent failure mode: "when we had sub agents in the past doing that kind of implementation, those kinds of things would break all the time... but [agent teams] can actually do that."
- **The tradeoff:** Agent Teams costs roughly **2–4x the tokens** of running Claude Code solo or via sub-agents, because maintaining the shared task list and inter-agent communication itself consumes tokens. [12:04]
- **Medin's rule of thumb:** use sub-agents for research/codebase-diving/web search; use agent teams for actual implementation. A common single-session pattern: sub-agent research → produce a plan → feed the plan into an agent team to execute it. [12:04]

### Two reliability problems Medin has personally hit
1. **Team-formation hallucination / vagueness sensitivity.** If the user's instruction to Claude isn't very specific (e.g., explicitly stating team size and each member's job), Claude Code can hallucinate a nonsensical team or mismanage the tmux terminals. Most of the time it works, but Medin has hit outright failures on both Linux and Mac. [~14:min region]
2. **Coordination doesn't guarantee true parallelism / race conditions.** Example given: a database agent and backend agent were run "in parallel," but by the time the database agent finished defining the schema and communicated it to the backend agent, the backend agent had already built most of its work against a wrong/incomplete schema — forcing significant rework. The agents *did* eventually communicate and self-correct, but it was token-wasteful; sequencing (database first, then backend) would have been more efficient. [15:20]

### Medin's fix: a custom skill/command with "contract-first spawning"
To address both problems, Medin built his own instruction set (a Claude Code "skill" + a `/build with agent team` command) that: gives Claude more explicit guidance on how to size/compose a team from a supplied plan; gives explicit instructions for managing terminals to reduce hallucination; and — most importantly — introduces **"contract-first spawning"**: rather than launching all agents fully in parallel, upstream agents (e.g., database) do just enough groundwork to produce a "contract" (e.g., the schema) and hand it to the lead agent before downstream agents (backend, then frontend) are spawned, while the upstream agent keeps working. [16:28]–[17:56] Medin reports this produces "very reliable results" versus telling Claude to "spin up an agent team to do XYZ" with no additional instructions, and explicitly encourages viewers to customize the coordination pattern to their own use case rather than copy his contract-first approach verbatim. [18:59]

### The scale-proof: Anthropic's own C compiler example
Anthropic has published examples pushing agent teams much further than Medin's demo: they used **16 agents** running together via agent teams to build an entire C compiler from scratch. [01:18] Medin frames this as normally a "hundreds of thousands of dollars" hired-dev-team job, done instead for **$20,000 in API costs** — which he notes is still "an insane amount of money," underscoring that agent teams is very token-heavy. The build was run essentially as a forced RL-style loop writing hundreds of thousands of lines of code, and per Anthropic's own writeup, no single agent (even Opus 4.6 handed the whole task) could have done it. [02:54]

### Sponsor/career-adjacent thread: Sonar Summit and the "AI validation pyramid" (separate material vein — do not drop)
Mid-video, Medin runs a sponsored segment for **Sonar Summit**, Sonar's first global virtual event, where he is speaking in a fireside chat on "building self-validation and guardrails into AI coding systems." [07:49] His argued premise: AI already writes 30–40% of new code at major tech companies — adoption is now near-universal — but teams are finding that **shipping code faster does not mean shipping quality faster**: review times are climbing, incidents are up, and security vulnerabilities are slipping through. His session concept is an "AI validation pyramid" framework: define validation requirements *before* writing code, let the agent own the easy foundational layer (type checking, linting, initial test rounds), and have humans control the layers that matter most. Sonar Summit itself has four tracks (keynotes on the future of AI-era software dev, Sonar Cube deep dives, CI/CD code-quality integration sessions, etc.), is free, and runs across time zones. This is presented as Medin's own reputation/thought-leadership positioning ("ship quality at speed, not just code at speed"), distinct from the agent-teams technical content, but source-material nonetheless.

## Mechanisms, methods & implementation detail

**Enabling the feature:**
- Agent Teams is experimental and off by default — enable via an environment variable, or by adding a setting to `settings.json` (the same Claude Code config file used for MCP servers and hooks). [03:25]
- Can be enabled globally or scoped to a specific project by placing the setting in the project's `.claude` directory. [04:01]
- On Windows, this requires WSL (Medin demonstrates from his Linux subsystem). [04:52]

**Terminal requirement:**
- Split-pane visualization requires installing **tmux** (Medin's recommendation) or **iTerm2** — the only two terminal apps Claude Code currently supports for this. [04:01]–[04:22] Installation instructions are OS-specific; Medin includes a README with these steps inside his skill resource. [04:22]

**Running a basic team:**
- Simply ask Claude Code in natural language to form a team, e.g.: "create an agent team to review my codebase... have one agent focus on security, one on code quality, and the other on documentation." [05:15] The lead agent does its own analysis, decides the team, defines a shared task list, and spawns agents one-by-one into new tmux panes. [05:41]

**Interacting with a running team:**
- `Ctrl+B` then an arrow key navigates between tmux terminal panes, letting the user chat directly with any individual agent (e.g., ask what it's working on, how it's coordinating). [07:28]
- The user can also ask the *lead* agent for a status update on the task list and what each teammate is doing. [07:49]
- Medin flags a visibility gap here: there isn't strong built-in tooling to observe inter-agent communication as it happens — you're largely trusting the process is working, aside from watching logs closely or querying agents directly. [07:28]

**The contract-first workflow (Medin's skill):**
1. Feed the skill a pre-built plan (e.g., produced via prior sub-agent research).
2. The instructions guide Claude Code to determine the optimal team composition for that plan (e.g., database/backend/frontend agents) and how many agents are needed — or let Claude decide dynamically. [16:28]
3. Claude Code identifies dependency order ("contract chain") — e.g., database must partially exist before backend can meaningfully proceed, backend before frontend. [17:56]
4. The most upstream agent (e.g., database) is spawned first; once it has enough done to define a "contract" (e.g., the schema), it sends that contract to the lead agent — it doesn't need to be fully finished. [17:56]
5. Only then is the next agent (backend) spawned, while the upstream agent keeps working — so there is still real parallelism, just staged rather than fully simultaneous. [17:56]–[18:59]
6. Run via the command `/build with agent team`, pointing it at the plan file path, and optionally specifying team size (or letting Claude Code infer it). [16:53]
7. Installation: copy the skill into the global or project-level skills directory. [16:53]

## Tools, people, products & organisations

- **Claude Code** — Anthropic's agentic coding CLI/tool; host of the new Agent Teams feature discussed throughout.
- **Agent Teams** — the experimental Claude Code feature itself: multiple Claude Code instances collaborating via a shared task list and direct peer-to-peer communication, as opposed to isolated sub-agents.
- **Sub-agents** — Claude Code's existing parallel-work primitive, characterized by context isolation and no cross-agent coordination; contrasted throughout against Agent Teams.
- **Anthropic** — built and published the Agent Teams feature; also published the case study of using 16 agents to build a C compiler for ~$20,000 in API costs. [01:18]
- **tmux** — terminal multiplexer; Medin's recommended tool for viewing Agent Teams' split-pane sessions. [04:22]
- **iTerm2** — alternative supported terminal app for split-pane viewing (Mac only). [04:22]
- **Cole Medin** — the video's creator; also the author of the custom "agent team" skill/command (contract-first spawning) referenced throughout, and a speaker at Sonar Summit.
- **Sonar / Sonar Summit** — sponsor of this video segment; Sonar's first global virtual event, focused on AI-era software development quality, SonarQube, and CI/CD code-quality integration. [07:49]
- **Opus 4.6** — referenced by Medin (relaying Anthropic's framing) as an example of a single powerful model that still could not have completed the C-compiler-scale task alone. [02:54]

## Examples & use cases

1. **Live demo: 4-agent code review.** Lead agent spawns agents for security, code quality, and documentation review (a fourth pane visible in the opening shot) against Medin's own codebase, coordinating via a shared task list. [00:00], [05:41]
2. **Anthropic's 16-agent C compiler build.** Full compiler built from scratch via agent teams in what's described as an RL-style forced loop, hundreds of thousands of lines of code, ~$20,000 in API costs — Anthropic's own published proof point of scale. [01:18]–[02:54]
3. **Database/backend race-condition failure.** A database agent and backend agent ran in parallel; the backend agent nearly finished before receiving the actual schema from the database agent, forcing rework — Medin's concrete illustration of the "coordination ≠ guaranteed correct parallelism" problem. [15:20]
4. **New-project build with contract-first spawning.** Medin runs his own skill against a from-scratch project plan with a 3-agent team: database agent spawns first, sends its contract to the lead once groundwork is laid, triggering the backend agent to spawn while the database agent keeps working; frontend follows the same dependency logic. [17:56]–[18:59]

## Claims & confidence

- Agent Teams lead agent autonomously decides team composition from the user's request. [fact, high confidence — directly demonstrated on screen]
- Agent Teams agents share one task list and communicate peer-to-peer during execution (not just isolated summaries). [fact, high confidence — demonstrated + explicitly described by Anthropic's own feature design as relayed by Medin]
- Agent Teams typically costs ~2–4x the token usage of solo Claude Code or sub-agents. [claim, medium confidence — Medin explicitly labels this "a really really rough estimate"]
- Anthropic's 16-agent C compiler build cost ~$20,000 in API costs. [claim, medium-high confidence — attributed to an Anthropic-published article, not independently verified by the note-taker]
- No single agent (even Opus 4.6) could have built that C compiler alone. [opinion/claim relayed from Anthropic, low-medium confidence — assertion, not demonstrated]
- Sub-agents are better suited to research; agent teams are better suited to implementation. [opinion, medium confidence — Medin's own heuristic/rule of thumb, stated as personal experience-based guidance rather than proven benchmark]
- Team-formation hallucination and parallel-execution race conditions are real, reproducible failure modes of Agent Teams as of this video. [claim, medium-high confidence — reported as Medin's own first-hand testing experience on Linux and Mac, not a formal benchmark]
- Contract-first spawning produces "very reliable results" versus unguided team formation. [opinion, low-medium confidence — Medin's own subjective assessment of his own custom skill, no quantified comparison given]
- AI writes 30–40% of new code at major tech companies today; review times/incidents/security vulnerabilities are rising as a result. [claim, low-medium confidence — stated as background justification for the Sonar Summit talk, no source cited in the transcript for the statistic]

## Caveats & source gaps

- Agent Teams is explicitly labeled **experimental** by Anthropic — behavior, defaults, and reliability are stated by Medin to be "far from perfect right now" and expected to change. [19:43]
- The transcript gives no quantified benchmark for the claimed 2–4x token multiplier or for how much more reliable contract-first spawning actually is — both are Medin's qualitative impressions from personal testing, not measured data.
- The 30–40% AI-code-authorship statistic is asserted without a cited source in this transcript.
- The video does not show or describe the actual contents of Medin's skill/command instructions in detail ("I'm not going to get too in the weeds with this right now") — the note above is limited to what Medin describes about its behavior, not the underlying prompt/instruction text.
- No discussion of cost controls, guardrails, or governance for agent teams beyond the token-cost tradeoff — e.g., no mention of how to bound runaway spend, error recovery beyond the one schema-mismatch anecdote, or security/access implications of multiple concurrent Claude Code sessions.
- The Windows/WSL requirement is mentioned only in passing; no detail on WSL-specific caveats or limitations is given.
- The video ends without a clear verdict on whether the demoed new-project contract-first build actually completed successfully — Medin cuts away "because the point more is to show the intelligence up front," so the full outcome of that specific run is not shown.

## What this means for Fusion247

*(Cairn's interpretation — separate from the source content above.)*

- This is directly relevant to the existing [[idea-engine-agent-architecture]] and multi-model build-verify work: Fusion's current pattern (Larry dispatching Codex/Fable/Opus roles, [[multi-model-build-verify-loop]]) is conceptually closer to Anthropic's **sub-agent isolation** model than to Agent Teams — each reviewer/builder returns a summary/verdict rather than sharing a live task list. Agent Teams' peer-to-peer coordination model is a candidate upgrade path *specifically for implementation-heavy work packages* (e.g., a future BUILD WP with genuinely separable backend/frontend/schema tracks), while the current isolated-review pattern remains correct for QA/verification roles per [[reviewers-qa-not-pentest]] — coordination and adversarial independence are different needs and shouldn't be conflated.
- The token-cost tradeoff (2–4x) is a real consideration against [[multi-model-loop-usage-pacing]] — Fusion already tracks usage-expensive review loops; adopting Agent Teams for builds would compound that further and should be scoped deliberately, not adopted by default.
- The "contract-first spawning" pattern — upstream work produces a minimal contract before downstream work starts, rather than full parallelism or full serialization — is directly analogous to guidance already in memory: [[parallel-agents-need-worktree-isolation]] (parallelise only the independent) and [[larry-owns-the-build-method]] (size/sequence work packages by coupling). This is independent validation from an external source of a pattern Fusion has already arrived at through its own incidents.
- Not an immediate action item — Agent Teams is still Anthropic-labeled experimental, and this is Claude Code CLI native tooling rather than something Fusion's current subagent-shim architecture (`.claude/agents/*.md`) would gain "for free." Worth a later Pax-style research pass if/when Fusion considers restructuring how specialists coordinate mid-task rather than via Larry-mediated handoffs — but no urgency now.
- The tmux/iTerm2 + WSL requirement means this specific feature isn't directly usable in Fusion's current Windows-native (non-WSL) working setup without extra environment setup — a practical blocker if ever revisited.

## Key concepts & takeaways

- **Agent Teams**: Claude Code's new coordination primitive — shared task list, peer-to-peer inter-agent communication, lead-agent-decided team composition.
- **Context isolation vs. peer coordination**: the core sub-agents-vs-agent-teams axis; isolation trades coordination for token efficiency and is suited to research, coordination trades efficiency for correctness on interdependent implementation work.
- **Contract-first spawning**: stage parallel agent work so upstream agents produce a minimal usable "contract" before downstream agents start, avoiding wasted work from race conditions — without fully sacrificing parallelism.
- Team-formation quality is highly sensitive to prompt specificity — vague requests risk hallucinated/malformed teams.
- Scale is real but expensive: 16-agent builds are technically proven (C compiler) but cost tens of thousands of dollars in API spend even for Anthropic.

## Actions & open questions

- No immediate build action indicated — file as a candidate reference for a future architecture discussion if Fusion revisits how specialists coordinate mid-task (peer-to-peer vs. Larry-mediated handoff), rather than acting now.
- Open question: does Claude Code's Agent Teams feature (as opposed to a bespoke multi-agent orchestration Fusion might build) offer anything the [[idea-engine-agent-architecture]] or [[build-014-control-plane-runtime]] work doesn't already achieve through worktree isolation + Larry-mediated task sequencing? Worth a compare-and-contrast only if Fusion hits a concrete case where isolated sub-agent handoffs are causing the same kind of "stepped on each other's toes" failure Medin describes.
- If Warwick wants to explore this hands-on later: would need WSL + tmux/iTerm2 set up on this Windows machine first, and the feature is still labeled experimental by Anthropic — worth checking its maturity status before any real investment.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/-1K_ZWDKpU0/` — `tubeair-report.md` (sha256 `9330f74fc239…`), `manifest.json` (sha256 `5d4a56395ef9…`). Preserved as captured; never edited or summarised.
