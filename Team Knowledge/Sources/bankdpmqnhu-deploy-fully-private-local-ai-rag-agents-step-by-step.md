---
source_id: bankdPmQnHU
type: source-knowledge-note
source_type: youtube_transcript
title: DEPLOY Fully Private + Local AI RAG Agents (Step by Step)
source_url: "https://www.youtube.com/watch?v=bankdPmQnHU"
video_id: bankdPmQnHU
channel: The AI Automators
published: 2025-12-15
transcript_source: auto_captions
captured_at: "2026-07-23T07:34:30+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/bankdPmQnHU/tubeair-report.md
  - Sources/_raw/bankdPmQnHU/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a hands-on build tutorial from **The AI Automators** (YouTube, "DEPLOY Fully Private + Local AI RAG Agents (Step by Step)") walking through constructing a fully local, air-gapped, multimodal Retrieval-Augmented Generation (RAG) agent using n8n, Docling, Ollama, Qdrant, and Docker. The presenter builds the system live in Cursor, ingesting a PDF (a Whirlpool fridge spec sheet, then a 112-page manual) into a chat agent that can retrieve both text and images from private documents. The single reason this matters: it is a concrete, replicable reference architecture for running RAG entirely on private infrastructure — no cloud AI provider ever sees the documents — aimed at businesses with sensitive (legal/medical/financial/client) data who need full control instead of trusting a third-party AI service.

## What the source says

### Why go local (the strategic thread)
Uploading documents to a cloud AI service means trusting that provider to keep them secure, not train on them, and not leak them in a breach. That's acceptable for most content but not for sensitive categories: legal, medical, financial, or client documents [00:00]. The presenter frames full local/air-gapped deployment as "in many ways, the future of AI in business," driven by two converging trends: local models becoming more capable, and companies wanting to reduce risk by deploying on-prem [00:27].

### What "multimodal RAG" means (the technical thread)
Multimodal RAG here specifically means retrieval across a knowledge base containing multiple data types — text documents, PDFs with embedded images/tables, audio (meeting transcripts), even video. The key differentiator versus typical RAG agents: when a PDF has an embedded image, that image itself can be retrieved and returned inside the chat response, not just surrounding text. Most AI agents, the presenter claims, only ever return text from a knowledge base — returning the actual embedded image is the differentiating capability being demonstrated [00:27].

### Docling: the document processing core
Docling is described as an open-source (MIT-licensed), IBM-created document processing library, available on GitHub with two relevant projects: the core Docling library and **Docling Serve**, an API wrapper around it that lets n8n (as orchestrator) push documents in for processing [06:29–07:something]. It ingests PDFs, Word docs, PowerPoint, images, and audio, and outputs structured markdown or JSON — preserving semantic structure (headers, tables, bullet points), extracting diagrams as searchable images (the text within diagrams remains searchable) [02:04].

Two distinct processing approaches, explicitly contrasted:
- **Standard pipeline**: a pipeline of specialized, non-generative models/algorithms that analyze layout, extract table structure, run OCR, then assemble output. Because these models are non-generative, there is no hallucination risk — text is copied out verbatim. Format-specific sub-pipelines exist (e.g., docx, PowerPoint markup parsing) [02:04].
- **VLM (vision-language model) pipeline**: breaks a document (e.g., a 100-page PDF) into pages, batch-sends each page to a VLM asking it to extract text as accurately as possible into a target format like markdown. VLMs "can be quite powerful, but because you are dealing with generative AI, you can end up with hallucinations in the extracted text." This must be weighed against the standard pipeline's OCR inaccuracies — "there is no 100% best approach," though the presenter says he personally prefers the standard pipeline for most use cases [02:04–03:something].

For fully air-gapped local VLM use, named options: IBM's Granite Docling, Small Docling, Qwen VL, Mistral (from Mistral), DeepSeek-OCR — found via ollama.com → Models → Vision filter. Cloud-based proprietary VLMs (Gemini, OpenAI, Claude) are explicitly noted as **not runnable fully locally** [04:16].

### Hardware requirements (the practical/commercial-adjacent thread)
LLMs, VLMs, and embedding models are neural networks requiring billions-to-trillions of parameters loaded into memory — beyond CPU/RAM capability, requiring a GPU [04:16–05:12]. Guidance given:
- Consumer cards (Nvidia GeForce RTX, AMD Radeon, Apple Silicon) comfortably run up to roughly **25–35 billion parameters**.
- Larger models (e.g., 70B) are loadable only with heavy quantization, at a real quality cost [05:49].
- Concurrent user count drives hardware sizing; "tokens per second is critical" because users expect ChatGPT/Claude-level response speed even from a local system — a possibly unreasonable but real expectation [05:49–06:07].
- Cited prices: Nvidia RTX 4090 ≈ **$1,600**; RTX 5090 ≈ **$2,000**, with further server build-out costs beyond that — a fixed upfront cost offset by zero ongoing cloud fees [06:07–06:29].
- **Reversal/important nuance**: you do *not* need this hardware in place to *build and test* the system. For design/testing with dummy data, cloud-hosted open-source models (Ollama Cloud, OpenRouter) can be used, letting you build the solution while separately/in parallel provisioning production air-gapped hardware [06:29].

### Docker fundamentals (explained as foundational literacy for the build)
Docker runs each application (n8n, Docling, Qdrant) in isolated containers so their differing system requirements, libraries, and languages don't conflict; they communicate only over a shared network [08:28–09:17]. Three core concepts taught explicitly:
- **Images**: static, define app code + environment.
- **Containers**: running, stateless instances of an image — deleting a container destroys any data created inside it.
- **Volumes / bind mounts**: the persistence mechanism — data (e.g., n8n workflows) must be written to a volume/bind mount to survive container deletion/recreation [09:17–09:57].
- **Docker networking**: containers can't see each other's internals and must address each other by **service name + port** (e.g., `qdrant:6333`, `docling:5001`), whereas from the host machine you use `localhost:<port>`. The video repeatedly flags this as a common trip-up point for people new to Docker, and it causes multiple live errors during the build [10:39, 21:13–21:42].
- The **Docker Compose file** orchestrates multiple services, defining volumes, ports, and environment variables together [10:39].
- Recommended tools: Docker Desktop (visual interface to images/containers/volumes) and an AI code editor (the presenter uses Cursor, also mentions VS Code and "Anti-Gravity") for troubleshooting Compose/network issues and generating commands [10:39–11:40].

### The stack assembled
n8n publishes a **self-hosted AI starter kit** (n8n + Ollama + Qdrant + Postgres via Docker Compose). The presenter forked this and added a Docling Docker Compose service, providing that fork's link in the video description [08:03]. An additional lightweight **Nginx "static files" container** is added by the presenter to serve extracted images on port 8080, which is central to how images get returned into chat [11:57 area, 14:12].

### Build walkthrough (step-by-step, condensed — full detail under Mechanisms)
1. Clone the forked starter kit repo in Cursor; inspect the Docker Compose file [11:57–12:24].
2. Copy `.env.example`, generate random keys (via OpenSSL, 32-char) for Postgres password and n8n encryption key [12:24–13:16].
3. Run `docker compose up --profile gpu-nvidia` (or the AMD/Apple Silicon equivalent) — downloads images (Docling's are notably large) and spins up containers: n8n, Postgres, Qdrant, Docling, Ollama, plus the static-files container [13:16–14:12].
4. Access each service via its port: Docling UI at `localhost:5001/ui`, Docling API docs at `/docs`; n8n at `5678`; Qdrant dashboard at `6333/dashboard`; static file server at `8080`; Postgres has no UI [14:12–15:26].
5. Set up n8n owner account locally (not n8n Cloud) [15:26–15:49]; unlock paid/gated features (e.g., pinning executions) for free via an emailed activation key [16:09].
6. Build an ingestion workflow: **Local File Trigger** watching a bind-mounted `data/shared/rag-files/pending` folder (had to switch from "watch" to **polling** mode to work on the presenter's system) [16:30–18:07]; drop a PDF in, pin the trigger's output data to avoid re-triggering during iteration [18:07–19:13].
7. **Read File node** loads the binary from disk [19:13–19:46].
8. **HTTP Request node** posts the binary (as n8n binary file, form-data field name `files`) to Docling's `/convert` endpoint — first using `image_export_mode=referenced` (saves extracted images to disk, versus `placeholder` which just drops a text stub and loses the image) [19:46–23:37]. Errors hit and fixed live: wrong host (`localhost` → must be `docling`), wrong body param type (string → n8n binary file) [21:13–22:20].
9. Images land in a Docling scratch folder (shared bind mount); a **Code node** (JS, generated by prompting Cursor/Claude with the JSON input structure) extracts the array of image names; **Split Out** node iterates them; an **Execute Command node** runs a shell `mv` command per file to move each image from Docling's scratch folder into the Nginx static-files folder (`extracted-images`) so they become web-servable [23:37–29:13].
10. Nginx static-files container is reconfigured (bind-mount root narrowed to `shared/extracted-images` only) and recreated via `docker compose down` + `up -d` (detached mode) to pick up the new config — demonstrating that containers can be destroyed/rebuilt without losing n8n workflow state, because that's on its own persistent volume [24:38–25:35].
11. **Qdrant vector store node** ("Add Documents") — collection created manually via the Qdrant dashboard, named `multimodal_rag`, using **dense vectors**, embedding dimension **768**, **cosine similarity** [29:37–31:43].
12. **Embedding model**: `nomic-embed-text` served via local Ollama — had to be pulled manually inside the Ollama container (`ollama pull nomic-embed-text`) via Docker's exec console since it isn't bundled by default (only Llama 3.2 is) [31:43–33:20].
13. **Document loader**: custom recursive character text splitter, split code = markdown (to retain structure), chunk size reduced to ~700 [33:20–33:43].
14. Running ingestion populated 19 vector points for the one-page PDF; Qdrant's dashboard "visualize" view shows point clustering/graph relationships [33:43–34:44].
15. **Chat trigger + AI Agent node**: model = local Ollama Llama 3.2 (small, default-bundled) → Qdrant added as a **tool** ("use this to fetch information from the knowledge base," limit 5 results) plus the same embedding model attached; system prompt seeded from n8n's built-in Q&A-chain prompt template ("don't make things up") plus an explicit added instruction to output images in markdown using the retrieved URL [34:44–36:17].
16. **Bug found and fixed**: images returned as broken links because the ingested markdown only contained relative image *names*, not full URLs. Fixed by adding another Cursor-generated Code node that regex-injects the full Nginx URL (`http://localhost:8080/...`) into the markdown before embedding [36:17–38:23]. Required wiping and recreating the Qdrant collection via HTTP DELETE/PUT endpoints (a documented destructive-but-convenient dev-only shortcut) [38:23–39:19].
17. Re-tested: Llama 3.2 (a 3-billion-parameter model) successfully called the vector store tool and returned a working image URL — the presenter expresses surprise at this given small models' typical unreliability at tool-calling, but cautions that reliability across repeated identical queries is unproven [39:19–40:40].

### Cloud fallback models (reversal: local isn't the only viable path during dev)
Ollama Cloud and OpenRouter are used to swap in larger/better hosted open-source models (GPT-OSS-20B, Qwen3-32B) without owning GPU hardware, explicitly framed as how to prototype now and defer hardware purchase until the right model is identified [40:40–43:53]. Observed model behavior differences: GPT-OSS-20B is "lightning fast" on Ollama Cloud but has "such a tendency to output tables... which doesn't really work in a chat interface" [42:34–43:16]; Qwen3-32B via OpenRouter produced clean output with images and no unwanted tables [43:53].

### Scaling to a large document + async processing (technical thread)
A 112-page manual is ingested; the presenter notes this is where the **async** Docling endpoint (return a task ID, then poll) would make more sense than synchronous waiting, given processing took 46 seconds and produced 269 extracted images [43:53–44:41]. Off-camera, the presenter built (and shows briefly): an async polling loop (poll status every 3s, fetch on success, error on failure), automatic move of the source file into a `processed` folder to keep `pending` clear, and Docling's **picture description API** (VLM-based image captioning of embedded diagrams, with image-size controls) — noting smaller VLMs like Granite 3.2 Vision gave weak results on general-purpose images (not what they're optimized for) [44:41–46:24].

### The AI Automators' own production system (commercial/strategic thread — explicitly a teaser, not detailed)
The presenter describes (without full technical detail) their community's "state-of-the-art local RAG system": file-type-specific ingestion tracks, a record manager, knowledge graphs, tabular-data handling, document-hierarchy extraction, and contextual vector embeddings for context expansion. This is positioned as more advanced than what's built in the video, and access is gated behind joining **The AI Automators** community (paid, referenced twice in the video as a call-to-action) [46:24].

### Publishing the agent as a webpage (operational thread)
Rather than building a custom UI, the presenter embeds n8n's built-in chat widget into a static HTML page (generated via a Cursor prompt), served from the same Nginx container root [46:24–48:04]. Steps: make the n8n chat workflow publicly available with an embedded-chat URL and no auth (justified as fine since it's local-only); activate the workflow; fix Nginx config so the site root (`localhost:8080`) redirects to `chat.html` instead of a file index [48:04–49:31]. Styling from the first AI-generated pass is explicitly called out as poor ("I would not define as beautiful... definitely some iterations needed") [47:59].

### Local network exposure (operational/reversal thread)
A dedicated explanation of what's needed to let *other machines* on the local network reach the chat, beyond the host itself: hitting the machine's actual local IP (not `localhost`/`127.0.0.1`) at the relevant ports (8080 for chat, 5678 for the n8n agent); opening inbound firewall rules (Windows firewall blocks arbitrary inbound ports by default); assigning a **static local IP** (since DHCP-assigned IPs change on reboot, which would break access); and, for larger/more complex organizational networks, involving IT/comms for additional network configuration. The server also needs to stay powered on (at least during business hours) for the chatbot to be reachable [49:31–51:23].

## Mechanisms, methods & implementation detail

- **Docker Compose profiles**: GPU vendor-specific profiles (`gpu-nvidia`, and presumably AMD/Apple equivalents) select which hardware-acceleration config to bring up [13:16].
- **Bind mount path mapping**: host folder → container path `data/shared` — this exact path string must be used consistently across the Local File Trigger, Read File node, and any Execute Command move operations, since it's fixed by the Compose file's volume definition [16:30, 28:24].
- **Node-level debugging pattern used throughout**: pin a node's output data once real input is available, so repeated workflow executions don't require re-triggering the original external event (e.g., re-dropping a file) [19:13].
- **AI-assisted node authoring pattern**: for n8n Code nodes, copy the actual JSON output of the upstream node plus a "skeleton" of the code node's expected shape into an AI coding assistant (Cursor/Claude), and ask it to write the transformation — explicitly recommended as "a really good hack" because the assistant needs to see n8n's actual item/data structure to write correct code [26:19–27:27].
- **Context management practice**: the presenter opens a *new* chat in Cursor per discrete task rather than continuing one long thread, citing "context rot" degrading response quality over a long conversation [37:20].
- **Vector collection reset shortcut**: HTTP DELETE then PUT against Qdrant's collection endpoints, wired as n8n HTTP Request nodes, to avoid manually deleting/recreating collections through the dashboard during iterative dev — explicitly flagged as "very destructive... only to be used when actually building out your system" [38:23–39:19].
- **Image URL rewriting**: a regex-based Code node injects the full `http://<host>:8080/...` prefix onto bare image filenames in the markdown/JSON before it's chunked and embedded, since the embedded chunks must contain a fully resolvable URL for the chat UI to render the image [37:20–38:04].
- **Async polling loop (described, not built on-screen)**: submit to Docling's async convert endpoint → get task ID → wait N seconds (3s) → check task status → on success fetch/process result, on "still processing" loop back, on error stop [44:41].

## Tools, people, products & organisations

- **The AI Automators** — the channel/community publishing this video; sells/offers access to a more advanced proprietary local RAG system via community membership.
- **n8n** — workflow automation tool used as the RAG orchestrator (ingestion pipeline + chat agent); publishes an official "self-hosted AI starter kit" Docker Compose bundling n8n+Ollama+Qdrant+Postgres.
- **Docling** — IBM's open-source (MIT) document processing library; converts PDFs/Office docs/images/audio into structured markdown/JSON via either a non-generative standard pipeline or a VLM pipeline. Has a companion **Docling Serve** API wrapper.
- **Ollama** — local LLM/embedding-model runtime; also offers **Ollama Cloud** (hosted inference with an API key, e.g., for GPT-OSS-20B) as a way to test without local GPU hardware.
- **OpenRouter** — aggregator giving access to many open-source models (e.g., Qwen3-32B) for testing/comparison.
- **Qdrant** — the vector database used for storing embeddings and serving as the agent's retrieval tool; has its own dashboard (collections, visualize, graph view).
- **Postgres** — included in the starter kit stack (used by n8n internally); no UI shown.
- **Docker / Docker Desktop** — containerization platform; Docker Desktop recommended as a visual interface to images/containers/volumes.
- **Cursor** (with Claude Opus 4.5 / "Claude 3 Opus" as referenced by the presenter) — the AI code editor used throughout to write Code-node JavaScript, fix Docker Compose/Nginx configs, and build the chat webpage; VS Code and "Anti-Gravity" mentioned as alternatives.
- **Nginx** — run as a minimal static file server container to host extracted images and, later, the embedded chat webpage.
- **nomic-embed-text** — the local embedding model (via Ollama) used for vectorization; 768-dimension variant selected (per Nomic's own published dimension options for v1.5).
- **Named LLMs/VLMs referenced**: Llama 3.2 (3B, default local model), GPT-OSS-20B (cloud, ~4090-class size), Qwen3-32B, IBM Granite Docling / Granite 3.2 Vision, Small Docling, Qwen VL, Mistral, DeepSeek-OCR, plus cloud-only VLMs Gemini/OpenAI/Claude (noted as not locally runnable).
- **Hardware referenced**: Nvidia RTX 4090 (~$1,600), RTX 5090 (~$2,000); AMD Radeon and Apple Silicon mentioned as alternative but similarly capacity-limited platforms.
- **Puppeteer** — mentioned as the underlying mechanism letting Cursor's agent mode simulate browser actions while iterating on the chat webpage's front-end styling.

## Examples & use cases

- **Example document 1**: a one-page Whirlpool refrigerator spec sheet — used as the initial test bed; contains at least one embedded diagram/table.
- **Example document 2**: a 112-page appliance user manual — used to test larger-scale ingestion (46-second processing time, 269 extracted images) and to demonstrate async-appropriate scale.
- **Example queries run against the agent**: "Show me the cabinet opening diagram" (retrieved a broken image link, then a working one after the URL fix) and "Show me how to use the ice and water dispenser" (returned instructions plus correctly rendered images).
- **Deployment scenario**: publishing the finished agent as a webpage reachable by other devices on the same local office network, with the associated firewall/static-IP/uptime requirements.

## Claims & confidence

- Cloud AI providers pose real risk to sensitive document categories (security, training use, breach exposure) — [opinion/claim, high confidence as an industry-standard concern, not independently verified in-video] [00:00]
- Docling's standard pipeline uses non-generative models and therefore cannot hallucinate extracted text — [claim, presented as fact by the presenter, plausible given non-generative-model architecture, not independently verified] [02:04]
- VLM-based extraction can hallucinate; OCR-based (standard pipeline) extraction can be inaccurate; neither is a universally superior approach — [opinion, stated as the presenter's judgment] [02:04–04:16]
- Cloud proprietary VLMs (Gemini, OpenAI, Claude) cannot be run fully locally — [fact, verifiable/well-known] [04:16]
- Consumer GPUs (RTX-class, Apple Silicon, Radeon) comfortably run up to ~25–35B parameter models; 70B is possible only with heavy quantization and real quality loss — [claim, presenter's practical experience-based estimate, not a formal benchmark] [05:12–05:49]
- RTX 4090 ≈ $1,600, RTX 5090 ≈ $2,000 — [fact, pricing at time of recording; subject to change] [06:07–06:29]
- You can prototype/build a local RAG system using cloud-hosted open-source models before owning production GPU hardware — [claim/practical advice, high confidence, directly demonstrated in-video via Ollama Cloud/OpenRouter] [06:29, 40:40]
- Llama 3.2 (3B) successfully performed tool-calling and returned a correctly formatted image URL in this specific test — [fact as observed live], but presenter explicitly caveats reliability across repeated queries is unverified — [opinion/uncertainty flagged by presenter himself] [39:19–40:40]
- GPT-OSS-20B tends to over-produce markdown tables in chat-style output — [opinion/observation, single-source, not a documented model spec] [43:16]
- The AI Automators' own advanced RAG system (knowledge graphs, contextual embeddings, record manager, etc.) is "state-of-the-art" — [opinion/marketing claim by the presenter about their own paid product; not demonstrated in technical detail in this video] [46:24]
- Windows firewall blocks arbitrary inbound ports by default; DHCP-assigned local IPs are not stable across reboots — [fact, standard networking behavior] [51:23]

## Caveats & source gaps

- The video is a **product/community teaser as well as a tutorial**: the presenter's own "state-of-the-art" production RAG system (knowledge graphs, record manager, contextual embeddings, tabular-data handling) is described only at a high level with zero implementation detail — it is explicitly gated behind paid community membership. Treat that portion as marketing, not a technical spec.
- No performance benchmarking is shown beyond a single 46-second/112-page/269-image processing run and qualitative "lightning fast" impressions of cloud models — no systematic token/sec, accuracy, or cost comparison across the named models.
- The presenter repeatedly flags his own build as **rough/non-production**: no memory on the chat agent, ugly/un-iterated front-end styling, small default LLM (Llama 3.2) of limited reliability, and manual/destructive Qdrant collection resets used only for dev convenience.
- No security hardening is discussed beyond "no API key needed because it's local" — for anything beyond a single trusted local network, authentication, TLS, and access control are out of scope of this video.
- The reason `docker compose up` required switching from "watch" to "polling" mode for the local file trigger on the presenter's system is not explained (attributed vaguely to "for whatever reason on my local system") [16:30] — a genuine gap, not elaborated.
- The forked GitHub repo (starter kit + Docling addition) is referenced multiple times as "link in the description" but the actual URL is not stated in the transcript — cannot be captured here without inventing it.
- No cost/ROI analysis is given for local vs. cloud RAG beyond the GPU price points and the general "no ongoing cloud fees" framing — no discussion of ongoing operational cost (power, maintenance, model-update effort) of a self-hosted system.

## What this means for Fusion247

*(Interpretation — not in the source.)*

- This is a directly relevant reference architecture for anything in the Fusion/myPKA stack that should stay fully local or air-gapped for privacy reasons — e.g., if a future build ever needs to keep client-delivery documents, AsdAIr household data, or other personal-data-never-public-repo material out of any cloud LLM path entirely, this Docling+Ollama+Qdrant+n8n pattern is a concrete, working template rather than a hypothetical.
- The Docker networking gotcha (service-name vs. localhost addressing) and the bind-mount/volume persistence model are exactly the class of infrastructure detail that has bitten past Fusion247 builds (per [[build-002-runtime-on-this-machine]] and general Tower/Directus container work) — worth keeping as a checklist item if any future local-Docker service is stood up.
- The "prototype on cloud-hosted open models, defer local hardware purchase" pattern maps well onto Fusion247's existing practice of using cloud APIs (Claude, GPT) during build/design and only hardening toward stricter isolation once a design is proven — consistent with [[hobby-brain-threat-model-bar]] (don't over-invest in infra before the use case is validated).
- The AI-assisted "copy the node's JSON + a skeleton into Cursor" technique for writing n8n Code nodes is a transferable prompting pattern, not unique to this stack — could apply to any future n8n-adjacent automation work Fusion247 does (e.g., Tower baton, FusionDevBot).
- This video does **not** materially change or challenge the Brain/graph architecture direction (Neo4j/LightRAG per [[idea-007-obsidiwikai-build]]) — it's a different, simpler local-RAG pattern (Qdrant, file-based) aimed at document Q&A rather than a knowledge graph, so it's a sibling reference, not a competing direction.
- No action is implied unless Warwick is actively considering a fully air-gapped/local deployment for a specific sensitive-data use case — otherwise this is background technical literacy, filed for retrieval when that need arises.

## Key concepts & takeaways

- **Multimodal RAG** = retrieval that can return non-text artifacts (images, tables) alongside text, not just text search over a knowledge base.
- **Docling's two extraction paths** — non-generative "standard pipeline" (verbatim, no hallucination risk, imperfect OCR) vs. generative "VLM pipeline" (flexible, can hallucinate) — is a reusable framework for evaluating *any* document-ingestion tool choice, not just Docling.
- **Docker's three persistence/isolation primitives** (image/container/volume-or-bind-mount) plus the service-name-vs-localhost networking rule are foundational and repeatedly the source of live errors in the video — a strong signal these are the highest-friction points for anyone replicating this.
- **Build now on cloud models, harden to local hardware later** is presented as the pragmatic sequencing for local-AI projects — decouples solution design from infrastructure procurement.
- **Small local models can be surprisingly capable at tool-calling** but reliability is unproven without repeated testing — don't assume single-success implies robustness.
- Publishing an n8n-based agent to a local network is a real but non-trivial step (firewall, static IP, uptime, possible IT involvement) — distinct from just getting the agent running on one machine.

## Actions & open questions

- If Fusion247 ever needs a genuinely air-gapped document-Q&A capability (e.g., for AsdAIr household data or any future client-delivery material barred from cloud LLMs), this stack (n8n + Docling + Ollama + Qdrant + Nginx) is a candidate starting template — worth bookmarking rather than acting on now.
- Open question: is there a Fusion247 use case where the "return the actual embedded image, not just text" capability would matter (e.g., diagrams in technical docs, screenshots in captured sources)? Current ObsidiWikAi/Brain pipeline should be checked against whether it already handles this or drops embedded images.
- No immediate action required — file as a technical reference note; revisit if a local/air-gapped requirement materializes.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/bankdPmQnHU/` — `tubeair-report.md` (sha256 `1735838860cc…`), `manifest.json` (sha256 `7df22a4d8d91…`). Preserved as captured; never edited or summarised.
