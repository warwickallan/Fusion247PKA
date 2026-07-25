---
title: ObsidiWikAi (IDEA-007) — Cutting OpenAI cost on full-transcript extraction
author: Pax (Senior Researcher)
date: 2026-07-23
audience: Larry / Warwick — infra + model-routing decision
decision: which model(s) run LightRAG entity/relation extraction so a full YT transcript costs pennies-or-free
status: research complete (Correction & Gateway Validation appended same day)
related: [[2026-07-22-pax-obsidiwikai-architecture-brief]]
---

# Making full-transcript extraction affordable

> **READ THE "Correction & Gateway Validation" SECTION AT THE BOTTOM FIRST.** The £10 anchor this section was built on was wrong (real spend ≈ £0.60). There is no cost emergency and no forced migration. The live decision is now a *swappable-model gateway* (LiteLLM), not Qwen-vs-OpenAI. The material below is retained for the model-flexibility facts, which still hold.

## Executive summary (superseded on economics — see correction)

The £10 blow-up is **the extraction LLM, not embeddings, and not retrieval.** LightRAG deep-indexing runs the extraction model over *every chunk with a large prompt plus gleaning passes plus description-summarisation*, which amplifies a ~24k-token transcript into roughly **0.5–2M effective LLM tokens** — at premium-OpenAI rates that is ~£10. **The single highest-leverage change is to point LightRAG's extraction (and keyword) LLM at a cheap Qwen endpoint via a `base_url` override.** LightRAG v1.5.x supports this natively — any OpenAI-compatible endpoint, and Ollama — with per-role models, so it is a **drop-in env-var change, not a fork.** Expected result: **the same deep-index drops from ~£10 to roughly £0.20–£0.50** (Qwen2.5-72B via DeepInfra/OpenRouter) or **~£0.03–0.05** (Qwen2.5-7B), with equal-or-better *structured-extraction reliability* at the 32B/72B tier. Local Ollama on the CX33 is correctly forbidden by the ADR (no GPU, 4 shared vCPU → hours per transcript). Do **not** chase local inference to save pennies when a cheap API already gets you there reliably.

**Ranked recommendation: (1) drop-in cheap Qwen API for extraction+keyword, keep OpenAI only for optional query synthesis (the "hybrid"); (2) full Qwen incl. a self-hostable embedding model if you want zero OpenAI dependency; (3) local Ollama on the Yoga as a $0 batch fallback; reject local-on-CX33 and reject a GPU box at this budget.**

Confidence: **High** = multiple independent sources / primary docs; **Medium** = one primary + secondary; **Low** = single/contested.

---

## Q1 — LightRAG model flexibility (v1.5.4) — **High confidence**

LightRAG is provider-agnostic by design and lets you bind **each role independently** (extract / keyword / query LLM, and embeddings):
- **Any OpenAI-compatible endpoint via `base_url` override.** LightRAG's OpenAI path (`openai_complete_if_cache` / `openai_embedding`) accepts a `base_url` + `api_key`; the server exposes this as **`LLM_BINDING=openai`** with **`LLM_BINDING_HOST`** (the base URL, e.g. `https://api.deepinfra.com/v1/openai` or `https://openrouter.ai/api/v1` or Alibaba DashScope's compatible endpoint) and **`LLM_BINDING_API_KEY`**, plus **`LLM_MODEL`**. This is the drop-in: any Qwen host that speaks the OpenAI schema works with zero code change. [DeepWiki — LLM & Embedding Integration](https://deepwiki.com/HKUDS/LightRAG/6-llm-and-embedding-integration) · [LightRAG API Server README](https://github.com/HKUDS/LightRAG/blob/main/lightrag/api/README.md)
- **Native Ollama binding.** `llm_model_func=ollama_model_complete`, `llm_model_name="qwen2.5:7b"`, `llm_model_kwargs={"host": "http://localhost:11434", "options": {"num_ctx": ...}}`; embeddings via `EmbeddingFunc(embedding_dim=..., func=ollama_embedding(..., embed_model="bge-m3", host=...))`. Server binding names include `openai`, `ollama`, and mixed **`openai-ollama`** (OpenAI LLM + Ollama embeddings). [DeepWiki — Configuration & Binding](https://deepwiki.com/HKUDS/LightRAG/6.3-embedding-models) · [StableLearn LightRAG guide](https://stable-learn.com/en/lightrag-introduction/) · [davidgao7 — Local RAG with Ollama](https://davidgao7.github.io/posts/local-rag-ollama/)
- **Per-role models** are a documented feature ("Role-Specific LLM Configuration") — you can send extract to cheap Qwen and keep query on OpenAI. Config precedence: CLI args > env vars > `.env` > dataclass defaults.
- **Embedding caveat:** `EmbeddingFunc` carries an explicit **`embedding_dim`** that must match the model. Changing embedding model → different dimensions → **full re-index** (see Q5).

**GO** — LightRAG needs no modification; this is env-var routing. *Verify on the pinned v1.5.4 tag:* confirm `LLM_BINDING_HOST`/`LLM_BINDING_API_KEY` env names in that tag's `lightrag/api` (naming has shifted across releases) with one smoke call before wiring it in.

---

## Q2 — Cheap Qwen via API — **High confidence (pricing), Medium (per-job estimate)**

All prices per **1M tokens**, USD; £ at ~$1 = £0.79. All these hosts expose an **OpenAI-compatible endpoint** → drop-in for LightRAG (Q1).

| Model / host | Input $/1M | Output $/1M | OpenAI-compatible? | Source |
|---|---|---|---|---|
| **Qwen2.5-7B-Instruct** — OpenRouter | ~$0.04 | ~$0.10 | Yes | [OpenRouter](https://openrouter.ai/qwen/qwen-2.5-72b-instruct) |
| **Qwen2.5-32B-Instruct** — DeepInfra/OpenRouter | ~$0.15–0.30 | ~$0.20–0.40 | Yes | [DeepInfra Qwen guide](https://deepinfra.com/blog/qwen-api-pricing-2026-guide) |
| **Qwen2.5-72B-Instruct** — DeepInfra | ~$0.13–0.23 (blended) | — | Yes | [DeepInfra](https://deepinfra.com/blog/qwen-api-pricing-2026-guide) |
| **Qwen2.5-72B-Instruct** — OpenRouter | $0.36 | $0.40 | Yes | [OpenRouter](https://openrouter.ai/qwen/qwen-2.5-72b-instruct) |
| **Alibaba DashScope (official Qwen)** | comparable, region-priced | — | Yes (compat endpoint) | [DeepInfra guide (context)](https://deepinfra.com/blog/qwen-api-pricing-2026-guide) *(Medium — DashScope's own page not directly triangulated)* |
| **OpenAI (current box config)** — observed | — | — | native | Warwick's empirical **~£10 / transcript** *(WRONG — see correction; real ≈ £0.60)* |

**Per-transcript estimate.** *(This block was reverse-engineered from the false £10 anchor. See "Recomputed economics" in the correction section — real OpenAI ≈ £0.60, so the recomputed Qwen figures below are much closer to OpenAI than shown here.)* Reverse-engineering the observed £10: a ~24k-token transcript deep-indexes into roughly **0.5–2M effective tokens** (per-chunk extraction prompt + gleaning + description summarisation). Applying the table:

| Extraction model | Est. cost for one deep-index (~1M eff. tokens) | Multiple vs (false) £10 |
|---|---|---|
| OpenAI (current) | ~~£10~~ **≈£0.60 (corrected)** | — |
| Qwen2.5-72B (DeepInfra) | ~£0.15–0.40 | see recompute |
| Qwen2.5-32B (DeepInfra) | ~£0.15–0.30 | see recompute |
| Qwen2.5-7B (OpenRouter) | ~£0.03–0.08 | see recompute |

The **per-token pricing is verified**; the per-job £ figure is an estimate. Qwen2.5-72B "roughly 1/10th the price of GPT-4o while matching math/coding scores" is the widely-cited price/perf anchor. [DeepInfra guide; OpenRouter]

**GO** — Qwen via DeepInfra or OpenRouter is a genuine drop-in. *(But see correction: with real spend ≈ £0.60, migration is optional, not urgent.)*

---

## Q3 — Local Ollama feasibility — **High confidence**

**CX33 (4 vCPU / 8 GB / no GPU): not viable — the ADR is correct.**
- Qwen2.5-7B Q4 is ~4.7 GB — it *fits* in 8 GB only if little else is resident, but the CX33 already runs Neo4j + Redis + Directus + the gateway; you'd be RAM-starved.
- CPU-only speed: benchmarks show ~45 tok/s on a **56-core Xeon**, but ~8 tok/s on older server CPUs, and a **shared 4-vCPU cloud instance is at the bottom of that range (realistically ~2–6 tok/s).** [CEUR llama.cpp CPU paper](https://ceur-ws.org/Vol-4164/paper11.pdf) · [Singh LLM speed benchmarks](https://singhajit.com/llm-inference-speed-comparison/)
- A deep-index emits large volumes of *output* tokens. At ~4 tok/s, tens of thousands of output tokens = **hours per transcript.** Unusable. Correctly ruled out.

**Yoga (Lenovo, ~12 GB soldered, no GPU): viable only as an occasional $0 batch host.**
- 12 GB fits Qwen2.5-7B Q4 comfortably; still CPU-only → ~5–10 tok/s. One transcript = minutes-to-tens-of-minutes, tolerable for *offline/overnight batch* but not interactive, and it's the ops laptop (availability-limited). Fine as a **free fallback**, not the primary path.

**Minimum viable GPU host:** a Hetzner GPU/dedicated box runs Qwen2.5-7B/32B at 30–80+ tok/s, but costs **~€180+/mo** — 12×+ the £10–15 infra budget. **Reject at current budget/volume.**

**Verdict:** local inference does not beat a cheap API here.

---

## Q4 — Quality tradeoff (the important one) — **High confidence, counter-intuitive**

Small models are the weak link for **structured** KG extraction *regardless of vendor* — and mid-size Qwen may be **better than a small OpenAI model** here:
- A text-to-graph benchmark found **GPT-4o-mini "consistently <40% reliability" with invalid-JSON structural failures and high hallucination — "unusable for complex graph extraction,"** while **Qwen-class 32B and Mistral Small 3.2 hit up to 99.95% reliability** for KG extraction. [Lettria — Benchmarking Text-to-Graph](https://www.lettria.com/benchmarks/benchmarking-text-to-graph)
- On IE benchmarks, Qwen2.5-32B is a strong general extractor (beaten only by *specialised* fine-tuned extractors). [GraphMERT arXiv 2510.09580](https://arxiv.org/pdf/2510.09580) · [Graphusion arXiv 2410.17600](https://arxiv.org/pdf/2410.17600)
- GraphRAG-specific reasoning benchmarks show small models "select answers by conjecture/pattern-matching" — a size problem, not a vendor problem. [GraphRAG-Bench arXiv 2506.02404](https://arxiv.org/pdf/2506.02404)

**Where quality drops:** below ~7B, structured/JSON reliability and relation precision fall off; Qwen2.5-**7B** is the risk zone. **Qwen2.5-32B is the sweet spot**; **72B** for maximum recall. Don't assume "OpenAI = higher quality" for structured extraction — model *size/tier* dominates.

---

## Q5 — Embeddings alternatives — **High confidence.** Lower priority: embeddings were NOT the blow-up.

Switching the embedding model changes vector dimensions → **full re-index**. **Do it NOW if at all** — at walking-skeleton scale (1 URL) the re-index is free.

| Model | Dim | MTEB (approx) | Host | Notes |
|---|---|---|---|---|
| **text-embedding-3-large** (current) | 3072 | ~64.6 | OpenAI API | high dim = more storage; the *cheap* part of the pipeline |
| **bge-m3** | 1024 | ~63 (dense) | Ollama / self-host, free | strong multilingual, hybrid; common LightRAG pairing |
| **Qwen3-Embedding-0.6B/4B** | 1024 / 2560 | 70.7 / 74.6 | Ollama / API | **best MTEB of the group**, flexible dims |
| **nomic-embed-text v1.5** | 768 | ~62.3 | Ollama, 274 MB, free | smallest/lightest; fine for personal scale |

Sources: [Morphllm — Ollama embedding models 2026](https://www.morphllm.com/ollama-embedding-models) · [Milvus — best embedding model for RAG 2026](https://milvus.io/blog/choose-embedding-model-rag-2026.md) · [Qwen3-Embedding arXiv 2506.05176](https://arxiv.org/pdf/2506.05176) · [BentoML — open-source embedding models 2026](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)

**Recommendation:** embeddings are **cheap and were not the cost problem** — optional. Embeddings are light enough to run CPU-only on the CX33 (unlike generation). Keep 3-large, or switch to bge-m3/Qwen3 *now while the graph is empty* if eliminating OpenAI entirely.

---

## Q6 — Net recommendation (ranked) *(economics superseded — see correction)*

**1. Hybrid drop-in.** Extract+keyword → Qwen2.5-32B via DeepInfra/OpenRouter; keep query synthesis on OpenAI; keep text-embedding-3-large. Env vars only.
**2. Full-Qwen, zero OpenAI.** As #1 plus switch embeddings (accept one-time re-index — free now).
**3. Local Ollama on the Yoga — $0 batch fallback.** Situational.
**4. Local on CX33 — REJECT.** **5. GPU box — DEFER/REJECT at this budget.**

## The 3 things to verify by doing
1. On **v1.5.4**, confirm exact env names (`LLM_BINDING`, `LLM_BINDING_HOST`, `LLM_BINDING_API_KEY`, `LLM_MODEL`) + clean extraction JSON through one chunk.
2. Run **one full transcript on Qwen2.5-32B**; record actual £ + quality vs OpenAI.
3. Decide the **embedding question now** before the graph grows past the free-re-index window.

## Methodology & limitations
Pricing triangulated across OpenRouter, DeepInfra, and comparison aggregators (July 2026); CPU-speed from a llama.cpp CPU paper + independent benchmarks; quality from a text-to-graph benchmark + KG-extraction arXiv papers; LightRAG config from DeepWiki + the API-server README. **Limits:** (1) the £10 anchor was wrong (see correction). (2) DashScope/Together specific rates not directly triangulated (Medium). (3) v1.5.4 env-var names must be confirmed on the tag.

## Sources
- [DeepWiki — LightRAG LLM & Embedding Integration](https://deepwiki.com/HKUDS/LightRAG/6-llm-and-embedding-integration) · [DeepWiki — Configuration & Binding / Embedding models](https://deepwiki.com/HKUDS/LightRAG/6.3-embedding-models) · [LightRAG API Server README](https://github.com/HKUDS/LightRAG/blob/main/lightrag/api/README.md) · [StableLearn LightRAG guide](https://stable-learn.com/en/lightrag-introduction/) · [davidgao7 — Local RAG with Ollama](https://davidgao7.github.io/posts/local-rag-ollama/)
- [OpenRouter — Qwen2.5-72B pricing](https://openrouter.ai/qwen/qwen-2.5-72b-instruct) · [DeepInfra — Qwen API pricing guide 2026](https://deepinfra.com/blog/qwen-api-pricing-2026-guide) · [PricePerToken — DeepInfra vs OpenRouter](https://pricepertoken.com/endpoints/compare/deepinfra-vs-openrouter)
- [CEUR — Deploying LLMs on CPU-only with llama.cpp](https://ceur-ws.org/Vol-4164/paper11.pdf) · [Singh — LLM inference speed benchmarks](https://singhajit.com/llm-inference-speed-comparison/) · [Qwen2.5-7B GGUF (llama.cpp quant)](https://huggingface.co/SimmonsSongHW/Qwen2.5-7B-Instruct-GGUF)
- [Lettria — Benchmarking Text-to-Graph](https://www.lettria.com/benchmarks/benchmarking-text-to-graph) · [GraphRAG-Bench arXiv 2506.02404](https://arxiv.org/pdf/2506.02404) · [GraphMERT arXiv 2510.09580](https://arxiv.org/pdf/2510.09580) · [Graphusion arXiv 2410.17600](https://arxiv.org/pdf/2410.17600)
- [Morphllm — Ollama embedding models 2026](https://www.morphllm.com/ollama-embedding-models) · [Milvus — best embedding model for RAG 2026](https://milvus.io/blog/choose-embedding-model-rag-2026.md) · [Qwen3-Embedding arXiv 2506.05176](https://arxiv.org/pdf/2506.05176) · [BentoML — open-source embedding models 2026](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)

---

# Correction & Gateway Validation (appended 2026-07-23)

## Recomputed economics — there is no cost emergency

The £10 anchor was **wrong** (loaded credit, not spend). Real measured deep-index of one ~24k-token transcript on `gpt-5-mini` extraction ≈ **£0.60**. That reframes everything:
- **£0.60/transcript is already "pennies."** There is **no cost emergency and no forced migration.** My earlier £0.15–0.40 Qwen figures were reverse-engineered from the false £10, so they overstated the *absolute* saving.
- **Recompute from ≈£0.60.** `gpt-5-mini` is itself a *small, cheap* model, in the same price tier as Qwen2.5-32B (small-OpenAI ≈ Qwen-mid on $/M). So the SAME job on:
  - **Qwen2.5-32B (DeepInfra ~$0.15–0.30/M):** ≈ **£0.15–0.45** — *roughly level with OpenAI, maybe a bit cheaper.* Not a compelling saving on its own.
  - **Qwen2.5-7B (OpenRouter ~$0.04/M):** ≈ **£0.08–0.20** — a real ~3–7× cut, but the 7B quality/reliability risk from Q4 applies.
  - **72B:** ≈ **£0.20–0.55** — level-to-slightly-above OpenAI.
- **Verdict on the model question: the economic case for migrating to Qwen has mostly evaporated.** At £0.60/transcript the lever isn't "save money on Qwen," it's **(a) token-amplification hygiene** (fewer gleaning passes, smaller chunks-overlap, cache) — the biggest real cost lever — and **(b) never getting surprised again** through *metering*. Confidence: **High** on the reframing; the recomputed £ are ranges (real gpt-5-mini $/M not independently priced).

## The real decision: a swappable-model gateway, not a model choice

Correct framing. ObsidiWikAi should ask for **stable roles** — `fusion.extract / fusion.keyword / fusion.query / fusion.reason / fusion.embed` — and a provider-neutral boundary maps each role → (provider, model) via config. **LiteLLM is the right, non-bespoke boundary for this.** Validation below.

### Q1 — LiteLLM footprint + co-residence on the CX33 — **GO with guardrails. High confidence.**
- **It's a router, not an inference engine** — Debian `python:3.12-slim`, no model weights. Measured **~400 MB idle** for a full stack (LiteLLM + Postgres 16 + Caddy) on a 4 vCPU / 8 GB box; common Docker mem-limit is **2 GB**. [hwdsl2/docker-litellm](https://github.com/hwdsl2/docker-litellm) · [Apify self-host guide](https://use-apify.com/docs/self-hosted/ai/litellm) · [Nerd Level Tech production tutorial](https://nerdleveltech.com/litellm-proxy-production-llm-gateway-tutorial)
- **Known RAM-creep bug:** RAM climbs over days and isn't released until container restart. [BerriAI/litellm #12685](https://github.com/BerriAI/litellm/issues/12685) → **mitigate with a hard mem-limit + Coolify healthcheck/auto-restart (or a nightly restart).** Cheap to neutralise.
- **Co-residence on the CX33 (already Neo4j + Redis + Directus + LightRAG on 8 GB):** feasible but **8 GB is getting crowded** — Neo4j alone wants 1–2 GB+. Run LiteLLM with a **512 MB–1 GB cap** and watch headroom; if it squeezes Neo4j, that's the signal to move LiteLLM to fusion247-core / its own small box.
- **Single point of failure:** yes — all model calls flow through it. Mitigations LiteLLM ships: **provider fallbacks + `num_retries` + cooldowns** (failover *between* providers). For the proxy *itself* being down, rely on Coolify restart + mem-limit; at single-user hobby scale a brief outage is tolerable, not customer-facing. **Acceptable.**
- **DB requirement:** stateless routing needs **no DB**. But **budgets + virtual keys + per-key spend REQUIRE Postgres**, and the budget counter is best kept in **Redis** (already present) for fast, race-free enforcement. Since metering is the whole point, run it **Postgres-backed** (a small local Postgres, or the existing managed Supabase). [Virtual Keys](https://docs.litellm.ai/docs/proxy/virtual_keys) · [Budgets/Rate Limits](https://docs.litellm.ai/docs/proxy/users)

### Q2 — Role-alias config — **GO. High confidence.** Both LightRAG and ObsidiWikAi point at one base_url.
LiteLLM's `model_list` maps an arbitrary `model_name` (our role alias) → `litellm_params` (real provider+model, api_base, api_key). LightRAG sets `LLM_BINDING_HOST` → the LiteLLM `/v1` endpoint and `LLM_MODEL=fusion.extract`; ObsidiWikAi's own reasoning/suggestion calls use the same base_url with `fusion.reason`. [OpenAI-compatible endpoints](https://docs.litellm.ai/docs/providers/openai_compatible) · [Router](https://docs.litellm.ai/docs/routing) · [Fallbacks](https://docs.litellm.ai/docs/proxy/reliability)

Minimal config:
```yaml
model_list:
  - model_name: fusion.extract          # role alias
    litellm_params:
      model: openai/Qwen/Qwen2.5-32B-Instruct
      api_base: https://api.deepinfra.com/v1/openai
      api_key: os.environ/DEEPINFRA_API_KEY
  - model_name: fusion.extract          # same alias = fallback deployment
    litellm_params:
      model: gpt-5-mini
      api_key: os.environ/OPENAI_API_KEY
  - model_name: fusion.keyword
    litellm_params: { model: openai/Qwen/Qwen2.5-7B-Instruct, api_base: https://openrouter.ai/api/v1, api_key: os.environ/OPENROUTER_API_KEY }
  - model_name: fusion.query
    litellm_params: { model: gpt-5.6-terra, api_key: os.environ/OPENAI_API_KEY }
  - model_name: fusion.reason
    litellm_params: { model: gpt-5.6-terra, api_key: os.environ/OPENAI_API_KEY }
  - model_name: fusion.embed
    litellm_params: { model: openai/text-embedding-3-large, api_key: os.environ/OPENAI_API_KEY }
router_settings:
  num_retries: 2
  fallbacks: [{ "fusion.extract": ["fusion.extract"] }]   # provider failover within the alias
litellm_settings:
  drop_params: true
```
Swapping a provider = edit this file + redeploy the proxy; **LightRAG/ObsidiWikAi never change.** That is the architectural win.

### Q3 — Cost tracking + hard budgets — **GO. This is the actual value. High confidence.**
LiteLLM does **per-request and per-key token+cost tracking** and **hard budget caps**: `max_budget` on a virtual key **blocks calls that would exceed it**; limits by key/user/team; spend read from a Redis cross-worker counter for fast, race-safe enforcement (needs Postgres for the durable ledger; SQLite races under concurrency — don't). This is the "never get a cost surprise again" mechanism — and the thing LightRAG's native binding **cannot** do. [Spend Tracking](https://docs.litellm.ai/docs/proxy/cost_tracking) · [Budgets/Rate Limits](https://docs.litellm.ai/docs/proxy/users) · [Stack Harbor — per-team budgets deploy](https://stackharbor.com/en/knowledge-base/litellm-proxy-budgets-deploy/)

### Q4 — Embeddings via the gateway + blue-green re-index — **GO with a caveat. High confidence.**
- LiteLLM proxies **`/v1/embeddings`** incl. `text-embedding-3-large`, so `fusion.embed` is swappable too. **Caveat:** there are open bugs around embeddings through the proxy for *some OpenAI-compatible* upstreams — [#11231](https://github.com/BerriAI/litellm/issues/11231), [#8077](https://github.com/BerriAI/litellm/issues/8077) — so **validate the specific embed path you choose** with one call. Direct OpenAI `text-embedding-3-large` through the proxy is the well-trodden case. [/embeddings](https://docs.litellm.ai/docs/embedding/supported_embedding) · [proxy /embeddings](https://docs.litellm.ai/docs/proxy/embedding)
- **Blue-green re-index is practical because LightRAG has `workspace` isolation.** A `workspace` namespaces every store: **Neo4j via labels**, Redis/Milvus via key/collection **prefixes**, Postgres/pgvector via a **workspace field**, Qdrant via payload partitioning. Once set, a workspace is **immutable**. So the mechanism is: **build `index_v2` in a new workspace** (new embedding provider/model/dim), from the same source corpus, **in parallel** with the live `index_v1`; **parity-test**; **switch the app's active-workspace pointer**; **rollback** by pointing back. Version the workspace name by `provider-model-dim-vN`. [LightRAG #2527 (workspace isolation)](https://github.com/HKUDS/LightRAG/issues/2527) · [#1847 (multiple KBs)](https://github.com/HKUDS/LightRAG/issues/1847) · [PR #2615 (workspace mgmt demo)](https://github.com/HKUDS/LightRAG/pull/2615)

### Q5 — Gateway vs LightRAG's native per-role binding — **honest take**
LightRAG's native `LLM_BINDING_HOST` per-role binding **already** gives provider-neutrality **for LightRAG**. **If LightRAG were the only caller, LiteLLM would be overkill** — native binding + a config file would do. What LiteLLM genuinely **adds**, that native binding does not:
1. **One endpoint for BOTH LightRAG AND ObsidiWikAi's own model calls** (`fusion.reason` for suggestions, the Honcho-lens synthesis, canonicaliser LLM tie-breaks) — a single boundary for the *whole* system, not just LightRAG.
2. **Cost metering + hard budget caps** — the direct answer to this episode's lesson; native binding has none.
3. **Provider fallbacks/retries** across providers.
4. **Provider swap without redeploying the app** (edit proxy config, not app env).
5. **Unified request logging** across all callers.
Because ObsidiWikAi has real model calls **beyond** LightRAG, the shared gateway is **worth it — not overkill** — but only if run lean (below). The deciding factor is #1 + #2, not cost savings (which are now marginal).

### Q6 — Thinnest viable recommendation — **GO / ADJUST**
**GO on LiteLLM as the model boundary, ADJUST to run it lean:**
- Single LiteLLM container on Coolify; **static `config.yaml` in git**; **secrets via Coolify env** (`os.environ/...`), never in the file.
- **Postgres-backed** (small local PG or managed Supabase) + **Redis** (already present) — needed for the budget caps that are the point.
- **One virtual key** with a **hard monthly `max_budget`** (e.g. £5–10) so a runaway loop hard-stops. 5 role aliases. `num_retries: 2` + one cross-provider fallback per critical alias.
- **Mem-limit (≤1 GB) + healthcheck/auto-restart** to neutralise the RAM-creep bug and protect Neo4j's headroom.
- **Do NOT** enable teams, multi-replica load-balancing, guardrails, or the admin analytics stack — that's the "becomes a platform" trap. Skip it.
- **Placement:** start on the CX33 to keep it simple; if it pressures Neo4j's RAM, relocate to fusion247-core. Watch memory for the first week.

**NO-GO conditions (be honest):** if metering/budgets are *not* wanted and ObsidiWikAi's own calls stay trivial, skip LiteLLM entirely and use LightRAG's native per-role binding + a committed `.env` — that genuinely suffices and is less to run.

## Net
- **Model migration: not urgent.** Real cost ≈ £0.60/transcript; Qwen2.5-32B is roughly level, 7B a modest cut with quality risk. Optimise token-amplification and *measure* before migrating.
- **Gateway: GO (lean).** LiteLLM is the right provider-neutral boundary — its real value is **one endpoint for all callers + cost metering + hard budgets + provider-swap-without-redeploy**, not saving pennies. Run it minimal; guard the RAM; hard-cap the budget.
- **Blue-green embeddings: supported** via LightRAG `workspace` versioning — decide the embedding model while the graph is still tiny.

## Verify by doing
1. On the CX33, stand up LiteLLM with a 1 GB mem-cap; confirm it co-resides without squeezing Neo4j over a week.
2. Confirm the **v1.5.4** `LLM_BINDING_HOST` → LiteLLM `/v1` path returns clean extraction JSON, and that `fusion.embed` → `text-embedding-3-large` works through the proxy (the embedding-proxy bugs above).
3. Set a **hard `max_budget`** virtual key and prove a deliberate over-budget call is blocked — that's the "never surprised again" acceptance test.

## Added sources
- [hwdsl2/docker-litellm](https://github.com/hwdsl2/docker-litellm) · [Apify — self-host LiteLLM 2026](https://use-apify.com/docs/self-hosted/ai/litellm) · [Nerd Level Tech — production LLM gateway](https://nerdleveltech.com/litellm-proxy-production-llm-gateway-tutorial) · [BerriAI/litellm #12685 (RAM creep)](https://github.com/BerriAI/litellm/issues/12685)
- [LiteLLM — OpenAI-compatible endpoints](https://docs.litellm.ai/docs/providers/openai_compatible) · [Router / load-balancing](https://docs.litellm.ai/docs/routing) · [Fallbacks / reliability](https://docs.litellm.ai/docs/proxy/reliability)
- [LiteLLM — Spend Tracking](https://docs.litellm.ai/docs/proxy/cost_tracking) · [Budgets/Rate Limits](https://docs.litellm.ai/docs/proxy/users) · [Virtual Keys](https://docs.litellm.ai/docs/proxy/virtual_keys) · [Stack Harbor — budgets deploy](https://stackharbor.com/en/knowledge-base/litellm-proxy-budgets-deploy/)
- [LiteLLM — /embeddings](https://docs.litellm.ai/docs/embedding/supported_embedding) · [proxy /embeddings](https://docs.litellm.ai/docs/proxy/embedding) · [embedding-over-proxy bug #11231](https://github.com/BerriAI/litellm/issues/11231) · [#8077](https://github.com/BerriAI/litellm/issues/8077)
- [LightRAG #2527 (workspace isolation)](https://github.com/HKUDS/LightRAG/issues/2527) · [#1847 (multiple KBs)](https://github.com/HKUDS/LightRAG/issues/1847) · [PR #2615 (workspace mgmt)](https://github.com/HKUDS/LightRAG/pull/2615)
