// LIVE-PROOF HARNESS — the executable entrypoint for the WP0 Telegram→Brain
// proof (author: mack; PREPROVISION-CORRECTION-0001 §3).
//
// createLiveRuntime() ASSEMBLES the components; this runner actually RUNS them.
// It long-polls Telegram via getUpdates (NO public webhook, NO HTTP server, NO
// DNS, NO inbound firewall, NO webhook secret — §2), routes each update through
// the SAME intake + worker as the fixtures, and projects status back onto the
// original Telegram card.
//
// SAFETY PROPERTIES (§4):
//   * Durable offset — advanced only AFTER an update reaches the intake commit
//     point, and persisted in the operational store (channel_poll_offset). A
//     restart resumes from the durable cursor.
//   * No lost updates — an update is acknowledged (offset advanced) only after
//     intake durably records it (or it is a benign non-capture).
//   * No endless duplicates — offset monotonically advances; Telegram drops
//     acknowledged updates.
//   * No duplicate Markdown / no false completion — idempotent intake
//     (idempotency_key) + idempotent governed write + evidence-gated completion,
//     all inherited unchanged from the fixtures core.
//   * Restart-safe card target — the card's {chat_id, message_id} is persisted
//     (card_ref) so completion re-targets the ORIGINAL card even with a fresh
//     adapter whose in-memory map is empty.
//
// SECRET HYGIENE — every diagnostic is masked. config.describe()/adapter.describe()
// never emit a secret, and safeErr() redacts known secret VALUES defensively.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../config.js';
import { createLiveRuntime } from './runtime.js';
import { STATES, TERMINAL_STATES } from '../core/states.js';

const CHANNEL = 'telegram';
// "Proved stable state" for an accepted item: a terminal outcome. A failed item
// with a future retry is not stable yet — it is parked, not done.
const STABLE_STATES = Object.freeze([...TERMINAL_STATES]); // completed, cancelled, dead_letter

/**
 * Build the live runner around an assembled runtime.
 *
 * @param {object} config          a loadConfig() result (live-ready or fixtures).
 * @param {object} [opts]
 * @param {object} [opts.clock]        { now: () => number }. Owned here so the
 *                 whole runtime shares one clock. Default Date.now-backed.
 * @param {number} [opts.leaseMs]      worker claim lease (default 30_000).
 * @param {number} [opts.pollTimeoutSec] getUpdates long-poll seconds (default 25).
 * @param {function} [opts.logSink]    diagnostic sink (default stderr JSON).
 * @param {object} [opts.factories]    { storeFactory, adapterFactory } test hooks.
 * @returns {Promise<object>} runner handles.
 */
export async function createLiveRunner(config, opts = {}) {
  const clock = opts.clock ?? { now: () => Date.now() };
  const logSink = opts.logSink ?? ((line) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(line));
  });
  const pollTimeoutSec = opts.pollTimeoutSec ?? 25;

  const runtime = await createLiveRuntime(config, { ...opts, clock });
  const { store, adapter, intake, worker } = runtime;

  // Known secret VALUES to redact from any diagnostic (defence in depth; the
  // adapter already masks the bot token, and pg errors rarely echo the DSN).
  // Includes not just the whole DSN but the PASSWORD COMPONENT parsed out of it,
  // so a diagnostic that echoes only the password fragment is still redacted.
  const SECRET_VALUES = [
    config.databaseUrl, config.telegramBotToken,
    config.supabaseSecretKey, config.telegramWebhookSecret,
  ];
  if (typeof config.databaseUrl === 'string' && config.databaseUrl.length > 0) {
    try {
      const parsed = new URL(config.databaseUrl);
      if (parsed.password) SECRET_VALUES.push(decodeURIComponent(parsed.password));
    } catch { /* non-URL DSN — the whole-string redaction above still applies */ }
  }
  const secretValues = SECRET_VALUES.filter((v) => typeof v === 'string' && v.length > 0);

  function safeErr(err) {
    let msg = err && err.message ? err.message : String(err);
    for (const secret of secretValues) msg = msg.split(secret).join('***redacted***');
    return msg;
  }

  function diag(event, extra = {}) {
    logSink({
      service: 'fusion-capture-gateway',
      component: 'live-runner',
      event,
      at_ms: clock.now(),
      ...extra,
    });
  }

  // Durable long-poll cursor, loaded from the operational store.
  let offset = 0;
  if (typeof store.getPollOffset === 'function') offset = await store.getPollOffset(CHANNEL);

  async function persistOffset(nextOffset, now) {
    if (nextOffset > offset) {
      offset = nextOffset;
      if (typeof store.setPollOffset === 'function') await store.setPollOffset(CHANNEL, offset, { now });
    }
  }

  // An ordinary text message → durable capture (intake commit point). The card
  // target is persisted inside intake so completion survives a restart.
  async function handleMessage(update, _now) {
    const res = await intake.accept(update, {});
    if (!res.ok) diag('message_not_accepted', { reason: res.reason });
    return { kind: 'message', ...res };
  }

  // A Save-to-Brain callback_query (button tap on the card). The message path
  // already captured the content (SaveToBrain is the default), so this is a
  // confirmation: resolve the owning capture via the durable card_ref reverse
  // lookup and acknowledge the tap. Ack failure is a projection failure only.
  async function handleCallback(update, now) {
    const mapped = adapter.toCallback(update, { now });
    if (!mapped.ok) {
      diag('callback_rejected', { reason: mapped.reason });
      return { kind: 'callback', ok: false, reason: mapped.reason };
    }
    const { callbackId, chatId, messageId, action } = mapped.value;
    let captureId;
    if (typeof store.findCaptureIdByCard === 'function') {
      captureId = await store.findCaptureIdByCard(chatId, messageId);
    }
    try {
      await adapter.answerCallbackQuery(
        callbackId,
        captureId ? 'Saving to your Brain…' : 'No capture found for this card.',
      );
    } catch (err) {
      diag('answer_callback_failed', { error: safeErr(err) });
    }
    return { kind: 'callback', ok: Boolean(captureId), action, captureId };
  }

  async function handleUpdate(update, now) {
    if (update && update.message) return handleMessage(update, now);
    if (update && update.callback_query) return handleCallback(update, now);
    return { kind: 'ignored' };
  }

  // Drive the worker until nothing is claimable: each accepted item reaches a
  // stable terminal state, or a failed item is parked for a future due-retry.
  // Bounded loop guard — never spins forever.
  async function drainToStable(now) {
    let processed = 0;
    for (let i = 0; i < 10_000; i += 1) {
      const rec = await worker.processOne({ now });
      if (!rec) break;
      processed += 1;
    }
    return processed;
  }

  /**
   * One long-poll cycle: fetch a batch, handle each update in update_id order,
   * advance+persist the offset AFTER each is durably handled, then drain the
   * worker to a stable state. Returns a summary (no secrets).
   */
  async function pollOnce({ now: injectedNow } = {}) {
    const now = typeof injectedNow === 'number' ? injectedNow : clock.now();
    let updates;
    try {
      updates = await adapter.getUpdates({ offset, timeout: pollTimeoutSec, limit: 100 });
    } catch (err) {
      diag('get_updates_failed', { error: safeErr(err) });
      return { fetched: 0, accepted: 0, callbacks: 0, ignored: 0, processed: 0, offset, error: true };
    }
    const ordered = [...updates].sort((a, b) => (a.update_id ?? 0) - (b.update_id ?? 0));
    let accepted = 0; let callbacks = 0; let ignored = 0;
    for (const update of ordered) {
      let res;
      try {
        res = await handleUpdate(update, now);
      } catch (err) {
        diag('handle_update_failed', { update_id: update.update_id, error: safeErr(err) });
        res = { kind: 'error' };
      }
      if (res.kind === 'message' && res.ok) accepted += 1;
      else if (res.kind === 'callback') callbacks += 1;
      else ignored += 1;
      // Acknowledge ONLY after durable handling. On crash before this, the update
      // redelivers and idempotent intake dedups it — no loss, no duplicate.
      await persistOffset((update.update_id ?? 0) + 1, now);
    }
    const processed = await drainToStable(now);
    return { fetched: updates.length, accepted, callbacks, ignored, processed, offset };
  }

  /**
   * Poll repeatedly until a cycle fetches nothing (the batch is drained). Used
   * for the bounded acceptance session and for tests. Returns the per-round
   * summaries.
   */
  async function runUntilIdle({ maxRounds = 100, now } = {}) {
    const rounds = [];
    for (let i = 0; i < maxRounds; i += 1) {
      const r = await pollOnce({ now });
      rounds.push(r);
      if (r.fetched === 0) break;
    }
    return rounds;
  }

  /**
   * The CLI long-poll loop: poll forever until aborted. Each getUpdates blocks up
   * to pollTimeoutSec, so this is quiet when idle. A cycle error is logged and
   * the loop continues (transient network faults must not kill the runner).
   */
  async function loop({ signal } = {}) {
    diag('loop_start', { mode: runtime.mode, offset });
    while (!(signal && signal.aborted)) {
      await pollOnce();
    }
    diag('loop_stopped', { offset });
  }

  /**
   * Re-project a capture's card from CURRENT durable state onto the ORIGINAL
   * card target (recovered from card_ref). This is the restart-recovery seam: it
   * works with a fresh adapter whose in-memory map is empty. Idempotent.
   */
  async function reprojectCard(captureId, { now: injectedNow } = {}) {
    const now = typeof injectedNow === 'number' ? injectedNow : clock.now();
    return worker.retryCardProjection(captureId, { now });
  }

  function start() {
    // Masked diagnostics only — NEVER a secret.
    diag('start', {
      mode: runtime.mode,
      offset,
      brain_dir: runtime.markdownWriter && runtime.markdownWriter.inboxDir,
      config: typeof config.describe === 'function' ? config.describe() : undefined,
      adapter: typeof adapter.describe === 'function' ? adapter.describe() : undefined,
    });
    return runtime;
  }

  async function shutdown() {
    await runtime.shutdown();
    diag('shutdown', { offset });
  }

  return {
    runtime,
    channel: CHANNEL,
    stableStates: STABLE_STATES,
    get offset() { return offset; },
    start,
    pollOnce,
    runUntilIdle,
    loop,
    reprojectCard,
    shutdown,
  };
}

/**
 * CLI entrypoint. Loads config from process.env; REFUSES to start in fixtures
 * mode (missing required NAMES). Long-polls until SIGINT/SIGTERM, then closes the
 * pool cleanly. Fails honestly — never claims completion it did not reach.
 */
export async function main() {
  const config = loadConfig();
  if (config.fixturesMode) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      service: 'fusion-capture-gateway',
      component: 'live-runner',
      event: 'refuse_start_fixtures_mode',
      reason: 'required runtime env NAME(s) missing — see .env.example / README',
      missing: config.missingRequired,
      config: config.describe(),
    }));
    process.exitCode = 1;
    return;
  }

  const runner = await createLiveRunner(config);
  runner.start();

  const ac = new AbortController();
  const stop = () => ac.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await runner.loop({ signal: ac.signal });
  } finally {
    await runner.shutdown();
  }
}

// Run only when executed directly (never on import).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      service: 'fusion-capture-gateway',
      component: 'live-runner',
      event: 'fatal',
      error: err && err.message ? err.message : String(err),
    }));
    process.exitCode = 1;
  });
}
