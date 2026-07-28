// BUILD-015 - minimal CDP client. NO Claude Code, NO MCP, NO extension.
// Proves an independent process can drive an authenticated Chrome session.
'use strict';
async function targets() {
  const r = await fetch('http://127.0.0.1:9222/json/list');
  return r.json();
}
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const myId = ++id; pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  return { send, close: () => ws.close() };
}
async function newTab(url) {
  const r = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return r.json();
}
module.exports = { targets, connect, newTab };
