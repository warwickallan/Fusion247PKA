// Cockpit RENDER smoke-test — the safeguard for the "served straight from the working tree, no build step"
// hazard. Loads the served page in headless Edge, runs its JS (Vue mount + async /api/state fetch), dumps the
// rendered DOM, and asserts the app actually MOUNTED. `node --check` only validates JS syntax; a Vue TEMPLATE
// error compiles fine as a string but blanks the app at runtime for fresh browsers — this catches that.
// RUN THIS before any cockpit UI change is considered done.
//   node services/cockpit/render-check.mjs [url]
import { execFileSync } from 'node:child_process';

const URL = process.argv[2] || 'http://127.0.0.1:8090/';
const EDGE = process.env.EDGE_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

let dom = '';
try {
  dom = execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox', '--dump-dom', '--virtual-time-budget=6000', URL],
    { encoding: 'utf8', timeout: 45000, maxBuffer: 64 * 1024 * 1024 });
} catch (e) { console.error('render-check: headless Edge failed to load:', e.message); process.exit(2); }

// The app mounts into <div id="app"></div>. Mounted => shell markers present; template/runtime error => #app empty.
const appEmpty = /<div id="app">\s*<\/div>/.test(dom);
const mounted = /Fusion247/.test(dom) && /(class="nav"|nav-btn|topbar)/.test(dom);
const hasContent = /(i-title|class="tile"|status-line|class="item)/.test(dom);

if (appEmpty || !mounted) {
  console.error('❌ RENDER-CHECK FAILED — Vue did not mount (#app blank). This WOULD blank the cockpit for fresh browsers.');
  const at = dom.indexOf('id="app"');
  if (at >= 0) console.error('   #app region:', JSON.stringify(dom.slice(at, at + 160)));
  process.exit(1);
}
console.log(`✅ RENDER-CHECK PASSED — app mounted${hasContent ? ' + content rendered' : ' (shell only; data may still be loading)'} · DOM ${dom.length} bytes`);
