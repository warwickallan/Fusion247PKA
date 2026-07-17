// Fusion Tower — GitHub / ClickUp event intake.
//
// Detects meaningful PR / check / comment (GitHub) and task (ClickUp) changes,
// normalises them into the run_event shape, and dedups by (source_event_id) +
// (head_sha, kind). Self-generated loops (source='tower' or a self-marker in the
// payload) are flagged so the dispatcher never advances a run off its own output.
//
// TRANSPORT (Pax Item 3b): GitHub is POLLED with conditional requests (ETag /
// If-None-Match) — a 304 returns no body and (authenticated) doesn't count
// against the rate limit. Unauthenticated read works for a public repo and is the
// WP0 proof path; writes are gated on GITHUB_TOKEN. ClickUp is polled likewise;
// webhooks are deferred (no public ingress in WP0). Live polling is only attempted
// when a fetch impl is supplied — the proof uses SYNTHETIC fixtures.

import crypto from 'node:crypto';
import { PRINCIPAL, EVENT_SOURCE } from '../core/states.js';

// A tower self-marker embedded in any comment/card the Tower posts, so a redeliver
// of the Tower's own output is recognised and never advances a run.
export const TOWER_SELF_MARKER = '<!-- ftw:self -->';

// Deterministic synthetic id for an event with no stable native id (a random id
// would defeat dedup — see dedup-and-timeout-contract.md §1.1).
function syntheticId(parts) {
  return 'syn_' + crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 24);
}

function isSelf(bodyOrPayload) {
  const s = typeof bodyOrPayload === 'string' ? bodyOrPayload : JSON.stringify(bodyOrPayload ?? {});
  return s.includes(TOWER_SELF_MARKER);
}

/**
 * Normalise a GitHub event (webhook-shaped or REST-poll-shaped) into run_event
 * ingest args. Returns null for an event kind we do not care about.
 *
 * @param {object} raw       the GitHub object
 * @param {string} [deliveryId]  X-GitHub-Delivery id, when polling headers carry one
 */
export function normalizeGithubEvent(raw, deliveryId) {
  if (!raw || typeof raw !== 'object') return null;

  // Pull request.
  if (raw.pull_request || raw.action && raw.number && raw.pull_request === undefined && raw.head) {
    const pr = raw.pull_request ?? raw;
    const action = raw.action ?? 'synchronize';
    const headSha = pr.head?.sha ?? raw.head?.sha ?? null;
    const prRef = pr.base?.repo?.full_name && pr.number ? `${pr.base.repo.full_name}#${pr.number}` : (raw.repo && raw.number ? `${raw.repo}#${raw.number}` : null);
    return {
      source: EVENT_SOURCE.GITHUB,
      sourceEventId: deliveryId ?? pr.node_id ?? syntheticId(['pr', prRef, action, headSha]),
      headSha,
      kind: `pull_request.${action}`,
      selfGenerated: false,
      payload: { pr_ref: prRef, action, head_sha: headSha, url: pr.html_url ?? null },
    };
  }

  // Check suite / check run.
  if (raw.check_suite || raw.check_run) {
    const cs = raw.check_suite ?? raw.check_run;
    const headSha = cs.head_sha ?? null;
    const conclusion = cs.conclusion ?? cs.status ?? 'unknown';
    return {
      source: EVENT_SOURCE.GITHUB,
      sourceEventId: deliveryId ?? cs.node_id ?? syntheticId(['check', headSha, conclusion]),
      headSha,
      kind: raw.check_run ? 'check_run.completed' : 'check_suite.completed',
      selfGenerated: false,
      payload: { head_sha: headSha, conclusion, app: cs.app?.slug ?? null },
    };
  }

  // Issue / PR comment.
  if (raw.comment && (raw.issue || raw.pull_request || raw.action)) {
    const body = raw.comment.body ?? '';
    const prRef = raw.repository?.full_name && (raw.issue?.number ?? raw.pull_request?.number)
      ? `${raw.repository.full_name}#${raw.issue?.number ?? raw.pull_request?.number}` : (raw.pr_ref ?? null);
    return {
      source: EVENT_SOURCE.GITHUB,
      sourceEventId: deliveryId ?? String(raw.comment.id ?? syntheticId(['comment', prRef, body.slice(0, 40)])),
      headSha: raw.head_sha ?? null,
      kind: 'issue_comment.created',
      selfGenerated: isSelf(body),
      payload: { pr_ref: prRef, author: raw.comment.user?.login ?? null, is_self: isSelf(body) },
    };
  }

  return null;
}

/**
 * Normalise a ClickUp task event into run_event ingest args.
 */
export function normalizeClickupEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const taskId = raw.task_id ?? raw.task?.id ?? null;
  if (!taskId) return null;
  const eventName = raw.event ?? 'taskUpdated';
  const status = raw.task?.status?.status ?? raw.history_items?.[0]?.after?.status ?? null;
  return {
    source: EVENT_SOURCE.CLICKUP,
    sourceEventId: raw.webhook_id && raw.event_id ? `${raw.webhook_id}:${raw.event_id}` : syntheticId(['clickup', taskId, eventName, status]),
    headSha: null,
    kind: eventName === 'taskUpdated' ? 'task.status_changed' : `task.${eventName}`,
    selfGenerated: isSelf(raw),
    payload: { task_id: taskId, status, event: eventName },
  };
}

/**
 * Route a normalised event to the responder expected to answer it. WP0 rules:
 *   - a green check_suite / PR ready → a gpt_codex REVIEW turn
 *   - a human/reviewer comment → a larry turn to address it
 *   - a ClickUp status change → a larry turn to progress the task
 * (tower is never a responder.)
 */
export function routeResponder(normalized) {
  if (!normalized) return null;
  if (normalized.source === EVENT_SOURCE.GITHUB) {
    if (normalized.kind.startsWith('check_suite') || normalized.kind.startsWith('check_run')) {
      return normalized.payload?.conclusion === 'success' ? PRINCIPAL.GPT_CODEX : PRINCIPAL.LARRY;
    }
    if (normalized.kind.startsWith('pull_request')) return PRINCIPAL.GPT_CODEX;
    if (normalized.kind.startsWith('issue_comment')) return PRINCIPAL.LARRY;
  }
  if (normalized.source === EVENT_SOURCE.CLICKUP) return PRINCIPAL.LARRY;
  return null;
}

/**
 * Conditional GitHub REST poll. LIVE ONLY when `fetchImpl` is provided (the proof
 * uses synthetic fixtures instead). Returns { status, etag, events, notModified }.
 * A 304 yields notModified:true, unchanged etag, and no events (free of rate limit
 * when authenticated).
 *
 * @param {object} args
 * @param {string} args.repo         'owner/repo'
 * @param {string} args.resource     e.g. 'pulls', 'commits/<sha>/check-runs'
 * @param {string|null} [args.etag]
 * @param {string|null} [args.token]  GITHUB_TOKEN; unauthenticated read allowed for public repos
 * @param {function} args.fetchImpl  (url, {headers}) => { status, headers, json() }
 */
export async function pollGithub({ repo, resource, etag = null, token = null, fetchImpl } = {}) {
  if (typeof fetchImpl !== 'function') {
    return { status: 'gated', notModified: false, etag, events: [], blocker: 'no fetch impl supplied (live GitHub polling gated — proof uses synthetic fixtures)' };
  }
  const url = `https://api.github.com/repos/${repo}/${resource}`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'fusion-tower' };
  if (etag) headers['If-None-Match'] = etag;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchImpl(url, { headers });
  if (res.status === 304) {
    return { status: 304, notModified: true, etag, events: [] };
  }
  const nextEtag = (res.headers?.get ? res.headers.get('etag') : res.headers?.etag) ?? etag;
  const body = await res.json();
  const items = Array.isArray(body) ? body : [body];
  const events = items.map((it) => normalizeGithubEvent(it)).filter(Boolean);
  return { status: res.status, notModified: false, etag: nextEtag, events };
}
