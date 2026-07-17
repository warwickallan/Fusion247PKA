// BUILD-002 WP1 — Deno shell for the fcg webhook intake edge function.
//
// THIN BY CONTRACT (wp1-architecture-decision.md, Silas's factoring): every
// decision lives in the PURE handler (./handler.js — unit-tested under Node);
// this file only wires the runtime: env, the PostgREST rpc client, the
// Telegram Bot API client, and Deno.serve.
//
// AUTH MODEL (Pax Q1.6): deployed with verify_jwt = false (see
// supabase/config.toml) — Telegram cannot present a Supabase JWT. The
// compensating control is the constant-time X-Telegram-Bot-Api-Secret-Token
// check INSIDE the handler. The RPCs themselves are EXECUTE service_role only
// (migration 0006), called here with the auto-injected service credential —
// no raw Postgres password ever enters this environment (Pax Q3c).
//
// SECRETS (set via `supabase secrets set`, never in this repo):
//   TELEGRAM_WEBHOOK_SECRET — the setWebhook secret_token (bot B / cutover bot).
//   TELEGRAM_BOT_TOKEN      — bot B's token. NEVER the live bot's while the
//                             live bot is on long polling (hard WP1 boundary).
// AUTO-INJECTED (Supabase runtime): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (legacy) and/or SUPABASE_SECRET_KEYS (JSON dictionary — parsed defensively;
// verify the exact shape at deploy time, flagged single-source in Pax Q4).
//
// SECRET HYGIENE: the bot token appears only inside the Telegram API URL;
// every thrown/logged Telegram error is masked before it can propagate.

import { handleTelegramWebhook } from './handler.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function env(name: string): string | undefined {
  // deno-lint-ignore no-explicit-any
  const d = (globalThis as any).Deno;
  return d && d.env && typeof d.env.get === 'function' ? d.env.get(name) : undefined;
}

/** Resolve the service credential from the auto-injected env (Pax Q4). */
function serviceCredential(): string {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy && legacy.length > 0) return legacy;
  const dict = env('SUPABASE_SECRET_KEYS');
  if (dict && dict.length > 0) {
    try {
      const parsed = JSON.parse(dict);
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.length > 0) return value;
        if (value && typeof value === 'object') {
          // deno-lint-ignore no-explicit-any
          const v = value as any;
          if (typeof v.api_key === 'string') return v.api_key;
          if (typeof v.key === 'string') return v.key;
        }
      }
    } catch {
      /* fall through to the hard failure below */
    }
  }
  throw new Error('no service credential in env (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEYS)');
}

const SUPABASE_URL = env('SUPABASE_URL') ?? '';
const WEBHOOK_SECRET = env('TELEGRAM_WEBHOOK_SECRET') ?? '';
const BOT_TOKEN = env('TELEGRAM_BOT_TOKEN') ?? '';

const maskBotToken = (s: string): string => {
  if (!BOT_TOKEN) return s;
  const colon = BOT_TOKEN.indexOf(':');
  const masked = colon > 0 ? `${BOT_TOKEN.slice(0, colon)}:***masked***` : '***masked***';
  return s.split(BOT_TOKEN).join(masked);
};

/** PostgREST rpc bridge — service credential, one named function per call. */
async function rpc(fnName: string, args: Record<string, unknown>): Promise<unknown> {
  const credential = serviceCredential();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // sb_secret_ keys must equal the apikey header when sent as Bearer
      // (Pax Q4); legacy service_role JWTs accept the same dual-header shape.
      apikey: credential,
      authorization: `Bearer ${credential}`,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    // Body may carry PostgREST error detail — safe (no secrets), keep terse.
    const detail = await res.text().catch(() => '');
    throw new Error(`rpc ${fnName} failed: http_${res.status} ${detail.slice(0, 200)}`);
  }
  return res.json();
}

/** Minimal Telegram Bot API client. Token masked in every failure. */
function telegramClient() {
  async function call(method: string, payload: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // deno-lint-ignore no-explicit-any
    const parsed: any = await res.json().catch(() => null);
    if (!parsed || parsed.ok !== true) {
      const desc = parsed && parsed.description ? parsed.description : `http_${res.status}`;
      throw new Error(`telegram ${method} rejected: ${maskBotToken(String(desc))}`);
    }
    return parsed;
  }
  return {
    sendMessage: (p: Record<string, unknown>) => call('sendMessage', p),
    editMessageText: (p: Record<string, unknown>) => call('editMessageText', p),
    answerCallbackQuery: (p: Record<string, unknown>) => call('answerCallbackQuery', p),
  };
}

const telegram = telegramClient();

function log(event: Record<string, unknown>): void {
  // Structured, secret-free (the handler never passes secrets; belt-and-braces
  // masking for any error text that transited the Telegram client).
  const line = JSON.stringify({ service: 'fcg-webhook-intake', ...event });
  console.log(maskBotToken(line));
}

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(async (req: Request) => {
  const result = await handleTelegramWebhook(
    {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      bodyText: await req.text(),
    },
    { rpc, telegram, secret: WEBHOOK_SECRET, log },
  );
  return new Response(JSON.stringify(result.body ?? {}), {
    status: result.status,
    headers: { 'content-type': 'application/json' },
  });
});
