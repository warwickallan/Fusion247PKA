// =====================================================================
// BUILD-015 AsdAIr Stage 1 - cockpit-api/httpApi.js
//
// The thin transport the cockpit talks to. Framework-neutral and testable:
// handleRequest() takes a plain {method, path, query, body} and returns a
// plain {status, body}. server.js binds it to node:http and does nothing else.
//
// TWELVE ROUTES, AND NO MORE. (The header once said "THREE" while listing four;
// the count was stale, the list was not. Keep this count honest - ROUTES below
// is the machine-readable answer and httpApi.test.js asserts the two agree.)
//
// WP-B15-50 moved this from ELEVEN to TWELVE: POST /asdair/check-item, the
// sense-check. SELECT-only, and its response is SEALED so a candidate list can
// never reach Mum's screen - see checkItem.js.
// WP-B15-48 moved this from TEN to ELEVEN: POST /asdair/list, the write door.
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
//   POST /asdair/list       - THE WRITE DOOR. One tapped list from Mum's
//                             Cockpit becomes one durable shop, through the
//                             SHARED receiveList command. `created` in the
//                             response is load-bearing: false means the day's
//                             shop already existed and nothing durable changed.
//   POST /asdair/check-item - THE SENSE-CHECK. "Have I already got this?"
//                             SELECT-only. Answers; never asks.
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
// The Cockpit's translator. PURE - no `pg`, no environment - so importing this
// transport still needs neither, exactly as before.
const cockpitIntake = require('./cockpitIntake');
// The sense-check. `classifyItem` is PURE; only `loadRegulars` touches the
// SELECT-only pool, and it is required lazily below for the same reason
// commandDeps is - importing this transport must need neither `pg` nor an
// environment variable.
const checkItem = require('./checkItem');
// WP-B15-50 AC5. The ShopperBot notification. Required at the top because THE
// REAL SUBMISSION EVENT MUST FIRE IT - there is no other caller and no manual
// step. It is hermetic (no `pg`, no credential read at import) so this transport
// still imports clean.
const notifyShopper = require('./notifyShopper');

const ROUTES = Object.freeze([
  'GET /asdair/health',
  'GET /asdair/workspace',
  'GET /asdair/rules',
  'GET /asdair/packet',
  'GET /asdair/checklist',
  'POST /asdair/command',
  'GET /asdair/media',
  // WP-B15-48 AC3. THE WRITE DOOR: the one route on this service that creates
  // something. Mum's Cockpit proxies to it; it holds no logic of its own.
  'POST /asdair/list',
  // WP-B15-50 AC1. THE SENSE-CHECK. Read-only, and the ONLY route here whose
  // response shape is sealed by its module rather than assembled inline.
  'POST /asdair/check-item',
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
    // ── WP-B15-48 AC6. TWO THINGS THIS USED TO SAY THAT WERE NOT TRUE ───────
    //
    // 1. `command_surface_bound` was `d.commands ? true : isBound()`, and
    //    isBound() is `require.resolve` - it finds the FILE without evaluating
    //    it. A module that throws on import, or that has drifted so it no
    //    longer exposes this surface, resolved exactly as happily as a working
    //    one: the flag meant "a file exists on disk" while reading as "commands
    //    work". The injected branch was worse - `d.commands ? true` asserted
    //    nothing whatsoever about what was injected. It now calls
    //    isDispatchable(), which LOADS and ASSERTS the surface: the same work
    //    dispatch does before it calls a command.
    //
    // 2. `read_only: true` was a literal, and stopped being true the moment
    //    POST /asdair/list landed. This service writes now - exactly one route,
    //    through the shared receiveList command. Telling a consumer that is
    //    deciding whether it is safe to call that this service cannot write is
    //    the same class of lie as (1), and this is the criterion about lies.
    const dispatchable = commandSurface.isDispatchable(d.commands);
    const body = {
      ok: dep.ok === true && dispatchable,
      service: 'asdair-cockpit-api',
      read_only: false,
      command_surface_bound: dispatchable,
      command_names: commandSurface.COMMAND_NAMES,
      dependencies: [dep]
    };
    if (!body.ok) {
      // WHICH of the two failed decides what the operator is told. A database
      // that is down and a command surface that will not load need different
      // actions, and one message covering both would name neither.
      if (dep.ok !== true) {
        body.error = 'dependency_unavailable';
        // One line the cockpit can show verbatim. Never contains configuration.
        body.message = 'AsdAIr\'s reader cannot reach its database - ' + (dep.detail || 'reason unknown') + '.';
      } else {
        body.error = 'command_surface_unbound';
        body.message = 'AsdAIr can read, but no command can be dispatched - its shared command '
          + 'surface did not load. Nothing sent from the cockpit would be applied.';
      }
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

  // ── WP-B15-48 AC3: THE WRITE DOOR. POST /asdair/list ─────────────────────
  //
  // The one route on this service that creates something. It holds no shopping
  // logic and no intake logic of its own: cockpitIntake.js translates the
  // request into the spec, and the SHARED `receiveList` does the rest, exactly
  // as it does for Telegram.
  if (route === '/asdair/list') {
    if (method !== 'POST') {
      return json(405, { ok: false, error: 'method_not_allowed', message: 'POST only.' });
    }
    const body = readBody(req && req.body);
    if (body === null) {
      return json(400, { ok: false, error: 'bad_json', message: 'Request body is not valid JSON.' });
    }

    // THE STAMP IS TAKEN ONCE, HERE, at the edge - and is injectable, so a test
    // pins the week rather than depending on the day it runs. Everything
    // downstream derives the shop_ref from this one value.
    const receivedAt = typeof d.now === 'function' ? d.now() : new Date().toISOString();

    let built;
    try {
      built = cockpitIntake.buildReceiveListSpec(body, { receivedAt: receivedAt });
    } catch (err) {
      // `expose` marks the errors that are about HER submission - safe to show,
      // and useful. Anything else is ours and is reported as a plain failure.
      if (err && err.expose === true) {
        return json(400, { ok: false, error: err.code || 'list_invalid', message: err.message });
      }
      return json(500, { ok: false, error: 'list_failed', message: safeMessage(err) });
    }

    const dispatchList = d.dispatch || commandSurface.dispatch;
    let listDeps;
    try {
      listDeps = resolveCommandDeps(d);
    } catch (err) {
      return json(503, {
        ok: false,
        error: err && err.code === 'ASDAIR_CONFIG_MISSING' ? 'not_configured' : 'list_failed',
        message: safeMessage(err)
      });
    }

    try {
      const result = await dispatchList('receiveList', built.spec, { commands: d.commands, deps: listDeps });
      const r = result && typeof result === 'object' ? result : {};
      const createdNow = r.created === true;
      const recordedNew = !!(r.recorded && r.recorded.created === true);

      // ── WP-B15-50 AC5/AC6. THE NOTIFICATION, FIRED BY THIS EVENT ─────────
      //
      // ⛔ ORDER MATTERS AND IS DELIBERATE. `receiveList` has already returned,
      // so HER LIST IS DURABLE BEFORE THIS LINE RUNS. Nothing below can undo it,
      // and nothing below can fail her submission: notifySubmission never throws
      // and never rejects, and it is bounded so a dead Telegram cannot hold her
      // SEND button open.
      //
      // It is awaited rather than fired and forgotten because the response has
      // to be able to say whether Warwick was actually told - a promise the page
      // makes on her behalf. A detached send could not be reported, and
      // "recorded but not silent" would quietly become "recorded and silent".
      const notice = await notifyShopper.notifySubmission({
        created: createdNow,
        recorded_new: recordedNew,
        shop_ref: r.shop_ref === undefined ? null : r.shop_ref,
        items: built.items.length,
        extras: built.extras.length,
        rawText: built.rawText,
        clock: built.clock
      }, d.notify);

      return json(200, {
        ok: true,
        shop_ref: r.shop_ref === undefined ? null : r.shop_ref,
        shop_id: r.shop_id === undefined ? null : r.shop_id,
        // ── `created` IS LOAD-BEARING (route contract v2) ──────────────────
        // TRUE only when a shop row was actually written. On FALSE the day's
        // shop already existed and this submission changed nothing durable -
        // the UI must render that differently and must NOT say the list was
        // sent. It is taken from the store's own report, never inferred here.
        created: createdNow,
        // ── `recorded_new` IS THE THIRD OUTCOME (route contract v3, AC4) ───
        //
        // TRUE when THIS submission left a durable ledger row of its own. It is
        // the store's own report - `recorded.created` from the pipeline receipt,
        // which is the INSERT ... ON CONFLICT DO NOTHING result on
        // (shop_ref, sourceId) - never anything inferred here.
        //
        // WHY THE THREE CASES ARE NOT TWO. `created` alone could not tell
        // "today's shop already existed and I recorded what you changed" apart
        // from "today's shop already existed and this was identical, so nothing
        // was written at all". Both were `ok:true, created:false`, and Felix's
        // page rendered one sentence for two different truths - one of which was
        // a promise that Warwick had been told.
        //
        //   created  recorded_new
        //   true     true           a shop was created from her list
        //   false    true           recorded, but it does NOT alter today's shop
        //   false    false          identical resubmission - nothing happened
        //
        // Defensive on shape rather than trusting it: a receipt without
        // `recorded` reads as "nothing new was recorded", which is the safe
        // direction - it under-claims instead of promising a durable row that
        // may not exist.
        recorded_new: recordedNew,
        // THE STORE'S OWN VOCABULARY, PASSED THROUGH VERBATIM. No translation
        // layer: a renamed enum is a place for the two sides to drift.
        // `superseded_terminal_ref` is reported as the match when the store had
        // to start a fresh shop because a terminal one owned the date.
        matched_by: r.superseded_terminal_ref ? 'superseded_terminal_ref' : (r.matched_by || null),
        superseded_terminal_ref: r.superseded_terminal_ref || null,
        // What the durable record now holds for this submission. `duplicate`
        // is the store saying this exact intent was already recorded.
        duplicate: r.duplicate === true,
        source_id: r.source_id || null,
        items: built.items.length,
        // WP-B15-50 AC3. How many of the lines she sent were TYPED rather than
        // tapped - so the count in the notification and the count on the page
        // come from the same place.
        extras: built.extras.length,
        // ── HER TABLET'S DATE CLAIM, CHECKED AND REPORTED ─────────────────
        // `list_date` is the date THE SERVER recorded and the only one that
        // decided the shop_ref. The other two are the assertion her tablet made
        // and whether it agreed. FOR WARWICK, NEVER FOR HER: no UI copy is
        // derived from these, and a disagreement never fails a submission.
        list_date: built.clock.recorded,
        list_date_claimed: built.clock.claimed,
        list_date_agrees: built.clock.agrees,
        // ── WAS WARWICK ACTUALLY TOLD? (AC5) ─────────────────────────────
        // `notified` is TRUE only when a send genuinely succeeded. On the
        // no-op row nothing was attempted, so it is false with no error - the
        // correct reading is "nobody needed telling", and `recorded_new:false`
        // beside it says so. `notify_error` carries the machine code on a real
        // failure, so a page or an operator can tell a Telegram outage from a
        // missing configuration without reading a log.
        //
        // ⛔ HER SUBMISSION IS STILL ok:true HERE. The list is saved; only the
        // telling failed. Turning a saved shop into an error on her screen
        // because a bot was unreachable would be the worse defect by far.
        notified: notice.notified === true,
        notify_error: notice.error || null
      });
    } catch (err) {
      return json(listErrorStatus(err), listErrorBody(err));
    }
  }

  // ── WP-B15-50 AC1/AC2: THE SENSE-CHECK. POST /asdair/check-item ──────────
  //
  // "Have I already got this?" - asked by the page while she is typing, before
  // anything travels. SELECT-only: it opens no write pool and dispatches no
  // command, so it cannot change a single row no matter what is posted to it.
  //
  // ⛔ THE RESPONSE IS SEALED BY checkItem.js, NOT ASSEMBLED HERE. That is
  // deliberate: the resolver's `needs_confirmation` verdict carries a candidate
  // array, and a body built inline by spreading it is one keystroke away. The
  // seal throws on any key outside the frozen four, so the failure is a red test
  // rather than a question on an 84-year-old's screen.
  //
  // ⛔ AND IT NEVER BLOCKS HER. Every failure exit is the contract's error
  // shape; the page's own obligation on ok:false is to ACCEPT HER ITEM ANYWAY.
  // A sense-check that swallows her words when the database is down would be
  // worse than no sense-check at all.
  if (route === '/asdair/check-item') {
    if (method !== 'POST') {
      return json(405, { ok: false, error: 'method_not_allowed', message: 'POST only.' });
    }
    const body = readBody(req && req.body);
    if (body === null) {
      return json(400, { ok: false, error: 'bad_json', message: 'Request body is not valid JSON.' });
    }

    const load = d.loadRegulars || checkItem.loadRegulars;
    let regulars;
    try {
      regulars = await load({ household_id: body.household === undefined ? null : body.household });
    } catch (err) {
      // A missing connection string is CONFIGURATION, not a bad request - the
      // same mapping every other route here uses.
      const code = err && err.code === 'ASDAIR_CONFIG_MISSING' ? 'not_configured' : 'check_failed';
      const status = /ASDAIR_DB_URL is not set/.test((err && err.message) || '') ? 503
        : (code === 'not_configured' ? 503 : 500);
      return json(status, {
        ok: false,
        error: status === 503 ? 'not_configured' : code,
        message: safeMessage(err)
      });
    }

    try {
      const verdict = checkItem.classifyItem({
        text: body.text,
        regulars: regulars,
        chosen: body.chosen
      });
      // `ok` plus the sealed four. Nothing else is added here, and nothing else
      // can be: `verdict` came out of the seal with exactly those keys.
      return json(200, Object.assign({ ok: true }, verdict));
    } catch (err) {
      if (err && err.expose === true) {
        return json(400, { ok: false, error: err.code || 'check_invalid', message: err.message });
      }
      return json(500, { ok: false, error: 'check_failed', message: safeMessage(err) });
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

// ── WP-B15-48. THE TERMINAL-SHOP COLLISION, NAMED RATHER THAN ROUTED AROUND ─
//
// THE HOLE, STATED EXACTLY. Cancel this week, then send a list from the
// Cockpit: shopStore sees the ref matched a TERMINAL shop, refuses to resume a
// dead row (correctly), and asks shopState.collisionShopRef for a fresh
// identity - which REFUSES when there is no inbound Telegram message id to
// ground it on. That refusal is deliberate and was ruled on 2026-08-10: an
// invented identity (a counter, a timestamp, a random suffix) would either
// need a clock that module refuses to have, or would make a retry create a
// second shop. A loud refusal on an edge path is recoverable; a fabricated
// identity is not.
//
// Every Cockpit submission has no message id, so the guard is reachable ONLY
// through this door. THIS CODE DOES NOT ROUTE AROUND IT. It does not mint a
// shop_ref, does not pass a fake message id, and does not retry: it recognises
// the condition and gives her one plain sentence instead of a 500.
//
// WHETHER SHE SHOULD BE ABLE TO RE-SEND AFTER A CANCELLED WEEK IS A PRODUCT
// DECISION, and it is Warwick's. It is recorded as an open question, not
// resolved here in code.
//
// ⚠️ MATCHED ON THE MESSAGE, BECAUSE shopState THROWS A PLAIN Error WITH NO
// CODE. That is fragile on its own, so httpApi.test.js generates the error from
// the REAL shopState.collisionShopRef and asserts this predicate still
// recognises it. If the upstream wording changes, that test goes red here
// rather than the condition silently becoming a 500 in front of an 84-year-old.
function isTerminalCollision(err) {
  const msg = err && err.message ? String(err.message) : '';
  return /collisionShopRef/.test(msg) && /message id/i.test(msg);
}

function listErrorStatus(err) {
  const code = err && err.code;
  if (isTerminalCollision(err)) return 409;                       // a real conflict with a real row
  // A missing connection string is a CONFIGURATION failure, not a bad request -
  // the same mapping the answer routes already use. It surfaces from the
  // dispatch rather than from resolveCommandDeps, because the pools are opened
  // lazily on first real use.
  if (code === 'ASDAIR_CONFIG_MISSING' || code === 'ASDAIR_COMMANDS_NOT_BOUND') return 503;
  if (code === 'ASDAIR_COMMAND_UNKNOWN' || code === 'ASDAIR_COMMAND_FORBIDDEN') return 400;
  return 500;
}

function listErrorBody(err) {
  if (err && err.code === 'ASDAIR_CONFIG_MISSING') {
    return { ok: false, error: 'not_configured', message: safeMessage(err) };
  }
  if (isTerminalCollision(err)) {
    return {
      ok: false,
      error: 'shop_already_finished',
      // ONE plain sentence, in her words, saying what is true and what she can
      // do. It never mentions a shop_ref, a message id or a collision.
      message: "This week's shop has already been finished or cancelled, so I can't add to it."
    };
  }
  return {
    ok: false,
    error: (err && err.code) || 'list_failed',
    message: safeMessage(err)
  };
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
