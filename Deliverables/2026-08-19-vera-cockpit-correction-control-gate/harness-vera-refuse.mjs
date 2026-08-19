import { launch, toBoard, openCorrect, evalJs, shot, sleep, setScenario, INJ } from './vera-gate.mjs';

const RECEIPT = process.argv[2] || 'duplicate';
const TAG     = process.argv[3] || RECEIPT;
const DARK    = process.argv[4] === 'dark';
const W       = Number(process.argv[5] || 1280);

console.log(await setScenario('chain', RECEIPT));
const cdp = await launch();
try {
  await toBoard(cdp, W, W < 700 ? 1400 : 1100, DARK);
  console.log('open:', await openCorrect(cdp, 0));
  console.log('prefill:', await evalJs(cdp, "document.querySelector('#asdair-correct-text').value"));
  console.log('submit disabled before intent:', await evalJs(cdp, "[].slice.call(document.querySelectorAll('.sheet-card button')).filter(function(b){return (b.textContent||'').indexOf('Change my answer')>=0;})[0].disabled"));
  console.log(await evalJs(cdp, "VERA.setInput('#asdair-correct-text','Oatly Barista Oat Drink 1L')"));
  await sleep(200);
  console.log('submit disabled after text only:', await evalJs(cdp, "[].slice.call(document.querySelectorAll('.sheet-card button')).filter(function(b){return (b.textContent||'').indexOf('Change my answer')>=0;})[0].disabled"));
  console.log(await evalJs(cdp, "VERA.check('#asdair-correct-confirm')"));
  await sleep(200);
  console.log('submit disabled after both:', await evalJs(cdp, "[].slice.call(document.querySelectorAll('.sheet-card button')).filter(function(b){return (b.textContent||'').indexOf('Change my answer')>=0;})[0].disabled"));
  console.log(await shot(cdp, TAG + '-1-armed-' + W + (DARK?'-dark':'-light')));
  // SUBMIT
  await evalJs(cdp, "[].slice.call(document.querySelectorAll('.sheet-card button')).filter(function(b){return (b.textContent||'').indexOf('Change my answer')>=0;})[0].click()");
  await sleep(2200); await evalJs(cdp, INJ);
  console.log('\n===== SHEET AFTER SUBMIT =====\n' + await evalJs(cdp, "VERA.text('.sheet-card')"));
  console.log('\n--- flash behind the sheet (.as-flash) ---');
  console.log(JSON.stringify(await evalJs(cdp, "VERA.text('.as-flash')")));
  console.log('--- .err node ---');
  console.log(JSON.stringify(await evalJs(cdp, "VERA.pair('.sheet-card .err')")));
  console.log('--- live-region attrs on .err ---');
  console.log(await evalJs(cdp, "(function(){var e=document.querySelector('.sheet-card .err'); if(!e) return 'no .err'; return JSON.stringify({role:e.getAttribute('role'),live:e.getAttribute('aria-live'),id:e.id});})()"));
  console.log('--- sheet still open? ---', await evalJs(cdp, "!!document.querySelector('.sheet-card')"));
  console.log(await shot(cdp, TAG + '-2-after-' + W + (DARK?'-dark':'-light')));
} finally { cdp.close(); }
