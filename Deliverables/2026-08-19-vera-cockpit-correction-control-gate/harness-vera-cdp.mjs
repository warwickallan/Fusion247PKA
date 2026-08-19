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
  await send('Page.enable'); await send('Runtime.enable');
  return { send, close: () => { try { ws.close(); } catch {} proc.kill(); } };
}

export async function viewport(cdp, w, h, dark) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
}

export async function go(cdp, url, waitMs = 3500) {
  await cdp.send('Page.navigate', { url });
  await sleep(waitMs);
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
