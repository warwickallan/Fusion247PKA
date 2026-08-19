import { launch, toBoard, openCorrect, evalJs, shot, sleep, setScenario, INJ } from './vera-gate.mjs';
// V-1: tap "Change this answer" on the SUPERSEDED round-1 row.
// The backend (commands.js:516-531) walks to the TIP and supersedes THAT, and publishes the truth
// in superseded_answer_text / superseded_answered_at. The sheet uses the TAPPED row instead.
console.log(await setScenario('chain', 'corrected'));
const cdp = await launch();
try {
  await toBoard(cdp, 1280, 1100, false);
  const btns = await evalJs(cdp, "JSON.stringify([].slice.call(document.querySelectorAll('button')).filter(function(x){return (x.innerText||'').indexOf('Change this answer')>=0;}).map(function(b,i){return i+': disabled='+b.disabled+' in row \"'+b.closest('details').querySelector('summary').innerText.trim().slice(0,55)+'\"';}))");
  console.log('correction buttons on the board:\n' + JSON.parse(btns).join('\n'));
  console.log('\n>> tapping the SUPERSEDED row (index 1)');
  console.log(await openCorrect(cdp, 1));
  console.log('sheet "On record now" panel:\n' + await evalJs(cdp, "VERA.text('.as-was')"));
  await evalJs(cdp, "VERA.setInput('#asdair-correct-text','Alpro Oat No Sugars 1L')");
  await evalJs(cdp, "VERA.check('#asdair-correct-confirm')"); await sleep(200);
  await evalJs(cdp, "[].slice.call(document.querySelectorAll('.sheet-card button')).filter(function(b){return (b.textContent||'').indexOf('Change my answer')>=0;})[0].click()");
  await sleep(2200); await evalJs(cdp, INJ);
  console.log('\n===== WHAT THE SHEET CLAIMS =====\n' + await evalJs(cdp, "VERA.text('.as-done')"));
  console.log('\n(the receipt said superseded_answer_text = "Arla Cravendale Whole Milk 2L")');
  console.log(await shot(cdp, 'V1-superseded-row-claim'));
} finally { cdp.close(); }
