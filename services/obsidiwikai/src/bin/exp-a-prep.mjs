// Experiment A prep — from one raw transcript slice, produce: (B) a faithful mechanical clean,
// (C) a summary control, and a hand-checkable fact-set for recall scoring. LLM via the gateway.
import { readFileSync, writeFileSync } from 'node:fs';
import { reason } from '../core/models.mjs';

const src = process.argv[2];
const outDir = process.argv[3];
const raw = readFileSync(src, 'utf8');

const DEFLUFF = `You are MECHANICALLY cleaning a YouTube auto-transcript. This is NOT summarisation.
Remove ONLY: rolling-caption duplication; meaningless filler (um, uh, "you know") that carries no meaning;
obvious sponsor reads; like/subscribe/comment/bell boilerplate; repeated intro/outro; transcription formatting garbage.
DO NOT paraphrase, reword, condense, or drop ANY anecdote, tangent, example, number, name, claim, caveat or detail —
even if it seems off-topic (tangents may matter). Preserve all semantic content, in order, close to verbatim.
Return ONLY the cleaned transcript text, nothing else.

TRANSCRIPT:
${raw}`;

const SUMMARY = `Summarise the following transcript into a concise analyst report of its key points and knowledge
(a few hundred words). This is the CONTROL condition.

TRANSCRIPT:
${raw}`;

const FACTS = `From the transcript below, extract EXACTLY 25 specific, checkable facts a knowledge system should capture.
Include a spread: named people; named tools/products; specific claims; numbers/stats; caveats/limitations;
methods/steps; relationships between things; TWO deliberately obscure details; and ONE adjacent/tangential-but-useful idea.
Each fact = one short, self-contained sentence. Return ONLY a JSON array of exactly 25 strings.

TRANSCRIPT:
${raw}`;

console.log(`raw: ${raw.length} chars`);
const clean = await reason(DEFLUFF);
writeFileSync(`${outDir}/exp-clean.txt`, clean.trim());
console.log(`clean: ${clean.trim().length} chars (${Math.round(clean.trim().length / raw.length * 100)}% of raw)`);

const summary = await reason(SUMMARY);
writeFileSync(`${outDir}/exp-summary.txt`, summary.trim());
console.log(`summary: ${summary.trim().length} chars (${Math.round(summary.trim().length / raw.length * 100)}% of raw)`);

const factsRaw = await reason(FACTS);
writeFileSync(`${outDir}/exp-facts.json`, factsRaw.trim());
let n = 0; try { n = JSON.parse(factsRaw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()).length; } catch { /* */ }
console.log(`facts: ${n} extracted → exp-facts.json`);
process.exit(0);
