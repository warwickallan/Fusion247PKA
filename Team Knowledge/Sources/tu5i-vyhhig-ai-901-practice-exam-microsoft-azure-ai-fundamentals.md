---
source_id: tu5I-vYHhIg
type: source-knowledge-note
source_type: youtube_transcript
title: "AI-901 Practice Exam: Microsoft Azure AI Fundamentals"
source_url: "https://www.youtube.com/watch?v=tu5I-vYHhIg"
video_id: tu5I-vYHhIg
channel: WebLizardLabs
published: 2026-06-13
transcript_source: manual_captions
captured_at: "2026-09-20T08:01:45+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/tu5I-vYHhIg/tubeair-report.md
  - Sources/_raw/tu5I-vYHhIg/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a 45-question mock/practice exam video for Microsoft's **AI-901 (Azure AI Fundamentals)** certification, produced by "WebLizard Labs," a channel that appears to focus on cert-prep content. Each question is read aloud, followed by a reveal of the correct answer and an "exam clue" — a short heuristic meant to generalize beyond the specific question. The content is organized around the newer, Foundry-centric AI-901 syllabus (Microsoft Foundry / Azure AI Foundry, formerly Azure AI Studio): responsible AI principles, model/workload selection, the Foundry build workflow (catalog → deployment → playground → SDK), agentic AI, and Azure Content Understanding for document/media extraction. It matters as a structured, scenario-driven map of what the current AI-901 exam actually tests and how it phrases questions (single-choice, choose-two/three, Yes/No batteries, matching, and step-ordering-with-a-distractor).

## What the source says

### Format and pedagogy of the exam itself
The video explicitly teaches exam *technique*, not just content: multiple question styles appear (single answer, choose-two, choose-three, Yes/No per statement, drag-style matching, and "order the steps and exclude the one that doesn't belong") [01:03], and the presenter repeatedly stresses that the memorized "clue" phrase matters more than the literal question wording [00:41], because the same underlying pattern recurs across differently-worded scenarios. The closing guidance [01:18:14–01:18:58] is a self-diagnostic: group your misses into four buckets — responsible AI, Foundry workflow order, modality (speech vs vision vs generation vs extraction), and Content Understanding — and use that bucket to target review, rather than re-reading everything.

### Vein 1 — Responsible AI principles (recurring category, ~Q1–Q5, Q22)
The exam repeatedly tests the six/seven Microsoft responsible-AI principles by scenario, not by name-recitation:
- **Fairness**: demonstrated via a hiring-screening tool that ranks one demographic group lower than equally-qualified others [01:29–02:44]. Clue: differential outcomes across groups of people = fairness, not transparency or accountability.
- **Reliability and safety**: shown through a healthcare billing-assistant pilot. The distinguishing test is whether an action involves *testing before live use*, *monitoring after deployment*, and *escalation to humans* — a disclosure banner alone does NOT satisfy reliability/safety even though it satisfies transparency [02:44–04:31]. This exact "disclosure ≠ safety" distinction recurs in a benefits-eligibility case worker scenario, where the compliant answer combines human document review, visible limitations, quality monitoring, AND escalation — never a disclaimer alone, and never letting the AI produce a "final" recommendation [06:20–08:35].
- **Privacy and security**: illustrated by a customer-service summarization assistant, where the responsible design choices are *minimum necessary data* + *role-based access control*, explicitly contrasted against tempting-sounding wrong answers like "use the full record for max context" or "keep everything indefinitely for later inspection" [04:31–06:20].
- **Accountability**: paired with privacy in the same question — assigning clear ownership for reviewing the assistant's behavior and documenting how data risks are handled [04:31–06:20].
- **Transparency**: tested via an AI chat agent that "sounds human." The correct behavior is an explicit disclosure that the user is talking to AI plus a statement of limitations — not hiding the AI's nature, and not deferring disclosure until after a complaint [08:35–09:31].

**Underlying exam pattern (stated as a takeaway, not just a per-question clue):** the exam consistently rejects two shapes of wrong answer — (a) a single superficial fix (a disclaimer, a better prompt, more randomness) standing in for the real safeguard, and (b) "use more data / keep everything" framed as if it were the safe or thorough choice, when the responsible answer is minimization.

### Vein 2 — Modality and workload selection (input/output type matching)
A large share of the exam (Q6, Q10, Q11, Q12, Q13, Q14, Q15, Q16, Q17, Q18, Q29, Q30, Q31, Q32, Q34, Q35, Q36, Q37) is really one recurring skill: **read the input and output types the scenario needs, and match them to the correct AI workload category**, without being distracted by superficially plausible but modality-mismatched options. The workload taxonomy tested:
- **Multimodal models** — needed whenever a scenario combines an existing image AND a text prompt in the same interaction (e.g., "what's wrong with this product photo, based on my question") [10:10–11:26, 56:32–57:50].
- **Image generation** — needed only when the requirement is to *create a new image from a text description*; explicitly NOT the same as understanding an existing image (a repeated distractor pairing) [18:55–19:43 vs 29:05–30:08, 57:50–59:17, 01:01:11–01:02:18].
- **Generative AI (text)** — for drafting new text content (e.g., an email reply from case notes) [17:50–18:55].
- **Key phrase extraction / entity recognition / sentiment analysis** — the trio used together for analyzing large volumes of *written* comments: identifying topics, named entities, and positive/neutral/negative tone [18:55–19:43, 48:53–50:09].
- **Speech recognition vs speech synthesis** — tested repeatedly with a directional trap: recognition is audio→text; synthesis is text→audio; and a wrong-but-tempting answer often applies synthesis where sentiment analysis or summarization was actually needed (e.g., "should synthesis judge whether text is positive/negative?" — No) [20:19–22:01, 50:09–52:24].
- **Computer vision object detection** — locating items within an existing image (e.g., products on a shelf) [23:50–24:59].
- **Text summarization** — shortening long text while preserving key points, distinct from entity recognition (which extracts named items, not a condensed narrative) [53:11–53:49].
- **Image classification vs. object detection vs. OCR/text extraction vs. image generation** — a four-way matching drill: classification = assign a category to a whole image; object detection = locate specific damaged areas; OCR = read printed text (e.g., serial numbers) from a photo; generation = create a brand-new image from a text prompt [59:17–01:00:22].
- **Multi-stage workload decomposition** — a training-video pipeline (transcribe → summarize → generate quiz hints) requires *three different* workload types chained together: speech recognition, then summarization, then generative AI — the video explicitly warns against the tempting shortcut of "just run one text model on the video files directly" [27:03–28:16].

### Vein 3 — Requirement-first solution design (anti-pattern: tool-first thinking)
Two step-ordering questions establish a general design discipline the exam rewards: **do not start from a tool or the most popular model** [24:59–27:03]. The correct sequence for choosing an AI approach is:
1. Define the business requirement (what does the user need the system to do)
2. Identify input/output modalities (text/image/audio/generated content)
3. Choose the workload category (text analysis, vision, speech, generative AI)
4. Select the model/deployment/service capability that fits
5. Validate against sample cases

The excluded/wrong step in that ordering question is explicitly "start by picking the most popular model in the catalog, then decide what it can support" — named as the anti-pattern to recognize and reject [24:59–27:03].

### Vein 4 — The Microsoft Foundry build workflow (a distinct, heavily-tested procedural vein)
This is arguably the second-largest thread after modality-matching, and it is procedural rather than conceptual. The exam tests a strict operational sequence for building anything in Microsoft Foundry (formerly Azure AI Studio):

**Catalog → Deployment → Playground/testing → Endpoint+auth config → SDK/code call**, with two explicit anti-patterns repeatedly excluded:
- Assuming that *selecting* a model in the catalog (or saving its "model card") is the same as having something an app can call — it is not; a **deployment** and an **endpoint** are required before any app or SDK call is possible [11:26–12:50, 32:57–33:46, 39:25–41:07].
- Writing full application/SDK code *before* creating a deployment or testing prompts in the playground — explicitly flagged as the wrong-order step to exclude in a step-ordering question [33:46–35:37].

The **Foundry component-to-role mapping** (tested as a matching question) is:
- **Model catalog** = discover/compare available models and their capabilities
- **Model deployment** = makes a selected model a callable target
- **Playground/chat testing** = interactive prompt testing and behavior review before app integration
- **SDK/client in application code** = what production app code actually uses to call the deployed model, with authentication/configuration [12:50–13:50, 43:27–45:23]

Once deployed and playground-tested, moving to production code requires a **supported client or SDK configured with the deployment endpoint and authentication/configuration details** — the playground itself is explicitly NOT a production interface for end users [39:25–41:07, 47:21–48:53].

### Vein 5 — Prompt/model configuration concepts
A matching question and a follow-up establish four distinct configuration levers and their roles [12:50–16:09, 35:37–37:23]:
- **System instructions** (or an equivalent persistent instruction layer): durable, cross-conversation behavior rules — role, tone, boundaries, response format, and what to do when required information is missing. These should be set once, not depend on the user re-stating them every time.
- **Context supplied with the prompt**: task-specific information relevant only to the *current* request/response.
- **Model deployment**: provides the callable endpoint/target itself (an infrastructure concern, not a behavior concern).
- **Temperature**: controls how varied/predictable a generated response is — explicitly NOT a substitute for behavioral control (a repeated wrong-answer trap is "increase temperature to get more consistent troubleshooting style," which is backwards — consistency comes from system instructions and structured context, not randomness) [35:37–37:23].

Also tested: **grounding** — when an assistant must answer strictly from a specific business document (e.g., a travel policy) rather than general knowledge, the correct approach is to supply that document as trusted context via the prompt or a retrieval/agent pattern, explicitly rejecting "raise temperature," "let it guess," and "train a new foundation model from scratch" as wrong answers [45:23–47:21].

### Vein 6 — Agentic AI vs. simple generative interactions
A distinct conceptual category: **when does a scenario need a Foundry "agent" rather than a plain chat/generative call?** [30:08–31:56, 37:23–39:05, 41:07–43:27]. The defining characteristics of agentic AI per this source:
- Persistent/reusable instructions or policies that guide behavior across interactions (not just a single completion)
- The ability to orchestrate tool calls or actions as part of a multi-step task (e.g., looking up a ticket, then creating a ticket action after user confirmation)

The exam explicitly rejects treating agentic AI as equivalent to a static FAQ page, and rejects treating "returns one text completion with no tool use" as agentic. The decision rule tested via a Yes/No battery: use an agent when the design needs durable instructions **plus** tool/action use or multi-step orchestration; do NOT reach for an agent for a one-off Q&A or a single-paragraph summarization task — that's over-engineering [37:23–39:05]. A full worked scenario (helpdesk assistant needing policy compliance, document retrieval, ticket lookup, and ticket creation) is used to show the complete recommended pattern: **build and test a Foundry agent with instructions + approved tools, then connect a client application to the tested agent** — explicitly rejecting both "paste everything into every prompt" and "keep it in the playground permanently and have staff manually relay answers" [41:07–43:27].

### Vein 7 — Azure Content Understanding / structured extraction (a large, recurring thread late in the exam)
From Q39 onward, a sustained thread covers **Content Understanding / Foundry extraction workflows** as the answer for anything requiring *structured fields pulled out of existing content* (invoices, forms, receipts, and even audio/video) [01:04:18–01:17:11]. Key distinctions the exam repeatedly draws:
- Extraction (pulling named fields into a table) is a **different workload from summarization, general chat, OCR-only, or image generation** — each of which appears as a tempting-but-wrong answer in different questions (e.g., "just summarize the invoice," "use a general chat prompt asking for anything important," "save raw OCR text and let people search it") [01:04:18–01:11:31, 01:15:44–01:17:11].
- **Reliable extraction requires two things together**: (1) a defined field/schema (e.g., invoice number, vendor, date, total) rather than an open-ended prompt like "extract all important details," and (2) testing against representative sample files with review before trusting the workflow — a "broad prompt that adapts freely" and "auto-store if the format looks familiar" are both explicitly wrong because they sacrifice consistency [01:07:47–01:09:43].
- Content Understanding is **not limited to documents** — it's framed as applying to "existing content across modalities at a high level," including extracting structured business information (product names, issue categories, approximate timestamps) from audio/video recordings such as support calls, again requiring human validation before storage — transcription alone or an unstructured summary is explicitly insufficient [01:11:31–01:13:46].
- The **canonical end-to-end extraction-app pattern**, given as the final question's answer: upload existing content → extract defined fields via Content Understanding/Foundry extraction → present extracted values for human review → save only the reviewed results to the downstream system. Partial answers (summary only, raw OCR only, auto-save unreviewed JSON) are explicitly flagged as insufficient even though each "sounds useful" [01:15:44–01:17:11].

### Counterintuitive reversals explicitly worth preserving
1. **A visible AI disclaimer is necessary for transparency but is NOT sufficient for reliability and safety.** Multiple questions set up a scenario where a team believes "we told users it's AI-assisted, so we're covered" — the exam repeatedly marks that insufficient unless paired with testing, monitoring, and human escalation [02:44–04:31, 06:20–08:35]. The assumption being overturned: disclosure = responsible use. The reversal: disclosure covers transparency only; safety/reliability is a separate, harder bar.
2. **More data / keeping everything is NOT the safe or thorough choice — it's the wrong answer.** Intuition might suggest "give the model maximum context" or "retain all interactions for later inspection" is diligent; the exam frames these as privacy/security failures, with minimization and role-based access as the correct pattern [04:31–06:20].
3. **Selecting/discovering a model is not the same as being able to call it.** A model appearing in the catalog, or even a saved "model card" screenshot, is explicitly *not* sufficient for an application to use — deployment plus authentication/endpoint configuration is a hard prerequisite tested at least three separate times [11:26–12:50, 32:57–33:46, 39:25–41:07]. The assumption being overturned: "if I can see the model, my app can use it."
4. **Higher temperature is not a behavior-control mechanism.** A natural-seeming fix for "make responses more consistent/on-brand" is tempting to answer with "adjust temperature," but the exam treats this as a distractor — temperature affects variability/randomness, not the durable behavior rules that come from system instructions [16:09–16:09 clue, 35:37–37:23, echoed again in the invoice extraction question at 01:09:43 where "adjust only temperature for consistent extraction" is wrong].
5. **Audio input still requires speech-specific capability even when the desired final output is text.** The trap: "the app only needs to output text, so a text-only model is fine" — false when the *input* is a voicemail or spoken audio; speech recognition/transcription is still required as a distinct step [16:09–17:50].
6. **An agent is not always the right architecture — simplicity is graded as correct.** Given how much of the syllabus emphasizes agentic AI, the exam explicitly rewards recognizing when a plain one-off prompt or summarization task does NOT need an agent, treating "add an agent" as a wrong/over-engineered answer in two of three cases in one Yes/No battery [37:23–39:05].

## Mechanisms, methods & implementation detail

**The Foundry build sequence** (stated twice, once generally and once specifically for a chat app, both as ordered-step questions with a distractor to exclude):
1. Define/select an appropriate model for the requirement.
2. Create a deployment for that model.
3. Test representative prompts in the Foundry playground/chat experience; adjust instructions if answers are incomplete or inconsistent.
4. Configure the application with the deployment endpoint and required authentication.
5. Call the deployed model from application code via SDK/client.
Excluded distractor step: writing full application code before any deployment/testing exists [33:46–35:37, 47:21–48:53].

**The general requirement-to-implementation sequence** (workload-agnostic):
1. Define the business requirement.
2. Identify input/output modalities.
3. Choose the workload category.
4. Select the model/deployment/service capability.
5. Validate against sample/representative cases.
Excluded distractor: starting from "the most popular model in the catalog" [24:59–27:03].

**The voice-app data flow** (step-ordering question):
Capture audio input → convert to text/intermediate representation (speech recognition) → call the model/capability to generate or retrieve a response → convert the text response to speech if needed (speech synthesis) → return the response (text/audio/both). Excluded distractor: synthesizing a spoken answer before input has been captured or interpreted [54:21–56:32].

**The responsible image-generation workflow** (step-ordering question, for brand/campaign work):
Define prompt, intended use, brand constraints, and content boundaries → generate candidate images → review candidates for safety, brand fit, and accuracy → select or iterate based on review feedback. Excluded distractor: publishing the first generated image immediately just because the prompt was "approved" [01:02:18–01:04:18].

**The extraction-app pattern** (repeated across four questions with variations):
Upload/ingest existing content (documents, forms, receipts, or audio/video) → define the target fields/schema to extract → run through Content Understanding or a Foundry extraction capability → present extracted values for human review/validation → store only reviewed results in the downstream business system [01:04:18–01:17:11].

## Tools, people, products & organisations

- **Microsoft Foundry** — the primary platform under test (referred to as the successor to "Azure AI Studio" in current AI-901 material); provides a model catalog, deployment mechanism, playground/chat testing UI, and SDK/client libraries for application integration. Central to nearly a third of the exam's questions.
- **Azure Content Understanding** — a Foundry capability/service for extracting structured information (fields, entities, categories, timestamps) from existing content across modalities (documents, images, audio, video), paired with a human-review step before storage. Tested as the answer to five-plus questions late in the exam.
- **Foundry agents** — the agentic-AI construct within Foundry: persistent instructions/policies plus the ability to call approved tools/actions across a multi-step workflow, distinct from a plain deployed chat model.
- **WebLizard Labs** — the producer/channel of this practice-exam video; states this is part of an "AI-901 playlist" that will also receive course videos going forward [01:18:58].
- No other named third-party tools, competitor products, or people are referenced in the transcript — this is a pure exam-content video with no product placement, sponsor mentions, or interviews.

## Examples & use cases

Every question is itself a worked example/scenario; the recurring domains used across the 45 questions are: hiring/resume screening (fairness), healthcare billing assistant (reliability/safety), customer-service summarization (privacy), government benefits eligibility case-worker tool (high-impact human oversight), customer support website chatbot (transparency), damaged-product photo + question (multimodal), Python app calling a deployed model (Foundry mechanics), internal IT support assistant (system instructions), thousands of written customer comments (text analytics trio), voice-enabled customer support app (speech recognition/synthesis), retail shelf-photo product location (object detection), employee training video transcription/summarization/quiz generation (multi-stage pipeline), marketing campaign concept art (image generation), helpdesk multi-tool agent (agentic AI), company travel-policy chatbot (grounding), and finance/accounting invoice and receipt processing plus recorded support-call analysis and customer-onboarding document processing (Content Understanding, three separate questions building the same pattern with escalating complexity).

## Claims & confidence

- The current AI-901 exam is organized around Foundry-centric skills: responsible AI, model selection, agents, generative AI apps, speech, vision, and information extraction. — [claim, high confidence — stated directly by the presenter as framing, consistent with the entire question set that follows]
- Disclosure/transparency alone does not satisfy the "reliability and safety" responsible-AI principle; testing, monitoring, and human escalation are required. — [claim, high confidence — asserted as the correct answer across at least three separate scenario questions]
- A model appearing in the Foundry catalog is not callable by an application until it has a deployment and authentication/endpoint configuration. — [claim, high confidence — asserted identically across three separate questions with different scenarios]
- Temperature governs response variability only and is not a mechanism for enforcing consistent behavior or tone. — [claim, high confidence — used as a distractor-rejection rule across multiple questions]
- Agentic AI requires both persistent instructions AND tool/action orchestration; simple one-off prompts or single-document summarization do not warrant an agent. — [claim, high confidence — the exam's own explicit decision rule for two questions]
- Azure Content Understanding is the intended Foundry-era answer for structured field extraction from documents, images, audio, and video alike, always paired with a human-review step before data is stored. — [claim, high confidence — asserted consistently across seven-plus questions covering documents, invoices, and audio/video]
- This is an accurate/representative sample of real AI-901 exam question content and style. — [opinion/claim by the producer, unverifiable from the transcript alone — presented as "practice exam" content but there is no stated sourcing, licensing, or validation against Microsoft's actual published exam objectives]

## Caveats & source gaps

- **No sourcing or validation is given** for how closely these 45 questions map to Microsoft's actual, current AI-901 exam objectives or item bank. The video presents itself as practice material but offers no citation, official objective-domain reference, or version/date for the underlying Microsoft syllabus it claims to reflect.
- **No visual content from the video is reflected here** beyond what the spoken transcript conveys (e.g., on-screen countdown timers, any diagrams, or slide text) — this note is built entirely from narration.
- The transcript is auto-caption-derived and deduplicated for readability per the prompt's own note; no wording was altered, but any transcription errors in the original captions (e.g., "Fable, Opus, Sonnet, Haiku" or similar proper-noun garbling — none observed here, but a general caution) would carry through uncorrected.
- **No depth beyond exam-answer level** is given for *why* certain Foundry mechanics work the way they do (e.g., no explanation of authentication mechanisms, no discussion of specific SDK languages beyond "Python," no version numbers, no pricing, no discussion of alternative Azure AI services outside the Foundry/Content Understanding scope). This is consistent with an AI-901 *fundamentals* framing but means the note cannot go deeper than the source did — nothing has been invented to fill this in.
- The video does not address enterprise-scale considerations, cost, region availability, or compliance certifications for any Azure service named.

## What this means for Fusion247

*(Interpretation — not sourced from the video.)*

- **Direct relevance to CareerAIR/skills evidence work**: if Warwick is pursuing or has an interest in AI-901 as a credential (or is evaluating whether it's worth adding to CareerAIR's evidence base for job applications), this note gives a fairly complete map of what the certification actually tests — useful for judging fit against roles that list "Azure AI Fundamentals" as a requirement, without needing to watch the video or sit a real exam to know the shape of it.
- **The Foundry build sequence (catalog → deploy → test → configure → call) and the agentic-AI decision rule are directly transferable concepts** to Fusion247's own myPKA/Foundry-adjacent work (e.g., anything built against Microsoft Foundry, or any internal reasoning about "does this need an agent or a plain call" — a question Larry/Keel implicitly answer already when scoping Work Orders for the estate's own specialists, though via a different vocabulary).
- **The responsible-AI pattern ("disclosure ≠ safety"; "minimize + control access, don't hoard data") is a reusable checklist** worth keeping in mind for any Fusion247-built AI feature that touches personal or household data (though per the standing hobby-brain rule, this stays a design-quality consideration, not something to escalate to Warwick as a compliance finding).
- **No action is implied for the estate's git/build discipline, Wayfinder process, or specialist roster** — this is a pure external knowledge-intake item with no operational hooks into current builds.

## Key concepts & takeaways

- Responsible AI principle recognition by scenario pattern: Fairness (differential group outcomes), Reliability & Safety (testing + monitoring + escalation, not just disclosure), Privacy & Security (minimize + restrict access), Accountability (clear ownership + documentation), Transparency (disclose AI involvement + limitations).
- Workload/modality matching is the single most heavily tested skill: correctly identifying input/output types (text, image, audio, generated content) drives the correct workload choice more than memorizing service names.
- The Foundry procedural chain: catalog (discover) → deployment (make callable) → playground (test) → endpoint+auth (configure) → SDK/client (integrate) — always in that order, never skipping ahead to code or production.
- System instructions = durable behavior; context = task-specific/current; temperature = variability, not control; deployment = infrastructure/callability.
- Agentic AI = persistent instructions + tool/action orchestration across multi-step tasks; not every assistant needs to be an agent.
- Content Understanding = structured field extraction from existing content across modalities, always with human review before storage; distinct from summarization, OCR-only, or generation.
- Grounding = supplying trusted, specific context (e.g., a policy document) so a model answers from that source rather than general knowledge or guessing.
- Exam meta-strategy: memorize the "clue" pattern behind each answer, not the exact question wording; use missed-question categories (responsible AI / Foundry order / modality / Content Understanding) as a targeted revision map.

## Actions & open questions

- If AI-901 certification is something Warwick wants tracked as a goal or evidence item (e.g., for CareerAIR), confirm current interest/priority before building anything further on it — no evidence in this session that it's an active goal.
- If useful, this note (or a distilled checklist version) could be filed as reference material for any future Fusion247 work that touches Microsoft Foundry directly, given the procedural overlap between the exam's "deploy → test → integrate" sequence and how myPKA specialists already reason about tool/agent scoping.
- Open question (not answerable from this source): how current is this "Foundry-centric" AI-901 framing relative to Microsoft's actual published exam objectives as of today (2026-09-20)? The video's own upload/production date is not given in the transcript, so recency cannot be confirmed from this note alone.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/tu5I-vYHhIg/` — `tubeair-report.md` (sha256 `4bb641396679…`), `manifest.json` (sha256 `6335c4958aa9…`). Preserved as captured; never edited or summarised.
