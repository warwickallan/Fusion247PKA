// Drives a11y-probe.html in headless Edge under BOTH colour schemes and prints what the CASCADE
// actually delivered. Serves services/cockpit/ on its OWN port (default 8097) — never 8090, which is
// the live cockpit. Blink's `preferredColorScheme` setting is what makes prefers-color-scheme
// testable headlessly: 0 = dark, 1 = light.
//
//   node services/cockpit/a11y-probe.mjs

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

// MUST be async: execFileSync would block this process's event loop, and the static server that
// Edge is fetching from lives in THIS process. Sync spawn = the page never loads = a timeout that
// looks like a browser fault but is our own deadlock.
const run = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PROBE_PORT || 8097);
const EDGE = process.env.EDGE_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'a11y-probe.html';
  const file = normalize(join(HERE, rel));
  if (!file.startsWith(HERE) || !existsSync(file)) { res.writeHead(404); return res.end('no'); }
  const ext = file.slice(file.lastIndexOf('.'));
  res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log(`probe server on http://127.0.0.1:${PORT} (NOT 8090 — the live cockpit is untouched)\n`);

for (const [scheme, flag] of [['LIGHT', 1], ['DARK', 0]]) {
  const { stdout: dom } = await run(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--dump-dom',
    `--blink-settings=preferredColorScheme=${flag}`,
    '--virtual-time-budget=4000', `http://127.0.0.1:${PORT}/a11y-probe.html`,
  ], { encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 });

  const m = dom.match(/<div id="out">([\s\S]*?)<\/div>/);
  const body = m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '(probe produced no output)';
  console.log(`================ ${scheme} ================`);
  console.log(body.trim());
  console.log('');
}

server.close();
