---
source_id: UtFo1ZNC2ns
type: source-knowledge-note
source_type: youtube_transcript
title: I'm Obsessed With Local AI. Here's Why
source_url: "https://www.youtube.com/watch?v=UtFo1ZNC2ns"
video_id: UtFo1ZNC2ns
channel: Greg Isenberg
published: 2026-09-08
transcript_source: auto_captions
captured_at: "2026-09-24T00:04:31+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/UtFo1ZNC2ns/tubeair-report.md
  - Sources/_raw/UtFo1ZNC2ns/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is a solo-host "masterclass" episode by Greg Isenberg (sponsored by Google) arguing that local AI (models running on hardware you control, e.g. Gemma via LM Studio/Ollama/Google AI Edge) is an under-mapped, ~24-month business opportunity for non-technical founders — not just a developer niche. It matters because it reframes local AI from a technical benchmark question ("is this model smarter?") into a product/business question ("is it good enough, and does running it locally make the product better?"), and because it hands over a concrete vocabulary, a hardware/software setup path, and three specific startup ideas built around private, repeated, on-device workflows.

## What the source says

### Thesis: local AI is a founder opportunity, not just a dev tool [00:00–01:28]
Isenberg opens by claiming local AI and open models will create "a ridiculous number of business opportunities" in the next 24 months, and that most people don't have the map yet. His diagnosis of the gap: founders have used ChatGPT/Claude but hear terms like Hugging Face, Ollama, LM Studio, AI Edge and assume it's developer-only territory. He frames the whole episode as a map: what local AI is, when it matters, how to run open models, where Hugging Face fits, which Gemma model to start with, how to run a model locally, and how to turn this into three concrete startup ideas (customer, first version, why local matters, how to sell it).

### Local vs. cloud: the core business question [01:28–03:29]
- **Definitions:** Local AI = model runs on hardware you control (MacBook, Windows laptop, Android/iPhone, browser, Raspberry Pi, workstation, even a DGX Spark). Cloud AI = model runs elsewhere, accessed via website/API.
- **The reframed question:** Not "is this model smarter than the biggest cloud model?" but "is this model good enough for the job, and does running it locally make the product better?" This reframing is the hinge that unlocks the business ideas that follow.
- **When cloud wins:** deep research, strategy, hard reasoning — use the strongest frontier cloud model.
- **When local wins:** private/sensitive data, offline use, field work, low latency, audio input, or a workflow that repeats constantly.

### The four-piece local AI landscape [02:40–06:48]
Isenberg's organizing framework, presented as the four real pieces of the space:
1. **The model** (the "brain file") — e.g. Gemma, Llama, Mistral, Qwen, Phi.
2. **The warehouse** — where you find models, chiefly **Hugging Face** (he notes it's reportedly in talks to be acquired around **$13 billion** — flagged as claim/rumor, not sourced further).
3. **The software** — what runs the model locally, chiefly **LM Studio** or **Ollama**.
4. **The workflow** — the actual product/business built around the above three.

Underneath the software layer: **llama.cpp** (powers a lot of local inference), **MLX** (matters specifically on Apple silicon), and for shipping real on-device apps in Google's ecosystem, **Google AI Edge** (the broader on-device dev ecosystem) and **LiteRT-LM** (the runtime layer for language models specifically — described as the layer for moving from "I ran a model on my laptop" to "this model is inside an iOS/Android/web/desktop app").

### Core vocabulary, explained for beginners [06:48–10:29]
- **Parameters** — internal weights of the model (e.g. 2B, 4B). More parameters = more capacity for harder tasks, but more memory required. Rough tiers Isenberg gives: 2–4B for edge devices/phones/fast workflows; 12B as a middle ground; 26–31B as "stronger workstation territory." He explicitly advises against spending $5–20k on a workstation right away.
- **Tokens** — chunks of text the model reads/writes; locally, the concern shifts from per-token billing to speed/memory.
- **Context window** — how much information the model can work with at once.
- **Quantization** — compression that lets giant models fit on normal laptops, at some quality cost. **Q4** = easier to run, lower quality; **Q8** = more quality, more memory needed. Beginner recommendation: start with Q4.
- **GGUF** — a common local model file format that eases inference on normal machines.
- **LiteRT-LM** — the model format/runtime path for on-device apps in the Google ecosystem.

### The simplified map (his own summary) [10:01–10:29]
Hugging Face = find/understand models → Gemma = Google's open model family → LM Studio = try models locally with least friction → Ollama = run models locally in a way that plugs into apps (more builder-oriented) → GGUF = common local format → Google AI Edge/LiteRT-LM = path to shipping on-device products.

### Google's Gemma family in detail [10:29–13:26]
- **Gemma 4** is built for efficient, local, on-device use, with a size ladder: **E2B** (smaller edge model, phone workflows) → **E4B** (called "the most practical starting point for most local tasks") → **12B** (middle ground, more capable, laptop-suited) → **26B/31B** (stronger local workstation territory).
- **Specialized Gemma variants:** **EmbeddingGemma** (turns text into embeddings for meaning-based search — docs, customer notes, support tickets, sales calls, knowledge bases); **FunctionGemma** (tool use / structured function calling — lets the model help software take actions, described as part of the path from "the model gave me an answer" to "the model helps the product take the next step"); **PaliGemma** (vision-focused); **ShieldGemma** (safety-focused); **Gemma Scope** (interpretability — understanding how models work under the hood).
- **Beginner path:** start with Gemma E4B, understand the workflow, then move up/down/sideways as needed — no need to learn the whole family on day one.
- **Whole Google ecosystem map:** Gemma (open model family) + Google AI Edge (on-device dev ecosystem) + LiteRT-LM (cross-device runtime) + AI Edge Gallery (lets you try on-device models directly) + Gemini/Google Cloud (for scale/frontier reasoning when needed).

### Hybrid architecture as the likely real-world pattern [13:26–14:20]
Isenberg argues serious products will mostly be **hybrid**, not all-local or all-cloud. His worked example: a professional-services tool where a **local model reads sensitive drafts first**, strips/summarizes private details, and prepares a sanitized version; **then a cloud model does deeper reasoning on the sanitized version**; a human approves before anything goes out. He states this feels more natural to him than sending everything to the cloud, which many users resist.

### Survey of other open model families — pros, cons, and the "China thing" reversal [14:20–17:52]
This is a materially distinct, non-technical thread (procurement/geopolitics/brand trust), not just a technical model comparison:
- **Llama (Meta)** — the "default" open reference point due to ecosystem size (community, tooling, examples, support). Caveat: read the license/model card carefully for commercial use.
- **Qwen (Alibaba)** — strong at coding, multilingual, long context, agentic tasks. **Explicit reversal/counterintuitive point:** despite being a Chinese-origin model, "a lot of people use Qwen because it performs really well" — but he flags that enterprises/government/healthcare/finance/sensitive-data users must consciously separate "running open weights locally" from "sending data to a hosted service" and check their own comfort/compliance stance. This is presented as a live, unresolved tension rather than a solved problem.
- **DeepSeek** — cited as the model that made people realize how strong Chinese open models can be, especially reasoning/coding, with strong cost-performance. Same caveat: procurement, security, or geopolitical concerns for some buyers.
- **GLM / Z.ai** — recurring presence on Hugging Face/Ollama/"local model Twitter." His point: don't dismiss non-brand-name models — some are excellent for specific jobs; what you test isn't necessarily what you deploy for business.
- **Mistral (France/Europe)** — efficient, builder-friendly, frequent releases; caveat that the lineup mixes open and commercial models, creating licensing ambiguity.
- **Phi (Microsoft)** — interesting for smaller/faster/lower-latency use cases, but he personally hasn't seen it perform well for "a lot of use cases" (his opinion, not elaborated).
- **Overall takeaway:** new models appear constantly; Hugging Face's value is precisely in surfacing niche/specialist/community-fine-tuned/quantized versions. The founder's job is to pick a model family that fits the workflow and that you're comfortable with as a company, then commit and iterate.

### Practical setup instructions — three paths [18:17–21:52]
1. **LM Studio path:** download (free) → search "Gemma 4" → pick E4B if hardware is solid, E2B if slower/older → prefer the quantized GGUF version → open a chat → test with a real business prompt (his example: turn pasted customer notes into a one-page memo on what's broken and what to fix this week) → this is meant to produce an "aha moment" that the model runs fully on-device with nothing sent to the cloud → then open LM Studio's developer section and start a **local server** so other apps/scripts can call the model via localhost, turning your laptop into "a little AI server."
2. **Ollama path:** `ollama pull gemma4` → `ollama run gemma4:e4b` → gives a running model plus a local API (he cites port **11434**) that other apps/scripts can call. Larger variants (12B/26B/31B) available if hardware supports it.
3. **Google AI Edge / LiteRT-LM path:** for when you want to ship an actual app with an embedded model — mobile app with on-phone model, browser app running the model locally, desktop app with a private workflow, or an edge device. This is "the path from local AI as a demo to local AI as a product."

### Hardware cheat sheet [21:52–22:16]
- 8GB RAM → start small, keep tests simple.
- 16GB RAM → useful experiments with E4B and smaller quantized models.
- 30–32GB RAM → room for larger local workflows.
- Strong GPU/workstation (e.g. DGX Spark) → bigger models become realistic.
- Phones → think less about model size, more about the job (photo understanding, audio summarization, quick classification, field work support, offline capability, proactive in-app usefulness).

### Worked example workflow: "customer notes" folder exercise [22:16–24:32]
Concrete walkthrough: create a desktop folder with ~10 support tickets for a sample business (home health agency, med spa, or water damage restoration company), with example complaint text ("couldn't find the reschedule link," "no one confirmed my appointment," "charged twice"). Run a local model to produce a markdown file "What customers are telling us.md" containing: repeated complaints, exact customer language, likely root cause, which part of the business seems broken, and the single highest-priority thing to test this week. His point: this pattern — private/messy data + local model + reusable memo output — generalizes broadly (support tickets → product roadmap signal; PDFs → risk checklist; drafts → pre-send reviewer).

### Counterintuitive reversal: don't start by fine-tuning [24:32–25:07]
**Stated assumption:** people who discover open models want to immediately fine-tune/train their own model, because it "sounds really cool" — he admits he felt the same pull himself. **Stated reversal:** this is an advanced move and the wrong starting point. The practical/beginner move is to find one repeated workflow first, run it ~10 times on one folder/one model/one output, observe where it fails, refine the prompt, add examples/checklists, and build a small eval — only then consider anything more advanced. This is presented explicitly as correcting a natural but wrong instinct.

### Evals and the local/cloud decision framework [25:07–26:17]
An eval = a small test of whether the model did the job well enough. Example eval: run the same 10 customer notes through a local model (Gemma) and through a strong frontier cloud model, then compare — did it catch the same complaints, pull the right quotes, follow the format? This comparison is presented as the actual mechanism for learning where local is "already useful" versus where cloud is still needed, and for calibrating the hybrid model. Final heuristic: local for private/repetitive/fast/offline/device-native/high-volume workflows; cloud for deep reasoning/giant context/broad research where model strength changes answer quality; both when sensitive data + hard reasoning combine (local first pass → cloud escalation → human approval).

### Three startup ideas [26:17–34:40]
Presented as concrete, stealable business ideas, each with customer, sensitivity/risk driver, first product version, and go-to-market wedge. Filter criteria given up front: customer has sensitive data, repeated review work, historically bad software, expensive mistakes, and a workflow that happens close to the device.

**Idea 1 — Local QA reviewer for home health agencies [26:17–29:14]**
- Problem: nurses/caregivers write visit notes, update care plans, handle billing/compliance paperwork; a missing detail causes billing delay, a vague note causes extra admin work, a mismatch between visit and care plan creates compliance risk.
- Product: local desktop app where the agency drops in visit notes, care plans, and dictated transcripts; the model reviews before submission and flags issues — e.g., "note mentions dizziness but vitals are missing," "medication change mentioned but follow-up instructions unclear," "note may not support the billed service level."
- Buyer motivation: fewer documentation problems before billing/audit/supervisor review.
- Go-to-market: start as a manual service — find 5 small home health agencies, review a batch of notes with AI assistance plus personal manual inspection, log the ~20 recurring issues, turn that list into a checklist, and the checklist becomes the product.

**Idea 2 — Offline field report co-pilot for restoration contractors [29:14–32:12]**
- Problem: water/fire/mold damage teams take photos, record notes, and produce reports for homeowners and insurance adjusters; work happens away from a desk, and the report is the handoff between technician, customer, office, and insurer. Isenberg notes he personally experienced water damage and observed the industry's software is "antiquated," dating to "the early 2000s" — a first-hand, if anecdotal, market observation.
- Product: mobile app where a technician walks the property, takes photos and voice notes, and the app drafts the report on-site, flagging gaps in real time — e.g., "mentioned the basement but no basement photos," "ceiling damage photo but no moisture meter reading," or simplifying overly technical homeowner explanations. He calls clear communication in a stressful situation "part of the product," and flags this as underrated.
- Go-to-market: pick one niche first (e.g., water damage only), talk to owner-operators, study their existing report templates/software, build around the checklist already in their heads; demo hook: "send me three old jobs and I'll show you how fast your techs could create reports." Expansion path from there: QA, estimates, insurance packets, customer updates, training new technicians.

**Idea 3 — Local pre-send reviewer for professional services ("Schmuck insurance") [32:12–34:15]**
- Problem: nearly every professional services firm has an informal "someone checks this before it goes out" workflow for client emails, proposals, memos, contract summaries, investment notes, HR notes — law firms, accounting firms, wealth advisors, recruiters, consultants.
- Product: local desktop app reviewing outbound drafts before they leave the company, with vertical-specific flags — wealth advisor: language implying a guaranteed return (compliance red flag); law firm: overly definitive sentences; HR: sensitive employee info that shouldn't be in the thread; agency: promises the scope doesn't support; accountant: numbers that don't match the attached file.
- Framing/name: "a second set of eyes for sensitive work" — jokingly proposes the name "Schmuck Insurance" (schmuckinsurance.com, unverified availability).
- Go-to-market: pick one vertical and one document type first (his example: email review for independent wealth advisors, not big banks); interview ~10 advisors about which emails make them nervous, collect anonymized examples, turn concerns into a checklist, build the tool against that checklist. Sellability logic: buyers already do this review manually, so the product is simply a faster, more private first pass.

### Personal-productivity framing (separate from the startup-idea thread) [34:15–36:33]
Even without building a startup, Isenberg argues everyone should personally learn local AI because it changes how you work with your own files. Suggested exercise: create a "local AI lab" folder with ~10 personally relevant files (sales calls, meeting transcripts, old tweets, ideas), run a local model to produce a reusable artifact — a weekly business pulse, a summary of what's changed in customer conversations, feature requests grouped by underlying pain, or draft review feedback. His stated principle: "a chat answer is nice, but a useful artifact changes the workflow" — read → write → inspect → improve → repeat.

### Closing synthesis [36:33–38:28]
Reiterates that some AI belongs in the cloud, some on-device, and the strongest products of the next few years will combine both. His own recommended starting sequence: run Gemma locally, read Hugging Face model cards, learn LM Studio vs. Ollama, try Google AI Edge, then look for one "boring workflow" where local AI genuinely improves the product — triggered by private data, offline need, camera/audio context, low latency, high repeated API cost, a buyer who prefers the model stay close to them, or a workflow suited to a small agent team that rechecks/summarizes/prepares work daily. Closing framing: stop treating local AI as "a model benchmark conversation" and start treating it as "a product conversation" — ask where the work happens, where the data lives, where the device is, where the trust issue is, where there's an annoying review loop. States he personally went "deeper and deeper" into this over the last ~2 months and is "grateful for it." Ends with a call to share the episode and a note that he reads/responds to YouTube comments.

## Mechanisms, methods & implementation detail
- **LM Studio setup:** download app (free) → search "Gemma 4" → choose size by hardware (E4B if solid machine, E2B if weaker) → prefer quantized GGUF version → chat-test with a real business prompt → open Developer section → start local server so other apps can call the model via localhost.
- **Ollama setup:** `ollama pull gemma4` → `ollama run gemma4:e4b` → local API exposed (port cited as 11434) for scripts/apps to call; can scale up to 12B/26B/31B if hardware allows.
- **Google AI Edge / LiteRT-LM path:** used specifically when embedding a model inside a shipped app (mobile/web/desktop/edge), not for casual experimentation.
- **Model-card literacy exercise:** open a Hugging Face model card and slowly answer: What is it for? How big? What license? What hardware do people run it on? Does it support text/image/audio/tool-use/embeddings? Are quantized files available?
- **Folder-based local workflow pattern (used in multiple ideas):** (1) collect a folder of private/repetitive source material (notes, tickets, transcripts, drafts); (2) run a local model with a specific output-shaped prompt; (3) inspect the output manually; (4) refine the prompt/add examples/build a checklist; (5) repeat ~10 times to convert intuition into a small eval; (6) only then consider anything more advanced (e.g., fine-tuning).
- **Eval construction method:** run the same input set through the local model and a frontier cloud model, compare outputs on accuracy/completeness/format-adherence, and use the gap to decide the local/cloud split for a given workflow.
- **Startup validation method (common to all three ideas):** start as a manual/service-based engagement with a small number of real customers (5 agencies / niche contractors / 10 advisors), use AI-assisted but human-inspected review to surface the recurring 15–20 issues, convert that list into a checklist, and only then productize the checklist into software.

## Tools, people, products & organisations
- **Greg Isenberg** — host/creator of the episode; self-described as having gone deep into local AI over the prior ~2 months; personally experienced water damage restoration industry software firsthand.
- **Google** — episode sponsor; source frames itself as caring about "local AI and open models for entrepreneurs."
- **Gemma** — Google's open model family, tuned for efficient/local/on-device use; variants E2B, E4B, 12B, 26B/31B, plus specialized EmbeddingGemma, FunctionGemma, PaliGemma, ShieldGemma, Gemma Scope.
- **Google AI Edge** — Google's broader on-device AI development ecosystem.
- **LiteRT-LM** — the runtime layer for running language models on-device across Android/iOS/web/desktop/edge.
- **AI Edge Gallery** — lets users try on-device models directly to see the experience.
- **Gemini / Google Cloud** — Google's frontier/cloud-scale offering, used for the "cloud half" of hybrid architectures.
- **Hugging Face** — described as the primary "model warehouse" for finding models, model cards, licenses, benchmarks, community/quantized versions; claimed (per Isenberg, unverified in the note) to be in acquisition talks around $13B.
- **LM Studio** — desktop app for running local models with minimal technical friction; includes chat UI and a local server/developer mode.
- **Ollama** — command-line-oriented tool for running local models, exposing a local API for integration into apps/scripts.
- **llama.cpp** — underlying inference engine powering much local model execution.
- **MLX** — Apple-silicon-specific framework relevant to running models locally on Macs.
- **Llama (Meta)**, **Qwen (Alibaba)**, **DeepSeek**, **GLM/Z.ai**, **Mistral**, **Phi (Microsoft)** — other open model families, each with described strengths/weaknesses (see "What the source says" above).
- **GGUF** — common local model file format for easier inference on normal machines.
- **DGX Spark** — high-end workstation-class hardware Isenberg personally owns, used as the top of his hardware tier example.

## Examples & use cases
- Customer-notes folder exercise turning 10 support tickets into a "What customers are telling us.md" memo (repeated complaints, root cause, priority fix).
- Hybrid architecture example: professional-services tool doing local sanitization of sensitive drafts before cloud-based deeper reasoning, with human approval before send.
- Home health agency documentation QA flags (missing vitals, unclear follow-up instructions, billing/service-level mismatch).
- Restoration contractor field-report co-pilot flags (missing basement photos, missing moisture readings, overly technical homeowner language).
- Professional-services pre-send reviewer flags (guaranteed-return language for wealth advisors, overly definitive legal language, sensitive HR info, unsupported scope promises, mismatched financial figures).
- Personal "local AI lab" folder exercise (sales calls, meeting transcripts, tweets, ideas → weekly business pulse or grouped feature requests).

## Claims & confidence
- Local AI/open models will create major new business opportunities in the next ~24 months. [opinion, medium confidence — stated as personal conviction, no external data cited]
- Hugging Face is reportedly being acquired around $13 billion. [claim, low confidence — presented casually by the host with no source cited]
- "Is this model good enough for the job / does local make the product better?" is the more useful framing than "is it smarter than the biggest cloud model?" [opinion, medium-high confidence — presented as the episode's central reframing, argued but not independently verified]
- Gemma 4 E4B is "the most practical starting point for most local tasks." [opinion, medium confidence — host recommendation, not benchmarked in the transcript]
- Q4 quantization is easier to run; Q8 preserves more quality but needs more memory. [fact, high confidence — standard, well-established technical characterization of quantization]
- Ollama's local API defaults to port 11434. [fact, high confidence — matches Ollama's known default, stated directly and specifically]
- Qwen and DeepSeek perform strongly (coding/reasoning) despite being Chinese-origin models, counter to assumptions some buyers may hold. [opinion/claim, medium confidence — the performance claim is presented as consensus among users but not benchmarked; the geopolitical/procurement caveat is the host's own risk framing]
- Phi (Microsoft) "hasn't worked very well" for many use cases in the host's experience. [opinion, low-medium confidence — explicitly personal/anecdotal, no specifics given]
- Restoration industry software is broadly "antiquated" / from "the early 2000s." [opinion, low confidence — based on a single personal incident, not a market survey]
- Starting with fine-tuning is a common but mistaken instinct; the better start is a repeated workflow + eval. [opinion, medium-high confidence — stated as a corrected assumption, consistent with general practitioner advice but not independently sourced here]
- The three startup ideas (home health QA, restoration field co-pilot, professional-services pre-send reviewer) are viable, sellable niches. [opinion, medium confidence — plausible and specific, but untested/hypothetical; host states he "would" build them, not that he has]

## Caveats & source gaps
- This is a single-host, sponsored (by Google) episode — no independent guests, data, or case studies are cited; nearly everything is Isenberg's own framework and opinion, not third-party verified research.
- The Hugging Face "$13 billion acquisition" claim is mentioned in passing with no source, date, or corroboration — treat as rumor only.
- All three startup ideas are hypothetical ("I would build," "I love this idea") — there is no evidence any of them has been built, tested, or has real customers; no revenue, pricing, or unit-economics detail is given for any of them.
- Technical specifics are kept deliberately beginner-level; there is no benchmark data, no concrete latency/memory numbers beyond generic RAM tiers, and no discussion of failure modes, security hardening, or deployment ops for shipping a real on-device product.
- The Qwen/DeepSeek geopolitical caveat is raised but not resolved — the host explicitly says "you need to check what your company is comfortable with," i.e., he flags the tension without giving a concrete compliance answer.
- "Schmuck Insurance" domain availability is unverified — host asks the audience to check, meaning it's a live open question, not a claim.
- No discussion of cost of building/maintaining any of the three products, competitive landscape, or regulatory specifics (e.g., HIPAA implications for the home health idea are implied by context — billing/compliance — but never named explicitly).

## What this means for Fusion247
*(Fusion247 interpretation — not sourced from the video.)*
- The source's four-piece framework (model / warehouse / software / workflow) and its "good enough + local advantage" reframing map cleanly onto myPKA's own local-vs-cloud model routing questions — worth treating as a mental checklist when Larry/specialists decide whether a task should hit a local model versus a frontier cloud call, especially given the estate's existing sensitivity to private data (PKM, journal, secrets store).
- The "professional pre-send reviewer" idea (Idea 3) is structurally similar to work Veritas/Vex already do internally (a second set of eyes before something goes out) — it's a useful external validation that this pattern is commercially recognized as valuable, not just an internal governance quirk.
- The "hybrid: local sanitization pass → cloud deep reasoning → human approval" architecture described at [13:26] is a reusable pattern worth keeping in mind for any future myPKA feature that touches sensitive personal data (PKM/CRM, journal entries) before any cloud escalation.
- None of the three startup ideas appear to be current Fusion247 initiatives; they read as general market opportunity notes, not action items, unless Warwick wants to evaluate one as a side venture.
- The video is one more entry in the ongoing YouTube capture stream (per recent commit history) — no indication this source connects to an active Wayfinder Build or Work Package; treat as a general knowledge/idea-bank addition rather than something requiring immediate route action.

## Key concepts & takeaways
- Local AI = model runs on hardware you control; cloud AI = model runs elsewhere via API/web.
- The right question is "good enough + does local improve the product," not "is it smarter than the biggest model."
- Four-piece landscape: model (brain file) → warehouse (Hugging Face) → software (LM Studio/Ollama) → workflow (the product).
- Core vocabulary: parameters, tokens, context window, quantization (Q4/Q8), GGUF, LiteRT-LM.
- Gemma ladder: E2B → E4B (recommended start) → 12B → 26B/31B; plus specialized variants (embedding, function-calling, vision, safety, interpretability).
- Counterintuitive reversal #1: Chinese-origin open models (Qwen, DeepSeek) are widely used despite geopolitical/procurement concerns because they perform well — the concern is real but doesn't stop adoption.
- Counterintuitive reversal #2: the instinctive "cool" move (fine-tuning your own model) is the wrong starting point; the disciplined move is one repeated workflow + a small eval first.
- Hybrid architecture (local sanitization + cloud reasoning + human approval) is presented as the likely dominant real-world pattern, not pure-local or pure-cloud.
- Three concrete niche business templates: home health documentation QA, offline field-report co-pilot for restoration contractors, professional-services pre-send reviewer — all following the same wedge: sensitive data + repeated review + expensive mistakes + start-as-a-service-then-productize.
- Personal productivity angle: build a "local AI lab" folder and produce reusable artifacts (memos, checklists, reports), not just chat answers.

## Actions & open questions
- Decide whether any of the three startup ideas (home health QA reviewer, restoration field co-pilot, professional pre-send reviewer) warrant a Pax research brief or Mason opportunity write-up, or whether this stays a passive knowledge-bank entry.
- If exploring local model use inside myPKA/Fusion247 workflows, verify current hardware (RAM/GPU) against the cheat sheet tiers before assuming a given Gemma size is runnable.
- If evaluating Qwen/DeepSeek for any Fusion247 workflow touching sensitive data, resolve the compliance/procurement question the source explicitly leaves open rather than assuming it's settled.
- No verification was attempted on the Hugging Face "$13B acquisition" rumor or the "Schmuck Insurance" domain — flag both as unverified if referenced elsewhere.
- Consider whether the local-sanitize-then-cloud-escalate pattern is worth a design note for any future myPKA feature handling private personal data before cloud model calls.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/UtFo1ZNC2ns/` — `tubeair-report.md` (sha256 `2745956ada7c…`), `manifest.json` (sha256 `e085e02ee22b…`). Preserved as captured; never edited or summarised.
