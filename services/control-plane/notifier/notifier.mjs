// BUILD-014 PR-3b — the notification SENDER (worker loop) + the `sending` reclaim watchdog.
//
// This is the follow-on to PR-3a's outbox (005_notification_outbox.sql). PR-3a built the
// durable projection + delivery state machine + the least-privilege `notifier` role and its
// claim/mark helpers, and DEFERRED the sender. This is that sender. It is a WORKER LOOP over
// the outbox — NOT a new queue — mirroring the WP-B worker (worker/worker.mjs): claim one due
// row, act, drive state, repeat.
//
// CORRECTNESS MODEL (why this is safe under at-least-once, restart, and crash-mid-send):
//   1. ops.claim_notification(dest) atomically leases ONE due, QUEUED row with FOR UPDATE SKIP
//      LOCKED and moves it queued->sending, incrementing attempts. N concurrent senders grab
//      DISTINCT rows. A SILENT row is 'suppressed' (never 'queued'), so it is NEVER claimable —
//      SILENT is unsendable by construction (PR-3a's biconditional CHECK), and we ALSO assert it
//      defensively here. A row already 'sent' is terminal and never re-claimed => an already-
//      delivered notification is never re-sent (the restart no-dup-spam guarantee).
//   2. The claimed row is handed to the INJECTED transport (transport.mjs). We do NOT know or
//      hold any credential — the transport resolves the LOGICAL destination to real creds
//      itself, outside any reviewer process. Only ACTION_NEEDED + MILESTONE ever reach here
//      (SILENT is unrepresentable as claimable).
//   3. Transport success -> ops.mark_notification_sent(id) (sending->sent, terminal, sent_at set).
//      mark_notification_sent RAISES if the row is not still 'sending' — so a stale/duplicate
//      completion (e.g. a slow sender whose row was reclaimed) can NEVER clobber a row that
//      moved on. Transport failure/throw -> ops.mark_notification_failed(id, code, backoff)
//      (sending->failed->queued-with-backoff | dead_letter at budget). attempts was already
//      counted at claim, so the retry budget is honoured and cannot loop unbounded.
//   4. CRASH MID-SEND: if the process dies after claim (row='sending') but before mark, the row
//      sits in 'sending'. The SendingWatchdog re-drives it: any row whose updated_at is older
//      than the lease deadline is failed->queued (or dead_letter at budget) via the SAME
//      guarded helper, so it re-enters the send path exactly once per stale window. In normal
//      operation a row is 'sending' only for the duration of one send, so a GENEROUS lease
//      never reclaims a live in-flight send.
//
// Nothing here uses LISTEN/NOTIFY: correctness rests entirely on polling claim_notification.
//
// LEAST-PRIVILEGE: every DB op the sender performs is within the PR-3a `notifier` grant surface
// (SELECT + EXECUTE on claim/mark; column-level UPDATE on delivery state only). Pass
// `sessionRole: 'notifier'` to run each unit of work under SET ROLE and PROVE that surface is
// sufficient (the notifier-role delivery test does exactly this). In production the sender
// process connects AS the notifier login role (wired in PR-4); the class is role-agnostic.

import { createLogger, sleep, sanitizeError } from '../worker/util.mjs';

/** Build the sanitised transport payload from a claimed outbox row (pointers + deep links). */
function payloadFromRow(row) {
  return {
    id: String(row.id),
    notificationClass: row.notification_class,
    destination: row.destination,
    headline: row.headline,
    message: row.message,
    cockpitUrl: row.cockpit_url ?? null,   // deep link — Directus cockpit
    githubUrl: row.github_url ?? null,     // deep link — GitHub
  };
}

export class Notifier {
  /**
   * @param {import('pg').Pool} pool  a pg Pool. In production its connection string is the
   *        notifier login role (PR-4). In tests, pass `sessionRole:'notifier'` to force it.
   * @param {{ send(payload): Promise<{ok:boolean, errorCode?:string}> }} transport  injected
   *        delivery dependency (createFakeTransport in DEV/tests; the real Telegram transport is
   *        a later gated live step — NEVER wired here).
   * @param {object} [opts]
   * @param {string} [opts.notifierId]         stable-ish id for logs.
   * @param {number} [opts.backoffBaseSeconds] base retry backoff (default 60). 0 disables the wait.
   * @param {number} [opts.maxBackoffSeconds]  backoff cap (default 3600).
   * @param {number} [opts.pollIntervalMs]     idle poll gap (default 500).
   * @param {string|null} [opts.sessionRole]   if set, each DB unit of work runs under SET ROLE.
   */
  constructor(pool, transport, opts = {}) {
    if (!pool) throw new Error('Notifier: a pg pool is required');
    if (!transport || typeof transport.send !== 'function') {
      throw new Error('Notifier: an injected transport with a send(payload) method is required');
    }
    this.pool = pool;
    this.transport = transport;
    this.notifierId = opts.notifierId ?? `notifier-${Math.random().toString(36).slice(2, 8)}`;
    this.backoffBaseSeconds = opts.backoffBaseSeconds ?? 60;
    this.maxBackoffSeconds = opts.maxBackoffSeconds ?? 3600;
    this.pollIntervalMs = opts.pollIntervalMs ?? 500;
    this.sessionRole = opts.sessionRole ?? null;
    this.logger = opts.logger ?? createLogger({ base: { notifierId: this.notifierId } });
    this.running = false;
  }

  /** Exponential backoff for a given attempt number (1-based): base * 2^(attempt-1), capped. */
  backoffSeconds(attempt) {
    if (this.backoffBaseSeconds <= 0) return 0;
    const raw = this.backoffBaseSeconds * Math.pow(2, Math.max(0, attempt - 1));
    return Math.min(this.maxBackoffSeconds, Math.round(raw));
  }

  /**
   * Run `fn(client)` on a pinned connection, optionally under SET ROLE (least-privilege proof).
   * Always resets the role and releases the connection. Kept SHORT — a connection is never held
   * across the transport's network send (claim and mark each take their own short-lived client).
   */
  async withConn(fn) {
    const client = await this.pool.connect();
    try {
      if (this.sessionRole) await client.query(`set role ${this.sessionRole}`);
      return await fn(client);
    } finally {
      if (this.sessionRole) { try { await client.query('reset role'); } catch { /* connection may be dead */ } }
      client.release();
    }
  }

  /**
   * Claim + deliver at most ONE due notification for `destination`. Returns null when nothing is
   * due, else { id, outcome } where outcome is 'sent' | 'failed' | 'dead_letter' | 'skipped_silent'.
   *
   * `hooks.beforeSend({ row, payload })` is an OPTIONAL test seam invoked after the claim but
   * before the transport send — used by the crash proof to abandon a row in 'sending'. Never used
   * in production.
   */
  async processOnce(destination, hooks = {}) {
    // (1) claim one due, queued row -> sending (attempts++). NULL composite => nothing due.
    const claim = await this.withConn((c) => c.query(`select * from ops.claim_notification($1)`, [destination]));
    const row = claim.rows[0];
    if (!row || row.id === null) return null;

    const id = String(row.id);
    const attempt = row.attempts;
    const log = this.logger.child({ id, destination, attempt, class: row.notification_class });

    // Defensive belt-and-braces: SILENT is unsendable by construction (PR-3a biconditional CHECK
    // makes a claimable SILENT row unrepresentable). If one ever surfaced, fail closed LOUDLY
    // rather than dispatch it — mark it failed so it never spams, and flag it.
    if (row.notification_class === 'SILENT') {
      log.error('notifier.silent_claimed_impossible');
      await this.withConn((c) =>
        c.query(`select ops.mark_notification_failed($1,$2,$3)`, [id, 'SILENT_UNSENDABLE', this.backoffSeconds(attempt)]));
      return { id, outcome: 'skipped_silent' };
    }

    const payload = payloadFromRow(row);
    if (hooks.beforeSend) await hooks.beforeSend({ row, payload });

    log.info('notifier.sending');

    // (2) hand to the injected transport. A THROW is treated identically to { ok:false }.
    let result;
    try {
      result = await this.transport.send(payload);
    } catch (err) {
      // Sanitised — a transport error must never leak raw bytes (a token, a chat-id) into logs.
      const safe = sanitizeError(err);
      log.warn('notifier.transport_threw', safe);
      const outcome = await this.markFailed(id, safe.errorCode ?? 'TRANSPORT_THREW', attempt);
      return { id, outcome };
    }

    // (3a) success -> sent (terminal). mark_notification_sent RAISES if the row is no longer
    // 'sending' (reclaimed / already completed) — caught so a lost race is not a crash.
    if (result && result.ok === true) {
      try {
        await this.withConn((c) => c.query(`select ops.mark_notification_sent($1)`, [id]));
        log.info('notifier.sent');
        return { id, outcome: 'sent' };
      } catch (err) {
        // The row moved on (e.g. a watchdog reclaimed a slow send). The transport DID deliver;
        // we simply could not record 'sent'. Do NOT re-send here — the row is now queued/failed
        // and will be re-driven; true exactly-once at the wire needs an idempotent transport
        // (documented residual). Log and move on.
        log.warn('notifier.mark_sent_lost_race', sanitizeError(err));
        return { id, outcome: 'sent_unrecorded' };
      }
    }

    // (3b) handled failure -> failed -> queued(backoff) | dead_letter.
    const errorCode = (result && typeof result.errorCode === 'string') ? result.errorCode : 'DELIVERY_FAILED';
    const outcome = await this.markFailed(id, errorCode, attempt);
    log.warn('notifier.delivery_failed', { errorCode, outcome });
    return { id, outcome };
  }

  /** Drive sending->failed->(queued|dead_letter) and report which terminal/retry state resulted. */
  async markFailed(id, errorCode, attempt) {
    const r = await this.withConn((c) =>
      c.query(`select * from ops.mark_notification_failed($1,$2,$3)`, [id, errorCode, this.backoffSeconds(attempt)]));
    return r.rows[0]?.state === 'dead_letter' ? 'dead_letter' : 'failed';
  }

  /** Drain a destination: process rows until nothing is due. Returns the per-row outcomes. */
  async drain(destination, { max = 1000 } = {}) {
    const outcomes = [];
    for (let i = 0; i < max; i++) {
      const r = await this.processOnce(destination);
      if (!r) break;
      outcomes.push(r);
    }
    return outcomes;
  }

  /** Poll `destinations` in a loop until stop(). Correctness rests on this poll alone. */
  async runLoop(destinations) {
    const ds = Array.isArray(destinations) ? destinations : [destinations];
    this.running = true;
    this.logger.info('notifier.loop_start', { destinations: ds });
    while (this.running) {
      let didWork = false;
      for (const d of ds) {
        if (!this.running) break;
        try {
          const r = await this.processOnce(d);
          if (r) didWork = true;
        } catch (err) {
          this.logger.error('notifier.processOnce_unexpected', { destination: d, ...sanitizeError(err) });
        }
      }
      if (!didWork) await sleep(this.pollIntervalMs);
    }
    this.logger.info('notifier.loop_stopped');
  }

  stop() { this.running = false; }
}

/**
 * The `sending` RECLAIM WATCHDOG — the piece PR-3a deferred ("no sending watchdog yet").
 *
 * A row sits in 'sending' ONLY while a send is in flight; if the sender crashes between claim
 * and mark, the row is stranded. This ticker re-drives any row whose `updated_at` (the toucher
 * sets it at claim time) is older than the lease deadline: sending->failed->queued(backoff) |
 * dead_letter at budget, via the SAME guarded ops.mark_notification_failed. It is:
 *   · BOUNDED   — a batch limit per tick; the lease deadline (`staleSeconds`) is generous in
 *                 production so a live in-flight send is NEVER reclaimed.
 *   · IDEMPOTENT — mark_notification_failed only acts on a row still in 'sending'; two watchdogs
 *                 (or a watchdog racing the real sender's completion) collide harmlessly: the
 *                 loser's guarded UPDATE matches no row and RAISES, which we swallow as a benign
 *                 already-handled no-op. No row is ever re-driven twice for one stale window.
 * Uses server-side now() - make_interval so there is no app/DB clock skew.
 */
export class SendingWatchdog {
  /**
   * @param {import('pg').Pool} pool
   * @param {object} [opts]
   * @param {number} [opts.staleSeconds]        lease deadline; reclaim 'sending' older than this (default 300).
   * @param {number} [opts.backoffSeconds]      backoff applied to a reclaimed row's retry (default 60).
   * @param {number} [opts.batchLimit]          max rows reclaimed per tick (default 100).
   * @param {number} [opts.intervalMs]          ticker interval (default 5000).
   * @param {string|null} [opts.sessionRole]    if set, run under SET ROLE (least-privilege proof).
   */
  constructor(pool, opts = {}) {
    if (!pool) throw new Error('SendingWatchdog: a pg pool is required');
    this.pool = pool;
    this.staleSeconds = opts.staleSeconds ?? 300;
    this.backoffSeconds = opts.backoffSeconds ?? 60;
    this.batchLimit = opts.batchLimit ?? 100;
    this.intervalMs = opts.intervalMs ?? 5000;
    this.sessionRole = opts.sessionRole ?? null;
    this.logger = opts.logger ?? createLogger({ base: { component: 'sending-watchdog' } });
    this.timer = null;
  }

  async withConn(fn) {
    const client = await this.pool.connect();
    try {
      if (this.sessionRole) await client.query(`set role ${this.sessionRole}`);
      return await fn(client);
    } finally {
      if (this.sessionRole) { try { await client.query('reset role'); } catch { /* dead conn */ } }
      client.release();
    }
  }

  /**
   * One reclaim pass. Selects stale 'sending' rows (updated_at past the lease deadline) and
   * re-drives each via ops.mark_notification_failed. Returns the reclaimed ids (those actually
   * moved out of 'sending' by THIS tick). Bounded by batchLimit; safe to run concurrently.
   */
  async tick() {
    // (a) find candidates — a plain SELECT is within the notifier's SELECT grant. The staleness
    // cutoff is computed server-side to avoid clock skew.
    const found = await this.withConn((c) => c.query(
      `select id from ops.notification_outbox
        where state = 'sending'
          and updated_at <= now() - make_interval(secs => $1)
        order by updated_at
        limit $2`, [this.staleSeconds, this.batchLimit]));

    const reclaimed = [];
    for (const { id } of found.rows) {
      try {
        // (b) re-drive via the guarded helper. It only acts on a row still 'sending'; if the real
        // sender completed or another watchdog already reclaimed it, this RAISES (not-sending) and
        // we treat that as an already-handled no-op — idempotent, never double-driven.
        await this.withConn((c) =>
          c.query(`select ops.mark_notification_failed($1,$2,$3)`, [id, 'LEASE_EXPIRED', this.backoffSeconds]));
        reclaimed.push(String(id));
      } catch (err) {
        // Benign: the row moved on between the SELECT and the mark. Not a fault.
        this.logger.debug?.('watchdog.reclaim_skipped', { id: String(id), ...sanitizeError(err) });
      }
    }
    if (reclaimed.length) this.logger.info('watchdog.reclaimed', { count: reclaimed.length });
    return reclaimed;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => this.logger.error('watchdog.tick_failed', sanitizeError(err)));
    }, this.intervalMs);
    this.timer.unref?.();
    this.logger.info('watchdog.started', { intervalMs: this.intervalMs, staleSeconds: this.staleSeconds });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
