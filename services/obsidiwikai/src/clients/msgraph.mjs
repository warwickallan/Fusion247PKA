// Microsoft Graph client — delegated Mail.Read for the dedicated Fusion247 mailbox.
// Two auth modes: device-code (one-time authorise) and refresh-token (the daemon poller).
// Personal-account refresh tokens ROTATE on use, so we persist them server-side (oauth_token).
// This client is a thin transport: token management + the few REST calls the email adapter needs.
// It contains NO routing/classification logic.
import { q } from './db.mjs';

const TENANT = process.env.MS_GRAPH_TENANT || 'consumers'; // personal Microsoft accounts
const CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID;
const SCOPE = process.env.MS_GRAPH_SCOPE || 'offline_access Mail.Read';
const MAILBOX = process.env.MS_GRAPH_MAILBOX || 'me';
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const GRAPH = 'https://graph.microsoft.com/v1.0';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- token store (Supabase, service-role gated) ----
async function loadToken() {
  const r = await q('select * from obsidiwikai.oauth_token where provider=$1', ['msgraph']);
  return r.rows[0] || null;
}
async function saveToken({ refresh_token, access_token, expires_in, scope }) {
  const expiresAt = new Date(Date.now() + (Number(expires_in || 3600) - 120) * 1000).toISOString();
  await q(
    `insert into obsidiwikai.oauth_token(provider,refresh_token,access_token,expires_at,scope,account,updated_at)
     values('msgraph',$1,$2,$3,$4,$5,now())
     on conflict (provider) do update set
       refresh_token=coalesce(excluded.refresh_token, obsidiwikai.oauth_token.refresh_token),
       access_token=excluded.access_token, expires_at=excluded.expires_at,
       scope=excluded.scope, account=excluded.account, updated_at=now()`,
    [refresh_token || null, access_token, expiresAt, scope || SCOPE, MAILBOX]
  );
}

async function tokenPost(params) {
  const r = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`msgraph token ${r.status}: ${j.error || ''} ${j.error_description || ''}`.slice(0, 300));
  return j;
}

// Valid access token, refreshing (and persisting the rotated refresh token) when needed.
export async function accessToken() {
  if (!CLIENT_ID) throw new Error('MS_GRAPH_CLIENT_ID not set — register the app + run email-authorize first');
  const tok = await loadToken();
  if (!tok || !tok.refresh_token) throw new Error('msgraph: not authorised — run src/bin/email-authorize.mjs once');
  if (tok.access_token && tok.expires_at && new Date(tok.expires_at) > new Date()) return tok.access_token;
  const j = await tokenPost({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: tok.refresh_token, scope: SCOPE });
  await saveToken(j);
  return j.access_token;
}

async function graphGet(url) {
  const abs = url.startsWith('http') ? url : GRAPH + url;
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = await accessToken();
    const r = await fetch(abs, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 429 || r.status >= 500) { await sleep(1000 * (attempt + 1) + Number(r.headers.get('retry-after') || 0) * 1000); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`msgraph GET ${abs.slice(0, 80)} -> ${r.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`);
    return j;
  }
  throw new Error('msgraph GET exhausted retries: ' + abs.slice(0, 80));
}

const SELECT = '$select=id,internetMessageId,subject,from,toRecipients,receivedDateTime,hasAttachments,bodyPreview';

// The Graph surface the email adapter consumes. Delta gives change signals; getMessage gives full body.
export const graph = {
  mailbox: MAILBOX,
  // One delta page. `link` = a stored deltaLink/nextLink to resume; null = start a fresh delta.
  async deltaPage(link) {
    const j = await graphGet(link || `/me/mailFolders/Inbox/messages/delta?${SELECT}`);
    return { messages: j.value || [], nextLink: j['@odata.nextLink'] || null, deltaLink: j['@odata.deltaLink'] || null };
  },
  async getMessage(id) {
    return graphGet(`/me/messages/${encodeURIComponent(id)}?$select=id,internetMessageId,subject,from,toRecipients,receivedDateTime,hasAttachments,body`);
  },
  async listAttachments(id) {
    const j = await graphGet(`/me/messages/${encodeURIComponent(id)}/attachments`);
    return j.value || [];
  },
};

// ---- device-code flow (one-time authorise) ----
export async function startDeviceCode() {
  if (!CLIENT_ID) throw new Error('MS_GRAPH_CLIENT_ID not set');
  const r = await fetch(`${AUTH_BASE}/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE }).toString(),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`devicecode ${r.status}: ${j.error_description || j.error}`);
  return j; // { user_code, verification_uri, device_code, interval, expires_in, message }
}

export async function pollDeviceCode(deviceCode, interval = 5) {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep((interval + 1) * 1000);
    try {
      const j = await tokenPost({ client_id: CLIENT_ID, grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCode });
      await saveToken(j);
      return j;
    } catch (e) {
      if (/authorization_pending|slow_down/.test(String(e.message))) continue;
      throw e;
    }
  }
  throw new Error('device-code authorisation timed out');
}

export const config = { TENANT, CLIENT_ID, SCOPE, MAILBOX };
