---
source_id: I_wbc5ND79o
type: source-knowledge-note
source_type: youtube_transcript
title: Claude Code built me a $273/Day online directory
source_url: "https://www.youtube.com/watch?v=I_wbc5ND79o"
video_id: I_wbc5ND79o
channel: Greg Isenberg
published: 2026-02-16
transcript_source: auto_captions
captured_at: "2026-08-14T23:37:16+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/I_wbc5ND79o/tubeair-report.md
  - Sources/_raw/I_wbc5ND79o/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation
This is a Startup by Design podcast episode (Greg Isenberg interviewing returning guest Frey, self-described "Mr. Directory") about building online directory websites using Claude Code plus the open-source scraper Crawl4AI. The core content is a live, prompt-by-prompt walkthrough of how Frey took 71,000 raw scraped rows down to a ~700-listing luxury-restroom-trailer directory in 4 days for under $250, covering data scraping, AI-driven cleaning/enrichment, image handling, and monetization strategy. It matters because it's a concrete, reproducible low-capital ($200–500) playbook for a non-technical builder to generate autopilot organic traffic and lead-gen revenue, with the data-cleaning pipeline being the reusable, transferable part.

## What the source says

### Thread 1 — Directories as a business model (framing, via three examples)
Greg and Frey open by reviewing three real directories and guessing traffic/monetization, establishing the "directory as passive-ish business" thesis before the tutorial:
- **Parting.com** (funeral home directory): 61,000 organic monthly visitors [03:18]. Reported $1M+/year revenue, quoted as high as $5M; raised $1.5M in 2021 [04:28]. Majority of revenue is NOT ads or pure lead gen — it comes from **Parting Pro**, a vertical SaaS/agency backend sold to funeral homes (cremation arrangement software, dropshipping urns, website + marketing agency services) [04:28–05:10]. Frey's takeaway: the "directory + micro-SaaS/agency" combo is a proven, recurring pattern among the biggest directories he's seen [05:10].
- **APlaceForMom.com** (senior living directory): 824,000 organic monthly visitors [06:37]. Frey estimates true revenue near $50M/year despite wilder public claims of $100–500M [06:37]. Monetizes via lead generation across 18,000+ listed senior living homes — collecting a portion of first month's rent or a fixed referral fee [07:15–07:37]. Notably built on WordPress, offered as proof low-tech stacks can still win [07:57].
- **GasBuddy.com**: 1.1M organic monthly visitors [08:59]. Two monetization channels: (1) ads — Frey estimates conservatively $30k+/month given US/Canada tier-one traffic [09:59]; (2) a **GasBuddy Plus debit/Mastercard product** ($10/mo or $99/yr) that saves users money on gas [10:02]. Frey calls this his favorite example because the monetization is unusually well-aligned with why users show up (crowdsourced gas prices), unlike Parting/APlaceForMom which require outbound sales to businesses [12:16].

**Counterintuitive/notable sub-point — gamified data collection.** GasBuddy's crowdsourced data model (since 2002/2004) solved the "why would anyone bother reporting gas prices" problem with a public leaderboard and giveaways (originally e-bikes, now $100 prepaid gas cards) [10:34–12:16]. A top contributor ("Prince33," Gary, Indiana) has reportedly not missed a day of reporting in ~5,800 days, visible on the Wayback Machine as far back as 2006 [11:17–12:16]. Frey's generalized lesson: successful directories all execute one of three value props — **save time, save money, or help people make money** — and price transparency in industries where pricing is opaque is a specific, underused wedge [12:56–13:39].

### Thread 2 — The core teaching: data is the moat, and how to get it (the main tutorial)
Frey states directly that for directories, "the moat is definitely data and your SEO" [14:37], and the number-one reason (in his estimate, from watching 1,000–2,000 people attempt directories) people quit is the data-cleaning/verification stage — historically a manual, hour-consuming slog [19:33–19:54].

**Before/after proof point:** Frey's first directory, portapottymatch.com (built ~1.5 years earlier in WordPress, pre-Claude Code), is shown as a deliberately bad example — templated AI-generated copy, duplicate images across listings, unremoved lorem ipsum on the homepage [16:30–17:05]. Despite this low quality, it still generated real inbound leads, including one from the New Mexico State Fair worth an estimated $20,000+ in porta-potty/restroom-trailer rentals [17:36–18:00]. **Reversal/insight:** even a badly-built directory can surface real demand and high-value leads — meaning the barrier to entry for validating a niche is very low, and quality upgrades (via Claude Code) are what convert validated demand into a scalable, trustworthy asset [18:46].

**The new build:** Frey's current example, a "luxury restroom trailers" nationwide directory, was built in 4 days for under $250 total ($100 Claude Code Max subscription, $100 for the scraped data, $50 in Claude API credits for image cleaning) [15:10, 20:17]. He claims it saved him 2,000+ hours versus manual cleaning and eliminated the need to hire a developer for custom Python scraping scripts [19:54–20:17].

**Frey's 7-step (roughly) directory-building process** [21:25]:
1. **Idea/niche selection** — informed by understanding what actually drives a buyer's decision (researched via Reddit, TikTok, Facebook groups, Instagram — wherever the niche's conversation happens) [20:34–20:53].
2. **Data collection** — see Mechanisms section.
3. **Website build.**
4. **SEO optimization.**
5. **Monetization.**
(Frey notes the exact number of steps flexes — "seven-step process... might be eight steps or four steps" — depending on niche and how deep enrichment needs to go [39:05–39:29].)

### Thread 3 — Niche selection strategy: go narrower than the giants
Frey argues you cannot out-rank massive horizontal directories like APlaceForMom for "senior living homes" without expert-level SEO, big backlink budgets, and time [39:29–39:55]. Instead, find a **sub-niche with a genuine deal-breaker filter** — e.g., "senior living homes for people with dementia," which he checked on Ahrefs and found gets 1,000+ monthly searches despite being a narrow slice [39:55–40:22]. Same logic applied to bathroom contractors: instead of competing with Angie's List/HomeGuide broadly, target "ADA accessible bathroom contractor" [40:22–40:49]. This is now feasible at scale specifically because AI can read and classify website content to enrich/filter listings by these deal-breaker attributes, which wasn't previously practical [40:49–41:18].

**Other niche ideas floated:**
- Public/government datasets (data.gov) as an underused source — cited example: a community member "Andy" built a tap-water-quality directory (no backlinks) starting ~November, now at 40,000+ monthly visitors, accepted into Mediavine ad network, monetizing via Amazon affiliate water-filter sales [41:18–41:50].
- Air quality directories — mentioned as a similarly "boring but important" category [41:50].
- Event directories — Frey argues existing ones (e.g., relying on Eventbrite browsing) are poor curation experiences; with Claude Code you can scrape multiple sources and build a better-curated aggregator [41:50–42:29].

### Thread 4 — Should you even build a directory? (expectations-setting / career thread)
Frey is explicit that this is **not a fast-money play**: "if your timeline is to make money in less than 6 months, I would not build a directory" [44:14]. If you need money fast, he recommends something like flipping garage-sale items instead [46:27–47:22]. His pitch for directories specifically is as a **learning vehicle** — a low-stakes, structured way to learn AI coding (Claude Code) and SEO simultaneously, because the simplicity of a directory lets a beginner focus on distribution [44:40–45:43]. He frames the "top three" distribution channels as ads, organic social, and SEO, and argues directories are a "distribution-first model" with a structural SEO advantage: publishing one directory instantly creates topical relevance across potentially thousands of long-tail location/category pages (e.g., rank first for "luxury restroom trailers Bakersfield," then work up to "luxury restroom trailers Los Angeles") [45:43–46:27]. Directories are framed as low-cost, high-margin, location-independent "small bets" that can become large businesses, and as sellable assets once monetizing [46:53–47:22].

### Thread 5 — Will LLM/AI search (ChatGPT, Perplexity, Gemini) kill directories? (the reversal/myth-busting thread)
Greg raises the obvious objection: if people increasingly discover products/services via LLMs rather than Google, does a directory business still work, and won't the LLM just scrape and disintermediate the directory? [47:51–48:28]

**Common assumption (implicit in the question):** AI search will replace directory browsing entirely, cutting off both traffic and the ability to monetize.

**Frey's reversal — two-part counter-argument:**
1. **Discovery vs. decision-making split.** LLMs are good at the *discovery* phase (surfacing options, general info), but by the time someone is browsing a directory, they're already in the *decision-making* phase for higher-consequence choices (senior living for a parent, a lawyer, an accountant, health/finance/legal) — decisions where users won't accept "just the first LLM answer" and will actively comparison-shop, especially where money can be saved [48:28–50:20].
2. **Local SEO is structurally different from product SEO and hasn't really changed.** Frey compares a local search ("haircut Los Angeles") to a product search ("hair gel") on Google — the local SERP still shows a local pack + organic listings largely unchanged, while product SERPs have been reshaped heavily by other content types. This is *why* he deliberately avoids product-based directory niches (too much competing content/social) and favors local-service niches, which he expects to remain comparatively low-hanging fruit [50:20–51:28].

**Further reversal — AI search may actually favor narrow/niche directories over broad ones.** Greg extends the argument: in an AI-search world, horizontal directories may get hurt (because AI answers very specific prompts) while niche-specific directories benefit, because an LLM must cite a source rather than fully appropriating the data, and instead of "a thousand blue links" AI search surfaces only two or three sources — so being one of those few authoritative niche answers becomes more valuable, not less [52:29–53:10]. Frey agrees and states his own forward strategy is to build **super niche** directories specifically to fit this new AI-search citation pattern [53:10–53:46]. He does not believe lead generation as a business model is going away, though he expects it will "get way better" and evolve with "Agent Search" [52:29].

**Additional example — monetization flexibility once you have traffic:** Frey cites "Mark" and "Lose Trust MRR" (name captured as spoken; possibly "LosTrustMRR" or similar — transcript unclear on exact spelling) as a directory built on personal brand/audience that evolved into a marketplace for buying/selling businesses, illustrating that once a directory has traffic, monetization models can pivot opportunistically (including inbound requests from businesses asking to be listed) [51:28–52:29].

## Mechanisms, methods & implementation detail

**Step-by-step data pipeline (the tutorial's technical core):**

1. **Scrape raw data via Outscraper** [21:25–21:55]. Frey states Outscraper remains, in his view, the cheapest scraping option (he's also used Apify and alternatives) for pulling Google Maps business listings. For this project he scraped nationwide, yielding **71,000 rows** across the whole US for the porta-potty/restroom-trailer niche [21:55–22:21].

2. **First-pass junk removal via a single Claude Code prompt** [22:21–23:20]. He fed Claude Code five CSVs and instructed it to strip: listings with no business name, no address, no city/state; permanently-closed businesses; and obviously unrelated entries (e.g., big-box retailers). This single prompt reduced 71,000 → **20,000 listings**. Frey frames this specific prompt as broadly reusable regardless of niche.

3. **Entity verification/classification via Crawl4AI + Claude Code** [23:20–27:59]. Crawl4AI is an open-source, free, locally-installed LLM-friendly web crawler/scraper — Frey describes installing it by simply handing its GitHub link to Claude Code and asking for install help (~15 minutes, done with no prior AI-coding experience) [24:12–24:37]. The workflow: Crawl4AI is "the engine" that visits every website at scale; Claude Code is "the brain" that reads each page and classifies it against defined keyword/synonym criteria (here: is this business a *luxury restroom trailer* provider vs. a standard porta-potty company?) [24:37–25:03]. He recommends listing out synonyms of your target keyword to help classification accuracy [26:35]. A useful add-on module, **Async Web Crawler**, lets Crawl4AI hit multiple sites concurrently to save time [27:03]. The full 20,000-website pass ran unattended for **~3 hours** and returned **725 verified luxury restroom trailer listings**, each with a stated verification-confidence score [27:29–27:59]. Frey wrote the classification prompt casually, by talking it through with ChatGPT first [27:03–27:29].

4. **Sequential, single-attribute enrichment passes** (explicitly NOT batched together) [28:00–39:05]. Frey's key learned lesson: his first attempt tried to extract everything at once (trailer inventory, images, amenities, pricing, all in one massive prompt/CSV) and "it just didn't work... super low quality" [30:57]. The fix was doing **one enrichment attribute per pass**, each as its own Crawl4AI + Claude Code run, checking results and fixing edge cases between passes (sometimes rerunning 2–3 times) before moving to the next attribute [30:57–31:33]. Passes performed, in order:
   - **Trailer/product inventory** (e.g., 2-stall vs. 4-stall trailers) [28:36–30:57].
   - **Images**: Claude Code scrapes images via alt text/filenames/page context; then the top 3 image candidates per listing are sent to **Claude Vision**, which selects the best ones (cost: ~$30 via Anthropic API key) [31:33–32:59]. Frey notes his first attempt without the Vision-based filtering step returned logos, favicons, and junk images.
   - **Amenities/features**: first pass produced noise (stray words like "it," "and," "the" misclassified as features); refined by instructing Claude Code to check the homepage and any restroom-trailer-specific page and "go deep" [36:30–37:22]. These became **user-facing filters** on the live directory (filter by stall count, by amenity like "running water," etc.) [37:22–38:05].
   - **Service areas**: extracting geographic radius/coverage per business, broken into city, region, and radius columns; required manual correction where a business's site listed service areas across multiple unrelated states [38:05–39:05].

5. **Database creation**: once the enriched CSV is finalized, it's handed to Claude Code with an instruction to build a Supabase database using the exact finalized columns [42:29–43:09].

6. **Site build**: once the Supabase database exists, the directory frontend/design is built out freely in Claude Code [43:09].

**Practical/process tips embedded throughout:**
- Ask Claude Code for its game plan and to flag anything it thinks is missing *before* running an enrichment pass, explicitly to avoid burning tokens/API budget on a flawed approach [29:31–29:59].
- Use **cached results** to speed up iterative testing of a prompt on a small sample before running it at full scale [25:28].
- Expect and budget time for **edge-case correction between passes** — this iterative correction loop, not the initial prompt, is where data quality is actually won [30:57–31:33].

## Tools, people, products & organisations

- **Claude Code** — Anthropic's AI coding tool; used throughout as both the data-cleaning "brain" (reading crawled page content and classifying/extracting against criteria) and the app-building tool for the directory frontend and Supabase integration. Central to the entire pipeline Frey describes.
- **Crawl4AI** — free, open-source, locally-installed "LLM-friendly" web crawler/scraper (GitHub project). Acts as the crawling "engine" that Claude Code directs; supports add-on modules like the Async Web Crawler for concurrent multi-site crawling.
- **Outscraper** — paid scraping service Frey uses to pull structured Google Maps business-listing data (name, address, etc.) at scale; described as the cheapest option he's tested versus alternatives like Apify.
- **Claude Vision / Claude API** — used specifically for the image-cleaning sub-step, selecting the best of several scraped image candidates per listing (~$30 total cost).
- **Supabase** — the database backend Frey has Claude Code build from the finalized, cleaned CSV columns.
- **Ahrefs** — SEO research tool used to validate search-volume for a niche sub-segment (the "senior living for dementia" example: 1,000+ monthly searches).
- **ChatGPT** — used informally by Frey to help draft/refine his Crawl4AI/Claude Code prompts before running them.
- **Frey** ("Mr. Directory") — returning podcast guest, co-founder of an agency called **LCA**; also working on a product called **Stretch AI** (grocery-price data play), co-founded with someone described as a former top team member at Waze. Runs a free directory-building community (3,200+ members) and posts a weekly video on his own YouTube channel. Self-describes as only ~6 months into AI coding and "not technical."
- **Parting.com** — funeral home comparison/lead-gen directory; parent of vertical SaaS product **Parting Pro** (cremation arrangement software + agency/marketing services for funeral homes).
- **APlaceForMom.com** — senior living directory; lead-gen monetization across 18,000+ listed facilities.
- **GasBuddy.com** — crowdsourced gas-price directory (since 2002); monetizes via ads and the **GasBuddy Plus** Mastercard-partnered debit card product; runs a long-running public leaderboard/rewards system for contributors.
- **"Andy"** (community member, unclear surname) — built a data.gov-sourced tap water quality directory; 40,000+ monthly visitors with no backlinks, monetized via Amazon affiliate water filter sales, accepted into the Mediavine ad network.
- **"Mark" / "Lose Trust MRR"** (name/spelling unclear in transcript) — cited as a directory built on personal brand/audience that pivoted into a business-buying/selling marketplace.
- **Mediavine** — an ad network mentioned as something a successful content/directory site can get accepted into.
- **portapottymatch.com** — Frey's own earlier (pre-Claude-Code, WordPress-built) directory, shown as a deliberately low-quality example that still generated real leads.

## Examples & use cases

- Luxury restroom trailers directory (Frey's live worked example): built in 4 days, <$250, 71,000 raw rows → 725 final verified listings.
- Inbound leads received on the *low-quality* first-generation directory (portapottymatch.com), used to prove demand exists even before quality improves: a film-shoot production needing a multi-stall trailer; a second film-shoot inquiry; a customer ("Martha") wanting an affordable porta potty with a hand-wash station; and a New Mexico State Fair order estimated at $20,000+.
- "Senior living homes for people with dementia" and "ADA accessible bathroom contractor" as illustrative sub-niche strategies for competing against dominant horizontal directories.
- Tap water quality directory (40,000+ monthly visitors, no backlinks) as proof that public/government data sources can power a fast-growing niche directory.
- "Haircut Los Angeles" vs. "hair gel" Google SERP comparison used to argue local-service SEO remains stable while product SEO has been reshaped — underpinning Frey's niche-selection rule to avoid product-based directories.

## Claims & confidence

- Parting.com gets 61,000 organic monthly visitors. [fact — reported as a direct tool/data readout by Frey, moderate confidence in underlying source tool but presented as measured, not guessed]
- Parting.com's primary revenue driver is its Parting Pro vertical SaaS/agency backend, not ads. [claim, medium confidence — Frey's stated understanding, revenue figures explicitly described as "reported"/"quoted," not verified]
- APlaceForMom.com gets 824,000 organic monthly visitors. [fact, as reported by tool]
- APlaceForMom.com revenue is likely closer to ~$50M/year despite public claims up to $500M. [opinion, low-to-medium confidence — Frey explicitly frames this as his "gut" estimate]
- GasBuddy.com gets 1.1M organic monthly visitors and likely earns $30k+/month from ads alone (lower-bound estimate). [claim, low-to-medium confidence — Frey states this is speculative given traffic profile]
- Frey built the luxury restroom trailers directory in 4 days for under $250 and saved 2,000+ hours versus manual data work. [claim, medium confidence — self-reported by the source with no independent verification, but specific and plausible given the described mechanism]
- His first, unrefined Claude-Code+Crawl4AI attempt at extracting many data fields at once produced "super low quality" results, while sequential single-attribute passes worked well. [claim/opinion, medium-high confidence — consistent, specific, repeated operational detail from firsthand experience]
- Local-service SEO (e.g., "haircut Los Angeles") has been comparatively unaffected by AI-search-driven SERP changes, unlike product-based search. [opinion, medium confidence — presented as Frey's SEO-practitioner observation, illustrated with one comparison example, not broad data]
- In an AI-search-dominated future, niche/vertical directories may benefit relative to horizontal directories because AI answers surface only a few cited sources. [opinion, low-medium confidence — forward-looking speculation from both Greg and Frey, explicitly framed as their shared read on where things are heading, not established fact]
- Scraping competitor/business website images without explicit rights carries legal risk. [claim, stated plainly by both speakers as caveated non-legal-advice — Greg explicitly notes neither is a lawyer]
- Directories are not a fast-money model; expect it not to pay off within 6 months. [opinion, high confidence in it being Frey's genuine, repeated, explicitly-caveated view]

## Caveats & source gaps

- Traffic/revenue figures for Parting.com, APlaceForMom.com, and GasBuddy are a mix of tool-reported traffic numbers (higher confidence) and revenue estimates/guesses (explicitly hedged by Frey as "reported," "quoted," or "my gut") — the transcript does not name which SEO/analytics tool was used to pull the traffic figures.
- The exact wording/spelling of "Mark" and "Lose Trust MRR" (the marketplace pivot example) is unclear from the audio transcript and could not be confirmed.
- No concrete numbers are given for the luxury restroom trailers directory's actual traffic or revenue post-launch — the segment focuses entirely on the build cost/time and data pipeline, not on outcomes after launch.
- Frey's "seven-step process" is referenced but the transcript only clearly itemizes idea, data collection (in deep multi-step detail), website build, SEO, and monetization at a high level — the SEO and monetization steps themselves are not elaborated on with specific tactics in this episode.
- The legality/ethics discussion of image-scraping is acknowledged as a real gray area but not resolved — Frey states an intent to later contact businesses for permission/claiming, but no process for that is detailed.
- No detail is given on exactly how leads are sold/priced to businesses in Frey's own directory (unlike the explicit fee/referral mechanics described for APlaceForMom.com).
- The claim that Crawl4AI is "totally free" is stated but the transcript gives no detail on compute/hosting costs of running it at scale beyond the $50 Claude API spend for the Vision image-cleaning step.

## What this means for Fusion247

*(Cairn's interpretation — not sourced from the transcript.)*

- **Direct mechanical parallel to existing myPKA/Fusion247 infrastructure.** The pipeline described (raw scrape → LLM junk-filter pass → crawl-and-classify pass → sequential single-attribute enrichment passes → structured DB → app) is architecturally close to the WS-002 import/enrichment pattern Silas already owns, and to the AsdAIr-style deterministic-pipeline-plus-judgment-layer split Warwick has used elsewhere. If a directory-style build is ever considered, the "one attribute per pass, verify between passes" discipline is directly transferable and matches Warwick's own build philosophy of iterating toward a target rather than batching everything into one fragile prompt.
- **Relevant to the "hobby brain" cost/effort calibration.** A <$250, 4-day, non-technical-founder build is squarely inside the scale Warwick has said he cares about (personal hobby brain, not enterprise) — this is evidence that small, cheap, high-leverage experiments are viable and could inform how Larry sizes any future exploratory Build.
- **Image-scraping legal gray area** is a real but low-consequence flag under the HOBBY BRAIN rule (`hobby-brain-threat-model-bar.md`) — worth remembering only if Fusion247 ever considers scraping/re-hosting third-party business images at scale; would not warrant escalating to Warwick unless it touched something he'd feel meaningfully (money, identity, public exposure).
- **Possible atom-mining candidate.** This source is dense with a reusable operational pattern (sequential-attribute-enrichment via crawler+LLM) and a strategic reframe (AI search favoring niche over horizontal aggregators) that could be worth routing to Arc/Mason if Warwick is exploring content, directory, or aggregator-style products — but that is a downstream decision, not something Cairn is making here.

## Key concepts & takeaways

- **Data is the moat.** In commoditized directory business models, the differentiator is data quality/completeness plus SEO, not the website itself.
- **Sequential, single-attribute enrichment beats one giant extraction prompt.** Batching multiple data asks into one Claude Code/Crawl4AI pass degrades output quality; isolate one attribute per pass and correct edge cases between passes.
- **Crawl4AI (crawler) + Claude Code (brain) is a two-tool pattern**: the crawler is the scale mechanism, the LLM is the judgment mechanism, and they're explicitly separated rather than combined into one tool.
- **Value-prop framework for directories: save time, save money, or help people make money** — a simple filter for evaluating any candidate niche.
- **Niche-down against giants**: find the "deal-breaker" sub-attribute (e.g., dementia care, ADA accessibility) that a mega-directory doesn't specifically serve, and own that long-tail query.
- **The counterintuitive AI-search reversal**: rather than killing directories, AI search may favor narrow, authoritative niche directories over broad horizontal ones, because AI answers cite few sources instead of surfacing many links — meaning "go niche" is now a stronger, not weaker, strategy than pre-AI-search SEO.
- **A bad directory can still validate demand.** Low production quality doesn't necessarily block lead generation if the underlying need/niche is real.
- **Directories are a distribution-first learning vehicle**, not a get-rich-quick play — Frey positions the entire practice as a low-stakes way to learn AI coding and SEO before attempting bigger products (micro-SaaS, apps).

## Actions & open questions

- If Fusion247/Warwick ever wants to prototype a directory or similar data-aggregation product, this note's 6-step enrichment pipeline (junk-filter → classify → sequential single-attribute enrichment → DB build) is a ready-made starting method to adapt.
- Verify current pricing/availability of Outscraper and Crawl4AI before treating cost figures ($100–250 total build cost) as current — this episode's cost figures are from Frey's specific run and may have changed.
- If image-scraping is ever relevant to a Fusion247 project, confirm current legal guidance rather than relying on this source's informal, explicitly-non-legal-advice caveat.
- Consider whether Frey's "AI search favors niche over horizontal directories" thesis is worth testing against any of Fusion247's own content/discovery-facing builds (e.g., anything with an SEO or content-directory component).
- No action needed on the unclear "Lose Trust MRR" name/spelling unless this thread becomes relevant — flagged as a source gap, not worth chasing down independently.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/I_wbc5ND79o/` — `tubeair-report.md` (sha256 `7bb7b4161c84…`), `manifest.json` (sha256 `3af910ebee2b…`). Preserved as captured; never edited or summarised.
