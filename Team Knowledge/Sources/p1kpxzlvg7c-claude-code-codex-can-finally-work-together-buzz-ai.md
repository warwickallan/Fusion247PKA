---
source_id: P1KpxzLVg7c
type: source-knowledge-note
source_type: youtube_transcript
title: Claude Code + Codex Can FINALLY Work Together (Buzz AI)
source_url: "https://www.youtube.com/watch?v=P1KpxzLVg7c"
video_id: P1KpxzLVg7c
channel: Riley Brown
published: 2026-07-29
transcript_source: auto_captions
captured_at: "2026-07-30T06:58:15+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/P1KpxzLVg7c/tubeair-report.md
  - Sources/_raw/P1KpxzLVg7c/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is a two-part interview-style YouTube video: Riley Brown (content creator/entrepreneur) hosts Vinnie (a self-described Buzz power-user whose demo of the tool went viral on X), followed by Riley's own solo walkthrough of his personal Buzz setup. The subject is Buzz, a free, open-source, Slack-like chat application built by Jack Dorsey's company Block that lets a user run multiple AI coding/agent tools (Claude Code, Codex, Cursor, Grok, Kimi, Devin, and others) as "teammates" inside shared channels, so they can collaborate with each other and with humans using each agent's own existing subscriptions, skills, and memory. It matters because it reframes the unit of work from "one human talking to one model" to "one human orchestrating a standing team of differently-skilled agents that talk to each other," while keeping all data under the user's own control rather than a vendor's.

## What the source says

### What Buzz is, structurally
Buzz is positioned as a free clone of Slack, but built "agent native" from the ground up [00:00, 02:53]. On sign-up, a user creates an organization/team, is prompted to pick a default agent harness, and can add agents backed by whichever CLI coding tools are already installed on their machine (Claude Code, Codex, Cursor, Grok Build, Devin, open source tools like OpenCode) [02:53, 43:52-44:58]. Buzz auto-detects installed harnesses and offers one-click install of the connector for each [07:30-07:56].

### The "context harvester" thesis (why it's going viral)
Vinnie's core explanation for Buzz's virality is not "it replaces Slack" (which he calls the superficial reason) but that it is "a giant context harvester" — a single place where all context lives and can be shared between teammates and agents, with the openness to swap models freely without losing that context [02:10-02:53]. This is presented as the deeper structural insight distinguishing Buzz from a simple Slack clone.

### Agents, models, and the "layer on top" mechanism
An agent created inside Buzz is, mechanically, just the underlying CLI tool (Codex, Claude Code, etc.) with an added system prompt layered on top, plus Buzz's own internal system prompt teaching it how to use Buzz's tools [06:07-06:53]. Critically, when a user switches an agent's underlying model/harness (e.g., moving "Harry" from Claude Opus to Codex/"Soul"), all of that agent's historical context and chat-session history transfers automatically to the new harness — Vinnie frames this portability as the single most important practical benefit, independent of which model or harness you currently prefer [05:12-06:07].

### Multi-agent collaboration in channels
Users can tag multiple agents in one message and they all read and respond, sometimes negotiating who "takes the lead" [00:28-01:13, 03:34]. A demonstrated example: Codex was told to build a landing page and to "consult with Claude Code first" — Codex took the lead, asked Claude Code questions, Claude Code reviewed and contributed ideas, Codex pulled context from Riley's Notion notes, and the result was deployed live to Vercel [03:34-04:18]. Vinnie reports Buzz's harness handles turn-taking well: agents "duke it out," disagree, and reach a concise resolution rather than looping forever — he tested this with a genuinely high-stakes task (reviewing/negotiating clauses in a legal contract with two different models cross-referencing old email contracts) and the agents converged to a final agreement after roughly 30 minutes of structured back-and-forth [14:27-15:38]. He compares the effect to "Multibook" — a more structured, productive version of that earlier multi-agent-chat concept [15:38].

### Creating agents/channels conversationally
Agents and channels can be created just by asking an agent in natural language (e.g., "Fizz, create a new agent named Harry powered by Codex, and a public channel called research") — Buzz shows an approval prompt before executing, then the new agent/channel appears [06:53-07:56]. Buzz ships with default preloaded agents (e.g., "Fizz") that the user talks to for meta-configuration tasks [07:56-08:19].

### Parallelism when you only have one harness/subscription
Because not everyone has multiple paid harnesses, each agent has an "advanced parallelism" setting controlling how many simultaneous task sessions it can run — e.g., a user with only Codex can set it to 5, 10, 20 parallel sessions so it effectively works multiple threads at once, simulating a multi-agent team from one subscription [16:12-17:16].

### Huddles (voice)
Buzz has a "huddle" feature analogous to Slack's — a live voice channel with agents. To make it work you must press a specific keyboard/transcript-start button, join agents to the huddle, then speak; the agents transcribe and respond only to messages that actually require a response, skipping the rest [17:34-19:04]. In testing, a faster, smaller model (Sonnet-class) was able to reply in voice; a much larger/slower model ("Fable") reportedly couldn't/didn't respond in time [19:04].

### Adding further harnesses (Cursor, OpenCode, Open Router/any model)
Any tool implementing the underlying protocol can be added (see Mechanisms section) — Cursor and open-source tools like OpenCode are confirmed candidates, and Riley notes you can even ask your existing agent (Claude Code) to configure a newly-downloaded harness (e.g., Devin) for visibility inside Buzz [19:56-21:25, 42:32-43:52]. Vinnie separately notes OpenCode is one of the best routes to access many different models, and mentions its subscription products ("OpenCode Go" and "Zen") as things he likes without being affiliated [20:42-21:25].

### Mobile app
Buzz has a free iOS app that Vinnie compares favorably to remote-control via the ChatGPT app for Codex — pairing is a single QR-code scan, after which you can mention agents and get replies from your phone in sync with the desktop session [21:25-22:30]. Riley demonstrates this live later in the video, controlling an in-progress thumbnail-design task from his phone [51:42].

### Compute-sharing and the agent-to-agent economy (payments thread — commercial/strategic)
Under Settings → Compute, a user can toggle "share compute" so other community members can run agents on the user's own machine, using a locally-run open-source model that Buzz selects to fit the machine's specs [22:54-23:18]. Vinnie extends this into an explicit economic thesis: because frontier/data-center models are expensive and current subscription pricing is likely subsidized (and will probably rise), a market opportunity exists for people who invest in powerful local hardware to let others pay per-task to use that compute — potentially even agents paying other agents (a lower-tier model paying a higher-tier model to complete a task it can't do itself) [24:10-25:36]. This is presented as a coming "agent-to-agent economy," not yet built into Buzz, but structurally implied by the compute-sharing feature.

### Projects — Buzz as a potential "GitHub killer" (strategic/counterintuitive thread)
Beyond being a Slack alternative, Vinnie states Buzz is also positioned to compete with GitHub, driven by the same openness philosophy: because Buzz spins up a server + database ("relay") for each community, code can be pushed to that relay as cloud storage/collaboration instead of (or alongside) GitHub, while still supporting normal GitHub workflows [25:36-28:38]. Each time an agent creates/codes an app, Buzz creates a folder (and copies of it) so multiple agents can work on different versions/ideas of the same app in parallel without stepping on each other, then the user can direct agents to push the result to GitHub or to the Buzz relay [29:02-29:43]. Vinnie is careful to frame this as his own read of Jack Dorsey's philosophy, not an official Buzz claim — and flags a caution: he believes Buzz may be "going after too many tools at once" (Slack, GitHub, and more) rather than a narrow single focus [26:24-33:47].

### Data hosting/ownership model (contrast with Slack)
Unlike Slack, where the vendor owns the servers/database and all message data flows through and is stored by Slack, Buzz's model gives each community either a Block-hosted "relay" (server+database) or the option to self-host it — so the operator retains more control over their own data even when Block hosts it for convenience. Inviting teammates works similarly to Slack (send an invite link) [11:08-12:29].

### The "open co-work" / canvas aspiration (product-vision thread)
Riley articulates a personal vision, informed by a year in Silicon Valley watching people chase an "open co-work"/"open Codex" concept: he wants a shared canvas-like artifact view (similar to Codex's in-app browser/side panel) where multiple agents can collaboratively produce documents — slide decks, PDFs, spreadsheets — the way ordinary knowledge workers do, rather than only code. He notices Buzz already has a bare-bones "canvas" feature and interprets this as an early step toward that vision. Vinnie's response is that since Buzz is open source, "someone's going to build it… maybe that person will be you" — prompting Riley to say he'll try forking Buzz after the recording to experiment with adding this [30:12-32:32].

### Open-source/forkability (strategic thread)
Buzz is explicitly open source; Vinnie confirms a user can fork it, run it locally, and build custom features (e.g., attempting the canvas/browser-view idea) using a frontier coding model, without ever needing to submit a PR upstream [31:50-33:06].

### Workflows/automation — a stated reliability gap (counterintuitive/critical thread)
Vinnie explicitly says workflows (Buzz's recurring/scheduled-task feature) "haven't gotten to work very well," citing missing functionality and likely bugs, though he expects the Buzz team to fix them over time [25:36]. Riley independently confirms this: he set up a workflow to check email at 9am daily inside a "management" chat, and instead of performing the task, the agent merely announced "It's 9am, I need to do this" and listed the task without executing it — a reliability failure both hosts had hit independently [37:29-38:48]. Both frame this as the single biggest current limitation of the agent-team paradigm: every new automated task carries a "hidden tax" of not trusting it will actually fire, undermining the leverage the whole system promises [37:29]. They brainstorm live fixes: (a) create a dedicated "task checker" agent whose only job is to verify other agents completed their recurring tasks and nudge/escalate if not, or (b) have the acting agent ping another agent (e.g., Claude Code checking Codex's work) as a completion check, or (c) run a checker every 15 minutes to catch anything that didn't fire [38:48-40:11]. Related: Vinnie separately tried wiring an external webhook/trigger (an app pushing daily stats into Buzz) to auto-summarize on arrival, and that also "wasn't working well" — he suspects an agent-first approach (rather than pure automation/webhook) would work better, though he hadn't nailed it down [35:27-35:58].

### Riley's personal working method (operational thread)
Riley designates one "lead agent" (Codex, because it holds all ~30 of his existing skills — YouTube researcher, thumbnail generator, Notion research skills, etc. — and because its computer-use ability is strongest) and routes to it first, bringing in other harnesses/models only for second opinions or specialized sub-tasks [46:00-46:53]. He gives a concrete worked example: asking Codex to generate 5 thumbnail options using a skill, then tagging Claude Code, Cursor, and Grok to critique them, then having Codex produce a second, revised round of 5 based on that feedback — a working multi-agent critique-and-revise loop he calls genuinely useful [47:00-51:00].

### Adding an arbitrary model via Open Router (technical/mechanism thread)
Riley separately walks through adding Meta's "Muse"/"Spark" model via Open Router: create a new agent → choose "Buzz agent" harness → LLM provider "OpenAI compatible" → paste an Open Router API key → in Advanced, paste an exact custom `_base_url` value (he notes your existing AI agent, e.g. Claude Code or Codex, can tell you the exact string to paste) → set "thinking effort" to "inherit agent default" three times → the model then becomes selectable. This unlocks using literally any model available through Open Router as a Buzz agent [49:07-50:37].

### The personal "management agent" (career/personal-ops thread)
Riley built a narrow, private agent (powered by Codex, same underlying model as his main agent but with a distinct system prompt) that reads his email, Slack, sponsorship communications, and texts every 3 hours (9am/12pm/3pm/6pm) and produces a prioritized action list, surfacing urgent items first; he can reply directly in that channel to draft responses. He built it by asking Codex to enumerate all his existing management skills/memory and select which mattered for this narrower role [51:42-53:31]. He is now thinking about extending Buzz access to his 6-7 person content team and is filming a follow-up video specifically on team setup and "agents that don't die within Buzz" [53:31-54:28].

### Reputation/career framing (why Riley personally cares)
Riley explicitly compares his reaction to Buzz to his reaction to "OpenClaw" back in January — a signal, in his own framing, that he recognizes a genuinely novel and important form factor early, and that recognizing such moments has been personally/professionally significant for him as a creator in this space [54:28-54:59]. He frames continued Buzz coverage as a multi-video commitment.

## Mechanisms, methods & implementation detail
- **Underlying protocol:** Buzz agents connect to CLI harnesses (Claude Code, Codex, etc.) via an "agent client protocol" (ACP) — Vinnie is unsure of the exact acronym meaning but describes it as an open way for Buzz to communicate with different agent harnesses, effectively running the CLI tools in the terminal on the user's behalf and injecting whatever context each harness needs [04:47-05:12].
- **Agent creation flow:** New agent → choose harness (auto-detected if installed) or "Buzz agent" (for Open Router/custom OpenAI-compatible providers) → optionally set explicit model pin (e.g., "use Sonnet 5 as the only model, always") → optionally set advanced parallelism level → optionally add to specific channels (auto-added on first @mention, or manually searched/added) [16:12-17:16, 19:33-19:56, 45:41].
- **Open Router integration steps (exact, as demonstrated):** create Buzz-agent → LLM provider = OpenAI compatible → paste Open Router API key → Advanced settings → paste exact `_base_url` string → set thinking-effort field to "inherit agent default" (three separate instances) → model becomes selectable from the full Open Router catalog [49:07-50:37].
- **Huddle setup:** must click the small keyboard-icon button next to the agent button to reveal "start transcript," start it, then speak in the temporary huddle channel; agents auto-filter which of several messages need responses [17:54-19:04].
- **Cross-agent consultation pattern:** direct one agent to "take the lead" and consult a named other agent first; the lead agent asks questions, the consulted agent responds, and they iterate a small number of turns before converging and stopping — Vinnie says Buzz's harness enforces a roughly minimal/concise number of turns rather than looping [03:34-04:18, 14:27-15:38].
- **Parallel/multi-agent thumbnail critique loop (Riley's demonstrated workflow):** lead agent (Codex) generates N options using an existing named skill → tag reviewer agents (Claude Code, Cursor, Grok) for ranked feedback → lead agent produces a second revised batch incorporating feedback → repeat/iterate from mobile if desired [47:00-51:42].
- **Reliability workaround proposals for workflows (unverified/proposed, not confirmed working):** (1) dedicated "task checker" agent pinged by every recurring task to confirm completion and escalate/nudge if not done; (2) cross-agent completion check (e.g., Claude Code verifies Codex actually executed, and tells Codex to finish if not); (3) a checker running every 15 minutes to catch missed fires [38:48-40:11].

## Tools, people, products & organisations
- **Buzz** — free, open-source, Slack-like chat app for humans + AI agent teams; built by Block (Jack Dorsey's company); download at buzz.xyz [00:00, 43:03].
- **Jack Dorsey** — founder of Twitter (X), creator/backer of Buzz via Block [00:00].
- **Riley Brown** — host, marketing/business-operations-focused creator, runs a podcast called "Agent Native," works with a ~6-7 person content team [00:00, 13:17, 53:31].
- **Vinnie** — guest, a Buzz power user whose demo video on X went viral (1M+ views); works with team building "Wasp," a full-stack TypeScript framework designed to work well with agents [01:13, 41:50-42:14].
- **Claude Code** — Anthropic's CLI coding agent; one of the primary harnesses connected in Buzz throughout the demos; described as running "Fable" by default in this transcript's terminology [03:34, 19:33].
- **Codex** — OpenAI's CLI coding agent (ChatGPT app); Riley's personal "lead agent" holding ~30 of his skills and best computer-use ability; sessions initiated via Buzz appear directly in the Codex/ChatGPT app's recent chats [04:18-04:47, 46:00].
- **Grok / Grok Build** — xAI's model/CLI tool; used in Buzz for fast responses and as a thumbnail-feedback reviewer [00:28, 43:52].
- **Kimi ("Kimmy") / Kevin** — another model/harness connected in the opening multi-agent demo [00:00-01:13].
- **Cursor** — code editor with agent capability; addable as a Buzz harness, useful for accessing a long list of models (e.g., Sonnet 5 thinking, 300K context) [19:56-21:02, 44:58].
- **Devin** — an agent tool with its own subscription; not auto-detected by Buzz by default, but Riley had Codex configure it so it became viewable inside Buzz [43:52-44:98].
- **OpenCode** — open-source agent tool; confirmed addable to Buzz; has subscription products "OpenCode Go" and "Zen" that Vinnie praises (no affiliation) as a broad-model-access option [20:42-21:25].
- **Open Router** — third-party API aggregator letting Buzz access essentially any model (e.g., Meta's "Muse"/"Spark") via an OpenAI-compatible custom endpoint [49:07-50:37].
- **Fizz** — one of Buzz's default preloaded agents, used for meta-tasks like creating new agents/channels via conversation; Riley is unsure of its underlying model [06:53-07:56].
- **Wasp** — full-stack TypeScript framework Vinnie's team builds, designed to give agents strong scaffolding/tools so instructions like "use Wasp to build and deploy a CRM" work reliably [41:50-42:14].
- **Scrape Creators (scrapecreators.io)** — a skill/API Riley uses to scrape any social media platform with one API key, referenced in his workflow example for a research agent [36:20-36:53].
- **Notion** — Riley's notes app; Codex pulled episode-planning notes from it during the landing-page demo [03:34].
- **Vercel** — deployment target used for the demo landing page [03:34].
- **OpenClaw** — an earlier tool/moment Riley references from January as his last comparable "this is genuinely important" reaction, used to calibrate how significant he judges Buzz to be [54:28].
- **Muse ("Spark")** — Meta's newly released agentic model, added to Buzz via Open Router by Riley as a demonstration [48:14-50:37].

## Examples & use cases
- Codex + Claude Code collaboratively building and deploying a Buzz educational landing page to Vercel, pulling context from Notion notes [03:34-04:18].
- Multi-agent (Codex, Claude Code, Grok, Kimi) simultaneous response to a single broadcast message, shown live at the start [00:00-01:13].
- Agent-negotiated legal contract review: two agents/models discussed contract clauses against prior signed contracts pulled from email, for ~30 minutes, and converged on a final agreed version [14:27-15:38].
- Research channel automation brainstorm: "Harry" (Codex-powered research agent) tasked with structuring how to make a channel productive for sourcing podcast ideas, instructed explicitly to "take turns" and "don't be afraid to disagree" among tagged agents [12:29-13:56].
- Voice huddle test: multiple agents in a huddle only respond to the message that actually needs a reply; Sonnet-class model successfully replies by voice, Fable did not [18:40-19:04].
- Thumbnail generation/critique loop: Codex generates 5 thumbnails using a saved skill and an input face photo found on Riley's computer, other agents (Claude Code, Grok, Cursor) rank/critique, Codex produces a revised set of 5 — reportedly better on the second pass, including inserting Vinnie into one design [47:00-51:00].
- Personal "management agent": reads email/Slack/texts/sponsorship comms every 3 hours and surfaces a prioritized action list Riley can respond to directly in-channel [51:42-53:31].
- Failed daily 9am email-check workflow: the agent announced the task instead of performing it, both hosts hit this independently [37:29-38:48].
- Riley's stated intention (not yet executed on-camera) to fork Buzz and attempt adding a canvas/browser-style shared-document feature [30:12-33:06].

## Claims & confidence
- Buzz is free and open source. [fact, high — stated directly and repeatedly, consistent with described self-hosting/forking mechanics]
- Buzz was created by Jack Dorsey via Block. [claim, high — stated as fact by host, not independently verified in this transcript]
- Vinnie's Buzz video passed roughly 1 million views. [claim, medium — self-reported figure, not independently verified]
- Agents in Buzz communicate with underlying CLI harnesses via an "agent client protocol" (ACP). [claim, medium — Vinnie states this but explicitly says he isn't sure what the acronym stands for or full technical detail]
- Switching an agent's underlying model/harness preserves and transfers all prior context/history automatically. [claim, medium-high — demonstrated conceptually and asserted confidently by Vinnie, not shown via a rigorous before/after test on screen]
- Buzz enforces concise, bounded multi-agent turn-taking rather than infinite loops. [claim, medium — asserted based on Vinnie's own usage experience, including one detailed contract-review anecdote]
- Buzz workflows (scheduled/recurring tasks) are currently unreliable/buggy. [fact-by-demonstration, high — independently reproduced live by both host and guest within the same recording]
- A local/shared-compute "agent-to-agent economy" with per-task payments is a plausible future direction. [opinion, medium — clearly framed as speculation by Vinnie about where the compute-sharing feature could lead, not a current Buzz feature]
- Buzz is implicitly trying to also displace GitHub via its "projects"/relay code-push feature. [opinion/claim, medium — Vinnie is explicit this is his own inference about "what they're not really talking about as much," not an official Buzz statement, and he flags concern that this may be scope overreach]
- The Open Router setup steps (exact base_url string, "inherit agent default" thinking-effort setting) work as described. [claim, medium-high — demonstrated live on screen by Riley, but the exact base_url string itself isn't legible/transcribable from the audio]

## Caveats & source gaps
- Neither host clarifies what the ACP acronym stands for or gives real technical/protocol detail — this is explicitly an acknowledged gap in the source itself, not an omission by this note.
- No pricing, hosting cost, or resource-usage detail for self-hosted vs Block-hosted "relay" servers is given — the comparison to Slack's model is conceptual only.
- The "agent-to-agent economy"/paid-compute-sharing marketplace is discussed entirely as a future possibility inferred from a present toggle ("share compute"); no evidence is given that agent-to-agent payment actually exists in Buzz today.
- The GitHub-killer framing is Vinnie's personal read of Buzz's/Jack Dorsey's philosophy, explicitly caveated ("I can't speak for them... I don't work for Buzz") — not a confirmed roadmap item.
- The workflow/automation reliability fixes discussed (task-checker agent, 15-minute polling agent) are brainstormed on-camera, not confirmed to have been built or tested afterward.
- Riley's stated intent to fork Buzz and build a canvas/document feature is a stated intention at time of recording, not a delivered outcome — no confirmation in this transcript that it happened.
- The video content in Riley's private "management" channel is explicitly not shown/described in detail ("so personal to me... can't open it up") — its exact skill list, prompt, and Notion-link structure are withheld from the audience, not merely summarized.
- No mention of security, credential-handling, or data-governance safeguards for connecting personal email/texts/Slack into an agent, despite that being exactly what Riley's management agent does — this is a notable absence given Fusion247's own private-surface concerns (see interpretation below).

## What this means for Fusion247
This is Warwick's (Larry's) interpretation, not sourced from the video.

- **Direct structural parallel to myPKA's own multi-specialist model:** Buzz's "agent = harness + system prompt layer, context transfers across models" mechanic is conceptually close to how Larry's specialists work (same underlying model, different hat, shared context) — but Buzz additionally lets genuinely different underlying models/vendors (Claude, Codex, Grok, Kimi, Open Router models) collaborate in one channel with shared context, which myPKA does not currently do across vendors. This may be worth a Pax/Mack research pass if there's ever appetite for true cross-vendor agent collaboration rather than persona-switching within one model.
- **The workflow/reliability gap is the single most load-bearing finding for Fusion247's own automation work.** Two independent, experienced power-users hit the exact same failure mode Warwick has already flagged as a hard rule in this project: [[never-acknowledge-before-durable-persist]] and [[a-control-is-not-evidence-until-made-to-fail]] — an agent announcing a task instead of doing it is structurally the same class of failure as a control that reports success without having executed. Their proposed fix (a dedicated "task checker" agent that must be pinged and can escalate) is directly analogous to Fusion247's own emerging pattern of independent verification (Codex QA, mutation-testing controls) rather than trusting the actor's self-report. Worth remembering as external validation of that principle, not a new mechanism to adopt.
- **The "management agent reading email/texts every 3 hours" pattern is close to Larry's own proactive-outputs north star** ([[brain-north-star-proactive-outputs]] — "Warwick, you nearly missed this") — but Riley's version has no visible data-governance boundary between personal comms and the agent, which is exactly the kind of undisciplined design [[personal-data-never-public-repo]] and GL-012 exist to prevent in this project. If Fusion247 ever builds a similar "reads Warwick's comms and prioritizes" agent, the private-surface boundary work already done here (GL-012, secrets store) is the differentiator, not a gap to copy.
- **Buzz's forkability + Open Router universality is a low-cost way to trial arbitrary models** if Fusion247 ever wants to compare model behavior head-to-head on a real task without building custom harness integration — worth keeping in mind as an evaluation tool, not adopting into the production stack.
- **The GitHub-killer/relay ambition is a caution, not an inspiration:** Vinnie's own worry that Buzz is "going after too many tools at once" echoes Warwick's standing principle [[deliver-thin-working-slice-first]] — scope discipline (pick the human face, keep the spine narrow) is exactly the lesson Fusion247 already learned the hard way on BUILD-014/cockpit; Buzz appears to be at risk of the same overreach.

## Key concepts & takeaways
- Buzz = Slack UI/UX + any AI CLI agent as a "teammate," using an open connector protocol (ACP) to bridge to existing Claude Code/Codex/etc. subscriptions.
- The core value proposition, per the most experienced guest, is context centralization/portability across models — not chat-replacement novelty.
- Agents in Buzz = underlying model + a system-prompt layer; switching models preserves accumulated context.
- Multi-agent "take the lead, consult, converge" pattern works well enough for genuinely high-stakes tasks (contract review) according to on-camera testimony.
- Parallelism settings let single-subscription users simulate a multi-agent team.
- Compute-sharing today is a toggle; an agent-to-agent paid economy is speculative future direction, not built.
- Workflows/scheduled automation are the acknowledged weak point of the whole platform right now — a real, independently-reproduced reliability gap, not a one-off glitch.
- Buzz is simultaneously positioned (by inference, not official statement) as a Slack alternative and a GitHub alternative — a scope-breadth risk flagged by the guest himself.
- Mobile parity (iOS app, QR-pairing) is treated as a major practical strength, not an afterthought.

## Actions & open questions
- No build action is indicated — this is a landscape/awareness source, not a Fusion247 build input.
- If Warwick wants to explore Buzz personally: verify current workflow reliability has improved since this recording before relying on any scheduled/automated task in it.
- Open question for Warwick: is there appetite to test true cross-vendor multi-model collaboration (not persona-switching) for any Fusion247 idea-engine or build-verify step, given Buzz demonstrates it's mechanically straightforward via ACP/Open Router?
- Open question: does the "task checker agent" pattern described here suggest a concrete, reusable Fusion247 mechanism (a lightweight completion-verifier subagent for any scheduled/cron work), beyond what Codex/mutation-testing already covers?
- No transcript timestamp gives the actual Open Router `_base_url` string used — if Warwick ever wants to replicate that setup personally, he'd need to pull it fresh from Buzz's own documentation/UI, not from this note.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/P1KpxzLVg7c/` — `tubeair-report.md` (sha256 `c40cc6e6a5f3…`), `manifest.json` (sha256 `16814992f9ea…`). Preserved as captured; never edited or summarised.
