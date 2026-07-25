// Neo4j client — the curated encyclopedia (canonical graph layer).
// Uses the HTTP transaction API (parameterised) so no bolt driver dependency is required.
import { endpoints, secrets } from '../config.mjs';

const auth = 'Basic ' + Buffer.from(`${secrets.neo4jUser}:${secrets.neo4jPass}`).toString('base64');

// statements: array of `"CYPHER"` or `{ statement, parameters }`
export async function cypher(statements) {
  const body = {
    statements: statements.map((s) => (typeof s === 'string' ? { statement: s } : s)),
  };
  const res = await fetch(`${endpoints.neo4jHttp}/db/neo4j/tx/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error('neo4j: ' + JSON.stringify(json.errors));
  }
  return json.results;
}

// Run one statement, return array of row arrays.
export async function run(statement, parameters = {}) {
  const results = await cypher([{ statement, parameters }]);
  return results[0].data.map((d) => d.row);
}

// Run one statement, return array of row objects keyed by the RETURN columns.
export async function rows(statement, parameters = {}) {
  const results = await cypher([{ statement, parameters }]);
  const cols = results[0].columns;
  return results[0].data.map((d) => Object.fromEntries(cols.map((c, i) => [c, d.row[i]])));
}
