import { launch, toBoard, openCorrect, evalJs, shot, sleep, setScenario, INJ } from './vera-gate.mjs';

// WCAG 2.x relative luminance — GL-003 §2d, byte-for-byte.
const lin = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const ratio = (fg, bg) => { const a = L(parse(fg)), b = L(parse(bg)); const hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05); };
// Self-validation against GL-003's pinned anchors, per §2d. Refuse to print if it cannot reproduce them.
const anchors = [['rgb(22,32,46)', 'rgb(255,255,255)', 16.40], ['rgb(71,86,107)', 'rgb(255,255,255)', 7.47], ['rgb(10,92,100)', 'rgb(255,255,255)', 7.70]];
for (const [f, b, want] of anchors) { const got = ratio(f, b); if (Math.abs(got - want) > 0.02) { console.error('CONTRAST MODEL FAILED anchor', f, b, got, 'want', want); process.exit(2); } }
console.log('contrast model validated against 3 GL-003 anchors\n');

const SELECTORS = [
  '.as-chip-old', '.as-chip-new', '.as-superseded > summary', '.as-chain',
  '.as-was-h', '.as-was-a', '.as-was-w', '.as-done-h', '.as-done-b',
  '.as-confirm', '.as-confirm span', '.sheet-card .err', '.as-note', '.as-flash',
];
const probe = "(function(){var out=[];" + JSON.stringify(SELECTORS) + ".forEach(function(sel){"
  + "var e=document.querySelector(sel); if(!e) { out.push({sel:sel,miss:true}); return; }"
  + "var cs=getComputedStyle(e); var bg=null,p=e;"
  + "while(p){var c=getComputedStyle(p).backgroundColor; if(c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){bg=c;break;} p=p.parentElement;}"
  + "var a=1,q=e; while(q&&q.nodeType===1){a*=parseFloat(getComputedStyle(q).opacity||'1');q=q.parentElement;}"
  + "var r=e.getBoundingClientRect();"
  + "out.push({sel:sel,color:cs.color,bg:bg,size:parseFloat(cs.fontSize),weight:cs.weight||cs.fontWeight,alpha:a,w:Math.round(r.width),h:Math.round(r.height)});});"
  + "return JSON.stringify(out);})()";

const W = Number(process.argv[2] || 1280);
const DARK = process.argv[3] === 'dark';
const label = W + '-' + (DARK ? 'dark' : 'light');

console.log(await setScenario('chain', process.env.VERA_RECEIPT || 'duplicate'));
const cdp = await launch();
try {
  await toBoard(cdp, W, W < 700 ? 1500 : 1200, DARK);
  console.log('board shot:', await shot(cdp, 'S-board-' + label, true));
  console.log('board scrollWidth vs clientWidth:', await evalJs(cdp, "document.documentElement.scrollWidth+' / '+document.documentElement.clientWidth"));
  await openCorrect(cdp, 0);
  await evalJs(cdp, "VERA.setInput('#asdair-correct-text','Oatly Barista Oat Drink 1L')");
  await evalJs(cdp, "VERA.check('#asdair-correct-confirm')"); await sleep(200);
  console.log('sheet shot (armed):', await shot(cdp, 'S-sheet-armed-' + label));
  await evalJs(cdp, "[].slice.call(document.querySelectorAll('.sheet-card button')).filter(function(b){return (b.textContent||'').indexOf('Change my answer')>=0;})[0].click()");
  await sleep(2000); await evalJs(cdp, INJ);
  console.log('sheet shot (refused):', await shot(cdp, 'S-sheet-' + (process.env.VERA_RECEIPT||'duplicate') + '-' + label));
  // tap targets inside the sheet
  console.log('\n-- sheet tap targets (WCAG 2.5.8 = 24px min, house bar 44px) --');
  console.log(await evalJs(cdp, "JSON.stringify([].slice.call(document.querySelectorAll('.sheet-card button,.sheet-card input,.sheet-card label')).map(function(e){var r=e.getBoundingClientRect();return (e.tagName+' '+String(e.className||e.type)).slice(0,28)+' -> '+Math.round(r.width)+'x'+Math.round(r.height);}),null,1)"));
  console.log('\n-- rendered contrast, ' + label + ' --');
  const rows = JSON.parse(await evalJs(cdp, probe));
  for (const r of rows) {
    if (r.miss) { console.log(String(r.sel).padEnd(26), 'not present in this state'); continue; }
    let fg = parse(r.color), bg = parse(r.bg);
    if (r.alpha < 1) { fg = fg.map((v, i) => r.alpha * v + (1 - r.alpha) * bg[i]); }
    const c = ratio('rgb(' + fg.map(Math.round).join(',') + ')', r.bg);
    const large = r.size >= 24 || (r.size >= 18.66 && Number(r.weight) >= 700);
    const need = large ? 3 : 4.5;
    console.log(String(r.sel).padEnd(26), String(r.size + 'px').padEnd(8), 'a=' + r.alpha.toFixed(2),
      c.toFixed(2).padStart(6), c >= need ? 'PASS' : '**FAIL** (needs ' + need + ')');
  }
} finally { cdp.close(); }
