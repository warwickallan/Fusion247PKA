// Honcho client (v3) — the Warwick lens source (read) and the Context Outbox target (write).
import { secrets } from '../config.mjs';

const BASE = 'https://api.honcho.dev/v3';
const WS = secrets.honchoWorkspace || 'Fusion247';
const H = { Authorization: `Bearer ${secrets.honchoKey}`, 'Content-Type': 'application/json' };

async function jf(path, opts = {}) {
  const r = await fetch(BASE + path, { headers: H, ...opts });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`honcho ${opts.method || 'GET'} ${path} -> ${r.status}: ${t.slice(0, 300)}`);
  }
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : r.text();
}

export const honcho = {
  workspace: WS,
  async ensureWorkspace() { return jf('/workspaces', { method: 'POST', body: JSON.stringify({ id: WS }) }); },
  async ensurePeer(id) { return jf(`/workspaces/${WS}/peers`, { method: 'POST', body: JSON.stringify({ id }) }); },
  async ensureSession(id, peers = []) {
    const body = { id };
    if (peers.length) body.peers = Object.fromEntries(peers.map((p) => [p, {}]));
    return jf(`/workspaces/${WS}/sessions`, { method: 'POST', body: JSON.stringify(body) });
  },
  // Write context: add one message authored by a peer to a session. Honcho builds the peer rep.
  async addMessage(sessionId, peerId, content, metadata = {}) {
    return jf(`/workspaces/${WS}/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ messages: [{ content, peer_id: peerId, metadata }] }),
    });
  },
  // Read (dialectic): natural-language question about the peer.
  async chat(peerId, query, { sessionId } = {}) {
    const body = { query };
    if (sessionId) body.session_id = sessionId;
    return jf(`/workspaces/${WS}/peers/${peerId}/chat`, { method: 'POST', body: JSON.stringify(body) });
  },
  // Read (structured): the peer's representation / conclusions.
  async representation(peerId, { searchQuery, sessionId, maxConclusions = 30 } = {}) {
    const body = { max_conclusions: maxConclusions };
    if (searchQuery) body.search_query = searchQuery;
    if (sessionId) body.session_id = sessionId;
    return jf(`/workspaces/${WS}/peers/${peerId}/representation`, { method: 'POST', body: JSON.stringify(body) });
  },
};

export const PEER_WARWICK = 'warwick';
export const SESSION_CONTEXT = 'obsidiwikai-context';
