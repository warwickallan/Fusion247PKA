// Fusion247 Cockpit — GATE: whyDown() must name a reason, never a bare number.
//
// This exists because two branches of the reason map were UNREACHABLE DEAD CODE from the day they
// were written, and nothing noticed for weeks — the cockpit told Warwick a service was down "— 23"
// while it was up. The map looked correct on inspection. It was wrong on execution.
//
// So this gate EXECUTES the function, including against a REAL DOMException produced by a REAL
// aborted fetch, rather than a hand-built object that might not have the legacy `code` field at all.
// A synthetic stand-in would have passed the whole time.
//
// Exits non-zero on failure AND on a vacuous run.
import http from 'node:http';
import { whyDown, DOWN_REASONS } from './down-reason.mjs';

let ran = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  ran++;
  if (cond) console.log('  PASS  ' + name + (detail ? ' — ' + detail : ''));
  else { failed++; console.error('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};

// --- THE REGRESSION, reproduced for real -------------------------------------------------------
// A genuine fetch timeout. Not a fake: the defect lived entirely in DOMException's legacy numeric
// `code` field, which only a real DOMException has.
{
  // A server that ACCEPTS the connection and then never answers. This is the only way to reach the
  // timeout path deterministically: an unreachable port is REFUSED instantly (a TypeError with
  // cause ECONNREFUSED) and never reaches the abort at all — the first version of this gate made
  // exactly that mistake and reported the trap as historical when it is live.
  const hang = http.createServer(() => { /* deliberately never responds */ });
  await new Promise((r) => hang.listen(0, '127.0.0.1', r));
  const port = hang.address().port;
  let caught = null;
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(50) });
  } catch (e) { caught = e; }
  hang.closeAllConnections?.();
  hang.close();
  ok('a real aborted fetch produced a TimeoutError', caught !== null && caught.name === 'TimeoutError',
    caught ? caught.name : 'no error');
  ok('the DOMException legacy numeric code is still present (the trap is real, not historical)',
    caught && typeof caught.code === 'number',
    caught ? 'name=' + caught.name + ' code=' + caught.code : 'no error');
  const reason = whyDown(caught);
  ok('whyDown returns WORDS for a real timeout, not the legacy number',
    reason === 'it did not answer in time', JSON.stringify(reason));
  ok('whyDown never returns a bare number', !/^\d+$/.test(reason), JSON.stringify(reason));
}

// --- every named branch is reachable ------------------------------------------------------------
// The point is not that the map has entries; it is that each entry can actually be REACHED.
{
  ok('TimeoutError by name', whyDown({ name: 'TimeoutError', code: 23 }) === 'it did not answer in time');
  ok('AbortError by name', whyDown({ name: 'AbortError', code: 20 }) === 'it did not answer in time');
  ok('ECONNREFUSED via cause', whyDown({ name: 'TypeError', cause: { code: 'ECONNREFUSED' } }) === 'nothing is listening there');
  ok('ENOTFOUND via cause', whyDown({ name: 'TypeError', cause: { code: 'ENOTFOUND' } }) === 'that address does not resolve');
  ok('ECONNRESET via cause', whyDown({ name: 'TypeError', cause: { code: 'ECONNRESET' } }) === 'the connection was reset');
  ok('EHOSTUNREACH via cause', whyDown({ name: 'TypeError', cause: { code: 'EHOSTUNREACH' } }) === 'that host is unreachable');
  ok('string code on the error itself', whyDown({ code: 'ECONNREFUSED' }) === 'nothing is listening there');
  // Every key in the map must be reachable by at least one route. Enumeration, not spot-check:
  // "found nothing this time" is not a completion condition.
  const unreachable = Object.keys(DOWN_REASONS).filter((k) => {
    const byName = whyDown({ name: k }) === DOWN_REASONS[k];
    const byCause = whyDown({ name: 'TypeError', cause: { code: k } }) === DOWN_REASONS[k];
    const byCode = whyDown({ code: k }) === DOWN_REASONS[k];
    return !(byName || byCause || byCode);
  });
  ok('EVERY entry in DOWN_REASONS is reachable', unreachable.length === 0,
    unreachable.length ? 'unreachable: ' + unreachable.join(', ') : Object.keys(DOWN_REASONS).length + ' entries');
}

// --- degrading honestly on things it does not recognise -----------------------------------------
{
  ok('unrecognised STRING code is passed through', whyDown({ cause: { code: 'EWEIRD' } }) === 'EWEIRD');
  ok('unrecognised NUMERIC code does NOT leak as a number',
    !/^\d+$/.test(whyDown({ name: 'SomeError', code: 99 })), whyDown({ name: 'SomeError', code: 99 }));
  ok('null/undefined degrade to "unreachable"', whyDown(null) === 'unreachable' && whyDown(undefined) === 'unreachable');
  ok('a non-object degrades to "unreachable"', whyDown('boom') === 'unreachable');
}

// --- the ordering itself, pinned ----------------------------------------------------------------
// If someone reorders the lookups back to code-before-name, THIS is what goes red.
{
  const legacyTimeout = { name: 'TimeoutError', code: 23, cause: undefined };
  ok('NAME beats legacy numeric CODE (the exact ordering defect)',
    whyDown(legacyTimeout) === 'it did not answer in time',
    'got ' + JSON.stringify(whyDown(legacyTimeout)));
}

if (ran === 0) { console.error('DOWN-REASON-CHECK FAIL — zero assertions executed.'); process.exit(1); }
if (failed) { console.error(`DOWN-REASON-CHECK FAIL — ${failed} of ${ran} assertions failed.`); process.exit(1); }
console.log(`DOWN-REASON-CHECK PASS — ${ran} assertions executed, 0 failed.`);
