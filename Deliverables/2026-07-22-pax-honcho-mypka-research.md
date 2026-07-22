---
title: "Honcho (Plastic Labs) — agentic memory assessment for MyPKA/Fusion247"
author: Pax (Senior Researcher)
date: 2026-07-22
type: research-brief
status: final
decision: adopt / scoped-spike / pass
---

# Honcho for MyPKA — Research Brief

## Executive summary

Honcho is a **real, active, open-source (AGPL-3.0) agent-memory backend from Plastic Labs** — not vaporware. It is a Postgres+pgvector+Redis service with a background "deriver" that runs LLM reasoning over conversation streams to build per-"peer" psychological representations, and it posts genuinely strong self-run benchmark scores. **Most of the video's specific claims hold up** (the reasoning model *is* a fine-tuned Qwen3 called Neuromancer XR; "dreaming" and per-peer cards are real; BEAM scores ~0.63/0.41 at 1M/10M match the primary source). But the framing is promotional: the "beat OpenAI & Anthropic" headline is **not** what Plastic Labs actually claims — the benchmarks compare *memory systems*, all are **vendor-self-run**, and Honcho **cannot run without a cloud LLM API key even when self-hosted**.

**Recommendation: EVALUATE with a tightly-scoped, throwaway spike — do NOT adopt into MyPKA's governed memory.** Honcho's auto-reasoned, LLM-mutated, cloud-LLM-dependent model structurally clashes with MyPKA's human-governed, git-versioned, public-repo, markdown-SSOT doctrine. There is a plausible *adjacent* fit (a private scratch-memory layer for the live agents' working context, never the Brain), but it earns a spike, not a commitment.

---

## 1. What Honcho actually is

| Attribute | Finding | Confidence |
|---|---|---|
| Vendor | **Plastic Labs** (same team as tutor-gpt, "theory-of-mind" AI). Video's attribution correct. | High |
| Repo | `github.com/plastic-labs/honcho`, ~4–6k stars, ~590+ commits, active. | High |
| License | **AGPL-3.0** (strong copyleft — network-use triggers source-disclosure obligations). | High |
| Current version | Server **3.0.9** (SDKs version independently). | High |
| Architecture | Dual-service: (1) **synchronous storage API** (workspaces → peers → sessions → messages); (2) **asynchronous "deriver" worker** that reasons over the queue to produce representations, peer cards, session summaries, and "dreaming" tasks. | High |
| Stack / self-host | Docker Compose; **PostgreSQL + pgvector**, **Redis**, Python 3.10+/uv, FastAPI. Vector store pluggable (pgvector / Turbopuffer / LanceDB). | High |
| **Cloud LLM dependency** | **Mandatory even self-hosted** — `.env` requires at least one of `LLM_GEMINI_API_KEY` / `LLM_ANTHROPIC_API_KEY` / `LLM_OPENAI_API_KEY`. There is no local-only inference path out of the box. | High |
| Managed cloud | `api.honcho.dev`, dedicated per-org instance, **$100 free credits** on signup. Video's "$100 credit" correct. | High |
| Maturity | Real and usable, but the independent reviewer rates **operational complexity as a genuine drawback** vs simpler tools (Mem0 "30 seconds" to Honcho "~30 min" setup); multiple moving services. Production-grade for early adopters, not turnkey. | Medium |

**Name corrections from the (mis-transcribed) video:**
- "Neuromancer" → **Neuromancer XR** — real, a Plastic Labs reasoning model.
- "BEAM" → **BEAM** is correct: *"Beyond a Million Tokens: Benchmarking and Enhancing Long-Term Memory in LLMs"* (ICLR 2026), a third-party benchmark at 1M/10M-token scale. Not a Honcho invention.
- "Mem0" → **Mem0** is correct (the main competitor Honcho benchmarks against).
- "Open Claude" / "OpenClaw" / "Hermes" (video's agent names) → these map to real MCP-client integrations Honcho advertises (Claude Code, OpenCode, Cursor, Cline, Windsurf). Treat the specific names as loose.

---

## 2. Claim-by-claim verification

| # | Video claim | Verdict | Confidence | Note |
|---|---|---|---|---|
| a | "Beat OpenAI/Anthropic/Google at agentic memory" | **Misleading spin** | High | Plastic Labs does **not** claim to beat those *labs' models*. Its benchmarks compare *memory systems* (vs Mem0 etc.) and show its memory layer + a cheap model (Haiku 4.5) can *exceed the oracle case*. That's a real, interesting result — but "beat OpenAI/Anthropic" is the promoter's framing, not the vendor's. |
| b | Reasoning model "Neuromancer" = fine-tuned Qwen-3, not open-weight | **TRUE** | High | Neuromancer XR = fine-tuned **Qwen3-8B** on ~10k manually-curated instances; extracts "explicit" + "deductive" atomic conclusions into a per-peer reasoning tree. Reported **86.9% LoCoMo** (vs base Qwen3-8B 69.6%, Claude 4 Sonnet 80.0%). Open-weight status **not confirmed** — appears proprietary to Plastic Labs. *Caveat:* the **published benchmark runs used gemini-2.5-flash-lite (ingest) + claude-haiku-4-5 (chat)**, not Neuromancer XR — so Neuromancer's role in the headline scores is not the whole story. |
| c | Queue + periodic "reawaken ~every 1000 tokens" | **Partly verified** | Low | Queue + background deriver = **confirmed**. The specific "every ~1000 tokens" cadence I could **not** verify in primary docs — treat as an unverified video detail. |
| d | "Diachronic identity" + per-peer cards; peers = people OR agents; representations of peers inside other peers | **TRUE (core design)** | High | Peers (humans *and* agents) are first-class; deriver builds **peer cards** and **per-(observer,observed) representations** — i.e. theory-of-mind ("what peer A knows/believes about peer B"). "Diachronic identity" phrasing isn't a doc term but accurately describes the change-over-time modeling. |
| e | Automatic "dreaming" self-cleaning pass (~50 turns or ~8h) reconciling contradictions + generalizing traits | **Feature TRUE; thresholds UNVERIFIED** | Medium | "Dreaming" is a **real** deriver task (background re-reasoning that redraws inferences); the independent reviewer confirms it and flags its **token cost**. The exact **~50-turn / ~8-hour** triggers I could **not** confirm from primary docs (the dreaming doc page 404'd). Treat thresholds as unverified. |
| f | BEAM ~0.6 at 1M, ~0.4 at 10M | **TRUE** | High | Primary source: **BEAM 1M = 0.631, BEAM 10M = 0.406**. Matches the video. Also LongMem S 90.4% (92.6% w/ Gemini 3 Pro), LongMem M 88.8%, LoCoMo 89.9%. **All vendor-self-run**, dated 2025-12-19, with an explicit "scores must be considered with variance in mind" caveat (non-deterministic LLM judges). |
| g | Open-source + self-hostable, ~$100 free credit | **TRUE** | High | AGPL-3.0, Docker self-host, $100 managed credits. But "self-hostable" ≠ "local/private": still needs an outbound cloud LLM key. |

**Anti-pattern flag (the mediocre read of this video):** taking a single promotional single-narrator video at face value and concluding "memory is solved, swap in Honcho." The benchmarks are self-published and self-judged; "beats OpenAI/Anthropic" is not the vendor's claim; and the AGPL license + mandatory cloud-LLM dependency are exactly the details a hype video omits. Independent-verification and license-reading are the whole job here.

---

## 3. How it could integrate with MyPKA — and where it clashes

**MyPKA's memory model today:** governed **markdown files** (Larry's memory, session-logs, the Brain/wiki) that are **human-curated, git-tracked, SSOT-disciplined, and on a PUBLIC repo**, plus a **Supabase control plane** (Directus cockpit). Memory is *authored and reviewed*, not auto-inferred.

**Honcho's model:** memory is **auto-derived by an LLM** from message streams, **mutated in the background** ("dreaming"), stored in **Postgres/pgvector (opaque, not human-diffable)**, and **reasoned via a cloud LLM**.

**The structural clashes (these are the load-bearing findings):**
1. **Governance vs auto-reasoning.** MyPKA's doctrine (your memory notes: *write-discipline*, *no self-edit of core rules*, *governing prompts need human approval*) is that durable memory is human-approved. Honcho's dreaming pass **rewrites inferences autonomously** — the opposite. It cannot own anything canonical.
2. **Version control vs opaque DB.** MyPKA memory is markdown you can `git diff` and review. Honcho state is embeddings + rows in Postgres — **not human-diffable, not git-native**. It would be a second, un-auditable memory home, violating SSOT.
3. **Public-repo personal-data doctrine.** Your hard rule: Fusion247PKA is PUBLIC; personal/entrusted data never goes public. Honcho state must **never** live in the git repo — it would have to be gitignored-local or a private DB, same posture as AsdAIr. Manageable, but a real constraint.
4. **Cloud-LLM privacy exposure.** Every message Honcho ingests is **sent to Gemini/Anthropic/OpenAI** for derivation — there is no local-only mode. For a personal "brain" observing all your agent traffic, that is a meaningful data-egress surface.
5. **New-dependency / availability risk.** Postgres + Redis + deriver worker + external LLM = 4 new failure points, plus **ongoing token cost** from dreaming. Matches your *multi-model-loop usage pacing* concern.

**Where it could plausibly fit (non-clashing):** as a **private, disposable working-memory / scratch layer for the live agents' runtime context** — "what does Larry remember about this ongoing thread" — that is **explicitly NOT canonical** and never written back to the Brain without a human promoting a distilled note through the existing governed path. That mirrors your *unified-gateway-categoriser* and *distilled current-context brief* ideas: Honcho could be an auto-memory *feeder* whose outputs a human curates into markdown. It is a **candidate for the ephemeral tier, never the SSOT tier.**

**Integration options + rough effort:**
- **Option A — Managed cloud spike (lowest effort, ~½ day):** sign up, use $100 credits, wire one agent via MCP, observe what representations it builds from synthetic/non-personal data. Verifies value fast. **Privacy blocker: do not feed real personal data to the managed cloud.**
- **Option B — Self-host on the Yoga (moderate, ~1–2 days):** Docker Compose (Postgres+pgvector+Redis+deriver) locally; still needs a cloud LLM key, but data-at-rest stays local. Feasible on the Yoga but adds standing services + token spend. Keeps state gitignored-local.
- **Option C — Adopt as a memory tier (high effort + governance design):** define the ephemeral-vs-canonical boundary, the human promotion path, and the private-storage posture. **Premature** — only after A/B prove value.

---

## 4. Benefits vs risks for Fusion247

**Benefits (if it works):**
- Genuine reasoning-over-retrieval: benchmark evidence suggests the memory layer *improves* a cheap model's answers beyond even the oracle-context case (real signal, not just RAG).
- Portable cross-agent memory (Claude Code / Codex / Cursor share one peer model) — directly relevant to your multi-model build-verify loop.
- Peer/theory-of-mind model is a strong conceptual match for "agents as first-class team members" (your Larry-as-identity framing).
- Open-source + self-hostable means **no hard vendor lock-in** of the state store.

**Risks:**
- **Privacy/data egress (highest):** mandatory cloud-LLM derivation of everything it observes; incompatible with feeding real personal/household data without careful gating. Personal-data doctrine applies in full.
- **Public-repo leakage:** Honcho state must be structurally kept out of the public git repo (gitignore + private DB), or it breaches your hard rule.
- **AGPL-3.0:** copyleft. Fine for internal/personal self-host use; would create obligations if Honcho code were ever bundled into a distributed/networked Fusion247 product. Flag for Vex if it ever goes beyond personal use.
- **Governance dilution:** if Honcho's auto-memory ever becomes a source of truth, it undermines the human-curated Brain that is MyPKA's whole point.
- **Cost + ops drift:** background dreaming burns tokens continuously; another always-on stack to keep alive (you're already nursing the Directus autostart/reboot-recovery burden).
- **Self-host feasibility on the Yoga:** technically fine (Docker, Postgres, Redis all run on Win11), but it is *another* persistent service competing with the live cockpit for the machine.

---

## 5. Recommendation

**EVALUATE via a scoped, throwaway spike — do not adopt into governed memory. Verdict tilts toward "interesting adjacent tool," not "core dependency."**

**Smallest sensible first test (Option A, de-risked):**
Sign up for managed Honcho ($100 credits), wire a **single** agent via MCP, and run **synthetic / deliberately non-personal** conversations through it for one session. Then inspect: (1) what peer representations + peer cards it actually derives, (2) whether the "dreaming" reconciliation produces useful generalizations or noise, (3) real token cost per session. Time-box to half a day. **Hard guardrail: no real personal, household (AsdAIr), or entrusted data touches the managed cloud** — if the concept proves out, re-run on a local self-host (Option B) before any real data.

**Decision gate before going past the spike:** it only graduates if (a) the derived memory is demonstrably better than your existing markdown notes for a concrete task, AND (b) a clean ephemeral-vs-canonical boundary is designed so Honcho never becomes SSOT. Absent both, **pass** — your governed markdown + Supabase control plane already covers the durable-memory need, and Honcho's value is in the ephemeral working-context tier you haven't built yet.

---

## Methodology
Started from the video's claims, then triangulated each against **primary sources** (Honcho GitHub repo + README, honcho.dev docs, Plastic Labs research blog for benchmarks and Neuromancer XR) and **independent secondary sources** (andrew.ooo review, mem0.ai on BEAM, DEV Community). Every load-bearing claim has ≥2 sources except where explicitly flagged Low/Medium. Confidence marked per row.

## Limitations / could not verify
- Exact "dreaming" trigger thresholds (~50 turns / ~8h) and queue "~1000 token" cadence — **unverified** (dreaming doc page returned 404; not found in primary text).
- Neuromancer XR open-weight status — **unconfirmed** (appears proprietary).
- All headline benchmarks are **vendor-self-run and LLM-judged** — no fully independent replication located; treat scores as directional, not audited.
- Whether the *published* benchmark numbers used Neuromancer XR at all — the primary post says they used gemini-2.5-flash-lite + claude-haiku-4-5, so Neuromancer's contribution to the headline scores is ambiguous.

## Sources
- [Honcho GitHub repo](https://github.com/plastic-labs/honcho) · [README](https://github.com/plastic-labs/honcho/blob/main/README.md) — primary (license, arch, self-host, deriver/dreaming, peers, version)
- [Honcho docs](https://honcho.dev/docs) · [evals.honcho.dev](https://evals.honcho.dev/) — primary (concepts, benchmarks)
- [Plastic Labs — Benchmarking Honcho](https://plasticlabs.ai/blog/research/Benchmarking-Honcho) — primary (LongMem/LoCoMo/BEAM numbers, model + self-run caveat, 2025-12-19)
- [Plastic Labs — Introducing Neuromancer XR](https://plasticlabs.ai/blog/research/Introducing-Neuromancer-XR) — primary (Qwen3-8B fine-tune, function)
- [Plastic Labs GitHub org](https://github.com/plastic-labs) · [tutor-gpt](https://github.com/plastic-labs/tutor-gpt) — primary (vendor, theory-of-mind lineage)
- [andrew.ooo — Honcho review](https://andrew.ooo/posts/honcho-plastic-labs-agent-memory-review/) · [DEV Community mirror](https://dev.to/andrew-ooo/honcho-review-plastic-labs-agent-memory-layer-2026-2kb4) — independent secondary (maturity, ops complexity, dreaming cost, benchmark validation)
- [mem0 — What is BEAM](https://mem0.ai/blog/what-is-beam-memory-benchmark-the-paper-that-shows-1m-context-window-isnt-enough) · [Why BEAM](https://mem0.ai/blog/why-beam-is-a-good-memory-benchmark-for-ai-agents) — secondary (BEAM = "Beyond a Million Tokens", ICLR 2026; competitor context)
- Source under review (promotional): "AI memory just got solved (they beat OpenAI & Anthropic)" — Igor Kudryk, YouTube `pcR30j-sKxU`
