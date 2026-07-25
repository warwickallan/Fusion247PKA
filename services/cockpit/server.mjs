// Fusion247 Cockpit — standalone Warwick-facing surface (replaces the Directus admin shell as the
// front door). Thin Node http server: serves the SPA, reads the spine via cp_directus, applies the
// surface decision lifecycle via cp_worker, and files REAL actions as governed intents on the
// existing queues. It never mutates module data directly. Tailnet-private (bound to the tailnet IP).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { q, w } from './db.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(DIR, 'public');
const REPO = path.resolve(DIR, '..', '..');
const TK = path.join(REPO, 'Team Knowledge');
const PORT = Number(process.env.COCKPIT_PORT || 8090);
const BIND = process.env.COCKPIT_BIND || '127.0.0.1'; // localhost; Tailscale serve exposes it tailnet-only over HTTPS (matches Directus)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Build identity so the app can show "you're on the latest" and tell itself apart from Directus/old URLs.
let SHA = 'dev'; try { SHA = execSync('git rev-parse --short HEAD', { cwd: DIR }).toString().trim(); } catch { /* not a repo */ }
let VERSION = '0.0.0'; try { VERSION = JSON.parse(fs.readFileSync(path.join(DIR, 'package.json'), 'utf8')).version; } catch { /* no pkg */ }
const BUILD = { version: VERSION, sha: SHA, startedAt: new Date().toISOString() };

// Governed intent queues the surface may file into, with their allowlisted payload columns.
const INTENTS = {
  learning_command: ['candidate_id', 'command'],
  brain_command: ['held_id', 'command'],
};

const j = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) }); res.end(b); };
async function safe(text, params) { try { return (await q(text, params)).rows; } catch (e) { console.error('[state]', text.split('\n')[0].trim(), '→', e.message); return []; } }

async function apiState() {
  // Bring open + deferred (deferred feeds the "Later" section); declined/accepted/resolved drop out of active view.
  const attention = await safe(
    `select id, source_module, source_type, source_key, title, reason, priority, status, kind, notify_policy,
            actions, provenance_ref, related_ref, detail_route, updated_at
     from cockpit.attention_item where status in ('open','deferred')
     order by (status='deferred'), case priority when 'high' then 0 when 'medium' then 1 else 2 end, updated_at desc`);
  const outputs = await safe(
    `select id, source_module, source_type, source_key, title, value, status, produced_at,
            evidence_url, provenance_ref, related_ref, detail_route, notify_policy
     from cockpit.output_item where coalesce(status,'new') <> 'archived' order by produced_at desc nulls last limit 100`);
  // Declined items live on in the Archive so a change of mind can always find + reopen them.
  const archived = await safe(
    `select id, source_module, source_type, source_key, title, reason, priority, status, kind,
            notify_policy, actions, provenance_ref, related_ref, detail_route, updated_at
     from cockpit.attention_item where status='declined' order by updated_at desc limit 60`);
  const ingested = await safe(`select video_id, title, updated_at from cockpit.youtube_source order by updated_at desc nulls last limit 12`);
  const ingestedCount = await safe(`select count(*)::int n from cockpit.youtube_source`);
  const wins = await safe(`select id, text, happened_at from cockpit.movement order by happened_at desc nulls last limit 8`);
  const builds = await safe(`select id, name, gives, status, status_tone, progress_pct, sort from cockpit.build order by sort nulls last limit 50`);
  return { attention, outputs, archived, ingested, ingestedCount: ingestedCount[0]?.n ?? ingested.length, wins, builds, build: BUILD, at: new Date().toISOString() };
}

// One decision endpoint for the whole lifecycle: accept (fires the real governed action + records
// accepted), decline (→ Archive), defer (→ Later), reopen (back to open).
async function apiDecide(body) {
  const { id, decision, intent, args } = body || {};
  if (!id || !['accept', 'decline', 'defer', 'reopen'].includes(decision)) return { ok: false, error: 'bad decision' };

  if (decision === 'accept' && intent) {
    if (!INTENTS[intent]) return { ok: false, error: 'unknown intent ' + intent };
    const cols = ['requested_by', 'idempotency_key'];
    const vals = ['cockpit:warwick', `${intent}:${id}:accept:${Date.now()}`];
    for (const c of INTENTS[intent]) { if (args && c in args) { cols.push(c); vals.push(args[c]); } }
    const ph = vals.map((_, i) => '$' + (i + 1)).join(',');
    await q(`insert into cockpit.${intent} (${cols.join(',')}) values (${ph})`, vals); // cp_directus: insert-intent only
  }
  const status = { accept: 'accepted', decline: 'declined', defer: 'deferred', reopen: 'open' }[decision];
  await w(`update cockpit.attention_item set status=$2, updated_at=now() where id=$1`, [id, status]); // cp_worker
  return { ok: true, id, status };
}

// Copy-transcript: pull the cleaned reading view (§7.1) out of the video's TubeAIR report.
function extractTranscript(md) {
  const lines = md.split(/\r?\n/);
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && /^###\s*7\.1\b/.test(lines[i])) { start = i + 1; }
    else if (start >= 0 && /^###\s*7\.2\b/.test(lines[i])) { end = i; break; }
  }
  if (start < 0) { // fall back to the whole §7
    for (let i = 0; i < lines.length; i++) {
      if (start < 0 && /^##\s*7\.\s/.test(lines[i])) { start = i + 1; }
      else if (start >= 0 && /^##\s*8\.\s/.test(lines[i])) { end = i; break; }
    }
  }
  if (start < 0) return md.trim();
  return lines.slice(start, end).filter((l) => !/^>\s/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
async function apiTranscript(video) {
  if (!video || !/^[A-Za-z0-9_-]{6,24}$/.test(video)) return { ok: false, error: 'bad video id' };
  const rows = (await q('select raw_path, title from cockpit.youtube_source where video_id=$1 limit 1', [video])).rows;
  if (!rows.length || !rows[0].raw_path) return { ok: false, error: 'no source on file for this video' };
  const fp = path.join(TK, path.normalize(rows[0].raw_path.replace(/^[/\\]+/, '')), 'tubeair-report.md');
  if (!fp.startsWith(TK)) return { ok: false, error: 'path' };
  let md; try { md = fs.readFileSync(fp, 'utf8'); } catch { return { ok: false, error: 'transcript file missing' }; }
  return { ok: true, video, title: rows[0].title, text: extractTranscript(md) };
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const fp = path.join(PUB, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!fp.startsWith(PUB)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/state')) return j(res, 200, await apiState());
    if (req.url.startsWith('/api/decide') && req.method === 'POST') {
      let raw = ''; req.on('data', (d) => { raw += d; if (raw.length > 1e5) req.destroy(); });
      req.on('end', async () => { try { j(res, 200, await apiDecide(JSON.parse(raw || '{}'))); } catch (e) { j(res, 500, { ok: false, error: e.message }); } });
      return;
    }
    if (req.url.startsWith('/api/transcript')) { const v = new URL(req.url, 'http://x').searchParams.get('video'); return j(res, 200, await apiTranscript(v)); }
    if (req.url.startsWith('/api/health')) return j(res, 200, { status: 'ok', build: BUILD });
    return serveStatic(req, res);
  } catch (e) { j(res, 500, { ok: false, error: e.message }); }
});

server.listen(PORT, BIND, () => console.log(`Fusion247 Cockpit on http://${BIND}:${PORT} (tailnet-private)`));
