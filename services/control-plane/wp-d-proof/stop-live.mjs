// BUILD-014 LIVE cockpit — stop the detached Directus started by start-directus-live.mjs.
// Leaves the hosted cp_directus role in place (drop it manually per WP-D-LIVE-README to fully revert).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '.runtime-live');
const pidFile = path.join(RUNTIME, 'directus.pid');
if (!fs.existsSync(pidFile)) { console.log('[live] no pidfile — Directus not running via start-directus-live.mjs'); process.exit(0); }
const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
try { process.kill(pid); console.log(`[live] stopped Directus pid ${pid}`); }
catch (e) { console.log(`[live] pid ${pid} not alive (${e.code})`); }
fs.rmSync(pidFile, { force: true });
