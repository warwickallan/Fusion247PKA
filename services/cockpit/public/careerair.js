/* Fusion247 Cockpit — the opportunity grid.

   No build step and no framework: this file is served straight off disk like the rest of public/, so
   the bytes you are reading are the bytes that run. It is a classic script inside an IIFE and exports
   nothing — the same discipline apps.js documents at length, and for the same reason: two top-level
   `const` declarations of the same name across two classic scripts is a SyntaxError that blanks the
   page, and `node --check` cannot see it because each file is valid alone.

   ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
   ║ ⛔ NOTHING ON THIS PAGE IS EVER BUILT WITH innerHTML, AND THAT IS THE SECURITY CONTROL.        ║
   ║                                                                                              ║
   ║ Every value rendered here — a role title, an employer, a note, and above all the text of a    ║
   ║ tailored document — is put on the page as a TEXT NODE via `textContent`, never as markup.     ║
   ║ Escaping-then-concatenating would also work, but only for as long as everybody who edits this ║
   ║ file remembers to escape. Building nodes cannot be got wrong by omission: there is no code    ║
   ║ path here that turns a string into an element, so a `<script>` in a document body is text     ║
   ║ that says "<script>" and nothing else.                                                        ║
   ║                                                                                              ║
   ║ The markdown renderer below therefore emits DOM NODES, not an HTML string. It reads the       ║
   ║ document's SHAPE (headings, lists, bold, links) and builds the corresponding elements itself; ║
   ║ it never passes any part of the document through as markup. A link is only ever built when    ║
   ║ its target parses as http/https — anything else stays visible as plain text, so a `javascript:`║
   ║ URL in a document is something Warwick READS rather than something the page offers to run.    ║
   ║                                                                                              ║
   ║ ⚠️ Vex has NOT reviewed this route. Larry has it queued. Do not read this comment as sign-off. ║
   ╚══════════════════════════════════════════════════════════════════════════════════════════════╝ */
(function careerairGrid(window, document) {
  'use strict';

  var LIST_URL = '/api/careerair/opportunities';
  var DETAIL_URL = '/api/careerair/opportunity?id=';
  var CV_URL = '/api/careerair/cv?id=';

  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  };

  /* A value the system does not hold prints as "unknown", in a style that reads as an absence. It is
     never blank (which looks like a rendering fault) and never invented (which is worse). */
  var valueOrUnknown = function (v, parent) {
    if (v === null || v === undefined || String(v).trim() === '') { parent.appendChild(el('span', 'ca-unknown', 'unknown')); return false; }
    parent.appendChild(document.createTextNode(String(v)));
    return true;
  };

  var state = { rows: [], dbCount: -1, countsAgree: false, tiers: null, cvSource: 'unknown', open: {} };

  /* ---------------------------------------------------------------------------------------------
     THE MARKDOWN READING VIEW. A deliberately NARROW subset — headings, bullet lists, rules, bold
     and links. Anything the subset does not recognise stays as the literal characters the document
     contained. That is the safe direction and also the honest one: a CV rendered by a partial
     renderer that silently drops what it did not understand would be a document Warwick believes he
     has read.
     --------------------------------------------------------------------------------------------- */

  /** Inline pass: bold and http(s) links only. Appends TEXT NODES and built elements to `parent`. */
  function inline(text, parent) {
    var s = String(text == null ? '' : text);
    // One expression, alternating between the two inline forms, so a `**bold**` inside a link label
    // and a link inside bold cannot desynchronise two separate passes.
    var re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
    var last = 0, m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      if (m[1] !== undefined) {
        parent.appendChild(el('strong', null, m[1]));
      } else {
        var href = m[3], label = m[2], safe = null;
        // Allowlist by PARSED PROTOCOL, not by prefix string: `new URL` resolves the real scheme, so
        // whitespace tricks and case games cannot smuggle `javascript:` past a `startsWith` check.
        try { var u = new URL(href, window.location.origin); if (u.protocol === 'http:' || u.protocol === 'https:') safe = u.href; } catch (ignore) { safe = null; }
        if (safe) {
          var a = el('a', null, label);
          a.href = safe; a.target = '_blank'; a.rel = 'noopener noreferrer';
          parent.appendChild(a);
        } else {
          // Not a link we will offer. Show exactly what the document said, as text.
          parent.appendChild(document.createTextNode(m[0]));
        }
      }
      last = re.lastIndex;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }

  /** Block pass. Returns a DocumentFragment; never returns or accepts HTML. */
  function renderMarkdown(md) {
    var frag = document.createDocumentFragment();
    // Split on either line ending: a CRLF document must not arrive as one giant line. (This estate
    // has lost controls to exactly that assumption more than once.)
    var lines = String(md == null ? '' : md).split(/\r?\n/);
    var para = null, list = null;
    var closePara = function () { if (para) { frag.appendChild(para); para = null; } };
    var closeList = function () { if (list) { frag.appendChild(list); list = null; } };
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var t = line.trim();
      var h = /^(#{1,3})\s+(.*)$/.exec(t);
      var li = /^[-*]\s+(.*)$/.exec(t);
      if (t === '') { closePara(); closeList(); continue; }
      if (/^(-{3,}|_{3,}|\*{3,})$/.test(t)) { closePara(); closeList(); frag.appendChild(el('hr')); continue; }
      if (h) {
        closePara(); closeList();
        var head = el('h' + h[1].length);
        inline(h[2], head);
        frag.appendChild(head);
        continue;
      }
      if (li) {
        closePara();
        if (!list) list = el('ul');
        var item = el('li');
        inline(li[1], item);
        list.appendChild(item);
        continue;
      }
      closeList();
      if (!para) para = el('p'); else para.appendChild(document.createTextNode(' '));
      inline(t, para);
    }
    closePara(); closeList();
    return frag;
  }

  /* ---------------------------------------------------------------------------------------------
     ROWS
     --------------------------------------------------------------------------------------------- */

  var TIER_LABEL = { full: 'Full advert', partial: 'Partial', thin: 'Thin' };

  function scoreChips(row) {
    var box = el('div', 'ca-scores');
    var s = row.scores || {};
    if (s.larry !== null && s.larry !== undefined) box.appendChild(el('span', 'ca-chip ca-chip-larry', 'Judged ' + s.larry));
    if (s.rubric !== null && s.rubric !== undefined) box.appendChild(el('span', 'ca-chip ca-chip-rubric', 'Rubric ' + s.rubric));
    if (s.larry === null && s.rubric === null) box.appendChild(el('span', 'ca-chip ca-chip-rubric', 'No score'));
    // Both present and different. Said in a WORD, because two chips of different colours do not by
    // themselves tell Warwick that the system holds two answers here.
    if (s.disagree) box.appendChild(el('span', 'ca-disagree', 'they disagree'));
    return box;
  }

  function metaLine(row) {
    var meta = el('div', 'ca-r-meta');
    var pair = function (label, v) {
      var w = el('span');
      w.appendChild(el('b', null, label + ' '));
      valueOrUnknown(v, w);
      meta.appendChild(w);
    };
    pair('Salary', row.salary);
    pair('Location', row.location);
    if (row.employmentType) pair('Type', row.employmentType);
    if (row.closingDate) pair('Closes', row.closingDate);
    meta.appendChild(el('span', null, '#' + row.id));
    return meta;
  }

  function actions(row, card) {
    var acts = el('div', 'ca-r-acts');

    // AC3 — the advert link. A real anchor to the original posting, or a stated absence.
    if (row.url) {
      var a = el('a', 'ca-act', 'Open advert ↗');
      a.href = row.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      acts.appendChild(a);
    } else {
      acts.appendChild(el('span', 'ca-act ca-act-none', 'no advert link'));
    }

    // AC4 — the tailored document. Absence is stated in words; an empty cell that looks like a broken
    // link is the defect this branch exists to avoid.
    if (row.hasCv) {
      var b = el('button', 'ca-act ca-act-cv', 'Read tailored document');
      b.type = 'button';
      b.addEventListener('click', function () { openDoc(row); });
      acts.appendChild(b);
    } else {
      acts.appendChild(el('span', 'ca-act ca-act-none', 'no tailored document'));
    }

    var more = el('button', 'ca-act', 'Details');
    more.type = 'button';
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', function () { toggleDetail(row, card, more); });
    acts.appendChild(more);
    return acts;
  }

  function rowCard(row) {
    var card = el('article', 'ca-row t-' + row.tier);
    card.setAttribute('data-opp', row.id);
    card.setAttribute('data-tier', row.tier);

    var head = el('div', 'ca-r-head');
    var titles = el('div', 'ca-r-title');
    valueOrUnknown(row.title, titles);
    var emp = el('div', 'ca-r-emp');
    valueOrUnknown(row.employer, emp);
    var titleBox = el('div');
    titleBox.style.flex = '1';
    titleBox.style.minWidth = '0';
    titleBox.appendChild(titles);
    titleBox.appendChild(emp);
    head.appendChild(titleBox);
    head.appendChild(el('span', 'ca-tier ca-tier-' + row.tier, TIER_LABEL[row.tier]));
    card.appendChild(head);

    card.appendChild(metaLine(row));
    card.appendChild(scoreChips(row));
    if (row.summary) card.appendChild(el('p', 'ca-r-sum', row.summary));
    card.appendChild(actions(row, card));
    return card;
  }

  function toggleDetail(row, card, button) {
    var existing = card.querySelector('.ca-detail');
    if (existing) { existing.remove(); button.setAttribute('aria-expanded', 'false'); return; }
    button.setAttribute('aria-expanded', 'true');
    var box = el('div', 'ca-detail');
    box.appendChild(el('p', null, 'Loading…'));
    card.appendChild(box);
    fetch(DETAIL_URL + encodeURIComponent(row.id), { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        box.textContent = '';
        if (!d.ok) { box.appendChild(el('p', 'ca-blank', 'Could not read the detail: ' + (d.error || 'unknown error'))); return; }
        // The note comes from the DETAIL response, not the list: it is a quarter of the list payload
        // and nothing on the grid itself renders it. See the comment in careerair.mjs's shapeRow.
        if (d.note) {
          box.appendChild(el('h3', null, 'Why it scored that'));
          box.appendChild(el('p', null, d.note));
        }
        (d.fields || []).forEach(function (f) {
          box.appendChild(el('h3', null, f.name.replace(/_/g, ' ')));
          box.appendChild(el('p', null, f.value));
        });
        // AC6 again, at row level: a field that was extracted and came back EMPTY is named, so the
        // thinness of a row is visible in its detail and not only in its badge.
        if (d.blankFields && d.blankFields.length) {
          box.appendChild(el('p', 'ca-blank', 'Extracted but empty: ' + d.blankFields.join(', ') + '. Nothing was captured for these.'));
        }
        if (!(d.fields || []).length) {
          box.appendChild(el('p', 'ca-blank', 'No advert detail was captured for this opportunity at all.'));
        }
      })
      .catch(function (e) { box.textContent = ''; box.appendChild(el('p', 'ca-blank', 'Could not read the detail: ' + e.message)); });
  }

  function openDoc(row) {
    var dlg = document.getElementById('ca-doc');
    var body = document.getElementById('ca-doc-body');
    var head = document.getElementById('ca-doc-h');
    head.textContent = 'Tailored document — #' + row.id;
    body.textContent = 'Loading…';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', 'open');
    fetch(CV_URL + encodeURIComponent(row.id), { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        body.textContent = '';
        if (!d.ok) {
          body.appendChild(el('p', 'ca-blank', d.error === 'no_cv'
            ? 'There is no tailored document for this opportunity yet.'
            : 'The document could not be read: ' + (d.detail || d.error || 'unknown error')));
          return;
        }
        body.appendChild(renderMarkdown(d.markdown));
      })
      .catch(function (e) { body.textContent = ''; body.appendChild(el('p', 'ca-blank', 'The document could not be read: ' + e.message)); });
  }

  /* ---------------------------------------------------------------------------------------------
     FILTER, SORT, PAINT
     --------------------------------------------------------------------------------------------- */

  function currentFilters() {
    return {
      q: (document.getElementById('ca-q').value || '').trim().toLowerCase(),
      sort: document.getElementById('ca-sort').value,
      min: Number(document.getElementById('ca-min').value || 0),
      evidence: document.getElementById('ca-evidence').value,
      cvOnly: document.getElementById('ca-cv').checked,
    };
  }

  function visibleRows(f) {
    var out = state.rows.filter(function (r) {
      if (f.cvOnly && !r.hasCv) return false;
      if (f.evidence === 'full' && r.tier !== 'full') return false;
      if (f.evidence === 'thin' && r.tier === 'full') return false;
      if (f.min > 0) {
        var p = r.scores && r.scores.primary;
        if (p === null || p === undefined || p < f.min) return false;
      }
      if (f.q) {
        var hay = [r.title, r.employer, r.location, r.salary, r.summary, r.id].filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(f.q) === -1) return false;
      }
      return true;
    });
    var by = {
      score: function (a, b) {
        var pa = (a.scores && a.scores.primary), pb = (b.scores && b.scores.primary);
        // A row with no score sorts LAST under "best first" — never silently to the top as a zero,
        // and never dropped.
        if (pa === null || pa === undefined) pa = -1;
        if (pb === null || pb === undefined) pb = -1;
        return pb - pa || Number(b.id) - Number(a.id);
      },
      recent: function (a, b) { return String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')) || Number(b.id) - Number(a.id); },
      id: function (a, b) { return Number(a.id) - Number(b.id); },
    };
    return out.sort(by[f.sort] || by.score);
  }

  function paint() {
    var f = currentFilters();
    var rows = visibleRows(f);
    var list = document.getElementById('ca-list');
    var stateLine = document.getElementById('ca-state');
    list.textContent = '';
    if (!rows.length) {
      stateLine.textContent = 'No opportunity matches those filters. ' + state.rows.length + ' are loaded.';
      stateLine.className = 'ca-state';
      return;
    }
    stateLine.textContent = '';
    stateLine.className = 'ca-state';
    var frag = document.createDocumentFragment();
    rows.forEach(function (r) { frag.appendChild(rowCard(r)); });
    list.appendChild(frag);
    paintCount(rows.length);
  }

  /* THE COUNT LINE — two independent measurements, both said out loud.
     `state.rows.length` is what this page built. `state.dbCount` came from its own count(*) statement
     server-side. They must agree; if they ever do not, this line says so in red rather than letting a
     grid quietly show fewer opportunities than exist. */
  function paintCount(showing) {
    var n = document.getElementById('ca-count');
    n.className = 'ca-count';
    if (!state.countsAgree) {
      n.className = 'ca-count ca-mismatch';
      n.textContent = 'MISMATCH — ' + state.rows.length + ' rows built, but the database holds ' + state.dbCount
        + ' live opportunities. Rows are missing from this page. Do not treat this list as complete.';
      return;
    }
    var t = state.tiers || { full: 0, partial: 0, thin: 0 };
    n.textContent = 'Showing ' + showing + ' of ' + state.rows.length + ' live opportunities (database agrees: '
      + state.dbCount + '). ' + t.full + ' full adverts · ' + t.partial + ' partial · ' + t.thin + ' thin · '
      + state.cvCount + ' with a tailored document.';
  }

  function paintLegendHint() {
    var t = state.tiers || { full: 0, partial: 0, thin: 0 };
    document.getElementById('ca-legend-hint').textContent =
      ' — ' + t.thin + ' of ' + state.rows.length + ' rows have no advert detail at all';
  }

  function load() {
    var stateLine = document.getElementById('ca-state');
    fetch(LIST_URL, { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) {
          stateLine.className = 'ca-state ca-err';
          stateLine.textContent = 'The opportunity list could not be read: ' + (d.error || 'unknown error')
            + '. Nothing is being guessed at — this is not an empty list, it is an unread one.';
          return;
        }
        state.rows = d.rows || [];
        state.dbCount = d.dbCount;
        state.countsAgree = d.countsAgree;
        state.tiers = d.tiers;
        state.cvCount = d.cvCount;
        state.cvSource = d.cvSource;
        paint();
        paintLegendHint();
        if (state.cvSource !== 'configured') {
          var warn = el('p', 'ca-blank');
          warn.textContent = 'The tailored-document store is not connected on this server, so every row will report "no tailored document".';
          document.getElementById('ca-legend').insertAdjacentElement('afterend', warn);
        }
      })
      .catch(function (e) {
        stateLine.className = 'ca-state ca-err';
        stateLine.textContent = 'The opportunity list could not be read: ' + e.message
          + '. Nothing is being guessed at — this is not an empty list, it is an unread one.';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('ca-controls').addEventListener('input', paint);
    document.getElementById('ca-controls').addEventListener('change', paint);
    document.getElementById('ca-controls').addEventListener('submit', function (e) { e.preventDefault(); });
    document.getElementById('ca-doc-x').addEventListener('click', function () {
      var d = document.getElementById('ca-doc');
      if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
    });
    load();
  });
}(window, document));
