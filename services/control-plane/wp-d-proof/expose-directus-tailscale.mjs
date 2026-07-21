// BUILD-014 — expose the LIVE Directus cockpit on the PRIVATE tailnet (S21 access).
//
//   node wp-d-proof/expose-directus-tailscale.mjs
//
// Hardens the Directus runtime for off-loopback exposure, restarts it, and puts it behind a
// tailnet-ONLY HTTPS route (tailscale serve — NEVER funnel, so no public internet). It does NOT
// route through mypka-cockpit (tailscale serve proxies straight to Directus on 127.0.0.1:8074).
//
// Hardening applied (Vex G2/G3/G5/G6):
//   PUBLIC_URL = the exact tailnet HTTPS URL (stop deriving origin from the Host header)
//   secure + SameSite cookies (the client sees HTTPS via tailscale)
//   rate limiter ENABLED (Directus ships with none)
//   (public/anon role has zero permissions — verified separately by the prove step: 403 unauth)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(here, 'directus', '.env');
const RT = path.join(here, '.runtime-live', 'runtime.json');
const TS = process.env.TAILSCALE_BIN || 'C:/Program Files/Tailscale/tailscale.exe';

// 1. Resolve the tailnet HTTPS URL for this node.
const statusJson = spawnSync(TS, ['status', '--json'], { encoding: 'utf8' });
if (statusJson.status !== 0) { console.error('[expose] tailscale not available:', statusJson.stderr); process.exit(1); }
const self = JSON.parse(statusJson.stdout).Self;
const dns = String(self.DNSName || '').replace(/\.$/, '');
if (!dns) { console.error('[expose] could not resolve tailnet DNS name'); process.exit(1); }
const PUBLIC_URL = `https://${dns}`;
console.log('[expose] tailnet URL:', PUBLIC_URL);

// 2. Patch directus/.env for exposure (idempotent: replace-or-append each key).
let env = fs.readFileSync(ENV, 'utf8');
const set = (k, v) => {
  const line = `${k}=${v}`;
  env = new RegExp(`^${k}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${k}=.*$`, 'm'), line) : env.trimEnd() + '\n' + line + '\n';
};
set('PUBLIC_URL', PUBLIC_URL);
set('SESSION_COOKIE_SECURE', 'true');
set('SESSION_COOKIE_SAME_SITE', 'lax');
set('REFRESH_TOKEN_COOKIE_SECURE', 'true');
set('REFRESH_TOKEN_COOKIE_SAME_SITE', 'lax');
set('RATE_LIMITER_ENABLED', 'true');
set('RATE_LIMITER_STORE', 'memory');
set('RATE_LIMITER_POINTS', '25');
set('RATE_LIMITER_DURATION', '1');
fs.writeFileSync(ENV, env);
// Record the public URL in runtime.json for the prove step.
const rt = JSON.parse(fs.readFileSync(RT, 'utf8'));
rt.directus.publicUrl = PUBLIC_URL;
fs.writeFileSync(RT, JSON.stringify(rt, null, 2));
console.log('[expose] hardened directus/.env (PUBLIC_URL, secure cookies, rate limiter)');

// 3. Restart Directus so the new config takes effect.
console.log('[expose] restarting Directus…');
spawnSync(process.execPath, [path.join(here, 'stop-live.mjs')], { stdio: 'inherit' });
spawnSync(process.execPath, [path.join(here, 'start-directus-live.mjs')], { stdio: 'inherit' });

// 4. Put it behind the tailnet-only HTTPS route (background). NEVER funnel.
const port = rt.directus.port;
console.log(`[expose] tailscale serve --bg ${port} (tailnet HTTPS only)…`);
const serve = spawnSync(TS, ['serve', '--bg', String(port)], { encoding: 'utf8' });
process.stdout.write(serve.stdout || ''); process.stderr.write(serve.stderr || '');
if (serve.status !== 0) {
  console.error('\n[expose] tailscale serve failed. If it needs HTTPS certificates enabled for the');
  console.error('[expose] tailnet, enable "HTTPS Certificates" in the Tailscale admin console (one-time), then re-run.');
  process.exit(1);
}
console.log(`\n[expose] DONE. Private phone URL (tailnet only): ${PUBLIC_URL}`);
console.log('[expose] Next: node wp-d-proof/prove-tailscale-access.mjs');
