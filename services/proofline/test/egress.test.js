// T-9 — G-10, and the honest label that goes with it.
//
// "Zero network egress" is a NEGATIVE claim. Nothing here proves it: proving it
// would need a network namespace or a packet capture around a running process
// over its whole life, which is not what this suite is. What IS proven is
// narrower and still worth having:
//
//   - no HTTP/HTTPS client, `fetch`, DNS lookup or outbound socket connect
//     appears anywhere in the service's own source;
//   - the service declares no npm dependencies at all, so no third party's
//     code is running inside it;
//   - the listening socket is bound to 127.0.0.1 at RUNTIME, asserted from the
//     socket itself rather than from the source;
//   - the browser bundle addresses only same-origin relative paths.
//
// Read that as a STATIC assertion plus a runtime bind check. It is a limitation
// reported, not a proof of the absence of egress.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { HOST } from '../src/config.mjs';
import { mkTempDir, rmTempDir, startApp, SERVICE_DIR, killAllChildren } from './helpers/harness.mjs';

after(() => killAllChildren());

function sourceFiles() {
  const out = [];
  for (const dir of ['src', 'bin']) {
    const full = path.join(SERVICE_DIR, dir);
    for (const name of fs.readdirSync(full)) {
      if (/\.(mjs|js|cjs)$/.test(name)) out.push({ rel: `${dir}/${name}`, text: fs.readFileSync(path.join(full, name), 'utf8') });
    }
  }
  return out;
}

const FORBIDDEN = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/['"]node:https['"]|['"]https['"]/, "an https module import"],
  [/['"]node:dns['"]|['"]dns\/promises['"]/, 'a dns module import'],
  [/['"]node:net['"]|['"]node:tls['"]/, 'a net/tls module import'],
  [/\bhttps?\.(request|get)\s*\(/, 'an http(s) client call'],
  [/\.connect\s*\(/, 'an outbound socket connect'],
  [/\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b/, 'a browser networking API'],
  [/child_process/, 'a child process spawn'],
];

test('T-9 — the service source contains no client, no DNS and no outbound connect', () => {
  const files = sourceFiles();
  assert.ok(files.length >= 8, `expected the whole service source, found ${files.length} files`);

  const violations = [];
  for (const { rel, text } of files) {
    for (const [pattern, label] of FORBIDDEN) {
      if (pattern.test(text)) violations.push(`${rel}: ${label}`);
    }
  }
  assert.deepEqual(violations, [], 'source contains an egress-capable construct');

  // The one http import that DOES exist is the SERVER, and it is used only to
  // create a listener.
  const server = files.find((f) => f.rel === 'src/server.mjs');
  assert.match(server.text, /import http from 'node:http'/);
  assert.match(server.text, /http\.createServer\(/);
});

test('T-9 — the mutation: the scan above actually detects an egress construct', () => {
  // If the assertion above passed over a file it never read, or over patterns
  // that match nothing, it would be a control reporting on ground it did not
  // examine. Feed it a known-bad source and require it to object.
  const bad = "const r = await fetch('https://example.com');";
  const hits = FORBIDDEN.filter(([pattern]) => pattern.test(bad));
  assert.ok(hits.length >= 1, 'the pattern set detects a plain fetch call');

  const bad2 = "import net from 'node:net'; net.connect(80, 'example.com');";
  assert.ok(FORBIDDEN.filter(([p]) => p.test(bad2)).length >= 2);
});

test('T-9 — the socket is bound to 127.0.0.1 at RUNTIME, not merely in the source', async () => {
  const dir = mkTempDir('proofline-bind');
  const ctx = await startApp({ dataDir: dir });
  try {
    const addr = ctx.app.server.address();
    assert.equal(addr.address, '127.0.0.1', 'asserted from the listening socket itself');
    assert.equal(addr.family, 'IPv4');
    assert.equal(ctx.info.address, '127.0.0.1');
  } finally {
    await ctx.app.close();
    rmTempDir(dir);
  }
});

test('T-9 — the bind host is a constant, and no environment variable can widen it', async () => {
  const { loadConfig } = await import('../src/config.mjs');
  assert.equal(HOST, '127.0.0.1');
  const cfg = loadConfig({
    PROOFLINE_HOST: '0.0.0.0',
    HOST: '0.0.0.0',
    PROOFLINE_BIND: '0.0.0.0',
    PROOFLINE_PORT: '7317',
  });
  assert.equal(cfg.host, '127.0.0.1', 'an attempt to widen the bind through the environment is ignored');

  const source = fs.readFileSync(path.join(SERVICE_DIR, 'src', 'config.mjs'), 'utf8');
  assert.equal(/0\.0\.0\.0|::\b/.test(source), false, 'no all-interfaces literal exists in the config');
});

test('G-10 — zero npm dependencies are declared', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(SERVICE_DIR, 'package.json'), 'utf8'));
  assert.equal('dependencies' in pkg, false);
  assert.equal('devDependencies' in pkg, false);
  assert.equal('optionalDependencies' in pkg, false);
  assert.equal(fs.existsSync(path.join(SERVICE_DIR, 'node_modules')), false, 'nothing was installed');
  assert.equal(fs.existsSync(path.join(SERVICE_DIR, 'package-lock.json')), false);
});

test('the browser bundle addresses only same-origin relative paths', () => {
  const app = fs.readFileSync(path.join(SERVICE_DIR, 'public', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(SERVICE_DIR, 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SERVICE_DIR, 'public', 'styles.css'), 'utf8');

  for (const [name, text] of [['app.js', app], ['index.html', html], ['styles.css', css]]) {
    assert.equal(/https?:\/\//.test(text), false, `${name} contains an absolute URL`);
    assert.equal(/@import\s+url\(|src=["']\/\//.test(text), false, `${name} pulls a remote asset`);
  }

  // Every fetch target in the UI is a relative /api path.
  const targets = [...app.matchAll(/api\((`[^`]*`|'[^']*')/g)].map((m) => m[1]);
  assert.ok(targets.length >= 4);
  for (const target of targets) {
    assert.match(target.slice(1, -1), /^\/api\//, `UI request target ${target} is not a relative /api path`);
  }
});
