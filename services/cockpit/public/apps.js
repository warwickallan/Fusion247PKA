/* Fusion247 Cockpit — THE APPS REGISTRY.

   Apps are the things Fusion actually RUNS for Warwick. An app is a PLACE with its own
   sub-navigation (Apps > <App> > <view>) — a dashboard within the dashboard — not a panel
   borrowed from somebody else's screen.

   ADDING AN APP IS ONE ENTRY IN `APPS` BELOW. Nothing else in the cockpit is edited: the nav
   area, the Home tile, the Apps grid, the app shell, its internal navigation and its honest
   unavailable state are all driven from these fields. Only `key`, `label` and `desc` are
   required — everything else has a sane default — so the minimum viable app really is one line.

   WHAT LIVES HERE vs WHAT LIVES IN server.mjs
     here        presentation and the app's own navigation (label, icon, blurb, views, copy).
     server.mjs  APP_SERVICES — the host:port of a backing service. The browser may only ever
                 name an app KEY, never a URL, so this registry can't point the server at an
                 arbitrary host. The two files share exactly one thing: the key. Not duplication.

   THE LOCAL OVERLAY, and what it is for. A registry entry is a label, a blurb and a lane, and it is
   the only way an app gets a cockpit surface — so "give this thing a surface" and "write down what
   this thing is" are currently the same edit. The overlay separates them: `/private-apps.js` is an
   OPTIONAL local registry that server.mjs reads from a path OUTSIDE this repository
   (COCKPIT_PRIVATE_APPS), absent by default and then serving empty. It publishes
   window.FUSION_PRIVATE_APPS in exactly the AppEntry shape below and its entries are merged here
   under the same normalisation. The public registry always wins a key collision: an overlay may ADD
   an app, never rewrite one.

   It is a generic extension point, and that is the whole of the claim. It does not make this file,
   this directory or this repository quiet about anything else, and nothing here should be read as
   saying it does — see the note in services/cockpit/private-apps.mjs.

   MODULES vs APPS. An app is a PLACE. A module is the thing a ROW came from (`source_module` on an
   attention item or an output) — every app is one, plus a few producers that are not places you can
   visit. The module registry is DERIVED from both lists below, so a module's human name and its
   Home lane (Life vs Build) are registry fields, never a second map in app.js. That is what makes
   the extension point reach the whole surface: without it, "add an app" still means editing a label
   map and a lane set in app.js, and an overlay could add a tile but never a correctly-labelled row.

   HONESTY RULE (non-negotiable). The cockpit reports whether an app's service ANSWERED, measured
   at the moment it asked. It never assumes "up", never shows a placeholder figure, and never
   invents a number. Unknown is a first-class value and prints as "checking…" or "not running".

   No build step: this is a plain script loaded BEFORE app.js; it publishes window.FUSION_APPS.
   It runs inside an IIFE and exports NOTHING else. That is load-bearing, not style: two classic
   scripts that each declare a top-level `const APPS` is a duplicate global lexical declaration —
   a SyntaxError that kills app.js and blanks the whole cockpit. `node --check` cannot see it
   because each file is valid alone; only render-check.mjs catches it. */
(function registerApps(window) {
  'use strict';

/**
 * @typedef {'green'|'blue'|'amber'|'grey'|'red'} Tone
 *
 * @typedef {Object} AppView            One screen inside an app — the app's own internal nav.
 * @property {string}  key              Stable id, unique within the app.
 * @property {string}  label            What Warwick taps.
 * @property {string} [blurb]           One line: what this view shows once the app is connected.
 * @property {boolean} [primary]        Defaults to true. false = reachable (goView still routes to
 *                                      it and `currentView` still resolves it) but NOT rendered as a
 *                                      tab in `.app-nav` — reached instead via the settings/cog icon.
 *                                      BUILD-015 B15-26: AsdAIr's nav must be exactly four primary
 *                                      tabs, with Diagnostics/About/History behind a cog, never a
 *                                      competing fifth tab (design doc, "Navigation").
 *
 * @typedef {Object} AppEntry           A registry entry AS AUTHORED.
 * @property {string}  key              Stable id. Matches APP_SERVICES in server.mjs if probed.
 * @property {string}  label            Human name, as Warwick says it.
 * @property {string}  desc             One line: what this app does for him.
 * @property {string}  [icon]           Single glyph for the tile. Decorative (aria-hidden).
 * @property {Tone}    [tone]           Identity colour, used only once the app is CONFIRMED up.
 * @property {boolean} [probe]          true = it has a backing service; the cockpit asks
 *                                      /api/app-status?app=<key> whether it is answering.
 * @property {AppView[]} [views]        Internal navigation. Defaults to a single Overview.
 * @property {string[]} [about]         Facts safe to show with the service down (no live data).
 * @property {string}  [offline]        What to tell Warwick when the service does not answer.
 * @property {string}  [moduleLabel]    How this key prints as a ROW source. Defaults to `label`.
 * @property {Lane}    [lane]           Which Home lane its rows sit in. Defaults to 'build'.
 * @property {string}  [href]           A SAME-ORIGIN absolute path this tile opens instead of an
 *                                      in-shell workspace, e.g. '/careerair.html'. Anything that is
 *                                      not a rooted ordinary path is dropped — see normaliseApp.
 *
 * @typedef {'life'|'build'} Lane
 *
 * @typedef {Object} ModuleEntry        A producer of rows that is NOT a place you can visit.
 * @property {string}  key              Matches `source_module` on an attention item or output.
 * @property {string}  label            How it prints on a row's eyebrow.
 * @property {Lane}    [lane]           Defaults to 'build'.
 *
 * @typedef {Object} Module             What window.FUSION_MODULES maps each key to.
 * @property {string} label
 * @property {Lane} lane
 *
 * @typedef {Object} NormalisedApp      What window.FUSION_APPS actually contains — every field
 *                                      present and frozen, so the UI never guards for undefined.
 * @property {string} key
 * @property {string} label
 * @property {string} desc
 * @property {string} icon
 * @property {Tone} tone
 * @property {boolean} probe
 * @property {ReadonlyArray<Required<Omit<AppView,'primary'>> & {primary:boolean}>} views
 * @property {ReadonlyArray<string>} about
 * @property {string} offline
 */

/** @type {AppEntry[]} */
const APPS = [
  {
    key: 'asdair',
    label: 'AsdAIr',
    icon: '🛒',
    desc: 'the weekly household shop, end to end',
    tone: 'green',
    // It has a read service (services/asdair/cockpit-api, GET /asdair/health). Whether it is
    // RUNNING is measured, never assumed — the tile never claims "up" from hope.
    probe: true,
    // Its ROWS print as "Shopping" — Warwick's word for the job — while the app tile keeps its own
    // name. Two module keys ('shopping' and this one) deliberately share one human name.
    moduleLabel: 'Shopping',
    lane: 'life',
    // BUILD-015 B15-26: four primary tabs (design doc, "Navigation"), collapsed from the previous
    // Overview/Details split. 'about' carries Diagnostics + About + History and is reachable only
    // via the cog (primary:false) — never a competing fifth tab. Key RENAMES from the previous
    // build ('overview'->'shop', 'details'->'questions' folded into 'shop'+'questions'): a deep
    // link or bookmark carrying the old `?view=overview` / `?view=details` now falls back to the
    // registry default (views[0], i.e. 'shop') via `currentView`'s own `|| a.views[0]` fallback —
    // never a blank screen.
    views: [
      { key: 'shop', label: 'Shop', blurb: 'Where this week’s shop has got to, what’s changed, and anything waiting on you — the lines that need attention first.' },
      // ⛔ WP-B15-42 CHANGED THESE TWO LABELS AND BLURBS AND DELIBERATELY DID NOT CHANGE THEIR KEYS.
      // Renaming a view key in this registry without sweeping its string consumers is exactly what
      // silently destroyed every AsdAIr render assertion between f7bf71a and WP-B15-36 —
      // render-vm-check.mjs matches on `key`, so a rename there is a harness break that presents
      // itself as a passing run. Labels are free to change; keys are not.
      { key: 'questions', label: 'Exceptions', blurb: 'The one board for everything unsettled — what AsdAIr read, the part of the photograph it read it from, what it proposes, and a way to answer in place. Answered ones stay here so you can change them.' },
      { key: 'basket', label: 'The list', blurb: 'This week’s list sorted by brand — brand, product and quantity per line, with where it came from on expansion — plus anything held back, and how the real trolley reconciled once it has been built in ASDA.' },
      { key: 'rules', label: 'Rules', blurb: 'The durable rulebook: the standing rules AsdAIr plans against, the decisions it has been given, and the household catalogue with its aliases. Read-only — this is what the system believes.' },
      { key: 'about', label: 'Diagnostics', blurb: 'What this app does, what it will never do, where its data lives, other shops, and the raw technical detail behind every screen above.', primary: false },
    ],
    about: [
      'Runs the weekly household shop as a standing job: intake, planning against the durable rulebook, the needs-decision queue, reconcile, and the learning write-back.',
      'It never books a slot, never checks out and never pays. A basket build is a request written to a row — the row is not evidence a basket exists.',
      'The cockpit is a second view of ONE shop, not a second brain: it reads durable state and forwards the same named commands the Telegram bot uses, so an answer given on the phone clears the same question here.',
      'Its reader is SELECT-only, inside a read-only transaction, over a read-only connection.',
      'Identity comes from the household catalogue, never from prose — a line only reads as matched when it carries a real catalogue id, with the raw reading preserved beside it as evidence.',
      'The Rules view is the durable rulebook, read-only: standing rules grouped by what they DO, the decision history behind them, and every regular with its aliases. Nothing is edited from the cockpit — rules change through the same command surface the Telegram bot uses.',
      'Unknown reads as "unknown", never as 0. A measured zero still prints as 0.',
      'The service binds to localhost by default; a tailnet address has to be set deliberately.',
    ],
    offline: 'AsdAIr’s read service is not answering, so there is nothing to show. That is not the same as an empty shop — no shop data has been read, and none is being guessed at.',
  },

  {
    key: 'careerair',
    label: 'Opportunities',
    icon: '🎯',
    desc: 'every live opportunity, scored, in one readable list',
    tone: 'blue',
    lane: 'life',
    moduleLabel: 'Opportunities',
    // ITS OWN PAGE, not an in-shell workspace. `/careerair.html` loads /styles.css so it wears the
    // same design language, but it needs a dense sortable list and a document reading view, neither
    // of which the app shell's view/tab shape fits. `href` is what makes the tile open it — without
    // it this entry would render a place that goes nowhere.
    href: '/careerair.html',
    // No `probe`: there is no separate backing service to report on. The page reads the cockpit's own
    // API on this same server, so a tile pill claiming "running" would be measuring nothing.
    views: [{ key: 'grid', label: 'Opportunities' }],
    about: [
      'One page listing every live opportunity the system currently holds, newest or best-scored first.',
      'Two kinds of score are shown and never merged: one read and judged by hand, one produced by a rubric with no individual judgement. Where a row carries both and they disagree, it says so.',
      'Neither score is a fit-gate verdict. The gate is a separate assessment that covers only a handful of rows, and a note is displayed as a note.',
      'Rows built from a full advert, from a partial one, and from little more than a title are marked differently — a score means materially less on a thin row, and hiding that would make the page flatter the data.',
      'A missing field prints as "unknown". Nothing is dropped for being incomplete and nothing is filled in with a guess.',
      'Tailored documents are read from a private store at the moment you open one. They are never copied into this repository or cached on the device.',
    ],
    offline: 'The opportunity list could not be read. That is not an empty list — nothing has been read, and nothing is being guessed at.',
  },

  // ── ADDING THE NEXT APP ────────────────────────────────────────────────────────────────────
  // One entry above is the whole job. The minimum is genuinely one line:
  //
  //   { key: 'example', label: 'Example', desc: 'what it does for you' },
  //
  // Defaults fill in the rest: icon 🧩, tone grey, no probe, a single "Overview" view, and an
  // honest unavailable message. Add `views: [...]` when the app earns its own sub-navigation,
  // and `probe: true` PLUS one line in APP_SERVICES in services/cockpit/server.mjs when it has
  // a backing service the cockpit should honestly report on. Presentation lives here; the
  // host:port of a service lives there. Neither file duplicates the other.
  // ───────────────────────────────────────────────────────────────────────────────────────────
];

/* Row producers that are NOT places. Every app above is also a module (see buildModules); these are
   the ones with no workspace to visit. Adding an app does not mean adding a line here. */
/** @type {ModuleEntry[]} */
const MODULES = [
  { key: 'brain', label: 'Brain' },
  { key: 'builds', label: 'Builds' },
  { key: 'shopping', label: 'Shopping', lane: 'life' },
];

/* EVERY key this public tree publishes — apps and module-only producers alike. This is the set an
   overlay may not claim. It has to be both lists: a key that appears only in MODULES is still a
   published key, and leaving it out of the collision set is exactly how an overlay got to rewrite
   one. Built once here so there is a single answer to "is this key already ours". */
const PUBLIC_KEYS = new Set(
  MODULES.map((m) => String(m.key)).concat(APPS.map((a) => String(a.key))),
);

const TONES = ['green', 'blue', 'amber', 'grey', 'red'];

/**
 * Fill every optional field so the UI can render an entry without a single existence check.
 * @param {AppEntry} a
 * @returns {NormalisedApp}
 */
function normaliseApp(a) {
  const src = (Array.isArray(a.views) && a.views.length) ? a.views : [{ key: 'overview', label: 'Overview' }];
  const views = src.map((v) => Object.freeze({
    key: String(v.key),
    label: String(v.label),
    blurb: v.blurb ? String(v.blurb) : '',
    // Defaults true — every existing app/view keeps rendering as a tab exactly as before. Only an
    // explicit false (AsdAIr's 'about', per the design doc) is hidden from .app-nav.
    primary: v.primary !== false,
  }));
  return Object.freeze({
    key: String(a.key),
    label: String(a.label),
    desc: String(a.desc || ''),
    icon: a.icon ? String(a.icon) : '🧩',
    tone: TONES.includes(a.tone) ? a.tone : 'grey',
    probe: a.probe === true,
    // A SAME-ORIGIN PAGE THIS TILE OPENS INSTEAD OF AN IN-SHELL WORKSPACE. Empty for every app that
    // is a place inside the cockpit; set only for the ones that are their own page.
    //
    // ⛔ SAME-ORIGIN ABSOLUTE PATHS ONLY, AND THE ALLOWLIST IS THE POINT. This registry can be
    // EXTENDED BY THE LOCAL OVERLAY, which is a file outside this repository — so a free-text href
    // would be a way for a local file to put an off-site link on Warwick's cockpit. A value that is
    // not a rooted path of ordinary path characters is DROPPED, not sanitised: `//evil.example`,
    // `https://…`, `javascript:…` and a protocol-relative URL all fail this test and leave the tile
    // behaving exactly as it did before, which is the safe direction. The neighbouring rule in this
    // file — "the browser may only ever name an app KEY, never a URL" — governs which SERVICE the
    // server will talk to and is untouched by this: nothing here reaches APP_SERVICES.
    href: (typeof a.href === 'string' && /^\/[A-Za-z0-9._~\-/]*$/.test(a.href)) ? a.href : '',
    views: Object.freeze(views),
    about: Object.freeze(Array.isArray(a.about) ? a.about.map(String) : []),
    offline: String(a.offline || 'This app’s service is not answering, so there is nothing to show yet. Nothing has been read, and nothing is being guessed at.'),
  });
}

/**
 * Entries contributed by the optional local overlay (window.FUSION_PRIVATE_APPS, published by
 * /private-apps.js). Local data still gets validated: an entry needs a key and a label to be an
 * app at all, and a key already claimed by the public registry is DROPPED. The overlay's job is to
 * add a place the public tree must not name — not to silently redress one that is already here.
 *
 * THE COLLISION SET IS EVERY PUBLISHED KEY, apps AND modules. An earlier revision seeded it from
 * APPS alone, which left the module-only keys unguarded: an overlay entry for one of them passed
 * this filter, and then — because buildModules applies apps AFTER modules — quietly overwrote the
 * published label and lane. It was found by executing it, not by reading it, and the test that
 * should have caught it asserted against APPS[0], the one key that happened to BE protected.
 * @param {typeof globalThis} w
 * @returns {AppEntry[]}
 */
function overlayApps(w) {
  const raw = (w && Array.isArray(w.FUSION_PRIVATE_APPS)) ? w.FUSION_PRIVATE_APPS : [];
  const taken = new Set(PUBLIC_KEYS);
  const out = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const key = String(e.key || '').trim();
    if (!key || taken.has(key)) continue;
    if (!String(e.label || '').trim()) continue;
    taken.add(key);
    out.push(e);
  }
  return out;
}

/**
 * Derive the module registry from the non-place producers PLUS every app.
 *
 * Three passes, and the third is guarded. The public lists may overwrite each other freely — this
 * tree is internally consistent and a genuine public collision should be visible, not silently
 * resolved. The overlay pass may only fill keys nobody has claimed.
 *
 * Two barriers now stand between an overlay and a published module: the collision set in
 * overlayApps, and this guard. The collision set is the load-bearing one — remove it and an overlay
 * entry reaches FUSION_APPS as a new app. This guard is what stops it also rewriting the published
 * module's label and lane on the way through, and it is only reached when the first barrier is
 * gone. Stated that way because it is what the mutation runs actually showed: removing this guard
 * alone changes nothing observable, so "either alone would have been enough" would have been a
 * claim the tests do not support.
 *
 * Null-prototype so a lookup can only ever return something that was registered — `MODULE['toString']`
 * is undefined here, not a function, and the caller needs no hasOwnProperty dance. `k in reg` is
 * therefore an honest "was this registered", with no inherited keys to lie about.
 * @param {ModuleEntry[]} mods
 * @param {AppEntry[]} apps
 * @param {AppEntry[]} overlay
 * @returns {Record<string, Module>}
 */
function buildModules(mods, apps, overlay) {
  const reg = Object.create(null);
  const add = (key, label, lane, guarded) => {
    const k = String(key || '').trim();
    if (!k) return;
    if (guarded && k in reg) return;
    reg[k] = Object.freeze({ label: String(label || k), lane: lane === 'life' ? 'life' : 'build' });
  };
  for (const m of mods) add(m.key, m.label, m.lane, false);
  for (const a of apps) add(a.key, a.moduleLabel || a.label, a.lane, false);
  for (const o of overlay) add(o.key, o.moduleLabel || o.label, o.lane, true);
  return reg;
}

const OVERLAY_APPS = overlayApps(window);

/** @type {ReadonlyArray<NormalisedApp>} */
window.FUSION_APPS = Object.freeze(APPS.concat(OVERLAY_APPS).map(normaliseApp));
/** @type {Readonly<Record<string, Module>>} */
window.FUSION_MODULES = Object.freeze(buildModules(MODULES, APPS, OVERLAY_APPS));

}(window));
