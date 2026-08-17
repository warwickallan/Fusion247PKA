// BUILD-006 Phase 1 — Route 1: intake from existing records.
//
// Warwick names a date or a period; this compiles the SMALLEST SUFFICIENT evidence bundle
// for it. "Smallest sufficient" is a design constraint, not a description: the answer is
// deliberately not everything in range, and the rule that decides is written out below
// rather than left to a model's judgement.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// WHY `Deliverables/` AND GIT HISTORY ARE FIRST-CLASS SOURCES HERE, NOT FALLBACK
//
// The map's §6 F3 recorded, on 2026-08-03, that the session-log stream was dry — the four
// most eventful days in the estate's history had produced no entry in what was supposed to
// be this pipeline's primary intake stream. That finding was true when written. It is no
// longer true as a statement about August 2026: measured at the governance head, sixteen
// session logs exist, the earliest dated 2026-08-03.
//
// THE REAL PROPERTY IS INTERMITTENCE, NOT DRYNESS — and that is the more dangerous of the
// two, because on any single window intermittence is indistinguishable from absence. A
// compiler that treated session logs as primary and everything else as fallback would work
// perfectly on the windows that happen to have logs and return nothing on the ones that do
// not, which is precisely when the evidence matters most.
//
// The AC4 fixture window is 2026-08-05, chosen because it is a real, ordinary, busy day
// with ZERO session logs, 164 commits and 6 deliverables. A window like it must still
// produce a non-empty bundle. That is the test, and this is the rule that passes it.
// ─────────────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SELECTION_RULE_VERSION } from '../config.mjs';
import { snapshotFile, snapshotText } from '../snapshot.mjs';

const DATED_FILE = /^(\d{4}-\d{2}-\d{2})[-_].*\.md$/;

// Class ranks. Lower is preferred. The order is an editorial judgement about which stream
// carries the most narrative per byte, and it is fixed here so that the same window always
// produces the same bundle.
const CLASS_RANK = {
  'session-log': 0,
  deliverable: 1,
  'build-record': 2,
  'git-commit': 3,
};

function inWindow(dateStr, from, to) {
  return dateStr >= from && dateStr <= to;
}

function listDatedMarkdown(dir, from, to) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const m = DATED_FILE.exec(name);
    if (m && inWindow(m[1], from, to)) {
      const abs = path.join(dir, name);
      const st = fs.statSync(abs);
      if (st.isFile()) out.push({ abs, date: m[1], bytes: st.size });
    }
  }
  return out;
}

function sessionLogMonths(from, to) {
  // Session logs nest by year and month. Walk only the months the window can touch.
  const months = new Set();
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    months.add(`${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  months.add(`${end.getUTCFullYear()}/${String(end.getUTCMonth() + 1).padStart(2, '0')}`);
  return [...months];
}

// ASCII unit separators, written as escapes rather than as literal control bytes so the
// source survives any editor, encoding or diff tool. Chosen because git never emits them
// in a subject, body, author name or path, so a commit message containing the delimiter
// cannot break parsing the way a newline-delimited format would.
const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';

/**
 * Git history as candidate artefacts — one per commit.
 *
 * Each commit becomes a small deterministic text artefact: its identifiers, its subject and
 * body, and its numstat. Given the same repository state, the same window always renders
 * the same bytes, which is what lets a commit participate in a content-derived identity.
 */
function gitCommits(repoRoot, from, to, maxCommits) {
  const args = [
    'log',
    `--since=${from} 00:00:00`,
    `--until=${to} 23:59:59`,
    `--max-count=${maxCommits}`,
    '--no-merges',
    '--numstat',
    `--pretty=format:${RECORD_SEP}%H${FIELD_SEP}%cI${FIELD_SEP}%an${FIELD_SEP}%s${FIELD_SEP}%b${FIELD_SEP}`,
  ];
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) return [];

  const out = [];
  for (const chunk of r.stdout.split(RECORD_SEP)) {
    if (!chunk.trim()) continue;
    const parts = chunk.split(FIELD_SEP);
    if (parts.length < 6) continue;
    const [sha, committedAt, author, subject, body] = parts;
    const stats = parts[5]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && /\t/.test(l));

    let linesChanged = 0;
    for (const line of stats) {
      const [add, del] = line.split('\t');
      linesChanged += (Number(add) || 0) + (Number(del) || 0);
    }

    const rendered = [
      `commit ${sha}`,
      `committed ${committedAt}`,
      `author ${author}`,
      `subject ${subject}`,
      body.trim() ? `\n${body.trim()}` : '',
      '\nfiles:',
      ...stats,
    ].join('\n');

    out.push({
      sha,
      text: rendered,
      filesChanged: stats.length,
      linesChanged,
      committedAt,
      bytes: Buffer.byteLength(rendered, 'utf8'),
    });
  }
  return out;
}

function buildRecordPaths(repoRoot, from, to) {
  const r = spawnSync('git', [
    'log',
    `--since=${from} 00:00:00`,
    `--until=${to} 23:59:59`,
    '--name-only',
    '--pretty=format:',
    '--',
    'Builds/',
  ], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.error || r.status !== 0) return [];

  const seen = new Set();
  for (const line of r.stdout.split('\n')) {
    const p = line.trim();
    if (p.endsWith('.md') && !seen.has(p)) seen.add(p);
  }
  return [...seen].sort()
    .map((rel) => {
      const abs = path.join(repoRoot, rel);
      if (!fs.existsSync(abs)) return null;
      const st = fs.statSync(abs);
      return st.isFile() ? { abs, bytes: st.size } : null;
    })
    .filter(Boolean);
}

/**
 * Gather every candidate in the window, scored and ranked. Deterministic throughout: no
 * clock, no randomness, no dependence on directory iteration order (everything is sorted).
 */
export function gatherCandidates({ repoRoot, from, to, maxCommits = 500 }) {
  const candidates = [];

  for (const ym of sessionLogMonths(from, to)) {
    for (const f of listDatedMarkdown(path.join(repoRoot, 'Team Knowledge', 'session-logs', ...ym.split('/')), from, to)) {
      candidates.push({ klass: 'session-log', kind: 'file', abs: f.abs, bytes: f.bytes, density: f.bytes, key: f.abs });
    }
  }

  for (const f of listDatedMarkdown(path.join(repoRoot, 'Deliverables'), from, to)) {
    candidates.push({ klass: 'deliverable', kind: 'file', abs: f.abs, bytes: f.bytes, density: f.bytes, key: f.abs });
  }

  for (const f of buildRecordPaths(repoRoot, from, to)) {
    candidates.push({ klass: 'build-record', kind: 'file', abs: f.abs, bytes: f.bytes, density: f.bytes, key: f.abs });
  }

  for (const c of gitCommits(repoRoot, from, to, maxCommits)) {
    candidates.push({
      klass: 'git-commit',
      kind: 'text',
      sha: c.sha,
      text: c.text,
      bytes: c.bytes,
      // A commit that touched many files and many lines carries more of the day's story
      // than a one-line typo fix. Deterministic, and explicit rather than intuited.
      density: (c.filesChanged * 100) + c.linesChanged,
      committedAt: c.committedAt,
      key: `git-commit:${c.sha}`,
    });
  }

  return candidates;
}

/**
 * THE SELECTION RULE, stated once, in one place, in order:
 *
 *   1. Take the single best candidate from EVERY non-empty class first. This is the
 *      guarantee that a window with no session logs still yields a bundle, and it is the
 *      reason `Deliverables/` and git history are first-class rather than fallback.
 *   2. Then fill by rank — class rank first, density second, key third — until either the
 *      artefact budget or the byte budget is reached.
 *   3. Stop. Everything else in range is REJECTED, and the count of what was rejected is
 *      recorded so "smallest sufficient" can be audited rather than taken on trust.
 *
 * Both budgets are module constants and no environment variable can widen them; a budget
 * that is configurable at run time is not a budget.
 */
export function selectSmallestSufficient({ candidates, maxArtefacts, maxBytes }) {
  const byRank = [...candidates].sort((a, b) => (
    CLASS_RANK[a.klass] - CLASS_RANK[b.klass]
      || b.density - a.density
      || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  ));

  const chosen = [];
  const takenKeys = new Set();
  let bytes = 0;

  const admit = (c) => {
    if (takenKeys.has(c.key)) return false;
    if (chosen.length >= maxArtefacts) return false;
    if (bytes + c.bytes > maxBytes) return false;
    chosen.push(c);
    takenKeys.add(c.key);
    bytes += c.bytes;
    return true;
  };

  // 1 — one from each non-empty class, in class-rank order.
  for (const klass of Object.keys(CLASS_RANK)) {
    const best = byRank.find((c) => c.klass === klass);
    if (best) admit(best);
  }

  // 2 — fill by rank.
  for (const c of byRank) admit(c);

  const classesPresent = [...new Set(candidates.map((c) => c.klass))].sort();
  const classesChosen = [...new Set(chosen.map((c) => c.klass))].sort();

  return {
    chosen,
    stats: {
      rule_version: SELECTION_RULE_VERSION,
      candidates_considered: candidates.length,
      selected: chosen.length,
      rejected: candidates.length - chosen.length,
      selected_bytes: bytes,
      max_artefacts: maxArtefacts,
      max_bytes: maxBytes,
      classes_present: classesPresent,
      classes_selected: classesChosen,
    },
  };
}

/**
 * Compile a Route 1 bundle for a window: gather, select, snapshot.
 *
 * Returns { members, selection, selector } ready to hand to `intake()`. Performs no
 * database work of its own — compiling and sealing are separate so that a kill during
 * either has an obvious meaning.
 */
export function compileRecordsBundle({ config, from, to, privacyState = 'unclassified' }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const err = new Error(`vlogops: window dates must be YYYY-MM-DD (got ${from} .. ${to})`);
    err.code = 'EVLOGOPSWINDOW';
    throw err;
  }
  if (to < from) {
    const err = new Error(`vlogops: window end ${to} precedes its start ${from}`);
    err.code = 'EVLOGOPSWINDOW';
    throw err;
  }

  const candidates = gatherCandidates({ repoRoot: config.repoRoot, from, to });
  const { chosen, stats } = selectSmallestSufficient({
    candidates,
    maxArtefacts: config.bundleMaxArtefacts,
    maxBytes: config.bundleMaxBytes,
  });

  if (chosen.length === 0) {
    const err = new Error(
      `vlogops: no source records found in ${from} .. ${to}. A window with no session logs is normal ` +
      `and must still yield deliverables or commits; a window with none of the three is genuinely empty.`,
    );
    err.code = 'EVLOGOPSNOSOURCES';
    throw err;
  }

  const members = chosen.map((c) => {
    if (c.kind === 'file') {
      return snapshotFile({
        repoRoot: config.repoRoot,
        absPath: c.abs,
        privacyState,
        maxInlineBytes: config.snapshotMaxInlineBytes,
        provenance: {
          source_class: c.klass,
          route: 'records',
          window_from: from,
          window_to: to,
        },
      });
    }
    return snapshotText({
      sourceRef: c.key,
      text: c.text,
      mediaType: 'text/plain',
      privacyState,
      maxInlineBytes: config.snapshotMaxInlineBytes,
      provenance: {
        source_system: 'git',
        source_class: c.klass,
        commit: c.sha,
        committed_at: c.committedAt,
        route: 'records',
        window_from: from,
        window_to: to,
      },
    });
  });

  return {
    members,
    selection: stats,
    selector: { kind: 'window', from, to },
  };
}
