// Vera's independent mutants against the V-10 logic.
// Anchors are WHOLE LINES and must occur EXACTLY ONCE — a substring anchor that matches twice, or
// zero times, is a mutant that silently does not apply, and a non-applying mutant is a green run
// that proves nothing. EOL derived from the source (the file is CRLF).
import fs from 'node:fs'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
const F='C:/Fusion247PKA/services/cockpit/public/app.js';
const orig=fs.readFileSync(F); const md5=b=>crypto.createHash('md5').update(b).digest('hex'); const before=md5(orig);
const src=orig.toString('utf8'); const EOL=src.includes('\r\n')?'\r\n':'\n';
const lines=src.split(EOL);
console.log('EOL='+(EOL==='\r\n'?'CRLF':'LF')+'  md5='+before+'\n');

const M=[
 ['V-10 restored: duplicate no longer short-circuits the open round',
  '        if (r.answered_open_round === true) {', '        if (false) {'],
 ['duplicate-first block removed entirely (pre-V-10 order)',
  '      if (r.duplicate === true) {', '      if (false) {'],
 ['blanket refusal: the un-raced open round becomes a failure',
  "        return { kind: 'answered_open_round', ok: true, done: null,", "        return { kind: 'answered_open_round', ok: false, done: null,"],
];
let applied=0, red=0;
try{
 for(const [name,from,to] of M){
   const n=lines.filter(l=>l===from).length;
   if(n!==1){ console.log('NOT APPLIED (anchor occurs '+n+'x, need exactly 1): '+name); continue; }
   applied++;
   const mutated=lines.map(l=>l===from?to:l).join(EOL);
   if(mutated===src){ console.log('NOT APPLIED (no change): '+name); continue; }
   fs.writeFileSync(F,mutated);
   let isRed=false,out='';
   try{ out=execFileSync('node',['services/cockpit/render-vm-check.mjs'],{cwd:'C:/Fusion247PKA',encoding:'utf8',timeout:180000}); }
   catch(e){ isRed=true; out=String(e.stdout||'')+String(e.stderr||''); }
   const m=out.match(/(\d+) of \d+ assertions failed/);
   if(m && Number(m[1])>0) isRed=true;
   if(isRed) red++;
   console.log((isRed?'RED  ':'**GREEN — SURVIVED**')+'  '+name+'  ('+(m?m[0]:'?')+')');
   for(const a of (out.match(/ASSERTION FAILED.*/g)||[]).slice(0,2)) console.log('        '+a.replace(/ASSERTION FAILED — /,''));
   fs.writeFileSync(F,orig);
 }
} finally {
 fs.writeFileSync(F,orig);
 const after=md5(fs.readFileSync(F));
 console.log('\nrestored md5 '+after+(after===before?'  — IDENTICAL, source clean':'  *** MISMATCH ***'));
 if(after!==before) process.exitCode=2;
}
console.log('applied '+applied+'/'+M.length+', RED '+red+'/'+applied+(applied===M.length&&red===applied?'  — every applied mutant died':'  — CHECK'));
