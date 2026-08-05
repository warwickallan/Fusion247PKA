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

import { readFileSync, writeFileSync, mkdirSync, renameSync, statSync, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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

async function ensureStore(request = hf) {
  await request('/workspaces', { method: 'POST', body: { id: honchoCtx().ws } });
  await request('/workspaces/{ws}/peers', { method: 'POST', body: { id: PEER } });
  await request('/workspaces/{ws}/sessions', { method: 'POST', body: { id: SESSION, peers: { [PEER]: {} } } });
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

// ---- the active Wayfinder map pointer (WP-2B(1)) ---------------------------
//
// WHAT THIS IS FOR. A fresh Larry, started ANYWHERE, must be able to open the correct
// current Wayfinder map without Warwick typing a path. `storedMapPath()` below already reads
// `p.map_path` for the rendered brief; until this landed NO writer ever set it, so it was
// null by construction and the pointer pointed at nothing.
//
// THE ONE RULE THAT SHAPES EVERY LINE BELOW — HONEST ABSENCE. `readContinuityBrief` prints
// whatever string it is handed as "likely active map" and does not check it. So this
// function is the ONLY place a confident wrong orientation can be prevented, and a confident
// wrong orientation is worse than a blank one (W-1, named by Warwick). Therefore: emit a
// path only when it is marker-identified, unambiguously selected, and VERIFIED TO EXIST.
// Anything less returns null and the field is omitted entirely. Never a guess, never a
// stale carry-forward — note in particular that `state.map_path` is never consulted, so a
// stale value in the local store cannot become tomorrow's orientation.
//
// WHY NOT A HARDCODED PATH. Warwick's Phase 2 scope is "shared, dependable myPKA services
// rather than things tied to a build, worktree or Larry remembering how to start them." A
// literal map filename in source is build-tied and is wrong the day the map changes.
//
// WHY NOT A REGISTRY, MANIFEST OR INDEX FILE (regrowth cap, binding). Nothing new is
// created to carry this. The map's own orientation block — which `CLAUDE.md` already
// mandates be copied VERBATIM into every Wayfinder map — is the marker, and git's own
// history is the recency signal. Both already exist for other reasons.
//
// WHY THE MARKER AND NOT THE FILENAME. Measured on this estate: the marker finds all six
// real maps including `2026-08-04-proofline-wayfinder-plan.md`, and correctly EXCLUDES
// `2026-08-01-vlogops-wayfinder-plan.md`, which a `*wayfinder-plan.md` filename filter would
// have swept in. Identity by content beats identity by naming convention.
//
// WHY GIT RECENCY AND NEVER FILESYSTEM mtime. A fresh clone or a new worktree stamps every
// file at checkout time — which is precisely the "started anywhere" case this exists for, so
// mtime is noise exactly when it is needed most. Commit recency is a property of the work.
//
// WHY BRANCH-SCOPED FIRST. Several maps are active in this estate at once. The map this
// branch is WORKING ON is the one it has touched since it diverged from `origin/main`;
// repo-wide recency is the weaker fallback for a branch that has touched none.
const WAYFINDER_MAP_MARKER = 'On a fresh resume, BEFORE using any tool or doing any work, visibly state';
const WAYFINDER_MAP_DIR = 'Deliverables';

// The default git seam, injectable — this module's neighbour `reorient.mjs` uses the same
// `DEFAULT_GIT_IO` idiom, so this is the existing pattern rather than new machinery. Every
// injected test below is PAIRED with a control asserting these defaults read REAL git and
// the REAL filesystem, so the seam can never end up testing a fiction.
export const DEFAULT_MAP_GIT_IO = {
  run: (args, cwd) =>
    execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      // stderr is DISCARDED, not inherited. This runs on the Stop hook path; a `fatal:` line
      // from a probe that is already represented honestly as "absent" is noise on a surface
      // Warwick reads. stdin is ignored so no probe can block waiting for input.
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 8 * 1024 * 1024,
    }).toString(),
  statSync,
};

// A failed git probe and a git probe that answered "nothing" both mean the same thing HERE —
// no pointer can be established — so both collapse to null deliberately. That is the opposite
// of `reorient.mjs`'s classified failures, and for a reason: this function has exactly one
// safe output for every uncertain case, and there is no rendered field for it to qualify.
function gitOut(io, cwd, args) {
  try {
    const out = io.run(args, cwd);
    return typeof out === 'string' ? out : null;
  } catch {
    return null; // `git grep -l` exits 1 on no match; git may be absent entirely
  }
}

// A candidate path must be repo-root-relative POSIX and inert. An absolute path would
// re-import the exact hardcoding defect this change exists to remove, and a control
// character would corrupt the rendered brief.
function safeRepoRelative(p) {
  const t = String(p == null ? '' : p).replace(/\\/g, '/').trim();
  if (!t) return null;
  for (let i = 0; i < t.length; i++) if (t.charCodeAt(i) < 0x20) return null; // control chars corrupt the brief
  if (t.startsWith('/') || /^[A-Za-z]:/.test(t)) return null; // absolute — never emitted
  if (t.split('/').includes('..')) return null;               // no escaping the repo root
  return t;
}

/**
 * Most recently COMMITTED candidate, in one git call.
 *
 * `git log --format=@%ct --name-only [range] -- <candidates>` walks newest-first, so the
 * FIRST time a path appears is its most recent touch. Returns
 * `{ path, ambiguous }`.
 *
 * `ambiguous: true` means two candidates are equally recent — the same commit, or the same
 * commit timestamp. There is no honest way to choose between them, so the caller emits
 * nothing rather than picking one. Guessing here is precisely the failure mode this whole
 * function exists to prevent.
 */
function mostRecentlyCommitted(io, cwd, candidates, range) {
  const args = ['log', '--format=@%ct', '--name-only'];
  if (range) args.push(range);
  args.push('--', ...candidates);
  const out = gitOut(io, cwd, args);
  if (!out) return { path: null, ambiguous: false };

  const wanted = new Set(candidates);
  const seen = new Map(); // path -> commit timestamp of its most recent touch
  let ts = null;
  for (const raw of out.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('@')) {
      const n = Number(line.slice(1));
      ts = Number.isFinite(n) ? n : null;
      continue;
    }
    if (ts === null) continue;
    const rel = safeRepoRelative(line);
    if (rel && wanted.has(rel) && !seen.has(rel)) seen.set(rel, ts);
  }

  let path = null;
  let best = -Infinity;
  let ambiguous = false;
  for (const [rel, when] of seen) {
    if (when > best) { best = when; path = rel; ambiguous = false; }
    else if (when === best) { ambiguous = true; }
  }
  return { path, ambiguous };
}

/**
 * The repo-root-relative POSIX path of the Wayfinder map this checkout is working on, or
 * null when that cannot be ESTABLISHED. Null is a legitimate, expected answer.
 */
export function resolveActiveMapPath({ cwd = process.cwd(), git = DEFAULT_MAP_GIT_IO } = {}) {
  const io = git || DEFAULT_MAP_GIT_IO;
  const rootOut = gitOut(io, cwd, ['rev-parse', '--show-toplevel']);
  const repoRoot = rootOut ? rootOut.trim() : '';
  if (!repoRoot) return null; // not a git repository — nothing to point at

  // EVERY REMAINING PROBE RUNS FROM THE REPOSITORY ROOT, not from `cwd`. `git grep` and
  // `git log` resolve their pathspecs relative to the CURRENT DIRECTORY, so a session started
  // in a subdirectory — `tools/governor`, say — asked git about a `Deliverables` that does not
  // exist there and went silently blind. "Started anywhere" is the whole point of this
  // function, so anywhere includes a subdirectory.
  //
  // IDENTIFY. Tracked files only, which is not a limitation: selection is by commit history,
  // so a file with no commits could never be chosen anyway.
  const grep = gitOut(io, repoRoot, ['grep', '-l', '--full-name', '-F', WAYFINDER_MAP_MARKER, '--', WAYFINDER_MAP_DIR]);
  if (!grep) return null;
  const candidates = [...new Set(grep.split(/\r?\n/).map(safeRepoRelative).filter(Boolean))];
  if (!candidates.length) return null;

  // SELECT. Branch-scoped first; repo-wide only when this branch has touched no map at all.
  const mergeBase = gitOut(io, repoRoot, ['merge-base', 'origin/main', 'HEAD']);
  const base = mergeBase ? mergeBase.trim() : '';
  let picked = base ? mostRecentlyCommitted(io, repoRoot, candidates, `${base}..HEAD`) : { path: null, ambiguous: false };
  // The fallback fires ONLY on an empty branch scope. An ambiguous result always carries a
  // path, so it can never fall through to the repo-wide query and be quietly resolved by the
  // weaker rule — which is why one guard below is enough. An earlier revision had a second
  // guard here; mutation testing showed nothing could make it fail, and a check no test can
  // fail is not a check, it is dead code wearing a safety badge.
  if (!picked.path) picked = mostRecentlyCommitted(io, repoRoot, candidates, null);
  // Ambiguity is never resolved by guessing: two equally-recent maps means silence.
  if (picked.ambiguous || !picked.path) return null;

  // VERIFY IT EXISTS. The acceptance property says "verified to exist" for a reason: a path
  // that resolves to nothing renders identically to one that resolves to the right map.
  try {
    if (!io.statSync(join(repoRoot, picked.path)).isFile()) return null;
  } catch {
    return null;
  }
  return picked.path;
}

export function buildPacket(state, { reason = 'manual', sessionId = null, backfill = false, cwd = process.cwd(), git = DEFAULT_MAP_GIT_IO } = {}) {
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

  // The pointer is RESOLVED here from the repository, and is deliberately NOT read from
  // `state`. That is the whole difference between a pointer and a stale carry-forward: a
  // wrong path that was once right renders exactly like a right one, so there is no route
  // by which yesterday's value can become today's orientation.
  //
  // Guarded, because this runs on the Stop hook path and a hook that throws ends Warwick's
  // turn with an error. Every failure lands on the honest-absent branch.
  let mapPath = null;
  try {
    mapPath = resolveActiveMapPath({ cwd, git });
  } catch {
    mapPath = null;
  }
  if (mapPath != null) {
    // Same privacy discipline as every other field — NOT a bypass. But a withheld value is
    // not a path: emitting WITHHELD_MARK here would have the render print the withholding
    // notice as the "likely active map", which is the confident-wrong-orientation failure
    // wearing a compliance badge. So a hit marks the packet restricted and drops the field.
    const r = scrub(mapPath);
    restricted = restricted || r.hit;
    mapPath = r.hit ? null : r.clean;
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
    // OMITTED ENTIRELY when it could not be established — never null, never a guess. The
    // render's absent-form branch is the correct output when there is nothing true to say.
    ...(mapPath ? { map_path: mapPath } : {}),
    ...clean,
  };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return h;
}

// ---- Section-5 pointer render (BUILD-020 external source repair) -----------
//
// The startup brief is a continuity POINTER with ZERO authority. It renders recall
// identity only — likely active map path, packet id, written timestamp, content age,
// content hash, last known focus, Warwick's last recorded request — plus the honest
// missing/unavailable/pagination states and a fixed open-the-map instruction. The
// stored `next_action`, `accepted_decisions`, `completed`, `blockers` and `notes`
// remain in the store for backward compatibility and are NEVER rendered here, on
// any branch. The single active Wayfinder map owns the next step; nothing this
// module prints is an instruction.

// Volatile per-delivery fields, excluded from the content hash so a re-persist of
// unchanged content renders the SAME hash (and a growing age) across sessions.
const VOLATILE_PACKET_FIELDS = ['id', 'ts', 'seq', 'reason', 'session_id', 'backfill', 'schema', 'kind'];

// Key-sorted canonical JSON — excludes the stored fields' ordering noise from the hash.
function canonicalJson(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}';
  }
  return JSON.stringify(v) ?? 'null';
}

// sha256, first 8 hex, over the canonical packet body with volatile fields excluded.
export function packetContentHash(packet) {
  const body = {};
  for (const [k, v] of Object.entries(packet || {})) {
    if (VOLATILE_PACKET_FIELDS.includes(k)) continue;
    body[k] = v;
  }
  return createHash('sha256').update(canonicalJson(body), 'utf8').digest('hex').slice(0, 8);
}

// Content timestamp = the write-timestamp of the last packet whose content hash
// differed from its predecessor. Packets arrive newest-first; walk back through the
// newest run of identical content and take the oldest write-timestamp in that run,
// so a re-persist of unchanged content does not reset the age.
function contentTimestampFrom(sortedPackets) {
  if (!sortedPackets.length) return null;
  const newestHash = packetContentHash(sortedPackets[0]);
  let ts = sortedPackets[0].ts;
  for (const p of sortedPackets) {
    if (packetContentHash(p) !== newestHash) break;
    ts = p.ts;
  }
  return ts;
}

function fmtAge(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '(unknown)';
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// The stored map path, rendered verbatim when present and plausible. A packet with
// no usable `map_path` renders the absent-form instead — continuity is then treated
// as absent; a guessed path is never substituted.
function storedMapPath(p) {
  const v = p ? p.map_path : null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || /[\r\n\u0000-\u001f]/.test(t)) return null;
  return t;
}

// ---- reader-side existence check (WP-2B(2), instruction D) ------------------
//
// WHY A SECOND CHECK WHEN THE WRITER ALREADY VERIFIED. `resolveActiveMapPath` verifies the
// map exists in the WRITER's checkout, at the moment the packet is written. The reader is a
// DIFFERENT checkout — that is the entire point of cross-session continuity — so a path that
// was true where it was written can be absent where it is read: another worktree, another
// branch, a clone made before the map landed. Measured on this estate, not imagined:
// `Deliverables/2026-08-04-proofline-wayfinder-plan.md` is real on `build-020/live-trial` and
// ABSENT in `C:\Fusion247PKA`, which sits on a `build-015/...` branch. Without this check the
// brief there prints a confident path to a file that is not present — W-1's failure, at the
// one moment orientation matters.
//
// WHY IT IS NOT ENGINEERED AROUND. The honest answer for that worktree is that continuity is
// absent until the branch carrying the map is the one it reads. That is a true limit of the
// design and is recorded as one; searching other branches for a plausible map, or falling back
// to a filename guess, would manufacture exactly the confident wrong orientation this whole
// mechanism exists to refuse.
//
// FAIL-SAFE DIRECTION, STATED SO IT IS NOT MISREAD AS A BUG. Every uncertain case — not a
// repository, git absent, an unsafe path, a stat error — resolves to NOT PRESENT. The two
// errors are not symmetric: a false absence costs a fresh Larry one look in `Deliverables/`;
// a false presence costs a confident wrong orientation. This leans the way that is cheap to
// be wrong.
export function mapPathPresentHere(mapPath, { cwd = process.cwd(), git = DEFAULT_MAP_GIT_IO } = {}) {
  const io = git || DEFAULT_MAP_GIT_IO;
  // The path arrives from a REMOTE store, so it is untrusted input to a `join`. An absolute
  // path or a `..` segment is refused before any filesystem call rather than normalised — the
  // render still names it, so nothing is hidden, but nothing outside the repository root is
  // ever probed on the strength of a stored string.
  //
  // THE TYPE GUARD IS NOT BELT-AND-BRACES, IT CLOSES A REAL HOLE FOUND BY TEST.
  // `safeRepoRelative` coerces with `String(...)` because its OTHER caller feeds it lines of
  // git output, which are strings by construction. Fed a JSON number from a stored packet it
  // returned `'42'` — a legitimate-looking relative path — and this function answered `true`
  // for a value that was never a path. `storedMapPath` happens to shield the render because
  // it requires a string, but this function is exported and must hold on its own: a guard
  // that only works because of what the current caller does is not a guard.
  if (typeof mapPath !== 'string') return false;
  const rel = safeRepoRelative(mapPath);
  if (!rel) return false;
  const rootOut = gitOut(io, cwd, ['rev-parse', '--show-toplevel']);
  const repoRoot = rootOut ? rootOut.trim() : '';
  if (!repoRoot) return false; // the READER's own root — never the writer's, never a constant
  try {
    return io.statSync(join(repoRoot, rel)).isFile() === true;
  } catch {
    return false;
  }
}

function renderContent(p) {
  const head = `⟦CONTINUITY⟧ focus: ${p.focus || '(unset)'} — next: ${p.next_action || '(unset)'}`;
  const obj = p.immediate_objective ? `\nobjective: ${p.immediate_objective}` : '';
  const bf = p.backfill ? ' [BACKFILL — reconstructed from durable repo/session-log evidence, NOT originally captured live]' : '';
  return `${head}${obj}${bf}\n\`\`\`json\n${JSON.stringify(p)}\n\`\`\``;
}

// `request` is injectable (defaulting to `hf`) — the SAME idiom `fetchMessagePage` already
// uses for the read path in this file, applied here so the write path can be proven with no
// network. Required by the write-side pointer protection below, whose tests need a
// `readLatest` and a `deliver` that agree on where "the store" is — not a second seam, the
// same one at one more call site.
async function deliver(packet, { request = hf } = {}) {
  await ensureStore(request);
  const res = await request(`/workspaces/{ws}/sessions/${SESSION}/messages`, {
    method: 'POST',
    timeoutMs: WRITE_TIMEOUT_MS,
    body: { messages: [{ content: renderContent(packet), peer_id: PEER, metadata: { kind: 'continuity', id: packet.id, ts: packet.ts, seq: packet.seq, backfill: packet.backfill, session_id: packet.session_id } }] },
  });
  const ref = Array.isArray(res) && res[0]?.id ? res[0].id : (res?.id || null);
  return ref;
}

// ---- public: write ---------------------------------------------------------

// ---- WRITE-SIDE POINTER PROTECTION (closes the race the read-side check cannot) ----------
//
// THE RACE. `continuity.json`/the Honcho session is ONE shared store written by every
// session's Stop hook across every worktree and build on this machine. Without this check,
// an honestly-resolved but STALE `map_path` — from a session left open in an old worktree,
// closed AFTER a more current session already posted the pointer that should stand — would
// silently become "the current map" on nothing more than post-time ordering. That is W-1
// (confident wrong orientation), moved from the read side (already closed above, by
// `mapPathPresentHere`) to the write side, which was never checked until now.
//
// THE SIGNAL IS SESSION START TIME, NOT MAP COMMIT-RECENCY (Warwick's ruling, superseding an
// earlier commit-recency design that was WRONG). A session that starts AFTER the stored
// pointer's last write represents genuinely current intent — including a DELIBERATE switch to
// an older, dormant build whose own map was committed long ago. Commit-recency would have
// rejected that deliberate switch outright, which is exactly backwards: it would have blocked
// the one case Warwick's own working pattern actually needs. Session-start-vs-last-write is
// the one signal that tells "an old session finally closing" apart from "a fresh session
// deliberately pointing somewhere old", because it is the one fact a stale session cannot
// fake — it started when it started, regardless of what it later points at.
//
// THE COMPARISON. `opts.sessionStartedAt` (an ISO string the CLI's `stop` handler resolves
// from the Stop hook's own `transcript_path` payload field — see `sessionStartFromTranscript`
// below) is compared against the `ts` of the packet `readLatest` currently reports as newest.
// `ts` is not a new field; it is the write-timestamp every packet has always carried. If this
// session started strictly AFTER that write, the candidate `map_path` is genuinely current and
// is written normally. Otherwise it is omitted — every OTHER field (focus, next_action, etc.)
// still writes normally, so only the pointer itself is protected. The honest-absent render
// logic already handles a packet with no `map_path` correctly (see `readContinuityBrief`
// above); this triggers that existing degradation, it does not build a new one.
//
// NOT A NEW MECHANISM. One more call site for `readLatest`, which already exists and is
// already used by the read path.
//
// ACCEPTED LIMITATIONS, NAMED RATHER THAN HIDDEN.
//   - No prior stored packet, an unparseable/absent `sessionStartedAt` (manual `write` and
//     `backfill` never supply one — they have no session to time), or a `readLatest` failure
//     (Honcho unreachable, a network blip) all fall back to the CURRENT unconditional-write
//     behaviour rather than blocking. A Stop hook that throws ends Warwick's turn with an
//     error (see the guard around `resolveActiveMapPath` above); a stricter guard here would
//     trade a rare race for a routine failure.
//   - The comparison is against the SINGLE newest stored packet, matching the reader's own
//     latest-wins semantics exactly (`readLatest` has never walked packet history, and this
//     does not start it walking now). It answers "is THIS write current relative to the last
//     one", not "what is the best map ever recorded across this session's whole history".
// Deliver a continuity packet DIRECT to Honcho. On failure returns an honest {ok:false,
// error} — never silent. No spool: a bounded local retry is added only if delivery is found
// to genuinely fail in use (Warwick's scope ruling, unchanged by the protection above).
// The two stored withhold codes. STABLE LITERALS, and that is load-bearing rather than
// stylistic: `map_path_withheld` is part of the packet's CONTENT, so it enters
// `packetContentHash`, so it steers the Stop-hook dedupe. A reason string carrying a network
// error message would change on every blip, defeat the dedupe, and write a packet per Stop.
// Diagnosis belongs in the render, which is why the explanatory prose lives beside the
// renderer and only the code is persisted.
const WITHHELD_STALE_SESSION = 'stale-session';
const WITHHELD_AUTHORITY_UNESTABLISHED = 'authority-unestablished';

/**
 * Should this packet's candidate `map_path` be withheld — and under which code?
 * Returns null to publish it.
 *
 * WP-3A(c). THE DEFECT THIS REPLACES, IN ONE LINE: the previous version ran a full
 * `readLatest` inside the write path and wrapped it in a `catch` that fell through to an
 * UNCONDITIONAL write. So the guard failed OPEN exactly when it could not do its job, and
 * E-F is the consequence — a slow Honcho made the read time out, the guard fell open, and the
 * stale pointer was KEPT. The two faults masked each other, and a test exercising either one
 * alone passed while both were broken.
 *
 * THE TWO CONSTRAINTS PULL AGAINST EACH OTHER AND BOTH ARE HONOURED HERE, rather than one
 * being traded for the other:
 *   - the guard must not silently do the wrong thing when it cannot establish authority — so
 *     an unestablished authority now WITHHOLDS the pointer instead of publishing it; and
 *   - a packet must not be silently lost — so the packet is still built, still delivered, and
 *     every other field still writes normally. Only the pointer is affected, and the fact
 *     that it was withheld is RECORDED ON THE PACKET rather than left as an absence.
 *
 * THAT LAST PART IS THE POINT. A silent `delete` made a withheld pointer byte-identical to a
 * packet that never had one, so the reader could not tell "this session declined to vouch for
 * its pointer" from "no map could be resolved at all" — two different situations with two
 * different next actions for whoever reads the brief.
 *
 * COST. One page, not a walk: `maxPages: 1`. The guard only needs the newest packet's `ts`,
 * and under a server that honours `reverse` the newest packet is on page 1 by construction —
 * while a server that does NOT honour it can no longer fool this guard, because
 * `latestIsAuthoritative` refuses to confirm an order it never saw. That is strictly LESS
 * network than the full walk this replaces (E-I: "doubles network work per session end"),
 * and it is one more call site for a function that already exists — not a new mechanism.
 */
async function mapPointerWithholdReason(sessionStartedAt, sessionId, readOpts) {
  const sessionStartMs = typeof sessionStartedAt === 'string' ? Date.parse(sessionStartedAt) : NaN;
  if (!Number.isFinite(sessionStartMs)) return WITHHELD_AUTHORITY_UNESTABLISHED;

  let current;
  try {
    current = await readLatest({ ...readOpts, maxPages: 1 });
  } catch {
    // Honcho unreachable, or a page-1 failure. THE READ FAILING IS NOT PERMISSION TO WRITE
    // THE POINTER — that inversion was the defect. The Stop hook still does not throw.
    return WITHHELD_AUTHORITY_UNESTABLISHED;
  }
  // A genuinely empty store: there is no prior pointer to displace, so a first-ever write
  // cannot be a regression. This is establishment, not a failure to establish.
  if (!current) return null;
  if (!current.latestIsAuthoritative) return WITHHELD_AUTHORITY_UNESTABLISHED;

  // ---- WHO WROTE IT — the question time alone cannot answer (Veritas D-1) ----------------
  //
  // EVERY CHECK ABOVE THIS LINE IS AN AUTHORITY CHECK AND STAYS AHEAD OF THIS ONE, DELIBERATELY.
  // Identity only means something once the newest packet has actually been established: a
  // `session_id` read off a packet that may not BE the newest proves nothing about the newest.
  // Putting this test in front of those would re-open the fail-open path in a new costume,
  // which is the one outcome the corrective dispatch refused. The ordering IS the safety, and
  // `AMD2 THE FAIL-OPEN PATH STAYS CLOSED` is the test that holds it in place.
  //
  // THE DEFECT THIS CLOSES. The comparison below is `sessionStartMs > priorWriteMs`, and
  // `priorWriteMs` advances on EVERY stored write — including this session's own. So after a
  // session's first packet its start time was permanently behind the last stored write, and
  // every later `stop` withheld the pointer for the rest of that session's life. Veritas found
  // it on the installed path: packet 154 (a `stop`) withheld the map path eight minutes after
  // manual packet 153 carried it, and latest-wins left a fresh session with no map at all.
  //
  // A timestamp says WHEN a packet was written, never WHO wrote it. The identity was already on
  // the packet — `session_id`, set by `buildPacket` from the Stop hook's own payload — and was
  // simply not consulted. Consulting it is the whole fix: no new field, no new call, no new
  // mechanism (§16.4).
  const priorSession = typeof current.latest.session_id === 'string' && current.latest.session_id
    ? current.latest.session_id
    : null;

  // AN UNATTRIBUTABLE PRIOR IS NOT A RIVAL. A manual `write`/`backfill` carries no `session_id`
  // because it is a person at a keyboard, not a session — so it can never be the "newer
  // session" this guard protects, and blocking on it is exactly what made the documented manual
  // escape route unusable: the very next Stop clobbered it. The dedupe cannot rescue that
  // either, because `map_path_withheld` is part of the content hash by design, so a
  // pointer-carrying packet and the Stop after it differ in content and the Stop is never
  // suppressed. Accepted limitation, named rather than hidden: a genuinely stale session
  // closing after a MANUAL write can now displace that manual pointer. That trade is deliberate
  // — the alternative is the shipped behaviour, which withholds on every Stop of every ordinary
  // session, and the read side still refuses a path absent from the reader's own checkout.
  if (priorSession === null) return null;

  // MY OWN EARLIER WRITE IS NOT A RIVAL EITHER. A session may always update its own pointer.
  if (sessionId && priorSession === sessionId) return null;

  // ---- A GENUINELY DIFFERENT SESSION WROTE IT — the case the guard exists for -------------
  const priorWriteMs = Date.parse(current.latest.ts);
  if (!Number.isFinite(priorWriteMs)) return WITHHELD_AUTHORITY_UNESTABLISHED;

  // Publish only when THIS session genuinely started after that OTHER session's write.
  return sessionStartMs > priorWriteMs ? null : WITHHELD_STALE_SESSION;
}

export async function writeContinuity(state, opts = {}) {
  const packet = buildPacket(state, opts);

  if (packet.map_path) {
    const { cwd, git, request, reason, sessionId, backfill, sessionStartedAt, ...readOpts } = opts;
    // NO SESSION TO TIME IS NOT A FAILURE TO ESTABLISH AUTHORITY, AND THE DIFFERENCE MATTERS.
    // A manual `write` or a `backfill` has no session start because it has no session — it is
    // a deliberate human act at a keyboard, not a hook firing at a turn end. Folding it into
    // the unestablished case would mean `continuity.mjs write` could never set a map pointer
    // again, which breaks the one command Larry uses by hand. An UNPARSEABLE value is a
    // different thing entirely and does land on the unestablished branch below.
    if (sessionStartedAt !== undefined && sessionStartedAt !== null) {
      const withheld = await mapPointerWithholdReason(sessionStartedAt, sessionId, readOpts);
      if (withheld) {
        delete packet.map_path;
        packet.map_path_withheld = withheld;
      }
    }
  }

  try {
    const ref = await deliver(packet, { request: opts.request });
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
 * listAllMessages(opts) -> { items, pages, total, complete, incompleteReason }
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
 *
 * WP-3A(a): TWO ADDITIONS, AND BOTH TURN AN INFERENCE INTO A POSITIVE CHECK.
 *
 *   1. `incompleteReason` REPLACES the bare boolean as the thing a caller can act on. A
 *      truncated walk is not one condition, it is five, and they do not mean the same thing
 *      to a reader: `page-failure` (a later page was rejected), `page-mismatch` (the server
 *      answered a page we did not ask for), `repeat-window` (it re-served the same window),
 *      `page-cap` (our own bound), `short-of-total` (the count does not add up). `complete`
 *      is kept — every existing caller and test reads it — and the reason travels beside it.
 *
 *   2. `page-mismatch` and `short-of-total` are the POSITIVE checks. Until now the only
 *      detection of a server ignoring `page` was the repeat guard, which is an INFERENCE from
 *      seeing nothing new; and nothing at all reconciled what was collected against the
 *      `total` the envelope declares. Both are one comparison against data already in hand,
 *      on a path that normally terminates on the first response. No extra request, no new
 *      mechanism, no new module — see §16.4.
 *
 * A NOTE ON `short-of-total`, so a false alarm is not later read as a bug: a packet written
 * BETWEEN our page 1 and our page 2 raises `total` under us, and the walk then reports
 * `short-of-total` for a store it read correctly. That is the safe direction and it is the
 * one being chosen deliberately — over-reporting incompleteness costs a reader one look at
 * the git map, while under-reporting it is the silent partial read this Work Package exists
 * to make impossible.
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
  let total = null;
  let complete = false;
  // The reason that stands if the loop simply runs out of iterations. Every early exit below
  // overwrites it, and reaching `complete` clears it — so there is no path on which an
  // incomplete walk carries no reason, which is the failure mode of a nullable field.
  let incompleteReason = 'page-cap';

  for (let page = 1; page <= maxPages; page++) {
    let res;
    try {
      res = await fetchPage({ page, cursor, size, reverse });
    } catch (e) {
      // A FIRST-page failure is a genuine Honcho failure and the caller must hear it.
      // A LATER-page failure means this server does not accept the follow-up shape; we
      // already hold everything the old single-request path would have returned.
      if (page === 1) throw e;
      incompleteReason = 'page-failure';
      break;
    }
    pages = page;
    if (Number.isInteger(res?.total)) total = res.total;

    // POSITIVE PAGE VERIFICATION. The envelope echoes the page it actually served. A server
    // that ignores `page` answers `page: 1` forever, and that is a fact we can READ rather
    // than deduce from the absence of new items. Checked BEFORE the batch is merged, because
    // a window we did not ask for is not evidence about the window we did. The repeat guard
    // below is KEPT for servers that omit the field — this is the stronger signal, not a
    // replacement for the weaker one.
    const answeredPage = Number.isInteger(res?.page) ? res.page : null;
    if (answeredPage !== null && answeredPage !== page) {
      incompleteReason = 'page-mismatch';
      break;
    }

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
    if (added === 0) { incompleteReason = 'repeat-window'; break; }

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

  // COUNT RECONCILIATION — the check that makes "complete" mean something arithmetic rather
  // than merely procedural. Every termination above answers "did the walk stop for a good
  // reason?"; none of them answers "do we actually hold everything?". A server that declares
  // `total: 149` and hands back 100 items has told us both facts and they disagree.
  if (complete && total !== null && items.length < total) {
    complete = false;
    incompleteReason = 'short-of-total';
  }

  return { items, pages, total, complete, incompleteReason: complete ? null : incompleteReason };
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
function newestFirstCompare(a, b) {
  const ta = Date.parse(a.ts) || 0, tb = Date.parse(b.ts) || 0;
  if (tb !== ta) return tb - ta;
  if ((b.seq || 0) !== (a.seq || 0)) return (b.seq || 0) - (a.seq || 0);
  return (a.backfill === b.backfill) ? 0 : (a.backfill ? 1 : -1); // live before backfill on a tie
}

/**
 * Did the SERVER hand these back newest-first? Established from the packets AS RECEIVED,
 * before this module's own sort destroys the evidence — which is why the check lives here and
 * not anywhere downstream.
 *
 * WHY THIS EXISTS AT ALL (WP-3A(a), and it is the hazard the Work Order was reframed around).
 * `reverse=true` is DOCUMENTED, and whether the DEPLOYED server honours it is NOT ESTABLISHED
 * — the module has said so in the block above `fetchMessagePage` since WO-OR-21. If it does
 * not, page 1 is the OLDEST hundred. At the store's measured size that is 100 of 149, so
 * `readLatest` would return a packet roughly fifty writes behind the frontier — while `pages`,
 * `total`, the repeat guard and the short-page rule all looked perfectly healthy, because
 * every one of them is a statement about the WALK and none is a statement about the ORDER.
 *
 * A strict decrease is REQUIRED, not merely an absence of increases: one packet, or a run of
 * identical timestamps, confirms nothing, and "no evidence against" is not confirmation. The
 * honest answer there is `false`, and `complete` then has to carry the weight instead.
 */
function ordersNewestFirst(received) {
  let sawStrictDecrease = false;
  for (let i = 1; i < received.length; i++) {
    const c = newestFirstCompare(received[i - 1], received[i]);
    if (c > 0) return false; // an OLDER packet arrived before a NEWER one — not newest-first
    if (c < 0) sawStrictDecrease = true;
  }
  return sawStrictDecrease;
}

export async function readLatest(opts = {}) {
  const { items, pages, total, complete, incompleteReason } = await listAllMessages(opts);
  const packets = items.map((it) => parsePacketFromContent(it.content)).filter((p) => p && p.kind === 'continuity');
  if (!packets.length) return null;
  const newestFirstConfirmed = ordersNewestFirst(packets);
  packets.sort(newestFirstCompare);
  return {
    latest: packets[0],
    count: packets.length,
    pages,
    total,
    complete,
    incompleteReason,
    newestFirstConfirmed,
    // THE FIELD EVERY CALLER MUST CONSULT BEFORE TREATING `latest` AS THE FRONTIER.
    //
    // `latest` is still returned when this is false — deliberately. Throwing would take the
    // brief's honest-degradation path away and would turn a slow page 2 into a broken Stop
    // hook, which is the fail-closed error this module has always refused. Warwick's bar for
    // (a) is "impossible or LOUD", and this is the loud half: the value is handed over with
    // the truth about it attached, and `readContinuityBrief` and `writeContinuity` below both
    // read it. A caller that ignores it is the defect; a reader that cannot tell is worse.
    //
    // TWO independent ways to establish it, and only one has to hold:
    //   - the walk reached the end (`complete`), so we hold every message whatever order they
    //     came in, and the sort above settles it; or
    //   - the server positively demonstrated newest-first ordering in what it did return, so
    //     page 1 holds the newest even though later pages were not read.
    latestIsAuthoritative: complete === true || newestFirstConfirmed === true,
    // Section-5 recall identity: hash of the newest content, and the write-timestamp
    // of the packet where that content last changed (not of the newest re-persist).
    contentHash: packetContentHash(packets[0]),
    contentTs: contentTimestampFrom(packets),
  };
}

// The render-side half of the withhold codes above. Prose lives HERE and not on the packet
// so that what is stored stays a stable literal (see the comment on the codes themselves) —
// the packet carries the fact, the renderer carries the explanation. An unrecognised code
// still renders, quoted verbatim, rather than being dropped: a packet written by a newer
// version of this module must never render as if it said nothing.
const WITHHELD_EXPLANATION = {
  [WITHHELD_STALE_SESSION]: 'that session started BEFORE the last stored write, so its pointer may have been a stale carry-forward from an older worktree',
  [WITHHELD_AUTHORITY_UNESTABLISHED]: 'the newest stored packet could not be established at write time, so there was nothing trustworthy to check the pointer against',
};

// Rendered brief for the SessionStart hook — a continuity POINTER with ZERO
// authority (BUILD-020 Section-5 render contract; the single active Wayfinder map
// alone owns the next step). Never throws: an unreachable Honcho yields an honest
// unavailable note plus the local cached focus if present.
//
// WO-OR-21: `opts` is forwarded to readLatest so the suite can prove the ⚠️ INCOMPLETE line
// both FIRES when the walk is genuinely truncated and STAYS SILENT on the normal path.
// Default `{}` — the hook's behaviour is byte-for-byte what it was. Without this the
// user-visible half of the incompleteness signal could only be asserted by reaching the
// network, which no test here may do.
//
// WP-2B(2): `cwd` and `git` are destructured OUT before the rest is forwarded to
// `readLatest`. They belong to the reader-side existence check, not to the message walk, and
// `listAllMessages` should never be handed a key it does not own.
export async function readContinuityBrief(opts = {}) {
  // NO DEFAULTS APPLIED HERE, DELIBERATELY. An earlier revision wrote
  // `cwd = process.cwd(), git = DEFAULT_MAP_GIT_IO` on this line. Mutation testing removed
  // both and the suite stayed green — because `mapPathPresentHere` already defaults exactly
  // the same two values, and a destructuring default fires on an explicit `undefined` just
  // as it does on an absent key. They were equivalent mutants: two homes for one default,
  // and a check no test can fail is not a check. Same finding as WP-2B(1)'s dead second
  // guard, same disposition. The defaults live in one place, where they are used.
  const { cwd, git, ...listOpts } = opts;
  try {
    const r = await readLatest(listOpts);
    if (!r) {
      return '⟦GOV⟧ CONTINUITY POINTER (Honcho): reachable, but no continuity packet stored yet — recall is genuinely empty. Orient from `Deliverables/` per `CLAUDE.md` Step 2.';
    }
    const p = r.latest;
    const mapPath = storedMapPath(p);
    // WITHHELD IS NOT MISSING (WP-3A(b)). The write-side guard above declines to publish a
    // pointer it cannot vouch for, and it now says so on the packet. Rendering that as "map
    // path missing or invalid" would tell the reader the writing session had no map, when in
    // fact it had one and deliberately refused to stand behind it. Different fact, different
    // diagnosis — and until this branch existed the two were indistinguishable, which is
    // exactly the silence E-F describes.
    const withheldCode = !mapPath && typeof p.map_path_withheld === 'string' ? p.map_path_withheld.trim() : '';
    if (withheldCode) {
      return [
        '⟦GOV⟧ CONTINUITY POINTER (Honcho): MAP POINTER WITHHELD BY THE WRITER — recall only, ZERO authority.',
        `  • the session that wrote this packet HELD a map path and deliberately did not publish it: ${WITHHELD_EXPLANATION[withheldCode] || `reason code "${withheldCode}"`}`,
        `  • packet: ${p.id} written ${p.ts} — content age ${fmtAge(r.contentTs)}, content hash ${r.contentHash}`,
        '  → This is NOT "no map exists". Open the active Wayfinder map under `Deliverables/` per `CLAUDE.md` Step 2 and derive the current state and the next action from it. Nothing in this block is an instruction.',
      ].join('\n');
    }
    if (!mapPath) {
      return '⟦GOV⟧ CONTINUITY POINTER (Honcho): map path missing or invalid — treat continuity as absent and orient from `Deliverables/` per `CLAUDE.md` Step 2.';
    }
    // THE RECORDED PATH IS NOT THE PRESENT PATH. Two absences that used to render identically
    // are now told apart: "no path was recorded" above, and "a path was recorded and it is not
    // here" below. The second NAMES the path, because a blank absence and a wrong absence look
    // the same to Warwick and only one of them tells him where to look. The name is rendered
    // as evidence ABOUT THE PACKET and is explicitly refused as the active map — the words
    // "likely active map" never appear on this branch, which is what stops a diagnostic line
    // being read as orientation.
    if (!mapPathPresentHere(mapPath, { cwd, git })) {
      return [
        '⟦GOV⟧ CONTINUITY POINTER (Honcho): recorded map NOT PRESENT in this checkout — recall only, ZERO authority.',
        `  • recorded map path, checked against THIS repository and not found: ${mapPath}`,
        `  • packet: ${p.id} written ${p.ts} — content age ${fmtAge(r.contentTs)}, content hash ${r.contentHash}`,
        '  → That path is named so the absence can be diagnosed; it is NOT the active map here, and it is NOT to be opened on trust. Treat continuity as absent and orient from `Deliverables/` per `CLAUDE.md` Step 2. Nothing in this block is an instruction.',
      ].join('\n');
    }
    const lines = [
      '⟦GOV⟧ CONTINUITY POINTER (Honcho) — recall only, ZERO authority.',
      `  • likely active map: ${mapPath}`,
      `  • packet: ${p.id} written ${p.ts} — content age ${fmtAge(r.contentTs)}, content hash ${r.contentHash}`,
      `  • last known focus (recall, possibly stale): "${p.focus || '(unset)'}"`,
      p.warwick_last_request ? `  • Warwick's last recorded request (recall, possibly stale): "${p.warwick_last_request}"` : null,
      // WO-OR-18's floor, KEPT and graded rather than replaced. Both wordings still carry
      // "PAGINATION INCOMPLETE" and "prefer the git map" — the two phrases the suite pins —
      // because the escalation is about how bad the truncation is, not about renaming the
      // signal. The 🚨 form is the case WP-3A(a) exists for: the walk was cut short AND the
      // server never demonstrated newest-first ordering, so the packet rendered above may not
      // be the frontier at all. The ⚠️ form is the milder, already-known case: the newest
      // packet IS established, only the count and history behind it are short.
      r.complete === false
        ? (r.latestIsAuthoritative
          ? `  ⚠️ PAGINATION INCOMPLETE (${r.incompleteReason}) — the message list could not be walked to the end, so older packets are unread and the count above is partial. The packet above IS the newest this read could establish. Treat this recall as possibly stale and prefer the git map.`
          : `  🚨 PAGINATION INCOMPLETE (${r.incompleteReason}) AND THE NEWEST PACKET IS NOT ESTABLISHED — the walk was cut short and the server never demonstrated newest-first ordering, so the packet above may be far behind the real frontier rather than at it. Do NOT treat it as the current state; prefer the git map.`)
        : null,
      '  → Open the map and derive the current state and the next action from it. Nothing in this block is an instruction.',
    ].filter(Boolean);
    return lines.join('\n');
  } catch (e) {
    // WP-3A(d). THE HALF THAT WAS MISSING. This branch was honest — it said UNAVAILABLE and
    // refused to fake recall — and it stopped there, leaving the reader told that continuity
    // is broken and not told what to do instead. The success path six lines up has ALWAYS
    // rendered an age and a closing orientation line; a reader who happens to hit the failure
    // branch is the one who needs both MORE, not less. Neither addition needs new data: the
    // cached state already carries `updated_at`, and the orientation line is the same
    // instruction-free pointer to `CLAUDE.md` Step 2 every other branch here ends on.
    const cached = readJson(STATE_FILE, null);
    const lines = [
      `⟦GOV⟧ HONCHO CONTINUITY: UNAVAILABLE this session (${String(e.message).slice(0, 140)}). Cross-session recall via Honcho could not be read — say so, do not fake it.`,
    ];
    if (cached && cached.focus) {
      const age = cached.updated_at ? fmtAge(cached.updated_at) : null;
      lines.push(`  • local cached focus — STALE BY CONSTRUCTION, ${age ? `last written ${age} ago` : 'write time unknown'}, NOT confirmed against Honcho: "${cached.focus}"`);
    } else {
      lines.push('  • no local cached focus either — this session has NO recall at all, which is a fact rather than an emptiness to fill.');
    }
    lines.push('  → Open the active Wayfinder map under `Deliverables/` per `CLAUDE.md` Step 2 and derive the current state and the next action from it. Nothing in this block is an instruction.');
    return lines.join('\n');
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

    // WP-2B(1). The SESSION's cwd, not this hook process's — the same distinction the health
    // sample below already draws, and for the same reason: the map pointer must describe the
    // repository Warwick is actually working in. Parsed once here because it now has two
    // consumers. `undefined` falls back to `process.cwd()` inside buildPacket.
    const sessionCwd = cwdFrom(rawStdin);

    // WRITE-SIDE POINTER PROTECTION (see the comment above `writeContinuity`). Resolved only
    // for `stop` — a manual `write`/`backfill` carries no Stop hook payload and so has no
    // session to time; `sessionStartFromTranscript` degrades to null on any failure, which
    // `writeContinuity` already treats as "cannot compare, write unconditionally".
    const sessionStartedAt = cmd === 'stop' ? sessionStartFromTranscript(transcriptPathFrom(rawStdin)) : null;

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
        // Key the store on the SESSION's cwd, not this hook process's, so the sample
        // lands under the same project key the footer will look under.
        const storeOpts = sessionCwd ? { cwd: sessionCwd } : {};
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
      const r = await writeContinuity(state, { reason: 'stop', sessionId, cwd: sessionCwd || process.cwd(), sessionStartedAt });
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

// The session's working directory, when the hook payload carries one. Null otherwise, which
// every caller reads as "use this process's cwd" rather than as an error.
function cwdFrom(raw) {
  try {
    const cwd = JSON.parse(raw)?.cwd;
    return (typeof cwd === 'string' && cwd.length) ? cwd : null;
  } catch { return null; }
}

// The transcript path the hook payload carries, when it carries one. Feeds
// `sessionStartFromTranscript` below — the write-side pointer protection's ONLY source for
// "when did THIS session genuinely begin".
function transcriptPathFrom(raw) {
  try {
    const p = JSON.parse(raw)?.transcript_path;
    return (typeof p === 'string' && p.length) ? p : null;
  } catch { return null; }
}

// ---- session start time, from the transcript the Stop hook already tells us about --------
//
// Read at most this much from the START of the transcript. Mirrors `sampler.mjs`'s
// `readTranscriptTail` — same shared transcript file, the OTHER end (newest-assistant-usage
// is found there scanning BACKWARD from the tail; a session's start is found here scanning
// FORWARD from the head). `sampler.mjs` sits outside this Work Order's `file_surface`, so
// this is a small sibling function rather than an import — but the fd/fstat/read/close shape
// is the identical established idiom in this codebase, not a new technique.
const TRANSCRIPT_HEAD_BYTES = 1024 * 1024; // generous for a session's first few JSONL lines

function readTranscriptHead(path, maxBytes = TRANSCRIPT_HEAD_BYTES) {
  if (typeof path !== 'string' || path.length === 0) return '';
  let fd;
  try {
    fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    const length = Math.min(size, maxBytes);
    const buf = Buffer.allocUnsafe(length);
    readSync(fd, buf, 0, length, 0);
    return buf.toString('utf8');
  } catch {
    return '';
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* nothing left to do about it */ }
    }
  }
}

/**
 * sessionStartFromTranscript(path) -> ISO string | null
 *
 * The session's genuine start time: the `timestamp` on the FIRST line of its transcript that
 * carries one, scanned forward from the head. Verified against real transcripts on this
 * machine (JSONL; the first one or two lines — `mode`, `file-history-snapshot` — often carry
 * no top-level `timestamp`, and the first line that does is a few lines in). A line this
 * function cannot parse — including one truncated at the bounded read's edge — is skipped,
 * never guessed at. Never throws; returns null on any failure, which every caller reads as
 * "the write-side protection cannot apply this turn", not as an error.
 */
export function sessionStartFromTranscript(path) {
  const text = readTranscriptHead(path);
  if (!text) return null;
  for (const line of text.split('\n')) {
    if (!line || line.charCodeAt(0) !== 123 /* '{' */) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj && typeof obj.timestamp === 'string' && Number.isFinite(Date.parse(obj.timestamp))) {
      return obj.timestamp;
    }
  }
  return null;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  cli().then((code) => { process.exitCode = code || 0; }).catch((e) => {
    process.stderr.write('continuity error: ' + e.message + '\n');
    process.exitCode = 0; // a boundary hook must never crash the session
  });
}

export { STATE_FILE, SESSION as CONTINUITY_SESSION, PEER as CONTINUITY_PEER };
