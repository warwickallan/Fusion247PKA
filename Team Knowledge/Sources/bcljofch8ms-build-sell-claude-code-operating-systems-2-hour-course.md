---
source_id: bCljOfCH8Ms
type: source-knowledge-note
source_type: youtube_transcript
title: Build & Sell Claude Code Operating Systems (2+ Hour Course)
source_url: "https://www.youtube.com/watch?v=bCljOfCH8Ms"
video_id: bCljOfCH8Ms
channel: Nate Herk | AI Automation
published: 2026-05-01
transcript_source: auto_captions
captured_at: "2026-07-28T00:04:53+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/bCljOfCH8Ms/tubeair-report.md
  - Sources/_raw/bCljOfCH8Ms/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a 2+ hour tutorial by Nate Herk (AI Automation), a YouTuber and former AI automation agency owner ($100K+/month, sold it), who runs a free 350,000-member AI community ("School"). The video teaches viewers to build a personal "AI Operating System" (AIOS) inside Claude Code — a persistent, tool-agnostic layer that gives an AI agent full context on your business, connections to your live data sources, reusable "skills" for repeatable work, and scheduled/autonomous "cadence" so it acts without you present. It matters because Nate frames this as the actual mechanism behind his own productivity (running a YouTube channel, community, and business largely from inside one Claude Code window), and because he gives away the entire underlying template/repo and methodology for free. The video is simultaneously a technical how-to and a mindset-reframing piece about what "AI-first" work looks like in 2026.

## What the source says

### The core thesis: an "operating system," not a chatbot
Nate frames Claude Code as a literal OS layer — the thing that sits between you and all your files, tools, communications, and business data, the same way Windows/macOS sits between you and your machine [00:00-01:36]. The difference from a normal OS is that this one has intelligence layered on top: it can see everything, interact with it, and remember it better than a human can, because it has perfect recall and instant retrieval from the exact source. He frames most knowledge-work inefficiency as "work about work" — searching for files, remembering which app something lives in — and argues AI eliminates this entirely because it has "context, connections, capabilities, and the right cadence" (the four C's, introduced later) [01:36-02:26].

### Tool-agnosticism as a design principle
A recurring and important thread: **build the method, not loyalty to a single tool**. Nate explicitly discusses migrating his AIOS from n8n (his prior go-to, used "last year") to Claude Code, and says he could not have built this system in n8n [02:26-02:58]. He states he ported his entire AIOS to Codex in about 2 minutes, and could similarly port it to "anti-gravity" or "whatever new kit" appears. His argument: models, APIs, and SDKs will keep changing every ~6 months, so the durable asset is a portable, markdown-based knowledge/instruction layer, not vendor-specific config. This is presented as a philosophy that should inform every structural decision in the build (why he prefers markdown reference files over heavy MCP integrations, why skills are just files, etc.) [02:58-03:31].

### Framework 1 — The Three M's of AI (mindset, method, machine)
A high-level personal-productivity framework, drawn from Nate's own internal doc (shared via his free community), meant to apply both when setting up the AIOS and every day while using/scaling it [03:31-04:28].

**Mindset — three habits:**
1. **The Default Shift** — before any task, ask "how could AI do this, or at least 30% of it?" AI rarely does 100%, but even 30–75% is a real productivity gain. Concrete example: updating 300+ YouTube description tracking links manually (~1 hour) vs. brainstorming an API/MCP/browser-automation solution with Claude Code instead [04:28-05:09]. The stated behavior change: if a task "sounds boring or repetitive," default to automating it, not doing it.
2. **The Function Breakdown** — your job is a tree/set of functions; break any big task (e.g., "automate an entire YouTube video") into small chunks (ideation → scripting → slides → packaging → descriptions → comment replies) and automate one chunk at a time. Chunks are reusable/portable — a "slide deck" chunk built for videos can be reused for meeting prep, etc. [05:09-06:55].
3. **The Curiosity Rule** — never accept AI output without asking why; treat AI as a mentor, not a vending machine. Introduces the concept of **"dark code"**: people ship AI-written code they don't understand, and can't reason about edge cases. The fix is to keep asking "why did you design it this way / what happens if X" — and to always ask if something is automatable if you're unsure [06:55-08:06].

**Key mindset one-liners:** "It's never binary... every task has a leverage percentage, you just have to find it." "Mindset isn't motivation, it's the lens that finds the percentage." Your job is a tree of tasks, which reframes overwhelming goals as achievable [08:06-08:32].

**Counterintuitive reversal — productivity drops before it climbs:** Nate explicitly warns that adopting an AIOS causes an *initial productivity dip* (he estimates roughly 20%) before gains appear, and this is normal, not a sign of failure. He illustrates with two graphs: (1) a change causes a temporary dip, but if the eventual gain (he uses 50%) exceeds the dip, it's worth it; (2) learning is *not* linear, it's exponential — early on you're below where you'd have been doing things the old way, but after a few days (his example: day 3 breakeven, days 4–5 ahead) you overtake and then compound to 5–10x. This is the single most-flagged psychological caveat in the video: **most people quit exactly at the trough**, before the exponential part kicks in [08:32-11:30]. Nate says after ~2 weeks you become unrecognizably more productive and "wouldn't want to go back."

**Method and Machine (the other two M's):** Covered only briefly as forward pointers — method = how to decide what's worth automating and how much (revisited later in the "daily/weekly loop" section); machine = the more technical execution layer, expanded throughout the rest of the video [08:06, revisited ~08:32].

### Framework 2 — The Four C's (the AI Automation Society Operating System / "AISOS")
This is the operational skeleton of the whole build, and Nate stresses the four **must be built in strict order** — you cannot skip levels [11:30-13:31]:
1. **Context** — what AI knows about you, your team, tools, voice, business, money.
2. **Connections** — what data/systems it can reach (APIs, MCP, CLI). Claude Code alone can only search the web; your actual business data lives elsewhere and must be connected.
3. **Capabilities** — what it can *do* with that data/context (this is mostly "skills," covered in depth later).
4. **Cadence** — when it acts autonomously, while you sleep / laptop closed.

He proposes a self-test: open a fresh Claude chat and ask it something — does it answer like a stranger, a coworker, or an executive assistant? That gap is your Context score. A later "audit" skill formalizes scoring against all four C's (see Mechanisms section).

### The seven Tier-1 data domains
Before touching any tool, Nate has viewers manually map their business onto seven categories (grouped under Ops/Comms/Data/Planning): **Revenue, Customer, Calendar, Comms, Tasks, Meetings, Knowledge** [15:08-20:20]. He walks through his own mapping as a worked example:
- Revenue → School (community platform), Stripe, QuickBooks
- Customer → School, YouTube
- Calendar → Google Workspace (single source of truth even when bookings originate in Calendly/ClickUp)
- Comms → Google Workspace (email), ClickUp (internal), Slack (vendors)
- Tasks → ClickUp (internal), Notion (external/vendor projects)
- Meetings → Fireflies (meeting transcripts)
- Knowledge → YouTube transcripts, Google Workspace docs/sheets/drive, local files

The explicit purpose: every tool you use has *some* way to connect to an AI system in 2026 (MCP server, API docs, or worst-case browser automation) — the exercise identifies your connection priorities before you start building [18:13-19:31]. He frames it with a thought experiment: if someone with a question about your business would get a better answer from your AI (because it has perfect memory + can access every source) than from you personally, "we're probably in a good spot" [20:20-21:04].

### Onboarding & the project structure
Walkthrough of setting up VS Code + the Claude Code extension, cloning Nate's free GitHub template repo, and running an "onboard" skill — a seven-question interview (who you are/what you sell, paste 1-2 verbatim writing samples for tone, top 90-day priorities, etc.) that scaffolds day-one context files: `about-me.md`, `about-business.md`, `priorities.md` inside a `context/` folder [21:28-32:20]. The repo's top-level structure: `.claude/skills/`, `archives/`, `context/`, `decisions/`, `references/`, plus a master `claude.md` file that is described as "the master prompt for this project" — defining what the agent is, its skills, and where things live in the folder structure. Nate stresses `claude.md` is a living document he edits ~twice a day and that none of the structure is "set in stone" [24:16-28:56].

### Connecting data sources (ClickUp walkthrough as the worked example)
Nate demonstrates connecting ClickUp end-to-end: creating a separate, scoped-permission account/API key for the AI (rather than using his own full-access personal credentials) so that if something is spending money or taking actions, it's auditable and permission-limited per tool/agent [38:44-39:12]. He deliberately chooses **API integration over an MCP server** for ClickUp, arguing MCP servers expose every endpoint (most unused) and cost more tokens just by being loaded — instead he has Claude Code research the API docs once and save a comprehensive markdown reference file locally, so future calls read cheap markdown instead of re-researching [39:36-41:29]. Secrets go in a `.env` file (git-ignored), never pasted into chat history [41:29-42:17]. He also demos Google Workspace CLI (GWS CLI) — an open-source, "not officially supported," actively-developed Google product providing one unified interface (Drive, Gmail, Calendar, Docs, Sheets, Slides, Admin) plus 100+ pre-built "recipe" skills, set up via either `gcloud` auto-setup or manual OAuth (create a GCP project → OAuth consent screen → desktop client ID → download JSON credentials → `gws auth login` → enable each needed API) [58:04-1:01:28].

### Skills (Capabilities) — deep dive
A skill is a reusable "recipe"/SOP saved as a markdown file so you don't have to re-explain a multi-step process every time. Nate's own example: a LinkedIn-post skill (research → generate graphic → write copy → review → post) triggered by one message instead of five instructions each time. Skills evolve: if an output is wrong, you patch the skill's instructions ("add one more egg") rather than re-explaining every time [25:02-26:36].

Full anatomy of a skill: lives at `.claude/skills/<name>/skill.md`, has YAML front matter (name + description — this is the *only* part read during initial matching, to stay cheap), then step-by-step instructions, and optionally subfolders for `scripts/` and `references/` (naming/location is flexible as long as the skill.md points to the right path) [1:14:19-1:18:15]. **Progressive context loading** is the key efficiency mechanism: Level 1 = scan only name+description across all skills (~100 tokens each) to decide relevance; Level 2 = read the full skill.md only for the matched skill (1,000–2,000 tokens); Level 3 = only pull in reference files/scripts if the specific step actually needs them [1:19:49-1:20:56]. Anthropic's own guidance (per Nate): keep skill.md under 500 lines, move detail to separate reference files.

**Six-step skill-building framework** [1:25:29-1:26:41]: (1) name + natural-language trigger; (2) one-sentence goal/output; (3) the actual step-by-step process ("if you had to do this manually, exactly what do you do, in what order"); (4) reference files needed (style guides, brand assets, current priorities, etc.); (5) rules/guardrails for what could go wrong; (6) a self-improvement loop after building.

**Live build demo:** Nate builds an "infographic builder" skill from scratch using his pre-made "skill-builder" meta-skill, which interviews him (problem to solve, trigger type, step-by-step process incl. calling a Nano Banana image-gen API, output format/location, brand guideline files) and generates the skill automatically, including a supporting reference markdown for API details. First run has visible flaws (logo/background/aspect ratio issues); Nate gives feedback in plain language and the skill self-corrects on the second run — illustrating the **feedback cycle**: invoke → watch it work → give feedback → it patches its own skill.md → repeat, typically 5-6 iterations to reach reliable quality [1:26:41-1:31:44].

**Debugging table** (symptom → fix) [1:32:45-1:33:59]: wrong steps/order → edit skill.md instructions; missing tone/context → add reference files; repeated same mistake → add an explicit rule; struggles with a tool/MCP → build/expand a reference doc; "works but could be better" → iterate by brute-force repetition; skill not triggering → make YAML description more specific; skill triggering too often → disable model-invocation (require explicit slash-command only). Advanced front-matter options exist (allowed-tools, argument-hint, specific model, hooks, delegate-to-subagent) but Nate says you only need these once you've run a skill many times.

**Skills can be project-local or global** (stored in the user's home directory rather than a project's `.claude/` folder) so they're available everywhere, e.g., his front-end design skill [1:34:30-1:35:08]. Skills can also delegate to **sub-agents** to protect the main context window — e.g., a "ClickUp searcher" sub-agent handles heavy searching so results (not the search process) come back into the main session, and he hardcodes stable IDs (like ClickUp list IDs) directly into a skill once discovered, rather than re-discovering them via MCP every run, as a token-saving optimization [1:23:41-1:24:26].

**Where to find/share skills:** Anthropic's official skill library, a community open-source skill-sharing culture, and an emerging marketplace (buy/sell); Nate warns to vet any downloaded skill for malicious intent since skills are functionally prompts with potential script/API-call execution [1:18:15-1:19:01]. Skills are portable across Cursor, Claude, Codex, "anti-gravity," etc., since they're just markdown.

### Cadence — routines, loop, and scheduling (the fourth C)
Three distinct mechanisms, each with different tradeoffs, and Nate is explicit these are NOT interchangeable [1:36:14-1:42:04, expanded 1:49:31-1:56:38]:

1. **Desktop scheduled tasks** ("routines," local or remote/cloud) — configured in the Claude desktop app. A routine is essentially a saved prompt run on a cadence (or triggered by API call / GitHub event). **Local routines** require the desktop app open; **remote/cloud routines** run on Anthropic's own infrastructure and survive your laptop being off. Routines work by cloning a connected GitHub repo, reading its `claude.md`, and executing — then the clone is destroyed (stateless) unless it's a code-changing run (which creates a branch instead of just vanishing). Minimum interval: 1 hour. Usage caps observed: Pro ~5/day, Max (his $200/mo plan) 15/day, Team/Enterprise 25/day, metered overage possible for orgs.

2. **`/loop`** — a newer, session-scoped feature: schedules a recurring or one-time reminder/prompt *within the current open session* via cron-like tools (`cron create`, `cron list`, `cron delete`) invoked in natural language ("every 10 minutes, check my ClickUp," "at 10:23am remind me to..."). Distinguishing constraints: **3-day max expiry** (auto-cleanup safety limit), **no catch-up** (missed runs are just missed), **no persistence** across session/tab closure — closing the terminal or tab kills all its crons. Best for short, active, "help me right now for the next few days" work (watching a deploy, sprinting to a deadline, monitoring an urgent email).

3. **Standard scheduled tasks** (non-loop) — daily/weekly/monthly cadence, do catch up, persist longer-term, but still require the local app/machine.

**Critical technical gotchas for remote routines** (a genuinely non-obvious, hard-won section) [1:42:21-1:47:53]:
- `.env` secrets are git-ignored and therefore invisible to a routine that only clones the public/private repo — API keys must instead be entered directly into the **Cloud Environment's environment variables** setting, and the routine's prompt must explicitly say "use the environment variable directly, don't look for a `.env`" or it will fail (Nate demonstrates a real failed run and the corrected prompt that fixed it).
- **Network access levels**: "trusted" (only Anthropic-vetted domains — safe default), "full" (any domain — needed for e.g. ClickUp's non-vetted API, but carries prompt-injection/exfiltration risk if the routine reads malicious content and could be tricked into sending data externally), "custom" (allow-list specific domains). Nate explicitly flags the security tradeoff and says practical risk is low for private repos you control the inputs to, but the risk is real.
- Browser-automation-based skills that depend on saved cookies (e.g., his School-community poster) **do not work as remote routines** because each run is a fresh, cookie-less environment — this only works for stateless API/header-auth flows.
- Large/context-heavy repos (like his full main AIOS) may be wasteful to run as routines since the whole `claude.md` + repo gets loaded/read every time; he suggests a dedicated smaller repo per routine.
- Resource limits per routine: 4 vCPUs, 16GB RAM, 30GB disk.
- Comparison table vs. desktop scheduled tasks vs. `/loop`: routines need no machine on, no session open, survive restarts, no local file access (repo/API only), fully autonomous (no permission prompts), 1-hour minimum interval; desktop tasks and loop need the machine on, have local file access, and configurable/no permission prompts respectively.

### Permission modes in Claude Code
Three modes are named and contrasted: **Plan mode** (good for brainstorming/skill-building, nothing executes yet); **Edit-automatically/Auto mode** (an AI double-checks each action for safety before running it — uses more tokens but stops for risky things like deletes/pushes); **Bypass-permissions mode** (everything runs unprompted; enabled via Settings → search "claude" → "allow dangerously skip permissions"). Nate says he's used bypass extensively without incident (deletions have only happened when he asked for them) but flags the "full autonomy" risk explicitly [42:17-43:57].

### The knowledge-base / "LLM wiki" system (Andrej Karpathy method)
A major, distinct thread late in the video: Nate adopts a viral idea from Andrej Karpathy for building personal knowledge bases entirely out of markdown files (no vector DB, no embeddings, no chunking pipeline) [2:06:21-2:11:11]. Structure: a `raw/` folder (source dumps: PDFs, articles, transcripts) and a `wiki/` folder that an LLM organizes the raw material into, cross-linked, plus an `index.md` (navigable table of contents/backlinks) and a `log.md` (operation history). Nate uses **Obsidian** purely as an optional visual graph-view layer on top of these plain markdown files — it changes nothing about how the AI actually uses/queries the data. He demonstrates: (1) his 36-video YouTube-transcript wiki with organized sub-folders (tools, techniques, concepts, sources) and automatic backlinking Claude Code inferred entirely on its own; (2) a live 5-minute build of a fresh wiki, feeding it Karpathy's own prompt plus an AI-2027 article via the Obsidian Web Clipper browser extension, watching ~25 wiki pages get generated and linked in real time (~10 minutes for one article, ~14 minutes for his original 36-video batch) [2:12:44-2:18:44].

Key refinements: a **"hot cache"** file (`hot.md`, ~500 characters) storing the most recent context so the agent doesn't have to crawl the full wiki for very recent info — useful for an always-current executive-assistant use case, unnecessary for a static reference archive like YouTube transcripts [2:20:37-2:20:56]. **Linting**: periodically running an LLM health-check over the wiki to find inconsistent/missing data, fill gaps via web search, and surface new connections [2:21:56-2:22:03]. One cited external data point: a Twitter/X user reportedly cut token usage 95% converting 383 scattered files + 100+ meeting transcripts into this wiki format [2:10:57].

**Explicit does-it-replace-RAG verdict (a stated reversal of a common assumption):** the answer is "no, but kind of yes" — depends on scale. The wiki method finds relationships via *explicit links/index navigation* rather than vector similarity; infrastructure is just markdown (near-zero cost beyond tokens) vs. semantic RAG's embedding model + vector DB + chunking pipeline + ongoing compute/storage cost; maintenance is "run a lint" vs. re-embedding on change. Its stated weakness: doesn't scale to enterprise/millions-of-documents volumes — fine for "hundreds of pages," but traditional RAG/knowledge-graph/LightRAG-style pipelines are still needed at very large scale [2:22:44-2:23:29].

### Claude "co-work" artifacts / dashboards
A separate lightweight visualization layer: Claude's desktop "co-work" section supports **live artifacts** — dashboards that call connected data sources (QuickBooks, ClickUp, Fireflies) live when opened, rendering financial/task/meeting visualizations with AI-generated analysis (e.g., runway commentary) [2:24:03-2:25:40]. Nate's stated mindset here: **"POC" = proof of concept** — build the cheap 5-minute artifact first; only invest in a fully custom, continuously-refreshed dashboard (which requires sync logic, refresh cadence, and infra like Trigger.dev or Modal) if the lightweight version proves you actually check it. His personal conclusion: he mostly doesn't need dashboards at all because he can just ask his assistant on-demand for a report/trend pull from any combination of sources [2:26:02-2:27:12].

### The daily/weekly operating loop ("Method," M2 revisited)
Concrete cadence for *using* (not just building) the AIOS: every morning ask it to help plan the day, and if it does this well (using real priorities/messages/calendar), keep going — if not, note what context is missing and patch it. End of day: review which skills were used, what had to be corrected/manually pasted, and iterate. Weekly: run the `/audit` skill (see Mechanisms) to check the four C's. Philosophical point: **"boring is beautiful" deterministic workflows beat AI agents ~9 times out of 10** for actual business processes once broken into small chunks — Nate states that in his former agency, most delivered "automations" barely used AI or agentic autonomy at all; the correct default (a **counterintuitive reversal against the assumption that "more AI/agentic is better"**) is often a plain deterministic script, with Claude Code itself used only to *build* that script (and optionally push it to Trigger.dev/Modal for 24/7 execution) [2:27:34-2:29:49].

### Success criteria (deliberately not called KPIs)
Nate explicitly avoids calling these KPIs because they're subjective, not objective metrics [2:29:49-2:31:30]:
1. Your team/coworkers could message the AIOS directly and get a better answer than from you (because it has more data + perfect memory + never sleeps).
2. You stop opening new browser tabs/apps because you do as much as possible inside Claude Code itself.
3. Knowledge "leaves your head" — fewer sticky notes, less mental overhead, reduced stress, because the system remembers and reminds for you.
Stated bar: if even 2 of 3 are true within the first month, "it took" and you're on the exponential curve.

### Business/organizational and career threads (materially distinct from the technical thread)
- **Team/organizational scaling angle:** once *you* personally have a working AIOS, your business becomes more "AI-ready" — coworkers/employees can be onboarded onto the same pattern, and a shared Google Drive (for example) becomes far more valuable once everyone routes files through it consistently, benefiting every agent that reads from it. Nate states his company is "making it a priority" that all employees use Claude Code, tying this directly to job security: "if you can't do that, you instantly become way too slow and too expensive for the business and they might not keep you around" [1:12:35-1:12:57].
- **Monetization/commercial angle:** skills are having "a big moment" and there's a nascent marketplace to build/sell/trade them — explicitly compared to the earlier wave of people selling n8n workflow templates. Nate is careful to hedge: **"I'm not saying this is going to be a viable business model for a long, long time... you shouldn't bank on it"** — a deliberately tempered claim, not a strong endorsement [1:12:14-1:12:35].
- **Career/reputation framing:** the entire video functions as a lead-generation and authority-building play for Nate's free School community (350K members) and paid programs — nearly every major step ("go grab the file from my community," "I'll drop this in my community") funnels back there. This is presented straightforwardly as part of his business model, not hidden, but it is a materially separate thread from the technical content (community-building/audience-monetization strategy vs. AIOS engineering).
- **Voice-input tooling as a stated future direction:** Nate uses/recommends a voice-dictation tool (he switched from Whisper Flow to "Glido," an affiliate/team relationship he discloses) and floats a vision of an eventual "voice OS" replacing mouse/keyboard entirely, feeding directly into the AIOS [30:11-30:48, 2:31:30-2:32:06].

## Mechanisms, methods & implementation detail

- **Repo scaffold**: `.claude/skills/`, `archives/`, `context/`, `decisions/`, `references/`, root `claude.md` (master prompt) + connections/expansions markdown files.
- **Onboarding skill**: 7-question interview → populates `context/about-me.md`, `about-business.md`, `priorities.md`.
- **`/audit` skill**: scores the project against the four C's (context/connections/capabilities/cadence out of 25 each, 100 total), lists top-3 gaps ranked by leverage, and can be saved each run to track improvement over time. Demo score: 54.5/100 on day one, with feedback like "only 1 of 7 tier-1 domains reachable," "no recurring cadence," "zero user-built skills/agents."
- **`/level-up` skill**: a 5-question self-interview (what did you do 3+ times this week; what felt manual/boring; the "smart intern test" — would you have handed this to an intern rather than explain it yourself; what breaks under 10x load; what single lever would 10x growth) designed to surface new skill/connection opportunities every time it's run.
- **Skill-building pattern**: build manually alongside Claude Code once, then say "let's turn this into a skill," answer clarifying questions, test-watch-feedback loop for ~5-6 runs until reliable.
- **API-over-MCP pattern**: for token efficiency, research API docs once → save as local reference markdown → agent reads cheap markdown instead of re-researching or loading a heavyweight MCP server that exposes unneeded endpoints.
- **Secrets handling**: `.env` file, git-ignored; for remote routines, secrets must additionally be duplicated into the Cloud Environment's env-var settings (the routine can't read the local `.env`).
- **Scoped credentials pattern**: create separate low-privilege accounts/API keys per tool per agent (e.g., "UpAI" ClickUp account) rather than using personal full-access credentials, both for safety (preventing e.g. accidental mass deletion) and for per-agent cost/usage attribution.
- **GWS CLI setup**: install → either automatic G-Cloud CLI setup, or manual (create GCP project → OAuth consent screen → desktop OAuth client → download JSON credential to `~/.config/gws` → `gws auth login` → enable each required Google API in the console).
- **Skill trigger mechanisms**: explicit slash command (`/skill-name`) or natural language matched via Claude reading `claude.md` → scanning skill descriptions.
- **Progressive context loading** (3 levels: name+description scan → full skill.md → optional reference files/scripts) is the specific mechanism keeping many skills cheap to maintain simultaneously.
- **Cron primitives underlying `/loop`**: `cron create`, `cron list`, `cron delete` — all invokable via natural language, session-scoped, 3-day max life, auto-deleted on session/tab close.
- **Karpathy wiki build mechanism**: paste Karpathy's published prompt into a fresh Claude Code session pointed at an Obsidian vault folder → it scaffolds `claude.md` + `raw/` + `wiki/` (with subfolders like analysis/concepts/entities/sources) → drop a source into `raw/` (optionally via the Obsidian Web Clipper browser extension set to save into `raw/`) → tell it to ingest → it self-chunks the source into multiple cross-linked wiki pages and updates the index.

## Tools, people, products & organisations

- **Nate Herk** — presenter; runs "AI Automation Society," a free 350K-member community ("School" platform), and a YouTube channel; former AI automation agency owner (sold after scaling to $100K+/mo).
- **Claude Code** — Anthropic's coding-agent product; the central tool of the entire video, used via VS Code extension or desktop app; described as tool-agnostic-in-spirit but the actual implementation vehicle here.
- **VS Code** — free IDE Nate uses to host the Claude Code extension (vs. the standalone desktop app).
- **Claude Opus 4.7** — the underlying model invoked by the Claude Code chat interface in the demo.
- **Codex** — OpenAI's coding agent; Nate migrated his AIOS here as a portability test (~2 min).
- **n8n (Naden)** — workflow-automation tool Nate previously built his systems in; explicitly abandoned in favor of Claude Code.
- **ClickUp** — Nate's primary internal task/project/comms tool; used as the worked example for API-based connection setup.
- **QuickBooks, Stripe, School** — revenue/financial tracking tools.
- **Google Workspace (GWS) / GWS CLI** — Google's own (unofficial/beta/open-source) unified CLI for Drive, Gmail, Calendar, Docs, Sheets, Slides; called "the most powerful workspace CLI on the internet"; has 100+ pre-built "recipe" skills; explicitly stated as not useful for Microsoft-based environments.
- **Fireflies** — meeting-transcription tool Nate connects for meeting-context ingestion.
- **Slack, Notion** — secondary comms/task tools (vendor-facing).
- **Glido** — voice-dictation tool Nate personally uses and is affiliated with ("official member of the GLO team"); mentioned as an alternative to Whisper Flow; Windows support "coming soon" at time of recording.
- **Obsidian** — free markdown-based note app used purely as an optional visual graph layer over the wiki folder structure; does not change how the AI queries data.
- **Obsidian Web Clipper** — browser extension to save web articles directly into a vault's `raw/` folder.
- **Andrej Carpathy (Karpathy)** — AI researcher who published the viral "LLM wiki" personal-knowledge-base method (data ingest → markdown wiki → Q&A), which Nate adopts and demonstrates.
- **Nano Banana (2)** — AI image-generation model referenced for infographic/slide-deck image generation via API.
- **Trigger.dev, Modal** — infrastructure platforms Nate mentions for hosting deterministic/24-7 automation scripts once Claude Code has built them.
- **Gamma** — slide-deck tool Nate currently uses but speculates he could eventually replace with Google Slides + GWS CLI generation.

## Examples & use cases

- Bulk-updating 300+ YouTube description tracking links (motivating example for the "default shift" habit).
- Building a video-database Google Sheet automatically populated whenever Nate posts a new video (pulls thumbnail, title, link, summary, resources).
- Reading a large planning doc (AIS Live event) and auto-generating a fully labeled, color-coded, task-assigned tracker Google Sheet from it.
- Organizing and re-uploading a large local video archive to Google Drive with date-based foldering, then deleting the local copies.
- Auto-scoring/triaging 30 unread emails by priority against known business context, and auto-marking low-priority ones as read.
- Generating a formatted Google Doc "YouTube resource guide" (with header image, links, CTA) directly from a video transcript, via bash/CLI rather than API/MCP.
- Building and iteratively fixing a branded Google Slides deck, including giving Claude Code Chrome DevTools access so it could screenshot its own output and self-correct spacing/layout errors.
- "Morning coffee" skill: reads calendar + ClickUp + tasks each morning to propose a day plan.
- "Pulse check" skill: cross-project status check that surfaces things at risk of "falling through the cracks."
- Excalidraw-diagram skill and infographic skill, both used to avoid AI-generated images with garbled/misspelled text.
- Comment-analysis skill: scrapes recent YouTube comments and produces improvement themes/priorities.
- Four agents run in parallel (morning-coffee, pulse-check, Excalidraw diagram, YouTube comment analysis) in under 30 seconds of setup time, demonstrating multi-agent leverage.
- ClickUp routine test: message sent via natural language ended up creating/assigning a ClickUp task instead of a DM — presented candidly as a partial success/misunderstanding, not edited out.
- Live rebuild of a Karpathy-style wiki using an "AI 2027" article as the ingested source, generating ~25 cross-linked wiki pages in ~10 minutes.
- Financial (QuickBooks), weekly-commitments (ClickUp), and generic co-work "artifact" dashboards pulling live data on open.

## Claims & confidence

- Nate scaled an AI automation agency to $100K+/month and sold it. [claim, medium — self-reported, no external verification]
- His free community has ~350,000 members. [claim, medium — self-reported platform stat]
- Migrating the AIOS from Claude Code to Codex took "about 2 minutes." [claim, low-medium — anecdotal, not measured/timed on screen]
- A 20% productivity dip is typical when adopting a significant workflow change, followed by exponential gains. [opinion/heuristic, low — presented as Nate's personal framework/observation, not a cited study]
- "Learning is exponential, not linear." [opinion, low — general framework claim, no data shown]
- Claude Code MCP servers consume meaningfully more tokens than equivalent API-reference-file approaches because they expose all endpoints. [claim, medium — plausible and mechanistically explained, but no benchmark numbers given]
- An X/Twitter user cut token usage 95% by converting 383 files + 100+ transcripts into a Karpathy-style wiki. [claim, low — secondhand, unverified, no link/source shown in transcript]
- Deterministic/"boring" workflows outperform AI agents "nine times out of ten" for real business processes. [opinion, medium — stated as a strong, confident claim from direct agency experience, but is an anecdotal generalization, not measured]
- Routine usage caps: Pro ~5/day, Max ~15/day, Team/Enterprise ~25/day; minimum interval 1 hour; `/loop` max lifespan 3 days. [fact, high — read directly from Claude's own UI/settings on screen]
- Skill.md files should stay under 500 lines per Anthropic's own documentation. [fact, high — Nate states he's citing Claude Code's official docs]
- GWS CLI is officially described (per its own GitHub repo, shown on screen) as "not an officially supported Google product," under active development, expect breaking changes. [fact, high — read directly from the repo on screen]
- Skills stored in a project's `.claude/skills/` are project-scoped; those stored in the home-directory-level config are global across all projects. [fact, high — demonstrated directly in the product]

## Caveats & source gaps

- No independent verification is possible for any of Nate's business metrics (agency revenue, community size, subscriber/customer numbers) — all self-reported.
- The video is unmistakably also a lead-generation vehicle for his free School community and (implicitly) paid programs; the "free" framing is real but the community is also the on-ramp to monetized offerings not detailed in this transcript.
- Several live demos are partially or fully blurred/redacted on screen (ClickUp workload snapshot results, pulse-check output, priorities doc content) — the actual underlying business data referenced is not knowable from the transcript, only Nate's narration of it.
- The GWS CLI section acknowledges mixed community sentiment ("some people saying it's finicky," reauthentication issues for others) — Nate's own experience is reported as positive, but he explicitly flags this isn't universal.
- Nate is explicit and self-aware that this is *not* a universal step-by-step playbook — "everyone runs their business differently" — so several sections (especially the Tier-1 domain mapping and skill selection) are demonstrated only via his own specific example, not a generalized rule set.
- Pricing/plan details (Claude $17–20/mo entry tier, $200/mo Max plan for 15 routines/day) are stated as of the recording date and are the kind of detail likely to change; no explicit "as of" date is given beyond the video's own timing cues (references to "we're living in 2026," a July 11 launch date, and an April 30 audit date suggest this was recorded in mid-2026, but this is inferred, not stated as a explicit publish date).
- The monetization/skill-marketplace claim is explicitly hedged by Nate himself ("I'm not saying this is going to be a viable business model for a long, long time") — the source itself flags this as uncertain, not something Cairn is adding independently.
- No benchmark data, screenshots of exact token savings, or reproducible numbers are given for several of the "token efficiency" claims (API-vs-MCP, wiki-vs-RAG) — these are argued mechanistically/anecdotally rather than measured on screen.

## What this means for Fusion247

*(Cairn's interpretation — not sourced from the video.)*

- **This is close to a description of what myPKA already is**, but from a different vendor/architecture angle: Nate's four C's (context/connections/capabilities/cadence) map closely onto Fusion247's own PKM + Team + Expansions + Tower stack — context = `PKM/` + `context/`-style files, connections = MCP/API integrations already wired (ClickUp, Gmail, Supabase, etc.), capabilities = the specialist agent roster + skills, cadence = Tower's routines/watchers/scheduled work. This source is useful less as "new architecture to adopt" and more as **validation + vocabulary** for decisions already made (e.g., the API-over-MCP token-efficiency argument directly supports [[merge-protocol-pr-integration]]-adjacent thinking about minimizing token overhead, and matches Larry's own preference for lean, purpose-built connectors over blanket MCP surface area).
- **The Karpathy-style markdown wiki is directly relevant to ObsidiWikAi** ([[idea-007-obsidiwikai-build]]) — Nate's method (raw/ → wiki/ with index + log + hot-cache, no vector DB, Obsidian as pure visualization) is essentially the same lightweight pattern Fusion247 already shipped as a merged, governed product, but simpler/ungoverned. Worth a scan of whether ObsidiWikAi's LightRAG/Neo4j graph is over-engineered relative to what Nate demonstrates working "well enough" at hundreds-of-pages scale — though note the source itself says this doesn't scale to enterprise volumes, which is exactly the justification Fusion247 had for going further with LightRAG/Neo4j.
- **The productivity-dip/exponential-learning framing is a useful narrative for any future "why did output look worse this week" conversation** — e.g., if a build campaign or new workflow (Tower, Cockpit lift-out) causes a visible short-term slowdown, this gives Larry language to distinguish "expected trough before compounding gains" from "actual regression," provided there's real evidence the new approach is sound (this should not be used to excuse genuinely broken work).
- **The scoped-credentials-per-agent pattern (separate low-privilege API keys per tool per agent)** is worth cross-checking against Fusion247's current credential hygiene — this is squarely Vex's territory (security gate, credential hygiene) and is a concrete, actionable pattern if not already fully implemented across AsdAIr/Tower/Cockpit integrations.
- **The "boring deterministic workflows beat agents 9/10 times" claim reinforces existing Fusion247 practice** — myPKA already distinguishes SOPs/skills from full agentic autonomy in several places (e.g., AsdAIr never auto-acts, Warwick is the gate); this source is corroborating evidence, not new information, for keeping that bias.
- **Not directly actionable**: the routines/`/loop` cadence mechanics (cloud-hosted, stateless, GitHub-repo-based) are Claude-desktop/consumer-plan features, not obviously composable with Fusion247's existing Tower/cron infrastructure — worth a scoping check before assuming any of this maps onto BUILD-014/Tower rather than being a parallel, incompatible scheduling model.

## Key concepts & takeaways

- **AIOS (AI Operating System)** — a persistent, agent-augmented layer (here: Claude Code) with full visibility into and interaction capability over your business's files, comms, and data.
- **Four C's**: Context → Connections → Capabilities → Cadence, built strictly in that order.
- **Three M's**: Mindset (default shift, function breakdown, curiosity rule) → Method → Machine.
- **Tool-agnosticism**: build durable markdown/instruction layers, not vendor lock-in; tools/models will keep changing every ~6 months.
- **Skills = reusable, evolving markdown SOPs** with progressive context loading (name/description → full instructions → reference files) to stay token-cheap at scale.
- **API-over-MCP** as a default token-efficiency pattern: research once, cache as a local reference file.
- **Scoped, per-tool/per-agent credentials** rather than personal full-access keys.
- **Routines vs. `/loop` vs. scheduled tasks**: three genuinely different autonomy/persistence tradeoffs, not interchangeable.
- **The Karpathy LLM wiki**: markdown-only personal knowledge base (raw/ → wiki/ + index + log), Obsidian as optional visualization only, explicitly not a full RAG replacement at scale.
- **Productivity dip before exponential gain** — the expected adoption curve, and the point most people quit.
- **"POC" (proof of concept) discipline** — validate cheaply (a Claude artifact) before investing in a custom-built solution.
- **Success is subjective, not KPI-driven** — team bypasses you to ask the AI directly; you stop tab-switching; knowledge leaves your head.

## Actions & open questions

- Decide whether to formally benchmark Fusion247's own API-vs-MCP token usage claims (currently assumed, per Nate's argument, but not measured internally either) — could inform future integration choices.
- Consider whether AsdAIr/ClickUp/Directus integrations already use scoped, per-agent credentials, or whether this is a Vex-worthy security gap to close (per [[personal-data-never-public-repo]] and general credential-hygiene doctrine).
- Evaluate whether Fusion247's Tower/cron scheduling should adopt any of the routine/`/loop` distinctions (stateless-cloud vs. session-scoped vs. persistent-catch-up) as explicit design vocabulary, even if the underlying Claude-desktop mechanics don't transfer directly.
- No urgent action required — this source is primarily corroborating/vocabulary-providing for architecture Fusion247 has already built (ObsidiWikAi, specialist-skill pattern, four-C's-like structure), rather than surfacing a new capability gap.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/bCljOfCH8Ms/` — `tubeair-report.md` (sha256 `b59a8d46d147…`), `manifest.json` (sha256 `6a9f0a94e442…`). Preserved as captured; never edited or summarised.
