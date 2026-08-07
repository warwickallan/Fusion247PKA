// Fusion247 Cockpit — the /private-api bridge for private app APIs that bind loopback only, and the
// ORIGIN BOUNDARY that decides which requests may use it.
//
// ── WHY THIS IS ITS OWN MODULE ───────────────────────────────────────────────────────────────────
// This was the last live-facing handler still living inside `server.mjs`, and `server.mjs` imports
// `db.mjs`, which opens two production pools at module scope. A gate therefore could not execute this
// code at all — not "was not executed", COULD NOT BE. `static.mjs`, `provenance.mjs`,
// `rotation-report.mjs` and `down-reason.mjs` were each extracted for exactly that reason, and this
// file is the same move for the same reason. It imports node builtins and `down-reason.mjs` only: no
// database, no credentials, no dependency tree, nothing that needs installing. That is what lets
// `services/cockpit/origin-boundary-check.mjs` boot the real handler against a recording fake
// upstream and assert what the upstream did — and did not — receive.
//
// ── THE PROPERTY THIS FILE HOLDS ─────────────────────────────────────────────────────────────────
// A request whose `Origin` is not this host is refused with 403 BEFORE its body is read and BEFORE
// anything is sent upstream, and no cross-origin read permission is ever granted in a response
// header.
//
// The refusal is on the REQUEST, and that is the whole design. A response header can only govern
// whether a page is permitted to READ what has already happened; it cannot un-send the request. A
// request that is never required to ask permission in advance would therefore reach the upstream and
// take effect whatever the response said afterwards. So the decision has to be made on the way in,
// before a body is buffered and before `fetch()` is called, and it is made for every method equally.
//
// ── HOW AN ORIGIN IS JUDGED, AND WHY IT IS NOT CONFIGURED BY NAME ────────────────────────────────
//   * No `Origin` header  → the METHOD decides; see the next section.
//   * `Origin` present    → its host:port must equal the request's own `Host`. Same host, same
//     answer, whatever that host is called today. No hostname literal is compiled in, so this
//     follows the Cockpit to a new address without an edit — naming today's host in config would
//     only move the problem to the next rename.
//   * `COCKPIT_ALLOWED_ORIGINS` — OPTIONAL, ADDITIVE, EMPTY BY DEFAULT. The escape hatch for a
//     terminator that does not preserve `Host` (the Cockpit is fronted by `tailscale serve`, and
//     whether it preserves `Host` is not established here). Empty default keeps the safe path safe;
//     Mack owns the value if the live path ever needs one, this module owns only its shape.
//
// A residual is recorded rather than built for: a hostile name that resolves to this host would
// present a matching `Origin`. Proportionate at this risk level, and out of scope by ruling.
//
// ── WHEN NO `Origin` ARRIVES, THE METHOD DECIDES ─────────────────────────────────────────────────
// Browsers omit `Origin` on same-origin safe requests and on ordinary navigation, and non-browser
// callers omit it too. This handler used to forward every one of those, on the reasoning that a
// browser attaches `Origin` to anything unsafe — which is true as far as it goes, and is a property
// of the CLIENT. A server control that holds only because the caller volunteers a header is not
// enforcing the property; it is trusting someone else to. So the server decides for itself:
//
//   a SAFE method with no `Origin`  → FORWARD, exactly as before.
//   anything else with no `Origin`  → 403, before the body is read and before any forward.
//
// SAFE_METHODS is an ALLOWLIST, not a list of the common write verbs, and that is the whole point:
// an unknown or extension method carries no promise of being safe, so the unknown FAILS CLOSED. A
// denylist would have covered the named verbs and left every other unsafe method forwarding a body.
//
// The safe half is deliberately unchanged. A cross-site request in a browser's safe shape carries no
// `Origin` and is still forwarded; that is an accepted, recorded contingency, and this guard is not
// authority to close it. `COCKPIT_ALLOWED_ORIGINS` cannot widen the unsafe case either — a request
// with no `Origin` matches no entry in any allowlist, so there is nothing to configure here.
//
// One operational consequence, recorded because it inverts: a terminator in front of this server
// that did not preserve `Origin` used to be harmless — the request simply arrived without one and
// was forwarded. It now turns a legitimate browser write into a 403. What a browser EMITS and what
// ARRIVES after a proxy hop are different facts, and only the second is readable here.
import { Readable } from 'node:stream';
import { whyDown } from './down-reason.mjs';

export const PRIVATE_API_PREFIX = '/private-api';

/**
 * Parse the optional additive allowlist. Returns the normalised origins AND a warning for every
 * entry that could not be parsed, because a security control whose configuration silently discards
 * what it was given is a control nobody can tell is switched off. The caller says the warnings out
 * loud at startup; nothing here logs on its own.
 */
export function parseAllowedOrigins(raw) {
  const allowed = [];
  const warnings = [];
  for (const entry of String(raw || '').split(/[\s,]+/)) {
    const e = entry.trim();
    if (!e) continue;
    let normalised = null;
    try { const u = new URL(e); normalised = u.origin.toLowerCase(); } catch { normalised = null; }
    if (normalised === null || normalised === 'null') {
      warnings.push(`COCKPIT_ALLOWED_ORIGINS entry ignored — not a usable origin: ${e}`);
      continue;
    }
    if (!allowed.includes(normalised)) allowed.push(normalised);
  }
  return { allowed, warnings };
}

/**
 * The decision, as a pure function of what arrived. Returns `{ allowed, reason }` — the reason is
 * for the gate and the log, never for the response body: a refusal tells the caller nothing about
 * why, because the caller is not owed the shape of the boundary.
 */
export function originDecision({ origin, host, allowed = [] }) {
  if (origin === undefined || origin === null || origin === '') return { allowed: true, reason: 'no-origin' };
  const raw = String(origin).trim();
  // A browser sends the literal `null` from an opaque origin — a sandboxed frame, a data: URL, a
  // local file. It is emphatically not this host, and treating it as one would make the boundary
  // bypassable by construction.
  if (raw.toLowerCase() === 'null') return { allowed: false, reason: 'opaque-origin' };
  let u;
  try { u = new URL(raw); } catch { return { allowed: false, reason: 'unparseable-origin' }; }
  if (!u.host) return { allowed: false, reason: 'unparseable-origin' };
  const h = String(host || '').trim().toLowerCase();
  if (h && u.host.toLowerCase() === h) return { allowed: true, reason: 'same-host' };
  if (allowed.includes(u.origin.toLowerCase())) return { allowed: true, reason: 'allowlisted' };
  return { allowed: false, reason: 'foreign-origin' };
}

/**
 * The HTTP-safe methods (RFC 9110 §9.2.1) — the CLOSED set this bridge forwards when a request never
 * identified its origin. Membership is the only way past that case; there is no denylist to be
 * incomplete, and no configuration that can extend this set.
 */
export const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** Membership in that closed set. An absent, blank or unrecognised method is not a member. */
export function isSafeMethod(method) {
  return SAFE_METHODS.includes(String(method || '').trim().toUpperCase());
}

/**
 * The decision the server actually acts on: `originDecision()` composed with the rule that an unsafe
 * method must identify its origin. ONE implementation, called by the handler below and by the gate's
 * mutation fixtures, so a second copy of the policy cannot drift away from this one.
 *
 * `originDecision()` is deliberately left exactly as it was — a pure function of the origin alone,
 * with its own proofs — rather than growing a `method` parameter that would need a default. A
 * default of "safe" inside a security control is a fail-open, and fail-open-by-default is the shape
 * of defect this function exists to remove. So the composition is explicit, and a call that supplies
 * no method at all fails CLOSED rather than inheriting a permissive assumption.
 *
 * The method is consulted ONLY in the no-origin case. A request that did identify its origin is
 * judged on that origin for every method equally, exactly as before.
 */
export function boundaryDecision({ method, origin, host, allowed = [] }) {
  const decision = originDecision({ origin, host, allowed });
  if (!decision.allowed || decision.reason !== 'no-origin') return decision;
  return isSafeMethod(method)
    ? { allowed: true, reason: 'no-origin-safe-method' }
    : { allowed: false, reason: 'no-origin-unsafe-method' };
}

/**
 * The serving context, built by ONE constructor from the environment — the same shape as
 * `staticCtx` in static.mjs, and for the same reason: the call site where the pieces could be
 * assembled wrongly does not exist.
 */
export function privateApiCtx(env = process.env) {
  const { allowed, warnings } = parseAllowedOrigins(env.COCKPIT_ALLOWED_ORIGINS);
  return {
    upstream: String(env.COCKPIT_PRIVATE_API || '').replace(/\/$/, ''),
    allowed,
    configWarnings: warnings,
  };
}

const refuse = (res, code, text) => {
  // `vary: Origin` on every answer this handler gives: the answer genuinely depends on the request
  // origin now, so a cache that ignored it would serve one caller's answer to another.
  res.writeHead(code, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    vary: 'Origin',
  });
  res.end(text);
};

/**
 * Forward a private-app API call to the configured upstream — after, and only after, the origin
 * boundary has allowed it.
 *
 * OPT-IN: absent `COCKPIT_PRIVATE_API` this is not a route at all (404, and no CORS header of any
 * kind). Strips the prefix and forwards method/body/selected headers. No app name lives here —
 * private apps own their upstream paths. Cookies and authorization headers are never forwarded; the
 * upstream's `location` is never forwarded; redirects are not followed.
 */
export async function servePrivateApi(req, res, ctx) {
  if (!ctx.upstream) { refuse(res, 404, 'private API bridge is not configured'); return; }

  const incoming = new URL(req.url || '/', 'http://x');
  if (!incoming.pathname.startsWith(PRIVATE_API_PREFIX)) { refuse(res, 404, 'not found'); return; }

  // ── THE BOUNDARY. Before the body is read. Before anything leaves this process. ────────────────
  // This line's position is load-bearing: the refusal happens ahead of the buffering loop below, so
  // a refused request's body is never read off the socket. The recording upstream in the gate can
  // only prove the non-forward; that the body was never read is this ordering, and nothing else.
  const decision = boundaryDecision({
    method: req.method, origin: req.headers.origin, host: req.headers.host, allowed: ctx.allowed,
  });
  if (!decision.allowed) { refuse(res, 403, 'private API bridge: refused'); return; }

  const rest = incoming.pathname.slice(PRIVATE_API_PREFIX.length) || '/';
  // Containment: only an absolute path on the configured origin; reject protocol-relative or host
  // injection.
  if (!rest.startsWith('/') || rest.startsWith('//')) { refuse(res, 400, 'bad private API path'); return; }

  const target = ctx.upstream + rest + incoming.search;
  try {
    const headers = { accept: req.headers.accept || '*/*' };
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    // Buffer body for non-GET/HEAD/OPTIONS (private APIs are small JSON / form posts, not
    // multi-GB streams).
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const chunks = [];
      let n = 0;
      for await (const c of req) {
        n += c.length;
        if (n > 40 * 1024 * 1024) { refuse(res, 413, 'payload too large'); return; }
        chunks.push(c);
      }
      body = Buffer.concat(chunks);
    }
    // OPTIONS is forwarded like any other method. This handler no longer answers a preflight on the
    // upstream's behalf: it has never asked the upstream what it permits, so it is not in a position
    // to say. An allowed OPTIONS is the upstream's question to answer; a refused one never gets here.
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
      redirect: 'manual',
    });
    const outHeaders = {
      'cache-control': upstream.headers.get('cache-control') || 'no-store',
      vary: 'Origin',
    };
    const ct = upstream.headers.get('content-type');
    if (ct) outHeaders['content-type'] = ct;
    const cd = upstream.headers.get('content-disposition');
    if (cd) outHeaders['content-disposition'] = cd;
    // NO `access-control-allow-origin` is emitted, for anyone. This bridge exists for a same-origin
    // surface, so no page ever needs cross-origin permission to read it, and granting one is the
    // read half of the boundary this file holds.
    if (!upstream.body) { res.writeHead(upstream.status, outHeaders); res.end(); return; }
    res.writeHead(upstream.status, outHeaders);
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin' });
    res.end(JSON.stringify({ ok: false, error: `private API bridge failed — ${whyDown(e)}` }));
  }
}
