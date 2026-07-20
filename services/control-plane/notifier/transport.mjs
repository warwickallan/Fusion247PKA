// BUILD-014 PR-3b — the NOTIFICATION TRANSPORT seam (injectable dependency).
//
// The notifier sender does NOT know how a notification is physically delivered. It claims a
// due outbox row, hands a SANITISED payload to a `transport`, and drives the delivery state
// machine from the transport's answer. The transport is injected exactly the way the review
// handler injects its `reviewers` array (reviewHandler.mjs): the runtime chooses the concrete
// transport, the sender is agnostic.
//
// THE CONTRACT a transport must satisfy:
//   transport.send(payload) -> Promise<{ ok: true } | { ok: false, errorCode?: string }>
//     · resolve { ok: true }                     -> delivered; row -> sent (terminal).
//     · resolve { ok: false, errorCode }         -> a HANDLED delivery failure; row -> failed,
//                                                    then retry-with-backoff or dead_letter.
//     · THROW                                    -> an UNEXPECTED failure; treated exactly like
//                                                    { ok: false } (sanitised, then failed/retry).
//   payload = { id, notificationClass, destination, headline, message, cockpitUrl, githubUrl }
//     — POINTERS + sanitised text only (mirrors what the outbox stores). NEVER a secret: the
//     transport resolves the LOGICAL `destination` (e.g. 'warwick_primary') to real credentials
//     ITSELF, outside any reviewer process. `destination` is never a chat-id.
//
// TWO transports live here:
//   · createFakeTransport(...)     — DEV + tests. Records every call; returns canned success/
//                                    failure. NO network, NO credentials, NO real Telegram.
//   · createTelegramTransport(...) — the REAL transport is a LATER, GATED LIVE step. It is a
//                                    documented STUB here that REFUSES to run in DEV. Wiring the
//                                    actual bot token + HTTPS call is deliberately NOT done in
//                                    this PR (campaign boundary: NO real Telegram sends in DEV).

/**
 * A recording FAKE transport for DEV + tests.
 *
 * @param {object} opts
 * @param {(payload) => ({ ok: boolean, errorCode?: string })} [opts.decide]
 *        Per-call decision. Default: always { ok: true }. Return { ok: false, errorCode }
 *        to simulate a handled delivery failure; THROW inside to simulate an unexpected one.
 * Records every send in `.calls` (a frozen snapshot of each payload) so a test can assert
 * exactly-once dispatch, deep-link presence, and no-duplicate-after-restart.
 */
export function createFakeTransport(opts = {}) {
  const decide = opts.decide ?? (() => ({ ok: true }));
  const calls = [];
  return {
    kind: 'fake',
    calls,
    /** Count of sends recorded for a given outbox row id (exactly-once assertions). */
    countFor(id) {
      return calls.filter((c) => c.id === String(id)).length;
    },
    async send(payload) {
      // Snapshot the payload we were asked to deliver (frozen so a later mutation cannot
      // rewrite history a test relies on). id is stringified for stable comparison.
      const snapshot = Object.freeze({ ...payload, id: String(payload.id) });
      calls.push(snapshot);
      const result = decide(snapshot);   // may throw — the sender treats that as a failure
      return result ?? { ok: true };
    },
  };
}

/**
 * The REAL Telegram transport — DELIBERATELY NOT WIRED IN THIS PR.
 *
 * This factory marks EXACTLY where the live delivery path gates in later, and REFUSES to
 * construct a usable transport in DEV so no real send can ever happen from this campaign:
 *   · The bot token + chat-id would be read here from a NOTIFIER-ONLY secret store (env /
 *     OS keychain), resolved from the LOGICAL `destination`, and held OUTSIDE any reviewer
 *     process — never in the outbox, never in a committed file, never echoed to a log.
 *   · send() would POST to https://api.telegram.org/bot<token>/sendMessage with the headline/
 *     message + the cockpit_url / github_url deep links, mapping a 2xx to { ok: true }, a
 *     4xx/5xx or network error to { ok: false, errorCode } (so the state machine retries/
 *     dead-letters exactly as with the fake).
 *
 * Turning this on is a SEPARATE, EXPLICITLY GATED live step (a real bot token, a live chat-id,
 * Warwick's go-ahead) — NOT part of PR-3b. Until then, constructing it fails closed.
 */
export function createTelegramTransport() {
  throw new Error(
    'createTelegramTransport: the real Telegram transport is NOT wired in DEV (BUILD-014 PR-3b ' +
    'boundary: no real Telegram sends). Injecting the live transport — resolving the logical ' +
    'destination to a bot token + chat-id from a notifier-only secret store and POSTing to the ' +
    'Telegram API — is a separate, gated LIVE step, never DEV. Use createFakeTransport() here.');
}
