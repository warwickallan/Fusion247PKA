// BUILD-006 Phase 3 — Scribe against the store: read the pack, ask once, refuse or seal.
//
// This module is the only place in Phase 3 that touches the database or the network, and it is
// deliberately thin. Every decision about what a package IS was already made by package.mjs and
// proposal.mjs, neither of which can reach a clock, a socket or a filesystem. What is left here
// is reading frozen rows, asking the seam once, and writing the result in ONE transaction.
//
// ── WHY A KILL MID-DRAFT CANNOT LEAVE HALF A PACKAGE ────────────────────────────────────────
// The package row, every master claim, every citation and every sibling segment are written
// inside one transaction, exactly as Phase 1's intake and Phase 2's compile are. Killed before
// COMMIT: nothing. Killed after: one complete package. There is no third state, so there is no
// reconciler, no lease and no recovery pass — the design is inherited, not re-invented.
//
// ── WHY THE MODEL IS CALLED OUTSIDE THE TRANSACTION ─────────────────────────────────────────
// A language model call is slow and may hang. Holding a Postgres transaction open across it
// would pin a connection and a snapshot for the duration of somebody else's outage. So the pack
// is read, the transaction closes, the model is asked, the draft is validated, and only then is
// a second transaction opened to write. Nothing in between mutates anything, and the pack is
// immutable by 002's trigger, so there is nothing for the gap to race against.

import { SCRIBE_DERIVATION_RULE_VERSION, SCRIBE_VERSION } from '../config.mjs';
import { withTransaction } from '../db.mjs';
import { loadContract } from './contract.mjs';
import { buildPackageManifest, packageDocument, packageIdentity } from './package.mjs';
import { buildPrompt, derivationIdentity, promptIdentity } from './prompt.mjs';
import { parseProposal, validateProposal } from './proposal.mjs';

const ENTRY_QUERY = `
  select e.ordinal, e.source_ref, e.content_sha256, e.byte_length, e.media_type,
         e.occurred_at, e.occurred_at_basis, s.content
    from vlogops.evidence_pack_entry e
    join vlogops.source_snapshot s
      on s.seed_id = e.seed_id and s.source_ref = e.source_ref
   where e.pack_id = $1
   order by e.ordinal`;

/**
 * Read one pack and everything needed to draft from it: the seed's angle, and each entry's
 * frozen bytes.
 *
 * Reads STORED BYTES ONLY. Like the compiler, Scribe never re-reads an original artefact — not
 * once, not as a fallback, not to "refresh" anything. So the answer to "what happens to a
 * package when its source is edited or deleted afterwards" is: nothing, by construction.
 */
export async function readPackForDrafting(pool, packId) {
  const pack = await pool.query(
    `select pack_id, seed_id, entry_count, bounded from vlogops.evidence_pack where pack_id = $1`,
    [packId],
  );
  if (pack.rowCount === 0) {
    const err = new Error(
      `vlogops scribe: no pack ${packId}. A package is drafted FROM a compiled evidence pack; `
      + 'there is no path that invents one.',
    );
    err.code = 'EVLOGOPSNOPACK';
    throw err;
  }

  const seedId = pack.rows[0].seed_id.trim();
  const seed = await pool.query(
    'select route, angle from vlogops.content_seed where seed_id = $1', [seedId],
  );

  const entries = await pool.query(ENTRY_QUERY, [packId]);
  if (entries.rowCount === 0) {
    const err = new Error(`vlogops scribe: pack ${packId} has no entries to draft from`);
    err.code = 'EVLOGOPSEMPTYPACK';
    throw err;
  }

  return {
    packId: pack.rows[0].pack_id.trim(),
    seedId,
    route: seed.rows[0]?.route ?? null,
    angle: seed.rows[0]?.angle ?? null,
    bounded: pack.rows[0].bounded,
    entries: entries.rows.map((r) => ({
      ordinal: r.ordinal,
      source_ref: r.source_ref,
      content_sha256: r.content_sha256.trim(),
      byte_length: Number(r.byte_length),
      media_type: r.media_type,
      // A timestamptz arrives as a Date. Normalised to an ISO instant here so the prompt's
      // bytes — and therefore derivation_id — cannot depend on the driver's or the server's
      // rendering of a timestamp.
      occurred_at: r.occurred_at === null ? null : new Date(r.occurred_at).toISOString(),
      occurred_at_basis: r.occurred_at_basis,
      excerpt_text: Buffer.isBuffer(r.content) ? r.content.toString('utf8') : String(r.content ?? ''),
    })),
  };
}

/**
 * Draft one Master Story Package from one compiled pack.
 *
 * Returns { packageId, deduplicated, manifest, document, derivationId, modelBinding, … }.
 * `deduplicated: true` means this exact package already existed and nothing was written — the
 * correct, quiet outcome of drafting the same pack twice under the same contract with a
 * deterministic client, and of every restart after an abrupt kill.
 */
export async function draftStoryPackage({
  pool, packId, contractVersion, modelClient, hooks = {},
}) {
  if (typeof packId !== 'string' || !/^[0-9a-f]{64}$/.test(packId)) {
    const err = new Error(`vlogops scribe: pack_id must be a 64-character lowercase hex string (got ${packId})`);
    err.code = 'EVLOGOPSBADPACKID';
    throw err;
  }
  if (!modelClient || typeof modelClient.draft !== 'function') {
    throw new TypeError('draftStoryPackage: a model client with a draft() function is required');
  }

  const pause = async (stage) => { if (hooks.onStage) await hooks.onStage(stage); };

  const contract = loadContract(contractVersion);
  const source = await readPackForDrafting(pool, packId);

  const prompt = buildPrompt({
    contract,
    packId: source.packId,
    seedId: source.seedId,
    angle: source.angle,
    entries: source.entries,
  });
  const promptSha256 = promptIdentity(prompt);
  const derivationId = derivationIdentity({
    packId: source.packId,
    contractId: contract.id,
    promptSha256,
    derivationRuleVersion: SCRIBE_DERIVATION_RULE_VERSION,
    scribeVersion: SCRIBE_VERSION,
  });

  await pause('prompt-built');

  // ── ask the seam, ONCE ────────────────────────────────────────────────────────────────
  // No retry loop. A model that produced an untraceable draft twice is not more trustworthy
  // than one that produced it once, and retrying until something validates is how a system
  // quietly selects for output that satisfies the checker rather than the evidence.
  const raw = await modelClient.draft(prompt);
  const modelBinding = typeof modelClient.describe === 'function'
    ? modelClient.describe()
    : { provider: 'unknown', configured: false };

  await pause('model-answered');

  // ── refuse before writing ─────────────────────────────────────────────────────────────
  const allowedRefs = new Set(source.entries.map((e) => e.source_ref));
  const validated = validateProposal({ proposal: parseProposal(raw), allowedRefs });

  const manifest = buildPackageManifest({
    packId: source.packId,
    seedId: source.seedId,
    contract,
    promptSha256,
    storyQuestion: validated.storyQuestion,
    claims: validated.claims,
    segments: validated.segments,
  });
  const packageId = packageIdentity(manifest);

  await pause('validated');

  const written = await withTransaction(pool, async (client) => {
    const inserted = await client.query(
      `insert into vlogops.story_package
         (package_id, pack_id, seed_id, derivation_id, scribe_version, contract_version,
          contract_id, derivation_rule_version, prompt_sha256, model_binding, manifest,
          story_question, claim_count, segment_count)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14)
       on conflict (package_id) do nothing
       returning package_id`,
      [
        packageId,
        source.packId,
        source.seedId,
        derivationId,
        SCRIBE_VERSION,
        contract.version,
        contract.id,
        SCRIBE_DERIVATION_RULE_VERSION,
        promptSha256,
        JSON.stringify(modelBinding),
        JSON.stringify(manifest),
        validated.storyQuestion,
        manifest.claims.length,
        manifest.segments.length,
      ],
    );

    const deduplicated = inserted.rowCount === 0;
    if (deduplicated) return { deduplicated: true };

    await pause('package-inserted');

    for (const c of manifest.claims) {
      await client.query(
        `insert into vlogops.story_claim (package_id, claim_id, kind, ordinal, text)
         values ($1,$2,$3,$4,$5)`,
        [packageId, c.claim_id, c.kind, c.ordinal, c.text],
      );
      for (const ref of c.citations) {
        await client.query(
          `insert into vlogops.story_claim_citation (package_id, claim_id, pack_id, source_ref)
           values ($1,$2,$3,$4)`,
          [packageId, c.claim_id, source.packId, ref],
        );
      }
    }

    await pause('master-written');

    for (const s of manifest.segments) {
      await client.query(
        `insert into vlogops.story_segment
           (package_id, sibling, ordinal, role, text, claim_id, pack_id, source_ref)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [packageId, s.sibling, s.ordinal, s.role, s.text, s.claim_id, source.packId, s.source_ref],
      );
    }

    await pause('pre-commit');
    return { deduplicated: false };
  });

  return {
    packageId,
    packId: source.packId,
    seedId: source.seedId,
    derivationId,
    contract: { version: contract.version, id: contract.id },
    promptSha256,
    promptBytes: Buffer.byteLength(prompt, 'utf8'),
    modelBinding,
    deduplicated: written.deduplicated,
    claimCount: manifest.claims.length,
    segmentCount: manifest.segments.length,
    manifest,
    document: packageDocument({ packageId, manifest }),
    ordinalByRef: new Map(source.entries.map((e) => [e.source_ref, e.ordinal])),
  };
}

/** Read a package, its master and its siblings back. Stored rows only. */
export async function readStoryPackage(pool, packageId) {
  const pkg = await pool.query(
    `select package_id, pack_id, seed_id, derivation_id, scribe_version, contract_version,
            contract_id, derivation_rule_version, prompt_sha256, manifest_algo, model_binding,
            manifest, story_question, claim_count, segment_count, created_at
       from vlogops.story_package where package_id = $1`,
    [packageId],
  );
  if (pkg.rowCount === 0) return null;

  const claims = await pool.query(
    `select claim_id, kind, ordinal, text from vlogops.story_claim
      where package_id = $1 order by kind, ordinal`,
    [packageId],
  );
  const citations = await pool.query(
    `select claim_id, pack_id, source_ref from vlogops.story_claim_citation
      where package_id = $1 order by claim_id, source_ref`,
    [packageId],
  );
  const segments = await pool.query(
    `select sibling, ordinal, role, text, claim_id, pack_id, source_ref
       from vlogops.story_segment where package_id = $1 order by sibling, ordinal`,
    [packageId],
  );

  return {
    pkg: pkg.rows[0], claims: claims.rows, citations: citations.rows, segments: segments.rows,
  };
}

/**
 * VERIFY A PACKAGE WITHOUT TRUSTING ANYTHING THAT WROTE IT.
 *
 * Four independent questions, and a package is only whole if all four answer yes:
 *
 *   1. Does the stored manifest still hash to the package's own id?
 *   2. Does every master claim rest on at least one citation, and does every citation resolve
 *      to an entry that is really in this package's pack?
 *   3. Does every sibling segment name a master claim of this package, and cite something that
 *      master claim actually rests on?
 *   4. Do the header's counts match the rows beneath it?
 *
 * The database already refuses to store a package that fails 2, 3 or 4. This asks anyway, from
 * outside, by query — because a control that has never been made to answer is a control nobody
 * has evidence for, and because Phase 4's verifier needs exactly this read-back.
 */
export async function verifyStoryPackage(pool, packageId) {
  const found = await readStoryPackage(pool, packageId);
  if (found === null) {
    return { ok: false, packageId, problems: ['package not found'], segmentsTraced: 0 };
  }

  const { pkg, claims, citations, segments } = found;
  const problems = [];
  const packId = pkg.pack_id.trim();

  // 1 — identity recomputes from the stored bytes.
  const recomputed = packageIdentity(pkg.manifest);
  if (recomputed !== pkg.package_id.trim()) {
    problems.push(`stored manifest hashes to ${recomputed}, not to the package id ${pkg.package_id.trim()}`);
  }

  // 4 — the header's counts describe the rows that are actually there.
  if (claims.length !== pkg.claim_count) {
    problems.push(`package claims ${pkg.claim_count} master claims and holds ${claims.length}`);
  }
  if (segments.length !== pkg.segment_count) {
    problems.push(`package claims ${pkg.segment_count} segments and holds ${segments.length}`);
  }

  // 2 — every citation resolves to a real entry of THIS pack.
  const entries = await pool.query(
    'select source_ref from vlogops.evidence_pack_entry where pack_id = $1', [packId],
  );
  const packRefs = new Set(entries.rows.map((r) => r.source_ref));

  const citationsByClaim = new Map();
  for (const c of citations) {
    if (c.pack_id.trim() !== packId) {
      problems.push(`citation ${c.claim_id} -> ${c.source_ref} names pack ${c.pack_id.trim()}, not ${packId}`);
    }
    if (!packRefs.has(c.source_ref)) {
      problems.push(`citation ${c.claim_id} -> ${c.source_ref} does not resolve to an entry of this pack`);
    }
    if (!citationsByClaim.has(c.claim_id)) citationsByClaim.set(c.claim_id, new Set());
    citationsByClaim.get(c.claim_id).add(c.source_ref);
  }

  const claimIds = new Set(claims.map((c) => c.claim_id));
  for (const c of claims) {
    const held = citationsByClaim.get(c.claim_id);
    if (held === undefined || held.size === 0) {
      problems.push(`master claim ${c.claim_id} rests on no evidence`);
    }
  }

  // 3 — every sibling segment traces to its master, and its master's evidence.
  let segmentsTraced = 0;
  for (const s of segments) {
    const where = `${s.sibling}[${s.ordinal}]`;
    if (!claimIds.has(s.claim_id)) {
      problems.push(`${where} adapts ${s.claim_id}, which is not a master claim of this package`);
      continue;
    }
    if (!packRefs.has(s.source_ref)) {
      problems.push(`${where} cites ${s.source_ref}, which is not an entry of this pack`);
      continue;
    }
    const held = citationsByClaim.get(s.claim_id);
    if (held === undefined || !held.has(s.source_ref)) {
      problems.push(`${where} cites ${s.source_ref}, which its master ${s.claim_id} does not rest on`);
      continue;
    }
    segmentsTraced += 1;
  }

  return {
    ok: problems.length === 0 && segments.length > 0 && segmentsTraced === segments.length,
    packageId: pkg.package_id.trim(),
    packId,
    seedId: pkg.seed_id.trim(),
    derivationId: pkg.derivation_id.trim(),
    contract: { version: pkg.contract_version, id: pkg.contract_id.trim() },
    modelBinding: pkg.model_binding,
    claimCount: claims.length,
    segmentCount: segments.length,
    segmentsTraced,
    problems,
  };
}
