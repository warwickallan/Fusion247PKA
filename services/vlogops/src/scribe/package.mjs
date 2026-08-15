// BUILD-006 Phase 3 — the Master Story Package: what it IS, and how it renders.
//
// Everything in this file is a PURE FUNCTION of frozen data, on the same rule pack.mjs follows:
// no database, no filesystem, no clock, no randomness, no process identity.
//
// ── ONE CANONICAL TRUTH, AND SIBLINGS THAT ARE PROJECTIONS OF IT ────────────────────────────
// There is no "the blog" stored anywhere as a document. There are cited segment rows, and
// `renderSibling` is a deterministic projection of them. That is the difference between
// traceability that is enforced and traceability that is inspected: you cannot lose the
// citations by editing the prose, because there is no prose to edit — the prose is what the rows
// project to, every time, from the same rows.
//
// ── WHAT IS IN THE IDENTITY, AND WHAT IS DELIBERATELY NOT ───────────────────────────────────
// In: the pack, the seed, the contract's byte-identity, the prompt's byte-identity, the rule
// versions, and every word of the master and the siblings with their citations.
//
// NOT in: `model_binding`. Phase 1 set this precedent explicitly for `selection` — "immutable,
// and deliberately NOT part of the identity: the seed is what it contains, not how it was
// chosen." The same reasoning holds here. A package IS its story and its citations; which model
// happened to produce those words is provenance, it is stored beside them, it is immutable, and
// it is not what the thing is.
//
// Also not in: any clock, row id, pid, hostname or insertion order. Two unrelated processes
// handed the same pack, the same contract and the same model output land on the same row.

import {
  SCRIBE_DERIVATION_RULE_VERSION,
  SCRIBE_SIBLINGS,
  SCRIBE_VERSION,
} from '../config.mjs';
import { canonicalJson, sha256Hex } from '../identity.mjs';

const KIND_RANK = { 'story-question': 0, beat: 1, 'narrative-claim': 2 };

/**
 * The manifest that IS the package's identity.
 *
 * Claims and segments are ordered by a RULE rather than by arrival, so two processes that read
 * or assemble them differently still produce identical bytes.
 */
export function buildPackageManifest({
  packId, seedId, contract, promptSha256, storyQuestion, claims, segments,
}) {
  if (typeof packId !== 'string' || !/^[0-9a-f]{64}$/.test(packId)) {
    throw new TypeError(`buildPackageManifest: packId must be a sha256 hex string (got ${packId})`);
  }
  if (!Array.isArray(claims) || claims.length === 0) {
    throw new TypeError('buildPackageManifest: a package needs at least one master claim');
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new TypeError('buildPackageManifest: a package needs at least one sibling segment');
  }

  const orderedClaims = [...claims].sort((a, b) => (
    (KIND_RANK[a.kind] ?? 99) - (KIND_RANK[b.kind] ?? 99)
      || a.ordinal - b.ordinal
      || (a.claim_id < b.claim_id ? -1 : a.claim_id > b.claim_id ? 1 : 0)
  )).map((c) => ({
    claim_id: c.claim_id,
    kind: c.kind,
    ordinal: c.ordinal,
    text: c.text,
    // Sorted: a claim resting on the same two entries is the same claim whichever order the
    // model happened to list them in.
    citations: [...c.citations].sort(),
  }));

  const siblingRank = new Map(SCRIBE_SIBLINGS.map((s, i) => [s, i]));
  const orderedSegments = [...segments].sort((a, b) => (
    (siblingRank.get(a.sibling) ?? 99) - (siblingRank.get(b.sibling) ?? 99)
      || a.ordinal - b.ordinal
  )).map((s) => ({
    sibling: s.sibling,
    ordinal: s.ordinal,
    role: s.role,
    claim_id: s.claim_id,
    source_ref: s.source_ref,
    text: s.text,
  }));

  return {
    v: 1,
    pack_id: packId,
    seed_id: seedId,
    scribe: SCRIBE_VERSION,
    contract: { version: contract.version, id: contract.id },
    derivation_rule: SCRIBE_DERIVATION_RULE_VERSION,
    prompt_sha256: promptSha256,
    story_question: storyQuestion,
    claims: orderedClaims,
    segments: orderedSegments,
  };
}

/** The package's identity: sha256 over the canonical manifest. Phase 1's functions, reused. */
export function packageIdentity(manifest) {
  return sha256Hex(canonicalJson(manifest));
}

/**
 * THE PACKAGE DOCUMENT — the canonical bytes two independent drafts are compared on.
 *
 * Same reason Phase 2 emits one: a content-addressed, idempotently-written package cannot be
 * shown deterministic by diffing two stored rows, because the second write deduplicates and
 * there is only ever one row.
 */
export function packageDocument({ packageId, manifest }) {
  return `${canonicalJson({ package_id: packageId, manifest })}\n`;
}

/**
 * Resolve a source_ref to its pack ordinal, for readable citation markers.
 *
 * Falls back to the bare ref rather than to a number it cannot justify: a citation marker that
 * invents an ordinal would be a small lie in the one artefact a human actually reads.
 */
function citeMarker(sourceRef, ordinalByRef) {
  const ordinal = ordinalByRef instanceof Map ? ordinalByRef.get(sourceRef) : undefined;
  return ordinal === undefined ? `[${sourceRef}]` : `[E${ordinal} · ${sourceRef}]`;
}

/**
 * ONE SIBLING, PROJECTED FROM ITS ROWS. Deterministic, and the only way a sibling exists.
 *
 * Every unit carries its citation inline. This is not decoration: it is what makes the Phase 4
 * verifier's job mechanical rather than interpretive, and it is what §9.1 rung 1 means when it
 * says human-facing work is reviewed from source first — a reader can follow any sentence to the
 * bytes underneath it without leaving the page.
 */
export function renderSibling({ sibling, segments, ordinalByRef = null }) {
  const mine = segments
    .filter((s) => s.sibling === sibling)
    .sort((a, b) => a.ordinal - b.ordinal);

  if (mine.length === 0) return `## ${sibling}\n\n_(no segments)_\n`;

  const lines = [`## ${sibling}`, ''];
  for (const s of mine) {
    lines.push(`**${s.ordinal + 1}. ${s.role}** — derived from \`${s.claim_id}\``);
    lines.push('');
    lines.push(s.text);
    lines.push('');
    lines.push(`> evidence: ${citeMarker(s.source_ref, ordinalByRef)}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * The whole package as a human reads it: the master first, then every sibling, then the
 * traceability index that lets a reader check the lot without a database.
 */
export function renderPackage({ packageId, manifest, modelBinding, ordinalByRef = null }) {
  const claims = manifest.claims;
  const question = claims.find((c) => c.kind === 'story-question');
  const beats = claims.filter((c) => c.kind === 'beat');
  const narrative = claims.filter((c) => c.kind === 'narrative-claim');

  const cites = (c) => c.citations.map((r) => citeMarker(r, ordinalByRef)).join(' ');

  // THE DISCLOSURE IS RENDERED, NOT REMEMBERED. Any package whose recorded binding says no real
  // model wrote it carries this banner at the top of the file, every time it is rendered, for as
  // long as the row exists. Putting it here rather than writing it by hand onto one sample is
  // what stops the next sample being committed without it.
  const banner = modelBinding && modelBinding.configured === false
    ? [
      '> # ⛔ THIS IS NOT WARWICK\'S VOICE',
      '>',
      `> No language model wrote this. It was composed by \`${modelBinding.client ?? modelBinding.provider}\`,`,
      '> a mechanical placeholder composer, to exercise the contract, the schema, the derivation and',
      '> the citation enforcement without a gateway credential.',
      '>',
      '> **What this artefact evidences:** that one canonical master exists, that all four siblings are',
      '> projections of it, and that every segment traces to a master claim and to a frozen pack entry.',
      '>',
      '> **What it does not evidence:** anything at all about the writing. Creative judgement is',
      '> Warwick\'s alone, and it happens at Phase 5.',
      '',
    ]
    : [];

  const out = [
    ...banner,
    `# Master Story Package — \`${packageId.slice(0, 12)}…\``,
    '',
    '| | |',
    '|---|---|',
    `| package_id | \`${packageId}\` |`,
    `| pack_id | \`${manifest.pack_id}\` |`,
    `| seed_id | \`${manifest.seed_id}\` |`,
    `| scribe | \`${manifest.scribe}\` |`,
    `| contract | \`${manifest.contract.version}\` · \`${manifest.contract.id}\` |`,
    `| derivation rule | \`${manifest.derivation_rule}\` |`,
    `| prompt sha256 | \`${manifest.prompt_sha256}\` |`,
    `| drafted by | \`${modelBinding?.provider ?? 'unknown'}\``
      + `${modelBinding?.model ? ` · \`${modelBinding.model}\`` : ''}`
      + `${modelBinding?.client ? ` · \`${modelBinding.client}\`` : ''} |`,
    '',
    '## THE MASTER — one canonical creative truth',
    '',
    '### Story question',
    '',
    question ? `**${question.text}**` : '_(none)_',
    '',
    question ? `> evidence: ${cites(question)}` : '',
    '',
    '### Beats',
    '',
    ...beats.flatMap((b) => [
      `${b.ordinal + 1}. ${b.text}`,
      `   > \`${b.claim_id}\` · evidence: ${cites(b)}`,
      '',
    ]),
    ...(narrative.length > 0
      ? ['### Narrative claims', '', ...narrative.flatMap((c) => [
        `- ${c.text}`,
        `  > \`${c.claim_id}\` · evidence: ${cites(c)}`,
        '',
      ])]
      : []),
    '---',
    '',
    '# THE SIBLINGS — every one derived from the master above',
    '',
    ...SCRIBE_SIBLINGS.map((s) => renderSibling({
      sibling: s, segments: manifest.segments, ordinalByRef,
    })),
    '---',
    '',
    '## Traceability index',
    '',
    'Every sibling segment, the master claim it adapts, and the pack entry underneath it.',
    'Follow any row to the evidence; none of these rows could exist without all three.',
    '',
    '| sibling | # | master claim | pack entry |',
    '|---|---|---|---|',
    ...manifest.segments.map((s) => (
      `| ${s.sibling} | ${s.ordinal + 1} | \`${s.claim_id}\` | \`${s.source_ref}\` |`
    )),
    '',
  ];

  return `${out.filter((l) => l !== null && l !== undefined).join('\n')}\n`;
}
