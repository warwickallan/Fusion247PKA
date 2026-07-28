---
source_id: aSZpd7_gmCs
type: source-knowledge-note
source_type: youtube_transcript
title: I Built a Dashboard to Manage Multiple AI Agents at Once
source_url: "https://www.youtube.com/watch?v=aSZpd7_gmCs"
video_id: aSZpd7_gmCs
channel: Bimzy Dev
published: 2026-07-19
transcript_source: auto_captions
captured_at: "2026-07-27T12:11:06+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/aSZpd7_gmCs/tubeair-report.md
  - Sources/_raw/aSZpd7_gmCs/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is a solo dev demo (Bimzy Dev, YouTube) walking through a self-built productivity dashboard for supervising multiple AI coding agents (specifically Claude) working across several concurrent software projects. The core value proposition: instead of watching agents work turn-by-turn, the builder gets a single pane of glass — active diffs, chat sessions, CI/CD pipeline status, pending releases, and a task inbox — so human review concentrates at release-checkpoints rather than every individual change. It matters to Fusion247 because it's a working example of exactly the "orchestrator manages many concurrent agent workstreams with human-in-the-loop gates" pattern Larry/myPKA is also trying to solve, including a looping/self-tasking agent mode and a git-worktree gap the builder has explicitly chosen not to solve yet.

## What the source says

### The core tool: a multi-project agent-tracking dashboard
The builder describes a dashboard ("agentic project tracker") listing all actively-developed projects on the left, each with a task board showing what agents are currently building. [00:00–01:00] For each project he can view: an active/real-time diff feed of the agent's in-progress changes, and a historical visualization of all chat sessions tied to that project — including sessions run from the CLI, meaning a CLI-based Claude session and the dashboard's session view show the *same* underlying session data. [01:00–01:40]

### Pipeline (CI/CD) visualization
For GitHub-backed projects with CI/CD configured, the dashboard renders pipeline status so the builder can confirm changes are passing tests/type-checks. [01:50–02:20] He gives a concrete example: a pipeline failure was picked up autonomously by the agent, which created a task to fix it, worked the task, fixed it, and deployed a "version 7" release — i.e., the agent closed the loop from CI failure → task → fix → deploy without being told to. [02:20–02:45]

### Release dashboard — the primary human-review surface
This is described as the main dashboard he actually uses. It aggregates all changes made by agents since the last published release (e.g., "we're on v9, agents are contributing toward v10/0.10") so he can review the release holistically rather than change-by-change, then click "publish release," which queues a task for an agent to merge into `develop`, cut the release, and bump versions. [02:45–04:10] He explicitly frames this as *his* human-in-the-loop mechanism, in preference to reviewing each individual task as it completes. [06:40–07:00]

### Skills as the backbone / project-specific configuration
"A lot of the backbone of this work is based on the actual skill configuration" — skills can be set globally or per-project, and they determine things like release cadence and workflow, because different projects' release processes differ. The tool aims to be generic/agnostic enough to fit most setups, but the builder acknowledges some projects' release cadences don't map cleanly onto this approach. [04:12–04:50]

### Analytics dashboard (currently thin, explicitly a stub for future plug-in analytics)
Currently connects to the GitHub API for basic analytics. Stated future plan: make this "plug-and-play" so other sources (he names Vercel analytics as an example) can be added depending on the project's stack, plus a view of past releases and their release notes. [04:50–05:20] **This is presented as roadmap/intent, not a built feature.**

### Concurrent multi-project supervision + inbox
With several projects running simultaneously, the dashboard view lets him see at a glance which projects have active agent work and which have a task stuck waiting on human input. A separate "inbox" view collects items where an agent needs human input or review; in his walkthrough he has one pending question from an "agentic study platform" project which he defers on. [05:20–06:15]

### Looping / autonomous task mode (recently added)
A new feature: with looping OFF, a completed task moves to the inbox for review. With looping ON, the agent instead just picks up the next queued task automatically, and human review happens later at the release-review stage instead of per-task. [06:15–06:40]

### Agent-initiated task creation
Agents can create new tasks themselves ("agent task"), subject to rules set via skill configuration (e.g., "you may create a task if it improves project structure, fixes bugs, or fixes linting issues"). Created tasks are visible/logged, which feeds into changelog-style visibility at release time (e.g., separate "feature," "defect," "cleanup" entries). [06:40–08:20]

### Counterintuitive/notable result: unsupervised overnight run found missing test coverage
He reports letting an agent run overnight with looping + agent-task-creation enabled on one project, and it identified missed end-to-end use cases on its own, created tasks for them, and completed the tasks — all without supervision — and by morning it had added a batch of new e2e coverage as discrete tracked tasks. [08:20–08:50] **This is presented as a genuinely surprising/positive outcome** — the agent didn't just execute assigned work, it found gaps in test coverage and self-assigned work to close them.

### Task filtering / archive
An archive/filter view lets him browse completed tasks per project by various constraints (e.g., "what did the agent do on this project on this day"). [08:50–09:05]

### Concurrency model: one agent per project, no git worktrees (explicit limitation)
He states plainly that his workflow only ever runs *one* agent per project at a time, specifically to avoid conflicts — he has not configured git worktrees for parallel agents on the same project, so this is a deliberate simplification/limitation of his current setup, not a tool constraint per se. He can still monitor multiple agents across *different* projects concurrently. [09:05–09:58]

### Claude-only today, multi-model conditional on demand
The tool currently only supports Claude ("that's kind of the ecosystem I'm using"), with a settings panel showing connected Claude account, usage visualization, and a budget-remaining widget in the corner. He says he *might* add generic multi-provider support "based on feedback and whether or not people actually want to use this tool" — explicitly conditional, not committed. [09:58–10:30]

### Closing framing
He summarizes the tool as not doing "everything" but optimizing small-task execution and concurrent multi-agent monitoring, calling it a "huge productivity boost" while preserving his confidence in project quality. Mentions posting GitHub links and a prior video covering his full workspace/skill configuration in more depth (referenced but not included in this transcript). [10:30–11:00]

## Mechanisms, methods & implementation detail
- **Per-project task board** populated by agent work in progress, viewable alongside a **live diff feed** of in-flight changes. [00:00–01:00]
- **Session continuity across surfaces**: a CLI-run Claude session (e.g., managing tasks, making code changes) is the *same* session visualized in the dashboard — implying the dashboard reads from Claude's session/session-log data rather than maintaining a separate record. [01:00–01:40]
- **CI/CD-driven self-healing loop**: pipeline failure detected → agent auto-creates a fix task → agent works it → deploy. Demonstrated concretely with a "version 7" release example. [02:20–02:45]
- **Release-batched review workflow**: agents commit ongoing work against a pending/unpublished release version; human reviews the *aggregate diff since last release*, not each task; clicking "publish release" queues a merge/version-bump/cut-release task for an agent to execute. [02:45–04:10]
- **Skill-driven configurability**: skills (global or per-project) define release cadence/process and the *rules under which an agent may create its own tasks* (e.g., structure improvements, bug fixes, lint fixes qualify; presumably others don't). [04:12–04:50], [07:00–07:40]
- **Two supervision modes** — looping OFF: task→inbox after each completion (fine-grained human gate). Looping ON: task→next task automatically, review deferred to release stage (coarse-grained human gate). [06:15–06:40]
- **Inbox** as the holding area for anything needing human input/review/answer (distinct from the release-review flow). [05:20–06:15]
- **Filtering/archive** of completed tasks scoped per-project with constraint-based filtering (date, presumably project/status). [08:50–09:05]
- **Single-agent-per-project concurrency guard**, manually enforced by the builder's own workflow/skill config, *not* by git worktrees. [09:05–09:58]

## Tools, people, products & organisations
- **Bimzy Dev** — the channel/builder presenting the tool; describes himself building it for his own multi-project agent workflow.
- **The dashboard tool itself** (unnamed in this transcript beyond "agentic project tracker") — a self-built productivity/orchestration UI; GitHub link mentioned as forthcoming but not given in the transcript.
- **Claude (Anthropic)** — the only currently-supported agent/model provider; sessions, usage, and budget are tracked against a connected Claude account.
- **GitHub** — source of repo data, CI/CD pipeline status, and release/version data (API-driven analytics tab).
- **Vercel** — named only as a hypothetical future analytics data source ("Versel analytics from the Verscell dashboard"), not currently integrated. [05:00]
- **"Agentic study platform"** — one of the builder's other projects, referenced only as the source of a pending inbox question; no further detail given.

## Examples & use cases
- A CI pipeline failure autonomously triaged, fixed, and deployed by an agent as "version 7." [02:20–02:45]
- A release cycle moving from v9 (currently live) to v10/0.10 (in progress), with the release dashboard showing every change accumulated toward that release. [03:00–03:20]
- Overnight unsupervised run: agent identified missing end-to-end test coverage, created its own tasks for it, and completed them before the builder woke up. [08:20–08:50]
- Multi-project simultaneous monitoring: at time of recording, two projects have active agent tasks running and one has a task pending human input, all visible from one dashboard view. [05:20–05:40]

## Claims & confidence
- The dashboard shows real-time active diffs and unifies CLI and dashboard session views of the same Claude session. — **[fact]**, high confidence (directly demonstrated on screen).
- An agent autonomously detected a CI failure, created a task, fixed it, and deployed a release. — **[claim]**, medium confidence (asserted by builder, matches what's shown, but underlying logs/mechanism not shown in detail).
- Release-batched human review (vs. per-task review) is the builder's actual day-to-day workflow. — **[fact/claim]**, high confidence (stated directly and consistent with the "looping" feature description).
- Skills determine per-project release cadence and agent task-creation rules. — **[claim]**, medium confidence — mechanism described narratively, not shown configured on screen in this transcript.
- Overnight autonomous run found and closed e2e test-coverage gaps unsupervised. — **[claim]**, medium confidence (self-reported anecdote, not verified against logs in the video; presented as a real, specific incident rather than a hypothetical).
- Tool only supports Claude currently; multi-provider support is conditional on user demand. — **[fact]** (current state) + **[opinion/intent]** (future roadmap), high/low confidence respectively.
- One-agent-per-project is a workflow choice to avoid conflicts, not a hard tool limitation, and git worktrees are not configured. — **[fact]**, high confidence (explicitly stated as his own setup choice).
- The tool "doesn't do everything" but is a "huge productivity boost" for tracking concurrent agent work and maintaining quality confidence. — **[opinion]**, builder's self-assessment, unverified against any external measure.

## Caveats & source gaps
- **No architecture/tech-stack detail**: nothing on what the dashboard is built with, how it connects to Claude sessions/CI data, or data storage — entirely a UI walkthrough, not a build log.
- **No named tool/repo**: the builder says he'll "post the GitHub links" but no name, URL, or repo is given in this transcript.
- **Skill configuration is referenced, not shown**: the mechanics of how skills define task-creation rules or release cadence are described in prose only; the actual skill files/syntax aren't shown here (he points to a separate prior video for that).
- **Overnight autonomous test-coverage anecdote is unverified**: no logs, diffs, or task list shown for this specific claim — take as a self-reported result, not something demonstrated on-screen in this transcript.
- **Analytics/plug-and-play integrations (Vercel etc.) are stated future plans, not built features** — do not treat as currently available.
- **Multi-provider support is explicitly conditional** ("based on feedback... I might consider") — not a roadmap commitment.
- **Safety/governance is essentially absent from this source**: no discussion of guardrails beyond the skill-based task-creation rules and the release-gate review; nothing on rollback, cost overrun protection beyond a usage widget, or handling of conflicting/bad agent output.

## What this means for Fusion247
*(Interpretation — not from the source.)*
- This is close to a live, independent proof-of-concept for the same shape of problem Larry/myPKA's Tower/Cockpit work is solving: multiple concurrent agent workstreams, a human-in-the-loop gate, and a task/inbox model. The **release-batched review pattern** (review the aggregate diff at a checkpoint, not every task) is a concrete, validated alternative to per-task review that's worth comparing against Tower's current merge-check/checkpoint model — it's essentially the same idea (batch review at a stable point) arrived at independently.
- The **agent-initiated task creation, gated by skill-defined rules**, is directly analogous to what [[idea-engine-agent-architecture]] and the BUILD-014/Tower completion work are trying to formalize — a scoped "the agent may create work if X" boundary, enforced declaratively rather than case-by-case. Worth checking whether Fusion247's equivalent boundary (Cairn/Arc/Mason role separation, Builder Preflight) is at least as disciplined as this simple rule-based gate.
- The **explicit one-agent-per-project / no-worktrees limitation**, stated candidly as a chosen simplification rather than solved, reinforces [[parallel-agents-need-worktree-isolation]] — this is exactly the failure mode that memory already warns about, and this source independently confirms it's a real, still-unsolved problem even for a builder shipping a whole orchestration dashboard around it.
- The **CI-failure → auto-task → auto-fix → auto-deploy loop** is a useful reference point for how far unsupervised remediation can reasonably go before a human gate — relevant to any future Tower auto-fix ambitions, and a possible argument for where Fusion247 might raise or lower its own gate thresholds (see [[reviewers-qa-not-pentest]] / [[merge-ready-means-independently-reviewed]] for the current stance on where humans must stay in the loop).
- The tool's Claude-only, single-provider scope mirrors Fusion247's own current Claude-centric build — no new information here, but confirms this isn't an idiosyncratic constraint.
- Nothing in this source changes or challenges any current Fusion247 architecture decision; it's best read as **corroborating evidence** for patterns already in play (release/checkpoint-gated review, rule-gated agent autonomy, worktree isolation risk) rather than a new idea to adopt outright.

## Key concepts & takeaways
- **Release-batched (checkpoint) review** beats per-task review for sustained human oversight of multiple concurrent agents.
- **Looping mode**: toggling whether a completed task returns to human review immediately or the agent self-continues to the next queued task — a direct lever on autonomy vs. oversight granularity.
- **Skills as the configuration backbone**: release cadence and agent task-creation permissions are both skill-driven, not hardcoded into the tool.
- **Agent self-tasking**, when rule-gated, can surface real value (found missing test coverage unprompted) — but this is a single self-reported anecdote, not a demonstrated general capability.
- **Session continuity** between CLI and dashboard views (same underlying Claude session data) removes a common "which surface is source of truth" ambiguity.
- **Unsolved**: true parallel agents on one project (git worktrees) — deliberately avoided here, not solved.

## Actions & open questions
- Compare Fusion247's current merge-check/checkpoint gate design against this release-batched review pattern — is there anything Tower should adopt or that confirms the current design is already ahead of this?
- If Fusion247 ever wants a "let agents self-task overnight" mode, this source's skill-gated task-creation rule (structure/bugs/lint-only) is a useful minimal-scope reference point to compare against the current Cairn/Arc/Mason boundaries.
- No action needed on multi-agent-per-project/worktrees from this source specifically — it confirms rather than resolves the open problem already tracked in [[parallel-agents-need-worktree-isolation]].
- Optional: if Warwick wants to see the actual tool, the builder mentions posting GitHub links and a deeper "workspace configuration" video — neither URL was present in this transcript, so retrieval would require a follow-up source pull, not inference.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/aSZpd7_gmCs/` — `tubeair-report.md` (sha256 `7711df32b1df…`), `manifest.json` (sha256 `ba2f13efb6f2…`). Preserved as captured; never edited or summarised.
