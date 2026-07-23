// LLM helper — structured (JSON) reasoning via the `reason` role (provider-neutral; see models.mjs).
import { reason } from './models.mjs';

export function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  // strip ``` or ```json fences
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.search(/[[{]/);
  if (start < 0) return null;
  t = t.slice(start);
  try { return JSON.parse(t); } catch { /* try trimming trailing junk */ }
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (end > 0) { try { return JSON.parse(t.slice(0, end + 1)); } catch { /* noop */ } }
  return null;
}

export async function generateJSON(prompt, { retries = 2 } = {}) {
  let last = '';
  for (let i = 0; i <= retries; i++) {
    const suffix = i > 0 ? '\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.' : '';
    const raw = await reason(prompt + suffix);
    const parsed = extractJson(raw);
    if (parsed !== null) return parsed;
    last = raw;
  }
  throw new Error('llm: could not parse JSON from response: ' + String(last).slice(0, 200));
}

export async function generateText(prompt) { return reason(prompt); }
