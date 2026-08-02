// Cross-session continuity through Honcho (Warwick's direct instruction, 2026-08-01).
//
// THE PROBLEM THIS CLOSES: repeated claims of "durable continuity" that evaporated
// in a fresh session, because nothing was actually READ from Honcho on boot and
// nothing was WRITTEN to it at session boundaries. This module makes both real.
//
// WHAT IT IS, AND IS NOT (Warwick's scope ruling, 2026-08-01):
//   - It is the minimal DIRECT read/write path over the EXISTING Honcho v3 API
//     (services/obsidiwikai/src/clients/honcho.mjs uses the same endpoints).
//   - It is NOT a new outbox, subsystem, build, programme or framework. The
//     Postgres Context Outbox exists but is unreachable from a hook; that is a
//     finding, not licence to build a second outbox. So this writes DIRECT to
//     Honcho. A failed delivery returns an honest {ok:false} — never silent.
//     A bounded local retry is added ONLY if delivery genuinely fails in use.
//
// STORE LAYOUT (in Honcho): workspace <HONCHO_WORKSPACE>, session
// 'larry-continuity', peer 'larry-continuity'. Each continuity packet is one
// message whose content carries a fenced JSON block; read-back lists the session's
// messages and takes the newest packet. Latest-wins.
//
// PRIVACY (config.mjs privacy rules, applied here): continuity packets are compact
// STRUCTURED SUMMARIES only — never transcripts. Every field is length-capped and
// scanned; anything matching the restricted pattern is withheld and the packet is
// marked restricted rather than sent verbatim.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
// WO-OR-05. This module's `stop` command is ALREADY registered as a Stop hook, and Stop
// is the one event that fires on every client Warwick uses. Rather than register a second
// hook — which would mean editing settings this Work Order does not own — the health
// sample rides along on the hook that is already there. `sampler.mjs` and
// `health-store.mjs` do the work; nothing new was created to carry it.
import { sampleFromTranscript } from './sampler.mjs';

const HONCHO_ENV = 'C:/.fusion247/honcho.env';
const HONCHO_BASE = 'https://api.honcho.dev/v3';
const SESSION = 'larry-continuity';
const PEER = 'larry-continuity';
const SCHEMA = 1;
const WRITE_TIMEOUT_MS = 9000;
const READ_TIMEOUT_MS = 9000;

const STORE_DIR = join(homedir(), '.mypka', 'governor');
const STATE_FILE = join(STORE_DIR, 'continuity.json'); // authoritative semantic state Larry maintains
const SEQ_FILE = join(STORE_DIR, 'continuity-seq.json'); // monotonic sequence for ordering/uniqueness
const LAST_FILE = join(STORE_DIR, 'continuity-last.json'); // dedupe marker: last (state,session) written on Stop

// Restricted-content pattern — mirrors contextOutbox.mjs RISKY + config.mjs
// externalBlockedDomains. A field that trips this is WITHHELD, never sent.
const RESTRICTED = /\b(health|medical|diagnos|salary|wage|bellrock|password|secret|api[_-]?key|token|passport|\bdob\b|national insurance|\bnino\b)\b/i;

const FIELD_CAP = 600;
const LIST_CAP = 8;

// ---- small durable helpers -------------------------------------------------

function ensureDir() {
  try { mkdirSync(STORE_DIR, { recursive: true }); } catch { /* already there */ }
}

function atomicWriteJson(file, obj) {
  ensureDir();
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  renameSync(tmp, file);
}

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

function nextSeq() {
  const s = readJson(SEQ_FILE, { seq: 0 });
  s.seq = (Number(s.seq) || 0) + 1;
  atomicWriteJson(SEQ_FILE, s);
  return s.seq;
}

export function loadHonchoEnv() {
  if (process.env.HONCHO_API_KEY) return true;
  let text;
  try { text = readFileSync(HONCHO_ENV, 'utf8'); } catch { return false; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
  return !!process.env.HONCHO_API_KEY;
}

function honchoCtx() {
  const ok = loadHonchoEnv();
  return { ok, ws: process.env.HONCHO_WORKSPACE || 'Fusion247', key: process.env.HONCHO_API_KEY };
}

async function hf(path, { method = 'GET', body, timeoutMs = READ_TIMEOUT_MS } = {}) {
  const { ok, ws, key } = honchoCtx();
  if (!ok) throw new Error(`no HONCHO_API_KEY (looked in ${HONCHO_ENV})`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(HONCHO_BASE + path.replace('{ws}', ws), {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`honcho ${method} ${path} -> ${r.status}: ${txt.slice(0, 200)}`);
    }
    const ct = r.headers.get('content-type') || '';
    return ct.includes('json') ? r.json() : r.text();
  } finally {
    clearTimeout(t);
  }
}

async function ensureStore() {
  await hf('/workspaces', { method: 'POST', body: { id: honchoCtx().ws } });
  await hf('/workspaces/{ws}/peers', { method: 'POST', body: { id: PEER } });
  await hf('/workspaces/{ws}/sessions', { method: 'POST', body: { id: SESSION, peers: { [PEER]: {} } } });
}

// ---- packet construction + privacy ----------------------------------------

function capField(v) {
  if (v == null) return v;
  const s = String(v);
  return s.length > FIELD_CAP ? s.slice(0, FIELD_CAP - 1) + '…' : s;
}

// Apply the privacy rules: cap length, withhold restricted content. Returns
// {clean, restrictedHits}. Continuity carries summaries, so a hit is rare and the
// correct action is to withhold that field, not to send it.
function scrub(value) {
  if (value == null) return { clean: value, hit: false };
  if (Array.isArray(value)) {
    let anyHit = false;
    const clean = value.slice(0, LIST_CAP).map((x) => {
      const r = scrub(x);
      anyHit = anyHit || r.hit;
      return r.clean;
    });
    return { clean, hit: anyHit };
  }
  const s = capField(value);
  if (RESTRICTED.test(s)) return { clean: '[withheld: restricted per privacy rules]', hit: true };
  return { clean: s, hit: false };
}

export function buildPacket(state, { reason = 'manual', sessionId = null, backfill = false } = {}) {
  const ts = new Date().toISOString();
  const seq = nextSeq();
  const id = `cont-${Date.parse(ts)}-${seq}-${Math.abs(hashStr(ts + seq + reason)).toString(36).slice(0, 6)}`;
  const fields = {
    focus: state.focus,
    immediate_objective: state.immediate_objective,
    warwick_last_request: state.warwick_last_request,
    accepted_decisions: state.accepted_decisions,
    completed: state.completed,
    blockers: state.blockers,
    next_action: state.next_action,
    notes: state.notes,
  };
  let restricted = false;
  const clean = {};
  for (const [k, v] of Object.entries(fields)) {
    const r = scrub(v);
    clean[k] = r.clean;
    restricted = restricted || r.hit;
  }
  return {
    schema: SCHEMA,
    kind: 'continuity',
    id,
    ts,
    seq,
    reason,
    session_id: sessionId,
    backfill: !!backfill,
    sensitivity: restricted ? 'restricted' : 'ordinary',
    ...clean,
  };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return h;
}

function fmtList(label, arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  if (arr.length === 1) return `  • ${label}: ${arr[0]}`;
  return `  • ${label}:\n` + arr.map((x) => `      - ${x}`).join('\n');
}

function renderContent(p) {
  const head = `⟦CONTINUITY⟧ focus: ${p.focus || '(unset)'} — next: ${p.next_action || '(unset)'}`;
  const obj = p.immediate_objective ? `\nobjective: ${p.immediate_objective}` : '';
  const bf = p.backfill ? ' [BACKFILL — reconstructed from durable repo/session-log evidence, NOT originally captured live]' : '';
  return `${head}${obj}${bf}\n\`\`\`json\n${JSON.stringify(p)}\n\`\`\``;
}

async function deliver(packet) {
  await ensureStore();
  const res = await hf(`/workspaces/{ws}/sessions/${SESSION}/messages`, {
    method: 'POST',
    timeoutMs: WRITE_TIMEOUT_MS,
    body: { messages: [{ content: renderContent(packet), peer_id: PEER, metadata: { kind: 'continuity', id: packet.id, ts: packet.ts, seq: packet.seq, backfill: packet.backfill, session_id: packet.session_id } }] },
  });
  const ref = Array.isArray(res) && res[0]?.id ? res[0].id : (res?.id || null);
  return ref;
}

// ---- public: write ---------------------------------------------------------

// Deliver a continuity packet DIRECT to Honcho. On failure returns an honest
// {ok:false, error} — never silent. No spool: a bounded local retry is added
// only if delivery is found to genuinely fail in use (Warwick's scope ruling).
export async function writeContinuity(state, opts = {}) {
  const packet = buildPacket(state, opts);
  try {
    const ref = await deliver(packet);
    return { ok: true, id: packet.id, ref, packet };
  } catch (e) {
    return { ok: false, id: packet.id, error: e.message, packet };
  }
}

// ---- public: read ----------------------------------------------------------

// ---- listing: correct under an UNESTABLISHED pagination contract -----------
//
// WO-OR-18. This used to be ONE request for `{size: 50}`, and it silently returned an
// EARLY window rather than the newest messages. Measured against the live store on
// 2026-08-02 (Larry's probe, supplied to this Work Order as an input — not measured by
// the author of this code, see "WHAT IS NOT ESTABLISHED"): 86 packets had been built,
// `readLatest` could see 50, and the newest it could reach was seq 51, timestamped some
// fifteen hours earlier. Packets 52-86 were unreachable through this path.
//
// The consequence was not academic. That stale packet was injected into a live session's
// continuity brief and named the wrong programme phase. Recovery held only because the
// packet carries the git-map pointer and the map is the authority — the pointer itself
// was wrong. A read path that returns an old answer with no indication that it is old is
// the precise failure this module was built to end.
//
// WHAT IS NOT ESTABLISHED, AND IS THEREFORE NOT ASSUMED HERE. Nobody has established this
// API's pagination CONTRACT: not its cursor fields, not `has_more`, not whether a `page`
// field is accepted at all, not its ordering guarantee. Only the SYMPTOM above was
// measured. `services/obsidiwikai/src/clients/honcho.mjs` talks to the same host but
// never calls `messages/list`, so the estate holds no second witness either.
//
// So this walks the list UNDER UNCERTAINTY, and the design rule is that every plausible
// server behaviour has to land somewhere safe rather than somewhere clever:
//
//   * server honours `page`          -> pages are walked to exhaustion; the newest is found.
//   * server IGNORES `page` and re-serves the identical window
//                                    -> the repeat-detection guard stops after the second
//                                       request; page 1 is kept and `complete: false` is
//                                       reported. No worse than the old behaviour, and it
//                                       says so instead of looking finished.
//   * server REJECTS the extra field -> the follow-up request throws, page 1 is already in
//                                       hand, so it is kept and reported incomplete. Only a
//                                       failure on the FIRST page is a real Honcho failure,
//                                       and that still propagates to the caller.
//   * server is cursor-based         -> a cursor field, if the response offers one, is
//                                       echoed back on the next request.
//   * server returns newest-first    -> harmless. `readLatest` sorts regardless.
//
// `size` stays at 50 because 50 is the number the server was MEASURED to return, and the
// map records `size: 500` being capped to the same 50. Asking for more buys nothing and
// would be a request shape nobody has ever observed this server answer.
const LIST_PAGE_SIZE = 50;
const MAX_LIST_PAGES = 40; // 2,000 packets. A bound, not a belief about the store's size.

// The ONE place in the read path that touches the network. Injectable so the suite can
// drive every branch enumerated above without a network call and without a credential.
async function fetchMessagePage({ page, cursor }) {
  const body = { size: LIST_PAGE_SIZE };
  if (page > 1) body.page = page;
  if (cursor != null) body.cursor = cursor;
  return hf(`/workspaces/{ws}/sessions/${SESSION}/messages/list`, { method: 'POST', body });
}

function cursorFrom(res) {
  if (!res || typeof res !== 'object') return null;
  for (const k of ['next_cursor', 'nextCursor', 'cursor', 'next']) {
    const v = res[k];
    if (typeof v === 'string' && v.length) return v;
    if (typeof v === 'number') return v;
  }
  return null;
}

function itemKey(it, index) {
  if (it && typeof it === 'object') {
    if (typeof it.id === 'string' || typeof it.id === 'number') return `id:${it.id}`;
    return `c:${JSON.stringify(it.content ?? '')}:${JSON.stringify(it.metadata ?? '')}`;
  }
  return `i:${index}:${JSON.stringify(it)}`;
}

/**
 * listAllMessages(opts) -> { items, pages, complete }
 *
 * `complete: false` means the walk stopped for a reason OTHER than the server indicating
 * there was nothing left — a repeated window, a rejected follow-up request, or the page
 * cap. It is reported rather than smoothed over: a truncated read that presents itself as
 * complete is the same class of defect as the stale packet above.
 */
export async function listAllMessages({ fetchPage = fetchMessagePage, maxPages = MAX_LIST_PAGES } = {}) {
  const items = [];
  const seen = new Set();
  let cursor = null;
  let pages = 0;
  let complete = false;

  for (let page = 1; page <= maxPages; page++) {
    let res;
    try {
      res = await fetchPage({ page, cursor });
    } catch (e) {
      // A FIRST-page failure is a genuine Honcho failure and the caller must hear it.
      // A LATER-page failure means this server does not accept the follow-up shape; we
      // already hold everything the old single-request path would have returned.
      if (page === 1) throw e;
      break;
    }
    pages = page;

    const batch = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    if (!batch.length) { complete = true; break; }

    let added = 0;
    for (let i = 0; i < batch.length; i++) {
      const k = itemKey(batch[i], i);
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(batch[i]);
      added++;
    }

    // THE TERMINATION GUARD THAT MAKES THE REST SAFE. A server that ignores the
    // pagination field re-serves the identical window indefinitely; without this the loop
    // would run to the cap on every single call, turning one request into forty. Nothing
    // new on a page means there is nothing more to get.
    if (added === 0) break;

    cursor = cursorFrom(res);

    // A short page is the conventional end-of-list signal, and it is the only positive
    // "there is no more" this code is willing to act on.
    if (batch.length < LIST_PAGE_SIZE && cursor == null) { complete = true; break; }
  }

  return { items, pages, complete };
}

async function listMessages(opts) {
  return (await listAllMessages(opts)).items;
}

function parsePacketFromContent(content) {
  const m = String(content || '').match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
}

// Return the newest continuity packet, preferring live (non-backfill) over
// backfill when timestamps tie. This is the EXACT path a fresh session's
// reorientation uses. Throws on Honcho failure so the caller reports honestly.
//
// WO-OR-18: it now reads EVERY page it can reach, not the first fifty messages. The sort
// below was always correct and was never the defect — it was being handed the wrong fifty
// packets to sort. `complete` is passed through so a caller can say when the newest packet
// is only the newest of a truncated read.
export async function readLatest(opts = {}) {
  const { items, pages, complete } = await listAllMessages(opts);
  const packets = items.map((it) => parsePacketFromContent(it.content)).filter((p) => p && p.kind === 'continuity');
  if (!packets.length) return null;
  packets.sort((a, b) => {
    const ta = Date.parse(a.ts) || 0, tb = Date.parse(b.ts) || 0;
    if (tb !== ta) return tb - ta;
    if ((b.seq || 0) !== (a.seq || 0)) return (b.seq || 0) - (a.seq || 0);
    return (a.backfill === b.backfill) ? 0 : (a.backfill ? 1 : -1); // live before backfill on a tie
  });
  return { latest: packets[0], count: packets.length, pages, complete };
}

// Rendered brief for the SessionStart hook. Never throws: an unreachable Honcho
// yields an HONEST unavailable note plus the local cached state if present.
export async function readContinuityBrief() {
  try {
    const r = await readLatest();
    if (!r) {
      return '⟦GOV⟧ HONCHO CONTINUITY: reachable, but NO continuity packet stored yet. This is the authoritative source of current focus; until one is written, focus is genuinely unknown.';
    }
    const p = r.latest;
    const lines = [
      '⟦GOV⟧ HONCHO CONTINUITY — AUTHORITATIVE current focus (read from Honcho this session):',
      `  • focus: ${p.focus || '(unset)'}`,
      p.immediate_objective ? `  • immediate objective: ${p.immediate_objective}` : null,
      p.next_action ? `  • EXACT next action: ${p.next_action}` : null,
      p.warwick_last_request ? `  • Warwick's most recent request: ${p.warwick_last_request}` : null,
      fmtList('accepted decisions', p.accepted_decisions),
      fmtList('completed', p.completed),
      fmtList('unresolved blockers/decisions', p.blockers),
      p.notes ? `  • notes: ${p.notes}` : null,
      `  • packet ${p.id} @ ${p.ts}${p.backfill ? ' [BACKFILL]' : ''} (${r.count} packet(s) read over ${r.pages} page(s))`,
      // WO-OR-18. An incomplete read may have missed a NEWER packet, and the whole point
      // of this brief is that it is authoritative. If the walk stopped early, the brief
      // must not present its answer as the last word. Silence here would recreate the
      // exact defect that made this session's brief name the wrong phase.
      r.complete === false
        ? '  ⚠️ PAGINATION INCOMPLETE — the message list could not be walked to the end, so a NEWER packet may exist and be unread. Treat this focus as possibly stale and prefer the git map.'
        : null,
      '  This is the source of truth for what Warwick is doing. Do NOT present an unrelated project menu and do NOT ask Warwick to re-explain — the focus is known.',
    ].filter(Boolean);
    return lines.join('\n');
  } catch (e) {
    const cached = readJson(STATE_FILE, null);
    const base = `⟦GOV⟧ HONCHO CONTINUITY: UNAVAILABLE this session (${String(e.message).slice(0, 140)}). Cross-session recall via Honcho could not be read — say so, do not fake it.`;
    if (cached && cached.focus) {
      return `${base}\n  Local cached focus (last known, NOT confirmed against Honcho): ${cached.focus} — next: ${cached.next_action || '(unset)'}.`;
    }
    return base;
  }
}

// ---- local authoritative state ---------------------------------------------

export function loadState() {
  return readJson(STATE_FILE, {
    focus: null, immediate_objective: null, warwick_last_request: null,
    accepted_decisions: [], completed: [], blockers: [], next_action: null, notes: null,
    updated_at: null,
  });
}

export function saveState(patch) {
  const cur = loadState();
  const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
  atomicWriteJson(STATE_FILE, next);
  return next;
}

// ---- CLI -------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true';
      // repeatable flags accumulate into arrays
      if (out[k] === undefined) out[k] = v;
      else if (Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    } else out._.push(a);
  }
  return out;
}

function asList(v) { return v === undefined ? undefined : (Array.isArray(v) ? v : [v]); }

async function cli() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'read';
  const a = parseArgs(argv.slice(1));

  if (cmd === 'set') {
    const patch = {};
    for (const k of ['focus', 'immediate_objective', 'warwick_last_request', 'next_action', 'notes']) {
      if (a[k] !== undefined) patch[k] = a[k];
    }
    for (const k of ['accepted_decisions', 'completed', 'blockers']) {
      if (a[k] !== undefined) patch[k] = asList(a[k]);
    }
    const s = saveState(patch);
    process.stdout.write(JSON.stringify(s, null, 2) + '\n');
    return 0;
  }

  if (cmd === 'write' || cmd === 'stop') {
    // 'stop' is a Stop hook and always gets JSON piped on stdin; 'write' is manual
    // and must never block waiting for stdin that will not come.
    //
    // Read stdin ONCE. fd 0 is not re-readable, and this payload now has two consumers:
    // the session id below, and the health sample immediately after.
    const rawStdin = cmd === 'stop' ? readStdinRaw() : '';
    const sessionId = a.session || (cmd === 'stop' ? sessionIdFrom(rawStdin) : null);

    // WO-OR-05 — the context-health sample, written from the transcript.
    //
    // THIS RUNS BEFORE THE DEDUPE BELOW, DELIBERATELY. The continuity dedupe returns
    // early whenever the semantic state is unchanged for this session, which is the
    // COMMON case — most turns change nothing. But the health sample is per-turn
    // telemetry, and the footer treats a sample older than twenty minutes as stale, so a
    // sample written only when the continuity packet changes would go stale mid-session
    // and put the footer straight back to BLIND. Sampling first makes the sample
    // independent of whether Honcho had anything to say.
    //
    // Fully guarded and non-fatal: a Stop hook that throws ends Warwick's turn with an
    // error, and telemetry is never worth that.
    if (cmd === 'stop') {
      try {
        let storeOpts = {};
        try {
          const cwd = JSON.parse(rawStdin)?.cwd;
          // Key the store on the SESSION's cwd, not this hook process's, so the sample
          // lands under the same project key the footer will look under.
          if (typeof cwd === 'string' && cwd.length) storeOpts = { cwd };
        } catch { /* fall back to the default cwd */ }
        sampleFromTranscript(rawStdin, { sampledAt: new Date().toISOString(), storeOpts });
      } catch { /* never break the boundary hook */ }
    }

    const state = loadState();
    if (!state.focus && cmd === 'write' && a.focus) state.focus = a.focus; // convenience

    // Stop fires per turn. Dedupe so an unchanged (state, session) is written ONCE
    // per session — every turn-end would otherwise spam Honcho. A new session or a
    // changed focus always writes. 'write' (manual/explicit boundary) never dedupes.
    if (cmd === 'stop') {
      const key = String(hashStr(JSON.stringify({
        f: state.focus, n: state.next_action, d: state.accepted_decisions,
        c: state.completed, b: state.blockers, s: sessionId,
      })));
      const last = readJson(LAST_FILE, {});
      if (last.key === key) {
        process.stdout.write(JSON.stringify({ command: 'stop', skipped: 'unchanged for this session' }) + '\n');
        return 0;
      }
      const r = await writeContinuity(state, { reason: 'stop', sessionId });
      if (r.ok) atomicWriteJson(LAST_FILE, { key, id: r.id, at: new Date().toISOString() });
      process.stdout.write(JSON.stringify({ command: 'stop', ...summ(r) }) + '\n');
      return 0; // a boundary hook never signals failure via exit code
    }

    const r = await writeContinuity(state, { reason: 'write', sessionId, backfill: a.backfill === 'true' });
    process.stdout.write(JSON.stringify({ command: 'write', ...summ(r) }, null, 2) + '\n');
    return r.ok ? 0 : 3;
  }

  if (cmd === 'backfill') {
    // deliver a single backfill packet composed from flags
    const state = {
      focus: a.focus || null,
      immediate_objective: a.objective || null,
      warwick_last_request: a.request || null,
      accepted_decisions: asList(a.decision) || [],
      completed: asList(a.completed) || [],
      blockers: asList(a.blocker) || [],
      next_action: a.next || null,
      notes: a.notes || null,
    };
    const r = await writeContinuity(state, { reason: 'backfill', backfill: true });
    process.stdout.write(JSON.stringify({ command: 'backfill', ...summ(r) }, null, 2) + '\n');
    return r.ok ? 0 : 3;
  }

  if (cmd === 'read') {
    if (a.json === 'true') {
      try { const r = await readLatest(); process.stdout.write(JSON.stringify(r, null, 2) + '\n'); }
      catch (e) { process.stdout.write(JSON.stringify({ error: e.message }) + '\n'); return 3; }
      return 0;
    }
    process.stdout.write((await readContinuityBrief()) + '\n');
    return 0;
  }

  process.stderr.write(`unknown command: ${cmd}\n`);
  return 2;
}

function summ(r) {
  return { ok: r.ok, id: r.id, ref: r.ref || null, error: r.error || null };
}

// Stop hooks receive JSON on stdin carrying session_id, cwd and transcript_path.
// Best-effort, sync, non-blocking. SPLIT from the session-id lookup (WO-OR-05) because
// fd 0 can only be drained once and the payload now has more than one consumer.
function readStdinRaw() {
  try {
    return readFileSync(0, 'utf8');
  } catch { return ''; }
}

function sessionIdFrom(raw) {
  try {
    const j = JSON.parse(raw);
    return j.session_id || j.sessionId || null;
  } catch { return null; }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  cli().then((code) => { process.exitCode = code || 0; }).catch((e) => {
    process.stderr.write('continuity error: ' + e.message + '\n');
    process.exitCode = 0; // a boundary hook must never crash the session
  });
}

export { STATE_FILE, SESSION as CONTINUITY_SESSION, PEER as CONTINUITY_PEER };
