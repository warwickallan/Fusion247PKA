// BUILD-014 WP-D increment 1 — configure Directus access control (roles/policies/perms).
//
//   node wp-d-proof/configure-access.mjs    (Directus must be running)
//
// Creates a NON-PRIVILEGED "Cockpit Viewer" role whose policy grants READ on the synthetic
// shopping collections ONLY (lists + list_items) — and NOTHING on the Tower review log /
// verdicts, and no create/update/delete anywhere. This is the least-privilege cockpit user
// the adversarial permission test then tries (and fails) to exceed.
//
// Directus 11 access model: permissions attach to a POLICY; a POLICY attaches to a ROLE via
// directus_access; a USER gets a ROLE. Admin (super) access is a separate admin_access policy
// we deliberately do NOT give the viewer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RT = path.join(__dirname, '.runtime', 'runtime.json');
const rt = JSON.parse(fs.readFileSync(RT, 'utf8'));
const base = rt.directus.url;

async function api(method, url, token, body) {
  const r = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = null; try { d = await r.json(); } catch { /* no body */ }
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status}: ${JSON.stringify(d)?.slice(0, 300)}`);
  return d?.data;
}

const login = await api('POST', '/auth/login', null, { email: rt.directus.adminEmail, password: rt.directus.adminPassword });
const token = login.access_token;
console.log('[access] admin authenticated');

// Idempotency: remove a prior viewer role/policy/user if this is a re-run.
const roles = await api('GET', '/roles?filter[name][_eq]=Cockpit Viewer&fields=id,name', token);
for (const r of roles || []) await api('DELETE', `/roles/${r.id}`, token).catch(() => {});
const users = await api('GET', `/users?filter[email][_eq]=${encodeURIComponent(rt.directus.viewerEmail)}&fields=id`, token);
for (const u of users || []) await api('DELETE', `/users/${u.id}`, token).catch(() => {});
const pols = await api('GET', '/policies?filter[name][_eq]=Cockpit Viewer Policy&fields=id', token);
for (const p of pols || []) await api('DELETE', `/policies/${p.id}`, token).catch(() => {});

// 1) Non-admin policy (app access so the user can authenticate + use the API; NOT admin).
const policy = await api('POST', '/policies', token, {
  name: 'Cockpit Viewer Policy',
  icon: 'visibility',
  description: 'Least-privilege: read the synthetic shopping lists only.',
  app_access: true,
  admin_access: false,
  enforce_tfa: false,
});
console.log('[access] created policy', policy.id);

// 2) READ permissions on the shopping collections ONLY. Nothing on the Tower ledger.
for (const collection of ['lists', 'list_items']) {
  await api('POST', '/permissions', token, { policy: policy.id, collection, action: 'read', fields: ['*'] });
  console.log(`[access] granted read on ${collection}`);
}

// --- increment 2: the constrained WRITE-BACK, app-layer (field- and action-scoped) ---
// (a) THE constrained CRUD: the viewer may UPDATE only the `is_checked` field of
//     list_items and NOTHING else. Directus field-level permission enforces it; the
//     column-scoped GRANT in configure-db-roles.mjs enforces it again at the DB layer.
await api('POST', '/permissions', token, {
  policy: policy.id, collection: 'list_items', action: 'update', fields: ['is_checked'],
});
console.log('[access] granted UPDATE(is_checked) on list_items (check/uncheck ONLY)');

// (b) THE seam: the viewer may READ the queue, and may CREATE an INTENT row with only
//     the request fields. It may NOT set status/receipt (fields not permitted) and may
//     NOT update/delete the queue -> it can request, never execute.
await api('POST', '/permissions', token, { policy: policy.id, collection: 'command_request', action: 'read', fields: ['*'] });
await api('POST', '/permissions', token, {
  policy: policy.id, collection: 'command_request', action: 'create',
  fields: ['requested_by', 'command', 'args', 'idempotency_key'],
});
console.log('[access] granted READ + CREATE-intent(requested_by,command,args,idempotency_key) on command_request');

// (c) The viewer may READ the worker-computed metrics (read-only visibility).
await api('POST', '/permissions', token, { policy: policy.id, collection: 'cockpit_metric', action: 'read', fields: ['*'] });
console.log('[access] granted read on cockpit_metric');

// Deliberately NO permission rows for tower_review_log / tower_verdicts; NO update/delete
// on command_request; NO create/delete on list_items; NO write on cockpit_metric ->
// everything else is denied by Directus default-deny.

// 3) Role + attach the policy via directus_access.
const role = await api('POST', '/roles', token, { name: 'Cockpit Viewer', icon: 'visibility' });
await api('POST', '/access', token, { role: role.id, policy: policy.id });
console.log('[access] created role', role.id, 'and linked policy');

// 4) The non-privileged user.
const user = await api('POST', '/users', token, {
  email: rt.directus.viewerEmail,
  password: rt.directus.viewerPassword,
  role: role.id,
  status: 'active',
});
console.log('[access] created viewer user', user.id, `(${rt.directus.viewerEmail})`);

rt.directus.viewerRole = role.id;
rt.directus.viewerPolicy = policy.id;
fs.writeFileSync(RT, JSON.stringify(rt, null, 2));
console.log('[access] DONE. Non-privileged viewer can read shopping lists only.');
