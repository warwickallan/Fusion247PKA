// BUILD-006 Phase 4 — the verdict as a human reads it.
//
// Wayfinder §9.1 rung 1: human-facing work is reviewed FROM SOURCE first, and rendering is not a
// precondition for reading. This is that source view — every dimension's verdict, its coverage,
// and every finding with the rule that raised it and the evidence underneath it.
//
// Pure: a string in, a string out, no I/O and no clock.
//
// ── WHY COVERAGE IS RENDERED BESIDE EVERY VERDICT ───────────────────────────────────────────
// Because "pass" alone is the shape of a lie this estate has already been told more than once. A
// dimension that examined nothing and a dimension that examined everything both print `pass`, and
// the difference is the entire value of the check. So the coverage line is not an appendix — it
// sits under the verdict it qualifies, where a reader cannot get to the good news without it.

const SEVERITY_MARK = { block: '⛔ BLOCK', surface: '❓ SURFACED' };

const DIMENSION_TITLE = {
  fact: 'FACT — checkable assertions against cited evidence',
  quotation: 'QUOTATION — quoted passages against frozen bytes',
  privacy: 'PRIVACY — provenance first, then a closed pattern list',
  rights: 'RIGHTS — declared or derived basis per cited source',
  'cross-format': 'CROSS-FORMAT — siblings against the master spine',
};

function coverageLines(coverage) {
  return Object.entries(coverage)
    .filter(([k]) => k !== 'note')
    .map(([k, v]) => `  - ${k.replace(/_/g, ' ')}: **${v}**`);
}

/**
 * The whole verdict, rendered.
 *
 * `state` is optional and comes from readPackageState — where it is supplied the report also says
 * whether the package can move, which is the question the reader actually has.
 */
export function renderVerification({ result, state = null }) {
  const out = [];

  const headline = result.verdict === 'pass'
    ? '✅ PASS — no rule in the ruleset was broken'
    : `⛔ BLOCKED — ${result.blockingCount} blocking finding(s), ${result.surfacedCount} surfaced question(s)`;

  out.push(
    `# Verification — package \`${result.packageId.slice(0, 12)}…\``,
    '',
    `## ${headline}`,
    '',
    '| | |',
    '|---|---|',
    `| package_id | \`${result.packageId}\` |`,
    `| pack_id | \`${result.packId}\` |`,
    `| seed_id | \`${result.seedId}\` |`,
    `| verification_id | \`${result.verificationId}\` |`,
    `| verifier | \`${result.verifierVersion}\` |`,
    `| ruleset | \`${result.ruleset.version}\` · \`${result.ruleset.id}\` |`,
    '',
  );

  if (result.verdict !== 'pass') {
    out.push(
      '> **A blocked package cannot advance.** The block is a row, not a return value: it survives',
      '> a restart, and re-running verification does not clear it. It is cleared by a recorded',
      '> override (for a rule violation), a recorded answer (for a surfaced question), or by fixing',
      '> the draft — which produces a different package, because a package is immutable and its',
      '> identity is its content.',
      '',
    );
  }

  out.push('## The five dimensions, each answering for itself', '');

  for (const [name, d] of Object.entries(result.dimensions)) {
    const mark = d.verdict === 'pass' ? '✅ pass' : d.verdict === 'blocked' ? '⛔ blocked' : '❓ surfaced';
    out.push(
      `### ${mark} — ${DIMENSION_TITLE[name] ?? name}`,
      '',
      `**${d.blocking} blocking · ${d.surfaced} surfaced.** What this dimension actually examined:`,
      '',
      ...coverageLines(d.coverage),
      '',
    );
    if (d.coverage.note) out.push(`> ${d.coverage.note}`, '');
  }

  if (result.findings.length === 0) {
    out.push('## Findings', '', '_None._', '');
  } else {
    out.push(
      '## Findings',
      '',
      'Every one names the rule that raised it. Argue with the rule in',
      '`src/verify/contract/verification-v1.md`, not with the machine.',
      '',
      '| # | | dimension | rule | where | what |',
      '|---|---|---|---|---|---|',
      ...result.findings.map((f) => {
        const where = [
          f.claim_id ? `claim \`${f.claim_id}\`` : null,
          f.sibling ? `${f.sibling}[${f.segment_ordinal}]` : null,
          f.source_ref ? `\`${f.source_ref}\`` : null,
        ].filter(Boolean).join(' · ') || '—';
        return `| ${f.ordinal} | ${SEVERITY_MARK[f.severity]} | ${f.dimension} | \`${f.rule}\` | ${where} | ${f.detail.replace(/\|/g, '\\|')} |`;
      }),
      '',
    );
  }

  if (state !== null) {
    out.push(
      '## Where this package stands, read from the store',
      '',
      `- verification runs recorded: **${state.verificationRuns}**`,
      `- undisposed blocking findings: **${state.undisposedBlocks}**`,
      `- undisposed surfaced questions: **${state.undisposedSurfaced}**`,
      `- **advanceable: ${state.advanceable ? 'YES' : 'NO'}**`,
      `- advanced: ${state.advanced ? `yes, by ${state.advancedBy}` : 'no'}`,
      '',
    );
  }

  out.push(
    '---',
    '',
    '**What a pass is not.** It is not an endorsement of the writing, the story, or the truth of',
    'anything beyond the checkable tokens the FACT dimension reports. It means the package broke',
    'none of the rules in the ruleset named above.',
    '',
  );

  return `${out.join('\n')}\n`;
}
