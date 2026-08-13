// BUILD-015 WP-B15-41 - cockpit-api/serverConfig.test.js
//
// AC8 - STARTUP VALIDATES ITS CONFIG AND FAILS LOUDLY.
//
// The defect: this service had no configuration validation at all. It read each
// variable at the moment of use, deep inside a request, so a missing
// ASDAIR_DB_URL produced a listening port that answered every read with a 500 -
// a process that looks alive and cannot do its job.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateConfig, start, CONFIG_SPEC } = require('./server');

const GOOD = Object.freeze({
  ASDAIR_DB_URL: 'postgresql://asdair_ro:x@127.0.0.1:55432/asdair_test',
  ASDAIR_WRITE_DB_URL: 'postgresql://asdair_rw:x@127.0.0.1:55432/asdair_test',
});

test('AC8: a complete configuration validates', () => {
  const r = validateConfig(GOOD);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
  assert.equal(r.enabled.read, true);
  assert.equal(r.enabled.apply_answers, true);
});

test('AC8: a MISSING required variable is an error that names the variable and what it is for', () => {
  const r = validateConfig({});
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /^ASDAIR_DB_URL is not set/);
  assert.match(r.errors[0], /asdair_ro/, 'the message must say which role, or an operator is guessing');
});

test('AC8: a MALFORMED variable is an error that describes the SHAPE and never the value', () => {
  const r = validateConfig({ ASDAIR_DB_URL: 'mysql://asdair_ro:hunter2@host/db' });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /ASDAIR_DB_URL is malformed/);
  assert.match(r.errors[0], /postgres:\/\/ or postgresql:\/\//);
  // THE RULE THAT MATTERS MORE THAN THE CHECK. These strings are PRINTED.
  const all = r.errors.concat(r.warnings).join(' ');
  assert.ok(!/hunter2/.test(all), 'a validation message must never echo the value it rejected');
});

test('AC8: no error or warning on ANY input ever echoes a value', () => {
  // Swept across every variable rather than spot-checked on one, because a
  // single un-swept branch is all it takes to log a credential.
  const secret = 'sup3rsecretvalue';
  CONFIG_SPEC.forEach((spec) => {
    const env = Object.assign({}, GOOD);
    env[spec.name] = 'mysql://' + secret + '@nope';
    const r = validateConfig(env);
    const text = r.errors.concat(r.warnings).join(' ');
    assert.ok(!text.includes(secret), 'value leaked while validating ' + spec.name);
  });
});

test('AC8: the WRITE url is optional - a reader must not be refused a boot over an optional capability', () => {
  const r = validateConfig({ ASDAIR_DB_URL: GOOD.ASDAIR_DB_URL });
  assert.equal(r.ok, true, 'the read surface is the service\'s primary job and is fully useful alone');
  assert.equal(r.enabled.apply_answers, false);
  // But it is LOUD about what is therefore unavailable.
  assert.ok(r.warnings.some((w) => /ASDAIR_WRITE_DB_URL/.test(w) && /503 not_configured/.test(w)));
});

test('AC8: a bad port or bind address is rejected rather than silently defaulted', () => {
  assert.equal(validateConfig(Object.assign({}, GOOD, { ASDAIR_COCKPIT_PORT: 'eight-thousand' })).ok, false);
  assert.equal(validateConfig(Object.assign({}, GOOD, { ASDAIR_COCKPIT_PORT: '70000' })).ok, false);
  assert.equal(validateConfig(Object.assign({}, GOOD, { ASDAIR_COCKPIT_BIND: 'not a host!' })).ok, false);
  // Why this one is not cosmetic: falling back from an unparseable bind to a
  // default silently changes the security posture of the process.
  assert.equal(validateConfig(Object.assign({}, GOOD, { ASDAIR_COCKPIT_BIND: '0.0.0.0' })).ok, true,
    'a deliberate public bind is allowed - it is the ACCIDENTAL one that is refused');
});

test('AC8: "*" is never an acceptable allowed origin', () => {
  assert.equal(validateConfig(Object.assign({}, GOOD, { ASDAIR_COCKPIT_ALLOWED_ORIGIN: '*' })).ok, false);
  assert.equal(validateConfig(Object.assign({}, GOOD, { ASDAIR_COCKPIT_ALLOWED_ORIGIN: 'https://cockpit.local:8080' })).ok, true);
  // Unset is the SAFE default, not an error: no CORS header is sent at all.
  const unset = validateConfig(GOOD);
  assert.equal(unset.ok, true);
  assert.ok(unset.warnings.some((w) => /safe default, not an error/.test(w)));
});

// ---------------------------------------------------------------------
// THE BEHAVIOUR, not just the checker. A validator nothing calls is decoration.
// ---------------------------------------------------------------------
test('AC8: start() REFUSES TO LISTEN on a bad config, exits non-zero, and says why', () => {
  const errors = [];
  let exitCode = null;
  const server = start({
    env: {},
    log: () => {},
    errorLog: (m) => errors.push(m),
    exit: (c) => { exitCode = c; },
  });

  assert.equal(server, null, 'NO PORT MAY BE OPENED - an open port is a claim the service works');
  assert.equal(exitCode, 1, 'a non-zero exit is what makes this loud to a supervisor');
  const text = errors.join('\n');
  assert.match(text, /REFUSING TO START/);
  assert.match(text, /ASDAIR_DB_URL is not set/);
  assert.match(text, /No port has been opened/);
});

test('AC8: start() on a good config listens, and reports which capabilities are on', async () => {
  const logs = [];
  const server = start({
    // A FIXED high port, deliberately, rather than 0. `listen(0)` is the usual
    // way to make a server testable, but the validator correctly REFUSES port 0
    // - an ephemeral port is a misconfiguration for a service the cockpit has
    // to find at a known address. Relaxing the check to make this line easier
    // would have been weakening a real rule to suit a test.
    env: Object.assign({}, GOOD, { ASDAIR_COCKPIT_PORT: '18710', ASDAIR_COCKPIT_BIND: '127.0.0.1' }),
    log: (m) => logs.push(m),
    errorLog: () => {},
    exit: () => { throw new Error('exit must not be called on a valid config'); },
  });
  assert.ok(server, 'a valid config must produce a server');
  await new Promise((r) => server.once('listening', r));
  const line = logs.join('\n');
  assert.match(line, /listening on 127\.0\.0\.1/);
  // An operator reads what the service CAN do, rather than inferring it from
  // which warnings failed to appear.
  assert.match(line, /reads on/);
  assert.match(line, /apply-answers on/);
  assert.ok(!/postgres/.test(line), 'the startup line must never contain a connection string');
  await new Promise((r) => server.close(r));
});

test('AC8: the prose config comment and the machine-readable spec name the same variables', () => {
  // Prose rots. This is the same technique httpApi.test.js uses to stop the
  // route-count header going stale, applied to the config block.
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'server.js'), 'utf8');
  const header = src.slice(0, src.indexOf('function corsHeaders'));
  CONFIG_SPEC.forEach((spec) => {
    assert.ok(header.includes(spec.name),
      spec.name + ' is enforced by CONFIG_SPEC but is not documented in the header comment');
  });
});
