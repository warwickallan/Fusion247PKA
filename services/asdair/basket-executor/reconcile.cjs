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

const { score, queriesForLine } = require('./favourites.cjs');

function esc(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' '); }

/**
 * Which manifest lines are represented in the trolley the page actually shows?
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

/**
 * Line states. Derived from THE TROLLEY, and the vocabulary says so: every one
 * of them is a statement about the page rather than about this process's
 * intentions.
 */
const LINE_STATE = Object.freeze({
  CORRECT: 'in_trolley_correct',
  WRONG_QTY: 'in_trolley_wrong_qty',
  QTY_UNKNOWN: 'in_trolley_qty_not_established',
  UNAVAILABLE: 'not_in_trolley_unavailable',
  ABSTAINED: 'not_in_trolley_abstained',
  FAILED: 'not_in_trolley_failed',
  MISSING: 'not_in_trolley_unexplained',
});

/**
 * =====================================================================
 * WO-2026-08-18-B15-RUNTIME - GAP 8. RECONCILE FROM THE TROLLEY, NOT FROM
 * THIS PROCESS'S OPINION OF WHAT IT DID.
 * =====================================================================
 *
 * THE DEFECT THIS REPLACES, and it is worth stating exactly because the old
 * function looked correct:
 *
 * `present` was decided from THIS INVOCATION'S `outcomes`. A line added by an
 * EARLIER invocation has no outcome, so it was reported "not attempted" while
 * sitting in the basket - and, if it had been resolved by search, it then also
 * appeared under "in the trolley but not accounted for". One product, two
 * contradictory rows, neither of them true. The committed artefact of
 * 2026-08-17 reads `Added 2 - not attempted 35` beside a trolley of 35
 * products, which is that bug printed.
 *
 * Meanwhile `shortfall` counted plan-versus-progress, a third number from a
 * fourth source. Three counters, three answers, and the phase was closed on a
 * figure ("56 items, GBP 135.02") that appears in none of the artefacts.
 *
 * SO: ONE COUNT, DERIVED FROM THE PAGE. The outcome record is corroboration
 * and an explanation of WHY something is absent - it is never the evidence that
 * something is present. Rule 34 has required exactly this since 2026-07-21:
 * "confirm every item is present, the correct product, and the correct
 * QUANTITY ... Agents repeatedly get QUANTITIES wrong."
 *
 * MATCHED BY REFERENCE FIRST, THEN BY CANONICAL DESCRIPTION. Reference alone
 * cannot see a line whose id was never stored - and under Warwick's ruling the
 * ASDA description IS the identity, so a name match is not a weaker fallback,
 * it is the primary key the household actually uses. The name comparison is the
 * strict one from favourites.cjs, which requires the identity tokens AND any
 * size the line names: "Heinz Baked Beans 6x415g" and "Heinz Baked Beans &
 * Richmond Pork Sausages 200g" do not satisfy each other, which is the
 * confusion the manifest's own note on line 16 warns about.
 */
function reconcile({ manifest, outcomes, basket, catalogue = null }) {
  const products = ((basket && basket.products) || []).map((p, i) => ({
    idx: i,
    ref: trolleyRef(p),
    name: p && p.name ? String(p.name) : '',
    qty: p && p.qty != null ? Number(p.qty) : null,
    qty_source: (p && p.qty_source) || (p && p.qty != null ? 'unstated' : 'not-established'),
  }));

  const byLine = new Map((outcomes || []).map((o) => [Number(o.line), o]));
  const consumed = new Set();
  const rows = [];

  for (const line of manifest.lines) {
    const o = byLine.get(Number(line.n)) || null;
    const expectedQty = Number(line.qty);
    const ref = (o && o.product_ref) ? String(o.product_ref)
      : (line.asda_product_id ? String(line.asda_product_id) : null);

    // The best description we hold for this line: what the run actually
    // matched on the site if it got that far, else the household catalogue's
    // canonical ASDA description, else the manifest wording.
    const { row } = queriesForLine(line.product, catalogue);
    const expectedName = (o && o.name) || (row && row.name) || line.product;

    // -- find it on the page ------------------------------------------------
    let hit = ref ? products.find((p) => p.ref === ref && !consumed.has(p.idx)) : null;
    let matchedBy = hit ? 'reference' : null;

    if (!hit) {
      const strong = products
        .filter((p) => !consumed.has(p.idx))
        .map((p) => ({ p, s: score(expectedName, p.name) }))
        .filter((x) => x.s.strong)
        .sort((a, b) => b.s.ratio - a.s.ratio);
      // One clear winner only. Two products that both satisfy the description
      // is a reconciliation the executor must REPORT, never resolve by picking.
      if (strong.length === 1 || (strong.length > 1 && strong[0].s.ratio > strong[1].s.ratio)) {
        hit = strong[0].p;
        matchedBy = 'canonical-description';
      }
    }

    if (hit) consumed.add(hit.idx);

    // -- state, from the page ----------------------------------------------
    let state;
    let discrepancy = null;
    if (hit) {
      if (hit.qty == null || hit.qty_source === 'not-established') {
        state = LINE_STATE.QTY_UNKNOWN;
        discrepancy = `in the trolley, but its quantity could NOT be read off the page - wanted ${expectedQty}. This is an unverified line, not a passing one.`;
      } else if (Number(hit.qty) !== expectedQty) {
        state = LINE_STATE.WRONG_QTY;
        discrepancy = `in the trolley with quantity ${hit.qty}, wanted ${expectedQty}`;
      } else {
        state = LINE_STATE.CORRECT;
      }
    } else if (o && o.status === 'out_of_stock') {
      state = LINE_STATE.UNAVAILABLE;
      discrepancy = `NOT in the trolley - ASDA cannot supply it (${o.reason}). Reported, never substituted.`;
    } else if (o && o.status === 'ambiguous') {
      state = LINE_STATE.ABSTAINED;
      discrepancy = `NOT in the trolley - the line was stopped for a decision (${o.reason})`;
    } else if (o && o.status === 'failed') {
      state = LINE_STATE.FAILED;
      discrepancy = `NOT in the trolley - the add failed (${o.reason})`;
    } else if (o && (o.status === 'added' || o.status === 'added_wrong_qty')) {
      state = LINE_STATE.MISSING;
      discrepancy = 'reported as added by this run, but NOT found in the trolley read-back';
    } else {
      state = LINE_STATE.MISSING;
      discrepancy = 'NOT in the trolley, and nothing in this run explains why';
    }

    rows.push({
      n: line.n,
      product: line.product,
      expected_identity: expectedName,
      qty_wanted: expectedQty,
      state,
      status: o ? o.status : 'not_attempted',
      product_ref: hit ? hit.ref : ref,
      name_on_site: hit ? hit.name : (o ? o.name : null),
      matched_by: matchedBy,
      via: o ? o.via : null,
      in_trolley: !!hit,
      qty_actual: hit ? hit.qty : null,
      qty_source: hit ? hit.qty_source : null,
      discrepancy,
      candidates: o && o.candidates ? o.candidates : null,
      reason: o ? (o.reason || o.why || null) : null,
    });
  }

  const unexpected = products
    .filter((p) => !consumed.has(p.idx))
    .map((p) => ({ product_ref: p.ref, name: p.name, qty: p.qty, qty_source: p.qty_source }));

  const count = (s) => rows.filter((r) => r.state === s).length;
  const summary = {
    manifest_lines: rows.length,
    trolley_products: products.length,
    correct: count(LINE_STATE.CORRECT),
    wrong_quantity: count(LINE_STATE.WRONG_QTY),
    quantity_not_established: count(LINE_STATE.QTY_UNKNOWN),
    unavailable: count(LINE_STATE.UNAVAILABLE),
    abstained: count(LINE_STATE.ABSTAINED),
    failed: count(LINE_STATE.FAILED),
    missing_unexplained: count(LINE_STATE.MISSING),
    unexpected_products: unexpected.length,
  };

  return { rows, unexpected, summary, ready: basketReady({ rows, unexpected, summary, basket }) };
}

/**
 * =====================================================================
 * MAY "MUM'S BASKET IS READY" BE SAID?
 * =====================================================================
 *
 * Warwick: "'Mum's basket is ready' may not be issued until that
 * reconciliation is truthful. A total and item count are insufficient."
 *
 * So this gate is about TRUTHFULNESS, not about perfection. A basket with two
 * genuinely unavailable products is a fine, honest, ready basket - the
 * household simply cannot have those two things this week, and rule 38 says
 * record, drop, report. What is NOT ready is a basket the executor cannot
 * DESCRIBE: a line it cannot find and cannot explain, a quantity it could not
 * read, or a trolley it never actually looked at.
 *
 * Each blocker names the line, so this is a work list rather than a verdict.
 */
function basketReady({ rows, unexpected, summary, basket }) {
  const blockers = [];

  if (!basket || !Array.isArray(basket.products)) {
    blockers.push({ kind: 'trolley-not-read', detail: 'the trolley was never read back, so nothing below is verified against the live page' });
    return { ready: false, blockers };
  }

  for (const r of rows) {
    if (r.state === LINE_STATE.MISSING) {
      blockers.push({ kind: 'unexplained-absence', line: r.n, detail: `${r.product}: ${r.discrepancy}` });
    } else if (r.state === LINE_STATE.QTY_UNKNOWN) {
      blockers.push({ kind: 'quantity-not-established', line: r.n, detail: `${r.product}: in the trolley, quantity unreadable` });
    } else if (r.state === LINE_STATE.WRONG_QTY) {
      blockers.push({ kind: 'wrong-quantity', line: r.n, detail: `${r.product}: ${r.qty_actual} in the trolley, ${r.qty_wanted} wanted` });
    } else if (r.state === LINE_STATE.FAILED) {
      blockers.push({ kind: 'add-failed', line: r.n, detail: `${r.product}: ${r.reason || 'the add failed'}` });
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    // Stated so a reader is never left inferring it: these two are ACCOUNTED
    // FOR, not defects, and they do not stop the basket being ready.
    accounted_for: {
      unavailable: summary.unavailable,
      awaiting_a_decision: summary.abstained,
      unexpected_products_reported: unexpected.length,
    },
  };
}

function writeReconciliation(file, { manifest, outcomes, basket, substitutions, plan, payload, catalogue = null }) {
  const { rows, unexpected, summary, ready } = reconcile({ manifest, outcomes, basket, catalogue });

  const out = [];
  out.push(`# ASDA trolley reconciliation — ${manifest.shop_ref}`);
  out.push('');
  out.push(`- Work Order: **WO-2026-08-18-B15-RUNTIME**`);
  out.push(`- Run status: **${payload ? payload.status : 'unknown'}** · generated ${new Date().toISOString()}`);
  out.push(`- Frozen manifest: ${manifest.line_count} lines`);
  out.push('');

  // ── THE VERDICT FIRST, because it is the one thing that must not be
  // reconstructed by a reader adding up a table. Rule 34 is a GATE, not a
  // report section.
  out.push('## May "Mum\'s basket is ready" be said?');
  out.push('');
  if (ready.ready) {
    out.push('**YES.** Every manifest line has a determinate, page-derived state and every quantity in the trolley was read off the page.');
  } else {
    out.push(`**NO — ${ready.blockers.length} blocker(s).** This basket may NOT be announced as ready.`);
    out.push('');
    for (const b of ready.blockers) out.push(`- \`${b.kind}\`${b.line != null ? ` line ${b.line}` : ''} — ${esc(b.detail)}`);
  }
  if (ready.accounted_for) {
    out.push('');
    out.push(`Accounted for, and NOT blockers: ${ready.accounted_for.unavailable} unavailable · ${ready.accounted_for.awaiting_a_decision} awaiting a decision · ${ready.accounted_for.unexpected_products_reported} unexpected product(s) reported below.`);
  }
  out.push('');

  out.push('## Trolley, as read back off the page');
  out.push('');
  if (basket) {
    out.push(`- **Order total:** ${basket.order_total == null ? 'not readable' : '£' + basket.order_total}`);
    out.push(`- **Item count:** ${basket.item_count == null ? 'not readable' : basket.item_count}`);
    out.push(`- **Distinct products:** ${basket.product_count == null ? 'not readable' : basket.product_count}`);
    out.push(`- **Products enumerated by this read-back:** ${summary.trolley_products}`);
    if (basket.quantities_not_established) {
      out.push(`- ⚠️ **${basket.quantities_not_established} product(s) had NO readable quantity field.** Rule 34 cannot be satisfied for those lines and they are listed as blockers above.`);
    }
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
  out.push('## Outcome by line — DERIVED FROM THE TROLLEY');
  out.push('');
  out.push('Every state below is a statement about the page. The run\'s own record explains an ABSENCE; it is never the evidence that something is present.');
  out.push('');
  out.push(`Correct ${summary.correct} · wrong quantity ${summary.wrong_quantity} · quantity not established ${summary.quantity_not_established} · unavailable ${summary.unavailable} · awaiting a decision ${summary.abstained} · add failed ${summary.failed} · unexplained absence ${summary.missing_unexplained}`);
  out.push('');
  out.push(`**${summary.manifest_lines} manifest lines · ${summary.trolley_products} products enumerated in the trolley · ${summary.unexpected_products} unaccounted for.** These are the only counts in this report and they all come from one read of the page.`);
  out.push('');
  out.push('| # | Product (manifest) | Expected identity | Qty wanted | Qty actual | State | ASDA ref | Matched by | Discrepancy |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const qa = r.qty_actual == null ? '**not established**' : String(r.qty_actual);
    out.push(`| ${r.n} | ${esc(r.product)} | ${esc(r.expected_identity)} | ${r.qty_wanted} | ${qa} | ${r.state} | ${r.product_ref || '—'} | ${r.matched_by || '—'} | ${esc(r.discrepancy || '—')} |`);
  }
  out.push('');

  const ambiguous = rows.filter((r) => r.state === 'not_in_trolley_abstained');
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

  const unavailableRows = rows.filter((r) => r.state === 'not_in_trolley_unavailable');
  if (unavailableRows.length) {
    out.push('## Unavailable — recorded, dropped, reported. NOT a question for anybody.');
    out.push('');
    out.push('ASDA cannot supply these. Nothing was substituted and no decision is owed on them.');
    out.push('');
    for (const r of unavailableRows) out.push(`- Line ${r.n} — ${esc(r.product)} (${esc(r.reason)})`);
    out.push('');
  }

  out.push('## In the trolley, but not accounted for by any manifest line');
  out.push('');
  if (unexpected.length) {
    for (const u of unexpected) {
      out.push(`- \`${u.product_ref || 'no reference on the page'}\` — ${esc(u.name)} (quantity ${u.qty == null ? '**not established**' : u.qty})`);
    }
  } else {
    out.push('None. Every product enumerated in the trolley is claimed by a manifest line.');
  }
  out.push('');

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

module.exports = { reconcile, basketReady, writeReconciliation, writeHarvest, trolleyRef, LINE_STATE };
