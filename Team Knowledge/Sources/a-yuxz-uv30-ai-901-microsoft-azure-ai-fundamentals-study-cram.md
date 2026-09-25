---
source_id: a-yuXz_uV30
type: source-knowledge-note
source_type: youtube_transcript
title: AI-901 Microsoft Azure AI Fundamentals Study Cram
source_url: "https://www.youtube.com/watch?v=a-yuXz_uV30"
video_id: a-yuXz_uV30
channel: John Savill's Technical Training
published: 2026-05-18
transcript_source: auto_captions
captured_at: "2026-09-20T21:12:31+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/a-yuXz_uV30/tubeair-report.md
  - Sources/_raw/a-yuXz_uV30/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a "study cram" video by John Savill (Savill Technical Training) designed to help viewers pass Microsoft's AI-900/AI-901 "Azure AI Fundamentals" certification exam. It is a single presenter walking through the exam's core knowledge domains — AI/ML concepts, responsible AI, Azure identity and resource hierarchy, Microsoft Foundry (Azure's AI platform), generative AI mechanics, and the major AI service categories (NLP, speech, vision, image generation, information extraction) — interleaved with live demos in the Azure/Foundry portal and short Python/PowerShell code walkthroughs. It matters because it's both an exam-prep resource and a reasonably complete practical map of Microsoft's current AI product surface (Foundry, agents, models, guardrails, authentication patterns) as of the recording.

## What the source says

### Exam scope and how to prepare [00:00–02:23]
The AI-901 update requires not just conceptual AI knowledge but understanding of how applications consume AI, including reading simple Python code. Savill recommends: his own site's "development" section, specifically a "Python first hour" video and an "AI development for non-developers" video, for anyone without a programming background; Microsoft's free official online training (which links to hands-on labs); and setting up a free/trial Azure subscription to practice. He points to the AI-901 exam page's "study guide," which lists the official "skills measured." His framing of the exam's difficulty level: it is fundamentals-only — no complex code-writing, no solution architecture — the real test is "where do you use which capability" and understanding what simple example code is doing.

### What AI is, and the human-faculty framing [02:23–05:08]
Savill defines AI as software that imitates aspects of human capability, and structures the whole talk around mapping AI capabilities to human faculties:
- **Brain/prediction** → evaluation, decision-making from historical data, trend learning.
- **Vision** → understanding images: what is this text, what is this an image of, object localization ("draw a box around the cat").
- **Language** → conversation, translation, knowledge extraction, summarization.
- **Creativity** → generative AI: text, images, songs, video — described as "one of the big ones," the center of current AI excitement.

Separately, **machine learning** is defined as systems that learn patterns from data rather than being explicitly programmed — e.g., learning from labeled data to make predictions/classifications.

### Assistants vs. Agents [05:30–07:15]
A materially important conceptual distinction, since much of the field's current framing hinges on it:
- **Assistants**: request/response, human controls the sequence, can be multi-turn, but the human always initiates each turn. Purpose: boost productivity.
- **Agents**: event/trigger-driven (an email arriving, a schedule, some combination), capable of multi-step planning, high autonomy, goal-directed rather than turn-directed — you give it a goal and it runs the full automation end-to-end. Purpose: automate tasks.

Savill states he sees "huge value" in the agentic model specifically because of this shift from turn-by-turn productivity assistance to full autonomous goal completion.

### Responsible AI principles [07:15–09:36]
Presented as mandatory considerations baked into any AI solution, not optional add-ons:
- **Fairness** — no unintended bias, equal treatment.
- **Reliability and safety** — system behaves as expected (his example: self-driving cars).
- **Privacy and security** — protects data and identities.
- **Inclusiveness** — designed for diverse users.
- **Transparency** — understandable why a decision/classification was made.
- **Accountability** — someone is responsible for AI outcomes.

### Azure identity and resource hierarchy [09:36–13:15]
This is presented as foundational because everything in Azure AI sits on top of it:
- **Entra ID** is Microsoft's identity provider. Every organization has a "tenant" (visible in the org's email domain, e.g. `savilltech.net`). Users, groups, computers, and — notably — **AI agents** all get identities within the tenant. Security policies live there too. The stated reason identity matters for agents specifically: auditing, risk detection, and scoped access to tools/resources.
- **Subscription**: primarily a cost boundary, also a permissions boundary; permissions applied at the subscription level are inherited by everything inside it. A subscription trusts exactly one Entra tenant for identity — only identities in that tenant can be granted access to its resources.
- **Resource groups**: live inside a subscription; you can have multiple, but resource groups **cannot be nested** inside each other (though resources across them can still reference/link to each other).
- **Resources**: created inside resource groups — storage accounts, VMs, networks, and (the relevant one here) an instance of **Microsoft Foundry**, described as "the pro-developer AI app and agent resource."

### Microsoft Foundry — the core of the video [13:15–23:55]
Foundry is demonstrated live throughout. Structurally:
- A Foundry **instance** lives in a specific Azure region/data center (his demo used East US2) inside a named resource group and subscription.
- Foundry has its own portal at **ai.azure.com** ("the new Foundry experience"), organized around discovering, building, and operating/leveraging AI resources.
- **Model catalog**: over 10,000 models available — explicitly *not* limited to Microsoft/OpenAI models; includes Anthropic, Grok, Hugging Face models, and many others. Savill frames this "model diversity" as a deliberate selling point.

**Models and deployment** [15:18–19:38]: a model must be *deployed* before an application can use it. Deployment-time choices include:
- **Deployment type**: *Global* (may run on a cluster anywhere in the world), *Data zone* (US or Europe only — relevant for regulatory data-residency requirements), *Regional* (only the region the Foundry instance was created in — not every model is available in every region).
- **Model version** (some models have multiple).
- **Limits** (e.g., token caps).
- **Provisioned throughput units (PTUs)** — reserved capacity with guaranteed latency, for critical/high-load scenarios; requires regional deployment.
- **Priority processing** — higher priority relative to other tenants on shared capacity, at extra cost.
- **Guardrails/safety settings** — default guardrails cover jailbreak protection, content safety categories, and protected materials; these are adjustable per-scenario (his example: a medical use case that legitimately needs to discuss violence/harm might need a higher tolerance threshold than the default).

**Agents in Foundry** [19:38–23:55]: two agent creation modes:
- **Prompt-based agents**: no-code, defined purely by natural-language instructions — "super low weight."
- **Hosted agents**: pro-code — you write code describing the agent's behavior, package it as an image, and Foundry hosts/executes it — "maximum flexibility."

Every agent has instructions (system-prompt-equivalent, either typed directly for prompt-based agents or embedded in code for hosted ones), and *optionally* uses:
- **Tools** — to take actions / talk to other systems, including via **MCP (Model Context Protocol)** — described as a standard so AI apps can discover and talk to tools/knowledge sources, and MCP servers can reflect back their own capabilities to make them easier for the AI app to use. Agents can also talk to other agents.
- **Knowledge** — external knowledge bases (built via Azure AI Search) that supply information the model wasn't trained on (e.g., email, OneDrive, a custom knowledge base).

He also demonstrates the **model router**: a routing layer that automatically selects which underlying model to use based on task complexity, used as the "brain" behind an agent rather than picking one fixed model.

### Talking to Foundry programmatically: endpoints, auth, SDKs [23:55–28:42]
- Every Foundry instance exposes an **HTTPS endpoint** (a URL); apps talk to it via **REST**, typically exchanging **JSON**.
- **Two authentication options**:
  1. **Entra identity** (preferred) — proves identity without a stored secret. For other Azure resources this can use a **managed identity**, fully handled by Azure with no secret for your code to manage.
  2. **API key** (secondary, explicitly less preferred) — must be stored securely (e.g., **Azure Key Vault**), never hard-coded, never committed to a git repo. If a key is ever suspected compromised, it should be regenerated immediately; Foundry provides two keys precisely so one can be rotated while the other keeps the app working.
- In practice, developers use an **SDK** (e.g., the OpenAI Python module, or `azure.identity`) rather than hand-writing REST calls — the SDK provides language-native functions and handles both the HTTP calls and authentication.
- Foundry's portal auto-generates working code samples (in multiple languages, multiple auth modes) for any deployed model, which he demonstrates: a completions call using the OpenAI SDK with an API key stored as an environment variable, and a parallel version using `DefaultAzureCredential`/Entra auth with zero secrets in code. Both produce the same output; adding a **system prompt** (e.g., "always answer like a pirate") changes the model's behavior while the user prompt stays the same — illustrating that a system prompt is the mechanism for driving agent/model behavior, and the user prompt is the actual ask.

### Generative model mechanics — LLMs, tokens, embeddings, modality [35:57–43:37]
- **LLM vs SLM**: Large Language Models (billions–trillions of parameters) vs Small Language Models (millions of parameters, often distilled from a larger model for cheaper/faster inference). More parameters generally = more capable but slower/more expensive to run.
- **Parameter** is described simply as a number representing the strength of a connection between "digital neurons."
- **Inference** = the model's "thinking" process converting input to output.
- **Modality**: inputs/outputs can be text, audio, image, video, code, etc., in many combinations (text→text, text→audio, text→image, image+text→image, etc.).
- **Multimodal vs multimodel** — an explicit, easily-confused distinction the source is careful to separate: *multimodal* = a single model supports more than one modality (as input or output). *Multimodel* = an application uses more than one distinct model in a pipeline (e.g., speech-to-text model → reasoning model → text-to-speech model, chained to look like one seamless audio-to-audio system).
- **Tokens and embeddings**: a prompt isn't understood as words — it's converted into **tokens** (numbers representing a word or part of a word), which are then converted into **embeddings** — high-dimensional vectors representing meaning. **Transformer models** use an attention mechanism ("attention is all you need") to determine how tokens relate to and matter to each other.
- **Embeddings for search/data, not just prompts**: a key emphasized point — embeddings aren't only used to interpret prompts. Because natural language is ambiguous (one word, many meanings; many words, one meaning), keyword search over your own data often fails, so systems build **vector databases** representing the *meaning* of stored data, enabling semantic search.
- **Vector arithmetic example**: puppy − dog + cat ≈ kitten, illustrating that semantic relationships are geometrically encoded in embedding space (he notes this is a simplified illustration — real spaces have ~thousands of dimensions, not 3).

### Non-generative / specialized AI service categories
The video repeatedly stresses that generative AI is not the only — or always the best — tool, and walks through Foundry's specialized services:

**Natural Language Processing (NLP)** [43:37–50:19]: understanding/inferring meaning from human language — key-term extraction, named entity recognition, sentiment classification, summarization. Traditional NLP pipelines: tokenize → normalize (lowercase, strip punctuation) → filter stop words → POS-tag (noun/verb/adjective) → analyze. Modern NLP uses the same embeddings/transformers as LLMs to capture semantic relationships, intent, and nuance beyond older frequency-based analytics. Demonstrated two ways to do NLP: (1) ask a generative model directly to do the breakdown, or (2) use **Azure Language**, a purpose-built, deterministic model service. Explicit tradeoff stated: generative models are **non-deterministic** (same input can yield different output each time); Azure Language and other specialized/deterministic models give the same input → same output, are typically more consistent/predictable, and **cost less** than using a generative model for the same narrow task. Demoed live with language-detection (100% confidence English, then 100% confidence Spanish) plus auto-generated SDK code.

**Speech** [50:19–53:48]: two directions — speech-to-text and text-to-speech. Use cases: meeting transcription, customer service agents, accessibility, notifications, training content, entertainment voices, and interactive "voice live" push-to-talk. Demonstrated Microsoft's "my voice" text-to-speech (multiple named voices, e.g. "Iris") and speech-to-text in the Foundry playground, both with auto-generated integration code. Speech capabilities can be added directly into a Foundry-hosted agent.

**Computer Vision** [54:05–56:22]: 
- **Image classification** — one label for the whole image (e.g., "this is a boat").
- **Object detection** — identifies *what and where* (bounding-box coordinates) for possibly multiple objects.
- **Semantic segmentation** — pixel-level labeling of exactly which pixels belong to which object.
- **Contextual image analysis** — described but only briefly illustrated.
Underlying model types: **convolutional neural networks** (trained on labeled image sets, used to classify new images) and **vision transformers** (use embedding vectors to represent image meaning — the basis for multimodal models).

**Image/video generation via diffusion** [56:22–1:00:29]: Explained mechanistically — training takes a real image and progressively adds layers of noise until it becomes pure noise; the model learns to reverse each noise-addition step. At generation time, the model starts from *pure random noise* and repeatedly denoises in small guided steps, each step nudging pixels toward the concept described in the prompt — "controlled chaos," turning static into structure. Demonstrated live generating a cartoon image (GPT-image-2) with configurable resolution, quality, compression, format, and number of variations; noted some models can also *edit* an existing source image (a multimodal input: image + text description). Mentioned Sora for video generation as an extension of the same family.

**Information extraction / Azure Content Understanding** [1:00:29–1:03:57]: taking unstructured content (receipts, contracts, documents) and turning it into structured, usable data — e.g., extracting expense data from a receipt, or contract details to populate a database. Pipeline: **OCR** (find letters in an image → words → sentences) → field extraction → mapping to a structured schema/database. Built-in Azure service: **Azure Content Understanding**, which ships predefined classifiers and also supports custom-defined extraction targets. Demoed on a sample receipt: it identified name (lower confidence), address (higher confidence), phone number (very high confidence), dates, line items, tax, and total — each field with its own confidence score — and similarly on an invoice. Explicit tradeoff repeated again: a generative model *could* do this, but is likely slower and more error-prone than a purpose-built deterministic extraction model.

### Closing exam guidance [1:03:57–1:06:17]
Reiterates the core exam framing: know *which category of service* solves *which type of problem* (documents/contracts → Content Understanding; images → Computer Vision; voice → Speech; sentiment/text analytics → NLP/Azure Language; open-ended generative tasks → generative models). Recaps tokens→embeddings, multimodal definition, deployment options (global/data-zone/regional, versions, limits, guardrails), agent types (prompt-based vs hosted) and their instructions/tools/knowledge, endpoint+auth (Entra/managed identity preferred over API keys), and SDKs. Final advice: use the free training, do the hands-on labs, use GitHub Copilot for help with the Python if you're not a coder, and if you fail the exam first time, review which areas you were weakest in and retake.

## Mechanisms, methods & implementation detail

- **Deploying a model in Foundry**: Discover → Models → select model (e.g. GPT-5 mini / GPT-4) → Deploy → choose default (global standard, default quotas) or Custom (data zone / regional / PTU / priority processing / version / token limits / guardrail level).
- **Authenticating an app to Foundry**: preferred path is Entra ID token via `DefaultAzureCredential` (no secret in code, works automatically off an already-authenticated Azure CLI session); fallback is an API key stored as an environment variable (never hard-coded, never committed), retrievable/regenerable from the Foundry "Home" page or the Azure portal resource's key/endpoint blade.
- **Calling a model from code**: `pip install openai` (or `pip install azure-identity` for Entra auth) → import the OpenAI SDK → construct a client against the Foundry endpoint + credential → call the completions API with a `system` message (behavior instruction) and `user` message (the actual ask) → read `.choices[0].message.content` from the response. Foundry's "Code" button on any model auto-generates this in your choice of language, auth mode (key vs Entra), and API style (SDK vs raw REST).
- **Building an agent**: define instructions (system prompt equivalent) → optionally attach tools (including MCP servers, other agents, a tool catalog) → optionally attach a knowledge base (built on Azure AI Search, ingesting sources like email/OneDrive/custom docs) → select the backing model (or model router) → deploy as prompt-based (no code) or hosted (packaged code, image-based).
- **Regenerating a compromised API key**: Foundry/Azure portal → key blade → regenerate key one or key two independently, so the app can be repointed to the surviving key with zero downtime.
- **Content Understanding workflow**: upload/drag a document (receipt, invoice) into the Content Understanding playground → OCR extracts raw text → field-level extraction maps it to structured labels with per-field confidence scores → code sample available for integration.

## Tools, people, products & organisations

- **John Savill / Savill Technical Training** — the presenter/channel; maintains a companion site organizing prerequisite dev/AI training videos.
- **Microsoft AI-901 (formerly AI-900)** — the certification exam this video preps for; "Azure AI Fundamentals."
- **Microsoft Foundry** (ai.azure.com) — Microsoft's unified AI app/agent development platform: model catalog (10,000+ models across providers), model deployment, agent building (prompt-based and hosted), tool/knowledge integration (via MCP and Azure AI Search), and specialized AI services (Language, Speech, Vision, Content Understanding).
- **Entra ID** — Microsoft's identity provider; manages tenants, user/group/computer/agent identities, and security policies; the trust anchor for Azure subscriptions.
- **Azure Key Vault** — recommended secure storage for API keys/secrets.
- **Azure AI Search** — underlying service used to build agent "knowledge" bases.
- **MCP (Model Context Protocol)** — a standard protocol letting AI apps discover and communicate with external tools/knowledge sources, including agent-to-agent communication.
- **Model router** — a Foundry feature that automatically selects an appropriate underlying model per-request based on task complexity.
- **Azure Language** — deterministic, purpose-built text-analytics service (language detection, PII redaction, document PII redaction, text analytics for health, conversational PII redaction) shown as an alternative to using a generative model for text tasks.
- **Azure Content Understanding** — built-in document/receipt/contract extraction service with predefined and custom classifiers.
- **GPT-4/GPT-5 family, GPT-image-2** — example models deployed and used in the demos (chat completion and image generation respectively).
- **Sora** — mentioned as Microsoft/OpenAI's video generation model, in the same family as image diffusion models.
- **GitHub Copilot** — recommended as help for non-developers writing the small amount of Python needed for the exam/labs.
- **PowerShell / Python / OpenAI SDK / azure.identity SDK** — the demonstrated tooling for calling Foundry programmatically.

## Examples & use cases

- Live demo: deploying GPT-4/GPT-5 mini in Foundry with custom deployment options (data zone, regional, PTU, priority processing).
- Live demo: a prompt-based Foundry agent connected to Azure AI Search for knowledge, with MCP tool connections.
- Live code demo: "What is the capital of England?" answered plainly via API-key auth, then the same question with a system prompt ("answer like a pirate") answered via Entra auth — same underlying call, different instructed behavior.
- Live demo: NLP breakdown of "The quick brown fox jumped over the lazy dog" via a generative model (full tokenize/lowercase/stopword-removal/POS-tagging walkthrough).
- Live demo: Azure Language detecting "this is some easy text" as English (100% confidence) and a Spanish sentence as Spanish (100% confidence).
- Live demo: text-to-speech generating "Hey John, hope the AI training is going well" in the "Iris" voice; speech-to-text transcribing a pre-recorded clip "Everyone loves to take an exam."
- Live demo: GPT-image-2 generating "a cartoon of a cheeseburger that has arms and eyes and is typing on a computer" (used as a joke about the video's own thumbnail), including a second generation with a Post-it note reading "Be kind. Stay focused. Eat burgers."
- Live demo: Azure Content Understanding extracting structured fields (name, address, phone, date, line items, tax, total) with per-field confidence scores from a sample receipt and a sample invoice.
- Real-world use cases cited throughout: self-driving car safety (reliability/safety principle), meeting transcription, customer service voice agents, accessibility tooling, expense-report receipt extraction, contract-data extraction into a database.

## Claims & confidence

- Foundry's model catalog exceeds 10,000 models spanning multiple providers (Anthropic, Grok/xAI, Hugging Face, OpenAI, etc.) — **[claim]**, medium-high confidence (stated directly by presenter, matches product positioning, exact figure not independently verified here).
- Generative AI models are non-deterministic; specialized models like Azure Language are deterministic and typically cheaper — **[fact]**, high confidence (a well-established, verifiable technical property, stated plainly and repeatedly as core exam content).
- Data-zone deployment (US/Europe) constrains where inference runs, for regulatory/data-residency reasons — **[fact]**, high confidence (documented Azure Foundry deployment behavior).
- MCP is "a standard way for AI apps to talk to tools and knowledge," and MCP servers can reflect back their own capabilities — **[fact-leaning claim]**, medium-high confidence (accurately describes MCP's purpose at a high level; exact mechanism of capability-reflection not elaborated in the source).
- Multimodal (multiple modalities per model) vs multimodel (multiple models per app) is a genuine, commonly-confused distinction worth knowing for the exam — **[opinion/pedagogical framing]**, high confidence that this is the presenter's accurate teaching point, not a verifiable external fact per se.
- The AI-901 exam does not require writing complex code or architecting complex solutions, only understanding simple example code and capability mapping — **[claim]**, medium-high confidence (presenter's characterization of the exam based on presumably having reviewed the skills-measured guide; Warwick should independently check the official skills-measured PDF before treating this as certain, since exam content can shift between versions).
- Diffusion image generation works by learning to reverse progressively-added noise, then generating by denoising from pure noise in guided steps — **[fact]**, high confidence (standard, well-documented diffusion model mechanism, correctly explained).

## Caveats & source gaps

- The video is a spoken "cram" session with live, sometimes fumbling portal demos (Savill repeatedly mis-draws logos, restarts scripts, comments on his own drawing quality) — some visual/UI detail (exact menu paths, exact screen layouts) is described loosely and would need direct portal verification if Warwick ever needs to reproduce a click-path exactly.
- Pricing, exact token limits, and exact guardrail category names are shown on-screen but not read aloud in enough detail to transcribe precisely — the note reflects only what was verbally stated.
- No discussion of exam question format, number of questions, passing score, or exam cost/logistics — the source points to the official AI-901 page for that rather than stating it itself.
- No coverage of Azure AI Search internals, RAG mechanics beyond "knowledge attached to an agent," or evaluation/monitoring of deployed agents — outside this video's scope.
- The "puppy − dog + cat ≈ kitten" vector-arithmetic example is explicitly flagged by the presenter himself as a simplified, non-representative illustration (real embedding spaces are far higher-dimensional) — treat it as pedagogical, not literal.
- Some sections trail off or get cut short by the presenter moving on (e.g., "contextual image analysis" is named but barely defined before moving to the next topic) — the source itself is thin there, not a gap introduced by this note.

## What this means for Fusion247

*(Larry's interpretation — not sourced from the video.)*

- This is a certification-study source, not directly actionable product/build content for the myPKA estate — its main value is personal (if Warwick or a specialist-adjacent human is targeting the AI-901) or as a structured primer if Fusion247 ever needs a plain-English reference for Azure AI/Foundry concepts (identity model, deployment types, agent types, MCP) when integrating with Azure-hosted AI services.
- The **assistant vs. agent** distinction (turn-by-turn productivity tool vs. autonomous goal-driven automation) maps directly onto language already used in this estate's own constitution (Larry as orchestrator delegating to autonomous specialists) — useful vocabulary alignment, not a new decision.
- The **deterministic vs. generative tradeoff** (use a purpose-built deterministic service when consistency/cost matters more than flexibility) is a generally transferable engineering principle relevant to any future Fusion247 work that touches classification, extraction, or sentiment tasks — worth remembering as a default heuristic rather than reaching for an LLM every time.
- No action is implied on any live Fusion247 build from this source; it's a knowledge-base capture only.

## Key concepts & takeaways

- AI = software imitating human faculties (prediction, vision, language, creativity); ML = systems that learn patterns from data instead of being explicitly programmed.
- Assistants (human-paced, turn-based, productivity) vs. Agents (event-triggered, autonomous, goal-driven, full automation).
- Six responsible-AI pillars: fairness, reliability & safety, privacy & security, inclusiveness, transparency, accountability.
- Azure identity/resource hierarchy: Entra tenant → subscription (cost + identity-trust boundary) → resource group(s) (non-nestable) → resources (e.g., a Foundry instance).
- Microsoft Foundry = the pro-developer AI app/agent platform: model catalog + deployment options (global/data-zone/regional, PTU, priority processing, guardrails) + agents (prompt-based vs hosted) + tools (incl. MCP) + knowledge (Azure AI Search-backed).
- Auth to Foundry: Entra identity/managed identity (preferred, no secret) vs. API key (must be vaulted, never hard-coded, rotatable).
- Generative model pipeline: prompt → tokens → embeddings (high-dimensional meaning vectors) → transformer/attention processing → output.
- Multimodal (one model, several modalities) ≠ multimodel (an app chaining several distinct models).
- Deterministic specialized services (Azure Language, Content Understanding, Speech, Vision) are often more consistent, more accurate, and cheaper than a generative model for narrow, well-defined tasks — generative AI isn't always the right tool.
- Diffusion models generate images/video by learning to reverse progressive noise addition, then denoising from pure noise guided by a prompt.
- Information extraction pipeline: OCR → field/entity extraction → structured mapping (Azure Content Understanding).

## Actions & open questions

- If Warwick is actually sitting the AI-901: verify current exam logistics, question count, and pass mark directly on the official Microsoft exam page (not covered in this video) before scheduling.
- If useful later, Cairn could file a short companion "AI-900/901 skills-measured checklist" note cross-referencing Microsoft's official study guide against what this video covered, to spot any gaps this cram-style video didn't address.
- No open build/decision items for Fusion247 arise from this source — filed as reference knowledge only.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/a-yuXz_uV30/` — `tubeair-report.md` (sha256 `8736180a8023…`), `manifest.json` (sha256 `d03aa049db67…`). Preserved as captured; never edited or summarised.
