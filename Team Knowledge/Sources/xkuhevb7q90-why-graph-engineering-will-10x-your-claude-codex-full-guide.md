---
source_id: XKUhEvb7Q90
type: source-knowledge-note
source_type: youtube_transcript
title: Why Graph Engineering Will 10x Your Claude/Codex (full guide)
source_url: "https://www.youtube.com/watch?v=XKUhEvb7Q90"
video_id: XKUhEvb7Q90
channel: AI Edge
published: 2026-07-24
transcript_source: auto_captions
captured_at: "2026-09-13T23:29:51+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/XKUhEvb7Q90/tubeair-report.md
  - Sources/_raw/XKUhEvb7Q90/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a solo-creator teardown (channel "AI Edge") of the exact workflow-automation system behind a 1.2M-follower social media business, presented as a replicable 6-step method: audit your workflows → break each into scoreable micro-steps → capture your tacit process as an AI "skill" (via interview or screen-recorded demonstration) → store everything as markdown in a structured business folder → visualize each workflow as an interactive HTML mind map → run the workflows with an AI agent (Claude Code, Codex, or GPT) that improves over time via post-session skill updates. The creator frames this as literally "cloning" themselves — extracting every workflow that lived only in their head into files an AI agent can execute — and argues the hard part is never the agent, it's the four-step knowledge-compression process (audit, spec, file, visualize) that precedes it. [00:00–03:33]

## What the source says

### The core thesis: knowledge compression before automation
The creator's central claim is that manual "second brain" systems (Obsidian, Notion, Google Docs/Notes) fail not because they lack features but because they require constant re-explaining to AI — there's no persistent, structured memory the AI can read cold. Their proposed fix is a system that "automatically evolves over time" so no manual upkeep is needed, built once and expanded rather than rebuilt. [01:16–02:03]

The underlying model: a human brain is "its own algorithm" — pattern recognition trained on data, producing judgments (e.g., "that's an outlier video") without the person being able to articulate why. The task of automation is therefore to make that tacit judgment explicit and hand it to the AI as spelled-out logic, not to expect the AI to intuit it. [02:03–02:42]

### The 6-step method (explicitly numbered by the creator)

**Step 1 — Audit (interview-driven workflow discovery).** [03:33–07:27]
The creator uses a dedicated prompt (an "AI interview") that asks the user to walk through every recurring task in their life/business — planning, meetings, invoices, client calls, emails. For each recurring task the AI asks four fixed questions:
1. What is the trigger?
2. What are the steps and tools required?
3. How often is it done?
4. A derived **clone score** — how automatable it is.

Key reframe: what feels like *one* task is almost always a chain of micro-steps, several of which are automatable even if the whole isn't. Worked example — "landing a deal" decomposes into ~7 sub-processes; some (final negotiation, brand-fit check, content delivery) are explicitly *not* AI-automatable, but everything between them can be. A second worked example — "writing a tweet" — decomposes into: source the idea (scroll bookmarks/saved notes) → write the hook → write the body (length varies by subject) → write a CTA. AI can assist at several of these sub-steps (hook ideas, grammar refinement, scoring against the user's own predefined "what makes a good tweet" criteria) even if the human retains final say on the hook. [04:53–06:28]

Output of the audit: a spreadsheet (creator demonstrates via Google Sheets) with columns: task, hours/month, repeatability (1–5), judgment required, and a computed **clone score** = f(hours/month, repeatability). Higher time-cost + higher repeatability = higher automation priority. The creator stresses honesty in scoring since this list becomes the prioritization queue, and says the tracker should be a living document, re-run periodically as new tasks emerge or priorities shift. Optionally, a column of links to each workflow's HTML map can be added, and maps can be deployed as websites (e.g. on Vercel) or kept local. [06:28–07:56]

### Step 2/3 — Turning a workflow into an AI-readable spec ("skill")
Two alternative methods are given for capturing a workflow once identified as worth automating, both usable in Claude or GPT (creator prefers Claude, citing it as "slightly better" for graphic/visual work, but states tool choice doesn't matter):

**Method A — Conversational interview via Skill Creator.** [07:56–09:13]
If the user can articulate their process verbally, they use Whisper Flow (a dictation tool) to narrate the process to Claude ("This is how I do the YouTube process, I'll walk you through it, ask me questions"), and Claude's "skill creator" converts the back-and-forth into a stored, reusable skill file, downloadable into the user's own filing system so they "own" it as a business asset rather than leaving it trapped in the chat tool.

**Method B — Screen + voice recording (the creator's newer, preferred method).** [09:13–10:47]
Claude has a feature to "record a skill": user clicks the "+" button → "record a skill" → "start recording." Claude then watches the screen (visual capability) and listens via microphone simultaneously while the user performs the actual task narrating their reasoning aloud in real time (e.g., doing spreadsheet data entry while explaining column layout logic, or researching a video by searching a term, scanning for outliers, and logging them). This can be split across multiple recording sessions for long workflows, and the user can return later and say "I want to add to this skill, recording a new video" to extend it incrementally. The creator likens this explicitly to training a new human employee by demonstration rather than by writing a manual. GPT supports an equivalent capability. The creator references a separate, earlier dedicated video with the full step-by-step for this method (not reproduced in detail here — flagged as a **source gap**, see below).

### Step 4 — The business folder (structured, markdown-based memory)
The creator's own folder ("Deutsche OS" / "business brain folder") holds: a self-updating business-profile markdown file (goals, operations, team — created via an initial "brain dump" session, explicitly recommended for anyone switching AI tools so a portable profile survives the switch); meeting notes auto-synced via a tool called **Granola**; and one markdown/skill file per documented workflow (e.g. "deal engine"). Everything is markdown because "it's easier for AI agents to read." The creator notes a markdown file and a Claude "skill" are functionally the same content — a skill is just optimized to be invoked via a `/skill` slash-command, but the underlying text can also be kept as a plain `.md` file. [10:47–11:46]

### Step 5 — Visual mind maps (for humans, not for the AI)
Explicit point: AI doesn't need the visual map — it can read the markdown directly. The map exists because **humans** think differently from AI and need a way to inspect, sanity-check, and oversee automated processes at a glance. [11:46–12:14]

Map conventions demonstrated on two examples (a "deal engine" and a video-production engine):
- **Purple links/lines** = AI-executed steps.
- **Yellow** (including the creator's own name in yellow) = manual steps requiring human execution (e.g., final approval of a video hook, negotiation, brand-fit judgment, content delivery).
- **Green** = a named non-AI tool used at that step (example given: **Clay**, used for data enrichment in the deal pipeline; also mentioned generically: Notion, HubSpot).
- Ratio observed in the creator's own video pipeline: roughly 5 AI-steps to 1 manual step.

Workflow to generate a map: drag the workflow's spec/markdown file into the same Claude/Codework project folder (or use Claude Code, which accesses the same folder), then paste a supplied prompt (part of the free "starter kit" referenced in the description) that encodes the creator's preferred visual spec. The map is generated as an interactive HTML file — hovering a node shows its connections and lists the concrete steps on the right-hand panel. Output can be downloaded/opened locally in a browser, deployed as a standalone website, or merged with other maps into a single combined site (creator prefers keeping them as separate files). If the business folder contains a memory instruction file (referred to as "memory.mmd" in the transcript) stating that every new asset must be logged in the right place, newly generated maps are automatically filed — otherwise the user manually adds the link to the tracker spreadsheet from Step 1. [12:14–16:59]

**Reframing value called out explicitly:** building the map isn't just documentation — it forces critical re-examination of whether the current process is even the best way to do the task (example self-critiques the creator gives on-camera: could a skill be trained better; could a different outlier-finding tool be used; could client onboarding be faster; could email follow-ups be automatic; could meeting notes be pushed automatically to Telegram/email instead of read manually; could a Notion MCP connection tell Claude what's already been published so video ideation is deduplicated and grounded in real view-count data via the YouTube API). The creator frames this reflective habit as core to becoming "AI native," which the video positions as a first-mover advantage window while most people/companies are "falling behind" by not adopting these systems yet. [14:34–15:43]

### Step 6 — Running the workflows (execution layer)
Once steps 1–5 exist, actually running a workflow is described as comparatively easy and is treated as a separate topic the creator doesn't fully unpack in this video (flagged as thin — see Caveats). Options mentioned: [17:01–18:10]
- Run a captured `/skill` command interactively, working alongside the AI in real time (suited to lighter/manual-adjacent tasks).
- Run "loops" for more automatic processes (references a separate dedicated video on loops, not detailed here).
- Manual triggers — e.g., dropping a file into a specific folder triggers a contract-creation workflow.
- Run Claude Code on an automatic schedule for background/unattended execution.
- Use a dedicated always-on machine (creator suggests a Mac Mini) so execution doesn't depend on the user's own device/dispatch.
- Use "a Hermes agent" (named only in passing, no elaboration) for users less comfortable with AI tooling, said to have "its own inbuilt memory" reducing friction.

### The training loop / continuous improvement
The system is explicitly not "set and forget." The AI will make mistakes, hallucinate, or produce suboptimal output, and the creator's practice is to update the relevant skill file at the end of every session with corrections/preferences (their own example: updating visual style preferences for future map generations mid-video). Over time this closes the loop: output data (e.g., video retention) feeds back into skill refinement (e.g., script-writing guidance). The creator self-deprecatingly notes they didn't follow their own AI-assisted script closely in this very video and speculates their content might perform better if they did. [18:10–18:50]

### Closing framing
The creator describes the end-state subjectively as having "Mars clones" — AI instances cloned on their exact knowledge and process — and frames the six-step system as the single most valuable thing a business/individual can do to make AI adoption durable rather than a constant re-explaining exercise, contrasting "everyone else...scrambling to learn AI" against people building this compounding system. [18:50–19:16]

## Mechanisms, methods & implementation detail

1. **Workflow audit prompt** (supplied in the creator's free "starter kit," not included in the transcript itself): an interview script asking trigger / steps+tools / frequency / clone-score for each recurring task, run against an existing AI context/profile file if available, or preceded by a one-time "brain dump" session to create that profile from scratch.
2. **Clone-score prioritization**: score = function of (hours/month consumed, repeatability 1–5); sort descending to decide automation order (creator's own worked order: video production → content repurposing → research...).
3. **Skill capture, Method A (interview)**: Whisper Flow dictation → conversational back-and-forth with Claude's "skill creator" → downloadable skill file.
4. **Skill capture, Method B (demonstration)**: Claude "+" menu → "record a skill" → "start recording" → screen+mic capture while performing the task and narrating reasoning aloud → "done" → skill auto-generated; extensible later via "add to this skill, recording a new video."
5. **Folder structure**: a root business-brain folder containing (a) a self-updating profile markdown file, (b) auto-synced meeting notes (via Granola), (c) one markdown/skill file per workflow spec.
6. **Map generation prompt** (also supplied in the starter kit): drag a workflow's markdown/skill file into the Claude/Codework project, paste the map-generation prompt, which outputs an interactive HTML file coded by color (purple=AI, yellow=manual, green=named external tool) with hover-to-inspect connections and a side-panel step list.
7. **Filing automation**: an instruction file in the business folder (referred to as "memory.mmd") tells the AI to auto-log every new generated asset (e.g., a new map) into the correct place, removing a manual filing step.
8. **Continuous improvement loop**: after each execution session, manually append corrections/preferences to the relevant skill file so the next run improves; downstream performance data (e.g. video retention) is fed back to refine the skill further.

## Tools, people, products & organisations

- **Claude / Claude Code** — the creator's primary AI tool for this system; used for the audit interview, skill creation (via chat or via screen-recording), and map generation. Preferred over GPT specifically for graphic/visual tasks, though creator states GPT works equivalently for the rest of the pipeline. [07:56]
- **Codework** — referenced as an alternative working environment connected to the same project folder (used interchangeably with Claude Code in the demo for dragging in files). [07:56]
- **GPT** — explicitly stated to support the same skill-creation and screen-recording capability as Claude; used as a parity comparator throughout, not itself demonstrated on screen. [10:01]
- **Whisper Flow** — a dictation/transcription tool the creator uses to narrate a process verbally when using the "interview" skill-capture method. [07:56]
- **Granola** — a meeting-recording/notes tool the creator has wired to auto-sync meeting notes into the business folder as markdown. [10:47]
- **Clay** — a named external (non-AI-chat) tool used for data enrichment in the creator's deal/sales pipeline, shown in green on the workflow map. [12:14]
- **Notion, HubSpot** — mentioned as examples of other named external tools that would be marked green on a map if used at a given step; also referenced hypothetically re: connecting a "Notion MCP" to Claude so it can see which videos have already been published. [12:14, 14:34]
- **Vercel** — suggested platform for deploying a generated HTML workflow map as a live website, as an alternative to keeping it local. [07:56]
- **Google Sheets** — used to hold the imported workflow-audit tracker (task list, hours/month, repeatability, judgment, clone score). [06:28]
- **"Hermes agent"** — named only once, in passing, as an option for less AI-native users because it has "its own inbuilt memory"; no further detail given by the source (see Caveats). [17:01]
- **YouTube API** — referenced hypothetically as something Claude could be connected to (via a Notion MCP bridge) to pull real view-count data back into video ideation. [14:34]

## Examples & use cases

- **Deal/business-development pipeline ("deal engine")** mapped end-to-end: Claude runs outlier scan → pulls transcripts → summarizes why a video/deal worked → ranks ideas → creator decides (manual) → Claude generates title options and designs the hook → creator approves (manual) before recording; separately, on the sales side, the team does upfront manual work, then AI takes over subsequent steps including AI-driven data enrichment via Clay. [12:14–12:54]
- **Tweet-writing decomposition**: source idea (bookmarks/notes) → hook → body → CTA, with AI assistable at multiple but not all sub-steps. [06:03–06:28]
- **Deal-closing decomposition**: ~7 sub-steps, with final negotiation, brand-fit check, and content delivery explicitly flagged as non-automatable, everything else automatable. [04:53–05:25]
- **Screen-recorded skill capture, worked example**: narrating spreadsheet data entry ("clients on the left, amounts per month on the right") while Claude watches and listens; and narrating video research ("search a popular term like Claude, look for outliers, note them down, log in a spreadsheet"). [09:35–10:01]
- **Self-critique examples surfaced by the mapping exercise**: automatic email follow-ups for agency client onboarding; automatic Telegram/email delivery of meeting summaries instead of manual review; a hypothetical Notion-MCP-to-YouTube-API connection to ground future video ideation in real performance data. [14:34–15:15]
- **Joke aside** (explicitly flagged by the creator as a joke, not a real example): "maps for how to get out of bed in the morning... go from the bed, brush your teeth... I'm kidding" — included only to illustrate the claimed universality of the method, not as an actual case. [13:29]

## Claims & confidence

- The creator's business runs on ~1.2 million followers and is now substantially operated by AI systems rather than manually. [claim, medium confidence — self-reported, unverified by any external source in this material]
- Manual "second brain" tools (Obsidian, Notion, Docs/Notes) fail to sustain AI-assisted use because they require constant re-explanation to the AI. [opinion, presented as established fact by the source but is a design argument, not a measured result]
- Breaking a workflow into micro-steps reveals that most tasks are partially, not wholly, automatable, and a "clone score" (time × repeatability) is a valid way to prioritize automation effort. [opinion/method, high confidence this is the creator's real practice, low confidence it's been validated beyond their own use]
- Claude and GPT both support screen+voice "record a skill" capture as of this video. [claim, medium-high confidence — demonstrated live on screen for Claude; GPT's equivalent is asserted, not shown]
- Markdown is a preferred format specifically "because it's easier for AI agents to read." [opinion stated as fact by the source; broadly consistent with common practice but not independently substantiated in the video]
- Visual mind maps add no capability the AI needs (it can already read markdown) but materially help human oversight and critical re-examination of processes. [opinion, plausible and internally consistent with the rest of the argument]
- The counterintuitive reversal at the heart of the video: manual, effortful process documentation ("keeping a second brain up to date") is usually seen as the tedious overhead of using AI well; the creator reframes it as the entire leverage point — the audit/spec/map steps (1–5) are "the hard part," while actually running the automation (step 6, "using agents") is "the easy part." Most viewers likely assume the opposite (that adopting an agent is the hard step and documentation is a minor chore). [opinion, high confidence this is the source's central and deliberate reframing — explicitly stated at 02:42–03:11]
- First-mover framing: being "AI native" now confers "such a huge advantage" because most people/businesses are not yet using systems like this. [opinion, unverified]

## Caveats & source gaps

- **Step 6 (running workflows) is the thinnest part of the video by the creator's own admission** — described as needing "a separate video" and largely deferred to two other videos referenced but not included here (one on the screen-recording skill-capture method "before this on the channel," one dedicated to "loops"). No concrete detail is given on how scheduling, loop logic, or the "Hermes agent" actually work — these are name-dropped only. Do not treat "Hermes agent" as a specified product; the source gives no vendor, no setup steps, and no explanation beyond "inbuilt memory."
- The **audit prompt and map-generation prompt are referenced as being in a free downloadable "starter kit" in the video description**, but their literal text is not in the transcript — this note describes their *behavior* as demonstrated on screen, not their exact wording.
- **"memory.mmd"** is transcribed exactly as spoken/captioned but is very likely a mis-transcription of a memory/instruction markdown file name (e.g. `memory.md`) — flagged rather than corrected, since the source gave no on-screen confirmation of the literal filename.
- No quantitative evidence is given anywhere in the video for the claimed business scale, time saved, or ROI of the system — all figures (1.2M followers, hours/month, clone scores) are either unverifiable self-report or fabricated-for-demo example numbers the creator explicitly calls "just examples."
- The relationship between "skills" (Claude's `/skill`-invokable format) and plain markdown files is described as functionally interchangeable by the creator, but no detail is given on any technical difference in how an agent invokes one versus the other beyond the slash-command convenience.
- No discussion of failure recovery, error handling, cost, or agent guardrails beyond the general statement that the AI "will screw up" and needs post-hoc skill correction — there's no structured process shown for how errors are caught before they cause downstream harm (e.g., a bad AI-drafted deal email actually being sent).

## What this means for Fusion247

*(Interpretation — not sourced from the video.)*

- This video is describing, almost feature-for-feature, the same architecture Fusion247/myPKA already runs: a structured business-brain folder (`PKM/`, `Team Knowledge/`, `Team/<Name>/AGENTS.md`), markdown as the canonical medium, specialist contracts as "skills," and Wayfinder maps as the human-facing visual/oversight layer over what agents execute. The video is useful less as a new idea and more as independent external validation that this general pattern (audit → spec → visualize → execute → refine) is a live, working practice outside this estate too — worth citing if Warwick ever wants an external reference point for why myPKA is structured this way.
- The **screen+voice "record a skill" capture method** (Step 2/3, Method B) is the one genuinely new mechanism here relative to current Fusion247 practice: specialist contracts (`AGENTS.md`) are currently authored by Nolan/Larry through text-based drafting, not captured by recording Warwick performing a task while narrating it. If there's a workflow where Warwick's tacit judgment is hard to articulate in writing but easy to demonstrate (e.g., a genuinely idiosyncratic AsdAIr or CareerAIR judgment call), this capture mode could be a useful input method to bring to Warwick as an option — worth flagging, not building.
- The video's **clone-score/audit method** maps closely onto what SOP-001 already does when Nolan is asked "can the team do X," and onto the CAPAE-style "how automatable is this recurring failure/task" thinking already present in the estate's rotation reports — it's a confirming analogy rather than a new mechanism to adopt.
- The **regrowth cap and "nothing may live only in Larry's head" clauses already in CLAUDE.md are a stricter, harder version of this video's core thesis** ("knowledge compression so you never re-explain yourself") — this is worth noting only as a point of resonance, not as license to build any new tracker or system on the strength of this video; the estate's existing constitution already goes further than what's demonstrated here.
- Nothing in this source suggests a specific build, tool adoption, or process change for Fusion247 — it is best filed as a corroborating reference / conceptual validation note in Team Knowledge, not as an action-triggering source.

## Key concepts & takeaways

- **Knowledge compression**: converting tacit process knowledge in a person's head into explicit files an AI can read and act on, without needing to be re-taught each session.
- **Clone score**: a prioritization metric (time cost × repeatability) for deciding which workflows to automate first.
- **Skill vs. spec file**: a Claude "skill" and a plain markdown workflow file are functionally the same content; the skill format just adds slash-command invocation.
- **Screen+voice demonstration capture**: training an AI on a task by recording yourself doing it and narrating your reasoning, analogous to training a new employee by demonstration rather than by writing a manual.
- **Color-coded workflow maps** (purple=AI, yellow=manual, green=named external tool) as a human-facing oversight and critical-reflection layer, not something the AI itself needs.
- **The reframed hard part**: audit → spec → file → visualize (steps 1–4) is the hard, valuable work; actually running agents (step 6) is comparatively easy once that foundation exists — inverting the common assumption that "getting AI to do the work" is the difficult step.
- **Continuous refinement loop**: update the relevant skill file after every session based on what went wrong or what preferences changed, so the system compounds rather than staying static.

## Actions & open questions

- No immediate action is indicated — this is a knowledge-intake note, filed for reference.
- If Warwick wants to explore the screen+voice skill-capture method concretely, the two things missing from this source that would need separate research are: (a) the exact "record a skill" UI/feature in current Claude — worth a quick Pax or direct-check verification that this feature still exists and works as described, since consumer AI product UIs change fast and this video's specificity here is thin on mechanism; (b) the two other referenced videos (skill-recording deep dive; loops) are not sourced yet — flag only if this thread is judged worth pursuing further, no need to fetch them speculatively.
- Open question for Warwick, not urgent: is there any specific Fusion247 workflow currently undocumented because it's hard to articulate in writing but easy to demonstrate live, where this capture method might be worth trying as an experiment? (No action taken — recommendation only, per note above.)

---

**RAW transcript — immutable source evidence:** `Sources/_raw/XKUhEvb7Q90/` — `tubeair-report.md` (sha256 `bc023c0c7fc9…`), `manifest.json` (sha256 `762ad469e6f0…`). Preserved as captured; never edited or summarised.
