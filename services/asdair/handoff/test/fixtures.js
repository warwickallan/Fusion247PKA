// =====================================================================
// BUILD-015 AsdAIr - handoff/test/fixtures.js
//
// Packet fixtures conforming to SONNET-BROWSER-EXECUTION-PACKET.schema.json.
//
// The base packet is deliberately IN the declared order (normalized brand A-Z,
// NULL brand last, then canonical product name A-Z) so that the sort proofs
// have to break it on purpose rather than being accidentally satisfied.
//
// No real household data. Invented brands and products only - this is a public
// repository.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

function line(over = {}) {
  return {
    seq: 1,
    shop_line_no: 1,
    original_list_line: 'a thing',
    canonical_product_id: 11,
    canonical_product_name: 'Thing',
    brand: 'Acme',
    normalized_brand: 'acme',
    source_view: 'regulars',
    asda_product_ref: '1000001',
    asda_url: 'https://groceries.asda.com/product/1000001',
    required_quantity: 1,
    origin: 'known',
    approved_search_term: null,
    substitutes_allowed: false,
    applied_rules: [],
    quantity_rationale: null,
    ...over,
  };
}

/**
 * Four lines, correctly ordered: acme < brava < zenith, then NULL brand last.
 * Three known, one newly approved. 4 distinct products, 7 units.
 */
function basePacket(over = {}) {
  const lines = [
    line({ seq: 1, canonical_product_id: 11, canonical_product_name: 'Oat Crunch', brand: 'Acme', normalized_brand: 'acme', asda_product_ref: '1000001', original_list_line: 'oat crunch', required_quantity: 2 }),
    line({ seq: 2, canonical_product_id: 12, canonical_product_name: 'Rice Pot', brand: 'Brava', normalized_brand: 'brava', asda_product_ref: '1000002', original_list_line: 'rice pots x3', required_quantity: 3, source_view: 'favourites' }),
    line({
      seq: 3, canonical_product_id: null, canonical_product_name: 'Cocoa Drops', brand: 'Zenith', normalized_brand: 'zenith',
      asda_product_ref: null, asda_url: null, original_list_line: 'coco drops??', required_quantity: 1,
      origin: 'new_approved', source_view: 'search', approved_search_term: 'Zenith Cocoa Drops 200g',
    }),
    line({ seq: 4, canonical_product_id: 14, canonical_product_name: 'Table Salt', brand: null, normalized_brand: null, asda_product_ref: '1000004', original_list_line: 'salt', required_quantity: 1 }),
  ];
  return {
    packet_version: 1,
    shop_ref: 'SHOP-2026-08-09',
    generated_at: '2026-08-09T09:00:00.000Z',
    household_id: 1,
    sort_contract: 'brand_az_then_product_az',
    expected_distinct_products: 4,
    expected_total_units: 7,
    lines,
    held: [
      { shop_line_no: 9, original_list_line: 'something unreadable', reason: 'ambiguous', detail: 'could not be read', rule_id: null },
    ],
    ...over,
  };
}

/** A completion report that matches basePacket() exactly. */
function goodReport(fingerprint, over = {}) {
  return {
    packet_fingerprint: fingerprint,
    shop_ref: 'SHOP-2026-08-09',
    lines: [
      { seq: 1, status: 'added', quantity: 2 },
      { seq: 2, status: 'added', quantity: 3 },
      { seq: 3, status: 'added', quantity: 1, asda_product_ref: '1000003', asda_url: 'https://groceries.asda.com/product/1000003', favourited: true },
      { seq: 4, status: 'added', quantity: 1 },
    ],
    basket: { distinct_products: 4, total_units: 7 },
    confirmations: {
      no_checkout: true, no_payment: true, no_delivery_slot: true,
      no_password_entry: true, no_automatic_substitution: true,
    },
    notes: [],
    ...over,
  };
}

module.exports = { line, basePacket, goodReport };
