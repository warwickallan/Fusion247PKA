// =====================================================================
// BUILD-015 AsdAIr - packet/renderChecklist.js   (WO-P / WO-2026-08-04-Z3)
//
// The HUMAN-READABLE rendering of the SAME packet, in the SAME order.
// Warwick reads this on a phone, so it is plain ASCII text: no tables, no
// wide columns, short lines, one product per numbered checkbox, and the
// most decision-relevant fact (how many, and where to find it) before the
// prose.
//
// It RENDERS; it never re-derives. Order, seq, counts and identity all
// come from the packet exactly as buildExecutionPacket produced them, so
// the checklist and the JSON can never disagree. If the checklist looks
// wrong, the packet is wrong.
//
// -------------------------------------------------------------------
// PACKET-LEVEL GUIDANCE (Larry, 2026-08-04)
// -------------------------------------------------------------------
// There is NO schema-valid home for a guidance note inside the JSON packet:
// the contract's root is `additionalProperties: false` and declares no such
// property. So guidance is carried HERE, as an optional argument, and the
// handoff layer must carry it alongside the JSON if it needs to reach
// Sonnet that way too. Reported rather than worked around.
//
// Guidance TEXT is not hardcoded in this file on purpose. Rule 38 ("a
// failed add means OUT OF STOCK, not an expired slot") lives in
// asdair.rules; copying its wording into source is how a rulebook and its
// renderer drift apart, and this build already carries an open defect
// about rules being invisible (D-2026-08-04-04). The caller passes the
// rule rows it actually loaded, and the rule id is printed beside each
// note so a rule that fires is visible and attributable.
//
// The standing BOUNDARIES are different and ARE fixed here: they are
// product invariants from RUNTIME-DECISION.md and
// CANONICAL-WEEKLY-SHOP-PROCESS.md section F, not rulebook rows, and they
// must appear on every checklist whatever the caller passes.
//
// PURE ASCII. No I/O, no clock.
// =====================================================================

export class ChecklistError extends Error {
  constructor(message) {
    super('renderChecklist: ' + message);
    this.name = 'ChecklistError';
  }
}

const RULE = '-----------------------------------------------------------';
const HEAVY = '===========================================================';

// Product invariants, not rulebook rows. Sources: RUNTIME-DECISION.md
// ("Boundaries - unchanged"), CANONICAL-WEEKLY-SHOP-PROCESS.md section F.
// SUPERSEDED 2026-08-09 by Warwick's Product Ruling 2: the first boundary used
// to read "NEVER free-search a known item - add it from Regulars or
// Favourites." That is no longer the rule. Identity and RETRIEVAL are separate
// concerns: a known item is added by its reference when we hold one, and may be
// searched for when we do not - what must never happen is a silent swap.
export const STANDING_BOUNDARIES = Object.freeze([
  'Add a known item by its ASDA reference when this list gives one. Only search for it when it has none.',
  'NEVER substitute. An unavailable item is HELD for a human, not swapped.',
  'If two or more products could be the one on the list, STOP that line and ask. Never pick the closest.',
  'NEVER book a slot, check out, pay, or enter a password.',
  'STOP at a checkout-ready basket.'
]);

function padStart(value, width) {
  const s = String(value);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

// Target width. Caller-supplied prose (a quantity rationale, a guidance
// note, a held detail, a long product name) is WRAPPED rather than allowed
// to run off the side of a phone screen. Wrapping instead of truncating:
// nothing may be lost from the page Warwick reads.
export const WRAP_WIDTH = 72;

function wrapInto(out, firstPrefix, restPrefix, text) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    out.push(firstPrefix.replace(/\s+$/, ''));
    return;
  }
  let current = firstPrefix + words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = current + ' ' + words[i];
    if (candidate.length > WRAP_WIDTH) {
      out.push(current);
      current = restPrefix + words[i];
    } else {
      current = candidate;
    }
  }
  out.push(current);
}

// A guidance note may be a bare string, or { text, rule_id? } so a rule
// that fired is attributable on the page Warwick actually reads.
function normalizeGuidance(raw, i) {
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (text === '') throw new ChecklistError('guidance[' + i + '] is an empty string');
    return { text, rule_id: null };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (text === '') throw new ChecklistError('guidance[' + i + '].text must be a non-empty string');
    let ruleId = null;
    if (raw.rule_id !== null && raw.rule_id !== undefined) {
      if (typeof raw.rule_id !== 'number' || !Number.isInteger(raw.rule_id) || raw.rule_id < 1) {
        throw new ChecklistError('guidance[' + i + '].rule_id must be a positive integer when given');
      }
      ruleId = raw.rule_id;
    }
    return { text, rule_id: ruleId };
  }
  throw new ChecklistError('guidance[' + i + '] must be a string or { text, rule_id? }');
}

/**
 * Render a packet as a phone-scannable ASCII checklist, in the packet's
 * own Brand A-Z order.
 *
 * @param {object} packet   the output of buildExecutionPacket
 * @param {object} [options]
 * @param {Array<string|{text:string, rule_id?:number}>} [options.guidance]
 *        packet-level notes for the basket-building agent, e.g. rule 38.
 * @returns {string}
 * @throws {ChecklistError}
 */
export function renderChecklist(packet, options) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    throw new ChecklistError('packet must be an object (the buildExecutionPacket result)');
  }
  if (!Array.isArray(packet.lines) || packet.lines.length === 0) {
    throw new ChecklistError('packet.lines must be a non-empty array');
  }

  const opts = options || {};
  if (opts.guidance !== null && opts.guidance !== undefined && !Array.isArray(opts.guidance)) {
    throw new ChecklistError('options.guidance must be an array when given');
  }
  const guidance = (opts.guidance || []).map(normalizeGuidance);

  const held = Array.isArray(packet.held) ? packet.held : [];
  const out = [];

  // ---- header --------------------------------------------------------
  out.push(HEAVY);
  out.push(' ASDA SHOP -- ' + String(packet.shop_ref));
  out.push(HEAVY);
  out.push(' Generated : ' + String(packet.generated_at));
  out.push(' Order     : brand A-Z, then product A-Z  [' + String(packet.sort_contract) + ']');
  out.push(' Expect    : ' + packet.expected_distinct_products + ' distinct product(s), ' +
           packet.expected_total_units + ' unit(s)');
  out.push('');
  out.push(' BEFORE YOU START');
  out.push('   1. Open ASDA Regulars / Favourites.');
  out.push('   2. Set the ASDA ordering to Brand A-Z.');
  out.push('   3. Work this list top to bottom. The order IS the speed.');
  out.push('');
  out.push(' BOUNDARIES');
  STANDING_BOUNDARIES.forEach((b) => wrapInto(out, '   * ', '     ', b));

  if (guidance.length > 0) {
    out.push('');
    out.push(' GUIDANCE');
    guidance.forEach((note) => {
      wrapInto(out, '   * ', '     ', note.text + (note.rule_id === null ? '' : '  [rule ' + note.rule_id + ']'));
    });
  }

  // ---- basket --------------------------------------------------------
  out.push('');
  out.push(RULE);
  out.push(' BASKET -- ' + packet.lines.length + ' line(s)');
  out.push(RULE);

  const width = String(packet.lines.length).length;
  const indent = ' '.repeat(width + 8);

  packet.lines.forEach((line) => {
    const brand = (line.brand === null || line.brand === undefined) ? '(no brand)' : line.brand;
    out.push('');
    wrapInto(
      out,
      ' ' + padStart(line.seq, width) + '. [ ] x' + line.required_quantity + '  ',
      indent,
      brand + ' -- ' + line.canonical_product_name
    );

    if (line.origin === 'known' && (line.asda_product_ref === null || line.asda_product_ref === undefined)) {
      // Ruling 2. A known household product we hold no ASDA reference for.
      // It must never render as "ref null", and it is NOT a new item: no
      // approval is needed and none should be sought.
      out.push(indent + 'KNOWN - no ASDA ref on file. Find it, then CHECK it is this:');
      wrapInto(out, indent + '  > ', indent + '  > ',
        ((line.brand === null || line.brand === undefined) ? '' : line.brand + ' ') + line.canonical_product_name);
      out.push(indent + 'if two or more could be it, STOP and ask. Never pick the closest.');
    } else if (line.origin === 'known') {
      out.push(indent + line.source_view.toUpperCase() + '  ref ' + line.asda_product_ref);
    } else {
      // The approved wording is Warwick's, and it must be searched EXACTLY.
      // It gets its own "> " lines rather than being wrapped inside quotes,
      // so a term long enough to wrap can never be misread as two terms or
      // transcribed with a stray line break in the middle of it.
      out.push(indent + '** NEW - APPROVED ** search these exact words:');
      wrapInto(out, indent + '  > ', indent + '  > ', line.approved_search_term);
      out.push(indent + 'then FAVOURITE it and capture its real ASDA product id.');
    }

    wrapInto(out, indent, indent, 'list: "' + line.original_list_line + '"');

    if (line.quantity_rationale) {
      wrapInto(out, indent + 'why: ', indent + '     ', line.quantity_rationale);
    }
    if (Array.isArray(line.applied_rules) && line.applied_rules.length > 0) {
      wrapInto(out, indent + 'rules: ', indent + '       ', line.applied_rules.join(', '));
    }
    if (line.substitutes_allowed === true) {
      wrapInto(out, indent + 'subs: ', indent + '      ', 'substitute permitted - a HUMAN decision only, never yours.');
    }
  });

  // ---- held ----------------------------------------------------------
  out.push('');
  out.push(RULE);
  out.push(' HELD -- NOT IN THE BASKET -- ' + held.length + ' line(s)');
  out.push(RULE);
  if (held.length === 0) {
    out.push('');
    out.push('   (none - every line on the list is in the basket above)');
  } else {
    out.push('');
    out.push('   These are NOT dropped. They are waiting on a human.');
    held.forEach((entry) => {
      out.push('');
      wrapInto(out, '   - ', '     ', '"' + entry.original_list_line + '"');
      let detail = entry.reason;
      if (entry.detail) detail += ' -- ' + entry.detail;
      if (entry.rule_id !== null && entry.rule_id !== undefined) detail += '  [rule ' + entry.rule_id + ']';
      wrapInto(out, '       ', '       ', detail);
    });
  }

  // ---- footer --------------------------------------------------------
  out.push('');
  out.push(RULE);
  out.push(' END -- expect ' + packet.expected_distinct_products + ' distinct product(s) and ' +
           packet.expected_total_units + ' unit(s) in the trolley.');
  out.push(' Stop at a checkout-ready basket. Do not check out.');
  out.push(RULE);
  out.push('');

  return out.join('\n');
}

export default renderChecklist;
