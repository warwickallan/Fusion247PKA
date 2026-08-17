// AC1(i) — the identifier-token control.
//
// The question this answers is "does the migration REFER to any namespace other than its
// own?", and the honest form of that question is about identifiers, not about text. A naive
// substring search over raw SQL cannot tell a reference from a mention: `'public'` is a
// perfectly ordinary privacy-state VALUE in a CHECK constraint, and a comment saying "this
// never touches asdair" is a promise rather than a breach. A control that fails on either
// of those is a control people learn to route around.
//
// So: strip what SQL says is not an identifier — line comments, block comments (nested, as
// Postgres allows), single-quoted string literals (with '' escapes) and dollar-quoted
// bodies — and scan what is left, on word boundaries.
//
// DOUBLE-QUOTED text is deliberately KEPT. "asdair"."regulars" is a real reference wearing
// quotes, and dropping it would put a hole straight through the middle of the control.

export function stripNonIdentifiers(sql) {
  let out = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const two = sql.slice(i, i + 2);

    // -- line comment
    if (two === '--') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl;
      continue;
    }

    // /* block comment */ — Postgres nests these
    if (two === '/*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql.slice(i, i + 2) === '/*') { depth += 1; i += 2; continue; }
        if (sql.slice(i, i + 2) === '*/') { depth -= 1; i += 2; continue; }
        i += 1;
      }
      continue;
    }

    // $tag$ dollar-quoted body $tag$
    if (sql[i] === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        i = end === -1 ? n : end + tag.length;
        continue;
      }
    }

    // 'string literal', with '' as an embedded quote
    if (sql[i] === "'") {
      i += 1;
      while (i < n) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; }
          i += 1;
          break;
        }
        i += 1;
      }
      // A literal contributes a separator, never its content.
      out += ' ';
      continue;
    }

    out += sql[i];
    i += 1;
  }

  return out;
}

/** The namespaces this migration must never refer to. */
export const FORBIDDEN_NAMESPACES = ['asdair', 'session_report', 'ops', 'tower', 'public'];

/**
 * Return every forbidden namespace actually REFERENCED (as an identifier) by this SQL.
 * An empty array is the pass condition.
 */
export function forbiddenIdentifierReferences(sql, forbidden = FORBIDDEN_NAMESPACES) {
  const identifiersOnly = stripNonIdentifiers(sql);
  const hits = [];
  for (const name of forbidden) {
    // \b on both sides: `vlogops` must not match `ops`, and `session_report_id` must not
    // match `session_report`. Case-insensitive because SQL identifiers are.
    const re = new RegExp(`\\b${name}\\b`, 'i');
    if (re.test(identifiersOnly)) hits.push(name);
  }
  return hits;
}
