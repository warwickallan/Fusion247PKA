// =====================================================================
// WO-2026-08-18-B15-RUNTIME - GAPS 3 AND 7. THE THING THAT WAKES.
//
// THE SHAPE OF THE FAILURE THIS CLOSES:
//
// `asdair.browser_build_request` has existed for weeks. The pipeline queues a
// row, moves the shop to WAITING_FOR_BROWSER, and the stage table records what
// it is waiting for: "the supervised browser operator claiming the request".
// NOTHING IN THE ESTATE EVER CLAIMED ONE. The row sat there and a human
// eventually ran a shell command with a hand-built manifest.
//
// So the gap was never "AsdAIr cannot be woken". The durable state, the poll,
// the pid lock, the single-consumer rule and the lease were all already built
// and all already correct. What was missing was A CONSUMER: forty lines that
// take a queued request and turn it into a run. That is this file.
//
// -------------------------------------------------------------------------
// WHY THIS IS NOT A CONTROL PLANE
// -------------------------------------------------------------------------
// It adds no scheduler, no queue, no registry, no state machine and no new
// table. It is a function the EXISTING runtime pass calls, using the EXISTING
// lease, against the EXISTING request row. The runtime already runs every
// pass; this gives it something to do when a request is waiting.
//
// -------------------------------------------------------------------------
// GAP 7 - RECOVERY IS A PROPERTY OF THE LEASE, NOT OF A NEW MECHANISM
// -------------------------------------------------------------------------
// Kill the process mid-shop and three things are already true: the request row
// still says `running`, its `_lease` expires on the DATABASE clock, and
// `lease.claim` treats an expired lease as claimable. So the next pass of the
// next runtime - started by the Windows task after a reboot, or by the
// supervisor after a crash - RE-CLAIMS the same request and resumes.
//
// The one thing that was NOT durable is what the executor had already done.
// That lived in a JSON file beside the source, so a resumed run on a fresh
// checkout, a different working directory or another machine would re-add
// everything. Progress is therefore written back into the request row after
// every line, and read out of it when the request is claimed. NOTHING
// SESSION-LOCAL IS REQUIRED, which is the prohibition stated in the gap.
//
// PURE-ISH: every dependency is injected. The proofs run with a fake query
// function and a fake executor - no database, no browser, no gateway.
// =====================================================================
'use strict';

const lease = require('../browser-runner/lease.cjs');

/** Shop lines whose status means "do not shop this". */
const NOT_SHOPPABLE = new Set(['excluded', 'unreadable']);

/**
 * Durable shop rows -> the manifest the executor consumes. PURE.
 *
 * THE CANONICAL ASDA DESCRIPTION LEADS. `canonical_name` comes from our own
 * `regulars` row by id - never from a model's words - and it is the identity
 * Warwick has ruled on. The raw reading is the fallback for a line the
 * catalogue does not know, which is a NORMAL case rather than an error.
 *
 * A quantity that was never written down is not invented. `shopLines.js` is
 * deliberate that it stays null, so the fallback order is explicit and the
 * BASIS travels with the line: whatever the executor ends up doing, the report
 * can say where the number came from.
 */
function buildManifest({ shop, lines, catalogue = null }) {
  if (!shop || !shop.shop_ref) throw new Error('buildManifest needs a shop with a shop_ref');
  const byId = new Map(
    ((catalogue && (catalogue.rows || catalogue)) || []).map((r) => [String(r.id), r]),
  );

  const out = [];
  for (const l of (lines || [])) {
    if (NOT_SHOPPABLE.has(String(l.status))) continue;

    const reg = l.matched_regular_id != null ? byId.get(String(l.matched_regular_id)) || null : null;
    const product = l.canonical_name || (reg && reg.name) || l.raw_reading;
    if (!product || !String(product).trim()) continue;

    let qty = l.quantity;
    let qtyBasis = 'as written on the list';
    if (qty == null) {
      const typical = reg && reg.typical_qty != null ? reg.typical_qty : null;
      if (typical != null) { qty = typical; qtyBasis = 'the household typical quantity - none was written on the list'; }
      else { qty = 1; qtyBasis = 'defaulted to 1 - none was written and the catalogue holds no typical quantity'; }
    }

    out.push({
      n: Number(l.line_no),
      product: String(product).trim(),
      qty: Number(qty),
      qty_basis: qtyBasis,
      asda_product_id: l.asda_product_id != null ? String(l.asda_product_id)
        : (reg && reg.asda_product_id != null ? String(reg.asda_product_id) : null),
      note: l.note || null,
      status: l.status || null,
    });
  }

  out.sort((a, b) => a.n - b.n);
  return {
    shop_ref: shop.shop_ref,
    shop_id: shop.id != null ? String(shop.id) : null,
    household_id: shop.household_id != null ? shop.household_id : 1,
    line_count: out.length,
    built_from: 'asdair.shop_line - the durable interpretation, not a hand-built file',
    lines: out,
  };
}

/**
 * Claim ONE queued browser build request and shop it.
 *
 * Returns null when nothing is claimable - which is the ordinary answer on
 * almost every pass and is not an error. Returns a result object otherwise.
 *
 * @param {object} io injected boundary
 * @param {(text:string, params:any[]) => Promise<{rows:any[]}>} io.query   write-pool query
 * @param {(shopId:string) => Promise<{shop:object, lines:object[]}>}       io.loadShop
 * @param {() => Promise<object|null>}                                      io.loadCatalogue
 * @param {() => Promise<object|null>}                                      io.loadRules
 * @param {(options:object) => Promise<object>}                             io.runBasket
 * @param {(payload:object) => Promise<void>}                               io.announce
 */
async function consumeOneBrowserBuildRequest(io, { leaseMs = lease.DEFAULT_LEASE_MS, log = () => {} } = {}) {
  const { query, loadShop, loadCatalogue, loadRules, runBasket, announce } = io;

  const runnerId = lease.newRunnerId();
  const claimed = await lease.claim(query, { runnerId, leaseMs });
  if (!claimed) return null;

  log(`browser build request ${claimed.id} claimed by ${runnerId} (shop ${claimed.shop_id})`);

  // ── GAP 7. WHAT THIS REQUEST HAD ALREADY DONE, FROM THE ROW ──────────────
  // `_lease` is the lease's own bookkeeping and is not executor progress.
  const carried = (claimed.progress && claimed.progress.executor) || null;
  if (carried) {
    log(`resuming request ${claimed.id}: ${(carried.completed_steps || []).length} step(s) already completed by a previous process`);
  }

  const heartbeat = setInterval(() => {
    lease.heartbeat(query, { requestId: claimed.id, runnerId, leaseMs })
      .catch((e) => log(`heartbeat failed for request ${claimed.id}: ${e.message}`));
  }, Math.max(5000, Math.floor(leaseMs / 3)));
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  try {
    const { shop, lines } = await loadShop(claimed.shop_id);
    const catalogue = loadCatalogue ? await loadCatalogue() : null;
    const rules = loadRules ? await loadRules() : null;
    const manifest = buildManifest({ shop, lines, catalogue });
    log(`request ${claimed.id}: manifest built from durable rows - ${manifest.line_count} line(s)`);

    const result = await runBasket({
      manifest,
      catalogue,
      rules,
      resumeFrom: carried,
      // Progress is flushed to the ROW, not to a file beside the source. This
      // is the callback that makes recovery survive a fresh checkout.
      onProgress: async (progress) => {
        await lease.writeProgress(query, {
          requestId: claimed.id, runnerId, progress: { executor: progress },
        });
      },
    });

    const ready = !!(result && result.basketReady);

    // -- A CONFIGURATION FAILURE IS NOT A PERMANENT FAILURE (AC4) -----------
    //
    // What this replaces: `lease.finish(status:'failed')` on the FIRST
    // `basket_not_ready`, whatever caused it. On 2026-08-18 that killed
    // requests 1, 2, 5 and 7 between 21:22:48Z and 21:26:03Z because three
    // environment variables were absent - no retry, no backoff, no re-queue -
    // and overwrote `progress` with `{"executor": null}`, discarding the
    // executor progress the Gap 7 recovery design exists to preserve.
    //
    // CLASSIFIED BY BLOCKER KIND, NOT BY MESSAGE. `run-basket.cjs` returns a
    // structured blocker; `launcher-config` is the machine not being ready and
    // says nothing about the shop. It goes back to the queue through the
    // EXISTING bounded-retry path - the one the attempt ceiling already
    // provides - rather than through a second mechanism written beside it.
    //
    // A RUN-CLASS failure is unchanged: an untruthful reconciliation is a fact
    // about this shop and needs a human looking at the shop, not another
    // attempt at the same thing.
    const envBlockers = environmentBlockers(result);
    if (!ready && envBlockers.length > 0) {
      const released = await lease.release(query, {
        requestId: claimed.id,
        runnerId,
        countAttempt: true,
        failureClass: lease.FAILURE_CLASS.ENVIRONMENT,
        reason: summariseBlockers(result),
      });
      const attempts = Number(released && released.attempts) || 0;
      const terminal = !!(released && released.status === 'failed');

      // -- AND IT IS NOT SILENT (AC5) --------------------------------------
      // Announced on the FIRST occurrence, not only at the ceiling. Retrying a
      // missing environment variable in silence for half an hour is the same
      // defect wearing a quieter coat: nobody can supply what nobody was told
      // was missing. The caller's `announce` is what makes it durable; this
      // module only states the fact.
      if (announce) {
        await announce({
          kind: 'basket_blocked_on_environment',
          shop_ref: manifest.shop_ref,
          shop_id: claimed.shop_id,
          // The outbox is keyed per household. Carried on the payload rather
          // than re-read by the announcer: the consumer already holds the shop
          // row, and a second read is a second chance to disagree with it.
          household_id: shop.household_id,
          request_id: claimed.id,
          blockers: envBlockers,
          attempts,
          max_attempts: lease.MAX_ATTEMPTS,
          terminal,
          retry_after: (released && released.retry_after) || null,
        });
      }
      log(`request ${claimed.id} blocked on the environment (attempt ${attempts}/${lease.MAX_ATTEMPTS})`
        + `${terminal ? ' - ceiling reached, it will be re-queued when the environment is ready' : ' - it will be retried'}`);
      return {
        requestId: claimed.id, runnerId, shopRef: manifest.shop_ref, ready: false, result, requeued: !terminal,
      };
    }

    await lease.finish(query, {
      requestId: claimed.id,
      runnerId,
      status: ready ? 'complete' : 'failed',
      // -- THE CARRIED PROGRESS SURVIVES A FAILURE (AC4) ---------------------
      // This used to write `{ executor: null }` whenever there was no
      // reconciliation, which is exactly when the carried progress is worth
      // most. A run that got halfway and then failed now keeps what it did.
      progress: { executor: (result && result.reconciliation) || carried || null },
      lastError: ready ? null : summariseBlockers(result),
    });

    // ── THE ANNOUNCEMENT, GATED ─────────────────────────────────────────────
    // "Mum's basket is ready" is issued by AsdAIr, through the normal surface,
    // and ONLY when the reconciliation is truthful. A blocked basket reports
    // the blockers instead - it does not go quiet, and it does not announce.
    if (announce) {
      await announce(ready
        ? { kind: 'basket_ready', shop_ref: manifest.shop_ref, request_id: claimed.id, reconciliation: result.reconciliation, text: "Mum's basket is ready." }
        : { kind: 'basket_not_ready', shop_ref: manifest.shop_ref, request_id: claimed.id, blockers: (result && result.blockers) || [], reconciliation: result && result.reconciliation });
    }

    log(`request ${claimed.id} finished: ${ready ? 'basket ready' : 'NOT announceable'}`);
    return { requestId: claimed.id, runnerId, shopRef: manifest.shop_ref, ready, result };
  } catch (err) {
    // The request goes BACK to queued rather than dying, so the next pass -
    // or the next process after a restart - picks it up again.
    // countAttempt: TRUE - this is the ERROR path, and it is the one release
    // that may consume a retry. Request id 1 was released here 291 times
    // between 2026-07-28 and the Gate 2 review with nothing counting them.
    await lease.release(query, {
      requestId: claimed.id, runnerId, countAttempt: true,
      reason: String(err && err.message ? err.message : err).slice(0, 300),
    })
      .catch(() => { /* the lease will expire on its own; never mask the real error */ });
    log(`request ${claimed.id} released after an error: ${err && err.message}`);
    throw err;
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * The blocker kinds that describe the MACHINE rather than the shop.
 *
 * Deliberately a short, explicit allow-list rather than a rule about which
 * kinds are "transient": a kind nobody has classified must fall to the
 * conservative side and finish terminally, where a human sees it, instead of
 * quietly cycling through five attempts on a fault that will never clear.
 *
 * NOT included, and named so the omission is a decision rather than an
 * oversight: `reauth-required`. It is genuinely an environment condition a
 * human closes, but `run-basket.cjs` records it on `progress` and it does not
 * reach `result.blockers`, so classifying it here would be classifying
 * something that never arrives. Reported, not silently half-built.
 */
const ENVIRONMENT_BLOCKERS = Object.freeze(['launcher-config']);

/** PURE. The environment-class blockers in a run result, if any. */
function environmentBlockers(result) {
  const blockers = (result && result.blockers) || [];
  return blockers.filter((b) => b && ENVIRONMENT_BLOCKERS.includes(String(b.kind)));
}

function summariseBlockers(result) {
  const blockers = (result && result.blockers) || [];
  if (blockers.length === 0) return 'the run produced no reconciliation';
  return blockers.slice(0, 5).map((b) => `${b.kind}${b.line != null ? ` (line ${b.line})` : ''}`).join('; ').slice(0, 300);
}

module.exports = {
  buildManifest, consumeOneBrowserBuildRequest, NOT_SHOPPABLE,
  ENVIRONMENT_BLOCKERS, environmentBlockers,
};
