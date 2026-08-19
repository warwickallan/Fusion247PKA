// Read the live trolley state. READ-ONLY.
const { openShoppingTab } = require('./cdp.js');
// ONE TAB, read-only. Reading the trolley used to open its own tab on top of
// whatever the adds had already opened; it now navigates the session's single
// tab like everything else. cdp.js no longer exports a way to do otherwise.
async function openAndEval(url, expression, waitMs = 10000) {
  const c = await openShoppingTab(url, { waitMs });
  const ev = await c.send('Runtime.evaluate', { returnByValue: true, expression });
  const targetId = c.targetId;
  c.close();
  return { value: ev.result?.result?.value, targetId };
}
// ── STRING.RAW IS LOAD-BEARING (WO-2026-08-19-01). ─────────────────────────
// This was an ordinary template literal, and every backslash in the regexes
// below was consumed when Node built the string. The expression that reached
// the page read:
//
//     /Order totals*£(d+.d{2})/        instead of  /Order total\s*£(\d+\.\d{2})/
//     .filter(x=>x.name && //product//.test(x.href));
//
// The last one is not merely a wrong regex - `//` opens a LINE COMMENT, so the
// whole expression was a SyntaxError and Runtime.evaluate returned undefined.
// This module could never have read a trolley. It has no production caller
// today (run-basket goes through browser.cjs, whose copy escapes correctly),
// which is the only reason it never showed up as a live failure - and exactly
// why it would have been believed the first time something did call it.
//
// String.raw keeps the backslashes. There are no intentional escapes in this
// template - the newlines are real newlines - so nothing else changes.
const TROLLEY_SNAPSHOT = String.raw`JSON.stringify((()=>{
  const txt = document.body.innerText;
  const total = (txt.match(/Order total\s*£(\d+\.\d{2})/)||[null,null])[1];
  const items = (txt.match(/(\d+)\s+items? subtotal/)||[null,null])[1];
  const products = (txt.match(/Your products\s*\((\d+)\)/)||[null,null])[1];
  const lines = Array.from(document.querySelectorAll('[data-testid],li,div'))
    .map(e=>e.getAttribute && e.getAttribute('aria-label'))
    .filter(a=>a && /quantity in cart/i.test(a));
  const names = Array.from(document.querySelectorAll('a[href*="/groceries/product/"]'))
    .map(a=>({name:(a.textContent||'').trim().slice(0,80), href:a.getAttribute('href')}))
    .filter(x=>x.name && /\/product\//.test(x.href));
  const uniq = []; const seen = new Set();
  for(const n of names){ const id=(n.href.match(/\/(\d+)(?:$|\?)/)||[])[1]; const k=id||n.name;
    if(!seen.has(k)){seen.add(k); uniq.push({name:n.name, product_id:id||null});} }
  return {order_total: total, item_count: items, product_count: products, products: uniq};
})())`;
module.exports = { openAndEval, TROLLEY_SNAPSHOT };
if (require.main === module) {
  openAndEval('https://www.asda.com/groceries/trolley', TROLLEY_SNAPSHOT, 12000)
    .then(r => console.log(r.value)).catch(e => console.log('ERR', e.message));
}
