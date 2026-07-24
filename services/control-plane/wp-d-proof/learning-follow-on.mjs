// Pure projection from an accepted learning candidate into the durable Larry handoff.
// Keeping this formatter separate makes the exact no-conversation-required payload testable.
const line = (label, value) => value === null || value === undefined || value === '' ? null : `${label}: ${value}`;

export function formatLearningFollowOn(candidate, command) {
  const system = candidate.candidate_scope === 'system_improvement';
  const title = String(candidate.recommendation || '').slice(0, 120);
  if (!system) {
    return {
      title,
      detail: `${candidate.recommendation}${candidate.why ? `\n\nWhy: ${candidate.why}` : ''}`,
      correlationId: candidate.correlation_id,
    };
  }

  const detail = [
    line('Candidate', candidate.candidate_ref),
    line('Requested improvement', candidate.recommendation),
    line('Target agent/system', candidate.proposed_target),
    line('Category', candidate.candidate_kind),
    line('Source', candidate.source_title ? `${candidate.source_title} (${candidate.source_video_id})` : candidate.source_video_id),
    line('Source / graph evidence', candidate.evidence),
    line('Why this should improve the system', candidate.why),
    line('Expected effect', candidate.expected_effect),
    line('Confidence', candidate.confidence),
    line('Risk / what would invalidate it', candidate.risk),
    line('Concrete next step', candidate.next_step),
    line('Warwick approval', `${command.requested_by} accepted via learning_command ${command.id} at ${command.requested_at}`),
    '',
    'Governance: investigate/implement through normal MyPKA governance. This approval did not mutate canonical MyPKA.',
  ].filter((value) => value !== null).join('\n');

  return { title, detail, correlationId: candidate.candidate_ref };
}
