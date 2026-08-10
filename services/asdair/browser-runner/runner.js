// =====================================================================
// BUILD-015 AsdAIr Stage 1 - THE BROWSER RUNNER.
//
// An EVENT-DRIVEN SERVICE, not a daemon and not an agent. It has no model, no
// judgement and no discretion: it claims exactly one durable
// asdair.browser_build_request, executes the explicit, allowlisted plan that
// request carries, records what happened, and stops. Every decision that needs
// judgement was already made before the request was queued.
//
// WHAT IT GUARANTEES
//   * ONE WRITER. A single-writer lease with a heartbeat and a bounded expiry
//     (lease.cjs). A second runner refuses, or waits; it never writes.
//   * NO DUPLICATE ADDS. Every step carries a durable idempotency key. A step
//     recorded as complete is never executed again - not on resume, not after a
//     crash, not after a restart on a different process.
//   * A VISIBLE BROWSER. It attaches to the dedicated profile Warwick can see
//     and take over at any moment, and refuses to drive a headless browser.
//   * A CLOSED COMMAND SURFACE. commands.cjs is the allowlist; guards.cjs is
//     the refusal layer. There is no checkout, no payment, no slot booking, no
//     credential entry, no substitution - not disabled, absent.
//
// RUN
//   node --env-file=C:/.fusion247/asdair.env runner.js [--request <id>] [--shop <id>]
//        [--plan-file <path>] [--lease-ms 45000] [--wait-ms 0] [--dry-run]
//
// CONTROL (from any terminal, no credentials needed)
//   node runnerctl.cjs pause | resume | takeover | stop | status
// =====================================================================
'use strict';

const fs = require('node:fs');
const lease = require('./lease.cjs');
const store = require('./store.cjs');
const control = require('./control.cjs');
const P = require('./progress.cjs');
const { validatePlan } = require('./commands.cjs');
const { Session, ReauthRequiredError, RateLimitedError, sleep } = require('./browser.cjs');

/**
 * THE REQUEST CARRIES NOTHING THIS RUNNER CAN EXECUTE.
 *
 * Named, so `run()`'s catch parks the request FAILED with a readable reason
 * rather than letting the arm report a basket it never built. See reconstruct().
 */
class NoExecutablePlanError extends Error {
  constructor(msg, detail = {}) {
    super(msg);
    this.name = 'NoExecutablePlanError';
    this.detail = detail;
  }
}

/**
 * THE PLAN RAN AND THE TROLLEY IS STILL EMPTY.
 *
 * The sibling of NoExecutablePlanError, one layer further on, and the two are
 * not interchangeable. That one guards the PLAN: nothing executable arrived, so
 * nothing was attempted. This one guards the OUTCOME: everything was attempted
 * and the trolley has nothing in it.
 *
 * The plan guard cannot see this case, which is why it needed its own. A plan
 * can run to its last step with every add rejected, every item out of stock, or
 * the session never on the trolley it believed it was on. Only the read-back
 * knows - and until this guard existed, nothing compared it to anything.
 *
 * `run()`'s catch parks the request FAILED with this reason durable on the row,
 * exactly as it does for an unexecutable plan.
 */
class EmptyBasketError extends Error {
  constructor(msg, detail = {}) {
    super(msg);
    this.name = 'EmptyBasketError';
    this.detail = detail;
  }
}

const DEFAULTS = Object.freeze({
  leaseMs: lease.DEFAULT_LEASE_MS,
  heartbeatMs: lease.DEFAULT_HEARTBEAT_MS,
  waitMs: 0,
  pollMs: 2000,
  maxPauseMs: 30 * 60_000,   // a forgotten pause must not hold the trolley for ever
  interStepMs: 1500,
});

class Runner {
  /**
   * Every collaborator is injected, so the whole control flow - claim, pause,
   * resume, takeover, restart, basket-ready - is testable offline with no
   * database, no Chrome and no ASDA.
   */
  constructor({
    query,
    makeSession = (o) => new Session(o),
    controlChannel = control,
    log = (...a) => console.log(new Date().toISOString(), ...a),
    runnerId = lease.newRunnerId(),
    options = {},
  }) {
    this.query = query;
    this.makeSession = makeSession;
    this.control = controlChannel;
    this.log = log;
    this.runnerId = runnerId;
    this.opts = { ...DEFAULTS, ...options };
    this.request = null;
    this.progress = null;
    this.session = null;
    this.lostLease = false;
    this.heartbeatTimer = null;
    this.stopping = false;
  }

  // ---- durable state -------------------------------------------------

  /** Persist the in-memory progress, FENCED by the lease. */
  async save(status = null, lastError = null) {
    const row = await lease.writeProgress(this.query, {
      requestId: this.request.id, runnerId: this.runnerId,
      progress: this.progress, status, lastError,
    });
    this.progress = P.normalise(row.progress);
    return row;
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await lease.heartbeat(this.query, { requestId: this.request.id, runnerId: this.runnerId, leaseMs: this.opts.leaseMs });
      } catch (e) {
        this.lostLease = true;
        this.log(`LEASE LOST (${e.name}: ${e.message}) - stopping all browser commands immediately`);
        this.stopHeartbeat();
      }
    }, this.opts.heartbeatMs);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  stopHeartbeat() { if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; } }

  assertLease() { if (this.lostLease) throw new lease.LeaseLostError('this runner no longer holds the writing lease'); }

  // ---- lifecycle -----------------------------------------------------

  /** Claim exactly one request. Returns false when another runner holds it. */
  async claim({ requestId = null, shopId = null } = {}) {
    const row = await lease.claimOrWait(
      this.query,
      { runnerId: this.runnerId, leaseMs: this.opts.leaseMs, requestId, shopId },
      { waitMs: this.opts.waitMs, pollMs: this.opts.pollMs, onWait: (left) => this.log(`another runner holds the lease - waiting ${Math.round(left / 1000)}s more`) },
    );
    if (!row) return false;
    this.request = row;
    this.progress = P.normalise(row.progress);
    this.log(`claimed request ${row.id} (shop ${row.shop_id}) as ${this.runnerId}`);
    this.startHeartbeat();
    return true;
  }

  /**
   * RECONSTRUCT AFTER RESTART. The plan and everything already done live in the
   * durable row, so a fresh process rebuilds exactly where the dead one stopped
   * without being told anything.
   *
   * ── AN EMPTY PLAN IS A REFUSAL, NOT "EVERYTHING IS ALREADY DONE" ────────────
   * This is the AC6(f) defect, and it was worse than the Wayfinder's wording
   * ("a CDP arm can still ignore the payload") implies. The pipeline's producer,
   * `handoff/claim.js openHandoff`, writes the artefact under `progress.handoff`;
   * this method reads `progress.plan`. Nothing writes `progress.plan` on the
   * production route, so `validatePlan(undefined || [])` returned `[]`,
   * `remainingPlan` returned `[]`, `run()`'s step loop never entered, and control
   * fell straight through to `finishBasketReady()`.
   *
   * The arm did not merely ignore the payload. IT REPORTED A BASKET IT HAD NEVER
   * BUILT - marking the request complete and the shop BASKET_READY with an empty
   * trolley. A silent false success is the one outcome this build treats as worse
   * than a hard stop, so an empty plan now throws.
   *
   * ── WHY THE FIX IS HERE AND NOT IN openHandoff ──────────────────────────────
   * Because a handoff CANNOT be mechanically translated into this runner's
   * allowlisted steps, and pretending otherwise would be the real defect. Under
   * Warwick's Product Ruling 2 a known line with no usable ASDA reference travels
   * `source_view: "search"` carrying a RETRIEVAL contract - verify identity
   * before adding. The only allowlisted step that adds a searched product is
   * `select_search_result`, which requires a `product_ref` that, by definition,
   * that line does not have. Synthesising one would be exactly the least-bad
   * match this estate refuses everywhere else, and it would do it while holding
   * the trolley.
   *
   * So the two ends are made to AGREE by refusing, not by inventing: the
   * supervised route consumes `progress.handoff`, this arm consumes
   * `progress.plan`, and an arm handed a supervised handoff it cannot execute
   * stops loudly instead of completing an empty shop. `--plan-file` remains the
   * explicit, human-supplied way to give this runner real work.
   */
  reconstruct({ planFile = null } = {}) {
    let rawPlan = this.progress.plan;
    if ((!Array.isArray(rawPlan) || rawPlan.length === 0) && planFile) {
      rawPlan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
      this.progress.plan = rawPlan;
      this.log(`no plan on the request - seeded ${rawPlan.length} step(s) from ${planFile}`);
    }
    this.plan = validatePlan(rawPlan || []);
    if (this.plan.length === 0) {
      const handoff = this.progress.handoff || null;
      throw new NoExecutablePlanError(
        handoff
          ? `this request carries a SUPERVISED handoff (packet ${handoff.packet_fingerprint || 'unknown'}, `
            + `shop ${handoff.shop_ref || 'unknown'}) under progress.handoff, and no executable step plan under `
            + 'progress.plan. This runner executes progress.plan only. Refusing rather than reporting a basket '
            + 'that was never built - hand this shop to the supervised browser route, or supply --plan-file.'
          : 'this request carries no executable step plan (progress.plan is absent or empty). Refusing rather '
            + 'than reporting a basket that was never built.',
        {
          requestId: this.request ? this.request.id : null,
          shopId: this.request ? this.request.shop_id : null,
          hasHandoff: handoff !== null,
          packetFingerprint: handoff ? handoff.packet_fingerprint || null : null,
        },
      );
    }
    this.remaining = P.remainingPlan(this.plan, this.progress);
    const inFlight = P.inFlightStepId(this.progress);
    this.inFlight = inFlight;
    this.log(`reconstructed: ${this.plan.length} planned, ${this.plan.length - this.remaining.length} already done, ${this.remaining.length} remaining${inFlight ? `, 1 in flight (${inFlight})` : ''}`);
    return { planned: this.plan.length, remaining: this.remaining.length, inFlight };
  }

  // ---- the loop ------------------------------------------------------

  async run({ requestId = null, shopId = null, planFile = null, dryRun = false } = {}) {
    if (!(await this.claim({ requestId, shopId }))) {
      this.log('REFUSING TO RUN: no claimable request (another runner holds a live lease, or nothing is queued)');
      return { outcome: 'refused' };
    }

    // ── EVERY `return await` BELOW IS LOAD-BEARING ──────────────────────────
    // Do not "tidy" any of them into a bare `return this.finishX()`, and do not
    // let a no-return-await lint rule do it for you. Returning the promise
    // UNAWAITED resolves it after control has already left this try block, so a
    // rejection from a termination path arrives with no handler attached: it
    // skips the catch below and escapes run() entirely. Nothing parks the
    // request, nothing records a reason, and the shop is left mid-run with no
    // durable explanation.
    //
    // These are the error and handover paths - the ones least likely to be
    // noticed and most likely to matter. Each site carries a short marker
    // pointing back here.
    try {
      this.reconstruct({ planFile });

      // A request already flagged for re-authentication does not get retried
      // blind: a human has to clear it, or the runner would spin against a
      // login page for ever.
      if (this.progress.human_reauth_required) {
        const still = await this.checkReauthStillBlocking(dryRun);
        // `await` load-bearing - see the note above the try.
        if (still) return await this.finishReauth('re-authentication still required on start');
      }

      if (!dryRun) {
        this.session = this.makeSession({ log: (m) => this.log(`[browser] ${m}`) });
        await this.session.open();
        const st = await this.session.open_groceries().catch((e) => { if (e instanceof ReauthRequiredError) return { reauth_required: true, url: e.url, reauth_reason: e.message }; throw e; });
        // `await` load-bearing - see the note above the try.
        if (st && st.reauth_required) return await this.finishReauth(st.reauth_reason || `landed on an authentication surface (${st.url})`);
      }

      // A REHEARSAL MOVES NO REAL SHOP STATE. --dry-run issues no browser
      // command, so it has no business advancing the shop Warwick is actually
      // shopping for - in either direction. See finishDryRun().
      if (!dryRun) await this.markShopShopping();
      this.progress = P.setRunnerState(this.progress, 'running');
      await this.save('running');

      // The in-flight step (a crash between click and commit) is verified by
      // READING, never by clicking again.
      if (this.inFlight && !dryRun) await this.reconcileInFlight();

      for (const step of this.remaining) {
        const gate = await this.gate();
        // `await` load-bearing on both - see the note above the try.
        if (gate === 'release') return await this.releaseToHuman('human takeover requested');
        if (gate === 'finish') break;
        if (gate === 'cancelled') return await this.finishCancelled();
        this.assertLease();
        await this.executeStep(step, dryRun);
        await sleep(this.opts.interStepMs);
      }

      // `await` load-bearing - see the note above the try. This is the site
      // that exposed the whole class: EmptyBasketError got past the handler
      // meant to park the request FAILED.
      return await this.finishBasketReady(dryRun);
    } catch (e) {
      if (e instanceof lease.LeaseLostError) {
        this.log(`stopped: ${e.message}`);
        return { outcome: 'lease_lost' };
      }
      if (e instanceof ReauthRequiredError) {
        // THE ASYMMETRY MATTERS HERE. Inside the catch there is no outer
        // handler left, so `await` alone would fix only the finally ordering -
        // a rejection from finishReauth would still escape run() with nothing
        // recorded anywhere. The inner try is what makes this branch safe:
        // failing to REPORT re-authentication falls through to the generic park
        // below, so the request is parked FAILED with the real reason instead
        // of vanishing.
        try {
          return await this.finishReauth(e.reauth_reason || e.message);
        } catch (e2) {
          this.log(`FAILED while reporting re-authentication: ${e2.name}: ${e2.message}`);
          e = e2;
        }
      }
      if (e instanceof RateLimitedError) {
        // Being throttled is not a failed request - it is a "come back later".
        // Marking it failed would need a human to re-queue work that is fine.
        this.log('ASDA is throttling this profile - releasing the lease, leaving the request queued to be picked up later');
        try { this.progress = P.setRunnerState(this.progress, 'paused'); await this.save(null, 'rate limited by ASDA; retry later'); } catch { /* the release below still matters */ }
        this.stopHeartbeat();
        await lease.release(this.query, { requestId: this.request.id, runnerId: this.runnerId, reason: 'rate limited by ASDA' });
        return { outcome: 'rate_limited', summary: P.summary(this.progress) };
      }
      this.log(`FAILED: ${e.name}: ${e.message}`);
      try {
        this.progress = P.setRunnerState(this.progress, 'failed');
        await lease.finish(this.query, { requestId: this.request.id, runnerId: this.runnerId, status: 'failed', progress: this.progress, lastError: `${e.name}: ${e.message}`.slice(0, 500) });
      } catch { /* the lease may already be gone; the error is already logged */ }
      return { outcome: 'failed', error: `${e.name}: ${e.message}` };
    } finally {
      this.stopHeartbeat();
      if (this.session) this.session.close();   // the TAB and the BROWSER stay open
    }
  }

  /**
   * The control gate, consulted before EVERY step. `pause` holds without
   * releasing (Warwick can look, the runner simply stops clicking); `takeover`
   * releases the lease outright so no automated click can race a human hand.
   */
  async gate() {
    const started = Date.now();
    for (;;) {
      const cancelled = await this.isCancelled();
      if (cancelled) return 'cancelled';
      const directive = this.control.read().directive;
      const decision = control.decide(directive);
      if (decision !== 'hold') {
        if (this.progress._runner_state === 'paused' && decision === 'proceed') {
          this.log('resuming from the last durable checkpoint');
          this.progress = P.setRunnerState(this.progress, 'running');
          await this.save();
        }
        return decision;
      }
      if (this.progress._runner_state !== 'paused') {
        this.log('PAUSED - issuing no browser commands; the browser stays open and usable');
        this.progress = P.setRunnerState(this.progress, 'paused');
        await this.save();
      }
      if (Date.now() - started > this.opts.maxPauseMs) {
        this.log(`paused for more than ${Math.round(this.opts.maxPauseMs / 60000)} minutes - releasing the lease so nothing holds the trolley`);
        return 'release';
      }
      this.assertLease();
      await sleep(this.opts.pollMs);
    }
  }

  async isCancelled() {
    const res = await this.query(`select status from asdair.browser_build_request where id = $1::bigint`, [String(this.request.id)]);
    return res.rows[0] && res.rows[0].status === 'cancelled';
  }

  /** Execute ONE allowlisted step, checkpointing durably either side of it. */
  async executeStep(step, dryRun) {
    this.progress = P.markInFlight(this.progress, step.step_id);
    await this.save();

    if (dryRun) {
      this.log(`[dry-run] ${step.step_id} ${step.command} ${step.product_ref || step.term || ''}`);
      this.progress = P.markCompleted(this.progress, step, { outcome: 'ok' });
      await this.save();
      return;
    }

    this.log(`step ${step.step_id}: ${step.command} ${step.product_ref || step.term || ''}`);
    try {
      const result = await this.dispatch(step);
      if (result && result.reason === 'already-in-trolley') {
        // The product page shows a stepper rather than an Add control, which
        // means the item is already there. That is the PLANNED outcome, not a
        // failure - a retried step must converge, not report an error.
        this.progress = P.markCompleted(this.progress, step, { outcome: 'ok' });
        this.log('  -> already in the trolley; recorded complete, not added twice');
      } else if (result && result.reason === 'unavailable') {
        this.progress = P.markUnavailable(this.progress, step, result.title || null);
        this.log('  -> UNAVAILABLE (reported for a human; the runner never swaps an item)');
      } else if (result && result.added === false && result.reason === 'approved-result-not-in-search') {
        this.progress = P.markHeld(this.progress, step, 'the approved product did not appear in the search results');
        this.progress = P.markFailed(this.progress, step, result.reason);
        this.log(`  -> HELD for a human: ${result.reason}`);
      } else if (result && (result.added === false || result.ok === false)) {
        if (step.command === 'add_to_favourites') {
          this.progress = P.markPendingFavourite(this.progress, step, result.reason || 'favourite control not found');
          this.progress = P.markCompleted(this.progress, step, { outcome: 'deferred' });
          this.log(`  -> deferred to pending_action: ${result.reason}`);
          await this.recordFavouritePending(step, result.reason);
        } else {
          this.progress = P.markFailed(this.progress, step, result.reason || 'action did not complete');
          this.log(`  -> FAILED: ${result.reason}`);
        }
      } else {
        this.progress = P.markCompleted(this.progress, step, { outcome: 'ok' });
        this.log(`  -> ok${result && result.qty_after != null ? ` (qty ${result.qty_after})` : ''}`);
      }
    } catch (e) {
      if (e instanceof ReauthRequiredError || e instanceof lease.LeaseLostError) throw e;
      if (e instanceof RateLimitedError) {
        this.log('  -> rate limited; backing off 60s and retrying this step once');
        await sleep(60_000);
        try {
          await this.dispatch(step);
          this.progress = P.markCompleted(this.progress, step, { outcome: 'ok' });
        } catch (e2) { this.progress = P.markFailed(this.progress, step, `${e2.name}: ${e2.message}`); }
      } else {
        this.progress = P.markFailed(this.progress, step, `${e.name}: ${e.message}`);
        this.log(`  -> FAILED: ${e.name}: ${e.message}`);
      }
    }
    await this.save();
  }

  /** Dispatch is the ONLY place a command name becomes an action. */
  async dispatch(step) {
    const s = this.session;
    switch (step.command) {
      case 'open_groceries': return s.open_groceries();
      case 'open_trolley': return s.open_trolley();
      case 'open_regulars': return s.open_regulars();
      case 'locate_product': return s.locate_product(step.product_ref);
      case 'add_known_product': return s.add_known_product(step.product_ref);
      case 'search': return s.search(step.term);
      case 'select_search_result': return s.select_search_result(step.term, step.product_ref);
      case 'set_quantity': return s.set_quantity(step.product_ref, step.qty);
      case 'read_quantity': return s.read_quantity(step.product_ref);
      case 'add_to_favourites': return s.add_to_favourites(step.product_ref);
      case 'report_unavailable': return s.report_unavailable(step.product_ref);
      case 'read_basket_line_count': return s.read_basket_line_count();
      case 'read_estimated_total': return s.read_estimated_total();
      case 'pause': case 'resume': case 'stop_at_basket_ready': return { ok: true, control: step.command };
      default: throw new Error(`unreachable: ${step.command} passed validation but has no dispatch`);
    }
  }

  /**
   * A step that was in flight when the process died. The click MAY have landed.
   * The safe resolution is to READ the live quantity, never to click again.
   */
  async reconcileInFlight() {
    const step = this.plan.find((s) => s.step_id === this.inFlight);
    if (!step) { delete this.progress._in_flight; await this.save(); return; }
    this.log(`reconciling in-flight step ${step.step_id} by READING, never by clicking again`);
    if (!step.product_ref) {
      this.progress = P.markFailed(this.progress, step, 'in flight at restart; not verifiable by reading');
    } else {
      const q = await this.session.read_quantity(step.product_ref);
      if (q.qty && q.qty > 0) {
        this.progress = P.markCompleted(this.progress, step, { outcome: 'ok' });
        this.log(`  -> it HAD landed (qty ${q.qty}); recorded complete, NOT repeated`);
      } else {
        delete this.progress._in_flight;
        this.log('  -> it had NOT landed; it stays on the remaining plan');
      }
    }
    await this.save();
    // Recompute from the durable record, not from the pre-reconciliation list.
    // Skipping this is exactly how a landed click gets repeated.
    this.remaining = P.remainingPlan(this.plan, this.progress);
  }

  async checkReauthStillBlocking(dryRun) {
    if (dryRun) return true;
    const s = this.makeSession({ log: (m) => this.log(`[browser] ${m}`) });
    await s.open();
    const st = await s.state();
    s.close();
    return st.reauth_required === true;
  }

  async recordFavouritePending(step, reason) {
    const shop = await store.loadShop(this.query, this.request.shop_id);
    await store.recordPendingAction(this.query, {
      householdId: shop ? shop.household_id : 1,
      shopId: this.request.shop_id,
      actionType: 'add_favourite',
      actionKey: String(step.product_ref),
      payload: { product_ref: step.product_ref, name: step.name || null },
      note: String(reason || '').slice(0, 200),
    });
  }

  async markShopShopping() {
    try { await store.setShopStatus(this.query, { shopId: this.request.shop_id, from: 'WAITING_FOR_BROWSER', to: 'SHOPPING', description: `browser runner ${this.runnerId} claimed request ${this.request.id}` }); }
    catch (e) { this.log(`(shop status note skipped: ${e.message})`); }
  }

  // ---- terminations --------------------------------------------------

  /**
   * Stop at BASKET_READY, leaving the browser open on the trolley.
   *
   * ── THE RUNNER MUST EARN THESE WORDS ────────────────────────────────────────
   * `BASKET_READY` means, in shopStatus.js's own wording, "basket ready for you
   * to check". This method is the ONLY place in the estate that moves a shop
   * into that state, so it is the only place the claim can be checked - and it
   * used to read the trolley, log the number, record it, and then announce
   * success without once comparing it to anything.
   *
   * Zero products is not a small basket. It is the absence of the thing being
   * claimed, and every explanation for it - every add rejected, the wrong
   * trolley read, a session that had lost the basket - is a fault rather than an
   * outcome. So an empty trolley after a plan that intended adds is refused
   * loudly, in the same shape as an unexecutable plan.
   *
   * A NON-ZERO SHORTFALL IS NOT REFUSED, and that line is deliberate. Items go
   * out of stock; this estate already treats a shortfall as a reported per-line
   * outcome and sets no fill-rate threshold anywhere. Inventing one here would
   * strand a perfectly good trolley behind a number nobody chose. What it does
   * instead is make the difference VISIBLE - durable in progress, and one line
   * in the shop_event ledger the Cockpit already reads, so Warwick learns his
   * trolley is short without anyone reading a runner log.
   */
  async finishBasketReady(dryRun) {
    if (dryRun) return this.finishDryRun();

    const basket = await this.session.read_basket();
    this.progress = P.applyBasketRead(this.progress, basket);
    this.progress = P.applyShortfall(this.progress, this.plan || []);
    const sf = this.progress.basket_shortfall;
    this.log(`basket read back: ${basket.product_count} product(s), total ${basket.order_total}`);

    if (sf.intended > 0 && this.progress.basket_product_count === 0) {
      const reason = this.emptyBasketReason(sf);
      this.log(`REFUSING to report BASKET_READY: ${reason}`);
      // Written before the throw so the refusal is visible where Warwick looks,
      // not only in this process's stdout.
      try {
        await store.noteShopEvent(this.query, {
          shopId: this.request.shop_id, eventType: 'failure',
          description: `browser runner: ${reason}`,
        });
      } catch { /* the durable request row still carries the reason */ }
      throw new EmptyBasketError(reason, {
        requestId: this.request.id, shopId: this.request.shop_id, shortfall: sf,
      });
    }

    if (sf.missing > 0) {
      const note = `basket is SHORT: ${sf.added} of ${sf.intended} intended product(s) in the trolley, `
        + `${sf.missing} missing (${sf.unavailable} unavailable, ${sf.held} held, ${sf.failed} failed action(s)). `
        + 'Reported, not smoothed away - the runner never swaps an item.';
      this.log(note);
      try { await store.noteShopEvent(this.query, { shopId: this.request.shop_id, eventType: 'note', description: `browser runner: ${note}` }); }
      catch { /* the shortfall is durable in progress either way */ }
    }

    this.progress = P.setRunnerState(this.progress, 'basket_ready');
    await lease.finish(this.query, { requestId: this.request.id, runnerId: this.runnerId, status: 'complete', progress: this.progress });
    try { await store.setShopStatus(this.query, { shopId: this.request.shop_id, from: 'SHOPPING', to: 'BASKET_READY', description: 'browser runner stopped at basket-ready; browser left open on the trolley' }); } catch { /* recorded in the request either way */ }
    this.log('BASKET_READY - stopping here. The browser stays open on the trolley. Nothing is ordered, nothing is paid for.');
    return { outcome: 'basket_ready', summary: P.summary(this.progress) };
  }

  /**
   * WHY the basket was refused, in words a human can act on.
   *
   * The all-unavailable case gets its own sentence on purpose. "ASDA had none of
   * it" and "the runner is broken" are the same empty trolley and completely
   * different problems, and a reason that cannot tell them apart sends Warwick
   * looking in the wrong place.
   */
  emptyBasketReason(sf) {
    const tail = ` No item was swapped and nothing was ordered. Recorded: ${sf.added} add(s) succeeded, `
      + `${sf.unavailable} unavailable, ${sf.held} held, ${sf.failed} failed action(s).`;
    if (sf.intended > 0 && sf.unavailable >= sf.intended) {
      return `the trolley is EMPTY because ASDA had none of it - all ${sf.intended} intended product(s) came `
        + 'back unavailable. There is no basket to check, so this is not BASKET_READY.' + tail;
    }
    return `the plan executed but the trolley read back EMPTY (0 products) after intending ${sf.intended} `
      + 'product add(s). Refusing to report a basket that was never built.' + tail;
  }

  /**
   * A REHEARSAL ENDS AS A REHEARSAL.
   *
   * --dry-run walks the whole durable path - claim, lease, heartbeat,
   * checkpoint, pause, resume, release - and issues NOT ONE browser command. It
   * therefore builds nothing and reads nothing, and it used to finish by marking
   * the request `complete` and moving a real shop SHOPPING -> BASKET_READY. That
   * is the purest form of the thing this build refuses: a basket claimed by a
   * process that never touched a trolley.
   *
   * It is not a failure either - the rehearsal did exactly what it was asked.
   * So it releases the lease and leaves the request QUEUED, which is the honest
   * state of the world: the work still exists and has not been done yet.
   */
  async finishDryRun() {
    this.progress = P.setRunnerState(this.progress, 'dry_run');
    try { await this.save(); } catch { /* the release below still matters */ }
    this.stopHeartbeat();
    await lease.release(this.query, {
      requestId: this.request.id, runnerId: this.runnerId,
      reason: 'dry run - no browser command was issued, so nothing was built',
    });
    this.log('DRY RUN complete - not one browser command was issued, so nothing was built and nothing is claimed. '
      + 'The shop is untouched and the request stays queued for a real run.');
    return { outcome: 'dry_run', summary: P.summary(this.progress) };
  }

  /** Release the writing lease so a human can drive without racing an automated click. */
  async releaseToHuman(reason) {
    this.progress = P.setRunnerState(this.progress, 'human_takeover');
    try { await this.save(); } catch { /* if the lease is already gone the release below is still correct */ }
    this.stopHeartbeat();
    const r = await lease.release(this.query, { requestId: this.request.id, runnerId: this.runnerId, reason });
    this.log(`RELEASED the writing lease (${reason}). The browser is yours - no automated clicks will race you. Request is back to '${r ? r.status : 'unknown'}' with all progress intact.`);
    return { outcome: 'human_takeover', summary: P.summary(this.progress) };
  }

  /** Report re-authentication. NEVER resolve it. */
  async finishReauth(reason) {
    this.progress = P.setReauthRequired(this.progress, true, reason);
    this.progress = P.setRunnerState(this.progress, 'paused');
    try { await this.save(null, `human_reauth_required: ${reason}`.slice(0, 500)); } catch { /* logged below regardless */ }
    try { await store.noteShopEvent(this.query, { shopId: this.request.shop_id, eventType: 'failure', description: `browser runner: ${reason}` }); } catch { /* non-fatal */ }
    this.stopHeartbeat();
    await lease.release(this.query, { requestId: this.request.id, runnerId: this.runnerId, reason: 'human_reauth_required' });
    this.log(`HUMAN RE-AUTHENTICATION REQUIRED: ${reason}`);
    this.log('The runner has released the lease and will not proceed. Warwick signs in himself, in the browser window; the runner never sees or handles what he types.');
    return { outcome: 'human_reauth_required', summary: P.summary(this.progress) };
  }

  async finishCancelled() {
    this.log('request was cancelled - stopping, browser left exactly as it is');
    this.stopHeartbeat();
    return { outcome: 'cancelled', summary: P.summary(this.progress) };
  }

  /** Graceful shutdown on SIGINT/SIGTERM: give the lease back immediately. */
  async shutdown(signal) {
    if (this.stopping) return;
    this.stopping = true;
    this.log(`${signal} - releasing the lease and leaving the browser open`);
    this.stopHeartbeat();
    try { if (this.request) await lease.release(this.query, { requestId: this.request.id, runnerId: this.runnerId, reason: `runner ${signal}` }); } catch { /* nothing else to do while exiting */ }
    if (this.session) this.session.close();
  }
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const a = { requestId: null, shopId: null, planFile: null, dryRun: false, options: {} };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--request') a.requestId = next();
    else if (k === '--shop') a.shopId = next();
    else if (k === '--plan-file') a.planFile = next();
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--lease-ms') a.options.leaseMs = Number(next());
    else if (k === '--heartbeat-ms') a.options.heartbeatMs = Number(next());
    else if (k === '--wait-ms') a.options.waitMs = Number(next());
    else if (k === '--poll-ms') a.options.pollMs = Number(next());
    else if (k === '--max-pause-ms') a.options.maxPauseMs = Number(next());
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 30).join('\n'));
    return 0;
  }
  const query = store.writeQuery();
  const runner = new Runner({ query, options: args.options });
  const onSignal = (sig) => { runner.shutdown(sig).then(() => query.end()).then(() => process.exit(0)); };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  const res = await runner.run(args);
  console.log(JSON.stringify(res, null, 2));
  await query.end();
  return res.outcome === 'basket_ready' || res.outcome === 'human_takeover' ? 0 : (res.outcome === 'failed' ? 1 : 0);
}

module.exports = { Runner, parseArgs, DEFAULTS, NoExecutablePlanError, EmptyBasketError };

if (require.main === module) {
  main().then((c) => process.exit(c)).catch((e) => { console.error('FATAL', e); process.exit(1); });
}
