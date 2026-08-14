---
source_id: MNNfat_QP0E
type: source-knowledge-note
source_type: youtube_transcript
title: Cloudflare will make 1000+ AI millionaires
source_url: "https://www.youtube.com/watch?v=MNNfat_QP0E"
video_id: MNNfat_QP0E
channel: Greg Isenberg
published: 2026-08-10
transcript_source: auto_captions
captured_at: "2026-08-14T22:13:31+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/MNNfat_QP0E/tubeair-report.md
  - Sources/_raw/MNNfat_QP0E/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is an episode of Greg Isenberg's *Startup Ideas* podcast (Isenberg hosting solo, no guest) breaking down Cloudflare's 2026 AI-agent monetization launch — pay-per-crawl, a monetization gateway, and the x402 payment protocol — and using it as the springboard for three concrete startup ideas. Isenberg states he has no affiliation with Cloudflare. The single reason it matters: he argues the internet is shifting from "pages humans visit" to "resources agents use," which creates an entirely new, extremely early monetization surface that unaffiliated builders can occupy now, before it becomes competitive.

## What the source says

### The "old bargain" of the internet, and why it's breaking
[01:20–02:29] Isenberg frames the pre-AI internet as a trade: search crawlers indexed a site, a human clicked through, and the site monetized that human's attention (ads, email capture, subscriptions, affiliate links). This funded much of the web. AI agents break the trade: an agent can read a page, extract the answer, and hand it to the user — who never visits the site. The site still created the value but loses the visit, and therefore loses the ad impression, email capture, and affiliate click.

### Reframing: this isn't just a "publishers are angry" story
[02:29–03:41] Isenberg explicitly says the publisher-backlash framing is "only the first inning." The bigger claim: agents will use the internet the way software uses infrastructure — requesting things, calling tools, comparing products, retrieving data, buying access, taking action. That requires **new pricing built for machine usage**, not human usage. His mental model, stated directly: *"the human web monetized attention and the agent web monetizes useful resources."* He illustrates the price-sensitivity gap with a deliberately absurd example — a human would never tolerate paying a third of a cent to read a recipe, but a machine doesn't care about micro-payments if the data helps it finish a job.

### What Cloudflare actually launched (plain-English breakdown)
[03:41–05:26]
- **AI Crawl Control** — visibility and control for site owners over AI crawlers: see crawler activity, allow specific crawlers, block others.
- **Pay Per Crawl** — the direct monetization piece. Site owners can charge AI crawlers for access. The crawler either presents payment intent in the request, or receives an HTTP 402 ("Payment Required") response containing the price.
- **Monetization Gateway** — the larger generalization: not just crawled pages, but *any* resource behind Cloudflare (webpage, dataset, API, MCP tool call, premium endpoint, file, search index) can carry payment rules.
- **The payment rail: x402** — built on the HTTP 402 status code. Flow: agent requests a resource → server responds with a price (typically a fraction of a cent) → agent pays and retries with proof of payment → Cloudflare verifies at the edge before the request reaches the origin server.

Isenberg's summary of the significance: Cloudflare is trying to make paid access feel native to the internet itself — no checkout flow, no account creation, no sales call, no enterprise procurement. **The request itself becomes the transaction.**

### Why this creates a new business model (not just a Cloudflare feature)
[05:26–08:39] He pivots from "Cloudflare launched a product" to "this creates an investable stack of businesses that don't yet exist." Illustrative revenue models: a dataset charging per lookup, an API charging per successful call, a research archive charging per answer, a product catalog charging per comparison.

He preempts an objection — "agents don't have wallets" — with a **claim/prediction**, not a demonstrated fact: he asserts we're moving into a future where agents will have wallets and email addresses and will transact, and that this is "already starting to happen." He connects this to Cloudflare's separate **AI Index** initiative (making sites easier for AI systems via MCP, `llm.txt`, search APIs, bulk data APIs), framed as evidence agents need not just access but *structure*.

**Key reframe (counterintuitive point, stated explicitly):** humans tolerate messy websites — clicking around, reading a stale FAQ, opening an old PDF — because "we're good at suffering." Agents cannot tolerate this; they need clean, structured, trustworthy "doors." The resulting shift, in his words: *"websites become resource layers, content becomes indexes, expertise becomes scalable, data becomes metered, and tools become agent accessible."*

### The emerging stack (his model of how this economy forms)
[08:39ff, restated around 07:xx–08:39] A five-layer pipeline: (1) messy internet (PDFs, pricing pages, blog posts, YouTube, support docs) → (2) someone cleans it into structured data → (3) someone makes it agent-readable (API, MCP tool, search index, feed, `llm.txt`) → (4) someone adds payment rules (some content stays free for distribution, some paid because valuable, some blocked because private) → (5) someone adds trust/analytics (data freshness, source reliability, which agents use it, which requests are worth money, which resources drive outcomes). He argues this stack will spawn "a whole generation of thousands of companies." The organizing question he poses for idea generation: *"what resource does an agent need badly enough and often enough and reliably enough to pay for?"*

### Counterpoint acknowledged and reframed: is it a bad time to build?
[08:39–10:22] Isenberg references chatter from indie hacker Levels.io about traffic/revenue declines, attributed to AI Overviews and the ease of "vibe coding" commoditizing simple tools. **His explicit reversal:** rather than concluding entrepreneurship is dying, he argues this is "the best time ever" to build — but specifically for businesses with defensible moats reinvented for an AI-native internet, not for small vibe-codeable tools. He frames this as generational-platform-shift timing, later (32:xx) comparing it explicitly to building an app when the App Store launched in 2009.

### Startup Idea 1 — The Niche Data Refinery
[10:22–16:41] Pick one niche where valuable information is messy, fragmented, changing, and annoying to collect (it already exists on the internet — Google Maps, job posts, reviews, directories, PDFs, pricing pages) and refine it into clean, structured "fuel" for agents.

**Worked example — med spas (Miami-based, chosen because of local density):** A med spa owner wants competitor pricing, treatments offered, review complaints, hiring signals, trending services, and local market shifts — currently scattered across Google Reviews, competitor sites, Instagram, job boards, meta ad libraries, and staff knowledge. An agent with this data cleanly assembled could generate insights like: pricing is above local median but reviews don't support premium positioning; three competitors started promoting exosome treatments in the last 60 days; the most common complaint is confusing pricing, so the offer should lead with simplicity; two fast-growing competitors are hiring injectors, signalling capacity expansion. Isenberg stresses the value comes from the underlying data, not from "a generic AI wrapper."

**The build wedge (concrete, step-by-step):** Manually track 100 businesses in one city. Build a spreadsheet: business name, website, services, prices, review count/rating, top complaints, Instagram links/recent posts, visible ad changes, hiring signals, booking flow. Produce ~10 derived outputs (local pricing map, competitor gap report, offer ideas list, services-to-ad recommendation, review complaint summary, hiring signal report, monthly market movement report).

**Counterintuitive go-to-market point, stated explicitly:** the first customer is usually *not* the end business owner ("agent-readable competitive analysis" is a confusing pitch to a med spa owner) — it's the people already selling *into* that niche: marketing agencies, consultants, freelancers, software companies, AI-implementation firms. Example economics given: an agency might sell a client a $5K/month growth package; if the data helps them close or improve one more client, they'll pay the refinery $300–$800/month.

**Productization path (explicit crawl-walk-run sequence):** report → dashboard → API → MCP tool → agents pay per lookup/report once payment rails mature.

**Generalization to other niches (each with example tracked signals):** roofing (storm events, permit data, insurance signals, local reviews, competitor offers/ad angles), real estate investing (zoning changes, permits, ownership records, rent comps, tax delinquencies, insurance shifts), e-commerce (competitor SKUs, pricing changes, review complaints, influencer rates, UGC hooks, Shopify apps, shipping promises), law firms (local competitors, practice-area positioning, ad copy, reviews, intake).

**Filter criteria for niche selection, defined precisely:** data must be *valuable* (helps make/save money), *repeated* (needed again and again, not one-off), *changing* (freshness matters), *fragmented* (no single source captures it), *annoying* (implying there's margin in doing the annoying work).

### Startup Idea 2 — Agent Readiness for Businesses
[16:41–22:53] Positioned explicitly as distinct from the increasingly "buzzy/fuzzy" term "AI SEO." Defined precisely: helping companies become easy for agents to understand, trust, compare, and recommend.

**The mechanism argument:** a human buyer's research journey (homepage → pricing → docs → demo → case study → ask a friend) is being compressed by agents into structured questions: Who's this for? What does it cost? What does it replace? What integrations? What are the risks? What does implementation look like? What do customers say? How does it compare to alternatives? Most company websites fail these questions — pricing hidden, docs buried, stale comparison pages, critical info trapped in PDFs, marketing-speak ("unlocking operational excellence") instead of plain answers.

**The concrete wedge — paid audit workflow:** pick one vertical (B2B SaaS is the obvious example, but also named: Shopify apps, law firms, healthcare clinics, financial advisors, insurance brokers, home services). Run 20–50 buyer-intent prompts across major AI tools (e.g., "what's the best software for X," "compare company to alternatives," "what does it cost," "who is it best for," "what are the risks," "would you recommend for a 20-person company," "what integrations does it support"). Show the company the actual AI answers — this is described as *the sales moment*: showing a founder that they don't appear in AI answers, or appear with wrong pricing, or lose to a competitor with cleaner docs, or have the right answer buried in an old PDF.

**The fix/product sold:** a clean `llm.txt` file, better documentation structure, an agent-parseable pricing page, honest/specific comparison pages, plain-language use-case pages, customer proof organized by segment, structured FAQs, schema markup, a product feed, a change log, and — where enough content exists — a lightweight MCP server or search endpoint.

**Recurring revenue layer:** a monthly "measurement loop" — rerun the prompts, track whether AI answers get more accurate, whether the company appears more often, whether comparisons improve.

**Pricing given:** audit + cleanup at $3,000–$10,000; for larger B2B companies, $10,000–$20,000. After ~10 clients in one niche, the same gaps repeat (same missing docs, unclear pricing pages, same questions, same structured files, same monthly report) — at which point Isenberg advises productizing the repeated work into software, explicitly endorsing a services-first-then-software sequencing.

**Sales philosophy, stated directly:** *"You're not selling the future. You're selling the screenshot."* — show the prospect what AI currently says about their company.

**Vertical-specific end states named:** local businesses → "let AI assistants book appointments with you"; e-commerce → "make your product catalog easy for shopping agents to compare and buy"; B2B SaaS → "make your product easy for procurement agents to evaluate"; publishers → "make your archive easy for AI systems to understand and license." He notes venture-backed horizontal players are already emerging in this space and recommends going vertical instead.

### Startup Idea 3 — Turning Expert Archives into Agent Tools
[22:53–29:53] Aimed at creators, media companies, analysts, consultants, researchers sitting on large content archives (YouTube videos, podcasts, newsletters, templates, community posts). Current monetization of such archives: ads, sponsorships, subscriptions, communities, consulting. His proposed shift: the archive itself becomes a callable **tool**, not just consumable content — e.g., a founder agent that critiques a startup idea using a specific archive's frameworks, a sales agent that rewrites a cold email using a named sales trainer's framework, a fitness agent that builds a plan from a coach's specific training philosophy.

**Explicit warning against the wrong framing:** don't pitch a creator on "turning your whole brain into AI" — described as "creepy," "vague," and "like a SaaS landing page that should be illegal." Instead pitch one specific, narrow job (e.g., "you have 300 sales videos → we turn them into a cold-email-improvement tool"; "500 startup podcast episodes → a startup-idea feedback tool"; "a decade of design teardowns → a landing-page critique tool").

**Build steps given, in order:**
1. Pick an expert with a deep archive and a specific (ideally B2B) audience — Isenberg notes a *general* business creator is harder to do this with than a specific niche expert (cold email, Shopify growth, local business acquisition, tax strategy, fitness programming, design teardowns given as examples).
2. Collect the archive — transcribe video/podcast content, pull newsletters, clean docs.
3. **Tag the archive deliberately** by job, topic, audience, example, framework, and outcome. Explicit warning against laziness here: dumping everything into a vector database and calling it done "gives you a search box with confidence, but a real product needs structure." Worked tagging schemes given — sales archive: prospecting, subject line, offer, objection, follow-up, personalization, deliverability, close; startup archive: idea, market, wedge, distribution, pricing, MVP, community, moat, examples.
4. Build one useful workflow. Sales example (names Alex Hormozi as a hypothetical expert): paste a cold email → agent critiques it using that expert's principles, cites source lessons, rewrites the email, scores it, gives one test to run. Startup example: paste an idea → agent gives the wedge, the customer, the first offer, the first distribution channel, and what to validate this week. Real estate example: paste a deal → agent checks assumptions, identifies risk, compares to expert criteria, tells you whether to ask the broker.

**Self-referential proof point:** Isenberg states his own product, ideabrowser.com, already does this — its most popular feature is an MCP integration that improves the connected LLM using data his team has cleaned, explicitly framed as "practicing what I'm preaching."

**Why this favors the creator:** the creator already has distribution and built-in trust; the audience wants the expertise but the creator may not want to do 1:1 consulting — the tool democratizes access at a lower price point. Monetization options named: $19–$50/month subscription, bundled into a paid community, used as a lead magnet for consulting, or licensed to agencies/software companies. He connects this back to the Cloudflare thesis: once agents can pay per request, the archive becomes a resource an agent pays to query, the creator gets paid on usage, and this beats "hoping someone watches a pre-roll ad before a 47-minute interview from 7 years ago."

**Stated biggest mistake in this category:** generic "chat with an expert" products — described as too broad. The specific, outcome-based framing ("rewrite the cold email using this sales system," not "chat with the salesperson") is presented as the better approach.

### Synthesis / closing argument
[29:53–end] What connects all three ideas, in his words: agents need clean, trusted, useful resources — which can be data, structure, access, expert knowledge, a tool, or a payment rule. Cloudflare matters because it's building part of the access/payment layer, but he stresses builders don't need to wait for the full agent-payment internet to mature — they can build and sell the manual/human version now, accumulate the data now, and package it now, so they're not scrambling once agent payments become common.

**Idea-generation questions he offers as a closing framework:** What decision is expensive? What information is messy? What changes often? Who already pays for help? What would an agent need to do the job better?

**Closing framing/prediction:** "the internet is shifting from pages humans visit to resources agents use." He explicitly compares the current moment to building an app when the App Store launched (2009), predicts a cohort of businesses will be founded in this 2026–2027 window, and frames the opportunity as small right now only because the agent internet itself is still small relative to its eventual scale.

## Mechanisms, methods & implementation detail
- **x402 payment flow:** agent requests resource → server returns HTTP 402 with price → agent pays and retries with proof of payment → Cloudflare verifies at the network edge before the request reaches the origin server. [03:41–05:26]
- **Niche Data Refinery build sequence:** manual tracking of 100 businesses in one city via spreadsheet (fields: business name, website, services, prices, review count/rating, top complaints, Instagram links/recent posts, ad changes, hiring signals, booking flow) → generate ~10 derived report types → sell first to intermediaries (agencies/consultants) already serving the niche → productize crawl→walk→run: report → dashboard → API → MCP tool → per-lookup agent payments. [11:05–16:05]
- **Agent Readiness audit method:** select one vertical → run 20–50 buyer-intent prompts across major AI tools → present the gap between the AI's current answers and reality as the sales trigger → sell a defined fix bundle (llm.txt, docs restructuring, parseable pricing, honest comparison pages, plain-language use-case pages, segmented customer proof, structured FAQs, schema markup, product feed, changelog, optional MCP/search endpoint) → sell a recurring monthly "measurement loop" that reruns the prompts and tracks change. [19:00–21:38]
- **Expert Archive Tool build sequence:** select a narrow-audience expert with a deep archive → collect/transcribe/clean the archive → tag it against a deliberate schema (not just vector-embedded) → build exactly one narrow, outcome-specific workflow (paste-in → critique/score/rewrite/output) → monetize via subscription, community bundling, lead-gen, or B2B licensing. [25:19–29:00]

## Tools, people, products & organisations
- **Cloudflare** — the CDN/edge-network company; source event of the episode. Launched AI Crawl Control, Pay Per Crawl, Monetization Gateway, and AI Index (MCP/llm.txt/search-API/bulk-data-API support) for AI agents. Isenberg states he has no affiliation with the company.
- **x402** — the payment protocol/rail Cloudflare is building on, using the HTTP 402 "Payment Required" status code to let agents pay per-request at the network edge.
- **Greg Isenberg** — host of the *Startup Ideas* podcast; presents this as his own analysis/opinion piece, not a Cloudflare-commissioned or affiliated production.
- **Levels.io** — referenced indie hacker whose public commentary (on X) about declining traffic/revenue is used as a counterpoint Isenberg then argues against.
- **Corey Ganham / "Vase"** — referenced as a prior podcast guest/episode where Isenberg previously discussed related "forward deploy engineer" and paid-audit concepts; named as a place to "go deeper" but not otherwise detailed in this transcript.
- **Alex Hormozi** — used as a hypothetical/illustrative example of a sales expert whose archive could power a "critique my cold email" agent tool; not stated to be an actual partner or confirmed real example.
- **ideabrowser.com** — Isenberg's own product, cited as a live example of "expert archive → agent tool," specifically its MCP integration feature that lets a connected LLM use the product's cleaned data.
- **Google, Google Maps, Instagram, meta ad libraries** — named as existing sources of the "messy" raw data referenced for niche data refinery examples (med spas, roofing, etc.).

## Examples & use cases
- Med spa niche data refinery (Miami), including specific example agent outputs (pricing-vs-review-positioning mismatch, competitor exosome treatment trend, pricing-complaint pattern, hiring-signal-implies-expansion insight). [11:05–14:xx]
- Roofing, real estate investing, e-commerce, and law firm variants of the same niche-refinery model, each with named tracked signals. [14:xx–16:05]
- B2B SaaS "agent readiness" example: a buyer asking an AI assistant to "find me the best payroll provider for a 15-person company in California," and the underlying questions the agent must resolve. [17:48]
- Agent-readiness fix examples across verticals: local business booking, e-commerce catalog comparison, B2B SaaS procurement evaluation, publisher archive licensing. [22:16–22:53]
- Expert-archive tool examples: cold-email critique tool (sales expert), startup-idea feedback tool (startup podcast archive), landing-page critique tool (design teardown archive), real-estate deal-assumption checker. [25:19–28:35]
- ideabrowser.com's MCP feature as a live, already-shipped example of the archive-to-tool idea. [28:xx]

## Claims & confidence
- **[fact]** Cloudflare launched AI Crawl Control, Pay Per Crawl, and a Monetization Gateway, using x402/HTTP 402 as the payment mechanism. High confidence — described as a direct product announcement, consistent in detail across the episode. (Independent verification against Cloudflare's own materials was not performed as part of this note.)
- **[claim]** Agents will soon commonly have "wallets and email addresses" and transact autonomously, and this is "already starting to happen." Medium-low confidence — presented as Isenberg's forward-looking prediction/assertion, not backed by named data, studies, or specific examples of agents already doing this.
- **[opinion]** The publisher/crawler-payment story is "only the first inning" and the larger opportunity is a full agent-resource economy. Clearly Isenberg's interpretive framing, not a factual claim about Cloudflare's stated intent.
- **[opinion]** "It's an incredible time to be building" / "the best time ever," offered explicitly as a rebuttal to Levels.io-style pessimism about declining traffic/revenue from AI Overviews and vibe-coded competition. Opinion, stated as a direct counter-argument to a named competing view.
- **[claim]** Specific dollar figures (e.g., $300–$800/month for niche data services sold to agencies; $3,000–$20,000 for agent-readiness audits; $19–$50/month for expert-archive tools) are illustrative pricing suggestions from Isenberg, not reported market data or case studies of businesses actually charging these amounts. Low-medium confidence as market fact; presented as prescriptive guidance rather than observed pricing.
- **[opinion]** "Chat with an expert" products are the biggest mistake in the expert-archive category, versus narrow outcome-specific tools. Isenberg's stated view, not attributed to any data or named failed company.
- **[fact]** The episode is framed entirely as unsponsored, unaffiliated commentary — Isenberg states this directly at the top and close of the episode.

## Caveats & source gaps
- No guest is present; this is entirely Isenberg's own analysis and opinion, despite functioning as a "breakdown" of a third-party announcement — treat the Cloudflare technical description as his paraphrase, not a primary-source citation or spec walkthrough.
- No concrete case study, named company, or real revenue figure is given anywhere in the episode for any of the three startup ideas — every dollar figure and workflow is illustrative/hypothetical ("imagine," "let's say," "you could charge something like").
- The claim that "agents are already starting to have wallets and transact" is asserted without a named example, product, or data point.
- The Alex Hormozi example is explicitly hypothetical ("let's say Alex Hormozi is going to go and critique it") — not a stated real partnership or existing product.
- No detail is given on how Cloudflare's pricing, take rate, agent-side wallet/payment infrastructure, or actual adoption numbers work — the episode stays at the conceptual/plain-English level throughout, by Isenberg's own framing ("I'm going to show you exactly how everything works in plain English").
- The reference to Corey Ganham / "Vase" episodes is a pointer to other content, not detailed further in this transcript — treat as an external cross-reference, not something this note can reconstruct.
- Isenberg's own commercial interest is worth noting for calibration: he runs ideabrowser.com, which he cites as a live proof point for Idea 3 — this is a self-referential example, not independent validation of the business model.

## What this means for Fusion247
*(Cairn's interpretation — not sourced from the transcript.)*
- This maps directly onto Fusion247's own architecture: myPKA already sits on a "messy → structured → agent-accessible" pipeline internally (Wayfinder maps, Team Knowledge, PKM), and the source's five-layer stack (messy data → cleaned → agent-readable → paid → trusted/measured) is a useful external validation of the shape of that work, even though nothing here suggests changing current build priorities.
- The "Niche Data Refinery" model (Idea 1) is structurally similar to what CareerAIR (BUILD-016) and AsdAIr already do internally — turning messy, fragmented external signal (job postings, catalogue/shopping data) into structured, decision-useful output — though those are personal-use tools, not commercial products, so this is a pattern match, not a suggested pivot.
- The "Agent Readiness for Businesses" idea (Idea 2) is directly relevant if Fusion247 or any future client-delivery work under `Client Delivery/` ever considers "is our own content/documentation agent-legible" as a dimension — e.g., whether myPKA's own public-facing surfaces (if any exist) would parse cleanly for an AI assistant asked about it. This is speculative and not something the source claims about Fusion247 specifically.
- Nothing here implies any action on Cloudflare infrastructure, x402, or payment rails for Fusion247's own systems — the source is squarely about third-party public monetization patterns, not about Fusion247's private estate.
- Given the estate's HOBBY BRAIN proportionality rule, this note is filed as reference/idea material only; it does not itself constitute a product decision or open a Work Order.

## Key concepts & takeaways
- **The old bargain vs. the agent web:** human web monetized attention; the agent web monetizes useful resources.
- **The request becomes the transaction** — Cloudflare's x402/402 flow removes checkout, account creation, and sales friction from machine-to-machine payment.
- **"Clean fuel for agents"** — Isenberg's repeated phrase for the transformation of messy, fragmented human-web data into structured, trustworthy, agent-usable form.
- **Sell to the seller, not the end user, first** — in a new/confusing category, the first paying customer is often the person already selling services into that niche, not the end business owner.
- **Services-first, then productize** — repeated patterns across ~10 clients in a niche are the signal to convert a manual/audit service into software.
- **"You're not selling the future, you're selling the screenshot"** — showing a prospect their actual current AI visibility/answer is a stronger sales motion than pitching a hypothetical.
- **Narrow, job-specific tools beat broad "chat with X" products** — specificity of workflow and outcome outperforms generic conversational wrappers.
- **You don't need to wait for the infrastructure to mature** — build and sell the manual version of the business now; the data/relationships compound before the agent-payment rails are fully live.

## Actions & open questions
- No direct action is implied for Fusion247's own build priorities — this is idea/context material, not a Work Order trigger.
- Open question (not answered by the source): what, if anything, in Cloudflare's actual documentation (pricing, current adoption, x402 spec maturity) would need independent verification (Pax) before treating any of this as more than directional context — this note has not cross-checked Cloudflare's own materials.
- If Warwick wants to explore any of the three startup ideas as an actual side project, the natural next step would be a Pax due-diligence pass on Cloudflare's actual current x402/Pay-Per-Crawl rollout status and adoption, since this source is opinion/analysis, not primary documentation.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/MNNfat_QP0E/` — `tubeair-report.md` (sha256 `8ca927434be8…`), `manifest.json` (sha256 `d80ebbc7fb1f…`). Preserved as captured; never edited or summarised.
