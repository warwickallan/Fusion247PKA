// =====================================================================
// WO-2026-08-17-B15-BASKET - RECONCILIATION AND HARVEST OUTPUT.
//
// The trolley is compared against the FROZEN MANIFEST, line by line, from what
// was actually read back off the page - never from what the plan intended. An
// executor that reports its own intentions has not reconciled anything.
//
// Two artefacts:
//   * the reconciliation report - for a human, naming every discrepancy;
//   * the regulars harvest - an operations file for update-regulars.js, WRITTEN
//     OUT and never applied. This process makes no live-data write.
// =====================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STATUS_ORDER = ['added', 'added_wrong_qty', 'out_of_stock', 'ambiguous', 'failed'];

function esc(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' '); }

/**
 * Which manifest lines are represented in the trolley the page actually shows?
 *
 * Matched by ASDA reference, because that is the only identity both sides
 * genuinely share - a name comparison would call "Heinz Baked Beans 6x415g" and
 * "Heinz Baked Beans & Richmond Pork Sausages 200g" the same line, which is the
 * exact confusion the manifest's own note on line 16 warns about.
 *
 * TWO KEY NAMES, AND BOTH ARE REAL. browser.cjs's TROLLEY_SNAPSHOT emits
 * `product_ref`; readTrolley.cjs's emits `product_id`. Reading only one of them
 * reports every correctly-added line as missing from the trolley - a false
 * NEGATIVE that makes the whole report worthless. Found by the first live run,
 * which is the only place it could have been found.
 */
function trolleyRef(p) {
  if (!p) return null;
  const v = p.product_ref != null ? p.product_ref : p.product_id;
  return v == null ? null : String(v);
}

function reconcile({ manifest, outcomes, basket }) {
  const inTrolley = new Map(
    ((basket && basket.products) || [])
      .filter((p) => trolleyRef(p))
      .map((p) => [trolleyRef(p), p]),
  );

  const byLine = new Map(outcomes.map((o) => [o.line, o]));
  const rows = [];

  for (const line of manifest.lines) {
    const o = byLine.get(Number(line.n)) || null;
    const ref = o && o.product_ref ? String(o.product_ref) : (line.asda_product_id ? String(line.asda_product_id) : null);
    const present = ref ? inTrolley.has(ref) : false;

    let discrepancy = null;
    if (!o) discrepancy = 'not attempted in this run';
    else if (o.status === 'ambiguous') discrepancy = `NOT ADDED - ambiguous (${o.reason})`;
    else if (o.status === 'out_of_stock') discrepancy = `NOT ADDED - ${o.reason}`;
    else if (o.status === 'failed') discrepancy = `NOT ADDED - failed (${o.reason})`;
    else if (!present) discrepancy = 'reported added, but NOT found in the trolley read-back';
    else if (o.status === 'added_wrong_qty') discrepancy = `in trolley, but quantity is ${o.qty_actual} not ${o.qty_target} (${o.qty_reason})`;

    rows.push({
      n: line.n,
      product: line.product,
      qty_wanted: line.qty,
      status: o ? o.status : 'not_attempted',
      product_ref: ref,
      name_on_site: o ? o.name : null,
      via: o ? o.via : null,
      in_trolley: present,
      qty_actual: o ? o.qty_actual : null,
      discrepancy,
      candidates: o && o.candidates ? o.candidates : null,
      reason: o ? (o.reason || o.why || null) : null,
    });
  }

  // Anything in the trolley that no manifest line accounts for.
  const claimed = new Set(rows.map((r) => r.product_ref).filter(Boolean));
  const unexpected = [...inTrolley.entries()]
    .filter(([ref]) => !claimed.has(ref))
    .map(([ref, p]) => ({ product_ref: ref, name: p.name }));

  return { rows, unexpected };
}

function writeReconciliation(file, { manifest, outcomes, basket, substitutions, plan, payload }) {
  const { rows, unexpected } = reconcile({ manifest, outcomes, basket });
  const count = (s) => rows.filter((r) => r.status === s).length;

  const out = [];
  out.push(`# ASDA trolley reconciliation — ${manifest.shop_ref}`);
  out.push('');
  out.push(`- Work Order: **WO-2026-08-17-B15-BASKET**`);
  out.push(`- Run status: **${payload ? payload.status : 'unknown'}** · generated ${new Date().toISOString()}`);
  out.push(`- Frozen manifest: ${manifest.line_count} lines, expected £${manifest.expected_total_gbp[0]}–£${manifest.expected_total_gbp[1]}`);
  out.push('');
  out.push('## Trolley, as read back off the page');
  out.push('');
  if (basket) {
    out.push(`- **Order total:** ${basket.order_total == null ? 'not readable' : '£' + basket.order_total}`);
    out.push(`- **Item count:** ${basket.item_count == null ? 'not readable' : basket.item_count}`);
    out.push(`- **Distinct products:** ${basket.product_count == null ? 'not readable' : basket.product_count}`);
  } else {
    out.push('- The trolley was NOT read back in this run. Nothing below is verified against the live page.');
  }
  out.push('');
  out.push('## Substitutions control');
  out.push('');
  if (substitutions) {
    out.push(`- ${substitutions.note}`);
    out.push('- **This executor never clicks that control, in either direction.** `guards.cjs` refuses it, and that was not weakened.');
    if (substitutions.surrounding_text) {
      out.push('');
      out.push('```');
      out.push(String(substitutions.surrounding_text).slice(0, 500));
      out.push('```');
    }
  } else {
    out.push('- Not read in this run.');
  }
  out.push('');
  out.push('## Outcome by line');
  out.push('');
  out.push(`Added ${count('added')} · wrong quantity ${count('added_wrong_qty')} · out of stock ${count('out_of_stock')} · ambiguous ${count('ambiguous')} · failed ${count('failed')} · not attempted ${count('not_attempted')}`);
  out.push('');
  out.push('| # | Product (manifest) | Qty | Status | ASDA ref | In trolley | Discrepancy |');
  out.push('|---|---|---|---|---|---|---|');
  for (const r of rows) {
    out.push(`| ${r.n} | ${esc(r.product)} | ${r.qty_wanted} | ${r.status} | ${r.product_ref || '—'} | ${r.in_trolley ? 'yes' : 'no'} | ${esc(r.discrepancy || '—')} |`);
  }
  out.push('');

  const ambiguous = rows.filter((r) => r.status === 'ambiguous');
  if (ambiguous.length) {
    out.push('## Ambiguous lines, with the candidates that were actually on screen');
    out.push('');
    out.push('Nothing was guessed. Each of these needs a human decision.');
    out.push('');
    for (const r of ambiguous) {
      out.push(`### Line ${r.n} — ${r.product} (qty ${r.qty_wanted})`);
      out.push('');
      out.push(`Reason: ${esc(r.reason)}`);
      out.push('');
      if (r.candidates && r.candidates.length) {
        for (const c of r.candidates) out.push(`- \`${c.product_ref}\` — ${esc(c.name)}`);
      } else {
        out.push('- No candidates were returned by the live search.');
      }
      out.push('');
    }
  }

  if (unexpected.length) {
    out.push('## In the trolley, but not accounted for by any manifest line');
    out.push('');
    for (const u of unexpected) out.push(`- \`${u.product_ref}\` — ${esc(u.name)}`);
    out.push('');
  }

  out.push('## What this report is not');
  out.push('');
  out.push('Builder self-test evidence — NOT independent review. Checkout was not entered; no payment, slot or substitution action was taken or is reachable from this executor.');
  out.push('');

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n'));
  return { rows, unexpected };
}

/**
 * The harvested references, as an operations file a human applies.
 *
 * TWO LISTS, and the difference matters. `operations` is directly consumable by
 * outcome/update-regulars.js. But `upsertRegular` ADOPTS an existing row by
 * normalised name and changes nothing about it - which is exactly right for
 * safety and exactly wrong for filling in a missing asda_product_id on a row
 * that already exists. Enriching that row needs `enrichRegular` with the row's
 * own id, and the row ids live in a database this executor does not read.
 *
 * So the enrichment candidates are listed separately, keyed by name, for
 * whoever holds the credentials to map to row ids. Pretending a bare upsert
 * would fill those gaps is the false-completion this note exists to prevent.
 */
function writeHarvest(file, { manifest, harvest }) {
  const operations = harvest.map((h) => ({
    op: 'upsertRegular',
    regular: {
      household_id: manifest.household_id || 1,
      name: h.manifest_product,
      asda_product_id: String(h.asda_product_id),
      asda_url: `https://www.asda.com/groceries/product/${h.asda_product_id}`,
      typical_qty: h.qty,
      substitutes_allowed: false,
      source: 'regular',
      active: true,
    },
  }));

  const payload = {
    generated_by: 'WO-2026-08-17-B15-BASKET services/asdair/basket-executor',
    generated_at: new Date().toISOString(),
    shop_ref: manifest.shop_ref,
    APPLY_WITH: 'node --env-file=<env> services/asdair/outcome/update-regulars.js --file <this file>',
    NOT_APPLIED_BY_THE_EXECUTOR: 'This process makes no live-data write. These operations are for a human to run.',
    operations,
    enrichment_needed: harvest.map((h) => ({
      manifest_line: h.line,
      name: h.manifest_product,
      harvested_asda_product_id: String(h.asda_product_id),
      name_on_site: h.name_on_site,
      search_term_used: h.search_term,
      note: 'If a regulars row already exists for this name, upsertRegular will ADOPT it and leave asda_product_id unset. Converting this to an enrichRegular needs that row id.',
    })),
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return payload;
}

module.exports = { reconcile, writeReconciliation, writeHarvest, trolleyRef };
