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
// CONFIG (all from the environment, never from a file this repo reads).
// ⚠️ CONFIG_SPEC near the bottom of this file is the MACHINE-READABLE version
// of this list and is what validateConfig() enforces at startup (WP-B15-41
// AC8). This comment is the prose copy; if the two ever disagree, CONFIG_SPEC
// is the one that runs.
//   ASDAIR_DB_URL                    the SELECT-only asdair_ro connection string.
//                                    REQUIRED - the service refuses to start
//                                    without it rather than opening a port that
//                                    500s every read.
//   ASDAIR_WRITE_DB_URL              the asdair_rw connection string. Needed
//                                    only to APPLY an answer (POST
//                                    /asdair/answer*). Absent = those routes
//                                    answer 503 not_configured, in words, and
//                                    the read surface is unaffected.
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

// =====================================================================
// AC8 - STARTUP VALIDATES ITS CONFIG AND FAILS LOUDLY.
//
// This service had NO configuration validation. It read every variable at the
// moment of use, deep inside a request, so a missing ASDAIR_DB_URL produced a
// listening port that answered every read with a 500 - a process that looks
// alive and cannot do its job. `node server.js` exited 0 and stayed up.
//
// THE RULE: a service that cannot do its job must refuse to start, and it must
// say which variable and what shape it wanted. It must NOT print the value.
//
// ── WHOSE JOB THIS IS, AND WHOSE IT IS NOT ────────────────────────────────
// The SCHEMA and the validation are the implementer's: which variables exist,
// what shape each must have, and the service failing fast when one is missing
// or malformed. The VALUES and their placement are the operator's. That split
// is why nothing here reads, logs, echoes or interpolates a value - the checks
// below look at shape and never at content.
//
// PORT and BIND are validated because a bad value silently changes the security
// posture: `ASDAIR_COCKPIT_BIND=0.0.0.0` on a typo would expose a loopback
// service to the network, so a bind address is a deliberate value or the
// default, never a fallback from something unparseable.
// =====================================================================

const CONFIG_SPEC = Object.freeze([
  {
    name: 'ASDAIR_DB_URL',
    required: true,
    describe: 'the SELECT-only asdair_ro connection string. Every read depends on it.',
    check: function (v) {
      return /^postgres(ql)?:\/\/./.test(v) ? null : 'must be a postgres:// or postgresql:// connection string';
    }
  },
  {
    name: 'ASDAIR_WRITE_DB_URL',
    // NOT required to start. The read surface is the service's primary job and
    // is fully useful without it; only the three resolution routes need a
    // writer, and they answer 503 "not_configured" in words when it is absent.
    // Refusing to boot a working reader because an optional capability is
    // unconfigured would be a worse failure than the one this guards against.
    required: false,
    describe: 'the asdair_rw connection string. Required only to APPLY an answer '
      + '(POST /asdair/answer*); the read surface does not need it.',
    check: function (v) {
      return /^postgres(ql)?:\/\/./.test(v) ? null : 'must be a postgres:// or postgresql:// connection string';
    }
  },
  {
    name: 'ASDAIR_COCKPIT_PORT',
    required: false,
    describe: 'TCP port. Defaults to 8710.',
    check: function (v) {
      const n = Number(v);
      return Number.isInteger(n) && n > 0 && n < 65536 ? null : 'must be an integer port between 1 and 65535';
    }
  },
  {
    name: 'ASDAIR_COCKPIT_BIND',
    required: false,
    describe: 'bind address. Defaults to 127.0.0.1 (loopback). A tailnet or public address must be set DELIBERATELY.',
    check: function (v) {
      return /^[A-Za-z0-9.:_-]+$/.test(v) ? null : 'must be a bare host or IP address';
    }
  },
  {
    name: 'ASDAIR_COCKPIT_ALLOWED_ORIGIN',
    required: false,
    describe: 'exact origin of the cockpit. Unset = no CORS header at all, which is the safe default. There is no "*".',
    check: function (v) {
      return /^https?:\/\/[^/]+$/.test(v) ? null : 'must be an exact origin like https://host:port, with no path and no "*"';
    }
  },
  {
    name: 'ASDAIR_MEDIA_ROOT',
    required: false,
    describe: 'directory the retained list photos live under. Unset = /asdair/media is disabled.',
    check: function () { return null; }
  }
]);

/**
 * PURE. Validate an environment against CONFIG_SPEC.
 *
 * Pure and injectable so the rule is EXECUTED by a test rather than asserted in
 * a comment - the same reason serialiseBody is exported below, and the same
 * lesson: a check that lives inline in a startup closure cannot be proven.
 *
 * @returns {{ok:boolean, errors:string[], warnings:string[], enabled:object}}
 */
function validateConfig(env) {
  const e = env || {};
  const errors = [];
  const warnings = [];

  CONFIG_SPEC.forEach(function (spec) {
    const raw = e[spec.name];
    const present = raw !== undefined && raw !== null && String(raw).trim() !== '';
    if (!present) {
      if (spec.required) errors.push(spec.name + ' is not set - ' + spec.describe);
      return;
    }
    // NOTE: `problem` describes the SHAPE that was wanted. The value never
    // appears in it, because these strings are printed and a connection string
    // in a log is a leaked credential.
    const problem = spec.check(String(raw).trim());
    if (problem) errors.push(spec.name + ' is malformed - it ' + problem + '. (' + spec.describe + ')');
  });

  if (!e.ASDAIR_WRITE_DB_URL) {
    warnings.push('ASDAIR_WRITE_DB_URL is not set, so answers CANNOT be applied. '
      + 'POST /asdair/answer, /asdair/answer/choose and /asdair/answer/skip will answer 503 not_configured. '
      + 'The read surface is unaffected.');
  }
  if (!e.ASDAIR_COCKPIT_ALLOWED_ORIGIN) {
    warnings.push('ASDAIR_COCKPIT_ALLOWED_ORIGIN is not set, so no CORS header is sent and a browser '
      + 'page cannot read this service. That is the safe default, not an error.');
  }
  if (!e.ASDAIR_MEDIA_ROOT) {
    warnings.push('ASDAIR_MEDIA_ROOT is not set, so GET /asdair/media is disabled.');
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    // Which capabilities this configuration actually delivers. Reported at
    // startup so an operator reads what the service CAN do rather than
    // inferring it from which warnings did not appear.
    enabled: {
      read: !!e.ASDAIR_DB_URL,
      apply_answers: !!e.ASDAIR_WRITE_DB_URL,
      media: !!e.ASDAIR_MEDIA_ROOT,
      browser_access: !!e.ASDAIR_COCKPIT_ALLOWED_ORIGIN
    }
  };
}

/**
 * @param {{env?:object, exit?:Function, log?:Function, errorLog?:Function}} [options]
 *        Injected by the tests. Production supplies none of them.
 */
function start(options) {
  const opts = options || {};
  const env = opts.env || process.env;
  const log = opts.log || console.log;
  const errorLog = opts.errorLog || console.error;

  // ── VALIDATE BEFORE LISTENING. The order is the whole point: a port that is
  // open is a claim that the service works, and this service must not make that
  // claim before it has checked that it can.
  const config = validateConfig(env);
  config.warnings.forEach(function (w) { errorLog('asdair cockpit-api: NOTE - ' + w); });

  if (!config.ok) {
    errorLog('asdair cockpit-api: REFUSING TO START - configuration is incomplete or malformed.');
    config.errors.forEach(function (m) { errorLog('  * ' + m); });
    errorLog('  No port has been opened. Fix the variable(s) above and start again.');
    // A non-zero exit is what makes this LOUD to a supervisor: a process that
    // stays up while broken is the failure mode being closed here.
    const exit = opts.exit || function (code) { process.exit(code); };
    exit(1);
    return null;
  }

  const port = Number(env.ASDAIR_COCKPIT_PORT || 8710);
  const bind = env.ASDAIR_COCKPIT_BIND || '127.0.0.1';
  const server = createServer();
  server.listen(port, bind, function () {
    // Config only. No connection string, no secret, ever.
    log('asdair cockpit-api listening on ' + bind + ':' + String(port) +
      ' (reads ' + (config.enabled.read ? 'on' : 'OFF') +
      '; apply-answers ' + (config.enabled.apply_answers ? 'on' : 'off') +
      '; media ' + (config.enabled.media ? 'enabled' : 'disabled') + ')');
  });

  // ── A RESTART LOSES NOTHING ─────────────────────────────────────────────
  //
  // Because there is nothing to lose: every fact this service reports is read
  // from Postgres on the request that reports it, and every answer is written
  // to Postgres before the response is sent. There is no queue, no in-memory
  // cache, no session, no write-behind buffer and no accumulated state in this
  // process - the only things held across requests are connection POOLS, which
  // are pure performance and are rebuilt on demand.
  //
  // So recovery is "start it again". This handler exists to make the shutdown
  // ORDERLY rather than to preserve anything: it stops accepting new work and
  // closes the pools so the database is not left holding sockets that no
  // process is on the other end of.
  //
  // (Recovery DESIGN is the implementer's; recovery EXECUTION is the
  // operator's. This is the design half.)
  const shutdown = function (signal) {
    log('asdair cockpit-api: ' + signal + ' received - closing. Nothing is buffered, so nothing is lost.');
    server.close(function () {
      require('./commandDeps').closeCommandDeps().then(function () {
        log('asdair cockpit-api: closed.');
      }).catch(function () { /* shutting down; a failed pool close is not news */ });
    });
  };
  ['SIGINT', 'SIGTERM'].forEach(function (sig) {
    process.on(sig, function () { shutdown(sig); });
  });

  return server;
}

module.exports = {
  createServer: createServer,
  start: start,
  validateConfig: validateConfig,
  CONFIG_SPEC: CONFIG_SPEC,
  // Exported so the string-vs-JSON rule is EXECUTED by a test rather than
  // asserted in a comment. It was wrong for the checklist's whole lifetime and
  // nothing could have caught it: it lived inline in a closure.
  _internal: { serialiseBody: serialiseBody },
};

if (require.main === module) start();
