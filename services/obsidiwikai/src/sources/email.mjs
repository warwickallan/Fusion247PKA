// Email SOURCE ADAPTER — a generic inbound-mail door into Unified Capture.
// Contract (deliberately narrow): retrieve → durably capture body/metadata/attachments →
// dedupe → receipt → hand capture_id to Cairn. It contains NO Honcho/routing logic —
// Cairn owns routing. Graph, the durable store, and the router are INJECTED, so the whole
// adapter is unit-testable with fakes and runs unchanged against the live mailbox.

function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function toCapture(full, dedupeKey, mailbox) {
  const body = full.body || {};
  const isHtml = (body.contentType || '').toLowerCase() === 'html';
  const bodyText = isHtml ? htmlToText(body.content) : (body.content || full.bodyPreview || '');
  return {
    capture_id: 'email:' + dedupeKey,
    dedupe_key: dedupeKey,
    source_type: 'email',
    source_id: dedupeKey,
    mailbox,
    graph_message_id: full.id || null,
    internet_message_id: full.internetMessageId || null,
    from_address: full.from?.emailAddress?.address || null,
    from_name: full.from?.emailAddress?.name || null,
    to_addresses: (full.toRecipients || []).map((r) => r.emailAddress?.address).filter(Boolean),
    subject: full.subject || '',
    text: bodyText,
    body_html: isHtml ? body.content : null,
    received_at: full.receivedDateTime || null,
    has_attachments: !!full.hasAttachments,
  };
}

export function createEmailSource({ graph, store, route, log = () => {} }) {
  const mailbox = graph.mailbox || 'me';

  // BASELINE: walk the initial delta to its end WITHOUT capturing, and persist the final
  // deltaLink. Pre-existing Microsoft welcome/security mail is passed over, never ingested.
  async function establishBaseline() {
    const existing = await store.getCursor(mailbox);
    if (existing && existing.delta_link) { log('baseline: cursor already established — skipping'); return { baseline: 'already', deltaLink: existing.delta_link }; }
    let link = null, pages = 0, seen = 0, deltaLink = null;
    do {
      const page = await graph.deltaPage(link);
      seen += (page.messages || []).length;
      pages++;
      link = page.nextLink;
      deltaLink = page.deltaLink || deltaLink;
    } while (link);
    if (!deltaLink) throw new Error('baseline: Graph returned no deltaLink');
    await store.saveCursor(mailbox, deltaLink, { baseline: true });
    log(`baseline: cursor set past ${seen} pre-existing message(s) over ${pages} page(s) — none ingested`);
    return { baseline: true, skipped: seen, pages, deltaLink };
  }

  // One incremental read. Only mail arriving AFTER the baseline enters capture.
  async function pollOnce() {
    const cursor = await store.getCursor(mailbox);
    if (!cursor || !cursor.delta_link) throw new Error('poll: no cursor — run establishBaseline first');
    let link = cursor.delta_link, captured = 0, skipped = 0, routed = 0, deltaLink = null;
    do {
      const page = await graph.deltaPage(link);
      for (const m of page.messages || []) {
        if (m['@removed']) { skipped++; continue; } // deletions/moves are not captures
        const res = await ingestMessage(m);
        if (res === 'dup') skipped++;
        else { captured++; if (res === 'routed') routed++; }
      }
      link = page.nextLink;
      deltaLink = page.deltaLink || deltaLink;
    } while (link);
    // Advance the cursor ONLY after every message on these pages is durably captured — so a
    // crash mid-poll re-reads rather than skips. Dedupe makes the re-read a no-op.
    if (deltaLink) await store.saveCursor(mailbox, deltaLink, {});
    await store.touchPolled?.(mailbox);
    log(`poll: captured ${captured}, routed ${routed}, skipped ${skipped}`);
    return { captured, routed, skipped, deltaLink };
  }

  async function ingestMessage(meta) {
    const dedupeKey = meta.internetMessageId || meta.id;
    if (await store.hasCapture(dedupeKey)) return 'dup';
    const full = await graph.getMessage(meta.id);
    const capture = toCapture(full, dedupeKey, mailbox);
    let atts = [];
    if (full.hasAttachments) {
      try { atts = await graph.listAttachments(meta.id); }
      catch (e) { log('attachment fetch failed (metadata kept): ' + e.message); }
    }
    // DURABLE FIRST — the capture (and attachments) are persisted before any routing attempt.
    await store.saveCapture(capture, atts);
    // Then hand capture_id to Cairn. A routing failure does NOT lose the mail: it stays
    // durably captured (routed=false) and is re-driven by routeUnrouted().
    try {
      const r = await route(capture);
      await store.markRouted(capture.capture_id, r?.receipt || '');
      return 'routed';
    } catch (e) {
      await store.markError(capture.capture_id, String(e.message).slice(0, 300));
      log(`route failed for ${capture.capture_id} (captured, will retry): ${e.message}`);
      return 'captured';
    }
  }

  // Reconcile — route anything durably captured but not yet routed (failure recovery).
  async function routeUnrouted() {
    const rows = await store.unrouted();
    let ok = 0;
    for (const capture of rows) {
      try { const r = await route(capture); await store.markRouted(capture.capture_id, r?.receipt || ''); ok++; }
      catch (e) { await store.markError(capture.capture_id, String(e.message).slice(0, 300)); }
    }
    return { retried: rows.length, routed: ok };
  }

  return { establishBaseline, pollOnce, routeUnrouted, ingestMessage };
}

export { toCapture, htmlToText };
