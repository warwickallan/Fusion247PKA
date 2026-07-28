// =====================================================================
// BUILD-015 AsdAIr - order reconciliation: fixtures.js
//
// TEST SUPPORT ONLY. Not required by any runtime module.
//
// SYNTHETIC FIXTURES ONLY. The product names are ordinary supermarket
// groceries and the quantities and prices are invented to hit specific
// arithmetic; NO real household data, no real order, no real prices. This
// file runs in CI on the PUBLIC repo.
//
// THE HEADLINE FIXTURE (`MESSY_CONFIRMATION_TEXT`) reproduces the real shape
// the reconciler has to survive:
//     32 distinct product lines
//     47 purchased units
//     GBP 110.75 in EXPLICITLY SHOWN line prices
//     ONE line - Wall's 4 Pork Sausage Rolls - shown with NO price at all
// plus the mess: header/footer furniture, blank lines, a column-header row, a
// wrapped product name, standalone promotion lines, inline promotions, a
// delivery charge and a savings line, and NO order total.
//
// Because there is no order total, the unpriced line MUST stay
// price_basis 'unknown' - there is nothing to derive it from, and inventing a
// number is the one thing this module must never do.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================

'use strict';

const P = '\u00A3';

// The 32 product lines, as data, so the expected totals are checkable at a
// glance and cannot drift from the text below.
// [ product name, quantity, price shown by ASDA (null = none shown) ]
const EXPECTED_LINES = [
  ["ASDA British Semi Skimmed Milk 2.27L (4 pints)", 2, 3.35],
  ["Warburtons Toastie Thick Sliced White Bread 800g", 2, 1.65],
  ["ASDA Free Range Large Eggs 12 Pack", 1, 3.50],
  ["Lurpak Slightly Salted Spreadable 500g", 1, 6.00],
  ["Cathedral City Mature Cheddar 350g", 1, 5.00],
  ["Yeo Valley Organic Natural Yogurt 500g", 2, 2.20],
  ["ASDA Chicken Breast Fillets 650g", 1, 6.75],
  ["ASDA British Beef Mince 5% Fat 500g", 2, 5.00],
  ["Richmond Thick Pork Sausages 12 Pack", 1, 3.40],
  ["Wall's 4 Pork Sausage Rolls", 2, null],
  ["ASDA Bananas 5 Pack", 2, 1.00],
  ["Pink Lady Apples 4 Pack", 1, 2.50],
  ["ASDA Baby Plum Tomatoes 250g", 2, 1.15],
  ["ASDA Baby Leaf Spinach 240g", 1, 1.60],
  ["ASDA Broccoli 350g", 2, 0.75],
  ["ASDA Maris Piper Potatoes 2.5kg", 1, 2.20],
  ["ASDA Carrots 1kg", 1, 0.65],
  ["Napolina Chopped Tomatoes 400g", 4, 0.55],
  ["Heinz Baked Beans 4 x 415g", 1, 4.50],
  ["Kellogg's Corn Flakes 720g", 1, 4.25],
  ["ASDA Penne Pasta 500g", 2, 0.75],
  ["Tilda Pure Basmati Rice 1kg", 1, 4.25],
  ["PG Tips Pyramid Tea Bags 240 Pack", 1, 7.00],
  ["Nescafe Gold Blend Instant Coffee 200g", 1, 10.75],
  ["Yazoo Strawberry Milkshake 400ml", 2, 1.25],
  ["Robinsons Orange Squash No Added Sugar 1L", 1, 1.75],
  ["Fairy Max Power Washing Up Liquid 545ml", 1, 2.50],
  ["Andrex Classic Clean Toilet Tissue 9 Roll", 1, 7.50],
  ["Persil Non Bio Washing Liquid 38 Wash", 1, 13.50],
  ["Colgate Total Original Toothpaste 125ml", 2, 2.50],
  ["ASDA Kitchen Foil 30cm x 10m", 1, 1.50],
  ["Cadbury Dairy Milk 110g", 2, 1.50]
];

const EXPECTED_LINE_COUNT = 32;
const EXPECTED_UNIT_COUNT = 47;
const EXPECTED_STATED_PRICE_SUM = 110.75;
const UNPRICED_PRODUCT = "Wall's 4 Pork Sausage Rolls";

// The pasted text, deliberately messy. Written as an array of literal lines so
// no source indentation leaks in; the ONE indented line is the deliberate
// wrapped product name.
const MESSY_CONFIRMATION_LINES = [
  'Your ASDA Groceries order',
  '',
  'Order number: 900000000123',
  'Delivery slot: Tue 21 Jul, 10:00 - 12:00',
  '',
  'Item                                                  Qty   Price',
  '------------------------------------------------------------------',
  '',
  '2 x ASDA British Semi Skimmed Milk 2.27L (4 pints)       ' + P + '3.35',
  '2 x Warburtons Toastie Thick Sliced White Bread 800g     ' + P + '1.65',
  '1 x ASDA Free Range Large Eggs 12 Pack                   ' + P + '3.50',
  '1 x Lurpak Slightly Salted Spreadable 500g               ' + P + '6.00',
  '1 x Cathedral City Mature Cheddar 350g                   ' + P + '5.00',
  '2 x Yeo Valley Organic Natural Yogurt 500g               ' + P + '2.20',
  '',
  '1 x ASDA Chicken Breast Fillets 650g                     ' + P + '6.75',
  '2 x ASDA British Beef Mince 5% Fat 500g                  ' + P + '5.00',
  '1 x Richmond Thick Pork Sausages 12 Pack                 ' + P + '3.40',
  // THE CASE THIS WHOLE MODULE EXISTS FOR: no price shown at all.
  "2 x Wall's 4 Pork Sausage Rolls",
  '',
  '2 x ASDA Bananas 5 Pack                                  ' + P + '1.00',
  '1 x Pink Lady Apples 4 Pack                              ' + P + '2.50',
  '2 x ASDA Baby Plum Tomatoes 250g                         ' + P + '1.15',
  '1 x ASDA Baby Leaf Spinach 240g                          ' + P + '1.60',
  '2 x ASDA Broccoli 350g                                   ' + P + '0.75',
  'Rollback',
  '1 x ASDA Maris Piper Potatoes 2.5kg                      ' + P + '2.20',
  '1 x ASDA Carrots 1kg                                     ' + P + '0.65',
  '',
  '4 x Napolina Chopped Tomatoes 400g                       ' + P + '0.55',
  '1 x Heinz Baked Beans 4 x 415g                           ' + P + '4.50',
  "1 x Kellogg's Corn Flakes 720g                           " + P + '4.25',
  '2 x ASDA Penne Pasta 500g                                ' + P + '0.75',
  '1 x Tilda Pure Basmati Rice 1kg                          ' + P + '4.25',
  '1 x PG Tips Pyramid Tea Bags 240 Pack                    ' + P + '7.00',
  '1 x Nescafe Gold Blend Instant Coffee 200g               ' + P + '10.75',
  '',
  '2 x Yazoo Strawberry Milkshake 400ml                     ' + P + '1.25',
  '2 for ' + P + '5',
  '1 x Robinsons Orange Squash No Added Sugar 1L            ' + P + '1.75',
  '',
  '1 x Fairy Max Power Washing Up Liquid 545ml              ' + P + '2.50',
  '1 x Andrex Classic Clean Toilet Tissue 9 Roll            ' + P + '7.50',
  // A wrapped product name: the price sits on the continuation line.
  '1 x Persil Non Bio Washing Liquid',
  '      38 Wash                                            ' + P + '13.50',
  '2 x Colgate Total Original Toothpaste 125ml              ' + P + '2.50',
  '1 x ASDA Kitchen Foil 30cm x 10m                         ' + P + '1.50',
  '2 x Cadbury Dairy Milk 110g                              ' + P + '1.50',
  'Save 30p',
  '',
  'Delivery charge                                          ' + P + '4.50',
  'Total savings                                            ' + P + '6.20',
  '',
  'Thanks for shopping with ASDA'
];

const MESSY_CONFIRMATION_TEXT = MESSY_CONFIRMATION_LINES.join('\n');

// ---------------------------------------------------------------------
// A small, purpose-built plan / list / regulars set that exercises ALL SEVEN
// outcomes exactly once each. Kept separate from the 32-line fixture so each
// test says one thing.
// ---------------------------------------------------------------------
const REGULARS = [
  {
    id: 41,
    household_id: 1,
    name: 'Arla British Semi Skimmed Milk 2.27L',
    aka: ['milk', '4pt milk'],
    asda_product_id: '1000000000041',
    active: true
  },
  {
    id: 42,
    household_id: 1,
    name: 'Yazoo Strawberry Milkshake 400ml',
    aka: ['strawberry milkshake'],
    active: true
  },
  {
    id: 43,
    household_id: 1,
    name: 'Cadbury Dairy Milk 110g',
    aka: ['dairy milk'],
    active: true
  }
];

const LIST_ITEMS = [
  { item_name: 'milk' },
  { item_name: 'bread' },
  { item_name: 'sausage rolls' },
  { item_name: 'coffee' },
  { item_name: 'yogurt' },
  { item_name: 'crisps' }
];

const PLAN = {
  summary: { total_requested: 6, planned_add: 5 },
  items: [
    // -> as_planned
    { item_name: 'milk', matched_product: 'Arla British Semi Skimmed Milk 2.27L', requested_qty: 2, planned_qty: 2, status: 'add' },
    // -> qty_changed (2 arrived, 1 was planned)
    { item_name: 'bread', matched_product: 'Warburtons Toastie Thick Sliced White Bread 800g', requested_qty: 1, planned_qty: 1, status: 'add' },
    // -> price_missing (arrived, but ASDA showed no price)
    { item_name: 'sausage rolls', matched_product: "Wall's 4 Pork Sausage Rolls", requested_qty: 2, planned_qty: 2, status: 'add' },
    // -> omitted (planned, never arrived)
    { item_name: 'coffee', matched_product: 'Nescafe Gold Blend Instant Coffee 200g', requested_qty: 1, planned_qty: 1, status: 'add' },
    // -> variant_changed (a different organic natural yogurt arrived)
    { item_name: 'yogurt', matched_product: 'Yeo Valley Organic Natural Yogurt 500g', requested_qty: 1, planned_qty: 1, status: 'add' },
    // -> added_after_planning (held for a human decision, but bought anyway)
    { item_name: 'crisps', matched_product: 'ASDA Ready Salted Crisps 6 Pack', requested_qty: 1, planned_qty: 1, status: 'needs_decision' }
  ]
};

const SEVEN_OUTCOME_CONFIRMATION_TEXT = [
  '2 x Arla British Semi Skimmed Milk 2.27L                 ' + P + '3.35',
  '2 x Warburtons Toastie Thick Sliced White Bread 800g     ' + P + '1.65',
  "2 x Wall's 4 Pork Sausage Rolls",
  '1 x ASDA Organic Natural Yogurt 500g                     ' + P + '2.20',
  '1 x ASDA Ready Salted Crisps 6 Pack                      ' + P + '1.20',
  '1 x Cadbury Dairy Milk 110g                              ' + P + '1.50',
  '1 x Zeta Widget Cleaner Concentrate 500ml                ' + P + '2.00'
].join('\n');

// A tiny confirmation WITH an authoritative order total, for the derivation
// path. 5.00 stated + 3.50 residual = the 8.50 total ASDA showed.
const DERIVABLE_CONFIRMATION_TEXT = [
  '2 x Generic Widget A 500g                                ' + P + '5.00',
  '1 x Generic Widget B 250g',
  '',
  'Order total                                              ' + P + '8.50'
].join('\n');

module.exports = {
  P: P,
  EXPECTED_LINES: EXPECTED_LINES,
  EXPECTED_LINE_COUNT: EXPECTED_LINE_COUNT,
  EXPECTED_UNIT_COUNT: EXPECTED_UNIT_COUNT,
  EXPECTED_STATED_PRICE_SUM: EXPECTED_STATED_PRICE_SUM,
  UNPRICED_PRODUCT: UNPRICED_PRODUCT,
  MESSY_CONFIRMATION_TEXT: MESSY_CONFIRMATION_TEXT,
  SEVEN_OUTCOME_CONFIRMATION_TEXT: SEVEN_OUTCOME_CONFIRMATION_TEXT,
  DERIVABLE_CONFIRMATION_TEXT: DERIVABLE_CONFIRMATION_TEXT,
  REGULARS: REGULARS,
  LIST_ITEMS: LIST_ITEMS,
  PLAN: PLAN
};
