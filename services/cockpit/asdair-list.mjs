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
  const d = deps || {};
  const doFetch = d.fetch || fetch;
  const timeoutMs = d.timeoutMs || 8000;

  if (String(req.method || '').toUpperCase() !== 'POST') {
    return refuse(res, 405, 'method_not_allowed', 'A list is sent with POST.');
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
    upstream = await doFetch(origin + UPSTREAM_PATH, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'content-type': JSON_TYPE, accept: 'application/json' },
      body: JSON.stringify(read.body),
    });
  } catch (e) {
    // NOT REACHED IS NOT THE SAME AS REFUSED, and the caller must be able to tell: nothing was
    // written, so this is always safe to retry.
    return refuse(res, 502, 'upstream_unreachable',
      'I could not reach AsdAIr to send that list — ' + whyDown(e) + '. Nothing was sent.');
  }

  // The upstream body is ALREADY the contract shape, so it is forwarded VERBATIM - including
  // `created`, which decides what the UI is allowed to say. Re-deriving any of it here would be a
  // second opinion about a durable fact this process never saw.
  let text = '';
  try {
    text = await upstream.text();
  } catch (e) {
    return refuse(res, 502, 'upstream_unreadable',
      'AsdAIr started to answer and then stopped — ' + whyDown(e) + '.');
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    // An HTML error page or a proxy's own text is exactly the "bare text 502" this route must never
    // hand to the UI. It is converted into the contract's shape, and the upstream STATUS is kept so
    // a 500 does not read as a 200.
    return refuse(res, upstream.status >= 400 ? upstream.status : 502, 'upstream_not_json',
      'AsdAIr answered in a form I could not read (HTTP ' + upstream.status + '). Nothing was sent.');
  }

  return send(res, upstream.status, payload);
}
