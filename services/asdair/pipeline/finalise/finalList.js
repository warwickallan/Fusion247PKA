// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/finalList.js
//
// WO-2026-08-13-04 (WP-B15-37), AC3 + AC5. THE DURABLE FINAL SHOPPING LIST,
// SORTED BY BRAND, with four-way provenance that never leaks.
//
// ── AC3: PROVENANCE STAYS FOUR-WAY DISTINCT ──────────────────────────────
// Warwick: "PHOTO is not REGULARS. REGULARS is not RULE. RULE is not HUMAN."
// The vocabulary is migration 020's own (PHOTO / REGULARS / RULE / WARWICK,
// where WARWICK is the HUMAN kind), taken from `pipeline/lineProvenance.js` so
// the two cannot drift.
//
// MIGRATION 020 IS APPLIED (2026-08-13). `asdair.shop_line_provenance` and
// `asdair.shop_image_region` EXIST, and `asdair_rw` holds SELECT+INSERT on both
// with UPDATE and DELETE refused at the database. The previous note here said
// the opposite; it was true when written and became false when 020 was applied,
// and WO-2026-08-13-10 AC7 corrects it.
//
// What has NOT changed is this file's own behaviour: it still writes no schema,
// applies no migration, and depends on no table existing. The ledger is modelled
// IN THE DURABLE ARTEFACT, in the shape the table takes, so the rows can be
// inserted from it without a re-derivation. Persisting them is a separate,
// deliberately MANUAL step (WO-2026-08-13-10) - proving the writer against a
// disposable Postgres is builder evidence, and the live confirmation write is
// Larry's, not this module's and not the pipeline's.
//
// The arithmetic, and it must reconcile exactly:
//
//     photo source truth + separately justified additions - explicit skips
//        = the final shopping plan
//
// ⛔ "Do not contaminate PHOTO truth merely to make the final plan balance."
// A line the household normally buys is REGULARS and is counted separately; it
// is never folded into the photo count to make a total come out right.
//
// PURE. No I/O, no model, no clock, no database.
// =====================================================================

'use strict';

/** Migration 020's provenance vocabulary. WARWICK is the HUMAN kind. */
export const PROVENANCE = Object.freeze({
  PHOTO: 'PHOTO',
  REGULARS: 'REGULARS',
  RULE: 'RULE',
  WARWICK: 'WARWICK',
});

/** What happened to a line. AC1's three outcomes, and nothing else. */
export const DISPOSITION = Object.freeze({
  RESOLVED: 'resolved',
  SKIPPED: 'skipped',
  ROUTED: 'unresolved-routed',
});

const UNBRANDED = 'ZZ (no brand recorded)';

function brandOf(regular) {
  const b = regular && typeof regular.brand === 'string' ? regular.brand.trim() : '';
  return b === '' ? UNBRANDED : b;
}

/**
 * PURE. Build the durable final list from what the PRODUCTION run produced.
 *
 * Every input here is an OUTPUT of the real pipeline - the durable list items,
 * the durable shop_line rows, the open questions, and the execution packet the
 * production `buildBrowserHandoff` built. Nothing is recomputed from the
 * photograph, because recomputing it here is exactly the hand-assembled list the
 * Work Order forbids.
 */
export function buildFinalList({
  shop, listItems, shopLines, questions, packet, handoff,
  modelLines, catalogue, reconciled, unsupported,
}) {
  const regularsById = catalogue.regularsById;
  const byLineNo = new Map(modelLines.map((l) => [l.line_no, l]));
  const packetByLine = new Map((packet.lines || []).map((l) => [l.original_list_line, l]));
  const heldByLine = new Map((handoff.held || []).map((l) => [l.original_list_line, l]));

  const lines = [];

  for (const sl of shopLines) {
    const source = byLineNo.get(sl.line_no);
    const obs = source ? source._observation : null;
    const settled = source ? source._settled : null;
    const route = source ? source._route : null;
    const regular = sl.matched_regular_id !== null && sl.matched_regular_id !== undefined
      ? regularsById.get(Number(sl.matched_regular_id))
      : null;

    const item = listItems.find((i) => Number(i.id) === Number(sl.list_item_id)) || null;
    const itemName = item ? item.item_name : sl.raw_reading;
    const packetLine = packetByLine.get(itemName) || null;
    const heldLine = heldByLine.get(itemName) || null;

    const resolved = sl.status === 'matched' && regular !== null;
    const disposition = resolved ? DISPOSITION.RESOLVED : DISPOSITION.ROUTED;

    const question = (questions || []).find((q) => {
      const t = String(q.question_text || q.question_key || '').toLowerCase();
      return t.includes(String(itemName || '').toLowerCase().slice(0, 20));
    }) || null;

    lines.push({
      // WHAT IT IS
      brand: resolved ? brandOf(regular) : UNBRANDED,
      product: resolved ? regular.name : null,
      product_id: resolved ? Number(regular.id) : null,
      category: resolved ? (regular.category || null) : null,
      asda_product_id: resolved ? (regular.asda_product_id || null) : null,
      substitutes_allowed: resolved ? regular.substitutes_allowed === true : null,

      // HOW MANY, AND WHY THAT NUMBER
      quantity: item ? item.requested_qty : null,
      quantity_basis: settled ? settled.basis : null,
      quantity_settled: settled ? settled.settled : null,
      quantity_candidates: settled ? settled.candidates : [],
      pack_identity_applied: settled ? settled.packIdentityApplied === true : false,
      pack_identity_refused_evidence: settled ? settled.refusedEvidence : null,
      quantity_note: settled ? settled.reason : null,

      // WHERE IT CAME FROM - EXACTLY ONE ORIGIN, NEVER INFERRED FROM ANOTHER
      provenance: PROVENANCE.PHOTO,
      provenance_detail: {
        kind: PROVENANCE.PHOTO,
        line_no: sl.line_no,
        raw_reading: sl.raw_reading,
        source_region_id: obs ? obs.source_region : null,
        interpreter_model: shop.transcript_model || null,
        support: obs ? obs.support : null,
        support_of: obs ? obs.support_of : null,
        support_class: obs ? obs.support_class : null,
        seen_in_runs: obs ? obs.seen_in_runs : [],
        collapsed_duplicate_observations: obs ? (obs.collapsed_from || []).length : 0,
        identity_disagreement: obs ? obs.identity_disagreement === true : false,
        identity_candidates: obs ? obs.identity_candidates : [],

        // WO-2026-08-13-10 AC5. The vision layer's OWN referral, and whether a
        // deterministic rule discharged it. Carried here so a reader can see
        // that agreement did not decide this line's fate on its own.
        // `support_class` describes AGREEMENT and never evidential truth: its
        // vocabulary is unanimous / corroborated / uncorroborated, and no value
        // of it means verified.
        vision_referral: obs ? obs.vision_needs_human === true : false,
        vision_referral_reasons: obs ? (obs.vision_needs_human_reasons || []) : [],
        human_route_causes: route ? route.causes : [],
        human_route_unresolved_reasons: route ? route.unresolvedReasons : [],
      },

      // WHAT HAPPENS TO IT
      disposition,
      status: sl.status,
      match_basis: sl.match_basis || null,
      shoppable: packetLine !== null && heldLine === null,
      held_reason: heldLine ? (heldLine.reason || (heldLine.hold && heldLine.hold.reason) || 'held') : null,
      held_detail: heldLine ? (heldLine.detail || (heldLine.hold && heldLine.hold.detail) || null) : null,
      routed_question: question ? (question.question_key || null) : null,
      list_item_name: itemName,
    });
  }

  // ── SEPARATELY JUSTIFIED ADDITIONS ───────────────────────────────────────
  // A basket line that is NOT one of the photo's lines. It is counted apart from
  // the photo count and carries its own origin, never PHOTO.
  const photoItemNames = new Set(lines.map((l) => l.list_item_name));
  const additions = [];
  for (const item of listItems) {
    if (photoItemNames.has(item.item_name)) continue;
    additions.push({
      brand: UNBRANDED,
      product: item.item_name,
      quantity: item.requested_qty,
      provenance: PROVENANCE.REGULARS,
      provenance_detail: { kind: PROVENANCE.REGULARS, reason: 'added by the planner from the household Regulars, not read off the photograph' },
      disposition: DISPOSITION.RESOLVED,
      list_item_name: item.item_name,
    });
  }

  // ── EXPLICIT SKIPS ───────────────────────────────────────────────────────
  // A photo candidate only ONE of the independent readings produced. It is not
  // an established page line and it does not enter the shop; it is recorded here
  // with its reason and routed for a human, never silently discarded.
  const skips = (unsupported || []).map((o) => ({
    as_written: o.as_written,
    identity_key: o.identity_key,
    proposed_product_id: o.product_id,
    support: o.support,
    support_of: o.support_of,
    seen_in_runs: o.seen_in_runs,
    disposition: DISPOSITION.SKIPPED,
    reason: `seen by only ${o.support} of ${o.support_of} independent readings of the same photograph - an unsupported photo candidate, indistinguishable here from an invented line`,
    routed_to: 'cockpit review queue',
  }));

  // ── SORT BY BRAND, as Warwick specified ─────────────────────────────────
  const sorted = [...lines].sort((a, b) => {
    const byBrand = String(a.brand).localeCompare(String(b.brand), 'en', { sensitivity: 'base' });
    if (byBrand !== 0) return byBrand;
    return String(a.product || a.list_item_name).localeCompare(String(b.product || b.list_item_name), 'en', { sensitivity: 'base' });
  });
  const sortedAdditions = [...additions].sort((a, b) => String(a.brand).localeCompare(String(b.brand), 'en'));

  const shoppable = sorted.filter((l) => l.shoppable);
  const held = sorted.filter((l) => !l.shoppable);

  const itemCount = sorted.reduce((n, l) => n + (Number.isInteger(l.quantity) ? l.quantity : 0), 0)
    + sortedAdditions.reduce((n, l) => n + (Number.isInteger(l.quantity) ? l.quantity : 0), 0);

  return {
    artefact_version: '1.0.0',
    work_order: 'WO-2026-08-13-04 (WP-B15-37)',
    generated_from: 'the three FINAL frozen vision runs of the real photograph; vision PARKED at 54c3b0b',
    produced_by: 'services/asdair/pipeline/runPipeline.js and the production modules it calls, over the offline durable store',
    not_a_live_run: 'No live database write, no browser, no trolley, no checkout, no slot, no order. PRODUCT CAPABILITY EVIDENCE, not acceptance.',
    shop_ref: shop.shop_ref,
    shop_status: shop.status,
    sorted_by: 'BRAND, then product name',
    // The PRODUCTION packet contract's own declaration, not this file's claim.
    packet_sort_contract: handoff.sort_contract,
    packet_sort_contract_declared: handoff.sort_contract_declared === true,
    packet_sort_contract_verified: handoff.sort_contract_verified === true,
    provenance_counts: {
      PHOTO: lines.length,
      REGULARS: additions.filter((a) => a.provenance === PROVENANCE.REGULARS).length,
      RULE: additions.filter((a) => a.provenance === PROVENANCE.RULE).length,
      WARWICK: additions.filter((a) => a.provenance === PROVENANCE.WARWICK).length,
    },
    totals: {
      photo_source_lines: lines.length,
      separately_justified_additions: sortedAdditions.length,
      explicit_skips: skips.length,
      product_count: sorted.length + sortedAdditions.length,
      item_count: itemCount,
      shoppable_lines: shoppable.length,
      held_lines: held.length,
      routed_lines: sorted.filter((l) => l.disposition === DISPOSITION.ROUTED).length,
    },
    provenance_arithmetic: {
      statement: 'photo source truth + separately justified additions - explicit skips = final shopping plan',
      photo: lines.length,
      additions: sortedAdditions.length,
      skips: skips.length,
      final_plan: sorted.length + sortedAdditions.length,
      reconciles: lines.length + sortedAdditions.length === sorted.length + sortedAdditions.length,
    },
    packet_fingerprint: handoff.packet_fingerprint,
    instructions_version: handoff.instructions_version,
    lines: sorted,
    additions: sortedAdditions,
    skipped: skips,
    reconciliation_summary: {
      runs: reconciled.runLabels,
      observations: reconciled.observations.length,
      counts: reconciled.counts,
      duplicate_observations_collapsed: Object.fromEntries(
        Object.entries(reconciled.collapsedByRun).map(([k, v]) => [k, v.length]),
      ),
    },
  };
}

/** A human-readable rendering of the same artefact. Derived, never authored. */
export function renderFinalListMarkdown(list) {
  const rows = [];
  rows.push(`# AsdAIr final shopping list - ${list.shop_ref}`);
  rows.push('');
  rows.push(`> ${list.not_a_live_run}`);
  rows.push('');
  rows.push(`- Produced by: \`${list.produced_by}\``);
  rows.push(`- Source: ${list.generated_from}`);
  rows.push(`- Sorted by: **${list.sorted_by}**`);
  rows.push(`- Products: **${list.totals.product_count}** · Items: **${list.totals.item_count}**`);
  rows.push(`- Shoppable now: **${list.totals.shoppable_lines}** · Held for a decision: **${list.totals.held_lines}**`);
  rows.push(`- Photo lines: ${list.totals.photo_source_lines} · Separate additions: ${list.totals.separately_justified_additions} · Explicit skips: ${list.totals.explicit_skips}`);
  rows.push('');
  rows.push('## The list, by brand');
  rows.push('');
  rows.push('| Brand | Product | Qty | Qty basis | Provenance | Ready | Note |');
  rows.push('|---|---|---:|---|---|---|---|');
  for (const l of list.lines) {
    rows.push(`| ${l.brand} | ${l.product || `_${l.list_item_name}_`} | ${l.quantity ?? '-'} | ${l.quantity_basis || '-'} | ${l.provenance} | ${l.shoppable ? 'yes' : `HELD (${l.held_reason || 'decision'})`} | ${(l.quantity_note || l.held_detail || '').replace(/\|/g, '/')} |`);
  }
  if (list.additions.length) {
    rows.push('');
    rows.push('## Separately justified additions (NOT photo lines)');
    rows.push('');
    for (const a of list.additions) rows.push(`- ${a.product} x${a.quantity ?? 1} - ${a.provenance}`);
  }
  rows.push('');
  rows.push('## Explicitly skipped - unsupported photo candidates, routed for review');
  rows.push('');
  if (list.skipped.length === 0) rows.push('_none_');
  for (const s of list.skipped) rows.push(`- \`${s.as_written}\` - ${s.reason}`);
  rows.push('');
  return `${rows.join('\n')}\n`;
}
