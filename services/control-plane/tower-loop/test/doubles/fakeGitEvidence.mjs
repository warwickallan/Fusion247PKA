// BUILD-014 Tower supervisor loop — DETERMINISTIC fake Git evidence (CI test double, FIX 3).
//
// Stands in for gatherGitEvidence so the merge-class routing can be exercised in CI without a
// real git repo / gh / network. Returns a resolved evidence packet with a canned diff, unless
// the turn's head_sha is the literal 'UNRESOLVABLE' marker → returns resolved:false so the
// fail-closed BLOCK path is also covered.
//
// Loaded by watcher.mjs when TOWER_GIT_EVIDENCE_MODULE points here.

export async function gatherGitEvidence({ repo = null, branch = null, baseSha = null, headSha = null, prNumber = null } = {}) {
  if (headSha === 'UNRESOLVABLE') {
    return {
      resolved: false, blocker: `head unresolvable (${headSha}): fake double forced fail-closed`,
      repo, branch, base_sha: null, head_sha: null, diff_range: null,
      changed_files: [], diff_text: null, diff_truncated: false,
      ci_checks: null, ci_source: 'unavailable', collected_at: new Date().toISOString(),
    };
  }
  const head = headSha || 'deadbeefcafefeed0000000000000000deadbeef';
  const base = baseSha || 'cafebabe11112222333344445555666677778888';
  return {
    resolved: true, blocker: null,
    repo: repo || 'warwickallan/Fusion247PKA', branch: branch || 'test-branch',
    base_sha: base, head_sha: head, diff_range: `${base}..${head}`,
    changed_files: ['services/control-plane/tower-loop/example.mjs'],
    diff_text: [
      'diff --git a/services/control-plane/tower-loop/example.mjs b/services/control-plane/tower-loop/example.mjs',
      'index 1111111..2222222 100644',
      '--- a/services/control-plane/tower-loop/example.mjs',
      '+++ b/services/control-plane/tower-loop/example.mjs',
      '@@ -1,1 +1,2 @@',
      " export function convert(csv) { return JSON.stringify(csv); }",
      '+export const VERSION = "1.0.0";',
    ].join('\n'),
    diff_truncated: false,
    ci_checks: prNumber != null ? 'checks: all passing (fake)' : null,
    ci_source: prNumber != null ? 'gh pr checks (fake)' : 'unavailable',
    collected_at: new Date().toISOString(),
  };
}
