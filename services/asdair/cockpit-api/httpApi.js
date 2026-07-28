// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/httpApi.js
//
// The thin transport the cockpit talks to. Framework-neutral and testable:
// handleRequest() takes a plain {method, path, query, body} and returns a
// plain {status, body}. server.js binds it to node:http and does nothing else.
//
// THREE ROUTES, AND NO MORE.
//   GET  /asdair/health     - is the reader alive, is the command surface bound
//   GET  /asdair/workspace  - the durable payload (SELECT only)
//   POST /asdair/command    - dispatch ONE named command from the shared surface
//   GET  /asdair/media      - the retained photo of the list
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

  if (method === 'GET' && route === '/asdair/health') {
    return json(200, {
      ok: true,
      service: 'asdair-cockpit-api',
      read_only: true,
      command_surface_bound: d.commands ? true : commandSurface.isBound(),
      command_names: commandSurface.COMMAND_NAMES
    });
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
