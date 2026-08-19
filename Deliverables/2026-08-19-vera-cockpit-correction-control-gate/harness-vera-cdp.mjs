// VERA — headless Edge over CDP. Screenshots + computed-style probes at real breakpoints,
// both colour schemes. No dependencies: Node 22 global WebSocket.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = process.env.EDGE_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9223;
const OUT  = 'C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/736e76e6-1682-4c84-97a0-acc90d1abe3a/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function launch() {
  const profile = path.join(OUT, '..', 'edge-profile-vera');
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'],
    { stdio: 'ignore', detached: false });
  let list = null;
  for (let i = 0; i < 60; i++) {
    try { list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
          if (list.some(t => t.type === 'page')) break; } catch {}
    await sleep(250);
  }
  if (!list) throw new Error('edge did not expose CDP');
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  // ⛔ THE COCKPIT SHIPS A CACHE-FIRST SERVICE WORKER (sw.js). A persistent browser profile will
  // execute a STALE app.js and the fix under inspection will appear never to have landed. This
  // cost one nearly-reported false FAIL on 2026-08-19. Bypass is not optional in a QA harness.
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.setBypassServiceWorker', { bypass: true });
  return { send, close: () => { try { ws.close(); } catch {} proc.kill(); } };
}

export async function viewport(cdp, w, h, dark) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
}

export async function go(cdp, url, waitMs = 3500) {
  await cdp.send('Page.navigate', { url });
  await sleep(1200);
  // Belt and braces: tear down any registration/cache this origin already installed, then reload.
  try {
    await cdp.send('Runtime.evaluate', { awaitPromise: true, expression:
      "(async function(){ if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); for (const r of rs) await r.unregister(); } if (window.caches) { const ks = await caches.keys(); for (const k of ks) await caches.delete(k); } return 1; })()" });
  } catch {}
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await sleep(200);
  await cdp.send('Page.navigate', { url });
  await sleep(waitMs);
}

/** Proves WHICH bytes executed. Never trust a render without it. */
export async function assertFreshBundle(cdp, marker) {
  const r = await cdp.send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression:
    "fetch('/app.js',{cache:'reload'}).then(t=>t.text()).then(t=>t.indexOf(" + JSON.stringify(marker) + ")>=0)" });
  if (r.result.value !== true) throw new Error('STALE BUNDLE: marker not found: ' + marker);
  return true;
}

export async function evalJs(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

export async function shot(cdp, name, full) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!full });
  const f = path.join(OUT, name + '.png');
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
}
