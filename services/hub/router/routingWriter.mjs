// BUILD-002 WP2 — routing governed writer for the gateway spine.
//
// Drops into the worker's `markdownWriter` slot and dispatches by route: a YouTube capture goes to the
// injected youtubeProcessor (extract → RAW → youtube_source), everything else delegates UNCHANGED to
// the plain governed markdownWriter. The worker's durable state machine, idempotency, evidence-gated
// completion and failed-projection safety all apply identically — the routing is invisible to the spine.
//
// FEATURE-FLAGGED: the live gateway only builds this writer when routing is enabled; until then it keeps
// the plain markdownWriter, so enabling the spine YouTube route is a deliberate, Warwick-present switch
// (and the separate auto-detect poller keeps working in the meantime — no double-processing).
import { routeFor } from './classifyRoute.mjs';

export function createRoutingWriter({ markdownWriter, youtubeProcessor } = {}) {
  if (!markdownWriter || typeof markdownWriter.write !== 'function') throw new Error('createRoutingWriter: markdownWriter required');
  if (!youtubeProcessor || typeof youtubeProcessor.process !== 'function') throw new Error('createRoutingWriter: youtubeProcessor required');

  return {
    // Same contract as markdownWriter.write, but async (YouTube extraction is async). The worker awaits
    // it (WP2 async-unified change); awaiting the sync markdown delegate is a no-op.
    async write(record, { now } = {}) {
      const { route } = routeFor(record);
      if (route === 'youtube') return youtubeProcessor.process(record, { now });
      return markdownWriter.write(record, { now });
    },

    // Erasure delegates to the markdown writer for note destinations; a youtube_source destination is
    // erased through its own governed path (RAW immutability + DB), not this sandbox remover.
    remove(destinationRef, opts) {
      if (destinationRef && destinationRef.kind === 'youtube_source') {
        return { removed: false, path: null, note: 'youtube_source erasure is governed separately (RAW is immutable)' };
      }
      return markdownWriter.remove(destinationRef, opts);
    },

    inboxDir: markdownWriter.inboxDir,
  };
}
