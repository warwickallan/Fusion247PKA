// Cairn router — source-adapter based. Each lane has an adapter that hands the capture to its
// downstream processor. Lanes without a built downstream are stubs that prove the routing CONTRACT
// (adding email/article/audio/document later = add an adapter, no Cairn rewrite).
import { LANE, INTENT } from './contracts.mjs';

const adapters = {
  [LANE.ENCYCLOPEDIA]: async (capture, d) => {
    if (d.treatment === INTENT.KEEP) {
      return { lane: LANE.ENCYCLOPEDIA, did: 'retained source only (keep)', handoff: 'raw preserved + linked, no extraction' };
    }
    // learn → the knowledge pipeline (the existing working flow); Cairn records the routing + treatment.
    return {
      lane: LANE.ENCYCLOPEDIA, did: 'routed to knowledge pipeline (learn)',
      handoff: 'TubeAIR → LightRAG(clean) → Honcho lens → canonicaliser → searchable encyclopedia',
      source_id: capture.source_id || capture.url || null,
    };
  },
  [LANE.PERSONAL]: async () => ({ lane: LANE.PERSONAL, did: 'routed to personal/Obsidian lane', handoff: 'Obsidian journal/backlink pipeline (lane stub — not built this increment)' }),
  [LANE.TASK]: async () => ({ lane: LANE.TASK, did: 'routed to task lane', handoff: 'task lane (stub — not built this increment)' }),
  [LANE.WORK]: async () => ({ lane: LANE.WORK, did: 'held for walled work lane', handoff: 'work/Bellrock lane — deferred by design (WP7)' }),
  [LANE.UNKNOWN]: async () => ({ lane: LANE.UNKNOWN, did: 'no route — asking Warwick', handoff: null }),
};

export function laneAdapter(lane) { return adapters[lane] || adapters[LANE.UNKNOWN]; }
export function knownLanes() { return Object.keys(adapters); }
