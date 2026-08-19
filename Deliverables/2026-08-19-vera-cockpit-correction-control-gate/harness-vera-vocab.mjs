import { launch, toBoard, openCorrect, evalJs, sleep, setScenario } from './vera-gate.mjs';
const WORDS = ['delete','remove','eras','wipe','destroy','discard','gone','lost','strike','overwrit'];
function scan(text, where) {
  const t = (text || '').toLowerCase();
  const hits = [];
  for (const w of WORDS) { let i = t.indexOf(w); while (i >= 0) { hits.push(w + '  <<' + t.slice(Math.max(0, i - 60), i + 30).replace(/\s+/g, ' ') + '>>'); i = t.indexOf(w, i + 1); } }
  console.log(where + ': ' + (hits.length ? '\n   ' + hits.join('\n   ') : 'CLEAN — no deletion vocabulary'));
}
const cdp = await launch();
try {
  for (const [sc, rc] of [['chain','duplicate'],['chain','corrected'],['chain','refuseKey'],['unpublished','duplicate']]) {
    await setScenario(sc, rc);
    await toBoard(cdp, 1280, 1000, false);
    scan(await evalJs(cdp, "VERA.bodyText()"), '\nBOARD  [' + sc + ']');
    if (sc === 'chain') {
      await openCorrect(cdp, 0);
      scan(await evalJs(cdp, "VERA.text('.sheet-card')"), 'SHEET  [' + sc + '/' + rc + '] before submit');
      await evalJs(cdp, "VERA.setInput('#asdair-correct-text','Oatly Barista Oat Drink 1L')");
      await evalJs(cdp, "VERA.check('#asdair-correct-confirm')"); await sleep(200);
      await evalJs(cdp, "[].slice.call(document.querySelectorAll('.sheet-card button')).filter(function(b){return (b.textContent||'').indexOf('Change my answer')>=0;})[0].click()");
      await sleep(2000);
      scan(await evalJs(cdp, "VERA.text('.sheet-card')"), 'SHEET  [' + sc + '/' + rc + '] after submit');
    }
  }
} finally { cdp.close(); }
