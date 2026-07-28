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
// Surface kept backwards-compatible for actions.cjs / readTrolley.cjs:
//   targets(), connect(wsUrl), newTab(url)
// Added for the runner: version(), closeTab(), activate(), reuseTab().
// =====================================================================
'use strict';

const ENDPOINT = process.env.ASDAIR_CDP_ENDPOINT || 'http://127.0.0.1:9222';

async function http(pathname, init) {
  const r = await fetch(`${ENDPOINT}${pathname}`, init);
  if (!r.ok) throw new Error(`CDP ${pathname} -> HTTP ${r.status}`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function version() { return http('/json/version'); }
async function targets() { return http('/json/list'); }
async function newTab(url) { return http(`/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); }
async function closeTab(id) { return http(`/json/close/${id}`); }
async function activate(id) { return http(`/json/activate/${id}`); }

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
  const pages = (await targets()).filter((t) => t.type === 'page');
  const hit = pages.find((t) => typeof t.url === 'string' && t.url.startsWith(matchUrlPrefix));
  if (hit) return hit;
  const blank = pages.find((t) => t.url === 'about:blank');
  if (blank) return blank;
  return newTab(fallbackUrl);
}

module.exports = { ENDPOINT, targets, connect, newTab, closeTab, activate, version, assertVisibleBrowser, reuseTab };
