---
source_id: 5hzkJ2nDbgw
type: source-knowledge-note
source_type: youtube_transcript
title: 5 GitHub Repos That Fix Claude's Worst Habits
source_url: "https://www.youtube.com/watch?v=5hzkJ2nDbgw"
video_id: 5hzkJ2nDbgw
channel: AI Edge
published: 2026-09-22
transcript_source: auto_captions
captured_at: "2026-09-22T16:22:02+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/5hzkJ2nDbgw/tubeair-report.md
  - Sources/_raw/5hzkJ2nDbgw/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a practical, tool-recommendation video from a creator ("AI Edge") who curates free GitHub repos/plugins for Claude Code. The video presents five community-built add-ons — each addressing a named "bad habit" of frontier LLMs (context loss, buried answers, AI-sounding writing, token bloat, and unreliable engineering judgement) — with live before/after demonstrations inside Claude Code. It matters because it's a low-cost, no-code way to materially change Claude's behaviour (memory persistence, output shape, writing voice, cost, and engineering discipline) using free, community-maintained files, several with tens or hundreds of thousands of GitHub stars as informal validation.

## What the source says

### Framing: models get "dumber" over time
The creator opens with a claim that new models (he names Claude Fable and GPT Astra) seem to degrade in perceived quality "a week or two" after release [00:00], and frames the five repos as ways to counteract this by changing *how Claude is used*, not the model itself.

### Repo 1 — Claude Mem (persistent cross-session memory)
- **Problem addressed**: re-explaining context every new chat/session/terminal, even with an MD context file, because Claude "doesn't always read the file" [01:01–01:50].
- **Mechanism**: captures everything the agent does during a session, compresses it with AI into short summaries (not raw transcripts), and injects relevant summarized context into future sessions [01:50, 02:42]. Explicitly compared to how Claude's own chat product already does this across chats, but which historically did *not* extend to coding sessions/terminal/VS Code.
- **Cross-tool scope**: works with Claude, "OpenClaw" [sic, likely OpenCode/other tool — transcript unclear], Codex, Gemini, and "Hermes" (unclear from transcript) [01:50].
- **Live demo**: creator fed fictional personal facts (favourite colour "burnt orange," first car "2004 silver Toyota Corolla," dog's name "Biscuit," a friend "Tom" laughing at a jellyfish sting) into one session, then opened a brand-new terminal session in an unrelated folder and asked the same questions — Claude Mem retrieved all four facts correctly via a visible tool call ("searching Claude mem") [02:42].
- **By design, it does NOT remember everything** — this is deliberate to avoid bloating Claude's context; it stores compressed summaries, not full transcripts [02:42–03:57].
- **Trade-off named explicitly**: "it can slow Claude down a little bit," judged worth it [02:42].
- **Adoption signal (claim)**: creator states 94,000 GitHub stars and 162+ contributors [01:50].
- **When to use**: best for people using Claude Code/Codex heavily across multiple days on the same project [03:57].
- **Reversal/insight**: the creator explicitly notes you may not realize how bad Claude's native memory actually is until a tool like this is installed and the contrast becomes visible [03:57] — a mild "we assumed this was fine" reversal.

### Repo 2 — "I Have ADHD" (output-structure skill)
- **Problem addressed**: verbose, hedging, "yes-man-style" responses that bury the actionable answer — the creator names this as a growing problem specifically with newer/larger models [04:17–04:40].
- **Mechanism**: implemented as a Claude Code *skill* (a `skill.md` file) with 10 stated rules, of which four are named: (1) lead with the next action, (2) number multi-step tasks, (3) end with one concrete next step, (4) "make wins visible, no preamble" [04:40–05:23]. The creator notes these are things users previously had to manually inject into instruction files; the skill automates it.
- **Activation model**: it is a *skill*, invoked manually per-session via slash command (`/i-have-adhd` or similar), not always-on — the creator deliberately does NOT use it for brainstorming/creative work, only for task/coding-oriented work [05:23–06:20].
- **Live demo 1**: asked whether to use Notion or Google Sheets for a CRM — response came back as "Google Sheets. Three reasons. 1/2/3. Setup time. [Next step]" instead of a discursive comparison [06:00].
- **Live demo 2**: asked to troubleshoot three broken things on a website — response gave steps up front then a concrete "what to do next" close, contrasted favourably against "wordy schmurdy Claude" without the skill [06:00–06:20].
- **Distinction from Repo 4 (Caveman)**, stated explicitly later: ADHD mode targets *structure* (order, steps, front-loading the answer); Caveman targets *volume* (raw word/token count). They overlap on cutting fluff but solve different problems, and can be combined [12:23].

### Repo 3 — Humanizer (anti-"AI-sounding" writing skill)
- **Problem addressed**: default LLM writing has recognizable tics — the creator says he (and by implication, sophisticated readers generally) can identify "what's Claude" and "what's GPT" from style alone, and that professional/creative writing suffers if it reads as AI-generated [06:20–06:53].
- **Mechanism**: a skill (`/humanizer`) that rewrites AI output to remove classic AI "tells." The creator names specific patterns it strips: contrast-phrasing constructs ("It's not X, it's Y"), "force triads" (rule-of-three padding), and generically hedged transitional phrasing [07:20–08:49]. He states there are **25 corrected patterns** in total per the GitHub repo, with **~20 contributors** [08:49].
- **Trainable/personalizable**: users can feed the skill examples of their own writing (or point Claude at prior chat history to infer vocabulary/tone) to update the skill so future rewrites sound like the specific user rather than a generic "humanized" voice [07:53–08:19]. The creator describes his own workflow: voice-dumping via "Whisper Flow" (voice-to-text) and having the skill rewrite it in his established voice, which improves the more he writes/speaks [08:19].
- **Live demo**: a requested "punchy founder tweet" first came back in obvious AI cadence (heavy contrast phrasing: "Most people treat AI like Google... founders who get it treat it like a team..."); after invoking `#humanizer`, the rewrite removed the contrast-triad structure and produced more natural closing lines, e.g. "Most founders use AI like a fast intern... The ones getting the most from it treat it like a co-founder" [07:20, 08:49]. The creator judges it "not perfect, but sounds a lot better," specifically praising the closing sentences [08:49].

### Repo 4 — Caveman (token-cost reduction skill + proxy)
- **Problem addressed**: LLM API/agent usage is billed by token (word) count on both what the agent *writes* and what it *reads*; verbose default outputs directly cost money, and the creator frames this as agents writing "like they know" they're billed by the word, i.e., padding [09:00–10:00 approx region, exact timestamp ~09:xx not separately marked].
- **Mechanism**: described as a "skill plus proxy" — the skill shrinks what the agent *says*; a companion proxy shrinks what the agent *reads* (i.e., compresses/filters input token volume, e.g., large files); middleware applies the same discipline "inside your own code" if you're building an agent yourself. So it operates on three surfaces: the agent you run, the proxy in front of it, and code you build.
- **Adoption signal (claim)**: started as a joke, reached 4,000 GitHub stars in a week, and has since passed **100,000 stars** (creator cites "107.2K") — used as evidence of how widely the cost problem resonates.
- **Live demo**: asked Claude (Caveman mode on) to explain the difference between a skill, an MCP server, and a plugin in Claude Code. Caveman-mode answer was compressed into rule-of-thumb bullet form ("Use skill when repeatable workflow... knowledge = skill, capability = MCP, distribution = plugin"). The same question asked with Caveman mode off produced a materially longer answer.
- **Measured result (creator's own token count, single example)**: Caveman = 409 tokens vs normal = ~600 tokens, roughly a **31% reduction** in this instance. The creator states the general claimed ceiling is **up to ~60–65%** reduction, especially on tasks involving reading large files, and that actual savings vary by use case. (Note: the video's own title/intro claims "65%," the on-screen worked example only demonstrated ~31% — the higher figure is presented as an upper-bound claim, not what was demonstrated live.)
- **Important scope limitation, stated explicitly**: Caveman only shrinks *conversational* verbosity — it does **not** change what the agent actually does; coding/development/scraping task execution is unaffected, only the surrounding language [12:03–12:23].
- **Best-practice combination (creator's recommendation)**: use Caveman on "light mode" for baseline cuts, plus "I Have ADHD" for structuring the remaining output — described as the combo "a lot of people have found" works best [12:23].

### Repo 5 — Andrej Karpathy's single-file `claude.md` (engineering-discipline principles)
- **Provenance/authority claim**: attributed to Andrej Karpathy, described as a founding member of the OpenAI team who later joined Anthropic — presented as the reason this repo carries particular weight, distinct from the other four which are anonymous/community repos.
- **Problem it targets** (Karpathy's diagnosis, as relayed by the creator): LLM coding agents (1) make silent wrong assumptions instead of surfacing confusion or asking for clarification, act as "yes-men," don't present trade-offs, and don't push back when they should; (2) over-complicate code/APIs, bloat abstractions, leave dead code, and build ~1000-line solutions where ~100 lines would do; (3) sometimes silently alter or remove code comments in code they don't fully understand, as a side effect orthogonal to the actual task [13:09–14:00 approx].
- **Mechanism**: not a plugin or install — a single Markdown context/instruction file with **four principles**: (1) *Think before coding* — surface wrong assumptions, hidden confusion, missing trade-offs; (2) *Simplicity first* — avoid over-complication and bloated abstractions; (3) *Surgical changes* — no orthogonal edits, don't touch code outside the task; (4) *Goal-driven execution* — tests-first, verifiable success criteria [14:23–14:44].
- **Adoption signal (claim)**: described as the most highly rated repo of the five, with **214,500 stars** cited.
- **Usage pattern, contrasted with the other four**: unlike ADHD-mode/Caveman/Humanizer (toggled on/off situationally) and Claude Mem (mostly passive/automatic), this file is recommended for **constant, always-on use whenever coding**, because the four principles "remain the same" regardless of task [14:44].
- **Installation flexibility, explicitly described**: (a) drop the `.md` file into a working folder so Claude picks it up automatically when working there; (b) paste its contents into a Claude Project's custom instructions (works in plain chat too, called a "lazy way to do it" — less effective than a folder-scoped file); folder-scoping is the creator's recommendation because it's "the only way to have real control over your own memory" [16:01–16:28].

### Closing framing / synthesis
The creator explicitly contrasts Claude Mem against the Karpathy file on the sovereignty dimension: Claude Mem is convenient but "guesses" what to remember and doesn't give the user full control/ownership of memory; a manually maintained folder-scoped instruction file is framed as the way to retain real ownership — implying the two approaches are complementary, not substitutes [16:28]. He closes comparing Claude (as configured with these five repos) favourably to Codex for general/writing work, while conceding Codex is still better for "deep agentic coding work" in his experience, and flags an upcoming unnamed "new Chord model" as a reason the competitive picture will keep shifting.

## Mechanisms, methods & implementation detail

- **Claude Mem**: background worker compresses session activity into AI-generated summaries (not full transcripts) and stores them; on a new session it is invoked as a searchable tool ("searching Claude mem" appears in the tool-call log) and retrieves relevant summaries rather than replaying full history. Works across multiple agent tools (Claude, Codex, Gemini, and others named but transcribed ambiguously), implying it's not Claude-proprietary.
- **I Have ADHD**: implemented as a Claude Code *skill* file (`skill.md`) containing 10 numbered behavioural rules; invoked per-session via a slash command; explicitly NOT meant to run on creative/brainstorming sessions.
- **Humanizer**: implemented as a skill invoked via `#humanizer` or `/humanizer`; contains ~25 named stylistic "AI tell" patterns it corrects (contrast phrasing, force triads, generic transitions, etc.); supports a *training/update loop* where the user supplies writing samples (or the model mines the user's own chat history) to bias future rewrites toward the user's authentic voice.
- **Caveman**: a three-part system — (1) a skill that compresses agent *output*, (2) a proxy that compresses/filters what the agent *reads* (input token volume, e.g., large file contents), (3) middleware pattern for developers to apply the same discipline inside their own agent-building code. Has a "light mode" for partial compression, intended to be combined with structure-focused tools like ADHD mode.
- **Karpathy file**: no install, no code — a plain Markdown file of four stated principles, dropped into a working folder (auto-picked-up context) or pasted into custom/project instructions. No skill invocation syntax; it's ambient context, always active for the session/folder it's placed in.
- **Creator's own distribution method** (not a repo, but a described practice): he compiles all five into one combined Markdown "setup instructions" file distributed via his free "school" community's resource library, designed to be dragged into Claude Code so it configures all five in one pass.

## Tools, people, products & organisations

- **Claude Mem** — GitHub repo/plugin giving Claude (and other agent tools) persistent, AI-compressed memory across sessions/projects. Claimed 94,000 stars, 162+ contributors.
- **"I Have ADHD"** — a Claude Code skill (GitHub repo) that restructures agent output to front-load actionable next steps and suppress preamble/hedging.
- **Humanizer** — a Claude Code skill (GitHub repo) that rewrites AI text to remove recognizable LLM stylistic tics; ~25 corrected patterns; ~20 contributors.
- **Caveman** — a skill + proxy (GitHub repo) that reduces token expenditure on both agent output and input; claimed 100,000+ (107.2K cited) GitHub stars, started as a joke reaching 4,000 stars in its first week.
- **Andrej Karpathy's `claude.md`** — a single-file instruction set (GitHub repo) of four engineering-discipline principles; claimed 214,500 stars, the highest-rated of the five repos discussed.
- **Andrej Karpathy** — named as a founding member of the OpenAI team who later joined Anthropic; cited as the source/author of the diagnosis behind the fifth repo. (This is the creator's characterization within the video; not independently verified in this note — see Caveats.)
- **Whisper Flow** — a voice-to-text tool the creator personally uses to voice-dump drafts that Humanizer then rewrites in his trained voice.
- **AI Edge** (the channel/creator) — publishes the video and operates a free "school" (community platform, unnamed specifically — likely Skool given "school community" phrasing) where a combined setup file for all five repos is distributed under a resources library.
- **Claude Code, Codex, Gemini** — named coding-agent platforms; Claude Mem is claimed to be interoperable with several of these (transcript names one or two additional tools ambiguously, transcribed as "OpenClaw" and "Hermes" — likely mistranscriptions of actual product names, not confidently resolvable from the transcript).
- **Chord** — an unnamed/upcoming model referenced only as competitive context near the end ("there's a new Chord model launching very soon"); no further detail given.

## Examples & use cases

- Claude Mem: cross-session recall of fictional personal facts (favourite colour, first car, pet's name, an anecdote about a friend) demonstrated across a brand-new terminal session in an unrelated folder.
- I Have ADHD: (1) a CRM tool-choice decision (Notion vs Google Sheets) answered in ranked-bullet form with a "next" step; (2) a website-bug triage answered as ordered steps ending in a concrete next action.
- Humanizer: rewriting a "founder audience" tweet about AI usage from AI-cadence prose (heavy contrast/triad phrasing) into a more natural, punchier close.
- Caveman: explaining the Claude Code skill/MCP/plugin distinction in compressed vs normal verbosity, with an explicit token count comparison (409 vs ~600 tokens, ~31% saved in this instance).
- Karpathy file: no live demo shown — installation and content were walked through (folder drop, or paste into Project instructions) but no before/after coding example was demonstrated on-screen.

## Claims & confidence

- Claude Mem has 94,000 GitHub stars and 162+ contributors. [claim, low-medium confidence — unverified creator assertion, plausible given the demoed functionality but no on-screen proof of the star count itself]
- Claude Mem stores compressed AI-generated summaries rather than full transcripts, by design, to avoid context bloat. [claim, medium-high confidence — consistent with the demonstrated behaviour and stated architecture, though not independently verified against the actual source code]
- "I Have ADHD" skill contains 10 specific rules, of which 4 were enumerated on-screen. [fact as shown on screen, high confidence for what was visible; the remaining 6 rules are unconfirmed/unseen — source gap]
- Humanizer corrects 25 named AI writing patterns and has ~20 GitHub contributors. [claim, low-medium confidence — stated by creator, matches an on-screen GitHub view he references but not fully read out]
- Caveman can save "up to 65%" (per video title/intro) or "up to 60%" (per mid-video restatement) of tokens, with 100,000+ GitHub stars. [claim/opinion mix — the star count is a factual claim of unverified accuracy; the 60-65% ceiling is an aspirational/marketing-style upper bound, not what the live demo achieved (~31% was demonstrated)]
- Karpathy's file has 214,500 GitHub stars and is authored by/attributed to Andrej Karpathy, a founding OpenAI member later at Anthropic. [claim, medium confidence on Karpathy's career background (broadly consistent with public knowledge of Karpathy), low-medium confidence on the exact star count and on whether the specific repo shown is verifiably his personal/official repo — the video does not show a GitHub profile/verification step]
- Newer/larger models are more prone to verbose, hedging, non-committal output ("yes-man" behaviour, over-complication, unnecessary abstraction). [opinion, presented as consensus/experience-based, not measured or benchmarked in the video]
- The combination "Caveman (light) + I Have ADHD" is what "a lot of people have found" works best. [opinion/claim, unsourced — no data or citation given for who found this or how]

## Caveats & source gaps

- **No verification of GitHub star/contributor counts**: all adoption figures (94K/162, ~20, 100K/107.2K, 214.5K) are stated verbally by the creator while presumably showing a screen; the transcript alone cannot confirm accuracy, currency, or that the repos shown are the canonical/official ones (especially for the Karpathy-attributed file, where impersonation or unofficial forks are a realistic risk on GitHub).
- **Repo names are potentially imprecise or mistranscribed**: "Claude Mem," "I Have ADHD," "Humanizer," "Caveman" are used as spoken/informal names; exact GitHub repository paths/owners were never stated in the transcript. Additional agent-tool names Claude Mem allegedly supports beyond Claude/Codex/Gemini were unclear in the transcript ("OpenClaw," "Hermes") and should not be trusted as exact product names without checking the source repo directly.
- **The "65%" headline claim is not the same as the demonstrated result**: the on-screen worked example for Caveman showed a ~31% token reduction on one specific short-answer prompt; the higher 60-65% figures are stated as ceilings/marketing framing tied to larger inputs (e.g., "massive files"), not shown live.
- **The 10 rules of "I Have ADHD" are only partially enumerated** (4 of 10 shown); the other 6 are a source gap.
- **No independent confirmation that Andrej Karpathy personally authored or endorsed the specific GitHub file shown** — the video treats this as established fact via narration only; this is exactly the kind of attribution claim that should be checked before being repeated as fact.
- **No quantitative benchmark or controlled comparison** is given for the "models get dumber after release" framing, the general claim that Claude/GPT writing is detectable as AI, or the claimed superiority of Codex for "deep agentic coding" — these are the creator's stated opinions/experience, not measured claims.
- **The creator has a commercial interest** (his free "school" community, where the combined setup file is distributed) — this is a disclosed but relevant bias to note when weighing his enthusiasm/recommendations.

## What this means for Fusion247

*(Cairn's interpretation — not sourced from the video.)*

- **Direct overlap with existing myPKA constitutional concerns.** The Karpathy four-principle file (think before coding, simplicity first, surgical changes, goal-driven execution) maps closely onto standing Fusion247 operating rules already in `CLAUDE.md` — e.g. "don't add features/abstractions beyond what's asked," "surgical, reversible changes," and the regrowth cap against over-engineering. Worth comparing the actual Karpathy repo text (once verified) against `CLAUDE.md`'s existing discipline clauses — it may either reinforce them with independent authority or reveal a gap worth folding in as a supplementary per-session context note, not a constitutional change (per the hard rule against silent constitutional self-modification).
- **Claude Mem is directly relevant to the memory system Larry already runs.** Fusion247/myPKA already has a bespoke persistent-memory architecture (Honcho, Wayfinder maps, the `memory/` directory this very session reads from). Claude Mem is a third-party, generic version of the same problem (cross-session context loss) but with an important architectural difference the video itself flags: it's AI-guessed compression, not human-curated. This is worth a Pax research pass before any adoption — not to replace the Wayfinder/Honcho system, but to check whether it's a useful *supplement* for ad-hoc/non-Wayfinder-governed coding sessions, or whether it risks contaminating the "nothing may live only in Larry's head" discipline with an opaque, auto-summarized memory store outside Git.
- **"I Have ADHD" and Caveman address a real, named pain point in this constitution**: Larry's own operating rules repeatedly emphasize terse, non-narrative output ("brief is good, silent is not," "don't narrate deliberation," proportionality). These two tools are essentially productized versions of that same discipline for raw Claude Code sessions. Not clearly needed given `CLAUDE.md` and the system prompt already impose this behaviourally, but the *token-cost* angle (Caveman) could matter if Fusion247 runs cost-sensitive unattended/background agent workloads (e.g. AsdAIr, CareerAIR pipelines) — worth a cost/benefit look if token spend on those runtimes is ever a constraint.
- **Humanizer is the one with clearest applied use for Warwick's own workflows** — CareerAIR application writing and any Warwick-voiced external communication already have a standing rule ("Warwick's written voice: measured British, not cocky... no em dashes"). A Humanizer-style trainable skill, if adopted, would need to be trained specifically on Warwick's actual voice/examples (per the memory on his voice) rather than the creator's own generic "founder Twitter" tone — the video's own method (feed it real writing samples, iterate) is directly reusable here.
- **Adoption should go through the existing gates, not bypass them**: any of these being installed as skills/plugins into the Fusion247 Claude Code environment would touch `.claude/` and potentially execute third-party code/prompts — this triggers Vex's security review remit (external code/skill installation) and Nolan's specialist/tooling-fit judgement, not a unilateral Larry install. This note is intake/classification only; no adoption action is implied or recommended without that review path.

## Key concepts & takeaways

- Five free, community-maintained Claude Code add-ons, each solving a distinct "bad habit": lost cross-session memory (Claude Mem), buried/verbose answers (I Have ADHD), AI-sounding writing (Humanizer), token/cost bloat (Caveman), and undisciplined engineering judgement (Karpathy's four-principle file).
- Three of the five are togglable *skills* (ADHD, Humanizer, Caveman); one is a passive background plugin (Claude Mem); one is a static always-on context file (Karpathy).
- The two output-shaping tools (ADHD vs Caveman) are complementary, not redundant: one fixes *structure*, the other fixes *volume*.
- Adoption-scale claims (star counts) are used throughout as a stand-in for credibility/validation, but none are independently verified in this note.
- The clearest counterintuitive point: Claude's chat product already does cross-session memory reasonably well; its coding/terminal sessions historically do not — a gap most users may not consciously notice until directly contrasted.

## Actions & open questions

- Verify (Pax) the actual GitHub repositories behind each of the five tools — canonical owner/org, real star counts, license, and last-updated date — before considering any adoption, especially confirming the Karpathy attribution on the fifth file.
- If Wayfinder/Honcho memory architecture is ever felt to be insufficient for ad-hoc (non-Wayfinder-governed) coding sessions, evaluate Claude Mem specifically against that gap — but this is not an established need, just a possible future comparison point.
- Consider whether the Karpathy four-principle file's exact wording (once the real repo is confirmed) adds anything not already covered by `CLAUDE.md`'s existing engineering-discipline clauses; if so, that's a candidate for a proposed (not silent) redline via the existing constitutional-change process.
- No action implied on Caveman/token-cost tooling unless/until token spend on a specific Fusion247 unattended runtime is identified as a real constraint.
- Humanizer's trainable-voice method is the one piece with a concrete, low-risk experiment: could be tested against Warwick's own past writing samples for CareerAIR outputs, subject to normal specialist/security review before any install.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/5hzkJ2nDbgw/` — `tubeair-report.md` (sha256 `02f36d285567…`), `manifest.json` (sha256 `6c4eb6fbdde8…`). Preserved as captured; never edited or summarised.
