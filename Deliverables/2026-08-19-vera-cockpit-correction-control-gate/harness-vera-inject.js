window.VERA = {
  all: function (sel) { return [].slice.call(document.querySelectorAll(sel || 'button,a,summary,label,input')); },
  list: function (sel) {
    return this.all(sel).map(function (e, i) {
      var r = e.getBoundingClientRect();
      return { i: i, tag: e.tagName, cls: String(e.className || ''), dis: !!e.disabled,
               txt: (e.innerText || e.textContent || '').trim().slice(0, 70),
               w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 };
    });
  },
  clickText: function (t, sel) {
    var m = this.all(sel).filter(function (e) {
      var s = (e.innerText || e.textContent || '');
      return s.indexOf(t) >= 0 && e.getBoundingClientRect().width > 0;
    });
    if (!m.length) return 'NOT FOUND: ' + t;
    m[0].click(); return 'clicked: ' + (m[0].innerText || '').trim().slice(0, 50);
  },
  openAllDetails: function () {
    var d = [].slice.call(document.querySelectorAll('details'));
    d.forEach(function (x) { x.open = true; });
    return d.length;
  },
  setInput: function (sel, v) {
    var e = document.querySelector(sel); if (!e) return 'NO INPUT ' + sel;
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(e, v);
    e.dispatchEvent(new Event('input', { bubbles: true }));
    return 'set ' + sel + ' = ' + e.value;
  },
  check: function (sel) {
    var e = document.querySelector(sel); if (!e) return 'NO CHECKBOX ' + sel;
    e.click(); return sel + ' checked=' + e.checked;
  },
  text: function (sel) { var e = document.querySelector(sel); return e ? (e.innerText || '').trim() : null; },
  // Rendered colour pairs: walk up for the first non-transparent background.
  pair: function (sel) {
    var e = document.querySelector(sel); if (!e) return null;
    var cs = getComputedStyle(e);
    var bg = null, p = e;
    while (p) { var c = getComputedStyle(p).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; } p = p.parentElement; }
    var r = e.getBoundingClientRect();
    return { sel: sel, color: cs.color, bg: bg, size: cs.fontSize, weight: cs.fontWeight,
             opacity: cs.opacity, w: Math.round(r.width), h: Math.round(r.height),
             txt: (e.innerText || '').trim().slice(0, 80) };
  },
  // Effective opacity = product of every ancestor opacity.
  effOpacity: function (sel) {
    var e = document.querySelector(sel); if (!e) return null;
    var a = 1, p = e;
    while (p && p.nodeType === 1) { a *= parseFloat(getComputedStyle(p).opacity || '1'); p = p.parentElement; }
    return a;
  },
  bodyText: function () { return document.body.innerText; },
  scrollTo: function (sel) { var e = document.querySelector(sel); if (e) { e.scrollIntoView({ block: 'center' }); return true; } return false; },
  focusables: function (root) {
    var r = document.querySelector(root || 'body');
    if (!r) return [];
    return [].slice.call(r.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]'))
      .filter(function (e) { var b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; })
      .map(function (e) { return { tag: e.tagName, cls: String(e.className || ''), dis: !!e.disabled,
        txt: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 45) }; });
  }
};
'VERA ready';
