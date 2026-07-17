---
agent_id: mack
session_id: build-010-wp1-human-decision-gate
timestamp: 2026-07-17T19:20:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-010 WP1 — the HUMAN DECISION GATE (Codex review → Telegram cards → human tap → THEN Larry)

Worktree `C:\Fusion247PKA-b010wp1` only, branch `build-010/wp1-reliable-autonomous-governance-loop`
(from HEAD 7becede). Committed **58e1f89**. Not pushed.

## What I built (spec = OI §4a, the Warwick-approved contract)

The safety valve: Larry does not act on a Codex review until Warwick taps a card on his
private Telegram. A Codex review posts a concise `[CODEX]` summary WITH option cards
(✅ Proceed / ⏸ Hold / 🛑 Stop) and the loop HALTS in `awaiting_decision`; only a recorded
**Proceed** lets the loop dispatch a Larry correction turn. A card is NEVER a merge.

- **Migration `0006_wp1_notification_cards.sql`** (chain 0001→0006):
  - `ftw.notification_outbox.reply_markup jsonb` (nullable) — the durable inline-keyboard
    so a restart still sends the buttons. POINTERS/labels only; the 0004 token/sent/dedup
    invariants are untouched.
  - `ftw.decision_gate` — the durable pending-decision marker: run + `review_head_sha` +
    `allowed_decisions` + a compact `gate_token` carried in the button callback_data.
    ONE pending gate per run (partial unique index); `decided` requires
    decision+decided_by+decided_at; decision vocab is `proceed|hold|stop` ONLY (no merge).
    RLS deny-by-default, service_role-only. No enum (text+CHECK) → no name collision.
- **`src/core/decisionGate.js`** — `postCodexReviewGate` (open gate + enqueue carded
  `[CODEX]` + full-review link + park awaiting_decision + HALT), `handleDecisionEvent`
  (auth re-check silent-deny, atomic validate+record once, one effect proceed/hold/stop,
  `[TOWER]` confirm), `assertLarryDispatchAllowed` (STRUCTURAL lock), card/callback helpers.
- **Stores** — `openDecisionGate` (idempotent per head, supersede on new head),
  `getPending/getLatest/getByToken`, `recordDecisionGate` (atomic pending→decided,
  idempotent reject: already-decided / superseded / stale-head / not-allowed). Both
  memory + real-PG, behaviourally identical.
- **telegramNotifier** — enqueue carries optional `replyMarkup` (secret-scanned incl. the
  card JSON); `client.sendMessage(recipient,text,{replyMarkup})` sends it; `drainOnce`
  forwards the durable card. Still OUTBOUND-ONLY — no poller (WP2 owns the sole inbound poll).
- **Dispatcher wiring** — `dispatchNextTurn` structurally refuses a Larry turn while a gate
  is open/held; `reviewGate()` is the post-review call; `drainCommandEvents` routes
  `command:decision` to the gate handler; `runTurn` surfaces `gateRequired`.

## Structural proof (the load-bearing claim)

A Codex review CANNOT reach a Larry turn without a recorded Proceed. Enforced by
`assertLarryDispatchAllowed` inside `dispatchNextTurn`: no gate → allowed (first turn);
gate pending → THROWS; gate decided ≠ proceed → THROWS; gate decided proceed → allowed.
Proven in `decisionGate.test.js` test 2 (blocked while pending) + test 3 (reachable only
after Proceed).

## Verify (real counts)

- **no-DB** `node --test`: 288 tests, **235 pass, 53 skip, 0 fail**.
- **real-PG** throwaway scoop cluster, port **54342**, `--test-concurrency=1`, chain
  0001→0006: full suite 288 tests, **287 pass, 1 skip, 0 fail** (the 1 skip is a
  claude/staged-evidence-gated live proof when unavailable — it RAN and passed here).
  The 3 integration files alone: 48 pass, 0 fail (incl. 8 new gate tests: reply_markup
  persistence, gate open/supersede/record, **durable gate + restart** survives a store
  restart and is still tappable, RLS deny-by-default, DB CHECK refuses `decision='merge'`).
- **secret scan** `scripts/secret-scan.sh`: clean, 421 tracked files, 0 hits.
- Cluster stopped + `C:/pgs54342` removed after the run.

## Gotcha for the next agent

`larryNorelayAck.test.js` applied only migrations 0001→0003 (WP0-era). My new Larry-dispatch
guard reads `ftw.decision_gate`, so on that partial schema the guard hit a missing table and
the real-claude restart proof failed. Fix: brought that test's MIGRATIONS array to the full
0001→0006 chain (additive-only; run/turn behaviour unchanged). **Any real-PG test that
dispatches a Larry turn now needs the decision_gate table present** — apply the full chain.

## Boundaries honoured

Outbound-only (no second poller — the tap arrives as WP2's `command:decision` event, which
this slice PROCESSES). No live Supabase apply (throwaway cluster only). No autonomous merge
anywhere — a card is proceed/hold/stop, never merge (asserted in code, the DB CHECK, and the
no-merge source-scan test). No push.

## Next resumption point

WP2 wires the capture-worker to emit the `command:decision` event on a callback_query tap
(single poller) and calls `dispatcher.decision(event)` / `drainCommandEvents`; the loop
driver calls `dispatcher.reviewGate(...)` after a returned Codex review and, on a Proceed
(`dispatchLarry:true`), dispatches the Larry correction turn.
