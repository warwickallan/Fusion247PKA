// FTW command-intake writer (BUILD-002 WP2).
//
// A THIN, LEAST-PRIVILEGE writer of ftw.run_event rows for the governance SIGNALS
// the sole Telegram poller (the capture worker) detects — governance COMMANDS and
// decision-card TAPS. It is NOT a full ftw store: it never reads or advances runs,
// never touches turns, never sends governance replies. The Fusion Tower (WP1)
// consumes these events (dispatcher / notifier); WP2 only DETECTS + WRITES them.
//
// Two shapes, both deduped on (source, source_event_id) via ON CONFLICT DO
// NOTHING (mirrors the ftw.run_event primary dedup constraint from ftw 0001):
//   * command  → kind='command:<name>',    source_event_id='<update_id>'
//   * decision → kind='command:decision',  source_event_id='cb:<callback_query.id>'
//
// SECURITY: payload carries POINTERS + sanitised metadata ONLY — no secrets, no
// governed content (BUILD-002 evidence-pointer doctrine, ftw 0001 SECURITY gate).
// self_generated=false: these are genuine human ingress, never a Tower self-loop.
//
// NO `pg` DEPENDENCY: the Postgres writer receives an INJECTED `query` function
// (the operational store's own service_role pool, reused — not a second
// connection). Importing this module never opens a socket, so the unit suite
// loads it freely and drives the in-memory writer.

export const FTW_EVENT_SOURCE = 'telegram';

// ── run_event arg builders (shared by both backends) ─────────────────────────

function commandEventArgs({ command, args, chatId, senderId, updateId, now }) {
  return {
    source: FTW_EVENT_SOURCE,
    source_event_id: String(updateId),
    kind: `command:${command}`,
    payload: {
      command,
      args: Array.isArray(args) ? args : [],
      chat_id: chatId != null ? String(chatId) : null,
      sender_id: senderId != null ? String(senderId) : null,
      ts: new Date(now).toISOString(),
    },
    self_generated: false,
  };
}

function decisionEventArgs({
  callbackData, decision, gateToken, chatId, senderId, messageId, callbackId, now,
}) {
  return {
    source: FTW_EVENT_SOURCE,
    source_event_id: `cb:${callbackId}`,
    kind: 'command:decision',
    payload: {
      callback_data: callbackData,
      decision,
      gate_token: gateToken,
      chat_id: chatId != null ? String(chatId) : null,
      sender_id: senderId != null ? String(senderId) : null,
      message_id: messageId != null ? String(messageId) : null,
      ts: new Date(now).toISOString(),
    },
    self_generated: false,
  };
}

// ── in-memory writer (fixtures / unit suite) ─────────────────────────────────

/**
 * In-memory ftw command-intake writer. Same interface as the Postgres writer,
 * with the SAME (source, source_event_id) dedup — so the unit suite proves the
 * routing + dedup without a database.
 */
export function createInMemoryFtwCommandIntake() {
  const events = [];
  const byKey = new Map(); // `${source}:${source_event_id}` -> event

  function insert(args) {
    const key = `${args.source}:${args.source_event_id}`;
    if (byKey.has(key)) return { event: { ...byKey.get(key) }, isNew: false };
    const event = { event_id: `ftw_${events.length + 1}`, run_id: null, ...args };
    byKey.set(key, event);
    events.push(event);
    return { event: { ...event }, isNew: true };
  }

  return {
    async recordCommandEvent(input) { return insert(commandEventArgs(input)); },
    async recordDecisionEvent(input) { return insert(decisionEventArgs(input)); },
    /** Test/inspection helper — a copy of every recorded event (no secrets). */
    list() { return events.map((e) => ({ ...e })); },
  };
}

// ── Postgres writer (live) ───────────────────────────────────────────────────

/**
 * Postgres ftw command-intake writer. Reuses the operational store's service_role
 * connection via an injected `query(text, params)` passthrough — no second pool.
 * The ONLY SQL it ever runs is the scoped ftw.run_event insert/select below
 * (least privilege). Fail-fast if no `query` is supplied.
 *
 * @param {object} args
 * @param {(text:string, params:any[]) => Promise<{rows:any[]}>} args.query
 */
export function createPgFtwCommandIntake({ query } = {}) {
  if (typeof query !== 'function') {
    throw new Error(
      'createPgFtwCommandIntake: query function required (reuse the operational store service_role connection)',
    );
  }

  async function insert(args) {
    const inserted = await query(
      `insert into ftw.run_event (source, source_event_id, kind, payload, self_generated)
       values ($1::ftw.event_source, $2, $3, $4::jsonb, $5)
       on conflict (source, source_event_id) do nothing
       returning event_id`,
      [args.source, args.source_event_id, args.kind, JSON.stringify(args.payload), args.self_generated],
    );
    if (inserted.rows.length > 0) {
      return { event: { event_id: inserted.rows[0].event_id, run_id: null, ...args }, isNew: true };
    }
    // Conflict → already ingested (dedup). Read the winner back so the caller has
    // the existing event.
    const existing = await query(
      `select event_id, run_id, source, source_event_id, kind, payload, self_generated
         from ftw.run_event
        where source = $1::ftw.event_source and source_event_id = $2`,
      [args.source, args.source_event_id],
    );
    return { event: existing.rows[0] ?? null, isNew: false };
  }

  return {
    async recordCommandEvent(input) { return insert(commandEventArgs(input)); },
    async recordDecisionEvent(input) { return insert(decisionEventArgs(input)); },
  };
}
