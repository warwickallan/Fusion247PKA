// BUILD-002 WP6 — email intake (fixture-first).
//
// Email was specified fixture-first so a mailbox CREDENTIAL can never block the Build. This turns a
// received email into a hub capture envelope that PRESERVES every field that matters for provenance
// (message id, from, all recipients, subject, body, attachment metadata), then routes it through the
// SAME router as every other channel (a YouTube link in an email takes the youtube route). An email
// with no actionable content routes to needs_clarification rather than guessing. Pure — no network.
import { routeFor } from '../router/classifyRoute.mjs';

// email: { message_id, from, to:[], cc:[], subject, body, attachments:[{filename,mime,size,ref}] }
export function emailIntake(email) {
  if (!email || typeof email !== 'object') throw new Error('emailIntake: email object required');
  if (typeof email.message_id !== 'string' || !email.message_id) throw new Error('emailIntake: message_id required (provenance + idempotency)');
  const to = Array.isArray(email.to) ? email.to : (email.to ? [email.to] : []);
  const cc = Array.isArray(email.cc) ? email.cc : (email.cc ? [email.cc] : []);
  const attachments = Array.isArray(email.attachments)
    ? email.attachments.map((a) => ({ filename: a.filename ?? null, mime: a.mime ?? null, size: a.size ?? null, ref: a.ref ?? null }))
    : [];
  const subject = typeof email.subject === 'string' ? email.subject : '';
  const body = typeof email.body === 'string' ? email.body : '';

  const envelope = {
    source_channel: 'email',
    message_id: email.message_id,
    from: email.from ?? null,
    to, cc,
    subject,
    body,
    attachments,
    // Provenance metadata preserved as source_ref; idempotency keyed on the RFC message id.
    original_source_ref: { channel: 'email', message_id: email.message_id, from: email.from ?? null, recipient_count: to.length + cc.length, attachment_count: attachments.length },
    idempotency_key: `email:${email.message_id}`,
    payload_text: [subject, body].filter(Boolean).join('\n'),
  };

  // Route on subject + body. No actionable content → clarification, never a guess.
  const hasContent = Boolean(subject.trim() || body.trim() || attachments.length);
  if (!hasContent) return { envelope, route: 'needs_clarification', reason: 'empty email (no subject, body, or attachment)' };
  const { route, youtube } = routeFor(envelope);
  return { envelope, route, youtube };
}
