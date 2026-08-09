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
  const brand = l.brand == null ? '(no brand)' : l.brand;

  // WHERE TO GET IT. Three cases now, and the third is the one Warwick's
  // Product Ruling 2 created: a KNOWN household product with no ASDA reference
  // on file. It must never render as "ref null", and it is not a search-for-
  // anything line either - it carries the identity to verify against.
  let where;
  if (l.origin === 'new_approved') {
    where = `SEARCH: "${l.approved_search_term}"`;
  } else if (l.retrieval) {
    where = 'RETRIEVE: known item, no ASDA ref on file - find it, then CHECK it is the right one';
  } else {
    where = `${l.source_view.toUpperCase()} ref ${l.asda_product_ref}`;
  }

  const head = `- [ ] ${pad(l.seq, seqWidth)}. ${brand} - ${l.canonical_product_name}  ${qty}`;
  const detail = `      ${where}`;
  const wrote = `      list said: "${l.original_list_line}"`;
  const why = l.quantity_rationale ? `      why: ${l.quantity_rationale}` : null;
  const fav = l.origin === 'new_approved' ? '      NEW: add, then click ASDA Favourite, then capture its product ref + URL.' : null;

  // The identity to verify against, printed ON the line rather than only in the
  // contract higher up the page: someone holding two candidate products should
  // not have to scroll to remember what they are checking against.
  let verify = null;
  if (l.retrieval) {
    const va = l.retrieval.verify_against;
    const ident = [va.brand, va.canonical_product_name].filter((v) => v != null && v !== '').join(' ');
    verify = `      must match: ${ident} - if two or more could be it, STOP this line and ask. Do not pick one.`;
  }

  return [head, detail, verify, wrote, why, fav].filter(Boolean).join('\n');
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

  // THE FULL METHOD. This block is why this file exists: before 2026-08-09 it
  // printed `handoff.method` and nothing else, and `handoff.method` carried
  // three of the proven behaviours. Everything the worker is expected to know
  // must be ON this page - it is the only thing the worker is given.
  out.push('## Method');
  out.push('');
  handoff.method.forEach((step, i) => out.push(`${i + 1}. ${step.text}`));
  out.push('');

  if (handoff.environment_constraints && handoff.environment_constraints.length > 0) {
    out.push('## Things about ASDA you cannot change');
    out.push('');
    for (const c of handoff.environment_constraints) out.push(`- ${c.text}`);
    out.push('');
  }

  // Rendered only when at least one line actually needs it. A rule with no line
  // it applies to is noise on a phone, and this page is read while shopping.
  const needsRetrieval = handoff.lines.filter((l) => l.retrieval).length;
  if (needsRetrieval > 0) {
    out.push(`## Items with no ASDA reference (${needsRetrieval})`);
    out.push('');
    out.push('These ARE known household products. We just do not have an ASDA product reference on file for them, which is normal and is not a problem to solve at the shelf.');
    out.push('');
    for (const c of handoff.retrieval_contract) out.push(`- ${c.text}`);
    out.push('');
  }

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
