// =====================================================================
// BUILD-015 AsdAIr browser runner - THE BROWSER SESSION.
//
// One long-lived CDP session against ONE reused tab in the visible, dedicated
// Chrome profile. Every method here maps 1:1 to a command on the allowlist in
// commands.cjs; there is nothing else it can do.
//
// EVERY navigation goes through guards.assertPermittedUrl and EVERY click goes
// through the in-page deny check built from guards.DENY_TARGET, so the refusal
// layer cannot be bypassed by a selector change on ASDA's side.
//
// The runner NEVER synthesises keyboard or pointer input: it calls no CDP
// `Input.` method. Searching is done by navigating to a search URL; quantity is
// changed by clicking the real +/- steppers and reading the value back.
// =====================================================================
'use strict';

const cdp = require('./cdp.js');
const guards = require('./guards.cjs');
const { normaliseProductRef, normaliseTerm, normaliseQty } = require('./commands.cjs');

const BASE = 'https://www.asda.com';
const URLS = {
  groceries: `${BASE}/groceries`,
  trolley: `${BASE}/groceries/trolley`,
  regulars: `${BASE}/groceries/favourites-lists/regulars`,
  product: (ref) => `${BASE}/groceries/product/${ref}`,
  search: (term) => `${BASE}/groceries/search/${encodeURIComponent(term)}`,
};

// ---------------------------------------------------------------------
// In-page helpers. Injected as expressions; they read and click, never type.
// ---------------------------------------------------------------------

const LABEL_OF = `(el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g,' ').trim()`;

/** Click the first button matching `pred`, refusing anything on the deny list. */
function clickExpr(predSource) {
  return `JSON.stringify((()=>{
    const deny = ${guards.inPageDenyRegexLiteral()};
    const labelOf = ${LABEL_OF};
    const pred = ${predSource};
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    const hit = buttons.find(b => { try { return pred(b, labelOf(b)); } catch(e) { return false; } });
    if (!hit) return {ok:false, reason:'no-matching-control'};
    const label = labelOf(hit);
    if (deny.test(label)) return {ok:false, reason:'refused-by-deny-list', label};
    if (hit.disabled || hit.getAttribute('aria-disabled') === 'true') return {ok:false, reason:'control-disabled', label};
    hit.click();
    return {ok:true, label};
  })())`;
}

/**
 * Page state: enough to tell a usable store page from an authentication
 * surface from a rate limit.
 *
 * The signed-out test is deliberately POSITIVE-EVIDENCE-BASED. ASDA does not
 * always bounce a signed-out shopper to login.asda.com immediately - it will
 * happily render the groceries landing page with a "Register / Sign in" header
 * and only redirect when the trolley is touched. Detecting that header state up
 * front is what stops the runner walking into a redirect halfway through a
 * write, so it reports re-authentication BEFORE it has half-built a basket.
 */
const PAGE_STATE = `JSON.stringify((()=>{
  const txt = (document.body && document.body.innerText) || '';
  const head = txt.slice(0, 1500);
  const guest = /(^|\\n)\\s*Register\\s*(\\n|$)/.test(head) && /(^|\\n)\\s*Sign in\\s*(\\n|$)/i.test(head);
  const member = /(^|\\n)\\s*(Sign out|My Account)\\s*(\\n|$)/i.test(head);
  return {
    url: location.href,
    title: document.title,
    text_head: txt.slice(0, 400),
    rate_limited: /too many requests/i.test(txt.slice(0, 400)),
    signed_out_marker: (guest && !member) || /sign in to (your )?asda/i.test(txt.slice(0, 4000)),
    signed_in_marker: member,
  };
})())`;

/**
 * Trolley snapshot. READ-ONLY.
 *
 * EVERY PRODUCT CARRIES ITS OWN QUANTITY, and where that cannot be read it says
 * so rather than going quiet. BROWSER_METHOD `reconcile_from_quantity_field` is
 * explicit that reconciliation reads each line's ACTUAL quantity field and never
 * infers it from a price - a multibuy offer changes the price and will lie. A
 * snapshot carrying only names and an order total cannot support that check at
 * all, which is why the read-back that "saw one product" could never have been
 * truthful no matter how it was compared.
 *
 * `qty_source` is the honest half. A null quantity with `qty_source:
 * "not-established"` is a REPORTABLE GAP, not a zero and not a silent pass - the
 * reconciliation is required to surface it rather than average over it.
 */
const TROLLEY_SNAPSHOT = `JSON.stringify((()=>{
  const txt = (document.body && document.body.innerText) || '';
  const order_total = (txt.match(/Order total\\s*£(\\d+\\.\\d{2})/) || [])[1] || null;
  const item_count = (txt.match(/(\\d+)\\s+items? subtotal/) || [])[1] || null;
  const product_count = (txt.match(/Your products\\s*\\((\\d+)\\)/) || [])[1] || null;
  const header = txt.match(/Trolley\\s+(\\d+)\\s+items?\\s+total price\\s+([\\d.]+)\\s+pounds/i);
  const empty = /trolley is empty/i.test(txt);

  const qtyOf = (anchor) => {
    let scope = anchor;
    for (let hop = 0; hop < 6 && scope; hop += 1) {
      scope = scope.parentElement;
      if (!scope) break;
      const input = scope.querySelector('input[type="number"], input[name*="quant" i], input[aria-label*="quant" i]');
      if (input && input.value !== '' && !isNaN(Number(input.value))) return { qty: Number(input.value), qty_source: 'input-value' };
      const labelled = Array.from(scope.querySelectorAll('[aria-label]'))
        .map(e => e.getAttribute('aria-label'))
        .find(a => a && /quantity/i.test(a) && /\\d/.test(a));
      if (labelled) return { qty: Number((labelled.match(/(\\d+)/)||[])[1]), qty_source: 'aria-label' };
      const inc = scope.querySelector('button[aria-label^="Increase" i]');
      if (inc) {
        const t = (scope.innerText||'').replace(/\\s+/g,' ').trim();
        const m = t.match(/(?:^|\\D)(\\d{1,3})(?:\\D|$)/);
        if (m) return { qty: Number(m[1]), qty_source: 'stepper-text' };
      }
    }
    return { qty: null, qty_source: 'not-established' };
  };

  const anchors = Array.from(document.querySelectorAll('a[href*="/groceries/product/"]'));
  const seen = new Set(); const products = [];
  for (const a of anchors) {
    const name = (a.textContent||'').replace(/\\s+/g,' ').trim().slice(0,90);
    const href = a.getAttribute('href') || '';
    if (!name) continue;
    const id = (href.match(/(\\d{3,12})(?:[/?#]|$)/) || [])[1] || null;
    const key = id || name;
    if (seen.has(key)) continue;
    seen.add(key);
    products.push(Object.assign({ name: name, product_ref: id }, qtyOf(a)));
  }
  return {
    order_total: order_total || (header ? header[2] : null),
    item_count: item_count || (header ? header[1] : null),
    product_count: product_count != null ? product_count : (empty ? '0' : (products.length ? String(products.length) : null)),
    empty, products,
    quantities_established: products.filter(p => p.qty_source !== 'not-established').length,
    quantities_not_established: products.filter(p => p.qty_source === 'not-established').length
  };
})())`;

/**
 * The Regulars / Favourites grid, enumerated. READ-ONLY.
 *
 * THIS IS THE PAGE THE WHOLE METHOD TURNS ON. `open_regulars` could already
 * NAVIGATE here and nothing could ever READ what was on it, so every line
 * without a stored id went to free search instead - one navigation and one
 * model call each, for products that were sitting on this one page with an
 * unambiguous canonical description.
 *
 * The extraction is deliberately the SAME SHAPE as the search result reader:
 * {product_ref, href, name}. A favourite and a search hit are the same kind of
 * thing - a live ASDA product with a canonical description - so the identity
 * layer above can treat them identically and the id stays an optimisation
 * rather than becoming a second concept.
 */
const REGULARS_SNAPSHOT = `JSON.stringify((()=>{
  const out=[]; const seen=new Set();
  for (const a of document.querySelectorAll('a[href*="/groceries/product/"]')) {
    const href=a.getAttribute('href')||'';
    const id=(href.match(/(\\d{3,12})(?:[/?#]|$)/)||[])[1];
    const name=(a.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120);
    if(!name) continue;
    const key=id||name;
    if(seen.has(key)) continue; seen.add(key);
    out.push({product_ref:id||null, href, name});
  }
  const bulk = Array.from(document.querySelectorAll('button, a[role="button"]'))
    .some(b => /add selected|add all|add to trolley/i.test((b.getAttribute('aria-label')||b.textContent||'')));
  const boxes = document.querySelectorAll('input[type="checkbox"]').length;
  return { items: out, bulk_control_present: bulk, checkbox_count: boxes };
})())`;

/**
 * Read the quantity currently shown by the stepper on a product page.
 * Three fallbacks, because ASDA has moved this control before.
 */
const READ_QTY = `JSON.stringify((()=>{
  const inc = document.querySelector('button[aria-label^="Increase" i]');
  const dec = document.querySelector('button[aria-label^="Decrease" i]');
  if (!inc && !dec) {
    const add = Array.from(document.querySelectorAll('button'))
      .find(b => /^\\s*add\\s*$/i.test(b.textContent||'') || /add item .* to cart/i.test(b.getAttribute('aria-label')||''));
    return { qty: add ? 0 : null, via: add ? 'add-button-present' : 'no-stepper' };
  }
  const scope = (inc && inc.closest('div,section,form')) || (dec && dec.closest('div,section,form'));
  const input = scope && scope.querySelector('input');
  if (input && input.value !== '' && !isNaN(Number(input.value))) return { qty: Number(input.value), via: 'input-value' };
  const labelled = scope && Array.from(scope.querySelectorAll('[aria-label]'))
    .map(e => e.getAttribute('aria-label'))
    .find(a => /quantity/i.test(a) && /\\d/.test(a));
  if (labelled) return { qty: Number((labelled.match(/(\\d+)/)||[])[1]), via: 'aria-label' };
  const t = scope ? (scope.innerText||'').replace(/\\s+/g,' ').trim() : '';
  const m = t.match(/(?:^|\\D)(\\d{1,3})(?:\\D|$)/);
  return { qty: m ? Number(m[1]) : null, via: 'stepper-text', raw: t.slice(0,80) };
})())`;

/**
 * Availability of the product currently displayed. Reports; never swaps.
 * `is_product_page` matters as much as the rest: it is how the runner tells
 * "this item is out of stock" from "that URL did not resolve to a product at
 * all", which are the same DOM from a naive read and want opposite responses.
 */
const READ_AVAILABILITY = `JSON.stringify((()=>{
  const txt = ((document.body && document.body.innerText) || '').slice(0, 6000);
  const out_of_stock = /out of stock|currently unavailable|not available|sold out/i.test(txt);
  const add = Array.from(document.querySelectorAll('button'))
    .find(b => /^\\s*add\\s*$/i.test(b.textContent||'') || /add item .* to cart/i.test(b.getAttribute('aria-label')||''));
  const stepper = !!document.querySelector('button[aria-label^="Increase" i]');
  const is_product_page = /\\/groceries\\/product\\//.test(location.pathname) && !!document.querySelector('h1');
  return { out_of_stock, addable: !!add || stepper, is_product_page, title: document.title, path: location.pathname };
})())`;

// ---------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------

class ReauthRequiredError extends Error {
  constructor(url, reason) {
    super(`ASDA needs re-authentication: ${reason || url} - that is Warwick's step, never the runner's`);
    this.name = 'ReauthRequiredError';
    this.url = url;
    this.reauth_reason = reason || `authentication required at ${url}`;
  }
}
class RateLimitedError extends Error {
  constructor() { super('ASDA returned "Too Many Requests" - backing off'); this.name = 'RateLimitedError'; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Session {
  constructor({ settleMs = 6000, navTimeoutMs = 45_000, log = () => {} } = {}) {
    this.settleMs = settleMs;
    this.navTimeoutMs = navTimeoutMs;
    this.log = log;
    this.conn = null;
    this.tabId = null;
  }

  /** Attach to the visible dedicated profile and take (or reuse) the runner's tab. */
  async open() {
    const v = await cdp.assertVisibleBrowser();
    this.browser = v.Browser;
    const tab = await cdp.reuseTab(`${BASE}/groceries`, `${BASE}/groceries`);
    this.tabId = tab.id;
    let ws = tab.webSocketDebuggerUrl;
    if (!ws) {
      const found = (await cdp.targets()).find((t) => t.id === tab.id);
      ws = found && found.webSocketDebuggerUrl;
    }
    if (!ws) throw new Error('runner tab has no websocket debugger url');
    this.conn = await cdp.connect(ws);
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    this.log(`attached to ${this.browser} tab ${this.tabId}`);
    return this;
  }

  /** Every CDP call passes the forbidden-method gate. */
  async send(method, params) {
    guards.assertSafeCdpMethod(method);
    if (!this.conn) throw new Error('session not open');
    return this.conn.send(method, params);
  }

  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { returnByValue: true, expression, awaitPromise: false });
    if (r.result && r.result.exceptionDetails) throw new Error('page evaluation failed: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result && r.result.result ? r.result.result.value : undefined;
  }

  async evaluateJson(expression) {
    const raw = await this.evaluate(expression);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  /** Navigate, wait for load, settle, then classify the page we landed on. */
  async goto(url, { settleMs = this.settleMs } = {}) {
    guards.assertPermittedUrl(url);
    const loaded = new Promise((res) => {
      const off = this.conn.on((msg) => { if (msg.method === 'Page.loadEventFired') { off(); res('load'); } });
      setTimeout(() => { off(); res('timeout'); }, this.navTimeoutMs);
    });
    await this.send('Page.navigate', { url });
    await loaded;
    await sleep(settleMs);
    return this.state();
  }

  /** Current page classification. Detects re-authentication; never resolves it. */
  async state() {
    const s = (await this.evaluateJson(PAGE_STATE)) || { url: null, title: null, text_head: '' };
    const redirected = guards.looksLikeAuthSurface({ url: s.url, title: s.title, text: s.text_head });
    s.reauth_required = redirected || s.signed_out_marker === true;
    s.reauth_reason = redirected
      ? `redirected to an authentication surface (${s.url})`
      : (s.signed_out_marker === true ? `the store rendered its signed-out header on ${s.url} - the ASDA session has lapsed` : null);
    return s;
  }

  /** Throw the right typed error when the page is not a usable store page. */
  assertUsable(s) {
    if (s.rate_limited) throw new RateLimitedError();
    if (s.reauth_required) throw new ReauthRequiredError(s.url, s.reauth_reason);
    return s;
  }

  /** Close the websocket. THE TAB AND THE BROWSER STAY OPEN, by design. */
  close() { if (this.conn) this.conn.close(); this.conn = null; }

  // ---- allowlisted commands -----------------------------------------

  async open_groceries() { return this.assertUsable(await this.goto(URLS.groceries)); }
  async open_trolley() { return this.assertUsable(await this.goto(URLS.trolley)); }
  async open_regulars() { return this.assertUsable(await this.goto(URLS.regulars)); }

  /**
   * Open the Regulars / Favourites grid and READ IT.
   *
   * One navigation, many products - which is `one_session_one_page_context`
   * doing its actual job rather than being an instruction nobody could follow.
   * The caller gets the live canonical descriptions and, where the grid exposes
   * them, the ASDA references; matching household identity against those
   * descriptions is the layer above's decision and is deliberately not made
   * here.
   */
  async read_regulars() {
    const s = this.assertUsable(await this.goto(URLS.regulars));
    const snap = await this.evaluateJson(REGULARS_SNAPSHOT);
    return {
      url: s.url,
      items: (snap && snap.items) || [],
      bulk_control_present: !!(snap && snap.bulk_control_present),
      checkbox_count: (snap && snap.checkbox_count) || 0,
    };
  }

  /**
   * Open a product page from its reference alone.
   *
   * ASDA's canonical product URL carries a slug as well as the id
   * (/groceries/product/<category>/<slug>/<id>). The bare-id form usually
   * resolves, but "usually" is not a basis for a supervised shop: if it ever
   * stops, the runner would silently be looking at a non-product page and would
   * report every planned item as unavailable. So the bare form is tried first,
   * and if what comes back is not a product page the product is found BY ITS
   * OWN REFERENCE through search, and the canonical link followed. The
   * reference is never loosened - only the route to it.
   */
  async locate_product(ref) {
    const r = normaliseProductRef(ref);
    let s = this.assertUsable(await this.goto(URLS.product(r)));
    let avail = await this.evaluateJson(READ_AVAILABILITY);
    let via = 'reference-url';

    if (!avail || avail.is_product_page !== true) {
      const found = await this.search(r);
      const hit = found.results.find((x) => x.product_ref === r);
      if (hit && hit.href) {
        s = this.assertUsable(await this.goto(BASE + hit.href.replace(/[?#].*$/, '')));
        avail = await this.evaluateJson(READ_AVAILABILITY);
        via = 'canonical-link-via-reference-search';
      } else {
        return { product_ref: r, url: s.url, title: s.title, via: 'not-found', is_product_page: false, addable: false, out_of_stock: false, not_found: true };
      }
    }
    return { product_ref: r, url: s.url, title: s.title, via, ...(avail || {}) };
  }

  async search(term) {
    const t = normaliseTerm(term);
    const s = this.assertUsable(await this.goto(URLS.search(t)));
    const results = await this.evaluateJson(`JSON.stringify((()=>{
      const out=[]; const seen=new Set();
      for (const a of document.querySelectorAll('a[href*="/groceries/product/"]')) {
        const href=a.getAttribute('href')||'';
        const id=(href.match(/(\\d{3,12})(?:[/?#]|$)/)||[])[1];
        if(!id||seen.has(id))continue; seen.add(id);
        out.push({product_ref:id, href, name:(a.textContent||'').replace(/\\s+/g,' ').trim().slice(0,90)});
        if(out.length>=40)break;
      }
      return out;})())`);
    return { term: t, url: s.url, results: results || [] };
  }

  /**
   * Add a product whose ASDA reference is already known. This is the ONLY way
   * anything reaches the trolley: an add always names an explicit reference,
   * so nothing can be added that was not planned.
   */
  async add_known_product(ref) {
    const r = normaliseProductRef(ref);
    const before = await this.locate_product(r);
    if (before.not_found === true) return { product_ref: r, added: false, reason: 'product-not-found', ...before };
    if (before.out_of_stock || before.addable === false) {
      return { product_ref: r, added: false, reason: 'unavailable', ...before };
    }
    const pre = await this.evaluateJson(READ_QTY);
    const click = await this.evaluateJson(clickExpr(
      `(b,l)=> /^\\s*add\\s*$/i.test(b.textContent||'') || /add item .* to cart/i.test(l)`
    ));
    if (!click || !click.ok) {
      const already = pre && pre.qty > 0;
      return { product_ref: r, added: false, reason: already ? 'already-in-trolley' : (click && click.reason) || 'click-failed', qty: pre && pre.qty };
    }
    await sleep(5000);
    const post = await this.evaluateJson(READ_QTY);
    return { product_ref: r, added: true, label: click.label, qty_before: pre && pre.qty, qty_after: post && post.qty, name: before.title };
  }

  /**
   * Search, then add ONE result the plan explicitly approved by reference. The
   * runner never picks a result on its own judgement - `product_ref` must be in
   * the result set, or nothing is added.
   */
  async select_search_result(term, ref) {
    const r = normaliseProductRef(ref);
    const found = await this.search(term);
    const hit = found.results.find((x) => x.product_ref === r);
    if (!hit) return { product_ref: r, term: found.term, added: false, reason: 'approved-result-not-in-search', results: found.results.slice(0, 10) };
    const add = await this.add_known_product(r);
    return { ...add, term: found.term, via: 'search' };
  }

  async read_quantity(ref) {
    const r = normaliseProductRef(ref);
    const s = this.assertUsable(await this.goto(URLS.product(r)));
    const q = await this.evaluateJson(READ_QTY);
    return { product_ref: r, qty: q ? q.qty : null, via: q ? q.via : null, title: s.title };
  }

  /**
   * Change quantity with the REAL +/- steppers, one click at a time, reading
   * the value back after each. Never by typing: a typed quantity does not
   * persist server-side.
   */
  async set_quantity(ref, qty) {
    const r = normaliseProductRef(ref);
    const target = normaliseQty(qty);
    this.assertUsable(await this.goto(URLS.product(r)));
    let cur = (await this.evaluateJson(READ_QTY)) || { qty: null };
    if (cur.qty == null) return { product_ref: r, ok: false, reason: 'quantity-not-readable', target };
    const clicks = [];
    const maxClicks = 40;
    while (cur.qty !== target && clicks.length < maxClicks) {
      const up = cur.qty < target;
      const res = await this.evaluateJson(clickExpr(
        up ? `(b,l)=> /^increase\\b/i.test(l)` : `(b,l)=> /^decrease\\b/i.test(l)`
      ));
      if (!res || !res.ok) {
        if (!up && cur.qty === 1) {
          const rm = await this.evaluateJson(clickExpr(`(b,l)=> /^remove\\b/i.test(l)`));
          if (rm && rm.ok) { clicks.push(rm.label); await sleep(3500); cur = (await this.evaluateJson(READ_QTY)) || cur; continue; }
        }
        return { product_ref: r, ok: false, reason: (res && res.reason) || 'stepper-click-failed', qty: cur.qty, target, clicks };
      }
      clicks.push(res.label);
      await sleep(3000);
      const next = (await this.evaluateJson(READ_QTY)) || cur;
      if (next.qty === cur.qty) {
        await sleep(3000);
        const retry = (await this.evaluateJson(READ_QTY)) || next;
        if (retry.qty === cur.qty) return { product_ref: r, ok: false, reason: 'stepper-did-not-move', qty: cur.qty, target, clicks };
        cur = retry;
      } else cur = next;
    }
    return { product_ref: r, ok: cur.qty === target, qty: cur.qty, target, clicks };
  }

  async add_to_favourites(ref) {
    const r = normaliseProductRef(ref);
    this.assertUsable(await this.goto(URLS.product(r)));
    const res = await this.evaluateJson(clickExpr(`(b,l)=> /add to (favourites|favorites)|save to (favourites|favorites)/i.test(l)`));
    return { product_ref: r, ok: !!(res && res.ok), reason: res && res.reason, label: res && res.label };
  }

  /** Report - not resolve - an item ASDA cannot supply. */
  async report_unavailable(ref) {
    const r = normaliseProductRef(ref);
    const s = this.assertUsable(await this.goto(URLS.product(r)));
    const a = (await this.evaluateJson(READ_AVAILABILITY)) || {};
    return { product_ref: r, unavailable: a.out_of_stock === true || a.addable === false, title: s.title, url: s.url };
  }

  async read_basket() {
    this.assertUsable(await this.goto(URLS.trolley));
    const snap = await this.evaluateJson(TROLLEY_SNAPSHOT);
    return snap || { order_total: null, item_count: null, product_count: null, products: [] };
  }

  async read_basket_line_count() { const b = await this.read_basket(); return { product_count: b.product_count, products: b.products }; }
  async read_estimated_total() { const b = await this.read_basket(); return { estimated_total: b.order_total, item_count: b.item_count }; }
}

module.exports = {
  Session, URLS, BASE, ReauthRequiredError, RateLimitedError,
  TROLLEY_SNAPSHOT, REGULARS_SNAPSHOT, READ_QTY, PAGE_STATE, clickExpr, sleep,
};
