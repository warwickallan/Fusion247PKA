---
source_id: n35KalqEwJc
type: source-knowledge-note
source_type: youtube_transcript
title: Git Worktrees Explained — Run Multiple AI Agents in Parallel (Claude Code Tutorial)
source_url: "https://www.youtube.com/watch?v=n35KalqEwJc"
video_id: n35KalqEwJc
channel: bri
published: 2026-06-14
transcript_source: auto_captions
captured_at: "2026-07-27T12:11:57+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/n35KalqEwJc/tubeair-report.md
  - Sources/_raw/n35KalqEwJc/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a practical tutorial by creator "bri" demonstrating how to use Git worktrees to run multiple AI coding agents (Claude Code or Codex) in parallel without them corrupting each other's work. The core problem: opening two terminal sessions of an AI coding agent in the same project directory causes both agents to read/write the same files simultaneously, creating chaos as code changes underneath each agent without its knowledge. The single reason this matters: worktrees let you decouple Git's working directory from its object store, giving each agent its own isolated folder on disk while sharing one repository history — turning idle "waiting on the LLM" time into genuine parallel throughput across independent backlog tasks.

## What the source says

### The problem: parallel agents in one directory break each other
When running Claude Code (or any LLM coding agent) normally, the workflow is: open a session, give it a task, review, iterate until done [00:00]. The waste is that while the agent is "thinking," you're often just waiting [00:00]. Since backlog tasks are frequently independent of one another, there's no inherent reason to serialize them [00:23]. The naive fix — opening two terminals and running the agent in both — technically lets you work on two tasks, but "just makes a mess" [00:41], because both agents are reading and writing to the *same files in the same working directory*. As one agent edits, the code changes in front of the other agent without explanation, and "all of a sudden everything just breaks" [00:41].

### The Git-level explanation: object store vs. working tree
The fix isn't a change to the AI tool at all — it's a change in how you use Git [00:41]. A Git repository has two structurally separate parts:
- **The object store**: all commits, history, and branches.
- **The working tree**: the actual files on disk that you see in your editor.

Normally these are coupled 1:1 — one repo, one working tree, and checking out a branch changes your visible files. You can only be on one branch, in one directory, at a time [00:41]. **Git worktrees decouple these two things**: you still have exactly one object store (one repo, one history), but you can have *multiple working trees*, each a separate directory on disk, each checked out to a different branch, each fully independent at the file level — changes in one don't touch any other [01:36].

The mental model offered: your main repo is the source of truth, and each worktree is a "satellite" — a separate checkout of the same repo, on a different branch, in a different folder. They share history and remotes, but not on-disk files [01:59]. This means each agent can build its own feature without affecting any other agent's files [01:59].

### Naming convention as a workflow discipline
The presenter's personal convention (not a Git requirement): prefix every worktree directory with the project name, so `ls` in the parent folder groups all worktrees for a project together, and name each worktree after the specific feature it implements, so juggling multiple terminals doesn't cause confusion about "what's happening where" and prevents accidental scope overlap between features [03:48].

### Agent vs. agent comparison — described as the *favorite* pattern
Explicitly called out as **more valuable than parallelism itself**: give two agents the *exact same task* in two separate worktrees, review both outputs, and keep the better one, discarding the other [16:24]. This is presented as especially useful for architecture decisions where multiple valid approaches exist and you want to see both actually implemented before committing to a design. Framed as "free architecture exploration" — because you're not paying double wall-clock time for two attempts; you're paying the *same* time for half the opportunity cost (both explored simultaneously instead of serially) [16:24].

### CLAUDE.md / agents.md scoping across worktrees
A root-level `CLAUDE.md` (Claude Code) or `agents.md` (Codex) file defines project-wide context/instructions. Because worktrees share the same repo, this root file's context is *automatically available in every worktree* with no extra setup [15:01]. Beyond that, you can add a **worktree-specific** `CLAUDE.md`/`agents.md` inside an individual worktree's root to give scoped, additional context relevant only to that feature/task — "scoped context for scoped work" [15:01].

### When to use a worktree vs. a single session (decision rule)
Explicit recap given at the end [18:27]:
- **Use a worktree** when you have two or more tasks today that don't touch the same files.
- **Use a worktree** when a task is risky/ambiguous enough that you want to compare two different approaches before committing.
- **Don't use a worktree** (stick to one single session) when a task spans the *whole* codebase.
- **Don't use a worktree** when the task is exploratory and the agent needs to freely roam the codebase.

## Mechanisms, methods & implementation detail

### Inspecting existing worktrees
From inside a directory with an active Git repo:
```
git worktree list
```
Lists every worktree tied to the current repository: its directory path on disk and the branch checked out in each [02:25]. A fresh repo with no worktrees created yet will just show `main` [02:56].

```
git branch
```
Lists all branches. Branches shown in teal are currently checked out in a *different* worktree/directory; branches in white/plain are local branches not currently open in any worktree [03:48].

### Creating a worktree
Step-by-step as demonstrated [05:19–06:19]:
1. From inside the existing repo directory, move **up one level** so the new worktree folder sits alongside (not inside) the original project folder.
2. Run:
   ```
   git worktree add ../<project-name>-<feature> -b <new-branch-name> origin/<base-branch>
   ```
   Concretely in the demo: `git worktree add ai-agent-endpoint -b new-endpoint origin/staging` (or `origin/main` if you only work off main) [05:56–06:19].
3. Git creates the new branch, tracks it against the specified base branch, and sets HEAD to that base branch's last commit.
4. Confirm with `git branch` (new branch shows in teal, indicating it's now attached to a live worktree) and `git worktree list` (new entry appears) [06:19–07:00].

### Running two agents in parallel — live example
Demonstrated with two simultaneous Codex sessions (presenter notes Codex and Claude behave identically for this purpose) [07:22–07:53]:
- **Worktree 1 — "dashboard creation":** task = add DeFi Llama market-context integration to a dashboard (a backend-heavy change: PHP files) [07:53–08:53].
- **Worktree 2 — "HubSpot access":** task = UI update adding a "select all / unselect all" checkbox to a HubSpot card (a frontend change: HTML/CSS files, running locally so UI updates are visible live) [09:12–11:52].
- Terminal tabs are split-screen and *labeled by directory name*, directly paying off the naming convention from earlier — the presenter can tell at a glance which terminal belongs to which feature [09:12].
- A concrete "gotcha" moment is shown: the Codex agent working on HubSpot access proposed switching to a *different* new branch (`defi-owner`) mid-task; the presenter catches this by checking the current branch, and explicitly instructs the agent to stay on the current worktree's branch instead of splitting the work into an unwanted separate branch — illustrated as a reason to "always read what Codex or Claude is prompting you to do next" rather than blindly accepting [09:30–10:19].
- Both sessions are left running and shown completed later: the HubSpot UI change is verified live and works as expected; the dashboard/DeFi Llama change is more complex and the presenter notes it would need writing tests before committing, though that step is skipped for the video [12:45–13:05].
- Running `git status` in each worktree separately shows *disjoint* diffs — confirming the isolation claim: one side shows only backend/PHP changes, the other only frontend/HTML-CSS changes, with no cross-contamination [13:05].

### Committing, pushing, and merging
After work is done in a worktree, commit and push as normal; each worktree's branch can then be opened as a PR against whatever target branch the team uses (main or staging) [14:12–14:32]. Each branch merges independently. Caveat explicitly flagged: **if multiple agents happen to touch overlapping files across their separate branches, merge conflicts can still occur at merge time** — worktrees isolate the *working directory* during development, not the eventual merge [15:01].

### tmux for persistent, named agent sessions
Presented as the next-level pattern for people who run multiple agents regularly [16:24]:
- Check if tmux is installed; if not, `brew install tmux` [17:36].
- Create a named, directory-scoped session per worktree:
  ```
  tmux new-session -s <name> -c <path-to-worktree-directory>
  ```
  Demo: `tmux new-session -s hubspot -c ../ai-agent-hubspot-access` [18:01–18:27].
- `tmux ls` lists all active sessions and whether each is attached/detached [18:27].
- Benefit: agent sessions **persist even if you close the terminal window** — you can detach, close the terminal, and reattach later without losing the agent's running context. You can check in on any agent at any time [16:24–19:15].
- End-state workflow described: one named tmux session per worktree, each running its own agent instance, each scoped to one task [19:15].

## Tools, people, products & organisations

- **bri** — the video's creator/presenter; describes this as part of their actual day-to-day workflow at work, not just a demo for the video (they explicitly show worktrees already in use on a real project) [02:56, 07:00].
- **Git worktree** — native Git CLI feature (`git worktree add/list`) enabling multiple independent working-directory checkouts against one shared repository/object store [01:36].
- **Claude (Claude Code)** — one of the two AI coding agents referenced throughout; used interchangeably with Codex for this technique; owns the `CLAUDE.md` context file convention [00:00, 15:01].
- **Codex** — OpenAI's coding agent; the one actually used in the live demo. Presenter notes they've "recently been using Codex a lot more often than Claude" but states the worktree technique "works exactly the same" for either [07:53]. Owns the `agents.md` context file convention [15:01].
- **tmux** — terminal multiplexer used to create persistent, named, detachable sessions, one per worktree [16:24].
- **GitHub** — used for branch visualization and opening PRs against staging/main after committing worktree work [14:12].
- **DeFi Llama** — a DeFi data API/service integrated into the demo "dashboard" project as a backend feature (market context) — mentioned only as the target of the example task, not explained further [07:53].
- **HubSpot** — CRM platform; the demo's second worktree implements a UI feature ("access") against a HubSpot-connected card in the same AI-agent project [09:12].
- **AI agent project** — the presenter's own real, in-progress project used as the running example throughout (dashboard + HubSpot access + other unshown worktrees) [02:56, 07:00].

## Examples & use cases

1. **Endpoint worktree creation walkthrough** — creating `ai-agent-endpoint` off `origin/staging` on a new branch `new-endpoint`, purely to demonstrate the `git worktree add` command mechanics [05:19–07:00].
2. **Dashboard creation (DeFi Llama integration)** — a real backend feature added via Codex in its own worktree, run concurrently with the HubSpot task, verified via `git status` showing only PHP/backend file changes [07:53, 13:05].
3. **HubSpot access UI update** — a real frontend feature (select-all/unselect-all checkbox) added via Codex in a second, concurrent worktree, tested live against a locally running instance tied to that exact worktree/branch, verified via `git status` showing only HTML/CSS changes [09:12, 12:45].
4. **Mid-task branch redirect caught and corrected** — Codex suggested creating an additional new branch (`defi-owner`) mid-session in the HubSpot worktree; presenter checks the current branch and explicitly overrides the agent's suggestion to keep everything on the intended single branch — a concrete illustration of "always read what your agent proposes before accepting" [09:30–10:19].
5. **tmux named session for HubSpot worktree** — `tmux new-session -s hubspot -c ../ai-agent-hubspot-access`, shown as auto-creating a persistent session scoped to that directory [18:01].

## Claims & confidence

- Running two AI coding agents in the same working directory causes file-level conflicts and breakage as each overwrites/changes files the other is mid-edit on. [claim — stated as direct personal experience, not measured/cited; high confidence as a general Git-mechanics fact, though "breakage" specifics aren't detailed] [00:41]
- Git worktrees allow one object store (one history) to back multiple independent working-tree checkouts on different branches simultaneously. [fact — this is standard, verifiable Git functionality] [01:36]
- Agent-vs-agent comparison (same task, two worktrees, keep the better output) costs the same wall-clock time as a single attempt while yielding two explored approaches. [opinion — presented as the presenter's favorite/most valuable pattern; the "free" framing is a simplification since reviewing two outputs still costs reviewer time, which isn't addressed] [16:24]
- A root `CLAUDE.md`/`agents.md` file's context is automatically available in every worktree without extra setup, because worktrees share one repo. [fact — follows directly from how the object store is shared] [15:01]
- Worktree-specific `CLAUDE.md`/`agents.md` files can supply scoped context to an individual worktree. [claim — presented as a supported pattern, plausible given tool behavior, but not independently verified in the source beyond assertion] [15:01]
- tmux sessions let you detach and reattach without losing the agent's running context, so agents can keep working after closing a terminal. [claim — stated as personal practice/experience, not demonstrated end-to-end with an actual detach/reattach in the video] [16:24]
- Merge conflicts can still occur when merging worktree branches if agents happened to edit overlapping files. [fact — logical consequence of Git merge mechanics, correctly flagged as a real risk] [15:01]

## Caveats & source gaps

- The video never shows an actual **merge conflict occurring or being resolved** — it's mentioned as a possibility ("you're going to have to resolve" conflicts) but not walked through [15:01].
- The dashboard/DeFi Llama task is explicitly left **untested and uncommitted** in the demo ("this I'm going to have to write some tests... but for this video, we'll skip ahead") — so the full "commit → push → PR → merge" loop is only shown completely for the simpler HubSpot task [13:05].
- No detail is given on **how many worktrees is "too many"** practically (disk usage, terminal/window management overhead at scale) beyond the presenter's own naming-convention workaround.
- The tmux section is a **setup walkthrough only** — session creation and listing are shown, but detach/reattach itself (the actual persistence claim) is asserted, not demonstrated on screen.
- No mention of **cleanup**: how/when to remove a worktree after its branch is merged (`git worktree remove`), disk-space implications of many long-lived worktrees, or what happens to a worktree if its branch is deleted. This is a real operational gap for anyone adopting the pattern long-term.
- "Agent vs. agent comparison" is asserted as valuable but **no worked example** of comparing two divergent implementations is shown in this video — it's described conceptually only [16:24].
- No discussion of **cost** implications of running multiple concurrent paid LLM agent sessions (token/API cost of parallel or duplicate-task runs), which is directly relevant to the "free architecture exploration" framing.

## What this means for Fusion247

*(Larry/Cairn interpretation — not sourced from the video.)*

- This is directly applicable to the standing **[[parallel-agents-need-worktree-isolation]]** memory rule already in force for Larry's own subagent orchestration: concurrent file-mutating agents must use `isolation:"worktree"` — this video is essentially independent confirmation from an external practitioner of exactly the failure mode (agents clobbering shared working-tree state) that rule exists to prevent, plus the underlying Git mechanism (`git worktree add` off a base branch, one object store/many working trees) that the harness's `isolation:"worktree"` flag is presumably implementing under the hood.
- The **"agent vs. agent comparison"** pattern (same task, two worktrees, keep the best) is a candidate technique for Larry's own build-verify loop, distinct from the existing multi-model review loop (Opus builds → Codex QA → Fable adversarial) — this is a *pre-build* divergent-exploration pattern (two implementation attempts, pick one) rather than a *post-build* verification pattern. Could be relevant to `arc`'s T2 (N-frames + convergence) idea-generation mode, or to riskier architecture decisions in future builds where Warwick's philosophy of "future-proof/scalable unless cost-prohibitive" ([[warwick-build-philosophy]]) makes exploring two approaches worthwhile before committing.
- The `CLAUDE.md` (root) + worktree-scoped `CLAUDE.md` layering pattern maps loosely onto Fusion247's own **"two layers max" hard rule** for specialist contracts (wiki `AGENTS.md` + host shim) — different mechanism, same principle of a durable base context plus a scoped local override. Worth noting as prior art if Larry ever needs to give a worktree-based build task extra scoped instructions beyond the root `CLAUDE.md`.
- The naming-convention discipline (`<project>-<feature>` directories, matching branch names) is a lightweight, low-cost habit Larry could adopt for any future worktree-based build campaigns, to keep multiple concurrent build worktrees identifiable at a glance — relevant given past sessions (BUILD-002, BUILD-014) that already involved multiple concurrent worktrees and branches.
- The unaddressed cleanup/cost gaps in the source (no worktree teardown discussion, no token-cost discussion for parallel/duplicate agent runs) are exactly the kind of operational detail Larry would need to define independently before adopting agent-vs-agent comparison as a standing practice — consistent with [[multi-model-loop-usage-pacing]] (the existing note that multi-model review is already usage-expensive; deliberately running duplicate full builds would compound that further).

## Key concepts & takeaways

- **Object store vs. working tree** is the core Git concept that makes worktrees possible: one shared history, many independent on-disk checkouts.
- **File-level isolation, not process-level isolation**: worktrees solve the "agents overwrite each other's files" problem, but do *not* eliminate the possibility of merge conflicts later — isolation is at the working-directory level, not the eventual integration level.
- **Naming discipline compounds**: prefixing worktree folders with project name + feature name pays off across `ls`, terminal-tab labels, and branch listings simultaneously.
- **Comparison beats raw parallelism** as the highest-value use case identified by the presenter — using worktrees to run two competing implementations of the same task, not just two different tasks.
- **Context inheritance is automatic, scoping is optional**: root `CLAUDE.md`/`agents.md` context flows into every worktree for free; worktree-local context files layer additional scope on top.
- **tmux + worktrees = durable, checkable-in-on parallel agents**: the combination that gets closest to a genuinely async, walk-away-and-come-back multi-agent workflow.
- **Decision rule for when NOT to bother**: whole-codebase-spanning tasks and exploratory/roaming tasks are explicitly called out as poor fits for worktree isolation — single-session is still correct there.

## Actions & open questions

- Verify whether Claude Code's own `isolation:"worktree"` option (used in Larry's Agent/Workflow tools) implements this exact `git worktree add` mechanism, and whether it already handles cleanup (`git worktree remove`) after a run — the source doesn't cover cleanup, so this is a gap Larry should check against the actual harness behavior rather than assume.
- Consider whether the "agent vs. agent comparison" pattern (two worktrees, same task, pick the winner) is worth trialing for a future architecturally-ambiguous build decision, weighed against the known cost/pacing concerns already logged in [[multi-model-loop-usage-pacing]].
- No immediate action required on tmux — Larry's own session model doesn't map onto local terminal multiplexing in the same way a solo developer's does, so this is context/awareness rather than an adoptable practice as-is.
- If Warwick ever runs local worktree-based parallel builds himself (outside Larry's own orchestration), this note is a ready-made reference for the raw `git worktree add`/`list` mechanics and naming convention.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/n35KalqEwJc/` — `tubeair-report.md` (sha256 `333dccbff6ba…`), `manifest.json` (sha256 `02e65a40f510…`). Preserved as captured; never edited or summarised.
