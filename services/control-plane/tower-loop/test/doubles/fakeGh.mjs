// WO-OR-24 test double — the `gh api` seam, with NO network and NO gh binary.
//
// Answers exactly the two argv shapes pollPrComments.mjs builds, and REFUSES anything else. That
// refusal is deliberate: a permissive double will happily answer an argv the real seam would have
// rejected, and then the suite is proving something about the double rather than about the code.
//
// It also records every argv it was handed, so a test can assert WHAT was asked of GitHub — which
// is how "the head SHA came from the API, not the body" becomes an observable fact rather than a
// claim about the implementation.

export function makeFakeGh({ headSha, comments = [], failHead = null }) {
  const calls = [];
  return {
    calls,
    async api(args) {
      calls.push(args.join(' '));
      const [endpoint] = args;

      if (/^repos\/[^/]+\/[^/]+\/pulls\/\d+$/.test(endpoint)) {
        if (failHead) throw new Error(failHead);
        const jqIdx = args.indexOf('--jq');
        if (jqIdx === -1 || args[jqIdx + 1] !== '.head.sha') {
          throw new Error(`fakeGh: unexpected pulls query (expected --jq .head.sha): ${args.join(' ')}`);
        }
        return `${headSha}\n`;
      }

      if (/^repos\/[^/]+\/[^/]+\/issues\/\d+\/comments$/.test(endpoint)) {
        return JSON.stringify(comments);
      }

      throw new Error(`fakeGh: refusing an endpoint this double does not model: ${endpoint}`);
    },
  };
}

/** One GitHub-shaped issue comment. Field names are GitHub's, not ours — the point of the double
 *  is that the poller has to cope with the real shape. */
export function ghComment({ id, login = 'warwickallan', body, created_at = '2026-08-02T18:19:02Z', html_url = null }) {
  return {
    id,
    user: { login },
    created_at,
    updated_at: created_at,
    body,
    html_url: html_url ?? `https://github.com/warwickallan/Fusion247PKA/pull/87#issuecomment-${id}`,
  };
}
