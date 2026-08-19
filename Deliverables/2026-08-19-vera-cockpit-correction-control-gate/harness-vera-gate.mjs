import fs from 'node:fs';
import { launch, viewport, go, evalJs, shot } from './vera-cdp.mjs';
const INJ = fs.readFileSync('./vera-inject.js', 'utf8');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function setScenario(s, r) {
  const res = await fetch('http://127.0.0.1:8098/vera/set?s=' + s + '&r=' + r);
  return res.json();
}

/** Home -> Apps -> AsdAIr -> Exceptions, details expanded. */
export async function toBoard(cdp, w, h, dark) {
  await viewport(cdp, w, h, dark);
  await go(cdp, 'http://127.0.0.1:8098/', 4200);
  await evalJs(cdp, INJ);
  await evalJs(cdp, "VERA.clickText('Apps','button,.tile,a,.nav-btn')"); await sleep(900);
  await evalJs(cdp, "VERA.clickText('AsdAIr','.tile')"); await sleep(2200);
  await evalJs(cdp, INJ);
  await evalJs(cdp, "VERA.clickText('Exceptions','.app-nav-btn')"); await sleep(1200);
  await evalJs(cdp, INJ);
  // Click each resolved <summary> — the real disclosure interaction, not a scripted .open.
  await evalJs(cdp, "(function(){[].slice.call(document.querySelectorAll('.grp details.tech > summary')).forEach(function(s){s.click();});return 1;})()");
  await sleep(700); await evalJs(cdp, INJ);
  return evalJs(cdp, "VERA.bodyText().length");
}

/** Open the correction sheet on the Nth 'Change this answer' button (0-based). */
export async function openCorrect(cdp, n) {
  const js = "(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return (x.textContent||'').indexOf('Change this answer')>=0;});"
           + "if(!b[" + n + "]) return 'NOT FOUND ('+b.length+' present)';"
           + "var t=b[" + n + "]; var d=t.disabled; t.scrollIntoView({block:'center'}); if(!d) t.click(); return 'btn'+" + n + "+' disabled='+d;})()";
  const r = await evalJs(cdp, js); await sleep(700); await evalJs(cdp, INJ);
  return r;
}

export { launch, viewport, go, evalJs, shot, sleep, INJ };
