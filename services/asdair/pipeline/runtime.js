#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/runtime.js
//
// THE LOOP. Poll intake once, advance every shop that has work, send whatever
// is waiting in the outbox, exit cleanly.
//
//     node --env-file=<env> runtime.js --once
//     node --env-file=<env> runtime.js --watch [--interval 60]
//
// ── THIS IS A DETERMINISTIC WORKER, NOT AN LLM DAEMON ───────────────────────
// There is no agent here, no conversation, no autonomous decision and no
// reasoning loop. Every pass is the same three deterministic phases in the same
// order, and every decision about what to do next comes from the pure stage
// table reading durable Postgres state. The ONLY model call in the whole system
// is the single grounded vision request that reads a photograph of a
// handwritten list - and even that never NAMES a product; identity comes from
// the household catalogue.
//
// ── ONE POLLER, TWO CONSUMERS ───────────────────────────────────────────────
// Telegram long-polling is DESTRUCTIVE: fetching updates with an offset ACKS
// every update below it, so two pollers race and the loser silently swallows
// the week's shopping list. services/asdair/intake/ is the one poller. This
// runtime does not add a second: it wraps the intake client so the raw updates
// intake IGNORES (button taps and typed replies carry no `message` a receiver
// can use) are CAPTURED on the way past and routed through the bot's own
// inboundRouter. One fetch, one offset, both consumers served.
//
// ── EACH PASS ADVANCES EACH SHOP BY ONE STEP ────────────────────────────────
// Not "until it stops". One. A shop that needs four steps takes four passes,
// which keeps every pass bounded, keeps a wedged shop from starving the others,
// and makes the loop trivially safe to interrupt. `--once` is therefore also
// the unit of recovery after a reboot: run it, and every shop moves on by one
// legal step from whatever the database says.
//
// ── CREDENTIALS ─────────────────────────────────────────────────────────────
// Everything arrives through `node --env-file=`. This file opens no credentials
// file, prints no token, and knows env var NAMES only.
// =====================================================================

import * as commands from './commands.js';
import { runPipeline } from './runPipeline.js';
import * as store from './store.js';
import { intentToCommand } from './telegramAdapter.js';
import { COMMANDS } from './commandNames.js';

// deps.js is imported DYNAMICALLY, inside main() only. It binds the real
// components, which transitively pull in `pg` - and the loop's library exports
// (runOnce, runWatch, pollIntake, ...) all take `deps` as an argument, so they
// must stay importable on a box with no dependencies installed. That is what
// lets the whole offline test suite import this file.

const DEFAULT_INTERVAL_SECONDS = 60;

/**
 * Wrap a ShopperBot Telegram client so every raw update it fetches is captured.
 *
 * runIntake consumes the stream and reports what it IGNORED, but only as
 * `{updateId, senderId, reason}` - the payload of a button tap is gone by then.
 * Capturing on the way past is what lets the SAME fetch serve both the list
 * receiver and the control surface, without a second poller.
 */
export function createCapturingTelegram(inner) {
  const captured = [];
  return {
    captured,
    async getUpdates(opts) {
      const updates = await inner.getUpdates(opts);
      captured.push(...updates);
      return updates;
    },
    getFile: (...a) => inner.getFile(...a),
    downloadFile: (...a) => inner.downloadFile(...a),
    describe: () => (inner.describe ? inner.describe() : { bot: 'shopperbot' }),
  };
}

/**
 * PHASE 1 - intake. Every accepted message becomes a receiveList command.
 *
 * Idempotency is the receiver's offset file PLUS createOrResumeShop's two
 * unique indexes, belt and braces: even if the offset file were lost and the
 * whole history redelivered, every message would RESUME its existing week and
 * write nothing.
 */
export async function pollIntake(deps, { intake, householdId, now, log = () => {} } = {}) {
  if (!intake) return { fetched: 0, received: [], ignored: [], failed: [] };
  // THE CLOCK IS INJECTED, never reached for. The week a list belongs to is
  // derived from the receiver's stamp, so the whole loop is deterministic under
  // test - and a runtime with a wrong clock is a wrong shop_ref, which is the
  // kind of bug that only shows up on the night it matters.
  const clock = now || intake.now || Date.now;
  // THE ACKNOWLEDGEMENT BOUNDARY.
  //
  // Advancing the Telegram offset tells Telegram "I have this", and Telegram
  // then forgets the update permanently. This used to happen the moment a record
  // was emitted, with the shop created afterwards - so a crash in that window
  // lost a shopping list SILENTLY: no error, no retry, nothing to recover from.
  //
  // receiveList now runs INSIDE onRecord, so the shop is durable BEFORE the
  // offset moves. If it throws, the offset is held, the batch stops, and
  // Telegram redelivers. A redelivery is harmless because shop's unique
  // (telegram_chat_id, telegram_message_id) index resumes the same shop rather
  // than creating a second one.
  const received = [];

  const persist = async (record) => {
    const meta = record.meta || {};
    // The week a list belongs to is the day it arrived. Derived once, from the
    // receiver's own stamp, so a redelivery cannot land on a different week -
    // and even if it did, the inbound unique key would still resume the shop.
    const listDate = String(meta.receivedAt || '').slice(0, 10);
    const spec = {
      householdId,
      listDate,
      sourceKind: record.payload.kind,
      rawText: record.payload.kind === 'text' ? record.payload.text : null,
      rawMediaPath: record.payload.kind === 'photo' ? record.payload.imageRef : null,
      // A photograph of handwriting is ALWAYS a list that was read rather than
      // typed, so it is flagged for review; the interpretation gate then refuses
      // to declare it ready to shop on AsdAIr's own say-so.
      needsReview: record.payload.kind === 'photo',
      telegramChatId: meta.chatId != null ? String(meta.chatId) : null,
      telegramMessageId: meta.messageId != null ? String(meta.messageId) : null,
      telegramUpdateId: meta.updateId != null ? String(meta.updateId) : null,
      sourceId: record.sourceId,
      actor: `telegram:${meta.senderId ?? 'unknown'}`,
    };
    received.push(await commands.receiveList(spec, deps));
  };

  const result = await intake.runIntake({
    config: intake.config,
    telegram: intake.telegram,
    state: intake.state,
    media: intake.media,
    now: clock,
    log,
    onRecord: persist,
  });

  return {
    fetched: result.fetched,
    received,
    ignored: result.ignored,
    failed: result.failed,
  };
}

/**
 * PHASE 1b - route the taps and typed replies the receiver ignored.
 *
 * A tap becomes a command through the SAME surface the Cockpit uses. Nothing
 * here decides anything: it routes, translates, calls, and answers the tap.
 */
export async function routeTaps(deps, { updates, bot, log = () => {} } = {}) {
  if (!bot || !Array.isArray(updates) || updates.length === 0) return { routed: [], refused: [] };
  const routed = [];
  const refused = [];

  for (const update of updates) {
    const intent = bot.routeAsdairUpdate(update, {
      resolveQuestionByMessage: bot.resolveQuestionByMessage,
    });
    if (!intent.ok) {
      // Not ours (the hub's `decision:` cards share this phone), or malformed.
      // Silently skipped, never guessed at.
      continue;
    }
    const mapped = intentToCommand(intent, {
      parseAnswerArg: bot.parseAnswerArg,
      resolveCandidate: bot.resolveCandidate,
    });
    if (!mapped.ok) {
      refused.push({ action: intent.action, reason: mapped.reason, detail: mapped.detail });
      if (bot.answerTap && intent.raw && intent.raw.callbackQueryId) {
        await bot.answerTap(intent.raw.callbackQueryId, mapped.detail || mapped.reason);
      }
      continue;
    }
    try {
      const receipt = await commands.dispatch(mapped.command, mapped.spec, deps);
      routed.push({ action: intent.action, command: mapped.command, receipt });
      if (bot.answerTap && intent.raw && intent.raw.callbackQueryId) {
        await bot.answerTap(intent.raw.callbackQueryId, receipt.duplicate ? 'Already asked for' : 'Got it');
      }
    } catch (err) {
      const detail = String(err && err.message ? err.message : err);
      refused.push({ action: intent.action, reason: 'command failed', detail });
      log('tap_failed', { action: intent.action, detail });
      if (bot.answerTap && intent.raw && intent.raw.callbackQueryId) {
        await bot.answerTap(intent.raw.callbackQueryId, 'That did not work - check the status card');
      }
    }
  }
  return { routed, refused };
}

/** PHASE 2 - advance every shop that is still moving, by exactly one step -
 *  plus any finished shop still carrying a command that must be retired. */
export async function advanceAll(deps, { log = () => {} } = {}) {
  const shops = await store.listActiveShops(deps, store.CONSUMABLE_COMMANDS);
  const results = [];
  for (const shop of shops) {
    try {
      const r = await runPipeline({ shopId: shop.id }, deps);
      results.push(r);
      log('advanced', { shop_ref: shop.shop_ref, step: r.step, stepped: r.stepped, to: r.to });
    } catch (err) {
      // A shop whose SNAPSHOT could not even be read must not stop the others.
      results.push({
        ok: false, shop_id: shop.id, shop_ref: shop.shop_ref, stepped: false,
        error: String(err && err.message ? err.message : err),
      });
    }
  }
  return results;
}

/**
 * PHASE 3 - drain the outbox.
 *
 * A message is rendered from its durable payload, sent, and only THEN resolved.
 * A crash between the send and the resolve re-sends one card next pass; a crash
 * the other way round would lose it silently, and a lost failure card is a shop
 * that stalls without telling anyone. Duplicated beats missing, and the outbox
 * key means it cannot duplicate more than once.
 */
export async function drainOutbox(deps, { bot, log = () => {} } = {}) {
  const queued = await store.listOutbox(deps);
  const sent = [];
  const failed = [];
  if (!bot || !bot.send) return { sent, failed, queued: queued.length };

  for (const item of queued) {
    try {
      const render = bot.messages[item.kind];
      if (!render) {
        await store.resolveCommand(deps, item.id, 'abandoned', `no renderer for message kind "${item.kind}"`);
        continue;
      }
      const shop = await store.findShopById(deps, item.shop_id);
      const chatId = (shop && shop.telegram_chat_id) || bot.chatId;
      if (!chatId) {
        await store.resolveCommand(deps, item.id, 'abandoned', 'no chat to send to');
        continue;
      }
      await bot.send(chatId, render(item.payload));
      await store.resolveCommand(deps, item.id, 'done', 'sent');
      sent.push({ kind: item.kind, key: item.key });
    } catch (err) {
      const detail = String(err && err.message ? err.message : err);
      failed.push({ kind: item.kind, key: item.key, detail });
      log('send_failed', { kind: item.kind, detail });
    }
  }
  return { sent, failed, queued: queued.length };
}

/**
 * ONE PASS. Deterministic, bounded, and safe to interrupt at any point.
 *
 * @param {object} deps    the wired dependency container (see deps.js)
 * @param {{intake?:object, bot?:object, householdId?:*, log?:Function}} wiring
 */
export async function runOnce(deps, wiring = {}) {
  const log = wiring.log || (() => {});
  const startedFrom = 'durable state';

  const capturing = wiring.intake && wiring.intake.telegram
    ? createCapturingTelegram(wiring.intake.telegram)
    : null;
  const intake = capturing ? { ...wiring.intake, telegram: capturing } : wiring.intake;

  const intakeReport = await pollIntake(deps, {
    intake, householdId: wiring.householdId, now: wiring.now, log,
  });
  const tapReport = await routeTaps(deps, {
    updates: capturing ? capturing.captured : [],
    bot: wiring.bot,
    log,
  });
  const advanced = await advanceAll(deps, { log });
  const outbox = await drainOutbox(deps, { bot: wiring.bot, log });

  return {
    ok: true,
    started_from: startedFrom,
    intake: {
      fetched: intakeReport.fetched,
      received: intakeReport.received.length,
      ignored: intakeReport.ignored.length,
      failed: intakeReport.failed.length,
    },
    taps: { routed: tapReport.routed.length, refused: tapReport.refused.length, detail: tapReport.refused },
    shops: advanced.map((r) => ({
      shop_ref: r.shop_ref, step: r.step, stepped: r.stepped,
      from: r.from, to: r.to, ok: r.ok !== false, error: r.error || null,
    })),
    stepped: advanced.filter((r) => r.stepped).length,
    outbox,
  };
}

/**
 * WATCH. runOnce on an interval, until interrupted.
 *
 * Every pass is independent and starts from durable state, so an interval that
 * is missed, a pass that throws, or a machine that reboots costs exactly one
 * pass - never a shop. `stop()` lets a caller (and the test suite) end the loop
 * without a signal.
 */
export function runWatch(deps, wiring = {}, { intervalSeconds = DEFAULT_INTERVAL_SECONDS, maxPasses = Infinity } = {}) {
  let stopped = false;
  let timer = null;
  const log = wiring.log || (() => {});

  const done = (async () => {
    let passes = 0;
    while (!stopped && passes < maxPasses) {
      try {
        const report = await runOnce(deps, wiring);
        log('pass', { pass: passes, stepped: report.stepped, shops: report.shops.length });
      } catch (err) {
        // A pass that blows up must not kill the loop: the next one re-derives
        // everything from Postgres anyway.
        log('pass_failed', { pass: passes, error: String(err && err.message ? err.message : err) });
      }
      passes += 1;
      if (stopped || passes >= maxPasses) break;
      // Deliberately NOT unref'd: a watch loop is the process's reason to be
      // alive, and an unref'd timer lets Node exit between passes.
      await new Promise((resolve) => { timer = setTimeout(resolve, intervalSeconds * 1000); });
    }
    return passes;
  })();

  return {
    stop() { stopped = true; if (timer) clearTimeout(timer); },
    done,
  };
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

/** Build the real Telegram wiring from the environment. Names only - no value
 *  is read from a credentials file by this module. */
async function realWiring() {
  const intakeMod = await import('../intake/shopperIntake.js');
  const botRouter = await import('../bot/inboundRouter.js');
  const botMessages = await import('../bot/renderMessages.js');
  const botSender = await import('../bot/sendShopperMessage.js');
  const callback = await import('../bot/callbackProtocol.js');

  const config = intakeMod.loadIntakeConfig();
  const { sender, chatId } = botSender.createShopperSenderFromEnv();

  return {
    householdId: Number(process.env.ASDAIR_HOUSEHOLD_ID || 1),
    intake: {
      runIntake: intakeMod.runIntake,
      config,
      telegram: intakeMod.createShopperTelegramClient({ botToken: config.botToken, apiBase: config.apiBase }),
      state: intakeMod.createFileStateStore(config.stateFile),
      media: intakeMod.createFileMediaStore(config.mediaDir),
    },
    bot: {
      routeAsdairUpdate: botRouter.routeAsdairUpdate,
      parseAnswerArg: callback.parseAnswerArg,
      messages: botMessages.MESSAGES,
      chatId,
      send: (chat, message) => sender.sendMessage(chat, message),
      answerTap: (id, text) => sender.answerCallbackQuery(id, { text }),
      // Correlation lookups belong to whoever owns the question state. Until the
      // card message_ids are persisted against their question keys, a typed
      // reply is refused rather than attached to a guess.
      resolveQuestionByMessage: () => null,
      resolveCandidate: () => null,
    },
  };
}

async function main() {
  const once = arg('once') === true;
  const watch = arg('watch') === true;
  if (!once && !watch) {
    console.error('usage: node --env-file=<env> runtime.js --once | --watch [--interval <seconds>]');
    process.exit(2);
  }
  const { createDeps, closeDeps } = await import('./deps.js');
  const deps = createDeps();
  const wiring = await realWiring();
  wiring.log = (event, detail) => console.log(JSON.stringify({ event, ...detail }));

  try {
    if (once) {
      const report = await runOnce(deps, wiring);
      console.log(JSON.stringify(report, null, 1));
      return;
    }
    const interval = Number(arg('interval', DEFAULT_INTERVAL_SECONDS)) || DEFAULT_INTERVAL_SECONDS;
    const loop = runWatch(deps, wiring, { intervalSeconds: interval });
    const stop = () => { console.log(JSON.stringify({ event: 'stopping' })); loop.stop(); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    await loop.done;
  } finally {
    await closeDeps();
  }
}

const isCli = process.argv[1] && process.argv[1].endsWith('runtime.js');
if (isCli) {
  main().catch((e) => { console.error('runtime error:', e.message); process.exit(1); });
}

export { COMMANDS };
