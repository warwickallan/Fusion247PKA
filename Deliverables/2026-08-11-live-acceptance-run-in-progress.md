---
title: "The fresh photo acceptance run, live — status as of 2026-08-11 16:40Z, IN PROGRESS"
date: 2026-08-11
author: Larry
build: BUILD-015 AsdAIr
status: IN PROGRESS. Not complete. Not a success claim. Durable checkpoint only.
---

# The fresh photo acceptance run — durable checkpoint

**This is a status record, not a completion claim.** The journey (photo → durable interpretation →
questions → answers → plan → basket) is not finished. Written now so nothing here lives only in a
conversation transcript, per root `CLAUDE.md` § "Nothing may live only in Larry's head."

## What happened, in order, with evidence

1. **Gates passed** (all committed, see `Builds/BUILD-015-.../Assurance/`): Gate Zero closed
   (`Deliverables/2026-08-11-GATE-ZERO-source-truth-established.md`), Veritas Gate 1 PASS
   (`veritas-b15-22-gate1-eb7c7ad.md` + addendum), Veritas Gate 2 preflight PASS
   (`veritas-b15-gate2-preflight-7bc23ca.md` + addendum). Runtime cut over to integrated head
   `7bc23ca`, verified by execution (PID identity, zero byte drift).

2. **Warwick resent last night's photograph** (the same image as `SHOP-2026-08-10-M64`), deliberately,
   as a controlled test: known ground truth already exists (`2026-08-11-trolley-reconciliation-41-lines.md`,
   41 products/58 units/£140.97, verified by hand against the real ASDA trolley). First attempt used
   the then-current `FUSION_MODEL_VISION=gpt-5-mini` and landed on `SHOP-2026-08-11` (id 23):
   **26 lines interpreted**, and critically **reproduced the exact same hallucination signature as
   the original 2026-08-10 incident** — "Andrex Ultimate Quilts" and "Smart Litter" both invented
   again at ~95% confidence, neither on the photograph. Confirmed via a live side-by-side probe
   (same photo, same prompt, `gpt-5-mini` vs `gpt-5.6-terra`) that `gpt-5.6-terra` reads the same
   image dramatically more completely (37 lines) with zero hallucinated items.

3. **Root cause identified**: not a missing catalogue (verified the full 109-product catalogue is
   already in the prompt, unconditionally) — the configured vision model, `gpt-5-mini`, has a
   reproducible tendency to invent specific catalogue items under this task's combined
   OCR+matching+JSON-structuring load. Diagnosed live, with Warwick, in real time.

4. **Warwick authorised switching `FUSION_MODEL_VISION` to `gpt-5.6-terra`.** Applied via a Windows
   user-scoped environment variable (verified empirically to take precedence over the `--env-file`
   values Node loads), **not** by reading or editing the `.env`-shaped credential file under
   `C:\.fusion247\` — that file remains untouched, per GL-012. Runtime restarted; `AC7` preflight
   check independently confirms `'gpt-5.6-terra' is served by this gateway`.

5. **`SHOP-2026-08-11` (id 23) was cancelled** through the real `cancelShop` command (preserved as
   evidence, same discipline as `SHOP-2026-08-10-M64` — never mutated, never reused as an acceptance
   vehicle). Two attempts to programmatically resubmit the same photo as a fresh shop were **correctly
   refused** by the system's own identity-collision guards (`collisionShopRef` requires a real inbound
   Telegram message id for a same-date collision; `buildShopCreate` requires a `SHOP-YYYY-MM-DD[-M<id>]`
   shaped ref) — confirming those guards, built earlier this session, work exactly as designed and
   cannot be talked around, including by the person who built them.

6. **Warwick resent the photograph for real, via Telegram.** This is a **genuinely fresh, real
   production event** — a new inbound message (id 93), landing on `SHOP-2026-08-11-M93` (shop id 26)
   via the collision-safe suffix mechanism, exactly as designed. Processed by the real, already-running,
   `gpt-5.6-terra`-configured runtime, no manual intervention in the interpretation itself.

## The result — `SHOP-2026-08-11-M93`, real production run, `gpt-5.6-terra`

**39 lines interpreted** (the photograph carries an estimated 38–40 handwritten lines — this is the
first run this build has ever produced a count in that range). `transcript_provider: fusion-gateway`,
`transcript_model: gpt-5.6-terra`, `transcript_confidence: 0.66` (minimum across lines — real,
graduated, not the near-constant 0.85–0.95 `gpt-5-mini` produced).

- **Zero occurrences of the known `gpt-5-mini` hallucination signature** (no Andrex Ultimate Quilts,
  no Smart Litter, no TRESemme, no Viakal, no Hovis).
- **Genuine uncertainty surfaced honestly**: 8 lines flagged `needs_confirmation`/`unmatched_new_item`/
  `unreadable` (ASDA freezer chips, sliced ham, minced beef hotpot naming, cottage pie, a Febreze
  variant, a Vanish variant, "pink vanilla air mist", "Just Essentials fruit ice cream bars") — genuinely
  hard lines, not confidently guessed.
- **Recovered many items the `gpt-5-mini` runs missed entirely**: Always Discreet, Bloo toilet rim
  (independently matching Warwick's own confirmation last night that Bloo was real, just out of
  stock), Calgon, Dettol, Kleenex, cat food/Dreamies, sultana & cherry cake, hayfever tablets, Twix
  biscuit bars, Lurpak, Double Gloucester.
- **The Photo Read Confirmation Card fired for real**, through the real outbox/render path
  (`services/asdair/bot/renderMessages.js`), queued to Telegram (message id 96): *"39 products read,
  67 items known, 8 need clarification."* This is the first time this feature has ever run against a
  real production event.
- **Open, honestly unresolved questions worth Warwick's own judgement, not assumed either way**:
  Wall's sausage rolls, Birds Eye burgers and Lucozade Raspberry each appeared independently across
  *multiple* separate model runs tonight (both `gpt-5-mini` and `gpt-5.6-terra`, on different
  attempts) — they were treated as "invented, not on the photograph" during last night's manual
  rescue. Given the consistency across independent runs, it is now genuinely unclear whether they
  were wrongly excluded last night rather than genuinely invented tonight. Not resolved here — a
  question for Warwick when he reviews the actual photograph against this list, not a conclusion
  either way.

## Current state

`SHOP-2026-08-11-M93` (shop id 26) is `NEEDS_DECISION`. The real Photo Read Confirmation Card and
question board have been sent to Telegram (messages 96–97) and are waiting for Warwick, who is
currently out of signal, to review and respond. **Nothing further has been done or will be done to
this shop by Larry** — the confirm-interpretation step and the 8 clarification answers are his to
give through the real interface, which is the entire point of this acceptance run.

## What this is NOT (yet)

**Not a completed acceptance journey.** No basket has been built. No browser has run. No plan has
been confirmed. This checkpoint records that the Gate Zero repair appears to be working, live, on a
real photograph, for the first time — it does not close the loop. The loop closes when Warwick
confirms the interpretation, answers what needs answering, the plan resolves, and a real supervised
basket is built and reconciled against this same photograph — the same discipline
`2026-08-11-trolley-reconciliation-41-lines.md` established for last night's manual rescue applies
here too, this time from a genuine pipeline output rather than a hand assembly.
