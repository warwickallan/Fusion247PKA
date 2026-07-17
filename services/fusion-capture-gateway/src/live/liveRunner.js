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

import { loadConfig, buildSecretRedactor } from '../config.js';
import { createLiveRuntime } from './runtime.js';
import { STATES, TERMINAL_STATES } from '../core/states.js';
import { projectCard } from '../receiptProjection.js';

const CHANNEL = 'telegram';
// "Proved stable state" for an accepted item: a terminal outcome. A failed item
// with a future retry is not stable yet — it is parked, not done.
const STABLE_STATES = Object.freeze([...TERMINAL_STATES]); // completed, cancelled, dead_letter

// getUpdates long-poll wait, seconds. LIVE FINDING (2026-07-17, Warwick's home
// network): the consumer router/NAT silently kills any TCP connection held open
// ≥~45s — every empty long-poll died at ~45s ("fetch failed", metronomic, 6+
// observed), and the poisoned keep-alive socket then failed the NEXT Bot API
// call too (a sendMessage right after a successful fetch). 25 seconds stays
// safely under the observed ~45s middlebox kill window; the adapter's one-shot
// transient-network retry covers the poisoned-socket residue.
export const POLL_WAIT_SECONDS = 25;

// Card-send recovery sweep: at most this many cardless pending captures are
// re-offered a card per poll cycle (bounded — never an unbounded backfill).
const CARD_RECOVERY_LIMIT = 3;

/**
 * Build the live runner around an assembled runtime.
 *
 * @param {object} config          a loadConfig() result (live-ready or fixtures).
 * @param {object} [opts]
 * @param {object} [opts.clock]        { now: () => number }. Owned here so the
 *                 whole runtime shares one clock. Default Date.now-backed.
 * @param {number} [opts.leaseMs]      worker claim lease (default 30_000).
 * @param {number} [opts.pollTimeoutSec] getUpdates long-poll seconds (default
 *                 POLL_WAIT_SECONDS — must stay under the ~45s NAT kill window).
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
  const pollTimeoutSec = opts.pollTimeoutSec ?? POLL_WAIT_SECONDS;

  const runtime = await createLiveRuntime(config, { ...opts, clock });
  const { store, adapter, intake, worker } = runtime;

  // Known secret VALUES to redact from any diagnostic (defence in depth; the
  // adapter already masks the bot token, and pg errors rarely echo the DSN).
  // ONE implementation — config.buildSecretRedactor — shared with the fatal
  // (construction-time) log path in main() so no error bypasses masking (FU-4).
  const redact = buildSecretRedactor(config);

  function safeErr(err) {
    return redact(err && err.message ? err.message : String(err));
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

  // An ordinary text message → durable capture (intake commit point), HELD at
  // the pending `accepted` state until the user taps "Save to Brain" (tap-gated
  // capture — Warwick decision 2026-07-16). The card target is persisted inside
  // intake so the tap AND the completion projection both survive a restart.
  //
  // A non-text update (photo/voice/document/sticker/…) from the AUTHORISED
  // sender is rejected upstream with 'unsupported_content_type' — no envelope,
  // no queue row, no markdown — and answered here with an honest plain-text
  // notice. The notice is a best-effort projection: a crash between notice and
  // offset persist can at worst repeat the notice, never duplicate data.
  async function handleMessage(update, _now) {
    const res = await intake.accept(update, {});
    if (!res.ok) {
      diag('message_not_accepted', { reason: res.reason });
      if (res.reason === 'unsupported_content_type' && typeof adapter.sendMessage === 'function') {
        const msg = (update && update.message) || {};
        const chatId = (msg.chat && msg.chat.id !== undefined) ? msg.chat.id
          : (msg.from && msg.from.id);
        try {
          await adapter.sendMessage(chatId, 'Text only in WP0 — photos/voice arrive in a later work package.');
        } catch (err) {
          diag('unsupported_notice_failed', { error: safeErr(err) });
        }
      }
    }
    return { kind: 'message', ...res };
  }

  // A callback_query (action-button tap on a pending card). TAP-GATED CAPTURE:
  // SaveToBrain is the write trigger — it enqueues the held capture via
  // intake.confirmSave() and the drain that follows the batch runs the existing
  // saga (claim → governed write → evidence → completed → card edit). Double
  // taps and taps after completion are idempotent no-ops (confirmSave inspects
  // state). KeepRaw / AskLarry are WP0-minimal: acknowledged with a "not
  // available" toast, capture stays pending. Ack failure is projection-only.
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

    let toast;
    let outcome = 'none';
    // LIVE PHONE FINDING (2026-07-17): a plain answerCallbackQuery toast flashes
    // for ~2s at the top of the chat and is effectively invisible — Warwick
    // reported the KeepRaw/AskLarry buttons "just don't do anything". Answers
    // the user MUST see are sent as a dismissable pop-up (show_alert: true).
    // The SaveToBrain ack stays subtle: the card edit itself is its feedback.
    let showAlert = false;
    if (!captureId) {
      toast = 'No capture found for this card.';
    } else if (action === 'SaveToBrain') {
      const res = await intake.confirmSave(captureId, {});
      outcome = res.ok ? res.outcome : res.reason;
      if (res.ok && res.outcome === 'queued') toast = 'Saving to your Brain…';
      else if (res.ok && res.outcome === 'already_completed') toast = 'Already saved to your Brain.';
      else toast = 'Already in progress — nothing to do.';
    } else if (action === 'KeepRaw' || action === 'AskLarry') {
      // WP0-minimal: honest "not yet" answer; the capture stays pending. Pop-up,
      // not toast — this is the only feedback the button gives.
      outcome = 'unavailable_wp0';
      toast = 'Not available in WP0 — your capture stays pending.';
      showAlert = true;
    } else {
      // Unknown callback_data stays inert — acknowledged, never interpolated.
      outcome = 'unknown_action';
      toast = 'Unknown action.';
    }

    try {
      await adapter.answerCallbackQuery(callbackId, toast, { showAlert });
    } catch (err) {
      diag('answer_callback_failed', { error: safeErr(err) });
    }
    return { kind: 'callback', ok: Boolean(captureId), action, captureId, outcome };
  }

  async function handleUpdate(update, now) {
    if (update && update.message) return handleMessage(update, now);
    if (update && update.callback_query) return handleCallback(update, now);
    return { kind: 'ignored' };
  }

  // Drive the worker until nothing is claimable: each CONFIRMED (tapped) item
  // reaches a stable terminal state, or a failed item is parked for a future
  // due-retry. Pending (untapped) captures hold at `accepted` — not claimable,
  // deliberately untouched here (tap-gate invariant: the store's enqueue()
  // refuses without the confirmedByTap acknowledgement, so this drain CANNOT
  // liberate a pending capture even in principle). Bounded loop guard — never
  // spins forever. `nowFn` is sampled per item for truthful timestamps.
  async function drainToStable(nowFn) {
    let processed = 0;
    for (let i = 0; i < 10_000; i += 1) {
      const rec = await worker.processOne({ now: nowFn() });
      if (!rec) break;
      processed += 1;
    }
    return processed;
  }

  // CARD-SEND RECOVERY (live finding 2026-07-17): an `accepted` capture whose
  // INITIAL card send failed (card_ref null) would otherwise wait forever with
  // no card to tap. Observed live: update 9724165 ("Test new", capture
  // 85c16de0-ea63-5ae5-b429-27504b63ea0c) was durably captured but its
  // sendMessage died on a NAT-killed keep-alive socket — Warwick got no card.
  // Each poll cycle re-attempts the card for the few MOST RECENT such captures
  // (bounded by CARD_RECOVERY_LIMIT) and persists card_ref on success, so the
  // tap-gated flow resumes. SAFE-IF-DUPLICATE: if the original send actually
  // succeeded and only its response was lost, this sends ONE extra card; the
  // orphaned first card has no card_ref so a tap on it answers "No capture
  // found" — an acceptable WP0 trade for never leaving a capture cardless.
  async function recoverMissingCards(now) {
    if (typeof store.list !== 'function') return 0;
    let records;
    try {
      records = await store.list();
    } catch (err) {
      diag('card_recovery_list_failed', { error: safeErr(err) });
      return 0;
    }
    const cardless = records
      .filter((r) => r.state === STATES.ACCEPTED && !r.card_ref)
      .sort((a, b) => (b.received_at_ms ?? 0) - (a.received_at_ms ?? 0))
      .slice(0, CARD_RECOVERY_LIMIT);
    let recovered = 0;
    for (const rec of cardless) {
      try {
        await adapter.sendCard(rec.capture_id, projectCard(rec));
        // Persist the durable card target exactly like intake does (§4), so the
        // tap resolves via the card_ref reverse lookup even after a restart.
        if (typeof store.recordCardRef === 'function' && typeof adapter.cardTarget === 'function') {
          const target = adapter.cardTarget(rec.capture_id);
          if (target && target.messageId !== undefined) {
            await store.recordCardRef(
              rec.capture_id,
              { chat_id: target.chatId, message_id: target.messageId },
              { now },
            );
          }
        }
        recovered += 1;
        diag('card_send_recovered', { capture_id: rec.capture_id });
      } catch (err) {
        // Best-effort: the capture stays durably accepted; the NEXT cycle
        // retries. Never throws out of the poll loop.
        diag('card_send_recovery_failed', { capture_id: rec.capture_id, error: safeErr(err) });
      }
    }
    return recovered;
  }

  /**
   * One long-poll cycle: recover any cardless pending captures, fetch a batch,
   * handle each update in update_id order, advance+persist the offset AFTER
   * each is durably handled, then drain the worker to a stable state. Returns
   * a summary (no secrets).
   */
  async function pollOnce({ now: injectedNow } = {}) {
    // FORENSIC-TIMESTAMP FIDELITY (live finding 2026-07-17): a single
    // cycle-scoped `now` used to stamp EVERY store write in the cycle with the
    // cycle-START time. Live consequence: a capture whose recovered card was
    // sent at +0.6s and tapped seconds later still carried claimed_at ≈
    // start+2ms in the DB — which read as "claimed BEFORE its card was sent"
    // and was initially misdiagnosed as a tap-gate bypass. stepNow() samples
    // the clock at each phase, so durable timestamps tell the true order;
    // tests stay deterministic (injected `now` and fixed clocks are stable).
    const stepNow = () => (typeof injectedNow === 'number' ? injectedNow : clock.now());
    // Recovery runs FIRST so a restarted worker re-offers a missing card
    // immediately, before the (up to pollTimeoutSec) long poll blocks.
    const cardsRecovered = await recoverMissingCards(stepNow());
    let updates;
    try {
      updates = await adapter.getUpdates({ offset, timeout: pollTimeoutSec, limit: 100 });
    } catch (err) {
      diag('get_updates_failed', { error: safeErr(err) });
      return {
        fetched: 0, accepted: 0, callbacks: 0, ignored: 0, processed: 0,
        cards_recovered: cardsRecovered, offset, error: true,
      };
    }
    const ordered = [...updates].sort((a, b) => (a.update_id ?? 0) - (b.update_id ?? 0));
    let accepted = 0; let callbacks = 0; let ignored = 0;
    for (const update of ordered) {
      let res;
      try {
        res = await handleUpdate(update, stepNow());
      } catch (err) {
        diag('handle_update_failed', { update_id: update.update_id, error: safeErr(err) });
        res = { kind: 'error' };
      }
      if (res.kind === 'message' && res.ok) accepted += 1;
      else if (res.kind === 'callback') callbacks += 1;
      else ignored += 1;
      // Acknowledge ONLY after durable handling. On crash before this, the update
      // redelivers and idempotent intake dedups it — no loss, no duplicate.
      await persistOffset((update.update_id ?? 0) + 1, stepNow());
    }
    const processed = await drainToStable(stepNow);
    return {
      fetched: updates.length, accepted, callbacks, ignored, processed,
      cards_recovered: cardsRecovered, offset,
    };
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
    // FU-4 (Vex V-04): the fatal path runs OUTSIDE createLiveRunner's safeErr
    // scope (construction-time failures — pg pool/DSN errors), so it builds its
    // own redactor from the same env before echoing anything.
    const redactFatal = buildSecretRedactor(loadConfig());
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      service: 'fusion-capture-gateway',
      component: 'live-runner',
      event: 'fatal',
      error: redactFatal(err && err.message ? err.message : String(err)),
    }));
    process.exitCode = 1;
  });
}
