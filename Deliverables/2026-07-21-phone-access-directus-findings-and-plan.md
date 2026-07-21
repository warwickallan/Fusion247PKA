# Phone access for the live cockpit — findings + plan (Directus, not mypka-cockpit)

_2026-07-21. Warwick's directive: "first establish whether the existing mypka-cockpit is actually
in the Directus access path — it must not be assumed. Prefer exposing Directus separately using its
own authentication and a private secure route. Keep the vulnerable old cockpit localhost-only and log
CRIT-1 as a separate repair. Do not turn it into today's build unless it demonstrably blocks Directus."_

## Finding 1 — mypka-cockpit is NOT in the Directus access path (established, not assumed)
Evidence gathered on this machine:
- Directus runs as its **own** process bound directly to `127.0.0.1:8074` (`HOST=127.0.0.1`,
  `PORT=8074`, `PUBLIC_URL=http://127.0.0.1:8074`). The only listener on 8074 is Directus (pid 9892).
- `mypka-cockpit` is **not running** and nothing proxies 8074. The request path is
  browser → Directus → Postgres; `mypka-cockpit` is nowhere in it.
- Directus enforces its **own** authentication: unauthenticated `GET /items/regulars` and
  `/items/command_request` both return **403** (default-deny; the public role has no permissions).
  Directus does **not** rely on any loopback-trust convenience.

**Therefore CRIT-1 does not affect exposing Directus.** CRIT-1 is a loopback-PIN bypass in
`mypka-cockpit/server/server.js` (Host-header trust). Directus is a separate stack with real
session auth, so exposing Directus over a private route does not inherit that flaw.

## Finding 2 — the real remaining blocker is the private route, not security debt
The private-route tool is **not installed** (`tailscale` CLI absent; no `C:\Program Files\Tailscale`).
So the gap to the S21 is: (a) stand up a private secure route, which needs Warwick's hands (an
interactive `tailscale up` login — I can't and shouldn't create accounts / authenticate), and
(b) a bounded, Directus-specific pre-exposure hardening pass. That's it — no CRIT-1 dependency.

## Plan — expose Directus separately, on its own auth + a private route
**Route (Warwick's hands):** install Tailscale, `tailscale up` (his login), then
`tailscale serve https / http://127.0.0.1:8074` — a private HTTPS route on the tailnet only, no
public internet (do NOT use `tailscale funnel`). Cloudflare Tunnel is an equivalent alternative.

**Directus pre-exposure gates (my hands, at the exposure moment — several change local behaviour so
they are applied WHEN we expose, not before, or they'd break the localhost-http login):**
- `PUBLIC_URL` = the exact tailnet HTTPS URL (stop trusting Host/X-Forwarded).
- Secure + SameSite cookies (needs HTTPS — hence applied at exposure, not on localhost http).
- Enable the login rate limiter (`RATE_LIMITER_ENABLED=true`) — Directus has none by default.
- Confirm the Directus **public** (anonymous) role has **zero** permissions (403 evidence above
  already indicates this; re-verify before exposing).
- Only the one HTTPS route is exposed; the Postgres connection stays outbound to the pooler (no DB
  port served).
- Then: open it on the S21, sign in with a real Directus session, inspect real state, do one
  authorised AsdAIr write (the seam already proven).

**Confirmation gate:** putting real household data on the tailnet is a live, outward step — I'll do
the gates and ask for the explicit go at that moment, rather than flip it silently.

## CRIT-1 — logged as a SEPARATE repair (not today's build)
- **What:** `mypka-cockpit` `server/server.js:185-197` decides "trusted local" from the Host header;
  behind a loopback-fronting proxy that is bypassable. Full detail + PoC in the off-repo review
  `C:\.fusion247\security\2026-07-21-build-014-wp-d-security-review.md` (kept off the public repo).
- **Containment now:** `mypka-cockpit` stays **localhost-only** (never exposed off `127.0.0.1`),
  which fully neutralises CRIT-1 in the meantime. It is not in the Directus path, so it does not
  block phone access.
- **Repair (separate task):** require a valid session unconditionally on all `/api` data routes
  whenever any `X-Forwarded-*` header is present; derive `selfOrigin` from config, not the request.
  To be scheduled on its own, independent of the cockpit build.
