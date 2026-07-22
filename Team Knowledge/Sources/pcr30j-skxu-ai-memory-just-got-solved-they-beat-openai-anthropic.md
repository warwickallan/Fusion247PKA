---
source_id: pcR30j-sKxU
type: source-knowledge-note
source_type: youtube_transcript
title: AI memory just got solved (they beat OpenAI & Anthropic)
source_url: "https://www.youtube.com/watch?v=pcR30j-sKxU"
video_id: pcR30j-sKxU
channel: Igor Kudryk
published: 2026-03-21
transcript_source: auto_captions
captured_at: "2026-07-22T01:57:32+00:00"
capture_id: d8544749-0fb9-5849-902f-e92bde7935c9
review_state: ai_created
build: BUILD-002
authored_by: larry-in-session
raw_evidence:
  - Sources/_raw/pcR30j-sKxU/tubeair-report.md
  - Sources/_raw/pcR30j-sKxU/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

> **Review state: `ai_created` · pending Warwick/Cairn review.** Source-derived note authored by Larry (in-session semantic step) from the captured transcript. Nothing here updates any SOP, skill, agent instruction or register. Claims are the source's unless marked **[F247]** (Fusion247 interpretation). RAW transcript preserved separately and linked below.

## Executive orientation

**Honcho** is an open-source **agentic-memory** system: it sits alongside your AI agents (Claude Code, Codex, "Open Claude", Hermes), silently observes every message in and out, and runs a **reasoning layer** that decides what is worth remembering — then serves that memory back into whichever agent you switch to. The single most important idea: memory is not a dumb message store; it is an *actively reasoned, self-cleaning model of you* that is **portable across agents**. For Fusion247 this is directly on-thesis — it is a different architectural answer to the same problem MyPKA/Larry's persistent memory exists to solve, and its patterns (reasoned persistence, "peer" identity, a periodic self-cleaning pass) are worth studying. Treat the video's "beaten OpenAI/Anthropic/Google" framing as promotional; the substance is the architecture, not the leaderboard.

## What Honcho is (substantive reconstruction)

**The problem it targets.** Agents "wake up blank" each session — no memory of prior work. Context windows are large (~1M tokens on the most capable models) but finite, and people constantly **switch between agents** (Claude Code → Codex → Hermes …), re-explaining who they are and what they're doing every time.

**The core approach — observe + reason, don't just store.** Prior systems (the video cites "Open Claude") persist raw messages into a database (Postgres/SQLite). Honcho instead **connects to everything you do and observes all messages** (yours and the agent's), then applies a **reasoning layer on top** that judges what actually needs saving (a one-off "remind me to buy cake" is not long-term project memory; a standing preference is).

**Mechanism.** A message triggers a **queue**; roughly every ~1,000 tokens Honcho re-awakens its homegrown reasoning model — called **"Neuromancer"** (described as a **fine-tuned Qwen-3**) — which walks the queue deciding *important / not important*, fetching a little more context where needed, and writing the keepers into a persistent store (Postgres). All of this happens in the cloud without changing your workflow; you just work, and memory accretes.

**Diachronic identity + "peer cards".** The load-bearing concept: just as a person presents different facets to a spouse, a manager, or an agent, Honcho builds a **peer card** for each *peer* (a peer can be a person **or** an agent) and, over time, a **graphical profile** derived purely from conversations — e.g. in the demo it inferred the presenter's name variants (Igor/Ihor), that he's from Ukraine, based in Munich, and a working preference ("tasks completed, tested, and working before interruption") that arose because his agent kept asking to run tests and he told it testing is part of "done." It also stores **representations of peers inside other peers' minds** (Alice's model of Bob, Bob's model of Alice) — mirroring how different people hold different mental pictures of the same person.

**Automatic "dreaming" — self-cleaning + self-modifying.** After a threshold (≈50 turns or ≈8 hours, configurable), Honcho runs an autonomous pass in two modes: (1) **deduction** — derive/резolve facts and **contradictions**, updating the profile (its example: inferring from later conversation that a course you'd been building is now *finished*, so it stops treating it as ongoing — a self-cleaning behaviour the presenter claims the big labs don't do); (2) **generalisation** — form personality traits/patterns from multiple sources. The result: memory that maintains itself rather than needing manual updates.

**Portability + self-hosting.** Because the memory lives in Honcho (not inside one agent), you **carry your persona between agents**. It is **open source and self-hostable**; the reasoning model "Neuromancer" is described as *not* open-weight, but the surrounding framework is, which the presenter treats as essential given the privacy exposure.

**Benchmarks.** Honcho is called out as (unusually) **publishing memory-benchmark results**. The video discusses the **BEAM** benchmark (spans coding, math, health, finance — not just "personal yapping"; context variants from 100k up to 10M tokens) and cites roughly **~0.6 at 1M** and **~0.4 at 10M**. Heavy caveats (from the presenter himself): memory benchmarks are **gameable** (burn compute), the **underlying LLM dominates the score**, and the scoring is **non-deterministic** (~90% vs ~91% across identical runs) — "don't take them too seriously."

## Tools, people, products mentioned

- **Honcho** — the subject; open source; ~$100 free credit at time of recording; self-hostable.
- **"Neuromancer"** — Honcho's homegrown reasoning model; described as a fine-tuned **Qwen-3**; not open-weight.
- **BEAM** — the harder memory benchmark used (coding/math/health/finance; 100k→10M context).
- Adjacent memory tools name-checked: **Mem0 / "Mem-zero"**.
- Agents referenced: **Claude Code, Codex, "Open Claude", Hermes** (the presenter is migrating toward Hermes).
- **Igor / Ihor Kudryk** — presenter (channel "Igor Kudryk"); from Ukraine, based in Munich; promotes a free 60-minute "build your own agent" course (promotional; not evidence).

## Claims requiring verification (kept separate from fact)

- **"Beaten OpenAI, Anthropic and Google at agentic memory."** Hype framing — and internally undercut by the presenter's own point that 1M-context models "don't need a memory system" for many tasks. Unverified; no independent benchmark shown beyond Honcho's own postings.
- **"Neuromancer = fine-tuned Qwen-3."** Single-source, auto-caption; verify against Honcho's docs.
- **Benchmark scores (~0.6@1M, ~0.4@10M)** — self-published, on an admittedly noisy metric.
- **Auto-caption transcription risk:** model/benchmark/product names ("Neuromancer", "BEAM", "Mem0", "Open Claude") may be mis-transcribed; confirm spellings before quoting.

## Fusion247 relevance **[F247 interpretation — not the source]**

- **On-thesis for MyPKA.** MyPKA/Larry already run a **file-based persistent memory**; Honcho is a different answer to the *same* problem (agents forgetting, re-explaining across sessions/tools). Worth studying as a design foil, not a dependency.
- **Patterns worth examining** (not adopting yet): (a) a **reasoning layer that decides what to persist** rather than saving everything; (b) a periodic **self-cleaning "dreaming" pass** that reconciles contradictions in stored memory — Larry's memory files could benefit from a deliberate reconcile/prune pass; (c) **diachronic identity / peer cards** as a way to model different contexts.
- **Aligns with standing doctrine.** The presenter's strong **self-hosted, open-source, don't-send-everything-to-the-labs** stance maps onto Fusion247's personal-data doctrine (public repo vs private stores) and the "self-host on own hardware" instinct.
- **Cautions:** promotional source (course upsell), single narrator, unverified benchmarks, cloud-privacy exposure by design. Nothing here justifies changing MyPKA's memory design — it justifies a *scoped evaluation*.

## Proposed learning candidates (for your Accept/Decline in Directus)

1. **Evaluate a periodic "reconcile/self-clean" pass over Larry's memory files** (inspired by Honcho's dreaming) — resolve stale/contradictory notes deliberately. _Why:_ our memory grows append-only; staleness is a known risk. _Confidence:_ medium · _Risk:_ low (design spike only).
2. **Scoped assessment: Honcho (self-hosted) as an optional memory layer for MyPKA agents.** _Why:_ directly adjacent to our thesis. _Confidence:_ low · _Risk:_ medium (new dependency, privacy surface) — evaluation only.
3. **Verify the factual claims** (Neuromancer=Qwen3; benchmark numbers) against Honcho's own docs before any of the above is trusted. _Confidence:_ n/a · _Risk:_ low.

_All three are recommendations only — no change is made until you Accept._

## Source gaps & honesty

- Transcript is **auto-generated captions** (952 segments) — expect transcription noise, especially proper nouns.
- Single promotional narrator; no independent corroboration captured.
- The immutable **RAW transcript** (source evidence) is preserved and linked below; this note is a reconstruction, not a copy.

## Related

- [[ai-native-dev-model-vision]] — Fusion247's AI-native, memory-persistent operating-model thesis.
- [[build-014-control-plane-runtime]] — where governed knowledge + control state live for MyPKA.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/pcR30j-sKxU/` — `tubeair-report.md` (sha256 `24fea2b0cf15…`), `manifest.json` (sha256 `1ccf7a12323c…`). Preserved as captured; never edited or summarised.
