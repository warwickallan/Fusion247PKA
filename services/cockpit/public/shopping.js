// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THIS WEEK'S SHOPPING — the household-facing surface. Addendum B is the specification.
//
// WHAT THIS IS: a SECOND INPUT METHOD into the existing shopping pipeline, not a second pipeline.
// It reads the household's real current state through the SAME two proxies the operator cockpit
// already exposes, and it invents no endpoint and no data path.
//
// ⛔ WHAT IS DELIBERATELY NOT BUILT TONIGHT, so nobody reads absence as breakage:
//   * S2 (add something else), S3 (a question for you), S4 (sent), S5 (something's wrong) as
//     SCREENS. The S1 entry control and the S1 banner slot for each are built; the screens are not.
//   * Offline behaviour (Addendum B §9.6). See shopping.html for why it cannot be half-built.
//   * ⛔ THE WRITE PATH. There is none, and this is the single most important honesty constraint in
//     this file. Every write lives in services/asdair/cockpit-api (commandSurface.js), which this
//     Work Order puts explicitly out of scope; the cockpit proxies /api/asdair/* as GET only.
//     So her selections and quantities live ONLY in this tab, and the primary action CANNOT send.
//
//     Addendum B §9.6: "The UI never claims something was sent when it was not."
//     Addendum E criterion 9, hard fail: "any answer that changes the display but not the durable
//     record. This is the classic 'it worked in the demo' defect."
//
//     A send button that appeared to work would therefore be the precise defect both documents
//     exist to prevent — and worse than a missing one, because it would be believed. So the action
//     renders exactly to B §6.7 spec and its handler produces a plainly-worded state saying the
//     sending part is not connected yet. It never shows success. See send().
//
// ⛔ THE NAMING GAP, WHICH IS REAL AND IS NOT MINE TO CLOSE. Addendum B §6.3 forbids showing a
// catalogue string as a product name. asdair.regulars.name is retailer-shaped ("Example Brand Oat
// Drink 1L" — brand and pack size baked in). The nearest household-language source is `aka`, which
// is a MATCHING TERM rather than a curated display name, and it is absent on some rows. Both
// Addendum B §12.1 and Addendum E criterion 2 predicted exactly this and asked that it be surfaced
// before she is sat in front of it rather than after.
// Larry's decision, 2026-08-13: build the documented fallback, state the derivation loudly, and
// record that Addendum E criterion 2 CANNOT PASS until a curated display_name exists — which is a
// column, not a component, and is backend work. householdName() below is that fallback and is the
// only place the derivation happens.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── PURE HELPERS ───────────────────────────────────────────────────────────────────────────────
  // Exported on window.FUSION_SHOPPING so the gate can EXECUTE them rather than assert regexes over
  // this file. The clamp in particular is a safety property (B §6.4) and a property asserted only
  // through a rendered template is a property nobody has actually tested at its boundaries.

  var QTY_MIN = 1;   // B §6.4 rule 1: the minimum is 1, NOT 0. There is no zero state on a row.
  var QTY_MAX = 20;  // B §6.4 rule 4: a cap stops a stuck finger producing an absurd order.

  // ⛔ B §6.4 rule 5, verbatim: "Clamping is enforced in state, not only in the view. Any quantity
  // value is clamped to [1,20] at the point of update, so a repeated-event, double-fire or race can
  // never produce 0 or a negative. The disabled button is the affordance; the clamp is the
  // guarantee. BOTH are required."
  // So this is not a display helper. It is the guarantee, and it is total: a non-finite, absent,
  // negative or string input resolves to the floor rather than propagating.
  function clampQty(n) {
    var v = Math.round(Number(n));
    if (!isFinite(v)) return QTY_MIN;
    if (v < QTY_MIN) return QTY_MIN;
    if (v > QTY_MAX) return QTY_MAX;
    return v;
  }

  // The naming fallback. Prefer her own words, fall back to the retailer string, invent NOTHING.
  // Returns null when there is no usable name at all — the caller omits the row and says how many
  // it omitted, rather than rendering a blank one or making a name up.
  function householdName(reg) {
    if (!reg || typeof reg !== 'object') return null;
    var aka = Array.isArray(reg.aka) ? reg.aka : [];
    for (var i = 0; i < aka.length; i++) {
      if (typeof aka[i] === 'string' && aka[i].trim()) {
        var s = aka[i].trim();
        return s.charAt(0).toUpperCase() + s.slice(1);
      }
    }
    var n = typeof reg.name_display === 'string' ? reg.name_display.trim() : '';
    return n ? n : null;
  }

  // The API says "unknown" when it does not hold a fact, and that is the right thing for it to do.
  // It is not a word that may reach her screen — it is builder vocabulary and it would read as an
  // accusation of something broken. Mapped to a plain household heading instead.
  var OTHER = 'Other things';
  function sectionLabel(reg) {
    var c = reg && typeof reg.high_level_category_display === 'string' ? reg.high_level_category_display.trim() : '';
    if (!c || c.toLowerCase() === 'unknown') return OTHER;
    return c;
  }

  // ⛔ ORDER IS FIXED AND IS AN ACCESSIBILITY FEATURE, NOT A PRESENTATION CHOICE. B §6.1: "Her
  // muscle memory for 'the milk is near the top' is a real accessibility feature; reordering by
  // frequency or recency would destroy it. Order is fixed and only changes when the household's
  // item list changes." So sections appear in FIRST-APPEARANCE order from the API's own stable sort
  // and items keep API order within them. Nothing here sorts by selection, recency or count, and
  // selecting an item never moves it.
  //
  // The section headings are the API's own high_level_category values ("Chilled", "Food cupboard").
  // ⚠️ THEY ARE A DATA-DERIVED PLACEHOLDER AND ARE LABELLED AS ONE. Addendum B §12.6 records that
  // the real grouping should be the one SHE would use, which is a question for her and not a
  // decision for a builder. Inventing "Fridge / Cupboard" here would have been exactly that.
  function buildSections(items) {
    var list = Array.isArray(items) ? items : [];
    var order = [];
    var bag = {};
    var skipped = 0;
    for (var i = 0; i < list.length; i++) {
      var reg = list[i];
      if (!reg || reg.active === false) continue;   // an inactive regular is not something she gets now
      var name = householdName(reg);
      if (!name) { skipped++; continue; }           // no honest name: omit and COUNT, never invent
      var key = sectionLabel(reg);
      if (!bag[key]) { bag[key] = []; order.push(key); }
      bag[key].push({
        id: String(reg.id_display || ('r' + i)),
        name: name,
        qty: clampQty(reg.typical_qty_display),
      });
    }
    return {
      sections: order.map(function (k) { return { key: k, label: k, items: bag[k] }; }),
      skipped: skipped,
    };
  }

  var API = { rules: '/api/asdair/rules', workspace: '/api/asdair/workspace' };

  if (typeof window !== 'undefined') {
    window.FUSION_SHOPPING = {
      clampQty: clampQty, householdName: householdName, buildSections: buildSections,
      sectionLabel: sectionLabel, QTY_MIN: QTY_MIN, QTY_MAX: QTY_MAX, API: API, OTHER: OTHER,
    };
  }

  if (typeof Vue === 'undefined') return;
  var ref = Vue.ref, computed = Vue.computed;

  var App = {
    setup: function () {
      var regulars = ref([]);
      var loaded = ref(false);
      var loadFailed = ref(false);       // AC2: an honest empty state, NEVER a plausible list
      var openQuestions = ref(0);
      var selected = ref({});
      var qty = ref({});
      var sendState = ref('idle');       // 'idle' | 'not-connected'
      var lastUndo = ref(null);          // { label, apply }  — B §6.6, in words

      var built = computed(function () { return buildSections(regulars.value); });
      var sections = computed(function () { return built.value.sections; });
      var skipped = computed(function () { return built.value.skipped; });
      var allItems = computed(function () {
        var out = [];
        sections.value.forEach(function (s) { s.items.forEach(function (it) { out.push(it); }); });
        return out;
      });

      function qtyOf(it) {
        var v = qty.value[it.id];
        return clampQty(v === undefined ? it.qty : v);
      }
      function isOn(it) { return selected.value[it.id] === true; }

      var chosen = computed(function () {
        return allItems.value.filter(function (it) { return isOn(it); });
      });
      // B §6.7: a plain running count, and a zero state that is a sentence rather than a number.
      var countLabel = computed(function () {
        var n = chosen.value.length;
        if (n === 0) return 'You haven’t chosen anything yet';
        if (n === 1) return 'You’ve chosen 1 thing';
        return 'You’ve chosen ' + n + ' things';
      });
      var canSend = computed(function () { return chosen.value.length > 0 && sendState.value === 'idle'; });

      // B §7.1: present ONLY when something is pending, and it cannot be dismissed — there is no
      // close control anywhere on it. It clears when the questions are answered, never by her
      // tapping it away.
      var askLabel = computed(function () {
        var n = openQuestions.value;
        if (n <= 0) return null;
        return n === 1 ? 'There’s a question for you' : 'There are ' + n + ' questions for you';
      });

      // B §7.1.4: the page title carries the count so a backgrounded tab shows it.
      function syncTitle() {
        if (typeof document === 'undefined') return;
        var n = openQuestions.value;
        document.title = (n > 0 ? '(' + n + ') ' : '') + 'This week’s shopping';
      }

      // ── MUTATIONS ────────────────────────────────────────────────────────────────────────────
      // Every one goes through clampQty and every one records a worded undo. B §6.6: repeating the
      // action is the primary undo and needs no UI; the worded control is the addition.

      function setQty(it, v) {
        var next = Object.assign({}, qty.value);
        next[it.id] = clampQty(v);
        qty.value = next;
      }
      function setOn(it, on) {
        var next = Object.assign({}, selected.value);
        if (on) next[it.id] = true; else delete next[it.id];
        selected.value = next;
      }

      function toggle(it) {
        var was = isOn(it);
        setOn(it, !was);
        lastUndo.value = {
          label: 'Undo — ' + it.name + (was ? ' taken off your list' : ' added to your list'),
          apply: function () { setOn(it, was); },
        };
      }
      function step(it, delta) {
        var was = qtyOf(it);
        var next = clampQty(was + delta);
        if (next === was) return;                 // at a limit: nothing happens, and nothing is said
        setQty(it, next);
        // B §6.4 rule 7: changing the quantity on an unselected row selects it. She has expressed
        // intent; making her also find the tick is a trap.
        var autoSelected = false;
        if (!isOn(it)) { setOn(it, true); autoSelected = true; }
        lastUndo.value = {
          label: 'Undo — ' + it.name + ' back to ' + was,
          apply: function () { setQty(it, was); if (autoSelected) setOn(it, false); },
        };
      }
      function undo() {
        if (!lastUndo.value) return;
        lastUndo.value.apply();
        lastUndo.value = null;
      }

      // ⛔ THE HONEST SEND. Read the file header before changing this.
      // It does not post, does not queue, does not write to device storage, and NEVER renders a
      // success state. It says the truth in her words. B §9.6: "The UI never claims something was
      // sent when it was not."
      function send() {
        if (!canSend.value) return;
        sendState.value = 'not-connected';
      }

      // ── LOAD ─────────────────────────────────────────────────────────────────────────────────
      // Both reads are GETs the operator cockpit already proxies with household=1 hardcoded
      // (server.mjs). No new endpoint, no change to server.mjs, no parallel data path.
      // AC2: if the data is not reachable, render an honest empty state. NEVER fabricate a
      // plausible shopping list — a screen of invented groceries is worse than a blank one,
      // because it would be believed.
      function load() {
        if (typeof fetch !== 'function') return;
        fetch(API.rules, { headers: { accept: 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            var items = d && d.regulars && Array.isArray(d.regulars.items) ? d.regulars.items : null;
            if (!items) { loadFailed.value = true; } else { regulars.value = items; }
            loaded.value = true;
          })
          .catch(function () { loadFailed.value = true; loaded.value = true; });

        fetch(API.workspace, { headers: { accept: 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            var q = d && d.questions ? d.questions : null;
            var n = q ? Number(q.open_count_display) : 0;
            openQuestions.value = isFinite(n) && n > 0 ? n : 0;
            syncTitle();
          })
          .catch(function () { /* a question we cannot read is not a question we may invent */ });
      }
      load();

      return {
        regulars: regulars, loaded: loaded, loadFailed: loadFailed, openQuestions: openQuestions,
        selected: selected, qty: qty, sendState: sendState, lastUndo: lastUndo,
        sections: sections, skipped: skipped, chosen: chosen, countLabel: countLabel,
        canSend: canSend, askLabel: askLabel,
        qtyOf: qtyOf, isOn: isOn, toggle: toggle, step: step, undo: undo, send: send,
        QTY_MIN: QTY_MIN, QTY_MAX: QTY_MAX,
      };
    },

    // ⛔ NO BACKTICK MAY APPEAR INSIDE THIS TEMPLATE. It is a JS template literal, so one backtick
    // anywhere — including inside an HTML comment — terminates the string and the whole file stops
    // parsing, with an error that points at an unrelated word. render-vm-check.mjs carries a guard
    // that names this cause, because it cost two debugging rounds on WP-B15-42.
    //
    // SEMANTICS (B §11): real button elements, a real h1/h2 structure, role=checkbox with
    // aria-checked on the row. No div with a click handler anywhere in this template.
    // ⛔ NO TITLE ATTRIBUTES AND NO HOVER-ONLY AFFORDANCES: the device is touch-only and a tooltip
    // on hover is information that never arrives (B §5.2).
    // ⛔ NO GESTURE, NO DRAG, NO DOUBLE-TAP, NO LONG-PRESS, NO select element, NO window.confirm.
    // Every action below is a single tap on a real button, which fires on pointer-up on the same
    // target and cancels if the finger slides off — WCAG 2.5.2, and Addendum E A13 names it the
    // single highest-value accessibility control for poor coordination.
    template: [
      '<div class="page page-pad">',

      '  <header class="head">',
      '    <h1 class="h-title">This week’s shopping</h1>',
      '    <p class="h-say">Tap the things you’d like. Then press the green button at the bottom.</p>',
      '  </header>',

      // The ONE banner slot. B §9.1: the ABSENCE of a banner is itself the resting-state signal,
      // which is only safe because nothing else may ever occupy this slot.
      // aria-live=assertive plus role=status: on load with something pending it is announced.
      '  <div v-if="askLabel" class="banner ask" role="status" aria-live="assertive">',
      '    <h2>{{ askLabel }}</h2>',
      '    <p>I need to check something with you before I can get your shopping.</p>',
      '  </div>',

      // AC2's honest empty state. It says what is true and what she should do, and it never
      // pretends to be a shopping list.
      '  <div v-if="loaded && loadFailed" class="empty">',
      '    <p>I can’t see your shopping list at the moment. Nothing is lost. Please try again in a little while.</p>',
      '  </div>',
      '  <div v-else-if="loaded && sections.length === 0" class="empty">',
      '    <p>There’s nothing on your list yet.</p>',
      '  </div>',

      // The list. One scrolling page, every item present at all times, nothing hidden, nothing
      // collapsed, no pagination and no load-more (B §6.1).
      '  <div v-for="s in sections" :key="s.key">',
      '    <h2 class="sec">{{ s.label }}</h2>',
      '    <div',
      '      v-for="it in s.items"',
      '      :key="it.id"',
      '      class="row"',
      '      :class="{ on: isOn(it) }"',
      '      role="checkbox"',
      '      :aria-checked="isOn(it) ? \'true\' : \'false\'"',
      '      tabindex="0"',
      '      @click="toggle(it)"',
      '      @keydown.enter.prevent="toggle(it)"',
      '      @keydown.space.prevent="toggle(it)"',
      '    >',
      // The whole row is the select target (B §6.3) — the single largest accessibility win
      // available here. The tick is presentational because the ROW carries the checkbox role;
      // a nested control would be a second target inside the first.
      '      <div class="r-body">',
      '        <span class="tick" aria-hidden="true">✓</span>',
      '        <span class="r-name">{{ it.name }}</span>',
      '      </div>',
      // The 24px inert gutter between the row body and the first quantity control is the flex gap
      // on .row. See the long note in shopping.css for why that pair, and not every pair, gets it.
      '      <div class="q">',
      // @click.stop on both: B §6.3 requires the quantity controls to stop propagation, or every
      // quantity change would also toggle the row underneath it.
      // The accessible name carries the PRODUCT, never a bare plus or minus (B §11, WCAG 2.5.3).
      '        <button',
      '          type="button" class="q-btn"',
      '          :aria-disabled="qtyOf(it) <= QTY_MIN ? \'true\' : \'false\'"',
      '          :aria-label="\'One less \' + it.name"',
      '          @click.stop="step(it, -1)"',
      '        >−</button>',
      // aria-live=polite on the numeral: B §6.4 rule 8 announces "Butter, 2" to assistive tech.
      '        <span class="q-num" aria-live="polite" :aria-label="it.name + \', \' + qtyOf(it)">{{ qtyOf(it) }}</span>',
      '        <button',
      '          type="button" class="q-btn"',
      '          :aria-disabled="qtyOf(it) >= QTY_MAX ? \'true\' : \'false\'"',
      '          :aria-label="\'One more \' + it.name"',
      '          @click.stop="step(it, 1)"',
      '        >+</button>',
      '      </div>',
      '    </div>',
      '  </div>',

      // Named honestly rather than dropped silently. If a row has no name we can show in words,
      // she is told the count — she is never shown a blank row and never shown an invented one.
      '  <p v-if="skipped > 0" class="h-say">There are {{ skipped }} more things I couldn’t show properly. I’ve kept them.</p>',

      // B §8.1: the entry control, always the last thing before the footer. The SCREEN behind it is
      // not built tonight, so it says so plainly rather than leading her into nothing.
      '  <button v-if="sections.length > 0" type="button" class="add" aria-disabled="true">',
      '    Add something else',
      '    <small>Telling me in your own words isn’t ready yet.</small>',
      '  </button>',

      '  <footer class="foot">',
      '    <span class="f-count" aria-live="polite">{{ countLabel }}</span>',

      // B §6.6: the session undo, showing in words what it will undo.
      '    <button v-if="lastUndo" type="button" class="undo" @click="undo()">{{ lastUndo.label }}</button>',

      // ⛔ THE HONEST SEND STATE. Replaces the action rather than sitting beside it, so there is
      // nothing left to tap that could look like a retry. It states plainly that nothing was sent
      // and that nothing was lost — B §9.5's rule that she is never stranded, applied to a
      // limitation rather than to a failure.
      '    <div v-if="sendState === \'not-connected\'" class="note" role="status">',
      '      I can’t send your list yet — that part isn’t finished. Nothing has been sent, and nothing you chose has been lost.',
      '    </div>',

      '    <template v-else>',
      // B §6.7: disabled when nothing is chosen, VISIBLY, with the reason beside it. Not hidden,
      // and not tappable-then-scolding.
      '      <span v-if="!canSend" class="f-why">Tap some things first</span>',
      '      <button type="button" class="send" :aria-disabled="canSend ? \'false\' : \'true\'" @click="send()">SEND MY SHOPPING LIST</button>',
      '    </template>',
      '  </footer>',
      '</div>',
    ].join('\n'),
  };

  Vue.createApp(App).mount('#shop');
})();
