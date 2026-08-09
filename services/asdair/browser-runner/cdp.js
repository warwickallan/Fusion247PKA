// =====================================================================
// BUILD-015 AsdAIr browser runner - minimal Chrome DevTools Protocol client.
// NO Claude Code, NO MCP, NO extension, NO Playwright, ZERO dependencies.
//
// It attaches to an ALREADY-RUNNING, VISIBLE Chrome started against the
// runner's own dedicated profile:
//
//   chrome.exe --remote-debugging-port=9222 \
//              --user-data-dir=C:\.fusion247\asdair\chrome-profile
//
// The runner never launches Chrome headless and never attaches to Warwick's
// daily profile. `assertVisibleBrowser()` refuses to proceed against a headless
// build, because a supervised shop that Warwick cannot watch is not supervised.
//
// ── ONE SHOPPING TAB. AN INVARIANT, NOT A CONVENTION ────────────────────────
//
// BROWSER_METHOD step `one_session_one_page_context` (handoff/instructions.js).
// Warwick, 2026-08-09: one persistent profile, one session, ONE TAB, ten items,
// basket ready. A tab per item is the slow, wrong shop and it is also the shape
// that loses the authenticated context.
//
// This used to be caller discipline: `newTab` was exported, `withPage()` in
// actions.cjs and `openAndEval()` in readTrolley.cjs each called it on EVERY
// invocation, and a tab per add was the documented-against behaviour that the
// code nevertheless produced. Documenting an invariant in a method file that
// the arm never reads does not make it one.
//
// So the raw tab-creating primitive is NO LONGER EXPORTED. There is exactly one
// way to obtain a page - `sessionTab()` / `openShoppingTab()` - and both go
// through `createPageTarget()`, which REFUSES to open a second page target
// while the session already holds a live one. A module cannot walk around this
// by importing `newTab` directly, because there is nothing to import.
//
// Surface for actions.cjs / readTrolley.cjs:
//   targets(), connect(wsUrl), sessionTab(url), openShoppingTab(url, opts)
// For the runner: version(), closeTab(), activate(), reuseTab().
// =====================================================================
'use strict';

/**
 * Resolved at CALL time, never at module load. A value frozen into a const at
 * require() is unreachable to anything that sets the variable afterwards -
 * including a proof that wants to point this at a fake endpoint.
 */
function endpoint() { return process.env.ASDAIR_CDP_ENDPOINT || 'http://127.0.0.1:9222'; }

// The proofs inject a transport so the one-tab invariant can be exercised with
// no Chrome, no network and no sockets. Production never sets this: oneTab.test.cjs
// scans the source and fails if any non-test file in this folder touches `_internal`.
let transport = null;

async function http(pathname, init) {
  if (transport) return transport(pathname, init);
  const r = await fetch(`${endpoint()}${pathname}`, init);
  if (!r.ok) throw new Error(`CDP ${pathname} -> HTTP ${r.status}`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

/** Raised when a code path would put a second page in front of Warwick. */
class OneTabViolationError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'OneTabViolationError';
    this.detail = detail || null;
  }
}

// The one page target this session owns, and the guard that keeps it the only
// one. `oneTabGuard` exists so mutation-proof.js can remove the guard and show
// the property break; nothing in production ever flips it.
let sessionTargetId = null;
let oneTabGuard = true;

async function version() { return http('/json/version'); }
async function targets() { return http('/json/list'); }
async function closeTab(id) { return http(`/json/close/${id}`); }
async function activate(id) { return http(`/json/activate/${id}`); }

async function pageTargets() {
  const list = await targets();
  return Array.isArray(list) ? list.filter((t) => t && t.type === 'page') : [];
}

/**
 * THE ONLY PLACE A PAGE TARGET IS CREATED, and it fails LOUDLY rather than
 * quietly opening a second one.
 *
 * Not exported. Reachable only through sessionTab()/reuseTab(), both of which
 * look for an existing tab first - so on the ordinary path this is called once
 * per session and never again.
 */
async function createPageTarget(url) {
  if (oneTabGuard && sessionTargetId !== null) {
    const stillLive = (await pageTargets()).some((t) => t.id === sessionTargetId);
    if (stillLive) {
      throw new OneTabViolationError(
        `refusing to open a second page target: this session already holds tab ${sessionTargetId}. `
        + 'The shop runs in ONE tab (BROWSER_METHOD one_session_one_page_context) - navigate the tab '
        + 'you already have instead of opening another.',
        { heldTargetId: sessionTargetId, requestedUrl: String(url) },
      );
    }
    sessionTargetId = null;                 // it went away; a fresh one is legitimate
  }
  const created = await http(`/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (created && created.id) sessionTargetId = created.id;
  return created;
}

/**
 * The ONE tab this session shops in. Adopts a tab already on the right origin,
 * then a blank one, and only creates a page when there is genuinely none.
 *
 * The adoption order matters for a supervised shop: if Warwick already has ASDA
 * open, the runner takes THAT tab rather than opening a second one beside it.
 */
async function sessionTab(url) {
  const pages = await pageTargets();

  if (sessionTargetId !== null) {
    const held = pages.find((t) => t.id === sessionTargetId);
    if (held) return held;
    sessionTargetId = null;                 // Chrome lost it - fall through and re-acquire
  }

  let origin = null;
  try { origin = new URL(String(url)).origin; } catch { origin = null; }

  const adopted = (origin && pages.find((t) => typeof t.url === 'string' && t.url.startsWith(origin)))
    || pages.find((t) => t.url === 'about:blank');
  if (adopted) { sessionTargetId = adopted.id; return adopted; }

  return createPageTarget(url);
}

/**
 * The session tab, connected and pointed at `url`. This is what replaced
 * "open a tab, wait, find it, connect" in actions.cjs and readTrolley.cjs -
 * the same four steps, minus the new tab.
 */
async function openShoppingTab(url, { waitMs = 10000 } = {}) {
  const tab = await sessionTab(url);
  let ws = tab.webSocketDebuggerUrl;
  if (!ws) {
    const found = (await pageTargets()).find((t) => t.id === tab.id);
    ws = found && found.webSocketDebuggerUrl;
  }
  if (!ws) throw new Error('the shopping tab has no websocket debugger url');

  const client = await connect(ws);
  await client.send('Page.enable');
  await client.send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, waitMs));
  await client.send('Runtime.enable');
  client.targetId = tab.id;
  return client;
}

/** Forget the session tab. For a finished run, and for the proofs. */
function releaseSessionTab() { sessionTargetId = null; }

/**
 * Refuse to drive a headless browser. Warwick must be able to see, and take
 * over, everything the runner does.
 */
async function assertVisibleBrowser() {
  const v = await version();
  const ua = String(v['User-Agent'] || '');
  if (/headless/i.test(ua) || /headless/i.test(String(v.Browser || ''))) {
    throw new Error(`refusing to drive a headless browser: ${v.Browser} / ${ua}`);
  }
  return v;
}

/**
 * Connect to a target's websocket. `send` rejects (rather than hanging forever)
 * if the socket closes or the call exceeds `timeoutMs` - a wedged CDP call must
 * never silently hold the trolley lease.
 */
async function connect(wsUrl, { timeoutMs = 30_000 } = {}) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('CDP websocket open timed out')), 15_000);
    ws.onopen = () => { clearTimeout(t); res(); };
    ws.onerror = (e) => { clearTimeout(t); rej(new Error('CDP websocket error: ' + (e && e.message ? e.message : 'unknown'))); };
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  let closed = null;

  const fail = (why) => {
    closed = why;
    for (const [, p] of pending) p.rej(new Error(why));
    pending.clear();
  };
  ws.onclose = () => fail('CDP websocket closed');
  ws.onerror = () => fail('CDP websocket errored');
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); p.res(msg); return; }
    for (const fn of listeners) { try { fn(msg); } catch { /* a listener must never break the socket */ } }
  };

  const send = (method, params = {}) => new Promise((res, rej) => {
    if (closed) return rej(new Error(closed));
    const myId = ++id;
    const timer = setTimeout(() => { pending.delete(myId); rej(new Error(`CDP ${method} timed out after ${timeoutMs}ms`)); }, timeoutMs);
    pending.set(myId, { res: (v) => { clearTimeout(timer); res(v); }, rej: (e) => { clearTimeout(timer); rej(e); } });
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  return {
    send,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    get isClosed() { return closed !== null; },
    close: () => { try { ws.close(); } catch { /* already gone */ } },
  };
}

/**
 * Find the runner's own tab, or create it. ONE tab is reused for the whole
 * shop: it keeps Chrome tidy for Warwick, and it means "the tab the runner is
 * driving" is unambiguous when he takes over.
 */
async function reuseTab(matchUrlPrefix, fallbackUrl) {
  const pages = await pageTargets();
  const hit = pages.find((t) => typeof t.url === 'string' && t.url.startsWith(matchUrlPrefix));
  if (hit) { sessionTargetId = hit.id; return hit; }
  const blank = pages.find((t) => t.url === 'about:blank');
  if (blank) { sessionTargetId = blank.id; return blank; }
  return createPageTarget(fallbackUrl);
}

module.exports = {
  // `ENDPOINT` stays a readable value for logs and messages, but nothing routes
  // through it any more - see endpoint(), resolved at call time.
  get ENDPOINT() { return endpoint(); },
  targets,
  connect,
  closeTab,
  activate,
  version,
  assertVisibleBrowser,
  reuseTab,

  // THE ONLY WAYS TO GET A PAGE. `newTab` is deliberately absent: an exported
  // tab-creating primitive is a bypass of the one-tab invariant, and an
  // invariant with a documented bypass is a convention.
  sessionTab,
  openShoppingTab,
  releaseSessionTab,
  OneTabViolationError,

  // FOR THE PROOFS ONLY. oneTab.test.cjs asserts that no production file in
  // this folder references `_internal`, so this cannot quietly become a runtime
  // route back to the behaviour the guard exists to prevent.
  _internal: {
    setTransport: (fn) => { transport = typeof fn === 'function' ? fn : null; },
    setOneTabGuard: (on) => { oneTabGuard = on !== false; },
    heldTargetId: () => sessionTargetId,
    createPageTarget,
  },
};
