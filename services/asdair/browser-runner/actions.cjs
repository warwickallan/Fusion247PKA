// BUILD-015 AsdAIr browser runner - the ALLOWLISTED action surface.
// There is deliberately NO command for checkout, payment, slot booking,
// password entry, enabling substitutions, or accepting a substitute.
const { targets, connect, newTab } = require('./cdp.js');
const HEADER = `JSON.stringify((()=>{const m=document.body.innerText.match(/Trolley\s+(\d+)\s+items?\s+total price\s+([\d.]+)\s+pounds/i);return {items:m?+m[1]:null,total:m?m[2]:null};})())`;

async function withPage(url, waitMs = 12000) {
  const t = await newTab(url);
  await new Promise(r => setTimeout(r, waitMs));
  const page = (await targets()).find(x => x.id === t.id);
  if (!page) throw new Error('page not found: ' + url);
  const c = await connect(page.webSocketDebuggerUrl);
  await c.send('Runtime.enable');
  return c;
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
