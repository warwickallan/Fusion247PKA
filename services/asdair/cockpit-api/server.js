// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/server.js
//
// The binder. node:http in, httpApi.handleRequest out. It contains no rules of
// its own except the two it MUST own because they are transport concerns:
// the allowed origin, and streaming the retained photo.
//
// NOT STARTED BY IMPORTING IT. `node server.js` starts it; Larry deploys it.
// Nothing in this build ever starts it automatically.
//
// CONFIG (all from the environment, never from a file this repo reads):
//   ASDAIR_DB_URL                    the SELECT-only asdair_ro connection string
//   ASDAIR_COCKPIT_PORT              default 8710
//   ASDAIR_COCKPIT_BIND              default 127.0.0.1 (loopback; a tailnet
//                                    address must be set DELIBERATELY)
//   ASDAIR_COCKPIT_ALLOWED_ORIGIN    exact origin of the Directus cockpit.
//                                    Unset = no CORS header is sent at all, so
//                                    a browser page cannot read this service by
//                                    accident. There is no "*" default.
//   ASDAIR_MEDIA_ROOT                directory the retained list photos live
//                                    under. Unset = /asdair/media is disabled.
//
// This file never reads, prints or logs a credential. The connection string is
// consumed by pg inside readWorkspace.js and is scrubbed from any error text
// by httpApi.safeMessage().
//
// PURE ASCII.
// =====================================================================

'use strict';

const http = require('http');
const fs = require('fs');
const { URL } = require('url');

const { handleRequest, resolveMediaPath } = require('./httpApi');

const MEDIA_TYPES = Object.freeze({
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf'
});

function corsHeaders() {
  const origin = process.env.ASDAIR_COCKPIT_ALLOWED_ORIGIN;
  if (!origin || String(origin).trim() === '') return {};
  return {
    'access-control-allow-origin': String(origin).trim(),
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'vary': 'origin'
  };
}

function send(res, status, headers, payload) {
  res.writeHead(status, Object.assign({}, corsHeaders(), headers || {}));
  res.end(payload);
}

/**
 * PURE. Turn a router answer into wire bytes, ACCORDING TO ITS OWN DECLARED
 * CONTENT-TYPE.
 *
 * THE DEFECT THIS CLOSES. This binder used to write `JSON.stringify(out.body)`
 * for every routed answer without exception. httpApi.markdown() returns a
 * STRING body under `text/markdown`, so the checklist - the page a person reads
 * standing in a shop - went out as a JSON string literal: surrounding double
 * quotes, and every line break rendered as a literal backslash-n. The header
 * said markdown and the body was a quoted one-liner. Verified on the live
 * service before the fix: GET /asdair/checklist answered 200, text/markdown,
 * body `"# No checklist yet\n\n..."`.
 *
 * A JSON.stringify of a string is not a formatting nit here: it makes the ONE
 * artefact this route exists to deliver unreadable, and the reader has no way
 * to tell it is a serialisation bug rather than the checklist itself.
 *
 * THE RULE, and it is deliberately narrow: a body that is ALREADY A STRING is
 * written as-is; anything else is JSON. Every JSON route in httpApi.js returns
 * an OBJECT via json(), so no JSON route's shape changes - a JSON body is still
 * JSON.stringify'd, exactly as before. Only markdown(), whose bodies are the
 * only strings the router produces, is affected.
 */
function serialiseBody(body) {
  return typeof body === 'string' ? body : JSON.stringify(body);
}

function collectBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on('data', function (c) {
      size += c.length;
      // A command body is small. Anything larger is refused rather than buffered.
      if (size > 256 * 1024) { reject(new Error('request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

// The photo of the list. The path is read from the DATABASE, never from the
// request - the caller may only name a shop id.
async function serveMedia(url, res) {
  const root = process.env.ASDAIR_MEDIA_ROOT || null;
  const { readWorkspace } = require('./readWorkspace');
  let payload;
  try {
    payload = await readWorkspace({ shop: url.searchParams.get('shop') });
  } catch (err) {
    send(res, 500, { 'content-type': 'application/json' }, JSON.stringify({ ok: false, error: 'read_failed' }));
    return;
  }
  const stored = payload && payload.evidence ? payload.evidence.raw_media_path_display : null;
  const resolved = resolveMediaPath(stored === 'unknown' ? null : stored, root);
  if (!resolved.ok) {
    send(res, 404, { 'content-type': 'application/json' }, JSON.stringify({ ok: false, error: resolved.reason }));
    return;
  }
  const ext = resolved.path.slice(resolved.path.lastIndexOf('.')).toLowerCase();
  const type = MEDIA_TYPES[ext];
  if (!type) {
    send(res, 415, { 'content-type': 'application/json' }, JSON.stringify({ ok: false, error: 'unsupported_media_type' }));
    return;
  }
  fs.stat(resolved.path, function (err, stat) {
    if (err || !stat.isFile()) {
      send(res, 404, { 'content-type': 'application/json' }, JSON.stringify({ ok: false, error: 'media_missing' }));
      return;
    }
    res.writeHead(200, Object.assign({}, corsHeaders(), {
      'content-type': type,
      'content-length': String(stat.size),
      'cache-control': 'private, no-store'
    }));
    fs.createReadStream(resolved.path).pipe(res);
  });
}

function createServer() {
  return http.createServer(async function (req, res) {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') { send(res, 204, {}, ''); return; }

    if (req.method === 'GET' && url.pathname === '/asdair/media') {
      await serveMedia(url, res);
      return;
    }

    let body = null;
    if (req.method === 'POST') {
      try { body = await collectBody(req); }
      catch (err) {
        send(res, 413, { 'content-type': 'application/json' }, JSON.stringify({ ok: false, error: 'body_too_large' }));
        return;
      }
    }

    const query = {};
    url.searchParams.forEach(function (v, k) { query[k] = v; });

    const out = await handleRequest({ method: req.method, path: url.pathname, query: query, body: body });
    send(res, out.status, out.headers, serialiseBody(out.body));
  });
}

function start() {
  const port = Number(process.env.ASDAIR_COCKPIT_PORT || 8710);
  const bind = process.env.ASDAIR_COCKPIT_BIND || '127.0.0.1';
  const server = createServer();
  server.listen(port, bind, function () {
    // Config only. No connection string, no secret, ever.
    console.log('asdair cockpit-api listening on ' + bind + ':' + String(port) +
      ' (read-only; media ' + (process.env.ASDAIR_MEDIA_ROOT ? 'enabled' : 'disabled') + ')');
  });
  return server;
}

module.exports = {
  createServer: createServer,
  start: start,
  // Exported so the string-vs-JSON rule is EXECUTED by a test rather than
  // asserted in a comment. It was wrong for the checklist's whole lifetime and
  // nothing could have caught it: it lived inline in a closure.
  _internal: { serialiseBody: serialiseBody },
};

if (require.main === module) start();
