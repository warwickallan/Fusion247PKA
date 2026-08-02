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

// The exact text substituted for a field the privacy scrub withholds. Held ONCE because the
// CLI now reports which SUPPLIED fields were withheld (WO-OR-23), and a second copy of this
// string would let the report drift away from the thing it reports on without anyone noticing.
const WITHHELD_MARK = '[withheld: restricted per privacy rules]';

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
  if (RESTRICTED.test(s)) return { clean: WITHHELD_MARK, hit: true };
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

// ---- listing: the DOCUMENTED v3 pagination contract ------------------------
//
// WO-OR-18 walked the list DEFENSIVELY because nobody had established this API's pagination
// contract. WO-OR-21 replaces that guesswork: the contract is now documented and
// cross-confirmed against the vendor's own generated client — see
// Deliverables/2026-08-02-pax-honcho-messages-list-contract.md.
//
// THE DEFECT, IN ONE LINE: `page`, `size` and `reverse` are QUERY-STRING parameters. This
// code put them in the BODY, and the request body model accepts exactly one property —
// `filters`. So the server discarded them in silence and applied its own defaults:
// page=1, size=50, reverse=false, OLDEST FIRST. No 400, no warning, just plausible
// default-shaped data.
//
// That one fact explains every symptom at once: the 50-item window (the DEFAULT, never a
// cap), the newest reachable packet being some fifteen hours old (oldest-first, so the far
// end of page 1 was seq 51 of 86), and page 2 returning an identical window (an ignored
// `page` re-serves page 1). The consequence was not academic — that stale packet was
// injected into a live session's continuity brief and named the wrong programme phase.
//
// WHY IT SURVIVED, AND WHAT THE SUITE NOW DOES ABOUT IT: a parameter in the wrong LOCATION is
// indistinguishable from a server that ignores you. Both return plausible data. So the tests
// assert the request SHAPE — page/size/reverse in the query string, nothing pagination-shaped
// in the body — and not merely the packet that comes back. A test that checked only the
// returned packet would have passed against the broken code too.
//
// THE CONTRACT THIS IS BUILT TO:
//   * POST .../v3/workspaces/{ws}/sessions/{session}/messages/list?reverse=true&size=100&page=1
//     with body {}. Use /v3 — the SDK docs list the operation under /v2 and ONLY the prefix
//     differs; if a request 404s, check the prefix first.
//   * Envelope {items, total, page, size, pages}. NO cursor, NO has_more, no continuation
//     token. A walk terminates on `page >= pages`, which is known after the FIRST response.
//   * `size` default 50, MAXIMUM 100. 50 was never a cap — we never sent a size. size > 100
//     is HTTP 422, NOT a clamped 50, so it is refused here before it is ever sent.
//   * reverse=false -> order_by(Message.id ASC) over a monotonic BigInteger identity, i.e.
//     genuinely chronological. reverse=true is newest-first, which is what this path wants.
//
// WHAT IS STILL NOT ESTABLISHED, AND IS THEREFORE NOT ASSUMED: rate limits (NOT FOUND in any
// official source — unknown, not unlimited), and whether the deployed server matches the
// `main` branch that was read. The defensive branches below are therefore KEPT rather than
// deleted. They now cost one comparison on a path that normally terminates on the first
// response, and each still lands somewhere safe:
//
//   * server reports `pages`         -> the walk terminates on page >= pages. THE NORMAL PATH.
//   * server omits `pages`           -> fall back to short-page / repeat detection.
//   * server IGNORES `page` and re-serves the identical window
//                                    -> the repeat guard stops after the second request and
//                                       reports `complete: false` instead of looking finished.
//   * a LATER page fails             -> everything already read is kept, `complete: false`.
//                                       A FIRST-page failure is a real Honcho failure and
//                                       still propagates to the caller.
//   * server offers a cursor         -> echoed back by the walker. INERT against the real
//                                       transport: the documented contract has no cursor
//                                       parameter, so fetchMessagePage never sends one.
//   * server returns oldest-first    -> harmless. `readLatest` sorts regardless (see below).
//
// `complete: false` must stay REACHABLE and must stop firing on the normal path. Both halves
// matter: a read path that can only report success is how the original defect hid, and a
// warning that fires every time is one nobody reads.
const LIST_PAGE_SIZE = 100; // the DOCUMENTED MAXIMUM; today's 86 packets fit in ONE request
const MAX_PAGE_SIZE = 100;  // hard ceiling. 101+ is a 422 from fastapi_pagination, not a clamp
const LIST_REVERSE = true;  // newest-first: this path wants the newest packet, not the oldest
const MAX_LIST_PAGES = 40;  // 4,000 messages. A bound, not a belief about the store's size.

/**
 * The ONE place in the read path that touches the network.
 *
 * `request` is injectable (defaulting to `hf`) so the suite can assert the EXACT (path,
 * options) pair this builds, with no network call and without entering the credential path.
 * That injection is the control for this Work Order's defect: asserting on a pure
 * request-builder would prove the builder correct without proving this function USES it, and
 * "the right value computed somewhere it is never used" is the precise shape of the bug being
 * fixed here.
 *
 * `hf()` concatenates the path into the URL verbatim and substitutes only the `{ws}` token,
 * so a query string travels unchanged. It needed no modification to carry these.
 */
export async function fetchMessagePage({
  page = 1,
  size = LIST_PAGE_SIZE,
  reverse = LIST_REVERSE,
  request = hf,
} = {}) {
  // Refuse an out-of-range size BEFORE sending it. The server answers an over-limit size with
  // 422 rather than clamping, so code written on the "it clamps" assumption fails differently
  // than expected. Loudly here beats mysteriously there.
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw new Error(`continuity: size must be an integer 1..${MAX_PAGE_SIZE} (got ${size}); the server answers an over-limit size with HTTP 422, it does NOT clamp`);
  }
  // `page` is 1-based; page=0 is a 422 (minimum: 1).
  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`continuity: page must be an integer >= 1 (got ${page}); page is 1-based and page=0 is a 422`);
  }
  // QUERY STRING — this is the whole fix. Field order mirrors the documented call so the two
  // can be compared literally.
  const qs = new URLSearchParams({ reverse: String(!!reverse), size: String(size), page: String(page) });
  // BODY — the model accepts exactly one property, `filters`. `{}` is valid and is what the
  // documented call sends. NOTHING pagination-shaped may go here.
  return request(`/workspaces/{ws}/sessions/${SESSION}/messages/list?${qs}`, { method: 'POST', body: {} });
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
 *
 * WO-OR-21: the NORMAL termination is now `page >= pages`, read from the documented
 * envelope. With reverse=true and size=100 that is one request for any session up to 100
 * messages, and it stays correct as the session grows past that. The walk still runs to the
 * end rather than stopping at the newest packet, because `complete` is only an honest signal
 * if the walk was actually attempted, and `count` is only accurate if every page was read.
 */
export async function listAllMessages({
  fetchPage = fetchMessagePage,
  maxPages = MAX_LIST_PAGES,
  size = LIST_PAGE_SIZE,
  reverse = LIST_REVERSE,
} = {}) {
  const items = [];
  const seen = new Set();
  let cursor = null;
  let pages = 0;
  let complete = false;

  for (let page = 1; page <= maxPages; page++) {
    let res;
    try {
      res = await fetchPage({ page, cursor, size, reverse });
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

    // THE DOCUMENTED TERMINATION, and the one that fires on the normal path. `pages` is
    // authoritative and is present on the very first response, so the loop bound is known
    // after one call — no cursor, no short-page inference, no repeat-detection needed. When
    // the server supplies it, it decides, and the fallbacks below are not consulted.
    const totalPages = Number.isInteger(res?.pages) ? res.pages : null;
    if (totalPages !== null) {
      if (page >= totalPages) complete = true;
      if (complete) break;
      continue;
    }

    // ---- FALLBACKS, for a response that carries no `pages` --------------------
    cursor = cursorFrom(res);

    // A short page is the conventional end-of-list signal, and it is the only positive
    // "there is no more" this code is willing to act on. Compared against the size actually
    // REQUESTED, not a module constant — the walker owns the size it asked for.
    if (batch.length < size && cursor == null) { complete = true; break; }
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
//
// WO-OR-21: the request now asks for newest-first, so the newest packet arrives on page 1 —
// and the sort below is KEPT anyway, deliberately. It is not a workaround for an unknown
// server order: it is this module's own invariant, it costs one comparison over a list this
// size, and `reverse=true` and a defensive sort cannot disagree about which packet is newest.
// The sort is also what settles the two ties the server knows nothing about (equal
// timestamps -> higher seq; equal seq -> live beats backfill).
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
//
// WO-OR-21: `opts` is forwarded to readLatest so the suite can prove the ⚠️ INCOMPLETE line
// both FIRES when the walk is genuinely truncated and STAYS SILENT on the normal path.
// Default `{}` — the hook's behaviour is byte-for-byte what it was. Without this the
// user-visible half of the incompleteness signal could only be asserted by reaching the
// network, which no test here may do.
export async function readContinuityBrief(opts = {}) {
  try {
    const r = await readLatest(opts);
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

// ---- WO-OR-23: `write`'s argument contract ---------------------------------
//
// THE DEFECT THIS CLOSES. `write` used to consult exactly three of the flags it was handed:
// --session, --backfill, and --focus — the last only as a FALLBACK, applied when stored state
// had NO focus. Every other flag was parsed and dropped. A live run passing
// `--focus X --next Y --objective Z` therefore returned {"ok":true} with a fresh packet id,
// exit 0, while delivering the OLD stored focus. Three arguments discarded, and not one word
// about it anywhere in the output.
//
// It is the same defect class as the pagination bug above — a parameter accepted and silently
// ignored, producing plausible, correctly-shaped output. There it was Honcho doing it to us;
// here it was us doing it to ourselves. THE FAILURE IS NOT THE WRONG VALUE, IT IS THE ABSENCE
// OF A SIGNAL. So the rule is total: every flag on a `write` either changes what is delivered,
// or stops the command. Nothing in between, and nothing decided quietly.
//
// VOCABULARY — one name per field on this path. `write` accepts the CANONICAL state field
// names, which are exactly `set`'s, because `write` delivers the state `set` maintains.
// `backfill` composes a synthetic packet from scratch and keeps its own, different vocabulary.
// The two are deliberately NOT merged: aliasing them would change `backfill`'s contract and
// give one field two names inside one command. A backfill-style name handed to `write` is
// REFUSED with a pointer to the canonical one — helpful, but never silently accepted.
const WRITE_SCALAR_FIELDS = ['focus', 'immediate_objective', 'warwick_last_request', 'next_action', 'notes'];
const WRITE_LIST_FIELDS = ['accepted_decisions', 'completed', 'blockers'];
// Control flags: they steer the delivery rather than carrying state. Unchanged here, and
// deliberately exempt from the value checks below — `--backfill true` legitimately carries
// the literal string 'true'.
const WRITE_CONTROL_FLAGS = ['session', 'backfill'];
// `backfill`'s flag names -> the canonical name. Used ONLY to make a refusal helpful; this is
// not an alias table and nothing reads it to accept an argument.
const BACKFILL_FLAG_HINT = {
  next: 'next_action', objective: 'immediate_objective', request: 'warwick_last_request',
  decision: 'accepted_decisions', blocker: 'blockers',
};

/**
 * Decide what an explicit `write` can honour — BEFORE anything is persisted or delivered.
 *
 * Pure, and returns { patch, supplied, rejected }. A non-empty `rejected` means the command
 * must stop: nothing sent, nothing saved, non-zero exit. Two of the three rejection reasons
 * exist because THE FIX WOULD OTHERWISE MANUFACTURE A FRESH INSTANCE OF THE DEFECT IT
 * REPAIRS:
 *
 *   - `parseArgs` gives a flag with no value the literal string 'true'. Before this change a
 *     valueless `--focus` was harmlessly ignored; now that supplied arguments WIN, it would
 *     have quietly overridden the focus with the word "true".
 *   - `parseArgs` accumulates a repeated flag into an array. A repeated single-value field
 *     would have delivered an array where a string belongs.
 *
 * Both are refused by name rather than guessed at. `parseArgs` itself is untouched: `read
 * --json` and `backfill` depend on its current behaviour, and this Work Order owns `write`.
 */
function planWriteArgs(a) {
  const patch = {};
  const supplied = [];
  const rejected = [];
  for (const [k, v] of Object.entries(a)) {
    if (k === '_') continue;                       // positionals, not flags
    if (WRITE_CONTROL_FLAGS.includes(k)) continue; // handled by the delivery path, not state
    const isScalar = WRITE_SCALAR_FIELDS.includes(k);
    const isList = WRITE_LIST_FIELDS.includes(k);
    if (!isScalar && !isList) {
      rejected.push({ flag: k, why: 'unknown', hint: BACKFILL_FLAG_HINT[k] || null });
      continue;
    }
    if (isScalar && Array.isArray(v)) {
      rejected.push({ flag: k, why: 'repeated', count: v.length });
      continue;
    }
    const values = Array.isArray(v) ? v : [v];
    if (values.some((x) => x === 'true')) {
      rejected.push({ flag: k, why: 'valueless' });
      continue;
    }
    patch[k] = isList ? values : v;
    supplied.push(k);
  }
  supplied.sort();
  return { patch, supplied, rejected };
}

// The operator-visible refusal. It names every offending flag and what to use instead — a
// message that only said "bad arguments" would be the silence this Work Order exists to end,
// one level quieter.
function renderWriteRejections(rejected) {
  const accepted = [...WRITE_SCALAR_FIELDS, ...WRITE_LIST_FIELDS, ...WRITE_CONTROL_FLAGS];
  const lines = [
    `continuity write: REFUSED — ${rejected.length} supplied argument(s) cannot be honoured.`,
    'NOTHING was delivered to Honcho and local state was NOT changed.',
  ];
  for (const r of rejected) {
    if (r.why === 'unknown') {
      lines.push(r.hint
        ? `  --${r.flag}: not a \`write\` flag — did you mean --${r.hint}? (--${r.flag} is \`backfill\`'s name for that field; the two commands' vocabularies are deliberately separate.)`
        : `  --${r.flag}: not a \`write\` flag.`);
    } else if (r.why === 'repeated') {
      lines.push(`  --${r.flag}: supplied ${r.count} times, but it is a single-value field. The repeatable fields are --${WRITE_LIST_FIELDS.join(', --')}.`);
    } else {
      lines.push(`  --${r.flag}: supplied without a value. A flag with no value parses as the literal string "true", which would have become the delivered value.`);
    }
  }
  lines.push(`accepted by \`write\`: --${accepted.join(' --')}`);
  lines.push('exit 2 = bad usage, nothing sent. exit 3 = delivery failed. exit 0 = delivered.');
  return lines.join('\n') + '\n';
}

// What the operator is told about a SUCCESSFUL write. `overrode` and `state_persisted` make the
// durable effect visible rather than inferred; `withheld` and `truncated` are how an operator
// learns that a supplied value did not survive the privacy scrub or the field caps intact.
// A value altered on the way to the wire and not reported would be this same defect wearing a
// smaller hat.
function writeReport(plan, packet) {
  const withheld = [];
  const truncated = [];
  for (const f of plan.supplied) {
    const given = plan.patch[f];
    const sent = packet ? packet[f] : undefined;
    const sentValues = Array.isArray(sent) ? sent : [sent];
    if (sentValues.some((x) => x === WITHHELD_MARK)) withheld.push(f);
    if (Array.isArray(given) && Array.isArray(sent) && sent.length < given.length) truncated.push(f);
    else if (typeof sent === 'string' && sent.length === FIELD_CAP && sent.endsWith('…')) truncated.push(f);
  }
  return { overrode: plan.supplied, state_persisted: plan.supplied.length > 0, withheld, truncated };
}

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
    // WO-OR-23. Validate an explicit `write`'s arguments FIRST — before stdin, before the
    // health sample, before state is loaded, and long before anything is delivered. A refusal
    // must leave the machine exactly as it found it, so there is no half-applied write to
    // reason about afterwards.
    //
    // SCOPED TO `write` ON PURPOSE. `stop` is a Stop hook: it fires on every turn-end, it is
    // invoked with no flags, and a hook that exits non-zero ends Warwick's turn with an error.
    // Its behaviour here is byte-for-byte what it was.
    const writeArgs = cmd === 'write' ? planWriteArgs(a) : null;
    if (writeArgs && writeArgs.rejected.length) {
      process.stderr.write(renderWriteRejections(writeArgs.rejected));
      return 2;
    }

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

    // WO-OR-23. THE LINE THAT USED TO BE HERE WAS THE DEFECT:
    //
    //     if (!state.focus && cmd === 'write' && a.focus) state.focus = a.focus; // convenience
    //
    // `--focus` was a FALLBACK, applied only when stored state had none. Stored state normally
    // has one, so the stored value won and the supplied value vanished — silently, with ok:true.
    //
    // Now an explicitly supplied argument OVERRIDES the stored value, and it does so THROUGH
    // `saveState` — the same patch route `set` already uses. Warwick's requirement is that
    // supplied arguments "override stored VALUES", and packet-only would not have met it: `stop`
    // fires per turn, reloads STATE_FILE and delivers the OLD focus with a NEWER timestamp, so
    // latest-wins would bury the operator's override within a turn or two. An override reverted
    // by a background hook minutes later is this same false success in a slower costume, and
    // harder to catch, because the CLI output would have been true at the moment it printed.
    //
    // Persist happens BEFORE delivery and is not conditional on it: an unreachable Honcho must
    // not discard the operator's explicit instruction, and STATE_FILE is exactly what the
    // brief falls back to when Honcho cannot be read.
    let state = loadState();
    if (writeArgs && writeArgs.supplied.length) state = saveState(writeArgs.patch);

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
    // The report rides in the SAME object the operator already reads. A durable effect that
    // has to be inferred from a separate command is not visible.
    process.stdout.write(JSON.stringify({ command: 'write', ...summ(r), ...writeReport(writeArgs, r.packet) }, null, 2) + '\n');
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
