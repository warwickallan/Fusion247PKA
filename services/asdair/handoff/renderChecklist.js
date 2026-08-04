// =====================================================================
// BUILD-015 AsdAIr - handoff/renderChecklist.js
//
// THE HUMAN HALF OF THE SAME ARTEFACT.
//
// The Work Order requires the handoff to be readable by a human on a phone AND
// parseable, because Sonnet consumes it as instructions. Those are not two
// artefacts - they are two renderings of ONE artefact. buildHandoff() produces
// the object (which IS the machine-readable form once JSON-serialised) and this
// file renders that same object as Markdown.
//
// It renders ONLY from the artefact. It reads no packet, consults no rule and
// invents no wording, so the two views cannot drift: if a line is absent from
// the checklist it is absent from the artefact, and a test asserts every line
// and every prohibition appears.
//
// PURE. No clock, no I/O, no dependencies. Same artefact in, same string out.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

function pad(n, width) {
  const s = String(n);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function lineRow(l, seqWidth) {
  const qty = `x${l.required_quantity}`;
  const where = l.origin === 'new_approved'
    ? `SEARCH: "${l.approved_search_term}"`
    : `${l.source_view.toUpperCase()} ref ${l.asda_product_ref}`;
  const brand = l.brand == null ? '(no brand)' : l.brand;
  const head = `- [ ] ${pad(l.seq, seqWidth)}. ${brand} - ${l.canonical_product_name}  ${qty}`;
  const detail = `      ${where}`;
  const wrote = `      list said: "${l.original_list_line}"`;
  const why = l.quantity_rationale ? `      why: ${l.quantity_rationale}` : null;
  const fav = l.origin === 'new_approved' ? '      NEW: add, then click ASDA Favourite, then capture its product ref + URL.' : null;
  return [head, detail, wrote, why, fav].filter(Boolean).join('\n');
}

/**
 * Render the artefact as a phone-readable Markdown checklist.
 *
 * @param {object} handoff - the object returned by buildHandoff()
 * @returns {string} Markdown
 */
function renderChecklist(handoff) {
  if (!handoff || typeof handoff !== 'object') throw new TypeError('renderChecklist: handoff must be the object returned by buildHandoff()');

  const seqWidth = String(handoff.lines.length).length;
  const out = [];

  out.push(`# ASDA basket - ${handoff.shop_ref}`);
  out.push('');
  out.push(`**${handoff.expected.distinct_products} products, ${handoff.expected.total_units} units.** Order: Brand A-Z (already sorted - do not re-sort).`);
  out.push(`Packet: \`${handoff.packet_fingerprint}\` - quote this exactly when you report back.`);
  out.push('');

  out.push('## Do NOT');
  out.push('');
  for (const p of handoff.prohibited_actions) out.push(`- **${p.text}**`);
  out.push('');

  out.push('## Method');
  out.push('');
  handoff.method.forEach((step, i) => out.push(`${i + 1}. ${step}`));
  out.push('');

  // Household operating guidance. Rendered under its own heading with the rule
  // id shown, so it is never mistaken for the fixed method and its source is
  // always traceable back to asdair.rules.
  if (handoff.operating_guidance && handoff.operating_guidance.length > 0) {
    out.push('## Household rules for this shop');
    out.push('');
    for (const g of handoff.operating_guidance) out.push(`- ${g.text}  _(rule ${g.rule_id})_`);
    out.push('');
  }

  // A producer defect, not a decision for the shelf. Surfaced loudly here so it
  // is seen, and phrased so nobody tries to resolve it while shopping.
  if (handoff.duplicate_identities && handoff.duplicate_identities.length > 0) {
    out.push('## STOP - this packet has a defect');
    out.push('');
    out.push('The same product appears on more than one line. The household rulebook says one product, one line, so this should have been merged before the packet was built. **Do not decide at the shelf whether to add it once or twice - report it.**');
    out.push('');
    for (const d of handoff.duplicate_identities) {
      out.push(`- ${d.canonical_product_name} appears at lines ${d.seqs.join(' and ')}`
        + (d.quantities_differ ? ` with DIFFERENT quantities (${d.quantities.join(' and ')}) - this one needs an answer from Warwick, not a guess` : ''));
    }
    out.push('');
  }

  out.push(`## The list (${handoff.counts.known} known, ${handoff.counts.new_approved} new)`);
  out.push('');
  for (const l of handoff.lines) out.push(lineRow(l, seqWidth));
  out.push('');

  if (handoff.held.length > 0) {
    out.push(`## Held back - NOT in the basket (${handoff.held.length})`);
    out.push('');
    out.push('Listed so nothing is silently dropped. Do not add these.');
    out.push('');
    for (const h of handoff.held) {
      out.push(`- "${h.original_list_line}" - ${h.reason}${h.detail ? ` (${h.detail})` : ''}`);
    }
    out.push('');
  }

  out.push('## When you are done, report');
  out.push('');
  for (const c of handoff.completion_contract) out.push(`- ${c}`);
  out.push('');

  out.push('## How it will be checked');
  out.push('');
  for (const r of handoff.reconciliation_contract) out.push(`- ${r}`);
  out.push('');

  out.push(`_handoff v${handoff.handoff_version} - instructions v${handoff.instructions_version} - packet generated ${handoff.generated_at}_`);

  return out.join('\n');
}

module.exports = { renderChecklist };
