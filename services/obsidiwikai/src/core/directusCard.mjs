// Build the Warwick-facing knowledge card (PRD §8). Plain-language first; the card row is what
// Directus renders. This is the visible payoff of a compile run.
import { q } from '../clients/db.mjs';

export async function buildCard({ runId, sourceId, source, candidates, actions, stats }) {
  const created = actions.filter((a) => a.action === 'created' || a.action === 'created+related');
  const aliased = actions.filter((a) => a.action === 'aliased');
  const held = actions.filter((a) => a.action === 'held_for_review');
  const related = actions.filter((a) => a.action === 'created+related');

  const relevant = candidates.filter((c) => c.relevance >= 0.5).sort((a, b) => b.relevance - a.relevance).slice(0, 8);
  const emerging = candidates.filter((c) => c.emerging).slice(0, 5);

  const what_arrived = { title: source.title, url: source.url, source_id: sourceId };
  const what_contains = { concept_count: candidates.length, top_concepts: candidates.slice(0, 12).map((c) => c.raw_name) };
  const why_it_matters = {
    relevant: relevant.map((c) => ({ name: c.raw_name, why: c.why, relevance: Number(c.relevance.toFixed(2)) })),
    emerging_interest_candidates: emerging.map((c) => c.raw_name),
  };
  const how_changed = {
    new_nodes: created.length,
    aliases_merged: aliased.length,
    relationships_added: related.length,
    held_for_your_review: held.length,
    encyclopedia_now: stats,
  };
  const what_follows = {
    review_questions: held.length,
    note: held.length ? 'Some concepts need a one-tap decision from you.' : 'No decisions needed.',
    suggestions: 'grounded self-improvement / monetisation suggestions arrive in WP5',
  };

  const r = await q(
    `insert into obsidiwikai.knowledge_card(run_id,source_id,what_arrived,what_contains,why_it_matters,how_changed,what_follows)
     values($1,$2,$3,$4,$5,$6,$7) returning card_id`,
    [runId, sourceId, JSON.stringify(what_arrived), JSON.stringify(what_contains),
     JSON.stringify(why_it_matters), JSON.stringify(how_changed), JSON.stringify(what_follows)]
  );
  return { cardId: r.rows[0].card_id, what_arrived, what_contains, why_it_matters, how_changed, what_follows };
}
