# AsdAIr Stage 2 — Telegram-first interaction, and the daemon question

**For Warwick. Written 2026-07-28 by Larry, alongside the Stage 1 durability work.**
Two questions were asked. Both are answered against what is actually in the repo today, not against a wish.

---

## Question 1 — "Can I interact with Telegram rather than through Claude Code, for orders and questions?"

**Short answer: yes for most of it, and more of it already exists than you'd expect. But not for the part that
actually drives ASDA — and that limit is real, not squeamishness.**

### What already exists (verified tonight, in Git)

| Piece | Where | State |
|---|---|---|
| Telegram payload → shopping intents | `services/hub/shopper/shopperRoute.mjs` | Built + tested. Emits `add_list_item` only — never checkout, never payment, never substitution. Ambiguous lines become durable `needs_decision` intents. |
| Intent → real list rows | `services/control-plane/wp-d-proof/asdairCommands.mjs` | Built + tested. `findOrCreateDraftList()` creates the week's list and its items. |
| The executor | `services/control-plane/wp-d-proof/asdair-worker.mjs` | Built + tested. Claims intents with `FOR UPDATE SKIP LOCKED`, runs one allowlisted command, writes a visible receipt. |
| Write permission for it | live DB | `cp_worker` already holds INSERT/SELECT/UPDATE on `shopping_lists` + `shopping_list_items`. |
| Outbound Telegram | `services/fusion-capture-gateway`, `services/tower-baton/src/telegramNotifier.js`, `services/fusion-tower/src/adapters/telegramControls.js` | Live patterns for sending, and for the card → human-tap gate. |
| Inbound ShopperBot receiver | *(being committed tonight)* | Was a session scratchpad every week — the exact defect Stage 1 is closing. |

So the pipe **Telegram → list in Postgres** is essentially complete. The one honest gap tonight: **the worker is
not running and not scheduled.** Nothing drains the queue. That is a wiring job, not a build job.

### What is genuinely missing for a Telegram-first conversation

1. **The question loop.** `needs_decision` items are already durable in the database — that is the hard half, and
   it is done. What is missing is the thin loop: post the open questions as Telegram cards, take the tap/reply,
   write the answer back as a decision, resume. The card + human-tap pattern already exists in Tower and can be
   reused rather than invented.
2. **Status/answers out.** "What's on next week's list?", "why is the pepper held?" — read-only queries over the
   `asdair` schema, returned to Telegram. Low risk, genuinely useful, and the read role (`asdair_ro`) already
   exists and is SELECT-only.

### The part that cannot move to Telegram

**Driving the ASDA browser.** Adding to the trolley means operating your authenticated retail session on a live
site. Tonight's shop worked because a supervised session drove Chrome with you logged in. A daemon cannot
inherit that safely, and ASDA has no public API. Headless automation (Playwright) is possible in principle but
it is fragile against a UI that already fights us (the grid that won't scroll, blank screenshots, the stepper
trap), and it moves a consequential, money-adjacent action behind a process with no one watching.

**My recommendation: keep the browser drive supervised, permanently.** Not because it can't be automated, but
because "checkout-ready basket, human checks out" is the safety property that makes the whole thing sane. The
supervised workflow is the product — SOP-021 says so, and last night proved it.

---

## Question 2 — "Could/should AsdAIr become a daemon using an external LLM API via our existing plumbing?"

**Could: yes, and the plumbing is better than you remember. Should: partly — and less of it needs an LLM than
you'd think.**

### The bridge you were thinking of

`services/obsidiwikai/src/core/models.mjs` is a **provider-neutral, role-based model gateway**. Callers ask for a
ROLE (`reason`, `extract`, `query`, `embed`), never a provider or model name. With no gateway configured it
falls back to the box (LightRAG); set `FUSION_GATEWAY_URL` and every role call routes through LiteLLM instead —
**a config change, not a code change.** `services/obsidiwikai/src/core/llm.mjs` adds `generateJSON()` with retry
and fence-stripping on top. That is a genuinely good foundation and AsdAIr should use it rather than grow its own
client.

### The important realisation: most of AsdAIr needs no LLM at all

The planning path is already **pure deterministic Node** — `services/asdair/skill/listNormaliser.js` and
`planner.js` take a list plus the rulebook plus the regulars and produce a basket plan with no model in the loop.
That is a considerable asset. A daemon could run the whole plan step with **zero** LLM cost, zero latency and
perfect reproducibility.

An LLM is needed in exactly two places:

1. **Transcription** of Mum's handwritten photo. This is **vision**, and the gateway's `reason` role is text
   today — so this needs a vision-capable role added, or the photo continues to be transcribed in a session.
   This is the single biggest dependency, because the photo is the front door.
2. **Fuzzy judgement** on lines the deterministic matcher cannot resolve — the "B" half of the already-agreed
   A+B hybrid. Note the measured resolution rate is **52%**, so this fires often; but the correct response to a
   miss is usually *ask Warwick*, not *guess harder*.

### What a daemon would actually buy you

- The shop stops consuming a Claude Code session.
- Intake, planning, recording and learning run on a schedule without anyone present.
- The hard rules become **code-enforced** rather than agent-judgement-enforced. That is a real safety *gain* — the
  grant applied tonight is an example: the writer physically cannot retire a regular, whatever any model thinks.

### What it would cost

- Vision transcription becomes a hard dependency with a per-shop cost and a failure mode (a mis-transcribed list
  that nobody eyeballs). Mitigation: the `needs_review` flag already exists in the normaliser and the schema.
- Something unattended now touches household data weekly. It needs the same discipline as the rest: least
  privilege, receipts, and a kill switch.
- More moving parts to keep alive on the Yoga — and we already know unattended things quietly stop (the worker
  isn't running; Directus needed a logon task).

### Recommendation — three steps, in this order, and stop after 2 if it's enough

**Stage 2a — Telegram-first, still supervised. (Highest value, lowest risk.)**
Wire the receiver to the worker so a list dropped into Telegram lands as a real draft list automatically. Post
the plan and the open questions back as Telegram cards. You answer on your phone. Larry still drives the browser
when you're ready. **This gets you ~80% of what you described and changes no safety property.**

**Stage 2b — close the loop automatically.**
Recording the outcome and promoting the learning already have committed writers as of tonight. Have them run
straight after a shop instead of by hand. This is small and mostly wiring.

**Stage 2c — only if 2a/2b prove out: the planning daemon.**
Run the deterministic planner on a schedule via the model gateway for the fuzzy 48%, with vision transcription
added as a role. Still stops at "here is the basket plan, approve it". **Still never drives checkout.**

**I would not build a fully autonomous shopper.** The valuable, safe target is: *everything except the browser
drive and the checkout happens without you at a keyboard, and both of those stay yours.*

---

## The one thing to fix first, regardless

**Nothing drains the intent queue.** Until `asdair-worker` runs on a schedule, a list dropped into Telegram
becomes intents that sit there. That single wiring job is the gate on all of Stage 2a — and it needs your
go-ahead because it means something unattended starts touching the household database.
