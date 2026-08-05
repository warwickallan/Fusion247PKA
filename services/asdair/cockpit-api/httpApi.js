// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/httpApi.js
//
// The thin transport the cockpit talks to. Framework-neutral and testable:
// handleRequest() takes a plain {method, path, query, body} and returns a
// plain {status, body}. server.js binds it to node:http and does nothing else.
//
// SIX ROUTES, AND NO MORE. (The header once said "THREE" while listing four;
// the count was stale, the list was not. Keep this count honest - ROUTES below
// is the machine-readable answer and httpApi.test.js asserts the two agree.)
//   GET  /asdair/health     - CAN THIS SERVICE DO ITS JOB. Dependency-aware:
//                             it connects and runs SELECT 1 before saying yes.
//                             It used to be a literal `ok: true` and reported
//                             healthy while /asdair/workspace was 500-ing.
//   GET  /asdair/workspace  - the durable payload for ONE shop (SELECT only)
//   GET  /asdair/rules      - the durable RULEBOOK: rules, decision log,
//                             regulars + aliases (SELECT only)
//   GET  /asdair/packet     - the Sonnet execution packet + basket
//                             reconciliation for ONE shop (SELECT only)
//   POST /asdair/command    - dispatch ONE named command from the shared surface
//   GET  /asdair/media      - the retained photo of the list
//
// WHY /asdair/rules IS A SEPARATE ROUTE rather than another key on the
// workspace: the workspace is scoped to one shop and is already the largest
// payload here. The rulebook is shop-INDEPENDENT and is read on a different
// screen, at a different moment, for a different question ("what has this
// thing learned, and is any of it wrong?"). Folding it in would make every
// shop poll carry the whole catalogue.
//
// WHAT MAKES THE COMMAND ROUTE SAFE:
//   * it can only forward a name from commandSurface.COMMAND_NAMES;
//   * it never constructs shopping logic - it forwards args to the pipeline;
//   * the deny list refuses checkout / payment / slot / credential shaped names
//     before anything is loaded.
//
// WHAT MAKES THE MEDIA ROUTE SAFE:
//   the file path comes from the DATABASE ROW, never from the request. The
//   caller supplies a shop id; the row supplies the path; the path must resolve
//   INSIDE the configured ASDAIR_MEDIA_ROOT or it is refused. A request cannot
//   name a file.
//
// PURE ASCII.
// =====================================================================

'use strict';

const path = require('path');
const commandSurface = require('./commandSurface');

const ROUTES = Object.freeze([
  'GET /asdair/health',
  'GET /asdair/workspace',
  'GET /asdair/rules',
  'GET /asdair/packet',
  'POST /asdair/command',
  'GET /asdair/media'
]);

function json(status, body) {
  return { status: status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: body };
}

/**
 * PURE. Decide the on-disk file for a shop's retained media.
 *
 * @param {string|null} rawMediaPath  asdair.shop.raw_media_path, from the DB
 * @param {string|null} mediaRoot     ASDAIR_MEDIA_ROOT
 */
function resolveMediaPath(rawMediaPath, mediaRoot) {
  if (!mediaRoot || String(mediaRoot).trim() === '') {
    return { ok: false, reason: 'media_root_not_configured' };
  }
  if (!rawMediaPath || String(rawMediaPath).trim() === '') {
    return { ok: false, reason: 'no_media_retained' };
  }
  const root = path.resolve(String(mediaRoot));
  const candidate = path.resolve(root, String(rawMediaPath));
  // Containment, not string-prefix luck: root + separator, so "/data/media-x"
  // cannot pass as being inside "/data/media".
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    return { ok: false, reason: 'outside_media_root' };
  }
  return { ok: true, path: candidate };
}

function readBody(body) {
  if (body === null || body === undefined) return {};
  if (typeof body === 'object') return body;
  try {
    const parsed = JSON.parse(String(body));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (ignore) {
    return null;
  }
}

/**
 * @param {{method:string, path:string, query?:object, body?:any}} req
 * @param {{readWorkspace?:Function, dispatch?:Function, commands?:object, mediaRoot?:string}} [deps]
 */
async function handleRequest(req, deps) {
  const d = deps || {};
  const method = String((req && req.method) || 'GET').toUpperCase();
  const route = String((req && req.path) || '');
  const query = (req && req.query) || {};

  // HEALTH IS DEPENDENCY-AWARE. It used to be a literal `ok: true` that could
  // not fail, and on 2026-08-03 it reported healthy WHILE /asdair/workspace was
  // 500-ing on a missing `pg` module. A service is not healthy because its port
  // answers - it is healthy when it can do the thing it exists to do.
  //
  // 503 when the dependency is down, deliberately: the cockpit's app-status
  // probe treats a non-2xx as down, so an unhealthy reader reads as unhealthy
  // even to a consumer that only looks at the status line. The BODY carries the
  // reason in words for the consumer that reads it. Both halves matter - one
  // without the other is how the false green survived.
  if (method === 'GET' && route === '/asdair/health') {
    const check = d.checkDependencies || require('./readWorkspace').checkDependencies;
    let dep;
    try {
      dep = await check({ timeoutMs: 2000 });
    } catch (err) {
      // checkDependencies is contracted never to throw. If it somehow does, that
      // is itself ill health - it must never fall through to a reassuring green.
      dep = { ok: false, dependency: 'database', checked: true, reason: 'check_failed', detail: 'the dependency check itself failed', message: safeMessage(err) };
    }
    const body = {
      ok: dep.ok === true,
      service: 'asdair-cockpit-api',
      read_only: true,
      command_surface_bound: d.commands ? true : commandSurface.isBound(),
      command_names: commandSurface.COMMAND_NAMES,
      dependencies: [dep]
    };
    if (!body.ok) {
      body.error = 'dependency_unavailable';
      // One line the cockpit can show verbatim. Never contains configuration.
      body.message = 'AsdAIr\'s reader cannot reach its database - ' + (dep.detail || 'reason unknown') + '.';
    }
    return json(body.ok ? 200 : 503, body);
  }

  if (method === 'GET' && route === '/asdair/workspace') {
    const read = d.readWorkspace || require('./readWorkspace').readWorkspace;
    try {
      const payload = await read({
        shop: query.shop === undefined ? null : query.shop,
        household_id: query.household === undefined ? null : query.household
      });
      return json(200, payload);
    } catch (err) {
      return json(500, { ok: false, error: 'read_failed', message: safeMessage(err) });
    }
  }

  // The durable rulebook. Same construction as /asdair/workspace above: an
  // injectable reader for the tests, one SELECT-only snapshot in production,
  // and a failure that answers 500 with a scrubbed message rather than a stack.
  if (method === 'GET' && route === '/asdair/rules') {
    const read = d.readRules || require('./readRules').readRules;
    try {
      const payload = await read({
        household_id: query.household === undefined ? null : query.household
      });
      return json(200, payload);
    } catch (err) {
      return json(500, { ok: false, error: 'read_failed', message: safeMessage(err) });
    }
  }

  // The Sonnet execution packet and the basket reconciliation for ONE shop.
  // Both halves in one response because they are read on one screen, for one
  // shop, at one moment - a phone should not pay two round trips for it. Each
  // half is independently nullable: the packet routinely exists before the
  // reconciliation does. Contract:
  //   Builds/BUILD-015-.../COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md
  if (method === 'GET' && route === '/asdair/packet') {
    const read = d.readPacket || require('./readPacket').readPacket;
    try {
      const payload = await read({ shop: query.shop === undefined ? null : query.shop });
      return json(200, payload);
    } catch (err) {
      return json(500, { ok: false, error: 'read_failed', message: safeMessage(err) });
    }
  }

  if (method === 'GET' && route === '/asdair/media') {
    // server.js owns the streaming; the router only says whether it may.
    return json(501, {
      ok: false,
      error: 'stream_not_available_here',
      message: 'GET /asdair/media is served by server.js, which streams the file resolved by resolveMediaPath().'
    });
  }

  if (route === '/asdair/command') {
    if (method !== 'POST') {
      return json(405, { ok: false, error: 'method_not_allowed', message: 'POST only.' });
    }
    const body = readBody(req && req.body);
    if (body === null) {
      return json(400, { ok: false, error: 'bad_json', message: 'Request body is not valid JSON.' });
    }
    const name = body.command;
    if (!commandSurface.isCommandName(name) || commandSurface.isForbiddenName(name)) {
      return json(400, {
        ok: false,
        error: 'unknown_command',
        message: 'The cockpit may only call the shared AsdAIr command surface.',
        command_names: commandSurface.COMMAND_NAMES
      });
    }
    const dispatch = d.dispatch || commandSurface.dispatch;
    try {
      // requested_by travels with every command so the audit trail records
      // WHICH surface acted, exactly as the Telegram path records its responder.
      const args = Object.assign({}, body.args || {}, {
        requested_by: 'cockpit:' + String(body.actor || 'warwick'),
        idempotency_key: body.idempotency_key || null
      });
      const result = await dispatch(name, args, { commands: d.commands });
      return json(200, { ok: true, command: name, result: result === undefined ? null : result });
    } catch (err) {
      const code = err && err.code;
      const status = code === 'ASDAIR_COMMANDS_NOT_BOUND' ? 503
        : (code === 'ASDAIR_COMMAND_UNKNOWN' || code === 'ASDAIR_COMMAND_FORBIDDEN') ? 400 : 500;
      return json(status, { ok: false, error: code || 'command_failed', command: name, message: safeMessage(err) });
    }
  }

  return json(404, { ok: false, error: 'not_found', routes: ROUTES });
}

// Never let a connection string or anything env-shaped reach a browser.
function safeMessage(err) {
  const msg = err && err.message ? String(err.message) : 'unexpected error';
  return msg.replace(/postgres(ql)?:\/\/\S+/gi, '[redacted-connection-string]');
}

module.exports = {
  handleRequest: handleRequest,
  resolveMediaPath: resolveMediaPath,
  ROUTES: ROUTES,
  _internal: { json: json, readBody: readBody, safeMessage: safeMessage }
};
