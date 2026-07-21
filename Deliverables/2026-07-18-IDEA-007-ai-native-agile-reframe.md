# IDEA-007 — AI-native agile reframe (intent-first)

**From:** Warwick (via GPT), `IDEA-007-AI-NATIVE-AGILE-REFRAME-0001` · **Reframed by:** Larry · **Date:** 2026-07-18

> Supersedes the tools-outward framing in `2026-07-18-build-management-system-of-record-RECOMMENDATION.md`. That doc's *tools* are demoted to implementation details here; its one durable idea (git already holds the truth) survives and gets bigger.

**The proof this thesis is right already happened tonight:** Warwick got bored, left Tower admin unfinished → got blocked on TubeAIR → which surfaced that Tower was actually broken → fixing Tower produced something far better → and GPT (not Warwick) summoned Fable. **The best outcome came from the *un-planned* middle.** A rigid idea→PRD→tickets→sequence plan would have *prevented* that discovery. The mess was the method. That is the whole argument for a graph, not a pipeline.

## 1. What Warwick is actually asking for (plain English)
"I'll give the story, the destination, what matters, what must not happen, and I'll make the big calls and the final call. **Stop making me the clipboard in the middle.** Let me change my mind — 'combine those,' 'drop that,' 'try a different route,' 'keep the outcome, change everything else' — and have the AI team reorganise the work itself, without me rebuilding plans or tickets." Agility and low admin over ceremony and zero-loss guarantees. A hobby, not NASA.

## 2. What the AI-native graph contains
Nodes: **ideas · outcomes · requirements · decisions · assumptions · risks · work-packages · code-changes · tests · reviews · evidence · learnings.** Edges: *depends-on · affects · derives-from · verifies · supersedes · parallel-with.* The AI's job is to keep the edges honest and continuously answer: what breaks if this moves, which decisions are affected, what still applies, what can run in parallel, does the whole product still make sense. Nodes are movable / splittable / mergeable / reconnectable — never frozen tickets.

## 3. Which current tools are *merely implementation details*
**All of them** — git, Supabase, Directus, MCP, ClickUp, schemas, PostgREST. They are the substrate the graph is stored and rendered in. Swappable. **Warwick never needs to know they exist.** The product is the graph + the reshaping, not the plumbing.

## 4. The BIG unlock — you already own the graph
The myPKA wiki (`Team Knowledge` / `PKM`) is *already* an Obsidian-shaped graph: linked-markdown nodes, wikilinks as edges, versioned in git (free immutable history + rollback). **We don't need to build a store.** The minimum practical foundation to add is small:
- a lightweight **node convention** (each idea/outcome/decision/work-package/evidence = one linked markdown node with a tiny frontmatter: type, status, links);
- a small set of **agent reshape operations** Larry performs on plain-English commands: *decompose, split, merge, move, supersede, reconcile* ("what breaks if I move this?");
- a **conversational control surface** (talk to Larry) + a simple read-only view of intent→outcomes→open-decisions.

That's it. No new platform.

## 5. What stays deliberately loose / experimental
The entire middle: sequencing, work-package boundaries, the route, which agent does what, what gets discarded, what gets reconstructed. No fixed tickets, no locked plan, no mandated order. Discarding work is allowed. Occasional rework is acceptable.

## 6. How Warwick interacts (no stack knowledge)
He talks to Larry in plain English about story / outcome / decisions. He sees a simple picture: **intent, outcomes, and the handful of open decisions** — never SQL, tickets, branches or merge conflicts. Nudges by voice/text ("drop that," "combine those," "try another route"). Telegram for milestones and decisions.

## 7. Proposed user journey (idea → outcome)
1. Warwick describes an idea + destination + what-must-not-happen. 2. Larry decomposes it into a live graph of nodes. 3. Agents work packages **in parallel** (Mack builds, Codex QAs, Fable stress-tests) continuously reconciling coherence. 4. Larry surfaces **only** genuine decisions / material changes / final acceptance. 5. Warwick nudges; the graph reshapes; discarded branches keep their history. 6. Outcome ships. He supplied story + judgment; the agents supplied and reshaped the route.

## 8. How the team operates autonomously in the middle
This is the loop we **already proved tonight** — it *is* the middle-engine: **Opus/Larry** orchestrates + maintains the graph; **specialists** (Mack, Silas…) execute nodes; **Codex** does independent read-only QA on each change; **Fable** is the adversarial gate at material points; **Tower** carries the baton (checkpoint → QA → back to Larry) so the reconciliation runs without Warwick relaying anything. They reconcile continuously and escalate only material things.

## 9. What genuinely returns to Warwick
Only his four control points: **(1) original intent, (2) major decisions, (3) material changes** (scope / security / cost / irreversible / merge / deploy), **(4) final acceptance.** Everything else — routine corrections, sequencing, package boundaries, tool choices — stays with the agents.

## 10. The smallest spike that proves the concept (no giant platform)
**Run one small, real build entirely as a reshaping graph in the existing wiki, where Warwick only supplies intent + a few plain-English nudges + the final yes — and never touches a ticket.**
- Pick a bite-sized idea (NOT Tower — something small).
- Larry represents the whole thing as ~8–12 linked markdown nodes in git (idea, outcome, 2–3 decisions, a few work-packages, evidence).
- Agents work it via the tonight-proven loop.
- **The proof move:** partway, Warwick issues 2–3 reshape commands — e.g. "combine those two packages," "drop that one," "keep the outcome but try a totally different route" — and Larry reorganises the graph + the work **without Warwick rebuilding anything**, while flagging honestly what that break-and-remake affected.
- **Success test (Warwick's own):** *"Could I move fast, change my mind, and let the AI team reorganise and recover — without becoming the clipboard, PM or systems engineer?"* If yes on one small build, the concept is proven and we widen it. If it needs a database later, that's an invisible upgrade under the same graph — decided by evidence, not up front.

## Proportionate safeguards (not governance theatre)
Keep only what saved us tonight and costs nothing: git's immutable history + rollback (free), a human gate on material/irreversible actions, no secret exposure, no destructive mistakes. Drop enterprise ceremony, zero-loss obsession, and "prevent every theoretical failure." The test is speed-of-mind-change and AI recovery, not guaranteed-zero-loss-forever.

## Related
[[ai-native-dev-model-vision]] · [[multi-model-build-verify-loop]] · [[build-inputs-need-prd-and-robust-home]]. Register as **IDEA-007** in Foundry (idea layer) per the Foundry↔build-record boundary.
