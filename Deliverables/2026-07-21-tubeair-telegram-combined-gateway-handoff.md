# Next-session handoff — Telegram → auto-categoriser → TubeAIR → combined gateway

_Produced 2026-07-21 at the close of the Tower merge-QA + Directus cockpit closeout (Larry session `f458a6bc`). This is the cold-start brief for the next working session. Nothing below has been built this session — it is the agreed direction to resume from._

## The one-line vision (Warwick's words)
> "A message is just text. **Save to Brain** should trigger the categoriser — the user never picks the bot or the channel."

The whole flow, end to end:

```
Telegram message (any kind)
  → automatic categorisation (what is this? reflection / knowledge / YouTube link / task / …)
  → route to the right processor:
        • YouTube link      → TubeAIR (transcript → packet)
        • reflection/journal → Penn (journal)
        • external knowledge → Cairn (intake/file)
        • …
  → canonical brain (the single home per SSOT)
  → visibility in the Directus cockpit (report/record shows up)
  → Telegram completion / failure receipt back to Warwick
```

The user sends one message; the system decides the type, does the work, files it in the one right place, and reports back. No more "which bot / which channel" decision on the human.

## What already exists to build on (do NOT rebuild)
- **TubeAIR (IDEA-013)** — local YouTube transcript→packet tool at `tools/tubeair/`. Inbox-handoff to FusionDevBot, Cairn downstream (`pending_cairn`), single combined report. See memory `[[tubeair-idea-013-build]]` for how to run it. This is the YouTube-link branch of the categoriser.
- **Directus live cockpit (BUILD-014 WP-D, merged PR #55, 2026-07-21)** — the private-tailnet report surface where routed records become visible. Real MyPKA Supabase, least-priv `cp_directus` read + `cp_worker` write-back seam. This is the "Directus report visibility" step.
- **The gateway pattern already in the repo** — capture-gateway (`C:/.fusion247/`) + the bot split (DevBot = Warwick's channel, TowerBot = Codex's channel). The combined gateway generalises this: one intake, categorise, fan out.
- **Larry ding mechanism** (`larry-ding.mjs` via FusionDevBot) — the "Telegram completion/failure receipt" primitive already works.

## Design tensions to resolve first (open questions for next session)
1. **Where the categoriser runs** — a gateway edge function vs a local worker vs Directus flow. Leans local worker first (thin slice), matching the existing capture-gateway.
2. **Classification method** — Claude call on the raw text (cheap, flexible) vs rules-first-then-LLM (the AsdAIr A+B hybrid pattern, `[[asdair-idea012-runtime]]`). Probably rules for the obvious (URL → YouTube regex) + LLM for the ambiguous.
3. **The "one message is just text" ingestion** — a single Telegram bot/inbox that everything lands in, replacing the per-purpose bot choice. Confirm whether DevBot becomes that single door or a new dedicated intake bot.
4. **Canonical-brain routing contract** — reuse the existing intake handoff (`pending_cairn`, Penn, etc.) rather than inventing a new one; the categoriser only *decides + dispatches*.

## Method reminders (standing — apply when this build starts)
- **Deliver a thin working slice first** (`[[deliver-thin-working-slice-first]]`): the smallest end-to-end path — e.g. Telegram text → detect YouTube link → TubeAIR → receipt — before any categoriser breadth or governance.
- **Personal data never on the public repo** (`[[personal-data-never-public-repo]]`): Fusion247PKA is PUBLIC; any entrusted/personal content stays private Supabase + gitignored-local.
- **Merge-ready means independently reviewed** (`[[merge-ready-means-independently-reviewed]]`) via the now-merged Tower bounded merge-QA tool, with the **Builder Preflight** run before each merge-check.
- **Larry owns the build method** (`[[larry-owns-the-build-method]]`): Foundry impl plans are context, not prescription.

## Carried-over item
- A Penn note was handed off earlier this session (the journal-image message) to be actioned "when we come back to TubeAIR and unified gateway after this." Pick that up as part of this work — check `Team Inbox/` and the Penn handoff.

## First action next session
Confirm items 1–4 above with Warwick (one round of decisions), then build the **thin slice**: single Telegram intake → categoriser detects a YouTube URL → routes to TubeAIR → packet lands in the canonical brain → Directus shows it → Telegram receipt. Everything else (more categories, learning loop, richer routing) comes after that slice works.

_Related memory: `[[unified-gateway-categoriser-vision]]`, `[[tubeair-idea-013-build]]`, `[[asdair-idea012-runtime]]`, `[[build-014-control-plane-runtime]]`._
