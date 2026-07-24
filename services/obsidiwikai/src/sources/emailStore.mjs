// Durable store for the email source adapter (Supabase). Capture is written here BEFORE Cairn
// runs, so nothing is lost on a routing failure. Dedupe is enforced by a unique key.
import { q, tx } from '../clients/db.mjs';

const ATTACH_BYTE_CAP = Number(process.env.EMAIL_ATTACH_BYTE_CAP || 3_000_000); // store bytes up to ~3MB; larger = metadata only

export const emailStore = {
  async getCursor(mailbox) {
    return (await q('select * from obsidiwikai.graph_delta_state where mailbox=$1', [mailbox])).rows[0] || null;
  },

  async saveCursor(mailbox, deltaLink, { baseline = false } = {}) {
    await q(
      `insert into obsidiwikai.graph_delta_state(mailbox,delta_link,baseline_at,updated_at)
       values($1,$2, case when $3 then now() else null end, now())
       on conflict (mailbox) do update set
         delta_link=excluded.delta_link,
         baseline_at=coalesce(obsidiwikai.graph_delta_state.baseline_at, excluded.baseline_at),
         updated_at=now()`,
      [mailbox, deltaLink, baseline]
    );
  },

  async touchPolled(mailbox) {
    await q('update obsidiwikai.graph_delta_state set last_polled_at=now() where mailbox=$1', [mailbox]);
  },

  async hasCapture(dedupeKey) {
    return (await q('select 1 from obsidiwikai.inbound_email where dedupe_key=$1', [dedupeKey])).rowCount > 0;
  },

  async saveCapture(c, attachments = []) {
    await tx(async (client) => {
      await client.query(
        `insert into obsidiwikai.inbound_email
           (capture_id,dedupe_key,graph_message_id,internet_message_id,mailbox,from_address,from_name,
            to_addresses,subject,body_text,body_html,received_at,has_attachments,raw)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (dedupe_key) do nothing`,
        [c.capture_id, c.dedupe_key, c.graph_message_id, c.internet_message_id, c.mailbox,
         c.from_address, c.from_name, JSON.stringify(c.to_addresses || []), c.subject, c.text,
         c.body_html, c.received_at, c.has_attachments,
         JSON.stringify({ from_name: c.from_name, has_attachments: c.has_attachments, received_at: c.received_at })]
      );
      for (const a of attachments) {
        const b64 = a.contentBytes || null;
        const size = a.size || (b64 ? Math.floor(b64.length * 0.75) : 0);
        const overCap = size > ATTACH_BYTE_CAP || !b64;
        const bytes = overCap ? null : Buffer.from(b64, 'base64');
        await client.query(
          `insert into obsidiwikai.email_attachment
             (capture_id,graph_attachment_id,name,content_type,size_bytes,is_inline,content_id,content,truncated)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (capture_id,graph_attachment_id) do nothing`,
          [c.capture_id, a.id || null, a.name || null, a.contentType || null, size,
           !!a.isInline, a.contentId || null, bytes, overCap]
        );
      }
    });
  },

  async markRouted(captureId, receipt) {
    await q('update obsidiwikai.inbound_email set routed=true, cairn_receipt=$2, cairn_capture_ref=$1, routed_at=now(), error=null where capture_id=$1', [captureId, receipt]);
  },

  async markError(captureId, error) {
    await q('update obsidiwikai.inbound_email set error=$2 where capture_id=$1', [captureId, error]);
  },

  async unrouted() {
    const rows = (await q('select capture_id,dedupe_key,subject,body_text,from_address from obsidiwikai.inbound_email where routed=false order by captured_at limit 100')).rows;
    return rows.map((r) => ({
      capture_id: r.capture_id, source_type: 'email', source_id: r.dedupe_key,
      subject: r.subject || '', text: r.body_text || '', from_address: r.from_address || null,
    }));
  },
};
