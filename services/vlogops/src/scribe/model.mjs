// BUILD-006 Phase 3 — THE MODEL SEAM. One seam, and it refuses rather than substitutes.
//
// ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────────────────────
// Scribe needs a language model. Everything else in Phase 3 — the contract, the schema, the
// derivation, the citation constraints, the projection — is deterministic and testable without
// one. So the model call is confined to exactly this file, behind one function, and the rest of
// the phase depends on an INTERFACE rather than on a provider.
//
// ── THE PATTERN, AND WHERE IT COMES FROM ────────────────────────────────────────────────────
// `services/obsidiwikai/src/core/models.mjs` is the estate's precedent: roles resolved to
// models, and a refusal rather than a silent substitution when no gateway is configured. That
// file's `answer()` and `vision()` both throw with no fallback, and its header records why —
// a fallback would hand a different model a decision it was never chosen for, with nothing on
// the record saying which model actually answered.
//
// THE PATTERN IS COPIED. THE MODULE IS NOT IMPORTED. Reaching across a service boundary to
// obsidiwikai was flagged as a trap by the BUILD-006 census, and vlogops has held a strict
// no-cross-service-import rule since Phase 1. Its own variables, its own seam, its own failure.
//
// ── THE THREE RULES THIS FILE ENFORCES ──────────────────────────────────────────────────────
//
//   1. NO FALLBACK. EVER. Unconfigured means refused, loudly, by name. There is no "degrade to
//      something cheaper", no "use the box", no default provider. A Master Story Package drafted
//      by a model nobody chose is worse than no package: it looks exactly like the real thing.
//
//   2. NO DEFAULT MODEL NAME. `models.mjs` records a live 400 caused by defaulting `vision` to
//      an alias the gateway did not register, and Warwick's ruling on it: "A default model name
//      that the gateway does not provide must never survive preflight again." So a configured
//      gateway with no model named is ALSO a refusal. This file will not guess what is on the
//      other end of a URL.
//
//   3. THE BINDING IS RECORDED, NOT REMEMBERED. Every client describes itself, and that
//      description is stored on the package row. A reader six months from now can tell a
//      stub-drafted package from a gateway-drafted one by looking at the row, not by knowing
//      which run was which.
//
// ── WHAT A GREEN TEST OVER THIS SEAM PROVES, AND WHAT IT DOES NOT ───────────────────────────
// Stubbing this seam proves the contract, the schema, the derivation, the citation enforcement
// and the plumbing. IT PROVES NOTHING WHATSOEVER ABOUT WHETHER SCRIBE WRITES IN WARWICK'S
// VOICE. That is a creative judgement, it is Warwick's alone, and it happens at Phase 5.

/** The gateway base URL. Absent means Scribe has no model, and Scribe says so. */
export const ENV_GATEWAY_URL = 'VLOGOPS_MODEL_GATEWAY_URL';
/** Optional bearer credential. This file never reads, logs, echoes or stores its value. */
export const ENV_GATEWAY_KEY = 'VLOGOPS_MODEL_GATEWAY_KEY';
/** REQUIRED when a gateway is configured. Deliberately has no default — see rule 2 above. */
export const ENV_MODEL = 'VLOGOPS_SCRIBE_MODEL';

function present(env, name) {
  const v = env[name];
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Is a model reachable at all? A cheap, honest boolean for status output and the runbook.
 *
 * It says a gateway URL and a model name are BOTH configured. It does NOT promise the gateway is
 * up, or that it registers that model — "capable" is only ever proven at call time, and this
 * function must never be read as though it were.
 */
export function modelConfigured(env = process.env) {
  return present(env, ENV_GATEWAY_URL) && present(env, ENV_MODEL);
}

/** The refusal, in one place, so every path refuses with the same words and the same code. */
function refuse(problems) {
  const err = new Error(
    `vlogops scribe: no language model is configured, so there is nothing to draft with.\n`
    + problems.map((p) => `  - ${p}`).join('\n')
    + '\n  Scribe REFUSES to substitute a different model, a cached draft or a stub for a real\n'
    + '  one. A Master Story Package must be attributable to the model that wrote it.\n'
    + '  To draft without a gateway, ask for the deterministic stub EXPLICITLY (--model stub);\n'
    + '  the package will record that it was stubbed, permanently, in its own row.',
  );
  err.code = 'EVLOGOPSNOMODEL';
  err.problems = problems;
  return err;
}

/**
 * The real client: the Fusion gateway, OpenAI-compatible chat completions.
 *
 * Constructing it is inert — no socket, no validation, no I/O. The refusal happens at CALL time,
 * deliberately: `bin/vlogops-intake.mjs` and `bin/vlogops-compile.mjs` must keep working on a
 * machine that has never had a model configured, and making this a startup requirement would
 * break Phases 1 and 2 to serve Phase 3.
 */
export function gatewayModelClient(env = process.env) {
  return {
    /** Recorded on the package. Never includes a credential, configured or not. */
    describe() {
      return {
        provider: 'fusion-gateway',
        model: present(env, ENV_MODEL) ? env[ENV_MODEL] : null,
        configured: modelConfigured(env),
        deterministic: false,
      };
    },

    async draft(prompt) {
      const problems = [];
      if (!present(env, ENV_GATEWAY_URL)) {
        problems.push(`${ENV_GATEWAY_URL} is unset — there is no gateway to call`);
      }
      if (!present(env, ENV_MODEL)) {
        problems.push(
          `${ENV_MODEL} is unset — this seam has NO default model name, on purpose. A default `
          + 'the gateway does not register fails live with a 400, which has already happened '
          + 'once in this estate.',
        );
      }
      if (problems.length > 0) throw refuse(problems);

      const base = env[ENV_GATEWAY_URL].replace(/\/$/, '');
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Read straight from the environment into the header. Never assigned to a named
          // local, never logged, never returned, never stored on the package.
          ...(present(env, ENV_GATEWAY_KEY) ? { Authorization: `Bearer ${env[ENV_GATEWAY_KEY]}` } : {}),
        },
        body: JSON.stringify({
          model: env[ENV_MODEL],
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        // The gateway's own error is surfaced, never papered over. A 400 naming an unregistered
        // model is the single most useful thing this seam can tell an operator.
        const err = new Error(`vlogops scribe: gateway responded ${res.status}: ${body.slice(0, 300)}`);
        err.code = 'EVLOGOPSMODELHTTP';
        err.status = res.status;
        throw err;
      }

      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim() === '') {
        const err = new Error('vlogops scribe: the gateway returned no content to draft from');
        err.code = 'EVLOGOPSMODELEMPTY';
        throw err;
      }
      return text;
    },
  };
}

/**
 * Resolve a client by name. `gateway` is the default BECAUSE it refuses when unconfigured —
 * a default that quietly stubbed would make every acceptance run a lie about what produced it.
 */
export function resolveModelClient(name, env = process.env, stubFactory = null) {
  if (name === 'stub') {
    if (typeof stubFactory !== 'function') {
      const err = new Error('vlogops scribe: the stub client was requested but none was supplied');
      err.code = 'EVLOGOPSNOSTUB';
      throw err;
    }
    return stubFactory();
  }
  if (name === 'gateway' || name === undefined || name === null) {
    return gatewayModelClient(env);
  }
  const err = new Error(`vlogops scribe: unknown model client '${name}' (expected 'gateway' or 'stub')`);
  err.code = 'EVLOGOPSBADMODEL';
  throw err;
}
