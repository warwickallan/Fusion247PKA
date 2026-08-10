// Fusion247 Cockpit — THE CHECKLIST PROXY. The last mile between a rendered checklist and the phone
// standing in the shop.
//
// WHY THIS EXISTS. `services/asdair/cockpit-api/readChecklist.js` renders the page Warwick actually
// shops from, and serves it at GET /asdair/checklist on the AsdAIr read service — which listens on
// 127.0.0.1:8710. The handover card then handed him that path. He can never open it: on his phone
// 127.0.0.1 is the PHONE's own loopback, not this machine's. The same sentence is already written
// above proxyAsdairMedia in server.mjs, and it is the entire reason that proxy exists. The checklist
// simply never got one, so a correct, tested, called renderer still reached nobody.
//
// The Cockpit is the ONE surface he can reach (tailnet-only, https://…ts.net:8443). So the route he
// is given must exist HERE, and this module is it. Nothing about exposure changes: this adds a
// read-only forward on a surface that is already tailnet-private.
//
// ── ITS OWN MODULE, unlike its four siblings, and deliberately ──────────────────────────────────
// apiAsdairWorkspace/rules/packet and proxyAsdairMedia live inside server.mjs and therefore CANNOT
// BE EXECUTED by any gate: importing server.mjs imports db.mjs, which opens live credentialed pools
// at load. static.mjs, capae.mjs, rotation-report.mjs, private-api.mjs and down-reason.mjs were each
// extracted for exactly that reason, and each says so in its own header. This one follows them so
// asdair-checklist-check.mjs can run the REAL handler over REAL HTTP instead of asserting a diff.
//
// ── MARKDOWN IS NOT JSON, AND A PHONE IS NOT A CLIENT LIBRARY ───────────────────────────────────
// Two shapes were available and neither was right off the shelf. apiAsdairPacket forwards JSON
// verbatim — wrong here, because the checklist is a document a person reads, and JSON would hand him
// a blob to unwrap. proxyAsdairMedia streams bytes and echoes the upstream content-type — right in
// shape, wrong in one detail: the upstream says `text/markdown`, and no mobile browser renders
// text/markdown inline. Chrome on Android treats it as a download. A file in the Downloads tray is
// not a checklist you can read one-handed beside a trolley.
//
// So: stream the bytes through unchanged (never re-render — `handoff/renderChecklist.js` is the ONE
// renderer and this module must never become a second one), and label them `text/plain; charset=utf-8`,
// which every phone browser displays inline. He sees the headings, the lines, the method and the
// prohibitions as text. `?format=json` is passed through for a caller that wants the state and the
// counts, and keeps its JSON content-type — the human path is the default, not the special case.
//
// Read-only, short timeout, fail-soft with a named reason, exactly like its siblings. No new
// dependency; `whyDown` is the cockpit's own.
import { Readable } from 'node:stream';
import { whyDown } from './down-reason.mjs';

// The path the handover card emits. Exported because `runPipeline.js` must emit THIS string and a
// gate must be able to check that the server dispatches it — a route constant that only exists as a
// literal in two files is a route constant that drifts.
export const ASDAIR_CHECKLIST_ROUTE = '/api/asdair/checklist';

// Same validation as apiAsdairPacket, and it was CHECKED rather than assumed: `SHOP-2026-08-09` is
// 15 characters of [A-Za-z0-9-] and passes. readChecklist accepts a shop_ref OR a numeric id, and
// the ref is the only identifier Warwick has ever seen, so narrowing this to digits — as
// proxyAsdairMedia does — would reject the exact input the card carries.
export const SHOP_PATTERN = /^[A-Za-z0-9-]{1,32}$/;

const TEXT = 'text/plain; charset=utf-8';

/**
 * PURE. What the browser is told the body is.
 *
 * The upstream's own content-type decides only whether this is the JSON view or the document view;
 * the document view is ALWAYS relabelled to text/plain, because the point is that a phone renders it.
 */
export function phoneContentType(upstreamContentType) {
  return String(upstreamContentType || '').toLowerCase().includes('json')
    ? 'application/json; charset=utf-8'
    : TEXT;
}

function fail(res, status, message) {
  res.writeHead(status, { 'content-type': TEXT });
  res.end(message + '\n');
}

/**
 * GET /api/asdair/checklist?shop=<ref>[&format=json]
 *
 * @param {object} req   node request (only `url` is read)
 * @param {object} res   node response
 * @param {string} origin  the AsdAIr read service origin — this server owns the host:port, as everywhere
 * @param {{fetch?:Function, timeoutMs?:number}} [deps]  injected only by the gate
 */
export async function proxyAsdairChecklist(req, res, origin, deps) {
  const d = deps || {};
  const doFetch = d.fetch || fetch;
  const timeoutMs = d.timeoutMs || 5000;

  const shop = new URL(req.url, 'http://x').searchParams.get('shop');
  if (!shop || !SHOP_PATTERN.test(shop)) {
    return fail(res, 400, 'A shop must be named to read its checklist.');
  }
  const wantsJson = String(new URL(req.url, 'http://x').searchParams.get('format') || '').toLowerCase() === 'json';

  const upstream = `${origin}/asdair/checklist?shop=${encodeURIComponent(shop)}`
    + (wantsJson ? '&format=json' : '');
  try {
    const r = await doFetch(upstream, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: wantsJson ? 'application/json' : 'text/markdown, text/plain' },
    });
    if (!r.body) {
      return fail(res, 502, 'AsdAIr’s read service answered HTTP ' + r.status + ' with no body.');
    }
    // THE UPSTREAM STATUS IS FORWARDED, not normalised to 200. "This shop has not been handed over
    // yet" is a 200 upstream ON PURPOSE — a true answer to a well-formed question about a real shop —
    // and turning any of that into a 404 would make a normal state look like the broken link this
    // whole route exists to remove.
    res.writeHead(r.status, { 'content-type': phoneContentType(r.headers.get('content-type')) });
    Readable.fromWeb(r.body).pipe(res);
  } catch (e) {
    fail(res, 502, 'AsdAIr’s checklist is not available right now — ' + whyDown(e) + '.');
  }
}
