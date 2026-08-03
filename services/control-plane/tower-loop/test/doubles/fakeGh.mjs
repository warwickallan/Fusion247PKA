// WO-OR-24 test double — the `gh api` seam, with NO network and NO gh binary.
//
// Answers exactly the two argv shapes pollPrComments.mjs builds, and REFUSES anything else. That
// refusal is deliberate: a permissive double will happily answer an argv the real seam would have
// rejected, and then the suite is proving something about the double rather than about the code.
//
// It also records every argv it was handed, so a test can assert WHAT was asked of GitHub — which
// is how "the head SHA came from the API, not the body" becomes an observable fact rather than a
// claim about the implementation.

// WO-2026-08-03-05 — the double now also models OPEN-PR DISCOVERY, and models it PER REPOSITORY.
//
//   openPrs   { "<owner/name>": [n, …] }  or  [n, …] for the single-repo case
//   byPr      { "<n>": { headSha, comments } }  — per-PR content, so a test can prove that TWO
//                                                 open PRs each got their OWN round rather than
//                                                 one PR's comments being served for both.
//
// `openPrs` defaults to `null` meaning "this double does not model discovery" and the endpoint is
// REFUSED, exactly as any other unmodelled endpoint is. It deliberately does NOT default to "every
// PR is open": a permissive default would let a test that never states what GitHub considers open
// pass over the very behaviour under change.
export function makeFakeGh({ headSha, comments = [], failHead = null, openPrs = null, byPr = null }) {
  const calls = [];
  const forPr = (pr) => {
    const entry = byPr?.[String(pr)];
    return { headSha: entry?.headSha ?? headSha, comments: entry?.comments ?? comments };
  };
  return {
    calls,
    async api(args) {
      calls.push(args.join(' '));
      const [endpoint] = args;

      // Discovery: repos/<owner>/<name>/pulls?state=open&per_page=100
      const openMatch = /^repos\/([^/]+\/[^/]+)\/pulls\?state=open(&|$)/.exec(endpoint);
      if (openMatch) {
        if (openPrs === null) {
          throw new Error(`fakeGh: refusing open-PR discovery this double does not model: ${endpoint}`);
        }
        if (!args.includes('--paginate')) throw new Error(`fakeGh: open-PR discovery must paginate: ${args.join(' ')}`);
        const jqIdx = args.indexOf('--jq');
        if (jqIdx === -1 || args[jqIdx + 1] !== '.[].number') {
          throw new Error(`fakeGh: unexpected open-PR query (expected --jq .[].number): ${args.join(' ')}`);
        }
        const list = Array.isArray(openPrs) ? openPrs : (openPrs[openMatch[1]] ?? []);
        return list.length ? `${list.join('\n')}\n` : '';
      }

      if (/^repos\/[^/]+\/[^/]+\/pulls\/\d+$/.test(endpoint)) {
        if (failHead) throw new Error(failHead);
        const jqIdx = args.indexOf('--jq');
        if (jqIdx === -1 || args[jqIdx + 1] !== '.head.sha') {
          throw new Error(`fakeGh: unexpected pulls query (expected --jq .head.sha): ${args.join(' ')}`);
        }
        return `${forPr(/\/pulls\/(\d+)$/.exec(endpoint)[1]).headSha}\n`;
      }

      const commentsMatch = /^repos\/[^/]+\/[^/]+\/issues\/(\d+)\/comments$/.exec(endpoint);
      if (commentsMatch) {
        return JSON.stringify(forPr(commentsMatch[1]).comments);
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
