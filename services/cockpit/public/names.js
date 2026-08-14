// ═════════════════════════════════════════════════════════════════════════════════════════════════
// WARWICK'S DISPLAY-NAME EDITOR (WP-B15-52 AC3)
//
// He sets the household word Mum reads on her tile. One field, one product, one save.
//
// ⛔ display_name IS PRESENTATION ONLY. Warwick's ruling, verbatim: "it must never feed display_name
// into catalogue resolution or mutate matching behaviour." This file therefore does exactly one
// write — POST /api/asdair/display-name { id, display_name } — and that route writes exactly one
// column of one row. Nothing here touches `aka`, nothing here resolves anything, and nothing here
// sends a name to any surface that decides what a written line means. The duplicate sense-check
// against display names is WP-B15-53's and lives in the matcher, not in this page.
//
// ⛔ `aka` IS NEVER SHOWN AND NEVER EDITABLE HERE. It arrives in the payload — the rulebook route
// carries it because the operator's rulebook screen legitimately shows learned aliases — and this
// page reads past it. `aka` is a MATCHING TERM: editing it would change what resolves to what,
// which is the precise behaviour display_name exists to leave alone.
//
// ⛔ THIS IS A HOBBY TOOL AND IS BUILT LIKE ONE. Warwick, on this build: "mate it's fine. this isn't
// enterprise level saas! there's only me and mum using it, don't go mental with the edge cases!"
// So: no optimistic UI, no undo stack, no autosave debouncing, no offline queue, no dirty-navigation
// guard. Type it, tap Save, see that it saved. If it failed, the message says so and the words he
// typed are still in the box — he can tap Save again or retype. That is the whole recovery story and
// it is deliberately the whole of it.
//
// ⛔ NOT LINKED TO OR FROM MUM'S PAGE. See the long note in names.html.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var API_RULES = '/api/asdair/rules';
  var API_SAVE = '/api/asdair/display-name';

  // The server's own limit (displayName.js MAX_DISPLAY_NAME). Mirrored here ONLY to give him a
  // character count while typing — the server still validates, and its refusal is what the row
  // reports. A client-side limit that silently truncated would put words on Mum's tile that nobody
  // chose, which is exactly what the route refuses to do.
  var MAX_DISPLAY_NAME = 60;

  // ── THE 11 DECISIONS ───────────────────────────────────────────────────────────────────────────
  // Source: Deliverables/2026-08-13-mum-display-names-DECISIONS.md. 21 rows in 11 decisions, because
  // a collision is one decision covering two or three rows. The other 34 proposed names were
  // approved by default on Warwick's own instruction and carry no note.
  //
  // These are rendered ON THE ROW rather than in a separate screen, because the question is always
  // "what should THIS one be called", and answering it in a list you have to hold in your head is
  // how a name gets set to something that collides with the row two screens up.
  var DECISIONS = {
    18: ['Three Sure deodorants (18, 25, 54)', 'They differ only by variant. "Deodorant" three times is unusable. Does she distinguish them at all, or is one simply "deodorant" and the others rarely bought?'],
    25: ['Three Sure deodorants (18, 25, 54)', 'They differ only by variant. "Deodorant" three times is unusable. Does she distinguish them at all, or is one simply "deodorant" and the others rarely bought?'],
    54: ['Three Sure deodorants (18, 25, 54)', 'They differ only by variant. "Deodorant" three times is unusable. Does she distinguish them at all, or is one simply "deodorant" and the others rarely bought?'],
    33: ['Three toffee products (33, 49, 78)', '78 is a dessert, not a sweet. If she calls it "the cheesecakes", the word "toffee" may only confuse the three.'],
    49: ['Three toffee products (33, 49, 78)', '78 is a dessert, not a sweet. If she calls it "the cheesecakes", the word "toffee" may only confuse the three.'],
    78: ['Three toffee products (33, 49, 78)', '78 is a dessert, not a sweet. If she calls it "the cheesecakes", the word "toffee" may only confuse the three.'],
    27: ['Two boxes of eggs (27, 32)', 'Does she ever want the 6? If not, one row called "Eggs" is kinder than two.'],
    32: ['Two boxes of eggs (27, 32)', 'Does she ever want the 6? If not, one row called "Eggs" is kinder than two.'],
    43: ['Two Vanish products (43, 62)', '"Powder" and "gel" is my distinction, not necessarily hers.'],
    62: ['Two Vanish products (43, 62)', '"Powder" and "gel" is my distinction, not necessarily hers.'],
    30: ['Two Febreze products (30, 44)', 'Genuinely different jobs, but "Febreze" may be the only word she uses for both.'],
    44: ['Two Febreze products (30, 44)', 'Genuinely different jobs, but "Febreze" may be the only word she uses for both.'],
    80: ['Two beef slices (80, 81)', 'Both are sliced topside at 90g. The difference may be invisible to her.'],
    81: ['Two beef slices (80, 81)', 'Both are sliced topside at 90g. The difference may be invisible to her.'],
    75: ['Two Batchelors sachets (75, 77)', 'The second is long. "Chicken pasta" may be what she says.'],
    77: ['Two Batchelors sachets (75, 77)', 'The second is long. "Chicken pasta" may be what she says.'],
    79: ['Two baked-bean products (79, 63)', 'Confirm 63 is the beans-with-sausages tin and not something she would also call "beans".'],
    63: ['Two baked-bean products (79, 63)', 'Confirm 63 is the beans-with-sausages tin and not something she would also call "beans".'],
    69: ['BOB milk (69)', '"Milk" is already an alias on the Cravendale. If she says "milk" for this one too, they collide — and this is the product the BOB ruling turns on, so it matters more than most.'],
    31: ['Cat litter (31)', 'I guessed "cat". I do not actually know there is a cat.'],
    51: ['Row 51 — yours alone', 'Whatever she calls these. The plainest word I can propose is proposed, and I will not argue for it. It is not a word for anyone else to choose, and it will appear on a screen she looks at every week.'],
  };

  // P.text() renders an absent string as the literal word "unknown" (present.js). On this page that
  // would be read as a catalogue name, so the same guard shopping.js uses applies here.
  function realText(v) {
    var s = typeof v === 'string' ? v.trim() : '';
    return !s || s.toLowerCase() === 'unknown' ? '' : s;
  }

  if (typeof window !== 'undefined') {
    window.FUSION_NAMES = { DECISIONS: DECISIONS, realText: realText, MAX_DISPLAY_NAME: MAX_DISPLAY_NAME };
  }

  if (typeof Vue === 'undefined') return;
  var ref = Vue.ref, computed = Vue.computed;

  var App = {
    setup: function () {
      var rows = ref([]);
      var loaded = ref(false);
      var loadFailed = ref(false);
      var filter = ref('');
      var flaggedOnly = ref(false);

      // ⛔ AN HONEST EMPTY STATE, NEVER AN INVENTED LIST. If the rulebook cannot be read, this page
      // says so. A page of plausible-looking product names would be believed and edited.
      function load() {
        if (typeof fetch !== 'function') return;
        fetch(API_RULES, { headers: { accept: 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            var items = d && d.regulars && Array.isArray(d.regulars.items) ? d.regulars.items : null;
            if (!items) { loadFailed.value = true; loaded.value = true; return; }
            rows.value = items
              // Only the ACTIVE catalogue. An inactive regular is not something Mum is offered, so
              // naming it is work that changes nothing on her screen.
              .filter(function (r) { return r.active !== false; })
              .map(function (r) {
                var id = String(r.id_display);
                // `display_name` arrives RAW AND NULLABLE (WP-B15-53) precisely so that "not set" is
                // distinguishable from "set to something". '' in the box means not set.
                var saved = typeof r.display_name === 'string' ? r.display_name : '';
                var d = DECISIONS[id] || null;
                return {
                  id: id,
                  name: realText(r.name_display),
                  saved: saved,
                  value: saved,
                  state: 'idle',          // idle | saving | saved | failed
                  message: '',
                  group: d ? d[0] : '',
                  why: d ? d[1] : '',
                };
              });
            loaded.value = true;
          })
          .catch(function () { loadFailed.value = true; loaded.value = true; });
      }
      load();

      function isDirty(row) { return row.value.trim() !== row.saved.trim(); }
      function tooLong(row) { return row.value.trim().length > MAX_DISPLAY_NAME; }

      // ⛔ THE ONE WRITE. No optimistic update: `saved` moves only when the SERVER says what it
      // stored, and it is set from the server's echoed value rather than from what we sent, so a
      // server-side trim is reflected rather than assumed.
      function save(row) {
        if (row.state === 'saving') return;
        row.state = 'saving';
        row.message = '';
        var trimmed = row.value.trim();
        fetch(API_SAVE, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          // Clearing the field sends null, which is how the route spells "no display name". An
          // empty string would too (it normalises to null), but saying it explicitly means the
          // request states the intention rather than relying on the server to infer it.
          body: JSON.stringify({ id: Number(row.id), display_name: trimmed === '' ? null : trimmed }),
        })
          .then(function (r) { return r.text().then(function (t) { return { httpOk: r.ok, text: t }; }); })
          .then(function (res) {
            var body = null;
            try { body = JSON.parse(res.text); } catch (e) { body = null; }
            if (!res.httpOk || !body || body.ok !== true) {
              row.state = 'failed';
              // The server's own sentence when it has one — it is written for him and says which of
              // his inputs it refused. Never a status code on its own.
              row.message = (body && typeof body.message === 'string' && body.message)
                ? body.message
                : 'That did not save. Nothing was changed.';
              return;
            }
            row.saved = typeof body.display_name === 'string' ? body.display_name : '';
            row.value = row.saved;
            row.state = 'saved';
            row.message = row.saved === '' ? 'Cleared. Mum now sees the ASDA name.' : 'Saved.';
          })
          .catch(function (e) {
            row.state = 'failed';
            row.message = 'I could not reach the cockpit to save that — ' + (e && e.message ? e.message : 'no connection') + '. Nothing was changed.';
          });
      }

      // Typing again after a result clears the result, so a green "Saved." can never sit beside text
      // that has since been changed and not saved.
      function touch(row) {
        if (row.state === 'saved' || row.state === 'failed') { row.state = 'idle'; row.message = ''; }
      }

      var shown = computed(function () {
        var q = filter.value.trim().toLowerCase();
        return rows.value.filter(function (r) {
          if (flaggedOnly.value && !r.group) return false;
          if (!q) return true;
          return r.name.toLowerCase().indexOf(q) !== -1
            || r.value.toLowerCase().indexOf(q) !== -1
            || r.id === q;
        });
      });

      var flaggedCount = computed(function () {
        return rows.value.filter(function (r) { return !!r.group; }).length;
      });
      var namedCount = computed(function () {
        return rows.value.filter(function (r) { return r.saved.trim() !== ''; }).length;
      });

      return {
        rows: rows, shown: shown, loaded: loaded, loadFailed: loadFailed,
        filter: filter, flaggedOnly: flaggedOnly,
        flaggedCount: flaggedCount, namedCount: namedCount,
        isDirty: isDirty, tooLong: tooLong, save: save, touch: touch,
        MAX_DISPLAY_NAME: MAX_DISPLAY_NAME,
      };
    },

    // The template is an array of single-quoted strings, joined — NOT a template literal — for the
    // same reason shopping.js's is: one backtick anywhere inside a backtick-delimited template ends
    // the string and the file stops parsing at an unrelated word.
    template: [
      '<div class="nm">',
      '  <header class="nm-head">',
      '    <h1>Display names</h1>',
      '    <p class="nm-sub">The word Mum reads on her tile. The ASDA listing underneath is what it actually is.</p>',
      '  </header>',

      '  <div v-if="loaded && loadFailed" class="nm-empty">',
      '    <p><strong>I can’t read the catalogue at the moment.</strong> Nothing has been changed. Try again shortly.</p>',
      '  </div>',

      '  <template v-else-if="loaded">',
      '    <div class="nm-tools">',
      '      <label class="nm-field">',
      '        <span class="nm-label">Find a product</span>',
      '        <input type="search" class="nm-search" v-model="filter" placeholder="Type part of a name" autocomplete="off" />',
      '      </label>',
      // One toggle, not a filter bar. The 11 flagged rows are the actual job of this page, and
      // hunting them out of 109 on a phone is the difference between doing it and not.
      '      <label class="nm-toggle">',
      '        <input type="checkbox" v-model="flaggedOnly" />',
      '        <span>Only the {{ flaggedCount }} to decide</span>',
      '      </label>',
      '      <p class="nm-count">{{ namedCount }} of {{ rows.length }} named · showing {{ shown.length }}</p>',
      '    </div>',

      '    <p v-if="shown.length === 0" class="nm-empty"><strong>Nothing matches that.</strong></p>',

      '    <div v-for="r in shown" :key="r.id" class="nm-row" :class="{ flagged: !!r.group }">',
      // The flag comes FIRST because it is the reason the row needs him, and a reason that appears
      // after the field is a reason he reads after deciding.
      '      <div v-if="r.group" class="nm-flag">',
      '        <strong>{{ r.group }}</strong>',
      '        <span>{{ r.why }}</span>',
      '      </div>',
      // The ASDA listing: read-only, and the only place on this surface the full catalogue string is
      // shown without truncation. It is what the product IS.
      '      <p class="nm-asda">{{ r.name }}</p>',
      '      <label class="nm-field">',
      '        <span class="nm-label">What Mum reads <span class="nm-id">#{{ r.id }}</span></span>',
      '        <input',
      '          type="text"',
      '          class="nm-input"',
      '          v-model="r.value"',
      '          @input="touch(r)"',
      '          :maxlength="MAX_DISPLAY_NAME + 20"',
      '          :aria-label="\'What Mum reads for \' + r.name"',
      '          autocomplete="off"',
      '        />',
      '      </label>',
      '      <div class="nm-act">',
      '        <button',
      '          type="button"',
      '          class="nm-save"',
      '          :disabled="r.state === \'saving\' || !isDirty(r) || tooLong(r)"',
      '          :aria-label="\'Save what Mum reads for \' + r.name"',
      '          @click="save(r)"',
      '        >{{ r.state === \'saving\' ? \'Saving…\' : \'Save\' }}</button>',
      // ⛔ ORDER IS LOAD-BEARING AND WAS WRONG FIRST TIME. The empty-field hint used to come first,
      // which meant that CLEARING a name showed "Not named — Mum sees the ASDA listing." instead of
      // the confirmation that the clear had been saved. He would have had no way to tell whether the
      // save happened at all — the row looks identical before and after. names-check.mjs caught it.
      // An OUTCOME always outranks a hint: what just happened is more urgent than what is generally
      // true, and the hint is still there on the next load.
      '        <span v-if="tooLong(r)" class="nm-msg fail">{{ r.value.trim().length }} characters; the limit is {{ MAX_DISPLAY_NAME }}.</span>',
      '        <span v-else-if="r.state === \'saved\'" class="nm-msg ok">{{ r.message }}</span>',
      '        <span v-else-if="r.state === \'failed\'" class="nm-msg fail">{{ r.message }}</span>',
      '        <span v-else-if="isDirty(r)" class="nm-msg warn">Not saved yet.</span>',
      // Empty-field guidance, stated plainly rather than as a placeholder that vanishes on focus.
      '        <span v-else-if="!r.value.trim()" class="nm-hint">Not named — Mum sees the ASDA listing.</span>',
      '      </div>',
      '    </div>',
      '  </template>',
      '</div>',
    ].join(''),
  };

  Vue.createApp(App).mount('#names');
})();
