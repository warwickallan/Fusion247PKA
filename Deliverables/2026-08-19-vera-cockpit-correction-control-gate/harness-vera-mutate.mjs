// Vera's INDEPENDENT mutation check. Restores the shipped defect and asserts the gate goes RED.
// Safety: original bytes held in memory + on disk, restored in a finally, md5 verified after.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const F = 'C:/Fusion247PKA/services/cockpit/public/app.js';
const orig = fs.readFileSync(F);
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const before = md5(orig);
const BAK = 'C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/736e76e6-1682-4c84-97a0-acc90d1abe3a/scratchpad/app.js.vera-backup';
fs.writeFileSync(BAK, orig);
console.log('original md5', before, '| backup written');

const MUTANTS = [
  ['V-2 restored: answered_open_round falls through to success',
   'if (r.answered_open_round === true) {', 'if (false) {'],
  ['V-2 restored: success gated on not-duplicate instead of corrected',
   'if (r.corrected === true) {', 'if (r.duplicate !== true) {'],
  ['V-1 restored: WAS ignores the receipt field',
   'was: asdairKnown(r.superseded_answer_text) ? String(r.superseded_answer_text) : null,', 'was: null,'],
  ['unknown-shape guard removed: a novel receipt becomes success',
   "return { kind: 'unknown', ok: false, done: null,\n        message: 'AsdAIr accepted the command but did not report a change. Check the board before trying again.' };",
   "return { kind: 'corrected', ok: true, done: null, message: 'Changed to: ' + text + '.' };"],
];

let allRed = true;
try {
  for (const [name, from, to] of MUTANTS) {
    const src = orig.toString('utf8');
    if (!src.includes(from)) { console.log('SKIP (pattern absent):', name); allRed = false; continue; }
    const mutated = src.replace(from, to);
    if (mutated === src) { console.log('SKIP (no change):', name); allRed = false; continue; }
    fs.writeFileSync(F, mutated);
    let red = false, out = '';
    try {
      out = execFileSync('node', ['services/cockpit/render-vm-check.mjs'],
        { cwd: 'C:/Fusion247PKA', encoding: 'utf8', timeout: 180000 });
    } catch (e) { red = true; out = String(e.stdout || '') + String(e.stderr || ''); }
    const failLine = (out.match(/(\d+) failed/) || [])[1];
    if (failLine && Number(failLine) > 0) red = true;
    console.log((red ? 'RED   ' : '**GREEN — MUTANT SURVIVED**') + '  ' + name + '  (failed=' + (failLine ?? '?') + ')');
    if (!red) allRed = false;
    fs.writeFileSync(F, orig);
  }
} finally {
  fs.writeFileSync(F, orig);
  const after = md5(fs.readFileSync(F));
  console.log('\nrestored md5', after, after === before ? '— IDENTICAL, source is clean' : '*** MISMATCH — RESTORE FROM ' + BAK);
  if (after !== before) process.exitCode = 2;
}
console.log(allRed ? '\nALL MUTANTS RED — the coverage is real.' : '\nAT LEAST ONE MUTANT SURVIVED.');
