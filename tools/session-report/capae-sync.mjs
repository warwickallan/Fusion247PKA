#!/usr/bin/env node
// CAPAE sync — the smallest reliable path from a rotation's findings to the durable CAPAE record.
//
// BUILD-020 Sub-phase 4D. Run from `/rotate` immediately after `populate.mjs`, on the same payload.
//
// WHAT IT DOES, AND THE LIST IS SHORT ON PURPOSE:
//   - reads the findings the rotation report already carries;
//   - for each finding that names a `family`, UPSERTS that family and appends ONE occurrence;
//   - recomputes the tiny active brief a fresh Larry is handed at session start.
//
// WHAT IT DOES NOT DO, and must never grow into:
//   - it does not CREATE a family from nothing. An unknown slug is REPORTED and skipped, never
//     invented. Naming a new family is a judgement about cause, and a judgement is not a script.
//   - it does not decide a remedy, change a state to EFFECTIVE, or close anything.
//   - it does not mutate Git. `/rotate` may analyse and record learning; it may not implement
//     preventative changes, and this is the boundary that keeps that true.
//
// ANTI-SPAM IS THE SCHEMA. `capae_family.slug` is UNIQUE, so a recurrence updates the family it
// belongs to and can never mint a sibling. This script relies on that rather than restating it.
//
// CREDENTIALS are read by `populate.mjs`'s loader from the approved file on disk — never inherited
// from process.env, never printed, never logged. Same discipline, same file, one implementation.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { writeBrief, BRIEF_PATH } from '../governor/capae-brief.mjs';

// `populate.mjs` is imported LAZILY, inside the one function that needs it. Imported at module load
// it runs its own CLI main-guard and prints a usage line, which would make this module unusable from
// a test or another script. The credential loader is still ITS implementation — one loader, one
// approved file, no second copy of the parsing.
async function credentials() {
  const { loadCredentials } = await import('./populate.mjs');
  return loadCredentials();
}

/** Findings that name a family. Everything else is ordinary reporting and is left alone. */
export function familyFindings(payload) {
  const list = Array.isArray(payload && payload.findings) ? payload.findings : [];
  return list.filter((f) => f && typeof f.family === 'string' && f.family.trim() !== '');
}

/**
 * Map a finding's exposure word to an occurrence disposition.
 *
 * `none-this-session` is recorded as an occurrence row deliberately: "no qualified opportunity
 * arose" is evidence, and it is the evidence that stops an absent recurrence being mistaken for a
 * proven prevention. It is explicitly NOT a clean exposure.
 */
export function dispositionFor(exposure) {
  const e = String(exposure || '').trim().toLowerCase();
  if (e === 'clean') return 'CLEAN-EXPOSURE';
  if (e === 'none-this-session') return 'NONE-THIS-SESSION';
  if (e === 'new') return 'NEW';
  return 'RECURRENCE';
}

async function rest(base, key, path, init = {}) {
  const r = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

export async function syncCapae(payload, { rotationId = null } = {}) {
  const creds = await credentials();
  const base = creds.supabaseUrl;
  const key = creds.serviceKey;
  if (!base || !key) return { ok: false, error: 'Supabase REST credentials are not available; nothing was written.' };

  const findings = familyFindings(payload);
  const known = await rest(base, key, 'session_report.capae_family?select=id,slug,occurrences');
  const bySlug = new Map((known || []).map((f) => [f.slug, f]));

  const applied = [];
  const unknown = [];
  for (const f of findings) {
    const slug = f.family.trim();
    const fam = bySlug.get(slug);
    // AN UNKNOWN SLUG IS A REPORT, NOT A NEW ROW. Auto-creating one would make every typo a family
    // and turn the record into exactly the incident spam the brief forbids.
    if (!fam) { unknown.push(slug); continue; }

    const disposition = dispositionFor(f.exposure);
    await rest(base, key, 'session_report.capae_occurrence', {
      method: 'POST',
      body: JSON.stringify({
        family_id: fam.id, rotation_id: rotationId, disposition,
        summary: f.summary || null, evidence_ref: f.evidence_ref || f.evidence || null,
      }),
    });

    // A CLEAN EXPOSURE ADVANCES THE COUNT; A RECURRENCE DOES NOT — it raises the occurrence count
    // and leaves effectiveness to be re-judged by a human, because deciding a prevention has failed
    // is a disposition and dispositions are not this script's to take.
    const isFailure = disposition === 'NEW' || disposition === 'RECURRENCE';
    const patch = { last_occurrence_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (isFailure) patch.occurrences = (Number(fam.occurrences) || 0) + 1;
    await rest(base, key, `session_report.capae_family?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    });
    applied.push({ slug, disposition });
  }

  // Recompute the precomputed brief from the CURRENT record, so the next session start reflects
  // this rotation without a query at hook time.
  const families = await rest(base, key,
    'session_report.capae_family?select=slug,title,state,occurrences,root_cause,required_larry_behaviour,unmeasurable,is_pilot,exposures_clean,exposures_required');
  const brief = writeBrief(families || []);

  return { ok: true, applied, unknown, briefPath: BRIEF_PATH, briefFamilies: brief.families.length };
}

// The house main-guard (`continuity.mjs` precedent). A suffix match on the basename would fire for
// any script sharing this file's name, and would misfire under `node -e` where argv[1] is absent.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const file = process.argv[2];
  if (!file) { console.error('usage: capae-sync.mjs <payload.json> [rotation_id]'); process.exit(2); }
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  syncCapae(payload, { rotationId: process.argv[3] || null })
    .then((r) => {
      if (!r.ok) { console.error(r.error); process.exit(1); }
      console.log(JSON.stringify(r, null, 2));
      // VISIBLE FAILURE, NEVER SILENT: an unrecognised slug is the one outcome a human must see.
      if (r.unknown.length) {
        console.error(`\nUNKNOWN FAMILY SLUGS — reported, NOT created: ${r.unknown.join(', ')}`);
        console.error('Name the family deliberately, or correct the slug in the report. Nothing was invented.');
        process.exit(3);
      }
    })
    .catch((e) => { console.error(`capae-sync failed: ${e.message}`); process.exit(1); });
}
