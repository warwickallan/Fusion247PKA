// Fusion247 Cockpit — GATE: Mum's list must actually leave the surface she can reach, and every
// failure must arrive as JSON so the UI can tell "did not send" from "sent".
//
// WHY A GATE AND NOT A UNIT TEST. The defect this closes was never in a function. Every piece was
// individually correct — the command surface, the store, the unique indexes — and the Cockpit
// proxied GET only, so nothing she tapped could reach a row. Reachability is a property of the JOIN
// between two files, and only an execution can see it.
//
// WHAT THIS EXECUTES:
//   1. The REAL proxy handler, over a REAL socket, against a REAL fake upstream: the success
//      passthrough (including `created`, which decides what the UI may say), the body cap, bad JSON,
//      an unreachable upstream, and an upstream that answers HTML instead of JSON.
//   2. THE JOIN: server.mjs DISPATCHES the exported route constant — not merely imports it.
//   3. The live leg, ONLY when an origin is named explicitly. See the comment on LIVE_ORIGIN: this
//      route WRITES, so it must never default to the live service.
//
// It cannot import server.mjs — that file imports db.mjs, which opens live credentialed pools at
// load. That is precisely why the handler lives in its own module.
//
// Exits non-zero on failure AND on a vacuous run.
//
// `--self-test` proves the SOURCE assertion can actually fail: it feeds mutated source text in
// memory (never touching the tree) and requires the assertion to reject it. An assertion that
// cannot go red is decoration, and a source scan is the easiest place to build one by accident.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASDAIR_LIST_ROUTE, MAX_BODY_BYTES, UPSTREAM_PATH, proxyAsdairList,
  ASDAIR_CHECK_ITEM_ROUTE, CHECK_ITEM_UPSTREAM_PATH, proxyAsdairCheckItem,
  ASDAIR_DISPLAY_NAME_ROUTE, DISPLAY_NAME_UPSTREAM_PATH, proxyAsdairDisplayName,
  ASDAIR_COMMAND_ROUTE, COMMAND_UPSTREAM_PATH, proxyAsdairCommand,
} from './asdair-list.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(DIR, 'server.mjs');

// ⚠️ NO DEFAULT, AND THAT IS THE SAFETY DECISION. asdair-checklist-check.mjs defaults to
// http://127.0.0.1:8710 because it only ever GETs. This route WRITES: a default here would make a
// routine gate run POST a synthetic shopping list into whatever service happens to be listening —
// in practice the LIVE one, creating a real shop for a real household. So the live leg runs only
// when an origin is named on purpose, and is reported NOT PROVEN otherwise rather than skipped
// quietly.
const LIVE_ORIGIN = process.env.ASDAIR_LIST_CHECK_ORIGIN || '';

let ran = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  ran++;
  if (cond) console.log('  PASS  ' + name + (detail ? ' — ' + detail : ''));
  else { failed++; console.error('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};
const note = (name, detail) => console.log('  NOT PROVEN  ' + name + (detail ? ' — ' + detail : ''));

// ── THE SOURCE ASSERTION, as a function, so --self-test can feed it a mutant ────────────────────
// CRLF: the split is /\r?\n/. A source scan that splits on '\n' alone has silently passed on this
// estate before, on a file whose lines all ended \r.
// AN IMPORT IS NOT A DISPATCH. The checklist gate learned this the hard way: its first rule was
// "one line mentions both names", and server.mjs's IMPORT line mentions both names, so deleting the
// dispatch line left the assertion green. The line must CALL the handler, and import lines are
// excluded explicitly.
export function serverDispatchesList(source) {
  return source.split(/\r?\n/).some((l) => {
    const t = l.trim();
    if (t.startsWith('import ')) return false;
    return t.includes('ASDAIR_LIST_ROUTE') && /proxyAsdairList\s*\(/.test(t);
  });
}

// WP-B15-50. The same rule, for the sense-check route. An import line mentioning both names is not
// a dispatch — that lesson is already paid for above and is not re-learned here.
export function serverDispatchesCheckItem(source) {
  return source.split(/\r?\n/).some((l) => {
    const t = l.trim();
    if (t.startsWith('import ')) return false;
    return t.includes('ASDAIR_CHECK_ITEM_ROUTE') && /proxyAsdairCheckItem\s*\(/.test(t);
  });
}

// WP-B15-51. The same rule again, for Warwick's display-name route.
export function serverDispatchesDisplayName(source) {
  return source.split(/\r?\n/).some((l) => {
    const t = l.trim();
    if (t.startsWith('import ')) return false;
    return t.includes('ASDAIR_DISPLAY_NAME_ROUTE') && /proxyAsdairDisplayName\s*\(/.test(t);
  });
}

/** Start a one-request server around the real handler, pointed at `origin`. */
function withHandler(origin, deps) {
  const server = http.createServer((req, res) => proxyAsdairList(req, res, origin, deps));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** The same, around the REAL sense-check handler. */
function withCheckHandler(origin, deps) {
  const server = http.createServer((req, res) => proxyAsdairCheckItem(req, res, origin, deps));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** The same, around the REAL display-name handler. */
function withDisplayNameHandler(origin, deps) {
  const server = http.createServer((req, res) => proxyAsdairDisplayName(req, res, origin, deps));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// The command route. Same rule as the three above.
export function serverDispatchesCommand(source) {
  return source.split(/\r?\n/).some((l) => {
    const t = l.trim();
    if (t.startsWith('import ')) return false;
    return t.includes('ASDAIR_COMMAND_ROUTE') && /proxyAsdairCommand\s*\(/.test(t);
  });
}

/** The same, around the REAL command handler. */
function withCommandHandler(origin, deps) {
  const server = http.createServer((req, res) => proxyAsdairCommand(req, res, origin, deps));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** Start a fake AsdAIr upstream that records what it was sent. */
function fakeUpstream(handler) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, body: raw });
      handler(req, res, raw);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, seen, origin: 'http://127.0.0.1:' + server.address().port }));
  });
}

function post(port, body, headers = {}, route = ASDAIR_LIST_ROUTE) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, path: route, method: 'POST', headers: { 'content-type': 'application/json', ...headers } },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', raw }));
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

function parsed(res) {
  try { return JSON.parse(res.raw); } catch { return null; }
}

const LIST = { household: 1, items: [{ id: '13', name: 'Arla semi-skimmed 4pt', qty: 2 }] };

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  console.log('ASDAIR LIST PROXY CHECK');

  // ── 1. THE SUCCESS PASSTHROUGH ────────────────────────────────────────────────────────────────
  {
    const created = { ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: true, matched_by: 'insert' };
    const up = await fakeUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(created));
    });
    const h = await withHandler(up.origin);
    const res = await post(h.port, LIST);

    ok('a submitted list reaches the upstream over a real socket', up.seen.length === 1,
      up.seen.length + ' request(s)');
    ok('it is POSTed to ' + UPSTREAM_PATH, up.seen[0] && up.seen[0].method === 'POST' && up.seen[0].url === UPSTREAM_PATH,
      up.seen[0] ? up.seen[0].method + ' ' + up.seen[0].url : 'nothing');
    ok('the body arrives unchanged', JSON.stringify(JSON.parse(up.seen[0].body)) === JSON.stringify(LIST));
    ok('the response is the upstream body VERBATIM', JSON.stringify(parsed(res)) === JSON.stringify(created));
    ok('`created` survives the proxy - it decides what the UI may say', parsed(res).created === true);
    ok('the response is JSON', /application\/json/.test(res.type), res.type);
    h.server.close(); up.server.close();
  }

  // ── 2. created:false IS FORWARDED, NOT NORMALISED ─────────────────────────────────────────────
  // The whole point of contract v2: a resumed submission is `ok:true, created:false`, and the proxy
  // must not tidy that into something that reads like a successful send.
  {
    const resumed = { ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 41, created: false, matched_by: 'shop_ref', duplicate: true };
    const up = await fakeUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(resumed));
    });
    const h = await withHandler(up.origin);
    const body = parsed(await post(h.port, LIST));
    ok('a RESUMED submission arrives at the UI as ok:true + created:false',
      body.ok === true && body.created === false && body.matched_by === 'shop_ref');
    h.server.close(); up.server.close();
  }

  // ── 3. THE UPSTREAM'S OWN ERROR SHAPE AND STATUS SURVIVE ──────────────────────────────────────
  {
    const up = await fakeUpstream((req, res) => {
      res.writeHead(409, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'shop_already_finished', message: "This week's shop has already been finished or cancelled, so I can't add to it." }));
    });
    const h = await withHandler(up.origin);
    const res = await post(h.port, LIST);
    ok('an upstream refusal keeps its status', res.status === 409, String(res.status));
    ok('an upstream refusal keeps its machine code', parsed(res).error === 'shop_already_finished');
    h.server.close(); up.server.close();
  }

  // ── 4. THE BODY CAP - ANSWERED, NOT JUST DROPPED ──────────────────────────────────────────────
  {
    const up = await fakeUpstream((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
    const h = await withHandler(up.origin, { maxBytes: 512 });
    const huge = { household: 1, items: [{ name: 'x'.repeat(4000), qty: 1 }] };
    let res = null;
    try { res = await post(h.port, huge); } catch (e) { res = { status: 0, type: '', raw: String(e.message) }; }
    ok('an oversized body is REFUSED with 413, not silently destroyed', res.status === 413, String(res.status));
    ok('and the refusal is JSON the UI can read', parsed(res) && parsed(res).error === 'too_large');
    ok('nothing was forwarded upstream', up.seen.length === 0, up.seen.length + ' request(s)');
    h.server.close(); up.server.close();
  }

  // ── 5. BAD JSON ───────────────────────────────────────────────────────────────────────────────
  {
    const up = await fakeUpstream((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
    const h = await withHandler(up.origin);
    const res = await post(h.port, '{not json');
    ok('a malformed body is a JSON 400, never a bare text error', res.status === 400 && parsed(res).error === 'bad_json');
    ok('and nothing was forwarded upstream', up.seen.length === 0);
    h.server.close(); up.server.close();
  }

  // ── 6. THE UPSTREAM IS DOWN - THE CASE THE UI MUST BE ABLE TO READ ────────────────────────────
  {
    const dead = await fakeUpstream(() => {});
    const origin = dead.origin;
    await new Promise((r) => dead.server.close(r));          // nothing is listening now
    const h = await withHandler(origin, { timeoutMs: 1500 });
    const res = await post(h.port, LIST);
    ok('an unreachable upstream is 502 in the JSON error shape', res.status === 502 && parsed(res) !== null,
      String(res.status));
    ok('with a named machine code', parsed(res).error === 'upstream_unreachable', String(parsed(res) && parsed(res).error));
    ok('and it says plainly that nothing was sent', /nothing was sent/i.test(parsed(res).message));
    ok('the content-type is JSON, never text/plain', /application\/json/.test(res.type), res.type);
    h.server.close();
  }

  // ── 7. AN UPSTREAM THAT ANSWERS HTML - THE "bare text 502" THIS ROUTE MUST NEVER RELAY ────────
  {
    const up = await fakeUpstream((req, res) => {
      res.writeHead(502, { 'content-type': 'text/html' });
      res.end('<html><body>Bad Gateway</body></html>');
    });
    const h = await withHandler(up.origin);
    const res = await post(h.port, LIST);
    ok('an HTML error page becomes the JSON error shape', parsed(res) !== null && parsed(res).error === 'upstream_not_json');
    ok('and the upstream status is preserved rather than flattened to 200', res.status === 502, String(res.status));
    h.server.close(); up.server.close();
  }

  // ── 8. METHOD ─────────────────────────────────────────────────────────────────────────────────
  {
    const up = await fakeUpstream((req, res) => { res.writeHead(200); res.end('{}'); });
    const h = await withHandler(up.origin);
    const res = await new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port: h.port, path: ASDAIR_LIST_ROUTE, method: 'GET' }, (x) => {
        let raw = ''; x.on('data', (c) => { raw += c; }); x.on('end', () => resolve({ status: x.statusCode, raw }));
      });
      r.on('error', reject); r.end();
    });
    ok('a GET is 405 in the JSON error shape', res.status === 405 && JSON.parse(res.raw).error === 'method_not_allowed');
    h.server.close(); up.server.close();
  }

  // ── 9. THE JOIN ───────────────────────────────────────────────────────────────────────────────
  {
    const src = fs.readFileSync(SERVER, 'utf8');
    ok('server.mjs DISPATCHES the route constant (not merely imports it)', serverDispatchesList(src));
    ok('the route constant is the one the UI posts to', ASDAIR_LIST_ROUTE === '/api/asdair/list', ASDAIR_LIST_ROUTE);
    ok('the cap matches the existing POST route in server.mjs', MAX_BODY_BYTES === 1e5, String(MAX_BODY_BYTES));
    // WP-B15-50: the sense-check has to be joined up too, or the page calls a route that 404s.
    ok('server.mjs DISPATCHES the sense-check route (not merely imports it)', serverDispatchesCheckItem(src));
    ok('the sense-check route constant is the one the UI posts to',
      ASDAIR_CHECK_ITEM_ROUTE === '/api/asdair/check-item', ASDAIR_CHECK_ITEM_ROUTE);
    // WP-B15-51: and Warwick's display-name write, for the same reason — an editor page that posts
    // to a route nobody dispatches just 404s.
    ok('server.mjs DISPATCHES the display-name route (not merely imports it)', serverDispatchesDisplayName(src));
    ok('the display-name route constant is the one the editor posts to',
      ASDAIR_DISPLAY_NAME_ROUTE === '/api/asdair/display-name', ASDAIR_DISPLAY_NAME_ROUTE);
    // The shared command surface. Same reason again — and this one matters more than the others,
    // because the workspace routes EVERY write through it. Undispatched, every control on the
    // AsdAIr board 404s at once.
    ok('server.mjs DISPATCHES the command route (not merely imports it)', serverDispatchesCommand(src));
    ok('the command route constant is the one the workspace posts to',
      ASDAIR_COMMAND_ROUTE === '/api/asdair/command', ASDAIR_COMMAND_ROUTE);
  }

  // ── 13. THE SHARED COMMAND SURFACE, OVER A REAL SOCKET ────────────────────────────────────────
  {
    // A correctAnswer receipt as the pipeline really shapes it. `duplicate` is the field that
    // decides whether the UI says "Changed" or "you already made this change", so the assertion
    // below is about it surviving the proxy byte for byte.
    const receipt = {
      ok: true,
      command: 'correctAnswer',
      result: {
        ok: true, command: 'correctAnswer', question_key: 'milk#1',
        successor_question_key: 'milk#2', question_round: 2,
        superseded_answer_text: 'semi-skimmed', superseded_answered_at: '2026-08-17T10:00:00Z',
        corrected: true, opened: true, duplicate: false,
      },
    };
    const up = await fakeUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(receipt));
    });
    const h = await withCommandHandler(up.origin);
    const sent = { command: 'correctAnswer', actor: 'warwick', args: { questionKey: 'milk#1', answerText: 'whole milk' } };
    const res = await post(h.port, sent, {}, ASDAIR_COMMAND_ROUTE);

    ok('a command reaches the upstream over a real socket', up.seen.length === 1, up.seen.length + ' request(s)');
    ok('it is POSTed to ' + COMMAND_UPSTREAM_PATH,
      up.seen[0] && up.seen[0].method === 'POST' && up.seen[0].url === COMMAND_UPSTREAM_PATH,
      up.seen[0] ? up.seen[0].method + ' ' + up.seen[0].url : 'nothing');
    ok('the command name and args arrive unchanged — the proxy names no command of its own',
      JSON.stringify(JSON.parse(up.seen[0].body)) === JSON.stringify(sent));
    ok('the receipt is forwarded VERBATIM, `duplicate` included',
      JSON.stringify(parsed(res)) === JSON.stringify(receipt));
  }
  {
    // ⛔ THE PROPERTY THIS ROUTE EXISTS TO PROTECT, AND IT IS A DISTINCTION BETWEEN TWO FAILURES.
    // Unreachable = never asked = nothing happened, so saying so is TRUE and a retry is safe.
    const dead = await fakeUpstream(() => {});
    const origin = dead.origin;
    await new Promise((r) => dead.server.close(r));
    const h = await withCommandHandler(origin, { timeoutMs: 1500 });
    const res = await post(h.port, { command: 'correctAnswer' }, {}, ASDAIR_COMMAND_ROUTE);
    const body = parsed(res);
    ok('an unreachable command is 502 in the JSON error shape', res.status === 502 && body !== null, String(res.status));
    ok('and an UNREACHABLE upstream may say nothing was changed — it was never asked',
      body && /nothing was changed/i.test(body.message || ''), body ? body.message : '');
    h.server.close();
  }
  {
    // ...but an upstream that answered UNREADABLY may already have written. Claiming "nothing was
    // changed" there would be a confident false statement about a durable row — the same class of
    // lie as a success message over a write that never happened, relocated into the proxy.
    const up = await fakeUpstream((req, res) => {
      res.writeHead(500, { 'content-type': 'text/html' });
      res.end('<html><body>gateway exploded</body></html>');
    });
    const h = await withCommandHandler(up.origin);
    const res = await post(h.port, { command: 'correctAnswer' }, {}, ASDAIR_COMMAND_ROUTE);
    const body = parsed(res);
    ok('a non-JSON upstream answer is still the JSON error shape', body !== null && body.ok === false);
    ok('and it does NOT claim nothing was changed — that is not knowable here',
      body && !/nothing was changed/i.test(body.message || ''), body ? body.message : '');
    ok('it tells the reader where to look instead',
      body && /check the board/i.test(body.message || ''), body ? body.message : '');
    h.server.close(); up.server.close();
  }

  // ── 12. WP-B15-51: WARWICK'S DISPLAY-NAME WRITE, OVER A REAL SOCKET ───────────────────────────
  {
    const saved = { ok: true, id: 4, display_name: 'Milk' };
    const up = await fakeUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(saved));
    });
    const h = await withDisplayNameHandler(up.origin);
    const res = await post(h.port, { id: 4, display_name: 'Milk' }, {}, ASDAIR_DISPLAY_NAME_ROUTE);

    ok('a display name reaches the upstream over a real socket', up.seen.length === 1,
      up.seen.length + ' request(s)');
    ok('it is POSTed to ' + DISPLAY_NAME_UPSTREAM_PATH,
      up.seen[0] && up.seen[0].method === 'POST' && up.seen[0].url === DISPLAY_NAME_UPSTREAM_PATH,
      up.seen[0] ? up.seen[0].method + ' ' + up.seen[0].url : 'nothing');
    ok('his words arrive unchanged', JSON.parse(up.seen[0].body).display_name === 'Milk');
    ok('the saved row is forwarded VERBATIM', JSON.stringify(parsed(res)) === JSON.stringify(saved));
    h.server.close(); up.server.close();
  }
  {
    const dead = await fakeUpstream(() => {});
    const origin = dead.origin;
    await new Promise((r) => dead.server.close(r));
    const h = await withDisplayNameHandler(origin, { timeoutMs: 1500 });
    const res = await post(h.port, { id: 4, display_name: 'Milk' }, {}, ASDAIR_DISPLAY_NAME_ROUTE);
    const body = parsed(res);
    ok('an unreachable display-name write is 502 in the JSON error shape', res.status === 502 && body !== null,
      String(res.status));
    ok('and it says plainly that nothing was changed',
      body && /nothing was changed/i.test(body.message || ''), body ? body.message : '');
    h.server.close();
  }

  // ── 11. WP-B15-50: THE SENSE-CHECK PROXY, OVER A REAL SOCKET ──────────────────────────────────
  {
    const verdict = { ok: true, status: 'matched', matched_name: 'Semi skimmed milk 4 pints', matched_regular_id: 11, already_on_list: false };
    const up = await fakeUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(verdict));
    });
    const h = await withCheckHandler(up.origin);
    const res = await post(h.port, { household: 1, text: 'milk', chosen: [] }, {}, ASDAIR_CHECK_ITEM_ROUTE);

    ok('a typed term reaches the sense-check upstream over a real socket', up.seen.length === 1,
      up.seen.length + ' request(s)');
    ok('it is POSTed to ' + CHECK_ITEM_UPSTREAM_PATH,
      up.seen[0] && up.seen[0].method === 'POST' && up.seen[0].url === CHECK_ITEM_UPSTREAM_PATH,
      up.seen[0] ? up.seen[0].method + ' ' + up.seen[0].url : 'nothing');
    ok('her words arrive unchanged', JSON.parse(up.seen[0].body).text === 'milk');
    ok('the verdict is forwarded VERBATIM', JSON.stringify(parsed(res)) === JSON.stringify(verdict));
  }
  {
    // ⛔ THE CASE THAT MATTERS MOST ON THIS ROUTE. When the sense-check cannot answer, the page must
    // still accept what she typed — so the failure has to be legible JSON, not a bare 502 the browser
    // cannot parse. This proves the shape; the page's own behaviour is Felix's lane.
    const dead = await fakeUpstream(() => {});
    const origin = dead.origin;
    await new Promise((r) => dead.server.close(r));
    const h = await withCheckHandler(origin, { timeoutMs: 1500 });
    const res = await post(h.port, { household: 1, text: 'milk' }, {}, ASDAIR_CHECK_ITEM_ROUTE);
    const body = parsed(res);
    ok('an unreachable sense-check is 502 in the JSON error shape', res.status === 502 && body !== null,
      String(res.status));
    ok('with a named machine code the page can branch on', body && body.error === 'upstream_unreachable');
    ok('and it does NOT claim nothing was sent - nothing was being sent',
      body && !/nothing was sent/i.test(body.message || ''), body ? body.message : '');
    h.server.close();
  }
  {
    const up = await fakeUpstream((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
    const h = await withCheckHandler(up.origin);
    const res = await post(h.port, '{not json', {}, ASDAIR_CHECK_ITEM_ROUTE);
    ok('a malformed sense-check body is a JSON 400', res.status === 400 && parsed(res).error === 'bad_json');
    ok('and nothing was forwarded upstream', up.seen.length === 0);
    h.server.close(); up.server.close();
  }

  // ── 10. THE LIVE LEG - ONLY WHEN NAMED ────────────────────────────────────────────────────────
  if (!LIVE_ORIGIN) {
    note('the proxy against a REAL AsdAIr service',
      'no ASDAIR_LIST_CHECK_ORIGIN set. This route WRITES, so it has no default origin on purpose. '
      + 'The end-to-end proof is the WP-B15-48 AC5 transcript.');
  } else {
    const h = await withHandler(LIVE_ORIGIN, { timeoutMs: 5000 });
    const res = await post(h.port, LIST);
    const body = parsed(res);
    ok('the REAL AsdAIr service answered the proxied POST', body !== null && typeof body.ok === 'boolean',
      'HTTP ' + res.status + ' ' + res.raw.slice(0, 160));
    ok('and it answered in the contract shape', body !== null && (body.ok === false || typeof body.created === 'boolean'));
    h.server.close();
  }

  if (ran === 0) {
    console.error('ASDAIR-LIST-CHECK FAIL — vacuous run: no assertion executed.');
    process.exit(1);
  }
  console.log(failed
    ? 'ASDAIR-LIST-CHECK FAIL — ' + failed + ' of ' + ran + ' assertions failed.'
    : 'ASDAIR-LIST-CHECK PASS — ' + ran + ' assertions executed, 0 failed.');
  process.exit(failed ? 1 : 0);
}

// ── --self-test: the source assertion must be ABLE to fail ──────────────────────────────────────
function selfTest() {
  const real = fs.readFileSync(SERVER, 'utf8');
  const mutants = {
    'the dispatch line deleted': real.split(/\r?\n/)
      .filter((l) => !(l.includes('ASDAIR_LIST_ROUTE') && /proxyAsdairList\s*\(/.test(l)))
      .join('\n'),
    'only the import left': "import { ASDAIR_LIST_ROUTE, proxyAsdairList } from './asdair-list.mjs';\n",
    'the handler call removed but the constant kept': real.replace(/proxyAsdairList\s*\(/g, 'somethingElse('),
  };
  ok('the assertion accepts the REAL server.mjs', serverDispatchesList(real));
  Object.keys(mutants).forEach((why) => {
    ok('the assertion REJECTS a mutant: ' + why, serverDispatchesList(mutants[why]) === false);
  });

  // WP-B15-50: the same mutation proof for the sense-check assertion. A source scan that cannot go
  // red is decoration, and adding a second one without proving it would be adding decoration.
  const checkMutants = {
    'the sense-check dispatch line deleted': real.split(/\r?\n/)
      .filter((l) => !(l.includes('ASDAIR_CHECK_ITEM_ROUTE') && /proxyAsdairCheckItem\s*\(/.test(l)))
      .join('\n'),
    'only the sense-check import left': "import { ASDAIR_CHECK_ITEM_ROUTE, proxyAsdairCheckItem } from './asdair-list.mjs';\n",
    'the sense-check handler call removed but the constant kept': real.replace(/proxyAsdairCheckItem\s*\(/g, 'somethingElse('),
  };
  ok('the sense-check assertion accepts the REAL server.mjs', serverDispatchesCheckItem(real));
  Object.keys(checkMutants).forEach((why) => {
    ok('the sense-check assertion REJECTS a mutant: ' + why, serverDispatchesCheckItem(checkMutants[why]) === false);
  });

  // WP-B15-51: and again for the display-name assertion. A third source scan added without proving
  // it can go red would be a third piece of decoration.
  const displayMutants = {
    'the display-name dispatch line deleted': real.split(/\r?\n/)
      .filter((l) => !(l.includes('ASDAIR_DISPLAY_NAME_ROUTE') && /proxyAsdairDisplayName\s*\(/.test(l)))
      .join('\n'),
    'only the display-name import left': "import { ASDAIR_DISPLAY_NAME_ROUTE, proxyAsdairDisplayName } from './asdair-list.mjs';\n",
    'the display-name handler call removed but the constant kept': real.replace(/proxyAsdairDisplayName\s*\(/g, 'somethingElse('),
  };
  ok('the display-name assertion accepts the REAL server.mjs', serverDispatchesDisplayName(real));
  Object.keys(displayMutants).forEach((why) => {
    ok('the display-name assertion REJECTS a mutant: ' + why, serverDispatchesDisplayName(displayMutants[why]) === false);
  });

  // And again for the command dispatch. A fourth source scan added without proving it can go red
  // would be a fourth piece of decoration — and this is the scan whose silent failure would take
  // every write control on the AsdAIr board down at once.
  const commandMutants = {
    'the command dispatch line deleted': real.split(/\r?\n/)
      .filter((l) => !(l.includes('ASDAIR_COMMAND_ROUTE') && /proxyAsdairCommand\s*\(/.test(l)))
      .join('\n'),
    'only the command import left': "import { ASDAIR_COMMAND_ROUTE, proxyAsdairCommand } from './asdair-list.mjs';\n",
    'the command handler call removed but the constant kept': real.replace(/proxyAsdairCommand\s*\(/g, 'somethingElse('),
  };
  ok('the command assertion accepts the REAL server.mjs', serverDispatchesCommand(real));
  Object.keys(commandMutants).forEach((why) => {
    ok('the command assertion REJECTS a mutant: ' + why, serverDispatchesCommand(commandMutants[why]) === false);
  });
  console.log(failed
    ? 'SELF-TEST FAIL — ' + failed + ' of ' + ran + ' assertions failed.'
    : 'SELF-TEST PASS — ' + ran + ' assertions executed, 0 failed.');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ASDAIR-LIST-CHECK FAIL — ' + (e && e.stack ? e.stack : e)); process.exit(1); });
