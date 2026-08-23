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
  var STATUS_URL = '/api/careerair/status';

  /* The four states. The ORDER is the order they appear in the control, and it is the order Warwick
     moves through them — not alphabetical. The labels are the only status text on the page; the
     stored value ('closed') is never shown to him. Kept in step with STATUS_VALUES/STATUS_LABELS in
     careerair.mjs, which the server and the database both hold. */
  var STATUS_ORDER = ['todo', 'reviewed', 'applied', 'closed'];
  var STATUS_LABEL = {
    todo: 'To do',
    reviewed: 'Reviewed',
    applied: 'Applied',
    closed: 'No longer accepting',
  };

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

  var state = { rows: [], dbCount: -1, countsAgree: false, tiers: null, cvSource: 'unknown', open: {},
    /* How many rows the STATUS filter removed on the last paint. Counted from what was actually
       filtered, not predicted from statusCounts — the number in the sentence and the number of rows
       missing from the list are then the same measurement, and cannot drift apart. */
    hiddenByStatus: 0 };

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

  /* ---------------------------------------------------------------------------------------------
     WARWICK'S STATUS — the one control on this page that WRITES.

     A native <select>. Not a segmented control, not a row of buttons, not a custom widget: on a phone
     the platform picker gives a full-height touch target, the platform's own keyboard and screen
     reader semantics, and a value that is legible at a glance without opening anything. Four states
     that are mutually exclusive is exactly what a <select> is.

     ⛔ A FAILED WRITE MUST BE VISIBLE, because he will act on what this says. The update is optimistic
     — the control moves at once, which is the right feel on a phone — but it is RECONCILED AGAINST
     THE RESPONSE, never against what was sent. If the write fails the control goes back to where it
     was and the card says so out loud. A status that looks saved and is not is worse than no feature.
     --------------------------------------------------------------------------------------------- */
  function statusControl(row, card) {
    var wrap = el('div', 'ca-status-wrap');

    var sel = document.createElement('select');
    sel.className = 'ca-status-sel st-' + row.status;
    sel.id = 'ca-status-' + row.id;
    // No visible label per card — there is no room for 354 of them, and the value itself reads as
    // the label. The accessible name carries the opportunity so a screen reader user moving through
    // a long list always knows WHICH job the control belongs to.
    sel.setAttribute('aria-label', 'Status for opportunity ' + row.id);
    STATUS_ORDER.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s;
      o.textContent = STATUS_LABEL[s];
      if (s === row.status) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { setStatus(row, sel.value, sel, card); });
    wrap.appendChild(sel);

    // role=alert so a failure is ANNOUNCED, not just drawn. Empty until something goes wrong.
    var err = el('span', 'ca-status-err');
    err.id = 'ca-status-err-' + row.id;
    err.setAttribute('role', 'alert');
    wrap.appendChild(err);
    return wrap;
  }

  function setStatus(row, next, sel, card) {
    var prev = row.status;
    if (next === prev) return;
    var err = document.getElementById('ca-status-err-' + row.id);
    if (err) err.textContent = '';

    row.status = next;                                    // optimistic
    sel.disabled = true;                                  // no second write in flight for this row
    sel.className = 'ca-status-sel st-' + next + ' is-saving';

    fetch(STATUS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ id: row.id, status: next }),
    })
      .then(function (r) {
        // A 4xx/5xx does NOT reject a fetch. Carry the HTTP result forward explicitly, or a refusal
        // reads as a success and the whole reconciliation below never runs.
        return r.json().catch(function () { return null; }).then(function (d) { return { httpOk: r.ok, body: d }; });
      })
      .then(function (res) {
        if (!res.httpOk || !res.body || res.body.ok !== true) {
          throw new Error((res.body && res.body.error) || 'no_response');
        }
        // RECONCILE AGAINST THE RESPONSE. The server is what decides what was stored; if it ever
        // answered with a different status than was sent, this page follows the server.
        row.status = STATUS_LABEL[res.body.status] ? res.body.status : prev;
        row.statusAt = res.body.at || null;
        sel.disabled = false;
        sel.value = row.status;
        sel.className = 'ca-status-sel st-' + row.status;
        afterStatusWrite(row, card);
      })
      .catch(function (e) {
        row.status = prev;                                // the model goes back
        sel.disabled = false;
        sel.value = prev;                                 // and so does the CONTROL
        sel.className = 'ca-status-sel st-' + prev;
        if (err) {
          err.textContent = 'NOT SAVED — still "' + STATUS_LABEL[prev] + '". ' + writeFailureReason(e && e.message);
        }
      });
  }

  /* Say what went wrong in Warwick's terms. The server answers with codes precisely so that no path,
     host or role name can reach a response body; this turns the code back into a sentence. */
  function writeFailureReason(code) {
    if (code === 'unknown_opportunity') return 'This opportunity is no longer in the live list — reload the page.';
    if (code === 'bad_status' || code === 'bad_opportunity_id' || code === 'bad_json') return 'The page sent something the server refused. Reload and try again.';
    if (code === 'status_write_failed' || code === 'status_check_failed') return 'The database refused the write. Try again in a moment.';
    return 'The write did not reach the server. Check the connection and try again.';
  }

  /* After a CONFIRMED write. The card is updated IN PLACE rather than repainting all 354 — a full
     repaint would collapse every expanded detail panel and throw away Warwick's scroll position for
     a one-row change. If the row no longer passes the status filter it is removed, and focus moves
     to the count line, which is the element that explains where it went. */
  function afterStatusWrite(row, card) {
    var f = currentFilters();
    var removed = false;
    if (card && card.parentNode && !passesStatus(row, f.status)) { card.parentNode.removeChild(card); removed = true; }
    state.hiddenByStatus = hiddenByStatusCount(f);
    paintCount(document.getElementById('ca-list').querySelectorAll('.ca-row').length);
    if (removed) {
      var count = document.getElementById('ca-count');
      if (count) count.focus();
    }
  }

  function rowCard(row) {
    var card = el('article', 'ca-row t-' + row.tier);
    card.setAttribute('data-opp', row.id);
    card.setAttribute('data-tier', row.tier);
    card.setAttribute('data-status', row.status);

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
    card.appendChild(statusControl(row, card));
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
      status: document.getElementById('ca-status').value,
    };
  }

  /* Does the STATUS filter alone keep this row? Separate from visibleRows so the "how many are
     hidden" count can be attributed to THIS filter specifically. A row dropped by the search box is
     not hidden by the status filter, and telling Warwick otherwise would be the same class of lie
     the count line exists to prevent. */
  function passesStatus(r, mode) {
    if (mode === 'all') return true;
    if (mode === 'open') return r.status !== 'closed';
    return r.status === mode;
  }

  /* Every filter EXCEPT status. Split out so "how many is the status filter hiding" can be answered
     as a differential — see hiddenByStatusCount. */
  function passesOtherFilters(r, f) {
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
  }

  /* How many MORE rows Warwick would see if he turned the status filter off, every other filter left
     exactly as it is. That is the honest number, and it is not the same as "how many are closed": a
     dead row that his search box already excluded is not a row this filter is hiding from him, and
     counting it would overstate what the button will do. */
  function hiddenByStatusCount(f) {
    var eligible = 0, kept = 0;
    state.rows.forEach(function (r) {
      if (!passesOtherFilters(r, f)) return;
      eligible += 1;
      if (passesStatus(r, f.status)) kept += 1;
    });
    return eligible - kept;
  }

  function visibleRows(f) {
    var out = state.rows.filter(function (r) {
      return passesStatus(r, f.status) && passesOtherFilters(r, f);
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

    state.hiddenByStatus = hiddenByStatusCount(f);

    list.textContent = '';
    if (!rows.length) {
      // Even the empty state has to account for the rows the DEFAULT filter removed — otherwise the
      // one screen where a hidden row matters most is the one screen that does not mention them.
      stateLine.textContent = 'No opportunity matches those filters. ' + state.rows.length + ' are loaded'
        + (state.hiddenByStatus > 0 ? ', and ' + state.hiddenByStatus + ' of them are hidden by the status filter' : '') + '.';
      stateLine.className = 'ca-state';
      paintCount(0);
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
    n.textContent = '';
    if (!state.countsAgree) {
      n.className = 'ca-count ca-mismatch';
      n.textContent = 'MISMATCH — ' + state.rows.length + ' rows built, but the database holds ' + state.dbCount
        + ' live opportunities. Rows are missing from this page. Do not treat this list as complete.';
      return;
    }
    var t = state.tiers || { full: 0, partial: 0, thin: 0 };
    n.appendChild(document.createTextNode(
      'Showing ' + showing + ' of ' + state.rows.length + ' live opportunities (database agrees: '
      + state.dbCount + '). ' + t.full + ' full adverts · ' + t.partial + ' partial · ' + t.thin + ' thin · '
      + state.cvCount + ' with a tailored document.'));

    /* ⛔ THE FILTER NEVER HIDES SILENTLY. It is ON before Warwick touches anything, so the page owes
       him two things on every paint: the number it is holding back, and a way to see them that costs
       one tap. Without this the grid quietly shows 251 of 354 and looks complete — which is the exact
       failure the mismatch line above was built to prevent, arriving through a different door. */
    if (state.hiddenByStatus > 0) {
      n.appendChild(document.createTextNode(' '));
      var hidden = el('span', 'ca-hidden', state.hiddenByStatus + ' hidden by the status filter.');
      n.appendChild(hidden);
      n.appendChild(document.createTextNode(' '));
      var show = el('button', 'ca-show-hidden', 'Show them');
      show.type = 'button';
      show.addEventListener('click', function () {
        var sel = document.getElementById('ca-status');
        sel.value = 'all';
        paint();
        // The button has just been repainted out of existence. Move focus somewhere real and
        // meaningful rather than letting it fall to the document body.
        sel.focus();
      });
      n.appendChild(show);
    }
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
        /* ⛔ NORMALISE THE STATUS ON ARRIVAL, exactly as the server does on the way out.
           Found by RENDERING, not by reasoning: `public/*` is live on save while `careerair.mjs`
           needs a restart, so between a deploy and a restart this page runs against an API that has
           no `status` field at all. `'st-' + undefined` is a class nobody styled, no <option>
           matches, and a failed write would then try to restore the control to `undefined`. One line
           makes the page correct in that window and in any other where a row arrives incomplete. */
        state.rows = (d.rows || []).map(function (r) {
          r.status = STATUS_LABEL[r.status] ? r.status : 'todo';
          return r;
        });
        state.dbCount = d.dbCount;
        state.countsAgree = d.countsAgree;
        state.tiers = d.tiers;
        state.statusCounts = d.statusCounts || null;
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
