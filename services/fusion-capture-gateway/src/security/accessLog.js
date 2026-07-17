// F-05 — structured access logging for privileged operations.
//
// Source of truth: wp0-security-gate.md §4 "Access logging": privileged
// operations (capture write, raw-object read, config change) are logged
// who/what/when — WITHOUT logging secret values or full sensitive payloads.
//
// Records are SECRET-FREE by construction:
//   1. The typed emitters only accept who/what/when/outcome fields — there is no
//      parameter through which payload text or a token can enter a record.
//   2. Every record additionally passes through `redact()` before it reaches the
//      sink, so even an accidental extra field carrying a secret-shaped value is
//      masked. The default sink applies a second, string-level redaction pass.
//
// Deterministic: `when` (epoch ms) is injected by the caller — no wall-clock.

// Field NAMES that must never carry a value into a log record. If any of these
// keys appear, the value is dropped/masked regardless of its content.
const SENSITIVE_KEY = /(^|_)(token|secret|password|passwd|api[_-]?key|authorization|auth|service[_-]?role|payload|text|body|content|message|raw)($|_)/i;

// VALUE shapes that look like a live secret — masked even under a benign key.
const SECRET_VALUE_PATTERNS = [
  /[0-9]{6,}:AA[A-Za-z0-9_-]{30,}/,             // Telegram bot token
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, // JWT (Supabase keys)
  /(sk|pk)_live_[A-Za-z0-9]{10,}/,               // Stripe live key
  /AKIA[0-9A-Z]{16}/,                            // AWS access key id
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,          // PEM private key
];

const REDACTED = '[REDACTED]';

function looksSecret(value) {
  if (typeof value !== 'string') return false;
  return SECRET_VALUE_PATTERNS.some((re) => re.test(value));
}

/**
 * Deep-redact a record: drop sensitive-named keys, mask secret-shaped values.
 * Pure — returns a new object, never mutates the input.
 */
export function redact(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return looksSecret(value) ? REDACTED : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = REDACTED;
      continue;
    }
    out[k] = redact(v);
  }
  return out;
}

// String-level backstop for the default sink: mask any secret-shaped substring
// that survived (belt-and-suspenders on the serialised JSON).
function redactString(s) {
  let out = s;
  for (const re of SECRET_VALUE_PATTERNS) {
    out = out.replace(new RegExp(re.source, 'g'), REDACTED);
  }
  return out;
}

/**
 * Default sink: JSON-stringify to stderr, with a final string-level redaction
 * pass. Structured, one line per record, no secrets.
 */
export function defaultStderrSink(record) {
  // eslint-disable-next-line no-console
  console.error(redactString(JSON.stringify(record)));
}

/**
 * Create the access logger.
 *
 * @param {object} [opts]
 * @param {(record:object)=>void} [opts.sink]  where records go (default: stderr).
 * @param {string} [opts.service]              service tag on every record.
 */
export function createAccessLogger({ sink, service = 'fusion-capture-gateway' } = {}) {
  const emit = typeof sink === 'function' ? sink : defaultStderrSink;

  // Every record is redacted centrally BEFORE the sink sees it, so a custom sink
  // can never receive a secret either.
  function write(record) {
    emit(redact({ service, ...record }));
  }

  function requireWhen(when, op) {
    if (typeof when !== 'number' || !Number.isFinite(when)) {
      throw new Error(`accessLog.${op}: injected numeric \`when\` (epoch ms) required`);
    }
    return when;
  }

  return {
    /**
     * A privileged CAPTURE WRITE (the governed Markdown write path).
     * @param {{ principal:string, captureId:string, when:number, outcome?:string, destinationRef?:object }} a
     */
    captureWrite({ principal, captureId, when, outcome = 'success', destinationRef } = {}) {
      requireWhen(when, 'captureWrite');
      write({
        event: 'capture_write',
        principal,
        capture_id: captureId,
        outcome,
        // A destination pointer path is operational metadata (not payload) — but
        // it still passes through redact(); a path never matches a secret shape.
        destination: destinationRef && destinationRef.path ? { kind: destinationRef.kind ?? null } : undefined,
        at_ms: when,
      });
    },

    /**
     * A privileged RAW-OBJECT READ (reading a stored raw source object).
     * @param {{ principal:string, captureId:string, when:number, outcome?:string, objectKey?:string }} a
     */
    rawObjectRead({ principal, captureId, when, outcome = 'success', objectKey } = {}) {
      requireWhen(when, 'rawObjectRead');
      write({
        event: 'raw_object_read',
        principal,
        capture_id: captureId,
        outcome,
        object_key: objectKey,
        at_ms: when,
      });
    },

    /**
     * An AUTH REJECTION (default-deny). Who/when/outcome only — never the content
     * the rejected sender tried to send.
     * @param {{ principal:(string|null), channel:string, when:number, reason:string }} a
     */
    authRejection({ principal, channel, when, reason } = {}) {
      requireWhen(when, 'authRejection');
      write({
        event: 'auth_rejection',
        principal: principal ?? null,
        channel,
        outcome: 'denied',
        reason,
        at_ms: when,
      });
    },
  };
}
