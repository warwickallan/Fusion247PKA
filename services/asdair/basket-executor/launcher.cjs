// =====================================================================
// WO-2026-08-17-B15-BASKET - CHROME LAUNCH + ENDPOINT REUSE.
//
// THE ONE MISSING SPAWN. `browser-runner/cdp.js` attaches only: endpoint()
// returns ASDAIR_CDP_ENDPOINT or http://127.0.0.1:9222 and nothing in the
// estate has ever launched the browser it attaches to. That single gap is why
// the browser step has never started by itself.
//
// TWO RULES THIS MODULE EXISTS TO KEEP:
//
//   1. REUSE BEFORE SPAWN. If a debuggable Chrome is already answering on the
//      port, that IS the browser - it is adopted, never duplicated. A second
//      Chrome on the same --user-data-dir does not get a second debug port; it
//      hands its argv to the running instance and exits, and the caller is then
//      talking to a browser it did not configure. Reuse is the correct path,
//      not an optimisation.
//
//   2. NO BAKED PATHS. chromePath, profileDir and port are CONFIGURATION and
//      arrive from the caller or the environment. Nothing here carries a
//      default for them and nothing here reads a file under the profile
//      directory - this module hands a path to a child process and otherwise
//      never touches it. Missing configuration fails fast and loudly.
//
// Visibility is not negotiable: --headless is refused before spawn, and
// cdp.assertVisibleBrowser() refuses it again after attach.
// =====================================================================
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');

/** Configuration missing or malformed. Thrown before anything is launched. */
class LauncherConfigError extends Error {
  constructor(message) { super(message); this.name = 'LauncherConfigError'; }
}

/**
 * Resolve and VALIDATE launch configuration. No defaults for the three values
 * the Work Order requires to be supplied; a default here would be the baked
 * path this module exists not to carry.
 */
function resolveConfig({ chromePath, profileDir, port, startUrl } = {}, env = process.env) {
  const cfg = {
    chromePath: chromePath || env.ASDAIR_CHROME_PATH || null,
    profileDir: profileDir || env.ASDAIR_CHROME_PROFILE_DIR || null,
    port: port || env.ASDAIR_CDP_PORT || null,
    startUrl: startUrl || 'https://www.asda.com/groceries',
  };

  const missing = ['chromePath', 'profileDir', 'port'].filter((k) => !cfg[k]);
  if (missing.length) {
    throw new LauncherConfigError(
      `launcher configuration missing: ${missing.join(', ')}. `
      + 'Supply --chrome, --profile and --port (or ASDAIR_CHROME_PATH, ASDAIR_CHROME_PROFILE_DIR, '
      + 'ASDAIR_CDP_PORT). This module carries no defaults for them by design.',
    );
  }

  const p = Number(cfg.port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    throw new LauncherConfigError(`launcher port is not a valid TCP port: ${JSON.stringify(cfg.port)}`);
  }
  cfg.port = p;

  if (/--?headless/i.test(String(cfg.chromePath))) {
    throw new LauncherConfigError('refusing a headless chrome invocation: the shop must be visible and takeable-over');
  }
  return cfg;
}

function endpointUrl(port) { return `http://127.0.0.1:${port}`; }

/**
 * Is a debuggable browser answering on this port right now? Returns its
 * /json/version payload, or null. Never throws for an absent browser - "not
 * running" is an ordinary answer to this question.
 */
async function probeEndpoint(port, { timeoutMs = 2000, fetchImpl = fetch } = {}) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetchImpl(`${endpointUrl(port)}/json/version`, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** The argv this module spawns. Exported so a proof can assert its shape without launching anything. */
function chromeArgs(cfg) {
  return [
    `--remote-debugging-port=${cfg.port}`,
    `--user-data-dir=${cfg.profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    cfg.startUrl,
  ];
}

/**
 * A debuggable, VISIBLE Chrome on the configured port - reusing the one that is
 * already there, or launching one and waiting for it to answer.
 *
 * Returns { reused, version, endpoint, pid }. `reused: true` means this process
 * launched nothing.
 */
async function ensureChrome(input = {}, { log = () => {}, fetchImpl = fetch, spawnImpl = spawn, waitMs = 30_000 } = {}) {
  const cfg = resolveConfig(input);
  const endpoint = endpointUrl(cfg.port);

  const already = await probeEndpoint(cfg.port, { fetchImpl });
  if (already) {
    log(`reusing the debuggable Chrome already on ${endpoint} (${already.Browser})`);
    return { reused: true, version: already, endpoint, pid: null, config: cfg };
  }

  if (!fs.existsSync(cfg.chromePath)) {
    throw new LauncherConfigError(`chrome executable not found at the configured path: ${cfg.chromePath}`);
  }
  if (!fs.existsSync(cfg.profileDir)) {
    throw new LauncherConfigError(`chrome profile directory not found at the configured path: ${cfg.profileDir}`);
  }

  const args = chromeArgs(cfg);
  log(`launching Chrome on port ${cfg.port} against the configured profile`);
  const child = spawnImpl(cfg.chromePath, args, { detached: true, stdio: 'ignore' });
  if (child && typeof child.unref === 'function') child.unref();

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 750));
    const v = await probeEndpoint(cfg.port, { fetchImpl });
    if (v) {
      log(`Chrome is answering on ${endpoint} (${v.Browser})`);
      return { reused: false, version: v, endpoint, pid: child ? child.pid : null, config: cfg };
    }
  }
  throw new Error(`Chrome did not answer on ${endpoint} within ${waitMs}ms of launch`);
}

module.exports = { resolveConfig, probeEndpoint, ensureChrome, chromeArgs, endpointUrl, LauncherConfigError };
