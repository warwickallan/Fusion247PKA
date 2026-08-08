// Fusion247 Cockpit — standalone Warwick-facing surface (replaces the Directus admin shell as the
// front door). Thin Node http server: serves the SPA, reads the spine via cp_directus, applies the
// surface decision lifecycle via cp_worker, and files REAL actions as governed intents on the
// existing queues. It never mutates module data directly. Tailnet-private (bound to the tailnet IP).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { q, w } from './db.mjs';
import { privateAppsResponse, privateAppsStartupLine } from './private-apps.mjs';
// Static serving — including the overlay route — lives in static.mjs so a gate can EXECUTE it.
// It cannot be executed from here: this file imports db.mjs, which opens a live write pool on load.
import { serveStatic, staticCtx } from './static.mjs';
import { whyDown } from './down-reason.mjs';
// Build provenance lives in provenance.mjs for the same reason as static.mjs above — so a gate can
// EXECUTE it — and it answers a harder question than the git one-liner it replaces. See its header.
import { provenancePayload } from './provenance.mjs';
// Rotation performance reports, read out of the session_report mirror. Same reason again: the read
// logic takes its query function as an ARGUMENT and imports nothing that touches a database, so
// rotation-report-check.mjs can execute the whole mapping — including the null-is-not-zero property —
// without a Postgres anywhere near it.
import { rotationReportsResponse } from './rotation-report.mjs';
// CAPAE — the closed learning loop. Same construction as the rotation reports: the endpoint returns
// the object capae-check.mjs executes, so what is proved and what Warwick sees are one thing.
import { capaeResponse } from './capae.mjs';
// The private-app API bridge and its ORIGIN BOUNDARY. Extracted for the same reason as static.mjs
// above, and it was the last live-facing handler still trapped in this file: while it lived here no
// gate could execute it, because importing this file opens two live pools via db.mjs. It is now
// executed end to end, against a recording fake upstream, by origin-boundary-check.mjs.
import { PRIVATE_API_PREFIX, privateApiCtx, servePrivateApi } from './private-api.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
// The serving context — which directory is served, and which tree the overlay must stay out of —
// is built by ONE constructor in static.mjs (and COCKPIT_PUB is handled there). Not assembled here
// as an object literal: `pub` is the containment root and `repoRoot` is not, they are the same type
// and sat adjacent, and transposing them serves the whole repository over the tailnet. A single
// constructor removes the call site where that mistake was possible, and the gate executes it.
const STATIC = staticCtx(DIR, process.env);
const REPO = path.resolve(DIR, '..', '..');
// WHERE THE DELIVERABLES ACTUALLY LIVE, resolved once at startup and announced out loud.
//
// THE DEFECT THIS CLOSES (BUILD-020 4D, found by execution). This process runs from the machine
// install at ~/.mypka/tower-runtime, so `REPO` resolves THERE — and that install carries no
// `Deliverables/`. Every request to open a session report answered "document missing", which is a
// sentence about the FILE, and the file was never the problem: the server was looking in a tree that
// has never contained one. A wrong-place read and a genuinely absent document rendered identically.
//
// `COCKPIT_REPO` names the canonical checkout when the server does not run from inside it. It is not
// a hardcoded path and not a default that silently points somewhere plausible: when it is unset and
// the local tree has no `Deliverables/`, the route below reports exactly which directory it looked
// in, so the next reader sees the cause instead of a missing file.
const DELIVERABLES_DIR = path.join(path.resolve(process.env.COCKPIT_REPO || REPO), 'Deliverables');
const DELIVERABLES_OK = fs.existsSync(DELIVERABLES_DIR);
const TK = path.join(REPO, 'Team Knowledge');
const PORT = Number(process.env.COCKPIT_PORT || 8090);
const BIND = process.env.COCKPIT_BIND || '127.0.0.1'; // localhost; Tailscale serve exposes it tailnet-only over HTTPS (matches Directus)
// MIME moved to static.mjs with the serving code that uses it — it had no other reader here.

// Build identity so the app can show "you're on the latest" and tell itself apart from Directus/old URLs.
// Taken ONCE at startup, deliberately: the question /api/health answers is "what is this process
// running", and this process loaded those bytes here. A per-request answer would describe the working
// tree as it is now, which is the very confusion the old git-only line caused.
const PROVENANCE = provenancePayload();
let VERSION = '0.0.0'; try { VERSION = JSON.parse(fs.readFileSync(path.join(DIR, 'package.json'), 'utf8')).version; } catch { /* no pkg */ }
const BUILD = { version: VERSION, sha: PROVENANCE.sha, startedAt: new Date().toISOString() };

// Governed intent queues the surface may file into, with their allowlisted payload columns.
const INTENTS = {
  learning_command: ['candidate_id', 'command'],
  brain_command: ['held_id', 'command'],
};

const j = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) }); res.end(b); };
async function safe(text, params) { try { return (await q(text, params)).rows; } catch (e) { console.error('[state]', text.split('\n')[0].trim(), '→', e.message); return []; } }

async function apiState() {
  // Bring open + deferred (deferred feeds the "Later" section); declined/accepted/resolved drop out of active view.
  // Held graph merges ("is X the same as Y?") are BRAIN HOUSEKEEPING, not Warwick's decisions — keep them
  // out of Attention entirely (surfaced only as a low-key count under Brain).
  const attention = await safe(
    `select id, source_module, source_type, source_key, title, reason, priority, status, kind, notify_policy,
            actions, provenance_ref, related_ref, detail_route, updated_at
     from cockpit.attention_item
     where status in ('open','deferred') and source_type <> 'held_canonicalisation'
       and source_module <> 'shopping'  -- AsdAIr parked until mum gets her own linked app
     order by (status='deferred'), case priority when 'high' then 0 when 'medium' then 1 else 2 end, updated_at desc`);
  const housekeeping = (await safe(`select count(*)::int n from cockpit.attention_item where source_type='held_canonicalisation' and status='open'`))[0]?.n ?? 0;
  const outputs = await safe(
    `select id, source_module, source_type, source_key, title, value, status, produced_at,
            evidence_url, provenance_ref, related_ref, detail_route, notify_policy
     from cockpit.output_item where coalesce(status,'new') <> 'archived' and source_module <> 'shopping'
     order by produced_at desc nulls last limit 100`);
  // Declined items live on in the Archive so a change of mind can always find + reopen them.
  const archived = await safe(
    `select id, source_module, source_type, source_key, title, reason, priority, status, kind,
            notify_policy, actions, provenance_ref, related_ref, detail_route, updated_at
     from cockpit.attention_item where status='declined' order by updated_at desc limit 60`);
  const ingested = await safe(`select video_id, title, updated_at, (note_path is not null) as noted,
     (raw_path is not null) as extracted, coalesce(extract_attempts,0) as extract_attempts, coalesce(note_attempts,0) as note_attempts
     from cockpit.youtube_source order by updated_at desc nulls last limit 12`);
  const ingestedCount = await safe(`select count(*)::int n from cockpit.youtube_source`);
  const wins = await safe(`select id, text, happened_at from cockpit.movement order by happened_at desc nulls last limit 8`);
  const builds = await safe(`select id, name, gives, status, status_tone, progress_pct, sort from cockpit.build order by sort nulls last limit 50`);
  // Transfer-Intelligence ideas (SPIN-first surface). Highest Impact first.
  const ideas = await safe(
    `select ic.candidate_id id, ic.mine_id, ic.category, ic.lens, ic.spin, ic.source_evidence, ic.transfer_reasoning,
            ic.fusion_target, ic.nvfi, ic.traps, ic.larry_recon, ic.lifecycle_state, ic.brief_hash, ic.created_at,
            im.source_ref, coalesce(ys.title, im.source_ref) as source_title, im.model as mine_model
     from cockpit.idea_candidate ic
     join cockpit.idea_mine im on im.mine_id = ic.mine_id
     left join cockpit.youtube_source ys on ys.video_id = im.source_ref
     where ic.lifecycle_state in ('proposed','reconciled','later')
     order by (ic.nvfi->>'impact')::int desc nulls last, ic.created_at desc limit 100`);
  // Mason/Brains OPPORTUNITIES — synthesised build-theses (SPIN-first). Only the LATEST run's surfaced set (no
  // stacking across re-syntheses); declined ones stay hidden; full atom provenance rides along for the detail sheet.
  const opportunities = await safe(
    `select o.opportunity_id id, o.headline, o.otype, o.state, o.spin, o.why_now, o.roi, o.evidence,
            o.what_wed_build, o.coherence_note, o.disposition, o.disposition_conflict, o.created_at,
            coalesce((select jsonb_agg(jsonb_build_object('n', a.n, 'source', a.source_ref, 'engine', a.engine,
                       'target', a.fusion_target, 'situation', a.spin->>'situation') order by a.n)
              from cockpit.opportunity_atom oa join cockpit.idea_atom a on a.atom_id = oa.atom_id
              where oa.opportunity_id = o.opportunity_id), '[]') as atoms
     from cockpit.opportunity o
     where o.state = 'surfaced'
       and o.run_id = (select run_id from cockpit.opportunity_run order by created_at desc limit 1)
       and coalesce(o.disposition,'') <> 'declined'
     order by (o.disposition_conflict) desc, o.otype, o.created_at`);
  return { attention, outputs, archived, housekeeping, deliverables: listDeliverables().slice(0, 20), ideas, opportunities, ingested, ingestedCount: ingestedCount[0]?.n ?? ingested.length, wins, builds, build: BUILD, at: new Date().toISOString() };
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

// Source brief = the PRIMARY output for an ingested source: the standalone "what this source says" knowledge
// note (Cairn/Sonnet), understandable WITHOUT Arc's transfers or Mason's opportunities. Served from the
// brief_markdown column the note generator populates (a pending/failed row returns its stub, clearly labelled).
async function apiSourceBrief(video) {
  if (!video || !/^[A-Za-z0-9_-]{6,24}$/.test(video)) return { ok: false, error: 'bad video id' };
  const rows = (await q('select title, brief_markdown, (note_path is not null) as noted from cockpit.youtube_source where video_id=$1 limit 1', [video])).rows;
  if (!rows.length) return { ok: false, error: 'no source on file for this video' };
  const r = rows[0];
  // Strip a leading YAML frontmatter block so the flagship reading surface opens with the note itself, not the
  // vault plumbing (VaultWriter prepends frontmatter; mdToHtml has no frontmatter handling). One place = covers
  // every row, including legacy in-session notes. A stub (no frontmatter) is unaffected.
  const text = (r.brief_markdown || '').replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n+/, '')
    || '_No standalone note yet — this source was captured but its knowledge note has not been generated. It will generate automatically; if this persists, the generation failed and is retrying._';
  return { ok: true, video, title: r.title, noted: r.noted, text };
}

// ---- Apps: is an app's backing service actually answering? ----------------------------------
// The Apps area must never claim an app is available because a tile looks healthy. The BROWSER may
// only name an app KEY; this table is the only place a host:port lives, so the surface can never
// point this server at an arbitrary host. Presentation for the same key lives in public/apps.js —
// the two share the key and nothing else.
const APP_SERVICES = {
  asdair: { url: 'http://127.0.0.1:8710/asdair/health', label: 'AsdAIr’s read service' },
};
// whyDown lives in its own module so a gate can EXECUTE it: importing server.mjs opens a live DB
// pool via db.mjs, which is exactly why the old in-file version was never tested and shipped two
// unreachable branches. See down-reason.mjs for the DOMException-legacy-code defect it fixes.
// Answers up / down / none. Never throws, never 500s, never guesses: a service that does not answer
// is reported as not answering, with the reason, and the UI shows unknown rather than a fake figure.
async function apiAppStatus(key) {
  // OWN properties only. A plain object literal inherits from Object.prototype, so ?app=constructor
  // (or toString, valueOf...) would walk the chain, sail past this guard and get reported as a real
  // app that is "down" — with "undefined" in the copy. An app we do not know about is not down: it
  // does not exist. That is the same distinction as "not running" vs "empty", and it has to hold here
  // too. The key is never echoed back either; it came from the browser and means nothing to us.
  const svc = Object.hasOwn(APP_SERVICES, String(key || '')) ? APP_SERVICES[String(key)] : null;
  if (!svc) return { ok: true, app: null, state: 'none', detail: 'No backing service is registered for this app.' };
  const host = (() => { try { return new URL(svc.url).host; } catch { return 'its configured address'; } })();
  try {
    // BUDGET, and why it moved from 1500ms. Health used to be a literal that touched nothing; it
    // now does real dependency work (connect + SELECT 1), itself capped at 2000ms upstream. A
    // 1500ms budget sitting BELOW that cap means our own timeout fires before the service can
    // report its own reason — turning a lying green into a lying red, which is not progress.
    // 3500ms sits above the upstream cap so a slow dependency arrives as a REPORTED reason.
    //
    // Measured on this machine 2026-08-04, single process, first run discarded:
    //   * health as a literal .......... median 6ms
    //   * full workspace read .......... median 1472ms (range 692-1763)
    // and — the reason headroom is not theoretical — the 1500ms budget was observed TIMING OUT
    // against the 6ms literal endpoint in live use, which is what produced the bogus "— 23."
    //
    // NOT measured: the dependency-aware health endpoint itself, because it cannot run until the
    // reader is restarted, and that restart is Larry's. Stated rather than estimated.
    const r = await fetch(svc.url, { signal: AbortSignal.timeout(3500), headers: { accept: 'application/json' } });
    const body = await r.json().catch(() => null);
    // AN APP IS NOT "UP" BECAUSE A PORT ANSWERED.
    //
    // This is the second half of the 2026-08-03 false green, and it has to be here as well as in the
    // reader: /asdair/health returned HTTP 200 with `ok: true` while /asdair/workspace was 500-ing
    // on a missing `pg` module. A probe that stops at `r.ok` would report "up" for any process that
    // can still form an HTTP response — including one that can do nothing else.
    //
    // So the BODY decides when the body says anything. `ok: false` is degraded, whatever the status
    // line says. An unparseable or non-object body from a service we expect JSON from is NOT quietly
    // treated as healthy — unknown reads as unknown.
    if (!r.ok) {
      const why = body && body.message ? String(body.message) : `${svc.label} answered HTTP ${r.status} on ${host}.`;
      return { ok: true, app: key, state: 'down', detail: why, http_status: r.status };
    }
    if (body && typeof body === 'object' && body.ok === false) {
      return {
        ok: true, app: key, state: 'down', http_status: r.status,
        detail: body.message ? String(body.message)
          : `${svc.label} is answering on ${host} but reports it cannot do its job.`,
        service: body.service ? String(body.service) : null,
      };
    }
    if (!body || typeof body !== 'object') {
      return {
        ok: true, app: key, state: 'unknown', http_status: r.status,
        detail: `${svc.label} answered on ${host} but not with the health report we expect, so its state is unknown.`,
      };
    }
    // Healthy, and able to say what it checked. Surfacing the dependency list means the cockpit can
    // show WHAT was verified rather than an unexplained green.
    const deps = Array.isArray(body.dependencies) ? body.dependencies : null;
    const checked = deps ? deps.filter((x) => x && x.checked).map((x) => String(x.dependency)) : [];
    return {
      ok: true, app: key, state: 'up',
      detail: checked.length
        ? `${svc.label} is answering on ${host}, and reports its ${checked.join(' and ')} reachable.`
        : `${svc.label} is answering on ${host}.`,
      service: body.service ? String(body.service) : null,
      dependencies_checked: checked,
    };
  } catch (e) {
    return { ok: true, app: key, state: 'down', detail: `${svc.label} is not answering on ${host} — ${whyDown(e)}.` };
  }
}

// ---- AsdAIr: the read-only workspace view --------------------------------------------------
// Two small proxies, same shape as apiAppStatus above: this server is the only thing that may name
// a host:port, the browser only ever asks a cockpit path. Both proxies are read-only forwards — no
// mutation, no new intent — and both fail soft: a workspace/media fetch that doesn't answer degrades
// to an error the UI already knows how to show as "offline", never a crash, never invented data.
const ASDAIR_ORIGIN = 'http://127.0.0.1:8710';
async function apiAsdairWorkspace() {
  try {
    const r = await fetch(`${ASDAIR_ORIGIN}/asdair/workspace?household=1`, { signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
    if (!r.ok) return { ok: false, error: `AsdAIr’s read service answered HTTP ${r.status}.` };
    const body = await r.json().catch(() => null);
    if (!body || typeof body !== 'object') return { ok: false, error: 'AsdAIr’s read service returned something that was not JSON.' };
    return body; // upstream already carries its own ok:true/shop/etc — forwarded verbatim, nothing added
  } catch (e) {
    return { ok: false, error: `AsdAIr’s read service is not answering — ${whyDown(e)}.` };
  }
}
// The durable RULEBOOK, as opposed to one shop's workspace above. Same shape, same rules: a
// read-only forward, a short timeout, fail-soft to an error the UI shows as "offline" rather than
// a crash or an invented rulebook. Kept as its own proxy — NOT folded into apiAsdairWorkspace —
// because the two answer different questions and are read on different screens, so a shop poll
// must not drag the whole catalogue with it.
async function apiAsdairRules() {
  try {
    const r = await fetch(`${ASDAIR_ORIGIN}/asdair/rules?household=1`, { signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
    if (!r.ok) return { ok: false, error: `AsdAIr’s read service answered HTTP ${r.status} for the rulebook.` };
    const body = await r.json().catch(() => null);
    if (!body || typeof body !== 'object') return { ok: false, error: 'AsdAIr’s read service returned something that was not JSON.' };
    return body; // forwarded verbatim — the display strings are already decided server-side
  } catch (e) {
    return { ok: false, error: `AsdAIr’s read service is not answering — ${whyDown(e)}.` };
  }
}
// The Sonnet execution packet + basket reconciliation for one shop. Same construction as the two
// proxies above: a read-only forward, a short timeout, fail-soft to an error the UI shows as
// "offline" rather than a crash or an invented packet.
//
// Its own proxy rather than folded into the workspace, because the two are read on different screens
// and answer different questions — and because the packet's producers (WO-P/WO-S) do not exist yet,
// so this route legitimately answers "not produced" for a shop whose workspace is fully populated.
// Contract: Builds/BUILD-015-.../COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md
async function apiAsdairPacket(shop) {
  // The browser names a shop id and nothing else; this server owns the host:port, as everywhere.
  const s = String(shop || '').trim();
  if (!s || !/^[A-Za-z0-9-]{1,32}$/.test(s)) return { ok: false, error: 'A shop must be named to read its packet.' };
  try {
    const r = await fetch(`${ASDAIR_ORIGIN}/asdair/packet?shop=${encodeURIComponent(s)}`, { signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
    if (!r.ok) return { ok: false, error: `AsdAIr’s read service answered HTTP ${r.status} for the packet.` };
    const body = await r.json().catch(() => null);
    if (!body || typeof body !== 'object') return { ok: false, error: 'AsdAIr’s read service returned something that was not JSON.' };
    return body; // forwarded verbatim — the display strings are already decided server-side
  } catch (e) {
    return { ok: false, error: `AsdAIr’s read service is not answering — ${whyDown(e)}.` };
  }
}
// The browser can never reach 127.0.0.1:8710 itself — on Warwick's phone that loopback address is the
// PHONE's own, not this machine's, so the image would silently never load without this proxy. Streams
// bytes straight through; never buffers the whole image, never guesses a content-type.
async function proxyAsdairMedia(req, res) {
  const shop = new URL(req.url, 'http://x').searchParams.get('shop');
  if (!shop || !/^[0-9]+$/.test(shop)) { res.writeHead(400, { 'content-type': 'text/plain' }); res.end('bad shop id'); return; }
  try {
    const r = await fetch(`${ASDAIR_ORIGIN}/asdair/media?shop=${encodeURIComponent(shop)}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok || !r.body) { res.writeHead(502, { 'content-type': 'text/plain' }); res.end('AsdAIr’s media is not available right now'); return; }
    res.writeHead(200, { 'content-type': r.headers.get('content-type') || 'application/octet-stream' });
    Readable.fromWeb(r.body).pipe(res);
  } catch (e) {
    res.writeHead(502, { 'content-type': 'text/plain' }); res.end('AsdAIr’s media proxy failed — ' + whyDown(e));
  }
}

// The private-app API bridge is built by ONE constructor from the environment, in private-api.mjs,
// which also owns the origin boundary that decides which requests may use it. Used by private
// overlays that cannot call 127.0.0.1 from a phone/tunnel (that would be the device's loopback, not
// this host).
const PRIVATE_API = privateApiCtx(process.env);

// Deliverables = produced docs (Pax reports etc.) living in the repo's Deliverables/ folder — the synced
// "things for Warwick to read". Listed newest-first with a human title from the first H1.
function listDeliverables() {
  const dir = path.join(REPO, 'Deliverables');
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md') && f.toUpperCase() !== 'BACKLOG.MD'); } catch { return []; }
  return names.map((f) => {
    const fp = path.join(dir, f); let st = null, title = f.replace(/\.md$/i, '');
    try { st = fs.statSync(fp); const h = fs.readFileSync(fp, 'utf8').split(/\r?\n/).find((l) => /^#\s+/.test(l)); if (h) title = h.replace(/^#\s+/, '').trim(); } catch { /* skip */ }
    return { file: f, title, mtime: st ? Math.round(st.mtimeMs) : 0 };
  }).sort((a, b) => b.mtime - a.mtime);
}
async function apiDeliverable(file) {
  const safe = path.basename(String(file || ''));
  if (!safe.toLowerCase().endsWith('.md')) return { ok: false, error: 'not a document' };
  // THE DIRECTORY IS WRONG IS A DIFFERENT FACT FROM THE DOCUMENT IS MISSING, and only one of them
  // tells the reader where to look. Reported before the read is attempted, because after it the two
  // are indistinguishable.
  if (!DELIVERABLES_OK) {
    return { ok: false, error: `no Deliverables directory at ${DELIVERABLES_DIR} — this server is not running inside the canonical checkout. Set COCKPIT_REPO to it. The document itself was never looked for.` };
  }
  const fp = path.join(DELIVERABLES_DIR, safe);
  if (!fp.startsWith(DELIVERABLES_DIR)) return { ok: false, error: 'path' };
  try { return { ok: true, file: safe, text: fs.readFileSync(fp, 'utf8') }; } catch { return { ok: false, error: `document missing — looked in ${DELIVERABLES_DIR}` }; }
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
    if (req.url.startsWith('/api/source-brief')) { const v = new URL(req.url, 'http://x').searchParams.get('video'); return j(res, 200, await apiSourceBrief(v)); }
    if (req.url.startsWith('/api/deliverable')) { const f = new URL(req.url, 'http://x').searchParams.get('file'); return j(res, 200, await apiDeliverable(f)); }
    if (req.url.startsWith('/api/app-status')) { const a = new URL(req.url, 'http://x').searchParams.get('app'); return j(res, 200, await apiAppStatus(a)); }
    if (req.url.startsWith('/api/asdair/workspace')) return j(res, 200, await apiAsdairWorkspace());
    if (req.url.startsWith('/api/asdair/rules')) return j(res, 200, await apiAsdairRules());
    if (req.url.startsWith('/api/asdair/packet')) { const s = new URL(req.url, 'http://x').searchParams.get('shop'); return j(res, 200, await apiAsdairPacket(s)); }
    if (req.url.startsWith('/api/asdair/media')) return proxyAsdairMedia(req, res);
    // Private-app same-origin bridge (opt-in via COCKPIT_PRIVATE_API). Must run before static.
    if (req.url.startsWith(PRIVATE_API_PREFIX)) return servePrivateApi(req, res, PRIVATE_API);
    if (req.url.startsWith('/api/mine') && req.method === 'POST') {
      let raw = ''; req.on('data', (d) => { raw += d; if (raw.length > 1e4) req.destroy(); });
      req.on('end', () => {
        try {
          const v = String(JSON.parse(raw || '{}').video || '');
          if (!/^[A-Za-z0-9_-]{6,24}$/.test(v)) return j(res, 200, { ok: false, error: 'bad video id' });
          // fire Arc detached — reads the factual source-core, tiers by substance (rich → T2 divergent multi-frame),
          // favours recall, persists the converged atoms. Rich sources take longer (T2, several min); atoms appear
          // in /api/state when done. neo4j.env is OPTIONAL (only the non-model graph enrichment uses it, which
          // degrades gracefully): --env-file-if-exists so a MISSING neo4j.env can never stop Arc from launching (TQA-001).
          const p = spawn('node', ['--env-file=C:/.fusion247/fusion-capture-gateway.env', '--env-file-if-exists=C:/.fusion247/neo4j.env', `${REPO}/services/control-plane/cockpit/arc.mjs`, v], { detached: true, stdio: 'ignore', cwd: REPO, windowsHide: true });
          p.unref();
          j(res, 200, { ok: true, mining: v });
        } catch (e) { j(res, 500, { ok: false, error: e.message }); }
      });
      return;
    }
    if (req.url.startsWith('/api/idea-decide') && req.method === 'POST') {
      let raw = ''; req.on('data', (d) => { raw += d; if (raw.length > 1e4) req.destroy(); });
      req.on('end', async () => {
        try {
          const { id, decision } = JSON.parse(raw || '{}');
          const map = { keep: 'kept', later: 'later', decline: 'declined', research: 'researching' };
          if (!id || !map[decision]) return j(res, 200, { ok: false, error: 'bad decision' });
          await w('update cockpit.idea_candidate set lifecycle_state=$2, updated_at=now() where candidate_id=$1', [id, map[decision]]);
          await w("insert into cockpit.idea_event (candidate_id, actor, event, note) values ($1,'warwick',$2,$3)",
            [id, decision === 'research' ? 'research_started' : decision, 'cockpit']);
          j(res, 200, { ok: true, id, state: map[decision] });
        } catch (e) { j(res, 500, { ok: false, error: e.message }); }
      });
      return;
    }
    if (req.url.startsWith('/api/synthesise') && req.method === 'POST') {
      // Fire Mason's synthesis over the whole atom estate, detached (one Sonnet pass, ~5 min) — surfaced
      // opportunities appear in /api/state when done. This is the cockpit trigger for lifecycle Step 4.
      try {
        const p = spawn('node', ['--env-file=C:/.fusion247/fusion-capture-gateway.env', `${REPO}/services/control-plane/cockpit/mason-synthesise.mjs`], { detached: true, stdio: 'ignore', cwd: REPO, windowsHide: true });
        p.unref();
        return j(res, 200, { ok: true, synthesising: true });
      } catch (e) { return j(res, 500, { ok: false, error: e.message }); }
    }
    if (req.url.startsWith('/api/opportunity-decide') && req.method === 'POST') {
      let raw = ''; req.on('data', (d) => { raw += d; if (raw.length > 1e4) req.destroy(); });
      req.on('end', async () => {
        try {
          const { id, decision } = JSON.parse(raw || '{}');
          // Warwick's call is his DURABLE DISPOSITION (survives re-synthesis), not a synthesis state. Mason/Pax/Larry
          // act on it downstream; no build is authorised here. Deciding also clears any carry-forward conflict flag.
          const map = { watch: 'watching', research: 'researching', brief: 'brief', later: 'later', decline: 'declined' };
          if (!id || !map[decision]) return j(res, 200, { ok: false, error: 'bad decision' });
          await w('update cockpit.opportunity set disposition=$2, disposition_at=now(), disposition_conflict=false, updated_at=now() where opportunity_id=$1', [id, map[decision]]);
          await w("insert into cockpit.opportunity_event (opportunity_id, actor, event, note) values ($1,'warwick',$2,'cockpit')", [id, decision]);
          j(res, 200, { ok: true, id, state: map[decision] });
        } catch (e) { j(res, 500, { ok: false, error: e.message }); }
      });
      return;
    }
    // The rotation reports. `q` is the cp_directus READ pool — never `w`; this route reads evidence
    // and must remain structurally unable to alter it. The object returned is the one the gate
    // executes, so what is proved and what Warwick sees are one construction. It never throws: a
    // database failure comes back as HTTP 200 { ok:false, error } and takes no other route down.
    if (req.url.startsWith('/api/rotation-reports')) return j(res, 200, await rotationReportsResponse(q));
    // CAPAE. Same READ pool `q`, same never-throws contract: a database failure is HTTP 200
    // { ok:false, error } and takes no other route down with it.
    if (req.url.startsWith('/api/capae')) return j(res, 200, await capaeResponse(q));
    // The four provenance fields are the object provenance.mjs builds and the gate executes — the
    // endpoint does not assemble its own version of the answer.
    if (req.url.startsWith('/api/health')) return j(res, 200, { status: 'ok', build: BUILD, ...PROVENANCE });
    return serveStatic(req, res, STATIC);
  } catch (e) { j(res, 500, { ok: false, error: e.message }); }
});

server.listen(PORT, BIND, () => {
  console.log(`Fusion247 Cockpit on http://${BIND}:${PORT} (tailnet-private)`);
  // Same reasoning as the overlay line below: a Deliverables directory that is not there produces a
  // surface that looks fine until Warwick clicks Open, and then blames the document. Say which
  // directory was resolved, and say plainly when it does not exist, ONCE, at startup.
  console.log(DELIVERABLES_OK
    ? `Deliverables: ${DELIVERABLES_DIR}`
    : `Deliverables: NOT FOUND at ${DELIVERABLES_DIR} — session reports cannot be opened or downloaded. Set COCKPIT_REPO to the canonical checkout.`);
  // Say once, out loud, what the overlay actually resolved to. A misconfigured path serves exactly
  // what "no overlay" serves, so without this line a typo is indistinguishable from switching it
  // off — and the surface you were expecting just never appears. The verdict is printed; the path
  // never is, because where an overlay lives can itself say what it is for.
  const line = privateAppsStartupLine(privateAppsResponse(process.env, REPO));
  console[line.level](line.message);
  // A boundary whose configuration was silently discarded is a boundary nobody can tell is set
  // wrongly. Said once, out loud, at startup — never silently dropped.
  for (const warning of PRIVATE_API.configWarnings) console.warn(warning);
});
