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
 *
 * @typedef {Object} NormalisedApp      What window.FUSION_APPS actually contains — every field
 *                                      present and frozen, so the UI never guards for undefined.
 * @property {string} key
 * @property {string} label
 * @property {string} desc
 * @property {string} icon
 * @property {Tone} tone
 * @property {boolean} probe
 * @property {ReadonlyArray<Required<AppView>>} views
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
    // RUNNING is measured, never assumed — as of this build it is not deployed.
    probe: true,
    views: [
      { key: 'overview', label: 'Overview', blurb: 'Where this week’s shop has got to, and anything waiting on you.' },
      { key: 'details', label: 'Details', blurb: 'Every line on the list — what it was read as, what it matched in the household catalogue, and the evidence behind the match.' },
      { key: 'about', label: 'About', blurb: 'What this app does, what it will never do, and where its data lives.' },
    ],
    about: [
      'Runs the weekly household shop as a standing job: intake, planning against the durable rulebook, the needs-decision queue, reconcile, and the learning write-back.',
      'It never books a slot, never checks out and never pays. A basket build is a request written to a row — the row is not evidence a basket exists.',
      'The cockpit is a second view of ONE shop, not a second brain: it reads durable state and forwards the same named commands the Telegram bot uses, so an answer given on the phone clears the same question here.',
      'Its reader is SELECT-only, inside a read-only transaction, over a read-only connection.',
      'Identity comes from the household catalogue, never from prose — a line only reads as matched when it carries a real catalogue id, with the raw reading preserved beside it as evidence.',
      'Unknown reads as "unknown", never as 0. A measured zero still prints as 0.',
      'The service binds to localhost by default; a tailnet address has to be set deliberately.',
    ],
    offline: 'AsdAIr’s read service is not answering, so there is nothing to show. That is not the same as an empty shop — no shop data has been read, and none is being guessed at.',
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
  }));
  return Object.freeze({
    key: String(a.key),
    label: String(a.label),
    desc: String(a.desc || ''),
    icon: a.icon ? String(a.icon) : '🧩',
    tone: TONES.includes(a.tone) ? a.tone : 'grey',
    probe: a.probe === true,
    views: Object.freeze(views),
    about: Object.freeze(Array.isArray(a.about) ? a.about.map(String) : []),
    offline: String(a.offline || 'This app’s service is not answering, so there is nothing to show yet. Nothing has been read, and nothing is being guessed at.'),
  });
}

/** @type {ReadonlyArray<NormalisedApp>} */
window.FUSION_APPS = Object.freeze(APPS.map(normaliseApp));

}(window));
