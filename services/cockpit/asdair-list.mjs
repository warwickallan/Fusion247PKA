// Fusion247 Cockpit — THE LIST PROXY. The last mile between Mum's SEND button and a durable shop.
//
// WHY THIS EXISTS. Mum's Cockpit is the ONE surface she can reach (tailnet-only, over HTTPS). The
// service that can actually record a list listens on 127.0.0.1:8710, which on her phone is the
// PHONE's own loopback and not this machine's — the same sentence written above proxyAsdairMedia and
// above the checklist proxy, and the same reason both exist. Until this module, the Cockpit proxied
// GET only: there was no way for anything she tapped to reach a row, which is why her SEND button
// honestly said it could not send.
//
// ── ITS OWN MODULE, like asdair-checklist.mjs, and for the same hard reason ─────────────────────
// Importing server.mjs imports db.mjs, which opens live credentialed pools AT LOAD. So a handler
// that lives inside server.mjs cannot be executed by any gate — it can only be read. static.mjs,
// capae.mjs, rotation-report.mjs, private-api.mjs, down-reason.mjs and asdair-checklist.mjs were
// each extracted for exactly that reason and each says so in its own header. This one follows them
// so asdair-list-check.mjs can run the REAL handler over a REAL socket.
//
// ── EVERY FAILURE ARRIVES AS JSON. THIS IS THE POINT, NOT A DETAIL ──────────────────────────────
// The UI has to distinguish "did not send" from "sent", and a bare text 502 makes that impossible:
// the browser gets a body it cannot parse and has to guess. Its sibling proxies answer text/plain
// because a phone renders a checklist as a document — the opposite requirement. So every exit from
// this module, including the ones that never reach the upstream, is the contract's error shape:
//
//     { "ok": false, "error": "<machine_code>", "message": "<ONE plain sentence>" }
//
// ── AND `ok:true` ALONE NEVER MEANS "SENT" ──────────────────────────────────────────────────────
// The success body is forwarded VERBATIM, `created` included. `created:false` means the day's shop
// already existed and this submission changed nothing durable; the UI must render that differently.
// This module neither sets nor second-guesses that field — it must arrive as the store reported it.
//
// Read the body once, cap it, forward it. No new dependency; `whyDown` is the cockpit's own.
import { whyDown } from './down-reason.mjs';

// The path the UI posts to. Exported because the UI, the server dispatch and this module must all
// agree, and a route constant that exists only as a literal in three files is one that drifts.
export const ASDAIR_LIST_ROUTE = '/api/asdair/list';

// The upstream that actually records the list.
export const UPSTREAM_PATH = '/asdair/list';

// ── WP-B15-50. THE SENSE-CHECK PROXY LIVES IN THIS MODULE, DELIBERATELY ────────────────────────
// Not in a new file. `provenance.mjs` declares the cockpit's source closure module by module, so a
// new `.mjs` inside server.mjs's import graph must be declared there as well. This route is the same
// shape as the list route — POST JSON in, JSON out, every failure in the contract's error shape —
// and shares this module's body reader and forwarder, so a sibling file would have duplicated all of
// it to gain nothing but a second place for the two to drift.
//
// ⛔ IT IS READ-ONLY UPSTREAM AND MUST STAY THAT WAY. It asks whether she already has something; it
// records nothing. If it ever needs to write, that needs its own review, not a quiet edit here.
export const ASDAIR_CHECK_ITEM_ROUTE = '/api/asdair/check-item';
export const CHECK_ITEM_UPSTREAM_PATH = '/asdair/check-item';

// ── WP-B15-51. WARWICK'S DISPLAY-NAME WRITE, in this module for the same reason
// the sense-check is: `provenance.mjs` declares the cockpit's source closure
// module by module, so a new `.mjs` inside server.mjs's import graph has to be
// declared there too. This route is the same shape as the two above — POST JSON
// in, JSON out, every failure in the contract's error shape — and shares this
// module's body reader and forwarder.
//
// ⛔ IT WRITES, but only ever ONE column of ONE catalogue row, and only WARWICK
// reaches it. Mum's page never calls it.
export const ASDAIR_DISPLAY_NAME_ROUTE = '/api/asdair/display-name';
export const DISPLAY_NAME_UPSTREAM_PATH = '/asdair/display-name';

// Same cap as the existing POST route in server.mjs (/api/decide, 1e5). A weekly shopping list is a
// few hundred bytes; 100 kB is generous enough that no honest submission meets it, and small enough
// that a malformed client cannot spend this process's memory.
export const MAX_BODY_BYTES = 100000;

const JSON_TYPE = 'application/json; charset=utf-8';

/** Every exit from this module goes through here. There is no other way to end a response. */
function send(res, status, body) {
  res.writeHead(status, { 'content-type': JSON_TYPE });
  res.end(JSON.stringify(body));
}

function refuse(res, status, error, message) {
  send(res, status, { ok: false, error, message });
}

/**
 * Read a capped JSON body.
 *
 * ── WHY THIS DIVERGES FROM /api/decide, DELIBERATELY ───────────────────────────────────────────
 * That route caps by `req.destroy()`, which gives the client NO body at all — the browser sees a
 * network error and cannot tell an oversized list from a dead server. Here the caller must be able
 * to distinguish "did not send" from "sent", so an oversized body is answered `413` in the contract's
 * error shape and the request is only then abandoned. Same cap, honest answer.
 *
 * Resolves `{ ok: true, body }` or `{ ok: false, error, status, message }`. It never throws and
 * never resolves twice.
 */
export function readJsonBody(req, opts = {}) {
  const maxBytes = opts.maxBytes || MAX_BODY_BYTES;
  return new Promise((resolve) => {
    let raw = '';
    let bytes = 0;
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };

    req.on('data', (chunk) => {
      if (done) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
        finish({
          ok: false, status: 413, error: 'too_large',
          message: 'That list is too big to send. Try again with fewer items.',
        });
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (done) return;
      try {
        const parsed = JSON.parse(raw || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          finish({ ok: false, status: 400, error: 'bad_json', message: 'The list did not arrive in a form I could read.' });
          return;
        }
        finish({ ok: true, body: parsed });
      } catch {
        finish({ ok: false, status: 400, error: 'bad_json', message: 'The list did not arrive in a form I could read.' });
      }
    });
    req.on('error', () => {
      finish({ ok: false, status: 400, error: 'request_failed', message: 'The list did not finish arriving. Please try again.' });
    });
  });
}

/**
 * POST /api/asdair/list  ->  POST <origin>/asdair/list
 *
 * @param {object} req      node request
 * @param {object} res      node response
 * @param {string} origin   the AsdAIr service origin — this server owns the host:port, as everywhere
 * @param {{fetch?:Function, timeoutMs?:number, maxBytes?:number}} [deps]  injected only by the gate
 */
export async function proxyAsdairList(req, res, origin, deps) {
  return proxyJson(req, res, origin, deps, {
    upstreamPath: UPSTREAM_PATH,
    notPost: 'A list is sent with POST.',
    unreachable: (why) => 'I could not reach AsdAIr to send that list — ' + why + '. Nothing was sent.',
    unreadable: (why) => 'AsdAIr started to answer and then stopped — ' + why + '.',
    notJson: (status) => 'AsdAIr answered in a form I could not read (HTTP ' + status + '). Nothing was sent.',
  });
}

/**
 * POST /api/asdair/check-item  ->  POST <origin>/asdair/check-item      (WP-B15-50 AC1)
 *
 * The sense-check, on its way to the resolver. Identical mechanics to the list proxy above and
 * DIFFERENT WORDS on failure, on purpose: nothing was being sent here, so a message saying "nothing
 * was sent" would be answering a question she did not ask.
 *
 * ⛔ WHAT THE PAGE MUST DO WITH A FAILURE FROM THIS ROUTE — and it is why every exit is still the
 * contract's error shape rather than a bare 502: **accept her item anyway**. A sense-check that
 * swallows what she typed because a service was down is worse than no sense-check at all. This
 * module cannot enforce that, but it can make the failure legible enough that the page can.
 */
export async function proxyAsdairCheckItem(req, res, origin, deps) {
  return proxyJson(req, res, origin, deps, {
    upstreamPath: CHECK_ITEM_UPSTREAM_PATH,
    notPost: 'A check is sent with POST.',
    unreachable: (why) => 'I could not reach AsdAIr to check that — ' + why + '.',
    unreadable: (why) => 'AsdAIr started to answer and then stopped — ' + why + '.',
    notJson: (status) => 'AsdAIr answered in a form I could not read (HTTP ' + status + ').',
  });
}

/**
 * POST /api/asdair/display-name  ->  POST <origin>/asdair/display-name      (WP-B15-51 AC4)
 *
 * Warwick renaming a product to what Mum should actually read. Identical mechanics to the two
 * proxies above; different words on failure because this one is HIS surface, not hers — it can say
 * "saved" and "not saved" plainly rather than in the careful sentences her page needs.
 */
export async function proxyAsdairDisplayName(req, res, origin, deps) {
  return proxyJson(req, res, origin, deps, {
    upstreamPath: DISPLAY_NAME_UPSTREAM_PATH,
    notPost: 'A display name is saved with POST.',
    unreachable: (why) => 'I could not reach AsdAIr to save that name — ' + why + '. Nothing was changed.',
    unreadable: (why) => 'AsdAIr started to answer and then stopped — ' + why + '.',
    notJson: (status) => 'AsdAIr answered in a form I could not read (HTTP ' + status + '). Nothing was changed.',
  });
}

/**
 * The shared body: read once, cap, forward, hand back JSON. All three routes above are this function
 * with a different upstream path and different sentences — extracted rather than copied so a fix to
 * the error handling cannot land on one route and miss the others.
 */
async function proxyJson(req, res, origin, deps, shape) {
  const d = deps || {};
  const doFetch = d.fetch || fetch;
  const timeoutMs = d.timeoutMs || 8000;

  if (String(req.method || '').toUpperCase() !== 'POST') {
    return refuse(res, 405, 'method_not_allowed', shape.notPost);
  }

  const read = await readJsonBody(req, { maxBytes: d.maxBytes || MAX_BODY_BYTES });
  if (!read.ok) {
    refuse(res, read.status, read.error, read.message);
    // Abandon an oversized request only AFTER it has been answered, so the answer is what the
    // browser sees rather than a reset connection.
    if (read.error === 'too_large') req.destroy();
    return;
  }

  let upstream;
  try {
    upstream = await doFetch(origin + shape.upstreamPath, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'content-type': JSON_TYPE, accept: 'application/json' },
      body: JSON.stringify(read.body),
    });
  } catch (e) {
    // NOT REACHED IS NOT THE SAME AS REFUSED, and the caller must be able to tell: nothing was
    // written, so this is always safe to retry.
    return refuse(res, 502, 'upstream_unreachable', shape.unreachable(whyDown(e)));
  }

  // The upstream body is ALREADY the contract shape, so it is forwarded VERBATIM - including
  // `created`, which decides what the UI is allowed to say. Re-deriving any of it here would be a
  // second opinion about a durable fact this process never saw.
  let text = '';
  try {
    text = await upstream.text();
  } catch (e) {
    return refuse(res, 502, 'upstream_unreadable', shape.unreadable(whyDown(e)));
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    // An HTML error page or a proxy's own text is exactly the "bare text 502" this route must never
    // hand to the UI. It is converted into the contract's shape, and the upstream STATUS is kept so
    // a 500 does not read as a 200.
    return refuse(res, upstream.status >= 400 ? upstream.status : 502, 'upstream_not_json',
      shape.notJson(upstream.status));
  }

  return send(res, upstream.status, payload);
}
