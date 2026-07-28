---
agent_id: larry
session_id: build-015-asdair-stage1-merged
timestamp: 2026-07-28T19:11:59Z
type: close-session
linked_sops: [SOP-021-run-the-weekly-asdair-shop]
linked_workstreams: []
linked_guidelines: []
---

# BUILD-015 AsdAIr Stage 1 — merged; live operational activation deferred by owner

## Coverage window

- **Previous close checkpoint:** `[[2026-07-28-00-20_larry_delegation-doctrine-and-build-015]]`
- **Covered from:** 2026-07-28T00:20Z
- **Covered to:** 2026-07-28T19:12Z
- **First checkpoint:** no

## Context

Warwick returned to a half-built AsdAIr: the weekly shop worked *in a session* but left no durable trace, and the
capability lived in Larry's context rather than in Git and Postgres. The session ran the full arc — recover the
lost learning, close the durability gaps, then (on Warwick's ruling) fold what an earlier assessment had called
"Stage 2a/2b" into Stage 1 and finish the product. It ended with **PR #82 merged** and the runtime deliberately
left switched off.

## What we did

- **Larry** recovered the 2026-07-27 shop's learning into Supabase through the governed writers: **20 harvested
  ASDA product IDs** (coverage 21/91 → 41/97), 6 genuinely-new regulars, 5 alias sets — including `chips` →
  Crispy Skin-On Fries, which the planner previously could not resolve at all.
- **Larry** authored migrations **005–009** (regulars learning grant · shop control surface · the `rotate`
  directive · `shop_line` · machine-ledger split + question render contract) and applied them live.
- **Nine parallel workers** (fresh, worktree-isolated, disjoint ownership) built: the regulars writer, the
  committed ShopperBot receiver, the shop state store, the ShopperBot control surface, vision transcription,
  order reconciliation, `loadLastOrder` + rotation, the Cockpit `Apps ▸ Asdair ▸ Details` workspace, the
  pipeline orchestrator, the browser runner, question-button persistence, the ledger separation and the runtime
  recovery proofs.
- **Larry** integrated every branch, owned the contracts and migrations, and fixed the defects that only appear
  at the seams — including implementing the injected `questionStore` (a compare-and-set no unit test in that
  folder could have caught).
- **Larry** ran the decisive **CDP experiment**: a plain Node process drove a real authenticated ASDA session —
  added a Regular by product reference, search-added a non-Regular, used the real +/− stepper, read the basket,
  and **restored the trolley exactly**. No Claude Code, no MCP, no extension.
- **Codex** reviewed at the exact head, found one merge-blocking defect (below), and returned **READY_TO_MERGE**
  on round 2 after the fix was delta-reviewed.
- **Larry** merged PR #82 at head `981a054` with the expected-head guard (squash `443cad4`), verified main, and
  recorded the deferred activation items.

## Decisions made

- **Question:** Are Stage 2a/2b (queue draining, Telegram questions, status, outcome closure) optional?
  **Decision (Warwick):** No — they are **required parts of Stage 1**. Only Stage 2c (a persistent external-LLM
  daemon, autonomous browser, automated checkout/payment) is deferred.
- **Question:** Is "Asdair directs, Larry clicks" acceptable?
  **Decision (Warwick):** No — Larry is the build team, not the shopping runtime. The browser must be operated by
  an independently deployed product component. Proven achievable the same session.
- **Question:** Merge with the live end-to-end acceptance unproven?
  **Decision (Warwick):** Yes — merge, and record the deferred items honestly as **not proven** rather than
  redefining success.
- **Question (Larry, safety):** Sign in to ASDA on Warwick's behalf to finish the live test?
  **Decision:** No. Entering account credentials and passing a CAPTCHA are hard limits regardless of
  authorisation. Warwick offered the out; the test stays unresolved.

## Insights

- **Catalogue grounding is the product.** Grounding a vision call against the household's own catalogue turned
  *"gourmet coffee"* back into **Gourmet cat food** and took end-to-end resolution from **52% → 90%** — same
  model, same photo, grounding the only variable. Now an enforced invariant with a CI-run regression suite.
- **Integration is where the real defects live.** The bug that silently lost a shopping list existed only at the
  seam between two individually-correct modules; no module's own tests could have found it.
- **Structural constraints outperform care.** Unique indexes, CHECKs and column-scoped grants held; conventions
  and comments did not.

## Realignments

- _"AsdAIr must operate independently of Larry's Claude Code session… 'Asdair directs, Larry clicks' is an honest
  description of the current limitation, but it is NOT an acceptable permanent operating mode. Larry is the build
  team."_
- _"The current vision experiment tested the wrong product behaviour… The intended task is not 'read arbitrary
  handwriting and invent a product name.' It is 'given this household's known products and aliases, identify
  which of them each handwritten mark most likely refers to.'"_
- _"Session memory is useful reinforcement, but it is not the durable authority… A genuinely fresh Asdair must
  work without Larry's memory."_
- _"Fatigue is a reason to delegate, not a reason to leave the product unfinished."_
- _"Nothing must live permanently in scratchpads… scratchpad info must be made permanent at the end of each order
  session when the basket is deemed ready to check out."_

## Open threads

- [ ] **Live operational activation — deferred by Warwick, recorded in `ACTIVATION-DEFERRED.md`.** Four items NOT
      proven: the full weekly-shop replay, the live Telegram→browser→reconciliation path, arming
      `MyPKA-AsdAIr-Runtime`, and a genuine reboot/logon recovery. Activation is four deliberate steps and
      **begins with Warwick signing into ASDA once** in the dedicated profile.
- [ ] **The 2026-07-27 list photo expired off ShopperBot** (Telegram's 24-hour retention). The photo is retained
      on disk, so the historical replay remains possible — it needs re-sending to the bot.
- [ ] **Rules 23/24 fix the Sure variant while `rule_qa_log` #5 says rotate it.** Real, unresolved, surfaced by
      the planner as `fixed_variant_conflict → needs_decision`. Warwick's call, not Larry's.
- [ ] **`promoteDecision` deliberately not wired** — turning an answer into a standing rule changes every future
      basket and needs provenance the command surface does not yet carry.
- [ ] **Asdair's specialist contract** was rewritten to Warwick's dictation, including "sole trolley writer".
      The mechanical gate (a subagent receives no MCP tools) is recorded as proven-negative *for that mechanism*,
      and explicitly not as a limit in principle.
- Fourteen local `build-015/*` worker branches remain — harmless, merged, not pruned.

## Next steps

- **Resumption point:** **CareerAir.** Read `Deliverables/CAREERAIR-what-transfers-from-asdair.md` first — it
  names the reusable modules, the grounding invariant, the paid-for infrastructure invariants, and where
  CareerAir is genuinely *harder* than AsdAIr (LinkedIn detects automation far more aggressively, and the account
  at risk is Warwick's professional identity). Define the **catalogue and its write-back path** before anything
  else, then build the thin vertical.
- AsdAIr itself needs no engineering attention until Warwick chooses to activate it.

## VlogOps / story signals

- The correction that landed hardest: *"you tested the wrong thing"* — and the measurement that proved it, with
  "gourmet coffee" becoming Gourmet cat food and resolution jumping 52% → 90%.
- A plain 30-line Node script driving a real supermarket session, after an entire earlier session had concluded
  it was impossible — and the honest withdrawal of that verdict.
- Codex catching, at the merge gate, the one defect that would have silently lost a shopping list — the exact
  thing the build existed to prevent.
- A test deliberately written to assert a known defect, going red the day it was fixed, and being inverted to
  assert survival.
- "Fatigue is a reason to delegate, not a reason to leave the product unfinished" — and four fresh workers
  finishing what a tired orchestrator could not.

## Cross-links

- `[[2026-07-28-00-20_larry_delegation-doctrine-and-build-015]]` — previous close checkpoint.
- `[[SOP-021-run-the-weekly-asdair-shop]]` — the operating method, now carrying the grounding invariant.
- `Builds/BUILD-015-asdair-durable-household-shopping-steward/ACTIVATION-DEFERRED.md` — what is NOT proven.
- `Deliverables/CAREERAIR-what-transfers-from-asdair.md` — the forward handoff.
