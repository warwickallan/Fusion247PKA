// BUILD-015 AsdAIr browser runner - the ALLOWLISTED action surface.
// There is deliberately NO command for checkout, payment, slot booking,
// password entry, enabling substitutions, or accepting a substitute.
const { openShoppingTab } = require('./cdp.js');
const HEADER = `JSON.stringify((()=>{const m=document.body.innerText.match(/Trolley\s+(\d+)\s+items?\s+total price\s+([\d.]+)\s+pounds/i);return {items:m?+m[1]:null,total:m?m[2]:null};})())`;

// ONE TAB. This used to be `newTab(url)` on every call, which is a tab per
// product page - the behaviour BROWSER_METHOD `one_session_one_page_context`
// forbids and the one Warwick watched go wrong. It now navigates the session's
// single tab, and there is no longer an exported primitive that could open a
// second one. See cdp.js.
async function withPage(url, waitMs = 12000) {
  return openShoppingTab(url, { waitMs });
}
const ev = async (c, expression) => (await c.send('Runtime.evaluate', { returnByValue: true, expression })).result?.result?.value;

// Click the add-to-trolley control on a PRODUCT page (add by product reference).
async function addByProductRef(path) {
  const c = await withPage('https://www.asda.com' + path);
  const before = JSON.parse(await ev(c, HEADER));
  const clicked = await ev(c, `(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>/^\s*Add\s*$/i.test(x.textContent)||/add item .* to cart/i.test(x.getAttribute('aria-label')||''));if(!b)return 'no-add-button';b.click();return 'clicked';})()`);
  await new Promise(r => setTimeout(r, 5000));
  const after = JSON.parse(await ev(c, HEADER));
  c.close();
  return { clicked, before, after };
}
async function readHeader() { const c = await withPage('https://www.asda.com/groceries/trolley'); const h = JSON.parse(await ev(c, HEADER)); c.close(); return h; }
module.exports = { withPage, ev, addByProductRef, readHeader, HEADER };
