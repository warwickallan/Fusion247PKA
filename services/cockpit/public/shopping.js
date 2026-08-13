// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THIS WEEK'S SHOPPING — the household-facing surface. Addendum B is the specification.
//
// WHAT THIS IS: a SECOND INPUT METHOD into the existing shopping pipeline, not a second pipeline.
// It reads the household's real current state through the SAME two proxies the operator cockpit
// already exposes, and it invents no endpoint and no data path.
//
// ⛔ THE WRITE PATH NOW EXISTS, AND THE HONESTY CONSTRAINT THAT GUARDED ITS ABSENCE IS UNCHANGED.
//
// This block used to read "THE WRITE PATH. There is none", and that was true and load-bearing for
// exactly as long as it was true. WP-B15-49 connected the primary action to the route built under
// WP-B15-48 (POST /api/asdair/list). The comment is REPLACED rather than amended, because a comment
// that confidently describes the opposite of the code is worse than no comment — the next reader
// believes it, and this surface has already paid for that mistake once.
//
// ⛔ WHAT THE OLD COMMENT WAS PROTECTING. RESTATED, BECAUSE IT IS THE POINT AND IT DID NOT GO AWAY:
//
//     Addendum B §9.6: "The UI never claims something was sent when it was not."
//     Addendum E criterion 9, hard fail: "any answer that changes the display but not the durable
//     record. This is the classic 'it worked in the demo' defect."
//
// A send button that APPEARS to work is still the precise defect both documents exist to prevent,
// and still worse than a missing one because it would be believed. What changed is the MECHANISM
// that prevents it. It used to be prevented by there being no code at all. It is now prevented by a
// property, and that property is the whole of this Work Package:
//
//     ⛔ THE SENT STATE HAS EXACTLY ONE CAUSE. `sendState` becomes 'sent' at ONE assignment, inside
//     succeed(), reachable only when ALL THREE hold: the response was HTTP-ok, its body PARSED as
//     JSON, and that body carries `ok === true` AND `created === true`. There is no optimistic
//     path, no local fallback, no retry that assumes, no timer that resolves hopefully, no queue.
//     A network rejection, a 500, a 200 carrying ok:false, a 200 carrying HTML, and a timeout ALL
//     render NOT-SENT — proven by execution rather than asserted in a comment:
//         node services/cockpit/shopping-geometry-check.mjs --send-cases
//
//     ⛔ AND `ok:true` ALONE NEVER LICENSES THE WORD "SENT" — ROUTE CONTRACT v2, AMENDMENT 2.
//     `receiveList` is idempotent on (household_id, shop_ref) and `shop_ref` is 'SHOP-' + date, so
//     a SECOND submission on the same day resumes the existing shop and writes NOTHING durable —
//     no shop row, no command row, no event — and still answers ok:true. Telling her "sent" there
//     would be Addendum E criterion 9's exact defect: an answer that changes the display but not
//     the record. So `created` decides which truth she is told, and only `created === true` may
//     reach the sent state. `created === false` splits by `recorded_new` into one of two OTHER
//     states — see route contract v3 below — and a missing or non-boolean field always resolves to
//     the state that claims LEAST, because the safe direction of a contract violation is to say
//     less than happened, never more.
//
//     ⛔ DO NOT BRANCH ON `matched_by`. It carries the store's own vocabulary verbatim
//     ('insert' | 'shop_ref' | 'telegram_message' | 'superseded_terminal_ref') and exists to be
//     READ IN THE CONSOLE, not to drive her screen. `created` is the decision; a second branch on
//     a passed-through enum is where the two sides of this contract would drift apart.
//
// ⛔ SHE CONFIRMS BEFORE ANYTHING IS SENT (Warwick, 2026-08-13, his feature request):
// "when she hits SEND MY SHOPPING LIST I think app should then display todays date and confirm, so
// she cant submit by accident and also we will then get a date for the actual shop."
// So the flow is SEND -> CONFIRM -> POST, and the date she was shown is the date that is sent, as
// `list_date`. It is not decoration: receiveList takes listDate as a first-class input and derives
// the shop reference from it, so her confirmed date genuinely becomes the shop's date.
// The accident guard is STRUCTURAL, not a disabled attribute: in the confirm state there is no
// element with class `.send` on the page at all, and the control that does commit carries a
// different class, sits in a different place, and refuses unless sendState is exactly 'confirm'.
// A second tap on where SEND used to be therefore cannot reach it — which is the whole ask.
//
// ⛔ SHE CAN ADD THINGS IN HER OWN WORDS (Warwick, same day, overruling an earlier decision of
// Larry's to leave the control disabled): "Add something else doesnt work? If anything is added
// here it needs to sense check against existing regulars to ensure it is genuinely new."
// Her exact words ride on the submission as `extras` and are NEVER normalised, title-cased,
// spell-corrected or cleaned — the pipeline resolves identity downstream and her raw words are the
// evidence. The sense-check is POST /api/asdair/check-item.
//
//   ⛔⛔ AND THE RULE THAT GOVERNS THAT CHECK IS THE EASIEST THING IN THIS FILE TO GET WRONG:
//   MUM IS NEVER ASKED A QUESTION. Warwick: "I will deal with any questions and such through my
//   existing process." So the check is a friendly nudge and never an interrogation. A match tells
//   her warmly that she already has it AND KEEPS HER ITEM ANYWAY — she may know something the
//   catalogue does not. Anything unmatched or uncertain is accepted in silence. There is no
//   disambiguation, no candidate list, no "which one did you mean" on this surface, ever. And if
//   the check cannot be reached, HER ITEM IS STILL ADDED: a sense-check that blocks her input when
//   the server is away is worse than no sense-check at all.
//
// ⛔ WHAT IS STILL DELIBERATELY NOT BUILT, so nobody reads absence as breakage:
//   * S3 (a question for you) as a SCREEN. The S1 banner slot is built; the screen is not, and the
//     banner says so in her words rather than demanding something it cannot accept.
//   * The `note` field is GONE from the request (route contract v2, Amendment 3). Her free text
//     travels in `extras`, which is a real capability with a real input behind it.
//   * OFFLINE BEHAVIOUR (Addendum B §9.6) — still not built, and THE FAILED-SEND STATE BELOW IS NOT
//     IT. Nothing of hers is in the service worker's cache (shopping.html explains why), so a cold
//     load with no network never reaches this file at all: she gets the browser's own error page.
//     The failed state covers exactly one case — THE PAGE IS ALREADY OPEN AND THE SEND DOES NOT
//     ARRIVE — which is the case that actually happens, and is worth building. It is not offline
//     support and must never be reported as offline support. Queueing cannot be half-built.
//   * S4 AS A FULL SCREEN. Addendum B §9.3 describes S4 as "the full-screen version of this, shown
//     once immediately after sending". What is built is the IN-PAGE sent state: the footer's action
//     is REPLACED by the calm strip (§9.3), a full-size way back to editing sits beside it, and her
//     list stays visible and stays editable. The itemised full-screen summary is NOT built, and the
//     reason is measured rather than aesthetic — at 640x400 (a 1280x800 tablet at 200% zoom, her
//     device class) the chrome above the list already leaves ~11px of slack before the first row's
//     tick falls below the fold. A summary panel there displaces either the pending-question banner
//     (B §7.1.1) or her first tappable item (B §6.1), and both are asserted failures in
//     shopping-geometry-check.mjs. Recorded as a divergence from B §9.3, not silently taken.
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

  // The two GETs the operator cockpit already proxies, plus THE ONE WRITE. `list` is the route
  // contract frozen byte-identical in WP-B15-48; this page invents no endpoint and holds no second
  // client for it.
  var API = {
    rules: '/api/asdair/rules',
    workspace: '/api/asdair/workspace',
    list: '/api/asdair/list',
    check: '/api/asdair/check-item',
  };

  // Hardcoded exactly as the two reads already are (server.mjs pins household=1). Not a setting:
  // there is one household and a selector would be a control she can get wrong.
  var HOUSEHOLD = 1;

  // ⛔ ONE SOURCE FOR THE BANNER'S ELABORATION, BECAUSE IT NOW RENDERS AT TWO POINTS.
  // Warwick's ruling (2026-08-13) puts it after the list on the smallest screens, so the sentence
  // appears twice in the template. A duplicated literal is two sentences that drift apart; this is
  // ONE sentence rendered in two places.
  var ASK_MORE = 'I need to check something with you before I can get your shopping. '
    + 'I can’t ask you here just yet, so Warwick will sort this one out for you.';

  // ⛔ THE BREAKPOINT AT WHICH THE ELABORATION MOVES IN THE DOM — NOT IN CSS.
  // Warwick: "render it after the list at <=360px — in the DOM, not by CSS reordering. Visual order
  // and DOM order agree, 1.3.2 does not arise, and both halves of the ruling are literally true
  // rather than approximately true."
  // ⛔ KEYED TO EITHER AXIS, and that is not tidiness. The two failing viewports were 300x512
  // (narrow) and 512x300 (short). A width-only query fixes one and leaves the other — and the other
  // is HER DEVICE: Fire HD 8 landscape at 200% zoom, a setting an 84-year-old with poor eyesight
  // would plausibly choose, opening her shopping list to find no shopping on it.
  var ELABORATE_BELOW_MQ = '(max-width: 360px), (max-height: 360px)';

  // ⛔ HOW LONG SHE WAITS BEFORE BEING TOLD THE TRUTH. Felix's choice, named rather than buried:
  // the Work Order did not settle it. 15s is long enough for a slow household connection to a
  // tailnet host and short enough that a technology-phobic 84-year-old is not left watching a
  // screen that does nothing. A silent wait is the one outcome that is worse than a failure.
  var SEND_TIMEOUT_MS = 15000;

  // ⛔ SHORTER THAN THE SEND, AND THAT ASYMMETRY IS DELIBERATE. The sense-check is a NICETY: its
  // only possible outcome is a warm sentence she may ignore. Her item is already on the list before
  // this request is made, so the cost of giving up early is losing a nudge, and the cost of waiting
  // is an 84-year-old watching a screen. Those are not the same cost.
  var CHECK_TIMEOUT_MS = 8000;

  // The complete state set. Exported so a gate can assert against the real list rather than against
  // a string it hopes is still spelled the same way.
  // 'confirm' — she has pressed SEND and is being shown the date, before anything is posted.
  //
  // ⛔ FOUR SETTLED OUTCOMES. None of the three 'already-sent-*' states is a flavour of 'sent', and
  // none of them is a flavour of another. Each names a DIFFERENT thing that happened in the world:
  //   already-sent-noted     her change was recorded AND Warwick was actually notified
  //   already-sent-saved     her change was recorded and the notification DID NOT GET THROUGH
  //   already-sent-unchanged nothing was recorded, because nothing about her list had changed
  // Route contract v3 split the first from the third; AC7 split the first from the second, and that
  // split exists because the notification can fail while the submission still succeeds.
  var SEND_STATES = ['idle', 'confirm', 'sending', 'sent',
    'already-sent-noted', 'already-sent-saved', 'already-sent-unchanged', 'failed'];

  // ⛔ HER DATE, BUILT FROM LOCAL FIELDS — NEVER toISOString(). `new Date().toISOString()` is UTC,
  // so from 00:00 to 01:00 British Summer Time it names YESTERDAY. This value becomes the shop's
  // reference date, so an off-by-one here is a shop on the wrong day, silently.
  function localDate(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  // "Thursday 13 August" — what she reads to decide. Not a year (she does not need it to know
  // whether today is the day), and never an ISO string, which is a machine format she would have to
  // decode. Locale is pinned so the wording cannot change with a device setting.
  function humanDate(d) {
    try {
      return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) {
      return localDate(d);   // a browser without the locale data still gets a real date, not a crash
    }
  }

  if (typeof window !== 'undefined') {
    window.FUSION_SHOPPING = {
      clampQty: clampQty, householdName: householdName, buildSections: buildSections,
      sectionLabel: sectionLabel, QTY_MIN: QTY_MIN, QTY_MAX: QTY_MAX, API: API, OTHER: OTHER,
      HOUSEHOLD: HOUSEHOLD, SEND_TIMEOUT_MS: SEND_TIMEOUT_MS, SEND_STATES: SEND_STATES,
      CHECK_TIMEOUT_MS: CHECK_TIMEOUT_MS, localDate: localDate, humanDate: humanDate,
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
      var sendState = ref('idle');       // one of SEND_STATES. See send() for the ONE writer of 'sent'.
      var lastUndo = ref(null);          // { label, apply }  — B §6.6, in words

      // What the SERVER confirmed, never what the page hoped. Written only in accepted().
      var sentCount = ref(0);            // how many things the confirmed WRITE carried
      var hasSent = ref(false);          // a write genuinely happened this session (created:true)
      var changedSinceSent = ref(false); // ...and she has edited her list since it

      // ── HER OWN WORDS (S2) ───────────────────────────────────────────────────────────────────
      // Each entry is { id, text, note }. `text` is EXACTLY what she typed, untouched. `note` is
      // the warm nudge the sense-check may attach, or null. Nothing here is ever a question.
      var extras = ref([]);
      var nextExtraId = 1;
      var addOpen = ref(false);          // the input is revealed in place, not on a screen
      var draft = ref('');
      var addBusy = ref(false);          // one add at a time; never a reason to lose her words

      // The date she is shown on the confirm screen and the date that is POSTed. One value, so the
      // two can never disagree.
      var confirmDate = ref(null);       // 'YYYY-MM-DD'
      var confirmShown = ref('');        // 'Thursday 13 August'

      // Live, because she rotates the tablet and may change zoom. A one-shot read at load would put
      // the elaboration in the wrong place for the rest of the session after a single rotation.
      var elaborateBelow = ref(false);
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        var mq = window.matchMedia(ELABORATE_BELOW_MQ);
        elaborateBelow.value = !!mq.matches;
        var onMq = function (e) { elaborateBelow.value = !!e.matches; };
        // addListener is the deprecated form; Silk's age is not established (Addendum A), so both.
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMq);
        else if (typeof mq.addListener === 'function') mq.addListener(onMq);
      }

      // ══ HIGH-1, VERA — WHEN THE FOOTER GROWS, SHE IS ALREADY AT THE BOTTOM ═══════════════════
      //
      // ⛔ THE DEFECT, IN HER WORDS, BECAUSE THE ABSTRACT VERSION IS TOO EASY TO READ PAST.
      // Below 720px of viewport height this surface drops the footer to NORMAL FLOW on purpose, so
      // the primary action sits at the END of a scroll. She scrolls to the bottom to reach SEND.
      // Her tap then GROWS the footer by 72-275px — and because she is already at maximum scroll,
      // every one of those pixels appears BELOW THE FOLD. Nothing scrolls. Nothing moves. Nothing
      // tells her. Measured: at 800x500, 10px of an 88px "YES, SEND IT" painted and "No, not yet"
      // entirely off screen; at 1024x600 — her device, at NO ZOOM — the question itself cut off.
      // The same applies to "Add something else", which replaces a 110px control with a ~348px form.
      //
      // ⛔ AND WHY THE GATE COULD NOT SEE IT, which is the part worth carrying forward.
      // `outcomeVisible` measured at MAXIMUM SCROLL. She IS at maximum scroll — BEFORE the tap. The
      // tap grows the document, so maximum scroll MOVES and she does not. The gate then scrolled to
      // the NEW maximum and measured a place she is not standing. Right property, wrong moment —
      // the same class as the throttled-timer bug in shopping-geometry-check.mjs, and the second
      // time in this package that a correct-looking measurement was taken at the wrong instant.
      //
      // So every transition that changes what the footer contains brings the new thing INTO VIEW
      // and moves focus to it. This is not an animation and not a nicety: without it the surface
      // silently does nothing in response to her most important tap.
      function revealAfterTransition(containerSel, focusSel, align) {
        if (typeof document === 'undefined') return;
        if (!Vue || typeof Vue.nextTick !== 'function') return;
        // AFTER the re-render, or it would place the OLD layout.
        Vue.nextTick(function () {
          var el = document.querySelector(containerSel);
          if (!el) return;
          var target = focusSel ? document.querySelector(focusSel) : null;
          // Focus first, with the browser's own focus-scroll suppressed, then place the element
          // deliberately — otherwise the two fight and the alignment chosen below is overridden.
          if (target && typeof target.focus === 'function') {
            try { target.focus({ preventScroll: true }); } catch (e) {
              try { target.focus(); } catch (e2) { /* focus is best-effort, placement is not */ }
            }
          }
          // ⛔ ALIGNMENT IS ADAPTIVE, AND BOTTOM-ALIGNING UNCONDITIONALLY WAS WRONG.
          // `block:'end'` puts the strip's BOTTOM at the viewport's bottom. When the strip is
          // TALLER than the viewport — which it is at 300x512, a 600x1024 tablet at 200% zoom —
          // that pushes the message itself off the TOP: measured at 12px to 128px above the fold,
          // so she would have been shown two buttons and no question. When it cannot all fit, what
          // she must see first is what she is being asked, so it aligns to the START instead.
          var chosen = align || 'end';
          try {
            var box = el.getBoundingClientRect();
            var vh = window.innerHeight || 0;
            if (chosen === 'end' && vh && box.height > vh) chosen = 'start';
          } catch (e) { /* keep the requested alignment */ }
          if (typeof el.scrollIntoView === 'function') {
            try { el.scrollIntoView({ block: chosen }); } catch (e) { el.scrollIntoView(); }
          }
        });
      }
      // The footer's outcome/confirm strip. Focus goes to the STRIP, which carries tabindex="-1",
      // and NEVER to the control inside it: focusing "YES, SEND IT" would arm a commit under the
      // next Enter or Space, which is precisely the accident Warwick's confirm step exists to stop.
      var revealStrip = function () { revealAfterTransition('.f-state', '.f-state', 'end'); };
      // Returning to the resting footer. Focusing `.send` IS safe, and only because of the confirm
      // step: pressing it sends nothing, it opens the question.
      var revealAction = function () { revealAfterTransition('.foot', '.send', 'end'); };

      // ⛔ THE STATE GUARD, AND IT IS DELIBERATELY NOT A REF.
      // AC2, and B §6.4 rule 5's distinction applied to the primary action: "The disabled button is
      // the affordance; the clamp is the guarantee. BOTH are required." `canSend` below drives
      // aria-disabled and is the AFFORDANCE. This flag is the GUARANTEE, and it is a plain closure
      // variable precisely so it cannot be defeated by render timing — a reactive value is only as
      // synchronous as the framework's invalidation, and "two taps arrived in the same tick" is the
      // exact race a double-send is. Set before the first await, cleared only in settle().
      var inFlight = false;

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
      // Everything that would be sent: the regulars she ticked PLUS the things she typed. Once
      // "add something else" became real, a count of only the ticked rows was a wrong number on
      // screen and, worse, a disabled SEND for a woman who had just typed three things.
      var totalCount = computed(function () { return chosen.value.length + extras.value.length; });

      // B §6.7: a plain running count, and a zero state that is a sentence rather than a number.
      var countLabel = computed(function () {
        var n = totalCount.value;
        if (n === 0) return 'You haven’t chosen anything yet';
        if (n === 1) return 'You’ve chosen 1 thing';
        return 'You’ve chosen ' + n + ' things';
      });
      // THE AFFORDANCE ONLY. What she is allowed to see as tappable. The guarantee is `inFlight`
      // plus the state checks inside send() — never this.
      var canSend = computed(function () { return totalCount.value > 0 && sendState.value === 'idle'; });

      // B §6.7 requires the reason stated BESIDE the action, so the hint is state-aware rather than
      // a single fixed sentence. "Tap some things first" while she is mid-send would be nonsense,
      // and telling her nothing while a send is in flight is the silence B §9.6 forbids.
      var footHint = computed(function () {
        if (sendState.value === 'sending') return 'I’m sending your list now.';
        if (totalCount.value === 0) return 'Tap some things first';
        // ⛔ THE ONE SENTENCE THAT STOPS A CHANGED LIST LOOKING LIKE A SENT LIST. Her rows stay
        // editable after a send (B §9.3: the UI must not pretend to be locked when it isn't), so
        // the moment she edits, what is on screen is no longer what the server has. Saying nothing
        // here would let the screen imply the change went with it — Addendum E criterion 9 exactly.
        if (changedSinceSent.value) return 'You’ve changed your list since you sent it. Press SEND MY SHOPPING LIST again to send the change.';
        return null;
      });

      var sentCountLabel = computed(function () {
        return sentCount.value === 1 ? 'I’ve sent 1 thing.' : 'I’ve sent ' + sentCount.value + ' things.';
      });

      // What the confirm screen says she is about to send. Same arithmetic as the footer count, so
      // the two can never quote different numbers at her on adjacent screens.
      var confirmCountLabel = computed(function () {
        var n = totalCount.value;
        return n === 1 ? 'That’s 1 thing.' : 'That’s ' + n + ' things.';
      });

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

      // ⛔ EVERY MUTATION PASSES THROUGH HERE, AND THAT IS WHY THE HOOK LIVES HERE RATHER THAN ON
      // THE HANDLERS. B §9.3 keeps her rows editable after a send. The consequence is that the
      // screen can drift from what the server holds, and a footer still reading "Sent" over a list
      // she has since changed is the display-versus-record defect this whole package exists to
      // prevent. So an edit after a confirmed send does two things, always:
      //   1. drops the sent state back to editable — the truth is now "not sent", because THIS list
      //      has not been;
      //   2. raises the flag that footHint() turns into a plain sentence.
      // Placed on the two setters so a future handler cannot forget to call it.
      function touched() {
        // Both settled outcomes return to editable the moment she changes anything, so no outcome
        // strip is ever left sitting over a list it no longer describes.
        if (sendState.value === 'sent' || sendState.value === 'already-sent-noted'
          || sendState.value === 'already-sent-saved'
          || sendState.value === 'already-sent-unchanged') sendState.value = 'idle';
        // ...but only a REAL write (created:true) can make "you've changed it since you sent it"
        // a true sentence. After either 'already-sent-*' today's shop is unchanged, so there is
        // nothing for her change to have diverged FROM, and the hint stays silent.
        if (hasSent.value) changedSinceSent.value = true;
      }

      function setQty(it, v) {
        var next = Object.assign({}, qty.value);
        next[it.id] = clampQty(v);
        qty.value = next;
        touched();
      }
      function setOn(it, on) {
        var next = Object.assign({}, selected.value);
        if (on) next[it.id] = true; else delete next[it.id];
        selected.value = next;
        touched();
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

      // ⛔ THE HONEST SEND. READ THE FILE HEADER BEFORE CHANGING THIS.
      //
      // It posts her real selection to the real route and renders the outcome the SERVER reported.
      // It does not queue, does not write to device storage, and cannot render success on its own
      // authority. Every early return below is a state guarantee, not a tidiness check.
      // ⛔ STEP ONE OF TWO. THE PRIMARY ACTION NO LONGER SENDS ANYTHING (Warwick, 2026-08-13).
      // It shows her today's date and asks. Nothing leaves the page in this function.
      function askConfirm() {
        if (inFlight) return;
        // Reachable from the resting page AND from a failure — "Try again" is a retry of the whole
        // journey, confirm screen included. Never from 'confirm', 'sending' or a settled outcome.
        if (sendState.value !== 'idle' && sendState.value !== 'failed') return;
        if (totalCount.value === 0) return;
        var now = new Date();
        confirmDate.value = localDate(now);
        confirmShown.value = humanDate(now);
        sendState.value = 'confirm';
        revealStrip();   // HIGH-1: she is at the bottom; the question appears below it
      }

      // Her way out of the confirm, and it is a full-size control, not a small one.
      function cancelConfirm() {
        if (sendState.value !== 'confirm') return;
        sendState.value = 'idle';
        revealAction();
      }

      // ⛔ STEP TWO OF TWO — THE ONLY FUNCTION IN THIS FILE THAT POSTS HER LIST.
      function confirmSend() {
        // AC2's guarantee, and now also Warwick's accident guard. First line, before anything can
        // await, and independent of Vue.
        if (inFlight) return;
        // ⛔ THE STATE PRECONDITION IS THE ACCIDENT GUARD. This can be reached ONLY from the confirm
        // screen. A stray or repeated tap anywhere else — including on the element that used to be
        // SEND — cannot commit her list, because this returns immediately unless she is standing on
        // the screen that showed her the date.
        if (sendState.value !== 'confirm') return;

        // ⛔ RE-DERIVE THE DATE AND REFUSE TO SEND ONE SHE WAS NOT SHOWN. If the confirm screen has
        // been open across midnight, the date on it is yesterday's — and this value becomes the
        // shop's reference date. So the screen is silently corrected and she taps once more,
        // agreeing to the date that is actually going. Once, at midnight, and never wrong.
        var today = localDate(new Date());
        if (confirmDate.value !== today) {
          confirmDate.value = today;
          confirmShown.value = humanDate(new Date());
          return;
        }

        // Snapshot at the moment of sending. What is POSTed and what she is later told was sent are
        // then the same array, even if she edits the page while it is in flight.
        // `name` is the name SHE WAS SHOWN (householdName's output), per the route contract — never
        // the retailer catalogue string, which she has never seen.
        var items = chosen.value.map(function (it) {
          return { id: it.id, name: it.name, qty: qtyOf(it) };
        });
        // ⛔ HER EXACT WORDS. No trim beyond the one already applied when she added it, no case
        // change, no spelling correction, no de-duplication against the catalogue. The pipeline
        // resolves identity downstream; what she typed is evidence and is sent as evidence.
        var extraTexts = extras.value.map(function (e) { return e.text; });
        var total = items.length + extraTexts.length;
        if (total === 0) return;

        inFlight = true;
        sendState.value = 'sending';

        // ⛔ SETTLE ONCE. The timeout and the response are two racing writers of one outcome, and
        // without this a slow success arriving after the timeout would flip a screen that already
        // told her it had failed — a success state reached by a path that is not "the server said
        // ok", which is precisely what this Work Package forbids. Abort is best-effort on top;
        // correctness does not depend on AbortController existing, because Silk is not measured
        // here and a capability assumption is not a control.
        var settled = false;
        var timer = null;
        var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;

        function settle(fn) {
          if (settled) return;
          settled = true;
          if (timer) { clearTimeout(timer); timer = null; }
          inFlight = false;
          fn();
          // HIGH-1: every settled outcome replaces the action with a taller strip, and she is still
          // standing where the action was. One place, so no outcome path can forget it.
          revealStrip();
        }

        // ⛔⛔ THE ONLY WRITER OF THE SENT STATE IN THIS FILE. If you are adding a second one, stop.
        // The server accepted the request. That is NOT the same fact as "something was written",
        // and route contract v2 Amendment 2 exists because those two were conflated once already.
        function accepted(body) {
          settle(function () {
            // The machine detail goes HERE, where Larry can read it, and nowhere near her screen.
            // `matched_by` is passed through verbatim and is logged, never branched on.
            console.info('[shopping] server accepted', {
              shop_ref: body.shop_ref, shop_id: body.shop_id,
              created: body.created, recorded_new: body.recorded_new, matched_by: body.matched_by,
              // The machine detail about the notification goes HERE and only here. `notify_error`
              // is a machine code and never reaches her screen.
              notified: body.notified, notify_error: body.notify_error,
              list_date: confirmDate.value, items: items.length, extras: extraTexts.length,
            });
            // ⛔ STRICT `=== true` THROUGHOUT. A missing, null or non-boolean field is a contract
            // violation, and the safe direction of a contract violation is ALWAYS to claim LESS.
            //
            // Route contract v3, and the reason it exists: v2 could not tell an IDENTICAL re-send
            // (nothing written at all) from a CORRECTED one (a durable ledger row written, which
            // does not change today's shop). Both answer created:false, so both would have got the
            // same sentence — and one of those sentences would have been wrong. `recorded_new`
            // splits them, so she is told which of the three things actually happened.
            if (body.created !== true) {
              // ⛔ "I've told Warwick" IS A PROMISE ABOUT THE REAL WORLD, AND IT IS MADE ONLY WHEN
              // THE SERVER CONFIRMS BOTH HALVES OF IT.
              //
              // AC7, and it is the last honesty gap in the whole chain. A durable record being
              // written and Warwick actually HEARING about it are two different events, and the
              // second one can fail on its own — the route deliberately still answers ok:true when
              // it does, because her list is safe the moment it is recorded and a messaging outage
              // must never turn a saved shop into an error on her screen. That correct decision is
              // exactly what makes `recorded_new:true, notified:false` reachable, and it is the
              // state in which the old single sentence was a lie.
              if (body.recorded_new !== true) {
                sendState.value = 'already-sent-unchanged';
                return;
              }
              // ⛔ STRICT `=== true` AGAIN. A missing or non-boolean `notified` means she is told he
              // has NOT heard yet. The two errors are not symmetric: telling her to mention it when
              // he already knows costs one redundant sentence between them, and telling her he
              // knows when he does not means nobody ever finds out.
              sendState.value = (body.notified === true) ? 'already-sent-noted' : 'already-sent-saved';
              return;
            }
            sentCount.value = total;
            hasSent.value = true;
            changedSinceSent.value = false;
            sendState.value = 'sent';
          });
        }

        // B §10.2: no status code, no error code, no service name and no stack text may reach her.
        // `why` and `detail` are for the console only. Her sentence is fixed and lives in the
        // template, so there is no path by which a machine string can be interpolated into it.
        function fail(why, detail) {
          settle(function () {
            sendState.value = 'failed';
            console.warn('[shopping] SEND FAILED — ' + why, detail);
          });
        }

        timer = setTimeout(function () {
          if (ctrl) { try { ctrl.abort(); } catch (e) { /* best effort; settle() already decided */ } }
          fail('no answer within ' + SEND_TIMEOUT_MS + 'ms', { url: API.list, timeout_ms: SEND_TIMEOUT_MS });
        }, SEND_TIMEOUT_MS);

        var opts = {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          // ⛔ NO `note` KEY — route contract v2 Amendment 3 removed it. Her free text travels in
          // `extras`, which is a real capability with a real input behind it.
          // `list_date` is the date SHE CONFIRMED, not a date derived again here: receiveList takes
          // it as a first-class input and builds the shop reference from it, so what she agreed to
          // on screen is what the shop is dated.
          // ⛔ `extras` IS OMITTED ENTIRELY WHEN SHE HAS TYPED NOTHING, not sent as an empty array.
          // The frozen contract says omit the key when empty, and Keel's route answers 400 to an
          // empty-STRING entry — which would fail her whole submission over a nicety. Establishing
          // it by execution rather than by reading: addExtra() trims and returns early on falsy, so
          // a blank box cannot create an entry and `extras` can never contain ''. Omitting the key
          // as well means the empty case matches the contract exactly rather than merely closely.
          body: JSON.stringify(extraTexts.length
            ? { household: HOUSEHOLD, list_date: confirmDate.value, items: items, extras: extraTexts }
            : { household: HOUSEHOLD, list_date: confirmDate.value, items: items }),
        };
        if (ctrl) opts.signal = ctrl.signal;

        fetch(API.list, opts)
          // ⛔ .text() THEN JSON.parse, NOT .json(). Two reasons, both load-bearing. It separates
          // "the body was not JSON" from "the request never completed" — r.json() collapses both
          // into one rejection and AC1 requires five DISTINCT outcomes. And it lets the console
          // carry the first bytes of an HTML error page, which is the single most useful thing for
          // whoever debugs this at 7am.
          .then(function (r) {
            return r.text().then(function (text) {
              return { status: r.status, httpOk: r.ok, text: text };
            });
          })
          .then(function (res) {
            var body = null;
            try { body = JSON.parse(res.text); } catch (e) { body = null; }
            if (body === null || typeof body !== 'object') {
              return fail('the answer was not JSON', { status: res.status, first120: String(res.text).slice(0, 120) });
            }
            // HTTP-ok AND ok:true. Stricter than the contract needs, deliberately: a 500 that
            // somehow carried ok:true must not be able to tell her it worked.
            if (res.httpOk !== true) {
              return fail('the server refused it', { status: res.status, error: body.error, message: body.message });
            }
            if (body.ok !== true) {
              return fail('the server did not take the list', { status: res.status, error: body.error, message: body.message });
            }
            return accepted(body);
          })
          .catch(function (e) {
            fail('the request did not complete', { name: e && e.name, message: e && e.message });
          });
      }

      // ── ADD SOMETHING ELSE, IN HER OWN WORDS ─────────────────────────────────────────────────
      // HIGH-1: this replaces a 110px control with a ~348px form. At 512x300 and 640x400 the label,
      // the box and "Add it" all landed ABOVE the top of the viewport. Aligned to `start` rather
      // than `end` because what she needs to see first is the question and the box, not the buttons.
      function openAdd() {
        if (sendState.value === 'sending') return;
        addOpen.value = true;
        revealAfterTransition('.add-form', '.a-input', 'start');
      }

      // ⛔ HER TEXT SURVIVES THIS. HIGH-2, VERA, AND IT WAS THE WORST DEFECT IN THE PACKAGE.
      // This used to run `draft.value = ''`. "Not now" is a full-size control sitting directly
      // beside "Add it", so one mis-tap silently destroyed something she had typed by hand — and
      // reopening the box showed her an empty field with no way back. Addendum B §8.3 rule 8 is
      // verbatim about it: "Text typed but not added is preserved if she returns within the
      // session." The draft is now cleared in exactly ONE place: addExtra(), on success, once her
      // words are safely on the list.
      // It is also the only destroyed thing on this surface that repeating a gesture cannot
      // recreate — every other action is undone by doing it again. That asymmetry is why it had to
      // be the most protected action here rather than the least.
      function closeAdd() {
        addOpen.value = false;
        revealAfterTransition('.add', '.add', 'end');
      }

      // ⛔ HER ITEM IS ADDED FIRST AND CHECKED AFTERWARDS, AND THAT ORDER IS THE REQUIREMENT.
      // Warwick: the check is a sense-check, not a gate. If it is slow, broken, or unreachable, she
      // must still have added her thing. So the list is updated synchronously and the nudge, if one
      // ever arrives, is attached to a row that is already hers.
      function addExtra() {
        var text = String(draft.value || '').trim();
        if (!text) return;              // nothing typed: nothing happens, and nothing is said
        if (addBusy.value) return;      // one at a time, so two taps cannot duplicate her words

        var entry = { id: nextExtraId++, text: text, note: null };
        extras.value = extras.value.concat([entry]);
        draft.value = '';          // ⛔ THE ONE PLACE THE DRAFT IS EVER CLEARED — on success only
        addOpen.value = false;
        touched();
        addBusy.value = true;
        // HIGH-2: every other mutation on this surface records a worded undo and this one did not,
        // so the undo control on screen still offered to un-tick the last ITEM she ticked — a
        // second wrong thing, one tap after the first.
        lastUndo.value = {
          label: 'Undo — ' + text + ' added to your list',
          apply: function () {
            extras.value = extras.value.filter(function (e) { return e.id !== entry.id; });
            draft.value = text;    // her words go back in the box, not into nothing
            addOpen.value = true;
          },
        };

        // ⛔ THE NUDGE IS ATTACHED BY REPLACING THE ARRAY, NEVER BY MUTATING THE ENTRY.
        // `extras` holds plain objects; the reference we captured above is the RAW object, not
        // Vue's reactive proxy, so `entry.note = x` would update the data and render nothing.
        function annotate(note) {
          extras.value = extras.value.map(function (e) {
            return e.id === entry.id ? { id: e.id, text: e.text, note: note } : e;
          });
        }

        var settled = false;
        var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true; addBusy.value = false;
          if (ctrl) { try { ctrl.abort(); } catch (e) { /* best effort */ } }
          // ⛔ SILENCE, NOT AN ERROR. She asked for an item, not for a report on a lookup.
          console.warn('[shopping] check-item timed out; her item is kept', { text: text });
        }, CHECK_TIMEOUT_MS);
        function done(fn) {
          if (settled) return;
          settled = true; clearTimeout(timer); addBusy.value = false; fn();
        }

        var opts = {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            household: HOUSEHOLD,
            text: text,                                     // exactly what she typed
            chosen: chosen.value.map(function (it) { return it.id; }),
          }),
        };
        if (ctrl) opts.signal = ctrl.signal;

        fetch(API.check, opts)
          .then(function (r) { return r.text().then(function (t) { return { httpOk: r.ok, text: t }; }); })
          .then(function (res) {
            var body = null;
            try { body = JSON.parse(res.text); } catch (e) { body = null; }
            done(function () {
              if (!res.httpOk || !body || body.ok !== true) {
                console.warn('[shopping] check-item did not answer usefully; her item is kept', { text: text });
                return;
              }
              console.info('[shopping] check-item', { text: text, status: body.status, matched_regular_id: body.matched_regular_id });
              // ⛔ TWO OUTCOMES REACH HER SCREEN AND THE OTHER TWO DO NOT.
              // matched / possible_duplicate -> a warm sentence saying she already has it, AND her
              //   item stays, because she may know something the catalogue does not.
              // needs_confirmation / unmatched_new_item -> ACCEPTED IN SILENCE. Warwick answers
              //   those downstream in his own process; stopping her to adjudicate a catalogue match
              //   is the interrogation this surface must never conduct.
              if (body.status !== 'matched' && body.status !== 'possible_duplicate') return;
              var name = typeof body.matched_name === 'string' && body.matched_name.trim()
                ? body.matched_name.trim() : null;
              annotate(name
                ? 'You’ve already got ' + name + ' on your list. I’ve kept this too.'
                : 'You’ve already got this on your list. I’ve kept it too.');
            });
          })
          .catch(function (e) {
            done(function () {
              console.warn('[shopping] check-item could not be reached; her item is kept', { text: text, message: e && e.message });
            });
          });
      }

      // HIGH-2: taking away something she typed is the least recoverable action on this surface —
      // re-tapping cannot bring it back the way re-tapping a row can. So it carries an undo that
      // restores the entry EXACTLY, nudge and all, at its original position.
      function removeExtra(entry) {
        var at = extras.value.findIndex
          ? extras.value.findIndex(function (e) { return e.id === entry.id; })
          : -1;
        var kept = { id: entry.id, text: entry.text, note: entry.note };
        extras.value = extras.value.filter(function (e) { return e.id !== entry.id; });
        touched();
        lastUndo.value = {
          label: 'Undo — ' + entry.text + ' put back on your list',
          apply: function () {
            var next = extras.value.slice();
            if (at >= 0 && at <= next.length) next.splice(at, 0, kept); else next.push(kept);
            extras.value = next;
          },
        };
      }

      // B §9.3: "an 84-year-old who realises she forgot the bread must not be stuck." The way back
      // from the sent state to an editable page. Her selections are untouched — they were never
      // cleared — so the list she returns to is exactly the list she sent.
      function reopen() {
        if (sendState.value === 'sending') return;   // never yank the page out from under a live send
        sendState.value = 'idle';
        revealAction();
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
        askMore: ASK_MORE, elaborateBelow: elaborateBelow,
        footHint: footHint, sentCountLabel: sentCountLabel, totalCount: totalCount,
        sentCount: sentCount, hasSent: hasSent, changedSinceSent: changedSinceSent,
        confirmShown: confirmShown, confirmDate: confirmDate, confirmCountLabel: confirmCountLabel,
        extras: extras, addOpen: addOpen, draft: draft, addBusy: addBusy,
        qtyOf: qtyOf, isOn: isOn, toggle: toggle, step: step, undo: undo,
        askConfirm: askConfirm, cancelConfirm: cancelConfirm, confirmSend: confirmSend,
        openAdd: openAdd, closeAdd: closeAdd, addExtra: addExtra, removeExtra: removeExtra,
        reopen: reopen,
        QTY_MIN: QTY_MIN, QTY_MAX: QTY_MAX,
      };
    },

    // ⛔ THIS TEMPLATE IS AN ARRAY OF SINGLE-QUOTED STRINGS, JOINED — NOT A TEMPLATE LITERAL — AND
    // THAT IS THE WHOLE REASON IT IS SHAPED THIS WAY. app.js delimits its template with backticks,
    // so a single backtick anywhere inside it (in an HTML comment, in copy, in a quoted field name)
    // ends the string and the file stops parsing with an error pointing at an unrelated word. It
    // cost two debugging rounds on WP-B15-42, and render-vm-check.mjs carries a guard that names
    // the cause — a guard scoped to app.js, because app.js is where the hazard lives.
    //
    // ⛔ CORRECTED AT WP-B15-49. This comment previously read "NO BACKTICK MAY APPEAR INSIDE THIS
    // TEMPLATE. It is a JS template literal". Both halves were false: the array form has no such
    // constraint, and there were already 20 backticks inside this block while the comment forbade
    // them. A prohibition nobody could obey and nothing enforced is worse than none — the next
    // reader either believes it and contorts the copy, or notices it is wrong and stops trusting
    // the rest of the comments in the file. The same trap, and the same fix, as `measureInPage` in
    // shopping-geometry-check.mjs: choose a form where the problem cannot exist to be guarded.
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
      // `data-send-state` mirrors the state machine onto the DOM. It is not a testing back-door:
      // it is state on the container, it is what CSS keys off, and it means a gate can assert the
      // rendered state without this file exporting a hook that exists only for tests.
      '<div class="page page-pad" :data-send-state="sendState">',

      '  <header class="head">',
      '    <h1 class="h-title">This week’s shopping</h1>',
      // ⛔ MEDIUM-2, VERA — AND IT IS A DEFECT IN ADDENDUM B §6.2, NOT A TYPO HERE. The wireframe's
      // instruction is "Then press the green button at the bottom." The action renders GREY until
      // her first selection, because B §6.7 itself requires it to be visibly disabled with the
      // reason beside it. So the spec's own instruction is wrong at exactly the moment she needs
      // it: on arrival, with nothing chosen, there is no green button to press.
      // Naming the control by its WORDS is the right fix regardless — colour may never be the sole
      // carrier of meaning (B §5.1, WCAG 1.4.1), and an instruction that depends on colour fails
      // the same test the rest of this surface is built to pass. Recorded against Addendum B
      // rather than silently diverging from it.
      '    <p class="h-say">Tap the things you’d like. Then press SEND MY SHOPPING LIST at the bottom.</p>',
      '  </header>',

      // The ONE banner slot. B §9.1: the ABSENCE of a banner is itself the resting-state signal,
      // which is only safe because nothing else may ever occupy this slot.
      // aria-live=assertive plus role=status: on load with something pending it is announced.
      //
      // ⛔ HIGH-2, VERA — THE SECOND SENTENCE IS THE FIX AND IT IS NOT COSMETIC.
      // This banner tells her the system needs something from her, and S3 (the question screen) is
      // correctly out of scope tonight — so it contained ZERO controls. It asked her for something,
      // offered no way to give it, and did not say so. Every other unbuilt affordance on this page
      // states its own limit plainly: the send action says the sending part is not finished, the
      // add control says telling me in your own words is not ready. This one was silent, and
      // silence in front of a demand is the worst thing this surface can do to a person who is
      // already afraid of breaking it.
      // One sentence, her register, naming the human who will act. B §9.5's rule — it must state
      // that a human knows — applied to a limitation rather than to a failure. Not a screen build.
      // ⛔ THE HEADING IS THE LOAD-BEARING FACT AND IT NEVER MOVES. Warwick's ruling: it stays in
      // the initial viewport at every size, whole, never abbreviated and never softened. What may
      // move is the ELABORATION, and only because the fact is complete without it — a screen reader
      // hearing "there's a question for you" then her list then the elaboration has lost nothing.
      // If moving it broke the meaning it was never elaboration, and the ruling would be wrong.
      '  <div v-if="askLabel" class="banner ask" role="status" aria-live="assertive">',
      '    <h2>{{ askLabel }}</h2>',
      '    <p v-if="!elaborateBelow">{{ askMore }}</p>',
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
      // ⛔ MEDIUM-3, VERA. Without an explicit label, a role=checkbox computes its accessible name
      // from its CONTENTS — which here includes the two nested buttons and the live quantity. The
      // row announced as "Example oat drink One less Example oat drink Example oat drink, 2 One
      // more Example oat drink". For a screen-reader user that is the item's identity buried in
      // its own controls, and it also breaks WCAG 2.5.3 Label in Name: the accessible name no
      // longer matches the visible label.
      // Addendum A recommends NOT enabling VoiceView for her, and that does not make this
      // optional — the same brief says to build the semantics anyway so it works correctly if it
      // is ever needed or switched on by accident, which is a state she can reach by mis-tap.
      '      :aria-label="it.name"',
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
      // ⛔ @click.stop WITH NO HANDLER — this is the dead space, MEDIUM-1 (Vera). The cluster
      // swallows any tap that lands between MINUS and PLUS so it can never reach the row's
      // toggle. See the long note on .q in shopping.css for the two attempts that failed and
      // why `pointer-events: none` was the wrong instrument: it makes a region transparent,
      // and transparent is not dead when the row behind it is itself the target.
      '      <div class="q" @click.stop>',
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

      // ⛔ THE ELABORATION, WHEN THERE IS NOT ROOM FOR IT ABOVE — MOVED IN THE DOM, NOT BY CSS.
      // Rendered here rather than re-ordered visually, so DOM order and visual order AGREE and
      // WCAG 1.3.2 never arises. It is the same sentence (ASK_MORE), not a copy of it, and it
      // carries no heading and no role: the fact was already announced by the banner above, and
      // announcing it twice would be worse than moving it.
      '  <div v-if="askLabel && elaborateBelow" class="banner ask banner-more">',
      '    <p>{{ askMore }}</p>',
      '  </div>',

      // ── THE THINGS SHE TYPED ───────────────────────────────────────────────────────────────────
      // Shown in HER words, exactly as she typed them. Each has its own full-size way to take it
      // off again — B §6.6's undo principle applied to an addition rather than a selection.
      // The nudge, when there is one, sits under the item as a plain sentence. It is never a
      // question, never a choice, and never a reason her item is not there.
      '  <div v-if="extras.length > 0">',
      '    <h2 class="sec">Things you’ve added</h2>',
      // ⛔ MEDIUM-1, VERA — THE WHOLE ROW IS THE TARGET, BECAUSE THAT IS WHAT THIS SURFACE TEACHES.
      // It rendered as `row extra on`, pixel-identical to every other row, and had no handler, no
      // role and no tabindex. Every other row responds to a tap; this one silently refused, which
      // for a technology-phobic user reads as "I have broken it".
      // role=BUTTON, not checkbox: the item rows toggle, and a second tap undoes the first — but a
      // thing she TYPED cannot be re-created by re-tapping, so announcing it as a checkbox would
      // promise a symmetry that does not exist. The accessible name says exactly what the tap does.
      // ⛔ "Take it off" IS NOW PRESENTATIONAL — a span, not a button. A real button inside a
      // role=button row is a control inside a control; `.tick` is presentational for the same reason.
      // Removal is recoverable: removeExtra() records a worded undo that puts it back where it was.
      // ⛔ MEDIUM-A, VERA — THE NUDGE IS A SIBLING OF THE ROW AND NEVER A CHILD OF IT.
      // It used to sit INSIDE this row, and that made two things true at once, both bad. The row is
      // a `role="button"` whose action is REMOVE, so touching the sentence "You've already got
      // Cravendale on your list. I've kept this too." DELETED HER ITEM. And because `role="button"`
      // renders its descendants presentational, that sentence and its `role="status"` live region
      // were not exposed to assistive technology at all — the one message the sense-check exists to
      // deliver was both a trap and inaudible. Moving it out of the row closes both halves at once.
      // The `template` carries the v-for so the row and its note are SIBLINGS rather than nested.
      '    <template v-for="e in extras" :key="e.id">',
      '      <div',
      '        class="row extra on"',
      '        role="button"',
      '        :aria-label="\'Take \' + e.text + \' off your list\'"',
      '        tabindex="0"',
      '        @click="removeExtra(e)"',
      '        @keydown.enter.prevent="removeExtra(e)"',
      '        @keydown.space.prevent="removeExtra(e)"',
      '      >',
      '        <div class="r-body">',
      '          <span class="tick" aria-hidden="true">✓</span>',
      '          <span class="r-name">{{ e.text }}</span>',
      '        </div>',
      '        <span class="take-off" aria-hidden="true">Take it off</span>',
      '      </div>',
      '      <p v-if="e.note" class="e-note" role="status">{{ e.note }}</p>',
      '    </template>',
      '  </div>',

      // B §8.1: the entry control, always the last thing before the footer. A single unmistakable
      // full-width control — never a small + in a corner, never a floating action button.
      '  <button v-if="!addOpen" type="button" class="add" @click="openAdd()">',
      '    Add something else',
      '    <small>Tell me in your own words.</small>',
      '  </button>',

      // ⛔ THE INPUT OPENS IN PLACE, NOT ON A SCREEN. B §2's rule that she is never switched into
      // another surface applies inside this page too: a full-screen editor would take her list away
      // from her while she typed, and she would have nothing to check against.
      // A real <label for>, a real <input>, and a real submit button. No placeholder-as-label —
      // placeholder text vanishes the moment she starts typing, which is exactly when a person who
      // is unsure what was being asked needs it most (WCAG 3.3.2).
      '  <div v-else class="add-form">',
      '    <label class="a-label" for="extra-text">What else would you like?</label>',
      '    <input id="extra-text" class="a-input" type="text" autocomplete="off" autocapitalize="sentences"',
      '           v-model="draft" @keydown.enter.prevent="addExtra()" />',
      '    <button type="button" class="a-add" :aria-disabled="draft.trim() ? \'false\' : \'true\'" @click="addExtra()">Add it</button>',
      '    <button type="button" class="a-cancel" @click="closeAdd()">Not now</button>',
      '  </div>',

      // ⛔ FOUR FOOTER STATES, ONE SLOT, AND THE ORDER OF THESE BRANCHES IS THE SAFETY PROPERTY.
      // B §6.7: "After sending, it is replaced by the sent state (§9.3), not left tappable." So the
      // primary action is rendered in exactly TWO of the four branches — idle and sending — and in
      // the sending branch it is inert. There is no branch in which a tappable SEND coexists with a
      // message about a send. That is what makes "not left tappable" true by construction rather
      // than by a disabled attribute somebody could remove.
      '  <footer class="foot">',
      '    <span class="f-count" aria-live="polite">{{ countLabel }}</span>',

      // ── SENT (B §9.3) ──────────────────────────────────────────────────────────────────────────
      // The action is REPLACED by a calm, non-actionable strip. The only control here is the way
      // back, and it is full size: B §9.5, "an 84-year-old who realises she forgot the bread must
      // not be stuck."
      // What was sent is stated as a worded COUNT, and her ticked rows above are the itemisation.
      // The full-screen S4 summary is not built — see the file header for the measured reason.
      // ── CONFIRM (Warwick, 2026-08-13) ──────────────────────────────────────────────────────────
      // ⛔ THE COMMIT CONTROL IS `.confirm`, NOT `.send`, AND THAT IS THE ACCIDENT GUARD ITSELF.
      // In this state no element with class `.send` exists anywhere on the page, so a second tap
      // aimed at where SEND was — by her finger or by a script — cannot land on the thing that
      // commits her list. confirmSend() additionally refuses unless sendState is exactly 'confirm'.
      // Affordance and guarantee, the same pairing as B §6.4 rule 5 and AC2.
      // The way out is rendered LAST, so it is the control nearest to where her finger already was:
      // if the footer's growth does put something under a descending finger, it must be the safe one.
      '    <div v-if="sendState === \'confirm\'" class="f-state" tabindex="-1">',
      '      <div class="note" role="status">',
      '        <strong class="n-say">Send your shopping list for {{ confirmShown }}?</strong>',
      // ⛔ MEDIUM-D, VERA — THE ZERO CASE IS REACHABLE AND USED TO BE SILENT.
      // She can open the confirm, scroll up, untick everything and tap YES. confirmSend() returns
      // early on an empty list, which is correct — but the control said nothing, showed nothing and
      // did nothing, which for a technology-phobic user is indistinguishable from a broken page.
      // `.send` has carried both halves since B §6.7 (visibly disabled, with the reason beside it);
      // this simply gives the commit control the same two, rather than inventing a third pattern.
      '        <span v-if="totalCount === 0" class="n-sub">You haven’t chosen anything. Tap some things first, then press SEND MY SHOPPING LIST again.</span>',
      '        <span v-else class="n-sub">{{ confirmCountLabel }} Nothing has been sent yet.</span>',
      '      </div>',
      '      <button type="button" class="confirm" :aria-disabled="totalCount > 0 ? \'false\' : \'true\'" @click="confirmSend()">YES, SEND IT</button>',
      '      <button type="button" class="again" @click="cancelConfirm()">No, not yet</button>',
      '    </div>',

      '    <div v-else-if="sendState === \'sent\'" class="f-state" tabindex="-1">',
      '      <div class="note done" role="status">',
      '        <strong class="n-say">Sent — thank you. I’m getting your shopping ready.</strong>',
      '        <span class="n-sub">{{ sentCountLabel }} They’re still ticked on your list, and you can change them.</span>',
      '      </div>',
      '      <button type="button" class="again" @click="reopen()">I want to change something</button>',
      '    </div>',

      // ── ALREADY SENT TODAY (route contract v2, AMENDMENT 2) ────────────────────────────────────
      // ⛔ THIS IS NOT A FLAVOUR OF THE SENT STATE AND MUST NEVER BE STYLED OR WORDED AS ONE.
      // The server answered ok:true and wrote NOTHING: `receiveList` is idempotent on
      // (household, shop_ref), shop_ref is the date, so a second submission the same day resumes
      // the existing shop — no shop row, no command row, no event. `created:false` is how it says
      // so. The word "sent" does not appear in this branch, because nothing was.
      // It takes the plain warn-tinted `.note` — not `.done`, which would read as success, and not
      // `.stop`, which would read as a fault of hers. Nothing went wrong; something simply did not
      // change. B §9.5 supplies the rest: say a human will deal with it, and never strand her.
      // She had already sent today AND this submission wrote a durable record of what she changed.
      // ⛔ THE SECOND SENTENCE IS A PROMISE ABOUT THE REAL WORLD, NOT A CONSOLATION. It is rendered
      // only on `recorded_new === true`, and the notification that makes it true is WP-B15-50's
      // acceptance criterion. If that ever stops firing, THIS SENTENCE BECOMES A LIE and the fix
      // belongs there, not here — do not soften the words to cover a broken notification.
      '    <div v-else-if="sendState === \'already-sent-noted\'" class="f-state" tabindex="-1">',
      '      <div class="note" role="alert">',
      // ⛔ MEDIUM-4, VERA — THE HEADLINE LEADS WITH THE REASSURING FACT, AND THE THREE DIFFER.
      // All three of these states used to open with the SAME 26px/800 line, "Today's list has
      // already gone" — the largest, boldest thing on screen was the one piece of news that is not
      // reassuring, and it was identical across three different truths. The reassurance sat
      // underneath at 22px/400. Vera's point is that the sentence order was right and the VISUAL
      // order undid it. So each headline is now the true reassuring fact for THAT outcome, and the
      // thing she cannot change is the qualifier beneath it.
      '        <strong class="n-say">Warwick has been told.</strong>',
      '        <span class="n-sub">Today’s list had already gone, so I couldn’t change it — but I’ve saved what you changed and he’ll sort it out for you. Nothing you’ve chosen has been lost.</span>',
      '      </div>',
      '      <button type="button" class="again" @click="reopen()">Back to my shopping</button>',
      '    </div>',

      // ⛔ AC7 — HER CHANGE IS SAVED AND WARWICK HAS NOT HEARD. BOTH FACTS, IN THAT ORDER.
      // The reassuring one comes first because it is the one she cares about: her words are safe.
      // The second is stated plainly and without alarm, and it ends in the one small thing she can
      // actually do about it — which is what stops this being a worry with no exit (B §9.5, "she is
      // never stranded"). She is an 84-year-old who lives near him; "mention it when you see him"
      // is an action she can take, unlike anything involving a screen.
      // ⛔ NO MACHINE CODE. `notify_error` is 'notify_failed' or 'notify_not_configured' and neither
      // is a thing she should ever read; both are in the console for Larry.
      // ⛔ AND IT MUST NOT CONTAIN THE WORDS "told Warwick" — render-vm-check asserts that no state
      // but the notified one makes that promise, and this is the state most likely to break it.
      '    <div v-else-if="sendState === \'already-sent-saved\'" class="f-state" tabindex="-1">',
      '      <div class="note" role="alert">',
      // MEDIUM-4: leads with the fact she most needs — her words are safe. Vera said she would ship
      // the sub-line as written; it is the headline above it that had to change.
      '        <strong class="n-say">I’ve saved what you changed.</strong>',
      '        <span class="n-sub">Today’s list had already gone, so I couldn’t change it, and nothing you’ve chosen has been lost. Warwick hasn’t heard about it yet, so do mention it to him when you see him.</span>',
      '      </div>',
      '      <button type="button" class="again" @click="reopen()">Back to my shopping</button>',
      '    </div>',

      // She had already sent today and this submission changed NOTHING — an identical re-send.
      // No promise is made here, because none was earned: no row was written and nobody was told.
      '    <div v-else-if="sendState === \'already-sent-unchanged\'" class="f-state" tabindex="-1">',
      '      <div class="note" role="alert">',
      // MEDIUM-4: `recorded_new:false` means her submission matched what had already gone, so the
      // genuinely reassuring — and literally true — fact is that everything she wants is on it.
      // ⛔ NOT "on its way" or any similar phrasing: that would be a claim about the shop's progress
      // which nothing in the response supports, and NO_SUCCESS_LANGUAGE would rightly catch it.
      '        <strong class="n-say">Everything you’ve chosen is already on today’s list.</strong>',
      '        <span class="n-sub">It went earlier and nothing has changed. Nothing you’ve chosen has been lost.</span>',
      '      </div>',
      '      <button type="button" class="again" @click="reopen()">Back to my shopping</button>',
      '    </div>',

      // ── FAILED (B §9.6, AC4) ───────────────────────────────────────────────────────────────────
      // ⛔ HER SENTENCE IS A FIXED STRING. No status, no error code, no service name, no exception
      // text, and no interpolation of anything the server said — there is deliberately no binding
      // here that a machine string could travel through. The detail is in the console.
      // B §9.6 requires the full-size "Try again" beside the thing that failed; AC4 gave the copy
      // and not the control, and a message with no way forward is the stranding §9.5 forbids.
      '    <div v-else-if="sendState === \'failed\'" class="f-state" tabindex="-1">',
      '      <div class="note stop" role="alert">',
      '        <strong class="n-say">I couldn’t send your list just now.</strong>',
      '        <span class="n-sub">Nothing has been lost — your choices are still here.</span>',
      '      </div>',
      // ⛔ RETRY GOES BACK THROUGH THE CONFIRM, NOT STRAIGHT TO A POST. A failed send is exactly
      // when a worried person taps repeatedly, so the accident guard matters MORE here, not less.
      '      <button type="button" class="again" @click="askConfirm()">Try again</button>',
      '    </div>',

      // ── SENDING ────────────────────────────────────────────────────────────────────────────────
      // ⛔ THE ACTION STAYS IN PLACE AND GOES INERT, RATHER THAN DISAPPEARING. Removing it would
      // reflow the footer under a finger that is still descending, and Addendum E A19 names exactly
      // that compounding failure for poor coordination — her second tap would land on whatever slid
      // into the gap. So the box holds its position, aria-disabled marks it (the AFFORDANCE), and
      // `inFlight` in send() makes the tap do nothing (the GUARANTEE). B §9.6 also forbids a
      // full-page spinner that hides her list: the only progress signal is these words.
      // ⛔ A <template>, NOT A WRAPPER DIV, AND THAT IS THE WHOLE POINT OF THIS BRANCH.
      // `.send` must remain a DIRECT flex child of `.foot`, exactly as it is when idle. Wrapping it
      // would re-parent it into a new flex context and move it — the button would jump to full
      // width the instant she tapped it, which is the reflow-under-a-descending-finger hazard this
      // branch exists to avoid. A template renders no element, so the box does not move at all.
      '    <template v-else-if="sendState === \'sending\'">',
      '      <span class="f-why" role="status" aria-live="polite">{{ footHint }}</span>',
      '      <button type="button" class="send" aria-disabled="true" @click="askConfirm()">SEND MY SHOPPING LIST</button>',
      '    </template>',

      // ── IDLE ───────────────────────────────────────────────────────────────────────────────────
      '    <template v-else>',
      // B §6.6: the session undo, showing in words what it will undo.
      '      <button v-if="lastUndo" type="button" class="undo" @click="undo()">{{ lastUndo.label }}</button>',
      // B §6.7: disabled when nothing is chosen, VISIBLY, with the reason beside it. Not hidden,
      // and not tappable-then-scolding. After a send the same slot carries the changed-list
      // sentence, which is the one that stops a re-editable list reading as an already-sent one.
      '      <span v-if="footHint" class="f-why" role="status" aria-live="polite">{{ footHint }}</span>',
      '      <button type="button" class="send" :aria-disabled="canSend ? \'false\' : \'true\'" @click="askConfirm()">SEND MY SHOPPING LIST</button>',
      '    </template>',
      '  </footer>',
      '</div>',
    ].join('\n'),
  };

  Vue.createApp(App).mount('#shop');
})();
