// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/httpApi.js
//
// The thin transport the cockpit talks to. Framework-neutral and testable:
// handleRequest() takes a plain {method, path, query, body} and returns a
// plain {status, body}. server.js binds it to node:http and does nothing else.
//
// TEN ROUTES, AND NO MORE. (The header once said "THREE" while listing four;
// the count was stale, the list was not. Keep this count honest - ROUTES below
// is the machine-readable answer and httpApi.test.js asserts the two agree.)
//
// WP-B15-41 moved this from SEVEN to TEN: the three resolution routes below.
// The pinned literal in httpApi.test.js is edited in the same commit, on
// purpose - that pin exists so growing the surface is a deliberate act, and it
// has now caught four additions in a row.
//   GET  /asdair/health     - CAN THIS SERVICE DO ITS JOB. Dependency-aware:
//                             it connects and runs SELECT 1 before saying yes.
//                             It used to be a literal `ok: true` and reported
//                             healthy while /asdair/workspace was 500-ing.
//   GET  /asdair/workspace  - the durable payload for ONE shop (SELECT only)
//   GET  /asdair/rules      - the durable RULEBOOK: rules, decision log,
//                             regulars + aliases (SELECT only)
//   GET  /asdair/checklist  - the browser checklist for ONE shop, as Markdown:
//                             lines, method and prohibitions, rendered by
//                             handoff/renderChecklist.js from the stored
//                             artefact (SELECT only)
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
  'GET /asdair/checklist',
  'POST /asdair/command',
  'GET /asdair/media',
  // WP-B15-41 AC3. THREE ROUTES OVER ONE UNCHANGED COMMAND. See ANSWER_ROUTES.
  'POST /asdair/answer',
  'POST /asdair/answer/choose',
  'POST /asdair/answer/skip'
]);

/**
 * ── AC3: THE THREE WAYS A QUESTION GETS SETTLED ───────────────────────────
 *
 * ⛔ THE COMMAND SURFACE DOES NOT GROW. All three land on `answerQuestion`,
 *    which already covers every shape and is already first-answer-wins
 *    idempotent - it returns the existing row unchanged with `changed: false`
 *    once the question is no longer open. Adding `chooseCandidate` and
 *    `skipThisWeek` commands would have created a second way to write the same
 *    row, which is the exact drift commandSurface.js exists to prevent and the
 *    reason an answer given on the phone clears the question in the cockpit.
 *
 * So these are ROUTES: three shapes of one HTTP request onto one command.
 * POST /asdair/command still forwards the raw command for a caller that wants
 * it; these exist so a UI does not have to know the spec shape of a pipeline
 * function in order to answer a question.
 *
 *   POST /asdair/answer         { shop, question_key, answer_text }
 *                               free text          -> answer_source "typed"
 *   POST /asdair/answer/choose  { shop, question_key, answer_text }
 *                               a candidate tapped -> answer_source "button"
 *   POST /asdair/answer/skip    { shop, question_key }
 *                               "not this week"    -> status skipped
 *
 * EACH REPORTS WHETHER THE ANSWER WAS APPLIED, not merely that it was accepted:
 * `applied` is the durable outcome and `already_answered` separates "you had
 * already settled this" from "this just landed". Both come from the command's
 * own report of what the row did - never from this layer assuming it worked.
 */
const ANSWER_ROUTES = Object.freeze({
  '/asdair/answer': { source: 'typed', skip: false, needs_text: true },
  '/asdair/answer/choose': { source: 'button', skip: false, needs_text: true },
  '/asdair/answer/skip': { source: 'button', skip: true, needs_text: false }
});

function json(status, body) {
  return { status: status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: body };
}

/**
 * Markdown, served as Markdown. The checklist is READ BY A PERSON while they are
 * standing in a shop, so it is returned as text a phone renders rather than as a
 * JSON string a client has to unwrap and re-render - which would be a second
 * renderer by the back door.
 */
function markdown(status, body) {
  return { status: status, headers: { 'content-type': 'text/markdown; charset=utf-8' }, body: body };
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

/**
 * WP-B15-41 AC3. Which dependency container does this dispatch use?
 *
 * THE RULE, and it is one line so it cannot rot: an INJECTED caller owns its
 * own implementation, and a real one gets the real container.
 *
 *   * `commandDeps` injected  -> use it, whatever it is (including null).
 *   * `dispatch` or `commands` injected -> the caller has supplied the
 *     behaviour, so there is nothing for a container to do and building one
 *     would demand a database that a pure test has no business needing.
 *   * neither -> the real container, built lazily by commandDeps.js, which is
 *     the ONLY path that opens a pool.
 *
 * Required lazily and inside the guard, so importing httpApi.js still needs
 * neither `pg` nor an environment variable.
 */
function resolveCommandDeps(d) {
  if (Object.prototype.hasOwnProperty.call(d, 'commandDeps')) return d.commandDeps;
  if (d.dispatch || d.commands) return undefined;
  // eslint-disable-next-line global-require
  return require('./commandDeps').getCommandDeps();
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

  // THE CHECKLIST WARWICK SHOPS FROM. The lines, the method and the
  // prohibitions, rendered by handoff/renderChecklist.js from the artefact
  // stored at handover - the ONLY renderer, deliberately.
  //
  // Markdown by default because a person reads it on a phone; `?format=json`
  // for a caller that wants the state and the counts without the page.
  //
  // A state that is not `ready` answers 200, not 404: "this shop has not been
  // handed over yet" is a true, useful answer to a well-formed question about a
  // real shop, and 404 would make a normal state look like a broken link.
  if (method === 'GET' && route === '/asdair/checklist') {
    const read = d.readChecklist || require('./readChecklist').readChecklist;
    const wantsJson = String(query.format || '').toLowerCase() === 'json';
    let payload;
    try {
      payload = await read({ shop: query.shop === undefined ? null : query.shop });
    } catch (err) {
      return json(500, { ok: false, error: 'read_failed', message: safeMessage(err) });
    }
    if (payload && payload.ok === false) {
      return wantsJson ? json(400, payload) : markdown(400, '# No shop named\n\n' + String(payload.message || ''));
    }
    if (wantsJson) return json(200, payload);
    if (payload && payload.state === 'ready') return markdown(200, String(payload.markdown));
    // Never an empty page, and never an empty shopping list. The reason is the
    // body, so a phone that followed the link is told what is actually going on.
    return markdown(200, '# No checklist yet\n\n' + String((payload && payload.message) || 'Unknown state.'));
  }

  if (method === 'GET' && route === '/asdair/media') {
    // server.js owns the streaming; the router only says whether it may.
    return json(501, {
      ok: false,
      error: 'stream_not_available_here',
      message: 'GET /asdair/media is served by server.js, which streams the file resolved by resolveMediaPath().'
    });
  }

  // ── AC3: THE THREE RESOLUTION ROUTES ─────────────────────────────────────
  if (Object.prototype.hasOwnProperty.call(ANSWER_ROUTES, route)) {
    if (method !== 'POST') {
      return json(405, { ok: false, error: 'method_not_allowed', message: 'POST only.' });
    }
    const shape = ANSWER_ROUTES[route];
    const body = readBody(req && req.body);
    if (body === null) {
      return json(400, { ok: false, error: 'bad_json', message: 'Request body is not valid JSON.' });
    }

    const shop = body.shop === undefined || body.shop === null ? null : String(body.shop).trim();
    const questionKey = body.question_key === undefined || body.question_key === null
      ? '' : String(body.question_key).trim();
    const answerText = body.answer_text === undefined || body.answer_text === null
      ? '' : String(body.answer_text).trim();

    // Refused HERE, by name, rather than allowed through to fail somewhere less
    // legible. A question cannot be answered without knowing which question.
    if (shop === null || shop === '') {
      return json(400, { ok: false, error: 'no_shop', message: 'A shop must be named to answer a question.' });
    }
    if (questionKey === '') {
      return json(400, { ok: false, error: 'no_question', message: 'question_key is required - it names which question this answers.' });
    }
    if (shape.needs_text && answerText === '') {
      return json(400, {
        ok: false,
        error: 'no_answer_text',
        message: 'answer_text is required on this route. To settle a question WITHOUT choosing a '
          + 'product, POST /asdair/answer/skip - which records "not this week" as a real decision '
          + 'rather than as an empty answer.'
      });
    }

    // A shop is named by ref ("SHOP-2026-08-13") or by id, exactly as every GET
    // route here already accepts. `shopRef` and `shopId` are separate fields on
    // the command's spec, so which one this is has to be decided rather than
    // guessed - and an all-digits handle is an id.
    const byId = /^\d+$/.test(shop);
    const spec = {
      [byId ? 'shopId' : 'shopRef']: byId ? Number(shop) : shop,
      // The audit trail records WHICH surface acted, exactly as the Telegram
      // path records its responder.
      actor: 'cockpit:' + String(body.actor || 'warwick'),
      questionKey: questionKey,
      answerSource: shape.source,
      skip: shape.skip,
    };
    if (!shape.skip) spec.answerText = answerText;

    const dispatch = d.dispatch || commandSurface.dispatch;
    let deps;
    try {
      deps = resolveCommandDeps(d);
    } catch (err) {
      // A missing connection string is a CONFIGURATION failure, not a bad
      // request, and it must say so in words rather than 500 with a stack.
      return json(503, {
        ok: false,
        error: err && err.code === 'ASDAIR_CONFIG_MISSING' ? 'not_configured' : 'command_failed',
        applied: false,
        message: safeMessage(err)
      });
    }

    try {
      const result = await dispatch('answerQuestion', spec, { commands: d.commands, deps: deps });
      const r = result && typeof result === 'object' ? result : {};
      return json(200, {
        ok: true,
        route: route,
        question_key: questionKey,
        // ── THE CONFIRMATION THAT THE ANSWER WAS APPLIED ──────────────────
        // `changed` is shopStore's own report that the UPDATE hit an open row.
        // A first answer is applied and changed; a repeat is applied (the row
        // holds the answer) but NOT changed. Saying "you already answered this"
        // is more truthful than silently doing nothing AND than pretending it
        // just landed.
        applied: r.changed === true || r.already_answered === true,
        changed: r.changed === true,
        already_answered: r.already_answered === true,
        answer_source: shape.source,
        skipped: shape.skip,
        result: result === undefined ? null : result
      });
    } catch (err) {
      const code = err && err.code;
      const status = code === 'ASDAIR_COMMANDS_NOT_BOUND' ? 503
        : (code === 'ASDAIR_COMMAND_UNKNOWN' || code === 'ASDAIR_COMMAND_FORBIDDEN') ? 400 : 500;
      // `applied: false` on EVERY failure path. A caller must never have to
      // infer from an error shape whether the durable row moved.
      return json(status, {
        ok: false,
        error: code || 'command_failed',
        route: route,
        question_key: questionKey,
        applied: false,
        message: safeMessage(err)
      });
    }
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
      // AC3. The container the commands are actually called with. Without it
      // every write command on this route threw on an undefined `deps` before
      // it reached a row - the surface was bound and never wired.
      const result = await dispatch(name, args, { commands: d.commands, deps: resolveCommandDeps(d) });
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
  ANSWER_ROUTES: ANSWER_ROUTES,
  _internal: {
    json: json,
    readBody: readBody,
    safeMessage: safeMessage,
    resolveCommandDeps: resolveCommandDeps
  }
};
