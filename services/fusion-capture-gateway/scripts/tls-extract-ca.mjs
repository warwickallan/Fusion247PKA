// FU-1 — extract the CA chain PRESENTED by the live Supabase session pooler
// and write the non-leaf certificates to certs/supabase-pooler-ca.pem.
//
// TOFU CAVEAT (must stay documented): this observes the chain from a LIVE
// handshake — trust-on-first-use. The extracted pin MUST be cross-checked
// against the dashboard-downloadable CA (Supabase Dashboard → Database →
// Settings → SSL Configuration, file prod-ca-2021.crt) before it is treated
// as verified — that cross-check is a named morning action in
// wp1-safe-cutover.md. (The historical direct download URL 404s — Pax Q5.)
//
// WHY THE HANDSHAKE IS DELIBERATELY UNVERIFIED *HERE AND ONLY HERE*: you
// cannot read an as-yet-unpinned chain through a verifying handshake — the
// verification material is exactly what this script exists to obtain. The
// script sends NO query, transfers NO data, and never prints a secret; it
// performs the Postgres SSLRequest preamble, completes the TLS handshake,
// records the presented certificates, and disconnects. It is excluded BY NAME
// from the rejectUnauthorized static gate (test/tlsTransportGuards.test.js)
// with this rationale; every runtime path remains gate-covered.
//
// RUN (never echoes the DSN; use --env-file so the value never enters argv):
//   node --env-file=C:\.fusion247\fusion-capture-gateway.env scripts/tls-extract-ca.mjs
//
// Output: masked JSON chain summary on stdout + the PEM written to certs/.

import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const OUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'certs', 'supabase-pooler-ca.pem',
);

const dsn = process.env.DATABASE_URL;
if (!dsn) {
  console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL not set (use --env-file)' }));
  process.exit(1);
}
let host; let port;
try {
  const url = new URL(dsn);
  host = url.hostname;
  port = Number(url.port || 5432);
} catch {
  console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL is not URL-shaped; cannot parse host' }));
  process.exit(1);
}

const pemFromDer = (der) => `-----BEGIN CERTIFICATE-----\n${der.toString('base64').replace(/(.{64})/g, '$1\n').trim()}\n-----END CERTIFICATE-----\n`;
const fp = (der) => createHash('sha256').update(der).digest('hex');

const socket = net.connect({ host, port }, () => {
  // Postgres SSLRequest: int32 length=8, int32 code=80877103.
  const req = Buffer.alloc(8);
  req.writeInt32BE(8, 0);
  req.writeInt32BE(80877103, 4);
  socket.write(req);
});
socket.setTimeout(15000, () => { console.error(JSON.stringify({ ok: false, error: 'tcp timeout' })); process.exit(1); });

socket.once('data', (byte) => {
  if (byte.toString('utf8', 0, 1) !== 'S') {
    console.error(JSON.stringify({ ok: false, error: 'server refused SSL (no S byte)' }));
    process.exit(1);
  }
  const tlsSocket = tls.connect(
    {
      socket,
      servername: host,
      // TOFU extraction only — see the header. NO data flows on this socket.
      rejectUnauthorized: false,
    },
    () => {
      const chain = [];
      for (let cert = tlsSocket.getPeerCertificate(true), seen = new Set(); cert && cert.raw && !seen.has(fp(cert.raw));) {
        seen.add(fp(cert.raw));
        chain.push(cert);
        cert = cert.issuerCertificate;
      }
      const summary = chain.map((c) => ({
        subject_cn: c.subject?.CN ?? null,
        issuer_cn: c.issuer?.CN ?? null,
        self_signed: JSON.stringify(c.subject) === JSON.stringify(c.issuer),
        valid_from: c.valid_from,
        valid_to: c.valid_to,
        sha256_fingerprint: fp(c.raw),
      }));
      // Pin every NON-LEAF cert (intermediates + root) — the verify path needs
      // the chain up to a trust anchor; the leaf rotates freely underneath.
      const caCerts = chain.slice(1);
      if (caCerts.length === 0) {
        console.error(JSON.stringify({ ok: false, error: 'no CA certificates in presented chain', chain: summary }));
        process.exit(1);
      }
      const header = [
        '# supabase-pooler-ca.pem — pinned CA chain for the Supabase SESSION POOLER',
        `# (FU-1). PUBLIC certificates only — not a secret.`,
        `# PROVENANCE (TOFU): extracted from the live TLS handshake to`,
        `# ${host}:${port} on ${new Date().toISOString()} by scripts/tls-extract-ca.mjs.`,
        '# CROSS-CHECK REQUIRED before full trust: compare against the dashboard',
        '# CA download (Database → Settings → SSL Configuration, prod-ca-2021.crt)',
        '# — tracked as a WP1 morning action in wp1-safe-cutover.md.',
        ...summary.slice(1).map((c, i) => `# cert ${i + 1}: subject CN "${c.subject_cn}", issuer CN "${c.issuer_cn}", valid_to ${c.valid_to}, sha256 ${c.sha256_fingerprint}`),
        '',
      ].join('\n');
      fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
      fs.writeFileSync(OUT_PATH, header + caCerts.map((c) => pemFromDer(c.raw)).join(''));
      console.log(JSON.stringify({
        ok: true,
        pooler_host: host,
        pooler_port: port,
        chain: summary,
        pinned_certs: caCerts.length,
        written_to: path.relative(process.cwd(), OUT_PATH),
      }, null, 2));
      tlsSocket.end();
      process.exit(0);
    },
  );
  tlsSocket.on('error', (err) => {
    console.error(JSON.stringify({ ok: false, error: `tls: ${err.code ?? err.message}` }));
    process.exit(1);
  });
});
socket.on('error', (err) => {
  console.error(JSON.stringify({ ok: false, error: `tcp: ${err.code ?? err.message}` }));
  process.exit(1);
});
