import { generateJSON } from './llm.mjs';

const key = (value) => String(value || '').trim().toLowerCase();
const pairKey = (value) => [key(value?.from), key(value?.to)].sort().join('::');

function exactList(values, allowed, limit = 40) {
  const byKey = new Map(allowed.map((value) => [key(value), value]));
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => byKey.get(key(value)))
    .filter(Boolean))].slice(0, limit);
}

export function validateLensDelta(raw, data) {
  const connected = data.connected || [];
  const all = [...new Set([...(data.new || []), ...connected])];
  const allowed = new Map(all.map((value) => [key(value), value]));
  const connectedKeys = new Set(connected.map(key));
  const relationships = [];
  const seen = new Set();
  for (const item of Array.isArray(raw?.relationships) ? raw.relationships : []) {
    const from = allowed.get(key(item?.from));
    const to = allowed.get(key(item?.to));
    const relationship = String(item?.relationship || '').trim().slice(0, 180);
    if (!from || !to || from === to || !relationship) continue;
    if (!connectedKeys.has(key(from)) && !connectedKeys.has(key(to))) continue;
    const pair = pairKey({ from, to });
    if (seen.has(pair)) continue;
    seen.add(pair);
    relationships.push({ from, to, relationship });
  }
  return {
    newly_visible: exactList(raw?.newly_visible, all),
    newly_visible_cross_source: exactList(raw?.newly_visible_cross_source, connected),
    relationships,
  };
}

function intersection(first, second, itemKey = key) {
  const inSecond = new Set(second.map(itemKey));
  return first.filter((item) => inSecond.has(itemKey(item)));
}

export async function compareLensDelta(data, beforeLens, afterLens, approvedAdditions, { runs = 2 } = {}) {
  const prompt = `Compare one retained source through a BEFORE and AFTER interest lens. Isolate only expansion caused by the APPROVED ADDITIONS. This is a conservative acceptance test, not a request to find something interesting.

SOURCE: ${data.title}
BEFORE LENS: ${JSON.stringify(beforeLens)}
AFTER LENS: ${JSON.stringify(afterLens)}
APPROVED ADDITIONS: ${JSON.stringify(approvedAdditions)}
SOURCE-ONLY CONCEPTS: ${JSON.stringify(data.new || [])}
KNOWN CROSS-SOURCE CONCEPTS: ${JSON.stringify(data.connected || [])}

Return a concept in newly_visible only when it was not materially relevant under BEFORE, is materially relevant under AFTER, and the reason is one of the APPROVED ADDITIONS. Copy every concept EXACTLY from the supplied lists. Return a relationship only when the approved addition makes that exact concept pair newly useful; at least one endpoint must be a KNOWN CROSS-SOURCE CONCEPT. Empty arrays are correct when the evidence does not prove expansion.

Return ONLY JSON:
{"newly_visible":["exact concept"],"newly_visible_cross_source":["exact known cross-source concept"],"relationships":[{"from":"exact concept","to":"exact concept","relationship":"why the approved addition makes this pair newly useful"}]}`;

  const observations = [];
  for (let i = 0; i < runs; i += 1) {
    observations.push(validateLensDelta(await generateJSON(prompt), data));
  }
  const [first, ...rest] = observations;
  const consensus = rest.reduce((acc, item) => ({
    newly_visible: intersection(acc.newly_visible, item.newly_visible),
    newly_visible_cross_source: intersection(acc.newly_visible_cross_source, item.newly_visible_cross_source),
    relationships: intersection(acc.relationships, item.relationships, pairKey),
  }), first || { newly_visible: [], newly_visible_cross_source: [], relationships: [] });
  return {
    ...consensus,
    runs,
    run_counts: observations.map((item) => ({
      newly_visible: item.newly_visible.length,
      newly_visible_cross_source: item.newly_visible_cross_source.length,
      relationships: item.relationships.length,
    })),
  };
}
