// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/lineProvenance.js
//
// WO-2026-08-11-B15-VISION-01, AC6: builds and persists rows in
// asdair.shop_line_provenance (migration 020) - the durable, four-way
// ("why is this line in the shop?") ledger PHOTO/REGULARS/RULE/WARWICK
// lines are written to BEFORE Regulars/rule enrichment runs against them.
//
// ── THIS MODULE IS THE WRITER, NOT THE ORCHESTRATOR ───────────────────────
// It does not decide WHEN enrichment runs relative to these writes - that
// ordering (AC6's "provable by reading the call order in the
// implementation") is deps.js's `interpretPhoto` seam's job, which
// WO-2026-08-11-B15-VISION-01 Amendment 2 holds pending Finding 2 (the
// image-processing dependency decision). What is delivered here is real and
// complete on its own: every one of the four provenance kinds can be built
// and durably persisted, correctly, against Silas's actual committed
// constraints - proven against a real disposable Postgres, not asserted.
//
// ── INSERT-ONLY, AND WHY THAT SHAPES THIS FILE'S WRITE ORDER ───────────────
// Migration 020's own grants give asdair_rw SELECT + INSERT on this table
// and NOTHING ELSE - no UPDATE, no DELETE (section 6 of the migration).
// `superseded_by_id` can therefore NEVER be set by a later UPDATE once a row
// exists; it can only be set AT INSERT TIME, which means a superseding row's
// real database id must already be known before the row it supersedes is
// written. `insertPhotoProvenanceBatch` below inserts every SURVIVING PHOTO
// line first (capturing its real id), then every SUPERSEDED line second,
// resolving superseded_by_id from the survivor ids just returned - never the
// reverse, and never a two-phase insert-then-update (which this schema does
// not grant the role to perform at all).
// =====================================================================

'use strict';

const PROVENANCE_KINDS = Object.freeze(['PHOTO', 'REGULARS', 'RULE', 'WARWICK']);

const INSERT_COLUMNS = [
  'shop_id', 'line_no', 'provenance', 'source_region_id', 'interpreter_model',
  'prompt_version', 'raw_text', 'matched_regular_id', 'quantity', 'confidence',
  'superseded_by_id',
];

const SELECT_LIST =
  'id, shop_id, line_no, provenance, source_region_id, interpreter_model, prompt_version, ' +
  'raw_text, matched_regular_id, quantity, confidence, superseded_by_id, interpreted_at, created_at';

const INSERT_SQL =
  `INSERT INTO asdair.shop_line_provenance (${INSERT_COLUMNS.join(', ')}) ` +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ' +
  `RETURNING ${SELECT_LIST}`;

function trimmedOrNull(text) {
  if (text === null || text === undefined) return null;
  const t = String(text).trim();
  return t === '' ? null : t;
}

/**
 * Shape-validate a row CLIENT-SIDE, mirroring migration 020's CHECK
 * constraints exactly. This is a fast-fail convenience - it is NEVER a
 * substitute for the database's own enforcement: AC3's proof deliberately
 * bypasses this function and inserts straight past it, precisely to prove
 * the DATABASE refuses an invalid row, not merely that this helper does.
 */
function assertRowSatisfiesChecks(row) {
  if (!PROVENANCE_KINDS.includes(row.provenance)) {
    throw new Error('lineProvenance: provenance must be one of ' + PROVENANCE_KINDS.join(', '));
  }
  const isPhoto = row.provenance === 'PHOTO';
  const hasRegion = row.source_region_id !== null && row.source_region_id !== undefined;
  if (isPhoto !== hasRegion) {
    throw new Error('lineProvenance: a PHOTO row requires source_region_id, and only a PHOTO row may carry one');
  }
  if (isPhoto && trimmedOrNull(row.raw_text) === null) {
    throw new Error('lineProvenance: a PHOTO row requires non-empty raw_text');
  }
  if (isPhoto && (trimmedOrNull(row.interpreter_model) === null || trimmedOrNull(row.prompt_version) === null)) {
    throw new Error('lineProvenance: a PHOTO row requires interpreter_model and prompt_version');
  }
  if (row.provenance === 'REGULARS' && (row.matched_regular_id === null || row.matched_regular_id === undefined)) {
    throw new Error('lineProvenance: a REGULARS row requires matched_regular_id');
  }
  if (['RULE', 'WARWICK'].includes(row.provenance)) {
    const hasProduct = row.matched_regular_id !== null && row.matched_regular_id !== undefined;
    const hasText = trimmedOrNull(row.raw_text) !== null;
    if (!hasProduct && !hasText) {
      throw new Error('lineProvenance: a RULE/WARWICK row must name either matched_regular_id or non-empty raw_text');
    }
  }
  if (row.quantity !== null && row.quantity !== undefined) {
    if (!Number.isInteger(row.quantity) || row.quantity <= 0 || row.quantity > 999) {
      throw new Error('lineProvenance: quantity must be null or an integer in 1..999');
    }
  }
  if (row.confidence !== null && row.confidence !== undefined) {
    if (!(row.confidence >= 0 && row.confidence <= 1)) {
      throw new Error('lineProvenance: confidence must be null or in 0..1');
    }
  }
}

function toRow(fields) {
  const row = {
    shop_id: fields.shop_id,
    line_no: fields.line_no ?? null,
    provenance: fields.provenance,
    source_region_id: fields.source_region_id ?? null,
    interpreter_model: fields.interpreter_model ?? null,
    prompt_version: fields.prompt_version ?? null,
    raw_text: trimmedOrNull(fields.raw_text),
    matched_regular_id: fields.matched_regular_id ?? null,
    quantity: fields.quantity ?? null,
    confidence: fields.confidence ?? null,
    superseded_by_id: fields.superseded_by_id ?? null,
  };
  assertRowSatisfiesChecks(row);
  return row;
}

// ---------------------------------------------------------------------
// Pure row builders - one per provenance kind.
// ---------------------------------------------------------------------

/**
 * @param {object} line - a photoSanityChecks-annotated line: {line_no,
 *   raw_reading, quantity, matched_regular_id, confidence, source_region}.
 *   `source_region` is the REGION NUMBER; the caller resolves it to the
 *   real asdair.shop_image_region.id (source_region_id) via the ids
 *   returned when those rows were persisted - this function never guesses
 *   that mapping.
 * @param {object} args
 * @param {number} args.shopId
 * @param {number} args.sourceRegionId - the resolved DB id for line.source_region.
 * @param {string} args.interpreterModel
 * @param {string} args.promptVersion
 */
export function buildPhotoProvenanceRow(line, { shopId, sourceRegionId, interpreterModel, promptVersion }) {
  return toRow({
    shop_id: shopId,
    line_no: line.line_no,
    provenance: 'PHOTO',
    source_region_id: sourceRegionId,
    interpreter_model: interpreterModel,
    prompt_version: promptVersion,
    raw_text: line.raw_reading,
    matched_regular_id: line.matched_regular_id ?? null,
    quantity: line.quantity ?? null,
    confidence: line.confidence ?? null,
  });
}

/** @param {object} args - {shopId, lineNo, matchedRegularId, quantity} */
export function buildRegularsProvenanceRow({ shopId, lineNo, matchedRegularId, quantity }) {
  return toRow({
    shop_id: shopId, line_no: lineNo ?? null, provenance: 'REGULARS',
    matched_regular_id: matchedRegularId, quantity: quantity ?? null,
  });
}

/** @param {object} args - {shopId, lineNo, matchedRegularId, rawText, quantity} */
export function buildRuleProvenanceRow({ shopId, lineNo, matchedRegularId, rawText, quantity }) {
  return toRow({
    shop_id: shopId, line_no: lineNo ?? null, provenance: 'RULE',
    matched_regular_id: matchedRegularId ?? null, raw_text: rawText ?? null, quantity: quantity ?? null,
  });
}

/** @param {object} args - {shopId, lineNo, matchedRegularId, rawText, quantity} */
export function buildWarwickProvenanceRow({ shopId, lineNo, matchedRegularId, rawText, quantity }) {
  return toRow({
    shop_id: shopId, line_no: lineNo ?? null, provenance: 'WARWICK',
    matched_regular_id: matchedRegularId ?? null, raw_text: rawText ?? null, quantity: quantity ?? null,
  });
}

// ---------------------------------------------------------------------
// Writes. INSERT-ONLY (see module header) - never UPDATE, never DELETE.
// ---------------------------------------------------------------------

function rowsOf(res) {
  return (res && res.rows) || [];
}

function paramsOf(row) {
  return INSERT_COLUMNS.map((c) => row[c] ?? null);
}

/** Insert ONE already-built, already-validated provenance row. Returns the persisted row (with its real id). */
export async function insertProvenanceRow(deps, row) {
  assertRowSatisfiesChecks(row);
  const res = await deps.writeQuery(INSERT_SQL, paramsOf(row));
  return rowsOf(res)[0];
}

/**
 * Insert a full batch of PHOTO-provenance lines (already dedup-annotated by
 * photoSanityChecks.resolveCrossStripDuplicates: each line carries
 * `supersededByIndex`, an index into THIS SAME array or null).
 *
 * Survivors are inserted FIRST (their real ids are what a superseding
 * relationship needs); superseded lines are inserted SECOND, with
 * superseded_by_id resolved from the survivor ids this call just received
 * back from Postgres - see the module header for why no UPDATE is possible.
 *
 * @param {object} deps - {writeQuery}
 * @param {Array<object>} lines - dedup-annotated photo lines.
 * @param {object} args - {shopId, regionIdByNumber (Map<region_no, source_region_id>), interpreterModel, promptVersion}
 * @returns {Promise<Array<object|null>>} the persisted rows, in the SAME
 *   order as `lines` (null at any index intentionally skipped - see below).
 */
export async function insertPhotoProvenanceBatch(deps, lines, { shopId, regionIdByNumber, interpreterModel, promptVersion }) {
  const persisted = new Array(lines.length).fill(null);
  const survivorIndices = [];
  const supersededIndices = [];
  lines.forEach((line, i) => {
    (line.supersededByIndex === null || line.supersededByIndex === undefined
      ? survivorIndices : supersededIndices).push(i);
  });

  for (const i of survivorIndices) {
    const line = lines[i];
    const sourceRegionId = regionIdByNumber.get(line.source_region);
    if (sourceRegionId === undefined) {
      throw new Error('lineProvenance: no persisted shop_image_region id known for region_no ' + String(line.source_region));
    }
    const row = buildPhotoProvenanceRow(line, { shopId, sourceRegionId, interpreterModel, promptVersion });
    persisted[i] = await insertProvenanceRow(deps, row);
  }

  for (const i of supersededIndices) {
    const line = lines[i];
    const survivorIndex = line.supersededByIndex;
    const survivorRow = persisted[survivorIndex];
    if (!survivorRow) {
      throw new Error('lineProvenance: line at index ' + i + ' claims supersededByIndex ' + survivorIndex
        + ', but that survivor was never persisted (out of range, or itself superseded - a chain, which this design never produces)');
    }
    const sourceRegionId = regionIdByNumber.get(line.source_region);
    if (sourceRegionId === undefined) {
      throw new Error('lineProvenance: no persisted shop_image_region id known for region_no ' + String(line.source_region));
    }
    const row = buildPhotoProvenanceRow(line, { shopId, sourceRegionId, interpreterModel, promptVersion });
    row.superseded_by_id = survivorRow.id;
    persisted[i] = await insertProvenanceRow(deps, row);
  }

  return persisted;
}

export const _internal = { INSERT_SQL, INSERT_COLUMNS, assertRowSatisfiesChecks };
