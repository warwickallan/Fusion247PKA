# Fusion Governance Convergence — shared interface contract (BUILD-010 WP1 ↔ BUILD-002 WP2)

**The one shared convergence/interface contract** (Phase 0). Referenced by both builds; owned jointly. No duplicated state or rules.

## Ownership split
- **BUILD-002 WP2 (Telegram control surface):** the capture worker — **sole inbound Telegram poller** — authenticates the sender (numeric allowlist + private-direct-chat, reused from WP1 capture) and, BEFORE treating a message as a capture, **detects governance commands** and **routes them to the Tower**. It never processes governance itself and never sends a second poller.
- **BUILD-010 WP1 (governance loop):** owns all durable orchestration, command execution, evidence, Codex/Larry turns, retries, and **all outbound replies** (via the durable notification outbox). The Tower never polls Telegram.

## The routing seam (durable, decoupled — no second poller, no in-process coupling)
The two services share the Supabase project (schemas `fcg` = capture, `ftw` = governance). The command handoff is **durable via the `ftw` store**, reusing WP1 machinery already built:

1. **Command detection (WP2, capture worker):** a message from the authorised private chat whose text matches a governance command grammar (below) is NOT captured. Instead the worker writes ONE durable `ftw.run_event`:
   - `source = 'telegram'`, `kind = 'command:<name>'` (e.g. `command:status`), `source_event_id = '<telegram_update_id>'` (dedup — a redelivered update never double-acts), `payload = { command, args, chat_id, sender_id, ts }` (pointers/ids only, **never a token**), `self_generated = false`.
   - Idempotent: `INSERT ... ON CONFLICT (source, source_event_id) DO NOTHING`.
   - The worker needs a **scoped `ftw`-command-intake write** only (least-privilege; it does not read governance state).
2. **Command execution (WP1, Tower):** the Tower's existing event intake ingests `command:*` events (dedup + self-loop filter already enforced), routes each to a handler, executes against durable Tower state, and **replies via the notification outbox** (`enqueueNotification` → drainer `sendMessage`). Every reply is durable, retry-safe, deduped by run+event+recipient+purpose, and tagged `[TOWER]`.

## Command grammar (authenticated, private-chat-only, deduped, auditable)
`/status` · `/trace` · `/watch on|milestones|off` · `/pause` · `/resume` · `/stop` · `/approve` — plus a run-start command (defined when the loop lands). `/approve` approves only a specifically-pending bounded decision; it **never** means merge.

- `/status` → active run id · build/WP · current state · expected responder · round/max · branch + exact head SHA · last meaningful event · current action · next action · outstanding blocker/human gate · GitHub + ClickUp links · last notification delivery state.
- `/trace` → latest 10 durable Tower events (timestamp + actor label); link to ClickUp for detail, never dump a giant review into Telegram.
- `/watch` → sets the run's notification verbosity (every transition / milestones / terminal-only).
- `/pause` → pause new agent turns after the current atomic op; `/resume` → resume; `/stop` → stop safely, never mid-write without recording `outcome_unknown`.

## Message identity (never conflate logical author with credential owner)
Every outbound message is tagged `[TOWER] | [CODEX] | [LARRY] | [CI]` (the `logical_source` in `ftw.notification_outbox`). Recorded **separately**: logical author, execution agent, and the Telegram/ClickUp **credential owner** (the existing Fusion bot identity). Telegram-platform account ≠ an independent service identity.

## Hard boundaries (both builds)
Outbound-only Tower (capture worker keeps sole polling; no 2nd consumer; no 409). No webhook/BotFather change. No autonomous merge. No secret in any prompt/log/state/message. No load-bearing state in memory/scratchpad/session — everything durable in `ftw`. No "complete" until destination writes are verified.
