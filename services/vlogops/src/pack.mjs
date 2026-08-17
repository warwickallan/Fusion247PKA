// BUILD-006 Phase 2 — the evidence pack: what it contains, in what order, and what it IS.
//
// Everything in this file is a PURE FUNCTION of frozen data. No database, no filesystem, no
// clock, no randomness, no process identity. Hand it the same snapshot rows and it returns
// the same pack, in the same order, with the same 64-character identity, in any process on
// any machine on any day. That is not a nice property of the implementation — it is the
// requirement, and keeping the decision-making in a module that CANNOT reach a clock is how
// it is held rather than promised.
//
// ── THE THREE RULES, STATED ONCE, HERE ──────────────────────────────────────────────────
//
//   DEDUPE     by content hash. The same bytes twice is one entry, whichever refs carried
//              them, and the collapsed ref is recorded rather than forgotten.
//
//   SELECT     under budget by CLASS RANK, then size, then ref. This deliberately reuses
//              the editorial judgement Phase 1 already wrote down and stored in each
//              snapshot's provenance, instead of inventing a second, competing opinion
//              about which evidence matters most.
//
//   ORDER      chronologically by the source's OWN time, derived from frozen provenance —
//              never from the capture clock, which is a different number wearing a similar
//              name and which would make the pack's identity depend on when it was taken.
//
// Selection and presentation are two different questions and are answered by two different
// rules, each separately versioned. Conflating them is how "chronological" quietly starts
// meaning "in the order we happened to like them".
// ────────────────────────────────────────────────────────────────────────────────────────

import {
  COMPILER_VERSION,
  MANIFEST_ALGO,
  PACK_ORDERING_RULE_VERSION,
  PACK_SELECTION_RULE_VERSION,
} from './config.mjs';
import { canonicalJson, sha256Hex } from './identity.mjs';

// Phase 1's class ranking, reused rather than re-decided. Lower is preferred.
//
// A member with NO source_class comes from a single-member route (promotion, supplied), so
// it is never in competition with anything and its rank cannot displace another artefact.
// Rank 0 is the safe direction for that case: were a future multi-member route to arrive
// without classes, every one of its members would tie here and the ordering would fall
// through to size and ref — still total, still deterministic, never arbitrary.
const PACK_CLASS_RANK = {
  'session-log': 0,
  deliverable: 1,
  'build-record': 2,
  'git-commit': 3,
};

const BASIS_RANK = { 'git-commit-time': 0, 'dated-filename': 1, unknown: 2 };

/** Compare two strings without depending on the host's locale or collation. */
function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The class rank for a snapshot's stored provenance. */
export function classRankOf(provenance) {
  const klass = provenance && typeof provenance.source_class === 'string' ? provenance.source_class : null;
  const rank = klass === null ? undefined : PACK_CLASS_RANK[klass];
  return rank === undefined ? 0 : rank;
}

/**
 * The source's OWN time, and the basis on which it was decided.
 *
 * Derived only from data frozen at intake — the stored provenance and the source_ref. Never
 * from `captured_at`: that records when THIS store first saw the artefact, which is a fact
 * about the pipeline rather than about the evidence, and admitting it would make a pack's
 * identity depend on the day it was compiled.
 *
 * Where no defensible time exists, the answer is NULL and the basis says `unknown`. A
 * fabricated timestamp would order the pack tidily and lie about why.
 */
export function deriveOccurredAt({ source_ref: sourceRef, provenance }) {
  const p = provenance ?? {};

  // 1 — a git commit carries its own committed time, in ISO 8601 with an offset.
  if (typeof p.committed_at === 'string' && p.committed_at !== '') {
    const ms = Date.parse(p.committed_at);
    if (Number.isFinite(ms)) {
      return { occurred_at: new Date(ms).toISOString(), occurred_at_basis: 'git-commit-time' };
    }
  }

  // 2 — this estate dates its records in their filenames, and that convention is enforced
  // by GL-001 rather than being a habit this code is guessing at. Midnight UTC is the
  // honest reading of a date with no time: it is the start of the day the name asserts.
  const base = String(sourceRef ?? '').split('/').pop() ?? '';
  const m = /^(\d{4})-(\d{2})-(\d{2})[-_.]/.exec(base);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
    if (Number.isFinite(Date.parse(iso))) {
      return { occurred_at: iso, occurred_at_basis: 'dated-filename' };
    }
  }

  // 3 — no defensible time. Said plainly.
  return { occurred_at: null, occurred_at_basis: 'unknown' };
}

/**
 * A stored bigint arrives from the driver as a STRING. Coerced explicitly and checked,
 * because `canonicalJson` would otherwise serialise "1234" as a string and change the
 * pack's identity for a reason that has nothing to do with its content — a stable, wrong
 * hash, which is the worst kind.
 */
function integerOf(value, label) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`pack: ${label} must be a non-negative integer (got ${JSON.stringify(value)})`);
  }
  return n;
}

/** Turn a stored source_snapshot row into a pack candidate. Pure; nothing here reads I/O. */
export function candidateFromSnapshot(row) {
  const { occurred_at: occurredAt, occurred_at_basis: basis } = deriveOccurredAt(row);
  return {
    seed_id: row.seed_id,
    source_ref: row.source_ref,
    content_sha256: row.content_sha256,
    byte_length: integerOf(row.byte_length, `byte_length of ${row.source_ref}`),
    media_type: row.media_type,
    provenance: row.provenance ?? {},
    occurred_at: occurredAt,
    occurred_at_basis: basis,
    class_rank: classRankOf(row.provenance),
  };
}

/**
 * DEDUPE · SELECT · ORDER — the whole decision, in one pass, deterministically.
 *
 * Returns the entries that make the pack (already in presentation order, with ordinals
 * assigned) and every candidate that did not, each with the reason it was left out.
 */
export function planPack({ snapshots, maxEntries, maxBytes }) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new TypeError('planPack: a pack needs at least one snapshot to compile');
  }
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError(`planPack: maxEntries must be a positive integer (got ${maxEntries})`);
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError(`planPack: maxBytes must be a positive integer (got ${maxBytes})`);
  }

  const candidates = snapshots.map(candidateFromSnapshot);
  const omitted = [];

  // ── 1 · DEDUPE by content ──────────────────────────────────────────────────────────
  // The survivor is the best-ranked, then the lowest ref — a rule, not the arrival order,
  // so two processes that read the rows in different orders still keep the same one.
  const byContent = new Map();
  for (const c of [...candidates].sort((a, b) => (
    a.class_rank - b.class_rank || cmp(a.source_ref, b.source_ref)
  ))) {
    const kept = byContent.get(c.content_sha256);
    if (kept === undefined) {
      byContent.set(c.content_sha256, c);
    } else {
      omitted.push({
        source_ref: c.source_ref,
        content_sha256: c.content_sha256,
        byte_length: c.byte_length,
        reason: 'duplicate-content',
        duplicate_of: kept.source_ref,
      });
    }
  }
  const unique = [...byContent.values()];

  // ── 2 · SELECT under budget ────────────────────────────────────────────────────────
  // Class rank first (Phase 1's editorial judgement), then the larger artefact, then the
  // ref. An artefact too big to fit does NOT stop a later smaller one from fitting — the
  // same behaviour as the sibling selector in routes/records.mjs, kept deliberately so the
  // two do not diverge into two different meanings of "budget".
  const byRank = [...unique].sort((a, b) => (
    a.class_rank - b.class_rank
      || b.byte_length - a.byte_length
      || cmp(a.source_ref, b.source_ref)
  ));

  const chosen = [];
  const taken = new Set();
  let bytes = 0;

  const admit = (c) => {
    if (taken.has(c.source_ref)) return true;
    if (chosen.length >= maxEntries) return false;
    if (bytes + c.byte_length > maxBytes) return false;
    chosen.push(c);
    taken.add(c.source_ref);
    bytes += c.byte_length;
    return true;
  };

  // 2a — ONE FROM EVERY NON-EMPTY CLASS FIRST.
  //
  // This step is inherited from routes/records.mjs, and dropping it was a real defect caught
  // by running the compiler against the real window: without it, the pack filled entirely
  // with the best-ranked class and every git commit fell off the end as over-budget. That is
  // the same starvation the intake selector exists to prevent, quietly reintroduced one stage
  // later — and it costs more here, because commits are the entries that carry a real
  // timestamp. A pack with no commits in it had no chronology to order, only a column.
  //
  // The two narrowings now answer the same way: breadth first, then depth.
  for (const klass of Object.keys(PACK_CLASS_RANK)) {
    const rank = PACK_CLASS_RANK[klass];
    const best = byRank.find((c) => c.class_rank === rank);
    if (best) admit(best);
  }

  // 2b — then fill by rank until a budget binds.
  for (const c of byRank) {
    if (taken.has(c.source_ref)) continue;
    if (!admit(c)) {
      omitted.push({
        source_ref: c.source_ref,
        content_sha256: c.content_sha256,
        byte_length: c.byte_length,
        reason: 'over-budget',
        limit: chosen.length >= maxEntries ? 'max_entries' : 'max_bytes',
      });
    }
  }

  if (chosen.length === 0) {
    const err = new Error(
      'pack: the budget admitted no entries at all. A pack with nothing in it is a failed '
      + 'compile, not a bounded one, and it is deliberately not storable.',
    );
    err.code = 'EVLOGOPSPACKEMPTY';
    throw err;
  }

  // ── 3 · ORDER for presentation: chronologically ────────────────────────────────────
  // Entries with a defensible time come first, in time order. Entries without one are
  // bucketed last rather than being interleaved on a guess — and each carries the basis
  // that put it where it is, so a reader can see which placements are real.
  // Written out longhand on purpose. A chained-|| comparator reads as clever and hides
  // exactly the case that matters here — two entries where one has no time at all.
  const entries = [...chosen].sort((a, b) => {
    const aUnknown = a.occurred_at === null ? 1 : 0;
    const bUnknown = b.occurred_at === null ? 1 : 0;
    if (aUnknown !== bUnknown) return aUnknown - bUnknown;          // a real time comes first
    if (aUnknown === 0) {                                           // both real: compare them
      // Every value here is a normalised `…Z` ISO instant of fixed shape, so a string
      // compare IS a chronological compare, with no Date objects and no timezone in play.
      const t = cmp(a.occurred_at, b.occurred_at);
      if (t !== 0) return t;
    }
    const basis = BASIS_RANK[a.occurred_at_basis] - BASIS_RANK[b.occurred_at_basis];
    if (basis !== 0) return basis;
    return cmp(a.source_ref, b.source_ref);                         // total, always
  }).map((c, i) => ({ ...c, ordinal: i }));

  // Sorted so the disclosure itself is deterministic — an identical pack must produce
  // identical omission bytes, or the identity would depend on iteration order after all.
  omitted.sort((a, b) => cmp(a.reason, b.reason) || cmp(a.source_ref, b.source_ref));

  return {
    entries,
    omitted,
    entryBytes: bytes,
    bounded: omitted.some((o) => o.reason === 'over-budget'),
    candidateCount: candidates.length,
  };
}

/**
 * The manifest that IS the pack's identity.
 *
 * What is in it: the seed it came from, the rules that produced it, the budget in force,
 * and every entry's ref, content hash, size, media type and chronological placement.
 *
 * What is deliberately NOT in it: any clock, any row id, any pid or hostname, the order
 * rows happened to be written, and the entries' full provenance. The last one is a
 * judgement worth stating — provenance is already frozen, immutable and independently
 * checkable in Phase 1's snapshot row, and the content hash here binds each entry to
 * exactly those bytes. Copying it into the identity would add length without adding a
 * single thing a reader could not already verify.
 */
export function buildPackManifest({ seedId, entries, omitted, budget }) {
  if (typeof seedId !== 'string' || !/^[0-9a-f]{64}$/.test(seedId)) {
    throw new TypeError(`buildPackManifest: seedId must be a sha256 hex string (got ${seedId})`);
  }
  return {
    v: 1,
    seed_id: seedId,
    compiler: COMPILER_VERSION,
    selection_rule: PACK_SELECTION_RULE_VERSION,
    ordering_rule: PACK_ORDERING_RULE_VERSION,
    budget: {
      max_entries: budget.maxEntries,
      max_bytes: budget.maxBytes,
    },
    entries: entries.map((e) => ({
      ordinal: e.ordinal,
      source_ref: e.source_ref,
      content_sha256: e.content_sha256,
      byte_length: e.byte_length,
      media_type: e.media_type,
      occurred_at: e.occurred_at,
      occurred_at_basis: e.occurred_at_basis,
    })),
    omitted,
  };
}

/** The pack's identity: sha256 over the canonical manifest. Phase 1's functions, reused. */
export function packIdentity(manifest) {
  return sha256Hex(canonicalJson(manifest));
}

/**
 * THE PACK DOCUMENT — the artefact two processes are compared on.
 *
 * A pack that is content-addressed and written idempotently cannot be proven deterministic
 * by diffing two stored rows: the second compile deduplicates and there is only ever one
 * row. So the compiler also EMITS the canonical bytes it decided on, and determinism is
 * checked on those, with the store's dedupe asserted separately as the other half of the
 * same claim.
 */
export function packDocument({ packId, manifest }) {
  return `${canonicalJson({ pack_id: packId, manifest })}\n`;
}

/** A deterministic label for one compile ATTEMPT, for the append-only ledger only. */
export function compileAttemptKey({ packId, startedAtIso, pid }) {
  return sha256Hex(canonicalJson({ v: 1, pack_id: packId, started_at: startedAtIso, pid }));
}

export { MANIFEST_ALGO };
